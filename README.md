# Papyrus

> From Ancient Scroll to AI Power.

Papyrus is a React Native + TypeScript-first, offline-first learning quiz platform for turning personal study material into reviewable question sets and realtime 2–4 player quiz battles. OCR stays on-device; only user-confirmed text is sent to the protected generation endpoint.

This repository is the Capstone base for QuizClash. It contains the React Native production-shaped skeleton, architecture boundaries, local/cloud data contracts, CI/CD scaffolding and a runnable mobile/web demo slice. It does not claim that provider credentials, native OCR, LLM streaming or the realtime battle vertical slice are complete yet.

## Product scope

- Expo Router mobile/web client with responsive Papyrus UI and typed feature boundaries.
- Clean Architecture by feature: `Presentation → Domain ← Data`.
- Zustand and TanStack Query for local UI state and server state.
- `expo-sqlite` native adapter for the local-first cache and sync outbox.
- Supabase migration with RLS, Realtime-ready room tables and server-side `submit_answer` scoring RPC.
- On-device ML Kit OCR adapter boundary.
- Edge Function boundary for authenticated, rate-limited LLM generation.
- Offline-first sync contract: local write, ordered push, cursor pull, server-time conflict resolution.
- GitHub Actions, EAS build profiles and Docker web preview.

## Quick start

```bash
npm install
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

The app intentionally runs with a seeded in-memory repository when those values are absent, so the navigation, library and study-mode demo are usable without secrets.

## Docker

The Docker image builds the React Native web export and serves it through Nginx. Native mobile builds are delivered through Expo/EAS:

```bash
docker compose up --build
# open http://localhost:8080
```

## Native release

Native signing and credentials are managed by EAS. Link the app once with
`npx eas-cli@latest init`, set `EXPO_TOKEN` in CI, and use the `development`,
`preview` or `production` profiles in `eas.json`.

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
docs/reports/                     # Capstone proposal and architecture reports
eas.json                         # EAS development, preview and production profiles
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
# React Native quality lane
npm run typecheck
npm test
./scripts/check_architecture.sh
npx expo export --platform web
```

Native OCR and platform-specific SQLite are verified in an Expo development
build; the web export uses platform-safe adapters.

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
