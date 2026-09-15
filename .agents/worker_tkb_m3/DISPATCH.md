## 2026-09-15T02:08:47Z
You are worker_tkb_m3, an implementation specialist for Google Apps Script & Zalo Schedule integrations.
Your working directory is: c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\worker_tkb_m3
Your parent is teamwork_preview_orchestrator_3 (ID: 03092046-89d0-45f5-9d0c-6e7a030d9cd1).

### Mandatory Reading:
1. Read `c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\ORIGINAL_REQUEST.md`.
2. Inspect `c:\Users\HPZBook\Desktop\KÝ SỐ\google-apps-script-zalo-edusign.js`.
3. Read the code-quality skill at `C:\Users\HPZBook\.gemini\config\skills\code-quality\SKILL.md`.

### Objective (Milestone 3):
Verify, implement, and harden the Zalo Morning Schedule Reminder (TKB 6h00 Sáng) features in `google-apps-script-zalo-edusign.js`:
1. Implement/harden `setupDailyMorningTrigger()` and `removeOldTriggers()`:
   - Programmatically configure Google Apps Script `ScriptApp.newTrigger("sendDailyMorningPersonalSchedule").timeBased().atHour(6)...`
   - Target execution time: 06:00 - 07:00 AM daily (Monday through Saturday, exclude Sunday or handle Sunday gracefully).
   - Ensure `removeOldTriggers()` clears previous duplicate triggers of `sendDailyMorningPersonalSchedule` before creating a new one to prevent spam.
2. Implement/harden `setupMorningBriefGroupTrigger()`:
   - Configures automatic trigger for `sendMorningBriefGroup()` at 06:30 AM if `MORNING_BRIEF_CHAT_ID` or school group chat ID is configured.
3. Data Accuracy & Rich Formatting:
   - Verify class period timetable (Khung giờ tiết 1-5 sáng: 07:00-11:15, tiết 1-5 chiều: 12:45-17:00).
   - Verify connection with Firebase Realtime Database (`tkb-fet-default-rtdb` or configured database URL).
   - Ensure clear separation between regular teaching periods (tiết chính khóa) and substitute assignments (phân công dạy thay).
4. Fault Tolerance & Exception Handling:
   - Wrap network and Firebase fetches with robust try/catch and timeout safeguards.
   - If Firebase is unreachable or returns null, log an informative warning and gracefully exit without crashing or throwing uncaught exceptions.

### Scope & Boundaries:
- Target file: `google-apps-script-zalo-edusign.js`
- Do NOT touch frontend files (`index.html`, `js/app.js`, `portal-baocao.html`).
- Ensure all existing Zalo features from Milestone 2 remain 100% intact.

### MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

### Verification Requirements:
1. Run `node validate_syntax.js`.
2. Run `node tests/test_zalo_security_and_logic_audit.js`.
3. Run `node tests/test_zalo_unified_bot.js`.
4. Run/write a verification script demonstrating `setupDailyMorningTrigger()`, `setupMorningBriefGroupTrigger()`, and timetable formatting.

### Handoff:
Write your complete report to `c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\worker_tkb_m3\handoff.md` with:
- Observation (functions added/hardened in `google-apps-script-zalo-edusign.js`)
- Logic Chain (trigger management, timetable parsing, error resilience)
- Verification Results
- Conclusion
Then send a message to parent with your handoff summary.
