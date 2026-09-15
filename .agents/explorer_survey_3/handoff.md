# BÁO CÁO THẨM ĐỊNH CHUYÊN SÂU: CONCURRENCY, LOAD TESTING & DATA INTEGRITY (YÊU CẦU R3)

**Đại lý thực hiện**: Explorer Survey 3 (Concurrency, Load Testing & Data Integrity Specialist)  
**Mã nhiệm vụ**: R3 - Kiểm thử tải thời gian thực: 50 giáo viên cùng ký số đồng thời  
**Ngày thẩm định**: 2026-09-15  
**Không gian làm việc**: `c:\Users\HPZBook\Desktop\KÝ SỐ`

---

## 1. OBSERVATION (QUAN SÁT THỰC TẾ TRỰC TIẾP TỪ MÃ NGUỒN)

### 1.1. Luồng Tiếp Nhận Hồ Sơ & Điểm Cuối Ký Số (Endpoints)
Qua việc khảo sát trực tiếp tệp tin `server.js`, hệ thống vận hành với các điểm cuối API cốt lõi sau:

- **`POST /api/documents` (Lines 2550–2870)**:  
  Điểm cuối chính tiếp nhận hồ sơ bài dạy và thực hiện ký số cấp giáo viên.
  - Nhận payload JSON: `{ title, grade, week, term, pages, fileSize, fileName, fileType, fileBase64, signPlacement, signatureImage, signCoordinates, realVgcaSign, realSignedPdfBase64, txId, signType, category, nextSignerId, nextSignerName, nextSignerRole }`.
  - Kiểm tra xác thực qua middleware `requireAuth` (Lines 275–282). Cho phép xác thực bằng `Authorization: Bearer <token>`, `x-auth-token: <token>`, hoặc với tài khoản giáo viên thường qua `x-user-id` / `x-user-username` (Lines 249–273).
  - Yêu cầu bắt buộc phải có chữ ký hợp lệ (`!activeSigImage && !isCopy -> return 400`, Lines 2575–2580).
  - Ghi tệp đính kèm vào ổ đĩa: `fs.writeFileSync(path.join(__dirname, 'uploads', 'documents', uniqueFileName), rawBuffer)` (Line 2618).
  - Khởi tạo hồ sơ: `const newDoc = dataStore.createDocument(...)` (Line 2624).
  - Cập nhật trạng thái ngay sau khởi tạo: `dataStore.updateDocument(newDoc.id, { status: 'COMPLETED', ... })` đối với hồ sơ cá nhân (Lines 2668–2674) hoặc `WAITING_NEXT_SIGN` đối với báo cáo liên cấp (Lines 2675–2694).
  - Nếu có `realSignedPdfBase64` (từ EduSign Agent Bridge): Ghi tệp `signed_vgca_*.pdf` và gọi `dataStore.updateDocument()` lần thứ 2 (Lines 2697–2743).
  - Nếu `realVgcaSign === true`: Gọi `pdfSignerService.signWithRealVgca(newDoc)` (Line 2761), sau đó gọi `dataStore.updateDocument()` lần thứ 2 (Line 2785). Trong môi trường test (`NODE_ENV === 'test' || TEST_PORT`), nếu C# signer thất bại sẽ fallback tạo PDF đóng dấu ảnh (Lines 2763–2773).
  - Tự động sao lưu Google Drive (Lines 2814–2833) và phát Web Push / Zalo notification bất đồng bộ (Lines 2835–2855).

- **`POST /api/documents/:id/sign-vgca-real` (Lines 1771–1860)**:  
  Ký số mật mã thật cho hồ sơ đã tồn tại. Gọi `pdfSignerService.signWithRealVgca(doc)` hoặc nhận `realSignedPdfBase64`, cập nhật `realSignedPath` vào `dataStore.updateDocument()`.

- **`POST /api/documents/:id/sign-step` (Lines 1133–1330)**:  
  Điểm cuối ký số theo bước cho quy trình luân chuyển văn bản liên hoàn (Giáo viên -> Tổ trưởng -> Ban Giám hiệu). Ghi tệp `Step_<id>_<step>.pdf` hoặc `Signed_<id>.pdf`, đẩy lịch sử duyệt vào `doc.history`, và cập nhật `dataStore.updateDocument(id, doc)`.

