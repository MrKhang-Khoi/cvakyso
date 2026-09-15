# Master Plan: EduSign VGCA Cross-Device UI/UX and Zalo Chat/Notify Audit

## Objective
Execute a comprehensive, empirical audit of EduSign VGCA across:
1. Cross-Device UI/UX & Design Standards (Desktop 1920x1080, Laptop 1366x768, Mobile 390x844, Tablet 768x1024, touch targets, overflow, WCAG contrast, console errors).
2. Zalo Chat & Notify System (1-way notification via GAS webhook & Zalo OA v3, 2-way chatbot, token lifecycle, authorization & data privacy risks).
3. Independent Verification Test Scripts in `tests/` and concrete Proposed Code Patches without touching core production code directly.
4. Comprehensive Audit Report (Báo cáo Đối soát Toàn diện) with recommendation matrix, line coordinates, and actionable proposed code diffs.

## Phases and Milestones

### Milestone 1: Comprehensive Exploration & Technical Audit
- **Subagent 1 (UI/UX Explorer)**:
  - Deep-dive into `index.html`, `portal-baocao.html`, CSS styles, modals (`#viewLogin`, `#modalVgcaLogin`, `#modalAdminAuth`, `#modalDocViewer`, `#draggableSignatureStamp`), workspaces (Teacher, Tổ trưởng, BGH).
  - Identify responsive design flaws, overflow risks, touch target issues (<44px), WCAG contrast failures, console error patterns.
- **Subagent 2 (Zalo Logic & Security Explorer)**:
  - Deep-dive into `zaloNotifyService.js`, `server.js`, `google-apps-script-zalo-edusign.js`, `tests/test_zalo_unified_bot.js`.
  - Audit 1-way notification triggers (teacher submit -> tổ trưởng -> BGH -> signed/rejected), GAS payload, timeout, retry, Zalo OA API v3 token refresh lifecycle.
  - Audit 2-way chatbot webhook, command parser, authorization flaws, phone/CCCD privacy leakage, unsigned PDF URL risks, inactive/blocked user handling.

### Milestone 2: Independent Empirical Test Scripts Creation & Execution
- **Subagent 3 (UI/UX Test Writer & Executor)**:
  - Implement automated Playwright test script in `tests/` (e.g. `tests/test_cross_device_ui_ux_audit.spec.mjs`) scanning all 4 viewports, checking `scrollWidth === clientWidth`, measuring touch targets, evaluating contrast ratios, checking console errors across all modals and views.
  - Run and verify the tests against the live or local application server, capture screenshots and empirical metrics.
- **Subagent 4 (Zalo Test Writer & Executor)**:
  - Implement test script in `tests/` (e.g. `tests/test_zalo_security_and_logic_audit.js` / `.mjs`) simulating notification triggers, webhook queries, unauthorized lookups, token refresh edge cases, privacy leakage tests.
  - Run and verify the tests, capture latency, error logs, and protocol verification metrics.

### Milestone 3: Proposed Code Patches & Quality Audit
- **Subagent 5 (Code Patch Specialist)**:
  - Formulate non-destructive proposed patches with exact line numbers for `server.js`, `zaloNotifyService.js`, `index.html`, `portal-baocao.html`.
  - Document rationale, before/after diffs, backwards compatibility, and security impact.
- **Subagent 6 (Auditor / Reviewer)**:
  - Review proposed patches against THCS Chu Văn An operational context, verify zero breaking changes, confirm compliance with strict code-freeze constraint.

### Milestone 4: Synthesis & Comprehensive Audit Report (Báo cáo Đối soát Toàn diện)
- Compile all findings into `AUDIT_REPORT_EDUSIGN_UI_ZALO.md`.
- Formulate Recommendation Matrix:
  * Severity (Critical / Logic Fix / UX Enhancement)
  * File & Line coordinates
  * Real-world operational impact at THCS Chu Văn An
  * Concrete proposed code diffs
- Send final completion message to user and parent.
