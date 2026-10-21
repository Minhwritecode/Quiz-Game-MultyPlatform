# React Native-first architecture

## Decision

Papyrus will use React Native with TypeScript as the primary client stack. New
screens, navigation, shared UI, feature contracts and application services are
implemented under `src/`. The existing Flutter/Dart implementation under `lib/`
is retained as a transitional baseline so the current demo and domain work are
not discarded or rewritten without a vertical-slice plan.

This is a migration boundary, not a second competing product. React Native is
the source of truth for all new UI work; Dart is used only where an existing
Flutter adapter is still the fastest safe bridge during migration.

## Recommended stack

| Concern | Choice | Reason |
|---|---|---|
| App runtime | Expo + React Native + TypeScript | Fast iteration, native build escape hatch, iOS/Android/web reach |
| Routing | Expo Router | File-based routes, typed routes, deep links and responsive tab/stack layouts |
| State | Zustand | Small, explicit client state without provider boilerplate |
| Server state | TanStack Query | Cache, retries, invalidation and offline-aware request lifecycle |
| Forms/validation | React Hook Form + Zod | Typed form state and shared validation contracts |
| Backend | Supabase | Auth, PostgreSQL, RLS, Realtime, Storage and Edge Functions |
| Local persistence | expo-sqlite; Drizzle when schema scale requires it | Typed local-first cache and transactional outbox |
| OCR | ML Kit through an Expo development build/config plugin | On-device OCR without putting source images on the server |
| UI | React Native primitives + Papyrus tokens/components | Accessible, responsive and Figma-aligned UI |
| Testing | Jest, React Native Testing Library, Maestro/Detox | Unit, component and device-flow coverage |
| Delivery | EAS Build/Submit/Update + GitHub Actions | Reproducible native builds and over-the-air JS updates |

Expo Go is useful for early UI work, but native OCR and other custom native
modules should use a development build. This keeps the team productive without
locking the production architecture to the playground client.

## Target tree

```text
src/
├── app/
│   ├── _layout.tsx                 # Root providers, theme and error boundary
│   ├── (auth)/                     # Login, guest entry and recovery routes
│   ├── (tabs)/                     # Home, Library, Battle, Rank, Settings
│   ├── create/                     # OCR and generation flow
│   ├── study/[setId].tsx           # Offline study
│   └── battle/[roomId].tsx         # Realtime battle
├── core/
│   ├── config/                     # Runtime env and feature flags
│   ├── database/                   # SQLite schema, migrations and outbox
│   ├── errors/                     # AppError and typed failure mapping
│   ├── navigation/                 # Typed route contracts and deep links
│   ├── network/                    # Supabase client and query defaults
│   ├── theme/                      # Papyrus tokens and light/dark themes
│   └── ui/                         # Accessible primitives and layout helpers
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
│   ├── constants/
│   ├── hooks/
│   ├── types/
│   └── utils/
└── test/
    ├── factories/
    ├── mocks/
    └── setup.ts

lib/                                # Transitional Flutter/Dart baseline
supabase/                            # Shared backend contracts and migrations
docs/                                # Reports, ADRs and architecture decisions
```

## Rules for the transition

1. New UI is React Native/TypeScript. Do not add new Flutter screens unless a
   migration blocker is documented in an ADR.
2. Domain models shared with the RN client live in TypeScript first. The Dart
   model remains only until its corresponding feature slice is migrated and
   tested.
3. Figma screens map to `src/app` routes and reusable components map to
   `src/core/ui` or the owning feature.
4. Supabase remains the backend contract for both clients during migration;
   RLS, Edge Functions and server-authoritative battle scoring do not change.
5. Avoid a big-bang rewrite. Migrate vertical slices in this order:
   authentication → home/library → OCR/generation → offline study → battle.
6. A feature is considered migrated only when its screen, state, data adapter,
   tests and route are TypeScript-based.

## Why React Native is the best fit here

Papyrus is interaction-heavy and UI-led: forms, cards, gestures, camera/OCR,
realtime battle states and responsive foldable layouts all benefit from a
shared React component model. TypeScript keeps domain contracts explicit while
Expo lets the team start quickly and still move to development builds when
native modules are required. React Native is therefore the primary choice;
Dart is a temporary compatibility tool, not the future architecture.
