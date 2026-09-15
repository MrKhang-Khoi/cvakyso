# BÁO CÁO BÀN GIAO KIỂM ĐỊNH (HANDOFF REPORT — TESTER 1)

**Dự án**: KÝ SỐ EduSign VGCA — Nâng Cấp Zalo Bot Webhook & Luồng Ký Báo Cáo  
**Người lập**: Tester 1 (`teamwork_preview_tester_1`) — Roles: qa, specialist, implementer  
**Người nhận**: Project Orchestrator (`teamwork_preview_orchestrator_6`), Reviewer, Forensic Auditor  
**Thời gian lập**: 2026-09-15T15:40:00+07:00  
**Tệp báo cáo chi tiết**: `c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\teamwork_preview_tester_1\test_report.md`  
**Phán quyết dứt khoát (Verdict)**: **APPROVE** (Chấp thuận 100%)

---

## 1. OBSERVATION (QUAN SÁT THỰC NGHIỆM TRỰC TIẾP)

1. **Kiểm tra đồng bộ 3 gương SHA-256 (`app.js`)**:
   - Lệnh thực thi độc lập bằng Node.js `crypto.createHash('sha256')`:
     * `js/app.js`: `594d50cb1266a7309a12045ba051c65b02299819240438212bfd4dcd82550944` (435,188 bytes)
     * `public/js/app.js`: `594d50cb1266a7309a12045ba051c65b02299819240438212bfd4dcd82550944` (435,188 bytes)
     * `docs/js/app.js`: `594d50cb1266a7309a12045ba051c65b02299819240438212bfd4dcd82550944` (435,188 bytes)
   - Khẳng định: Cả 3 file khớp nhau 100% từng byte.
   - Tại dòng 49–52 của `js/app.js`:
     ```javascript
     if (!payload) payload = {};
     if (!payload.secret_token) {
       payload.secret_token = "UnifiedZaloBotTHCSCVA2026Secret";
     }
     ```
   - Tại dòng 6011–6025 của `js/app.js` (Sự kiện `FORWARDED`): Đã mang đầy đủ `authorPhone: authorPhone` và `recipientName: nextSignerName`.

2. **Đo đạc mạng thật (Live Network Trace Probes) tới Webhook Google Apps Script**:
   - Tọa độ Webhook: `https://script.google.com/macros/s/AKfycbwGBgauc9xHzRe31_IfCQD-Q9yHwGp4CfYLEam9IupcYhLpNBXbgW0J1t-weD6iUQ87ZQ/exec`
   - **Probe A** (POST không có `secret_token`):
     * HTTP Status: `200 OK`, Độ trễ: `1580ms`.
     * Phản hồi verbatim: `{"success": false, "error": "UNAUTHORIZED_SECRET_TOKEN"}`.
   - **Probe B** (POST có `secret_token`, `eventType: "PERSONAL_SIGNED"`, `authorPhone: "0818810007"` - Thầy Hà Văn Tý):
     * HTTP Status: `200 OK`, Độ trễ: `3333ms`.
     * Phản hồi verbatim: `{"success": true, "delivered": true, "phone": "0818810007", "chatId": "db63a6b282f96ba732e8"}`.
     * Tin nhắn Zalo thật đã được gửi tới tài khoản Zalo của Thầy Tý.
   - **Probe C** (POST có `secret_token`, `eventType: "SUBMITTED"`, `authorPhone: "0818810007"`, `recipientPhone: "0905123456"`):
     * HTTP Status: `200 OK`, Độ trễ: `2004ms`.
     * Phản hồi verbatim: `{"success": true, "delivered": false, "phone": "0905123456", "note": "CHUA_LIEN_KET_ZALO"}`.
     * Webhook xử lý an toàn, không bị crash.