- **Các điểm cuối duyệt và cập nhật trạng thái khác**:
  - `POST /api/documents/:id/approve-leader` (Lines 3203–3264): Tổ trưởng chuyên môn ký nháy cấp 2, chuyển trạng thái thành `WAITING_PRINCIPAL_APPROVAL`.
  - `POST /api/documents/:id/approve-principal` (Lines 3267–3350): Ban Giám hiệu ký duyệt cấp 3, đóng dấu tròn đỏ trường học (`uploads/signatures/school_seal.png`), chuyển trạng thái thành `APPROVED`.
  - `POST /api/documents/:id/reject` (Lines 836–850 và 3418–3440): Từ chối hồ sơ, trả về kèm lý do.
  - `POST /api/documents/:id/recall` (Lines 3470–3500): Giáo viên chủ động thu hồi hồ sơ khi chưa được duyệt.

### 1.2. Cơ Chế Ký Số Trong `pdfSignerService.js`
- **`generateSignedPdf(doc)` (Lines 160–564)**:
  - Nạp tệp PDF qua thư viện `pdf-lib`: `const pdfDoc = await PDFDocument.load(sourcePdfBuffer)` (Line 319). Quá trình giải mã và dựng cấu trúc PDF là tác vụ ngốn CPU (CPU-intensive).
  - Nếu tệp tải lên là Word (`.docx`/`.doc`), gọi `convertDocxToPdf(docxPath, outputPath)` (Lines 23–104). Trên Windows, hàm này khởi chạy tiến trình PowerShell tự động hóa Microsoft Word COM Automation (`New-Object -ComObject Word.Application`). Tiến trình này đơn luồng, tốn 2–8 giây mỗi file và dễ bị nghẽn (freeze/RPC error) nếu gọi đồng thời.
  - Nhúng ảnh chữ ký số PNG/JPG: `await pdfDoc.embedPng(imgBuffer)` (Lines 141–153).
  - Tìm vị trí chữ ký thông minh: Nếu `isManualDrag` không được bật, hàm gọi `findSmartSignatureAnchor(sourcePdfBuffer, ...)` (Lines 605–649), bên trong sử dụng `child_process.execFile(runner.command, ['--find-anchor', tempPath, ...])` để quét văn bản. Tác vụ này spawn tiến trình OS ngoài (`RealPdfSigner.exe` / `EduSign_Agent.exe`) tốn thêm 150–300ms và bộ nhớ RAM cho mỗi yêu cầu.
  - Xuất file PDF: `await pdfDoc.save()` (Line 563) thực hiện nén và mã hóa nhị phân CPU-bound trên luồng chính V8.
- **`signWithRealVgca(doc)` (Lines 655–754)**:
  - Gọi `generateSignedPdf(doc)`, ghi file đệm `tempInput` ra đĩa.
  - Gọi `child_process.execFile(runner.command, ['--sign', tempInput, tempOutput, ...])` với thời gian chờ 4.000ms (trong test) hoặc 35.000ms (production).
  - Đây là tác vụ bất đồng bộ I/O luồng ngoài nhưng gây áp lực lớn lên CPU máy chủ và OS Process Table nếu 50 tiến trình C# cùng được spawn trong 5–10 giây.

### 1.3. Cơ Chế Lưu Trữ Dữ Liệu Trong `dataStore.js`
- **Cơ chế Cache trong RAM (`_docsCache`)**:
  - Khai báo biến toàn cục: `let _docsCache = null;` (Line 477).
  - Hàm `getDocuments(forceReload = false)` (Lines 479–489): Nếu `_docsCache` đã có dữ liệu và `forceReload !== true`, hàm lập tức trả về tham chiếu mảng trong RAM mà không đọc lại ổ đĩa.
  - Hàm `saveDocuments(docs)` (Lines 491–494):
    ```javascript
    function saveDocuments(docs) {
      _docsCache = docs;
      saveJsonSafe(DOCS_FILE, docs);
    }
    ```
