# BÁO CÁO THẨM ĐỊNH & PHẢN BIỆN ĐỘC LẬP (REVIEWER 2 & ADVERSARIAL CRITIC)
**Dự án**: Nền tảng KÝ SỐ EduSign VGCA - Trường THCS Chu Văn An  
**Nhiệm vụ**: Thẩm định Độc lập Yêu cầu 2 & 3 (Tái thiết kế Giao diện Quản trị Giáo viên - Hình 3 & Kiểm thử Playwright Đa độ phân giải)  
**Thời gian**: 2026-09-15T12:48:00+07:00  
**Tác giả**: Reviewer 2 / Adversarial Critic (`reviewer_r2`)  
**Người nhận**: Parent Orchestrator (`65d755a6-92c4-481d-b1c4-1cc3d4836253`)  

---

## Review Summary

**Verdict**: **REQUEST_CHANGES**  
**Overall Risk Assessment**: **MEDIUM** (Logic nghiệp vụ và giao diện đạt chất lượng cao, nhưng có 02 khiếm khuyết kỹ thuật cần khắc phục trước khi nghiệm thu hoàn tất).

---

## 1. Observation (Quan sát Thực nghiệm & Bằng chứng Trực tiếp)

### 1.1. Thực thi Kịch bản Kiểm thử Tự động

1. **Test Suite Yêu cầu 3**: `tests/test_r3_visual_multi_resolution.spec.mjs`
   - Lệnh thực thi: `npx playwright test tests/test_r3_visual_multi_resolution.spec.mjs`
   - Kết quả: **6 passed (100% PASS)** trong 20.8 giây.
   - Bố cục & Bẫy tràn ngang:
     * Desktop 1920x1080: `window=1920px, docScrollW=1920px, sectionScrollW=1216px` -> `hasPageOverflow = false`.
     * Laptop 1366x768: `window=1366px, docScrollW=1366px, sectionScrollW=1216px` -> `hasPageOverflow = false`.
   - Độ tương phản WCAG: Tên giáo viên (`.teacher-name.font-bold.text-slate-900`) trên nền trắng đạt **17.85:1**, vượt chuẩn WCAG AAA ($\ge 7:1$).
   - Ảnh chụp minh chứng đã tạo và lưu tại:
     * `tests/screenshots/r2_teacher_management/Desktop_1920x1080_teacher_management_table.png` (214,700 bytes)
     * `tests/screenshots/r2_teacher_management/Laptop_1366x768_teacher_management_table.png` (147,767 bytes)
   - Lỗi Console F12: 0 runtime error, 0 unhandled promise rejection.

2. **Test Suite Kiểm thử Bàn làm việc Admin Đa thiết bị**: `tests/test_cross_device_ui_ux_audit.spec.mjs -g "Bàn làm việc Admin"`
   - Lệnh thực thi: `npx playwright test tests/test_cross_device_ui_ux_audit.spec.mjs -g "Bàn làm việc Admin"`
   - Kết quả: **4 passed (100% PASS)** trong 24.5 giây trên cả 4 độ phân giải:
     * Desktop 1920x1080: `docScrollW=1920px === clientW=1920px` (PASS).
     * Laptop 1366x768: `docScrollW=1366px === clientW=1366px` (PASS).
     * Tablet 768x1024: `docScrollW=768px === clientW=768px` (PASS).
     * Mobile 390x844: `docScrollW=390px === clientW=390px` (PASS).

3. **Test Suite Thu hồi Quyền Con dấu**: `tests/08_revoke_seal_permission.spec.mjs`
   - Lệnh thực thi: `npx playwright test tests/08_revoke_seal_permission.spec.mjs`
   - Kết quả: **3 passed (100% PASS)** trong 21.0 giây.

