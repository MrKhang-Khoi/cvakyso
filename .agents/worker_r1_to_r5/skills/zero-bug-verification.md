---
name: zero-bug-verification
description: Quy trình kiểm thử tối tân Đa Đại Lý Giám Sát (Multi-Agent Supervision) kết hợp Bản đồ Code (CodeGraph / GitNexus), Phân tích Tĩnh (V8 + Oxlint Rust), Kiểm thử Mạng Độc Lập (Playwright Dual-Context Network Interceptor), và Thử Thách F5 Kỷ Luật (Chaos Invariant). BẮT BUỘC SỬ DỤNG CHO MỌI LẦN VIẾT CODE HOẶC TẠO DỰ ÁN MỚI — CẤM TUYỆT ĐỐI BỎ QUA VÀ CẤM TỰ SUY LUẬN.
---

# Quy Trình Kiểm Thử Đa Đại Lý Giám Sát Tối Tân (Multi-Agent Zero-Guesswork Pipeline)

> **QUY TẮC BẤT DI BẤT DỊCH (ZERO-GUESSWORK MANDATE)**:
> 1. **CẤM TUYỆT ĐỐI TỰ SUY LUẬN / ĐOÁN MÒ**: Mọi kết luận "đã chạy đúng" đều phải có bằng chứng từ log V8, log Oxlint, log gói tin mạng thật và ảnh chụp kiểm thử.
> 2. **CẤM "VỪA ĐÁ BÓNG VỪA THỔI CÒI"**: Phải tách biệt vai trò Lập trình và Giám sát/Kiểm thử. Code của Agent lập trình bắt buộc phải đi qua "lò luyện" kiểm tra độc lập của Agent kiểm thử mạng trước khi báo cáo cho người dùng.
> 3. **BẮT BUỘC ÁP DỤNG**: Cho mọi lần viết code, sửa giao diện, refactor, thêm tính năng mới hoặc khởi tạo dự án mới.

---

## 🏛️ MÔ HÌNH 4 VAI TRÒ ĐA ĐẠI LÝ GIÁM SÁT (MULTI-AGENT ROLES)

```
[Agent 1: Developer] ──(Nộp mã nguồn)──> [Agent 2: Syntax & CodeGraph Auditor]
                                                        │
                                                 (0 lỗi tĩnh & AST)
                                                        ▼
[Agent 4: Chief Quality Arbiter] <──(Log mạng, UI & F5)─ [Agent 3: Network, UI & Chaos Tester]
               │
   (Chỉ duyệt khi 100% PASS)
               ▼
   [BÀN GIAO CHO NGƯỜI DÙNG]
```

1. **Agent 1 (Developer - Lập trình viên)**: Viết mã nguồn theo đúng logic nghiệp vụ, cấu hình bảo mật, chuẩn thẩm mỹ Kahoot/Quizizz và yêu cầu sư phạm. *Tuyệt đối không có quyền tự tuyên bố hoàn thành.*
2. **Agent 2 (Syntax & CodeGraph Auditor - Giám sát Cú pháp & Bản đồ Code)**: 
   - Dùng **Bản đồ code (CodeGraph / GitNexus)** để quét toàn bộ vùng ảnh hưởng (Blast Radius). Bắt buộc 100% các hàm liên quan phải có kịch bản test bao phủ (cấm cảnh báo *"no covering tests found"*).
   - Dùng **Engine V8** (`node --check`) và **Oxlint Rust** (`oxlint -D correctness`) bắt sạch lỗi cú pháp, biến `no-undef`, hàm trùng tên.
3. **Agent 3 (Independent Network, UI & Chaos Tester - Kiểm thử Mạng, Giao diện & Kỷ luật Độc lập)**:
   - Chạy trên Web Server thật (`http://localhost:...`).
   - Mở **2 Context trình duyệt độc lập hoàn toàn** (Context Giáo viên $\ne$ Context Học sinh), tiêm lệnh `delete window.BroadcastChannel` để **cắt đứt 100% bộ nhớ chia sẻ RAM ảo**.
   - **Bắt gói tin mạng (Network Interception)**: Giám sát trực tiếp request/response tới Firebase Cloud / Backend API. Xác nhận mã `HTTP 200 OK`, tuyệt đối không có `Permission denied` hay `HTTP 403`.
   - **Kiểm thử Giao diện Sân khấu & Bố cục Đa Viewport**: Test trên cả 2 độ phân giải $1920 \times 1080$ và $1366 \times 768$, quét sạch lỗi tràn ngang (Horizontal Overflow), assert diện tích bao phủ sân khấu $\ge 85\text{vh}$, tương phản WCAG AAA $\ge 7:1$.
   - **Thử thách F5 Chaos**: Tự động reload máy học sinh khi đang trong tiết, kiểm tra: tự khôi phục đúng máy, đúng màn hình, nút thoát ra ngoài bị khóa 100%.
   - **Đo đạc độ trễ mạng thực tế**: Dùng `performance.now()` đo thời gian đồng bộ bằng mili-giây, cấm dùng lệnh chờ mò `waitForTimeout`.