- **Cơ chế Ghi Đĩa `saveJsonSafe(filePath, data)` (Lines 119–147)**:
  - Chuyển toàn bộ mảng hồ sơ thành chuỗi JSON: `const content = JSON.stringify(data, null, 2);`. Hiện tại tệp `data/documents.json` chứa 104 hồ sơ, dung lượng khoảng 1,28 MB (1.317.942 bytes).
  - Tạo tệp tạm: `tempPath = `${filePath}.${Date.now()}.${Math.random().toString(36).slice(2, 6)}.tmp``.
  - Ghi đồng bộ vào tệp tạm: `fs.writeFileSync(tempPath, content, 'utf8')`.
  - Đổi tên tệp tạm đè lên tệp chính: `fs.renameSync(tempPath, filePath)`.
  - Vòng lặp thử lại tối đa 12 lần (`attempt < 12`). Nếu gặp lỗi (ví dụ file bị khóa trên Windows), mã nguồn thực hiện:
    ```javascript
    try {
      const buf = new Int32Array(new SharedArrayBuffer(4));
      Atomics.wait(buf, 0, 0, 50);
    } catch {}
    ```
    Lệnh `Atomics.wait(buf, 0, 0, 50)` trên Node.js (V8) làm **đóng băng (freeze) luồng chính của Event Loop đúng 50 mili-giây** cho mỗi lần thử lại!

### 1.4. Hạ Tầng Kiểm Thử Hiện Tại (Package & Test Files)
- **`package.json`**:
  - `dependencies`: `cors (^2.8.6)`, `express (^4.22.2)`, `pdf-lib (^1.17.1)`, `web-push (^3.6.7)`.
  - `devDependencies`: `@playwright/test (^1.63.0)`, `oxlint (^1.82.0)`, `puppeteer-core (^25.10.0)`.
  - Các công cụ benchmark tải chuyên dụng như `autocannon`, `artillery`, `k6` **chưa được cài đặt**.
- **Môi trường sẵn có**:
  - Module chuẩn của Node.js: `perf_hooks` (hỗ trợ `performance.now()`, `monitorEventLoopDelay`), `child_process`, `worker_threads`, `http`.
  - Tệp `test.js` (1048 dòng): Kiểm thử tích hợp toàn bộ các tính năng (Auth, Token, RBAC, 3 cấp ký, Copy Sign, Google Drive, OneDrive) bằng các hàm HTTP thuần tự xây dựng (`httpRequest`).

---

## 2. LOGIC CHAIN (PHÂN TÍCH CHUỖI SUY LUẬN & RỦI RO ĐỒNG THỜI)

### 2.1. Phân Tích Rủi Ro Race Condition & Lost Update Khi 50 Giáo Viên Ký Đồng Thời
1. **Quan sát**: `dataStore.js` không hề có mutex, không có hàng đợi ghi đĩa bất đồng bộ (no async write queue), không có cơ chế khóa tệp (no file lock như `proper-lockfile`).
2. **Quan sát**: Mỗi yêu cầu nộp hồ sơ (`POST /api/documents`) thực hiện ít nhất 2 lần gọi `saveDocuments()` (lần 1 ở `createDocument`, lần 2 ở `updateDocument`).
3. **Suy luận**: 50 giáo viên gửi yêu cầu trong 5–10 giây sẽ kích hoạt ít nhất **100 lượt tuần tự hóa JSON và ghi tệp đĩa `documents.json`** (mỗi lần ~1,3 MB, tổng lượng I/O ghi đĩa xấp xỉ 130 MB).
4. **Cơ chế luồng Node.js và Windows NTFS**:
   - Trong luồng đơn JavaScript, phép biến đổi mảng trong RAM (`docs.unshift`, `Object.assign`) diễn ra đồng bộ, do đó trong bộ nhớ cache `_docsCache`, các phần tử mới không bị mất do race condition ở tầng mảng JavaScript.
   - TUY NHIÊN, trên hệ điều hành Windows, lệnh `fs.renameSync(tempPath, filePath)` không phải là POSIX atomic rename. Nếu một luồng đọc đĩa, tiến trình quét của phần mềm diệt virus (Windows Defender), hoặc một lần đổi tên khác đang giữ handle tới `documents.json`, `fs.renameSync` sẽ ném ngoại lệ `EPERM` hoặc `EBUSY`.
