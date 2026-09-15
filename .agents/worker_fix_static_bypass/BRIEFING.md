# BRIEFING — 2026-09-15T09:52:15+07:00

## Mission
Remediate the critical static uploads RBAC bypass in `server.js` and remove residual leaked signature/seal files in `public/uploads`.

## 🔒 My Identity
- Archetype: worker_fix_static_bypass
- Roles: implementer, qa, specialist
- Working directory: c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\worker_fix_static_bypass
- Original parent: 03092046-89d0-45f5-9d0c-6e7a030d9cd1
- Milestone: Security Remediation (Static Uploads RBAC Bypass)

## 🔒 Key Constraints
- Mount protected routes (`/uploads/signatures`, `/uploads/documents`) BEFORE `app.use(express.static('public'))`.
- Strict RBAC check in `/uploads/signatures`:
  * Unauthenticated -> 401
  * Regular teacher requesting school_seal.png or other teacher's signature -> 403
  * ADMIN, BGH, or owner requesting own signature -> 200
- Remove residual sensitive files in `public/uploads/`
- Zero regression on existing tests.
- DO NOT CHEAT, no hardcoded values or dummy fixes.

## Current Parent
- Conversation ID: 03092046-89d0-45f5-9d0c-6e7a030d9cd1
- Updated: 2026-09-15T09:52:15+07:00

## Task Summary
- **What to build**: Secure `/uploads/signatures` and `/uploads/documents` middleware routing order and RBAC logic in `server.js`, clean up `public/uploads` residuals.
- **Success criteria**: Verification probes pass (401, 403, 200), regression tests pass 100%.
- **Code layout**: `server.js`, `public/uploads/`

## Key Decisions Made
- Reordered Express middleware in `server.js`: `/uploads/signatures` and `/uploads/documents` mounted before `express.static('public')`.
- Purged all PNG files from `public/uploads/signatures/` (`school_seal.png`, `sig_user_48965ee0.png`, `sig_user_cvaty.png`), keeping only `.gitkeep`.
- Updated `test.js` to assert the new authenticated security model (401 unauthenticated, 403 regular teacher, 200 admin).
- Created automated probe test `tests/verify_static_uploads_remediation.mjs` against real running server.

## Artifact Index
- `server.js` — Middleware reordering to prevent static bypass.
- `public/uploads/signatures/` — Residual sensitive files purged.
- `test.js` — Enhanced with 401 unauth / 403 teacher / 200 admin test assertions.
- `tests/verify_static_uploads_remediation.mjs` — Standalone probe verification.
- `handoff.md` — Final handoff report.

## Loaded Skills
- Source: C:\Users\HPZBook\.gemini\config\skills\code-quality\SKILL.md
- Local copy: .agents/worker_fix_static_bypass/code-quality-SKILL.md
- Core methodology: Zero-guesswork, strict verification, error handling, data integrity.

## Change Tracker
- **Files modified**: `server.js`, `public/uploads/signatures/*.png` (removed), `test.js`
- **Build status**: PASS (103/103 tests, 14/14 adversarial probes, 12/12 Zalo security probes, syntax OK)
- **Pending issues**: None

## Quality Status
- **Build/test result**: PASS (All suites 100% PASS)
- **Lint status**: Clean (Syntax check 100% OK)
- **Tests added/modified**: `test.js` updated for RBAC probes; `tests/verify_static_uploads_remediation.mjs` added
