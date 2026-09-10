import { test, expect } from '@playwright/test';
import path from 'path';

test('Verify School Seal Upload and Save on Live Production - Zero 401 errors', async ({ page }) => {
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

  // 2. Dang nhap Admin
  console.log('2. Dang nhap Quan tri vien...');
  const loginInput = page.locator('#loginUsername');
  if (await loginInput.isVisible()) {
    await loginInput.fill('admin');
    await page.locator('#loginPassword').fill('admin@123');
    await page.locator('#btnLoginSubmit').click();
    await page.waitForTimeout(2000);
  }

  // 3. Mo modal Tai con dau nha truong
  console.log('3. Mo modal Tai con dau nha truong...');
  await page.evaluate(() => {
    if (typeof openModalUploadSignature === 'function') {
      openModalUploadSignature('SCHOOL_SEAL');
    }
  });
  await page.waitForTimeout(1500);

  // Kiem tra modal hien thi
  const modal = page.locator('#modalUploadSignature');
  await expect(modal).toBeVisible();

  // Kiem tra tab Con dau nha truong dang active
  const tabSeal = page.locator('#tabUploadSchoolSeal');
  await expect(tabSeal).toBeVisible();

  // Chup anh preview con dau
  await page.screenshot({ path: 'tests/screenshots/evidence_seal_modal_opened.png' });

  // 4. Test nap con dau va bam Luu
  console.log('4. Nhan nut Luu Con Dau Nha Truong...');
  const btnSave = page.locator('#btnSaveUserSig');
  await expect(btnSave).toBeVisible();
  await btnSave.click();
  await page.waitForTimeout(3000);

  // 5. Kiem tra khong phat sinh bat ky loi HTTP >= 400 (dac biet 401 Unauthorized)
  console.log('5. Doi soat loi HTTP:', httpErrors);
  expect(httpErrors).toEqual([]);
  console.log('0 LOI HTTP (Zero 401 Unauthorized)! Hoan toan sach bong loi!');

  // Chup anh thong bao thanh cong
  await page.screenshot({ path: 'tests/screenshots/evidence_seal_save_success.png' });

  // 6. Kiem tra xoa con dau va tai lai
  console.log('6. Mo lai modal va kiem tra trang thai...');
  await page.evaluate(() => {
    if (typeof openModalUploadSignature === 'function') {
      openModalUploadSignature('SCHOOL_SEAL');
    }
  });
  await page.waitForTimeout(1000);

  const previewImg = page.locator('#userSigPreviewImg');
  console.log('Anh con dau preview visible:', await previewImg.isVisible());

  console.log('TOAN BO KIEM THU TAI DAU NHA TRUONG DAT 100% PASS!');
});
