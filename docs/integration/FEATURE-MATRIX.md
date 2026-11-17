# Reference Feature Matrix

This matrix separates observed reference behavior from Papyrus acceptance scope.
It is not permission to copy implementation code.

**Status checkpoint: 11 November 2026.** The decision column below is intended
scope, not implementation status. For current coverage, all FR-01–FR-17, code
anchors and missing reference-specific features, see
[the implementation audit](STATUS-AUDIT-2026-11-11.md). None of the four products
has full parity. In particular the original table omitted Buzrr duels/bots,
moderation/media/billing, StudyWars host-paced and guest flows, and Dev Quiz
Battle language-specific stats; these are now tracked in that audit's X backlog.

| Capability | QuizPulse | StudyWars | Buzrr | Dev Quiz Battle | Papyrus decision |
| --- | --- | --- | --- | --- | --- |
| Paste notes | Observed | Observed | Observed | Topic-oriented | P0: implement in RN intake |
| PDF/document intake | PDF upload | PDF upload | PDF/DOCX/TXT/Markdown ingestion | Not the primary flow | P0/P1: local paste + image OCR first; document extraction behind a server adapter where feasible |
| On-device OCR | Not verified | Not verified | Server ingestion | Not verified | P0: native ML Kit adapter; image remains local |
| AI quiz by topic | Observed | Observed | Gemini/OpenAI-compatible providers | Groq provider | P0/P1: provider port behind Supabase Edge Function |
| AI quiz from source document | Observed | Observed | RAG/citations | Not primary | P0: confirmed text only; P1 citations only when source spans are traceable |
| Review before save | Observed in product flow | Observed | Product flow documented | Question creation flow | P0: editable question review |
| Manual quiz creation | Observed | Host setup/review | Question types/extensibility | Question mutations | P1: manual editor after generated flow is stable |
| Room code | Observed | Observed | Observed | Six-character code | P0: server-generated six-character code |
| QR/link join | QR mentioned | Join URL/phone flow | QR/link mentioned | Code join | P1: link/QR after code join is stable |
| Realtime multiplayer | Socket.IO | WebSocket | Socket.IO/Redis | Convex reactivity | P0: Supabase Realtime with server RPC/state rules |
| Server-authoritative scoring | Partial app server | Strong room state model | Explicit design | Convex mutations | P0: PostgreSQL RPC and membership/deadline checks |
| Duplicate answer protection | Observed | Room session checks | Answer state checks | Explicit duplicate guard | P0: idempotent `(room, user, position)` key |
| Reconnect | Partial/varies | Connection lease | Server game loop | Not verified | P0: 30-second seat hold per project plan |
| Leaderboard | Observed | Observed | Ranked/ELO scope | Observed | P1: system/friends leaderboard; ELO remains out of scope |
| Offline study | Not primary | Not primary | Not primary | Not primary | P0: Papyrus differentiator; local-first SQLite |
| Sync/outbox | Not primary | Not primary | Not primary | Not primary | P0/P1: Papyrus-specific implementation |

## Canonical Papyrus flow

```text
Guest/Auth
  -> Document intake
  -> Local OCR / paste review
  -> User consent
  -> Protected AI generation
  -> Question review and save
  -> Offline study and persisted attempt
  -> Local outbox sync
  -> Create/join realtime room
  -> Server-authoritative battle and ranking
```
