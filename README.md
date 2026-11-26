<p align="center">
  <img src="assets/icon.png" width="128" height="128" alt="Papyrus Logo" />
</p>

<h1 align="center">Papyrus v3.0</h1>

<p align="center">
  <strong>From Ancient Scroll to AI Power.</strong><br/>
  A cross-platform (iOS · Android · Web) AI study studio, 3D gamified learning arena, real-time multiplayer quiz platform, and academic social network built with Expo Router, Three.js, and Supabase.
</p>

<p align="center">
  <img alt="Version" src="https://img.shields.io/badge/Release-v3.0.0-1C3F94?style=flat-square" />
  <img alt="Expo & React Native" src="https://img.shields.io/badge/Expo%20%2B%20React%20Native-0.88-4F46E5?style=flat-square" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-Strict-3178C6?style=flat-square" />
  <img alt="Three.js & Blender" src="https://img.shields.io/badge/3D-Three.js%20%2B%20Blender%204.2-7C3AED?style=flat-square" />
  <img alt="Supabase" src="https://img.shields.io/badge/Backend-Supabase%20%2B%20pgvector-15803D?style=flat-square" />
  <img alt="Docker" src="https://img.shields.io/badge/GHCR-papyrus--web-9A5804?style=flat-square" />
</p>

---

## Key Features

### 1. Warm Paper & Egyptian Ink Design System + Spatial 3D Onboarding
- **Warm Paper & Egyptian Ink UI**: Glare-free, high-contrast academic design system (`#F7F3E8` Warm Paper, `#1C3F94` Egyptian Lapis Blue, `#9A5804` Amber Gold) with full **Light / Dark / System** support, mobile-first responsiveness (`320px–390px` viewports up to wide desktop grids), in-place pull-to-refresh, and distinct **Navigation Loaders** vs. **Offline/Slow-Network Skeletons**.
- **3D Morph Splash Screen**: Modeled in **Blender 4.2** with GPU Shape Keys (Draco-compressed `.glb`, `96 KB`, `3,516 tris`) and rendered at 60fps in Three.js (`morphTargetInfluences`) with automatic 2D fallback and **Reduce Motion** support.
- **9.5s Optical-Illusion Onboarding Video (Remotion)**: Plays once per newly signed-in account (`WebM 662 KB`, `MP4 faststart 1.1 MB`, `WebP poster 21 KB`) with instant replay available in **Settings**.

### 2. Multimodal Papybot AI Tutor, Document OCR & Streaming Quiz Engine
- **Multi-Source Document Intake**: Multi-page camera & gallery scan sessions with **on-device ML Kit OCR**, plus direct **PDF**, **DOCX**, **Markdown**, and **TXT** text extraction.
- **Streaming AI Quiz Generation**: Real-time question streaming via the `generate-questions` Edge Function with single-question regeneration, fill-missing-questions, offline job queueing with automatic retry on reconnect, and a **6-Format Question Editor** (Multiple Choice single/multi-select, True/False, Poll, Word Cloud, 5-star/10-point Rating, and Open Text with monospace Code Snippets and CSV import/export).
- **Multimodal Papybot Tutor (`pgvector` RAG)**: Conversational AI tutor supporting natural dialogue, camera/photo attachments, PDF/DOCX uploads, microphone speech-to-text, text-to-speech lecture playback, source-grounded `pgvector` retrieval, and cross-device chat history sync.

### 3. Gamified 3D Action Modes & Real-Time Multiplayer Arena
- **3D Target Archer (`/games/archer`)**: Non-quiz action reflex game where learners aim and shoot arrows at moving 3D concept targets matching the active prompt.
- **3D Alchemy Cauldron (`/games/alchemy`)**: Interactive 3D sorting and synthesis lab for categorizing terms, formulas, and reactions into elemental cauldrons.
- **3D Survival Boss Arena (`/games/survival`)**: High-stakes 3-heart streak combat starring rigged 3D characters, elemental spells, combo multipliers, and WebGL memory-safe disposal.
- **Memory Match Library (`/games/match`) & Study Sanctuary (`/study/[setId]`)**: Timed concept-to-answer card matching, sequential/randomized/wrong-only review modes, daily Pomodoro focus timer, daily quests, and PDF study report export.
- **Kahoot Live & Ranked 1v1 ELO Colosseum (`/battle`, `/multiplayer/*`)**:
  - Unified **6-character PIN** and **QR Code** room entry supporting both instant Kahoot Live classroom sessions (up to multi-player lobbies) and competitive 2–4 player Colosseum rooms.
  - **Server-authoritative scoring** via `submit_answer` RPC, 30s disconnect grace period, automatic host migration, category-specific ELO ratings, and **Global & Friends Leaderboards**.

