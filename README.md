<p align="center">
  <img src="assets/icon.png" width="128" height="128" alt="Papyrus Logo" />
</p>

<h1 align="center">Papyrus</h1>

<p align="center">
  <strong>From Ancient Scroll to AI Power.</strong><br/>
  A cross-platform (iOS · Android · Web) AI learning &amp; realtime quiz battle platform featuring streaming AI question generation, a <code>pgvector</code> RAG tutor, interactive 3D graphics, and an offline-first architecture.
</p>

<p align="center">
  <img alt="Expo & React Native" src="https://img.shields.io/badge/Expo%20%2B%20React%20Native-0.88-4F46E5?style=flat-square" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-Strict-3178C6?style=flat-square" />
  <img alt="Three.js & Blender" src="https://img.shields.io/badge/3D-Three.js%20%2B%20Blender%204.2-7C3AED?style=flat-square" />
  <img alt="Supabase" src="https://img.shields.io/badge/Backend-Supabase%20%2B%20pgvector-10B981?style=flat-square" />
  <img alt="Docker" src="https://img.shields.io/badge/Deploy-Docker%20%2B%20Nginx-F59E0B?style=flat-square" />
</p>

---

## Key Features

### 1. Spatial 3D Splash Screen & Optical-Illusion Onboarding Video
- **3D PowerPoint-Morph Splash Screen**: Procedurally crafted in **Blender 4.2** with real Shape Keys (Draco level 7, `96 KB`, `3,516 tris`) and rendered live on GPU (`morphTargetInfluences`) in Three.js, seamlessly morphing an ancient Papyrus scroll into the sculpted 3D **P** emblem with dual AI Neural orbital rings and an 8-ray starburst flare. Tuned for locked 60fps with **0 React re-renders**, **6–7 draw calls**, automatic 2D fallback, and full **Reduce Motion** support.
- **9.5s Optical-Illusion Onboarding Video (Remotion)**: Plays automatically once per newly signed-in user (persisted per `userId`), taking learners through 3 punchy acts — *Pain Point* (Droste infinite document vortex & forgetting curve) → *Origami 2.5D Fold & Portal Match-Cut through the Papyrus "P"* → *3 Core Value Pillars & Converging Payoff*. Dual-encoded for instant zero-lag playback (`WebM 662 KB`, `MP4 faststart 1.1 MB`, `WebP poster 21 KB` for 0ms black screen) with an in-app replay option in **Settings**.

### 2. Multi-Source Document Intake & Streaming AI Quiz Generation
- **Privacy-First Document Intake**: Multi-page scan sessions (capture, rotate, compress, reorder, delete, retake) powered by **on-device ML Kit OCR** (source images stay on-device), plus direct **PDF**, **Markdown**, and **TXT** extraction with source-to-question linking.
- **Streaming AI Quiz Generator & Offline Queue**: Connects to the `generate-questions` Edge Function to stream validated questions in real time; supports **single-question regeneration**, **fill-missing-questions**, an **offline generation queue** (persisted jobs, cancellation, automatic recovery & retry on reconnect), and independent rate/quota controls.
- **Rich 6-Format Question Editor**: Multiple Choice (single & *Multi-select*), True/False, Poll, Word Cloud, Rating (5-star / 1–10 scale), and Open Text — complete with optional **Code Snippet** blocks, subject/tag metadata, and CSV import/export.

### 3. Papybot AI Tutor & `pgvector` RAG Knowledge Base
- **Source-Grounded Tutoring**: Powered by the `rag-ingest` and `papybot` Edge Functions using PostgreSQL `pgvector` semantic retrieval to answer questions directly from your uploaded PDFs and study notes with accurate source citations.
- **Smart Conversation Sync**: Automatic cross-device chat history synchronization, offline retry queue, and interactive conflict resolution (keep Cloud, keep Local, or preserve both).

### 4. Four Gamified 3D Learning & Arena Modes
- **Study Sanctuary**: Sequential, randomized, timed, and wrong-answers-only review modes; safe resume handling when sets are edited/deleted; per-set mastery analytics; and PDF study report export.
- **Survival Arena**: High-stakes streak mode starring the Papyrus Scholar (rigged 3D model + ultra-lightweight WebP sprites for `idle`, `attack`, `hurt`, `victory`), crystal health hearts, combo multipliers, and audio/haptic feedback.
- **Memory Match Library**: Fast-paced concept-to-answer card matching built around Active Recall.
- **Realtime 1v1 & 2–4 Player Battle Colosseum**:
  - 6-character PIN rooms, **QR Code & Deep Link invites** (handling cold start, foreground, and unauthenticated flows), and **ELO-based matchmaking**.
  - **Server-authoritative scoring** via the `submit_answer` RPC (clients never receive the answer key before a round closes).
  - 30-second disconnect grace period before forfeit, automatic host migration, early round advance once all players answer, and 30-minute idle room expiration.
  - **Global & Friends Leaderboards** linked directly to personal match history.

