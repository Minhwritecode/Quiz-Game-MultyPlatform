# Papyrus Project Plan

> From Ancient Scroll to AI Power.

**Project:** Papyrus - AI-powered realtime study quiz battle from personal learning materials  
**Repository:** `Quiz-Game-MultyPlatform`  
**Document type:** Project execution plan and completion checklist  
**Plan status:** Base-project planning baseline  
**Version:** 1.0  
**Updated:** 22 October 2026  
**Primary client:** React Native + TypeScript + Expo

---

## 1. Purpose and scope of this plan

This document is the single execution checklist for taking Papyrus from an empty
repository to a demonstrable Capstone release. It translates the supplied
QuizClash specification into work packages, acceptance criteria, evidence and
weekly checkpoints. It also applies the Clean Architecture rules in the Week 09
architecture slides.

The repository at the start of this plan is a **project base**, not a finished
production application. Existing screens, seed data, adapters, database
contracts and CI files are scaffolding for the team. They prove the boundaries
and make the project runnable, but they do not mean that authentication, OCR,
LLM streaming, realtime battle, sync, release signing or security review are
production-complete.

### 1.1 Source-of-truth decisions

The attached specification is the product and Capstone reference. The attached
Week 09 slide deck is the architecture and testing reference. The following
decisions resolve legacy or inconsistent entries in the specification:

| Decision | Project baseline |
| --- | --- |
| Mobile framework | React Native with TypeScript, Expo and Expo Router |
| State management | Zustand for local UI/session state; TanStack Query where server-query caching is needed |
| Local database | SQLite through the Expo-compatible adapter, with an outbox for sync |
| Cloud backend | Supabase: PostgreSQL, Auth, RLS, Realtime and Edge Functions |
| OCR | Native ML Kit adapter behind a TypeScript port; no UI or domain dependency on ML Kit |
| AI generation | Authenticated Supabase Edge Function; provider key remains server-side |
| Architecture | Presentation → Domain ← Data, with a composition root for dependency injection |
| Testing | Jest unit tests, React Native component tests, and a small E2E smoke suite |
| Release path | EAS build profiles; GitHub Actions for quality and release automation; Docker for the web preview |

The words Flutter, Dart, Riverpod, Drift, `flutter_test` and `mocktail` in the
original specification are treated as legacy technology references. They are
not part of the implementation contract for this repository.

### 1.2 Base versus production boundary

| Stage | What it means | What it does not claim |
| --- | --- | --- |
| Base | Repository, folder structure, TypeScript contracts, route shell, design tokens, adapters, schema draft, CI checks and safe demo data | No real provider credentials, no end-to-end production data flow, no store-ready release |
| Feature-complete demo | P0 user journeys work on real devices and have evidence | Not a security-certified or scale-tested service |
| Production candidate | Release signing, security review, performance, recovery, privacy and operational checks pass | Still requires actual deployment approval and monitoring ownership |

**Current target:** complete and keep the Base stage clean before implementing
production vertical slices.

---

## 2. Product outcome and scope

### 2.1 Product promise

Papyrus lets a learner capture or paste personal study material, extract text on
the device, generate review questions through a protected streaming AI endpoint,
study without a network connection, and compete in a realtime 2-4 player quiz
room when online.

### 2.2 P0 scope for the Capstone demo

- Email authentication, session restoration and a guest path for local study.
- Camera or gallery input, multi-page source intake and manual text paste.
- On-device OCR with an editable text review step.
- Authenticated question generation with streaming, validation and user review.
- Local question-set CRUD and offline study mode.
- Two-to-four-player room creation, joining, lobby, speed mode and results.
- Bidirectional offline-first sync with visible sync state.
- Settings, light/dark/system theme, language placeholder and local data controls.
- Supabase RLS, server-authoritative room scoring and CI quality checks.

### 2.3 P1 scope

- Generation retry queue when connectivity is unavailable.
- Attempt history, basic statistics and incorrect-question review.
- Friend/system leaderboard and match history.
- Reconnect handling and resilient realtime state recovery.

### 2.4 P2 or explicitly out of scope

- Survival mode, sharing question sets, global matchmaking and ELO.
- In-room chat, purchases and advanced moderation.
- Training a custom AI model, speech recognition, desktop support and a web
  product beyond the development preview.

