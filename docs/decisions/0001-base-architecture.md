# ADR 0001 Base architecture

## Decision

Use Flutter with feature-oriented Clean Architecture, Riverpod for composition/state, Drift for local relational data and Supabase for auth, PostgreSQL, RLS, Realtime and Edge Functions.

## Context

The capstone requires a mobile-first product that remains useful offline, demonstrates an explicit three-layer boundary and supports an authenticated realtime battle mode.

## Consequences

- Domain tests can run without Flutter, device plugins or a network.
- Local-first behavior is a first-class data contract instead of a screen-level workaround.
- Native integrations remain behind data adapters.
- The initial base has more files than a tutorial app, but each file corresponds to a requirement or boundary in the specification.

