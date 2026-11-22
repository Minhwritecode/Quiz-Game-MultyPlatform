<p align="center">
  <img src="assets/icon.png" width="128" height="128" alt="Papyrus Logo" />
</p>

<h1 align="center">Papyrus</h1>

<p align="center">
  <strong>From Ancient Scroll to AI Power.</strong><br/>
  Nền tảng học tập &amp; đấu trí trắc nghiệm đa nền tảng (iOS · Android · Web) kết hợp AI tạo đề streaming, gia sư RAG <code>pgvector</code>, đồ họa 3D tương tác và kiến trúc Offline-first.
</p>

<p align="center">
  <img alt="Expo & React Native" src="https://img.shields.io/badge/Expo%20%2B%20React%20Native-0.88-4F46E5?style=flat-square" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-Strict-3178C6?style=flat-square" />
  <img alt="Three.js & Blender" src="https://img.shields.io/badge/3D-Three.js%20%2B%20Blender%204.2-7C3AED?style=flat-square" />
  <img alt="Supabase" src="https://img.shields.io/badge/Backend-Supabase%20%2B%20pgvector-10B981?style=flat-square" />
  <img alt="Docker" src="https://img.shields.io/badge/Deploy-Docker%20%2B%20Nginx-F59E0B?style=flat-square" />
</p>

---

## Tính năng nổi bật

### 1. Trải nghiệm Mở màn Không gian 3D & Video Ảo ảnh Thị giác
- **Splash Screen 3D PowerPoint Morph**: Mô hình 3D dựng bằng **Blender 4.2 Shape Keys** (xuất nén Draco level 7, `96 KB`, `3,516 tris`) biến hình trực tiếp trên GPU (`morphTargetInfluences`) từ cuộn giấy Papyrus cổ thành khối Logo chữ **P** 3D ánh tím-vàng kèm 2 vòng quỹ đạo AI Neural và tia Starburst 8 cánh. Tối ưu 60fps với **0 React re-render**, chỉ **6–7 draw calls**, tự động fallback sang 2D khi bật **Reduce Motion** hoặc thiếu WebGL2.
- **Video Onboarding Ảo ảnh Thị giác (Remotion)**: Tự động phát 1 lần duy nhất cho người dùng mới sau khi đăng nhập lần đầu (lưu trạng thái theo `userId`), dẫn dắt 9.5 giây từ *Pain Point* (Đường hầm Droste vô tận & đường cong quên bài) → *Cú bẻ lái Origami & Portal Match-Cut xuyên qua Logo P* → *3 giá trị cốt lõi*. Nén kép siêu nhẹ (`WebM 662 KB`, `MP4 faststart 1.1 MB`, ảnh poster `WebP 21 KB` chống chớp màn đen), hỗ trợ xem lại bất kỳ lúc nào trong **Cài đặt**.

### 2. Quét Tài liệu Đa nguồn & Sinh Câu hỏi AI Streaming
- **Nhập tài liệu linh hoạt & giữ riêng tư ảnh gốc**: Hỗ trợ chụp/chọn nhiều trang liên tiếp (xoay, nén, sắp xếp, xóa, chụp lại), nhận diện văn bản **on-device ML Kit OCR** (ảnh không rời thiết bị), nhập trực tiếp **PDF**, **Markdown**, **TXT**, chọn đoạn nguồn và đánh dấu chỉnh sửa trước khi tạo đề.
- **AI Quiz Generator Streaming & Hàng đợi Ngoại tuyến**: Kết nối Edge Function `generate-questions` trả về từng câu hỏi hợp lệ theo thời gian thực; hỗ trợ **sinh lại riêng từng câu**, **tạo bù câu còn thiếu**, quản lý **hàng đợi tạo đề ngoại tuyến** (lưu job, hủy, tự khôi phục & retry khi có mạng) cùng hạn mức quota độc lập.
- **Trình soạn thảo 6 loại câu hỏi chuyên sâu**: Trắc nghiệm 4 lựa chọn (1 đáp án hoặc nhiều đáp án đúng *Multi-select*), Đúng/Sai, Bình chọn (*Poll*), *Word Cloud*, Thang đánh giá (*Rating 5 sao / 1–10*), Tự luận mở, hỗ trợ chèn khung **Code Snippet** minh họa, gắn thẻ/môn học, liên kết nguồn gốc và Import/Export CSV.

