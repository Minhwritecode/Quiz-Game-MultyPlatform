-- Additive migration: Complete Supabase persistence for all latest Papyrus platform features:
-- 1) 6 pluggable question types + multiSelect + rating config + codeSnippet in questions & cloud sync RPCs
-- 2) Profile stats, streaks, VIP membership tier, per-category ELO & 1v1 Ranked/Unrated duel history
-- 3) Moderation queue UPDATE policy & review RPC on question_reports
-- 4) Live room reactions table + host controls (kick player, update read_time_sec & reactions_enabled)

-- =============================================================================
-- 1. Pluggable Question Types + Multi-Select on public.questions & Sync RPCs
-- =============================================================================
alter table public.questions
  add column if not exists question_type text not null default 'multiple_choice',
  add column if not exists multi_select boolean not null default false,
  add column if not exists correct_indices jsonb,
  add column if not exists rating_max smallint,
  add column if not exists rating_labels jsonb;

-- Safely replace rigid 4-option check constraints with question-type-aware constraints
do $$
declare
  c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.questions'::regclass
      and contype = 'c'
  loop
    execute format('alter table public.questions drop constraint if exists %I', c.conname);
  end loop;
end $$;

alter table public.questions
  add constraint questions_question_type_check
    check (question_type in ('multiple_choice', 'true_false', 'poll', 'word_cloud', 'rating', 'open_text')),
  add constraint questions_options_type_check
    check (
      jsonb_typeof(options) = 'array' and (
        (question_type = 'multiple_choice' and jsonb_array_length(options) = 4)
        or (question_type = 'true_false' and jsonb_array_length(options) = 2)
        or (question_type = 'poll' and jsonb_array_length(options) between 2 and 8)
        or (question_type in ('word_cloud', 'rating', 'open_text') and jsonb_array_length(options) >= 0)
      )
    ),
  add constraint questions_correct_index_type_check
    check (
      (question_type = 'multiple_choice' and correct_index between 0 and 3)
      or (question_type = 'true_false' and correct_index between 0 and 1)
      or (question_type in ('poll', 'word_cloud', 'rating', 'open_text') and correct_index >= 0)
    ),
  add constraint questions_rating_max_check
    check (rating_max is null or rating_max in (5, 10));

-- Upgrade private.set_document to emit all optional question metadata while staying 100% backward compatible
create or replace function private.set_document(target uuid) returns jsonb
language sql stable set search_path='' as $$
  select jsonb_build_object(
    'id', s.id,
    'title', s.title,
    'subject', s.subject,
    'revision', s.revision::text,
    'updatedAt', s.updated_at,
    'deleted', s.is_deleted,
    'questions', coalesce((
      select jsonb_agg(
        jsonb_strip_nulls(
          jsonb_build_object(
            'id', q.id,
            'content', q.content,
            'options', q.options,
            'correctIndex', q.correct_index,
            'explanation', q.explanation,
            'position', q.position,
            'questionType', case when q.question_type <> 'multiple_choice' then q.question_type else null end,
            'multiSelect', case when q.multi_select then true else null end,
            'correctIndices', q.correct_indices,
            'ratingMax', q.rating_max,
            'ratingLabels', q.rating_labels,
            'codeSnippet', nullif(q.code_snippet, '')
          )
        )
        order by q.position, q.id
      )
      from public.questions q
      where q.set_id = s.id and not q.is_deleted
    ), '[]'::jsonb)
  )
  from public.question_sets s
  where s.id = target;
$$;
revoke all on function private.set_document(uuid) from public, anon, authenticated;

