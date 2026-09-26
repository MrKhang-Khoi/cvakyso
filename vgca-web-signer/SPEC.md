# ĐẶC TẢ KỸ THUẬT & KIẾN TRÚC HỆ THỐNG KÝ SỐ VGCA WEB SIGNER

Hệ thống ký số trực tiếp trên nền tảng Web tuân thủ chuẩn Nghị định 30/2020/NĐ-CP, ETSI TS 119 432 v2.0, ETSI EN 319 142 (PAdES-B-T), RFC 3161 (TSA Ban Cơ yếu Chính phủ), RFC 5280 (X.509 PKI) và RFC 5753 (ECDSA P-256).

---

## [TIER 3] tsa-client.js
### Vai trò & Ranh giới Kiến trúc:
- Module kết nối và thẩm định Con Dấu Thời Gian Điện Tử (TSA RFC 3161) của Ban Cơ yếu Chính phủ (`http://ca.gov.vn/tsa`).
- **Phân tầng**: TIER 3 - MISSION-CRITICAL / CRYPTO & SECURITY ENGINE.
- **Tiện ích ASN.1 DER cơ sở**:
  - `parseTLV(buf, p)`: Phân tích cú pháp ASN.1 TLV chuẩn canonical DER, kiểm tra biên an toàn bộ nhớ (`Number.isSafeInteger(p)`, `p + 2 <= buf.length`), cấm indefinite-length, cấm long-form length cho độ dài < 128, cấm leading zero trong long-form length octets.
  - `encodeLength(len)`: Mã hóa độ dài DER canonical, giới hạn tối đa 4GB, cấm số âm, cấm số thực.
  - `encodeTLV(tag, val)`: Đóng gói ASN.1 TLV chuẩn canonical DER với tag nguyên `0..255` và giá trị `Buffer`.
  - `encodeSeq(items)`: Đóng gói ASN.1 SEQUENCE (tag `0x30`) từ mảng các Buffer thành phần.
  - `encodeSet(items)`: Đóng gói ASN.1 SET OF (tag `0x31`) chuẩn DER.
  - `encodeOctetString(buf)`: Đóng gói OCTET STRING (tag `0x04`).
  - `encodeOID(hex)`: Đóng gói OBJECT IDENTIFIER (tag `0x06`).
  - `encodeCanonicalInteger(buf)`: Mã hóa DER INTEGER canonical, tự động đệm `0x00` nếu bit cao nhất của byte đầu là 1 để đảm bảo số nguyên dương.
  - `encodeUTCTime(date)`: Mã hóa UTCTime ASN.1 (tag `0x17`) chuẩn `YYMMDDHHMMSSZ`.
- **Thẩm định đường dẫn chứng thư RFC 5280 (`validateX509CertificatePath`)**:
  - Xác thực chuỗi chứng thư từ Leaf TSA tới RootCA G2 của Ban Cơ yếu Chính phủ.
  - Ghim cứng chứng thư gốc (Cryptographic Certificate Pinning) với vân tay SHA-256 của RootCA G2.
  - Kiểm tra thẩm quyền KeyUsage (`digitalSignature` hoặc `nonRepudiation` cho Leaf, `keyCertSign` cho CA).
  - Kiểm tra Extended Key Usage (EKU) bắt buộc phải có OID `id-kp-timeStamping` (`1.3.6.1.5.5.7.3.8`).
  - Kiểm tra ràng buộc đường dẫn `pathLenConstraint` và cờ CA trong BasicConstraints.
- **Lớp `TsaClient`**:
  - `buildTimeStampReq(hashBuffer)`: Tạo yêu cầu RFC 3161 TimeStampReq với `messageImprint` SHA-256 (32 bytes) và nonce 64-bit nguyên dương ngẫu nhiên.
  - `requestTimestamp(hashBuffer)`: Gửi yêu cầu HTTP POST tới máy chủ TSA, nhận và phân tích phản hồi `TimeStampResp`.
  - `parseTimeStampResp(respBuffer, expectedNonce, expectedHash, validationDate)`: Xác thực nghiêm ngặt mã trạng thái (status = 0/1), đối soát nonce, đối soát messageImprint (PAdES-B-T invariant), thẩm định GeneralizedTime không lệch tương lai, kiểm tra tính toàn vẹn chữ ký RSA của TSA trên khối `signedAttrs`.
