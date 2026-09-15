# Original User Request

## 2026-09-14T23:47:38Z

Xây dựng và thực thi hệ thống kiểm thử thực tế đa Agent cho nền tảng KÝ SỐ EduSign VGCA: các Agent độc lập giám sát chéo giao diện người dùng (hộp thoại modal, toast, form ký), kiểm chứng thực nghiệm cơ chế lưu trữ dữ liệu trên máy chủ Render đám mây, và thực hiện bài đo tải đồng thời 50 giáo viên cùng ký số trong thời gian thực.

Working directory: c:\Users\HPZBook\Desktop\KÝ SỐ
Integrity mode: development

## Requirements

### R1. Giám sát & Kiểm thử Giao diện Thực tế Đa Trình duyệt (Multi-Agent UI & Dialog Supervision)
- Sử dụng trình duyệt tự động (Playwright/Puppeteer) khởi chạy ứng dụng thật trên các độ phân giải trường học (Desktop 1920x1080 và Laptop 1366x768).
- Kiểm tra toàn bộ các hộp thoại tương tác:
  - Hộp thoại đăng nhập & thông báo lỗi xác thực.
  - Hộp thoại nộp giáo án, kéo thả vị trí chữ ký số trên PDF Viewer.
  - Hộp thoại cảnh báo cắm sai USB Token hoặc tài khoản bị khóa.
  - Hộp thoại xác nhận đóng dấu mộc đỏ trường học của Ban Giám hiệu.
  - Hộp thoại từ chối / trả về hồ sơ kèm lý do.
- Giám sát F12 Console: Bắt buộc sạch 100% (0 runtime error, 0 unhandled promise rejection).
- Kiểm tra layout: Bắt buộc 0 bẫy tràn ngang (scrollWidth === clientWidth).