### 3. Gia sư AI Papybot & Kho Tri thức RAG (`pgvector`)
- **Hỏi đáp bám sát tài liệu gốc**: Edge Function `rag-ingest` và `papybot` lập chỉ mục vector `pgvector` trực tiếp từ tài liệu học của người dùng để trả lời kèm trích dẫn nguồn chuẩn xác, tránh trả lời lan man.
- **Đồng bộ hội thoại thông minh**: Tự động đồng bộ lịch sử trò chuyện giữa các thiết bị, hỗ trợ retry ngoại tuyến và giao diện xử lý xung đột (chọn bản Cloud, bản Local hoặc giữ cả hai bản).

### 4. 4 Chế độ Học tập & Đấu trường 3D Game hóa
- **Study Sanctuary (Ôn tập chuyên sâu)**: Học theo thứ tự, đảo ngẫu nhiên, bấm giờ giới hạn, chế độ ôn riêng câu hay làm sai, khôi phục phiên học dở an toàn khi bộ đề thay đổi, thống kê độ tiến bộ theo từng bộ đề và xuất báo cáo học tập PDF.
- **Survival Arena (Đấu trường Sinh tồn)**: Trả lời liên hoàn vượt ải cùng nhân vật Học giả Papyrus (3D rigged & sprite WebP siêu nhẹ cho các trạng thái `idle`, `attack`, `hurt`, `victory`), cơ chế tim năng lượng, chuỗi combo và hiệu ứng âm thanh/haptic.
- **Memory Match Library (Ghép thẻ Trí nhớ)**: Lật thẻ ghép khái niệm – đáp án tối ưu cho phương pháp ghi nhớ chủ động (*Active Recall*).
- **Battle Colosseum 1v1 & Phòng đấu 2–4 người Realtime**:
  - Tạo phòng bằng mã PIN 6 ký tự, **chia sẻ lời mời QR Code & Deep Link** (xử lý liền mạch khi app đang đóng, đang mở hoặc chưa đăng nhập) và ghép cặp theo điểm **ELO**.
  - **Chấm điểm server-authoritative** (`submit_answer` RPC — client không bao giờ nhận đáp án trước khi hết giờ câu hỏi).
  - Giữ chỗ 30 giây khi rớt mạng trước khi xử lý bỏ cuộc, tự động chuyển host, tự chuyển câu sớm khi tất cả đã trả lời và hết hạn phòng sau 30 phút không hoạt động.
  - **Bảng xếp hạng Toàn cầu & Bạn bè** liên kết trực tiếp với lịch sử đấu cá nhân.

### 5. Kiến trúc Offline-first, Auto-Sync & Vận hành Production
- **Offline-first + Tự động đồng bộ 2 chiều**: Lưu dữ liệu tại chỗ bằng **SQLite** (iOS/Android) và **AsyncStorage** (Web); tự kích hoạt đồng bộ (`question_sets`, `attempts`, `answers`, `source_documents`, `papybot_threads`) khi đăng nhập, mở lại app hoặc có mạng, hỗ trợ retry/backoff, soft-delete và hiển thị trạng thái đồng bộ trực tiếp trên từng bộ đề.
- **Tài khoản, Kiểm duyệt & Thanh toán**: Hỗ trợ Email/Password, Google/Facebook OAuth, chế độ Khách (Guest), khôi phục mật khẩu, xóa toàn bộ dữ liệu tài khoản (`delete-account`), bảng điều khiển **Kiểm duyệt AI Auto-Gate & Superadmin**, cổng thanh toán VIP/Token (`billing-checkout`), song ngữ **Tiếng Việt / English**, Dark/Light/Auto theme và nhắc học 19:00 trên di động.

---

## Kiến trúc hệ thống

Papyrus tuân thủ nghiêm ngặt **Clean Architecture theo từng tính năng (`Presentation → Domain ← Data`)** với quy tắc kiểm tra đồ thị import tự động bằng TypeScript AST (`scripts/check-architecture.cjs`):

- **Domain (`src/features/*/domain/`, `src/core/domain/`)**: Thuần TypeScript + `zod`, không phụ thuộc React Native, Expo hay Supabase.
- **Data (`src/features/*/data/`, `src/core/database/`, `src/core/network/`)**: Chứa toàn bộ adapter SQLite, AsyncStorage, Supabase, OCR, PDF và Edge Function clients.
- **Composition Root (`src/composition/`)**: Tiêm phụ thuộc (*Dependency Injection*) thống nhất cho toàn bộ ứng dụng.
- **Presentation (`src/app/`, `src/features/*/presentation/`, `src/shared/`)**: Giao diện Expo Router đa nền tảng, Zustand UI state, TanStack Query và đồ họa Three.js/WebGL tối ưu bộ nhớ.

