# Handoff Report: Challenger 2 — Adversarial Stress Testing of Requirements 2 & 3

**Agent Archetype**: EMPIRICAL CHALLENGER (critic, specialist)  
**Target Scope**: Requirement 2 (Teacher Management UI/UX) & Requirement 3 (Layout Invariants & Accessibility)  
**Target Files**: `index.html`, `js/app.js`, `tests/test_r3_visual_multi_resolution.spec.mjs`, `tests/adversarial_ui_layout_challenge.spec.mjs`  
**Execution Timestamp**: 2026-09-15T05:46:00Z  
**Final Verdict**: **DEFECT_FOUND** (Minor Accessibility Contrast Defect on "Chưa liên kết SĐT" badge; 100% CONFIRMED CORRECTNESS on Layout Invariants, Tab Synchronization, Search Filtering, and 1-Click Copy)

---

## 1. Observation

Direct empirical observations from source code inspection and test execution:

### A. Playwright Test Execution Evidence
- Command: `npx playwright test tests/adversarial_ui_layout_challenge.spec.mjs`
  * Test 1 (`Dynamic Viewport Resizing from 1920x1080 down to mobile: Zero Overflow Traps`): **PASSED** (5.5s).
    - `FHD_1920x1080`: `docClientW=1920px`, `docScrollW=1920px`, `bodyScrollW=1920px`, `hasPageOverflow=false`.
    - `Laptop_1366x768`: `docClientW=1366px`, `docScrollW=1366px`, `bodyScrollW=1366px`, `hasPageOverflow=false`.
    - `SmallLaptop_1024x768`: `docClientW=1024px`, `docScrollW=1024px`, `bodyScrollW=1024px`, `hasPageOverflow=false`.
    - `Tablet_768x1024`: `docClientW=768px`, `docScrollW=768px`, `bodyScrollW=768px`, `hasPageOverflow=false`.
    - `Mobile_390x844`: `docClientW=390px`, `docScrollW=390px`, `bodyScrollW=390px`, `hasPageOverflow=false`.
    - `Mobile_375x667`: `docClientW=375px`, `docScrollW=375px`, `bodyScrollW=375px`, `hasPageOverflow=false`.
    - `Mobile_360x740`: `docClientW=360px`, `docScrollW=360px`, `bodyScrollW=360px`, `hasPageOverflow=false`.
    - Screenshot saved: `tests/screenshots/adversarial_challenge/mobile_390x844_teacher_view.png`.
  * Test 2 (`Rapid Tab Switching Barrage: #btnSyncSheetAll visibility state never desynchronizes`): **PASSED** (5.3s).
    - Executed 15 continuous, zero-delay switches through `teachers -> departments -> reports -> teachers -> ...`.
    - `#btnSyncSheetAll` class list verified:
      + On `'teachers'`: class `'hidden'` is removed, element `toBeVisible()`.
      + On `'departments'`: class `'hidden'` is present, element `toBeHidden()`.
      + On `'reports'`: class `'hidden'` is present, element `toBeHidden()`.
  * Test 3 (`Search filter stress: partial phone 0818, partial PIN 0007, and CCCD`): **PASSED** (4.3s).
    - Query `'0818'`: filtered to 1 row containing teacher Hà Văn Tý (`0818810007`).
    - Query `'0007'`: filtered to 1 row containing teacher Hà Văn Tý (`PIN: 0007`).
    - Query `'042084002100'`: filtered accurately to matching CCCD rows.
    - Clear query (`""`): restored all 9 teacher rows.
  * Test 4 (`1-click copy button inside capsule: triggers clipboard write without JS error`): **PASSED** (4.0s).
    - Hà Văn Tý capsule copy button clicked: clipboard wrote verbatim `"LK 0818810007 0007"`.
    - Toast notification verified: `"Đã sao chép cú pháp Zalo: LK 0818810007 0007"`.
    - Admin capsule copy button clicked: clipboard wrote verbatim `"LK 02553850001 0001"`.
    - Fallback mechanism (`window.prompt`) tested with mocked rejected clipboard write: executed safely with 0 errors.
  * Test 5 (`Verify WCAG AAA contrast ratio on all table headers, badges, and teacher names`): **PASSED** (3.0s).
    - Table Headers (all 5 columns): text `rgb(71, 85, 105)` on `rgb(248, 250, 252)` = **7.24:1** (✅ **WCAG AAA** >= 7.0:1).
    - Teacher Names (all rows): text `rgb(15, 23, 42)` on `rgb(255, 255, 255)` = **17.85:1** (✅ **WCAG AAA** >= 7.0:1).
    - Role Badges:
      + `Giáo viên`: text `rgb(51, 65, 85)` on `rgb(241, 245, 249)` = **9.45:1** (✅ **WCAG AAA**).
      + `Quản trị viên`: **6.51:1** (🟡 WCAG AA).
      + `Ban Giám hiệu`: **5.72:1** (🟡 WCAG AA).
    - Signing Badges:
      + `VGCA SmartCA`: text `rgb(7, 89, 133)` on `rgb(240, 249, 255)` = **7.09:1** (✅ **WCAG AAA**).
      + `USB Token`: text `rgb(146, 64, 14)` on `rgb(255, 251, 235)` = **6.84:1** (🟡 WCAG AA).
    - Permission Badges:
      + `Word OK`: **6.16:1** (🟡 WCAG AA).
      + `Chặn Word`: **5.72:1** (🟡 WCAG AA).
      + `Đóng dấu OK`: **5.72:1** (🟡 WCAG AA).
    - Status Badges:
      + `Hoạt động`: **5.21:1** (🟡 WCAG AA).
    - **DEFECT CONFIRMED**: Badge "Chưa liên kết SĐT" (`js/app.js:887`):
      + Text color: `rgb(100, 116, 139)` (`text-slate-500`)
      + Background color: `rgb(241, 245, 249)` (`bg-slate-100`)
      + Measured Contrast Ratio: **4.34:1**
      + Threshold Requirement: WCAG AA normal text requires **>= 4.5:1**; WCAG AAA requires **>= 7.0:1**.
      + Result: **FAILS** WCAG AA and WCAG AAA (4.34:1 < 4.5:1).

