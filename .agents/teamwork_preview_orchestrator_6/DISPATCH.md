## 2026-09-15T07:40:14Z

<USER_REQUEST>
Bạn là Project Orchestrator (teamwork_preview_orchestrator_6) chịu trách nhiệm chỉ huy toàn bộ dự án theo yêu cầu của người dùng.

Working directory của bạn: c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\teamwork_preview_orchestrator_6
Project root: c:\Users\HPZBook\Desktop\KÝ SỐ
Tài liệu yêu cầu gốc: c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\ORIGINAL_REQUEST.md

Theo yêu cầu của người dùng và quy tắc Zero-Bug Verification, bạn tổ chức Multi-Agent Swarm (Agent 1: Coder/Implementer, Agent 2: Tester/Independent Verifier, Agent 3: Cross-Checker & Reviewer/Auditor):

## Yêu Cầu Cụ Thể Cần Hoàn Thành:
1. R1. Sửa Lỗi Thiếu secret_token trong sendZaloNotificationClientSide:
   - File cần sửa: js/app.js, public/js/app.js, docs/js/app.js (đảm bảo đồng bộ 100% SHA-256 giữa 3 file).
   - Nguyên nhân: Google Apps Script yêu cầu secret_token: "UnifiedZaloBotTHCSCVA2026Secret" cho mọi hành động NOTIFY_SIGN_EVENT. Thiếu trường này sẽ bị lỗi UNAUTHORIZED_SECRET_TOKEN.
   - Giải pháp: Chèn tự động payload.secret_token = "UnifiedZaloBotTHCSCVA2026Secret" ngay trong hàm sendZaloNotificationClientSide trước khi gửi để SUBMITTED, FORWARDED, PERSONAL_SIGNED, COMPLETED, REJECTED đều hợp lệ.

2. R2. Nâng Cấp Logic Gửi Tin Zalo trong google-apps-script-zalo-edusign.js (Sự kiện SUBMITTED & FORWARDED):
   - Khi nhận sự kiện SUBMITTED:
     + Gửi tin nhắn xác nhận luồng ký cho Tác giả khởi tạo (authorPhone):
       * Tiêu đề: 📤 XÁC NHẬN: KHỞI TẠO BÁO CÁO & TRÌNH KÝ THÀNH CÔNG
       * Nội dung: Tên hồ sơ, Mã hồ sơ, Người tạo, Luồng ký: Đã chuyển tiếp tới [Tên người duyệt] ([SĐT]), Thời gian.
     + Gửi tin nhắn mời ký duyệt cho Người duyệt tiếp theo (recipientPhone):
       * Nếu người duyệt đã liên kết Zalo: Gửi thông báo có hồ sơ mới cần ký duyệt.
       * Nếu người duyệt chưa liên kết Zalo: Không làm gián đoạn luồng của tác giả (log rõ, graceful fallback).
   - Kiểm tra tương tự cho sự kiện FORWARDED nếu có.

3. R3. Kiểm Thử Thực Nghiệm Mạng Thật (Live Network Trace) & Minh Chứng:
   - Chạy script kiểm thử gửi request thật sang Webhook Google Apps Script thực tế (tìm URL webhook hiện hành trong project hoặc drive_config/google-apps-script-zalo-edusign.js):
     * Xác nhận phản hồi HTTP 200, { success: true }.
     * Gửi tin nhắn thực tế về Zalo Chat của thầy Hà Văn Tý (0818810007) và kiểm chứng logs/response.
   - Chạy bộ test hồi quy Playwright và unit tests để xác nhận 100% PASS.
   - Cập nhật tài liệu HUONG_DAN_CAP_NHAT_CODE_GS.md nếu có thay đổi trong Code.gs.
   - Thực hiện git commit và git push origin main.

Quy định quan trọng:
- Tuân thủ quy tắc làm việc theo thư mục: Mỗi subagent có folder riêng dưới .agents/
- Duy trì progress.md và BRIEFING.md trong thư mục của bạn để Sentinel theo dõi.
- Đạt đồng thuận tuyệt đối giữa Coder, Tester và Reviewer trước khi báo cáo hoàn thành.
- Khi hoàn thành tất cả các mục, viết handoff.md và thông báo cho Sentinel.
</USER_REQUEST>