4. **Test Suite Phân quyền Con dấu Nhà trường**: `tests/07_school_seal_delegation.spec.mjs`
   - Lệnh thực thi: `npx playwright test tests/07_school_seal_delegation.spec.mjs`
   - Kết quả: **4 passed, 1 failed (FAIL tại Kịch bản 2)**:
     ```
     1) [chromium] › tests\07_school_seal_delegation.spec.mjs:91:3 › 7. Phân quyền và Ký số USB Token Con dấu nhà trường › Kịch bản 2: Bật Ủy quyền Đóng dấu -> Quét thành công & Hiển thị Badge Đóng dấu OK
        Error: expect(locator).toContainText(expected) failed
        Locator: locator('tr').filter({ hasText: 'Ngô Thị Liền' }).last()
        Timeout: 5000ms
        - Expected substring: "Đóng dấu OK"
        + Received string: "N Ngô Thị Liền 8229 @cva.bgh_8229 ... USB Token Word OK Hoạt động"
     ```
   - Kịch bản 1 (Quét token khi chưa ủy quyền -> Chặn gán nhầm): **PASSED**.
   - Kịch bản 3 (Giáo viên được ủy quyền mở PDF -> Thấy nút Đóng Dấu Nhà Trường): **PASSED**.
   - Kịch bản 4 (Giáo viên không được ủy quyền -> Nút bị ẩn): **PASSED**.
   - Kịch bản 5 (Modal quản lý chữ ký): **PASSED**.

### 1.2. Thẩm định Giao diện & Mã Nguồn Trực tiếp

1. **Cụm Thanh công cụ (Toolbar)** (`index.html:284-314`):
   - Nút "Đồng bộ Google Sheet" (`#btnSyncSheetAll`): Dạng viền emerald mềm mại (`border border-emerald-300/90 bg-white hover:bg-emerald-50/80 text-emerald-800`), có chấm xanh nhấp nháy động (`animate-ping` + `bg-emerald-500`), huy hiệu `Live` rõ ràng, chiều cao `min-h-[38px]`.
   - Nút "Thêm Giáo viên" (`.btn-create-user`): Nổi bật thương hiệu (`bg-brand-600 hover:bg-brand-700 text-white shadow-sm`), chiều cao `min-h-[38px]`.
   - Bố cục dàn ngang chuẩn mực (`flex items-center gap-2 sm:gap-2.5 shrink-0 justify-end`), không còn bị vỡ hàng dọc.
   - Ẩn nút đồng bộ trên tab khác (`js/app.js:670-725`): Hàm `switchTab(tabName)` ẩn `#btnSyncSheetAll` khi sang tab `departments` hoặc `reports`, chỉ hiển thị tại tab `teachers`.

2. **Cột Giáo viên / Tài khoản (Phân tầng Thị giác 3 cấp)** (`js/app.js:895-917`):
   - Cấp 1: Avatar chữ cái đầu dạng hình tròn (`rounded-full w-9 h-9`) phối màu pastel tất định từ bảng `TEACHER_AVATAR_PALETTES` (8 bảng màu) + Họ tên in đậm to rõ nét (`.teacher-name.font-bold.text-slate-900.text-sm`).
   - Cấp 2: Tên đăng nhập định dạng monospace `@username`, kèm email công vụ và số CCCD nếu có.
   - Cấp 3: Cụm thẻ Smart Zalo Capsule (`js/app.js:874-885`): Đóng gói gọn gàng `[ 📱 0818810007 • PIN: 0007 ]` với icon, tự động bù số 0 nếu dữ liệu thô bị thiếu, tích hợp nút 1-click copy gọi `copyTeacherZaloQuick()` sao chép cú pháp `LK <phone> <pin>` kèm thông báo toast và fallback `prompt`.

