# DISPATCH ASSIGNMENT — Challenger 2 (Playwright E2E Multi-Resolution & Ergonomics Challenger)

- Working Directory: `c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\challenger_2`
- Original Request: `c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\ORIGINAL_REQUEST.md`
- Worker Handoff: `c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\worker_r1_to_r5\handoff.md`

## Objectives:
1. Viết và chạy kịch bản Playwright E2E thực tế trên trình duyệt Chromium headless/headed:
   - Đo đạc kích thước `#modalUser` trên Desktop 1920x1080 và Laptop 1366x768.
   - Xác minh chiều cao modal `<= 85vh` (ví dụ trên 1366x768: `clientHeight <= 768 * 0.85 = 652.8px`).
   - Kiểm tra nút "Lưu thông tin" và "Hủy" có nằm trong viewport nhìn thấy (isIntersecting / boundingBox nằm trong viewport) mà KHÔNG CẦN cuộn trang / cuộn modal.
   - Kiểm tra mở modal "Thông tin cá nhân & Zalo" (`#modalUserProfile`): Không còn gợi ý 4 số cuối SĐT.
   - Kiểm tra giao diện Quản lý Giáo viên: Nút "Tải file mẫu Excel" và "Nhập từ Excel" xuất hiện đầy đủ, click mở `#modalImportTeacherExcel`.
   - Kiểm tra F12 Console sạch 100% (0 error, 0 unhandled promise rejection).
   - Chụp ảnh màn hình minh chứng lưu tại `tests/screenshots/` (nếu chạy playwright).
2. Đưa ra verdict trong `handoff.md` (CONFIRM_CORRECTNESS hoặc REJECT).
