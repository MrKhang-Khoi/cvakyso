// tests/test_challenger_adversarial_suite.js
// Independent Adversarial Challenge Suite by Challenger 1
const assert = require('assert');
const fs = require('fs');

console.log('================================================================================');
console.log('⚔️ CHALLENGER 1: ADVERSARIAL STRESS TEST & EDGE-CASE ORACLE HARNESS');
console.log('Timestamp:', new Date().toISOString());
console.log('================================================================================\n');

// -----------------------------------------------------------------------------
// 1. Client-side Stress Testing: sendZaloNotificationClientSide resilience
// -----------------------------------------------------------------------------
console.log('>>> [SECTION 1] Stress-testing sendZaloNotificationClientSide behavior...');

// Load client side function from js/app.js in isolated scope
const appJsContent = fs.readFileSync('js/app.js', 'utf8');

// Extract sendZaloNotificationClientSide function implementation
const fnMatch = appJsContent.match(/async function sendZaloNotificationClientSide\(payload\)[\s\S]*?\n\}/);
if (!fnMatch) {
  throw new Error('sendZaloNotificationClientSide function not found in js/app.js');
}

let lastFetchCall = null;
let fetchShouldReject = false;

// Mock fetch environment
global.DEFAULT_GAS_URL = "https://script.google.com/macros/s/AKfycbwGBgauc9xHzRe31_IfCQD-Q9yHwGp4CfYLEam9IupcYhLpNBXbgW0J1t-weD6iUQ87ZQ/exec";
global.fetch = async (url, opts) => {
  lastFetchCall = { url, opts };
  if (fetchShouldReject) {
    throw new Error('SIMULATED_NETWORK_FAILURE_OR_TIMEOUT');
  }
  return { ok: true };
};

// Evaluate the extracted function in global context
const sendZaloNotificationClientSide = new Function(
  'return ' + fnMatch[0]
)();

async function runClientTests() {
  // Test 1.1: Standard payload
  lastFetchCall = null;
  fetchShouldReject = false;
  await sendZaloNotificationClientSide({ eventType: 'SUBMITTED', docTitle: 'Test Standard' });
  assert.ok(lastFetchCall, 'fetch must be called');
  const body1 = JSON.parse(lastFetchCall.opts.body);
  assert.strictEqual(body1.secret_token, 'UnifiedZaloBotTHCSCVA2026Secret', 'secret_token must be injected');
  console.log('  ✅ [PASS] Test 1.1: Standard payload auto-injects secret_token.');

  // Test 1.2: Payload already with secret_token
  lastFetchCall = null;
  await sendZaloNotificationClientSide({ eventType: 'SUBMITTED', secret_token: 'CustomSecret' });
  const body2 = JSON.parse(lastFetchCall.opts.body);
  assert.strictEqual(body2.secret_token, 'CustomSecret', 'Existing secret_token must not be overwritten');
  console.log('  ✅ [PASS] Test 1.2: Custom secret_token is preserved.');

  // Test 1.3: Null payload
  lastFetchCall = null;
  await sendZaloNotificationClientSide(null);
  assert.ok(lastFetchCall, 'fetch must be called even for null payload');
  const body3 = JSON.parse(lastFetchCall.opts.body);
  assert.strictEqual(body3.secret_token, 'UnifiedZaloBotTHCSCVA2026Secret', 'secret_token injected for null payload');
  console.log('  ✅ [PASS] Test 1.3: null payload handled gracefully without crash.');

  // Test 1.4: Undefined payload
  lastFetchCall = null;
  await sendZaloNotificationClientSide(undefined);
  assert.ok(lastFetchCall, 'fetch must be called even for undefined payload');
  const body4 = JSON.parse(lastFetchCall.opts.body);
  assert.strictEqual(body4.secret_token, 'UnifiedZaloBotTHCSCVA2026Secret');
  console.log('  ✅ [PASS] Test 1.4: undefined payload handled gracefully without crash.');

  // Test 1.5: Network failure simulation (fetch throws error)
  fetchShouldReject = true;
  try {
    await sendZaloNotificationClientSide({ eventType: 'SUBMITTED' });
    console.log('  ✅ [PASS] Test 1.5: Network error cleanly caught inside function (zero unhandled promise rejection).');
  } catch (err) {
    assert.fail('sendZaloNotificationClientSide must NOT leak unhandled network error: ' + err.message);
  }

  // Test 1.6: Frozen object payload
  fetchShouldReject = false;
  lastFetchCall = null;
  const frozen = Object.freeze({ eventType: 'FROZEN_TEST' });
  try {
    await sendZaloNotificationClientSide(frozen);
    console.log('  ✅ [PASS] Test 1.6: Frozen object handled safely without uncaught fatal crash.');
  } catch (err) {
    assert.fail('Frozen object should be handled gracefully: ' + err.message);
  }
}

// -----------------------------------------------------------------------------
// 2. Google Apps Script Logic Stress-Testing: handleEduSignNotification
// -----------------------------------------------------------------------------
console.log('\n>>> [SECTION 2] Stress-testing handleEduSignNotification GAS logic...');

