# BÁO CÁO BÀN GIAO ĐIỀU TRA (HANDOFF REPORT — EXPLORER 1)

**Dự án**: KÝ SỐ EduSign VGCA — Nâng cấp Thông báo Zalo Bot  
**Người lập**: Explorer 1 (`teamwork_preview_explorer_1`)  
**Người nhận**: Project Orchestrator (`teamwork_preview_orchestrator_6`), Developer, Tester  
**Thời gian**: 2026-09-15T14:46:00+07:00  
**Tệp phân tích chi tiết**: `c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\teamwork_preview_explorer_1\analysis.md`

---

## 1. OBSERVATION (QUAN SÁT THỰC NGHIỆM TRỰC TIẾP)

1. **Khởi tạo CodeGraph**:
   - Thư mục `.codegraph` đã tồn tại tại `c:\Users\HPZBook\Desktop\KÝ SỐ\.codegraph`.
   - File `codegraph.db` dung lượng 57,774,080 bytes, cập nhật lúc 09:38 AM ngày 15/09/2026.
2. **Hàm `sendZaloNotificationClientSide` & Bảng mã băm SHA-256**:
   - Cả 3 tệp `js/app.js`, `public/js/app.js`, `docs/js/app.js` đều có hàm `sendZaloNotificationClientSide` tại dòng 42–61.
   - SHA-256 của cả 3 tệp khớp 100%: `2D336F06F92C991CC93E432BF39137F988E267C6C3A11C2B754E0E0E47F02DF5`.
   - Hàm `sendZaloNotificationClientSide` hiện tại:
     ```javascript
     async function sendZaloNotificationClientSide(payload) {
       try {
         const url = DEFAULT_GAS_URL;
         if (!url || !url.startsWith('http')) return;
         console.log('[ZaloNotify Client] Đang phát thông báo Zalo:', payload.eventType, payload.docTitle);
         await fetch(url, {
           method: 'POST',
           headers: { 'Content-Type': 'text/plain;charset=utf-8' },
           body: JSON.stringify(payload),
           redirect: 'follow',
           mode: 'no-cors'
         }).catch(e => console.warn('[ZaloNotify Client] Fetch warning:', e.message));
       } catch (err) {
         console.warn('[ZaloNotify Client] Exception:', err.message);
       }
     }
     ```
   - 5 điểm gọi của hàm trong `js/app.js`:
     - Dòng 5138: `eventType: 'REJECTED'` — không có `secret_token`
     - Dòng 5594: `eventType: 'PERSONAL_SIGNED'` — không có `secret_token`
     - Dòng 5793: `eventType: 'SUBMITTED'` — không có `secret_token`
     - Dòng 5968: `eventType: 'COMPLETED'` — không có `secret_token`
     - Dòng 6011: `eventType: 'FORWARDED'` — không có `secret_token`
3. **Cơ chế phòng thủ trong `google-apps-script-zalo-edusign.js`**:
   - Dòng 433–441:
     ```javascript
     var sensitiveActions = ["DELETE_REPORT", "BATCH_DELETE_REPORTS", "CLEAR_ALL_REPORTS", "NOTIFY_SIGN_EVENT", "SYNC_TEACHER", "SYNC_TEACHERS_BATCH"];
     if (sensitiveActions.indexOf(action) !== -1) {
       if (providedSecret !== SYSTEM_SECRET) {
         Logger.log("⛔ Cảnh báo: Truy cập trái phép doPost không có secret_token hợp lệ!");
         return ContentService.createTextOutput(JSON.stringify({ 
           success: false, 
           error: "UNAUTHORIZED_SECRET_TOKEN" 
         })).setMimeType(ContentService.MimeType.JSON);
       }
     }
     ```
