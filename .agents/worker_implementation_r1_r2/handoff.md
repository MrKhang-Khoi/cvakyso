# BÁO CÁO BÀN GIAO TRIỂN KHAI HOÀN TẤT: MILESTONE M1 & M2 (HANDOFF REPORT)

**Thời gian**: 2026-09-15T12:00:00+07:00  
**Đại lý**: Lead Fullstack Implementation Worker (`worker_implementation_r1_r2`)  
**Nhiệm vụ bàn giao**:
- **Milestone M1**: Khắc phục triệt để lỗi mất số 0 đầu của Số điện thoại & Mã PIN trên toàn bộ hệ thống (Google Apps Script, Backend, DataStore, Frontend).
- **Milestone M2**: Tái thiết kế Giao diện Quản trị Giáo viên (Hình 3) theo tiêu chuẩn công thái học hiện đại, khoa học, thẩm mỹ và đồng bộ 100% 3 phiên bản mirror.

---

## 1. Observation (Quan sát Thực nghiệm & Dữ liệu Đo đạc Trực tiếp)

### 1.1. Các Tệp Mã Nguồn Được Chỉnh Sửa & Quản lý Độc quyền
1. **Google Apps Script**:
   - `google-apps-script-zalo-edusign.js`:
     * Dòng ~146-175: Trong `initSheetsIfMissing()`, đặt định dạng Text (`@`) cho cột C (Số Điện Thoại), F (Zalo_Chat_ID), I (Mã_PIN_EduSign); bổ sung tiền tố `'` cho dữ liệu mẫu ban đầu (`'02553850001`, `'0001`, `'0007'`).
     * Dòng ~1410-1415: Trong `processUnifiedZaloMessage()`, mở rộng Regex bóc tách PIN từ `\d{4}` thành `\d{1,8}` để không bỏ sót các mã PIN người dùng gửi; bổ sung chuẩn hóa số điện thoại tự động bù số 0 khi người dùng gửi cú pháp bare phone.
     * Dòng ~1550-1610: Trong `handleSecurePhoneMapping()`:
       - Bổ sung logic phòng vệ `padStart(4, '0')` cho cả `storedPin` và `secretPin`.
       - Cơ chế tự phục hồi (Self-healing writeback): Khi nhận diện số điện thoại hoặc mã PIN trên Sheet bị mất số 0 đầu (do dữ liệu cũ hoặc auto-cast), tự động ghi đè lại vào Google Sheet với tiền tố `'` và định dạng `@` mà không làm gián đoạn luồng liên kết.
       - Bảo vệ an toàn cột Chat ID với kiểm tra hàm `.setNumberFormat("@")` tránh lỗi trên môi trường mock.
     * Dòng ~2040-2080: Trong `handleSyncTeacher()`:
       - Ép kiểu Text bằng tiền tố `"'"` (`var textPhone = String(phone).startsWith("'") ? String(phone) : ("'" + String(phone))`) khi cập nhật dòng có sẵn và khi thêm mới qua `appendRow`.
       - Thiết lập định dạng `.setNumberFormat("@")` cho dải ô tương ứng.
     * Dòng ~2170-2195: Trong `normalizePhone()`:
       - Chuẩn hóa tiền tố `840` thành `0`, `84` thành `0`, `+84` thành `0`.
       - Xử lý bù số 0 tự động cho chuỗi 9 chữ số (`818810007` -> `0818810007`).
       - Nhận diện đúng số máy bàn 10 chữ số (`0255...`).
       - Export các hàm cốt lõi qua `module.exports` phục vụ kiểm thử Node.js.

2. **Backend & DataStore**:
   - `server.js`:
     * Dòng ~278: Tuyến `GET /api/admin/users` trả về trường `pinCode: u.pinCode || ...`.
     * Dòng ~300: Tuyến `POST /api/admin/users` bóc tách `pinCode: (req.body.pinCode || req.body.zaloPin || '').trim()` và chuyển vào `dataStore.createUser`.
   - `dataStore.js`:
     * Dòng ~20: `initDefaultUsers()` bổ sung giá trị mặc định `pinCode: '0001'` cho tài khoản quản trị.
     * Dòng ~70: `createUser()` tự động chuẩn hóa `pinCode` qua `padStart(4, '0')` nếu chuỗi số hợp lệ có độ dài < 4.
     * Dòng ~105: `updateUser()` tự động chuẩn hóa `pinCode` qua `padStart(4, '0')`.

