# Papyrus architecture

Papyrus is React Native + TypeScript-first. The current Flutter/Dart tree is a
transitional baseline; new screens and feature slices belong under `src/`.

## Client dependency direction

```text
React Native screens/components ───▶ Domain/use cases ◀─── Data adapters
             │                              ▲                    │
             └── Zustand + TanStack Query ──┴── Expo/Supabase/SQLite
```

The UI never queries Supabase or SQLite directly. Feature services depend on
typed domain ports, while the composition root wires concrete adapters.

The complete target tree and migration rules live in
[react-native-first.md](react-native-first.md).

## Dependency direction

```text
Presentation (RN screens/hooks) ─────▶ Domain ◀───── Data adapters
             │                            ▲              │
             └── Zustand + Query ─────────┴── composition ┘
```

Each feature owns its domain entities, repository contracts and presentation surface. Data adapters implement those contracts. The React Native app composition root is the only place that assembles concrete dependencies; the Riverpod/go_router wiring in `lib/` is transition-only.

## Offline-first write path

1. A use case writes the local SQLite record.
2. The same transaction appends a `sync_queue` outbox item.
3. Connectivity resumes the sync worker.
4. The worker pushes in `created_at` order with UUID idempotency.
5. The worker pulls records after the saved cursor.
6. Question sets use server `updated_at` last-write-wins; attempts are append-only; deletes are soft deletes.

## Realtime room authority

Supabase owns room state, server timestamps, question windows and scoring.
Presence is used for membership; database changes or broadcast events update
the UI. The `submit_answer` RPC rejects late or duplicate answers and returns
the awarded score.

## Transitional Flutter boundary

`lib/` remains available for the existing demo and Dart adapters. It is not the
target location for new UI. A feature may be removed from the transitional
tree only after the equivalent React Native screen, state, data adapter and
tests have passed review.
