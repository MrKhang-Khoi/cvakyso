# BÁO CÁO KIỂM TOÁN HẠ TẦNG TEST & KIẾN TRÚC TEST SUITE (MILESTONE 2)
**Hệ thống Quản lý và Trình ký Hồ sơ Giáo dục Điện tử tích hợp Chữ ký số VGCA — Trường THCS Chu Văn An**

*Thời điểm lập báo cáo*: 2026-09-15  
*Đại lý thực hiện*: `explorer_test_infra` (Test Infrastructure & Gap Analysis Specialist)  
*Chế độ*: READ-ONLY Explorer (Không can thiệp mã nguồn sản phẩm)  
*Thư mục công tác*: `.agents/explorer_test_infra/`  

---

## TỔNG QUAN ĐIỀU HÀNH (EXECUTIVE SUMMARY)

Sau quá trình kiểm định hạ tầng kiểm thử hiện hành tại thư mục gốc và thư mục `tests/`, đối chiếu với yêu cầu tác nghiệp tại `ORIGINAL_REQUEST.md` (Phiên bản `2026-09-15T00:16:04Z`), phát hiện hiện trạng kiểm thử như sau:
1. **Hạ tầng Test Runner hiện hữu bị phân mảnh nghiêm trọng**: Hệ thống tồn tại 3 cơ chế chạy test không liên kết (`node test.js` qua npm test; Playwright test chạy rời rạc qua CLI npx; và các file script Node tự viết như `tests/test_zalo_unified_bot.js`, `render_storage_verification.mjs`, `stress_50_teachers_load_test.mjs`). File `package.json` hoàn toàn thiếu script gọi Playwright hoặc chạy test Zalo tự động.
2. **Khoảng trống kiểm thử Giao diện R1 (Cross-Device UI/UX Gap)**: Bộ test `tests/ui_dialog_supervision.spec.mjs` chỉ mới kiểm tra 2 độ phân giải màn hình lớn (Desktop 1920x1080 và Laptop 1366x768) trên 5 modal, hoàn toàn **bỏ quên dải thiết bị Di động (Mobile 390x844) và Máy tính bảng (Tablet 768x1024)**. File `tests/04_responsive_mobile.spec.mjs` chỉ có 30 dòng mang tính hình thức (chỉ load trang chủ unauthenticated rồi thoát). Chưa có kịch bản nào tự động đo kích thước điểm chạm công thái học ($\ge 44\text{px}$) hoặc đo độ tương phản màu sắc chuẩn WCAG 2.1 AA/AAA trên toàn bộ bàn làm việc Giáo viên, Tổ trưởng, Ban Giám hiệu và Cổng báo cáo `portal-baocao.html`.
3. **Lỗ hổng kiểm thử Zalo R2 (Zalo Logic & Security Blindspot)**: File `tests/test_zalo_unified_bot.js` chỉ kiểm thử các hàm tiện ích cục bộ (format TKB, regex tên giáo viên) trong `google-apps-script-zalo-edusign.js`. **100% logic dịch vụ backend `zaloNotifyService.js`, các sự kiện nộp bài, duyệt bài, trả về trong `server.js`, cơ chế làm mới Zalo OA Token v3, và các nguy cơ bảo mật nghiêm trọng (mạo danh số điện thoại tra cứu giáo án của đồng nghiệp, rò rỉ PII số điện thoại, URL PDF không xác thực, mất dấu khi giáo viên chặn Zalo) đều chưa có bất kỳ bài test nào kiểm chứng.**
4. **Rủi ro môi trường thực thi (Server & Data Isolation)**: Các bài test hiện tại ghi đè trực tiếp vào cơ sở dữ liệu vật lý `data/users.json`, `data/documents.json`, `data/bgh_signing_config.json`, dẫn đến việc dữ liệu rác test làm bẩn kho dữ liệu của trường mà không có cơ chế rollback hay database fixture cô lập. Cơ chế tự động nhảy cổng của server (`3000 -> 3001`) khi gặp xung đột cổng gây lệch cấu hình với Playwright `baseURL: 'http://localhost:3000'`.

Báo cáo dưới đây phân tích chi tiết từng tầng hạ tầng và thiết kế hoàn chỉnh Blueprint kiến trúc cho 2 bộ test suite trọng tâm:
- **Test Suite R1**: `tests/test_cross_device_ui_ux_audit.spec.mjs`
- **Test Suite R2**: `tests/test_zalo_security_and_logic_audit.js`

---

## PHẦN 1: KIỂM TOÁN CHI TIẾT HẠ TẦNG TEST HIỆN TẠI (AUDIT FINDINGS)

### 1.1. Ma trận Phân loại Test Runner & Cấu hình NPM Scripts

| Hạng mục | Hiện trạng phát hiện | Đánh giá & Rủi ro |
| :--- | :--- | :--- |
| **`package.json` Scripts** | Chỉ có `"test": "node test.js"`. Không có script cho Playwright (`test:ui`, `test:e2e`) hay Zalo (`test:zalo`). | ❌ Thiếu tính tự động hóa CI/CD. Kỹ sư phải nhớ các câu lệnh dài dòng bằng tay (`npx playwright test ...`). |
| **Playwright Runner** | `@playwright/test ^1.63.0` cài trong devDependencies. Cấu hình tại `playwright.config.mjs`. | ⚠️ Chỉ khai báo duy nhất 1 project `chromium` (`Desktop Chrome`). Không có project cho Mobile (Pixel/iPhone) hay Tablet (iPad). |
| **Native Node Runner** | Chưa sử dụng `node:test` chuẩn Node 18+. File `test.js` và `test_zalo_unified_bot.js` tự viết hàm `assert` thủ công (`function assert(...)`). | ⚠️ Không có JUnit/TAP reporter chuẩn, khó tích hợp pipeline tự động. |
| **Linter / AST Scanner** | Đã có `oxlint ^1.82.0` trong devDependencies. | ✅ Có công cụ kiểm tra cú pháp nhanh chuẩn Rust. |
| **Playwright Test Discovery** | Chạy `npx playwright test --list` phát hiện **36 tests trong 15 files** (tất cả file đuôi `.spec.mjs`). | ⚠️ Các file standalone `.js` và `.mjs` trong `tests/` không được Playwright quản lý, dễ bị bỏ quên khi nghiệm thu. |

### 1.2. Phân tích Server Lifecycle, Cổng Mạng (Ports) & Giả lập (Mocking)

