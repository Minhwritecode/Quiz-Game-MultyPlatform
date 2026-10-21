# Implementation status

| Area | Base status | Next vertical slice |
| --- | --- | --- |
| React Native shell | Runnable | Add auth gate and native development-build verification |
| Clean Architecture | TypeScript boundaries and domain entities present | Complete use cases and adapters feature by feature |
| Local data | SQLite native schema/outbox adapter present | Add persisted reads and migrations |
| OCR | ML Kit adapter boundary present | Add camera/gallery UI, preprocessing and Vietnamese QA |
| LLM generation | Request model, parser and Edge Function boundary | Implement provider streaming and rate limiting |
| Study mode | Seeded offline demo works | Persist attempts and resume interrupted sessions |
| Realtime battle | Domain contract, lobby UI and SQL RPC base | Implement room lifecycle, Presence and reconnect state machine |
| Sync | Queue model, engine contract and LWW resolver | Wire SQLite + Supabase push/pull and retry backoff |
| CI/CD | GitHub Actions, EAS profile scaffold, manual release workflow and Docker | Link EAS project, signing configuration and protected release environment |
