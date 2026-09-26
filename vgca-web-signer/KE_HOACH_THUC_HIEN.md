# KẾ HOẠCH CHI TIẾT: PHÁT TRIỂN MODULE KÝ SỐ VGCA CHẠY TRỰC TIẾP TRÊN WEB
## (VGCA Web-Direct Remote Signer Engine - Chuẩn Nghị định 30/2020/NĐ-CP & ETSI TS 119 432)

> **Cơ quan thẩm định kỹ thuật:** OpenAI Codex Reasoning Engine (qua 9Router Gateway).  
> **Mục tiêu:** Xây dựng một ứng dụng ký số chuyên dùng công vụ VGCA chạy độc lập 100% trên nền tảng Web, loại bỏ hoàn toàn sự phụ thuộc vào ứng dụng Windows `Virtual CSP v2.0` và `EduSign Agent`.  
> **Nguyên tắc triển khai:** Độc lập tuyệt đối trong thư mục `vgca-web-signer`, viết và chạy thử nghiệm kiểm chứng đạt 100% mới tích hợp vào hệ thống chính.

---

### PHẦN I: BẢN ĐỒ KIẾN TRÚC HỆ THỐNG (SYSTEM ARCHITECTURE)

```
[Trình duyệt Web của Giáo viên] (Chrome, Edge, Safari, iPad, Mobile)
            │
            │ (1) HTTPS / Session Cookie HttpOnly / Không lưu Token vào LocalStorage
            ▼
┌────────────────────────────────────────────────────────────────────────┐
│  VGCA WEB-DIRECT GATEWAY (Node.js / Express độc lập)                   │
│                                                                        │
│  1. Auth Controller: Điều phối luồng QR Code & Polling trạng thái       │
│  2. Session Manager: Quản lý Token trong RAM (Zero-Disk Storage)       │
│  3. PDF Signer Engine: Băm ByteRange SHA-256 & Đóng gói PAdES B-T     │
│  4. TSA Client: Kết nối lấy Dấu thời gian điện tử (ca.gov.vn/tsa)      │
│  5. OCSP Client: Kiểm tra tính hợp lệ chứng thư (ocsp.ca.gov.vn)       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    │ (2) RESTful API chuẩn ETSI TS 119 432 v2.0
                                    ▼
       [Hạ tầng Ký số Ban Cơ yếu Chính phủ (ca.gov.vn / HSM)]
```

---

### PHẦN II: QUY TRÌNH KỸ THUẬT 5 BƯỚC (5-STAGE SIGNING WORKFLOW)

#### **Bước 1: Khởi tạo phiên & Hiển thị mã QR (`/api/vgca/qr/start`)**
* Backend sinh `sessionId` ngẫu nhiên 128-bit trong RAM.
* Backend gọi hàm `loginQR_sendRequest` tới máy chủ Ban Cơ yếu:
  ```json
  {
    "action": "LOGIN",
    "format": "png",
    "height": 220,
    "width": 220,
    "lang": "VN",
    "profile": "rssp-119.432-v2.0",
    "relyingParty": "vCSP"
  }
  ```
* Máy chủ Ban Cơ yếu trả về ảnh mã QR dạng Base64 và `qrCodeUUID`.
* Frontend hiển thị mã QR kèm đồng hồ đếm ngược 180 giây.

#### **Bước 2: Xác thực danh tính thời gian thực (`/api/vgca/qr/poll`)**
* Giáo viên mở điện thoại thông minh quét mã QR.
* Frontend Web gọi polling (hoặc Server-Sent Events - SSE) kiểm tra trạng thái qua `getResultBody`.
* Khi giáo viên xác nhận thành công:
  * Máy chủ Ban Cơ yếu trả về `accessToken`, `refreshToken`, và thông tin chủ sở hữu (`fullName`, email công vụ `@quangngai.gov.vn`, `phone`).
  * Backend tự động gọi `list credentials` để lấy `credentialID` hợp lệ.
  * Màn hình Web tự động chuyển sang trạng thái: *"Chào Thầy/Cô [Họ và Tên] - Đã kết nối Chứng thư số công vụ thành công!"*.

#### **Bước 3: Băm tài liệu PDF & Xin cấp quyền ký (`/api/vgca/sign/prepare`)**
* Giáo viên tải file PDF lên hoặc chọn văn bản cần duyệt, kéo vị trí con dấu.
* Backend phân tích cấu trúc PDF, tính toán vùng chữ ký (ByteRange), tính toán mã băm SHA-256 (`hashAlgorithmOID: 2.16.840.1.101.3.4.2.1`).
* Backend gửi gói tin `authorize` lên máy chủ Ban Cơ yếu mang theo `credentialID` và `documentDigests`.

#### **Bước 4: Nhận Chữ ký số ECDSA & Đóng Dấu Thời Gian TSA (`/api/vgca/sign/commit`)**
* Máy chủ Ban Cơ yếu trả về mảng `signatures` chứa chữ ký số chuẩn ECDSA (ASN.1 DER format OID `1.2.840.10045.4.3.2`).
* Backend đồng thời gửi yêu cầu RFC 3161 sang máy chủ cấp dấu thời gian:
  * Địa chỉ TSA: `http://ca.gov.vn/tsa` (theo cấu hình VGCASignTool chuẩn của Cục).
  * Nhận con dấu thời gian điện tử (TimeStampToken) chống làm giả thời gian.
