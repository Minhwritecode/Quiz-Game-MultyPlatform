-- Additive migration: ELO rating on profiles, question moderation reports table,
-- and host session settings (read_time_sec, reactions_enabled) on rooms.

alter table public.profiles
  add column if not exists elo_rating integer not null default 1200
  check (elo_rating >= 100);

alter table public.rooms
  add column if not exists read_time_sec integer not null default 0
  check (read_time_sec between 0 and 15);

alter table public.rooms
  add column if not exists reactions_enabled boolean not null default true;

create table if not exists public.question_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  question_ref text not null,
  question_preview text not null default '',
  reason text not null check (reason in ('wrong_answer', 'typo_format', 'inappropriate', 'duplicate')),
  status text not null default 'open' check (status in ('open', 'reviewed', 'dismissed')),
  created_at timestamptz not null default now()
);

alter table public.question_reports enable row level security;

drop policy if exists "users create own question reports" on public.question_reports;
create policy "users create own question reports"
  on public.question_reports
  for insert to authenticated
  with check (auth.uid() = reporter_id);

drop policy if exists "users read own question reports" on public.question_reports;
create policy "users read own question reports"
  on public.question_reports
  for select to authenticated
  using (auth.uid() = reporter_id);