```text
Quiz-Game-MultyPlatform/
├── src/
│   ├── app/                  # Các tuyến màn hình Expo Router (_layout, auth, battle, create, games, sets, settings...)
│   ├── composition/          # Dependency Injection & Composition Root
│   ├── core/                 # Theme tokens, i18n (VI/EN), SQLite, Supabase client, Zustand stores, SFX, Sentry
│   ├── features/             # Clean Architecture modules (assistant, auth, leaderboard, membership, moderation,
│   │                         # onboarding, preferences, profile, question-sets, quiz-generation, release,
│   │                         # reminders, room-battle, scan-ocr, streak, study, sync)
│   └── shared/               # UI primitives, Model3DView, CharacterHero, PapyrusSplash3D & Three.js scenes
├── supabase/
│   ├── migrations/           # 20 PostgreSQL migrations (RLS, RPC chấm điểm, pgvector RAG, sync, battle lifecycle)
│   ├── functions/            # 5 Deno Edge Functions: generate-questions, papybot, rag-ingest, billing-checkout, delete-account
│   └── tests/                # Bộ kiểm thử SQL phân quyền RLS, đồng bộ, vòng đời phòng đấu & dọn tài khoản
├── assets/
│   ├── models/               # Các mô hình 3D .glb nén Draco từ Blender 4.2
│   ├── video/                # Video onboarding ảo ảnh thị giác (.webm, .mp4 faststart, poster .webp)
│   └── characters/           # Bộ sprite nhân vật WebP siêu nhẹ
├── scripts/
│   ├── blender/              # Script Python Blender 4.2 xuất mô hình 3D & Shape Keys tự động
│   └── check-architecture.cjs # Kiểm tra xuyên lớp Clean Architecture bằng AST
├── video-onboarding/         # Studio Remotion độc lập để chỉnh sửa & render lại video onboarding
├── docker/                   # Cấu hình Nginx production (gzip, Accept-Ranges streaming video, MIME .glb)
├── Dockerfile                # Multi-stage Docker build (Expo Web -> Nginx Alpine)
└── docker-compose.yml        # Khởi chạy nhanh Papyrus Web + tùy chọn Ollama local AI
```

---

## Hướng dẫn cài đặt & chạy dự án

### 1. Yêu cầu môi trường
- **Node.js** `>= 20` (khuyến nghị `22 LTS`) và **npm** `>= 10`
- **Git**
- *(Tùy chọn cho Mobile Native)*: Xcode + CocoaPods (iOS) hoặc Android Studio + JDK 17 (Android)
- *(Tùy chọn cho Cloud Backend / Local Supabase)*: Docker Desktop & Supabase CLI (`npx supabase`)
- *(Tùy chọn để tái xuất 3D / Video)*: Blender 4.2 LTS, FFmpeg, `cwebp`

### 2. Clone mã nguồn & cài đặt thư viện

```bash
git clone https://github.com/Minhwritecode/Quiz-Game-MultyPlatform.git
cd Quiz-Game-MultyPlatform
npm ci
```

### 3. Cấu hình biến môi trường

Sao chép tệp mẫu sang `.env.local`:

```bash
cp .env.example .env.local
```

Ứng dụng hỗ trợ **2 chế độ vận hành tự động**:

- **Chế độ Offline-first (không cần cấu hình thêm)**: Để trống `EXPO_PUBLIC_SUPABASE_URL` và `EXPO_PUBLIC_SUPABASE_ANON_KEY`. Bạn vẫn có thể học bộ đề mẫu, tạo đề thủ công, chơi Survival/Match và lưu tiến độ cục bộ hoàn chỉnh.
- **Chế độ Live Cloud (đầy đủ tính năng AI, đồng bộ đa thiết bị, Battle 1v1, RAG & Bảng xếp hạng)**: Điền thông tin dự án Supabase vào `.env.local`:

```env
EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<supabase-anon-or-publishable-key>

# Tùy chọn khi triển khai Production / Thanh toán / Giám sát lỗi:
APP_VARIANT=development
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=
EXPO_PUBLIC_SENTRY_DSN=
```

