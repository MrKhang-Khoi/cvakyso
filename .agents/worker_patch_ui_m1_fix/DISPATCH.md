## 2026-09-15T02:26:37Z
You are worker_patch_ui_m1_fix, a UI remediation specialist.
Your working directory is: c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\worker_patch_ui_m1_fix
Your parent is teamwork_preview_orchestrator_3 (ID: 03092046-89d0-45f5-9d0c-6e7a030d9cd1).

### Mandatory Reading:
1. Read `c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\ORIGINAL_REQUEST.md`.
2. Read `c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\reviewer_ui_m1\handoff.md`.
3. Read the code-quality skill at `C:\Users\HPZBook\.gemini\config\skills\code-quality\SKILL.md`.

### Critical Remediation Task (Fix DEF-03):
Reviewer `reviewer_ui_m1` identified that the seal fine-tune and scale adjustment buttons in `index.html` (lines ~1271-1308) currently use:
`class="w-9 h-9 sm:w-8 sm:h-8 ..."` which renders as 36px on mobile and 32px on desktop.
This violates the mandatory requirement: **>= 44px** (User Global Rule 3: `kích thước điểm chạm >= 44px` and WCAG AAA touch targets).

### Required Actions:
1. In `index.html`:
   Update all scale and nudge buttons (lines ~1271-1308) for seal fine-tuning:
   - `adjustSignatureScale(-0.1)`
   - `adjustSignatureScale(0.1)`
   - `nudgeSignature(-1, 0)`
   - `nudgeSignature(1, 0)`
   - `nudgeSignature(0, -1)`
   - `nudgeSignature(0, 1)`
   and any adjacent reset/action buttons in that toolbar.
   Change classes from `w-9 h-9 sm:w-8 sm:h-8` to `min-w-[44px] min-h-[44px] w-11 h-11 p-2` to strictly guarantee rendered bounding box >= 44px on ALL screen sizes (mobile 390px, tablet, desktop).
2. Synchronize the changes with exact 100% SHA-256 parity to:
   - `public/index.html`
   - `docs/index.html`
3. In `tests/test_cross_device_ui_ux_audit.spec.mjs` (around line 304):
   Update the test assertion from `toBeLessThan(44)` (which was the old bug demonstration assertion) to `toBeGreaterThanOrEqual(44)` to strictly guard and enforce the >= 44px standard on touch devices.
4. Execute verification commands:
   - `node validate_syntax.js`
   - `npx playwright test tests/test_cross_device_ui_ux_audit.spec.mjs`
   Confirm that all 20/20 tests pass with the new `>= 44px` guard in place.
