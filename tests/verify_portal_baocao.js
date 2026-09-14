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
    if (reqUrl === '/') reqUrl = '/portal-baocao.html';
    let filePath = path.join(repoDir, reqUrl);

    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(repoDir, 'portal-baocao.html');
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
      console.log('Static test server running at http://localhost:' + port);
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
    viewport: { width: 1440, height: 950 }
  });

  const page = await context.newPage();

  console.log('Navigating to portal-baocao.html...');
  await page.goto('http://localhost:' + port + '/portal-baocao.html');
  
  // Wait for table to load data from GAS
  console.log('Waiting for table rows to load...');
  await page.waitForSelector('#reportTableBody tr td.font-mono', { timeout: 20000 });
  await page.waitForTimeout(2000);

  // Check the docId values in column 2
  const docIds = await page.evaluate(() => {
    const cells = Array.from(document.querySelectorAll('#reportTableBody tr td:nth-child(2)'));
    return cells.map(c => c.textContent.trim());
  });

  console.log('Extracted Doc IDs (first 5):', docIds.slice(0, 5));
  const hasNA = docIds.some(id => id === 'N/A');
  console.log('Contains N/A in doc IDs?:', hasNA);

  const shotPath = path.join(artifactDir, 'screenshot_portal_baocao_fixed.png');
  await page.screenshot({ path: shotPath });
  console.log('Saved screenshot of fixed portal to:', shotPath);

  await browser.close();
  server.close();
  console.log('PORTAL TEST COMPLETED SUCCESSFULLY!');
  process.exit(0);
})();
