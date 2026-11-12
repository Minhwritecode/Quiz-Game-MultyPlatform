# Papyrus: cài Android và chạy iOS

## Project và source

Expo project do nhóm tạo: `f4872061-8848-48a7-9d26-a1dbec552c6b`.
UUID công khai được lưu trong `app.json`; `app.config.js` và release preflight dùng
giá trị này, trừ khi môi trường ghi đè `EAS_PROJECT_ID`. Không tạo starter mới bằng
`create-expo-app`: Papyrus đã có source, cấu hình native, database và dữ liệu học.

Source release nằm trên nhánh `codex/week12-release-ops`. Checkout làm việc hiện tại:
`/Users/macos/Quiz-Game-MultyPlatform/.worktrees/release`. Folder này nằm trong repo,
không dùng `/tmp` để tránh mất build sau khi hệ thống dọn file tạm. `.worktrees/`,
artifacts và thông tin ký bị loại khỏi Git/EAS/Docker context.

```bash
cd /Users/macos/Quiz-Game-MultyPlatform/.worktrees/release
npm ci
npx --no-install eas login
npx --no-install eas whoami
npx --no-install eas project:info
```

Đăng nhập website Expo không tự đăng nhập EAS CLI. Tài khoản CLI phải có quyền với
project trên. Không gửi mật khẩu/token vào chat. `eas-cli` được pin trong lockfile.
Người khác clone nhánh release vào thư mục của mình rồi chạy các lệnh từ repo root.

## Expo Go hay development build?

Papyrus có ML Kit cùng các module native. **Expo Go không có ML Kit của ứng dụng**,
nên hướng dẫn starter “quét QR Expo Go” không đủ để chạy và nghiệm thu toàn bộ app.
Development build là app Papyrus cài riêng, kết nối Metro khi phát triển; preview
đóng gói JS sẵn, chạy được khi máy tính tắt.

| Mục đích | Profile | Điều kiện |
| --- | --- | --- |
| Android cài trực tiếp | `preview` → APK | Không cần Play Console |
| Android lập trình | `development` | Metro + SDK local hoặc EAS |
| iOS Simulator | `development-simulator` / `preview-simulator` | Xcode/runtime tương thích; không cần membership trả phí |
| iPhone qua EAS nội bộ | `development` / `preview` | Apple Developer trả phí, đăng ký UDID và provisioning |
| iPhone build từ Mac | local development | Xcode, cáp, Apple ID/Signing Team; Personal Team có giới hạn |
| TestFlight/App Store | `production` | Apple Developer + App Store Connect + nghiệm thu |

APK không cài được trên iPhone. Simulator `.app` không cài được lên iPhone.

## Biến môi trường

Hai biến dùng trong ứng dụng là `EXPO_PUBLIC_SUPABASE_URL` và
`EXPO_PUBLIC_SUPABASE_ANON_KEY` (nhận publishable key). Local đặt trong `.env.local`.
Cloud cần cấu hình các biến này trong Expo → Environment variables → environment
`preview` hoặc `development`. `.env.local` không được upload lên EAS.

`APP_VARIANT` và channel đã được chọn trong `eas.json`; không dùng variant production
để thử dữ liệu. Không đặt service-role key, Gemini key hay mật khẩu database trong
biến `EXPO_PUBLIC_*`. AI cần Edge Function và provider secret phía server; build app
không tự kích hoạt dịch vụ này. Cấu hình production còn yêu cầu policy/support URLs
và Sentry như [RUNBOOK](RUNBOOK.md).

## Android APK qua EAS

