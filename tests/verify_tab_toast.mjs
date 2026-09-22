import { chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import http from 'http';
import fs from 'fs';

async function main() {
  const rootDir = path.resolve(__dirname, '..');
  const server = http.createServer((req, res) => {
    let reqPath = req.url.split('?')[0];
    if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
    const filePath = path.join(rootDir, reqPath);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      if (filePath.endsWith('.html')) res.setHeader('Content-Type', 'text/html; charset=utf-8');
      if (filePath.endsWith('.js')) res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      if (filePath.endsWith('.css')) res.setHeader('Content-Type', 'text/css');
      res.setHeader('Access-Control-Allow-Origin', '*');
      fs.createReadStream(filePath).pipe(res);
    } else {
      res.statusCode = 404;
      res.end('Not Found');
    }
  });

  await new Promise(resolve => server.listen(4088, '127.0.0.1', resolve));

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await context.newPage();

  await page.goto('http://127.0.0.1:4088');
  await page.evaluate(() => {
    const user = {
      id: 'cva.lien',
      username: 'cva.lien',
      fullName: 'Ngô Thị Liền',
      role: 'TEACHER',
      roleTitle: 'Giáo viên',
      department: 'Tổ Toán'
    };
    localStorage.setItem('edusign_user', JSON.stringify(user));
    localStorage.setItem('edusign_token', 'mock_token');
  });
  await page.reload();
  await page.waitForTimeout(1000);

  await page.evaluate(() => {
    if (typeof showView === 'function') showView('teacher');
  });
  await page.waitForTimeout(1000);

  // Take screenshot of tab bar
  const tabBar = await page.$('#tabBtnTeacherWorkspace');
  if (tabBar) {
    const barParent = await page.evaluateHandle(() => {
      return document.getElementById('tabBtnTeacherWorkspace').closest('.border-b');
    });
    if (barParent) {
      await barParent.asElement().screenshot({ path: path.join(__dirname, 'screenshots', 'tab_bar_new_1366.png') });
      console.log('Saved tab bar screenshot: tests/screenshots/tab_bar_new_1366.png');
    }
  }

  // Click on Kho Bao Cao tab
  await page.click('#tabBtnTeacherReports');
  await page.waitForTimeout(500);

  // Trigger 3 toasts rapidly to test toast manager max-2 limit & de-duplication
  await page.evaluate(() => {
    showToast('Thông báo 1: Đã duyệt hoàn tất báo cáo', 'success');
    showToast('Thông báo 2: Đang tải tệp về máy', 'info');
    showToast('Thông báo 3: Dữ liệu đã được cập nhật', 'success');
  });
  await page.waitForTimeout(300);

  const toastCount = await page.evaluate(() => {
    return document.querySelectorAll('#toastContainer > div').length;
  });
  console.log('Active toasts in container (expected <= 2):', toastCount);

  // Also take screenshot of tab bar when Kho Bao Cao is selected
  const barParent2 = await page.evaluateHandle(() => {
    return document.getElementById('tabBtnTeacherReports').closest('.border-b');
  });
  if (barParent2) {
    await barParent2.asElement().screenshot({ path: path.join(__dirname, 'screenshots', 'tab_bar_reports_active_1366.png') });
    console.log('Saved tab bar reports active: tests/screenshots/tab_bar_reports_active_1366.png');
  }

  await page.screenshot({ path: path.join(__dirname, 'screenshots', 'full_page_new_tab_and_toast.png') });
  console.log('Saved full page screenshot: tests/screenshots/full_page_new_tab_and_toast.png');

  await browser.close();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