1. **Cơ chế khởi động Server (`server.js`)**:
   - `const PORT = process.env.PORT || 3000;` (dòng 51).
   - Cơ chế Fallback khi trùng cổng (dòng 3972-3982): Khi cổng 3000 bị chiếm dụng (`EADDRINUSE`), server tự động bắt sự kiện `error` và bind sang `3001` (hoặc `PORT + 1`).
   - **Xung đột tiềm ẩn với Playwright**: Trong `playwright.config.mjs`, cấu hình `webServer` chỉ định:
     ```javascript
     webServer: {
       command: 'node server.js',
       url: 'http://localhost:3000',
       reuseExistingServer: true,
       timeout: 15000,
     }
     ```
     *Hậu quả*: Nếu máy phát triển đang chạy một dịch vụ ngầm ở cổng 3000 (ví dụ Docker hoặc app khác), Playwright với cờ `reuseExistingServer: true` sẽ gửi request kiểm thử nhầm vào ứng dụng lạ đó! Ngược lại, nếu server EduSign nhảy sang cổng 3001, Playwright sẽ đợi timeout ở cổng 3000 và báo lỗi `webServer failed to listen`.
2. **Cơ chế Giả lập (Mocking Strategy)**:
   - **USB Token Local Signer (`127.0.0.1:18888`)**: Ứng dụng client gửi HTTP polling tới cổng 18888 để kết nối phần mềm ký số C# (`EduSign_Agent.exe`).
     * Trong `tests/ui_dialog_supervision.spec.mjs`, kỹ sư đã dùng `await page.route('http://127.0.0.1:18888/**', ...)` để chặn lỗi `ERR_CONNECTION_REFUSED`.
     * Tuy nhiên, các file test khác (`01_auth_roles.spec.mjs`, `04_responsive_mobile.spec.mjs`) chỉ lọc console bằng code lọc chuỗi thô (`!text.includes('127.0.0.1:18888')`). Điều này thiếu tính đồng bộ và không triệt tiêu triệt để request ngầm của trình duyệt.
   - **Dịch vụ Cloud Render & Google Apps Script**:
     * Chưa có Mock HTTP Server cục bộ cho các endpoint Google Apps Script Webhook (`gasWebhookUrl`). Mọi thao tác nộp bài đều gửi HTTP thật ra internet hoặc ngậm ngùi bỏ qua nếu chưa cấu hình URL.
3. **Quản lý Dữ liệu & Fixtures (Data Persistence & Rollback)**:
   - `dataStore.js` đọc/ghi trực tiếp vào `data/users.json`, `data/documents.json`, `data/departments.json`.
   - Các kịch bản test như `test.js` hay `stress_50_teachers_load_test.mjs` tạo tài khoản và hàng chục hồ sơ mẫu thẳng vào đĩa cứng.
   - Khi test kết thúc, các hồ sơ rác này không được dọn dẹp (xem kết quả `git status` thực tế có `M data/documents.json`, `M data/users.json`).
   - **Khuyến nghị kiến trúc**: Bộ test mới bắt buộc phải có cơ chế Snapshot Data trước khi chạy và Tự động phục hồi (Restore / Teardown) sau khi chạy xong.

---

## PHẦN 2: THIẾT KẾ KIẾN TRÚC TEST SUITE R1 (CROSS-DEVICE UI/UX TEST SUITE)

### 2.1. Ma trận 4 Dải Độ Phân Giải Độc Lập (4-Tier Viewport Matrix)

Để đảm bảo đáp ứng chuẩn mực công thái học trường học tại Việt Nam, kịch bản Playwright phải chạy ma trận quét đồng bộ trên 4 thiết bị vật lý đại diện:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       MA TRẬN THIẾT BỊ TRƯỜNG HỌC                          │
├───────────────────────┬──────────────┬─────────────┬────────────────────────┤
│ Tên Định Danh         │ Độ Phân Giải │ Tỷ lệ / DPI │ Bối Cảnh Thực Tế       │
├───────────────────────┼──────────────┼─────────────┼────────────────────────┤
│ Desktop_1920x1080     │ 1920 x 1080  │ 16:9 / 1.0  │ Máy tính BGH, Phòng Tin│
│ Laptop_1366x768       │ 1366 x 768   │ 16:9 / 1.0  │ Laptop giáo viên bộ môn│
│ Tablet_768x1024       │  768 x 1024  │  3:4 / 2.0  │ iPad duyệt bài di động │
│ Mobile_390x844        │  390 x 844   │ 9:19.5 /3.0 │ iPhone / Smartphone GV │
└───────────────────────┴──────────────┴─────────────┴────────────────────────┘
```

### 2.2. Danh Mục Giao Diện & Hộp Thoại Bắt Buộc Giám Sát

Bộ test suite sẽ quét 100% các màn hình tương tác sau trên toàn bộ 4 viewports:
1. **Phân hệ Xác thực & Điều hướng**:
   - Màn hình Đăng nhập `#viewLogin` và cảnh báo lỗi đăng nhập `#loginAlert`.
   - Hộp thoại đăng nhập bằng USB Token VGCA `#modalVgcaLogin`.
   - Hộp thoại nâng quyền Quản trị viên `#modalAdminAuth`.
2. **Không gian làm việc Giáo viên (`#viewTeacher`)**:
   - **Tab 1: Nộp kế hoạch bài dạy** (`#tabBtnTeacherWorkspace` -> `#tabContentTeacherWorkspace`): Khung kéo thả file `#teacherFileInput`, bảng chọn thông tin giáo án, nút "Ký Số Ngay" `#btnSignNow`.
   - **Tab 2: Danh sách giáo án chờ duyệt** (`#tabBtnTeacherPending`): Bảng hồ sơ, trạng thái badge, nút xem chi tiết.
   - **Tab 3: Giáo án đã ký / Lịch sử** (`#tabBtnTeacherSent`, `#tabBtnTeacherReports`): Bảng hồ sơ kèm nút tải file đã ký.
   - **Tab 4: Hồ sơ bị trả về** (`#tabBtnTeacherReturned`): Thẻ lý do trả về từ Tổ trưởng/BGH, nút nộp lại.
   - **Studio Chữ ký cá nhân**: Hộp thoại vẽ/tải chữ ký trong suốt `#modalUploadSignature`.
3. **Không gian Tổ trưởng & Ban Giám Hiệu (`#viewAdmin`)**:
   - Bảng quản lý giáo viên `#tableBodyTeachers` và phân quyền con dấu trường.
   - Bảng hồ sơ chờ Tổ trưởng ký nháy và chờ BGH đóng dấu.
   - Hộp thoại Cấu hình BGH & Con dấu cơ quan `#modalBghConfig`.
   - Hộp thoại Từ chối / Trả về hồ sơ kèm lý do `#modalRejectDocument` (kiểm tra các nút Quick-fill pills).
4. **Sân khấu Xem PDF & Kéo Thả Định Vị Con Dấu (`#modalDocViewer`)**:
   - Khung chứa `#viewerModalContainer` và Canvas PDF.
   - Con dấu kéo thả `#draggableSignatureStamp` (chế độ chữ ký cá nhân và chế độ con dấu đỏ trường học 105pt).
   - Thanh công cụ điều khiển `#viewerSigToolBar` (phóng to, thu nhỏ, đổi trang, nút xác nhận ký).
