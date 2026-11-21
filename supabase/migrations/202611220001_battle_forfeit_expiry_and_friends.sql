-- Additive migration: Group F (Strict 30s seat-hold -> auto-forfeit, 30-minute idle room expiry,
-- early question advance when all active players answer, clean termination with no eligible host,
-- per-user battle history RPC) & Group G (Friends graph + Friends Leaderboard RPC).

-- =============================================================================
-- 1. Strict 30s Disconnect Seat-Hold & Auto-Forfeit on public.room_players
-- =============================================================================
alter table public.room_players
  add column if not exists forfeited boolean not null default false,
  add column if not exists disconnected_at timestamptz;

create or replace function public.battle_heartbeat(target uuid, p_ready boolean default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  is_forfeited boolean;
begin
  if not private.is_room_member(target) then
    raise exception 'membership_required' using errcode = '42501';
  end if;

  select rp.forfeited into is_forfeited
  from public.room_players rp
  join public.rooms r on r.id = rp.room_id
  where rp.room_id = target
    and rp.user_id = auth.uid()
    and r.started_at is not null;

  if coalesce(is_forfeited, false) then
    raise exception 'seat_forfeited' using errcode = '55000';
  end if;

  update public.room_players
  set
    last_seen_at = clock_timestamp(),
    connected = true,
    disconnected_at = null,
    ready = coalesce(p_ready, ready)
  where room_id = target and user_id = auth.uid();
end;
$$;

-- Upgrade join_room to enforce 30-minute idle room/code expiration
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

  -- Expire idle waiting rooms after 30 minutes
  if target_room.status = 'waiting' and target_room.created_at < now() - interval '30 minutes' then
    update public.rooms set status = 'finished' where public.rooms.id = target_room.id;
    raise exception 'room_expired' using errcode = '55000';
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

-- Upgrade battle_snapshot:
-- 1) Auto-expires idle waiting rooms > 30 minutes
-- 2) Marks players offline > 30s during active games as forfeited
-- 3) Transfers host or cleanly finishes room when zero eligible hosts remain
-- 4) Early-closes current question when all active non-forfeited players have answered
create or replace function public.battle_snapshot(target uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.rooms%rowtype;
  q public.room_questions%rowtype;
  phase text;
  roster jsonb;
  t timestamptz := clock_timestamp();
  next_host uuid;
  question jsonb;
  active_count integer := 0;
  answered_count integer := 0;
begin
  if not private.is_room_member(target) then
    raise exception 'membership_required' using errcode = '42501';
  end if;

  select * into r from public.rooms where id = target for update;

  -- Expire idle waiting rooms after 30 minutes
  if r.status = 'waiting' and r.created_at < t - interval '30 minutes' then
    update public.rooms set status = 'finished' where id = target;
    r.status := 'finished';
  end if;

  -- Enforce 30-second disconnect seat-hold -> auto-forfeit during active matches
  if r.started_at is not null and r.status <> 'finished' then
    update public.room_players
    set
      connected = false,
      forfeited = true,
      disconnected_at = coalesce(disconnected_at, last_seen_at)
    where room_id = target
      and not forfeited
      and last_seen_at < t - interval '30 seconds';
  end if;

  -- Host failover or terminate room when no active eligible host remains
  if r.status <> 'finished' and not exists (
    select 1 from public.room_players
    where room_id = target
      and user_id = r.host_id
      and not forfeited
      and last_seen_at >= t - interval '30 seconds'
  ) then
    select user_id into next_host
    from public.room_players
    where room_id = target
      and not forfeited
      and last_seen_at >= t - interval '30 seconds'
    order by joined_at, user_id
    limit 1;

    if next_host is not null then
      update public.rooms set host_id = next_host where id = target;
      r.host_id := next_host;
    elsif r.started_at is not null then
      update public.rooms set status = 'finished' where id = target;
      r.status := 'finished';
    end if;
  end if;

  phase := r.status;

  if r.started_at is not null and phase <> 'finished' then
    select * into q from public.room_questions
    where room_id = target and opens_at <= t
    order by position desc
    limit 1;

    -- Early reveal/advance when every active non-forfeited player has already answered
    if q.room_id is not null and t < q.closes_at then
      select count(*)::integer into active_count
      from public.room_players
      where room_id = target
        and not forfeited
        and last_seen_at >= t - interval '30 seconds';

      if active_count > 0 then
        select count(distinct ra.user_id)::integer into answered_count
        from public.room_answers ra
        join public.room_players rp
          on rp.room_id = ra.room_id and rp.user_id = ra.user_id
        where ra.room_id = target
          and ra.position = q.position
          and not rp.forfeited
          and rp.last_seen_at >= t - interval '30 seconds';

        if answered_count >= active_count then
          update public.room_questions
          set closes_at = least(closes_at, t)
          where room_id = target and position = q.position
          returning * into q;
        end if;
      end if;
    end if;

    phase := case
      when t < r.started_at then 'countdown'
      when q.position = r.question_count - 1 and t >= q.closes_at + interval '3 seconds' then 'finished'
      when t < q.closes_at then 'question_open'
      else 'question_result'
    end;

    if phase <> r.status then
      update public.rooms set status = phase where id = target;
    end if;

    if q.room_id is not null then
      question := jsonb_build_object(
        'position', q.position,
        'closesAt', q.closes_at,
        'content', q.question_snapshot->'content',
        'options', q.question_snapshot->'options'
      );
      if t >= q.closes_at then
        question := question || jsonb_build_object(
          'correctIndex', q.question_snapshot->'correct_index',
          'explanation', q.question_snapshot->'explanation'
        );
      end if;
    end if;
  end if;

  select jsonb_agg(
    jsonb_build_object(
      'userId', p.user_id,
      'name', coalesce(pr.display_name, 'Learner'),
      'score', p.score,
      'ready', p.ready,
      'connected', (not p.forfeited and p.last_seen_at >= t - interval '30 seconds'),
      'forfeited', p.forfeited,
      'connectionState', case
        when p.forfeited then 'forfeited'
        when p.last_seen_at < t - interval '15 seconds' then 'reconnecting'
        else 'connected'
      end
    )
    order by p.score desc, p.joined_at, p.user_id
  )
  into roster
  from public.room_players p
  left join public.profiles pr on pr.id = p.user_id
  where p.room_id = target;

  return jsonb_build_object(
    'id', r.id,
    'code', r.code,
    'hostId', r.host_id,
    'phase', phase,
    'serverTime', t,
    'players', roster,
    'question', question,
    'answered', exists(
      select 1 from public.room_answers
      where room_id = target and user_id = auth.uid() and position = q.position
    )
  );
end;
$$;

-- =============================================================================
-- 2. Per-User Battle Match History RPC (Rooms + 1v1 Duels)
-- =============================================================================
create or replace function public.get_my_battle_history(
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  match_id text,
  kind text,
  label text,
  my_score integer,
  opponent_or_players text,
  outcome text,
  elo_delta integer,
  played_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  lim integer := greatest(1, least(coalesce(p_limit, 20), 50));
  off integer := greatest(0, coalesce(p_offset, 0));
begin
  if uid is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  return query
  with combined as (
    select
      'room-' || r.id::text as match_id,
      'room'::text as kind,
      'Phòng #' || r.code as label,
      rp.score::integer as my_score,
      ((select count(*) from public.room_players p2 where p2.room_id = r.id)::text || ' người chơi') as opponent_or_players,
      case
        when rp.forfeited then 'forfeit'
        when rp.score >= coalesce((select max(p3.score) from public.room_players p3 where p3.room_id = r.id), 0) and rp.score > 0 then 'win'
        else 'loss'
      end as outcome,
      0::integer as elo_delta,
      coalesce(r.started_at, r.created_at) as played_at
    from public.room_players rp
    join public.rooms r on r.id = rp.room_id
    where rp.user_id = uid and r.status = 'finished'

    union all

    select
      'duel-' || dm.id::text as match_id,
      case when dm.rated then 'ranked_1v1' else 'friendly_1v1' end as kind,
      '1v1 · ' || upper(dm.category_id) as label,
      dm.challenger_score::integer as my_score,
      dm.opponent_name as opponent_or_players,
      case when dm.outcome = 1 then 'win' when dm.outcome = 0.5 then 'draw' else 'loss' end as outcome,
      dm.elo_delta::integer as elo_delta,
      dm.created_at as played_at
    from public.duel_matches dm
    where dm.challenger_id = uid
  )
  select c.match_id, c.kind, c.label, c.my_score, c.opponent_or_players, c.outcome, c.elo_delta, c.played_at
  from combined c
  order by c.played_at desc
  limit lim offset off;
end;
$$;

-- =============================================================================
-- 3. Group G — Friends Graph & Friends Leaderboard RPC
-- =============================================================================
create table if not exists public.user_friends (
  user_id uuid not null references auth.users(id) on delete cascade,
  friend_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'accepted' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);

alter table public.user_friends enable row level security;

drop policy if exists "users manage own friendships" on public.user_friends;
create policy "users manage own friendships"
  on public.user_friends for all to authenticated
  using (auth.uid() = user_id or auth.uid() = friend_id)
  with check (auth.uid() = user_id);

create or replace function public.add_friend_by_id(p_friend_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if p_friend_id is null or p_friend_id = uid then
    raise exception 'invalid_friend_id' using errcode = '22023';
  end if;

  insert into public.user_friends (user_id, friend_id, status)
  values (uid, p_friend_id, 'accepted'), (p_friend_id, uid, 'accepted')
  on conflict (user_id, friend_id) do update set status = 'accepted';

  return true;
end;
$$;

create or replace function public.get_friends_leaderboard(
  p_timeframe text default 'all',
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  user_id uuid,
  display_name text,
  avatar_url text,
  total_score bigint,
  games_played bigint,
  elo_rating integer,
  rank bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cutoff timestamptz;
begin
  if uid is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  if p_timeframe = 'week' then
    cutoff := now() - interval '7 days';
  elsif p_timeframe = 'month' then
    cutoff := now() - interval '30 days';
  else
    cutoff := to_timestamp(0);
  end if;

  return query
  with circle as (
    select uid as member_id
    union
    select uf.friend_id as member_id
    from public.user_friends uf
    where uf.user_id = uid and uf.status = 'accepted'
  ),
  room_scores as (
    select rp.user_id, sum(rp.score)::bigint as pts, count(distinct rp.room_id)::bigint as matches
    from public.room_players rp
    join public.rooms r on r.id = rp.room_id
    where r.created_at >= cutoff and rp.user_id in (select member_id from circle)
    group by rp.user_id
  ),
  duel_scores as (
    select dm.challenger_id as user_id, sum(dm.challenger_score)::bigint as pts, count(*)::bigint as matches
    from public.duel_matches dm
    where dm.created_at >= cutoff and dm.challenger_id in (select member_id from circle)
    group by dm.challenger_id
  ),
  combined as (
    select
      p.id as user_id,
      coalesce(p.display_name, 'Học giả Papyrus') as display_name,
      p.avatar_url,
      greatest(p.total_score, coalesce(rs.pts, 0) + coalesce(ds.pts, 0))::bigint as total_score,
      greatest(p.games_played::bigint, coalesce(rs.matches, 0) + coalesce(ds.matches, 0))::bigint as games_played,
      p.elo_rating
    from public.profiles p
    join circle c on c.member_id = p.id
    left join room_scores rs on rs.user_id = p.id
    left join duel_scores ds on ds.user_id = p.id
  ),
  ranked as (
    select
      cb.*,
      dense_rank() over (order by cb.total_score desc, cb.elo_rating desc) as rank
    from combined cb
  )
  select r.user_id, r.display_name, r.avatar_url, r.total_score, r.games_played, r.elo_rating, r.rank
  from ranked r
  order by r.rank asc, r.display_name asc
  limit greatest(1, least(coalesce(p_limit, 20), 50))
  offset greatest(0, coalesce(p_offset, 0));
end;
$$;

revoke all on function public.battle_heartbeat(uuid, boolean),
  public.battle_snapshot(uuid),
  public.join_room(text),
  public.get_my_battle_history(integer, integer),
  public.add_friend_by_id(uuid),
  public.get_friends_leaderboard(text, integer, integer) from public, anon;

grant execute on function public.battle_heartbeat(uuid, boolean),
  public.battle_snapshot(uuid),
  public.join_room(text),
  public.get_my_battle_history(integer, integer),
  public.add_friend_by_id(uuid),
  public.get_friends_leaderboard(text, integer, integer) to authenticated;
