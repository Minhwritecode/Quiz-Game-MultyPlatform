# React Native source boundary

This directory is the approved home for all new Papyrus client work.

The target client is React Native + TypeScript with Expo. The planned layout is:

```text
src/
├── app/          # Expo Router routes, root providers and error boundary
├── core/         # config, domain, database, network, theme and UI primitives
├── features/     # auth, home, OCR, generation, study, battle and sync slices
├── shared/       # reusable hooks, types, constants and utilities
└── test/         # factories, mocks and test setup
```

Keep domain contracts framework-free. Screens call use cases and state/query
adapters; they do not access Supabase or SQLite directly. Native-only modules
must stay behind feature data adapters and platform-specific files.

The first real React Native vertical slice is planned as:

```text
Auth → Home/Library → OCR/Generation → Offline Study → Realtime Battle
```

This boundary is committed alongside the Expo shell so the team has one
React Native source of truth for every future feature.
