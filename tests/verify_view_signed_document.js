const { chromium } = require('@playwright/test');
const http = require('http');
const fs = require('fs');
const path = require('path');

const repoDir = 'C:\\Users\\HPZBook\\Desktop\\KÝ SỐ';
const artifactDir = 'C:\\Users\\HPZBook\\.gemini\\antigravity\\brain\\da4b5807-19a0-4949-9631-951f921d598b';

function startStaticServer(port = 8899) {
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf'
  };

  const server = http.createServer((req, res) => {
    let reqUrl = req.url.split('?')[0];
    if (reqUrl === '/') reqUrl = '/index.html';
    let filePath = path.join(repoDir, reqUrl);

    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(repoDir, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(500);
        res.end('Error loading ' + reqUrl);
      } else {
        res.writeHead(200, { 'Content-Type': contentType, 'Access-Control-Allow-Origin': '*' });
        res.end(content);
      }
    });
  });

  return new Promise((resolve) => {
    server.listen(port, () => {
      resolve(server);
    });
  });
}

(async () => {
  const port = 8899;
  const server = await startStaticServer(port);

  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-web-security']
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 }
  });

  const page = await context.newPage();

  await page.goto('http://localhost:' + port + '/index.html');

  await page.evaluate(() => {
    const testUser = {
      id: "user_cvaty",
      username: "cva.ty",
      fullName: "Hà Văn Tý",
      role: "TEACHER",
      roleTitle: "Giáo viên",
      department: "Tổ Toán - Tin",
      departmentId: "dept_toantin",
      phone: "0818810007",
      email: "tyhv@thcschuvanan.edu.vn"
    };
    localStorage.setItem('edusign_user', JSON.stringify(testUser));
    localStorage.setItem('edusign_token', 'test_dummy_token');
  });

  await page.goto('http://localhost:' + port + '/index.html');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);

  await page.click('#tabBtnTeacherSent');
  await page.waitForTimeout(2000);

  const btn = page.locator("button[onclick*='BC-2026-TONTIN-175742']").first();
  await btn.waitFor({ state: 'visible', timeout: 8000 });
  await btn.click();

  const viewerModal = page.locator('#modalDocViewer');
  await viewerModal.waitFor({ state: 'visible', timeout: 15000 });

  await page.waitForTimeout(6000);

  // Scroll down to the bottom of the PDF viewer modal content
  await page.evaluate(() => {
    const container = document.querySelector('#modalDocViewer .overflow-y-auto') || 
                      document.querySelector('#modalDocViewer .overflow-auto') ||
                      document.getElementById('pdfViewerContainer') ||
                      document.getElementById('pdfViewer');
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
    window.scrollTo(0, document.body.scrollHeight);
  });

  await page.waitForTimeout(1500);

  const viewerShotPath = path.join(artifactDir, 'screenshot_viewer_with_signatures_bottom.png');
  await page.screenshot({ path: viewerShotPath });
  console.log('Saved screenshot of signatures to:', viewerShotPath);

  await browser.close();
  server.close();
  console.log('SCROLL TEST COMPLETED!');
  process.exit(0);
})();