### 2.5 Definition of success

The Capstone demo is successful when a reviewer can perform the following on
real devices:

1. Sign in or continue locally as a guest.
2. Capture or select a Vietnamese document, correct the OCR text and generate
   validated questions.
3. Save the set, close the network, study it and resume an interrupted attempt.
4. Restore the network and observe the outbox synchronize without duplicates.
5. Create or join a two-player room, answer within the server-controlled timer,
   see live scores and receive a final ranking.
6. Inspect the repository and verify the Clean Architecture boundaries and test
   evidence.

---

## 3. Clean Architecture contract

### 3.1 Required dependency direction

```text
Presentation  --->  Domain  <---  Data
       \             ^             /
        \            |            /
         ---- Composition root ---
```

- **Presentation** contains screens, reusable components, route composition and
  state adapters. It calls use cases and observes typed state.
- **Domain** contains entities, value objects, failure/result types, repository
  interfaces and business use cases. It is framework-free and platform-free.
- **Data** contains repository implementations, DTOs, mappers, local/remote
  data sources, OCR/LLM adapters and sync implementation. It implements Domain
  ports; it never owns UI decisions.
- **Composition root** creates concrete dependencies and injects them into the
  feature graph. Routes and providers do not construct database clients inline.

### 3.2 Non-negotiable rules

- [ ] Domain files do not import `react`, `react-native`, Expo, Supabase,
  SQLite, camera, ML Kit or network libraries.
- [ ] A screen never calls Supabase, SQLite, OCR or an Edge Function directly.
- [ ] A repository interface is declared at the Domain boundary; its concrete
  implementation lives in Data.
- [ ] DTOs are not exposed to Presentation. Data maps DTOs to domain entities.
- [ ] Business rules live in use cases or pure domain policies, not in screens.
- [ ] All local writes go through a repository and create an idempotent outbox
  record when synchronization is required.
- [ ] Room scoring, answer deadlines and answer-key release are server-authoritative.
- [ ] Feature code is self-contained; `core` contains only genuinely shared
  technical primitives and cross-feature policies.
- [ ] Every new cross-layer dependency requires a small architecture decision
  record and an import-boundary test update.
- [ ] A temporary scaffold must be labelled as scaffold/TODO and must not be
  presented as a completed provider integration.

### 3.3 Feature folder contract

Each production feature should converge on this shape:

```text
src/features/<feature>/
├── domain/
│   ├── entities/
│   ├── failures/
│   ├── repositories/
│   └── use-cases/
├── data/
│   ├── datasources/
│   ├── dto/
│   ├── mappers/
│   └── repositories/
└── presentation/
    ├── screens/
    ├── components/
    └── state/
```

The current base may use a smaller folder while a feature is only a contract or
adapter. It must be expanded to this shape before its production vertical slice
is marked complete.

### 3.4 Composition root checklist

- [ ] Create one application dependency graph under `src/app/`.
- [ ] Inject repositories and use cases into screen-facing state adapters.
- [ ] Keep environment configuration outside domain and presentation models.
- [ ] Provide test doubles through the same ports used by production adapters.
- [ ] Verify there is no hidden singleton that makes tests depend on execution order.

---

## 4. Target project tree

The tree below is the intended production-shaped tree. The base repository can
contain empty or stubbed modules, but it must not reintroduce a parallel Flutter
client.

```text
.
├── src/
│   ├── app/
│   │   ├── _layout.tsx
│   │   ├── routes/
│   │   ├── composition/
│   │   └── providers/
│   ├── core/
│   │   ├── config/
│   │   ├── database/
│   │   ├── errors/
│   │   ├── network/
│   │   ├── sync/
│   │   ├── theme/
│   │   └── utils/
│   ├── features/
│   │   ├── auth/
│   │   ├── scan-ocr/
│   │   ├── quiz-generation/
│   │   ├── question-sets/
│   │   ├── study/
│   │   ├── room-battle/
│   │   ├── leaderboard/
│   │   ├── settings/
│   │   └── sync/
│   └── shared/
│       ├── components/
│       ├── hooks/
│       ├── types/
│       └── test-utils/
├── supabase/
│   ├── migrations/
│   ├── functions/
│   └── seed.sql
├── docs/
│   ├── architecture/
│   ├── decisions/
│   ├── reports/
│   └── PROJECT-PLAN.md
├── scripts/
├── e2e/
├── .github/workflows/
├── docker/
├── Dockerfile
├── docker-compose.yml
├── app.json
├── eas.json
├── package.json
└── README.md
```