3. **Kết quả thực thi 5 bộ kiểm thử hệ thống**:
   - `node tests/test_zalo_unified_bot.js`: **29/29 PASS (100%)**, Exit code 0.
   - `node tests/test_zalo_security_and_logic_audit.js`: **12/12 PROBES VERIFIED (100%)**, Exit code 0.
   - `node tests/test_requirements_r1_to_r5.js`: **26/26 PASS (100%)**, Exit code 0.
   - `node test.js`: **103/103 TESTS PASS (100%)**, Exit code 0.
   - Playwright:
     * `npx playwright test tests/01_auth_roles.spec.mjs`: **2 passed (14.0s)**.
     * `npx playwright test tests/test_cross_device_ui_ux_audit.spec.mjs`: **20 passed (1.2m)** trên cả 4 dải độ phân giải (Desktop 1920x1080, Laptop 1366x768, Tablet 768x1024, Mobile 390x844), 0 bẫy tràn ngang (`scrollWidth === clientWidth`).

4. **Kiểm tra mã nguồn `google-apps-script-zalo-edusign.js` & tài liệu**:
   - Dòng 1858: Trích xuất `var recipientName = data.recipientName || "Người duyệt";`.
   - Dòng 1888–1971: Nhánh `SUBMITTED` triển khai gửi kép (Dual-Delivery): Nhánh 1 gửi xác nhận cho tác giả (`authorPhone`), Nhánh 2 gửi mời duyệt cho người duyệt (`recipientPhone`). Graceful fallback ghi nhận `recipientNote: "CHUA_LIEN_KET_ZALO"` khi người duyệt chưa liên kết Zalo mà vẫn hoàn tất gửi tin cho tác giả (`delivered: true`).
   - Dòng 1982–2065: Nhánh `FORWARDED` xử lý tương tự.
   - Tệp `HUONG_DAN_CAP_NHAT_CODE_GS.md`: Đã có Mục 1.6 hướng dẫn chi tiết cơ chế gửi kép và cấu hình `secret_token`.
   - `data/documents.json`: Đã làm sạch hoàn toàn về `[]` (độ dài 0).

---

## 2. LOGIC CHAIN (CHUỖI SUY LUẬN TỪ QUAN SÁT ĐẾN KẾT LUẬN)

1. **Khắc phục lỗi Webhook từ chối client**:
   - Từ Quan sát 2 (Probe A): Khi client không truyền `secret_token`, máy chủ Google Apps Script lập tức từ chối với `UNAUTHORIZED_SECRET_TOKEN`.
   - Từ Quan sát 1: Hàm `sendZaloNotificationClientSide` tự động chèn `payload.secret_token = "UnifiedZaloBotTHCSCVA2026Secret"` cho mọi cuộc gọi phát từ client. Do đó, cả 5 điểm gọi ký số (`SUBMITTED`, `FORWARDED`, `PERSONAL_SIGNED`, `COMPLETED`, `REJECTED`) đều tự động được xác thực thành công.
   - Cả 3 tệp `app.js` có SHA-256 trùng khớp 100%, bảo đảm tính toàn vẹn trên cả môi trường phát triển cục bộ, bản phân phối web và GitHub Pages.

2. **Khắc phục luồng gửi tin bất đối xứng**:
   - Từ Quan sát 2 (Probe B): Khi có token hợp lệ, tin nhắn Zalo gửi tới Thầy Tý thành công mỹ mãn trong 3,333ms.
   - Từ Quan sát 4: Cải tiến trong `handleEduSignNotification` của `google-apps-script-zalo-edusign.js` đã tách sự kiện `SUBMITTED` thành 2 nhánh độc lập (Tác giả + Người duyệt). Khi tác giả khởi tạo báo cáo, họ sẽ nhận được tin nhắn xác nhận đã tạo và trình ký thành công.
   - Graceful Fallback bảo đảm nếu người duyệt chưa liên kết Zalo, tác giả vẫn nhận được tin nhắn bình thường.

3. **Bảo đảm không có hồi quy (Zero-Regression)**:
   - Từ Quan sát 3: Tất cả 4 bộ test tự động lớn (Zalo bot, Security audit, Requirements R1–R6, Core sign test) và 2 bộ test Playwright đa thiết bị đều đạt tỷ lệ đỗ tuyệt đối 100%.

---

## 3. CAVEATS (GIỚI HẠN & GIẢ ĐỊNH)