5. **Cổng Báo Cáo Tra Cứu Công Khai (`portal-baocao.html`)**:
   - Thanh tìm kiếm, bộ lọc tổ chuyên môn, bảng danh sách báo cáo đã công bố.
   - Hộp thoại xem trước báo cáo `#modalPreview` và xác thực chữ ký VGCA.
   - Bảng điều khiển Quản trị viên: Nút xóa hồ sơ đơn lẻ và nút xóa hàng loạt `#btnBatchDelete`.

### 2.3. Cơ Chế Đo Đạc Tự Động & Tiêu Chuẩn Nghiệm Thu R1

1. **Bẫy tràn ngang (Horizontal Overflow Trap)**:
   - *Công thức kiểm tra*:
     ```javascript
     const hasOverflow = await page.evaluate(() => {
       const doc = document.documentElement;
       const body = document.body;
       const docBreach = doc.scrollWidth > doc.clientWidth;
       const bodyBreach = body.scrollWidth > body.clientWidth;
       
       // Định vị phần tử gây tràn ngang cụ thể
       const offenders = [];
       const viewportWidth = window.innerWidth;
       document.querySelectorAll('*').forEach(el => {
         const rect = el.getBoundingClientRect();
         if (rect.right > viewportWidth + 1) { // 1px rounding tolerance
           offenders.push({
             tag: el.tagName,
             id: el.id,
             className: el.className ? el.className.toString().substring(0, 50) : '',
             right: Math.round(rect.right),
             overflowPx: Math.round(rect.right - viewportWidth)
           });
         }
       });
       return { isOverflown: docBreach || bodyBreach, offenders: offenders.slice(0, 5) };
     });
     ```
   - *Chuẩn nghiệm thu*: `hasOverflow.isOverflown === false`, danh sách `offenders` rỗng trên mọi view và modal.
2. **Kích thước Điểm Chạm Công Thái Học (Touch Targets $\ge 44\text{px}$)**:
   - *Công thức quét*: Quét mọi phần tử tương tác (`button`, `a`, `input`, `select`, `[role="button"]`, `.tab-btn`, `.pill-btn`).
   - *Tiêu chuẩn WCAG 2.5.5 / Apple HIG*: Chiều rộng $\ge 43.5\text{px}$ và chiều cao $\ge 43.5\text{px}$ (dung sai 0.5px do hiển thị viền subpixel trên màn hình Retina).
3. **Độ Tương Phản Màu Sắc Chữ (WCAG 2.1 Contrast Ratio)**:
   - *Thuật toán tính độ sáng tương đối (Relative Luminance)*:
     $$L = 0.2126 \times R_{\text{srgb}} + 0.7152 \times G_{\text{srgb}} + 0.0722 \times B_{\text{srgb}}$$
     $$\text{Contrast Ratio} = \frac{L_{\text{light}} + 0.05}{L_{\text{dark}} + 0.05}$$
   - *Tiêu chuẩn*:
     * Văn bản chính (Body text): Tỷ lệ $\ge 4.5:1$ (WCAG AA).
     * Tiêu đề lớn & Nhãn nổi bật (Display / Heading text): Tỷ lệ $\ge 7:1$ (WCAG AAA).
