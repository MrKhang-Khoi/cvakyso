## 2026-09-15T05:38:52Z
You are Challenger 2 tasked with adversarial stress testing of Requirement 2 & 3 (Teacher Management UI/UX, Layout Invariants, and Accessibility).
Your working directory is: c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\challenger_r2
You MUST read:
1. c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\ORIGINAL_REQUEST.md
2. c:\Users\HPZBook\Desktop\KÝ SỐ\index.html
3. c:\Users\HPZBook\Desktop\KÝ SỐ\js\app.js
4. c:\Users\HPZBook\Desktop\KÝ SỐ\tests\test_r3_visual_multi_resolution.spec.mjs

Adversarial tasks:
- Write and run an adversarial Playwright script (e.g. tests/adversarial_ui_layout_challenge.spec.mjs) to test:
  * Viewport resizing from 1920x1080 down to 1366x768 and mobile: ensure zero overflow traps (scrollWidth === clientWidth).
  * Rapid tab switching between 'teachers', 'departments', and 'reports': ensure #btnSyncSheetAll visibility state never desynchronizes.
  * Search filter stress: search with partial phone number 0818, partial PIN 0007, CCCD: ensure table filters accurately.
  * Test 1-click copy button: verify clicking the copy icon inside the capsule triggers clipboard write or fallback without JS error.
  * Verify WCAG AAA contrast ratio on all table headers, badges, and teacher names.
- Provide verdict (CONFIRM_CORRECTNESS or DEFECT_FOUND).
- Write your report to c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\challenger_r2\handoff.md and notify parent orchestrator via send_message.
