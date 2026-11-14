# Papyrus — Week 12 release readiness

Ngày rà soát: 13/11/2026. Nguồn yêu cầu: `Week-12-Release-Ops.pdf`, 61 trang,
Nguyen Thanh Tuan, VKU. Baseline: `8b0b8aa` (đã merge game của nhóm).

**Kết luận: đã tạo APK preview ký số để QA; chưa đủ điều kiện công bố production.**
Nhóm đã tạo Expo project `f4872061-8848-48a7-9d26-a1dbec552c6b`, liên kết GitHub,
xác nhận EAS CLI là `michaelminh03` và quyền Owner trên project. Local Android
Release build và APK preview ký bằng khóa QA riêng đã pass kiểm tra chữ ký/checksum.
EAS Android preview build đã upload (ID `f9528839-100e-4441-9e55-b4cda46b18bc`)
và đang `IN_QUEUE`; iOS Simulator build (ID `3f1b276d-b189-4c33-b4a8-afd755400708`)
đã `FINISHED`, cài và mở được trên iPhone 16 Pro Simulator iOS 18.4. Đây mới là
kiểm tra cài/mở lần đầu; chưa nghiệm thu luồng sử dụng, camera, auth, offline hay
thông báo. Chưa có Sentry/store account, thiết bị thật hoặc store approval. Không
đổi gameplay của nhóm.

## 1. Phạm vi bản đầu tiên

Luồng chính: nhập/chụp tài liệu → duyệt OCR → tạo hoặc tự viết câu hỏi → sửa đáp án
→ lưu trên thiết bị → ôn tập → lưu/xem kết quả. Đăng nhập và đồng bộ bộ câu hỏi là
luồng online bổ sung. Battle và các game đã merge được giữ nguyên, cần QA riêng.

Không yêu cầu mở rộng RAG, thanh toán, ELO, matchmaking, social/chat, PDF nâng cao
để hoàn tất gói release đầu tiên. Các mục này vẫn thuộc backlog tham khảo bốn repo,
không được đánh dấu hoàn thành. **Chưa match toàn bộ bốn repo hoặc toàn bộ plan gốc.**

| Phần app | Trạng thái kiểm tra | Quyết định cho release |
| --- | --- | --- |
| TypeScript / RN / Expo | Source client chính là TS/TSX; Expo 58, RN 0.88 | Giữ stack hiện tại |
| Manual authoring | Đã thêm câu hỏi trống, tên bộ, validation; không còn tự điền câu AI mẫu | Core offline không phụ thuộc API |
| Camera/OCR | Adapter ML Kit và permission/cancel đã có; native hardware chưa đo | Bắt buộc test điện thoại |
| AI | Đã có JWT subject check, JSON/type validation, deadline, integer answer; chưa gọi provider thật | Cần secret, quota/rate limit và acceptance trước mở rộng người dùng |
| Local study/result | Lưu local có sẵn; thêm báo lỗi lưu và retry | Cần chứng minh restart/airplane trên native |
| Auth | Sửa login trống và báo lỗi khi chưa cấu hình; signup/reset/OAuth code đã có | Còn kiểm thử callback/recovery native và SMTP |
| Xóa tài khoản | Settings → Privacy; verified Auth subject; cleanup transaction; dọn cache local | SQL/API local pass; chưa deploy cloud |
| Sync | Manual outbox/revision/conflict đã có | Chưa gọi là auto/background sync; còn bridge cloud → study |
| Battle | Backend security/lifecycle SQL hồi quy pass | Chưa thay gameplay; còn QR và native multi-client |
| Games | Memory Match/Survival giữ nguyên | Chưa có native acceptance/timer QA |
| Leaderboard/home metrics | Vẫn có dữ liệu minh họa từ baseline | Nhóm phải phân biệt dữ liệu mẫu trước public store; không quảng cáo realtime ranking |
| Clean Architecture | OCR/AI routes được đưa qua composition; Domain mới thuần TS | Checker hiện vẫn regex; còn battle AsyncStorage và core/sync legacy |
| Security dependencies | Audit runtime báo 28 findings: 1 low, 25 moderate, 2 high, 0 critical lúc rà soát | Hai high liên quan Zod cũ của Expo CLI; cần nâng tương thích, không ép major tự động |

## 2. Đối chiếu toàn bộ các phần của slide

`[x]` = đã chuẩn bị/kiểm chứng đúng điều được mô tả; `[ ]` = còn thiếu.
Chuẩn bị cấu hình không đồng nghĩa dịch vụ đã hoạt động.

### Pipeline, version, flavors — trang 5–9

