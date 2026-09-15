# HANDOFF REPORT: ZALO LOGIC & SECURITY AUDIT SPECIALIST (`explorer_zalo`)
**Target Recipient:** Orchestrator (`parent` / `0d7a5d85-4572-4646-a649-b14db45bc5cd`)  
**Date:** 2026-09-15T07:23:30+07:00  
**Type:** Hard Handoff (Task Complete)  
**Deliverable File:** `c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\explorer_zalo\zalo_logic_audit_report.md`  
**Automated Test Harness:** `c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\explorer_zalo\test_zalo_logic_audit.js`

---

### 1. Observation
Direct, verbatim code observations and empirical test results:
1. **Silent Drop of `FORWARDED` Events:**
   - In `js/app.js` line 5644: `eventType: 'FORWARDED'`.
   - In `google-apps-script-zalo-edusign.js` line 1332–1400: `handleEduSignNotification` only branches on `REJECTED`, `COMPLETED`, `SUBMITTED`, `PERSONAL_SIGNED`. When `FORWARDED` is received, `messageText` is empty (`""`), and line 1399 returns `{ success: false, reason: "INVALID_EVENT" }`.
   - Directly verified via `node .agents/explorer_zalo/test_zalo_logic_audit.js` Probe 1: `❌ [CONFIRMED VULN 1] 'FORWARDED' event is REJECTED by GAS with INVALID_EVENT!`.
2. **Missing Notification Hooks in Document Approval Routes:**
   - In `server.js` lines 3203–3264 (`POST /api/documents/:id/approve-leader`): zero invocations of `zaloNotifyService`. Only Web Push to author is executed (line 3252).
   - In `server.js` lines 3267–3415 (`POST /api/documents/:id/approve-principal`): zero invocations of `zaloNotifyService`. Only Web Push to author is executed (line 3403).
   - In `server.js` line 2566 & 2845: `POST /api/documents` only notifies next signer if `category === 'REPORT'`. For standard lesson plans (`PERSONAL`), it only sends a self-notification to the creator (line 2851) and never notifies the Department Head.
3. **Duplicate Route Shadowing on `/api/documents/:id/reject`:**
   - `server.js` line 836: `app.post('/api/documents/:id/reject', (req, res) => { ... })` - unauthenticated, parses identity from `x-user-id` header or body.
   - `server.js` line 3418: `app.post('/api/documents/:id/reject', requireAuth, (req, res) => { ... })` - authenticated.
   - Because route 1 is registered first, it intercepts all requests. Route 2 is dead code.
4. **Account Takeover Vulnerability in Zalo Bot Phone Mapping:**
   - In `google-apps-script-zalo-edusign.js` lines 413–418 & 1181–1233 (`handlePhoneMapping`): any user on Zalo who inputs 9–12 digits matching a teacher's phone number immediately overwrites `Zalo_Chat_ID` in Google Sheet column 6 without OTP or password.
   - Directly verified via `test_zalo_logic_audit.js` Probe 4: Attacker chat ID overwrote Teacher Ty's mapping with zero authentication.
5. **Unauthenticated Sensitive Static Directory (`/uploads`):**
   - In `server.js` line 84: `app.use('/uploads', express.static(path.join(__dirname, 'uploads')))` allows public downloads of `uploads/signatures/school_seal.png` (official school stamp), `sig_*.png` (teacher/principal digital signatures), and signed PDFs.
6. **Missing Webhook Authentication on Google Apps Script `doPost(e)`:**
   - In `google-apps-script-zalo-edusign.js` line 162: `secret_token: "UnifiedZaloBotTHCSCVA2026Secret"` is declared, but lines 293–338 in `doPost(e)` never validate it. Public requests with `action: "CLEAR_ALL_REPORTS"` wipe out the entire reports database.
7. **Dual-Dispatch Duplication:**
   - Both `js/app.js` (lines 4769, 5225, 5424, 5599) and `server.js` (lines 886, 2845, 2851, 2918, 3052) fire HTTP POST requests to Google Apps Script concurrently, causing double messages to users.

---

### 2. Logic Chain
1. *From Observation 1:* When multi-signer documents are forwarded, `js/app.js` sends `FORWARDED`. Because GAS handler rejects it as `INVALID_EVENT`, the recipient receives no notification, breaking the signing chain.
2. *From Observation 2:* When Tổ trưởng or BGH approves a lesson plan via `approve-leader` or `approve-principal`, the server omits `zaloNotifyService` calls. Therefore, neither BGH nor Teacher receives Zalo updates, forcing manual checking.
3. *From Observation 4:* In Vietnamese schools, teachers' phone numbers are publicly distributed in staff directories. Without an OTP or shared secret, any student or third party can message the bot with a teacher's phone number, taking over their Zalo notifications and document lookup privileges (`hoso`).
4. *From Observation 5:* Exposing `school_seal.png` and `sig_admin.png` under a public static Express route allows anyone to harvest high-resolution transparent assets of the government organization's official seal, presenting severe legal and counterfeit risks.
5. *From Observation 6 & 7:* Unauthenticated endpoints in both Express (`/reject` at line 836) and Apps Script (`CLEAR_ALL_REPORTS`) allow unauthenticated state mutations and data destruction.

---

### 3. Caveats
- The external Google Apps Script deployment URL (`https://script.google.com/macros/s/AKfycbwGBgauc9xHzRe31_IfCQD-Q9yHwGp4CfYLEam9IupcYhLpNBXbgW0J1t-weD6iUQ87ZQ/exec`) was audited based on the local script source file `google-apps-script-zalo-edusign.js`. If the live deployment has diverged from the local file, redeployment of the audited version is required.
- Zalo Bot Platform (`bot-api.zaloplatforms.com`) token validity was not revoked during testing to maintain operational readiness.
- No production source files were modified, in strict adherence to read-only constraints.

---

### 4. Conclusion
The Zalo notification and chatbot ecosystem contains **12 documented defects**, categorized into:
- **4 Critical Security Flaws:** Account Takeover via unauthenticated phone mapping, unauthenticated Google Apps Script administrative actions, public static exposure of the school seal and signatures on `/uploads`, and route shadowing on `/reject`.
- **4 Notification Logic Breakages:** Silent drop of `FORWARDED` events, omission of Zalo notifications in `approve-leader` and `approve-principal`, and lack of document ID command parsing (`KHBD-...`).
- **4 Architectural Inconsistencies:** Dual-dispatch race conditions between client and backend, unhandled Zalo HTTP errors (`muteHttpExceptions: true`), 15s timeout with zero retries, and absence of Zalo OA v3 OAuth 2.0 PKCE refresh token architecture.

All defects are fully documented with exact line numbers, root cause analyses, operational impacts, and verified fix snippets in `zalo_logic_audit_report.md`.

---

### 5. Verification Method
1. **Automated Probe Suite:**
   Run command:
   ```bash
   node .agents/explorer_zalo/test_zalo_logic_audit.js
   ```
   Expected output: Confirms all 9 automated defects with exit code 0.
2. **Target File Inspections:**
   - `server.js`: inspect line 84 (`/uploads`), line 836 vs line 3418 (`/reject`), line 3203 (`approve-leader`), line 3267 (`approve-principal`).
   - `google-apps-script-zalo-edusign.js`: inspect line 293 (`doPost`), line 413 (`phoneDigits`), line 1332 (`handleEduSignNotification`).
   - `js/app.js`: inspect line 5644 (`eventType: 'FORWARDED'`).
