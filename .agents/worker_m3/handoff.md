# HANDOFF REPORT — WORKER M3: RENDER CLOUD STORAGE & EPHEMERAL LIFECYCLE VERIFICATION (R2)

**Agent:** Worker M3 (Cloud Architecture & Storage Test Engineer)  
**Role:** Implementer / QA / Specialist  
**Working Directory:** `c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\worker_m3`  
**Target File Owned:** `tests/render_storage_verification.mjs`  
**Milestone:** M3 — Requirement R2: Kiểm chứng Cơ chế Lưu trữ Dữ liệu trên Cloud Render  
**Date:** 2026-09-15T06:58:30+07:00 (UTC: 2026-09-14T23:58:30Z)  

---

## 1. OBSERVATION (Quan sát trực tiếp & Bằng chứng thực nghiệm)

### 1.1. Tệp cấu hình hạ tầng Render và Git Rules
- **Tệp `render.yaml` (dòng 1–12):**
  ```yaml
  services:
    - type: web
      name: edusign-vgca
      env: node
      plan: free
      region: singapore
      buildCommand: npm install
      startCommand: node server.js
  ```
  - `plan: free` được định nghĩa tường minh.
  - Hoàn toàn **không có khối khai báo gắn đĩa (`disks:`)**.
- **Tệp `.gitignore` (dòng 18–24 và 37–39):**
  - `uploads/documents/*` và `uploads/signatures/*` bị bỏ qua bởi Git, chỉ có tệp `.gitkeep` rỗng được theo dõi (`git ls-files uploads/documents/` trả về duy nhất `uploads/documents/.gitkeep`).
  - `uploads/signatures/` trong Git chỉ chứa `uploads/signatures/.gitkeep` và `uploads/signatures/school_seal.png`. Chữ ký cá nhân của giáo viên không nằm trong Git image.

### 1.2. Vị trí lưu trữ dữ liệu cục bộ
- Tệp tải lên và tệp PDF ký duyệt: `uploads/documents/` (hiện có 331 tệp vật lý cục bộ).
- Ảnh chữ ký người dùng: `uploads/signatures/` (4 tệp cục bộ: `sig_admin.png`, `sig_sample.png`, `school_seal.png`, `.gitkeep`).
- Cơ sở dữ liệu tài liệu cục bộ: `data/documents.json` (kích thước 108 bản ghi).

### 1.3. Kết quả đo đạc thực nghiệm từ bộ kiểm thử `tests/render_storage_verification.mjs`
Chạy lệnh `node tests/render_storage_verification.mjs` (thời gian thực thi 4232ms, kết quả 59/59 assertions PASS, Exit code 0):

