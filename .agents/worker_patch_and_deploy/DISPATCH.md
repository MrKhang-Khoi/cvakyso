# DISPATCH: worker_patch_and_deploy

## Mission
Triển khai bộ bản vá toàn diện giải quyết triệt để 5 vấn đề do Hội đồng Thẩm định (Reviewer 2, Challenger 1, Challenger 2) phát hiện, cập nhật tài liệu hướng dẫn và thực hiện git commit & push.

## Specific Task Instructions

### 1. Google Apps Script Edge-Case Fixes (`google-apps-script-zalo-edusign.js`):
- **Fix 1.1 (Chống falsy 0 cho PIN 0000)** tại dòng 1536:
  Thay thế:
  ```javascript
  storedPin = String(data[i][8] || "").replace(/^'+/, "").trim();
  ```
  Bằng:
  ```javascript
  var rawPinVal = data[i][8];
  storedPin = (rawPinVal !== undefined && rawPinVal !== null) ? String(rawPinVal).replace(/^'+/, "").trim() : "";
  ```
- **Fix 1.2 (Mở rộng Regex Webhook Zalo)** tại dòng 557 và dòng 566:
  Tại dòng 557, thay thế:
  ```javascript
  var linkPattern = text.match(/^(LK|LIENKET)\s+([0-9]{9,11})\s+([0-9A-Za-z]{1,8})$/i);
  ```
  Bằng:
  ```javascript
  var linkPattern = text.match(/^(LK|LIENKET)\s+([\+0-9\s\-\.\(\)]{9,25})\s+([0-9A-Za-z]{1,8})$/i);
  ```
  Tại dòng 566, cho phép độ dài chuỗi số lên đến 12 chữ số (để xử lý đầu số quốc tế dạng `840...`):
  ```javascript
  var rawDigits = text.replace(/[^0-9]/g, "");
  if (rawDigits.length >= 9 && rawDigits.length <= 12 && !clean.startsWith("tkb") && !clean.startsWith("lop")) {
  ```
- **Fix 1.3 (Bảo vệ tuyệt đối mã PIN tùy chỉnh & chống rò rỉ)** tại dòng 1558-1563:
  Thay thế:
  ```javascript
  var phone4 = normPhone.length >= 4 ? normPhone.slice(-4) : "1234";
  var validPin = storedPin || phone4;
  if (pinClean !== validPin && pinClean !== phone4) {
    return "❌ Mã PIN bảo mật không chính xác!\n\n💡 Thầy/Cô chỉ cần nhắn cú pháp kèm 4 số cuối SĐT (" + phone4 + "):\n👉 LK " + phoneInput + " " + phone4;
  }
  ```
  Bằng:
  ```javascript
  var phone4 = normPhone.length >= 4 ? normPhone.slice(-4) : "1234";
  var validPin = storedPin || phone4;
  if (pinClean !== validPin) {
    if (storedPin) {
      return "❌ Mã PIN bảo mật không chính xác!\n\n💡 Tài khoản của Thầy/Cô đã được cài đặt Mã PIN bảo mật riêng. Vui lòng kiểm tra lại tại website EduSign hoặc liên hệ Quản trị viên.";
    } else {
      return "❌ Mã PIN bảo mật không chính xác!\n\n💡 Thầy/Cô chỉ cần nhắn cú pháp kèm 4 số cuối SĐT (" + phone4 + "):\n👉 LK " + phoneInput + " " + phone4;
    }
  }
  ```

### 2. Frontend Touch Target & Contrast Enhancements (`index.html`, `js/app.js` và 3 mirrors):
- **Fix 2.1 (Tăng kích thước touch target lên >= 36px)** trong `js/app.js` (và `public/js/app.js`, `docs/js/app.js`):
  Tại các nút Khóa, Sửa, Đổi mật khẩu, Xóa (khoảng dòng 946, 955, 961, 968):
  Thay thế class `w-8 h-8` bằng `w-9 h-9 min-w-[36px] min-h-[36px] flex items-center justify-center` để đảm bảo vùng chạm thực tế $\ge 36\text{px}$.