// Extract normalizePhone and handleEduSignNotification logic from google-apps-script-zalo-edusign.js
const gasContent = fs.readFileSync('google-apps-script-zalo-edusign.js', 'utf8');

// Mock GAS environment
const linkedPhones = new Map([
  ['0818810007', 'chat_id_ty'],
  ['0978760924', 'chat_id_thuy'],
  ['0905111222', 'chat_id_bgh']
]);

const sentBotReplies = [];
const mockGasEnv = {
  normalizePhone: function(phone) {
    if (!phone) return "";
    var clean = String(phone).replace(/\D/g, "");
    if (clean.indexOf("840") === 0 && clean.length >= 11) clean = clean.substring(2);
    else if (clean.indexOf("84") === 0 && clean.length >= 10) clean = "0" + clean.substring(2);
    if (clean.length === 9 && clean.indexOf("0") !== 0) clean = "0" + clean;
    if (clean.length === 10 && clean.indexOf("0") !== 0 && clean.indexOf("2") === 0) clean = "0" + clean;
    return clean;
  },
  getChatIdByPhone: function(phone) {
    return linkedPhones.get(phone) || null;
  },
  sendZaloBotReply: function(chatId, msg) {
    sentBotReplies.push({ chatId, msg });
    return { success: true, messageId: 'msg_' + Date.now() };
  },
  CONFIG: {
    PORTAL_URL: 'https://mrkhang-khoi.github.io/cvakyso/portal-baocao.html'
  },
  Logger: {
    log: function() {}
  }
};

// Build sandbox evaluation for handleEduSignNotification
const handleEduSignNotificationCode = gasContent.substring(
  gasContent.indexOf('function handleEduSignNotification(data)'),
  gasContent.indexOf('function handleSyncTeacher(postData)')
);

const handleEduSignNotification = new Function(
  'data',
  'normalizePhone',
  'getChatIdByPhone',
  'sendZaloBotReply',
  'CONFIG',
  'Logger',
  handleEduSignNotificationCode + '\nreturn handleEduSignNotification(data);'
);

function callHandleEduSign(data) {
  return handleEduSignNotification(
    data,
    mockGasEnv.normalizePhone,
    mockGasEnv.getChatIdByPhone,
    mockGasEnv.sendZaloBotReply,
    mockGasEnv.CONFIG,
    mockGasEnv.Logger
  );
}

