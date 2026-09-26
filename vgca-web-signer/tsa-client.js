/**
 * VGCA TSA CLIENT (RFC 3161 Time Stamping Authority Module)
 * Kết nối & Xác thực Con Dấu Thời Gian Điện Tử Ban Cơ yếu Chính phủ
 * Tuân thủ: RFC 3161, ETSI EN 319 422, ETSI EN 319 142 (PAdES-B-T), Nghị định 30/2020/NĐ-CP
 */
const http = require('http');
const https = require('https');
const crypto = require('crypto');

// ASN.1 DER Parser & Boundary-checked Helpers (Strict Canonical DER)
function parseTLV(buf, p = 0) {
  if (!Buffer.isBuffer(buf) || !Number.isSafeInteger(p) || p < 0 || p + 2 > buf.length) {
    return null;
  }
  const tag = buf[p];
  let len = buf[p + 1];
  let hl = 2;
  if (len & 0x80) {
    const n = len & 0x7f;
    if (n === 0 || n > 4 || p + 2 + n > buf.length) return null;
    if (buf[p + 2] === 0x00) return null;
    len = 0;
    for (let i = 0; i < n; i++) len = len * 256 + buf[p + 2 + i];
    if (len < 128) return null;
    hl = 2 + n;
  }
  const next = p + hl + len;
  if (len < 0 || next > buf.length) return null;
  return { tag, len, hl, pos: p, next, val: buf.subarray(p + hl, next) };
}
function encodeLength(len) {
  if (typeof len !== 'number' || !Number.isSafeInteger(len) || len < 0) {
    throw new Error(`Độ dài DER không hợp lệ: ${len}`);
  }
  if (len < 128) return Buffer.from([len]);
  if (len < 256) return Buffer.from([0x81, len]);
  if (len < 65536) return Buffer.from([0x82, (len >> 8) & 0xff, len & 0xff]);
  if (len <= 0xffffff) return Buffer.from([0x83, (len >> 16) & 0xff, (len >> 8) & 0xff, len & 0xff]);
  if (len <= 0xffffffff) return Buffer.from([0x84, (len >>> 24) & 0xff, (len >>> 16) & 0xff, (len >>> 8) & 0xff, len & 0xff]);
  throw new Error(`Độ dài DER vượt quá giới hạn 4GB: ${len}`);
}
function encodeTLV(tag, val) {
  if (!Number.isInteger(tag) || tag < 0 || tag > 0xff) {
    throw new TypeError(`Tag DER không hợp lệ: ${tag}`);
  }
  if (!Buffer.isBuffer(val) && !(val instanceof Uint8Array)) {
    throw new TypeError('Giá trị DER phải là Buffer hoặc Uint8Array');
  }
  const vBuf = Buffer.isBuffer(val) ? val : Buffer.from(val);
  return Buffer.concat([Buffer.from([tag]), encodeLength(vBuf.length), vBuf]);
}
function encodeSeq(items) {
  return encodeTLV(0x30, Buffer.concat(items));
}
// CONTRACT: parseTLV | Phân tích cú pháp ASN.1 TLV chuẩn canonical DER an toàn biên bộ nhớ.
// CONTRACT: encodeLength | Mã hóa độ dài DER canonical giới hạn an toàn 4GB.
// CONTRACT: encodeTLV | Đóng gói TLV chuẩn ASN.1 DER xác thực chặt chẽ tag 0..255 và buffer value.
// CONTRACT: encodeSeq | Đóng gói ASN.1 SEQUENCE (tag 0x30) từ mảng các thành phần DER.
// ========================================================================
// Kết thúc lát cắt 1 (Dòng 1 - 60): Các hàm phân tích và đóng gói ASN.1 DER cơ sở
function encodeSet(items) {
  if (!Array.isArray(items)) throw new TypeError('items phải là mảng Buffer');
  for (const item of items) if (!Buffer.isBuffer(item)) throw new TypeError('Mỗi phần tử trong SET phải là Buffer');
  return encodeTLV(0x31, Buffer.concat([...items].sort(Buffer.compare)));
}
function encodeOctetString(buf) {
  if (!Buffer.isBuffer(buf) && !(buf instanceof Uint8Array)) throw new TypeError('Giá trị OCTET STRING phải là Buffer hoặc Uint8Array');
  return encodeTLV(0x04, Buffer.isBuffer(buf) ? buf : Buffer.from(buf));
}
function encodeOID(hex) {
  if (typeof hex !== 'string' || hex.length === 0 || hex.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(hex)) {
    throw new TypeError(`Chuỗi OID hex không hợp lệ: ${hex}`);
  }
  const buf = Buffer.from(hex, 'hex');
  if (buf.length === 0 || (buf[buf.length - 1] & 0x80) !== 0) throw new TypeError(`OID DER content không hợp lệ: ${hex}`);
  let isStart = true;
  for (let i = 0; i < buf.length; i++) {
    if (isStart && buf[i] === 0x80) throw new TypeError(`OID DER chứa non-canonical leading zero 0x80: ${hex}`);
    isStart = (buf[i] & 0x80) === 0;
  }
  return encodeTLV(0x06, buf);
}
function encodeCanonicalInteger(value) {
  let buf;
  if (typeof value === 'bigint') {
    if (value < 0n) throw new RangeError('INTEGER không được âm');
    let hex = value.toString(16); if (hex.length % 2 !== 0) hex = '0' + hex;
    buf = Buffer.from(hex || '00', 'hex');
  } else if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value < 0) throw new RangeError('Số nguyên không hợp lệ hoặc âm');
    let hex = Math.trunc(value).toString(16); if (hex.length % 2 !== 0) hex = '0' + hex;
    buf = Buffer.from(hex || '00', 'hex');
  } else if (Buffer.isBuffer(value)) {
    buf = value.length === 0 ? Buffer.from([0x00]) : Buffer.from(value);
  } else {
    throw new TypeError('Kiểu INTEGER không hợp lệ');
  }
  let start = 0;
  while (start < buf.length - 1 && buf[start] === 0x00) start++;
  let body = buf.subarray(start);
  if (body.length === 0) body = Buffer.from([0x00]);
  if (body[0] & 0x80) body = Buffer.concat([Buffer.from([0x00]), body]);
  return encodeTLV(0x02, body);
}
function encodeUTCTime(date = new Date()) {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) {
    throw new TypeError('Giá trị UTCTime không hợp lệ (phải là Date hợp lệ)');
  }
  const year = date.getUTCFullYear();
  if (year < 1950 || year > 2049) throw new RangeError(`Năm UTCTime phải nằm trong khoảng 1950..2049: ${year}`);
  function pad(n) { return String(n).padStart(2, '0'); }
  const str = String(year).slice(2) + pad(date.getUTCMonth() + 1) + pad(date.getUTCDate()) + pad(date.getUTCHours()) + pad(date.getUTCMinutes()) + pad(date.getUTCSeconds()) + 'Z';
  return encodeTLV(0x17, Buffer.from(str, 'ascii'));
}
// CONTRACT: encodeSet | Đóng gói SET OF tag 0x31 sắp xếp lexicographical DER canonical.
// CONTRACT: encodeOctetString | Đóng gói OCTET STRING tag 0x04 với Buffer/Uint8Array an toàn.
// CONTRACT: encodeOID | Đóng gói OBJECT IDENTIFIER tag 0x06 với kiểm tra hex chẵn và canonical DER.
// CONTRACT: encodeCanonicalInteger | Mã hóa DER INTEGER canonical chống âm và loại bỏ zero dư thừa.
// CONTRACT: encodeUTCTime | Mã hóa UTCTime tag 0x17 chuẩn RFC 5280 trong cửa sổ 1950..2049.
// Kết thúc lát cắt 2 (Dòng 61 - 120): Các hàm đóng gói kiểu dữ liệu ASN.1 DER nâng cao
function extractIssuerAndSerialFromCert(certDer) {
  if (!Buffer.isBuffer(certDer)) return null;
  const certTLV = parseTLV(certDer, 0);
  if (!certTLV || certTLV.tag !== 0x30 || certTLV.next !== certDer.length) return null;
  const tbsCert = parseTLV(certTLV.val, 0);
  if (!tbsCert || tbsCert.tag !== 0x30) return null;
  const oSigAlg = parseTLV(certTLV.val, tbsCert.next);
  if (!oSigAlg || oSigAlg.tag !== 0x30) return null;
  const oSigVal = parseTLV(certTLV.val, oSigAlg.next);
  if (!oSigVal || oSigVal.tag !== 0x03 || oSigVal.next !== certTLV.val.length) return null;
  let p = 0;
  const first = parseTLV(tbsCert.val, p);
  if (!first) return null;
  let sn;
  if (first.tag === 0xa0) {
    const verTLV = parseTLV(first.val, 0);
    if (!verTLV || verTLV.tag !== 0x02 || verTLV.next !== first.val.length) return null;
    p = first.next;
    sn = parseTLV(tbsCert.val, p);
  } else if (first.tag === 0x02) {
    sn = first;
  } else {
    return null;
  }
  if (!sn || sn.tag !== 0x02 || sn.val.length === 0 || (sn.val[0] & 0x80) !== 0) return null;
  if (sn.val.length > 1 && sn.val[0] === 0x00 && (sn.val[1] & 0x80) === 0) return null;
  p = sn.next;
  const sigAlg = parseTLV(tbsCert.val, p);
  if (!sigAlg || sigAlg.tag !== 0x30) return null;
  p = sigAlg.next;
  const issuer = parseTLV(tbsCert.val, p);
  if (!issuer || issuer.tag !== 0x30) return null;
  return { issuerDer: tbsCert.val.subarray(issuer.pos, issuer.next), serialDer: sn.val };
}
// CONTRACT: extractIssuerAndSerialFromCert | Trích xuất issuerDer và serialDer chuẩn RFC 5280 từ X.509 Certificate đầy đủ 3 thành phần.
function parseBasicConstraintsFromDer(rawDer) {
  try {
    if (!rawDer || !Buffer.isBuffer(rawDer)) return { isCA: false, pathLenConstraint: undefined };
    const certSeq = parseTLV(rawDer, 0);
    if (!certSeq || certSeq.tag !== 0x30 || certSeq.next !== rawDer.length) {
      return { isCA: false, pathLenConstraint: undefined };
    }
    const tbsCert = parseTLV(certSeq.val, 0);
    if (!tbsCert || tbsCert.tag !== 0x30) return { isCA: false, pathLenConstraint: undefined };
    let p = 0;
    let extensionsTLV = null;
    while (p < tbsCert.val.length) {
      const item = parseTLV(tbsCert.val, p);
      if (!item) break;
      if (item.tag === 0xa3) { extensionsTLV = item; break; }
      p = item.next;
    }
    if (!extensionsTLV) return { isCA: false, pathLenConstraint: undefined };
    const extsSeq = parseTLV(extensionsTLV.val, 0);
    if (!extsSeq || extsSeq.tag !== 0x30 || extsSeq.next !== extensionsTLV.val.length) {
      return { isCA: false, pathLenConstraint: undefined };
    }
// ========================================================================
// CONTRACT: parseBasicConstraintsFromDer | Trích xuất BasicConstraints (2.5.29.19) RFC 5280 từ DER Certificate.
// Kết thúc lát cắt 3 (Dòng 121 - 180): Trích xuất Issuer/Serial và khởi tạo phân tích BasicConstraints
    let ep = 0;
    while (ep < extsSeq.val.length) {
      const ext = parseTLV(extsSeq.val, ep);
      if (!ext || ext.tag !== 0x30) break;
      let itemP = 0;
      const oid = parseTLV(ext.val, itemP);
      if (oid && oid.tag === 0x06) {
        itemP = oid.next;
        let nextTLV = parseTLV(ext.val, itemP);
        if (nextTLV && nextTLV.tag === 0x01) {
          if (nextTLV.len !== 1 || (nextTLV.val[0] !== 0x00 && nextTLV.val[0] !== 0xff)) return { isCA: false, pathLenConstraint: undefined };
          itemP = nextTLV.next;
          nextTLV = parseTLV(ext.val, itemP);
        }
        if (nextTLV && nextTLV.tag === 0x04 && nextTLV.next === ext.val.length) {
          if (oid.val.equals(Buffer.from('551d13', 'hex'))) {
            const bcSeq = parseTLV(nextTLV.val, 0);
            if (!bcSeq || bcSeq.tag !== 0x30 || bcSeq.next !== nextTLV.val.length) {
              return { isCA: false, pathLenConstraint: undefined };
            }
            let isCA = false;
            let pathLenConstraint = undefined;
            let bp = 0;
            if (bp < bcSeq.val.length) {
              const first = parseTLV(bcSeq.val, bp);
              if (!first || first.tag !== 0x01) return { isCA: false, pathLenConstraint: undefined };
              bp = first.next;
              if (first.len !== 1 || (first.val[0] !== 0x00 && first.val[0] !== 0xff)) return { isCA: false, pathLenConstraint: undefined };
              isCA = first.val[0] === 0xff;
              if (bp < bcSeq.val.length) {
                const second = parseTLV(bcSeq.val, bp);
                if (!second || second.tag !== 0x02) return { isCA: false, pathLenConstraint: undefined };
                bp = second.next;
                if (!isCA) return { isCA: false, pathLenConstraint: undefined };
                if (second.len === 0 || second.len > 4 || (second.val[0] & 0x80) !== 0) {
                  return { isCA: false, pathLenConstraint: undefined };
                }
                if (second.len > 1 && second.val[0] === 0x00 && (second.val[1] & 0x80) === 0) {
                  return { isCA: false, pathLenConstraint: undefined };
                }
                let val = 0;
                for (let i = 0; i < second.val.length; i++) val = val * 256 + second.val[i];
                pathLenConstraint = val;
              }
            }
            if (bp !== bcSeq.val.length) return { isCA: false, pathLenConstraint: undefined };
            return { isCA, pathLenConstraint };
          }
        }
      }
      ep = ext.next;
    }
    return { isCA: false, pathLenConstraint: undefined };
  } catch (_) {
    return { isCA: false, pathLenConstraint: undefined };
  }
}
// CONTRACT: parseBasicConstraintsFromDer | Phân tích BasicConstraints RFC 5280: cA BOOLEAN canonical, chỉ chấp nhận pathLenConstraint khi cA là TRUE.
// ========================================================================
// Kết thúc lát cắt 4 (Dòng 181 - 240): Hoàn tất phân tích BasicConstraints (2.5.29.19)
// CONTRACT: parseKeyUsageFromDer | Trích xuất KeyUsage RFC 5280 từ X.509 Certificate 3 phần tử (tbsCert, sigAlg, sigVal). Xác thực canonical DER, trả MALFORMED khi lỗi cấu trúc.
function parseKeyUsageFromDer(rawDer) {
  try {
    if (!rawDer || !Buffer.isBuffer(rawDer)) return { status: 'ABSENT', hasKeyUsage: false, keyCertSign: false };
    const certSeq = parseTLV(rawDer, 0);
    if (!certSeq || certSeq.tag !== 0x30 || certSeq.next !== rawDer.length) return { status: 'MALFORMED', hasKeyUsage: false, keyCertSign: false, reason: 'Cert not valid DER sequence or has trailing bytes' };
    const tbsCert = parseTLV(certSeq.val, 0);
    if (!tbsCert || tbsCert.tag !== 0x30) return { status: 'MALFORMED', hasKeyUsage: false, keyCertSign: false, reason: 'tbsCertificate not SEQUENCE' };
    const sigAlg = parseTLV(certSeq.val, tbsCert.next);
    if (!sigAlg || sigAlg.tag !== 0x30) return { status: 'MALFORMED', hasKeyUsage: false, keyCertSign: false, reason: 'signatureAlgorithm not SEQUENCE' };
    const sigVal = parseTLV(certSeq.val, sigAlg.next);
    if (!sigVal || sigVal.tag !== 0x03 || sigVal.next !== certSeq.val.length) return { status: 'MALFORMED', hasKeyUsage: false, keyCertSign: false, reason: 'signatureValue not BIT STRING or trailing bytes' };
    let p = 0, extensionsTLV = null;
    while (p < tbsCert.val.length) {
      const item = parseTLV(tbsCert.val, p);
      if (!item) return { status: 'MALFORMED', hasKeyUsage: false, keyCertSign: false, reason: 'Invalid TLV in tbsCertificate' };
      if (item.tag === 0xa3) { extensionsTLV = item; break; }
      p = item.next;
    }
    if (!extensionsTLV) return { status: 'ABSENT', hasKeyUsage: false, keyCertSign: false };
    const extsSeq = parseTLV(extensionsTLV.val, 0);
    if (!extsSeq || extsSeq.tag !== 0x30 || extsSeq.next !== extensionsTLV.val.length) return { status: 'MALFORMED', hasKeyUsage: false, keyCertSign: false, reason: 'Extensions not valid SEQUENCE or trailing bytes' };
    let ep = 0, foundKu = null;
    while (ep < extsSeq.val.length) {
      const ext = parseTLV(extsSeq.val, ep);
      if (!ext || ext.tag !== 0x30) return { status: 'MALFORMED', hasKeyUsage: false, keyCertSign: false, reason: 'Extension not SEQUENCE' };
      const oid = parseTLV(ext.val, 0);
      if (!oid || oid.tag !== 0x06) return { status: 'MALFORMED', hasKeyUsage: false, keyCertSign: false, reason: 'extnID not OID' };
      let itemP = oid.next, nextTLV = parseTLV(ext.val, itemP);
      if (!nextTLV) return { status: 'MALFORMED', hasKeyUsage: false, keyCertSign: false, reason: 'Truncated extension after OID' };
      if (nextTLV.tag === 0x01) {
        if (nextTLV.len !== 1 || (nextTLV.val[0] !== 0x00 && nextTLV.val[0] !== 0xff)) return { status: 'MALFORMED', hasKeyUsage: false, keyCertSign: false, reason: 'Non-canonical critical BOOLEAN' };
        itemP = nextTLV.next; nextTLV = parseTLV(ext.val, itemP);
        if (!nextTLV) return { status: 'MALFORMED', hasKeyUsage: false, keyCertSign: false, reason: 'Truncated extension after critical' };
      }
      if (nextTLV.tag !== 0x04 || nextTLV.next !== ext.val.length) return { status: 'MALFORMED', hasKeyUsage: false, keyCertSign: false, reason: 'extnValue not OCTET STRING or trailing bytes' };
      if (oid.val.equals(Buffer.from('551d0f', 'hex'))) { // 2.5.29.15
        if (foundKu !== null) return { status: 'MALFORMED', hasKeyUsage: false, keyCertSign: false, reason: 'Duplicate KeyUsage extension' };
        const bitString = parseTLV(nextTLV.val, 0);
        if (!bitString || bitString.tag !== 0x03 || bitString.next !== nextTLV.val.length) return { status: 'MALFORMED', hasKeyUsage: false, keyCertSign: false, reason: 'KeyUsage BIT STRING malformed' };
        const unusedBits = bitString.val[0];
        if (unusedBits > 7 || bitString.val.length < 2 || bitString.val.length > 3) return { status: 'MALFORMED', hasKeyUsage: false, keyCertSign: false, reason: 'Invalid KeyUsage size' };
        if (unusedBits && (bitString.val[bitString.val.length - 1] & ((1 << unusedBits) - 1))) return { status: 'MALFORMED', hasKeyUsage: false, keyCertSign: false, reason: 'Unused bits not zero' };
        if (bitString.val.length === 3 && (bitString.val[2] & 0x7f)) return { status: 'MALFORMED', hasKeyUsage: false, keyCertSign: false, reason: 'KeyUsage exceeds 9 bits' };
        if (bitString.val.length === 3 && bitString.val[2] === 0) return { status: 'MALFORMED', hasKeyUsage: false, keyCertSign: false, reason: 'Trailing zero octet' };
        if (bitString.val[1] === 0 && (bitString.val.length === 2 || bitString.val[2] === 0)) return { status: 'MALFORMED', hasKeyUsage: false, keyCertSign: false, reason: 'Empty KeyUsage' };
        foundKu = { status: 'VALID', hasKeyUsage: true, keyCertSign: (bitString.val[1] & 0x04) !== 0, rawByte: bitString.val[1] };
      }
      ep = ext.next;
    }
    return foundKu || { status: 'ABSENT', hasKeyUsage: false, keyCertSign: false };
  } catch (_) { return { status: 'MALFORMED', hasKeyUsage: false, keyCertSign: false, reason: 'Exception in parseKeyUsageFromDer' }; }
}
/**
 * Kiểm tra ExtendedKeyUsage id-kp-timeStamping (1.3.6.1.5.5.7.3.8) theo RFC 3161
 * Bắt buộc parse cấu trúc chuẩn ASN.1 DER với kiểm tra biên triệt để
 * Certificate phải có cấu trúc 3 phần tử X.509 hợp lệ, không chứa trailing bytes.
 */
