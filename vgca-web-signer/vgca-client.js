/**
 * VGCA CLIENT MODULE (Core Gateway - Industrial Hardened v4.0)
 * Tuân thủ chuẩn ETSI TS 119 432 v2.0 & RFC 5753 ECDSA P-256
 */
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const { verifyEcdsaP256Digest } = require('./p256-crypto');
class VgcaClient {
  constructor(options = {}) {
    if (options === null || typeof options !== 'object' || Array.isArray(options)) {
      throw new TypeError('[CONFIG ERROR]: options phải là đối tượng hợp lệ.');
    }
    if (options.baseUrl !== undefined && typeof options.baseUrl !== 'string') {
      throw new TypeError('[CONFIG ERROR]: baseUrl phải là chuỗi ký tự hợp lệ.');
    }
    const rawBaseUrl = options.baseUrl ?? (process.env.VGCA_API_URL || 'http://127.0.0.1:8099');
    let parsedUrl;
    try {
      parsedUrl = new URL(rawBaseUrl);
    } catch (e) {
      throw new Error(`[CONFIG ERROR]: baseUrl '${rawBaseUrl}' không hợp lệ.`);
    }
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      throw new Error('[CONFIG ERROR]: baseUrl bắt buộc phải sử dụng giao thức http: hoặc https:.');
    }
    this.baseUrl = parsedUrl.origin;

    if (process.env.NODE_ENV === 'production' && !this.baseUrl.startsWith('https://')) {
      throw new Error('[SECURITY FATAL]: Production bắt buộc sử dụng HTTPS.');
    }

