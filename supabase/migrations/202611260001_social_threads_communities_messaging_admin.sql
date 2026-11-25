-- Migration: 202611260001_social_threads_communities_messaging_admin.sql
-- Additive, non-destructive Production Social Media, Meta Threads + Facebook Groups,
-- Dedicated Messaging Center, Unified Zalo Polls, Trust/Safety Moderation & Admin Document Gift System.

-- =============================================================================
-- 1. Unified User Identity, Privacy & Profile Extensions (Module Identity)
-- =============================================================================
alter table public.profiles
  add column if not exists bio text not null default '',
  add column if not exists cover_url text,
  add column if not exists university text not null default '',
  add column if not exists major text not null default '',
  add column if not exists interests text[] not null default '{}',
  add column if not exists location_area text not null default '',
  add column if not exists website_url text not null default '',
  add column if not exists is_private boolean not null default false,
  add column if not exists allow_messages_from text not null default 'everyone'
    check (allow_messages_from in ('everyone', 'friends_and_followers', 'friends', 'nobody')),
  add column if not exists allow_mentions_from text not null default 'everyone'
    check (allow_mentions_from in ('everyone', 'followers', 'friends', 'nobody')),
  add column if not exists show_online_status boolean not null default true,
  add column if not exists account_status text not null default 'active'
    check (account_status in ('active', 'restricted', 'suspended', 'banned')),
  add column if not exists reputation_score integer not null default 0,
  add column if not exists followers_count integer not null default 0 check (followers_count >= 0),
  add column if not exists following_count integer not null default 0 check (following_count >= 0),
  add column if not exists friends_count integer not null default 0 check (friends_count >= 0),
  add column if not exists profile_views_count integer not null default 0 check (profile_views_count >= 0);

create index if not exists profiles_display_name_lower_idx
  on public.profiles (lower(display_name));

-- Social Graph: 1-Way Follows (with Private Account Follow Request support)
create table if not exists public.social_follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'accepted' check (status in ('pending', 'accepted')),
  is_close_friend boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create index if not exists social_follows_following_idx
  on public.social_follows (following_id, status);

-- Social Graph: 2-Way Friendships & Requests (distinct from Follow!)
create table if not exists public.social_friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  receiver_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sender_id, receiver_id),
  check (sender_id <> receiver_id)
);

create index if not exists social_friend_requests_receiver_idx
  on public.social_friend_requests (receiver_id, status, created_at desc);

-- Block / Mute / Restrict relationships
create table if not exists public.social_user_relations (
  actor_id uuid not null references auth.users(id) on delete cascade,
  target_id uuid not null references auth.users(id) on delete cascade,
  relation_type text not null check (relation_type in ('block', 'mute', 'restrict')),
  created_at timestamptz not null default now(),
  primary key (actor_id, target_id, relation_type),
  check (actor_id <> target_id)
);

create index if not exists social_user_relations_target_idx
  on public.social_user_relations (target_id, relation_type);

alter table public.social_follows enable row level security;
alter table public.social_friend_requests enable row level security;
alter table public.social_user_relations enable row level security;

drop policy if exists "read accepted follows or own" on public.social_follows;
create policy "read accepted follows or own"
  on public.social_follows for select to authenticated
  using (status = 'accepted' or auth.uid() = follower_id or auth.uid() = following_id);

drop policy if exists "manage own follows" on public.social_follows;
create policy "manage own follows"
  on public.social_follows for all to authenticated
  using (auth.uid() = follower_id or auth.uid() = following_id)
  with check (auth.uid() = follower_id or auth.uid() = following_id);

drop policy if exists "participants read friend requests" on public.social_friend_requests;
create policy "participants read friend requests"
  on public.social_friend_requests for select to authenticated
  using (auth.uid() = sender_id or auth.uid() = receiver_id);

drop policy if exists "participants manage friend requests" on public.social_friend_requests;
create policy "participants manage friend requests"
  on public.social_friend_requests for all to authenticated
  using (auth.uid() = sender_id or auth.uid() = receiver_id)
  with check (auth.uid() = sender_id or auth.uid() = receiver_id);

drop policy if exists "actors manage own block mute restrict" on public.social_user_relations;
create policy "actors manage own block mute restrict"
  on public.social_user_relations for all to authenticated
  using (auth.uid() = actor_id)
  with check (auth.uid() = actor_id);

