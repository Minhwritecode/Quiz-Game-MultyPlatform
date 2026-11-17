# [REPORT 3] AI INTEGRATION, OFFLINE SYNC & TEST REPORT

**Course:** Cross-Platform Mobile App Development - Capstone Project

**Institution:** Trường Đại học Công nghệ Thông tin và Truyền thông Việt - Hàn (VKU)

**Instructor:** TS. Nguyễn Thanh Tuấn

**Project Title:** Papyrus - Ứng dụng ôn tập và đấu trí thời gian thực tích hợp AI sinh câu hỏi từ tài liệu cá nhân

**English Title:** Papyrus - An AI-Powered Study and Real-Time Quiz Battle Application Using Personal Learning Materials

**Team Name:** Nhóm Papyrus

**Academic Term:** Semester 1 (2026 - 2027)

**Milestone:** Report 3 / M3 - AI Integration, Offline Sync & Automated Tests

**Deadline:** Week 11 theo biểu mẫu học phần

**Version / Evidence date:** 1.0 / 11 November 2026

**Implementation baseline:** `bed201a6341352afe6a1258ffc00f345d951f383`

> **Slogan:** From Ancient Scroll to AI Power.

| Thành viên | MSSV | Phân công dự kiến theo Report 1 | Đóng góp thực tế |
| --- | --- | --- | --- |
| Đinh Trần Tiến Minh | 23IT162 | UI/UX Design, React Native Presentation Layer, Điều hướng và State Management | 33.33% |
| Lê Tuấn Khải | 23IT119 | Domain Layer, nghiệp vụ câu hỏi và ôn tập, tích hợp AI/OCR, kiểm tra dữ liệu sinh bởi LLM và Unit Tests | 33.33% |
| Dư Thị Như Yến | 23IT328 | Data Layer, Supabase/PostgreSQL, RLS, Offline Sync, tích hợp backend và CI/CD | 33.33% |

Phân công không thay thế bằng chứng đóng góp. Nhóm cần xác nhận MSSV, vai trò và
tỷ lệ thực tế trước khi xuất PDF; tổng tỷ lệ phải bằng 100%.

### Tóm tắt và phạm vi báo cáo

Báo cáo giữ nguyên ba mục chính của `Capstone-Report-3-AI-Testing.md` do học phần
cung cấp. Nội dung kiến trúc và phân loại kiểm thử đối chiếu với slide
`Week-09-Architecture.pdf`: mô hình ba lớp ở trang 4 và tháp kiểm thử ở trang 6.
Client của dự án là React Native + TypeScript + Expo; không sử dụng Flutter/Dart
trong source ứng dụng Papyrus.

Đến thời điểm lập báo cáo, dự án có adapter OCR, adapter sinh câu hỏi Gemini,
giao diện duyệt câu hỏi, lưu trữ local, đồng bộ bộ đề theo tài khoản và backend
battle có kiểm thử local. Database đã triển khai lên Supabase cloud. Tuy nhiên,
chưa có bằng chứng AI chạy với provider thật, benchmark trên thiết bị, bộ test
component/E2E đầy đủ hay APK nội bộ được kiểm chứng. Vì vậy đây là báo cáo tiến độ
M3 có phần chưa đạt, không phải xác nhận hoàn tất milestone.

Các trạng thái sử dụng xuyên suốt:

- **Đã kiểm chứng:** có lệnh kiểm tra hoặc kết quả thực nghiệm được ghi nhận, kèm phạm vi.
- **Có triển khai, chưa kiểm chứng đầy đủ:** code tồn tại nhưng thiếu bằng chứng tích hợp/thiết bị.
- **Chưa triển khai / chưa đo:** không có tính năng hoặc kết quả đo tương ứng.

---

## 1. ARTIFICIAL INTELLIGENCE CAPABILITIES & BENCHMARKS

- **Model Backbone:** Google ML Kit Text Recognition với Latin script cho OCR on-device; Gemini cho sinh câu hỏi qua Supabase Edge Function. Model Gemini cụ thể được lấy từ biến server `GEMINI_MODEL`, chưa chốt bằng một lần chạy provider thực tế.
- **Performance Benchmarks:** OCR inference latency, accuracy và RAM footprint **chưa đo**. Không sử dụng các giá trị mẫu 85 ms, 94,2% và +45 MB làm kết quả của Papyrus.

### 1.1. Vai trò của AI trong nghiệp vụ

