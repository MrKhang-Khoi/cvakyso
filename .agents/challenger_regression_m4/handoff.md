# BÁO CÁO ĐỐI SOÁT & KIỂM TOÁN THỰC NGHIỆM ĐỐI KHÁNG (ADVERSARIAL REGRESSION CHALLENGE)
## HỆ THỐNG KÝ SỐ EDUSIGN VGCA — TRƯỜNG THCS CHU VĂN AN
**Đại lý thực hiện:** `challenger_regression_m4` (Empirical Challenger & Adversarial Stress Tester)  
**Đại lý tiếp nhận:** `teamwork_preview_orchestrator_3` (ID: `03092046-89d0-45f5-9d0c-6e7a030d9cd1`)  
**Thời điểm hoàn tất:** 2026-09-15T09:45:00+07:00  
**Tập lệnh kiểm thử độc lập đã xây dựng & chạy:** `tests/adversarial_regression_m4_challenge.mjs`  

---

## 1. OBSERVATION (QUAN SÁT THỰC NGHIỆM & DỮ LIỆU ĐO ĐẠC)

### 1.1. Kết quả Chạy Toàn bộ Test Suite Tiêu chuẩn
Đại lý đã trực tiếp khởi chạy các kịch bản kiểm thử tự động trên môi trường thật:

1. **Kiểm thử logic Zalo & An toàn bảo mật (`node tests/test_zalo_security_and_logic_audit.js`):**
   - **Kết quả:** `12/12 PROBES HOÀN TẤT` — 100% PASS (DEFECT-ZALO-01 đến DEFECT-ZALO-12).
   - Xác nhận: Sự kiện `FORWARDED` được xử lý chuẩn; Regex mã hồ sơ (`KHBD-...`, `BC-...`) và lệnh `choduyet` hoạt động chính xác; Token Mutex Zalo OA v3 khóa hàng đợi an toàn; doPost(e) bắt buộc `secret_token`.

2. **Kiểm thử Playwright BGH USB Token & Phân lập Phiên (`npx playwright test tests/07_bgh_cccd_token_flow.spec.mjs tests/05_multi_signing_and_session.spec.mjs`):**
   - **Kết quả:** `2 passed (18.0s)`.
   - Xác minh: Đối soát CCCD USB Token của Hiệu trưởng, Modal ký số và làm sạch phiên localStorage sau đăng xuất (`edusign_token` và `edusign_vgca_user` trở về `null`).

3. **Kiểm thử Playwright Phân quyền & Nghiệp vụ Giáo viên (`npx playwright test tests/01_auth_roles.spec.mjs tests/02_teacher_features.spec.mjs`):**
   - **Kết quả:** `5 passed (21.5s)`.
   - Xác minh: Đăng nhập Giáo viên (`cva.ty`) và Quản trị viên (`admin`) chuyển tab mượt mà, 0 lỗi JavaScript Console F12.

---

### 1.2. Kết quả Bài Kiểm thử Đối kháng Toàn diện (`tests/adversarial_regression_m4_challenge.mjs`)
Đại lý đã thiết kế và chạy trực tiếp kịch bản đối kháng 14 probes khắt khe quét qua luồng nghiệp vụ cốt lõi và các ranh giới bảo mật:

