# Papyrus Weekly Delivery Roadmap

**Product:** Papyrus — *From Ancient Scroll to AI Power.*  
**Architecture:** React Native + TypeScript + Expo Router, Clean Architecture (`Presentation → Domain ← Data`), Supabase as the single backend system.  
**Planning baseline:** 10 November 2026  
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
- [ ] Add editable review actions: edit question, edit option, change answer, remove question.
- [x] Add client parser tests with malformed questions, code fences and duplicate questions.
- [ ] Acceptance: a signed-in user can submit confirmed text and save only schema-valid questions; no provider key reaches the app.

### Week 3 — Auth, profile and sync outbox

- [ ] Add session bootstrap and guest/authenticated route policy.
- [ ] Add email/password plus Google/Apple provider ports; keep OAuth configuration external.
- [ ] Persist source documents and attempts with owner IDs in Supabase.
- [ ] Implement local outbox read/ack/retry with exponential backoff and idempotency keys.
- [ ] Implement pull cursor and conflict resolution for question sets.
- [ ] Add RLS tests for owner-only documents, sets, attempts and sync rows.
- [ ] Acceptance: offline writes survive restart and converge after sign-in without duplicating entities.

### Week 4 — Native intake quality and responsive mobile UX

- [ ] Add camera capture permissions and a multi-page capture flow.
- [ ] Add OCR preprocessing, Vietnamese/Latin script selection and review diff/highlighting.
- [ ] Add PDF/document extraction behind a server adapter where the platform cannot safely extract locally.
- [ ] Add foldable-aware responsive layout rules, keyboard-safe forms and accessibility labels.
- [ ] Acceptance: gallery, camera and paste produce the same reviewable `SourceDocument` contract on supported devices.

### Week 5 — Battle lobby and server-authoritative game loop

- [ ] Implement create/join room RPCs with six-character codes and a 2–4 player cap.
- [ ] Seed room question snapshots and server deadlines.
- [ ] Implement Realtime room/player/question projections in React Native.
- [ ] Enforce duplicate-answer idempotency and score calculation in PostgreSQL.
- [ ] Add host start/countdown/result/finish state transitions.
- [ ] Acceptance: two authenticated clients can join one room, answer once per question and receive the same authoritative score.

### Week 6 — Reconnect, QR/link join and ranking

- [ ] Add connection leases and a 30-second reconnect seat hold.
- [ ] Add QR/link payload generation and safe code fallback.
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

- **Done:** Week 1 local-first baseline and independent reference audit.
- **In progress:** Week 2 provider-backed AI generation and review.
- **Not production-ready:** Auth, cloud sync, native camera permissions, realtime battle, reconnect, ranking and release signing.