### 4.1 Base tree acceptance checklist

- [ ] `src/` is the only client source of truth.
- [ ] No `lib/`, Flutter platform folders or Dart package manifests remain in
  the client checkout.
- [ ] Every route can render a safe loading, error and empty state.
- [ ] The web export and Docker preview can run without production secrets.
- [ ] Native-only adapters have platform-safe fallbacks or explicit build notes.
- [ ] Supabase migrations and Edge Functions are versioned independently from UI.
- [ ] README links to this plan, the architecture documents and Figma source.

---

## 5. Work breakdown from empty repository to completion

Each phase has an exit gate. Do not start the next phase by silently accepting a
failed gate; create a task or ADR for the exception.

### Phase 0 - Scope and repository control

- [ ] Confirm project name: **Papyrus**.
- [ ] Confirm slogan: **From Ancient Scroll to AI Power.**
- [ ] Confirm the repository and default branch are `main`.
- [ ] Add the three-person team, roles and instructor details to the reports.
- [ ] Freeze P0/P1/P2 scope and write down deferred features.
- [ ] Confirm Figma ownership, edit access and the 10 required screen frames.
- [ ] Add issue labels: `base`, `feature`, `domain`, `data`, `presentation`,
  `backend`, `test`, `docs`, `blocked`, `P0`, `P1`, `P2`.
- [ ] Create a GitHub Project with one board per milestone or one board with
  milestone fields.
- [ ] Define branch names: `feat/`, `fix/`, `chore/`, `docs/`, `test/`.
- [ ] Define commit style and require pull requests for `main`.

**Exit gate:** scope, ownership, source documents, Figma link, branch rules and
base technology choices are visible in the repository.

### Phase 1 - Base bootstrap and developer experience

- [ ] Install the pinned Node/npm toolchain and document it.
- [ ] Create the Expo React Native TypeScript app shell.
- [ ] Configure Expo Router and a small route map.
- [ ] Configure strict TypeScript, Jest and import-boundary checks.
- [ ] Add environment example files without real credentials.
- [ ] Add Docker web preview and Nginx configuration.
- [ ] Add GitHub Actions for install, typecheck, tests, architecture checks and
  web export.
- [ ] Add EAS development, preview and production profiles without committing
  signing material.
- [ ] Add a standard error format and a typed `Result`/failure strategy.
- [ ] Add a base theme, spacing, typography and motion token set.
- [ ] Run the base commands on a clean checkout.

**Exit gate:** a new contributor can clone, install, run the app, run CI checks
and open the Docker preview without provider secrets.

### Phase 2 - Architecture skeleton and design system

- [ ] Create the `Presentation → Domain ← Data` folders for every planned
  feature.
- [ ] Add one representative pure domain entity and use case.
- [ ] Add one repository port and one in-memory test implementation.
- [ ] Add the composition root and inject the representative feature.
- [ ] Add import rules that fail when Domain imports UI or infrastructure.
- [ ] Record the architecture in `docs/architecture/` and keep it current.
- [ ] Audit the Papyrus Figma file against the required 10 screens.
- [ ] Define light, dark and system theme behavior.
- [ ] Define responsive behavior for small phones, large phones, tablets and
  foldable inner/outer displays.
- [ ] Define accessibility targets: large text, contrast, focus order,
  reduced-motion behavior and touch targets.

**Exit gate:** the skeleton demonstrates the dependency direction, the design
tokens are reusable and the Figma frames have an implementation mapping.

### Phase 3 - Data foundation and offline-first storage

- [ ] Finalize local schema for source documents, question sets, questions,
  attempts, answers, sync queue and generation jobs.
