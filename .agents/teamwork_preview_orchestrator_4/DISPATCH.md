# DISPATCH LOG

## 2026-09-15T04:36:42Z

Bạn là Project Orchestrator (teamwork_preview_orchestrator_4) điều phối dự án EduSign VGCA KÝ SỐ.

Thư mục làm việc của bạn: c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\teamwork_preview_orchestrator_4
File yêu cầu gốc: c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\ORIGINAL_REQUEST.md (Mục yêu cầu mới nhất: ## 2026-09-15T04:35:43Z).

Nhiệm vụ trọng tâm:
1. R1: Khắc phục triệt để lỗi mất số 0 ở đầu của Số điện thoại và Mã PIN khi đồng bộ lên Google Sheets (khiến Zalo Bot không nhận diện được liên kết):
   - Xử lý tại nguồn ghi (google-apps-script-zalo-edusign.js): định dạng bắt buộc dạng text thuần túy bằng tiền tố "'" ("'0818810007", "'0007") hoặc setNumberFormat("@").
   - Cơ chế phòng thủ đa tầng khi đọc dữ liệu (Zalo Bot Handler): normalizePhone bù số 0 nếu có 9 chữ số; padStart(4, '0') cho mã PIN.
   - Chuẩn hóa phía Frontend (js/app.js, public/js/app.js, docs/js/app.js): giữ nguyên chuỗi có số 0 đầu khi gửi webhook/đồng bộ.
2. R2: Tái thiết kế toàn diện giao diện Danh sách Giáo viên (Hình 3) theo tiêu chuẩn công thái học hiện đại, khoa học và thẩm mỹ cao:
   - Thanh công cụ & nút bấm: Căn chỉnh hài hòa các nút "Đồng bộ Google Sheet", "Thêm Giáo viên" với Tab bar; Subtle Outline / Brand Fill, hover micro-interactions, badge trạng thái đồng bộ rõ ràng.
   - Cột Giáo viên / Tài khoản phân tầng thị giác 3 cấp (Họ tên + Avatar tròn thanh lịch; @username & Email công vụ; Thẻ capsule Zalo thông minh [ 📱 0818810007 • PIN: 0007 ] kèm nút 1-click sao chép nhanh).
   - Cột Loại chữ ký & Quyền hạn: Gom nhóm thành icon badge nhỏ gọn có tooltip, loại bỏ lộn xộn thẻ nhiều màu.
   - Cột Thao tác: Action Button bar tinh gọn, hover micro-interactions.
3. R3: Kiểm thử độc lập Playwright đa độ phân giải (1920x1080 và 1366x768), chụp ảnh screenshot minh chứng trước và sau khi tái thiết kế, xác thực 100% PASS, 0 console error, 0 tràn khung ngang, WCAG AA/AAA. Cập nhật tài liệu hướng dẫn và thực hiện git commit & git push origin main.

Hãy phân rã công việc, dispatch các subagent chuyên môn (workers, reviewers, testers), duy trì BRIEFING.md, plan.md, progress.md trong thư mục của bạn, thực thi nghiêm ngặt Zero-Bug Verification Pipeline và báo cáo handoff.md chi tiết khi hoàn tất.