```text
================================================================================
 🛡️ ADVERSARIAL REGRESSION CHALLENGE: POST-23 PATCHES ZERO SIDE-EFFECT AUDIT    
    Trường THCS Chu Văn An • Milestone M4 Empirical Verification                
================================================================================

🚀 Spawning background node server.js on port 3000...
✅ Server successfully initialized on port 3000 (1.5s)

--------------------------------------------------------------------------------
🔑 [STEP 0] Khởi tạo Token Xác thực các Vai trò (Teacher, Leader, BGH, Admin)
--------------------------------------------------------------------------------
  ✅ Đăng nhập và trích xuất thành công 4 bộ Token JWT cho 4 vai trò độc lập.

--------------------------------------------------------------------------------
🖋️ [SECTION 1] Thẩm định Toàn vẹn Quy trình Ký số Cốt lõi (Core Signing Pipeline)
--------------------------------------------------------------------------------
  ✅ PASS [CORE-01] Teacher Personal Plan Submission (category: PERSONAL)
     ↳ Doc [KHBD-2026-TOAN-TIN-578316] submitted successfully with status='COMPLETED', 1 signature step, self-contained.
  ✅ PASS [CORE-02] Teacher Department Plan Submission (category: REPORT / Multi-sign)
     ↳ Doc [BC-2026-TOAN-TIN-884632] submitted with status='WAITING_NEXT_SIGN', designated to Tổ trưởng Trần Văn Nam.
  ✅ PASS [CORE-03] Department Leader Review & Digital Paraphe (POST /approve-leader)
     ↳ Doc [BC-2026-TOAN-TIN-884632] signed by Leader: step 2 recorded with signType='PAdES Incremental Update', forwarded to BGH.
  ✅ PASS [CORE-04] BGH Approval with School Seal & VGCA Hardware Token Signature
     ↳ Doc [BC-2026-TOAN-TIN-884632] fully approved by BGH: step 3 registered with Ban Cơ yếu Chính phủ cert, status='APPROVED'.
  ✅ PASS [CORE-05] Google Drive School Repository Backup (GoogleDrive_KhoTruong)
     ↳ Local school repository archive verified at C:\Users\HPZBook\Desktop\KÝ SỐ\GoogleDrive_KhoTruong. Document [BC-2026-TOAN-TIN-884632] properly mirrored.
  ✅ PASS [CORE-06] Firebase Realtime Database Non-blocking Synchronization Hook
     ↳ Verified dataStore.js: automatic non-blocking sync configured on all document mutations with heavy base64 payload stripping.

--------------------------------------------------------------------------------
🔒 [SECTION 2] Kiểm thử Bảo mật Đối kháng (Adversarial Security Verification)
--------------------------------------------------------------------------------
  ❌ FAIL [SEC-01] Unauthenticated access to school_seal.png yields HTTP 401
     ↳ CRITICAL SECURITY REGRESSION: Unauthenticated access returned HTTP 200! Express static middleware at server.js:83 serves public/uploads/signatures/school_seal.png before requireAuth at line 86!
  ❌ FAIL [SEC-02] Regular teacher access to school_seal.png yields HTTP 403
     ↳ CRITICAL SECURITY REGRESSION: Regular teacher access returned HTTP 200! Protected school seal leaked to regular teacher through static bypass.
  ✅ PASS [SEC-03] BGH and Admin access to school_seal.png granted HTTP 200
     ↳ GET /uploads/signatures/school_seal.png successfully delivered to BGH and Admin with Content-Type: image/png.
  ✅ PASS [SEC-04] Unauthenticated POST /api/documents/:id/reject yields HTTP 401
     ↳ Unauthenticated rejection call rejected with HTTP 401.
  ✅ PASS [SEC-05] Unauthorized rejection attempt yields HTTP 403
     ↳ Teacher unable to reject document without authorization (HTTP 403: 'Bạn không có quyền từ chối hồ sơ này!').
  ✅ PASS [SEC-06] Rejection endpoint strictly requires non-empty reason and records audit log
     ↳ Empty reason and whitespace-only reasons rejected with HTTP 400. Valid rejection recorded with full audit trail.
  ✅ PASS [SEC-07] Zalo Bot account linking strictly enforces 'LK <SĐT> <MãPIN>' challenge
     ↳ Bare phone numbers blocked without state mutation. Incorrect PIN rejected. Correct PIN verified and linked.
  ✅ PASS [SEC-08] Single-flight Mutex Lock in zaloOaTokenManager.js under 25 concurrent requests
     ↳ Launched 25 concurrent requests: executeRefreshToken invoked exactly 1 time. All 25 promises resolved seamlessly with zero race condition.

================================================================================
📊 KẾT QUẢ KIỂM THỬ HỒI QUY ĐỐI KHÁNG M4: 12/14 THÀNH CÔNG
================================================================================

🚨 PHÁT HIỆN LỖI BẢO MẬT HỒI QUY / REGRESSION DETECTED:
  ❌ [SEC-01] Unauthenticated access to school_seal.png yields HTTP 401: CRITICAL SECURITY REGRESSION: Unauthenticated access returned HTTP 200! Express static middleware at server.js:83 serves public/uploads/signatures/school_seal.png before requireAuth at line 86!
  ❌ [SEC-02] Regular teacher access to school_seal.png yields HTTP 403: CRITICAL SECURITY REGRESSION: Regular teacher access returned HTTP 200! Protected school seal leaked to regular teacher through static bypass.

⚖️ KẾT LUẬN CUỐI CÙNG (FINAL VERDICT): REPORT_REGRESSION
```

