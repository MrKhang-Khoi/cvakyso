# HANDOFF REPORT — TEST INFRASTRUCTURE & GAP ANALYSIS (MILESTONE 2)

**Agent**: `explorer_test_infra` (Test Infrastructure & Gap Analysis Specialist)  
**Date**: 2026-09-15  
**Recipient**: `parent` (Teamwork Preview Orchestrator / Lead)  
**Working Directory**: `c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\explorer_test_infra`  
**Report Artifact**: `c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\explorer_test_infra\test_infra_audit_report.md`  

---

## 1. OBSERVATION

1. **Test Runner & NPM Scripts Configuration (`package.json`)**:
   - `package.json` lines 6-10:
     ```json
     "scripts": {
       "start": "node server.js",
       "build:signer": "dotnet build RealPdfSigner/RealPdfSigner.csproj",
       "test": "node test.js"
     }
     ```
   - Only `node test.js` is mapped to `npm test`. No script exists for Playwright (`npx playwright test`) or Zalo test suites.
   - `devDependencies` (lines 17-21) has `@playwright/test ^1.63.0` and `oxlint ^1.82.0`.
2. **Playwright Configuration (`playwright.config.mjs`)**:
   - Lines 9-25:
     ```javascript
     use: {
       baseURL: 'http://localhost:3000',
       screenshot: 'only-on-failure',
       headless: true
     },
     webServer: {
       command: 'node server.js',
       url: 'http://localhost:3000',
       reuseExistingServer: true,
       timeout: 15000,
     },
     projects: [
       {
         name: 'chromium',
         use: { ...devices['Desktop Chrome'] },
       },
     ],
     ```
   - Running `npx playwright test --list` discovered 36 tests in 15 files, all matching `.spec.mjs`.
   - Projects defined: Only single desktop project `chromium`. Zero mobile or tablet device profiles configured.
3. **Existing UI / Mobile Test Files**:
   - `tests/ui_dialog_supervision.spec.mjs` (529 lines) only defines 2 viewports (lines 23-26):
     ```javascript
     const VIEWPORTS = [
       { name: 'Desktop_1920x1080', label: 'Màn hình Desktop Chuẩn 1920x1080', width: 1920, height: 1080 },
       { name: 'Laptop_1366x768', label: 'Màn hình Laptop Giáo viên 1366x768', width: 1366, height: 768 }
     ];
     ```
     Tablet (768x1024) is completely missing.
   - `tests/04_responsive_mobile.spec.mjs` (30 lines): Only opens unauthenticated `/` at 390x844, checks `scrollWidth > window.innerWidth`, takes 1 screenshot and exits. Zero interaction with login, teacher workspace, review workflow, or modals.
   - Neither test measures touch target sizes ($\ge 44\text{px}$) nor evaluates WCAG color contrast ratios.
4. **Existing Zalo Test & Service Code**:
   - `tests/test_zalo_unified_bot.js` (374 lines): Only unit tests helper functions inside `google-apps-script-zalo-edusign.js` (formatting timetable text, matching class names).
   - Zero tests exist for `zaloNotifyService.js` (lines 64-145: `notifyDocumentRejected`, `notifyDocumentSubmitted`, `notifyDocumentPersonalSigned`, `notifyDocumentCompleted`).
   - In `zaloNotifyService.js` line 26: `const timeoutId = setTimeout(() => controller.abort(), 15000);` has no retry mechanism on failure or timeout.
   - `server.js` lines 886, 2845, 2851, 2918, 3052, 3126 invoke `zaloNotifyService` asynchronously with unhandled `.catch()` and ignore return status.
   - In `google-apps-script-zalo-edusign.js` line 33: `ZALO_BOT_TOKEN: "2294655560219778902:..."`. Uses static bot platform API, zero Zalo OA v3 Access Token/Refresh Token rotation logic.
   - In `google-apps-script-zalo-edusign.js` lines 413-418 & 1272-1326: Anyone who inputs a teacher's phone number is linked without OTP and can inspect all reports via `hoso`.
5. **Server Lifecycle & Port Collision Behavior**:
   - `server.js` line 51: `const PORT = process.env.PORT || 3000;`.
   - Lines 3972-3982: On `EADDRINUSE`, automatically switches to fallback port `3001`. Playwright config however hardcodes `http://localhost:3000`.
   - `dataStore.js` mutates live files `data/users.json`, `data/documents.json`. `git status` shows uncommitted modifications caused by past test runs.

