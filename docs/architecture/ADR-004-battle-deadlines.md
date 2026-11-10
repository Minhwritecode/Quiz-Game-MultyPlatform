# ADR 004: Fixed server deadlines for speed battles

Date: 2026-11-10. Status: implemented locally, verification in progress.

Each match snapshots its questions in a database transaction. Server timestamps
schedule a three-second countdown, an answer window per question, and a
three-second result interval. Clients cannot extend these windows. Snapshot
reads derive the current phase from server time and persist phase changes.
Consequently a match progresses even with all clients disconnected; the next
snapshot recovers its correct phase without replaying browser timers.

Realtime invalidates room and score projections. A 1.5-second refresh also
handles deadline transitions and missed events. A ten-second heartbeat renews
membership presence. After thirty seconds without a heartbeat, a snapshot
transfers host ownership to the earliest joined live member (UUID breaks ties).
Running-game membership and scores are retained for reconnection. This currently
permits reconnect after thirty seconds too; strict eviction is not implemented.

Only authenticated room members may inspect the room. Before question close,
the RPC returns an allowlist containing the prompt and options, not the original
JSON snapshot. Direct room/player writes are revoked. Answer writes serialize
per player, with the existing unique key providing a second duplicate guard.
Retries return the originally awarded points without another increment.

Ranking uses score descending, join time ascending, UUID ascending. This tie
policy is deterministic but does not yet compare total answer latency.

Limitations: no scheduled cleanup of abandoned rooms, no strict expired-seat
eviction during a running game, and no dynamic early close when everyone answers.
These remain explicit backlog items, not inferred from Realtime presence.