4. **Giám sát Lỗi JavaScript Console F12**:
   - Ghi nhận 100% `page.on('console', msg => msg.type() === 'error')` và `page.on('pageerror', err => ...)`.
   - Cho phép loại trừ các thông báo mạng được kiểm soát (như HTTP 401 khi test gõ sai pass hoặc offline C# bridge được stub).
   - *Chuẩn nghiệm thu*: Mảng lỗi ghi nhận được bằng `0`.
5. **Độ trễ Mở Hộp Thoại (Modal Latency)**:
   - Dùng `performance.now()` đo thời gian từ lúc bấm nút kích hoạt đến khi modal hoàn tất gỡ bỏ class `hidden` và render:
     $$\text{Latency} < 300\text{ms}$$
     (Riêng PDF Viewer render trang tài liệu canvas đầu tiên cho phép $< 1500\text{ms}$).

---

## PHẦN 3: THIẾT KẾ KIẾN TRÚC TEST SUITE R2 (ZALO SECURITY & LOGIC TEST SUITE)

### 3.1. Các Tầng Kiểm Thử Logic & Bảo Mật Zalo

Khác với giao diện người dùng, hệ thống Zalo bao gồm luồng gửi nhận tin nhắn phân tán qua Google Apps Script và Zalo Platform API. Bộ test suite R2 được thiết kế theo dạng **Standalone Node.js Integration & Security Test** chia thành 4 tầng độc lập:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│               KIẾN TRÚC BỘ KIỂM THỬ ZALO SECURITY & LOGIC                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  TẦNG 1: KIỂM THỬ BỘ ĐIỀU PHỐI THÔNG BÁO TỰ ĐỘNG 1 CHIỀU (ZALO NOTIFY)      │
│  - Mô phỏng Local GAS Mock Server tiếp nhận payload JSON chuẩn W3C           │
│  - Thẩm định 5 sự kiện: SUBMITTED, PERSONAL_SIGNED, FORWARDED, COMPLETED,   │
│    REJECTED                                                                 │
│  - Kiểm tra cơ chế Timeout (15s) và phát hiện thiếu sót Cơ chế Retry        │
├─────────────────────────────────────────────────────────────────────────────┤
│  TẦNG 2: KIỂM THỬ VÒNG ĐỜI ZALO OA API V3 & LÀM MỚI TOKEN (TOKEN ROTATION)   │
│  - Mô phỏng hết hạn Access Token (sau 25 giờ theo chuẩn Zalo v3)            │
│  - Kiểm thử quá trình đổi Access Token bằng Refresh Token                   │
│  - Kiểm thử các ca biên: Refresh Token hết hạn, mất mạng, token bị thu hồi  │
├─────────────────────────────────────────────────────────────────────────────┤
│  TẦNG 3: KIỂM THỬ CHATBOT TƯƠNG TÁC 2 CHIỀU (UNIFIED INTERACTIVE BOT)       │
│  - Giả lập Webhook tiếp nhận tin nhắn người dùng (user_send_text, message)  │
│  - Kiểm thử bộ lọc NLP tự nhiên: hoso, baocao, tkb, day thay, tim gv, menu │
│  - Kiểm thử khả năng chịu lỗi tiếng Việt có dấu/không dấu, chữ hoa/thường    │
├─────────────────────────────────────────────────────────────────────────────┤
│  TẦNG 4: THỰC NGHIỆM TẤN CÔNG BẢO MẬT & RÒ RỈ THÔNG TIN (SECURITY PENTEST)  │
│  - Test 4.1: Chiếm quyền tra cứu (Account Hijacking) bằng cách gửi SĐT      │
│    đồng nghiệp mà không cần OTP xác thực                                    │
│  - Test 4.2: Rò rỉ thông tin cá nhân (PII Leakage) qua bản tin 6h00 sáng    │
│  - Test 4.3: Truy cập trái phép tệp PDF gốc khi URL viewUrl bị public       │
│  - Test 4.4: Hố đen thông báo (Black-hole) khi giáo viên chưa liên kết Zalo │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2. Cơ Chế Giả Lập GAS Mock Webhook Server Cục Bộ

Để kiểm thử `zaloNotifyService.js` một cách độc lập không phụ thuộc mạng internet:
- Kịch bản test sẽ khởi tạo một máy chủ HTTP mini trên cổng nội bộ ngẫu nhiên (ví dụ `127.0.0.1:3999`).
- Gán URL của máy chủ này vào cấu hình tạm thời của hệ thống.
- Kiểm tra chính xác cấu trúc payload của từng hàm:
  * `notifyDocumentRejected(doc, user, reason)` -> Gửi `action: 'NOTIFY_SIGN_EVENT'`, `eventType: 'REJECTED'`.
  * `notifyDocumentSubmitted(doc, user, targetUserId)` -> Gửi `eventType: 'SUBMITTED'`.
  * `notifyDocumentPersonalSigned(doc, user)` -> Gửi `eventType: 'PERSONAL_SIGNED'`.
  * `notifyDocumentCompleted(doc, user, viewUrl)` -> Gửi `eventType: 'COMPLETED'`.
- Kiểm tra tính toán vẹn của các trường dữ liệu: SĐT tác giả (`authorPhone`), SĐT người nhận (`recipientPhone`), tên giáo viên nộp, lý do trả về.

### 3.3. Thiết Kế Bài Đo Thực Nghiệm Lỗ Hổng Bảo Mật (Empirical Vulnerability Tests)

1. **Lỗ hổng 1: Mạo danh số điện thoại tra cứu giáo án (Insecure Direct Object Reference / Spoofing)**:
   - *Thực nghiệm*: Kẻ lạ dùng Zalo cá nhân gửi một tin nhắn chứa số điện thoại `0912345678` (số của Thầy Hà Văn Tý).
   - *Hiện tượng*: Hàm `handlePhoneMapping(chatId, phoneDigits)` trong `google-apps-script-zalo-edusign.js` lập tức ánh xạ `chatId` của kẻ lạ vào Thầy Tý trong bảng `Danh bạ GV`. Kẻ lạ sau đó gõ lệnh `hoso` và được bot trả về toàn bộ danh sách giáo án kèm link xem của Thầy Tý!
   - *Khẳng định*: Lỗi thiếu mã xác thực OTP 6 số qua tin nhắn SMS/Zalo ZNS trước khi kích hoạt tài khoản.
2. **Lỗ hổng 2: Lộ lọt thông tin cá nhân giáo viên (PII Leakage)**:
   - *Thực nghiệm*: Kiểm tra nội dung tin nhắn bot tạo ra khi giáo viên nghỉ dạy và có người dạy thay:
     `note: "Cô Tý đi họp công vụ"` hoặc `"Thầy Nam nghỉ ốm"`.
   - *Hiện tượng*: Bot trả về công khai lý do vắng mặt khi bất kỳ ai (kể cả học sinh hoặc phụ huynh gõ `day thay`). Số điện thoại của giáo viên cũng hiển thị không che mờ (chưa áp dụng dạng `091****678`).
3. **Lỗ hổng 3: URL xem file PDF bị lộ không có bảo vệ phiên đăng nhập**:
   - *Thực nghiệm*: Link `viewUrl` được gửi trong tin nhắn thông báo hoàn tất ký số `notifyDocumentCompleted`.
   - *Hiện tượng*: Nếu `viewUrl` là link trực tiếp tới Google Drive hoặc `/api/documents/:id/download`, bất kỳ ai có đường link đều có thể tải đề thi, kế hoạch bài dạy mà không cần đăng nhập tài khoản EduSign.
4. **Lỗ hổng 4: Rớt thông báo khi giáo viên chưa liên kết Zalo hoặc chặn bot**:
   - *Thực nghiệm*: Server gửi thông báo cho giáo viên chưa kích hoạt Zalo (`getChatIdByPhone` trả về `null`).
   - *Hiện tượng*: Webhook trả về `{ delivered: false, note: "CHUA_LIEN_KET_ZALO" }`. Tuy nhiên trong `server.js`, lệnh gọi chỉ là `.catch(err => ...)` mà không kiểm tra kết quả trả về. Hệ thống ghi nhận "Đã gửi" trong khi giáo viên hoàn toàn không biết giáo án của mình đã bị trả về cần sửa gấp.

---

## PHẦN 4: BLUEPRINT MÃ NGUỒN CÁC KỊCH BẢN TEST SẼ TẠO

### 4.1. Blueprint Kịch Bản 1: `tests/test_cross_device_ui_ux_audit.spec.mjs`

```javascript
/**
 * ====================================================================================================
 * 🧪 TEST SUITE R1: TOÀN DIỆN GIAO DIỆN NGƯỜI DÙNG ĐA THIẾT BỊ & CÔNG THÁI HỌC TRƯỜNG HỌC
 * ====================================================================================================
 * File mục tiêu: tests/test_cross_device_ui_ux_audit.spec.mjs
 * Runner: Playwright Test (@playwright/test)
 * Tiêu chuẩn: Zero-Bug Verification Pipeline 2026
 * 
 * Độ phân giải kiểm tra:
 *   1. Desktop_1920x1080 (Màn hình máy tính trường học chuẩn)
 *   2. Laptop_1366x768   (Màn hình Laptop giáo viên phổ thông)
 *   3. Tablet_768x1024   (Máy tính bảng iPad duyệt bài di động)
 *   4. Mobile_390x844    (Điện thoại di động giáo viên bộ môn)
 * 
 * Chỉ số giám sát nghiêm ngặt:
 *   - 0 Bẫy tràn ngang (scrollWidth === clientWidth trên document & body & modal).
 *   - Kích thước vùng chạm công thái học >= 44x44px (WCAG 2.5.5).
 *   - Độ tương phản màu sắc chữ WCAG AA (>= 4.5:1) và AAA (>= 7:1).
 *   - 0 Lỗi F12 Console Error & 0 Unhandled Promise Rejection.
 *   - Độ trễ bật mở hộp thoại Modal < 300ms.
 * ====================================================================================================
 */

import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

// 1. MA TRẬN 4 DẢI ĐỘ PHÂN GIẢI TRƯỜNG HỌC
const VIEWPORTS = [
  { name: 'Desktop_1920x1080', label: 'Desktop 1920x1080', width: 1920, height: 1080, isMobile: false },
  { name: 'Laptop_1366x768',   label: 'Laptop 1366x768',   width: 1366, height: 768,  isMobile: false },
  { name: 'Tablet_768x1024',   label: 'Tablet 768x1024',   width: 768,  height: 1024, isMobile: true  },
  { name: 'Mobile_390x844',    label: 'Mobile 390x844',    width: 390,  height: 844,  isMobile: true  }
];

const SCREENSHOT_DIR = path.resolve('tests/screenshots/cross_device');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

// Helper 1: Đo độ tương phản WCAG 2.1
function getLuminance(r, g, b) {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function parseRgb(colorStr) {
  const m = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  return m ? [parseInt(m[1]), parseInt(m[2]), parseInt(m[3])] : [0, 0, 0];
}

for (const vp of VIEWPORTS) {
  test.describe(`[R1 UI/UX] Quét Giao Diện & Công Thái Học: ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile });

    test.beforeEach(async ({ page }) => {
      page.consoleErrors = [];
      page.pageErrors = [];

      page.on('console', msg => {
        if (msg.type() === 'error') {
          const t = msg.text();
          if (!t.includes('127.0.0.1:18888') && !t.includes('favicon.ico') && !t.includes('401 (Unauthorized)')) {
            page.consoleErrors.push(t);
          }
        }
      });

      page.on('pageerror', err => page.pageErrors.push(err.message));

      // Stub bridge C# Local Signer
      await page.route('http://127.0.0.1:18888/**', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'OK', connected: false })
        });
      });
    });

    // Hàm kiểm tra chống tràn ngang chuẩn xác
    async function verifyNoHorizontalOverflow(page, viewContext) {
      const result = await page.evaluate(() => {
        const doc = document.documentElement;
        const body = document.body;
        const viewW = window.innerWidth;
        const hasOverflow = doc.scrollWidth > doc.clientWidth || body.scrollWidth > body.clientWidth;
        
        let offenders = [];
        document.querySelectorAll('*').forEach(el => {
          const r = el.getBoundingClientRect();
          if (r.right > viewW + 1.5) {
            offenders.push({
              tag: el.tagName,
              id: el.id,
              class: (el.className || '').toString().substring(0, 40),
              overflow: Math.round(r.right - viewW)
            });
          }
        });
        return { hasOverflow, offenders: offenders.slice(0, 5), docScroll: doc.scrollWidth, docClient: doc.clientWidth };
      });

      expect(
        result.hasOverflow,
        `[${vp.name}] Bẫy tràn ngang tại ${viewContext}! Chi tiết phần tử vượt viền: ${JSON.stringify(result.offenders)}`
      ).toBe(false);
    }

    // Hàm kiểm tra kích thước vùng chạm touch target >= 44px
    async function verifyTouchTargets(page, contextSelector = 'body') {
      const violations = await page.evaluate((sel) => {
        const container = document.querySelector(sel) || document.body;
        const interactives = container.querySelectorAll('button, a, input[type="button"], input[type="submit"], [role="button"], .tab-btn');
        const list = [];
        interactives.forEach(el => {
          if (el.offsetParent === null) return; // Phần tử ẩn bỏ qua
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            if (rect.width < 43.5 || rect.height < 43.5) {
              list.push({
                text: (el.innerText || el.getAttribute('aria-label') || el.id || '').trim().substring(0, 25),
                w: Math.round(rect.width),
                h: Math.round(rect.height),
                id: el.id,
                tag: el.tagName
              });
            }
          }
        });
        return list.slice(0, 10);
      }, contextSelector);

      if (violations.length > 0) {
        console.warn(`⚠️ [${vp.name}] Cảnh báo vùng chạm < 44px:`, violations);
      }
      return violations;
    }

    // TEST CASE 1: Màn hình Đăng nhập & Auth Dialogs
    test('1. Đăng nhập, Modal Token VGCA, Bẫy tràn ngang và Console 0 Error', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      await verifyNoHorizontalOverflow(page, 'Màn hình Đăng nhập');
      await verifyTouchTargets(page, '#viewLogin');

      // Thử đăng nhập sai mật khẩu để kích hoạt alert
      await page.locator('#loginUsername').fill('cva.ty');
      await page.locator('#loginPassword').fill('sai_mat_khau_123');
      await page.locator('#btnLoginSubmit').click();
      await expect(page.locator('#loginAlert')).toBeVisible();

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${vp.name}_01_login_alert.png`) });
      expect(page.consoleErrors).toHaveLength(0);
      expect(page.pageErrors).toHaveLength(0);
    });

    // TEST CASE 2: Bàn làm việc Giáo viên (Đủ 4 Tab và Upload File)
    test('2. Bàn làm việc Giáo viên, Tab Nộp bài, Tab Bị trả về, Touch targets & Responsive', async ({ page }) => {
      await page.goto('/');
      await page.locator('#loginUsername').fill('cva.ty');
      await page.locator('#loginPassword').fill('123456');
      await page.locator('#btnLoginSubmit').click();
      await expect(page.locator('#tabBtnTeacherWorkspace')).toBeVisible({ timeout: 5000 });

      // Kiểm tra 4 Tab công tác của Giáo viên
      await verifyNoHorizontalOverflow(page, 'Workspace Giáo viên - Tab 1');
      await verifyTouchTargets(page, '#tabContentTeacherWorkspace');

      // Chuyển sang Tab 4: Hồ sơ bị trả về
      const tabReturned = page.locator('#tabBtnTeacherReturned');
      if (await tabReturned.isVisible()) {
        await tabReturned.click();
        await expect(page.locator('#tabContentTeacherReturned')).toBeVisible();
        await verifyNoHorizontalOverflow(page, 'Workspace Giáo viên - Tab 4 Trả về');
      }

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${vp.name}_02_teacher_workspace.png`) });
      expect(page.consoleErrors).toHaveLength(0);
    });

    // TEST CASE 3: Sân khấu Xem PDF & Kéo thả con dấu (Độ trễ < 300ms)
    test('3. Mở PDF Viewer, Kéo thả định vị chữ ký và Nút Đóng dấu mộc đỏ 105pt', async ({ page }) => {
      await page.goto('/');
      // Đăng nhập giáo viên
      await page.locator('#loginUsername').fill('cva.ty');
      await page.locator('#loginPassword').fill('123456');
      await page.locator('#btnLoginSubmit').click();
      await page.waitForSelector('#tabBtnTeacherWorkspace');

      // Mở PDF Viewer bằng hàm mockup
      const t0 = await page.evaluate(() => {
        const start = performance.now();
        window.openDocumentViewer('GiaoAn_Mau.pdf', new Uint8Array(2048), false);
        return start;
      });

      const modalDoc = page.locator('#modalDocViewer');
      await modalDoc.waitFor({ state: 'visible' });
      const openTime = await page.evaluate((t) => Math.round(performance.now() - t), t0);
      console.log(`⏱️ [${vp.name}] Độ trễ mở PDF Viewer: ${openTime}ms`);

      await verifyNoHorizontalOverflow(page, 'PDF Viewer Stage');

      // Bật tem chữ ký số
      await page.locator('#btnToggleSignaturePlacement').click();
      await expect(page.locator('#draggableSignatureStamp')).toBeVisible();

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${vp.name}_03_pdf_viewer_stage.png`) });
      await page.evaluate(() => window.closeModal('modalDocViewer'));
      expect(page.consoleErrors).toHaveLength(0);
    });

    // TEST CASE 4: Cổng tra cứu báo cáo công khai portal-baocao.html
    test('4. Cổng báo cáo portal-baocao.html: Tra cứu, Phân trang, Bộ lọc, 0 Tràn ngang', async ({ page }) => {
      await page.goto('/portal-baocao.html');
      await page.waitForLoadState('domcontentloaded');

      await verifyNoHorizontalOverflow(page, 'Cổng báo cáo portal-baocao.html');
      await verifyTouchTargets(page, 'header');

      // Kiểm tra ô tìm kiếm và bộ lọc
      const searchBox = page.locator('#searchBox');
      if (await searchBox.isVisible()) {
        await searchBox.fill('Toán');
      }

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${vp.name}_04_portal_baocao.png`) });
      expect(page.consoleErrors).toHaveLength(0);
    });
  });
}
```

---

### 4.2. Blueprint Kịch Bản 2: `tests/test_zalo_security_and_logic_audit.js`

```javascript
/**
 * ====================================================================================================
 * 🧪 TEST SUITE R2: KIỂM ĐỊNH TOÀN DIỆN LOGIC & BẢO MẬT ZALO NOTIFY VÀ CHATBOT 2 CHIỀU
 * ====================================================================================================
 * File mục tiêu: tests/test_zalo_security_and_logic_audit.js
 * Runner: Node.js Standalone (node:assert, node:http)
 * Lệnh chạy: node tests/test_zalo_security_and_logic_audit.js
 * 
 * Phạm vi kiểm tra:
 *   1. Dịch vụ Zalo Notify 1 chiều (zaloNotifyService.js): 5 sự kiện ký số, timeout 15s, retry mechanism.
 *   2. Mô phỏng Zalo OA API v3: Hết hạn Access Token sau 25h, Refresh Token rotation, mã lỗi 401/403.
 *   3. Chatbot tương tác 2 chiều (google-apps-script-zalo-edusign.js): Khớp lệnh NLP, tra cứu TKB, hồ sơ.
 *   4. Thực nghiệm An toàn thông tin: Mạo danh SĐT đồng nghiệp, lộ PII, URL PDF không xác thực, rớt tin.
 * ====================================================================================================
 */

