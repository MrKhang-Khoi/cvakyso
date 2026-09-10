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
    if (resp.status() >= 400 && !resp.url().includes('favicon.ico')) {
      httpErrors.push({ status: resp.status(), url: resp.url(), method: resp.request().method() });
      console.log(`[HTTP ERROR ${resp.status()}]: ${resp.request().method()} ${resp.url()}`);
    }
  });

  console.log('1. Truy cap trang GitHub Pages thuc te...');
  await page.goto('https://mrkhang-khoi.github.io/cvakyso/', { waitUntil: 'networkidle' });

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

  console.log('4. Mo modal sua thong tin HA VAN TY de huy quyen dong dau...');
  await page.evaluate(() => {
    const ty = appState.users.find(u => u.username === 'cva.ty');
    if (ty) window.openModalEditUser(ty.id);
  });
  await page.waitForTimeout(1500);

  const sealCheckbox = page.locator('#userCanStampSeal');
  await expect(sealCheckbox).toBeVisible();

  // Bo chon quyen dong dau
  if (await sealCheckbox.isChecked()) {
    await sealCheckbox.uncheck();
  }
  expect(await sealCheckbox.isChecked()).toBe(false);

  // Chup anh modal khi da bo tich
  await page.screenshot({ path: 'tests/screenshots/evidence_modal_unchecked.png' });

  // 5. Bam Luu va kiem tra loi
  console.log('5. Bam Luu thong tin va kiem tra Console F12...');
  await page.locator('#formUser button[type=submit]').click();
  await page.waitForTimeout(3000);

  // Doi soat 0 loi HTTP >= 400
  console.log('Tong so loi HTTP >= 400 sau khi Luu:', httpErrors.length);
  expect(httpErrors).toEqual([]);
  console.log('0 LOI HTTP! Hoan toan sach bong loi tren Console F12!');

  // 6. Kiem tra bang sau khi luu: badge [Dong dau OK] phai bien mat
  console.log('6. Kiem tra badge tren dong HA VAN TY...');
  await page.waitForTimeout(1500);
  const updatedRowText = await tyRow.innerText();
  console.log('Dong giao vien HA VAN TY sau khi luu:', updatedRowText);
  expect(updatedRowText).not.toContain('Đóng dấu OK');
  console.log('Badge [Dong dau OK] DA BIEN MAT HOAN TOAN!');

  await page.screenshot({ path: 'tests/screenshots/evidence_admin_badge_removed.png', fullPage: true });

  // 7. Dang nhap tai khoan cva.ty de kiem tra giao dien nguoi dung
  console.log('7. Dang nhap tai khoan cva.ty de kiem tra giao dien nguoi dung...');
  await page.evaluate(() => {
    if (typeof handleLogout === 'function') handleLogout();
  });
  await page.waitForTimeout(1500);

  await page.locator('#loginUsername').fill('cva.ty');
  await page.locator('#loginPassword').fill('123456');
  await page.locator('#btnLoginSubmit').click();
  await page.waitForTimeout(2500);

  const sealBtn = page.locator('#btnOpenSealModal, button:has-text("Đóng dấu đỏ")');
  const sealBtnVisible = await sealBtn.isVisible();
  console.log('Nut dong dau do co hien thi voi cva.ty khong?', sealBtnVisible);
  expect(sealBtnVisible).toBe(false);
  console.log('Nut [Dong dau do] DA BI AN HOAN TOAN doi voi tai khoan cva.ty!');

  await page.screenshot({ path: 'tests/screenshots/evidence_teacher_no_seal_button.png', fullPage: true });

  console.log('TOAN BO KIEM THU DAT 100% PASS!');
});
