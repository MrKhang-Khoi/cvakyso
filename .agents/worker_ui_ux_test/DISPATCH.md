## 2026-09-15T00:30:42Z
You are the UI/UX Test Implementation & Verification Worker (worker_ui_ux_test).
Your working directory is: c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\worker_ui_ux_test
Project root is: c:\Users\HPZBook\Desktop\KÝ SỐ
Authoritative user request is in: c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\ORIGINAL_REQUEST.md (under section ## 2026-09-15T00:16:04Z).

## 🔒 MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## 🔒 Strict Constraints:
- TUYỆT ĐỐI KHÔNG TỰ Ý CHỈNH SỬA các file mã nguồn chính (server.js, dataStore.js, zaloNotifyService.js, index.html, portal-baocao.html) khi chưa có sự phê duyệt trực tiếp của người dùng.
- Independent test scripts MUST be placed in the `tests/` directory.

## Core Assignment:
1. Read the reports and blueprints:
   - `c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\explorer_ui_ux\ui_ux_audit_report.md`
   - `c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\explorer_ui_ux\handoff.md`
   - `c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\explorer_test_infra\test_infra_audit_report.md`
2. Implement an automated Playwright test suite in `tests/test_cross_device_ui_ux_audit.spec.mjs`:
   - Cover 4 Viewports: Desktop 1920x1080, Laptop 1366x768, Tablet 768x1024, Mobile 390x844.
   - Cover all required views & modals: `#viewLogin`, `#modalVgcaLogin`, `#modalAdminAuth`, Teacher Workspace, Tổ trưởng & BGH Workspaces (ký nháy, ký số VGCA, mộc đỏ `school_seal.png`, reject dialog), PDF Viewer (`#modalDocViewer`, `#draggableSignatureStamp`), Public Portal `portal-baocao.html`.
   - Empirically verify & assert:
     * Horizontal overflow trap on Mobile 390x844 in `#tabContentTeachers` filter bar (`scrollWidth > clientWidth`).
     * Sub-44px touch targets on nudge buttons, zoom controls, and table inline actions.
     * WCAG AA contrast violations on `text-slate-400` (#94a3b8) and disabled buttons.
     * Zero unexpected JavaScript F12 console errors (filtering expected mock connection errors).
   - Save visual evidence screenshots into `tests/screenshots/`.
3. Run the Playwright test suite:
   - Execute `npx playwright test tests/test_cross_device_ui_ux_audit.spec.mjs` (ensure server is running or route mocking is configured).
   - Document pass/fail assertion results and empirical metrics.
4. Deliverables:
   - File created: `c:\Users\HPZBook\Desktop\KÝ SỐ\tests\test_cross_device_ui_ux_audit.spec.mjs`
   - Write comprehensive handoff report to:
     `c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\worker_ui_ux_test\handoff.md`
   - Update `progress.md` with timestamps. When done, send a message to parent.

## 2026-09-15T00:40:12Z
**Context**: Status check on `tests/test_cross_device_ui_ux_audit.spec.mjs`.
**Content**: Checking your progress on creating and executing the Playwright test suite.
**Action**: Please provide a brief status update on your current step.
