# Store submission preparation

Draft only. Do not submit while the Week 12 checklist still has release blockers.
Current code remains a development candidate with sample metrics/game data.

## Listing copy (review against the shipped binary)

- App title: **Papyrus**.
- Brand slogan: **From Ancient Scroll to AI Power.**
- Play short description: **Biến ghi chú thành bộ câu hỏi và ôn tập theo cách của bạn.**
- iOS subtitle draft: **Ghi chú thành câu hỏi ôn tập**.
- Keyword draft: `quiz,study,notes,ocr,learning,revision,flashcards`.

Description draft:

> Papyrus giúp bạn tổ chức nội dung học thành bộ câu hỏi để luyện tập. Bạn có thể
> tự viết câu hỏi, sửa lựa chọn và đáp án, lưu bộ câu hỏi trên thiết bị và xem kết
> quả sau mỗi lượt học. Khi có kết nối và tài khoản, bạn có thể đồng bộ bộ câu hỏi.
>
> Tính năng quét tài liệu nhận dạng chữ trên thiết bị. Khi bạn chọn tạo câu hỏi AI,
> chỉ văn bản đã duyệt được gửi tới dịch vụ tạo câu hỏi. Hãy kiểm tra nội dung và
> đáp án trước khi lưu: câu trả lời AI có thể sai và không thay thế tài liệu môn học.

Keep the OCR/AI paragraph only when native/provider acceptance is complete. Do not
claim automatic background sync, full PDF ingestion, global realtime leaderboard,
all game scores saved to cloud or feature parity with four reference products.

## Privacy policy draft to publish after review

Required publisher fields: responsible group/entity, contact/support address, effective
date, retention periods and deletion support route. These have not been supplied; do
not publish an apparently final policy with placeholders or invented retention promises.

| Data | Current handling | Publication checklist |
| --- | --- | --- |
| Email, account ID, auth tokens | Supabase Auth; persisted session on device | Describe provider, account purpose and security; token storage audit remains |
| Selected/captured study images | Local ImagePicker/ML Kit; not intentionally uploaded by OCR adapter | Audit temporary image lifetime and backups on actual devices |
| Reviewed source text | Sent to Gemini through Edge Function only on generation action | Explain third-party processing, provider settings and retention accurately |
| Question sets | Local SQLite/AsyncStorage; imported sets manually synchronized to Supabase | Distinguish device vs account library |
| Study answers/results | Local attempt persistence; full attempt cloud sync not implemented | Do not promise cross-device history |
| Battle membership/answers/scores | Supabase room tables and Realtime | State that deleting owner data can end related rooms |
| Diagnostics | Optional configured Sentry in non-debug builds; filtered JS errors/spans | Inspect native collection, update Data Safety/App Privacy declarations |
| Feedback | Opens configured support web page | Disclose that service's handling; no silent upload of app data |

Policy content should explain access, purpose, recipients, retention, deletion, account
rights, contact and changes. No advertising/payment SDK was added in this task.
This draft is an implementation inventory, not a legal certification.

Deletion instructions: Settings → Quyền riêng tư & dữ liệu → type DELETE → confirm.
The operation deletes the authenticated cloud account/associated records, then clears
local study data on this device. Data cached on other devices, server operational logs,
provider logs/backups may require separate handling under the published retention
policy; do not promise instant physical erasure everywhere. Publish a web deletion
resource for users who no longer have the app, with a verified support/request process.

## Reviewer access

- Create a dedicated review account, never a teammate's personal login.
- Store review credentials in the private App Review / App Access form, not this repo.
- Verify email confirmation/recovery before review; don't disable verification to
  work around SMTP rate limits.
- Populate realistic Vietnamese study material owned/licensed by the group, at least
  two small sets with explanations; no real personal lecture/photo data.
- Explain guest offline/manual study and which actions require connectivity.
- Document steps to reach camera, AI review, result and account deletion.
- Test reviewer login from a clean install and a network outside the university.

## Screenshot / device capture plan

Capture from the actual candidate binary after replacing sample metrics with truthful
labels. Do not fabricate store screenshots from a design mockup.

| Filename | Screen | Message |
| --- | --- | --- |
| 01-library | Personal sets | Organize study material |
| 02-source | Camera + reviewed OCR | Keep control of source text |
| 03-review | Editable question/options | Review before saving |
| 04-study | Offline question interaction | Practice without connection |
| 05-result | Persisted result | Understand each attempt |
| 06-games | Existing game chosen by its owner | Optional play, without fake global rankings |

Capture phone portrait plus tablet/foldable expanded state, light/dark and VI/EN as
supported by the actual screen. Several core creation/privacy strings are not yet
fully localized; finish localization before advertising complete bilingual support.
Use current store screenshot dimensions, not old slide dimensions. No screenshot
assets were generated in this task because visual browser/device access was unavailable.

Before submission verify public policy/support/deletion links return HTTP 200 without
login; permissions have clear purpose strings; native merged manifests don't request
unnecessary broad media/microphone access; privacy manifests match SDK behavior;
account deletion works on a disposable cloud account; all reviewer steps are reproducible.
