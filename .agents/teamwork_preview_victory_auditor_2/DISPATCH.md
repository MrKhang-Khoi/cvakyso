## 2026-09-15T02:55:40Z

Bạn là Independent Post-Victory Auditor (teamwork_preview_victory_auditor). Đội ngũ Orchestrator (teamwork_preview_orchestrator_3) vừa gửi thông báo nghiệm thu thắng lợi (Victory Claim). Nhiệm vụ của bạn là thực hiện kiểm toán độc lập 3 giai đoạn (3-Phase Forensic Audit) mà KHÔNG dùng lại ngữ cảnh hay tin tưởng vào tuyên bố của nhóm thực hiện.

### THÔNG TIN CẦN THIẾT:
- Thư mục làm việc của bạn: c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\teamwork_preview_victory_auditor_2
- File yêu cầu gốc từ người dùng: c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\ORIGINAL_REQUEST.md
- File chứa 23 bản vá mẫu chuẩn: c:\Users\HPZBook\Desktop\KÝ SỐ\PROPOSED_PATCHES.md
- File tài liệu hướng dẫn Code.gs: c:\Users\HPZBook\Desktop\KÝ SỐ\docs\HUONG_DAN_CAP_NHAT_CODE_GS_ZALO.md
- Thư mục dự án: c:\Users\HPZBook\Desktop\KÝ SỐ

### YÊU CẦU KIỂM TOÁN 3 GIAI ĐOẠN:
1. **Phase 1 — Phân tích Dòng thời gian & Nguồn gốc (Timeline & Provenance)**:
   - Đối soát mọi sửa đổi trên các file mã nguồn: `index.html`, `js/app.js`, `portal-baocao.html`, `server.js`, `zaloNotifyService.js`, `google-apps-script-zalo-edusign.js`.
   - Kiểm tra tính đồng bộ và khớp mã băm SHA-256 giữa các thư mục `./`, `public/`, và `docs/`.

2. **Phase 2 — Phát hiện Gian lận & Ngụy tạo (Cheating & Facade Detection)**:
   - Quét kỹ mã nguồn: Tuyệt đối 0 kết quả hardcoded, 0 mock ảo, 0 bypass logic xác thực, 0 facade test giả định.
   - Thẩm tra đặc biệt: Tuyến `/uploads` và `/uploads/signatures` trong `server.js` có được bảo vệ bằng middleware JWT `requireAuth` và kiểm tra quyền sở hữu chữ ký không, có nguy cơ bypass qua thư mục tĩnh không.
   - Thẩm tra cú pháp liên kết Zalo ID: Có bắt buộc OTP/PIN không (`LK <SĐT> <MãPIN>`).
   - Thẩm tra tính năng TKB 6h00 sáng: Có các hàm `setupDailyMorningTrigger()`, `removeOldTriggers()`, `setupMorningBriefGroupTrigger()`, có loại trừ Chủ Nhật không, có chịu lỗi offline/JSON hỏng từ Firebase không.

3. **Phase 3 — Tự thực thi Kiểm thử Độc lập (Independent Test Execution)**:
   - Tự tay chạy và ghi nhận kết quả thực tế (exit code, stdout, pass rate):
     * Cú pháp: `node validate_syntax.js`
     * Bộ test Zalo Logic & Security: `node tests/test_zalo_security_and_logic_audit.js`
     * Bộ test Zalo Bot: `node tests/test_zalo_unified_bot.js`
     * Bộ test TKB sáng & Triggers: `node tests/test_zalo_morning_schedule_m3.js`
     * Bộ test Playwright kiểm toán UI/UX: `npx playwright test tests/test_cross_device_ui_ux_audit.spec.mjs`
     * Bộ test Playwright hộp thoại: `npx playwright test tests/ui_dialog_supervision.spec.mjs`
     * Các bộ test Playwright cốt lõi: `tests/01_auth_roles.spec.mjs`, `tests/02_teacher_features.spec.mjs`, `tests/05_multi_signing_and_session.spec.mjs`, `tests/07_bgh_cccd_token_flow.spec.mjs`
     * Toàn bộ test hệ thống: `node test.js`
   - Đánh giá tài liệu `docs/HUONG_DAN_CAP_NHAT_CODE_GS_ZALO.md` xem có đủ 8 mục hướng dẫn chi tiết từng bước cho người quản trị nhà trường không.

### PHÁN QUYẾT BẮT BUỘC:
- Kết luận rõ ràng: **VICTORY CONFIRMED** hoặc **VICTORY REJECTED**.
- Ghi báo cáo chi tiết vào `handoff.md` trong thư mục của bạn và gửi kết quả về cho Sentinel qua `send_message`.
