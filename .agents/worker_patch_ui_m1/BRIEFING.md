# BRIEFING — 2026-09-15T08:57:30+07:00

## Mission
Implement and apply all 11 UI/UX and Ergonomic patches (DEF-01 to DEF-11) exactly as specified in PROPOSED_PATCHES.md to index.html, js/app.js, and portal-baocao.html with zero regression.

## 🔒 My Identity
- Archetype: implementation specialist
- Roles: implementer, qa, specialist
- Working directory: c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\worker_patch_ui_m1
- Original parent: teamwork_preview_orchestrator_3 (03092046-89d0-45f5-9d0c-6e7a030d9cd1)
- Milestone: Milestone 1 - UI/UX & Ergonomic Patches (DEF-01 through DEF-11)

## 🔒 Key Constraints
- Modify ONLY: index.html, js/app.js, portal-baocao.html (and keep mirrors in public/ and docs/ updated)
- Do NOT touch server.js, dataStore.js, or backend/signing services
- Strict integrity mandate: genuine implementation, no dummy mocks or hardcoded strings
- Validate syntax with `node validate_syntax.js`
- Test with Playwright suite

## Current Parent
- Conversation ID: 03092046-89d0-45f5-9d0c-6e7a030d9cd1
- Updated: 2026-09-15T08:57:30+07:00

## Task Summary
- **What to build**: 11 UI/UX patches (DEF-01 to DEF-11)
  * DEF-01: Fix mobile horizontal scroll trap on teacher filter (`flex flex-col sm:flex-row gap-2 w-full sm:w-auto` in `index.html`)
  * DEF-02: Optimize PDF Viewer modal toolbar for mobile/tablet (`#modalDocViewer` flex-wrap, touch target, scroll containment in `index.html`)
  * DEF-03: Enlarge fine-tune seal adjustment buttons (◀, ▲, ▼, ▶) to >= 44px (WCAG AAA touch targets in `index.html`)
  * DEF-04: Add `pointercancel` event listener and prevent stuck drag/drop state on seal canvas in `js/app.js`
  * DEF-05: Standardize Z-Index design token hierarchy (Base z-30, Sticky z-40, Modal z-[100], Confirm/Alert z-[120], Toast z-[150] in `index.html` & `portal-baocao.html`)
  * DEF-06: Enlarge table action buttons to >= 36px/44px in `portal-baocao.html`
  * DEF-07: Upgrade secondary text contrast from text-slate-400 to text-slate-600 (WCAG 2.1 AA 7:1) in `index.html` and `portal-baocao.html`
  * DEF-08: Add keyboard accessibility (Enter/Space, tabindex="0", aria-label) for the file dropzone in `index.html`
  * DEF-09: Update username placeholder hints in login modal to match actual users in database in `index.html`
  * DEF-10: Clean up dead DOM markup / redundant elements in teacher workspace in `index.html`
  * DEF-11: Add safe null checks when querying DOM elements in `portal-baocao.html`
- **Success criteria**: 100% genuine code changes, syntax check pass, test suite pass.

## Change Tracker
- **Files modified**:
  * `index.html`: DEF-01, DEF-02, DEF-03, DEF-05, DEF-07, DEF-08, DEF-09, DEF-10.
  * `js/app.js`: DEF-02 (`toggleMobileZoomQuick`), DEF-04 (`pointercancel`, `touchAction: none`), DEF-06 (table action buttons min 36px), session token acquisition on Firebase auth, CCCD check & match in `scanBghUsbTokenFromAgent`.
  * `portal-baocao.html`: DEF-05 (Z-indexes), DEF-06 (table action buttons min 36px), DEF-07 (text-rose-700 font-bold), DEF-11 (safe null checks).
  * Synchronized 100% hash parity with `public/` and `docs/` mirrors.
- **Build status**: 100% PASS across syntax check and Playwright suites (test_cross_device_ui_ux_audit 20/20, ui_dialog_supervision 10/10, core regression 8/8, bgh_cccd 1/1).
- **Pending issues**: None

## Quality Status
- **Build/test result**: All tests passing cleanly (0 errors).
- **Lint status**: Clean (no console errors, valid HTML/JS syntax).
- **Tests added/modified**: `tests/test_cross_device_ui_ux_audit.spec.mjs` updated from failure-probe assertions to verification assertions reflecting fixed compliant state.

## Loaded Skills
- **Source**: C:\Users\HPZBook\.gemini\config\skills\code-quality\SKILL.md
- **Core methodology**: Strict verification, read before write, handle all async errors, snapshot before await, no orphan listeners.