- [x] `app.config.js` lấy version từ `package.json`, hiện `0.2.0`.
- [x] Dev/Preview/Production có bundle ID, tên và deep-link scheme riêng.
- [x] EAS dùng remote build number, production `autoIncrement`.
- [x] Preflight kiểm tra tag khớp version, EAS UUID, HTTPS backend và public key.
- [x] Android prebuild pass; `enableMinifyInReleaseBuilds` và `enableShrinkResourcesInReleaseBuilds` là `true`.
- [ ] Đo startup, memory, frame time và kích thước trên **release binary**, không dùng web/debug để suy ra.

### Android signing / Google Play — trang 10–17

- [x] Preview APK, production AAB được cấu hình rõ.
- [x] Loại keystore, private key, credentials khỏi Git/EAS/Docker context.
- [x] Workflow giữ đúng EAS build ID; tải artifact và SHA256, tạo GitHub Release **draft** trên tag.
- [x] Nhóm tạo Expo project và cung cấp UUID; source release đã liên kết UUID.
- [x] Xác thực EAS CLI/account và để EAS quản lý signing keystore cho package preview.
- [x] Tạo local release APK preview; `apksigner verify`, certificate fingerprint,
  ZIP alignment check và SHA-256 đều pass. Keystore QA chưa được vault-backed up.
- [ ] Xác nhận EAS cloud APK hoàn tất; cài APK trên Android thật/emulator, kiểm tra
  nâng cấp bằng cùng certificate. Build này chưa phải production AAB/Play App Signing.
- [ ] Play App Signing, tạo app Play Console, khai Data Safety, reviewer account,
  internal testing.
- [ ] Kiểm tra target API/tester requirements hiện hành trong Console; không sao chép mốc API/chi phí của slide thành cam kết 2026.

### iOS signing / TestFlight — trang 18–25

- [x] EAS production iOS dùng cùng pipeline, riêng platform; supportsTablet bật.
- [x] `fastlane ios release/submit` là wrapper cho EAS, không tạo kho chứng chỉ match thứ hai.
- [ ] Apple Developer, App Store Connect app ID, certificate, provisioning/UDID khi cần.
- [ ] Khai `ascAppId` thực trong submit config; kiểm tra privacy manifests của toàn bộ SDK.
- [ ] Build IPA, upload dSYM, TestFlight install/update trên iPhone/iPad thật.

### CI/CD, secrets, Fastlane — trang 26–34

- [x] CI typecheck, lint, Jest/coverage, architecture, web export và release guard tests.
- [x] Thêm CI local SQL/API (không dùng cloud/project shared).
- [x] EAS CLI pin `27.7.2`; Supabase CI pin `3.1.0`; Fastlane pin `2.241.2`.
- [x] Chỉ build sau quality job; không submit store tự động.
- [x] `fastlane/Fastfile` syntax pass; có verify/preview/release/submit theo exact build ID.
- [ ] Chạy full Fastlane với Ruby >=3.2 và tạo Gemfile.lock (máy này Ruby 2.6).
- [ ] Cấu hình GitHub environments/reviewers, branch protections và secrets đúng scope.
- [ ] GitHub-hosted CI pass; YAML hợp lệ/local pass chưa thay cho kết quả runner.
- [ ] Xử lý 36 cảnh báo lint baseline. Compiler diagnostics trên file legacy đang để warning, React Compiler tắt trong dynamic config; chưa đạt zero-warning của slide.

### OTA / rollback / minimum version — trang 35–40

- [x] `expo-updates`, channel riêng, runtime `fingerprint` để tránh bundle/native không khớp.
- [x] Chưa có EAS project thì OTA tắt; không có URL project giả.
- [x] OTA workflow thủ công, dùng đúng EAS environment, production khởi đầu 10%.
- [x] Upload source maps sau OTA; playbook rollback cùng channel/runtime.
- [x] Minimum-version gate đọc HTTPS policy theo platform; invalid/offline fail-open để giữ học offline.
- [ ] Host policy với store URLs thật; diễn tập nâng cấp/rollback trên signed build.
- [ ] Nếu bật OTA code signing: tạo certificate/private key riêng, secret vault, test verification. Chưa cấu hình code signing OTA.

### ASO / review survival — trang 41–47

- [x] Không còn lưu ba câu demo dưới nhãn output AI.
- [x] Account deletion có xác nhận DELETE; không đặt service-role key trong client.
- [x] Privacy/support entry và review prompt sau >=5 lượt học khác nhau, >=7 ngày, cooldown 90 ngày.
- [x] Draft store copy, data inventory, reviewer/device checklist tại `STORE-READINESS.md`.
- [ ] Publish policy/support/deletion web URL hoạt động; điền đơn vị chịu trách nhiệm/retention.
- [ ] Kiểm thử consent/data disclosures, native permissions và account deletion trên cloud dev.
- [ ] Screenshots từ build thật và reviewer login có dữ liệu học phù hợp.
- [ ] Cold start, tablet/foldable/rotation, font 200%, VoiceOver/TalkBack, slow network.