### 5. Offline-First Architecture, Auto-Sync & Production Operations
- **Offline-First + Bi-Directional Auto-Sync**: Local persistence via **SQLite** (iOS/Android) and **AsyncStorage** (Web); automatically syncs `question_sets`, `attempts`, `answers`, `source_documents`, and `papybot_threads` on sign-in, app resume, and network reconnect with exponential backoff, soft deletes, and per-set sync status badges.
- **Auth, Moderation & Billing**: Email/Password, Google/Facebook OAuth, Guest mode, password recovery, full account & data deletion (`delete-account`), **AI Auto-Gate Moderation & Superadmin Console**, VIP/AI Token checkout (`billing-checkout`), bilingual **English / Vietnamese** UI, Dark/Light/Auto themes, and 19:00 mobile study reminders.

---

## System Architecture

Papyrus enforces strict feature-scoped **Clean Architecture (`Presentation → Domain ← Data`)** verified automatically via a TypeScript AST dependency graph (`scripts/check-architecture.cjs`):

- **Domain (`src/features/*/domain/`, `src/core/domain/`)**: Pure TypeScript + `zod` schemas with zero React Native, Expo, or Supabase dependencies.
- **Data (`src/features/*/data/`, `src/core/database/`, `src/core/network/`)**: SQLite, AsyncStorage, Supabase, OCR, PDF, and Edge Function adapters.
- **Composition Root (`src/composition/`)**: Centralized Dependency Injection wiring all repositories and use cases.
- **Presentation (`src/app/`, `src/features/*/presentation/`, `src/shared/`)**: Cross-platform Expo Router screens, Zustand UI state, TanStack Query, and memory-safe Three.js/WebGL scenes.

```text
Quiz-Game-MultyPlatform/
├── src/
│   ├── app/                  # Expo Router routes (_layout, auth, battle, create, games, sets, settings...)
│   ├── composition/          # Dependency Injection & Composition Root
│   ├── core/                 # Theme tokens, i18n (EN/VI), SQLite, Supabase client, Zustand stores, SFX, Sentry
│   ├── features/             # Clean Architecture modules (assistant, auth, leaderboard, membership, moderation,
│   │                         # onboarding, preferences, profile, question-sets, quiz-generation, release,
│   │                         # reminders, room-battle, scan-ocr, streak, study, sync)
│   └── shared/               # UI primitives, Model3DView, CharacterHero, PapyrusSplash3D & Three.js scenes
├── supabase/
│   ├── migrations/           # 20 PostgreSQL migrations (RLS, scoring RPCs, pgvector RAG, sync, battle lifecycle)
│   ├── functions/            # 5 Deno Edge Functions: generate-questions, papybot, rag-ingest, billing-checkout, delete-account
│   └── tests/                # SQL test suites for RLS permissions, sync, battle lifecycle & account cleanup
├── assets/
│   ├── models/               # Draco-compressed .glb 3D assets exported from Blender 4.2
│   ├── video/                # Optical-illusion onboarding video (.webm, .mp4 faststart, .webp poster)
│   └── characters/           # Lightweight WebP character sprites
├── scripts/
│   ├── blender/              # Headless Blender 4.2 Python scripts for 3D modeling & Shape Keys
│   └── check-architecture.cjs # AST-based Clean Architecture import boundary enforcer
├── video-onboarding/         # Standalone Remotion studio for editing & re-rendering the onboarding video
├── docker/                   # Production Nginx config (gzip, Accept-Ranges video streaming, .glb MIME)
├── Dockerfile                # Multi-stage Docker build (Expo Web -> Nginx Alpine)
└── docker-compose.yml        # One-command Papyrus Web + optional local Ollama AI stack
```

---

## Installation & Setup Guide

### 1. Prerequisites
- **Node.js** `>= 20` (`22 LTS` recommended) and **npm** `>= 10`
- **Git**
- *(Optional for Native Mobile)*: Xcode + CocoaPods (iOS) or Android Studio + JDK 17 (Android)
- *(Optional for Cloud / Local Supabase)*: Docker Desktop & Supabase CLI (`npx supabase`)
- *(Optional for regenerating 3D / Video assets)*: Blender 4.2 LTS, FFmpeg, `cwebp`

### 2. Clone & Install Dependencies

```bash
git clone https://github.com/Minhwritecode/Quiz-Game-MultyPlatform.git
cd Quiz-Game-MultyPlatform
npm ci
```

### 3. Configure Environment Variables

Copy the example environment file to `.env.local`:

```bash
cp .env.example .env.local
```

Papyrus automatically adapts between **two runtime modes**:

