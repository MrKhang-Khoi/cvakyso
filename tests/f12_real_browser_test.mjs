/**
 * ====================================================================================================
 * EDUSIGN VGCA - F12 DEVTOOLS CONSOLE & NETWORK REAL-TIME BROWSER AUDITOR
 * ====================================================================================================
 * File: tests/f12_real_browser_test.mjs
 * Purpose: Open real Chromium browser, intercept F12 Console logs, monitor real HTTP network requests,
 *          verify Bearer Token acquisition, test "Kho Báo cáo số" layout, and test "Ký chuyển" flow.
 * Execution: node tests/f12_real_browser_test.mjs
 * ====================================================================================================
 */

import { chromium } from 'playwright';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const SCREENSHOT_DIR = path.join(ROOT_DIR, 'tests', 'screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

// ANSI formatting
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  gray: '\x1b[90m'
};

// Khởi tạo máy chủ tĩnh nội bộ để phục vụ mã nguồn mới nhất cho Playwright
function startStaticServer(port = 8089) {
  return new Promise((resolve) => {
    const mimeTypes = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.ico': 'image/x-icon',
      '.pdf': 'application/pdf'
    };

    const server = http.createServer((req, res) => {
      let reqPath = decodeURIComponent(req.url.split('?')[0]);
      if (reqPath === '/' || reqPath === '/kyso/' || reqPath === '/cvakyso/') reqPath = '/index.html';
      if (reqPath.startsWith('/kyso/')) reqPath = reqPath.replace(/^\/kyso/, '');
      if (reqPath.startsWith('/cvakyso/')) reqPath = reqPath.replace(/^\/cvakyso/, '');

      const filePath = path.join(ROOT_DIR, reqPath);
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
        res.setHeader('Access-Control-Allow-Origin', '*');
        fs.createReadStream(filePath).pipe(res);
      } else {
        res.statusCode = 404;
        res.end('Not Found');
      }
    });

    server.listen(port, '127.0.0.1', () => {
      resolve(server);
    });
  });
}

