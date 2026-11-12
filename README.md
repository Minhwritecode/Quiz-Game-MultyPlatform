# Papyrus

> From Ancient Scroll to AI Power.

Papyrus is a React Native + TypeScript-first project base for an offline-first learning quiz platform that will turn personal study material into reviewable question sets and realtime 2–4 player quiz battles. OCR is designed to stay on-device; only user-confirmed text will be sent to the protected generation endpoint once the production vertical slice is implemented.

This repository is the Capstone project for QuizClash, currently under active implementation. Local study, editable question review, manual account-set sync and server-controlled battle slices exist; five Supabase migrations are deployed. It is not feature-complete or a production release: live AI, full sync/auth/library flows, QR/rankings, native/device acceptance and release hardening remain. See the [current requirement and four-reference audit](docs/integration/STATUS-AUDIT-2026-11-11.md) for verified evidence and missing work.

## Mobile UX checkpoint — 12 November 2026

Settings now persist appearance/language/preferences; profile editing updates the
signed-in account display name. Android/iOS have opt-in local study reminders at
19:00, permission feedback and a system-settings shortcut. Startup no longer waits
for an artificial progress animation. Existing game code remains unchanged.

Latest verification: 14 Jest suites / 28 tests pass. Native reminder delivery,
profile changes against a test account, foldable layouts and release performance
still need device acceptance. See the [mobile UX audit](docs/release/MOBILE-UX-AUDIT.md).

## Product scope

- Expo Router mobile/web client with responsive Papyrus UI and typed feature boundaries.
- Clean Architecture target by feature: `Presentation → Domain ← Data`; remaining dependency violations are recorded in the audit.
- Zustand and TanStack Query for local UI state and server state.
- `expo-sqlite` native adapter for the local-first cache and sync outbox.
- Supabase migration with RLS, Realtime-ready room tables and server-side `submit_answer` scoring RPC.
- On-device ML Kit OCR adapter boundary.
- Gemini Edge Function adapter with structured JSON validation and provider timeout; live provider verification, streaming and rate limiting remain pending.
- Account-set sync: explicit local import, ordered push, revision cursor pull, idempotent receipts and user-selected conflict resolution. Background/attempt sync remains pending.
- GitHub Actions, EAS build profiles and Docker web preview.

## Quick start

```bash
npm ci
npm start
```

Press `w` for the web preview, or use `npm run android` / `npm run ios` with an
Expo development environment. New screens and feature code belong under `src/`.

