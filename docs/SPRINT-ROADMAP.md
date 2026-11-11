# Papyrus Weekly Delivery Roadmap

**Product:** Papyrus — *From Ancient Scroll to AI Power.*  
**Architecture:** React Native + TypeScript + Expo Router, Clean Architecture (`Presentation → Domain ← Data`), Supabase as the single backend system.  
**Planning baseline:** 10 November 2026  
**Evidence reconciled:** 11 November 2026; [full coverage audit](integration/STATUS-AUDIT-2026-11-11.md). Weeks indicate delivery order, not completed calendar sprints.

**Delivery rule:** each sprint ends with a small vertical slice, automated checks, a separate commit and a separate push. The repository remains a project under active development; a green check does not mean production readiness.

## Working agreements

- [ ] Keep the four local reference repositories ignored and outside the release source tree.
- [ ] Re-implement behavior in Papyrus TypeScript; do not copy code from the unlicensed or AGPL reference snapshots.
- [ ] Keep provider credentials in Supabase Edge Functions or environment secrets only.
- [ ] Add domain tests before wiring a new adapter or screen.
- [ ] Every completed sprint must pass typecheck, tests, architecture checks and an appropriate Expo/native smoke check.
- [ ] Use one task commit per slice; push commits sequentially to `origin/main` only after verification.

## Reference-to-Papyrus mapping

| Reference | Useful behavior to adopt | Papyrus implementation boundary |
| --- | --- | --- |
| QuizPulse | Room lifecycle, duplicate-answer guard, AI retry/JSON handling, PDF-to-quiz flow | Supabase RPC/Realtime, Edge Function provider port, local intake adapters |
| StudyWars | Server room state, connection lease, host/player flow, document ingestion | PostgreSQL room state, reconnect state machine, React Native screens |
| Buzrr | Provider abstraction, ingestion pipeline, citations/RAG direction, scalable game modules | Edge Function provider contract, source spans as a later domain feature, no AGPL code copied |
| Dev Quiz Battle | Small room code, reactive room view, mutation-side answer validation | Supabase RPC + Realtime projection, idempotent room answers |

## Sprint plan

### Week 1 — Audit and local-first study slice — completed

- [x] Audit all four reference repositories and record license/architecture findings.
- [x] Add feature matrix and reuse decisions.
- [x] Persist question sets on native SQLite and web AsyncStorage.
- [x] Hydrate the local library on app start.
- [x] Record completed study attempts and render a persisted result screen.
- [x] Connect paste/gallery OCR intake to the generation flow.
- [x] Verify TypeScript, Jest, architecture boundary and Expo web export.

### Week 2 — Protected AI generation and review — in progress

- [x] Implement a server-side Gemini-compatible provider adapter in the Edge Function.
- [x] Validate generated questions against a server contract before returning them.
- [x] Add timeout, request-size and question-count limits.
- [x] Replace the hardcoded generation preview with source-backed generated state when Supabase is configured.
- [x] Add editable review actions: edit question, edit option, change answer, remove question (UI code; component test pending).
- [x] Add client parser tests with malformed questions, code fences and duplicate questions.
- [ ] Acceptance: a signed-in user can submit confirmed text and save only schema-valid questions; no provider key reaches the app.

### Week 3 — Auth, profile and sync outbox

- [x] Add session bootstrap and guest fallback policy.
- [x] Add email/password plus Google provider port; keep OAuth configuration external.
- [ ] Persist source documents and attempts with owner IDs in Supabase.
- [x] Implement local outbox read/ack/retry contract with coalesced entity writes.
- [x] Implement account-set revision cursor and explicit conflict resolution; local tests pass. This differs from the original timestamp LWW policy.
- [ ] Add RLS tests for owner-only documents, sets, attempts and sync rows.
- [ ] Acceptance: offline writes survive restart and converge after sign-in without duplicating entities.

### Week 4 — Native intake quality and responsive mobile UX

- [x] Add camera permission/cancel handling and gallery multi-page OCR path; adapter tests pass.
- [ ] Verify capture on native hardware and finish page ordering/recapture UX.
- [ ] Add OCR preprocessing, Vietnamese/Latin script selection and review diff/highlighting.
- [ ] Add PDF/document extraction behind a server adapter where the platform cannot safely extract locally.
- [ ] Add foldable-aware responsive layout rules, keyboard-safe forms and accessibility labels.
- [ ] Acceptance: gallery, camera and paste produce the same reviewable `SourceDocument` contract on supported devices.

### Week 5 — Battle lobby and server-authoritative game loop

- [x] Implement create/join room RPCs with six-character codes and a 2–4 player cap.
- [x] Snapshot room questions and schedule server deadlines at match start.
- [x] Wire RN room/player updates and polling snapshots; API Realtime smoke passes.
- [x] Enforce duplicate-answer idempotency and score calculation in PostgreSQL.
- [x] Add host start/countdown/result/finish server state transitions.
- [x] API acceptance: four authenticated local clients complete a match; concurrent duplicate answers do not double score.
- [ ] UI acceptance: visible countdown, configurable host settings and two browser/native clients complete the match on cloud.

### Week 6 — Reconnect, QR/link join and ranking

- [x] Add heartbeat, room restore and host transfer after a 30-second lease.
- [ ] Complete strict seat expiry/forfeiture and idle-room cleanup.
- [x] Add shareable deep-link payload and room code fallback.
- [ ] Add QR renderer/scanner and cold/warm link verification.
- [ ] Add personal and friends leaderboard queries with pagination.
- [ ] Add battle result persistence and anti-tampering checks.
- [ ] Acceptance: a temporarily disconnected player can resume the held seat and cannot submit outside the server window.

### Week 7 — Hardening, observability and security

- [ ] Add structured client/server error codes and redacted logs.
- [ ] Add rate limits for generation, room creation and answer submission.
- [ ] Add dependency audit, secret scan, RLS regression suite and migration checks.
- [ ] Add loading/error/empty/offline states across all screens.
- [ ] Acceptance: failure paths are visible to the user, retryable where safe and do not expose source text or secrets in logs.

### Week 8 — Release candidate and evidence pack

- [ ] Run the device matrix: Android, iOS, web and narrow/foldable layouts.
- [ ] Produce signed development/preview builds through EAS after project credentials are configured.
- [ ] Record smoke-test evidence for auth, intake, generation, offline study, sync and battle.
- [ ] Update capstone reports and implementation status from verified evidence only.
- [ ] Acceptance: all release gates are green and remaining limitations are documented before production work begins.

## Current implementation status

- **Implemented slices:** local study/result, editable review, camera permission handling, account-set manual sync and server battle/Realtime. Local API/domain evidence is recorded in the delivery checklist.
- **Cloud:** five migrations deployed; RLS/RPC grants and anonymous-denial probes verified. Authenticated app/device journeys remain pending.
- **Missing:** complete auth, live/streaming AI, PDF/documents, full library CRUD, resume/history, automatic/attempt sync, QR and global leaderboard.
- **Still open:** strict architecture dependencies, component/E2E/native tests, signed builds and report/Figma/device reconciliation.
- **Broader reference scope:** X1–X6 in the audit tracks guest/host modes, programming categories, RAG/providers, ranked duels, moderation/media and billing/self-hosting. These are not covered by the original eight-week core delivery order.