* Kiểm tra OCSP trực tuyến tại `http://ocsp.ca.gov.vn`.

#### **Bước 5: Hoàn tất & Xuất bản PDF chuẩn Nghị định 30/2020/NĐ-CP**
* Đóng gói toàn bộ Chữ ký ECDSA + TimeStampToken TSA + Chứng chỉ X.509 vào tệp PDF theo chuẩn PAdES Baseline-T (ETSI EN 319 142).
* Tệp PDF hoàn tất có con dấu xanh hợp lệ (Signature Valid) khi mở trên Adobe Acrobat Reader hoặc hệ thống xác thực của Ban Cơ yếu.
* Xóa ngay lập tức `accessToken` khỏi bộ nhớ RAM để đảm bảo an toàn tuyệt đối.

---

### PHẦN III: KẾ HOẠCH MÔI TRƯỜNG THỬ NGHIỆM ĐỘC LẬP (TEST HARNESS & SIMULATOR)

Để việc phát triển **không làm gián đoạn hệ thống đang chạy**, **không sợ bị khóa tài khoản thật của giáo viên** và **chạy được trên máy dev/Render**, kế hoạch thiết lập **2 chế độ chạy (Dual-Mode)**:

1. **Chế độ Giả lập (Simulator Mode - Mock VGCA Server):**
   * Xây dựng tệp `vgca-mock-server.js` mô phỏng chính xác 100% các mã phản hồi HTTP 200, 3035 (Đang xử lý), lỗi token hết hạn, và sinh chữ ký ECDSA test.
   * Cho phép kiểm thử tự động (Unit Test / Integration Test) 1.000 lần liên tục mà không cần quét mã QR thật.
2. **Chế độ Kết nối Thực tế (Live VGCA Gateway Mode):**
   * Kết nối trực tiếp vào hạ tầng `ca.gov.vn`.
   * Sử dụng tài khoản công vụ thật của giáo viên để quét mã QR và ký thử nghiệm 1 văn bản mẫu.

---

### PHẦN IV: DANH MỤC CÁC GIAI ĐOẠN TRIỂN KHAI (WORK BREAKDOWN STRUCTURE)

| Giai đoạn | Nội dung công việc | Đầu ra (Deliverables) | Tiêu chí nghiệm thu (Codex Approved) |
| :--- | :--- | :--- | :--- |
| **Phase 1** | **Khởi tạo Khung Dự án & Mock Simulator**<br>- Khởi tạo thư mục `vgca-web-signer`<br>- Viết `vgca-mock-server.js` giả lập API Ban Cơ yếu<br>- Tạo kịch bản kiểm thử tự động | Thư mục `vgca-web-signer`<br>Bộ giả lập Mock Server | 100% test case giả lập chạy thông suốt (Pass 100%). |
| **Phase 2** | **Bộ Đóng Gói PDF & Dấu Thời Gian TSA**<br>- Tích hợp module băm ByteRange SHA-256<br>- Tích hợp client gọi `http://ca.gov.vn/tsa`<br>- Đóng gói chữ ký PAdES Baseline-T | `pdf-pades-signer.js`<br>`tsa-client.js` | Tệp PDF xuất ra có đầy đủ trường chữ ký và dấu TSA RFC 3161. |
| **Phase 3** | **Giao diện Web Độc lập & API Gateway**<br>- Xây dựng trang `index.html` giao diện hiện đại<br>- Hiển thị QR Code, đồng hồ đếm ngược, avatar giáo viên<br>- Giao diện xem trước PDF và chọn vị trí con dấu | Trang web ký số độc lập<br>`public/index.html` | Giáo viên quét QR trên điện thoại $\rightarrow$ Web nhận diện < 1 giây. |
| **Phase 4** | **Thử Nghiệm Thực Tế & Đóng Gói Triển Khai**<br>- Thử nghiệm ký tệp PDF thật với tài khoản giáo viên<br>- Kiểm tra file trên Adobe Acrobat Reader<br>- Thẩm định toàn diện bằng Codex trước khi tích hợp | Báo cáo nghiệm thu thực tế<br>Container sẵn sàng chạy Render | Mở bằng Acrobat Reader báo "Signature is VALID", thời gian TSA khớp chuẩn. |

---

### PHẦN V: QUY TẮC AN TOÀN & BẢO MẬT BẮT BUỘC (SECURITY INVARIANTS)

1. **Zero-Token on Storage:** Cấm tuyệt đối lưu `accessToken` và `refreshToken` vào `localStorage`, `sessionStorage` hay Database máy chủ. Token chỉ được giữ trong biến RAM và tự động xóa sau 5 phút hoặc khi ký xong.
2. **Fail-Closed Policy:** Nếu mất kết nối TSA hoặc phản hồi chữ ký không hợp lệ, hệ thống phải hủy bỏ giao dịch, không xuất bản tệp PDF bị lỗi.
3. **Audit Log:** Ghi nhận nhật ký ký số gồm: Mã văn bản, Thời điểm ký, Người ký, Mã UUID giao dịch từ Ban Cơ yếu (Tuyệt đối không log Token bí mật).
