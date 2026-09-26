[REJECTED]

Mã nguồn chưa đạt mức tuân thủ và an toàn công nghiệp cao nhất. Có một số điểm làm đúng hướng, nhưng vẫn tồn tại lỗi nghiêm trọng ở xác thực chữ ký, liên kết authorization, schema/protocol và quản lý bí mật trong RAM.

**1. ETSI TS 119 432 v2.0 và giao thức**

- `vgca-client.js: authorize()` gửi `profile: 'rssp-119.432-v2.0'`, nhưng mã nguồn không chứng minh đây là profile identifier hợp lệ của VGCA/RSSP triển khai thực tế. Cần đối chiếu với profile chính thức của nhà cung cấp; không được tự định nghĩa profile rồi tuyên bố tuân thủ ETSI.
- `vgca-mock-server.js: route()` trả lỗi bằng HTTP `400/401/403/404/409/410`, trong khi nhiều RSSP/VGCA gateway thực tế trả HTTP 200 và dùng trường `error`/`errorDescription` làm mã nghiệp vụ. Client hiện tại biến mọi HTTP ngoài 2xx thành exception, nên có thể không tương thích với gateway thật.
- `authorize()` chỉ kiểm tra:
  ```javascript
  documentDigests.hashes.length > 0
  ```
  nhưng chỉ lưu `hashes[0]`. Các hash còn lại bị bỏ qua. Nếu `numSignatures` không được gửi hoặc không bằng 1 theo cách mong muốn, request vẫn có thể được chấp nhận.
- `signHash()` cũng chỉ xử lý `hashes[0]`, không kiểm tra `hashAlgorithmOID`, `signAlgo`, số lượng chữ ký hoặc số lượng hash trả về.
- `listCredentials()` chấp nhận mọi phần tử trong `res.certs`, không kiểm tra đầy đủ `credentialID`, trạng thái chứng thư, thuật toán khóa, curve, key usage hoặc certificate chain.
- Mock trả `publicKeyPem`, không trả chứng thư X.509 hoặc certificate chain. Đây không phải là mô hình xác minh chứng thư số đầy đủ theo triển khai công nghiệp.
- Các trường `responseID` của `authorize()` và `signHash()` được trả về nhưng không được client kiểm tra tính hợp lệ hoặc tương quan giao dịch.

**2. Lỗi xác thực ECDSA/ASN.1 nghiêm trọng**

`vgca-client.js: _validateEcdsaDerSignature()` chưa phải bộ phân tích DER an toàn:

- Không kiểm tra INTEGER có dạng canonical DER hay không.
- Không loại bỏ INTEGER âm.
- Không kiểm tra r và s có độ dài phù hợp với P-256.
- Không kiểm tra r và s khác zero.
- Không kiểm tra giới hạn `r < n`, `s < n`.
- Không xử lý chính xác long-form length cho INTEGER.
- Có thể gặp lỗi runtime với long-form length bất thường do `readUIntBE()`.
- Không xác thực Base64 canonical trước khi dùng:
  ```javascript
  const sigBuffer = Buffer.from(signatureBase64, 'base64');
  ```
  `Buffer.from()` chấp nhận một số input Base64 không chuẩn hoặc bị cắt cụt.

Cần thay parser thủ công bằng parser ASN.1 DER được kiểm chứng, hoặc tối thiểu bổ sung kiểm tra canonical DER và kiểm tra chữ ký ECDSA bằng public key đã tin cậy. Đồng thời cần xác định rõ chữ ký là:

- chữ ký trên digest đã tính sẵn; hoặc
- chữ ký trên message để OpenSSL tiếp tục hash.

Hiện tại server dùng:

```javascript
crypto.sign(null, hashBuf, this.privateKeyPem);
```

và client dùng:

```javascript
crypto.verify(null, hashBuffer, publicKeyPem, sigBuffer);
```

Hai phía mock có thể khớp nhau, nhưng cần xác nhận chính xác semantics này với VGCA/RSSP thật. Không được suy ra tính tương thích ETSI chỉ vì mock tự ký và tự verify.

