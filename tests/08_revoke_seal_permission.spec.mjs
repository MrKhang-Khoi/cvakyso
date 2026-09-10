import { test, expect } from '@playwright/test';
import fs from 'fs';

test.describe('8. Thu hồi và Bỏ phân quyền Đóng dấu nhà trường', () => {

  test('Kịch bản 1: Bỏ tích Ủy quyền Đóng dấu -> Badge biến mất & Form sửa không bị tích lại', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error' && !msg.text().includes('127.0.0.1:18888')) {
        consoleErrors.push(msg.text());
      }
    });

    page.on('response', resp => {
      if (resp.status() >= 400) {
        console.log(`[HTTP ${resp.status()}] URL: ${resp.url()}`);
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // 1. Đăng nhập Quản trị viên
    const usernameInput = page.locator('#loginUsername');
    if (await usernameInput.isVisible()) {
      await usernameInput.fill('admin');
      await page.locator('#loginPassword').fill('admin@123');
      await page.locator('#btnLoginSubmit').click();
      await page.waitForTimeout(1000);
    }

    // 2. Chuyển sang Tab Quản lý Giáo viên
    const teachersTabBtn = page.locator('#tabBtnTeachers, button:has-text("Danh sách Giáo viên")').first();
    if (await teachersTabBtn.isVisible()) {
      await teachersTabBtn.click();
      await page.waitForTimeout(500);
    }

    // 3. Mở modal tạo giáo viên BGH mới có tích quyền đóng dấu
    await page.evaluate(() => {
      window.openModalCreateUser();
      const radios = document.getElementsByName('userSignType');
      radios.forEach(r => { if (r.value === 'USB_TOKEN') r.checked = true; });
      if (typeof window.updateBghBoxVisibility === 'function') {
        window.updateBghBoxVisibility();
      }
    });
    await page.waitForTimeout(500);

    const uniqueSuffix = Date.now().toString().slice(-4);
    const testUsername = `cva.bgh_${uniqueSuffix}`;
    await page.locator('#userFullName').fill(`Ngô Thị Liền ${uniqueSuffix}`);
    await page.locator('#userUsername').fill(testUsername);
    await page.locator('#userPassword').fill('123456');
    await page.locator('#userCccd').fill('042185009999');
    await page.locator('#userRole').selectOption('BGH');
    await page.locator('#userDepartmentId').selectOption({ index: 1 });

    // Ban đầu TÍCH CHỌN Ủy quyền Đóng dấu nhà trường
    await page.locator('#userCanStampSeal').check();
    await expect(page.locator('#userCanStampSeal')).toBeChecked();

    // Bấm lưu tạo mới
    await page.locator('#formUser button[type=submit]').click();
    await expect(page.locator('#modalUser')).toBeHidden({ timeout: 15000 });
    await page.waitForTimeout(1000);

    // Xác nhận tài khoản vừa tạo có badge 'Đóng dấu OK'
    const userRow = page.locator(`tr:has-text("${testUsername}")`);
    await expect(userRow).toBeVisible();
    await expect(userRow).toContainText('Đóng dấu OK');

    // 4. BẤM NÚT SỬA ĐỂ BỎ PHÂN QUYỀN ĐÓNG DẤU
    await page.evaluate((uName) => {
      const u = appState.users.find(x => x.username === uName);
      if (u) window.openModalEditUser(u.id);
    }, testUsername);
    await page.waitForTimeout(600);

    const checkbox = page.locator('#userCanStampSeal');
    await expect(checkbox).toBeVisible();
    await expect(checkbox).toBeChecked();

    // BỎ TÍCH "Ủy quyền Đóng dấu nhà trường"
    await checkbox.uncheck();
    await expect(checkbox).not.toBeChecked();

    // Bấm Lưu thông tin
    await page.locator('#formUser button[type=submit]').click();
    await expect(page.locator('#modalUser')).toBeHidden({ timeout: 15000 });
    await page.waitForTimeout(1000);

    // 5. XÁC MINH 1: Trên bảng danh sách, badge 'Đóng dấu OK' BIẾN MẤT HOÀN TOÀN!
    const updatedUserRow = page.locator(`tr:has-text("${testUsername}")`);
    await expect(updatedUserRow).toBeVisible();
    await expect(updatedUserRow).not.toContainText('Đóng dấu OK');

    // Chụp ảnh minh chứng badge đã biến mất hoàn toàn
    fs.mkdirSync('tests/screenshots', { recursive: true });
    await page.screenshot({ path: 'tests/screenshots/evidence_seal_revoked_badge_gone.png', fullPage: true });

    // 6. XÁC MINH 2: Mở lại modal Sửa thông tin -> Checkbox VẪN Ở TRẠNG THÁI KHÔNG TÍCH (không bị tự động bật lại)
    await page.evaluate((uName) => {
      const u = appState.users.find(x => x.username === uName);
      if (u) window.openModalEditUser(u.id);
    }, testUsername);
    await page.waitForTimeout(600);

    const recheckCheckbox = page.locator('#userCanStampSeal');
    await expect(recheckCheckbox).not.toBeChecked();

    // Chụp ảnh minh chứng form sửa giữ nguyên unchecked
    await page.screenshot({ path: 'tests/screenshots/evidence_seal_revoked_modal_unchecked.png' });

    // Đóng modal
    await page.locator('#modalUser button:has-text("✕"), #modalUser button:has-text("Hủy")').first().click();
    await page.waitForTimeout(400);

    expect(consoleErrors).toHaveLength(0);
  });

  test('Kịch bản 2: Tài khoản bị tước quyền mở file PDF -> Nút 🔴 Đóng Dấu Nhà Trường BỊ ẨN HOÀN TOÀN', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Giả lập tài khoản BGH nhưng canStampSeal = false
    await page.evaluate(() => {
      appState.currentUser = {
        id: 'user_bgh_revoked',
        username: 'cva.bgh_revoked',
        fullName: 'Ngô Thị Liền (Đã tước quyền dấu)',
        name: 'Ngô Thị Liền (Đã tước quyền dấu)',
        role: 'BGH',
        roleTitle: 'Ban Giám hiệu nhà trường',
        departmentId: 'dept_bgh',
        departmentName: 'Ban Giám hiệu',
        signType: 'USB_TOKEN',
        canStampSeal: false // ĐÃ BỊ ADMIN THU HỒI
      };
      localStorage.setItem('edusign_user', JSON.stringify(appState.currentUser));
      if (typeof window.updateUserHeaderUI === 'function') window.updateUserHeaderUI();
      if (typeof window.showView === 'function') window.showView('app');
    });
    await page.waitForTimeout(600);

    // Mở xem văn bản PDF
    await page.evaluate(() => {
      const dummyPdfBytes = '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 595 842]/Parent 2 0 R>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000056 00000 n \n0000000111 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n185\n%%EOF';
      const pdfBlob = new Blob([dummyPdfBytes], { type: 'application/pdf' });
      window.openDocumentViewer('KiemTraQuyenDongDau.pdf', pdfBlob, true);
    });
    await page.waitForTimeout(1000);

    // XÁC MINH: Nút '🔴 Đóng Dấu Nhà Trường' PHẢI BỊ ẨN HOÀN TOÀN!
    const btnSeal = page.locator('#btnToggleSealPlacement');
    await expect(btnSeal).toBeHidden();

    // Nút ký cá nhân vẫn hiển thị bình thường
    await expect(page.locator('#btnToggleSignaturePlacement')).toBeVisible();

    // Chụp ảnh minh chứng nút đóng dấu bị ẩn hoàn toàn
    await page.screenshot({ path: 'tests/screenshots/evidence_seal_button_hidden_after_revoke.png' });
  });

  test('Kịch bản 3: Thử quét USB Token con dấu nhà trường khi đã bỏ tích ủy quyền -> Bị chặn & Cảnh báo', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // 1. Đăng nhập Admin
    const usernameInput = page.locator('#loginUsername');
    if (await usernameInput.isVisible()) {
      await usernameInput.fill('admin');
      await page.locator('#loginPassword').fill('admin@123');
      await page.locator('#btnLoginSubmit').click();
      await page.waitForTimeout(1000);
    }

    // 2. Mở modal tạo giáo viên với USB_TOKEN
    await page.evaluate(() => {
      window.openModalCreateUser();
      const radios = document.getElementsByName('userSignType');
      radios.forEach(r => { if (r.value === 'USB_TOKEN') r.checked = true; });
      if (typeof window.updateBghBoxVisibility === 'function') {
        window.updateBghBoxVisibility();
      }
    });
    await page.waitForTimeout(500);

    await page.locator('#userFullName').fill('Ngô Thị Liền');
    await page.locator('#userUsername').fill('cva.ntlien_unauth');
    await page.locator('#userPassword').fill('123456');
    await page.locator('#userCccd').fill('042185009999');
    await page.locator('#userRole').selectOption('BGH');
    await page.locator('#userDepartmentId').selectOption({ index: 1 });

    // Đảm bảo ô canStampSeal KHÔNG được tích
    const canStampCheckbox = page.locator('#userCanStampSeal');
    await expect(canStampCheckbox).not.toBeChecked();

    // Bấm quét USB Token
    await page.evaluate(async () => {
      await window.scanUsbTokenForModalUser();
    });
    await page.waitForTimeout(1500);

    // XÁC MINH: Hệ thống phát hiện USB Token là của trường và CHẶN LẠI kèm cảnh báo
    const alertBox = page.locator('#bghUsbScanAlert');
    await expect(alertBox).toBeVisible();
    await expect(alertBox).toContainText('PHÁT HIỆN USB TOKEN CON DẤU NHÀ TRƯỜNG');
    await expect(alertBox).toContainText('TRƯỜNG TRUNG HỌC CƠ SỞ CHU VĂN AN');
    await expect(alertBox).toContainText('Ủy quyền Đóng dấu nhà trường');

    // Số serial con dấu không được tự gán
    const serialInput = page.locator('#userCertSerial');
    await expect(serialInput).toHaveValue('');

    // Chụp ảnh minh chứng bị chặn khi chưa được ủy quyền
    await page.screenshot({ path: 'tests/screenshots/evidence_seal_scan_blocked_after_revoke.png' });
  });

});
