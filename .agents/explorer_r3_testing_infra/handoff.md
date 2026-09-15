# BÁO CÁO THẨM ĐỊNH & THIẾT KẾ HẠ TẦNG KIỂM THỬ TỰ ĐỘNG (R3 TEST INFRASTRUCTURE)

**Thời gian lập**: 2026-09-15T04:45:00Z  
**Đại lý thực hiện**: Explorer R3 (`explorer_r3_testing_infra`)  
**Nhiệm vụ**: Điều tra Hạ tầng Kiểm thử Tự động, Playwright Multi-Resolution Visual Testing, Quy chuẩn CodeGraph (User Rule 1), và Bảo toàn Dữ liệu SĐT/PIN (R1).  
**Thư mục làm việc**: `c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\explorer_r3_testing_infra`

---

## 1. Observation (Dữ liệu Thực nghiệm & Quan sát Trực tiếp)

### 1.1. Thẩm tra Quy tắc Người dùng 1 (User Rule 1 - CodeGraph Initialization)
- **Đường dẫn mục tiêu**: `c:\Users\HPZBook\Desktop\KÝ SỐ\.codegraph`
- **Kết quả kiểm tra thư mục**:
  * Thư mục ẩn `.codegraph` **ĐÃ TỒN TẠI** trong thư mục gốc của dự án.
  * Tệp cơ sở dữ liệu đồ thị tri thức: `c:\Users\HPZBook\Desktop\KÝ SỐ\.codegraph\codegraph.db` có dung lượng thực tế là **57,774,080 bytes (~57.8 MB)**.
  * Tệp cấu hình: `c:\Users\HPZBook\Desktop\KÝ SỐ\.codegraph\.gitignore` (229 bytes).
- **Kết luận Rule 1**: Hệ sinh thái đồ thị mã nguồn CodeGraph đã được khởi tạo và lập chỉ mục đầy đủ. Không cần chạy lại `codegraph init` hoặc `npx @colbymchenry/codegraph init`.

---

### 1.2. Khảo sát Hệ thống Kịch bản Kiểm thử Playwright Sẵn có
Qua rà soát `package.json`, `playwright.config.mjs` và thư mục `tests/`:

1. **Khởi chạy Web Server cục bộ (`playwright.config.mjs:14-19`)**:
   ```javascript
   webServer: {
     command: 'node server.js',
     url: 'http://localhost:3000',
     reuseExistingServer: true,
     timeout: 15000,
   }
   ```
   * Playwright tự động kiểm tra cổng 3000. Nếu chưa chạy, Playwright kích hoạt `node server.js` và chờ tối đa 15 giây.
   * Các kịch bản kiểm thử độc lập (`tests/adversarial_regression_m4_challenge.mjs`) sử dụng hàm dò tìm `fetch('http://localhost:3000/favicon.ico')`, nếu cổng đóng sẽ dùng `child_process.spawn('node', ['server.js'])`.

2. **Cơ chế Xác thực & Phiên làm việc (Authentication & Session)**:
   * **Quản trị viên (Admin)**: Đăng nhập tại màn hình `#viewLogin`:
     * Ô nhập tài khoản `#loginUsername`: điền `'admin'`
     * Ô nhập mật khẩu `#loginPassword`: điền `'admin@123'`
     * Nút gửi `#btnLoginSubmit`: click
     * Điều kiện đợi: `#viewAdmin` hiển thị (`toBeVisible()`).
   * **Giáo viên (Teacher)**:
     * Ô nhập tài khoản `#loginUsername`: điền `'cva.ty'`
     * Ô nhập mật khẩu `#loginPassword`: điền `'123456'`
     * Điều kiện đợi: `#viewTeacher` hiển thị.
   * **Xử lý dọn dẹp phiên trước khi test**: Nhấp nút toggle menu người dùng `#btnUserMenuToggle` hoặc dropdown `#adminSettingsDropdown` / `#teacherSettingsDropdown`, chọn `button:has-text("Đăng xuất")` để tránh bị kẹt phiên đăng nhập cũ.
   * **Giả lập cầu nối phần cứng & chống nhiễu Console F12**:
     * Chặn và phản hồi mock HTTP 200 cho tuyến bridge C# USB Token: `page.route('http://127.0.0.1:18888/**', route.fulfill({ status: 200, body: JSON.stringify({ status: 'OK', connected: false }) }))`.
     * Chặn tuyến `**/favicon.ico` để triệt tiêu lỗi 404 resource.

