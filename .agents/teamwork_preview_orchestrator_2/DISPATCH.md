# Dispatch Assignment

## 2026-09-15T00:17:33Z

You are the Project Orchestrator (teamwork_preview_orchestrator_2) for EduSign VGCA Cross-Device UI/UX and Zalo Chat/Notify Audit.

Your working directory is: c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\teamwork_preview_orchestrator_2
Project root is: c:\Users\HPZBook\Desktop\KÝ SỐ
Authoritative user request is in: c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\ORIGINAL_REQUEST.md (under section ## 2026-09-15T00:16:04Z).

## 🔒 Strict Constraints:
1. TUYỆT ĐỐI KHÔNG TỰ Ý CHỈNH SỬA các file mã nguồn chính (server.js, dataStore.js, zaloNotifyService.js, index.html) khi chưa có sự phê duyệt trực tiếp của người dùng. All code changes must be provided as PROPOSED code snippets / patch files.
2. Independent test scripts proving UI/UX defects and Zalo logic/security issues MUST be placed in tests/ directory (or run from tests/).
3. Maintain your plan.md, progress.md, and context.md in your working directory.

## Core Mission Requirements:
1. R1. Cross-Device UI/UX & Design Standards Audit:
   - Audit all primary views and modals: #viewLogin, #modalVgcaLogin, #modalAdminAuth, Teacher Workspace, Tổ trưởng & BGH Review Workspaces (ký nháy, ký số VGCA, mộc đỏ), PDF Viewer (#modalDocViewer, #draggableSignatureStamp), Public Portal portal-baocao.html.
   - Empirical responsive testing across 3 viewports: Desktop (1920x1080), Laptop (1366x768), Mobile (390x844) & Tablet (768x1024).
   - Check horizontal overflow (scrollWidth === clientWidth), touch target size (>= 44px), WCAG AA/AAA contrast ratios, and JavaScript F12 console errors.
2. R2. In-Depth Zalo Chat & Notify Audit (zaloNotifyService.js, test_zalo_unified_bot.js, server.js):
   - 1-Way Automatic Notification (Zalo Notify / GAS Webhook / Zalo OA API v3 token refresh): trigger flow (teacher submit -> tổ trưởng -> BGH -> signed/rejected), GAS payload, timeout, retry, token lifecycle.
   - 2-Way Interactive Chatbot: webhook receiver, command parsing (by doc ID, phone number, pending queue), authorization & access control (prevent unauthorized doc lookup/data leakage).
   - Security & Data Privacy: leakage of phone/CCCD/internal info, unauthenticated PDF URLs, exception handling for blocked/inactive Zalo users.
3. R3. Independent Verification Test Scripts & Proposed Code Patches:
   - Implement test scripts in tests/ to demonstrate UI/UX issues and Zalo logic/security vulnerabilities.
   - Draft concrete proposed code patches with line numbers and rationale.
4. R4. Synthesis & Comprehensive Audit Report (Báo cáo Đối soát Toàn diện):
   - Recommendation matrix: Severity (Critical - Logic Fix - UX Enhancement), File & Line coordinates, Real-world operational impact at THCS Chu Văn An, and concrete proposed code modifications for admin approval.