// CONTRACT: parseKeyUsageFromDer | Hoàn tất phân tích KeyUsage (2.5.29.15) RFC 5280 Section 4.2.1.3 an toàn.
// Kết thúc lát cắt 5 (Dòng 241 - 300): Hoàn tất phân tích KeyUsage (2.5.29.15)
function hasTimeStampingEKU(x509Cert) {
  try {
    const rawDer = x509Cert.raw;
    if (!rawDer || !Buffer.isBuffer(rawDer)) return false;
    const certSeq = parseTLV(rawDer, 0);
    if (!certSeq || certSeq.tag !== 0x30 || certSeq.next !== rawDer.length) return false;
    const tbsCert = parseTLV(certSeq.val, 0);
    if (!tbsCert || tbsCert.tag !== 0x30) return false;
    const sigAlg = parseTLV(certSeq.val, tbsCert.next);
    if (!sigAlg || sigAlg.tag !== 0x30) return false;
    const sigVal = parseTLV(certSeq.val, sigAlg.next);
    if (!sigVal || sigVal.tag !== 0x03 || sigVal.next !== certSeq.val.length) return false;
    let p = 0, extensionsTLV = null;
    while (p < tbsCert.val.length) {
      const item = parseTLV(tbsCert.val, p);
      if (!item) return false;
      if (item.tag === 0xa3) { extensionsTLV = item; break; }
      p = item.next;
    }
    if (!extensionsTLV) return false;
    const extsSeq = parseTLV(extensionsTLV.val, 0);
    if (!extsSeq || extsSeq.tag !== 0x30 || extsSeq.next !== extensionsTLV.val.length) return false;
    let extP = 0, seenEKU = false, foundTSA = false;
    while (extP < extsSeq.val.length) {
      const extTLV = parseTLV(extsSeq.val, extP);
      if (!extTLV || extTLV.tag !== 0x30) return false;
      const extnIdTLV = parseTLV(extTLV.val, 0);
      if (!extnIdTLV || extnIdTLV.tag !== 0x06) return false;
      let itemP = extnIdTLV.next, nextTLV = parseTLV(extTLV.val, itemP);
      if (!nextTLV) return false;
      if (nextTLV.tag === 0x01) {
        if (nextTLV.len !== 1 || (nextTLV.val[0] !== 0x00 && nextTLV.val[0] !== 0xff)) return false;
        itemP = nextTLV.next; nextTLV = parseTLV(extTLV.val, itemP);
        if (!nextTLV) return false;
      }
      if (nextTLV.tag !== 0x04 || nextTLV.next !== extTLV.val.length) return false;
      if (extnIdTLV.val.equals(Buffer.from('551d25', 'hex'))) { // 2.5.29.37 (extKeyUsage)
        if (seenEKU) return false;
        seenEKU = true;
        const ekuSyntaxSeq = parseTLV(nextTLV.val, 0);
        if (!ekuSyntaxSeq || ekuSyntaxSeq.tag !== 0x30 || ekuSyntaxSeq.next !== nextTLV.val.length) return false;
        let ekuP = 0;
        while (ekuP < ekuSyntaxSeq.val.length) {
          const oidTLV = parseTLV(ekuSyntaxSeq.val, ekuP);
          if (!oidTLV || oidTLV.tag !== 0x06) return false;
          if (oidTLV.val.equals(Buffer.from('2b06010505070308', 'hex'))) foundTSA = true;
          ekuP = oidTLV.next;
        }
      }
      extP = extTLV.next;
    }
    return foundTSA;
  } catch (_) { return false; }
}
/**
 * Xây dựng và xác thực chuỗi chứng thư X.509 Path Validation theo RFC 5280
 * Hỗ trợ chuỗi trực tiếp 2 tầng (Leaf -> Root) hoặc đa tầng (Leaf -> Intermediate -> Root)
 */
