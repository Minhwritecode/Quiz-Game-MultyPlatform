-- Run against a disposable/local Supabase DB. All fixtures roll back.
begin;
create function pg_temp.assert_true(ok boolean, label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'ASSERTION FAILED: %', label; end if; end $$;
insert into auth.users(id) values
 ('11111111-1111-4111-8111-111111111111'),
 ('22222222-2222-4222-8222-222222222222'),
 ('33333333-3333-4333-8333-333333333333');
insert into public.question_sets(id,owner_id,title) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','Security fixture');
insert into public.rooms(id,code,host_id,set_id,question_count,seconds_per_question,status) values
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','TEST01','11111111-1111-4111-8111-111111111111',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',3,120,'question_open');
insert into public.room_players(room_id,user_id) values
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','11111111-1111-4111-8111-111111111111'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222');
insert into public.room_questions(room_id,position,question_snapshot,opens_at,closes_at) values
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',0,'{"content":"Q","options":["A","B","C","D"],"correct_index":0,"explanation":"Secret A"}',now()-interval '1 second',now()+interval '120 seconds'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',1,'{"content":"Future","correct_index":0,"explanation":"Secret"}',now()+interval '130 seconds',now()+interval '250 seconds'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',2,'{"content":"Closed","correct_index":1,"explanation":"Answer B"}',now()-interval '130 seconds',now()-interval '1 second');
set local role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
select pg_temp.assert_true((select count(*)=2 from public.room_players),'members can read roster without recursion');
select pg_temp.assert_true((select count(*)=0 from public.question_sets),'other private library is hidden');
select pg_temp.assert_true((select not(question_snapshot ? 'correct_index') and not(question_snapshot ? 'explanation')
 from public.get_room_question('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',0)),'open question hides all answer fields');
select pg_temp.assert_true((select count(*)=0 from public.get_room_question('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',1)),'future question hidden');
select pg_temp.assert_true((select question_snapshot->>'explanation'='Answer B' from public.get_room_question('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',2)),'closed answer revealed');
select public.submit_answer('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',0,0::smallint);
select public.submit_answer('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',0,1::smallint);
select pg_temp.assert_true((select count(*)=1 from public.room_answers),'retry only stores one answer');
select pg_temp.assert_true((select score=1500 from public.room_players where user_id=auth.uid()),'retry does not double score');
do $$ begin
 begin update public.room_players set score=99999 where user_id=auth.uid(); raise exception 'score update allowed';
 exception when insufficient_privilege then null; end;
 begin perform * from public.room_questions; raise exception 'raw answers readable';
 exception when insufficient_privilege then null; end;
 begin perform public.submit_answer('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',2,1::smallint); raise exception 'late answer allowed';
 exception when object_not_in_prerequisite_state then null; end;
end $$;
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
select pg_temp.assert_true((select count(*)=0 from public.rooms),'outsider cannot read room');
do $$ begin
 begin perform public.submit_answer('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',0,0::smallint); raise exception 'outsider answer allowed';
 exception when insufficient_privilege then null; end;
end $$;
set local role anon;
do $$ begin
 begin perform public.submit_answer('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',0,0::smallint); raise exception 'anonymous RPC allowed';
 exception when insufficient_privilege then null; end;
end $$;
rollback;
