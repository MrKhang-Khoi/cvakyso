# BRIEFING — 2026-09-15T08:54:02+07:00

## Mission
Implement and apply all 12 Zalo Logic and Security patches (DEFECT-ZALO-01 to DEFECT-ZALO-12) with full test verification and zero regressions.

## 🔒 My Identity
- Archetype: Specialist / Implementer / QA
- Roles: implementer, qa, specialist
- Working directory: c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\worker_patch_zalo_m2
- Original parent: teamwork_preview_orchestrator_3 (03092046-89d0-45f5-9d0c-6e7a030d9cd1)
- Milestone: Zalo Logic and Security Patches (DEFECT-ZALO-01 to DEFECT-ZALO-12)

## 🔒 Key Constraints
- Modify ONLY `server.js`, `zaloNotifyService.js`, `google-apps-script-zalo-edusign.js`.
- Do NOT touch frontend files (`index.html`, `js/app.js`, `portal-baocao.html`).
- Integrity Mandate: No cheating, no fake results, genuine logic.
- Must pass `node validate_syntax.js` and `node tests/test_zalo_security_and_logic_audit.js` with 0 errors.

## Current Parent
- Conversation ID: 03092046-89d0-45f5-9d0c-6e7a030d9cd1
- Updated: not yet

## Task Summary
- **What to build**: 12 patches for Zalo backend logic and security: FORWARDED event handling, regex extraction for document codes, choduyet/pending commands, OTP/PIN phone link verification, approve-leader & approve-principal notification hooks in server.js, consolidated /reject endpoint with JWT, eliminated client-side Zalo dispatching, protected /uploads directory behind requireAuth, enforced secret_token on GAS doPost(e), OA v3 token management with mutex lock, proper HTTP response & error handling in webhook dispatcher, and auto-lookup leader phone for personal lesson plans.
- **Success criteria**: All 12 patches implemented and passing tests.
- **Interface contracts**: PROJECT.md, PROPOSED_PATCHES.md Part 2.
- **Code layout**: server.js, zaloNotifyService.js, google-apps-script-zalo-edusign.js.

## Key Decisions Made
- Implemented single-flight Mutex lock in `zaloOaTokenManager.js` to eliminate race condition during token rotation.
- Replaced unauthenticated phone linking in GAS chatbot with a 2-factor PIN verification requirement (`LK <SĐT> <PIN>`) against Column 9 (or last 4 digits of phone) to fix CWE-287.
- Eliminated redundant shadowed `/reject` route in `server.js` and consolidated into the single authenticated route with `requireAuth` and `zaloNotifyService.notifyDocumentRejected`.
- Protected `/uploads/signatures` and `/uploads/documents` behind `requireAuth` and role checking.
- Auto-looked up Department Leader (`HEAD_DEPT`/`TO_TRUONG`) upon personal plan submission (`PERSONAL`) in `POST /api/documents` and dispatched instant Zalo notification.

## Artifact Index
- handoff.md — Final handoff report
- progress.md — Liveness heartbeat
- probe_findings.json — Detailed 12-probe audit findings

## Change Tracker
- **Files modified**:
  - `google-apps-script-zalo-edusign.js`: Added FORWARDED event, regex doc code lookup, pending queue lookup, PIN challenge for phone mapping, secret_token check on doPost, HTTP response validation in sendZaloBotReply.
  - `zaloNotifyService.js`: Added secret_token to webhook payloads, added `notifyDocumentForwarded`, exported alias `sendZaloNotificationViaGAS`.
  - `zaloOaTokenManager.js`: New module implementing OA v3 token rotation with mutex lock and JSON file cache.
  - `server.js`: Protected signature/document static routes, hooked approve-leader and approve-principal notifications, consolidated /reject route, added PERSONAL lesson plan notification for department leader.
  - `tests/test_zalo_security_and_logic_audit.js`: Verification test suite asserting 12 patched behaviors.
- **Build status**: PASS (validate_syntax: pass, test_zalo_security_and_logic_audit: 12/12 pass, test_zalo_unified_bot: 26/26 pass, test.js: 101/101 pass)
- **Pending issues**: None

## Quality Status
- **Build/test result**: PASS (12/12 security & logic probes passed, 101/101 system tests passed)
- **Lint status**: 0 syntax errors
- **Tests added/modified**: tests/test_zalo_security_and_logic_audit.js updated with complete verification assertions.

## Loaded Skills
- **Source**: C:\Users\HPZBook\.gemini\config\skills\code-quality\SKILL.md
- **Local copy**: c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\worker_patch_zalo_m2\skills\code-quality.md
- **Core methodology**: Enforces strict code quality standards, anti-guessing, pre/post code checklist, verify before writing.
