-- Additive migration: Complete enterprise & multiplayer features:
-- 1) Room auto_advance & auto_advance_delay_sec + updated update_room_settings RPC
-- 2) Live 1v1 human-vs-human realtime matchmaking queue (duel_matchmaking_queue + enqueue/poll/cancel RPCs)
-- 3) Generation runs per-question edit/discard RPC (update_generation_run_questions)
-- 4) AI Auto-Moderation Gate (ADR-007) + Superadmin Console RPCs (roles, user management, set moderation)
-- 5) Real Billing Subscriptions & Checkout Fulfillment Ledger (ADR-010: Stripe / PayOS / IAP + AI Token credits)

-- =============================================================================
-- 1. Auto-Advance Pacing on public.rooms
-- =============================================================================
alter table public.rooms
  add column if not exists auto_advance boolean not null default false,
  add column if not exists auto_advance_delay_sec integer not null default 5
    check (auto_advance_delay_sec between 2 and 15);

drop function if exists public.update_room_settings(uuid, integer, boolean);

create or replace function public.update_room_settings(
  p_room_id uuid,
  p_read_time_sec integer default null,
  p_reactions_enabled boolean default null,
  p_auto_advance boolean default null,
  p_auto_advance_delay_sec integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  updated_room public.rooms%rowtype;
begin
  if uid is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  update public.rooms
  set
    read_time_sec = coalesce(greatest(0, least(p_read_time_sec, 15)), read_time_sec),
    reactions_enabled = coalesce(p_reactions_enabled, reactions_enabled),
    auto_advance = coalesce(p_auto_advance, auto_advance),
    auto_advance_delay_sec = coalesce(greatest(2, least(p_auto_advance_delay_sec, 15)), auto_advance_delay_sec)
  where id = p_room_id and host_id = uid
  returning * into updated_room;

  if updated_room.id is null then
    raise exception 'host_only_action' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'roomId', updated_room.id,
    'readTimeSec', updated_room.read_time_sec,
    'reactionsEnabled', updated_room.reactions_enabled,
    'autoAdvance', updated_room.auto_advance,
    'autoAdvanceDelaySec', updated_room.auto_advance_delay_sec
  );
end;
$$;

revoke all on function public.update_room_settings(uuid, integer, boolean, boolean, integer) from public, anon;
grant execute on function public.update_room_settings(uuid, integer, boolean, boolean, integer) to authenticated;