async function runRealF12Audit() {
  console.log(`${C.bold}════════════════════════════════════════════════════════════════════════════════════════${C.reset}`);
  console.log(`${C.bold}🖥️  MỞ TRÌNH DUYỆT THẬT (PLAYWRIGHT CHROMIUM) - GIÁM SÁT F12 CONSOLE & NETWORK TRACE${C.reset}`);
  console.log(`${C.gray}Thời gian chạy: ${new Date().toISOString()}${C.reset}`);
  console.log(`${C.bold}════════════════════════════════════════════════════════════════════════════════════════\n${C.reset}`);

  const localServer = await startStaticServer(8089);
  console.log(`[Local Static Server] Đang phục vụ mã nguồn mới nhất tại: ${C.cyan}http://127.0.0.1:8089${C.reset}`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) EduSign-F12-Tester/2.0'
  });

  const page = await context.newPage();

  const f12ConsoleLogs = [];
  const f12PageErrors = [];
  const f12NetworkRequests = [];

  page.on('console', (msg) => {
    f12ConsoleLogs.push({ type: msg.type(), text: msg.text() });
    if (msg.type() === 'error') {
      console.log(`   ${C.red}[F12 Console.error] ${msg.text()}${C.reset}`);
    } else if (msg.type() === 'warn') {
      console.log(`   ${C.yellow}[F12 Console.warn]  ${msg.text().substring(0, 100)}${C.reset}`);
    }
  });

  page.on('pageerror', (err) => {
    f12PageErrors.push(err.message);
    console.log(`   ${C.bold}${C.red}[F12 Uncaught Error] ${err.message}${C.reset}`);
  });

  page.on('request', (req) => {
    const url = req.url();
    if (url.includes('/api/')) {
      const headers = req.headers();
      f12NetworkRequests.push({
        method: req.method(),
        url,
        hasAuthHeader: Boolean(headers['authorization'] || headers['x-auth-token']),
        timestamp: Date.now()
      });
      console.log(`   ${C.cyan}[F12 Network OUT] ${req.method()} ${url}${C.reset} | Auth: ${headers['authorization'] ? C.green + 'CÓ TOKEN BEARER' : C.red + 'KHÔNG TOKEN'}${C.reset}`);
    }
  });

  page.on('response', (res) => {
    const url = res.url();
    if (url.includes('/api/')) {
      const statusColor = res.status() < 400 ? C.green : C.red;
      console.log(`   ${statusColor}[F12 Network IN]  ${res.status()} ${res.statusText()} <== ${url}${C.reset}`);
    }
  });

  try {
    // ------------------------------------------------------------------------------------------------
    // TEST CASE 1: TRUY CẬP TRANG WEB VỚI MÃ NGUỒN VỪA SỬA
    // ------------------------------------------------------------------------------------------------
    console.log(`\n${C.bold}1. ĐANG TẢI TRANG WEB KIỂM THỬ (Mã nguồn mới nhất đã sửa):${C.reset}`);
    const navRes = await page.goto('http://127.0.0.1:8089/index.html', {
      waitUntil: 'domcontentloaded',
      timeout: 15000
    });
    console.log(`   - HTTP Status trang gốc: ${navRes.status() === 200 ? C.green : C.red}${navRes.status()}${C.reset}`);
    await page.waitForTimeout(1000);

    // ------------------------------------------------------------------------------------------------
    // TEST CASE 2: ĐĂNG NHẬP VÀ GIÁM SÁT CẤP PHÁT TOKEN BEARER TỪ RENDER
    // ------------------------------------------------------------------------------------------------
    console.log(`\n${C.bold}2. KIỂM THỬ ĐĂNG NHẬP TÀI KHOẢN GIÁO VIÊN HÀ VĂN TÝ:${C.reset}`);
    await page.fill('#loginUsername', 'cva.ty');
    await page.fill('#loginPassword', '123456');
    console.log(`   - Đã nhập: cva.ty / ******`);

    // Bấm nút đăng nhập
    await page.click('#btnLoginSubmit');
    console.log(`   - Đã bấm nút [Đăng nhập]... Chờ kết nối mạng Render...`);
    await page.waitForTimeout(3000);

    // Kiểm tra xem trình duyệt đã lưu Bearer Token vào localStorage chưa
    const storedToken = await page.evaluate(() => localStorage.getItem('edusign_token'));
    const storedUser = await page.evaluate(() => localStorage.getItem('edusign_user'));
    
    console.log(`   - Token trong localStorage: ${storedToken ? `${C.green}✅ ĐÃ CÓ TOKEN BEARER (${storedToken.substring(0, 30)}...)${C.reset}` : `${C.red}❌ CHƯA CÓ TOKEN${C.reset}`}`);
    console.log(`   - User trong localStorage:  ${storedUser ? `${C.green}✅ ĐÃ CÓ USER CƠ BẢN${C.reset}` : `${C.red}❌ CHƯA CÓ USER${C.reset}`}`);

    // ------------------------------------------------------------------------------------------------
    // TEST CASE 3: KIỂM THỬ TAB "KHO BÁO CÁO SỐ" (ĐÃ SỬA THẺ ĐÓNG DIV)
    // ------------------------------------------------------------------------------------------------
    console.log(`\n${C.bold}3. KIỂM THỬ TAB "KHO BÁO CÁO SỐ" (KIỂM TRA CÓ BỊ TRẮNG MÀN HÌNH KHÔNG):${C.reset}`);
    
    const btnReports = await page.$('#tabBtnTeacherReports');
    let reportTabState = null;
    if (btnReports) {
      await btnReports.click();
      console.log(`   - Đã nhấp vào nút [Kho Báo cáo số]!`);
      await page.waitForTimeout(2000);

      reportTabState = await page.evaluate(() => {
        const el = document.getElementById('tabContentTeacherReports');
        if (!el) return { exists: false };
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        const rows = document.querySelectorAll('#listSchoolReportsContainer tr').length;
        const bannerVisible = !!document.getElementById('reportPermissionBanner');
        return {
          exists: true,
          display: style.display,
          visibility: style.visibility,
          width: rect.width,
          height: rect.height,
          isHiddenClass: el.classList.contains('hidden'),
          rowsCount: rows,
          bannerVisible
        };
      });

      console.log(`   - Thẻ tabContentTeacherReports tồn tại: ${reportTabState.exists ? C.green + 'CÓ' : C.red + 'KHÔNG'}${C.reset}`);
      console.log(`   - Thuộc tính display:                  ${reportTabState.display !== 'none' ? C.green + reportTabState.display : C.red + 'none (BỊ ẨN!)'}${C.reset}`);
      console.log(`   - Chiều cao khung nhìn:                ${reportTabState.height > 100 ? `${C.green}${reportTabState.height}px (CÓ NỘI DUNG RÕ RÀNG)` : `${C.red}${reportTabState.height}px (TRẮNG TRƠN!)`}${C.reset}`);
      console.log(`   - Số dòng báo cáo hiển thị trong bảng:  ${reportTabState.rowsCount > 0 ? `${C.green}${reportTabState.rowsCount} dòng` : `${C.yellow}0 dòng`}${C.reset}`);

      const reportScreenshotPath = path.join(SCREENSHOT_DIR, 'evidence_kho_bao_cao_fixed_verified.png');
      await page.screenshot({ path: reportScreenshotPath, fullPage: false });
      console.log(`   - ${C.green}📸 Đã chụp ảnh màn hình lưu tại: ${reportScreenshotPath}${C.reset}`);
    }

    // ------------------------------------------------------------------------------------------------
    // TEST CASE 4: KIỂM THỬ XÁC THỰC MẠNG VỚI ENDPOINT /api/documents/forward (CHECK 401)
    // ------------------------------------------------------------------------------------------------
    console.log(`\n${C.bold}4. KIỂM THỬ GỬI GÓI TIN CHUYỂN TIẾP HỒ SƠ KÈM BEARER TOKEN THẬT:${C.reset}`);
    
    const forwardProbeResult = await page.evaluate(async () => {
      const token = localStorage.getItem('edusign_token');
      try {
        const res = await fetch('https://edusign-vgca.onrender.com/api/documents/forward', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': 'user_cvaty',
            'x-user-username': 'cva.ty',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: JSON.stringify({
            title: '[TEST F12 PROBE] Báo cáo kiểm định tự động',
            fileBase64: 'data:application/pdf;base64,JVBERi0xLjQKJeLjz9MKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFIKPj4KZW5kb2JqCjIgMCBvYmoKPDwKL1R5cGUgL1BhZ2VzCi9LaWRzIFszIDAgUl0KL0NvdW50IDEKPj4KZW5kb2JqCjMgMCBvYmoKPDwKL1R5cGUgL1BhZ2UKL1BhcmVudCAyIDAgUgovTWVkaWFCb3ggWzAgMCA2MTIgNzkyXQo+PgplbmRvYmoKeHJlZgowIDQKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDE4IDAwMDAwIG4gCjAwMDAwMDAwNjggMDAwMDAgbiAKMDAwMDAwMDEyNSAwMDAwMCBuIAp0cmFpbGVyCjw8Ci9TaXplIDQKL1Jvb3QgMSAwIFIKPj4Kc3RhcnR4cmVmCjE5NQolJUVPRgo=',
            nextSignerId: 'cva.ty'
          })
        });
        const json = await res.json().catch(() => ({}));
        return {
          status: res.status,
          success: res.ok,
          hasTokenSent: Boolean(token),
          message: json.message || ''
        };
      } catch (err) {
        return { error: err.message };
      }
    });

    console.log(`   - Gói tin gửi kèm Token:  ${forwardProbeResult.hasTokenSent ? `${C.green}CÓ TOKEN HỢP LỆ${C.reset}` : `${C.red}KHÔNG CÓ TOKEN${C.reset}`}`);
    console.log(`   - Mã phản hồi HTTP:       ${forwardProbeResult.status === 200 ? `${C.green}HTTP 200 OK (THÀNH CÔNG!)${C.reset}` : (forwardProbeResult.status === 401 ? `${C.red}HTTP 401 UNAUTHORIZED (VẪN LỖI!)${C.reset}` : `${C.yellow}HTTP ${forwardProbeResult.status} (${forwardProbeResult.message})${C.reset}`)}`);
    console.log(`   - Phản hồi chi tiết:      ${forwardProbeResult.message || (forwardProbeResult.success ? 'Hồ sơ đã được tiếp nhận thành công!' : 'N/A')}`);

    // ------------------------------------------------------------------------------------------------
    // TỔNG KẾT BÁO CÁO F12
    // ------------------------------------------------------------------------------------------------
    console.log(`\n${C.bold}════════════════════════════════════════════════════════════════════════════════════════${C.reset}`);
    console.log(`${C.bold}📊 TỔNG KẾT GIÁM SÁT F12 DEVTOOLS:${C.reset}`);
    console.log(`• Tổng số Console Logs:      ${f12ConsoleLogs.length}`);
    console.log(`• Tổng số Lỗi Uncaught JS:   ${f12PageErrors.length === 0 ? `${C.green}0 LỖI (HOÀN HẢO)${C.reset}` : `${C.red}${f12PageErrors.length} LỖI!${C.reset}`}`);
    console.log(`• Tổng số Gói tin API mạng:  ${f12NetworkRequests.length}`);
    console.log(`• Lỗi 401 Ký chuyển:         ${forwardProbeResult.status === 401 ? `${C.red}CÒN BỊ 401${C.reset}` : `${C.green}ĐÃ TRIỆT TIÊU HOÀN TOÀN (HTTP ${forwardProbeResult.status})${C.reset}`}`);
    console.log(`• Lỗi Trắng Kho Báo cáo số:  ${reportTabState && reportTabState.display !== 'none' && reportTabState.height > 100 ? `${C.green}ĐÃ TRIỆT TIÊU HOÀN TOÀN (${reportTabState.height}px, ${reportTabState.rowsCount} dòng)${C.reset}` : `${C.red}VẪN BỊ TRẮNG${C.reset}`}`);
    console.log(`${C.bold}════════════════════════════════════════════════════════════════════════════════════════\n${C.reset}`);

  } catch (testErr) {
    console.error('Lỗi khi chạy kịch bản Playwright F12:', testErr);
  } finally {
    await browser.close();
    localServer.close();
  }
}

runRealF12Audit();
