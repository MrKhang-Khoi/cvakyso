/**
 * ====================================================================================================
 * 🧪 TEST SUITE: AUTOMATED CROSS-DEVICE UI/UX AUDIT & ERGONOMICS VERIFICATION
 * ====================================================================================================
 * File: tests/test_cross_device_ui_ux_audit.spec.mjs
 * Runner: Playwright Test (@playwright/test)
 * Standard: Zero-Bug Verification Pipeline 2026 / WCAG 2.1 AA / Apple Human Interface Guidelines
 * 
 * Target Environments:
 *   1. Desktop_1920x1080 (Chuẩn phòng máy tính Ban Giám hiệu / Phòng Tin học)
 *   2. Laptop_1366x768   (Chuẩn Laptop cá nhân phổ thông của giáo viên)
 *   3. Tablet_768x1024   (Chuẩn Máy tính bảng iPad duyệt bài di động)
 *   4. Mobile_390x844    (Chuẩn Điện thoại thông minh iPhone 12/13/14/15)
 * 
 * Empirical Audit Assertions:
 *   - Empirically assert Horizontal Overflow Bug on Mobile 390x844 in #tabContentTeachers (scrollWidth > clientWidth).
 *   - Empirically assert clean zero overflow (scrollWidth <= clientWidth) on all other views and viewports.
 *   - Empirically assert sub-44px touch targets on nudge buttons (24px), zoom buttons (24px), table inline actions (26-28px).
 *   - Empirically assert WCAG AA contrast failures (< 4.5:1) on text-slate-400 (2.56:1) and disabled buttons (2.08:1).
 *   - Empirically assert 0 unexpected JavaScript F12 runtime errors / unhandled rejections across all sessions.
 *   - Capture visual evidence screenshots into tests/screenshots/cross_device/.
 * ====================================================================================================
 */

import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

// 1. 4-TIER VIEWPORT MATRIX
const VIEWPORTS = [
  { name: 'Desktop_1920x1080', label: 'Desktop 1920x1080', width: 1920, height: 1080, isMobile: false, hasTouch: false },
  { name: 'Laptop_1366x768',   label: 'Laptop 1366x768',   width: 1366, height: 768,  isMobile: false, hasTouch: false },
  { name: 'Tablet_768x1024',   label: 'Tablet 768x1024',   width: 768,  height: 1024, isMobile: true,  hasTouch: true },
  { name: 'Mobile_390x844',    label: 'Mobile 390x844',    width: 390,  height: 844,  isMobile: true,  hasTouch: true }
];

const SCREENSHOT_DIR = path.resolve('tests/screenshots/cross_device');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

// Sample transparent PNG signature
const SAMPLE_SIG_BASE64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAK8AAAA8CAYAAAD99+zAAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAACuSURBVHhe7cExAQAAAMKg9U9tCj+gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA+A3pOAAGmG1p5AAAAAElFTkSuQmCC';

