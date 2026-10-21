# Papyrus Detailed Architecture and Core Feature Implementation

**Course:** Cross-Platform Mobile App Development - Capstone Project  
**Institution:** Faculty of Computer Science, Vietnam-Korea University of Information and Communication Technology (VKU)  
**Instructor:** Nguyen Thanh Tuan, PhD  
**Project title:** Papyrus - From Personal Study Material to Realtime Quiz Battles  
**Team:** Dinh Tran Tien Minh, Le Tuan Khai, Du Thi Nhu Yen  
**Academic term:** Semester 1, 2026-2027  
**Milestone:** Week 8 architecture and core-feature review  
**Version:** 1.1 - 22 October 2026

## Executive summary

This report describes the Papyrus architecture and records the implementation baseline for the Week 8 review. The design follows the Week 9 architecture lecture: Presentation calls Domain use cases, Domain defines pure entities and repository interfaces, and Data implements those interfaces using remote services and local cache. Dependency injection is performed in a composition root rather than inside individual screens.

The current repository is an honest React Native baseline, not a claim that
every production feature is finished. The Expo Router shell, feature
boundaries, seeded offline study flow, SQLite adapter, generation parser,
Supabase migration/RLS/RPC, sync contracts, CI and tests are present. Native
camera UX, real provider streaming, full Supabase auth wiring and the complete
multi-device battle are the next vertical slices.

