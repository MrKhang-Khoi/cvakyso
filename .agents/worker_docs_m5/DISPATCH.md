## 2026-09-15T02:19:18Z
You are worker_docs_m5, a technical documentation specialist.
Your working directory is: c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\worker_docs_m5
Your parent is teamwork_preview_orchestrator_3 (ID: 03092046-89d0-45f5-9d0c-6e7a030d9cd1).

### Mandatory Reading:
1. Read `c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\ORIGINAL_REQUEST.md`.
2. Inspect `c:\Users\HPZBook\Desktop\KÝ SỐ\google-apps-script-zalo-edusign.js`.
3. Inspect `c:\Users\HPZBook\Desktop\KÝ SỐ\PROPOSED_PATCHES.md`.
4. Read `.agents/worker_tkb_m3/handoff.md` and `.agents/reviewer_tkb_m3/handoff.md`.

### Objective (Milestone 5):
Author and publish a comprehensive, visually appealing, production-grade guide in Vietnamese:
`c:\Users\HPZBook\Desktop\KÝ SỐ\docs\HUONG_DAN_CAP_NHAT_CODE_GS_ZALO.md`.

### Content Structure Required:
1. **Giới thiệu & Kiến trúc Tổng quan**:
   - Vai trò của Google Apps Script trong hệ sinh thái EduSign VGCA Chu Văn An: Cầu nối webhook 2 chiều giữa Zalo Bot, Google Sheet Database, Firebase RTDB Thời khóa biểu và Hệ thống Ký số EduSign.
2. **Các bước Chuẩn bị & Copy Mã nguồn**:
   - Mở dự án trên `https://script.google.com/`.
   - Sao chép toàn bộ nội dung từ tệp `google-apps-script-zalo-edusign.js` dán đè vào tệp `Code.gs`.
3. **Cấu hình Tham số Hệ thống (`CONFIG`)**:
   - `SPREADSHEET_ID`: Hướng dẫn lấy ID từ URL bảng tính Google Sheets.
   - `ZALO_BOT_TOKEN`: Token của Zalo Bot Platform hoặc thiết lập OA v3.
   - `FIREBASE_DATABASE_URL`: Đường dẫn Firebase Realtime Database thời khóa biểu.
   - `SYSTEM_SECRET`: Khóa bí mật đồng bộ bảo mật (`UnifiedZaloBotTHCSCVA2026Secret`).
   - `MORNING_BRIEF_CHAT_ID`: ID nhóm Zalo toàn trường để nhận bản tin TKB 06:30 sáng (tùy chọn).
4. **Hướng dẫn Chạy Khởi tạo 1 Lần (Run Once)**:
   - Bước 1: Chọn hàm `initSheetsIfMissing` và nhấn "Chạy" (Tự động tạo và định dạng 4 trang tính chuẩn).
   - Bước 2: Chọn hàm `setupDailyMorningTrigger` và nhấn "Chạy" (Tự động xóa trigger cũ và lập lịch gửi TKB cá nhân lúc 06:00 sáng từ T2-T7, tự động loại trừ Chủ Nhật).
   - Bước 3 (nếu có nhóm trường): Chọn hàm `setupMorningBriefGroupTrigger` và nhấn "Chạy" (Lập lịch gửi bản tin tổng hợp trường lúc 06:30 sáng).
   - Bước 4: Chọn hàm `setZaloBotWebhook` và nhấn "Chạy" (Đăng ký Webhook URL với Zalo Server).
5. **Hướng dẫn Cấp quyền Truy cập (OAuth Scope) & Triển khai (Deploy)**:
   - Các bước duyệt quyền Google: "Nâng cao" (Advanced) -> "Đi tới dự án (không an toàn)" -> Cho phép truy cập Google Sheets, UrlFetchApp, ScriptApp triggers.
   - Triển khai mới (New Deployment) -> Loại: Ứng dụng web (Web App) -> Thực thi dưới dạng: "Tôi" (User accessing the web app / Me) -> Người có quyền truy cập: "Bất kỳ ai" (Anyone) -> Nhấn Triển khai và sao chép URL Web App.
6. **Kiểm thử & Nghiệm thu sau khi Triển khai**:
   - Test gửi tin từ bot Zalo: cú pháp `help`, `choduyet`, `tkb`, `LK <SĐT> <MãPIN>`.
   - Test webhook POST từ curl hoặc server.js.
7. **Xử lý Sự cố Thường gặp (Troubleshooting FAQ)**:
   - Lỗi quyền truy cập OAuth (`Authorization is required`).
   - Lỗi trùng lặp tin nhắn (đã có `removeOldTriggers` giải quyết triệt để).
   - Lỗi Firebase offline / timeout (cơ chế phòng vệ an toàn trả về null).
   - Lỗi Zalo rate-limit (đã có sleep 150ms).

### Handoff:
Write your handoff report to `c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\worker_docs_m5\handoff.md` and send a message to parent when completed.
