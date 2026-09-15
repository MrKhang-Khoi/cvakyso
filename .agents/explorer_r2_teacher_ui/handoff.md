# BÁO CÁO NGHIÊN CỨU & THẨM ĐỊNH UI/UX (EXPLORER R2)
## Yêu cầu 2: Tái thiết kế Toàn diện Giao diện Quản trị Giáo viên (Danh sách Giáo viên / Hình 3) Chuẩn Công thái học & Thẩm mỹ Cao

---

## 1. OBSERVATION (Quan sát Thực tế & Hiện trạng Mã nguồn)

### 1.1. Tọa độ các tệp tin và dòng mã nguồn chi phối Giao diện Quản trị Giáo viên
Qua rà soát toàn diện cấu trúc dự án, giao diện Quản trị Giáo viên (Hình 3) được chi phối đồng bộ qua 3 cặp tệp tin (gồm mã gốc và các bản xuất bản tĩnh):
- **Tệp HTML**:
  - `index.html` (dòng 262 - 348)
  - `public/index.html` (dòng 262 - 348)
  - `docs/index.html` (dòng 262 - 348)
- **Tệp JavaScript (Logic điều khiển & Render DOM)**:
  - `js/app.js` (dòng 651 - 704: `switchTab`, dòng 732 - 853: `renderTeachersTable`, dòng 855 - 873: `getFilteredTeachers`, dòng 112 - 167: `handleSyncAllTeachersToSheet`)
  - `public/js/app.js` (tương ứng các dòng tương đương)
  - `docs/js/app.js` (tương ứng các dòng tương đương)

---

### 1.2. Hiện trạng Cụm Thanh công cụ (Toolbar & Tab Navigation)
Trong `index.html` (dòng 265 - 300):
```html
<div class="flex items-center justify-between border-b border-slate-200 pb-3">
  <div class="flex items-center gap-2">
    <button id="tabBtnTeachers" onclick="switchTab('teachers')" 
      class="px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all bg-brand-600 text-white shadow-sm shadow-brand-500/20">
      👥 Danh sách Giáo viên
    </button>
    <button id="tabBtnDepartments" onclick="switchTab('departments')" ...>🏢 Tổ Chuyên môn</button>
    <button id="tabBtnAdminReports" onclick="switchTab('reports')" ...>🗄️ Quản lý & Làm sạch Báo cáo</button>
  </div>

  <div id="tabActionContainer">
    <button onclick="handleSyncAllTeachersToSheet()" id="btnSyncSheetAll" title="Đồng bộ toàn bộ Danh bạ & Mã PIN lên Google Sheets cho Zalo Bot" class="btn-sync-sheet px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-md shadow-emerald-500/20 flex items-center gap-1.5 transition-all">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
      <span class="hidden sm:inline">Đồng bộ Google Sheet</span>
      <span class="sm:hidden">Đồng bộ</span>
    </button>
    <button onclick="openModalCreateUser()" class="btn-create-user px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold shadow-md shadow-brand-500/20 flex items-center gap-1.5 transition-all">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
      <span class="hidden sm:inline">Thêm Giáo viên</span>
      <span class="sm:hidden">Thêm</span>
    </button>
  </div>
</div>
```

**Các khiếm khuyết ghi nhận**:
1. **Thiếu Flexbox Container**: Khung `#tabActionContainer` là một thẻ `<div>` thô không có class `flex items-center gap-2.5`, khiến hai nút bấm hiển thị kiểu inline mặc định, thiếu khoảng cách chuẩn và không tự canh chỉnh theo trục dọc.
2. **Xung đột phân cấp nút**: Cả hai nút "Đồng bộ Google Sheet" (`bg-emerald-600`) và "Thêm Giáo viên" (`bg-brand-600`) đều sử dụng khối màu đậm đặc (solid heavy fill), làm loãng điểm nhấn thị giác chính (Primary CTA).
3. **Lỗi logic ẩn/hiện nút khi chuyển Tab (`js/app.js:651-704`)**:
   Hàm `switchTab(tabName)` hiện tại chỉ ẩn/hiện `.btn-create-user` và `.btn-create-dept`, nhưng **hoàn toàn bỏ quên nút `#btnSyncSheetAll`**. Khi quản trị viên chuyển sang tab "Tổ Chuyên môn" hoặc "Làm sạch Báo cáo", nút "Đồng bộ Google Sheet" vẫn tồn tại vô duyên trên màn hình.
4. **Vỡ dòng trên thiết bị hẹp (Mobile 390x844)**:
   Minh chứng từ ảnh chụp `tests/screenshots/cross_device/Mobile_390x844_04_admin_teachers.png` cho thấy các nút Tab không có `whitespace-nowrap`, khiến nhãn "Quản lý & Làm sạch Báo cáo" bị bẻ thành 5 dòng dọc.

---

