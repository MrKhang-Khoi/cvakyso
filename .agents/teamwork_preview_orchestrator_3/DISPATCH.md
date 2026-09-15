## 2026-09-15T01:52:42Z

<USER_REQUEST>
Bạn là Project Orchestrator (teamwork_preview_orchestrator_3) chịu trách nhiệm chỉ huy toàn bộ quá trình áp dụng 23 bản vá từ PROPOSED_PATCHES.md, bảo vệ hệ thống không bị lỗi hồi quy (Zero-Side-Effect), hoàn thiện tính năng Zalo nhắc Thời khóa biểu 6h00 sáng, và xuất bản tài liệu hướng dẫn cập nhật Code.gs trên Google Apps Script theo yêu cầu người dùng tại .agents/ORIGINAL_REQUEST.md.

### Thông tin Định danh & Không gian làm việc:
- Thư mục làm việc của bạn: c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\teamwork_preview_orchestrator_3
- File yêu cầu gốc: c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\ORIGINAL_REQUEST.md
- File chứa 23 bản vá mẫu chuẩn: c:\Users\HPZBook\Desktop\KÝ SỐ\PROPOSED_PATCHES.md
- Thư mục dự án: c:\Users\HPZBook\Desktop\KÝ SỐ

### Nhiệm vụ & Kế hoạch Thực thi (Decomposition):
1. **Milestone 1 - Áp dụng 11 Bản vá UI/UX & Công thái học**:
   - Chỉnh sửa `index.html` và `js/app.js` theo đúng 11 bản vá trong PROPOSED_PATCHES.md:
     * Triệt tiêu bẫy tràn ngang Mobile 20px (flex flex-col sm:flex-row w-full).
     * Tối ưu thanh công cụ PDF Viewer trên Mobile/Tablet (#modalDocViewer).
     * Phóng to các nút vi sai con dấu ◀, ▲, ▼, ▶ lên >= 44px (WCAG AAA).
     * Bổ sung sự kiện pointercancel trong js/app.js chống kẹt chuột/đơ cảm ứng kéo thả dấu.
     * Chuẩn hóa bảng phân tầng Z-Index Token Design (Base z-30, Sticky z-40, Modal z-[100], Confirm/Alert z-[120], Toast z-[150]).
     * Phóng to nút thao tác bảng biểu (>= 36px), nâng độ tương phản text-slate-400 lên text-slate-600 (7.0:1 AAA), hỗ trợ phím bấm Dropzone.

2. **Milestone 2 - Áp dụng 12 Bản vá Logic & Bảo mật Zalo**:
   - Chỉnh sửa `server.js`, `zaloNotifyService.js`, và `google-apps-script-zalo-edusign.js`:
     * Xử lý sự kiện FORWARDED trong GAS Webhook gửi tin Zalo tức thời cho Ban Giám hiệu.
     * Tích hợp hook gọi zaloNotifyService.sendZaloNotificationViaGAS khi Tổ trưởng duyệt (approve-leader) và BGH ký số đóng dấu (approve-principal).
     * Nộp giáo án cá nhân (PERSONAL): Tự động tìm SĐT Tổ trưởng bộ môn để gửi tin thông báo.
     * Vá lỗ hổng chiếm đoạt tài khoản Zalo Bot qua số điện thoại: Bổ sung xác thực OTP 6 số hoặc mã PIN EduSign trước khi liên kết Zalo_Chat_ID.
     * Đóng bảo vệ thư mục tĩnh /uploads sau middleware requireAuth, hợp nhất tuyến /reject bị trùng lặp, xóa bỏ webhook phát tán từ client.
     * Bổ sung bộ Regex bóc tách mã hồ sơ (KHBD-..., BC-...) và lệnh choduyet cho BGH trên Zalo Bot.

3. **Milestone 3 - Kiểm định & Hoàn thiện Tính năng Zalo Nhắc Thời Khóa Biểu (TKB 6h00 Sáng)**:
   - Trong `google-apps-script-zalo-edusign.js`:
     * Bổ sung hàm `setupDailyMorningTrigger()` và `removeOldTriggers()` tạo Trigger tự động chạy `sendDailyMorningPersonalSchedule` lúc 06:00 - 07:00 sáng hàng ngày (thứ 2 đến thứ 7).
     * Bổ sung hàm `setupMorningBriefGroupTrigger()` gửi bản tin TKB tổng hợp vào nhóm Zalo trường lúc 06:30 sáng (nếu có cấu hình MORNING_BRIEF_CHAT_ID).
     * Kiểm tra độ chính xác dữ liệu: Khung giờ ra vào lớp sáng/chiều, liên kết với Firebase TKB (tkb-fet-default-rtdb), bóc tách danh sách tiết dạy chính khóa và các ca phân công dạy thay trong ngày.
     * Xử lý ngoại lệ khi mất mạng hoặc Firebase không phản hồi, không làm crash luồng trigger.

4. **Milestone 4 - Kiểm thử Hồi quy Toàn diện & Hàng rào Bảo vệ (Zero-Side-Effect)**:
   - Tuyệt đối giữ vững 100% độ ổn định cho các tính năng cốt lõi: Nộp giáo án, ký nháy chuyên môn, ký số VGCA USB Token, đóng dấu mộc đỏ trường học, sao lưu Google Drive Kho trường, và Firebase Realtime Database.
   - Chạy lại toàn bộ test suite Playwright sẵn có:
     * `tests/01_auth_roles.spec.mjs`
     * `tests/02_teacher_features.spec.mjs`
     * `tests/05_multi_signing_and_session.spec.mjs`
     * `tests/07_bgh_cccd_token_flow.spec.mjs`
     * `tests/test_cross_device_ui_ux_audit.spec.mjs`
     Xác nhận 100% PASS và console sạch 0 lỗi.
   - Chạy lại `tests/test_zalo_security_and_logic_audit.js` xác nhận các lỗ hổng đã được vá triệt để và an toàn.

5. **Milestone 5 - Xuất bản Tài liệu Hướng dẫn Cập nhật Code.gs trên Google Apps Script**:
   - Soạn thảo tài liệu markdown chi tiết, trực quan (`docs/HUONG_DAN_CAP_NHAT_CODE_GS_ZALO.md`):
     * Các bước copy/paste mã nguồn mới vào Code.gs trên script.google.com.
     * Cấu hình SPREADSHEET_ID, ZALO_BOT_TOKEN, FIREBASE_DATABASE_URL.
     * Hướng dẫn chạy 1 lần: initSheetsIfMissing, setupDailyMorningTrigger, setZaloBotWebhook.
     * Hướng dẫn cấp quyền truy cập Google (OAuth Scope) và Deploy New Version.

### Quy tắc Điều phối & Ghi chép:
- Quản lý các worker chuyên biệt (ví dụ: worker_patch, worker_test, reviewer) theo đúng convention `.agents/<role>_<milestone>`.
- Duy trì `plan.md`, `progress.md`, và `BRIEFING.md` trong thư mục của bạn. Cập nhật `progress.md` liên tục để Sentinel giám sát qua cron liveness check.
- Khi hoàn tất toàn bộ yêu cầu và test pass 100%, gửi thông báo nghiệm thu (victory claim) cho Sentinel kèm báo cáo chi tiết.
</USER_REQUEST>
