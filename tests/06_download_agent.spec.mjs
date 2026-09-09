import { test, expect } from '@playwright/test';

test.describe('Kiểm thử Tải bộ cài EduSign Agent và Modal Cài Đặt', () => {
  test('Giáo viên đăng nhập và mở Modal Tải ứng dụng Ký số, kiểm tra link và console', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const txt = msg.text();
        if (!txt.includes('127.0.0.1:18888') && !txt.includes('net::ERR_CONNECTION_REFUSED')) {
          consoleErrors.push(txt);
        }
      }
    });

    page.on('pageerror', err => {
      consoleErrors.push(err.message);
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // 1. Đăng nhập nếu đang ở trang login
    const usernameInput = page.locator('#loginUsername');
    if (await usernameInput.isVisible()) {
      await usernameInput.fill('cva.ty');
      await page.locator('#loginPassword').fill('123456');
      await page.locator('#btnLoginSubmit').click();
      await page.waitForTimeout(1500);
    }

    // 2. Mở Modal Tải bộ cài bằng nút hiển thị trên giao diện Giáo viên
    const btnOpenModal = page.locator('#viewTeacher button[onclick*="openModalDownloadAgent"]').first();
    await expect(btnOpenModal).toBeVisible();
    await btnOpenModal.click();

    // 3. Kiểm tra Modal xuất hiện đầy đủ
    const modal = page.locator('#modalDownloadAgent');
    await expect(modal).toBeVisible();

    // 4. Kiểm tra nút tải ZIP và nút tải EXE
    const btnZip = page.locator('#btnDownloadAgentZip');
    await expect(btnZip).toBeVisible();
    const zipHref = await btnZip.getAttribute('href');
    expect(zipHref).toContain('EduSign_Agent_v2.0_Setup.zip');

    const btnExe = page.locator('#btnDownloadAgentExe');
    await expect(btnExe).toBeVisible();
    const exeHref = await btnExe.getAttribute('href');
    expect(exeHref).toContain('EduSign_Agent.exe');

    // 5. Kiểm tra các link dự phòng
    const fallbackCdn = modal.locator('a[href*="github.com/MrKhang-Khoi/cvakyso"]');
    expect(await fallbackCdn.count()).toBeGreaterThanOrEqual(2);

    // 6. Test hàm downloadEduSignAgent chạy an toàn không phát sinh exception
    const downloadTest = await page.evaluate(() => {
      if (typeof window.downloadEduSignAgent !== 'function') return { ok: false, msg: 'Missing function' };
      try {
        window.downloadEduSignAgent('zip');
        window.downloadEduSignAgent('exe');
        return { ok: true };
      } catch (e) {
        return { ok: false, msg: e.message };
      }
    });
    expect(downloadTest.ok).toBe(true);

    // 7. Chụp ảnh màn hình minh chứng
    await page.screenshot({ path: 'tests/screenshots/modal_download_agent.png' });

    // 8. Đóng modal
    const btnClose = modal.locator('button:has-text("Đóng cửa sổ")');
    await btnClose.click();
    await expect(modal).toBeHidden();

    // 9. Xác nhận console sạch bóng lỗi
    expect(consoleErrors).toEqual([]);
  });
});
