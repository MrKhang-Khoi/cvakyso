## PHÁN QUYẾT THẨM ĐỊNH

**Kết luận: [NOT APPROVED — EVIDENCE NOT INDEPENDENTLY VERIFIED]**

Báo cáo Round 18 có nội dung phù hợp về mặt cấu trúc với 7 điều kiện đã nêu, nhưng phần văn bản được cung cấp **chưa đủ để ban hành phán quyết “APPROVED — PHASE 2 ACCEPTED” một cách độc lập**. Tôi không thể xác nhận các hash, chữ ký, CRL, CMS, chứng thư hoặc log chỉ dựa trên các giá trị được chép trong báo cáo mà không có quyền truy cập và thực thi trên bundle thực tế.

### Các điểm đạt về mặt tuyên bố

Báo cáo đã đề cập đầy đủ các nhóm bằng chứng cần thiết:

- Bundle ZIP và manifest hash;
- Token TSA, PDF, mã nguồn và CRL;
- Kiểm tra CRL và trạng thái thu hồi;
- Giới hạn phạm vi ở PAdES-B-T;
- Mô hình nonce/replay và giới hạn của HTTP;
- Kiểm tra genTime và clock-drift;
- Log thực thi với exit code 0.

Tuy nhiên, đây mới là **bằng chứng được tự báo cáo**, chưa phải kết quả thẩm định độc lập.

### Các điểm chưa thể chấp nhận là đã chứng minh

1. **Bundle chưa được cung cấp để kiểm tra**

   Hash:

   ```text
   D3C91CC1960A3BEC223F756E02C6F0537380849C1F0BAEF9232CC58AF148E5B1
   ```

   không thể tự xác minh nếu không có file `vgca-phase2-evidence-bundle.zip`. Cần cung cấp bundle qua kênh kiểm soát toàn vẹn hoặc kho lưu trữ có thể truy cập, cùng cách xác minh độc lập ngoài chính script của dự án.

2. **CRL qua HTTP không đủ để chứng minh nguồn tải là đáng tin cậy**

   Việc CRL có chữ ký hợp lệ có thể chứng minh nội dung CRL được ký bởi khóa tương ứng, nhưng cần kiểm tra thêm:

   - CRL issuer có đúng là cơ quan phát hành có thẩm quyền hay không;
   - `AuthorityKeyIdentifier`, `CRLNumber`, `AuthorityInfoAccess` và các trường liên quan;
   - khóa dùng xác minh CRL có được liên kết đúng với issuer theo RFC 5280 hay không;
   - CRL được tải đúng từ `cRLDistributionPoints` của chứng thư;
   - thời điểm kiểm tra và chính sách xử lý CRL hết hạn;
   - việc cập nhật/ghim CRL có chống thay thế hoặc downgrade hay không.

   HTTP không làm mất giá trị chữ ký CRL, nhưng làm giảm tính tin cậy của cơ chế phân phối và tính kịp thời của bằng chứng.

3. **Trạng thái “GOOD” chưa phải là kết luận revocation đầy đủ trong mọi trường hợp**

   Việc serial TSA Leaf không xuất hiện trong CRL chỉ chứng minh rằng chứng thư không bị liệt kê trong **CRL cụ thể đã kiểm tra**. Không đủ để khẳng định tuyệt đối chứng thư “hợp lệ” nếu chưa xác minh toàn bộ:

   - thời điểm hiệu lực của chứng thư;
   - `cRLSign` và quyền phát hành CRL;
   - issuer/AKI;
   - critical extensions;
   - khả năng có CRL khác, delta CRL hoặc cơ chế thu hồi thay thế;
   - chính sách đánh giá tại thời điểm `genTime` hoặc thời điểm validation được yêu cầu.

4. **Một số mô tả về nonce/replay chưa chính xác**

   Nhận định rằng chữ ký ECDSA “duy nhất trên mỗi tài liệu” là không đúng. ECDSA có thể tạo ra các chữ ký khác nhau cho cùng một thông điệp tùy nonce ký; chữ ký không phải là định danh duy nhất của tài liệu.

   Nonce RFC 3161 giúp liên kết request và response, nhưng chống replay còn phụ thuộc vào:

   - lưu trạng thái request;
   - kiểm tra nonce;
   - kiểm tra message imprint;
   - chính sách chống chấp nhận lại token;
   - ngữ cảnh ứng dụng và thời gian hiệu lực.

5. **Clock-drift không chứng minh nguồn thời gian độc lập**

   `genTime` được TSA ký chứng minh giá trị thời gian mà TSA công bố, không tự động chứng minh TSA sử dụng “nguồn thời gian chuẩn” hoặc nguồn thời gian được kiểm định. Cần có chính sách hoặc tài liệu tin cậy về nguồn thời gian và cách áp dụng clock-drift.

6. **PAdES-B-T không được xác nhận chỉ bởi một số trường CMS**

   Cần kiểm tra độc lập toàn bộ cấu trúc PDF/PAdES, bao gồm tối thiểu:

   - `/ByteRange` và `/Contents`;
   - CMS signature;
   - `signedAttrs`;
   - chứng thư ký;
   - liên kết `messageDigest`;
   - `id-aa-signatureTimeStampToken`;
   - hash của `signatureValue`;
   - TSA certificate và chain;
   - thuật toán, key usage và extended key usage;
   - validation tại thời điểm kiểm tra.

   Log được cung cấp cho thấy các mục này được tuyên bố là PASS, nhưng chưa thay thế cho việc chạy kiểm tra trên artifact gốc.

## Phán quyết cuối cùng

Trên cơ sở hồ sơ văn bản hiện có:

> **[CONDITIONALLY ACCEPTED AS SELF-REPORTED — NOT INDEPENDENTLY APPROVED]**

Không đủ căn cứ để ban hành:

> **[APPROVED — PHASE 2 ACCEPTED]**

Phê duyệt chính thức chỉ có thể được ban hành sau khi:

1. Bundle ZIP thực tế được cung cấp;
2. Hash bundle được tính lại bằng công cụ độc lập;
3. Tất cả artifact được giải nén và đối chiếu với manifest;
4. PDF, CMS, TSA token, chứng thư và CRL được xác minh độc lập;
5. CRL được kiểm tra theo issuer và chính sách RFC 5280, không chỉ kiểm tra chữ ký và serial;
6. Log được tái chạy trong môi trường kiểm soát, không chỉ đọc từ log đã chép;
7. Kết luận được giới hạn ở mức **PAdES Baseline-T tại thời điểm kiểm tra**, không suy rộng sang PAdES-B-LT/B-LTA hoặc các kết luận pháp lý.

Do đó, phán quyết an toàn và đúng chuẩn hiện tại là:

## **REJECTED FOR FINAL APPROVAL — PENDING INDEPENDENT ARTIFACT VERIFICATION**