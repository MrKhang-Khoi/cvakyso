# Master Plan: EduSign VGCA — R1 Phone/PIN Zero Fix & R2 Teacher UI/UX Redesign & R3 Playwright Multi-Res Verification

## 1. Overview & Objectives
- **R1: Sửa triệt để lỗi mất số 0 đầu SĐT & PIN khi đồng bộ Google Sheet**:
  - Ghi vào Sheet: Bắt buộc định dạng text thuần túy bằng tiền tố "'" (ví dụ: `'0818810007`, `'0007'`) hoặc format `@`.
  - Đọc từ Sheet (Zalo Bot Handler): `normalizePhone` bù số 0 nếu có 9 chữ số (0 + phone); `padStart(4, '0')` cho PIN.
  - Frontend (`js/app.js`, `public/js/app.js`, `docs/js/app.js`): Chuẩn hóa dữ liệu gửi webhook luôn giữ nguyên chuỗi có số 0 đầu.
- **R2: Tái thiết kế toàn diện Giao diện Danh sách Giáo viên (Hình 3)**:
  - Bố cục thanh công cụ cân xứng, nút bấm hiện đại (Subtle Outline / Brand Fill, hover micro-interactions, badge đồng bộ rõ ràng).
  - Cột Giáo viên/Tài khoản: Phân tầng thị giác 3 cấp (Họ tên + Avatar tròn thanh lịch; @username & Email; Thẻ capsule Zalo [ 📱 0818810007 • PIN: 0007 ] kèm nút sao chép 1-click).
  - Cột Loại chữ ký & Quyền hạn: Gom icon badge nhỏ gọn có tooltip, loại bỏ lộn xộn thẻ nhiều màu.
  - Cột Thao tác: Action Button bar tinh gọn, responsive, hover feedback.
- **R3: Kiểm thử Độc lập Đa Trình duyệt & Xác thực Dữ liệu Thực tế**:
  - Viết kịch bản Playwright đo đạc 1920x1080 và 1366x768, chụp ảnh minh chứng trước và sau.
  - Kiểm tra 0 console error, 0 bẫy tràn ngang, WCAG AA/AAA.
  - Cập nhật tài liệu và git push origin main.

## 2. Milestone Architecture
| Milestone | Description | Expected Output | Dependencies |
|---|---|---|---|
| **M0: Survey & CodeGraph** | Điều tra chi tiết code hiện tại, cấu trúc sheet, vị trí render bảng giáo viên, hàm normalizePhone | `SURVEY_REPORT.md` | None |
| **M1: Phone & PIN Fix** | Sửa `google-apps-script-zalo-edusign.js`, Zalo bot handler, frontend `js/app.js`, `public/js/app.js`, `docs/js/app.js` | Code fix & Unit/Logic tests | M0 |
| **M2: Teacher UI Redesign** | Tái cấu trúc CSS/HTML render bảng giáo viên trong `index.html` và `js/app.js` | Redesigned UI with modern aesthetics | M0 |
| **M3: Testing & Screenshots** | Chạy kịch bản Playwright 1920x1080 & 1366x768, chụp ảnh trước/sau, kiểm tra bẫy tràn, WCAG, 0 error | Test report & Screenshots | M1, M2 |
| **M4: Review, Audit & Git** | Reviewer kiểm tra, Auditor kiểm tra tính toàn vẹn, cập nhật docs, git commit & git push | Documentation & Git push confirmation | M3 |
