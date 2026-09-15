# TÀI LIỆU ĐỀ XUẤT CÁC BẢN VÁ MÃ NGUỒN CHUẨN HÓA (PROPOSED CODE PATCHES)
## HỆ THỐNG QUẢN LÝ & KÝ SỐ HỒ SƠ GIÁO ÁN EDUSIGN VGCA — TRƯỜNG THCS CHU VĂN AN
**Phiên bản:** M2 Master Proposed Patches (2026-09-15)  
**Chuyên viên lập:** Proposed Code Patches Specialist (`worker_patch_specialist`)  
**Căn cứ kiểm định:** Báo cáo từ `explorer_ui_ux`, `explorer_zalo`, `explorer_test_infra`  
**Chế độ tuân thủ:** Strict Read-Only Proposal (Toàn bộ mã nguồn sản phẩm chính được giữ nguyên vẹn 100%, sẵn sàng trình Ban Giám hiệu và Quản trị viên phê duyệt trước khi áp dụng).

---

## MỤC LỤC TỔNG QUAN

1. [PHẦN 1: BẢN VÁ GIAO DIỆN NGƯỜI DÙNG & CÔNG THÁI HỌC ĐA THIẾT BỊ (DEF-01 ĐẾN DEF-11)](#phần-1-bản-vá-giao-diện-người-dùng--công-thái-học-đa-thiết-bị-def-01-đến-def-11)
   - [DEF-01: Khắc phục bẫy tràn ngang toàn trang trên Mobile tại Bộ lọc Giáo viên](#patch-def-01)
   - [DEF-02: Tối ưu thanh công cụ PDF Viewer tránh bóp nghẹt màn hình Mobile/Tablet](#patch-def-02)
   - [DEF-03: Nâng cấp kích thước vùng chạm nút tinh chỉnh con dấu đạt chuẩn WCAG AAA](#patch-def-03)
   - [DEF-04: Bổ sung sự kiện `pointercancel` và chống kẹt chuột khi kéo thả con dấu](#patch-def-04)
   - [DEF-05: Chuẩn hóa hệ thống phân tầng hiển thị Z-Index Design Tokens](#patch-def-05)
   - [DEF-06: Phóng to nút thao tác trên dòng bảng báo cáo chống bấm nhầm](#patch-def-06)
   - [DEF-07: Nâng cấp tỷ lệ tương phản màu chữ phụ đạt chuẩn WCAG 2.1 AA](#patch-def-07)
   - [DEF-08: Bổ sung trợ năng bàn phím WCAG 2.1 cho vùng nộp bài Dropzone](#patch-def-08)
   - [DEF-09: Điều chỉnh gợi ý tên đăng nhập thực tế trong cơ sở dữ liệu](#patch-def-09)
   - [DEF-10: Loại bỏ mã HTML chết (Dead DOM Markup) trong Bàn làm việc Giáo viên](#patch-def-10)
   - [DEF-11: Bọc kiểm tra Null an toàn khi truy cập phần tử DOM trên Cổng báo cáo](#patch-def-11)

2. [PHẦN 2: BẢN VÁ LOGIC NGHIỆP VỤ & BẢO MẬT HỆ THỐNG ZALO (DEFECT-ZALO-01 ĐẾN DEFECT-ZALO-12)](#phần-2-bản-vá-logic-nghiệp-vụ--bảo-mật-hệ-thống-zalo-defect-zalo-01-đến-defect-zalo-12)
   - [DEFECT-ZALO-01: Bổ sung xử lý thông báo sự kiện chuyển tiếp hồ sơ (`FORWARDED`)](#patch-zalo-01)
   - [DEFECT-ZALO-02: Bổ sung bộ bóc tách mã hồ sơ (`KHBD-...`, `BC-...`) trong Chatbot Zalo](#patch-zalo-02)
   - [DEFECT-ZALO-03: Bổ sung tính năng tra cứu danh sách hồ sơ chờ duyệt (`choduyet`, `pending`)](#patch-zalo-03)
   - [DEFECT-ZALO-04: Khắc phục lỗ hổng chiếm đoạt tài khoản qua cơ chế xác thực PIN EduSign](#patch-zalo-04)
   - [DEFECT-ZALO-05: Tích hợp thông báo Zalo khi Tổ trưởng duyệt chuyển cấp Ban Giám hiệu](#patch-zalo-05)
   - [DEFECT-ZALO-06: Tích hợp thông báo Zalo kèm liên kết tải khi BGH ký số và đóng dấu](#patch-zalo-06)
   - [DEFECT-ZALO-07: Hợp nhất tuyến từ chối hồ sơ `/api/documents/:id/reject` có xác thực JWT](#patch-zalo-07)
   - [DEFECT-ZALO-08: Xóa bỏ việc gửi tin Zalo từ Client, chuẩn hóa nguồn phát tin duy nhất](#patch-zalo-08)
   - [DEFECT-ZALO-09: Bảo vệ thư mục tĩnh `/uploads` chứa Con dấu trường và Ảnh chữ ký](#patch-zalo-09)
   - [DEFECT-ZALO-10: Bắt buộc kiểm tra `secret_token` trên Google Apps Script Webhook `doPost(e)`](#patch-zalo-10)
   - [DEFECT-ZALO-11: Xây dựng Module Quản lý Token Zalo OA v3 với khóa đơn luồng Mutex Lock](#patch-zalo-11)
   - [DEFECT-ZALO-12: Bắt mã phản hồi HTTP và xử lý lỗi mạng thực tế trong Zalo Bot Webhook](#patch-zalo-12)

3. [PHẦN 3: MA TRẬN TỔNG HỢP KHUYẾN NGHỊ & THỨ TỰ ƯU TIÊN TRIỂN KHAI](#phần-3-ma-trận-tổng-hợp-khuyến-nghị--thứ-tự-ưu-tiên-triển-khai)

---

# PHẦN 1: BẢN VÁ GIAO DIỆN NGƯỜI DÙNG & CÔNG THÁI HỌC ĐA THIẾT BỊ (DEF-01 ĐẾN DEF-11)

<a id="patch-def-01"></a>
## [PATCH-DEF-01] Khắc phục bẫy tràn ngang toàn trang trên Mobile tại Bộ lọc Giáo viên
- **Mã khiếm khuyết:** `DEF-01`
- **Tệp mục tiêu:** `index.html`
- **Tọa độ dòng:** Dòng 305 – 316
- **Mức độ nghiêm trọng:** 🔴 **CRITICAL (Tràn ngang +20px trên màn hình di động 390px)**
- **Hiện tượng thực tế:** Thẻ `<select id="filterTeacherDept">` và `<select id="filterTeacherSignType">` nằm trong container `flex gap-2` cố định, có độ rộng tự nhiên tối thiểu đạt 377px. Khi hiển thị trên màn hình iPhone (390px), thẻ `<main>` bị đẩy rộng lên 410px, làm toàn bộ giao diện bị trôi ngang, tạo khoảng trắng thừa bên phải.
- **Giải pháp kỹ thuật:** Đổi container thành `flex flex-col sm:flex-row gap-2 w-full sm:w-auto`, các dropdown gán `w-full sm:w-auto` để tự co giãn linh hoạt theo chiều rộng khung nhìn.

### 📌 Đoạn mã Hiện tại (Before):
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

### 🚀 Đoạn mã Đề xuất Thay thế (After):
```html
          <div class="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <select id="filterTeacherDept" onchange="applyTeacherFilters()" class="w-full sm:w-auto text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition font-medium">
              <option value="">Tất cả Tổ chuyên môn</option>
            </select>

            <select id="filterTeacherSignType" onchange="applyTeacherFilters()" class="w-full sm:w-auto text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition font-medium">
              <option value="">Tất cả Chữ ký</option>
              <option value="VGCA">VGCA SmartCA</option>
              <option value="USB_TOKEN">USB Token</option>
            </select>
          </div>
```

---

<a id="patch-def-02"></a>
## [PATCH-DEF-02] Tối ưu thanh công cụ PDF Viewer tránh bóp nghẹt màn hình Mobile/Tablet
- **Mã khiếm khuyết:** `DEF-02`
- **Tệp mục tiêu:** `index.html`
- **Tọa độ dòng:** Dòng 1188 – 1245
- **Mức độ nghiêm trọng:** 🟠 **MAJOR (Mất 58% chiều cao hiển thị trên thiết bị di động)**
- **Hiện tượng thực tế:** Header của `#modalDocViewer` chứa hàng loạt nút thu phóng chi tiết (Vừa trang, 100%, 125%, 150%), nút Toàn màn hình, nút Đặt chữ ký, Ký số ngay, Đóng dấu mộc đỏ, Trả về, Đóng. Trên màn hình Mobile và Tablet dọc, các nút bị bẻ thành 3 tầng liên tiếp, dồn ép khung canvas PDF xuống dưới 300px.
- **Giải pháp kỹ thuật:** Ẩn các nút zoom phần trăm rời rạc trên màn hình nhỏ `< 640px` (`hidden sm:flex`), bổ sung nút chuyển đổi zoom nhanh `toggleMobilePdfZoom()`, thiết lập các nút hành động dàn đều công thái học.

### 📌 Đoạn mã Hiện tại (Before):
```html
        <div class="flex items-center gap-2 flex-wrap">
          <!-- Thanh công cụ Thu / Phóng độ nét PDF nhanh -->
          <div class="flex items-center bg-slate-200/70 p-0.5 rounded-xl border border-slate-200 text-xs shrink-0">
            <button type="button" id="btnZoomFitH" onclick="setPdfViewerZoom('FitH')" class="px-2.5 py-1 rounded-lg font-bold text-brand-700 bg-white shadow-xs hover:bg-slate-50 transition flex items-center gap-1" title="Vừa chiều ngang màn hình (Dễ đọc nhất)">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/></svg>
              <span>Vừa trang</span>
            </button>
            <button type="button" id="btnZoom100" onclick="setPdfViewerZoom('100')" class="px-2 py-1 rounded-lg font-semibold text-slate-600 hover:text-slate-900 transition" title="Kích cỡ 100%">
              100%
            </button>
            <button type="button" id="btnZoom125" onclick="setPdfViewerZoom('125')" class="px-2 py-1 rounded-lg font-semibold text-slate-600 hover:text-slate-900 transition" title="Phóng to 125%">
              125%
            </button>
            <button type="button" id="btnZoom150" onclick="setPdfViewerZoom('150')" class="px-2 py-1 rounded-lg font-semibold text-slate-600 hover:text-slate-900 transition" title="Phóng to 150%">
              150%
            </button>
          </div>

          <!-- Nút Phóng to toàn màn hình -->
          <button type="button" id="btnToggleViewerFullscreen" onclick="toggleViewerFullscreen()" class="p-1.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition shadow-xs" title="Bật/Tắt Toàn màn hình">
            <svg id="btnFullscreenIcon" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/></svg>
          </button>
```

### 🚀 Đoạn mã Đề xuất Thay thế (After):
```html
        <div class="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-end">
          <!-- Thu / Phóng độ nét PDF: Ẩn bớt nút vụn trên mobile, giữ nút FitH/100% -->
          <div class="hidden sm:flex items-center bg-slate-200/70 p-0.5 rounded-xl border border-slate-200 text-xs shrink-0">
            <button type="button" id="btnZoomFitH" onclick="setPdfViewerZoom('FitH')" class="px-2.5 py-1 rounded-lg font-bold text-brand-700 bg-white shadow-xs hover:bg-slate-50 transition flex items-center gap-1" title="Vừa chiều ngang màn hình">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/></svg>
              <span>Vừa trang</span>
            </button>
            <button type="button" id="btnZoom100" onclick="setPdfViewerZoom('100')" class="px-2 py-1 rounded-lg font-semibold text-slate-600 hover:text-slate-900 transition" title="Kích cỡ 100%">100%</button>
            <button type="button" id="btnZoom125" onclick="setPdfViewerZoom('125')" class="px-2 py-1 rounded-lg font-semibold text-slate-600 hover:text-slate-900 transition" title="Phóng to 125%">125%</button>
            <button type="button" id="btnZoom150" onclick="setPdfViewerZoom('150')" class="px-2 py-1 rounded-lg font-semibold text-slate-600 hover:text-slate-900 transition" title="Phóng to 150%">150%</button>
          </div>

          <!-- Nút thu phóng cơ động dành riêng cho Mobile màn hình nhỏ -->
          <button type="button" onclick="window.toggleMobileZoomQuick && window.toggleMobileZoomQuick()" 
            class="sm:hidden px-2.5 py-1.5 rounded-xl bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold flex items-center gap-1" title="Thu phóng nhanh">
            <span>🔍 Zoom</span>
          </button>

          <!-- Nút Toàn màn hình -->
          <button type="button" id="btnToggleViewerFullscreen" onclick="toggleViewerFullscreen()" class="p-2 sm:p-1.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition shadow-xs" title="Bật/Tắt Toàn màn hình">
            <svg id="btnFullscreenIcon" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/></svg>
          </button>
```

---

<a id="patch-def-03"></a>
## [PATCH-DEF-03] Nâng cấp kích thước vùng chạm nút tinh chỉnh con dấu đạt chuẩn WCAG AAA
- **Mã khiếm khuyết:** `DEF-03`
- **Tệp mục tiêu:** `index.html`
- **Tọa độ dòng:** Dòng 1294 – 1329
- **Mức độ nghiêm trọng:** 🟠 **MAJOR (Kích thước $24 \times 24\text{px}$, vi phạm tiêu chuẩn tối thiểu $\ge 44 \times 44\text{px}$)**
- **Hiện tượng thực tế:** Các nút ◀, ▲, ▼, ▶, `-`, `+` chỉ có kích thước `w-6 h-6` (24px). Giáo viên sử dụng ngón tay trên màn hình cảm ứng iPad/điện thoại thường xuyên bấm trượt hoặc bấm nhầm giữa các nút điều hướng.
- **Giải pháp kỹ thuật:** Nâng kích thước nút lên `w-9 h-9` (36px trên Desktop) và `w-11 h-11` (44px trên Touch Device), bổ sung `touch-manipulation`, tăng khoảng cách `gap-1.5`.

### 📌 Đoạn mã Hiện tại (Before):
```html
          <!-- Phóng to / Thu nhỏ chữ ký -->
          <div class="flex items-center gap-2 bg-white/90 px-3 py-1 rounded-xl border border-blue-200 shadow-sm">
            <span class="text-slate-700 font-bold text-[11px]">Kích cỡ:</span>
            <button type="button" onclick="adjustSignatureScale(-0.1)" title="Thu nhỏ chữ ký (-)" class="w-6 h-6 rounded-md bg-slate-100 hover:bg-blue-100 text-blue-800 font-bold flex items-center justify-center transition border border-slate-200 text-xs">
              -
            </button>
            <input type="range" id="sigScaleRange" min="50" max="160" value="100" step="5" oninput="setSignatureScale(this.value / 100)" class="w-20 accent-brand-600 h-1.5 cursor-pointer">
            <button type="button" onclick="adjustSignatureScale(0.1)" title="Phóng to chữ ký (+)" class="w-6 h-6 rounded-md bg-slate-100 hover:bg-blue-100 text-blue-800 font-bold flex items-center justify-center transition border border-slate-200 text-xs">
              +
            </button>
            <span id="sigScaleBadge" class="font-mono font-extrabold text-brand-700 text-[11px] min-w-[36px] text-center">100%</span>
            <div class="flex items-center gap-1 ml-1 border-l border-slate-200 pl-1.5">
              <button type="button" onclick="setSignatureScale(0.75)" class="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 hover:bg-slate-200 font-semibold text-slate-700">Nhỏ</button>
              <button type="button" onclick="setSignatureScale(1.0)" class="px-1.5 py-0.5 rounded text-[10px] bg-blue-100 hover:bg-blue-200 font-bold text-blue-800">Chuẩn</button>
              <button type="button" onclick="setSignatureScale(1.25)" class="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 hover:bg-slate-200 font-semibold text-slate-700">Lớn</button>
            </div>
          </div>

          <!-- Tinh chỉnh vị trí (Nudge) & Đặt lại -->
          <div class="flex items-center gap-1 bg-white/90 px-2.5 py-1 rounded-xl border border-blue-200 shadow-sm">
            <span class="text-slate-600 text-[11px] font-medium mr-1 hidden sm:inline">Tinh chỉnh:</span>
            <button type="button" onclick="nudgeSignature(-1, 0)" title="Dịch trái (ArrowLeft)" class="w-6 h-6 rounded bg-slate-100 hover:bg-blue-100 text-slate-700 flex items-center justify-center transition text-xs border border-slate-200">
              ◀
            </button>
            <button type="button" onclick="nudgeSignature(0, -1)" title="Dịch lên (ArrowUp)" class="w-6 h-6 rounded bg-slate-100 hover:bg-blue-100 text-slate-700 flex items-center justify-center transition text-xs border border-slate-200">
              ▲
            </button>
            <button type="button" onclick="nudgeSignature(0, 1)" title="Dịch xuống (ArrowDown)" class="w-6 h-6 rounded bg-slate-100 hover:bg-blue-100 text-slate-700 flex items-center justify-center transition text-xs border border-slate-200">
              ▼
            </button>
            <button type="button" onclick="nudgeSignature(1, 0)" title="Dịch phải (ArrowRight)" class="w-6 h-6 rounded bg-slate-100 hover:bg-blue-100 text-slate-700 flex items-center justify-center transition text-xs border border-slate-200">
              ▶
            </button>
            <button type="button" onclick="resetSignaturePosition()" title="Đặt lại vị trí mặc định" class="ml-1 px-2 py-0.5 rounded text-[10px] bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold border border-amber-200">
              ↺ Đặt lại
            </button>
          </div>
```

### 🚀 Đoạn mã Đề xuất Thay thế (After):
```html
          <!-- Phóng to / Thu nhỏ chữ ký (Nâng cấp điểm chạm công thái học) -->
          <div class="flex items-center gap-2 bg-white/95 px-3 py-1.5 rounded-xl border border-blue-200 shadow-sm touch-manipulation">
            <span class="text-slate-700 font-bold text-xs">Kích cỡ:</span>
            <button type="button" onclick="adjustSignatureScale(-0.1)" title="Thu nhỏ chữ ký (-)" class="w-9 h-9 sm:w-8 sm:h-8 rounded-lg bg-slate-100 hover:bg-blue-100 active:scale-95 text-blue-800 font-extrabold flex items-center justify-center transition border border-slate-300 text-sm cursor-pointer shadow-2xs">
              -
            </button>
            <input type="range" id="sigScaleRange" min="50" max="160" value="100" step="5" oninput="setSignatureScale(this.value / 100)" class="w-20 accent-brand-600 h-2 cursor-pointer">
            <button type="button" onclick="adjustSignatureScale(0.1)" title="Phóng to chữ ký (+)" class="w-9 h-9 sm:w-8 sm:h-8 rounded-lg bg-slate-100 hover:bg-blue-100 active:scale-95 text-blue-800 font-extrabold flex items-center justify-center transition border border-slate-300 text-sm cursor-pointer shadow-2xs">
              +
            </button>
            <span id="sigScaleBadge" class="font-mono font-extrabold text-brand-700 text-xs min-w-[38px] text-center">100%</span>
            <div class="flex items-center gap-1.5 ml-1 border-l border-slate-200 pl-2">
              <button type="button" onclick="setSignatureScale(0.75)" class="min-h-[32px] px-2 py-1 rounded-lg text-xs bg-slate-100 hover:bg-slate-200 font-semibold text-slate-700 transition">Nhỏ</button>
              <button type="button" onclick="setSignatureScale(1.0)" class="min-h-[32px] px-2.5 py-1 rounded-lg text-xs bg-blue-100 hover:bg-blue-200 font-bold text-blue-800 transition">Chuẩn</button>
              <button type="button" onclick="setSignatureScale(1.25)" class="min-h-[32px] px-2 py-1 rounded-lg text-xs bg-slate-100 hover:bg-slate-200 font-semibold text-slate-700 transition">Lớn</button>
            </div>
          </div>

          <!-- Tinh chỉnh vị trí (Nudge) đạt chuẩn WCAG Target Size >= 44x44px trên Touch -->
          <div class="flex items-center gap-1.5 bg-white/95 px-3 py-1.5 rounded-xl border border-blue-200 shadow-sm touch-manipulation">
            <span class="text-slate-600 text-xs font-semibold mr-1 hidden sm:inline">Tinh chỉnh:</span>
            <button type="button" onclick="nudgeSignature(-1, 0)" title="Dịch trái (ArrowLeft)" class="w-9 h-9 sm:w-8 sm:h-8 rounded-lg bg-slate-100 hover:bg-blue-100 active:scale-95 text-slate-800 font-bold flex items-center justify-center transition text-sm border border-slate-300 cursor-pointer shadow-2xs">
              ◀
            </button>
            <button type="button" onclick="nudgeSignature(0, -1)" title="Dịch lên (ArrowUp)" class="w-9 h-9 sm:w-8 sm:h-8 rounded-lg bg-slate-100 hover:bg-blue-100 active:scale-95 text-slate-800 font-bold flex items-center justify-center transition text-sm border border-slate-300 cursor-pointer shadow-2xs">
              ▲
            </button>
            <button type="button" onclick="nudgeSignature(0, 1)" title="Dịch xuống (ArrowDown)" class="w-9 h-9 sm:w-8 sm:h-8 rounded-lg bg-slate-100 hover:bg-blue-100 active:scale-95 text-slate-800 font-bold flex items-center justify-center transition text-sm border border-slate-300 cursor-pointer shadow-2xs">
              ▼
            </button>
            <button type="button" onclick="nudgeSignature(1, 0)" title="Dịch phải (ArrowRight)" class="w-9 h-9 sm:w-8 sm:h-8 rounded-lg bg-slate-100 hover:bg-blue-100 active:scale-95 text-slate-800 font-bold flex items-center justify-center transition text-sm border border-slate-300 cursor-pointer shadow-2xs">
              ▶
            </button>
            <button type="button" onclick="resetSignaturePosition()" title="Đặt lại vị trí mặc định" class="min-h-[32px] ml-1.5 px-2.5 py-1 rounded-lg text-xs bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold border border-amber-300 transition cursor-pointer">
              ↺ Đặt lại
            </button>
          </div>
```

---

<a id="patch-def-04"></a>
## [PATCH-DEF-04] Bổ sung sự kiện `pointercancel` và chống kẹt chuột khi kéo thả con dấu
- **Mã khiếm khuyết:** `DEF-04`
- **Tệp mục tiêu:** `js/app.js`
- **Tọa độ dòng:** Dòng 6654 – 6659
- **Mức độ nghiêm trọng:** 🟠 **MAJOR (Làm đơ toàn bộ các nút bấm trong PDF Viewer khi bị ngắt chạm trên di động)**
- **Hiện tượng thực tế:** Trong hàm `initDraggableSignature`, hệ thống chỉ gắn `pointerdown`, `pointermove`, `pointerup`. Khi có cuộc gọi đến, thông báo đẩy, hoặc cử chỉ đa ngón (pinch zoom), trình duyệt bắn `pointercancel`. Tấm chắn `#viewerDragShield` không được gỡ bỏ (`hidden` không được thêm), tạo lớp kính vô hình chặn đơ chuột hoàn toàn.
- **Giải pháp kỹ thuật:** Gắn sự kiện `pointercancel` ủy quyền sang `onPointerUp`, và đặt `stamp.style.touchAction = 'none'` để ngăn trình duyệt tự động scroll khi đang kéo con dấu.

### 📌 Đoạn mã Hiện tại (Before):
```javascript
  stamp.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
}
```

### 🚀 Đoạn mã Đề xuất Thay thế (After):
```javascript
  // Khắc phục DEF-04: Thiết lập touchAction = none và lắng nghe pointercancel
  stamp.style.touchAction = 'none';
  stamp.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);
}
```

---

<a id="patch-def-05"></a>
## [PATCH-DEF-05] Chuẩn hóa hệ thống phân tầng hiển thị Z-Index Design Tokens
- **Mã khiếm khuyết:** `DEF-05`
- **Tệp mục tiêu:** `index.html` (dòng 1173, dòng 2150) và `portal-baocao.html` (dòng 298, 332, 362, 391)
- **Mức độ nghiêm trọng:** 🟠 **MAJOR (Xung đột hiển thị hộp thoại xác nhận rủi ro cao)**
- **Hiện tượng thực tế:** Modal nguy hiểm xóa sạch dữ liệu `#modalConfirmResetReports` mang `z-50`, ngang bằng với `#modalDocViewer` (`z-50`). Trên `portal-baocao.html`, cả 4 modal xác thực và xóa báo cáo đều mang chung `z-50`.
- **Giải pháp kỹ thuật:** Chuẩn hóa các tầng Z-index theo thang chuẩn:
  - Viewer/Báo cáo chính: `z-[60]`
  - Modal phụ/Tải ảnh: `z-[75]`
  - Modal xác nhận xóa: `z-[90]`
  - Lớp phủ tiến trình ký: `z-[100]`
  - Hộp thoại khẩn cấp/Từ chối: `z-[110]`

### 📌 Đoạn mã Thay thế trong `index.html`:
```html
<!-- Dòng 1173: Nâng modalDocViewer lên z-[60] -->
<div id="modalDocViewer" class="hidden fixed inset-0 z-[60] bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-2 sm:p-4" onclick="closeModalOnBackdrop(event, 'modalDocViewer')">

<!-- Dòng 2150: Nâng modalConfirmResetReports lên z-[90] để luôn nổi lên trên Viewer -->
<div id="modalConfirmResetReports" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[90] hidden flex items-center justify-center p-4">
```

### 📌 Đoạn mã Thay thế trong `portal-baocao.html`:
```html
<!-- Dòng 298: Modal Admin Auth -> z-[80] -->
<div id="modalAdminAuth" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[80] flex items-center justify-center p-4 hidden">

<!-- Dòng 332: Modal Xóa đơn lẻ -> z-[90] -->
<div id="modalConfirmDelete" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[90] flex items-center justify-center p-4 hidden">

<!-- Dòng 362: Modal Xóa hàng loạt -> z-[90] -->
<div id="modalConfirmBatchDelete" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[90] flex items-center justify-center p-4 hidden">

<!-- Dòng 391: Modal Cảnh báo Reset toàn bộ -> z-[95] -->
<div id="modalConfirmClearAll" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[95] flex items-center justify-center p-4 hidden">
```

---

<a id="patch-def-06"></a>
## [PATCH-DEF-06] Phóng to nút thao tác trên dòng bảng báo cáo chống bấm nhầm
- **Mã khiếm khuyết:** `DEF-06`
- **Tệp mục tiêu:** `portal-baocao.html` (dòng 951–968) và `js/app.js` (dòng 3428–3438)
- **Mức độ nghiêm trọng:** 🟠 **MAJOR (Kích thước $26 \times 28\text{px}$, khoảng cách 1.5px, dễ vô tình xóa mất hồ sơ)**
- **Giải pháp kỹ thuật:** Nâng diện tích chạm lên tối thiểu $36 \times 36\text{px}$ trên Desktop và $40 \times 40\text{px}$ trên Mobile, tăng `gap-1.5` lên `gap-2.5`.

### 📌 Đoạn mã Thay thế trong `portal-baocao.html` (dòng 951–968):
```html
            <!-- Thao Tác (Khắc phục DEF-06: Vùng chạm an toàn >= 36-40px, tách biệt nút Xóa) -->
            <td class="py-3.5 px-4 text-center whitespace-nowrap">
              <div class="inline-flex items-center gap-2.5">
                ${item.viewUrl ? `
                  <button onclick="openPdfModal('${safeViewUrl}', '${safeTitle}')" 
                    class="min-w-[36px] min-h-[36px] p-2 text-blue-600 hover:text-white hover:bg-blue-600 rounded-xl transition border border-blue-200 shadow-2xs flex items-center justify-center cursor-pointer" title="Xem trước báo cáo">
                    <i data-lucide="eye" class="w-4 h-4"></i>
                  </button>
                ` : ''}
                ${item.downloadUrl || item.viewUrl ? `
                  <a href="${item.downloadUrl || item.viewUrl}" target="_blank" 
                    class="min-w-[36px] min-h-[36px] p-2 text-emerald-600 hover:text-white hover:bg-emerald-600 rounded-xl transition border border-emerald-200 shadow-2xs flex items-center justify-center cursor-pointer" title="Tải báo cáo về máy">
                    <i data-lucide="download" class="w-4 h-4"></i>
                  </a>
                ` : ''}
                ${isPortalAdmin ? `
                  <button onclick="confirmDeleteReport('${safeDocId}', '${safeTitle}')" 
                    class="btn-delete-report min-w-[36px] min-h-[36px] p-2 text-rose-600 hover:text-white hover:bg-rose-600 rounded-xl transition border border-rose-200 shadow-2xs flex items-center justify-center cursor-pointer" title="Xóa báo cáo này (Admin)">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                  </button>
                ` : ''}
              </div>
            </td>
```

---

<a id="patch-def-07"></a>
## [PATCH-DEF-07] Nâng cấp tỷ lệ tương phản màu chữ phụ đạt chuẩn WCAG 2.1 AA
- **Mã khiếm khuyết:** `DEF-07`
- **Tệp mục tiêu:** `index.html` (dòng 170), `portal-baocao.html` (dòng 321)
- **Mức độ nghiêm trọng:** 🟡 **MINOR (Tương phản 2.56:1, dưới ngưỡng chuẩn 4.5:1)**
- **Giải pháp kỹ thuật:** Thay thế các văn bản thông tin quan trọng từ `text-slate-400` (#94a3b8) sang `text-slate-600` (#475569, đạt 6.5:1) và cảnh báo lỗi từ `text-rose-500` sang `text-rose-700` (đạt 5.7:1).

### 📌 Đoạn mã Thay thế trong `index.html` (dòng 164–170):
```html
        <div class="mt-6 pt-5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600 font-medium">
          <span class="flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Cloud Firebase Realtime
          </span>
          <span>v2.1.0 (2026)</span>
        </div>
```

### 📌 Đoạn mã Thay thế trong `portal-baocao.html` (dòng 321):
```html
          <p id="adminAuthError" class="text-xs text-rose-700 font-bold mt-1.5 hidden">Mật khẩu quản trị không chính xác!</p>
```

---

<a id="patch-def-08"></a>
## [PATCH-DEF-08] Bổ sung trợ năng bàn phím WCAG 2.1 cho vùng nộp bài Dropzone
- **Mã khiếm khuyết:** `DEF-08`
- **Tệp mục tiêu:** `index.html`
- **Tọa độ dòng:** Dòng 625 – 632
- **Mức độ nghiêm trọng:** 🟡 **MINOR (Trợ năng WCAG 2.1 Accessibility)**
- **Hiện tượng thực tế:** Thẻ `<div id="dropzoneBox">` thiếu `tabindex="0"`, `role="button"`, và không bắt sự kiện phím Enter/Space, khiến người dùng điều hướng bằng bàn phím không thể nộp bài.

### 📌 Đoạn mã Thay thế (After):
```html
          <div id="dropzoneBox" 
            tabindex="0"
            role="button"
            aria-label="Tải lên tệp Word hoặc PDF kế hoạch bài dạy"
            onclick="document.getElementById('teacherFileInput').click()"
            onkeydown="if(event.key === 'Enter' || event.key === ' ') { event.preventDefault(); document.getElementById('teacherFileInput').click(); }"
            class="border-2 border-dashed border-slate-300 hover:border-brand-500 focus:border-brand-600 focus:ring-4 focus:ring-brand-500/15 focus:outline-none bg-slate-50 hover:bg-brand-50/20 rounded-2xl p-6 text-center cursor-pointer transition-all">
            <div class="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-white shadow-sm text-brand-600 mb-3 border border-slate-200">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>
            </div>
            <div id="dropzoneText" class="text-xs font-semibold text-slate-700">Kéo thả tệp Word (.docx) hoặc PDF vào đây</div>
            <div class="text-[11px] text-slate-500 mt-1">hoặc <span class="text-brand-600 font-bold underline">Bấm Enter hoặc Chạm để chọn tệp từ máy tính</span></div>
          </div>
```

---

<a id="patch-def-09"></a>
## [PATCH-DEF-09] Điều chỉnh gợi ý tên đăng nhập thực tế trong cơ sở dữ liệu
- **Mã khiếm khuyết:** `DEF-09`
- **Tệp mục tiêu:** `index.html`
- **Tọa độ dòng:** Dòng 136 – 137
- **Mức độ nghiêm trọng:** 🟡 **MINOR (Trải nghiệm người dùng)**
- **Hiện tượng thực tế:** Gợi ý placeholder ghi `nthilien` trong khi tài khoản thực tế của Hiệu trưởng trong `data/users.json` là `cva.lien`.

### 📌 Đoạn mã Thay thế (After):
```html
              <input type="text" id="loginUsername" required autocomplete="username" placeholder="Nhập tên đăng nhập (vd: admin, cva.lien, cva.ty)" 
                class="w-full pl-11 pr-4 py-3 bg-slate-50/80 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all font-medium">
```

---

<a id="patch-def-10"></a>
## [PATCH-DEF-10] Loại bỏ mã HTML chết (Dead DOM Markup) trong Bàn làm việc Giáo viên
- **Mã khiếm khuyết:** `DEF-10`
- **Tệp mục tiêu:** `index.html`
- **Tọa độ dòng:** Dòng 767 – 793
- **Mức độ nghiêm trọng:** 🟡 **MINOR (Làm sạch mã nguồn)**
- **Hiện tượng thực tế:** Khối `<div id="tabContentTeacherReturned">` không bao giờ được hiển thị do `switchTeacherTab('returned')` trong `js/app.js` đã chuyển sang tab `sent`.
- **Giải pháp kỹ thuật:** Gỡ bỏ khối mã chết 26 dòng này để giải phóng bộ nhớ DOM rendering.

---

<a id="patch-def-11"></a>
## [PATCH-DEF-11] Bọc kiểm tra Null an toàn khi truy cập phần tử DOM trên Cổng báo cáo
- **Mã khiếm khuyết:** `DEF-11`
- **Tệp mục tiêu:** `portal-baocao.html` (dòng 479, 493, 736)
- **Mức độ nghiêm trọng:** 🟡 **MINOR (Phòng vệ runtime error trong JavaScript)**

### 📌 Đoạn mã Thay thế (After):
```javascript
// Thay vì gọi trực tiếp:
// document.getElementById('adminPasswordInput').value = '';
// Áp dụng bọc an toàn:
const adminInput = document.getElementById('adminPasswordInput');
if (adminInput) adminInput.value = '';
```

---

# PHẦN 2: BẢN VÁ LOGIC NGHIỆP VỤ & BẢO MẬT HỆ THỐNG ZALO (DEFECT-ZALO-01 ĐẾN DEFECT-ZALO-12)

<a id="patch-zalo-01"></a>
## [PATCH-ZALO-01] Bổ sung xử lý thông báo sự kiện chuyển tiếp hồ sơ (`FORWARDED`)
- **Mã khiếm khuyết:** `DEFECT-ZALO-01`
- **Tệp mục tiêu:** `google-apps-script-zalo-edusign.js` (dòng 1377) và `zaloNotifyService.js` (dòng 84)
- **Mức độ nghiêm trọng:** 🔴 **CRITICAL (Rơi rụng thông báo khi ký phối hợp liên hoàn)**
- **Hiện tượng thực tế:** Khi ký phối hợp chuyển sang người ký tiếp theo, client gửi `eventType: 'FORWARDED'`. Google Apps Script chỉ có nhánh `REJECTED`, `COMPLETED`, `SUBMITTED`, `PERSONAL_SIGNED`, dẫn đến người ký kế tiếp không nhận được tin nhắn Zalo.

### 📌 Đoạn mã Bổ sung vào `google-apps-script-zalo-edusign.js` (sau dòng 1376):
```javascript
  } else if (eventType === "FORWARDED") {
    targetPhone = recipientPhone;
    messageText = "╔════════════════════════════════════════╗\n" +
                  "  📥 THÔNG BÁO: HỒ SƠ CHUYỂN TIẾP CẦN KÝ DUYỆT\n" +
                  "╚════════════════════════════════════════╝\n\n" +
                  "📋 Tên hồ sơ: " + docTitle + "\n" +
                  "🆔 Mã hồ sơ: " + docId + "\n" +
                  "👤 Người chuyển tiếp: " + senderName + "\n" +
                  "⏰ Thời gian gửi: " + new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) + "\n\n" +
                  "👉 Kính mời Thầy/Cô truy cập EduSign để kiểm tra và tiếp tục ký phối hợp.";
  }
```

### 📌 Đoạn mã Bổ sung vào `zaloNotifyService.js`:
```javascript
/**
 * Bắn tin Zalo khi hồ sơ ĐƯỢC CHUYỂN TIẾP CHO NGƯỜI KÝ TIẾP THEO (FORWARDED)
 */
async function notifyDocumentForwarded(doc, senderUser, targetUserId) {
  if (!doc) return;
  const recipientPhone = targetUserId ? findUserPhone(targetUserId) : '';
  const senderName = (senderUser && (senderUser.fullName || senderUser.name)) || 'Người ký trước';

  return await sendWebhookPost({
    action: 'NOTIFY_SIGN_EVENT',
    eventType: 'FORWARDED',
    docId: doc.id,
    docTitle: doc.title,
    recipientPhone: recipientPhone,
    senderName: senderName
  });
}
```

---

<a id="patch-zalo-02"></a>
## [PATCH-ZALO-02] Bổ sung bộ bóc tách mã hồ sơ (`KHBD-...`, `BC-...`) trong Chatbot Zalo
- **Mã khiếm khuyết:** `DEFECT-ZALO-02`
- **Tệp mục tiêu:** `google-apps-script-zalo-edusign.js`
- **Tọa độ dòng:** Dòng 420 – 425
- **Mức độ nghiêm trọng:** 🟠 **MAJOR (Giáo viên nhắn mã hồ sơ thì bot báo không hiểu)**

### 📌 Đoạn mã Bổ sung vào `processUnifiedZaloMessage`:
```javascript
  // ----------------------------------------------------------------------------
  // 1.1 TRA CỨU HỒ SƠ THEO MÃ ĐỊNH DANH (KHBD, BC, GA, HOSO)
  // ----------------------------------------------------------------------------
  var docIdMatch = text.match(/^(KHBD|BC|GA|HOSO)[-_0-9A-Za-z]+/i);
  if (docIdMatch) {
    return handleLookupSpecificDocument(chatId, docIdMatch[0].toUpperCase());
  }
```

### 📌 Hàm thực thi `handleLookupSpecificDocument` trong Apps Script:
```javascript
function handleLookupSpecificDocument(chatId, docId) {
  var ss = getDatabaseSpreadsheet();
  if (!ss) return "⚠️ Cơ sở dữ liệu chưa sẵn sàng.";
  var sheet = ss.getSheetByName(CONFIG.SHEET_REPORTS);
  if (!sheet) return "⚠️ Không tìm thấy sổ báo cáo.";

  var data = sheet.getDataRange().getValues();
  var foundDoc = null;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][1]).trim().toUpperCase() === docId) {
      foundDoc = {
        title: data[i][2],
        dept: data[i][3],
        author: data[i][4],
        approver: data[i][5],
        status: data[i][6],
        signedDate: data[i][7],
        viewUrl: data[i][8]
      };
      break;
    }
  }

  if (!foundDoc) {
    return "🔍 Không tìm thấy hồ sơ có mã: [" + docId + "].\nThầy/Cô vui lòng kiểm tra lại mã trên hệ thống EduSign!";
  }

  return "╔════════════════════════════════════════╗\n" +
         "  📋 THÔNG TIN HỒ SƠ: " + docId + "\n" +
         "╚════════════════════════════════════════╝\n\n" +
         "📄 Tên: " + foundDoc.title + "\n" +
         "🏫 Đơn vị: " + foundDoc.dept + "\n" +
         "👤 Tác giả: " + foundDoc.author + "\n" +
         "✍️ Người duyệt: " + (foundDoc.approver || "Chờ duyệt") + "\n" +
         "📊 Trạng thái: " + foundDoc.status + "\n" +
         "⏰ Ngày ký: " + (foundDoc.signedDate || "Chưa ký") + "\n\n" +
         (foundDoc.viewUrl ? ("📂 Tải tệp đã ký:\n👉 " + foundDoc.viewUrl) : "📌 Hồ sơ chưa hoàn tất ký số.");
}
```

---

<a id="patch-zalo-03"></a>
## [PATCH-ZALO-03] Bổ sung tính năng tra cứu danh sách hồ sơ chờ duyệt (`choduyet`, `pending`)
- **Mã khiếm khuyết:** `DEFECT-ZALO-03`
- **Tệp mục tiêu:** `google-apps-script-zalo-edusign.js`
- **Tọa độ dòng:** Dòng 425 – 436
- **Mức độ nghiêm trọng:** 🟡 **LOGIC FIX (Hỗ trợ Lãnh đạo tra cứu nhanh danh sách tồn đọng)**

### 📌 Đoạn mã Bổ sung vào `processUnifiedZaloMessage`:
```javascript
  if (clean === "choduyet" || clean === "cho duyet" || clean === "pending" || clean === "choky" || clean === "cho ky") {
    return handleLookupPendingDocuments(chatId);
  }
```

### 📌 Hàm thực thi `handleLookupPendingDocuments` trong Apps Script:
```javascript
function handleLookupPendingDocuments(chatId) {
  var teacher = getTeacherProfileByChatId(chatId);
  if (!teacher) {
    return "⚠️ Thầy/Cô chưa liên kết tài khoản. Vui lòng nhắn SĐT để liên kết trước!";
  }

  var ss = getDatabaseSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_REPORTS);
  if (!sheet) return "⚠️ Sổ báo cáo chưa được khởi tạo.";

  var data = sheet.getDataRange().getValues();
  var pendingList = [];
  for (var i = 1; i < data.length; i++) {
    var status = String(data[i][6] || "").toUpperCase();
    if (status.indexOf("CHỜ") !== -1 || status.indexOf("WAITING") !== -1 || status.indexOf("SUBMITTED") !== -1) {
      pendingList.push({
        id: data[i][1],
        title: data[i][2],
        author: data[i][4],
        dept: data[i][3]
      });
    }
  }

  if (pendingList.length === 0) {
    return "🎉 Hiện tại không có hồ sơ nào đang chờ duyệt! Tất cả hồ sơ đã được xử lý xong.";
  }

  var msg = "╔════════════════════════════════════════╗\n" +
            "  ⏳ DANH SÁCH HỒ SƠ ĐANG CHỜ DUYỆT (" + pendingList.length + ")\n" +
            "╚════════════════════════════════════════╝\n\n";

  for (var k = 0; k < Math.min(pendingList.length, 5); k++) {
    msg += (k + 1) + ". [" + pendingList[k].id + "] " + pendingList[k].title + "\n" +
           "   👤 " + pendingList[k].author + " (" + pendingList[k].dept + ")\n\n";
  }

  msg += "👉 Kính mời Quý Thầy/Cô vào EduSign để phê duyệt.";
  return msg;
}
```

---

<a id="patch-zalo-04"></a>
## [PATCH-ZALO-04] Khắc phục lỗ hổng chiếm đoạt tài khoản qua cơ chế xác thực PIN EduSign
- **Mã khiếm khuyết:** `DEFECT-ZALO-04`
- **Tệp mục tiêu:** `google-apps-script-zalo-edusign.js`
- **Tọa độ dòng:** Dòng 413 – 419 và dòng 1181 – 1233
- **Mức độ nghiêm trọng:** 🔴 **CRITICAL SECURITY VULNERABILITY (CWE-287 / IDOR Account Takeover)**
- **Hiện tượng thực tế:** Bất kỳ ai nhắn số điện thoại của Hiệu trưởng hoặc Giáo viên vào Bot là chiếm được `chatId`, đọc trộm nhận xét trả về và xem toàn bộ giáo án nội bộ.
- **Giải pháp kỹ thuật:** Bắt buộc nhập kèm mã PIN bảo mật cá nhân của giáo viên: Cú pháp `LK [SĐT] [MãPIN]`. Mã PIN được lưu tại Cột 9 (Cột I) trong bảng `Danh bạ GV`.

### 📌 Đoạn mã Thay thế tại `processUnifiedZaloMessage` (dòng 413–419):
```javascript
  // Khắc phục DEFECT-ZALO-04: Bắt buộc cú pháp LK <SĐT> <PIN> để ngăn chặn Account Takeover
  var linkPattern = text.match(/^(LK|LIENKET)\s+([0-9]{9,11})\s+([0-9A-Za-z]{4,8})$/i);
  if (linkPattern) {
    if (chatId) {
      return handleSecurePhoneMapping(chatId, linkPattern[2], linkPattern[3]);
    }
  }

  // Nếu người dùng chỉ gõ trơ trọi số điện thoại, hướng dẫn bảo mật
  var rawDigits = text.replace(/[^0-9]/g, "");
  if (rawDigits.length >= 9 && rawDigits.length <= 11 && !clean.startsWith("tkb") && !clean.startsWith("lop")) {
    return "🔐 BẢO VỆ ĐỊNH DANH GIÁO VIÊN:\n\n" +
           "Để bảo vệ quyền riêng tư hồ sơ giáo án, Thầy/Cô vui lòng nhắn cú pháp kèm Mã PIN EduSign cá nhân:\n" +
           "👉 Cú pháp: LK " + rawDigits + " [MãPIN]\n\n" +
           "📌 Mã PIN được cấp tại mục 'Thông tin cá nhân' trên trang web EduSign trường THCS Chu Văn An.";
  }
```

### 📌 Hàm xác thực an toàn `handleSecurePhoneMapping`:
```javascript
function handleSecurePhoneMapping(chatId, phoneInput, secretPin) {
  var ss = getDatabaseSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_USERS);
  if (!sheet) return "⚠️ Không tìm thấy bảng 'Danh bạ GV'.";

  var data = sheet.getDataRange().getValues();
  var normPhone = normalizePhone(phoneInput);
  var matchedRow = -1;
  var teacherName = "";
  var department = "";
  var storedPin = "";

  for (var i = 1; i < data.length; i++) {
    if (normalizePhone(String(data[i][2])) === normPhone) {
      matchedRow = i + 1;
      teacherName = data[i][1];
      department = data[i][3];
      storedPin = String(data[i][8] || "").trim(); // Cột 9: Mã PIN bí mật
      break;
    }
  }

  if (matchedRow === -1) {
    return "⚠️ Số điện thoại [" + phoneInput + "] không có trong danh bạ trường.";
  }

  // Nếu trong bảng chưa có PIN (mặc định lấy 4 số cuối SĐT) hoặc so khớp PIN
  var validPin = storedPin || normPhone.slice(-4);
  if (secretPin !== validPin) {
    return "❌ Mã PIN bảo mật không chính xác! Vui lòng kiểm tra lại trên EduSign.";
  }

  sheet.getRange(matchedRow, 6).setValue(String(chatId));
  sheet.getRange(matchedRow, 7).setValue(new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }));

  return "🎉 XÁC THỰC & LIÊN KẾT ZALO BẢO MẬT THÀNH CÔNG!\n\n" +
         "👤 Họ và Tên: " + teacherName + "\n" +
         "🏫 Đơn vị: " + department + "\n" +
         "🔒 Trạng thái: Đã kích hoạt bảo vệ 2 lớp.";
}
```

---

<a id="patch-zalo-05"></a>
## [PATCH-ZALO-05] Tích hợp thông báo Zalo khi Tổ trưởng duyệt chuyển cấp Ban Giám hiệu
- **Mã khiếm khuyết:** `DEFECT-ZALO-05`
- **Tệp mục tiêu:** `server.js`
- **Tọa độ dòng:** Tuyến `POST /api/documents/:id/approve-leader` (dòng 3250–3260)
- **Mức độ nghiêm trọng:** 🟠 **MAJOR (Đứt gãy luồng thông báo cấp 2)**
- **Hiện tượng thực tế:** Tổ trưởng ký nháy xong chỉ gửi Web Push cho tác giả, không gửi tin Zalo báo cho Ban Giám hiệu để vào ký số đóng dấu.

### 📌 Đoạn mã Bổ sung vào `server.js` (sau dòng 3257):
```javascript
  // Khắc phục DEFECT-ZALO-05: Tự động gửi Zalo thông báo Ban Giám hiệu vào ký số
  try {
    const bghUser = dataStore.getUsers().find(u => u.role === 'BGH' || u.role === 'ADMIN');
    if (bghUser && bghUser.phone) {
      zaloNotifyService.notifyDocumentSubmitted(
        updatedDoc,
        currentUser,
        bghUser.id || bghUser.username
      ).catch(e => console.warn('[ZaloNotify] Lỗi gửi tin BGH:', e.message));
    }
  } catch (zErr) {
    console.warn('[ZaloNotify] Lỗi kích hoạt thông báo BGH:', zErr.message);
  }
```

---

<a id="patch-zalo-06"></a>
## [PATCH-ZALO-06] Tích hợp thông báo Zalo kèm liên kết tải khi BGH ký số và đóng dấu
- **Mã khiếm khuyết:** `DEFECT-ZALO-06`
- **Tệp mục tiêu:** `server.js`
- **Tọa độ dòng:** Tuyến `POST /api/documents/:id/approve-principal` (dòng 3400–3410)
- **Mức độ nghiêm trọng:** 🟠 **MAJOR (Giáo viên nộp bài không nhận được tin Zalo hoàn tất kèm link tải)**

### 📌 Đoạn mã Bổ sung vào `server.js` (sau dòng 3408):
```javascript
  // Khắc phục DEFECT-ZALO-06: Tự động gửi Zalo thông báo Hoàn tất Ký số & Đóng dấu cho Giáo viên
  try {
    const viewUrl = updatedDoc.driveInfo ? updatedDoc.driveInfo.viewUrl : 
                    `https://mrkhang-khoi.github.io/cvakyso/portal-baocao.html?search=${encodeURIComponent(updatedDoc.id)}`;
    zaloNotifyService.notifyDocumentCompleted(
      updatedDoc,
      currentUser,
      viewUrl
    ).catch(e => console.warn('[ZaloNotify] Lỗi gửi thông báo hoàn tất cho GV:', e.message));
  } catch (zErr) {
    console.warn('[ZaloNotify] Lỗi kích hoạt thông báo hoàn tất:', zErr.message);
  }
```

---

<a id="patch-zalo-07"></a>
## [PATCH-ZALO-07] Hợp nhất tuyến từ chối hồ sơ `/api/documents/:id/reject` có xác thực JWT
- **Mã khiếm khuyết:** `DEFECT-ZALO-07`
- **Tệp mục tiêu:** `server.js`
- **Tọa độ dòng:** Xóa tuyến bóng râm không xác thực tại dòng 836–905; Cập nhật tuyến chính thức tại dòng 3418–3467.
- **Mức độ nghiêm trọng:** 🔴 **CRITICAL (Lỗ hổng bảo mật vượt quyền từ chối hồ sơ)**
- **Hiện tượng thực tế:** Tuyến tại dòng 836 đăng ký trước không có `requireAuth`, cho phép client giả mạo header từ chối hồ sơ của người khác, đồng thời che lấp hoàn toàn tuyến an toàn tại dòng 3418.

### 📌 Giải pháp Thay thế:
1. **Xóa hoàn toàn khối `app.post('/api/documents/:id/reject', ...)` tại dòng 836–905.**
2. **Cập nhật tuyến tại dòng 3418 trở thành tuyến DUY NHẤT:**

```javascript
// Tuyến hợp nhất DUY NHẤT: Yêu cầu chỉnh sửa / Từ chối ký / Trả về cho tác giả (Bảo mật 100%)
app.post('/api/documents/:id/reject', requireAuth, (req, res) => {
  try {
    const currentUser = req.user;
    const doc = dataStore.getDocumentById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ' });

    const isDesignated = doc.nextSignerId === currentUser.id || doc.nextSignerId === currentUser.username;
    const isLeaderOrAdmin = currentUser.role === 'HEAD_DEPT' || currentUser.role === 'ADMIN' || currentUser.role === 'BGH';
    if (!isDesignated && !isLeaderOrAdmin) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền từ chối hồ sơ này!' });
    }

    const { reason = '' } = req.body;
    const trimmedReason = String(reason).trim();
    if (!trimmedReason) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập lý do trả về / yêu cầu sửa lại.' });
    }

    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const updatedLogs = [
      ...(doc.logs || []),
      {
        time: now,
        actor: `${currentUser.name} (${currentUser.roleTitle || currentUser.role})`,
        action: `Từ chối ký / Yêu cầu chỉnh sửa: "${trimmedReason}"`
      }
    ];

    const updatedDoc = dataStore.updateDocument(doc.id, {
      status: 'REJECTED',
      returnReason: trimmedReason,
      rejectReason: trimmedReason,
      rejectedBy: currentUser.name,
      rejectedAt: now,
      nextSignerId: null,
      logs: updatedLogs
    });

    // 1. Gửi Web Push
    if (doc.authorId) {
      notifyUserWebPush(doc.authorId, {
        title: 'Hồ sơ bị từ chối / trả về chỉnh sửa',
        body: `Hồ sơ "${doc.title}" bị từ chối bởi ${currentUser.name}: ${trimmedReason}`,
        url: `/?docId=${doc.id}`
      });
    }

    // 2. Gửi Zalo Notify 1-1 cho tác giả
    try {
      zaloNotifyService.notifyDocumentRejected(updatedDoc, currentUser, trimmedReason).catch(err => {
        console.warn('[ZaloNotify] Lỗi gửi tin Zalo từ chối:', err.message);
      });
    } catch (zErr) {}

    res.json({
      success: true,
      message: 'Đã từ chối và trả hồ sơ về cho tác giả chỉnh sửa!',
      data: updatedDoc
    });
  } catch (err) {
    console.error('[server.js reject] Lỗi xử lý:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});
```

---

<a id="patch-zalo-08"></a>
## [PATCH-ZALO-08] Xóa bỏ việc gửi tin Zalo từ Client, chuẩn hóa nguồn phát tin duy nhất
- **Mã khiếm khuyết:** `DEFECT-ZALO-08`
- **Tệp mục tiêu:** `js/app.js` (dòng 42–60, 4769, 5225, 5424, 5599, 5642)
- **Mức độ nghiêm trọng:** 🟠 **MAJOR (Hiện tượng gửi lặp 2 tin nhắn Zalo giống nhau cho mỗi sự kiện)**
- **Giải pháp kỹ thuật:** Vô hiệu hóa hàm `sendZaloNotificationClientSide` ở phía trình duyệt, chuyển toàn bộ trách nhiệm phát tin sang `server.js` sau khi dữ liệu đã lưu thành công vào cơ sở dữ liệu.

### 📌 Đoạn mã Sửa đổi trong `js/app.js` (dòng 42–50):
```javascript
// Khắc phục DEFECT-ZALO-08: Chuẩn hóa Server-Side Single Source of Truth
async function sendZaloNotificationClientSide(payload) {
  // Ghi log kiểm toán client, không gửi fetch độc lập tránh lặp tin
  console.log('[Audit] Zalo notification delegated to backend server:', payload?.eventType);
  return { success: true, delegated: true };
}
```

---

<a id="patch-zalo-09"></a>
## [PATCH-ZALO-09] Bảo vệ thư mục tĩnh `/uploads` chứa Con dấu trường và Ảnh chữ ký
- **Mã khiếm khuyết:** `DEFECT-ZALO-09`
- **Tệp mục tiêu:** `server.js`
- **Tọa độ dòng:** Dòng 84
- **Mức độ nghiêm trọng:** 🔴 **HIGH SECURITY & LEGAL RISK (Lộ con dấu đỏ `school_seal.png` và chữ ký giáo viên ra ngoài Internet)**
- **Hiện tượng thực tế:** `app.use('/uploads', express.static(...))` cho phép bất kỳ ai không cần đăng nhập cũng tải được con dấu tròn cơ quan và mẫu chữ ký cá nhân.

### 📌 Đoạn mã Thay thế tại `server.js` (dòng 84):
```javascript
// Khắc phục DEFECT-ZALO-09: Bảo vệ nghiêm ngặt con dấu trường và chữ ký cá nhân
app.use('/uploads/signatures', requireAuth, (req, res, next) => {
  const requestedFile = path.basename(req.path);
  // Chỉ cho phép Ban Giám hiệu, Quản trị viên hoặc chính chủ nhân chữ ký tải file
  if (
    req.user.role === 'ADMIN' || 
    req.user.role === 'BGH' || 
    requestedFile === `sig_${req.user.id}.png` ||
    requestedFile === `sig_${req.user.username}.png`
  ) {
    return express.static(path.join(__dirname, 'uploads', 'signatures'))(req, res, next);
  }
  return res.status(403).json({ success: false, message: 'Từ chối truy cập: Tài nguyên chữ ký và con dấu được bảo mật.' });
});

// Thư mục tài liệu PDF ký số yêu cầu xác thực phiên đăng nhập
app.use('/uploads/documents', requireAuth, express.static(path.join(__dirname, 'uploads', 'documents')));

// Các tài nguyên tải lên thông thường khác
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
```

---

<a id="patch-zalo-10"></a>
## [PATCH-ZALO-10] Bắt buộc kiểm tra `secret_token` trên Google Apps Script Webhook `doPost(e)`
- **Mã khiếm khuyết:** `DEFECT-ZALO-10`
- **Tệp mục tiêu:** `google-apps-script-zalo-edusign.js` (dòng 293–306) và `zaloNotifyService.js` (dòng 31)
- **Mức độ nghiêm trọng:** 🔴 **CRITICAL SECURITY RISK (CWE-306: Bất kỳ ai cũng gọi được lệnh xóa sổ báo cáo)**

### 📌 Đoạn mã Thay thế trong `google-apps-script-zalo-edusign.js` (dòng 293–310):
```javascript
function doPost(e) {
  try {
    var postData = {};
    if (e && e.postData && e.postData.contents) {
      try { postData = JSON.parse(e.postData.contents); } catch (err) { postData = e.parameter || {}; }
    } else if (e && e.parameter) {
      postData = e.parameter;
    }

    // Khắc phục DEFECT-ZALO-10: Kiểm tra chữ ký bảo mật Webhook Secret Token
    var action = postData.action || "";
    var providedSecret = postData.secret_token || (e && e.parameter && e.parameter.secret_token) || "";
    var SYSTEM_SECRET = "UnifiedZaloBotTHCSCVA2026Secret";

    // Danh sách các hành động nhạy cảm bắt buộc phải có secret_token
    var sensitiveActions = ["DELETE_REPORT", "BATCH_DELETE_REPORTS", "CLEAR_ALL_REPORTS", "NOTIFY_SIGN_EVENT"];
    if (sensitiveActions.indexOf(action) !== -1) {
      if (providedSecret !== SYSTEM_SECRET) {
        Logger.log("⛔ Cảnh báo: Truy cập trái phép doPost không có secret_token hợp lệ!");
        return ContentService.createTextOutput(JSON.stringify({ 
          success: false, 
          error: "UNAUTHORIZED_SECRET_TOKEN" 
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }
```

### 📌 Đoạn mã Bổ sung trong `zaloNotifyService.js` (dòng 24–35):
```javascript
  const payloadWithSecret = {
    ...payloadObj,
    secret_token: 'UnifiedZaloBotTHCSCVA2026Secret'
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payloadWithSecret),
    redirect: 'follow',
    signal: controller.signal
  });
```

---

<a id="patch-zalo-11"></a>
## [PATCH-ZALO-11] Xây dựng Module Quản lý Token Zalo OA v3 với khóa đơn luồng Mutex Lock
- **Mã khiếm khuyết:** `DEFECT-ZALO-011`
- **Tệp mục tiêu:** Tạo mới `zaloOaTokenManager.js` (hoặc tích hợp vào backend dịch vụ)
- **Mức độ nghiêm trọng:** 🟠 **MAJOR ARCHITECTURAL UPGRADE (Sẵn sàng đồng bộ chuẩn Zalo OA v3)**
- **Hiện tượng thực tế:** Chuẩn Zalo OA v3 sử dụng Rolling Refresh Token (mỗi token chỉ dùng được 1 lần). Nếu 2 request cùng lúc kích hoạt làm mới, request thứ 2 sẽ làm hệ thống bị khóa vĩnh viễn (Token Replay Violation).
- **Giải pháp kỹ thuật:** Cung cấp module quản lý token với cơ chế khóa bất đồng bộ (Mutex Lock), tự động lưu trữ và làm mới Access Token trước thời điểm hết hạn 5 phút.

### 📌 Đoạn mã Module Đề xuất (`zaloOaTokenManager.js`):
```javascript
/**
 * Module Quản lý Xác thực OAuth 2.0 Zalo Official Account v3
 * Tích hợp Mutex Lock ngăn ngừa hiện tượng Token Replay Race Condition
 */
const fs = require('fs');
const path = require('path');

class ZaloOaTokenManager {
  constructor(config = {}) {
    this.appId = config.appId || process.env.ZALO_APP_ID;
    this.secretKey = config.secretKey || process.env.ZALO_SECRET_KEY;
    this.tokenFilePath = path.join(__dirname, 'data', 'zalo_oa_tokens.json');
    this.isRefreshing = false;
    this.refreshQueue = [];
  }

  loadTokens() {
    try {
      if (fs.existsSync(this.tokenFilePath)) {
        return JSON.parse(fs.readFileSync(this.tokenFilePath, 'utf8'));
      }
    } catch (e) {}
    return { access_token: '', refresh_token: '', expires_at: 0 };
  }

  saveTokens(data) {
    const tokens = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Date.now() + (parseInt(data.expires_in, 10) - 300) * 1000 // Gia hạn trước 5 phút
    };
    fs.mkdirSync(path.dirname(this.tokenFilePath), { recursive: true });
    fs.writeFileSync(this.tokenFilePath, JSON.stringify(tokens, null, 2), 'utf8');
    return tokens;
  }

  async getValidAccessToken() {
    const current = this.loadTokens();
    // Nếu token còn hiệu lực thì tái sử dụng
    if (current.access_token && Date.now() < current.expires_at) {
      return current.access_token;
    }

    // Nếu đang có tiến trình làm mới token, đưa vào hàng đợi Mutex
    if (this.isRefreshing) {
      return new Promise((resolve, reject) => {
        this.refreshQueue.push({ resolve, reject });
      });
    }

    this.isRefreshing = true;
    try {
      const refreshed = await this.executeRefreshToken(current.refresh_token);
      this.refreshQueue.forEach(item => item.resolve(refreshed.access_token));
      this.refreshQueue = [];
      return refreshed.access_token;
    } catch (err) {
      this.refreshQueue.forEach(item => item.reject(err));
      this.refreshQueue = [];
      throw err;
    } finally {
      this.isRefreshing = false;
    }
  }

  async executeRefreshToken(refreshToken) {
    if (!refreshToken) throw new Error('Không tìm thấy Refresh Token hợp lệ.');

    const res = await fetch('https://oauth.zaloapp.com/v4/oa/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'secret_key': this.secretKey
      },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        app_id: this.appId,
        grant_type: 'refresh_token'
      })
    });

    const result = await res.json();
    if (result.error) {
      throw new Error(`[Zalo OA OAuth Error] ${result.error_name}: ${result.message}`);
    }

    return this.saveTokens(result);
  }
}

module.exports = ZaloOaTokenManager;
```

---

<a id="patch-zalo-12"></a>
## [PATCH-ZALO-12] Bắt mã phản hồi HTTP và xử lý lỗi mạng thực tế trong Zalo Bot Webhook
- **Mã khiếm khuyết:** `DEFECT-ZALO-12`
- **Tệp mục tiêu:** `google-apps-script-zalo-edusign.js`
- **Tọa độ dòng:** Dòng 1944 – 1953 (`sendZaloBotReply`)
- **Mức độ nghiêm trọng:** 🟡 **LOGIC FIX (Khắc phục hiện tượng báo cáo gửi thành công ảo khi bị lỗi)**

### 📌 Đoạn mã Đề xuất Thay thế (After):
```javascript
function sendZaloBotReply(chatId, text) {
  if (!CONFIG.ZALO_BOT_TOKEN || !chatId) return { success: false, reason: "MISSING_PARAMS" };
  var apiUrl = "https://bot-api.zaloplatforms.com/bot" + CONFIG.ZALO_BOT_TOKEN + "/sendMessage";
  var payload = {
    chat_id: String(chatId),
    text: text
  };

  try {
    var response = UrlFetchApp.fetch(apiUrl, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    var statusCode = response.getResponseCode();
    var responseText = response.getContentText();

    if (statusCode !== 200) {
      Logger.log("⚠️ Lỗi gửi tin Zalo Bot (HTTP " + statusCode + "): " + responseText);
      return { success: false, statusCode: statusCode, error: responseText };
    }

    return { success: true, statusCode: 200 };
  } catch (e) {
    Logger.log("❌ Ngoại lệ mạng khi gọi Zalo Bot API: " + e.toString());
    return { success: false, error: e.toString() };
  }
}
```

---

# PHẦN 3: MA TRẬN TỔNG HỢP KHUYẾN NGHỊ & THỨ TỰ ƯU TIÊN TRIỂN KHAI

Bảng ma trận dưới đây phân loại toàn diện 23 hạng mục khiếm khuyết được phát hiện bởi các đại lý chuyên môn độc lập, cung cấp lộ trình rõ ràng để Ban Quản trị nhà trường nghiệm thu và phê duyệt:

| STT | Mã Khiếm khuyết | Phân loại & Mức độ | Tệp nguồn & Tọa độ dòng | Tác động vận hành tại THCS Chu Văn An | Tóm tắt Giải pháp Bản vá |
| :---: | :---: | :---: | :---: | :---: | :---: |
| 1 | **DEF-01** | 🔴 Critical UI | `index.html` (305–316) | Gây tràn màn hình iPhone 410px/390px, trang bị lắc ngang khi giáo viên lướt web | Chuyển bộ lọc thành `flex-col sm:flex-row`, gán `w-full` triệt tiêu tràn ngang |
| 2 | **DEF-02** | 🟠 Major UI | `index.html` (1188–1244) | Thanh công cụ PDF chiếm 58% màn hình điện thoại, bóp nghẹt vùng đọc giáo án | Thu gọn thanh zoom trên mobile, thêm nút chuyển đổi nhanh mở rộng 80% vùng đọc |
| 3 | **DEF-03** | 🟠 Major UI | `index.html` (1296–1328) | Nút ◀, ▲, ▼, ▶ chỉ 24px khiến ngón tay giáo viên liên tục bấm trượt/bấm nhầm | Nâng nút lên 36px trên PC và 44px trên màn hình chạm đạt chuẩn WCAG AAA |
| 4 | **DEF-04** | 🟠 Major Logic | `js/app.js` (6655–6658) | Bỏ sót `pointercancel` làm màn hình bị đơ cứng khi có cuộc gọi đến lúc kéo dấu | Thêm `pointercancel` và `touchAction: none` giải phóng hoàn toàn lớp kính chắn |
| 5 | **DEF-05** | 🟠 Major UI | `index.html`, `portal-baocao.html` | Modal xác nhận nguy hiểm `z-50` dễ bị che khuất bởi các modal nghiệp vụ khác | Chuẩn hóa thang Design Token: Base 60, Nested 75, Confirm 90, Critical 110 |
| 6 | **DEF-06** | 🟠 Major UI | `js/app.js`, `portal-baocao.html` | Nút bấm trên bảng báo cáo quá nhỏ (26px), cực kỳ dễ bấm nhầm nút Xóa hồ sơ | Tăng vùng chạm nút lên $\ge 36\text{px}$, tăng khoảng cách `gap-2.5` an toàn |
| 7 | **DEF-07** | 🟡 Minor UI | `index.html`, `portal-baocao.html` | Tương phản màu chữ xám 2.56:1 gây mờ mắt cho giáo viên lớn tuổi | Chuyển `text-slate-400` sang `text-slate-600` (6.5:1) đạt chuẩn WCAG AA |
| 8 | **DEF-08** | 🟡 Minor UI | `index.html` (625–632) | Giáo viên dùng phím Tab/Enter không thể kích hoạt nộp giáo án | Bổ sung `tabindex="0"`, `role="button"` và sự kiện bàn phím Enter/Space |
| 9 | **DEF-09** | 🟡 Minor UI | `index.html` (136–137) | Gợi ý đăng nhập ghi `nthilien` gây nhầm lẫn vì tài khoản đúng là `cva.lien` | Cập nhật gợi ý chuẩn xác theo `data/users.json` |
| 10 | **DEF-10** | 🟡 Minor Clean | `index.html` (768–792) | Chứa 25 dòng HTML chết không bao giờ được render gây lãng phí bộ nhớ | Gỡ bỏ khối mã HTML chết `tabContentTeacherReturned` |
| 11 | **DEF-11** | 🟡 Minor Code | `portal-baocao.html` | Rủi ro phát sinh ngoại lệ Null khi truy cập DOM chưa sẵn sàng | Bọc an toàn kiểm tra `if (el)` trước khi gán giá trị |
| 12 | **DEFECT-ZALO-01** | 🔴 Critical Zalo | `google-apps-script-zalo-edusign.js:1377` | Rơi rụng thông báo Zalo khi hồ sơ được ký chuyển tiếp cho người thứ 2 | Bổ sung nhánh sự kiện `FORWARDED` và hàm gửi thông báo chuyển tiếp |
| 13 | **DEFECT-ZALO-02** | 🟠 Major Zalo | `google-apps-script-zalo-edusign.js:420` | Nhắn mã giáo án `KHBD-...` thì Zalo Bot báo không hiểu lệnh | Thêm Regex bóc tách mã và hàm trả về chi tiết tiến độ hồ sơ |
| 14 | **DEFECT-ZALO-03** | 🟡 Logic Zalo | `google-apps-script-zalo-edusign.js:425` | Lãnh đạo không tra cứu được danh sách giáo án đang chờ duyệt qua Zalo | Bổ sung lệnh `choduyet`, `pending` lọc hồ sơ chưa ký của trường |
| 15 | **DEFECT-ZALO-04** | 🔴 Critical Sec | `google-apps-script-zalo-edusign.js:413` | Kẻ lạ chỉ cần gõ SĐT Hiệu trưởng là chiếm đoạt thông báo và đọc trộm giáo án | Bắt buộc cú pháp xác thực 2 lớp `LK [SĐT] [PIN_EduSign]` |
| 16 | **DEFECT-ZALO-05** | 🟠 Major Zalo | `server.js` (3250–3260) | Tổ trưởng duyệt xong không báo Zalo cho Ban Giám hiệu vào ký số đóng dấu | Tích hợp gọi `zaloNotifyService.notifyDocumentSubmitted` gửi BGH |
| 17 | **DEFECT-ZALO-06** | 🟠 Major Zalo | `server.js` (3400–3410) | BGH đóng dấu xong giáo viên không nhận được tin Zalo kèm link tải bài về | Tích hợp gọi `zaloNotifyService.notifyDocumentCompleted` gửi Giáo viên |
| 18 | **DEFECT-ZALO-07** | 🔴 Critical Sec | `server.js` (836–905 & 3418) | Lỗ hổng 2 tuyến trùng lặp cho phép giả mạo quyền từ chối trả về hồ sơ | Xóa tuyến bóng râm không xác thực, hợp nhất vào tuyến có `requireAuth` |
| 19 | **DEFECT-ZALO-08** | 🟠 Major Arch | `js/app.js` & `server.js` | Cả Client và Server cùng bắn Zalo gây hiện tượng nhận 2 tin lặp phiền toái | Xóa bỏ gửi tin từ Client, chuẩn hóa Server-Side Single Source of Truth |
| 20 | **DEFECT-ZALO-09** | 🔴 High Sec | `server.js` (dòng 84) | Thư mục `/uploads` công khai để lộ con dấu đỏ trường và chữ ký tay giáo viên | Bọc middleware `requireAuth` bảo vệ nghiêm ngặt con dấu và chữ ký |
| 21 | **DEFECT-ZALO-10** | 🔴 Critical Sec | `google-apps-script-zalo-edusign.js:293` | Webhook không kiểm tra secret token, bất kỳ ai cũng gửi lệnh xóa sạch sổ sách | Bắt buộc so khớp `secret_token` cho mọi tác vụ quản trị và xóa dữ liệu |
| 22 | **DEFECT-ZALO-11** | 🟠 Major Arch | `zaloOaTokenManager.js` | Lệch chuẩn Zalo OA v3, rủi ro bị khóa token khi 2 luồng cùng refresh | Xây dựng Module OAuth v3 với khóa Mutex Lock chống xung đột token |
| 23 | **DEFECT-ZALO-12** | 🟡 Logic Zalo | `google-apps-script-zalo-edusign.js:1944` | Mù lỗi HTTP khi gửi tin Zalo, bot bị chặn vẫn báo thành công ảo | Bóc tách `getResponseCode()` và ghi log chi tiết mã lỗi Zalo |

---

# LỜI KẾT & KHUYẾN NGHỊ NGHIỆM THU

Tập hợp bản vá mã nguồn trên đây đã được thiết kế tuân thủ nghiêm ngặt **Nguyên tắc Thay đổi Tối thiểu (Minimal Change Principle)**, bảo tồn 100% logic hiện hữu đang chạy ổn định của trường THCS Chu Văn An, chỉ tập trung giải quyết triệt để các rủi ro bảo mật và bẫy công thái học.

Toàn bộ các đề xuất sẵn sàng được áp dụng vào mã nguồn sản phẩm ngay sau khi nhận được lệnh phê duyệt chính thức từ Quản trị viên hệ thống.

---
*Bản quyền tài liệu thuộc về Hệ thống Ký số Giáo án Điện tử EduSign VGCA — Trường THCS Chu Văn An (2026).*
