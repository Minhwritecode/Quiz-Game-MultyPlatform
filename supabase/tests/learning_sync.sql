-- Run as local supabase_admin with ON_ERROR_STOP=1 after the learning_sync migration.
-- All fixtures and writes roll back. Requires the local dblink extension for the
-- two-session lock check (installed transactionally below).
begin;
create extension if not exists dblink with schema extensions;
create function pg_temp.check_true(ok boolean, label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %', label; end if; end $$;
create function pg_temp.expect_error(statement text, expected text) returns void language plpgsql as $$
begin
  begin execute statement;
  exception when others then
    if sqlstate = expected then return; end if;
    raise exception 'Expected SQLSTATE %, got %: %', expected, sqlstate, sqlerrm;
  end;
  raise exception 'Expected SQLSTATE %, statement succeeded: %', expected, statement;
end $$;
create function pg_temp.source_doc(target uuid) returns jsonb language sql as $$
 select jsonb_build_object('entity','source_documents','id',target,'revision','0','updatedAt','1900-01-01T00:00:00Z',
 'deleted',false,'futureEnvelope',jsonb_build_object('v',1),'payload',jsonb_build_object(
 'id',target,'title','OCR notes','text','Unicode: tiếng Việt ✓','createdAt','2026-11-01T00:00:00Z','futurePayload',42));
$$;
insert into auth.users(id) values
 ('babe0000-0000-4000-8000-000000000001'),('babe0000-0000-4000-8000-000000000002');
insert into public.question_sets(id,owner_id,title) values
 ('babe1000-0000-4000-8000-000000000001','babe0000-0000-4000-8000-000000000001','A'),
 ('babe1000-0000-4000-8000-000000000002','babe0000-0000-4000-8000-000000000002','B'),
 ('babe1000-0000-4000-8000-000000000003','babe0000-0000-4000-8000-000000000001','A other set');
insert into public.questions(id,set_id,content,options,correct_index,position) values
 ('babe2000-0000-4000-8000-000000000001','babe1000-0000-4000-8000-000000000001','Q1','["a","b","c","d"]',0,0),
 ('babe2000-0000-4000-8000-000000000002','babe1000-0000-4000-8000-000000000002','Q2','["a","b","c","d"]',0,0),
 ('babe2000-0000-4000-8000-000000000003','babe1000-0000-4000-8000-000000000003','Q3','["a","b","c","d"]',0,0);
create temp table learning_test_state(key text primary key, value jsonb);
grant all on learning_test_state to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub','babe0000-0000-4000-8000-000000000001',true);

do $$
declare d jsonb := pg_temp.source_doc('babe3000-0000-4000-8000-000000000001'); r jsonb; conflict_result jsonb; changed jsonb;
begin
  r := public.sync_push_learning('babe4000-0000-4000-8000-000000000001','0','source_documents',d);
  perform pg_temp.check_true(r->>'conflict'='false' and (r#>>'{document,revision}')::bigint>0,'create source');
  perform pg_temp.check_true(r#>>'{document,payload,text}'=d#>>'{payload,text}' and
    r#>'{document,futureEnvelope}'=d->'futureEnvelope' and r#>>'{document,payload,futurePayload}'='42','source and unknown fields');
  perform pg_temp.check_true((r#>>'{document,updatedAt}')::timestamptz>'2026-01-01','server clock');
  perform pg_temp.check_true(public.sync_push_learning('babe4000-0000-4000-8000-000000000001','0','source_documents',d)=r,'exact retry');
  perform pg_temp.expect_error(format('select public.sync_push_learning(%L,%L,%L,%L::jsonb)',
    'babe4000-0000-4000-8000-000000000001','0','source_documents',jsonb_set(d,'{payload,title}','"changed"')),'22023');
  conflict_result := public.sync_push_learning('babe4000-0000-4000-8000-000000000002','0','source_documents',d);
  perform pg_temp.check_true(conflict_result->>'conflict'='true' and conflict_result->'document'=r->'document','stale create conflict');
  changed := jsonb_set(r->'document','{payload,title}','"edited"');
  changed := public.sync_push_learning('babe4000-0000-4000-8000-000000000003',r#>>'{document,revision}','source_documents',changed);
  perform pg_temp.check_true((changed#>>'{document,revision}')::bigint>(r#>>'{document,revision}')::bigint,'update revision');
  perform pg_temp.check_true(public.sync_push_learning('babe4000-0000-4000-8000-000000000002','0','source_documents',d)=conflict_result,'conflict receipt is stable after edit');
  perform pg_temp.check_true(public.sync_push_learning('babe4000-0000-4000-8000-000000000001','0','source_documents',d)=r,'success receipt is stable after edit');
  insert into learning_test_state values('source',changed->'document');
  perform pg_temp.expect_error(format('select public.sync_push_learning(gen_random_uuid(),%L,%L,%L::jsonb)',
    '123','source_documents',pg_temp.source_doc('babe3000-0000-4000-8000-000000000099')),'22023');
end $$;

do $$ declare d jsonb; r jsonb; malformed jsonb; begin
 d := jsonb_build_object('entity','attempts','id','babe5000-0000-4000-8000-000000000001','revision','0',
 'updatedAt','1900-01-01','deleted',false,'payload',jsonb_build_object(
 'id','babe5000-0000-4000-8000-000000000001','questionSetId','babe1000-0000-4000-8000-000000000001',
 'score',66.67,'correctCount',1,'total',2,'startedAt','2026-11-01T00:00:00Z','finishedAt','2026-11-01T00:01:00Z',
 'status','completed','answers',jsonb_build_array(
 jsonb_build_object('questionId','babe2000-0000-4000-8000-000000000001','chosenIndex',null,'isCorrect',false,'timeMs',12.5,'futureAnswer','yes'),
 jsonb_build_object('questionId','babe2000-0000-4000-8000-000000000001','chosenIndex',0,'isCorrect',true,'timeMs',25.25))));
 r := public.sync_push_learning('babe4000-0000-4000-8000-000000000004','0','attempts',d);
 perform pg_temp.check_true(r#>'{document,payload,answers}'=d#>'{payload,answers}' and
   r#>>'{document,payload,score}'='66.67' and r#>>'{document,payload,correctCount}'='1','attempt precision, null answer and order');
 perform pg_temp.check_true((select count(*)=2 from public.attempt_answers where attempt_id=(d->>'id')::uuid),'normalized answers');
 perform pg_temp.check_true((select duration_ms=37.75 from public.attempts where id=(d->>'id')::uuid),'normalized duration');
 perform pg_temp.check_true(public.sync_push_learning('babe4000-0000-4000-8000-000000000004','0','attempts',d)=r,'attempt receipt');
 d := r->'document';
 malformed := jsonb_set(d,'{payload,answers,0,questionId}','"babe2000-0000-4000-8000-000000000002"');
 perform pg_temp.expect_error(format('select public.sync_push_learning(gen_random_uuid(),%L,%L,%L::jsonb)',d->>'revision','attempts',malformed),'42501');
 malformed := jsonb_set(d,'{payload,answers,0,questionId}','"babe2000-0000-4000-8000-000000000003"');
 perform pg_temp.expect_error(format('select public.sync_push_learning(gen_random_uuid(),%L,%L,%L::jsonb)',d->>'revision','attempts',malformed),'42501');
 malformed := jsonb_set(d,'{payload,questionSetId}','"babe1000-0000-4000-8000-000000000002"');
 perform pg_temp.expect_error(format('select public.sync_push_learning(gen_random_uuid(),%L,%L,%L::jsonb)',d->>'revision','attempts',malformed),'42501');
 malformed := jsonb_set(d,'{payload,answers,1,timeMs}','-1');
 perform pg_temp.expect_error(format('select public.sync_push_learning(gen_random_uuid(),%L,%L,%L::jsonb)',d->>'revision','attempts',malformed),'22023');
 malformed := jsonb_set(d,'{payload,answers,1,chosenIndex}','"0"');
 perform pg_temp.expect_error(format('select public.sync_push_learning(gen_random_uuid(),%L,%L,%L::jsonb)',d->>'revision','attempts',malformed),'22023');
 -- Late insert cast failure must roll back the parent update and deleted answers.
 malformed := jsonb_set(d,'{payload,answers,1,chosenIndex}','2147483648');
 perform pg_temp.expect_error(format('select public.sync_push_learning(gen_random_uuid(),%L,%L,%L::jsonb)',d->>'revision','attempts',malformed),'22003');
 perform pg_temp.check_true((select revision::text=d->>'revision' from public.attempts where id=(d->>'id')::uuid)
   and (select count(*)=2 from public.attempt_answers where attempt_id=(d->>'id')::uuid),'failed write atomicity');
 d := jsonb_set(d,'{payload,answers}',jsonb_build_array(d#>'{payload,answers,1}'));
 r := public.sync_push_learning(gen_random_uuid(),d->>'revision','attempts',d);
 perform pg_temp.check_true((select count(*)=1 from public.attempt_answers where attempt_id=(d->>'id')::uuid),'answer replacement');
 insert into learning_test_state values('attempt',r->'document');
end $$;

-- Tombstones retain a complete, schema-valid payload and can be resurrected.
do $$ declare d jsonb; r jsonb; p jsonb; kind text; begin
 for kind in select unnest(array['source','attempt']) loop
   select value into d from learning_test_state where key=kind;
   r := public.sync_push_learning(gen_random_uuid(),d->>'revision',d->>'entity',jsonb_set(d,'{deleted}','true'));
   perform pg_temp.check_true(r#>>'{document,deleted}'='true' and r#>'{document,payload}'=d->'payload','tombstone payload');
   p := public.sync_pull_learning(d->>'revision');
   perform pg_temp.check_true(p->'documents' @> jsonb_build_array(r->'document'),'tombstone delivered');
   d := r->'document';
   r := public.sync_push_learning(gen_random_uuid(),d->>'revision',d->>'entity',jsonb_set(d,'{deleted}','false'));
   perform pg_temp.check_true(r#>>'{document,deleted}'='false','resurrection');
   update learning_test_state set value=r->'document' where key=kind;
 end loop;
end $$;

select set_config('request.jwt.claim.sub','babe0000-0000-4000-8000-000000000002',true);
do $$ declare d jsonb; r jsonb; begin
 perform pg_temp.check_true(public.sync_pull_learning('0')='{"documents":[],"cursor":"0","hasMore":false}'::jsonb,'owner pull isolation');
 perform pg_temp.check_true((select count(*)=0 from public.attempts) and (select count(*)=0 from public.attempt_answers)
   and (select count(*)=0 from public.source_documents),'RLS read isolation');
 for d in select value from learning_test_state loop
   perform pg_temp.expect_error(format('select public.sync_push_learning(gen_random_uuid(),%L,%L,%L::jsonb)',d->>'revision',d->>'entity',d),'42501');
 end loop;
 -- Same mutation UUID in another account is a separate receipt.
 r := public.sync_push_learning('babe4000-0000-4000-8000-000000000001','0','source_documents',pg_temp.source_doc('babe3000-0000-4000-8000-000000000002'));
 perform pg_temp.check_true(r->>'conflict'='false','receipt owner isolation');
 perform pg_temp.expect_error('delete from public.source_documents','42501');
 perform pg_temp.expect_error('update public.attempts set score=100','42501');
 perform pg_temp.expect_error('delete from public.attempt_answers','42501');
 perform pg_temp.expect_error('select * from private.learning_sync_receipts','42501');
end $$;

select set_config('request.jwt.claim.sub','babe0000-0000-4000-8000-000000000001',true);
do $$ declare i integer; p jsonb; next_page jsonb; d jsonb; rev bigint:=0; begin
 -- 2 existing documents + 99 sources = 101, exercising a mixed-entity boundary.
 for i in 1..99 loop
   perform public.sync_push_learning(gen_random_uuid(),'0','source_documents',pg_temp.source_doc(gen_random_uuid()));
 end loop;
 p := public.sync_pull_learning('0');
 perform pg_temp.check_true(jsonb_array_length(p->'documents')=100 and (p->>'hasMore')::boolean,'first page');
 for d in select value from jsonb_array_elements(p->'documents') loop
   perform pg_temp.check_true((d->>'revision')::bigint>rev,'strictly increasing revisions');
   rev := (d->>'revision')::bigint;
 end loop;
 perform pg_temp.check_true(p->>'cursor'=rev::text,'cursor is last delivered revision');
 next_page := public.sync_pull_learning(p->>'cursor');
 perform pg_temp.check_true(jsonb_array_length(next_page->'documents')=1 and next_page->>'hasMore'='false','last page');
 perform pg_temp.check_true((next_page->>'cursor')::bigint>rev,'second cursor advances');
 p := public.sync_pull_learning(next_page->>'cursor');
 perform pg_temp.check_true(p->'documents'='[]'::jsonb and p->>'cursor'=next_page->>'cursor' and p->>'hasMore'='false','empty page stable');
 -- Exactly 100 remaining documents must not advertise another page.
 select min((x->>'revision')::bigint) into rev from jsonb_array_elements(public.sync_pull_learning('0')->'documents') x;
 p := public.sync_pull_learning(rev::text);
 perform pg_temp.check_true(jsonb_array_length(p->'documents')=100 and p->>'hasMore'='false','exact page boundary');
 foreach d in array array['null'::jsonb,'{}'::jsonb,'[]'::jsonb] loop
   perform pg_temp.expect_error(format('select public.sync_push_learning(gen_random_uuid(),%L,%L,%L::jsonb)','0','source_documents',d),'22023');
 end loop;
 perform pg_temp.expect_error('select public.sync_pull_learning(''-1'')','22023');
 perform pg_temp.expect_error('select public.sync_pull_learning(''9223372036854775808'')','22023');
 perform pg_temp.expect_error('select public.sync_pull_learning(null)','22023');
end $$;

-- Group A pushes first: replacing questions retires the old question; a later
-- set tombstone must still allow offline completed attempts to arrive as history.
do $$ declare s jsonb; d jsonb; r jsonb; target uuid; begin
 s := public.sync_push_set(gen_random_uuid(),'0',jsonb_build_object(
   'id','babe1000-0000-4000-8000-000000000001','title','Edited set','deleted',false,
   'questions',jsonb_build_array(jsonb_build_object('id','babe2000-0000-4000-8000-000000000004',
     'content','Replacement question','options',jsonb_build_array('a','b','c','d'),'correctIndex',0,'position',0))));
 perform pg_temp.check_true((select is_deleted from public.questions where id='babe2000-0000-4000-8000-000000000001'),'set edit retires question');
 select value into d from learning_test_state where key='attempt';
 target := gen_random_uuid();
 d := jsonb_set(jsonb_set(jsonb_set(d,'{id}',to_jsonb(target)),'{payload,id}',to_jsonb(target)),'{revision}','"0"');
 r := public.sync_push_learning(gen_random_uuid(),'0','attempts',d);
 perform pg_temp.check_true(r->>'conflict'='false' and r#>'{document,payload,answers}'=d#>'{payload,answers}','new offline attempt references retired question');
 s := public.sync_push_set(gen_random_uuid(),s#>>'{document,revision}',jsonb_set(s->'document','{deleted}','true'));
 perform pg_temp.check_true(s#>>'{document,deleted}'='true','set tombstone');
 target := gen_random_uuid();
 d := jsonb_set(jsonb_set(d,'{id}',to_jsonb(target)),'{payload,id}',to_jsonb(target));
 r := public.sync_push_learning(gen_random_uuid(),'0','attempts',d);
 perform pg_temp.check_true(r->>'conflict'='false' and r#>>'{document,payload,questionSetId}'=d#>>'{payload,questionSetId}',
   'new offline attempt references deleted owned set and question');
end $$;

-- Authentication and function/table privileges.
select set_config('request.jwt.claim.sub','',true);
select pg_temp.expect_error('select public.sync_pull_learning(''0'')','42501');
select pg_temp.expect_error('select public.sync_push_learning(gen_random_uuid(),''0'',''source_documents'',''{}'')','42501');
reset role;
select pg_temp.check_true(not has_function_privilege('anon','public.sync_pull_learning(text)','execute') and
  not has_function_privilege('anon','public.sync_push_learning(uuid,text,text,jsonb)','execute') and
  not has_function_privilege('authenticated','private.learning_document(uuid,text,uuid)','execute'),'function privileges');
select pg_temp.check_true(not has_table_privilege('anon','public.source_documents','select') and
  not has_table_privilege('authenticated','public.attempts','insert') and
  not has_table_privilege('authenticated','public.attempt_answers','insert'),'table privileges');

-- An independent connection holds a third owner's lock. Both RPCs must wait,
-- proving lock participation without committing any fixture or schema changes.
select extensions.dblink_connect('learning_lock','dbname=' || current_database() || ' user=postgres');
select * from extensions.dblink('learning_lock',
  'select pg_advisory_lock(hashtextextended(''babe0000-0000-4000-8000-000000000003'',0))::text') as t(locked text);
set local lock_timeout='150ms';
set local role authenticated;
select set_config('request.jwt.claim.sub','babe0000-0000-4000-8000-000000000003',true);
select pg_temp.expect_error('select public.sync_pull_learning(''0'')','55P03');
select pg_temp.expect_error('select public.sync_push_learning(gen_random_uuid(),''0'',''source_documents'',pg_temp.source_doc(gen_random_uuid()))','55P03');
reset role;
select extensions.dblink_disconnect('learning_lock');
set local lock_timeout='0';

-- Auth cleanup cascades receipts and normalized data, without touching owner B.
delete from auth.users where id='babe0000-0000-4000-8000-000000000001';
select pg_temp.check_true(not exists(select 1 from private.learning_sync_receipts where owner_id='babe0000-0000-4000-8000-000000000001')
  and not exists(select 1 from public.attempts where user_id='babe0000-0000-4000-8000-000000000001')
  and not exists(select 1 from public.attempt_answers where attempt_id='babe5000-0000-4000-8000-000000000001')
  and not exists(select 1 from public.source_documents where user_id='babe0000-0000-4000-8000-000000000001'),'account cleanup');
select pg_temp.check_true(exists(select 1 from public.source_documents where user_id='babe0000-0000-4000-8000-000000000002')
  and exists(select 1 from private.learning_sync_receipts where owner_id='babe0000-0000-4000-8000-000000000002'),'other account survives');
select 'learning_sync: all assertions passed' as result;
rollback;
