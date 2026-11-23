# Papyrus — Hướng dẫn Phát hành Miễn phí 100% (Android APK, Kho Ứng dụng $0 & iPhone qua Xcode)

Tài liệu này hướng dẫn 3 cách phát hành và cài đặt **Papyrus** hoàn toàn miễn phí ($0 phí Google Play / $0 phí Apple Developer) sử dụng sẵn hạ tầng trong repository.

---

## 1. Android — Tự động build `.apk` miễn phí trên GitHub Actions & gắn lên GitHub Releases

Workflow [`.github/workflows/android-free-apk.yml`](../../.github/workflows/android-free-apk.yml) tự động biên dịch bản Release Android (bật R8 minify + shrink resources, nén kiến trúc `arm64-v8a,armeabi-v7a` gọn nhẹ, căn chỉnh trang nhớ 16 KB, ký `apksigner` và tạo checksum `SHA256SUMS-android.txt`).

### Cách sử dụng
1. **Tự động khi ra phiên bản mới**: Mỗi khi bạn đẩy tag `v*.*.*` (ví dụ `git tag -a v0.2.1 -m "Papyrus v0.2.1" && git push origin v0.2.1`), GitHub Actions tự động:
   - Build file `papyrus-v0.2.1-android.apk` (không tốn quota EAS).
   - Xác minh chữ ký (`apksigner verify`) và kiểm tra không phải debug build.
   - Đính kèm file `.apk` + `SHA256SUMS-android.txt` thẳng vào mục **Releases** trên GitHub.
2. **Chạy tay bất kỳ lúc nào (1 click)**:
   - Vào GitHub → tab **Actions** → chọn **Android Free APK Release** → bấm **Run workflow**.
   - Điền `release_tag: v0.2.0` nếu muốn gắn trực tiếp file `.apk` vào bản Release `v0.2.0` đang có.

### Cài đặt trên điện thoại Android
1. Mở trang **Releases** của repo trên điện thoại Android → tải `papyrus-v*.apk`.
2. Mở file đã tải → cho phép *"Install unknown apps / Cài đặt ứng dụng không rõ nguồn gốc"* → bấm **Cài đặt**.

---

## 2. Đưa lên các Kho Ứng dụng Android Miễn phí ($0 phí Developer)

> **Quan trọng trước khi nộp lên bất kỳ kho ứng dụng nào**: Bạn cần tạo **1 khóa ký cố định (Permanent Release Keystore)** để mọi bản cập nhật sau này cài đè được bản cũ mà không mất dữ liệu người dùng.

### Bước A — Tạo khóa ký cố định 1 lần duy nhất
Chạy lệnh ngay trong thư mục dự án:
```bash
npm run android:keystore
```
Script sẽ tạo khóa RSA-3072 an toàn trong `.local-signing/papyrus-release.jks` (đã nằm trong `.gitignore`, tuyệt đối không bao giờ bị đẩy lên Git), đồng thời in ra:
- **SHA-1 & SHA-256 Fingerprint** (dùng cho Huawei AppGallery / Firebase / Supabase OAuth).
- 4 GitHub Secrets cần thêm vào **Settings → Secrets and variables → Actions**:
  - `ANDROID_KEYSTORE_BASE64`
  - `ANDROID_KEYSTORE_PASSWORD`
  - `ANDROID_KEY_ALIAS`
  - `ANDROID_KEY_PASSWORD`

Sau khi thêm 4 secret trên, mọi bản `.apk` build từ GitHub Actions sẽ được ký bằng **chứng chỉ phát hành vĩnh viễn của riêng bạn**, sẵn sàng nộp lên tất cả các kho dưới đây.

### Bước B — Danh sách các kênh phân phối Android $0

