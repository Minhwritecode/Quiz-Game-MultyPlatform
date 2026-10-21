# Papyrus Project Proposal and Interactive Wireframe Prototype

**Course:** Cross-Platform Mobile App Development - Capstone Project  
**Institution:** Faculty of Computer Science, Vietnam-Korea University of Information and Communication Technology (VKU)  
**Instructor:** Nguyen Thanh Tuan, PhD  
**Project title:** Papyrus - Ung dung Dau tri Hoc tap Thoi gian thuc voi Cau hoi Sinh tu Tai lieu Ca nhan  
**English title:** Papyrus - From Personal Study Material to Realtime Quiz Battles  
**Team:** Dinh Tran Tien Minh, Le Tuan Khai, Du Thi Nhu Yen  
**Academic term:** Semester 1, 2026-2027  
**Target submission:** Week 4 proposal and prototype review  
**Version:** 1.1 - 22 October 2026

> **Slogan:** From Ancient Scroll to AI Power.

## Executive summary

Papyrus is an offline-first, mobile-first learning application for students who want to turn their own lecture slides, textbooks, notes and photographed materials into useful practice questions. The product combines on-device OCR, a protected streaming LLM endpoint and local question-set storage. A learner can study independently without a network and can optionally enter a realtime 2-4 player battle with classmates when connected.

The proposal focuses on a realistic capstone scope. The first release prioritizes authentication, document capture, OCR correction, question generation and review, offline practice, basic history, synchronization and one realtime speed-battle mode. Global matchmaking, chat, purchases, a custom-trained model and web/desktop product support are explicitly outside the first release.

The repository already contains a runnable Flutter base, a Material 3 shell, feature-oriented architecture boundaries, local Drift schema, Supabase migration/RLS/RPC scaffolding, Docker, CI and Fastlane setup. This proposal defines the product and the prototype work that follows.

## 1. Project motivation and problem statement

### 1.1 Context and practical problem space

Students commonly revise with multiple documents: lecture slides, PDFs, handwritten notes and screenshots. Converting those materials into good multiple-choice questions is slow and repetitive. Existing quiz products often provide generic prewritten banks, so they are not aligned with the exact material a student is studying. Solo revision can also become monotonous and offers little social motivation.

The problem is made harder by connectivity. Students may revise in a dormitory, on public transport or in a classroom with unstable service. If the app requires a network for every question, the most important study loop becomes unreliable. At the same time, sending raw document photos to a server raises privacy concerns for personal notes and course materials.

### 1.2 Proposed solution

Papyrus uses this flow:

1. The learner captures pages with the camera, selects images from the gallery or pastes text.
2. ML Kit extracts text on the device, including Vietnamese text where supported.
3. The learner corrects OCR output and selects the text to use.
4. A Supabase Edge Function validates the authenticated request and streams structured question objects from the selected LLM provider.
5. The learner reviews, edits and removes questions before saving a local question set.
6. The local database remains the UI source of truth. A sync outbox uploads changes when a connection is available.
7. The question set can be used offline or selected for a server-authoritative 2-4 player battle.

### 1.3 Target user personas

| Persona | Profile and goals | Pain points | Papyrus response |
|---|---|---|---|
| University learner | 18-24, preparing for midterm/final exams with classmates | Spends time rewriting notes into quizzes; loses focus in solo study | Generates a reviewable quiz from personal material and supports group battles |
| High-school learner | 16-18, preparing for tests and graduation exams | Needs repeated practice; source materials differ by class | Keeps multiple subject sets locally and supports weak-question review |
| Study-group host | Student coordinating 2-4 classmates | Needs a quick, fair activity with synchronized timing | Creates a room, shares a short code and receives server-scored results |

### 1.4 Typical user story

Lan has a Vietnamese lecture PDF for software engineering. On a bus, she opens Papyrus without a network, selects saved notes and practices a question set. Later, she corrects a new OCR capture while offline. When Wi-Fi returns, the question set enters the sync queue. Before an exam, she creates a speed room, sends the six-character code to three classmates and answers each question against the shared server timer. After the match, she sees her score and the questions she missed.

## 2. Objectives, scope and boundaries

### 2.1 Objectives

- Demonstrate a maintainable Flutter application using a strict three-layer boundary.
- Keep the core learning loop available without a network.
- Protect document images by keeping OCR on-device and sending only confirmed text to the generation endpoint.
- Make generated questions editable and reviewable before persistence.
- Demonstrate a fair realtime battle where the server owns timing and scoring.
- Provide automated tests for domain logic and important UI surfaces.
- Produce a signed Android release through a repeatable CI/Fastlane workflow.

### 2.2 In scope for the capstone release