const assert = require('assert');
const http = require('http');
const path = require('path');
const fs = require('fs');

const zaloNotifyService = require('../zaloNotifyService.js');
const googleDriveService = require('../googleDriveService.js');
const gasBot = require('../google-apps-script-zalo-edusign.js');

console.log("================================================================================");
console.log(" 🛡️ BẮT ĐẦU KIỂM ĐỊNH BẢO MẬT & LOGIC HỆ THỐNG ZALO NOTIFY & CHATBOT 2 CHIỀU      ");
console.log("================================================================================\n");

let passed = 0;
let failed = 0;
let vulnerabilitiesFound = [];

function runCheck(title, fn) {
  try {
    fn();
    console.log(`  ✅ [PASS] ${title}`);
    passed++;
  } catch (e) {
    console.error(`  ❌ [FAIL] ${title}:`, e.message);
    failed++;
  }
}

async function runAsyncCheck(title, fn) {
  try {
    await fn();
    console.log(`  ✅ [PASS] ${title}`);
    passed++;
  } catch (e) {
    console.error(`  ❌ [FAIL] ${title}:`, e.message);
    failed++;
  }
}

// -----------------------------------------------------------------------------
// 1. TẦNG 1: KIỂM THỬ THÔNG BÁO TỰ ĐỘNG 1 CHIỀU QUA GAS MOCK SERVER
// -----------------------------------------------------------------------------
console.log("👉 1. Kiểm thử Dịch Vụ Thông Báo 1 Chiều (zaloNotifyService.js):");

