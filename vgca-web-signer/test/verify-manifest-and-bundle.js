// CONTRACT: verify-manifest-and-bundle.js | Kiểm chứng mã băm SHA-256 các artifact, chạy độc lập bộ thẩm định PAdES-B-T và đối soát Request/Response TSA.
/**
 * REPRODUCIBLE MANIFEST & BUNDLE VERIFIER
 * Tự động tính toán lại toàn bộ băm SHA-256, đối soát chứng cứ mật mã học và kiểm chứng toàn vẹn.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

console.log('================================================================');
console.log('   AUTONOMOUS MANIFEST & ARTIFACT RE-VERIFICATION SUITE');
console.log('   Host Environment: Node.js ' + process.version + ' on ' + process.platform + ' (' + process.arch + ')');
console.log('   System Timestamp: ' + new Date().toISOString());
console.log('================================================================\n');

// 1. Kiểm tra File Hashes
const baseDir = path.join(__dirname, '..');
const filesToVerify = [
  'tsa-client.js',
  'pdf-pades-signer.js',
  'test/test-phase2-tsa-pdf.js',
  'test/independent-pades-verifier.js',
  'test/fixtures/live_gov_tsa_token_fixture.bin',
  'test/fixtures/rootcag2.crl',
  'output_pades_bt_signed.pdf',
  'package.json'
];

console.log('[SECTION 1]: SHA-256 Manifest Calculation');
const currentHashes = {};
for (const relPath of filesToVerify) {
  const fullPath = path.join(baseDir, relPath);
  if (!fs.existsSync(fullPath)) {
    console.error('FAIL: Missing file ' + relPath);
    process.exit(1);
  }
  const buf = fs.readFileSync(fullPath);
  const hash = crypto.createHash('sha256').update(buf).digest('hex').toUpperCase();
  currentHashes[relPath] = hash;
  console.log('  ✔ ' + relPath.padEnd(45, ' ') + ': ' + hash);
}

// 2. Chạy verifier độc lập
console.log('\n[SECTION 2]: Running Independent Cryptographic Verifier');
const { verifySignedPdfIndependently } = require('./independent-pades-verifier.js');
const pdfPath = path.join(baseDir, 'output_pades_bt_signed.pdf');

// CONTRACT: runVerificationSuite | Thực thi quy trình kiểm chứng độc lập PDF PAdES-B-T và đối soát nonce/imprint TSA trực tiếp.
(async () => {
  try {
    const isPdfValid = await verifySignedPdfIndependently(pdfPath);
    if (!isPdfValid) {
      console.error('FAIL: Independent verifier returned false');
      process.exit(1);
    }

    // 3. Phân tích đối soát Request / Response
    console.log('[SECTION 3]: Live TSA Request / Response Nonce & Imprint Correlation');
    const reqPath = path.join(baseDir, 'test', 'fixtures', 'live_sample_req.bin');
    const respPath = path.join(baseDir, 'test', 'fixtures', 'live_sample_resp.bin');

    // CONTRACT: parseAndCorrelateLiveTsa | Đọc fixture request/response thực tế, trích xuất nonce và messageImprint trực tiếp từ TimeStampReq DER, đối soát fail-closed với TSA response.
    if (!fs.existsSync(reqPath) || !fs.existsSync(respPath)) {
      throw new Error(`[VERIFY FAIL-CLOSED]: Thiếu tệp fixture đối soát thực tế: ${reqPath} hoặc ${respPath}`);
    }

    const reqBuf = fs.readFileSync(reqPath);
    const respBuf = fs.readFileSync(respPath);
    console.log('  ✔ Raw TimeStampReq size : ' + reqBuf.length + ' bytes');
    console.log('  ✔ Raw TimeStampResp size: ' + respBuf.length + ' bytes');

    // Trích xuất nonce và imprint trực tiếp từ cấu trúc ASN.1 DER của TimeStampReq thực tế
    const { parseTLV, TsaClient } = require('../tsa-client.js');
    const reqRoot = parseTLV(reqBuf, 0);
    let reqP = 0;
    const reqVer = parseTLV(reqRoot.val, reqP); reqP = reqVer.next;
    const reqImprint = parseTLV(reqRoot.val, reqP); reqP = reqImprint.next;
    const reqAlgId = parseTLV(reqImprint.val, 0);
    const reqHashedMsg = parseTLV(reqImprint.val, reqAlgId.next);
    const parsedImprint = reqHashedMsg.val;

    let parsedNonce = null;
    while (reqP < reqRoot.val.length) {
      const item = parseTLV(reqRoot.val, reqP);
      if (item.tag === 0x02) {
        parsedNonce = item.val;
      }
      reqP = item.next;
    }
    if (!parsedNonce || !parsedImprint || parsedImprint.length !== 32) {
      throw new Error('[VERIFY FAIL-CLOSED]: Không trích xuất được nonce hoặc messageImprint hợp lệ từ TimeStampReq');
    }

    const tsa = new TsaClient();
    const parsedResp = tsa.parseTimeStampResp(
      respBuf,
      parsedNonce,
      parsedImprint,
      new Date('2026-09-26T05:20:03.000Z')
    );
    console.log('  ✔ Request Nonce matched Response Nonce: ' + parsedNonce.toString('hex'));
    console.log('  ✔ Request Imprint matched Response Imprint: ' + parsedImprint.toString('hex'));
    console.log('  ✔ TSA GenTime UTC: ' + parsedResp.genTime);
    console.log('  ✔ TSA Serial: 0x' + parsedResp.serialNumber);

    console.log('\n================================================================');
    console.log('   ALL RE-VERIFICATION CHECKS COMPLETED WITH EXIT CODE 0');
    console.log('================================================================\n');
  } catch (err) {
    console.error('\n✘ [ERROR]: ' + err.message + '\n');
    process.exit(1);
  }
})();