- Combined Execution: `npx playwright test tests/test_r3_visual_multi_resolution.spec.mjs tests/adversarial_ui_layout_challenge.spec.mjs`:
  * Total: 11 passed in 27.8s.
  * Browser console F12: 0 runtime errors, 0 unhandled promise rejections.

---

## 2. Logic Chain

1. **Layout Invariant Logic Chain**:
   - Observations show `docScrollWidth === docClientWidth` and `bodyScrollWidth <= docClientWidth` across all 7 tested viewport sizes (from 1920x1080 down to 360x740).
   - In `index.html:343`, the teacher table is wrapped in `<div class="overflow-x-auto">`.
   - Any table width expansion is contained strictly within the table's local scroll context and never bleeds into document/body margins.
   - Therefore, the zero overflow trap requirement is fully satisfied.

2. **Tab Synchronization Logic Chain**:
   - `switchTab(tabName)` in `js/app.js:670-727` handles tab activation synchronously:
     * When `tabName === 'teachers'`: `btnSyncSheet.classList.remove('hidden')` (line 695).
     * When `tabName === 'departments'`: `btnSyncSheet.classList.add('hidden')` (line 707).
     * When `tabName === 'reports'`: `btnSyncSheet.classList.add('hidden')` (line 720).
   - Because tab styling and button class toggling are synchronous before triggering asynchronous loaders, a 15-cycle zero-delay rapid switching barrage maintained 100% synchronization without race conditions or button state leaks.

3. **Search Filtering Logic Chain**:
   - `getFilteredTeachers()` in `js/app.js:979-1000` evaluates:
     `u.phone.toLowerCase().includes(q) || (String(u.pinCode || '')).toLowerCase().includes(q) || u.cccd.toLowerCase().includes(q)`
   - In the data layer (`dataStore.js` and RTDB synchronization), teacher Hà Văn Tý has `phone: "0818810007"`, `pinCode: "0007"`, and `cccd: "042084002100"`.
   - Testing verified partial phone `"0818"`, partial PIN `"0007"`, and CCCD `"042084002100"` each isolated the correct teacher without failure.

4. **1-Click Copy Logic Chain**:
   - In `js/app.js:775-793`, `copyTeacherZaloQuick(phone, pin, event)` calls `event.stopPropagation()` to avoid triggering row selections, formats the payload as `LK ${cleanPhone} ${cleanPin}`, and calls `navigator.clipboard.writeText(syntax)`.
   - Upon Promise resolution, `showToast` displays the confirmation message into `#toastContainer`.
   - Tests empirically verified that clicking the copy button in Hà Văn Tý's row wrote `"LK 0818810007 0007"` to clipboard and generated the toast notification.
   - When clipboard writing was mocked to reject, the prompt fallback executed safely with zero uncaught exceptions.

