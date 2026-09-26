/**
 * PDF PADES SIGNER MODULE (ISO 32000-1 / ETSI EN 319 142 / RFC 5652)
 * Tính toán ByteRange, Băm SHA-256, Đóng gói Chữ ký số VGCA & Dấu thời gian TSA
 * Tuân thủ Nghị định 30/2020/NĐ-CP về thể thức văn bản và chữ ký số chuyên dùng
 * 
 * Đã qua thẩm định và kiểm chứng mật mã học cùng OpenAI Codex (Round 6 - Industrial Security):
 * 1. Bắt buộc chuẩn PAdES-B-T (fail-closed nếu thiếu Dấu thời gian điện tử).
 * 2. Xác thực toàn diện tính hợp lệ của TimeStampToken trước khi nhúng vào PDF.
 * 3. Kiểm định chính xác danh tính người ký và chứng thư TSA theo issuerAndSerialNumber trong SignerInfo.sid (cấm fallback).
 * 4. Kiểm tra thời hạn hiệu lực của chứng thư TSA và chứng thư người ký (validFrom <= now <= validTo).
 * 5. Kiểm tra zero-padding trong vùng /Contents sau CMS DER (triệt tiêu rủi ro dữ liệu ẩn).
 * 6. Xác minh mật mã học đa tầng toàn diện (Multi-layer Cryptographic Verification).
 */

const crypto = require('crypto');
const { PDFDocument, PDFName, PDFDict, PDFArray, PDFRef, PDFHexString, PDFString, PDFNumber, rgb, StandardFonts } = require('pdf-lib');
const TsaClient = require('./tsa-client');
const { 
  parseTLV,
  encodeLength,
  encodeTLV,
  encodeSeq,
  encodeSet,
  encodeOctetString,
  encodeOID,
  encodeCanonicalInteger,
  encodeUTCTime,
  extractIssuerAndSerialFromCert, 
  validateX509CertificatePath, 
  hasTimeStampingEKU, 
  parseBasicConstraintsFromDer, 
  parseKeyUsageFromDer 
} = TsaClient;

