const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('response', resp => {
    if (resp.status() >= 400) {
      console.log(`[HTTP ${resp.status()}] ${resp.url()}`);
    }
  });

  console.log('Testing index.html network calls...');
  await page.goto('http://localhost:3000/index.html', { waitUntil: 'networkidle' });

  console.log('Testing portal-baocao.html network calls...');
  await page.goto('http://localhost:3000/portal-baocao.html', { waitUntil: 'networkidle' });

  await browser.close();
})();
