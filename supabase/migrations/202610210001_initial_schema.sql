create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Learner',
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.source_documents (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  ocr_text text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.question_sets (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  subject text not null default '',
  source_doc_id uuid references public.source_documents(id) on delete set null,
  visibility text not null default 'private' check (visibility in ('private', 'shared')),
  updated_at timestamptz not null default now(),
  is_deleted boolean not null default false
);

create table if not exists public.questions (
  id uuid primary key,
  set_id uuid not null references public.question_sets(id) on delete cascade,
  content text not null,
  options jsonb not null check (jsonb_array_length(options) = 4),
  correct_index smallint not null check (correct_index between 0 and 3),
  explanation text not null default '',
  position integer not null,
  updated_at timestamptz not null default now(),
  is_deleted boolean not null default false
);

create table if not exists public.attempts (
  id uuid primary key,
  set_id uuid not null references public.question_sets(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  score integer not null default 0,
  total integer not null default 0,
  duration_ms integer not null default 0,
  started_at timestamptz not null,
  finished_at timestamptz,
  sync_status text not null default 'synced'
);

create table if not exists public.attempt_answers (
  id uuid primary key,
  attempt_id uuid not null references public.attempts(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  chosen_index smallint,
  is_correct boolean not null,
  time_ms integer not null default 0
);

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  host_id uuid not null references auth.users(id) on delete cascade,
  set_id uuid not null references public.question_sets(id) on delete restrict,
  mode text not null default 'speed' check (mode in ('speed', 'survival')),
  status text not null default 'waiting' check (status in ('waiting', 'countdown', 'question_open', 'question_result', 'finished')),
  question_count integer not null check (question_count > 0),
  seconds_per_question integer not null check (seconds_per_question between 5 and 120),
  started_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.room_players (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  score integer not null default 0,
  lives smallint not null default 3,
  joined_at timestamptz not null default now(),
  connected boolean not null default true,
  primary key (room_id, user_id)
);

create table if not exists public.room_questions (
  room_id uuid not null references public.rooms(id) on delete cascade,
  position integer not null,
  question_snapshot jsonb not null,
  opens_at timestamptz not null,
  closes_at timestamptz not null,
  primary key (room_id, position)
);

create table if not exists public.room_answers (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  position integer not null,
  chosen_index smallint not null check (chosen_index between 0 and 3),
  answered_at timestamptz not null default now(),
  points integer not null default 0,
  primary key (room_id, user_id, position)
);

create table if not exists public.sync_queue (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  entity text not null,
  entity_id text not null,
  operation text not null check (operation in ('insert', 'update', 'delete')),
  payload jsonb not null,
  retry_count integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.source_documents enable row level security;
alter table public.question_sets enable row level security;
alter table public.questions enable row level security;
alter table public.attempts enable row level security;
alter table public.attempt_answers enable row level security;
alter table public.rooms enable row level security;
alter table public.room_players enable row level security;
alter table public.room_questions enable row level security;
alter table public.room_answers enable row level security;
alter table public.sync_queue enable row level security;

create policy "profiles are readable" on public.profiles for select using (true);
create policy "users manage own profile" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "users manage own source documents" on public.source_documents for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "owners manage question sets" on public.question_sets for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "read shared question sets" on public.question_sets for select using (visibility = 'shared' or auth.uid() = owner_id);
create policy "question access follows set" on public.questions for all using (exists (select 1 from public.question_sets qs where qs.id = set_id and qs.owner_id = auth.uid())) with check (exists (select 1 from public.question_sets qs where qs.id = set_id and qs.owner_id = auth.uid()));
create policy "users manage own attempts" on public.attempts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users manage own attempt answers" on public.attempt_answers for all using (exists (select 1 from public.attempts a where a.id = attempt_id and a.user_id = auth.uid())) with check (exists (select 1 from public.attempts a where a.id = attempt_id and a.user_id = auth.uid()));
create policy "room members read rooms" on public.rooms for select using (auth.uid() = host_id or exists (select 1 from public.room_players rp where rp.room_id = id and rp.user_id = auth.uid()));
create policy "hosts create rooms" on public.rooms for insert with check (auth.uid() = host_id);
create policy "hosts update rooms" on public.rooms for update using (auth.uid() = host_id) with check (auth.uid() = host_id);
create policy "members read players" on public.room_players for select using (exists (select 1 from public.room_players member where member.room_id = room_id and member.user_id = auth.uid()));
create policy "users join rooms" on public.room_players for insert with check (auth.uid() = user_id);
create policy "users update own presence" on public.room_players for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "members read room questions" on public.room_questions for select using (exists (select 1 from public.room_players rp where rp.room_id = room_id and rp.user_id = auth.uid()));
create policy "members read own room answers" on public.room_answers for select using (auth.uid() = user_id);
create policy "users queue own changes" on public.sync_queue for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.submit_answer(p_room_id uuid, p_position integer, p_chosen_index smallint)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  current_question public.room_questions%rowtype;
  awarded integer := 0;
  remaining_ms integer;
begin
  select * into current_question from public.room_questions
  where room_id = p_room_id and position = p_position;
  if current_question.room_id is null or now() > current_question.closes_at then
    return 0;
  end if;
  if exists (select 1 from public.room_answers where room_id = p_room_id and user_id = current_user_id and position = p_position) then
    return 0;
  end if;
  remaining_ms := greatest(0, extract(epoch from (current_question.closes_at - now()))::integer * 1000);
  if (current_question.question_snapshot ->> 'correct_index')::integer = p_chosen_index then
    awarded := 1000 + least(500, (remaining_ms / 100));
  end if;
  insert into public.room_answers(room_id, user_id, position, chosen_index, points)
  values (p_room_id, current_user_id, p_position, p_chosen_index, awarded);
  update public.room_players set score = score + awarded where room_id = p_room_id and user_id = current_user_id;
  return awarded;
end;
$$;

grant execute on function public.submit_answer(uuid, integer, smallint) to authenticated;

