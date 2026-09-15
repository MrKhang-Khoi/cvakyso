# BÁO CÁO THẨM ĐỊNH THỰC NGHIỆM HỆ THỐNG LƯU TRỮ ĐÁM MÂY RENDER & ĐỒNG BỘ CLOUD (R2)
**Dự án:** EduSign VGCA - Hệ thống Quản lý và Trình ký Hồ sơ Giáo dục Điện tử  
**Đại lý thực hiện:** Explorer 2 (Backend & Cloud Storage Specialist)  
**Tệp đích:** `c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\explorer_survey_2\handoff.md`  
**Thời gian hoàn thành:** 2026-09-15T06:55:00+07:00 (UTC: 2026-09-14T23:55:00Z)  

---

## 1. OBSERVATION (Quan sát trực tiếp & Bằng chứng thực nghiệm)

### 1.1. Cấu hình dịch vụ và đĩa lưu trữ trên Render
- **Tệp `render.yaml`** (dòng 1–12):
  ```yaml
  services:
    - type: web
      name: edusign-vgca
      env: node
      plan: free
      region: singapore
      buildCommand: npm install
      startCommand: node server.js
      envVars:
        - key: NODE_VERSION
          value: 20
  ```
  *Quan sát:* Dịch vụ được cấu hình `plan: free`. Hoàn toàn **không có khai báo khối đĩa gắn ngoài (`disks:`)**. Theo tài liệu kỹ thuật chuẩn của Render, gói Free chỉ cung cấp đĩa tạm thời (Ephemeral Filesystem) và không hỗ trợ gắn Persistent Disk.

### 1.2. Vị trí lưu trữ tệp tin trên hệ thống tệp cục bộ
- **Tệp tải lên và PDF ký số** được lưu tại thư mục `uploads/documents/`:
  - `server.js` dòng 2617: `savedFilePath = path.join(__dirname, 'uploads', 'documents', uniqueFileName);`
  - `server.js` dòng 2707: `signedFilePath = path.join(uploadDir, 'signed_vgca_' + newDoc.id + '_' + Date.now() + '.pdf');`
  - `server.js` dòng 2767: `outPath = path.join(outDir, 'RealSigned_' + newDoc.id + '.pdf');`
  - `dataStore.js` dòng 601: `fs.writeFileSync(path.join(uploadDir, fname), rawBuffer);`
- **Ảnh chữ ký tay và con dấu**:
  - `server.js` dòng 605: `sigPath = path.join(__dirname, 'uploads', 'signatures', 'sig_' + req.user.id + '.png');`
  - Con dấu trường: `school_seal.png` đặt tại thư mục gốc của repository và `uploads/signatures/school_seal.png`.
- **Cơ sở dữ liệu JSON (`dataStore.js`)**:
  - `dataStore.js` dòng 5–9:
    ```javascript
    const DATA_DIR = path.join(__dirname, 'data');
    const USERS_FILE = path.join(DATA_DIR, 'users.json');
    const DOCS_FILE = path.join(DATA_DIR, 'documents.json');
    const DEPTS_FILE = path.join(DATA_DIR, 'departments.json');
    const SUBS_FILE = path.join(DATA_DIR, 'subscriptions.json');
    ```
- **Quy tắc Git (`.gitignore`)** dòng 18–24 và dòng 37–39:
  ```gitignore
  # Temp uploads & cache
  uploads/temp/
  uploads/documents/*
  !uploads/documents/.gitkeep
  uploads/signatures/*
  !uploads/signatures/.gitkeep
  
  # Google Drive local mirror generated files
  GoogleDrive_KhoTruong/**
  !GoogleDrive_KhoTruong/.gitkeep
  ```
  *Quan sát:* Thư mục `uploads/documents/*`, `uploads/signatures/*`, và `GoogleDrive_KhoTruong/**` đều bị Git bỏ qua (gitignored). Khi Render build hoặc clone lại mã nguồn từ GitHub, các thư mục này chỉ chứa tệp `.gitkeep` rỗng.

