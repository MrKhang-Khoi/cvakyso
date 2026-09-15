# Context: EduSign VGCA Cross-Device UI/UX & Zalo Chat/Notify Audit

## Project Background
EduSign VGCA is a digital signing platform designed for secondary school management (specifically configured for Trường THCS Chu Văn An). It handles teacher lesson plan submissions, department head review (ký nháy), principal/vice-principal VGCA digital signing with school seal (ký số VGCA + đóng dấu mộc đỏ), and public report portal.

## Key Files under Audit
- Frontend UI: `index.html` (primary teacher/leader/admin workspace & modals), `portal-baocao.html` (public verification portal).
- Backend & Storage: `server.js` (Express backend, routes, webhook, API), `dataStore.js` (JSON persistence, concurrency locks).
- Zalo Integration: `zaloNotifyService.js` (1-way GAS notification & Zalo OA v3), `google-apps-script-zalo-edusign.js` (GAS script), `tests/test_zalo_unified_bot.js` (existing test suite).

## Governing Constraints
- Zero modification to existing production code files without prior user approval.
- Independent test scripts written to `tests/`.
- Concrete proposed patches with exact line coordinates and rationale.
