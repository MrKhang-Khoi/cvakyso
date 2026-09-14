const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const assert = require('assert');

(async () => {
  console.log('🚀 Bắt đầu kịch bản kiểm thử toàn diện hiệu ứng Loading Chờ khi Ký Số...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const indexPath = 'file:///' + path.resolve(__dirname, '../index.html').replace(/\\/g, '/');
  console.log('Truy cập:', indexPath);
  await page.goto(indexPath, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  // 1. Mở Document Viewer với hồ sơ mẫu
  console.log('1. Mở Document Viewer...');
  await page.evaluate(() => {
    // Giả lập mở tài liệu trong Document Viewer
    const modal = document.getElementById('modalDocViewer');
    if (modal) modal.classList.remove('hidden');

    const fileNameEl = document.getElementById('viewerFileName');
    if (fileNameEl) fileNameEl.textContent = 'Bao_Cao_Chuyen_Mon_To_Toan_Tin_Thang_9.pdf';

    // Bật thanh ký số
    const chainedBar = document.getElementById('viewerChainedSignBar');
    if (chainedBar) chainedBar.classList.remove('hidden');

    const originLabel = document.getElementById('viewerChainedDocOrigin');
    if (originLabel) originLabel.textContent = 'Từ: Hà Văn Tý (1 chữ ký đã có)';
  });
  await page.waitForTimeout(600);

  // Chụp ảnh Giai đoạn 1: Viewer đang mở hồ sơ
  const img1 = path.resolve(__dirname, 'stage1_viewer_opened.png');
  await page.screenshot({ path: img1 });
  console.log('📸 Đã chụp Stage 1: Document Viewer đang mở');

  // 2. Kích hoạt bước Ký Số: Ngay khi bấm xác nhận, modal countdown đóng ngay và Viewer Loading Overlay bật lên
  console.log('2. Kích hoạt Loading Overlay khi bắt đầu ký số...');
  await page.evaluate(() => {
    showViewerSigningLoader('Đang kết nối EduSign Agent và niêm phong chữ ký số PAdES X.509...', 'Đang Ký Số & Niêm Phong');
  });
  await page.waitForTimeout(500);

  // Kiểm tra tính hiển thị của Overlay
  const overlay = page.locator('#viewerSigningOverlay');
  assert.strictEqual(await overlay.isVisible(), true, 'Overlay loading phải hiển thị');

  // Chụp ảnh Giai đoạn 2: Overlay xuất hiện với Neon Spinner và thông điệp kết nối Agent
  const img2 = path.resolve(__dirname, 'stage2_signing_loader_neon_pulse.png');
  await page.screenshot({ path: img2 });
  console.log('📸 Đã chụp Stage 2: Neon Pulse Spinner và tiến trình kết nối');

  // 3. Giai đoạn 3: Cập nhật thông điệp - Đang ký duyệt hồ sơ
  console.log('3. Cập nhật thông điệp cập nhật quy trình...');
  await page.evaluate(() => {
    updateViewerSigningLoader('Đang cập nhật chữ ký số vào quy trình hồ sơ luân chuyển...', 'Đang Ký Duyệt Hồ Sơ');
  });
  await page.waitForTimeout(500);

  const img3 = path.resolve(__dirname, 'stage3_signing_updating_workflow.png');
  await page.screenshot({ path: img3 });
  console.log('📸 Đã chụp Stage 3: Đang cập nhật chữ ký số vào quy trình');

  // 4. Giai đoạn 4: Đồng bộ lên Google Drive nhà trường
  console.log('4. Cập nhật thông điệp lưu trữ Google Drive...');
  await page.evaluate(() => {
    updateViewerSigningLoader('Đang đồng bộ báo cáo lên Google Drive nhà trường...', 'Đang Lưu Trữ Báo Cáo');
  });
  await page.waitForTimeout(500);

  const img4 = path.resolve(__dirname, 'stage4_signing_sync_google_drive.png');
  await page.screenshot({ path: img4 });
  console.log('📸 Đã chụp Stage 4: Đang đồng bộ lên Google Drive');

  // 5. Giai đoạn 5: Hiển thị Tích Xanh Thành Công (✅)
  console.log('5. Hiển thị Tích Xanh Thành Công (✅)...');
  await page.evaluate(() => {
    hideViewerSigningLoader('🎉 Báo cáo đã hoàn tất và niêm phong thành công!');
  });
  await page.waitForTimeout(300);

  const iconText = await page.locator('#viewerSigningIcon').textContent();
  assert.strictEqual(iconText.trim(), '✅', 'Icon phải là tích xanh');

  const img5 = path.resolve(__dirname, 'stage5_signing_success_green_check.png');
  await page.screenshot({ path: img5 });
  console.log('📸 Đã chụp Stage 5: Tích xanh niêm phong thành công');

  // 6. Giai đoạn 6: Tự động đóng Overlay sau 800ms
  await page.waitForTimeout(1000);
  assert.strictEqual(await overlay.isHidden(), true, 'Overlay phải tự động ẩn sau 800ms');
  console.log('✅ Giai đoạn 6: Tự động đóng overlay mượt mà hoàn tất!');

  await browser.close();
  console.log('\n🎉 KIỂM THỬ THÀNH CÔNG VỚI ĐẦY ĐỦ MINH CHỨNG 5 GIAI ĐOẠN!');
})();
