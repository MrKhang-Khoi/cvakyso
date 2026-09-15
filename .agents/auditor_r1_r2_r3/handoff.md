# BÁO CÁO KIỂM TOÁN TÍNH TOÀN VẸN MÃ NGUỒN & THỰC NGHIỆM (FORENSIC AUDIT REPORT)
**Target**: Requirement 1 (Sửa triệt để mất số 0 SĐT & PIN), Requirement 2 (Tái thiết kế UI Quản lý Giáo viên), Requirement 3 (Kiểm thử trực quan Playwright đa độ phân giải)  
**Profile**: General Software Project (Integrity Forensics)  
**Integrity Mode**: Development (theo `ORIGINAL_REQUEST.md:190`)  
**Auditor**: Forensic Auditor (`auditor_r1_r2_r3`)  
**Verdict**: **CLEAN (CHẤP THUẬN NGHIỆM THU 100%)**

---

## 1. Observation (Dữ liệu quan sát thực nghiệm trực tiếp)

### 1.1. Tính Xác thực của Logic Xử lý Chuỗi (Không có Facade / Không có Hardcode)
- **Hàm Chuẩn hóa SĐT và Mã PIN trên Frontend (`js/app.js:64-85`)**:
  ```javascript
  function normalizeTeacherPhone(raw) {
    if (!raw) return '';
    let clean = String(raw).replace(/\D/g, '');
    if (clean.startsWith('840') && clean.length >= 11) clean = clean.slice(2);
    else if (clean.startsWith('84') && clean.length >= 10) clean = '0' + clean.slice(2);
    if (clean.length === 9 && !clean.startsWith('0')) clean = '0' + clean;
    if (clean.length === 10 && !clean.startsWith('0') && clean.startsWith('2')) clean = '0' + clean;
    return clean;
  }

  function normalizeTeacherPin(rawPin, phone) {
    let pin = String(rawPin || '').trim();
    if (!pin && phone) {
      const cleanP = normalizeTeacherPhone(phone);
      if (cleanP.length >= 4) pin = cleanP.slice(-4);
    }
    if (!pin) pin = '1234';
    if (/^\d+$/.test(pin) && pin.length < 4) {
      pin = pin.padStart(4, '0');
    }
    return pin;
  }
  ```
- **Hàm Ghi Google Sheets & Xử lý Webhook trên GAS (`google-apps-script-zalo-edusign.js`)**:
  * Dòng 110-115, 132-135, 1963-1969, 2004-2010: Cột C (SĐT), F (Zalo Chat ID) và I (Mã PIN) được đặt định dạng hiển thị `setNumberFormat("@")`.
  * Dòng 2044, 2052, 2085, 2090: Dữ liệu ghi vào bảng tính được ép kiểu chuỗi với tiền tố nháy đơn: `cellP.setValue("'" + finalPhone)` và `cellPin.setValue("'" + pinClean)`.
  * Dòng 1545-1555: `storedPin` và `pinClean` được chuẩn hóa tự động bằng `padStart(4, "0")`.
  * Dòng 1566-1580: Cơ chế Self-Healing tự động ghi đè định dạng `@` và bù số 0 lên ô dữ liệu cũ trên Google Sheet ngay khi giáo viên gửi cú pháp liên kết Zalo.
- **Bảo toàn dữ liệu trên Backend DataStore (`dataStore.js:448-452, 511-515`)**:
  * Lưu trữ và cập nhật người dùng luôn thực thi hàm bù số 0 `p.padStart(4, '0')`.
- **Kiểm tra cờ Test Bypass / Mocking**:
  * Tuyệt đối không phát hiện bất kỳ cờ `process.env.TEST`, `IS_TEST`, `process.env.NODE_ENV === 'test'` nào can thiệp hoặc làm giả lập kết quả trong các hàm `normalizeTeacherPhone`, `normalizeTeacherPin`, `handleSyncTeacher`, hoặc `handleSecurePhoneMapping`.

### 1.2. Tính Đồng bộ Đồng nhất Tuyệt đối giữa 3 Mirror Bản quyền (SHA256 Verification)
Kết quả đo băm SHA-256 từ lệnh hệ thống `Get-FileHash -Algorithm SHA256`:
| Tệp Tin | Đường dẫn kiểm tra | Mã Băm SHA256 | Kết quả đối soát |
|---|---|---|---|
| `index.html` (Gốc) | `c:\Users\HPZBook\Desktop\KÝ SỐ\index.html` | `7597257ECBB3D3E8525DF54654E5B16F7A538001D35789CF4DE9E085AD0D2ECF` | GỐC |
| `public/index.html` | `c:\Users\HPZBook\Desktop\KÝ SỐ\public\index.html` | `7597257ECBB3D3E8525DF54654E5B16F7A538001D35789CF4DE9E085AD0D2ECF` | **100% IDENTICAL** |
| `docs/index.html` | `c:\Users\HPZBook\Desktop\KÝ SỐ\docs\index.html` | `7597257ECBB3D3E8525DF54654E5B16F7A538001D35789CF4DE9E085AD0D2ECF` | **100% IDENTICAL** |
| `js/app.js` (Gốc) | `c:\Users\HPZBook\Desktop\KÝ SỐ\js\app.js` | `501D47BE28AC9F6B6D29077B100386FA24D084F7A016655E067CD377021A5FDA` | GỐC |
| `public/js/app.js` | `c:\Users\HPZBook\Desktop\KÝ SỐ\public\js\app.js` | `501D47BE28AC9F6B6D29077B100386FA24D084F7A016655E067CD377021A5FDA` | **100% IDENTICAL** |
| `docs/js/app.js` | `c:\Users\HPZBook\Desktop\KÝ SỐ\docs\js\app.js` | `501D47BE28AC9F6B6D29077B100386FA24D084F7A016655E067CD377021A5FDA` | **100% IDENTICAL** |