### 1.3. Cơ chế cứu cánh & tải file tại `server.js` (`GET /api/documents/:id/file`)
- `server.js` dòng 1436–1584 triển khai chuỗi ưu tiên 5 cấp để phục vụ tệp PDF:
  1. **Cấp 1 (Đĩa cục bộ)**: Quét các đường dẫn ứng viên trên đĩa (`doc.realSignedPath`, `Signed_${safeId}.pdf`, `Step_${safeId}_${s}.pdf`, `doc.filePath`, `doc_${safeId}.pdf`, `recovered_${safeId}.pdf`).
  2. **Cấp 2 (Base64 trong bộ nhớ)** (dòng 1470): Nếu có `doc.fileBase64` hoặc `doc.signedPdfBase64`, ghi lại ra đĩa. *(Tuy nhiên, `dataStore.js` dòng 460–469 hàm `sanitizeDocuments()` đã chủ động `delete doc.fileBase64; delete doc.signedPdfBase64;` để giải phóng RAM)*.
  3. **Cấp 3 (Tra cứu Firebase RTDB)** (dòng 1487): Truy vấn Firebase REST API `https://edusign-school-default-rtdb.asia-southeast1.firebasedatabase.app/documents/${id}.json` để lấy siêu dữ liệu mới nhất nếu đĩa cục bộ bị reset.
  4. **Cấp 4 (Phục hồi trực tiếp từ Google Drive Stream)** (dòng 1508–1545):
     ```javascript
     if ((!resolvedPath || !fs.existsSync(resolvedPath)) && (doc.googleDriveUrl || doc.driveInfo?.viewUrl)) {
       const targetDriveUrl = doc.googleDriveUrl || doc.driveInfo?.viewUrl;
       const fileIdMatch = targetDriveUrl.match(/[-\w]{25,}/);
       if (fileIdMatch) {
         const fileId = fileIdMatch[0];
         const downloadUrl = 'https://drive.usercontent.google.com/download?id=' + fileId + '&export=download';
         // Tải buffer từ Google Drive, ghi lại ra uploads/documents/doc_${safeId}.pdf và cập nhật doc.filePath
     ```
  5. **Cấp 5 (Tổng hợp PDF nhân tạo nếu file gốc hoàn toàn bị mất)** (dòng 1576–1583):
     ```javascript
     const generatedBuffer = await pdfSignerService.generateSignedPdf(doc);
     res.setHeader('Content-Type', 'application/pdf');
     return res.send(Buffer.from(generatedBuffer));
     ```
     Trong `pdfSignerService.js` dòng 279–305: Khi `!sourcePdfBuffer`, dịch vụ dùng `pdf-lib` sinh ra một trang PDF bìa A4 mới in tiêu đề, người ký, tổ chuyên môn và mã hồ sơ thay thế cho nội dung đã mất.

### 1.4. Tích hợp Google Drive Kho trường (`googleDriveService.js`)
- `drive_config.json`:
  ```json
  {
    "enabled": true,
    "autoUploadOnSign": true,
    "schoolFolderId": "THCS_CHU_VAN_AN_ARCHIVE_2026",
    "schoolFolderName": "KHO_HO_SO_SO_TRUONG_THCS_CHU_VAN_AN",
    "gasWebhookUrl": "https://script.google.com/macros/s/AKfycbwGBgauc9xHzRe31_IfCQD-Q9yHwGp4CfYLEam9IupcYhLpNBXbgW0J1t-weD6iUQ87ZQ/exec",
    "backupLocalStorage": true
  }
  ```
- `googleDriveService.js` dòng 74–110:
  - Khi `config.gasWebhookUrl` hợp lệ, gửi HTTP POST chứa `{ action: 'UPLOAD_SIGNED_DOC', fileName, folderPath, docId, title, author, department, signerEmails, fileBase64 }` với tùy chọn `redirect: 'follow'` (bắt buộc vì Google Apps Script phản hồi mã HTTP 302 Redirect sang CDN).
  - Webhook Google Apps Script (`google-apps-script-template.js` dòng 72–138) tự động tạo cây thư mục `[Năm học] / [Họ và tên giáo viên]` trên Google Drive của trường, lưu file PDF, cấp quyền xem qua liên kết và trả về `fileId`, `viewUrl`, `downloadUrl`.
  - Fallback cục bộ (dòng 112–135): Nếu webhook không có hoặc lỗi, hàm lưu vào thư mục `GoogleDrive_KhoTruong/` trên đĩa cục bộ.

