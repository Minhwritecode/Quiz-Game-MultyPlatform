-- Additive migration: Supabase pgvector RAG Knowledge Spaces, structure-aware document chunks,
-- AI generation runs with verified [S1]..[Sn] citations, and atomic AI token reserve/refund ledger.

create extension if not exists vector;

-- 1. Knowledge Spaces (per-user multi-document RAG folders)
create table if not exists public.knowledge_spaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 160),
  subject text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists knowledge_spaces_owner_idx
  on public.knowledge_spaces (owner_id, updated_at desc);

-- 2. Knowledge Documents (PDF/DOCX/MD/TXT/Note attached to a space with SHA-256 dedup)
create table if not exists public.knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.knowledge_spaces(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 240),
  kind text not null default 'note' check (kind in ('pdf', 'docx', 'md', 'txt', 'note')),
  content_sha256 text not null default '',
  raw_text text not null default '',
  excerpt text not null default '',
  chunk_count integer not null default 0 check (chunk_count >= 0),
  status text not null default 'ready' check (status in ('pending', 'indexing', 'ready', 'failed')),
  created_at timestamptz not null default now()
);

create index if not exists knowledge_documents_space_idx
  on public.knowledge_documents (space_id, created_at desc);

create unique index if not exists knowledge_documents_dedup_idx
  on public.knowledge_documents (space_id, content_sha256)
  where content_sha256 <> '';

-- 3. Knowledge Chunks (structure-aware chunks + 768-dim HNSW vector + GIN full-text index)
create table if not exists public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.knowledge_documents(id) on delete cascade,
  space_id uuid not null references public.knowledge_spaces(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  chunk_index integer not null check (chunk_index >= 0),
  heading_path text not null default '',
  page_number integer not null default 1 check (page_number >= 1),
  content text not null check (length(trim(content)) > 0),
  tsv tsvector generated always as (
    to_tsvector('simple', coalesce(heading_path, '') || ' ' || content)
  ) stored,
  embedding vector(768),
  created_at timestamptz not null default now()
);

create index if not exists knowledge_chunks_space_owner_idx
  on public.knowledge_chunks (space_id, owner_id, document_id, chunk_index);

create index if not exists knowledge_chunks_tsv_gin
  on public.knowledge_chunks using gin (tsv);

create index if not exists knowledge_chunks_embedding_hnsw
  on public.knowledge_chunks using hnsw (embedding vector_cosine_ops);

-- 4. AI Generation Runs (history + audit + per-run question editing before export)
create table if not exists public.generation_runs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  space_id uuid references public.knowledge_spaces(id) on delete set null,
  mode text not null default 'text' check (mode in ('text', 'topic', 'pdf', 'rag')),
  prompt text not null default '',
  difficulty text not null default 'medium' check (difficulty in ('easy', 'medium', 'hard')),
  language text not null default 'vi' check (language in ('vi', 'en')),
  provider text not null default 'gemini',
  model text not null default '',
  status text not null default 'pending' check (status in ('pending', 'completed', 'failed')),
  token_cost integer not null default 1 check (token_cost >= 0),
  questions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists generation_runs_owner_idx
  on public.generation_runs (owner_id, created_at desc);