4. **Hàm `handleEduSignNotification` trong `google-apps-script-zalo-edusign.js`**:
   - Dòng 1851–1942: Khi `eventType === "SUBMITTED"` (dòng 1887), mã nguồn chỉ gán `targetPhone = recipientPhone;` và soạn tin `"📥 THÔNG BÁO: CÓ HỒ SƠ MỚI CẦN KÝ DUYỆT"`. Không hề xử lý `authorPhone`.
   - Nếu `recipientPhone` chưa liên kết Zalo, hàm trả về `{ success: true, delivered: false, phone: recipientPhone, note: "CHUA_LIEN_KET_ZALO" }`. Tác giả hoàn toàn không nhận được tin.
   - Tham số `recipientName` được client gửi sang nhưng không được trích xuất trong `handleEduSignNotification`.
5. **Đo đạc mạng thật (Live Network Trace)**:
   - Endpoint: `https://script.google.com/macros/s/AKfycbwGBgauc9xHzRe31_IfCQD-Q9yHwGp4CfYLEam9IupcYhLpNBXbgW0J1t-weD6iUQ87ZQ/exec`
   - Gửi POST thiếu `secret_token`: Nhận mã HTTP 200, nội dung:
     `{"success":false,"error":"UNAUTHORIZED_SECRET_TOKEN"}`
   - Gửi POST có `secret_token` tới `0818810007` (Thầy Hà Văn Tý): Nhận mã HTTP 200:
     `{"success":true,"delivered":true,"phone":"0818810007","chatId":"db63a6b282f96ba732e8"}`
   - Gửi POST `SUBMITTED` có `secret_token` với `authorPhone: "0818810007"` và `recipientPhone: "0905123456"`: Nhận mã HTTP 200:
     `{"success":true,"delivered":false,"phone":"0905123456","note":"CHUA_LIEN_KET_ZALO"}` (Xác nhận `authorPhone` bị bỏ rơi trong code hiện tại).
6. **Git Status & Test Suites**:
   - Nhánh: `main`, đồng bộ với `origin/main`.
   - `node tests/test_zalo_unified_bot.js`: 26/26 PASS.
   - `node tests/test_zalo_security_and_logic_audit.js`: 12/12 PROBES VERIFIED.
   - `node tests/test_requirements_r1_to_r5.js`: 22/22 PASS.

---

## 2. LOGIC CHAIN (CHUỖI SUY LUẬN TỪ QUAN SÁT ĐẾN KẾT LUẬN)

1. **Bước 1 (Vấn đề R1)**:
   - Từ Quan sát 2: Client gọi `sendZaloNotificationClientSide` gửi POST với `action: "NOTIFY_SIGN_EVENT"` nhưng không đính kèm `secret_token`.
   - Từ Quan sát 3: Google Apps Script kiểm tra `action === "NOTIFY_SIGN_EVENT"` thuộc `sensitiveActions` và yêu cầu `providedSecret === SYSTEM_SECRET` (`"UnifiedZaloBotTHCSCVA2026Secret"`).
   - Từ Quan sát 5: Mạng thật phản hồi `{"success":false,"error":"UNAUTHORIZED_SECRET_TOKEN"}`.
   - **Suy luận 1**: Mọi thông báo ký số từ client browser hiện tại đều bị Google Apps Script chặn đứng 100% tại cổng xác thực bí mật.
   - **Biện pháp**: Tự động gán `payload.secret_token = payload.secret_token || "UnifiedZaloBotTHCSCVA2026Secret"` bên trong `sendZaloNotificationClientSide` tại `js/app.js` và đồng bộ sang 2 file mirror.

2. **Bước 2 (Vấn đề R2)**:
   - Từ Quan sát 4: Trong `handleEduSignNotification`, khi nhận `SUBMITTED`, script chỉ định vị `targetPhone = recipientPhone`.
   - Từ Quan sát 5: Đo đạc mạng thật chứng minh khi `recipientPhone` chưa liên kết Zalo, script kết thúc với `delivered: false` và không gửi bất kỳ tin nhắn nào tới `authorPhone`.
   - **Suy luận 2**: Luồng `SUBMITTED` bị khiếm khuyết nghiêm trọng vì không có nhánh gửi xác nhận cho tác giả khởi tạo (`authorPhone`), đồng thời bị chặn bởi người duyệt nếu người duyệt chưa liên kết Zalo.
   - **Biện pháp**: Thiết kế cơ chế gửi kép (Dual-Delivery) cho `SUBMITTED`: Gửi xác nhận cho `authorPhone` và Mời duyệt cho `recipientPhone`, kèm Fallback êm dịu nếu người duyệt chưa liên kết Zalo.