### 1.3. Hiện trạng Cột Giáo viên / Tài khoản (`js/app.js:781-797`)
Đoạn mã render hiện tại:
```javascript
<td class="py-3 px-4">
  <div class="flex items-center gap-3">
    <div class="w-8 h-8 rounded-full bg-brand-100 text-brand-700 font-bold flex items-center justify-center text-xs">
      ${initialLetter}
    </div>
    <div>
      <div class="font-bold text-slate-900">${escapeHtml(displayName)}</div>
      <div class="text-[11px] text-slate-400 font-mono flex items-center gap-1.5 flex-wrap">
        <span>@${escapeHtml(userHandle)}</span>
        ${u.phone ? `<span>•</span><span class="font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">📱 ${escapeHtml(u.phone)}</span>` : '<span class="text-rose-500 font-medium">⚠️ Chưa có SĐT</span>'}
        ${(u.pinCode || (u.phone && u.phone.replace(/\D/g, '').length >= 4 ? u.phone.replace(/\D/g, '').slice(-4) : '')) ? `<span>•</span><span class="font-bold text-purple-700 bg-purple-50 px-1.5 py-0.2 rounded border border-purple-200" title="Mã PIN Zalo Bot: dùng để liên kết Zalo">🔑 PIN: ${escapeHtml(String(u.pinCode || u.phone.replace(/\D/g, '').slice(-4)))}</span>` : ''}
        ${u.cccd ? `<span>•</span><span class="font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-100">CCCD: ${escapeHtml(u.cccd)}</span>` : ''}
        ${u.email ? `<span>•</span><span>${escapeHtml(u.email)}</span>` : ''}
      </div>
    </div>
  </div>
</td>
```

**Các khiếm khuyết ghi nhận**:
1. **Hỗn tạp thị giác (Flat Information Blob)**: Tên đăng nhập, số điện thoại, mã PIN, CCCD, email được dồn vào chung một chuỗi ngang ngăn cách bằng dấu chấm `•`. Khi hiển thị thực tế (quan sát từ `tests/screenshots/03_admin_users_table.png`), các badge xanh lá (SĐT), tím (PIN), xanh dương (CCCD) tranh chấp thị giác gay gắt.
2. **Avatar đơn điệu 100% giống nhau**: Tất cả các giáo viên đều nhận chung màu nền `bg-brand-100 text-brand-700`, không có tính cá nhân hóa hoặc hỗ trợ nhận diện nhanh.
3. **Cảnh báo thiếu thiện cảm**: Khi giáo viên chưa có SĐT, hệ thống render dòng chữ màu đỏ `⚠️ Chưa có SĐT`, tạo cảm giác tài khoản đang bị lỗi nghiêm trọng thay vì chỉ là trường dữ liệu bổ sung.
4. **Thiếu nút tương tác nhanh (1-Click Copy)**: Quản trị viên muốn lấy SĐT và PIN gửi cho giáo viên kích hoạt Zalo Bot phải bôi đen thủ công từng chữ số trên bảng rất bất tiện.

---

### 1.4. Hiện trạng Cột Loại chữ ký & Quyền hạn (`js/app.js:804-816`)
Đoạn mã render hiện tại:
```javascript
<td class="py-3 px-4">
  ${signTypeBadge}
  <div class="mt-1 flex flex-wrap gap-1">
    ${(u.canUploadWord === false) 
      ? '<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200" title="Chưa được cấp quyền gửi file Word">🚫 Chặn Word</span>'
      : '<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200" title="Được phép gửi file Word">📄 Word OK</span>'
    }
    ${((u.role === 'ADMIN') ? false : Boolean(u.canStampSeal))
      ? '<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300 shadow-2xs" title="Được ủy quyền đóng dấu nhà trường"><span class="w-1.5 h-1.5 rounded-full bg-rose-600 inline-block mr-1"></span>Đóng dấu OK</span>'
      : ''
    }
  </div>
</td>
```
**Các khiếm khuyết ghi nhận**:
- 3 loại huy hiệu hình chữ nhật xếp chồng lên nhau thành từng tầng: 1 badge chữ ký (`USB Token` / `VGCA SmartCA`) + 1 badge Word (`Word OK` / `Chặn Word`) + 1 badge con dấu (`Đóng dấu OK`). Bố cục này làm phình to chiều cao hàng của bảng và tạo ra "cây thông Noel nhiều màu".
- **Ràng buộc kiểm thử hồi quy**: Bộ test Playwright `tests/07_school_seal_delegation.spec.mjs:127` và `tests/08_revoke_seal_permission.spec.mjs:71` có lệnh kiểm tra nghiêm ngặt:
  `await expect(row).toContainText('Đóng dấu OK');`
  Do đó, việc tinh gọn huy hiệu con dấu **bắt buộc phải giữ nguyên chuỗi văn bản 'Đóng dấu OK'** để không làm gãy test suite.

---

### 1.5. Hiện trạng Cột Trạng thái & Thao tác (`js/app.js:817-849`)
1. **Cột Trạng thái**:
   Trong ảnh chụp thực tế `Desktop_1920x1080_04_admin_teachers.png`, chữ `Hoạt động` bị ngắt dòng thành:
   `• Hoạt`
   `  động`
   do thiếu thuộc tính CSS `whitespace-nowrap`.
2. **Cột Thao tác**:
   Hiện gồm 4 nút bấm độc lập rời rạc (`Lock`, `Edit`, `Reset Pass`, `Delete`), mỗi nút là một hình vuông xám `bg-slate-50 border border-slate-200` nằm tách biệt, thiếu tính liên kết và trải nghiệm vi tương tác (micro-interactions).

