begin;
create function pg_temp.assert_true(ok boolean, label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'ASSERTION FAILED: %',label; end if; end $$;
insert into auth.users(id) values ('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');
insert into public.question_sets(id,owner_id,title) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','Lifecycle');
insert into public.questions(id,set_id,content,options,correct_index,explanation,position) values
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Q','["A","B","C","D"]',0,'A',0);
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select id as room_id,code as room_code from public.create_room('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',1,5,'speed') \gset
select public.battle_heartbeat(:'room_id',true);
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
select * from public.join_room(:'room_code');
select public.battle_heartbeat(:'room_id',true);
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select public.battle_start(:'room_id');
select pg_temp.assert_true(public.battle_snapshot(:'room_id')->>'phase'='countdown','countdown starts');
reset role;
update public.rooms set started_at=now()-interval '2 seconds' where id=:'room_id';
update public.room_questions set opens_at=now()-interval '2 seconds',closes_at=now()+interval '3 seconds' where room_id=:'room_id';
update public.room_players set last_seen_at=now()-interval '31 seconds' where room_id=:'room_id' and user_id='11111111-1111-4111-8111-111111111111';
set local role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
select pg_temp.assert_true(public.battle_snapshot(:'room_id')->>'phase'='question_open','server opens question');
select pg_temp.assert_true(public.battle_snapshot(:'room_id')->>'hostId'='22222222-2222-4222-8222-222222222222','host transfers after lease expiry');
select public.submit_answer(:'room_id',0,0::smallint);
reset role;
update public.room_questions set closes_at=now()-interval '4 seconds' where room_id=:'room_id';
set local role authenticated;
select pg_temp.assert_true(public.battle_snapshot(:'room_id')->>'phase'='finished','server finishes without host timer');
rollback;
