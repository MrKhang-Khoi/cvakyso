import { test, expect } from '@playwright/test';
import path from 'path';

test('Kiểm thử E2E: Quản lý Mã PIN Zalo trên Admin và Modal Thông tin cá nhân', async ({ page }) => {
  // Bắt mọi lỗi Console F12
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error' && !msg.text().includes('favicon') && !msg.text().includes('WebSocket')) {
      consoleErrors.push(msg.text());
    }
  });

  // 1. Mở trang chủ
  await page.goto('http://localhost:3000');
  await page.waitForLoadState('networkidle');

  // 2. Đăng nhập Admin
  await page.fill('#loginUsername', 'admin');
  await page.fill('#loginPassword', 'admin@123');
  await page.click('#btnLoginSubmit');

  // Đợi giao diện Admin hiển thị
  await expect(page.locator('#viewAdmin')).toBeVisible({ timeout: 10000 });
  console.log('✅ Đã đăng nhập Admin thành công.');

  // Đợi danh sách giáo viên load xong trong appState
  await page.waitForFunction(() => window.appState && window.appState.users && window.appState.users.length > 0);
  const tyUser = await page.evaluate(() => window.appState.users.find(u => u.username === 'cva.ty' || (u.name && u.name.includes('Tý'))));
  const tyUserId = tyUser ? tyUser.id : 'user_cvaty';
  console.log('Thầy Tý in appState:', tyUserId);
  await page.evaluate((id) => {
    openModalEditUser(id);
  }, tyUserId);

  await expect(page.locator('#modalUser')).toBeVisible({ timeout: 5000 });
  const modalTitle = await page.locator('#modalUserTitle').textContent();
  console.log('Tiêu đề Modal User:', modalTitle);
  expect(modalTitle.toUpperCase()).toContain('TY');

  // 4. Kiểm tra trường Mã PIN Zalo Bot
  const zaloPinInput = page.locator('#userZaloPin');
  await expect(zaloPinInput).toBeVisible();
  const currentPin = await zaloPinInput.inputValue();
  console.log('Mã PIN hiện tại của thầy Hà Văn Tý:', currentPin);
  expect(currentPin === '0007' || currentPin === '8888').toBe(true);

  // Thử đổi sang 9999 và lưu
  await zaloPinInput.fill('9999');
  await page.click('#modalUser button[type="submit"]');

  // Đợi toast và modal đóng
  await page.waitForTimeout(1000);
  await expect(page.locator('#modalUser')).toBeHidden();
  console.log('✅ Đã lưu cập nhật PIN 9999 thành công.');

  // Mở lại để xác nhận đã lưu
  await page.evaluate((id) => {
    openModalEditUser(id);
  }, tyUserId);
  await expect(page.locator('#modalUser')).toBeVisible({ timeout: 5000 });
  const updatedPin = await page.locator('#userZaloPin').inputValue();
  console.log('Mã PIN sau khi lưu lại:', updatedPin);
  expect(updatedPin).toBe('9999');

  // Đổi lại về 0007 chuẩn
  await page.locator('#userZaloPin').fill('0007');
  await page.click('#modalUser button[type="submit"]');
  await page.waitForTimeout(1000);

  // Chụp ảnh màn hình Modal Admin với ô Mã PIN Zalo
  await page.evaluate((id) => {
    openModalEditUser(id);
  }, tyUserId);
  await page.screenshot({ path: 'tests/screenshots/admin_edit_user_pin.png' });
  await page.evaluate(() => {
    closeModal('modalUser');
  });

  // 5. Kiểm tra Menu Cài đặt: Mở "Thông tin cá nhân & Zalo"
  await page.click('button[onclick*="adminSettingsDropdown"]');
  await page.waitForTimeout(300);
  const profileMenuBtn = page.locator('#adminSettingsDropdown button:has-text("Thông tin cá nhân & Zalo")');
  await expect(profileMenuBtn).toBeVisible();
  await profileMenuBtn.click();

  // Kiểm tra Modal Thông tin cá nhân hiển thị
  await expect(page.locator('#modalUserProfile')).toBeVisible();
  const profFullName = await page.locator('#profFullName').textContent();
  const profPinCode = await page.locator('#profPinCode').textContent();
  expect(profPinCode.length).toBe(4);

  // Chụp ảnh màn hình Modal Profile
  await page.screenshot({ path: 'tests/screenshots/modal_profile_admin.png' });
  await page.click('#modalUserProfile button:has-text("Đóng")');
  await expect(page.locator('#modalUserProfile')).toBeHidden();

  // 6. Đăng xuất Admin và Đăng nhập Giáo viên Hà Văn Tý
  await page.click('button[onclick*="adminSettingsDropdown"]');
  await page.click('#adminSettingsDropdown button:has-text("Đăng xuất")');
  await expect(page.locator('#viewLogin')).toBeVisible();

  await page.fill('#loginUsername', 'cva.ty');
  await page.fill('#loginPassword', '123456');
  await page.click('#btnLoginSubmit');

  await expect(page.locator('#viewTeacher')).toBeVisible({ timeout: 10000 });
  console.log('✅ Đã đăng nhập Giáo viên cva.ty thành công.');

  // Mở Thông tin cá nhân của Giáo viên
  await page.click('button[onclick*="teacherSettingsDropdown"]');
  await page.waitForTimeout(300);
  const teacherProfBtn = page.locator('#teacherSettingsDropdown button:has-text("Thông tin cá nhân & Zalo")');
  await expect(teacherProfBtn).toBeVisible();
  await teacherProfBtn.click();

  await expect(page.locator('#modalUserProfile')).toBeVisible();
  const teacherFullName = await page.locator('#profFullName').textContent();
  const teacherPhone = await page.locator('#profPhone').textContent();
  const teacherPin = await page.locator('#profPinCode').textContent();
  const teacherSyntax = await page.locator('#profSyntaxFull').textContent();

  console.log('Modal Profile Giáo viên Hà Văn Tý:', {
    fullName: teacherFullName,
    phone: teacherPhone,
    pin: teacherPin,
    syntax: teacherSyntax
  });

  expect(teacherFullName.toUpperCase()).toContain('TY');
  expect(teacherPhone).toBe('0818810007');
  expect(teacherPin.length).toBe(4);
  expect(teacherSyntax).toContain('0818810007');

  // Chụp ảnh màn hình minh chứng
  await page.screenshot({ path: 'tests/screenshots/modal_profile_teacher_ty.png' });
  console.log('✅ Đã chụp ảnh minh chứng: tests/screenshots/modal_profile_teacher_ty.png');

  // Kiểm tra Console F12 sạch 100%
  console.log('Console Errors:', consoleErrors);
  expect(consoleErrors.length).toBe(0);
});
