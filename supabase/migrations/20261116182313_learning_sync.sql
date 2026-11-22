-- Group B uses one revision stream for sources and completed attempts. Only RPCs
-- may mutate these tables as a client. Service-role maintenance must honor the
-- same owner lock and assign revisions (physical deletion is account cleanup only).
create sequence private.learning_revision_seq;
revoke all on sequence private.learning_revision_seq from public, anon, authenticated;

alter table public.source_documents
  add column revision bigint not null default 0,
  add column updated_at timestamptz not null default now(),
  add column is_deleted boolean not null default false,
  add column sync_envelope_extra jsonb not null default '{}',
  add column sync_payload_extra jsonb not null default '{}';
alter table public.attempts
  alter column score type numeric,
  alter column duration_ms type numeric,
  add column correct_count integer not null default 0,
  add column revision bigint not null default 0,
  add column updated_at timestamptz not null default now(),
  add column is_deleted boolean not null default false,
  add column sync_envelope_extra jsonb not null default '{}',
  add column sync_payload_extra jsonb not null default '{}';
alter table public.attempt_answers
  alter column time_ms type numeric,
  alter column chosen_index type integer,
  add column position integer not null default 0,
  add column sync_extra jsonb not null default '{}';
-- Preserve legacy rows and give every document a nonzero, globally unique cursor.
update public.source_documents set revision = nextval('private.learning_revision_seq'), updated_at = created_at;
update public.attempts a set revision = nextval('private.learning_revision_seq'),
  finished_at = coalesce(finished_at, started_at), updated_at = coalesce(finished_at, started_at),
  correct_count = (select count(*) from public.attempt_answers x where x.attempt_id = a.id and x.is_correct);
with ordered as (
  select id, row_number() over (partition by attempt_id order by id) - 1 as position from public.attempt_answers
) update public.attempt_answers a set position = o.position from ordered o where o.id = a.id;
create index source_documents_owner_revision on public.source_documents(user_id, revision);
create index attempts_owner_revision on public.attempts(user_id, revision);
create index attempts_set_id on public.attempts(set_id);
create index attempt_answers_attempt_position on public.attempt_answers(attempt_id, position);
create index attempt_answers_question_id on public.attempt_answers(question_id);

create table private.learning_sync_receipts (
  owner_id uuid not null references auth.users(id) on delete cascade,
  mutation_id uuid not null,
  request jsonb not null,
  result jsonb not null,
  primary key (owner_id, mutation_id)
);
alter table private.learning_sync_receipts enable row level security;
revoke all on private.learning_sync_receipts from public, anon, authenticated;

-- Reconstruct known fields from normalized rows; retain forward-compatible extras.
create function private.learning_document(owner uuid, kind text, target uuid) returns jsonb
language sql stable set search_path = '' as $$
  select s.sync_envelope_extra || jsonb_build_object(
    'entity', 'source_documents', 'id', s.id, 'revision', s.revision::text,
    'updatedAt', s.updated_at, 'deleted', s.is_deleted,
    'payload', s.sync_payload_extra || jsonb_build_object('id', s.id, 'title', s.title, 'text', s.ocr_text, 'createdAt', s.created_at))
  from public.source_documents s where kind = 'source_documents' and s.id = target and s.user_id = owner
  union all
  select a.sync_envelope_extra || jsonb_build_object(
    'entity', 'attempts', 'id', a.id, 'revision', a.revision::text,
    'updatedAt', a.updated_at, 'deleted', a.is_deleted,
    'payload', a.sync_payload_extra || jsonb_build_object(
      'id', a.id, 'questionSetId', a.set_id, 'score', a.score, 'correctCount', a.correct_count,
      'total', a.total, 'startedAt', a.started_at, 'finishedAt', a.finished_at, 'status', 'completed',
      'answers', coalesce((select jsonb_agg(x.sync_extra || jsonb_build_object(
        'questionId', x.question_id, 'chosenIndex', x.chosen_index, 'isCorrect', x.is_correct, 'timeMs', x.time_ms)
        order by x.position, x.id) from public.attempt_answers x where x.attempt_id = a.id), '[]'::jsonb)))
  from public.attempts a where kind = 'attempts' and a.id = target and a.user_id = owner;
