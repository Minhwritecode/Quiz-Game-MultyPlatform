-- Cursor order is serialized per owner, not based on the device clock.
create sequence private.set_revision_seq;
alter table public.question_sets add column revision bigint not null default 0;
update public.question_sets set revision=nextval('private.set_revision_seq');
create index question_sets_owner_revision on public.question_sets(owner_id,revision);
create table private.sync_receipts (
 owner_id uuid not null references auth.users(id) on delete cascade,
 mutation_id uuid not null,
 request jsonb not null,
 result jsonb not null,
 primary key(owner_id,mutation_id)
);
alter table private.sync_receipts enable row level security;
revoke all on private.sync_receipts from public,anon,authenticated;

create function private.set_document(target uuid) returns jsonb
language sql stable set search_path='' as $$
 select jsonb_build_object('id',s.id,'title',s.title,'subject',s.subject,
 'revision',s.revision::text,'updatedAt',s.updated_at,'deleted',s.is_deleted,
 'questions',coalesce((select jsonb_agg(jsonb_build_object('id',q.id,'content',q.content,
 'options',q.options,'correctIndex',q.correct_index,'explanation',q.explanation,'position',q.position) order by q.position,q.id)
 from public.questions q where q.set_id=s.id and not q.is_deleted),'[]'::jsonb))
 from public.question_sets s where s.id=target;
$$;
revoke all on function private.set_document(uuid) from public,anon,authenticated;

create function public.sync_push_set(mutation_id uuid, base_revision text, document jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); sid uuid; s public.question_sets%rowtype; receipt private.sync_receipts%rowtype;
 req jsonb; result jsonb; q jsonb; deleted boolean; qid uuid;
begin
 if uid is null then raise exception 'authentication_required' using errcode='42501'; end if;
 if mutation_id is null or base_revision is null or base_revision !~ '^[0-9]+$' or document is null or octet_length(document::text)>500000 then raise exception 'invalid_sync_request' using errcode='22023'; end if;
 sid:=(document->>'id')::uuid;
 if sid is null then raise exception 'id_required' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 -- Also serialize first creation when different owners submit the same UUID.
 perform pg_advisory_xact_lock(hashtextextended(sid::text,1));
 req:=jsonb_build_object('base',base_revision,'document',document);
 select * into receipt from private.sync_receipts r where r.owner_id=uid and r.mutation_id=sync_push_set.mutation_id;
 if found then
   if receipt.request<>req then raise exception 'mutation_reused' using errcode='22023'; end if;
   return receipt.result;
 end if;
 select * into s from public.question_sets where id=sid for update;
 if found and s.owner_id<>uid then raise exception 'not_owner' using errcode='42501'; end if;
 if coalesce(s.revision,0)::text<>base_revision then
   return jsonb_build_object('conflict',true,'document',private.set_document(sid));
 end if;
 deleted:=coalesce((document->>'deleted')::boolean,false);
 if not deleted then
   if coalesce(length(trim(document->>'title')),0) not between 1 and 200
     or jsonb_typeof(document->'questions') is distinct from 'array'
     or jsonb_array_length(document->'questions') not between 1 and 100 then raise exception 'invalid_set' using errcode='22023'; end if;
   for q in select value from jsonb_array_elements(document->'questions') loop
     qid:=(q->>'id')::uuid;
     if qid is null or coalesce(length(trim(q->>'content')),0)=0 or jsonb_typeof(q->'options') is distinct from 'array'
       or jsonb_array_length(q->'options')<>4 or coalesce(q->>'correctIndex','') !~ '^[0-3]$'
       or exists(select 1 from jsonb_array_elements(q->'options') o where jsonb_typeof(o)<>'string' or length(trim(o#>>'{}'))=0)
       or (select count(distinct lower(trim(value))) from jsonb_array_elements_text(q->'options'))<>4
       then raise exception 'invalid_question' using errcode='22023'; end if;
     if exists(select 1 from public.questions where id=qid and set_id<>sid) then raise exception 'question_not_owned' using errcode='42501'; end if;
   end loop;
   if (select count(distinct value->>'id') from jsonb_array_elements(document->'questions'))<>jsonb_array_length(document->'questions') then raise exception 'duplicate_question_id' using errcode='22023'; end if;
 end if;
 insert into public.question_sets(id,owner_id,title,subject,is_deleted,revision,updated_at)
 values(sid,uid,coalesce(document->>'title','Deleted'),coalesce(document->>'subject',''),deleted,nextval('private.set_revision_seq'),clock_timestamp())
 on conflict(id) do update set title=excluded.title,subject=excluded.subject,is_deleted=excluded.is_deleted,revision=excluded.revision,updated_at=excluded.updated_at;
 if not deleted then
   update public.questions set is_deleted=true where set_id=sid;
   for q in select value from jsonb_array_elements(document->'questions') loop
     insert into public.questions(id,set_id,content,options,correct_index,explanation,position,is_deleted)
     values((q->>'id')::uuid,sid,q->>'content',q->'options',(q->>'correctIndex')::smallint,coalesce(q->>'explanation',''),coalesce((q->>'position')::integer,0),false)
     on conflict(id) do update set content=excluded.content,options=excluded.options,correct_index=excluded.correct_index,explanation=excluded.explanation,position=excluded.position,is_deleted=false,updated_at=clock_timestamp()
     where public.questions.set_id=excluded.set_id;
     if not found then raise exception 'question_not_owned' using errcode='42501'; end if;
   end loop;
 end if;
 result:=jsonb_build_object('conflict',false,'document',private.set_document(sid));
 insert into private.sync_receipts values(uid,mutation_id,req,result);
 return result;
end $$;

create function public.sync_pull_sets(after_revision text default '0') returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); docs jsonb; cursor text;
begin
 if uid is null then raise exception 'authentication_required' using errcode='42501'; end if;
 if after_revision is null or after_revision !~ '^[0-9]+$' then raise exception 'invalid_cursor' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 select coalesce(jsonb_agg(private.set_document(page.id) order by page.revision),'[]'::jsonb),coalesce(max(page.revision)::text,after_revision)
 into docs,cursor from (select id,revision from public.question_sets where owner_id=uid and revision>after_revision::bigint order by revision limit 100) page;
 return jsonb_build_object('documents',docs,'cursor',cursor,'hasMore',jsonb_array_length(docs)=100);
end $$;
-- All client mutations must use the atomic endpoint; reads still obey existing RLS.
revoke insert,update,delete on public.question_sets,public.questions from anon,authenticated;
revoke all on function public.sync_push_set(uuid,text,jsonb),public.sync_pull_sets(text) from public,anon;
grant execute on function public.sync_push_set(uuid,text,jsonb),public.sync_pull_sets(text) to authenticated;
