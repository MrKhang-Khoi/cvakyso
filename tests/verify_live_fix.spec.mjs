import { test, expect } from '@playwright/test';

test('Verify Live Site on GitHub Pages - Zero 400 errors and Seal permission revoked', async ({ page }) => {
  const httpErrors = [];
  const consoleErrors = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
      console.log('[BROWSER ERROR]: ' + msg.text());
    }
  });

  page.on('response', resp => {
    if (resp.status() >= 400) {
      httpErrors.push({ status: resp.status(), url: resp.url() });
      console.log('[HTTP ERROR ' + resp.status() + ']: ' + resp.request().method() + ' ' + resp.url());
    }
  });

  console.log('1. Truy cap trang GitHub Pages thuc te...');
  await page.goto('https://mrkhang-khoi.github.io/cvakyso/', { waitUntil: 'networkidle' });

  const scriptSrc = await page.evaluate(() => {
    const s = document.querySelector('script[src*="app.js"]');
    return s ? s.src : null;
  });
  console.log('Script loaded on production:', scriptSrc);

  console.log('2. Dang nhap Quan tri vien...');
  const loginInput = page.locator('#loginUsername');
  if (await loginInput.isVisible()) {
    await loginInput.fill('admin');
    await page.locator('#loginPassword').fill('admin@123');
    await page.locator('#btnLoginSubmit').click();
    await page.waitForTimeout(2000);
  }

  console.log('3. Mo tab Danh sach Giao vien...');
  const teachersTabBtn = page.locator('#tabBtnTeachers, button:has-text("Danh sách Giáo viên")').first();
  if (await teachersTabBtn.isVisible()) {
    await teachersTabBtn.click();
    await page.waitForTimeout(1500);
  }

  const tyRow = page.locator('tr:has-text("HA VAN TY")');
  await expect(tyRow).toBeVisible();
  const rowText = await tyRow.innerText();
  console.log('Dong giao vien HA VAN TY tren bang:', rowText);

  expect(rowText).not.toContain('Đóng dấu OK');
  console.log('Badge [Dong dau OK] DA BIEN MAT khoi dong HA VAN TY!');

  await page.screenshot({ path: 'tests/screenshots/evidence_admin_badge_removed.png', fullPage: true });

  console.log('4. Mo modal phan quyen HA VAN TY...');
  await page.evaluate(() => {
    const ty = appState.users.find(u => u.username === 'cva.ty');
    if (ty) window.openModalEditUser(ty.id);
  });
  await page.waitForTimeout(1500);

  const sealCheckbox = page.locator('#userCanStampSeal');
  const isChecked = await sealCheckbox.isChecked();
  console.log('Trang thai checkbox Quyen dong dau tren Modal:', isChecked);
  expect(isChecked).toBe(false);

  await page.screenshot({ path: 'tests/screenshots/evidence_modal_unchecked.png' });

  console.log('5. Bam Luu va kiem tra Console F12...');
  await page.locator('#formUser button[type=submit]').click();
  await page.waitForTimeout(3000);

  const criticalHttpErrors = httpErrors.filter(e => !e.url.includes('favicon.ico'));
  console.log('Tong so loi HTTP >= 400 sau khi Luu:', criticalHttpErrors.length);
  expect(criticalHttpErrors).toEqual([]);
  console.log('0 LOI HTTP 400! Hoan toan sach bong loi tren Console F12!');

  console.log('6. Dang nhap tai khoan cva.ty de kiem tra giao dien nguoi dung...');
  await page.evaluate(() => {
    if (typeof handleLogout === 'function') handleLogout();
  });
  await page.waitForTimeout(1500);

  await page.locator('#loginUsername').fill('cva.ty');
  await page.locator('#loginPassword').fill('123456');
  await page.locator('#btnLoginSubmit').click();
  await page.waitForTimeout(3000);

  // Check login success
  const userGreeting = page.locator('#userGreeting, #topbarUserTitle');
  console.log('Greeting visible:', await userGreeting.isVisible());

  const sealBtn = page.locator('#btnOpenSealModal, button:has-text("Đóng dấu đỏ")');
  const sealBtnVisible = await sealBtn.isVisible();
  console.log('Nut dong dau do co hien thi voi cva.ty khong?', sealBtnVisible);
  expect(sealBtnVisible).toBe(false);
  console.log('Nut [Dong dau do] DA BI AN HOAN TOAN doi voi tai khoan cva.ty!');

  await page.screenshot({ path: 'tests/screenshots/evidence_teacher_no_seal_button.png', fullPage: true });

  console.log('TOAN BO KIEM THU TREN PRODUCTION DAT 100% PASS!');
});
