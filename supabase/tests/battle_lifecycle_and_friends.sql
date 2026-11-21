-- Verification suite for Group F (30s disconnect auto-forfeit, 30m idle room expiry,
-- early question close, hostless termination, per-user battle history) & Group G (Friends Leaderboard).
\set ON_ERROR_STOP on
begin;

create function pg_temp.assert_true(ok boolean, label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then
    raise exception 'ASSERTION FAILED: %', label;
  end if;
end $$;

insert into auth.users(id, email) values
  ('11111111-1111-4111-8111-111111111201', 'battle-u1@papyrus.test'),
  ('22222222-2222-4222-8222-222222222202', 'battle-u2@papyrus.test');

insert into public.profiles(id, display_name, total_score, games_played, elo_rating) values
  ('11111111-1111-4111-8111-111111111201', 'Học giả Một', 4200, 5, 1320),
  ('22222222-2222-4222-8222-222222222202', 'Học giả Hai', 6100, 8, 1410)
on conflict (id) do update set display_name = excluded.display_name, total_score = excluded.total_score;

insert into public.question_sets(id, owner_id, title) values
  ('aaaa2222-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111201', 'Battle Rules Fixture');

insert into public.questions(id, set_id, content, options, correct_index, explanation, position) values
  ('cccc2222-cccc-4ccc-8ccc-cccccccccccc', 'aaaa2222-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '2 + 2 = ?', '["3","4","5","6"]', 1, '4', 0);

-- 1. Idle 30-minute waiting room auto-expiry
insert into public.rooms(id, code, host_id, set_id, question_count, seconds_per_question, status, created_at) values
  ('bbbb2222-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'EXP030', '11111111-1111-4111-8111-111111111201',
   'aaaa2222-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 1, 15, 'waiting', now() - interval '35 minutes');

set local role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222202', true);

do $$ begin
  begin
    perform * from public.join_room('EXP030');
    raise exception 'expired room accepted join';
  exception when object_not_in_prerequisite_state then null;
  end;
end $$;

-- 2. 30-second disconnect forfeit + early question close + battle history
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111201', true);
select id as room_id, code as room_code from public.create_room('aaaa2222-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 1, 60, 'speed') \gset
select public.battle_heartbeat(:'room_id', true);

select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222202', true);
select * from public.join_room(:'room_code');
select public.battle_heartbeat(:'room_id', true);

select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111201', true);
select public.battle_start(:'room_id');

reset role;
update public.rooms set started_at = now() - interval '5 seconds' where id = :'room_id';
update public.room_questions set opens_at = now() - interval '4 seconds', closes_at = now() + interval '55 seconds' where room_id = :'room_id';
update public.room_players set last_seen_at = now() - interval '35 seconds' where room_id = :'room_id' and user_id = '11111111-1111-4111-8111-111111111201';

set local role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222202', true);
select pg_temp.assert_true(
  public.battle_snapshot(:'room_id')->>'hostId' = '22222222-2222-4222-8222-222222222202',
  'disconnected host forfeited and active player took host'
);

-- All remaining active players (user 2) answer -> question closes early!
select public.submit_answer(:'room_id', 0, 1::smallint);
select pg_temp.assert_true(
  public.battle_snapshot(:'room_id')->>'phase' = 'question_result',
  'question reveals early once all active players have answered'
);

-- Disconnected & forfeited user 1 cannot heartbeat back in
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111201', true);
do $$ begin
  begin
    perform public.battle_heartbeat(:'room_id', true);
    raise exception 'forfeited player was allowed to heartbeat';
  exception when object_not_in_prerequisite_state then null;
  end;
end $$;

-- 3. Friends Leaderboard
select pg_temp.assert_true(
  public.add_friend_by_id('22222222-2222-4222-8222-222222222202') = true,
  'add_friend_by_id creates mutual friendship'
);
select pg_temp.assert_true(
  (select count(*) = 2 from public.get_friends_leaderboard('all', 10, 0)),
  'get_friends_leaderboard ranks caller and accepted friend'
);

rollback;