3. **Cột Loại chữ ký & Quyền hạn (2-Tier Badges)** (`js/app.js:814-841`):
   - Tier 1: Badge phương thức ký (`USB Token` hoặc `VGCA SmartCA`).
   - Tier 2: Quyền gửi Word (`Word OK` hoặc `Chặn Word`) + Quyền con dấu nhà trường.
   - **Bảo toàn chuỗi ký tự bất biến**: Văn bản `'Đóng dấu OK'` được giữ nguyên vẹn 100% tại dòng 838 (`js/app.js`). Đối với tài khoản `ADMIN`, badge con dấu được ẩn theo đúng nghiệp vụ.

4. **Cột Thao tác (Action Button Bar & Kích thước Vùng chạm)** (`js/app.js:942-973`):
   - Container hợp nhất: Khung bo góc `rounded-xl border border-slate-200/80 bg-slate-50 divide-x divide-slate-200/70 overflow-hidden`.
   - Hiệu ứng phản hồi khi rê chuột (Hover micro-interactions): Khóa (amber-50/emerald-50), Sửa (brand-50), Đổi mật khẩu (indigo-50), Xóa (rose-50).
   - **Kích thước nút bấm**: Toàn bộ 4 nút (`Lock`, `Edit`, `ResetPass`, `Delete`) sử dụng class `w-8 h-8` (tương đương $32 \times 32\text{px}$).

5. **Đồng bộ Tuyệt đối 3 Phiên bản Mirror**:
   - `index.html`, `public/index.html`, `docs/index.html`: SHA256 = `7597257ECBB3D3E8525DF54654E5B16F7A538001D35789CF4DE9E085AD0D2ECF` (Khớp 100%).
   - `js/app.js`, `public/js/app.js`, `docs/js/app.js`: SHA256 = `501D47BE28AC9F6B6D29077B100386FA24D084F7A016655E067CD377021A5FDA` (Khớp 100%).

---

## 2. Findings & Adversarial Challenges

### 🔴 [Major Finding 1]: Kích thước Nút Thao tác Bảng Giáo viên Chưa Đạt Chuẩn Công Thái Học $\ge 36\text{px}$
- **Vị trí**: `js/app.js` (dòng 946, 955, 961, 968), `public/js/app.js`, `docs/js/app.js`.
- **Thực trạng**: Các nút thao tác trong thanh tác vụ đang dùng kích thước `w-8 h-8` ($32 \times 32\text{px}$).
- **Vấn đề**:
  * Yêu cầu trong đề bài: *"Review Action Button Bar: unified container, hover states, touch targets >= 36px."*
  * Yêu cầu trong `PROPOSED_PATCHES.md` (dòng 137): *"Phóng to nút thao tác bảng biểu (min-w-[36px] min-h-[36px])"*.
  * Trong tệp test `tests/test_r3_visual_multi_resolution.spec.mjs`, dòng 18 có ghi chú yêu cầu `Touch targets >= 36px for table actions`, nhưng tại dòng 177-178 mã test lại hạ ngưỡng kiểm tra xuống `toBeGreaterThanOrEqual(32)`.
- **Ảnh hưởng**: Trên các máy tính cảm ứng hoặc Laptop giáo viên màn hình độ phân giải cao, nút $32\text{px}$ hơi nhỏ, dễ bấm trượt giữa các nút liền kề trong thanh công cụ hợp nhất.
- **Đề xuất khắc phục**:
  * Nâng cấp class các nút từ `w-8 h-8` thành `w-9 h-9 min-w-[36px] min-h-[36px]` (hoặc `p-2`) trong `js/app.js`, `public/js/app.js`, `docs/js/app.js`.
  * Cập nhật assertion trong `tests/test_r3_visual_multi_resolution.spec.mjs` tại dòng 177-178 thành `toBeGreaterThanOrEqual(36)`.

---

### 🔴 [Major Finding 2]: Lỗi Ô nhiễm Dữ liệu Test Giữa Test 08 và Test 07 Làm Hỏng Kịch bản 2 của Test 07
- **Vị trí**: `tests/07_school_seal_delegation.spec.mjs` (dòng 143-145).
- **Thực trạng**:
  * Khi chạy `07_school_seal_delegation.spec.mjs`, Kịch bản 2 bị thất bại do `locator('tr').filter({ hasText: 'Ngô Thị Liền' }).last()` không tìm thấy text `'Đóng dấu OK'`.