4. **Agent 4 (Chief Quality Arbiter - Trọng tài Kiểm định Tối cao)**: Gom toàn bộ log, đối soát 100% tiêu chí ĐẠT, quét sạch lỗi Console F12 (`console.error = 0`), xuất trình báo cáo minh chứng và ảnh chụp cho người dùng.

---

## 🚀 QUY TRÌNH 6 TẦNG KIỂM SOÁT NGHIÊM NGẶT (6-TIER PIPELINE)

### Tầng 1: Khảo sát Bản đồ Code & Vùng ảnh hưởng (CodeGraph / GitNexus)
Trước khi chạm vào code hoặc viết test, phải lập bản đồ luồng thực thi:
```powershell
# Quét bản đồ hàm và xác định Blast Radius
codegraph explore "tên_hàm_hoặc_biến_trọng_yếu"
# Kiểm tra quan hệ đồ thị tri thức
gitnexus context "tên_hàm"
```
- **Tiêu chuẩn nghiệm thu**: Mọi hàm trong Blast Radius bắt buộc phải có câu lệnh Assert kiểm chứng tương ứng trong bài test tích hợp. Cấm tuyệt đối bỏ sót cảnh báo *"no covering tests found"*.

---

### Tầng 2: Kiểm soát Cú pháp & Kiểu dữ liệu Tĩnh Siêu tốc (Static & Syntax)
```powershell
# 1. Kiểm tra cú pháp engine V8 cốt lõi
node --check $TARGET_FILE

# 2. Quét nhanh bằng Rust-based Linter (Oxlint)
npx --yes oxlint $TARGET_FILE -D correctness

# 3. Kiểm tra an toàn kiểu dữ liệu không cần build
npx -p typescript tsc $TARGET_FILE --allowJs --checkJs --noEmit --target ES2022
```
- **Tiêu chuẩn nghiệm thu**: 0 Syntax Error, 0 no-undef, 0 duplicate functions, 0 type crash.

---

### Tầng 3: Kiểm thử Tích hợp Mạng Độc lập (Dual-Context Playwright Isolation)
Kịch bản test bắt buộc phải cấu hình 2 Context độc lập để mô phỏng 2 máy tính vật lý riêng biệt:

```javascript
// 1. Khởi tạo 2 Context độc lập (Không chung Cookie, không chung Cache, không chung LocalStorage)
const teacherContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const studentContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });

// 2. CẮT ĐỨT HOÀN TOÀN KÊNH RAM ẢO (BroadcastChannel)
await studentContext.addInitScript(() => { delete window.BroadcastChannel; });
await teacherContext.addInitScript(() => { delete window.BroadcastChannel; });

// 3. GIÁM SÁT GÓI TIN MẠNG THẬT (Network Interception)
const networkLogs = [];
studentPage.on('response', response => {
  const url = response.url();
  if (url.includes('firebasedatabase.app') || url.includes('googleapis.com')) {
    networkLogs.push({ url, status: response.status() });
  }
});

// 4. ĐO ĐỘ TRỄ ĐỒNG BỘ XÁC ĐỊNH (Deterministic Polling)
const startTime = performance.now();
await studentPage.waitForFunction(() => {
  return window.STORE?.getState()?.currentPhase === 'old_lesson';
}, { timeout: 10000 });
const latencyMs = Math.round(performance.now() - startTime);
console.log(`⏱️ Độ trễ mạng thực tế: ${latencyMs}ms`);
```

- **Tiêu chuẩn nghiệm thu**: 
  + Gói tin Firebase trả về `status === 200`.
  + Tuyệt đối không có phản hồi `Permission denied`.
  + Độ trễ mạng đồng bộ < 2000ms.

---

### Tầng 4: Thử thách Kỷ luật Phòng máy & Chống F5 (Chaos & Resilience Test)
Kiểm tra khả năng bảo toàn phiên làm việc khi học sinh cố tình tải lại trang hoặc tìm cách thoát:

```javascript
// 1. Giả lập học sinh bấm F5 tải lại trang giữa tiết học
await studentPage.reload({ waitUntil: 'networkidle' });

// 2. KIỂM TRA BẤT BIẾN KỶ LUẬT (Invariants)
// - Bất biến 1: Máy học sinh tự khôi phục đúng số máy ban đầu
const recoveredMachine = await studentPage.evaluate(() => window.STORE?.getState()?.machineId);
if (recoveredMachine !== targetMachineId) throw new Error('F5 làm mất số máy của học sinh!');

// - Bất biến 2: Giao diện tự động nhảy vào đúng bước Thầy đang dạy
const currentView = await studentPage.evaluate(() => window.STORE?.getState()?.currentPhase);
if (currentView !== 'old_lesson') throw new Error('F5 làm văng học sinh ra sảnh ngoài!');

// - Bất biến 3: Nút thoát ra sảnh bị khóa/ẩn hoàn toàn
const isExitHidden = await studentPage.locator('#btn-back-to-lobby').isHidden();
if (!isExitHidden) throw new Error('Nút thoát ra sảnh chưa bị khóa khi đang trong tiết!');
```