```
╔══════════════════════════════════════════════════════════════════════════════════════╗
║     EDUSIGN VGCA - R2: RENDER CLOUD STORAGE & EPHEMERAL VERIFICATION SUITE          ║
╚══════════════════════════════════════════════════════════════════════════════════════╝

PROBE 1: RENDER CLOUD INFRASTRUCTURE & EPHEMERAL FILESYSTEM AUDIT
  ✔ PASS | render.yaml file exists in project root 
  ✔ PASS | Render service plan is explicitly "free" (Ephemeral) (render.yaml: plan: free)
  ✔ PASS | Persistent Disk declaration ("disks:") is completely ABSENT (Confirms zero persistent block volume attached)
  ✔ PASS | Render deployment region configured (Region: singapore)
  ✔ PASS | Directory uploads/documents/ exists 
  ✔ PASS | Directory uploads/signatures/ exists 
  ✔ PASS | Database data/documents.json exists 
  ✔ PASS | .gitignore exists 
  ✔ PASS | Git ignores uploads/documents/* files (.gitignore rule present)
  ✔ PASS | Git preserves uploads/documents/.gitkeep (Only empty directory tracked)
  ✔ PASS | Git ignores uploads/signatures/* files (Signatures excluded from git history)
  ✔ PASS | Git ignores local GoogleDrive_KhoTruong mirror (Local mirror excluded)

PROBE 2: CONTAINER RESET & EPHEMERAL DATA LOSS SIMULATION
  ✔ PASS | Test document binary successfully written to uploads/documents/ (Size: 316 bytes, Path: test_lesson_plan_PROBE_EPHEMERAL_*.pdf)
  ✔ PASS | Container reset event: Local file wiped from disk (File purged by ephemeral container reconstruction)
  ✔ PASS | Tier 1 (Disk Candidates): Local disk check fails (Candidate path not found)
  ✔ PASS | Tier 2 (RAM Base64 Cache): Memory payload is absent (Purged by sanitizeDocuments())
  ✔ PASS | Tier 3 (Firebase RTDB): Contains metadata only, zero binary (fileBase64 omitted)
  ✔ PASS | Tier 4 (Google Drive Auto-Recovery): Drive stream unavailable for unsynced doc (Doc was not synced before container sleep)
  ✔ PASS | Tier 5 (Synthetic Generator): Produces synthetic fallback PDF (Size: 90398 bytes in 402ms)

PROBE 3: GOOGLE DRIVE KHO TRƯỜNG CLOUD SYNC & AUTO-RECOVERY STREAM
  ✔ PASS | drive_config.json exists 
  ✔ PASS | googleDriveService returns valid active configuration (service: enabled)
  ✔ PASS | Google Drive integration is enabled (enabled: true)
  ✔ PASS | Auto-upload on sign is active (autoUploadOnSign: true)
  ✔ PASS | School folder ID configured (THCS_CHU_VAN_AN_ARCHIVE_2026)
  ✔ PASS | GAS Webhook URL configured (https://script.google.com/macros/s/AKfycbwGBgauc9xHzRe31_IfCQD-Q9yHwGp4CfYLEam9IupcYhLpNBXbgW0J1t-weD6iUQ87ZQ/exec)
  ✔ PASS | GAS Webhook is online and responds (Latency: 1478ms)
  ✔ PASS | GAS Webhook returns HTTP 200 (Status: 200)
  ✔ PASS | GAS Webhook status is active (System: Unified Zalo Assistant 4.0 (Timetable + EduSign))
  ✔ PASS | GAS Webhook school matches THCS Chu Văn An (School: TRƯỜNG THCS CHU VĂN AN)
  ✔ PASS | Render file serving endpoint responds (Latency: 535ms)
  ✔ PASS | Render file endpoint returns HTTP 200 (Status: 200)
  ✔ PASS | Returned file is a genuine PDF (> 100 KB) (Size: 364,630 bytes)
  ✔ PASS | PDF magic header confirmed (%PDF-) (Header: %PDF-)
  ✔ PASS | Google Drive File ID accurately extracted via Regex (File ID: 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms)
  ✔ PASS | Direct Drive CDN download URL constructed correctly (drive.usercontent.google.com)

PROBE 4: FIREBASE REALTIME DATABASE METADATA REPLICATION & BINARY OMISSION
  ✔ PASS | firebase-config.js exists 
  ✔ PASS | Firebase enabled in config 
  ✔ PASS | Firebase database URL points to Singapore (asia-southeast1) 
  ✔ PASS | Firebase RTDB /documents.json query succeeds (Latency: 198ms)
  ✔ PASS | Firebase RTDB returns HTTP 200 
  ✔ PASS | Firebase RTDB contains live document records (Total records: 71)
  ✔ PASS | STRICT BINARY OMISSION: 0 documents contain "fileBase64" in Firebase (Found: 0)
  ✔ PASS | STRICT BINARY OMISSION: 0 documents contain "signedPdfBase64" in Firebase (Found: 0)
  ✔ PASS | Total binary bloat in Firebase RTDB is strictly zero records (Total binary payloads: 0)
  ✔ PASS | Firebase RTDB /signatures.json query succeeds (Latency: 205ms)
  ✔ PASS | Firebase RTDB preserves user signatures (Total signature samples: 8)
  ✔ PASS | Signature records contain valid image data (8/8 valid)
  ✔ PASS | dataStore.js explicitly deletes cleanDoc.fileBase64 before Firebase PUT (dataStore.js:647)
  ✔ PASS | dataStore.js explicitly deletes cleanDoc.signedPdfBase64 before Firebase PUT (dataStore.js:648)

PROBE 5: MICROSOFT ONEDRIVE LINUX / RENDER ENVIRONMENT SCOPE AUDIT
  ✔ PASS | oneDriveService.js exists 
  ✔ PASS | oneDriveService relies on Windows USERPROFILE environment variable (Windows Desktop only)
  ✔ PASS | oneDriveService contains local Windows fallback path (C:\Users\HPZBook)
  ✔ PASS | oneDriveService uses local filesystem copy (fs.copyFileSync) (Local desktop sync, NOT Cloud Graph API)
  ✔ PASS | findOneDriveSharedFolder() returns NULL in Linux container environment (Folder not found)
  ✔ PASS | syncDocumentToOneDrive() throws expected configuration error on Linux (Error: "Chưa tìm thấy thư mục đồng bộ OneDrive trên máy tính. Thầy vui lòng kiểm tra ứng dụng OneDrive!")
  ✔ PASS | Render OneDrive endpoint responded (Latency: 110ms)
  ✔ PASS | Render returns HTTP 500 Internal Server Error (Linux filesystem incompatibility) (HTTP Status: 500)
  ✔ PASS | Render error message explicitly confirms OneDrive sync failure on Linux (Lỗi đồng bộ OneDrive: Chưa tìm thấy thư mục đồng bộ OneDrive trên máy tính. Thầy vui lòng kiểm tra ứng dụng OneDrive!)

PROBE 6: MULTI-TIER DATA CENSUS & EPHEMERAL RISK AUDIT BREAKDOWN
  ✔ PASS | Multi-tier census collected successfully 
```