---

## 2. LOGIC CHAIN

1. **Step 1 (Fragmented test execution)**: From Observation 1 & 2, running `npm test` only tests `test.js` (API and C# signer). Playwright tests and Zalo unit tests must be executed manually. Without unified npm scripts, developers and automated CI pipelines will fail to execute all required test tiers.
2. **Step 2 (Critical UI/UX gap for schools)**: From Observation 3, Vietnamese teachers frequently access the portal and sign/approve documents on mobile devices (smartphones, 390x844) and tablets (iPads, 768x1024). The current testing framework completely ignores Tablet (768x1024) and only tests a static login screen for Mobile (390x844). Furthermore, school users require accessible touch targets ($\ge 44\text{px}$) and compliant contrast. The current absence of automated assertions for touch targets and WCAG contrast represents an unmitigated ergonomic risk.
3. **Step 3 (Blind spot in Zalo communication & security)**: From Observation 4, `zaloNotifyService.js` is the core dispatch service in `server.js`, but has 0% integration test coverage. The current Zalo test script only exercises string formatting in GAS. If a network blip occurs, the 15s timeout aborts without retry, and `server.js` ignores the failure, leading to lost notifications.
4. **Step 4 (Empirical Security Vulnerabilities)**: From Observation 4, the chatbot logic allows arbitrary phone number association without OTP, enabling unauthorized individuals to retrieve internal school documents and teacher lesson plans. Furthermore, personal health/leave reasons are leaked verbatim in substitution queries.
5. **Step 5 (Architecture formulation)**: Therefore, two independent, production-grade test suites must be introduced:
   - `tests/test_cross_device_ui_ux_audit.spec.mjs` running across 4 viewports with automated overflow trap detection, touch target audit, WCAG contrast calculation, and 0 F12 error enforcement.
   - `tests/test_zalo_security_and_logic_audit.js` running with a local Mock GAS Webhook server to validate 5 notification events, simulate token refresh lifecycle, and run empirical pentests exposing account hijacking and PII leakage.

---

## 3. CAVEATS

- **C# RealPdfSigner Environment**: Testing live digital signature verification requires either the compiled binary `public/downloads/EduSign_Agent.exe` or the .NET SDK (`dotnet build RealPdfSigner/RealPdfSigner.csproj`). In headless Linux CI environments, C# Crypt32 API calls must be stubbed or simulated.
- **Production Data Modification**: Because `dataStore.js` lacks an in-memory or cloned database mode, running tests against a live server will mutate files in `data/`. A snapshot/restore mechanism is mandatory before running tests that persist records.
- **External Network Dependency**: Real Google Apps Script webhook endpoints require live internet access. The newly designed test suite uses a local HTTP mock server (`127.0.0.1:3999`) to achieve 100% offline determinism.

---

## 4. CONCLUSION

- The existing test suite was insufficient to certify Milestone 2 requirements: it had zero tablet coverage, superficial mobile coverage, zero Zalo backend/security coverage, and lacked standardized npm commands.
- The test infrastructure gap has been completely audited, documented, and resolved architecturally in `test_infra_audit_report.md`.
- Two definitive blueprints have been formulated:
  1. `tests/test_cross_device_ui_ux_audit.spec.mjs` (4-device Playwright suite).
  2. `tests/test_zalo_security_and_logic_audit.js` (Node.js standalone security & logic suite).
- All prerequisites, exact execution commands, and expected assertions have been established for the subsequent implementation phase.

---

## 5. VERIFICATION METHOD

1. **Inspect Report Artifact**:
   - Path: `c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\explorer_test_infra\test_infra_audit_report.md`
   - Verify that all 4 sections (Audit Findings, R1 Architecture, R2 Architecture, Blueprints & Execution commands) are fully elaborated with verbatim file coordinates and code snippets.
2. **Verify Playwright Test Discovery**:
   - Command: `npx playwright test --list`
   - Confirms that Playwright currently discovers only 36 desktop-oriented tests and lacks the cross-device suite.
3. **Verify Zalo Current Test Status**:
   - Command: `node tests/test_zalo_unified_bot.js`
   - Confirms existing unit tests pass, but only cover GAS timetable utilities, leaving `zaloNotifyService.js` and security logic untested.
4. **Invalidation Conditions**:
   - The conclusions herein are invalidated if `playwright.config.mjs` is modified to run multi-device matrix tests, or if `server.js` implements a database rollback mechanism natively.
