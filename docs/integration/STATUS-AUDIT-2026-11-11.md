# Papyrus: implementation and reference coverage audit

Audit date: 11 November 2026. Code baseline: `7dd8d9b`.

**Conclusion: neither the original Capstone scope nor all four reference products
are complete.** Papyrus has a runnable React Native base with implemented local
study, account question-set sync and server-controlled battle slices. Cloud
database deployment is complete; authenticated cloud UI/device acceptance is not.

This audit reads the original `QuizClash_DacTa_KeHoach.docx`, the project plan,
the four local reference READMEs, representative source modules and current
Papyrus code. It is not a line-by-line audit or runtime certification of the four
references. Their advertised future features are not counted as delivered features.
No percentage is reported: scaffolds, working code and device acceptance have
different completion criteria.

## 1. Original specification: all 17 functional requirements

| ID | Requirement | Current evidence | Missing acceptance work | Plan phase |
| --- | --- | --- | --- | --- |
| FR-01 | Auth/profile | Password login/logout, session bootstrap, guest path; Google URL entry point | Registration, recovery/profile editing, OAuth callback, session error/component tests and cloud app login evidence | 4 |
| FR-02 | Camera/gallery/paste | Real ImagePicker permission/cancel path; sequential OCR for up to 10 gallery images; paste UI | Native hardware evidence, page reorder/recapture and complete capture-session UX | 5 |
| FR-03 | On-device OCR | Native ML Kit Latin adapter; web paste fallback | Vietnamese accuracy, offline/device memory and failure evidence | 5 |
| FR-04 | Edit source text | Editable multiline input and 30,000-character limit | Source selection/highlighting and durable source-document storage | 5 |
| FR-05 | AI generation | Gemini server adapter, JSON validators and client parser; count/difficulty controls | Provider secrets/deployment and live requests, real SSE streaming, cancel/retry/rate limit, language selector (currently English) | 6 |
| FR-06 | Review/save | Edit text/options/explanation/correct answer, remove questions, validated local save | Per-question regeneration; set title/subject/tag editor; component/provider flow evidence | 6–7 |
| FR-07 | Offline generation queue | No durable generation-job implementation | Queue, retry scheduling, cancellation and reconnect recovery | 6 |
| FR-08 | Set management | Local save/list/search; account-copy tombstones | Local rename/duplicate/delete/detail/manual-create UI; account deletion is not full local CRUD | 7 |
| FR-09 | Offline study | Sequential answers, explanations, completed attempt/result persistence | Timed/random/incorrect-only modes; airplane-mode/native restart evidence | 7 |
| FR-10 | History/statistics | Completed attempts stored; latest result lookup | History screen/query, statistics, frequently wrong questions | 7 |
| FR-11 | Create battle | RPC generates six-character codes and validates owner; local API tests pass | Host settings UI: screen currently fixes 10 questions, 15 seconds, speed; cloud/device acceptance | 8 |
| FR-12 | Join/lobby | Join/leave/ready/start, 2–4 players, fifth-player denial; live roster | Heartbeat is used instead of Supabase Presence; disconnect/seat expiry and cloud/device acceptance | 8 |
| FR-13 | Realtime battle | Fixed server deadlines, snapshot polling plus Realtime score refresh, answer privacy, idempotency | Visible countdown UI (serverTime/closesAt are not rendered as a timer), all-answered early transition, two-device evidence | 8 |
| FR-14 | Game modes | Speed score implemented/tested on server | Survival is only represented by schema fields/mode name, not a complete game mode | 8 / P2 |
| FR-15 | Results/leaderboard | In-room scores/final ranking and persisted room records | Global/friends leaderboard, user match-history view; leaderboard screen still hardcoded | 8 / P1 |
| FR-16 | Two-way sync | Owner-scoped UUID account copies, atomic local envelope, RPC receipt/revision, cursor, manual sync/conflict choice; local integration tests; cloud schema deployed | Automatic/background sync; study attempt/answer/source sync; integrate pulled sets with offline study library; device crash/restart E2E | 3, 9 |
| FR-17 | Settings | System light/dark palette, preference switches, logout, link to account sync | Explicit light/dark/system selector, actual localization, complete local-data controls and persisted preference verification | 10 |

None of the four original end-to-end use cases passes its full device gate yet:
UC-01 needs live AI/streaming/native OCR; UC-02 needs resume/history; UC-03 needs
timer/reconnect/device proof; UC-04 needs automatic sync across all required entities.

## 2. Four-reference comparison

| Reference | Papyrus overlap today | Remaining parity gaps | Source anchors |
| --- | --- | --- | --- |
| QuizPulse | Room codes, realtime room score, duplicate-answer protection, editable generated-question review | PDF-to-quiz, dedicated topic generation, manual quiz creation and full quiz management, QR, live provider proof | `README.md` Features; `server/src/features/ai/pdf.service.ts`; `server/src/features/quiz/quiz.routes.ts`; `server/src/features/game/game.service.ts` |
| StudyWars | Server-controlled questions/reveals, room state persistence, reconnect snapshot and host lease handling | PDF ingestion, no-account name/code join, separate big-screen host/player views, host-paced reveal/advance, visible countdown, inactive-room expiry and reconnect UI evidence | `README.md` Features; `server/app/rooms.py`; `server/app/pdf_utils.py` |
| Buzrr | Code-based room flow, authoritative score, initial Gemini adapter | QR, guest rooms, kick/ban; ranked duels/ELO/matchmaking/bots; knowledge spaces and document RAG/citations; multiple providers/Ollama; moderation; image questions/storage; pluggable question types; billing; full offline self-host deployment | `README.md` Features; `apps/server/src/modules/moderation`; `common/utils/elo.ts`, `duel-bot.ts`; `common/llm`, `common/storage`; `apps/ai/src/buzrr_ai/ingestion` |
| Dev Quiz Battle | Authenticated rooms, reactive score, answer mutation checks, light/dark primitives | Programming-language/topic generation and code rendering, per-language/global leaderboard, profile game statistics, difficulty-based scoring and cloud end-to-end proof | `README.md` Features; `convex/queries/leaderboard.ts`; `convex/actions/questions.ts`; `convex/mutations/answers.ts` |

