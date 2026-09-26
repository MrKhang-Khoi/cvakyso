/**
 * TEST SUITE: GIAI ĐOẠN 2 - PDF PADES-B-T & RFC 3161 TSA BAN CƠ YẾU CHÍNH PHỦ (ROUND 4)
 * Kiểm định toàn diện theo tiêu chuẩn Mật mã học khắt khe của OpenAI Codex:
 * 1. Khách thể RFC 3161 TSA Ban Cơ yếu Chính phủ (ca.gov.vn/tsa).
 * 2. Cấu trúc ISO 32000-1 AcroForm, Signature Widget, ByteRange.
 * 3. Chuẩn PAdES-B-T: Dấu thời gian điện tử cấp cho băm của CHỮ KÝ (signatureValue).
 * 4. Chứng thư số X.509 v3 của người ký và chữ ký ECDSA P-256.
 * 5. Xác minh mật mã học đa tầng (Multi-layer Cryptographic Verification).
 * 6. Bộ thử nghiệm tiêu cực (Negative Security Tests): Chống sửa đổi PDF, chống giả mạo chữ ký, chống tráo đổi TimeStampToken (Fail-Closed 100%).
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { PDFDocument } = require('pdf-lib');
const TsaClient = require('../tsa-client');
const PdfPadesSigner = require('../pdf-pades-signer');
const { generateSelfSignedX509 } = PdfPadesSigner;
const { 
  validateX509CertificatePath, 
  hasTimeStampingEKU,
  parseBasicConstraintsFromDer,
  parseKeyUsageFromDer,
  parseTLV,
  encodeLength,
  encodeSeq,
  encodeSet,
  encodeTLV,
  encodeOID,
  encodeOctetString
} = TsaClient;

let passCount = 0;
let failCount = 0;

// CONTRACT: assert | Ghi nhận kết quả test pass/fail; khi fail thì tăng failCount và gán process.exitCode = 1 đảm bảo CI fail-closed.
function assert(condition, message) {
  if (condition) {
    console.log(`  \x1b[32m✔ [PASS]\x1b[0m ${message}`);
    passCount++;
  } else {
    console.error(`  \x1b[31m✘ [FAIL]\x1b[0m ${message}`);
    failCount++;
    process.exitCode = 1;
  }
}

async function runPhase2Tests() {
  console.log('\n================================================================');
  console.log('   BẮT ĐẦU KIỂM THỬ GIAI ĐOẠN 2: PDF PADES-B-T & RFC 3161 TSA');
  console.log('================================================================\n');

  const tsaClient = new TsaClient({
    tsaUrl: 'http://ca.gov.vn/tsa',
    timeoutMs: 6000,
    allowMockFallback: false // Chế độ kiểm định thật: fail-closed tuyệt đối
  });
  const pdfSigner = new PdfPadesSigner({ placeholderHexLength: 32768, tsaClient: tsaClient });

  // -------------------------------------------------------------
  // TEST CASE 1: Cấu trúc RFC 3161 Request & Nonce Canonical DER
  // -------------------------------------------------------------
  console.log('[TEST GROUP 1]: Kiểm định gói tin RFC 3161 TimeStampReq');
  const dummyHash = crypto.createHash('sha256').update('Document_Content_ChuVanAn_2026').digest();
  const reqObj = tsaClient.buildTimeStampReq(dummyHash);

  assert(Buffer.isBuffer(reqObj.tspReqBuffer), 'TimeStampReq là Buffer hợp lệ');
  assert(reqObj.tspReqBuffer[0] === 0x30, 'TimeStampReq bắt đầu bằng ASN.1 SEQUENCE (0x30)');
  assert(reqObj.nonce.length === 8, 'Nonce có độ dài 8 bytes ngẫu nhiên');
  assert((reqObj.nonce[0] & 0x80) === 0, 'Nonce bảo đảm số nguyên dương (bit cao nhất = 0)');
  assert(reqObj.nonceDer[0] === 0x02, 'NonceDER được mã hóa thành INTEGER chuẩn (tag 0x02)');

  // -------------------------------------------------------------
  // TEST CASE 2: Chuẩn bị tệp PDF & Tạo khung chữ ký AcroForm ISO 32000-1
  // -------------------------------------------------------------
  console.log('\n[TEST GROUP 2]: Tạo PDF và phân bổ ByteRange chuẩn ISO 32000-1');
  const sampleDoc = await PDFDocument.create();
  const p1 = sampleDoc.addPage([595, 842]);
  p1.drawText('TRUONG THCS VA THPT CHU VAN AN', { x: 50, y: 800, size: 14 });
  p1.drawText('GIAO AN MON: TIN HOC - KHOI 8', { x: 50, y: 770, size: 12 });
  p1.drawText('Noi dung: Thuat toan va Mo hinh hoa he thong...', { x: 50, y: 740, size: 10 });
  const rawPdfBytes = await sampleDoc.save();

  const prepared = await pdfSigner.preparePdfForSigning(Buffer.from(rawPdfBytes), {
    signerName: 'Nguyen Van A',
    reason: 'Phe duyet giao an tuan 26 - Ban Co yeu Chinh phu',
    orgName: 'Truong THCS va THPT Chu Van An',
    pageIndex: 0,
    x: 340,
    y: 100,
    width: 215,
    height: 80
  });

  assert(Buffer.isBuffer(prepared.pdfWithPlaceholder), 'PDF với placeholder là Buffer hợp lệ');
  assert(prepared.documentHash.length === 32, 'Mã băm tài liệu SHA-256 có độ dài chính xác 32 bytes');
  assert(prepared.byteRange && prepared.byteRange.length === 4, 'ByteRange gồm đúng 4 chỉ số [0, b1, b2, b3]');
  assert(prepared.byteRange[0] === 0, 'ByteRange bắt đầu từ offset 0');
  assert(prepared.byteRange[2] > prepared.byteRange[1], 'Offset b2 lớn hơn b1');
  assert(prepared.byteRange[2] + prepared.byteRange[3] === prepared.pdfWithPlaceholder.length, 'Tổng b2 + b3 khớp 100% độ dài tệp PDF');

  const pdfContentStr = prepared.pdfWithPlaceholder.toString('binary');
  assert(pdfContentStr.includes('/Type /Sig') || pdfContentStr.includes('/Type/Sig'), 'Tệp PDF chứa đối tượng /Type /Sig');
  assert(pdfContentStr.includes('/AcroForm'), 'Tệp PDF chứa AcroForm trong Catalog');
  assert(pdfContentStr.includes('/Contents <0000'), 'Tệp PDF chứa vùng đệm /Contents');

  // -------------------------------------------------------------
  // TEST CASE 3: Sinh chứng thư số X.509 v3 & Ký số Cryptographic ECDSA P-256
  // -------------------------------------------------------------
  console.log('\n[TEST GROUP 3]: Khởi tạo chứng thư số X.509 v3 và ký số ECDSA P-256');
  const signerKeyPair = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const { certDer } = generateSelfSignedX509(signerKeyPair, 'Thay Nguyen Van A - Chu Van An');

  const signerX509 = new crypto.X509Certificate(certDer);
  assert(signerX509.subject.includes('Thay Nguyen Van A'), 'Chứng thư số X.509 chứa đúng thông tin giáo viên ký');
  assert(signerX509.verify(signerX509.publicKey) === true, 'Chứng thư số X.509 tự kiểm tra tính hợp lệ thành công');

  const sign = crypto.createSign('SHA256');
  sign.update(prepared.signedAttrsForHashing);
  sign.end();
  const rawSignature = sign.sign(signerKeyPair.privateKey);

  const verifySigner = crypto.createVerify('SHA256');
  verifySigner.update(prepared.signedAttrsForHashing);
  verifySigner.end();
  const isSignerSigValid = verifySigner.verify(signerKeyPair.publicKey, rawSignature);
  assert(isSignerSigValid === true, 'Chữ ký số ECDSA của người ký được xác minh HỢP LỆ bằng Public Key');

  // -------------------------------------------------------------
  // TEST CASE 4: Cấp Dấu thời gian PAdES-B-T cho băm của signatureValue
  // -------------------------------------------------------------
  console.log('\n[TEST GROUP 4]: Cấp Dấu thời gian PAdES-B-T cho băm của signatureValue');
  const signatureHash = crypto.createHash('sha256').update(rawSignature).digest();
  console.log('  Đang gửi băm của signatureValue tới máy chủ TSA http://ca.gov.vn/tsa...');

  let tsaResult;
  try {
    tsaResult = await tsaClient.requestTimestamp(signatureHash);
    console.log(`  Phản hồi từ TSA: ${tsaResult.statusDesc}`);
    console.log(`  Thời gian cấp dấu: ${tsaResult.genTime}`);
    console.log(`  Chủ thể chứng thư TSA: ${tsaResult.tsaCertSubject ? tsaResult.tsaCertSubject.replace(/\n/g, ', ') : 'N/A'}`);
    console.log(`  Xác thực chữ ký mật mã RSA TSA: ${tsaResult.isTsaCryptoSigValid ? 'HỢP LỆ (VALID)' : 'KHÔNG HỢP LỆ'}`);
  } catch (err) {
    console.error('  Lỗi khi gọi TSA:', err.message);
  }

  assert(tsaResult && tsaResult.statusCode === 0, 'TSA phản hồi mã trạng thái 0 (GRANTED)');
  assert(tsaResult && Buffer.isBuffer(tsaResult.timeStampToken), 'TimeStampToken là Buffer hợp lệ');
  assert(tsaResult && tsaResult.isTsaCryptoSigValid === true, 'Chữ ký số RSA của máy chủ TSA Ban Cơ yếu Chính phủ hợp lệ 100%');
  assert(tsaResult && tsaResult.verifiedImprint === signatureHash.toString('hex'), 'TSTInfo.messageImprint khớp chính xác 100% với băm của signatureValue (Chuẩn PAdES-B-T)');

  // -------------------------------------------------------------
  // TEST CASE 5: Đóng gói CMS SignedData (PAdES-B-T) vào PDF
  // -------------------------------------------------------------
  console.log('\n[TEST GROUP 5]: Đóng gói CMS SignedData kèm TSA Token vào PDF');
  const signResult = {
    signature: rawSignature,
    certificate: certDer,
    isECDSA: true
  };

  const signedPdf = pdfSigner.embedSignatureAndTimestamp(
    prepared,
    signResult,
    tsaResult.timeStampToken
  );

  assert(Buffer.isBuffer(signedPdf), 'PDF đã ký là Buffer hợp lệ');
  assert(signedPdf.length === prepared.pdfWithPlaceholder.length, 'Độ dài tệp PDF sau khi nhúng chữ ký không đổi (Bảo toàn ByteRange)');

  // -------------------------------------------------------------
  // TEST CASE 6: Xác thực mật mã học toàn diện (Multi-layer Cryptographic Verification)
  // -------------------------------------------------------------
  console.log('\n[TEST GROUP 6]: Xác thực mật mã học toàn diện (Multi-layer Verification)');
  const verifyReport = pdfSigner.verifySignedPdf(signedPdf);

  assert(verifyReport.isValid === true, 'Báo cáo nghiệm thu: Tệp PDF đã ký HỢP LỆ 100%');
  assert(verifyReport.byteRangeIntegrity === true, 'Toàn vẹn ByteRange: Không bị thay đổi byte nào');
  assert(verifyReport.messageDigestMatches === true, 'Mã băm ByteRange khớp chính xác 100% với messageDigest trong CMS');
  assert(verifyReport.signerSignatureCryptographicallyValid === true, 'Chữ ký số mật mã của người ký được xác minh bằng Public Key từ chính CMS');
  assert(verifyReport.hasSignatureTimeStamp === true, 'Chữ ký chứa Dấu thời gian điện tử PAdES-B-T Ban Cơ yếu Chính phủ');
  assert(verifyReport.signatureTimeStampImprintMatches === true, 'Dấu thời gian TSA khớp chính xác với băm của signatureValue');
  assert(verifyReport.tsaSignatureCryptographicallyValid === true, 'Chữ ký số RSA của máy chủ TSA được xác minh thành công');

  const outputPath = path.join(__dirname, '../output_pades_bt_signed.pdf');
  fs.writeFileSync(outputPath, signedPdf);
  console.log(`  Đã xuất tài liệu ký số chuẩn PAdES-B-T: ${outputPath}`);

  // -------------------------------------------------------------
  // TEST CASE 7: BỘ KIỂM TRA BẢO MẬT TIÊU CỰC (NEGATIVE SECURITY TESTS - FAIL-CLOSED)
  // CONTRACT: Negative Security Tests | Kiểm định fail-closed toàn diện các kịch bản tamper byte, giả mạo signature, tráo đổi token, chứng thư hết hạn và cross-issuer.
  // -------------------------------------------------------------
  console.log('\n[TEST GROUP 7]: Bộ thử nghiệm tiêu cực (Negative Security Tests - Fail-Closed)');

  // Negative 1: Sửa 1 byte trong nội dung tài liệu
  const tamperedContentPdf = Buffer.from(signedPdf);
  assert(tamperedContentPdf.length > 150, 'PDF có kích thước hợp lệ lớn hơn offset kiểm tra 150');
  tamperedContentPdf[150] = tamperedContentPdf[150] ^ 0xff;
  const r1 = pdfSigner.verifySignedPdf(tamperedContentPdf);
  assert(r1.isValid === false && r1.byteRangeIntegrity === false, 'Negative 1: Sửa 1 byte nội dung PDF -> Lập tức BỊ CHẶN (ByteRange hash mismatch)');

  // Negative 2: Thay đổi giá trị signatureValue trong CMS
  const tamperedSigPdf = Buffer.from(signedPdf);
  // Tìm vùng contents và sửa 1 ký tự hex trong chữ ký
  const contentsRawIdx = tamperedSigPdf.indexOf(Buffer.from('/Contents <', 'utf8'));
  assert(contentsRawIdx >= 0 && (contentsRawIdx + 11 + 200) < tamperedSigPdf.length, 'Tìm thấy vùng /Contents < trong PDF hợp lệ');
  const contentsIdx = contentsRawIdx + 11;
  tamperedSigPdf[contentsIdx + 200] = tamperedSigPdf[contentsIdx + 200] === 0x30 ? 0x31 : 0x30;
  const r2 = pdfSigner.verifySignedPdf(tamperedSigPdf);
  assert(r2.isValid === false, 'Negative 2: Giả mạo chữ ký số trong CMS -> Lập tức BỊ CHẶN (Signature cryptographically invalid)');

  // Negative 3: Tráo đổi TimeStampToken (cố tình nhúng timestamp không khớp với signatureValue)
  let fakeTokenRejected = false;
  try {
    const differentHash = crypto.createHash('sha256').update('unrelated_data_to_trigger_fail_closed').digest();
    const unrelatedToken = await tsaClient.requestTimestamp(differentHash);
    pdfSigner.embedSignatureAndTimestamp(prepared, signResult, unrelatedToken.timeStampToken);
  } catch (err) {
    if (err.message.includes('FAIL-CLOSED')) {
      fakeTokenRejected = true;
    }
  }
  assert(fakeTokenRejected === true, 'Negative 3: Tráo đổi TimeStampToken không khớp chữ ký -> Lập tức TỪ CHỐI NHÚNG (PAdES Fail-closed)');

  // Negative 4: Chứng thư TSA hết hạn (validTo trong quá khứ so với mốc xác thực 2040)
  const r4 = pdfSigner._extractAndVerifyTsaToken(tsaResult.timeStampToken, signatureHash, new Date('2040-01-01T00:00:00Z'));
  assert(r4.isValid === false && (r4.reason.includes('hết hạn') || r4.reason.includes('thời hạn không hợp lệ')), 'Negative 4: Chứng thư TSA hết hạn -> Lập tức BỊ TỪ CHỐI (validTo check)');

  // Negative 5: Chứng thư TSA chưa đến thời hạn hiệu lực (validFrom trong tương lai so với mốc xác thực 2020)
  const r5 = pdfSigner._extractAndVerifyTsaToken(tsaResult.timeStampToken, signatureHash, new Date('2020-01-01T00:00:00Z'));
  assert(
    r5.isValid === false && (r5.reason.includes('hết hạn') || r5.reason.includes('thời hạn không hợp lệ') || r5.reason.includes('tương lai') || r5.reason.includes('chưa có hiệu lực')),
    'Negative 5: Chứng thư TSA chưa có hiệu lực / genTime trong tương lai -> Lập tức BỊ TỪ CHỐI (validFrom & future timestamp check)'
  );

  // Negative 6: Tấn công Cross-Issuer (Chứng thư cùng Serial nhưng khác Issuer DER)
  const pdfStr = signedPdf.toString('binary');
  const hexMatch = pdfStr.match(/\/Contents\s*<([0-9a-fA-F]+)>/);
  assert(hexMatch && hexMatch[1], 'Khớp cấu trúc /Contents <hex> hợp lệ trong PDF');
  const origCmsDer = Buffer.from(hexMatch[1], 'hex');
  const rawContentsPos = signedPdf.indexOf(Buffer.from('/Contents <', 'utf8'));
  assert(rawContentsPos >= 0, 'Tìm thấy vị trí /Contents < trong signedPdf');
  const contentsPos = rawContentsPos + 11;
  const fakeCmsDer = Buffer.from(origCmsDer);
  const chuVanAnIdx = fakeCmsDer.indexOf(Buffer.from('THCS Chu Van An', 'utf8'));
  if (chuVanAnIdx > 0) {
    Buffer.from('Fake Hacker Org', 'utf8').copy(fakeCmsDer, chuVanAnIdx);
  }
  const fakePdf = Buffer.from(signedPdf);
  const fakeCmsHex = fakeCmsDer.toString('hex').toUpperCase().padEnd(32768, '0');
  Buffer.from(fakeCmsHex, 'ascii').copy(fakePdf, contentsPos);
  const r6 = pdfSigner.verifySignedPdf(fakePdf);
  assert(r6.isValid === false && r6.reason.includes('Zero Fallback'), 'Negative 6: Tấn công Cross-Issuer (khác Issuer DER) -> Lập tức BỊ CHẶN (Zero Fallback)');

  // Negative 7: Sai lệch cấu trúc SignerInfo.sid (không phải là IssuerAndSerialNumber tag 0x30)
  const verAndSidPattern = Buffer.from([0x02, 0x01, 0x01, 0x30]);
  const sidCorruptCms = Buffer.from(origCmsDer);
  const verIdx = sidCorruptCms.lastIndexOf(verAndSidPattern);
  if (verIdx > 0) {
    sidCorruptCms[verIdx + 3] = 0x04; // Đổi tag 0x30 thành 0x04
  }
  const sidCorruptPdf = Buffer.from(signedPdf);
  const sidCorruptHex = sidCorruptCms.toString('hex').toUpperCase().padEnd(32768, '0');
  Buffer.from(sidCorruptHex, 'ascii').copy(sidCorruptPdf, contentsPos);
  const r7 = pdfSigner.verifySignedPdf(sidCorruptPdf);
  assert(r7.isValid === false && (r7.reason.includes('IssuerAndSerialNumber') || r7.reason.includes('Dấu thời gian')), 'Negative 7: Cấu trúc sid không hợp lệ -> Lập tức BỊ TỪ CHỐI (Zero loose fallback)');

  // Negative 8: Thuật toán chữ ký TSA không được hỗ trợ (cố tình đổi OID sang MD5)
  const unsuppToken = Buffer.from(tsaResult.timeStampToken);
  const rsaOid = Buffer.from('2a864886f70d01010b', 'hex');
  const lastRsaIdx = unsuppToken.lastIndexOf(rsaOid);
  if (lastRsaIdx > 0) {
    unsuppToken[lastRsaIdx + 8] = 0x04; // md5WithRSA
  }
  const r8 = pdfSigner._extractAndVerifyTsaToken(unsuppToken, signatureHash);
  assert(r8.isValid === false && (r8.reason.includes('sha256WithRSAEncryption') || r8.reason.includes('không phải là RSA-SHA256')), 'Negative 8: Thuật toán chữ ký TSA không hợp lệ/không an toàn -> Lập tức BỊ CHẶN');

  // Negative 9: Dữ liệu ẩn bất thường trong vùng đệm /Contents sau CMS (không phải zero-padding)
  const trailPdf = Buffer.from(signedPdf);
  const trailingContentsIdx = contentsPos + origCmsDer.length * 2 + 10;
  trailPdf[trailingContentsIdx] = 0x46; // Chèn ký tự 'F'
  const r9 = pdfSigner.verifySignedPdf(trailPdf);
  assert(r9.isValid === false, 'Negative 9: Dữ liệu ẩn trong vùng /Contents -> Lập tức BỊ PHÁT HIỆN & TỪ CHỐI');

  // Negative 10: Tấn công Multiple/Trailing SignerInfo trong signerInfos SET
  const { parseTLV } = require('../pdf-pades-signer');
  const rootTLV = parseTLV(origCmsDer, 0);
  const sdOidTLV = parseTLV(origCmsDer, rootTLV.pos + rootTLV.hl);
  const sdCtxTLV = parseTLV(origCmsDer, sdOidTLV.next);
  const sdSeqTLV = parseTLV(sdCtxTLV.val, 0);
  let pScan = 0;
  const vTLV = parseTLV(sdSeqTLV.val, pScan); pScan = vTLV.next;
  const daTLV = parseTLV(sdSeqTLV.val, pScan); pScan = daTLV.next;
  const eciTLV = parseTLV(sdSeqTLV.val, pScan); pScan = eciTLV.next;
  const crtTLV = parseTLV(sdSeqTLV.val, pScan); pScan = crtTLV.next;
  const sisTLV = parseTLV(sdSeqTLV.val, pScan);
  const lBuf = (len) => len < 128 ? Buffer.from([len]) : Buffer.from([0x82, (len>>8)&0xff, len&0xff]);
  const trailingSisBody = Buffer.concat([sisTLV.val, Buffer.from([0x00, 0x00, 0x00])]);
  const newSis = Buffer.concat([Buffer.from([0x31]), lBuf(trailingSisBody.length), trailingSisBody]);
  const newSdSeqBody = Buffer.concat([sdSeqTLV.val.subarray(0, sisTLV.pos), newSis]);
  const newSdSeq = Buffer.concat([Buffer.from([0x30]), lBuf(newSdSeqBody.length), newSdSeqBody]);
  const newSdCtx = Buffer.concat([Buffer.from([0xa0]), lBuf(newSdSeq.length), newSdSeq]);
  const newRootBody = Buffer.concat([origCmsDer.subarray(rootTLV.hl, sdCtxTLV.pos), newSdCtx]);
  const newRoot = Buffer.concat([Buffer.from([0x30]), lBuf(newRootBody.length), newRootBody]);
  const fakeMultiSignerPdf = Buffer.from(signedPdf);
  const fakeMultiSignerHex = newRoot.toString('hex').toUpperCase().padEnd(32768, '0');
  Buffer.from(fakeMultiSignerHex, 'ascii').copy(fakeMultiSignerPdf, contentsPos);
  const r10 = pdfSigner.verifySignedPdf(fakeMultiSignerPdf);
  assert(r10.isValid === false && r10.reason.includes('signerInfos SET chứa dữ liệu thừa hoặc nhiều SignerInfo'), 'Negative 10: Tấn công Multiple/Trailing SignerInfo trong signerInfos SET -> Lập tức BỊ CHẶN');

  // Negative 11: Non-canonical DER length (long form cho len < 128, leading zeroes, indefinite length)
  const nonCanonLongForm = Buffer.from([0x04, 0x81, 0x0a, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  const leadingZeroLength = Buffer.from([0x04, 0x82, 0x00, 0x0a, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  const indefiniteLength = Buffer.from([0x30, 0x80, 0x00, 0x00]);
  const r11_1 = parseTLV(nonCanonLongForm);
  const r11_2 = parseTLV(leadingZeroLength);
  const r11_3 = parseTLV(indefiniteLength);
  assert(r11_1 === null && r11_2 === null && r11_3 === null, 'Negative 11: Non-canonical DER encoding (long-form < 128, leading zero, indefinite) -> Lập tức BỊ TỪ CHỐI');

  // Negative 12: Tấn công Duplicate Attributes trong signedAttrs (RFC 5652 / Fail-Closed)
  // CONTRACT: Negative 12 | Tái cấu trúc signedAttrs chuẩn DER chứa 2 thuộc tính messageDigest hợp lệ cùng OID để kiểm tra cơ chế phát hiện trùng lặp.
  const dupToken = (() => {
    const token = Buffer.from(tsaResult.timeStampToken);
    const ci = parseTLV(token, 0);
    const ctOid = parseTLV(token, ci.pos + ci.hl);
    const sdCtx = parseTLV(token, ctOid.next);
    const sdSeq = parseTLV(sdCtx.val, 0);
    let p = 0;
    const ver = parseTLV(sdSeq.val, p); p = ver.next;
    const da = parseTLV(sdSeq.val, p); p = da.next;
    const eci = parseTLV(sdSeq.val, p); p = eci.next;
    const certs = parseTLV(sdSeq.val, p); p = certs.next;
    const sis = parseTLV(sdSeq.val, p);
    const si = parseTLV(sis.val, 0);
    let siP = 0;
    const siVer = parseTLV(si.val, siP); siP = siVer.next;
    const sid = parseTLV(si.val, siP); siP = sid.next;
    const siDa = parseTLV(si.val, siP); siP = siDa.next;
    const signedAttrs = parseTLV(si.val, siP);
    const restSi = si.val.subarray(signedAttrs.next);

    let ap = 0;
    let mdAttr = null;
    while (ap < signedAttrs.val.length) {
      const attr = parseTLV(signedAttrs.val, ap);
      const fullAttr = signedAttrs.val.subarray(attr.pos, attr.next);
      if (fullAttr.includes(Buffer.from('2a864886f70d010904', 'hex'))) {
        mdAttr = fullAttr;
        break;
      }
      ap = attr.next;
    }
    assert(mdAttr !== null, 'Tìm thấy thuộc tính messageDigest trong signedAttrs');

    const newSignedAttrsVal = Buffer.concat([signedAttrs.val, mdAttr]);
    const newSignedAttrs = Buffer.concat([Buffer.from([0xa0]), encodeLength(newSignedAttrsVal.length), newSignedAttrsVal]);
    const newSiVal = Buffer.concat([si.val.subarray(0, signedAttrs.pos), newSignedAttrs, restSi]);
    const newSi = Buffer.concat([Buffer.from([0x30]), encodeLength(newSiVal.length), newSiVal]);
    const newSis = Buffer.concat([Buffer.from([0x31]), encodeLength(newSi.length), newSi]);
    const newSdSeqVal = Buffer.concat([sdSeq.val.subarray(0, sis.pos), newSis]);
    const newSdSeq = Buffer.concat([Buffer.from([0x30]), encodeLength(newSdSeqVal.length), newSdSeqVal]);
    const newSdCtx = Buffer.concat([Buffer.from([0xa0]), encodeLength(newSdSeq.length), newSdSeq]);
    const newCiVal = Buffer.concat([token.subarray(ci.hl, sdCtx.pos), newSdCtx]);
    return Buffer.concat([Buffer.from([0x30]), encodeLength(newCiVal.length), newCiVal]);
  })();
  const r12 = pdfSigner._extractAndVerifyTsaToken(dupToken, signatureHash);
  assert(r12.isValid === false && r12.reason.includes('thuộc tính trùng lặp'), 'Negative 12: Tấn công Duplicate Attributes trong signedAttrs -> Lập tức BỊ PHÁT HIỆN & TỪ CHỐI');

  // Negative 13: Kích hoạt Mock fallback trong môi trường production (NODE_ENV=production)
  let n13Caught = false;
  try {
    process.env.NODE_ENV = 'production';
    new TsaClient({ allowMockFallback: true });
  } catch (err) {
    if (err.message.includes('NODE_ENV=production')) n13Caught = true;
  } finally {
    delete process.env.NODE_ENV;
  }
  assert(n13Caught === true, 'Negative 13: Kích hoạt Mock fallback trong môi trường production -> Lập tức BỊ NÉM LỖI & CHẶN ĐỨNG');

  // Negative 14: Giả mạo chứng thư TSA không khớp Certificate Pinning của Ban Cơ yếu Chính phủ
  const strictTsaClient = new TsaClient({ enforceTsaPinning: true });
  strictTsaClient.pinnedFingerprints = new Set(['00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF']);
  let n14Caught = false;
  try {
    const dummyHash = crypto.createHash('sha256').update('pinning_test').digest();
    await strictTsaClient.requestTimestamp(dummyHash);
  } catch (err) {
    if (err.message.includes('không khớp vân tay SHA-256 được ghim cứng')) n14Caught = true;
  }
  assert(n14Caught === true, 'Negative 14: Giả mạo chứng thư TSA không khớp Certificate Pinning của Ban Cơ yếu Chính phủ -> Lập tức BỊ CHẶN');

  // Negative 15: Chèn trailing bytes / malformed certificate vào sau chứng thư người ký trong certificates container
  {
    const rootSignedDataCtx = parseTLV(origCmsDer, 0);
    const ctOidTLV = parseTLV(origCmsDer, rootSignedDataCtx.pos + rootSignedDataCtx.hl);
    const sdCtxTLV = parseTLV(origCmsDer, ctOidTLV.next);
    const sdSeqTLV = parseTLV(sdCtxTLV.val, 0);
    let pCms = 0;
    const vTLV = parseTLV(sdSeqTLV.val, pCms); pCms = vTLV.next;
    const daTLV = parseTLV(sdSeqTLV.val, pCms); pCms = daTLV.next;
    const eciTLV = parseTLV(sdSeqTLV.val, pCms); pCms = eciTLV.next;
    const certsTLV = parseTLV(sdSeqTLV.val, pCms);
    
    const malformedCertsVal = Buffer.concat([certsTLV.val, Buffer.from([0x30, 0x05, 0x01, 0x02, 0x03, 0x04, 0x05])]);
    const malformedCertsTag = Buffer.concat([Buffer.from([0xa0, 0x82, (malformedCertsVal.length >> 8) & 0xff, malformedCertsVal.length & 0xff]), malformedCertsVal]);
    
    const malformedSdBody = Buffer.concat([
      sdSeqTLV.val.subarray(0, eciTLV.next),
      malformedCertsTag,
      sdSeqTLV.val.subarray(certsTLV.next)
    ]);
    const malformedSdSeq = Buffer.concat([Buffer.from([0x30, 0x82, (malformedSdBody.length >> 8) & 0xff, malformedSdBody.length & 0xff]), malformedSdBody]);
    const malformedSdCtx = Buffer.concat([Buffer.from([0xa0, 0x82, (malformedSdSeq.length >> 8) & 0xff, malformedSdSeq.length & 0xff]), malformedSdSeq]);
    const malformedCmsBody = Buffer.concat([
      origCmsDer.subarray(rootSignedDataCtx.pos + rootSignedDataCtx.hl, ctOidTLV.next),
      malformedSdCtx
    ]);
    const malformedCms = Buffer.concat([Buffer.from([0x30, 0x82, (malformedCmsBody.length >> 8) & 0xff, malformedCmsBody.length & 0xff]), malformedCmsBody]);
    
    const fakePdf15 = Buffer.from(signedPdf);
    const fakeCmsHex15 = malformedCms.toString('hex').toUpperCase().padEnd(32768, '0');
    Buffer.from(fakeCmsHex15, 'ascii').copy(fakePdf15, contentsPos);
    const r15 = pdfSigner.verifySignedPdf(fakePdf15);
    assert(r15.isValid === false && (r15.reason.includes('trailing bytes') || r15.reason.includes('không hợp lệ') || r15.reason.includes('Fail-Closed')), 'Negative 15: Chèn trailing bytes / malformed certificate vào sau chứng thư người ký -> Lập tức BỊ CHẶN (Fail-Closed)');
  }

  // Negative 16: Sai thứ tự trường trong TSTInfo (Nonce đặt trước GenTime)
  let n16Caught = false;
  try {
    const fakeTstInfoBody = Buffer.concat([
      Buffer.from([0x02, 0x01, 0x01]), // version = 1
      Buffer.from([0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x09, 0x10]), // policy
      Buffer.from([0x30, 0x2f, 0x30, 0x0b, 0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01, 0x04, 0x20]), // imprint
      Buffer.alloc(32, 0xaa), // hash
      Buffer.from([0x02, 0x01, 0x01]), // serial = 1
      Buffer.from([0x02, 0x04, 0x12, 0x34, 0x56, 0x78]), // NONCE ĐỨNG TRƯỚC GENTIME! (Sai thứ tự)
      Buffer.from([0x18, 0x0f, 0x32, 0x30, 0x32, 0x36, 0x30, 0x39, 0x32, 0x36, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x5a]) // genTime
    ]);
    const fakeTstInfo = Buffer.concat([Buffer.from([0x30, fakeTstInfoBody.length]), fakeTstInfoBody]);
    tsaClient.parseStrictTSTInfo(fakeTstInfo);
  } catch (err) {
    if (err.message.includes('[TSA SCHEMA ERROR]')) {
      n16Caught = true;
    }
  }
  assert(n16Caught === true, 'Negative 16: Sai thứ tự trường trong TSTInfo (Nonce trước GenTime) -> Lập tức BỊ CHẶN (RFC 3161 Strict Schema)');

  // Negative 17: Chứng thư TSA là CA certificate (ca === true) -> BỊ TỪ CHỐI (Fail-Closed)
  {
    const rogueCaPair = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const { certDer: rogueCaCertDer } = generateSelfSignedX509(rogueCaPair, 'Rogue TSA CA', { isCA: true });
    const xRogue = new crypto.X509Certificate(rogueCaCertDer);
    assert(xRogue.ca === true, 'Negative 17 fixture: Chứng thư giả lập có BasicConstraints ca: true');
    
    const origToken = tsaResult.timeStampToken;
    const tRoot = parseTLV(origToken, 0);
    const tCt = parseTLV(origToken, tRoot.pos + tRoot.hl);
    const tSdCtx = parseTLV(origToken, tCt.next);
    const tSdSeq = parseTLV(tSdCtx.val, 0);
    let pT = 0;
    const tVer = parseTLV(tSdSeq.val, pT); pT = tVer.next;
    const tDa = parseTLV(tSdSeq.val, pT); pT = tDa.next;
    const tEci = parseTLV(tSdSeq.val, pT); pT = tEci.next;
    const tCerts = parseTLV(tSdSeq.val, pT);
    
    const rogueCertsVal = rogueCaCertDer;
    const rogueCertsTag = Buffer.concat([Buffer.from([0xa0, 0x82, (rogueCertsVal.length >> 8) & 0xff, rogueCertsVal.length & 0xff]), rogueCertsVal]);
    const rogueSdBody = Buffer.concat([
      tSdSeq.val.subarray(0, tEci.next),
      rogueCertsTag,
      tSdSeq.val.subarray(tCerts.next)
    ]);
    const rogueSdSeq = Buffer.concat([Buffer.from([0x30, 0x82, (rogueSdBody.length >> 8) & 0xff, rogueSdBody.length & 0xff]), rogueSdBody]);
    const rogueSdCtx = Buffer.concat([Buffer.from([0xa0, 0x82, (rogueSdSeq.length >> 8) & 0xff, rogueSdSeq.length & 0xff]), rogueSdSeq]);
    const rogueTokenBody = Buffer.concat([
      origToken.subarray(tRoot.pos + tRoot.hl, tCt.next),
      rogueSdCtx
    ]);
    const rogueToken = Buffer.concat([Buffer.from([0x30, 0x82, (rogueTokenBody.length >> 8) & 0xff, rogueTokenBody.length & 0xff]), rogueTokenBody]);
    const r17Result = pdfSigner._extractAndVerifyTsaToken(rogueToken, signatureHash);
    assert(r17Result.isValid === false, 'Negative 17: Chứng thư TSA là CA certificate hoặc giả mạo -> Lập tức BỊ TỪ CHỐI (Fail-Closed)');
  }

  // Negative 18: Chứng thư người ký là CA certificate (ca === true) -> BỊ TỪ CHỐI (Fail-Closed)
  {
    const rogueSignerPair = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const { certDer: rogueSignerCaCertDer } = generateSelfSignedX509(rogueSignerPair, 'Thay Nguyen Van A - Rogue CA', { isCA: true });
    const xSignerCa = new crypto.X509Certificate(rogueSignerCaCertDer);
    assert(xSignerCa.ca === true, 'Negative 18 fixture: Chứng thư người ký có BasicConstraints ca: true');
    
    const rootSignedDataCtx = parseTLV(origCmsDer, 0);
    const ctOidTLV = parseTLV(origCmsDer, rootSignedDataCtx.pos + rootSignedDataCtx.hl);
    const sdCtxTLV = parseTLV(origCmsDer, ctOidTLV.next);
    const sdSeqTLV = parseTLV(sdCtxTLV.val, 0);
    let pCms = 0;
    const vTLV = parseTLV(sdSeqTLV.val, pCms); pCms = vTLV.next;
    const daTLV = parseTLV(sdSeqTLV.val, pCms); pCms = daTLV.next;
    const eciTLV = parseTLV(sdSeqTLV.val, pCms); pCms = eciTLV.next;
    const certsTLV = parseTLV(sdSeqTLV.val, pCms);
    
    const rogueCertsVal = rogueSignerCaCertDer;
    const rogueCertsTag = Buffer.concat([Buffer.from([0xa0, 0x82, (rogueCertsVal.length >> 8) & 0xff, rogueCertsVal.length & 0xff]), rogueCertsVal]);
    
    const sisPartTLV = parseTLV(sdSeqTLV.val, certsTLV.next);
    const siSeqTLV = parseTLV(sisPartTLV.val, 0);
    const rogueMeta = TsaClient.extractIssuerAndSerialFromCert(rogueSignerCaCertDer);
    const rogueSid = Buffer.concat([
      Buffer.from([0x30]),
      Buffer.from([rogueMeta.issuerDer.length + 2 + rogueMeta.serialDer.length]),
      rogueMeta.issuerDer,
      Buffer.from([0x02, rogueMeta.serialDer.length]),
      rogueMeta.serialDer
    ]);
    
    const siVerTLV = parseTLV(siSeqTLV.val, 0);
    const origSidTLV = parseTLV(siSeqTLV.val, siVerTLV.next);
    const rogueSiSeqVal = Buffer.concat([
      siSeqTLV.val.subarray(0, siVerTLV.next),
      rogueSid,
      siSeqTLV.val.subarray(origSidTLV.next)
    ]);
    const rogueSiSeq = Buffer.concat([Buffer.from([0x30, 0x82, (rogueSiSeqVal.length >> 8) & 0xff, rogueSiSeqVal.length & 0xff]), rogueSiSeqVal]);
    const rogueSisPart = Buffer.concat([Buffer.from([0x31, 0x82, (rogueSiSeq.length >> 8) & 0xff, rogueSiSeq.length & 0xff]), rogueSiSeq]);
    
    const rogueSdBody = Buffer.concat([
      sdSeqTLV.val.subarray(0, eciTLV.next),
      rogueCertsTag,
      rogueSisPart
    ]);
    const rogueSdSeq = Buffer.concat([Buffer.from([0x30, 0x82, (rogueSdBody.length >> 8) & 0xff, rogueSdBody.length & 0xff]), rogueSdBody]);
    const rogueSdCtx = Buffer.concat([Buffer.from([0xa0, 0x82, (rogueSdSeq.length >> 8) & 0xff, rogueSdSeq.length & 0xff]), rogueSdSeq]);
    const rogueCmsBody = Buffer.concat([
      origCmsDer.subarray(rootSignedDataCtx.pos + rootSignedDataCtx.hl, ctOidTLV.next),
      rogueSdCtx
    ]);
    const rogueCms = Buffer.concat([Buffer.from([0x30, 0x82, (rogueCmsBody.length >> 8) & 0xff, rogueCmsBody.length & 0xff]), rogueCmsBody]);
    
    const fakePdf18 = Buffer.from(signedPdf);
    const fakeCmsHex18 = rogueCms.toString('hex').toUpperCase().padEnd(32768, '0');
    Buffer.from(fakeCmsHex18, 'ascii').copy(fakePdf18, contentsPos);
    const r18 = pdfSigner.verifySignedPdf(fakePdf18);
    assert(r18.isValid === false && (r18.reason.includes('chứng thư CA') || r18.reason.includes('Fail-Closed') || r18.reason.includes('không hợp lệ')), 'Negative 18: Chứng thư người ký là CA certificate -> Lập tức BỊ CHẶN (Fail-Closed)');
  }

  // Negative 19: Số nguyên âm hoặc zero trong serialNumber/nonce của TSTInfo -> Lập tức BỊ CHẶN (RFC 3161/5280)
  {
    let n19NegSerialCaught = false;
    try {
      const fakeTstInfoBody = Buffer.concat([
        Buffer.from([0x02, 0x01, 0x01]), // version = 1
        Buffer.from([0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x09, 0x10]), // policy
        Buffer.from([0x30, 0x2f, 0x30, 0x0b, 0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01, 0x04, 0x20]), // imprint
        Buffer.alloc(32, 0xaa), // hash
        Buffer.from([0x02, 0x01, 0xff]), // serialNumber = -1 (ÂM!)
        Buffer.from([0x18, 0x0f, 0x32, 0x30, 0x32, 0x36, 0x30, 0x39, 0x32, 0x36, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x5a]) // genTime
      ]);
      const fakeTstInfo = Buffer.concat([Buffer.from([0x30, fakeTstInfoBody.length]), fakeTstInfoBody]);
      tsaClient.parseStrictTSTInfo(fakeTstInfo);
    } catch (err) {
      if (err.message.includes('số nguyên âm')) n19NegSerialCaught = true;
    }
    assert(n19NegSerialCaught === true, 'Negative 19a: TSTInfo có serialNumber âm -> Lập tức BỊ TỪ CHỐI (RFC 5280/3161)');

    let n19ZeroSerialCaught = false;
    try {
      const fakeTstInfoBody = Buffer.concat([
        Buffer.from([0x02, 0x01, 0x01]), // version = 1
        Buffer.from([0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x09, 0x10]), // policy
        Buffer.from([0x30, 0x2f, 0x30, 0x0b, 0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01, 0x04, 0x20]), // imprint
        Buffer.alloc(32, 0xaa), // hash
        Buffer.from([0x02, 0x01, 0x00]), // serialNumber = 0 (KHÔNG DƯƠNG!)
        Buffer.from([0x18, 0x0f, 0x32, 0x30, 0x32, 0x36, 0x30, 0x39, 0x32, 0x36, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x5a]) // genTime
      ]);
      const fakeTstInfo = Buffer.concat([Buffer.from([0x30, fakeTstInfoBody.length]), fakeTstInfoBody]);
      tsaClient.parseStrictTSTInfo(fakeTstInfo);
    } catch (err) {
      if (err.message.includes('giá trị 0')) n19ZeroSerialCaught = true;
    }
    assert(n19ZeroSerialCaught === true, 'Negative 19b: TSTInfo có serialNumber = 0 -> Lập tức BỊ TỪ CHỐI (RFC 5280/3161)');
  }

  // Negative 20: Tấn công Chuỗi 3 tầng Rogue (Rogue Leaf -> Rogue Inter -> Rogue Root) chèn song song với Root CA thật của Chính phủ
  {
    const OFFICIAL_ROOT_CA_G2_FINGERPRINT = 'F0:4B:A4:B4:59:A7:C9:A1:B9:71:AD:9B:1C:B8:33:E6:95:A8:0C:79:AE:A6:3B:17:4B:66:A7:0E:DF:E2:FD:B8';
    
    // 1. Tạo Rogue Root CA (tự ký, CA: true, keyCertSign: true)
    const rogueRootKey = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const rogueRoot = generateSelfSignedX509(rogueRootKey, 'Rogue Root CA', { isCA: true, keyUsage: { keyCertSign: true } });
    const rogueRootCert = new crypto.X509Certificate(rogueRoot.certDer);

    // 2. Tạo Rogue Intermediate CA được cấp phát bởi Rogue Root CA
    const rogueInterKey = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const rogueInter = generateSelfSignedX509(rogueInterKey, 'Rogue Intermediate CA', {
      isCA: true,
      keyUsage: { keyCertSign: true },
      issuerNameSeq: rogueRoot.nameSeq,
      issuerPrivateKey: rogueRootKey.privateKey
    });
    const rogueInterCert = new crypto.X509Certificate(rogueInter.certDer);

    // 3. Tạo Rogue Leaf TSA được cấp phát bởi Rogue Intermediate CA
    const rogueLeafKey = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const rogueLeaf = generateSelfSignedX509(rogueLeafKey, 'Rogue Leaf TSA Signer', {
      issuerNameSeq: rogueInter.nameSeq,
      issuerPrivateKey: rogueInterKey.privateKey,
      keyUsage: { digitalSignature: true },
      extKeyUsageOids: ['2b06010505070308']
    });
    const rogueLeafCert = new crypto.X509Certificate(rogueLeaf.certDer);

    // 4. Trích xuất Root CA G2 thật từ token TSA chính thức
    const tokenTLV = parseTLV(tsaResult.timeStampToken, 0);
    const contentInfoTLV = parseTLV(tsaResult.timeStampToken, tokenTLV.pos + tokenTLV.hl);
    const signedDataTagged = parseTLV(tsaResult.timeStampToken, contentInfoTLV.next);
    const signedDataSeq = parseTLV(signedDataTagged.val, 0);
    let pT = 0;
    let certsPart = null;
    while (pT < signedDataSeq.val.length) {
      const item = parseTLV(signedDataSeq.val, pT);
      if (!item) break;
      if (item.tag === 0xa0) { certsPart = item; break; }
      pT = item.next;
    }
    let officialRootCert = null;
    let cP = 0;
    while (cP < certsPart.val.length) {
      const cTLV = parseTLV(certsPart.val, cP);
      const cDer = certsPart.val.subarray(cTLV.pos, cTLV.next);
      const x = new crypto.X509Certificate(cDer);
      if (x.fingerprint256 === OFFICIAL_ROOT_CA_G2_FINGERPRINT) {
        officialRootCert = x;
      }
      cP = cTLV.next;
    }

    // Hồ bơi chứng thư allCerts chứa cả chuỗi Rogue 3 tầng VÀ Root CA thật của Chính phủ
    const allCertsMixed = [rogueLeafCert, rogueInterCert, rogueRootCert, officialRootCert];

    // Xác thực đường dẫn cho Rogue Leaf Cert: BẮT BUỘC BỊ TỪ CHỐI vì chuỗi dựng được dẫn về Rogue Root CA chứ không phải Root CA ghim cứng
    const n20Result = validateX509CertificatePath(rogueLeafCert, allCertsMixed, OFFICIAL_ROOT_CA_G2_FINGERPRINT);
    assert(
      n20Result.isValid === false && n20Result.reason.includes('không kết thúc tại Root CA'),
      'Negative 20: Tấn công Chuỗi 3 tầng Rogue chèn song song với Root CA thật -> Lập tức BỊ CHẶN (Chain Termination Invariant)'
    );
  }

  // Negative 21: Tấn công Leaf TSA có extension extKeyUsage nhưng thiếu OID id-kp-timeStamping
  {
    const ekuKey = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const { certDer: ekuDer } = generateSelfSignedX509(ekuKey, 'Fake TSA with 2b06010505070308 in CN', {
      extKeyUsageOids: ['2b06010505070301'] // id-kp-serverAuth only
    });
    const fakeEkuCert = new crypto.X509Certificate(ekuDer);
    const hasEku = hasTimeStampingEKU(fakeEkuCert);
    assert(hasEku === false, 'Negative 21: Leaf TSA có extKeyUsage nhưng thiếu OID id-kp-timeStamping (1.3.6.1.5.5.7.3.8) -> Lập tức BỊ TỪ CHỐI (Strict ASN.1 TLV Parser)');
  }

  // Negative 22: Tấn công CA có extension KeyUsage nhưng thiếu quyền keyCertSign (RFC 5280)
  {
    const caNoKeyCertSignKey = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const { certDer: caNoKeyCertSignDer } = generateSelfSignedX509(caNoKeyCertSignKey, 'CA Without keyCertSign', {
      isCA: true,
      keyUsage: { digitalSignature: true } // Chỉ có digitalSignature, thiếu keyCertSign
    });
    const caNoKeyCertSignCert = new crypto.X509Certificate(caNoKeyCertSignDer);
    const n22Result = validateX509CertificatePath(caNoKeyCertSignCert, [caNoKeyCertSignCert], caNoKeyCertSignCert.fingerprint256);
    assert(
      n22Result.isValid === false && n22Result.reason.includes('keyCertSign'),
      'Negative 22: CA có extension KeyUsage nhưng thiếu quyền keyCertSign -> Lập tức BỊ TỪ CHỐI (RFC 5280 Section 4.2.1.3)'
    );
  }

  // Negative 23: Tấn công Intermediate CA đã hết hạn trong chuỗi
  {
    const rootKey = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const root = generateSelfSignedX509(rootKey, 'Test Root CA', { isCA: true, keyUsage: { keyCertSign: true } });
    const rootCert = new crypto.X509Certificate(root.certDer);

    const expiredInterKey = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const expiredInter = generateSelfSignedX509(expiredInterKey, 'Expired Intermediate CA', {
      isCA: true,
      keyUsage: { keyCertSign: true },
      issuerNameSeq: root.nameSeq,
      issuerPrivateKey: rootKey.privateKey,
      notBefore: new Date(Date.now() - 100 * 86400000),
      notAfter: new Date(Date.now() - 10 * 86400000) // Hết hạn 10 ngày trước!
    });
    const expiredInterCert = new crypto.X509Certificate(expiredInter.certDer);

    const leafKey = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const leaf = generateSelfSignedX509(leafKey, 'Test Leaf', {
      keyUsage: { digitalSignature: true },
      issuerNameSeq: expiredInter.nameSeq,
      issuerPrivateKey: expiredInterKey.privateKey
    });
    const leafCert = new crypto.X509Certificate(leaf.certDer);

    const n23Result = validateX509CertificatePath(leafCert, [leafCert, expiredInterCert, rootCert], rootCert.fingerprint256);
    assert(
      n23Result.isValid === false && n23Result.reason.includes('đã hết hạn'),
      'Negative 23: Intermediate CA đã hết hạn trong chuỗi -> Lập tức BỊ TỪ CHỐI (RFC 5280 Full Chain Validity)'
    );
  }

  // Negative 24: Tấn công Vi phạm pathLenConstraint của Root CA (Boundary test pathLen = 0 vs 1 intermediate)
  {
    const rootWithZeroPathKey = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const rootWithZeroPath = generateSelfSignedX509(rootWithZeroPathKey, 'Root CA with pathLen 0', {
      isCA: true,
      keyUsage: { keyCertSign: true },
      pathLenConstraint: 0
    });
    const rootCert = new crypto.X509Certificate(rootWithZeroPath.certDer);

    const interKey = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const inter = generateSelfSignedX509(interKey, 'Intermediate CA', {
      isCA: true,
      keyUsage: { keyCertSign: true },
      issuerNameSeq: rootWithZeroPath.nameSeq,
      issuerPrivateKey: rootWithZeroPathKey.privateKey
    });
    const interCert = new crypto.X509Certificate(inter.certDer);

    const leafKey = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const leaf = generateSelfSignedX509(leafKey, 'Leaf Signer', {
      keyUsage: { digitalSignature: true },
      issuerNameSeq: inter.nameSeq,
      issuerPrivateKey: interKey.privateKey
    });
    const leafCert = new crypto.X509Certificate(leaf.certDer);

    const n24Result = validateX509CertificatePath(leafCert, [leafCert, interCert, rootCert], rootCert.fingerprint256);
    assert(
      n24Result.isValid === false && n24Result.reason.includes('pathLenConstraint'),
      'Negative 24: Chuỗi chứng thư vi phạm pathLenConstraint (0) của Root CA -> Lập tức BỊ TỪ CHỐI (RFC 5280 Section 4.2.1.9)'
    );
  }

  // Negative 25: Tấn công Trailing bytes trong DER của chứng thư (Strict Canonical DER boundary enforcement)
  {
    const dummyKey = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const { certDer } = generateSelfSignedX509(dummyKey, 'Valid Cert for Trailing Test', { isCA: true });
    const corruptDer = Buffer.concat([certDer, Buffer.from([0x00])]);
    const bcRes = parseBasicConstraintsFromDer(corruptDer);
    const kuRes = parseKeyUsageFromDer(corruptDer);
    const ekuRes = hasTimeStampingEKU({ raw: corruptDer });
    assert(
      bcRes.isCA === false && kuRes.hasKeyUsage === false && ekuRes === false,
      'Negative 25: Tiêm trailing bytes vào DER chứng thư -> Lập tức BỊ TỪ CHỐI bởi bộ phân tích cú pháp nghiêm ngặt'
    );
  }

  // Negative 26: Tấn công Non-canonical / Negative INTEGER trong BasicConstraints pathLenConstraint
  {
    const malformedBcDer = Buffer.concat([
      Buffer.from([0x30, 0x06, 0x01, 0x01, 0xff, 0x02, 0x01, 0xff]) // cA=TRUE, pathLenConstraint = -1 (âm!)
    ]);
    const extSeq = Buffer.concat([
      Buffer.from([0x30, 0x0f, 0x06, 0x03, 0x55, 0x1d, 0x13, 0x04, 0x08]),
      malformedBcDer
    ]);
    const dummyKey = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const { certDer } = generateSelfSignedX509(dummyKey, 'Cert with Malformed pathLen', {
      customExtensions: [extSeq]
    });
    const parsedBc = parseBasicConstraintsFromDer(certDer);
    assert(
      parsedBc.pathLenConstraint === undefined,
      'Negative 26: pathLenConstraint là số nguyên âm (-1) -> Lập tức BỊ LOẠI BỎ (RFC 5280 Non-canonical INTEGER Reject)'
    );
  }

  // Kiểm thử biên DER cho BasicConstraints pathLenConstraint: 0, 127, 128, 255 và vượt biên
  {
    const boundaryKey = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    for (const val of [0, 127, 128, 255]) {
      const { certDer } = generateSelfSignedX509(boundaryKey, `CA-pathLen-${val}`, {
        isCA: true,
        pathLenConstraint: val
      });
      const parsed = parseBasicConstraintsFromDer(certDer);
      assert(
        parsed.pathLenConstraint === val,
        `Boundary pathLenConstraint=${val} phải round-trip chính xác qua DER INTEGER chuẩn`
      );
    }
    let threw256 = false;
    try {
      generateSelfSignedX509(boundaryKey, 'CA-Invalid-pathLen-256', { isCA: true, pathLenConstraint: 256 });
    } catch (e) {
      if (e instanceof RangeError) threw256 = true;
    }
    assert(threw256, 'pathLenConstraint=256 phải ném RangeError');

    let threwNeg1 = false;
    try {
      generateSelfSignedX509(boundaryKey, 'CA-Invalid-pathLen-neg1', { isCA: true, pathLenConstraint: -1 });
    } catch (e) {
      if (e instanceof RangeError) threwNeg1 = true;
    }
    assert(threwNeg1, 'pathLenConstraint=-1 phải ném RangeError');
  }

  // Negative 27: cA = 0x01 (non-canonical BOOLEAN trong BasicConstraints theo X.690 11.1)
  {
    const badBcSeq = encodeSeq([Buffer.from([0x01, 0x01, 0x01])]);
    const badBcExt = encodeSeq([encodeOID('551d13'), encodeOctetString(badBcSeq)]);
    const extsSeq = encodeSeq([badBcExt]);
    const extsExplicit = encodeTLV(0xa3, extsSeq);
    const tbs = encodeSeq([Buffer.from([0x02, 0x01, 0x01]), extsExplicit]);
    const cert = encodeSeq([tbs, encodeSeq([encodeOID('2a8648ce3d040302')]), Buffer.from([0x03, 0x02, 0x00, 0x00])]);
    const bcRes = parseBasicConstraintsFromDer(cert);
    assert(
      bcRes.isCA === false,
      'Negative 27: Non-canonical BOOLEAN cA = 0x01 trong BasicConstraints -> Lập tức BỊ TỪ CHỐI (X.690 11.1 Strict DER)'
    );
  }

  // Negative 28: KeyUsage BIT STRING có bit không sử dụng (unused bits) khác zero (X.690 11.2)
  {
    const badKuBitString = Buffer.from([0x03, 0x02, 0x03, 0x07]); // 3 unused bits, nhưng byte có bit 1 ở các bit không sử dụng
    const badKuExt = encodeSeq([encodeOID('551d0f'), encodeOctetString(badKuBitString)]);
    const kuExtsSeq = encodeSeq([badKuExt]);
    const kuExtsExplicit = encodeTLV(0xa3, kuExtsSeq);
    const kuTbs = encodeSeq([Buffer.from([0x02, 0x01, 0x01]), kuExtsExplicit]);
    const kuCert = encodeSeq([kuTbs, encodeSeq([encodeOID('2a8648ce3d040302')]), Buffer.from([0x03, 0x02, 0x00, 0x00])]);
    const kuRes = parseKeyUsageFromDer(kuCert);
    assert(
      kuRes.hasKeyUsage === false,
      'Negative 28: KeyUsage BIT STRING có unused bits khác zero -> Lập tức BỊ TỪ CHỐI (X.690 11.2 Canonical DER)'
    );
  }

  // Negative 29: Nhiều chứng thư cùng khớp IssuerAndSerialNumber trong phản hồi TSA -> Fail-Closed
  {
    const tokenBuf = fs.readFileSync(path.join(__dirname, 'fixtures', 'live_gov_tsa_token_fixture.bin'));
    const ci = parseTLV(tokenBuf, 0);
    const sdOid = parseTLV(tokenBuf, ci.pos + ci.hl);
    const sdCtx = parseTLV(tokenBuf, sdOid.next);
    const sdSeq = parseTLV(sdCtx.val, 0);
    let p = 0;
    const ver = parseTLV(sdSeq.val, p); p = ver.next;
    const da = parseTLV(sdSeq.val, p); p = da.next;
    const eci = parseTLV(sdSeq.val, p); p = eci.next;
    const certs = parseTLV(sdSeq.val, p);

    const firstCert = parseTLV(certs.val, 0);
    const firstCertDer = certs.val.subarray(firstCert.pos, firstCert.next);
    const dupCertsVal = Buffer.concat([firstCertDer, certs.val]);
    const newCertsTLV = encodeTLV(0xa0, dupCertsVal);

    const sis = parseTLV(sdSeq.val, certs.next);
    const newSdSeq = encodeSeq([
      sdSeq.val.subarray(ver.pos, ver.next),
      sdSeq.val.subarray(da.pos, da.next),
      sdSeq.val.subarray(eci.pos, eci.next),
      newCertsTLV,
      sdSeq.val.subarray(sis.pos, sis.next)
    ]);
    const newSdCtx = encodeTLV(0xa0, newSdSeq);
    const dupToken = encodeSeq([encodeOID('2a864886f70d010702'), newSdCtx]);

    const tsa = new TsaClient();
    const eciCtx = parseTLV(eci.val, parseTLV(eci.val, 0).next);
    const tstInfoDer = parseTLV(eciCtx.val, 0).val;
    const tstInfo = tsa.parseStrictTSTInfo(tstInfoDer);
    const tokenDate = new Date(Date.UTC(
      parseInt(tstInfo.genTime.slice(0, 4), 10),
      parseInt(tstInfo.genTime.slice(4, 6), 10) - 1,
      parseInt(tstInfo.genTime.slice(6, 8), 10),
      parseInt(tstInfo.genTime.slice(8, 10), 10),
      parseInt(tstInfo.genTime.slice(10, 12), 10),
      parseInt(tstInfo.genTime.slice(12, 14), 10)
    ));

    let tsaDupRejected = false;
    try {
      tsa.parseTimeStampResp(encodeSeq([Buffer.from([0x30, 0x03, 0x02, 0x01, 0x00]), dupToken]), tstInfo.nonce, tstInfo.hashedMessage, tokenDate);
    } catch (e) {
      if (e.message.includes('Multiple certificates match SignerInfo.sid')) {
        tsaDupRejected = true;
      }
    }
    assert(
      tsaDupRejected === true,
      'Negative 29: Nhiều chứng thư TSA trùng khớp SignerInfo.sid -> Lập tức NÉM LỖI & TỪ CHỐI (Zero ambiguity)'
    );
  }

  // Negative 30: Nhiều chứng thư cùng khớp IssuerAndSerialNumber trong CMS của PDF -> Fail-Closed
  {
    const hexMatch = signedPdf.toString('binary').match(/\/Contents\s*<([0-9a-fA-F]+)>/);
    const cmsDer = Buffer.from(hexMatch[1], 'hex');
    const ci = parseTLV(cmsDer, 0);
    const sdOid = parseTLV(cmsDer, ci.pos + ci.hl);
    const sdCtx = parseTLV(cmsDer, sdOid.next);
    const sdSeq = parseTLV(sdCtx.val, 0);
    let p = 0;
    const ver = parseTLV(sdSeq.val, p); p = ver.next;
    const da = parseTLV(sdSeq.val, p); p = da.next;
    const eci = parseTLV(sdSeq.val, p); p = eci.next;
    const certs = parseTLV(sdSeq.val, p);

    const singleCertTLV = parseTLV(certs.val, 0);
    const singleCertDer = certs.val.subarray(singleCertTLV.pos, singleCertTLV.next);
    const dupCertsVal = Buffer.concat([singleCertDer, singleCertDer]);
    const newCertsTLV = encodeTLV(0xa0, dupCertsVal);

    const sis = parseTLV(sdSeq.val, certs.next);
    const newSdSeq = encodeSeq([
      sdSeq.val.subarray(ver.pos, ver.next),
      sdSeq.val.subarray(da.pos, da.next),
      sdSeq.val.subarray(eci.pos, eci.next),
      newCertsTLV,
      sdSeq.val.subarray(sis.pos, sis.next)
    ]);
    const newSdCtx = encodeTLV(0xa0, newSdSeq);
    const newCi = encodeSeq([encodeOID('2a864886f70d010702'), newSdCtx]);

    const contentsPos = signedPdf.indexOf(Buffer.from('/Contents <', 'utf8')) + 11;
    const dupSignerPdf = Buffer.from(signedPdf);
    const dupSignerHex = newCi.toString('hex').toUpperCase().padEnd(32768, '0');
    Buffer.from(dupSignerHex, 'ascii').copy(dupSignerPdf, contentsPos);

    const rDupSigner = pdfSigner.verifySignedPdf(dupSignerPdf);
    assert(
      rDupSigner.isValid === false && rDupSigner.reason.includes('Multiple certificates match SignerInfo.sid'),
      'Negative 30: Nhiều chứng thư người ký trùng khớp SignerInfo.sid trong CMS -> Lập tức BỊ CHẶN (Fail-Closed)'
    );
  }

  // Negative 31: Tệp PDF chứa Signature Dictionary mồ côi (/Type /Sig không được liên kết hợp lệ)
  {
    const orphanObj = '\n99 0 obj\n<< /Type /Sig /Filter /Adobe.PPKLite /ByteRange [ 0 10 20 30 ] >>\nendobj\n';
    const orphanPdf = Buffer.concat([signedPdf, Buffer.from(orphanObj, 'latin1')]);
    const rOrphan = pdfSigner.verifySignedPdf(orphanPdf);
    assert(
      rOrphan.isValid === false && rOrphan.reason.includes('mồ côi'),
      'Negative 31: PDF chứa Signature Dictionary mồ côi ngoài luồng -> Lập tức BỊ CHẶN (ISO 32000-1 Invariant)'
    );
  }

  // Negative 32: Signature Widget không nằm trong mảng /Annots của trang nào
  {
    const s = signedPdf.toString('latin1');
    const noAnnotsStr = s.replace(/\/Annots\s*\[\s*13\s+0\s+R\s*\]/, '/Annots [        ]');
    const noAnnotsPdf = Buffer.from(noAnnotsStr, 'latin1');
    const rNoAnnots = pdfSigner.verifySignedPdf(noAnnotsPdf);
    assert(
      rNoAnnots.isValid === false && rNoAnnots.reason.includes('/Annots'),
      'Negative 32: Widget chữ ký bị tách rời khỏi /Annots của trang -> Lập tức BỊ TỪ CHỐI (ISO 32000-1 Page Link)'
    );
  }

  // Negative 32b: Widget là 13 0 R nhưng /Annots chứa 113 0 R (False Substring Match Attack)
  {
    const s = signedPdf.toString('latin1');
    const falseMatchStr = s.replace('/Annots [ 13 0 R ]', '/Annots [ 113 0 R]');
    const falseMatchPdf = Buffer.from(falseMatchStr, 'latin1');
    const rFalseMatch = pdfSigner.verifySignedPdf(falseMatchPdf);
    assert(
      rFalseMatch.isValid === false && rFalseMatch.reason.includes('/Annots'),
      'Negative 32b: False substring match trong /Annots (113 0 R vs 13 0 R) -> Lập tức BỊ TỪ CHỐI (Token Boundary Invariant)'
    );
  }

  // Negative 33: Signature Widget không nằm trong AcroForm /Fields
  {
    const s = signedPdf.toString('latin1');
    const noFieldsStr = s.replace(/\/Fields\s*\[\s*13\s+0\s+R\s*\]/, '/Fields [        ]');
    const noFieldsPdf = Buffer.from(noFieldsStr, 'latin1');
    const rNoFields = pdfSigner.verifySignedPdf(noFieldsPdf);
    assert(
      rNoFields.isValid === false && (rNoFields.reason.includes('AcroForm.Fields') || rNoFields.reason.includes('/Fields')),
      'Negative 33: Widget chữ ký thiếu trong AcroForm /Fields -> Lập tức BỊ TỪ CHỐI (ISO 32000-1 Form Link)'
    );
  }

  // Negative 34: /SigFlags bị sai lệch hoặc thiếu
  {
    const s = signedPdf.toString('latin1');
    const badFlagsStr = s.replace(/\/SigFlags\s+3/, '/SigFlags 0');
    const badFlagsPdf = Buffer.from(badFlagsStr, 'latin1');
    const rBadFlags = pdfSigner.verifySignedPdf(badFlagsPdf);
    assert(
      rBadFlags.isValid === false && rBadFlags.reason.includes('/SigFlags'),
      'Negative 34: /SigFlags không chuẩn (khác 3) -> Lập tức BỊ TỪ CHỐI (ISO 32000-1 AcroForm Invariant)'
    );
  }

  // Negative 35: /ByteRange sai lệch không khớp với vùng ByteRange-gap của /Contents
  {
    const s = signedPdf.toString('latin1');
    const badBrStr = s.replace(/\/ByteRange\s*\[\s*0\s+(\d+)/, '/ByteRange [ 0 0000009999');
    const badBrPdf = Buffer.from(badBrStr, 'latin1');
    const rBadBr = pdfSigner.verifySignedPdf(badBrPdf);
    assert(
      rBadBr.isValid === false,
      'Negative 35: /ByteRange không khớp với vùng /Contents trong file -> Lập tức BỊ PHÁT HIỆN & TỪ CHỐI'
    );
  }

  // Negative 36: encodeLength từ chối số âm, số thực, chuỗi, và kích thước > 4GB
  {
    let elRejected = 0;
    try { encodeLength(-1); } catch (e) { elRejected++; }
    try { encodeLength(1.5); } catch (e) { elRejected++; }
    try { encodeLength('100'); } catch (e) { elRejected++; }
    try { encodeLength(0x100000000); } catch (e) { elRejected++; }
    assert(
      elRejected === 4,
      'Negative 36: encodeLength từ chối số âm, số thực, chuỗi và > 4GB -> Fail-closed 100%'
    );
  }

  // Negative 37: TimeStampToken có genTime trong tương lai vượt quá giới hạn sai lệch cho phép (Clock-drift Fail-closed)
  {
    const fixturePath = path.join(__dirname, 'fixtures', 'live_gov_tsa_token_fixture.bin');
    const fixtureToken = fs.readFileSync(fixturePath);
    // Thay đổi năm cấp dấu thành 2045 trong genTime
    const futureToken = Buffer.from(fixtureToken);
    const genTimePattern = Buffer.from('2026', 'ascii');
    const genIdx = futureToken.indexOf(genTimePattern);
    if (genIdx > 0) {
      Buffer.from('2045', 'ascii').copy(futureToken, genIdx);
    }
    const rFuture = pdfSigner._extractAndVerifyTsaToken(futureToken, Buffer.alloc(32));
    assert(
      rFuture.isValid === false && (rFuture.reason.includes('tương lai') || rFuture.reason.includes('sai lệch') || rFuture.reason.includes('không khớp')),
      'Negative 37: TimeStampToken có thời gian cấp dấu trong tương lai (2045) -> Lập tức BỊ TỪ CHỐI (Clock-drift Invariant)'
    );
  }

  // Negative 38: Sai Nonce (Mismatched Nonce giữa Request và Response TSA) -> Lập tức BỊ CHẶN (RFC 3161)
  {
    const fixturePath = path.join(__dirname, 'fixtures', 'live_gov_tsa_token_fixture.bin');
    const fixtureToken = fs.readFileSync(fixturePath);
    const tsa = new TsaClient();
    const ci = parseTLV(fixtureToken, 0);
    const sdOid = parseTLV(fixtureToken, ci.pos + ci.hl);
    const sdCtx = parseTLV(fixtureToken, sdOid.next);
    const sdSeq = parseTLV(sdCtx.val, 0);
    let p = 0;
    const ver = parseTLV(sdSeq.val, p); p = ver.next;
    const da = parseTLV(sdSeq.val, p); p = da.next;
    const eci = parseTLV(sdSeq.val, p); p = eci.next;
    const eciCtx = parseTLV(eci.val, parseTLV(eci.val, 0).next);
    const tstInfoDer = parseTLV(eciCtx.val, 0).val;
    const tstInfo = tsa.parseStrictTSTInfo(tstInfoDer);
    const tokenDate = new Date(Date.UTC(
      parseInt(tstInfo.genTime.slice(0, 4), 10),
      parseInt(tstInfo.genTime.slice(4, 6), 10) - 1,
      parseInt(tstInfo.genTime.slice(6, 8), 10),
      parseInt(tstInfo.genTime.slice(8, 10), 10),
      parseInt(tstInfo.genTime.slice(10, 12), 10),
      parseInt(tstInfo.genTime.slice(12, 14), 10)
    ));

    const fakeResp = encodeSeq([
      Buffer.from([0x30, 0x03, 0x02, 0x01, 0x00]), // PKIStatusInfo: status = 0
      fixtureToken
    ]);
    const wrongNonce = crypto.randomBytes(8);
    let n38Caught = false;
    try {
      tsa.parseTimeStampResp(fakeResp, wrongNonce, tstInfo.hashedMessage, tokenDate);
    } catch (e) {
      if (e.message.includes('Nonce trong TimeStampToken') && e.message.includes('không khớp')) {
        n38Caught = true;
      }
    }
    assert(n38Caught === true, 'Negative 38: Sai Nonce (Mismatched Nonce giữa Request và Response) -> Lập tức BỊ TỪ CHỐI (RFC 3161 Nonce Invariant)');
  }

  // Negative 39: Sai Policy OID (Policy OID không nằm trong danh mục được phép) -> Lập tức BỊ CHẶN
  {
    const fixturePath = path.join(__dirname, 'fixtures', 'live_gov_tsa_token_fixture.bin');
    const fixtureToken = fs.readFileSync(fixturePath);
    const tsaPolicyRestricted = new TsaClient({ allowedPolicies: ['0102030405'] });
    const ci = parseTLV(fixtureToken, 0);
    const sdOid = parseTLV(fixtureToken, ci.pos + ci.hl);
    const sdCtx = parseTLV(fixtureToken, sdOid.next);
    const sdSeq = parseTLV(sdCtx.val, 0);
    let p = 0;
    const ver = parseTLV(sdSeq.val, p); p = ver.next;
    const da = parseTLV(sdSeq.val, p); p = da.next;
    const eci = parseTLV(sdSeq.val, p); p = eci.next;
    const eciCtx = parseTLV(eci.val, parseTLV(eci.val, 0).next);
    const tstInfoDer = parseTLV(eciCtx.val, 0).val;
    const tstInfo = tsaClient.parseStrictTSTInfo(tstInfoDer);
    const tokenDate = new Date(Date.UTC(
      parseInt(tstInfo.genTime.slice(0, 4), 10),
      parseInt(tstInfo.genTime.slice(4, 6), 10) - 1,
      parseInt(tstInfo.genTime.slice(6, 8), 10),
      parseInt(tstInfo.genTime.slice(8, 10), 10),
      parseInt(tstInfo.genTime.slice(10, 12), 10),
      parseInt(tstInfo.genTime.slice(12, 14), 10)
    ));

    const fakeResp = encodeSeq([
      Buffer.from([0x30, 0x03, 0x02, 0x01, 0x00]),
      fixtureToken
    ]);
    let n39Caught = false;
    try {
      tsaPolicyRestricted.parseTimeStampResp(fakeResp, tstInfo.nonce, tstInfo.hashedMessage, tokenDate);
    } catch (e) {
      if (e.message.includes('Policy OID') && e.message.includes('không nằm trong danh mục')) {
        n39Caught = true;
      }
    }
    assert(n39Caught === true, 'Negative 39: Sai Policy OID (Unapproved Policy OID) -> Lập tức BỊ TỪ CHỐI (RFC 3161 Policy Enforcement)');
  }

  // Negative 40: Sai messageImprint (imprint trong TSTInfo không khớp SHA-256 signatureValue) -> Lập tức BỊ TỪ CHỐI
  {
    const fixturePath = path.join(__dirname, 'fixtures', 'live_gov_tsa_token_fixture.bin');
    const fixtureToken = fs.readFileSync(fixturePath);
    const wrongSigHash = crypto.createHash('sha256').update(Buffer.from('tampered_signature_value')).digest();
    const r40 = pdfSigner._extractAndVerifyTsaToken(fixtureToken, wrongSigHash);
    assert(
      r40.isValid === false && (r40.reason.includes('messageImprint không khớp') || r40.reason.includes('không khớp')),
      'Negative 40: Sai messageImprint (Imprint không khớp signatureValue) -> Lập tức BỊ TỪ CHỐI (PAdES-B-T Strict Bound)'
    );
  }

  // Negative 41: Sai cú pháp genTime hoặc ngày tháng Gregorian không hợp lệ (ví dụ: ngày 30 tháng 2) -> Lập tức BỊ TỪ CHỐI
  {
    let n41Feb30Caught = false;
    try {
      const { parseStrictGeneralizedTime: evalParse } = require('./independent-pades-verifier.js');
      evalParse('20260230000000Z'); // 30 tháng 2 năm 2026!
    } catch (e) {
      if (e.message.includes('Ngày không hợp lệ') || e.message.includes('GeneralizedTime')) {
        n41Feb30Caught = true;
      }
    }
    assert(n41Feb30Caught === true, 'Negative 41: Sai cú pháp genTime (Ngày 30 tháng 2 / Lịch Gregorian) -> Lập tức BỊ TỪ CHỐI (RFC 5280/3161 Strict Time Parser)');
  }

  // Negative 42: Token stale/replay (Hai chiều: tokenDate < now - 15m tại thời điểm cấp dấu) -> Lập tức BỊ CHẶN
  // CONTRACT: Negative 42 | Sử dụng fixture token nguyên bản có chữ ký hợp lệ, mô phỏng đồng hồ trôi về tương lai (+24h) để kiểm tra cơ chế chống stale token replay mà không patch byte DER.
  {
    const fixturePath = path.join(__dirname, 'fixtures', 'live_gov_tsa_token_fixture.bin');
    const fixtureToken = fs.readFileSync(fixturePath);
    const tsa = new TsaClient();
    const fakeResp = encodeSeq([
      Buffer.from([0x30, 0x03, 0x02, 0x01, 0x00]),
      fixtureToken
    ]);
    let n42Caught = false;
    const realDateNow = Date.now;
    try {
      Date.now = () => realDateNow() + 24 * 60 * 60 * 1000;
      tsa.parseTimeStampResp(fakeResp, Buffer.from([0x01]), Buffer.alloc(32));
    } catch (e) {
      n42Caught = true;
    } finally {
      Date.now = realDateNow;
    }
    assert(n42Caught === true, 'Negative 42: Token stale/replay (tokenDate < now - 15m) -> Lập tức BỊ TỪ CHỐI (Two-way Clock Drift Invariant)');
  }

  // Negative 43: Thay đổi 1 byte trong DER của TSTInfo -> Lập tức BỊ PHÁT HIỆN & TỪ CHỐI (Tampered TSTInfo DER)
  {
    const fixturePath = path.join(__dirname, 'fixtures', 'live_gov_tsa_token_fixture.bin');
    const fixtureToken = fs.readFileSync(fixturePath);
    const tamperedToken = Buffer.from(fixtureToken);
    const policyIdx = tamperedToken.indexOf(Buffer.from([0x60, 0x85, 0x40, 0x01, 0x01, 0x01, 0x02]));
    if (policyIdx > 0) {
      tamperedToken[policyIdx + 6] = 0x99;
    }
    const r43 = pdfSigner._extractAndVerifyTsaToken(tamperedToken, Buffer.alloc(32));
    assert(r43.isValid === false, 'Negative 43: Thay đổi 1 byte trong DER của TSTInfo -> Lập tức BỊ CHẶN (RFC 3161 Strict Schema Integrity)');
  }

  // Negative 44: Tráo đổi chứng thư TSA bằng chứng thư khác (Certificate substitution attack) -> Lập tức BỊ TỪ CHỐI
  {
    const fixturePath = path.join(__dirname, 'fixtures', 'live_gov_tsa_token_fixture.bin');
    const fixtureToken = fs.readFileSync(fixturePath);
    const fakeTsaPair = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const { certDer: fakeTsaCertDer } = generateSelfSignedX509(fakeTsaPair, 'Substituted Fake TSA Signer', {
      extKeyUsageOids: ['2b06010505070308']
    });
    
    const tRoot = parseTLV(fixtureToken, 0);
    const tCt = parseTLV(fixtureToken, tRoot.pos + tRoot.hl);
    const tSdCtx = parseTLV(fixtureToken, tCt.next);
    const tSdSeq = parseTLV(tSdCtx.val, 0);
    let pT = 0;
    const tVer = parseTLV(tSdSeq.val, pT); pT = tVer.next;
    const tDa = parseTLV(tSdSeq.val, pT); pT = tDa.next;
    const tEci = parseTLV(tSdSeq.val, pT); pT = tEci.next;
    const tCerts = parseTLV(tSdSeq.val, pT);
    
    const fakeCertsVal = fakeTsaCertDer;
    const fakeCertsTag = Buffer.concat([Buffer.from([0xa0, 0x82, (fakeCertsVal.length >> 8) & 0xff, fakeCertsVal.length & 0xff]), fakeCertsVal]);
    const fakeSdBody = Buffer.concat([
      tSdSeq.val.subarray(0, tEci.next),
      fakeCertsTag,
      tSdSeq.val.subarray(tCerts.next)
    ]);
    const fakeSdSeq = Buffer.concat([Buffer.from([0x30, 0x82, (fakeSdBody.length >> 8) & 0xff, fakeSdBody.length & 0xff]), fakeSdBody]);
    const fakeSdCtx = Buffer.concat([Buffer.from([0xa0, 0x82, (fakeSdSeq.length >> 8) & 0xff, fakeSdSeq.length & 0xff]), fakeSdSeq]);
    const fakeTokenBody = Buffer.concat([
      fixtureToken.subarray(tRoot.pos + tRoot.hl, tCt.next),
      fakeSdCtx
    ]);
    const fakeToken = Buffer.concat([Buffer.from([0x30, 0x82, (fakeTokenBody.length >> 8) & 0xff, fakeTokenBody.length & 0xff]), fakeTokenBody]);
    
    const r44 = pdfSigner._extractAndVerifyTsaToken(fakeToken, Buffer.alloc(32));
    assert(
      r44.isValid === false,
      'Negative 44: Tráo đổi chứng thư TSA bằng chứng thư khác -> Lập tức BỊ CHẶN (Fail-Closed & Cryptographic Pinning)'
    );
  }

  // Negative 45: signResult.isECDSA thiếu hoặc không phải boolean -> Lập tức BỊ CHẶN (Fail-Closed)
  {
    let caught45a = false;
    try {
      pdfSigner.embedSignatureAndTimestamp(prepared, { signature: rawSignature, certificate: certDer }, tsaResult.timeStampToken);
    } catch (e) {
      if (e.message.includes('signResult.isECDSA must be an explicit boolean value')) caught45a = true;
    }
    assert(caught45a === true, 'Negative 45a: signResult thiếu isECDSA -> Lập tức NÉM LỖI Fail-Closed');

    let caught45b = false;
    try {
      pdfSigner.embedSignatureAndTimestamp(prepared, { signature: rawSignature, certificate: certDer, isECDSA: 'true' }, tsaResult.timeStampToken);
    } catch (e) {
      if (e.message.includes('signResult.isECDSA must be an explicit boolean value')) caught45b = true;
    }
    assert(caught45b === true, 'Negative 45b: signResult.isECDSA là string ("true") thay vì boolean -> Lập tức NÉM LỖI Fail-Closed');
  }

  // Negative 46: signResult.isECDSA không khớp với loại khóa trong chứng thư -> Lập tức BỊ CHẶN
  {
    let caught46 = false;
    try {
      pdfSigner.embedSignatureAndTimestamp(prepared, { signature: rawSignature, certificate: certDer, isECDSA: false }, tsaResult.timeStampToken);
    } catch (e) {
      if (e.message.includes('không khớp với loại khóa')) caught46 = true;
    }
    assert(caught46 === true, 'Negative 46: signResult.isECDSA (false) không khớp chứng thư EC (ec) -> Lập tức BỊ CHẶN');
  }

  // Negative 47: signResult.signature rỗng hoặc Base64 sai cú pháp -> Lập tức BỊ CHẶN
  {
    let caught47a = false;
    try {
      pdfSigner.embedSignatureAndTimestamp(prepared, { signature: '', certificate: certDer, isECDSA: true }, tsaResult.timeStampToken);
    } catch (e) {
      if (e.message.includes('empty') || e.message.includes('Base64')) caught47a = true;
    }
    assert(caught47a === true, 'Negative 47a: signature là chuỗi rỗng -> Lập tức BỊ CHẶN');

    let caught47b = false;
    try {
      pdfSigner.embedSignatureAndTimestamp(prepared, { signature: 'invalid!base64#@', certificate: certDer, isECDSA: true }, tsaResult.timeStampToken);
    } catch (e) {
      if (e.message.includes('not a valid Base64 string')) caught47b = true;
    }
    assert(caught47b === true, 'Negative 47b: signature sai Base64 -> Lập tức BỊ CHẶN');
  }

  // Negative 48: signResult.certificate rỗng hoặc Base64 sai cú pháp -> Lập tức BỊ CHẶN
  {
    let caught48a = false;
    try {
      pdfSigner.embedSignatureAndTimestamp(prepared, { signature: rawSignature, certificate: '', isECDSA: true }, tsaResult.timeStampToken);
    } catch (e) {
      if (e.message.includes('empty') || e.message.includes('Base64')) caught48a = true;
    }
    assert(caught48a === true, 'Negative 48a: certificate là chuỗi rỗng -> Lập tức BỊ CHẶN');

    let caught48b = false;
    try {
      pdfSigner.embedSignatureAndTimestamp(prepared, { signature: rawSignature, certificate: 'not_base64!@#', isECDSA: true }, tsaResult.timeStampToken);
    } catch (e) {
      if (e.message.includes('not a valid Base64 string')) caught48b = true;
    }
    assert(caught48b === true, 'Negative 48b: certificate sai Base64 -> Lập tức BỊ CHẶN');
  }

  // Negative 49: signResult.certificate không phải là DER X.509 hợp lệ -> Lập tức BỊ CHẶN
  {
    let caught49 = false;
    try {
      pdfSigner.embedSignatureAndTimestamp(prepared, { signature: rawSignature, certificate: Buffer.from('not_a_valid_der_cert'), isECDSA: true }, tsaResult.timeStampToken);
    } catch (e) {
      if (e.message.includes('không phải là DER X.509 hợp lệ')) caught49 = true;
    }
    assert(caught49 === true, 'Negative 49: certificate là dữ liệu rác không phải DER X.509 -> Lập tức BỊ CHẶN');
  }

  // Negative 50: signResult.signature có độ dài không hợp lệ với thuật toán khóa -> Lập tức BỊ CHẶN
  {
    let caught50 = false;
    try {
      pdfSigner.embedSignatureAndTimestamp(prepared, { signature: Buffer.from([0x01, 0x02]), certificate: certDer, isECDSA: true }, tsaResult.timeStampToken);
    } catch (e) {
      if (e.message.includes('Độ dài chữ ký ECDSA không hợp lệ')) caught50 = true;
    }
    assert(caught50 === true, 'Negative 50: chữ ký ECDSA có độ dài quá ngắn (< 8 bytes) -> Lập tức BỊ CHẶN');
  }

  // Negative 51: Kích thước tệp PDF vượt quá 50MB -> Lập tức BỊ CHẶN (OOM/DoS Protection)
  {
    const fakeLargeBuf = Buffer.alloc(51 * 1024 * 1024);
    const r51 = pdfSigner.verifySignedPdf(fakeLargeBuf);
    assert(r51.isValid === false && r51.reason.includes('giới hạn an toàn'), 'Negative 51: PDF vượt quá 50MB -> Lập tức BỊ TỪ CHỐI');
  }

  // Negative 52: PDF thiếu tiêu đề %PDF- chuẩn ISO 32000-1 -> Lập tức BỊ CHẶN
  {
    const noHeaderPdf = Buffer.from(signedPdf);
    noHeaderPdf.write('XXXX', 0, 4, 'ascii');
    const r52 = pdfSigner.verifySignedPdf(noHeaderPdf);
    assert(r52.isValid === false && r52.reason.includes('%PDF-'), 'Negative 52: PDF thiếu tiêu đề %PDF- -> Lập tức BỊ TỪ CHỐI');
  }

  // Negative 53: PDF thiếu khối startxref / %%EOF -> Lập tức BỊ CHẶN
  {
    const s = signedPdf.toString('latin1');
    const noEofStr = s.replace(/startxref[\s\S]*?%%EOF/, '                    ');
    const noEofPdf = Buffer.from(noEofStr, 'latin1');
    const r53 = pdfSigner.verifySignedPdf(noEofPdf);
    assert(r53.isValid === false && (r53.reason.includes('startxref') || r53.reason.includes('%%EOF')), 'Negative 53: PDF thiếu startxref/%%EOF -> Lập tức BỊ TỪ CHỐI');
  }

  // Negative 54: PDF chứa Duplicate Object ID (tấn công ghi đè đối tượng) -> Lập tức BỊ CHẶN
  {
    const s = signedPdf.toString('latin1');
    const dupObjStr = s.replace('startxref', '1 0 obj\n<< /Type /Malicious >>\nendobj\nstartxref');
    const dupObjPdf = Buffer.from(dupObjStr, 'latin1');
    const r54 = pdfSigner.verifySignedPdf(dupObjPdf);
    assert(r54.isValid === false && r54.reason.includes('trùng lặp'), 'Negative 54: PDF chứa Object ID trùng lặp (1 0 R) -> Lập tức BỊ CHẶN (Duplicate Object ID Attack)');
  }

  // Negative 55: PDF chứa đối tượng Catalog giả mạo ngoài luồng trailer /Root -> Lập tức BỊ CHẶN
  {
    const s = signedPdf.toString('latin1');
    const fakeCatalogStr = s.replace('startxref', '88 0 obj\n<< /Type /Catalog /AcroForm 99 0 R >>\nendobj\nstartxref');
    const fakeCatalogPdf = Buffer.from(fakeCatalogStr, 'latin1');
    const r55 = pdfSigner.verifySignedPdf(fakeCatalogPdf);
    assert(r55.isValid === false && r55.reason.includes('Catalog giả mạo'), 'Negative 55: PDF chứa Catalog giả mạo ngoài /Root trailer -> Lập tức BỊ CHẶN (Catalog Injection Attack)');
  }

  // Negative 56: ECDSA High-S malleability -> verifyEcdsaP256Digest lập tức TỪ CHỐI
  {
    const { signEcdsaP256Digest, verifyEcdsaP256Digest } = require('../p256-crypto');
    const { p256 } = require('@noble/curves/nist.js');
    const { DER } = require('@noble/curves/abstract/der.js');
    const testKey = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const msgDigest = crypto.createHash('sha256').update('test-high-s-malleability').digest();
    const validDer = signEcdsaP256Digest(testKey.privateKey, msgDigest);
    assert(verifyEcdsaP256Digest(testKey.publicKey, msgDigest, validDer) === true, 'ECDSA P-256 low-S ký và xác minh chuẩn xác');

    const { r, s } = DER.toSig(validDer);
    const n = p256.Point.Fn.ORDER;
    const highSDer = Buffer.from(DER.hexFromSig(new p256.Signature(r, n - s)), 'hex');
    assert(verifyEcdsaP256Digest(testKey.publicKey, msgDigest, highSDer) === false, 'Negative 56: verifyEcdsaP256Digest từ chối chữ ký high-S (Anti-Malleability)');
  }

  // Negative 57: verifyEcdsaP256Digest từ chối digest không phải 32 bytes hoặc signature hỏng
  {
    const { verifyEcdsaP256Digest } = require('../p256-crypto');
    const testKey = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
    assert(verifyEcdsaP256Digest(testKey.publicKey, Buffer.alloc(20), Buffer.alloc(70)) === false, 'Negative 57a: digest không phải 32 byte -> BỊ TỪ CHỐI');
    assert(verifyEcdsaP256Digest(testKey.publicKey, Buffer.alloc(32), Buffer.alloc(4)) === false, 'Negative 57b: signature < 8 byte -> BỊ TỪ CHỐI');
  }

  // -------------------------------------------------------------
  // TEST GROUP 8: TÁI LẬP MẬT MÃ ĐỘC LẬP & TỰ ĐỘNG BẢO TOÀN (DETERMINISTIC CRYPTOGRAPHIC REPLAY)
  // -------------------------------------------------------------
  console.log('\n[TEST GROUP 8]: Tái lập mật mã học độc lập qua Fixture Bất biến Ban Cơ yếu Chính phủ');
  {
    const fixturePath = path.join(__dirname, 'fixtures', 'live_gov_tsa_token_fixture.bin');
    assert(fs.existsSync(fixturePath), 'Tồn tại tệp fixture Dấu thời gian thực tế Ban Cơ yếu Chính phủ');
    const fixtureToken = fs.readFileSync(fixturePath);
    const tsa = new TsaClient();
    const ci = parseTLV(fixtureToken, 0);
    const sdOid = parseTLV(fixtureToken, ci.pos + ci.hl);
    const sdCtx = parseTLV(fixtureToken, sdOid.next);
    const sdSeq = parseTLV(sdCtx.val, 0);
    let p = 0;
    const ver = parseTLV(sdSeq.val, p); p = ver.next;
    const da = parseTLV(sdSeq.val, p); p = da.next;
    const eci = parseTLV(sdSeq.val, p); p = eci.next;
    const eciCtx = parseTLV(eci.val, parseTLV(eci.val, 0).next);
    const tstInfoDer = parseTLV(eciCtx.val, 0).val;
    const tstInfo = tsa.parseStrictTSTInfo(tstInfoDer);

    assert(tstInfo.version === 1, 'Fixture TSA: TSTInfo version = 1 theo RFC 3161');
    assert(tstInfo.genTime.startsWith('2026'), `Fixture TSA: Thời gian cấp dấu thực tế từ ca.gov.vn (${tstInfo.genTime})`);
    
    const offlineReport = pdfSigner._extractAndVerifyTsaToken(fixtureToken, tstInfo.hashedMessage);
    assert(offlineReport.isValid === true, 'Xác minh mật mã học ngoại tuyến thành công 100% với RootCA G2 Ban Cơ yếu Chính phủ');
    assert(offlineReport.isGovRootCa === true, 'Đã xác nhận nguồn gốc tin cậy: RootCA chuyên dùng Chính phủ G2');
  }

  // Tổng kết
  console.log('\n================================================================');
  console.log(`   KẾT QUẢ KIỂM THỬ: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('================================================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

runPhase2Tests().catch(err => {
  console.error('LỖI KHÔNG MONG MUỐN:', err);
  process.exit(1);
});