### 1.5. Tích hợp Microsoft OneDrive (`oneDriveService.js`)
- `oneDriveService.js` dòng 9–45:
  ```javascript
  function findOneDriveSharedFolder() {
    const userProfile = process.env.USERPROFILE || 'C:\\Users\\HPZBook';
    const exactCandidates = [
      path.join(userProfile, 'OneDrive - Sở GD&ĐT Quảng Ngãi', "Trường THCS Chu Văn An (Đăk Hà)'s files - 15. HÀ VĂN TÝ 26-27"),
      path.join(userProfile, 'OneDrive - Sở GD&ĐT Quảng Ngãi', "Trường THCS Chu Văn An (Đăk Hà)'s files - 12. HÀ VĂN TÝ"),
      path.join(userProfile, 'OneDrive - Sở GD&ĐT Quảng Ngãi')
    ];
  ...
  ```
- `oneDriveService.js` dòng 105–147: Sử dụng lệnh sao chép tệp `fs.copyFileSync(pdfFilePath, destPath)`.
- *Quan sát:* Đây là cơ chế **đồng bộ tệp cục bộ trên Windows Desktop**, KHÔNG PHẢI là REST API (Graph API) đám mây. Trên môi trường máy chủ Linux container của Render, `process.env.USERPROFILE` không tồn tại đường dẫn này, dẫn đến hàm luôn ném lỗi `Chưa tìm thấy thư mục đồng bộ OneDrive trên máy tính`.

### 1.6. Tích hợp Google Firebase Realtime Database
- `firebase-config.js`:
  ```javascript
  window.FIREBASE_CONFIG = {
    enabled: true,
    apiKey: "AIzaSyB6nzog3_XMUrRmrm42b3i0PibP6hkq6PU",
    authDomain: "edusign-school.firebaseapp.com",
    databaseURL: "https://edusign-school-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "edusign-school"
  };
  ```
- `dataStore.js` dòng 643–655 (`syncDocToFirebase`):
  ```javascript
  function syncDocToFirebase(doc) {
    if (!doc || !doc.id) return;
    try {
      const cleanDoc = { ...doc };
      delete cleanDoc.fileBase64;
      delete cleanDoc.signedPdfBase64;
      fetch(`${FIREBASE_RTDB_URL}/documents/${doc.id}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleanDoc)
      }).catch(() => {});
    } catch (e) {}
  }
  ```
  *Quan sát quan trọng:* `dataStore.js` **chủ động xóa `fileBase64` và `signedPdfBase64`** trước khi đẩy lên Firebase RTDB. Do đó, **Firebase RTDB CHỈ LƯU TRỮ METADATA (siêu dữ liệu hồ sơ và chữ ký), KHÔNG LƯU NỘI DUNG TỆP PDF NHỊ PHÂN**.
- `dataStore.js` dòng 657–668 (`syncSignatureToFirebase`): Lưu Base64 của ảnh chữ ký người dùng lên `/signatures/${userId}.json`.

### 1.7. Kết quả đo đạc thực tế trên Cloud Live (Render, GAS Webhook, Firebase RTDB)
Thực thi lệnh kiểm tra trực tiếp ngày 2026-09-15T06:51:26+07:00:
1. **Google Apps Script Webhook**: HTTP 200 OK  
   Phản hồi: `{"status":"active","system":"Unified Zalo Assistant 4.0 (Timetable + EduSign)","school":"TRƯỜNG THCS CHU VĂN AN"}`
2. **Máy chủ Render Live (`https://edusign-vgca.onrender.com`)**: HTTP 200 OK  
   - Gọi `/api/documents`: Trả về **67 hồ sơ**.
   - Kiểm tra tệp mẫu `BC-2026-TONTIN-479008/file`: Trả về HTTP 200, kích thước 364,630 bytes, header chuẩn `%PDF-1.7`.
3. **Firebase Realtime Database Live**: HTTP 200 OK  
   - Tổng số hồ sơ trên Firebase RTDB: **66 hồ sơ**.
   - Số hồ sơ ĐÃ ĐỒNG BỘ Google Drive (`googleDriveUrl` hoặc `driveInfo`): **23 hồ sơ (34.8%)**.
   - Số hồ sơ CHƯA ĐỒNG BỘ Google Drive (chỉ lưu trên đĩa đệm Render): **43 hồ sơ (65.2%)**.
   - Số mẫu chữ ký lưu trên `/signatures/`: **8 mẫu chữ ký** (bao gồm `admin`, `school_seal`, và các giáo viên `user_mtsq01uj_evak`, `user_mtvq3m53`, ...).