Overlap is behavioral reimplementation, not merged reference source code. The
four snapshots remain outside Papyrus's tracked client/release tree. Presence of
a similarly named screen or SQL table does not establish feature parity.

## 3. Plan alignment and unresolved design differences

- Original FR-01–FR-17 are represented by the plan phases, but acceptance remains
  incomplete. PDF/QR/manual authoring/reference-specific features need the
  integration backlog in addition to the original Capstone plan.
- ELO, global matchmaking, purchases/chat and advanced moderation were explicitly
  excluded by the original specification. The later request to consider all four
  repositories is broader. These are recorded below as unimplemented reference
  backlog, not silently discarded or marked complete. They do not replace P0 work.
- The original sync specification uses server-timestamp last-write-wins. Current
  account sync uses a server revision cursor and explicit local/server conflict
  choice. `chooseLatest` exists but is not the active account-sync policy. This is
  a documented implementation deviation; the original acceptance item stays open.
- Original sync writes local data automatically. Current account sync requires
  explicit import from the shared device library and manual Sync now; downloaded
  account copies are not yet hydrated into the local study library.
- Original room recovery treats disconnection beyond 30 seconds as forfeiture and
  expires idle room codes after 30 minutes. Current heartbeat/host transfer does
  not implement those complete policies. UI has no numeric countdown yet.
- Presentation is under Expo Router `src/app`, while feature Domain/Data ports
  exist. Strict architecture is not complete: scan and generation screens import
  Data adapters directly, battle uses AsyncStorage in the screen, and some study
  rules remain screen-owned. The current regex import checker misses these paths;
  a passing check is not full Clean Architecture certification.
- `src/core/sync/syncEngine.ts` retains an unused direct-upsert path incompatible
  with the new RPC-only write permissions. Remove or replace it before reuse.
- Auth's empty form currently navigates home; unconfigured password auth returns
  no error. These are baseline shortcuts to fix, not verified login behavior.
- Reports/Figma, Docker reproducibility, signed builds and physical foldable
  layouts have not been re-certified by this audit.

## 4. Evidence and limits

- Rechecked TypeScript, Jest and existing architecture script during this audit;
  current Jest suite contains 16 tests across 8 files.
- Prior local evidence: two SQL battle suites, four independent authenticated
  API clients with Realtime and concurrent-answer retry, account sync isolation/
  conflict/tombstone smoke. These are not browser/component/native tests.
- Prior web export succeeded. No new export is required for these documentation edits.
- Cloud deployment: five migrations, 11 public tables with RLS, ten protected
  battle/sync RPCs and room/player Realtime publication. Anonymous-denial probes
  passed; authenticated cloud app sessions have not been tested end to end.
- No component/E2E/native suite or signed-build evidence exists yet. Security
  Advisor WARN findings and limits are recorded in `DELIVERY-CHECKLIST.md`.

## 5. Ordered acceptance backlog

- [ ] A1: Complete app registration/profile/session/OAuth; prove two independent cloud app sessions.
- [ ] A2: Move scan/generation/storage access behind ports/composition and strengthen the architecture checker.
- [ ] A3: Validate account sync through UI, bridge account downloads into study, then add automatic and attempt/source sync with crash/restart tests.
- [ ] A4: Add battle host settings and visible server-based timer, full disconnect/forfeit/idle-expiry rules and two-browser/device E2E.
- [ ] A5: Deploy/configure AI; implement streamed validated output, cancellation, retry and quotas with source-to-save evidence.
- [ ] A6: Finish native camera/OCR QA, PDF/DOCX/TXT/Markdown intake and durable source provenance.
- [ ] A7: Finish manual authoring/local CRUD, resume, study modes, history and statistics.
- [ ] A8: Add QR render/scan and cold/warm links, global/friends rankings and match history.
- [ ] A9: Add component/native/security coverage, accessibility/foldable QA, signed builds and report/Figma reconciliation.

Reference expansion after core acceptance (unimplemented, not promised by the
original 13-week Capstone schedule):

- [ ] X1: Guest/name join, dedicated host display and host-paced controls.
- [ ] X2: Programming-language categories, code questions, per-language rankings/profile statistics.
- [ ] X3: Knowledge spaces, retrieval/citations, multiple providers/local inference.
- [ ] X4: Ranked duels, matchmaking, ELO, bots and friend challenges.
- [ ] X5: Kick/ban, public question moderation, media storage and extensible question types.
- [ ] X6: Billing/plan limits and full offline self-host packaging (distinct from the current Docker web preview).

X items require explicit acceptance definitions and estimates before a claim of
full four-product parity. The old roadmap is a delivery order, not evidence that
calendar weeks or milestones have already been completed.
