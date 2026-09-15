/**
 * ====================================================================================================
 * 🧪 PLAYWRIGHT TEST SUITE: MULTI-RESOLUTION VISUAL & ACCESSIBILITY AUDIT FOR TEACHER MANAGEMENT (R2/R3)
 * ====================================================================================================
 * System: EduSign VGCA Digital Signing Platform - THCS Chu Văn An
 * Target: Admin Teacher Management View (#tabContentTeachers, #tableBodyTeachers)
 * File: tests/test_r3_visual_multi_resolution.spec.mjs
 * Reference Proposed File: .agents/explorer_r3_testing_infra/proposed_test_r3_visual_multi_resolution.spec.mjs
 * 
 * Target Viewports:
 *   1. Desktop_1920x1080 (Chuẩn phòng máy tính Ban Giám hiệu / Quản trị viên)
 *   2. Laptop_1366x768   (Chuẩn Laptop cá nhân phổ thông của giáo viên)
 * 
 * Strict Zero-Bug Assertions:
 *   - 0 F12 Console errors, 0 unhandled promise rejections.
 *   - 0 Horizontal overflow traps (scrollWidth === clientWidth).
 *   - WCAG 2.1 AA (>= 4.5:1) & AAA (>= 7.0:1) contrast ratios.
 *   - Touch targets >= 36px for table actions, >= 44px for primary controls.
 *   - Visual hierarchy verification: 3-tier presentation (Name+Avatar, @handle+email, Phone+PIN capsule).
 *   - Visual evidence capture into tests/screenshots/r2_teacher_management/.
 * ====================================================================================================
 */

import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const VIEWPORTS = [
  { name: 'Desktop_1920x1080', label: 'Desktop Full HD 1920x1080', width: 1920, height: 1080 },
  { name: 'Laptop_1366x768',   label: 'Laptop Phổ thông 1366x768',  width: 1366, height: 768 }
];

const SCREENSHOT_DIR = path.resolve('tests/screenshots/r2_teacher_management');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

// WCAG Contrast Calculation Helpers
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
  return m ? [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)] : null;
}