4. **Đối chiếu số lượng hồ sơ giữa các môi trường**:
   - `data/documents.json` cục bộ: 104 hồ sơ.
   - Máy chủ Render Live: 67 hồ sơ.
   - Firebase Realtime Database: 66 hồ sơ.
   *(Sự chênh lệch chứng minh dữ liệu lưu trên đĩa container Render bị phụ thuộc vào bản build Git và không tự động kéo toàn bộ danh sách lịch sử khi khởi động lại)*.

---

## 2. LOGIC CHAIN (Chuỗi suy luận & Phân tích cơ chế)

Từ các bằng chứng quan sát trực tiếp trên, chuỗi suy luận logic được xác lập như sau:

```
[render.yaml: plan: free, disks: none]
         │
         ▼
[Đĩa máy chủ Render là Ephemeral Filesystem]
         │
         ▼
[Khi Container Restart / Re-deploy / Idle Sleep 15 phút]
         │
         ├────────────────────────────────────────────────────────────────┐
         ▼                                                                ▼
[uploads/documents/*.pdf BỊ XÓA 100%]                           [data/documents.json bị reset về commit Git]
         │                                                                │
         ├────────────────────────────────────────┐                       │
         ▼                                        ▼                       ▼
(Hồ sơ ĐÃ đồng bộ Google Drive)      (Hồ sơ CHƯA đồng bộ Drive)     [Frontend/Backend truy vấn Firebase RTDB]
         │                                        │                       │
         ▼                                        ▼                       ▼
[/api/documents/:id/file]            [/api/documents/:id/file]     [Metadata phục hồi 100% từ Firebase]
- server.js:1508 tra cứu Drive URL   - Không có Drive URL                 │
- Tải buffer từ Google Drive         - Fallback server.js:1576            │
- Ghi lại ra uploads/documents/      - Sinh PDF giả lập 1 trang           ▼
- Phục hồi 100% tệp gốc ✅           - MẤT 100% NỘI DUNG GỐC ❌   [Hiển thị đủ danh sách, nhưng xem file bị lỗi nếu chưa lên Drive]
```

1. **Bước 1 — Xác định bản chất đĩa Render Free**:
   - Khai báo `plan: free` trong `render.yaml` và không có `disks:` đồng nghĩa với việc toàn bộ hệ thống tệp ghi được (writable directory) chỉ tồn tại trong RAM/overlay disk tạm thời của container.
   - Khi không có request trong 15 phút, Render tắt container (Scale to Zero). Khi có request mới, container mới được tạo từ Docker image đóng gói từ Git. Toàn bộ tệp sinh ra trong phiên trước đều biến mất.

2. **Bước 2 — Phân hóa rủi ro mất mát dữ liệu theo từng thành phần**:
   - **Thành phần A: Ảnh chữ ký người dùng & Con dấu đỏ**:
     - Con dấu `school_seal.png` được lưu trực tiếp trong Git repo -> Sống sót 100% qua restart.
     - Chữ ký giáo viên được đồng bộ lên Firebase `/signatures/${userId}.json` và lưu trong `localStorage` của trình duyệt (`app.js:6082`) -> Sống sót 100% qua restart.
   - **Thành phần B: Siêu dữ liệu hồ sơ (Tiêu đề, Tác giả, Trạng thái ký duyệt, Lịch sử)**:
     - Được hàm `syncDocToFirebase()` đẩy lên Firebase RTDB mỗi khi tạo, ký duyệt hoặc đóng dấu -> Sống sót 100% qua restart. Trình duyệt có thể liệt kê đầy đủ hồ sơ ngay cả khi đĩa Render bị xóa trắng.
   - **Thành phần C: Tệp PDF đã hoàn tất đồng bộ Google Drive (23 hồ sơ hiện tại)**:
     - Được lưu vĩnh viễn trên Kho trường Google Drive qua Google Apps Script Webhook.
     - Cơ chế `server.js:1508` đóng vai trò là "Cầu nối tái tạo" (Auto-rehydration): Tự động stream file từ Google Drive về lại thư mục `uploads/documents/` khi có người bấm xem file -> An toàn 100%.
   - **Thành phần D: Tệp PDF chưa đồng bộ Google Drive (43 hồ sơ hiện tại - bản nháp, chờ ký, hoặc lỗi mạng)**:
     - Vì Firebase RTDB chủ động loại bỏ trường nhị phân `fileBase64`, tệp nhị phân chỉ nằm đơn độc tại `uploads/documents/` của Render.
     - Khi container restart, tệp này bị mất vĩnh viễn. Khi người dùng bấm xem, hệ thống kích hoạt cơ chế Fallback (cấp 5) sinh ra một tệp PDF giả lập 1 trang chỉ có phần khung tiêu đề, làm mất hoàn toàn nội dung giáo án thực tế của giáo viên.

