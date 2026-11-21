-- Quiz generation has its own daily allowance, independent of Papybot.
create table private.quiz_generation_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_day date not null,
  requests integer not null check (requests between 1 and 20),
  primary key (user_id, usage_day)
);
create table private.quiz_generation_request_keys (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_day date not null,
  request_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, usage_day, request_id)
);
alter table private.quiz_generation_usage enable row level security;
alter table private.quiz_generation_request_keys enable row level security;
revoke all on private.quiz_generation_usage, private.quiz_generation_request_keys from public, anon, authenticated;

create function private.consume_quiz_generation_quota(p_user uuid, p_request_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare today date := (now() at time zone 'UTC')::date; consumed integer;
begin
  if auth.uid() is not null or coalesce(auth.jwt()->>'role','') <> 'service_role' or p_user is null or p_request_id is null then
    raise exception 'service_role_required' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 3));
  delete from private.quiz_generation_request_keys where user_id=p_user and usage_day<today-90;
  delete from private.quiz_generation_usage where user_id=p_user and usage_day<today-90;
  if exists(select 1 from private.quiz_generation_request_keys k where k.user_id=p_user and k.usage_day=today and k.request_id=p_request_id) then
    return false; -- Never run the provider twice for the same accepted request.
  end if;
  insert into private.quiz_generation_usage(user_id,usage_day,requests) values(p_user,today,1)
  on conflict(user_id,usage_day) do update set requests=private.quiz_generation_usage.requests+1
    where private.quiz_generation_usage.requests<20
  returning requests into consumed;
  if consumed is null then return false; end if;
  insert into private.quiz_generation_request_keys(user_id,usage_day,request_id) values(p_user,today,p_request_id);
  return true;
end;
$$;
revoke all on function private.consume_quiz_generation_quota(uuid,uuid) from public, anon, authenticated;

grant usage on schema private to service_role;
grant execute on function private.consume_quiz_generation_quota(uuid,uuid) to service_role;

-- A narrow public-schema wrapper is callable only by the Edge Function's service role.
create function public.consume_quiz_generation_quota(p_user uuid, p_request_id uuid)
returns boolean language sql security invoker set search_path = '' as $$
  select private.consume_quiz_generation_quota(p_user,p_request_id);
$$;
revoke all on function public.consume_quiz_generation_quota(uuid,uuid) from public, anon, authenticated;
grant execute on function public.consume_quiz_generation_quota(uuid,uuid) to service_role;

-- Keep study metadata with the set when it moves between local storage and Supabase.
alter table public.question_sets add column tags text[] not null default '{}'
  check (cardinality(tags) <= 10 and array_position(tags, null) is null);
create index question_sets_source_doc_id on public.question_sets(source_doc_id) where source_doc_id is not null;

create or replace function private.set_document(target uuid) returns jsonb
language sql stable set search_path='' as $$
 select jsonb_build_object('id',s.id,'title',s.title,'subject',s.subject,'tags',s.tags,
 'sourceDocumentId',s.source_doc_id,
 'revision',s.revision::text,'updatedAt',s.updated_at,'deleted',s.is_deleted,
 'questions',coalesce((select jsonb_agg(jsonb_build_object('id',q.id,'content',q.content,
 'options',q.options,'correctIndex',q.correct_index,'explanation',q.explanation,'position',q.position) order by q.position,q.id)
 from public.questions q where q.set_id=s.id and not q.is_deleted),'[]'::jsonb))
 from public.question_sets s where s.id=target;
$$;

create or replace function public.sync_push_set(mutation_id uuid, base_revision text, document jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); sid uuid; s public.question_sets%rowtype; receipt private.sync_receipts%rowtype;
 req jsonb; result jsonb; q jsonb; deleted boolean; qid uuid; source_id uuid; input_tags text[];
begin
 if uid is null then raise exception 'authentication_required' using errcode='42501'; end if;
 if mutation_id is null or base_revision is null or base_revision !~ '^[0-9]+$' or document is null or octet_length(document::text)>500000 then raise exception 'invalid_sync_request' using errcode='22023'; end if;
 sid:=(document->>'id')::uuid;
 if sid is null then raise exception 'id_required' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
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
 if jsonb_typeof(document->'tags') not in ('array','null') and document ? 'tags' then raise exception 'invalid_tags' using errcode='22023'; end if;
 if jsonb_typeof(document->'tags')='array' and exists(
   select 1 from jsonb_array_elements(document->'tags') value where jsonb_typeof(value)<>'string'
 ) then raise exception 'invalid_tags' using errcode='22023'; end if;
 select coalesce(array_agg(trim(value)),'{}') into input_tags
   from jsonb_array_elements_text(case when jsonb_typeof(document->'tags')='array' then document->'tags' else '[]'::jsonb end);
 if cardinality(input_tags)>10 or exists(select 1 from unnest(input_tags) t where length(t)=0 or length(t)>30)
   or (select count(distinct lower(t)) from unnest(input_tags) t)<>cardinality(input_tags)
   then raise exception 'invalid_tags' using errcode='22023'; end if;
 source_id:=nullif(document->>'sourceDocumentId','')::uuid;
 if not deleted and source_id is not null and not exists(
   select 1 from public.source_documents d where d.id=source_id and d.user_id=uid
 ) then raise exception 'source_not_owned' using errcode='42501'; end if;
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
 insert into public.question_sets(id,owner_id,title,subject,source_doc_id,tags,is_deleted,revision,updated_at)
 values(sid,uid,coalesce(document->>'title','Deleted'),coalesce(document->>'subject',''),source_id,input_tags,deleted,nextval('private.set_revision_seq'),clock_timestamp())
 on conflict(id) do update set title=excluded.title,subject=excluded.subject,source_doc_id=excluded.source_doc_id,
 tags=excluded.tags,is_deleted=excluded.is_deleted,revision=excluded.revision,updated_at=excluded.updated_at;
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
