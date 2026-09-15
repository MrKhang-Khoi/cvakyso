# Implementation Plan — teamwork_preview_orchestrator_3

## Objective
Apply 23 proposed patches from `PROPOSED_PATCHES.md`, maintain zero-side-effects on core digital signature flows, finish Zalo 6:00 AM TKB notification features, run full regression tests, and author GAS deployment documentation.

## Milestones & Work Breakdown

### Milestone 1: Áp dụng 11 Bản vá UI/UX & Công thái học
- **Target Files**: `index.html`, `js/app.js`
- **Scope (Patches 1 - 11 from PROPOSED_PATCHES.md)**:
  1. Patch 1: Triệt tiêu bẫy tràn ngang Mobile 20px (`flex flex-col sm:flex-row w-full`).
  2. Patch 2: Tối ưu thanh công cụ PDF Viewer trên Mobile/Tablet (`#modalDocViewer` flex-wrap, touch target).
  3. Patch 3: Phóng to các nút vi sai con dấu ◀, ▲, ▼, ▶ lên >= 44px (WCAG AAA standard).
  4. Patch 4: Bổ sung sự kiện pointercancel trong `js/app.js` chống kẹt chuột/đơ cảm ứng kéo thả con dấu.
  5. Patch 5: Chuẩn hóa hệ thống Z-Index Token Design (Base z-30, Sticky z-40, Modal z-[100], Confirm/Alert z-[120], Toast z-[150]).
  6. Patch 6: Phóng to nút thao tác bảng biểu (>= 36px/44px touch friendly).
  7. Patch 7: Nâng độ tương phản text-slate-400 lên text-slate-600 (tỷ lệ 7.0:1 AAA).
  8. Patch 8: Hỗ trợ tương tác phím bấm cho Dropzone (Enter/Space, tabindex="0", aria-label).
  9. Patch 9: Tối ưu bảng biểu responsive trên màn hình hẹp (overflow-x-auto, whitespace-nowrap hợp lý).
  10. Patch 10: Tối ưu hoá phản hồi trực quan khi ký duyệt (loading state, disabled button during async).
  11. Patch 11: Cải thiện khả năng tiếp cận và thông báo lỗi rõ ràng trên form.
- **Worker**: `worker_m1`
- **Review**: `reviewer_m1`

### Milestone 2: Áp dụng 12 Bản vá Logic & Bảo mật Zalo
- **Target Files**: `server.js`, `zaloNotifyService.js`, `google-apps-script-zalo-edusign.js`
- **Scope (Patches 12 - 23 from PROPOSED_PATCHES.md)**:
  12. Patch 12: Xử lý sự kiện FORWARDED trong GAS Webhook gửi tin Zalo tức thời cho Ban Giám hiệu.
  13. Patch 13: Tích hợp hook gọi `zaloNotifyService.sendZaloNotificationViaGAS` khi Tổ trưởng duyệt (`approve-leader`) và BGH ký số (`approve-principal`).
  14. Patch 14: Nộp giáo án cá nhân (PERSONAL): Tự động tìm SĐT Tổ trưởng bộ môn để gửi tin thông báo Zalo.
  15. Patch 15: Vá lỗ hổng chiếm đoạt tài khoản Zalo Bot qua số điện thoại: Bổ sung xác thực OTP 6 số hoặc mã PIN EduSign trước khi liên kết `Zalo_Chat_ID`.
  16. Patch 16: Đóng bảo vệ thư mục tĩnh `/uploads` sau middleware `requireAuth`.
  17. Patch 17: Hợp nhất tuyến `/reject` bị trùng lặp trong `server.js`.
  18. Patch 18: Xóa bỏ webhook phát tán từ client hoặc unauthenticated endpoints.
  19. Patch 19: Bổ sung bộ Regex bóc tách mã hồ sơ (`KHBD-...`, `BC-...`) linh hoạt trên Zalo Bot.
  20. Patch 20: Thêm lệnh `choduyet` cho BGH trên Zalo Bot để tra cứu nhanh hồ sơ đang chờ ký.
  21. Patch 21: Bổ sung rate-limiting và validation payload cho Zalo webhook callback.
  22. Patch 22: Chuẩn hóa log lỗi và cơ chế retry khi gửi tin nhắn Zalo thất bại.
  23. Patch 23: Bảo mật thông tin nhạy cảm trong token và environment parameters.
- **Worker**: `worker_m2`
- **Review**: `reviewer_m2`

### Milestone 3: Kiểm định & Hoàn thiện Tính năng Zalo Nhắc TKB 06:00 Sáng
- **Target Files**: `google-apps-script-zalo-edusign.js`
- **Scope**:
  - Bổ sung `setupDailyMorningTrigger()` và `removeOldTriggers()` tạo Trigger tự động chạy `sendDailyMorningPersonalSchedule` lúc 06:00 - 07:00 sáng hàng ngày (thứ 2 đến thứ 7).
  - Bổ sung `setupMorningBriefGroupTrigger()` gửi bản tin TKB tổng hợp vào nhóm Zalo trường lúc 06:30 sáng (`MORNING_BRIEF_CHAT_ID`).
  - Kiểm tra độ chính xác dữ liệu: Khung giờ ra vào lớp sáng/chiều, liên kết với Firebase TKB (`tkb-fet-default-rtdb`), bóc tách danh sách tiết dạy chính khóa và các ca phân công dạy thay trong ngày.
  - Xử lý ngoại lệ khi mất mạng hoặc Firebase không phản hồi, không làm crash luồng trigger.
- **Worker**: `worker_m3`
- **Review**: `reviewer_m3`

### Milestone 4: Kiểm thử Hồi quy Toàn diện & Hàng rào Bảo vệ (Zero-Side-Effect)
- **Scope**:
  - Chạy lại toàn bộ test suite Playwright sẵn có:
    * `tests/01_auth_roles.spec.mjs`
    * `tests/02_teacher_features.spec.mjs`
    * `tests/05_multi_signing_and_session.spec.mjs`
    * `tests/07_bgh_cccd_token_flow.spec.mjs`
    * `tests/test_cross_device_ui_ux_audit.spec.mjs`
  - Chạy lại test suite Zalo:
    * `tests/test_zalo_security_and_logic_audit.js`
  - Kiểm tra tính năng cốt lõi: Ký nháy, ký số VGCA USB Token, con dấu mộc đỏ, đồng bộ Drive/Firebase.
- **Worker**: `worker_m4`
- **Challenger & Auditor**: `challenger_m4`, `auditor_m4`

### Milestone 5: Xuất bản Tài liệu Hướng dẫn Cập nhật Code.gs trên Google Apps Script
- **Target File**: `docs/HUONG_DAN_CAP_NHAT_CODE_GS_ZALO.md`
- **Scope**:
  - Hướng dẫn chi tiết từng bước copy/paste mã nguồn mới vào `Code.gs` trên `script.google.com`.
  - Hướng dẫn cấu hình `SPREADSHEET_ID`, `ZALO_BOT_TOKEN`, `FIREBASE_DATABASE_URL`.
  - Hướng dẫn chạy 1 lần: `initSheetsIfMissing`, `setupDailyMorningTrigger`, `setZaloBotWebhook`.
  - Hướng dẫn cấp quyền truy cập Google (OAuth Scope) và Deploy New Version / Web App URL.
- **Worker**: `worker_m5`
- **Review**: Top-level synthesis & report to Sentinel.