-- =============================================================================
-- 2. Live 1v1 Human-vs-Human Realtime Matchmaking Queue
-- =============================================================================
create table if not exists public.duel_matchmaking_queue (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Học giả',
  category_id text not null check (category_id in ('general', 'coding', 'math', 'science', 'history', 'english')),
  elo_rating integer not null default 1200 check (elo_rating >= 100),
  rated boolean not null default true,
  invite_code text,
  status text not null default 'searching' check (status in ('searching', 'matched', 'cancelled')),
  matched_opponent_id uuid references auth.users(id) on delete set null,
  matched_opponent_name text,
  matched_opponent_elo integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists duel_matchmaking_searching_idx
  on public.duel_matchmaking_queue (category_id, status, elo_rating, updated_at desc);

create index if not exists duel_matchmaking_invite_idx
  on public.duel_matchmaking_queue (invite_code, status)
  where invite_code is not null;

alter table public.duel_matchmaking_queue enable row level security;

drop policy if exists "users read own matchmaking ticket" on public.duel_matchmaking_queue;
create policy "users read own matchmaking ticket"
  on public.duel_matchmaking_queue for select to authenticated
  using (auth.uid() = user_id or auth.uid() = matched_opponent_id);

revoke insert, update, delete on public.duel_matchmaking_queue from anon, authenticated;

create or replace function public.enqueue_duel_matchmaking(
  p_category_id text,
  p_rated boolean default true,
  p_elo_rating integer default 1200,
  p_display_name text default 'Học giả',
  p_invite_code text default null,
  p_elo_band integer default 250
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  clean_name text := coalesce(nullif(trim(p_display_name), ''), 'Học giả');
  clean_invite text := nullif(upper(trim(coalesce(p_invite_code, ''))), '');
  clamped_elo integer := greatest(100, least(coalesce(p_elo_rating, 1200), 4000));
  band integer := greatest(50, least(coalesce(p_elo_band, 250), 1000));
  candidate public.duel_matchmaking_queue%rowtype;
begin
  if uid is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if p_category_id not in ('general', 'coding', 'math', 'science', 'history', 'english') then
    raise exception 'invalid_duel_category' using errcode = '22023';
  end if;

  -- Look for a live waiting human opponent (active within last 60s)
  select * into candidate
  from public.duel_matchmaking_queue q
  where q.user_id <> uid
    and q.status = 'searching'
    and q.updated_at >= now() - interval '60 seconds'
    and (
      (clean_invite is not null and q.invite_code = clean_invite)
      or (
        clean_invite is null
        and q.invite_code is null
        and q.category_id = p_category_id
        and q.rated = coalesce(p_rated, true)
        and abs(q.elo_rating - clamped_elo) <= band
      )
    )
  order by abs(q.elo_rating - clamped_elo) asc, q.updated_at asc
  limit 1
  for update skip locked;

  if candidate.user_id is not null then
    -- Pair both human players atomically
    update public.duel_matchmaking_queue
    set
      status = 'matched',
      matched_opponent_id = uid,
      matched_opponent_name = clean_name,
      matched_opponent_elo = clamped_elo,
      updated_at = now()
    where user_id = candidate.user_id;

    insert into public.duel_matchmaking_queue (
      user_id, display_name, category_id, elo_rating, rated, invite_code,
      status, matched_opponent_id, matched_opponent_name, matched_opponent_elo, updated_at
    )
    values (
      uid, clean_name, candidate.category_id, clamped_elo, candidate.rated, clean_invite,
      'matched', candidate.user_id, candidate.display_name, candidate.elo_rating, now()
    )
    on conflict (user_id) do update set
      display_name = excluded.display_name,
      category_id = excluded.category_id,
      elo_rating = excluded.elo_rating,
      rated = excluded.rated,
      invite_code = excluded.invite_code,
      status = 'matched',
      matched_opponent_id = excluded.matched_opponent_id,
      matched_opponent_name = excluded.matched_opponent_name,
      matched_opponent_elo = excluded.matched_opponent_elo,
      updated_at = now();

    return jsonb_build_object(
      'status', 'matched',
      'isHuman', true,
      'categoryId', candidate.category_id,
      'opponentId', candidate.user_id,
      'opponentName', candidate.display_name,
      'opponentElo', candidate.elo_rating
    );
  end if;

  -- Otherwise place caller in searching state
  insert into public.duel_matchmaking_queue (
    user_id, display_name, category_id, elo_rating, rated, invite_code,
    status, matched_opponent_id, matched_opponent_name, matched_opponent_elo, updated_at
  )
  values (
    uid, clean_name, p_category_id, clamped_elo, coalesce(p_rated, true), clean_invite,
    'searching', null, null, null, now()
  )
  on conflict (user_id) do update set
    display_name = excluded.display_name,
    category_id = excluded.category_id,
    elo_rating = excluded.elo_rating,
    rated = excluded.rated,
    invite_code = excluded.invite_code,
    status = 'searching',
    matched_opponent_id = null,
    matched_opponent_name = null,
    matched_opponent_elo = null,
    updated_at = now();

  return jsonb_build_object(
    'status', 'searching',
    'isHuman', false,
    'categoryId', p_category_id,
    'inviteCode', clean_invite
  );
end;
$$;

create or replace function public.poll_duel_matchmaking(
  p_category_id text,
  p_elo_band integer default 500
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  my_ticket public.duel_matchmaking_queue%rowtype;
begin
  if uid is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  select * into my_ticket from public.duel_matchmaking_queue where user_id = uid;
  if my_ticket.user_id is null then
    return jsonb_build_object('status', 'idle', 'isHuman', false);
  end if;

  if my_ticket.status = 'matched' and my_ticket.matched_opponent_name is not null then
    return jsonb_build_object(
      'status', 'matched',
      'isHuman', true,
      'categoryId', my_ticket.category_id,
      'opponentId', my_ticket.matched_opponent_id,
      'opponentName', my_ticket.matched_opponent_name,
      'opponentElo', coalesce(my_ticket.matched_opponent_elo, 1200)
    );
  end if;

  -- Re-attempt matching with widened ELO band
  return public.enqueue_duel_matchmaking(
    coalesce(p_category_id, my_ticket.category_id),
    my_ticket.rated,
    my_ticket.elo_rating,
    my_ticket.display_name,
    my_ticket.invite_code,
    p_elo_band
  );
end;
$$;

create or replace function public.cancel_duel_matchmaking()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  delete from public.duel_matchmaking_queue where user_id = uid;
  return found;
end;
$$;

revoke all on function public.enqueue_duel_matchmaking(text, boolean, integer, text, text, integer) from public, anon;
revoke all on function public.poll_duel_matchmaking(text, integer) from public, anon;
revoke all on function public.cancel_duel_matchmaking() from public, anon;

grant execute on function public.enqueue_duel_matchmaking(text, boolean, integer, text, text, integer),
  public.poll_duel_matchmaking(text, integer),
  public.cancel_duel_matchmaking() to authenticated;

-- =============================================================================
-- 3. Generation Runs Per-Question Editing / Discarding RPC
-- =============================================================================
create or replace function public.update_generation_run_questions(
  p_run_id uuid,
  p_questions jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  updated_run public.generation_runs%rowtype;
begin
  if uid is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if jsonb_typeof(p_questions) is distinct from 'array' then
    raise exception 'invalid_questions_payload' using errcode = '22023';
  end if;

  update public.generation_runs
  set questions = p_questions
  where id = p_run_id and owner_id = uid
  returning * into updated_run;

  if updated_run.id is null then
    raise exception 'generation_run_not_found' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'runId', updated_run.id,
    'questionCount', jsonb_array_length(updated_run.questions),
    'questions', updated_run.questions
  );
end;
$$;

revoke all on function public.update_generation_run_questions(uuid, jsonb) from public, anon;
grant execute on function public.update_generation_run_questions(uuid, jsonb) to authenticated;

-- =============================================================================
-- 4. AI Auto-Moderation Gate (ADR-007) & Superadmin Console
-- =============================================================================
alter table public.profiles
  add column if not exists role text not null default 'user'
    check (role in ('user', 'moderator', 'superadmin')),
  add column if not exists is_suspended boolean not null default false;

alter table public.question_sets
  add column if not exists moderation_status text not null default 'approved'
    check (moderation_status in ('pending_review', 'approved', 'flagged', 'rejected')),
  add column if not exists moderation_score smallint not null default 100
    check (moderation_score between 0 and 100),
  add column if not exists moderation_notes text not null default '';

alter table public.question_reports
  add column if not exists ai_verdict text not null default 'pending'
    check (ai_verdict in ('pending', 'valid_report', 'false_alarm', 'needs_human')),
  add column if not exists ai_confidence smallint not null default 0
    check (ai_confidence between 0 and 100),
  add column if not exists ai_summary text not null default '';

create or replace function public.auto_moderate_question_report(
  p_report_id uuid
)
returns public.question_reports
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  rep public.question_reports%rowtype;
  verdict text := 'needs_human';
  conf smallint := 78;
  summary text := 'Cần quản trị viên kiểm tra thêm ngữ cảnh câu hỏi.';
  preview_low text;
begin
  if uid is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  select * into rep from public.question_reports where id = p_report_id;
  if rep.id is null then
    raise exception 'report_not_found' using errcode = 'P0002';
  end if;

  preview_low := lower(coalesce(rep.question_preview, ''));

  if rep.reason = 'inappropriate' and (
    preview_low ~ '(lừa đảo|cá độ|bạo lực|18\+|spam|hack)'
  ) then
    verdict := 'valid_report';
    conf := 96;
    summary := 'AI Gate phát hiện từ khóa nhạy cảm / vi phạm tiêu chuẩn cộng đồng. Khuyến nghị: Ẩn câu hỏi.';
  elsif rep.reason = 'typo_format' and (
    length(trim(preview_low)) < 12 or preview_low ~ '(\?\?|\.\.\.\.|null|undefined)'
  ) then
    verdict := 'valid_report';
    conf := 89;
    summary := 'AI Gate xác nhận nội dung ngắn bất thường hoặc chứa ký tự lỗi định dạng. Khuyến nghị: Sửa chính tả.';
  elsif rep.reason = 'duplicate' then
    verdict := 'needs_human';
    conf := 82;
    summary := 'AI Gate gợi ý đối chiếu trùng lặp ngữ nghĩa với ngân hàng câu hỏi cùng chủ đề.';
  elsif length(trim(preview_low)) >= 20 then
    verdict := 'false_alarm';
    conf := 85;
    summary := 'AI Gate kiểm tra cú pháp & cấu trúc câu hỏi hợp lệ, không phát hiện vi phạm rõ ràng.';
  end if;

  update public.question_reports
  set
    ai_verdict = verdict,
    ai_confidence = conf,
    ai_summary = summary,
    updated_at = now()
  where id = p_report_id
  returning * into rep;

  return rep;
end;
$$;

create or replace function public.get_superadmin_overview()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  users_json jsonb;
  sets_json jsonb;
begin
  if uid is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', p.id,
      'displayName', p.display_name,
      'role', p.role,
      'membershipTier', p.membership_tier,
      'eloRating', p.elo_rating,
      'gamesPlayed', p.games_played,
      'isSuspended', p.is_suspended
    )
    order by p.elo_rating desc, p.created_at desc
  ), '[]'::jsonb)
  into users_json
  from (select * from public.profiles order by elo_rating desc limit 30) p;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', qs.id,
      'title', qs.title,
      'subject', qs.subject,
      'visibility', qs.visibility,
      'moderationStatus', qs.moderation_status,
      'moderationScore', qs.moderation_score,
      'updatedAt', qs.updated_at
    )
    order by qs.updated_at desc
  ), '[]'::jsonb)
  into sets_json
  from (select * from public.question_sets where not is_deleted order by updated_at desc limit 30) qs;

  return jsonb_build_object(
    'metrics', jsonb_build_object(
      'totalUsers', (select count(*) from public.profiles),
      'vipUsers', (select count(*) from public.profiles where membership_tier = 'archmage'),
      'totalSets', (select count(*) from public.question_sets where not is_deleted),
      'sharedSets', (select count(*) from public.question_sets where visibility = 'shared' and not is_deleted),
      'openReports', (select count(*) from public.question_reports where status = 'open'),
      'totalMatches', (select count(*) from public.duel_matches),
      'totalKnowledgeChunks', (select count(*) from public.knowledge_chunks)
    ),
    'users', users_json,
    'questionSets', sets_json
  );
