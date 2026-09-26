/**
 * VGCA MOCK SERVER (Simulator Mode - Industrial Hardened v4.0)
 * Tuân thủ chuẩn ETSI TS 119 432 v2.0 & RFC 5753 ECDSA
 */
'use strict';
const http = require('http');
const crypto = require('crypto');
class VgcamockServer {
  constructor(port = 8099) {
    if (!Number.isInteger(port) || port < 0 || port > 65535) {
      throw new RangeError(`Port không hợp lệ: ${port}. Cần là số nguyên từ 0 đến 65535.`);
    }
    this.port = port;
    this.server = null;
    this.isStopping = false;
    this.stopPromise = null;
    this.sessions = new Map();
    this.authorizations = new Map();
    this.tokens = new Map();
    this.MAX_BODY_SIZE = 1 * 1024 * 1024;
    // ponytail: KeyObject giả lập trong RAM; V8 không đảm bảo zeroization bộ nhớ tuyệt đối.
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    this.publicKey = publicKey;
    this.privateKey = privateKey;
    this.cleanupInterval = setInterval(() => this.cleanupExpired(), 15000);
  }
  stop() {
    if (this.stopPromise) return this.stopPromise;
    this.isStopping = true;
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);
    this.cleanupInterval = null;
    return (this.stopPromise = new Promise((resolve, reject) => {
      const finalizeCleanup = () => {
        this.server = null;
        this.privateKey = null;
        this.publicKey = null;
        this.sessions.clear();
        this.authorizations.clear();
        this.tokens.clear();
      };
      if (!this.server) {
        finalizeCleanup();
        resolve();
        return;
      }
      this.server.close((error) => {
        finalizeCleanup();
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    }));
  }
  // ==========================================================================
  // Cặp khóa ECDSA P-256 được lưu dưới dạng KeyObject để bảo vệ bộ nhớ tiến trình
  // Simulator không cung cấp vùng nhớ HSM; chỉ phục vụ kiểm thử và mô phỏng giao thức
  // ==========================================================================
  // Kết thúc lát cắt khởi tạo hạ tầng và quản lý tài nguyên server (Dòng 60)
  _extractBearerToken(req) {
    const auth = req && req.headers ? req.headers['authorization'] : null;
    if (typeof auth !== 'string' || !auth.startsWith('Bearer ')) return null;
    const token = auth.substring(7).trim();
    return token.length > 0 ? token : null;
  }

  cleanupExpired() {
    const now = Date.now();
    for (const [uuid, s] of this.sessions.entries()) {
      if (!s || !Number.isFinite(s.createdAt) || !Number.isFinite(s.expiresIn) || now >= s.createdAt + s.expiresIn * 1000) this.sessions.delete(uuid);
    }
    for (const [authId, a] of this.authorizations.entries()) {
      if (!a || !Number.isFinite(a.expiresAt) || now >= a.expiresAt) this.authorizations.delete(authId);
    }
    for (const [tok, m] of this.tokens.entries()) {
      if (!m || !Number.isFinite(m.expiresAt) || now >= m.expiresAt) this.tokens.delete(tok);
    }
  }

  _getValidToken(token) {
    if (typeof token !== 'string' || token.length < 16 || token.length > 256 || !/^[A-Za-z0-9_-]+$/.test(token)) return null;
    const meta = this.tokens.get(token);
    if (!meta || !Number.isFinite(meta.expiresAt) || Date.now() >= meta.expiresAt) {
      if (meta) this.tokens.delete(token);
      return null;
    }
    return meta;
  }

  start() {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => this.handleRequest(req, res));
      this.server.headersTimeout = 10000;
      this.server.requestTimeout = 10000;
      this.server.timeout = 10000;
      this.server.listen(this.port, '127.0.0.1', () => {
        resolve(`VGCA Mock Server running on http://127.0.0.1:${this.port}`);
      });
      this.server.on('error', reject);
    });
  }

  _checkCors(req, res) {
    const allowed = new Set(['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:8099', 'http://127.0.0.1:8099']);
    const origin = req.headers.origin;
    if (origin) {
      if (!allowed.has(origin)) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 403, errorDescription: 'CORS Origin Not Allowed' }));
        return false;
      }
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
    }
    return true;
  }
  // ==========================================================================
  // Kết thúc lát cắt quản lý phiên và cấu hình hạ tầng tại dòng 120
  async handleRequest(req, res) {
    if (this.isStopping) return res.writeHead(503).end(JSON.stringify({ error: 503, errorDescription: 'Shutting down' }));
    if (!this._checkCors(req, res)) return;
    if (req.method === 'OPTIONS') return res.writeHead(204).end();
    if (req.method !== 'POST') {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 405, errorDescription: 'Method Not Allowed. Only POST is supported.' }));
      return;
    }
    let body = '', bodySize = 0, exceeded = false;
    req.on('error', (err) => {
      if (!res.writableEnded) res.writeHead(400).end(JSON.stringify({ error: 400, errorDescription: 'Stream error' }));
    });
    res.on('error', (err) => { req.destroy(err); });
    req.on('data', chunk => {
      if (exceeded) return;
      bodySize += chunk.length;
      if (bodySize > this.MAX_BODY_SIZE) {
        exceeded = true;
        req.pause();
        res.writeHead(413, { 'Content-Type': 'application/json', 'Connection': 'close' });
        res.end(JSON.stringify({ error: 413, errorDescription: 'Payload Too Large' }));
        req.destroy();
      } else { body += chunk; }
    });
    req.on('end', async () => {
      if (exceeded || res.writableEnded) return;
      let parsed = {};
      try {
        if (body) {
          parsed = JSON.parse(body);
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 400, errorDescription: 'Invalid JSON object' }));
          }
        }
        await this.route(req, res, parsed);
      } catch (e) {
        if (!res.writableEnded) res.writeHead(500).end(JSON.stringify({ error: 500, errorDescription: 'Server Error' }));
      }
    });
  }
  async route(req, res, payload) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    if (typeof req.url !== 'string') return res.writeHead(400).end(JSON.stringify({ error: 400, errorDescription: 'Invalid URL' }));
    let pathname;
    try { pathname = new URL(req.url, `http://127.0.0.1:${this.port}`).pathname; }
    catch (e) { return res.writeHead(400).end(JSON.stringify({ error: 400, errorDescription: 'Malformed URL' })); }
    const token = this._extractBearerToken(req);
    // CONTRACT: route chỉ định tuyến tới handler chuyên trách, không xử lý khóa riêng hay mật mã.
    if (pathname === '/rssp/v2/loginQR_sendRequest') return this._handleLoginQr(res);
    if (pathname === '/rssp/v2/getResultBody') return this._handleGetResult(payload, res);
    if (pathname === '/rssp/v2/list') return this._handleList(token, res);
    if (pathname === '/rssp/v2/authorize') return this._handleAuthorize(payload, token, res);
    if (pathname === '/rssp/v2/signHash') return this._handleSignHash(payload, token, res);
    res.writeHead(404);
    res.end(JSON.stringify({ error: 404, message: `Endpoint '${pathname}' not found on VGCA Mock Server.` }));
  }
  // ==========================================================================
  // Kết thúc lát cắt điều hướng và định tuyến API tại dòng 180
  _handleLoginQr(res) {
    this.cleanupExpired();
    const qrUuid = 'RSS:' + crypto.randomUUID();
    const respId = 'vCSP-INIT-' + crypto.randomUUID();
    const expiresIn = 300, now = Date.now();
    this.sessions.set(qrUuid, {
      state: 'PENDING',
      createdAt: now,
      expiresIn: expiresIn,
      responseID: respId,
      pollCount: 0,
      used: false,
      ownerInfo: {
        fullName: 'Hà Văn Tý (Giả Lập)',
        email: 'hvty-dakha@quangngai.gov.vn',
        phone: '0818810007',
        oauth2: '{"FEDERATED_PROVIDER":{"value":"SIMULATED-VGCA"}}'
      }
    });
    res.writeHead(200);
    res.end(JSON.stringify({
      error: 0, errorDescription: 'THÀNH CÔNG', expiresIn: expiresIn,
      qrCode: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      qrCodeUUID: qrUuid, responseID: respId
    }));
  }
  _handleList(token, res) {
    const meta = this._getValidToken(token);
    if (!meta) {
      res.writeHead(401);
      return res.end(JSON.stringify({ error: 401, errorDescription: 'UNAUTHORIZED: Token không hợp lệ.' }));
    }
    if (!this.publicKey) {
      res.writeHead(500);
      return res.end(JSON.stringify({ error: 500, errorDescription: 'PUBLIC KEY NOT AVAILABLE' }));
    }
    let pubPem;
    try {
      pubPem = this.publicKey.export({ type: 'spki', format: 'pem' });
      if (typeof pubPem !== 'string' || !pubPem.includes('BEGIN PUBLIC KEY')) throw new Error('Invalid PEM');
    } catch (e) {
      res.writeHead(500);
      return res.end(JSON.stringify({ error: 500, errorDescription: 'EXPORT PUBLIC KEY ERROR' }));
    }
    res.writeHead(200);
    res.end(JSON.stringify({
      certs: [{
        authModeId: 2, certId: 7406893, credentialID: '260529092544817FvR4veDh9KAY68hxfS',
        remainingSigningCounter: -1, status: 'OPERATED', statusDesc: 'HOẠT ĐỘNG',
        version: 7, publicKeyPem: pubPem
      }],
      error: 0, errorDescription: 'THÀNH CÔNG', responseID: 'vCSP-LIST-' + crypto.randomUUID()
    }));
  }
  // ==========================================================================
  // Session được bảo vệ TTL 300s, tự động dọn dẹp bằng cleanupExpired() chống DoS
  // Trạng thái phiên QR bắt đầu từ PENDING, kiểm soát chống replay bằng used flag
  // Khóa công khai SPKI PEM được thẩm định nghiêm ngặt trước khi phản hồi người dùng
  // ==========================================================================
  // Kết thúc lát cắt cấp phát phiên và danh sách chứng thư số tại dòng 240
  _handleGetResult(payload, res) {
    if (!payload || typeof payload !== 'object') {
      res.writeHead(400);
      res.end(JSON.stringify({ error: 400, errorDescription: 'PAYLOAD KHÔNG HỢP LỆ' }));
      return;
    }
    const { qrCodeUUID, requestID } = payload;
    if (typeof qrCodeUUID !== 'string' || typeof requestID !== 'string') {
      res.writeHead(400);
      res.end(JSON.stringify({ error: 400, errorDescription: 'THIẾU QRCODEUUID HOẶC REQUESTID' }));
      return;
    }
    const session = this.sessions.get(qrCodeUUID);
    if (!session) {
      res.writeHead(404);
      res.end(JSON.stringify({ error: 404, errorDescription: 'KHÔNG TÌM THẤY PHIÊN QR' }));
      return;
    }
    if (session.responseID !== requestID) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: 400, errorDescription: 'REQUESTID KHÔNG KHỚP VỚI PHIÊN QR ĐÃ KHỞI TẠO' }));
      return;
    }
    const now = Date.now();
    if (!Number.isFinite(session.createdAt) || !Number.isFinite(session.expiresIn) || now > session.createdAt + session.expiresIn * 1000) {
      this.sessions.delete(qrCodeUUID);
      res.writeHead(410);
      res.end(JSON.stringify({ error: 410, errorDescription: 'PHIÊN QUÉT MÃ QR ĐÃ HẾT HẠN' }));
      return;
    }
    if (session.state === 'CONSUMED') {
      res.writeHead(409);
      res.end(JSON.stringify({ error: 409, errorDescription: 'PHIÊN NÀY ĐÃ ĐƯỢC TIÊU THỤ VÀ KẾT THÚC' }));
      return;
    }
    session.pollCount = (session.pollCount || 0) + 1;
    if (session.pollCount < 2) {
      res.writeHead(200);
      res.end(JSON.stringify({ error: 3035, errorDescription: 'YÊU CẦU ĐANG ĐƯỢC XỬ LÝ', responseID: session.responseID }));
      return;
    }
    session.state = 'CONSUMED';
    const mockToken = 'mock_vgca_tok_' + crypto.randomBytes(24).toString('hex');
    const mockRefreshToken = 'mock_vgca_ref_' + crypto.randomBytes(32).toString('hex');
    const tokenExpiresIn = 3600;
    this.tokens.set(mockToken, { expiresAt: now + tokenExpiresIn * 1000, ownerInfo: session.ownerInfo });
    res.writeHead(200);
    res.end(JSON.stringify({
      accessToken: mockToken,
      error: 0,
      errorDescription: 'THÀNH CÔNG',
      expiresIn: tokenExpiresIn,
      ownerInfo: session.ownerInfo,
      refreshExpiresIn: 86400,
      refreshToken: mockRefreshToken, responseID: session.responseID
    }));
  }
  /**
   * Bước 4: Xin cấp quyền ký gói băm (Authorize SignHash)
   */
  _handleAuthorize(payload, token, res) {
    try {
      if (typeof token !== 'string' || !token) return res.writeHead(401).end(JSON.stringify({ error: 401, errorDescription: 'UNAUTHORIZED: Thiếu Bearer token' }));
      const meta = this._getValidToken(token);
      if (!meta) return res.writeHead(401).end(JSON.stringify({ error: 401, errorDescription: 'UNAUTHORIZED: Token không hợp lệ' }));
      if (!payload || typeof payload !== 'object') return res.writeHead(400).end(JSON.stringify({ error: 400, errorDescription: 'INVALID PAYLOAD' }));
      const { credentialID, documentDigests, numSignatures } = payload;
      if (typeof credentialID !== 'string' || !credentialID) return res.writeHead(400).end(JSON.stringify({ error: 400, errorDescription: 'MISSING CREDENTIALID' }));
      if (!documentDigests || !Array.isArray(documentDigests.hashes) || documentDigests.hashes.length !== 1) return res.writeHead(400).end(JSON.stringify({ error: 400, errorDescription: 'EXACTLY 1 HASH REQUIRED' }));
      if (numSignatures !== undefined && numSignatures !== 1) return res.writeHead(400).end(JSON.stringify({ error: 400, errorDescription: 'NUMSIGNATURES MUST BE 1' }));
      const rawHash = documentDigests.hashes[0];
      let hashBuf = null;
      if (typeof rawHash === 'string') {
        if (/^[A-Za-z0-9+/]{43}=$/.test(rawHash)) hashBuf = Buffer.from(rawHash, 'base64');
        else if (/^[0-9a-fA-F]{64}$/.test(rawHash)) hashBuf = Buffer.from(rawHash, 'hex');
      }
      if (!hashBuf || hashBuf.length !== 32) return res.writeHead(400).end(JSON.stringify({ error: 400, errorDescription: 'INVALID SHA256' }));
      const now = Date.now();
      for (const [k, v] of this.authorizations.entries()) if (v && Number.isFinite(v.expiresAt) && now >= v.expiresAt) this.authorizations.delete(k);
      const authId = 'AUTH-' + crypto.randomUUID();
      const tokenHashBuf = crypto.createHash('sha256').update(token).digest();
      const authObj = { credentialID, hashBuf, rawHash, tokenHashBuf, expiresAt: now + 300000, used: false, timer: null };
      this.authorizations.set(authId, authObj);
      try {
        const timer = setTimeout(() => { this.authorizations.delete(authId); }, 300000);
        if (typeof timer.unref === 'function') timer.unref();
        authObj.timer = timer;
      } catch (timerErr) {
        this.authorizations.delete(authId);
        throw timerErr;
      }
      res.writeHead(200).end(JSON.stringify({ error: 0, errorDescription: 'THÀNH CÔNG', authorizeID: authId, responseID: 'vCSP-AUTH-' + crypto.randomUUID() }));
    } catch (err) {
      process.stderr.write(`[MOCK SERVER ERROR]: ${err && err.message ? err.message : 'Unknown'}\n`);
      if (!res.headersSent) res.writeHead(500).end(JSON.stringify({ error: 500, errorDescription: 'INTERNAL SERVER ERROR' }));
    }
  }
  _consumeAuthorization(authId, credentialID, token, targetHash) {
    if (typeof authId !== 'string' || !this.authorizations.has(authId)) return { ok: false, status: 403, error: 'GIAO DỊCH CHƯA ĐƯỢC ỦY QUYỀN' };
    const auth = this.authorizations.get(authId);
    if (!auth || auth.used) return { ok: false, status: 403, error: 'QUYỀN KÝ ĐÃ ĐƯỢC SỬ DỤNG' };
    auth.used = true;
    this.authorizations.delete(authId);
    if (auth.timer) { clearTimeout(auth.timer); auth.timer = null; }
    if (!Number.isFinite(auth.expiresAt) || Date.now() >= auth.expiresAt) return { ok: false, status: 403, error: 'QUYỀN KÝ ĐÃ HẾT HẠN' };
    if (auth.credentialID !== credentialID) { auth.used = false; this.authorizations.set(authId, auth); return { ok: false, status: 403, error: 'CREDENTIALID KHÔNG KHỚP' }; }
    if (typeof token !== 'string' || !token) { auth.used = false; this.authorizations.set(authId, auth); return { ok: false, status: 401, error: 'TOKEN KHÔNG HỢP LỆ' }; }
    const tokenHashBuf = crypto.createHash('sha256').update(token).digest();
    if (auth.tokenHashBuf.length !== tokenHashBuf.length || !crypto.timingSafeEqual(auth.tokenHashBuf, tokenHashBuf)) {
      auth.used = false; this.authorizations.set(authId, auth); return { ok: false, status: 403, error: 'TOKEN KHÔNG KHỚP' };
    }
    if (typeof targetHash !== 'string' || !targetHash) { auth.used = false; this.authorizations.set(authId, auth); return { ok: false, status: 400, error: 'INVALID SHA256' }; }
    let targetBuf = null;
    if (/^[A-Za-z0-9+/]{43}=$/.test(targetHash)) targetBuf = Buffer.from(targetHash, 'base64');
    else if (/^[0-9a-fA-F]{64}$/.test(targetHash)) targetBuf = Buffer.from(targetHash, 'hex');
    if (!targetBuf || targetBuf.length !== 32) { auth.used = false; this.authorizations.set(authId, auth); return { ok: false, status: 400, error: 'INVALID SHA256' }; }
    if (!crypto.timingSafeEqual(auth.hashBuf, targetBuf)) { auth.used = false; this.authorizations.set(authId, auth); return { ok: false, status: 400, error: 'HASH TÀI LIỆU KHÔNG KHỚP' }; }
    return { ok: true, auth };
  }
  // Kết thúc lát cắt cấp quyền giao dịch ký số tại dòng 360
  _handleSignHash(payload, token, res) {
    try {
      const { signEcdsaP256Digest, verifyEcdsaP256Digest } = require('./p256-crypto');
      if (typeof token !== 'string' || !token) return res.writeHead(401).end(JSON.stringify({ error: 401, errorDescription: 'UNAUTHORIZED: Thiếu Bearer token' }));
      const meta = this._getValidToken(token);
      if (!meta) return res.writeHead(401).end(JSON.stringify({ error: 401, errorDescription: 'UNAUTHORIZED: Token không hợp lệ' }));
      if (!payload || typeof payload !== 'object') return res.writeHead(400).end(JSON.stringify({ error: 400, errorDescription: 'PAYLOAD KHÔNG HỢP LỆ' }));
      const { credentialID, documentDigests, authorizeID } = payload;
      if (typeof credentialID !== 'string' || !credentialID) return res.writeHead(400).end(JSON.stringify({ error: 400, errorDescription: 'MISSING CREDENTIALID' }));
      if (typeof authorizeID !== 'string' || !authorizeID) return res.writeHead(400).end(JSON.stringify({ error: 400, errorDescription: 'MISSING AUTHORIZEID' }));
      if (!documentDigests || !Array.isArray(documentDigests.hashes) || documentDigests.hashes.length !== 1) {
        return res.writeHead(400).end(JSON.stringify({ error: 400, errorDescription: 'EXACTLY 1 HASH REQUIRED' }));
      }
      const targetHash = documentDigests.hashes[0];
      let hashBuf = null;
      if (typeof targetHash === 'string') {
        if (/^[A-Za-z0-9+/]{43}=$/.test(targetHash)) {
          const b = Buffer.from(targetHash, 'base64');
          if (b.toString('base64') === targetHash) hashBuf = b;
        } else if (/^[0-9a-fA-F]{64}$/.test(targetHash)) hashBuf = Buffer.from(targetHash, 'hex');
      }
      if (!hashBuf || hashBuf.length !== 32) return res.writeHead(400).end(JSON.stringify({ error: 400, errorDescription: 'INVALID CANONICAL SHA256' }));
      if (!this.privateKey || this.privateKey.asymmetricKeyType !== 'ec' || this.privateKey.asymmetricKeyDetails?.namedCurve !== 'prime256v1') {
        return res.writeHead(500).end(JSON.stringify({ error: 500, errorDescription: 'MOCK SERVER KHÓA ECDSA P-256 KHÔNG KHẢ DỤNG' }));
      }
      const consumed = this._consumeAuthorization(authorizeID, credentialID, token, targetHash);
      if (!consumed.ok) return res.writeHead(consumed.status).end(JSON.stringify({ error: consumed.status, errorDescription: consumed.error }));
      let realEcdsaDerSignature;
      try {
        realEcdsaDerSignature = signEcdsaP256Digest(this.privateKey, hashBuf);
        if (!Buffer.isBuffer(realEcdsaDerSignature) || realEcdsaDerSignature.length < 8) throw new Error('MALFORMED DER SIGNATURE');
        if (!verifyEcdsaP256Digest(this.publicKey, hashBuf, realEcdsaDerSignature)) throw new Error('SIGNATURE VERIFICATION FAILED');
      } catch (signErr) {
        consumed.auth.used = false;
        this.authorizations.set(authorizeID, consumed.auth);
        process.stderr.write(`[MOCK SERVER SIGN ERROR]: ${signErr && signErr.message ? signErr.message : 'Sign failed'}\n`);
        return res.writeHead(500).end(JSON.stringify({ error: 500, errorDescription: 'LỖI MẬT MÃ KHI KÝ DỮ LIỆU' }));
      }
      res.writeHead(200).end(JSON.stringify({
        signatures: [realEcdsaDerSignature.toString('base64')],
        remainingSigningCounter: -1,
        error: 0,
        errorDescription: 'THÀNH CÔNG',
        responseID: 'vCSP-SIGN-' + crypto.randomUUID()
      }));
    } catch (err) {
      process.stderr.write(`[MOCK SERVER ERROR]: ${err && err.message ? err.message : 'Unknown'}\n`);
      if (!res.headersSent) res.writeHead(500).end(JSON.stringify({ error: 500, errorDescription: 'INTERNAL SERVER ERROR' }));
    }
  }
}
// ==========================================================================
// CONTRACT: ETSI TS 119 432 v2.0 SignHash (Pure Mathematical P-256 Engine)
// Giao thức: Nhận prehashed SHA-256 digest 32 bytes (Canonical Base64/Hex)
// Ký trực tiếp 32-byte prehashed SHA-256 digest bằng thuật toán NIST P-256
// Triệt tiêu 100% rủi ro băm kép (Zero Double-Hashing) - Chuẩn RFC 5753 & FIPS
// Tự động kiểm chứng toán học qua verifyEcdsaP256Digest trước khi trả lời client
// Rollback trạng thái ủy quyền và giải phóng tài nguyên nếu xảy ra ngoại lệ
// ==========================================================================
// Kết thúc lát cắt xử lý ký số dữ liệu tại dòng 420
module.exports = VgcamockServer;

if (require.main === module) {
  const server = new VgcamockServer(8099);
  server.start().then(msg => console.log(msg));
}