Run with Supabase configuration only when a project is available:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co \
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-publishable-key \
npm start
```

The app can preview local study with seed data without Supabase configuration.
Native SQLite and web AsyncStorage persist local sets/results independently of
the cloud connection. The supplied URL/publishable key can also be placed in a
gitignored `.env.local`; the existing `EXPO_PUBLIC_SUPABASE_ANON_KEY` variable
accepts a publishable key. Restart Expo after changing environment configuration.

## Docker

The Docker image builds the React Native web export and serves it through Nginx. Native mobile builds are delivered through Expo/EAS:

```bash
docker compose up --build
# open http://localhost:8080
```

## Release preparation (Week 12)

Release configuration and core-flow hardening are prepared on
`codex/week12-release-ops`. Existing Memory Match and Survival game behavior is
unchanged. This is **not yet a signed or production-approved release**.

- [Week 12 requirements, verified checks and remaining gates](docs/release/WEEK-12-CHECKLIST.md)
- [Build, signing, OTA rollback and operations runbook](docs/release/RUNBOOK.md)
- [Cài APK Android và chạy iOS bằng Expo development build](docs/release/RUN-ON-PHONE.md)
- [Store metadata, privacy inventory and reviewer preparation](docs/release/STORE-READINESS.md)
- [Final defense deliverables and presentation outline](docs/release/DEFENSE-PACK.md)

Development, preview and production have distinct app IDs and update channels.
Preview produces an APK; production produces an AAB. EAS CLI is pinned in the
lockfile. The group's Expo project `f4872061-8848-48a7-9d26-a1dbec552c6b` is now
linked in source. EAS CLI login, cloud environment values and signing still need
verification; see the phone guide above and `.env.example`. Sentry/store account
setup remains separate.

```bash
npm ci
npm run test:release
# After accounts, environment variables and signing are configured:
npx --no-install eas build --platform android --profile preview
```

CI checks source/tests and disposable local backend fixtures. The release workflow
builds after CI, retains an exact build ID and checksum, and creates a **draft**
GitHub Release on a version tag. Store submission remains explicit. OTA uses native
runtime fingerprints and the linked Expo project. Publishing updates remains explicit.

Current local checks: **14 Jest suites / 28 tests**, plus **3 release guard tests**.
SQL account cleanup and battle regression tests, local Auth/Function isolation,
TypeScript, web export and Android prebuild passed. Prebuild is not a signed APK.
Lint still has inherited warnings; native/device tests, provider-backed AI, service
activation and public policy/support links remain open. The Maestro core-study
flow is prepared but has not been executed. Report 3 coverage below is a historical
measurement, not coverage for this newer code.

## Repository map

```text
src/                            # React Native + TypeScript source of truth
├── app/                         # Expo Router routes and root providers
├── core/                        # config, database, network, theme and UI primitives
├── features/                    # auth, question-sets, OCR, generation, battle, sync
└── shared/                      # typed hooks, constants, factories and utilities
supabase/
├── migrations/                  # PostgreSQL schema, RLS, submit_answer RPC
└── functions/                   # Deno Edge Functions
docs/                            # architecture notes and decisions
docs/reports/                     # Capstone proposal, architecture and AI/testing reports
docs/reports/evidence/            # compact, reproducible report evidence
eas.json                         # EAS development, preview and production profiles
docker/                          # Nginx runtime configuration
.github/workflows/               # CI, release candidates and OTA
fastlane/                        # EAS-backed release lanes
e2e/maestro/                     # Prepared native acceptance flow
docs/release/                    # Week 12 readiness and operations
```

## Engineering rules

1. New domain and feature contracts are pure TypeScript; they do not import React Native, Expo or Supabase UI adapters.
2. React Native presentation talks to use cases and query/state adapters; it does not reach into data sources.
3. Syncable writes should persist an outbox record atomically. Account-set mutations use UUIDs and retry receipts; not all local entity types are synchronized yet.
4. Room scoring is server-authoritative. The client never receives the answer key before a question closes.
5. Secrets belong in local environment configuration or GitHub Secrets, never in source control.
6. Prefer small feature slices with tests over large cross-cutting rewrites.

## Quality commands

```bash
# React Native quality lane
npm run typecheck
npm test
./scripts/check_architecture.sh
npx expo export --platform web
```

Native OCR and platform-specific SQLite require verification in an Expo
development build; hardware/crash-recovery evidence is still pending. The web
export uses platform-safe adapters and does not prove native OCR works.

Latest Report 3 measurement (11 November 2026): **8 Jest suites / 16 tests pass**.
Line coverage is **23.56%** for the configured source scope and **69.92%** for
the Domain subset. Collection excludes `src/app/**` and does not include SQL or
Edge Functions. These figures are not full-application coverage; component and
device E2E tests remain pending. See [Report 3](docs/reports/Capstone-Report-3-AI-Testing.md)
and its [evidence JSON](docs/reports/evidence/report-3-checks.json).

```bash
npm test -- --watch=false --coverage \
  --coverageDirectory=coverage/report-3 \
  --coverageReporters=text --coverageReporters=json-summary
```

## Supabase local development

Install the Supabase CLI, then:

```bash
supabase start
```

The `generate-questions` Edge Function has a Gemini provider adapter; it returns
`503` when `GEMINI_API_KEY` or `GEMINI_MODEL` is missing. It currently returns
one validated JSON response, not an SSE stream. Keep provider credentials in
server-side secrets and preserve JWT verification. Provider-backed tests, robust
request validation, cancellation and rate limits remain release requirements.
Local API smoke scripts deliberately target the local stack, not the shared
cloud project. See the [delivery checklist](docs/integration/DELIVERY-CHECKLIST.md)
for migration and test evidence.

## Milestone alignment

Reports 1 and 2 describe the proposal and architecture baseline. Report 3 records
the current AI/sync implementation, measured test coverage and remaining M3
acceptance gates. Writing a report or deploying the database does not close those
gates: live AI, native benchmarks, full sync, UI/device tests and verified builds
remain required.

## Project execution plan

- [Project plan and completion checklist](docs/PROJECT-PLAN.md)
- [Implementation status](docs/IMPLEMENTATION_STATUS.md)

## Capstone reports

- [Report 1 - Project Proposal](docs/reports/Capstone-Report-1-Proposal.md)
- [Report 2 - Detailed Architecture](docs/reports/Capstone-Report-2-Architecture.md)
- [Report 3 - AI Integration, Offline Sync & Test Report](docs/reports/Capstone-Report-3-AI-Testing.md)
- [Report 3 - Test and coverage evidence](docs/reports/evidence/report-3-checks.json)
- [Papyrus UI UX Prototype - Figma](https://www.figma.com/design/qdGvcsHXoTJcuq2NqsK9XS/Papyrus-UI-UX-Prototype?t=wiS4ZAcDfeWtDAkV-1)

## License

Academic capstone project. Add the final license and contributor policy before public release.
