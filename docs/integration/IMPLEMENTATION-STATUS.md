# Integration Implementation Status

**Status date:** 10 November 2026

| Milestone | Status | Evidence | Remaining work |
| --- | --- | --- | --- |
| M0 audit and compatibility | Implemented | `SOURCE-AUDIT.md`, `FEATURE-MATRIX.md`, `REUSE-DECISIONS.md` | Confirm remote source SHAs only if source reuse is ever proposed |
| M1 local library → study → persisted result | Implemented baseline | `src/features/study/domain/completeAttempt.ts`, `src/app/study/result.tsx`, native SQLite and web AsyncStorage adapters; 5 passing tests | Resume interrupted sessions, attempt history, migration tests and device restart evidence |
| M2 auth → Supabase → sync | Auth/session and local outbox baseline | Auth repository/session bootstrap, guest fallback, OAuth URL boundary, native SQLite/web queue adapters and 2 drain tests | Native redirect completion, owner-bound cloud push/pull, cursor sync, retry backoff and RLS tests |
| M3 intake → OCR → AI → review | AI generation baseline | Native intake feeds confirmed text; `supabase/functions/generate-questions` now uses a server-side Gemini-compatible provider adapter and strict question validation; client parser has 2 tests | Camera/permissions, true streaming, citations, editable review and source persistence |
| M4 battle → authoritative score → reconnect | Battle contract baseline | `roomState` reducer/tests, room repository/Realtime adapter and additive server-authoritative create/join/question/answer RPC migration | Seed room questions, wire lobby UI, presence lifecycle, reconnect and two-client evidence |
| M5 responsive web/release hardening | Base only | Expo web export, Docker and EAS profiles | Accessibility, device matrix, signed build and security evidence |

## Evidence labels

- **Implemented:** code path exists and has a passing automated or repeatable
  verification.
- **Base only:** contract/scaffold exists; production behavior is not complete.
- **Mock/demo:** deterministic sample data or UI behavior; not a provider-backed
  production path.
- **Unverified:** code exists but requires credentials, native build or real
  devices to confirm.
- **Not started:** no implementation exists yet.

No reference repository code has been merged into Papyrus. The four local
reference folders are ignored by Git and remain outside the release source tree.
