# Reference Source Audit

**Audit date:** 10 November 2026  
**Target:** Papyrus repository  
**Purpose:** Evaluate four local reference repositories before integrating any product idea or implementation.

## Audit rules

- The Papyrus repository and `docs/PROJECT-PLAN.md` remain the source of truth.
- Public availability is not treated as permission to copy code.
- The four folders are local snapshots without nested `.git` directories, so a
  reliable source commit SHA is not available from the workspace.
- No code, asset, schema, dependency lockfile or generated artifact from these
  snapshots has been copied into Papyrus during this audit.
- High-level product patterns may inform an independent Papyrus implementation.

## Source inventory

| Local folder | Snapshot evidence | Main technologies observed | License status | Integration decision |
| --- | --- | --- | --- | --- |
| `QuizPulse-main/` | Snapshot modified 14 July 2026; no nested `.git` | React/Vite/TypeScript client; Node/Express/TypeScript server; MongoDB/Mongoose; Socket.IO; Gemini; PDF parsing | No repo-level `LICENSE` or `NOTICE` found | Patterns only. No source reuse until a license is supplied and reviewed. |
| `StudyWars-master/` | Snapshot modified 29 October 2026; no nested `.git` | React/Vite client; FastAPI/Python server; Redis; WebSocket; PDF/text ingestion; LLM | MIT license present, copyright Ayuse 2026 | MIT permits reuse with notice preservation, but Papyrus uses an independent implementation to avoid framework and architecture coupling. |
| `buzrr-main/` | Snapshot modified 6 November 2026; no nested `.git` | Next.js web; NestJS server; optional Python AI service; Prisma/PostgreSQL; Redis; Socket.IO; Gemini/OpenAI-compatible providers | AGPL-3.0 license present | No code reuse. Copyleft and network-source obligations require a separate legal decision before any derivative integration. |
| `dev-quiz-battle-main/` | Snapshot modified 2 April 2026; no nested `.git` | Next.js/React; Convex; Convex Auth; Groq; Tailwind; realtime game mutations | No repo-level `LICENSE` or `NOTICE` found | Patterns only. No source reuse until a license is supplied and reviewed. |

## Files and behavior inspected

### QuizPulse

- `README.md`, client/server manifests.
- `server/src/features/ai/ai.service.ts`: Gemini prompt, retry and JSON parsing.
- `server/src/features/game/game.service.ts`: current question, duplicate answer
  rejection and score updates.
- `server/src/features/room/room.service.ts`: room code and player join model.
- `client/src/features/player/hooks/useSubmitAnswer.ts`: Socket.IO answer event.

### StudyWars

- `README.md`, `LICENSE`, `pyproject.toml`, client/server manifests.
- `server/app/rooms.py`: server-side room state, connection leases and speed score.
- `server/app/ai.py`: provider boundary and retry behavior.
- `server/app/routers/ws.py`: WebSocket room event flow.
- Host lobby and player answer components.

### Buzrr

- `README.md`, `LICENSE`, `ARCHITECTURE.md`, workspace manifests.
- `apps/server/src/common/llm/*`: provider abstraction and Gemini adapter.
- `apps/server` game modules: server-authoritative room/game responsibilities.
- `apps/ai/src/buzrr_ai/ingestion/pipeline.py`: document ingestion/chunking/vector
  pipeline and lifecycle handling.

### Dev Quiz Battle

- `README.md`, client manifest and Convex functions.
- `convex/mutations/games.ts`: room code, host, join and player capacity.
- `convex/mutations/answers.ts`: duplicate answer guard and score mutation.
- `convex/queries/games.ts`: reactive room/player view.
- `convex/actions/questions.ts`: authenticated AI generation and validation.

## Important findings

1. The references collectively validate the product shape: document intake,
   AI generation, review, room codes, realtime answers, scoring and ranking.
2. They use incompatible backend/runtime stacks. Combining them literally would
   violate the Papyrus single-architecture and single-data-system requirements.
3. Several reference implementations trust client-provided identifiers or keep
   game transitions in application code. Papyrus will retain server-side
   identity, membership, deadline and idempotency checks as required by the plan.
4. Reference source snapshots are useful for behavior comparison, but they are
   not production evidence for Papyrus.

## License conclusion

Papyrus does not currently contain reused code from these four snapshots, so no
`THIRD_PARTY_NOTICES.md` is needed for them at this stage. If a future pull
request copies any MIT file, it must preserve the MIT notice. AGPL code must not
be copied into Papyrus without an explicit compatibility decision and source
distribution plan. Unlicensed code must not be copied without written permission
or a newly verified license.