- [ ] Add versioned SQLite migrations and migration tests.
- [ ] Add DTOs and mappers; keep storage shape separate from domain entities.
- [ ] Implement repository CRUD against local storage.
- [ ] Implement outbox insertion for every syncable write.
- [ ] Generate UUIDs on the client for idempotent retries.
- [ ] Add sync status states: `synced`, `pending`, `syncing`, `failed`.
- [ ] Add cursor storage and server timestamp handling.
- [ ] Add last-write-wins resolution using server `updated_at`.
- [ ] Treat attempts as append-only and soft deletes as timestamped changes.
- [ ] Add airplane-mode tests for question-set management and study mode.

**Exit gate:** P0 local question-set CRUD and study data work offline, survive a
restart, and expose sync state without calling the cloud from Presentation.

### Phase 4 - Authentication and profile

- [ ] Implement Supabase Auth email registration, login, logout and session restore.
- [ ] Add guest mode with a clear boundary for local-only data.
- [ ] Add optional Google sign-in only after the P0 email flow is stable.
- [ ] Implement profile read/update through a repository.
- [ ] Add loading, invalid credentials, expired session and offline states.
- [ ] Add RLS tests for profile ownership.
- [ ] Add component tests for login and session transitions.

**Exit gate:** a user can authenticate, close/reopen the app, retain a valid
session and never see another user's profile data.

### Phase 5 - Document intake and on-device OCR

- [ ] Implement camera/gallery source selection and multi-page ordering.
- [ ] Implement image preprocessing behind a Data adapter.
- [ ] Implement ML Kit text recognition behind a typed port.
- [ ] Process OCR asynchronously without blocking the UI thread.
- [ ] Show progress and recoverable permission/error states.
- [ ] Allow manual text paste when OCR fails or is unavailable.
- [ ] Add editable text review with Vietnamese diacritic correction support.
- [ ] Add text-length validation before generation.
- [ ] Confirm that images are not uploaded by the OCR flow.
- [ ] Measure OCR memory use for multi-page input.

**Exit gate:** a real device can capture or select a document offline, produce
editable text, and recover gracefully from permission or recognition failure.

### Phase 6 - Streaming AI question generation

- [ ] Define the generation request and validated question entity in Domain.
- [ ] Implement the Edge Function authentication and input-length checks.
- [ ] Store provider keys only in Supabase secrets.
- [ ] Add timeout, cancellation and rate-limit handling.
- [ ] Stream JSON objects through a stable SSE-compatible contract.
- [ ] Parse partial chunks incrementally and emit complete question objects.
- [ ] Validate exactly four options, index range, non-empty text and duplicates.
- [ ] Reject or quarantine malformed questions instead of crashing the screen.
- [ ] Show questions as they arrive, with cancel and retry controls.
- [ ] Require user confirmation before text is sent to the LLM endpoint.
- [ ] Let the user edit, delete and regenerate individual questions.
- [ ] Add generation-job persistence for offline retry as P1.

**Exit gate:** the document-to-reviewed-question flow works with a configured
provider in a development environment and has deterministic parser/use-case
tests independent of the provider.

### Phase 7 - Question-set library and offline study

- [ ] Implement list, search, rename, duplicate and soft-delete question sets.
- [ ] Add question-set detail and question review screens.
- [ ] Add study modes: sequential, random, timed and incorrect-only.
- [ ] Save attempts and per-question answers locally.
- [ ] Support resume after an interrupted attempt.
- [ ] Display explanations and final result offline.
- [ ] Add attempt history and basic statistics as P1.
- [ ] Add empty, loading, stale and sync-error states.
- [ ] Add component tests for the main library and study interactions.

**Exit gate:** a user can generate or seed a set, study it in airplane mode,
close the app, reopen it and resume or inspect the result.

### Phase 8 - Realtime room battle

- [ ] Finalize rooms, room players, room questions and room answers migrations.
- [ ] Add RLS policies and test cross-user access denial.
- [ ] Implement room creation with a six-character code and a 2-4 player cap.
- [ ] Implement join, leave, Presence and lobby state.
- [ ] Implement the server room state machine: waiting, countdown,
  question-open, question-result and finished.
