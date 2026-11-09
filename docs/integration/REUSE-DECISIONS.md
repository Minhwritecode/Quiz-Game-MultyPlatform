# Reuse and Integration Decisions

## Decision 001 - No direct source-code merge

| Field | Decision |
| --- | --- |
| Repositories | QuizPulse, StudyWars, Buzrr, Dev Quiz Battle local snapshots |
| Source commit | Not available: snapshots have no nested `.git` metadata |
| Files copied | None |
| License review | QuizPulse and Dev Quiz Battle have no repo-level license found; StudyWars is MIT; Buzrr is AGPL-3.0 |
| Functionality retained | Product ideas, state names, validation concerns and behavior patterns only |
| Conversion | Independent TypeScript implementation behind Papyrus Domain ports and Supabase adapters |
| Risk | Feature behavior may differ from references; verify against Papyrus specification and tests |
| Required tests | Domain tests, repository tests, RLS/RPC tests and real-device smoke flows |
| Status | Approved for pattern-level reuse; source-code reuse prohibited for now |

## Decision 002 - One Papyrus backend system

Papyrus will not embed MongoDB, Redis, Convex, NestJS, FastAPI or a second
Socket.IO backend just because references use them. Supabase PostgreSQL, RLS,
Realtime and Edge Functions remain the single backend system. A new service may
only be proposed through an ADR with a measured requirement, operational cost,
security impact and explicit approval.

## Decision 003 - Provider abstraction without provider leakage

Gemini and OpenAI-compatible generation patterns from the references are useful,
but provider SDKs stay server-side. The app consumes one validated streaming
contract. The client never receives provider keys, and a provider response is not
accepted until it passes the Papyrus question schema.

## Decision 004 - Server-authoritative room state

Papyrus adopts the strongest common behavior from the reference implementations:
server time, room membership, round deadlines, answer uniqueness and score
calculation are authoritative. Client UI is a projection of state, not the owner
of the game loop.
