# BRIEFING — 2026-09-15T00:17:33Z

## Mission
Orchestrate independent, multi-agent audit and verification for EduSign VGCA Cross-Device UI/UX and Zalo Chat/Notify features, producing empirical test scripts in tests/ and a comprehensive audit report with proposed patches.

## 🔒 My Identity
- Archetype: teamwork_preview_orchestrator_2
- Roles: orchestrator, user_liaison, human_reporter, successor
- Working directory: c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\teamwork_preview_orchestrator_2
- Original parent: parent (f1af7af2-9697-4540-92f5-6c1741b21e31)
- Original parent conversation ID: f1af7af2-9697-4540-92f5-6c1741b21e31

## 🔒 My Workflow
- **Pattern**: Project / Audit & Verification Pattern
- **Scope document**: c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\teamwork_preview_orchestrator_2\plan.md
1. **Decompose**:
   - Track 1 (UI/UX): Cross-Device UI/UX & Design Standards Audit (Desktop, Laptop, Mobile, Tablet, touch targets, overflow, WCAG, console errors) + Playwright test scripts.
   - Track 2 (Zalo Logic & Security): Zalo 1-Way Notify (GAS Webhook, Zalo OA API v3) and 2-Way Chatbot (webhook, doc lookup, auth, data leakage, CCCD/phone exposure, unsigned PDF URLs) + verification test scripts.
   - Track 3 (Verification & Patch Formulation): Run tests in tests/, record pass/fail and reproducible defects, draft concrete proposed code patches.
   - Track 4 (Synthesis & Comprehensive Audit Report): Compile final Báo cáo Đối soát Toàn diện with Recommendation Matrix, Severity, File & Line coordinates, impact at THCS Chu Văn An, and proposed code diffs for user approval.
2. **Dispatch & Execute**:
   - Milestone 1: Exploration & In-Depth Audit (UI/UX Explorer + Zalo Explorer).
   - Milestone 2: Independent Test Script Creation & Verification Execution (UI/UX Test Writer/Worker + Zalo Test Writer/Worker).
   - Milestone 3: Proposed Patch Construction & Quality Review (Worker/Reviewer).
   - Milestone 4: Synthesis & Final Audit Report Delivery.
3. **On failure**: Retry -> Replace -> Skip -> Redistribute -> Redesign -> Escalate.
4. **Succession**: At 16 spawns, write handoff.md and spawn successor.
- **Work items**:
  1. Survey & Audit Exploration [in-progress]
  2. Test Scripts & Empirical Verification [pending]
  3. Proposed Patches & Defect Analysis [pending]
  4. Synthesis & Audit Report [pending]
- **Current phase**: 1
- **Current focus**: Work item 1 (Dispatch Survey & Exploration)

## 🔒 Key Constraints
- TUYỆT ĐỐI KHÔNG TỰ Ý CHỈNH SỬA các file mã nguồn chính (server.js, dataStore.js, zaloNotifyService.js, index.html) khi chưa có sự phê duyệt trực tiếp của người dùng. All code changes must be provided as PROPOSED code snippets / patch files.
- Independent test scripts proving UI/UX defects and Zalo logic/security issues MUST be placed in tests/ directory (or run from tests/).
- Maintain plan.md, progress.md, and context.md in working directory.
- Dispatch-only orchestrator: NEVER write source code directly, NEVER run tests directly, delegate all execution to subagents.
- Never reuse a subagent after it has delivered its handoff — always spawn fresh.

## Current Parent
- Conversation ID: f1af7af2-9697-4540-92f5-6c1741b21e31
- Updated: 2026-09-15T00:17:33Z

## Key Decisions Made
- Architecture divided into 2 primary investigation pillars (UI/UX and Zalo) followed by empirical testing, patch drafting, and synthesis.
- Strictly respect user's code-freeze constraint: no direct edits to server.js, dataStore.js, zaloNotifyService.js, index.html.

## Team Roster
| Agent | Type | Work Item | Status | Conv ID |
|-------|------|-----------|--------|---------|
| explorer_ui_ux | teamwork_preview_explorer | UI/UX & Responsive Cross-Device Audit | completed | b74980ea-d90d-49d0-a85a-cbe9d3c7a6f3 |
| explorer_zalo | teamwork_preview_explorer | Zalo Notify & Chatbot Security/Logic Audit | completed | 0d2a1883-685c-471f-9e84-1f326e0eec48 |
| explorer_test_infra | teamwork_preview_explorer | Test Infrastructure & Gap Analysis | completed | caf89ad3-a408-46bb-84ce-514025ea0ac4 |
| worker_ui_ux_test | teamwork_preview_worker | UI/UX Playwright Test Suite in tests/ | completed | c2de19f3-b30c-44ca-a4fd-69d6bedba5fe |
| worker_zalo_test | teamwork_preview_worker | Zalo Security & Logic Test Suite in tests/ | completed | 883ebb58-4b80-49a7-b847-d4878b60f7d3 |
| worker_patch_specialist | teamwork_preview_worker | Comprehensive Proposed Patches Formulation | completed | 2957b1a9-d1dc-4d5f-ac2b-22339d314be4 |
| auditor_integrity | teamwork_preview_auditor | Forensic Integrity Audit & Verification | completed | df590dbc-5cd8-47bb-b142-f7b5cd0a2b3f |
| reviewer_audit | teamwork_preview_reviewer | Quality & Completeness Review | completed | b5f19278-c3e0-4d24-9d30-32eaba896c61 |

## Succession Status
- Succession required: no
- Spawn count: 8 / 16
- Pending subagents: none
- Predecessor: none
- Successor: not yet spawned

## Active Timers
- Heartbeat cron: 0d7a5d85-4572-4646-a649-b14db45bc5cd/task-24
- Safety timer: none

## Artifact Index
- c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\ORIGINAL_REQUEST.md — Authoritative User Request
- c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\teamwork_preview_orchestrator_2\DISPATCH.md — Orchestrator Dispatch Assignment
- c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\teamwork_preview_orchestrator_2\BRIEFING.md — Persistent Working Memory
- c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\teamwork_preview_orchestrator_2\plan.md — Detailed Action Plan
- c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\teamwork_preview_orchestrator_2\progress.md — Liveness & Progress State
- c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\teamwork_preview_orchestrator_2\context.md — Context Tracking