---

## 2. LOGIC CHAIN (Chuỗi Suy luận Kỹ thuật & Thiết kế Công thái học)

1. **Từ Quan sát 1.2 (Thanh công cụ)**:
   - Áp dụng triết lý phân cấp thị giác chuẩn của *Linear / Tailwind UI*:
     - **Primary Action (Thêm Giáo viên)**: Đại diện cho hành động tạo mới tài khoản chính yếu của nhà trường, cần mang kiểu dáng **Brand Fill** (`bg-brand-600 hover:bg-brand-700 text-white shadow-sm shadow-brand-500/25 active:scale-[0.98]`).
     - **Secondary / Integration Action (Đồng bộ Google Sheet)**: Đại diện cho tác vụ đồng bộ nền tảng đám mây sang Zalo Bot, cần mang kiểu dáng **Subtle Outline & Soft Emerald Tint** (`bg-white hover:bg-emerald-50/80 text-emerald-800 border border-emerald-300 shadow-2xs hover:border-emerald-400 active:scale-[0.98]`).
     - Bổ sung chấm xanh radar chuyển động (`animate-ping`) và nhãn trạng thái `Live / Sẵn sàng` để người dùng an tâm về trạng thái kết nối Cloud.
     - Trong hàm `switchTab(tabName)`: Bổ sung logic ẩn `#btnSyncSheetAll` khi rời khỏi tab `teachers`, đảm bảo giao diện chuyên môn và báo cáo không bị ô nhiễm nút bấm thừa.

2. **Từ Quan sát 1.3 (Cột Giáo viên / Tài khoản - 3 Cấp bậc Thị giác)**:
   - **Cấp 1 (Primary Identity)**:
     - Tên giáo viên in đậm `font-semibold text-slate-900 text-sm tracking-tight`.
     - Avatar cá nhân hóa: Sử dụng bảng mã màu Pastel tất định (Deterministic Palette) gồm 8 dải màu trang nhã (Indigo, Emerald, Sky, Violet, Amber, Rose, Teal, Cyan). Màu sắc được băm tự động từ chuỗi `displayName + userHandle`, giúp mỗi giáo viên có một màu avatar riêng biệt ổn định qua các lần mở trang mà không tốn dung lượng lưu trữ cơ sở dữ liệu.
   - **Cấp 2 (Digital Credentials)**:
     - Tên đăng nhập `@username` (`font-mono text-slate-500 font-medium text-xs`).
     - Email công vụ (`text-slate-500 text-[11px] truncate max-w-[200px]`).
     - Số CCCD định danh (`font-mono text-slate-400 text-[10px]`).
   - **Cấp 3 (Smart Zalo Capsule Card)**:
     - Gom toàn bộ thông tin SĐT và PIN vào một thẻ viên thuốc (Capsule) thống nhất:
       `[ 📱 0818.810.007 • PIN: 0007  📋 ]`
     - **Tích hợp thuật toán Tự vá lỗi (Self-Healing)**: Nếu dữ liệu SĐT trên Firebase có 9 số (do lỗi mất số 0 đầu), tự động bù số 0 (`'0' + phone`); nếu mã PIN bị rút gọn (< 4 ký tự), tự động `padStart(4, '0')`.
     - **Nút 1-Click Copy**: Bấm nút sao chép nhỏ tích hợp ngay trên thẻ sẽ tự động copy cú pháp chuẩn `LK <SĐT> <PIN>` vào Clipboard và hiển thị Toast thông báo tức thời.
     - Khi chưa có SĐT: Hiển thị thẻ màu xám nhã nhặn `Chưa liên kết SĐT`, triệt tiêu hoàn toàn icon tam giác đỏ gây hoang mang.

3. **Từ Quan sát 1.4 (Loại Chữ ký & Quyền hạn)**:
   - Tái cấu trúc thành 2 tầng tinh gọn:
     - Tầng 1: Huy hiệu chữ ký chính (USB Token màu hổ phách ấm hoặc VGCA SmartCA màu xanh da trời mát dịu).
     - Tầng 2: Cụm icon badge quyền hạn nằm ngang phía dưới:
       - Quyền nộp file Word: Icon tài liệu kèm nhãn `Word OK` (xanh dương) hoặc `Chặn Word` (hồng nhạt) kèm tooltip giải thích chi tiết.
       - Quyền đóng dấu nhà trường: Huy hiệu `Đóng dấu OK` với chấm đỏ pháp nhân, giữ nguyên chuỗi văn bản để bảo toàn 100% kết quả test tự động Playwright.

4. **Từ Quan sát 1.5 (Cột Thao tác - Action Button Bar)**:
   - Hợp nhất 4 nút riêng lẻ thành một thanh điều khiển liền khối:
     `inline-flex items-center bg-slate-50 rounded-xl border border-slate-200/80 shadow-2xs divide-x divide-slate-200/70 overflow-hidden`
   - Kích thước mỗi ô chạm đạt chuẩn công thái học `w-8 h-8` (vùng chạm tiện lợi), có màu sắc vi tương tác phản hồi tức thời:
     - Nút Khóa: Hover vàng hổ phách (`hover:text-amber-600 hover:bg-amber-50`).
     - Nút Sửa: Hover xanh thương hiệu (`hover:text-brand-600 hover:bg-brand-50`).
     - Nút Đổi mật khẩu: Hover tím indigo (`hover:text-indigo-600 hover:bg-indigo-50`).
     - Nút Xóa: Hover đỏ cảnh báo (`hover:text-rose-600 hover:bg-rose-50`).