Build preview hiện đã upload lên EAS với ID
`f9528839-100e-4441-9e55-b4cda46b18bc`:
[xem build trên Expo](https://expo.dev/accounts/michaelminhs-team/projects/papyrus/builds/f9528839-100e-4441-9e55-b4cda46b18bc).
Trạng thái lần kiểm tra gần nhất: `IN_QUEUE`. Mở trang trên để xem tiến độ và lấy
APK khi build hoàn tất. Chưa coi đây là artifact đã nghiệm thu.

Sau khi đăng nhập và cấu hình environment preview:

```bash
npx --no-install eas build --platform android --profile preview
```

Chọn đúng project Papyrus và để EAS quản lý signing key của package preview. Không
tạo lại khóa nếu đã có bản cài cần cập nhật. Build có thể dùng quota của tài khoản;
không nâng gói thanh toán tự động. Tải APK từ đúng build đã hoàn tất, chuyển sang
Android, mở file và cho phép Files/trình duyệt cài từ nguồn này. Tên app **Papyrus
Preview**; không cần Expo Go hoặc Metro.

Build local để kiểm tra native toolchain:

```bash
export ANDROID_HOME="$HOME/Library/Android/sdk"
APP_VARIANT=preview npx --no-install expo prebuild --platform android --no-install
cd android
APP_VARIANT=preview ./gradlew :app:assembleRelease --no-daemon --max-workers=4
cd ..
```

APK raw ở `android/app/build/outputs/apk/release/app-release.apk`. **Template local
mặc định dùng debug keystore dù build mode là Release**. Phải cấu hình signing thật
và kiểm tra certificate trước khi gọi nó là APK phát hành. EAS xử lý phần signing
cho build cloud; không tự đưa APK raw lên Play Store.

Để ký bản **local preview** bằng khóa QA riêng và tạo checksum:

```bash
npm run apk:package
```

Script kiểm tra đúng preview package/version, không debuggable, ZIP alignment 16 KB,
rồi ký và xác minh bằng `apksigner`. Kết quả nằm ở `artifacts/android/`, gồm APK,
`SHA256SUMS`, certificate fingerprint và build metadata. ZIP alignment không chứng
minh ELF/native libraries tương thích 16 KB; vẫn cần kiểm thử thiết bị.

Khóa/mật khẩu nằm trong `.local-signing/`, quyền 700/600, không vào Git/EAS/Docker.
Sao lưu **cả folder** vào nơi quản lý bí mật của nhóm trước khi xóa checkout. Giữ cùng
khóa cho lần cập nhật sau; không gửi khóa cùng APK. Nếu chuyển sang EAS cho **cùng**
package preview, phải nhập đúng khóa này vào EAS hoặc dùng package khác; ký bằng
khóa khác sẽ không cập nhật được bản đã cài. Khóa QA không phải khóa Play production.

## iOS Simulator trên Mac

Build local ngày 12/11/2026 đã dừng ở ExpoModulesJSI: **Swift tools 6.2 required,
installed 6.1** (Xcode 16.3). CocoaPods đã cài thành công nhưng chưa có `.app`/IPA.
Không sửa version trong dependency để lách lỗi. Máy này cần toolchain Xcode mới
tương thích với toàn bộ Expo SDK, hoặc build EAS trên image đã pin trong `eas.json`.
EAS Simulator build `3f1b276d-b189-4c33-b4a8-afd755400708` đã `FINISHED` và đã cài,
mở trên iPhone 16 Pro / iOS 18.4 Simulator:
[mở trang build iOS Simulator](https://expo.dev/accounts/michaelminhs-team/projects/papyrus/builds/3f1b276d-b189-4c33-b4a8-afd755400708).
Đã xác nhận first launch và màn leaderboard hiện ra. Dữ liệu leaderboard đang là
demo/mock; đây không phải kiểm thử auth, camera/OCR, offline, notification hay các
luồng học. Cần nghiệm thu các luồng đó trên bản preview và thiết bị thật.
Kiểm tra trước khi build local:

```bash
npm run ios:check
```

Sau khi kiểm tra pass, mở Xcode hoàn thành thiết lập và cài iOS runtime, rồi chạy:

```bash
APP_VARIANT=development npm run ios
```

Lệnh build native, cài **Papyrus Dev**, khởi động Metro. Lần sau nếu chỉ sửa JS/TS:

```bash
APP_VARIANT=development npx --no-install expo start --dev-client
# Nhấn i để mở Simulator đã cài app.
```

Cloud Simulator build (khác dịch vụ streaming Simulator trả phí trên dashboard):

```bash
npx --no-install eas build --platform ios --profile development-simulator
```

Chọn artifact của đúng build để cài vào Simulator trên Mac. Profile
`preview-simulator` tạo bản đóng gói JS sẵn, không cần Metro.

## iPhone thật

**Qua Xcode trên Mac:** kết nối cáp → Trust → bật Developer Mode khi iOS yêu cầu →
Xcode Settings → Accounts, tự đăng nhập Apple ID. Chạy:

```bash
APP_VARIANT=development npm run ios -- --device
```

Chọn iPhone và Signing Team. Nếu cần, mở workspace trong `ios/` bằng Xcode và chọn
target PapyrusDev → Signing & Capabilities → Team. Apple ID miễn phí có giới hạn
provisioning; không thay thế TestFlight cho việc phân phối cả nhóm.

**Qua EAS khi đã có Apple Developer:** đăng ký thiết bị trước khi build:

```bash
npx --no-install eas device:create
npx --no-install eas build --platform ios --profile development
APP_VARIANT=development npx --no-install expo start --dev-client --lan
```

Cài từ link của build hoàn tất lên iPhone đã đăng ký. Mac/iPhone dùng cùng Wi-Fi,
cho phép Local Network, mở Papyrus Dev và kết nối Metro. Dùng QR development build,
không quét bằng Expo Go. Thêm UDID sau khi build có thể cần build/sign lại.
Thay đổi module native, plugin hoặc permission luôn cần bản cài mới.

## Checklist trên bản cài thật

- [ ] Cold start/reopen không crash; preview chạy không cần Metro.
- [ ] Tạo bộ thủ công → lưu → học → kết quả; airplane mode và restart vẫn đọc được.
- [ ] Camera/OCR: cho phép, từ chối, hủy; dùng ảnh tài liệu thật.
- [ ] Auth, đồng bộ, recovery callback đúng scheme variant.
- [ ] Nhắc học bật/tắt, nhận ở background, nhấn notification mở đúng màn.
- [ ] Font lớn, theme, xoay màn hình, TalkBack/VoiceOver, tablet/foldable.
- [ ] Nâng cấp bằng cùng signing certificate, giữ được dữ liệu cũ.
- [ ] AI và xóa tài khoản chạy trên backend test đã deploy.
- [ ] Đo startup/memory/frame time trên release binary.

Không đánh dấu test native từ kết quả Jest/web export. Ghi bằng chứng và phần chưa
đạt vào [Week 12 checklist](WEEK-12-CHECKLIST.md) trước khi mở cho người dùng rộng hơn.

Nguồn: [Expo native builds](https://docs.expo.dev/guides/local-app-development/),
[APK](https://docs.expo.dev/build-reference/apk/),
[iOS Simulator](https://docs.expo.dev/build-reference/simulators/),
[Internal distribution](https://docs.expo.dev/build/internal-distribution/).
Image build đã đối chiếu với [Expo infrastructure](https://docs.expo.dev/build-reference/infrastructure/);
chọn Xcode local theo [yêu cầu hệ thống của Apple](https://developer.apple.com/xcode/system-requirements).
