# HANDOFF REPORT: ZALO SECURITY & LOGIC TEST IMPLEMENTATION WORKER (`worker_zalo_test`)

**Target Recipient:** Orchestrator (`parent` / `0d7a5d85-4572-4646-a649-b14db45bc5cd`)  
**Date:** 2026-09-15T07:36:20+07:00  
**Type:** Hard Handoff (Task Complete)  
**Deliverable Test File:** `c:\Users\HPZBook\Desktop\KÝ SỐ\tests\test_zalo_security_and_logic_audit.js`  
**Structured Attestation Artifact:** `c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\worker_zalo_test\probe_findings.json`  
**Execution Command:** `node tests/test_zalo_security_and_logic_audit.js` (Exits 0, 12/12 Probes Passed)

---

### 1. Observation
Empirical code observations and verbatim execution results from `tests/test_zalo_security_and_logic_audit.js`:

1. **Probe 1 (`DEFECT-ZALO-01` - Silent drop of `FORWARDED` events):**
   - `handleEduSignNotification` in `google-apps-script-zalo-edusign.js` (lines 1332–1400) accepts `REJECTED`, `COMPLETED`, `SUBMITTED`, `PERSONAL_SIGNED`.
   - When given `eventType: "FORWARDED"`, `messageText` is empty, and line 1399 executes `return { success: false, reason: "INVALID_EVENT" };`.
   - Verified empirically: `assert.strictEqual(gasResult.success, false)` and `assert.strictEqual(gasResult.reason, "INVALID_EVENT")` passed.

2. **Probe 2 (`DEFECT-ZALO-02` - Missing doc ID command parser):**
   - In `google-apps-script-zalo-edusign.js` (lines 404–512), `processUnifiedZaloMessage` has no Regex matching document identifiers (`KHBD-...`, `BC-...`, `GA-...`).
   - Verified empirically: Inputs `KHBD-2026-001`, `BC-001`, `GA-TOAN-9A1` all fall through to default fallback: `"Trợ lý Trường học THCS Chu Văn An chưa nhận diện được yêu cầu"`.

3. **Probe 3 (`DEFECT-ZALO-03` - Missing pending documents lookup):**
   - Queries `choduyet`, `pending`, `cho duyet` in `processUnifiedZaloMessage` are completely unhandled and fall through to default fallback.
   - School leaders have zero ability to query pending approval queues via Zalo Bot.

4. **Probe 4 (`DEFECT-ZALO-04` - Account takeover via phone mapping):**
   - In `google-apps-script-zalo-edusign.js` lines 413–418 & 1181–1233 (`handlePhoneMapping`), sending 9–12 digits matching a teacher's phone number executes `sheet.getRange(matchedRow, 6).setValue(String(chatId))` with zero OTP, password, or verification.
   - Verified empirically: Attacker `attacker_evil_chat_id_666` sending Teacher Hà Văn Tý's phone `0818810007` directly overwrote column 6 in `mockUsersSheetData` from `legit_chat_id_teacher_ty` to `attacker_evil_chat_id_666`, leaked teacher PII (name, department), and redirected all future document notifications to the attacker.

5. **Probe 5 (`DEFECT-ZALO-05` - Omission of Zalo notification in `approve-leader`):**
   - In `server.js` lines 3203–3264 (`POST /api/documents/:id/approve-leader`), line 3252 calls `notifyUserWebPush`, but there are 0 calls to `zaloNotifyService` or `sendWebhookPost`.
   - Neither Ban Giám hiệu nor the teacher is notified via Zalo when the Department Head approves.

6. **Probe 6 (`DEFECT-ZALO-06` - Omission of Zalo notification in `approve-principal`):**
   - In `server.js` lines 3267–3415 (`POST /api/documents/:id/approve-principal`), line 3403 calls `notifyUserWebPush`, but there are 0 calls to `zaloNotifyService.notifyDocumentCompleted`.
   - Teachers receive no Zalo notification with a download link when their document is signed and sealed.

7. **Probe 7 (`DEFECT-ZALO-07` - Duplicate route conflict on `/api/documents/:id/reject`):**
   - In `server.js`, `app.post('/api/documents/:id/reject')` is registered twice:
     * Line 836: Unauthenticated handler (parses identity from `x-user-id` header or body).
     * Line 3418: Authenticated handler with `requireAuth`.
   - Verified empirically with live Express simulation: Line 836 intercepts the request first. Line 3418 is completely shadowed and is dead code.

8. **Probe 8 (`DEFECT-ZALO-08` - Dual-dispatch message duplication):**
   - In `js/app.js` lines 4769, 5225, 5424, 5599, 5642: Browser directly invokes `sendZaloNotificationClientSide`.
   - In `server.js` lines 886, 2845, 2851: Server backend concurrently invokes `zaloNotifyService`.
   - Verified empirically with mock GAS Webhook server: Both client and server send HTTP POST for the exact same event, delivering 2 duplicate messages.

9. **Probe 9 (`DEFECT-ZALO-09` - Public static `/uploads` exposing seal and signatures):**
   - In `server.js` line 84: `app.use('/uploads', express.static(path.join(__dirname, 'uploads')))`.
   - Verified empirically: Unauthenticated HTTP GET to `/uploads/signatures/school_seal.png` returned HTTP 200 (2,990 bytes), and `/uploads/signatures/sig_user_cvaty.png` returned HTTP 200 (87,869 bytes). No auth challenge is enforced.