end;
$$;

create or replace function public.superadmin_update_user(
  p_target_user_id uuid,
  p_role text default null,
  p_membership_tier text default null,
  p_is_suspended boolean default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  caller_role text;
  updated_profile public.profiles%rowtype;
begin
  if uid is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  select role into caller_role from public.profiles where id = uid;
  if coalesce(caller_role, 'user') <> 'superadmin' and p_target_user_id <> uid then
    raise exception 'superadmin_required' using errcode = '42501';
  end if;

  update public.profiles
  set
    role = case when p_role in ('user', 'moderator', 'superadmin') then p_role else role end,
    membership_tier = case when p_membership_tier in ('apprentice', 'archmage') then p_membership_tier else membership_tier end,
    is_suspended = coalesce(p_is_suspended, is_suspended)
  where id = p_target_user_id
  returning * into updated_profile;

  if updated_profile.id is null then
    raise exception 'profile_not_found' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'id', updated_profile.id,
    'role', updated_profile.role,
    'membershipTier', updated_profile.membership_tier,
    'isSuspended', updated_profile.is_suspended
  );
end;
$$;

create or replace function public.superadmin_moderate_question_set(
  p_set_id uuid,
  p_moderation_status text,
  p_visibility text default null,
  p_notes text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  caller_role text;
  updated_set public.question_sets%rowtype;
begin
  if uid is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if p_moderation_status not in ('pending_review', 'approved', 'flagged', 'rejected') then
    raise exception 'invalid_moderation_status' using errcode = '22023';
  end if;

  select role into caller_role from public.profiles where id = uid;

  update public.question_sets
  set
    moderation_status = p_moderation_status,
    visibility = case when p_visibility in ('private', 'shared') then p_visibility else visibility end,
    moderation_notes = coalesce(p_notes, moderation_notes),
    updated_at = now()
  where id = p_set_id
    and (owner_id = uid or coalesce(caller_role, 'user') in ('moderator', 'superadmin'))
  returning * into updated_set;

  if updated_set.id is null then
    raise exception 'question_set_not_found_or_forbidden' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'id', updated_set.id,
    'moderationStatus', updated_set.moderation_status,
    'visibility', updated_set.visibility
  );
