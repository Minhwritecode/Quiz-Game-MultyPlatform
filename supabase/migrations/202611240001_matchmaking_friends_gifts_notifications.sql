-- Migration: 202611240001_matchmaking_friends_gifts_notifications.sql
-- 1) Fix stale offline 1v1 ELO matchmaking tickets (25s active heartbeat TTL + consume ticket on match)
-- 2) Add SECURITY DEFINER search_players_for_friend RPC so real users are searchable despite strict profiles RLS
-- 3) Add admin_gifts & user_notifications tables + RPCs for Admin Gift Center & Notification Inbox

-- =============================================================================
-- 1. Fix 1v1 ELO Matchmaking Staleness (No Ghost / Offline Opponents)
-- =============================================================================
create or replace function public.enqueue_duel_matchmaking(
  p_category_id text,
  p_rated boolean default true,
  p_elo_rating integer default 1200,
  p_display_name text default 'Học giả',
  p_invite_code text default null,
  p_elo_band integer default 250
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  clean_name text := coalesce(nullif(trim(p_display_name), ''), 'Học giả');
  clean_invite text := nullif(upper(trim(coalesce(p_invite_code, ''))), '');
  clamped_elo integer := greatest(100, least(coalesce(p_elo_rating, 1200), 4000));
  band integer := greatest(50, least(coalesce(p_elo_band, 250), 1000));
  candidate public.duel_matchmaking_queue%rowtype;
begin
  if uid is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if p_category_id not in ('general', 'coding', 'math', 'science', 'history', 'english') then
    raise exception 'invalid_duel_category' using errcode = '22023';
  end if;

  -- Purge expired tickets older than 30 seconds so offline users never remain in queue
  delete from public.duel_matchmaking_queue
  where updated_at < now() - interval '30 seconds';

  -- Reset caller's own prior matched/stale ticket before searching
  delete from public.duel_matchmaking_queue where user_id = uid;

  -- Match ONLY actively searching online opponents refreshed within the last 25 seconds
  select * into candidate
  from public.duel_matchmaking_queue q
  where q.user_id <> uid
    and q.status = 'searching'
    and q.updated_at >= now() - interval '25 seconds'
    and (
      (clean_invite is not null and q.invite_code = clean_invite)
      or (
        clean_invite is null
        and q.invite_code is null
        and q.category_id = p_category_id
        and q.rated = coalesce(p_rated, true)
        and abs(q.elo_rating - clamped_elo) <= band
      )
    )
  order by abs(q.elo_rating - clamped_elo) asc, q.updated_at desc
  limit 1
  for update skip locked;

  if candidate.user_id is not null then
    update public.duel_matchmaking_queue
    set
      status = 'matched',
      matched_opponent_id = uid,
      matched_opponent_name = clean_name,
      matched_opponent_elo = clamped_elo,
      updated_at = now()
    where user_id = candidate.user_id;

    return jsonb_build_object(
      'status', 'matched',
      'isHuman', true,
      'categoryId', candidate.category_id,
      'opponentId', candidate.user_id,
      'opponentName', candidate.display_name,
      'opponentElo', candidate.elo_rating
    );
  end if;

  insert into public.duel_matchmaking_queue (
    user_id, display_name, category_id, elo_rating, rated, invite_code,
    status, matched_opponent_id, matched_opponent_name, matched_opponent_elo, updated_at
  )
  values (
    uid, clean_name, p_category_id, clamped_elo, coalesce(p_rated, true), clean_invite,
    'searching', null, null, null, now()
  );

  return jsonb_build_object(
    'status', 'searching',
    'isHuman', false,
    'categoryId', p_category_id,
    'inviteCode', clean_invite
  );
end;
$$;

create or replace function public.poll_duel_matchmaking(
  p_category_id text,
  p_elo_band integer default 500
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  my_ticket public.duel_matchmaking_queue%rowtype;
  result jsonb;
begin
  if uid is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  select * into my_ticket from public.duel_matchmaking_queue where user_id = uid for update;
  if my_ticket.user_id is null then
    return jsonb_build_object('status', 'idle', 'isHuman', false);
  end if;

  -- Discard stale tickets older than 30s
  if my_ticket.updated_at < now() - interval '30 seconds' then
    delete from public.duel_matchmaking_queue where user_id = uid;
    return jsonb_build_object('status', 'idle', 'isHuman', false);
  end if;

  -- If matched by another online player, consume (delete) ticket immediately so it can NEVER replay next match
  if my_ticket.status = 'matched' and my_ticket.matched_opponent_name is not null then
    result := jsonb_build_object(
      'status', 'matched',
      'isHuman', true,
      'categoryId', my_ticket.category_id,
      'opponentId', my_ticket.matched_opponent_id,
      'opponentName', my_ticket.matched_opponent_name,
      'opponentElo', coalesce(my_ticket.matched_opponent_elo, 1200)
    );
    delete from public.duel_matchmaking_queue where user_id = uid;
    return result;
  end if;

  -- Refresh heartbeat and search again with widened ELO band
  return public.enqueue_duel_matchmaking(
    coalesce(p_category_id, my_ticket.category_id),
    my_ticket.rated,
    my_ticket.elo_rating,
    my_ticket.display_name,
    my_ticket.invite_code,
    p_elo_band
  );
end;
$$;

-- =============================================================================
-- 2. SECURITY DEFINER Player Search RPC for Friend Discovery
-- =============================================================================
create or replace function public.search_players_for_friend(
  p_query text,
  p_limit integer default 15
)
returns table (
  user_id uuid,
  display_name text,
  avatar_url text,
  elo_rating integer,
  total_score integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  clean_q text := trim(coalesce(p_query, ''));
begin
  if uid is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if length(clean_q) < 2 then
    return;
  end if;

  return query
  select
    p.id as user_id,
    coalesce(nullif(trim(p.display_name), ''), 'Học giả Papyrus') as display_name,
    p.avatar_url,
    coalesce(p.elo_rating, 1200)::integer as elo_rating,
    coalesce(p.total_score, 0)::integer as total_score
  from public.profiles p
  where p.id <> uid
    and lower(coalesce(p.display_name, '')) like '%' || lower(clean_q) || '%'
  order by coalesce(p.total_score, 0) desc, coalesce(p.elo_rating, 1200) desc
  limit greatest(1, least(coalesce(p_limit, 15), 30));
end;
$$;

revoke all on function public.search_players_for_friend(text, integer) from public, anon;
grant execute on function public.search_players_for_friend(text, integer) to authenticated;

-- =============================================================================
-- 3. Admin Gifts & User Notifications Tables
-- =============================================================================
create table if not exists public.admin_gifts (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  recipient_name text not null default '',
  gift_type text not null check (gift_type in ('question_set', 'study_document', 'vip_days', 'streak_freeze')),
  title text not null,
  message text not null default '',
  payload jsonb not null default '{}'::jsonb,
  claimed boolean not null default false,
  created_by text not null default 'Papyrus Admin',
  created_at timestamptz not null default now()
);

create index if not exists admin_gifts_recipient_idx
  on public.admin_gifts (recipient_id, created_at desc);

alter table public.admin_gifts enable row level security;

drop policy if exists "users read own gifts" on public.admin_gifts;
create policy "users read own gifts"
  on public.admin_gifts for select to authenticated
  using (auth.uid() = recipient_id);

drop policy if exists "users claim own gifts" on public.admin_gifts;
create policy "users claim own gifts"
  on public.admin_gifts for update to authenticated
  using (auth.uid() = recipient_id)
  with check (auth.uid() = recipient_id);

create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  kind text not null default 'system' check (kind in ('system', 'gift', 'friend', 'duel', 'streak', 'update')),
  title text not null,
  body text not null,
  action_route text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists user_notifications_user_idx
  on public.user_notifications (user_id, created_at desc);

alter table public.user_notifications enable row level security;

drop policy if exists "users read own or broadcast notifications" on public.user_notifications;
create policy "users read own or broadcast notifications"
  on public.user_notifications for select to authenticated
  using (user_id is null or auth.uid() = user_id);

drop policy if exists "users mark own notifications read" on public.user_notifications;
create policy "users mark own notifications read"
  on public.user_notifications for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
