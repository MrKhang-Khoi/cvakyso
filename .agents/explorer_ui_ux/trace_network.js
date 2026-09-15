const { chromium } = require('playwright');
const cp = require('child_process');
const path = require('path');

(async () => {
  const server = cp.spawn('node', ['server.js'], { cwd: path.join(__dirname, '../..') });
  server.stdout.on('data', d => console.log('SERVER:', d.toString().trim()));
  server.stderr.on('data', d => console.error('SERVER ERR:', d.toString().trim()));
  await new Promise(r => setTimeout(r, 2500));

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on('response', res => {
    if (res.status() >= 400) {
      console.log(`[STATUS ${res.status()}] URL: ${res.url()}`);
    }
  });

  page.on('console', msg => {
    console.log(`[CONSOLE ${msg.type()}] ${msg.text()}`);
  });

  console.log('Loading index.html...');
  await page.goto('http://localhost:3000/index.html', { waitUntil: 'networkidle' });

  console.log('Loading portal-baocao.html...');
  await page.goto('http://localhost:3000/portal-baocao.html', { waitUntil: 'networkidle' });

  await browser.close();
  server.kill();
  process.exit(0);
})();