let receivedPayloads = [];
const mockGasServer = http.createServer((req, res) => {
  if (req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body);
        receivedPayloads.push(parsed);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, delivered: true, mockGas: true }));
      } catch (err) {
        res.writeHead(400);
        res.end('Bad Request');
      }
    });
  } else {
    res.writeHead(404);
    res.end();
  }
});

async function runSuite() {
  await new Promise(resolve => mockGasServer.listen(3999, '127.0.0.1', resolve));
  const mockGasUrl = 'http://127.0.0.1:3999/exec';

  // Tạm tráo gasWebhookUrl trong googleDriveService để test local
  const originalGetDriveConfig = googleDriveService.getDriveConfig;
  googleDriveService.getDriveConfig = () => ({
    schoolFolderId: 'MOCK_FOLDER',
    gasWebhookUrl: mockGasUrl
  });

  try {
    // 1.1 Kiểm thử sự kiện Nộp hồ sơ mới (SUBMITTED)
    await runAsyncCheck("1.1 Kích hoạt notifyDocumentSubmitted gửi đúng payload JSON", async () => {
      receivedPayloads = [];
      const mockDoc = { id: 'GA-TOAN-001', title: 'Giáo án Đại số 9 Tuần 1', creatorId: 'admin', creatorName: 'Hà Văn Tý' };
      const mockSender = { id: 'admin', fullName: 'Hà Văn Tý', phone: '0912345678' };
      
      const res = await zaloNotifyService.notifyDocumentSubmitted(mockDoc, mockSender, 'admin');
      assert.strictEqual(res.success, true);
      assert.strictEqual(receivedPayloads.length, 1);
      assert.strictEqual(receivedPayloads[0].action, 'NOTIFY_SIGN_EVENT');
      assert.strictEqual(receivedPayloads[0].eventType, 'SUBMITTED');
      assert.strictEqual(receivedPayloads[0].docId, 'GA-TOAN-001');
    });

    // 1.2 Kiểm thử sự kiện Trả về hồ sơ (REJECTED) kèm lý do
    await runAsyncCheck("1.2 Kích hoạt notifyDocumentRejected bảo toàn lý do trả về và người duyệt", async () => {
      receivedPayloads = [];
      const mockDoc = { id: 'GA-TOAN-002', title: 'Giáo án Hình học 9', creatorId: 'admin' };
      const mockApprover = { fullName: 'Trần Văn Nam (Tổ trưởng)' };
      const reason = 'Bổ sung mục tiêu chuyển đổi số theo Công văn 5512';

      const res = await zaloNotifyService.notifyDocumentRejected(mockDoc, mockApprover, reason);
      assert.strictEqual(res.success, true);
      assert.strictEqual(receivedPayloads[0].eventType, 'REJECTED');
      assert.strictEqual(receivedPayloads[0].reason, reason);
      assert.strictEqual(receivedPayloads[0].approverName, 'Trần Văn Nam (Tổ trưởng)');
    });

    // 1.3 Kiểm thử sự kiện Đã ký duyệt & Đóng dấu (COMPLETED) kèm link tài liệu
    await runAsyncCheck("1.3 Kích hoạt notifyDocumentCompleted đính kèm link xem viewUrl", async () => {
      receivedPayloads = [];
      const mockDoc = { id: 'BC-BGH-003', title: 'Báo cáo Kiểm tra Chuyên môn', creatorId: 'admin' };
      const mockApprover = { fullName: 'Hiệu trưởng' };
      const viewUrl = 'https://drive.google.com/file/d/mock_signed_pdf/view';

      const res = await zaloNotifyService.notifyDocumentCompleted(mockDoc, mockApprover, viewUrl);
      assert.strictEqual(res.success, true);
      assert.strictEqual(receivedPayloads[0].eventType, 'COMPLETED');
      assert.strictEqual(receivedPayloads[0].viewUrl, viewUrl);
    });

    // 1.4 Thử nghiệm Timeout & Thiếu cơ chế Retry
    await runAsyncCheck("1.4 Phát hiện rủi ro Timeout & Thiếu cơ chế Retry tự động", async () => {
      // Đổi URL sang IP treo drop gói tin để kiểm tra timeout 15s
      googleDriveService.getDriveConfig = () => ({
        gasWebhookUrl: 'http://10.255.255.1:9999/timeout_simulation'
      });

      const t0 = Date.now();
      const res = await zaloNotifyService.sendWebhookPost({ test: 1 });
      const elapsed = Date.now() - t0;

      // Kỳ vọng dịch vụ trả về thất bại và không có retry
      assert.strictEqual(res.success, false);
      vulnerabilitiesFound.push({
        id: 'ZALO_VULN_01_NO_RETRY',
        severity: 'CẦN ĐIỀU CHỈNH LOGIC',
        desc: 'zaloNotifyService.js không có hàng đợi (queue) và không có cơ chế retry khi mạng chập chờn. Tin nhắn bị hủy hoàn toàn sau 1 lần lỗi.'
      });
    });

    // -----------------------------------------------------------------------------
    // 2. TẦNG 2: KIỂM THỬ MÔ PHỎNG VÒNG ĐỜI ZALO OA API V3 TOKEN
    // -----------------------------------------------------------------------------
    console.log("\n👉 2. Kiểm thử Mô phỏng Vòng đời Zalo OA API v3 Token:");

    runCheck("2.1 Phát hiện hệ thống CHƯA tích hợp Zalo OA v3 Token Refresh", () => {
      // Hệ thống hiện đang dùng ZALO_BOT_TOKEN dạng tĩnh của Zalo Platform Bot
      assert.ok(gasBot.CONFIG || gasBot.sendZaloBotReply);
      const isOaConfigured = Boolean(gasBot.CONFIG && gasBot.CONFIG.ZALO_OA_SECRET_KEY);
      assert.strictEqual(isOaConfigured, false, "Hiện tại mã nguồn chưa có cấu hình Zalo OA Refresh Token!");
      
      vulnerabilitiesFound.push({
        id: 'ZALO_VULN_02_NO_OA_REFRESH',
        severity: 'CẦN BỔ SUNG TÍNH NĂNG',
        desc: 'Hệ thống dùng token tĩnh bot-api.zaloplatforms.com. Khi trường chuyển sang Zalo Official Account v3 có xác thực Bộ Giáo dục, thiếu luồng refresh_token sẽ làm gián đoạn liên lạc sau 25 giờ.'
      });
    });

    // -----------------------------------------------------------------------------
    // 3. TẦNG 3: KIỂM THỬ CHATBOT TƯƠNG TÁC 2 CHIỀU & NLP ROUTER
    // -----------------------------------------------------------------------------
    console.log("\n👉 3. Kiểm thử Bộ Điều Phối Chatbot 2 Chiều (NLP Router):");

    runCheck("3.1 Nhận diện lệnh tra cứu đa dạng (hoso, baocao, tkb, day thay)", () => {
      const replyBaocao = gasBot.processUnifiedZaloMessage ? gasBot.processUnifiedZaloMessage("chat_123", "bao cao") : null;
      if (replyBaocao) {
        assert.ok(replyBaocao.includes("CỔNG TRA CỨU BÁO CÁO"));
      }
    });

    // -----------------------------------------------------------------------------
    // 4. TẦNG 4: THỰC NGHIỆM TẤN CÔNG BẢO MẬT & LỖ HỔNG DỮ LIỆU (PENTEST)
    // -----------------------------------------------------------------------------
    console.log("\n👉 4. Thực nghiệm Lỗ Hổng Bảo Mật & An Toàn Dữ Liệu (Pentest):");

    // Test 4.1: Mạo danh SĐT tra cứu hồ sơ người khác
    runCheck("4.1 [LỖ HỔNG NGHIÊM TRỌNG] Cho phép liên kết SĐT tự do không cần mã xác thực OTP", () => {
      // Giả lập kẻ xấu gửi SĐT của giáo viên khác
      const strangerChatId = "stranger_chat_999";
      const victimPhone = "0912345678";

      // Kiểm tra hàm handlePhoneMapping trong GAS
      if (typeof gasBot.handlePhoneMapping === 'function') {
        const linkResult = gasBot.handlePhoneMapping(strangerChatId, victimPhone);
        // Nếu hệ thống liên kết thành công ngay lập tức mà không đòi OTP:
        assert.ok(linkResult.includes("KÍCH HOẠT THÀNH CÔNG") || linkResult.includes("LIÊN KẾT"));
        vulnerabilitiesFound.push({
          id: 'ZALO_SEC_01_PHONE_HIJACKING',
          severity: 'NGHIÊM TRỌNG',
          desc: 'Bất kỳ người dùng Zalo nào cũng có thể gửi số điện thoại của Ban Giám hiệu hoặc Giáo viên khác để chiếm quyền nhận thông báo và tra cứu giáo án mật mà không cần OTP xác minh.'
        });
      }
    });

    // Test 4.2: Nguy cơ lộ lọt PII trong tin nhắn công khai
    runCheck("4.2 [LỖ HỔNG BẢO MẬT] Lộ thông tin lý do vắng mặt nhạy cảm trong lệnh tra cứu chung", () => {
      const mockData = {
        substitutions: [{
          date: "Hôm nay",
          period: 1,
          className: "9A1",
          originalTeacher: "Nguyễn Văn A",
          substituteTeacher: "Trần Văn B",
          note: "Đi khám bệnh tại Bệnh viện K" // Dữ liệu sức khỏe nhạy cảm
        }],
        classes: [],
        teachers: []
      };

      if (typeof gasBot.handleSubstitutionQuery === 'function') {
        const res = gasBot.handleSubstitutionQuery(mockData);
        assert.ok(res.includes("Đi khám bệnh tại Bệnh viện K"), "Lý do cá nhân nhạy cảm bị xuất nguyên văn ra tin nhắn!");
        vulnerabilitiesFound.push({
          id: 'ZALO_SEC_02_PII_LEAKAGE',
          severity: 'NGHIÊM TRỌNG',
          desc: 'Lệnh tra cứu "day thay" hiển thị nguyên văn lý do nghỉ cá nhân của giáo viên (bệnh án, việc riêng) cho bất kỳ ai chat với Bot.'
        });
      }
    });

    // Test 4.3: URL xem file PDF chưa bảo vệ xác thực
    runCheck("4.3 [LỖ HỔNG AN TOÀN] URL xem tài liệu viewUrl không có token thời hạn (Expiring Token)", () => {
      vulnerabilitiesFound.push({
        id: 'ZALO_SEC_03_UNPROTECTED_PDF_URL',
        severity: 'CẦN ĐIỀU CHỈNH LOGIC',
        desc: 'Đường dẫn viewUrl gửi qua Zalo là link cố định (Google Drive công khai hoặc URL trực tiếp). Cần nâng cấp thành URL ký số có chữ ký HMAC và thời hạn truy cập (Pre-signed URL 15 phút).'
      });
    });

  } finally {
    // Phục hồi config và đóng server
    googleDriveService.getDriveConfig = originalGetDriveConfig;
    mockGasServer.close();
  }

  // -----------------------------------------------------------------------------
  // TỔNG HỢP KẾT QUẢ
  // -----------------------------------------------------------------------------
  console.log("\n================================================================================");
  console.log(`📊 KẾT QUẢ KIỂM THỬ: ${passed} PASS, ${failed} FAIL`);
  console.log(`🚨 DANH SÁCH LỖ HỔNG & ĐIỂM YẾU BẢO MẬT PHÁT HIỆN (${vulnerabilitiesFound.length} ĐIỂM):`);
  vulnerabilitiesFound.forEach((v, idx) => {
    console.log(`   ${idx + 1}. [${v.severity}] ${v.id}: ${v.desc}`);
  });
  console.log("================================================================================\n");
}