### 1.4. Bảng tổng hợp đối soát thực tế đa tầng (Census Tables)

**BẢNG 1: ĐỐI SOÁT HỒ SƠ ĐA MÔI TRƯỜNG**
| Môi trường Lưu trữ | Tổng số Hồ sơ | Đã đồng bộ Google Drive (✅) | Nguy cơ Mất trên Đĩa tạm (❌) |
|---|---|---|---|
| **Cục bộ (`data/documents.json`)** | 108 | 40 (37.0%) | 68 (63.0%) |
| **Máy chủ Render Live (`/api/documents`)** | 67 | 0 (0.0% trên đĩa) | 67 (100.0%) |
| **Firebase Realtime Database (Singapore)** | 71 | 25 (35.2%) | 46 (64.8%) |

**BẢNG 2: ĐẶC TÍNH VÀ NĂNG LỰC CỨU CÁNH CỦA CÁC CƠ CHẾ LƯU TRỮ**
| Cơ chế Lưu trữ | Nội dung Lưu trữ | Tác động khi Render Reset | Năng lực Phục hồi Dữ liệu |
|---|---|---|---|
| **Render Ephemeral Disk** | `uploads/documents/`, `uploads/signatures/` | Bị xóa sạch 100% về commit Git | 0% (Mất vĩnh viễn tệp nhị phân gốc nếu chưa đồng bộ) |
| **Google Drive Kho Trường** | Tệp PDF đã ký duyệt, phân cấp theo Năm học / Tên giáo viên | Bảo toàn 100% trên Cloud | 100% tự động tải về (`server.js:1508`) |
| **Firebase RTDB (Singapore)** | Siêu dữ liệu hồ sơ, workflow log, Base64 chữ ký | Bảo toàn 100% trên Cloud | 100% phục hồi metadata (loại bỏ tệp nhị phân) |
| **Microsoft OneDrive** | Bản sao thư mục Windows Desktop cá nhân | Không hỗ trợ Linux (trả về 500) | 0% trên Cloud Render (phạm vi máy trạm) |

**BẢNG 3: PHÂN LOẠI MỨC ĐỘ RỦI RO TRÊN HẠ TẦNG CLOUD HIỆN TẠI**
| Danh mục Dữ liệu | Số lượng | Tỷ lệ An toàn | Trạng thái Disaster Recovery |
|---|---|---|---|
| **PDF an toàn trên Google Drive** | 25 hồ sơ | 35.2% | **An toàn tuyệt đối**: Auto-rehydration tự động kéo từ CDN |
| **Metadata trên Firebase RTDB** | 71 hồ sơ | 100.0% | **An toàn**: Toàn bộ lịch sử duyệt, trạng thái ký được bảo toàn |
| **Ảnh chữ ký giáo viên** | 8 mẫu | 100.0% | **An toàn**: Lưu trong `/signatures/` của Firebase RTDB |
| **Tệp PDF ở mức rủi ro cao (Ephemeral Risk)** | 46 hồ sơ | 64.8% | **Nguy hiểm**: Nếu Render restart, tệp gốc bị mất và biến thành PDF giả lập 1 trang |