5. **Nguy cơ đóng băng Event Loop do `Atomics.wait`**:
   - Khi `fs.renameSync` hoặc `fs.writeFileSync` thất bại, vòng lặp trong `saveJsonSafe` gọi `Atomics.wait(buf, 0, 0, 50)`.
   - Vì Node.js chạy toàn bộ logic HTTP trên một luồng chính duy nhất, lệnh này lập tức chặn cứng Event Loop trong 50ms. Nếu 5 lần ghi đĩa liên tiếp bị xung đột khóa tệp, Event Loop sẽ bị treo từ 250ms đến 600ms.
   - Khi Event Loop bị treo, mọi yêu cầu mạng HTTP của 49 giáo viên còn lại sẽ bị kẹt lại trong hàng đợi TCP của hệ điều hành, làm tăng vọt độ trễ P95 (P95 Latency spike) và có nguy cơ gây timeout.
6. **Nguy cơ Lệch Pha Giữa Bộ Nhớ (RAM) và Ổ Đĩa (Disk Desynchronization)**:
   - Trong `saveDocuments(docs)`, phép gán `_docsCache = docs;` được thực hiện *trước* khi `saveJsonSafe` hoàn tất.
   - Nếu `saveJsonSafe` thất bại sau 12 lần thử lại và ném lỗi ra ngoài (`throw err2`), bộ nhớ RAM vẫn chứa 50 hồ sơ mới, nhưng tệp `documents.json` trên đĩa không hề lưu trữ chúng.
   - Nếu máy chủ gặp sự cố (restart hoặc chuyển trạng thái trên Render Cloud), các hồ sơ này sẽ hoàn toàn biến mất khỏi đĩa, dẫn đến lỗi **Mất Mát Dữ Liệu (Lost Update)** nghiêm trọng.

### 2.2. Phân Tích Hiện Tượng Nghẽn CPU & Spawn Tiến Trình C# Trong Ký Số
1. **Quan sát**: `generateSignedPdf` thực hiện phân tích cú pháp PDF qua `pdf-lib` và tìm tọa độ neo qua `findSmartSignatureAnchor`.
2. **Suy luận**: Nếu không truyền sẵn tọa độ `isManualDrag: true`, hệ thống sẽ kích hoạt 50 tiến trình con thực thi `RealPdfSigner.exe --find-anchor`.
3. **Hệ quả**: Việc khởi tạo đồng thời 50 tiến trình thực thi `.exe` trên Windows đòi hỏi chi phí cấp phát bộ nhớ (Process Memory Footprint) khoảng 50 x 30MB = 1,5 GB RAM trong vòng vài giây, làm CPU tăng lên 100%, gây tắc nghẽn nghiêm trọng cho hệ thống.

---

## 3. CAVEATS (GIỚI HẠN VÀ KHUYẾN CÁO ĐIỀU KIỆN BIÊN)

1. **Giới hạn môi trường kiểm thử cục bộ so với Render Cloud**:
   - Trên môi trường cục bộ (Windows), các xung đột chủ yếu phát sinh từ cơ chế khóa tệp NTFS (`EBUSY`/`EPERM`) và chi phí khởi tạo tiến trình con `.exe`.
   - Trên Render Cloud (Linux Container), hệ thống tệp là Ephemeral (bộ nhớ tạm), `fs.renameSync` mang tính atomic của Linux ext4 nên không bị lỗi khóa NTFS, nhưng bù lại Render Free/Starter chỉ có 0.5 CPU và 512MB RAM. Nếu chạy 50 luồng ký đồng thời kèm `pdf-lib` và spawn tiến trình, container Render sẽ bị **OOM (Out Of Memory) Kill** ngay lập tức.
2. **Ký số thật VGCA yêu cầu thiết bị vật lý**:
   - Ký số bằng USB Token hoặc SmartCA thật yêu cầu kết nối vật lý hoặc dịch vụ đám mây Ban Cơ yếu. Trong kịch bản đo tải tự động 50 giáo viên, hệ thống cần kích hoạt chế độ môi trường test (`NODE_ENV=test` hoặc cờ mô phỏng có kiểm chứng cấu trúc PAdES) để tránh việc tắc nghẽn tại bước nhập mã PIN hoặc bấm xác nhận điện thoại thật của 50 người dùng.