function removeVietnameseAccents(str) {
  if (str === null || str === undefined) return '';
  if (typeof str !== 'string') throw new TypeError('removeVietnameseAccents requires a string input');
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

// OID Constants
const OID = {
  id_data: '2a864886f70d010701',                 // 1.2.840.113549.1.7.1
  id_signedData: '2a864886f70d010702',           // 1.2.840.113549.1.7.2
  sha256: '608648016503040201',                  // 2.16.840.1.101.3.4.2.1
  contentType: '2a864886f70d010903',             // 1.2.840.113549.1.9.3
  messageDigest: '2a864886f70d010904',           // 1.2.840.113549.1.9.4
  signingTime: '2a864886f70d010905',             // 1.2.840.113549.1.9.5
  id_aa_sigTimeStamp: '2a864886f70d010910020e',  // 1.2.840.113549.1.9.16.2.14
  ecdsa_with_SHA256: '2a8648ce3d040302',         // 1.2.840.10045.4.3.2
  rsaEncryption: '2a864886f70d010101',           // 1.2.840.113549.1.1.1
  sha256WithRSA: '2a864886f70d01010b'            // 1.2.840.113549.1.1.11
};

const sha256AlgId = encodeSeq([encodeOID(OID.sha256), Buffer.from([0x05, 0x00])]);

/**
 * Tiện ích sinh chứng thư số X.509 v3 tự ký (Self-Signed) cho ECDSA P-256
 */
function generateSelfSignedX509(keyPair, commonName = 'Nguyen Van A - THCS Chu Van An', options = {}) {
  if (!keyPair || typeof keyPair !== 'object') {
    throw new TypeError('generateSelfSignedX509: keyPair must be an object containing privateKey and publicKey');
  }
  const { privateKey, publicKey } = keyPair;
  if (!privateKey || !publicKey) {
    throw new TypeError('generateSelfSignedX509: keyPair must contain both privateKey and publicKey KeyObjects');
  }

  if (privateKey.type !== 'private' || publicKey.type !== 'public') {
    throw new TypeError('generateSelfSignedX509: privateKey must be private and publicKey must be public');
  }

  if (
    privateKey.asymmetricKeyType !== 'ec' ||
    publicKey.asymmetricKeyType !== 'ec' ||
    privateKey.asymmetricKeyDetails?.namedCurve !== 'prime256v1' ||
    publicKey.asymmetricKeyDetails?.namedCurve !== 'prime256v1'
  ) {
    throw new TypeError('generateSelfSignedX509: both keys must be ECDSA P-256');
  }

  // Xác thực tham số commonName (chuỗi không rỗng sau khi trim, giới hạn độ dài theo chuẩn X.500 <= 256)
  if (typeof commonName !== 'string') {
    throw new TypeError('generateSelfSignedX509: commonName must be a string');
  }
  const normalizedCommonName = commonName.trim();
  if (normalizedCommonName.length === 0 || normalizedCommonName.length > 256) {
    throw new TypeError('generateSelfSignedX509: commonName must be a non-empty string with length <= 256 after trim');
  }

  // Xác thực tham số options nếu được truyền vào
  if (options !== undefined && (typeof options !== 'object' || options === null || Array.isArray(options))) {
    throw new TypeError('generateSelfSignedX509: options must be an object');
  }

  // Đối chiếu public key xuất từ privateKey với publicKey được truyền vào
  const derivedPublicKeyDer = crypto.createPublicKey(privateKey).export({ type: 'spki', format: 'der' });
  const spkiDer = publicKey.export({ type: 'spki', format: 'der' });
  if (!derivedPublicKeyDer.equals(spkiDer)) {
    throw new Error('generateSelfSignedX509: privateKey does not match publicKey in keyPair');
  }

  const version = encodeTLV(0xa0, Buffer.from([0x02, 0x01, 0x02]));

  const rawSerial = crypto.randomBytes(8);
  rawSerial[0] = rawSerial[0] & 0x7f;
  if (rawSerial[0] === 0) rawSerial[0] = 1;
  const serialNumber = encodeCanonicalInteger(rawSerial);

  // OID: 1.2.840.10045.4.3.2 (ecdsa-with-SHA256)
  const sigAlgId = encodeSeq([encodeTLV(0x06, Buffer.from('2a8648ce3d040302', 'hex'))]);

  const nameSeq = encodeSeq([
    encodeSet([encodeSeq([encodeTLV(0x06, Buffer.from('550406', 'hex')), encodeTLV(0x13, Buffer.from('VN', 'ascii'))])]),
    encodeSet([encodeSeq([encodeTLV(0x06, Buffer.from('55040a', 'hex')), encodeTLV(0x0c, Buffer.from('THCS Chu Van An', 'utf8'))])]),
    encodeSet([encodeSeq([encodeTLV(0x06, Buffer.from('550403', 'hex')), encodeTLV(0x0c, Buffer.from(normalizedCommonName, 'utf8'))])])
  ]);

  // Kiểm tra kiểu và tính hợp lệ của notBefore và notAfter
  let notBefore;
  if (options.notBefore !== undefined) {
    if (!(options.notBefore instanceof Date) || isNaN(options.notBefore.getTime())) {
      throw new TypeError('options.notBefore must be a valid Date object');
    }
    notBefore = options.notBefore;
  } else {
    notBefore = new Date(Date.now() - 86400000);
  }

  let notAfter;
  if (options.notAfter !== undefined) {
    if (!(options.notAfter instanceof Date) || isNaN(options.notAfter.getTime())) {
      throw new TypeError('options.notAfter must be a valid Date object');
    }
    notAfter = options.notAfter;
  } else {
    notAfter = new Date(Date.now() + 365 * 86400000);
  }

  if (notBefore.getTime() >= notAfter.getTime()) {
    throw new RangeError('options.notBefore must be strictly earlier than options.notAfter');
  }

  const notBeforeYear = notBefore.getUTCFullYear();
  const notAfterYear = notAfter.getUTCFullYear();
  if (notBeforeYear < 1950 || notBeforeYear > 2049) {
    throw new RangeError('options.notBefore year must be between 1950 and 2049 for ASN.1 UTCTime encoding');
  }
  if (notAfterYear < 1950 || notAfterYear > 2049) {
    throw new RangeError('options.notAfter year must be between 1950 and 2049 for ASN.1 UTCTime encoding');
  }

  const validity = encodeSeq([encodeUTCTime(notBefore), encodeUTCTime(notAfter)]);

  const subjectPublicKeyInfo = spkiDer;

  let issuerName;
  if (options.issuerNameSeq !== undefined) {
    if (!Buffer.isBuffer(options.issuerNameSeq) || options.issuerNameSeq.length === 0) {
      throw new TypeError('options.issuerNameSeq must be a non-empty Buffer containing ASN.1 SEQUENCE DER');
    }
    const rootTlv = parseTLV(options.issuerNameSeq, 0);
    if (!rootTlv || rootTlv.tag !== 0x30 || rootTlv.pos !== 0 || rootTlv.next !== options.issuerNameSeq.length) {
      throw new Error('options.issuerNameSeq must be a single canonical ASN.1 SEQUENCE with no trailing bytes');
    }
    let pos = 0;
    let rdnCount = 0;
    while (pos < rootTlv.val.length) {
      const setTlv = parseTLV(rootTlv.val, pos);
      if (!setTlv || setTlv.tag !== 0x31) {
        throw new Error('options.issuerNameSeq: RelativeDistinguishedName must be an ASN.1 SET (0x31)');
      }
      let atavPos = 0;
      let atavCount = 0;
      while (atavPos < setTlv.val.length) {
        const atavTlv = parseTLV(setTlv.val, atavPos);
        if (!atavTlv || atavTlv.tag !== 0x30) {
          throw new Error('options.issuerNameSeq: AttributeTypeAndValue must be an ASN.1 SEQUENCE (0x30)');
        }
        const oidTlv = parseTLV(atavTlv.val, 0);
        if (!oidTlv || oidTlv.tag !== 0x06) {
          throw new Error('options.issuerNameSeq: AttributeType must be an OBJECT IDENTIFIER (0x06)');
        }
        const valTlv = parseTLV(atavTlv.val, oidTlv.next);
        if (!valTlv || valTlv.next !== atavTlv.val.length) {
          throw new Error('options.issuerNameSeq: AttributeValue must be valid with no trailing bytes');
        }
        atavCount++;
        atavPos = atavTlv.next;
      }
      if (atavCount === 0 || atavPos !== setTlv.val.length) {
        throw new Error('options.issuerNameSeq: RDN SET contains invalid structure or trailing bytes');
      }
      rdnCount++;
      pos = setTlv.next;
    }
    if (rdnCount === 0 || pos !== rootTlv.val.length) {
      throw new Error('options.issuerNameSeq: RDNSequence contains invalid structure or trailing bytes');
    }
    issuerName = options.issuerNameSeq;
  } else {
    issuerName = nameSeq;
  }

  const tbsItems = [
    version,
    serialNumber,
    sigAlgId,
    issuerName,
    validity,
    nameSeq,
    subjectPublicKeyInfo
  ];

  const extsList = [];
  if (options.isCA) {
    let bcVal;
    if (options.pathLenConstraint !== undefined) {
      if (!Number.isInteger(options.pathLenConstraint) || options.pathLenConstraint < 0 || options.pathLenConstraint > 255) {
        throw new RangeError('options.pathLenConstraint must be an integer between 0 and 255');
      }
      bcVal = encodeSeq([
        encodeTLV(0x01, Buffer.from([0xff])),
        encodeCanonicalInteger(options.pathLenConstraint)
      ]);
    } else {
      bcVal = encodeSeq([encodeTLV(0x01, Buffer.from([0xff]))]);
    }
    const extSeq = encodeSeq([
      encodeTLV(0x06, Buffer.from('551d13', 'hex')),
      encodeTLV(0x01, Buffer.from([0xff])),
      encodeTLV(0x04, bcVal)
    ]);
    extsList.push(extSeq);
  }

  function validateOidDerBytes(oidBuf) {
    if (!Buffer.isBuffer(oidBuf) || oidBuf.length === 0) {
      throw new TypeError('OID DER payload must be a non-empty Buffer');
    }
    if (oidBuf.length > 64) {
      throw new RangeError('OID DER payload exceeds maximum supported length (64 bytes)');
    }
    if ((oidBuf[oidBuf.length - 1] & 0x80) !== 0) {
      throw new Error('OID DER payload ends prematurely (final arc octet has bit 7 set)');
    }
    let arcStart = true;
    for (let i = 0; i < oidBuf.length; i++) {
      const b = oidBuf[i];
      if (arcStart && b === 0x80) {
        throw new Error('OID DER payload contains non-canonical leading zero in VLQ arc');
      }
      arcStart = (b & 0x80) === 0;
    }
    return true;
  }

  function validateExtensionDer(extBuf) {
    if (!Buffer.isBuffer(extBuf) || extBuf.length === 0) {
      throw new TypeError('Extension must be a non-empty Buffer');
    }
    const root = parseTLV(extBuf, 0);
    if (!root || root.tag !== 0x30 || root.pos !== 0 || root.next !== extBuf.length) {
      throw new Error('Extension must be a single canonical ASN.1 SEQUENCE (0x30) with no trailing bytes');
    }
    let pos = 0;
    const oidTlv = parseTLV(root.val, pos);
    if (!oidTlv || oidTlv.tag !== 0x06 || oidTlv.len === 0) {
      throw new Error('Extension.extnID must be an OBJECT IDENTIFIER (0x06)');
    }
    validateOidDerBytes(oidTlv.val);
    pos = oidTlv.next;

    let nextTlv = parseTLV(root.val, pos);
    if (nextTlv && nextTlv.tag === 0x01) {
      if (nextTlv.len !== 1 || (nextTlv.val[0] !== 0x00 && nextTlv.val[0] !== 0xff)) {
        throw new Error('Extension.critical must be a canonical BOOLEAN (0x00 or 0xff)');
      }
      pos = nextTlv.next;
      nextTlv = parseTLV(root.val, pos);
    }

    if (!nextTlv || nextTlv.tag !== 0x04) {
      throw new Error('Extension.extnValue must be an OCTET STRING (0x04)');
    }
    pos = nextTlv.next;

    if (pos !== root.val.length) {
      throw new Error('Extension SEQUENCE contains trailing bytes');
    }
    return true;
  }

  if (options.keyUsage !== undefined) {
    let bitStringVal;
    if (typeof options.keyUsage === 'number') {
      if (!Number.isInteger(options.keyUsage) || options.keyUsage < 0 || options.keyUsage > 255) {
        throw new RangeError('options.keyUsage must be an integer byte (0-255)');
      }
      const kuByte = options.keyUsage;
      const unusedBits = (kuByte & 0x01) ? 0x00 : 0x01;
      bitStringVal = Buffer.from([unusedBits, kuByte]);
    } else if (typeof options.keyUsage === 'object' && options.keyUsage !== null && !Array.isArray(options.keyUsage)) {
      const ku = options.keyUsage;
      const validProps = [
        'digitalSignature', 'nonRepudiation', 'keyEncipherment',
        'dataEncipherment', 'keyAgreement', 'keyCertSign', 'cRLSign',
        'encipherOnly', 'decipherOnly'
      ];
      for (const k of Object.keys(ku)) {
        if (!validProps.includes(k)) {
          throw new TypeError(`options.keyUsage contains unknown property: ${k}`);
        }
        if (ku[k] !== undefined && typeof ku[k] !== 'boolean') {
          throw new TypeError(`options.keyUsage.${k} must be a boolean or undefined`);
        }
      }
      let byte0 = 0x00;
      let byte1 = 0x00;
      if (ku.digitalSignature === true) byte0 |= 0x80;
      if (ku.nonRepudiation === true) byte0 |= 0x40;
      if (ku.keyEncipherment === true) byte0 |= 0x20;
      if (ku.dataEncipherment === true) byte0 |= 0x10;
      if (ku.keyAgreement === true) byte0 |= 0x08;
      if (ku.keyCertSign === true) byte0 |= 0x04;
      if (ku.cRLSign === true) byte0 |= 0x02;
      if (ku.encipherOnly === true) byte0 |= 0x01;
      if (ku.decipherOnly === true) byte1 |= 0x80;

      if (byte1 !== 0x00) {
        bitStringVal = Buffer.from([0x07, byte0, byte1]);
      } else if (byte0 & 0x01) {
        bitStringVal = Buffer.from([0x00, byte0]);
      } else {
        bitStringVal = Buffer.from([0x01, byte0]);
      }
    } else {
      throw new TypeError('options.keyUsage must be a number or an object');
    }
    const extVal = encodeTLV(0x03, bitStringVal);
    const extSeq = encodeSeq([
      encodeTLV(0x06, Buffer.from('551d0f', 'hex')),
      encodeTLV(0x01, Buffer.from([0xff])),
      encodeTLV(0x04, extVal)
    ]);
    extsList.push(extSeq);
  }

  if (options.extKeyUsageOids !== undefined) {
    if (!Array.isArray(options.extKeyUsageOids)) {
      throw new TypeError('options.extKeyUsageOids must be an array of hex strings');
    }
    const oidsEncoded = options.extKeyUsageOids.map(oidHex => {
      if (typeof oidHex !== 'string' || !/^[0-9a-fA-F]+$/.test(oidHex) || oidHex.length % 2 !== 0) {
        throw new TypeError('each element of options.extKeyUsageOids must be a valid hex string');
      }
      const rawOid = Buffer.from(oidHex, 'hex');
      validateOidDerBytes(rawOid);
      return encodeTLV(0x06, rawOid);
    });
    const ekuSyntax = encodeSeq(oidsEncoded);
    const extSeq = encodeSeq([
      encodeTLV(0x06, Buffer.from('551d25', 'hex')),
      encodeTLV(0x04, ekuSyntax)
    ]);
    extsList.push(extSeq);
  }

  if (options.customExtensions !== undefined) {
    if (!Array.isArray(options.customExtensions)) {
      throw new TypeError('options.customExtensions must be an array of Buffers');
    }
    const seenOids = new Set();
    if (options.isCA) seenOids.add('551d13');
    if (options.keyUsage !== undefined) seenOids.add('551d0f');
    if (options.extKeyUsageOids !== undefined) seenOids.add('551d25');

    for (const ce of options.customExtensions) {
      if (!Buffer.isBuffer(ce)) {
        throw new TypeError('each element of options.customExtensions must be a Buffer');
      }
      validateExtensionDer(ce);
      const ceRoot = parseTLV(ce, 0);
      const ceOid = parseTLV(ceRoot.val, 0).val.toString('hex').toLowerCase();
      if (seenOids.has(ceOid)) {
        throw new Error(`customExtension contains duplicate or conflicting extension OID: ${ceOid}`);
      }
      seenOids.add(ceOid);
      extsList.push(ce);
    }
  }

  if (extsList.length > 0) {
    const extContainer = encodeTLV(0xa3, encodeSeq(extsList));
    tbsItems.push(extContainer);
  }

  const tbsCert = encodeSeq(tbsItems);

  let signingKey;
  if (options.issuerPrivateKey !== undefined) {
    if (!options.issuerPrivateKey || typeof options.issuerPrivateKey !== 'object' || options.issuerPrivateKey.type !== 'private') {
      throw new TypeError('options.issuerPrivateKey must be a private KeyObject');
    }
    signingKey = options.issuerPrivateKey;
  } else {
    signingKey = privateKey;
  }
  const signer = crypto.createSign('SHA256');
  signer.update(tbsCert);
  signer.end();
  const signatureDer = signer.sign(signingKey);

  const sigBitString = encodeTLV(0x03, Buffer.concat([Buffer.from([0x00]), signatureDer]));

  const certDer = encodeSeq([
    tbsCert,
    sigAlgId,
    sigBitString
  ]);

  return {
    certDer: certDer,
    nameSeq: nameSeq,
    serialNumber: serialNumber
  };
}

class PdfPadesSigner {
  constructor(options = {}) {
    if (options !== undefined && (typeof options !== 'object' || options === null || Array.isArray(options))) {
      throw new TypeError('PdfPadesSigner constructor: options must be an object');
    }
    const opts = options || {};
    if (opts.placeholderHexLength !== undefined) {
      if (!Number.isInteger(opts.placeholderHexLength) || opts.placeholderHexLength < 1024 || opts.placeholderHexLength > 1048576 || opts.placeholderHexLength % 2 !== 0) {
        throw new RangeError('options.placeholderHexLength must be an even integer between 1024 and 1048576');
      }
      this.placeholderHexLength = opts.placeholderHexLength;
    } else {
      this.placeholderHexLength = 32768;
    }

    if (opts.tsaClient !== undefined) {
      if (!opts.tsaClient || typeof opts.tsaClient !== 'object' || typeof opts.tsaClient.requestTimestamp !== 'function') {
        throw new TypeError('options.tsaClient must be an object implementing requestTimestamp(hashBuffer)');
      }
      this.tsaClient = opts.tsaClient;
    } else {
      this.tsaClient = new TsaClient({ allowMockFallback: false });
    }
  }

  async preparePdfForSigning(pdfBuffer, options = {}) {
    if (!Buffer.isBuffer(pdfBuffer) || pdfBuffer.length === 0) {
      throw new TypeError('preparePdfForSigning: pdfBuffer must be a non-empty Buffer');
    }
    if (options !== undefined && (typeof options !== 'object' || options === null || Array.isArray(options))) {
      throw new TypeError('preparePdfForSigning: options must be an object');
    }

    const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
    const pages = pdfDoc.getPages();
    if (!pages || pages.length === 0) {
      throw new Error('preparePdfForSigning: PDF document contains no pages');
    }

    let pageIndex;
    if (options.pageIndex !== undefined) {
      if (!Number.isInteger(options.pageIndex) || options.pageIndex < 0 || options.pageIndex >= pages.length) {
        throw new RangeError(`preparePdfForSigning: pageIndex must be an integer between 0 and ${pages.length - 1}`);
      }
      pageIndex = options.pageIndex;
    } else {
      pageIndex = 0;
    }
    const targetPage = pages[pageIndex];

    let stampW;
    if (options.width !== undefined) {
      if (typeof options.width !== 'number' || !Number.isFinite(options.width) || options.width <= 0) {
        throw new RangeError('options.width must be a positive finite number');
      }
      stampW = options.width;
    } else {
      stampW = 215;
    }

    let stampH;
    if (options.height !== undefined) {
      if (typeof options.height !== 'number' || !Number.isFinite(options.height) || options.height <= 0) {
        throw new RangeError('options.height must be a positive finite number');
      }
      stampH = options.height;
    } else {
      stampH = 80;
    }

    let stampX;
    if (options.x !== undefined) {
      if (typeof options.x !== 'number' || !Number.isFinite(options.x) || options.x < 0) {
        throw new RangeError('options.x must be a non-negative finite number');
      }
      stampX = options.x;
    } else {
      stampX = 340;
    }

    let stampY;
    if (options.y !== undefined) {
      if (typeof options.y !== 'number' || !Number.isFinite(options.y) || options.y < 0) {
        throw new RangeError('options.y must be a non-negative finite number');
      }
      stampY = options.y;
    } else {
      stampY = 100;
    }

    if (options.visualStamp !== false) {
      const signerName = typeof options.signerName === 'string' && options.signerName.trim().length > 0
        ? removeVietnameseAccents(options.signerName.trim())
        : 'Giao vien Chu Van An';
      const reason = typeof options.reason === 'string' && options.reason.trim().length > 0
        ? removeVietnameseAccents(options.reason.trim())
        : 'Ky duyet giao an / ho so chuyen mon';
      const orgName = typeof options.orgName === 'string' && options.orgName.trim().length > 0
        ? removeVietnameseAccents(options.orgName.trim())
        : 'Truong THCS & THPT Chu Van An';

      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const fontReg = await pdfDoc.embedFont(StandardFonts.Helvetica);

      targetPage.drawRectangle({
        x: stampX,
        y: stampY,
        width: stampW,
        height: stampH,
        borderColor: rgb(0.85, 0.1, 0.1),
        borderWidth: 1.5,
        color: rgb(0.99, 0.98, 0.98)
      });

      targetPage.drawText('CHU KY SO CHUYEN DUNG VGCA', {
        x: stampX + 8,
        y: stampY + 60,
        size: 8.5,
        font: fontBold,
        color: rgb(0.85, 0.1, 0.1)
      });

      targetPage.drawText(`Ky boi: ${signerName}`, {
        x: stampX + 8,
        y: stampY + 45,
        size: 8,
        font: fontReg,
        color: rgb(0.1, 0.1, 0.1)
      });

      targetPage.drawText(`Don vi: ${orgName}`, {
        x: stampX + 8,
        y: stampY + 30,
        size: 7.5,
        font: fontReg,
        color: rgb(0.1, 0.1, 0.1)
      });

      const signDateStr = new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' });
      targetPage.drawText(`Ngay ky: ${signDateStr}`, {
        x: stampX + 8,
        y: stampY + 15,
        size: 7,
        font: fontReg,
        color: rgb(0.3, 0.3, 0.3)
      });
    }

    const placeholderZeros = '0'.repeat(this.placeholderHexLength);
    const byteRangePlaceholder = [
      PDFNumber.of(0),
      PDFNumber.of(1000000000),
      PDFNumber.of(1000000000),
      PDFNumber.of(1000000000)
    ];

    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    const pdfDate = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}+07'00'`;

    const sigDict = pdfDoc.context.obj({
      Type: 'Sig',
      Filter: 'Adobe.PPKLite',
      SubFilter: 'ETSI.CAdES.detached',
      ByteRange: byteRangePlaceholder,
      Contents: PDFHexString.of(placeholderZeros),
      Reason: PDFString.of(options.reason || 'Ky so chuyen mon - Ban Co yeu Chinh phu'),
      M: PDFString.of(`D:${pdfDate}`),
      Location: PDFString.of('THCS & THPT Chu Van An')
    });
    const sigRef = pdfDoc.context.register(sigDict);

    const widgetDict = pdfDoc.context.obj({
      Type: 'Annot',
      Subtype: 'Widget',
      FT: 'Sig',
      Rect: [stampX, stampY, stampX + stampW, stampY + stampH],
      V: sigRef,
      T: PDFString.of(`Signature_VGCA_${Date.now()}`),
      F: 4,
      P: targetPage.ref
    });
    const widgetRef = pdfDoc.context.register(widgetDict);

    targetPage.node.addAnnot(widgetRef);

    let acroFormRef = pdfDoc.catalog.get(PDFName.of('AcroForm'));
    let acroForm;
    if (!acroFormRef) {
      acroForm = pdfDoc.context.obj({
        Fields: [widgetRef],
        SigFlags: 3
      });
      pdfDoc.catalog.set(PDFName.of('AcroForm'), acroForm);
    } else {
      acroForm = pdfDoc.context.lookup(acroFormRef);
      let fields = acroForm.get(PDFName.of('Fields'));
      if (!fields) {
        fields = pdfDoc.context.obj([widgetRef]);
        acroForm.set(PDFName.of('Fields'), fields);
      } else {
        fields.push(widgetRef);
      }
      acroForm.set(PDFName.of('SigFlags'), PDFNumber.of(3));
    }

    const savedBytes = await pdfDoc.save({ useObjectStreams: false });
    const pdfBuf = Buffer.from(savedBytes);

    const contentsNeedle = Buffer.from(`<${placeholderZeros}>`, 'utf8');
    const contentsPos = pdfBuf.indexOf(contentsNeedle);
    if (contentsPos === -1) {
      throw new Error('[PDF SIGN ERROR]: Không thể định vị vị trí vùng đệm Contents trong PDF!');
    }

    const contentStart = contentsPos;
    const contentEnd = contentsPos + contentsNeedle.length;

    const b0 = 0;
    const b1 = contentStart;
    const b2 = contentEnd;
    const b3 = pdfBuf.length - contentEnd;

    const needleByteRange = Buffer.from('/ByteRange [ 0 1000000000 1000000000 1000000000 ]', 'utf8');
    const byteRangePos = pdfBuf.indexOf(needleByteRange);
    if (byteRangePos === -1) {
      const altNeedle = Buffer.from('/ByteRange[0 1000000000 1000000000 1000000000]', 'utf8');
      const altPos = pdfBuf.indexOf(altNeedle);
      if (altPos === -1) {
        throw new Error('[PDF SIGN ERROR]: Không thể định vị vị trí /ByteRange placeholder trong PDF!');
      }
      const actualByteRangeStr = `/ByteRange[${b0} ${String(b1).padStart(10, '0')} ${String(b2).padStart(10, '0')} ${String(b3).padStart(10, '0')}]`;
      pdfBuf.write(actualByteRangeStr, altPos, 'utf8');
    } else {
      const actualByteRangeStr = `/ByteRange [ ${b0} ${String(b1).padStart(10, '0')} ${String(b2).padStart(10, '0')} ${String(b3).padStart(10, '0')} ]`;
      pdfBuf.write(actualByteRangeStr, byteRangePos, 'utf8');
    }

    const part1 = pdfBuf.subarray(0, b1);
    const part2 = pdfBuf.subarray(b2, b2 + b3);

    const hash = crypto.createHash('sha256');
    hash.update(part1);
    hash.update(part2);
    const documentHash = hash.digest();

    const signingDate = new Date();
    const attrContentType = encodeSeq([
      encodeOID(OID.contentType),
      encodeSet([encodeOID(OID.id_data)])
    ]);
    const attrSigningTime = encodeSeq([
      encodeOID(OID.signingTime),
      encodeSet([encodeUTCTime(signingDate)])
    ]);
    const attrMessageDigest = encodeSeq([
      encodeOID(OID.messageDigest),
      encodeSet([encodeOctetString(documentHash)])
    ]);

    const signedAttrList = [attrContentType, attrMessageDigest, attrSigningTime];
    signedAttrList.sort((a, b) => Buffer.compare(a, b));

    const signedAttrsForHashing = encodeTLV(0x31, Buffer.concat(signedAttrList));
    const signedAttrsImplicit = encodeTLV(0xa0, Buffer.concat(signedAttrList));

    const signedAttrsHash = crypto.createHash('sha256').update(signedAttrsForHashing).digest();

    return {
      pdfWithPlaceholder: pdfBuf,
      documentHash: documentHash,
      documentHashBase64: documentHash.toString('base64'),
      signedAttrsHash: signedAttrsHash,
      signedAttrsHashBase64: signedAttrsHash.toString('base64'),
      signedAttrsForHashing: signedAttrsForHashing,
      signedAttrsImplicit: signedAttrsImplicit,
      signingDate: signingDate,
      contentsPos: contentsPos,
      contentsHexCapacity: this.placeholderHexLength,
      byteRange: [b0, b1, b2, b3]
    };
  }

  embedSignatureAndTimestamp(prepared, signResult, timeStampToken) {
    if (!timeStampToken || !Buffer.isBuffer(timeStampToken)) {
      throw new Error('[PADES FAIL-CLOSED]: PAdES Baseline-T bắt buộc phải có Dấu thời gian điện tử (TimeStampToken)!');
    }

    if (!prepared || typeof prepared !== 'object' || Array.isArray(prepared)) {
      throw new TypeError('[PADES FAIL-CLOSED]: prepared data must be a valid non-null object');
    }
    const {
      pdfWithPlaceholder,
      documentHash,
      signedAttrsImplicit,
      contentsPos,
      contentsHexCapacity,
      signingDate
    } = prepared;

    if (!Buffer.isBuffer(pdfWithPlaceholder) || pdfWithPlaceholder.length === 0) {
      throw new TypeError('[PADES FAIL-CLOSED]: prepared.pdfWithPlaceholder must be a non-empty Buffer');
    }
    if (!Number.isSafeInteger(contentsPos) || contentsPos < 0) {
      throw new TypeError('[PADES FAIL-CLOSED]: prepared.contentsPos must be a non-negative integer');
    }
    if (!Number.isSafeInteger(contentsHexCapacity) || contentsHexCapacity <= 0) {
      throw new TypeError('[PADES FAIL-CLOSED]: prepared.contentsHexCapacity must be a positive integer');
    }
    if (!Buffer.isBuffer(signedAttrsImplicit) || signedAttrsImplicit.length === 0) {
      throw new TypeError('[PADES FAIL-CLOSED]: prepared.signedAttrsImplicit must be a non-empty Buffer');
    }

    if (!signResult || typeof signResult !== 'object' || Array.isArray(signResult)) {
      throw new TypeError('[PADES FAIL-CLOSED]: signResult must be a valid non-null object');
    }
    if (typeof signResult.isECDSA !== 'boolean') {
      throw new TypeError('[PADES FAIL-CLOSED]: signResult.isECDSA must be an explicit boolean value (true for ECDSA, false for RSA)');
    }

    let signatureBuffer;
    if (Buffer.isBuffer(signResult.signature)) {
      if (signResult.signature.length === 0) {
        throw new Error('[PADES FAIL-CLOSED]: signResult.signature must not be an empty Buffer');
      }
      signatureBuffer = signResult.signature;
    } else if (typeof signResult.signature === 'string') {
      const sigTrimmed = signResult.signature.trim().replace(/\s+/g, '');
      if (sigTrimmed.length === 0) {
        throw new Error('[PADES FAIL-CLOSED]: signResult.signature must not be an empty string');
      }
      const b64Regex = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}={2}|[A-Za-z0-9+/]{3}=)?$/;
      if (!b64Regex.test(sigTrimmed)) {
        throw new Error('[PADES FAIL-CLOSED]: signResult.signature is not a valid Base64 string');
      }
      signatureBuffer = Buffer.from(sigTrimmed, 'base64');
      if (signatureBuffer.length === 0) {
        throw new Error('[PADES FAIL-CLOSED]: signResult.signature decoded to an empty Buffer');
      }
    } else {
      throw new TypeError('[PADES FAIL-CLOSED]: signResult.signature must be a non-empty Buffer or valid Base64 string');
    }

    let certDer;
    if (Buffer.isBuffer(signResult.certificate)) {
      if (signResult.certificate.length === 0) {
        throw new Error('[PADES FAIL-CLOSED]: signResult.certificate must not be an empty Buffer');
      }
      certDer = signResult.certificate;
    } else if (typeof signResult.certificate === 'string') {
      const certTrimmed = signResult.certificate.trim().replace(/\s+/g, '');
      if (certTrimmed.length === 0) {
        throw new Error('[PADES FAIL-CLOSED]: signResult.certificate must not be an empty string');
      }
      const b64Regex = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}={2}|[A-Za-z0-9+/]{3}=)?$/;
      if (!b64Regex.test(certTrimmed)) {
        throw new Error('[PADES FAIL-CLOSED]: signResult.certificate is not a valid Base64 string');
      }
      certDer = Buffer.from(certTrimmed, 'base64');
      if (certDer.length === 0) {
        throw new Error('[PADES FAIL-CLOSED]: signResult.certificate decoded to an empty Buffer');
      }
    } else {
      throw new TypeError('[PADES FAIL-CLOSED]: signResult.certificate must be a non-empty Buffer or valid Base64 string');
    }

    let signerX509;
    try {
      signerX509 = new crypto.X509Certificate(certDer);
    } catch (certErr) {
      throw new Error(`[PADES FAIL-CLOSED]: Chứng thư số người ký không phải là DER X.509 hợp lệ: ${certErr.message}`);
    }

    const certKeyType = signerX509.publicKey.asymmetricKeyType;
    if (certKeyType !== 'ec' && certKeyType !== 'rsa') {
      throw new Error(`[PADES FAIL-CLOSED]: Thuật toán khóa không được hỗ trợ trong chứng thư: ${certKeyType}`);
    }
    const isCertECDSA = certKeyType === 'ec';
    if (signResult.isECDSA !== isCertECDSA) {
      throw new Error(`[PADES FAIL-CLOSED]: Thuật toán ký signResult.isECDSA (${signResult.isECDSA}) không khớp với loại khóa trong chứng thư (${certKeyType})`);
    }

    if (isCertECDSA) {
      if (signatureBuffer.length < 8 || signatureBuffer.length > 256) {
        throw new Error(`[PADES FAIL-CLOSED]: Độ dài chữ ký ECDSA không hợp lệ: ${signatureBuffer.length} bytes`);
      }
    } else {
      const modLen = signerX509.publicKey.asymmetricKeyDetails ? signerX509.publicKey.asymmetricKeyDetails.modulusLength : null;
      if (typeof modLen === 'number' && modLen > 0) {
        const expectedBytes = Math.floor(modLen / 8);
        if (signatureBuffer.length !== expectedBytes) {
          throw new Error(`[PADES FAIL-CLOSED]: Độ dài chữ ký RSA (${signatureBuffer.length} bytes) không khớp với độ dài khóa ${modLen}-bit (${expectedBytes} bytes)`);
        }
      } else if (signatureBuffer.length < 128 || signatureBuffer.length > 1024) {
        throw new Error(`[PADES FAIL-CLOSED]: Độ dài chữ ký RSA không hợp lệ: ${signatureBuffer.length} bytes`);
      }
    }
    const isECDSA = signResult.isECDSA;

    // 1. Thẩm định mật mã học toàn diện TimeStampToken trước khi nhúng (Fail-closed)
    const expectedSignatureHash = crypto.createHash('sha256').update(signatureBuffer).digest();
    const tstInfo = this._extractAndVerifyTsaToken(timeStampToken, expectedSignatureHash);
    if (!tstInfo.isValid) {
      throw new Error(`[PADES FAIL-CLOSED]: TimeStampToken không hợp lệ hoặc không xác thực được: ${tstInfo.reason}`);
    }

    const attrTimeStamp = encodeSeq([
      encodeOID(OID.id_aa_sigTimeStamp),
      encodeSet([timeStampToken])
    ]);
    const unsignedAttrsImplicit = encodeTLV(0xa1, attrTimeStamp);

    // 2. Trích xuất chính xác Issuer DER và Serial DER từ chứng thư số thực tế (cấm fallback)
    const meta = extractIssuerAndSerialFromCert(certDer);
    if (!meta || !meta.issuerDer || !meta.serialDer) {
      throw new Error('[PADES FAIL-CLOSED]: Không thể trích xuất Issuer DER và Serial DER từ chứng thư người ký');
    }

    // 3. SignerIdentifier (issuerAndSerialNumber)
    const issuerAndSerial = encodeSeq([
      meta.issuerDer,
      encodeCanonicalInteger(meta.serialDer)
    ]);

    // 4. Signature Algorithm Identifier
    const sigAlgId = isECDSA
      ? encodeSeq([encodeOID(OID.ecdsa_with_SHA256)])
      : encodeSeq([encodeOID(OID.sha256WithRSA), Buffer.from([0x05, 0x00])]);

    // 5. SignerInfo
    const signerInfo = encodeSeq([
      encodeCanonicalInteger(1), // version 1
      issuerAndSerial,
      sha256AlgId,
      signedAttrsImplicit,
      sigAlgId,
      encodeOctetString(signatureBuffer),
      unsignedAttrsImplicit
    ]);

    // 6. encapContentInfo (id-data, detached)
    const encapContentInfo = encodeSeq([encodeOID(OID.id_data)]);

    // 7. certificates [0] IMPLICIT
    const certsImplicit = encodeTLV(0xa0, certDer);

    // 8. SignedData
    const signedDataSeq = encodeSeq([
      encodeCanonicalInteger(1), // version 1
      encodeSet([sha256AlgId]),   // digestAlgorithms
      encapContentInfo,
      certsImplicit,
      encodeSet([signerInfo])     // signerInfos
    ]);

    // 9. ContentInfo
    const contentInfo = encodeSeq([
      encodeOID(OID.id_signedData),
      encodeTLV(0xa0, signedDataSeq)
    ]);

    const cmsHex = contentInfo.toString('hex').toUpperCase();

    if (cmsHex.length > contentsHexCapacity) {
      throw new Error(`[PAYLOAD OVERFLOW]: Gói CMS (${cmsHex.length} hex chars) vượt quá dung lượng vùng đệm (${contentsHexCapacity} hex chars)!`);
    }

    const paddedHex = cmsHex.padEnd(contentsHexCapacity, '0');
    const contentsBuffer = Buffer.from(`<${paddedHex}>`, 'utf8');

    contentsBuffer.copy(pdfWithPlaceholder, contentsPos);

    return pdfWithPlaceholder;
  }

  _parseAndValidateXRef(pdfBuf, startXrefOffset, headerIdx) {
    if (!pdfBuf || !Buffer.isBuffer(pdfBuf)) {
      return { isValid: false, reason: 'PDF buffer không hợp lệ' };
    }
    if (!Number.isSafeInteger(headerIdx) || headerIdx < 0 || headerIdx >= pdfBuf.length) {
      return { isValid: false, reason: 'Vị trí header PDF không hợp lệ' };
    }
    if (!Number.isSafeInteger(startXrefOffset) || startXrefOffset < headerIdx || startXrefOffset >= pdfBuf.length) {
      return { isValid: false, reason: 'Tọa độ startxref không hợp lệ hoặc nằm ngoài phạm vi tệp PDF' };
    }
    const maxWindow = Math.min(pdfBuf.length - startXrefOffset, 1048576);
    const slice = pdfBuf.subarray(startXrefOffset, startXrefOffset + maxWindow).toString('latin1');
    if (!slice.startsWith('xref')) {
      if (/^\d+\s+\d+\s+obj\b[\s\S]*?\/Type\s*\/XRef\b/.test(slice.substring(0, 1024))) {
        return { isValid: false, reason: 'Tệp PDF sử dụng XRef stream (chưa hỗ trợ giải mã an toàn theo ISO 32000-1 §7.5.8)' };
      }
      return { isValid: false, reason: 'Tọa độ startxref không trỏ tới bảng xref hợp lệ theo ISO 32000-1' };
    }

    const xrefHeaderMatch = slice.match(/^xref(?:\r\n|\r|\n)/);
    if (!xrefHeaderMatch) {
      return { isValid: false, reason: 'Bảng xref thiếu ký tự xuống dòng sau từ khóa xref' };
    }

    let cursor = xrefHeaderMatch[0].length;
    const entries = new Map();
    let totalEntriesCount = 0;
    let maxObjNumSeen = -1;

    // Lặp qua tất cả các subsection trong bảng xref cho đến khi gặp từ điển trailer (ISO 32000-1 §7.5.4)
    while (cursor < slice.length) {
      const remaining = slice.substring(cursor);
      if (/^\s*trailer\b/.test(remaining)) {
        break;
      }
      const subMatch = remaining.match(/^\s*(\d+)\s+(\d+)(?:\r\n|\r|\n)/);
      if (!subMatch) {
        return { isValid: false, reason: 'Bảng xref chứa phân đoạn subsection không hợp lệ hoặc thiếu trailer theo ISO 32000-1' };
      }
      const startObj = parseInt(subMatch[1], 10), count = parseInt(subMatch[2], 10);
      if (!Number.isSafeInteger(startObj) || startObj < 0 || !Number.isSafeInteger(count) || count < 0 || count > 1000000) {
        return { isValid: false, reason: 'Thông số subsection bảng xref không hợp lệ' };
      }
      if (totalEntriesCount + count > 1000000) {
        return { isValid: false, reason: 'Tổng số entry trong bảng xref vượt quá giới hạn an toàn' };
      }
      cursor += subMatch[0].length;

      for (let i = 0; i < count; i++) {
        const lineRemaining = slice.substring(cursor);
        const lineMatch = lineRemaining.match(/^(\d{10})\s+(\d{5})\s+([nf])(?:\s*[\r\n]+)/);
        if (!lineMatch) {
          return { isValid: false, reason: `Định dạng entry thứ ${i} trong subsection ${startObj} không hợp lệ (yêu cầu 20 bytes tuần tự)` };
        }
        const objNum = startObj + i, off = parseInt(lineMatch[1], 10), gen = parseInt(lineMatch[2], 10);
        const type = lineMatch[3];
        entries.set(objNum, { off, gen, type });
        if (objNum > maxObjNumSeen) maxObjNumSeen = objNum;
        totalEntriesCount++;

        if (type === 'n') {
          if (!Number.isSafeInteger(off) || off < headerIdx || off >= pdfBuf.length) {
            return { isValid: false, reason: `Offset của object ${objNum} trong bảng xref nằm ngoài phạm vi tệp` };
          }
          const pfx = `${objNum} ${gen} obj`;
          const objHeader = pdfBuf.subarray(off, Math.min(pdfBuf.length, off + 32)).toString('latin1');
          if (!new RegExp(`^${objNum} ${gen} obj(?:[\\s<>/[\\]]|$)`).test(objHeader)) {
            return { isValid: false, reason: `Entry xref của object ${objNum} trỏ sai vị trí (không khớp ${pfx})` };
          }
        }
        cursor += lineMatch[0].length;
      }
    }

    if (totalEntriesCount === 0) {
      return { isValid: false, reason: 'Bảng xref không chứa bất kỳ subsection hoặc entry nào' };
    }

    const trailerSlice = slice.substring(cursor);
    const trailerMatch = trailerSlice.match(/^\s*trailer\s*<<([\s\S]*?)>>/);
    if (!trailerMatch) return { isValid: false, reason: 'Không tìm thấy từ điển trailer hợp lệ liền sau bảng xref' };

    const minRequiredSize = maxObjNumSeen + 1;
    const sizeMatch = trailerMatch[1].match(/\/Size\s+(\d+)/);
    if (!sizeMatch) return { isValid: false, reason: 'Trailer thiếu thuộc tính /Size bắt buộc' };
    const trailerSize = parseInt(sizeMatch[1], 10);
    if (!Number.isSafeInteger(trailerSize) || trailerSize <= 0 || trailerSize < minRequiredSize || trailerSize > 10000000) {
      return { isValid: false, reason: `Thuộc tính /Size (${trailerSize}) trong trailer không hợp lệ hoặc nhỏ hơn số hiệu đối tượng tối đa (${minRequiredSize})` };
    }

    const rootMatch = trailerMatch[1].match(/\/Root\s+(\d+)\s+(\d+)\s+R/);
    if (!rootMatch) return { isValid: false, reason: 'Trailer thiếu tham chiếu /Root (Catalog) bắt buộc' };
    const rootObjNum = parseInt(rootMatch[1], 10), rootGen = parseInt(rootMatch[2], 10);
    if (!Number.isSafeInteger(rootObjNum) || !Number.isSafeInteger(rootGen) || rootObjNum < 0 || rootGen < 0) {
      return { isValid: false, reason: 'Tham chiếu /Root trong trailer chứa số hiệu không hợp lệ' };
    }
    const rootEntry = entries.get(rootObjNum);
    if (!rootEntry || rootEntry.type !== 'n' || rootEntry.gen !== rootGen) {
      return { isValid: false, reason: `Tham chiếu /Root (${rootObjNum} ${rootGen} R) không tồn tại hoặc không phải entry 'n' hợp lệ trong bảng XRef` };
    }
    const rootPfx = `${rootObjNum} ${rootGen} obj`;
    const rootCheckLen = Math.min(pdfBuf.length - rootEntry.off, 2048);
    const rootSlice = pdfBuf.subarray(rootEntry.off, rootEntry.off + rootCheckLen).toString('latin1');
    if (!new RegExp(`^${rootObjNum} ${rootGen} obj(?:[\\s<>/[\\]]|$)`).test(rootSlice)) {
      return { isValid: false, reason: `Object /Root ${rootObjNum} ${rootGen} trỏ sai vị trí trong tệp PDF` };
    }
    if (!/\/Type\s*\/Catalog\b/.test(rootSlice)) {
      return { isValid: false, reason: `Object /Root (${rootObjNum} ${rootGen} R) không chứa /Type /Catalog hợp lệ` };
    }

    return { isValid: true, rootRef: `${rootObjNum} ${rootGen} R`, trailerSize };
  }

  _verifyPdfObjectGraph(pdfBuf) {
    if (!pdfBuf || !Buffer.isBuffer(pdfBuf)) {
      return { isValid: false, reason: 'Dữ liệu PDF không phải là Buffer hợp lệ' };
    }
    const MAX_PDF_BUFFER_SIZE = 50 * 1024 * 1024;
    if (pdfBuf.length > MAX_PDF_BUFFER_SIZE) {
      return { isValid: false, reason: `Kích thước tệp PDF vượt quá giới hạn an toàn (${pdfBuf.length} > ${MAX_PDF_BUFFER_SIZE} bytes)` };
    }
    if (pdfBuf.length < 32) {
      return { isValid: false, reason: 'Kích thước tệp PDF quá nhỏ để tạo thành tài liệu hợp lệ' };
    }

    // 1. Kiểm tra tiêu đề %PDF- (ISO 32000-1 §7.5.2) trong 1024 bytes đầu tiên
    const headerIdx = pdfBuf.indexOf(Buffer.from('%PDF-'));
    if (headerIdx === -1 || headerIdx > 1024) {
      return { isValid: false, reason: 'Không tìm thấy tiêu đề %PDF- hợp lệ trong 1024 bytes đầu tiên theo ISO 32000-1' };
    }

    // 2. Xác minh khối startxref và thẻ kết thúc %%EOF neo tại đuôi tệp (ISO 32000-1 §7.5.5)
    const searchWindow = Math.min(pdfBuf.length, 4096);
    const tailStr = pdfBuf.subarray(pdfBuf.length - searchWindow).toString('latin1');
    const lastEofIdx = tailStr.lastIndexOf('%%EOF');
    if (lastEofIdx === -1) {
      return { isValid: false, reason: 'Tệp PDF thiếu thẻ kết thúc %%EOF theo ISO 32000-1' };
    }
    const beforeEof = tailStr.substring(0, lastEofIdx);
    const lastStartXrefIdx = beforeEof.lastIndexOf('startxref');
    if (lastStartXrefIdx === -1) {
      return { isValid: false, reason: 'Tệp PDF thiếu từ khóa startxref trước %%EOF theo ISO 32000-1' };
    }
    const startXrefSlice = beforeEof.substring(lastStartXrefIdx);
    const startXrefMatch = startXrefSlice.match(/^startxref\s+(\d+)\s*$/m);
    if (!startXrefMatch) {
      return { isValid: false, reason: 'Cú pháp startxref không hợp lệ trước %%EOF theo ISO 32000-1' };
    }
    const startXrefOffset = parseInt(startXrefMatch[1], 10);

    // 3. Phân tích và thẩm định toàn diện bảng xref hoặc XRef stream cùng trailer /Root (ISO 32000-1 §7.5.4, §7.5.8)
    const xrefRes = this._parseAndValidateXRef(pdfBuf, startXrefOffset, headerIdx);
    if (!xrefRes.isValid) {
      return xrefRes;
    }
    const rootRef = xrefRes.rootRef;

    // 4. Phân tích đối tượng cấu trúc trực tiếp trên Buffer, tránh chuyển toàn bộ tệp sang chuỗi để bảo vệ heap
    const objects = new Map();
    let pos = 0;
    const len = pdfBuf.length;
    const needleObj = Buffer.from('obj');
    const needleEndobj = Buffer.from('endobj');
    const needleStream = Buffer.from('stream');
    const needleEndstream = Buffer.from('endstream');

    while (pos < len) {
      const objIdx = pdfBuf.indexOf(needleObj, pos);
      if (objIdx === -1) break;

      // Kiểm tra ranh giới sau 'obj': phải là ký tự khoảng trắng hoặc phân cách PDF
      const afterObj = objIdx + 3;
      if (afterObj < len) {
        const c = pdfBuf[afterObj];
        if (c !== 0x20 && c !== 0x09 && c !== 0x0d && c !== 0x0a && c !== 0x3c && c !== 0x2f && c !== 0x5b) {
          pos = afterObj;
          continue;
        }
      }

      // Quét ngược tìm header: <digits> <whitespace> <digits> <whitespace> obj
      const headerWindowStart = Math.max(0, objIdx - 64);
      const headerSlice = pdfBuf.subarray(headerWindowStart, objIdx).toString('latin1');
      const headerMatch = headerSlice.match(/(?:^|[\r\n])\s*(\d+)\s+(\d+)\s*$/);
      if (!headerMatch) {
        pos = afterObj;
        continue;
      }

      // Bỏ qua nếu dòng này là comment (bắt đầu bằng %)
      const lastNl = Math.max(headerSlice.lastIndexOf('\n'), headerSlice.lastIndexOf('\r'));
      const lineStartPos = headerWindowStart + (lastNl !== -1 ? lastNl + 1 : 0);
      let isComment = false;
      for (let i = lineStartPos; i < objIdx; i++) {
        if (pdfBuf[i] === 0x25) { // '%'
          isComment = true;
          break;
        }
        if (pdfBuf[i] !== 0x20 && pdfBuf[i] !== 0x09) break;
      }
      if (isComment) {
        pos = afterObj;
        continue;
      }

      const objNum = parseInt(headerMatch[1], 10);
      const genNum = parseInt(headerMatch[2], 10);

      // Xác thực số nguyên an toàn nghiêm ngặt (ISO 32000-1 §7.3.10)
      if (!Number.isSafeInteger(objNum) || objNum < 0 || objNum > 2147483647) {
        return { isValid: false, reason: `Số hiệu object không phải là số nguyên an toàn: ${headerMatch[1]}` };
      }
      if (!Number.isSafeInteger(genNum) || genNum < 0 || genNum > 65535) {
        return { isValid: false, reason: `Số hiệu generation không phải là số nguyên an toàn: ${headerMatch[2]}` };
      }

      const key = `${objNum} ${genNum} R`;
      const bodyStart = afterObj;
      let endobjIdx = -1;
      let streamStart = -1;

      // 1. Phân tích phạm vi từ điển << ... >> nếu đối tượng là từ điển
      let p = bodyStart;
      while (p < len && (pdfBuf[p] <= 0x20)) p++;

      let dictStart = -1;
      let dictEnd = -1;

      if (p < len - 1 && pdfBuf[p] === 0x3c && pdfBuf[p + 1] === 0x3c) { // '<<'
        dictStart = p;
        let depth = 0;
        let i = p;
        while (i < len) {
          const b1 = pdfBuf[i];
          const b2 = i + 1 < len ? pdfBuf[i + 1] : 0;

          // 1. Comment bắt đầu bằng '%' (0x25), kết thúc tại CR (0x0d), LF (0x0a) hoặc EOF (ISO 32000-1 §7.2.3)
          if (b1 === 0x25) { // '%'
            i++;
            while (i < len && pdfBuf[i] !== 0x0a && pdfBuf[i] !== 0x0d) {
              i++;
            }
            continue;
          }

          // 2. Chuỗi literal bắt đầu bằng '(' (0x28), hỗ trợ escape '\' và ngoặc lồng nhau (ISO 32000-1 §7.3.4.2)
          if (b1 === 0x28) { // '('
            i++;
            let strDepth = 1;
            while (i < len && strDepth > 0) {
              if (pdfBuf[i] === 0x5c) { // '\'
                i += 2;
                continue;
              }
              if (pdfBuf[i] === 0x28) strDepth++;
              else if (pdfBuf[i] === 0x29) strDepth--;
              i++;
            }
            continue;
          }

          // 3. Từ điển mở '<<'
          if (b1 === 0x3c && b2 === 0x3c) { // '<<'
            depth++;
            i += 2;
            continue;
          }

          // 4. Chuỗi hexadecimal bắt đầu bằng '<' (không phải '<<'), kết thúc tại '>' (ISO 32000-1 §7.3.4.3)
          if (b1 === 0x3c) { // '<'
            i++;
            while (i < len && pdfBuf[i] !== 0x3e) { // '>'
              i++;
            }
            if (i < len) i++;
            continue;
          }

          // 5. Từ điển đóng '>>'
          if (b1 === 0x3e && b2 === 0x3e) { // '>>'
            depth--;
            if (depth === 0) {
              dictEnd = i + 2;
              break;
            }
            i += 2;
            continue;
          }

          i++;
        }
        if (dictEnd === -1) {
          return { isValid: false, reason: `Cấu trúc PDF bị lỗi: Từ điển trong object ${key} không có thẻ đóng >> hợp lệ` };
        }
      }

      // 2. Kiểm tra xem ngay sau từ điển có phải là từ khóa stream hay không (ISO 32000-1 §7.3.8)
      let isStream = false;
      let streamDataStart = -1;
      let streamKeywordPos = -1;

      if (dictEnd !== -1) {
        let afterDict = dictEnd;
        while (afterDict < len && (pdfBuf[afterDict] <= 0x20)) afterDict++;
        if (afterDict + 6 <= len && pdfBuf.subarray(afterDict, afterDict + 6).toString('latin1') === 'stream') {
          const c1 = afterDict + 6 < len ? pdfBuf[afterDict + 6] : -1;
          const c2 = afterDict + 7 < len ? pdfBuf[afterDict + 7] : -1;
          if (c1 === 0x0d && c2 === 0x0a) {
            streamKeywordPos = afterDict;
            streamDataStart = afterDict + 8;
            isStream = true;
          } else if (c1 === 0x0a) {
            streamKeywordPos = afterDict;
            streamDataStart = afterDict + 7;
            isStream = true;
          }
        }
      }

      if (isStream) {
        streamStart = streamKeywordPos;
        const dictStr = pdfBuf.subarray(dictStart, dictEnd).toString('latin1');
        const lenMatch = dictStr.match(/\/Length\s+(\d+)/);
        let endstreamIdx = -1;

        if (lenMatch) {
          const streamLen = parseInt(lenMatch[1], 10);
          if (!Number.isSafeInteger(streamLen) || streamLen < 0 || streamDataStart + streamLen > len) {
            return { isValid: false, reason: `Cấu trúc PDF bị lỗi: /Length (${lenMatch[1]}) của stream trong object ${key} không hợp lệ hoặc vượt quá tệp` };
          }
          const streamDataEnd = streamDataStart + streamLen;
          const endstreamWindow = pdfBuf.subarray(streamDataEnd, Math.min(len, streamDataEnd + 32)).toString('latin1');
          const endstreamMatch = endstreamWindow.match(/^(\r\n|\r|\n)?endstream(?=[\s<>/[\]]|$)/);
          if (!endstreamMatch) {
            return { isValid: false, reason: `Cấu trúc PDF bị lỗi: Không tìm thấy endstream hợp lệ tại vị trí kết thúc stream theo /Length cho object ${key}` };
          }
          const offsetInWindow = endstreamWindow.indexOf('endstream');
          endstreamIdx = streamDataEnd + offsetInWindow;
        } else {
          const rawEndstream = pdfBuf.indexOf(needleEndstream, streamDataStart);
          if (rawEndstream === -1) {
            return { isValid: false, reason: `Cấu trúc PDF bị lỗi: Stream trong object ${key} không có thẻ endstream` };
          }
          endstreamIdx = rawEndstream;
        }

        const afterEndstreamPos = endstreamIdx + 9;
        const endobjWindow = pdfBuf.subarray(afterEndstreamPos, Math.min(len, afterEndstreamPos + 128)).toString('latin1');
        const endobjMatch = endobjWindow.match(/^\s*endobj(?=[\s<>/[\]]|$)/);
        if (!endobjMatch) {
          return { isValid: false, reason: `Cấu trúc PDF bị lỗi: Không xác định được endobj hợp lệ sau endstream cho object ${key}` };
        }
        endobjIdx = afterEndstreamPos + endobjWindow.indexOf('endobj');
      } else {
        let searchPos = dictEnd !== -1 ? dictEnd : bodyStart;
        while (searchPos < len) {
          const cand = pdfBuf.indexOf(needleEndobj, searchPos);
          if (cand === -1) break;
          const prevChar = cand > 0 ? pdfBuf[cand - 1] : 0x20;
          const afterChar = cand + 6 < len ? pdfBuf[cand + 6] : 0x20;
          const isDelimBefore = prevChar <= 0x20 || prevChar === 0x3e || prevChar === 0x5d || prevChar === 0x29;
          const isDelimAfter = afterChar <= 0x20 || afterChar === 0x3c || afterChar === 0x2f || afterChar === 0x5b || afterChar === 0x28;
          if (isDelimBefore && isDelimAfter) {
            endobjIdx = cand;
            break;
          }
          searchPos = cand + 6;
        }
        if (endobjIdx === -1) {
          return { isValid: false, reason: `Cấu trúc PDF bị lỗi: Object ${key} không có thẻ đóng endobj hợp lệ theo ISO 32000-1` };
        }
      }

      // Cấm trùng lặp Object ID (Duplicate Object ID Attack - cấm ghi đè Map)
      if (objects.has(key)) {
        return { isValid: false, reason: `Phát hiện đối tượng PDF trùng lặp (${key}) (Duplicate object ID attack)` };
      }

      // Chỉ chuyển đổi phần từ điển sang chuỗi để phân tích cấu trúc, không chuyển stream nhị phân vào heap
      const dictLimit = streamStart !== -1 ? streamStart : endobjIdx;
      const bodyStr = pdfBuf.subarray(bodyStart, dictLimit).toString('latin1');

      objects.set(key, {
        num: objNum,
        gen: genNum,
        start: lineStartPos,
        end: endobjIdx + 6,
        body: bodyStr
      });

      pos = endobjIdx + 6;
    }

    if (objects.size === 0) {
      return { isValid: false, reason: 'Không tìm thấy đối tượng PDF (indirect objects) nào trong tệp' };
    }

    // 5. Xác thực đối tượng Catalog từ tham chiếu /Root đã được thẩm định theo ISO 32000-1

    const catalog = objects.get(rootRef);
    if (!catalog) {
      return { isValid: false, reason: `Đối tượng Catalog (${rootRef}) được chỉ định bởi trailer không tồn tại` };
    }
    if (!/\/Type\s*\/Catalog\b/.test(catalog.body)) {
      return { isValid: false, reason: 'Đối tượng được chỉ định bởi trailer /Root không phải là /Type /Catalog hợp lệ' };
    }

    // Phát hiện Catalog giả mạo ngoài luồng tham chiếu /Root của trailer
    for (const [key, obj] of objects.entries()) {
      if (key !== rootRef && /\/Type\s*\/Catalog\b/.test(obj.body)) {
        return { isValid: false, reason: `Phát hiện đối tượng Catalog giả mạo (${key}) ngoài tham chiếu /Root của trailer` };
      }
    }
    const catalogKey = rootRef;

    // 5. Định vị và xác thực cấu trúc /AcroForm trong Catalog
    const acroFormRefMatch = catalog.body.match(/\/AcroForm\s+(\d+\s+\d+\s+R)/);
    const acroFormInlineMatch = catalog.body.match(/\/AcroForm\s*<<([\s\S]*?)>>/);
    let acroFormBody = '';
    if (acroFormRefMatch) {
      const acroObj = objects.get(acroFormRefMatch[1]);
      if (!acroObj) {
        return { isValid: false, reason: 'Tham chiếu AcroForm không tồn tại trong danh sách indirect objects của PDF' };
      }
      acroFormBody = acroObj.body;
    } else if (acroFormInlineMatch) {
      acroFormBody = acroFormInlineMatch[1];
    } else {
      return { isValid: false, reason: 'Tệp PDF thiếu cấu trúc AcroForm trong Catalog theo ISO 32000-1' };
    }

    // Kiểm tra /SigFlags: Bắt buộc tồn tại và có giá trị chuẩn (SignaturesExist = 1, AppendOnly = 2)
    const sigFlagsMatch = acroFormBody.match(/\/SigFlags\s+(\d+)/);
    if (!sigFlagsMatch) {
      return { isValid: false, reason: 'AcroForm thiếu thuộc tính /SigFlags theo ISO 32000-1' };
    }
    const sigFlags = parseInt(sigFlagsMatch[1], 10);
    if ((sigFlags & 3) !== 3) {
      return { isValid: false, reason: `/SigFlags phải có giá trị 3 (SignaturesExist + AppendOnly) theo ISO 32000-1 (nhận được: ${sigFlags})` };
    }

    // Kiểm tra /Fields trong AcroForm
    const fieldsMatch = acroFormBody.match(/\/Fields\s*\[([^\]]*)\]/);
    if (!fieldsMatch) {
      return { isValid: false, reason: 'AcroForm thiếu mảng trường chữ ký /Fields' };
    }
    const fieldRefs = [...fieldsMatch[1].matchAll(/(\d+\s+\d+\s+R)/g)].map(x => x[1]);
    if (fieldRefs.length === 0) {
      return { isValid: false, reason: 'AcroForm.Fields rỗng, không chứa trường chữ ký nào' };
    }

    // 3. Định vị Signature Field / Widget trong AcroForm.Fields
    let sigWidget = null;
    let sigWidgetKey = null;
    for (const fRef of fieldRefs) {
      const fObj = objects.get(fRef);
      if (!fObj) continue;
      if (/\/Subtype\s*\/Widget\b/.test(fObj.body) && /\/FT\s*\/Sig\b/.test(fObj.body)) {
        if (sigWidget) {
          return { isValid: false, reason: 'Phát hiện nhiều trường chữ ký gây nhập nhằng trong AcroForm' };
        }
        sigWidget = fObj;
        sigWidgetKey = fRef;
      }
    }
    if (!sigWidget) {
      return { isValid: false, reason: 'Không tìm thấy Signature Widget (/FT /Sig /Subtype /Widget) hợp lệ trong AcroForm.Fields' };
    }

    if (!/\/Type\s*\/Annot\b/.test(sigWidget.body)) {
      return { isValid: false, reason: 'Signature Widget thiếu thuộc tính /Type /Annot theo ISO 32000-1' };
    }

    // 4. Xác thực Signature Widget thực sự nằm trong mảng /Annots của một trang
    let pageHasWidget = false;
    const normRef = (s) => (typeof s === 'string' ? s.trim().replace(/\s+/g, ' ') : '');
    const normWidgetKey = normRef(sigWidgetKey);
    for (const [key, obj] of objects.entries()) {
      if (/\/Type\s*\/Page\b/.test(obj.body)) {
        let annotsArrayStr = null;
        const directMatch = obj.body.match(/\/Annots\s*\[([^\]]*)\]/);
        if (directMatch) {
          annotsArrayStr = directMatch[1];
        } else {
          const indirectMatch = obj.body.match(/\/Annots\s+(\d+\s+\d+\s+R)/);
          if (indirectMatch) {
            const annotsObj = objects.get(normRef(indirectMatch[1]));
            if (annotsObj) {
              const arrayMatch = annotsObj.body.match(/\[([^\]]*)\]/);
              if (arrayMatch) {
                annotsArrayStr = arrayMatch[1];
              }
            }
          }
        }
        if (annotsArrayStr !== null) {
          const annotRefs = [...annotsArrayStr.matchAll(/(\d+\s+\d+\s+R)/g)].map(x => normRef(x[1]));
          if (annotRefs.includes(normWidgetKey)) {
            pageHasWidget = true;
            break;
          }
        }
      }
    }
    if (!pageHasWidget) {
      return { isValid: false, reason: 'Signature Widget không nằm trong mảng /Annots của bất kỳ trang nào trong tài liệu' };
    }

    // 5. Xác thực Signature Dictionary được trỏ bởi /V của Widget
    const vMatch = sigWidget.body.match(/\/V\s+(\d+\s+\d+\s+R)/);
    if (!vMatch) {
      return { isValid: false, reason: 'Signature Widget thiếu thuộc tính /V liên kết tới Signature Dictionary' };
    }
    const sigDictKey = normRef(vMatch[1]);
    const sigDictObj = objects.get(sigDictKey);
    if (!sigDictObj) {
      return { isValid: false, reason: 'Đối tượng Signature Dictionary được trỏ bởi Widget /V không tồn tại' };
    }

    if (!/\/Type\s*\/Sig\b/.test(sigDictObj.body)) {
      return { isValid: false, reason: 'Đối tượng được trỏ bởi Widget /V không phải là /Type /Sig theo ISO 32000-1' };
    }
    if (!/\/SubFilter\s*\/ETSI\.CAdES\.detached\b/.test(sigDictObj.body)) {
      return { isValid: false, reason: 'Signature Dictionary không có /SubFilter /ETSI.CAdES.detached bắt buộc cho PAdES' };
    }

    // 6. Phát hiện Signature Dictionary mồ côi (Orphan /Type /Sig không được liên kết hợp lệ)
    for (const [key, obj] of objects.entries()) {
      if (/\/Type\s*\/Sig\b/.test(obj.body) && normRef(key) !== sigDictKey) {
        return { isValid: false, reason: `Phát hiện Signature Dictionary mồ côi (${key}) không được liên kết hợp lệ trong tài liệu (Fail-Closed)` };
      }
    }

    // 7. Trích xuất và xác thực /ByteRange và /Contents từ ĐÚNG Signature Dictionary này (ISO 32000-1 §12.8.1)
    const brMatch = sigDictObj.body.match(/\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/);
    if (!brMatch) {
      return { isValid: false, reason: 'Signature Dictionary thiếu thuộc tính /ByteRange' };
    }
    const b0 = parseInt(brMatch[1], 10);
    const b1 = parseInt(brMatch[2], 10);
    const b2 = parseInt(brMatch[3], 10);
    const b3 = parseInt(brMatch[4], 10);

    // Xác thực số nguyên an toàn nghiêm ngặt chống tràn số
    if (!Number.isSafeInteger(b0) || !Number.isSafeInteger(b1) || !Number.isSafeInteger(b2) || !Number.isSafeInteger(b3)) {
      return { isValid: false, reason: 'Các giá trị trong /ByteRange không phải là số nguyên an toàn' };
    }

    // Đối soát /ByteRange với độ dài tệp PDF thực tế theo ISO 32000-1 §12.8.1
    if (b0 !== 0 || b1 <= 0 || b2 <= b1 || b3 <= 0 || b2 > pdfBuf.length || b2 + b3 !== pdfBuf.length) {
      return { isValid: false, reason: `ByteRange bất thường: [${b0}, ${b1}, ${b2}, ${b3}] vs tổng độ dài ${pdfBuf.length}` };
    }

    const contentsMatch = sigDictObj.body.match(/\/Contents\s*<([0-9a-fA-F\s]*)>/);
    if (!contentsMatch) {
      return { isValid: false, reason: 'Signature Dictionary thiếu thuộc tính /Contents' };
    }

    // Xác nhận khoảng bị bỏ qua của /ByteRange [b1, b2] nằm trong đối tượng Signature Dictionary
    if (b1 < sigDictObj.start || b2 > sigDictObj.end) {
      return { isValid: false, reason: 'Vùng ByteRange-gap không nằm trọn vẹn trong đối tượng Signature Dictionary' };
    }

    // Xác nhận ByteRange-gap bắt đầu ngay sau khóa /Contents
    const beforeGap = pdfBuf.subarray(Math.max(sigDictObj.start, b1 - 32), b1).toString('latin1');
    if (!/\/Contents\s*$/.test(beforeGap)) {
      return { isValid: false, reason: 'Vùng ByteRange-gap không khớp vị trí khóa /Contents trong file PDF' };
    }

    // Đối soát vùng ByteRange-gap thực tế trong file
    const rawGap = pdfBuf.subarray(b1, b2);
    if (rawGap.length < 4 || rawGap[0] !== 0x3c || rawGap[rawGap.length - 1] !== 0x3e) {
      return { isValid: false, reason: 'Vùng ByteRange-gap không khớp cấu trúc hex string <...>' };
    }
    const gapLen = b2 - b1;
    if (gapLen > 2097152) {
      return { isValid: false, reason: `Kích thước vùng /Contents vượt quá giới hạn an toàn (${gapLen} > 2097152 bytes)` };
    }

    const rawHex = rawGap.subarray(1, rawGap.length - 1).toString('latin1').replace(/\s+/g, '');
    const dictHex = contentsMatch[1].replace(/\s+/g, '');
    if (rawHex.toUpperCase() !== dictHex.toUpperCase()) {
      return { isValid: false, reason: 'Dữ liệu /Contents trong Signature Dictionary không khớp với vùng ByteRange-gap' };
    }

    if (rawHex.length % 2 !== 0) {
      return { isValid: false, reason: 'Độ dài hex string trong /Contents phải là số chẵn' };
    }
    if (rawHex.length === 0 || rawHex.length > 2097152) {
      return { isValid: false, reason: 'Độ dài chuỗi hex /Contents vượt quá giới hạn an toàn' };
    }
    if (!/^[0-9a-fA-F]+$/.test(rawHex)) {
      return { isValid: false, reason: 'Vùng /Contents chứa ký tự không phải hex' };
    }


    return {
      isValid: true,
      sigDictKey,
      sigWidgetKey,
      b0, b1, b2, b3,
      hex: rawHex
    };
  }

  verifySignedPdf(signedPdfBuffer) {
    try {
      if (!signedPdfBuffer || !Buffer.isBuffer(signedPdfBuffer)) {
        return { isValid: false, reason: 'Dữ liệu PDF không hợp lệ hoặc rỗng' };
      }

      // 0. Thẩm định toàn diện cây đối tượng ISO 32000-1 và liên kết PAdES
      const objGraph = this._verifyPdfObjectGraph(signedPdfBuffer);
      if (!objGraph.isValid) {
        return { isValid: false, byteRangeIntegrity: false, reason: objGraph.reason };
      }

      const { b0, b1, b2, b3, hex } = objGraph;

      // 1. Tính mã băm tài liệu thực tế trên 2 đoạn ByteRange
      const part1 = signedPdfBuffer.subarray(0, b1);
      const part2 = signedPdfBuffer.subarray(b2, b2 + b3);
      const actualDocHash = crypto.createHash('sha256').update(part1).update(part2).digest();

      // 2. Trích xuất khối HEX /Contents và giải mã CMS DER
      const cmsDer = Buffer.from(hex, 'hex');

      // 4. Phân tích cây ASN.1 CMS ContentInfo -> SignedData (Boundary-checked)
      const contentInfoTLV = parseTLV(cmsDer, 0);
      if (!contentInfoTLV || contentInfoTLV.tag !== 0x30) {
        return { isValid: false, reason: 'Nội dung Contents không phải là ASN.1 SEQUENCE hợp lệ' };
      }
      if (contentInfoTLV.next > cmsDer.length) {
        return { isValid: false, reason: 'Độ dài CMS ContentInfo vượt quá dung lượng giải mã' };
      }

      // 4.1 Kiểm tra Zero-Padding: Phần dư sau CMS DER trong /Contents bắt buộc phải toàn bộ là '0'
      const actualCmsHexLen = contentInfoTLV.next * 2;
      const afterCmsHex = hex.substring(actualCmsHexLen);
      if (!/^0*$/.test(afterCmsHex)) {
        return { isValid: false, reason: 'Vùng đệm Contents chứa dữ liệu bất thường sau CMS (không phải zero padding)' };
      }

      const sdOid = parseTLV(cmsDer, contentInfoTLV.pos + contentInfoTLV.hl);
      if (!sdOid || sdOid.tag !== 0x06 || sdOid.val.toString('hex') !== OID.id_signedData) {
        return { isValid: false, reason: 'Contents không phải là CMS SignedData (OID 1.2.840.113549.1.7.2)' };
      }

      const sdCtx = parseTLV(cmsDer, sdOid.next);
      if (!sdCtx || sdCtx.tag !== 0xa0) return { isValid: false, reason: 'Thiếu SignedData context [0] trong CMS' };
      if (sdCtx.next !== contentInfoTLV.next) return { isValid: false, reason: 'CMS ContentInfo chứa dữ liệu thừa ngoài SignedData container' };

      const sdSeq = parseTLV(sdCtx.val, 0);
      if (!sdSeq || sdSeq.tag !== 0x30 || sdSeq.next !== sdCtx.val.length) {
        return { isValid: false, reason: 'Cấu trúc SignedData SEQUENCE không hợp lệ hoặc chứa trailing bytes' };
      }

      let sP = 0;
      const ver = parseTLV(sdSeq.val, sP);
      if (!ver || ver.tag !== 0x02 || ver.len === 0) return { isValid: false, reason: 'Thiếu hoặc sai định dạng version trong SignedData' };
      if (ver.len > 1 && ver.val[0] === 0x00 && (ver.val[1] & 0x80) === 0) {
        return { isValid: false, reason: 'SignedData.version không tuân thủ canonical DER INTEGER' };
      }
      if (ver.len !== 1 || (ver.val[0] !== 1 && ver.val[0] !== 3)) {
        return { isValid: false, reason: `SignedData.version không hợp lệ (nhận ${ver.val[0]}, yêu cầu 1 hoặc 3 theo RFC 5652)` };
      }
      sP = ver.next;
      const da = parseTLV(sdSeq.val, sP); if (!da || da.tag !== 0x31) return { isValid: false, reason: 'Thiếu digestAlgorithms trong SignedData' }; sP = da.next;
      
      // Kiểm tra cấu trúc và OID của digestAlgorithms trong SignedData
      if (da.val.length === 0) return { isValid: false, reason: 'SignedData.digestAlgorithms rỗng' };
      const daAlgTLV = parseTLV(da.val, 0);
      if (!daAlgTLV || daAlgTLV.tag !== 0x30) return { isValid: false, reason: 'AlgorithmIdentifier trong SignedData.digestAlgorithms không hợp lệ' };
      const daAlgOid = parseTLV(daAlgTLV.val, 0);
      if (!daAlgOid || daAlgOid.tag !== 0x06 || daAlgOid.val.toString('hex') !== OID.sha256) {
        return { isValid: false, reason: 'SignedData.digestAlgorithms không chứa SHA-256 (OID 2.16.840.1.101.3.4.2.1)' };
      }
      if (daAlgOid.next < daAlgTLV.val.length) {
        const daParam = parseTLV(daAlgTLV.val, daAlgOid.next);
        if (!daParam || daParam.tag !== 0x05 || daParam.len !== 0 || daParam.next !== daAlgTLV.val.length) {
          return { isValid: false, reason: 'Tham số trong SignedData.digestAlgorithms không hợp lệ (chỉ chấp nhận absent hoặc NULL)' };
        }
      }
      if (daAlgTLV.next !== da.val.length) return { isValid: false, reason: 'SignedData.digestAlgorithms SET chứa trailing bytes' };

      const eci = parseTLV(sdSeq.val, sP); if (!eci || eci.tag !== 0x30) return { isValid: false, reason: 'Thiếu encapContentInfo trong SignedData' }; sP = eci.next;
      const certsPart = parseTLV(sdSeq.val, sP); if (!certsPart || certsPart.tag !== 0xa0) return { isValid: false, reason: 'Thiếu certificates trong SignedData' }; sP = certsPart.next;
      const sisPart = parseTLV(sdSeq.val, sP);
      if (!sisPart || sisPart.tag !== 0x31) {
        return { isValid: false, reason: 'CMS không chứa signerInfos SET' };
      }
      sP = sisPart.next;
      if (sP !== sdSeq.val.length) {
        return { isValid: false, reason: 'SignedData SEQUENCE chứa dữ liệu thừa ở cuối (trailing bytes)' };
      }

      // 5. Phân tích SignerInfo của người ký
      const siSeq = parseTLV(sisPart.val, 0);
      if (!siSeq || siSeq.tag !== 0x30) return { isValid: false, reason: 'SignerInfo không phải là SEQUENCE' };
      if (siSeq.next !== sisPart.val.length) {
        return { isValid: false, reason: 'signerInfos SET chứa dữ liệu thừa hoặc nhiều SignerInfo ngoài quy chuẩn (Fail-Closed)' };
      }
      let siP = 0;
      const siVer = parseTLV(siSeq.val, siP);
      if (!siVer || siVer.tag !== 0x02 || siVer.len === 0) return { isValid: false, reason: 'Thiếu hoặc sai định dạng version trong SignerInfo' };
      if (siVer.len > 1 && siVer.val[0] === 0x00 && (siVer.val[1] & 0x80) === 0) {
        return { isValid: false, reason: 'SignerInfo.version không tuân thủ canonical DER INTEGER' };
      }
      if (siVer.len !== 1 || siVer.val[0] !== 1) {
        return { isValid: false, reason: `SignerInfo.version không hợp lệ (nhận ${siVer.val[0]}, yêu cầu 1 theo RFC 5652 §5.3)` };
      }
      siP = siVer.next;
      const siSid = parseTLV(siSeq.val, siP); if (!siSid || siSid.tag !== 0x30) return { isValid: false, reason: 'SignerInfo.sid không phải là IssuerAndSerialNumber' }; siP = siSid.next;
      const siDa = parseTLV(siSeq.val, siP); if (!siDa || siDa.tag !== 0x30) return { isValid: false, reason: 'Thiếu digestAlgorithm trong SignerInfo' }; siP = siDa.next;
      const siDaOid = parseTLV(siDa.val, 0);
      if (!siDaOid || siDaOid.tag !== 0x06 || siDaOid.val.toString('hex') !== OID.sha256) {
        return { isValid: false, reason: `Thuật toán digestAlgorithm (${siDaOid ? siDaOid.val.toString('hex') : 'null'}) không phải là SHA-256!` };
      }
      if (siDaOid.next < siDa.val.length) {
        const siDaParam = parseTLV(siDa.val, siDaOid.next);
        if (!siDaParam || siDaParam.tag !== 0x05 || siDaParam.len !== 0 || siDaParam.next !== siDa.val.length) {
          return { isValid: false, reason: 'Tham số trong SignerInfo.digestAlgorithm không hợp lệ (chỉ chấp nhận absent hoặc NULL)' };
        }
      }
      const signedAttrsPart = parseTLV(siSeq.val, siP); if (!signedAttrsPart || signedAttrsPart.tag !== 0xa0) return { isValid: false, reason: 'Thiếu signedAttrs trong SignerInfo' }; siP = signedAttrsPart.next;
      const sigAlg = parseTLV(siSeq.val, siP);
      if (!sigAlg || sigAlg.tag !== 0x30) return { isValid: false, reason: 'Thiếu signatureAlgorithm trong SignerInfo' };
      siP = sigAlg.next;

      const sigAlgOid = parseTLV(sigAlg.val, 0);
      if (!sigAlgOid || sigAlgOid.tag !== 0x06) {
        return { isValid: false, reason: 'signatureAlgorithm thiếu OID thuật toán chữ ký' };
      }
      const sigAlgHex = sigAlgOid.val.toString('hex');
      if (sigAlgHex === OID.ecdsa_with_SHA256) {
        // RFC 5753 §2.1: Đối với ecdsa-with-SHA256, parameters MUST be absent hoặc NULL
        if (sigAlgOid.next < sigAlg.val.length) {
          const pTlv = parseTLV(sigAlg.val, sigAlgOid.next);
          if (!pTlv || pTlv.tag !== 0x05 || pTlv.len !== 0 || pTlv.next !== sigAlg.val.length) {
            return { isValid: false, reason: 'Tham số của ecdsa-with-SHA256 không hợp lệ (phải vắng mặt hoặc NULL)' };
          }
        }
      } else if (sigAlgHex === OID.sha256WithRSA || sigAlgHex === OID.rsaEncryption) {
        // RFC 4055 §5 & RFC 3370 §3.2: RSA signatureAlgorithm parameters MUST be NULL (05 00)
        if (sigAlgOid.next >= sigAlg.val.length) {
          return { isValid: false, reason: 'signatureAlgorithm RSA thiếu tham số NULL bắt buộc theo RFC 4055' };
        }
        const pTlv = parseTLV(sigAlg.val, sigAlgOid.next);
        if (!pTlv || pTlv.tag !== 0x05 || pTlv.len !== 0 || pTlv.next !== sigAlg.val.length) {
          return { isValid: false, reason: 'Tham số của RSA signatureAlgorithm không phải là ASN.1 NULL chuẩn (05 00)' };
        }
      } else {
        return { isValid: false, reason: `Thuật toán signatureAlgorithm (${sigAlgHex}) không được hỗ trợ hoặc không tương thích SHA-256/PAdES` };
      }

      const sigVal = parseTLV(siSeq.val, siP); if (!sigVal || sigVal.tag !== 0x04) return { isValid: false, reason: 'Thiếu signatureValue trong SignerInfo' }; siP = sigVal.next;
      
      let unsignedAttrsPart = null;
      if (siP < siSeq.val.length) {
        unsignedAttrsPart = parseTLV(siSeq.val, siP);
        if (!unsignedAttrsPart || unsignedAttrsPart.tag !== 0xa1) return { isValid: false, reason: 'unsignedAttrs không hợp lệ trong SignerInfo' };
        siP = unsignedAttrsPart.next;
      }
      if (siP !== siSeq.val.length) {
        return { isValid: false, reason: 'SignerInfo SEQUENCE chứa dữ liệu thừa ở cuối (trailing bytes)' };
      }

      const signatureValue = sigVal.val;

      // 6. Trích xuất chứng thư số người ký khớp CHÍNH XÁC với SignerInfo.sid (cấm fallback, kiểm tra null trước)
      const sidIssuer = parseTLV(siSid.val, 0);
      if (!sidIssuer || sidIssuer.tag !== 0x30) {
        return { isValid: false, reason: 'Issuer trong SignerInfo.sid không hợp lệ (không phải SEQUENCE tag 0x30)' };
      }
      const sidSerial = parseTLV(siSid.val, sidIssuer.next);
      if (!sidSerial || sidSerial.tag !== 0x02) {
        return { isValid: false, reason: 'Serial trong SignerInfo.sid không hợp lệ (không phải INTEGER tag 0x02)' };
      }
      if (sidSerial.next !== siSid.val.length) {
        return { isValid: false, reason: 'SignerInfo.sid chứa dữ liệu thừa ở cuối (trailing bytes)' };
      }

      const targetIssuerDer = siSid.val.subarray(sidIssuer.pos, sidIssuer.next);
      const targetSerialDer = sidSerial.val;

      let signerX509 = null;
      let matchedSignerCertDer = null;
      let matchedSignerCount = 0;
      const allSignerCerts = [];
      let cP = 0;
      while (cP < certsPart.val.length) {
        const cTLV = parseTLV(certsPart.val, cP);
        if (!cTLV || cTLV.tag !== 0x30) {
          return { isValid: false, reason: 'Cấu trúc chứng thư số trong certificates không hợp lệ (Fail-Closed)' };
        }
        const cDer = certsPart.val.subarray(cTLV.pos, cTLV.next);
        const meta = extractIssuerAndSerialFromCert(cDer);
        if (meta && meta.issuerDer.equals(targetIssuerDer) && meta.serialDer.equals(targetSerialDer)) {
          matchedSignerCertDer = cDer;
          matchedSignerCount++;
          try {
            signerX509 = new crypto.X509Certificate(cDer);
          } catch (e) {
            return { isValid: false, reason: `Không thể parse chứng thư X.509 của người ký: ${e.message}` };
          }
        }
        try {
          allSignerCerts.push(new crypto.X509Certificate(cDer));
        } catch (e) {
          return { isValid: false, reason: `Chứng thư trong certificates container không phải là X.509 hợp lệ (Fail-Closed): ${e.message}` };
        }
        cP = cTLV.next;
      }
      if (cP !== certsPart.val.length) {
        return { isValid: false, reason: 'certificates container của người ký chứa trailing bytes chưa được tiêu thụ (Fail-Closed)' };
      }

      if (matchedSignerCount > 1) {
        return { isValid: false, reason: 'Phát hiện nhiều chứng thư trùng khớp SignerInfo.sid (Multiple certificates match SignerInfo.sid)' };
      }
      if (!signerX509 || matchedSignerCount === 0) {
        return { isValid: false, reason: 'Không tìm thấy chứng thư số người ký khớp với IssuerAndSerialNumber trong SignerInfo.sid (Zero Fallback)' };
      }

      // Kiểm tra BasicConstraints của chứng thư người ký: Phải là leaf/end-entity, không được là CA
      if (signerX509.ca === true) {
        return { isValid: false, reason: 'Chứng thư người ký là chứng thư CA, không phải end-entity certificate (Fail-Closed)' };
      }

      // 7. Kiểm tra thời hạn hiệu lực của chứng thư người ký (chống Invalid Date)
      const now = new Date();
      const notBefore = new Date(signerX509.validFrom);
      const notAfter = new Date(signerX509.validTo);
      if (
        Number.isNaN(notBefore.getTime()) ||
        Number.isNaN(notAfter.getTime()) ||
        now < notBefore ||
        now > notAfter
      ) {
        return { isValid: false, reason: `Chứng thư số người ký đã hết hạn hoặc thời hạn không hợp lệ (${signerX509.validFrom} - ${signerX509.validTo})` };
      }

      // 8. Đối soát schema signedAttrs của người ký: Bắt buộc cả contentType (id-data) và messageDigest
      if (signedAttrsPart.val.length === 0) {
        return { isValid: false, reason: 'signedAttrs rỗng (Bắt buộc theo chuẩn CMS/PAdES)' };
      }

      let embeddedMessageDigest = null;
      let embeddedContentType = null;
      let saP = 0;
      const seenAttrs = new Set();
      while (saP < signedAttrsPart.val.length) {
        const attr = parseTLV(signedAttrsPart.val, saP);
        if (!attr || attr.tag !== 0x30) {
          return { isValid: false, reason: 'Cấu trúc thuộc tính trong signedAttrs không hợp lệ (Fail-Closed)' };
        }
        const aOid = parseTLV(attr.val, 0);
        if (!aOid || aOid.tag !== 0x06) {
          return { isValid: false, reason: 'Thuộc tính signedAttrs thiếu OID hợp lệ' };
        }
        const oidHex = aOid.val.toString('hex');
        if (seenAttrs.has(oidHex)) {
          return { isValid: false, reason: `Phát hiện thuộc tính trùng lặp trong signedAttrs (OID ${oidHex}) - Fail-Closed` };
        }
        seenAttrs.add(oidHex);

        const aSet = parseTLV(attr.val, aOid.next);
        if (!aSet || aSet.tag !== 0x31 || aSet.next !== attr.val.length) {
          return { isValid: false, reason: 'Thuộc tính signedAttrs phải là SET có độ dài chính xác' };
        }

        if (oidHex === OID.messageDigest) {
          const aOctet = parseTLV(aSet.val, 0);
          if (!aOctet || aOctet.tag !== 0x04 || aOctet.next !== aSet.val.length || aOctet.val.length !== 32) {
            return { isValid: false, reason: 'Trường messageDigest trong signedAttrs không phải là OCTET STRING 32 bytes (SHA-256) hoặc chứa trailing bytes' };
          }
          embeddedMessageDigest = aOctet.val;
        } else if (oidHex === OID.contentType) {
          const aCtOid = parseTLV(aSet.val, 0);
          if (!aCtOid || aCtOid.tag !== 0x06 || aCtOid.next !== aSet.val.length) {
            return { isValid: false, reason: 'Trường contentType trong signedAttrs không phải là OID hợp lệ hoặc chứa trailing bytes' };
          }
          if (aCtOid.val.toString('hex') !== OID.id_data) {
            return { isValid: false, reason: `Thuộc tính contentType (${aCtOid.val.toString('hex')}) không phải là id-data (OID 1.2.840.113549.1.7.1)` };
          }
          embeddedContentType = aCtOid.val.toString('hex');
        }
        saP = attr.next;
      }

      if (saP !== signedAttrsPart.val.length) {
        return { isValid: false, reason: 'signedAttrs container chứa trailing bytes chưa được tiêu thụ' };
      }

      if (!embeddedContentType) {
        return { isValid: false, reason: 'Thiếu thuộc tính bắt buộc contentType trong signedAttrs (Yêu cầu CMS RFC 5652)' };
      }
      if (embeddedContentType !== OID.id_data) {
        return { isValid: false, reason: `Thuộc tính contentType (${embeddedContentType}) không phải là id-data (OID 1.2.840.113549.1.7.1)` };
      }
      if (!embeddedMessageDigest) {
        return { isValid: false, reason: 'Thiếu thuộc tính bắt buộc messageDigest trong signedAttrs (Yêu cầu CMS RFC 5652)' };
      }

      if (!actualDocHash.equals(embeddedMessageDigest)) {
        return {
          isValid: false,
          byteRangeIntegrity: false,
          reason: 'Tài liệu đã bị sửa đổi sau khi ký! Mã băm ByteRange không khớp với messageDigest trong CMS SignedData.'
        };
      }

      // 9. Xác minh chữ ký số mật mã học của người ký bằng Public Key trong chứng thư
      let hashAlg = '';

      // Kiểm tra tham số khóa công khai người ký: Bắt buộc ECDSA curve P-256 hoặc RSA >= 2048
      if (sigAlgHex === OID.ecdsa_with_SHA256) {
        hashAlg = 'SHA256';
        if (signerX509.publicKey.asymmetricKeyType !== 'ec') {
          return { isValid: false, reason: 'Khóa công khai của người ký không phải là Elliptic Curve (EC)' };
        }
        const curveDetails = signerX509.publicKey.asymmetricKeyDetails;
        if (!curveDetails || (curveDetails.namedCurve !== 'prime256v1' && curveDetails.namedCurve !== 'secp256r1')) {
          return { isValid: false, reason: `Đường cong Elliptic Curve (${curveDetails ? curveDetails.namedCurve : 'unknown'}) không phải là P-256 (prime256v1/secp256r1)!` };
        }
      } else if (sigAlgHex === OID.sha256WithRSA || sigAlgHex === OID.rsaEncryption) {
        hashAlg = 'SHA256';
        if (signerX509.publicKey.asymmetricKeyType !== 'rsa') {
          return { isValid: false, reason: 'Khóa công khai của người ký không phải là RSA' };
        }
        const rsaDetails = signerX509.publicKey.asymmetricKeyDetails;
        if (!rsaDetails || !Number.isInteger(rsaDetails.modulusLength) || rsaDetails.modulusLength < 2048) {
          return { isValid: false, reason: `Độ dài khóa RSA (${rsaDetails ? rsaDetails.modulusLength : 'unknown'} bits) không hợp lệ hoặc dưới chuẩn an toàn 2048 bits!` };
        }
      } else {
        return {
          isValid: false,
          reason: `Thuật toán chữ ký không được hỗ trợ hoặc không được phép: ${sigAlgHex}`
        };
      }

      if (!hashAlg) {
        return { isValid: false, reason: 'Chưa xác định thuật toán băm cho chữ ký' };
      }

      const signedAttrsSet = Buffer.concat([
        Buffer.from([0x31]),
        encodeLength(signedAttrsPart.val.length),
        signedAttrsPart.val
      ]);

      let isSignerSignatureValid = false;
      try {
        const verifier = crypto.createVerify(hashAlg);
        verifier.update(signedAttrsSet);
        verifier.end();
        isSignerSignatureValid = verifier.verify(signerX509.publicKey, signatureValue);
      } catch (errSig) {
        isSignerSignatureValid = false;
      }

      if (!isSignerSignatureValid) {
        return {
          isValid: false,
          signerSignatureValid: false,
          reason: 'Chữ ký số mật mã học của người ký KHÔNG HỢP LỆ! (Không thể xác thực bằng khóa công khai)'
        };
      }

      // 10. BẮT BUỘC PAdES-B-T: Kiểm tra Dấu thời gian điện tử (id-aa-signatureTimeStamp)
      if (!unsignedAttrsPart || unsignedAttrsPart.tag !== 0xa1) {
        return {
          isValid: false,
          reason: 'Chữ ký thiếu Dấu thời gian điện tử trong unsignedAttributes (Bắt buộc theo chuẩn PAdES-B-T)!'
        };
      }

      let hasSignatureTimeStamp = false;
      let isTimeStampImprintValid = false;
      let isTsaCryptoSigValid = false;
      let tsaCertSubject = null;
      let genTime = null;
      let verifiedTsaResult = null;
      let timeStampTokenCount = 0;
      const seenUnsignedAttrs = new Set();

      let uaP = 0;
      while (uaP < unsignedAttrsPart.val.length) {
        const attr = parseTLV(unsignedAttrsPart.val, uaP);
        if (!attr || attr.tag !== 0x30) {
          return { isValid: false, reason: 'Cấu trúc unsignedAttrs không hợp lệ (Fail-Closed)' };
        }
        const aOid = parseTLV(attr.val, 0);
        if (!aOid || aOid.tag !== 0x06) {
          return { isValid: false, reason: 'Thuộc tính unsignedAttrs thiếu OID hợp lệ' };
        }
        const oidHex = aOid.val.toString('hex');
        if (seenUnsignedAttrs.has(oidHex)) {
          return { isValid: false, reason: `Phát hiện thuộc tính trùng lặp trong unsignedAttrs (OID ${oidHex}) - Fail-Closed` };
        }
        seenUnsignedAttrs.add(oidHex);

        const aSet = parseTLV(attr.val, aOid.next);
        if (!aSet || aSet.tag !== 0x31 || aSet.next !== attr.val.length) {
          return { isValid: false, reason: 'Thuộc tính unsignedAttrs phải là SET có độ dài chính xác' };
        }

        if (oidHex === OID.id_aa_sigTimeStamp) {
          hasSignatureTimeStamp = true;
          timeStampTokenCount++;
          if (timeStampTokenCount > 1) {
            return { isValid: false, reason: 'Chữ ký chứa nhiều hơn một id-aa-signatureTimeStamp (Vi phạm tính đơn trị PAdES-B-T)' };
          }
          const tokenTLV = parseTLV(aSet.val, 0);
          if (!tokenTLV || tokenTLV.tag !== 0x30) {
            return { isValid: false, reason: 'TimeStampToken trong unsignedAttrs không phải là SEQUENCE' };
          }
          if (tokenTLV.next !== aSet.val.length) {
            return { isValid: false, reason: 'SET id-aa-signatureTimeStamp chứa nhiều hơn một TimeStampToken hoặc có trailing bytes' };
          }
          const timeStampToken = aSet.val.subarray(tokenTLV.pos, tokenTLV.next);

          const expectedSigHash = crypto.createHash('sha256').update(signatureValue).digest();
          const tsaVerifyResult = this._extractAndVerifyTsaToken(timeStampToken, expectedSigHash);

          if (tsaVerifyResult.isValid) {
            isTimeStampImprintValid = true;
            isTsaCryptoSigValid = true;
            tsaCertSubject = tsaVerifyResult.subject;
            genTime = tsaVerifyResult.genTime;
            verifiedTsaResult = tsaVerifyResult;
          } else {
            return {
              isValid: false,
              reason: 'Dấu thời gian điện tử TSA không hợp lệ: ' + tsaVerifyResult.reason
            };
          }
        }
        uaP = attr.next;
      }

      if (uaP !== unsignedAttrsPart.val.length) {
        return { isValid: false, reason: 'unsignedAttrs container chứa trailing bytes chưa được tiêu thụ' };
      }

      if (!hasSignatureTimeStamp || timeStampTokenCount !== 1) {
        return {
          isValid: false,
          reason: 'Chữ ký thiếu hoặc chứa số lượng Dấu thời gian không hợp lệ trong unsignedAttributes (Bắt buộc đúng 1 theo PAdES-B-T)!'
        };
      }

      return {
        isValid: true,
        byteRangeIntegrity: true,
        messageDigestMatches: true,
        signerSignatureCryptographicallyValid: isSignerSignatureValid,
        signerSubject: signerX509.subject,
        signerIssuer: signerX509.issuer,
        signerSerialNumber: signerX509.serialNumber,
        signerTrustAnchor: 'Self-contained / CMS Embedded (Direct Key Binding)',
        signerTrustChainNote: 'CMS embedded certificate and cryptographic signature verified; VGCA trust-chain and revocation validation deferred to Gateway/OCSP in Phase 3.',
        signerTrustModel: {
          level: 'DIRECT_KEY_BINDING',
          scope: 'CRYPTOGRAPHIC_KEY_BINDING_ONLY',
          trustAnchor: 'Self-contained / CMS Embedded Certificate',
          cryptographicallyBound: true,
          revocationStatus: 'OUT_OF_SCOPE_PHASE2_DEFERRED_TO_PHASE3_GATEWAY',
          note: 'Giai đoạn 2 thẩm định toàn vẹn mật mã học của chữ ký PDF và chứng minh tính hợp lệ của Dấu thời gian PAdES-B-T so với chứng thư nhúng trong CMS. Việc xây dựng trust chain tới VGCA RootCA và kiểm tra trạng thái thu hồi OCSP/CRL thuộc phạm vi Gateway/OCSP ở Giai đoạn 3.'
        },
        hasSignatureTimeStamp: true,
        signatureTimeStampImprintMatches: isTimeStampImprintValid,
        tsaSignatureCryptographicallyValid: isTsaCryptoSigValid,
        tsaSubject: tsaCertSubject,
        tsaTrustAnchor: 'RootCA chuyên dùng Chính phủ G2 (Ban Cơ yếu Chính phủ)',
        tsaTrustModel: {
          level: 'VGCA_PINNED_TRUST_ANCHOR',
          trustAnchor: 'RootCA chuyên dùng Chính phủ G2 (Ban Cơ yếu Chính phủ)',
          certificateFingerprint: verifiedTsaResult.fingerprint256,
          isPinned: verifiedTsaResult.isPinnedTrustAnchor,
          revocationStatus: 'DEFERRED_TO_PHASE3_GATEWAY'
        },
        genTime: genTime,
        reason: 'Tài liệu nguyên vẹn, Chữ ký số người ký (Direct Key Binding) và Dấu thời gian PAdES-B-T Ban Cơ yếu Chính phủ hợp lệ.'
      };
    } catch (err) {
      return { isValid: false, reason: `Lỗi phân tích mật mã PDF: ${err.message}` };
    }
  }

  _extractAndVerifyTsaToken(timeStampToken, expectedSignatureHash, validationTime = new Date()) {
    try {
      const root = parseTLV(timeStampToken, 0);
      if (!root || root.tag !== 0x30 || root.next !== timeStampToken.length) {
        return { isValid: false, reason: 'Token không phải là SEQUENCE hoặc có dữ liệu thừa' };
      }

      const ctOid = parseTLV(timeStampToken, root.pos + root.hl);
      if (!ctOid || ctOid.tag !== 0x06 || ctOid.val.toString('hex') !== OID.id_signedData) {
        return { isValid: false, reason: 'Token không phải là SignedData' };
      }

      const sdCtx = parseTLV(timeStampToken, ctOid.next);
      if (!sdCtx || sdCtx.tag !== 0xa0) return { isValid: false, reason: 'Thiếu SignedData context [0]' };
      if (sdCtx.next !== timeStampToken.length) return { isValid: false, reason: 'TimeStampToken chứa dữ liệu thừa ngoài SignedData container' };

      const sdSeq = parseTLV(sdCtx.val, 0);
      if (!sdSeq || sdSeq.tag !== 0x30 || sdSeq.next !== sdCtx.val.length) {
        return { isValid: false, reason: 'SignedData không phải là SEQUENCE hoặc chứa trailing bytes' };
      }

      let sP = 0;
      const ver = parseTLV(sdSeq.val, sP);
      if (!ver || ver.tag !== 0x02 || ver.len === 0) return { isValid: false, reason: 'Thiếu hoặc sai định dạng version trong TSA SignedData' };
      if (ver.len > 1 && ver.val[0] === 0x00 && (ver.val[1] & 0x80) === 0) {
        return { isValid: false, reason: 'TSA SignedData.version không tuân thủ canonical DER INTEGER' };
      }
      if (ver.len !== 1 || (ver.val[0] !== 1 && ver.val[0] !== 3)) {
        return { isValid: false, reason: `TSA SignedData.version không hợp lệ (nhận ${ver.val[0]}, yêu cầu 1 hoặc 3 theo RFC 5652)` };
      }
      sP = ver.next;

      const da = parseTLV(sdSeq.val, sP);
      if (!da || da.tag !== 0x31 || da.val.length === 0) return { isValid: false, reason: 'Thiếu hoặc rỗng digestAlgorithms trong TSA SignedData' };
      sP = da.next;

      // Xác minh toàn diện tập digestAlgorithms và từng AlgorithmIdentifier
      const allowedDigestAlgs = new Set();
      let daP = 0;
      while (daP < da.val.length) {
        const daAlgTLV = parseTLV(da.val, daP);
        if (!daAlgTLV || daAlgTLV.tag !== 0x30) {
          return { isValid: false, reason: 'AlgorithmIdentifier trong TSA SignedData.digestAlgorithms không hợp lệ' };
        }
        const daAlgOid = parseTLV(daAlgTLV.val, 0);
        if (!daAlgOid || daAlgOid.tag !== 0x06) {
          return { isValid: false, reason: 'Thiếu OID trong TSA digestAlgorithms AlgorithmIdentifier' };
        }
        const algHex = daAlgOid.val.toString('hex');
        if (algHex !== OID.sha256) {
          return { isValid: false, reason: `TSA SignedData.digestAlgorithms chứa thuật toán không được phép (${algHex}), chỉ chấp nhận SHA-256` };
        }
        if (daAlgOid.next < daAlgTLV.val.length) {
          const daParam = parseTLV(daAlgTLV.val, daAlgOid.next);
          if (!daParam || daParam.tag !== 0x05 || daParam.len !== 0 || daParam.next !== daAlgTLV.val.length) {
            return { isValid: false, reason: 'Tham số của SHA-256 trong TSA SignedData.digestAlgorithms không hợp lệ (chỉ chấp nhận absent hoặc NULL)' };
          }
        } else if (daAlgOid.next !== daAlgTLV.val.length) {
          return { isValid: false, reason: 'AlgorithmIdentifier trong TSA SignedData.digestAlgorithms chứa trailing bytes' };
        }
        allowedDigestAlgs.add(algHex);
        daP = daAlgTLV.next;
      }
      if (daP !== da.val.length || !allowedDigestAlgs.has(OID.sha256)) {
        return { isValid: false, reason: 'TSA SignedData.digestAlgorithms không hợp lệ hoặc thiếu SHA-256' };
      }

      const eci = parseTLV(sdSeq.val, sP); if (!eci || eci.tag !== 0x30) return { isValid: false, reason: 'Thiếu encapContentInfo trong SignedData' }; sP = eci.next;
      const certsPart = parseTLV(sdSeq.val, sP); if (!certsPart || certsPart.tag !== 0xa0) return { isValid: false, reason: 'Thiếu certificates trong SignedData' }; sP = certsPart.next;
      const sisPart = parseTLV(sdSeq.val, sP); if (!sisPart || sisPart.tag !== 0x31 || sisPart.val.length === 0) return { isValid: false, reason: 'Thiếu signerInfos trong SignedData' }; sP = sisPart.next;
      if (sP !== sdSeq.val.length) {
        return { isValid: false, reason: 'TSA SignedData SEQUENCE chứa dữ liệu thừa ở cuối (trailing bytes)' };
      }

      // Đối chiếu ngay tính nhất quán giữa SignerInfo.digestAlgorithm và tập allowedDigestAlgs
      const checkSi = parseTLV(sisPart.val, 0);
      if (!checkSi || checkSi.tag !== 0x30) return { isValid: false, reason: 'TSA SignerInfo không phải là SEQUENCE' };
      if (checkSi.next !== sisPart.val.length) {
        return { isValid: false, reason: 'TSA signerInfos SET chứa nhiều hơn một SignerInfo hoặc có trailing bytes (RFC 3161 yêu cầu đúng 1)' };
      }
      const checkSiVer = parseTLV(checkSi.val, 0);
      if (!checkSiVer || checkSiVer.tag !== 0x02) return { isValid: false, reason: 'Thiếu version trong TSA SignerInfo' };
      const checkSiSid = parseTLV(checkSi.val, checkSiVer.next);
      if (!checkSiSid || checkSiSid.tag !== 0x30) return { isValid: false, reason: 'TSA SignerInfo.sid không hợp lệ' };
      const checkSiDa = parseTLV(checkSi.val, checkSiSid.next);
      if (!checkSiDa || checkSiDa.tag !== 0x30) return { isValid: false, reason: 'Thiếu digestAlgorithm trong TSA SignerInfo' };
      const checkSiDaOid = parseTLV(checkSiDa.val, 0);
      if (!checkSiDaOid || checkSiDaOid.tag !== 0x06 || !allowedDigestAlgs.has(checkSiDaOid.val.toString('hex'))) {
        return { isValid: false, reason: 'TSA SignerInfo.digestAlgorithm không nhất quán với SignedData.digestAlgorithms' };
      }
      if (checkSiDaOid.next < checkSiDa.val.length) {
        const checkSiDaParam = parseTLV(checkSiDa.val, checkSiDaOid.next);
        if (!checkSiDaParam || checkSiDaParam.tag !== 0x05 || checkSiDaParam.len !== 0 || checkSiDaParam.next !== checkSiDa.val.length) {
          return { isValid: false, reason: 'Tham số trong TSA SignerInfo.digestAlgorithm không hợp lệ (chỉ chấp nhận absent hoặc NULL)' };
        }
      } else if (checkSiDaOid.next !== checkSiDa.val.length) {
        return { isValid: false, reason: 'TSA SignerInfo.digestAlgorithm chứa trailing bytes' };
      }

      const eciOid = parseTLV(eci.val, 0);
      if (!eciOid || eciOid.tag !== 0x06 || eciOid.val.toString('hex') !== '2a864886f70d0109100104') {
        return { isValid: false, reason: 'eContentType không phải là id-ct-TSTInfo' };
      }

      const eContentCtx = parseTLV(eci.val, eciOid.next);
      if (!eContentCtx || eContentCtx.tag !== 0xa0) return { isValid: false, reason: 'Thiếu eContent [0] trong encapContentInfo' };
      if (eContentCtx.next !== eci.val.length) {
        return { isValid: false, reason: 'encapContentInfo chứa dữ liệu thừa sau trường [0] eContent' };
      }
      const eContentOctet = parseTLV(eContentCtx.val, 0);
      if (!eContentOctet || eContentOctet.tag !== 0x04 || eContentOctet.next !== eContentCtx.val.length) {
        return { isValid: false, reason: 'eContent không phải là OCTET STRING hoặc chứa trailing bytes' };
      }

      const tstInfoDer = eContentOctet.val;
      const expectedTstHash = crypto.createHash('sha256').update(tstInfoDer).digest();

      const tstClient = new TsaClient();
      const tstInfo = tstClient.parseStrictTSTInfo(tstInfoDer);

      const tstImprintAlg = (tstInfo.messageImprint && tstInfo.messageImprint.hashAlgorithm) || tstInfo.hashAlgorithm;
      if (!tstImprintAlg || tstImprintAlg !== OID.sha256) {
        return { isValid: false, reason: 'Thuật toán băm trong TSTInfo.messageImprint không phải là SHA-256' };
      }
      if (!allowedDigestAlgs.has(tstImprintAlg) || !tstInfo.hashedMessage || tstInfo.hashedMessage.length !== 32) {
        return { isValid: false, reason: 'Thuật toán băm trong TSTInfo.messageImprint không nhất quán với SignedData.digestAlgorithms' };
      }
      if (!expectedSignatureHash.equals(tstInfo.hashedMessage)) {
        return { isValid: false, reason: 'TSTInfo.messageImprint không khớp với băm của chữ ký (signatureValue)' };
      }

      // 4.1 FAIL-CLOSED: Kiểm tra thời gian cấp dấu genTime không vượt quá hiện tại + drift (chống future timestamp)
      const tokenDate = new Date(Date.UTC(
        parseInt(tstInfo.genTime.slice(0, 4), 10),
        parseInt(tstInfo.genTime.slice(4, 6), 10) - 1,
        parseInt(tstInfo.genTime.slice(6, 8), 10),
        parseInt(tstInfo.genTime.slice(8, 10), 10),
        parseInt(tstInfo.genTime.slice(10, 12), 10),
        parseInt(tstInfo.genTime.slice(12, 14), 10)
      ));
      const refTimeMs = validationTime ? validationTime.getTime() : Date.now();
      const maxDriftMs = 15 * 60 * 1000; // 15 phút
      if (tokenDate.getTime() > refTimeMs + maxDriftMs) {
        return { isValid: false, reason: `Thời gian cấp dấu trong tương lai vượt quá giới hạn sai lệch cho phép (${tstInfo.genTime} vs mốc xác thực ${new Date(refTimeMs).toISOString()})` };
      }

      // Xác minh chữ ký RSA của TSA
      const siSeq = parseTLV(sisPart.val, 0);
      if (!siSeq || siSeq.tag !== 0x30) return { isValid: false, reason: 'TSA SignerInfo không phải là SEQUENCE' };
      if (siSeq.next !== sisPart.val.length) {
        return { isValid: false, reason: 'TSA signerInfos SET chứa dữ liệu thừa hoặc nhiều SignerInfo ngoài quy chuẩn' };
      }

      let siP = 0;
      const siVer = parseTLV(siSeq.val, siP);
      if (!siVer || siVer.tag !== 0x02 || siVer.len === 0) return { isValid: false, reason: 'Thiếu hoặc sai định dạng version trong TSA SignerInfo' };
      if (siVer.len > 1 && siVer.val[0] === 0x00 && (siVer.val[1] & 0x80) === 0) {
        return { isValid: false, reason: 'TSA SignerInfo.version không tuân thủ canonical DER INTEGER' };
      }
      if (siVer.len !== 1 || siVer.val[0] !== 1) {
        return { isValid: false, reason: `TSA SignerInfo.version không hợp lệ (nhận ${siVer.val[0]}, yêu cầu 1 theo RFC 5652)` };
      }
      siP = siVer.next;
      const siSid = parseTLV(siSeq.val, siP); if (!siSid || siSid.tag !== 0x30) return { isValid: false, reason: 'TSA SignerInfo.sid không phải là IssuerAndSerialNumber' }; siP = siSid.next;
      const siDa = parseTLV(siSeq.val, siP); if (!siDa || siDa.tag !== 0x30) return { isValid: false, reason: 'Thiếu digestAlgorithm trong TSA SignerInfo' }; siP = siDa.next;
      const siDaOid = parseTLV(siDa.val, 0);
      if (!siDaOid || siDaOid.tag !== 0x06 || siDaOid.val.toString('hex') !== OID.sha256) {
        return { isValid: false, reason: 'TSA digestAlgorithm không phải là SHA-256' };
      }
      if (!allowedDigestAlgs.has(siDaOid.val.toString('hex'))) {
        return { isValid: false, reason: 'TSA SignerInfo.digestAlgorithm không nhất quán với SignedData.digestAlgorithms' };
      }
      if (siDaOid.next < siDa.val.length) {
        const tsaDaParam = parseTLV(siDa.val, siDaOid.next);
        if (!tsaDaParam || tsaDaParam.tag !== 0x05 || tsaDaParam.len !== 0 || tsaDaParam.next !== siDa.val.length) {
          return { isValid: false, reason: 'Tham số trong TSA digestAlgorithm không hợp lệ (chỉ chấp nhận absent hoặc NULL)' };
        }
      } else if (siDaOid.next !== siDa.val.length) {
        return { isValid: false, reason: 'TSA digestAlgorithm AlgorithmIdentifier chứa trailing bytes' };
      }
      const signedAttrsPart = parseTLV(siSeq.val, siP); if (!signedAttrsPart || signedAttrsPart.tag !== 0xa0) return { isValid: false, reason: 'Thiếu signedAttrs trong TSA SignerInfo' }; siP = signedAttrsPart.next;
      const sigAlg = parseTLV(siSeq.val, siP); if (!sigAlg || sigAlg.tag !== 0x30) return { isValid: false, reason: 'Thiếu signatureAlgorithm trong TSA SignerInfo' }; siP = sigAlg.next;
      const sigAlgOid = parseTLV(sigAlg.val, 0);
      if (!sigAlgOid || sigAlgOid.tag !== 0x06) {
        return { isValid: false, reason: 'Thiếu hoặc sai định dạng OID trong TSA signatureAlgorithm' };
      }
      const sigAlgHex = sigAlgOid.val.toString('hex');
      if (sigAlgHex !== OID.sha256WithRSA) {
        return { isValid: false, reason: `TSA signatureAlgorithm (${sigAlgHex}) không phải là sha256WithRSAEncryption (OID 1.2.840.113549.1.1.11)` };
      }
      if (sigAlgOid.next >= sigAlg.val.length) {
        return { isValid: false, reason: 'TSA signatureAlgorithm thiếu tham số NULL bắt buộc theo RFC 4055' };
      }
      const tsaSigParam = parseTLV(sigAlg.val, sigAlgOid.next);
      if (!tsaSigParam || tsaSigParam.tag !== 0x05 || tsaSigParam.len !== 0 || tsaSigParam.next !== sigAlg.val.length) {
        return { isValid: false, reason: 'Tham số của TSA signatureAlgorithm không phải là ASN.1 NULL chuẩn (05 00)' };
      }
      const sigVal = parseTLV(siSeq.val, siP); if (!sigVal || sigVal.tag !== 0x04) return { isValid: false, reason: 'Thiếu signatureValue trong TSA SignerInfo' }; siP = sigVal.next;
      if (siP < siSeq.val.length) {
        const tsaUnsignedAttrs = parseTLV(siSeq.val, siP);
        if (!tsaUnsignedAttrs || tsaUnsignedAttrs.tag !== 0xa1) return { isValid: false, reason: 'TSA unsignedAttrs không hợp lệ' };
        siP = tsaUnsignedAttrs.next;
      }
      if (siP !== siSeq.val.length) {
        return { isValid: false, reason: 'TSA SignerInfo SEQUENCE chứa dữ liệu thừa ở cuối (trailing bytes)' };
      }

      // Kiểm tra signedAttrs của TSA (Fail-closed nếu có phần tử hỏng hoặc duplicate)
      let saP = 0;
      let tsaMd = null;
      let tsaCt = null;
      const tsaSeenAttrs = new Set();
      while (saP < signedAttrsPart.val.length) {
        const attr = parseTLV(signedAttrsPart.val, saP);
        if (!attr || attr.tag !== 0x30) {
          return { isValid: false, reason: 'Cấu trúc thuộc tính trong TSA signedAttrs không hợp lệ (Fail-Closed)' };
        }
        const aOid = parseTLV(attr.val, 0);
        if (!aOid || aOid.tag !== 0x06) {
          return { isValid: false, reason: 'Thuộc tính TSA signedAttrs thiếu OID hợp lệ' };
        }
        const oidHex = aOid.val.toString('hex');
        if (tsaSeenAttrs.has(oidHex)) {
          return { isValid: false, reason: `Phát hiện thuộc tính trùng lặp trong TSA signedAttrs (OID ${oidHex}) - Fail-Closed` };
        }
        tsaSeenAttrs.add(oidHex);

        const aSet = parseTLV(attr.val, aOid.next);
        if (!aSet || aSet.tag !== 0x31 || aSet.next !== attr.val.length) {
          return { isValid: false, reason: 'Thuộc tính TSA signedAttrs phải là SET có độ dài chính xác' };
        }
        if (oidHex === '2a864886f70d010904') {
          const oct = parseTLV(aSet.val, 0);
          if (oct && oct.tag === 0x04 && oct.next === aSet.val.length) tsaMd = oct.val;
        } else if (oidHex === '2a864886f70d010903') {
          const coid = parseTLV(aSet.val, 0);
          if (coid && coid.tag === 0x06 && coid.next === aSet.val.length) tsaCt = coid.val.toString('hex');
        }
        saP = attr.next;
      }

      if (tsaCt !== '2a864886f70d0109100104') {
        return { isValid: false, reason: 'TSA signedAttrs contentType không phải là id-ct-TSTInfo' };
      }
      if (!tsaMd || !expectedTstHash.equals(tsaMd)) {
        return { isValid: false, reason: 'TSA signedAttrs messageDigest không khớp với mã băm của TSTInfo' };
      }

      // Trích xuất chứng thư TSA khớp CHÍNH XÁC cả Issuer DER và Serial DER (cấm fallback, kiểm tra null trước)
      const sidIssuer = parseTLV(siSid.val, 0);
      if (!sidIssuer || sidIssuer.tag !== 0x30) {
        return { isValid: false, reason: 'TSA SignerInfo.sid issuer không phải là SEQUENCE (tag 0x30)' };
      }
      const sidSerial = parseTLV(siSid.val, sidIssuer.next);
      if (!sidSerial || sidSerial.tag !== 0x02) {
        return { isValid: false, reason: 'TSA SignerInfo.sid serial không phải là INTEGER (tag 0x02)' };
      }
      if (sidSerial.next !== siSid.val.length) {
        return { isValid: false, reason: 'TSA SignerInfo.sid chứa trailing bytes' };
      }

      const targetIssuerDer = siSid.val.subarray(sidIssuer.pos, sidIssuer.next);
      const targetSerialDer = sidSerial.val;

      let matchedTsaCertDer = null;
      let matchedTsaCount = 0;
      const allCerts = [];
      let cP = 0;
      while (cP < certsPart.val.length) {
        const cTLV = parseTLV(certsPart.val, cP);
        if (!cTLV || cTLV.tag !== 0x30) {
          return { isValid: false, reason: 'Cấu trúc chứng thư TSA không hợp lệ trong certificates container (Fail-Closed)' };
        }
        const cDer = certsPart.val.subarray(cTLV.pos, cTLV.next);
        const meta = extractIssuerAndSerialFromCert(cDer);
        if (meta && meta.issuerDer.equals(targetIssuerDer) && meta.serialDer.equals(targetSerialDer)) {
          matchedTsaCertDer = cDer;
          matchedTsaCount++;
        }
        try {
          allCerts.push(new crypto.X509Certificate(cDer));
        } catch (e) {
          return { isValid: false, reason: `Chứng thư trong TSA certificates container không phải là X.509 hợp lệ (Fail-Closed): ${e.message}` };
        }
        cP = cTLV.next;
      }
      if (cP !== certsPart.val.length) {
        return { isValid: false, reason: 'certificates container chứa trailing bytes chưa được tiêu thụ' };
      }

      if (matchedTsaCount > 1) {
        return { isValid: false, reason: 'Phát hiện nhiều chứng thư trùng khớp SignerInfo.sid trong TimeStampToken (Multiple certificates match SignerInfo.sid)' };
      }
      if (!matchedTsaCertDer || matchedTsaCount === 0) {
        return { isValid: false, reason: 'Không tìm thấy chứng thư TSA khớp với IssuerAndSerialNumber trong SignerInfo.sid' };
      }

      const tsaX509 = new crypto.X509Certificate(matchedTsaCertDer);

      // 1. Kiểm tra BasicConstraints và Extended Key Usage của Leaf TSA
      if (tsaX509.ca === true) {
        return { isValid: false, reason: 'Chứng thư TSA là chứng thư CA (vi phạm nguyên tắc Leaf TSA)' };
      }
      if (!hasTimeStampingEKU(tsaX509)) {
        return { isValid: false, reason: 'Chứng thư TSA thiếu ExtendedKeyUsage id-kp-timeStamping (1.3.6.1.5.5.7.3.8) theo RFC 3161!' };
      }

      // 2. Xây dựng và xác minh toàn vẹn chuỗi chứng thư X.509 Path Validation (RFC 5280)
      const OFFICIAL_ROOT_CA_G2_FINGERPRINT = 'F0:4B:A4:B4:59:A7:C9:A1:B9:71:AD:9B:1C:B8:33:E6:95:A8:0C:79:AE:A6:3B:17:4B:66:A7:0E:DF:E2:FD:B8';
      const pathValidation = validateX509CertificatePath(tsaX509, allCerts, OFFICIAL_ROOT_CA_G2_FINGERPRINT);
      if (!pathValidation.isValid) {
        return { isValid: false, reason: pathValidation.reason };
      }
      const rootCaX509 = pathValidation.rootCa;

      // 3. Xác minh vân tay SHA-256 của Leaf TSA (Trust Anchor Pinning)
      const OFFICIAL_VGCA_TSA_PINNED_FINGERPRINTS = new Set([
        'EA:E4:6D:68:A0:B9:21:EC:7C:82:DA:11:C7:54:66:22:2F:49:96:91:2E:53:CA:A4:1E:C7:06:72:CE:95:4B:D6' // Máy chủ cấp dấu thời gian 02 (ca.gov.vn)
      ]);
      const isPinned = OFFICIAL_VGCA_TSA_PINNED_FINGERPRINTS.has(tsaX509.fingerprint256);
      if (!isPinned) {
        return { isValid: false, reason: `Chứng thư TSA không khớp vân tay SHA-256 được ghim cứng của Ban Cơ yếu Chính phủ (Nhận: ${tsaX509.fingerprint256}, Yêu cầu một trong: ${Array.from(OFFICIAL_VGCA_TSA_PINNED_FINGERPRINTS).join(', ')})` };
      }

      // Kiểm tra thời hạn hiệu lực của cả Leaf và RootCA
      const now = validationTime instanceof Date ? validationTime : new Date(validationTime);
      if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
        return { isValid: false, reason: 'validationTime không phải là mốc thời gian hợp lệ' };
      }
      const leafFrom = new Date(tsaX509.validFrom);
      const leafTo = new Date(tsaX509.validTo);
      const rootFrom = new Date(rootCaX509.validFrom);
      const rootTo = new Date(rootCaX509.validTo);
      if (now < leafFrom || now > leafTo || Number.isNaN(leafFrom.getTime()) || Number.isNaN(leafTo.getTime())) {
        return { isValid: false, reason: `Chứng thư TSA đã hết hạn hoặc thời hạn không hợp lệ (${tsaX509.validFrom} - ${tsaX509.validTo})` };
      }
      if (now < rootFrom || now > rootTo || Number.isNaN(rootFrom.getTime()) || Number.isNaN(rootTo.getTime())) {
        return { isValid: false, reason: `RootCA chuyên dùng Chính phủ đã hết hạn (${rootCaX509.validFrom} - ${rootCaX509.validTo})` };
      }

      // Kiểm tra thẩm quyền Ban Cơ yếu Chính phủ
      if (!tsaX509.subject.includes('Ban Cơ yếu Chính phủ') && !tsaX509.issuer.includes('Ban Cơ yếu Chính phủ')) {
        return { isValid: false, reason: 'Chứng thư TSA không thuộc Ban Cơ yếu Chính phủ' };
      }

      // Kiểm tra chữ ký RSA của TSA
      const signedAttrsSet = Buffer.concat([
        Buffer.from([0x31]),
        encodeLength(signedAttrsPart.val.length),
        signedAttrsPart.val
      ]);

      if (tsaX509.publicKey.asymmetricKeyType !== 'rsa') {
        return { isValid: false, reason: 'Khóa công khai của máy chủ TSA không phải là RSA' };
      }
      const tsaRsaDetails = tsaX509.publicKey.asymmetricKeyDetails;
      if (!tsaRsaDetails || !Number.isInteger(tsaRsaDetails.modulusLength) || tsaRsaDetails.modulusLength < 2048) {
        return { isValid: false, reason: `Độ dài khóa RSA của máy chủ TSA (${tsaRsaDetails ? tsaRsaDetails.modulusLength : 'unknown'} bits) dưới chuẩn an toàn 2048 bits!` };
      }

      const verifier = crypto.createVerify('RSA-SHA256');
      verifier.update(signedAttrsSet);
      verifier.end();
      const isSigValid = verifier.verify(tsaX509.publicKey, sigVal.val);
      if (!isSigValid) return { isValid: false, reason: 'Chữ ký RSA của máy chủ TSA không hợp lệ' };

      return {
        isValid: true,
        subject: tsaX509.subject,
        issuer: tsaX509.issuer,
        fingerprint256: tsaX509.fingerprint256,
        rootCaFingerprint: rootCaX509.fingerprint256,
        isPinnedTrustAnchor: isPinned,
        isChainCryptographicallyVerified: true,
        isGovRootCa: true,
        genTime: tstInfo.genTime
      };
    } catch (e) {
      return { isValid: false, reason: e.message };
    }
  }
}

module.exports = PdfPadesSigner;
module.exports.PdfPadesSigner = PdfPadesSigner;
module.exports.generateSelfSignedX509 = generateSelfSignedX509;
module.exports.parseTLV = parseTLV;
module.exports.validateX509CertificatePath = validateX509CertificatePath;
module.exports.hasTimeStampingEKU = hasTimeStampingEKU;
module.exports.parseBasicConstraintsFromDer = parseBasicConstraintsFromDer;
module.exports.parseKeyUsageFromDer = parseKeyUsageFromDer;
