/**
 * TEST UI ENDPOINTS AUTOMATED VERIFIER
 * Đảm bảo 100% các API của giao diện kiểm thử hoạt động trơn tru trước khi bàn giao
 */
'use strict';

const http = require('http');

function request(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function testAll() {
  console.log('🧪 BẮT ĐẦU KIỂM THỬ TẤT CẢ ENDPOINTS CỦA TEST UI SERVER...');

  // 1. Kiểm tra /api/status
  const s = await request({ hostname: '127.0.0.1', port: 8088, path: '/api/status', method: 'GET' });
  console.log('1. /api/status -> Status:', s.status, s.data.status);
  if (s.status !== 200 || s.data.status !== 'ONLINE') throw new Error('Status endpoint failed');

  // 2. Kiểm tra /api/sample-pdf
  const p = await request({ hostname: '127.0.0.1', port: 8088, path: '/api/sample-pdf', method: 'GET' });
  console.log('2. /api/sample-pdf -> Status:', p.status, 'Size:', p.data.size, 'Filename:', p.data.filename);
  if (p.status !== 200 || !p.data.pdfBase64) throw new Error('Sample PDF failed');

  // 3. Khởi tạo Ký số Giáo viên /api/init-teacher-sign
  const init = await request({
    hostname: '127.0.0.1',
    port: 8088,
    path: '/api/init-teacher-sign',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    pdfBase64: p.data.pdfBase64,
    teacherName: 'Hà Văn Tý',
    department: 'Tổ Toán - Tin học',
    docTitle: 'Kế hoạch bài dạy Tuần 12 - Môn Toán 9'
  });
  console.log('3. /api/init-teacher-sign -> Status:', init.status, 'SessionId:', init.data.sessionId);
  if (init.status !== 200 || !init.data.sessionId) throw new Error('Init sign failed');

  // 4. Giáo viên bấm "Xác nhận & Chạm Vân tay" /api/confirm-phone-push
  const confirm = await request({
    hostname: '127.0.0.1',
    port: 8088,
    path: '/api/confirm-phone-push',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    sessionId: init.data.sessionId,
    authDecision: 'APPROVE'
  });
  console.log('4. /api/confirm-phone-push -> Status:', confirm.status, 'Result:', confirm.data.status, 'SignedSize:', confirm.data.signedPdfSize);
  if (confirm.status !== 200 || confirm.data.status !== 'COMPLETED') throw new Error('Confirm sign failed');

  // 5. Ban Giám hiệu Ký duyệt & Đóng dấu tròn đỏ /api/bgh-seal
  const bgh = await request({
    hostname: '127.0.0.1',
    port: 8088,
    path: '/api/bgh-seal',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    sessionId: init.data.sessionId
  });
  console.log('5. /api/bgh-seal -> Status:', bgh.status, 'Seal message:', bgh.data.message);
  if (bgh.status !== 200 || !bgh.data.hasSchoolSeal) throw new Error('BGH seal failed');

  // 6. Thẩm định độc lập 18/18 tiêu chí /api/verify-independent
  const verify = await request({
    hostname: '127.0.0.1',
    port: 8088,
    path: '/api/verify-independent',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    sessionId: init.data.sessionId
  });
  console.log('6. /api/verify-independent -> Status:', verify.status, 'Passed:', verify.data.passedChecks + '/' + verify.data.totalChecks);
  if (verify.status !== 200 || verify.data.passedChecks !== 18) throw new Error('Verification failed');

  console.log('\n🎉 TẤT CẢ 6/6 ENDPOINTS CỦA TEST UI SERVER ĐÃ HOẠT ĐỘNG HOÀN HẢO 100%!');
}

if (require.main === module) {
  testAll().catch(e => {
    console.error('❌ Lỗi kiểm thử endpoints:', e);
    process.exit(1);
  });
}

module.exports = { testAll };

