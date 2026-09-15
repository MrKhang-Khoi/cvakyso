# BÁO CÁO KHẢO SÁT TOÀN DIỆN (SURVEY REPORT)
**Dự án**: EduSign VGCA KÝ SỐ  
**Orchestrator**: teamwork_preview_orchestrator_4  
**Thời gian**: 2026-09-15T04:46:00Z  

---

## 1. Tổng hợp Phát hiện Kỹ thuật

### 1.1. User Rule 1 (CodeGraph)
- Thư mục `.codegraph/` đã tồn tại sẵn trong thư mục gốc dự án cùng cơ sở dữ liệu `codegraph.db` (57.8 MB). Rule 1 thỏa mãn 100%, không cần chạy lại lệnh init.

### 1.2. Nhiệm vụ R1: Sửa triệt để lỗi mất số 0 đầu SĐT & PIN
- **Nguyên nhân gốc**: Google Sheets tự động ép kiểu dữ liệu chuỗi số (Number auto-cast) khi ghi giá trị qua `setValue("0818810007")` $\to$ `818810007`, `"0007"` $\to$ `7`.
- **Hậu quả**: Khi Zalo Bot đọc dữ liệu cũ hoặc dữ liệu mới bị mất số 0, giáo viên gửi `LK 0818810007 0007` bị từ chối do `"0007" !== "7"`.
- **Giải pháp 3 lớp**:
  1. **Google Apps Script (`google-apps-script-zalo-edusign.js`)**:
     - `initSheetsIfMissing()`: Cài đặt `setNumberFormat("@")` cho các cột C (SĐT), F (Zalo_Chat_ID), I (PIN). Thêm tiền tố `'` cho dữ liệu mẫu (`'0818810007`, `'0001'`, `'0007'`).
     - `handleSyncTeacher()`: Ép kiểu Text với tiền tố `'` (`"'" + normPhone`, `"'" + pinClean`) và `setNumberFormat("@")` trên toàn bộ các cell ghi/cập nhật.
     - `handleSecurePhoneMapping()`: Bổ sung `padStart(4, '0')` cho cả PIN lưu trên Sheet và PIN giáo viên nhập. Tích hợp cơ chế tự phục hồi (Self-Healing) ghi đè lại dạng chuẩn `"'0818810007"` và `"'0007"` vào Sheet ngay khi liên kết thành công.
     - `processUnifiedZaloMessage()`: Điều chỉnh Regex PIN `{1,8}` để không bỏ sót các mã PIN 1-3 ký tự do dữ liệu cũ.
     - `normalizePhone()`: Xử lý triệt để đầu số `840`, `84`, số 9 chữ số và số bàn 10 chữ số.
  2. **Frontend (`js/app.js`, `public/js/app.js`, `docs/js/app.js`)**:
     - Bổ sung helper chuẩn hóa `normalizeTeacherPhone` (10 chữ số bắt đầu bằng 0) và `normalizeTeacherPin` (`padStart(4, '0')`).
     - Đảm bảo payload đồng bộ Google Sheet (`syncTeacherToGoogleSheet`, `handleSyncAllTeachersToSheet`) và hiển thị thông tin cá nhân (`openModalUserProfile`) luôn giữ nguyên chuỗi chuẩn.
  3. **Backend (`server.js`, `dataStore.js`)**:
     - Bảo toàn `pinCode` trong API Admin và lưu trữ `dataStore` với 4 chữ số.

### 1.3. Nhiệm vụ R2: Tái thiết kế Giao diện Danh sách Giáo viên (Hình 3)
- **Cụm Thanh công cụ & Nút bấm**:
  - Hài hòa nút "Đồng bộ Google Sheet" (Subtle Outline, Soft Emerald Tint, Live ping dot) và "Thêm Giáo viên" (Brand Fill Primary CTA).
  - Khắc phục lỗi bố cục `#tabActionContainer` và sửa lỗi hàm `switchTab` để ẩn nút đồng bộ khi rời tab Giáo viên.
  - Chống vỡ dòng trên Mobile (`overflow-x-auto whitespace-nowrap`).
- **Cột Giáo viên / Tài khoản**:
  - Phân tầng thị giác 3 cấp:
    - Cấp 1: Họ tên nổi bật (Semibold, Slate-900, tương phản 16:1 AAA) + Avatar tròn bảng màu Pastel tất định 8 dải màu.
    - Cấp 2: Tên đăng nhập `@username` + Email công vụ + CCCD.
    - Cấp 3: Thẻ Capsule Zalo thông minh `[ 📱 0818.810.007 • PIN: 0007  📋 ]` kèm nút 1-click copy và cơ chế tự bù số 0 hiển thị.
- **Cột Loại chữ ký & Quyền hạn**:
  - Tinh gọn thành 2 tầng: Huy hiệu chữ ký chính + icon badges quyền nộp Word và ủy quyền con dấu.
  - **Bảo toàn kiểm thử Playwright**: Giữ nguyên chuỗi text `Đóng dấu OK` để pass 100% `tests/07_school_seal_delegation.spec.mjs`.
- **Cột Thao tác**:
  - Action Button bar tinh gọn liền khối, kích thước ô chạm >= 36px, micro-interactions hover 4 màu chức năng (Khóa: Hổ phách, Sửa: Brand, Đổi pass: Indigo, Xóa: Đỏ).
- **Bộ lọc Tìm kiếm**:
  - Hỗ trợ tìm kiếm theo cả SĐT và Mã PIN.

### 1.4. Nhiệm vụ R3: Kịch bản Kiểm thử & Nghiệm thu
- Kịch bản `tests/test_r1_phone_pin_integrity.js`: 10 phép thử dữ liệu toàn diện cho R1.
- Kịch bản `tests/test_r3_teacher_ui_visual.spec.mjs`: Đo đạc trực quan Playwright đa độ phân giải 1920x1080 và 1366x768, kiểm tra 0 console error, 0 bẫy tràn ngang, WCAG AAA.
- Chụp ảnh Before và After vào `tests/screenshots/r2_teacher_management/`.
- Cập nhật tài liệu hướng dẫn và git push origin main.