**3. Lỗ hổng trong authorization và binding giao dịch**

`vgca-mock-server.js: /authorize`:

```javascript
const { credentialID, documentDigests, signAlgo, numSignatures } = payload;
```

nhưng:

- Không xác minh `credentialID` có tồn tại trong danh sách chứng thư của user.
- Không xác minh credential thuộc về access token hiện tại.
- Không kiểm tra `signAlgo`.
- Không kiểm tra `hashAlgorithmOID`.
- Không kiểm tra `numSignatures` bắt buộc bằng đúng `1`; giá trị `undefined` vẫn được chấp nhận.
- Không kiểm tra kiểu dữ liệu hoặc độ dài thực tế của hash ở server.

`/signHash` cũng chỉ kiểm tra `credentialID`, token, và hash đầu tiên. Do đó authorization có thể được tạo cho credential giả hoặc thông tin thuật toán không hợp lệ.

Cần lưu và kiểm tra đầy đủ các thuộc tính đã authorize:

```javascript
{
  token,
  credentialID,
  hashAlgorithmOID,
  signAlgo,
  hashes,
  numSignatures,
  expiresAt,
  consumed: false
}
```

Khi ký phải so sánh toàn bộ payload với authorization record, không chỉ so sánh hash đầu tiên.

**4. Public key verification có thể bị vô hiệu hóa**

Trong `vgca-client.js: signHash()`:

```javascript
const pubKey = options.publicKeyPem || this.credentialsCache.get(credentialID);
```

Cho phép caller truyền tùy ý `publicKeyPem`. Điều này làm mất ý nghĩa của việc xác minh chữ ký với public key lấy từ credential đã được gateway xác thực. Một caller có thể truyền public key của chính mình; chữ ký sẽ được verify thành công với khóa không liên quan đến credential VGCA.

Cần:

- Không cho phép override public key trong production; hoặc
- Chỉ cho phép override trong test mode rõ ràng; hoặc
- Xác minh public key truyền vào trùng với public key/certificate đã lấy từ credential tin cậy.

Đề xuất:

```javascript
const pubKey = this.credentialsCache.get(credentialID);
if (!pubKey && process.env.NODE_ENV === 'production') {
  throw new Error('[SECURITY ERROR]: Không có public key tin cậy cho credential.');
}
```

**5. Fail-closed, timeout và ngoại lệ**

Các điểm tích cực:

- Client giới hạn kích thước response.
- Có timeout request.
- Server có `headersTimeout`, `requestTimeout`, `timeout`.
- Production bắt buộc HTTPS.
- Authorization ID bị xóa trước khi trả kết quả ký, giúp giảm replay trong tiến trình đơn luồng.

Các thiếu sót:

- `requestLoginQr()` không kiểm tra kiểu và kích thước của `qrCode`, `qrCodeUUID`, `responseID`.
- `pollLoginStatus()` trả trạng thái `FAILED` cho mọi lỗi nghiệp vụ nhưng `_post()` lại throw trước nếu gateway trả HTTP 4xx/5xx. Hai cơ chế xử lý lỗi không nhất quán.
- Không có retry policy có kiểm soát cho lỗi mạng tạm thời; nếu bổ sung retry phải bảo đảm không retry `signHash()` sau khi không rõ server đã ký hay chưa.
- Không kiểm soát `Content-Length` ở server trước khi nhận body; vẫn phải đọc đến khi vượt giới hạn rồi mới hủy.
- `req.destroy()` trong nhánh payload quá lớn có thể đóng kết nối trước khi client nhận đầy đủ response 413.
- `stop()` không đóng hoặc xóa toàn bộ dữ liệu nhạy cảm trong các Map.
- Không có cơ chế chống request đồng thời trên cùng `authorizeID` ngoài giả định event loop. Nếu thay đổi kiến trúc sang worker/cluster, bảo vệ replay hiện tại không còn đủ.

**6. Token và dữ liệu nhạy cảm trong RAM**

