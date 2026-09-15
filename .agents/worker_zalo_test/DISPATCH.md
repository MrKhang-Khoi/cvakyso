## 2026-09-15T00:30:42Z

You are the Zalo Security & Logic Test Implementation Worker (worker_zalo_test).
Your working directory is: c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\worker_zalo_test
Project root is: c:\Users\HPZBook\Desktop\KÝ SỐ
Authoritative user request is in: c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\ORIGINAL_REQUEST.md (under section ## 2026-09-15T00:16:04Z).

## 🔒 MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## 🔒 Strict Constraints:
- TUYỆT ĐỐI KHÔNG TỰ Ý CHỈNH SỬA các file mã nguồn chính (server.js, dataStore.js, zaloNotifyService.js, index.html) khi chưa có sự phê duyệt trực tiếp của người dùng.
- Independent test scripts MUST be placed in the `tests/` directory.

## Core Assignment:
1. Read the reports and probe scripts:
   - `c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\explorer_zalo\zalo_logic_audit_report.md`
   - `c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\explorer_zalo\handoff.md`
   - `c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\explorer_zalo\test_zalo_logic_audit.js`
   - `c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\explorer_test_infra\test_infra_audit_report.md`
2. Implement a standalone Node.js automated test script in `tests/test_zalo_security_and_logic_audit.js`:
   - Ensure it can run independently with `node tests/test_zalo_security_and_logic_audit.js`.
   - Implement empirical probes and assertions covering all confirmed defects:
     * Probe 1: Silent drop of `FORWARDED` events in GAS handler (`INVALID_EVENT`).
     * Probe 2: Missing doc ID command parser (`KHBD-...`, `BC-...`).
     * Probe 3: Missing pending documents lookup (`choduyet`, `pending`).
     * Probe 4: Account takeover via unauthenticated phone mapping (`handlePhoneMapping`).
     * Probe 5: Omission of Zalo notification when Tổ trưởng approves (`approve-leader` in `server.js`).
     * Probe 6: Omission of Zalo notification when BGH signs & seals (`approve-principal` in `server.js`).
     * Probe 7: Duplicate route conflict shadowing `/api/documents/:id/reject` in `server.js` (line 836 vs line 3418).
     * Probe 8: Dual-dispatch message duplication between client `app.js` and server `server.js`.
     * Probe 9: Public static `/uploads` exposing official school seal (`school_seal.png`) and teacher signatures (`sig_*.png`).
     * Probe 10: Missing `secret_token` validation on `doPost(e)` allowing unauthenticated `CLEAR_ALL_REPORTS`.
     * Probe 11 & 12: Absence of Zalo OA v3 OAuth 2.0 PKCE refresh token architecture & unhandled HTTP errors.
3. Run and verify the test script:
   - Execute `node tests/test_zalo_security_and_logic_audit.js`.
   - Confirm all probe tests pass or report defects with structured assertion output.
4. Deliverables:
   - File created: `c:\Users\HPZBook\Desktop\KÝ SỐ\tests\test_zalo_security_and_logic_audit.js`
   - Write comprehensive handoff report to:
     `c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\worker_zalo_test\handoff.md`
   - Update `progress.md` with timestamps. When done, send a message to parent.