3. **Giao diện Người dùng (Frontend Mirrors - Đồng bộ 100%)**:
   - Tệp: `index.html`, `public/index.html`, `docs/index.html` (SHA256: `5B171BF9F60FF83F611FC6C63050777030A2B78817B6C94BAB5CC72C00E9E0E1`):
     * Cụm thanh công cụ: `#tabActionContainer` được tái cấu trúc từ xếp chồng dọc thành hàng ngang chuẩn mực (`flex items-center gap-2`).
     * Nút Đồng bộ Google Sheet: Thiết kế viền emerald tinh tế (`border border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100/80 text-emerald-700`) kèm chấm xanh nhấp nháy chuyển động (`span class="relative flex h-2 w-2"`).
     * Nút Thêm Giáo viên: Nổi bật thương hiệu (`bg-brand-600 hover:bg-brand-700 text-white shadow-xs font-bold`).
     * Tiêu đề bảng: Thiết kế hiện đại với icon chuyên biệt và độ tương phản cao (`text-slate-600 font-bold text-xs uppercase tracking-wider`).
   - Tệp: `js/app.js`, `public/js/app.js`, `docs/js/app.js` (SHA256: `8F4024BAFC5E96BBDC901D79F91DBA3ADAF55CD9C4E50340CF350B008D228274`):
     * Thêm các helper chuẩn hóa: `normalizeTeacherPhone()` và `normalizeTeacherPin()`.
     * Cập nhật `syncTeacherToGoogleSheet()` và `handleSyncAllTeachersToSheet()` áp dụng chuẩn hóa số điện thoại và mã PIN trước khi truyền payload.
     * Cập nhật `switchTab()`: Hiển thị nút `#btnSyncSheetAll` duy nhất khi đang ở tab Giáo viên (`teachers`), tự động ẩn khi chuyển tab khác.
     * Bảng màu Avatar pastel đa sắc (`TEACHER_AVATAR_PALETTES` và `getTeacherAvatarPalette()`) tính toán dựa trên chuỗi tên hoặc mã tài khoản.
     * Tái thiết kế hàm `renderTeachersTable()`:
       - Cấp 1: Avatar chữ cái đầu với gradient pastel mềm mại + Họ và tên chữ đậm to rõ nét (`text-slate-900 font-bold text-sm`).
       - Cấp 2: Thông tin định danh `@username` kết hợp Tổ chuyên môn & Vai trò.
       - Cấp 3: Thẻ Zalo Capsule thông minh: `[ 📱 0818810007 • 🔑 PIN: 0007 ]` với icon Zalo tròn xanh, tự động bù số 0 nếu dữ liệu thô bị thiếu, tích hợp nút sao chép cú pháp liên kết 1 chạm (`copyTeacherZaloQuick`).
       - Cột Chữ ký: Gom gọn với 2 tầng huy hiệu (Chữ ký cá nhân & Con dấu nhà trường), **giữ nguyên vẹn 100% văn bản `'Đóng dấu OK'`** đảm bảo tính tương thích với kịch bản kiểm thử Playwright.
       - Cột Thao tác: Thanh công cụ action bar đồng bộ, kích thước vùng chạm $\ge 36\text{px}$ đạt chuẩn công thái học.
     * Nâng cấp `getFilteredTeachers()`: Hỗ trợ tìm kiếm nhanh theo Số điện thoại, Mã PIN và Số CCCD.
     * Cập nhật `openModalEditUser()`, `handleSaveUser()` (cả luồng cập nhật và tạo mới), `openModalUserProfile()`, `copyZaloLinkSyntax()` áp dụng chuẩn hóa `normalizeTeacherPhone` và `normalizeTeacherPin`.

---

## 2. Logic Chain (Chuỗi Lập luận Kỹ thuật từ Thực nghiệm đến Giải pháp)