Papyrus giúp người học biến ghi chú hoặc ảnh tài liệu thành bộ câu hỏi trắc
nghiệm có thể kiểm tra lại. OCR trích xuất văn bản; LLM đề xuất câu hỏi, bốn lựa
chọn, đáp án và giải thích. Người học phải có cơ hội sửa văn bản nguồn và duyệt
câu hỏi trước khi lưu. Kiểm tra cấu trúc JSON không chứng minh nội dung AI đúng
về mặt kiến thức; bước đánh giá của người học vẫn cần thiết.

| Khả năng | Triển khai hiện tại | Bằng chứng / giới hạn |
| --- | --- | --- |
| Camera và thư viện ảnh | `expo-image-picker`; xin quyền camera, xử lý hủy và lỗi | Hai test mock xác nhận từ chối quyền/hủy; chưa chứng minh camera vật lý hoạt động |
| OCR local | `@react-native-ml-kit/text-recognition`, `TextRecognitionScript.LATIN` | Có native adapter; độ chính xác dấu tiếng Việt và offline trên thiết bị chưa đo |
| Nhiều trang | Gallery chọn nhiều ảnh; xử lý tuần tự, tối đa 10 ảnh mỗi lượt | Chưa có đầy đủ reorder/recapture/preprocessing hoặc benchmark bộ nhớ |
| Chỉnh văn bản | TextInput nhiều dòng, paste fallback, giới hạn 30.000 ký tự | Nguồn hiện nằm trong state; chưa lưu lịch sử source document bền vững |
| Sinh câu hỏi | Edge Function gọi Gemini `generateContent`, nhận một JSON hoàn chỉnh | Code đã có; provider/model/secrets và luồng cloud thực tế chưa được kiểm chứng |
| Duyệt và lưu | Sửa nội dung, lựa chọn, đáp án, giải thích; xóa câu; kiểm tra trước lưu local | Chưa có component test; chưa sinh lại riêng từng câu |
| Streaming / RAG | Có parser streaming sơ bộ trong source; chưa nối luồng thật | Chưa có SSE end-to-end, PDF/DOCX ingestion, truy xuất nguồn hay citations |

### 1.2. Luồng dữ liệu và ranh giới riêng tư

```text
Camera / Gallery --> URI ảnh local --> ML Kit native --> Văn bản OCR
                                                        |
Paste --------------------------------------------------+
                                                        v
                                       Người dùng sửa văn bản nguồn
                                                        |
                                       Bấm Generate from source
                                                        v
App + user session --> Supabase Edge Function --> Gemini (văn bản)
                                                        |
                         Kiểm tra JSON/câu hỏi <---------+
                                  |
                    Duyệt, sửa, xóa --> Lưu bộ đề local
```

Luồng OCR hiện không có bước upload ảnh. Bản web dùng đường paste khi OCR native
không khả dụng; không được mô tả web fallback là OCR trên thiết bị. Việc gửi văn
bản cho AI diễn ra khi người dùng yêu cầu generation. Màn generation vẫn khởi
tạo bằng bộ câu hỏi mẫu; cần phân biệt rõ dữ liệu preview với kết quả provider.

Client dùng Supabase publishable key và session của người dùng. Gemini key chỉ
được đọc ở Edge Function qua `Deno.env`; không đưa vào biến `EXPO_PUBLIC_*` hay
repo. Đây là ranh giới thiết kế/code hiện có, không thay thế audit toàn bộ bundle.

### 1.3. Hợp đồng generation và validation

Request gửi tới Edge Function:

```json
{
  "source_text": "Văn bản người học đã kiểm tra",
  "question_count": 10,
  "difficulty": "medium",
  "language": "vi"
}
```

Ví dụ trên mô tả hợp đồng API; UI hiện gửi `languageCode: 'en'`, chưa có bộ chọn
tiếng Việt. Server giới hạn văn bản 1-30.000 ký tự, chuẩn hóa số câu trong khoảng
1-30 và chấp nhận difficulty `easy`, `medium`, `hard`. UI đang cung cấp 5/10/15 câu.

Provider adapter đặt timeout 30 giây, yêu cầu JSON có cấu trúc và nhắc model coi
tài liệu nguồn là dữ liệu, không phải chỉ dẫn. Validator hiện kiểm tra nội dung
không rỗng, bốn lựa chọn khác nhau, khoảng đáp án, giải thích và câu hỏi trùng.
Nếu số câu hợp lệ sau lọc không đúng số yêu cầu, server báo lỗi thay vì lưu một
bộ đề không đầy đủ. Client còn có bước parse/validation riêng trước duyệt/lưu.

Các giới hạn cần xử lý trước khi nghiệm thu AI:

