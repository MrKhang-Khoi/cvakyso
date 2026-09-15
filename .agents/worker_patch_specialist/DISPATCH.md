## 2026-09-15T00:30:42Z
You are the Proposed Code Patches Specialist (worker_patch_specialist).
Your working directory is: c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\worker_patch_specialist
Project root is: c:\Users\HPZBook\Desktop\KÝ SỐ
Authoritative user request is in: c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\ORIGINAL_REQUEST.md (under section ## 2026-09-15T00:16:04Z).

## 🔒 MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## 🔒 Strict Constraints:
- TUYỆT ĐỐI KHÔNG TỰ Ý CHỈNH SỬA các file mã nguồn chính (server.js, dataStore.js, zaloNotifyService.js, index.html, portal-baocao.html) khi chưa có sự phê duyệt trực tiếp của người dùng.
- All code changes MUST be provided as PROPOSED code snippets / patch files.

## Core Assignment:
1. Read the full audit reports from all specialists:
   - `c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\explorer_ui_ux\ui_ux_audit_report.md`
   - `c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\explorer_zalo\zalo_logic_audit_report.md`
   - `c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\explorer_test_infra\test_infra_audit_report.md`
2. Create the master Proposed Patches document:
   `c:\Users\HPZBook\Desktop\KÝ SỐ\PROPOSED_PATCHES.md` (and also save a copy in your working directory)
   Containing:
   - Part 1: Cross-Device UI/UX Proposed Code Patches (DEF-01 to DEF-11):
     * Target files: `index.html`, `portal-baocao.html`, `js/app.js`.
     * Exact line coordinates, Target Content (Before), Replacement Content (After), and Technical Rationale.
     * Fixes for: Mobile 410px overflow trap, PDF toolbar responsiveness on mobile/tablet, sub-44px nudge buttons, `pointercancel` handler, Z-index token normalization, WCAG contrast enhancements.
   - Part 2: Zalo Logic & Security Proposed Code Patches (DEFECT-ZALO-01 to DEFECT-ZALO-12):
     * Target files: `server.js`, `zaloNotifyService.js`, `google-apps-script-zalo-edusign.js`.
     * Exact line coordinates, Target Content (Before), Replacement Content (After), and Security/Operational Rationale.
     * Fixes for: `FORWARDED` event support, `approve-leader` & `approve-principal` notifications, removing shadowed `/reject` route, OTP-based phone mapping to prevent account takeover, protecting `/uploads` static seal/signatures behind auth, enforcing `secret_token` on GAS `doPost(e)`, doc ID parser (`KHBD-...`), pending lookup (`choduyet`), and Zalo OA v3 token refresh manager with Mutex lock.
   - Part 3: Comprehensive Recommendation Matrix:
     * Structured table with columns: `#`, `Defect ID`, `Severity (Critical / Logic Fix / UX Enhancement)`, `Target File & Line Coordinates`, `Operational Impact at THCS Chu Văn An`, `Patch Summary`.
3. Deliverables:
   - File created: `c:\Users\HPZBook\Desktop\KÝ SỐ\PROPOSED_PATCHES.md`
   - Write comprehensive handoff report to:
     `c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\worker_patch_specialist\handoff.md`
   - Update `progress.md` with timestamps. When done, send a message to parent.
