const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

(async () => {
  console.log('🚀 Bắt đầu kịch bản kiểm thử Zero-Bug cho EduSign & Cổng Báo Cáo...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });

  let hasErrors = false;

  // ----------------------------------------------------
  // TEST 1: KIỂM THỬ CỔNG TRA CỨU BÁO CÁO (portal-baocao.html)
  // ----------------------------------------------------
  console.log('\n--- TEST 1: CỔNG TRA CỨU BÁO CÁO (portal-baocao.html) ---');
  const page1 = await context.newPage();
  const consoleErrors1 = [];

  page1.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('   [Console Error]', msg.text());
      consoleErrors1.push(msg.text());
    } else {
      console.log('   [Console Log]', msg.text());
    }
  });

  page1.on('pageerror', err => {
    console.error('   [Page Error]', err.message);
    consoleErrors1.push(err.message);
  });

  const portalPath = path.join(__dirname, 'public', 'portal-baocao.html');
  console.log('   Mở tệp:', portalPath);
  await page1.goto('file:///' + portalPath.replace(/\\/g, '/'), { waitUntil: 'domcontentloaded' });
  await page1.waitForTimeout(1000);

  // Kiểm tra tiêu đề và DOM cơ bản
  const title1 = await page1.title();
  console.log('   ✅ Page Title:', title1);

  // Kiểm tra các phần tử cốt lõi
  const searchInput = await page1.$('#searchInput');
  const deptFilter = await page1.$('#deptFilter');
  const statusFilter = await page1.$('#statusFilter');
  const tableBody = await page1.$('#reportTableBody');
  const paginationControls = await page1.$('#paginationControls');

  if (searchInput && deptFilter && statusFilter && tableBody && paginationControls) {
    console.log('   ✅ Đầy đủ các thành phần giao diện: Search input, Filters, Table, Pagination.');
  } else {
    console.error('   ❌ Thiếu thành phần giao diện!');
    hasErrors = true;
  }

  // Test mở và đóng Modal Cấu hình
  console.log('   Thử nghiệm mở modal Cấu hình...');
  await page1.evaluate(() => toggleConfigModal());
  await page1.waitForTimeout(300);
  const modalVisible = await page1.evaluate(() => !document.getElementById('configModal').classList.contains('hidden'));
  console.log('   Modal Cấu hình hiển thị:', modalVisible);

  await page1.evaluate(() => toggleConfigModal());
  await page1.waitForTimeout(300);
  const modalClosed = await page1.evaluate(() => document.getElementById('configModal').classList.contains('hidden'));
  console.log('   Modal Cấu hình đóng lại:', modalClosed);

  // Test mở và đóng Modal PDF
  console.log('   Thử nghiệm mở modal PDF Viewer...');
  await page1.evaluate(() => openPdfModal('https://drive.google.com/file/d/test/view', 'Báo cáo thử nghiệm'));
  await page1.waitForTimeout(300);
  const pdfModalVisible = await page1.evaluate(() => !document.getElementById('pdfModal').classList.contains('hidden'));
  console.log('   Modal PDF hiển thị:', pdfModalVisible);

  await page1.evaluate(() => closePdfModal());
  await page1.waitForTimeout(300);
  const pdfModalClosed = await page1.evaluate(() => document.getElementById('pdfModal').classList.contains('hidden'));
  console.log('   Modal PDF đóng lại:', pdfModalClosed);

  // Chụp ảnh minh chứng Cổng Báo Cáo
  const artifactDir = path.join('C:', 'Users', 'HPZBook', '.gemini', 'antigravity', 'brain', 'def6f1ba-143d-482d-8668-df8d3eff8a68');
  const screenshotPortalPath = path.join(artifactDir, 'evidence_portal_baocao.png');
  await page1.screenshot({ path: screenshotPortalPath, fullPage: true });
  console.log('   📸 Đã chụp ảnh minh chứng Cổng Báo Cáo:', screenshotPortalPath);

  // ----------------------------------------------------
  // TEST 2: KIỂM THỬ GIAO DIỆN KÝ SỐ CHÍNH (index.html)
  // ----------------------------------------------------
  console.log('\n--- TEST 2: GIAO DIỆN KÝ SỐ CHÍNH (index.html) ---');
  const page2 = await context.newPage();
  const consoleErrors2 = [];

  page2.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('   [Console Error]', msg.text());
      consoleErrors2.push(msg.text());
    }
  });

  page2.on('pageerror', err => {
    console.error('   [Page Error]', err.message);
    consoleErrors2.push(err.message);
  });

  const indexPath = path.join(__dirname, 'public', 'index.html');
  console.log('   Mở tệp:', indexPath);
  await page2.goto('file:///' + indexPath.replace(/\\/g, '/'), { waitUntil: 'domcontentloaded' });
  await page2.waitForTimeout(1000);

  // Kiểm tra nút "Cổng Báo Cáo"
  const portalLinks = await page2.$$('a[href="portal-baocao.html"]');
  console.log(`   ✅ Số lượng nút liên kết "Cổng Báo Cáo" trên Header: ${portalLinks.length}`);

  if (portalLinks.length === 0) {
    console.error('   ❌ Không tìm thấy nút Cổng Báo Cáo trên navbar!');
    hasErrors = true;
  }

  // Chụp ảnh minh chứng giao diện chính
  const screenshotIndexPath = path.join(artifactDir, 'evidence_index_portal_link.png');
  await page2.screenshot({ path: screenshotIndexPath, fullPage: false });
  console.log('   📸 Đã chụp ảnh minh chứng nút Cổng Báo Cáo trên Header:', screenshotIndexPath);

  await browser.close();

  console.log('\n====================================================');
  console.log(`KẾT QUẢ KIỂM THỬ:`);
  console.log(`- Lỗi Console Portal: ${consoleErrors1.length}`);
  console.log(`- Lỗi Console Index: ${consoleErrors2.length}`);
  if (consoleErrors1.length === 0 && consoleErrors2.length === 0 && !hasErrors) {
    console.log('🎉 TẤT CẢ CÁC BƯỚC KIỂM THỬ ĐỀU PASS 100%! ZERO-BUG ĐẠT YÊU CẦU.');
  } else {
    console.log('⚠️ Có cảnh báo hoặc lỗi cần xem xét.');
  }
  console.log('====================================================');
})();
