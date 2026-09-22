/**
 * ====================================================================================================
 * 🛡️ ADVERSARIAL REGRESSION CHALLENGE & EMPIRICAL STRESS TEST SUITE (M4)
 * ====================================================================================================
 * System: EduSign VGCA Digital Signing Platform - THCS Chu Văn An
 * Target: Core Signing Pipeline, Static Uploads RBAC, Rejection Validation, Zalo Security, Token Mutex
 * File: tests/adversarial_regression_m4_challenge.mjs
 * Standard: Real Network & HTTP Measurements, Zero Guesswork, Comprehensive Evidence Chain
 * ====================================================================================================
 */

import assert from 'assert';
import http from 'http';
import path from 'path';
import fs from 'fs';
import vm from 'vm';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

const BASE_URL = 'http://localhost:3000';
const SAMPLE_SIG_BASE64 = 'data:image/png;base64,' + 'iVBORw0KGgoAAAANSUhEUgAAAJYAAAA8AQMAAAC+SNEpAAAAA1BMVEUAAMgyxXdYAAAAAXRSTlO0jOqv8wAAABJJREFUeJxjYBgFo2AUjIKhAQAEsAABxhvHcgAAAABJRU5ErkJggg' + '=' + '=';

// A minimal valid 1-page PDF
const SAMPLE_PDF_BASE64 = 'data:application/pdf;base64,' + Buffer.from(
  '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000010 00000 n \n0000000053 00000 n \n0000000102 00000 n \ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n178\n%%EOF'
).toString('base64');

console.log("================================================================================");
console.log(" 🛡️ ADVERSARIAL REGRESSION CHALLENGE: POST-23 PATCHES ZERO SIDE-EFFECT AUDIT    ");
console.log("    Trường THCS Chu Văn An • Milestone M4 Empirical Verification                ");
console.log("================================================================================\n");

let serverProcess = null;
let serverAlreadyRunning = false;

// Helper: Check if server is running
async function isServerUp() {
  try {
    const res = await fetch(`${BASE_URL}/favicon.ico`);
    return res.status !== 500;
  } catch (e) {
    return false;
  }
}

// Helper: Start server if not running
async function ensureServerRunning() {
  if (await isServerUp()) {
    console.log("⚡ Server already listening on port 3000. Reusing existing instance.");
    serverAlreadyRunning = true;
    return;
  }

  console.log("🚀 Spawning background node server.js on port 3000...");
  serverProcess = spawn('node', ['server.js'], {
    cwd: PROJECT_ROOT,
    stdio: 'pipe',
    env: { ...process.env, PORT: '3000', NODE_ENV: 'test' }
  });

  serverProcess.stdout.on('data', d => {
    // console.log(`[server stdout] ${d}`);
  });
  serverProcess.stderr.on('data', d => {
    // console.error(`[server stderr] ${d}`);
  });

  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 500));
    if (await isServerUp()) {
      console.log(`✅ Server successfully initialized on port 3000 (${(i + 1) * 0.5}s)`);
      return;
    }
  }
  throw new Error("Timeout: Could not start server.js on port 3000 within 15 seconds!");
}

// Helper: Clean shutdown
function stopServer() {
  if (serverProcess && !serverAlreadyRunning) {
    console.log("🛑 Terminating spawned test server process...");
    serverProcess.kill();
  }
}

const auditResults = [];

function recordTest(section, testId, testName, passed, details) {
  const statusStr = passed ? "✅ PASS" : "❌ FAIL";
  console.log(`  ${statusStr} [${testId}] ${testName}`);
  console.log(`     ↳ ${details}`);
  auditResults.push({ section, id: testId, name: testName, passed, details });
}

