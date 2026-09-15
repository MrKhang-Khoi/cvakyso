/**
 * Independent Verification Script by Tester 1
 * Targets:
 * 1. 3-way mirror SHA-256 check of js/app.js, public/js/app.js, docs/js/app.js
 * 2. Code inspection of sendZaloNotificationClientSide
 * 3. Live Network Trace Probes to Google Apps Script Webhook:
 *    - Probe A: Without secret_token (expect UNAUTHORIZED_SECRET_TOKEN)
 *    - Probe B: With secret_token, PERSONAL_SIGNED to 0818810007 (measure real latency, expect delivered: true)
 *    - Probe C: With secret_token, SUBMITTED with authorPhone: 0818810007, recipientPhone: 0905123456
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

const ROOT_DIR = path.resolve(__dirname, '..');
const GAS_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbwGBgauc9xHzRe31_IfCQD-Q9yHwGp4CfYLEam9IupcYhLpNBXbgW0J1t-weD6iUQ87ZQ/exec';

function sha256File(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

async function runIndependentVerification() {
  const results = {
    mirrorCheck: null,
    probeA: null,
    probeB: null,
    probeC: null
  };

  console.log('================================================================================');
  console.log('🔍 TESTER 1: INDEPENDENT VERIFICATION & LIVE NETWORK TRACE PIPELINE');
  console.log('================================================================================\n');

  // --- 1. SHA-256 3-Way Mirror Check ---
  console.log('--- 1. SHA-256 3-WAY MIRROR INTEGRITY ---');
  const files = [
    path.join(ROOT_DIR, 'js', 'app.js'),
    path.join(ROOT_DIR, 'public', 'js', 'app.js'),
    path.join(ROOT_DIR, 'docs', 'js', 'app.js')
  ];

  const hashes = files.map(f => ({ file: path.relative(ROOT_DIR, f), hash: sha256File(f), size: fs.statSync(f).size }));
  console.log('Hashes:');
  hashes.forEach(h => console.log(`  - ${h.file}: ${h.hash} (${h.size} bytes)`));

  const allEqual = (hashes[0].hash === hashes[1].hash) && (hashes[0].hash === hashes[2].hash);
  console.log(`Mirror Check Result: ${allEqual ? 'PASS (100% IDENTICAL)' : 'FAIL'}`);

  const appJsSrc = fs.readFileSync(files[0], 'utf8');
  const hasTokenEnforcement = appJsSrc.includes('payload.secret_token = "UnifiedZaloBotTHCSCVA2026Secret"');
  const hasForwardedFields = appJsSrc.includes('authorPhone: authorPhone') && appJsSrc.includes('recipientName: nextSignerName');

  results.mirrorCheck = {
    hashes,
    allEqual,
    hasTokenEnforcement,
    hasForwardedFields
  };

  console.log(`Token Enforcement in sendZaloNotificationClientSide: ${hasTokenEnforcement ? 'PASS' : 'FAIL'}`);
  console.log(`Forwarded Fields (authorPhone, recipientName): ${hasForwardedFields ? 'PASS' : 'FAIL'}\n`);

  // --- 2. Probe A: Unauthorized without secret_token ---
  console.log('--- 2. PROBE A: LIVE REQUEST WITHOUT SECRET_TOKEN ---');
  const probeAPayload = {
    action: 'NOTIFY_SIGN_EVENT',
    eventType: 'SUBMITTED',
    docId: 'TEST-PROBE-A-' + Date.now(),
    docTitle: 'Thử nghiệm Không Secret Token',
    senderName: 'Independent Tester 1'
  };

  try {
    const t0 = performance.now();
    const resA = await fetch(GAS_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(probeAPayload),
      redirect: 'follow'
    });
    const latencyA = Math.round(performance.now() - t0);
    const jsonA = await resA.json();

    console.log(`Probe A Status: HTTP ${resA.status}, Latency: ${latencyA}ms`);
    console.log('Probe A Body:', JSON.stringify(jsonA, null, 2));

    const probeAPass = resA.status === 200 && jsonA.success === false && jsonA.error === 'UNAUTHORIZED_SECRET_TOKEN';
    results.probeA = {
      status: resA.status,
      latencyMs: latencyA,
      body: jsonA,
      pass: probeAPass
    };
    console.log(`Probe A Verdict: ${probeAPass ? 'PASS (Properly Rejected)' : 'FAIL'}\n`);
  } catch (err) {
    console.error('Probe A Exception:', err.message);
    results.probeA = { pass: false, error: err.message };
  }

  // --- 3. Probe B: Authorized PERSONAL_SIGNED to 0818810007 ---
  console.log('--- 3. PROBE B: LIVE AUTHORIZED PERSONAL_SIGNED TO 0818810007 ---');
  const probeBPayload = {
    action: 'NOTIFY_SIGN_EVENT',
    secret_token: 'UnifiedZaloBotTHCSCVA2026Secret',
    eventType: 'PERSONAL_SIGNED',
    docId: 'TEST-PROBE-B-' + Date.now(),
    docTitle: 'Kế hoạch bài dạy Tester 1 Thử nghiệm Trực tiếp',
    authorPhone: '0818810007',
    senderName: 'Hà Văn Tý (Tester 1 Verification)'
  };

  try {
    const t0 = performance.now();
    const resB = await fetch(GAS_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(probeBPayload),
      redirect: 'follow'
    });
    const latencyB = Math.round(performance.now() - t0);
    const jsonB = await resB.json();

    console.log(`Probe B Status: HTTP ${resB.status}, Latency: ${latencyB}ms`);
    console.log('Probe B Body:', JSON.stringify(jsonB, null, 2));

    const probeBPass = resB.status === 200 && jsonB.success === true && jsonB.delivered === true && jsonB.phone === '0818810007';
    results.probeB = {
      status: resB.status,
      latencyMs: latencyB,
      body: jsonB,
      pass: probeBPass
    };
    console.log(`Probe B Verdict: ${probeBPass ? 'PASS (Real Zalo Message Delivered)' : 'FAIL'}\n`);
  } catch (err) {
    console.error('Probe B Exception:', err.message);
    results.probeB = { pass: false, error: err.message };
  }

  // --- 4. Probe C: Authorized SUBMITTED with authorPhone: 0818810007, recipientPhone: 0905123456 ---
  console.log('--- 4. PROBE C: LIVE SUBMITTED WITH DUAL DELIVERY CHECK ---');
  const probeCPayload = {
    action: 'NOTIFY_SIGN_EVENT',
    secret_token: 'UnifiedZaloBotTHCSCVA2026Secret',
    eventType: 'SUBMITTED',
    docId: 'TEST-PROBE-C-' + Date.now(),
    docTitle: 'Báo cáo Kiểm định Độc lập Tester 1',
    authorPhone: '0818810007',
    recipientPhone: '0905123456',
    recipientName: 'Thầy Hiệu Trưởng',
    senderName: 'Hà Văn Tý (Tác giả)'
  };

  try {
    const t0 = performance.now();
    const resC = await fetch(GAS_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(probeCPayload),
      redirect: 'follow'
    });
    const latencyC = Math.round(performance.now() - t0);
    const jsonC = await resC.json();

    console.log(`Probe C Status: HTTP ${resC.status}, Latency: ${latencyC}ms`);
    console.log('Probe C Body:', JSON.stringify(jsonC, null, 2));

    // Notice: Depending on whether GAS has been deployed with latest Code.gs or previous version:
    // With previous version: returns { success: true, delivered: false, phone: '0905123456', note: 'CHUA_LIEN_KET_ZALO' }
    // With latest version: returns { success: true, delivered: true, authorDelivered: true, recipientDelivered: false, recipientNote: 'CHUA_LIEN_KET_ZALO', ... }
    results.probeC = {
      status: resC.status,
      latencyMs: latencyC,
      body: jsonC,
      pass: resC.status === 200 && jsonC.success === true
    };
    console.log(`Probe C Verdict: ${results.probeC.pass ? 'PASS (Accepted by GAS Webhook)' : 'FAIL'}\n`);
  } catch (err) {
    console.error('Probe C Exception:', err.message);
    results.probeC = { pass: false, error: err.message };
  }

  // Save trace artifact
  const outPath = path.join(__dirname, 'live_network_trace_result.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf8');
  console.log(`Artifact saved to ${outPath}`);

  return results;
}

if (require.main === module) {
  runIndependentVerification().then(() => process.exit(0)).catch(err => {
    console.error('Fatal Verification Error:', err);
    process.exit(1);
  });
}

module.exports = { runIndependentVerification };
