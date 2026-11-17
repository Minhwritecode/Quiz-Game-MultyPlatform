# Integration Implementation Status

Status date: 11 November 2026. Papyrus is under active implementation, not feature-complete.

| Milestone | Current state | Remaining acceptance |
| --- | --- | --- |
| M0 reference audit | Four local snapshots inventoried; behavior matrix and independent implementation decisions recorded | Full product parity is not achieved; reference expansion backlog X1–X6 remains |
| M1 local study | Local set persistence, sequential study, completed attempt and latest-result screen | Full library CRUD/manual authoring, resume, history, modes and native restart tests |
| M2 auth/sync | Auth/session baseline; explicit account set import, UUID outbox, cursor, retries/conflicts; five cloud migrations deployed | Registration/profile/OAuth completion, automatic/attempt/source sync, account-to-study bridge and authenticated cloud UI proof |
| M3 intake/AI | Camera/gallery/paste, native ML Kit adapter, editable source/question review, Gemini JSON adapter | Hardware OCR QA, PDF/documents, actual provider requests, streaming/cancel/rate limiting and source persistence |
| M4 battle | RPC lifecycle, fixed server deadlines, question privacy, Realtime score, room restore/host lease; local four-client smoke passes | Visible timer, host settings, strict 30-second forfeiture/idle expiry, QR and browser/native/cloud E2E |
| M5 release | CI/Docker/EAS configuration and prior web export | Component/E2E/native suite, accessibility/foldable QA, signed builds and release hardening |

See [the requirement audit](STATUS-AUDIT-2026-11-11.md) for all 17 original
requirements and four-reference gaps, and [delivery evidence](DELIVERY-CHECKLIST.md)
for test/deployment details. Current checks: TypeScript passes, 8 Jest suites /
The 11 November test count is historical. On 16 November, Group A moved the known
Presentation-to-Data accesses behind injected contracts and replaced the import
checker with AST graph checks plus five regression tests. See the Group A checklist
in `../PROJECT-PLAN.md`; native/cloud acceptance remains separate.

No reference source has been merged. The four reference snapshots stay gitignored
and outside the released client source. Reference README claims are not proof of
Papyrus behavior.

### 17 November — Group B update

The earlier baseline table is historical. Account sets now feed the study library with identical UUIDs; completed attempts/answers and source text have durable, owner-scoped sync. Auto-sync wakes on login, foreground/network recovery and periodic retries. Revision/CAS plus explicit resolution replaces timestamp winner selection. See the Group B plan checkpoint for the 82-test, architecture, web export, SQL and two-session local API evidence. This does not close native acceptance, preference sync or the entire reference-repository backlog.