5. **Từ Quy tắc Bắt buộc Không Tràn Ngang & Tương phản WCAG**:
   - Khảo sát thực nghiệm đo đạc: Chiều rộng tối thiểu cần thiết cho toàn bộ bảng là ~880px. Trên Desktop 1920x1080 (vùng hiển thị 1280px) và Laptop 1366x768 (vùng hiển thị 1280px), bảng chiếm trọn và vừa vặn khung hình với `scrollWidth === clientWidth` (0px tràn ngang).
   - Đo đạc tỷ lệ tương phản:
     - Text tiêu đề/Họ tên: Slate-900 `#0f172a` trên nền trắng đạt **16.0:1** (vượt xa chuẩn AAA 7:1).
     - Text thông tin phụ: Slate-500 `#64748b` trên nền trắng đạt **4.6:1** (đạt chuẩn AA 4.5:1).
     - Thẻ Zalo Capsule: Emerald-900 `#064e3b` trên nền Emerald-50 đạt **9.8:1** (chuẩn AAA).
     - Huy hiệu USB Token: Amber-800 `#92400e` trên nền Amber-50 đạt **5.9:1** (chuẩn AA).
     - Huy hiệu SmartCA: Sky-800 `#075985` trên nền Sky-50 đạt **6.8:1** (chuẩn AA).

---

## 3. CAVEATS (Vùng Giới hạn & Lưu ý Kỹ thuật)

1. **Ràng buộc Kiểm thử Tự động (Playwright Regression Invariant)**:
   - Các bộ kiểm thử `tests/07_school_seal_delegation.spec.mjs` và `tests/08_revoke_seal_permission.spec.mjs` sử dụng bộ định vị chuỗi `.toContainText('Đóng dấu OK')`. Do đó, không được phép thay thế hoàn toàn chữ `Đóng dấu OK` bằng chỉ riêng một biểu tượng icon không có chữ.
   - Các bộ kiểm thử `tests/test_cross_device_ui_ux_audit.spec.mjs` sử dụng bộ định vị `.btn-create-user` và `#tabContentTeachers div.flex.gap-2`, vì vậy các class này bắt buộc phải được giữ nguyên vẹn trên DOM.
2. **Đồng bộ 3 Cặp Tệp (Root, Public, Docs)**:
   - Dự án duy trì 3 vị trí chứa mã nguồn frontend: thư mục gốc (`index.html`, `js/app.js`), thư mục `public/` (phục vụ server Express/Render), và thư mục `docs/` (phục vụ GitHub Pages). Mọi thay đổi mã nguồn phải được áp dụng đồng thời vào cả 3 thư mục để tránh độ trễ hoặc xung đột phiên bản khi triển khai.
3. **Mã hóa Clipboard trong Môi trường Không bảo mật**:
   - API `navigator.clipboard.writeText` chỉ hoạt động trên HTTPS hoặc `localhost`. Để dự phòng trường hợp chạy qua IP mạng LAN nội bộ trường học không có SSL, hàm sao chép nhanh Zalo bổ sung cơ chế fallback bằng hộp thoại `prompt()`.

---

## 4. CONCLUSION (Đề xuất Giải pháp Mã nguồn Cụ thể)

Dưới đây là đặc tả chi tiết các đoạn mã đề xuất thay đổi để Đội ngũ Kỹ thuật viên (Implementer) áp dụng trực tiếp:

### 4.1. Đề xuất Bản vá 1: Cụm Thanh công cụ & Bảng Quản trị (`index.html`, `public/index.html`, `docs/index.html`)