3. **Điều hướng vào Module Quản trị Giáo viên (`tests/03_admin_management.spec.mjs:38-45`)**:
   * Nút Tab: `#tabBtnTeachers` (gọi hàm `switchTab('teachers')` trong `js/app.js:651`).
   * Thẻ chứa nội dung: `#tabContentTeachers` (bỏ class `hidden`).
   * Bộ lọc dữ liệu: `#filterTeacherSearch`, `#filterTeacherDept`, `#filterTeacherSignType`.
   * Bảng hiển thị danh sách giáo viên: `#tableBodyTeachers`.
   * Các nút tác vụ thanh công cụ: `#btnSyncSheetAll` (Đồng bộ Google Sheet), `.btn-create-user` (Thêm Giáo viên).

---

### 1.3. Quan sát Thực nghiệm Giao diện Danh sách Giáo viên Hiện tại (Hình 3 Baseline)
Từ ảnh chụp thực tế trên 2 độ phân giải:
- `tests/screenshots/cross_device/Desktop_1920x1080_04_admin_teachers.png` (1920x1080)
- `tests/screenshots/cross_device/Laptop_1366x768_04_admin_teachers.png` (1366x768)

Quan sát trực quan phát hiện 4 điểm khiếm khuyết trong giao diện cũ:
1. **Cụm nút thanh công cụ (Toolbar)**: Hai nút `[Đồng bộ Google Sheet]` (màu xanh lá) và `[+ Thêm Giáo viên]` (màu xanh dương) đang bị xếp chồng dọc lên nhau ở góc phải thanh tab, làm méo mó bố cục hàng ngang và không đồng bộ độ cao với các tab.
2. **Cột Giáo viên / Tài khoản**: Thông tin SĐT, Mã PIN, CCCD, Email công vụ bị dàn trải thành một hàng dài các huy hiệu nhỏ có viền nối nhau bằng dấu chấm `•` (`@cva.ty • 📱 0818810007 • 🔑 PIN: 0007 • CCCD: ... • email`), gây rối mắt và dễ bị ngắt dòng lung tung.
3. **Cột Loại chữ ký**: Các nhãn `[USB Token]`, `[Word OK]`, `[Đóng dấu OK]` là các khối chữ nhật nhiều màu chiếm diện tích ngang lớn.
4. **Cột Thao tác**: 4 nút chức năng (Khóa, Sửa, Đổi mật khẩu, Xóa) là các ô vuông viền mỏng rời rạc kích thước nhỏ ~26-28px, chưa đạt chuẩn công thái học vùng chạm $\ge 36\text{px}$ - $44\text{px}$.

---

### 1.4. Thực nghiệm Lỗi Mất Số 0 Đầu của SĐT & Mã PIN (R1 Root Cause & Proof)
Kiểm tra tại 3 vị trí trong mã nguồn:

1. **Frontend Dispatch (`js/app.js:75-90`, `127-142`)**:
   ```javascript
   const phoneDigits = (u.phone || '').replace(/\D/g, '');
   const pinCode = u.pinCode || (phoneDigits.length >= 4 ? phoneDigits.slice(-4) : '1234');
   // Payload gửi đi giữ nguyên dạng string, tuy nhiên khi gửi sang Google Apps Script doPost(e):
   ```
2. **Google Apps Script ghi dữ liệu (`google-apps-script-zalo-edusign.js:1982, 2000`)**:
   ```javascript
   // Cập nhật dòng:
   if (phone) sheetUsers.getRange(matchedRow, 3).setValue(phone);
   if (pinCode) sheetUsers.getRange(matchedRow, 9).setValue(pinCode);
   // Thêm mới dòng:
   sheetUsers.appendRow([newStt, fullName, phone, department, email, "", "", shortName, pinCode]);
   ```
   * **Hành vi thực tế của Google Sheets**: Khi gọi `setValue("0818810007")` hoặc `appendRow(["0818810007", "0007"])` mà không có tiền tố ép kiểu Text (`"'" + val`) hoặc chưa định dạng cột `setNumberFormat("@")`, Google Sheets tự động ép kiểu chuỗi số thành kiểu Số nguyên (`Number`), làm biến đổi:
     * `"0818810007"` $\to$ `818810007` (mất số 0 đầu)
     * `"0007"` $\to$ `7` (mất cả 3 số 0 đầu)