// CONTRACT: hasTimeStampingEKU | Xác thực toàn bộ cấu trúc extKeyUsage và chỉ chấp nhận id-kp-timeStamping sau khi hoàn tất kiểm tra DER.
// Kết thúc lát cắt 6 (Dòng 301 - 360): Hoàn tất phân tích EKU TimeStamping
function validateX509CertificatePath(rawLeaf, rawAllCerts, officialRootFingerprint, options = {}) {
  try {
    const rawFp = typeof officialRootFingerprint === 'string' ? officialRootFingerprint.trim().toUpperCase() : '', expectedRootFp = /^[A-F0-9]{2}(:[A-F0-9]{2}){31}$/.test(rawFp) ? rawFp.replace(/:/g, '') : (/^[A-F0-9]{64}$/.test(rawFp) ? rawFp : '');
    if (!expectedRootFp) return { isValid: false, reason: 'Vân tay Root CA phải là đúng 64 ký tự hex SHA-256' };
    const calcFp = (buf) => crypto.createHash('sha256').update(buf).digest('hex').toUpperCase();
    const toCert = (c) => { try { const b = Buffer.isBuffer(c) ? Buffer.from(c) : (c && Buffer.isBuffer(c.raw) ? Buffer.from(c.raw) : null); return b ? new crypto.X509Certificate(b) : null; } catch (_) { return null; } }, leafCert = toCert(rawLeaf);
    if (!leafCert || !Array.isArray(rawAllCerts) || rawAllCerts.length === 0) return { isValid: false, reason: 'Dữ liệu đầu vào không hợp lệ để xây dựng chuỗi chứng thư' };
    const safeAllCerts = rawAllCerts.map(toCert).filter(Boolean);
    const rootCa = safeAllCerts.find((c) => calcFp(c.raw) === expectedRootFp && c.subject === c.issuer);
    if (!rootCa) return { isValid: false, reason: 'Không tìm thấy Root CA tự ký có BasicConstraints cA=TRUE khớp với vân tay đã ghim cứng của Ban Cơ yếu Chính phủ' };
    if (!rootCa.verify(rootCa.publicKey)) return { isValid: false, reason: 'Chữ ký tự ký của Root CA không hợp lệ' };
    const rootBc = parseBasicConstraintsFromDer(rootCa.raw), rootKu = parseKeyUsageFromDer(rootCa.raw);
    if (!rootBc || rootBc.isCA !== true) return { isValid: false, reason: 'Root CA thiếu thuộc tính BasicConstraints cA=TRUE trong DER' };
    if (rootKu.status === 'MALFORMED' || !rootKu.hasKeyUsage || !rootKu.keyCertSign) return { isValid: false, reason: 'Root CA có extension KeyUsage nhưng thiếu quyền keyCertSign theo RFC 5280' };
    const leafFp = calcFp(leafCert.raw), leafBc = parseBasicConstraintsFromDer(leafCert.raw), leafKu = parseKeyUsageFromDer(leafCert.raw);
    if (leafFp === expectedRootFp || (leafBc && leafBc.isCA === true)) return { isValid: false, reason: 'Chứng thư cuối (leaf) không được là CA certificate' };
    if (leafKu.status === 'MALFORMED' || !leafKu.hasKeyUsage || !(leafKu.digitalSignature || (leafKu.rawByte & 0x80))) return { isValid: false, reason: 'Chứng thư cuối (leaf) bắt buộc phải có KeyUsage với quyền digitalSignature theo RFC 5280' };
    if (options.requireTimeStamping && !hasTimeStampingEKU(leafCert)) return { isValid: false, reason: 'Chứng thư cuối (leaf) thiếu ExtendedKeyUsage id-kp-timeStamping theo RFC 3161' };
    const maxChainLength = (typeof options.maxChainLength === 'number' && options.maxChainLength >= 1) ? options.maxChainLength : 5;
    const chain = [leafCert]; let current = leafCert; const visited = new Set([leafFp]);
    while (current.subject !== current.issuer) {
      if (chain.length >= maxChainLength) return { isValid: false, reason: 'Độ dài chuỗi chứng thư vượt quá giới hạn an toàn (' + maxChainLength + ')' };
      const cands = safeAllCerts.filter((c) => !visited.has(calcFp(c.raw)) && current.checkIssued(c));
      const issuer = cands.find((c) => {
        try {
          const bc = parseBasicConstraintsFromDer(c.raw), ku = parseKeyUsageFromDer(c.raw);
          return current.verify(c.publicKey) && bc && bc.isCA === true && ku && ku.keyCertSign === true;
        } catch (_) { return false; }
      }) || (current.checkIssued(rootCa) && current.verify(rootCa.publicKey) ? rootCa : null);
      if (!issuer) return { isValid: false, reason: 'Không tìm thấy chứng thư cấp phát hợp lệ cho: ' + current.subject };
      visited.add(calcFp(issuer.raw)); chain.push(issuer); current = issuer;
      if (calcFp(current.raw) === expectedRootFp) break;
    }
    if (calcFp(chain[chain.length - 1].raw) !== expectedRootFp) return { isValid: false, reason: 'Chuỗi chứng thư không kết thúc tại Root CA đã ghim cứng của Ban Cơ yếu Chính phủ' };
    const valTime = options.validationTime instanceof Date ? options.validationTime : (options.validationTime ? new Date(options.validationTime) : new Date());
    if (Number.isNaN(valTime.getTime())) return { isValid: false, reason: 'Thời điểm xác thực không hợp lệ' };
    const safeOids = new Set(['2a864886f70d01010b', '2a8648ce3d040302', '2a864886f70d01010c', '2a864886f70d01010d', '2a8648ce3d040303', '2a8648ce3d040304']);
    for (let i = 0; i < chain.length; i++) {
      const c = chain[i], from = new Date(c.validFrom), to = new Date(c.validTo);
      if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || valTime < from || valTime > to) return { isValid: false, reason: 'Chứng thư ' + c.subject + ' đã hết hạn hoặc chưa có hiệu lực' };
      try { const s = parseTLV(c.raw, 0), tb = parseTLV(s.val, 0), sa = parseTLV(s.val, tb.next), so = parseTLV(sa.val, 0); if (!so || so.tag !== 0x06 || !safeOids.has(so.val.toString('hex'))) return { isValid: false, reason: 'Thuật toán chữ ký không an toàn' }; } catch (_) { return { isValid: false, reason: 'Lỗi parse thuật toán chữ ký' }; }
      const kt = c.publicKey && c.publicKey.asymmetricKeyType;
      if (kt === 'rsa') {
        const ml = c.publicKey.asymmetricKeyDetails && c.publicKey.asymmetricKeyDetails.modulusLength;
        if (!Number.isInteger(ml) || ml < 2048) return { isValid: false, reason: 'Khóa RSA không đạt tối thiểu 2048 bits' };
      } else if (kt === 'ec') {
        const crv = c.publicKey.asymmetricKeyDetails && c.publicKey.asymmetricKeyDetails.namedCurve;
        if (crv !== 'prime256v1' && crv !== 'secp256r1') return { isValid: false, reason: 'Đường cong EC không hỗ trợ' };
      } else {
        return { isValid: false, reason: 'Thuật toán khóa ' + c.subject + ' không hỗ trợ' };
      }
    }
    for (let j = 1; j < chain.length; j++) {
      const caBc = parseBasicConstraintsFromDer(chain[j].raw);
      if (caBc && typeof caBc.pathLenConstraint === 'number') {
        let intermediateCount = 0;
        for (let k = 1; k < j; k++) { if (chain[k].subject !== chain[k].issuer) intermediateCount++; }
        if (intermediateCount > caBc.pathLenConstraint) return { isValid: false, reason: 'Chuỗi chứng thư vi phạm pathLenConstraint (' + caBc.pathLenConstraint + ')' };
      }
    }
    return { isValid: true, chain, rootCa };
  } catch (err) {
    return { isValid: false, reason: 'Lỗi ngoại lệ trong xác thực chuỗi chứng thư: ' + (err && err.message ? err.message : err) };
  }
}
// CONTRACT: validateX509CertificatePath | Hoàn tất xác thực chuỗi chứng thư X.509 RFC 5280 an toàn, chữ ký từng mắt xích, cA, keyCertSign, pathLen, hạn dùng, ghim Root CA.