| Kênh phân phối | Phí Developer | Tệp cần nộp | Điểm mạnh & Lưu ý |
|---|---|---|---|
| **Amazon Appstore** | **$0** | Signed `.apk` | Đăng ký tại [developer.amazon.com](https://developer.amazon.com/apps-and-games), hỗ trợ toàn cầu, duyệt nhanh (1–3 ngày). |
| **Samsung Galaxy Store** | **$0** | Signed `.apk` | Đăng ký tại [seller.samsungapps.com](https://seller.samsungapps.com), tiếp cận hàng triệu máy Samsung mà không cần CH Play. |
| **Huawei AppGallery** | **$0** | Signed `.apk` + SHA-256 | Đăng ký tại [developer.huawei.com](https://developer.huawei.com), dán SHA-256 từ `npm run android:keystore`. |
| **Firebase App Distribution** | **$0** | Tự động từ GitHub Actions! | Tạo project Firebase miễn phí → thêm 2 secrets `FIREBASE_ANDROID_APP_ID` và `FIREBASE_SERVICE_CREDENTIALS` vào GitHub → mỗi bản build tự gửi link cài đặt chuyên nghiệp tới nhóm tester. |
| **APKPure / Uptodown** | **$0** | Signed `.apk` + `SHA256SUMS` | Cổng tải APK uy tín, nộp trực tiếp bằng tài khoản Developer miễn phí. |

### Bước C — Nội dung mô tả Store mẫu (Copy-Paste nhanh)
- **App Name**: `Papyrus — AI Quiz & 3D Study Arena`
- **Short Description (VI)**: `Quét tài liệu/PDF thành bộ câu hỏi AI, học cùng gia sư Papybot và đấu trí 1v1.`
- **Short Description (EN)**: `Turn notes & PDFs into AI quizzes, study with Papybot RAG tutor, and compete in 3D arenas.`
- **Category**: Education (Giáo dục)
- **Content Rating**: Everyone (Mọi lứa tuổi)
- **Full Description (EN)**:
  > Papyrus transforms dense study notes, slides, and PDFs into interactive AI quizzes and gamified battles.
  >
  > - **AI Quiz Generation**: Scan notes or upload PDF/DOCX/TXT to generate structured multiple-choice decks in seconds.
  > - **Papybot RAG Tutor**: Ask context-aware questions grounded directly in your study materials.
  > - **Gamified Learning**: Survival Boss Arena, Match Pairs, Ranked 1v1 ELO Duels, Real-Time Multiplayer Rooms, Daily Streaks, and Leaderboards.
  > - **Offline-First Architecture**: Local SQLite persistence keeps your study library accessible even without internet, with optional cloud sync.

---

## 3. Cài trực tiếp lên iPhone cá nhân Miễn phí ($0 Apple ID qua Xcode trên Mac)

Apple cho phép dùng **Apple ID thường (Personal Team — $0)** để cài ứng dụng trực tiếp từ máy Mac vào iPhone cá nhân qua cáp USB (chứng chỉ có hiệu lực **7 ngày**, hết 7 ngày chỉ cần cắm cáp bấm Run lại trong Xcode).

### Chạy kiểm tra & mở dự án tự động
```bash
npm run ios:free-install
```

### Lưu ý quan trọng cho máy Mac đang dùng Xcode 16.3
Expo SDK 58 (`expo-modules-jsi`) yêu cầu **Swift >= 6.2** (có trong **Xcode 26+**):
- Máy Mac chạy **macOS 15.6+ (Sequoia)** hoàn toàn cài được **Xcode 26 miễn phí** bằng Apple ID thường tại [developer.apple.com/download/all/](https://developer.apple.com/download/all/).
- Sau khi cài Xcode 26, chạy:
  ```bash
  sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
  npm run ios:free-install
  ```
- **Nếu chưa muốn nâng Xcode ngay (chỉ cần chạy demo trên iOS Simulator miễn phí)**:
  ```bash
  npx --no-install eas login
  npx --no-install eas build --platform ios --profile preview-simulator
  ```
  Expo EAS Free tier sẽ build bằng Xcode 27 trên cloud miễn phí rồi trả file `.app` — bạn chỉ cần kéo thả vào iOS Simulator trên máy Mac để demo!

### 4 bước ký miễn phí trên Xcode khi cắm iPhone
1. Cắm cáp iPhone vào Mac → chọn **Trust This Computer** → trên iPhone bật **Settings → Privacy & Security → Developer Mode**.
2. Trong Xcode: **Settings (`Cmd + ,`) → Accounts → `+`** → đăng nhập Apple ID thường ($0).
3. Chọn target **PapyrusDev** → tab **Signing & Capabilities**:
   - Bật **Automatically manage signing**.
   - **Team**: chọn `<Tên bạn> (Personal Team)`.
   - **Bundle Identifier**: đổi thành mã duy nhất (ví dụ `com.minh.papyrus.dev`).
   - *(Nếu Xcode báo lỗi Push Notifications không hỗ trợ trên Personal Team miễn phí, nhấn nút xóa capability **Push Notifications** chỉ trong bản cài cá nhân này).*
4. Chọn đúng chiếc iPhone ở thanh trên cùng → bấm **▶ Run (`Cmd + R`)** → trên iPhone vào **Settings → General → VPN & Device Management → Trust** là mở app Papyrus chạy trực tiếp!
