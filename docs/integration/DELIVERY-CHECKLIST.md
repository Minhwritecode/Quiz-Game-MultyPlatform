# Papyrus delivery checklist — 11 November 2026

This file tracks user-requested completion work against PROJECT-PLAN.md and the
four source snapshots. A source file or passing typecheck alone does not satisfy
an end-to-end acceptance gate. Checkboxes require the evidence stated below.

| Scope / reference | Acceptance gate | Status |
| --- | --- | --- |
| Audit: all four snapshots | License inventory, feature matrix, independent implementation decisions | Existing audit available; not an exhaustive file-by-file parity claim |
| StudyWars document → AI → review | Real source input, generated questions, editable review, save | Partial: paste/gallery and review; provider integration unverified |
| QuizPulse PDF and manual quiz | PDF text/scan detection, size limits, manual create/update | Pending |
| Buzrr ingestion/RAG | PDF/DOCX/TXT/Markdown, traceable source spans, provider abstraction | Pending; no reference source copied |
| Dev Quiz Battle room flow | Authenticated two-player match and score persistence | In implementation; local SQL and client integration checks required |
| Server battle security | Owner/member/outsider/anonymous tests, hidden answers, duplicate guard | Test scripts added; execution evidence recorded after running |
| Battle lifecycle | Ready/countdown/round/result/final ranking, 2 then 4 players | Implemented code; end-to-end gate pending |
| Reconnect/host transfer | Refresh restores room; 30-second hold; host transfer; offline recovery | Implemented heartbeat/restore/transfer; strict eviction pending |
| QR/link join | Shared link, cold/warm start, locally generated QR and scanner | Link payload implemented; QR/scanner pending |
| Leaderboard | Persisted match ranking and live global/friends leaderboard | In-room ranking implemented; global screen still demo |
| Cloud sync | Account-scoped UUID writes, atomic outbox, cursor pull, retry/conflict tests | Question-set RPC and explicit account import UI implemented; local API/domain tests pass. Attempt sync, auto sync and device E2E pending |
| Local library | CRUD/duplicate/tombstone, source persistence | Save/list/search only |
| Study | Sequential/random/timed/incorrect-only, checkpoint resume, history | Sequential/result only; remaining modes pending |
| Auth | Registration/login/logout/session, guest merge, OAuth callbacks | Partial; OAuth callback and guest merge pending |
| Intake | Camera/gallery/multiple pages/paste, cancel/progress, permissions | Gallery/paste available; camera/document flow pending |
| AI | Validated output, user consent, streaming, cancel/retry/quota/rate limit | Partial; server adapter and editable review exist |
| UI | Phone/tablet/foldable, light/dark, safe area, accessible states | Base only; visual/device evidence pending |
| Tests | Unit/component/E2E, SQLite transactions, RLS/RPC, native smoke | Existing 11 unit tests; new SQL scripts; other gates pending |
| Release | CI, dependency/secret checks, signed builds, device evidence | Config scaffolds; release not verified |

## Task ledger

- [x] Run new battle security SQL against local Supabase and record outcome.
- [x] Run local lifecycle test with host and player identities.
- [x] Commit verified security changes separately from lifecycle/UI changes.
- [ ] Verify two independent browser sessions and then four-player capacity.
- [ ] Complete account-scoped sync before hosting locally generated sets.
- [ ] Add QR, global leaderboard, camera/PDF intake and resume/history.
- [ ] Add component/E2E/native checks and update original plan by evidence.

## Environment

User selected local development first. Docker Desktop and Supabase CLI are used
for isolated local tests. Cloud project setup and Gemini secrets are deferred.
No hosted migrations or paid provider requests are part of local verification.

## Verification results for this delivery

- TypeScript check: pass. Jest: 7 suites, 13 tests pass.
- Architecture import check: pass. Expo web export: pass for battle changes.
- `supabase/tests/battle_security.sql`: pass on local PostgreSQL 17 with fixtures rolled back.
- `supabase/tests/battle_lifecycle.sql`: pass, including host lease expiry and server deadline recovery.
- `node scripts/test-battle-local.mjs`: pass with four independent authenticated
  clients, fifth-seat denial, live Realtime delivery, concurrent answer retries,
  answer privacy and final ranking. Test users and match data are cleaned up.
- These are API/SQL smoke tests, not two-browser UI tests or native-device tests.
- Camera: permission/cancel tests pass; hardware capture remains unverified.

## Commits

- `5ad0b9e`: repair historical migration syntax; battle privilege and answer privacy guards; RLS tests.
- `5c9ef7c`: server deadlines, ready/start/heartbeat/snapshot/leave, host transfer; lifecycle SQL test.
- `8ae910b`: replace fake battle UI with repository calls, realtime scoreboard and room restore; four-client smoke harness.
- `2cb4deb`: camera capture/permissions, sequential OCR, page limit and cancellation tests.

## Remaining, in execution order

1. Account-scoped cloud sync (UUID migration for legacy local IDs, atomic outbox,
   guest merge, cursor/conflict/backoff tests). Hosting currently requires a cloud
   question set; newly generated local sets are not yet synchronized.
2. Browser component/E2E checks for battle, explicit reconnect within/beyond the
   30-second lease, vacant-seat cleanup and four-device UI checks.
3. QR renderer/scanner and native/web link acceptance; global/friends leaderboard.
4. PDF/DOCX/TXT/Markdown intake, source spans, OCR cancel/progress and real-device camera QA.
5. Study checkpoint resume/history and remaining library CRUD/study modes.
6. AI streaming/cancel/retry/quota, release signing, accessibility/device matrix,
   and final report/plan reconciliation.

This delivery does not mark the complete project or full four-repository parity done.

## Follow-up: account question-set sync (11 November)

- [x] Push the five previously queued commits to origin/main after credit reset.
- [x] Atomic question-set RPC with owner checks, revision cursor and retry receipts.
- [x] Local integration checks: owner/anonymous isolation, duplicate mutation,
  stale/concurrent edits, invalid payload rollback and deletion tombstones.
- [x] Concurrent different owners cannot claim one set or overwrite another set's question.
- [x] Account-scoped persisted document/outbox envelope (SQLite native; AsyncStorage web).
- [x] Explicit device-library import remaps legacy IDs to stable account UUIDs.
- [x] Settings → Account library: import/update, manual sync, conflict choices,
  confirmed deletion and pending/error status. Guest data is not auto-uploaded.
- [x] Domain tests cover account isolation, restart/backoff retry and conflict rebasing.
- [x] Typecheck, architecture check, 8 Jest suites / 16 tests and Expo web export pass.
- [x] Four-client battle/Realtime integration still passes with RPC-only set writes.
- [ ] Browser UI integration and native SQLite/device persistence verification.
- [ ] Automatic/background sync, attempt/history sync and legacy queue migration.
- [ ] Cloud project schema/auth configuration and multi-device cloud verification.

The user has created a hosted project. No hosted migration or settings change has
been made. Project URL and a publishable key configure the client; deployment
also requires authenticated management/CLI access. Keep local tests independent
of hosted data. The sync test harness refuses non-loopback API URLs.