> **Lưu ý bảo mật**: Các khóa bí mật phía máy chủ (`GEMINI_API_KEY`, `OPENAI_COMPAT_API_KEY`, `STRIPE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, ...) **tuyệt đối không** đặt tiền tố `EXPO_PUBLIC_`. Hãy khai báo chúng trong `supabase/.env.local` (tham khảo `supabase/.env.example`).

### 4. Thiết lập Backend Supabase (Cloud hoặc Local)

#### Cách A — Đẩy lên Supabase Cloud

```bash
# 1. Đăng nhập và liên kết dự án Supabase
npx supabase login
npx supabase link --project-ref <project-ref>

# 2. Đẩy toàn bộ 20 Database Migrations (schema, RLS, RPC, pgvector)
npx supabase db push

# 3. Nạp biến bí mật server cho Edge Functions
npx supabase secrets set --env-file supabase/.env.local

# 4. Triển khai cả 5 Edge Functions
npx supabase functions deploy generate-questions
npx supabase functions deploy papybot
npx supabase functions deploy rag-ingest
npx supabase functions deploy billing-checkout
npx supabase functions deploy delete-account
```

#### Cách B — Chạy Supabase nội bộ bằng Docker

```bash
npx supabase start
npx supabase db reset
npx supabase functions serve --env-file supabase/.env.local
```

### 5. Khởi chạy ứng dụng (Web · iOS · Android)

```bash
# Mở Expo Dev Server (nhấn 'w' mở Web, 'i' mở iOS Simulator, 'a' mở Android Emulator)
npm start

# Hoặc chạy trực tiếp từng nền tảng:
npm run web
npm run ios
npm run android
```

> Nếu thay đổi biến trong `.env.local`, hãy khởi động lại tiến trình Expo (`npm start -- --clear`).

### 6. Chạy bản Production bằng Docker (Web + tùy chọn Ollama Local AI)

Dự án đã đóng gói sẵn multi-stage `Dockerfile` (export Expo Web tĩnh và phục vụ qua Nginx với nén `gzip`, cache immutable và `Accept-Ranges` cho video/3D):

```bash
# Build và chạy Papyrus Web tại http://localhost:8080
docker compose up -d --build

# Chạy kèm dịch vụ Ollama LLM cục bộ (cổng 11434)
docker compose --profile local-ai up -d --build

# Dừng container
docker compose down
```

Có thể đổi cổng mặc định bằng biến `PAPYRUS_PORT=3000 docker compose up -d --build`.

### 7. Build cài đặt cho thiết bị di động (EAS)

```bash
# Build bản Preview APK cho Android
npx --no-install eas build --platform android --profile preview

# Build bản Production (AAB Android / IPA iOS)
npx --no-install eas build --platform all --profile production
```

---

## Kiểm định chất lượng & công cụ phát triển

Chạy đầy đủ bộ kiểm tra trước khi commit hoặc phát hành:

```bash
# 1. Kiểm tra kiểu TypeScript nghiêm ngặt (0 lỗi)
npm run typecheck

# 2. Kiểm tra ESLint (0 lỗi, 0 cảnh báo)
npx eslint src --quiet

# 3. Kiểm tra quy tắc Clean Architecture bằng đồ thị AST
./scripts/check_architecture.sh

# 4. Chạy toàn bộ 43 bộ test Jest (129 tests) và test release guard
npm test
npm run test:release

# 5. Xuất thử bản Web Production
npx --no-install expo export --platform web
```

### Tái tạo Asset 3D (Blender) & Video Onboarding (Remotion)

- **Xuất lại mô hình 3D Splash Morph từ Blender 4.2**:
  ```bash
  /Applications/Blender.app/Contents/MacOS/Blender -b -P scripts/blender/build_splash_morph.py
  ```
- **Chỉnh sửa hoặc render lại Video Onboarding Ảo ảnh Thị giác**:
  ```bash
  npm install --prefix video-onboarding
  npm run --prefix video-onboarding studio   # Mở Remotion Studio xem trước trực quan
  npm run --prefix video-onboarding render   # Render & nén ra assets/video/ (.mp4, .webm, .webp)
  ```

---

## Tài liệu dự án

- [Thiết kế Giao diện UI/UX trên Figma](https://www.figma.com/design/qdGvcsHXoTJcuq2NqsK9XS/Papyrus-UI-UX-Prototype?t=wiS4ZAcDfeWtDAkV-1)
- [Tổng quan Kiến trúc hệ thống](docs/architecture/overview.md)
- [Báo cáo 1 — Đề xuất dự án](docs/reports/Capstone-Report-1-Proposal.md)
- [Báo cáo 2 — Thiết kế Kiến trúc chi tiết](docs/reports/Capstone-Report-2-Architecture.md)
- [Báo cáo 3 — Tích hợp AI, Đồng bộ Offline & Kiểm thử](docs/reports/Capstone-Report-3-AI-Testing.md)
- [Hướng dẫn chạy & phát hành vận hành (Runbook)](docs/release/RUNBOOK.md)
- [Hướng dẫn cài đặt trên điện thoại (iOS & Android)](docs/release/RUN-ON-PHONE.md)

---

## Giấy phép

Dự án Capstone **Papyrus** — phát triển phục vụ mục đích học thuật và trình diễn sản phẩm công nghệ giáo dục đa nền tảng.
