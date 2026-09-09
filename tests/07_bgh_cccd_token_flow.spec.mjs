import { test, expect } from '@playwright/test';

test.describe('Kiểm thử Đối soát CCCD USB Token Ban Giám hiệu & Tự động Nhận diện Chế độ Ký', () => {
  test('Kiểm tra Validate CCCD trước khi Quét, Badge Header USB Token và Modal Ký Số', async ({ page }) => {
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

    // 1. Kiểm tra đăng nhập với tài khoản Admin / BGH
    const usernameInput = page.locator('#loginUsername');
    if (await usernameInput.isVisible()) {
      await usernameInput.fill('admin');
      await page.locator('#loginPassword').fill('admin@123');
      await page.locator('#btnLoginSubmit').click();
      await page.waitForTimeout(1500);
    }

    // 2. Mở Modal Thêm/Sửa Người dùng để kiểm tra tính năng Validate CCCD khi Quét
    await page.evaluate(() => {
      if (typeof window.openModalCreateUser === 'function') {
        window.openModalCreateUser();
      }
    });
    await page.waitForTimeout(500);

    const modalUser = page.locator('#modalUser');
    await expect(modalUser).toBeVisible();

    // 2.1. Chọn radio USB Token
    await page.evaluate(() => {
      const radios = document.getElementsByName('userSignType');
      radios.forEach(r => { if (r.value === 'USB_TOKEN') r.checked = true; });
      if (typeof window.updateBghBoxVisibility === 'function') {
        window.updateBghBoxVisibility();
      }
    });
    await page.waitForTimeout(300);

    // 2.2. Bấm quét khi ô CCCD rỗng -> Kiểm tra hệ thống CHẶN lại
    await page.locator('#userCccd').fill('');
    await page.evaluate(async () => {
      await window.scanUsbTokenForModalUser();
    });
    await page.waitForTimeout(500);

    // Xác nhận ô Serial vẫn trống vì bị chặn do thiếu CCCD
    const serialValEmpty = await page.locator('#userCertSerial').inputValue();
    expect(serialValEmpty).toBe('');
    
    // Kiểm tra bghUsbScanAlert hiển thị cảnh báo trực quan inline
    const scanAlert = page.locator('#bghUsbScanAlert');
    await expect(scanAlert).toBeVisible();
    expect(await scanAlert.textContent()).toContain('CẦN NHẬP SỐ CCCD');

    // Đảm bảo không bật modalUnifiedAlert gây mờ màn hình
    const alertModal = page.locator('#modalUnifiedAlert');
    await expect(alertModal).toHaveClass(/hidden/);

    // 2.3. Bấm quét khi CCCD không đủ số (ví dụ '123') -> Kiểm tra bị chặn
    await page.locator('#userCccd').fill('123');
    await page.evaluate(async () => {
      await window.scanUsbTokenForModalUser();
    });
    await page.waitForTimeout(500);
    const serialValInvalid = await page.locator('#userCertSerial').inputValue();
    expect(serialValInvalid).toBe('');
    expect(await scanAlert.textContent()).toContain('SỐ CCCD KHÔNG HỢP LỆ');

    // 2.4. Giả lập quét USB Token với CCCD KHÔNG KHỚP (Chống cắm nhầm USB)
    await page.route('**/api/check-vgca-status*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          certInfo: {
            serialNumber: '778899AABBCCDDEE',
            signerName: 'Nguyễn Văn Khác',
            cccd: '051200999999',
            subject: 'CN=Nguyễn Văn Khác, UID=051200999999'
          }
        })
      });
    });

    await page.locator('#userCccd').fill('051200111111');
    await page.evaluate(async () => {
      await window.scanUsbTokenForModalUser();
    });
    await page.waitForTimeout(500);

    // Serial phải bị TỪ CHỐI cập nhật
    const serialValMismatch = await page.locator('#userCertSerial').inputValue();
    expect(serialValMismatch).toBe('');
    expect(await scanAlert.textContent()).toContain('CẮM NHẦM USB TOKEN CỦA NGƯỜI KHÁC');
    // Tuyệt đối KHÔNG làm mờ modal bằng modalUnifiedAlert
    await expect(alertModal).toHaveClass(/hidden/);

    // Chụp ảnh bằng chứng cảnh báo trực quan chống cắm nhầm thiết bị
    await page.screenshot({ path: 'tests/screenshots/09_bgh_usb_scan_alert_inline.png' });

    // 2.5. Giả lập quét USB Token với CCCD KHỚP CHUẨN
    await page.unroute('**/api/check-vgca-status*');
    await page.route('**/api/check-vgca-status*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          certInfo: {
            serialNumber: '15FA69CF7ACCCC76',
            signerName: 'Ngô Thị Liền',
            cccd: '051200111111',
            subject: 'CN=Ngô Thị Liền, UID=051200111111'
          }
        })
      });
    });

    await page.evaluate(async () => {
      await window.scanUsbTokenForModalUser();
    });
    await page.waitForTimeout(500);

    // Serial phải được cập nhật chuẩn xác
    const serialValMatch = await page.locator('#userCertSerial').inputValue();
    expect(serialValMatch).toBe('15FA69CF7ACCCC76');
    expect(await scanAlert.textContent()).toContain('XÁC THỰC THÀNH CÔNG');

    await page.unroute('**/api/check-vgca-status*');

    // Đóng Modal User
    await page.evaluate(() => window.closeModal('modalUser'));
    await page.waitForTimeout(300);

    // 3. Chuyển sang View Giáo viên / BGH (viewTeacher) để kiểm tra Huy hiệu Header
    await page.evaluate(() => {
      if (window.appState && window.appState.currentUser) {
        window.appState.currentUser.signType = 'USB_TOKEN';
        window.appState.currentUser.role = 'BGH';
        window.appState.currentUser.roleTitle = 'Ban Giám hiệu';
        window.appState.currentUser.departmentName = 'Ban Giám hiệu';
        window.appState.currentUser.fullName = 'Ngô Thị Liền';
        window.showView('teacher');
      }
    });
    await page.waitForTimeout(800);

    // 3.1. Kiểm tra huy hiệu góc trái dưới tên trường phải là Khóa cứng USB Token (màu tím)
    const badgeEl = page.locator('#teacherHeaderSignTypeBadge');
    await expect(badgeEl).toBeVisible();
    const badgeText = await badgeEl.textContent();
    expect(badgeText).toContain('Khóa cứng USB Token');
    expect(badgeText).not.toContain('VGCA SmartCA');

    const badgeClass = await badgeEl.getAttribute('class');
    expect(badgeClass).toContain('text-purple-700');

    // Chụp ảnh bằng chứng huy hiệu USB Token
    await page.screenshot({ path: 'tests/screenshots/08_bgh_usb_token_badge.png' });

    // 4. Kiểm tra Modal Ký Số khi BGH ký văn bản
    await page.evaluate(() => {
      if (typeof window.openVgcaLoginModal === 'function') {
        window.openVgcaLoginModal();
      }
    });
    await page.waitForTimeout(800);

    const modalVgca = page.locator('#modalVgcaLogin');
    await expect(modalVgca).toBeVisible();

    // 4.1. Kiểm tra Tab "USB Token" tự động được chọn (active) thay vì VGCA di động
    const btnUsbTab = page.locator('#tabBtnLoginUsb');
    const usbTabClass = await btnUsbTab.getAttribute('class');
    expect(usbTabClass).toContain('text-indigo-700'); // active tab class

    // 4.2. Kiểm tra chế độ ký trong bộ nhớ JavaScript là 'usb'
    const loginMode = await page.evaluate(() => window.currentVgcaLoginMode);
    expect(loginMode).toBe('usb');

    // Chụp ảnh bằng chứng modal ký số tự động chọn USB Token
    await page.screenshot({ path: 'tests/screenshots/09_bgh_modal_usb_sign.png' });

    await page.evaluate(() => window.closeModal('modalVgcaLogin'));

    // 5. Kiểm tra sạch hoàn toàn console error
    expect(consoleErrors).toEqual([]);
  });
});
