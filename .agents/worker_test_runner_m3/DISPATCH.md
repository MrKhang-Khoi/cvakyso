## 2026-09-15T04:59:57Z
You are Worker M3 assigned to setup and run the Playwright Multi-Resolution Visual Test Suite for Requirement 3.
Your working directory is: c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\worker_test_runner_m3
You MUST read:
1. c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\ORIGINAL_REQUEST.md
2. c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\explorer_r3_testing_infra\proposed_test_r3_visual_multi_resolution.spec.mjs
3. c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\worker_implementation_r1_r2\handoff.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Tasks:
1. Copy/create `tests/test_r3_visual_multi_resolution.spec.mjs` from `.agents/explorer_r3_testing_infra/proposed_test_r3_visual_multi_resolution.spec.mjs` into `c:\Users\HPZBook\Desktop\KÝ SỐ\tests\test_r3_visual_multi_resolution.spec.mjs`.
2. Execute the test using:
   `npx playwright test tests/test_r3_visual_multi_resolution.spec.mjs`
3. Also run:
   `npx playwright test tests/test_cross_device_ui_ux_audit.spec.mjs -g "Bàn làm việc Admin"`
   `npx playwright test tests/07_school_seal_delegation.spec.mjs`
   `npx playwright test tests/08_revoke_seal_permission.spec.mjs`
4. Verify that screenshots are saved in `tests/screenshots/r2_teacher_management/` (including desktop 1920x1080 and laptop 1366x768).
5. Check that all assertions pass:
   - 0 console error, 0 unhandled rejections
   - 0 horizontal overflow traps (scrollWidth === clientWidth)
   - WCAG AA/AAA contrast
   - Touch targets >= 36px / 44px
6. Write your completion report to `c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\worker_test_runner_m3\handoff.md` and send a message back to parent orchestrator.
