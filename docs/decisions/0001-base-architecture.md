# ADR 0001 Base architecture

## Decision

Use React Native with TypeScript as the primary client architecture, Expo and
Expo Router for the application shell, Zustand for local UI state, TanStack
Query for server state, expo-sqlite for the local-first cache, and Supabase for
auth, PostgreSQL, RLS, Realtime and Edge Functions. Keep the existing
Flutter/Dart implementation as a transitional baseline until each vertical
slice is migrated and covered by tests.

## Context

The capstone requires a mobile-first product that remains useful offline, demonstrates an explicit three-layer boundary and supports an authenticated realtime battle mode.

## Consequences

- TypeScript domain tests can run without React Native, device plugins or a network.
- Local-first behavior is a first-class data contract instead of a screen-level workaround.
- Native integrations remain behind data adapters.
- The initial base has more files than a tutorial app, but each file corresponds to a requirement or boundary in the specification.
- The current Dart baseline remains useful during migration, but new screens and
  architecture code must be placed under `src/` and follow the RN boundary.

See [React Native-first architecture](../architecture/react-native-first.md)
for the target tree and migration order.