- Endpoint hiện trả một JSON hoàn chỉnh; `StreamingQuestionParser` chưa tạo ra luồng SSE thực tế.
- Timeout provider không đồng nghĩa có nút hủy và propagation cancellation từ UI.
- Chưa có quota/rate limiter, hàng đợi generation offline hoặc retry provider hoàn chỉnh.
- Handler kiểm tra sự tồn tại của Bearer header và dựa vào cấu hình gateway `verify_jwt = true`; chưa có bộ test JWT/token sai hoặc hết hạn cho Edge Function.
- Parse request JSON nằm ngoài khối bắt lỗi provider; malformed body cần được xử lý và kiểm thử riêng.
- Validator server kiểm tra khoảng `correct_index` nhưng chưa kiểm tra số nguyên rõ ràng; cần bổ sung trước khi nhận dữ liệu AI thật. Các test parser client không bao phủ validator Deno này.
- Chưa đo factual accuracy, mức bám nguồn hoặc mức hallucination; prompt không phải bảo đảm về an toàn hay độ đúng của model.

### 1.4. Benchmark: kết quả hiện có và phương pháp đo dự kiến

| Chỉ số theo mẫu | Kết quả tại thời điểm báo cáo | Cách đo để hoàn thành |
| --- | --- | --- |
| OCR inference latency | Chưa đo | Đo từ gọi native recognize đến nhận text; tách cold/warm run, ghi median và p95 |
| OCR accuracy | Chưa đo | Tập ảnh có bản chép tay chuẩn; báo CER/WER cho tiếng Việt và tiếng Anh riêng |
| RAM footprint | Chưa đo | Đo trước/sau/đỉnh trong lượt OCR, so sánh 1/5/10 trang trên cùng thiết bị |
| Generation latency | Chưa đo | Đo thời gian request đến kết quả; chỉ đo time-to-first-question khi đã có streaming |
| JSON acceptance rate | Chưa đo với provider | Số response đạt validator / tổng response; ghi số câu bị loại và lý do |
| Độ đúng/bám nguồn | Chưa đo | Hai thành viên đánh giá độc lập trên đáp án chuẩn; ghi bất đồng và cách xử lý |

Đề xuất bộ dữ liệu benchmark ban đầu: 30 ảnh có quyền sử dụng, chia thành văn bản
in rõ, ảnh chụp nghiêng/thiếu sáng và tài liệu có dấu tiếng Việt/bố cục phức tạp.
Đây là kế hoạch thu thập, chưa phải tập dữ liệu đã chạy. Ghi model máy, OS, build,
độ phân giải ảnh, số lượt lặp, nhiệt độ thiết bị và trạng thái mạng. Không đưa ảnh
tài liệu cá nhân vào repo công khai nếu chưa được phép.

Với OCR, `CER = (substitutions + deletions + insertions) / số ký tự ground truth`.
Ghi rõ quy tắc chuẩn hóa Unicode và khoảng trắng; không loại dấu tiếng Việt để
làm đẹp kết quả. Báo CER/WER riêng thay vì gán một tỷ lệ “accuracy” chưa định nghĩa.

### 1.5. Mã nguồn đối chiếu

- [Camera/gallery adapter](../../src/features/scan-ocr/data/imageSource.ts) và [native OCR](../../src/features/scan-ocr/data/ocr.native.ts).
- [Source review](../../src/app/create/scan.tsx), [question review](../../src/app/create/generate.tsx).
- [Edge Function](../../supabase/functions/generate-questions/index.ts), [Gemini adapter](../../supabase/functions/_shared/gemini.ts), [server validator](../../supabase/functions/_shared/question-schema.ts).
- [Client parser](../../src/features/quiz-generation/domain/parseGeneratedQuestions.ts) và [parser tests](../../src/features/quiz-generation/domain/parseGeneratedQuestions.test.ts).

---

## 2. OFFLINE-FIRST SYNCHRONIZATION ENGINE

- **Local persistence:** Expo SQLite trên native; AsyncStorage cho web preview. Không dùng Isar/WatermelonDB trong triển khai hiện tại.
- **Conflict resolution strategy:** Account sync dùng server revision và lựa chọn giữ bản local/server. Đây là khác biệt so với timestamp Last-Write-Wins trong đặc tả ban đầu; không được đánh dấu LWW đã hoàn thành.

### 2.1. Phạm vi dữ liệu thực sự được đồng bộ