---

## 2. LOGIC CHAIN (Chuỗi suy luận từ quan sát đến kết luận)

1. **Từ `render.yaml` và `disks:`**:
   - `render.yaml` chỉ định `plan: free` và không có trường `disks:`. Theo kiến trúc hạ tầng container của Render, môi trường Free/Starter chạy trên Ephemeral Filesystem (đĩa tạm thời dựa trên Docker overlay).
   - Khi không có request trong 15 phút, Render đưa container vào trạng thái ngủ (scale to zero). Khi có request mới hoặc khi re-deploy, container được tái tạo từ Git image.
   - Do `.gitignore` bỏ qua `uploads/documents/*` và `uploads/signatures/*`, Git image hoàn toàn rỗng. Do đó, toàn bộ tệp nhị phân sinh ra trong runtime tại các thư mục này bị xóa sạch 100% về mốc zero.

2. **Từ chuỗi phục hồi 5 cấp trong `server.js:1436-1584`**:
   - Cấp 1: Tìm tệp trên đĩa cục bộ (`uploads/documents/`) -> Thất bại khi container vừa restart.
   - Cấp 2: Tìm Base64 trong RAM -> Thất bại do hàm `sanitizeDocuments()` tại `dataStore.js:460` đã chủ động xóa `fileBase64` để giải phóng bộ nhớ.
   - Cấp 3: Tra cứu Firebase RTDB -> Tìm thấy metadata của hồ sơ, nhưng trường `fileBase64` không có vì `syncDocToFirebase()` tại `dataStore.js:646` chủ động xóa trước khi lưu để tối ưu hóa quota.
   - Cấp 4: Tự động tải từ Google Drive Stream -> Nếu hồ sơ đã có `googleDriveUrl` (35.2%), hàm tải tệp từ Google Drive CDN và ghi lại ra đĩa cục bộ -> Khôi phục 100% tệp gốc.
   - Cấp 5: Nếu hồ sơ chưa được đồng bộ Google Drive (64.8%), hệ thống kích hoạt `pdfSignerService.generateSignedPdf(doc)` sinh ra một tệp PDF giả lập 1 trang chỉ in khung tiêu đề và thông tin hành chính -> Nội dung bài giảng/giáo án thực tế bị mất hoàn toàn.

3. **Từ cơ chế Google Drive (`googleDriveService.js`)**:
   - Webhook Google Apps Script (`driveConfig.gasWebhookUrl`) đã được kiểm chứng hoạt động trực tuyến (HTTP 200, phản hồi hợp lệ).
   - Khi tính năng ký duyệt được hoàn tất, tệp được đẩy tự động lên Google Drive Kho trường. Tệp trên Google Drive không phụ thuộc vào vòng đời của Render container, tạo thành tầng lưu trữ bền vững cốt lõi (Persistent Object Storage).

4. **Từ cơ chế Microsoft OneDrive (`oneDriveService.js`)**:
   - `oneDriveService.js` sử dụng lệnh đồng bộ tệp cục bộ `fs.copyFileSync` và dò tìm thư mục dựa trên biến môi trường Windows `USERPROFILE`.
   - Trên môi trường Render Linux, đường dẫn này không tồn tại. Lệnh gọi `/api/documents/:id/sync-onedrive` trên Render live trả về HTTP 500. Do đó, OneDrive chỉ có giá trị khi giáo viên chạy ứng dụng nội bộ trên máy Windows cá nhân, hoàn toàn không có khả năng bảo toàn dữ liệu trên Render Cloud.

---

## 3. CAVEATS (Điểm giới hạn & Giả định)