Mã nguồn không ghi token ra disk trực tiếp, không ghi token vào log, và dùng Map trong RAM. Đây là điểm đạt một phần yêu cầu zero-disk leakage.

Tuy nhiên chưa đạt yêu cầu bảo vệ bí mật ở mức cao nhất:

- Access token được lưu plaintext trong `this.tokens`.
- Token được lưu thêm trong authorization record.
- Private key ECDSA được giữ plaintext trong `this.privateKeyPem`.
- `ownerInfo` chứa họ tên, email, số điện thoại được giữ trong session và token metadata.
- `stop()` chỉ dừng cleanup interval, không xóa `sessions`, `authorizations`, `tokens`, `privateKeyPem` hoặc `publicKeyPem`.
- JavaScript string không thể zeroize đáng tin cậy do immutable string và garbage collector.
- Refresh token được trả cho client nhưng không được quản lý/revoke; mock không triển khai refresh endpoint.
- Không có giới hạn số session/token tối đa, nên có khả năng bị tiêu thụ RAM bằng cách tạo nhiều QR/login request.

Cần bổ sung khi shutdown:

```javascript
this.sessions.clear();
this.authorizations.clear();
this.tokens.clear();
this.privateKeyPem = null;
this.publicKeyPem = null;
```

Trong hệ thống thật, token nên nằm trong secret manager hoặc session store bảo mật; private key không nên nằm dưới dạng PEM plaintext trong JavaScript process nếu có thể dùng HSM/remote signing service.

**7. Các vấn đề riêng của mock server**

- `allowedOrigins` hard-code nhiều origin localhost; phù hợp demo nhưng không phải chính sách production.
- Thiếu `Vary: Origin`.
- Không giới hạn số session theo IP/client.
- Không có rate limiting cho login, polling, authorize hoặc sign.
- Không có audit log an toàn, correlation ID hoặc request ID đáng tin cậy.
- `responseID` dựa một phần vào `Date.now()`, có thể trùng khi xử lý đồng thời.
- `credentialID`, certificate metadata và owner information là dữ liệu cố định, không mô phỏng đúng quan hệ user-token-credential.
- Không có refresh-token lifecycle dù trả `refreshToken` và `refreshExpiresIn`.

**Các dòng cần sửa bắt buộc**

- `vgca-client.js: _validateEcdsaDerSignature()` — thay parser DER thủ công hoặc hoàn thiện validation canonical DER/r/s.
- `vgca-client.js: signHash()` — loại bỏ `options.publicKeyPem` trong production; bắt buộc dùng public key đã xác thực.
- `vgca-client.js: signHash()` và `authorize()` — kiểm tra Base64 signature, schema đầy đủ, thuật toán, số hash và correlation ID.
- `vgca-mock-server.js: /authorize` — xác thực credential thuộc token, kiểm tra `hashAlgorithmOID`, `signAlgo`, `numSignatures`, toàn bộ hashes.
- `vgca-mock-server.js: /signHash` — so sánh toàn bộ authorization context và bảo vệ atomic one-time use.
- `vgca-mock-server.js: stop()` — xóa toàn bộ token, authorization, session và khóa khỏi các cấu trúc đang giữ.
- `vgca-client.js: _post()` và toàn bộ endpoint — thống nhất quy ước HTTP status với VGCA gateway thật; không tự mặc định rằng lỗi HTTP luôn là lỗi giao thức.
- Cả hai tệp — bổ sung rate limiting, giới hạn session/token và chính sách xử lý dữ liệu nhạy cảm.

**Kết luận**

Mã hiện tại phù hợp làm mock/demo nội bộ có kiểm tra chữ ký cơ bản, nhưng chưa đạt tuân thủ ETSI/VGCA có thể chứng minh và chưa đạt mức “industrial hardened”. Các lỗi nghiêm trọng nhất là public key có thể bị override, authorization không ràng buộc đầy đủ với credential/thuật toán, parser DER chưa an toàn, xử lý HTTP error chưa chắc tương thích VGCA, và dữ liệu nhạy cảm không được dọn sạch khi shutdown.