| Dữ liệu | Local | Cloud / sync hiện tại |
| --- | --- | --- |
| Bộ đề/câu hỏi trong thư viện thiết bị | Lưu local qua repository | Người dùng chủ động copy vào tài khoản rồi Sync now |
| Account copies và pending mutations | SQLite `account_sync_state` / AsyncStorage key theo owner | Push/pull qua hai RPC; có revision, retry receipt và tombstone |
| Attempt/answer đã hoàn thành | Đã lưu local; có lookup kết quả gần nhất | Có bảng cloud nhưng chưa nối đồng bộ attempt/history |
| Văn bản OCR/source document | State trong phiên | Chưa persist và sync đầy đủ dù schema cloud đã có bảng |
| Tiến độ attempt / generation job | Chưa có checkpoint/job bền vững | Chưa đồng bộ |

Thư viện dùng chung trên thiết bị và thư viện account hiện tách nhau. Không tự
động upload toàn bộ dữ liệu guest khi đăng nhập. Người dùng chọn copy từng bộ đề
vào tài khoản; IDs cũ dạng `generated-*` được ánh xạ sang UUID ổn định cho account.
Đổi tài khoản không dùng lại outbox của tài khoản trước.

Một giới hạn quan trọng: bộ đề được pull vào account cache chưa được đưa trở lại
thư viện ôn tập local. Vì vậy chưa thể khẳng định flow “tải bộ đề trên máy mới,
ngắt mạng và học ngay” đã hoàn tất.

### 2.2. Ghi local, outbox và tính nguyên tử

`CloudSets` là lớp nghiệp vụ làm việc qua `CloudStore` và `CloudRemote`. Một
envelope gồm `documents`, `pending`, `cursor`, `imports` được lưu cùng nhau cho
từng owner. Native lưu envelope thành một giá trị JSON trong một hàng SQLite;
web lưu bằng một lần `AsyncStorage.setItem`. Các thao tác của instance được xếp
hàng bằng promise để tránh ghi chồng trong cùng runtime.

Mỗi pending mutation gồm UUID của mutation, base revision, document, số lần lỗi,
mốc retry và server copy khi xung đột. Lưu envelope không đồng nghĩa đã kiểm chứng
mọi tình huống process kill hoặc ghi đồng thời nhiều browser tab; các kịch bản
này vẫn cần test nền tảng. Hàng đợi local cũ vẫn tồn tại và chưa hợp nhất toàn bộ
với account sync mới.

### 2.3. Chu trình push/pull

```text
Chọn bộ đề thiết bị --> Copy to this account --> Lưu account copy + pending
                                                       |
                                                   Sync now
                                                       v
           Kiểm tra owner/session --> sync_push_set(mutation, baseRevision, doc)
                                       |                         |
                                   Chấp nhận                  Xung đột
                                       |                         |
                               Lưu bản server          Giữ local + bản server
                               Xóa pending             Chờ người dùng chọn
                                       |
                          sync_pull_sets(after_revision)
                                       |
                    Upsert các bản không có pending local
                          Lưu cursor + account cache
```

RPC push xác thực `auth.uid()`, kiểm tra owner và revision, validate bộ câu hỏi,
lưu cả bộ đề/câu hỏi và receipt trong transaction. Receipt giúp cùng một mutation
được gửi lại không tạo thêm bản ghi; cùng mutation ID nhưng nội dung khác bị từ
chối. Ghi client trực tiếp vào `question_sets`/`questions` đã bị revoke để buộc
luồng này đi qua RPC.

Server dùng sequence revision và khóa theo owner để sắp thứ tự đồng bộ; thêm
khóa theo set ID khi tạo mới. Pull trả tối đa 100 bộ đề mỗi trang, cursor và
`hasMore`. Client không ghi đè document đang có pending mutation; một cursor
không tiến khi `hasMore=true` được coi là lỗi. Cơ chế này không dựa vào đồng hồ
điện thoại để quyết định phiên bản mới hơn.

### 2.4. Xung đột, retry và xóa

Ví dụ hai thiết bị cùng lấy revision 8: A cập nhật thành revision mới; B gửi với
base revision 8 sẽ nhận conflict. UI cung cấp hai lựa chọn:

- **Keep server copy:** bỏ pending local và dùng document server.
- **Keep device copy:** tạo mutation mới dựa trên revision server vừa nhận; lần Sync now tiếp theo thử ghi lại. Nếu server tiếp tục đổi, vẫn có thể phát sinh conflict mới.

Khi request lỗi, pending được giữ lại, tăng `failures` và đặt:

```text
retryAt = now + min(60.000 ms, 1.000 ms × 2^min(failures, 6))
```

