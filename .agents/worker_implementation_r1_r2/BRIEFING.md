# BRIEFING — 2026-09-15T12:00:00Z

## Mission
Lead Fullstack Implementation Worker: Execute Milestone M1 (Fixing leading zero loss for Phone & PIN across GAS, backend, frontend) and Milestone M2 (Teacher Management UI/UX Redesign - Hình 3) with zero bugs and full test integrity.

## 🔒 My Identity
- Archetype: worker
- Roles: implementer, qa, specialist
- Working directory: c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\worker_implementation_r1_r2
- Original parent: 65d755a6-92c4-481d-b1c4-1cc3d4836253
- Milestone: M1 & M2

## 🔒 Key Constraints
- EXCLUSIVE write ownership:
  * google-apps-script-zalo-edusign.js
  * server.js
  * dataStore.js
  * index.html, public/index.html, docs/index.html
  * js/app.js, public/js/app.js, docs/js/app.js
  * tests/test_r1_phone_pin_integrity.js
- Keep all 3 mirrors (root, public/, docs/) strictly synchronized.
- Integrity mandate: No hardcoding test results, no dummy facade implementations.
- Independent verification will be run by teamwork_preview_auditor.

## Current Parent
- Conversation ID: 65d755a6-92c4-481d-b1c4-1cc3d4836253
- Updated: 2026-09-15T12:00:00Z

## Task Summary
- **What to build**: Fullstack fix for Phone & PIN leading zeroes (GAS, backend, frontend) + Teacher Management UI/UX redesign according to Hình 3 specifications.
- **Success criteria**: 
  1. Phone & PIN leading zeroes preserved across Google Sheets, GAS webhook, server.js, dataStore.js, and frontend.
  2. Teacher UI redesign matching Hình 3: smart Zalo capsule, 1-click copy, pastel avatar, 2-tier signature badges, responsive toolbar, filtered search by phone/pin.
  3. All tests pass: test_r1_phone_pin_integrity.js, test_zalo_unified_bot.js, test_zalo_security_and_logic_audit.js.
  4. 0 syntax errors, 3 mirrors synchronized.

## Change Tracker
- **Files modified**:
  * `google-apps-script-zalo-edusign.js`: Formatted sheet cols as text (@), forced "'" prefix on sync, added padStart(4, '0') and auto-repair writeback.
  * `server.js`: Exposed pinCode in GET /api/admin/users, handled pinCode in POST /api/admin/users.
  * `dataStore.js`: Initialized pinCode '0001' for default users, sanitized pinCode with padStart(4, '0') in createUser/updateUser.
  * `index.html`, `public/index.html`, `docs/index.html`: Responsive toolbar with live pulsing sync button, clean modern table headers.
  * `js/app.js`, `public/js/app.js`, `docs/js/app.js`: 3-level visual hierarchy in renderTeachersTable, avatar pastel palettes, smart Zalo capsule with 1-click copy, preserved 'Đóng dấu OK', search filter by phone/pin/cccd.
  * `tests/test_r1_phone_pin_integrity.js`: 10 comprehensive tests for phone/PIN data preservation.
- **Build status**: PASS (All suites 100% green)
- **Pending issues**: None

## Quality Status
- **Build/test result**:
  * `tests/test_r1_phone_pin_integrity.js`: 10/10 PASS
  * `tests/test_zalo_unified_bot.js`: 26/26 PASS
  * `tests/test_zalo_security_and_logic_audit.js`: 12/12 PASS
  * `tests/test_zalo_morning_schedule_m3.js`: 17/17 PASS
  * Playwright `tests/test_user_profile_pin.spec.mjs`: 1/1 PASS
  * Playwright `tests/01_auth_roles.spec.mjs`: 2/2 PASS
  * Playwright `tests/03_admin_management.spec.mjs`: 1/1 PASS
  * Playwright `tests/test_cross_device_ui_ux_audit.spec.mjs -g "Bàn làm việc Admin"`: 4/4 PASS (0 overflow)
- **Lint status**: Clean (0 syntax errors across all JS files)
- **Tests added/modified**: `tests/test_r1_phone_pin_integrity.js`

## Loaded Skills
- **Source**: C:\Users\HPZBook\.gemini\config\skills\code-quality\SKILL.md
  - **Local copy**: C:\Users\HPZBook\Desktop\KÝ SỐ\.agents\worker_implementation_r1_r2\skills\code-quality.md
  - **Core methodology**: Strict verification, data integrity, error handling, anti-guessing.
- **Source**: C:\Users\HPZBook\.gemini\config\skills\zero-bug-verification\SKILL.md
  - **Local copy**: C:\Users\HPZBook\Desktop\KÝ SỐ\.agents\worker_implementation_r1_r2\skills\zero-bug-verification.md
  - **Core methodology**: Multi-layer verification, dual-context checks, invariant testing.

## Artifact Index
- DISPATCH.md — Assignment from orchestrator
- BRIEFING.md — Situational awareness
- progress.md — Liveness heartbeat & step-by-step progress
- handoff.md — Final 5-component handoff report