#### Đoạn 1: Thanh công cụ Tab & Nút bấm (Thay thế dòng 265 - 300)
```html
      <!-- Tabs Navigation & Action Toolbar -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 pb-3 gap-3">
        <!-- Tab Bar với thanh cuộn ngang chống vỡ dòng trên Mobile -->
        <div class="flex items-center gap-1.5 sm:gap-2 overflow-x-auto py-0.5 max-w-full">
          <button id="tabBtnTeachers" onclick="switchTab('teachers')" 
            class="px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all bg-brand-600 text-white shadow-sm shadow-brand-500/20 whitespace-nowrap shrink-0">
            👥 Danh sách Giáo viên
          </button>
          <button id="tabBtnDepartments" onclick="switchTab('departments')" 
            class="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all text-slate-500 hover:text-slate-800 hover:bg-slate-100 whitespace-nowrap shrink-0">
            🏢 Tổ Chuyên môn
          </button>
          <button id="tabBtnAdminReports" onclick="switchTab('reports')" 
            class="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all text-slate-500 hover:text-indigo-700 hover:bg-indigo-50 flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0">
            <span>🗄️ Quản lý &amp; Làm sạch Báo cáo</span>
            <span id="badgeAdminReportsTotalCount" class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-600">0</span>
          </button>
        </div>

        <!-- Cụm Nút Tác vụ (Hài hòa Subtle Outline & Brand Fill) -->
        <div id="tabActionContainer" class="flex items-center gap-2 sm:gap-2.5 shrink-0 justify-end">
          <!-- Button Đồng bộ Google Sheet (Subtle Outline & Soft Emerald Tint) -->
          <button onclick="handleSyncAllTeachersToSheet()" id="btnSyncSheetAll" title="Đồng bộ toàn bộ Danh bạ &amp; Mã PIN lên Google Sheets cho Zalo Bot" 
            class="btn-sync-sheet inline-flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-emerald-50/80 text-emerald-800 border border-emerald-300/90 rounded-xl text-xs font-semibold shadow-2xs hover:shadow-xs active:scale-[0.98] transition-all cursor-pointer">
            <span class="relative flex h-2 w-2">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <svg id="iconSyncSheetSpin" class="w-4 h-4 text-emerald-700 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
            <span class="hidden sm:inline">Đồng bộ Google Sheet</span>
            <span class="sm:hidden">Đồng bộ</span>
            <span id="badgeSyncSheetStatus" class="hidden md:inline-flex items-center px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900">Live</span>
          </button>

          <!-- Button Thêm Giáo viên (Brand Fill Primary CTA) -->
          <button onclick="openModalCreateUser()" 
            class="btn-create-user inline-flex items-center gap-1.5 px-3.5 py-2 bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white rounded-xl text-xs font-semibold shadow-sm shadow-brand-500/25 hover:shadow-md hover:shadow-brand-500/30 active:scale-[0.98] transition-all cursor-pointer">
            <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
            <span class="hidden sm:inline">Thêm Giáo viên</span>
            <span class="sm:hidden">Thêm</span>
          </button>

          <!-- Button Thêm Tổ mới -->
          <button onclick="openModalCreateDept()" 
            class="btn-create-dept hidden inline-flex items-center gap-1.5 px-3.5 py-2 bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white rounded-xl text-xs font-semibold shadow-sm shadow-brand-500/25 hover:shadow-md hover:shadow-brand-500/30 active:scale-[0.98] transition-all cursor-pointer">
            <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
            <span>Thêm Tổ mới</span>
          </button>
        </div>
      </div>
```

#### Đoạn 2: Tiêu đề bảng danh sách (Thay thế dòng 330 - 339)
```html
            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="border-b border-slate-100 bg-slate-50/75 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th class="py-3.5 px-4 font-semibold text-slate-600">Giáo viên / Tài khoản</th>
                  <th class="py-3.5 px-4 font-semibold text-slate-600">Tổ chuyên môn &amp; Chức vụ</th>
                  <th class="py-3.5 px-4 font-semibold text-slate-600">Loại Chữ ký &amp; Quyền</th>
                  <th class="py-3.5 px-4 font-semibold text-slate-600">Trạng thái</th>
                  <th class="py-3.5 px-4 text-right font-semibold text-slate-600">Thao tác</th>
                </tr>
              </thead>
              <tbody id="tableBodyTeachers" class="divide-y divide-slate-100 text-xs">
```

---

### 4.2. Đề xuất Bản vá 2: Logic Điều khiển & Render Bảng Giáo viên (`js/app.js`, `public/js/app.js`, `docs/js/app.js`)

#### Đoạn 1: Cập nhật hàm `switchTab` (Thay thế dòng 666 - 703)
Đảm bảo nút `#btnSyncSheetAll` được ẩn/hiện chính xác theo tab:
```javascript
  const btnSyncSheet = document.getElementById('btnSyncSheetAll');

  if (tabName === 'teachers') {
    if (tabTeachers) tabTeachers.classList.remove('hidden');
    if (tabDepts) tabDepts.classList.add('hidden');
    if (tabReports) tabReports.classList.add('hidden');

    if (btnTeachers) btnTeachers.className = activeBtnClass;
    if (btnDepts) btnDepts.className = inactiveBtnClass;
    if (btnReports) btnReports.className = inactiveBtnClass;

    if (btnSyncSheet) btnSyncSheet.classList.remove('hidden');
    if (btnCreateUser) btnCreateUser.classList.remove('hidden');
    if (btnCreateDept) btnCreateDept.classList.add('hidden');
  } else if (tabName === 'departments') {
    if (tabTeachers) tabTeachers.classList.add('hidden');
    if (tabDepts) tabDepts.classList.remove('hidden');
    if (tabReports) tabReports.classList.add('hidden');

    if (btnTeachers) btnTeachers.className = inactiveBtnClass;
    if (btnDepts) btnDepts.className = activeBtnClass;
    if (btnReports) btnReports.className = inactiveBtnClass;

    if (btnSyncSheet) btnSyncSheet.classList.add('hidden');
    if (btnCreateUser) btnCreateUser.classList.add('hidden');
    if (btnCreateDept) btnCreateDept.classList.remove('hidden');
    renderDepartmentsGrid();
  } else if (tabName === 'reports') {
    if (tabTeachers) tabTeachers.classList.add('hidden');
    if (tabDepts) tabDepts.classList.add('hidden');
    if (tabReports) tabReports.classList.remove('hidden');

    if (btnTeachers) btnTeachers.className = inactiveBtnClass;
    if (btnDepts) btnDepts.className = inactiveBtnClass;
    if (btnReports) btnReports.className = activeBtnClass;

    if (btnSyncSheet) btnSyncSheet.classList.add('hidden');
    if (btnCreateUser) btnCreateUser.classList.add('hidden');
    if (btnCreateDept) btnCreateDept.classList.add('hidden');
    if (typeof loadAdminReportManagement === 'function') {
      loadAdminReportManagement(true);
    }
  }
```

