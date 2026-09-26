/**
 * NIST P-256 (secp256r1) CRYPTO ENGINE - AUDITED INDUSTRIAL TIER 3 (v4.0)
 * Ký và xác minh prehashed 32-byte SHA-256 digest (FIPS 186-4 & RFC 5753)
 * Sử dụng @noble/curves (Cure53 audited, constant-time, RFC 6979, low-S)
 * Giới hạn: jwk.d là V8 string bất biến; privateBytes được zeroize bằng fill(0)
 */

const crypto = require('crypto');
const { p256 } = require('@noble/curves/nist.js');
const { DER } = require('@noble/curves/abstract/der.js');

function signEcdsaP256Digest(privateKey, digest32) {
  if (!Buffer.isBuffer(digest32) || digest32.length !== 32) {
    throw new TypeError('digest32 must be a 32-byte Buffer (prehashed via SHA-256)');
  }
  const privKeyObj = typeof privateKey === 'string' ? crypto.createPrivateKey(privateKey) : privateKey;
  if (!privKeyObj || privKeyObj.asymmetricKeyType !== 'ec') {
    throw new TypeError('privateKey must be an EC KeyObject or PEM');
  }
  const jwk = privKeyObj.export({ format: 'jwk' });
  if (jwk.crv !== 'P-256') throw new RangeError('privateKey curve must be P-256');
  if (typeof jwk.d !== 'string' || jwk.d.length === 0) {
    throw new TypeError('privateKey must contain EC private scalar');
  }
  const privateBytes = Buffer.from(jwk.d, 'base64url');
  if (privateBytes.length !== 32) throw new RangeError('privateKey scalar must be 32 bytes');
  try {
    const compactSig = p256.sign(digest32, privateBytes, { prehash: false, lowS: true });
    return Buffer.from(DER.hexFromSig(p256.Signature.fromBytes(compactSig)), 'hex');
  } finally {
    privateBytes.fill(0);
  }
}

function verifyEcdsaP256Digest(publicKey, digest32, derSig) {
  if (!Buffer.isBuffer(digest32) || digest32.length !== 32) return false;
  if (!Buffer.isBuffer(derSig) || derSig.length < 8) return false;
  try {
    const pubKeyObj = typeof publicKey === 'string' ? crypto.createPublicKey(publicKey) : publicKey;
    if (!pubKeyObj || pubKeyObj.asymmetricKeyType !== 'ec') return false;
    const jwk = pubKeyObj.export({ format: 'jwk' });
    if (jwk.crv !== 'P-256' || typeof jwk.x !== 'string' || typeof jwk.y !== 'string') return false;
    const pubBytes = Buffer.concat([
      Buffer.from([0x04]),
      Buffer.from(jwk.x, 'base64url'),
      Buffer.from(jwk.y, 'base64url')
    ]);
    const { r, s } = DER.toSig(derSig);
    const sig = new p256.Signature(r, s);
    if (sig.hasHighS()) return false;
    return p256.verify(sig.toBytes(), digest32, pubBytes, { prehash: false });
  } catch (err) {
    return false;
  }
}

// CONTRACT: verifyEcdsaP256Digest | Từ chối digest không dài 32 byte, khóa không phải P-256, chữ ký DER lỗi và chữ ký high-S; trả false khi xác minh thất bại.
// CONTRACT: replay, nonce, atomicity, rollback | Không thuộc primitive ký/xác minh; tầng giao thức hoặc giao dịch phải xử lý.
// CONTRACT: signEcdsaP256Digest | Ký prehashed 32-byte digest với P-256 key; zeroize privateBytes sau ký.
module.exports = { signEcdsaP256Digest, verifyEcdsaP256Digest };
