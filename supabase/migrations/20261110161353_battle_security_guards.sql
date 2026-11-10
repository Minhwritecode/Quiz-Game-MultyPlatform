-- Battle writes belong to RPCs, including host changes and presence.
revoke insert, update, delete on public.rooms, public.room_players,
  public.room_questions, public.room_answers from anon, authenticated;
revoke select on public.room_questions from anon, authenticated;
drop policy if exists "users update own presence" on public.room_players;
drop policy if exists "hosts update rooms" on public.rooms;
drop policy if exists "hosts create rooms" on public.rooms;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;
create or replace function private.is_room_member(target uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select auth.uid() is not null and exists (
  select 1 from public.room_players p where p.room_id = target and p.user_id = auth.uid()
) $$;
revoke all on function private.is_room_member(uuid) from public, anon;
grant execute on function private.is_room_member(uuid) to authenticated;

-- Avoid a recursively self-referencing room_players policy.
drop policy if exists "members read players" on public.room_players;
create policy "members read players" on public.room_players for select to authenticated
using (private.is_room_member(room_id));
drop policy if exists "room members read rooms" on public.rooms;
create policy "room members read rooms" on public.rooms for select to authenticated
using (private.is_room_member(id));

create or replace function public.get_room_question(p_room_id uuid, p_position integer)
returns table("position" integer, question_snapshot jsonb, opens_at timestamptz, closes_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare q public.room_questions%rowtype;
begin
  if not private.is_room_member(p_room_id) then
    raise exception 'room_membership_required' using errcode = '42501';
  end if;
  select * into q from public.room_questions rq
    where rq.room_id = p_room_id and rq.position = p_position;
  if q.room_id is null or clock_timestamp() < q.opens_at then
    return;
  end if;
  return query select q.position,
    case when clock_timestamp() < q.closes_at then
      jsonb_build_object('content', q.question_snapshot->'content', 'options', q.question_snapshot->'options')
    else q.question_snapshot end, q.opens_at, q.closes_at;
end $$;

create or replace function public.submit_answer(p_room_id uuid, p_position integer, p_chosen_index smallint)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  q public.room_questions%rowtype;
  t timestamptz;
  awarded integer := 0;
  existing_points integer;
  inserted integer;
begin
  if not private.is_room_member(p_room_id) then
    raise exception 'room_membership_required' using errcode = '42501';
  end if;
  if p_chosen_index is null or p_chosen_index not between 0 and 3 then
    raise exception 'invalid_answer_index' using errcode = '22023';
  end if;
  -- Serializes retries for this player without blocking other players.
  perform 1 from public.room_players p
    where p.room_id = p_room_id and p.user_id = auth.uid() for update;
  select a.points into existing_points from public.room_answers a
    where a.room_id = p_room_id and a.user_id = auth.uid() and a.position = p_position;
  if found then return existing_points; end if;
  select * into q from public.room_questions rq
    where rq.room_id = p_room_id and rq.position = p_position;
  t := clock_timestamp();
  if q.room_id is null or t < q.opens_at or t >= q.closes_at then
    raise exception 'question_not_open' using errcode = '55000';
  end if;
  if (q.question_snapshot->>'correct_index')::integer = p_chosen_index then
    awarded := 1000 + least(500, floor(extract(epoch from (q.closes_at - t)) * 10)::integer);
  end if;
  insert into public.room_answers(room_id, user_id, position, chosen_index, points)
    values(p_room_id, auth.uid(), p_position, p_chosen_index, awarded)
    on conflict do nothing;
  get diagnostics inserted = row_count;
  if inserted = 1 then
    update public.room_players p set score = p.score + awarded
      where p.room_id = p_room_id and p.user_id = auth.uid();
  end if;
  return awarded;
end $$;
revoke all on function public.get_room_question(uuid, integer) from public, anon;
revoke all on function public.submit_answer(uuid, integer, smallint) from public, anon;
grant execute on function public.get_room_question(uuid, integer),
  public.submit_answer(uuid, integer, smallint) to authenticated;
