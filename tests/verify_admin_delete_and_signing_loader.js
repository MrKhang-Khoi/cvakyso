const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const assert = require('assert');

// 1. UNIT TEST cho google-apps-script-zalo-edusign.js deleteReportFromSheet
console.log('--- 1. KIỂM THỬ ĐƠN VỊ: google-apps-script-zalo-edusign.js ---');
const gasModule = require('../google-apps-script-zalo-edusign.js');

assert.strictEqual(typeof gasModule.deleteReportFromSheet, 'function', 'deleteReportFromSheet phải là một hàm');
const noParamRes = gasModule.deleteReportFromSheet('');
assert.strictEqual(noParamRes.success, false, 'Khi thiếu docId phải trả về success: false');
console.log('✅ Unit test deleteReportFromSheet passed!');

// 2. PLAYWRIGHT AUTOMATION TEST
(async () => {
  console.log('\n--- 2. BẮT ĐẦU KIỂM THỬ PLAYWRIGHT BROWSER ---');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await context.newPage();

  // A. KIỂM TRA PORTAL-BAOCAO.HTML
  const portalPath = 'file:///' + path.resolve(__dirname, '../portal-baocao.html').replace(/\\/g, '/');
  console.log('Truy cập:', portalPath);
  await page.goto(portalPath, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    if (!window.currentReportsData || window.currentReportsData.length === 0) {
      if (typeof renderFallbackMockData === 'function') renderFallbackMockData();
    }
  });

  // 1. Kiểm tra trạng thái ban đầu: Guest mode
  const btnAdminLogin = page.locator('#btnAdminLogin');
  const adminBadgeActive = page.locator('#adminBadgeActive');
  
  const isLoginVisible = await btnAdminLogin.isVisible();
  assert.strictEqual(isLoginVisible, true, 'Nút Quyền Quản Trị phải hiển thị ban đầu');
  const isBadgeHidden = await adminBadgeActive.isHidden();
  assert.strictEqual(isBadgeHidden, true, 'Huy hiệu Admin: Bật phải ẩn ban đầu');

  let deleteButtons = await page.locator('.btn-delete-report').count();
  assert.strictEqual(deleteButtons, 0, 'Người dùng thường KHÔNG được thấy nút xóa báo cáo');
  console.log('✅ Xác thực ban đầu: Người dùng thường không thấy nút xóa');

  // Chụp ảnh giao diện thường
  await page.screenshot({ path: path.resolve(__dirname, 'portal_guest_mode.png') });

  // 2. Bấm mở Modal Admin Auth
  await btnAdminLogin.click();
  await page.waitForTimeout(300);
  const modalAdminAuth = page.locator('#modalAdminAuth');
  assert.strictEqual(await modalAdminAuth.isVisible(), true, 'Modal xác thực Admin phải mở ra');

  // Thử nhập sai mật khẩu
  await page.fill('#adminPasswordInput', 'sai_mat_khau');
  await page.click('button:has-text("Xác Nhận Admin")');
  await page.waitForTimeout(300);
  assert.strictEqual(await page.locator('#adminAuthError').isVisible(), true, 'Phải báo lỗi khi mật khẩu sai');
  console.log('✅ Đã chặn khi nhập sai mật khẩu admin');

  // Thiết lập xử lý dialog thông báo thành công
  page.on('dialog', async dialog => {
    console.log(`[Browser Dialog]: ${dialog.message()}`);
    await dialog.accept();
  });

  // Nhập đúng mật khẩu admin: admin123
  await page.fill('#adminPasswordInput', 'admin123');
  await page.click('button:has-text("Xác Nhận Admin")');
  await page.waitForTimeout(600);

  // 3. Kiểm tra trạng thái sau khi đăng nhập Admin
  assert.strictEqual(await adminBadgeActive.isVisible(), true, 'Huy hiệu Admin: Bật phải hiển thị');
  assert.strictEqual(await btnAdminLogin.isHidden(), true, 'Nút Đăng nhập phải ẩn khi đã là Admin');

  // Các dòng trong bảng phải xuất hiện nút Xóa màu đỏ
  deleteButtons = await page.locator('.btn-delete-report').count();
  assert(deleteButtons > 0, 'Phải hiển thị các nút Xóa đỏ khi ở quyền Admin');
  console.log(`✅ Chế độ Admin kích hoạt thành công, tìm thấy ${deleteButtons} nút xóa báo cáo`);

  // Chụp ảnh giao diện Admin với các nút xóa
  await page.screenshot({ path: path.resolve(__dirname, 'portal_admin_mode_with_delete_buttons.png') });

  // 4. Test chức năng xóa báo cáo
  const firstDeleteBtn = page.locator('.btn-delete-report').first();
  await firstDeleteBtn.click();
  await page.waitForTimeout(300);

  const modalConfirmDelete = page.locator('#modalConfirmDelete');
  assert.strictEqual(await modalConfirmDelete.isVisible(), true, 'Modal xác nhận xóa phải hiển thị');
  const delDocId = await page.locator('#delDocId').textContent();
  console.log(`Đang thực hiện xóa báo cáo mẫu: ${delDocId}`);

  // Chụp ảnh modal xác nhận xóa
  await page.screenshot({ path: path.resolve(__dirname, 'portal_confirm_delete_modal.png') });

  // Bấm Xác nhận Xóa Vĩnh Viễn
  await page.click('#btnExecuteDelete');
  await modalConfirmDelete.waitFor({ state: 'hidden', timeout: 10000 });
  console.log('✅ Đã thực hiện xóa báo cáo thành công!');

  // Chụp ảnh kết quả sau khi xóa
  await page.screenshot({ path: path.resolve(__dirname, 'portal_after_deleted_report.png') });

  // B. KIỂM TRA LOADING OVERLAY TRONG INDEX.HTML
  const indexPath = 'file:///' + path.resolve(__dirname, '../index.html').replace(/\\/g, '/');
  console.log('\nTruy cập:', indexPath);
  await page.goto(indexPath, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  const viewerSigningOverlay = page.locator('#viewerSigningOverlay');
  const existsOverlay = await viewerSigningOverlay.count();
  assert.strictEqual(existsOverlay, 1, 'Phải tồn tại phần tử #viewerSigningOverlay');

  // Mở modalDocViewer trước khi kích hoạt loader
  await page.evaluate(() => {
    const modal = document.getElementById('modalDocViewer');
    if (modal) modal.classList.remove('hidden');
    if (typeof showViewerSigningLoader === 'function') {
      showViewerSigningLoader('Đang niêm phong chữ ký số và cập nhật quy trình...', 'Đang Ký Duyệt Hồ Sơ');
    }
  });
  await page.waitForTimeout(400);

  assert.strictEqual(await viewerSigningOverlay.isVisible(), true, 'Overlay loading phải hiển thị khi gọi showViewerSigningLoader');
  const titleText = await page.locator('#viewerSigningTitle').textContent();
  const statusText = await page.locator('#viewerSigningStatusText').textContent();
  assert(titleText.includes('Đang Ký Duyệt Hồ Sơ'), 'Tiêu đề overlay phải chính xác');
  assert(statusText.includes('Đang niêm phong'), 'Thông điệp overlay phải chính xác');
  console.log('✅ Overlay Loading hiển thị mượt mà với tiêu đề và thông điệp động');

  // Chụp ảnh Overlay Loading
  await page.screenshot({ path: path.resolve(__dirname, 'viewer_signing_loader_overlay.png') });

  // Kiểm tra updateViewerSigningLoader
  await page.evaluate(() => {
    if (typeof updateViewerSigningLoader === 'function') {
      updateViewerSigningLoader('Đang đồng bộ báo cáo lên Google Drive nhà trường...', 'Đang Lưu Trữ');
    }
  });
  await page.waitForTimeout(300);
  const updatedStatus = await page.locator('#viewerSigningStatusText').textContent();
  assert(updatedStatus.includes('Google Drive'), 'Thông điệp cập nhật phải hiển thị đúng');
  console.log('✅ Cập nhật thông điệp tiến trình động thành công');

  // Kiểm tra hideViewerSigningLoader với icon tích xanh
  await page.evaluate(() => {
    if (typeof hideViewerSigningLoader === 'function') {
      hideViewerSigningLoader('🎉 Đã ký số và chuyển tiếp thành công!');
    }
  });
  await page.waitForTimeout(400);
  const iconText = await page.locator('#viewerSigningIcon').textContent();
  assert.strictEqual(iconText.trim(), '✅', 'Icon phải chuyển thành tích xanh khi hoàn tất');
  console.log('✅ Tích xanh chúc mừng và niêm phong thành công hiển thị trơn tru');

  // Chụp ảnh tích xanh chúc mừng
  await page.screenshot({ path: path.resolve(__dirname, 'viewer_signing_success_green_check.png') });

  await page.waitForTimeout(1000);
  assert.strictEqual(await viewerSigningOverlay.isHidden(), true, 'Overlay phải tự động ẩn sau 800ms');
  console.log('✅ Overlay tự động đóng mượt mà sau hiệu ứng tích xanh');

  await browser.close();
  console.log('\n🎉 TẤT CẢ CÁC BƯỚC KIỂM THỬ ĐÃ PASS 100% HOÀN HẢO!');
})();