- [ ] Snapshot questions at match start.
- [ ] Keep answer keys off the client until the question closes.
- [ ] Implement `submit_answer` as a server-side idempotent operation.
- [ ] Calculate speed-mode score on the server.
- [ ] Implement reconnect with a 30-second seat hold.
- [ ] Transfer host or end the room according to the specification.
- [ ] Add live scoreboard and final ranking.
- [ ] Add a two-device smoke test, then a four-device capacity check.

**Exit gate:** two to four real clients can complete a speed-mode match with
consistent deadlines, score results and reconnect behavior.

### Phase 9 - Sync, resilience and privacy

- [ ] Implement ordered push from the outbox.
- [ ] Retry transient errors with exponential backoff.
- [ ] Pull by cursor and upsert only newer server records.
- [ ] Make retries idempotent with client UUIDs.
- [ ] Resolve question-set conflicts by server timestamp.
- [ ] Keep attempts append-only and apply newer soft deletes.
- [ ] Add a visible sync indicator at set level and app level.
- [ ] Add manual retry and “sync now” controls.
- [ ] Test crashes or network loss during local write, push and pull.
- [ ] Document data flows and privacy boundaries in the final report.

**Exit gate:** toggling network connectivity does not lose local data, create
duplicates or leave the UI in an unexplained state.

### Phase 10 - UI/UX completion and device compatibility

- [ ] Implement the 10 Figma screen mappings using React Native components.
- [ ] Add keyboard-safe forms and safe-area handling.
- [ ] Support portrait and landscape where the flow benefits from it.
- [ ] Test compact phones, large phones, tablets and foldable outer/inner
  screens; use window dimensions rather than hardcoded device assumptions.
- [ ] Verify the join/create battle UI remains usable during hinge or resize
  changes.
- [ ] Add accessibility labels, large text support and visible focus states.
- [ ] Respect reduced motion and avoid animation-only status communication.
- [ ] Keep animation work on the UI thread where possible; profile long lists,
  OCR progress and score updates.
- [ ] Verify light/dark/system theme and contrast.
- [ ] Verify loading, error, empty, offline, pending-sync and success states.

**Exit gate:** every P0 journey is understandable and usable on the target
device matrix without clipped content or invisible state changes.

### Phase 11 - Test, security and release hardening

- [ ] Unit-test entities, use cases, parser, scoring, validation and conflict
  resolution.
- [ ] Test repository implementations with local and remote fakes.
- [ ] Component-test login, OCR review, library, study, lobby and scoreboard.
- [ ] Add a small E2E suite for login/local study and room battle smoke flow.
- [ ] Keep the target test balance near 70% Unit, 20% Component and 10% E2E.
- [ ] Test every RLS policy with owner, member and unauthorized users.
- [ ] Verify no API key or signing key is bundled in the client or repository.
- [ ] Run dependency audit and document accepted findings or fixes.
- [ ] Test cold start, offline launch, crash recovery and session expiry.
- [ ] Profile 60fps targets on representative real devices.
- [ ] Configure EAS credentials and protected CI secrets.
- [ ] Produce a signed Android release artifact and verify installation.
- [ ] Keep iOS build work optional unless the team has the required Apple setup.

**Exit gate:** quality, security, performance and release evidence is attached to
the milestone instead of being inferred from a successful local demo.

### Phase 12 - Capstone submission and handover

- [ ] Freeze P0 features and record all P1/P2 deferrals.
- [ ] Update Report 1 and Report 2 with the actual implementation state.
- [ ] Add architecture diagram, data-flow diagram, sync sequence and room state
  machine.
- [ ] Add Figma link and screen-to-route mapping.
- [ ] Add test results, screenshots, device matrix and release evidence.
- [ ] Record known limitations honestly, including provider and platform limits.
- [ ] Produce a short demo video and presentation deck.
- [ ] Rehearse the complete demo from a clean device and a clean checkout.
- [ ] Tag the submission commit and archive the build metadata.
- [ ] Verify the repository README is sufficient for a new contributor.

**Exit gate:** an evaluator can reproduce the base, understand the architecture,
run the demo and distinguish implemented behavior from planned behavior.

---

## 6. Thirteen-week execution schedule

This schedule follows the supplied 13-week plan while keeping the current
repository work explicitly at the base stage until the vertical slices begin.