- **Ranh giới YAGNI**: Module hoạt động như client ngoại vi gửi và xác thực timestamp token; không phải là máy chủ cấp chứng thư CA và không yêu cầu phần cứng HSM quân sự cục bộ.

---

## [TIER 3] pdf-pades-signer.js
### Vai trò & Ranh giới Kiến trúc:
- Bộ tạo khung chữ ký AcroForm ISO 32000-1 và đóng gói CMS SignedData PAdES-B-T.
- **Phân tầng**: TIER 3 - MISSION-CRITICAL / CRYPTO & SECURITY ENGINE.
- Đã được Codex Universal Audit thẩm định và phê duyệt 100% (40/40 lát cắt).

---

## [TIER 3] vgca-client.js
### Vai trò & Ranh giới Kiến trúc:
- Module kết nối VGCA Remote Signing Gateway chuẩn ETSI TS 119 432 v2.0.
- **Phân tầng**: TIER 3 - MISSION-CRITICAL / CRYPTO & SECURITY ENGINE.
- Đã được Codex Universal Audit thẩm định và phê duyệt 100% (6/6 lát cắt).

---

## [TIER 3] vgca-mock-server.js
### Vai trò & Ranh giới Kiến trúc:
- Máy chủ giả lập kiểm thử giao thức VGCA Web-Direct với cặp khóa ECDSA P-256 thật.
- **Phân tầng**: TIER 3 - MISSION-CRITICAL / CRYPTO & SECURITY ENGINE.
- Đã được Codex Universal Audit thẩm định và phê duyệt 100% (8/8 lát cắt).

---

## [TIER 3] p256-crypto.js
### Vai trò & Ranh giới Kiến trúc:
- Module mật mã học ECDSA P-256 với cơ chế Low-S Anti-Malleability theo RFC 5753.
- **Phân tầng**: TIER 3 - MISSION-CRITICAL / CRYPTO & SECURITY ENGINE.
- Đã được Codex Universal Audit thẩm định và phê duyệt 100% (1/1 lát cắt).

---

## [TIER 3] test/independent-pades-verifier.js
### Vai trò & Ranh giới Kiến trúc:
- Trình kiểm định độc lập 18 tầng mật mã học cho tài liệu PDF PAdES-B-T và TSA.
- **Phân tầng**: TIER 3 - MISSION-CRITICAL / CRYPTO & SECURITY ENGINE.
- Đã được Codex Universal Audit thẩm định và phê duyệt 100% (15/15 lát cắt).

---

## [TIER 2] test/test-mock-flow.js
### Vai trò & Ranh giới Kiến trúc:
- Kịch bản kiểm thử tích hợp 11 bước cho luồng VGCA Web-Direct.
- **Phân tầng**: TIER 2 - STANDARD WEB APPLICATION / FULLSTACK SERVICE.
- Đã được Codex Universal Audit thẩm định và phê duyệt 100% (3/3 lát cắt).

---

## [TIER 1] test/test-phase2-tsa-pdf.js
### Vai trò & Ranh giới Kiến trúc:
- Kịch bản kiểm thử tự động toàn diện cho PAdES-B-T & RFC 3161 TSA Ban Cơ yếu Chính phủ.
- **Phân tầng**: TIER 1 - STATELESS EDGE PROXY / LITE SCRIPT / CLI.
- **Vai trò**: Script kiểm thử Node.js thực thi 107 ca kiểm thử (Test Group 1 - 8 và 57 ca kiểm thử tiêu cực Negative Security Tests). Toàn bộ 107 bài test pass 100%.

---

## [TIER 1] test/verify-manifest-and-bundle.js
### Vai trò & Ranh giới Kiến trúc:
- Kịch bản tự động tính toán lại băm SHA-256 và đối soát chứng cứ mật mã học độc lập.
- **Phân tầng**: TIER 1 - STATELESS EDGE PROXY / LITE SCRIPT / CLI.
- **Vai trò**: CLI script chạy quy trình nghiệm thu artifacts và bundle, hoàn tất với Exit Code 0.