### 1.3. Thẩm định Minh chứng Trực quan Screenshot Artifacts (R3)
Đã đọc nhị phân (Binary Magic Bytes) và kích thước tệp ảnh thật:
- **`tests/screenshots/r2_teacher_management/Desktop_1920x1080_teacher_management_table.png`**:
  * Kích thước: `207,387 bytes` (~207 KB)
  * Magic header: `89504e470d0a1a0a` (PNG tiêu chuẩn hợp lệ)
  * Kích thước ảnh: `1920 x 1080`
  * Quan sát trực tiếp qua `view_file`: Giao diện Admin hiển thị đầy đủ thanh tab, nút "Đồng bộ Google Sheet Live" bo viền nhẹ nhàng (Subtle Outline), nút "+ Thêm Giáo viên" (Brand Fill), thanh tìm kiếm & bộ lọc, bảng danh sách giáo viên có Avatar tròn chữ cái đầu, tên semibold nổi bật, username @cva.ty, Email, CCCD, Thẻ capsule Zalo xanh ngọc hiển thị rõ nét `📱 0818810007 • PIN: 0007` kèm nút copy, các badge gom gọn USB Token / VGCA SmartCA / Word OK / Đóng dấu OK, Trạng thái "Hoạt động" kèm chấm xanh phát sáng, và cụm nút thao tác 4 nút.
- **`tests/screenshots/r2_teacher_management/Laptop_1366x768_teacher_management_table.png`**:
  * Kích thước: `147,831 bytes` (~148 KB)
  * Magic header: `89504e470d0a1a0a` (PNG tiêu chuẩn hợp lệ)
  * Kích thước ảnh: `1366 x 768`
  * Quan sát trực tiếp qua `view_file`: Responsive hoàn hảo, không có bẫy tràn ngang, khoảng cách các nút và chữ sắc nét, độ tương phản chuẩn mực.

### 1.4. Kết quả Thực thi Kiểm thử Thực nghiệm Độc lập (Independent Test Execution)
1. **Kiểm thử Tính toàn vẹn SĐT & Mã PIN (`node tests/test_r1_phone_pin_integrity.js`)**:
   * Chạy trực tiếp qua Node.js VM môi trường độc lập.
   * Kết quả: **10/10 PASS (100%)**
   * Chi tiết:
     - `normalizePhone` giữ nguyên chuẩn 10 số `0818810007`: PASS
     - `normalizePhone` tự động bù số 0 cho số 9 chữ số `818810007` hoặc number `818810007`: PASS
     - `normalizePhone` xử lý đầu 84 (`84818810007`, `+84818810007`): PASS
     - `normalizePhone` xử lý số bàn và các mạng (`02553850001`, `0905...`): PASS
     - Đối soát PIN với dữ liệu cũ trên Sheet bị mất số 0 (`818810007` & `7`): PASS
     - Tự động `padStart(4, '0')` khi PIN lưu là `7`: PASS
     - Đối soát PIN mặc định là 4 số cuối SĐT (`0905123456` & `3456`): PASS
     - Từ chối khi nhập sai PIN: PASS
     - `handleSyncTeacher` cập nhật bảo toàn số 0: PASS
     - `handleSyncTeacher` thêm mới bảo toàn số 0: PASS
2. **Kiểm thử Trực quan & Đa độ phân giải Playwright (`npx playwright test tests/test_r3_visual_multi_resolution.spec.mjs`)**:
   * Thời gian chạy: `23.6s`
   * Kết quả: **6/6 PASS (100%)**
   * Chi tiết:
     - Desktop 1920x1080 - Trực quan, bố cục & bẫy tràn ngang: `window=1920px`, `docScrollW=1920px`, `hasPageOverflow: false` -> PASS
     - Desktop 1920x1080 - Công thái học: Kích thước nút thao tác `32x32px`, Tương phản tên giáo viên đạt `17.85:1` (chuẩn WCAG AAA >= 7:1) -> PASS
     - Desktop 1920x1080 - Phân tầng thị giác: Avatar tròn, @cva.ty, SĐT `0818810007`, PIN `0007` -> PASS
     - Laptop 1366x768 - Trực quan, bố cục & bẫy tràn ngang: `window=1366px`, `docScrollW=1366px`, `hasPageOverflow: false` -> PASS
     - Laptop 1366x768 - Công thái học: Kích thước nút thao tác `32x32px`, Tương phản tên giáo viên `17.85:1` -> PASS
     - Laptop 1366x768 - Phân tầng thị giác & Zalo capsule -> PASS
     - Console F12: **0 lỗi** (0 console errors, 0 page errors).

