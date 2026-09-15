# 📘 HƯỚNG DẪN CẬP NHẬT VÀ TRIỂN KHAI MÃ NGUỒN GOOGLE APPS SCRIPT (CODE.GS)
## HỆ THỐNG TRỢ LÝ ZALO BOT TRƯỜNG HỌC 4.0 & KÝ SỐ EDUSIGN VGCA
### TRƯỜNG THCS CHU VĂN AN — XÃ ĐĂK HÀ — TỈNH QUẢNG NGÃI

---

> **Dành cho**: Quản trị viên CNTT Nhà trường, Ban Giám hiệu, Tổ trưởng Chuyên môn  
> **Phiên bản mã nguồn**: `google-apps-script-zalo-edusign.js` (Bản nâng cấp 2026)  
> **Thời gian thao tác ước tính**: 5 – 10 phút  
> **Mức độ phức tạp**: Đơn giản (Chỉ thao tác trên trình duyệt web, không cần cài đặt phần mềm)

---

## 📑 MỤC LỤC CHI TIẾT

1. [Giới thiệu & Kiến trúc Hệ thống Tổng quan](#1-giới-thiệu--kiến-trúc-hệ-thống-tổng-quan)
2. [Các bước Chuẩn bị & Cập nhật Mã nguồn trên Google Apps Script](#2-các-bước-chuẩn-bị--cập-nhật-mã-nguồn-trên-google-apps-script)
3. [Cấu hình Chi tiết Tham số Hệ thống (`CONFIG`)](#3-cấu-hình-chi-tiết-tham-số-hệ-thống-config)
4. [Hướng dẫn Chạy các Hàm Khởi tạo 1 Lần (Run Once)](#4-hướng-dẫn-chạy-các-hàm-khởi-tạo-1-lần-run-once)
5. [Hướng dẫn Cấp quyền Truy cập (OAuth Scope) & Triển khai Web App](#5-hướng-dẫn-cấp-quyền-truy-cập-oauth-scope--triển-khai-web-app)
6. [Kiểm thử & Nghiệm thu Vận hành Thực tế](#6-kiểm-thử--nghiệm-thu-vận-hành-thực-tế)
7. [Xử lý Sự cố Thường gặp (Troubleshooting FAQ)](#7-xử-lý-sự-cố-thường-gặp-troubleshooting-faq)

---

## 1. GIỚI THIỆU & KIẾN TRÚC HỆ THỐNG TỔNG QUAN

Trong hệ sinh thái chuyển đổi số của **Trường THCS Chu Văn An**, tệp Google Apps Script (`Code.gs`) đóng vai trò là **Bộ não Điều phối Trung tâm (Central Integration Hub)** và **Cầu nối Webhook Hai Chiều (Bidirectional Bridge)** kết nối 4 nền tảng cốt lõi:

1. **Hệ thống Ký số Giáo án Điện tử EduSign VGCA**: Nền tảng web cho phép giáo viên nộp kế hoạch bài dạy (KHBD), ký số cá nhân, tổ trưởng ký nháy chuyên môn và Ban Giám hiệu ký số USB Token kèm đóng dấu mộc đỏ điện tử.
2. **Google Apps Script & Google Cloud Platform**: Xử lý logic nghiệp vụ, quản lý cơ sở dữ liệu trên Google Sheets, sao lưu hồ sơ sang Google Drive Kho trường, chạy các Time-based Triggers tự động 06:00 sáng.
3. **Zalo Bot Platform (Trợ lý Trường học 4.0)**: Kênh tương tác tức thì 0 đồng trên điện thoại giáo viên và học sinh/phụ huynh, thông báo tiến độ phê duyệt hồ sơ và gửi lịch giảng dạy mỗi sáng.
4. **Firebase Realtime Database (TKB Online)**: Cơ sở dữ liệu thời khóa biểu trường học đồng bộ thời gian thực, lưu trữ lịch giảng dạy chính khóa, phòng học và các ca phân công dạy thay.

### Sơ đồ Kiến trúc Luồng Dữ liệu (Data Flow Architecture)

```text
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │                 HỆ THỐNG KÝ SỐ EDUSIGN VGCA (Node.js/Web)                   │
  │  • GV nộp kế hoạch bài dạy (KHBD)        • Tổ trưởng duyệt ký nháy          │
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
          │                      │                   │                     │ Fetch JSON
          │ Gửi tin nhắn 1-1     │ Ghi file PDF      │ Đọc/Ghi dữ liệu     │ an toàn (timeout,
          │ HTTP API Zalo        │ DriveApp          │ SpreadsheetApp      │ cache 60s)
          ▼                      ▼                   ▼                     ▼
  ┌──────────────┐       ┌───────────────┐   ┌──────────────┐      ┌─────────────┐
  │   ZALO BOT   │       │ GOOGLE DRIVE  │   │ GOOGLE SHEET │      │  FIREBASE   │
  │   PLATFORM   │       │   KHO TRƯỜNG  │   │   DATABASE   │      │    RTDB     │
  │ (GV, BGH, PH)│       │ (Lưu trữ PDF) │   │ (Ánh xạ SĐT) │      │ (Dữ liệu TKB│
  └──────────────┘       └───────────────┘   └──────────────┘      └─────────────┘
```

---

## 2. CÁC BƯỚC CHUẨN BỊ & CẬP NHẬT MÃ NGUỒN TRÊN GOOGLE APPS SCRIPT

### Bước 2.1: Truy cập Dự án trên Google Apps Script
1. Mở trình duyệt (Google Chrome, Microsoft Edge hoặc Cốc Cốc) và đăng nhập vào tài khoản Google của trường hoặc tài khoản quản trị viên.
2. Truy cập đường dẫn: **`https://script.google.com/`**.
3. Tại bảng điều khiển Google Apps Script:
   - Nếu đã có dự án Zalo Bot của trường: Nhấp chuột vào tên dự án (ví dụ: `Zalo_Bot_EduSign_THCS_ChuVanAn`).
   - Nếu tạo mới hoàn toàn: Nhấn vào nút **"Dự án mới" (New Project)** ở góc trên bên trái màn hình.

### Bước 2.2: Đổi tên Dự án Chuẩn mực
1. Nhấp vào dòng chữ `Dự án không có tiêu đề` (Untitled project) ở góc trên bên trái.
2. Đổi tên thành: **`EduSign_ZaloBot_TrangThaiKy_TKB_THCS_ChuVanAn`** -> Nhấn **Đổi tên (Rename)**.

### Bước 2.3: Sao chép Toàn bộ Mã Nguồn Mới
1. Tại cây thư mục bên trái của giao diện biên soạn, mở tệp **`Code.gs`**.
2. Nhấn `Ctrl + A` (trên Windows) rồi nhấn phím `Delete` hoặc `Backspace` để **xóa sạch toàn bộ nội dung cũ**.
3. Mở tệp **`google-apps-script-zalo-edusign.js`** trong thư mục mã nguồn dự án tại máy tính:
   ```text
   c:\Users\HPZBook\Desktop\KÝ SỐ\google-apps-script-zalo-edusign.js
   ```
4. Chọn tất cả (`Ctrl + A`) và sao chép (`Ctrl + C`).
5. Quay lại trình duyệt Google Apps Script, dán (`Ctrl + V`) toàn bộ nội dung vào tệp **`Code.gs`**.
6. Nhấn tổ hợp phím **`Ctrl + S`** (hoặc biểu tượng đĩa mềm 💾) để lưu lại mã nguồn.

> ⚠️ **Lưu ý quan trọng**: Không chia nhỏ mã thành nhiều file trừ khi bạn là lập trình viên chuyên sâu. Toàn bộ kiến trúc trong `google-apps-script-zalo-edusign.js` đã được hợp nhất hoàn chỉnh trong một file duy nhất để tối ưu hóa tốc độ nạp (cold start) và tránh lỗi tham chiếu chéo giữa các tệp của Google Apps Script.

---

## 3. CẤU HÌNH CHI TIẾT THAM SỐ HỆ THỐNG (`CONFIG`)

Ngay đầu tệp `Code.gs` (khoảng từ dòng 31 đến dòng 79), bạn sẽ thấy đối tượng cấu hình `CONFIG`. Hãy kiểm tra và điều chỉnh các giá trị cho chính xác:

```javascript
// ====================================================================================================
// 🌟 1. CẤU HÌNH HỆ THỐNG TOÀN DIỆN
// ====================================================================================================
var CONFIG = {
  // 1. Token Zalo Bot Platform (Cấp từ Zalo Platform Developer)
  ZALO_BOT_TOKEN: "2294655560219778902:jzfmNEYGuXlSvmyKEYeCrbSWIKGrmumxQhoSsFXkgNBXsnOaWWDwTjSYqjoAdaqp",
  
  // 2. ID file Google Sheets làm cơ sở dữ liệu (để trống nếu muốn script tự động tạo mới)
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

  // 7. ID nhóm Zalo trường nếu muốn gửi bản tin TKB tổng hợp vào nhóm lúc 6h30 sáng (tùy chọn)
  MORNING_BRIEF_CHAT_ID: "",

  // 8. KHUNG GIỜ RA VÀO LỚP CHUẨN XÁC CỦA NHÀ TRƯỜNG (CẤU HÌNH LINH HOẠT)
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

  // 9. KHUNG GIỜ TOÀN CA HỌC (SÁNG: 07:00 - 11:15, CHIỀU: 12:45 - 17:00)
  SESSION_HOURS: {
    "sáng": "07:00 - 11:15",
    "chiều": "12:45 - 17:00"
  }
};
```

### Bảng Giải thích Chi tiết Từng Tham số

| Tham số | Ý nghĩa & Hướng dẫn Cấu hình | Lưu ý Thực tế |
|---|---|---|
| `SPREADSHEET_ID` | **ID của bảng tính Google Sheets**. Cách lấy:<br>Mở bảng tính Google Sheets của trường trên trình duyệt. Nhìn lên thanh địa chỉ URL có dạng:<br>`https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit`<br>👉 Chuỗi ký tự nằm giữa `/d/` và `/edit` chính là ID: `1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms`. | Nếu bạn chưa có sẵn bảng tính, hãy **để chuỗi rỗng `""`**. Khi chạy hàm `initSheetsIfMissing()`, script sẽ tự động tạo một bảng tính mới với tên `EduSign_DuLieu_KYS_THCS_ChuVanAn` và in mã ID ra màn hình cho bạn copy dán vào đây. |
| `ZALO_BOT_TOKEN` | Mã Token của Zalo Bot Platform (dạng `AppID:SecretKey`). Được cấp từ trang quản trị Zalo Platform Developer khi tạo Bot. | Giữ bí mật tuyệt đối token này để tránh người ngoài can thiệp bot. |
| `FIREBASE_DATABASE_URL` | Đường dẫn kết nối API dữ liệu thời khóa biểu trường: `https://tkb-fet-default-rtdb.asia-southeast1.firebasedatabase.app/school_data.json`. | Script kết nối an toàn qua phương thức GET, tự động lưu bộ nhớ đệm (Cache) 60 giây và có cơ chế xử lý khi mất kết nối. |
| `SYSTEM_SECRET` | Khóa bí mật đồng bộ bảo mật: **`UnifiedZaloBotTHCSCVA2026Secret`** (được nhúng tại dòng 400 trong `doPost`). | Khóa này phải trùng khớp 100% với giá trị `secret_token` được gửi từ `zaloNotifyService.js` và `googleDriveService.js` để ngăn chặn hacker tấn công giả mạo webhook. |
| `MORNING_BRIEF_CHAT_ID` | Mã định danh phòng chat (Chat ID) của **Nhóm Zalo Hội đồng Sư phạm** toàn trường. Dùng để tự động gửi bản tin TKB tổng hợp lúc 06:30 sáng. | Nếu không muốn gửi vào nhóm mà chỉ gửi lịch riêng cho từng giáo viên, bạn có thể để chuỗi rỗng `""`. |
| `PERIOD_TIMES` | Bảng khung giờ vào/ra lớp của từng tiết (Tiết 1 đến Tiết 5) cho cả ca sáng và ca chiều. | Đã được thiết lập chuẩn theo quy định của Trường THCS Chu Văn An: Sáng (07h00 - 11h05), Chiều (13h00 - 17h05). |
| `SESSION_HOURS` | Khung giờ bao quát toàn bộ buổi học: Sáng `07:00 - 11:15`, Chiều `12:45 - 17:00`. | Dùng trong bản tin TKB toàn trường để thầy cô nhanh chóng nắm bắt ca trực và thời gian sinh hoạt chung. |

---

## 4. HƯỚNG DẪN CHẠY CÁC HÀM KHỞI TẠO 1 LẦN (RUN ONCE)

Sau khi dán mã và cấu hình xong, bạn cần thực hiện chạy tuần tự **4 hàm khởi tạo** ngay trên thanh công cụ của Google Apps Script (Thao tác này chỉ cần làm 1 lần duy nhất khi thiết lập hệ thống).

Trên thanh công cụ phía trên khung soạn thảo:
```text
[ ▶ Chạy ] [ 🐛 Gỡ lỗi ] [ 🔽 Chọn hàm thực thi... ]
```

---

### 🔹 Bước 1: Khởi tạo Cơ sở Dữ liệu Google Sheets (`initSheetsIfMissing`)
1. Nhấp vào ô chọn hàm trên thanh công cụ, tìm và chọn hàm: **`initSheetsIfMissing`**.
2. Nhấn nút **`▶ Chạy` (Run)**.
3. *Nếu là lần đầu chạy, Google sẽ yêu cầu Duyệt quyền truy cập* (Xem chi tiết cách duyệt quyền ở [Mục 5](#5-hướng-dẫn-cấp-quyền-truy-cập-oauth-scope--triển-khai-web-app)).
4. **Kết quả đạt được**:
    - Hệ thống tự động tạo và định dạng chuẩn **2 trang tính cơ sở dữ liệu cốt lõi**:
      - **Trang 1 — `Danh bạ GV`**: Chứa 9 cột: `STT`, `Họ và Tên`, `Số Điện Thoại`, `Tổ Chuyên Môn`, `Email Công Vụ`, `Zalo_Chat_ID`, `Ngày Liên Kết`, `Tên_Viết_Tắt_TKB`, **`Mã PIN` (Cột I)**. Hàng tiêu đề có nền xanh Navy (`#1e40af`), chữ trắng in đậm, cố định hàng 1 (Frozen row). *(Lưu ý: Nếu bảng tính của trường đã có sẵn từ trước, script sẽ tự động tạo thêm tiêu đề cột 9 `Mã PIN` mà không làm ảnh hưởng đến dữ liệu cũ)*.
      - **Trang 2 — `Sổ Lưu Báo Cáo`**: Chứa các cột `Mã Hồ Sơ`, `Tiêu Đề Báo Cáo`, `Tác Giả`, `Số Điện Thoại`, `Tổ Chuyên Môn`, `Người Ký BGH`, `Ngày Ký Duyệt`, `Trạng Thái`, `Link Xem Drive`, `Link Tải`, `Ghi Chú`. Hàng tiêu đề có nền xanh ngọc đậm (`#047857`), chữ trắng in đậm.
    - Nếu trước đó `CONFIG.SPREADSHEET_ID` để trống, nhật ký thực thi (Execution Log) bên dưới sẽ hiển thị:
      ```text
      ✅ ĐÃ TẠO GOOGLE SHEET MỚI THÀNH CÔNG! ID: 1Y0HQ2Pi-XvtgmOuPqQK-H8Ay5lzVUCh9uzd54Czll2I
      👉 Hãy copy ID này dán vào mục CONFIG.SPREADSHEET_ID: 1Y0HQ2Pi-XvtgmOuPqQK-H8Ay5lzVUCh9uzd54Czll2I
      ```
      Hãy copy ID đó dán vào `CONFIG.SPREADSHEET_ID` và nhấn `Ctrl + S`.

---

### 🔹 Bước 2: Thiết lập Lịch Nhắc TKB 06:00 Sáng (`setupDailyMorningTrigger`)
1. Tại ô chọn hàm, chọn: **`setupDailyMorningTrigger`**.
2. Nhấn nút **`▶ Chạy` (Run)**.
3. **Cơ chế hoạt động**:
   - Hàm tự động gọi `removeOldTriggers("sendDailyMorningPersonalSchedule")` để quét và xóa sạch mọi trigger cũ còn sót lại, **triệt tiêu hoàn toàn nguy cơ gửi tin nhắn lặp lại hoặc spam**.
   - Tạo mới một Time-based Trigger hàng ngày kích hoạt hàm `sendDailyMorningPersonalSchedule` vào khoảng **06:00 – 07:00 sáng**.
   - **Cơ chế loại trừ Chủ Nhật thông minh**: Khi trigger kích hoạt vào sáng Chủ Nhật, hàm tự động phát hiện `dayOfWeek === 0`, ghi nhận log `🌴 Hôm nay là Chủ Nhật. Bỏ qua gửi tin nhắn giảng dạy` và kết thúc ngay mà không làm phiền thầy cô.
4. **Nhật ký hiển thị**:
   ```text
   🧹 Đã dọn dẹp 1 trigger (sendDailyMorningPersonalSchedule).
   ✅ ĐÃ THIẾT LẬP TRIGGER THÀNH CÔNG! Bot sẽ tự động gửi tin nhắn lịch dạy cho giáo viên lúc 06:00 - 07:00 sáng hàng ngày (thứ Hai đến thứ Bảy, trừ Chủ Nhật).
   ```

---

### 🔹 Bước 3: Thiết lập Gửi Bản tin Nhóm Toàn trường (`setupMorningBriefGroupTrigger`) — *Tùy chọn*
*(Chỉ thực hiện nếu trường có nhóm Zalo chung và đã điền `CONFIG.MORNING_BRIEF_CHAT_ID`)*
1. Tại ô chọn hàm, chọn: **`setupMorningBriefGroupTrigger`**.
2. Nhấn nút **`▶ Chạy` (Run)**.
3. **Cơ chế hoạt động**:
   - Dọn dẹp trigger nhóm cũ.
   - Lập lịch tự động gửi tin nhắn tổng hợp toàn trường vào nhóm lúc 06:30 sáng, bao gồm:
     - Số lượng lớp học ca sáng (`07:00 - 11:15`) và ca chiều (`12:45 - 17:00`).
     - Danh sách phân công dạy thay trong ngày (chỉ rõ tiết, lớp, môn, giáo viên vắng, giáo viên dạy thay).
4. **Nhật ký hiển thị**:
   ```text
   ✅ ĐÃ THIẾT LẬP TRIGGER BẢN TIN NHÓM THÀNH CÔNG! Bot sẽ tự động gửi bản tin TKB tổng hợp tới nhóm lúc 06:00 - 07:00 sáng hàng ngày.
   ```

---

### 🔹 Bước 4: Đăng ký Webhook với Máy chủ Zalo (`setZaloBotWebhook`)
1. **Lưu ý**: Bước này phải thực hiện **SAU KHI ĐÃ TRIỂN KHAI ỨNG DỤNG WEB** ở [Mục 5](#5-hướng-dẫn-cấp-quyền-truy-cập-oauth-scope--triển-khai-web-app) để Google Apps Script có URL dịch vụ (`ScriptApp.getService().getUrl()`).
2. Tại ô chọn hàm, chọn: **`setZaloBotWebhook`**.
3. Nhấn nút **`▶ Chạy` (Run)**.
4. Script sẽ tự động gửi yêu cầu đăng ký URL Web App của Google sang API của Zalo Bot Platform kèm chữ ký xác thực bảo mật `UnifiedZaloBotTHCSCVA2026Secret`.
5. **Nhật ký hiển thị**:
   ```text
   ✅ Kết quả đăng ký Webhook: {"error":0,"message":"Success"}
   ```

---

## 5. HƯỚNG DẪN CẤP QUYỀN TRUY CẬP (OAUTH SCOPE) & TRIỂN KHAI (DEPLOY)

### 5.1. Quy trình Cấp quyền Truy cập Tài khoản Google (OAuth Consent)
Khi chạy một hàm bất kỳ lần đầu tiên, Google sẽ hiển thị hộp thoại cảnh báo bảo mật. Hãy làm theo các bước sau:

1. Xuất hiện hộp thoại: **"Cần ủy quyền" (Authorization Required)**  
   👉 Nhấn nút **"Xem lại quyền" (Review Permissions)**.
2. Chọn tài khoản Google quản trị mà bạn đang sử dụng.
3. Xuất hiện màn hình cảnh báo: **"Google chưa xác minh ứng dụng này" (Google hasn’t verified this app)**  
   *(Đây là cảnh báo bình thường của Google đối với script do người dùng tự viết trong nội bộ)*  
   👉 Nhấn vào dòng chữ nhỏ **"Nâng cao" (Advanced)** ở góc dưới bên trái.
4. Bấm tiếp vào dòng liên kết: **"Đi tới [Tên dự án] (không an toàn)" / "Go to EduSign_ZaloBot_TrangThaiKy_TKB_THCS_ChuVanAn (unsafe)"**.
5. Màn hình chi tiết quyền hạn hiển thị:
   - *Xem, chỉnh sửa, tạo và xóa bảng tính Google Sheets của bạn.*
   - *Xem, chỉnh sửa, tạo và xóa các tệp trong Google Drive của bạn.*
   - *Kết nối với một dịch vụ bên ngoài (UrlFetchApp).*
   - *Cho phép ứng dụng này chạy khi bạn không có mặt (Triggers).*  
   👉 Cuộn xuống dưới cùng và nhấn nút **"Cho phép" (Allow)**.

---

### 5.2. Các bước Triển khai Ứng dụng Web (Deploy as Web App)

Để máy chủ EduSign và máy chủ Zalo có thể giao tiếp với Google Apps Script qua Internet, bạn **bắt buộc phải Triển khai dưới dạng Web App**:

```text
       [ Nút "Triển khai" (Deploy) màu xanh ở góc trên bên phải ]
                                 │
                                 ▼
                    [ Triển khai mới (New deployment) ]
                                 │
                                 ▼
                     [ ⚙️ Chọn loại: Ứng dụng web ]
```

1. Ở góc trên cùng bên phải giao diện Apps Script, nhấp vào nút **"Triển khai" (Deploy)** -> Chọn **"Triển khai mới" (New deployment)**.
2. Trong hộp thoại Triển khai mới:
   - Nhấp vào biểu tượng Bánh răng (⚙️) ở bên cạnh chữ **"Chọn loại" (Select type)** -> Chọn **"Ứng dụng web" (Web app)**.
3. Điền các trường cấu hình chuẩn xác như sau:
   - **Mô tả (Description)**: `Bản phát hành chính thức 2026 - Zalo Bot TKB & Ký số Chu Văn An`
   - **Thực thi dưới dạng (Execute as)**: Chọn **"Tôi (email_cua_ban@gmail.com)" (Me)**.  
     *(Điều này đảm bảo script luôn có toàn quyền ghi vào Google Sheet và Google Drive của bạn mà không phụ thuộc vào tài khoản người gửi)*
   - **Ai có quyền truy cập (Who has access)**: Chọn **"Bất kỳ ai" (Anyone)**.  
     *(Bắt buộc phải chọn "Bất kỳ ai" để Zalo Bot Server và Node.js EduSign có thể gửi POST Webhook mà không bị Google chặn màn hình đăng nhập)*
4. Nhấn nút **"Triển khai" (Deploy)** ở góc dưới.
5. Quá trình tạo bản triển khai hoàn tất! Hộp thoại sẽ cung cấp cho bạn:
   - **URL ứng dụng web (Web app URL)** có dạng:
     ```text
     https://script.google.com/macros/s/AKfycbwGBgauc9xHzRe31_IfCQD-Q9yHwGp4CfYLEam9IupcYhLpNBXbgW0J1t-weD6iUQ87ZQ/exec
     ```
6. Nhấn nút **"Sao chép" (Copy)** để lưu URL này lại.

---

### 5.3. Cập nhật Webhook URL vào Hệ thống Ký số EduSign
1. Mở tệp **`drive_config.json`** trong thư mục mã nguồn EduSign trên máy chủ:
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
2. Dán URL Web App vừa sao chép vào trường `"gasWebhookUrl"` và lưu tệp lại.
3. Hoặc mở giao diện Quản trị viên EduSign -> Vào mục **Cấu hình Hệ thống & Lưu trữ Drive** -> Dán URL vào ô **Google Apps Script Webhook URL** -> Nhấn **Lưu cấu hình**.

> 💡 **Quy tắc Vàng khi Chỉnh sửa Code về sau**:  
> Mỗi lần bạn chỉnh sửa bất kỳ dòng code nào trong `Code.gs`, để thay đổi có hiệu lực với Web App bên ngoài, bạn phải:  
> Bấm **Triển khai (Deploy)** -> **Quản lý bản triển khai (Manage deployments)** -> Chọn bản triển khai đang dùng -> Bấm biểu tượng **Cây bút chì (Chỉnh sửa)** -> Ở mục **Phiên bản (Version)** chọn **"Phiên bản mới" (New version)** -> Nhấn **Triển khai (Deploy)**. Nếu không làm bước này, Web App vẫn sẽ chạy mã nguồn cũ!

---

## 6. KIỂM THỬ & NGHIỆM THU SAU KHI TRIỂN KHAI

Sau khi đã hoàn tất cấu hình và triển khai, bạn tiến hành kiểm thử theo 2 phần: **Kiểm thử Tương tác Zalo Bot** và **Kiểm thử Webhook HTTP POST**.

### 6.1. Kiểm thử Tương tác Trực tiếp trên Ứng dụng Zalo

Dùng điện thoại hoặc Zalo máy tính, tìm đến Bot Zalo của trường và thử các câu lệnh sau:

| Thao tác / Tin nhắn gửi | Kết quả Mong đợi từ Zalo Bot |
|---|---|
| Gửi: `help` hoặc `menu` | Bot phản hồi bảng danh mục tính năng trợ lý: Tra cứu TKB, Ký số hồ sơ, Hướng dẫn liên kết SĐT. |
| Gửi SĐT trơ trọi: `0905123456` | Bot kích hoạt cơ chế bảo vệ định danh (Khắc phục DEFECT-ZALO-04), hướng dẫn gửi cú pháp kèm mã PIN: `👉 Cú pháp: LK 0905123456 [MãPIN]`. |
| Gửi: `LK 0905123456 1234` | Bot đối chiếu dữ liệu trong bảng `Danh bạ GV`, xác thực mã PIN và gửi thông báo: `✅ LIÊN KẾT ZALO THÀNH CÔNG! Chào mừng Thầy/Cô... Đã bật tính năng nhận lịch dạy 6h00 sáng.` |
| Gửi: `tkb` hoặc `lich day` | Bot trả về chi tiết lịch giảng dạy hôm nay của chính giáo viên đó, phân tách rõ ca sáng/chiều kèm khung giờ từng tiết (ví dụ: `• Tiết 1 (07h00-07h45): Tin học - 6A1`). |
| Gửi: `tkb 6a1` (hoặc tên lớp khác) | Bot gửi toàn bộ thời khóa biểu của lớp 6A1 trong tuần, kèm tên giáo viên chủ nhiệm và khung giờ từng tiết. |
| Gửi: `choduyet` (dành cho BGH) | Bot lọc và hiển thị danh sách các hồ sơ giáo án đang ở trạng thái chờ ký duyệt kèm nút xem nhanh. |
| Gửi: `KHBD-2026-09` (mã giáo án) | Bot tra cứu chính xác trạng thái của giáo án (Đã ký duyệt, Chờ duyệt, hoặc Bị trả về). |
| Gửi: `day thay` | Bot hiển thị danh sách các tiết được phân công dạy thay hoặc đổi tiết trong ngày. |
| Gửi: `tim gv tiet 2 t3` | Bot quét TKB toàn trường và chỉ ra danh sách các thầy cô đang trống tiết 2 sáng Thứ Ba. |

---

### 6.2. Kiểm thử Webhook HTTP từ Máy tính (cURL / Terminal)

Bạn có thể mở terminal (PowerShell hoặc Command Prompt trên Windows) để kiểm tra các luồng gửi nhận tín hiệu tự động:

#### 1. Kiểm thử Sức khỏe Webhook (Health Check - GET)
```bash
curl -L -X GET "https://script.google.com/macros/s/AKfycbwGBgauc9xHzRe31_IfCQD-Q9yHwGp4CfYLEam9IupcYhLpNBXbgW0J1t-weD6iUQ87ZQ/exec"
```
*Phản hồi mong đợi (JSON)*:
```json
{
  "status": "active",
  "system": "Unified Zalo Assistant 4.0 (Timetable + EduSign)",
  "school": "TRƯỜNG THCS CHU VĂN AN",
  "timestamp": "2026-09-15T...",
  "guide": "Webhook sẵn sàng phục vụ Tra cứu Thời khóa biểu và Ký số."
}
```

#### 2. Giả lập Bắn Tin Thông báo Ký số Thành công (COMPLETED - POST)
```bash
curl -L -X POST "https://script.google.com/macros/s/AKfycbwGBgauc9xHzRe31_IfCQD-Q9yHwGp4CfYLEam9IupcYhLpNBXbgW0J1t-weD6iUQ87ZQ/exec" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "NOTIFY_SIGN_EVENT",
    "eventType": "COMPLETED",
    "secret_token": "UnifiedZaloBotTHCSCVA2026Secret",
    "docId": "KHBD-TEST-001",
    "docTitle": "Kế hoạch bài dạy Tin học 6 - Tiết 12",
    "authorPhone": "0905123456",
    "approverName": "Ngô Thị Liền - Hiệu trưởng",
    "viewUrl": "https://mrkhang-khoi.github.io/cvakyso/portal-baocao.html"
  }'
```
*Phản hồi mong đợi*:
```json
{
  "success": true,
  "delivered": true,
  "phone": "0905123456",
  "chatId": "..."
}
```
*(Đồng thời máy điện thoại của giáo viên sở hữu SĐT `0905123456` sẽ rung lên và nhận được thông báo ký số hoàn tất từ Zalo Bot)*.

---

## 7. XỬ LÝ SỰ CỐ THƯỜNG GẶP (TROUBLESHOOTING FAQ)

### ❓ Sự cố 1: Lỗi "Authorization is required" hoặc "Bạn không có quyền truy cập"
- **Hiện tượng**: Khi gọi URL Web App hoặc chạy hàm, hệ thống trả về trang lỗi của Google yêu cầu đăng nhập.
- **Nguyên nhân**: Bản triển khai Web App chưa được cấp quyền cho `"Bất kỳ ai"` (Anyone), hoặc Google Workspace của trường chặn chia sẻ ra bên ngoài.
- **Cách khắc phục**:
  1. Vào lại Google Apps Script -> Nhấn **Triển khai (Deploy)** -> **Quản lý bản triển khai**.
  2. Chọn bản triển khai Web App -> Nhấn biểu tượng chỉnh sửa bút chì.
  3. Kiểm tra mục **"Người có quyền truy cập" (Who has access)** -> Đổi thành **"Bất kỳ ai" (Anyone)**.
  4. Nếu dùng tài khoản Google Workspace giáo dục (`@thcschuvanan.edu.vn`) có chính sách chặn ra ngoài: Hãy liên hệ Quản trị viên Google Workspace của trường mở quyền *"Cho phép người dùng ngoài tổ chức truy cập Web App"* trong Google Admin Console, hoặc triển khai script bằng một tài khoản Gmail thông thường (`@gmail.com`).

---

### ❓ Sự cố 2: Giáo viên bị nhận tin nhắn lặp lại nhiều lần vào buổi sáng
- **Hiện tượng**: Lúc 06:15 sáng, giáo viên nhận được 2 – 3 tin nhắn thời khóa biểu giống hệt nhau.
- **Nguyên nhân**: Trong quá trình cài đặt, quản trị viên đã bấm chạy hàm tạo trigger nhiều lần hoặc bấm tạo thủ công trong menu Triggers của Google Apps Script dẫn đến tồn tại nhiều trigger chạy song song.
- **Cách khắc phục**:
  1. Trong mã nguồn mới đã tích hợp sẵn hàm **`removeOldTriggers()`**.
  2. Hãy mở Apps Script -> Chọn hàm **`setupDailyMorningTrigger`** -> Bấm **`▶ Chạy`**. Hàm sẽ tự động quét và xóa sạch các trigger trùng lặp, chỉ giữ lại duy nhất 1 trigger chuẩn lúc 06:00 sáng.
  3. Bạn có thể tự kiểm tra bằng cách nhấp vào biểu tượng **Đồng hồ báo thức (Kích hoạt / Triggers)** ở menu bên trái của Google Apps Script. Đảm bảo ở cột "Hàm xử lý" chỉ có đúng 1 dòng `sendDailyMorningPersonalSchedule`.

---

### ❓ Sự cố 3: Hệ thống báo lỗi Firebase Offline hoặc Không phản hồi
- **Hiện tượng**: Trong Execution Log xuất hiện cảnh báo `⚠️ [MorningEngine] Không thể kết nối dữ liệu Firebase TKB`.
- **Nguyên nhân**: Đường truyền cáp quang đến máy chủ Firebase bị gián đoạn tạm thời, hoặc node `school_data.json` bị khóa quyền đọc.
- **Cơ chế Phòng vệ An toàn**:
  - Mã nguồn mới tại hàm `fetchSchoolTimetableData()` đã được trang bị cơ chế bắt lỗi đa tầng: Kiểm tra mã trạng thái HTTP (phải nằm trong dải 200..299), phát hiện chuỗi `"null"` hoặc rỗng, bắt lỗi JSON hỏng.
  - Khi Firebase offline, hàm trả về `null` một cách có kiểm soát, trigger sáng sẽ dừng nhẹ nhàng và ghi log cảnh báo mà **tuyệt đối không làm sập (crash) hệ thống và không báo lỗi đỏ trong bảng điều khiển Google Cloud**.
  - Tích hợp bộ nhớ đệm `CacheService` 60 giây: Nếu Firebase vừa được truy cập thành công trong vòng 1 phút trước đó, hệ thống sẽ lấy dữ liệu từ Cache để phục vụ ngay lập tức mà không cần gọi lại Firebase.

---

### ❓ Sự cố 4: Gửi tin nhắn cho nhiều giáo viên bị chặn (Lỗi Zalo Rate-Limit)
- **Hiện tượng**: Một số giáo viên đầu danh sách nhận được tin nhắn TKB, nhưng các giáo viên phía sau bị trễ hoặc không nhận được.
- **Nguyên nhân**: Zalo Bot Platform giới hạn tần suất gửi tin nhắn (Rate Limit - tối đa khoảng 5 - 10 tin nhắn/giây). Nếu script gửi liên thanh bằng vòng lặp `for` tốc độ cao, máy chủ Zalo sẽ từ chối các yêu cầu tiếp theo (trả về lỗi HTTP 429 Too Many Requests).
- **Cách khắc phục đã áp dụng trong mã**:
  - Trong thân hàm `sendDailyMorningPersonalSchedule()` (dòng 733-735), sau mỗi lượt gửi tin nhắn cho 1 giáo viên, script chủ động tạm dừng 150 mili-giây:
    ```javascript
    sendZaloBotReply(chatId, morningMsg);
    sentCount++;
    // Nghỉ 150ms để chống nghẽn rate limit Zalo Bot API
    if (typeof Utilities !== "undefined" && Utilities.sleep) {
      Utilities.sleep(150);
    }
    ```
  - Với 50 – 70 giáo viên trong toàn trường, tổng thời gian gửi tin chỉ mất khoảng 10 – 15 giây, vừa đảm bảo tốc độ nhanh chóng vừa nằm trong ngưỡng an toàn tuyệt đối của Zalo.

---

### ❓ Sự cố 5: Lỗi 403 `UNAUTHORIZED_SECRET_TOKEN` khi EduSign gọi Webhook
- **Hiện tượng**: Trên máy chủ EduSign log ra lỗi: `Lỗi gửi thông báo sang Google Apps Script: UNAUTHORIZED_SECRET_TOKEN`.
- **Nguyên nhân**: Khóa bí mật gửi từ `zaloNotifyService.js` không khớp với khóa bí mật định nghĩa trong `Code.gs`.
- **Cách khắc phục**:
  - Đảm bảo trong `google-apps-script-zalo-edusign.js` (dòng 400) giá trị biến là:
    ```javascript
    var SYSTEM_SECRET = "UnifiedZaloBotTHCSCVA2026Secret";
    ```
  - Trong `zaloNotifyService.js` (dòng 30) giá trị cũng là:
    ```javascript
    secret_token: 'UnifiedZaloBotTHCSCVA2026Secret'
    ```
  - Hai giá trị này phải trùng khớp từng chữ hoa, chữ thường và con số.

---

### ❓ Sự cố 6: Đã sửa code trong Code.gs nhưng Bot Zalo vẫn phản hồi logic cũ
- **Hiện tượng**: Quản trị viên đã chỉnh sửa lời chào hoặc câu lệnh trong `Code.gs` và nhấn lưu, nhưng khi nhắn tin trên Zalo bot vẫn trả lời theo cách cũ.
- **Nguyên nhân**: Đây là đặc tính cơ bản của Google Apps Script: Web App luôn chạy trên bản triển khai (Deployment Version) đã chốt tại thời điểm bấm Triển khai. Việc bấm `Ctrl + S` chỉ lưu mã vào bản nháp soạn thảo, chưa cập nhật vào Web App đang chạy ngoài Internet.
- **Cách khắc phục**:
  1. Nhấn nút **Triển khai (Deploy)** ở góc trên bên phải -> Chọn **Quản lý bản triển khai (Manage deployments)**.
  2. Nhấp vào bản triển khai đang hoạt động -> Nhấn vào biểu tượng **Cây bút chì (Chỉnh sửa)**.
  3. Tại ô **Phiên bản (Version)**: Nhấp vào menu thả xuống và chọn **"Phiên bản mới" (New version)**.
  4. Nhấn nút **Triển khai (Deploy)**. Sau thao tác này, bot sẽ lập tức cập nhật theo mã nguồn mới nhất!

---

## 🎯 BẢNG TỔNG HỢP KIỂM TRA NGHIỆM THU (READINESS CHECKLIST)

Trước khi bàn giao hệ thống vào vận hành chính thức, Quản trị viên vui lòng rà soát danh sách kiểm tra sau:

- [ ] Đã dán toàn bộ mã nguồn mới từ `google-apps-script-zalo-edusign.js` vào `Code.gs`.
- [ ] Đã điền ID bảng tính Google Sheet vào biến `CONFIG.SPREADSHEET_ID`.
- [ ] Đã chạy hàm `initSheetsIfMissing` thành công (có 2 bảng `Danh bạ GV` và `Sổ Lưu Báo Cáo`).
- [ ] Đã chạy hàm `setupDailyMorningTrigger` thành công (Trigger 06:00 sáng đã xuất hiện trong danh sách Triggers).
- [ ] Đã cấp quyền truy cập OAuth Scope đầy đủ cho tài khoản Google.
- [ ] Đã triển khai Web App với quyền truy cập "Bất kỳ ai" (Anyone) và copy URL Web App.
- [ ] Đã dán Web App URL vào `drive_config.json` (`gasWebhookUrl`) trên máy chủ EduSign.
- [ ] Đã chạy hàm `setZaloBotWebhook` để liên kết Webhook với Zalo Bot.
- [ ] Đã thử nhắn tin cú pháp `help`, `LK <SĐT> <PIN>`, `tkb` trên Zalo và nhận phản hồi chuẩn xác.
- [ ] Đã test thử nộp và ký một giáo án mẫu, xác nhận có tin nhắn thông báo đẩy về Zalo.

---

*Tài liệu được biên soạn bởi Bộ phận Kỹ thuật Hệ thống Ký số EduSign VGCA — Trường THCS Chu Văn An.*  
*Mọi thắc mắc kỹ thuật trong quá trình triển khai vui lòng liên hệ Tổ Quản trị CNTT Nhà trường để được hỗ trợ.*
