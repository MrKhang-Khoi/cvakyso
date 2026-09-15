# BÁO CÁO BÀN GIAO TRIỂN KHAI (HANDOFF REPORT — WORKER 1)

**Dự án**: KÝ SỐ EduSign VGCA — Nâng Cấp Zalo Bot Webhook & Luồng Ký Báo Cáo  
**Người lập**: Worker 1 (`teamwork_preview_worker_1`) — Roles: implementer, qa, specialist  
**Người nhận**: Project Orchestrator (`teamwork_preview_orchestrator_6`), Reviewer, Tester, Forensic Auditor  
**Thời gian lập**: 2026-09-15T15:00:00+07:00  
**Tệp báo cáo chi tiết**: `c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\teamwork_preview_worker_1\report.md`  

---

## 1. OBSERVATION (QUAN SÁT THỰC NGHIỆM TRỰC TIẾP)

1. **Trước khi sửa đổi**:
   - `sendZaloNotificationClientSide(payload)` trong `js/app.js` (dòng 42–61) chỉ nhận `payload` từ caller mà không gắn `secret_token`. Khi phát Webhook sang Google Apps Script, Google Apps Script kiểm tra `action === "NOTIFY_SIGN_EVENT"` thuộc mảng `sensitiveActions` và yêu cầu `providedSecret === "UnifiedZaloBotTHCSCVA2026Secret"` (dòng 433–441 trong `google-apps-script-zalo-edusign.js`). Kết quả mạng thật: HTTP 200 `{ "success": false, "error": "UNAUTHORIZED_SECRET_TOKEN" }`.
   - Trong `handleEduSignNotification` của `google-apps-script-zalo-edusign.js` (dòng 1887), sự kiện `SUBMITTED` chỉ gán `targetPhone = recipientPhone;`. Tác giả khởi tạo (`authorPhone`) hoàn toàn không được thông báo xác nhận. Nếu người duyệt chưa liên kết Zalo, hàm trả về `{ success: true, delivered: false, note: "CHUA_LIEN_KET_ZALO" }` và không có tin nhắn nào được gửi.
   - Điểm gọi `FORWARDED` tại dòng 6011 trong `js/app.js` chỉ truyền `recipientPhone` và `senderName`, thiếu `authorPhone` và `recipientName`.

2. **Sau khi sửa đổi**:
   - `sendZaloNotificationClientSide(payload)` trong `js/app.js` tự động kiểm tra `if (!payload) payload = {}; if (!payload.secret_token) payload.secret_token = "UnifiedZaloBotTHCSCVA2026Secret";`. Cả 5 điểm gọi ký số (`SUBMITTED`, `FORWARDED`, `PERSONAL_SIGNED`, `COMPLETED`, `REJECTED`) đều tự động mang theo mã bảo mật hợp lệ.
   - Điểm gọi `FORWARDED` (dòng 6011–6025 `js/app.js`) truyền đầy đủ `authorPhone: authorPhone`, `recipientPhone: nextUserObj?.phone || ''`, `recipientName: nextSignerName`, `senderName: user?.fullName || currentUsername`.
   - Cả 3 tệp `js/app.js`, `public/js/app.js`, `docs/js/app.js` có mã băm SHA-256 trùng khớp 100%: `594d50cb1266a7309a12045ba051c65b02299819240438212bfd4dcd82550944`.
   - `handleEduSignNotification` trong `google-apps-script-zalo-edusign.js` trích xuất `recipientName = data.recipientName || "Người duyệt"`. Khi nhận `SUBMITTED`, hệ thống kích hoạt cơ chế gửi kép (Dual-Delivery):
     * Nhánh 1 gửi tin xác nhận cho tác giả (`authorPhone`) với tiêu đề `📤 XÁC NHẬN: KHỞI TẠO BÁO CÁO & TRÌNH KÝ THÀNH CÔNG`.
     * Nhánh 2 gửi tin mời duyệt cho người duyệt tiếp theo (`recipientPhone`) với tiêu đề `📥 THÔNG BÁO: CÓ HỒ SƠ MỚI CẦN KÝ DUYỆT`.
     * Graceful fallback: Nếu người duyệt chưa liên kết Zalo, ghi nhận `recipientNote: "CHUA_LIEN_KET_ZALO"`, tác giả vẫn nhận tin và trả về `delivered: true`.
   - Tệp `HUONG_DAN_CAP_NHAT_CODE_GS.md` đã bổ sung mục 1.6 hướng dẫn chi tiết cập nhật tính năng mới này.
   - Các bộ kiểm thử:
     * `node tests/test_zalo_unified_bot.js`: 29/29 PASS.
     * `node tests/test_zalo_security_and_logic_audit.js`: 12/12 PROBES VERIFIED.
     * `node tests/test_requirements_r1_to_r5.js`: 26/26 PASS.
     * `node test.js`: 103/103 PASS.

---

## 2. LOGIC CHAIN (CHUỖI SUY LUẬN TỪ QUAN SÁT ĐẾN KẾT LUẬN)

