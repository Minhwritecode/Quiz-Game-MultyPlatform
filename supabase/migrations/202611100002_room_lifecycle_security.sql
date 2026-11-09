-- Papyrus battle lifecycle and answer-key protection.
-- This migration is intentionally additive and must be reviewed against a local
-- Supabase database before any hosted deployment.

create or replace function public.create_room(
  p_set_id uuid,
  p_question_count integer default 10,
  p_seconds_per_question integer default 15,
  p_mode text default 'speed'
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
  if not exists (
    select 1 from public.question_sets
    where public.question_sets.id = p_set_id
      and public.question_sets.owner_id = current_user_id
      and public.question_sets.is_deleted = false
  ) then
    raise exception 'question_set_not_owned' using errcode = '42501';
  end if;

  for attempt in 1..5 loop
    candidate_code := upper(substr(replace(public.gen_random_uuid()::text, '-', ''), 1, 6));
    begin
      insert into public.rooms(code, host_id, set_id, mode, question_count, seconds_per_question)
      values (candidate_code, current_user_id, p_set_id, p_mode, p_question_count, p_seconds_per_question)
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
    new_room.seconds_per_question, new_room.started_at, new_room.created_at;
end;
$$;

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
      target_room.seconds_per_question, target_room.started_at, target_room.created_at;
    return;
  end if;

  select count(*)::integer into player_count from public.room_players where room_id = target_room.id;
  if player_count >= 4 then
    raise exception 'room_full' using errcode = '54000';
  end if;

  insert into public.room_players(room_id, user_id)
  values (target_room.id, current_user_id);

  return query select target_room.id, target_room.code, target_room.host_id, target_room.set_id,
    target_room.mode, target_room.status, target_room.question_count,
    target_room.seconds_per_question, target_room.started_at, target_room.created_at;
end;
$$;

-- The question snapshot contains the answer key and must not be directly
-- exposed to clients. Clients receive a sanitized projection through the RPC.
drop policy if exists "members read room questions" on public.room_questions;
drop policy if exists "users join rooms" on public.room_players;

create or replace function public.get_room_question(p_room_id uuid, p_position integer)
returns table (
  position integer,
  question_snapshot jsonb,
  opens_at timestamptz,
  closes_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  question_row public.room_questions%rowtype;
begin
  if current_user_id is null or not exists (
    select 1 from public.room_players
    where room_id = p_room_id and user_id = current_user_id
  ) then
    raise exception 'room_membership_required' using errcode = '42501';
  end if;

  select * into question_row from public.room_questions
  where room_id = p_room_id and public.room_questions.position = p_position;
  if question_row.room_id is null then
    raise exception 'room_question_not_found' using errcode = 'P0002';
  end if;

  return query select question_row.position,
    question_row.question_snapshot - 'correct_index',
    question_row.opens_at,
    question_row.closes_at;
end;
$$;

create or replace function public.submit_answer(p_room_id uuid, p_position integer, p_chosen_index smallint)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_question public.room_questions%rowtype;
  awarded integer := 0;
  remaining_ms integer;
begin
  if current_user_id is null or not exists (
    select 1 from public.room_players
    where room_id = p_room_id and user_id = current_user_id
  ) then
    raise exception 'room_membership_required' using errcode = '42501';
  end if;
  if p_chosen_index not between 0 and 3 then
    raise exception 'invalid_answer_index' using errcode = '22023';
  end if;

  select * into current_question from public.room_questions
  where room_id = p_room_id and public.room_questions.position = p_position;
  if current_question.room_id is null or now() < current_question.opens_at or now() > current_question.closes_at then
    return 0;
  end if;
  if exists (select 1 from public.room_answers where room_id = p_room_id and user_id = current_user_id and position = p_position) then
    return 0;
  end if;

  remaining_ms := greatest(0, extract(epoch from (current_question.closes_at - now()))::integer * 1000);
  if (current_question.question_snapshot ->> 'correct_index')::integer = p_chosen_index then
    awarded := 1000 + least(500, (remaining_ms / 100));
  end if;
  insert into public.room_answers(room_id, user_id, position, chosen_index, points)
  values (p_room_id, current_user_id, p_position, p_chosen_index, awarded);
  update public.room_players set score = score + awarded
  where room_id = p_room_id and user_id = current_user_id;
  return awarded;
end;
$$;

revoke execute on function public.create_room(uuid, integer, integer, text) from public, anon;
revoke execute on function public.join_room(text) from public, anon;
revoke execute on function public.get_room_question(uuid, integer) from public, anon;
revoke execute on function public.submit_answer(uuid, integer, smallint) from public, anon;
revoke insert on public.room_players from authenticated;
grant execute on function public.create_room(uuid, integer, integer, text) to authenticated;
grant execute on function public.join_room(text) to authenticated;
grant execute on function public.get_room_question(uuid, integer) to authenticated;
grant execute on function public.submit_answer(uuid, integer, smallint) to authenticated;
