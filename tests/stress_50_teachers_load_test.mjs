/**
 * ====================================================================================================
 * EDUSIGN VGCA - REQUIREMENT R3: REAL-TIME CONCURRENCY LOAD TEST & DATA INTEGRITY AUDIT
 * ====================================================================================================
 * 
 * File: tests/stress_50_teachers_load_test.mjs
 * Role: Worker M4 (Real-Time Performance & Concurrency Load Test Engineer)
 * Scope: 
 *   1. Launch/connect to local EduSign Express Server.
 *   2. Provision/authenticate 50 independent teacher sessions with valid credentials and tokens.
 *   3. Fire 50 concurrent teacher sessions within a 5-10s burst window:
 *      - Each session submits a lesson plan and signs electronically via POST /api/documents.
 *      - Proper auth headers (x-user-id, x-user-username, Authorization: Bearer).
 *      - Unique payload, signature placement coordinates, PDF attachment.
 *      - Monitor Event Loop delay across the burst via perf_hooks.monitorEventLoopDelay({ resolution: 10 }).
 *      - Measure individual request latencies via perf_hooks.performance.now().
 *      - Measure Server CPU/RAM consumption before and after the burst.
 *   4. Post-Test Strict Data Integrity Audit:
 *      - Direct physical read of data/documents.json from disk (bypassing in-memory cache).
 *      - Verify exactly 50 new document records persisted (+50 delta).
 *      - Verify 0 lost updates, 0 corrupt JSON structures, 0 duplicate IDs.
 *      - Verify signature metadata validity and status (COMPLETED / WAITING_NEXT_SIGN).
 *   5. Output definitive empirical metrics and exit with code 0.
 * 
 * Execution: node tests/stress_50_teachers_load_test.mjs
 * ====================================================================================================
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn, execSync } from 'child_process';
import { performance, monitorEventLoopDelay } from 'perf_hooks';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

// ==================== CONFIGURATION ====================
const PORT = parseInt(process.env.TEST_PORT || process.env.PORT || '3000', 10);
const HOST = '127.0.0.1';
const BASE_URL = `http://${HOST}:${PORT}`;
const CONCURRENT_TEACHERS = 50;
const BURST_JITTER_MAX_MS = 5500; // Random jitter distributed across 0-5.5s -> ensures burst execution window is within 5-10s

const DOCUMENTS_JSON_PATH = path.join(ROOT_DIR, 'data', 'documents.json');
const USERS_JSON_PATH = path.join(ROOT_DIR, 'data', 'users.json');
const SAMPLE_PDF_PATH = path.join(ROOT_DIR, 'GiaoAn_CanKy.pdf');

// ANSI Color Palette
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  gray: '\x1b[90m',
  bgBlue: '\x1b[44m',
  bgGreen: '\x1b[42m',
  bgRed: '\x1b[41m'
};

// 1x1 Transparent PNG Signature Image
const DEFAULT_SIGNATURE_BASE64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

// Subject departments for teachers
const DEPARTMENTS = [
  'Tổ Toán - Tin',
  'Tổ Ngữ Văn',
  'Tổ Tiếng Anh',
  'Tổ Khoa học Tự nhiên',
  'Tổ Lịch sử - Địa lý'
];

let spawnedServerProcess = null;

// ==================== UTILITY FUNCTIONS ====================

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Native HTTP Request Client using Node.js http module
 */
function httpRequest({ method = 'GET', path: reqPath, headers = {}, body = null, timeout = 30000 }) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: HOST,
      port: PORT,
      path: reqPath,
      method,
      headers: {
        'Accept': 'application/json',
        ...headers
      },
      timeout
    };

    let postData = null;
    if (body) {
      postData = typeof body === 'string' ? body : JSON.stringify(body);
      options.headers['Content-Length'] = Buffer.byteLength(postData, 'utf8');
      if (!options.headers['Content-Type']) {
        options.headers['Content-Type'] = 'application/json';
      }
    }

    const req = http.request(options, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const rawBody = Buffer.concat(chunks).toString('utf8');
        let parsed = null;
        try {
          parsed = JSON.parse(rawBody);
        } catch {
          parsed = rawBody;
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: parsed,
          rawBody
        });
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`HTTP Request Timeout (${timeout}ms) for ${method} ${reqPath}`));
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

/**
 * Query Process CPU and WorkingSet memory on Windows
 */
