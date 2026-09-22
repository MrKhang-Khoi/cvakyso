import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const artifactDir = path.resolve('C:/Users/HPZBook/.gemini/antigravity/brain/287d173b-7c06-47d6-8969-b9c95c30858a');
if (!fs.existsSync(artifactDir)) fs.mkdirSync(artifactDir, { recursive: true });

async function runTest() {
  console.log('🚀 [TEST] Khởi chạy kiểm thử nghiêm ngặt quét USB Token BGH & Đối soát CCCD...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // Mô phỏng EduSign Agent với 2 chứng thư: Hà Văn Tý (Virtual CSP) và Nguyễn Văn Hiền (Hardware RSA)
  // để kiểm thử chuẩn xác khả năng loại trừ Virtual CSP và đối soát CCCD phần cứng
  await page.route('**/api/check-vgca-status*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        tokenConnected: true,
        cspHealthy: true,
        hasCspError: false,
        certInfo: {
          serialNumber: '15FA69CF7ACCCC76',
          thumbprint: 'AABBCCDDEEFF0011223344556677889900AABBCC',
          signerName: 'Nguyễn Văn Hiền',
          email: 'nvhien-dakha@quangngai.gov.vn',
          cccd: '042084009999',
          subject: 'E=nvhien-dakha@quangngai.gov.vn, CN=Nguyễn Văn Hiền, OU=TRƯỜNG TRUNG HỌC CƠ SỞ CHU VĂN AN, O=ỦY BAN NHÂN DÂN TỈNH QUẢNG NGÃI, C=VN',
          issuer: 'CN=CA phục vụ các cơ quan Nhà nước G2, O=Ban Cơ yếu Chính phủ, C=VN',
          notAfter: '2031-12-31 23:59:59',
          isHardware: true,
          keyAlgorithm: 'RSA'
        },
        availableCerts: [
          {
            serialNumber: '7C4C44A8671300AE',
            thumbprint: '6398E3DC37E44EBBF976DFDE9F0143E1BDA5346D',
            signerName: 'Hà Văn Tý',
            email: 'hvty-dakha@quangngai.gov.vn',
            isHardware: false,
            keyAlgorithm: 'ECDSA'
          },
          {
            serialNumber: '15FA69CF7ACCCC76',
            thumbprint: 'AABBCCDDEEFF0011223344556677889900AABBCC',
            signerName: 'Nguyễn Văn Hiền',
            email: 'nvhien-dakha@quangngai.gov.vn',
            cccd: '042084009999',
            subject: 'E=nvhien-dakha@quangngai.gov.vn, CN=Nguyễn Văn Hiền, OU=TRƯỜNG TRUNG HỌC CƠ SỞ CHU VĂN AN, O=ỦY BAN NHÂN DÂN TỈNH QUẢNG NGÃI, C=VN',
            issuer: 'CN=CA phục vụ các cơ quan Nhà nước G2, O=Ban Cơ yếu Chính phủ, C=VN',
            notAfter: '2031-12-31 23:59:59',
            isHardware: true,
            keyAlgorithm: 'RSA'
          }
        ]
      })
    });
  });

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
      console.log('   🔴 Console Error:', msg.text());
    }
  });

  page.on('pageerror', err => {
    consoleErrors.push(err.message);
    console.log('   💥 Page Error:', err.message);
  });

  const htmlPath = 'file:///' + path.resolve(__dirname, '..', 'index.html').replace(/\\/g, '/');
  console.log('   Navigating to:', htmlPath);

  // 1. Đăng nhập Admin qua UI
  console.log('📌 1. Đăng nhập quản trị viên Admin...');
  await page.goto(htmlPath, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);
  const usernameInput = page.locator('#loginUsername');
  if (await usernameInput.isVisible()) {
    await usernameInput.fill('admin');
    await page.locator('#loginPassword').fill('admin@123');
    await page.locator('#btnLoginSubmit').click();
    await page.waitForTimeout(1200);
  }

  // 2. Mở Modal Thêm/Sửa Giáo viên
  console.log('📌 2. Mở Modal Thêm/Sửa Giáo viên...');
  await page.evaluate(() => {
    window.openModalCreateUser();
    const roleSel = document.getElementById('userRole');
    if (roleSel) {
      roleSel.value = 'BGH';
      window.updateBghBoxVisibility();
    }
    const radios = document.getElementsByName('userSignType');
    radios.forEach(r => {
      if (r.value === 'USB_TOKEN') r.checked = true;
    });
    window.updateBghBoxVisibility();
    document.getElementById('userFullName').value = 'Ngô Thị Liền';
    document.getElementById('userUsername').value = 'cva.lien';
    document.getElementById('userCccd').value = '';
  });
  await page.waitForTimeout(500);

  // 3. Test Case 1: Quét khi CHƯA NHẬP CCCD (BẮT BUỘC PHẢI CHẶN)
  console.log('📌 3. Kiểm tra quét USB khi CHƯA NHẬP CCCD (bắt buộc phải chặn)...');
  await page.evaluate(() => window.scanUsbTokenForModalUser());
  await page.waitForTimeout(500);

  const alertRequireCccdText = await page.evaluate(() => {
    const el = document.getElementById('modalAlertMessage') || document.getElementById('bghUsbScanAlert');
    return el ? el.innerText : '';
  });
  console.log('   Thông báo khi thiếu CCCD:', alertRequireCccdText.substring(0, 80) + '...');

  if (!alertRequireCccdText.includes('CCCD') && !alertRequireCccdText.includes('YÊU CẦU')) {
    throw new Error('THẤT BẠI: Hệ thống không chặn khi chưa nhập CCCD!');
  }
  console.log('   ✅ [PASS] Hệ thống đã chặn thành công và yêu cầu nhập CCCD trước khi quét!');

  // Chụp ảnh bằng chứng chặn khi chưa nhập CCCD
  await page.screenshot({
    path: path.join(artifactDir, 'evidence_fig3_require_cccd_alert.png'),
    fullPage: true
  });

  // Đóng modal alert
  await page.evaluate(() => {
    if (typeof window.closeModalAlert === 'function') window.closeModalAlert();
  });
  await page.waitForTimeout(300);

  // 4. Test Case 2: Nhập CCCD của Ngô Thị Liền (042084002100)
  // Thực tế thiết bị đang cắm trên máy là của [Nguyễn Văn Hiền] (15FA69CF7ACCCC76)
  // Hệ thống PHẢI NHẬN DIỆN ĐÚNG Nguyễn Văn Hiền (KHÔNG ĐƯỢC NHẬN HÀ VĂN TÝ)
  // và BÁO LỖI CẮM NHẦM TOKEN CỦA NGƯỜI KHÁC!
  console.log('📌 4. Nhập CCCD Ngô Thị Liền (042084002100) & Quét USB Token thực tế...');
  await page.evaluate(() => {
    document.getElementById('userCccd').value = '042084002100';
  });

  await page.evaluate(async () => {
    await window.scanUsbTokenForModalUser();
  });
  await page.waitForTimeout(1000);

  const scanMismatchText = await page.evaluate(() => {
    const el = document.getElementById('modalAlertMessage') || document.getElementById('bghUsbScanAlert');
    return el ? el.innerText : '';
  });
  console.log('   Kết quả quét đối soát:\n', scanMismatchText);

  const hasDetectedHien = scanMismatchText.includes('Nguyễn Văn Hiền') || scanMismatchText.includes('15FA69CF7ACCCC76');
  const hasWrongTy = scanMismatchText.includes('Hà Văn Tý');

  console.log(`   - Nhận diện đúng Nguyễn Văn Hiền: ${hasDetectedHien ? 'ĐÚNG ✅' : 'SAI ❌'}`);
  console.log(`   - Nhận diện nhầm Hà Văn Tý: ${hasWrongTy ? 'BỊ NHẦM ❌' : 'KHÔNG BỊ NHẦM (CHUẨN) ✅'}`);

  if (hasWrongTy) {
    throw new Error('THẤT BẠI: Vẫn bị nhận nhầm thông tin Hà Văn Tý từ Virtual CSP!');
  }
  if (!hasDetectedHien) {
    throw new Error('THẤT BẠI: Không nhận diện được thiết bị phần cứng thực tế Nguyễn Văn Hiền!');
  }

  const filledSerial = await page.evaluate(() => document.getElementById('userCertSerial')?.value || '');
  console.log(`   - Số Serial gán vào form: "${filledSerial}" (Phải rỗng vì cắm nhầm)`);
  if (filledSerial !== '') {
    throw new Error('THẤT BẠI: Vẫn tự động gán serial khi cắm nhầm token của người khác!');
  }
  console.log('   ✅ [PASS] Hệ thống từ chối gán Serial và báo cảnh báo cắm nhầm Token của người khác chính xác 100%!');

  // Chụp ảnh bằng chứng
  await page.screenshot({
    path: path.join(artifactDir, 'evidence_fig3_strict_hien_detected.png'),
    fullPage: true
  });

  // Đóng modal alert cảnh báo cắm nhầm trước khi sang bước 5
  await page.evaluate(() => {
    if (typeof window.closeModalAlert === 'function') window.closeModalAlert();
  });
  await page.waitForTimeout(400);

  // 5. Test Case 3: Cấu hình đúng Nguyễn Văn Hiền
  console.log('📌 5. Cấu hình đúng tài khoản Thầy Nguyễn Văn Hiền...');
  await page.evaluate(async () => {
    document.getElementById('userFullName').value = 'Nguyễn Văn Hiền';
    document.getElementById('userUsername').value = 'cva.hien';
    document.getElementById('userCccd').value = '042084009999';
    await window.scanUsbTokenForModalUser();
  });
  await page.waitForTimeout(800);

  const filledSerialAfterMatch = await page.evaluate(() => document.getElementById('userCertSerial')?.value || '');
  console.log(`   - Số Serial khi khớp đúng Nguyễn Văn Hiền: "${filledSerialAfterMatch}"`);

  if (filledSerialAfterMatch !== '15FA69CF7ACCCC76') {
    throw new Error(`THẤT BẠI: Không điền đúng serial 15FA69CF7ACCCC76 của Nguyễn Văn Hiền! Nhận được: ${filledSerialAfterMatch}`);
  }
  console.log('   ✅ [PASS] Khi đúng Thầy Nguyễn Văn Hiền, đã nhận diện và tự động điền 15FA69CF7ACCCC76 thành công!');

  // Chụp ảnh bằng chứng thành công
  await page.screenshot({
    path: path.join(artifactDir, 'evidence_fig3_success_hien_matched.png'),
    fullPage: true
  });

  // 6. Kiểm tra Console Error
  console.log('📌 6. Kiểm tra Console Errors F12...');
  const fatalErrors = consoleErrors.filter(e => !e.includes('favicon.ico'));
  console.log(`   Tổng số lỗi Console: ${fatalErrors.length}`);
  if (fatalErrors.length > 0) {
    console.log('   Các lỗi:', fatalErrors);
    throw new Error('Có lỗi trong Console F12!');
  }
  console.log('   ✅ [PASS] Console F12 hoàn toàn sạch lỗi (Zero-Bug)!');

  await browser.close();
  console.log('🎉 TẤT CẢ KIỂM THỬ PLAYWRIGHT BGH USB TOKEN ĐỐI SOÁT CCCD PASS 100%!');
}

runTest().catch(err => {
  console.error('❌ LỖI KIỂM THỬ:', err);
  process.exit(1);
});
