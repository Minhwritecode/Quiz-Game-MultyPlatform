# Implementation status

| Area | Base status | Next vertical slice |
| --- | --- | --- |
| React Native shell | Runnable with guest/auth session bootstrap | Add native development-build verification and route policy |
| Clean Architecture | TypeScript boundaries and domain entities present | Complete use cases and adapters feature by feature |
| Local data | SQLite native + web AsyncStorage persistence baseline for question sets and attempts | Add versioned migrations, resume state and sync queue hydration tests |
| OCR | ML Kit adapter boundary present | Add camera/gallery UI, preprocessing and Vietnamese QA |
| LLM generation | Server-side Gemini-compatible adapter, structured JSON validation and client parser baseline | Add streaming, provider retries/rate limits and citation-aware review |
| Study mode | Offline study persists completed attempts and renders a result screen | Persist resume checkpoints, attempt history and interruption recovery |
| Realtime battle | Room state reducer, Supabase room repository/Realtime adapter and server-authoritative RPC migration baseline | Seed room questions, wire lifecycle UI, Presence and reconnect state machine |
| Sync | SQLite/web outbox persistence, coalesced writes and tested drain contract | Wire authenticated Supabase push/pull, cursor and retry backoff |
| CI/CD | GitHub Actions, EAS profile scaffold, manual release workflow and Docker | Link EAS project, signing configuration and protected release environment |