| # | Feature category | Concrete feature | Priority | Acceptance boundary |
|---:|---|---|:---:|---|
| 1 | Authentication | Email/password, optional Google, logout, session restoration, guest offline mode | P0 | User can enter the app as a guest or authenticated learner |
| 2 | Profile | Display name and basic profile settings | P0 | Profile is isolated by `auth.uid()` |
| 3 | Document capture | Camera, gallery, multiple pages and pasted text | P0 | A source document can be created from any supported input |
| 4 | On-device OCR | ML Kit text recognition, asynchronous progress and correction screen | P0 | OCR works in airplane mode and text remains editable |
| 5 | AI generation | Count, difficulty and language options; authenticated streaming request | P0 | Valid JSON objects appear incrementally and invalid objects are rejected |
| 6 | Question review | Edit, delete, regenerate and save questions | P0 | User approves a set before it is persisted |
| 7 | Generation queue | Retry generation requests after connectivity returns | P1 | A failed request is retained with a visible state |
| 8 | Question-set library | Search, rename, delete, duplicate and sync status | P0 | Library works from local data without network |
| 9 | Offline study | Practice modes, optional timer, explanations and resume | P0 | Attempt data is saved locally in airplane mode |
| 10 | History and statistics | Attempts, accuracy by set and missed-question list | P1 | Learner can identify weak areas |
| 11 | Room creation | Set, count, time per question and mode; six-character code | P0 | Host can create a waiting room |
| 12 | Room joining | Code entry and Presence list for 2-4 players | P0 | Players can join and reconnect within the hold window |
| 13 | Realtime battle | Synchronized question windows, server timer and score updates | P0 | Late/duplicate answers cannot earn points |
| 14 | Battle modes | Speed mode in release; Survival mode as stretch scope | P0/P2 | Speed mode is the minimum competitive loop |
| 15 | Results and leaderboard | Match summary, history and basic leaderboard | P1 | Results are visible after a finished room |
| 16 | Offline synchronization | Ordered outbox, pull cursor, retries, last-write-wins for editable data | P0 | Local changes survive a disconnect and synchronize later |
| 17 | Settings | Theme, language, local-data management and logout | P0 | Preference changes persist locally |

### 2.3 Out of scope

The first capstone release does not include global matchmaking, ELO ranking, chat in rooms, in-app purchases, training a private LLM, speech recognition, a web/desktop product experience, or advanced content moderation. These may be documented as future work but must not threaten the P0 learning loop.

## 3. Non-functional requirements

| Quality attribute | Requirement | Verification |
|---|---|---|
| Architecture | Domain code is pure Dart and dependencies point inward | Import boundary script and code review |
| Offline-first | Library, OCR and study mode remain useful without network | Airplane-mode scenario |
| Privacy | Images stay on-device; text transmission requires user confirmation | Data-flow review and demo |
| Security | No provider API key in the client; RLS on user data; server-side battle scoring | Supabase policy review and negative access tests |
| Performance | Aim for 60 fps; generation and OCR must not block the UI isolate | Flutter DevTools profile run |
| Accessibility | Material 3, large text support, readable contrast and explicit loading/error/empty states | Manual light/dark and text-scale checks |
| Reliability | Realtime reconnect and sync retries do not silently discard data | Disconnect/reconnect scenarios |

## 4. Prototype and user experience plan

### 4.1 Prototype deliverables

The Week 4 prototype should contain these ten screens:

1. Login/register and guest entry.
2. Home/library overview.
3. Capture and OCR correction.
4. Streaming generation controls and question review.
5. Question-set detail.
6. Offline study.
7. Room lobby.
8. Live battle.
9. Results and leaderboard.
10. Settings.

The repository currently provides a clickable Flutter shell for Home, Library, Study, Battle, Leaderboard, Settings, Auth, Scan and Generate entry points. The visual design and interaction source is the team Figma file:

**Figma prototype URL:** [Papyrus UI UX Prototype](https://www.figma.com/design/qdGvcsHXoTJcuq2NqsK9XS/Papyrus-UI-UX-Prototype?t=wiS4ZAcDfeWtDAkV-1)

### 4.2 Figma handoff and prototype coverage

The Figma file is the design reference for the proposal review. The screen names below are the required handoff map between the prototype, the Flutter routes and the user story. The team should keep the Figma frame names aligned with this table so that reviewers can move from the report to the prototype without guessing.

| Figma frame / flow | Flutter route or surface | Main interaction to demonstrate |
|---|---|---|
| Authentication and guest entry | `/auth` | Sign in, Google option and offline guest path |
| Home and library | `/` and `/sets` | See recent sets, sync status and create-set action |
| Scan and OCR correction | `/create/scan` | Camera/gallery/paste entry, editable extracted text and privacy note |
| Generation setup and review | `/create/generate` | Count, difficulty, language and streaming review entry |
| Question-set detail | `/study/:setId` entry | Inspect questions and choose study/battle action |
| Offline study | `/study/:setId` | Select an answer, reveal explanation and advance progress |
| Room lobby | `/battle` | Create/join room, six-character code and player list |
| Live battle | Room battle state | Shared timer, answer submission and live scores |
| Results and leaderboard | `/leaderboard` plus result state | Match summary, ranking and missed questions |
| Settings and profile | `/settings` | Theme, language, sync and account controls |

The current Figma URL is included as a team-owned artifact. Visual details should be updated in the Figma file first, then reflected in Flutter widgets and this report's traceability table.

### 4.3 Interaction principles

- The primary action is visible in the first viewport on mobile.
- Offline state is visible rather than hidden; question sets show synced, pending or failed status.
- Generated questions are never silently saved without review.
- OCR correction is a normal step, not an error path.
- Battle screens show the same question state for all players while leaving the answer key server-side until the question closes.

## 5. Proposed technology stack

| Layer | Choice | Rationale |
|---|---|---|
| Client | Flutter and Dart 3 | One codebase, native performance and broad plugin ecosystem |
| State and DI | Riverpod 2 | Testable providers and explicit composition root |
| Navigation | go_router | Declarative routes and deep-link-ready structure |
| Local database | Drift over SQLite | Typed schema, migrations and transactional outbox support |
| Preferences | SharedPreferences | Small local settings and sync cursor |
| Cloud | Supabase | Auth, PostgreSQL, RLS, Realtime and Edge Functions |
| OCR | Google ML Kit Text Recognition | On-device processing and offline support |
| LLM | Provider accessed only through Edge Function | Keeps secrets off-device and enables rate limits |
| Tests | flutter_test, mocktail and integration tooling | Domain, widget and device-flow coverage |
| Delivery | GitHub Actions, Fastlane and Docker | Repeatable quality checks and release packaging |

## 6. Initial architecture

```text
Presentation: screens, widgets, Riverpod notifiers, router
        │ calls use cases
        ▼
Domain: entities, repository contracts, validation and scoring rules
        ▲ implemented by
        │
Data: Drift DAOs, Supabase data sources, ML Kit adapter, Edge Function client, sync engine
```

Dependencies are assembled in `lib/app/di`. Feature modules own their contracts. The domain layer does not import Flutter, Drift, Supabase or ML Kit.

## 7. Privacy, security and data handling

- The source image is processed on-device and is not uploaded by the OCR path.
- Only text confirmed by the learner is sent to the generation Edge Function.
- The Edge Function requires a bearer token, validates input length and owns the provider secret.
- Supabase tables use Row-Level Security. User-owned records are scoped with `auth.uid()`.
- Battle answer keys are kept in server-side snapshots and are not exposed before `closes_at`.
- Local secrets and Android signing files are excluded from Git; CI consumes protected secrets.

## 8. Four-week proposal plan

| Week | Goal | Evidence |
|---:|---|---|
| 1 | Confirm problem, test Vietnamese OCR and LLM request assumptions | Repository, experiment notes and risk register |
| 2 | Create Clean Architecture skeleton, theme, local schema and route map | Running shell, schema draft and prototype frames |
| 3 | Add local CRUD, auth boundary and first release lane | Offline library demo, CI run and Fastlane verification |
| 4 | Milestone 1 review | Architecture report, clickable prototype, demo script and scope decision |

## 9. Team responsibilities

| Member | Primary responsibility | Shared evidence |
|---|---|---|
| Dinh Tran Tien Minh | UI/UX, Presentation, Material 3 and performance | Widget tests and review participation |
| Le Tuan Khai | AI/OCR, Domain, generation parser and domain tests | Use-case tests and experiment notes |
| Du Thi Nhu Yen | Data, Supabase, synchronization, CI/Fastlane | Migration review, integration checklist and release evidence |

All members review pull requests, contribute commits and understand the code they present.

## 10. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Vietnamese OCR errors | Medium | Test early, keep correction screen and allow pasted text |
| Invalid or hallucinated LLM output | High | Strict JSON validation, source-grounded prompt and human review |
| Realtime timing drift | High | Server timestamps, RPC scoring and reconnect state machine |
| Scope growth | High | Freeze P0 by Week 8 and cut P2 first |
| Signing delays | Medium | Run the lane early and keep secrets outside Git |
| Architecture erosion | Medium | Import boundary check, review and pure-Dart domain tests |

## 11. Current repository evidence

- Repository: [Minhwritecode/Quiz-Game-MultyPlatform](https://github.com/Minhwritecode/Quiz-Game-MultyPlatform)
- Base commit: `ffa46aa` - `feat: scaffold Papyrus quiz platform base`
- Local quality checks: `flutter analyze`, `flutter test`, `flutter build web --release` and architecture boundary check pass.
- Current limitation: provider credentials and demo video are not embedded in the repository. The team Figma prototype URL is now recorded above and should remain the single design reference for the submission.

## Conclusion

Papyrus is feasible as a 13-week capstone because it has a narrow P0 loop, a clear privacy story and an architecture that allows native integrations to be replaced in tests. The proposal deliberately treats AI generation and realtime battle as controlled adapters rather than letting them leak into UI code. The next milestone is to turn the capture-to-generation path and local persistence contracts into a tested vertical slice.