1. **Phạm vi kiểm thử không làm gián đoạn dịch vụ live**:
   - Bộ kiểm thử `tests/render_storage_verification.mjs` thực hiện mô phỏng container reset trên tệp probe cục bộ riêng biệt (`test_lesson_plan_PROBE_EPHEMERAL_*.pdf`), không can thiệp nút Restart trên Render Dashboard của nhà trường nhằm tránh gián đoạn các giáo viên đang thao tác thật.
2. **Số lượng hồ sơ đồng bộ biến động theo thời gian thực**:
   - Số lượng hồ sơ trên Firebase (71 hồ sơ) và tỷ lệ đồng bộ (35.2%) phản ánh chính xác trạng thái tại thời điểm đo đạc (2026-09-15). Khi các giáo viên tiếp tục ký duyệt và Webhook GAS đẩy tệp lên Drive, số lượng tệp an toàn sẽ tăng lên tương ứng.
3. **Phụ thuộc kết nối mạng ngoại vi**:
   - Việc tải file qua re-hydration stream phụ thuộc vào đường truyền mạng từ Render đến CDN của Google (`drive.usercontent.google.com`).

---

## 4. CONCLUSION (Kết luận thẩm định)

1. **Xác nhận tính chính xác của Requirement R2**:
   - Đĩa của máy chủ Render `plan: free` là **Ephemeral Filesystem**, không có khả năng lưu trữ bền vững. Mọi tệp lưu tại `uploads/documents/` và các thay đổi chưa commit trong `data/documents.json` đều sẽ biến mất khi container restart hoặc ngủ.
2. **Đánh giá năng lực của các dịch vụ Cloud**:
   - **Google Drive Kho trường**: Đạt chuẩn **Lưu trữ Bền vững Cốt lõi (100% Resilient)**. Cơ chế Auto-rehydration stream tại `server.js:1508` hoạt động hiệu quả, tự động phục hồi tệp gốc về container khi người dùng truy cập.
   - **Firebase Realtime Database**: Đạt chuẩn **Lưu trữ Siêu dữ liệu Bất biến (100% Resilient Metadata & Signatures)**. Xác nhận 100% hồ sơ không chứa dữ liệu nhị phân thô, giúp tiết kiệm băng thông và bảo vệ quota cơ sở dữ liệu.
   - **Microsoft OneDrive**: **0% năng lực trên Render Cloud**. Chỉ có phạm vi hoạt động trên máy trạm Windows cục bộ.
3. **Khuyến nghị kiến trúc cho nhà trường**:
   - Cần đảm bảo quy trình tự động đồng bộ Google Drive (`autoUploadOnSign: true`) luôn được kích hoạt ngay khi giáo viên nộp bài hoặc khi ký bước 1, thay vì chỉ đồng bộ khi BGH đóng dấu xong, nhằm giảm thiểu tối đa 46 hồ sơ đang ở vùng nguy cơ Ephemeral Risk.

---

## 5. VERIFICATION METHOD (Phương pháp kiểm chứng độc lập)

Kiểm thử viên hoặc đại lý kiểm toán độc lập có thể nghiệm thu toàn bộ kết quả bằng lệnh duy nhất:

```powershell
node tests/render_storage_verification.mjs
```

### Tiêu chí đạt chuẩn (Acceptance Criteria):
1. Mã thoát (Exit Code): `0`.
2. Kết quả kiểm thử: `59/59 assertions PASS` (0 assertions failed).
3. Thời gian thực thi: `< 6000ms`.
4. Báo cáo hiển thị đủ 3 bảng ASCII: Đối soát hồ sơ đa môi trường, Đặc tính phục hồi dữ liệu, và Phân loại mức độ rủi ro.
5. Kiểm tra cú pháp và chất lượng mã nguồn:
   ```powershell
   npx oxlint tests/render_storage_verification.mjs
   ```
   Kết quả: `0 warnings and 0 errors`.

### Điều kiện bác bỏ (Invalidation Conditions):
- Nếu bất kỳ assertion nào trả về `FAIL`.
- Nếu phát hiện tệp nhị phân `fileBase64` tồn tại trong Firebase Realtime Database.
- Nếu endpoint OneDrive trên Render trả về HTTP 200 thay vì HTTP 500 (chứng tỏ cấu hình sai khác với môi trường Linux container thực tế).