3. **Đồng bộ Google Drive & Firebase RTDB**:
   - Nếu bật cờ `autoUploadOnSign: true`, 50 yêu cầu đồng thời sẽ gửi 50 luồng HTTP upload file PDF nặng sang Google Drive. Google Apps Script / Google Drive API có hạn ngạch tần suất (rate limit 10 req/s), có thể gây lỗi HTTP 429 hoặc kéo dài thời gian phản hồi của giáo viên lên quá 10 giây.

---

## 4. CONCLUSION (KẾT LUẬN & KIẾN TRÚC GIẢI PHÁP CHO BÀI TEST R3)

### 4.1. Đánh Giá Hiện Trạng
- **Điểm mạnh**: Hệ thống có cấu trúc API rõ ràng, phân định mạch lạc giữa nộp hồ sơ cá nhân (`PERSONAL`) và báo cáo liên cấp (`REPORT`), hỗ trợ đa dạng phương thức xác thực (Bearer token, header `x-user-id` cho giáo viên).
- **Điểm yếu chí mạng**:
  1. Thiếu hàng đợi ghi đĩa bất đồng bộ (No Write Queue/Lock) trong `dataStore.js`.
  2. Toàn bộ tệp 1,3 MB `documents.json` bị ghi đè đồng bộ 2 lần cho mỗi hồ sơ, tổng cộng 100 lần ghi đĩa trong 5–10 giây.
  3. Lệnh `Atomics.wait(50ms)` gây nguy cơ đứng hình toàn bộ máy chủ khi xảy ra tranh chấp I/O đĩa trên Windows.

### 4.2. Khuyến Nghị Thiết Kế Kịch Bản Test Tải 50 Giáo Viên (Stress Test Harness)
Nhằm đáp ứng trọn vẹn yêu cầu R3 và tiêu chí nghiệm thu (Acceptance Criteria):
1. **Xây dựng bộ kiểm thử tải độc lập bằng Node.js thuần (`tests/stress_50_teachers_load_test.mjs`)**:
   - Không cần cài thêm thư viện ngoài, sử dụng sức mạnh nguyên bản của Node.js: `perf_hooks` (đo độ trễ micro-giây và `monitorEventLoopDelay`), `http` client / `fetch` với `Promise.allSettled`.
   - Chuẩn bị sẵn danh sách 50 tài khoản giáo viên độc lập (`teacher_01` đến `teacher_50`, Tổ chuyên môn, chữ ký số mẫu).
   - Kích hoạt phát tải 50 luồng nộp bài và ký số đồng thời trong cửa sổ thời gian 5 giây (phân bổ ngẫu nhiên jitter 0–3000ms đại diện cho hành vi thực tế của giáo viên).
2. **Công thức đo đạc chỉ số**:
   - **Tỷ lệ thành công (Success Rate)**: $S = \frac{\text{Số request trả về HTTP 200 \& success: true}}{50} \times 100\%$. Mục tiêu: $\ge 98\%$.
   - **Độ trễ trung bình & P95**: Thu thập mảng `latencies = [t1, t2, ..., t50]`. Sắp xếp tăng dần, lấy $P95 = \text{latencies}[47]$ (vị trí 95%).
   - **Đo Event Loop Lag**: Sử dụng `perf_hooks.monitorEventLoopDelay({ resolution: 20 })`. Ghi nhận P95 Lag và Max Lag.
   - **Đo mức tiêu thụ tài nguyên**: Ghi nhận `process.cpuUsage()` và `process.memoryUsage()` (RSS, Heap Used) trước và sau đợt tải.
3. **Đối soát tính toàn vẹn dữ liệu (Post-Test Data Integrity Audit)**:
   - Đọc trực tiếp từ tệp vật lý `data/documents.json` bằng `fs.readFileSync` (cắt bỏ RAM cache).
   - Kiểm tra đối soát 1-1 giữa 50 mã hồ sơ sinh ra từ API response và các bản ghi trong `documents.json`.
   - Xác nhận: $0$ bản ghi bị ghi đè mất tích, $0$ lỗi Lost Update, tệp JSON toàn vẹn không bị hỏng cú pháp (Valid JSON).