### 4. Production Social Network, Study Communities & Dedicated Messaging
- **Meta Threads-Style Social Feed (`/community`)**:
  - Clean, distraction-free Thread Composer supporting connected multi-part threads, auto-saved per-account drafts, multi-image carousels, **Video Cover Frame Editor** (`9:16`, `16:9`, `4:5`, `1:1`), **GIPHY Sticker & GIF Picker**, interactive polls, attached playable quizzes, code blocks, 24h auto-expiring Ghost Posts, spoiler gates, anonymous posts, 2-side Debate mode, and scheduled publishing.
  - Customizable feed modes (*For You*, *Following*, *Friends*, *Trending*, *Academic*, *Debate*, *Nearby Area Clusters*, and user-created *Custom Feeds*) plus natural-language AI feed filtering.
- **24-Hour Grouped Stories & Profile Story Manager**:
  - Active stories (`< 24h`) automatically group into **one single 9:16 Story Box per author** with segmented progress bars, tap-left/right slide flipping, and **100% full-length video playback**.
  - Built-in **Story Manager** on `/profile` allowing users to review all posted stories and selectively pin individual stories as permanent profile highlights.
- **Real-Time Multi-Source Search Engine**:
  - Live discovery across **Google News**, **Wikipedia (VI/EN)**, **OpenAlex**, and **Hacker News** with article hero thumbnails, one-click search engine reset, instant source-to-AI-Quiz generation, document library saving, and 24h Story / Thread sharing.
- **Study Communities & RBAC Groups**: Public, Private, and Hidden communities with Owner / Admin / Moderator / Member roles, post approval queues, live study events with RSVP, and contribution points.
- **Dedicated Messaging Center (`/messages`)**: Split-pane desktop and mobile-first 1-on-1 & Group chat with message requests, replies, forwarding, editing, unsend/recall, pinned messages, voice notes, GIPHY stickers/GIFs, polls, and permission-aware embedded `SharedPostCard` previews.
- **Unified Social Graph & Strict Guest Isolation**: Real Supabase synchronization across profiles, posts, stories, communities, and messages; distinct 1-way Follow (with Private Account approval) vs. 2-way Friendships; Block/Mute/Restrict enforcement; and strict read-only Guest isolation.

### 5. Account Security Center, External Notifications & Enterprise Admin Console
- **Passkeys, 2FA & Device Sessions**: Morph-animated Auth portal supporting Email/Password, Magic Link, OAuth, **WebAuthn Biometric Passkeys** (Face ID / Touch ID), **TOTP Two-Factor Authentication (2FA)**, and active device session revocation.
- **Smart Study Reminders & Push Notifications**: Duolingo-style 20-hour inactivity nudges, Web Notification API / OS push dispatch even when the app tab is in the background, per-user streak isolation, and read-status indicators.
- **Enterprise Admin Console (`/admin`)**: Real-time KPI overview, registered user management, Trust & Safety moderation queue with user **Appeals** workflow, targeted user-only broadcasts, and the **Admin Document Gift Center** (upload PDF/DOCX/Markdown study guides to Supabase Storage and gift them to specific users, communities, or all learners with immutable audit logs).

---

## System Architecture

Papyrus enforces strict feature-scoped **Clean Architecture (`Presentation → Domain ← Data`)** verified automatically via an AST dependency graph (`scripts/check-architecture.cjs`):

- **Domain (`src/features/*/domain/`, `src/core/domain/`)**: Pure TypeScript business rules, ranking algorithms, permission guards, ELO math, and `zod` schemas with zero UI or network imports.
- **Data (`src/features/*/data/`, `src/core/database/`, `src/core/network/`)**: SQLite, AsyncStorage, Supabase repositories, GIPHY media client, live academic search adapters, OCR, and Edge Function clients.
- **Composition Root (`src/composition/`)**: Centralized Dependency Injection bridging domain and data layers into presentation screens.
- **Presentation (`src/app/`, `src/features/*/presentation/`, `src/shared/`)**: Responsive Expo Router screens, Zustand stores, and memory-safe Three.js scenes wrapped in `Model3DErrorBoundary`.