-- Helper check: whether two users have blocked each other
create or replace function public.are_users_blocked(u1 uuid, u2 uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.social_user_relations r
    where r.relation_type = 'block'
      and ((r.actor_id = u1 and r.target_id = u2) or (r.actor_id = u2 and r.target_id = u1))
  );
$$;

-- =============================================================================
-- 2. Communities, RBAC Roles, Events & Gamification (Module Community)
-- =============================================================================
create table if not exists public.social_communities (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text not null default '',
  avatar_url text,
  cover_url text,
  visibility text not null default 'public' check (visibility in ('public', 'private', 'hidden')),
  topics text[] not null default '{}',
  rules jsonb not null default '[]'::jsonb,
  require_post_approval boolean not null default false,
  require_member_approval boolean not null default false,
  allow_anonymous_posts boolean not null default true,
  is_suspended boolean not null default false,
  owner_id uuid references auth.users(id) on delete set null,
  member_count integer not null default 1 check (member_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.social_community_members (
  community_id uuid not null references public.social_communities(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'moderator', 'member', 'pending', 'banned')),
  reputation_points integer not null default 0,
  badges text[] not null default '{}',
  joined_at timestamptz not null default now(),
  primary key (community_id, user_id)
);

create table if not exists public.social_community_events (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.social_communities(id) on delete cascade,
  creator_id uuid references auth.users(id) on delete set null,
  title text not null,
  description text not null default '',
  location_label text not null default 'Online · Papyrus Live',
  starts_at timestamptz not null,
  ends_at timestamptz,
  status text not null default 'scheduled' check (status in ('scheduled', 'live', 'completed', 'cancelled')),
  rsvp_user_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.social_communities enable row level security;
alter table public.social_community_members enable row level security;
alter table public.social_community_events enable row level security;

create or replace function public.has_community_access(p_community_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.social_communities c
    where c.id = p_community_id
      and not c.is_suspended
      and (
        c.visibility = 'public'
        or exists (
          select 1 from public.social_community_members m
          where m.community_id = c.id
            and m.user_id = p_user_id
            and m.role in ('owner', 'admin', 'moderator', 'member')
        )
      )
  );
$$;

drop policy if exists "read visible communities" on public.social_communities;
create policy "read visible communities"
  on public.social_communities for select
  using (visibility <> 'hidden' or public.has_community_access(id, auth.uid()));

drop policy if exists "authenticated create communities" on public.social_communities;
create policy "authenticated create communities"
  on public.social_communities for insert to authenticated
  with check (auth.uid() = owner_id);

drop policy if exists "owners and admins update communities" on public.social_communities;
create policy "owners and admins update communities"
  on public.social_communities for update to authenticated
  using (
    auth.uid() = owner_id or exists (
      select 1 from public.social_community_members m
      where m.community_id = id and m.user_id = auth.uid() and m.role in ('owner', 'admin')
    )
  );

drop policy if exists "read community memberships" on public.social_community_members;
create policy "read community memberships"
  on public.social_community_members for select
  using (public.has_community_access(community_id, auth.uid()) or auth.uid() = user_id);

drop policy if exists "join or manage community memberships" on public.social_community_members;
create policy "join or manage community memberships"
  on public.social_community_members for all to authenticated
  using (
    auth.uid() = user_id or exists (
      select 1 from public.social_community_members m
      where m.community_id = social_community_members.community_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin', 'moderator')
    )
  )
  with check (
    auth.uid() = user_id or exists (
      select 1 from public.social_community_members m
      where m.community_id = social_community_members.community_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin', 'moderator')
    )
  );

drop policy if exists "read community events" on public.social_community_events;
create policy "read community events"
  on public.social_community_events for select
  using (public.has_community_access(community_id, auth.uid()));

drop policy if exists "members create or update events" on public.social_community_events;
create policy "members create or update events"
  on public.social_community_events for all to authenticated
  using (public.has_community_access(community_id, auth.uid()))
  with check (public.has_community_access(community_id, auth.uid()));

-- =============================================================================
-- 3. Posts, Threads, Media, Video Covers, Ghost, Spoiler, Anon & Lifecycle
-- =============================================================================
create table if not exists public.social_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  community_id uuid references public.social_communities(id) on delete cascade,
  parent_post_id uuid references public.social_posts(id) on delete cascade,
  root_post_id uuid references public.social_posts(id) on delete cascade,
  repost_of_id uuid references public.social_posts(id) on delete set null,
  is_quote boolean not null default false,
  post_kind text not null default 'standard'
    check (post_kind in ('standard', 'thread', 'ghost', 'anonymous', 'debate', 'article', 'quiz_interactive')),
  content text not null default '',
  thread_parts jsonb not null default '[]'::jsonb,
  long_form_body text,
  media_items jsonb not null default '[]'::jsonb,
  is_spoiler boolean not null default false,
  spoiler_warning text not null default '',
  is_anonymous boolean not null default false,
  audience text not null default 'public'
    check (audience in ('public', 'followers', 'friends', 'close_friends', 'only_me', 'community', 'selected')),
  selected_audience_ids uuid[] not null default '{}',
  reply_permission text not null default 'everyone'
    check (reply_permission in ('everyone', 'followers', 'friends', 'mentioned', 'selected', 'nobody')),
  topics text[] not null default '{}',
  hashtags text[] not null default '{}',
  mentioned_user_ids uuid[] not null default '{}',
  location_label text,
  poll_id uuid,
  debate_config jsonb,
  ai_summary jsonb,
  is_pinned_profile boolean not null default false,
  is_pinned_community boolean not null default false,
  lifecycle_status text not null default 'published'
    check (lifecycle_status in ('draft', 'scheduled', 'published', 'archived', 'expired', 'removed', 'pending_approval')),
  scheduled_for timestamptz,
  expires_at timestamptz,
  impressions_count integer not null default 0,
  views_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists social_posts_feed_cursor_idx
  on public.social_posts (lifecycle_status, created_at desc, id desc);

create index if not exists social_posts_author_idx
  on public.social_posts (author_id, created_at desc);

create index if not exists social_posts_community_idx
  on public.social_posts (community_id, created_at desc)
  where community_id is not null;

create index if not exists social_posts_fts_idx
  on public.social_posts using gin (to_tsvector('simple', coalesce(content, '')));

create table if not exists public.social_post_versions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.social_posts(id) on delete cascade,
  editor_id uuid not null references auth.users(id) on delete cascade,
  previous_content text not null,
  previous_thread_parts jsonb not null default '[]'::jsonb,
  edited_at timestamptz not null default now()
);

create table if not exists public.social_post_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  draft_key text not null default 'primary',
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (user_id, draft_key)
);