Request đầu lỗi chờ ít nhất 2 giây; trần backoff là 60 giây. Hiện chưa có jitter,
phân loại đầy đủ lỗi vĩnh viễn/tạm thời hay scheduler chạy nền. Mốc retry được
kiểm tra khi người dùng gọi sync lại; ứng dụng chưa tự thực hiện lại khi có mạng.
HTTP adapter có timeout 15 giây và gắn session token của đúng owner vào request.

Xóa account copy tạo tombstone và pending mutation; server cấp revision mới cho
thay đổi. Xóa account copy không xóa bộ đề gốc trong thư viện thiết bị. Test local
đã kiểm tra pull tombstone; chưa có UI E2E xóa trên hai điện thoại.

### 2.5. Kiến trúc theo slide Week 09

| Thành phần | Trách nhiệm trong sync | Mã nguồn |
| --- | --- | --- |
| Presentation | Hiển thị account library, pending/error/conflict, nút sync | [sync screen](../../src/app/sync.tsx) |
| Domain | Điều phối import, pending, conflict, push/pull qua ports | [CloudSets và ports](../../src/features/sync/domain/cloudSets.ts) |
| Data | SQLite/AsyncStorage, session và HTTP RPC | [remote adapter](../../src/features/sync/data/cloudSets.ts), [native store](../../src/features/sync/data/cloudStorage.native.ts), [web store](../../src/features/sync/data/cloudStorage.web.ts) |
| Composition | Lắp concrete repositories/adapters cho app | [dependencies](../../src/app/composition/dependencies.ts) |
| Server | Owner checks, transaction, revision và receipt | [sync migration](../../supabase/migrations/20261110185023_question_set_sync.sql) |

Mô hình tuân theo hướng thiết kế `Presentation → Domain ← Data` của slide trang
4. Tuy nhiên toàn dự án chưa đạt ranh giới nghiêm ngặt: màn scan/generation vẫn
import Data adapter trực tiếp; màn battle dùng AsyncStorage; một số logic study
còn ở screen. Script kiến trúc hiện tại không phát hiện hết các trường hợp này.
Legacy helper `src/core/sync/syncEngine.ts` còn đường upsert trực tiếp không còn
phù hợp với grants hiện tại và chưa được sử dụng trong account flow.

### 2.6. Bằng chứng local và cloud

**Local, đã ghi nhận ở đợt triển khai trước:** test sync chạy bằng hai tài khoản
độc lập, xác nhận owner isolation, mutation retry, mutation reuse sai nội dung,
stale/concurrent writes, rollback payload sai và tombstone. Test còn kiểm tra hai
owner không thể chiếm cùng set ID hoặc ghi đè câu hỏi thuộc bộ đề khác.

**Cloud, đã xác minh ngày 11/11/2026:** năm migration đã áp dụng; 11 bảng public
bật RLS; 10 RPC battle/sync không cho anon execute; `rooms` và `room_players` có
trong Realtime publication. SDK probe tới bảng thành công và gọi RPC khi chưa
đăng nhập bị từ chối. Đây là kiểm tra triển khai/quyền, không phải bằng chứng
authenticated sync trên hai thiết bị cloud.

Security Advisor vẫn có WARN cho các authenticated SECURITY DEFINER entry point
và hàm event-trigger `rls_auto_enable` có sẵn trên cloud. Chi tiết nằm trong
[delivery checklist](../integration/DELIVERY-CHECKLIST.md); báo cáo không tuyên bố
“không còn cảnh báo bảo mật”.

### 2.7. Điều kiện chưa đạt của offline-first

- [ ] Tự phát hiện có mạng và thực hiện sync nền/retry, không chỉ Sync now.
- [ ] Đồng bộ source document, attempt và answer; hợp nhất/migrate hàng đợi cũ.
- [ ] Nối account downloads vào thư viện học và kiểm tra account-switch isolation trên UI.
- [ ] Kiểm chứng native restart/process kill giữa local write, push acknowledgement và pull cursor.
- [ ] Thống nhất deviation revision/manual conflict với yêu cầu timestamp LWW trong báo cáo kiến trúc.
- [ ] Hoàn thiện các trạng thái lỗi và test nhiều runtime/tab nếu bản web cần hỗ trợ.

---

## 3. AUTOMATED TEST SUITE & PERFORMANCE PROFILING

- **Unit Test Coverage:** line coverage **23,56%** trên phạm vi collection hiện tại; Domain-only **69,92%**. Chưa đạt mốc tham chiếu ≥80% của template.
- **Frame Rate:** **chưa đo**; 58-60 FPS là mục tiêu profiling, không phải kết quả.
- **🔗 Internal Testing APK Link:** **Chưa có bản APK được build, cài và xác minh. Nhóm bổ sung URL artifact thực tế trước khi nộp chính thức.** Không dùng link release mẫu.