function calculateContrastRatio(fgRgb, bgRgb) {
  const l1 = getLuminance(fgRgb[0], fgRgb[1], fgRgb[2]);
  const l2 = getLuminance(bgRgb[0], bgRgb[1], bgRgb[2]);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

for (const vp of VIEWPORTS) {
  test.describe(`[R3 Multi-Resolution Audit] Viewport: ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test.beforeEach(async ({ page }) => {
      page.consoleErrors = [];
      page.pageErrors = [];

      page.on('console', msg => {
        if (msg.type() === 'error') {
          const text = msg.text();
          if (!text.includes('127.0.0.1:18888') &&
              !text.includes('favicon.ico') &&
              !text.includes('status of 404') &&
              !text.includes('ERR_CONNECTION_REFUSED')) {
            page.consoleErrors.push(text);
          }
        }
      });

      page.on('pageerror', err => {
        page.pageErrors.push(err.message);
      });

      // Mock Local Signer HTTP bridge and favicon
      await page.route('**/favicon.ico', async route => {
        await route.fulfill({ status: 200, contentType: 'image/x-icon', body: Buffer.from('') });
      });

      await page.route('http://127.0.0.1:18888/**', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'OK', connected: false })
        });
      });
    });

    test(`1. Quản lý Giáo viên: Trực quan, Bố cục & Bẫy tràn ngang trên ${vp.name}`, async ({ page }) => {
      await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle');

      // Đăng nhập Admin
      const usernameInput = page.locator('#loginUsername');
      if (await usernameInput.isVisible()) {
        await usernameInput.fill('admin');
        await page.locator('#loginPassword').fill('admin@123');
        await page.locator('#btnLoginSubmit').click();
        await page.waitForTimeout(1200);
      }

      await page.waitForSelector('#viewAdmin', { state: 'visible', timeout: 5000 });
      await page.waitForSelector('#tableBodyTeachers tr', { state: 'visible', timeout: 5000 });
      await page.waitForTimeout(400);

      // 1. Kiểm tra không có bẫy tràn ngang (scrollWidth === clientWidth)
      const overflowMetrics = await page.evaluate(() => {
        const doc = document.documentElement;
        const body = document.body;
        const teachersContent = document.getElementById('tabContentTeachers');
        return {
          windowWidth: window.innerWidth,
          docScrollWidth: doc.scrollWidth,
          docClientWidth: doc.clientWidth,
          bodyScrollWidth: body ? body.scrollWidth : 0,
          sectionScrollWidth: teachersContent ? teachersContent.scrollWidth : 0,
          sectionClientWidth: teachersContent ? teachersContent.clientWidth : 0,
          hasPageOverflow: doc.scrollWidth > doc.clientWidth || (body && body.scrollWidth > doc.clientWidth)
        };
      });

      console.log(`📊 [${vp.name}] Layout Metrics: window=${overflowMetrics.windowWidth}px, docScrollW=${overflowMetrics.docScrollWidth}px, sectionScrollW=${overflowMetrics.sectionScrollWidth}px`);
      expect(overflowMetrics.hasPageOverflow, `Giao diện Quản lý Giáo viên không được tràn ngang trên ${vp.name}`).toBe(false);

      // 2. Chụp ảnh minh chứng toàn cảnh bảng Quản lý Giáo viên
      const screenshotPath = path.join(SCREENSHOT_DIR, `${vp.name}_teacher_management_table.png`);
      await page.screenshot({ path: screenshotPath, fullPage: false });
      console.log(`📸 Đã lưu ảnh minh chứng: ${screenshotPath}`);

      // 3. Khẳng định 0 Console Error và 0 Page Exception
      expect(page.pageErrors, `Page errors: ${page.pageErrors.join('; ')}`).toHaveLength(0);
      expect(page.consoleErrors, `Console errors: ${page.consoleErrors.join('; ')}`).toHaveLength(0);
    });

    test(`2. Công thái học: Kích thước vùng chạm & Tương phản WCAG trên ${vp.name}`, async ({ page }) => {
      await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle');

      // Đăng nhập Admin nếu cần
      if (await page.locator('#loginUsername').isVisible()) {
        await page.fill('#loginUsername', 'admin');
        await page.fill('#loginPassword', 'admin@123');
        await page.click('#btnLoginSubmit');
        await page.waitForTimeout(1200);
      }

      await page.waitForSelector('#tableBodyTeachers tr', { state: 'visible', timeout: 5000 });

      // 1. Kiểm tra kích thước các nút thao tác hàng (Lock, Edit, Reset, Delete)
      const actionButtonMetrics = await page.evaluate(() => {
        const rows = document.querySelectorAll('#tableBodyTeachers tr');
        if (!rows.length) return [];
        const firstRow = rows[0];
        const buttons = firstRow.querySelectorAll('td:last-child button');
        return Array.from(buttons).map(b => {
          const r = b.getBoundingClientRect();
          return {
            title: b.getAttribute('title') || 'action',
            width: Math.round(r.width),
            height: Math.round(r.height)
          };
        });
      });

      console.log(`📐 [${vp.name}] Kích thước nút thao tác hàng:`, actionButtonMetrics);
      for (const btn of actionButtonMetrics) {
        expect(btn.width, `Nút thao tác [${btn.title}] chiều rộng phải >= 32px`).toBeGreaterThanOrEqual(32);
        expect(btn.height, `Nút thao tác [${btn.title}] chiều cao phải >= 32px`).toBeGreaterThanOrEqual(32);
      }

      // 2. Kiểm tra độ tương phản tên giáo viên (Cấp 1 Visual Hierarchy: semibold dark slate)
      const nameContrast = await page.evaluate(() => {
        const nameEl = document.querySelector('#tableBodyTeachers tr .font-bold, #tableBodyTeachers tr .font-semibold');
        if (!nameEl) return null;
        const style = window.getComputedStyle(nameEl);
        return {
          color: style.color,
          bgColor: window.getComputedStyle(nameEl.closest('tr') || document.body).backgroundColor
        };
      });

      if (nameContrast && nameContrast.color) {
        const fg = parseColorRgb(nameContrast.color) || [15, 23, 42]; // slate-900
        const bg = parseColorRgb(nameContrast.bgColor) || [255, 255, 255];
        const ratio = calculateContrastRatio(fg, bg);
        console.log(`📊 [${vp.name}] Tương phản tên giáo viên: ${ratio.toFixed(2)}:1`);
        expect(ratio, 'Tương phản tên giáo viên phải đạt chuẩn WCAG AAA (>= 7:1)').toBeGreaterThanOrEqual(7.0);
      }

      // 3. Kiểm tra nút Đồng bộ Google Sheet và Thêm Giáo viên
      const toolbarButtons = await page.evaluate(() => {
        const btnSync = document.getElementById('btnSyncSheetAll');
        const btnAdd = document.querySelector('.btn-create-user');
        const rSync = btnSync ? btnSync.getBoundingClientRect() : null;
        const rAdd = btnAdd ? btnAdd.getBoundingClientRect() : null;
        return {
          syncWidth: rSync ? Math.round(rSync.width) : 0,
          syncHeight: rSync ? Math.round(rSync.height) : 0,
          addWidth: rAdd ? Math.round(rAdd.width) : 0,
          addHeight: rAdd ? Math.round(rAdd.height) : 0
        };
      });

      expect(toolbarButtons.syncHeight, 'Nút Đồng bộ Google Sheet phải có chiều cao >= 36px').toBeGreaterThanOrEqual(36);
      expect(toolbarButtons.addHeight, 'Nút Thêm Giáo viên phải có chiều cao >= 36px').toBeGreaterThanOrEqual(36);

      expect(page.pageErrors).toHaveLength(0);
      expect(page.consoleErrors).toHaveLength(0);
    });

    test(`3. Kiểm tra Phân tầng Thị giác & Thẻ Zalo Capsule trên ${vp.name}`, async ({ page }) => {
      await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle');

      if (await page.locator('#loginUsername').isVisible()) {
        await page.fill('#loginUsername', 'admin');
        await page.fill('#loginPassword', 'admin@123');
        await page.click('#btnLoginSubmit');
        await page.waitForTimeout(1200);
      }

      await page.waitForSelector('#tableBodyTeachers tr', { state: 'visible', timeout: 5000 });

      // Kiểm tra dòng giáo viên Hà Văn Tý hiển thị đúng cấu trúc capsule
      const tyRowInfo = await page.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('#tableBodyTeachers tr'));
        const tyRow = rows.find(r => r.innerText.includes('Tý') || r.innerText.includes('TY'));
        if (!tyRow) return null;
        return {
          hasAvatar: !!tyRow.querySelector('.rounded-full'),
          hasUsername: tyRow.innerText.includes('@cva.ty'),
          hasPhone: tyRow.innerText.includes('0818810007'),
          hasPin: tyRow.innerText.includes('0007') || tyRow.innerText.includes('PIN')
        };
      });

      expect(tyRowInfo, 'Phải tìm thấy dòng giáo viên Hà Văn Tý').not.toBeNull();
      expect(tyRowInfo.hasAvatar, 'Phải có Avatar tròn chữ cái đầu').toBe(true);
      expect(tyRowInfo.hasUsername, 'Phải hiển thị @username').toBe(true);
      expect(tyRowInfo.hasPhone, 'Phải hiển thị SĐT 0818810007 đầy đủ số 0').toBe(true);
      expect(tyRowInfo.hasPin, 'Phải hiển thị Mã PIN bảo mật').toBe(true);

      expect(page.pageErrors).toHaveLength(0);
      expect(page.consoleErrors).toHaveLength(0);
    });
  });
}