function runGasLogicTests() {
  // Test 2.1: SUBMITTED - Both Author and Recipient are Linked
  sentBotReplies.length = 0;
  const res21 = callHandleEduSign({
    eventType: 'SUBMITTED',
    docId: 'BC-2026-001',
    docTitle: 'Báo cáo Kiểm tra Chất lượng HK1',
    authorPhone: '0818810007',
    recipientPhone: '0978760924',
    recipientName: 'Cô Phương Thúy',
    senderName: 'Thầy Hà Văn Tý'
  });
  assert.strictEqual(res21.success, true);
  assert.strictEqual(res21.delivered, true);
  assert.strictEqual(res21.authorDelivered, true);
  assert.strictEqual(res21.recipientDelivered, true);
  assert.strictEqual(sentBotReplies.length, 2, '2 messages must be dispatched');
  assert.ok(sentBotReplies[0].msg.includes('XÁC NHẬN: KHỞI TẠO BÁO CÁO'), 'Author confirmation title');
  assert.ok(sentBotReplies[1].msg.includes('THÔNG BÁO: CÓ HỒ SƠ MỚI CẦN KÝ DUYỆT'), 'Approver invitation title');
  console.log('  ✅ [PASS] Test 2.1: SUBMITTED with both linked parties delivers 2 messages.');

  // Test 2.2: SUBMITTED - Author linked, Recipient UNLINKED (Graceful fallback)
  sentBotReplies.length = 0;
  const res22 = callHandleEduSign({
    eventType: 'SUBMITTED',
    docId: 'BC-2026-002',
    docTitle: 'Kế hoạch Tuần 3',
    authorPhone: '0818810007',
    recipientPhone: '0905123456', // unlinked
    recipientName: 'Thầy Nam',
    senderName: 'Thầy Hà Văn Tý'
  });
  assert.strictEqual(res22.success, true);
  assert.strictEqual(res22.delivered, true, 'Overall delivered should be true because author received notification');
  assert.strictEqual(res22.authorDelivered, true);
  assert.strictEqual(res22.recipientDelivered, false);
  assert.strictEqual(res22.recipientNote, 'CHUA_LIEN_KET_ZALO');
  assert.strictEqual(sentBotReplies.length, 1, 'Author message dispatched despite unlinked recipient');
  console.log('  ✅ [PASS] Test 2.2: SUBMITTED with unlinked recipient gracefully delivers to author without failure.');

  // Test 2.3: SUBMITTED - Author UNLINKED, Recipient Linked
  sentBotReplies.length = 0;
  const res23 = callHandleEduSign({
    eventType: 'SUBMITTED',
    docId: 'BC-2026-003',
    docTitle: 'Kế hoạch Phụ đạo',
    authorPhone: '0988000111', // unlinked
    recipientPhone: '0905111222', // linked BGH
    recipientName: 'Hiệu trưởng',
    senderName: 'Giáo viên Mới'
  });
  assert.strictEqual(res23.success, true);
  assert.strictEqual(res23.delivered, true);
  assert.strictEqual(res23.authorDelivered, false);
  assert.strictEqual(res23.recipientDelivered, true);
  assert.strictEqual(res23.authorNote, 'CHUA_LIEN_KET_ZALO');
  assert.strictEqual(sentBotReplies.length, 1);
  console.log('  ✅ [PASS] Test 2.3: SUBMITTED with unlinked author delivers to linked recipient.');

  // Test 2.4: SUBMITTED - Both UNLINKED
  sentBotReplies.length = 0;
  const res24 = callHandleEduSign({
    eventType: 'SUBMITTED',
    docId: 'BC-2026-004',
    authorPhone: '0999000111',
    recipientPhone: '0999000222'
  });
  assert.strictEqual(res24.success, true);
  assert.strictEqual(res24.delivered, false);
  assert.strictEqual(res24.authorDelivered, false);
  assert.strictEqual(res24.recipientDelivered, false);
  assert.strictEqual(res24.note, 'CHUA_LIEN_KET_ZALO');
  assert.strictEqual(sentBotReplies.length, 0);
  console.log('  ✅ [PASS] Test 2.4: SUBMITTED with both unlinked returns clean delivered:false without crash.');

  // Test 2.5: SUBMITTED - Missing authorPhone and recipientPhone entirely
  sentBotReplies.length = 0;
  const res25 = callHandleEduSign({
    eventType: 'SUBMITTED',
    docId: 'BC-2026-005'
  });
  assert.strictEqual(res25.success, true);
  assert.strictEqual(res25.delivered, false);
  assert.strictEqual(res25.authorNote, 'NO_AUTHOR_PHONE');
  assert.strictEqual(res25.recipientNote, 'NO_RECIPIENT_PHONE');
  console.log('  ✅ [PASS] Test 2.5: SUBMITTED with missing phone properties returns clean notes.');

  // Test 2.6: FORWARDED - Both linked
  sentBotReplies.length = 0;
  const res26 = callHandleEduSign({
    eventType: 'FORWARDED',
    docId: 'BC-2026-006',
    authorPhone: '0818810007',
    recipientPhone: '0905111222',
    recipientName: 'Hiệu trưởng',
    senderName: 'Tổ trưởng Tý'
  });
  assert.strictEqual(res26.success, true);
  assert.strictEqual(res26.delivered, true);
  assert.strictEqual(res26.authorDelivered, true);
  assert.strictEqual(res26.recipientDelivered, true);
  assert.strictEqual(sentBotReplies.length, 2);
  assert.ok(sentBotReplies[0].msg.includes('XÁC NHẬN: CHUYỂN TIẾP HỒ SƠ THÀNH CÔNG'));
  assert.ok(sentBotReplies[1].msg.includes('THÔNG BÁO: HỒ SƠ CHUYỂN TIẾP CẦN KÝ DUYỆT'));
  console.log('  ✅ [PASS] Test 2.6: FORWARDED sends dual notifications to forwarder and next signer.');

  // Test 2.7: Adversarial Payload - Giant 10,000 char docTitle
  sentBotReplies.length = 0;
  const giantTitle = 'A'.repeat(10000);
  const res27 = callHandleEduSign({
    eventType: 'SUBMITTED',
    docId: 'GIANT-001',
    docTitle: giantTitle,
    authorPhone: '0818810007'
  });
  assert.strictEqual(res27.success, true);
  assert.strictEqual(res27.authorDelivered, true);
  assert.ok(sentBotReplies[0].msg.length > 10000, 'Payload accommodates large title without buffer overflow');
  console.log('  ✅ [PASS] Test 2.7: Giant 10,000 character docTitle processed safely.');

  // Test 2.8: Unknown / Malicious eventType
  sentBotReplies.length = 0;
  const res28 = callHandleEduSign({
    eventType: 'UNKNOWN_INJECTION_TYPE',
    docId: 'EXPLOIT-001',
    authorPhone: '0818810007'
  });
  assert.strictEqual(res28.success, false);
  assert.strictEqual(res28.reason, 'INVALID_EVENT');
  assert.strictEqual(sentBotReplies.length, 0);
  console.log('  ✅ [PASS] Test 2.8: Unknown/unsupported eventType safely rejected with INVALID_EVENT.');
}

(async () => {
  await runClientTests();
  runGasLogicTests();
  console.log('\n================================================================================');
  console.log('🎉 ALL 14 ADVERSARIAL CHALLENGER STRESS TESTS PASSED WITH ZERO CRASHES!');
  console.log('================================================================================');
})();
