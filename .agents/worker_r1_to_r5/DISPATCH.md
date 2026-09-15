## 2026-09-15T06:43:37Z
You are the lead developer/worker (`teamwork_preview_worker`) for the EduSign VGCA project.
Your working directory is: `c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\worker_r1_to_r5`.
You must maintain `progress.md` and write your final report to `handoff.md` in your working directory.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Please read the authoritative requirements in `c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\ORIGINAL_REQUEST.md` (lines 240-316).

Here is your detailed implementation assignment for 5 requirements:

### R1. Tái Thiết Kế Modal Sửa/Thêm Giáo Viên (`#modalUser` - Hình 1) Dạng Ngang 2 Cột Gọn Gàng
- Bố cục 2 cột ngang (`grid grid-cols-1 md:grid-cols-2 gap-4`), độ rộng `max-w-4xl`.
- Cột trái (Thông tin tài khoản & Định danh): Họ tên, Tên đăng nhập, Mật khẩu, Tổ chuyên môn & Chức vụ, Số CCCD, Email công vụ.
- Cột phải (Bảo mật Zalo & Phân quyền): Số điện thoại, Mã PIN Zalo Bot cá nhân (kèm nút tạo PIN ngẫu nhiên/gợi ý 4 số), Loại chữ ký số (SmartCA / USB Token), Khối phân quyền gửi Word & Ủy quyền đóng dấu mộc đỏ.
- Chiều cao modal `<= 85vh`, `overflow-y-auto` nếu màn hình quá nhỏ, nhưng trên Desktop (1920x1080) và Laptop (1366x768) form vừa vặn trọn vẹn, người dùng thấy ngay nút Lưu & Hủy mà KHÔNG CẦN cuộn chuột.
- Cập nhật trên: `index.html`, `public/index.html`, `docs/index.html`.

### R2. Sửa Triệt Để Lỗi Đồng Bộ Mã PIN từ Admin sang Giao Diện Giáo Viên (Hình 2)
- Khi Admin sửa PIN trong `#modalUser` và bấm Lưu (`handleSaveUser`):
  * Cập nhật đồng thời vào `appState.users`
  * Đồng bộ lên Firebase RTDB (`users/{id}/pinCode` hoặc `users/{id}`)
  * Cập nhật ngay vào `appState.currentUser` nếu user được sửa chính là tài khoản đang đăng nhập (hoặc nếu là chính mình)
  * Lưu vào `localStorage`
- Khi giáo viên mở modal "Thông tin cá nhân & Zalo" (`openModalUserProfile`):
  * Đọc dữ liệu mới nhất từ `appState.users.find(u => u.id === currentUser.id)` hoặc Firebase RTDB thay vì chỉ đọc bản snapshot cũ trong `localStorage`.
  * Đảm bảo hiển thị đúng mã PIN vừa cập nhật (ví dụ: `Cva@` hoặc mã mới), không còn lưu giữ giá trị cũ `0007`.
- Cập nhật nhất quán trên cả 3 file: `js/app.js`, `public/js/app.js`, `docs/js/app.js`.

### R3. Bảo Mật Cú Pháp Zalo Bot: Bỏ Hoàn Toàn Gợi Ý 4 Số Cuối SĐT (Hình 3)
- Trong `google-apps-script-zalo-edusign.js`:
  * Xóa bỏ hoàn toàn gợi ý lấy 4 số cuối SĐT. Tin nhắn phản hồi bảo mật chỉ hướng dẫn cú pháp chuẩn:
    `🔐 BẢO VỆ ĐỊNH DANH GIÁO VIÊN:`
    `Để bảo vệ quyền riêng tư hồ sơ giáo án, Thầy/Cô vui lòng nhắn cú pháp kèm Mã PIN EduSign cá nhân:`
    `👉 Cú pháp: LK [SốĐiệnThoại] [MãPIN]`
    `📌 Thầy/Cô xem Mã PIN tại mục 'Thông tin cá nhân & Zalo' trên trang web EduSign của trường.`
  * Trong hàm `handleSecurePhoneMapping`: Bắt buộc đối soát khớp chính xác `secretPin === storedPin` (sau khi trim và normalize), loại bỏ hoàn toàn fallback bypass bằng 4 số cuối SĐT.