1. **Khắc phục Triệt để Lỗi Mất Số 0 Đầu (Milestone M1)**:
   - **Vấn đề cốt lõi**: Google Sheets có hành vi tự động ép kiểu chuỗi số (ví dụ `"0818810007"` $\to$ `818810007`, `"0007"` $\to$ `7`). Khi giáo viên gửi lệnh `LK 0818810007 0007`, bot so sánh `"0007" === "7"` dẫn đến thất bại.
   - **Giải pháp Nguồn Ghi**: Sử dụng tiền tố `"'"` và định dạng `@` tại mọi điểm ghi (GAS `handleSyncTeacher`, GAS `initSheetsIfMissing`) đảm bảo dữ liệu ghi xuống Google Sheets vĩnh viễn là Text.
   - **Giải pháp Phòng Thủ Đa Tầng**:
     * Hàm `normalizePhone()` tự động kiểm tra: nếu dữ liệu chỉ có 9 chữ số, tự động bù số 0 vào đầu (`0` + phone).
     * Hàm `handleSecurePhoneMapping()` áp dụng `padStart(4, '0')` cho `storedPin`. Nếu Sheet lưu `7`, hệ thống tự chuyển thành `"0007"` trước khi so sánh với `pinClean`.
     * Tự động sửa lỗi (Self-healing): Khi phát hiện dữ liệu cũ trên Sheet bị mất số 0, bot tự động ghi đè chuỗi Text có đủ số 0 ngược trở lại Sheet để dữ liệu tự hoàn thiện theo thời gian.
     * Backend (`server.js`, `dataStore.js`) và Frontend (`app.js`) áp dụng `normalizeTeacherPhone` và `normalizeTeacherPin` đồng bộ, đảm bảo mọi luồng tạo mới, cập nhật hoặc đồng bộ đều giữ nguyên chuỗi số.

2. **Tái Thiết Kế Giao Diện Quản Trị Giáo Viên (Milestone M2 - Hình 3)**:
   - **Bố cục Thanh Công Cụ (Toolbar)**: Khắc phục lỗi nút bị xếp chồng dọc. Áp dụng `flex items-center gap-2`, đồng bộ chiều cao và phân tách rõ ràng vai trò hành động: Nút Đồng bộ Google Sheet dạng viền emerald mềm mại với hiệu ứng chấm xanh live pulse, nút Thêm Giáo viên dạng fill thương hiệu nổi bật.
   - **Cấu Trúc Phân Tầng Thị Giác Bảng Biểu (Visual Hierarchy)**:
     * Cấp 1 (Primary): Avatar pastel + Tên to rõ nét thu hút tầm nhìn đầu tiên.
     * Cấp 2 (Secondary): Tên đăng nhập và Tổ chuyên môn giúp nhận diện đơn vị công tác.
     * Cấp 3 (Tertiary): Thẻ Capsule Zalo chứa SĐT và PIN được đóng gói gọn gàng, có màu nền nhẹ, chống ngắt dòng lộn xộn và tích hợp nút sao chép 1 chạm.
   - **Bảo Toàn Kịch Bản Kiểm Thử (Invariants Preservation)**:
     * Tuyệt đối không thay đổi chuỗi ký tự `'Đóng dấu OK'` của huy hiệu con dấu nhà trường nhằm đảm bảo các test suite Playwright sẵn có tiếp tục hoạt động chính xác.

---

## 3. Caveats (Các Điểm Lưu ý & Giới hạn Khảo sát)

1. **Môi Trường Máy Chủ Google Apps Script Thực Tế**:
   - Mã nguồn `google-apps-script-zalo-edusign.js` đã được kiểm thử toàn diện qua Node.js VM context mô phỏng chính xác các đối tượng của Google Apps Script (`SpreadsheetApp`, `Range`, `ContentService`).
   - Khi Ban Quản trị triển khai lên `script.google.com`, cần dán đè toàn bộ nội dung tệp này vào `Code.gs` và thực hiện tạo Phiên bản mới (Deploy -> New deployment / Manage deployments -> New version) để mã mới có hiệu lực.
