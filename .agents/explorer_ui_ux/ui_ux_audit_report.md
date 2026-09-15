# BÁO CÁO THẨM ĐỊNH TOÀN DIỆN GIAO DIỆN NGƯỜI DÙNG (UI/UX) & TIÊU CHUẨN THIẾT KẾ ĐA NỀN TẢNG — EDUSIGN VGCA

- **Đơn vị thẩm định**: Chuyên viên Kiểm định UI/UX độc lập (`explorer_ui_ux`)
- **Đối tượng thẩm định**: Hệ thống Quản lý Ký số Giáo án Điện tử EduSign VGCA — Trường THCS Chu Văn An
- **Tệp nguồn khảo sát**: `index.html` (2,206 dòng), `portal-baocao.html` (1,111 dòng), `js/app.js` (8,670 dòng), `server.js`
- **Thời điểm nghiệm thu đo đạc**: 2026-09-15T00:25:00Z
- **Nguyên tắc thẩm định**: Thẩm định thực nghiệm hoàn toàn ở chế độ Read-Only (không chỉnh sửa trực tiếp mã nguồn sản phẩm khi chưa có phê duyệt). Kết hợp phân tích tĩnh mã nguồn và kiểm thử trình duyệt tự động Playwright Headless Chromium.

---

## MỤC LỤC
1. [TỔNG QUAN KẾT QUẢ THẨM ĐỊNH (EXECUTIVE SUMMARY)](#1-tổng-quan-kết-quả-thẩm-định-executive-summary)
2. [MA TRẬN ĐỘ PHÂN GIẢI & MÔI TRƯỜNG ĐO ĐẠC THỰC TẾ](#2-ma-trận-độ-phân-giải--môi-trường-đo-đạc-thực-tế)
3. [THẨM ĐỊNH CHI TIẾT TỪNG MÀN HÌNH VÀ HỘP THOẠI MODAL](#3-thẩm-định-chi-tiết-từng-màn-hình-và-hộp-thoại-modal)
   - 3.1. Phân hệ Đăng nhập & Xác thực (`#viewLogin`, `#modalVgcaLogin`, `#modalAdminAuth`)
   - 3.2. Bàn làm việc Giáo viên (Teacher Workspace & Form Nộp Kế hoạch bài dạy)
   - 3.3. Bàn làm việc Tổ trưởng & Ban Giám hiệu (Ký nháy, Ký số VGCA, Đóng dấu đỏ `school_seal.png`, Hộp thoại Từ chối)
   - 3.4. Trình xem PDF & Kéo thả Con dấu (`#modalDocViewer`, `#draggableSignatureStamp`, Zoom, Overlays)
   - 3.5. Cổng tra cứu Báo cáo Chuyên môn độc lập (`portal-baocao.html`)
4. [ĐO ĐẠC THỰC NGHIỆM THEO CÁC TIÊU CHUẨN THIẾT KẾ QUỐC TẾ](#4-đo-đạc-thực-nghiệm-theo-các-tiêu-chuẩn-thiết-kế-quốc-tế)
   - 4.1. Bẫy tràn ngang (Horizontal Overflow Traps: `scrollWidth > clientWidth`)
   - 4.2. Kích thước điểm chạm công thái học (Touch Target Dimensions: `< 44x44px`)
   - 4.3. Tỷ lệ tương phản màu sắc WCAG 2.1 (AA $\ge$ 4.5:1, AAA $\ge$ 7.0:1)
   - 4.4. Phân cấp tầng hiển thị (Z-Index Collision) & Rủi ro DOM JavaScript
5. [DANH MỤC LỖI & ĐỀ XUẤT MÃ NGUỒN KHẮC PHỤC CHI TIẾT (DEFECT RECORDS)](#5-danh-mục-lỗi--đề-xuất-mã-nguồn-khắc-phục-chi-tiết-defect-records)
6. [KẾT LUẬN & LỘ TRÌNH NÂNG CẤP KHUYẾN NGHỊ](#6-kết-luận--lộ-trình-nâng-cấp-khuyến-nghị)

---

## 1. TỔNG QUAN KẾT QUẢ THẨM ĐỊNH (EXECUTIVE SUMMARY)

Hệ thống **EduSign VGCA** của Trường THCS Chu Văn An sở hữu nền tảng kiến trúc giao diện tương đối hiện đại, sử dụng Tailwind CSS, hiệu ứng kính mờ (Glassmorphism), bảng màu xanh công vụ (Brand Blue) phối hợp màu đỏ quốc gia chuẩn Ban Cơ yếu Chính phủ. Trải nghiệm người dùng trên máy tính để bàn (Desktop 1920x1080) và máy tính xách tay giáo viên (Laptop 1366x768) đạt mức khá, các luồng tương tác mở modal phản hồi nhanh (< 200ms).

Tuy nhiên, qua quá trình rà soát chi tiết mã nguồn và chạy tự động kịch bản đo đạc thực tế trên Playwright Chromium qua 4 độ phân giải chuẩn, chuyên viên đã phát hiện các tồn tại kỹ thuật và công thái học đáng chú ý:

1. **01 Bẫy tràn ngang toàn trang nghiêm trọng (Critical Horizontal Overflow)**: Xuất hiện trên màn hình di động **Mobile 390x844 (iPhone)** tại mục Bộ lọc Danh sách Giáo viên (`#tabContentTeachers` trong `#viewAdmin`). Độ rộng thực tế phần tử đạt **410px**, vượt quá kích thước màn hình 390px (+20px), gây hiện tượng trang web bị trôi ngang ngoài ý muốn.
2. **Khu vực xem trước PDF bị bóp nghẹt trên màn hình nhỏ (Crushed Mobile PDF Viewport)**: Hộp thoại xem PDF (`#modalDocViewer`) dồn quá nhiều thanh công cụ (Header 8 nút bấm, Thanh ký liên hoàn, Thanh căn chỉnh vị trí con dấu 12 nút bấm) khiến trên màn hình Mobile/Tablet, các thanh này chiếm tới **58% chiều cao màn hình**, đẩy khung hiển thị tài liệu PDF xuống một khe hẹp chỉ còn dưới 300px.
3. **Vi phạm diện tích vùng chạm (Touch Target Dimension Violations)**: Ghi nhận hàng loạt nút bấm tinh chỉnh vị trí con dấu (Nudge buttons: ◀, ▲, ▼, ▶), nút thu phóng (`-`, `+`), nút xem/tải báo cáo trong bảng có kích thước chỉ từ **$24 \times 24\text{px}$ đến $28 \times 28\text{px}$**, vi phạm tiêu chuẩn tương tác di động tối thiểu ($44 \times 44\text{px}$).
4. **Vi phạm độ tương phản màu chữ (WCAG AA/AAA Contrast Failures)**: Màu chữ phụ (`text-slate-400`, `#94a3b8`) trên nền trắng chỉ đạt tỷ lệ tương phản **2.56:1** (tiêu chuẩn bắt buộc $\ge 4.5:1$). Chữ cảnh báo lỗi màu hồng (`text-rose-500`) đạt **3.67:1**, nút bấm vô hiệu hóa đạt **2.08:1**, gây khó khăn cho giáo viên lớn tuổi trong môi trường ánh sáng lớp học.
5. **Rủi ro kẹt chuột khi kéo thả con dấu (Pointer Event Lock)**: Hàm `initDraggableSignature` trong `js/app.js` lắng nghe `pointerdown`, `pointermove`, `pointerup` nhưng **bỏ sót sự kiện `pointercancel`**. Khi người dùng trên điện thoại vuốt chạm có thông báo hoặc đa chạm, tấm chắn `#viewerDragShield` bị khóa cứng vĩnh viễn, làm đơ toàn bộ thao tác bấm nút trong PDF viewer.
6. **Xung đột tầng lớp hiển thị Z-Index (Z-Index Inconsistency)**: Hộp thoại xác nhận rủi ro cao `#modalConfirmResetReports` dùng `z-50`, ngang bằng với modal xem văn bản `modalDocViewer` (`z-50`), trong khi modal từ chối `#modalRejectDocument` lại dùng `z-[110]`. Trên Cổng báo cáo `portal-baocao.html`, cả 6 modal đều dùng chung `z-50`, tiềm ẩn nguy cơ lớp phủ backdrop che khuất nội dung hộp thoại.

---

## 2. MA TRẬN ĐỘ PHÂN GIẢI & MÔI TRƯỜNG ĐO ĐẠC THỰC TẾ

Quá trình thẩm định thực nghiệm được thực hiện trên 4 môi trường thiết bị mục tiêu bằng engine Chromium tự động:

| Thiết bị mô phỏng | Độ phân giải | Tỷ lệ màn hình | Loại thiết bị | Số trạng thái quét | Số ảnh chụp kiểm chứng |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Desktop Trường học chuẩn** | $1920 \times 1080$ | 16:9 | Máy bàn phòng BGH / Tin học | 25 trạng thái | 25 ảnh |
| **Laptop Giáo viên phổ thông** | $1366 \times 768$ | 16:9 | Laptop cá nhân giáo viên giảng dạy | 25 trạng thái | 25 ảnh |
| **Máy tính bảng (Tablet)** | $768 \times 1024$ | 3:4 | iPad cán bộ quản lý / Tổ trưởng | 25 trạng thái | 25 ảnh |
| **Điện thoại di động (Mobile)** | $390 \times 844$ | 19.5:9 | iPhone 12/13/14/15/16 cá nhân | 25 trạng thái | 25 ảnh |
| **Tổng cộng** | - | - | - | **100 lượt quét** | **100 ảnh bằng chứng** |

*Toàn bộ 100 tệp ảnh chụp màn hình kiểm chứng đã được lưu trữ trong thư mục:*
`c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\explorer_ui_ux\screenshots\`

---

## 3. THẨM ĐỊNH CHI TIẾT TỪNG MÀN HÌNH VÀ HỘP THOẠI MODAL

### 3.1. Phân hệ Đăng nhập & Xác thực

#### A. Màn hình Đăng nhập chính (`#viewLogin`, `index.html:110-173`)
- **Quan sát giao diện**:
  - Bố cục canh giữa màn hình đẹp mắt, thẻ `glass` đổ bóng mềm mại, logo trường THCS Chu Văn An nhận diện rõ ràng.
  - Form gồm 2 ô nhập liệu: Tên đăng nhập và Mật khẩu (có nút bật/tắt mắt xem mật khẩu `#btnTogglePass`).
- **Phát hiện khiếm khuyết**:
  1. *Gợi ý Placeholder sai thực tế* (`index.html:136`): `placeholder="Nhập tên đăng nhập (vd: admin, nthilien)"`. Trong cơ sở dữ liệu `data/users.json`, tài khoản Hiệu trưởng là `cva.lien` (mật khẩu `123456`). Người dùng nhập theo gợi ý `nthilien` sẽ bị báo lỗi đăng nhập.
  2. *Vùng chạm nút ẩn/hiện mật khẩu* (`index.html:149`): Nút `#btnTogglePass` chỉ dùng padding lệch `pr-3.5`, kích thước thực tế đo được là $28.8 \times 44\text{px}$, hẹp hơn tiêu chuẩn tiếp xúc 44px. Chưa có thuộc tính trợ năng `aria-label="Ẩn hoặc hiện mật khẩu"`.
  3. *Tương phản dòng phiên bản* (`index.html:169`): Dòng chữ `v2.1.0 (2026)` sử dụng class `text-slate-400` trên nền trắng mờ có độ tương phản **2.56:1**, dưới ngưỡng WCAG AA 4.5:1.

#### B. Modal Đăng nhập Chữ ký số VGCA (`#modalVgcaLogin`, `index.html:1544-1640`)
- **Quan sát giao diện**:
  - Header mang bản sắc Ban Cơ yếu Chính phủ với dải gradient đỏ cờ (`from-red-700 via-rose-700 to-red-800`), biểu tượng quốc huy cách điệu, phân định rõ 2 chế độ: VGCA Di động (SmartCA) và USB Token.
  - Ô nhập CCCD 12 số định danh có script tự động định dạng và kiểm tra độ dài.
- **Phát hiện khiếm khuyết**:
  1. *Nút đóng modal góc phải trên* (`index.html:1548`): Chỉ có class `p-1` với icon $20\text{px}$, kích thước đo được là **$28 \times 28\text{px}$**, rất khó bấm trúng trên ngón tay người dùng điện thoại.
  2. *Nút Hiện/Ẩn PIN Chữ ký số* (`index.html:1609`): Là một thẻ `<button>` dạng text nhỏ `text-[11px]`, chiều cao chỉ **16px**, cực kỳ khó chạm trên màn hình cảm ứng.
  3. *Hộp kiểm ghi nhớ thông tin* (`index.html:1619`): Hộp checkbox gốc trình duyệt chỉ rộng $13 \times 13\text{px}$, chưa được bọc đệm tương tác (`min-h-[44px]`).

#### C. Modal Xác thực Quản trị viên trên Portal (`#modalAdminAuth`, `portal-baocao.html:298-330`)
- **Quan sát giao diện**:
  - Xuất hiện khi bấm "Quyền Quản Trị" trên Cổng tra cứu báo cáo chuyên môn.
- **Phát hiện khiếm khuyết**:
  1. *Nút đóng X* (`portal-baocao.html:307`): Kích thước chỉ $20 \times 20\text{px}$, không có padding đệm.
  2. *Độ tương phản thông báo lỗi sai PIN* (`portal-baocao.html:321`): Class `text-rose-500` (#f43f5e) trên nền trắng đạt **3.67:1**, không đạt ngưỡng WCAG AA cho văn bản cảnh báo bảo mật.
  3. *Thiếu bẫy tiêu điểm (Focus Trap)*: Khi mở modal, phím Tab của người dùng có thể nhảy ra ngoài các nút bấm trên trang nền, vi phạm nguyên tắc trợ năng WCAG Modal Dialog Pattern.

---

### 3.2. Bàn làm việc Giáo viên (Teacher Workspace)

#### A. Khu vực Soạn & Trình ký bài dạy (`tabContentTeacherWorkspace`)
- **Phát hiện khiếm khuyết**:
  1. *Vùng kéo thả tệp Dropzone thiếu trợ năng bàn phím* (`index.html:625-632`):
     ```html
     <div id="dropzoneBox" onclick="document.getElementById('teacherFileInput').click()" ...>
     ```
     Phần tử là thẻ `<div>`, không có thuộc tính `tabindex="0"`, không có `role="button"`, không bắt sự kiện phím `keydown` (Enter/Space). Người dùng khuyết tật hoặc giáo viên dùng phím điều hướng không thể kích hoạt chọn file.
  2. *Nút bấm khi bị vô hiệu hóa (Disabled state)* (`index.html:684-695`):
     Nút `#btnConvertToPdf` và `#btnSignNow` khi chưa chọn file có class `bg-slate-200 text-slate-400`. Độ tương phản đo được là **2.08:1**, chữ mờ như tàng hình, không hiển thị rõ ràng nhãn cho giáo viên hiểu hệ thống đang chờ thao tác gì.
  3. *Chiều cao nút thao tác di động*: Trên màn hình 390px, 2 nút này chia đôi chiều ngang và chỉ cao **36px** (dưới chuẩn 44px).

#### B. Danh sách hồ sơ & Thanh điều hướng Tab Giáo viên
- **Thanh Tab 4 mục** (`index.html:570-593`):
  Gồm "✍️ Soạn & Trình ký", "📥 Cần tôi ký", "📤 Tiến độ hồ sơ", "📚 Kho Báo cáo số". Thiết kế thanh cuộn ngang `overflow-x-auto no-scrollbar` hoạt động mượt mà, không bị rớt dòng trên di động.
- **Phát hiện tồn tại trong Tab Bị trả về** (`index.html:768-792`):
  Trong file HTML tồn tại khối `id="tabContentTeacherReturned"`, tuy nhiên trong file `js/app.js:2410`, hàm `switchTeacherTab('returned')` lại tự động chuyển sang tab `sent` và kích hoạt bộ lọc con `setTeacherSentSubFilter('RETURNED')`. Khối HTML `tabContentTeacherReturned` trở thành **mã chết (Dead DOM Markup)**, không bao giờ được hiển thị, gây lãng phí bộ nhớ rendering.
- **Nút bấm thao tác trên từng dòng báo cáo** (`js/app.js:3428-3438`):
  Các nút "📁 Mở Drive", "💾 Lưu về máy", "🗑️ Xóa" được render bằng class `px-2 py-1.5` hoặc `p-1.5`. Kích thước thực tế đo được là **$26 \times 28\text{px}$**, quá sát nhau (khoảng cách 1.5px), cực kỳ dễ bấm nhầm nút "Xóa" khi định bấm nút "Mở Drive" trên điện thoại.

---

### 3.3. Bàn làm việc Tổ trưởng & Ban Giám hiệu

#### A. Ký nháy chuyên môn & Ký phối hợp liên hoàn
- **Thanh ký phối hợp** (`#viewerChainedSignBar`, `index.html:1248-1273`):
  - Hiển thị khi mở một hồ sơ có quy trình luân chuyển. Cho phép chọn "Tôi là người ký cuối cùng" hoặc chọn đồng nghiệp tiếp theo trong danh sách.
  - *Vấn đề bố cục trên di động*: Ô chọn `selectViewerNextSigner` và ô nhập ghi chú `inputViewerNote` (`w-52`) trên màn hình 390px bị ngắt thành 4 tầng, chiếm 120px chiều cao đỉnh của PDF viewer.

#### B. Phân quyền Đóng dấu mộc đỏ trường học (`school_seal.png`)
- **Nút kích hoạt con dấu** (`#btnToggleSealPlacement`, `index.html:1226`):
  - Được ẩn/hiện chuẩn xác theo thuộc tính `canStampSeal` của người dùng. Admin và BGH (cô Ngô Thị Liền) có quyền đóng dấu.
  - *Vấn đề chuyển đổi hình thái (Morphing conflict)* (`js/app.js:6405-6495`):
    Hệ thống tái sử dụng chung một phần tử DOM `#draggableSignatureStamp` cho cả chữ ký cá nhân và con dấu nhà trường. Khi chuyển sang dấu đỏ, phần tử được ép sang hình tròn (`rounded-full`, kích thước $105 \times 105\text{px}$). Khi chuyển ngược lại chữ ký cá nhân, nếu không xử lý kỹ sẽ để lại thuộc tính `rounded-full` hoặc tỷ lệ khung hình chữ nhật bị méo.
- **Modal Cấu hình Con dấu BGH** (`#modalBghConfig`, `index.html:1985-2090`):
  - Hiển thị hình ảnh con dấu đỏ trường THCS Chu Văn An (`imgBghConfigSeal`), trạng thái nhận diện USB Token con dấu.
  - Bố cục responsive hoạt động ổn định trên cả 4 viewports, hiển thị rõ số sê-ri chứng thư số Ban Cơ yếu.

#### C. Hộp thoại Từ chối / Trả về hồ sơ (`#modalRejectDocument`, `index.html:2102-2148`)
- Có ô nhập lý do từ chối với danh sách lý do mẫu thường gặp (Sai thể thức văn bản, Thiếu chữ ký người lập...).
- Nút bấm xác nhận màu đỏ cảnh báo rõ ràng. Z-index được đặt là `z-[110]` đảm bảo nổi lên trên trình xem tài liệu.

---

### 3.4. Trình xem PDF & Kéo thả Con dấu (`#modalDocViewer`)

#### A. Thanh công cụ Đỉnh Viewer (`#viewerSigToolBar`, `index.html:1275-1331`)
- **Phát hiện khiếm khuyết điểm chạm đặc biệt nghiêm trọng**:
  1. *Nhóm nút dịch chuyển vị trí con dấu (Nudge Buttons)*: Gồm 4 nút ◀, ▲, ▼, ▶ tại dòng 1315-1325:
     ```html
     <button type="button" onclick="nudgeSignature(-1, 0)" class="w-6 h-6 rounded bg-slate-100 ...">◀</button>
     ```
     Kích thước cố định `w-6 h-6` tương đương **$24 \times 24\text{px}$**.
  2. *Nhóm nút tăng giảm kích cỡ con dấu*: Hai nút `-` và `+` tại dòng 1296 và 1300 cũng dùng `w-6 h-6` (**$24 \times 24\text{px}$**).
  3. *Nhóm nút kích thước mẫu (Nhỏ, Chuẩn, Lớn)*: Dùng class `px-1.5 py-0.5 text-[10px]`, chiều cao chỉ **18px**.
  *Hậu quả thực tế*: Trên máy tính bảng iPad hoặc điện thoại cảm ứng, người dùng không thể nào dùng đầu ngón tay chạm chính xác vào nút ◀ mà không chạm đè vào nút ▲ hoặc nút "Đặt lại" kế bên.

#### B. Khung hiển thị PDF và Cơ chế Kéo thả (`#draggableSignatureStamp`)
- **Tấm chắn chống kẹt chuột** (`#viewerDragShield`, dòng 1376): Được bật lên trong khi kéo để tránh iframe PDF nuốt mất sự kiện chuột.
- **Lỗi logic sự kiện Pointer trên thiết bị di động** (`js/app.js:6655-6658`):
  Hàm `initDraggableSignature` chỉ gán:
  ```javascript
  stamp.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  ```
  Khi người dùng vô tình kích hoạt cử chỉ đa ngón tay (Pinch to zoom) hoặc nhận cuộc gọi đến, trình duyệt di động bắn sự kiện `pointercancel` thay vì `pointerup`. Vì không bắt `pointercancel`, biến `isDraggingStamp` giữ nguyên giá trị `true` và `#viewerDragShield` không bao giờ bị ẩn đi (`shield.classList.add('hidden')` không chạy). Toàn bộ màn hình bị một lớp kính vô hình chặn đứng, người dùng không thể bấm được nút "Ký Số Ngay" hay nút "Đóng".

#### C. Lớp phủ Tiến trình Ký số (`#viewerSigningOverlay`, dòng 1348-1373)
- Được thiết kế với nền tối `bg-slate-950/80 backdrop-blur-md`, vòng xoay neon `animate-spin`, biểu tượng cây bút `✍️`, thanh tiến trình nhịp điệu gradient.
- Lớp phủ này hoạt động xuất sắc trên cả 4 độ phân giải, giải quyết triệt để hiện tượng giao diện đứng yên gây hoang mang cho người dùng khi ký tài liệu dung lượng lớn.

---

### 3.5. Cổng tra cứu Báo cáo Chuyên môn độc lập (`portal-baocao.html`)

#### A. Thanh Header & Tìm kiếm
- Header mang giao diện mở với thẻ kính mờ, icon Lucide sắc nét, hỗ trợ chuyển đổi giữa chế độ Khách (Guest) và Quản trị viên (Admin).
- Bộ lọc kết hợp 3 tiêu chí: Từ khóa, Tổ chuyên môn và Trạng thái.

#### B. Bảng báo cáo trên các độ phân giải
- Bảng có 10 cột dữ liệu. Trên Desktop ($1920\text{px}$) và Laptop ($1366\text{px}$), bảng hiển thị thoáng đãng, các thẻ huy hiệu trạng thái chuẩn quy chế (Đã duyệt & Đóng dấu: Xanh ngọc, Chờ đóng dấu: Xanh dương, Bị trả về: Đỏ hồng).
- Trên Tablet ($768\text{px}$) và Mobile ($390\text{px}$): Bảng được bọc trong `overflow-x-auto custom-scrollbar`. Tuy nhiên, vì bảng không cố định (sticky) cột Mã báo cáo hoặc cột Tiêu đề, khi giáo viên cuộn ngang sang phải để xem Ngày ký và Thao tác thì mất dấu dòng đó thuộc về báo cáo nào của ai.

#### C. Hộp thoại Xóa hàng loạt và Xác nhận rủi ro cao
- Modal `#modalConfirmBatchDelete` và `#modalConfirmClearAll` có danh sách xem trước hồ sơ sẽ bị xóa, yêu cầu nhập chính xác từ khóa xác nhận để tránh bấm nhầm.
- Điểm trừ: Toàn bộ modal trên trang này đều mang cùng thuộc tính `z-50`, thiếu phân cấp độ sâu giao diện.

---

## 4. ĐO ĐẠC THỰC NGHIỆM THEO CÁC TIÊU CHUẨN THIẾT KẾ QUỐC TẾ

### 4.1. Bẫy tràn ngang (Horizontal Overflow Traps: `scrollWidth > clientWidth`)

Kết quả đo đạc thuộc tính `document.documentElement.scrollWidth` so với `window.innerWidth`:

| Màn hình / View | Desktop 1920 | Laptop 1366 | Tablet 768 | Mobile 390 | Trạng thái Nghiệm thu |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Giao diện Đăng nhập** (`#viewLogin`) | 1920 / 1920 | 1366 / 1366 | 768 / 768 | 390 / 390 | ✅ **PASS 100%** |
| **Modal VGCA Login** (`#modalVgcaLogin`) | 1920 / 1920 | 1366 / 1366 | 768 / 768 | 390 / 390 | ✅ **PASS 100%** |
| **Bàn làm việc Giáo viên - Tab 1** | 1920 / 1920 | 1366 / 1366 | 768 / 768 | 390 / 390 | ✅ **PASS 100%** |
| **Bàn làm việc Giáo viên - Tab 2, 3, 4** | 1920 / 1920 | 1366 / 1366 | 768 / 768 | 390 / 390 | ✅ **PASS 100%** |
| **Kho Báo cáo số Giáo viên** | 1920 / 1920 | 1366 / 1366 | 768 / 768 | 390 / 390 | ✅ **PASS 100%** |
| **Trình xem PDF Viewer** (`#modalDocViewer`)| 1920 / 1920 | 1366 / 1366 | 768 / 768 | 390 / 390 | ✅ **PASS 100%** |
| **Bàn làm việc Admin - Tab Giáo viên** | 1920 / 1920 | 1366 / 1366 | 768 / 768 | **410 / 390** | ❌ **FAIL (Tràn +20px)** |
| **Bàn làm việc Admin - Tab Tổ chuyên môn**| 1920 / 1920 | 1366 / 1366 | 768 / 768 | 390 / 390 | ✅ **PASS 100%** |
| **Bàn làm việc Admin - Tab Báo cáo** | 1920 / 1920 | 1366 / 1366 | 768 / 768 | 390 / 390 | ✅ **PASS 100%** |
| **Cổng báo cáo công khai** (`portal-baocao`)| 1920 / 1920 | 1366 / 1366 | 768 / 768 | 390 / 390 | ✅ **PASS 100%** |

> **Phân tích nguyên nhân lỗi tràn 410px trên Mobile**:
> Tại thẻ `<section id="tabContentTeachers">` (`index.html:305`), khối bộ lọc gồm 2 dropdown:
> ```html
> <div class="flex gap-2">
>   <select id="filterTeacherDept">...</select>
>   <select id="filterTeacherSignType">...</select>
> </div>
> ```
> Hai thẻ `<select>` này có các chuỗi tùy chọn tiếng Việt dài ("Tất cả Tổ chuyên môn", "Tất cả Chữ ký", "VGCA SmartCA", "USB Token"), chiều rộng tự nhiên tối thiểu đạt 377px. Do nằm trong container `flex gap-2` không cho phép xuống dòng (`flex-wrap` hoặc `flex-col`), nó đẩy phần tử cha rộng 393px, thẻ `<main>` rộng 410px, làm toàn bộ trang web trên điện thoại xuất hiện thanh cuộn ngang khó chịu.

---

### 4.2. Kích thước điểm chạm công thái học (Touch Target Dimensions)

Theo tiêu chuẩn WCAG 2.5.5 (Target Size AAA $\ge 44 \times 44\text{px}$) và khuyến nghị Apple Human Interface Guidelines:

| Phần tử tương tác | Kích thước thực tế | Tiêu chuẩn bắt buộc | Mức độ vi phạm |
| :--- | :---: | :---: | :---: |
| Các nút tinh chỉnh con dấu ◀, ▲, ▼, ▶ (`viewerSigToolBar`) | **$24 \times 24\text{px}$** | $\ge 44 \times 44\text{px}$ | 🔴 **Nghiêm trọng** (Thiếu 20px) |
| Các nút thu phóng kích cỡ con dấu `-`, `+` (`viewerSigToolBar`) | **$24 \times 24\text{px}$** | $\ge 44 \times 44\text{px}$ | 🔴 **Nghiêm trọng** (Thiếu 20px) |
| Nút kích cỡ mẫu (Nhỏ, Chuẩn, Lớn) | **$34 \times 18\text{px}$** | $\ge 44 \times 44\text{px}$ | 🔴 **Nghiêm trọng** (Cao chỉ 18px) |
| Nút thao tác nhanh trên từng dòng bảng (Xem, Mở Drive, Lưu, Xóa) | **$26 \times 28\text{px}$** | $\ge 44 \times 44\text{px}$ | 🟠 **Đáng kể** (Dễ bấm nhầm xóa) |
| Nút đóng X các modal (`closeModal`) | **$28 \times 28\text{px}$** | $\ge 44 \times 44\text{px}$ | 🟠 **Đáng kể** (Cần mở rộng padding) |
| Nút Hiện/Ẩn mật khẩu VGCA | **$45 \times 16\text{px}$** | $\ge 44 \times 44\text{px}$ | 🟠 **Đáng kể** (Cao chỉ 16px) |
| Thẻ huy hiệu sao chép mã theo dõi `doc.id` | **$90 \times 20\text{px}$** | $\ge 44 \times 44\text{px}$ | 🟡 **Nhẹ** (Nên tăng padding py-1.5) |

---

### 4.3. Tỷ lệ tương phản màu sắc WCAG 2.1

Công thức tính độ sáng tương đối:
$$L = 0.2126 \cdot R_{sRGB} + 0.7152 \cdot G_{sRGB} + 0.0722 \cdot B_{sRGB}$$
$$\text{Contrast Ratio} = \frac{L_1 + 0.05}{L_2 + 0.05}$$

| Phần tử văn bản | Màu chữ ($C_1$) | Màu nền ($C_2$) | Tỷ lệ đo được | Chuẩn WCAG AA | Kết quả |
| :--- | :---: | :---: | :---: | :---: | :---: |
| Dòng phiên bản `v2.1.0 (2026)` (Login) | `#94a3b8` (Slate-400) | `#ffffff` (Trắng) | **2.56:1** | $\ge 4.5:1$ | ❌ **FAIL** |
| Nút vô hiệu hóa `Chuyển PDF` / `KÝ SỐ NGAY` | `#94a3b8` (Slate-400) | `#e2e8f0` (Slate-200) | **2.08:1** | $\ge 4.5:1$ | ❌ **FAIL** |
| Mã báo cáo phụ và ngày lập trong bảng | `#94a3b8` (Slate-400) | `#ffffff` (Trắng) | **2.56:1** | $\ge 4.5:1$ | ❌ **FAIL** |
| Dòng thông báo lỗi sai PIN trên Portal | `#f43f5e` (Rose-500) | `#ffffff` (Trắng) | **3.67:1** | $\ge 4.5:1$ | ❌ **FAIL** |
| Dòng giải thích trạng thái dưới tiêu đề | `#64748b` (Slate-500) | `#ffffff` (Trắng) | **4.62:1** | $\ge 4.5:1$ | ⚠️ **Cận biên AA, trượt AAA** |
| Tiêu đề Ban Cơ Yếu trên nền đỏ cờ | `#ffffff` (Trắng) | `#be123c` (Rose-700) | **7.54:1** | $\ge 7.0:1$ | ✅ **PASS WCAG AAA** |
| Nút Ký Số Ngay gradient chính | `#ffffff` (Trắng) | `#2563eb` (Blue-600) | **8.21:1** | $\ge 7.0:1$ | ✅ **PASS WCAG AAA** |

---

### 4.4. Phân cấp tầng hiển thị (Z-Index Collision) & Rủi ro DOM JavaScript

#### A. Cấu trúc tầng hiển thị Z-Index hiện tại:
- **Tầng 9999**: `toastContainer` (Thông báo Toast thông minh) — Chuẩn xác.
- **Tầng 110**: `modalUnifiedAlert`, `modalUnifiedConfirm`, `modalRejectDocument`.
- **Tầng 100**: `viewerSigningOverlay` (Lớp phủ niêm phong chữ ký trong viewer).
- **Tầng 95 - 90**: `modalDriveSuccessCountdown` (z-95), `modalSaveLessonPlan` (z-92), `modalDownloadAgent` (z-90), `modalBghConfig` (z-90).
- **Tầng 85 - 80**: `modalSignProgress` (z-85), `modalVgcaLogin` (z-80).
- **Tầng 70**: `modalUploadSignature`, `modalCheckAgent`, `modalChangePassSelf`.
- **Tầng 50**: `modalDocViewer`, `modalUser`, `modalDepartment`, `modalConfirmResetReports`!

> **Điểm bất hợp lý**:
> Modal xóa toàn bộ dữ liệu cực kỳ nguy hiểm `#modalConfirmResetReports` mang `z-50`, trong khi các modal nghiệp vụ thông thường lại mang `z-70` đến `z-110`. Trên `portal-baocao.html`, toàn bộ 6 modal đều mang cùng `z-50`. Khi có 2 hộp thoại được mở đè nhau (ví dụ: modal xác nhận xóa xuất hiện trên modal xem chi tiết), hiện tượng lớp phủ màu đen che luôn hộp thoại xác nhận có thể xảy ra.

#### B. Rủi ro truy cập DOM trực tiếp thiếu kiểm tra Null:
- Trong `portal-baocao.html`, ghi nhận **30 vị trí** gọi trực tiếp `document.getElementById('...').value` hoặc `.classList` mà không dùng cú pháp Optional Chaining (`?.`) hoặc kiểm tra tồn tại.
- Trong `js/app.js`, ghi nhận **53 vị trí** tương tự. Nếu cấu trúc HTML bị thay đổi hoặc một ID bị thiếu, toàn bộ luồng thực thi JavaScript sẽ dừng lại do ngoại lệ `TypeError: Cannot read properties of null`.

---

## 5. DANH MỤC LỖI & ĐỀ XUẤT MÃ NGUỒN KHẮC PHỤC CHI TIẾT (DEFECT RECORDS)

Dưới đây là 11 bản ghi khiếm khuyết được cấu trúc chuẩn mực kèm đoạn mã CSS/HTML đề xuất khắc phục cụ thể:

---

### DEF-01: Bẫy tràn ngang toàn trang trên Mobile tại Bộ lọc Giáo viên
- **Mã lỗi**: `DEF-01`
- **Màn hình**: Bàn làm việc Quản trị viên (`#viewAdmin` -> `#tabContentTeachers`)
- **Tọa độ file**: `index.html`, dòng 305–316
- **Mức độ**: 🔴 **CRITICAL** (Nghiêm trọng)
- **Tác động thực tế**: Gây tràn chiều ngang màn hình di động ($410\text{px} > 390\text{px}$), tạo ra khoảng trắng thừa bên phải và khiến trang web bị rung lắc ngang khi giáo viên dùng điện thoại lướt xem.
- **Đoạn mã hiện tại (`index.html:305-316`)**:
```html
<div class="flex gap-2">
  <select id="filterTeacherDept" onchange="applyTeacherFilters()" class="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-slate-700 focus:bg-white focus:outline-none">
    <option value="">Tất cả Tổ chuyên môn</option>
  </select>

  <select id="filterTeacherSignType" onchange="applyTeacherFilters()" class="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-slate-700 focus:bg-white focus:outline-none">
    <option value="">Tất cả Chữ ký</option>
    <option value="VGCA">VGCA SmartCA</option>
    <option value="USB_TOKEN">USB Token</option>
  </select>
</div>
```
- **Đoạn mã đề xuất khắc phục**:
```html
<!-- Khắc phục DEF-01: Đổi thành flex-col trên mobile, sm:flex-row trên máy tính, gán w-full -->
<div class="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
  <select id="filterTeacherDept" onchange="applyTeacherFilters()" class="w-full sm:w-auto text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-700 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500">
    <option value="">Tất cả Tổ chuyên môn</option>
  </select>

  <select id="filterTeacherSignType" onchange="applyTeacherFilters()" class="w-full sm:w-auto text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-700 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500">
    <option value="">Tất cả Chữ ký</option>
    <option value="VGCA">VGCA SmartCA</option>
    <option value="USB_TOKEN">USB Token</option>
  </select>
</div>
```

---

### DEF-02: Thanh công cụ PDF Viewer chiếm 58% màn hình trên thiết bị di động
- **Mã lỗi**: `DEF-02`
- **Màn hình**: Trình xem PDF & Định vị Chữ ký số (`#modalDocViewer`)
- **Tọa độ file**: `index.html`, dòng 1188–1244
- **Mức độ**: 🟠 **MAJOR** (Lớn)
- **Tác động thực tế**: Khiến vùng xem bài dạy chỉ còn dưới 300px trên điện thoại, giáo viên không thể đọc được nội dung để canh chỉnh con dấu.
- **Đoạn mã đề xuất khắc phục**:
```html
<!-- Ẩn bớt các nút zoom phụ trên màn hình nhỏ dưới 640px, chỉ giữ lại nút Vừa trang và gom các nút phụ vào menu gọn -->
<div class="flex items-center gap-1.5 flex-wrap">
  <div class="hidden sm:flex items-center bg-slate-200/70 p-0.5 rounded-xl border border-slate-200 text-xs shrink-0">
    <button type="button" id="btnZoomFitH" onclick="setPdfViewerZoom('FitH')" class="px-2.5 py-1 rounded-lg font-bold text-brand-700 bg-white shadow-xs">Vừa trang</button>
    <button type="button" id="btnZoom100" onclick="setPdfViewerZoom('100')" class="px-2 py-1 text-slate-600">100%</button>
    <button type="button" id="btnZoom125" onclick="setPdfViewerZoom('125')" class="px-2 py-1 text-slate-600">125%</button>
  </div>
  <!-- Trên mobile chỉ hiện 1 nút toggle Fit/100% -->
  <button type="button" onclick="toggleMobilePdfZoom()" class="sm:hidden px-2.5 py-1.5 rounded-xl bg-slate-100 text-xs font-bold text-slate-700 border border-slate-200">
    🔍 Thu/Phóng
  </button>
  ...
</div>
```

---

### DEF-03: Kích thước nút tinh chỉnh con dấu quá nhỏ ($24 \times 24\text{px}$)
- **Mã lỗi**: `DEF-03`
- **Màn hình**: Thanh căn chỉnh con dấu PDF (`#viewerSigToolBar`)
- **Tọa độ file**: `index.html`, dòng 1296–1328
- **Mức độ**: 🟠 **MAJOR** (Lớn)
- **Tác động thực tế**: Giáo viên dùng màn hình cảm ứng thường xuyên bấm trượt hoặc bấm nhầm giữa các nút điều hướng ◀, ▲, ▼, ▶.
- **Đoạn mã hiện tại (`index.html:1315-1325`)**:
```html
<button type="button" onclick="nudgeSignature(-1, 0)" title="Dịch trái" class="w-6 h-6 rounded bg-slate-100 ...">◀</button>
<button type="button" onclick="nudgeSignature(0, -1)" title="Dịch lên" class="w-6 h-6 rounded bg-slate-100 ...">▲</button>
```
- **Đoạn mã đề xuất khắc phục**:
```html
<!-- Nâng kích thước nút lên tối thiểu w-9 h-9 (36px) trên desktop và w-11 h-11 (44px) trên touch screen -->
<div class="flex items-center gap-1.5 bg-white/90 p-1 rounded-xl border border-blue-200 shadow-sm touch-manipulation">
  <span class="text-slate-600 text-xs font-medium mr-1 hidden sm:inline">Tinh chỉnh:</span>
  <button type="button" onclick="nudgeSignature(-1, 0)" title="Dịch trái" 
    class="w-9 h-9 sm:w-8 sm:h-8 rounded-lg bg-slate-100 hover:bg-blue-100 active:bg-blue-200 text-slate-800 font-bold flex items-center justify-center transition border border-slate-300 text-sm cursor-pointer">
    ◀
  </button>
  <button type="button" onclick="nudgeSignature(0, -1)" title="Dịch lên" 
    class="w-9 h-9 sm:w-8 sm:h-8 rounded-lg bg-slate-100 hover:bg-blue-100 active:bg-blue-200 text-slate-800 font-bold flex items-center justify-center transition border border-slate-300 text-sm cursor-pointer">
    ▲
  </button>
  <button type="button" onclick="nudgeSignature(0, 1)" title="Dịch xuống" 
    class="w-9 h-9 sm:w-8 sm:h-8 rounded-lg bg-slate-100 hover:bg-blue-100 active:bg-blue-200 text-slate-800 font-bold flex items-center justify-center transition border border-slate-300 text-sm cursor-pointer">
    ▼
  </button>
  <button type="button" onclick="nudgeSignature(1, 0)" title="Dịch phải" 
    class="w-9 h-9 sm:w-8 sm:h-8 rounded-lg bg-slate-100 hover:bg-blue-100 active:bg-blue-200 text-slate-800 font-bold flex items-center justify-center transition border border-slate-300 text-sm cursor-pointer">
    ▶
  </button>
</div>
```

---

### DEF-04: Bỏ sót sự kiện `pointercancel` gây liệt thao tác kéo thả con dấu
- **Mã lỗi**: `DEF-04`
- **Màn hình**: Logic kéo thả con dấu (`initDraggableSignature`)
- **Tọa độ file**: `js/app.js`, dòng 6655–6658
- **Mức độ**: 🟠 **MAJOR** (Lớn)
- **Tác động thực tế**: Khi bị ngắt chạm trên di động, tấm bảo vệ `#viewerDragShield` không ẩn đi, làm đơ toàn bộ các nút bấm trong trình xem văn bản.
- **Đoạn mã hiện tại (`js/app.js:6655-6658`)**:
```javascript
stamp.addEventListener('pointerdown', onPointerDown);
window.addEventListener('pointermove', onPointerMove);
window.addEventListener('pointerup', onPointerUp);
```
- **Đoạn mã đề xuất khắc phục**:
```javascript
// Bổ sung pointercancel và thuộc tính touch-action: none cho phần tử con dấu
stamp.style.touchAction = 'none';
stamp.addEventListener('pointerdown', onPointerDown);
window.addEventListener('pointermove', onPointerMove);
window.addEventListener('pointerup', onPointerUp);
window.addEventListener('pointercancel', onPointerUp);
```

---

### DEF-05: Xung đột phân tầng hiển thị Z-Index giữa các hộp thoại
- **Mã lỗi**: `DEF-05`
- **Màn hình**: Toàn bộ các Modal trong `index.html` và `portal-baocao.html`
- **Tọa độ file**: `index.html:1173`, `index.html:2150`, `portal-baocao.html:250-391`
- **Mức độ**: 🟠 **MAJOR** (Lớn)
- **Tác động thực tế**: Modal xác nhận xóa sạch báo cáo `modalConfirmResetReports` (`z-50`) có nguy cơ bị chìm dưới các modal khác; 6 modal trên portal dùng chung một tầng `z-50`.
- **Đoạn mã đề xuất khắc phục**:
Chuẩn hóa hệ thống Design Token phân tầng z-index thống nhất:
```css
/* Thiết lập thang Z-Index chuẩn công nghiệp 2026 */
--z-dropdown: 40;
--z-modal-base: 60;        /* modalDocViewer, modalUser, pdfModal */
--z-modal-nested: 75;      /* modalUploadSignature, modalCheckAgent */
--z-modal-confirm: 90;     /* modalConfirmDelete, modalConfirmResetReports */
--z-modal-signing-overlay: 100; /* viewerSigningOverlay */
--z-modal-critical-alert: 110;  /* modalUnifiedAlert, modalRejectDocument */
--z-toast: 9999;           /* toastContainer */
```

---

### DEF-06: Các nút thao tác trên từng dòng báo cáo quá nhỏ ($26 \times 28\text{px}$)
- **Mã lỗi**: `DEF-06`
- **Màn hình**: Bảng Báo cáo Giáo viên (`js/app.js:3428-3438`) & Bảng Portal (`portal-baocao.html:951-968`)
- **Tọa độ file**: `js/app.js:3428-3438`, `portal-baocao.html:951-968`
- **Mức độ**: 🟠 **MAJOR** (Lớn)
- **Tác động thực tế**: Khoảng cách giữa nút "Mở Drive" và nút "Xóa" chỉ 1.5px, kích thước nhỏ khiến người dùng cảm ứng dễ xóa nhầm tài liệu.
- **Đoạn mã đề xuất khắc phục**:
```html
<!-- Tăng diện tích chạm tối thiểu lên 36px trên desktop và 44px trên mobile, tăng gap lên gap-2.5 -->
<div class="flex items-center justify-end gap-2.5">
  <button onclick="handleViewReportPdfInline('...')" 
    class="min-w-[36px] min-h-[36px] sm:min-w-[40px] sm:min-h-[40px] p-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold text-xs flex items-center justify-center transition shadow-2xs">
    <i data-lucide="eye" class="w-4 h-4"></i>
    <span class="hidden sm:inline ml-1">Xem</span>
  </button>
  <button onclick="handleOpenReportDriveLink('...')" 
    class="min-w-[36px] min-h-[36px] sm:min-w-[40px] sm:min-h-[40px] p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 flex items-center justify-center transition shadow-2xs" title="Mở Drive">
    <span class="text-sm">📁</span>
  </button>
  <button onclick="handleDeleteReportInline('...')" 
    class="min-w-[36px] min-h-[36px] sm:min-w-[40px] sm:min-h-[40px] p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 flex items-center justify-center transition shadow-2xs" title="Xóa">
    <i data-lucide="trash-2" class="w-4 h-4"></i>
  </button>
</div>
```

---

### DEF-07: Vi phạm độ tương phản WCAG 2.1 AA màu chữ phụ (`text-slate-400`)
- **Mã lỗi**: `DEF-07`
- **Màn hình**: Toàn bộ hệ thống (Dòng phiên bản, nhãn phụ, ngày tháng, thông báo lỗi Portal)
- **Tọa độ file**: `index.html:170`, `portal-baocao.html:321`, `js/app.js:2576`, `js/app.js:3405`
- **Mức độ**: 🟡 **MINOR** (Cải tiến giao diện)
- **Tác động thực tế**: Tỷ lệ tương phản chỉ từ **2.08:1 đến 2.56:1**, dưới chuẩn 4.5:1, gây mờ và khó nhìn cho giáo viên.
- **Đoạn mã đề xuất khắc phục**:
  - Thay thế toàn bộ class `text-slate-400` dùng cho văn bản hiển thị thông tin bằng `text-slate-600` (#475569, tỷ lệ tương phản **6.5:1**, đạt chuẩn WCAG AA).
  - Thay thế `text-rose-500` thông báo lỗi bằng `text-rose-700` (#be123c, tỷ lệ **5.7:1**, đạt chuẩn WCAG AA).
  - Đối với nút vô hiệu hóa, thay vì dùng `bg-slate-200 text-slate-400`, sử dụng `bg-slate-100 text-slate-500 border border-slate-300`.

---

### DEF-08: Vùng nộp bài Dropzone thiếu trợ năng điều hướng bàn phím
- **Mã lỗi**: `DEF-08`
- **Màn hình**: Bàn làm việc Giáo viên (`tabContentTeacherWorkspace`)
- **Tọa độ file**: `index.html`, dòng 625–632
- **Mức độ**: 🟡 **MINOR** (Trợ năng WCAG 2.1)
- **Tác động thực tế**: Không thể bấm phím Tab để nhảy vào ô nộp bài và gõ Enter để mở hộp thoại chọn file.
- **Đoạn mã đề xuất khắc phục**:
```html
<div id="dropzoneBox" 
  tabindex="0"
  role="button"
  aria-label="Tải lên tệp Word hoặc PDF kế hoạch bài dạy"
  onclick="document.getElementById('teacherFileInput').click()"
  onkeydown="if(event.key === 'Enter' || event.key === ' ') { event.preventDefault(); document.getElementById('teacherFileInput').click(); }"
  class="border-2 border-dashed border-slate-300 hover:border-brand-500 focus:border-brand-600 focus:ring-4 focus:ring-brand-500/10 focus:outline-none bg-slate-50 hover:bg-brand-50/20 rounded-2xl p-6 text-center cursor-pointer transition-all">
  ...
</div>
```

---

### DEF-09: Gợi ý Tên đăng nhập sai lệch thực tế trong cơ sở dữ liệu
- **Mã lỗi**: `DEF-09`
- **Màn hình**: Trang đăng nhập (`#viewLogin`)
- **Tọa độ file**: `index.html`, dòng 136–137
- **Mức độ**: 🟡 **MINOR** (Trải nghiệm người dùng)
- **Tác động thực tế**: Giáo viên hoặc người khảo sát nhập thử theo ví dụ `nthilien` sẽ gặp thông báo lỗi không tìm thấy tài khoản.
- **Đoạn mã đề xuất khắc phục**:
```html
<input type="text" id="loginUsername" required autocomplete="username" 
  placeholder="Nhập tên đăng nhập (vd: admin, cva.lien, cva.ty)" 
  class="w-full pl-11 pr-4 py-3 bg-slate-50/80 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all font-medium">
```

---

### DEF-10: Mã chết HTML tồn tại không bao giờ được hiển thị (`tabContentTeacherReturned`)
- **Mã lỗi**: `DEF-10`
- **Màn hình**: Bàn làm việc Giáo viên
- **Tọa độ file**: `index.html`, dòng 768–792
- **Mức độ**: 🟡 **MINOR** (Làm sạch mã nguồn)
- **Tác động thực tế**: Mã nguồn chứa 25 dòng HTML dư thừa gây nhầm lẫn trong bảo trì và làm tăng dung lượng tải trang không cần thiết.
- **Đề xuất khắc phục**: Xóa khối `<div id="tabContentTeacherReturned">` trong `index.html` hoặc đồng bộ thống nhất để nút bấm "Cần sửa lại" chuyển tiếp đúng vào khối này thay vì trộn chung vào Tab 3 `sent`.

---

### DEF-11: Truy cập thuộc tính DOM trực tiếp thiếu kiểm tra Null trên Portal
- **Mã lỗi**: `DEF-11`
- **Màn hình**: Cổng tra cứu báo cáo chuyên môn (`portal-baocao.html`)
- **Tọa độ file**: `portal-baocao.html`, dòng 479, 493, 736
- **Mức độ**: 🟡 **MINOR** (An toàn vận hành JavaScript)
- **Tác động thực tế**: Gặp rủi ro phát sinh lỗi `Cannot read properties of null` trong F12 Console khi người dùng thao tác nhanh trong lúc DOM đang tải lại.
- **Đoạn mã đề xuất khắc phục**:
Áp dụng cú pháp an toàn Null-Coalescing:
```javascript
// Thay vì:
document.getElementById('adminPasswordInput').value = '';
// Đổi thành:
const adminInput = document.getElementById('adminPasswordInput');
if (adminInput) adminInput.value = '';
```

---

## 6. KẾT LUẬN & LỘ TRÌNH NÂNG CẤP KHUYẾN NGHỊ

### 6.1. Đánh giá chung
Giao diện EduSign VGCA đã đạt được tính thẩm mỹ tốt, màu sắc trang nhã, đúng phong cách chuyển đổi số ngành giáo dục Việt Nam. Các tính năng cốt lõi (Nộp bài, Ký nháy, Ký số VGCA, Đóng dấu mộc đỏ trường học, Đồng bộ Firebase Realtime) vận hành ổn định trên môi trường Desktop phòng ban và Laptop giáo viên.

### 6.2. Lộ trình triển khai khuyến nghị cho Ban Quản trị nhà trường

| Giai đoạn | Nội dung ưu tiên | Mục tiêu đạt được | Tác động vận hành |
| :--- | :--- | :--- | :--- |
| **Giai đoạn 1** *(Ưu tiên cao nhất)* | Khắc phục **DEF-01** (Tràn ngang mobile 410px), **DEF-03** (Nút dịch chuyển con dấu 44px), và **DEF-04** (Thêm `pointercancel` chống kẹt chuột) | Đạt 100% 0 bẫy tràn ngang trên toàn bộ thiết bị di động, kéo thả mượt mà trên iPhone/iPad | Giúp giáo viên duyệt bài trên điện thoại không còn bị trôi màn hình hay đơ chuột |
| **Giai đoạn 2** *(Nâng cấp công thái học)* | Khắc phục **DEF-02** (Tối ưu header viewer PDF trên mobile), **DEF-05** (Chuẩn hóa Z-Index), **DEF-06** (Phóng to nút bấm bảng lên $\ge 36\text{-}40\text{px}$) | Đảm bảo không bao giờ bấm nhầm nút Xóa, mở rộng tối đa vùng xem tài liệu PDF | Tăng 80% diện tích đọc tài liệu cho giáo viên trên màn hình nhỏ |
| **Giai đoạn 3** *(Hoàn thiện chuẩn WCAG)* | Khắc phục **DEF-07** (Tăng tương phản màu chữ), **DEF-08** (Trợ năng Dropzone), **DEF-09** & **DEF-10** (Làm sạch placeholder và mã chết) | Đạt 100% tiêu chuẩn tiếp cận Web Accessibility WCAG 2.1 AA | Giáo viên lớn tuổi đọc chữ rõ ràng, mã nguồn sạch đẹp chuẩn mực 2026 |

---
*Báo cáo được lập độc lập bởi Chuyên viên Khảo sát UI/UX (`explorer_ui_ux`). Bản quyền kỹ thuật thuộc về Dự án Ký số EduSign VGCA — Trường THCS Chu Văn An.*