1. **Bước 1 (Xử lý secret_token)**:
   - Từ Quan sát 1: Khi client gọi `sendZaloNotificationClientSide`, thiếu `secret_token` dẫn đến bị `doPost` trong GAS từ chối với lỗi `UNAUTHORIZED_SECRET_TOKEN`.
   - Chèn token ngay đầu hàm `sendZaloNotificationClientSide` bảo đảm mọi điểm gọi hiện tại và tương lai đều được cấp quyền tự động mà không cần sửa phân tán ở 5 nơi.
   - Đồng bộ sang `public/js/app.js` và `docs/js/app.js` bảo toàn tính nhất quán tuyệt đối của hệ thống.

2. **Bước 2 (Xử lý Dual-Delivery)**:
   - Từ Quan sát 1: Khi nộp hồ sơ, giáo viên cần biết chắc chắn hồ sơ đã nộp thành công và đang chuyển tới ai; đồng thời người duyệt cần nhận tin để vào duyệt.
   - Tách sự kiện `SUBMITTED` thành 2 nhánh gửi độc lập (Tác giả + Người duyệt).
   - Áp dụng Fallback không chặn: Nếu người duyệt chưa liên kết Zalo, hệ thống vẫn gửi xác nhận cho tác giả và ghi nhận trạng thái fallback thay vì ngắt toàn bộ tiến trình.

3. **Bước 3 (Xử lý FORWARDED)**:
   - Khi chuyển tiếp hồ sơ từ người ký trước sang người ký sau, người chuyển cần được xác nhận và người nhận cần được thông báo.
   - Bổ sung `authorPhone` và `recipientName` tại call site `FORWARDED` và xử lý gửi kép tương ứng trong `handleEduSignNotification`.

---

## 3. CAVEATS (GIỚI HẠN & GIẢ ĐỊNH)

1. **Môi trường Webhook Google Apps Script trên đám mây**:
   - Sau khi hoàn thành cập nhật mã nguồn trong file `google-apps-script-zalo-edusign.js`, Quản trị viên nhà trường cần copy toàn bộ nội dung file và dán vào `Code.gs` trên Google Apps Script, sau đó chọn **Triển khai (Deploy) > Quản lý bản triển khai > Chỉnh sửa > Phiên bản mới (New Version)** theo đúng hướng dẫn tại `HUONG_DAN_CAP_NHAT_CODE_GS.md` để áp dụng phiên bản mới trên Webhook trực tiếp.
2. **Cơ sở dữ liệu Zalo Chat ID**:
   - Việc nhận tin nhắn thành công qua Zalo phụ thuộc vào việc giáo viên đã liên kết số điện thoại với Zalo Bot (bằng cú pháp `LK <SĐT> <PIN>`). Nếu giáo viên chưa liên kết, hệ thống sẽ tự động kích hoạt cơ chế Graceful Fallback (`CHUA_LIEN_KET_ZALO`) để đảm bảo không làm gián đoạn các luồng thông báo khác.

---

## 4. CONCLUSION (KẾT LUẬN)

- **R1**: Đã khắc phục triệt để lỗi thiếu `secret_token` trong `sendZaloNotificationClientSide` tại cả 3 file `js/app.js`, `public/js/app.js`, `docs/js/app.js`. Cả 3 file khớp 100% từng byte với SHA-256 `594d50cb1266a7309a12045ba051c65b02299819240438212bfd4dcd82550944`. Điểm gọi `FORWARDED` đã được bổ sung `authorPhone` và `recipientName`.
- **R2**: Đã nâng cấp logic gửi tin trong `google-apps-script-zalo-edusign.js` cho sự kiện `SUBMITTED` và `FORWARDED` với cơ chế Gửi kép (Dual-Delivery) và Fallback êm dịu khi người duyệt chưa liên kết Zalo.
- **R3 & Kiểm Thử**: Đã cập nhật tài liệu `HUONG_DAN_CAP_NHAT_CODE_GS.md`. Đã chạy 4 bộ kiểm thử với kết quả 100% PASS (29/29 Zalo tests, 12/12 Audit probes, 26/26 Requirement checks, 103/103 Core sign tests).

---

## 5. VERIFICATION METHOD (PHƯƠNG PHÁP KIỂM CHỨNG ĐỘC LẬP)

Để kiểm chứng độc lập toàn bộ công việc, thực thi các lệnh sau:

1. **Kiểm tra đồng bộ 3 gương SHA-256**:
   ```bash
   node -e "const crypto = require('crypto'), fs = require('fs'); const h = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'); const h1 = h('js/app.js'), h2 = h('public/js/app.js'), h3 = h('docs/js/app.js'); console.log(h1 === h2 && h1 === h3 ? 'PASS: SHA256 IDENTICAL (' + h1 + ')' : 'FAIL');"
   ```

2. **Kiểm thử bộ Zalo Unified Bot**:
   ```bash
   node tests/test_zalo_unified_bot.js
   ```
   *Yêu cầu*: 29 PASS, 0 FAIL.

3. **Kiểm thử bộ Security & Logic Audit**:
   ```bash
   node tests/test_zalo_security_and_logic_audit.js
   ```
   *Yêu cầu*: 12/12 PROBES VERIFIED.

4. **Kiểm thử bộ Requirements R1 - R5 & R6**:
   ```bash
   node tests/test_requirements_r1_to_r5.js
   ```
   *Yêu cầu*: 26/26 PASS.

5. **Kiểm tra hồi quy hệ thống ký số cốt lõi**:
   ```bash
   node test.js
   ```
   *Yêu cầu*: 103/103 TESTS PASS.