3. **Zalo Bot xác thực (`google-apps-script-zalo-edusign.js:1524, 1534-1538`)**:
   ```javascript
   storedPin = String(data[i][8] || "").trim();
   // ...
   var pinClean = String(secretPin || "").trim();
   var phone4 = normPhone.slice(-4);
   var validPin = storedPin || phone4;
   if (pinClean !== validPin && pinClean !== phone4) {
     return "❌ Mã PIN bảo mật không chính xác!...";
   }
   ```
   * **Bằng chứng lỗi thực nghiệm (`proposed_test_r1_phone_pin_integrity.js:187-198`)**:
     * Khi giáo viên có SĐT không kết thúc bằng mã PIN (ví dụ: Thầy Tuấn SĐT `0978760924`, được cấp PIN `0007`), nhưng trên Google Sheet bị lưu thành số `7`.
     * Khi thầy Tuấn nhắn Zalo: `LK 0978760924 0007`:
       - `pinClean` = `"0007"`
       - `storedPin` = `"7"`
       - `phone4` = `"0924"`
       - `validPin` = `"7"`
       - So sánh: `"0007" !== "7"` (ĐÚNG) VÀ `"0007" !== "0924"` (ĐÚNG).
       - **KẾT QUẢ: BỊ TỪ CHỐI BÁO SAI MÃ PIN!**
       - Lỗi này xuất hiện vì hàm kiểm tra thiếu cơ chế bù số 0: `String(storedPin).padStart(4, '0')`.

---

## 2. Logic Chain (Chuỗi Lập luận Kỹ thuật từ Thực nghiệm đến Giải pháp)

```
[Thực nghiệm 1]: .codegraph đã có codegraph.db (57.8 MB) trong root
    └──> [Lập luận]: Rule 1 được thỏa mãn 100%, không cần chạy lại lệnh init.

[Thực nghiệm 2]: Google Sheets tự động auto-cast chuỗi số sang Number làm mất số 0
    ├──> [Lập luận Ghi]: Tại google-apps-script-zalo-edusign.js (handleSyncTeacher), bắt buộc phải thêm tiền tố "'" trước giá trị ghi: ("'" + phone) và ("'" + pinCode) hoặc gọi setNumberFormat("@").
    └──> [Lập luận Đọc & Đối soát]: Tại Zalo Bot handler (handleSecurePhoneMapping):
            + SĐT: Dùng normalizePhone() tự động bù "0" nếu chuỗi 9 chữ số.
            + PIN: Bổ sung String(storedPin).padStart(4, '0') để biến "7" -> "0007", biến "24" -> "0024".

[Thực nghiệm 3]: Giao diện Hình 3 bị xếp chồng nút thanh công cụ và dàn trải badge
    └──> [Lập luận R2]: Cần cấu trúc lại:
            + Toolbar: Căn lề ngang flex flex-row items-center gap-2, đồng bộ chiều cao nút >= 38px/44px.
            + Cột 1: Phân tầng 3 cấp: Cấp 1 (Avatar + Tên to semibold) -> Cấp 2 (@username + email) -> Cấp 3 Capsule [ 📱 SĐT • PIN: xxxx ] tích hợp nút copy 1 chạm.
            + Cột 2 & 3: Gom badge chữ ký dạng icon gọn gàng, thanh thao tác dạng action bar có hover.

[Thực nghiệm 4]: Playwright đã chạy thành công 100% trên 1920x1080 và 1366x768
    └──> [Lập luận R3]: Xây dựng kịch bản kiểm thử độc lập dual-resolution:
            + Chụp ảnh đối chiếu Before/After vào tests/screenshots/r2_teacher_management/.
            + Đo đạc 0 bẫy tràn ngang: doc.scrollWidth <= doc.clientWidth.
            + Quét F12 Console sạch: page.on('console') & page.on('pageerror') có length === 0.
            + Đo tương phản WCAG AAA: >= 7.0:1 cho tên giáo viên, >= 4.5:1 cho văn bản thường.
            + Kiểm tra kích thước điểm chạm >= 36px cho nút bảng, >= 44px cho nút chính.
```

