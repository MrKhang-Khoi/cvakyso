# BÁO CÁO ĐỐI SOÁT & KIỂM ĐỊNH CHUYÊN SÂU LOGIC, BẢO MẬT & KIẾN TRÚC TÍCH HỢP ZALO CHAT
## HỆ THỐNG QUẢN LÝ & KÝ SỐ HỒ SƠ GIÁO ÁN EDUSIGN VGCA — TRƯỜNG THCS CHU VĂN AN

---

**Thời gian lập:** 2026-09-15 07:22:00 (UTC+7)  
**Đơn vị thực hiện:** Zalo Logic & Security Audit Specialist (`explorer_zalo`)  
**Phương pháp kiểm định:** Multi-Agent Supervision, Static Code Trace (V8 AST), và Empirical Probe Harness (`test_zalo_logic_audit.js`).  
**Trạng thái tuân thủ:** READ-ONLY Explorer (Không sửa đổi bất kỳ tệp mã nguồn chính nào của hệ thống).

---

## MỤC LỤC TỔNG QUAN
1. [TỔNG QUAN KIẾN TRÚC HỆ THỐNG ZALO BOT & NOTIFY HIỆN HÀNH](#1-tổng-quan-kiến-trúc-hệ-thống-zalo-bot--notify-hiện-hành)
2. [PHẦN I: THẨM ĐỊNH HỆ THỐNG THÔNG BÁO TỰ ĐỘNG 1 CHIỀU (ZALO NOTIFY)](#phần-i-thẩm-định-hệ-thống-thông-báo-tự-động-1-chiều-zalo-notify)
   - 1.1 Phân tích các luồng kích hoạt sự kiện (Event Triggers)
   - 1.2 Phân tích hàm vận chuyển `sendWebhookPost` / `sendZaloNotificationClientSide`
   - 1.3 Đối soát vòng đời Token: Zalo OA API v3 OAuth vs. Zalo Bot Platform
3. [PHẦN II: THẨM ĐỊNH CHATBOT TƯƠNG TÁC 2 CHIỀU (ZALO INTERACTIVE BOT)](#phần-ii-thẩm-định-chatbot-tương-tác-2-chiều-zalo-interactive-bot)
   - 2.1 Cổng tiếp nhận Webhook & Rủi ro thiếu xác thực chữ ký Webhook Secret
   - 2.2 Bộ phân tích cú pháp lệnh (Command Parser) & Các lỗ hổng tra cứu
   - 2.3 Cơ chế phân quyền, kiểm soát truy cập (Access Control) & Lỗ hổng Chiếm quyền (Account Takeover)
4. [PHẦN III: LỖ HỔNG AN TOÀN THÔNG TIN & RỦI RO QUYỀN RIÊNG TƯ (DATA PRIVACY)](#phần-iii-lỗ-hổng-an-toàn-thông-tin--rủi-ro-quyền-riêng-tư-data-privacy)
   - 3.1 Nguy cơ lộ lọt dữ liệu định danh cá nhân (PII: SĐT, CCCD, mật khẩu, chữ ký)
   - 3.2 Lộ lọt tài liệu & Dấu đỏ điện tử không qua xác thực (`/uploads`)
   - 3.3 Xử lý ngoại lệ mạng & giới hạn tần suất (Rate Limiting)
5. [DANH MỤC BẢN GHI KHUYẾT TẬT CHI TIẾT (STRUCTURED DEFECT RECORDS)](#danh-mục-bản-ghi-khuyết-tật-chi-tiết-structured-defect-records)
   - DEFECT-ZALO-01: Rơi rụng thông báo chuyển tiếp (`FORWARDED`)
   - DEFECT-ZALO-02: Thiếu bộ bóc tách mã hồ sơ (`KHBD-...`, `BC-...`)
   - DEFECT-ZALO-03: Thiếu tính năng tra cứu danh sách chờ duyệt (`choduyet`, `pending`)
   - DEFECT-ZALO-04: Chiếm đoạt tài khoản giáo viên qua ánh xạ SĐT không xác thực OTP
   - DEFECT-ZALO-05: Tổ trưởng duyệt không gửi Zalo cho Ban Giám hiệu (`approve-leader`)
   - DEFECT-ZALO-06: Ban Giám hiệu đóng dấu không gửi Zalo kèm link tải cho Giáo viên (`approve-principal`)
   - DEFECT-ZALO-07: Xung đột tuyến trùng lặp (Duplicate Route) tại `/api/documents/:id/reject`
   - DEFECT-ZALO-08: Bắn tin lặp kép do Dual-Dispatch giữa Client (`app.js`) và Server (`server.js`)
   - DEFECT-ZALO-09: Thư mục `/uploads` tĩnh công khai để lộ Con dấu trường và Ảnh chữ ký
   - DEFECT-ZALO-10: Webhook Google Apps Script không kiểm tra `secret_token` cho phép xóa sạch dữ liệu
   - DEFECT-ZALO-11: Lệch pha chuẩn Zalo OA v3 (Không có cơ chế xoay vòng Refresh Token OAuth 2.0)
   - DEFECT-ZALO-12: Mù lỗi HTTP khi gọi Zalo Bot API (`muteHttpExceptions: true`)
6. [ĐỀ XUẤT NÂNG CẤP & MẪU CODE CHUẨN HÓA ĐỂ TRÌNH DUYỆT](#đề-xuất-nâng-cấp--mẫu-code-chuẩn-hóa-để-trình-duyệt)

---

## 1. TỔNG QUAN KIẾN TRÚC HỆ THỐNG ZALO BOT & NOTIFY HIỆN HÀNH

Hệ thống điều phối tin nhắn Zalo của nền tảng EduSign VGCA tại trường THCS Chu Văn An được xây dựng theo mô hình lai (Hybrid Multi-Hop):
1. **Lớp Trình duyệt (Frontend Client - `js/app.js`):** Phát trực tiếp thông báo sự kiện Ký số đến Google Apps Script Webhook thông qua hàm `sendZaloNotificationClientSide` sử dụng chế độ `fetch(url, { mode: 'no-cors' })`.
2. **Lớp Máy chủ Ứng dụng (Node.js Express - `server.js` & `zaloNotifyService.js`):** Nhận các lệnh REST API (`/api/documents/...`), ghi dữ liệu vào `dataStore.js`, sau đó gọi `sendWebhookPost` gửi payload JSON sang Google Apps Script.
3. **Lớp Điều phối Trung gian (Google Apps Script - `google-apps-script-zalo-edusign.js`):** Tiếp nhận Webhook qua hàm `doPost(e)`, lưu trữ vào Google Sheets (`EduSign_DuLieu_KYS_THCS_ChuVanAn`), tra cứu SĐT giáo viên trong Sheet `Danh bạ GV` để lấy `Zalo_Chat_ID`, rồi phát tin nhắn qua API Zalo Bot Platform (`https://bot-api.zaloplatforms.com/bot<token>/sendMessage`).
4. **Lớp Tương tác 2 Chiều (Zalo Bot Webhook):** Giáo viên gửi tin nhắn tương tác trên Zalo $\rightarrow$ Zalo Bot Platform gửi Webhook về `doPost(e)` của Google Apps Script $\rightarrow$ Hàm `processUnifiedZaloMessage` phân tích cú pháp và phản hồi.

---

## PHẦN I: THẨM ĐỊNH HỆ THỐNG THÔNG BÁO TỰ ĐỘNG 1 CHIỀU (ZALO NOTIFY)

### 1.1 Phân tích các luồng kích hoạt sự kiện (Event Triggers)

Theo quy trình ký duyệt giáo án và văn bản chuẩn tại THCS Chu Văn An, có 4 mốc sự kiện cốt lõi:
1. **Giáo viên nộp bài $\rightarrow$ Báo Tổ trưởng chuyên môn.**
2. **Tổ trưởng phê duyệt chuyên môn $\rightarrow$ Báo Ban Giám hiệu.**
3. **Ban Giám hiệu ký số & đóng dấu mộc đỏ $\rightarrow$ Báo Giáo viên kèm liên kết tải tệp PDF đã ký.**
4. **Ban Giám hiệu / Tổ trưởng từ chối $\rightarrow$ Báo Giáo viên kèm lý do trả về.**

Qua quá trình rà soát mã nguồn thực tế trên `server.js` và `zaloNotifyService.js`, các phát hiện nghiêm trọng được ghi nhận như sau:

| Sự kiện nghiệp vụ | Tuyến API xử lý trong `server.js` | Trạng thái gửi Web Push | Trạng thái gửi Zalo Notify | Đánh giá sai sót Logic |
|---|---|---|---|---|
| **Giáo viên nộp bài** | `POST /api/documents` (dòng 2550) | Có (dòng 2838) | **Chỉ gửi khi `docCategory === 'REPORT'`** (dòng 2845). Nếu nộp giáo án thông thường (`PERSONAL`), server chỉ báo tự ký cá nhân cho giáo viên (dòng 2851), **KHÔNG báo Tổ trưởng**! | **LỖI LOGIC NGHIÊM TRỌNG**: Giáo án thông thường nộp vào hệ thống không kích hoạt tin nhắn Zalo gửi đến Tổ trưởng chuyên môn để vào duyệt. |
| **Tổ trưởng duyệt** | `POST /api/documents/:id/approve-leader` (dòng 3203) | Có (dòng 3252, báo tác giả) | **HOÀN TOÀN KHÔNG CÓ** (0 lệnh gọi `zaloNotifyService`). | **LỖI LOGIC NGHIÊM TRỌNG**: Khi Tổ trưởng duyệt xong chuyển cấp, Ban Giám hiệu không nhận được tin nhắn Zalo; Giáo viên cũng không nhận được tin Zalo báo Tổ trưởng đã duyệt. |
| **BGH ký & đóng dấu** | `POST /api/documents/:id/approve-principal` (dòng 3267) | Có (dòng 3403, báo tác giả) | **HOÀN TOÀN KHÔNG CÓ** (0 lệnh gọi `zaloNotifyService`). | **LỖI LOGIC NGHIÊM TRỌNG**: BGH đóng dấu mộc số xong, hệ thống không hề gửi tin Zalo hoàn tất kèm link tải cho giáo viên. (Hàm `notifyDocumentCompleted` chỉ được gọi tại endpoint phụ `/confirm-complete` dòng 3126 của Báo cáo). |
| **BGH / TT từ chối** | Tuyến 1: dòng 836<br>Tuyến 2: dòng 3418 | Tuyến 1: Không<br>Tuyến 2: Có (dòng 3455) | Tuyến 1: Có (dòng 886)<br>Tuyến 2: Không | **XUNG ĐỘT TUYẾN**: Tuyến 1 không có middleware xác thực `requireAuth`, chiếm quyền tuyến 2 (dòng 3418 vốn có kiểm tra quyền người duyệt). |

### 1.2 Phân tích hàm vận chuyển `sendWebhookPost` / `sendZaloNotificationViaGAS`

- **Cấu trúc JSON Payload:**
  Payload gửi từ backend `zaloNotifyService.js` (dòng 71-80, 95-103, 137-144) gồm:
  ```json
  {
    "action": "NOTIFY_SIGN_EVENT",
    "eventType": "REJECTED" | "SUBMITTED" | "PERSONAL_SIGNED" | "COMPLETED",
    "docId": "GA-...",
    "docTitle": "...",
    "authorPhone": "...",
    "recipientPhone": "...",
    "senderName": "...",
    "approverName": "...",
    "reason": "...",
    "viewUrl": "..."
  }
  ```
- **Xử lý Timeout & Retry:**
  - Trong `zaloNotifyService.js` (dòng 26): Timeout được cấu hình cứng là **15 giây** (`setTimeout(() => controller.abort(), 15000)`).
  - Google Apps Script khi bị "Cold Start" hoặc khi phải mở Spreadsheet và gọi tiếp Zalo Bot API thường mất từ **8 đến 18 giây**. Do đó, hiện tượng `AbortError` xảy ra thường xuyên khi máy chủ Render gửi tin sang GAS.
  - **Hoàn toàn không có cơ chế Retry:** Nếu gặp lỗi mạng, HTTP 503 từ Google hoặc timeout, hàm chỉ trả về `{ success: false, error: err.message }` và kết thúc.
- **Hiện tượng thất lạc sự kiện (Event Loss) & Treo tiến trình:**
  - Tại `server.js`, tất cả các lệnh gọi gửi Zalo đều dùng cú pháp un-awaited promise:
    ```javascript
    zaloNotifyService.notifyDocumentSubmitted(...).catch(err => { ... });
    ```
  - Trong môi trường container PaaS (Render / Docker), khi HTTP request từ client kết thúc, tiến trình xử lý nền (Background Task) có thể bị container đóng băng hoặc reset CPU slice ngay lập tức, khiến các kết nối `fetch` chưa hoàn tất bị hủy bỏ trong âm thầm.

### 1.3 Đối soát vòng đời Token: Zalo OA API v3 OAuth vs. Zalo Bot Platform

Đoạn mã hiện tại trong `google-apps-script-zalo-edusign.js` (dòng 33, 159, 1938) đang sử dụng:
```javascript
ZALO_BOT_TOKEN: "2294655560219778902:jzfmNEYGuXlSvmyKEYeCrbSWIKGrmumxQhoSsFXkgNBXsnOaWWDwTjSYqjoAdaqp"
apiUrl = "https://bot-api.zaloplatforms.com/bot" + CONFIG.ZALO_BOT_TOKEN + "/sendMessage";
```
Đây là định dạng của **Zalo Bot Platform** (sử dụng Token tĩnh tương tự Telegram Bot API).
Tuy nhiên, nếu Nhà trường triển khai theo chuẩn **Zalo Official Account (Zalo OA API v3)** của Zalo for Business / Cơ quan Nhà nước:
- **Thời hạn Token OA v3:** `access_token` có hiệu lực tối đa **25 giờ** (90.000 giây). `refresh_token` có hiệu lực **3 tháng** và thuộc loại *Single-Use Rolling Token* (mỗi lần dùng để đổi Access Token thì một Refresh Token mới được sinh ra và token cũ lập tức bị hủy).
- **Điểm yếu chí mạng trong mã nguồn:** Toàn bộ dự án **KHÔNG HỀ CÓ cơ chế quản lý OAuth 2.0 PKCE**. Không có bảng lưu trữ `refresh_token`, không có cơ chế tự động gia hạn token trước khi hết hạn (refresh daemon), và không có cơ chế khóa đơn luồng (Mutex Lock) khi gia hạn. Nếu 2 request cùng kích hoạt làm mới Refresh Token cùng một mili-giây, Zalo sẽ khóa token thứ hai do vi phạm "Token Replay", dẫn đến toàn bộ hệ thống OA bị đứt gãy kết nối vĩnh viễn cho đến khi quản trị viên đăng nhập trình duyệt để xin cấp lại thủ công.

---

## PHẦN II: THẨM ĐỊNH CHATBOT TƯƠNG TÁC 2 CHIỀU (ZALO INTERACTIVE BOT)

### 2.1 Cổng tiếp nhận Webhook & Rủi ro thiếu xác thực chữ ký Webhook Secret

Trong `google-apps-script-zalo-edusign.js` (dòng 162), cấu hình có khai báo:
```javascript
secret_token: "UnifiedZaloBotTHCSCVA2026Secret"
```
**TUY NHIÊN, hàm tiếp nhận `doPost(e)` (dòng 293–399) HOÀN TOÀN KHÔNG KIỂM TRA SECRET TOKEN NÀY!**
- Không có bất kỳ dòng lệnh nào kiểm tra xem `e.parameter.secret_token` hoặc header `X-Zalo-Bot-Api-Secret-Token` có khớp với chuỗi bí mật hay không.
- **Hệ quả An ninh cực kỳ nghiêm trọng:** Bất kỳ ai trên Internet biết được URL triển khai Google Apps Script (`https://script.google.com/macros/s/.../exec`) đều có thể gửi HTTP POST giả mạo:
  - Gửi `action: "CLEAR_ALL_REPORTS"` $\rightarrow$ **Xóa sạch toàn bộ sổ sách lưu trữ báo cáo** của trường (dòng 334–337).
  - Gửi `action: "DELETE_REPORT"` $\rightarrow$ **Xóa tùy ý bất kỳ hồ sơ nào** của giáo viên (dòng 321–325).
  - Gửi `action: "NOTIFY_SIGN_EVENT"` $\rightarrow$ **Phát tin nhắn giả mạo** Ban Giám hiệu gửi đến các giáo viên.

### 2.2 Bộ phân tích cú pháp lệnh (Command Parser) & Các lỗ hổng tra cứu

Kiểm thử thực nghiệm với kịch bản `test_zalo_logic_audit.js` chứng minh:
1. **Tra cứu theo mã hồ sơ (`KHBD-...`, `BC-...`):**
   - Hoàn toàn **KHÔNG CÓ** bộ bóc tách mã hồ sơ trong hàm `processUnifiedZaloMessage` (dòng 404–512).
   - Khi giáo viên nhắn `KHBD-2026-001` hoặc `BC-001`, bot rơi vào nhánh mặc định báo lỗi: *"Trợ lý Trường học THCS Chu Văn An chưa nhận diện được yêu cầu"*.
2. **Tra cứu danh sách chờ duyệt (`choduyet`, `pending`):**
   - Hoàn toàn **KHÔNG CÓ** bộ xử lý lệnh tra cứu này dành cho Tổ trưởng và Ban Giám hiệu. Lãnh đạo nhà trường không thể dùng Zalo để kiểm tra xem hôm nay có bao nhiêu hồ sơ đang chờ ký duyệt.
3. **Tra cứu hồ sơ cá nhân (`hoso`):**
   - Hàm `handleLookupTeacherReports(chatId)` (dòng 1272–1326) chỉ bóc tách 5 bản ghi mới nhất trong Sheet `Sổ Lưu Báo Cáo`. Nếu giáo viên có nhiều hơn 5 giáo án hoặc muốn tìm giáo án của tuần trước thì không thể xem được.

### 2.3 Cơ chế phân quyền, kiểm soát truy cập & Lỗ hổng Chiếm đoạt tài khoản (Account Takeover)

Tại `google-apps-script-zalo-edusign.js`, logic liên kết tài khoản (dòng 413–418 & 1181–1233):
```javascript
var phoneDigits = text.replace(/[^0-9]/g, "");
if (phoneDigits.length >= 9 && phoneDigits.length <= 12 && !clean.startsWith("tkb") && !clean.startsWith("lop")) {
  if (chatId) return handlePhoneMapping(chatId, phoneDigits);
}
```
Khi người dùng nhập 1 dãy số từ 9 đến 12 chữ số, hàm `handlePhoneMapping` quét trong Sheet `Danh bạ GV`, nếu thấy số điện thoại trùng khớp thì:
```javascript
sheet.getRange(matchedRow, 6).setValue(String(chatId));
```
**LỖ HỔNG CHIẾM ĐOẠT TÀI KHOẢN (ACCOUNT TAKEOVER & IDENTITY THEFT):**
- **Cơ chế xác thực là CON SỐ 0:** Không yêu cầu mã OTP qua tin nhắn/cuộc gọi, không kiểm tra mật khẩu, không yêu cầu xác nhận từ tài khoản đã liên kết trước đó.
- Bất kỳ người ngoài, học sinh, hoặc kẻ xấu nào chỉ cần biết số điện thoại của Hiệu trưởng hoặc Giáo viên (vốn được công khai trong danh bạ nội bộ nhà trường), nhắn số đó vào Zalo Bot.
- Bot lập tức gán `Zalo_Chat_ID` của kẻ xấu vào hồ sơ của Thầy/Cô đó!
- **Hậu quả:** Kẻ xấu ngay lập tức:
  1. Nhận được toàn bộ thông báo ký số, thông tin hồ sơ mật, lý do trả về giáo án của giáo viên.
  2. Gõ lệnh `hoso` để xem toàn bộ danh sách giáo án, báo cáo và nhận được đường dẫn Google Drive xem chi tiết.
  3. Tài khoản Zalo thật của giáo viên bị cắt đứt nhận tin do `Zalo_Chat_ID` đã bị ghi đè.

---

## PHẦN III: LỖ HỔNG AN TOÀN THÔNG TIN & RỦI RO QUYỀN RIÊNG TƯ (DATA PRIVACY)

### 3.1 Nguy cơ lộ lọt dữ liệu định danh cá nhân (PII)

1. **Lộ lọt thông tin cán bộ khi kích hoạt:**
   Khi kẻ xấu nhập một số điện thoại bất kỳ vào bot, bot trả lời ngay lập tức (dòng 1221–1224):
   - Họ và tên thật của giáo viên.
   - Tổ chuyên môn / Phòng ban.
   - Xác nhận số điện thoại thuộc biên chế nhà trường.
2. **Nguy cơ phơi bày Căn cước công dân (CCCD) và Mật khẩu trong mã:**
   Trong `data/users.json` (dòng 1–60):
   - Chứa thông tin số CCCD của toàn bộ giáo viên và Ban Giám hiệu (ví dụ: `042084002100`, `051200112233`).
   - Mật khẩu tài khoản được lưu ở dạng **Plain Text** không băm (`admin@123`, `123456`).
   - Mặc dù bot Zalo chưa in trực tiếp CCCD ra tin nhắn, nhưng việc thiếu phân quyền tại các API backend (`server.js`) cho phép bất kỳ truy vấn không xác thực nào bóc tách trọn vẹn tệp `users.json`.

### 3.2 Lộ lọt tài liệu & Dấu đỏ điện tử không qua xác thực (`/uploads`)

Trong `server.js` (dòng 84):
```javascript
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
```
Toàn bộ thư mục `uploads/` được phục vụ dưới dạng **Tài nguyên tĩnh công khai (Public Static Serving)**:
1. **Lộ lọt Con dấu đỏ nhà trường (`school_seal.png`):**
   Tệp con dấu cơ quan tại `uploads/signatures/school_seal.png` hoàn toàn có thể được tải về bởi bất kỳ ai trên Internet qua đường dẫn: `https://<domain>/uploads/signatures/school_seal.png` mà không cần đăng nhập! Đây là rủi ro pháp lý và an ninh đặc biệt nghiêm trọng (nguy cơ làm giả văn bản đóng dấu cơ quan nhà nước).
2. **Lộ lọt Ảnh chữ ký cá nhân (`sig_<userId>.png`):**
   Mọi chữ ký tay / chữ ký điện tử của giáo viên và Ban Giám hiệu đều bị phơi bày công khai.
3. **Lộ lọt tệp PDF giáo án đã ký (`Signed_<docId>.pdf`):**
   Bất kỳ ai đoán được `docId` đều có thể tải trực tiếp file PDF ký số của giáo viên mà không cần token xác thực.

### 3.3 Xử lý ngoại lệ mạng & giới hạn tần suất (Rate Limiting)

1. **Lỗi `muteHttpExceptions: true` khi gửi tin Zalo Bot (dòng 1948):**
   Hàm `sendZaloBotReply` trong GAS gọi `UrlFetchApp.fetch` nhưng không đọc mã phản hồi HTTP. Khi Zalo trả về lỗi (ví dụ: người dùng đã chặn bot, số điện thoại chưa kích hoạt Zalo, hoặc bị khóa tài khoản), GAS vẫn ghi nhận là gửi thành công và trả về `{ delivered: true }` cho hệ thống, gây hiện tượng báo cáo ảo ("False Positive Delivery").
2. **Nghẽn Rate Limit trong Engine gửi tin sáng 6h00 (`sendDailyMorningPersonalSchedule`):**
   - Vòng lặp gửi tin sáng duyệt qua toàn bộ giáo viên và chỉ nghỉ 150ms (`Utilities.sleep(150)`).
   - Với quy mô trường học từ 60–100 cán bộ giáo viên, việc gửi liên tục hàng chục request HTTP sang Zalo Bot Platform trong thời gian ngắn rất dễ bị Zalo kích hoạt cơ chế bóp băng thông (Rate Limit HTTP 429), dẫn đến các giáo viên ở cuối danh sách không nhận được lịch báo giảng sáng.

---

## DANH MỤC BẢN GHI KHUYẾT TẬT CHI TIẾT (STRUCTURED DEFECT RECORDS)

### [DEFECT-ZALO-01] Rơi rụng thông báo sự kiện chuyển tiếp hồ sơ (`FORWARDED`)
- **Tọa độ tệp & Dòng mã:**
  - `js/app.js`: Dòng 5644 (Gửi `eventType: 'FORWARDED'`).
  - `google-apps-script-zalo-edusign.js`: Dòng 1345–1388 (Chỉ bắt `REJECTED`, `COMPLETED`, `SUBMITTED`, `PERSONAL_SIGNED`).
- **Phân loại & Mức độ nghiêm trọng:** Logic Bug / Critical.
- **Nguyên nhân gốc rễ (RCA):** Khách thể gửi (`app.js`) sử dụng mã sự kiện `FORWARDED` cho luồng ký luân chuyển nhiều bên, nhưng chủ thể nhận (`handleEduSignNotification` trong Apps Script) không định nghĩa nhánh này. Dẫn đến `messageText` bị rỗng và hệ thống trả về `{ success: false, reason: "INVALID_EVENT" }`.
- **Tác động vận hành tại THCS Chu Văn An:** Khi hồ sơ được ký nháy và chuyển tiếp sang người ký thứ 2 hoặc thứ 3, người ký tiếp theo hoàn toàn không nhận được tin nhắn Zalo, dẫn đến hồ sơ bị ngâm tắc, chậm trễ lịch phê duyệt của trường.
- **Đoạn mã đề xuất sửa đổi:**
```javascript
// Bổ sung vào google-apps-script-zalo-edusign.js tại dòng 1377:
} else if (eventType === "FORWARDED" || eventType === "SUBMITTED") {
  targetPhone = recipientPhone;
  messageText = "╔════════════════════════════════════════╗\n" +
                "  📥 THÔNG BÁO: CÓ HỒ SƠ MỚI CẦN KÝ DUYỆT\n" +
                "╚════════════════════════════════════════╝\n\n" +
                "📋 Tên hồ sơ: " + docTitle + "\n" +
                "🆔 Mã hồ sơ: " + docId + "\n" +
                "👤 Người chuyển trình: " + senderName + "\n" +
                "⏰ Thời gian: " + new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) + "\n\n" +
                "👉 Kính mời Thầy/Cô truy cập EduSign để kiểm tra và thực hiện ký duyệt.";
}
```

---

### [DEFECT-ZALO-02] Thiếu bộ bóc tách mã hồ sơ (`KHBD-...`, `BC-...`) trong Chatbot
- **Tọa độ tệp & Dòng mã:** `google-apps-script-zalo-edusign.js`, dòng 404–512 (`processUnifiedZaloMessage`).
- **Phân loại & Mức độ nghiêm trọng:** Missing Feature / Logic Fix (High).
- **Nguyên nhân gốc rễ (RCA):** Bộ định tuyến NLP của bot chỉ bắt các từ khóa tĩnh (`tkb`, `day thay`, `hoso`, `baocao`), hoàn toàn bỏ quên Regex nhận diện định dạng mã hồ sơ giáo án điện tử.
- **Tác động vận hành tại THCS Chu Văn An:** Giáo viên hoặc Tổ trưởng muốn kiểm tra nhanh tiến độ 1 hồ sơ cụ thể qua mã tra cứu (ví dụ: `KHBD-2026-001` hoặc `BC-0123`) thì bot báo không hiểu lệnh, buộc người dùng phải mở máy tính đăng nhập vào web.
- **Đoạn mã đề xuất sửa đổi:**
```javascript
// Bổ sung vào processUnifiedZaloMessage trước dòng 423:
var docIdMatch = text.match(/^(KHBD|BC|GA|HOSO)[-_0-9A-Za-z]+/i);
if (docIdMatch) {
  return handleLookupSpecificDocument(chatId, docIdMatch[0].toUpperCase());
}
```

---

### [DEFECT-ZALO-03] Thiếu tính năng tra cứu danh sách chờ duyệt (`choduyet`, `pending`)
- **Tọa độ tệp & Dòng mã:** `google-apps-script-zalo-edusign.js`, dòng 423–435.
- **Phân loại & Mức độ nghiêm trọng:** Logic Fix / Usability (Medium).
- **Nguyên nhân gốc rễ (RCA):** Chưa triển khai logic truy vấn danh sách hồ sơ ở trạng thái `WAITING_APPROVAL` hoặc `SUBMITTED` dựa trên quyền hạn của người gửi tin.
- **Tác động vận hành tại THCS Chu Văn An:** Ban Giám hiệu hoặc Tổ trưởng không có cách nào nắm bắt nhanh số lượng hồ sơ tồn đọng trong ngày qua Zalo mà phải vào trang web trường.

---

### [DEFECT-ZALO-04] Chiếm đoạt tài khoản giáo viên qua ánh xạ SĐT không xác thực OTP
- **Tọa độ tệp & Dòng mã:** `google-apps-script-zalo-edusign.js`, dòng 413–419 và 1181–1233 (`handlePhoneMapping`).
- **Phân loại & Mức độ nghiêm trọng:** **CRITICAL SECURITY VULNERABILITY (IDOR / Account Takeover)**.
- **Nguyên nhân gốc rễ (RCA):** Ánh xạ định danh 1-1 giữa Zalo User ID (`chatId`) và Số điện thoại chỉ dựa vào việc người dùng gõ vào số điện thoại, không có lớp kiểm thực sở hữu (Proof of Ownership) như OTP SMS, Mật khẩu tài khoản EduSign, hoặc Zalo Mini App Auth.
- **Tác động vận hành tại THCS Chu Văn An:** Bất kỳ ai cũng có thể mạo danh Hiệu trưởng hoặc Tổ trưởng, chiếm đoạt thông báo ký duyệt nội bộ, đọc trộm ý kiến nhận xét trả về và xem toàn bộ giáo án của giáo viên khác.
- **Đoạn mã đề xuất sửa đổi:**
```javascript
// Đề xuất cơ chế liên kết an toàn 2 bước qua mã PIN EduSign cá nhân:
// Cú pháp: LK [SốĐiệnThoại] [MãPIN_6_Số] (Mã PIN lấy từ trang cá nhân EduSign của giáo viên)
var linkPattern = text.match(/^(LK|LIENKET)\s+([0-9]{9,11})\s+([0-9A-Za-z]{4,8})$/i);
if (linkPattern) {
  var phone = linkPattern[2];
  var secretPin = linkPattern[3];
  return handleSecurePhoneMapping(chatId, phone, secretPin);
}
```

---

### [DEFECT-ZALO-05] Tổ trưởng duyệt không gửi Zalo cho Ban Giám hiệu (`approve-leader`)
- **Tọa độ tệp & Dòng mã:** `server.js`, dòng 3203–3264 (`app.post('/api/documents/:id/approve-leader')`).
- **Phân loại & Mức độ nghiêm trọng:** Logic Bug / High.
- **Nguyên nhân gốc rễ (RCA):** Lập trình viên chỉ gắn hàm `notifyUserWebPush` (dòng 3252) mà quên tích hợp lệnh gọi `zaloNotifyService.notifyDocumentSubmitted(...)` để báo cho Ban Giám hiệu (cấp ký tiếp theo).
- **Tác động vận hành tại THCS Chu Văn An:** Khi Tổ trưởng ký nháy xong, Hiệu trưởng không nhận được thông báo Zalo để mở máy ký số VGCA đóng dấu mộc đỏ. Quy trình bị gián đoạn giữa chừng.
- **Đoạn mã đề xuất sửa đổi:**
```javascript
// Thêm vào server.js sau dòng 3257:
try {
  // Tìm SĐT của Ban Giám hiệu để gửi tin Zalo
  const bghUser = dataStore.getUsers().find(u => u.role === 'BGH' || u.role === 'ADMIN');
  const bghPhone = bghUser ? (bghUser.phone || '') : '';
  zaloNotifyService.sendWebhookPost({
    action: 'NOTIFY_SIGN_EVENT',
    eventType: 'SUBMITTED',
    docId: updatedDoc.id,
    docTitle: updatedDoc.title,
    recipientPhone: bghPhone,
    senderName: `${currentUser.name} (Tổ trưởng ${updatedDoc.department})`
  }).catch(e => console.warn('[ZaloNotify] Lỗi gửi BGH:', e.message));
} catch(zErr) {}
```

---

### [DEFECT-ZALO-06] Ban Giám hiệu đóng dấu không gửi Zalo kèm link tải cho Giáo viên (`approve-principal`)
- **Tọa độ tệp & Dòng mã:** `server.js`, dòng 3267–3415 (`app.post('/api/documents/:id/approve-principal')`).
- **Phân loại & Mức độ nghiêm trọng:** Logic Bug / High.
- **Nguyên nhân gốc rễ (RCA):** Thiếu sót hoàn toàn việc gọi `zaloNotifyService.notifyDocumentCompleted` trong tuyến phê duyệt của Ban Giám hiệu.
- **Tác động vận hành tại THCS Chu Văn An:** Giáo viên nộp giáo án, sau khi BGH ký số thành công thì giáo viên không nhận được tin nhắn Zalo kèm đường dẫn tải về, không biết giáo án của mình đã được duyệt hay chưa nếu không chủ động đăng nhập vào web kiểm tra.
- **Đoạn mã đề xuất sửa đổi:**
```javascript
// Thêm vào server.js sau dòng 3408:
try {
  zaloNotifyService.notifyDocumentCompleted(
    updatedDoc,
    currentUser,
    updatedDoc.driveInfo ? updatedDoc.driveInfo.viewUrl : ''
  ).catch(e => console.warn('[ZaloNotify] Lỗi gửi thông báo hoàn tất cho GV:', e.message));
} catch(zErr) {}
```

---

### [DEFECT-ZALO-07] Xung đột tuyến trùng lặp (Duplicate Route) tại `POST /api/documents/:id/reject`
- **Tọa độ tệp & Dòng mã:**
  - Tuyến 1: `server.js`, dòng 836–905 (Không có `requireAuth`, có gọi Zalo Notify).
  - Tuyến 2: `server.js`, dòng 3418–3466 (Có `requireAuth`, không có gọi Zalo Notify).
- **Phân loại & Mức độ nghiêm trọng:** **Security & Architecture Flaw (Critical)**.
- **Nguyên nhân gốc rễ (RCA):** Tuyến 1 đăng ký trước trong ngăn xếp Express Router sẽ bắt trọn gói tin. Tuyến 1 cho phép client giả mạo header `x-user-id` hoặc payload `currentUser` để từ chối hồ sơ mà không xác thực JWT/Session. Trong khi tuyến 2 được bảo vệ chặt chẽ thì lại trở thành "Dead Code" không bao giờ được kích hoạt.
- **Tác động vận hành tại THCS Chu Văn An:** Lỗ hổng cho phép người dùng không có thẩm quyền gửi request từ chối hồ sơ giáo án của giáo viên khác.

---

### [DEFECT-ZALO-08] Bắn tin lặp kép do Dual-Dispatch giữa Client (`app.js`) và Server (`server.js`)
- **Tọa độ tệp & Dòng mã:**
  - `js/app.js`: Dòng 4769, 5225, 5424, 5599 (Gọi `sendZaloNotificationClientSide`).
  - `server.js`: Dòng 886, 2845, 2851, 2918, 3052 (Gọi `zaloNotifyService`).
- **Phân loại & Mức độ nghiêm trọng:** Architecture Defect / Duplicate Spam (Medium).
- **Nguyên nhân gốc rễ (RCA):** Kiến trúc không phân định trách nhiệm duy nhất (Single Source of Truth). Cả trình duyệt người dùng và máy chủ backend đều đồng thời gửi HTTP POST sang Google Apps Script khi xảy ra sự kiện nộp bài, ký số hoặc trả về.
- **Tác động vận hành tại THCS Chu Văn An:** Giáo viên và lãnh đạo nhận được 2 tin nhắn Zalo giống hệt nhau cho cùng một sự kiện, gây phiền toái và làm tăng nguy cơ bị Zalo khóa bot do spam rate limit.

---

### [DEFECT-ZALO-09] Thư mục `/uploads` tĩnh công khai để lộ Con dấu trường và Ảnh chữ ký
- **Tọa độ tệp & Dòng mã:** `server.js`, dòng 84 (`app.use('/uploads', express.static(...))`).
- **Phân loại & Mức độ nghiêm trọng:** **HIGH SECURITY & DATA PRIVACY RISK**.
- **Nguyên nhân gốc rễ (RCA):** Dùng `express.static` phục vụ toàn bộ thư mục chứa các tệp nhạy cảm (con dấu đỏ `school_seal.png`, ảnh chữ ký cá nhân `sig_*.png`, tệp PDF hồ sơ đã ký).
- **Tác động vận hành tại THCS Chu Văn An:** Bất kỳ ai cũng có thể trích xuất con dấu tròn điện tử của nhà trường và chữ ký của giáo viên, tiềm ẩn nguy cơ làm giả văn bản pháp lý.
- **Đoạn mã đề xuất sửa đổi:**
```javascript
// Thay thế express.static bằng middleware kiểm tra xác thực và phân quyền:
app.use('/uploads/signatures', requireAuth, (req, res, next) => {
  // Chỉ cho phép người dùng xem chữ ký của chính mình hoặc quyền BGH/Admin
  const requestedFile = path.basename(req.path);
  if (req.user.role === 'ADMIN' || req.user.role === 'BGH' || requestedFile === `sig_${req.user.id}.png`) {
    return express.static(path.join(__dirname, 'uploads', 'signatures'))(req, res, next);
  }
  return res.status(403).json({ success: false, message: 'Từ chối quyền truy cập tài nguyên chữ ký nhạy cảm.' });
});
```

---

### [DEFECT-ZALO-10] Webhook Google Apps Script không kiểm tra `secret_token`
- **Tọa độ tệp & Dòng mã:** `google-apps-script-zalo-edusign.js`, dòng 293–306.
- **Phân loại & Mức độ nghiêm trọng:** **CRITICAL SECURITY RISK (CWE-306: Missing Authentication for Critical Function)**.
- **Nguyên nhân gốc rễ (RCA):** Cấu hình khai báo `secret_token: "UnifiedZaloBotTHCSCVA2026Secret"` nhưng trong hàm `doPost(e)` hoàn toàn không kiểm tra token trước khi thực thi các thao tác nhạy cảm như xóa sổ báo cáo (`CLEAR_ALL_REPORTS`).
- **Tác động vận hành tại THCS Chu Văn An:** Kẻ tấn công trên mạng có thể kích hoạt API để xóa trắng dữ liệu lưu trữ báo cáo của nhà trường.
- **Đoạn mã đề xuất sửa đổi:**
```javascript
function doPost(e) {
  try {
    var secretHeader = (e && e.parameter && e.parameter.secret_token) || "";
    // Kiểm tra chữ ký bảo mật cho các tác vụ quản trị
    var postData = {};
    if (e && e.postData && e.postData.contents) {
      try { postData = JSON.parse(e.postData.contents); } catch (err) {}
    }
    var providedSecret = postData.secret_token || secretHeader;
    
    // Nếu là thao tác xóa hoặc thông báo từ server, bắt buộc phải có secret hợp lệ
    var action = postData.action || (e && e.parameter && e.parameter.action) || "";
    if (["DELETE_REPORT", "BATCH_DELETE_REPORTS", "CLEAR_ALL_REPORTS", "NOTIFY_SIGN_EVENT"].indexOf(action) !== -1) {
      if (providedSecret !== "UnifiedZaloBotTHCSCVA2026Secret") {
        return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Unauthorized Secret Token" }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    // Tiếp tục xử lý nghiệp vụ...
```

---

### [DEFECT-ZALO-11] Lệch pha chuẩn Zalo OA v3 (Không có cơ chế xoay vòng Refresh Token OAuth 2.0)
- **Tọa độ tệp & Dòng mã:** `google-apps-script-zalo-edusign.js`, dòng 31–34.
- **Phân loại & Mức độ nghiêm trọng:** Architectural Incompatibility (High).
- **Nguyên nhân gốc rễ (RCA):** Dự án sử dụng API Zalo Bot Platform dạng bot độc lập, chưa xây dựng module quản lý Access Token / Refresh Token theo chuẩn Zalo Official Account v3 của Zalo Open Platform dành cho các tổ chức giáo dục công lập.
- **Tác động vận hành tại THCS Chu Văn An:** Khi nhà trường đăng ký trang Zalo OA Xác thực (tick vàng) của đơn vị sự nghiệp công lập để gửi thông báo ZNS, hệ thống hiện tại sẽ không thể kết nối được nếu không xây dựng lại tầng xác thực OAuth 2.0.

---

### [DEFECT-ZALO-12] Mù lỗi HTTP khi gọi Zalo Bot API (`muteHttpExceptions: true`)
- **Tọa độ tệp & Dòng mã:** `google-apps-script-zalo-edusign.js`, dòng 1944–1952 (`sendZaloBotReply`).
- **Phân loại & Mức độ nghiêm trọng:** Error Handling Defect (Medium).
- **Nguyên nhân gốc rễ (RCA):** Sử dụng `muteHttpExceptions: true` nhưng không bóc tách đối tượng trả về từ `UrlFetchApp.fetch(apiUrl, ...).getResponseCode()` và nội dung JSON phản hồi từ máy chủ Zalo.
- **Tác động vận hành tại THCS Chu Văn An:** Tin nhắn gửi thất bại do giáo viên chặn bot hoặc sai Chat ID vẫn được hệ thống ghi nhận là đã phát lệnh thành công, khiến nhà trường tưởng rằng giáo viên đã nhận được tin.

---

## 6. ĐỀ XUẤT NÂNG CẤP & MẪU CODE CHUẨN HÓA ĐỂ TRÌNH DUYỆT

### 6.1 Mẫu Card Thông báo Ký số Zalo Chuẩn hóa (Zalo Interactive Message)

Nhằm nâng cao tính chuyên nghiệp, thẩm mỹ và thuận tiện trong trải nghiệm người dùng của giáo viên tại THCS Chu Văn An, tin nhắn Zalo gửi đến nên được chuẩn hóa kèm nút bấm tương tác (Action Button) và định dạng bôi đậm tối ưu cho điện thoại:

```
╔══════════════════════════════════════════════╗
  🎉 THCS CHU VĂN AN • KÝ SỐ HOÀN TẤT
╚══════════════════════════════════════════════╝

📋 Hồ sơ: [Kế hoạch bài dạy Tuần 4 - Môn Toán 6]
🆔 Mã hồ sơ: KHBD-2026-T4-001
✍️ Người ký: Thầy Nguyễn Đức Trọng (Tổ trưởng)
🔴 Phê duyệt: Cô Ngô Thị Liền (Hiệu trưởng - Ký số VGCA)
⏰ Thời gian: 15/09/2026 09:30:15
🔒 Chuẩn chữ ký: PAdES Incremental Update (Đã niêm phong)

📂 TẢI TỆP ĐÃ KÝ & ĐÓNG DẤU:
👉 https://edusign-vgca.onrender.com/api/documents/download/KHBD-2026-T4-001?token=expiring_token_here

🌐 Tra cứu hồ sơ tại Cổng thông tin:
👉 https://mrkhang-khoi.github.io/cvakyso/portal-baocao.html
```

### 6.2 Mô hình Kiến trúc Chuẩn đề xuất (Single Source of Truth & Zero-Leakage)

1. **Nguyên tắc phân định luồng phát tin:**
   - **Xóa bỏ hoàn toàn việc gọi Webhook Zalo trực tiếp từ trình duyệt (`sendZaloNotificationClientSide` trong `app.js`).**
   - Mọi thông báo Zalo bắt buộc phải do máy chủ Backend (`server.js`) điều phối duy nhất sau khi giao dịch cơ sở dữ liệu đã commit thành công.
2. **Bảo mật Webhook:**
   - Thêm header `X-EduSign-Signature: HMAC-SHA256(payload, secret_key)` vào mỗi request gửi từ `zaloNotifyService.js` sang Google Apps Script.
   - `doPost(e)` trong Apps Script xác thực chữ ký trước khi thực thi bất kỳ hành động nào.
3. **Bảo vệ tài nguyên `/uploads`:**
   - Chuyển toàn bộ việc tải file sang cơ chế **One-Time Signed URL** (ví dụ: token có thời hạn 30 phút, chứa hash của `userId + docId + timestamp`).

---

*Báo cáo được hoàn lập và chứng thực bởi Explorer Zalo Logic & Security Audit.*  
*Tất cả bằng chứng kiểm thử thực nghiệm được lưu tại: `.agents/explorer_zalo/test_zalo_logic_audit.js` và `.agents/explorer_zalo/probe_findings.json`.*