    if (options.timeoutMs !== undefined && (!Number.isInteger(options.timeoutMs) || options.timeoutMs <= 0)) {
      throw new TypeError('[CONFIG ERROR]: timeoutMs phải là số nguyên dương.');
    }
    this.timeoutMs = options.timeoutMs ?? 10000;
    this.profile = 'rssp-119.432-v2.0';
    this.relyingParty = 'vCSP';
    this.signAlgo = '1.2.840.10045.4.3.2'; // Khóa cứng ECDSA-with-SHA256
    this.clientInfo = options.clientInfo && typeof options.clientInfo === 'object' ? options.clientInfo : { macAddr: '04ED33E1F4A1' };
    this.MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
    this.credentialsCache = new Map();
  }

  _validateSha256Hash(hashBase64) {
    if (typeof hashBase64 !== 'string' || !hashBase64) {
      throw new Error('[VALIDATION ERROR]: Hash phải là chuỗi ký tự Base64 không rỗng.');
    }
    if (!/^[A-Za-z0-9+/]{43}=$/.test(hashBase64)) {
      throw new Error('[VALIDATION ERROR]: Mã băm không đúng định dạng Base64 chuẩn SHA-256.');
    }
    const decoded = Buffer.from(hashBase64, 'base64');
    if (decoded.length !== 32) {
      throw new Error('[VALIDATION ERROR]: Độ dài mã băm không đúng 32 bytes.');
    }
    if (decoded.toString('base64') !== hashBase64) {
      throw new Error('[VALIDATION ERROR]: Mã băm chứa ký tự không hợp lệ hoặc padding sai.');
    }
    return true;
  }
  _validateEcdsaDerSignature(sigBuffer, hashBuffer, publicKeyPem) {
    if (!Buffer.isBuffer(sigBuffer) || sigBuffer.length < 8 || sigBuffer.length > 128) {
      throw new TypeError('[SIGNATURE ERROR]: Buffer chữ ký quá ngắn, quá dài hoặc không hợp lệ.');
    }
    if (!Buffer.isBuffer(hashBuffer) || hashBuffer.length !== 32) {
      throw new TypeError('[SIGNATURE ERROR]: hashBuffer bắt buộc là Buffer 32 bytes SHA-256.');
    }
    if (typeof publicKeyPem !== 'string' || !publicKeyPem.includes('PUBLIC KEY')) {
      throw new TypeError('[SIGNATURE ERROR]: publicKeyPem bắt buộc là chuỗi PEM EC Public Key hợp lệ.');
    }
    if (sigBuffer[0] !== 0x30) throw new Error('[SIGNATURE ERROR]: Chữ ký không bắt đầu bằng ASN.1 SEQUENCE.');
    let seqLen = sigBuffer[1];
    let offset = 2;
    if (seqLen & 0x80) {
      const lenBytes = seqLen & 0x7f;
      if (lenBytes === 0 || lenBytes > 2 || offset + lenBytes > sigBuffer.length) {
        throw new Error('[SIGNATURE ERROR]: Chiều dài SEQUENCE ASN.1 không hợp lệ.');
      }
      if (sigBuffer[offset] === 0x00) throw new Error('[SIGNATURE ERROR]: SEQUENCE length non-canonical.');
      seqLen = sigBuffer.readUIntBE(offset, lenBytes);
      offset += lenBytes;
      if (seqLen < 128) throw new Error('[SIGNATURE ERROR]: SEQUENCE length dùng long-form sai.');
    }
    if (offset + seqLen !== sigBuffer.length) throw new Error('[SIGNATURE ERROR]: SEQUENCE length không khớp.');
    const P256_N = 0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551n;
    const P256_HALF_N = P256_N >> 1n;
    if (offset + 2 > sigBuffer.length || sigBuffer[offset] !== 0x02) throw new Error('[SIGNATURE ERROR]: Thiếu r INTEGER.');
    const rLen = sigBuffer[offset + 1];
    if (rLen <= 0 || rLen > 33 || offset + 2 + rLen > sigBuffer.length) throw new Error('[SIGNATURE ERROR]: Chiều dài r sai.');
    if ((sigBuffer[offset + 2] & 0x80) !== 0) throw new Error('[SIGNATURE ERROR]: r mang dấu âm.');
    if (rLen > 1 && sigBuffer[offset + 2] === 0x00 && (sigBuffer[offset + 3] & 0x80) === 0) throw new Error('[SIGNATURE ERROR]: r dư leading zero.');
    const r = BigInt('0x' + sigBuffer.subarray(offset + 2, offset + 2 + rLen).toString('hex'));
    if (r < 1n || r >= P256_N) throw new Error('[SIGNATURE ERROR]: r ngoài miền [1, n-1].');
    offset += 2 + rLen;
    if (offset + 2 > sigBuffer.length || sigBuffer[offset] !== 0x02) throw new Error('[SIGNATURE ERROR]: Thiếu s INTEGER.');
    const sLen = sigBuffer[offset + 1];
    if (sLen <= 0 || sLen > 33 || offset + 2 + sLen > sigBuffer.length) throw new Error('[SIGNATURE ERROR]: Chiều dài s sai.');
    if ((sigBuffer[offset + 2] & 0x80) !== 0) throw new Error('[SIGNATURE ERROR]: s mang dấu âm.');
    if (sLen > 1 && sigBuffer[offset + 2] === 0x00 && (sigBuffer[offset + 3] & 0x80) === 0) throw new Error('[SIGNATURE ERROR]: s dư leading zero.');
    const s = BigInt('0x' + sigBuffer.subarray(offset + 2, offset + 2 + sLen).toString('hex'));
    if (s < 1n || s > P256_HALF_N) throw new Error('[SIGNATURE ERROR]: s ngoài miền low-S [1, n/2].');
    offset += 2 + sLen;
    if (offset !== sigBuffer.length) throw new Error('[SIGNATURE ERROR]: Trailing bytes sau s.');
    const isVerified = verifyEcdsaP256Digest(publicKeyPem, hashBuffer, sigBuffer);
    if (!isVerified) throw new Error('[SIGNATURE ERROR]: Chữ ký số ECDSA không khớp với Public Key!');
    return true;
  }
  // ========================================================================
  // THẨM ĐỊNH MẬT MÃ HỌC CHỮ KÝ SỐ ECDSA P-256 (FIPS 186-4 & RFC 5753)
  // - Thẩm định cú pháp ASN.1 DER: SEQUENCE (0x30), r INTEGER (0x02), s INTEGER (0x02).
  // - Kiểm tra canonical DER: Không số âm, không leading zero, r in [1, n-1], s in [1, n/2].
  // - Chống tấn công ECDSA high-S malleability theo chuẩn RFC 6979 & FIPS 186-4 (s <= n/2).
  // - Triệt tiêu 100% trailing bytes và dữ liệu thừa sau thành phần s.
  // - Bắt buộc publicKeyPem hợp lệ và xác minh chữ ký toán học qua verifyEcdsaP256Digest.
  // ========================================================================
  // CONTRACT: _validateEcdsaDerSignature | Thẩm định ASN.1 DER ECDSA P-256; xác minh chữ ký.
  // CONTRACT: verifyEcdsaP256Digest | Ủy quyền kiểm tra toán học cho engine p256-crypto đã APPROVED.
  // CONTRACT: Anti-Malleability | Chỉ chấp nhận chữ ký canonical low-S (s <= n/2) theo RFC 6979.
  // CONTRACT: Zero-Trust Input | Kiểm tra độ dài, ASN.1 tags, không nuốt lỗi cú pháp.
  // Kết thúc lát cắt 2 (Dòng 61 - 120): Thẩm định hoàn tất _validateEcdsaDerSignature
  async requestLoginQr() {
    const payload = {
      action: 'LOGIN',
      clientInfo: this.clientInfo,
      format: 'png',
      height: 220,
      width: 220,
      lang: 'VN',
      profile: this.profile,
      relyingParty: this.relyingParty
    };
    const res = await this._post('/rssp/v2/loginQR_sendRequest', payload);
    if (!res || typeof res !== 'object') throw new Error('[SCHEMA ERROR]: Phản hồi VGCA không hợp lệ.');
    if (res.error !== 0) throw new Error(`[VGCA ERROR ${res.error}]: ${res.errorDescription || 'Khởi tạo QR thất bại'}`);
    if (typeof res.qrCode !== 'string' || !res.qrCode || typeof res.qrCodeUUID !== 'string' || !res.qrCodeUUID) {
      throw new Error('[SCHEMA ERROR]: Phản hồi thiếu chuỗi qrCode hoặc qrCodeUUID.');
    }
    if (typeof res.responseID !== 'string' || !res.responseID || !Number.isInteger(res.expiresIn) || res.expiresIn <= 0) {
      throw new Error('[SCHEMA ERROR]: Phản hồi thiếu responseID hoặc expiresIn không phải số nguyên dương.');
    }
    return { qrCodeBase64: res.qrCode, qrCodeUUID: res.qrCodeUUID, responseID: res.responseID, expiresIn: res.expiresIn };
  }
  async pollLoginStatus(qrCodeUUID, requestID) {
    if (typeof qrCodeUUID !== 'string' || !qrCodeUUID.trim() || typeof requestID !== 'string' || !requestID.trim()) {
      throw new Error('[VALIDATION ERROR]: qrCodeUUID và requestID bắt buộc là chuỗi ký tự không rỗng.');
    }
    if (!this.activePolls) this.activePolls = new Set();
    if (this.activePolls.has(qrCodeUUID)) throw new Error(`[CONCURRENCY CONFLICT]: Phiên polling '${qrCodeUUID}' đang xử lý.`);
    this.activePolls.add(qrCodeUUID);
    try {
      const payload = { lang: 'VN', profile: this.profile, qrCodeUUID, relyingParty: this.relyingParty, requestID };
      const res = await this._post('/rssp/v2/getResultBody', payload);
      if (!res || typeof res !== 'object') throw new Error('[SCHEMA ERROR]: Phản hồi polling không hợp lệ.');
      if (typeof res.responseID !== 'string' || res.responseID !== requestID) {
        throw new Error('[SECURITY CORRELATION ERROR]: responseID không khớp requestID.');
      }
      if (res.error === 3035) return { status: 'PENDING', error: 3035, description: res.errorDescription || 'Đang xử lý' };
      if (res.error !== 0) return { status: 'FAILED', error: res.error, description: res.errorDescription || 'Thất bại' };
      if (typeof res.accessToken !== 'string' || !res.accessToken || typeof res.refreshToken !== 'string' || !res.refreshToken) {
        throw new Error('[SCHEMA ERROR]: Phản hồi thiếu chuỗi accessToken hoặc refreshToken.');
      }
      if (!res.ownerInfo || typeof res.ownerInfo !== 'object' || typeof res.ownerInfo.fullName !== 'string' || !res.ownerInfo.fullName.trim()) {
        throw new Error('[SCHEMA ERROR]: Phản hồi thiếu ownerInfo hoặc fullName người dùng.');
      }
      if (!Number.isInteger(res.expiresIn) || res.expiresIn <= 0) throw new Error('[SCHEMA ERROR]: expiresIn không hợp lệ.');
      return { status: 'APPROVED', accessToken: res.accessToken, refreshToken: res.refreshToken, expiresIn: res.expiresIn, ownerInfo: res.ownerInfo };
    } finally {
      this.activePolls.delete(qrCodeUUID);
    }
  }
  // ========================================================================
  // GIAO THỨC ĐĂNG NHẬP VÀ XÁC THỰC MÃ QR ETSI TS 119 432 v2.0
  // - requestLoginQr: Khởi tạo phiên quét mã QR, validate schema chặt chẽ, expiresIn nguyên dương.
  // - pollLoginStatus: Thăm dò trạng thái mã QR, khóa chống race condition concurrency per-UUID.
  // - Correlation Check: Kiểm tra responseID khớp requestID ngay lập tức trước khi phân tích trạng thái.
  // - Quản lý token an toàn: Xác thực đầy đủ accessToken, refreshToken, expiresIn và ownerInfo.
  // ========================================================================
  // CONTRACT: requestLoginQr | Khởi tạo phiên QR ETSI TS 119 432, kiểm tra kiểu và thời hạn expiresIn.
  // CONTRACT: pollLoginStatus | Thăm dò trạng thái QR, đối chiếu correlation ID trước tiên, chống race condition.
  // Kết thúc lát cắt 3 (Dòng 121 - 180): Hoàn tất quy trình đăng nhập và xác thực QR
  async listCredentials(accessToken) {
    if (typeof accessToken !== 'string' || !accessToken.trim()) throw new Error('[AUTH ERROR]: accessToken là bắt buộc.');
    const curGen = (this._credGen = (this._credGen || 0) + 1);
    const payload = { lang: 'VN', profile: this.profile, searchConditions: { certificatePurpose: 'SIGNATURE', certificateStatus: 'GOOD' } };
    const res = await this._post('/rssp/v2/list', payload, { 'Authorization': `Bearer ${accessToken}` });
    if (!res || typeof res !== 'object' || !Array.isArray(res.certs)) throw new Error('[SCHEMA ERROR]: Phản hồi list không hợp lệ.');
    if (res.error !== 0) throw new Error(`[VGCA ERROR ${res.error}]: ${res.errorDescription || 'Lấy danh sách thất bại'}`);
    if (curGen !== this._credGen) throw new Error('[CONCURRENCY CONFLICT]: Yêu cầu danh sách bị hủy do có phiên mới hơn.');
    const stagedUpdates = [];
    for (const cert of res.certs) {
      if (!cert || typeof cert !== 'object' || typeof cert.credentialID !== 'string' || typeof cert.publicKeyPem !== 'string') continue;
      const st = cert.certificateStatus || cert.status || 'GOOD';
      if (st !== 'GOOD' && st !== 'OPERATED') continue;
      let key; try { key = crypto.createPublicKey(cert.publicKeyPem); } catch (e) { throw new Error(`[SCHEMA ERROR]: publicKeyPem không hợp lệ: ${cert.credentialID}`); }
      if (key.asymmetricKeyType === 'ec' ? key.asymmetricKeyDetails?.namedCurve !== 'prime256v1' : (key.asymmetricKeyType === 'rsa' ? (key.asymmetricKeyDetails?.modulusLength || 0) < 2048 : true)) throw new Error('[SCHEMA ERROR]: Chỉ hỗ trợ EC prime256v1 hoặc RSA >= 2048-bit.');
      stagedUpdates.push([cert.credentialID, { publicKeyPem: cert.publicKeyPem, status: st, keyType: key.asymmetricKeyType, cachedAt: Date.now() }]);
    }
    if (curGen !== this._credGen) throw new Error('[CONCURRENCY CONFLICT]: Yêu cầu danh sách bị hủy do có phiên mới hơn.');
    for (const [id, data] of stagedUpdates) this.credentialsCache.set(id, data);
    return res.certs;
  }
  getPublicKey(credentialID) {
    if (typeof credentialID !== 'string' || !credentialID.trim()) return null;
    const entry = this.credentialsCache.get(credentialID);
    if (!entry) return null;
    if (typeof entry === 'object' && entry !== null) return (entry.status === 'GOOD' || entry.status === 'OPERATED') && typeof entry.publicKeyPem === 'string' ? entry.publicKeyPem : null;
    return typeof entry === 'string' ? entry : null;
  }
  async authorize(accessToken, credentialID, hashBase64) {
    if (typeof accessToken !== 'string' || !accessToken.trim() || typeof credentialID !== 'string' || !credentialID.trim()) throw new Error('[AUTH ERROR]: accessToken và credentialID là bắt buộc.');
    this._validateSha256Hash(hashBase64);
    const cached = this.credentialsCache.get(credentialID);
    if (cached && typeof cached === 'object' && cached.status !== 'GOOD' && cached.status !== 'OPERATED') throw new Error(`[CREDENTIAL ERROR]: Trạng thái ${cached.status} không hợp lệ.`);
    const payload = { clientInfo: this.clientInfo, credentialID, documentDigests: { hashAlgorithmOID: '2.16.840.1.101.3.4.2.1', hashes: [hashBase64] }, lang: 'VN', message: 'Xác thực ký văn bản', messageCaption: 'CVA Web Signer', notificationMessage: 'Xác thực ký văn bản', numSignatures: 1, operationMode: 'S', profile: this.profile, rpName: JSON.stringify({ APP: 'CVA_KYSO_WEB', OS: 'Web Cloud' }), scaIdentity: 'CVAWebSigner', signAlgo: this.signAlgo, validityPeriod: 300, vcEnabled: true };
    const res = await this._post('/rssp/v2/authorize', payload, { 'Authorization': `Bearer ${accessToken}` });
    if (!res || typeof res !== 'object') throw new Error('[SCHEMA ERROR]: Phản hồi authorize không hợp lệ.');
    if (res.error !== 0) throw new Error(`[VGCA ERROR ${res.error}]: ${res.errorDescription || 'Ủy quyền ký số thất bại'}`);
    if (typeof res.authorizeID !== 'string' || !res.authorizeID.trim() || typeof res.responseID !== 'string' || !res.responseID.trim()) throw new Error('[SCHEMA ERROR]: authorizeID/responseID không hợp lệ.');
    if (!this.authTransactions) this.authTransactions = new Map();
    for (const [id, tx] of this.authTransactions) if (Date.now() >= tx.expiresAt) this.authTransactions.delete(id);
    this.authTransactions.set(res.authorizeID, { credentialID, hashBase64, status: 'PENDING', nonce: res.responseID, expiresAt: Date.now() + 300000 });
    return { authorizeID: res.authorizeID, responseID: res.responseID };
  }
  _consumeAuthorize(authorizeID, credentialID, hashBase64) {
    if (typeof authorizeID !== 'string' || !authorizeID.trim() || typeof credentialID !== 'string' || !credentialID.trim()) return { ok: false, status: 400, error: '[VALIDATION ERROR]: Tham số không hợp lệ.' };
    this._validateSha256Hash(hashBase64);
    if (!this.authTransactions || !this.authTransactions.has(authorizeID)) return { ok: false, status: 403, error: '[SECURITY REPLAY ERROR]: authorizeID không tồn tại hoặc đã được sử dụng.' };
    const tx = this.authTransactions.get(authorizeID);
    if (!tx || tx.status !== 'PENDING' || Date.now() >= tx.expiresAt || tx.credentialID !== credentialID) {
      return { ok: false, status: 403, error: '[SECURITY REPLAY ERROR]: authorizeID không hợp lệ, đã hết hạn hoặc đã được sử dụng.' };
    }
    if (tx.hashBase64 !== hashBase64) return { ok: false, status: 400, error: '[SECURITY ERROR 400]: Hash tài liệu ký không khớp hash ủy quyền.' };
    tx.status = 'CONSUMED'; this.authTransactions.delete(authorizeID); return { ok: true };
  }
  // CONTRACT: getPublicKey | Chỉ trả public key từ credential cache có trạng thái GOOD hoặc OPERATED.
  // CONTRACT: authorize | Validate token, credential ID, SHA-256 hash, dọn dẹp expired tx, gắn transaction nonce.
  // CONTRACT: _consumeAuthorize | Chỉ tiêu thụ transaction PENDING hợp lệ, kiểm tra credential/hash, xóa atomic.
  // CONTRACT: listCredentials | Validate EC/RSA public key, staging cache chống race condition qua generation check.
  // ========================================================================
  // Kết thúc lát cắt 4 (Dòng 181 - 240): Quản lý chứng thư số và ủy quyền ký số
  async signHash(accessToken, credentialID, hashBase64, options = {}) {
    if (!accessToken || typeof accessToken !== 'string') {
      throw new Error('[AUTH ERROR]: accessToken là bắt buộc khi signHash.');
    }
    if (!credentialID || typeof credentialID !== 'string') {
      throw new Error('[AUTH ERROR]: credentialID là bắt buộc khi signHash.');
    }
    this._validateSha256Hash(hashBase64);
    if (options !== null && typeof options !== 'object') throw new Error('[VALIDATION ERROR]: options phải là đối tượng hợp lệ.');
    let authId = options && options.authorizeID !== undefined ? options.authorizeID : null;
    if (authId !== null && (typeof authId !== 'string' || !authId.trim())) throw new Error('[VALIDATION ERROR]: authorizeID không hợp lệ.');
    if (!authId) {
      const authResult = await this.authorize(accessToken, credentialID, hashBase64);
      if (!authResult || typeof authResult !== 'object' || typeof authResult.authorizeID !== 'string' || !authResult.authorizeID.trim()) {
        throw new Error('[SCHEMA ERROR]: Không nhận được authorizeID hợp lệ từ authorize.');
      }
      authId = authResult.authorizeID;
    }
    const claim = this.authTransactions ? this.authTransactions.get(authId) : null;
    const authCheck = this._consumeAuthorize(authId, credentialID, hashBase64);
    if (!authCheck.ok) {
      const err = new Error(authCheck.error);
      err.status = authCheck.status; err.statusCode = authCheck.status; throw err;
    }
    const payload = {
      credentialID,
      authorizeID: authId,
      profile: this.profile,
      documentDigests: { hashAlgorithmOID: '2.16.840.1.101.3.4.2.1', hashes: [hashBase64] }
    };
    const headers = { 'Authorization': `Bearer ${accessToken}` };
    let res;
    try {
      res = await this._post('/rssp/v2/signHash', payload, headers);
    } catch (postErr) {
      if (claim && !postErr.statusCode && Date.now() < claim.expiresAt) {
        this.authTransactions.set(authId, claim);
      }
      throw postErr;
    }
    if (!res || typeof res !== 'object') throw new Error('[SCHEMA ERROR]: Phản hồi signHash không hợp lệ.');
    if (res.error !== 0) throw new Error(`[VGCA ERROR ${res.error}]: ${res.errorDescription || 'Ký băm thất bại'}`);
    if (!Array.isArray(res.signatures) || res.signatures.length === 0) throw new Error('[VGCA ERROR]: Không nhận được chữ ký số hợp lệ.');
    const signatureBase64 = res.signatures[0];
    if (typeof signatureBase64 !== 'string' || !signatureBase64.trim() || !/^[A-Za-z0-9+/]+={0,2}$/.test(signatureBase64)) {
      throw new Error('[SCHEMA ERROR]: Chữ ký signatureBase64 không đúng định dạng Base64.');
    }
    if (typeof res.responseID !== 'string' || !res.responseID.trim()) throw new Error('[SCHEMA ERROR]: responseID không hợp lệ từ máy chủ.');
    const sigBuffer = Buffer.from(signatureBase64, 'base64');
    const hashBuffer = Buffer.from(hashBase64, 'base64');
    const pubKey = this.getPublicKey(credentialID);
    if (!pubKey) throw new Error(`[SECURITY FATAL]: Không tìm thấy Public Key của CredentialID '${credentialID}'.`);
    this._validateEcdsaDerSignature(sigBuffer, hashBuffer, pubKey);
    return { signatureBase64, responseID: res.responseID };
  }
  // CONTRACT: signHash | Atomic compare-and-delete claim authorization trước network call, rollback có điều kiện.
  // CONTRACT: Anti-Tamper | Kiểm tra tính toàn vẹn chữ ký DER ECDSA P-256 khớp với Public Key chứng thư.
  // CONTRACT: Protocol-Safety | Validate response schema, responseID, Base64 signature, loại trừ TOCTOU race.
  // ========================================================================
  // Kết thúc lát cắt 5 (Dòng 241 - 300): Hoàn tất giao thức ký băm và thẩm định chữ ký
  _post(path, data, customHeaders = {}) {
    return new Promise((resolve, reject) => {
      if (typeof path !== 'string' || !path.startsWith('/') || path.includes('..')) {
        return reject(new Error('[SECURITY SSRF]: Yêu cầu path phải bắt đầu bằng / và không chứa ..'));
      }
      const targetUrl = new URL(path, this.baseUrl);
      if (targetUrl.origin !== this.baseUrl) {
        return reject(new Error('[SECURITY SSRF]: Yêu cầu path chuyển hướng sang origin khác không được phép.'));
      }
      const isHttps = targetUrl.protocol === 'https:';
      const transport = isHttps ? https : http;
      const bodyData = JSON.stringify(data);
      const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Accept': 'application/json', 'Content-Length': Buffer.byteLength(bodyData), ...customHeaders };
      const options = { hostname: targetUrl.hostname, port: targetUrl.port || (isHttps ? 443 : 80), path: targetUrl.pathname + targetUrl.search, method: 'POST', headers };
      let settled = false;
      const safeReject = (err) => { if (!settled) { settled = true; reject(err); } };
      const safeResolve = (val) => { if (!settled) { settled = true; resolve(val); } };
      const req = transport.request(options, (res) => {
        let responseBody = '';
        let bytesReceived = 0;
        res.on('data', chunk => {
          bytesReceived += chunk.length;
          if (bytesReceived > this.MAX_RESPONSE_BYTES) {
            req.destroy();
            safeReject(new Error('[SECURITY OVERFLOW]: Dung lượng phản hồi vượt quá giới hạn.'));
          } else responseBody += chunk;
        });
        res.on('end', () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            let errorMsg = `HTTP Error ${res.statusCode}`;
            try {
              const errJson = JSON.parse(responseBody);
              if (errJson && (errJson.message || errJson.errorDescription)) errorMsg = errJson.message || errJson.errorDescription;
            } catch (parseError) {
              errorMsg = 'Gateway returned invalid error JSON';
            }
            return safeReject(Object.assign(new Error(`[HTTP FAIL ${res.statusCode}]: ${errorMsg}`), { statusCode: res.statusCode }));
          }
          const contentType = res.headers['content-type'] || '';
          if (!contentType.includes('application/json')) {
            return safeReject(new Error(`[CONTENT-TYPE ERROR]: Kỳ vọng 'application/json' nhưng nhận được '${contentType}'`));
          }
          try {
            safeResolve(JSON.parse(responseBody));
          } catch (e) { safeReject(new Error('[PARSE ERROR]: Không thể giải mã dữ liệu JSON.')); }
        });
        res.on('error', safeReject);
      });
      req.setTimeout(this.timeoutMs, () => { req.destroy(); safeReject(new Error(`[TIMEOUT]: Yêu cầu tới ${path} vượt quá thời gian chờ ${this.timeoutMs}ms`)); });
      req.on('error', safeReject);
      req.write(bodyData);
      req.end();
    });
  }
}
module.exports = VgcaClient;
// CONTRACT: VgcaClient | Module kết nối VGCA Gateway đạt chuẩn công nghiệp v4.0.
// CONTRACT: _post | Gửi HTTP/HTTPS POST an toàn, chống SSRF, giới hạn 2MB payload, kiểm tra content-type JSON.
// ========================================================================
// Kết thúc lát cắt 6 (Dòng 301 - 360): Hoàn tất toàn bộ module VgcaClient đạt chuẩn công nghiệp v4.0