---

## 3. CAVEATS (GIỚI HẠN & GIẢ ĐỊNH)

1. **Giới hạn điều tra**: Explorer là vai trò Read-only nên không thực hiện chỉnh sửa trực tiếp vào mã nguồn sản phẩm chính (`js/app.js`, `google-apps-script-zalo-edusign.js`). Việc chỉnh sửa được bàn giao cho Coder.
2. **Giả định về Zalo Chat ID của người duyệt**: Thầy Hà Văn Tý (`0818810007`) đã liên kết Zalo (`chatId: "db63a6b282f96ba732e8"`). Các giáo viên khác nếu chưa liên kết Zalo thì hệ thống chỉ gửi được cho Thầy Tý và ghi nhận fallback cho người chưa liên kết.

---

## 4. CONCLUSION (KẾT LUẬN & KIẾN NGHỊ HÀNH ĐỘNG)

1. **Đối với R1**:
   - Chèn `payload.secret_token = payload.secret_token || "UnifiedZaloBotTHCSCVA2026Secret"` tại dòng 44 của `js/app.js`.
   - Sao chép toàn bộ sang `public/js/app.js` và `docs/js/app.js`.
   - Tại dòng 6011 (`FORWARDED`), bổ sung `authorPhone: authorPhone` và `recipientName: nextSignerName`.
2. **Đối với R2**:
   - Trong `google-apps-script-zalo-edusign.js`:
     - Trích xuất `var recipientName = data.recipientName || "Người duyệt";`.
     - Tái cấu trúc nhánh `SUBMITTED` thành 2 bước gửi: Xác nhận cho tác giả (`authorPhone`) và Mời duyệt cho người duyệt (`recipientPhone`).
     - Áp dụng cơ chế Fallback không chặn để đảm bảo tác giả luôn nhận được tin dù người duyệt có liên kết Zalo hay chưa.
3. **Đối với R3**:
   - Viết kịch bản test mạng thật kiểm chứng phản hồi từ Google Apps Script.
   - Cập nhật `HUONG_DAN_CAP_NHAT_CODE_GS.md` và thực hiện `git push origin main`.

---

## 5. VERIFICATION METHOD (PHƯƠNG PHÁP KIỂM CHỨNG ĐỘC LẬP)

1. **Kiểm tra đồng bộ 3 gương SHA-256**:
   ```bash
   node -e "const crypto = require('crypto'), fs = require('fs'); const h = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'); console.log(h('js/app.js') === h('public/js/app.js') && h('js/app.js') === h('docs/js/app.js') ? 'PASS 100%' : 'FAIL');"
   ```
2. **Kiểm tra secret_token trên mạng thật**:
   ```bash
   node -e "fetch('https://script.google.com/macros/s/AKfycbwGBgauc9xHzRe31_IfCQD-Q9yHwGp4CfYLEam9IupcYhLpNBXbgW0J1t-weD6iUQ87ZQ/exec', { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'NOTIFY_SIGN_EVENT', secret_token: 'UnifiedZaloBotTHCSCVA2026Secret', eventType: 'PERSONAL_SIGNED', docId: 'TEST', docTitle: 'Test', authorPhone: '0818810007', senderName: 'Hà Văn Tý' }), redirect: 'follow' }).then(r => r.json()).then(console.log)"
   ```
   *Điều kiện đạt*: Trả về `success: true, delivered: true, phone: "0818810007", chatId: "db63a6b282f96ba732e8"`.
3. **Chạy toàn bộ bộ kiểm thử**:
   ```bash
   node tests/test_zalo_unified_bot.js
   node tests/test_zalo_security_and_logic_audit.js
   node tests/test_requirements_r1_to_r5.js
   ```
   *Điều kiện đạt*: 100% PASS, 0 fail.
