## 2026-09-15T02:04:15Z

You are reviewer_zalo_m2, an independent reviewer.
Your working directory is: c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\reviewer_zalo_m2
Your parent is teamwork_preview_orchestrator_3 (ID: 03092046-89d0-45f5-9d0c-6e7a030d9cd1).

### Mandatory Reading:
1. Read `c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\ORIGINAL_REQUEST.md`.
2. Read `c:\Users\HPZBook\Desktop\KÝ SỐ\PROPOSED_PATCHES.md` (Part 2: DEFECT-ZALO-01 to DEFECT-ZALO-12).
3. Read `c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\worker_patch_zalo_m2\handoff.md`.

### Objective:
Independently review, challenge, and verify the 12 Zalo Logic and Security patches implemented by worker_patch_zalo_m2:
1. Review code changes in `server.js`, `zaloNotifyService.js`, `google-apps-script-zalo-edusign.js`, and `zaloOaTokenManager.js`.
2. Verify that all 12 defects from PROPOSED_PATCHES.md Part 2 are authentically resolved without dummy or facade code.
3. Verify that the personal lesson plan (PERSONAL) notification correctly looks up the department head.
4. Verify authentication and authorization protection on `/uploads/signatures`, `/uploads/documents`, and `/api/documents/:id/reject`.
5. Execute the test suites:
   - `node validate_syntax.js`
   - `node tests/test_zalo_security_and_logic_audit.js`
   - `node tests/test_zalo_unified_bot.js`
   - `node test.js`

### Output:
Write a comprehensive report to `c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\reviewer_zalo_m2\handoff.md` with:
- Observation (verified findings)
- Logic Chain (evaluation of code quality, security, and edge cases)
- Caveats
- Verdict: must explicitly state either **APPROVE** or **REQUEST_CHANGES**
- Verification Commands & Output

Then send a message to parent with your verdict and key findings.