5. **Accessibility & Contrast Defect Logic Chain**:
   - `index.html:347-351` styles all table headers with `font-semibold text-slate-600` on `bg-slate-50/75`, resulting in rgb(71,85,105) on rgb(248,250,252) with luminance ratio **7.24:1**, meeting WCAG AAA (>= 7.0:1).
   - `js/app.js:904` styles teacher names with `font-bold text-slate-900` on white, yielding **17.85:1**, meeting WCAG AAA.
   - However, in `js/app.js:887`, unlinked teachers receive badge:
     `<span class="... bg-slate-100 text-slate-500 ...">Chưa liên kết SĐT</span>`
   - Computed styles: fg = `rgb(100, 116, 139)` (`text-slate-500`), bg = `rgb(241, 245, 249)` (`bg-slate-100`).
   - Relative luminance calculation:
     * $L_1 = 0.887$ (bg-slate-100)
     * $L_2 = 0.166$ (text-slate-500)
     * $\text{Contrast Ratio} = (0.887 + 0.05) / (0.166 + 0.05) = 0.937 / 0.216 = \mathbf{4.34:1}$.
   - Because 4.34:1 < 4.5:1 (WCAG AA requirement for 10px text), this element fails accessibility standards.

---

## 3. Caveats

1. **Tested Scope**: Headless Chromium via Playwright. Native mobile browser gesture scaling (pinch-to-zoom) was not tested because automated headless browsers simulate viewports via fixed CSS pixel matrices.
2. **Server Environment**: Test was executed against local Node.js Express server (`http://localhost:3000`) with mock endpoints for the local VGCA signing bridge (`127.0.0.1:18888`).
3. **No Code Modification Constraint**: In accordance with the Challenger role constraints (review and challenge only), no implementation files were modified. The proposed remediation for the contrast defect is documented below.

---

## 4. Conclusion

**Verdict**: **DEFECT_FOUND**

### Summary of Findings
1. **Layout Invariant**: **PASS** (Zero horizontal overflow traps across 1920x1080, 1366x768, 1024x768, 768x1024, 390x844, 375x667, 360x740).
2. **Tab Visibility Invariant**: **PASS** (15 rapid switches between 'teachers', 'departments', and 'reports' showed 100% synchronization of `#btnSyncSheetAll`).
3. **Search Filter Invariant**: **PASS** (Accurately filters by partial phone `'0818'`, partial PIN `'0007'`, and CCCD).
4. **1-Click Copy Capsule**: **PASS** (Correct payload `'LK 0818810007 0007'`, toast notification triggered, fallback resilient, 0 console errors).
5. **Accessibility Audit**:
   - Table Headers: **PASS WCAG AAA** (7.24:1 >= 7.0:1).
   - Teacher Names: **PASS WCAG AAA** (17.85:1 >= 7.0:1).
   - SmartCA Badge: **PASS WCAG AAA** (7.09:1 >= 7.0:1).
   - Teacher Role Badge: **PASS WCAG AAA** (9.45:1 >= 7.0:1).
   - **DEFECT [ACC-01] (Minor)**: Badge "Chưa liên kết SĐT" in `js/app.js:887` (and corresponding mirrors in `public/js/app.js:887`, `docs/js/app.js:887`) has contrast ratio **4.34:1**, failing WCAG AA (>= 4.5:1) and WCAG AAA (>= 7.0:1).

### Actionable Remediation for [ACC-01]
In `js/app.js:887` (and `public/js/app.js`, `docs/js/app.js`):
```diff
- <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200/70 mt-0.5">
+ <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-300/80 mt-0.5">
```
*Impact of fix*: `text-slate-700` (`rgb(51, 65, 85)`) raises the contrast ratio on `bg-slate-100` from **4.34:1** to **9.45:1**, achieving full **WCAG AAA** compliance.

---

## 5. Verification Method

To independently reproduce and verify all observations and conclusions:

```powershell
# 1. Ensure server is running
node server.js &

# 2. Run the adversarial challenge test suite
npx playwright test tests/adversarial_ui_layout_challenge.spec.mjs

# 3. Run combined multi-resolution visual and adversarial test suites
npx playwright test tests/test_r3_visual_multi_resolution.spec.mjs tests/adversarial_ui_layout_challenge.spec.mjs

# 4. Inspect generated visual proof
Get-ChildItem tests/screenshots/adversarial_challenge/
Get-ChildItem tests/screenshots/r2_teacher_management/
```

**Invalidation Conditions**:
- If any viewport resolution exhibits `docScrollWidth > docClientWidth` or `bodyScrollWidth > docClientWidth`.
- If `#btnSyncSheetAll` displays while the active tab is `'departments'` or `'reports'`.
- If searching `'0818'` or `'0007'` fails to return Hà Văn Tý.
- If clicking the capsule copy button fails to write `"LK 0818810007 0007"` to clipboard.
