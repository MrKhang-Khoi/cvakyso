// tests/test_challenger_live_trace.js
// Independent Empirical Verification by Challenger 1
const assert = require('assert');

const WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbwGBgauc9xHzRe31_IfCQD-Q9yHwGp4CfYLEam9IupcYhLpNBXbgW0J1t-weD6iUQ87ZQ/exec';

async function sendRequest(payload, options = {}) {
  const start = Date.now();
  const res = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8'
    },
    body: JSON.stringify(payload),
    redirect: 'follow',
    ...options
  });
  const latency = Date.now() - start;
  const status = res.status;
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch (e) {
    // not json
  }
  return { status, text, json, latency };
}

async function runLiveProbes() {
  console.log('================================================================');
  console.log('CHALLENGER 1: LIVE NETWORK TRACE TEST TO GOOGLE APPS SCRIPT');
  console.log('Target URL:', WEBHOOK_URL);
  console.log('Timestamp:', new Date().toISOString());
  console.log('================================================================\n');

  const results = {
    probeA: null,
    probeB: null,
    probeC: null
  };

  // -------------------------------------------------------------
  // PROBE A: Send POST NOTIFY_SIGN_EVENT without secret_token
  // Expected: HTTP 200, { success: false, error: "UNAUTHORIZED_SECRET_TOKEN" }
  // -------------------------------------------------------------
  console.log('>>> [PROBE A] Testing unauthorized request (missing secret_token)...');
  const payloadA = {
    action: 'NOTIFY_SIGN_EVENT',
    eventType: 'SUBMITTED',
    docId: 'PROBE-A-' + Date.now(),
    docTitle: 'Thử nghiệm An ninh Challenger 1 Probe A',
    authorPhone: '0818810007',
    recipientPhone: '0905123456',
    senderName: 'Challenger 1'
  };

  const resA = await sendRequest(payloadA);
  console.log('  Status Code:', resA.status);
  console.log('  Latency:', resA.latency, 'ms');
  console.log('  Response Body:', resA.text);
  results.probeA = resA;

  assert.strictEqual(resA.status, 200, 'Probe A must return HTTP 200');
  assert.ok(resA.json, 'Probe A response must be valid JSON');
  assert.strictEqual(resA.json.success, false, 'Probe A success must be false');
  assert.strictEqual(resA.json.error, 'UNAUTHORIZED_SECRET_TOKEN', 'Probe A error must be UNAUTHORIZED_SECRET_TOKEN');
  console.log('  [PASS] Probe A correctly rejected with UNAUTHORIZED_SECRET_TOKEN!\n');

  // -------------------------------------------------------------
  // PROBE B: Send POST NOTIFY_SIGN_EVENT with secret_token for PERSONAL_SIGNED to 0818810007
  // Expected: HTTP 200, { success: true, delivered: true, phone: "0818810007" }
  // -------------------------------------------------------------
  console.log('>>> [PROBE B] Testing authorized PERSONAL_SIGNED to Thầy Hà Văn Tý (0818810007)...');
  const payloadB = {
    action: 'NOTIFY_SIGN_EVENT',
    secret_token: 'UnifiedZaloBotTHCSCVA2026Secret',
    eventType: 'PERSONAL_SIGNED',
    docId: 'PROBE-B-' + Date.now(),
    docTitle: 'KHBD Thực nghiệm Challenger 1 (Toán 9)',
    authorPhone: '0818810007',
    senderName: 'Hà Văn Tý'
  };

  const resB = await sendRequest(payloadB);
  console.log('  Status Code:', resB.status);
  console.log('  Latency:', resB.latency, 'ms');
  console.log('  Response Body:', resB.text);
  results.probeB = resB;

  assert.strictEqual(resB.status, 200, 'Probe B must return HTTP 200');
  assert.ok(resB.json, 'Probe B response must be valid JSON');
  assert.strictEqual(resB.json.success, true, 'Probe B success must be true');
  assert.strictEqual(resB.json.delivered, true, 'Probe B delivered must be true');
  assert.strictEqual(resB.json.phone, '0818810007', 'Probe B phone must be 0818810007');
  console.log(`  [PASS] Probe B delivered to 0818810007 in ${resB.latency}ms!\n`);

  // -------------------------------------------------------------
  // PROBE C: Send POST NOTIFY_SIGN_EVENT for SUBMITTED with authorPhone: 0818810007 & recipientPhone: 0905123456
  // Expected: Verify response details and graceful fallback
  // -------------------------------------------------------------
  console.log('>>> [PROBE C] Testing SUBMITTED with authorPhone (0818810007) and unlinked recipientPhone (0905123456)...');
  const payloadC = {
    action: 'NOTIFY_SIGN_EVENT',
    secret_token: 'UnifiedZaloBotTHCSCVA2026Secret',
    eventType: 'SUBMITTED',
    docId: 'PROBE-C-' + Date.now(),
    docTitle: 'Báo cáo Kiểm tra Toàn diện THCS CVA - Challenger 1',
    authorPhone: '0818810007',
    recipientPhone: '0905123456',
    recipientName: 'Thầy Tổ Trưởng Mẫu',
    senderName: 'Hà Văn Tý'
  };

  const resC = await sendRequest(payloadC);
  console.log('  Status Code:', resC.status);
  console.log('  Latency:', resC.latency, 'ms');
  console.log('  Response Body:', resC.text);
  results.probeC = resC;

  assert.strictEqual(resC.status, 200, 'Probe C must return HTTP 200');
  assert.ok(resC.json, 'Probe C response must be valid JSON');
  assert.strictEqual(resC.json.success, true, 'Probe C success must be true');
  console.log('  Probe C analysis:');
  console.log('    - success:', resC.json.success);
  console.log('    - delivered:', resC.json.delivered);
  console.log('    - authorDelivered:', resC.json.authorDelivered);
  console.log('    - recipientDelivered:', resC.json.recipientDelivered);
  console.log('    - recipientNote:', resC.json.recipientNote);
  console.log('    - note:', resC.json.note);
  console.log('    - phone:', resC.json.phone);

  console.log(`\n================================================================`);
  console.log('ALL 3 LIVE PROBES EXECUTED AND RECORDED SUCCESSFULLY!');
  console.log('================================================================');
  return results;
}

runLiveProbes().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('PROBE EXECUTION ERROR:', err);
  process.exit(1);
});