### 3.1. Môi trường và khả năng tái lập

| Hạng mục | Giá trị |
| --- | --- |
| Ngày đo | 11/11/2026, múi giờ Việt Nam |
| Baseline code | `bed201a6341352afe6a1258ffc00f345d951f383` |
| Runner | Local macOS; Node `v22.20.0`, npm `10.9.3` |
| Framework test | Jest `30.5.2`, preset `jest-expo` `58.0.12` theo package manifest |
| Cấu hình coverage | `src/**/*.{ts,tsx}`, loại `src/app/**`; không bao phủ SQL hoặc `supabase/functions` |
| Kết quả lần chạy | 8/8 suite pass, 16/16 test pass, không có snapshot test |
| Các kiểm tra khác | TypeScript pass; script import-boundary hiện tại pass với giới hạn nêu ở mục 2.5 |

Lệnh tái lập trên checkout của baseline, sau `npm ci`:

```bash
npm run typecheck
bash scripts/check_architecture.sh
npm test -- --watch=false --coverage \
  --coverageDirectory=coverage/report-3 \
  --coverageReporters=text --coverageReporters=json-summary
```

Lần đo của báo cáo ghi output vào thư mục tạm để không commit generated coverage.
[Evidence JSON](evidence/report-3-checks.json) lưu command thực tế, môi trường,
kết quả từng test và counters coverage; đường dẫn máy cá nhân đã được loại khỏi
danh sách source. Không thay đổi code hoặc thêm test chỉ để tăng con số báo cáo.

### 3.2. Tháp kiểm thử và phạm vi đã đạt

Slide Week 09 trang 6 đề xuất khoảng 70% Unit, 20% Component và 10% Integration/E2E.
Đây là hướng phân bố công sức/bộ test, không phải phần trăm code coverage và không
được suy ra từ việc tất cả unit test đang pass.

| Lớp kiểm thử | Hiện có | Đánh giá |
| --- | --- | --- |
| Unit/domain | 14 test trong 7 suite | Có baseline; còn thiếu nhánh và nhiều use case |
| Adapter unit với mock | 2 test camera permission/cancel | Không thay cho camera thật hoặc test component |
| Component | Chưa có suite render/tương tác màn hình | Chưa đạt phần 20% theo định hướng |
| SQL/API integration local | Hai SQL script battle và hai Node smoke script battle/sync đã pass ở đợt trước | Không nằm trong 16 Jest tests, chưa phải UI E2E |
| Emulator/device E2E | Chưa có suite được chạy/ghi nhận | Chưa đạt phần 10% theo định hướng |

### 3.3. Danh mục 16 test và kết quả

| Suite | Số test | Nghiệp vụ được kiểm tra | Kết quả |
| --- | ---: | --- | --- |
| `core/domain/models.test.ts` | 2 | Bốn lựa chọn khác nhau; helper điểm tốc độ | Pass |
| `question-sets/domain/saveQuestionSet.test.ts` | 2 | Gọi repository khi hợp lệ; từ chối bộ đề lỗi trước lưu | Pass |
| `quiz-generation/domain/parseGeneratedQuestions.test.ts` | 2 | Parse JSON/code fence, lọc trùng và câu sai cấu trúc | Pass |
| `room-battle/domain/roomState.test.ts` | 2 | Chuyển trạng thái theo event; membership idempotent | Pass |
| `scan-ocr/data/imageSource.test.ts` | 2 | Không mở camera khi từ chối quyền; hủy không trả trang | Pass |
| `study/domain/completeAttempt.test.ts` | 1 | Tổng hợp kết quả từ answer records | Pass |
| `sync/domain/drainOutbox.test.ts` | 2 | Thứ tự push/ack; đánh dấu retry khi lỗi | Pass |
| `sync/domain/cloudSets.test.ts` | 3 | UUID/account isolation; retry qua service restart; bảo toàn conflict và rebase | Pass |
| **Tổng** | **16** | **8 suite** | **16 pass** |

Test service restart dùng fake store giữ dữ liệu và tạo lại service instance.
Nó không mô phỏng crash hệ điều hành hoặc chứng minh transaction SQLite native.
`drainOutbox` cũ có hành vi tiếp tục sau một item lỗi; account sync mới dừng lượt
push khi lỗi request. Không xem hai cơ chế này là đã hợp nhất.

### 3.4. Coverage đo được

