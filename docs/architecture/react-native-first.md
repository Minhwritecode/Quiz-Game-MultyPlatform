# React Native architecture

## Decision

Papyrus uses React Native with TypeScript as its only client architecture.
Expo and Expo Router provide the application shell, Zustand owns local UI
state, TanStack Query owns server state, `expo-sqlite` provides native local
persistence, and Supabase provides auth, PostgreSQL, RLS, Realtime and Edge
Functions.

## Recommended stack

| Concern | Choice | Reason |
|---|---|---|
| App runtime | Expo + React Native + TypeScript | Shared native UI with web preview and a development-build escape hatch |
| Routing | Expo Router | File-based routes, typed routes and deep links |
| State | Zustand | Small explicit client state |
| Server state | TanStack Query | Cache, retries, invalidation and request lifecycle |
| Forms/validation | React Hook Form + Zod | Typed form state and reusable validation contracts |
| Backend | Supabase | Auth, PostgreSQL, RLS, Realtime and Edge Functions |
| Local persistence | `expo-sqlite` | Native persistent cache and transactional sync outbox |
| OCR | ML Kit through an Expo development build | On-device processing and privacy-preserving capture |
| UI | React Native primitives + Papyrus tokens | Accessible, responsive and Figma-aligned UI |
| Testing | Jest, React Native Testing Library and Maestro/Detox | Domain, component and device-flow coverage |
| Delivery | EAS Build/Submit/Update + GitHub Actions | Reproducible native builds and updates |

## Source tree

```text
src/
├── app/
│   ├── _layout.tsx                 # Query client, safe-area and route shell
│   ├── index.tsx                   # Home and learning pulse
│   ├── auth.tsx                    # Auth and guest entry
│   ├── sets.tsx                    # Offline question-set library
│   ├── create/                     # Source capture and generation review
│   ├── study/[setId].tsx           # Offline study loop
│   ├── battle.tsx                  # Room create/join flow
│   ├── leaderboard.tsx             # Results and rank surface
│   └── settings.tsx                # Preferences and local data
├── core/
│   ├── config/                     # Runtime environment and feature flags
│   ├── database/                   # SQLite native/web adapters
│   ├── domain/                     # Framework-free entities and rules
│   ├── network/                    # Supabase client boundary
│   ├── state/                      # Zustand stores
│   └── theme/                      # Papyrus tokens and palettes
├── features/
│   ├── auth/
│   ├── question-sets/
│   ├── quiz-generation/
│   ├── scan-ocr/
│   ├── room-battle/
│   └── sync/
├── shared/                         # Reusable accessible UI primitives
└── test/                           # Future component test setup

supabase/                           # Shared backend schema and Edge Functions
```

## Dependency rules

1. Domain code does not import React Native, Expo, Supabase or SQLite.
2. Screens call feature services and state/query adapters; they do not query
   infrastructure directly.
3. Data adapters implement domain contracts and own platform integrations.
4. Every local write is paired with an outbox record in the same transaction.
5. Battle timing, answer validation and scoring remain server-authoritative.
6. Web-only builds must not import native SQLite or ML Kit modules.

## Migration result

The former Flutter client and its native projects were removed from the main
checkout after conversion. The previous implementation remains recoverable
from Git history, while the current branch has one React Native runtime and one
TypeScript source of truth.

## Vertical slices

```text
Auth → Home/Library → OCR/Generation → Offline Study → Realtime Battle
```
