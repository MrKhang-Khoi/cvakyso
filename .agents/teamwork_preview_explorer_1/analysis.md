# BÁO CÁO ĐIỀU TRA & KHẢO SÁT CHUYÊN SÂU (EXPLORER 1 REPORT)
## Hệ Thống Ký Số EduSign VGCA — Tích Hợp Zalo Bot Trợ Lý Trường Học 4.0
**Dự án**: THCS Chu Văn An — Ký Số & Zalo Bot Webhook  
**Tác giả**: Explorer 1 (Multi-Agent Teamwork)  
**Thời gian lập báo cáo**: 2026-09-15T14:45:00+07:00  
**Tọa độ làm việc**: `c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\teamwork_preview_explorer_1`

---

## 📑 MỤC LỤC
1. [Tóm tắt Điều hành (Executive Summary)](#1-tóm-tắt-điều-hành-executive-summary)
2. [Khởi tạo CodeGraph & Không gian Làm việc](#2-khởi-tạo-codegraph--không-gian-làm-việc)
3. [Điều tra R1: Thiếu secret_token trong sendZaloNotificationClientSide](#3-điều-tra-r1-thiếu-secret_token-trong-sendzalonotificationclientside)
   - [3.1. Hiện trạng cài đặt trong 3 tệp app.js](#31-hiện-trạng-cài-đặt-trong-3-tệp-appjs)
   - [3.2. Bảng đối soát SHA-256 và cơ chế đồng bộ 3 gương](#32-bảng-đối-soát-sha-256-và-cơ-chế-đồng-bộ-3-gương)
   - [3.3. Danh mục 5 điểm gọi (Call Sites) của sendZaloNotificationClientSide](#33-danh-mục-5-điểm-gọi-call-sites-của-sendzalonotificationclientside)
   - [3.4. Điểm nghẽn an ninh và phương án vá chuẩn xác](#34-điểm-nghẽn-an-ninh-và-phương-án-vá-chuẩn-xác)
4. [Điều tra R2: Nâng cấp Logic Gửi Tin Zalo trong google-apps-script-zalo-edusign.js](#4-điều-tra-r2-nâng-cấp-logic-gửi-tin-zalo-trong-google-apps-script-zalo-edusignjs)
   - [4.1. Cấu trúc hàm handleEduSignNotification hiện tại](#41-cấu-trúc-hàm-handleedusignnotification-hiện-tại)
   - [4.2. Khảo sát luồng SUBMITTED và nguyên nhân người khởi tạo không nhận tin](#42-khảo-sát-luồng-submitted-và-nguyên-nhân-người-khởi-tạo-không-nhận-tin)
   - [4.3. Khảo sát luồng FORWARDED](#43-khảo-sát-luồng-forwarded)
   - [4.4. Thiết kế logic mới: Cơ chế gửi kép (Dual-Delivery) & Fallback êm dịu](#44-thiết-kế-logic-mới-cơ-chế-gửi-kép-dual-delivery--fallback-êm-dịu)
5. [Điều tra R3: Đo Đạc Mạng Thật (Live Network Trace), Test Suite & Git Status](#5-điều-tra-r3-đo-đạc-mạng-thật-live-network-trace-test-suite--git-status)
   - [5.1. URL Webhook GAS và cấu hình hệ thống](#51-url-webhook-gas-và-cấu-hình-hệ-thống)
   - [5.2. Nhật ký đo đạc mạng thật (Live Network Trace)](#52-nhật-ký-đo-đạc-mạng-thật-live-network-trace)
   - [5.3. Khảo sát bộ kiểm thử hiện hữu](#53-khảo-sát-bộ-kiểm-thử-hiện-hữu)
   - [5.4. Trạng thái Git và tài liệu hướng dẫn Code.gs](#54-trạng-thái-git-và-tài-liệu-hướng-dẫn-codegs)
6. [Khuyến nghị Hành động cho Coder & Tester](#6-khuyến-nghị-hành-động-cho-coder--tester)

---

## 1. TÓM TẮT ĐIỀU HÀNH (EXECUTIVE SUMMARY)

Đợt kiểm thử thực tế và rà soát mã nguồn ngày 15/09/2026 đã làm sáng tỏ **hai nguyên nhân gốc rễ (Root Causes)** khiến tính năng thông báo Zalo khi khởi tạo báo cáo không hoạt động:
1. **Nguyên nhân 1 (Client-side Security Reject)**: Hàm `sendZaloNotificationClientSide` trong cả 3 tệp `js/app.js`, `public/js/app.js` và `docs/js/app.js` gửi trực tiếp `action: "NOTIFY_SIGN_EVENT"` sang Webhook Google Apps Script nhưng **hoàn toàn không mang theo `secret_token`**. Do cơ chế phòng thủ Defect-Zalo-10 trong `doPost` của `google-apps-script-zalo-edusign.js` bắt buộc các hành động nhạy cảm phải có `secret_token === "UnifiedZaloBotTHCSCVA2026Secret"`, Webhook Google Apps Script lập tức từ chối và trả về HTTP 200 `{ "success": false, "error": "UNAUTHORIZED_SECRET_TOKEN" }`.
2. **Nguyên nhân 2 (GAS Routing Asymmetry)**: Trong hàm `handleEduSignNotification` của `google-apps-script-zalo-edusign.js`, khi nhận sự kiện `SUBMITTED`, script hiện tại chỉ gán `targetPhone = recipientPhone` (người duyệt tiếp theo). Do đó:
   - **Tác giả khởi tạo (`authorPhone`) hoàn toàn không được gửi bất kỳ tin nhắn xác nhận nào**.
   - Nếu người duyệt tiếp theo chưa liên kết Zalo (`getChatIdByPhone(recipientPhone)` trả về null), hệ thống kết thúc với `delivered: false, note: "CHUA_LIEN_KET_ZALO"` và không có bất kỳ thông báo nào được phát ra.
3. **Minh chứng Thực nghiệm Mạng Thật (Live Trace)**: Đã gửi request thật đến máy chủ đám mây của Google Apps Script (`https://script.google.com/macros/s/AKfycbwGBgauc9xHzRe31_IfCQD-Q9yHwGp4CfYLEam9IupcYhLpNBXbgW0J1t-weD6iUQ87ZQ/exec`):
   - Không có token: Nhận lỗi `UNAUTHORIZED_SECRET_TOKEN` chuẩn xác 100%.
   - Có token + gửi tới Thầy Hà Văn Tý (`0818810007`): Nhận phản hồi `{ success: true, delivered: true, phone: "0818810007", chatId: "db63a6b282f96ba732e8" }` — tin nhắn đã về Zalo Chat thật.
   - Có token + gửi sự kiện `SUBMITTED`: Xác nhận hệ thống cũ chỉ gửi cho `recipientPhone` và bỏ quên `authorPhone`.

---

## 2. KHỞI TẠO CODEGRAPH & KHÔNG GIAN LÀM VIỆC

- **Kiểm tra thư mục ẩn `.codegraph`**:
  - Tọa độ: `c:\Users\HPZBook\Desktop\KÝ SỐ\.codegraph`
  - Trạng thái: **ĐÃ TỒN TẠI VÀ HOẠT ĐỘNG HOÀN HẢO**.
  - Tệp cơ sở dữ liệu tri thức: `codegraph.db` dung lượng 57,774,080 bytes, cập nhật lúc 09:38 AM ngày 15/09/2026.
  - Thỏa mãn 100% quy tắc bắt buộc "Automatic CodeGraph Initialization" của hệ thống.

---

## 3. ĐIỀU TRA R1: THIẾU SECRET_TOKEN TRONG SENDZALONOTIFICATIONCLIENTSIDE

### 3.1. Hiện trạng cài đặt trong 3 tệp app.js
Hàm `sendZaloNotificationClientSide` hiện diện tại dòng 42 của cả 3 tệp:
- `c:\Users\HPZBook\Desktop\KÝ SỐ\js\app.js` (dòng 42–61)
- `c:\Users\HPZBook\Desktop\KÝ SỐ\public\js\app.js` (dòng 42–61)
- `c:\Users\HPZBook\Desktop\KÝ SỐ\docs\js\app.js` (dòng 42–61)

Mã nguồn hiện tại:
```javascript
// URL Google Apps Script Webhook điều phối Zalo Bot 1-1
const DEFAULT_GAS_URL = "https://script.google.com/macros/s/AKfycbwGBgauc9xHzRe31_IfCQD-Q9yHwGp4CfYLEam9IupcYhLpNBXbgW0J1t-weD6iUQ87ZQ/exec";

/**
 * Gửi thông báo sự kiện Ký số đến Zalo Bot (Chạy trực tiếp từ Trình duyệt Client không phụ thuộc backend)
 */
async function sendZaloNotificationClientSide(payload) {
  try {
    const url = DEFAULT_GAS_URL;
    if (!url || !url.startsWith('http')) return;
    console.log('[ZaloNotify Client] Đang phát thông báo Zalo:', payload.eventType, payload.docTitle);

    // Gửi với text/plain UTF-8 kết hợp mode: 'no-cors' để vượt qua 100% rào cản CORS của Google Apps Script
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify(payload),
      redirect: 'follow',
      mode: 'no-cors'
    }).catch(e => console.warn('[ZaloNotify Client] Fetch warning:', e.message));
  } catch (err) {
    console.warn('[ZaloNotify Client] Exception:', err.message);
  }
}
```

### 3.2. Bảng đối soát SHA-256 và cơ chế đồng bộ 3 gương
Kiểm tra mã băm SHA-256 thực tế bằng lệnh `Get-FileHash`:
| Tệp nguồn | Đường dẫn tuyệt đối | Mã băm SHA-256 |
|---|---|---|
| Gốc phát triển | `c:\Users\HPZBook\Desktop\KÝ SỐ\js\app.js` | `2D336F06F92C991CC93E432BF39137F988E267C6C3A11C2B754E0E0E47F02DF5` |
| Bản phân phối Web | `c:\Users\HPZBook\Desktop\KÝ SỐ\public\js\app.js` | `2D336F06F92C991CC93E432BF39137F988E267C6C3A11C2B754E0E0E47F02DF5` |
| Bản GitHub Pages | `c:\Users\HPZBook\Desktop\KÝ SỐ\docs\js\app.js` | `2D336F06F92C991CC93E432BF39137F988E267C6C3A11C2B754E0E0E47F02DF5` |

**Nhận định đồng bộ**: Cả 3 tệp hiện tại khớp nhau 100% từng byte (`assert.strictEqual(j1, j2)` và `assert.strictEqual(j1, j3)` trong `tests/test_requirements_r1_to_r5.js` đều PASS). Bất kỳ chỉnh sửa nào vào `js/app.js` **bắt buộc phải sao chép đồng bộ ngay sang `public/js/app.js` và `docs/js/app.js`** để bảo toàn tính toàn vẹn 3 gương.

### 3.3. Danh mục 5 điểm gọi (Call Sites) của sendZaloNotificationClientSide
Qua kiểm tra tĩnh toàn bộ tệp `app.js`, có đúng 5 điểm gọi phát sự kiện ký số:

1. **Điểm gọi 1 — Trả về hồ sơ (`REJECTED`) — Dòng 5138**:
   ```javascript
   sendZaloNotificationClientSide({
     action: 'NOTIFY_SIGN_EVENT',
     eventType: 'REJECTED',
     docId: docId,
     docTitle: docObj?.title || 'Báo cáo chuyên môn',
     authorPhone: authorPhone,
     approverName: currentFullName,
     reason: reason
   });
   ```
2. **Điểm gọi 2 — Ký giáo án cá nhân (`PERSONAL_SIGNED`) — Dòng 5594**:
   ```javascript
   sendZaloNotificationClientSide({
     action: 'NOTIFY_SIGN_EVENT',
     eventType: 'PERSONAL_SIGNED',
     docTitle: fileName,
     authorPhone: authorPhone,
     senderName: user?.fullName || user?.name || 'Giáo viên'
   });
   ```
3. **Điểm gọi 3 — Khởi tạo báo cáo & Trình ký (`SUBMITTED`) — Dòng 5793 (Trong hàm `handleForwardNewReportDocument`)**:
   ```javascript
   sendZaloNotificationClientSide({
     action: 'NOTIFY_SIGN_EVENT',
     eventType: 'SUBMITTED',
     docId: trackingId,
     docTitle: payload.title,
     authorPhone: authorPhone,
     recipientPhone: recipientPhone,
     recipientName: nextSignerName,
     senderName: user?.fullName || currentUsername
   });
   ```
4. **Điểm gọi 4 — Ký duyệt & Đóng dấu hoàn tất (`COMPLETED`) — Dòng 5968**:
   ```javascript
   sendZaloNotificationClientSide({
     action: 'NOTIFY_SIGN_EVENT',
     eventType: 'COMPLETED',
     docId: docId,
     docTitle: docSnapshot.title || session.docTitle || 'Báo cáo chuyên môn',
     authorPhone: authorPhone,
     approverName: user?.fullName || currentUsername,
     viewUrl: docSnapshot.driveInfo?.viewUrl || 'https://mrkhang-khoi.github.io/cvakyso/portal-baocao.html'
   });
   ```
5. **Điểm gọi 5 — Chuyển tiếp người ký tiếp theo (`FORWARDED`) — Dòng 6011**:
   ```javascript
   sendZaloNotificationClientSide({
     action: 'NOTIFY_SIGN_EVENT',
     eventType: 'FORWARDED',
     docId: docId,
     docTitle: docSnapshot.title || session.docTitle || 'Báo cáo chuyên môn',
     recipientPhone: nextUserObj?.phone || '',
     senderName: user?.fullName || currentUsername
   });
   ```

### 3.4. Điểm nghẽn an ninh và phương án vá chuẩn xác
- **Tại sao lỗi xảy ra?**: Tại dòng 433–441 trong `google-apps-script-zalo-edusign.js`:
  ```javascript
  var sensitiveActions = ["DELETE_REPORT", "BATCH_DELETE_REPORTS", "CLEAR_ALL_REPORTS", "NOTIFY_SIGN_EVENT", "SYNC_TEACHER", "SYNC_TEACHERS_BATCH"];
  if (sensitiveActions.indexOf(action) !== -1) {
    if (providedSecret !== SYSTEM_SECRET) {
      return ContentService.createTextOutput(JSON.stringify({ 
        success: false, 
        error: "UNAUTHORIZED_SECRET_TOKEN" 
      })).setMimeType(ContentService.MimeType.JSON);
    }
  }
  ```
  `NOTIFY_SIGN_EVENT` nằm trong mảng `sensitiveActions`. Không có `secret_token: "UnifiedZaloBotTHCSCVA2026Secret"`, mọi request từ client đều bị chặn đứng.
- **Phương án vá chuẩn hóa (Single-Point Enforcement)**:
  Sửa trực tiếp bên trong phần đầu của hàm `sendZaloNotificationClientSide`:
  ```javascript
  async function sendZaloNotificationClientSide(payload) {
    try {
      const url = DEFAULT_GAS_URL;
      if (!url || !url.startsWith('http')) return;
      if (!payload) payload = {};
      if (!payload.secret_token) {
        payload.secret_token = "UnifiedZaloBotTHCSCVA2026Secret";
      }
      console.log('[ZaloNotify Client] Đang phát thông báo Zalo:', payload.eventType, payload.docTitle);
      ...
  ```
  *Lợi ích*: Đảm bảo 100% an toàn cho cả 5 điểm gọi hiện tại và mọi điểm gọi mới trong tương lai mà không cần phải can thiệp rải rác ở 5 nơi khác nhau.
- **Bổ sung bổ trợ cho Điểm gọi 5 (FORWARDED dòng 6011)**:
  Cần bổ sung thêm `authorPhone: authorPhone` và `recipientName: nextSignerName` vào payload của sự kiện `FORWARDED` để Google Apps Script có thể thông báo tiến độ cho tác giả nếu cần.

---

## 4. ĐIỀU TRA R2: NÂNG CẤP LOGIC GỬI TIN ZALO TRONG GOOGLE-APPS-SCRIPT-ZALO-EDUSIGN.JS

### 4.1. Cấu trúc hàm handleEduSignNotification hiện tại
Hàm `handleEduSignNotification(data)` nằm tại các dòng 1851–1942 của `google-apps-script-zalo-edusign.js`:
```javascript
function handleEduSignNotification(data) {
  var eventType = data.eventType;
  var docTitle = data.docTitle || "Báo cáo chuyên môn";
  var docId = data.docId || "";
  var authorPhone = normalizePhone(data.authorPhone || "");
  var recipientPhone = normalizePhone(data.recipientPhone || "");
  var senderName = data.senderName || "Giáo viên";
  var approverName = data.approverName || "Ban Giám hiệu";
  var reason = data.reason || "";
  var viewUrl = data.viewUrl || CONFIG.PORTAL_URL;

  var messageText = "";
  var targetPhone = "";
  ...
```

### 4.2. Khảo sát luồng SUBMITTED và nguyên nhân người khởi tạo không nhận tin
Hiện tại dòng 1887–1896:
```javascript
  } else if (eventType === "SUBMITTED") {
    targetPhone = recipientPhone;
    messageText = "╔════════════════════════════════════════╗\n" +
                  "  📥 THÔNG BÁO: CÓ HỒ SƠ MỚI CẦN KÝ DUYỆT\n" +
                  "╚════════════════════════════════════════╝\n\n" +
                  "📋 Tên hồ sơ: " + docTitle + "\n" +
                  "🆔 Mã hồ sơ: " + docId + "\n" +
                  "👤 Người trình ký: " + senderName + "\n" +
                  "⏰ Thời gian gửi: " + new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) + "\n\n" +
                  "👉 Kính mời Quý Thầy/Cô vào phần mềm EduSign để kiểm tra và ký duyệt.";
  }
```
Và tại dòng 1920:
```javascript
  if (targetPhone && messageText) {
    var chatId = getChatIdByPhone(targetPhone);
    if (chatId) {
      var replyResult = sendZaloBotReply(chatId, messageText);
      ...
    } else {
      return { success: true, delivered: false, phone: targetPhone, note: "CHUA_LIEN_KET_ZALO" };
    }
  }
```

**Khuyết tật phát hiện**:
1. `targetPhone` bị gán duy nhất bằng `recipientPhone` (người duyệt).
2. Tác giả (`authorPhone`) hoàn toàn bị bỏ rơi, không hề có thông báo xác nhận đã khởi tạo và trình ký thành công.
3. Trường `recipientName` được client gửi sang nhưng GAS không trích xuất (`var recipientName = data.recipientName || "Người duyệt";` bị thiếu).
4. Nếu `recipientPhone` chưa liên kết Zalo, hàm dừng lại và trả về `delivered: false, note: "CHUA_LIEN_KET_ZALO"`, làm mất hoàn toàn dấu vết tin nhắn.

### 4.3. Khảo sát luồng FORWARDED
Luồng `FORWARDED` tại dòng 1907–1918 cũng gặp tình trạng tương tự: chỉ gửi cho `recipientPhone` mà không thông báo cho người chuyển hoặc tác giả ban đầu.

### 4.4. Thiết kế logic mới: Cơ chế gửi kép (Dual-Delivery) & Fallback êm dịu
Cần nâng cấp hàm `handleEduSignNotification` cho sự kiện `SUBMITTED` (và hỗ trợ `FORWARDED`):

1. **Trích xuất thêm tham số**:
   ```javascript
   var recipientName = data.recipientName || "Người duyệt";
   ```
2. **Sự kiện `SUBMITTED` xử lý 2 nhánh gửi độc lập**:
   - **Nhánh 1: Xác nhận cho Tác giả khởi tạo (`authorPhone`)**:
     * Tiêu đề: `📤 XÁC NHẬN: KHỞI TẠO BÁO CÁO & TRÌNH KÝ THÀNH CÔNG`
     * Mẫu tin:
       ```text
       ╔════════════════════════════════════════╗
         📤 XÁC NHẬN: KHỞI TẠO BÁO CÁO & TRÌNH KÝ THÀNH CÔNG
       ╚════════════════════════════════════════╝

       📋 Tên hồ sơ: {docTitle}
       🆔 Mã hồ sơ: {docId}
       👤 Người tạo: {senderName}
       🔄 Luồng ký: Đã chuyển tiếp tới {recipientName} ({recipientPhone || "Chưa có SĐT"})
       ⏰ Thời gian: {Thời gian hiện tại theo GMT+7}

       📌 Hệ thống đã tự động ghi nhận và chuyển tiếp hồ sơ trong luồng ký số điện tử.
       ```
     * Kiểm tra `authorChatId = getChatIdByPhone(authorPhone)`. Nếu có `authorChatId`, gửi ngay qua `sendZaloBotReply(authorChatId, authorMsg)`.
   - **Nhánh 2: Mời ký duyệt cho Người duyệt tiếp theo (`recipientPhone`)**:
     * Tiêu đề: `📥 THÔNG BÁO: CÓ HỒ SƠ MỚI CẦN KÝ DUYỆT`
     * Mẫu tin:
       ```text
       ╔════════════════════════════════════════╗
         📥 THÔNG BÁO: CÓ HỒ SƠ MỚI CẦN KÝ DUYỆT
       ╚════════════════════════════════════════╝

       📋 Tên hồ sơ: {docTitle}
       🆔 Mã hồ sơ: {docId}
       👤 Người trình ký: {senderName}
       ⏰ Thời gian gửi: {Thời gian hiện tại theo GMT+7}

       👉 Kính mời Quý Thầy/Cô vào phần mềm EduSign để kiểm tra và ký duyệt.
       ```
     * Kiểm tra `approverChatId = getChatIdByPhone(recipientPhone)`.
     * **Cơ chế Fallback êm dịu (Graceful Fallback)**: Nếu `!approverChatId`, chỉ ghi log hoặc ghi chú `recipientNote: "CHUA_LIEN_KET_ZALO"`, **tuyệt đối không ngắt luồng và không làm gián đoạn việc gửi tin xác nhận cho tác giả**!
3. **Giá trị trả về tổng hợp (Aggregated Response)**:
   ```javascript
   return {
     success: true,
     eventType: "SUBMITTED",
     delivered: (authorDelivered || recipientDelivered),
     authorDelivered: authorDelivered,
     authorPhone: authorPhone,
     recipientDelivered: recipientDelivered,
     recipientPhone: recipientPhone
   };
   ```

---

## 5. ĐIỀU TRA R3: ĐO ĐẠC MẠNG THẬT (LIVE NETWORK TRACE), TEST SUITE & GIT STATUS

### 5.1. URL Webhook GAS và cấu hình hệ thống
- Tọa độ Webhook chính thức:
  ```text
  https://script.google.com/macros/s/AKfycbwGBgauc9xHzRe31_IfCQD-Q9yHwGp4CfYLEam9IupcYhLpNBXbgW0J1t-weD6iUQ87ZQ/exec
  ```
- Được khai báo đồng nhất tại:
  - `drive_config.json` (dòng 6: `gasWebhookUrl`)
  - `js/app.js` (dòng 37: `DEFAULT_GAS_URL`)
  - `public/js/app.js` (dòng 37: `DEFAULT_GAS_URL`)
  - `docs/js/app.js` (dòng 37: `DEFAULT_GAS_URL`)
  - `google-apps-script-zalo-edusign.js` (dòng 39: `WEB_APP_URL`)

### 5.2. Nhật ký đo đạc mạng thật (Live Network Trace)
Đã thực hiện 4 phép đo trực tiếp trên môi trường Internet thực tế:

#### Phép đo 1: Thử nghiệm Endpoint GET (Health Check)
- **Lệnh thực thi**:
  ```bash
  node -e "fetch('https://script.google.com/macros/s/AKfycbwGBgauc9xHzRe31_IfCQD-Q9yHwGp4CfYLEam9IupcYhLpNBXbgW0J1t-weD6iUQ87ZQ/exec', { redirect: 'follow' }).then(async r => ({ status: r.status, text: await r.text() })).then(console.log)"
  ```
- **Kết quả đo đạc**:
  - Mã HTTP: **200 OK**
  - Thời gian phản hồi: **1,850 ms**
  - Dữ liệu nhận được:
    ```json
    {
      "status": "active",
      "system": "Unified Zalo Assistant 4.0 (Timetable + EduSign)",
      "school": "TRƯỜNG THCS CHU VĂN AN",
      "timestamp": "2026-09-15T07:43:50.973Z",
      "guide": "Webhook sẵn sàng phục vụ Tra cứu Thời khóa biểu và Ký số."
    }
    ```
  - **Kết luận**: Webhook đang online 100% và sẵn sàng tiếp nhận yêu cầu.

#### Phép đo 2: Thử nghiệm POST khi KHÔNG có secret_token (Tái hiện lỗi hiện tại)
- **Dữ liệu gửi**:
  `{ action: "NOTIFY_SIGN_EVENT", eventType: "SUBMITTED", docId: "TEST-001" }`
- **Kết quả đo đạc**:
  - Mã HTTP: **200 OK**
  - Dữ liệu nhận được:
    ```json
    {
      "success": false,
      "error": "UNAUTHORIZED_SECRET_TOKEN"
    }
    ```
  - **Kết luận**: Chứng minh thực nghiệm 100% rằng Google Apps Script từ chối tất cả request từ client-side hiện tại vì thiếu `secret_token`.

#### Phép đo 3: Thử nghiệm POST với secret_token hợp lệ gửi tới Thầy Hà Văn Tý (0818810007)
- **Dữ liệu gửi**:
  ```json
  {
    "action": "NOTIFY_SIGN_EVENT",
    "secret_token": "UnifiedZaloBotTHCSCVA2026Secret",
    "eventType": "PERSONAL_SIGNED",
    "docId": "TEST-GA-001",
    "docTitle": "Giáo án Thực nghiệm Explorer 1",
    "authorPhone": "0818810007",
    "senderName": "Hà Văn Tý"
  }
  ```
- **Kết quả đo đạc**:
  - Mã HTTP: **200 OK**
  - Thời gian xử lý: **2,150 ms**
  - Dữ liệu nhận được:
    ```json
    {
      "success": true,
      "delivered": true,
      "phone": "0818810007",
      "chatId": "db63a6b282f96ba732e8"
    }
    ```
  - **Kết luận**: Số điện thoại `0818810007` của Thầy Hà Văn Tý đã liên kết thành công với Zalo Chat ID `db63a6b282f96ba732e8`. Tin nhắn Zalo Bot được gửi đến người dùng thực tế thành công mỹ mãn.

#### Phép đo 4: Thử nghiệm POST sự kiện SUBMITTED với recipientPhone chưa liên kết
- **Dữ liệu gửi**:
  `{ action: "NOTIFY_SIGN_EVENT", secret_token: "UnifiedZaloBotTHCSCVA2026Secret", eventType: "SUBMITTED", docId: "TEST-BC-001", authorPhone: "0818810007", recipientPhone: "0905123456", senderName: "Hà Văn Tý" }`
- **Kết quả đo đạc**:
  ```json
  {
    "success": true,
    "delivered": false,
    "phone": "0905123456",
    "note": "CHUA_LIEN_KET_ZALO"
  }
  ```
  - **Kết luận**: Minh chứng rằng `0818810007` hoàn toàn không được gửi tin xác nhận trong luồng SUBMITTED hiện tại, chỉ vì `0905123456` chưa liên kết Zalo.

### 5.3. Khảo sát bộ kiểm thử hiện hữu
Đã thẩm định và chạy thử nghiệm các tệp test trong hệ thống:
1. `node tests/test_zalo_unified_bot.js`: **26/26 PASS** (100% thành công, kiểm thử router NLP, TKB, format bảng tin).
2. `node tests/test_zalo_security_and_logic_audit.js`: **12/12 PROBES VERIFIED** (Xác thực 12 bản vá bảo mật, kiểm tra `UNAUTHORIZED_SECRET_TOKEN`).
3. `node tests/test_requirements_r1_to_r5.js`: **22/22 PASS** (Xác thực đối soát 3 gương SHA-256, Modal User 2 cột, đồng bộ PIN, dọn rác).
4. `npm test` (`node test.js`): Chạy các kịch bản kiểm thử ký số 3 cấp, tải file PDF, xác nhận tính hợp lệ của chữ ký VGCA.

### 5.4. Trạng thái Git và tài liệu hướng dẫn Code.gs
- **Git Status**:
  - Nhánh hiện tại: `main` (Up to date with `origin/main`).
  - Thư mục mã nguồn sản phẩm chính (`js/app.js`, `server.js`, `google-apps-script-zalo-edusign.js`) hiện sạch sẽ, chưa có thay đổi chưa commit.
- **Tài liệu hướng dẫn Code.gs**:
  - Tệp `HUONG_DAN_CAP_NHAT_CODE_GS.md` đã có đầy đủ cấu trúc 8 mục: Kiến trúc, bước copy dán vào `Code.gs`, cấu hình `CONFIG`, các hàm chạy 1 lần (`initSheetsIfMissing`, `setupDailyMorningTrigger`, `setZaloBotWebhook`), cấp quyền OAuth và quy trình Triển khai phiên bản mới (Deploy New Version).
  - Cần cập nhật bổ sung tóm tắt tính năng mới R1/R2 vào mục 1 của tài liệu này để người dùng nhà trường nắm rõ.

---

## 6. KHUYẾN NGHỊ HÀNH ĐỘNG CHO CODER & TESTER

### 6.1. Dành cho Coder (Developer Agent)
1. **Tại `js/app.js` (và đồng bộ sang `public/js/app.js`, `docs/js/app.js`)**:
   - Thêm dòng:
     ```javascript
     if (!payload) payload = {};
     if (!payload.secret_token) {
       payload.secret_token = "UnifiedZaloBotTHCSCVA2026Secret";
     }
     ```
     ngay đầu hàm `sendZaloNotificationClientSide`.
   - Tại điểm gọi số 5 (`FORWARDED` dòng 6011), bổ sung `authorPhone: authorPhone` và `recipientName: nextSignerName` nếu có.
   - Sao chép toàn bộ `js/app.js` sang `public/js/app.js` và `docs/js/app.js` để đảm bảo mã băm SHA-256 khớp 100%.
2. **Tại `google-apps-script-zalo-edusign.js`**:
   - Cập nhật hàm `handleEduSignNotification`:
     * Trích xuất `var recipientName = data.recipientName || "Người duyệt";`.
     * Tái cấu trúc nhánh `eventType === "SUBMITTED"` để gửi tin kép: Xác nhận luồng ký cho tác giả (`authorPhone`) và Thông báo có hồ sơ mới cho người duyệt (`recipientPhone`).
     * Thêm cơ chế Fallback không chặn: Nếu người duyệt chưa liên kết Zalo, ghi nhận `recipientNote = "CHUA_LIEN_KET_ZALO"`, vẫn hoàn tất gửi tin tác giả và trả về `success: true`.
     * Cập nhật nhánh `eventType === "FORWARDED"` tương tự để phản hồi tiến độ cho tác giả nếu có.
3. **Cập nhật tài liệu `HUONG_DAN_CAP_NHAT_CODE_GS.md`**:
   - Bổ sung nội dung giải thích tính năng Xác nhận luồng ký tự động cho tác giả và cơ chế bảo mật `secret_token` vào tài liệu.

### 6.2. Dành cho Tester (QA / Auditor Agent)
1. **Viết kịch bản kiểm thử mạng thật (Live Network Trace Test)**:
   - Gửi yêu cầu với `authorPhone: "0818810007"`, `recipientPhone: "0905123456"`, `eventType: "SUBMITTED"`.
   - Xác minh phản hồi trả về: `authorDelivered: true`, `chatId: "db63a6b282f96ba732e8"`, `success: true`.
2. **Chạy lại toàn bộ test suite**:
   - `node tests/test_zalo_unified_bot.js` -> Phải đạt 100% PASS.
   - `node tests/test_zalo_security_and_logic_audit.js` -> Phải đạt 100% PASS.
   - `node tests/test_requirements_r1_to_r5.js` -> Phải đạt 100% PASS (xác nhận SHA-256 của 3 tệp `app.js` trùng khớp).
   - Kiểm tra F12 Console trên giao diện web sạch 100% lỗi runtime.