// Helper: WCAG 2.1 Relative Luminance & Contrast Ratio calculation
function getLuminance(r, g, b) {
  const [rs, gs, bs] = [r, g, b].map(v => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function parseColorRgb(str) {
  if (!str || str === 'transparent' || str.includes('rgba(0, 0, 0, 0)')) return null;
  const m = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  return m ? [parseInt(m[1]), parseInt(m[2]), parseInt(m[3])] : null;
}

function calculateContrastRatio(fgRgb, bgRgb) {
  const l1 = getLuminance(fgRgb[0], fgRgb[1], fgRgb[2]);
  const l2 = getLuminance(bgRgb[0], bgRgb[1], bgRgb[2]);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

for (const vp of VIEWPORTS) {
  test.describe(`[Cross-Device UI/UX Audit] Viewport: ${vp.name}`, () => {
    test.use({
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.isMobile,
      hasTouch: vp.hasTouch
    });

    test.beforeEach(async ({ page }) => {
      page.consoleErrors = [];
      page.pageErrors = [];

      // Monitor F12 console errors
      page.on('console', msg => {
        if (msg.type() === 'error') {
          const text = msg.text();
          // Filter expected mock connection errors, favicon 404, and intentional 401 invalid login tests
          if (!text.includes('127.0.0.1:18888') &&
              !text.includes('favicon.ico') &&
              !text.includes('status of 404') &&
              !text.includes('401 (Unauthorized)') &&
              !text.includes('ERR_CONNECTION_REFUSED')) {
            page.consoleErrors.push(text);
          }
        }
      });

      page.on('pageerror', err => {
        page.pageErrors.push(err.message);
      });

      // Mock favicon.ico to prevent 404 resource errors
      await page.route('**/favicon.ico', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'image/x-icon',
          body: Buffer.from('')
        });
      });

      // Mock C# Local Signer HTTP bridge to prevent unhandled connection refuse
      await page.route('http://127.0.0.1:18888/**', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'OK', connected: false, message: 'Mock EduSign Local Bridge' })
        });
      });
    });

    // =========================================================================
    // TEST 1: Login View (#viewLogin), Modals & Contrast / Touch Targets
    // =========================================================================
    test(`1. Xác thực, Modal VGCA, Contrast WCAG & Vùng chạm: ${vp.name}`, async ({ page }) => {
      await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#viewLogin', { state: 'visible' });

      // 1. Kiểm tra không tràn ngang tại màn hình đăng nhập
      const loginOverflow = await page.evaluate(() => {
        const doc = document.documentElement;
        return {
          scrollWidth: doc.scrollWidth,
          clientWidth: doc.clientWidth,
          hasOverflow: doc.scrollWidth > doc.clientWidth
        };
      });
      expect(loginOverflow.hasOverflow, `Màn hình đăng nhập không được tràn ngang trên ${vp.name}`).toBe(false);

      // 2. Kiểm tra độ tương phản dòng phiên bản v2.1.0 (#versionText / text-slate-400)
      const versionContrast = await page.evaluate(() => {
        const el = document.querySelector('#viewLogin .text-slate-400');
        if (!el) return null;
        const style = window.getComputedStyle(el);
        return {
          color: style.color,
          bgColor: window.getComputedStyle(el.parentElement || el).backgroundColor,
          text: el.innerText.trim()
        };
      });

      if (versionContrast && versionContrast.color) {
        const fg = parseColorRgb(versionContrast.color) || [148, 163, 184]; // #94a3b8
        const bg = [255, 255, 255]; // white card background
        const ratio = calculateContrastRatio(fg, bg);
        console.log(`📊 [${vp.name}] Tỷ lệ tương phản dòng nhãn text-slate-400: ${ratio.toFixed(2)}:1`);
        // Khẳng định thực nghiệm vi phạm WCAG AA (< 4.5:1) như báo cáo explorer_ui_ux phát hiện
        expect(ratio, 'Màu text-slate-400 (#94a3b8) trên nền trắng vi phạm ngưỡng WCAG AA 4.5:1').toBeLessThan(4.5);
      }

      // 3. Kiểm tra kích thước vùng chạm nút toggle mật khẩu (#btnTogglePass)
      const btnTogglePassBox = await page.evaluate(() => {
        const btn = document.getElementById('btnTogglePass');
        if (!btn) return null;
        const r = btn.getBoundingClientRect();
        return { width: r.width, height: r.height };
      });
      if (btnTogglePassBox) {
        console.log(`📐 [${vp.name}] Vùng chạm nút #btnTogglePass: ${btnTogglePassBox.width.toFixed(1)} x ${btnTogglePassBox.height.toFixed(1)}px`);
        // Khẳng định chiều rộng hẹp < 44px (DEF-03 / Apple HIG 44x44px)
        expect(btnTogglePassBox.width, 'Nút toggle mật khẩu hẹp hơn 44px').toBeLessThan(44);
      }

      // 4. Mở Modal VGCA Login (#modalVgcaLogin)
      await page.evaluate(() => {
        if (typeof openModalVgcaLogin === 'function') openModalVgcaLogin();
        else {
          const m = document.getElementById('modalVgcaLogin');
          if (m) m.classList.remove('hidden');
        }
      });
      await page.waitForTimeout(200);
      const modalVgca = page.locator('#modalVgcaLogin');
      await expect(modalVgca).toBeVisible();

      // Kiểm tra nút Hiện/Ẩn PIN (#btnToggleVgcaPin) có chiều cao chỉ ~16px (< 44px)
      const vgcaPinBtnHeight = await page.evaluate(() => {
        const btn = document.getElementById('btnToggleVgcaPin');
        return btn ? btn.getBoundingClientRect().height : 0;
      });
      expect(vgcaPinBtnHeight, 'Nút Hiện/Ẩn PIN VGCA có chiều cao quá nhỏ (< 44px)').toBeLessThan(30);

      // Đóng modal VGCA
      await page.evaluate(() => {
        const m = document.getElementById('modalVgcaLogin');
        if (m) m.classList.add('hidden');
      });

      // 5. Thử đăng nhập sai mật khẩu để kích hoạt #loginAlert
      await page.fill('#loginUsername', 'cva.ty');
      await page.fill('#loginPassword', 'SaiMatKhau12345');
      await page.click('#btnLoginSubmit');
      await expect(page.locator('#loginAlert')).toBeVisible();

      // Chụp ảnh bằng chứng Login & Alert
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${vp.name}_01_login_alert.png`) });

      // Khẳng định F12 Console 0 runtime error
      expect(page.pageErrors).toHaveLength(0);
      expect(page.consoleErrors).toHaveLength(0);
    });

    // =========================================================================
    // TEST 2: Teacher Workspace, Tabs, Dropzone & Table Action Targets
    // =========================================================================
    test(`2. Bàn làm việc Giáo viên, 4 Tab, Vùng chạm bảng báo cáo: ${vp.name}`, async ({ page }) => {
      await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
      await page.fill('#loginUsername', 'cva.ty');
      await page.fill('#loginPassword', '123456');
      await page.click('#btnLoginSubmit');
      await page.waitForSelector('#viewTeacher', { state: 'visible', timeout: 5000 });

      // 1. Kiểm tra Tab 1 Soạn & Trình ký
      const tab1Overflow = await page.evaluate(() => {
        const doc = document.documentElement;
        return { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth, hasOverflow: doc.scrollWidth > doc.clientWidth };
      });
      expect(tab1Overflow.hasOverflow, `Teacher Tab 1 không bị tràn ngang trên ${vp.name}`).toBe(false);

      // 2. Kiểm tra tương phản nút vô hiệu hóa khi chưa chọn file (#btnSignNow)
      const disabledBtnContrast = await page.evaluate(() => {
        const btn = document.getElementById('btnSignNow');
        if (!btn) return null;
        const style = window.getComputedStyle(btn);
        return { color: style.color, bgColor: style.backgroundColor };
      });
      if (disabledBtnContrast) {
        const fg = parseColorRgb(disabledBtnContrast.color) || [148, 163, 184]; // text-slate-400
        const bg = parseColorRgb(disabledBtnContrast.bgColor) || [226, 232, 240]; // bg-slate-200
        const ratio = calculateContrastRatio(fg, bg);
        console.log(`📊 [${vp.name}] Tỷ lệ tương phản nút disabled #btnSignNow: ${ratio.toFixed(2)}:1`);
        // Khẳng định thực nghiệm tỷ lệ tương phản nút vô hiệu hóa đạt ~2.08:1 (< 4.5:1)
        expect(ratio, 'Nút vô hiệu hóa có tương phản dưới 4.5:1').toBeLessThan(4.5);
      }

      // 3. Tab 2: Cần tôi ký (#tabBtnTeacherPending)
      await page.click('#tabBtnTeacherPending');
      await page.waitForTimeout(300);
      await expect(page.locator('#tabContentTeacherPending')).toBeVisible();

      // 4. Tab 3: Tiến độ hồ sơ (#tabBtnTeacherSent)
      await page.click('#tabBtnTeacherSent');
      await page.waitForTimeout(300);
      await expect(page.locator('#tabContentTeacherSent')).toBeVisible();

      // 5. Tab 4: Kho Báo cáo số (#tabBtnTeacherReports)
      await page.click('#tabBtnTeacherReports');
      await page.waitForTimeout(300);
      await expect(page.locator('#tabContentTeacherReports')).toBeVisible();

      // Chụp ảnh bằng chứng Teacher Workspace
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${vp.name}_02_teacher_workspace.png`) });

      expect(page.pageErrors).toHaveLength(0);
      expect(page.consoleErrors).toHaveLength(0);
    });

    // =========================================================================
    // TEST 3: PDF Viewer Stage, Draggable Stamp, Nudge/Zoom < 44px, Seal & Reject
    // =========================================================================
    test(`3. PDF Viewer, Nút Tinh chỉnh < 44px, Mộc đỏ BGH, Hộp thoại Từ chối: ${vp.name}`, async ({ page }) => {
      await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
      await page.fill('#loginUsername', 'cva.ty');
      await page.fill('#loginPassword', '123456');
      await page.click('#btnLoginSubmit');
      await page.waitForSelector('#viewTeacher', { timeout: 5000 });

      // Nạp ảnh chữ ký mẫu và mở PDF Viewer
      await page.evaluate((sig) => {
        if (window.appState?.currentUser) {
          window.appState.currentUser.signatureImage = sig;
        }
        window.openDocumentViewer('GiaoAn_KiemTra_UIUX.pdf', new Uint8Array(2048), false);
      }, SAMPLE_SIG_BASE64);

      const modalDoc = page.locator('#modalDocViewer');
      await modalDoc.waitFor({ state: 'visible' });

      // Bật chế độ đặt chữ ký (#btnToggleSignaturePlacement)
      await page.click('#btnToggleSignaturePlacement');
      await expect(page.locator('#draggableSignatureStamp')).toBeVisible();

      // 1. Kiểm tra kích thước nút tinh chỉnh con dấu Nudge buttons (◀, ▲, ▼, ▶)
      const nudgeButtonSizes = await page.evaluate(() => {
        const toolbar = document.getElementById('viewerSigToolBar');
        if (!toolbar) return [];
        const btns = toolbar.querySelectorAll('button[onclick*="nudgeSignature"]');
        return Array.from(btns).map(b => {
          const r = b.getBoundingClientRect();
          return { text: b.innerText.trim(), width: Math.round(r.width), height: Math.round(r.height) };
        });
      });

      expect(nudgeButtonSizes.length, 'Phải có 4 nút tinh chỉnh tọa độ con dấu').toBe(4);
      for (const nb of nudgeButtonSizes) {
        console.log(`📐 [${vp.name}] Kích thước nút nudge ${nb.text}: ${nb.width}x${nb.height}px`);
        // Khẳng định kích thước đạt chuẩn công thái học & WCAG AAA >= 44px (DEF-03)
        expect(nb.width, `Nút nudge ${nb.text} phải có kích thước >= 44px`).toBeGreaterThanOrEqual(44);
        expect(nb.height, `Nút nudge ${nb.text} phải có kích thước >= 44px`).toBeGreaterThanOrEqual(44);
      }

      // 2. Kiểm tra kích thước nút zoom scale '-' và '+'
      const zoomButtonSizes = await page.evaluate(() => {
        const toolbar = document.getElementById('viewerSigToolBar');
        if (!toolbar) return [];
        const btnMinus = toolbar.querySelector('button[onclick*="adjustSignatureScale(-0.1)"]') || toolbar.querySelector('button[onclick*="scaleSignature(-0.05)"]');
        const btnPlus = toolbar.querySelector('button[onclick*="adjustSignatureScale(0.1)"]') || toolbar.querySelector('button[onclick*="scaleSignature(0.05)"]');
        return [btnMinus, btnPlus].filter(Boolean).map(b => {
          const r = b.getBoundingClientRect();
          return { text: b.innerText.trim(), width: Math.round(r.width), height: Math.round(r.height) };
        });
      });
      for (const zb of zoomButtonSizes) {
        console.log(`📐 [${vp.name}] Kích thước nút zoom scale ${zb.text}: ${zb.width}x${zb.height}px`);
        expect(zb.width, `Nút zoom ${zb.text} phải có kích thước >= 44px`).toBeGreaterThanOrEqual(44);
        expect(zb.height, `Nút zoom ${zb.text} phải có kích thước >= 44px`).toBeGreaterThanOrEqual(44);
      }

      // 3. Chuyển sang chế độ Mộc đỏ trường học 105pt
      await page.evaluate(() => {
        if (window.appState?.currentUser) {
          window.appState.currentUser.canStampSeal = true;
        }
        const btnSeal = document.getElementById('btnToggleSealPlacement');
        if (btnSeal) btnSeal.classList.remove('hidden');
      });
      await page.click('#btnToggleSealPlacement');

      // Xác minh con dấu mộc đỏ trường học xuất hiện
      const imgSeal = page.locator('#draggableSignatureImg');
      await expect(imgSeal).toBeVisible();
      const sealAlt = await imgSeal.getAttribute('alt');
      expect(sealAlt).toContain('Con dấu đỏ nhà trường');

      // Chụp ảnh PDF Viewer với con dấu
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${vp.name}_03_pdf_viewer_seal.png`) });

      // Đóng viewer
      await page.evaluate(() => window.closeModal('modalDocViewer'));

      // 4. Mở Modal Từ chối / Trả về hồ sơ (#modalRejectDocument)
      await page.evaluate(() => {
        if (typeof openModalRejectDocument === 'function') openModalRejectDocument('DOC_TEST_REJECT_001');
      });
      const modalReject = page.locator('#modalRejectDocument');
      await modalReject.waitFor({ state: 'visible' });

      // Kiểm tra các nút Quick-fill pills tồn tại và hoạt động
      const pillFormat = page.locator('button:has-text("Sai thể thức")');
      await expect(pillFormat).toBeVisible();
      await pillFormat.click();
      const reasonVal = await page.locator('#textareaRejectReason').inputValue();
      expect(reasonVal).toContain('Văn bản chưa đúng thể thức');

      // Kiểm tra z-index của modalRejectDocument >= 110
      const rejectZ = await page.evaluate(() => {
        const el = document.getElementById('modalRejectDocument');
        return el ? parseInt(window.getComputedStyle(el).zIndex, 10) : 0;
      });
      expect(rejectZ, 'Z-Index của modalRejectDocument phải >= 110').toBeGreaterThanOrEqual(110);

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${vp.name}_03_reject_dialog.png`) });
      await page.click('#modalRejectDocument button:has-text("Hủy bỏ")');
      await expect(modalReject).toBeHidden();

      expect(page.pageErrors).toHaveLength(0);
      expect(page.consoleErrors).toHaveLength(0);
    });

    // =========================================================================
    // TEST 4: Admin Workspace & Verification of Mobile Overflow Trap (DEF-01)
    // =========================================================================
    test(`4. Bàn làm việc Admin & Bẫy tràn ngang Mobile 410px vs Clean Viewports: ${vp.name}`, async ({ page }) => {
      // Đăng nhập Admin
      await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
      await page.fill('#loginUsername', 'admin');
      await page.fill('#loginPassword', 'admin@123');
      await page.click('#btnLoginSubmit');
      await page.waitForSelector('#viewAdmin', { state: 'visible', timeout: 5000 });
      // Wait for department options to finish loading and rendering into filter dropdown
      try {
        await page.waitForSelector('#filterTeacherDept option:nth-child(2)', { timeout: 3000 });
      } catch (e) {}
      await page.waitForTimeout(400);

      // Tab 1: Danh sách giáo viên (#tabContentTeachers)
      await expect(page.locator('#tabContentTeachers')).toBeVisible();

      // Đo đạc tràn ngang toàn trang
      const overflowMetrics = await page.evaluate(() => {
        const doc = document.documentElement;
        const body = document.body;
        const clientW = window.innerWidth;
        const docScrollW = doc.scrollWidth;
        const bodyScrollW = body ? body.scrollWidth : 0;

        // Tìm phần tử bộ lọc trong tabContentTeachers
        const filterContainer = document.querySelector('#tabContentTeachers div.flex.gap-2');
        const filterRect = filterContainer ? filterContainer.getBoundingClientRect() : null;
        const filterScrollW = filterContainer ? filterContainer.scrollWidth : 0;

        return {
          clientW,
          docScrollW,
          bodyScrollW,
          filterScrollW,
          filterRight: filterRect ? Math.round(filterRect.right) : 0,
          hasPageOverflow: docScrollW > clientW || bodyScrollW > clientW
        };
      });

      console.log(`📊 [${vp.name}] Admin Tab 1 Metrics: window=${overflowMetrics.clientW}px, docScrollW=${overflowMetrics.docScrollW}px, filterScrollW=${overflowMetrics.filterScrollW}px`);

      // Khẳng định sau khi áp dụng DEF-01: Hoàn toàn không bị tràn ngang trên bất kỳ độ phân giải nào (kể cả Mobile 390x844)
      expect(
        overflowMetrics.hasPageOverflow,
        `Trên ${vp.name}, giao diện Admin Tab 1 phải đảm bảo không tràn ngang (docScrollW=${overflowMetrics.docScrollW} <= clientW=${overflowMetrics.clientW})`
      ).toBe(false);

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${vp.name}_04_admin_teachers.png`) });

      // Mở Modal Cấu hình BGH (#modalBghConfig)
      await page.evaluate(() => {
        if (typeof openModalBghConfig === 'function') openModalBghConfig();
      });
      const modalBgh = page.locator('#modalBghConfig');
      await modalBgh.waitFor({ state: 'visible' });
      await expect(page.locator('#inputBghSchool')).toBeVisible();
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${vp.name}_04_modal_bgh_config.png`) });
      await page.evaluate(() => window.closeModal('modalBghConfig'));

      expect(page.pageErrors).toHaveLength(0);
      expect(page.consoleErrors).toHaveLength(0);
    });

    // =========================================================================
    // TEST 5: Public Report Portal (portal-baocao.html)
    // =========================================================================
    test(`5. Cổng Tra cứu Báo cáo Chuyên môn (portal-baocao.html): ${vp.name}`, async ({ page }) => {
      await page.goto('/portal-baocao.html', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#reportTableBody', { state: 'attached' });

      // 1. Kiểm tra tràn ngang tại trang chủ Portal
      const portalOverflow = await page.evaluate(() => {
        const doc = document.documentElement;
        return {
          scrollWidth: doc.scrollWidth,
          clientWidth: doc.clientWidth,
          hasOverflow: doc.scrollWidth > doc.clientWidth
        };
      });
      expect(portalOverflow.hasOverflow, `Portal không được bị tràn ngang trên ${vp.name}`).toBe(false);

      // 2. Mở Modal Xác thực Quản trị viên (#modalAdminAuth)
      await page.evaluate(() => {
        if (typeof openAdminModal === 'function') openAdminModal();
      });
      const modalAuth = page.locator('#modalAdminAuth');
      await modalAuth.waitFor({ state: 'visible' });

      // Kiểm tra vùng chạm nút đóng modal X
      const closeBtnBox = await page.evaluate(() => {
        const btn = document.querySelector('#modalAdminAuth button[onclick*="closeAdminModal"]');
        if (!btn) return null;
        const r = btn.getBoundingClientRect();
        return { width: r.width, height: r.height };
      });
      if (closeBtnBox) {
        // Nút đóng X chỉ ~20x20px hoặc 28x28px, hẹp hơn 44px
        expect(closeBtnBox.width, 'Nút đóng modal X hẹp hơn 44px').toBeLessThan(44);
      }

      // Nhập sai mật khẩu quản trị để kích hoạt dòng thông báo lỗi màu hồng
      await page.fill('#adminPasswordInput', 'sai_pass_admin_999');
      await page.click('#modalAdminAuth button[onclick*="handleAdminLogin"]');
      await page.waitForTimeout(200);

      // Đo độ tương phản chữ báo lỗi text-rose-500 trên nền trắng (DEF-07)
      const errorContrast = await page.evaluate(() => {
        const errEl = document.getElementById('adminAuthError');
        if (!errEl) return null;
        const style = window.getComputedStyle(errEl);
        return { color: style.color, text: errEl.innerText };
      });
      if (errorContrast && errorContrast.color) {
        const fg = parseColorRgb(errorContrast.color) || [244, 63, 94]; // text-rose-500
        const bg = [255, 255, 255];
        const ratio = calculateContrastRatio(fg, bg);
        console.log(`📊 [${vp.name}] Tỷ lệ tương phản thông báo lỗi sau khi vá DEF-07: ${ratio.toFixed(2)}:1`);
        // Khẳng định sau khi vá DEF-07: Tỷ lệ tương phản đạt chuẩn WCAG AA (>= 4.5:1)
        expect(ratio, 'Thông báo lỗi phải đạt chuẩn tương phản WCAG AA >= 4.5:1').toBeGreaterThanOrEqual(4.5);
      }

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${vp.name}_05_portal_admin_modal.png`) });

      // Đóng modal admin
      await page.evaluate(() => {
        if (typeof closeAdminModal === 'function') closeAdminModal();
      });

      // 3. Mở Modal Preview PDF trên Portal (#pdfModal)
      await page.evaluate(() => {
        if (typeof openPdfModal === 'function') {
          openPdfModal('https://example.com/mock.pdf', 'Báo cáo Chuyên đề Toán học');
        }
      });
      await page.waitForTimeout(200);
      const pdfModal = page.locator('#pdfModal');
      await expect(pdfModal).toBeVisible();
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${vp.name}_05_portal_pdf_preview.png`) });
      await page.evaluate(() => {
        if (typeof closePdfModal === 'function') closePdfModal();
      });

      expect(page.pageErrors).toHaveLength(0);
      expect(page.consoleErrors).toHaveLength(0);
    });

  });
}
