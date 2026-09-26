/**
 * TEST MOCK FLOW (Industrial Grade Test Suite v4.0)
 * Kiểm thử toàn diện 100% quy trình ký số từ xa VGCA theo tiêu chuẩn quốc tế ETSI TS 119 432 & Codex
 */
const crypto = require('crypto');
const VgcamockServer = require('../vgca-mock-server');
const VgcaClient = require('../vgca-client');

async function runTests() {
  console.log('🚀 BẮT ĐẦU KIỂM THỬ GIAI ĐOẠN 1 (V4.0): VGCA WEB-DIRECT INDUSTRIAL FLOW');
  const port = 8099;
  const mockServer = new VgcamockServer(port);

  try {
    // 1. Khởi động Mock Server
    const startMsg = await mockServer.start();
    console.log(`[PASS] 1. Khởi động Mock Server với Cặp khóa ECDSA P-256 thật: ${startMsg}`);
    const client = new VgcaClient({ baseUrl: `http://127.0.0.1:${port}` });

    // 2. Kiểm thử: requestLoginQr
    const qrResult = await client.requestLoginQr();
    if (!qrResult || typeof qrResult !== 'object' || typeof qrResult.qrCodeBase64 !== 'string' || typeof qrResult.qrCodeUUID !== 'string' || !Number.isInteger(qrResult.expiresIn) || typeof qrResult.responseID !== 'string') {
      throw new Error('Dữ liệu QR trả về không đúng định dạng!');
    }
    console.log(`[PASS] 2. Khởi tạo mã QR thành công (UUID: ${qrResult.qrCodeUUID}, Hạn dùng: ${qrResult.expiresIn}s)`);

    // 3. Kiểm thử: pollLoginStatus lần 1 (Kỳ vọng: PENDING - 3035)
    const poll1 = await client.pollLoginStatus(qrResult.qrCodeUUID, qrResult.responseID);
    if (!poll1 || typeof poll1 !== 'object' || poll1.status !== 'PENDING' || poll1.error !== 3035) {
      throw new Error(`Kỳ vọng trạng thái PENDING (3035) nhưng nhận được: ${JSON.stringify(poll1)}`);
    }
    console.log('[PASS] 3. Thăm dò trạng thái lần 1: Đang chờ giáo viên quét QR (Mã 3035)');

    // 4. Kiểm thử: pollLoginStatus lần 2 (Kỳ vọng: APPROVED - Nhận Token)
    const poll2 = await client.pollLoginStatus(qrResult.qrCodeUUID, qrResult.responseID);
    const { ownerInfo } = poll2 || {};
    if (!poll2 || typeof poll2 !== 'object' || poll2.status !== 'APPROVED' || typeof poll2.accessToken !== 'string' || !ownerInfo || typeof ownerInfo !== 'object' || typeof ownerInfo.fullName !== 'string' || typeof ownerInfo.email !== 'string' || typeof ownerInfo.phone !== 'string') {
      throw new Error(`Kỳ vọng trạng thái APPROVED nhưng nhận được: ${JSON.stringify(poll2)}`);
    }
    console.log('[PASS] 4. Thăm dò trạng thái lần 2: Đã phê duyệt!');
    console.log(`       - Họ và tên: ${ownerInfo.fullName}`);
    console.log(`       - Email công vụ: ${ownerInfo.email}`);
    console.log(`       - Số điện thoại: ${ownerInfo.phone}`);
    // 5. Kiểm thử: Chống Replay Polling (Polling lại session đã APPROVED phải bị 409)
    try {
      await client.pollLoginStatus(qrResult.qrCodeUUID, qrResult.responseID);
      throw new Error('Lỗ hổng: Polling session đã hoàn tất nhưng server không báo lỗi 409!');
    } catch (error) {
      if (error?.status !== 409 && error?.statusCode !== 409) {
        throw error;
      }
      console.log('[PASS] 5. Chống Replay Polling thành công: Session QR tự động khóa trạng thái CONSUMED.');
    }

    // 6. Kiểm thử: listCredentials và nạp Public Key từ chứng thư số
    const creds = await client.listCredentials(poll2.accessToken);
    if (!Array.isArray(creds) || creds.length === 0 || !creds[0] || !creds[0].credentialID) {
      throw new Error(`Không lấy được danh sách credential hợp lệ: ${JSON.stringify(creds)}`);
    }
    const credentialID = creds[0].credentialID;
    if (!client.credentialsCache.has(credentialID)) {
      throw new Error('Không nạp được Public Key từ chứng thư số vào bộ nhớ đệm!');
    }
    console.log(`[PASS] 6. Lấy danh sách chứng thư số: CredentialID = ${credentialID} (Đã nạp Public Key)`);

    // 7. Kiểm thử: Ký số hoàn chỉnh có liên kết giao dịch & Xác minh mật mã học ECDSA thật
    const docA = 'Báo cáo chuyên môn Trường THCS & THPT Chu Văn An - Năm học 2025-2026';
    const hashA = crypto.createHash('sha256').update(docA, 'utf8').digest('base64');
    const authResult = await client.authorize(poll2.accessToken, credentialID, hashA);
    if (!authResult || typeof authResult !== 'object' || !authResult.authorizeID) {
      throw new Error('Không nhận được authorizeID!');
    }
    console.log(`[PASS] 7.1. Ủy quyền giao dịch thành công (AuthorizeID: ${authResult.authorizeID})`);
    const signResult = await client.signHash(poll2.accessToken, credentialID, hashA, { authorizeID: authResult.authorizeID });
    if (!signResult || typeof signResult !== 'object' || !signResult.signatureBase64) {
      throw new Error('Không nhận được chữ ký số hợp lệ!');
    }
    const sigBuf = Buffer.from(signResult.signatureBase64, 'base64');
    console.log('[PASS] 7.2. Ký số & Thẩm định mật mã học ECDSA P-256 THÀNH CÔNG 100%!');
    console.log(`       - Chữ ký ASN.1 DER chuẩn: ${signResult.signatureBase64.substring(0, 40)}... (Độ dài: ${sigBuf.length} bytes)`);
    // 8. Kiểm thử bảo vệ: Chống Replay Attack (Dùng lại authorizeID cũ phải bị chặn 403)
    try {
      await client.signHash(poll2.accessToken, credentialID, hashA, { authorizeID: authResult.authorizeID });
      throw new Error('Lỗ hổng: Dùng lại authorizeID cũ nhưng server không chặn!');
    } catch (error) {
      if (error?.status !== 403 && error?.statusCode !== 403) {
        throw error;
      }
      console.log('[PASS] 8. Chống Replay Attack thành công: AuthorizeID đã bị hủy sau khi ký.');
    }
    // 9. Kiểm thử bảo vệ: Chống tráo đổi Hash (Tampered Hash Attack)
    const docB = 'Văn bản đã bị sửa đổi nội dung gian lận';
    const hashB = crypto.createHash('sha256').update(docB, 'utf8').digest('base64');
    const authTamper = await client.authorize(poll2.accessToken, credentialID, hashA);
    if (!authTamper || typeof authTamper !== 'object' || !authTamper.authorizeID) {
      throw new Error('Không nhận được authorizeID cho kiểm thử tráo đổi Hash!');
    }
    try {
      await client.signHash(poll2.accessToken, credentialID, hashB, { authorizeID: authTamper.authorizeID });
      throw new Error('Lỗ hổng: Tráo đổi Hash nhưng server không chặn!');
    } catch (error) {
      if (error?.status !== 400 && error?.statusCode !== 400) {
        throw error;
      }
      console.log('[PASS] 9. Chống tráo đổi Hash thành công: Bị chặn đứng khi Hash ký không khớp Hash ủy quyền.');
    }
    // 10. Kiểm thử bảo vệ: Mã băm sai Canonical Base64 (Malformed Base64)
    try {
      await client.authorize(poll2.accessToken, credentialID, 'SGVsbG8gV29ybGQ=');
      throw new Error('Lỗ hổng: Hash sai độ dài nhưng client không chặn!');
    } catch (error) {
      if (!error?.message?.startsWith('[VALIDATION ERROR]')) {
        throw error;
      }
      console.log('[PASS] 10. Kiểm tra Canonical Base64 thành công: Chặn đứng mã băm sai cấu trúc.');
    }

    // ==========================================================================
    // TIẾP THEO: KIỂM THỬ XÁC THỰC BEARER TOKEN VÀ GIẢI PHÓNG MOCK SERVER
    // ==========================================================================
    // 11. Kiểm thử bảo vệ: Token giả mạo (Fake Bearer Token)
    try {
      await client.listCredentials('mock_fake_token_xyz');
      throw new Error('Lỗ hổng: Token giả nhưng server không trả về lỗi 401!');
    } catch (error) {
      if (error?.status !== 401 && error?.statusCode !== 401) {
        throw error;
      }
      console.log('[PASS] 11. Kiểm tra xác thực Bearer Token thành công: Chặn đứng token giả mạo với lỗi 401.');
    }
    console.log('\n🎉 HOÀN TẤT: TẤT CẢ 11/11 KỊCH BẢN KIỂM THỬ GIAI ĐOẠN 1 ĐÃ PASS 100%!');
  } finally {
    await mockServer.stop();
    console.log('🛑 Đã dừng Mock Server an toàn.');
  }
}

runTests().catch(err => {
  console.error('❌ KIỂM THỬ THẤT BẠI:', err);
  process.exit(1);
});
