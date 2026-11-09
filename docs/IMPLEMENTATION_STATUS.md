# Implementation status

| Area | Base status | Next vertical slice |
| --- | --- | --- |
| React Native shell | Runnable | Add auth gate and native development-build verification |
| Clean Architecture | TypeScript boundaries and domain entities present | Complete use cases and adapters feature by feature |
| Local data | SQLite native + web AsyncStorage persistence baseline for question sets and attempts | Add versioned migrations, resume state and sync queue hydration tests |
| OCR | ML Kit adapter boundary present | Add camera/gallery UI, preprocessing and Vietnamese QA |
| LLM generation | Server-side Gemini-compatible adapter, structured JSON validation and client parser baseline | Add streaming, provider retries/rate limits and citation-aware review |
| Study mode | Offline study persists completed attempts and renders a result screen | Persist resume checkpoints, attempt history and interruption recovery |
| Realtime battle | Domain contract, lobby UI and SQL RPC base | Implement room lifecycle, Presence and reconnect state machine |
| Sync | Queue model, engine contract and LWW resolver | Wire SQLite + Supabase push/pull and retry backoff |
| CI/CD | GitHub Actions, EAS profile scaffold, manual release workflow and Docker | Link EAS project, signing configuration and protected release environment |