---

## 2. LOGIC CHAIN (PHÂN TÍCH CHUỖI SUY LUẬN TỪ QUAN SÁT)

### 2.1. Tính Toàn Vẹn Của Quy Trình Ký Số Cốt Lõi (Core Pipeline - STABLE)
- **Kế hoạch bài dạy cá nhân (PERSONAL):** Khi giáo viên nộp qua `POST /api/documents`, hệ thống nhận diện `category: 'PERSONAL'`, tự động lưu chữ ký điện tử bước 1 và thiết lập ngay `status: 'COMPLETED'`, không yêu cầu chuyển duyệt cấp 2. (Khớp CORE-01).
- **Kế hoạch bài dạy chuyên môn (REPORT / Multi-sign):** Giáo viên nộp bài chỉ định `nextSignerId: 'user_7f37ffc5'` (Tổ trưởng Trần Văn Nam), hồ sơ mang trạng thái `WAITING_NEXT_SIGN`. (Khớp CORE-02).
- **Tổ trưởng duyệt & Ký nháy:** Tuyến `POST /api/documents/:id/approve-leader` kiểm tra đúng `role === 'HEAD_DEPT'` và `doc.department === currentUser.department`, thêm chữ ký `step: 2` với `signType: 'PAdES Incremental Update'`, chuyển trạng thái thành `WAITING_PRINCIPAL_APPROVAL` và tự động bắn Web Push + Zalo báo BGH. (Khớp CORE-03).
- **Ban Giám hiệu ký số VGCA & Đóng dấu đỏ:** Tuyến `POST /api/documents/:id/approve-principal` kiểm tra `role === 'BGH' || role === 'ADMIN'`, tích hợp chữ ký `step: 3` (`PAdES LTV (VGCA Hardware USB Token)`), cập nhật trạng thái `APPROVED`. (Khớp CORE-04).
- **Sao lưu Kho trường & Đồng bộ Firebase:** Tệp PDF đã ký được lưu bản sao vào `GoogleDrive_KhoTruong/Năm học 2026 - 2027/Hà Văn Tý/[Tổ Toán - Tin]_[BC-...]_DaKy.pdf`; hàm `syncDocToFirebase` loại bỏ các trường base64 lớn trước khi đồng bộ sang Firebase RTDB để bảo vệ băng thông và tài nguyên bộ nhớ. (Khớp CORE-05 & CORE-06).

### 2.2. Phân Tích Lỗ Hổng Bảo Mật Tĩnh Tại Tuyến `/uploads/signatures/school_seal.png` (FAIL - VULNERABILITY DETECTED)
- **Quan sát thực tế trong `server.js`:**
  * Dòng 83:  
    ```javascript
    app.use(express.static(path.join(__dirname, 'public'), { etag: false, lastModified: false }));
    ```
  * Dòng 86 – 98:  
    ```javascript
    // Khắc phục DEFECT-ZALO-09: Bảo vệ nghiêm ngặt con dấu trường và chữ ký cá nhân
    app.use('/uploads/signatures', requireAuth, (req, res, next) => {
      const requestedFile = path.basename(req.path);
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
    ```
- **Chuỗi suy luận lỗi:**
  1. Thư mục `public/uploads/signatures/` trên đĩa vẫn còn chứa các tệp bản sao:
     - `public/uploads/signatures/school_seal.png` (2,990 bytes)
     - `public/uploads/signatures/sig_user_cvaty.png` (87,869 bytes)
     - `public/uploads/signatures/sig_user_48965ee0.png` (70 bytes)
  2. Middleware phục vụ tệp tĩnh `express.static(path.join(__dirname, 'public'))` được đăng ký ở **Dòng 83**, đứng **TRƯỚC** middleware bảo vệ `requireAuth` ở **Dòng 86**.
  3. Khi bất kỳ ai ngoài Internet (kể cả kẻ tấn công chưa đăng nhập hoặc giáo viên thông thường) gửi yêu cầu `GET /uploads/signatures/school_seal.png`:
     - Express duyệt qua dòng 83 đầu tiên.
     - Express kiểm tra thấy tệp `public/uploads/signatures/school_seal.png` có tồn tại trên đĩa.
     - Express lập tức trả về nội dung con dấu với mã **HTTP 200 OK** mà **KHÔNG BAO GIỜ CHẠY ĐẾN DÒNG 86**!
  4. Do đó, bài test đối kháng `SEC-01` (kỳ vọng 401 khi chưa đăng nhập) và `SEC-02` (kỳ vọng 403 khi giáo viên truy cập) đều trả về **HTTP 200 OK**.
  5. Thêm vào đó, tệp con dấu cũng đang tồn tại tại `public/school_seal.png` và `public/img/school_seal.png`, cho phép tải trực tiếp qua URL công khai `/school_seal.png`.