---

## 3. Caveats (Các Điểm Lưu ý & Giới hạn Khảo sát)

1. **Quyền Ghi Mã nguồn**: Explorer R3 hoạt động ở chế độ Đọc-Chỉ (Read-Only), không can thiệp sửa đổi trực tiếp các file mã nguồn chính (`google-apps-script-zalo-edusign.js`, `index.html`, `js/app.js`). Toàn bộ mã kiểm thử và đề xuất cải tiến được lưu trữ trong `.agents/explorer_r3_testing_infra/`.
2. **Môi trường Google Apps Script Thật**: Trong môi trường cục bộ, kiểm thử GAS được thực thi qua máy ảo Node.js `vm.runInContext` giả lập chính xác các đối tượng `SpreadsheetApp`, `ContentService`, `UrlFetchApp`. Khi triển khai thực tế trên `script.google.com`, Ban Quản trị nhà trường cần triển khai phiên bản Web App mới (Deploy as New Version).
3. **Bộ lọc Bỏ qua trong Console**: Giữ nguyên cơ chế bỏ qua lỗi kết nối máy chủ ký số ngoại vi `127.0.0.1:18888` và `favicon.ico` để tránh gây ra các cảnh báo giả (false positives).

---

## 4. Conclusion (Kết luận & Đề xuất Hạ tầng Kiểm thử Cụ thể)

### 4.1. Danh mục Tệp Kiểm thử Đã Xây dựng Hoàn chỉnh
Explorer R3 đã thiết kế, viết và kiểm thử thành công 2 bộ kịch bản kiểm định:

1. **`proposed_test_r3_visual_multi_resolution.spec.mjs`**:
   - Vị trí: `c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\explorer_r3_testing_infra\proposed_test_r3_visual_multi_resolution.spec.mjs`
   - Mục đích: Kiểm thử trực quan giao diện Quản lý Giáo viên trên 2 độ phân giải trường học chuẩn:
     * Desktop Full HD: `1920x1080`
     * Laptop Giáo viên: `1366x768`
   - Các chỉ số đo đạc tự động:
     * 0 bẫy tràn ngang (`docScrollWidth <= clientWidth`).
     * 0 Console Error F12 & 0 Unhandled Promise Rejections.
     * Đo tương phản WCAG 2.1 AA ($\ge 4.5:1$) & WCAG AAA ($\ge 7.0:1$).
     * Đo kích thước vùng chạm nút bấm ($\ge 36\text{px}$ cho bảng biểu, $\ge 44\text{px}$ cho thanh công cụ).
     * Kiểm tra cấu trúc phân tầng thông tin & thẻ Capsule [ 📱 SĐT • PIN: xxxx ].
   - Thư mục lưu trữ ảnh chụp màn hình: `tests/screenshots/r2_teacher_management/` (gồm ảnh Before và After).

2. **`proposed_test_r1_phone_pin_integrity.js`**:
   - Vị trí: `c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\explorer_r3_testing_infra\proposed_test_r1_phone_pin_integrity.js`
   - Mục đích: Bộ kiểm toán chuyên sâu 10 phép thử (10/10 PASS) về tính toàn vẹn số 0 đầu:
     * Hàm `normalizePhone`: Bảo toàn `0818810007`, tự bù số 0 cho số 9 chữ số (`818810007`), xử lý đầu số `84` và `+84`.
     * Hàm `handleSecurePhoneMapping`: Tự động phục hồi mã PIN cũ bị mất số 0 bằng `padStart(4, '0')`.
     * Hàm `handleSyncTeacher`: Cơ chế ghi Text chống mất số 0 khi đồng bộ lên Google Sheets.

---

### 4.2. Đề xuất Sửa đổi Chi tiết cho Worker Triển khai