class TsaClient {
  constructor(options = {}) {
    this.tsaUrl = options.tsaUrl || process.env.VGCA_TSA_URL || (process.env.NODE_ENV === 'production' ? 'https://ca.gov.vn/tsa' : 'http://ca.gov.vn/tsa');
    const t = options.timeoutMs !== undefined ? options.timeoutMs : 15000;
    if (!Number.isSafeInteger(t) || t <= 0) throw new RangeError('[TSA ERROR]: timeoutMs phải là số nguyên dương (> 0)');
    this.timeoutMs = t;
    const r = options.maxRetries !== undefined ? options.maxRetries : 2;
    if (!Number.isSafeInteger(r) || r < 0) throw new RangeError('[TSA ERROR]: maxRetries phải là số nguyên không âm (>= 0)');
    this.maxRetries = r;
    const d = options.retryDelayMs !== undefined ? options.retryDelayMs : 1000;
    if (!Number.isSafeInteger(d) || d < 0) throw new RangeError('[TSA ERROR]: retryDelayMs phải là số nguyên không âm (>= 0)');
    this.retryDelayMs = d;
    this.allowMockFallback = options.allowMockFallback || false;
    if (process.env.NODE_ENV === 'production' && this.allowMockFallback) {
      throw new Error('[TSA CRITICAL]: Mock fallback bị vô hiệu hóa tuyệt đối trong môi trường sản xuất (NODE_ENV=production)');
    }
    if (process.env.NODE_ENV === 'production') {
      if (options.enforceTsaPinning === false) throw new Error('[TSA CRITICAL]: Vô hiệu hóa Certificate Pinning bị CẤM trong production!');
      this.enforceTsaPinning = true;
    } else {
      this.enforceTsaPinning = options.enforceTsaPinning !== undefined ? options.enforceTsaPinning : true;
    }
    this.pinnedFingerprints = new Set(['EA:E4:6D:68:A0:B9:21:EC:7C:82:DA:11:C7:54:66:22:2F:49:96:91:2E:53:CA:A4:1E:C7:06:72:CE:95:4B:D6']);
    this.allowedPolicies = options.allowedPolicies || null;
    try {
      const parsed = new URL(this.tsaUrl);
      if (process.env.NODE_ENV === 'production') {
        if (parsed.protocol !== 'https:') throw new Error('Bắt buộc giao thức HTTPS trong môi trường sản xuất (production).');
      } else if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        throw new Error('Giao thức URL TSA phải là HTTPS hoặc HTTP.');
      } else if (parsed.protocol === 'http:' && !['ca.gov.vn', 'tsa.ca.gov.vn', 'localhost', '127.0.0.1'].includes(parsed.hostname)) {
        throw new Error('Giao thức HTTP chỉ cho phép dùng với localhost, 127.0.0.1 hoặc ca.gov.vn ngoài production.');
      }
      const allowedHosts = process.env.NODE_ENV === 'production' ? ['ca.gov.vn', 'tsa.ca.gov.vn'] : ['ca.gov.vn', 'tsa.ca.gov.vn', 'localhost', '127.0.0.1'];
      if (!allowedHosts.includes(parsed.hostname)) throw new Error(`Máy chủ TSA '${parsed.hostname}' không nằm trong danh mục được cấp phép.`);
    } catch (e) { throw new Error(`[TSA URL INVALID]: ${e.message}`); }
  }
  buildTimeStampReqFromSha256Digest(digest) {
    if (!Buffer.isBuffer(digest) || digest.length !== 32) throw new Error('[TSA ERROR]: Mã băm phải là Buffer 32 bytes (SHA-256).');
    return this.buildTimeStampReq(digest);
  }
  buildTimeStampReq(input) {
    let hashBuffer;
    if (Buffer.isBuffer(input) && input.length === 32) hashBuffer = input;
    else if (Buffer.isBuffer(input) || typeof input === 'string') hashBuffer = crypto.createHash('sha256').update(input).digest();
    else throw new Error('[TSA ERROR]: Dữ liệu băm phải là Buffer 32 bytes digest hoặc chuỗi/Buffer để băm SHA-256.');
    const sha256AlgId = Buffer.from([
      0x30, 0x0d,
      0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01,
      0x05, 0x00
    ]);
    // CONTRACT: TsaClient | URL HTTPS production, validate timeout/retry/scheme an toàn, buildTimeStampReq và alias SHA-256.

    const octet = Buffer.concat([Buffer.from([0x04, 0x20]), hashBuffer]);
    const imprint = Buffer.concat([Buffer.from([0x30, 0x31]), sha256AlgId, octet]);
    const version = Buffer.from([0x02, 0x01, 0x01]);
    const rawNonce = crypto.randomBytes(8); rawNonce[0] = (rawNonce[0] & 0x7f) || 1;
    const nonceDer = encodeCanonicalInteger(rawNonce);
    const certReq = Buffer.from([0x01, 0x01, 0xff]);
    const body = Buffer.concat([version, imprint, nonceDer, certReq]);
    const header = Buffer.concat([Buffer.from([0x30]), encodeLength(body.length)]);
    const tspReq = Buffer.concat([header, body]);
    return { tspReqBuffer: tspReq, nonce: rawNonce, nonceDer: nonceDer, expectedHash: hashBuffer };
  }
  parseStrictTSTInfo(tstInfoBuf) {
    const root = parseTLV(tstInfoBuf, 0);
    if (!root || root.tag !== 0x30) throw new Error('[TSA SCHEMA ERROR]: TSTInfo không phải là ASN.1 SEQUENCE');
    if (root.next !== tstInfoBuf.length) throw new Error('[TSA SCHEMA ERROR]: TSTInfo chứa dữ liệu thừa ở cuối (trailing bytes)');
    let p = 0;
    // 1. Version: INTEGER (bắt buộc v1 = 1, chính xác 1 byte DER canonical)
    const ver = parseTLV(root.val, p);
    if (!ver || ver.tag !== 0x02 || ver.val.length !== 1 || ver.val[0] !== 1) {
      throw new Error('[TSA SCHEMA ERROR]: TSTInfo version không phải là INTEGER 1 (RFC 3161)');
    }
    p = ver.next;
    // 2. Policy: TSAPolicyId (OID) - Decode base-128, kiểm tra firstArc <= 2, secondArc <= 39
    const policy = parseTLV(root.val, p);
    if (!policy || policy.tag !== 0x06 || policy.val.length === 0) throw new Error('[TSA SCHEMA ERROR]: TSTInfo thiếu trường policy (OID)');
    let arcStart = true, subId = 0, firstSub = null;
    for (let i = 0; i < policy.val.length; i++) {
      const b = policy.val[i];
      if (arcStart && b === 0x80) throw new Error('[TSA SCHEMA ERROR]: Policy OID chứa non-canonical leading 0x80');
      subId = (subId * 128) + (b & 0x7f);
      if ((b & 0x80) === 0) {
        if (firstSub === null) {
          firstSub = subId;
          const firstArc = firstSub < 80 ? Math.floor(firstSub / 40) : 2;
          const secondArc = firstSub < 80 ? firstSub % 40 : firstSub - 80;
          if (firstArc > 2 || (firstArc < 2 && secondArc > 39)) throw new Error('[TSA SCHEMA ERROR]: Policy OID arc không hợp lệ');
        }
        arcStart = true; subId = 0;
      } else { arcStart = false; }
    }
    if (!arcStart) throw new Error('[TSA SCHEMA ERROR]: Policy OID kết thúc bất thường');
    const polHex = policy.val.toString('hex');
    if (this && this.allowedPolicies && Array.isArray(this.allowedPolicies) && this.allowedPolicies.length > 0) {
      if (!this.allowedPolicies.includes(polHex)) throw new Error(`[TSA FAIL-CLOSED]: Policy OID (${polHex}) không nằm trong danh mục chính sách được phép!`);
    }
    p = policy.next;
    // CONTRACT: parseStrictTSTInfo | Thẩm định Version INTEGER 1 canonical, Policy OID base-128 firstArc <= 2 & allowedPolicies.
    // 3. MessageImprint: SEQUENCE { hashAlgorithm, hashedMessage }
    const imprint = parseTLV(root.val, p);
    if (!imprint || imprint.tag !== 0x30) throw new Error('[TSA SCHEMA ERROR]: TSTInfo thiếu trường messageImprint (SEQUENCE)');
    p = imprint.next;
    const algId = parseTLV(imprint.val, 0);
    if (!algId || algId.tag !== 0x30) throw new Error('[TSA SCHEMA ERROR]: MessageImprint thiếu hashAlgorithm');
    const algOid = parseTLV(algId.val, 0);
    if (!algOid || algOid.tag !== 0x06 || algOid.val.toString('hex') !== '608648016503040201') throw new Error('[TSA SCHEMA ERROR]: Thuật toán băm không phải SHA-256');
    let algNext = algOid.next; if (algNext < algId.val.length) { const pParam = parseTLV(algId.val, algNext); if (pParam && pParam.tag === 0x05 && pParam.val.length === 0) algNext = pParam.next; }
    if (algNext !== algId.val.length) throw new Error('[TSA SCHEMA ERROR]: hashAlgorithm chứa dữ liệu thừa');
    const hashOctet = parseTLV(imprint.val, algId.next); if (!hashOctet || hashOctet.tag !== 0x04 || hashOctet.val.length !== 32) throw new Error('[TSA SCHEMA ERROR]: MessageImprint không chứa OCTET STRING 32 bytes');
    if (hashOctet.next !== imprint.val.length) {
      throw new Error('[TSA SCHEMA ERROR]: MessageImprint chứa dữ liệu thừa sau hashedMessage (yêu cầu hashOctet.next === imprint.val.length)');
    }
    const hashedMessage = hashOctet.val;
    // 4. SerialNumber: INTEGER (bắt buộc số nguyên dương, kiểm tra canonical DER)
    const sn = parseTLV(root.val, p);
    if (!sn || sn.tag !== 0x02 || sn.val.length === 0) throw new Error('[TSA SCHEMA ERROR]: TSTInfo thiếu trường serialNumber (INTEGER)');
    if ((sn.val[0] & 0x80) !== 0) throw new Error('[TSA SCHEMA ERROR]: serialNumber là số nguyên âm (vi phạm RFC 3161/RFC 5280)');
    if (sn.val.length === 1 && sn.val[0] === 0) throw new Error('[TSA SCHEMA ERROR]: serialNumber có giá trị 0 (phải là số nguyên dương RFC 5280)');
    if (sn.val.length > 1 && sn.val[0] === 0x00 && (sn.val[1] & 0x80) === 0) throw new Error('[TSA SCHEMA ERROR]: serialNumber không tuân thủ DER canonical INTEGER (leading zero thừa)');
    p = sn.next;
    // 5. GenTime: GeneralizedTime (tag 0x18)
    const genTime = parseTLV(root.val, p);
    if (!genTime || genTime.tag !== 0x18) throw new Error('[TSA SCHEMA ERROR]: TSTInfo thiếu trường genTime (GeneralizedTime)');
    const genTimeString = genTime.val.toString('ascii');
    if (!/^\d{14}(\.\d+)?Z$/.test(genTimeString)) throw new Error('[TSA SCHEMA ERROR]: Định dạng GeneralizedTime trong TSTInfo không hợp lệ: ' + genTimeString);
    p = genTime.next;
    // CONTRACT: TSTInfo Accuracy validation | Kiểm tra đầy đủ cấu trúc DER và miền giá trị RFC 3161 trước khi chấp nhận timestamp.
    // 6. accuracy: Accuracy OPTIONAL (SEQUENCE tag 0x30)
    let accuracy = null;
    if (p < root.val.length) {
      const nextTLV = parseTLV(root.val, p);
      if (!nextTLV) throw new Error('[TSA SCHEMA ERROR]: Phần tử sau genTime không hợp lệ');
      if (nextTLV.tag === 0x30) {
        let accP = 0, hasSec = false, hasMilli = false, hasMicro = false;
        const checkAccInt = (f, min, max, name) => {
          if (!f || f.val.length === 0) throw new Error(`[TSA SCHEMA ERROR]: Accuracy ${name} có length 0`);
          if ((f.val[0] & 0x80) !== 0) throw new Error(`[TSA SCHEMA ERROR]: Accuracy ${name} là số âm`);
          if (f.val.length > 1 && f.val[0] === 0x00 && (f.val[1] & 0x80) === 0) throw new Error(`[TSA SCHEMA ERROR]: Accuracy ${name} leading zero non-canonical`);
          let v = 0;
          for (let i = 0; i < f.val.length; i++) {
            v = (v * 256) + f.val[i];
            if (v > max) throw new Error(`[TSA SCHEMA ERROR]: Accuracy ${name} vượt quá miền giá trị (${v} > ${max})`);
          }
          if (v < min) throw new Error(`[TSA SCHEMA ERROR]: Accuracy ${name} nhỏ hơn miền giá trị (${v} < ${min})`);
          return v;
        };
        while (accP < nextTLV.val.length) {
          const accField = parseTLV(nextTLV.val, accP);
          if (!accField) throw new Error('[TSA SCHEMA ERROR]: Accuracy SEQUENCE chứa phần tử không hợp lệ');
          if (accField.tag === 0x02 && !hasSec && !hasMilli && !hasMicro) {
            checkAccInt(accField, 1, Number.MAX_SAFE_INTEGER, 'seconds'); hasSec = true;
          } else if (accField.tag === 0x80 && !hasMilli && !hasMicro) {
            checkAccInt(accField, 1, 999, 'millis'); hasMilli = true;
          } else if (accField.tag === 0x81 && !hasMicro) {
            checkAccInt(accField, 1, 999, 'micros'); hasMicro = true;
          } else {
            throw new Error('[TSA SCHEMA ERROR]: Accuracy SEQUENCE chứa trường sai quy chuẩn RFC 3161');
          }
          accP = accField.next;
        }
        if (!hasSec && !hasMilli && !hasMicro) throw new Error('[TSA SCHEMA ERROR]: Accuracy SEQUENCE không được rỗng (RFC 3161)');
        if (accP !== nextTLV.val.length) throw new Error('[TSA SCHEMA ERROR]: Accuracy SEQUENCE chứa dữ liệu thừa');
        accuracy = nextTLV.val;
        p = nextTLV.next;
      }
    }
    // 7. ordering: BOOLEAN DEFAULT FALSE (tag 0x01, len 1)
    let ordering = false;
    if (p < root.val.length) {
      const nextTLV = parseTLV(root.val, p);
      if (!nextTLV) throw new Error('[TSA SCHEMA ERROR]: Phần tử sau accuracy không hợp lệ');
      if (nextTLV.tag === 0x01) {
        if (nextTLV.val.length !== 1 || (nextTLV.val[0] !== 0x00 && nextTLV.val[0] !== 0xff)) throw new Error('[TSA SCHEMA ERROR]: ordering BOOLEAN sai DER');
        ordering = nextTLV.val[0] !== 0x00; p = nextTLV.next; } }
    const checkDerOid = (b, n) => {
      if (!b || b.length === 0) throw new Error(`[TSA SCHEMA ERROR]: ${n} OID rỗng`);
      let s = 0, f = null, st = true; for (let i = 0; i < b.length; i++) {
        if (st && b[i] === 0x80) throw new Error(`[TSA SCHEMA ERROR]: ${n} OID leading zero`);
        s = (s * 128) + (b[i] & 0x7f); if (s > Number.MAX_SAFE_INTEGER) throw new Error(`[TSA SCHEMA ERROR]: ${n} OID overflow`);
        if ((b[i] & 0x80) === 0) { if (f === null) { const fa = s < 80 ? Math.floor(s / 40) : 2, sa = s < 80 ? s % 40 : s - 80; if (fa > 2 || (fa < 2 && sa > 39)) throw new Error(`[TSA SCHEMA ERROR]: ${n} OID arc sai`); f = s; } st = true; s = 0; } else { st = false; }
      }
      if (!st) throw new Error(`[TSA SCHEMA ERROR]: ${n} OID kết thúc bất thường`);
    };
    // 8. nonce: INTEGER OPTIONAL (tag 0x02, bắt buộc số nguyên không âm)
    let nonceVal = null; if (p < root.val.length) {
      const nextTLV = parseTLV(root.val, p); if (!nextTLV) throw new Error('[TSA SCHEMA ERROR]: Phần tử sau ordering không hợp lệ');
      if (nextTLV.tag === 0x02) {
        if (nextTLV.val.length === 0 || (nextTLV.val[0] & 0x80) !== 0) throw new Error('[TSA SCHEMA ERROR]: nonce rỗng hoặc số âm (vi phạm RFC 3161)');
        if (nextTLV.val.length > 1 && nextTLV.val[0] === 0x00 && (nextTLV.val[1] & 0x80) === 0) throw new Error('[TSA SCHEMA ERROR]: nonce INTEGER có leading zero không canonical');
        nonceVal = nextTLV.val; p = nextTLV.next; } }
    // 9. tsa: [0] GeneralName OPTIONAL (tag 0xa0) - RFC 5280 CHOICE
    let tsaName = null; if (p < root.val.length) {
      const nextTLV = parseTLV(root.val, p); if (!nextTLV) throw new Error('[TSA SCHEMA ERROR]: Phần tử sau nonce không hợp lệ');
      if (nextTLV.tag === 0xa0) {
        if (nextTLV.val.length === 0) throw new Error('[TSA SCHEMA ERROR]: tsa GeneralName rỗng');
        const gn = parseTLV(nextTLV.val, 0); if (!gn) throw new Error('[TSA SCHEMA ERROR]: Không thể giải mã tsa GeneralName');
        const gnTagNum = gn.tag & 0x1f, isConst = (gn.tag & 0x20) !== 0;
        if ((gn.tag & 0xc0) !== 0x80 || gnTagNum > 8 || isConst !== (gnTagNum === 0 || gnTagNum === 3 || gnTagNum === 4 || gnTagNum === 5)) throw new Error('[TSA SCHEMA ERROR]: tsa GeneralName tag hoặc constructed bit sai RFC 5280');
        if (gn.next !== nextTLV.val.length) throw new Error('[TSA SCHEMA ERROR]: tsa GeneralName chứa dữ liệu thừa');
        if ([1, 2, 6].includes(gnTagNum) && (gn.val.length === 0 || gn.val.some(b => b > 127))) throw new Error('[TSA SCHEMA ERROR]: GeneralName IA5String không hợp lệ');
        if ((gnTagNum === 7 && gn.val.length !== 4 && gn.val.length !== 16) || (gnTagNum === 8 && (gn.val.length === 0 || (gn.val[gn.val.length - 1] & 0x80) !== 0))) throw new Error('[TSA SCHEMA ERROR]: GeneralName IP hoặc OID sai RFC 5280');
        if (gnTagNum === 8) checkDerOid(gn.val, 'registeredID');
        if ([0, 3, 4, 5].includes(gnTagNum)) { const inner = parseTLV(gn.val, 0); if (!inner || inner.tag !== 0x30 || inner.next !== gn.val.length) throw new Error('[TSA SCHEMA ERROR]: GeneralName constructed SEQUENCE không hợp lệ'); }
        tsaName = nextTLV.val; p = nextTLV.next; } }
    // 10. extensions: [1] IMPLICIT Extensions OPTIONAL (tag 0xa1)
    let extensions = null; if (p < root.val.length) {
      const nextTLV = parseTLV(root.val, p); if (!nextTLV) throw new Error('[TSA SCHEMA ERROR]: Phần tử sau tsa không hợp lệ');
      if (nextTLV.tag === 0xa1) {
        if (nextTLV.val.length === 0) throw new Error('[TSA SCHEMA ERROR]: Extensions rỗng');
        const extSeq = nextTLV.val, seenExtOids = new Set(); let ep = 0, ec = 0;
        while (ep < extSeq.length) {
          const item = parseTLV(extSeq, ep); if (!item || item.tag !== 0x30) throw new Error('[TSA SCHEMA ERROR]: Extension phải là SEQUENCE');
          const eId = parseTLV(item.val, 0); if (!eId || eId.tag !== 0x06) throw new Error('[TSA SCHEMA ERROR]: extnID OID không hợp lệ');
          checkDerOid(eId.val, 'extnID'); const oidHex = eId.val.toString('hex');
          if (seenExtOids.has(oidHex)) throw new Error(`[TSA SCHEMA ERROR]: Trùng lặp Extension OID (${oidHex})`); seenExtOids.add(oidHex);
          let ip = eId.next; if (ip < item.val.length) {
            const cr = parseTLV(item.val, ip);
            if (cr && cr.tag === 0x01) { if (cr.val.length !== 1 || (cr.val[0] !== 0x00 && cr.val[0] !== 0xff)) throw new Error('[TSA SCHEMA ERROR]: critical sai DER'); ip = cr.next; }
          }
          const eV = parseTLV(item.val, ip); if (!eV || eV.tag !== 0x04 || eV.next !== item.val.length) throw new Error('[TSA SCHEMA ERROR]: extnValue sai OCTET STRING');
          ep = item.next; ec++;
        }
        if (ec === 0 || ep !== extSeq.length) throw new Error('[TSA SCHEMA ERROR]: Extensions rỗng hoặc chứa dữ liệu thừa');
        extensions = nextTLV.val; p = nextTLV.next; } }
    // CONTRACT: TSTInfo trailing-data rejection | Cấm dữ liệu thừa sau extensions, cấm duplicate Extension OID, kiểm tra nonce không âm và GeneralName tag/constructed shape.
    if (p !== root.val.length) throw new Error(`[TSA SCHEMA ERROR]: TSTInfo SEQUENCE chứa dữ liệu thừa (${root.val.length - p} bytes)`);
    return {
      version: ver.val[0],
      policyOid: policy.val.toString('hex'),
      messageImprint: {
        hashAlgorithm: algOid.val.toString('hex'),
        hashedMessage: hashedMessage
      },
      hashAlgorithm: algOid.val.toString('hex'),
      hashedMessage: hashedMessage,
      serialNumber: sn.val.toString('hex'),
      genTime: genTimeString,
      nonce: nonceVal,
      accuracy: accuracy,
      ordering: ordering,
      tsaName: tsaName,
      rawDer: tstInfoBuf
    };
  }

  parseTimeStampResp(respBuffer, expectedNonce, expectedHash, referenceTime = null) {
    if (!Buffer.isBuffer(respBuffer) || respBuffer.length < 32) throw new Error('[TSA FAIL-CLOSED]: Dữ liệu phản hồi TSA quá ngắn hoặc không hợp lệ.');
    const root = parseTLV(respBuffer, 0);
    if (!root || root.tag !== 0x30 || root.next !== respBuffer.length) {
      throw new Error('[TSA FAIL-CLOSED]: Phản hồi không bắt đầu bằng ASN.1 SEQUENCE hoặc chứa dữ liệu thừa ngoài SEQUENCE (0x30).');
    }
    // 1. Phân tích PKIStatusInfo
    const statusTLV = parseTLV(respBuffer, root.pos + root.hl);
    if (!statusTLV || statusTLV.tag !== 0x30) throw new Error('[TSA FAIL-CLOSED]: Cấu trúc PKIStatusInfo không hợp lệ.');
    const statusValTLV = parseTLV(statusTLV.val, 0);
    if (!statusValTLV || statusValTLV.tag !== 0x02 || statusValTLV.val.length === 0) throw new Error('[TSA FAIL-CLOSED]: Không tìm thấy trường INTEGER status trong PKIStatusInfo.');
    if ((statusValTLV.val[0] & 0x80) !== 0 || (statusValTLV.val.length > 1 && statusValTLV.val[0] === 0x00 && (statusValTLV.val[1] & 0x80) === 0)) throw new Error('[TSA FAIL-CLOSED]: status INTEGER không canonical hoặc âm');
    if (statusValTLV.val.length > 4) throw new Error('[TSA FAIL-CLOSED]: status INTEGER vượt quá giới hạn độ dài cho phép');
    let statusCode = 0;
    for (let i = 0; i < statusValTLV.val.length; i++) statusCode = (statusCode * 256) + statusValTLV.val[i];
    // Tiêu thụ PKIStatusInfo: statusString (PKIFreeText SEQUENCE OF UTF8String OPTIONAL), failInfo (BIT STRING OPTIONAL)
    let psiP = statusValTLV.next, hasStatusString = false, hasFailInfo = false;
    while (psiP < statusTLV.val.length) {
      const nextField = parseTLV(statusTLV.val, psiP);
      if (!nextField) throw new Error('[TSA FAIL-CLOSED]: PKIStatusInfo chứa dữ liệu không hợp lệ');
      if (nextField.tag === 0x30 && !hasStatusString && !hasFailInfo) {
        let sp = 0, count = 0;
        while (sp < nextField.val.length) {
          const sItem = parseTLV(nextField.val, sp);
          if (!sItem || sItem.tag !== 0x0c) throw new Error('[TSA FAIL-CLOSED]: statusString phải là SEQUENCE OF UTF8String');
          count++; sp = sItem.next;
        }
        if (count === 0 || sp !== nextField.val.length) throw new Error('[TSA FAIL-CLOSED]: statusString rỗng hoặc chứa trailing bytes');
        hasStatusString = true;
      } else if (nextField.tag === 0x03 && !hasFailInfo) {
        const ub = nextField.val.length > 0 ? nextField.val[0] : 8;
        if (nextField.val.length === 0 || ub > 7 || (ub !== 0 && nextField.val.length === 1) || (ub !== 0 && (nextField.val[nextField.val.length - 1] & ((1 << ub) - 1)) !== 0)) throw new Error('[TSA FAIL-CLOSED]: failInfo BIT STRING không hợp lệ hoặc không canonical');
        hasFailInfo = true;
      } else {
        throw new Error('[TSA FAIL-CLOSED]: PKIStatusInfo chứa trường sai thứ tự, trùng lặp hoặc tag lạ');
      }
      psiP = nextField.next;
    }
    if (psiP !== statusTLV.val.length) throw new Error('[TSA FAIL-CLOSED]: PKIStatusInfo chứa dữ liệu thừa chưa được tiêu thụ');
    if (statusCode !== 0 && statusCode !== 1) throw new Error(`[TSA FAIL-CLOSED]: Máy chủ TSA từ chối cấp dấu thời gian với mã trạng thái: ${statusCode} (RFC 3161 PKIStatus)`);
    // CONTRACT: parseTimeStampResp | Phải chỉ chấp nhận PKIStatusInfo canonical DER đúng schema RFC 3161 trước khi xử lý TimeStampToken.
    // 2. Trích xuất TimeStampToken (ContentInfo)
    const tokenTLV = parseTLV(respBuffer, statusTLV.next);
    if (!tokenTLV || tokenTLV.tag !== 0x30) throw new Error('[TSA FAIL-CLOSED]: Phản hồi TSA thành công nhưng thiếu khối TimeStampToken.');
    if (tokenTLV.next !== root.pos + root.hl + root.len) {
      throw new Error('[TSA FAIL-CLOSED]: TimeStampResp chứa dữ liệu thừa sau TimeStampToken.');
    }

    const timeStampToken = respBuffer.subarray(tokenTLV.pos, tokenTLV.next);

    // 3. Giải mã cấu trúc CMS SignedData bên trong TimeStampToken
    let p = tokenTLV.pos + tokenTLV.hl;
    const ctOid = parseTLV(respBuffer, p);
    if (!ctOid || ctOid.tag !== 0x06 || ctOid.val.toString('hex') !== '2a864886f70d010702') {
      throw new Error('[TSA FAIL-CLOSED]: TimeStampToken không phải là CMS SignedData (OID 1.2.840.113549.1.7.2).');
    }

    const sdCtx = parseTLV(respBuffer, ctOid.next);
    if (!sdCtx || sdCtx.tag !== 0xa0) {
      throw new Error('[TSA FAIL-CLOSED]: Thiếu container content [0] của SignedData trong TimeStampToken.');
    }
    if (sdCtx.next !== tokenTLV.next) {
      throw new Error('[TSA FAIL-CLOSED]: TimeStampToken chứa dữ liệu thừa ngoài SignedData container.');
    }

    const sdSeq = parseTLV(sdCtx.val, 0);
    if (!sdSeq || sdSeq.tag !== 0x30 || sdSeq.next !== sdCtx.val.length) {
      throw new Error('[TSA FAIL-CLOSED]: Cấu trúc SignedData SEQUENCE không hợp lệ hoặc chứa trailing bytes.');
    }

    let sP = 0;
    const ver = parseTLV(sdSeq.val, sP); if (!ver || ver.tag !== 0x02) throw new Error('[TSA FAIL-CLOSED]: Thiếu version trong SignedData.'); sP = ver.next;
    const da = parseTLV(sdSeq.val, sP); if (!da || da.tag !== 0x31) throw new Error('[TSA FAIL-CLOSED]: Thiếu digestAlgorithms trong SignedData.'); sP = da.next;
    
    // Đối soát digestAlgorithms trong SignedData: Bắt buộc không rỗng và phải là SHA-256
    if (da.val.length === 0) throw new Error('[TSA FAIL-CLOSED]: SignedData.digestAlgorithms rỗng!');
    const daAlgTLV = parseTLV(da.val, 0);
    if (!daAlgTLV || daAlgTLV.tag !== 0x30) throw new Error('[TSA FAIL-CLOSED]: AlgorithmIdentifier trong digestAlgorithms không hợp lệ');
    const daAlgOid = parseTLV(daAlgTLV.val, 0);
    if (!daAlgOid || daAlgOid.tag !== 0x06 || daAlgOid.val.toString('hex') !== '608648016503040201') {
      throw new Error('[TSA FAIL-CLOSED]: SignedData.digestAlgorithms OID không phải là SHA-256 (OID 2.16.840.1.101.3.4.2.1)');
    }
    if (daAlgTLV.next !== da.val.length) throw new Error('[TSA FAIL-CLOSED]: digestAlgorithms SET chứa dữ liệu thừa');

    const eci = parseTLV(sdSeq.val, sP); if (!eci || eci.tag !== 0x30) throw new Error('[TSA FAIL-CLOSED]: Thiếu encapContentInfo trong SignedData.'); sP = eci.next;
    let certsPart = null, crlsPart = null;
    if (sP < sdSeq.val.length) { const p0 = parseTLV(sdSeq.val, sP); if (p0 && p0.tag === 0xa0) { certsPart = p0; sP = p0.next; } }
    if (sP < sdSeq.val.length) { const p1 = parseTLV(sdSeq.val, sP); if (p1 && p1.tag === 0xa1) { crlsPart = p1; sP = p1.next; } }
    const sisPart = parseTLV(sdSeq.val, sP); if (!sisPart || sisPart.tag !== 0x31) throw new Error('[TSA FAIL-CLOSED]: Thiếu signerInfos trong SignedData.'); sP = sisPart.next;
    if (sP !== sdSeq.val.length) throw new Error('[TSA FAIL-CLOSED]: SignedData SEQUENCE chứa dữ liệu thừa ở cuối (trailing bytes).');

    const eciOid = parseTLV(eci.val, 0);
    if (!eciOid || eciOid.tag !== 0x06 || eciOid.val.toString('hex') !== '2a864886f70d0109100104') {
      throw new Error('[TSA FAIL-CLOSED]: eContentType không phải là id-ct-TSTInfo (OID 1.2.840.113549.1.9.16.1.4).');
    }
    const eContentCtx = parseTLV(eci.val, eciOid.next);
    if (!eContentCtx || eContentCtx.tag !== 0xa0 || eContentCtx.next !== eci.val.length) {
      throw new Error('[TSA FAIL-CLOSED]: encapContentInfo chứa dữ liệu không hợp lệ hoặc trailing bytes.');
    }
    const eContentOctet = parseTLV(eContentCtx.val, 0);
    if (!eContentOctet || eContentOctet.tag !== 0x04 || eContentOctet.next !== eContentCtx.val.length) {
      throw new Error('[TSA FAIL-CLOSED]: eContent OCTET STRING không hợp lệ hoặc chứa trailing bytes.');
    }
    // CONTRACT: parseTimeStampResp | Giải mã CMS SignedData, certificates [0] và crls [1] tùy chọn, signerInfos [1], eContentType TSTInfo DER canonical không trailing bytes.
    const tstInfoDer = eContentOctet.val;
    const expectedTstInfoHash = crypto.createHash('sha256').update(tstInfoDer).digest();

    // 4. Phân tích TSTInfo nghiêm ngặt theo schema RFC 3161
    const tstInfo = this.parseStrictTSTInfo(tstInfoDer);

    // 4.1 FAIL-CLOSED: Kiểm tra sai lệch đồng hồ HAI CHIỀU (chống cả future timestamp và stale token replay)
    const tokenDate = new Date(Date.UTC(
      parseInt(tstInfo.genTime.slice(0, 4), 10),
      parseInt(tstInfo.genTime.slice(4, 6), 10) - 1,
      parseInt(tstInfo.genTime.slice(6, 8), 10),
      parseInt(tstInfo.genTime.slice(8, 10), 10),
      parseInt(tstInfo.genTime.slice(10, 12), 10),
      parseInt(tstInfo.genTime.slice(12, 14), 10)
    ));
    const tokenMs = tokenDate.getTime();
    const nowMs = referenceTime ? (referenceTime instanceof Date ? referenceTime.getTime() : new Date(referenceTime).getTime()) : Date.now();
    if (!Number.isFinite(tokenMs) || !Number.isFinite(nowMs)) {
      throw new Error('[TSA FAIL-CLOSED]: Thời gian TSA hoặc referenceTime không hợp lệ.');
    }
    const maxDriftMs = 15 * 60 * 1000; // 15 phút
    if (Math.abs(tokenMs - nowMs) > maxDriftMs) {
      if (tokenMs > nowMs + maxDriftMs) {
        throw new Error(`[TSA FAIL-CLOSED]: Thời gian cấp dấu trong tương lai vượt quá giới hạn sai lệch cho phép (${tstInfo.genTime} vs hiện tại ${new Date(nowMs).toISOString()})`);
      } else {
        throw new Error(`[TSA FAIL-CLOSED]: Thời gian cấp dấu quá cũ (stale token replay) vượt quá giới hạn sai lệch hai chiều cho phép 15 phút (${tstInfo.genTime} vs hiện tại ${new Date(nowMs).toISOString()})`);
      }
    }

    // 4.2 FAIL-CLOSED: Kiểm tra Policy OID nếu được cấu hình
    if (this.allowedPolicies && Array.isArray(this.allowedPolicies) && this.allowedPolicies.length > 0) {
      if (!this.allowedPolicies.includes(tstInfo.policyOid)) {
        throw new Error(`[TSA FAIL-CLOSED]: Policy OID trong TimeStampToken (${tstInfo.policyOid}) không nằm trong danh mục chính sách được phép!`);
      }
    }

    // 5. FAIL-CLOSED: Kiểm tra bắt buộc Nonce
    if (!expectedNonce) throw new Error('[TSA FAIL-CLOSED]: Thiếu expectedNonce để đối soát phản hồi.');
    if (!tstInfo.nonce) {
      throw new Error('[TSA FAIL-CLOSED]: TimeStampToken không chứa nonce theo yêu cầu RFC 3161!');
    }
    const cleanExpected = expectedNonce[0] === 0 ? expectedNonce.subarray(1) : expectedNonce;
    const cleanVerified = tstInfo.nonce[0] === 0 ? tstInfo.nonce.subarray(1) : tstInfo.nonce;
    if (!cleanExpected.equals(cleanVerified)) {
      throw new Error(`[TSA FAIL-CLOSED]: Nonce trong TimeStampToken (${cleanVerified.toString('hex')}) không khớp với yêu cầu (${cleanExpected.toString('hex')})!`);
    }

    // 6. FAIL-CLOSED: Kiểm tra bắt buộc MessageImprint
    if (!expectedHash) throw new Error('[TSA FAIL-CLOSED]: Thiếu expectedHash để đối soát phản hồi.');
    if (!tstInfo.hashedMessage) {
      throw new Error('[TSA FAIL-CLOSED]: TimeStampToken không chứa hashedMessage trong messageImprint!');
    }
    if (!expectedHash.equals(tstInfo.hashedMessage)) {
      throw new Error(`[TSA FAIL-CLOSED]: Mã băm trong TimeStampToken (${tstInfo.hashedMessage.toString('hex')}) không khớp với băm đã gửi (${expectedHash.toString('hex')})!`);
    }

    // CONTRACT: parseTimeStampResp | Kiểm tra drift thời gian hai chiều fail-closed, kiểm tra Policy OID, Nonce và MessageImprint RFC 3161.
    // 7. Xác minh chữ ký số RSA-SHA256 của máy chủ TSA và đối chiếu chứng thư tương ứng (ZERO-FALLBACK)
    let isTsaCryptoSigValid = false;
    let tsaCertSubject = null;
    let tsaCertIssuer = null;

    if (!certsPart || certsPart.tag !== 0xa0) {
      throw new Error('[TSA FAIL-CLOSED]: SignedData không chứa certificates [0]');
    }
    if (!sisPart || sisPart.tag !== 0x31) {
      throw new Error('[TSA FAIL-CLOSED]: SignedData không chứa signerInfos SET');
    }

    const siSeq = parseTLV(sisPart.val, 0);
    if (!siSeq || siSeq.tag !== 0x30) throw new Error('[TSA FAIL-CLOSED]: SignerInfo rỗng hoặc không phải SEQUENCE');
    if (siSeq.next !== sisPart.val.length) {
      throw new Error('[TSA FAIL-CLOSED]: signerInfos SET chứa dữ liệu thừa hoặc nhiều SignerInfo ngoài quy chuẩn (Fail-Closed)');
    }
    let siP = 0;
    const siVer = parseTLV(siSeq.val, siP); if (!siVer || siVer.tag !== 0x02 || siVer.val.length !== 1 || siVer.val[0] !== 0x01) throw new Error('[TSA FAIL-CLOSED]: SignerInfo.version phải là INTEGER 1'); siP = siVer.next;
    const siSid = parseTLV(siSeq.val, siP); if (!siSid || siSid.tag !== 0x30) throw new Error('[TSA FAIL-CLOSED]: SignerInfo.sid không phải là IssuerAndSerialNumber (tag 0x30)!'); siP = siSid.next;
    const siDa = parseTLV(siSeq.val, siP); if (!siDa || siDa.tag !== 0x30) throw new Error('[TSA FAIL-CLOSED]: Thiếu digestAlgorithm trong SignerInfo'); siP = siDa.next;
    const siDaOid = parseTLV(siDa.val, 0);
    if (!siDaOid || siDaOid.tag !== 0x06 || siDaOid.val.toString('hex') !== '608648016503040201') {
      throw new Error('[TSA FAIL-CLOSED]: TSA SignerInfo digestAlgorithm không phải là SHA-256 (OID 2.16.840.1.101.3.4.2.1)');
    }
    if (siDaOid.next !== siDa.val.length) {
      const daParam = parseTLV(siDa.val, siDaOid.next);
      if (!daParam || daParam.tag !== 0x05 || daParam.val.length !== 0 || daParam.next !== siDa.val.length) {
        throw new Error('[TSA FAIL-CLOSED]: TSA digestAlgorithm parameters không hợp lệ (chỉ cho phép NULL hoặc absent)');
      }
    }

    const sidIssuer = parseTLV(siSid.val, 0);
    if (!sidIssuer || sidIssuer.tag !== 0x30) throw new Error('[TSA FAIL-CLOSED]: Issuer trong SignerInfo.sid không hợp lệ (không phải SEQUENCE tag 0x30)');
    const sidSerial = parseTLV(siSid.val, sidIssuer.next);
    if (!sidSerial || sidSerial.tag !== 0x02) throw new Error('[TSA FAIL-CLOSED]: Serial trong SignerInfo.sid không hợp lệ (không phải INTEGER tag 0x02)');
    if (sidSerial.next !== siSid.val.length) throw new Error('[TSA FAIL-CLOSED]: SignerInfo.sid chứa trailing bytes');

    const targetIssuerDer = siSid.val.subarray(sidIssuer.pos, sidIssuer.next);
    const targetSerialDer = sidSerial.val;

    const signedAttrsPart = parseTLV(siSeq.val, siP);
    if (!signedAttrsPart || signedAttrsPart.tag !== 0xa0) {
      throw new Error('[TSA FAIL-CLOSED]: TSA SignerInfo thiếu signedAttrs [0]');
    }
    siP = signedAttrsPart.next;
    const sigAlg = parseTLV(siSeq.val, siP);
    if (!sigAlg || sigAlg.tag !== 0x30) throw new Error('[TSA FAIL-CLOSED]: Thiếu signatureAlgorithm trong TSA SignerInfo');
    siP = sigAlg.next;
    const sigVal = parseTLV(siSeq.val, siP);
    if (!sigVal || sigVal.tag !== 0x04) throw new Error('[TSA FAIL-CLOSED]: TSA SignerInfo thiếu signatureValue');
    siP = sigVal.next;
    if (siP < siSeq.val.length) {
      const tsaUnsignedAttrs = parseTLV(siSeq.val, siP);
      if (!tsaUnsignedAttrs || tsaUnsignedAttrs.tag !== 0xa1) throw new Error('[TSA FAIL-CLOSED]: TSA unsignedAttrs phải là [1]');
      siP = tsaUnsignedAttrs.next;
    }
    if (siP !== siSeq.val.length) {
      throw new Error('[TSA FAIL-CLOSED]: TSA SignerInfo SEQUENCE chứa dữ liệu thừa ở cuối (trailing bytes)');
    }

    // CONTRACT: parseTimeStampResp | Xác thực TSA SignerInfo SEQUENCE, sid IssuerAndSerialNumber, signedAttrs [0], signatureValue và unsignedAttrs [1] theo RFC 5652.
    // 7.1 Kiểm tra signatureAlgorithm phải là sha256WithRSAEncryption (OID 1.2.840.113549.1.1.11)

    const sigAlgOid = parseTLV(sigAlg.val, 0);
    if (!sigAlgOid || sigAlgOid.tag !== 0x06 || sigAlgOid.val.toString('hex') !== '2a864886f70d01010b') {
      throw new Error('[TSA FAIL-CLOSED]: Thuật toán chữ ký TSA không phải là sha256WithRSAEncryption (OID 1.2.840.113549.1.1.11)');
    }

    // 7.2 Kiểm tra signedAttrs của TSA: messageDigest === SHA256(TSTInfo) và contentType === id-ct-TSTInfo (Chống Duplicate Attributes)
    let saP = 0;
    let tsaEmbeddedMessageDigest = null;
    let tsaEmbeddedContentType = null;
    const seenAttrs = new Set();
    while (saP < signedAttrsPart.val.length) {
      const attr = parseTLV(signedAttrsPart.val, saP);
      if (!attr || attr.tag !== 0x30) {
        throw new Error('[TSA FAIL-CLOSED]: Cấu trúc thuộc tính trong TSA signedAttrs không hợp lệ (Fail-Closed)');
      }
      const aOid = parseTLV(attr.val, 0);
      if (!aOid || aOid.tag !== 0x06) {
        throw new Error('[TSA FAIL-CLOSED]: Thuộc tính TSA signedAttrs thiếu OID hợp lệ');
      }
      const oidHex = aOid.val.toString('hex');
      if (seenAttrs.has(oidHex)) {
        throw new Error(`[TSA FAIL-CLOSED]: Phát hiện thuộc tính trùng lặp trong TSA signedAttrs (OID ${oidHex}) - Fail-Closed`);
      }
      seenAttrs.add(oidHex);

      const aSet = parseTLV(attr.val, aOid.next);
      if (!aSet || aSet.tag !== 0x31 || aSet.next !== attr.val.length) {
        throw new Error('[TSA FAIL-CLOSED]: Thuộc tính signedAttrs phải là SET có độ dài chính xác');
      }
      if (oidHex === '2a864886f70d010904') {
        const oct = parseTLV(aSet.val, 0);
        if (!oct || oct.tag !== 0x04 || oct.next !== aSet.val.length || oct.val.length !== 32) {
          throw new Error('[TSA FAIL-CLOSED]: messageDigest trong signedAttrs không hợp lệ');
        }
        tsaEmbeddedMessageDigest = oct.val;
      } else if (oidHex === '2a864886f70d010903') {
        const coid = parseTLV(aSet.val, 0);
        if (!coid || coid.tag !== 0x06 || coid.next !== aSet.val.length) {
          throw new Error('[TSA FAIL-CLOSED]: contentType trong signedAttrs không hợp lệ');
        }
        tsaEmbeddedContentType = coid.val.toString('hex');
      }
      saP = attr.next;
    }

    if (!tsaEmbeddedContentType || tsaEmbeddedContentType !== '2a864886f70d0109100104') {
      throw new Error('[TSA FAIL-CLOSED]: TSA signedAttrs contentType không phải là id-ct-TSTInfo!');
    }
    if (!tsaEmbeddedMessageDigest || !expectedTstInfoHash.equals(tsaEmbeddedMessageDigest)) {
      throw new Error('[TSA FAIL-CLOSED]: TSA signedAttrs messageDigest không khớp với mã băm của TSTInfo!');
    }

    // CONTRACT: parseTimeStampResp | Xác thực TSA signedAttrs: chống OID trùng lặp, SET đúng 1 phần tử messageDigest OCTET STRING và contentType id-ct-TSTInfo.
    // 7.3 Trích xuất toàn bộ chuỗi chứng thư và xác minh Cryptographic Chain of Trust
    let matchedTsaCertDer = null;
    let matchedTsaCount = 0;
    const allCerts = [];
    let cP = 0;
    while (cP < certsPart.val.length) {
      const cTLV = parseTLV(certsPart.val, cP);
      if (!cTLV || cTLV.tag !== 0x30) {
        throw new Error('[TSA FAIL-CLOSED]: Cấu trúc chứng thư không hợp lệ trong certificates container (Fail-Closed)');
      }
      const cDer = certsPart.val.subarray(cTLV.pos, cTLV.next);
      const meta = extractIssuerAndSerialFromCert(cDer);
      if (meta && meta.issuerDer.equals(targetIssuerDer) && meta.serialDer.equals(targetSerialDer)) {
        matchedTsaCertDer = cDer;
        matchedTsaCount++;
      }
      allCerts.push(new crypto.X509Certificate(cDer));
      cP = cTLV.next;
    }
    if (cP !== certsPart.val.length) {
      throw new Error('[TSA FAIL-CLOSED]: certificates container chứa trailing bytes chưa được tiêu thụ');
    }

    if (matchedTsaCount > 1) {
      throw new Error('[TSA FAIL-CLOSED]: Phát hiện nhiều chứng thư trùng khớp SignerInfo.sid (Multiple certificates match SignerInfo.sid)');
    }
    if (!matchedTsaCertDer || matchedTsaCount === 0) {
      throw new Error('[TSA FAIL-CLOSED]: Không tìm thấy chứng thư TSA khớp với IssuerAndSerialNumber trong SignerInfo.sid!');
    }

    const tsaX509 = new crypto.X509Certificate(matchedTsaCertDer);
    tsaCertSubject = tsaX509.subject;
    tsaCertIssuer = tsaX509.issuer;

    // 7.4 Kiểm tra BasicConstraints và Extended Key Usage của Leaf TSA
    if (tsaX509.ca === true) {
      throw new Error('[TSA FAIL-CLOSED]: Chứng thư TSA là chứng thư CA (vi phạm nguyên tắc Leaf TSA)');
    }
    if (!hasTimeStampingEKU(tsaX509)) {
      throw new Error('[TSA FAIL-CLOSED]: Chứng thư TSA thiếu ExtendedKeyUsage id-kp-timeStamping (1.3.6.1.5.5.7.3.8) theo RFC 3161!');
    }

    // 7.5 Xây dựng và xác minh toàn vẹn chuỗi chứng thư X.509 Path Validation (RFC 5280)
    const OFFICIAL_ROOT_CA_G2_FINGERPRINT = 'F0:4B:A4:B4:59:A7:C9:A1:B9:71:AD:9B:1C:B8:33:E6:95:A8:0C:79:AE:A6:3B:17:4B:66:A7:0E:DF:E2:FD:B8';
    const pathValidation = validateX509CertificatePath(tsaX509, allCerts, OFFICIAL_ROOT_CA_G2_FINGERPRINT, { validationTime: tokenDate });
    if (!pathValidation.isValid) {
      throw new Error('[TSA FAIL-CLOSED]: ' + pathValidation.reason);
    }
    const rootCaX509 = pathValidation.rootCa;

    // 7.6 Xác minh vân tay SHA-256 của Leaf TSA (Trust Anchor Pinning)
    const isPinned = this.pinnedFingerprints.has(tsaX509.fingerprint256);
    if (this.enforceTsaPinning && !isPinned) {
      throw new Error(`[TSA FAIL-CLOSED]: Chứng thư TSA không khớp vân tay SHA-256 được ghim cứng của Ban Cơ yếu Chính phủ (Nhận: ${tsaX509.fingerprint256}, Yêu cầu một trong: ${Array.from(this.pinnedFingerprints).join(', ')})`);
    }

    // CONTRACT: validateX509CertificatePath | Xác minh chuỗi chứng thư tại thời điểm tokenDate; kiểm tra thời hạn phải dùng cùng mốc thời gian.
    if (!(tokenDate instanceof Date) || Number.isNaN(tokenDate.getTime())) throw new Error('[TSA FAIL-CLOSED]: tokenDate không hợp lệ');
    const leafFrom = new Date(tsaX509.validFrom);
    const leafTo = new Date(tsaX509.validTo);
    const rootFrom = new Date(rootCaX509.validFrom);
    const rootTo = new Date(rootCaX509.validTo);
    if (tokenDate < leafFrom || tokenDate > leafTo || Number.isNaN(leafFrom.getTime()) || Number.isNaN(leafTo.getTime())) {
      throw new Error(`[TSA FAIL-CLOSED]: Chứng thư TSA không hợp lệ tại thời điểm token (${tsaX509.validFrom} - ${tsaX509.validTo})!`);
    }
    if (tokenDate < rootFrom || tokenDate > rootTo || Number.isNaN(rootFrom.getTime()) || Number.isNaN(rootTo.getTime())) {
      throw new Error(`[TSA FAIL-CLOSED]: RootCA không hợp lệ tại thời điểm token (${rootCaX509.validFrom} - ${rootCaX509.validTo})!`);
    }

    // 7.6 Xác thực chữ ký số RSA-SHA256 trên signedAttrs SET
    const signedAttrsSet = Buffer.concat([
      Buffer.from([0x31]),
      encodeLength(signedAttrsPart.val.length),
      signedAttrsPart.val
    ]);

    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(signedAttrsSet);
    verifier.end();
    isTsaCryptoSigValid = verifier.verify(tsaX509.publicKey, sigVal.val);

    if (!isTsaCryptoSigValid) {
      throw new Error('[TSA FAIL-CLOSED]: Chữ ký số mật mã RSA của máy chủ TSA không hợp lệ!');
    }

    return {
      statusCode: statusCode,
      statusDesc: statusCode === 0 ? 'GRANTED' : 'GRANTED_WITH_MODS',
      timeStampToken: timeStampToken,
      genTime: tstInfo.genTime,
      serialNumber: tstInfo.serialNumber,
      verifiedNonce: cleanVerified.toString('hex'),
      verifiedImprint: tstInfo.hashedMessage.toString('hex'),
      tsaCertSubject: tsaCertSubject,
      tsaCertIssuer: tsaCertIssuer,
      tsaCertFingerprint: tsaX509.fingerprint256,
      tsaTrustModel: {
        level: 'VGCA_PINNED_TRUST_ANCHOR',
        trustAnchor: 'RootCA chuyên dùng Chính phủ G2 (Ban Cơ yếu Chính phủ)',
        fingerprint: tsaX509.fingerprint256,
        rootCaFingerprint: rootCaX509.fingerprint256,
        isPinned: isPinned,
        isGovRootCa: true,
        revocationStatus: 'DEFERRED_TO_PHASE3_GATEWAY'
      },
      isTsaCryptoSigValid: isTsaCryptoSigValid,
      rawResp: respBuffer
    };
  }

  async requestTimestamp(hashBuffer) {
    const { tspReqBuffer, nonce, expectedHash } = this.buildTimeStampReq(hashBuffer);
    const url = new URL(this.tsaUrl);
    const isHttps = url.protocol === 'https:';
    const transport = isHttps ? https : http;

    let lastError = null;
    for (let attempt = 1; attempt <= this.maxRetries + 1; attempt++) {
      try {
        const respBuf = await this._sendHttpRequest(transport, url, isHttps, tspReqBuffer);
        const parsed = this.parseTimeStampResp(respBuf, nonce, expectedHash);
        return parsed;
      } catch (err) {
        lastError = err;
        console.warn(`[TSA ATTEMPT ${attempt} FAILED]: ${err.message}`);
        if (err.message.includes('FAIL-CLOSED')) {
          throw err;
        }
        if (attempt <= this.maxRetries) {
          const delay = this.retryDelayMs * Math.pow(2, attempt - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    if (this.allowMockFallback) {
      if (process.env.NODE_ENV === 'production') throw new Error('[TSA FAIL-CLOSED]: Mock fallback bị cấm trong production!');
      return this._generateMockTimestampToken(hashBuffer, nonce);
    }

    throw new Error(`[TSA CRITICAL ERROR]: Không thể kết nối tới máy chủ Dấu thời gian Ban Cơ yếu Chính phủ (${this.tsaUrl}) sau ${this.maxRetries + 1} lần thử: ${lastError.message}`);
  }

  // CONTRACT: _sendHttpRequest | Gửi request TSA giới hạn kích thước, fail-closed khi lỗi transport, status hoặc Content-Type.
  _sendHttpRequest(transport, url, isHttps, tspReqBuffer) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method: 'POST',
        headers: { 'Content-Type': 'application/timestamp-query', Accept: 'application/timestamp-reply', 'User-Agent': 'VGCASignTool-WebSigner/2.0', 'Content-Length': tspReqBuffer.length },
        timeout: this.timeoutMs
      };
      const req = transport.request(options, (res) => {
        res.on('error', reject);
        const maxResponseBytes = 1024 * 1024;
        let responseBytes = 0;
        const chunks = [];
        res.on('data', (chunk) => {
          responseBytes += chunk.length;
          if (responseBytes > maxResponseBytes) {
            res.destroy();
            reject(new Error(`[TSA FAIL-CLOSED]: Response exceeds ${maxResponseBytes} bytes`));
            return;
          }
          chunks.push(chunk);
        });
        res.on('end', () => {
          const respBuf = Buffer.concat(chunks);
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode} ${res.statusMessage} - ${respBuf.toString('utf8').substring(0, 150)}`));
            return;
          }
          const contentType = String(res.headers['content-type'] || '').split(';', 1)[0].trim().toLowerCase();
          if (contentType !== 'application/timestamp-reply') {
            reject(new Error(`[TSA FAIL-CLOSED]: Unexpected Content-Type: ${contentType}`));
            return;
          }
          resolve(respBuf);
        });
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error(`[TSA TIMEOUT]: Timeout sau ${this.timeoutMs}ms`)); });
      req.write(tspReqBuffer); req.end();
    });
  }

  // CONTRACT: _generateMockTimestampToken | Vô hiệu hóa mock fallback; fail-closed tuyệt đối theo tiêu chuẩn an ninh mật mã Tier 3.
  _generateMockTimestampToken(hashBuffer, nonce) {
    throw new Error(
      '[TSA CRITICAL FAIL-CLOSED]: Mock timestamp token bị vô hiệu hóa hoàn toàn theo tiêu chuẩn mật mã cấp quốc gia RFC 3161 / ETSI EN 319 142. Nghiêm cấm tạo hoặc phát hành timestamp không có chữ ký số của Ban Cơ yếu Chính phủ.'
    );
  }
}

// CONTRACT: module.exports | Export class TsaClient và các tiện ích ASN.1 DER / X.509 RFC 5280 helpers thuần túy.
module.exports = TsaClient;
module.exports.TsaClient = TsaClient;
module.exports.extractIssuerAndSerialFromCert = extractIssuerAndSerialFromCert;
module.exports.parseTLV = parseTLV;
module.exports.encodeLength = encodeLength;
module.exports.encodeTLV = encodeTLV;
module.exports.encodeSeq = encodeSeq;
module.exports.encodeSet = encodeSet;
module.exports.encodeOctetString = encodeOctetString;
module.exports.encodeOID = encodeOID;
module.exports.encodeCanonicalInteger = encodeCanonicalInteger;
module.exports.encodeUTCTime = encodeUTCTime;
module.exports.hasTimeStampingEKU = hasTimeStampingEKU;
module.exports.validateX509CertificatePath = validateX509CertificatePath;
module.exports.parseBasicConstraintsFromDer = parseBasicConstraintsFromDer;
module.exports.parseKeyUsageFromDer = parseKeyUsageFromDer;