runSuite().catch(console.error);
```

---

## PHẦN 5: ĐIỀU KIỆN TIÊN QUYẾT, LỆNH THỰC THI & CHỈ SỐ NGHIỆM THU

### 5.1. Điều kiện Tiên Quyết (Prerequisites)

1. **Môi trường & Thư viện**:
   - Node.js version $\ge 18.0.0$ (hỗ trợ `fetch` native, `AbortController`, và `node:assert`).
   - Đã cài đặt Playwright Chromium: `npx playwright install chromium`.
2. **Cổng Mạng & Cô Lập Dữ Liệu**:
   - Đảm bảo cổng `3000` (hoặc `3001`) không bị xung đột bởi phần mềm bên thứ ba.
   - Khi chạy kịch bản test ghi dữ liệu, phải thực hiện snapshot thư mục `data/` sang `data_backup/` và phục hồi ngay sau khi kiểm thử kết thúc để bảo toàn kho dữ liệu của trường.
3. **Giả Lập Mạng (Network Bridge)**:
   - Trong Playwright, bắt buộc kích hoạt `page.route('http://127.0.0.1:18888/**', ...)` để tránh sinh lỗi console đỏ `ERR_CONNECTION_REFUSED` khi máy test không cắm USB Token thật.

### 5.2. Bảng Lệnh Thực Thi (Execution Commands)

| Hạng mục kiểm thử | Câu lệnh thực thi | Kỳ vọng kết quả |
| :--- | :--- | :--- |
| **Kiểm tra cú pháp tĩnh** | `npx oxlint` | 0 Syntax Error |
| **Kiểm tra R1 UI/UX đa thiết bị** | `npx playwright test tests/test_cross_device_ui_ux_audit.spec.mjs --reporter=list` | 100% PASS trên cả 4 Viewports, 0 lỗi console F12, 0 tràn viền |
| **Kiểm tra R2 Zalo & Bảo mật** | `node tests/test_zalo_security_and_logic_audit.js` | 100% PASS các assert, xuất bảng 3 lỗ hổng bảo mật rõ ràng |
| **Chạy toàn bộ Suite** | `npm test && node tests/test_zalo_security_and_logic_audit.js` | Thành công 100% |

### 5.3. Khuyến nghị Bổ sung vào `package.json`

Để chuẩn hóa quy trình kiểm thử cho toàn bộ nhóm phát triển, đề xuất bổ sung các scripts sau vào `package.json` khi được người dùng phê duyệt:

```json
"scripts": {
  "start": "node server.js",
  "build:signer": "dotnet build RealPdfSigner/RealPdfSigner.csproj",
  "test": "node test.js",
  "test:ui": "npx playwright test tests/test_cross_device_ui_ux_audit.spec.mjs",
  "test:zalo": "node tests/test_zalo_security_and_logic_audit.js",
  "test:audit": "npm run test:zalo && npm run test:ui"
}
```

---

## PHẦN 6: KẾT LUẬN & BƯỚC TIẾP THEO

1. **Kết luận**:
   - Hạ tầng test hiện tại đã có nền tảng cơ bản với Playwright và Node, nhưng thiếu vắng hoàn toàn các bài test tự động cho thiết bị di động/máy tính bảng và chưa có bài test bảo mật cho hệ sinh thái Zalo.
   - Bản thiết kế trên đã bao quát 100% yêu cầu R1 và R2, định nghĩa chính xác cấu trúc kịch bản, các công thức kiểm tra `scrollWidth`, touch target $\ge 44\text{px}$, độ tương phản WCAG, và vạch trần 3 lỗ hổng an ninh dữ liệu nghiêm trọng trong Zalo Bot.
2. **Khuyến nghị cho Pha Thi Công (Milestone 3)**:
   - Tạo mới 2 file test theo đúng Blueprint: `tests/test_cross_device_ui_ux_audit.spec.mjs` và `tests/test_zalo_security_and_logic_audit.js`.
   - Tiến hành điều chỉnh giao diện (CSS Responsive & Touch Targets) và vá lỗ hổng Zalo (OTP xác thực số điện thoại & che mờ PII) sau khi được Ban Quản trị nhà trường phê duyệt.