- Cập nhật `#modalUserProfile` trên giao diện web (`index.html`, `public/index.html`, `docs/index.html`): Xóa bỏ dòng gợi ý 4 số cuối SĐT.

### R4. Dọn Dẹp Xóa Sạch Dữ Liệu Rác Thử Nghiệm (Hình 4)
- Trong `data/documents.json`: Xóa sạch toàn bộ 17 văn bản rác thử nghiệm, reset về mảng rỗng `[]` hoặc danh sách mẫu chính thức của trường.
- Trong `js/app.js` (và 2 mirror): Cung cấp hàm hoặc script dọn dẹp Firebase RTDB (`documents/`) và dọn dẹp `localStorage` tương ứng nếu có cache rác.
- Tạo script dọn dẹp `scripts/clean_garbage_documents.js` để xóa triệt để trên cả local file, cache và Firebase RTDB nếu có cấu hình.

### R5. Thêm Tính Năng Tải File Excel Mẫu & Nhập Danh Sách Giáo Viên Từ Excel
- Thư viện: Đảm bảo có thư viện SheetJS / XLSX (ví dụ: CDN `https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js` hoặc file local vendor đã include trong `index.html`, `public/index.html`, `docs/index.html`).
- Nút 1 trong giao diện Quản trị Giáo viên: "Tải file mẫu Excel"
  * Khi bấm: Tự động tạo và tải xuống file `.xlsx` chuẩn với các cột:
    STT, Họ và Tên, Tên đăng nhập, Mật khẩu, Tổ Chuyên Môn, Chức vụ, Số CCCD, Email Công Vụ, Số Điện Thoại, Mã PIN, Loại chữ ký (SmartCA/USB).
    Có sẵn 2-3 dòng dữ liệu mẫu chuẩn của giáo viên trường Chu Văn An.
- Nút 2 trong giao diện Quản trị Giáo viên: "Nhập từ Excel"
  * Khi bấm: Mở `#modalImportTeacherExcel` (giao diện đẹp, chuẩn công thái học) cho phép chọn file `.xlsx` / `.csv`.
  * Tự động đọc dữ liệu bằng SheetJS, hiển thị bảng xem trước (Preview) số lượng tài khoản hợp lệ, phát hiện trùng lặp username/SĐT/CCCD với danh sách hiện tại.
  * Nút "Xác nhận nhập": Thêm các giáo viên hợp lệ vào `appState.users`, lưu `localStorage`, đồng bộ lên Firebase RTDB và gọi Webhook đồng bộ lên Google Sheet Danh bạ GV.
  * Hiển thị Toast thông báo kết quả chi tiết (ví dụ: "Đã nhập thành công X giáo viên mới!").

### Quy Tắc Đồng Bộ Gương 3 File (Mirror Consistency):
- Bắt buộc đồng bộ 100% nội dung giữa:
  * `index.html` <-> `public/index.html` <-> `docs/index.html`
  * `js/app.js` <-> `public/js/app.js` <-> `docs/js/app.js`
- Chạy `tests/test_verify_patches.js` hoặc script đối soát SHA256 để chứng minh 3 file khớp nhau 100%.

### Kiểm Tra & Nghiệm Thu:
- Chạy các test suites hiện có: `node tests/test_zalo_security_and_logic_audit.js`, `node tests/test_verify_patches.js`.
- Viết test mới nếu cần để xác minh tính năng Excel import/export và PIN sync.
- Khi hoàn tất, ghi lại toàn bộ thay đổi vào `c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\worker_r1_to_r5\handoff.md` và dùng `send_message` gửi báo cáo cho Orchestrator.