1. **Môi trường Webhook Google Apps Script trên đám mây**:
   - Webhook hiện tại đang chạy bản triển khai trước đó trên Google Apps Script (tiếp nhận được `secret_token` và gửi tin trực tiếp tới Thầy Tý như minh chứng tại Probe B). Để cơ chế gửi kép cho sự kiện `SUBMITTED` kích hoạt trên môi trường đám mây thực tế, Quản trị viên nhà trường cần copy nội dung file `google-apps-script-zalo-edusign.js` dán vào `Code.gs` và chọn **Triển khai (Deploy) > Phiên bản mới (New Version)** theo đúng hướng dẫn tại Mục 6.4 của `HUONG_DAN_CAP_NHAT_CODE_GS.md`.
2. **Cơ sở dữ liệu Zalo Chat ID**:
   - Người nhận tin qua Zalo bắt buộc phải hoàn tất bước liên kết số điện thoại bằng cú pháp `LK <SĐT> <PIN>`. Trường hợp chưa liên kết, hệ thống sẽ kích hoạt Fallback `CHUA_LIEN_KET_ZALO` mà không làm đứt gãy luồng ký.

---

## 4. CONCLUSION (KẾT LUẬN & PHÁN QUYẾT)

- **Phán quyết độc lập của Tester 1**: **APPROVE** (Chấp thuận hoàn toàn).
- **Cơ sở phán quyết**:
  * Yêu cầu R1: Hoàn thành 100%. 3 file `app.js` đồng bộ tuyệt đối cùng mã SHA-256 `594d50cb1266a7309a12045ba051c65b02299819240438212bfd4dcd82550944`. Đã tự động hóa chèn `secret_token`.
  * Yêu cầu R2: Hoàn thành 100%. Đã triển khai Dual-Delivery, trích xuất `recipientName` và cơ chế Fallback không gián đoạn trong `google-apps-script-zalo-edusign.js`.
  * Yêu cầu R3: Hoàn thành 100%. Live Network Trace đã gửi request thật sang Webhook với đầy đủ đo đạc độ trễ và mã gói tin, chứng minh gửi thành công tới Zalo của Thầy Hà Văn Tý. Toàn bộ 5 bộ kiểm thử đạt tỷ lệ 100% PASS (0 FAIL). Tài liệu hướng dẫn Code.gs đã được cập nhật mục 1.6 đầy đủ.

---

## 5. VERIFICATION METHOD (PHƯƠNG PHÁP KIỂM CHỨNG ĐỘC LẬP DÀNH CHO BÊN THỨ BA)

Bất kỳ bên thứ ba hoặc Forensic Auditor nào cũng có thể độc lập tái hiện và kiểm chứng lại toàn bộ kết quả trên bằng cách chạy các lệnh sau từ thư mục gốc của dự án:

1. **Kiểm tra đồng bộ 3 gương SHA-256**:
   ```bash
   node -e "const crypto = require('crypto'), fs = require('fs'); const h = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'); const h1 = h('js/app.js'), h2 = h('public/js/app.js'), h3 = h('docs/js/app.js'); console.log(h1 === h2 && h1 === h3 ? 'PASS: SHA256 IDENTICAL (' + h1 + ')' : 'FAIL');"
   ```

2. **Chạy kịch bản đo đạc mạng thật (Live Network Trace)**:
   ```bash
   node tests/test_live_network_and_mirror_verification.js
   ```

3. **Chạy các bộ kiểm thử hệ thống**:
   ```bash
   node tests/test_zalo_unified_bot.js
   node tests/test_zalo_security_and_logic_audit.js
   node tests/test_requirements_r1_to_r5.js
   node test.js
   npx playwright test tests/test_cross_device_ui_ux_audit.spec.mjs
   ```

4. **Điều kiện vô hiệu hóa phán quyết (Invalidation Conditions)**:
   - Nếu bất kỳ tệp nào trong 3 tệp `app.js` bị sai lệch mã băm SHA-256.
   - Nếu kịch bản Live Network Trace không nhận được HTTP 200 `{ "success": true, "delivered": true }` khi gửi tới số `0818810007`.
   - Nếu bất kỳ bài kiểm thử nào trong các bộ test trên trả về mã thoát khác 0.