| Week | Focus | Required evidence |
| ---: | --- | --- |
| 1 | Scope, repository, conventions, OCR/LLM feasibility spikes | Base repo, decision log, spike notes |
| 2 | Clean Architecture skeleton, import rules, Figma foundation, schema draft | Architecture check, initial Figma frames |
| 3 | Local SQLite contract, CRUD boundary, Auth boundary, theme, first EAS check | Offline contract, auth shell, CI result |
| 4 | Milestone 1: base demo and architecture report | Report 1, Figma link, runnable base |
| 5 | OCR adapter, permissions, editable text, Edge Function boundary | OCR device evidence, error states |
| 6 | Streaming parser, question validation, review and save flow | Parser tests, generated-question demo |
| 7 | Offline study, attempts, history, first sync push/pull | Airplane-mode evidence |
| 8 | Milestone 2: AI → offline → sync end-to-end | Report 2, real-device demo |
| 9 | Rooms, Presence, RLS, server room state and submit-answer RPC | Lobby and SQL evidence |
| 10 | Speed battle, reconnect, scoring, ranking | 2-4 player test evidence |
| 11 | Milestone 3: release signing, test completion, performance and conflict handling | Signed artifact, test report |
| 12 | Stabilization, device matrix, UX/accessibility, feature freeze | Candidate build, known-issues list |
| 13 | Milestone 4: final report, video, slides and defense rehearsal | Final tag, report, demo package |

### 6.1 Weekly operating checklist

- [ ] Hold one team sync each week.
- [ ] Update the GitHub Project and milestone status.
- [ ] Merge only reviewed pull requests into `main`.
- [ ] Attach test or demo evidence to completed work.
- [ ] Record a decision when scope, data contract or architecture changes.
- [ ] Review risk status and move P2 work out before P0 work slips.

---

## 7. Testing plan and completion gates

### 7.1 Test pyramid

The Week 09 slide deck sets the target distribution:

- **70% Unit:** domain entities, use cases, parser, validation, scoring,
  repositories and conflict policies.
- **20% Component:** screens, state transitions, loading/error/empty states and
  user interactions with mocked ports.
- **10% Integration/E2E:** a small set of real-device flows, including local
  study, generation smoke and two-player battle.

### 7.2 Minimum test matrix

| Area | Must verify |
| --- | --- |
| Domain | Four-option validation, score formula, room transitions, sync conflict policy, cancellation and failure mapping |
| Data | SQLite migration, mapper correctness, outbox ordering, retry idempotency, Supabase repository behavior |
| Presentation | Auth errors, OCR edit flow, set CRUD, study answer flow, lobby states, scoreboard updates |
| Security | RLS ownership, room membership, Edge Function JWT requirement, hidden answer key |
| Resilience | Offline launch, restart during attempt, reconnect during sync and battle, provider timeout |
| Accessibility | Large text, contrast, labels, focus order, reduced motion, touch target size |
| Performance | 60fps target for list/score updates, OCR memory, streaming render cost and cold start |

### 7.3 Base-stage quality gate

- [ ] `npm run typecheck` passes.
- [ ] `npm test -- --passWithNoTests` passes.
- [ ] `./scripts/check_architecture.sh` passes.
- [ ] `npx expo export --platform web` passes.
- [ ] Docker image builds and serves the web preview.
- [ ] No secrets are required for the base demo.
- [ ] A clean checkout can reproduce the above checks.

### 7.4 Production-candidate quality gate

- [ ] All P0 acceptance tests pass on real devices.
- [ ] Required Supabase migrations, RLS and RPC tests pass.
- [ ] Provider-backed OCR/LLM/realtime flows have evidence.
- [ ] EAS signed artifact installs and launches.
- [ ] Test pyramid and known limitations are documented.
- [ ] Reports and implementation status match the repository.

---

## 8. Risks and responses