The companion UI/UX artifact is the team-owned [Papyrus UI UX Prototype in Figma](https://www.figma.com/design/qdGvcsHXoTJcuq2NqsK9XS/Papyrus-UI-UX-Prototype?t=wiS4ZAcDfeWtDAkV-1). This report treats that link as the visual source of truth while the route and architecture mapping below defines how each screen is implemented.

## 1. Clean Architecture implementation

### 1.1 Dependency rule

```text
                 ┌────────────────────────────┐
                 │ Presentation                │
                 │ RN screens, hooks, stores   │
                 └──────────────┬─────────────┘
                                │ calls
                                ▼
                 ┌────────────────────────────┐
                 │ Domain                      │
                 │ entities, use cases, ports  │
                 └──────────────▲─────────────┘
                                │ implements
                                │
                 ┌──────────────┴─────────────┐
                 │ Data                        │
                 │ SQLite, Supabase, ML Kit    │
                 └────────────────────────────┘
```

The arrow points from a caller to an abstraction. Data depends on Domain to implement contracts; Domain depends on no UI or platform framework. The React Native composition root under `src/app/` creates concrete implementations and connects them to Zustand stores and TanStack Query.

### 1.2 Layer responsibilities

| Layer | Owns | Must not do |
|---|---|---|
| Presentation | React Native screen composition, input handling, loading/error/empty states, route transitions | Query SQLite directly, parse Supabase responses or calculate battle scores |
| Domain | `Question`, `QuestionSet`, `Room`, `Attempt`, validation, scoring and repository contracts in pure TypeScript | Import React Native, Expo, SQLite, Supabase, ML Kit or platform APIs |
| Data | DTO mapping, SQLite queries, Supabase calls, ML Kit and Edge Function adapters, sync queue | Decide visual layout or own screen state |
| Composition | Expo Router layout, app configuration, Zustand stores and TanStack Query clients | Hide dependencies inside feature classes |

### 1.3 Project tree

```text
src/                                  # React Native + TypeScript source of truth
├── app/
│   ├── _layout.tsx
│   ├── (auth)/
│   └── (app)/
├── core/
│   ├── config/
│   ├── database/
│   ├── domain/
│   ├── network/
│   ├── theme/
│   └── validation/
├── features/
│   ├── auth/
│   ├── home/
│   ├── scan-ocr/
│   ├── quiz-generation/
│   ├── question-sets/
│   ├── study/
│   ├── room-battle/
│   ├── leaderboard/
│   ├── settings/
│   └── sync/
├── shared/
│   ├── components/
│   ├── hooks/
│   └── utils/
└── test/

supabase/                             # PostgreSQL migrations and Edge Functions
```

Important React Native implementation anchors:

- `src/core/database/sqlite.native.ts`: typed local schema and transactional persistence.
- `src/core/domain/models.ts`: framework-free entities and scoring rules.
- `src/features/question-sets/data/persistence.ts`: local repository boundary.
- `src/features/quiz-generation/domain/streamingQuestionParser.ts`: incremental JSON validation boundary.
- `src/features/room-battle/domain/speedScore.ts`: speed-mode scoring rule.
- `src/app/_layout.tsx`: Expo composition root with Query Client and safe area.

The folder structure has one client source of truth: all architecture core,
source, feature and UI work is React Native + TypeScript.

## 2. Database schema and security policies

### 2.1 Local SQLite schema

| Table | Key fields | Purpose |
|---|---|---|
| `question_sets` | `id`, `title`, `subject`, `updated_at`, `sync_status`, `is_deleted` | Local source of truth for the library |
| `questions` | `id`, `set_id`, `content`, `options_json`, `correct_index`, `position` | Four-option questions and explanations |
| `sync_queue` | `id`, `entity`, `entity_id`, `operation`, `payload`, `retry_count`, `created_at` | Ordered outbox for offline changes |

The React Native adapter uses `expo-sqlite` with typed repository boundaries and
the same logical tables and transaction rules. Saving a set replaces its
question rows and appends an outbox entry in one transaction; deletion is
soft-delete plus a queued delete operation.

### 2.2 Supabase/PostgreSQL schema

The migration `supabase/migrations/202610210001_initial_schema.sql` defines:

- `profiles` and `source_documents` for identity and OCR text.
- `question_sets` and `questions` for editable quiz content.
- `attempts` and `attempt_answers` for append-only study history.
- `rooms`, `room_players`, `room_questions` and `room_answers` for realtime play.
- `sync_queue` for server-visible change records where needed.

### 2.3 RLS policy model

Every user-owned table has Row-Level Security enabled. User records are scoped to `auth.uid()`. Question rows inherit access from their parent set. Room reads are limited to hosts or members. The answer table is not a client scoring surface; the `submit_answer` security-definer RPC validates membership, question window, duplicate submission and correct index before awarding points.

The client does not receive `correct_index` from a room question snapshot before the question closes. This is a product and security requirement, not just a UI convention.

### 2.4 Entity relationship overview

```text
auth.users ──1:1── profiles
auth.users ──1:N── source_documents
auth.users ──1:N── question_sets ──1:N── questions
auth.users ──1:N── attempts ──1:N── attempt_answers
question_sets ──1:N── rooms ──1:N── room_questions
rooms ──1:N── room_players
rooms ──1:N── room_answers
```

## 3. CORE FEATURE IMPLEMENTATION PROGRESS

* **🔗 GitHub Tag / Branch M2:** [main branch](https://github.com/Minhwritecode/Quiz-Game-MultyPlatform/tree/main) — architecture baseline and report increment are tracked in the commit history.
* **🎥 Milestone 2 Video Demo (2–3 minutes):** To be recorded by the team after the final demo script is rehearsed; the exact script is included in Section 9.

### 3.1 App shell and navigation

The application starts in `src/app/_layout.tsx`, loads Expo configuration and
initializes Supabase only when URL and publishable key are supplied. Without
credentials, the app uses a deterministic seeded repository so the UI can be
demonstrated offline. Expo Router provides the shell routes for Home, Library,
Battle, Rank, Settings, Auth, Scan, Generate and Study.

Papyrus theme tokens are centralized in `src/core/theme/` and shared by React
Native components. Light/dark behavior follows the system by default, while
Settings exposes haptic and motion preferences.

### 3.2 Figma-to-architecture traceability

The Figma prototype is not a separate product specification. Each frame maps to a presentation surface that calls a domain contract and receives data from a replaceable adapter.

| Figma flow | Presentation surface | Domain contract | Data boundary |
|---|---|---|---|
| Auth and guest entry | Auth page and session gate | `AuthRepository` | Supabase Auth data source |
| Home/library | Home page and question-set providers | `QuestionSetRepository`, Zustand store | Seeded demo or SQLite repository |
| Scan/OCR correction | Scan page and OCR controller | `OcrRepository` | ML Kit on-device data source |
| Generate/review | Generation page and review state | `QuestionGenerationRepository`, `ValidateQuestion` | Supabase Edge Function client and stream parser |
| Offline study | Study page | Attempt/start/submit use cases | SQLite attempts and answers tables |
| Room lobby | Room lobby page | Room creation/join contracts | Supabase rooms, players and Presence |
| Live battle | Battle state surface | Submit-answer and score rules | Server-authoritative RPC and Realtime channel |
| Results/leaderboard | Results and leaderboard surfaces | Result/history/leaderboard contracts | Supabase views plus local history |
| Settings/profile | Settings page | Preference and auth contracts | SharedPreferences and Supabase profile |

This mapping keeps prototype changes reviewable: a renamed Figma frame must correspond to a route or presentation component, and a new data requirement must be introduced through a domain contract rather than a direct widget call.

### 3.3 Local question-set flow

The implemented base path is:

```text
Provider
  → QuestionSetRepository contract
  → InMemoryQuestionSetRepository for deterministic demo
  → SQLiteQuestionSetRepository for local persistence
  → SQLite tables + sync_queue transaction
```

The study screen reads the same domain entity regardless of which repository is selected. That keeps the UI independent from database technology and makes the next provider override a composition change rather than a screen rewrite.

### 3.4 OCR boundary

`MlKitOcrDataSource` accepts an image path and returns a `SourceDocument`. The adapter keeps ML Kit isolated from the domain contract. The next implementation task is to connect camera/gallery selection, preprocessing and an editable text controller, then move recognition off the UI isolate if profiling shows a long frame.

### 3.5 Streaming generation boundary

`GenerationRequest` contains source text, count, difficulty and language. `EdgeFunctionGenerationDataSource` sends that request to `generate-questions` through Supabase. `StreamingQuestionParser` accumulates partial JSON and rejects any object that does not contain exactly four non-empty distinct options and a valid `correct_index`.

The Edge Function currently validates bearer presence and input length and returns a safe `501` provider-pending response. This is deliberate: no provider API key is placed in the client or committed to the repository.

### 3.6 Offline synchronization

The intended sync contract is:

1. Write local data first.
2. Append an outbox item in the same transaction.
3. On connectivity, push items in `created_at` order.
4. Retry failures with exponential backoff while retaining the payload.
5. Pull records after the saved server cursor.
6. Resolve editable set conflicts using server `updated_at`; treat attempts as append-only.
7. Show synced, pending or failed state at set level.

The React Native sync contract keeps these rules in pure TypeScript; the
remaining work is the concrete Supabase push/pull adapter, connectivity
listener and persisted cursor.

### 3.7 Realtime battle state machine

```text
waiting → countdown → question_open → question_result
                                      ├─ next question_open
                                      └─ finished
```

Server responsibilities include question snapshots, `opens_at`, `closes_at`, host transition, duplicate-answer rejection and scoring. The client estimates server time from connection offset, renders the timer and reconnects into the current room state. The SQL RPC already implements the core score formula for the speed mode: 1000 base points plus a speed bonus capped at 500.

## 4. Dependency injection and testability

The composition root is `src/app/_layout.tsx` plus feature-level stores and
query clients. The demo provider uses the seeded Zustand store because it makes
tests and screenshots deterministic. Production wiring provides one SQLite
database instance, a SQLite question-set repository, Supabase data sources and
the sync coordinator.

This arrangement follows inversion of control: screens receive behavior through a repository/use-case abstraction and do not construct platform services themselves.

## 5. Testing strategy

The Week 9 lecture recommends a testing pyramid of approximately 70% unit, 20% widget/component and 10% integration/E2E tests. Papyrus applies the same ratio as a planning target, not as a false coverage claim.

| Level | Planned share | Current evidence | Next cases |
|---|---:|---|---|
| Unit | 70% | Question validation, streaming parser, speed score calculator | Use cases, conflict resolver, sync retry policy and SQLite repository tests |
| Widget | 20% | Home shell and seeded library smoke test | OCR correction, question review, study answers, lobby and leaderboard states |
| Integration/E2E | 10% | Manual scenario documented in the proposal | Auth, offline study, reconnecting battle and two-device room flow using Patrol/Maestro |

React Native quality commands:

```bash
npm run typecheck
npm test
./scripts/check_architecture.sh
npx expo export --platform web
```

The current baseline passes TypeScript analysis, domain tests, the import-boundary check and web export. Native OCR, native SQLite and device flows require an Expo development build.

## 6. Milestone 2 progress

| Requirement | Status | Evidence |
|---|---|---|
| React Native shell and navigation | Implemented baseline | `src/app`, Expo Router and responsive Papyrus UI |
| Clean Architecture boundary | Implemented baseline | TypeScript domain, feature adapters and boundary script |
| Local schema | Implemented baseline | `expo-sqlite` native schema and transactional outbox |
| Local repository | Implemented baseline | Seeded store and SQLite persistence boundary |
| Auth boundary | Adapter/UI scaffold | Supabase data source and Auth page; provider wiring pending |
| OCR | Adapter/UI scaffold | ML Kit data source and Scan page; device flow pending |
| LLM streaming | Parser/Edge boundary | Validating parser and authenticated function scaffold; provider pending |
| Offline study | Demo vertical slice | Seeded set, answer reveal and progress; persisted attempts pending |
| Sync | Contract baseline | Sync item, engine and conflict resolver; cloud adapter pending |
| Realtime battle | Server schema baseline | Room tables, RLS and score RPC; full client lifecycle pending |
| CI/CD | Implemented scaffold | GitHub Actions, EAS release workflow and Docker web export |

## 7. Security and privacy review

- API provider credentials are not compiled into the client.
- Supabase initialization is gated by compile-time environment values.
- Signing material is excluded by `.gitignore` and expected from CI secrets.
- RLS is enabled in the migration before application policies are created.
- Server-side scoring avoids trusting client-calculated points.
- OCR image data remains local by design.
- The generation request is bounded to 30,000 characters in the Edge Function scaffold.

Before release, the team must add rate limiting, JWT subject validation, provider timeout/cancellation, structured audit logging without source-text leakage and negative RLS tests.

## 8. Known limitations and next implementation order

1. Bootstrap the Expo + React Native + TypeScript shell under `src/` and preserve the deterministic demo mode.
2. Migrate Auth, Home and Library as the first React Native vertical slice.
3. Add `expo-sqlite` parity for question sets, attempts and the sync outbox.
4. Connect camera/gallery and OCR correction UI through the ML Kit adapter.
5. Implement provider streaming in the Edge Function with secret management and rate limits.
6. Persist attempts and missed-question statistics.
7. Implement sync cursor/backoff, connectivity lifecycle and background work.
8. Implement room lifecycle, Presence, question snapshots and reconnect handling.
9. Add device integration tests, EAS build profiles and signed Android/iOS release verification.

## 9. Core feature demo script

For the architecture review, the presenter should show:

1. Launch the React Native app without secrets and explain deterministic local demo mode.
2. Open Library and Study, answer a seeded question and show progress.
3. Navigate through Scan and Generate entry points and explain the adapter boundaries.
4. Show the React Native dependency direction and SQLite schema.
5. Show the SQL migration, RLS policies and `submit_answer` RPC.
6. Run the quality commands and show the test output.
7. Explain clearly which production integrations are pending and why they are isolated.

**Figma prototype:** [Papyrus UI UX Prototype](https://www.figma.com/design/qdGvcsHXoTJcuq2NqsK9XS/Papyrus-UI-UX-Prototype?t=wiS4ZAcDfeWtDAkV-1)

**GitHub branch/commit for milestone review:** [main branch](https://github.com/Minhwritecode/Quiz-Game-MultyPlatform/tree/main) - commit `ffa46aa` is the initial base; the architecture/report increment is tracked in the subsequent commit history.
**Milestone 2 video:** To be recorded by the team after the final demo script is rehearsed.

## Conclusion

Papyrus now has a concrete architectural base that can grow feature by feature without coupling the UI to infrastructure. The most important capstone risks - scope, privacy, offline behavior, server-authoritative scoring and testability - are represented in code and documentation. The next milestone is vertical integration, not a structural rewrite.