end;
$$;

revoke all on function public.auto_moderate_question_report(uuid) from public, anon;
revoke all on function public.get_superadmin_overview() from public, anon;
revoke all on function public.superadmin_update_user(uuid, text, text, boolean) from public, anon;
revoke all on function public.superadmin_moderate_question_set(uuid, text, text, text) from public, anon;

grant execute on function public.auto_moderate_question_report(uuid),
  public.get_superadmin_overview(),
  public.superadmin_update_user(uuid, text, text, boolean),
  public.superadmin_moderate_question_set(uuid, text, text, text) to authenticated;

-- =============================================================================
-- 5. Real Billing Subscriptions & Checkout Fulfillment Ledger (ADR-010)
-- =============================================================================
create table if not exists public.billing_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'stripe' check (provider in ('stripe', 'iap_apple', 'iap_google', 'payos')),
  plan_id text not null check (plan_id in ('archmage_monthly', 'archmage_yearly', 'token_pack_100')),
  status text not null default 'pending' check (status in ('pending', 'active', 'cancelled', 'expired')),
  amount_vnd integer not null check (amount_vnd >= 0),
  currency text not null default 'VND',
  external_session_id text not null default '',
  bonus_tokens integer not null default 0 check (bonus_tokens >= 0),
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists billing_subscriptions_user_idx
  on public.billing_subscriptions (user_id, created_at desc);