$$;
revoke all on function private.learning_document(uuid,text,uuid) from public, anon, authenticated;

create function private.sync_push_learning(mutation_id uuid, base_revision text, entity text, document jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid(); target uuid; row_owner uuid; current_revision bigint;
  receipt private.learning_sync_receipts%rowtype; req jsonb; result jsonb; payload jsonb;
  answer jsonb; target_set_id uuid; qid uuid; deleted boolean; new_revision bigint;
  stamp timestamptz; created timestamptz; started timestamptz; finished timestamptz;
  envelope_extra jsonb; payload_extra jsonb; ordinal integer := 0;
begin
  if uid is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if mutation_id is null or base_revision is null or base_revision !~ '^[0-9]+$'
    or length(base_revision) > 19 or base_revision::numeric > 9223372036854775807
    or entity is null or entity not in ('source_documents', 'attempts')
    or jsonb_typeof(document) is distinct from 'object' or octet_length(document::text) > 1000000
    or document->>'entity' is distinct from entity
    or jsonb_typeof(document->'id') is distinct from 'string'
    or jsonb_typeof(document->'revision') is distinct from 'string'
    or coalesce(document->>'revision','') !~ '^[0-9]+$'
    or jsonb_typeof(document->'updatedAt') is distinct from 'string'
    or jsonb_typeof(document->'deleted') is distinct from 'boolean'
    or jsonb_typeof(document->'payload') is distinct from 'object'
    or document->>'id' is distinct from document->'payload'->>'id'
    then raise exception 'invalid_sync_request' using errcode = '22023'; end if;
  target := (document->>'id')::uuid;
  payload := document->'payload';
  deleted := (document->>'deleted')::boolean;
  -- Same owner lock as Group A: revision allocation cannot outrun a pending commit.
  perform pg_advisory_xact_lock(hashtextextended(uid::text, 0));
  -- Serialize competing first inserts by different accounts, before ownership lookup.
  perform pg_advisory_xact_lock(hashtextextended(entity || ':' || target::text, 2));
  req := jsonb_build_object('base', base_revision, 'entity', entity, 'document', document);
  select * into receipt from private.learning_sync_receipts r
    where r.owner_id = uid and r.mutation_id = sync_push_learning.mutation_id;
  if found then
    if receipt.request <> req then raise exception 'mutation_reused' using errcode = '22023'; end if;
    return receipt.result;
  end if;
  if entity = 'source_documents' then
    select s.user_id, s.revision into row_owner, current_revision from public.source_documents s where s.id = target for update;
  else
    select a.user_id, a.revision into row_owner, current_revision from public.attempts a where a.id = target for update;
  end if;
  if row_owner is not null and row_owner <> uid then raise exception 'not_owner' using errcode = '42501'; end if;
  if current_revision is null and base_revision::bigint <> 0 then
    -- There is no valid server document to return for an unknown nonzero base.
    raise exception 'unknown_base_revision' using errcode = '22023';
  end if;
  if current_revision is not null and current_revision <> base_revision::bigint then
    result := jsonb_build_object('conflict', true, 'document', private.learning_document(uid, entity, target));
    insert into private.learning_sync_receipts values (uid, mutation_id, req, result);
    return result;
  end if;
  envelope_extra := document - array['entity','id','revision','updatedAt','deleted','payload'];
  stamp := clock_timestamp();
  if entity = 'source_documents' then
    if jsonb_typeof(payload->'title') is distinct from 'string'
      or jsonb_typeof(payload->'text') is distinct from 'string'
      or jsonb_typeof(payload->'createdAt') is distinct from 'string'
      then raise exception 'invalid_source' using errcode = '22023'; end if;
    created := (payload->>'createdAt')::timestamptz;
    if not isfinite(created) then raise exception 'invalid_timestamp' using errcode = '22023'; end if;
    payload_extra := payload - array['id','title','text','createdAt'];
    new_revision := nextval('private.learning_revision_seq');
    insert into public.source_documents(id,user_id,title,ocr_text,created_at,revision,updated_at,is_deleted,sync_envelope_extra,sync_payload_extra)
    values(target,uid,payload->>'title',payload->>'text',created,new_revision,stamp,deleted,envelope_extra,payload_extra)
    on conflict(id) do update set title=excluded.title,ocr_text=excluded.ocr_text,created_at=excluded.created_at,
      revision=excluded.revision,updated_at=excluded.updated_at,is_deleted=excluded.is_deleted,
      sync_envelope_extra=excluded.sync_envelope_extra,sync_payload_extra=excluded.sync_payload_extra
    where public.source_documents.user_id=uid;
    if not found then raise exception 'not_owner' using errcode = '42501'; end if;
  else
    if jsonb_typeof(payload->'questionSetId') is distinct from 'string'
      or jsonb_typeof(payload->'score') is distinct from 'number'
      or jsonb_typeof(payload->'correctCount') is distinct from 'number'
      or coalesce(payload->>'correctCount','') !~ '^[0-9]+$'
      or jsonb_typeof(payload->'total') is distinct from 'number'
      or coalesce(payload->>'total','') !~ '^[0-9]+$'
      or jsonb_typeof(payload->'startedAt') is distinct from 'string'
      or jsonb_typeof(payload->'finishedAt') is distinct from 'string'
      or payload->>'status' is distinct from 'completed'
      or jsonb_typeof(payload->'answers') is distinct from 'array'
      then raise exception 'invalid_attempt' using errcode = '22023'; end if;
    target_set_id := (payload->>'questionSetId')::uuid;
    started := (payload->>'startedAt')::timestamptz;
    finished := (payload->>'finishedAt')::timestamptz;
    if not isfinite(started) or not isfinite(finished) then raise exception 'invalid_timestamp' using errcode = '22023'; end if;
    -- Completed offline history may reference soft-deleted sets/questions.
    -- Shared visibility is not permission to attach another account's data.
    perform 1 from public.question_sets s where s.id=target_set_id and s.owner_id=uid for key share;
    if not found then raise exception 'set_not_owned' using errcode = '42501'; end if;
    for answer in select value from jsonb_array_elements(payload->'answers') loop
      if jsonb_typeof(answer) is distinct from 'object'
        or jsonb_typeof(answer->'questionId') is distinct from 'string'
        or (jsonb_typeof(answer->'chosenIndex') is distinct from 'null' and
          (jsonb_typeof(answer->'chosenIndex') is distinct from 'number' or coalesce(answer->>'chosenIndex','') !~ '^[0-9]+$'))
        or jsonb_typeof(answer->'isCorrect') is distinct from 'boolean'
        or jsonb_typeof(answer->'timeMs') is distinct from 'number'
        or (answer->>'timeMs')::numeric < 0
        then raise exception 'invalid_answer' using errcode = '22023'; end if;
      qid := (answer->>'questionId')::uuid;
      perform 1 from public.questions q where q.id=qid and q.set_id=target_set_id for key share;
      if not found then raise exception 'question_not_in_owned_set' using errcode = '42501'; end if;
    end loop;
    payload_extra := payload - array['id','questionSetId','score','correctCount','total','startedAt','finishedAt','status','answers'];
    new_revision := nextval('private.learning_revision_seq');
    insert into public.attempts(id,set_id,user_id,score,correct_count,total,duration_ms,started_at,finished_at,sync_status,
      revision,updated_at,is_deleted,sync_envelope_extra,sync_payload_extra)
    values(target,target_set_id,uid,(payload->>'score')::numeric,(payload->>'correctCount')::integer,(payload->>'total')::integer,
      (select coalesce(sum((x->>'timeMs')::numeric),0) from jsonb_array_elements(payload->'answers') x),
      started,finished,'synced',new_revision,stamp,deleted,envelope_extra,payload_extra)
    on conflict(id) do update set set_id=excluded.set_id,score=excluded.score,correct_count=excluded.correct_count,
      total=excluded.total,duration_ms=excluded.duration_ms,started_at=excluded.started_at,finished_at=excluded.finished_at,
      sync_status=excluded.sync_status,revision=excluded.revision,updated_at=excluded.updated_at,is_deleted=excluded.is_deleted,
      sync_envelope_extra=excluded.sync_envelope_extra,sync_payload_extra=excluded.sync_payload_extra
    where public.attempts.user_id=uid;
    if not found then raise exception 'not_owner' using errcode = '42501'; end if;
    delete from public.attempt_answers a where a.attempt_id=target;
    for answer in select value from jsonb_array_elements(payload->'answers') loop
      insert into public.attempt_answers(id,attempt_id,question_id,chosen_index,is_correct,time_ms,position,sync_extra)
      values(gen_random_uuid(),target,(answer->>'questionId')::uuid,(answer->>'chosenIndex')::integer,
        (answer->>'isCorrect')::boolean,(answer->>'timeMs')::numeric,ordinal,
        answer - array['questionId','chosenIndex','isCorrect','timeMs']);
      ordinal := ordinal + 1;
    end loop;
  end if;
  result := jsonb_build_object('conflict',false,'document',private.learning_document(uid,entity,target));
  insert into private.learning_sync_receipts values(uid,mutation_id,req,result);
  return result;
end;
$$;

create function private.sync_pull_learning(after_revision text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); docs jsonb; cursor text; more boolean;
begin
  if uid is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if after_revision is null or after_revision !~ '^[0-9]+$' or length(after_revision)>19
    or after_revision::numeric>9223372036854775807 then raise exception 'invalid_cursor' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
  with candidates as materialized (
    select s.id,s.revision,'source_documents'::text as entity from public.source_documents s
      where s.user_id=uid and s.revision>after_revision::bigint
    union all
    select a.id,a.revision,'attempts'::text from public.attempts a
      where a.user_id=uid and a.revision>after_revision::bigint
    order by revision limit 101
  ), page as (select * from candidates order by revision limit 100)
  select coalesce(jsonb_agg(private.learning_document(uid,p.entity,p.id) order by p.revision),'[]'::jsonb),
    coalesce(max(p.revision)::text,after_revision), (select count(*)>100 from candidates)
    into docs,cursor,more from page p;
  return jsonb_build_object('documents',docs,'cursor',cursor,'hasMore',more);
end;
$$;

-- Definer implementations stay in the unexposed schema. Public RPCs are invokers.
create function public.sync_push_learning(mutation_id uuid, base_revision text, entity text, document jsonb)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.sync_push_learning(mutation_id,base_revision,entity,document);
$$;
create function public.sync_pull_learning(after_revision text default '0')
returns jsonb language sql security invoker set search_path = '' as $$
  select private.sync_pull_learning(after_revision);
$$;
revoke all on function private.sync_push_learning(uuid,text,text,jsonb), private.sync_pull_learning(text),
  public.sync_push_learning(uuid,text,text,jsonb), public.sync_pull_learning(text) from public,anon,authenticated;
grant execute on function private.sync_push_learning(uuid,text,text,jsonb), private.sync_pull_learning(text),
  public.sync_push_learning(uuid,text,text,jsonb), public.sync_pull_learning(text) to authenticated;
revoke insert,update,delete,truncate,references,trigger on public.source_documents,public.attempts,public.attempt_answers
  from public,anon,authenticated;
revoke select on public.source_documents,public.attempts,public.attempt_answers from public,anon;
grant select on public.source_documents,public.attempts,public.attempt_answers to authenticated;