- **Nguyên nhân gốc rễ (Root Cause Analysis)**:
  1. Trong `tests/08_revoke_seal_permission.spec.mjs`, test tạo ra các tài khoản giả lập có tên `Ngô Thị Liền ${uniqueSuffix}` (ví dụ: `Ngô Thị Liền 8229`, `Ngô Thị Liền 9310`) và sau đó **thu hồi quyền đóng dấu** của tài khoản này.
  2. Các tài khoản này được lưu vĩnh viễn trên Firebase RTDB mà **không có bước cleanup/teardown dọn dẹp**.
  3. Trong `tests/07_school_seal_delegation.spec.mjs`, Kịch bản 2 tạo tài khoản được ủy quyền với `testUsername = 'cva.ntlien_seal'` và tên `Ngô Thị Liền`.
  4. Sau khi lưu, test 07 kiểm tra bảng bằng bộ định vị:
     `const row = page.locator('tr', { hasText: 'Ngô Thị Liền' }).last();`
  5. Vì các tài khoản rác bị thu hồi quyền từ test 08 (`Ngô Thị Liền 8229`) nằm ở vị trí sau trong danh sách Firebase RTDB, `.last()` đã vô tình trúng vào tài khoản bị thu hồi quyền thay vì tài khoản `cva.ntlien_seal` vừa tạo.
  6. Thực tế đối soát DOM cho thấy tài khoản `cva.ntlien_seal` **có đầy đủ badge `'Đóng dấu OK'`**, chứng minh logic nghiệp vụ của sản phẩm hoạt động đúng, nhưng kịch bản kiểm thử bị lỗi phụ thuộc thứ tự chạy (Order-dependent Test Fragility).
- **Đề xuất khắc phục**:
  * Tại `tests/07_school_seal_delegation.spec.mjs:143`, sửa bộ định vị trỏ chính xác vào tài khoản vừa tạo theo `testUsername`:
    ```javascript
    const row = page.locator('tr', { hasText: testUsername }).first();
    await expect(row).toBeVisible();
    await expect(row).toContainText('Đóng dấu OK');
    ```
  * Hoặc bổ sung bước xóa các tài khoản tạm có tiền tố `cva.bgh_` sau khi `08_revoke_seal_permission.spec.mjs` chạy xong.

---

## 3. Logic Chain (Chuỗi Lập Luận Kỹ Thuật)

1. **Về Thanh công cụ & Bố cục Bảng**:
   - `index.html` và `js/app.js` đã thực hiện đúng hoàn toàn thiết kế Hình 3: Nút Đồng bộ viền emerald tinh tế kèm live pulse dot, nút Thêm Giáo viên dạng brand fill nổi bật, thanh công cụ căn chỉnh nằm ngang liền mạch với tab bar.
   - Cơ chế ẩn/hiện nút đồng bộ trong `switchTab()` vận hành chuẩn xác: chỉ hiện khi xem tab `teachers`, ẩn hoàn toàn khi xem các tab khác.

2. **Về Phân tầng Thị giác 3 Cấp**:
   - Cấp 1 (Avatar tròn pastel + Tên đậm): Đạt độ tương phản 17.85:1, vượt trội chuẩn WCAG AAA (7.0:1).
   - Cấp 2 (@username + email + CCCD): Phân định rõ ràng, không gây rối mắt.
   - Cấp 3 (Smart Zalo Capsule Card): Đóng gói gọn gàng `[ 📱 SĐT • PIN: xxxx ]`, tự bù số 0, tích hợp 1-click copy với toast thông báo và prompt fallback.

3. **Về Tính Bất biến của Kịch bản Kiểm thử**:
   - Chuỗi ký tự `'Đóng dấu OK'` được giữ nguyên vẹn 100% trong `js/app.js:838`.
   - Không gây phá vỡ logic phân quyền đóng dấu mộc đỏ trường học.

