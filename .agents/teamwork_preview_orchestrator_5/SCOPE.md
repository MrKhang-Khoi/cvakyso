# SCOPE & ARCHITECTURE SPECIFICATION

## Project: EduSign VGCA Ký Số — R1-R5 5 Yêu Cầu Nghiệp Vụ & Công Thái Học
- **Orchestrator**: `teamwork_preview_orchestrator_5`
- **Working Dir**: `c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\teamwork_preview_orchestrator_5`

## 1. Feature Inventory
| # | Feature | Description | Milestone |
|---|---------|-------------|-----------|
| 1 | Modal User Ngang 2 Cột (R1) | Tái cấu trúc `#modalUser` thành 2 cột `grid-cols-1 md:grid-cols-2 gap-4`, max-w-4xl, <= 85vh, không cuộn trên Desktop/Laptop | M1 |
| 2 | Nút Tạo PIN Ngẫu Nhiên (R1) | Nút bấm gợi ý/tạo mã PIN ngẫu nhiên 4 số trong `#modalUser` | M1 |
| 3 | Sửa Lỗi Đồng Bộ Mã PIN (R2) | Admin cập nhật PIN -> đồng bộ `appState.users`, Firebase RTDB (`users/{id}/pinCode`), và `appState.currentUser` nếu trùng user | M2 |
| 4 | Đọc PIN Tươi khi Mở Modal (R2) | `openModalUserProfile()` đọc dữ liệu mới nhất từ `appState.users` hoặc Firebase RTDB thay vì snapshot cũ `localStorage` | M2 |
| 5 | Bảo Mật Zalo Bot Không Bypass (R3) | Bỏ hoàn toàn gợi ý 4 số cuối SĐT; `handleSecurePhoneMapping` bắt buộc `secretPin === storedPin` | M2 |
| 6 | Cập Nhật Hướng Dẫn Zalo trên Web (R3) | `#modalUserProfile` xóa bỏ dòng gợi ý 4 số cuối SĐT | M2 |
| 7 | Dọn Dẹp 17 Hồ Sơ Rác (R4) | Reset `data/documents.json` sạch, dọn dẹp Firebase RTDB `documents/`, localStorage | M3 |
| 8 | Tải File Excel Mẫu .xlsx (R5) | Nút "Tải file mẫu Excel" tạo file .xlsx chuẩn 11 cột (STT, Họ tên, Username, Pass, Tổ, Chức vụ, CCCD, Email, SĐT, PIN, Loại CKS) | M4 |
| 9 | Nhập Giáo Viên Từ Excel (R5) | Nút & Modal "Nhập từ Excel" dùng SheetJS, preview số lượng, kiểm tra trùng lặp, lưu `appState.users`, đồng bộ Firebase & Sheet | M4 |
| 10 | 3-Mirror Consistency | Đồng bộ tuyệt đối giữa `js/app.js`, `public/js/app.js`, `docs/js/app.js` và các file `index.html` | M1-M4 |
| 11 | Playwright E2E & Visual Verification | Kiểm thử đa độ phân giải 1920x1080 và 1366x768, <= 85vh, 0 overflow, F12 sạch | M5 |
| 12 | Forensic Integrity Audit & Deploy | Independent Reviewer, Challenger, Forensic Auditor, git commit & push | M5 |

## 2. Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Tái Thiết Kế Modal User Ngang 2 Cột (R1) | Sửa `index.html` (và 2 mirror), CSS, bố cục 2 cột, <= 85vh, nút tạo PIN | none | PLANNED |
| M2 | Sửa Lỗi Đồng Bộ PIN & Bảo Mật Zalo (R2, R3) | Sửa `js/app.js` (và 2 mirror), `google-apps-script-zalo-edusign.js` | none | PLANNED |
| M3 | Dọn Dẹp Dữ Liệu Rác 17 Hồ Sơ (R4) | Reset `data/documents.json`, script dọn dẹp Firebase RTDB, localStorage | none | PLANNED |
| M4 | Tải File Excel Mẫu & Nhập Excel (R5) | Tích hợp SheetJS (XLSX), modal upload, preview, validate trùng lặp, sync Firebase & Sheet | M1 | PLANNED |
| M5 | Kiểm Thử E2E, Review, Challenger, Audit & Push | Playwright E2E đa độ phân giải, Reviewer, Challenger, Forensic Auditor, Git commit & push | M1, M2, M3, M4 | PLANNED |