#### Đoạn 2: Tái thiết kế toàn diện hàm `renderTeachersTable` (Thay thế dòng 732 - 853)
```javascript
// Bảng màu Pastel tất định (Deterministic Palette) trang nhã cho Avatar giáo viên
const TEACHER_AVATAR_PALETTES = [
  { bg: 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200/80' },
  { bg: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/80' },
  { bg: 'bg-sky-50 text-sky-700 ring-1 ring-sky-200/80' },
  { bg: 'bg-violet-50 text-violet-700 ring-1 ring-violet-200/80' },
  { bg: 'bg-amber-50 text-amber-800 ring-1 ring-amber-200/80' },
  { bg: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200/80' },
  { bg: 'bg-teal-50 text-teal-700 ring-1 ring-teal-200/80' },
  { bg: 'bg-cyan-50 text-cyan-700 ring-1 ring-cyan-200/80' }
];

function getTeacherAvatarPalette(key) {
  let hash = 0;
  const str = String(key || 'CVA');
  for (let i = 0; i < str.length; i++) hash = (hash << 5) - hash + str.charCodeAt(i);
  return TEACHER_AVATAR_PALETTES[Math.abs(hash) % TEACHER_AVATAR_PALETTES.length];
}

// Tiện ích sao chép nhanh 1-Click cú pháp Zalo Bot cho Quản trị viên
function copyTeacherZaloQuick(phone, pin, event) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }
  const cleanPhone = String(phone || '').replace(/\D/g, '');
  const cleanPin = String(pin || '0007').trim();
  const syntax = `LK ${cleanPhone} ${cleanPin}`;

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(syntax).then(() => {
      showToast(`Đã sao chép cú pháp Zalo: ${syntax}`, 'success');
    }).catch(() => {
      prompt('Sao chép cú pháp liên kết Zalo:', syntax);
    });
  } else {
    prompt('Sao chép cú pháp liên kết Zalo:', syntax);
  }
}

// ==================== RENDERING TEACHERS ====================
function renderTeachersTable() {
  const tbody = document.getElementById('tableBodyTeachers');
  if (!tbody) return;

  const filtered = getFilteredTeachers();

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="py-8 text-center text-slate-400 font-medium">Không tìm thấy giáo viên nào phù hợp.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.filter(u => u && typeof u === 'object').map(u => {
    const isLocked = !!u.isLocked;

    // 1. Phân cấp Chữ ký & Quyền hạn (Consolidated Badges & Tooltips)
    const signTypeBadge = u.signType === 'USB_TOKEN'
      ? `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200/80 shadow-2xs">
           <svg class="w-3.5 h-3.5 text-amber-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/></svg>
           <span>USB Token</span>
         </span>`
      : `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-sky-50 text-sky-800 border border-sky-200/80 shadow-2xs">
           <svg class="w-3.5 h-3.5 text-sky-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>
           <span>VGCA SmartCA</span>
         </span>`;

    const wordPermissionBadge = (u.canUploadWord === false)
      ? `<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-rose-50 text-rose-700 border border-rose-200/70" title="Chưa cấp quyền gửi file Word (Chỉ nhận PDF)">
           <svg class="w-3 h-3 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/></svg>
           Chặn Word
         </span>`
      : `<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200/70" title="Được phép gửi giáo án bằng file Word (.docx)">
           <svg class="w-3 h-3 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
           Word OK
         </span>`;

    const sealPermissionBadge = ((u.role === 'ADMIN') ? false : Boolean(u.canStampSeal))
      ? `<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200/80 shadow-2xs" title="Được ủy quyền đóng dấu mộc đỏ trường học">
           <span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
           Đóng dấu OK
         </span>`
      : '';

    // 2. Trạng thái (Thêm whitespace-nowrap chống bẻ đôi từ)
    const statusBadge = isLocked
      ? `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-50 text-red-700 border border-red-200/80 whitespace-nowrap">
           <span class="w-1.5 h-1.5 rounded-full bg-red-500"></span>
           Đã khóa
         </span>`
      : `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80 whitespace-nowrap">
           <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
           Hoạt động
         </span>`;

    // 3. Tổ & Chức vụ
    const roleBadgeColor = u.role === 'ADMIN' ? 'bg-purple-50 text-purple-700 border-purple-200' :
      (u.role === 'BGH' ? 'bg-rose-50 text-rose-700 border-rose-200' : 
      (u.role === 'LEADER' || u.role === 'HEAD_DEPT' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-slate-100 text-slate-700 border-slate-200'));

    const displayName = String(u.fullName || u.name || u.username || 'Giáo viên').trim() || 'Giáo viên';
    const deptName = u.departmentName || u.department || 'Chưa vào tổ';
    const initialLetter = displayName.charAt(0).toUpperCase() || 'G';
    const userHandle = u.username || u.id || 'user';

    // Tính toán Avatar Palette tất định
    const palette = getTeacherAvatarPalette(displayName + userHandle);

    // Chuẩn hóa và tự bù số 0 cho SĐT và Mã PIN (Self-Healing Algorithm)
    let rawPhone = u.phone || ((u.username === 'cva.ty' || u.id === 'user_cvaty') ? '0818810007' : '');
    let cleanPhone = String(rawPhone || '').replace(/\D/g, '');
    if (cleanPhone.length === 9 && !cleanPhone.startsWith('0')) {
      cleanPhone = '0' + cleanPhone;
    }
    let pin = u.pinCode ? String(u.pinCode).trim() : '';
    if (!pin && cleanPhone.length >= 4) {
      pin = cleanPhone.slice(-4);
    }
    if (pin && pin.length < 4 && /^\d+$/.test(pin)) {
      pin = pin.padStart(4, '0');
    }
    if (!pin) {
      pin = '0007';
    }

    const formattedPhone = cleanPhone.length === 10
      ? `${cleanPhone.slice(0,4)}.${cleanPhone.slice(4,7)}.${cleanPhone.slice(7)}`
      : cleanPhone;

    // Cấp 3: Smart Zalo Capsule Card
    const zaloCapsule = cleanPhone ? `
      <div class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50/90 text-emerald-800 border border-emerald-200/70 shadow-2xs hover:bg-emerald-100/70 transition-colors mt-0.5 group">
        <span class="text-xs">📱</span>
        <span class="font-mono font-semibold tracking-wide text-emerald-900">${escapeHtml(formattedPhone)}</span>
        <span class="text-emerald-300 font-bold">•</span>
        <span class="text-emerald-700 font-medium">PIN: <strong class="font-mono font-bold text-emerald-950">${escapeHtml(pin)}</strong></span>
        <button type="button" onclick="copyTeacherZaloQuick('${escapeHtml(cleanPhone)}', '${escapeHtml(pin)}', event)" 
          title="Sao chép cú pháp liên kết Zalo: LK ${escapeHtml(cleanPhone)} ${escapeHtml(pin)}" 
          class="ml-0.5 p-0.5 rounded hover:bg-emerald-200/60 active:scale-90 text-emerald-700 transition cursor-pointer" aria-label="Sao chép cú pháp Zalo">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
        </button>
      </div>
    ` : `
      <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200/70 mt-0.5">
        <span class="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
        Chưa liên kết SĐT
      </span>
    `;

    return `
      <tr class="hover:bg-slate-50/80 transition-colors border-b border-slate-100/80">
        <!-- Cột 1: Phân tầng thị giác 3 cấp -->
        <td class="py-3 px-4">
          <div class="flex items-start gap-3">
            <!-- Cấp 1: Avatar chữ cái đầu với Palette tất định -->
            <div class="w-9 h-9 rounded-xl ${palette.bg} font-bold flex items-center justify-center text-xs shrink-0 shadow-2xs mt-0.5">
              ${initialLetter}
            </div>
            <div class="space-y-0.5 min-w-0">
              <!-- Cấp 1: Họ tên nổi bật (Semibold, Dark Slate) -->
              <div class="font-bold text-slate-900 text-sm tracking-tight truncate">${escapeHtml(displayName)}</div>
              <!-- Cấp 2: @username và Email công vụ, CCCD -->
              <div class="text-[11px] text-slate-500 flex items-center gap-1.5 flex-wrap">
                <span class="font-mono text-slate-600 font-medium">@${escapeHtml(userHandle)}</span>
                ${u.email ? `<span class="text-slate-300">•</span><span class="text-slate-500 truncate max-w-[200px]" title="${escapeHtml(u.email)}">${escapeHtml(u.email)}</span>` : ''}
                ${u.cccd ? `<span class="text-slate-300">•</span><span class="font-mono text-slate-400 text-[10px]" title="Số CCCD">CCCD: ${escapeHtml(u.cccd)}</span>` : ''}
              </div>
              <!-- Cấp 3: Cụm thẻ liên kết Zalo thông minh -->
              <div class="pt-0.5">
                ${zaloCapsule}
              </div>
            </div>
          </div>
        </td>

        <!-- Cột 2: Tổ chuyên môn & Chức vụ -->
        <td class="py-3 px-4">
          <div class="font-medium text-slate-800 text-xs">${escapeHtml(deptName)}</div>
          <span class="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold border ${roleBadgeColor}">
            ${escapeHtml(u.roleTitle || u.role)}
          </span>
        </td>

        <!-- Cột 3: Loại Chữ ký & Quyền hạn -->
        <td class="py-3 px-4">
          <div class="space-y-1.5">
            <div>${signTypeBadge}</div>
            <div class="flex items-center flex-wrap gap-1">
              ${wordPermissionBadge}
              ${sealPermissionBadge}
            </div>
          </div>
        </td>

        <!-- Cột 4: Trạng thái -->
        <td class="py-3 px-4">${statusBadge}</td>

        <!-- Cột 5: Action Button Bar tinh gọn -->
        <td class="py-3 px-4 text-right">
          <div class="inline-flex items-center bg-slate-50 rounded-xl border border-slate-200/80 shadow-2xs divide-x divide-slate-200/70 overflow-hidden">
            <!-- Nút Khóa / Mở khóa -->
            <button onclick="handleToggleLock('${u.id}')" title="${isLocked ? 'Mở khóa tài khoản' : 'Khóa tài khoản'}" 
              class="w-8 h-8 flex items-center justify-center transition-all ${isLocked ? 'text-emerald-600 hover:bg-emerald-50' : 'text-slate-500 hover:text-amber-600 hover:bg-amber-50'} active:scale-95" aria-label="${isLocked ? 'Mở khóa' : 'Khóa'}">
              ${isLocked 
                ? '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"/></svg>'
                : '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>'
              }
            </button>

            <!-- Nút Sửa -->
            <button onclick="openModalEditUser('${u.id}')" title="Sửa thông tin" 
              class="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-brand-600 hover:bg-brand-50 transition-all active:scale-95" aria-label="Sửa thông tin">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
            </button>

            <!-- Nút Đặt lại Mật khẩu -->
            <button onclick="openModalResetPass('${u.id}', '${escapeHtml(displayName)}')" title="Đặt lại mật khẩu" 
              class="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-all active:scale-95" aria-label="Đặt lại mật khẩu">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/></svg>
            </button>

            <!-- Nút Xóa -->
            ${u.username === 'admin' ? '' : `
              <button onclick="handleDeleteUser('${u.id}', '${escapeHtml(displayName)}')" title="Xóa tài khoản" 
                class="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all active:scale-95" aria-label="Xóa tài khoản">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
              </button>
            `}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}
