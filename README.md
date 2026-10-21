# Papyrus

> From Ancient Scroll to AI Power.

Papyrus is a Flutter-first, offline-first learning quiz platform for turning personal study material into reviewable question sets and realtime 2–4 player quiz battles. OCR stays on-device; only user-confirmed text is sent to the protected generation endpoint.

This repository is the Capstone base for QuizClash. It contains the production-shaped skeleton, architecture boundaries, local/cloud data contracts, CI/CD scaffolding and a small runnable demo slice. It does not claim that provider credentials, native OCR, LLM streaming or the realtime battle vertical slice are complete yet.

## Product scope

- Flutter multi-platform client with Material 3 and system Light/Dark mode.
- Clean Architecture by feature: `Presentation → Domain ← Data`.
- Riverpod composition root and `go_router` navigation.
- Drift schema for local question sets, questions and the sync outbox.
- Supabase migration with RLS, Realtime-ready room tables and server-side `submit_answer` scoring RPC.
- On-device ML Kit OCR adapter boundary.
- Edge Function boundary for authenticated, rate-limited LLM generation.
- Offline-first sync contract: local write, ordered push, cursor pull, server-time conflict resolution.
- GitHub Actions, Fastlane and Docker web preview.

## Quick start

```bash
flutter pub get
dart run build_runner build --delete-conflicting-outputs
flutter run
```

Run with Supabase configuration only when a project is available:

```bash
flutter run \
  --dart-define=SUPABASE_URL=https://your-project.supabase.co \
  --dart-define=SUPABASE_ANON_KEY=your-anon-key
```

The app intentionally runs with a seeded in-memory repository when those values are absent, so the navigation, library and study-mode demo are usable without secrets.

## Docker

The Docker image builds the Flutter web client and serves it through Nginx:

```bash
docker compose up --build
# open http://localhost:8080
```

## Android signing

Copy `android/key.properties.example` to `android/key.properties`, point `storeFile` at a local keystore, and keep both the properties file and keystore out of Git. CI expects the keystore as `ANDROID_KEYSTORE_BASE64` plus the matching Gradle properties supplied by the protected release environment.

## Repository map

```text
lib/
├── app/                         # composition root, router, app shell
├── core/                        # config, result/failure types, theme, Drift schema
└── features/
    ├── auth/                    # session boundary and user model
    ├── home/                    # overview and quick actions
    ├── scan_ocr/                # ML Kit adapter boundary
    ├── quiz_generation/         # request model, stream parser, Edge Function client
    ├── question_sets/           # local-first library and demo repository
    ├── study/                   # offline attempt experience
    ├── room_battle/             # room domain and lobby UI
    ├── leaderboard/             # ranking UI boundary
    ├── settings/                # preferences surface
    └── sync/                    # outbox item, engine and conflict resolver
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

1. Domain code remains pure Dart: no Flutter, Drift, Supabase or ML Kit imports.
2. Presentation talks to use cases/repositories through Riverpod providers; it does not reach into data sources.
3. Every local write gets an outbox record. Retries are idempotent using client UUIDs.
4. Room scoring is server-authoritative. The client never receives the answer key before a question closes.
5. Secrets belong in local environment configuration or GitHub Secrets, never in source control.
6. Prefer small feature slices with tests over large cross-cutting rewrites.

## Quality commands

```bash
dart run build_runner build --delete-conflicting-outputs
flutter analyze
flutter test --coverage
./scripts/check_architecture.sh
flutter build web --release
```

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

## License

Academic capstone project. Add the final license and contributor policy before public release.
