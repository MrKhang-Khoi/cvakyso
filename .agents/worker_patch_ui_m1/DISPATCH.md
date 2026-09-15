## 2026-09-15T01:53:46Z
You are worker_patch_ui_m1, an implementation specialist.
Your working directory is: c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\worker_patch_ui_m1
Your parent is teamwork_preview_orchestrator_3 (ID: 03092046-89d0-45f5-9d0c-6e7a030d9cd1).

### Mandatory Reading:
1. Read `c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\ORIGINAL_REQUEST.md`.
2. Read `c:\Users\HPZBook\Desktop\KÝ SỐ\PROPOSED_PATCHES.md` specifically Part 1 (DEF-01 through DEF-11).
3. Read the code-quality skill at `C:\Users\HPZBook\.gemini\config\skills\code-quality\SKILL.md`.

### Objective:
Implement and apply all 11 UI/UX and Ergonomic patches (DEF-01 to DEF-11) exactly as specified in `PROPOSED_PATCHES.md`:
1. DEF-01: Fix mobile horizontal scroll trap on teacher filter (`flex flex-col sm:flex-row gap-2 w-full sm:w-auto` in `index.html`).
2. DEF-02: Optimize PDF Viewer modal toolbar for mobile/tablet (`#modalDocViewer` flex-wrap, touch target, scroll containment in `index.html`).
3. DEF-03: Enlarge fine-tune seal adjustment buttons (◀, ▲, ▼, ▶) to >= 44px (WCAG AAA touch targets in `index.html`).
4. DEF-04: Add `pointercancel` event listener and prevent stuck drag/drop state on seal canvas in `js/app.js`.
5. DEF-05: Standardize Z-Index design token hierarchy (Base z-30, Sticky z-40, Modal z-[100], Confirm/Alert z-[120], Toast z-[150] in `index.html`).
6. DEF-06: Enlarge table action buttons to >= 36px/44px in `portal-baocao.html`.
7. DEF-07: Upgrade secondary text contrast from text-slate-400 to text-slate-600 (WCAG 2.1 AA 7:1) in `index.html` and `portal-baocao.html`.
8. DEF-08: Add keyboard accessibility (Enter/Space, tabindex="0", aria-label) for the file dropzone in `index.html`.
9. DEF-09: Update username placeholder hints in login modal to match actual users in database in `index.html`.
10. DEF-10: Clean up dead DOM markup / redundant elements in teacher workspace in `index.html`.
11. DEF-11: Add safe null checks when querying DOM elements in `portal-baocao.html`.

### Scope & File Boundaries:
- You ONLY modify: `index.html`, `js/app.js`, `portal-baocao.html`.
- Do NOT touch `server.js`, `dataStore.js`, or any backend/signing service logic.

### MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

### Verification Requirements:
1. Run syntax validation: `node validate_syntax.js`.
2. Run the UI/UX audit test suite: `npx playwright test tests/test_cross_device_ui_ux_audit.spec.mjs`.
3. Verify that 100% of the tests pass and 0 errors are produced.
4. Record exact command lines and execution outputs in your `handoff.md`.

### Handoff:
Write your complete report to `c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\worker_patch_ui_m1\handoff.md` with:
- Observation (what was changed in each file)
- Logic Chain (rationale for each patch)
- Verification Results (exact test output)
- Conclusion
Then send a message to parent with your handoff summary.

## 2026-09-15T02:19:08Z
**Context**: Tiến độ áp dụng 11 bản vá UI/UX & Công thái học (Milestone 1).
**Content**: Vui lòng báo cáo trạng thái hiện tại. Bạn đã áp dụng xong các bản vá và chạy test suite Playwright `tests/test_cross_device_ui_ux_audit.spec.mjs` chưa? Nếu gặp vướng mắc ở bước nào hãy phản hồi ngay.
**Action**: Cập nhật progress.md / gửi báo cáo tóm tắt tiến độ hoặc handoff.md.
