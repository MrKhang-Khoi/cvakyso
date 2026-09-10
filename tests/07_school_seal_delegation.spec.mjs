import { test, expect } from '@playwright/test';
import fs from 'fs';

test.describe('7. Phân quyền và Ký số USB Token Con dấu nhà trường', () => {

  test('Kịch bản 1: Quét USB Token khi chưa ủy quyền -> Chặn gán nhầm & Cảnh báo rõ ràng', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error' && !msg.text().includes('127.0.0.1:18888')) {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // 1. Đảm bảo đăng nhập quyền Admin
    const usernameInput = page.locator('#loginUsername');
    if (await usernameInput.isVisible()) {
      await usernameInput.fill('admin');
      await page.locator('#loginPassword').fill('admin@123');
      await page.locator('#btnLoginSubmit').click();
      await page.waitForTimeout(1000);
    }

    // 2. Mở modal thêm giáo viên
    await page.evaluate(() => {
      window.openModalCreateUser();
      const radios = document.getElementsByName('userSignType');
      radios.forEach(r => { if (r.value === 'USB_TOKEN') r.checked = true; });
      if (typeof window.updateBghBoxVisibility === 'function') {
        window.updateBghBoxVisibility();
      }
    });
    await page.waitForTimeout(500);

    // Điền thông tin giáo viên Ngô Thị Liền
    await page.locator('#userFullName').fill('Ngô Thị Liền');
    await page.locator('#userUsername').fill('cva.ntlien');
    await page.locator('#userPassword').fill('123456');
    await page.locator('#userCccd').fill('042185009999'); // CCCD cá nhân cô Liền
    await page.locator('#userRole').selectOption('TEACHER');
    await page.locator('#userDepartmentId').selectOption({ index: 1 });

    // Đảm bảo checkbox Ủy quyền đóng dấu CHƯA được tích
    const canStampCheckbox = page.locator('#userCanStampSeal');
    await expect(canStampCheckbox).not.toBeChecked();

    // Bấm nút Quét USB Token
    await page.evaluate(async () => {
      await window.scanUsbTokenForModalUser();
    });
    await page.waitForTimeout(1500);

    // Cảnh báo chặn phải xuất hiện
    const alertBox = page.locator('#bghUsbScanAlert');
    await expect(alertBox).toBeVisible();
    await expect(alertBox).toContainText('PHÁT HIỆN USB TOKEN CON DẤU NHÀ TRƯỜNG');
    await expect(alertBox).toContainText('TRƯỜNG TRUNG HỌC CƠ SỞ CHU VĂN AN');
    await expect(alertBox).toContainText('Ủy quyền Đóng dấu nhà trường');

    // Số serial không được tự tiện điền vào ô cá nhân
    const serialInput = page.locator('#userCertSerial');
    await expect(serialInput).toHaveValue('');

    // Chụp ảnh minh chứng cảnh báo chặn
    fs.mkdirSync('tests/screenshots', { recursive: true });
    await page.screenshot({ path: 'tests/screenshots/evidence_seal_warning_unauthorized.png', fullPage: true });

    expect(consoleErrors).toHaveLength(0);
  });

  test('Kịch bản 2: Bật Ủy quyền Đóng dấu -> Quét thành công & Hiển thị Badge Đóng dấu OK', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    if (await page.locator('#loginUsername').isVisible()) {
      await page.locator('#loginUsername').fill('admin');
      await page.locator('#loginPassword').fill('admin@123');
      await page.locator('#btnLoginSubmit').click();
      await page.waitForTimeout(1000);
    }

    await page.evaluate(() => {
      window.openModalCreateUser();
      const radios = document.getElementsByName('userSignType');
      radios.forEach(r => { if (r.value === 'USB_TOKEN') r.checked = true; });
      if (typeof window.updateBghBoxVisibility === 'function') {
        window.updateBghBoxVisibility();
      }
    });
    await page.waitForTimeout(500);

    const testUsername = 'cva.ntlien_seal';
    await page.locator('#userFullName').fill('Ngô Thị Liền');
    await page.locator('#userUsername').fill(testUsername);
    await page.locator('#userPassword').fill('123456');
    await page.locator('#userCccd').fill('042185009999');
    await page.locator('#userRole').selectOption('TEACHER');
    await page.locator('#userDepartmentId').selectOption({ index: 1 });

    // TÍCH CHỌN Ủy quyền Đóng dấu nhà trường
    await page.locator('#userCanStampSeal').check();
    await expect(page.locator('#userCanStampSeal')).toBeChecked();

    // Bấm Quét USB Token
    await page.evaluate(async () => {
      await window.scanUsbTokenForModalUser();
    });
    await page.waitForTimeout(1500);

    // Hệ thống chấp thuận và liên kết con dấu
    const alertBox = page.locator('#bghUsbScanAlert');
    await expect(alertBox).toBeVisible();
    await expect(alertBox).toContainText('XÁC THỰC CON DẤU CƠ QUAN ĐƯỢC ỦY QUYỀN');

    const serialInput = page.locator('#userCertSerial');
    await expect(serialInput).toHaveValue('189A2218A5A80E4C');

    // Lưu giáo viên
    await page.locator('#formUser button[type=submit]').click();
    await expect(page.locator('#modalUser')).toBeHidden({ timeout: 15000 });

    // Kiểm tra trong bảng giáo viên có badge 'Đóng dấu OK'
    const row = page.locator('tr', { hasText: 'Ngô Thị Liền' }).last();
    await expect(row).toBeVisible();
    await expect(row).toContainText('Đóng dấu OK');

    await page.screenshot({ path: 'tests/screenshots/evidence_seal_delegation_badge.png', fullPage: true });
  });

  test('Kịch bản 3: Giáo viên được ủy quyền mở PDF -> Thấy nút 🔴 Đóng Dấu Nhà Trường & Kéo thả dấu đỏ', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Đăng xuất
    const userMenuBtn = page.locator('#btnUserMenuToggle');
    if (await userMenuBtn.isVisible()) {
      await userMenuBtn.click();
      await page.waitForTimeout(300);
      const logoutBtn = page.locator('button:has-text(Đăng xuất), a:has-text(Đăng xuất)').first();
      if (await logoutBtn.isVisible()) {
        await logoutBtn.click();
        await page.waitForTimeout(1000);
      }
    }

    // Đăng nhập tài khoản cva.ntlien_seal
    await page.locator('#loginUsername').fill('cva.ntlien_seal');
    await page.locator('#loginPassword').fill('123456');
    await page.locator('#btnLoginSubmit').click();
    await page.waitForTimeout(1500);

    await expect(page.locator('#tabBtnTeacherWorkspace')).toBeVisible();

    // Mở viewer với tệp PDF
    await page.evaluate(() => {
      const dummyPdfBytes = '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 595 842]/Parent 2 0 R>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000056 00000 n \n0000000111 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n185\n%%EOF';
      const pdfBlob = new Blob([dummyPdfBytes], { type: 'application/pdf' });
      window.openDocumentViewer('KeHoachBaiDay_Lien.pdf', pdfBlob, true);
    });

    await page.waitForTimeout(1200);

    const modalViewer = page.locator('#modalDocViewer');
    await expect(modalViewer).toBeVisible();

    // Nút '🔴 Đóng Dấu Nhà Trường' PHẢI HIỂN THỊ
    const btnSeal = page.locator('#btnToggleSealPlacement');
    await expect(btnSeal).toBeVisible();

    // Bấm vào nút Đóng Dấu Nhà Trường
    await btnSeal.click();
    await page.waitForTimeout(600);

    const stampEl = page.locator('#draggableSignatureStamp');
    await expect(stampEl).toBeVisible();

    const sealImg = page.locator('#draggableSignatureImg');
    await expect(sealImg).toBeVisible();
    const imgSrc = await sealImg.getAttribute('src');
    expect(imgSrc).toContain('school_seal.png');

    await expect(page.locator('#draggableStampSignerName')).toContainText('TRƯỜNG THCS CHU VĂN AN');
    await expect(page.locator('#btnViewerConfirmSignText')).toContainText('Xác Nhận Đóng Dấu');

    await page.screenshot({ path: 'tests/screenshots/evidence_seal_button_authorized.png' });
  });

  test('Kịch bản 4: Giáo viên KHÔNG được ủy quyền mở PDF -> Nút 🔴 Đóng Dấu Nhà Trường bị ẨN HOÀN TOÀN', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const userMenuBtn = page.locator('#btnUserMenuToggle');
    if (await userMenuBtn.isVisible()) {
      await userMenuBtn.click();
      await page.waitForTimeout(300);
      const logoutBtn = page.locator('button:has-text(Đăng xuất), a:has-text(Đăng xuất)').first();
      if (await logoutBtn.isVisible()) {
        await logoutBtn.click();
        await page.waitForTimeout(1000);
      }
    }

    // Đăng nhập giáo viên thường (cva.ty)
    await page.locator('#loginUsername').fill('cva.ty');
    await page.locator('#loginPassword').fill('123456');
    await page.locator('#btnLoginSubmit').click();
    await page.waitForTimeout(1500);

    await page.evaluate(() => {
      if (appState.currentUser) appState.currentUser.canStampSeal = false;
      const dummyPdfBytes = '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 595 842]/Parent 2 0 R>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000056 00000 n \n0000000111 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n185\n%%EOF';
      const pdfBlob = new Blob([dummyPdfBytes], { type: 'application/pdf' });
      window.openDocumentViewer('KeHoachBaiDay_Ty.pdf', pdfBlob, true);
    });

    await page.waitForTimeout(1200);

    // Nút '🔴 Đóng Dấu Nhà Trường' PHẢI BỊ ẨN HOÀN TOÀN
    const btnSeal = page.locator('#btnToggleSealPlacement');
    await expect(btnSeal).toBeHidden();

    // Nút ký cá nhân vẫn hiển thị
    await expect(page.locator('#btnToggleSignaturePlacement')).toBeVisible();

    await page.screenshot({ path: 'tests/screenshots/evidence_seal_button_unauthorized_hidden.png' });
  });

  test('Kịch bản 5: Modal Quản lý Chữ ký -> Có tùy chọn upload và xem trước Con dấu nhà trường', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    if (await page.locator('#loginUsername').isVisible()) {
      await page.locator('#loginUsername').fill('cva.ntlien_seal');
      await page.locator('#loginPassword').fill('123456');
      await page.locator('#btnLoginSubmit').click();
      await page.waitForTimeout(1200);
    }

    await page.evaluate(() => {
      window.openModalUploadSignature();
    });
    await page.waitForTimeout(600);

    const selectorBox = page.locator('#boxSignatureTargetSelector');
    await expect(selectorBox).toBeVisible();

    await page.locator('#tabUploadSchoolSeal').click();
    await page.waitForTimeout(600);

    await expect(page.locator('#btnSaveUserSigText')).toHaveText('Lưu Con Dấu Nhà Trường');

    const previewImg = page.locator('#userSigPreviewImg');
    await expect(previewImg).toBeVisible();

    await page.screenshot({ path: 'tests/screenshots/evidence_seal_upload_modal.png' });
  });

});