| Metric | Toàn phạm vi collection: covered/total | Tỷ lệ | Domain-only: covered/total | Tỷ lệ |
| --- | ---: | ---: | ---: | ---: |
| Statements | 121/498 | 24,29% | 116/175 | 66,29% |
| Branches | 72/302 | 23,84% | 69/128 | 53,91% |
| Functions | 35/184 | 19,02% | 34/49 | 69,39% |
| Lines | 90/382 | 23,56% | 86/123 | 69,92% |

Domain-only được tính bằng tổng counters của các file có `/domain/`, không lấy
trung bình các phần trăm từng file. Phạm vi toàn collection vẫn chứa adapters,
state và shared UI; route trong `src/app` bị loại. Không gọi đây là coverage toàn
ứng dụng hay chỉ chọn file có coverage cao để tuyên bố đạt 80%.

Các khoảng trống đáng chú ý: parser streaming chưa có coverage; auth/network và
phần lớn persistence adapters chưa được test bằng bộ Jest hiện tại; Edge Function
validator chưa nằm trong collection. Branch coverage Domain 53,91% cho thấy cần
ưu tiên failure paths, deletion/conflict choices và recovery thay vì chỉ thêm
happy-path tests.

### 3.5. Integration và security: tách nguồn bằng chứng

| Kiểm tra | Kết quả ghi nhận trước báo cáo | Giới hạn |
| --- | --- | --- |
| `supabase/tests/battle_security.sql` | Pass local: RLS, ẩn đáp án/giải thích, retry, từ chối outsider/anon | Fixture rollback; không chứng minh mọi policy của app đã được test |
| `supabase/tests/battle_lifecycle.sql` | Pass local: create/join/ready/start, server phase, chuyển host | Dùng SQL identity; không thay thế UI hay mobile network tests |
| `scripts/test-battle-local.mjs` | Pass: 4 client đăng nhập độc lập, Realtime, chặn client thứ 5, concurrent retry, ranking | Local API smoke; chưa phải bốn thiết bị thật |
| `scripts/test-sync-local.mjs` | Pass: owner isolation, receipt, conflict, rollback, cursor, tombstone | Local API smoke; chưa kiểm chứng automatic/native sync |
| Cloud deployment probes | Migration/grants/RLS/publication và anon denial đã xác minh | Chưa chạy authenticated app flow trên hai thiết bị cloud |

Hai script Node chủ động giới hạn endpoint local. Không thay URL/key cloud để
chạy lại test fixture. Kết quả lịch sử dẫn từ [delivery checklist](../integration/DELIVERY-CHECKLIST.md);
đợt biên soạn này chạy lại Jest/coverage, typecheck và architecture script, không
chạy lại SQL/API smoke hoặc tạo tài khoản cloud mới.

### 3.6. Performance profiling và native acceptance

| Kịch bản dự kiến | Chỉ số cần ghi | Bằng chứng phải nộp | Trạng thái |
| --- | --- | --- | --- |
| OCR 1/5/10 trang | Latency median/p95, peak RAM, thất bại | Device/build metadata, raw measurements | Chưa đo |
| Cuộn library và review | FPS/frame time, dropped frames | Trace từ build profiling phù hợp | Chưa đo |
| Battle cập nhật score | Frame time, sai lệch hiển thị timer | Hai máy, network profile, video đồng thời | Chưa đo; UI timer còn thiếu |
| Sync khi mất mạng | Số pending, retry, số bản ghi cuối | Log đã ẩn dữ liệu cá nhân + kịch bản tái lập | Mới có unit/API evidence |
| Restart giữa bài học | Checkpoint và kết quả khôi phục | Video emulator/native và assertion | Chưa có resume checkpoint |
| Màn hình gập / đổi kích thước | Clipping, keyboard, safe area, giữ state | Thiết bị/kích thước và ảnh trước/sau resize | Chưa xác minh |

Thiết bị đề xuất: một Android phổ thông, một Android có cấu hình cao hơn và một
emulator có thể đổi kích thước; bổ sung iOS nếu nhóm có điều kiện. Đây là danh
sách dự kiến, không phải các máy đã test. Không dùng thời gian chạy Jest hoặc
Expo web export để suy ra OCR latency, FPS hay RAM.

### 3.7. Lỗi/gap còn mở và thứ tự xử lý

