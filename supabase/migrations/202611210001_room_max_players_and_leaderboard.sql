-- Additive migration: configurable max_players (2-10), optional code_snippet on questions,
-- and real backend leaderboard aggregation RPC (get_leaderboard_players).

alter table public.rooms
  add column if not exists max_players integer not null default 4
  check (max_players between 2 and 10);

alter table public.questions
  add column if not exists code_snippet text;

-- Update create_room to support optional p_max_players (backward-compatible default = 4)
create or replace function public.create_room(
  p_set_id uuid,
  p_question_count integer default 10,
  p_seconds_per_question integer default 15,
  p_mode text default 'speed',
  p_max_players integer default 4
)
returns table (
  id uuid,
  code text,
  host_id uuid,
  set_id uuid,
  mode text,
  status text,
  question_count integer,
  seconds_per_question integer,
  max_players integer,
  started_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  new_room public.rooms%rowtype;
  candidate_code text;
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if p_question_count < 1 or p_question_count > 50 then
    raise exception 'invalid_question_count' using errcode = '22023';
  end if;
  if p_seconds_per_question < 5 or p_seconds_per_question > 120 then
    raise exception 'invalid_question_window' using errcode = '22023';
  end if;
  if p_mode not in ('speed', 'survival') then
    raise exception 'invalid_room_mode' using errcode = '22023';
  end if;
  if p_max_players < 2 or p_max_players > 10 then
    raise exception 'invalid_max_players' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.question_sets
    where public.question_sets.id = p_set_id
      and public.question_sets.owner_id = current_user_id
      and public.question_sets.is_deleted = false
  ) then
    raise exception 'question_set_not_owned' using errcode = '42501';
  end if;

  for attempt in 1..5 loop
    candidate_code := upper(substr(replace(pg_catalog.gen_random_uuid()::text, '-', ''), 1, 6));
    begin
      insert into public.rooms(code, host_id, set_id, mode, question_count, seconds_per_question, max_players)
      values (candidate_code, current_user_id, p_set_id, p_mode, p_question_count, p_seconds_per_question, p_max_players)
      returning * into new_room;
      exit;
    exception when unique_violation then
      if attempt = 5 then raise; end if;
    end;
  end loop;

  insert into public.room_players(room_id, user_id)
  values (new_room.id, current_user_id);

  return query select new_room.id, new_room.code, new_room.host_id, new_room.set_id,
    new_room.mode, new_room.status, new_room.question_count,
    new_room.seconds_per_question, new_room.max_players, new_room.started_at, new_room.created_at;
end;
$$;

-- Update join_room to respect room.max_players instead of hardcoded 4
create or replace function public.join_room(p_code text)
returns table (
  id uuid,
  code text,
  host_id uuid,
  set_id uuid,
  mode text,
  status text,
  question_count integer,
  seconds_per_question integer,
  max_players integer,
  started_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  target_room public.rooms%rowtype;
  player_count integer;
  normalized_code text := upper(trim(p_code));
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if normalized_code !~ '^[A-Z0-9]{6}$' then
    raise exception 'invalid_room_code' using errcode = '22023';
  end if;

  select * into target_room from public.rooms
  where public.rooms.code = normalized_code
  for update;
  if target_room.id is null then
    raise exception 'room_not_found' using errcode = 'P0002';
  end if;
  if target_room.status <> 'waiting' then
    raise exception 'room_not_joinable' using errcode = '55000';
  end if;

  if exists (select 1 from public.room_players where room_id = target_room.id and user_id = current_user_id) then
    return query select target_room.id, target_room.code, target_room.host_id, target_room.set_id,
      target_room.mode, target_room.status, target_room.question_count,
      target_room.seconds_per_question, target_room.max_players, target_room.started_at, target_room.created_at;
    return;
  end if;

  select count(*)::integer into player_count from public.room_players where room_id = target_room.id;
  if player_count >= coalesce(target_room.max_players, 4) then
    raise exception 'room_full' using errcode = '54000';
  end if;

  insert into public.room_players(room_id, user_id)
  values (target_room.id, current_user_id);

  return query select target_room.id, target_room.code, target_room.host_id, target_room.set_id,
    target_room.mode, target_room.status, target_room.question_count,
    target_room.seconds_per_question, target_room.max_players, target_room.started_at, target_room.created_at;
end;
$$;

-- Real global leaderboard aggregation RPC with timeframe & topic filtering + pagination
create or replace function public.get_leaderboard_players(
  p_timeframe text default 'all',
  p_topic text default 'all',
  p_limit integer default 10,
  p_offset integer default 0
)
returns table (
  user_id uuid,
  display_name text,
  avatar_url text,
  total_score bigint,
  games_played bigint,
  rank bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  cutoff timestamptz;
begin
  if p_timeframe = 'week' then
    cutoff := now() - interval '7 days';
  elsif p_timeframe = 'month' then
    cutoff := now() - interval '30 days';
  else
    cutoff := to_timestamp(0);
  end if;

  return query
  with room_scores as (
    select
      rp.user_id,
      sum(rp.score)::bigint as pts,
      count(distinct rp.room_id)::bigint as matches
    from public.room_players rp
    join public.rooms r on r.id = rp.room_id
    left join public.question_sets qs on qs.id = r.set_id
    where r.created_at >= cutoff
      and (p_topic = 'all' or lower(coalesce(qs.subject, '')) like '%' || lower(p_topic) || '%')
    group by rp.user_id
  ),
  attempt_scores as (
    select
      a.user_id,
      sum(a.score * 100)::bigint as pts,
      count(*)::bigint as matches
    from public.attempts a
    left join public.question_sets qs on qs.id = a.set_id
    where a.started_at >= cutoff
      and (p_topic = 'all' or lower(coalesce(qs.subject, '')) like '%' || lower(p_topic) || '%')
    group by a.user_id
  ),
  combined as (
    select
      p.id as user_id,
      p.display_name,
      p.avatar_url,
      (coalesce(rs.pts, 0) + coalesce(as2.pts, 0))::bigint as total_score,
      (coalesce(rs.matches, 0) + coalesce(as2.matches, 0))::bigint as games_played
    from public.profiles p
    left join room_scores rs on rs.user_id = p.id
    left join attempt_scores as2 on as2.user_id = p.id
    where (coalesce(rs.pts, 0) + coalesce(as2.pts, 0)) > 0
  ),
  ranked as (
    select
      c.user_id,
      c.display_name,
      c.avatar_url,
      c.total_score,
      c.games_played,
      dense_rank() over (order by c.total_score desc, c.games_played desc) as rank
    from combined c
  )
  select r.user_id, r.display_name, r.avatar_url, r.total_score, r.games_played, r.rank
  from ranked r
  order by r.rank asc, r.display_name asc
  limit greatest(1, least(p_limit, 50))
  offset greatest(0, p_offset);
end;
$$;