-- 5. Grounded Question Citations ([S1]..[Sn] resolved server-side against chunks)
create table if not exists public.question_citations (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.generation_runs(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  question_index integer not null check (question_index >= 0),
  chunk_id uuid references public.knowledge_chunks(id) on delete set null,
  source_label text not null,
  document_name text not null,
  heading_path text not null default '',
  page_number integer not null default 1,
  excerpt text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists question_citations_run_idx
  on public.question_citations (run_id, question_index);

-- 6. AI Token Wallets & Ledger (atomic reserve / refund)
create table if not exists public.ai_token_wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance integer not null default 50 check (balance >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_token_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  delta integer not null,
  reason text not null,
  run_id uuid references public.generation_runs(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists ai_token_transactions_user_idx
  on public.ai_token_transactions (user_id, created_at desc);

-- Enable Row Level Security
alter table public.knowledge_spaces enable row level security;
alter table public.knowledge_documents enable row level security;
alter table public.knowledge_chunks enable row level security;
alter table public.generation_runs enable row level security;
alter table public.question_citations enable row level security;
alter table public.ai_token_wallets enable row level security;
alter table public.ai_token_transactions enable row level security;

-- Owner-scoped RLS policies
drop policy if exists "owners manage knowledge spaces" on public.knowledge_spaces;
create policy "owners manage knowledge spaces"
  on public.knowledge_spaces for all to authenticated
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "owners manage knowledge documents" on public.knowledge_documents;
create policy "owners manage knowledge documents"
  on public.knowledge_documents for all to authenticated
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "owners manage knowledge chunks" on public.knowledge_chunks;
create policy "owners manage knowledge chunks"
  on public.knowledge_chunks for all to authenticated
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "owners manage generation runs" on public.generation_runs;
create policy "owners manage generation runs"
  on public.generation_runs for all to authenticated
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "owners read own citations" on public.question_citations;
create policy "owners read own citations"
  on public.question_citations for all to authenticated
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "users read own ai token wallet" on public.ai_token_wallets;
create policy "users read own ai token wallet"
  on public.ai_token_wallets for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "users read own ai token ledger" on public.ai_token_transactions;
create policy "users read own ai token ledger"
  on public.ai_token_transactions for select to authenticated
  using (auth.uid() = user_id);

-- Wallet mutations must happen only via atomic security-definer RPCs
revoke insert, update, delete on public.ai_token_wallets, public.ai_token_transactions from anon, authenticated;

-- 7. Hybrid pgvector + full-text search RPC with section/heading locator filter + fallback
create or replace function public.search_knowledge_chunks(
  p_space_id uuid,
  p_query_embedding vector(768) default null,
  p_query_text text default '',
  p_heading_filter text default null,
  p_limit integer default 24
)
returns table (
  chunk_id uuid,
  document_id uuid,
  document_name text,
  heading_path text,
  page_number integer,
  content text,
  similarity double precision
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  uid uuid := auth.uid();
  lim integer := greatest(1, least(coalesce(p_limit, 24), 60));
  trimmed_heading text := nullif(trim(coalesce(p_heading_filter, '')), '');
  trimmed_query text := nullif(trim(coalesce(p_query_text, '')), '');
  matched_count integer := 0;
begin
  if uid is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  if not exists (
    select 1 from public.knowledge_spaces ks
    where ks.id = p_space_id and ks.owner_id = uid
  ) then
    raise exception 'knowledge_space_not_found' using errcode = '42501';
  end if;

  -- Try filtered search first when a heading locator is provided
  if trimmed_heading is not null then
    select count(*)::integer into matched_count
    from public.knowledge_chunks kc
    where kc.space_id = p_space_id
      and kc.owner_id = uid
      and kc.heading_path ilike '%' || trimmed_heading || '%';
  end if;

  return query
  select
    kc.id as chunk_id,
    kc.document_id,
    kd.name as document_name,
    kc.heading_path,
    kc.page_number,
    kc.content,
    (
      case
        when p_query_embedding is not null and kc.embedding is not null
          then (1.0 - (kc.embedding <=> p_query_embedding))::double precision
        else 0.0
      end
      +
      case
        when trimmed_query is not null
          then least(0.35, ts_rank_cd(kc.tsv, plainto_tsquery('simple', trimmed_query))::double precision)
        else 0.0
      end
    ) as similarity
  from public.knowledge_chunks kc
  join public.knowledge_documents kd on kd.id = kc.document_id
  where kc.space_id = p_space_id
    and kc.owner_id = uid
    and (
      matched_count = 0
      or trimmed_heading is null
      or kc.heading_path ilike '%' || trimmed_heading || '%'
    )
  order by similarity desc, kc.created_at desc, kc.chunk_index asc
  limit lim;
end;
$$;

-- 8. Atomic AI Token Reserve / Refund / Balance RPCs
create or replace function public.get_ai_token_balance()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  current_bal integer;
begin
  if uid is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  insert into public.ai_token_wallets (user_id, balance)
  values (uid, 50)
  on conflict (user_id) do nothing;

  select balance into current_bal from public.ai_token_wallets where user_id = uid;
  return coalesce(current_bal, 50);
end;
$$;

create or replace function public.reserve_ai_tokens(
  p_amount integer default 1,
  p_reason text default 'ai_generation'
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  amt integer := greatest(1, least(coalesce(p_amount, 1), 100));
  current_bal integer;
  next_bal integer;
begin
  if uid is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  insert into public.ai_token_wallets (user_id, balance)
  values (uid, 50)
  on conflict (user_id) do nothing;

  select balance into current_bal
  from public.ai_token_wallets
  where user_id = uid
  for update;

  if current_bal < amt then
    raise exception 'insufficient_ai_tokens' using errcode = 'P0001';
  end if;

  next_bal := current_bal - amt;
  update public.ai_token_wallets
  set balance = next_bal, updated_at = now()
  where user_id = uid;

  insert into public.ai_token_transactions (user_id, delta, reason)
  values (uid, -amt, coalesce(nullif(trim(p_reason), ''), 'ai_generation'));

  return next_bal;
end;
$$;

create or replace function public.refund_ai_tokens(
  p_amount integer default 1,
  p_reason text default 'ai_generation_refund',
  p_run_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  amt integer := greatest(1, least(coalesce(p_amount, 1), 100));
  next_bal integer;
begin
  if uid is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  insert into public.ai_token_wallets (user_id, balance)
  values (uid, 50)
  on conflict (user_id) do nothing;

  update public.ai_token_wallets
  set balance = balance + amt, updated_at = now()
  where user_id = uid
  returning balance into next_bal;

  insert into public.ai_token_transactions (user_id, delta, reason, run_id)
  values (uid, amt, coalesce(nullif(trim(p_reason), ''), 'ai_generation_refund'), p_run_id);

  return next_bal;
end;
$$;

revoke all on function public.search_knowledge_chunks(uuid, vector, text, text, integer) from public, anon;
revoke all on function public.get_ai_token_balance() from public, anon;
revoke all on function public.reserve_ai_tokens(integer, text) from public, anon;
revoke all on function public.refund_ai_tokens(integer, text, uuid) from public, anon;

grant execute on function public.search_knowledge_chunks(uuid, vector, text, text, integer),
  public.get_ai_token_balance(),
  public.reserve_ai_tokens(integer, text),
  public.refund_ai_tokens(integer, text, uuid) to authenticated;