| ID | Vấn đề | Hành động trước nghiệm thu | Ưu tiên |
| --- | --- | --- | --- |
| M3-01 | AI chưa có provider-backed evidence; chưa streaming/cancel/quota | Hoàn thiện endpoint, validation lỗi và test với model cụ thể | P0 |
| M3-02 | OCR/native SQLite chưa có device evidence | Development build có native modules; đo OCR và restart/crash cases | P0 |
| M3-03 | Account sync thủ công, chưa đủ entities | Hoàn thiện bridge sang study, automatic sync, attempts/source; account-isolation E2E | P0 |
| M3-04 | Kiến trúc còn direct Data imports; checker chưa đủ | Chuyển qua ports/composition; mở rộng import-rule checks | P0 |
| M3-05 | Coverage dưới mục tiêu; thiếu component/E2E | Ưu tiên lỗi auth/sync/OCR, component flows và một E2E xuyên suốt | P0 |
| M3-06 | Auth form rỗng điều hướng home; thiếu registration/OAuth completion | Hoàn thiện auth và kiểm thử tài khoản app, tách guest rõ ràng | P0 |
| M3-07 | Chưa có signed/internal APK, benchmark và video | Build, cài trên thiết bị, lưu metadata/hash và link được cấp quyền xem | P0 |
| M3-08 | Survival/QR/global leaderboard/history chưa đầy đủ | Theo backlog, không đưa vào danh sách đã hoàn thành | P1/P2 theo plan |

### 3.8. Deliverables và checklist trước khi nộp

| Sản phẩm | Link / vị trí | Trạng thái |
| --- | --- | --- |
| GitHub source | [Quiz-Game-MultyPlatform](https://github.com/Minhwritecode/Quiz-Game-MultyPlatform) | Có repo; kiểm tra quyền giảng viên trước nộp |
| Report 3 Markdown | File hiện tại trong `docs/reports/` | Đã biên soạn theo template |
| Báo cáo PDF công khai | Nhóm bổ sung link Drive sau xuất/kiểm tra PDF | Chưa có artifact/link xác minh |
| Evidence kiểm thử | [report-3-checks.json](evidence/report-3-checks.json) | Có counters và danh sách test của lần đo |
| Figma | [Papyrus UI UX Prototype](https://www.figma.com/design/qdGvcsHXoTJcuq2NqsK9XS/Papyrus-UI-UX-Prototype) | Có đường dẫn; chưa kiểm tra lại quyền/interactive flows trong đợt này |
| Video demo M3, 2-5 phút | Nhóm bổ sung link video đúng bản build | Chưa có link xác minh |
| Internal Testing APK | Nhóm bổ sung release/Drive URL của APK đã cài thử | Chưa có build được xác minh |

- [ ] Xác nhận MSSV, tỷ lệ đóng góp, phạm vi và sự đồng thuận của tất cả thành viên.
- [ ] Bổ sung native AI benchmark và nguồn dữ liệu đo; không dùng số minh họa trong template.
- [ ] Hoàn thành các acceptance gate M3 còn mở hoặc trình bày rõ phần chưa đạt.
- [ ] Xuất PDF, kiểm tra bảng/font/link, cấp quyền xem và thử bằng cửa sổ chưa đăng nhập.
- [ ] Gắn video/APK thực tế với commit/tag và model thiết bị.
- [ ] Khai báo việc sử dụng AI hỗ trợ và nguồn tham khảo theo quy định học phần; nhóm chịu trách nhiệm giải thích và kiểm chứng nội dung.

### 3.9. Kết luận milestone và tài liệu đối chiếu

Papyrus đã có nền tảng OCR/generation, sync theo tài khoản và kiểm thử nghiệp vụ
với 16 test pass; backend battle/sync có bằng chứng local và cloud schema đã được
triển khai. M3 chưa hoàn tất vì còn thiếu provider/native benchmark, tự đồng bộ
đầy đủ, coverage mục tiêu, component/E2E và bản cài đặt kiểm chứng. Kết quả này là
cơ sở lập công việc tiếp theo, không phải chứng nhận production-ready.

Tài liệu đối chiếu:

1. `Capstone-Report-3-AI-Testing.md` do học phần cung cấp: cấu trúc ba mục và các trường benchmark/coverage/APK.
2. `Week-09-Architecture.pdf`, TS. Nguyễn Thanh Tuấn: trang 4 về ba lớp và trang 6 về tháp kiểm thử 70/20/10.
3. [Project plan](../PROJECT-PLAN.md): các phase 5-6, 9, 11 và acceptance gates.
4. [Audit FR-01–FR-17 và bốn repo](../integration/STATUS-AUDIT-2026-11-11.md): tình trạng implementation và khác biệt so với đặc tả.
5. [Delivery checklist](../integration/DELIVERY-CHECKLIST.md): bằng chứng local/cloud và giới hạn kiểm thử.
6. [Jest configuration](../../jest.config.js), [package manifest](../../package.json), [CI workflow](../../.github/workflows/ci.yml) và [evidence lần chạy](evidence/report-3-checks.json).