-- Upgrade sync_push_set to validate and persist all 6 question types + codeSnippet + multiSelect
create or replace function public.sync_push_set(mutation_id uuid, base_revision text, document jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  uid uuid := auth.uid();
  sid uuid;
  s public.question_sets%rowtype;
  receipt private.sync_receipts%rowtype;
  req jsonb;
  result jsonb;
  q jsonb;
  deleted boolean;
  qid uuid;
  qtype text;
  opt_len integer;
  cidx integer;
  rmax smallint;
begin
  if uid is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if mutation_id is null or base_revision is null or base_revision !~ '^[0-9]+$' or document is null or octet_length(document::text)>500000 then
    raise exception 'invalid_sync_request' using errcode='22023';
  end if;
  sid := (document->>'id')::uuid;
  if sid is null then raise exception 'id_required' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text, 0));
  perform pg_advisory_xact_lock(hashtextextended(sid::text, 1));
  req := jsonb_build_object('base', base_revision, 'document', document);
  select * into receipt from private.sync_receipts r where r.owner_id = uid and r.mutation_id = sync_push_set.mutation_id;
  if found then
    if receipt.request <> req then raise exception 'mutation_reused' using errcode='22023'; end if;
    return receipt.result;
  end if;
  select * into s from public.question_sets where id = sid for update;
  if found and s.owner_id <> uid then raise exception 'not_owner' using errcode='42501'; end if;
  if coalesce(s.revision, 0)::text <> base_revision then
    return jsonb_build_object('conflict', true, 'document', private.set_document(sid));
  end if;
  deleted := coalesce((document->>'deleted')::boolean, false);
  if not deleted then
    if coalesce(length(trim(document->>'title')), 0) not between 1 and 200
      or jsonb_typeof(document->'questions') is distinct from 'array'
      or jsonb_array_length(document->'questions') not between 1 and 100 then
      raise exception 'invalid_set' using errcode='22023';
    end if;
    for q in select value from jsonb_array_elements(document->'questions') loop
      qid := (q->>'id')::uuid;
      qtype := coalesce(nullif(trim(q->>'questionType'), ''), 'multiple_choice');
      if qid is null or coalesce(length(trim(q->>'content')), 0) = 0
        or qtype not in ('multiple_choice', 'true_false', 'poll', 'word_cloud', 'rating', 'open_text')
        or jsonb_typeof(q->'options') is distinct from 'array' then
        raise exception 'invalid_question' using errcode='22023';
      end if;
      opt_len := jsonb_array_length(q->'options');
      cidx := coalesce((q->>'correctIndex')::integer, 0);
      if qtype = 'multiple_choice' then
        if opt_len <> 4 or cidx not between 0 and 3
          or exists(select 1 from jsonb_array_elements(q->'options') o where jsonb_typeof(o) <> 'string' or length(trim(o#>>'{}')) = 0)
          or (select count(distinct lower(trim(value))) from jsonb_array_elements_text(q->'options')) <> 4 then
          raise exception 'invalid_question' using errcode='22023';
        end if;
      elsif qtype = 'true_false' then
        if opt_len <> 2 or cidx not between 0 and 1
          or exists(select 1 from jsonb_array_elements(q->'options') o where jsonb_typeof(o) <> 'string' or length(trim(o#>>'{}')) = 0)
          or (select count(distinct lower(trim(value))) from jsonb_array_elements_text(q->'options')) <> 2 then
          raise exception 'invalid_question' using errcode='22023';
        end if;
      elsif qtype = 'poll' then
        if opt_len not between 2 and 8
          or exists(select 1 from jsonb_array_elements(q->'options') o where jsonb_typeof(o) <> 'string' or length(trim(o#>>'{}')) = 0)
          or (select count(distinct lower(trim(value))) from jsonb_array_elements_text(q->'options')) <> opt_len then
          raise exception 'invalid_question' using errcode='22023';
        end if;
      end if;
      if exists(select 1 from public.questions where id = qid and set_id <> sid) then
        raise exception 'question_not_owned' using errcode='42501';
      end if;
    end loop;
    if (select count(distinct value->>'id') from jsonb_array_elements(document->'questions')) <> jsonb_array_length(document->'questions') then
      raise exception 'duplicate_question_id' using errcode='22023';
    end if;
  end if;

  insert into public.question_sets(id, owner_id, title, subject, is_deleted, revision, updated_at)
  values(sid, uid, coalesce(document->>'title', 'Deleted'), coalesce(document->>'subject', ''), deleted, nextval('private.set_revision_seq'), clock_timestamp())
  on conflict(id) do update set
    title = excluded.title,
    subject = excluded.subject,
    is_deleted = excluded.is_deleted,
    revision = excluded.revision,
    updated_at = excluded.updated_at;

  if not deleted then
    update public.questions set is_deleted = true where set_id = sid;
    for q in select value from jsonb_array_elements(document->'questions') loop
      qtype := coalesce(nullif(trim(q->>'questionType'), ''), 'multiple_choice');
      rmax := case when (q->>'ratingMax') in ('5', '10') then (q->>'ratingMax')::smallint else null end;
      insert into public.questions(
        id, set_id, content, options, correct_index, explanation, position, is_deleted,
        question_type, multi_select, correct_indices, rating_max, rating_labels, code_snippet
      )
      values(
        (q->>'id')::uuid,
        sid,
        q->>'content',
        q->'options',
        greatest(0, coalesce((q->>'correctIndex')::smallint, 0)),
        coalesce(q->>'explanation', ''),
        coalesce((q->>'position')::integer, 0),
        false,
        qtype,
        coalesce((q->>'multiSelect')::boolean, false),
        case when jsonb_typeof(q->'correctIndices') = 'array' then q->'correctIndices' else null end,
        rmax,
        case when jsonb_typeof(q->'ratingLabels') = 'object' then q->'ratingLabels' else null end,
        nullif(q->>'codeSnippet', '')
      )
      on conflict(id) do update set
        content = excluded.content,
        options = excluded.options,
        correct_index = excluded.correct_index,
        explanation = excluded.explanation,
        position = excluded.position,
        is_deleted = false,
        question_type = excluded.question_type,
        multi_select = excluded.multi_select,
        correct_indices = excluded.correct_indices,
        rating_max = excluded.rating_max,
        rating_labels = excluded.rating_labels,
        code_snippet = excluded.code_snippet,
        updated_at = clock_timestamp()
      where public.questions.set_id = excluded.set_id;
      if not found then raise exception 'question_not_owned' using errcode='42501'; end if;
    end loop;
  end if;

  result := jsonb_build_object('conflict', false, 'document', private.set_document(sid));
  insert into private.sync_receipts values(uid, mutation_id, req, result);
  return result;
end $$;

revoke all on function public.sync_push_set(uuid, text, jsonb) from public, anon;
grant execute on function public.sync_push_set(uuid, text, jsonb) to authenticated;

-- =============================================================================
-- 2. Profile Stats, Streaks, Membership Tier, Category ELO & 1v1 Duel History
-- =============================================================================
alter table public.profiles
  add column if not exists elo_peak integer not null default 1200 check (elo_peak >= 100),
  add column if not exists games_played integer not null default 0 check (games_played >= 0),
  add column if not exists total_score bigint not null default 0 check (total_score >= 0),
  add column if not exists best_score integer not null default 0 check (best_score >= 0),
  add column if not exists wins integer not null default 0 check (wins >= 0),
  add column if not exists membership_tier text not null default 'apprentice' check (membership_tier in ('apprentice', 'archmage')),
  add column if not exists current_streak integer not null default 0 check (current_streak >= 0),
  add column if not exists longest_streak integer not null default 0 check (longest_streak >= 0),
  add column if not exists streak_freeze_count integer not null default 1 check (streak_freeze_count between 0 and 10),
  add column if not exists last_active_date date;

create table if not exists public.category_elos (
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id text not null check (category_id in ('general', 'coding', 'math', 'science', 'history', 'english')),
  elo_rating integer not null default 1200 check (elo_rating >= 100),
  elo_peak integer not null default 1200 check (elo_peak >= 100),
  matches_played integer not null default 0 check (matches_played >= 0),
  wins integer not null default 0 check (wins >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, category_id)
);

create table if not exists public.duel_matches (
  id uuid primary key default gen_random_uuid(),
  category_id text not null check (category_id in ('general', 'coding', 'math', 'science', 'history', 'english')),
  rated boolean not null default true,
  invite_code text,
  challenger_id uuid not null references auth.users(id) on delete cascade,
  opponent_id uuid references auth.users(id) on delete set null,
  opponent_name text not null default 'Đối thủ',
  opponent_elo integer not null default 1200,
  challenger_score integer not null default 0,
  opponent_score integer not null default 0,
  outcome numeric(3,2) not null check (outcome in (0, 0.5, 1)),
  elo_delta integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists duel_matches_challenger_idx
  on public.duel_matches (challenger_id, created_at desc);

create index if not exists duel_matches_invite_idx
  on public.duel_matches (invite_code)
  where invite_code is not null;

alter table public.category_elos enable row level security;
alter table public.duel_matches enable row level security;

drop policy if exists "category elos are readable" on public.category_elos;
create policy "category elos are readable"
  on public.category_elos for select using (true);

drop policy if exists "users read own duel matches" on public.duel_matches;
create policy "users read own duel matches"
  on public.duel_matches for select to authenticated
  using (auth.uid() = challenger_id or auth.uid() = opponent_id);

revoke insert, update, delete on public.category_elos, public.duel_matches from anon, authenticated;

create or replace function public.record_duel_result(
  p_category_id text,
  p_rated boolean,
  p_opponent_name text,
  p_opponent_elo integer,
  p_challenger_score integer,
  p_opponent_score integer,
  p_outcome numeric,
  p_elo_delta integer,
  p_next_elo integer,
  p_invite_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  clamped_elo integer := greatest(100, least(coalesce(p_next_elo, 1200), 4000));
  clamped_delta integer := greatest(-120, least(coalesce(p_elo_delta, 0), 120));
  match_id uuid;
  is_win integer := case when p_outcome = 1 then 1 else 0 end;
begin
  if uid is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if p_category_id not in ('general', 'coding', 'math', 'science', 'history', 'english') then
    raise exception 'invalid_duel_category' using errcode = '22023';
  end if;
  if p_outcome not in (0, 0.5, 1) then
    raise exception 'invalid_duel_outcome' using errcode = '22023';
  end if;

  insert into public.profiles (id)
  values (uid)
  on conflict (id) do nothing;

  insert into public.duel_matches (
    category_id, rated, invite_code, challenger_id, opponent_name,
    opponent_elo, challenger_score, opponent_score, outcome, elo_delta
  )
  values (
    p_category_id, coalesce(p_rated, true), nullif(trim(coalesce(p_invite_code, '')), ''),
    uid, coalesce(nullif(trim(p_opponent_name), ''), 'Đối thủ'),
    greatest(100, coalesce(p_opponent_elo, 1200)),
    greatest(0, coalesce(p_challenger_score, 0)),
    greatest(0, coalesce(p_opponent_score, 0)),
    p_outcome,
    case when coalesce(p_rated, true) then clamped_delta else 0 end
  )
  returning id into match_id;

  if coalesce(p_rated, true) then
    insert into public.category_elos (user_id, category_id, elo_rating, elo_peak, matches_played, wins, updated_at)
    values (uid, p_category_id, clamped_elo, clamped_elo, 1, is_win, now())
    on conflict (user_id, category_id) do update set
      elo_rating = excluded.elo_rating,
      elo_peak = greatest(public.category_elos.elo_peak, excluded.elo_rating),
      matches_played = public.category_elos.matches_played + 1,
      wins = public.category_elos.wins + is_win,
      updated_at = now();
  end if;

  update public.profiles
  set
    elo_rating = case when coalesce(p_rated, true) then clamped_elo else elo_rating end,
    elo_peak = case when coalesce(p_rated, true) then greatest(elo_peak, clamped_elo) else elo_peak end,
    games_played = games_played + 1,
    total_score = total_score + greatest(0, coalesce(p_challenger_score, 0)),
    best_score = greatest(best_score, greatest(0, coalesce(p_challenger_score, 0))),
    wins = wins + is_win
  where id = uid;

  return jsonb_build_object(
    'matchId', match_id,
    'categoryId', p_category_id,
    'eloRating', clamped_elo,
    'rated', coalesce(p_rated, true)
  );
end;
$$;

create or replace function public.sync_user_progress(
  p_current_streak integer,
  p_longest_streak integer,
  p_streak_freeze_count integer,
  p_last_active_date date default null,
  p_membership_tier text default null,
  p_games_played integer default null,
  p_total_score bigint default null,
  p_best_score integer default null,
  p_wins integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  updated_profile public.profiles%rowtype;
begin
  if uid is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  insert into public.profiles (id)
  values (uid)
  on conflict (id) do nothing;

  update public.profiles
  set
    current_streak = greatest(0, coalesce(p_current_streak, current_streak)),
    longest_streak = greatest(longest_streak, greatest(0, coalesce(p_longest_streak, longest_streak))),
    streak_freeze_count = greatest(0, least(10, coalesce(p_streak_freeze_count, streak_freeze_count))),
    last_active_date = coalesce(p_last_active_date, last_active_date),
    membership_tier = case
      when p_membership_tier in ('apprentice', 'archmage') then p_membership_tier
      else membership_tier
    end,
    games_played = greatest(games_played, greatest(0, coalesce(p_games_played, games_played))),
    total_score = greatest(total_score, greatest(0, coalesce(p_total_score, total_score))),
    best_score = greatest(best_score, greatest(0, coalesce(p_best_score, best_score))),
    wins = greatest(wins, greatest(0, coalesce(p_wins, wins)))
  where id = uid
  returning * into updated_profile;

  return jsonb_build_object(
    'eloRating', updated_profile.elo_rating,
    'eloPeak', updated_profile.elo_peak,
    'currentStreak', updated_profile.current_streak,
    'longestStreak', updated_profile.longest_streak,
    'streakFreezeCount', updated_profile.streak_freeze_count,
    'membershipTier', updated_profile.membership_tier
  );
end;
$$;

revoke all on function public.record_duel_result(text, boolean, text, integer, integer, integer, numeric, integer, integer, text) from public, anon;
revoke all on function public.sync_user_progress(integer, integer, integer, date, text, integer, bigint, integer, integer) from public, anon;

grant execute on function public.record_duel_result(text, boolean, text, integer, integer, integer, numeric, integer, integer, text),
  public.sync_user_progress(integer, integer, integer, date, text, integer, bigint, integer, integer) to authenticated;

-- =============================================================================
-- 3. Moderation Queue UPDATE Policy & Review RPC on public.question_reports
-- =============================================================================
alter table public.question_reports
  add column if not exists moderator_note text not null default '',
  add column if not exists updated_at timestamptz not null default now();

drop policy if exists "users update own question reports" on public.question_reports;
create policy "users update own question reports"
  on public.question_reports
  for update to authenticated
  using (auth.uid() = reporter_id)
  with check (auth.uid() = reporter_id);

create or replace function public.review_question_report(
  p_report_id uuid,
  p_status text,
  p_note text default ''
)
returns public.question_reports
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  updated_row public.question_reports%rowtype;
begin
  if uid is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if p_status not in ('open', 'reviewed', 'dismissed') then
    raise exception 'invalid_report_status' using errcode = '22023';
  end if;

  update public.question_reports
  set
    status = p_status,
    moderator_note = coalesce(p_note, moderator_note),
    updated_at = now()
  where id = p_report_id
    and reporter_id = uid
  returning * into updated_row;

  if updated_row.id is null then
    raise exception 'report_not_found' using errcode = 'P0002';
  end if;

  return updated_row;
end;
$$;

revoke all on function public.review_question_report(uuid, text, text) from public, anon;
grant execute on function public.review_question_report(uuid, text, text) to authenticated;

-- =============================================================================
-- 4. Live Room Reactions & Host Controls (kick player + room settings)
-- =============================================================================
create table if not exists public.room_reactions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null check (length(trim(emoji)) between 1 and 16),
  created_at timestamptz not null default now()
);

create index if not exists room_reactions_room_idx
  on public.room_reactions (room_id, created_at desc);

alter table public.room_reactions enable row level security;

drop policy if exists "members read room reactions" on public.room_reactions;
create policy "members read room reactions"
  on public.room_reactions for select to authenticated
  using (
    exists (
      select 1 from public.room_players rp
      where rp.room_id = room_id and rp.user_id = auth.uid()
    )
  );

revoke insert, update, delete on public.room_reactions from anon, authenticated;

create or replace function public.send_room_reaction(
  p_room_id uuid,
  p_emoji text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  target_room public.rooms%rowtype;
  reaction_id uuid;
begin
  if uid is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  select * into target_room from public.rooms where id = p_room_id;
  if target_room.id is null then
    raise exception 'room_not_found' using errcode = 'P0002';
  end if;
  if not coalesce(target_room.reactions_enabled, true) then
    raise exception 'reactions_disabled' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.room_players where room_id = p_room_id and user_id = uid
  ) then
    raise exception 'not_room_member' using errcode = '42501';
  end if;

  insert into public.room_reactions (room_id, user_id, emoji)
  values (p_room_id, uid, left(trim(p_emoji), 16))
  returning id into reaction_id;

  return reaction_id;
end;
$$;

create or replace function public.update_room_settings(
  p_room_id uuid,
  p_read_time_sec integer default null,
  p_reactions_enabled boolean default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  updated_room public.rooms%rowtype;
begin
  if uid is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  update public.rooms
  set
    read_time_sec = coalesce(greatest(0, least(p_read_time_sec, 15)), read_time_sec),
    reactions_enabled = coalesce(p_reactions_enabled, reactions_enabled)
  where id = p_room_id and host_id = uid
  returning * into updated_room;

  if updated_room.id is null then
    raise exception 'host_only_action' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'roomId', updated_room.id,
    'readTimeSec', updated_room.read_time_sec,
    'reactionsEnabled', updated_room.reactions_enabled
  );
end;
$$;

create or replace function public.kick_room_player(
  p_room_id uuid,
  p_target_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  target_room public.rooms%rowtype;
begin
  if uid is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if p_target_user_id = uid then
    raise exception 'cannot_kick_host' using errcode = '22023';
  end if;

  select * into target_room from public.rooms where id = p_room_id;
  if target_room.id is null or target_room.host_id <> uid then
    raise exception 'host_only_action' using errcode = '42501';
  end if;

  delete from public.room_players
  where room_id = p_room_id and user_id = p_target_user_id;

  return found;
end;
$$;

revoke all on function public.send_room_reaction(uuid, text) from public, anon;
revoke all on function public.update_room_settings(uuid, integer, boolean) from public, anon;
revoke all on function public.kick_room_player(uuid, uuid) from public, anon;

grant execute on function public.send_room_reaction(uuid, text),
  public.update_room_settings(uuid, integer, boolean),
  public.kick_room_player(uuid, uuid) to authenticated;