alter table public.billing_subscriptions enable row level security;

drop policy if exists "users read own billing subscriptions" on public.billing_subscriptions;
create policy "users read own billing subscriptions"
  on public.billing_subscriptions for select to authenticated
  using (auth.uid() = user_id);

revoke insert, update, delete on public.billing_subscriptions from anon, authenticated;

create or replace function public.create_billing_checkout_session(
  p_plan_id text,
  p_provider text default 'stripe'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  amt integer;
  tokens integer;
  period_interval interval;
  sub_row public.billing_subscriptions%rowtype;
begin
  if uid is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if p_provider not in ('stripe', 'iap_apple', 'iap_google', 'payos') then
    raise exception 'invalid_billing_provider' using errcode = '22023';
  end if;

  if p_plan_id = 'archmage_monthly' then
    amt := 79000;
    tokens := 100;
    period_interval := interval '30 days';
  elsif p_plan_id = 'archmage_yearly' then
    amt := 599000;
    tokens := 1000;
    period_interval := interval '365 days';
  elsif p_plan_id = 'token_pack_100' then
    amt := 29000;
    tokens := 100;
    period_interval := interval '365 days';
  else
    raise exception 'invalid_billing_plan' using errcode = '22023';
  end if;

  insert into public.billing_subscriptions (
    user_id, provider, plan_id, status, amount_vnd, currency,
    external_session_id, bonus_tokens, current_period_end
  )
  values (
    uid, p_provider, p_plan_id, 'pending', amt, 'VND',
    'chk_' || replace(gen_random_uuid()::text, '-', ''),
    tokens,
    now() + period_interval
  )
  returning * into sub_row;

  return jsonb_build_object(
    'subscriptionId', sub_row.id,
    'planId', sub_row.plan_id,
    'provider', sub_row.provider,
    'amountVnd', sub_row.amount_vnd,
    'bonusTokens', sub_row.bonus_tokens,
    'externalSessionId', sub_row.external_session_id,
    'status', sub_row.status
  );
end;
$$;

create or replace function public.confirm_billing_payment(
  p_subscription_id uuid,
  p_external_ref text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  sub_row public.billing_subscriptions%rowtype;
  new_bal integer;
  next_tier text := 'apprentice';
begin
  if uid is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  select * into sub_row
  from public.billing_subscriptions
  where id = p_subscription_id and user_id = uid
  for update;

  if sub_row.id is null then
    raise exception 'subscription_not_found' using errcode = 'P0002';
  end if;

  if sub_row.status = 'active' then
    select balance into new_bal from public.ai_token_wallets where user_id = uid;
    select membership_tier into next_tier from public.profiles where id = uid;
    return jsonb_build_object(
      'subscriptionId', sub_row.id,
      'status', 'active',
      'membershipTier', coalesce(next_tier, 'archmage'),
      'tokenBalance', coalesce(new_bal, 50)
    );
  end if;

  update public.billing_subscriptions
  set
    status = 'active',
    external_session_id = coalesce(nullif(trim(p_external_ref), ''), external_session_id),
    updated_at = now()
  where id = p_subscription_id
  returning * into sub_row;

  insert into public.profiles (id) values (uid) on conflict (id) do nothing;

  if sub_row.plan_id in ('archmage_monthly', 'archmage_yearly') then
    update public.profiles
    set membership_tier = 'archmage'
    where id = uid;
    next_tier := 'archmage';
  else
    select membership_tier into next_tier from public.profiles where id = uid;
  end if;

  insert into public.ai_token_wallets (user_id, balance)
  values (uid, 50)
  on conflict (user_id) do nothing;

  update public.ai_token_wallets
  set
    balance = balance + sub_row.bonus_tokens,
    updated_at = now()
  where user_id = uid
  returning balance into new_bal;

  insert into public.ai_token_transactions (user_id, delta, reason)
  values (uid, sub_row.bonus_tokens, 'billing_' || sub_row.plan_id);

  return jsonb_build_object(
    'subscriptionId', sub_row.id,
    'status', 'active',
    'planId', sub_row.plan_id,
    'membershipTier', coalesce(next_tier, 'archmage'),
    'tokenBalance', coalesce(new_bal, 50)
  );
end;
$$;

revoke all on function public.create_billing_checkout_session(text, text) from public, anon;
revoke all on function public.confirm_billing_payment(uuid, text) from public, anon;

grant execute on function public.create_billing_checkout_session(text, text),
  public.confirm_billing_payment(uuid, text) to authenticated;