- **Offline-First Mode (zero configuration)**: Leave `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` empty. You can immediately explore seed sets, author questions manually, play Survival/Match, and persist local progress.
- **Live Cloud Mode (full AI, multi-device sync, 1v1 Battle, RAG & Leaderboards)**: Populate your Supabase credentials in `.env.local`:

```env
EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<supabase-anon-or-publishable-key>

# Optional for production observability & billing:
APP_VARIANT=development
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=
EXPO_PUBLIC_SENTRY_DSN=
```

> **Security Note**: Server-side secrets (`GEMINI_API_KEY`, `OPENAI_COMPAT_API_KEY`, `STRIPE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, etc.) must **never** be prefixed with `EXPO_PUBLIC_`. Place them in `supabase/.env.local` (see `supabase/.env.example`).

### 4. Set Up the Supabase Backend (Cloud or Local)

#### Option A — Deploy to Supabase Cloud

```bash
# 1. Authenticate and link your Supabase project
npx supabase login
npx supabase link --project-ref <project-ref>

# 2. Push all 20 Database Migrations (schema, RLS, RPCs, pgvector)
npx supabase db push

# 3. Upload server-side secrets for Edge Functions
npx supabase secrets set --env-file supabase/.env.local

# 4. Deploy all 5 Edge Functions
npx supabase functions deploy generate-questions
npx supabase functions deploy papybot
npx supabase functions deploy rag-ingest
npx supabase functions deploy billing-checkout
npx supabase functions deploy delete-account
```

#### Option B — Run Supabase Locally with Docker

```bash
npx supabase start
npx supabase db reset
npx supabase functions serve --env-file supabase/.env.local
```

### 5. Run the App (Web · iOS · Android)

```bash
# Start Expo Dev Server (press 'w' for Web, 'i' for iOS Simulator, 'a' for Android Emulator)
npm start

# Or launch a specific platform directly:
npm run web
npm run ios
npm run android
```

> Restart Expo (`npm start -- --clear`) whenever you modify `.env.local`.

### 6. Run Production Web with Docker (+ Optional Local Ollama AI)

A multi-stage `Dockerfile` exports the Expo Web bundle and serves it via Nginx with `gzip`, immutable asset caching, and `Accept-Ranges` byte streaming:

```bash
# Build and start Papyrus Web at http://localhost:8080
docker compose up -d --build

# Start with optional local Ollama LLM service (port 11434)
docker compose --profile local-ai up -d --build

# Stop containers
docker compose down
```

Override the default port with `PAPYRUS_PORT=3000 docker compose up -d --build`.

### 7. Mobile Builds (EAS)

```bash
# Build an Android Preview APK
npx --no-install eas build --platform android --profile preview

# Build Production binaries (Android AAB / iOS IPA)
npx --no-install eas build --platform all --profile production
```

---

## Quality Gates & Asset Tooling

Run the full verification suite before committing or releasing:

```bash
# 1. Strict TypeScript check (0 errors)
npm run typecheck

# 2. ESLint check (0 errors, 0 warnings)
npx eslint src --quiet

# 3. AST Clean Architecture boundary verification
./scripts/check_architecture.sh

# 4. Run all 43 Jest test suites (129 tests) and release guard tests
npm test
npm run test:release

# 5. Verify production Web export
npx --no-install expo export --platform web
```

### Regenerating 3D Assets (Blender) & Onboarding Video (Remotion)

- **Re-export the 3D Splash Morph model from Blender 4.2**:
  ```bash
  /Applications/Blender.app/Contents/MacOS/Blender -b -P scripts/blender/build_splash_morph.py
  ```
- **Preview or re-render the Optical-Illusion Onboarding Video**:
  ```bash
  npm install --prefix video-onboarding
  npm run --prefix video-onboarding studio   # Launch interactive Remotion Studio
  npm run --prefix video-onboarding render   # Render & compress to assets/video/ (.mp4, .webm, .webp)
  ```

---

## Project Documentation

- [Papyrus UI/UX Prototype — Figma](https://www.figma.com/design/qdGvcsHXoTJcuq2NqsK9XS/Papyrus-UI-UX-Prototype?t=wiS4ZAcDfeWtDAkV-1)
- [System Architecture Overview](docs/architecture/overview.md)
- [Report 1 — Project Proposal](docs/reports/Capstone-Report-1-Proposal.md)
- [Report 2 — Detailed Architecture](docs/reports/Capstone-Report-2-Architecture.md)
- [Report 3 — AI Integration, Offline Sync & Testing](docs/reports/Capstone-Report-3-AI-Testing.md)
- [Operations & Release Runbook](docs/release/RUNBOOK.md)
- [Running on Physical Devices (iOS & Android)](docs/release/RUN-ON-PHONE.md)

---

## License

Academic capstone project developed for educational and EdTech product demonstration purposes.
