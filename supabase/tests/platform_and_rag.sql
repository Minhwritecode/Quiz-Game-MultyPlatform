-- Verification suite for pgvector RAG, AI token reserve/refund, pluggable question types sync,
-- category ELO / 1v1 duels, moderation queue review, and live room reactions/host controls.
-- Runs inside a transaction and rolls back cleanly.
\set ON_ERROR_STOP on
begin;

create function pg_temp.assert_true(ok boolean, label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then
    raise exception 'ASSERTION FAILED: %', label;
  end if;
end $$;

insert into auth.users(id, email) values
  ('11111111-1111-4111-8111-111111111191', 'rag-owner@papyrus.test'),
  ('22222222-2222-4222-8222-222222222292', 'rag-outsider@papyrus.test');

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111191', true);

-- 1. Knowledge Spaces + Chunks + Hybrid Search isolation
insert into public.knowledge_spaces(id, owner_id, name, subject)
values ('aaaa1111-1111-4111-8111-111111111111', auth.uid(), 'Kho Giải tích', 'Toán');

insert into public.knowledge_documents(id, space_id, owner_id, name, kind, content_sha256, raw_text, excerpt, chunk_count)
values (
  'bbbb1111-1111-4111-8111-111111111111',
  'aaaa1111-1111-4111-8111-111111111111',
  auth.uid(),
  'chuong-1.md',
  'md',
  'sha256-fixture-001',
  '# Chương 1: Giới hạn\nĐịnh lý kẹp dùng để tính giới hạn dãy số.',
  'Định lý kẹp dùng để tính giới hạn dãy số.',
  1
);

insert into public.knowledge_chunks(document_id, space_id, owner_id, chunk_index, heading_path, page_number, content)
values (
  'bbbb1111-1111-4111-8111-111111111111',
  'aaaa1111-1111-4111-8111-111111111111',
  auth.uid(),
  0,
  'Chương 1: Giới hạn',
  1,
  'Định lý kẹp dùng để tính giới hạn dãy số và hàm số.'
);

select pg_temp.assert_true(
  (select count(*) = 1 from public.search_knowledge_chunks('aaaa1111-1111-4111-8111-111111111111', null, 'Định lý kẹp', 'Chương 1', 10)),
  'owner can search own knowledge chunks with heading filter'
);

-- 2. AI Token Wallet atomic reserve & refund
select pg_temp.assert_true(public.get_ai_token_balance() = 50, 'initial AI token balance is 50');
select pg_temp.assert_true(public.reserve_ai_tokens(3, 'test_run') = 47, 'reserve decrements AI tokens atomically');
select pg_temp.assert_true(public.refund_ai_tokens(3, 'test_refund', null) = 50, 'refund restores AI tokens atomically');

-- 3. Pluggable Question Types + codeSnippet + multiSelect cloud sync
select pg_temp.assert_true(
  (public.sync_push_set(
    '33333333-3333-4333-8333-333333333301'::uuid,
    '0',
    '{
      "id": "44444444-4444-4444-8444-444444444401",
      "title": "Bộ câu hỏi đa dạng",
      "subject": "CNTT",
      "deleted": false,
      "questions": [
        {
          "id": "55555555-5555-4555-8555-555555555501",
          "content": "Độ phức tạp của Binary Search?",
          "options": ["O(1)", "O(log n)", "O(n)", "O(n^2)"],
          "correctIndex": 1,
          "explanation": "Chia đôi mỗi bước",
          "position": 0,
          "questionType": "multiple_choice",
          "codeSnippet": "mid = (lo + hi) >> 1"
        },
        {
          "id": "55555555-5555-4555-8555-555555555502",
          "content": "TypeScript là superset của JavaScript?",
          "options": ["Đúng", "Sai"],
          "correctIndex": 0,
          "explanation": "Chính xác",
          "position": 1,
          "questionType": "true_false"
        },
        {
          "id": "55555555-5555-4555-8555-555555555503",
          "content": "Đánh giá buổi học hôm nay?",
          "options": [],
          "correctIndex": 0,
          "explanation": "",
          "position": 2,
          "questionType": "rating",
          "ratingMax": 5
        }
      ]
    }'::jsonb
  )->>'conflict')::boolean = false,
  'sync_push_set accepts pluggable question types and codeSnippet'
);

-- 4. Category ELO & 1v1 Duel result + Streak/Membership progress sync
select pg_temp.assert_true(
  (public.record_duel_result('coding', true, 'Học giả Nova', 1240, 3200, 2100, 1, 18, 1218, null)->>'eloRating')::integer = 1218,
  'record_duel_result persists duel and updates category ELO'
);
select pg_temp.assert_true(
  (select elo_rating = 1218 from public.category_elos where user_id = auth.uid() and category_id = 'coding'),
  'category_elos row updated'
);
select pg_temp.assert_true(
  (public.sync_user_progress(7, 12, 2, current_date, 'archmage', 10, 12500, 3200, 8)->>'membershipTier') = 'archmage',
  'sync_user_progress persists streak and membership tier'
);

-- 5. Moderation report submit + review RPC
insert into public.question_reports(id, reporter_id, question_ref, question_preview, reason)
values ('66666666-6666-4666-8666-666666666601', auth.uid(), 'q-ref-1', 'Câu hỏi thử nghiệm', 'typo_format');
select pg_temp.assert_true(
  (public.review_question_report('66666666-6666-4666-8666-666666666601', 'reviewed', 'Đã sửa lỗi chính tả')).status = 'reviewed',
  'review_question_report updates moderation status'
);

-- 6. Live 1v1 Matchmaking Queue + Auto-Moderation Gate + Superadmin + Billing Ledger
select pg_temp.assert_true(
  (public.enqueue_duel_matchmaking('coding', true, 1218, 'Học giả Alpha', null, 250)->>'status') = 'searching',
  'first player enters 1v1 matchmaking queue in searching state'
);

select pg_temp.assert_true(
  (public.auto_moderate_question_report('66666666-6666-4666-8666-666666666601')).ai_confidence > 0,
  'auto_moderate_question_report produces AI verdict and confidence score'
);

select pg_temp.assert_true(
  ((public.get_superadmin_overview()->'metrics'->>'totalSets')::integer) >= 1,
  'get_superadmin_overview returns platform metrics'
);

select (public.create_billing_checkout_session('archmage_monthly', 'stripe')->>'subscriptionId')::uuid as sub_id \gset
select pg_temp.assert_true(
  (public.confirm_billing_payment(:'sub_id', 'stripe_pi_test_001')->>'membershipTier') = 'archmage',
  'confirm_billing_payment upgrades profile to archmage VIP and credits AI tokens'
);
select pg_temp.assert_true(public.get_ai_token_balance() = 150, 'billing payment adds +100 AI tokens to wallet');

-- 7. Outsider isolation check
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222292', true);
select pg_temp.assert_true(
  (public.enqueue_duel_matchmaking('coding', true, 1240, 'Học giả Beta', null, 250)->>'status') = 'matched',
  'second player in ELO band matches live human opponent in 1v1 queue'
);
select pg_temp.assert_true((select count(*) = 0 from public.knowledge_spaces), 'outsider cannot read private knowledge spaces');
select pg_temp.assert_true((select count(*) = 0 from public.duel_matches), 'outsider cannot read private duel matches');

do $$ begin
  begin
    perform * from public.search_knowledge_chunks('aaaa1111-1111-4111-8111-111111111111', null, 'kẹp', null, 5);
    raise exception 'outsider searched private knowledge space';
  exception when insufficient_privilege then null;
  end;
end $$;

rollback;
