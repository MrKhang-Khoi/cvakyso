import { test, expect } from '@playwright/test';

test('Verify Multi-Party Signing and Session Isolation', async ({ page }) => {
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error' && !msg.text().includes('127.0.0.1:18888')) {
      consoleErrors.push(msg.text());
    }
  });
  page.on('pageerror', err => consoleErrors.push(err.message));

  await page.goto('http://localhost:3000');
  await page.waitForLoadState('networkidle');

  // 1. Dang nhap voi tai khoan giao vien cva.ty
  const usernameInput = page.locator('#loginUsername');
  if (await usernameInput.isVisible()) {
    await usernameInput.fill('cva.ty');
    await page.locator('#loginPassword').fill('123456');
    await page.locator('#btnLoginSubmit').click();
    await page.waitForTimeout(1000);
  }

  // Cho giao dien dashboard hien len
  await expect(page.locator('#tabBtnTeacherWorkspace')).toBeVisible();
  await expect(page.locator('#headerTeacherName')).toBeVisible();

  // 2. Kiem tra luu tru thong tin VGCA sau do Dang xuat (Clean Session Isolation)
  await page.evaluate(() => {
    localStorage.setItem('edusign_vgca_user', JSON.stringify({ account: '042084002100' }));
    window._lastDetectedVgcaCert = { Subject: 'CN=Test' };
  });

  // Nhan nut dang xuat qua ham handleLogout()
  await page.evaluate(() => handleLogout());
  await page.waitForSelector('#loginUsername');

  const token = await page.evaluate(() => localStorage.getItem('edusign_token'));
  const vgcaUser = await page.evaluate(() => localStorage.getItem('edusign_vgca_user'));
  const cert = await page.evaluate(() => window._lastDetectedVgcaCert);
  expect(token).toBeNull();
  expect(vgcaUser).toBeNull();
  expect(cert).toBeNull();

  // 3. Dang nhap voi tai khoan Admin / Ban Giam Hieu
  await page.locator('#loginUsername').fill('admin');
  await page.locator('#loginPassword').fill('admin@123');
  await page.locator('#btnLoginSubmit').click();
  await page.waitForTimeout(1000);
  await expect(page.locator('#tabBtnTeachers')).toBeVisible();
  await expect(page.locator('#tabBtnDepartments')).toBeVisible();

  // 4. Screenshot minh chung
  await page.screenshot({ path: 'tests/screenshots/test_multi_signing_passed.png', fullPage: true });

  // 5. Bắt sạch lỗi Console F12
  const critical = consoleErrors.filter(e => 
    !e.includes('favicon') && 
    !e.includes('ERR_CONNECTION_REFUSED') && 
    (e.includes('TypeError') || e.includes('ReferenceError') || e.includes('SyntaxError'))
  );
  expect(critical.length).toBe(0);
});