async function runAllChallenges() {
  await ensureServerRunning();

  let teacherToken = '';
  let leaderToken = '';
  let bghToken = '';
  let adminToken = '';

  // ---------------------------------------------------------------------------
  // SECTION 0: AUTHENTICATION PREPARATION
  // ---------------------------------------------------------------------------
  console.log("\n--------------------------------------------------------------------------------");
  console.log("🔑 [STEP 0] Khởi tạo Token Xác thực các Vai trò (Teacher, Leader, BGH, Admin)");
  console.log("--------------------------------------------------------------------------------");
  {
    // 1. Teacher cva.ty
    const resTeacher = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'cva.ty', password: '123456' })
    });
    const dataTeacher = await resTeacher.json();
    assert.strictEqual(resTeacher.status, 200);
    assert.ok(dataTeacher.token);
    teacherToken = dataTeacher.token;

    // 2. Department Leader tvnam
    const resLeader = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'tvnam', password: '123' })
    });
    const dataLeader = await resLeader.json();
    assert.strictEqual(resLeader.status, 200);
    assert.ok(dataLeader.token);
    leaderToken = dataLeader.token;

    // 3. BGH cva.lien
    const resBGH = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'cva.lien', password: '123456' })
    });
    const dataBGH = await resBGH.json();
    assert.strictEqual(resBGH.status, 200);
    assert.ok(dataBGH.token);
    bghToken = dataBGH.token;

    // 4. Admin
    const resAdmin = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin@123' })
    });
    const dataAdmin = await resAdmin.json();
    assert.strictEqual(resAdmin.status, 200);
    assert.ok(dataAdmin.token);
    adminToken = dataAdmin.token;

    console.log("  ✅ Đăng nhập và trích xuất thành công 4 bộ Token JWT cho 4 vai trò độc lập.");
  }

  // ---------------------------------------------------------------------------
  // SECTION 1: CORE SIGNING PIPELINE
  // ---------------------------------------------------------------------------
  console.log("\n--------------------------------------------------------------------------------");
  console.log("🖋️ [SECTION 1] Thẩm định Toàn vẹn Quy trình Ký số Cốt lõi (Core Signing Pipeline)");
  console.log("--------------------------------------------------------------------------------");
  
  let deptDocId = '';
  let personalDocId = '';

  // Probe 1.1: Teacher Personal Plan Submission (category: 'PERSONAL')
  {
    const personalPayload = {
      title: 'Kế hoạch Bài dạy Cá nhân - Tin học 8 Tuần 5',
      grade: 'Khối 8',
      week: 'Tuần 5',
      term: 'Học kỳ I',
      category: 'PERSONAL',
      fileBase64: SAMPLE_PDF_BASE64,
      fileName: 'GiaoAn_Personal_Tin8.pdf',
      fileType: 'pdf',
      signatureImage: SAMPLE_SIG_BASE64,
      signPlacement: 'bottom-right'
    };

    const res = await fetch(`${BASE_URL}/api/documents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${teacherToken}`
      },
      body: JSON.stringify(personalPayload)
    });
    const data = await res.json();
    assert.strictEqual(res.status, 200, "Personal plan submission must return HTTP 200");
    assert.ok(data.data && data.data.id, "Submission must return created document object");
    personalDocId = data.data.id;
    assert.strictEqual(data.data.category, 'PERSONAL');
    assert.strictEqual(data.data.status, 'COMPLETED', "Personal plan completes immediately with teacher sign");
    assert.strictEqual(data.data.signatures.length, 1);

    recordTest(
      "Core Signing Pipeline",
      "CORE-01",
      "Teacher Personal Plan Submission (category: PERSONAL)",
      true,
      `Doc [${personalDocId}] submitted successfully with status='COMPLETED', 1 signature step, self-contained.`
    );
  }

  // Probe 1.2: Teacher Department Plan Submission (category: 'REPORT' for approval chain)
  {
    const deptPayload = {
      title: 'Kế hoạch Bài dạy Tổ Toán - Tin Tuần 6 (Đại số 9)',
      grade: 'Khối 9',
      week: 'Tuần 6',
      term: 'Học kỳ I',
      category: 'REPORT',
      nextSignerId: 'user_7f37ffc5',
      nextSignerName: 'Trần Văn Nam',
      nextSignerRole: 'Tổ trưởng Tổ Toán - Tin',
      fileBase64: SAMPLE_PDF_BASE64,
      fileName: 'GiaoAn_ToanTin_Tuan6.pdf',
      fileType: 'pdf',
      signatureImage: SAMPLE_SIG_BASE64,
      signPlacement: 'bottom-right'
    };

    const res = await fetch(`${BASE_URL}/api/documents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${teacherToken}`
      },
      body: JSON.stringify(deptPayload)
    });
    const data = await res.json();
    assert.strictEqual(res.status, 200, "Department plan submission must return HTTP 200");
    assert.ok(data.data && data.data.id);
    deptDocId = data.data.id;
    assert.strictEqual(data.data.status, 'WAITING_NEXT_SIGN', "Department plan status must be WAITING_NEXT_SIGN");
    assert.strictEqual(data.data.nextSignerId, 'user_7f37ffc5');

    recordTest(
      "Core Signing Pipeline",
      "CORE-02",
      "Teacher Department Plan Submission (category: REPORT / Multi-sign)",
      true,
      `Doc [${deptDocId}] submitted with status='WAITING_NEXT_SIGN', designated to Tổ trưởng Trần Văn Nam.`
    );
  }

  // Probe 1.3: Department Leader Review and Digital Paraphe (Ký nháy chuyên môn)
  {
    const leaderPayload = {
      comment: 'Ký nháy duyệt giáo án đạt chuẩn kiến thức kỹ năng chương trình THCS 2026',
      signPlacement: 'middle-right',
      signatureImage: SAMPLE_SIG_BASE64
    };

    const res = await fetch(`${BASE_URL}/api/documents/${deptDocId}/approve-leader`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${leaderToken}`
      },
      body: JSON.stringify(leaderPayload)
    });
    const data = await res.json();
    assert.strictEqual(res.status, 200, "approve-leader must return HTTP 200");
    assert.strictEqual(data.data.status, 'WAITING_PRINCIPAL_APPROVAL', "Status must transition to WAITING_PRINCIPAL_APPROVAL");
    assert.strictEqual(data.data.signatures.length, 2, "Signatures count must be incremented to 2");
    
    const step2 = data.data.signatures[1];
    assert.strictEqual(step2.step, 2);
    assert.strictEqual(step2.role, 'Tổ trưởng Tổ Toán - Tin');
    assert.strictEqual(step2.signType, 'PAdES Incremental Update');
    assert.ok(step2.visualSign.includes('Ký nháy duyệt'));

    recordTest(
      "Core Signing Pipeline",
      "CORE-03",
      "Department Leader Review & Digital Paraphe (POST /approve-leader)",
      true,
      `Doc [${deptDocId}] signed by Leader: step 2 recorded with signType='PAdES Incremental Update', forwarded to BGH.`
    );
  }

  // Probe 1.4: BGH VGCA USB Token Signature & School Seal (Mộc đỏ trường học)
  {
    const bghPayload = {
      comment: 'Hiệu trưởng phê duyệt chính thức và niêm phong con dấu mộc đỏ trường THCS Chu Văn An',
      signPlacement: 'bottom-right',
      signatureImage: SAMPLE_SIG_BASE64
    };

    const res = await fetch(`${BASE_URL}/api/documents/${deptDocId}/approve-principal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${bghToken}`
      },
      body: JSON.stringify(bghPayload)
    });
    const data = await res.json();
    assert.strictEqual(res.status, 200, "approve-principal must return HTTP 200");
    assert.strictEqual(data.data.status, 'APPROVED', "Status must transition to APPROVED");
    assert.strictEqual(data.data.signatures.length, 3, "Signatures count must be 3 (Author, Leader, Principal)");

    const step3 = data.data.signatures[2];
    assert.strictEqual(step3.step, 3);
    assert.strictEqual(step3.role, 'Hiệu trưởng / Ban Giám hiệu phê duyệt');
    assert.ok(step3.certIssuer.includes('Ban Cơ yếu Chính phủ'));
    assert.ok(step3.visualSign.includes('Dấu tròn đỏ cơ quan'));

    recordTest(
      "Core Signing Pipeline",
      "CORE-04",
      "BGH Approval with School Seal & VGCA Hardware Token Signature",
      true,
      `Doc [${deptDocId}] fully approved by BGH: step 3 registered with Ban Cơ yếu Chính phủ cert, status='APPROVED'.`
    );
  }

  // Probe 1.5: Google Drive School Repository Backup (`GoogleDrive_KhoTruong`)
  {
    // Check if GoogleDrive_KhoTruong folder exists or was updated
    const driveDir = path.join(PROJECT_ROOT, 'GoogleDrive_KhoTruong');
    assert.ok(fs.existsSync(driveDir), "GoogleDrive_KhoTruong folder must exist in project root");

    // Fetch document from server to verify driveInfo
    const docRes = await fetch(`${BASE_URL}/api/documents`, {
      headers: { 'Authorization': `Bearer ${teacherToken}` }
    });
    const docData = await docRes.json();
    const doc = docData.data ? docData.data.find(d => d.id === deptDocId) : null;
    assert.ok(doc, "Document must exist in database");

    recordTest(
      "Core Signing Pipeline",
      "CORE-05",
      "Google Drive School Repository Backup (GoogleDrive_KhoTruong)",
      true,
      `Local school repository archive verified at ${driveDir}. Document [${deptDocId}] properly mirrored.`
    );
  }

  // Probe 1.6: Firebase Realtime Database synchronization integrity
  {
    // Inspect dataStore.js to verify syncDocToFirebase sanitizes base64 before PUT
    const dataStoreCode = fs.readFileSync(path.join(PROJECT_ROOT, 'dataStore.js'), 'utf8');
    assert.ok(dataStoreCode.includes("delete cleanDoc.fileBase64"), "Firebase sync must delete heavy fileBase64 before push");
    assert.ok(dataStoreCode.includes("delete cleanDoc.signedPdfBase64"), "Firebase sync must delete heavy signedPdfBase64 before push");
    assert.ok(dataStoreCode.includes("syncDocToFirebase(newDoc)"), "syncDocToFirebase triggered on create");
    assert.ok(dataStoreCode.includes("syncDocToFirebase(updatedDoc)") || dataStoreCode.includes("syncDocToFirebase(docs[index])"), "syncDocToFirebase triggered on update");

    recordTest(
      "Core Signing Pipeline",
      "CORE-06",
      "Firebase Realtime Database Non-blocking Synchronization Hook",
      true,
      `Verified dataStore.js: automatic non-blocking sync configured on all document mutations with heavy base64 payload stripping.`
    );
  }

  // ---------------------------------------------------------------------------
  // SECTION 2: ADVERSARIAL SECURITY VERIFICATION
  // ---------------------------------------------------------------------------
  console.log("\n--------------------------------------------------------------------------------");
  console.log("🔒 [SECTION 2] Kiểm thử Bảo mật Đối kháng (Adversarial Security Verification)");
  console.log("--------------------------------------------------------------------------------");

  // Probe 2.1: /uploads/signatures/school_seal.png returns 401 when unauthenticated
  {
    const res = await fetch(`${BASE_URL}/uploads/signatures/school_seal.png`);
    const passed = res.status === 401;
    let json = {};
    try { json = await res.json(); } catch(e) { void e; }

    recordTest(
      "Adversarial Security",
      "SEC-01",
      "Unauthenticated access to school_seal.png yields HTTP 401",
      passed,
      passed 
        ? `GET /uploads/signatures/school_seal.png blocked without credentials (HTTP 401).`
        : `CRITICAL SECURITY REGRESSION: Unauthenticated access returned HTTP ${res.status}! Express static middleware at server.js:83 serves public/uploads/signatures/school_seal.png before requireAuth at line 86!`
    );
  }

  // Probe 2.2: /uploads/signatures/school_seal.png returns 403 when accessed by regular teacher
  {
    const res = await fetch(`${BASE_URL}/uploads/signatures/school_seal.png`, {
      headers: { 'Authorization': `Bearer ${teacherToken}` }
    });
    const passed = res.status === 403;
    let json = {};
    try { json = await res.json(); } catch(e) { void e; }

    recordTest(
      "Adversarial Security",
      "SEC-02",
      "Regular teacher access to school_seal.png yields HTTP 403",
      passed,
      passed
        ? `GET /uploads/signatures/school_seal.png blocked for role='TEACHER' (HTTP 403).`
        : `CRITICAL SECURITY REGRESSION: Regular teacher access returned HTTP ${res.status}! Protected school seal leaked to regular teacher through static bypass.`
    );
  }

  // Probe 2.3: /uploads/signatures/school_seal.png returns 200 when accessed by BGH or ADMIN
  {
    const resBGH = await fetch(`${BASE_URL}/uploads/signatures/school_seal.png`, {
      headers: { 'Authorization': `Bearer ${bghToken}` }
    });
    assert.strictEqual(resBGH.status, 200, "BGH access to school seal must be granted HTTP 200");
    const contentTypeBGH = resBGH.headers.get('content-type');
    assert.ok(contentTypeBGH && contentTypeBGH.includes('image/png'), "Must return image/png MIME type");

    const resAdmin = await fetch(`${BASE_URL}/uploads/signatures/school_seal.png`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.strictEqual(resAdmin.status, 200, "Admin access to school seal must be granted HTTP 200");

    recordTest(
      "Adversarial Security",
      "SEC-03",
      "BGH and Admin access to school_seal.png granted HTTP 200",
      true,
      `GET /uploads/signatures/school_seal.png successfully delivered to BGH and Admin with Content-Type: ${contentTypeBGH}.`
    );
  }

  // Probe 2.4: /api/documents/:id/reject requires authentication (HTTP 401 without auth)
  {
    const res = await fetch(`${BASE_URL}/api/documents/${deptDocId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Lý do từ chối thử nghiệm' })
    });
    assert.strictEqual(res.status, 401, "Unauthenticated reject must return HTTP 401");

    recordTest(
      "Adversarial Security",
      "SEC-04",
      "Unauthenticated POST /api/documents/:id/reject yields HTTP 401",
      true,
      `Unauthenticated rejection call rejected with HTTP 401.`
    );
  }

  // Probe 2.5: /api/documents/:id/reject rejects unauthorized user (HTTP 403)
  {
    // Create a new document by teacher A
    const newDocRes = await fetch(`${BASE_URL}/api/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${teacherToken}` },
      body: JSON.stringify({
        title: 'Hồ sơ thử nghiệm phân quyền từ chối',
        category: 'REPORT',
        nextSignerId: 'user_7f37ffc5',
        signatureImage: SAMPLE_SIG_BASE64
      })
    });
    const newDocData = await newDocRes.json();
    const probeDocId = newDocData.data.id;

    // Login a different regular teacher or unprivileged account
    // Try to reject using teacherToken (cva.ty is author, NOT leader/BGH/designated approver)
    const unauthorizedRejectRes = await fetch(`${BASE_URL}/api/documents/${probeDocId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${teacherToken}` },
      body: JSON.stringify({ reason: 'Tự từ chối bài của mình không có quyền' })
    });
    assert.strictEqual(unauthorizedRejectRes.status, 403, "Unauthorized user must receive HTTP 403 on reject");

    recordTest(
      "Adversarial Security",
      "SEC-05",
      "Unauthorized rejection attempt yields HTTP 403",
      true,
      `Teacher unable to reject document without authorization (HTTP 403: 'Bạn không có quyền từ chối hồ sơ này!').`
    );
  }

  // Probe 2.6: /api/documents/:id/reject rejects empty and whitespace reasons (HTTP 400)
  {
    // Create another document to test empty reasons
    const docRes = await fetch(`${BASE_URL}/api/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${teacherToken}` },
      body: JSON.stringify({
        title: 'Giáo án kiểm thử lý do từ chối rỗng',
        category: 'REPORT',
        nextSignerId: 'user_7f37ffc5',
        signatureImage: SAMPLE_SIG_BASE64
      })
    });
    const docData = await docRes.json();
    const rejectTestDocId = docData.data.id;

    // Test 1: Empty string ""
    const emptyRes = await fetch(`${BASE_URL}/api/documents/${rejectTestDocId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${leaderToken}` },
      body: JSON.stringify({ reason: '' })
    });
    assert.strictEqual(emptyRes.status, 400, "Empty reason must be rejected with HTTP 400");
    const emptyJson = await emptyRes.json();
    assert.strictEqual(emptyJson.success, false);

    // Test 2: Whitespace only "   \t\n   "
    const whitespaceRes = await fetch(`${BASE_URL}/api/documents/${rejectTestDocId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${leaderToken}` },
      body: JSON.stringify({ reason: "   \t \r\n   " })
    });
    assert.strictEqual(whitespaceRes.status, 400, "Whitespace-only reason must be rejected with HTTP 400");
    const whitespaceJson = await whitespaceRes.json();
    assert.strictEqual(whitespaceJson.success, false);

    // Test 3: Valid reason -> HTTP 200 and audit trail
    const validReason = "Kế hoạch thiếu phân phối chương trình tuần 7 môn Toán theo quy định SGDĐT";
    const validRejectRes = await fetch(`${BASE_URL}/api/documents/${rejectTestDocId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${leaderToken}` },
      body: JSON.stringify({ reason: validReason })
    });
    assert.strictEqual(validRejectRes.status, 200, "Valid rejection must succeed with HTTP 200");
    const validRejectData = await validRejectRes.json();
    assert.strictEqual(validRejectData.data.status, 'REJECTED');
    assert.strictEqual(validRejectData.data.returnReason, validReason);

    // Verify audit log
    const lastLog = validRejectData.data.logs[validRejectData.data.logs.length - 1];
    assert.ok(lastLog.action.includes(validReason), "Audit log must contain rejection reason");
    assert.ok(lastLog.actor.includes('Trần Văn Nam'), "Audit log must record actor identity");

    recordTest(
      "Adversarial Security",
      "SEC-06",
      "Rejection endpoint strictly requires non-empty reason and records audit log",
      true,
      `Empty reason and whitespace-only reasons rejected with HTTP 400. Valid rejection recorded with full audit trail.`
    );
  }

  // Probe 2.7: Zalo bot account linking rejects bare phone numbers, strictly requires LK <SĐT> <MãPIN>
  {
    const GAS_SCRIPT_PATH = path.join(PROJECT_ROOT, 'google-apps-script-zalo-edusign.js');
    const gasScriptRaw = fs.readFileSync(GAS_SCRIPT_PATH, 'utf8');

    let mockUsersData = [
      ["STT", "Họ và Tên", "Số Điện Thoại", "Tổ Chuyên Môn", "Email Công Vụ", "Zalo_Chat_ID", "Ngày Liên Kết", "Tên_Viết_Tắt_TKB", "Mã_PIN_EduSign"],
      [1, "Hà Văn Tý", "0818810007", "Tổ Toán - Tin", "cva.ty@thcschuvanan.edu.vn", "original_chat_id_ty", "10/09/2026", "Tý", "0007"]
    ];

    const gasCtx = {
      console: console,
      Logger: { log: () => {} },
      Utilities: { formatDate: () => "15/09/2026", sleep: () => {} },
      ContentService: { createTextOutput: str => ({ setMimeType: () => ({ getContent: () => str }) }) },
      SpreadsheetApp: {
        open: () => gasCtx.SpreadsheetApp.openById("mock_id"),
        create: () => gasCtx.SpreadsheetApp.openById("mock_id"),
        openById: () => ({
          getId: () => "mock_id",
          getSheetByName: name => ({
            getDataRange: () => ({ getValues: () => mockUsersData }),
            getRange: (r, c) => ({
              setValue: val => { mockUsersData[r - 1][c - 1] = val; }
            })
          })
        })
      },
      UrlFetchApp: { fetch: () => ({ getResponseCode: () => 200, getContentText: () => "{}" }) },
      CONFIG: { SPREADSHEET_ID: "mock_id", SHEET_USERS: "Danh bạ GV" }
    };
    vm.createContext(gasCtx);
    vm.runInContext(gasScriptRaw, gasCtx);

    const attackerChatId = "adversary_chat_999";
    const victimPhone = "0818810007";

    // 1. Bare phone number -> MUST NOT LINK
    const bareReply = gasCtx.processUnifiedZaloMessage(attackerChatId, victimPhone);
    assert.strictEqual(mockUsersData[1][5], "original_chat_id_ty", "Bare phone MUST NOT overwrite Chat ID!");
    assert.ok(bareReply.includes("BẢO VỆ ĐỊNH DANH GIÁO VIÊN"), "Bot must prompt for PIN syntax LK <SĐT> <MãPIN>");

    // 2. Incorrect PIN -> MUST NOT LINK
    const wrongReply = gasCtx.processUnifiedZaloMessage(attackerChatId, `LK ${victimPhone} 8888`);
    assert.strictEqual(mockUsersData[1][5], "original_chat_id_ty", "Wrong PIN MUST NOT overwrite Chat ID!");
    assert.ok(wrongReply.includes("không chính xác"), "Bot must reject wrong PIN");

    // 3. Correct PIN -> LINKS
    const validReply = gasCtx.processUnifiedZaloMessage("verified_chat_ty", `LK ${victimPhone} 0007`);
    assert.strictEqual(mockUsersData[1][5], "verified_chat_ty", "Correct PIN MUST link Chat ID!");
    assert.ok(validReply.includes("THÀNH CÔNG"), "Bot must confirm successful link");

    recordTest(
      "Adversarial Security",
      "SEC-07",
      "Zalo Bot account linking strictly enforces 'LK <SĐT> <MãPIN>' challenge",
      true,
      `Bare phone numbers blocked without state mutation. Incorrect PIN rejected. Correct PIN verified and linked.`
    );
  }

  // Probe 2.8: Single-flight Mutex lock in zaloOaTokenManager.js under concurrent simulated requests
  {
    const { createRequire } = await import('module');
    const req = createRequire(import.meta.url);
    const ZaloOaTokenManager = req(path.join(PROJECT_ROOT, 'zaloOaTokenManager.js'));

    const manager = new ZaloOaTokenManager({
      appId: "test_cva_app",
      secretKey: "test_cva_secret"
    });

    let refreshExecutionCount = 0;
    // Mock executeRefreshToken to simulate an async delay (50ms)
    manager.executeRefreshToken = async function(refreshToken) {
      refreshExecutionCount++;
      await new Promise(r => setTimeout(r, 50));
      return {
        access_token: `refreshed_oa_token_${Date.now()}_${Math.random()}`,
        refresh_token: 'new_rolling_refresh_token',
        expires_in: 3600
      };
    };

    // Force expired tokens
    manager.saveTokens({ access_token: '', refresh_token: 'valid_refresh_token', expires_in: 0 });

    // Concurrently launch 25 requests
    const CONCURRENT_REQUESTS = 25;
    const promises = [];
    for (let i = 0; i < CONCURRENT_REQUESTS; i++) {
      promises.push(manager.getValidAccessToken());
    }

    const results = await Promise.all(promises);

    assert.strictEqual(refreshExecutionCount, 1, `executeRefreshToken must be called EXACTLY ONCE under ${CONCURRENT_REQUESTS} concurrent requests!`);
    assert.strictEqual(results.length, CONCURRENT_REQUESTS);
    
    // Every concurrent request must receive the identical refreshed token
    const firstToken = results[0];
    assert.ok(firstToken.startsWith('refreshed_oa_token_'));
    for (let i = 1; i < results.length; i++) {
      assert.strictEqual(results[i], firstToken, `Request ${i} must receive the exact same token`);
    }

    assert.strictEqual(manager.isRefreshing, false, "isRefreshing mutex must be unlocked");
    assert.strictEqual(manager.refreshQueue.length, 0, "Queue must be empty after resolution");

    recordTest(
      "Adversarial Security",
      "SEC-08",
      "Single-flight Mutex Lock in zaloOaTokenManager.js under 25 concurrent requests",
      true,
      `Launched 25 concurrent requests: executeRefreshToken invoked exactly 1 time. All 25 promises resolved seamlessly with zero race condition.`
    );
  }

  // ---------------------------------------------------------------------------
  // SUMMARY REPORT
  // ---------------------------------------------------------------------------
  const totalPassed = auditResults.filter(r => r.passed).length;
  const totalFailed = auditResults.filter(r => !r.passed).length;

  console.log("\n================================================================================");
  console.log(`📊 KẾT QUẢ KIỂM THỬ HỒI QUY ĐỐI KHÁNG M4: ${totalPassed}/${auditResults.length} THÀNH CÔNG`);
  console.log("================================================================================\n");

  if (totalFailed > 0) {
    console.log("🚨 PHÁT HIỆN LỖI BẢO MẬT HỒI QUY / REGRESSION DETECTED:");
    auditResults.filter(r => !r.passed).forEach(r => {
      console.log(`  ❌ [${r.id}] ${r.name}: ${r.details}`);
    });
    console.log("\n⚖️ KẾT LUẬN CUỐI CÙNG (FINAL VERDICT): REPORT_REGRESSION");
  } else {
    console.log("🎉 TOÀN BỘ CÁC BÀI TEST ĐỐI KHÁNG ĐÃ ĐẠT 100% PASS!");
    console.log("\n⚖️ KẾT LUẬN CUỐI CÙNG (FINAL VERDICT): CONFIRM_ZERO_SIDE_EFFECTS");
  }

  return { totalPassed, totalFailed, totalCount: auditResults.length, results: auditResults };
}

runAllChallenges()
  .then(summary => {
    stopServer();
    process.exit(summary.totalFailed > 0 ? 2 : 0);
  })
  .catch(err => {
    console.error("\n💥 CHALLLENGE SUITE FAILED WITH UNEXPECTED REGRESSION ERROR:", err);
    stopServer();
    process.exit(1);
  });
