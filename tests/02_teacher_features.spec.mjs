import { test, expect } from '@playwright/test';

test.describe('2. Kiểm thử Nghiệp vụ Giáo viên (Nộp bài, Chữ ký số, Danh mục)', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Đảm bảo đăng nhập với tài khoản giáo viên cva.ty
    const usernameInput = page.locator('#loginUsername');
    if (await usernameInput.isVisible()) {
      await usernameInput.fill('cva.ty');
      await page.locator('#loginPassword').fill('123456');
      await page.locator('#btnLoginSubmit').click();
      await page.waitForTimeout(1500);
    }
  });

  test('Chuyển đổi mượt mà giữa các danh mục hồ sơ (Không phát sinh lỗi F12)', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error' && !msg.text().includes('127.0.0.1:18888')) {
        consoleErrors.push(msg.text());
      }
    });

    // Tìm các tab danh mục
    const tabLesson = page.locator('button:has-text("Kế hoạch bài dạy")').first();
    const tabPersonal = page.locator('button:has-text("Giáo án cá nhân")').first();
    const tabReport = page.locator('button:has-text("Báo cáo liên cấp")').first();

    if (await tabLesson.isVisible()) await tabLesson.click();
    await page.waitForTimeout(500);

    if (await tabPersonal.isVisible()) await tabPersonal.click();
    await page.waitForTimeout(500);

    if (await tabReport.isVisible()) await tabReport.click();
    await page.waitForTimeout(500);

    // Quay lại tab chính
    if (await tabLesson.isVisible()) await tabLesson.click();
    await page.waitForTimeout(500);

    expect(consoleErrors).toHaveLength(0);
    await page.screenshot({ path: 'tests/screenshots/02_category_tabs.png' });
  });

  test('Khu vực Soạn & Ký văn bản và Lựa chọn Loại hồ sơ hiển thị đầy đủ', async ({ page }) => {
    const tabWorkspace = page.locator('#tabBtnTeacherWorkspace');
    await expect(tabWorkspace).toBeVisible();
    await tabWorkspace.click();
    await page.waitForTimeout(400);

    // Khu vực soạn thảo phải hiển thị
    const workspaceSec = page.locator('#tabContentTeacherWorkspace');
    await expect(workspaceSec).toBeVisible();
    await expect(page.locator('#labelTypeLesson')).toBeVisible();
    await expect(page.locator('#labelTypeReport')).toBeVisible();

    await page.screenshot({ path: 'tests/screenshots/02_new_doc_modal.png' });
  });

  test('Mở Modal Quản lý Mẫu chữ ký và Con dấu', async ({ page }) => {
    await page.evaluate(() => {
      if (typeof window.openModalUploadSignature === 'function') {
        window.openModalUploadSignature();
      }
    });
    await page.waitForTimeout(500);
    const modalSig = page.locator('#modalUploadSignature');
    await expect(modalSig).toBeVisible();
    await page.screenshot({ path: 'tests/screenshots/02_signature_pad_modal.png' });
    await page.evaluate(() => window.closeModal('modalUploadSignature'));
  });

});
