# BRIEFING — 2026-09-15T04:45:00Z

## Mission
Investigate Requirement 2: Comprehensive Ergonomic and Aesthetic Redesign of the Teacher Management view (Danh sách Giáo viên / Hình 3).

## 🔒 My Identity
- Archetype: explorer
- Roles: investigation, synthesis
- Working directory: c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\explorer_r2_teacher_ui
- Original parent: 65d755a6-92c4-481d-b1c4-1cc3d4836253
- Milestone: Requirement 2: Teacher Management UI/UX Redesign

## 🔒 Key Constraints
- Read-only investigation — do NOT implement directly in project source code
- Zero-guesswork & strict verification of paths, lines, and classes
- Ergonomic and aesthetic redesign adhering to taste skill and web design guidelines
- Ensure 0 horizontal overflow traps (scrollWidth === clientWidth) at 1920x1080 and 1366x768, and WCAG AA/AAA contrast ratios

## Current Parent
- Conversation ID: 65d755a6-92c4-481d-b1c4-1cc3d4836253
- Updated: 2026-09-15T04:45:00Z

## Investigation State
- **Explored paths**:
  - `index.html`, `public/index.html`, `docs/index.html` (lines 265-348)
  - `js/app.js`, `public/js/app.js`, `docs/js/app.js` (lines 112-167, 651-704, 732-853, 855-873, 8915-8943)
  - `tests/test_cross_device_ui_ux_audit.spec.mjs` (lines 376-440)
  - `tests/verify_fig1_fig2_fig3_fixes.spec.mjs` (lines 22-63, 207-285)
  - `tests/07_school_seal_delegation.spec.mjs` (lines 120-130)
  - `tests/08_revoke_seal_permission.spec.mjs` (lines 65-100)
  - Existing screenshots: `tests/screenshots/03_admin_users_table.png`, `tests/screenshots/cross_device/Desktop_1920x1080_04_admin_teachers.png`, `Laptop_1366x768_04_admin_teachers.png`, `Mobile_390x844_04_admin_teachers.png`
- **Key findings**:
  - Visual clutter in Column 1 (Teacher/Account): flat single-line string mixing phone, PIN, CCCD, email with alarming red warning for missing phone.
  - Avatars are monochrome and identical (`bg-brand-100`).
  - Column 3 (Signature & Permissions) stacks 3 clunky multi-colored rectangular badges, causing vertical bloat.
  - Column 4 (Status) had word wrapping on "Hoạt động" (`Hoạt` / `động`).
  - Column 5 (Actions) has 4 disconnected square boxes lacking visual rhythm.
  - Toolbar `#tabActionContainer` lacked flexbox styling, and `switchTab` omitted visibility handling for `btnSyncSheetAll`.
  - Playwright test `tests/07_school_seal_delegation.spec.mjs` specifically asserts `.toContainText('Đóng dấu OK')`, so the school seal badge must maintain this verbatim text for zero regression.
- **Unexplored areas**: None. All requirements analyzed and verified against empirical test suite.

## Key Decisions Made
- Designed a 3-level visual hierarchy with deterministic pastel avatars, clean metadata line, and self-healing smart Zalo capsule card with 1-click copy button.
- Preserved `.btn-create-user`, `.btn-create-dept`, `#btnSyncSheetAll`, `#tableBodyTeachers`, and text `Đóng dấu OK` for 100% test compatibility.
- Designed integrated Action Button Bar with subtle dividers and micro-interactions.

## Artifact Index
- DISPATCH.md — incoming dispatch instructions
- BRIEFING.md — working memory and situational awareness
- progress.md — liveness heartbeat
- handoff.md — final handoff report