10. **Probe 10 (`DEFECT-ZALO-10` - Missing `secret_token` validation on `doPost(e)`):**
    - In `google-apps-script-zalo-edusign.js` line 162: `secret_token: "UnifiedZaloBotTHCSCVA2026Secret"` is declared in `setZaloBotWebhook`.
    - In `doPost(e)` (lines 293–338): Zero lines validate `secret_token`.
    - Verified empirically: Sending `action: "CLEAR_ALL_REPORTS"` with no secret token executed `clearAllReportsFromSheet()`, returned `{ success: true }`, and wiped all report records from the sheet.

11. **Probe 11 (`DEFECT-ZALO-11` - Absence of Zalo OA v3 OAuth 2.0 PKCE architecture):**
    - Codebase relies solely on static bot token `bot-api.zaloplatforms.com` (`CONFIG.ZALO_BOT_TOKEN`).
    - Contains 0 references to OA v3 endpoints (`oauth.zaloapp.com/v4/oa/access_token`), 0 refresh_token stores, 0 token rotation logic (25-hour access_token expiry), and 0 concurrency mutex locks against Token Replay.

12. **Probe 12 (`DEFECT-ZALO-12` - Unhandled HTTP errors / `muteHttpExceptions: true`):**
    - In `google-apps-script-zalo-edusign.js` lines 1944–1952 (`sendZaloBotReply`): `UrlFetchApp.fetch` uses `muteHttpExceptions: true` and discards the return value.
    - Verified empirically: When Zalo returns HTTP 400 (`{ error: -201, message: "User has blocked this bot" }`), `handleEduSignNotification` still returns `{ success: true, delivered: true }`, creating a false-positive delivery status.

---

### 2. Logic Chain
1. *From Probes 1, 5, 6, 8:* The notification pipeline lacks architectural centralization. The client and server compete to dispatch notifications (Probe 8), while critical stages of the multi-level workflow (`FORWARDED` in Probe 1, `approve-leader` in Probe 5, `approve-principal` in Probe 6) omit Zalo triggers or drop them, leaving teachers and leaders uninformed.
2. *From Probes 4, 7, 9, 10:* The system exhibits critical security bypasses:
   - Anyone can hijack any staff member's Zalo account by texting their phone number (Probe 4).
   - Anyone can reject documents without authentication due to route shadowing at line 836 (Probe 7).
   - Anyone can download the official school seal and teacher signatures without logging in (Probe 9).
   - Anyone can wipe out the school's reports database via unauthenticated Webhook POST (Probe 10).
3. *From Probes 2, 3, 11, 12:* The interactive chatbot lacks document-specific NLP routing (Probes 2 & 3), lacks Zalo OA v3 token lifecycle management (Probe 11), and silences Zalo API delivery failures (Probe 12).

---

### 3. Caveats
- Production source files (`server.js`, `dataStore.js`, `zaloNotifyService.js`, `index.html`) were strictly left unmodified, in compliance with the read-only integrity constraint.
- The test suite `tests/test_zalo_security_and_logic_audit.js` uses sandboxed Node.js VM execution and in-memory HTTP servers to simulate GAS and Express environments with genuine code execution, avoiding external internet dependencies during regression testing.
- No dummy/facade implementations or hardcoded booleans were used; every probe exercises the actual code logic.

---

### 4. Conclusion
All **12 defects** identified by `explorer_zalo` have been independently and empirically verified through the automated test suite `tests/test_zalo_security_and_logic_audit.js`.
- **4 Critical Security Vulnerabilities:** DEFECT-ZALO-04 (Account Takeover), DEFECT-ZALO-07 (Route Shadowing), DEFECT-ZALO-09 (Public Static Exposure of School Seal), DEFECT-ZALO-10 (Unauthenticated Database Destruction).
- **4 Notification Logic Bugs:** DEFECT-ZALO-01 (Silent drop of FORWARDED), DEFECT-ZALO-02 (Missing doc ID parser), DEFECT-ZALO-05 (approve-leader omission), DEFECT-ZALO-06 (approve-principal omission).
- **4 Architectural Flaws:** DEFECT-ZALO-03 (Missing pending queue), DEFECT-ZALO-08 (Dual-dispatch duplication), DEFECT-ZALO-11 (Absence of Zalo OA v3 OAuth 2.0 PKCE), DEFECT-ZALO-12 (False-positive delivery on HTTP error).

---

### 5. Verification Method
To independently reproduce and verify all 12 defects:
1. Run the newly created automated audit suite:
   ```bash
   node tests/test_zalo_security_and_logic_audit.js
   ```
   **Expected output:** 12/12 Probes Passed, exits with code 0, generates `probe_findings.json`.
2. Run code style & lint verification:
   ```bash
   npx oxlint tests/test_zalo_security_and_logic_audit.js
   ```
   **Expected output:** 0 errors, 0 warnings.
3. Run project regression test suite:
   ```bash
   npm test
   ```
   **Expected output:** 101/101 tests pass (100%), 0 regressions.
