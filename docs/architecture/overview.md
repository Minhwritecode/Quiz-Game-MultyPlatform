# Papyrus architecture

## Dependency direction

```text
Presentation  ───────▶  Domain  ◀───────  Data
     │                     ▲               │
     └──── Riverpod ───────┴── composition ┘
```

Each feature owns its domain entities, repository contracts and presentation surface. Data adapters implement those contracts. The app composition root is the only place that assembles concrete dependencies.

## Offline-first write path

1. A use case writes the local Drift record.
2. The same transaction appends a `sync_queue` outbox item.
3. Connectivity resumes the sync worker.
4. The worker pushes in `created_at` order with UUID idempotency.
5. The worker pulls records after the saved cursor.
6. Question sets use server `updated_at` last-write-wins; attempts are append-only; deletes are soft deletes.

## Realtime room authority

Supabase owns room state, server timestamps, question windows and scoring. Presence is used for membership; database changes or broadcast events update the UI. The `submit_answer` RPC rejects late or duplicate answers and returns the awarded score.

