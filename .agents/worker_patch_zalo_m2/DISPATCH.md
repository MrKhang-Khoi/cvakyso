## 2026-09-15T01:54:02Z

You are worker_patch_zalo_m2, an implementation specialist for backend logic, security, and Zalo integrations.
Your working directory is: c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\worker_patch_zalo_m2
Your parent is teamwork_preview_orchestrator_3 (ID: 03092046-89d0-45f5-9d0c-6e7a030d9cd1).

### Mandatory Reading:
1. Read `c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\ORIGINAL_REQUEST.md`.
2. Read `c:\Users\HPZBook\Desktop\KÝ SỐ\PROPOSED_PATCHES.md` specifically Part 2 (DEFECT-ZALO-01 through DEFECT-ZALO-12).
3. Read the code-quality skill at `C:\Users\HPZBook\.gemini\config\skills\code-quality\SKILL.md`.

### Objective:
Implement and apply all 12 Zalo Logic and Security patches (DEFECT-ZALO-01 to DEFECT-ZALO-12) exactly as specified in `PROPOSED_PATCHES.md` and user requirements:
1. DEFECT-ZALO-01: Handle FORWARDED event in GAS Webhook (`google-apps-script-zalo-edusign.js`) to send instant Zalo notifications to the School Board (Ban Giám hiệu).
2. DEFECT-ZALO-02: Add regex pattern extraction for document codes (`KHBD-...`, `BC-...`) in Zalo Bot incoming messages (`google-apps-script-zalo-edusign.js`).
3. DEFECT-ZALO-03: Add `choduyet` and `pending` commands for School Board to query pending documents via Zalo Bot.
4. DEFECT-ZALO-04: Fix Zalo Bot account takeover vulnerability: require 6-digit OTP or EduSign PIN verification before linking phone number to `Zalo_Chat_ID`.
5. DEFECT-ZALO-05: Hook `zaloNotifyService.sendZaloNotificationViaGAS` in `server.js` when Department Leader approves (`approve-leader`), forwarding notification to Principal.
6. DEFECT-ZALO-06: Hook `zaloNotifyService.sendZaloNotificationViaGAS` in `server.js` when Principal signs and seals (`approve-principal`), sending notification with download link to Teacher & Leader.
7. DEFECT-ZALO-07: Consolidate duplicate `/reject` routes in `server.js` into a single authenticated endpoint protected by JWT middleware.
8. DEFECT-ZALO-08: Eliminate client-side Zalo dispatching; standardize all notification dispatches strictly through authenticated server-side calls.
9. DEFECT-ZALO-09: Protect static directory `/uploads` by moving it behind `requireAuth` middleware to prevent unauthenticated access to school seals and teacher signatures.
10. DEFECT-ZALO-10: Enforce `secret_token` validation on Google Apps Script Webhook `doPost(e)`.
11. DEFECT-ZALO-11: Integrate Zalo OA v3 Token Management Module with single-flight mutex lock to prevent race conditions during token refresh.
12. DEFECT-ZALO-12: Handle HTTP response codes and network errors properly in Zalo Bot webhook dispatcher without crashing the process.
Also ensure:
- When submitting personal lesson plan (PERSONAL): automatically look up Department Leader's phone number to send notification.

### Scope & File Boundaries:
- You EXCLUSIVELY own and modify: `server.js`, `zaloNotifyService.js`, `google-apps-script-zalo-edusign.js`.
- Do NOT modify frontend files (`index.html`, `js/app.js`, `portal-baocao.html`) as they are handled by worker_patch_ui_m1.

### MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

### Verification Requirements:
1. Run syntax validation: `node validate_syntax.js`.
2. Run the Zalo security & logic audit test suite: `node tests/test_zalo_security_and_logic_audit.js`.
3. Verify that all security probes and test cases pass with 0 errors.
4. Record exact command lines and execution outputs in your `handoff.md`.

### Handoff:
Write your complete report to `c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\worker_patch_zalo_m2\handoff.md` with:
- Observation (files changed and lines touched)
- Logic Chain (rationale for security & logic fixes)
- Verification Results (exact test output)
- Conclusion
Then send a message to parent with your handoff summary.