- **Tiêu chuẩn nghiệm thu**: Sau khi F5, học sinh vẫn ở đúng máy, đúng câu hỏi của Thầy, và không có cách nào tự ý thoát ra sảnh.

---

### Tầng 5: Kiểm thử Bố cục Giao diện & Trực quan Đa Độ Phân Giải (Visual & Layout Testing)
Không chỉ kiểm tra tính năng chạy được, giao diện bắt buộc phải đạt chuẩn sư phạm, visual hierarchy mạnh mẽ như Kahoot/Quizizz, cấm tuyệt đối bố cục co cụm hay tràn vỡ:

1. **Test Đa Độ Phân Giải Phòng Máy (Multi-Viewport Matrix)**:
   - Bắt buộc kiểm thử trên cả 2 độ phân giải màn hình chuẩn của trường học:
     + Chuẩn Desktop 1: `1920 x 1080` (Màn hình máy tính chuẩn/Full HD).
     + Chuẩn Desktop 2: `1366 x 768` (Màn hình Laptop giáo viên hoặc máy phòng thực hành phổ thông).
2. **Kiểm tra Chống Bẫy Tràn Bố cục (Layout Overflow Trap)**:
   ```javascript
   // Bắt buộc quét toàn bộ trang không được có thanh cuộn ngang ngoài ý muốn
   const hasHorizontalScroll = await page.evaluate(() => {
     return document.documentElement.scrollWidth > document.documentElement.clientWidth;
   });
   if (hasHorizontalScroll) throw new Error('Phát hiện bẫy tràn ngang (Horizontal Overflow) trên giao diện!');
   ```
3. **Tiêu chuẩn Thiết kế Sân khấu Tương tác (Interactive Stage UI Standards)**:
   - **Tỷ lệ bao phủ (Stage Coverage)**: Màn hình tương tác chính của học sinh phải chiếm tối thiểu 80-90% chiều cao màn hình (`min-height: 85vh`), cấm co rúm trong các hộp nhỏ hẹp tạo ra "khoảng trống chết" (>70% diện tích đen).
   - **Độ tương phản WCAG AAA**: Tỷ lệ tương phản chữ $\ge 4.5:1$ (văn bản thường) và $\ge 7:1$ (tiêu đề lớn), đảm bảo học sinh ngồi cách màn hình 2-3m vẫn đọc rõ mồn một.
   - **Kích thước Điểm chạm (Target Size Accessibility)**: Mọi nút bấm, tab điều khiển phải có kích thước tối thiểu $44 \times 44$px hoặc $48 \times 48$px.
   - **Đồng bộ Sân khấu Trực quan Thời gian thực (Live Synchronous Stage)**: Khi Giáo viên kích hoạt sự kiện (Bắt đầu bài, Quay số, Đổi câu hỏi), màn hình Học sinh phải ngay lập tức chuyển trạng thái tương ứng trong vòng < 500ms (mở popup, hiệu ứng xoay, vinh danh).

---

### Tầng 6: Bắt sạch Lỗi F12 & Biên bản Nghiệm thu Minh chứng (Audit & Artifacts)
1. Lắng nghe toàn bộ Console:
   ```javascript
   const consoleErrors = [];
   page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
   page.on('pageerror', err => consoleErrors.push(err.message));
   ```
2. Chụp ảnh màn hình thực tế (Screenshots) của cả máy Thầy và máy Trò trên cả 2 độ phân giải `1920x1080` và `1366x768`, lưu vào thư mục `artifacts/`.
3. Báo cáo bảng chỉ số kiểm thử minh bạch cho người dùng:
   - ✅ Cú pháp V8 & Oxlint: Sạch 100%.
   - ✅ Bản đồ Code: 100% hàm trong Blast Radius có test.
   - ✅ Gói tin Firebase: HTTP 200 OK (0 lỗi Permission denied).
   - ✅ Độ trễ đồng bộ: Con số mili-giây cụ thể.
   - ✅ Thử thách F5: Tự phục hồi phiên, khóa chặt kỷ luật.
   - ✅ Bố cục & Trực quan: Đạt chuẩn Kahoot/Quizizz, 0 overflow, bao phủ 85vh.
   - ✅ Console F12: 0 lỗi đỏ.

---

## 🔄 VÒNG LẶP TỰ VÁ LỖI (SELF-HEALING LOOP)

Nếu BẤT KỲ tầng nào trong 5 tầng trên bị FAIL:
1. **DỪNG NGAY LẬP TỨC**: Không được phép chuyển sang bước tiếp theo, tuyệt đối không được báo cáo "đã xong".
2. **ĐỌC LOG THẬT**: Phân tích chính xác dòng mã nguồn, mã lỗi mạng (ví dụ: HTTP 403 / Permission denied), hoặc vị trí DOM bị vỡ.
3. **SỬA LỖI TẬN GỐC**: Sửa trực tiếp nguyên nhân cốt lõi (ví dụ: cấu hình Auth Token, sửa cú pháp, cập nhật state).
4. **CHẠY LẠI TOÀN BỘ CHU TRÌNH 5 TẦNG**: Cho đến khi kết quả PASS 100% trên toàn bộ các tầng mới được xuất trình cho người dùng.