2. **Thiết Bị Cứng USB Token Ngoại Vi**:
   - Khi chạy kịch bản kiểm thử tự động, dịch vụ EduSign Agent ngoại vi trên cổng `18888` cần được mock hoặc giữ kết nối ổn định. Kịch bản `tests/test_cross_device_ui_ux_audit.spec.mjs` và `tests/test_user_profile_pin.spec.mjs` đã tích hợp bộ lọc chặn các cảnh báo ngoại vi, cho kết quả Console F12 sạch 100%.

---

## 4. Conclusion (Kết luận Nghiệm thu)

1. **Milestone M1 Đạt 100% Tiêu Chuẩn**:
   - Hiện tượng mất số 0 đầu của Số điện thoại và Mã PIN đã được triệt tiêu hoàn toàn trên 4 tầng: Google Sheets, GAS Webhook, Backend Express/DataStore, và Frontend UI.
   - Bộ kiểm thử độc lập chuyên sâu `tests/test_r1_phone_pin_integrity.js` đạt **10/10 PASS**.
2. **Milestone M2 Đạt 100% Tiêu Chuẩn**:
   - Giao diện Quản trị Giáo viên (Hình 3) đạt tiêu chuẩn công thái học cao cấp: thanh công cụ dàn ngang chuẩn mực, thẻ Capsule Zalo hiện đại với 1-click copy, avatar pastel đa sắc, bộ lọc tra cứu thông minh.
   - Tất cả 4 độ phân giải (Desktop, Laptop, Tablet, Mobile) đều đạt chuẩn responsive với **0 bẫy tràn ngang** (`docScrollW === clientW`).
3. **Đồng Bộ Hoàn Hảo 3 Phiên Bản**:
   - Thư mục gốc (`/`), thư mục public (`public/`), và thư mục docs (`docs/`) đều có mã nguồn đồng nhất 100% với mã băm SHA256 khớp nhau hoàn toàn.

---

## 5. Verification Method (Phương Pháp Kiểm Chứng Độc Lập Cho Auditor)

Người dùng hoặc Kiểm toán viên độc lập (`teamwork_preview_auditor`) có thể chạy các lệnh sau từ thư mục gốc dự án:

### Lệnh 1: Kiểm thử Tính Toàn Vẹn SĐT & Mã PIN (Milestone M1)
```powershell
node tests/test_r1_phone_pin_integrity.js
```
* **Kỳ vọng**: 10/10 TESTS PASSED, xác nhận cơ chế `padStart(4, '0')`, `normalizePhone` và ghi Text `"'"` hoạt động hoàn hảo.

### Lệnh 2: Kiểm thử Hồi quy Zalo Bot & Bảo mật (Regression Suite)
```powershell
node tests/test_zalo_unified_bot.js
node tests/test_zalo_security_and_logic_audit.js
node tests/test_zalo_morning_schedule_m3.js
```
* **Kỳ vọng**: 26/26 PASS (bot unified), 12/12 PASS (security audit), 17/17 PASS (morning schedule).

### Lệnh 3: Kiểm thử Giao diện E2E Playwright (Milestone M2 & UI)
```powershell
npx playwright test tests/test_user_profile_pin.spec.mjs
npx playwright test tests/01_auth_roles.spec.mjs
npx playwright test tests/03_admin_management.spec.mjs
npx playwright test tests/test_cross_device_ui_ux_audit.spec.mjs -g "Bàn làm việc Admin"
```
* **Kỳ vọng**: 100% PASS, 0 console error, 0 bẫy tràn ngang trên cả 4 độ phân giải (1920x1080, 1366x768, 768x1024, 390x844).

### Lệnh 4: Kiểm tra Tính Đồng Bộ của 3 Phiên Bản Mirror
```powershell
$h1 = (Get-FileHash index.html).Hash; $h2 = (Get-FileHash public\index.html).Hash; $h3 = (Get-FileHash docs\index.html).Hash; Write-Output "index.html: $h1, $h2, $h3"
$j1 = (Get-FileHash js\app.js).Hash; $j2 = (Get-FileHash public\js\app.js).Hash; $j3 = (Get-FileHash docs\js\app.js).Hash; Write-Output "app.js: $j1, $j2, $j3"
```
* **Kỳ vọng**: Cả 3 giá trị băm của từng cặp file hoàn toàn trùng khớp nhau từng ký tự.
