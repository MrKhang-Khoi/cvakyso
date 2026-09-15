# BRIEFING — 2026-09-15T00:31:00Z

## Mission
Develop comprehensive, production-ready proposed code patches (PROPOSED_PATCHES.md) addressing all UI/UX defects (DEF-01 to DEF-11) and Zalo logic/security defects (DEFECT-ZALO-01 to DEFECT-ZALO-12) based on specialist audit reports.

## 🔒 My Identity
- Archetype: Proposed Code Patches Specialist (worker_patch_specialist)
- Roles: implementer, qa, specialist
- Working directory: c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\worker_patch_specialist
- Original parent: 0d7a5d85-4572-4646-a649-b14db45bc5cd
- Milestone: M2 - Proposed Code Patches Generation & Verification

## 🔒 Key Constraints
- TUYỆT ĐỐI KHÔNG TỰ Ý CHỈNH SỬA các file mã nguồn chính (server.js, dataStore.js, zaloNotifyService.js, index.html, portal-baocao.html) khi chưa có sự phê duyệt trực tiếp của người dùng.
- All code changes MUST be provided as PROPOSED code snippets / patch files.
- DO NOT CHEAT. All implementations must be genuine with exact line coordinates, Target Content (Before), Replacement Content (After), and Technical Rationale.

## Current Parent
- Conversation ID: 0d7a5d85-4572-4646-a649-b14db45bc5cd
- Updated: 2026-09-15T00:31:00Z

## Task Summary
- **What to build**: `PROPOSED_PATCHES.md` at root and worker directory.
- **Success criteria**:
  1. Part 1: UI/UX Patches (DEF-01 to DEF-11) targeting `index.html`, `portal-baocao.html`, `js/app.js`.
  2. Part 2: Zalo Logic & Security Patches (DEFECT-ZALO-01 to DEFECT-ZALO-12) targeting `server.js`, `zaloNotifyService.js`, `google-apps-script-zalo-edusign.js`.
  3. Part 3: Comprehensive Recommendation Matrix.
- **Interface contracts**: `PROJECT.md`
- **Code layout**: Root directory and `.agents/worker_patch_specialist`

## Key Decisions Made
- Read and cross-reference all 3 audit reports (`explorer_ui_ux`, `explorer_zalo`, `explorer_test_infra`).
- Validate exact file paths, line numbers, and existing code blocks before authoring patches.

## Artifact Index
- `c:\Users\HPZBook\Desktop\KÝ SỐ\PROPOSED_PATCHES.md` — Master patch document.
- `c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\worker_patch_specialist\PROPOSED_PATCHES.md` — Copy of master patch document.
- `c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\worker_patch_specialist\handoff.md` — Handoff report.

## Change Tracker
- **Files modified**: None (Strict constraint: no direct edits to source files).
- **Build status**: N/A
- **Pending issues**: Authoring PROPOSED_PATCHES.md

## Quality Status
- **Build/test result**: Analysis & patch proposal mode
- **Lint status**: Clean
- **Tests added/modified**: Patch specs for test infrastructure

## Loaded Skills
- **Source**: C:\Users\HPZBook\.gemini\config\skills\code-quality\SKILL.md
  - **Local copy**: N/A
  - **Core methodology**: Strict verification, error handling, zero-guesswork, anti-fabrication.
- **Source**: C:\Users\HPZBook\.gemini\config\skills\zero-bug-verification\SKILL.md
  - **Local copy**: N/A
  - **Core methodology**: Multi-agent verification, exact line coordinates, no facade/dummy logic.
