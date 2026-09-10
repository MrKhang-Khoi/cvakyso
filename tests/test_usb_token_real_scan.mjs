import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  const consoleLogs = [];
  const pageErrors = [];
  page.on('console', msg => consoleLogs.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', err => pageErrors.push(err.toString()));

  console.log('1. Navigating to http://localhost:3000...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

  // 1. Đăng nhập tài khoản Admin / BGH
  console.log('2. Logging in as admin...');
  const usernameInput = page.locator('#loginUsername');
  if (await usernameInput.isVisible()) {
    await usernameInput.fill('admin');
    await page.locator('#loginPassword').fill('admin@123');
    await page.locator('#btnLoginSubmit').click();
    await page.waitForTimeout(1500);
  }

  // 2. Mở Modal Người dùng cho Nguyễn Văn Hiền
  console.log('3. Opening modal for user Nguyen Van Hien...');
  await page.evaluate(() => {
    if (typeof window.openModalCreateUser === 'function') {
      window.openModalCreateUser();
    }
  });
  await page.waitForTimeout(500);

  // 3. Cấu hình thông tin Nguyễn Văn Hiền và chọn USB Token
  console.log('4. Setting up Nguyen Van Hien details and USB_TOKEN...');
  await page.evaluate(() => {
    const nameInp = document.getElementById('userFullName');
    const cccdInp = document.getElementById('userCccd');
    const userInp = document.getElementById('userUsername');
    if (nameInp) nameInp.value = 'Nguyễn Văn Hiền';
    if (cccdInp) cccdInp.value = '040077003374';
    if (userInp) userInp.value = 'cva.nvhien';

    const radios = document.getElementsByName('userSignType');
    radios.forEach(r => { if (r.value === 'USB_TOKEN') r.checked = true; });
    if (typeof window.updateBghBoxVisibility === 'function') {
      window.updateBghBoxVisibility();
    }
  });
  await page.waitForTimeout(500);

  // 4. Bấm nút "🔍 Quét USB đang cắm" (gọi scanUsbTokenForModalUser kết nối thực tế tới EduSign Agent 18888)
  console.log('5. Clicking scan USB token (real hardware query to port 18888)...');
  await page.evaluate(async () => {
    await window.scanUsbTokenForModalUser();
  });

  // Chờ phản hồi từ EduSign Agent
  console.log('6. Waiting for EduSign Agent response...');
  await page.waitForTimeout(3000);

  // 5. Đọc kết quả từ DOM
  const scanResult = await page.evaluate(() => {
    const alertBox = document.getElementById('bghUsbScanAlert');
    const serialInp = document.getElementById('userCertSerial');
    const nameInp = document.getElementById('userFullName');
    const cccdInp = document.getElementById('userCccd');
    return {
      alertText: alertBox ? alertBox.innerText.trim() : '',
      alertClass: alertBox ? alertBox.className : '',
      alertVisible: alertBox ? !alertBox.classList.contains('hidden') : false,
      serialValue: serialInp ? serialInp.value : '',
      userName: nameInp ? nameInp.value : '',
      userCccd: cccdInp ? cccdInp.value : ''
    };
  });

  console.log('Scan result on UI:', scanResult);

  // 6. Chụp ảnh minh chứng thực tế trên Web
  const artifactDir = 'C:\\Users\\HPZBook\\.gemini\\antigravity\\brain\\def6f1ba-143d-482d-8668-df8d3eff8a68';
  const screenshotPath = path.join(artifactDir, 'evidence_real_usb_token_scan_success.png');
  await page.screenshot({ path: screenshotPath, fullPage: false });
  console.log('Screenshot saved to:', screenshotPath);

  // Sao chép ảnh sang thư mục scratch
  fs.copyFileSync(screenshotPath, path.join(artifactDir, 'scratch', 'evidence_real_usb_token_scan_success.png'));

  await browser.close();

  // 7. Kiểm tra kết quả
  const isSerialCorrect = scanResult.serialValue === '15FA69CF7ACCCC76';
  const isAlertSuccess = scanResult.alertText.includes('XÁC THỰC THÀNH CÔNG');
  const isOwnerCorrect = scanResult.alertText.includes('Nguyễn Văn Hiền');
  const isPass = isSerialCorrect && isAlertSuccess && isOwnerCorrect;

  console.log(`\n================ TEST VERIFICATION REPORT ================`);
  console.log(`1. Serial input filled: [${scanResult.serialValue}] (Expected: 15FA69CF7ACCCC76) -> ${isSerialCorrect ? 'PASSED' : 'FAILED'}`);
  console.log(`2. Alert status: ${scanResult.alertVisible ? 'VISIBLE' : 'HIDDEN'}`);
  console.log(`3. Alert text: ${scanResult.alertText}`);
  console.log(`4. Matched owner: ${isOwnerCorrect ? 'PASSED' : 'FAILED'}`);
  console.log(`5. Console errors count: ${pageErrors.length}`);
  console.log(`VERIFICATION RESULT: ${isPass ? 'PASS 100%' : 'FAIL'}`);
  console.log(`==========================================================\n`);

  if (!isPass) {
    process.exit(1);
  }
})();