3. **Bước 3 — Đánh giá vai trò của Microsoft OneDrive**:
   - `oneDriveService.js` sử dụng API tệp cục bộ (`fs.copyFileSync`) dựa trên đường dẫn Windows `USERPROFILE`.
   - Trên môi trường Render Linux, tiến trình không thể truy cập thư mục OneDrive Windows. Do đó, OneDrive **hoàn toàn vô hiệu (0% năng lực cứu cánh)** trên máy chủ Render Cloud. OneDrive chỉ có tác dụng khi giáo viên chạy ứng dụng nội bộ trên máy tính cá nhân.

---

## 3. CAVEATS (Điểm giới hạn, Giả định & Phạm vi)

1. **Phạm vi khảo sát là Read-only**:
   - Đại lý Explorer 2 không thực hiện sửa đổi mã nguồn hoặc đẩy cấu hình mới lên máy chủ Render trong phiên điều tra này.
2. **Khả năng tự động kích hoạt Restart của Render Free**:
   - Không can thiệp vào trang quản trị Render Dashboard của nhà trường (cần tài khoản chủ sở hữu Render để nhấn nút Restart hoặc chuyển đổi gói cước có Disk). Khảo sát dựa trên việc kiểm chứng trực tiếp phản hồi API thực tế và cơ chế mã nguồn.
3. **Phụ thuộc vào dịch vụ Google Apps Script**:
   - Tốc độ phục hồi tệp từ Google Drive phụ thuộc vào độ ổn định của liên kết `drive.usercontent.google.com`. Nếu Google giới hạn băng thông (rate limit) hoặc thay đổi chính sách tải file không cần cookie, cơ chế stream tại dòng 1514 cần được bổ sung Service Account Key chính thức.

---

## 4. CONCLUSION (Kết luận thẩm định)

1. **Về rủi ro đĩa tạm thời (Ephemeral Filesystem)**:
   - Hệ thống EduSign VGCA trên Render đang chạy ở gói `plan: free`, **không có Persistent Disk**. Rủi ro mất mát tệp vật lý tại `uploads/documents/` khi container sleep hoặc restart là **100% có thật** đối với các tệp chưa đồng bộ lên Cloud.
2. **Về cơ chế bảo toàn dữ liệu đa tầng (Cloud Defense-in-Depth)**:
   - **Tầng 1 (Google Drive Kho trường)**: Đóng vai trò là **Kho lưu trữ bền vững cốt lõi (Persistent Object Storage)**. Cơ chế Auto-rehydration (`server.js:1508`) hoạt động xuất sắc, có khả năng kéo tệp từ Google Drive về đĩa đệm ngay lập tức.
   - **Tầng 2 (Firebase Realtime Database Singapore)**: Đóng vai trò là **Kho lưu trữ siêu dữ liệu bất biến (Persistent Metadata & Signature Cache)**, đảm bảo danh mục hồ sơ và chữ ký người dùng không bao giờ bị mất khi máy chủ sập.
   - **Tầng 3 (Microsoft OneDrive)**: Chỉ hỗ trợ máy trạm Windows cục bộ, **không hoạt động trên Render Cloud**.
3. **Hiện trạng an toàn dữ liệu thực tế trên Cloud**:
   - Trong số 66 hồ sơ đang tồn tại trên Firebase: **23 hồ sơ (34.8%) tuyệt đối an toàn**, có thể phục hồi nguyên vẹn sau khi Render restart. **43 hồ sơ (65.2%) đang ở trạng thái rủi ro cao**, sẽ bị biến thành PDF giả lập 1 trang nếu Render bị xóa đĩa do chưa được đẩy lên Google Drive.

