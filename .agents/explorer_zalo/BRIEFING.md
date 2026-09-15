# BRIEFING — 2026-09-15T00:23:00Z

## Mission
Conduct an in-depth, read-only audit of Zalo Chat & Notify logic, security, and integration architecture in EduSign VGCA (THCS Chu Văn An).

## 🔒 My Identity
- Archetype: explorer
- Roles: Zalo Logic & Security Audit Specialist
- Working directory: c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\explorer_zalo
- Original parent: 0d7a5d85-4572-4646-a649-b14db45bc5cd
- Milestone: M2 - Zalo Logic & Security Audit

## 🔒 Key Constraints
- Read-only investigation — do NOT implement or modify any source code files.
- Produce comprehensive audit report in `zalo_logic_audit_report.md`.
- Maintain `progress.md` with timestamps.
- Report all findings and defects back to parent via `send_message`.

## Current Parent
- Conversation ID: 0d7a5d85-4572-4646-a649-b14db45bc5cd
- Updated: 2026-09-15T07:23:00+07:00

## Investigation State
- **Explored paths**:
  * `zaloNotifyService.js` (lines 1-155): Webhook dispatch, timeout, payload format.
  * `server.js`: Event trigger hooks, route definitions (lines 84, 836, 2550, 2845, 3052, 3126, 3203, 3267, 3418).
  * `google-apps-script-zalo-edusign.js`: `doPost(e)`, `processUnifiedZaloMessage`, `handleEduSignNotification`, `handlePhoneMapping`, `handleLookupTeacherReports`, `sendZaloBotReply`.
  * `js/app.js`: `sendZaloNotificationClientSide` (lines 36-65, 4769, 5225, 5424, 5599, 5644).
  * `portal-baocao.html`: Unauthenticated public delete endpoints (lines 613, 624, 752).
  * `data/users.json`: Plaintext passwords, CCCD, cert serials, signatures.
  * `tests/test_zalo_unified_bot.js`: Coverage gaps identified.
- **Key findings**:
  * Confirmed 12 distinct defects, including 4 critical security flaws (Account Takeover via unauthenticated phone mapping, unauthenticated secret token on GAS doPost, public exposure of school seal and teacher signatures on `/uploads`, unauthenticated duplicate reject route).
  * Confirmed 4 major notification logic flaws (silent drop of `FORWARDED` events, missing Zalo notify in `approve-leader` and `approve-principal`, missing document ID parser `KHBD-...`).
  * Confirmed dual-dispatch duplication between `js/app.js` and `server.js`.
- **Unexplored areas**: None within the Zalo logic and security scope. All assigned objectives thoroughly probed and verified.

## Key Decisions Made
- Maintained strict read-only explorer boundaries: no production source files modified.
- Built automated empirical probe script (`test_zalo_logic_audit.js`) in working directory, producing reproducible proof of all 9 automated defects.
- Compiled complete audit report in `zalo_logic_audit_report.md` with exact file coordinates, root cause analyses, operational impacts, and proposed code fix snippets.

## Artifact Index
- `.agents/explorer_zalo/DISPATCH.md` — Inbound messages and prompts
- `.agents/explorer_zalo/BRIEFING.md` — Persistent working memory
- `.agents/explorer_zalo/progress.md` — Liveness heartbeat & task tracking
- `.agents/explorer_zalo/test_zalo_logic_audit.js` — Empirical probe validation test script
- `.agents/explorer_zalo/probe_findings.json` — Machine-readable defect probe output
- `.agents/explorer_zalo/zalo_logic_audit_report.md` — Full authoritative audit report
- `.agents/explorer_zalo/handoff.md` — 5-component handoff report
