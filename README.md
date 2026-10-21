# Papyrus

> From Ancient Scroll to AI Power.

Papyrus is a React Native + TypeScript-first, offline-first learning quiz platform for turning personal study material into reviewable question sets and realtime 2–4 player quiz battles. OCR stays on-device; only user-confirmed text is sent to the protected generation endpoint.

This repository is the Capstone base for QuizClash. It contains the production-shaped skeleton, architecture boundaries, local/cloud data contracts, CI/CD scaffolding and a small runnable demo slice. It does not claim that provider credentials, native OCR, LLM streaming or the realtime battle vertical slice are complete yet.

## Product scope

- React Native + TypeScript client target with Expo, responsive navigation and Papyrus design tokens.
- Transitional Flutter/Dart baseline under `lib/` kept runnable while vertical slices migrate to React Native.
- Clean Architecture by feature: `Presentation → Domain ← Data`.
- Existing Flutter transition baseline uses Riverpod, `go_router` and Drift.
- React Native target uses Expo Router, Zustand, TanStack Query and `expo-sqlite` for the same local-first contracts.
- Supabase migration with RLS, Realtime-ready room tables and server-side `submit_answer` scoring RPC.
- On-device ML Kit OCR adapter boundary.
- Edge Function boundary for authenticated, rate-limited LLM generation.
- Offline-first sync contract: local write, ordered push, cursor pull, server-time conflict resolution.
- GitHub Actions, Fastlane and Docker web preview.

## Current baseline quick start

```bash
flutter pub get
dart run build_runner build --delete-conflicting-outputs
flutter run
```

The forward client architecture is documented in
[React Native-first architecture](docs/architecture/react-native-first.md).
New screens and feature code belong under `src/`; the Flutter command above is
kept for the transitional baseline until the first Expo mobile shell is
bootstrapped.

Run with Supabase configuration only when a project is available:

```bash
flutter run \
  --dart-define=SUPABASE_URL=https://your-project.supabase.co \
  --dart-define=SUPABASE_ANON_KEY=your-anon-key
```

The app intentionally runs with a seeded in-memory repository when those values are absent, so the navigation, library and study-mode demo are usable without secrets.

## Docker

The current Docker image builds the transitional Flutter web preview and serves it through Nginx. The React Native mobile target is delivered through Expo/EAS:

```bash
docker compose up --build
# open http://localhost:8080
```

## Android signing

Copy `android/key.properties.example` to `android/key.properties`, point `storeFile` at a local keystore, and keep both the properties file and keystore out of Git. CI expects the keystore as `ANDROID_KEYSTORE_BASE64` plus the matching Gradle properties supplied by the protected release environment.

## Repository map

```text
src/                            # React Native + TypeScript target
├── app/                         # Expo Router routes and root providers
├── core/                        # config, database, network, theme and UI primitives
├── features/                    # auth, home, OCR, generation, study, battle, sync
└── shared/                      # typed hooks, constants, factories and utilities
lib/                            # transitional Flutter/Dart baseline
├── app/                         # current legacy composition root and router
├── core/                        # legacy config, result/failure types, theme, Drift schema
└── features/                    # legacy feature adapters and demo screens
supabase/
├── migrations/                  # PostgreSQL schema, RLS, submit_answer RPC
└── functions/                   # Deno Edge Functions
docs/                            # architecture notes and decisions
docs/reports/                     # Capstone proposal and architecture reports
fastlane/                        # Android build lanes
docker/                          # Nginx runtime configuration
.github/workflows/               # CI and manual Android release
```

## Engineering rules

1. New domain and feature contracts are pure TypeScript; they do not import React Native, Expo or Supabase UI adapters.
2. React Native presentation talks to use cases and query/state adapters; it does not reach into data sources.
3. Every local write gets an outbox record. Retries are idempotent using client UUIDs.
4. Room scoring is server-authoritative. The client never receives the answer key before a question closes.
5. Secrets belong in local environment configuration or GitHub Secrets, never in source control.
6. Prefer small feature slices with tests over large cross-cutting rewrites.

## Quality commands

```bash
# Transitional Flutter baseline
dart run build_runner build --delete-conflicting-outputs
flutter analyze
flutter test --coverage
./scripts/check_architecture.sh
flutter build web --release
```

The React Native quality lane will use `tsc --noEmit`, ESLint, Jest/React
Native Testing Library and a device-flow runner once the Expo shell is
bootstrapped.

## Supabase local development

Install the Supabase CLI, then:

```bash
supabase start
supabase db reset
supabase functions serve generate-questions --no-verify-jwt
```

The Edge Function is deliberately a safe `501` scaffold until the team selects and configures the LLM provider. Provider keys must be stored as Supabase secrets and generation must validate JWT, input length, timeout and rate limits before production use.

## Milestone alignment

The base maps to the specification's first two milestones: repo conventions, architecture skeleton, local schema, auth boundary, theme, CI and release lane. The next vertical slice is OCR → editable text → authenticated streaming generation → question review → local persistence → sync.

## Capstone reports

- [Report 1 - Project Proposal](docs/reports/Capstone-Report-1-Proposal.md)
- [Report 2 - Detailed Architecture](docs/reports/Capstone-Report-2-Architecture.md)
- [Papyrus UI UX Prototype - Figma](https://www.figma.com/design/qdGvcsHXoTJcuq2NqsK9XS/Papyrus-UI-UX-Prototype?t=wiS4ZAcDfeWtDAkV-1)

## License

Academic capstone project. Add the final license and contributor policy before public release.