### Observability — trang 48–54

- [x] Sentry init/wrap/root error recovery; theo môi trường; chỉ bật khi có DSN và không phải debug.
- [x] JS event allowlist bỏ user, request, headers, message, breadcrumb và source context; có test không lộ nội dung/token.
- [x] OCR/generation performance spans; log/replay/screenshot/view hierarchy không được chủ động thu thập.
- [x] Metro/plugin cấu hình source maps; lỗi nguồn không trả raw provider text ra client.
- [ ] Tạo Sentry project/DSN/token, xác nhận một crash thật được symbolicate (JS + native).
- [ ] Kiểm tra native envelope/attachments riêng; JS beforeSend test không chứng minh mọi crash native đã sạch PII.
- [ ] Dashboard alert crash/ANR/latency + người trực; chưa có số crash-free hay p95 thực.
- [ ] Product analytics AARRR: chưa thêm SDK hay tuyên bố đã đo retention; chỉ lập schema/consent ở runbook.

### Final defense — trang 55–61

- [x] Checklist hồ sơ, bố cục 12 slide và kịch bản demo trong `DEFENSE-PACK.md`.
- [ ] Report 4 PDF 25–40 trang theo template chính thức, có số đo thật.
- [ ] Slide deck PDF 10–12 trang; chưa tạo PDF từ outline.
- [ ] GitHub Release v1.0.0 signed binary; không nâng version chỉ để đủ biểu mẫu.
- [ ] Video 3–5 phút 1080p bằng điện thoại thật; demo offline/reconnect đúng khả năng.
- [ ] Tất cả thành viên đọc code, thống nhất đóng góp và kiểm tra link nộp bài.

## 3. Bằng chứng tại checkpoint

| Kiểm tra | Kết quả |
| --- | --- |
| TypeScript | Pass |
| Jest | 14 suites / 28 tests pass sau khi hợp nhất cập nhật của nhóm; thêm 3 tests local reminders |
| Node release guards | 3 tests pass |
| SQL | battle_security, battle_lifecycle, account_cleanup pass, fixture rollback |
| API local | 2 tài khoản, subject isolation, deleted JWT, invalid AI JSON/types pass; không gọi Gemini |
| Advisor local | Không trả finding; chỉ cho stack local tại checkpoint này |
| Expo | Web export pass; Android prebuild/release compile pass; APK local preview ký/xác minh pass; EAS Android `IN_QUEUE`; iOS Simulator `FINISHED`, installed/launched on iPhone 16 Pro iOS 18.4 |
| Local Android APK | `artifacts/android/papyrus-0.2.0-preview.apk`, 146.4 MiB; SHA-256 `65d0a29ff85a4cac6b47133b427903730ec1e4df6599d927ce51ef621ba67582`; no Android device/AVD connected for install test |
| Fastlane / workflows | Ruby syntax và YAML parse pass, chưa chạy dịch vụ ngoài |
| Browser review | Không chạy được vì local browser use bị tắt trong Work settings |
| Native E2E | `e2e/maestro/core-study.yaml` đã chuẩn bị, chưa chạy; không phải bằng chứng pass |
| Cloud | Không deploy migration/Function mới trong task này |

## 4. Thứ tự hoàn tất release nhỏ

1. Review/merge nhánh này sau khi nhóm xử lý các thay đổi đang stage; `npm ci`.
2. Đóng các lỗi core và cảnh báo/security có ảnh hưởng release; test lại game theo chủ sở hữu.
3. Tạo EAS/Sentry và môi trường dev/preview; cấu hình backend dev riêng, triển khai migration + Functions sau kiểm thử.
4. Chọn một điện thoại Android làm chuẩn, build preview APK, chạy offline/manual/OCR/auth/sync/deletion và Maestro.
5. Bật AI có quota, đo ít nhất tập dữ liệu M3; không công bố AI nếu chưa test provider.
6. Hoàn thiện public links/metadata; build production candidate, kiểm chữ ký và telemetry.
7. Internal testing → sửa lỗi → nghiệm thu → publish draft release; public store chỉ khi toàn bộ gate đạt.

## 5. Nguồn kỹ thuật đối chiếu

- [Expo environments](https://docs.expo.dev/eas/environment-variables/)
- [Expo runtime versions](https://docs.expo.dev/eas-update/runtime-versions/)
- [Expo rollback](https://docs.expo.dev/eas-update/rollbacks/)
- [Expo Sentry integration](https://docs.expo.dev/guides/using-sentry/)
- [Apple account deletion](https://developer.apple.com/help/app-review/guideline-reference/5-1-1-account-deletion/)
- [Google Play user data](https://support.google.com/googleplay/android-developer/answer/10144311)
- [Supabase Auth deleteUser](https://supabase.com/docs/reference/javascript/auth-admin-deleteuser)