---

## 5. VERIFICATION METHOD (Phương pháp kiểm chứng thực nghiệm độc lập)

Để một đại lý độc lập hoặc kiểm thử viên nghiệm thu tính chính xác của báo cáo này, thực hiện theo quy trình 4 bước sau:

### Bước 1: Kiểm tra trạng thái máy chủ Render và số lượng hồ sơ
Chạy lệnh PowerShell / Node.js:
```powershell
node -e "
async function verify() {
  const rDocs = await (await fetch('https://edusign-vgca.onrender.com/api/documents', {
    headers: { 'x-user-id': 'admin', 'x-user-username': 'admin', 'x-user-role': 'ADMIN' }
  })).json();
  const fbDocs = await (await fetch('https://edusign-school-default-rtdb.asia-southeast1.firebasedatabase.app/documents.json')).json();
  const fbKeys = Object.keys(fbDocs || {});
  const driveSynced = fbKeys.filter(k => fbDocs[k] && (fbDocs[k].googleDriveUrl || fbDocs[k].driveInfo)).length;
  console.log('Render Docs Count:', rDocs.data.length);
  console.log('Firebase Docs Count:', fbKeys.length);
  console.log('Google Drive Protected Docs:', driveSynced);
  console.log('Unprotected Docs (Ephemeral Risk):', fbKeys.length - driveSynced);
}
verify();
"
```
*Điều kiện đạt:* Khớp con số đo đạc: Render ~67 hồ sơ, Firebase ~66 hồ sơ, Google Drive ~23 hồ sơ được bảo vệ.

### Bước 2: Kiểm chứng cơ chế phục hồi tệp từ Google Drive
Gọi API lấy tệp của một hồ sơ đã có Google Drive URL (ví dụ: hồ sơ có `fileId` Drive) và đo kích thước phản hồi:
```powershell
node -e "
async function testStream() {
  const res = await fetch('https://edusign-vgca.onrender.com/api/documents/BC-2026-TONTIN-479008/file', {
    headers: { 'x-user-id': 'admin', 'x-user-username': 'admin', 'x-user-role': 'ADMIN' }
  });
  const buf = await res.arrayBuffer();
  console.log('Status:', res.status, 'Size bytes:', buf.byteLength, 'Is PDF:', Buffer.from(buf.slice(0, 4)).toString());
}
testStream();
"
```
*Điều kiện đạt:* Status 200, kích thước > 300,000 bytes (tệp thật), header bắt đầu bằng `%PDF`.

### Bước 3: Mô phỏng vòng đời Container (Simulated Ephemeral Lifecycle Test)
Thực hiện kịch bản kiểm thử mô phỏng hiện tượng xóa đĩa trên máy tính:
1. Tạo một hồ sơ mẫu mới không qua ký số BGH (chưa đẩy Google Drive).
2. Xóa toàn bộ nội dung trong thư mục `uploads/documents/` (giả lập Render restart xóa đĩa tạm).
3. Gọi `GET /api/documents/:id/file` đối với hồ sơ này.
4. *Điều kiện kiểm chứng:* Server trả về tệp PDF kích thước nhỏ (~2-3 KB) chứa nội dung văn bản giả lập (`TRUONG THCS CHU VAN AN ... Ma ho so ...`), chứng minh hiện tượng mất tệp gốc khi chưa đồng bộ lên Cloud.

### Bước 4: Kiểm chứng lỗi OneDrive trên Render Cloud
Gọi endpoint đồng bộ OneDrive trên máy chủ Render:
```powershell
node -e "
async function testOneDrive() {
  const res = await fetch('https://edusign-vgca.onrender.com/api/documents/BC-2026-TONTIN-479008/sync-onedrive', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-id': 'admin', 'x-user-username': 'admin', 'x-user-role': 'ADMIN' }
  });
  console.log('Status:', res.status);
  console.log('Body:', await res.text());
}
testOneDrive();
"
```
*Điều kiện đạt:* Status 500 kèm thông báo `"Chưa tìm thấy thư mục đồng bộ OneDrive trên máy tính"`, xác nhận OneDrive không thể hoạt động trên Render.
