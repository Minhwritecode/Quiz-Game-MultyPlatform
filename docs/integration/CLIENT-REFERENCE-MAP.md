# Client reference → Papyrus integration map

## Scope

The `client/` directory in the main checkout is a UI and flow reference. It is
an incomplete Vite/React sample (no package manifest and unresolved route imports),
not an application that can be merged or run as a standalone client. Its backend
assumptions also differ from Papyrus: it points to a localhost REST/Socket.IO
service, uses demo host IDs and mock quiz fields, and is not compatible with the
Papyrus Supabase schema or server-authoritative battle rules.

Papyrus remains the source of truth: Expo Router, React Native + TypeScript,
Supabase, the existing local question-set store and battle feature ports.

## Behavior mapping

| Reference behavior | Papyrus destination | Integration status |
|---|---|---|
| QuizPulse home/dashboard and quick actions | `src/app/index.tsx` | Adapted to Papyrus brand/tokens and real app routes. Counts are derived from local question sets; removed sample accuracy and XP values. |
| Manual quiz creation and editing | `/create/generate?mode=manual` → `src/app/create/generate.tsx` | Added manual mode with title, subject, question text, four options, correct-answer selection, inline validation and repository save. |
| AI/PDF quiz workflow | `/create/scan` and `/create/generate` | Reuses Papyrus OCR and generation boundaries. Provider readiness and any unsupported document parsing remain governed by Papyrus status docs. |
| Host/join room | `/battle` → existing Supabase battle repository | Join-by-code field routes into the existing realtime room flow. No local random room codes or demo socket backend added. |
| Quiz library/recent sets | `/sets` and `/study/[setId]` | Reuses the existing local-first library and study modes. |
| Room results/leaderboard | `/battle`, `/leaderboard` | Existing Papyrus screens are reused. Client mock rankings are not treated as production data. |
| Socket.IO events / Express API / demo identity | None | Not imported. Supabase Realtime, RPC, RLS and current Papyrus auth remain authoritative. |
| Client QR badges/claims | None | No QR scanner/link implementation is inferred from static reference copy. |

## App and web presentation

- Native screens remain React Native. The home hero uses a lightweight layered
  study-card illustration on iOS and Android.
- Web desktop uses a responsive top navigation and a small Three.js hero scene.
  The scene is isolated behind `.web.tsx`, lazy-loaded, capped at 1.25 device
  pixel ratio, and falls back when WebGL2 is unavailable or reduced motion is on.
- Mobile web keeps the compact bottom navigation; native keeps the same mobile
  navigation behavior. The manual composer and room join actions are reachable
  from the home screen on narrow layouts.
- Visual choices extend existing Papyrus tokens: indigo remains the primary
  action color, with paper surfaces and existing mint/gold status tones. There
  are no new gradient systems or icon styles.

## Design reference

The screen and interaction review follows the public
[Appllama app design skill](https://github.com/Appllama/appllama-skills/tree/main/skills/appllama-app-design-skill):
preserve native navigation conventions, use semantic states, keep controls
reachable, avoid decorative motion, honor reduced motion, and complete empty,
loading and error states. Appllama's MCP screen library is not connected to this
workspace, so this integration does not claim a benchmark study of its private
screen catalog or simulator-verified visual parity.

No WordPress URL or content source was present in the project. The UI reference
was reviewed locally; no external WordPress site was connected or modified.

## Validation

TypeScript and Expo web export are the minimum build checks for this integration.
Device visual review and motion recording are still required before calling the
native screens release-ready.