| Risk | Signal | Response | Cut first if schedule slips |
| --- | --- | --- | --- |
| Vietnamese OCR accuracy | Frequent manual corrections or empty results | Test early, preserve editing and paste fallback | Multi-page polish |
| Malformed or hallucinated LLM output | Parser rejects many objects | Strict schema, prompt grounding, user review and regeneration | P1 generation queue |
| Realtime drift or disconnect | Mismatched timers/scores | Server time, server scoring, reconnect state machine | Survival mode |
| Scope overload | P0 milestone slips | Freeze P0 and move P2 to backlog | Sharing, ELO, chat |
| Architecture erosion | UI imports data clients | CI import rules and review checklist | Convenience abstractions |
| Provider cost or limits | Rate-limit/timeout spikes | Input limits, rate limits, caching and clear errors | Optional AI refinements |
| Release signing delay | EAS credentials not ready by Week 3 | Configure a development/preview build early | iOS release |
| Device fragmentation | Layout clipping or foldable resize bugs | Responsive primitives and device matrix | Landscape-only polish |

---

## 9. Team ownership and review rules

The specification names three team members. The exact names and assignments must
be confirmed in the reports; ownership below is a starting split, not a reason to
skip shared review.

| Workstream | Primary owner | Required reviewer |
| --- | --- | --- |
| UI/UX, Figma and Presentation | Member A | Member B |
| Domain, AI contracts and OCR behavior | Member B | Member C |
| Data, Supabase, sync and CI/CD | Member C | Member A |
| Architecture and final reports | All members | All members |

- [ ] Every member contributes commits from Week 1.
- [ ] Every pull request has one reviewer.
- [ ] The author adds tests for behavior changed by the pull request.
- [ ] The reviewer checks dependency direction and failure states.
- [ ] No generated or copied code is merged without the team understanding it.
- [ ] The final defense can be explained by the member responsible for each layer.

---

## 10. Evidence and report checklist

### Report 1 - Proposal and UX

- [ ] Problem, context, target users and differentiation.
- [ ] Objectives, P0/P1/P2 scope and out-of-scope list.
- [ ] Functional requirements FR-01 through FR-17.
- [ ] Use cases UC-01 through UC-04.
- [ ] Non-functional requirements and acceptance measures.
- [ ] Papyrus name, slogan and Figma link.
- [ ] Ten required screens and route mapping.
- [ ] Team, timeline, risks and academic integrity statement.

### Report 2 - Architecture and implementation plan

- [ ] React Native + TypeScript technology decision and rationale.
- [ ] Presentation → Domain ← Data diagram.
- [ ] Feature-first project tree and dependency rules.
- [ ] Composition root and dependency injection explanation.
- [ ] Local/cloud data model and migration strategy.
- [ ] Offline-first outbox, push/pull, conflict and idempotency strategy.
- [ ] OCR data flow and privacy boundary.
- [ ] LLM streaming contract, parser and server-side protection.
- [ ] Realtime room state machine, scoring and reconnect rules.
- [ ] Supabase RLS and RPC security model.
- [ ] Test pyramid, CI/CD, EAS/Docker workflow and release evidence.
- [ ] 13-week plan, team roles, risks and known limitations.

### Repository evidence

- [ ] `README.md` quick start and base disclaimer.
- [ ] `docs/architecture/` decisions and diagrams.
- [ ] `docs/PROJECT-PLAN.md` kept current.
- [ ] Figma file URL and screen-to-route mapping.
- [ ] CI run links or exported logs for milestone submissions.
- [ ] Screenshots/video from real-device testing.
- [ ] Signed build metadata and commit tag.

---

## 11. Final Definition of Done

Papyrus is considered complete for the Capstone scope only when all of the
following are true:

- [ ] P0 functional requirements are implemented and demonstrated.
- [ ] P1 items are either implemented or explicitly deferred with rationale.
- [ ] Clean Architecture boundaries pass automated checks and code review.
- [ ] Domain tests are deterministic and independent of React Native and Supabase.
- [ ] Local-first study and synchronization survive offline/reconnect scenarios.
- [ ] OCR is on-device and the user confirms text before LLM submission.
- [ ] Room timing, scoring and answer-key release are server-authoritative.
- [ ] RLS and Edge Function authorization are tested.
- [ ] Light/dark/system themes, accessibility and responsive layouts are checked.
- [ ] EAS preview/release workflow and Docker preview are reproducible.
- [ ] Reports, Figma, README, plan and actual repository state agree.
- [ ] Known limitations are written down; no scaffold is described as production.

Until this checklist is complete, the repository status should be described as
**Papyrus project base / Capstone scaffold**, not as a production-ready app.