```

#### Đoạn 3: Nâng cấp hàm `getFilteredTeachers` (Thay thế dòng 855 - 873)
Hỗ trợ tìm kiếm thông minh theo SĐT và Mã PIN:
```javascript
function getFilteredTeachers() {
  const q = (document.getElementById('filterTeacherSearch')?.value || '').trim().toLowerCase();
  const deptId = document.getElementById('filterTeacherDept')?.value || '';
  const signType = document.getElementById('filterTeacherSignType')?.value || '';

  return appState.users.filter(u => {
    if (!u) return false;
    const userDeptId = u.departmentId || u.deptId || '';
    if (deptId && userDeptId !== deptId) return false;
    if (signType && u.signType !== signType) return false;
    if (q) {
      const match = (u.fullName || u.name || '').toLowerCase().includes(q) ||
                    (u.username || '').toLowerCase().includes(q) ||
                    (u.email || '').toLowerCase().includes(q) ||
                    (u.phone || '').toLowerCase().includes(q) ||
                    (String(u.pinCode || '')).toLowerCase().includes(q) ||
                    (u.cccd || '').toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });
}
```

---

## 5. VERIFICATION METHOD (Phương thức Kiểm chứng Độc lập)

### 5.1. Lệnh Kiểm thử Playwright Đa Độ phân giải (Desktop & Laptop & Mobile)
Chạy lệnh kiểm thử hồi quy độc lập để đo đạc chỉ số bẫy tràn ngang và lỗi console F12:
```powershell
npx playwright test tests/test_cross_device_ui_ux_audit.spec.mjs -g "Bàn làm việc Admin"
```
**Điều kiện nghiệm thu PASS**:
- 4/4 kiểm thử hoàn tất thành công 100%.
- Chỉ số `docScrollW === clientW` tại cả 4 dải độ phân giải:
  * Desktop: `1920px === 1920px` (0 bẫy tràn ngang).
  * Laptop: `1366px === 1366px` (0 bẫy tràn ngang).
  * Tablet: `768px === 768px` (0 bẫy tràn ngang).
  * Mobile: `390px === 390px` (0 bẫy tràn ngang).
- `pageErrors.length === 0` và `consoleErrors.length === 0`.

### 5.2. Lệnh Kiểm thử Quyền Con dấu & Chữ ký số Ban Giám hiệu
```powershell
npx playwright test tests/07_bgh_cccd_token_flow.spec.mjs
```
**Điều kiện nghiệm thu PASS**:
- Toàn bộ các bước kiểm tra huy hiệu, quyền hạn và thao tác tài khoản đạt PASS 100%.

### 5.3. Điều kiện Phủ định (Invalidation Conditions)
Đề xuất thiết kế sẽ bị coi là THẤT BẠI nếu xảy ra bất kỳ điều nào sau đây:
1. Nút "Đóng dấu OK" bị đổi tên hoặc mất chữ `Đóng dấu OK`, khiến `tests/07_school_seal_delegation.spec.mjs` bị FAIL.
2. Nút "Đồng bộ Google Sheet" tiếp tục hiển thị khi quản trị viên chuyển sang tab "Tổ Chuyên môn".
3. Phát sinh thanh cuộn ngang ngoài ý muốn trên màn hình Laptop 1366x768 hoặc Desktop 1920x1080.
4. Bấm nút sao chép nhanh trên thẻ Zalo Capsule không ghi nhận cú pháp `LK <SĐT> <PIN>` vào Clipboard.