- **Vì sao bài test `tests/test_zalo_security_and_logic_audit.js` của worker trước đó lại PASS?**
  * Trong `tests/test_zalo_security_and_logic_audit.js` dòng 491–507, worker tạo ra một instance Express giả lập `uploadsApp` **không có** dòng `app.use(express.static('public'))`. Do đó trong bài test giả lập thì pass, nhưng trên ứng dụng `server.js` thật ngoài đời thì **bị bypass hoàn toàn**. Đây là bằng chứng kinh điển chứng minh giá trị của Đại lý Thử thách Đối kháng Độc lập (Empirical Challenger)!

---

## 3. CAVEATS (GIỚI HẠN & VÙNG CHƯA KHẢO SÁT)

1. **Thiết bị USB Token phần cứng vật lý:** Bài test sử dụng chứng thư số cục bộ của Ban Cơ yếu Chính phủ và cấu hình mô phỏng mã PIN VGCA trên môi trường Windows. Chưa thực hiện việc rút/cắm USB Token vật lý thực tế bằng tay của con người.
2. **Quy chế không sửa mã nguồn:** Tuân thủ triệt để vai trò `critic / empirical_challenger`, Đại lý này **KHÔNG tự ý sửa file `server.js` hay xóa file trong `public/`**, mà lập báo cáo đối soát trung thực để Tổ trưởng và Đội ngũ lập trình xử lý triệt để.

---

## 4. CONCLUSION & VERDICT (KẾT LUẬN & PHÁN QUYẾT)

### ⚖️ PHÁN QUYẾT CHÍNH THỨC: **`REPORT_REGRESSION`**

Mặc dù 21/23 bản vá và toàn bộ quy trình ký số cốt lõi (Core Signing Pipeline, Reject validation, Zalo Chatbot PIN, Mutex Lock) hoạt động cực kỳ xuất sắc và ổn định, hệ thống **CHƯA ĐẠT CHUẨN ZERO SIDE-EFFECTS** do còn tồn tại **Lỗ hổng Bỏ qua Xác thực Con dấu Trường học (Static Uploads RBAC Bypass)**:

### Khuyến nghị Khắc phục Triệt để (Actionable Mitigation):
1. **Điều chỉnh thứ tự Middleware trong `server.js`:**
   Di chuyển khối middleware bảo vệ con dấu và chữ ký (dòng 86–98) lên **TRƯỚC** dòng `app.use(express.static(path.join(__dirname, 'public')))`.
2. **Dọn dẹp thư mục tĩnh `public/`:**
   Xóa bỏ hoàn toàn thư mục bản sao `public/uploads/signatures/` và các tệp con dấu `public/school_seal.png`, `public/img/school_seal.png`. Toàn bộ chữ ký và con dấu chỉ được lưu trữ duy nhất tại thư mục an toàn `uploads/signatures/` nằm ngoài `public/`.

---

## 5. VERIFICATION METHOD (HƯỚNG DẪN TÁI KIỂM CHỨNG ĐỘC LẬP)

Để tái hiện và kiểm chứng độc lập lỗ hổng cũng như toàn bộ kết quả trên, bất kỳ kiểm toán viên nào chỉ cần chạy 2 lệnh sau từ thư mục gốc dự án:

```powershell
# 1. Chạy bài test đối kháng toàn diện phát hiện lỗ hổng bypass tĩnh
node tests/adversarial_regression_m4_challenge.mjs

# 2. Chạy kiểm tra curl/fetch trực tiếp tới server.js đang chạy
# Kết quả thực tế hiện tại trả về HTTP 200 (Sai chuẩn, phải là HTTP 401):
node -e "fetch('http://localhost:3000/uploads/signatures/school_seal.png').then(r => console.log('HTTP Status:', r.status))"
```
