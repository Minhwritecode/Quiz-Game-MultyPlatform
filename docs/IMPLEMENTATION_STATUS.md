# Implementation status

| Area | Base status | Next vertical slice |
| --- | --- | --- |
| Flutter shell | Runnable | Add auth gate and responsive navigation tests |
| Clean Architecture | Boundaries and domain entities present | Complete use cases and adapters feature by feature |
| Local data | Drift schema, default connection and transactional repository present | Wire production provider and add migrations |
| OCR | ML Kit adapter boundary present | Add camera/gallery UI, preprocessing and Vietnamese QA |
| LLM generation | Request model, parser and Edge Function boundary | Implement provider streaming and rate limiting |
| Study mode | Seeded offline demo works | Persist attempts and resume interrupted sessions |
| Realtime battle | Domain contract, lobby UI and SQL RPC base | Implement room lifecycle, Presence and reconnect state machine |
| Sync | Queue model, engine contract and LWW resolver | Wire Drift + Supabase push/pull and retry backoff |
| CI/CD | CI, Fastlane, manual release workflow and Docker | Add signing configuration and protected release environment |