4. **Về Tính Đồng bộ**:
   - 3 phiên bản mirror (`/`, `public/`, `docs/`) có mã băm SHA256 khớp nhau 100%.

5. **Về Lý do Ra Phán quyết REQUEST_CHANGES**:
   - Theo nguyên tắc Zero-Bug và kiểm thử độc lập, không được phê duyệt khi một kịch bản test được chỉ định trong yêu cầu (`07_school_seal_delegation.spec.mjs`) đang có trạng thái FAILED.
   - Đồng thời kích thước điểm chạm $32\text{px}$ của các nút thao tác chưa thỏa mãn yêu cầu $\ge 36\text{px}$ đã đề ra trong nhiệm vụ.

---

## 4. Caveats (Điểm Lưu ý)

- **Mock USB Token**: Trong quá trình chạy Playwright, cổng phần cứng `18888` được mock qua route handler để tránh phụ thuộc vào USB vật lý cắm trên máy chủ.
- **Không có Caveat về Dữ liệu**: Firebase RTDB và DataStore hoạt động bình thường, dữ liệu người dùng không bị mất mát.

---

## 5. Conclusion (Kết luận Nghiệm thu)

1. **Chất lượng Tổng thể**: Đạt 90% khối lượng yêu cầu với giao diện đẹp mắt, phân tầng thị giác chuyên nghiệp, bẫy tràn ngang được triệt tiêu 100% trên mọi độ phân giải.
2. **Yêu cầu Điều chỉnh (Action Items for Worker Agent)**:
   - **Sửa Touch Target Action Buttons**: Đổi `w-8 h-8` thành `w-9 h-9 min-w-[36px] min-h-[36px]` tại `js/app.js`, `public/js/app.js`, `docs/js/app.js`.
   - **Sửa Test Assertion**: Đổi ngưỡng kiểm tra touch target trong `tests/test_r3_visual_multi_resolution.spec.mjs` thành `toBeGreaterThanOrEqual(36)`.
   - **Sửa Selector Test 07**: Cập nhật selector dòng 143 trong `tests/07_school_seal_delegation.spec.mjs` sang `page.locator('tr', { hasText: testUsername }).first()` để triệt tiêu lỗi va chạm dữ liệu test cũ.
   - **Đồng bộ Mirror**: Đảm bảo 3 thư mục gốc, `public/` và `docs/` tiếp tục có SHA256 trùng khớp 100%.

---

## 6. Verification Method (Phương Pháp Tự Kiểm Chứng Độc Lập)

Sau khi Worker Agent áp dụng các điều chỉnh trên, chạy lại chuỗi lệnh sau để nghiệm thu:

```powershell
# 1. Chạy bài test giao diện đa độ phân giải (Kỳ vọng: 6/6 PASS với touch targets >= 36px)
npx playwright test tests/test_r3_visual_multi_resolution.spec.mjs

# 2. Chạy bài test kiểm toán Admin đa thiết bị (Kỳ vọng: 4/4 PASS)
npx playwright test tests/test_cross_device_ui_ux_audit.spec.mjs -g "Bàn làm việc Admin"

# 3. Chạy test phân quyền con dấu nhà trường (Kỳ vọng: 5/5 PASS, Kịch bản 2 không còn bị lệch selector)
npx playwright test tests/07_school_seal_delegation.spec.mjs

# 4. Chạy test thu hồi quyền con dấu nhà trường (Kỳ vọng: 3/3 PASS)
npx playwright test tests/08_revoke_seal_permission.spec.mjs

# 5. Kiểm tra đối soát băm SHA256 của 3 mirror
powershell -Command "Get-FileHash index.html, public\index.html, docs\index.html, js\app.js, public\js\app.js, docs\js\app.js | Format-Table -AutoSize"
```
