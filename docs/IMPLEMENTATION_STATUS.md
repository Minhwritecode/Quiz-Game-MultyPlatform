# Implementation status

| Area | Base status | Next vertical slice |
| --- | --- | --- |
| React Native target shell | Architecture defined | Bootstrap Expo shell and migrate Auth/Home/Library |
| Flutter transition shell | Runnable | Keep deterministic demo stable during migration |
| Clean Architecture | Transition boundaries and domain entities present | Recreate contracts in pure TypeScript feature slices |
| Local data | Drift schema, default connection and transactional repository present | Add `expo-sqlite` parity and migrations |
| OCR | ML Kit adapter boundary present | Add camera/gallery UI, preprocessing and Vietnamese QA |
| LLM generation | Request model, parser and Edge Function boundary | Implement provider streaming and rate limiting |
| Study mode | Seeded offline demo works | Persist attempts and resume interrupted sessions |
| Realtime battle | Domain contract, lobby UI and SQL RPC base | Implement room lifecycle, Presence and reconnect state machine |
| Sync | Queue model, engine contract and LWW resolver | Wire SQLite + Supabase push/pull and retry backoff |
| CI/CD | CI, Fastlane, manual release workflow and Docker | Add EAS profiles, signing configuration and protected release environment |