function getProcessStats(pid) {
  try {
    const cmd = `powershell -NoProfile -Command "Get-Process -Id ${pid} -ErrorAction SilentlyContinue | Select-Object -Property Id, WorkingSet64, CPU"`;
    const out = execSync(cmd, { encoding: 'utf8', timeout: 5000 });
    const lines = out.trim().split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length >= 2) {
      const dataLine = lines[lines.length - 1];
      const parts = dataLine.split(/\s+/);
      if (parts.length >= 3) {
        const wsBytes = parseFloat(parts[1]);
        const cpuSec = parseFloat(parts[2]);
        return {
          pid: parseInt(parts[0], 10),
          workingSetMB: !isNaN(wsBytes) ? Number((wsBytes / (1024 * 1024)).toFixed(2)) : null,
          cpuSeconds: !isNaN(cpuSec) ? Number(cpuSec.toFixed(2)) : null
        };
      }
    }
  } catch {}
  return null;
}

/**
 * Check if the server is responding on target port
 */
async function isServerResponding() {
  try {
    const res = await httpRequest({ method: 'GET', path: '/api/departments', timeout: 2000 });
    return res.statusCode === 200;
  } catch {
    return false;
  }
}

/**
 * Start or connect to server
 */
async function ensureServerRunning() {
  const responding = await isServerResponding();
  if (responding) {
    console.log(`  ${C.green}✓${C.reset} Đã phát hiện máy chủ EduSign VGCA đang chạy tại ${C.cyan}${BASE_URL}${C.reset}`);
    return null;
  }

  console.log(`  ${C.yellow}⚡${C.reset} Khởi chạy tiến trình máy chủ mới tại port ${PORT}...`);
  const serverProcess = spawn('node', ['server.js'], {
    cwd: ROOT_DIR,
    env: {
      ...process.env,
      PORT: String(PORT),
      TEST_PORT: String(PORT),
      NODE_ENV: 'test'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  spawnedServerProcess = serverProcess;

  serverProcess.stdout.on('data', () => {
    // drain stdout buffer to avoid pipe clogging
  });

  serverProcess.stderr.on('data', chunk => {
    const txt = chunk.toString('utf8');
    if (!txt.includes('EADDRINUSE') && !txt.includes('warning')) {
      // suppress verbose test logs
    }
  });

  // Wait for server ready
  let ready = false;
  for (let i = 0; i < 150; i++) {
    await sleep(100);
    if (await isServerResponding()) {
      ready = true;
      break;
    }
  }

  if (!ready) {
    throw new Error(`Máy chủ không khởi động kịp thời tại cổng ${PORT} sau 15 giây!`);
  }

  console.log(`  ${C.green}✓${C.reset} Máy chủ EduSign VGCA đã sẵn sàng phục vụ tại ${C.cyan}${BASE_URL}${C.reset} (PID: ${serverProcess.pid})`);
  return serverProcess;
}

/**
 * Cleanup spawned server on exit
 */
function cleanupServer() {
  if (spawnedServerProcess) {
    try {
      spawnedServerProcess.kill('SIGTERM');
    } catch {}
    spawnedServerProcess = null;
  }
}

process.on('exit', cleanupServer);
process.on('SIGINT', () => { cleanupServer(); process.exit(1); });
process.on('SIGTERM', () => { cleanupServer(); process.exit(1); });

// ==================== MAIN TEST SUITE ====================

async function run50TeachersStressTest() {
  console.log(`\n${C.bold}══════════════════════════════════════════════════════════════════════════════${C.reset}`);
  console.log(`${C.bgBlue}${C.bold}  EDUSIGN VGCA - LOAD TEST SUITE: 50 CONCURRENT TEACHERS REAL-TIME BURST   ${C.reset}`);
  console.log(`${C.bold}══════════════════════════════════════════════════════════════════════════════${C.reset}`);
  console.log(`${C.gray}Thời gian thực thi: ${new Date().toISOString()}${C.reset}`);
  console.log(`${C.gray}Môi trường: Node.js ${process.version} trên ${process.platform} (${process.arch})${C.reset}\n`);

  // --- BƯỚC 1: KHỞI CHẠY & KẾT NỐI SERVER ---
  console.log(`${C.bold}📌 BƯỚC 1: Khởi tạo Hạ tầng Mạng & Kiểm tra Máy chủ${C.reset}`);
  const srvProc = await ensureServerRunning();
  const serverPid = srvProc ? srvProc.pid : process.pid;

  // --- BƯỚC 2: CHUẨN BỊ 50 TÀI KHOẢN GIÁO VIÊN ĐỘC LẬP & AUTH SESSIONS ---
  console.log(`\n${C.bold}📌 BƯỚC 2: Chuẩn bị 50 Phiên Giáo viên Độc lập (Authentication & Credentials)${C.reset}`);
  
  // 2.1 Đăng nhập Quản trị viên
  const adminLoginRes = await httpRequest({
    method: 'POST',
    path: '/api/auth/login',
    body: { username: 'admin', password: 'admin@123' }
  });

  if (adminLoginRes.statusCode !== 200 || !adminLoginRes.body.token) {
    throw new Error(`Đăng nhập Quản trị viên thất bại: ${JSON.stringify(adminLoginRes.body)}`);
  }
  const adminToken = adminLoginRes.body.token;

  // 2.2 Lấy danh sách người dùng hiện có
  const existingUsersRes = await httpRequest({
    method: 'GET',
    path: '/api/admin/users',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });

  const existingUsers = Array.isArray(existingUsersRes.body?.data) 
    ? existingUsersRes.body.data 
    : (Array.isArray(existingUsersRes.body) ? existingUsersRes.body : []);
  const userMap = new Map(existingUsers.map(u => [u.username, u]));

  // 2.3 Khởi tạo & Cập nhật đủ 50 giáo viên độc lập
  const teacherSessions = [];
  console.log(`  Đang chuẩn bị ${CONCURRENT_TEACHERS} tài khoản giáo viên (${C.cyan}stress_gv_01${C.reset} -> ${C.cyan}stress_gv_50${C.reset})...`);

  for (let i = 1; i <= CONCURRENT_TEACHERS; i++) {
    const padId = String(i).padStart(2, '0');
    const username = `stress_gv_${padId}`;
    const teacherName = `Thầy/Cô Giáo Viên Nghiệm Thu ${padId}`;
    const dept = DEPARTMENTS[(i - 1) % DEPARTMENTS.length];
    const password = 'Password@2026';

    let userRecord = userMap.get(username);
    if (!userRecord) {
      const createRes = await httpRequest({
        method: 'POST',
        path: '/api/admin/users',
        headers: { 'Authorization': `Bearer ${adminToken}` },
        body: {
          username,
          password,
          name: teacherName,
          role: 'TEACHER',
          department: dept,
          signType: 'VGCA',
          canUploadWord: true,
          email: `${username}@thcschuvanan.edu.vn`,
          phone: `0905${String(i).padStart(6, '0')}`
        }
      });
      userRecord = createRes.body?.data;
      if (!userRecord && createRes.body?.message?.includes('đã tồn tại')) {
        // Tái nạp danh sách nếu tài khoản đã có sẵn
        const refreshUsersRes = await httpRequest({
          method: 'GET',
          path: '/api/admin/users',
          headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        const freshList = Array.isArray(refreshUsersRes.body?.data) ? refreshUsersRes.body.data : [];
        userRecord = freshList.find(u => u.username === username);
      }
    }

    if (!userRecord || !userRecord.id) {
      throw new Error(`Không thể khởi tạo tài khoản giáo viên ${username}: ${JSON.stringify(userRecord)}`);
    }

    // Đảm bảo chữ ký số mẫu đã được gắn vào profile để tránh tốn thêm I/O đĩa lúc burst
    if (!userRecord.signatureImage) {
      await httpRequest({
        method: 'PUT',
        path: `/api/admin/users/${userRecord.id}`,
        headers: { 'Authorization': `Bearer ${adminToken}` },
        body: { signatureImage: DEFAULT_SIGNATURE_BASE64 }
      });
    }

    // Đăng nhập phiên riêng của giáo viên để sinh JWT Token
    const loginRes = await httpRequest({
      method: 'POST',
      path: '/api/auth/login',
      body: { username, password }
    });

    if (loginRes.statusCode !== 200 || !loginRes.body.token) {
      throw new Error(`Lỗi đăng nhập giáo viên ${username}: ${JSON.stringify(loginRes.body)}`);
    }

    teacherSessions.push({
      index: i,
      id: userRecord.id,
      username: username,
      name: teacherName,
      department: dept,
      token: loginRes.body.token,
      signatureImage: DEFAULT_SIGNATURE_BASE64
    });
  }

  console.log(`  ${C.green}✓${C.reset} Đã xác thực thành công ${teacherSessions.length}/${CONCURRENT_TEACHERS} phiên giáo viên độc lập kèm JWT Token.`);

  // Đọc file PDF mẫu đính kèm
  let samplePdfBase64 = null;
  if (fs.existsSync(SAMPLE_PDF_PATH)) {
    const rawPdf = fs.readFileSync(SAMPLE_PDF_PATH);
    samplePdfBase64 = `data:application/pdf;base64,${rawPdf.toString('base64')}`;
  }

  // --- BƯỚC 3: ĐO ĐẠC BASELINE TRƯỚC KHI BẮN TẢI ---
  console.log(`\n${C.bold}📌 BƯỚC 3: Thiết lập Cơ sở Đo đạc Baseline (Trước đợt tải)${C.reset}`);
  
  if (!fs.existsSync(DOCUMENTS_JSON_PATH)) {
    fs.writeFileSync(DOCUMENTS_JSON_PATH, '[]', 'utf8');
  }

  const preTestRawJson = fs.readFileSync(DOCUMENTS_JSON_PATH, 'utf8');
  let preTestDocs = [];
  try {
    preTestDocs = JSON.parse(preTestRawJson);
  } catch (err) {
    throw new Error(`File data/documents.json bị lỗi cú pháp trước khi chạy test: ${err.message}`);
  }

  const baselineCount = preTestDocs.length;
  const baselineIds = new Set(preTestDocs.map(d => d.id));
  console.log(`  Số lượng hồ sơ ban đầu trong data/documents.json: ${C.cyan}${baselineCount}${C.reset}`);

  // Đo CPU / RAM trước tải
  const nodeMemPre = process.memoryUsage();
  const nodeCpuPre = process.cpuUsage();
  const srvStatsPre = getProcessStats(serverPid);

  console.log(`  Tài nguyên máy chủ (Trước tải):`);
  console.log(`    - Test Process RAM (RSS): ${C.cyan}${(nodeMemPre.rss / (1024 * 1024)).toFixed(2)} MB${C.reset} (Heap: ${(nodeMemPre.heapUsed / (1024 * 1024)).toFixed(2)} MB)`);
  if (srvStatsPre) {
    console.log(`    - Server Process (PID ${serverPid}) RAM: ${C.cyan}${srvStatsPre.workingSetMB} MB${C.reset} | CPU Time: ${srvStatsPre.cpuSeconds}s`);
  }

  // --- BƯỚC 4: KÍCH HOẠT 50 LUỒNG KÝ SỐ ĐỒNG THỜI (5-10S BURST WINDOW) ---
  console.log(`\n${C.bold}📌 BƯỚC 4: Kích hoạt 50 Phiên Giáo viên Ký số Đồng thời (5-10s Burst Window)...${C.reset}`);
  
  // Khởi động bộ giám sát Event Loop Lag
  const histogram = monitorEventLoopDelay({ resolution: 10 });
  histogram.enable();

  const burstStartTime = performance.now();
  const testRunTimestamp = Date.now();

  const requestResults = [];

  // Tạo 50 tác vụ bất đồng bộ đồng thời với độ trễ jitter thực tế
  const concurrentTasks = teacherSessions.map((session, idx) => {
    return (async () => {
      // Jitter ngẫu nhiên để phân bố trong cửa sổ 5-10s
      const jitterMs = Math.floor(Math.random() * BURST_JITTER_MAX_MS);
      await sleep(jitterMs);

      const i = session.index;
      // Phân chia 25 giáo án cá nhân (COMPLETED) và 25 báo cáo duyệt chuyển cấp (WAITING_NEXT_SIGN)
      const isPersonal = (i % 2 === 0);
      const category = isPersonal ? 'PERSONAL' : 'REPORT';
      const docTitle = `Kế hoạch bài dạy Tuần ${((i - 1) % 35) + 1} - Môn Toán 9 - Tiết ${i} - ${session.name} [STRESS_${testRunTimestamp}_${i}]`;

      const payload = {
        title: docTitle,
        grade: 'Khối 9',
        week: `Tuần ${((i - 1) % 35) + 1}`,
        term: 'Học kỳ I',
        pages: 12 + (i % 6),
        fileSize: `${(1.5 + (i * 0.05)).toFixed(1)} MB`,
        fileName: `GiaoAn_Tuan${((i - 1) % 35) + 1}_${session.username}.pdf`,
        fileType: 'pdf',
        fileBase64: samplePdfBase64,
        signPlacement: 'bottom-right',
        signCoordinates: {
          page: 1,
          x: 380 + (i % 25),
          y: 120 + (i % 20),
          width: 140,
          height: 60,
          scale: 1
        },
        signatureImage: session.signatureImage,
        signType: 'STANDARD',
        category: category,
        nextSignerId: isPersonal ? null : 'user_cvalien',
        nextSignerName: isPersonal ? null : 'Ngô Thị Liền',
        nextSignerRole: isPersonal ? null : 'Ban Giám hiệu - Hiệu trưởng'
      };

      const reqHeaders = {
        'Authorization': `Bearer ${session.token}`,
        'x-user-id': session.id,
        'x-user-username': session.username,
        'Content-Type': 'application/json'
      };

      const reqStart = performance.now();
      let res = null;
      let reqError = null;

      try {
        res = await httpRequest({
          method: 'POST',
          path: '/api/documents',
          headers: reqHeaders,
          body: payload,
          timeout: 25000
        });
      } catch (err) {
        reqError = err;
      }

      const reqLatency = performance.now() - reqStart;
      const isSuccess = res && res.statusCode === 200 && res.body && res.body.success === true;
      const docData = isSuccess ? (res.body.data || res.body.doc) : null;

      const resultObj = {
        index: i,
        username: session.username,
        latencyMs: reqLatency,
        jitterMs,
        statusCode: res ? res.statusCode : 0,
        success: isSuccess,
        category,
        expectedStatus: isPersonal ? 'COMPLETED' : 'WAITING_NEXT_SIGN',
        docId: docData ? docData.id : null,
        docTitle: docTitle,
        actualStatus: docData ? docData.status : null,
        error: reqError ? reqError.message : (isSuccess ? null : JSON.stringify(res ? res.body : 'No Response'))
      };

      requestResults.push(resultObj);
      return resultObj;
    })();
  });

  // Chờ toàn bộ 50 luồng hoàn tất
  await Promise.allSettled(concurrentTasks);

  const burstEndTime = performance.now();
  const burstTotalDurationMs = burstEndTime - burstStartTime;

  // Dừng giám sát Event Loop Lag
  histogram.disable();

  // Đo CPU / RAM sau tải
  const nodeMemPost = process.memoryUsage();
  const nodeCpuPost = process.cpuUsage(nodeCpuPre);
  const srvStatsPost = getProcessStats(serverPid);

  console.log(`  ${C.green}✓${C.reset} Toàn bộ 50 luồng ký số đã hoàn tất trong ${C.bold}${burstTotalDurationMs.toFixed(2)}ms${C.reset} (~${(burstTotalDurationMs / 1000).toFixed(2)} giây).`);

  // --- BƯỚC 5: TÍNH TOÁN CÁC CHỈ SỐ MẠNG & HIỆU NĂNG THỰC NGHIỆM ---
  console.log(`\n${C.bold}📌 BƯỚC 5: Tổng hợp Chỉ số Hiệu năng & Hiện tượng Nghẽn Mạng${C.reset}`);

  const totalRequests = requestResults.length;
  const successfulRequests = requestResults.filter(r => r.success).length;
  const failedRequests = totalRequests - successfulRequests;
  const successRate = (successfulRequests / totalRequests) * 100;

  const latencies = requestResults.map(r => r.latencyMs).sort((a, b) => a - b);
  const minLatency = latencies.length > 0 ? latencies[0] : 0;
  const maxLatency = latencies.length > 0 ? latencies[latencies.length - 1] : 0;
  const avgLatency = latencies.length > 0 ? latencies.reduce((acc, v) => acc + v, 0) / latencies.length : 0;
  
  // P95 Latency (95th percentile)
  const p95Index = Math.min(Math.floor(latencies.length * 0.95), latencies.length - 1);
  const p95Latency = latencies.length > 0 ? latencies[p95Index] : 0;

  // Event Loop Lag (đổi từ nanoseconds sang milliseconds)
  const meanLagMs = isNaN(histogram.mean) ? 0 : histogram.mean / 1e6;
  const p50LagMs = isNaN(histogram.percentile(50)) ? 0 : histogram.percentile(50) / 1e6;
  const p90LagMs = isNaN(histogram.percentile(90)) ? 0 : histogram.percentile(90) / 1e6;
  const p99LagMs = isNaN(histogram.percentile(99)) ? 0 : histogram.percentile(99) / 1e6;
  const maxLagMs = isNaN(histogram.max) ? 0 : histogram.max / 1e6;

  console.log(`\n  ┌────────────────────────────────────────────────────────────────────────┐`);
  console.log(`  │ ${C.bold}BẢNG CHỈ SỐ ĐO TẢI ĐỒNG THỜI (50 TEACHERS CONCURRENCY LOAD METRICS)${C.reset}    │`);
  console.log(`  ├────────────────────────────────────────────────────────────────────────┤`);
  console.log(`  │ Tổng số yêu cầu ký số (Total Requests):           ${String(totalRequests).padStart(8)} yêu cầu    │`);
  console.log(`  │ Yêu cầu thành công (Successful Requests):         ${C.green}${String(successfulRequests).padStart(8)}${C.reset} yêu cầu    │`);
  console.log(`  │ Yêu cầu thất bại (Failed Requests):               ${failedRequests === 0 ? C.green : C.red}${String(failedRequests).padStart(8)}${C.reset} yêu cầu    │`);
  console.log(`  │ ${C.bold}Tỷ lệ thành công (Success Rate - Chuẩn >= 98%):    ${successRate >= 98 ? C.green : C.red}${successRate.toFixed(2).padStart(7)}%${C.reset}${C.bold}       │${C.reset}`);
  console.log(`  │ Thời gian đợt tải (Total Burst Window):           ${(burstTotalDurationMs / 1000).toFixed(2).padStart(7)} giây      │`);
  console.log(`  ├────────────────────────────────────────────────────────────────────────┤`);
  console.log(`  │ ${C.bold}ĐỘ TRỄ PHẢN HỒI HTTP (REQUEST LATENCIES - MS)${C.reset}                          │`);
  console.log(`  │   - Độ trễ tối thiểu (Min Latency):               ${minLatency.toFixed(2).padStart(8)} ms        │`);
  console.log(`  │   - Độ trễ trung bình (Average Latency):          ${avgLatency.toFixed(2).padStart(8)} ms        │`);
  console.log(`  │   - ${C.bold}Độ trễ phân vị P95 (P95 Latency):             ${p95Latency.toFixed(2).padStart(8)} ms${C.reset}        │`);
  console.log(`  │   - Độ trễ tối đa (Max Latency):                  ${maxLatency.toFixed(2).padStart(8)} ms        │`);
  console.log(`  ├────────────────────────────────────────────────────────────────────────┤`);
  console.log(`  │ ${C.bold}ĐỘ TRỄ NGHẼN LUỒNG NODE.JS (EVENT LOOP LAG / BLOCKING - MS)${C.reset}            │`);
  console.log(`  │   - Trung bình (Mean Lag):                        ${meanLagMs.toFixed(2).padStart(8)} ms        │`);
  console.log(`  │   - Phân vị 50 (P50 Lag):                         ${p50LagMs.toFixed(2).padStart(8)} ms        │`);
  console.log(`  │   - Phân vị 90 (P90 Lag):                         ${p90LagMs.toFixed(2).padStart(8)} ms        │`);
  console.log(`  │   - Phân vị 99 (P99 Lag):                         ${p99LagMs.toFixed(2).padStart(8)} ms        │`);
  console.log(`  │   - Lớn nhất (Max Lag):                           ${maxLagMs.toFixed(2).padStart(8)} ms        │`);
  console.log(`  ├────────────────────────────────────────────────────────────────────────┤`);
  console.log(`  │ ${C.bold}TIÊU THỤ TÀI NGUYÊN HỆ THỐNG (SYSTEM RESOURCE CONSUMPTION)${C.reset}             │`);
  console.log(`  │   - Test Process RAM RSS: ${C.cyan}${(nodeMemPre.rss / (1024*1024)).toFixed(1)} MB${C.reset} -> ${C.cyan}${(nodeMemPost.rss / (1024*1024)).toFixed(1)} MB${C.reset} (Δ: ${((nodeMemPost.rss - nodeMemPre.rss)/(1024*1024)).toFixed(1)} MB) │`);
  console.log(`  │   - Test Process Heap:    ${C.cyan}${(nodeMemPre.heapUsed / (1024*1024)).toFixed(1)} MB${C.reset} -> ${C.cyan}${(nodeMemPost.heapUsed / (1024*1024)).toFixed(1)} MB${C.reset} (Δ: ${((nodeMemPost.heapUsed - nodeMemPre.heapUsed)/(1024*1024)).toFixed(1)} MB) │`);
  if (srvStatsPre && srvStatsPost) {
    console.log(`  │   - Server Process RAM:   ${C.cyan}${srvStatsPre.workingSetMB} MB${C.reset} -> ${C.cyan}${srvStatsPost.workingSetMB} MB${C.reset} (Δ: ${(srvStatsPost.workingSetMB - srvStatsPre.workingSetMB).toFixed(1)} MB)       │`);
    console.log(`  │   - Server Process CPU:   ${srvStatsPre.cpuSeconds}s -> ${srvStatsPost.cpuSeconds}s (Δ: ${(srvStatsPost.cpuSeconds - srvStatsPre.cpuSeconds).toFixed(2)}s CPU time)     │`);
  }
  console.log(`  └────────────────────────────────────────────────────────────────────────┘\n`);

  // --- BƯỚC 6: ĐỐI SOÁT TÍNH TOÀN VẸN DỮ LIỆU ĐĨA VẬT LÝ (POST-TEST STRICT DATA INTEGRITY AUDIT) ---
  console.log(`${C.bold}📌 BƯỚC 6: Thẩm định Tính Toàn vẹn Dữ liệu Đĩa Vật lý (Data Integrity Audit)${C.reset}`);
  
  // Chờ đợi hàng đợi ghi đĩa tuần tự (Serialized Write Queue) hoàn tất flush ra tệp documents.json
  console.log(`  Đang chờ Serialized Async Queue flush toàn bộ dữ liệu ra tệp vật lý data/documents.json...`);
  let postTestDocs = [];
  let pollAttempts = 0;
  const maxPolls = 30; // 3 giây tối đa

  while (pollAttempts < maxPolls) {
    pollAttempts++;
    await sleep(100);
    try {
      const raw = fs.readFileSync(DOCUMENTS_JSON_PATH, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed.length >= baselineCount + CONCURRENT_TEACHERS) {
        postTestDocs = parsed;
        break;
      }
    } catch {}
  }

  // Đọc trực tiếp tệp đĩa vật lý lần cuối (cắt bỏ hoàn toàn RAM cache)
  const physicalRawContent = fs.readFileSync(DOCUMENTS_JSON_PATH, 'utf8');
  let physicalDocs = null;
  let jsonSyntaxValid = false;

  try {
    physicalDocs = JSON.parse(physicalRawContent);
    jsonSyntaxValid = true;
  } catch (err) {
    jsonSyntaxValid = false;
    throw new Error(`CRITICAL INTEGRITY FAILURE: Tệp data/documents.json trên đĩa bị hỏng cú pháp JSON! Lỗi: ${err.message}`);
  }

  const postTestCount = physicalDocs.length;
  const deltaCreated = postTestCount - baselineCount;

  console.log(`  Kết quả đọc trực tiếp từ đĩa vật lý:`);
  console.log(`    - Kích thước tệp: ${C.cyan}${Buffer.byteLength(physicalRawContent, 'utf8').toLocaleString()} bytes${C.reset}`);
  console.log(`    - Số bản ghi ban đầu: ${baselineCount}`);
  console.log(`    - Số bản ghi hiện tại trên đĩa: ${C.bold}${postTestCount}${C.reset}`);
  console.log(`    - Chênh lệch hồ sơ mới ghi nhận: ${deltaCreated >= CONCURRENT_TEACHERS ? C.green : C.red}${deltaCreated}${C.reset} (Kỳ vọng: đúng ${CONCURRENT_TEACHERS})`);

  // Thẩm định các tiêu chí nghiêm ngặt:
  let auditPass = true;
  const auditErrors = [];

  // Tiêu chí 1: Cú pháp JSON toàn vẹn (0 Corrupt JSON Structures)
  if (!jsonSyntaxValid) {
    auditPass = false;
    auditErrors.push('Tệp documents.json bị hỏng cấu trúc cú pháp JSON (Corrupt JSON Structure)!');
  }

  // Tiêu chí 2: Đúng 50 bản ghi mới được lưu trữ bền vững
  if (deltaCreated !== CONCURRENT_TEACHERS) {
    auditPass = false;
    auditErrors.push(`Lệch số lượng hồ sơ ghi đĩa: Nhận ${deltaCreated}, kỳ vọng đúng ${CONCURRENT_TEACHERS} bản ghi!`);
  }

  // Tiêu chí 3: 0 Duplicate IDs trong toàn bộ tệp documents.json
  const allDocIds = new Set();
  let duplicateCount = 0;
  for (const doc of physicalDocs) {
    if (allDocIds.has(doc.id)) {
      duplicateCount++;
    }
    allDocIds.add(doc.id);
  }
  if (duplicateCount > 0) {
    auditPass = false;
    auditErrors.push(`Phát hiện ${duplicateCount} mã hồ sơ bị trùng lặp (Duplicate IDs)!`);
  }

  // Tiêu chí 4: 0 Lost Updates - Đối soát 1-1 toàn bộ 50 hồ sơ từ API Response vào Đĩa
  const docMapOnDisk = new Map(physicalDocs.map(d => [d.id, d]));
  let lostUpdateCount = 0;
  let signatureInvalidCount = 0;
  let statusMismatchCount = 0;

  for (const reqResult of requestResults) {
    if (!reqResult.success || !reqResult.docId) {
      lostUpdateCount++;
      continue;
    }

    const diskDoc = docMapOnDisk.get(reqResult.docId);
    if (!diskDoc) {
      lostUpdateCount++;
      auditErrors.push(`Hồ sơ ${reqResult.docId} (${reqResult.username}) có trong API Response nhưng biến mất khỏi đĩa (Lost Update)!`);
      continue;
    }

    // Kiểm tra tính toàn vẹn nội dung
    if (diskDoc.title !== reqResult.docTitle) {
      lostUpdateCount++;
      auditErrors.push(`Hồ sơ ${diskDoc.id} bị sai lệch tiêu đề trên đĩa!`);
    }

    // Kiểm tra Chữ ký số hợp lệ (Signatures Metadata)
    if (!Array.isArray(diskDoc.signatures) || diskDoc.signatures.length < 1) {
      signatureInvalidCount++;
      auditErrors.push(`Hồ sơ ${diskDoc.id} thiếu chữ ký số hợp lệ trong mảng signatures!`);
    } else {
      const sig = diskDoc.signatures[0];
      if (sig.status !== 'VALID' || !sig.signerName) {
        signatureInvalidCount++;
        auditErrors.push(`Hồ sơ ${diskDoc.id} có metadata chữ ký số không hợp lệ (status: ${sig.status})!`);
      }
    }

    // Kiểm tra trạng thái hồ sơ (COMPLETED hoặc WAITING_NEXT_SIGN)
    const validStatuses = ['COMPLETED', 'WAITING_NEXT_SIGN'];
    if (!validStatuses.includes(diskDoc.status)) {
      statusMismatchCount++;
      auditErrors.push(`Hồ sơ ${diskDoc.id} mang trạng thái không hợp lệ: ${diskDoc.status}!`);
    }
  }

  if (lostUpdateCount > 0) {
    auditPass = false;
    auditErrors.push(`Phát hiện ${lostUpdateCount} hồ sơ bị thất lạc / ghi đè (Lost Updates)!`);
  }

  if (signatureInvalidCount > 0) {
    auditPass = false;
    auditErrors.push(`Phát hiện ${signatureInvalidCount} hồ sơ có chữ ký số không hợp lệ!`);
  }

  if (statusMismatchCount > 0) {
    auditPass = false;
    auditErrors.push(`Phát hiện ${statusMismatchCount} hồ sơ sai lệch trạng thái nghiệm thu!`);
  }

  // --- BƯỚC 7: TỔNG KẾT & ĐÁNH GIÁ NGHIỆM THU ---
  console.log(`\n${C.bold}📌 BƯỚC 7: Bảng Nghiệm thu Toàn diện Tính Toàn vẹn Dữ liệu (Integrity Checklist)${C.reset}`);
  console.log(`  ┌────────────────────────────────────────────────────────────────────────┐`);
  console.log(`  │ ${jsonSyntaxValid ? C.green + '✓ PASS' : C.red + '✗ FAIL'}${C.reset}  0 Cấu trúc JSON bị hỏng (0 Corrupt JSON Structures)        │`);
  console.log(`  │ ${deltaCreated === CONCURRENT_TEACHERS ? C.green + '✓ PASS' : C.red + '✗ FAIL'}${C.reset}  Lưu đúng 50 bản ghi mới trên đĩa (${deltaCreated}/${CONCURRENT_TEACHERS} Records Persisted)      │`);
  console.log(`  │ ${duplicateCount === 0 ? C.green + '✓ PASS' : C.red + '✗ FAIL'}${C.reset}  0 Mã hồ sơ trùng lặp (0 Duplicate IDs in documents.json)   │`);
  console.log(`  │ ${lostUpdateCount === 0 ? C.green + '✓ PASS' : C.red + '✗ FAIL'}${C.reset}  0 Hồ sơ bị mất do Race Condition (0 Lost Updates)          │`);
  console.log(`  │ ${signatureInvalidCount === 0 ? C.green + '✓ PASS' : C.red + '✗ FAIL'}${C.reset}  100% Hồ sơ chứa Metadata chữ ký số hợp lệ (Valid Signatures)│`);
  console.log(`  │ ${statusMismatchCount === 0 ? C.green + '✓ PASS' : C.red + '✗ FAIL'}${C.reset}  100% Hồ sơ đúng trạng thái COMPLETED / WAITING_NEXT_SIGN    │`);
  console.log(`  │ ${successRate >= 98 ? C.green + '✓ PASS' : C.red + '✗ FAIL'}${C.reset}  Tỷ lệ thành công đạt chuẩn: ${successRate.toFixed(2)}% (Yêu cầu >= 98%)      │`);
  console.log(`  └────────────────────────────────────────────────────────────────────────┘\n`);

  if (!auditPass || successRate < 98) {
    console.error(`${C.bgRed}${C.bold} ❌ KIỂM THỬ TẢI THẤT BẠI: CÓ LỖI TÍNH TOÀN VẸN DỮ LIỆU HOẶC TỶ LỆ DƯỚI 98%! ${C.reset}`);
    auditErrors.forEach(err => console.error(`  - ${C.red}${err}${C.reset}`));
    process.exit(1);
  }

  console.log(`${C.bgGreen}${C.bold} 🎉 BÀI TEST TẢI 50 GIÁO VIÊN KÝ SỐ HOÀN TẤT XUẤT SẮC - ĐẠT CHUẨN 100% PASS! ${C.reset}`);
  console.log(`${C.green}Tất cả 50 hồ sơ đã được lưu trữ an toàn trên đĩa vật lý documents.json với 0 Lost Updates.${C.reset}\n`);

  process.exit(0);
}

run50TeachersStressTest().catch(err => {
  console.error(`\n${C.bgRed}${C.bold} LỖI NGOẠI LỆ TRONG KỊCH BẢN TEST: ${C.reset}`, err);
  cleanupServer();
  process.exit(1);
});
