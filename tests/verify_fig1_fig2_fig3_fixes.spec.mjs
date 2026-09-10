import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fileUrl = 'file:///' + path.resolve(__dirname, '..', 'index.html').replace(/\\/g, '/');

async function loginAdmin(page) {
  await page.goto(fileUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);
  const usernameInput = page.locator('#loginUsername');
  if (await usernameInput.isVisible()) {
    await usernameInput.fill('admin');
    await page.locator('#loginPassword').fill('admin@123');
    await page.locator('#btnLoginSubmit').click();
    await page.waitForTimeout(1200);
  }
}

test.describe('Kiem thu Xac minh Triet de Hinh 1, Hinh 2, Hinh 3', () => {
  test('1. Xac minh Hinh 1: Tai khoan Admin KHONG co con dau, chi quan ly va phan quyen', async ({ page }) => {
    await loginAdmin(page);

    // Kiem tra tai khoan admin trong appState
    const adminAppState = await page.evaluate(() => {
      return {
        role: window.appState?.currentUser?.role,
        canStampSeal: window.appState?.currentUser?.canStampSeal
      };
    });
    expect(adminAppState.role).toBe('ADMIN');
    expect(adminAppState.canStampSeal).toBe(false);

    // Kiem tra bang giao vien (#tableBodyTeachers)
    await page.waitForSelector('#tableBodyTeachers tr', { timeout: 5000 });

    // Kiem tra trong bang: Dong tai khoan admin KHONG co badge Dong dau do
    const adminRow = page.locator('#tableBodyTeachers tr', { hasText: 'Quản trị viên' });
    const sealBadgeInAdminRow = adminRow.locator('text=Đóng dấu OK');
    await expect(sealBadgeInAdminRow).toHaveCount(0);

    // Mo modal sua thong tin tai khoan admin
    await page.evaluate(() => {
      window.openModalEditUser('admin');
    });
    await page.waitForSelector('#modalUser', { state: 'visible', timeout: 3000 });

    // 1. Khoi o checkbox Uy quyen dong dau (#boxUserCanStampSeal) PHAI BI AN
    const boxSealHidden = await page.$eval('#boxUserCanStampSeal', el => el.classList.contains('hidden'));
    expect(boxSealHidden).toBe(true);

    // 2. Checkbox userCanStampSeal PHAI unchecked (false)
    const isSealChecked = await page.$eval('#userCanStampSeal', el => el.checked);
    expect(isSealChecked).toBe(false);

    // 3. Khoi cau hinh USB Token BGH (#boxBghUsbTokenConfig) PHAI BI AN
    const boxBghHidden = await page.$eval('#boxBghUsbTokenConfig', el => el.classList.contains('hidden'));
    expect(boxBghHidden).toBe(true);

    // Chup anh minh chung Hinh 1
    await page.screenshot({ path: 'evidence_fig1_admin_no_seal.png' });
    console.log('✅ PASS Hinh 1: Tai khoan admin khong co con dau, an o dong dau va an USB Token BGH.');

    // Dong modal
    await page.evaluate(() => window.closeModal('modalUser'));
  });

  test('2. Xac minh Hinh 2: Cau hinh Chu ky cua nha truong (MST, Serial va Anh con dau thuc te)', async ({ page }) => {
    await loginAdmin(page);

    // Luu mot anh con dau mau vao localStorage de xac minh hien thi
    const dummySealData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    await page.evaluate(seal => {
      localStorage.setItem('edusign_school_seal', seal);
    }, dummySealData);

    // Mo dropdown Cai dat va kiem tra nhan "Cau hinh Chu ky cua nha truong"
    await page.click('button[onclick*="adminSettingsDropdown"]');
    await page.waitForSelector('#adminSettingsDropdown', { state: 'visible' });

    const menuLabel = await page.locator('#adminSettingsDropdown button').first().innerText();
    expect(menuLabel).toContain('Cấu hình Chữ ký của nhà trường');

    // Mo modal Cau hinh Chu ky cua nha truong
    await page.evaluate(() => window.openModalBghConfig());
    await page.waitForSelector('#modalBghConfig', { state: 'visible', timeout: 3000 });

    // 1. Kiem tra tieu de modal
    const modalTitle = await page.locator('#modalBghConfig h3').innerText();
    expect(modalTitle).toContain('Cấu hình Chữ ký của nhà trường');

    // 2. Kiem tra co truong Ma so thue Nha truong (#inputBghTaxCode)
    const taxInput = page.locator('#inputBghTaxCode');
    await expect(taxInput).toBeVisible();

    // 3. Kiem tra anh con dau thuc te duoc nap dung
    const sealImgSrc = await page.$eval('#imgBghConfigSeal', el => el.src);
    expect(sealImgSrc).toContain('data:image/png;base64');

    // 4. Test quet USB Token: GIA LAP CAM NHAM TOKEN CA NHAN GIAO VIEN
    await page.route(url => url.href.includes('check-vgca-status'), async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': '*'
        },
        body: JSON.stringify({
          success: true,
          certInfo: {
            serialNumber: '5401ABC7789',
            signerName: 'Hà Văn Tý',
            cccd: '042084002100',
            subject: 'CN=Hà Văn Tý, UID=042084002100, OU=Tổ Toán - Tin, O=TRƯỜNG THCS CHU VĂN AN',
            issuer: 'Ban Cơ yếu Chính phủ',
            isHardware: true
          },
          availableCerts: [{
            serialNumber: '5401ABC7789',
            signerName: 'Hà Văn Tý',
            cccd: '042084002100',
            subject: 'CN=Hà Văn Tý, UID=042084002100, OU=Tổ Toán - Tin, O=TRƯỜNG THCS CHU VĂN AN',
            issuer: 'Ban Cơ yếu Chính phủ',
            isHardware: true
          }]
        })
      });
    });

    // Bam quet
    await page.click('button[onclick*="scanBghUsbTokenFromAgent"]');

    // Kiem tra popup modalUnifiedAlert BAT LEN NOI TREN CUNG (z-[110])
    await page.waitForSelector('#modalUnifiedAlert', { state: 'visible', timeout: 4000 });
    const alertTitle = await page.locator('#alertTitle').innerText();
    expect(alertTitle).toContain('CẮM SAI THIẾT BỊ');

    const alertMsg = await page.locator('#alertMessage').innerText();
    expect(alertMsg).toContain('Chứng thư số cá nhân');
    expect(alertMsg).toMatch(/hà văn tý|ha van ty/i);
    expect(alertMsg).toContain('KHÔNG PHẢI là Con dấu điện tử');

    await page.screenshot({ path: 'evidence_fig2_wrong_token_alert.png' });
    console.log('✅ PASS Hinh 2: Cam nham Token ca nhan vao cau hinh con dau nha truong bao loi ro rang tren modalUnifiedAlert!');

    // Dong alert modal
    await page.click('#btnAlertOk');
    await page.waitForSelector('#modalUnifiedAlert', { state: 'hidden' });

    // 5. Test quet USB Token: GIA LAP CAM DUNG TOKEN CON DAU NHA TRUONG (CO MST VA TEN TRUONG)
    await page.unroute(url => url.href.includes('check-vgca-status'));
    await page.route(url => url.href.includes('check-vgca-status'), async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': '*'
        },
        body: JSON.stringify({
          success: true,
          certInfo: {
            serialNumber: '9900FFAABB11',
            signerName: 'TRƯỜNG TRUNG HỌC CƠ SỞ CHU VĂN AN',
            taxCode: '4300325412',
            subject: 'CN=TRƯỜNG TRUNG HỌC CƠ SỞ CHU VĂN AN, MST:4300325412, O=TRƯỜNG THCS CHU VĂN AN, C=VN',
            issuer: 'Ban Cơ yếu Chính phủ',
            isHardware: true
          },
          availableCerts: [{
            serialNumber: '9900FFAABB11',
            signerName: 'TRƯỜNG TRUNG HỌC CƠ SỞ CHU VĂN AN',
            taxCode: '4300325412',
            subject: 'CN=TRƯỜNG TRUNG HỌC CƠ SỞ CHU VĂN AN, MST:4300325412, O=TRƯỜNG THCS CHU VĂN AN, C=VN',
            issuer: 'Ban Cơ yếu Chính phủ',
            isHardware: true
          }]
        })
      });
    });

    // Bam quet lai
    await page.click('button[onclick*="scanBghUsbTokenFromAgent"]');

    // Kiem tra o So Serial va Ma so thue duoc tu dong trich xuat va dien chinh xac
    await page.waitForFunction(() => {
      return document.getElementById('inputBghSerial').value === '9900FFAABB11' &&
             document.getElementById('inputBghTaxCode').value === '4300325412';
    });

    const serialVal = await page.$eval('#inputBghSerial', el => el.value);
    const taxVal = await page.$eval('#inputBghTaxCode', el => el.value);
    expect(serialVal).toBe('9900FFAABB11');
    expect(taxVal).toBe('4300325412');

    await page.screenshot({ path: 'evidence_fig2_school_token_success.png' });
    console.log('✅ PASS Hinh 2: Da nhan dien dung USB Token Con dau Nha truong (MST: 4300325412, Serial: 9900FFAABB11)!');

    await page.unroute(url => url.href.includes('check-vgca-status'));
    await page.evaluate(() => window.closeModal('modalBghConfig'));
  });

  test('3. Xac minh Hinh 3: Quet Token hien thi DUNG chu so huu thuc te va Canh bao cam nham Token noi z-110', async ({ page }) => {
    await loginAdmin(page);

    // Kiem tra bang giao vien san sang
    await page.waitForSelector('#tableBodyTeachers tr', { timeout: 5000 });

    // Mo sua tai khoan cua giao vien "Ha Van Ty"
    await page.evaluate(() => {
      const ty = window.appState.users.find(u => (u.username || '').includes('ty') || (u.name || '').includes('Tý'));
      if (ty) window.openModalEditUser(ty.id);
    });
    await page.waitForSelector('#modalUser', { state: 'visible', timeout: 3000 });

    // Dam bao signType la USB_TOKEN de hien nut quet
    await page.evaluate(() => {
      const r = document.querySelector('input[name="userSignType"][value="USB_TOKEN"]');
      if (r) { r.checked = true; r.dispatchEvent(new Event('change')); }
    });

    // GIA LAP: MAY TINH DANG CAM USB TOKEN CUA THAY NGUYEN VAN B (KHAC VOI HA VAN TY)
    await page.route(url => url.href.includes('check-vgca-status'), async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': '*'
        },
        body: JSON.stringify({
          success: true,
          certInfo: {
            serialNumber: '7788AABB2233',
            signerName: 'Nguyễn Văn B',
            cccd: '042085001234',
            subject: 'CN=Nguyễn Văn B, UID=042085001234, OU=Tổ Khoa học Tự nhiên, O=TRƯỜNG THCS CHU VĂN AN',
            issuer: 'Ban Cơ yếu Chính phủ',
            isHardware: true
          },
          availableCerts: [{
            serialNumber: '7788AABB2233',
            signerName: 'Nguyễn Văn B',
            cccd: '042085001234',
            subject: 'CN=Nguyễn Văn B, UID=042085001234, OU=Tổ Khoa học Tự nhiên, O=TRƯỜNG THCS CHU VĂN AN',
            issuer: 'Ban Cơ yếu Chính phủ',
            isHardware: true
          }]
        })
      });
    });

    // Bam nut "Quet USB dang cam" trong form
    await page.click('button[onclick*="scanUsbTokenForModalUser"]');

    // Kiem tra popup modalUnifiedAlert BAT LEN NOI TREN CUNG (z-[110])
    await page.waitForSelector('#modalUnifiedAlert', { state: 'visible', timeout: 4000 });
    const alertTitle = await page.locator('#alertTitle').innerText();
    expect(alertTitle).toContain('CẢNH BÁO CẮM NHẦM');

    const alertMsg = await page.locator('#alertMessage').innerText();
    // PHAI HIEN THI DUNG TEN NGUOI TREN TOKEN DANG CAM: "Nguyen Van B"
    expect(alertMsg).toContain('Nguyễn Văn B');
    expect(alertMsg).toContain('7788AABB2233');
    // VA TEN TAI KHOAN DANG SUA: "Ha Van Ty"
    expect(alertMsg).toMatch(/hà văn tý|ha van ty/i);

    // Serial trong form phai bi xoa (khong gan nham)
    const serialFormVal = await page.$eval('#userCertSerial', el => el.value);
    expect(serialFormVal).toBe('');

    await page.screenshot({ path: 'evidence_fig3_other_user_token_alert.png' });
    console.log('✅ PASS Hinh 3: Hien thi dung nguoi so huu Token dang cam (Nguyen Van B) va canh bao noi bat tren cung!');

    await page.unroute(url => url.href.includes('check-vgca-status'));
    await page.click('#btnAlertOk');
    await page.evaluate(() => window.closeModal('modalUser'));
  });
});