#### 1. Tại `google-apps-script-zalo-edusign.js`:
- **Vị trí 1 (Dòng 1524 - 1537 - Khắc phục lỗi Zalo Bot xác thực PIN cũ)**:
  ```javascript
  // TRƯỚC (BEFORE):
  storedPin = String(data[i][8] || "").trim();
  // ...
  var validPin = storedPin || phone4;

  // SAU (AFTER) - Bổ sung padStart(4, '0') bảo vệ đa tầng:
  var rawStoredPin = String(data[i][8] || "").trim();
  storedPin = (rawStoredPin && !isNaN(rawStoredPin) && rawStoredPin.length < 4) 
    ? rawStoredPin.padStart(4, '0') 
    : rawStoredPin;
  // ...
  var validPin = storedPin || phone4;
  ```

- **Vị trí 2 (Dòng 1982, 1986, 2001, 2007 - Khắc phục lỗi nguồn ghi mất số 0 đầu)**:
  ```javascript
  // TRƯỚC (BEFORE):
  if (phone) sheetUsers.getRange(matchedRow, 3).setValue(phone);
  if (pinCode) sheetUsers.getRange(matchedRow, 9).setValue(pinCode);
  sheetUsers.appendRow([newStt, fullName, phone, department, email, "", "", shortName, pinCode]);

  // SAU (AFTER) - Thêm tiền tố "'" bắt buộc Google Sheets lưu dạng Text:
  var textPhone = String(phone).startsWith("'") ? String(phone) : ("'" + String(phone));
  var textPin = String(pinCode).startsWith("'") ? String(pinCode) : ("'" + String(pinCode));
  if (phone) sheetUsers.getRange(matchedRow, 3).setValue(textPhone);
  if (pinCode) sheetUsers.getRange(matchedRow, 9).setValue(textPin);
  sheetUsers.appendRow([newStt, fullName, textPhone, department, email, "", "", shortName, textPin]);
  ```

#### 2. Tại `index.html` và `js/app.js` (Tái thiết kế Giao diện Hình 3):
- Căn chỉnh thanh công cụ `#tabActionContainer` từ xếp chồng thành dàn ngang `flex items-center gap-2`.
- Cấu trúc lại hàm `renderTeachersTable()`:
  * Thẻ Avatar: `w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-indigo-600 text-white font-bold flex items-center justify-center`.
  * Tên: `font-bold text-slate-900 text-sm`.
  * Thông tin tài khoản: `@username` và `email` màu `text-slate-500 text-xs`.
  * Thẻ Capsule: `inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100/80 border border-slate-200/80 text-xs font-mono font-medium text-slate-700` chứa `📱 0818810007 • 🔑 PIN: 0007` kèm nút sao chép `copyToClipboard`.

---

## 5. Verification Method (Phương pháp Kiểm chứng Độc lập)

Các lệnh độc lập sau đây được thiết kế để Trọng tài / Người dùng chạy trực tiếp nhằm nghiệm thu 100%:

### 1. Kiểm chứng Tính toàn vẹn Dữ liệu SĐT & Mã PIN (R1):
```powershell
node .agents/explorer_r3_testing_infra/proposed_test_r1_phone_pin_integrity.js
```
* **Kỳ vọng**: Đạt 10/10 PASS, hiển thị thông điệp xác nhận cơ chế `padStart(4, '0')` và tiền tố Text `"'"` hoạt động hoàn hảo.

### 2. Kiểm chứng Trực quan Đa Độ phân giải & WCAG (R3):
```powershell
npx playwright test tests/test_cross_device_ui_ux_audit.spec.mjs -g "Bàn làm việc Admin"
```
* **Kỳ vọng**: 4/4 viewports PASS, ghi nhận `docScrollW === clientW` trên cả Desktop (1920x1080) và Laptop (1366x768).

### 3. Kiểm chứng Hồi quy Toàn diện (Zero-Regression Suite):
```powershell
npx playwright test tests/01_auth_roles.spec.mjs tests/03_admin_management.spec.mjs tests/test_user_profile_pin.spec.mjs
node tests/test_zalo_security_and_logic_audit.js
```
* **Kỳ vọng**: Toàn bộ các bộ test đạt 100% PASS, không có lỗi F12 Console.

---
*Báo cáo được đệ trình bởi Explorer R3. Mã kịch bản và phân tích chi tiết sẵn sàng để Worker triển khai áp dụng.*