- **Fix 2.2 (Chuẩn hóa độ tương phản WCAG AAA cho badge Chưa liên kết SĐT)** tại dòng 887:
  Thay thế:
  ```html
  <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200/70 mt-0.5">
  ```
  Bằng:
  ```html
  <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-300/80 mt-0.5">
  ```
- **Đảm bảo 100% SHA256 Match giữa 3 Mirror**:
  Sao chép đồng bộ:
  `js/app.js` -> `public/js/app.js` và `docs/js/app.js`.
  `index.html` -> `public/index.html` và `docs/index.html`.

### 3. Test Suites Adjustment & Execution:
- **Fix 3.1 (Touch Target Assertion)** trong `tests/test_r3_visual_multi_resolution.spec.mjs:177-178`:
  Đổi:
  ```javascript
  expect(btnBox.width).toBeGreaterThanOrEqual(32);
  expect(btnBox.height).toBeGreaterThanOrEqual(32);
  ```
  Thành:
  ```javascript
  expect(btnBox.width).toBeGreaterThanOrEqual(36);
  expect(btnBox.height).toBeGreaterThanOrEqual(36);
  ```
- **Fix 3.2 (Test 07 Selector Fragility)** trong `tests/07_school_seal_delegation.spec.mjs:143`:
  Thay thế:
  ```javascript
  const row = page.locator('tr', { hasText: 'Ngô Thị Liền' }).last();
  ```
  Bằng:
  ```javascript
  const row = page.locator('tr', { hasText: testUsername }).first();
  ```
- **Chạy toàn bộ các bài test để kiểm chứng 100% PASS**:
  1. `node tests/test_verify_patches.js` -> 100% PASS
  2. `node tests/stress_test_r1_phone_pin.js` -> 39/39 PASS (100%)
  3. `node tests/test_r1_phone_pin_integrity.js` -> 10/10 PASS
  4. `node tests/test_zalo_unified_bot.js` -> 26/26 PASS
  5. `node tests/test_zalo_security_and_logic_audit.js` -> 12/12 PASS
  6. `npx playwright test tests/test_r3_visual_multi_resolution.spec.mjs` -> 6/6 PASS
  7. `npx playwright test tests/adversarial_ui_layout_challenge.spec.mjs` -> 5/5 PASS
  8. `npx playwright test tests/07_school_seal_delegation.spec.mjs` -> 5/5 PASS
  9. `npx playwright test tests/08_revoke_seal_permission.spec.mjs` -> 3/3 PASS
  10. `npx playwright test tests/test_cross_device_ui_ux_audit.spec.mjs -g "Bàn làm việc Admin"` -> 4/4 PASS

### 4. Cập nhật Tài liệu Hướng dẫn:
- Cập nhật `HUONG_DAN_CAP_NHAT_CODE_GS.md` phản ánh đầy đủ phiên bản Google Apps Script mới nhất (các cải tiến định dạng Text chuỗi số 0, phòng thủ PIN 0000, regex nhận dạng quốc tế, bảo mật mã PIN riêng).

### 5. Git Commit & Push:
- Chạy:
  `git add .`
  `git commit -m "feat(edusign): hoàn tất R1 bảo toàn số 0 SĐT/PIN, R2 tái thiết kế UI Quản trị Giáo viên công thái học, R3 kiểm thử Playwright đa độ phân giải"`
  `git push origin main`
- Ghi lại log chi tiết vào handoff report.

## 2026-09-15T05:49:21Z
You are the Lead Patch Implementation & Deployment Worker assigned to execute the final unified patch set addressing all defects from Challenger 1, Challenger 2, and Reviewer 2, verify 100% test pass, update documentation, and perform git push origin main.