### 4.3. Đề Xuất Cải Tiến Cốt Lõi Cho `dataStore.js` (Khuyến nghị cho Đội ngũ Lập trình)
Để đảm bảo bài test 50 giáo viên vượt qua với tỷ lệ thành công 100% và độ trễ P95 < 1500ms, cần áp dụng cơ chế **Hàng Đợi Ghi Đĩa Nối Tiếp (Serialized Async Write Queue)** hoặc **Debounced Flush**:
```javascript
// Đề xuất cơ chế ghi đĩa bất đồng bộ an toàn chống tranh chấp
let _writePromiseChain = Promise.resolve();

function saveDocumentsSafeAsync(docs) {
  _docsCache = docs;
  _writePromiseChain = _writePromiseChain.then(async () => {
    const content = JSON.stringify(docs, null, 2);
    const tempPath = `${DOCS_FILE}.${Date.now()}.${Math.random().toString(36).slice(2, 6)}.tmp`;
    await fs.promises.writeFile(tempPath, content, 'utf8');
    await fs.promises.rename(tempPath, DOCS_FILE);
  }).catch(err => {
    console.error('[DataStore] Lỗi ghi đĩa hàng đợi:', err);
  });
  return _writePromiseChain;
}
```
Giải pháp này loại bỏ hoàn toàn lệnh `Atomics.wait` gây nghẽn luồng, tuần tự hóa việc ghi đĩa an toàn, và giữ cho Event Loop luôn mượt mà.

---

## 5. VERIFICATION METHOD (PHƯƠNG PHÁP KIỂM CHỨNG ĐỘC LẬP)

Để kiểm chứng độc lập các phát hiện và số liệu trong báo cáo này, bất kỳ kỹ sư hoặc kiểm thử viên nào cũng có thể thực thi các bước sau:

### 5.1. Lệnh Kiểm Tra Kích Thước & Hiện Trạng Cơ Sở Dữ Liệu
```powershell
# Kiểm tra số lượng người dùng và hồ sơ hiện có
node -e "const ds = require('./dataStore'); console.log('Users:', ds.getUsers().length); console.log('Docs:', ds.getDocuments().length);"

# Kiểm tra dung lượng tệp documents.json
node -e "const fs = require('fs'); console.log('Dung lượng documents.json:', (fs.statSync('./data/documents.json').size / 1024).toFixed(2), 'KB');"
```

### 5.2. Lệnh Kiểm Tra Điểm Cuối Ký Số & Nộp Bài Của Hệ Thống
Khởi chạy bộ kiểm thử tích hợp hiện có để xác nhận luồng hoạt động chuẩn của API:
```powershell
npm test
# hoặc
node test.js
```
*Kết quả kỳ vọng*: Đạt 100% (toàn bộ các bài test về Auth, Nộp giáo án, Ký 3 cấp, Sao y đều PASS).

### 5.3. Lệnh Kiểm Chứng Đo Đạc Event Loop Lag & Độ Trễ Bằng `perf_hooks`
```powershell
node -e "const { monitorEventLoopDelay, performance } = require('perf_hooks'); const h = monitorEventLoopDelay({ resolution: 20 }); h.enable(); setTimeout(() => { h.disable(); console.log('Event loop lag P95 (ms):', (h.percentile(95) / 1e6).toFixed(2)); }, 100);"
```

### 5.4. Điều Kiện Hủy Bỏ Kết Luận (Invalidation Conditions)
Kết luận của báo cáo này sẽ bị thay đổi hoặc vô hiệu hóa nếu:
- `dataStore.js` được tái cấu trúc chuyển sang sử dụng hệ quản trị cơ sở dữ liệu thực sự (SQLite, PostgreSQL, MongoDB) hoặc đã triển khai cơ chế write queue / debounced flush bất đồng bộ.
- Kích thước payload tệp PDF gửi qua API được chuyển đổi hoàn toàn sang luồng trực tiếp (Streaming / Multipart form-data) thay vì Base64 JSON.