### R2. Kiểm chứng Cơ chế Lưu trữ Dữ liệu trên Cloud Render
- Thực hiện thẩm định thực tế trên máy chủ Render (https://edusign-vgca.onrender.com hoặc mô phỏng vòng đời container Render):
  - Kiểm tra xem file tải lên (uploads/documents/), ảnh chữ ký, và file JSON (dataStore) được lưu trên đĩa tạm thời (ephemeral disk) hay dịch vụ lưu trữ bền vững.
  - Đo đạc hiện tượng: Khi container Render bị khởi động lại (restart/re-deploy) hoặc chuyển sang trạng thái ngủ (sleep/idle), các file PDF và hồ sơ giáo án có bị mất không.
  - Kiểm chứng cơ chế cứu cánh / đồng bộ dữ liệu: Đánh giá vai trò của Google Drive Kho trường, Microsoft OneDrive cá nhân, và Firebase Realtime Database trong việc bảo toàn dữ liệu khi Render bị reset đĩa.

### R3. Kiểm thử Tải Thời Gian Thực: 50 Giáo viên Cùng Ký Số Đồng Thời (50 Concurrent Teachers Stress Test)
- Xây dựng kịch bản kiểm thử tải thực tế: Kích hoạt đồng thời 50 luồng (50 concurrent teacher sessions) đại diện cho 50 giáo viên trong trường nộp kế hoạch bài dạy và thực hiện ký số điện tử trong cùng một khoảng thời gian ngắn (5-10 giây).
- Đo đạc các chỉ số mạng và hiệu năng:
  - Tỷ lệ thành công (Success Rate): Phải đạt >= 98%.
  - Thời gian phản hồi trung bình (Average Latency) và P95 Latency.
  - Hiện tượng tắc nghẽn (Event Loop lag / Blocking).
- Kiểm tra tính toàn vẹn dữ liệu (Data Integrity): Sau khi 50 giáo viên hoàn tất ký, đối soát lại trong cơ sở dữ liệu (documents.json và bộ nhớ cache) xem có đủ 50 bản ghi không, có bản ghi nào bị ghi đè mất mát do Race Condition không.

## Acceptance Criteria

### Giao diện & Hộp thoại UI
- [ ] Mọi hộp thoại tương tác (Modal ký số, Đóng dấu mộc, Cảnh báo Token, Thông báo hoàn thành) mở đúng thời gian < 300ms và hiển thị đầy đủ không bị che khuất.
- [ ] Console F12 ghi nhận 0 lỗi JavaScript runtime trong suốt quá trình người dùng thao tác.
- [ ] Giao diện responsive chuẩn trên cả màn hình Desktop và Laptop, không có thanh cuộn ngang ngoài ý muốn.

### Thẩm định Lưu trữ Render
- [ ] Có bảng báo cáo phân tích thực nghiệm rõ ràng về cơ chế lưu trữ trên Render: Xác định rõ rủi ro đĩa tạm (Ephemeral Filesystem) của Render Free/Starter plan.
- [ ] Xác nhận tình trạng đồng bộ hóa hồ sơ sang Google Drive / Firebase: Chỉ ra chính xác các tệp tin nào đã an toàn trên Cloud, tệp nào có nguy cơ mất khi Render restart.

### Kiểm thử Tải Đồng thời 50 Giáo viên
- [ ] Thực hiện thành công bài đo tải với 50 phiên giáo viên độc lập cùng ký số.
- [ ] 100% hồ sơ giáo án tạo bởi 50 giáo viên được lưu trữ đầy đủ trong hệ thống (0 bản ghi bị thất lạc, 0 lỗi Lost Update).
- [ ] Báo cáo kết quả đo đạc gồm: Con số đo đạc cụ thể (Độ trễ mili-giây, số request thành công/thất bại, tải CPU/RAM của server).

## 2026-09-15T00:16:04Z

Thành lập các Agent độc lập tiến hành rà soát, kiểm tra thực nghiệm toàn diện giao diện người dùng (UI/UX) trên đa thiết bị (Desktop 1920x1080, Laptop 1366x768, Mobile/Tablet), đồng thời thẩm định chuyên sâu logic và tính năng Zalo Chat (gồm cả thông báo tự động 1 chiều qua Zalo Notify/GAS Webhook và Chatbot tra cứu tương tác 2 chiều). Các Agent viết kịch bản test kiểm chứng độc lập, phát hiện sai sót logic, đề xuất các điểm điều chỉnh bổ sung kèm code mẫu cụ thể; cuối cùng Agent tổng hợp lập Báo cáo Đối soát Toàn diện trình người dùng phê duyệt trước khi áp dụng vào mã nguồn.

Working directory: c:\Users\HPZBook\Desktop\KÝ SỐ
Integrity mode: development

## Requirements

### R1. Thẩm định Giao diện Người dùng Đa Nền tảng (Cross-Device UI/UX & Design Standards)
- Khảo sát và đánh giá tính chuẩn mực, thẩm mỹ và tính công thái học (Ergonomics) trong môi trường giáo dục đối với toàn bộ các giao diện:
  * Trang Đăng nhập & Điều hướng vai trò (`#viewLogin`, `#modalVgcaLogin`, `#modalAdminAuth`).
  * Bàn làm việc Giáo viên (Nộp kế hoạch bài dạy, danh sách giáo án, tải file PDF đã ký).
  * Bàn duyệt Tổ trưởng & Ban Giám hiệu (Ký nháy chuyên môn, ký số VGCA kèm đóng dấu mộc đỏ trường học).
  * Trình xem & Kéo thả con dấu trên PDF Viewer (`#modalDocViewer`, `#draggableSignatureStamp`).
  * Cổng báo cáo tra cứu công khai `portal-baocao.html`.
- Kiểm thử responsive thực tế trên 3 dải độ phân giải:
  * Desktop trường học chuẩn: 1920x1080.
  * Laptop giáo viên phổ thông: 1366x768.
  * Thiết bị di động / máy tính bảng: Mobile 390x844 (iPhone) và Tablet 768x1024 (iPad).
- Kiểm tra bẫy tràn ngang (`scrollWidth === clientWidth`), kích thước vùng chạm (>= 44px), tỷ lệ tương phản chữ WCAG AA/AAA (>= 4.5:1 cho body text, >= 7:1 cho display text), và phát hiện mọi lỗi JavaScript F12 Console.

### R2. Rà soát Chuyên sâu Logic & Tính năng Zalo Chat (`zaloNotifyService.js`, `test_zalo_unified_bot.js`, `server.js`)
- Rà soát cơ chế **Thông báo tự động 1 chiều (Zalo Notify / Webhook)**:
  * Sự kiện kích hoạt: Giáo viên nộp bài -> Báo Tổ trưởng; Tổ trưởng duyệt -> Báo Ban Giám hiệu; BGH ký duyệt -> Báo hoàn tất kèm link tải; BGH từ chối -> Báo kèm lý do.
  * Phân tích hàm `sendZaloNotificationViaGAS`, cấu trúc JSON payload gửi sang Google Apps Script, xử lý timeout và retry.
  * Rà soát tính năng gửi tin qua Zalo Official Account (Zalo OA API v3), cơ chế làm mới Access Token từ Refresh Token.
- Rà soát cơ chế **Chatbot tương tác 2 chiều (Zalo Interactive Bot)**:
  * Xử lý webhook tiếp nhận tin nhắn từ người dùng (`/api/zalo/webhook` hoặc kịch bản tương tác).
  * Logic nhận diện câu lệnh tra cứu: Tra cứu theo mã hồ sơ (ví dụ: `KHBD-...`), tra cứu theo số điện thoại giáo viên, tra cứu danh sách chờ duyệt.
  * Cơ chế phân quyền trong tin nhắn Zalo: Ngăn chặn người ngoài tra cứu hồ sơ nội bộ hoặc xem trộm tài liệu giáo án của giáo viên khác.
- Rà soát các điểm sai logic kỹ thuật & an toàn dữ liệu:
  * Nguy cơ lộ lọt số điện thoại, CCCD, thông tin bảo mật của giáo viên trong tin nhắn Zalo.
  * Nguy cơ URL xem file PDF bị public không qua xác thực token.
  * Xử lý ngoại lệ khi số điện thoại chưa kích hoạt Zalo hoặc người dùng chặn tin nhắn từ trường.

### R3. Xây dựng Kịch bản Test Kiểm chứng & Đề xuất Code Mẫu Cải tiến
- Viết các file kịch bản kiểm thử độc lập (ví dụ trong thư mục `tests/`) để chứng minh các phát hiện:
  * Test tự động quét lỗi UI/UX, responsive và console error.
  * Test giả lập các ca gửi nhận tin nhắn Zalo, test lỗi logic timeout/token expired/phân quyền tra cứu.
- Đề xuất các giải pháp kỹ thuật và code mẫu khắc phục chi tiết (chuẩn bị sẵn phương án vá để trình duyệt).
- TUYỆT ĐỐI KHÔNG TỰ Ý CHỈNH SỬA các file mã nguồn chính (`server.js`, `dataStore.js`, `zaloNotifyService.js`, `index.html`) khi chưa có sự phê duyệt trực tiếp của người dùng.

### R4. Agent Tổng hợp & Báo cáo Đối soát Độc lập (Synthesis & Actionable Roadmap)
- Tổng hợp toàn bộ phát hiện của Agent 1 (UI/UX) và Agent 2 (Zalo Logic).
- Lập bảng Ma trận Khuyến nghị:
  * Phân cấp mức độ (Nghiêm trọng - Cần điều chỉnh logic - Cải tiến nâng cao trải nghiệm).
  * Tọa độ file và dòng code cần sửa.
  * Tác động vận hành thực tế tại trường THCS Chu Văn An.
  * Đoạn code đề xuất sửa đổi cụ thể để Ban Quản trị nhà trường nghiệm thu.

## Acceptance Criteria

### Giao diện & Hiển thị UI/UX
- [ ] Báo cáo kiểm định chi tiết đầy đủ 100% các màn hình chính và các modal tương tác.
- [ ] Bảng kiểm tra responsive trên cả 3 môi trường: Desktop 1920x1080, Laptop 1366x768, và Mobile/Tablet với 0 bẫy tràn ngang.
- [ ] Danh sách các điểm chưa hợp lý trong trải nghiệm người dùng (visual hierarchy, contrast, touch targets) kèm đề xuất căn chỉnh cụ thể.

### Tính năng Zalo Chat & Notify
- [ ] Báo cáo phân tích chuyên sâu chỉ rõ toàn bộ các luồng logic của Zalo Notify 1 chiều và Zalo Chatbot 2 chiều.
- [ ] Chỉ ra chính xác các điểm sai logic (sai thứ tự gửi, sót trường dữ liệu, lỗi refresh token, hổng phân quyền tra cứu) nếu có.
- [ ] Có kịch bản kiểm thử thực nghiệm (test file) minh chứng các điểm lỗi hoặc hạn chế của Zalo.
- [ ] Đề xuất mẫu tin nhắn Zalo chuẩn hóa (UI Card, nút bấm xem giáo án nhanh, tra cứu bảo mật qua mã OTP/mật khẩu).

### Kế hoạch Điều chỉnh & Quy chế Code
- [ ] Toàn bộ mã nguồn sản phẩm chính giữ nguyên vẹn 100%, không bị sửa đổi trái phép.
- [ ] Có tài liệu đề xuất giải pháp vá lỗi và code mẫu hoàn chỉnh để người dùng xem xét, phê duyệt trước khi áp dụng.

## 2026-09-15T01:51:33Z

Triển khai áp dụng toàn bộ 23 bản vá chuẩn hóa từ PROPOSED_PATCHES.md vào mã nguồn hệ thống KÝ SỐ EduSign VGCA, thiết lập cơ chế giám sát logic độc lập nghiêm ngặt chống phá vỡ (Zero-Side-Effect) các tính năng cốt lõi, đồng thời thẩm định/bổ sung hoàn thiện tính năng Zalo nhắc Thời khóa biểu (TKB) 6h00 sáng và xuất bản tài liệu hướng dẫn cập nhật Code.gs chi tiết trên Google Apps Script.

Working directory: c:\Users\HPZBook\Desktop\KÝ SỐ
Integrity mode: development

## Requirements

### R1. Triển khai Cập nhật Mã nguồn Phương án 2 (23 Bản vá từ PROPOSED_PATCHES.md)
- **11 Bản vá UI/UX & Công thái học (index.html, js/app.js)**:
  * Vá bẫy tràn ngang Mobile 20px (index.html:305-316) bằng flex flex-col sm:flex-row w-full.
  * Tối ưu thanh công cụ PDF Viewer trên Mobile/Tablet (#modalDocViewer), chống bóp nghẹt khung nhìn PDF.
  * Phóng to các nút vi sai con dấu ◀, ▲, ▼, ▶ (index.html:1315-1335) từ 24px lên >= 44px đạt chuẩn WCAG AAA.
  * Bổ sung sự kiện pointercancel trong js/app.js:2875 chống kẹt chuột/đơ cảm ứng khi kéo thả con dấu.
  * Chuẩn hóa bảng phân tầng Z-Index Token Design (Base z-30, Sticky z-40, Modal z-[100], Confirm/Alert z-[120], Toast z-[150]).
  * Phóng to nút thao tác bảng biểu (min-w-[36px] min-h-[36px]), nâng cấp tương phản màu chữ text-slate-400 lên text-slate-600 (7.0:1 AAA), hỗ trợ phím bấm Dropzone.
- **12 Bản vá Logic & Bảo mật Zalo (server.js, zaloNotifyService.js, google-apps-script-zalo-edusign.js)**:
  * Xử lý sự kiện FORWARDED trong GAS Webhook gửi tin Zalo thông báo tức thời cho Ban Giám hiệu.
  * Tích hợp hook gọi zaloNotifyService.sendZaloNotificationViaGAS khi Tổ trưởng duyệt (approve-leader) và BGH ký số đóng dấu (approve-principal).
  * Nộp giáo án cá nhân (PERSONAL): Tự động tìm SĐT Tổ trưởng bộ môn để gửi tin thông báo.
  * Vá lỗ hổng chiếm đoạt tài khoản Zalo Bot qua số điện thoại: Bổ sung cơ chế xác thực OTP 6 số hoặc mã PIN EduSign trước khi liên kết Zalo_Chat_ID.
  * Đóng bảo vệ thư mục tĩnh /uploads sau middleware requireAuth, hợp nhất tuyến /reject bị trùng lặp, xóa bỏ webhook phát tán từ client.
  * Bổ sung bộ Regex bóc tách mã hồ sơ (KHBD-..., BC-...) và lệnh choduyet cho BGH trên Zalo Bot.

### R2. Cơ chế Giám sát Chặt chẽ Chống Phá vỡ Logic Cốt lõi (Regression Testing & Guardrails)
- Thiết lập hàng rào kiểm thử hồi quy độc lập (Auditor giám sát):
  * CẤM LÀM ẢNH HƯỞNG ĐẾN CÁC TÍNH NĂNG KHÔNG LIÊN QUAN: Quy trình nộp giáo án, ký nháy chuyên môn, ký số VGCA USB Token, đóng dấu mộc đỏ trường học, sao lưu Google Drive Kho trường, và Firebase Realtime Database phải giữ vững 100% độ ổn định.
  * Chạy lại toàn bộ test suite Playwright sẵn có (tests/01_auth_roles.spec.mjs, tests/02_teacher_features.spec.mjs, tests/05_multi_signing_and_session.spec.mjs, tests/07_bgh_cccd_token_flow.spec.mjs, tests/test_cross_device_ui_ux_audit.spec.mjs) xác nhận 100% PASS.
  * Chạy lại tests/test_zalo_security_and_logic_audit.js xác nhận các lỗ hổng cũ đã được vá triệt để và hoạt động an toàn.

### R3. Kiểm định & Hoàn thiện Tính năng Zalo Nhắc Thời Khóa Biểu (TKB 6h00 Sáng)
- Rà soát toàn diện logic nhắc TKB trong google-apps-script-zalo-edusign.js:
  * Bổ sung hàm setupDailyMorningTrigger còn thiếu: Tạo Trigger thời gian tự động chạy hàm sendDailyMorningPersonalSchedule vào khung giờ 06:00 - 07:00 sáng hàng ngày (trừ Chủ Nhật).
  * Bổ sung hàm setupMorningBriefGroupTrigger: Kích hoạt gửi bản tin TKB tổng hợp vào nhóm Zalo trường lúc 06:30 sáng (nếu có cấu hình MORNING_BRIEF_CHAT_ID).
  * Kiểm tra độ chính xác dữ liệu: Khung giờ ra vào lớp sáng/chiều, liên kết với Firebase TKB (tkb-fet-default-rtdb), bóc tách danh sách tiết dạy chính khóa và các ca phân công dạy thay trong ngày.
  * Bổ sung cơ chế xử lý lỗi khi mất mạng hoặc Firebase không phản hồi: Trả về thông báo thân thiện, không làm crash luồng trigger.

### R4. Xuất bản Tài liệu Hướng dẫn Cập nhật Code.gs trên Google Apps Script
- Soạn thảo tài liệu hướng dẫn trực quan, chi tiết từng bước cho người quản trị nhà trường:
  * Cách copy và dán mã nguồn google-apps-script-zalo-edusign.js mới vào Code.gs trên script.google.com.
  * Các biến cấu hình cần kiểm tra (CONFIG.SPREADSHEET_ID, CONFIG.ZALO_BOT_TOKEN, CONFIG.FIREBASE_DATABASE_URL).
  * Hướng dẫn chạy các hàm khởi tạo 1 lần: initSheetsIfMissing, setupDailyMorningTrigger, setZaloBotWebhook.
  * Hướng dẫn cấp quyền truy cập Google (OAuth Scope) và Triển khai Web App (Deploy as New Web App version).

## Acceptance Criteria

### Áp dụng Bản vá Phương án 2
- [ ] Toàn bộ 23 bản vá trong PROPOSED_PATCHES.md được áp dụng chuẩn xác vào các file mục tiêu (index.html, js/app.js, server.js, zaloNotifyService.js, google-apps-script-zalo-edusign.js).
- [ ] Bẫy tràn ngang Mobile 20px được triệt tiêu hoàn toàn (scrollWidth === clientWidth = 390px trên iPhone).
- [ ] Thư mục /uploads được bảo vệ an toàn sau middleware requireAuth.
- [ ] Tuyến /reject trong server.js được hợp nhất còn 1 endpoint duy nhất có xác thực JWT.

### Kiểm thử Hồi quy & Tính Toàn vẹn (Zero-Regression)
- [ ] Toàn bộ các bộ test Playwright sẵn có và test Zalo chạy đạt 100% PASS, không phát sinh bất kỳ lỗi console hoặc logic hồi quy nào.
- [ ] Quy trình ký số VGCA, con dấu mộc đỏ trường học, Google Drive và Firebase hoạt động ổn định bình thường.

### Tính năng Zalo Nhắc TKB 6h00 Sáng
- [ ] Hàm setupDailyMorningTrigger() và removeOldTriggers() được viết hoàn chỉnh trong code GS, sẵn sàng kích hoạt trigger 6h00 sáng.
- [ ] Tin nhắn nhắc TKB định dạng đẹp mắt, hiển thị chính xác từng tiết học, khung giờ vào/ra lớp và các ca dạy thay.

### Hướng dẫn Cập nhật Code.gs
- [ ] Có tài liệu markdown hướng dẫn chi tiết từng bước (Step-by-step Guide) minh họa rõ ràng để người dùng thao tác thành công trên Google Apps Script.

## 2026-09-15T04:35:43Z

Khắc phục triệt để lỗi mất số 0 ở đầu của Số điện thoại và Mã PIN khi đồng bộ lên Google Sheets (khiến Zalo Bot không nhận diện được liên kết), đồng thời tái thiết kế toàn diện giao diện Quản trị Giáo viên (Hình 3) theo tiêu chuẩn công thái học hiện đại, khoa học và thẩm mỹ cao.

Working directory: c:\Users\HPZBook\Desktop\KÝ SỐ
Integrity mode: development

## Requirements

### R1. Sửa Triệt để Lỗi Mất Số 0 Đầu của Số Điện Thoại & Mã PIN khi Đồng bộ lên Google Sheets
- **Nguyên nhân cốt lõi**: Google Sheets tự động ép kiểu (auto-cast) chuỗi số ("0818810007" -> 818810007, "0007" -> 7) làm mất các chữ số 0 ở đầu.
- **Xử lý tại nguồn ghi (google-apps-script-zalo-edusign.js)**:
  * Khi ghi Số điện thoại và Mã PIN vào Sheet Danh bạ GV, định dạng bắt buộc dưới dạng Text thuần túy bằng tiền tố "'" (ví dụ: "'0818810007", "'0007"), hoặc đặt định dạng cột hiển thị setNumberFormat("@").
  * Đảm bảo trên Google Sheet hiển thị đầy đủ 10 số điện thoại (0818810007) và 4 ký tự mã PIN (0007).
- **Cơ chế phòng thủ đa tầng khi đọc dữ liệu (Zalo Bot Handler)**:
  * Trong hàm normalizePhone: Nếu số điện thoại lưu trên Sheet có 9 chữ số và không bắt đầu bằng số 0 (do dữ liệu cũ), tự động bù số 0 vào đầu (0 + phone).
  * Trong hàm đối soát Mã PIN: Tự động padStart(4, '0') nếu mã PIN bị lưu thành số đơn lẻ (7 -> 0007), đảm bảo giáo viên liên kết Zalo thành công 100% trong mọi trường hợp.
- **Đồng bộ từ Frontend (js/app.js, public/js/app.js, docs/js/app.js)**:
  * Chuẩn hóa dữ liệu gửi lên Webhook luôn giữ nguyên chuỗi có số 0 ở đầu.

### R2. Tái Thiết Kế Giao diện Danh Sách Giáo Viên (Hình 3) Đạt Chuẩn Khoa Học & Thẩm Mỹ Cao
- **Khắc phục tình trạng rối mắt hiện tại**:
  * **Cụm Thanh công cụ & Nút bấm**: Căn chỉnh hài hòa các nút "Đồng bộ Google Sheet" và "Thêm Giáo viên" với thanh Tab bar; sử dụng thiết kế nút hiện đại (Subtle Outline / Brand Fill), hiệu ứng hover và badge trạng thái đồng bộ rõ ràng.
  * **Tổ chức lại Cột Giáo viên / Tài khoản**:
    - Phân tầng thị giác 3 cấp (Visual Hierarchy):
      + Cấp 1: Họ tên nổi bật (Semibold, Dark slate) kèm Avatar tròn chữ cái đầu có màu sắc trang nhã.
      + Cấp 2: Tên đăng nhập @username và Email công vụ.
      + Cấp 3: Cụm thẻ liên kết Zalo thông minh: Gom Số điện thoại và Mã PIN vào một thẻ capsule thống nhất [ 📱 0818810007 • PIN: 0007 ] với nút 1-click sao chép nhanh, tinh gọn và không chiếm diện tích.
  * **Tối ưu Cột Loại chữ ký & Quyền hạn**:
    - Gom nhóm các huy hiệu (USB Token / SmartCA, Quyền Word, Con dấu) thành icon badge nhỏ gọn có tooltip, loại bỏ sự lộn xộn các thẻ nhiều màu.
  * **Cột Thao tác**:
    - Nhóm các nút tác vụ (Khóa, Sửa, Đổi mật khẩu, Xóa) theo phong cách Action Button bar tinh gọn, có màu sắc phản hồi khi rê chuột (Hover micro-interactions).

### R3. Kiểm thử Độc lập Đa Trình duyệt & Xác thực Dữ liệu Thực tế
- Viết kịch bản kiểm thử tự động đo đạc:
  * Test đồng bộ SĐT & Mã PIN với các trường hợp đặc biệt: 0818810007, 0007, 0905..., 0123... xác nhận giữ nguyên 100% các số 0 ở đầu.
  * Test Zalo Bot đối soát cú pháp 0818810007 và LK 0818810007 0007 thành công ngay cả khi dữ liệu cũ bị mất số 0.
  * Test giao diện Playwright chụp ảnh minh chứng trước và sau khi tái thiết kế trên cả màn hình Desktop (1920x1080) và Laptop (1366x768).
- Cập nhật tài liệu hướng dẫn và đẩy toàn bộ lên GitHub (git push origin main).

## Acceptance Criteria

### Tính Toàn Vẹn Dữ Liệu SĐT & Mã PIN
- [ ] Dữ liệu đồng bộ lên Sheet Danh bạ GV hiển thị chính xác số điện thoại có số 0 đầu (ví dụ: 0818810007) và Mã PIN đủ 4 số (ví dụ: 0007).
- [ ] Zalo Bot nhận diện và liên kết thành công 100% tài khoản giáo viên với cú pháp LK <SĐT> <Mã_PIN>.
- [ ] Cơ chế fallback tự động bù số 0 hoạt động hoàn hảo ngay cả với dữ liệu cũ đã có trên Sheet.

### Thẩm Mỹ Giao Diện Người Dùng (Hình 3)
- [ ] Thanh công cụ Admin có bố cục cân đối, hiện đại, không bị lệch hàng hoặc chen lấn.
- [ ] Bảng danh sách giáo viên thông thoáng, phân tầng thông tin rõ ràng, không còn hiện tượng chèn ép các badge chữ nhỏ dài ngoằng.
- [ ] Đạt chuẩn WCAG AA/AAA về độ tương phản và không có lỗi tràn khung ngang (scrollWidth === clientWidth).

### Đóng Gói & Xuất Bản
- [ ] Chạy lại toàn bộ test suite Playwright đạt 100% PASS, 0 lỗi Console F12.
- [ ] Cung cấp code google-apps-script-zalo-edusign.js mới kèm hướng dẫn cập nhật.
- [ ] Toàn bộ mã nguồn được commit và push thành công lên GitHub origin/main.

## 2026-09-15T06:38:01Z

Triển khai trọn gói 5 yêu cầu nghiệp vụ và công thái học theo phản hồi thực tế của người dùng: Thiết kế lại Modal User (H1) dạng ngang 2 cột không cuộn, sửa lỗi đồng bộ Mã PIN từ Admin sang tài khoản Giáo viên (H2), xóa bỏ gợi ý 4 số cuối SĐT trong hướng dẫn Zalo Bot (H3) để bảo mật tuyệt đối, xóa sạch 17 hồ sơ rác thử nghiệm (H4), và bổ sung tính năng tải file Excel mẫu & nhập danh sách giáo viên từ Excel tại giao diện Admin.

Requested team: Multi-Agent Team (Agent 1: Developer/Coder, Agent 2: Independent Tester, Agent 3: Cross-Checker & Forensic Auditor)

Working directory: c:\Users\HPZBook\Desktop\KÝ SỐ
Integrity mode: development

## Requirements

### R1. Tái Thiết Kế Modal Sửa/Thêm Giáo Viên (modalUser - Hình 1) Dạng Ngang 2 Cột Gọn Gàng
- **Vấn đề**: Hiện tại form xếp dọc 1 cột dài ngoằng, người dùng phải cuộn chuột xuống mới thấy nút bấm.
- **Giải pháp**:
  * Tái cấu trúc khung Modal thành bố cục 2 cột ngang (grid grid-cols-1 md:grid-cols-2 gap-4), độ rộng tối ưu max-w-3xl hoặc max-w-4xl.
  * Cột trái (Thông tin tài khoản & Định danh): Họ tên, Tên đăng nhập, Mật khẩu, Tổ chuyên môn & Chức vụ, Số CCCD, Email.
  * Cột phải (Bảo mật Zalo & Phân quyền): Số điện thoại, Mã PIN Zalo Bot cá nhân (kèm nút tạo PIN ngẫu nhiên/gợi ý), Loại chữ ký số (SmartCA / USB Token), Khối phân quyền gửi Word & Ủy quyền đóng dấu mộc đỏ.
  * Toàn bộ form và nút Lưu/Hủy nằm vừa vặn trọn vẹn trong khung nhìn màn hình chuẩn (Desktop & Laptop), loại bỏ hoàn toàn việc phải cuộn chuột dài.

### R2. Sửa Triệt Để Lỗi Đồng Bộ Mã PIN từ Admin sang Giao Diện Giáo Viên (Hình 2)
- **Vấn đề**: Admin đã nhập và lưu Mã PIN cho thầy Tý (ví dụ Cva@), nhưng khi giáo viên mở modal "Thông tin Cá Nhân & Zalo" vẫn hiển thị mã cũ 0007.
- **Nguyên nhân & Khắc phục**:
  * Kiểm tra hàm openModalUserProfile() và handleSaveUser() trong js/app.js: Đảm bảo khi Admin sửa PIN, dữ liệu được cập nhật đồng thời vào appState.users, Firebase RTDB (users/{id}/pinCode), và đồng bộ ngay vào appState.currentUser nếu đang là phiên của user đó.
  * Khi giáo viên mở modal thông tin cá nhân: Đọc dữ liệu cập nhật mới nhất từ appState.users.find(u => u.id === currentUser.id) hoặc Firebase RTDB thay vì chỉ đọc bản snapshot cũ trong localStorage.
  * Đảm bảo tính nhất quán trên cả 3 file: js/app.js, public/js/app.js, docs/js/app.js.

### R3. Bảo Mật Cú Pháp Zalo Bot (Hình 3): Bỏ Hoàn Toàn Gợi Ý 4 Số Cuối SĐT
- **Vấn đề**: Tin nhắn Bot hướng dẫn: "hoặc dùng ngay 4 số cuối SĐT (0007)" khiến người khác có thể đoán được và liên kết trộm tài khoản.
- **Khắc phục**:
  * Trong google-apps-script-zalo-edusign.js:
    - Xóa bỏ toàn bộ nội dung hướng dẫn lấy 4 số cuối SĐT. Tin nhắn phản hồi bảo mật chỉ hướng dẫn:
      🔐 BẢO VỆ ĐỊNH DANH GIÁO VIÊN:
      Để bảo vệ quyền riêng tư hồ sơ giáo án, Thầy/Cô vui lòng nhắn cú pháp kèm Mã PIN EduSign cá nhân:
      👉 Cú pháp: LK [SốĐiệnThoại] [MãPIN]
      📌 Thầy/Cô xem Mã PIN tại mục 'Thông tin cá nhân & Zalo' trên trang web EduSign của trường.
    - Trong hàm handleSecurePhoneMapping: Bắt buộc đối soát khớp chính xác secretPin === storedPin, loại bỏ hoàn toàn fallback cho phép bypass bằng 4 số cuối SĐT.
  * Cập nhật modal modalUserProfile trên giao diện web: Xóa bỏ gợi ý 4 số cuối SĐT.

### R4. Dọn Dẹp Xóa Sạch Dữ Liệu Rác Thử Nghiệm (Hình 4)
- **Vấn đề**: Trang "Tiến độ hồ sơ của tôi" đang tồn đọng 17 văn bản rác tạo trong quá trình test thử nghiệm.
- **Khắc phục**:
  * Xóa sạch toàn bộ các tài liệu thử nghiệm trong data/documents.json, reset về danh sách sạch hoặc danh sách mẫu chính thức của trường.
  * Dọn dẹp các bản ghi rác trên Firebase RTDB (documents/) và localStorage.
  * Kiểm tra và dọn dẹp các bản ghi rác tương ứng trong Sheet Sổ Lưu Báo Cáo trên Google Sheets.

### R5. Thêm Tính Năng Tải File Excel Mẫu & Nhập Danh Sách Giáo Viên Từ Excel
- **Chức năng Admin mới**:
  * Nút 1 — "Tải file mẫu Excel": Tự động tạo và tải xuống file .xlsx mẫu chuẩn với các cột:
    STT, Họ và Tên, Tên đăng nhập, Mật khẩu, Tổ Chuyên Môn, Chức vụ, Số CCCD, Email Công Vụ, Số Điện Thoại, Mã PIN, Loại chữ ký (SmartCA/USB).
  * Nút 2 — "Nhập từ Excel": Modal tải file .xlsx / .csv, tự động đọc dữ liệu bằng thư viện SheetJS (XLSX), hiển thị danh sách xem trước (Preview) số lượng tài khoản hợp lệ, kiểm tra trùng lặp và bấm "Xác nhận nhập".
  * Sau khi nhập: Tự động lưu vào appState.users, đồng bộ lên Firebase RTDB và đồng bộ ngay lên Google Sheet Danh bạ GV.

## Acceptance Criteria

### Giao diện Modal User (Hình 1)
- [ ] Modal sửa/thêm giáo viên có bố cục 2 cột ngang khoa học, hiển thị trọn vẹn trong màn hình Desktop & Laptop với chiều cao <= 85vh, không cần kéo cuộn chuột để tìm nút Lưu.

### Đồng bộ Mã PIN (Hình 2)
- [ ] Khi Admin thay đổi Mã PIN của giáo viên, giáo viên mở modal "Thông tin cá nhân & Zalo" thấy ngay Mã PIN mới 100%, không còn lưu giữ giá trị cũ.

### Bảo mật Zalo Bot (Hình 3)
- [ ] Zalo Bot không còn bất kỳ dòng chữ nào gợi ý 4 số cuối SĐT.
- [ ] Người dùng nhập sai PIN hoặc cố tình dùng 4 số cuối SĐT đều bị từ chối truy cập.

### Dọn dẹp dữ liệu rác (Hình 4)
- [ ] 17 hồ sơ rác thử nghiệm được xóa sạch hoàn toàn, tab "Tiến độ hồ sơ" hiển thị sạch sẽ 0 rác.

### Tính năng Excel
- [ ] Tải file Excel mẫu chuẩn .xlsx thành công chỉ với 1 click.
- [ ] Tải file Excel danh sách giáo viên lên tạo tài khoản thành công, tự động đồng bộ Firebase và Google Sheets.

### Đóng gói & Hướng dẫn Code.gs
- [ ] Toàn bộ test suite Playwright và unit tests đạt 100% PASS.
- [ ] Cung cấp hướng dẫn chi tiết cập nhật Code.gs và thực hiện git push origin main.
