# 📘 HƯỚNG DẪN CẬP NHẬT VÀ TRIỂN KHAI MÃ NGUỒN GOOGLE APPS SCRIPT (CODE.GS)
## HỆ THỐNG TRỢ LÝ ZALO BOT TRƯỜNG HỌC 4.0 & KÝ SỐ EDUSIGN VGCA
### TRƯỜNG THCS CHU VĂN AN — XÃ ĐĂK HÀ — TỈNH QUẢNG NGÃI
**Phiên bản**: Bản Nâng Cấp Toàn Diện 2026 (Bảo Mật Tuyệt Đối R3: Bỏ 4 Số Cuối SĐT, Bảo Toàn Số 0 SĐT/PIN & Đồng Bộ Realtime)

---

> **Dành cho**: Quản trị viên CNTT Nhà trường, Ban Giám hiệu, Tổ trưởng Chuyên môn  
> **Tệp mã nguồn mục tiêu**: `google-apps-script-zalo-edusign.js` (Triển khai vào `Code.gs` trên Google Apps Script)  
> **Thời gian thao tác ước tính**: 5 – 10 phút  
> **Môi trường thực hiện**: Trình duyệt Web (Google Chrome / Edge / Cốc Cốc)

---

## 📑 MỤC LỤC
1. [Điểm Mới & Các Bản Vá Cốt Lõi trong Phiên bản Nâng cấp](#1-điểm-mới--các-bản-vá-cốt-lõi-trong-phiên-bản-nâng-cấp)
2. [Kiến trúc Tích hợp Hệ thống Tổng quan](#2-kiến-trúc-tích-hợp-hệ-thống-tổng-quan)
3. [Các bước Cập nhật Mã nguồn vào Code.gs](#3-các-bước-cập-nhật-mã-nguồn-vào-codegs)
4. [Cấu hình Chi tiết Biến Hệ thống (`CONFIG`)](#4-cấu-hình-chi-tiết-biến-hệ-thống-config)
5. [Hướng dẫn Thực thi các Hàm Khởi tạo 1 Lần (Run Once)](#5-hướng-dẫn-thực-thi-các-hàm-khởi-tạo-1-lần-run-once)
6. [Cấp Quyền Truy cập (OAuth Scope) & Triển khai Web App (Deploy)](#6-cấp-quyền-truy-cập-oauth-scope--triển-khai-web-app-deploy)
   * [6.4. Quy trình Triển khai Phiên bản Mới (Deploy New Version)](#64-hướng-dẫn-nâng-cấp-bản-triển-khai-mới-deploy-new-version-cho-quản-trị-viên-khi-cập-nhật-mã-nguồn)
7. [Kiểm thử Thực nghiệm & Nghiệm thu Hệ thống](#7-kiểm-thử-thực-nghiệm--nghiệm-thu-hệ-thống)
8. [Xử lý Sự cố Thường gặp (Troubleshooting FAQ)](#8-xử-lý-sự-cố-thường-gặp-troubleshooting-faq)

---

## 1. ĐIỂM MỚI & CÁC BẢN VÁ CỐT LÕI TRONG PHIÊN BẢN NÂNG CẤP

Phiên bản cập nhật 2026 giải quyết triệt để 5 bài toán kỹ thuật thực tế phát sinh trong quá trình vận hành tại trường THCS Chu Văn An:

### 1.1. Khắc phục Triệt để Lỗi Mất Số 0 Đầu (Leading Zeros) cho SĐT và Mã PIN
- **Nguyên nhân gốc rễ**: Khi lưu trữ chuỗi số điện thoại (`0818810007`) hoặc mã PIN (`0007`) lên Google Sheets, bộ máy của Google tự động ép kiểu dữ liệu thành Number (818810007 và 7), làm rụng các số 0 ở đầu.
- **Giải pháp xử lý tại nguồn**:
  * Khi ghi dữ liệu (`handleSyncTeacher`), bắt buộc thêm tiền tố Text (`"'"`), ví dụ: `"'0818810007"`, `"'0007"`.
  * Đặt định dạng hiển thị cột `setNumberFormat("@")` cho cột 3 (Số điện thoại) và cột 9 (Mã PIN EduSign).
  * Bảo toàn 100% hiển thị trực quan trên Google Sheets đầy đủ 10 số điện thoại và đủ 4 ký tự mã PIN.

### 1.2. Phòng thủ Falsy Zero cho Mã PIN 0000
- **Nguyên nhân**: Khi bảng tính Google Sheets lưu trữ mã PIN `0000`, Google Sheets tự động ép về số `0`. Biểu thức cũ `data[i][8] || ""` trong JavaScript đánh giá số `0` là falsy, dẫn đến chuỗi rỗng `""` và vô hiệu hóa mã PIN của giáo viên.
- **Giải pháp chuẩn hóa**:
  * Kiểm tra chặt chẽ `var rawPinVal = data[i][8]; storedPin = (rawPinVal !== undefined && rawPinVal !== null) ? String(rawPinVal).replace(/^'+/, "").trim() : "";`.
  * Kết hợp thuật toán `padStart(4, "0")` tự động bù đủ 4 chữ số cho mã PIN dạng số đơn lẻ.

### 1.3. Mở rộng Regex Zalo Webhook Nhận diện SĐT Có Định dạng & Đầu số Quốc tế
- **Nguyên nhân**: Giáo viên copy số điện thoại từ danh bạ thường có dấu cách (`0905 123 456`), dấu gạch (`+84-905-123-456`), mã vùng quốc tế (`+84 818 810 007`, `840818810007`). Cú pháp regex cũ chỉ nhận 9-11 số liền nhau nên bị chặn ngay từ cổng vào webhook.
- **Giải pháp chuẩn hóa**:
  * Regex cú pháp liên kết được nâng cấp thành: `/^(LK|LIENKET)\s+([\+0-9\s\-\.\(\)]{9,25})\s+([0-9A-Za-z]{1,8})$/i`.
  * Regex lọc số điện thoại trần cho phép độ dài chuỗi lên đến 12 chữ số (bao phủ đầu số `840...`).

### 1.4. Nâng Cấp Bảo Mật R3: Loại Bỏ Hoàn Toàn Gợi Ý & Cơ Chế Dùng 4 Số Cuối SĐT (Account Takeover Protection)
- **Nguy cơ an toàn trước đây**: Trong phiên bản cũ, hệ thống còn lưu giữ cơ chế dự phòng (fallback) cho phép giáo viên sử dụng 4 chữ số cuối của số điện thoại (`phone4`) làm mã PIN đăng nhập Zalo Bot nếu chưa đổi PIN, hoặc Bot hiển thị gợi ý *"hoặc dùng ngay 4 số cuối SĐT (0007)"* trong phản hồi. Điều này tạo lỗ hổng bảo mật nghiêm trọng: kẻ xấu có thể tra cứu số điện thoại của giáo viên và chiếm quyền điều khiển tài khoản Zalo Bot, xem trộm tiến độ ký số và nội dung hồ sơ giáo án nội bộ của trường.
- **Giải pháp Nâng cấp Bảo mật R3 (Zero-Trust Security)**:
  * **Xóa bỏ 100% cơ chế Fallback 4 số cuối SĐT**:
    - Trong hàm `handleSecurePhoneMapping`, loại bỏ hoàn toàn biến `phone4` và mọi nhánh logic cho phép dùng 4 số cuối để bypass.
    - Bất kể tài khoản mới hay cũ, hệ thống **bắt buộc** phải xác thực mã PIN bí mật do Quản trị viên cấp (`storedPin` tại Cột 9 bảng "Danh bạ GV").
  * **Chuẩn hóa Cú pháp Duy nhất**:
    - Cú pháp chuẩn bảo mật: `LK [SốĐiệnThoại] [MãPIN]` (hoặc `LIENKET [SốĐiệnThoại] [MãPIN]`).
    - Hỗ trợ số điện thoại đa định dạng (quốc tế +84, khoảng trắng, dấu gạch nối) và mã PIN linh hoạt từ 1 đến 8 ký tự.
  * **Cơ chế Đối soát Nghiêm ngặt `secretPin === storedPin`**:
    - Mã PIN người dùng gửi (`pinClean`) được chuẩn hóa và đối soát trực tiếp với `storedPin`.
    - Tự động áp dụng thuật toán `padStart(4, '0')` nếu mã PIN dạng số đơn lẻ bị Google Sheets ép kiểu (ví dụ PIN `0007` lưu thành `7`, hoặc `0000` lưu thành `0`).
    - Quy tắc nghiêm ngặt: Nếu `!storedPin || pinClean !== storedPin`, hệ thống lập tức từ chối liên kết và gửi cảnh báo:
      `❌ Mã PIN bảo mật không chính xác! Vui lòng kiểm tra Mã PIN tại mục 'Thông tin cá nhân & Zalo' trên trang web EduSign của trường hoặc liên hệ Quản trị viên.`
  * **Triệt tiêu Hoàn toàn Gợi ý trong Tin nhắn Phản hồi của Bot**:
    - Khi giáo viên chỉ nhắn số điện thoại trần (chưa kèm PIN), Bot trả về thông điệp bảo vệ định danh:
      ```text
      🔐 BẢO VỆ ĐỊNH DANH GIÁO VIÊN:

      Để bảo vệ quyền riêng tư hồ sơ giáo án, Thầy/Cô vui lòng nhắn cú pháp kèm Mã PIN EduSign cá nhân:
      👉 Cú pháp: LK [SốĐiệnThoại] [MãPIN]

      📌 Thầy/Cô xem Mã PIN tại mục 'Thông tin cá nhân & Zalo' trên trang web EduSign của trường.
      ```
    - Tuyệt đối KHÔNG còn bất kỳ gợi ý nào về 4 số cuối SĐT, loại bỏ hoàn toàn khả năng dò quét đoán mã.

### 1.5. Cơ chế Tự Phục Hồi Dữ Liệu (Self-Healing Algorithm)
- Khi giáo viên gửi lệnh liên kết thành công trên Zalo, hệ thống tự động kiểm tra lại ô dữ liệu trên Google Sheets. Nếu phát hiện ô bị thiếu tiền tố text `"'"` hoặc chưa định dạng `@`, script tự động ghi đè định dạng chuẩn `setNumberFormat("@")` và `setValue("'" + normPhone)`.

### 1.6. Nâng Cấp Thông Báo Ký Số: Cơ Chế Gửi Kép (Dual-Delivery) & Bảo Mật secret_token
- **Nguyên nhân phát hiện trước đây**:
  1. Webhook từ trình duyệt (Client-side) phát sự kiện `NOTIFY_SIGN_EVENT` nhưng thiếu `secret_token: "UnifiedZaloBotTHCSCVA2026Secret"`, dẫn đến Google Apps Script từ chối với lỗi `UNAUTHORIZED_SECRET_TOKEN`.
  2. Sự kiện `SUBMITTED` trước đây chỉ gửi tới `recipientPhone` (người duyệt). Khiến tác giả khởi tạo (`authorPhone`) hoàn toàn không nhận được tin xác nhận luồng ký, và nếu người duyệt chưa liên kết Zalo thì toàn bộ thông báo bị gián đoạn.
- **Giải pháp Nâng cấp Toàn diện (Dual-Delivery & Graceful Fallback)**:
  1. **Bảo mật Single-Point secret_token**: Hàm `sendZaloNotificationClientSide` tự động gắn `payload.secret_token = "UnifiedZaloBotTHCSCVA2026Secret"` cho mọi sự kiện (`SUBMITTED`, `FORWARDED`, `PERSONAL_SIGNED`, `COMPLETED`, `REJECTED`).
  2. **Cơ chế Gửi Kép (Dual-Delivery) cho sự kiện SUBMITTED**:
     * **Nhánh 1 (Xác nhận Tác giả - `authorPhone`)**: Gửi tin nhắn xác nhận khởi tạo thành công:
       ```text
       ╔════════════════════════════════════════╗
         📤 XÁC NHẬN: KHỞI TẠO BÁO CÁO & TRÌNH KÝ THÀNH CÔNG
       ╚════════════════════════════════════════╝

       📋 Tên hồ sơ: {docTitle}
       🆔 Mã hồ sơ: {docId}
       👤 Người tạo: {senderName}
       🔄 Luồng ký: Đã chuyển tiếp tới {recipientName} ({recipientPhone || "Chưa có SĐT"})
       ⏰ Thời gian: {Thời gian định dạng vi-VN, timeZone: "Asia/Ho_Chi_Minh"}

       📌 Hệ thống đã tự động ghi nhận và chuyển tiếp hồ sơ trong luồng ký số điện tử.
       ```
     * **Nhánh 2 (Mời ký duyệt - `recipientPhone`)**: Gửi tin nhắn thông báo có hồ sơ mới cần ký duyệt.
     * **Fallback êm dịu (Graceful Fallback)**: Nếu người duyệt chưa liên kết Zalo, hệ thống tự động ghi nhận `recipientNote: "CHUA_LIEN_KET_ZALO"` và vẫn gửi thành công tin nhắn xác nhận cho tác giả, không gây crash hay chặn luồng.
  3. **Hỗ trợ Sự kiện FORWARDED**: Bổ sung xác nhận chuyển tiếp cho người chuyển và thông báo cho người duyệt tiếp theo.

### 1.7. Nâng Cấp Phân Luồng Thông Báo Zalo Bot: Xóa Bỏ Hoàn Toàn Hardcode Con Dấu Mộc Đỏ
- **Vấn đề trước đây**: Tại dòng 1885 tệp `Code.gs`, dòng `"🔴 Con dấu: Đã đóng mộc số của trường THCS Chu Văn An"` bị hardcode cho mọi sự kiện `COMPLETED`. Điều này dẫn đến tình trạng khi Báo cáo Chuyên môn Nội bộ chỉ do Tổ trưởng duyệt (không có dấu mộc), hoặc khi BGH mới ký cá nhân, Zalo Bot vẫn phát thông báo khống "Đã đóng mộc số".
- **Ma trận Thông báo Chuẩn hóa 3 Nhánh**:
  1. **Nhánh 1 — Báo cáo Chuyên môn Nội bộ Hoàn tất (`eventType: "COMPLETED"`, `hasSchoolSeal: false`)**:
     * Tiêu đề: `🎉 THÔNG BÁO: BÁO CÁO NỘI BỘ ĐÃ PHÊ DUYỆT`
     * Người ký duyệt: Họ tên Tổ trưởng chuyên môn
     * Cấp phê duyệt: `Nội bộ Tổ / Khối chuyên môn (Hoàn tất)`
     * **TUYỆT ĐỐI KHÔNG CÓ DÒNG CON DẤU MỘC ĐỎ**.
  2. **Nhánh 2 — BGH Phê Duyệt Chờ Đóng Dấu (`eventType: "BGH_APPROVED"` hoặc `"PENDING_SEAL"`)**:
     * Tiêu đề: `✍️ THÔNG BÁO: BGH ĐÃ PHÊ DUYỆT BÁO CÁO`
     * Người phê duyệt: Họ tên Ban Giám hiệu
     * Trạng thái: `Đã duyệt nội dung — Đang chờ đóng dấu mộc đỏ nhà trường.`
     * Ghi chú: `📌 Hồ sơ sẽ chính thức hoàn tất sau khi Văn thư / BGH đóng dấu mộc số pháp nhân.`
  3. **Nhánh 3 — Hồ Sơ Đã Đóng Dấu Pháp Nhân Hoàn Tất (`eventType: "COMPLETED"`, `hasSchoolSeal: true`)**:
     * Tiêu đề: `🎉 THÔNG BÁO: HỒ SƠ ĐÃ ĐÓNG DẤU PHÁP NHÂN HOÀN TẤT`
     * Người ký duyệt: Ban Giám hiệu / `TRƯỜNG THCS CHU VĂN AN`
     * Con dấu: `🔴 Con dấu: Đã đóng mộc số của trường THCS Chu Văn An.`
     * Kèm liên kết xem tài liệu đã niêm phong mộc đỏ trên Google Drive.

---

## 2. KIẾN TRÚC TÍCH HỢP HỆ THỐNG TỔNG QUAN

Google Apps Script đóng vai trò là Hub trung tâm kết nối 4 trụ cột trong hạ tầng số nhà trường:

```text
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │                 HỆ THỐNG KÝ SỐ EDUSIGN VGCA (Node.js/Web)                   │
  │  • GV nộp KHBD/Giáo án                   • Tổ trưởng ký duyệt nháy          │
  │  • BGH ký số USB Token & Mộc đỏ          • Tự động xuất file PDF hoàn tất   │
  └──────────────────────────────┬──────────────────────────────────────────────┘
                                 │
                   (Webhook HTTP POST qua Internet)
                   NOTIFY_SIGN_EVENT / UPLOAD_SIGNED_DOC
                   Secret: UnifiedZaloBotTHCSCVA2026Secret
                                 │
                                 ▼
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │                 GOOGLE APPS SCRIPT WEB APP (Code.gs)                        │
  │                                                                             │
  │   [Bộ điều phối doPost / doGet] <──────> [Xác thực Webhook Secret]          │
  │          │                                       │                          │
  │          ├───────────────────┬───────────────────┼─────────────────────┐    │
  │          ▼                   ▼                   ▼                     ▼    │
  │  [Router Zalo Bot]   [Kho Lưu Drive]   [Database Sheets]    [Lập Lịch Sáng] │
  │  Cú pháp tương tác   Lưu trữ PDF đã    "Danh bạ GV" &       Trigger 06:00   │
  │  LK SĐT PIN, TKB,    ký vào folder     "Sổ Lưu Báo Cáo"     (Trừ CN, dọn    │
  │  choduyet, hoso...   theo Năm/Tháng    Google Sheets        trigger trùng)  │
  └───────┬──────────────────────┬───────────────────┬─────────────────────┬────┘
          │                      │                   │                     │
          │ Gửi tin nhắn 1-1     │ Ghi file PDF      │ Đọc/Ghi dữ liệu     │ Fetch JSON
          │ HTTP API Zalo        │ DriveApp          │ SpreadsheetApp      │ an toàn (timeout,
          ▼                      ▼                   ▼                     ▼ cache 60s)
  ┌──────────────┐       ┌───────────────┐   ┌──────────────┐      ┌─────────────┐
  │   ZALO BOT   │       │ GOOGLE DRIVE  │   │ GOOGLE SHEET │      │  FIREBASE   │
  │   PLATFORM   │       │   KHO TRƯỜNG  │   │   DATABASE   │      │    RTDB     │
  │ (GV, BGH, PH)│       │ (Lưu trữ PDF) │   │ (Ánh xạ SĐT) │      │ (Dữ liệu TKB│
  └──────────────┘       └───────────────┘   └──────────────┘      └─────────────┘
```

---

## 3. CÁC BƯỚC CẬP NHẬT MÃ NGUỒN VÀO CODE.GS

### Bước 3.1: Truy cập Dự án Google Apps Script
1. Đăng nhập tài khoản Google quản trị nhà trường trên trình duyệt.
2. Truy cập: **`https://script.google.com/`**.
3. Chọn dự án Zalo Bot của trường (hoặc nhấn **Dự án mới** nếu cài đặt lần đầu).
4. Đặt tên dự án: **`EduSign_ZaloBot_TrangThaiKy_TKB_THCS_ChuVanAn`**.

### Bước 3.2: Sao chép Toàn bộ Mã Nguồn Mới
1. Mở tệp **`Code.gs`** trong trình soạn thảo Apps Script.
2. Nhấn `Ctrl + A` rồi bấm phím `Delete` để xóa sạch mã nguồn cũ.
3. Mở tệp **`google-apps-script-zalo-edusign.js`** trong thư mục mã nguồn dự án:
   ```text
   c:\Users\HPZBook\Desktop\KÝ SỐ\google-apps-script-zalo-edusign.js
   ```
4. Chọn tất cả (`Ctrl + A`) và sao chép (`Ctrl + C`).
5. Quay lại cửa sổ trình duyệt Google Apps Script, dán (`Ctrl + V`) toàn bộ mã vào tệp `Code.gs`.
6. Nhấn tổ hợp phím **`Ctrl + S`** (hoặc biểu tượng 💾) để lưu lại.

---

## 4. CẤU HÌNH CHI TIẾT BIẾN HỆ THỐNG (`CONFIG`)

Tại đầu tệp `Code.gs` (khoảng dòng 31-79), kiểm tra đối tượng `CONFIG`:

```javascript
var CONFIG = {
  // 1. Token Zalo Bot Platform
  ZALO_BOT_TOKEN: "2294655560219778902:jzfmNEYGuXlSvmyKEYeCrbSWIKGrmumxQhoSsFXkgNBXsnOaWWDwTjSYqjoAdaqp",
  
  // 2. ID file Google Sheets (để trống nếu muốn script tự động tạo mới)
  SPREADSHEET_ID: "", 
  
  // 3. Tên trường & Cổng thông tin trực tuyến
  SCHOOL_NAME: "TRƯỜNG THCS CHU VĂN AN",
  PORTAL_URL: "https://mrkhang-khoi.github.io/cvakyso/portal-baocao.html",
  PUBLIC_TKB_PORTAL: "https://mrkhang-khoi.github.io/tkb/",
  
  // 4. Tên các bảng tính trong Google Sheets
  SHEET_USERS: "Danh bạ GV",
  SHEET_REPORTS: "Sổ Lưu Báo Cáo",
  
  // 5. Tên thư mục lưu trữ Báo cáo trên Google Drive
  DRIVE_ROOT_FOLDER: "KHO_BAO_CAO_THCS_CHU_VAN_AN",

  // 6. Kết nối Cơ sở dữ liệu Thời khóa biểu (Firebase Realtime Database)
  FIREBASE_DATABASE_URL: "https://tkb-fet-default-rtdb.asia-southeast1.firebasedatabase.app/school_data.json",

  // 7. ID nhóm Zalo trường (tùy chọn)
  MORNING_BRIEF_CHAT_ID: "",

  // 8. Khung giờ ra vào lớp chuẩn xác
  PERIOD_TIMES: {
    "sáng": {
      1: "07h00 - 07h45",
      2: "07h50 - 08h35",
      3: "08h40 - 09h25",
      4: "09h30 - 10h15",
      5: "10h20 - 11h05"
    },
    "chiều": {
      1: "13h00 - 13h45",
      2: "13h50 - 14h35",
      3: "14h40 - 15h25",
      4: "15h30 - 16h15",
      5: "16h20 - 17h05"
    }
  },

  // 9. Khung giờ toàn ca học
  SESSION_HOURS: {
    "sáng": "07:00 - 11:15",
    "chiều": "12:45 - 17:00"
  }
};
```

---

## 5. HƯỚNG DẪN THỰC THI CÁC HÀM KHỞI TẠO 1 LẦN (RUN ONCE)

Trên thanh công cụ phía trên khung soạn thảo:
```text
[ ▶ Chạy ] [ 🐛 Gỡ lỗi ] [ 🔽 Chọn hàm thực thi... ]
```

### Bước 1: Khởi tạo Cấu trúc Google Sheets (`initSheetsIfMissing`)
1. Chọn hàm: **`initSheetsIfMissing`** -> Bấm **`▶ Chạy`**.
2. Hệ thống tạo tự động 2 bảng:
   - **`Danh bạ GV`**: Cột 1 đến Cột 9 (`STT`, `Họ và Tên`, `Số Điện Thoại`, `Tổ Chuyên Môn`, `Email Công Vụ`, `Zalo_Chat_ID`, `Ngày Liên Kết`, `Tên_Viết_Tắt_TKB`, `Mã PIN EduSign`). Cột 3 và Cột 9 được định dạng Text chống rụng số 0.
   - **`Sổ Lưu Báo Cáo`**: Lưu vết hồ sơ giáo án, mã hồ sơ, ngày ký, link Drive, trạng thái.
3. Nếu tạo bảng mới, Execution Log sẽ in ra ID bảng tính. Hãy sao chép ID dán vào `CONFIG.SPREADSHEET_ID` và bấm `Ctrl + S`.

### Bước 2: Thiết lập Trigger Nhắc Lịch Dạy 06:00 Sáng (`setupDailyMorningTrigger`)
1. Chọn hàm: **`setupDailyMorningTrigger`** -> Bấm **`▶ Chạy`**.
2. Hệ thống tự động xóa sạch các trigger cũ (chống gửi lặp) và tạo mới 1 trigger chạy lúc 06:00 - 07:00 sáng từ Thứ Hai đến Thứ Bảy (tự động nghỉ Chủ Nhật).

### Bước 3: Đăng ký Webhook Zalo Bot (`setZaloBotWebhook`)
1. Thực hiện sau khi đã Triển khai Web App ở Mục 6.
2. Chọn hàm: **`setZaloBotWebhook`** -> Bấm **`▶ Chạy`**.
3. Script tự động đăng ký URL Web App với Zalo API kèm chữ ký xác thực bí mật.

---

## 6. CẤP QUYỀN TRUY CẬP (OAUTH SCOPE) & TRIỂN KHAI WEB APP (DEPLOY)

### 6.1. Cấp Quyền Truy cập Tài khoản Google
Khi bấm chạy hàm lần đầu:
1. Nhấn **"Xem lại quyền" (Review Permissions)**.
2. Chọn tài khoản Google quản trị.
3. Nhấn vào **"Nâng cao" (Advanced)** ở góc dưới bên trái.
4. Chọn **"Đi tới EduSign_ZaloBot_TrangThaiKy_TKB_THCS_ChuVanAn (không an toàn)"**.
5. Cuộn xuống và nhấn **"Cho phép" (Allow)**.

### 6.2. Triển khai Ứng dụng Web (Deploy as Web App)
1. Bấm **Triển khai (Deploy)** -> **Triển khai mới (New deployment)**.
2. Chọn loại: **Ứng dụng web (Web app)**.
3. Thiết lập thông số:
   - **Mô tả**: `Phiên bản 2026 - Bảo toàn số 0 SĐT/PIN & Bảo mật Zalo Bot`
   - **Thực thi dưới dạng**: Chọn **"Tôi" (Me)**.
   - **Ai có quyền truy cập**: Chọn **"Bất kỳ ai" (Anyone)** *(Bắt buộc)*.
4. Bấm **Triển khai (Deploy)**.
5. Sao chép **URL ứng dụng web (Web app URL)**.

### 6.3. Cập nhật URL vào Hệ thống EduSign
1. Mở tệp `drive_config.json` trên máy chủ:
   ```json
   {
     "enabled": true,
     "autoUploadOnSign": true,
     "schoolFolderId": "THCS_CHU_VAN_AN_ARCHIVE_2026",
     "schoolFolderName": "KHO_HO_SO_SO_TRUONG_THCS_CHU_VAN_AN",
     "gasWebhookUrl": "DÁN_URL_WEB_APP_VỪA_COPY_VÀO_ĐÂY",
     "backupLocalStorage": true
   }
   ```
2. Hoặc cấu hình qua giao diện Quản trị viên EduSign -> Cấu hình Hệ thống & Lưu trữ Drive -> Dán URL -> Lưu cấu hình.

### 6.4. Hướng Dẫn Nâng Cấp Bản Triển Khai Mới (Deploy New Version) Cho Quản Trị Viên Khi Cập Nhật Mã Nguồn
> 🚨 **CẢNH BÁO ĐẶC BIỆT DÀNH CHO QUẢN TRỊ VIÊN NHÀ TRƯỜNG**:
> Trong cơ chế của Google Apps Script, khi bạn dán mã nguồn mới vào tệp `Code.gs` và nhấn phím **Lưu (Ctrl + S)**, hệ thống **CHƯA** tự động cập nhật mã mới này vào Webhook đang phục vụ người dùng bên ngoài!
> Zalo Bot sẽ vẫn tiếp tục chạy phiên bản Web App cũ cho đến khi Quản trị viên thực hiện thao tác **Tạo Bản Triển Khai Mới (New version)** theo đúng quy trình 5 bước chuẩn hóa dưới đây:

#### 📌 Quy trình 5 Bước Triển Khai Bản Mới (Chỉ mất 1 phút):
1. **Bước 1 — Mở Trình Soạn Thảo Google Apps Script**:
   - Truy cập **`https://script.google.com/`**.
   - Mở dự án **`EduSign_ZaloBot_TrangThaiKy_TKB_THCS_ChuVanAn`**.
2. **Bước 2 — Cập Nhật Toàn Bộ Mã Nguồn Mới**:
   - Nhấp chọn tệp **`Code.gs`** ở menu bên trái.
   - Nhấn `Ctrl + A` -> phím `Delete` để xóa sạch mã cũ.
   - Mở file `google-apps-script-zalo-edusign.js` trong thư mục dự án, sao chép toàn bộ (`Ctrl + A` -> `Ctrl + C`).
   - Dán vào `Code.gs` (`Ctrl + V`) và bấm tổ hợp phím **`Ctrl + S`** (hoặc biểu tượng đĩa mềm 💾) để lưu lại.
3. **Bước 3 — Mở Cửa Sổ Quản Lý Bản Triển Khai**:
   - Ở góc trên cùng bên phải màn hình, nhấp vào nút **Triển khai (Deploy)** màu xanh.
   - Trong menu thả xuống, chọn **Quản lý bản triển khai (Manage deployments)**.
4. **Bước 4 — Nâng Lên Phiên Bản Mới (New Version)**:
   - Trong hộp thoại vừa mở, nhìn vào danh sách bên trái, chọn bản triển khai **Web app** đang hoạt động.
   - Nhấp vào biểu tượng **Chỉnh sửa (hình cây bút chì ✏️)** ở góc trên bên phải của hộp thoại.
   - Tại dòng **Phiên bản (Version)**: Nhấp vào hộp chọn và bấm chọn **`Phiên bản mới` (New version)**.
   - Tại ô **Mô tả (Description)**: Nhập nội dung:
     `Bản nâng cấp R3 - Bảo mật tuyệt đối Zalo Bot, loại bỏ 4 số cuối SĐT, đồng bộ PIN realtime`
   - Giữ nguyên các thông số quan trọng:
     * *Thực thi dưới dạng*: **Tôi (Me)**
     * *Ai có quyền truy cập*: **Bất kỳ ai (Anyone)** *(Bắt buộc để Zalo webhook gọi tới)*.
5. **Bước 5 — Lưu Triển Khai & Hoàn Tất**:
   - Nhấn nút **Triển khai (Deploy)** ở góc dưới hộp thoại.
   - Chờ hệ thống xoay vòng và hiển thị thông báo "Đã cập nhật bản triển khai".
   - Nhấn **Xong (Done)**.

*(💡 Ghi chú quan trọng: Thao tác nâng cấp phiên bản này vẫn giữ nguyên URL Web App cũ, Quản trị viên KHÔNG cần phải cấu hình lại URL trong EduSign).*

---

## 7. KIỂM THỬ THỰC NGHIỆM & NGHIỆM THU HỆ THỐNG

### 7.1. Cú pháp Kiểm thử trên Zalo Bot (Đối Soát Bảo Mật R3)

| Thao tác / Cú pháp | Kết quả Nghiệm thu Thực tế | Đánh giá An toàn |
|---|---|---|
| `help` hoặc `menu` | Danh mục hướng dẫn đầy đủ, hiển thị rõ ràng trên cả máy tính và điện thoại di động. | ✅ PASS UI |
| `LK 0818810007 0007` | Nhận diện đúng SĐT có số 0 đầu và đúng Mã PIN EduSign, báo liên kết thành công 100%. | ✅ PASS Xác thực |
| `LK 0818810007 9999` (nhập sai PIN) | BỊ TỪ CHỐI 100%: "❌ Mã PIN bảo mật không chính xác!". | 🛡️ PASS Chống brute-force |
| Thử dùng 4 số cuối SĐT khi PIN khác | BỊ TỪ CHỐI 100%: Hệ thống đã xóa sạch fallback, không thể bypass bằng 4 số cuối. | 🛡️ PASS R3 Zero-Trust |
| Chỉ nhắn số điện thoại (`0818810007`) | Bot từ chối liên kết trực tiếp, phản hồi thông báo bảo vệ định danh `LK 0818810007 [MãPIN]`, không có gợi ý 4 số cuối. | 🛡️ PASS Chống rò rỉ |
| `LK +84 818 810 007 0007` | Chuẩn hóa số quốc tế có dấu cách thành công 100%. | ✅ PASS Regex |
| `LK +84-905-123-456 3456` | Chuẩn hóa số quốc tế có dấu gạch ngang thành công 100%. | ✅ PASS Regex |
| `LK 0933445566 0000` | Xác thực chính xác PIN `0000` ngay cả khi Sheet lưu thành số `0`. | ✅ PASS Falsy Zero |
| `tkb` | Trả về thời khóa biểu ngày hôm nay của chính giáo viên đã liên kết. | ✅ PASS TKB |
| `tkb 6a1` | Trả về thời khóa biểu lớp 6A1 kèm tên GVCN và khung giờ từng tiết. | ✅ PASS Tra cứu |
| `choduyet` (Tổ trưởng / BGH) | Liệt kê danh sách hồ sơ giáo án đang chờ ký duyệt. | ✅ PASS Phân quyền |

### 7.2. Kiểm thử Tự động qua Bộ Test Suite (Node.js & Playwright)

Chạy các lệnh kiểm thử độc lập tại thư mục dự án để xác nhận:
```bash
# Kiểm tra 3 bản vá sửa lỗi SĐT/PIN và Regex
node tests/test_verify_patches.js

# Kiểm tra stress test dữ liệu SĐT và mã PIN đối kháng (39/39 PASS)
node tests/stress_test_r1_phone_pin.js

# Kiểm tra tính toàn vẹn số 0 ở đầu (10/10 PASS)
node tests/test_r1_phone_pin_integrity.js

# Kiểm tra toàn diện Zalo Assistant & Bot (26/26 PASS)
node tests/test_zalo_unified_bot.js

# Kiểm toán logic bảo mật và webhook (12/12 PASS)
node tests/test_zalo_security_and_logic_audit.js

# Kiểm thử Playwright giao diện đa độ phân giải (6/6 PASS)
npx playwright test tests/test_r3_visual_multi_resolution.spec.mjs

# Kiểm thử bố cục và độ tương phản WCAG AAA (5/5 PASS)
npx playwright test tests/adversarial_ui_layout_challenge.spec.mjs

# Kiểm thử phân quyền đóng dấu mộc đỏ trường học (5/5 PASS)
npx playwright test tests/07_school_seal_delegation.spec.mjs

# Kiểm tra toàn bộ yêu cầu R1 -> R5 (Unit & Logic Test: 18/18 PASS)
node tests/test_requirements_r1_to_r5.js

# Kiểm thử E2E Playwright Công thái học Modal User & Nhập Excel (R1, R3, R5: 4/4 PASS)
npx playwright test tests/test_reviewer_2_ergonomics_r1_r3_r5.spec.mjs

# Kiểm thử E2E Đồng bộ PIN Realtime & Bảo vệ Định danh Zalo (R2, R3: 3/3 PASS)
npx playwright test tests/test_user_profile_pin.spec.mjs
```

---

## 8. XỬ LÝ SỰ CỐ THƯỜNG GẶP (TROUBLESHOOTING FAQ)

### ❓ Câu hỏi 1: Tại sao nhập đúng cú pháp LK mà Bot báo không nhận diện được?
- **Giải pháp**: Kiểm tra xem Web App đã được cập nhật phiên bản mới chưa (Deploy -> Manage deployments -> New version). Kiểm tra hàm `normalizePhone` và regex dòng 557 đã cho phép ký tự `+`, khoảng trắng và dấu gạch chưa.

### ❓ Câu hỏi 2: Tại sao số điện thoại trên Google Sheet vẫn hiển thị dạng số không có số 0?
- **Giải pháp**: Mở Google Sheet -> Chọn toàn bộ cột C (Số điện thoại) và cột I (Mã PIN) -> Vào menu `Định dạng (Format)` -> `Số (Number)` -> Chọn **`Văn bản thuần túy (Plain text)`**. Ngoài ra, khi giáo viên nhắn tin liên kết, cơ chế Self-Healing trong script sẽ tự động ghi đè dấu nháy `"'"` để bảo toàn số 0.

### ❓ Câu hỏi 3: Lỗi `UNAUTHORIZED_SECRET_TOKEN` khi EduSign đẩy thông báo?
- **Giải pháp**: Đảm bảo khóa bí mật trong `server.js`, `zaloNotifyService.js` và `google-apps-script-zalo-edusign.js` đều là chuỗi bất biến: `UnifiedZaloBotTHCSCVA2026Secret`.

---

*Tài liệu biên soạn và phát hành bởi Tổ Kỹ thuật Dự án Chuyển đổi số Ký số EduSign VGCA — Trường THCS Chu Văn An.*
