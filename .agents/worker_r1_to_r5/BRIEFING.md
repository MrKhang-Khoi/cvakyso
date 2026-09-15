# BRIEFING — 2026-09-15T13:54:00+07:00

## Mission
Triển khai và hoàn thiện 5 yêu cầu cốt lõi (R1 - R5) cho EduSign VGCA với độ chính xác cao, đồng bộ 3 mirror 100%, bảo mật Zalo PIN và kiểm thử zero-bug.

## 🔒 My Identity
- Archetype: teamwork_preview_worker
- Roles: implementer, qa, specialist
- Working directory: c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\worker_r1_to_r5
- Original parent: 6400bcdf-3e9b-4e18-8fba-8fef24a5d7d8
- Milestone: Milestone R1-R5 EduSign Preview

## 🔒 Key Constraints
- Không hardcode kết quả test hay tạo facade giả mạo.
- Đồng bộ 100% 3 file gương: index.html <-> public/index.html <-> docs/index.html và js/app.js <-> public/js/app.js <-> docs/js/app.js.
- Tuân thủ quy chuẩn Zero-Bug Multi-Agent Pipeline & Code Quality (không đoán mò, kiểm chứng bằng log thật).
- Loại bỏ hoàn toàn gợi ý 4 số cuối SĐT cho Zalo PIN.
- Modal User (#modalUser) 2 cột ngang, max-w-4xl, hiển thị trọn vẹn không cần cuộn trên màn hình 1920x1080 và 1366x768.

## Current Parent
- Conversation ID: 6400bcdf-3e9b-4e18-8fba-8fef24a5d7d8
- Updated: 2026-09-15T13:54:00+07:00

## Task Summary
- **What to build**:
  - R1: Tái thiết kế modal thêm/sửa giáo viên (#modalUser) dạng ngang 2 cột gọn gàng (max-w-4xl, max-h-[85vh]).
  - R2: Sửa triệt để lỗi đồng bộ mã PIN từ Admin sang giao diện Giáo viên (handleSaveUser, openModalUserProfile, appState.users, localStorage, Firebase RTDB).
  - R3: Bảo mật cú pháp Zalo Bot trong Google Apps Script & web: loại bỏ fallback 4 số cuối SĐT, đối soát chính xác PIN.
  - R4: Dọn dẹp xóa sạch dữ liệu rác thử nghiệm trong data/documents.json, Firebase RTDB, localStorage.
  - R5: Tính năng tải file Excel mẫu & Nhập danh sách giáo viên từ Excel (SheetJS preview, check trùng, sync).
- **Success criteria**:
  - Tất cả test suites pass (test_zalo_security_and_logic_audit.js, test_verify_patches.js, và test_requirements_r1_to_r5.js: 22/22 pass).
  - 3 mirror đồng bộ SHA-256 tuyệt đối (0 diff).
  - Hoàn tất 100% yêu cầu R1 - R5.
- **Interface contracts**: c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\ORIGINAL_REQUEST.md
- **Code layout**: index.html, public/index.html, docs/index.html, js/app.js, public/js/app.js, docs/js/app.js, google-apps-script-zalo-edusign.js, data/documents.json, scripts/clean_garbage_documents.js, tests/test_requirements_r1_to_r5.js.

## Key Decisions Made
- Sử dụng SheetJS (xlsx 0.18.5) để export template chuẩn với 11 cột nghiệp vụ và tự động đọc, thẩm định dữ liệu khi import.
- Phân chia modal #modalUser thành grid 2 cột cân đối (Cột trái: Thông tin tài khoản & định danh; Cột phải: Bảo mật Zalo, USB Token & phân quyền) với Tailwind classes, padding và margin tối ưu để chiều cao hiển thị trọn vẹn trong viewport 768p và 1080p, footer cố định chứa nút Lưu & Hủy.
- Đảm bảo cơ chế lưu PIN cập nhật lập tức cả appState.users, currentUser, Firebase RTDB và localStorage (edusign_users, edusign_user), và khi mở modalUserProfile đọc trực tiếp bản ghi mới nhất.
- Loại bỏ hoàn toàn gợi ý 4 số cuối SĐT ở cả Google Apps Script và giao diện modalUserProfile, bắt buộc khớp chính xác mã PIN bảo mật.
- Reset file data/documents.json về mảng rỗng [] và chạy script xóa documents/ trên Firebase RTDB.

## Artifact Index
- .agents/worker_r1_to_r5/DISPATCH.md — Assignment instructions
- .agents/worker_r1_to_r5/progress.md — Liveness & progress heartbeat
- .agents/worker_r1_to_r5/handoff.md — Final self-contained handoff report
- tests/test_requirements_r1_to_r5.js — Dedicated automated test suite for R1-R5

## Change Tracker
- **Files modified**:
  - `google-apps-script-zalo-edusign.js`: Cập nhật cú pháp chuẩn, xóa gợi ý 4 số cuối, yêu cầu đối soát chính xác PIN.
  - `data/documents.json`: Reset về [] sạch 100%.
  - `scripts/clean_garbage_documents.js`: Script dọn dẹp dữ liệu rác trên local và Firebase RTDB.
  - `index.html`: Tái thiết kế #modalUser 2 cột ngang, nhúng SheetJS, thêm 2 nút Excel, thêm #modalImportTeacherExcel, cập nhật hướng dẫn #modalUserProfile.
  - `js/app.js`: Đồng bộ PIN realtime, cập nhật switchTab, thêm hàm downloadTeacherExcelTemplate, openModalImportTeacherExcel, handleTeacherExcelFileSelected, handleConfirmImportTeachers, cleanGarbageDocuments.
  - `public/index.html`, `docs/index.html`: Đồng bộ SHA-256 từ `index.html`.
  - `public/js/app.js`, `docs/js/app.js`: Đồng bộ SHA-256 từ `js/app.js`.
  - `tests/test_requirements_r1_to_r5.js`: Bộ test tự động 22/22 kiểm tra xác thực trọn vẹn R1-R5.
- **Build status**: PASS (Tất cả test suites & syntax check đạt 100%)
- **Pending issues**: None

## Quality Status
- **Build/test result**: PASS (12/12 probes verified, 3/3 verify patches pass, 22/22 R1-R5 checks pass)
- **Lint status**: 0 violations (node --check passed on all files)
- **Tests added/modified**: `tests/test_requirements_r1_to_r5.js`

## Loaded Skills
- **Source**: C:\Users\HPZBook\.gemini\config\skills\code-quality\SKILL.md
  - **Local copy**: .agents/worker_r1_to_r5/skills/code-quality.md
  - **Core methodology**: Strict verification, no guessing, robust error handling, race condition prevention.
- **Source**: C:\Users\HPZBook\.gemini\config\skills\zero-bug-verification\SKILL.md
  - **Local copy**: .agents/worker_r1_to_r5/skills/zero-bug-verification.md
  - **Core methodology**: Multi-agent verification, V8 syntax checking, dual-context isolation, F5 resilience, layout verification.
