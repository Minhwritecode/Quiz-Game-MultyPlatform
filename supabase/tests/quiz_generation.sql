\set ON_ERROR_STOP on
begin;
create function pg_temp.assert_true(ok boolean, label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'ASSERTION FAILED: %', label; end if; end $$;

insert into auth.users(id,email) values
 ('11111111-aaaa-4aaa-8aaa-111111111111','generation-owner@papyrus.test'),
 ('22222222-bbbb-4bbb-8bbb-222222222222','generation-other@papyrus.test');

-- Daily generation quota is independent, request-ID replays are refused, and
-- the 21st distinct job is refused atomically.
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select pg_temp.assert_true(public.consume_quiz_generation_quota('11111111-aaaa-4aaa-8aaa-111111111111','aaaaaaaa-0000-4000-8000-000000000001'),'first generation allowed');
do $$
declare n integer;
begin
 for n in 2..20 loop
   if not public.consume_quiz_generation_quota('11111111-aaaa-4aaa-8aaa-111111111111',
     ('aaaaaaaa-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid) then raise exception 'quota rejected before limit'; end if;
 end loop;
 if public.consume_quiz_generation_quota('11111111-aaaa-4aaa-8aaa-111111111111','aaaaaaaa-0000-4000-8000-000000000021') then raise exception '21st request was allowed'; end if;
 if public.consume_quiz_generation_quota('11111111-aaaa-4aaa-8aaa-111111111111','aaaaaaaa-0000-4000-8000-000000000001') then raise exception 'request ID replay was allowed'; end if;
end $$;
reset role;
select pg_temp.assert_true(not has_function_privilege('authenticated','public.consume_quiz_generation_quota(uuid,uuid)','execute'),'quota RPC unavailable to app users');

-- Set subject, tags and source document ID survive server normalization.
insert into public.source_documents(id,user_id,title,ocr_text) values
 ('33333333-cccc-4ccc-8ccc-333333333333','11111111-aaaa-4aaa-8aaa-111111111111','Chapter 2','Reviewed notes');
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-aaaa-4aaa-8aaa-111111111111',true);
select public.sync_push_set(
 'bbbbbbbb-0000-4000-8000-000000000001','0',
 jsonb_build_object(
  'id','44444444-dddd-4ddd-8ddd-444444444444','title','Cells','subject','Biology',
  'tags',jsonb_build_array('exam','chapter 2'),'sourceDocumentId','33333333-cccc-4ccc-8ccc-333333333333',
  'questions',jsonb_build_array(jsonb_build_object(
   'id','55555555-eeee-4eee-8eee-555555555555','content','What is a cell?',
   'options',jsonb_build_array('Unit','Atom','Tissue','Organ'),'correctIndex',0,'explanation','Smallest unit','position',0))
 )
);
reset role;
select pg_temp.assert_true((select tags = array['exam','chapter 2'] and source_doc_id='33333333-cccc-4ccc-8ccc-333333333333'::uuid
 from public.question_sets where id='44444444-dddd-4ddd-8ddd-444444444444'),'set metadata persisted');
rollback;