```text
Quiz-Game-MultyPlatform/
├── src/
│   ├── app/                  # Expo Router screens (index, auth, community, messages, profile,
│   │                         # user/[userId], post/[postId], admin, battle, create/*, games/*, study/*)
│   ├── composition/          # Dependency Injection & Composition Root (dependencies, platform, social)
│   ├── core/                 # Warm Paper & Egyptian Ink tokens, i18n (EN/VI), SQLite, Supabase, stores
│   ├── features/             # Modular Clean Architecture domains (assistant, auth, community,
│   │                         # leaderboard, membership, moderation, multiplayer, notifications,
│   │                         # onboarding, profile, question-sets, quiz-generation, release,
│   │                         # reminders, room-battle, scan-ocr, social, streak, study, sync)
│   └── shared/               # Reusable UI primitives, PapyrusLoader, Model3DView & Three.js scenes
├── api/                      # Vercel Serverless AI gateway (/api/papybot)
├── supabase/
│   ├── migrations/           # PostgreSQL migrations (RLS, RPCs, pgvector RAG, social, stories, admin gifts)
│   ├── functions/            # Deno Edge Functions (generate-questions, papybot, rag-ingest, billing, delete-account)
│   └── tests/                # SQL verification suites for RLS policies & battle lifecycle
├── assets/                   # Draco-compressed Blender .glb models, Remotion onboarding video & WebP sprites
├── scripts/                  # Blender headless scripts, release preflight & AST architecture checker
├── Dockerfile                # Multi-stage production Web build (Node 22 -> Nginx 1.27 Alpine)
└── docker-compose.yml        # One-command Papyrus Web + optional local Ollama AI stack
```

---

## Getting Started

### 1. Prerequisites
- **Node.js** `>= 20` (`22 LTS` recommended) and **npm** `>= 10`
- **Git**
- *(Optional for Native Mobile)*: Xcode + CocoaPods (iOS) or Android Studio + JDK 17 (Android)
- *(Optional for Cloud / Local Supabase)*: Docker Desktop & Supabase CLI (`npx supabase`)

### 2. Clone & Install Dependencies

```bash
git clone https://github.com/Minhwritecode/Quiz-Game-MultyPlatform.git
cd Quiz-Game-MultyPlatform
npm ci
```

### 3. Configure Environment Variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Configure client environment variables in `.env.local` (leave Supabase keys empty to run in **Offline-First Mode**, or populate them for **Live Cloud Mode**):

```env
EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<supabase-anon-or-publishable-key>

# Optional: Live GIF & Sticker search via GIPHY v1 API
EXPO_PUBLIC_GIPHY_API_KEY=<your-giphy-api-key>

# Optional: Release & Observability
APP_VARIANT=development
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=
EXPO_PUBLIC_SENTRY_DSN=
```

> **Security Note**: Server-side keys (`GEMINI_API_KEY`, `OPENAI_COMPAT_API_KEY`, `STRIPE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) must **never** use the `EXPO_PUBLIC_` prefix. Store them in `supabase/.env.local` or your deployment provider's server environment.

### 4. Set Up Supabase (Cloud or Local)

```bash
# Link and push all PostgreSQL migrations (Core + RAG + Social + Stories + Admin Gifts)
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push

# Upload Edge Function secrets and deploy functions
npx supabase secrets set --env-file supabase/.env.local
npx supabase functions deploy generate-questions
npx supabase functions deploy papybot
npx supabase functions deploy rag-ingest
npx supabase functions deploy billing-checkout
npx supabase functions deploy delete-account
```

### 5. Run Locally (Web · iOS · Android)

```bash
npm start          # Interactive Expo launcher
npm run web        # Start Web app
npm run ios        # Run on iOS Simulator
npm run android    # Run on Android Emulator
```

---

## Docker & GitHub Container Registry (`papyrus-web`)

Pull and run the pre-built production container published by GitHub Actions:

```bash
docker pull ghcr.io/minhwritecode/papyrus-web:3.0.0
docker run -d -p 8080:80 --name papyrus-web ghcr.io/minhwritecode/papyrus-web:3.0.0
```

Or build locally with Docker Compose:

```bash
docker compose up -d --build
```

Then open http://localhost:8080.

---

## Quality Gates

Run the complete verification pipeline before committing or cutting a release:

```bash
./scripts/check_architecture.sh            # 1. AST Clean Architecture boundary check
npm run typecheck                          # 2. Strict TypeScript check (0 errors)
npx eslint src --quiet                     # 3. ESLint check (0 warnings/errors)
npm run test:release                       # 4. Release preflight tests
npm test                                   # 5. Full Jest unit & integration suite
npx --no-install expo export --platform web # 6. Production Web bundle export
```

---

## Project Documentation

- [Papyrus UI/UX Prototype — Figma](https://www.figma.com/design/qdGvcsHXoTJcuq2NqsK9XS/Papyrus-UI-UX-Prototype?t=wiS4ZAcDfeWtDAkV-1)
- [System Architecture Overview](docs/architecture/overview.md)
- [Operations & Release Runbook](docs/release/RUNBOOK.md)
- [Running on Physical Devices (iOS & Android)](docs/release/RUN-ON-PHONE.md)

---

## License

Academic capstone and full-stack EdTech platform project developed for educational and product engineering demonstration purposes.