---

## 2. Logic Chain (Chuỗi suy luận logic từ chứng cứ đến kết luận)

1. **Từ Quan sát 1.1**: Cả phía Client (`js/app.js`), Phía Server (`server.js`, `dataStore.js`), và Phía Cloud Google Apps Script (`google-apps-script-zalo-edusign.js`) đều áp dụng đồng thời kỹ thuật:
   - Ép kiểu định dạng Text với tiền tố `'` và format cell `@`.
   - Thuật toán chuẩn hóa chuỗi regex bóc tách và tự động bù số 0 (`padStart(4, '0')` và bù `0` cho số 9 chữ số).
   - Cơ chế tự phục hồi (Self-Healing) sửa lại dữ liệu cũ trên Google Sheet.
   - Không chứa bất kỳ mã nguồn giả lập (facade), không kiểm tra biến môi trường test để gian lận.  
   $\rightarrow$ **Khẳng định**: Yêu cầu R1 được hiện thực hóa bằng mã nguồn thực tế, triệt để và an toàn 100%.

2. **Từ Quan sát 1.2**: Các bản sao mirror phục vụ triển khai Web tĩnh GitHub Pages (`docs/`) và Express Static (`public/`) có mã băm SHA256 trùng khớp 100% từng byte với mã nguồn tại thư mục gốc.  
   $\rightarrow$ **Khẳng định**: Không có hiện tượng phân mảnh phiên bản hoặc quên đồng bộ giữa các môi trường triển khai.

3. **Từ Quan sát 1.3 và 1.4**:
   - Các ảnh chụp màn hình là tệp ảnh PNG thật, đúng độ phân giải màn hình trường học (1920x1080 và 1366x768), phản ánh đúng giao diện người dùng mới: Cụm nút đồng bộ Subtle Outline & Thêm giáo viên Brand Fill, phân tầng thị giác 3 cấp (Avatar tròn, @username, Zalo capsule `[ 📱 0818810007 • PIN: 0007 ]`), gom cụm badge, thanh thao tác 4 nút.
   - Kịch bản kiểm thử đo đạc thực tế 0 bẫy tràn ngang (`scrollWidth === clientWidth`), tương phản màu chữ 17.85:1 vượt xa chuẩn WCAG AAA (7.0:1), 0 lỗi console F12.  
   $\rightarrow$ **Khẳng định**: Yêu cầu R2 và R3 được hoàn thành đầy đủ, đạt độ tinh tế cao theo đúng yêu cầu bài toán.

---

## 3. Caveats (Các giả định & Phạm vi không mở rộng)
- Môi trường kiểm thử Playwright sử dụng mock bridge cho cổng phần cứng USB Token (`http://127.0.0.1:18888`) để phục vụ chạy tự động trong CI/CD headless, đây là thiết kế chuẩn mực đã có từ các mốc kiểm thử trước và không ảnh hưởng đến giao diện Quản trị Giáo viên (R2) hay logic dữ liệu SĐT/PIN (R1).
- Ngoài phạm vi 3 yêu cầu trên, không có bất kỳ cảnh báo rủi ro nào khác.

---

## 4. Conclusion (Kết luận giám định)
- **Verdict**: **CLEAN (100% HỢP LỆ — KHÔNG GIAN LẬN — CHẤP THUẬN NGHIỆM THU)**.
- Toàn bộ các tiêu chí nghiệm thu của Milestone R1 (Sửa lỗi mất số 0), R2 (Tái thiết kế giao diện danh sách giáo viên), và R3 (Kiểm thử thực nghiệm Playwright & minh chứng trực quan) đều được đáp ứng xuất sắc, mã nguồn sạch sẽ, không có tác dụng phụ (Zero-Side-Effect).

---

## 5. Verification Method (Hướng dẫn tái kiểm chứng độc lập)
Bất kỳ kiểm toán viên hoặc người dùng nào đều có thể chạy lại độc lập các câu lệnh sau từ thư mục gốc `c:\Users\HPZBook\Desktop\KÝ SỐ`:

1. **Kiểm tra mã băm SHA256 các mirrors**:
   ```powershell
   Get-FileHash -Algorithm SHA256 index.html, public/index.html, docs/index.html, js/app.js, public/js/app.js, docs/js/app.js
   ```
2. **Chạy bộ kiểm tra logic SĐT & Mã PIN**:
   ```bash
   node tests/test_r1_phone_pin_integrity.js
   ```
3. **Chạy bộ kiểm tra trực quan Playwright đa độ phân giải**:
   ```bash
   npx playwright test tests/test_r3_visual_multi_resolution.spec.mjs
   ```
4. **Kiểm tra tệp ảnh minh chứng giao diện**:
   - `tests/screenshots/r2_teacher_management/Desktop_1920x1080_teacher_management_table.png`
   - `tests/screenshots/r2_teacher_management/Laptop_1366x768_teacher_management_table.png`
