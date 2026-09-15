# ORCHESTRATION PLAN

## Overview
Triển khai trọn gói 5 yêu cầu R1-R5 theo mô hình Multi-Agent Team:
1. **Agent 1: Developer/Worker** (`teamwork_preview_worker`):
   - Triển khai M1: Tái thiết kế Modal User `#modalUser` thành 2 cột ngang, <= 85vh, không cuộn, nút tạo PIN ngẫu nhiên.
   - Triển khai M2: Sửa triệt để đồng bộ PIN từ Admin sang GV trong `openModalUserProfile` và `handleSaveUser`, xóa bỏ hoàn toàn fallback 4 số cuối SĐT trong `google-apps-script-zalo-edusign.js` và modal web.
   - Triển khai M3: Dọn dẹp sạch sẽ 17 văn bản rác trong `data/documents.json`, tạo script dọn dẹp Firebase RTDB và localStorage.
   - Triển khai M4: Thêm tính năng Tải file Excel mẫu .xlsx và Modal Nhập danh sách giáo viên từ Excel (sử dụng SheetJS / XLSX).
   - Bảo đảm 100% nhất quán trên 3 file mirror: `index.html` <-> `public/index.html` <-> `docs/index.html` và `js/app.js` <-> `public/js/app.js` <-> `docs/js/app.js`.
2. **Agent 2: Independent Tester** (`teamwork_preview_challenger` / `teamwork_preview_reviewer`):
   - Viết và chạy kịch bản Playwright E2E đa độ phân giải (1920x1080 và 1366x768).
   - Đo chiều cao modal <= 85vh, kiểm tra không có bẫy tràn ngang, đo F12 console sạch 0 error.
   - Test luồng đồng bộ PIN: Admin sửa PIN -> GV mở modal thấy ngay PIN mới.
   - Test Zalo Bot: Thử cú pháp sai PIN hoặc 4 số cuối -> bị từ chối 100%.
   - Test Import Excel: Tải file mẫu, đọc file mẫu, nhập vào hệ thống, kiểm tra preview và lưu vào user list.
3. **Agent 3: Cross-Checker & Forensic Auditor** (`teamwork_preview_auditor`):
   - Kiểm toán toàn vẹn logic (Zero-Cheating, Zero-Hardcoding).
   - Đối soát SHA256 các file mirror.
   - Xác nhận sạch rác và sẵn sàng release.

## Execution Sequence
- Phase 1: Dispatch Worker to implement R1-R5.
- Phase 2: Dispatch Reviewer and Challenger in parallel.
- Phase 3: Dispatch Forensic Auditor.
- Phase 4: Gate Evaluation, Documentation & Git Push.
