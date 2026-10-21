# ADR 0001 Base architecture

## Decision

Use React Native with TypeScript as the client architecture, Expo and Expo
Router for the application shell, Zustand for local UI state, TanStack Query
for server state, expo-sqlite for the local-first cache, and Supabase for auth,
PostgreSQL, RLS, Realtime and Edge Functions.

## Context

The capstone requires a mobile-first product that remains useful offline, demonstrates an explicit three-layer boundary and supports an authenticated realtime battle mode.

## Consequences

- TypeScript domain tests can run without React Native, device plugins or a network.
- Local-first behavior is a first-class data contract instead of a screen-level workaround.
- Native integrations remain behind data adapters.
- The initial base has more files than a tutorial app, but each file corresponds to a requirement or boundary in the specification.
- Native-only modules are isolated behind platform-specific adapters so web and
  mobile can share the same TypeScript feature code.

See [React Native-first architecture](../architecture/react-native-first.md)
for the target tree and migration order.