alter table public.social_posts enable row level security;
alter table public.social_post_versions enable row level security;
alter table public.social_post_drafts enable row level security;

create or replace function public.can_view_social_post(p public.social_posts, viewer uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    case
      when viewer is not null and p.author_id = viewer then p.lifecycle_status <> 'removed'
      when p.lifecycle_status <> 'published' then false
      when p.expires_at is not null and p.expires_at <= now() then false
      when viewer is not null and public.are_users_blocked(p.author_id, viewer) then false
      when p.audience = 'public' and p.community_id is null then true
      when p.community_id is not null then public.has_community_access(p.community_id, viewer)
      when viewer is null then false
      when p.audience = 'only_me' then false
      when p.audience = 'selected' then viewer = any(p.selected_audience_ids)
      when p.audience = 'followers' then exists (
        select 1 from public.social_follows f
        where f.follower_id = viewer and f.following_id = p.author_id and f.status = 'accepted'
      )
      when p.audience = 'close_friends' then exists (
        select 1 from public.social_follows f
        where f.follower_id = viewer and f.following_id = p.author_id and f.is_close_friend
      )
      when p.audience = 'friends' then exists (
        select 1 from public.user_friends uf
        where uf.user_id = p.author_id and uf.friend_id = viewer
      ) or exists (
        select 1 from public.social_friend_requests fr
        where fr.status = 'accepted'
          and ((fr.sender_id = p.author_id and fr.receiver_id = viewer) or (fr.sender_id = viewer and fr.receiver_id = p.author_id))
      )
      else false
    end;
$$;

drop policy if exists "view authorized social posts" on public.social_posts;
create policy "view authorized social posts"
  on public.social_posts for select
  using (public.can_view_social_post(social_posts, auth.uid()));

drop policy if exists "authors insert own social posts" on public.social_posts;
create policy "authors insert own social posts"
  on public.social_posts for insert to authenticated
  with check (auth.uid() = author_id);

drop policy if exists "authors update own social posts" on public.social_posts;
create policy "authors update own social posts"
  on public.social_posts for update to authenticated
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

drop policy if exists "authors delete own social posts" on public.social_posts;
create policy "authors delete own social posts"
  on public.social_posts for delete to authenticated
  using (auth.uid() = author_id);

drop policy if exists "read authorized post edit history" on public.social_post_versions;
create policy "read authorized post edit history"
  on public.social_post_versions for select
  using (
    exists (
      select 1 from public.social_posts p
      where p.id = post_id and not p.is_anonymous and public.can_view_social_post(p, auth.uid())
    )
  );

drop policy if exists "authors insert post edit history" on public.social_post_versions;
create policy "authors insert post edit history"
  on public.social_post_versions for insert to authenticated
  with check (auth.uid() = editor_id);

drop policy if exists "users strictly own drafts" on public.social_post_drafts;
create policy "users strictly own drafts"
  on public.social_post_drafts for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Server-side Ghost Post expiration & Scheduled Post publisher
create or replace function public.process_social_post_schedules_and_expiry()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer := 0;
  c1 integer := 0;
  c2 integer := 0;
begin
  update public.social_posts
  set lifecycle_status = 'published', updated_at = now()
  where lifecycle_status = 'scheduled'
    and scheduled_for is not null
    and scheduled_for <= now();
  get diagnostics c1 = row_count;

  update public.social_posts
  set lifecycle_status = 'expired', updated_at = now()
  where lifecycle_status = 'published'
    and expires_at is not null
    and expires_at <= now();
  get diagnostics c2 = row_count;

  affected := c1 + c2;
  return affected;
end;
$$;

-- =============================================================================
-- 4. Engagement: Reactions, Threaded Comments, Bookmarks, Collections, Favourites
-- =============================================================================
create table if not exists public.social_reactions (
  target_type text not null check (target_type in ('post', 'comment', 'story', 'message')),
  target_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  reaction text not null check (reaction in ('like', 'love', 'haha', 'wow', 'sad', 'angry', 'fire', 'bulb', 'clap')),
  created_at timestamptz not null default now(),
  primary key (target_type, target_id, user_id)
);

create table if not exists public.social_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.social_posts(id) on delete cascade,
  parent_comment_id uuid references public.social_comments(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  content text not null default '',
  media_attachment jsonb,
  is_pinned boolean not null default false,
  is_edited boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists social_comments_post_idx
  on public.social_comments (post_id, created_at asc);

create table if not exists public.bookmark_collections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  cover_emoji text not null default '🔖',
  topic_filter text,
  is_smart boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.social_bookmarks (
  user_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid not null,
  collection_id uuid references public.bookmark_collections(id) on delete set null,
  ai_category text not null default 'Tổng hợp',
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create table if not exists public.social_favourites (
  user_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

alter table public.social_reactions enable row level security;
alter table public.social_comments enable row level security;
alter table public.bookmark_collections enable row level security;
alter table public.social_bookmarks enable row level security;
alter table public.social_favourites enable row level security;

drop policy if exists "read social reactions" on public.social_reactions;
create policy "read social reactions" on public.social_reactions for select using (true);

drop policy if exists "users manage own reactions" on public.social_reactions;
create policy "users manage own reactions"
  on public.social_reactions for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "read comments on visible posts" on public.social_comments;
create policy "read comments on visible posts"
  on public.social_comments for select
  using (
    exists (
      select 1 from public.social_posts p
      where p.id = post_id and public.can_view_social_post(p, auth.uid())
    )
  );

drop policy if exists "users manage own comments" on public.social_comments;
create policy "users manage own comments"
  on public.social_comments for all to authenticated
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

drop policy if exists "private bookmark collections" on public.bookmark_collections;
create policy "private bookmark collections"
  on public.bookmark_collections for all to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop policy if exists "strictly private bookmarks" on public.social_bookmarks;
create policy "strictly private bookmarks"
  on public.social_bookmarks for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "strictly private favourites" on public.social_favourites;
create policy "strictly private favourites"
  on public.social_favourites for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- =============================================================================
-- 5. Unified Zalo-Style Poll System (Post / Community / Group Chat / Live)
-- =============================================================================
create table if not exists public.unified_polls (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references auth.users(id) on delete set null,
  scope_type text not null default 'post' check (scope_type in ('post', 'community', 'chat', 'live')),
  question text not null,
  allow_multiple boolean not null default false,
  is_anonymous boolean not null default false,
  allow_add_options boolean not null default false,
  allow_change_vote boolean not null default true,
  is_closed boolean not null default false,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.unified_poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.unified_polls(id) on delete cascade,
  option_text text not null,
  added_by uuid references auth.users(id) on delete set null,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.unified_poll_votes (
  poll_id uuid not null references public.unified_polls(id) on delete cascade,
  option_id uuid not null references public.unified_poll_options(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (poll_id, option_id, user_id)
);

alter table public.unified_polls enable row level security;
alter table public.unified_poll_options enable row level security;
alter table public.unified_poll_votes enable row level security;

drop policy if exists "read polls" on public.unified_polls;
create policy "read polls" on public.unified_polls for select using (true);

drop policy if exists "create polls" on public.unified_polls;
create policy "create polls" on public.unified_polls for insert to authenticated with check (auth.uid() = creator_id);

drop policy if exists "creators close polls" on public.unified_polls;
create policy "creators close polls" on public.unified_polls for update to authenticated using (auth.uid() = creator_id);

drop policy if exists "read poll options" on public.unified_poll_options;
create policy "read poll options" on public.unified_poll_options for select using (true);

drop policy if exists "insert poll options" on public.unified_poll_options;
create policy "insert poll options" on public.unified_poll_options for insert to authenticated
  with check (
    exists (
      select 1 from public.unified_polls p
      where p.id = poll_id and not p.is_closed and (p.creator_id = auth.uid() or p.allow_add_options)
    )
  );

drop policy if exists "read non-anonymous or own votes" on public.unified_poll_votes;
create policy "read non-anonymous or own votes"
  on public.unified_poll_votes for select
  using (
    auth.uid() = user_id or exists (
      select 1 from public.unified_polls p where p.id = poll_id and not p.is_anonymous
    )
  );

create or replace function public.cast_unified_poll_vote(p_poll_id uuid, p_option_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  target_poll public.unified_polls%rowtype;
  oid uuid;
begin
  if uid is null then raise exception 'authentication_required' using errcode = '28000'; end if;
  select * into target_poll from public.unified_polls where id = p_poll_id for update;
  if target_poll.id is null then raise exception 'poll_not_found' using errcode = '22023'; end if;
  if target_poll.is_closed or (target_poll.expires_at is not null and target_poll.expires_at <= now()) then
    raise exception 'poll_closed' using errcode = '22023';
  end if;
  if not target_poll.allow_change_vote and exists (
    select 1 from public.unified_poll_votes v where v.poll_id = p_poll_id and v.user_id = uid
  ) then
    raise exception 'vote_locked' using errcode = '42501';
  end if;
  if not target_poll.allow_multiple and coalesce(array_length(p_option_ids, 1), 0) > 1 then
    raise exception 'single_choice_only' using errcode = '22023';
  end if;

  delete from public.unified_poll_votes where poll_id = p_poll_id and user_id = uid;
  if p_option_ids is not null then
    foreach oid in array p_option_ids loop
      insert into public.unified_poll_votes (poll_id, option_id, user_id)
      values (p_poll_id, oid, uid)
      on conflict do nothing;
    end loop;
  end if;

  return jsonb_build_object('ok', true, 'pollId', p_poll_id);
end;
$$;

grant execute on function public.cast_unified_poll_vote(uuid, uuid[]) to authenticated;

-- =============================================================================
-- 6. Dedicated Messaging & Communication Center (Module Realtime)
-- =============================================================================
create table if not exists public.chat_conversations (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'direct' check (kind in ('direct', 'group', 'live_room')),
  title text not null default '',
  avatar_url text,
  topic text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  pinned_message_id uuid,
  announcement text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chat_conversation_members (
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  request_state text not null default 'accepted' check (request_state in ('pending', 'accepted', 'archived')),
  is_pinned boolean not null default false,
  is_muted boolean not null default false,
  last_read_at timestamptz not null default now(),
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  content text not null default '',
  reply_to_id uuid references public.chat_messages(id) on delete set null,
  forwarded_from_id uuid references public.chat_messages(id) on delete set null,
  shared_post_id uuid,
  shared_post_snapshot jsonb,
  poll_id uuid references public.unified_polls(id) on delete set null,
  attachments jsonb not null default '[]'::jsonb,
  is_edited boolean not null default false,
  is_recalled boolean not null default false,
  delivery_status text not null default 'sent' check (delivery_status in ('sent', 'delivered', 'read')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists chat_messages_conv_idx
  on public.chat_messages (conversation_id, created_at desc);

alter table public.chat_conversations enable row level security;
alter table public.chat_conversation_members enable row level security;
alter table public.chat_messages enable row level security;

create or replace function public.is_conversation_member(p_conv_id uuid, p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.chat_conversations c
    where c.id = p_conv_id and c.kind = 'live_room'
  ) or exists (
    select 1 from public.chat_conversation_members m
    where m.conversation_id = p_conv_id and m.user_id = p_uid
  );
$$;

drop policy if exists "members read conversations" on public.chat_conversations;
create policy "members read conversations"
  on public.chat_conversations for select to authenticated
  using (public.is_conversation_member(id, auth.uid()) or created_by = auth.uid());

drop policy if exists "authenticated create conversations" on public.chat_conversations;
create policy "authenticated create conversations"
  on public.chat_conversations for insert to authenticated
  with check (auth.uid() = created_by);

drop policy if exists "members update conversations" on public.chat_conversations;
create policy "members update conversations"
  on public.chat_conversations for update to authenticated
  using (public.is_conversation_member(id, auth.uid()));

drop policy if exists "members read conversation roster" on public.chat_conversation_members;
create policy "members read conversation roster"
  on public.chat_conversation_members for select to authenticated
  using (public.is_conversation_member(conversation_id, auth.uid()) or user_id = auth.uid());

drop policy if exists "manage conversation membership" on public.chat_conversation_members;
create policy "manage conversation membership"
  on public.chat_conversation_members for all to authenticated
  using (user_id = auth.uid() or public.is_conversation_member(conversation_id, auth.uid()))
  with check (user_id = auth.uid() or public.is_conversation_member(conversation_id, auth.uid()));

drop policy if exists "members read chat messages" on public.chat_messages;
create policy "members read chat messages"
  on public.chat_messages for select to authenticated
  using (public.is_conversation_member(conversation_id, auth.uid()));

drop policy if exists "members send chat messages" on public.chat_messages;
create policy "members send chat messages"
  on public.chat_messages for insert to authenticated
  with check (auth.uid() = sender_id and public.is_conversation_member(conversation_id, auth.uid()));

drop policy if exists "senders edit or recall own messages" on public.chat_messages;
create policy "senders edit or recall own messages"
  on public.chat_messages for update to authenticated
  using (auth.uid() = sender_id)
  with check (auth.uid() = sender_id);

-- =============================================================================
-- 7. Custom Feeds, Your Algo, Moderation Workflow, Appeals & Admin Documents
-- =============================================================================
create table if not exists public.user_custom_feeds (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  included_topics text[] not null default '{}',
  included_author_ids uuid[] not null default '{}',
  included_community_ids uuid[] not null default '{}',
  is_pinned boolean not null default true,
  is_public boolean not null default false,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.user_algo_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  boosted_topics text[] not null default '{}',
  hidden_topics text[] not null default '{}',
  muted_keywords text[] not null default '{}',
  prioritized_account_ids uuid[] not null default '{}',
  not_interested_post_ids text[] not null default '{}',
  knowledge_mode boolean not null default false,
  active_mood text,
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.social_moderation_cases (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references auth.users(id) on delete set null,
  target_type text not null check (target_type in ('post', 'comment', 'user', 'story', 'message', 'community')),
  target_id text not null,
  target_owner_id uuid references auth.users(id) on delete set null,
  reason text not null,
  details text not null default '',
  workflow_status text not null default 'reported'
    check (workflow_status in ('reported', 'pending_review', 'under_review', 'approved', 'rejected', 'action_applied', 'appealed', 'resolved')),
  applied_action text
    check (applied_action is null or applied_action in ('warning', 'hide_content', 'remove_content', 'restrict_interaction', 'temp_suspension', 'community_ban', 'account_suspension', 'account_ban', 'restore_content')),
  appeal_reason text,
  appeal_decision text check (appeal_decision is null or appeal_decision in ('accepted', 'rejected')),
  reviewed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  cover_url text,
  category text not null default 'Đại cương',
  tags text[] not null default '{}',
  file_format text not null default 'markdown' check (file_format in ('pdf', 'doc', 'docx', 'markdown', 'txt')),
  storage_path text,
  rich_content text not null default '',
  status text not null default 'published' check (status in ('draft', 'scheduled', 'published', 'unpublished')),
  scheduled_publish_at timestamptz,
  allow_download boolean not null default true,
  expires_at timestamptz,
  download_count integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_document_gifts (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.admin_documents(id) on delete cascade,
  target_scope text not null default 'user' check (target_scope in ('user', 'selected_users', 'community', 'all_users')),
  recipient_user_id uuid references auth.users(id) on delete cascade,
  recipient_community_id uuid references public.social_communities(id) on delete cascade,
  note text not null default '',
  expires_at timestamptz,
  revoked boolean not null default false,
  downloaded_at timestamptz,
  gifted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  actor_label text not null default 'Admin',
  action_type text not null,
  target_type text not null,
  target_id text not null,
  reason text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.user_custom_feeds enable row level security;
alter table public.user_algo_preferences enable row level security;
alter table public.social_moderation_cases enable row level security;
alter table public.admin_documents enable row level security;
alter table public.admin_document_gifts enable row level security;
alter table public.admin_audit_logs enable row level security;

drop policy if exists "manage own custom feeds" on public.user_custom_feeds;
create policy "manage own custom feeds"
  on public.user_custom_feeds for all to authenticated
  using (auth.uid() = owner_id or is_public)
  with check (auth.uid() = owner_id);

drop policy if exists "manage own algo preferences" on public.user_algo_preferences;
create policy "manage own algo preferences"
  on public.user_algo_preferences for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "reporters or target owners view own moderation cases" on public.social_moderation_cases;
create policy "reporters or target owners view own moderation cases"
  on public.social_moderation_cases for select to authenticated
  using (auth.uid() = reporter_id or auth.uid() = target_owner_id);

drop policy if exists "authenticated submit moderation report" on public.social_moderation_cases;
create policy "authenticated submit moderation report"
  on public.social_moderation_cases for insert to authenticated
  with check (auth.uid() = reporter_id);

drop policy if exists "target owners submit appeal" on public.social_moderation_cases;
create policy "target owners submit appeal"
  on public.social_moderation_cases for update to authenticated
  using (auth.uid() = target_owner_id);

-- Strict Document Access Policy: Users can ONLY read documents explicitly gifted to them, their community, or all_users (and not expired/revoked!)
create or replace function public.can_access_admin_document(p_doc_id uuid, p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_documents d
    join public.admin_document_gifts g on g.document_id = d.id
    where d.id = p_doc_id
      and d.status = 'published'
      and (d.expires_at is null or d.expires_at > now())
      and not g.revoked
      and (g.expires_at is null or g.expires_at > now())
      and (
        g.target_scope = 'all_users'
        or (p_uid is not null and g.recipient_user_id = p_uid)
        or (
          p_uid is not null
          and g.recipient_community_id is not null
          and public.has_community_access(g.recipient_community_id, p_uid)
        )
      )
  );
$$;

drop policy if exists "authorized recipients read gifted documents" on public.admin_documents;
create policy "authorized recipients read gifted documents"
  on public.admin_documents for select to authenticated
  using (public.can_access_admin_document(id, auth.uid()) or auth.uid() = created_by);

drop policy if exists "recipients read own document gifts" on public.admin_document_gifts;
create policy "recipients read own document gifts"
  on public.admin_document_gifts for select to authenticated
  using (
    not revoked and (
      target_scope = 'all_users'
      or recipient_user_id = auth.uid()
      or (recipient_community_id is not null and public.has_community_access(recipient_community_id, auth.uid()))
    )
  );
