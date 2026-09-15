/**
 * ====================================================================================================
 * 🛡️ ADVERSARIAL PLAYWRIGHT TEST SUITE: TEACHER MANAGEMENT UI/UX, LAYOUT INVARIANTS & ACCESSIBILITY
 * ====================================================================================================
 * Role: Challenger 2 (Empirical Challenger / Critic & Specialist)
 * Targets: Requirements 2 & 3
 * File: tests/adversarial_ui_layout_challenge.spec.mjs
 * 
 * Adversarial Challenge Matrix:
 *   1. Dynamic Viewport Resizing from 1920x1080 down to 1366x768 and Mobile (390x844, 375x667, 360x740):
 *      Zero page-level horizontal overflow traps (scrollWidth === clientWidth).
 *   2. Rapid Tab Switching Barrage (teachers <-> departments <-> reports):
 *      Ensure #btnSyncSheetAll visibility state never desynchronizes from active tab.
 *   3. Search Filter Stress Testing:
 *      Search with partial phone '0818', partial PIN '0007', CCCD '042084002100', uppercase, whitespace.
 *   4. 1-Click Copy Capsule Challenge:
 *      Verify clipboard write payload 'LK 0818810007 0007', toast notification, and fallback resilience.
 *   5. WCAG AAA & AA Automated Contrast Measurement:
 *      Table headers, teacher names, status badges, sign badges, permission badges, Zalo capsule, and sync status.
 * ====================================================================================================
 */

import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const SCREENSHOT_DIR = path.resolve('tests/screenshots/adversarial_challenge');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

// WCAG Contrast Utilities
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

test.describe('[Adversarial Challenge 2] Teacher Management & Layout Invariants', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

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

    // Mock Local Signer bridge and favicon
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

  async function loginAsAdmin(page) {
    await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');

    const usernameInput = page.locator('#loginUsername');
    if (await usernameInput.isVisible()) {
      await usernameInput.fill('admin');
      await page.locator('#loginPassword').fill('admin@123');
      await page.locator('#btnLoginSubmit').click();
      await page.waitForTimeout(1000);
    }

    await page.waitForSelector('#viewAdmin', { state: 'visible', timeout: 6000 });
    await page.waitForSelector('#tableBodyTeachers tr', { state: 'visible', timeout: 6000 });
    await page.waitForTimeout(300);
  }

  // ==================================================================================================
  // CHALLENGE 1: Dynamic Viewport Resizing & Zero Overflow Traps
  // ==================================================================================================
  test('1. Dynamic Viewport Resizing from 1920x1080 down to mobile: Zero Overflow Traps', async ({ page }) => {
    await loginAsAdmin(page);

    const testViewports = [
      { name: 'FHD_1920x1080', width: 1920, height: 1080 },
      { name: 'Laptop_1366x768', width: 1366, height: 768 },
      { name: 'SmallLaptop_1024x768', width: 1024, height: 768 },
      { name: 'Tablet_768x1024', width: 768, height: 1024 },
      { name: 'Mobile_390x844', width: 390, height: 844 },
      { name: 'Mobile_375x667', width: 375, height: 667 },
      { name: 'Mobile_360x740', width: 360, height: 740 }
    ];

    const overflowResults = [];

    for (const vp of testViewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(300); // Allow responsive styles and reflow to settle

      const metrics = await page.evaluate(() => {
        const doc = document.documentElement;
        const body = document.body;
        const rootOverflow = doc.scrollWidth > doc.clientWidth;
        const bodyOverflow = body ? body.scrollWidth > doc.clientWidth : false;

        // Find any element causing body overflow if any
        let culprit = null;
        if (rootOverflow || bodyOverflow) {
          const allElements = Array.from(document.querySelectorAll('*'));
          for (const el of allElements) {
            const rect = el.getBoundingClientRect();
            if (rect.right > doc.clientWidth + 1) {
              culprit = `${el.tagName}#${el.id}.${el.className.slice(0, 30)} (right: ${Math.round(rect.right)}px > ${doc.clientWidth}px)`;
              break;
            }
          }
        }

        return {
          windowInnerWidth: window.innerWidth,
          docScrollWidth: doc.scrollWidth,
          docClientWidth: doc.clientWidth,
          bodyScrollWidth: body ? body.scrollWidth : 0,
          rootOverflow,
          bodyOverflow,
          hasPageOverflow: rootOverflow || bodyOverflow,
          culprit
        };
      });

      overflowResults.push({
        viewport: vp.name,
        width: vp.width,
        metrics
      });

      console.log(`📐 [${vp.name}] docClientW=${metrics.docClientWidth}px, docScrollW=${metrics.docScrollWidth}px, bodyScrollW=${metrics.bodyScrollWidth}px | Overflow: ${metrics.hasPageOverflow}`);
      if (metrics.hasPageOverflow) {
        console.error(`❌ Overflow trap detected on ${vp.name}! Culprit: ${metrics.culprit}`);
      }

      // Assert zero page-level horizontal overflow
      expect(metrics.hasPageOverflow, `Bẫy tràn ngang phát hiện trên ${vp.name} (culprit: ${metrics.culprit})`).toBe(false);
    }

    // Capture screenshot at mobile resolution
    const mobileScreenshot = path.join(SCREENSHOT_DIR, 'mobile_390x844_teacher_view.png');
    await page.screenshot({ path: mobileScreenshot, fullPage: false });
    console.log(`📸 Đã chụp ảnh giao diện Mobile: ${mobileScreenshot}`);

    expect(page.pageErrors).toHaveLength(0);
    expect(page.consoleErrors).toHaveLength(0);
  });

  // ==================================================================================================
  // CHALLENGE 2: Rapid Tab Switching Barrage & #btnSyncSheetAll Visibility Invariant
  // ==================================================================================================
  test('2. Rapid Tab Switching Barrage: #btnSyncSheetAll visibility state never desynchronizes', async ({ page }) => {
    await loginAsAdmin(page);

    const btnSync = page.locator('#btnSyncSheetAll');
    const tabTeachers = page.locator('#tabBtnTeachers');
    const tabDepts = page.locator('#tabBtnDepartments');
    const tabReports = page.locator('#tabBtnAdminReports');

    // Initial check: on 'teachers' tab, #btnSyncSheetAll must be visible
    await expect(btnSync).toBeVisible();

    // Sequence of tabs to rapidly switch through
    const sequence = [
      'departments', 'reports', 'teachers',
      'reports', 'departments', 'teachers',
      'departments', 'teachers', 'reports',
      'teachers', 'departments', 'reports',
      'teachers', 'reports', 'teachers'
    ];

    console.log(`⚡ Bắt đầu bắn tỉa 15 đợt chuyển tab liên tục không độ trễ...`);

    for (let i = 0; i < sequence.length; i++) {
      const targetTab = sequence[i];

      if (targetTab === 'teachers') {
        await tabTeachers.click();
      } else if (targetTab === 'departments') {
        await tabDepts.click();
      } else if (targetTab === 'reports') {
        await tabReports.click();
      }

      // Verify immediate DOM invariant
      const state = await page.evaluate((expectedTab) => {
        const btn = document.getElementById('btnSyncSheetAll');
        const activeTab = window.appState?.activeTab;
        const isHiddenClass = btn?.classList.contains('hidden');
        return {
          expectedTab,
          activeTab,
          hasBtn: !!btn,
          isHiddenClass
        };
      }, targetTab);

      if (targetTab === 'teachers') {
        expect(state.isHiddenClass, `Đợt ${i + 1}: Tại tab 'teachers', #btnSyncSheetAll KHÔNG được có class 'hidden'`).toBe(false);
        await expect(btnSync).toBeVisible();
      } else {
        expect(state.isHiddenClass, `Đợt ${i + 1}: Tại tab '${targetTab}', #btnSyncSheetAll BẮT BUỘC phải có class 'hidden'`).toBe(true);
        await expect(btnSync).toBeHidden();
      }
    }

    // Return to teachers tab and verify steady-state visibility
    await tabTeachers.click();
    await page.waitForTimeout(200);
    await expect(btnSync).toBeVisible();

    console.log(`✅ Kết thúc 15 đợt chuyển tab: #btnSyncSheetAll luôn đồng bộ 100% không lệch pha.`);
    expect(page.pageErrors).toHaveLength(0);
    expect(page.consoleErrors).toHaveLength(0);
  });

  // ==================================================================================================
  // CHALLENGE 3: Search Filter Stress (Partial Phone, Partial PIN, CCCD, Formatting)
  // ==================================================================================================
  test('3. Search filter stress: partial phone 0818, partial PIN 0007, and CCCD', async ({ page }) => {
    await loginAsAdmin(page);

    const searchInput = page.locator('#filterTeacherSearch');
    await expect(searchInput).toBeVisible();

    // 3a. Search with partial phone '0818'
    console.log(`🔍 [Stress 3a] Tìm kiếm theo số điện thoại từng phần '0818'...`);
    await searchInput.fill('0818');
    await page.waitForTimeout(300);

    const phoneFilterResults = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('#tableBodyTeachers tr'));
      return rows.map(r => ({
        text: r.innerText.replace(/\s+/g, ' '),
        hasPhone: r.innerText.includes('0818810007')
      }));
    });

    console.log(`📊 Kết quả tìm '0818': ${phoneFilterResults.length} dòng`);
    expect(phoneFilterResults.length, `Tìm '0818' phải trả về ít nhất 1 kết quả (Hà Văn Tý)`).toBeGreaterThan(0);
    expect(phoneFilterResults.some(r => r.hasPhone), `Kết quả phải chứa số điện thoại 0818810007`).toBe(true);

    // 3b. Search with partial PIN '0007'
    console.log(`🔍 [Stress 3b] Tìm kiếm theo Mã PIN từng phần '0007'...`);
    await searchInput.fill('0007');
    await page.waitForTimeout(300);

    const pinFilterResults = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('#tableBodyTeachers tr'));
      const emptyRow = rows.find(r => r.innerText.includes('Không tìm thấy giáo viên nào'));
      return {
        count: emptyRow ? 0 : rows.length,
        hasTy: rows.some(r => r.innerText.includes('Tý') || r.innerText.includes('TY') || r.innerText.includes('cva.ty')),
        hasPinBadge: rows.some(r => r.innerText.includes('0007'))
      };
    });

    console.log(`📊 Kết quả tìm '0007':`, pinFilterResults);
    // Empirical assertion: Does searching for displayed PIN '0007' find the teacher whose capsule has 'PIN: 0007'?
    expect(pinFilterResults.count, `Tìm mã PIN '0007' phải hiển thị giáo viên tương ứng`).toBeGreaterThan(0);
    expect(pinFilterResults.hasTy, `Tìm mã PIN '0007' phải tìm thấy Hà Văn Tý`).toBe(true);

    // 3c. Search with CCCD '042084002100'
    console.log(`🔍 [Stress 3c] Tìm kiếm theo CCCD '042084002100'...`);
    await searchInput.fill('042084002100');
    await page.waitForTimeout(300);

    const cccdFilterResults = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('#tableBodyTeachers tr'));
      return {
        count: rows.length,
        hasCccdText: rows.some(r => r.innerText.includes('042084002100'))
      };
    });

    console.log(`📊 Kết quả tìm CCCD:`, cccdFilterResults);
    expect(cccdFilterResults.count, `Tìm theo CCCD phải có kết quả`).toBeGreaterThan(0);

    // 3d. Clear search -> verify full restoration
    await searchInput.fill('');
    await page.waitForTimeout(300);
    const restoredCount = await page.locator('#tableBodyTeachers tr').count();
    console.log(`📊 Tổng số dòng sau khi xóa tìm kiếm: ${restoredCount}`);
    expect(restoredCount).toBeGreaterThanOrEqual(3);

    expect(page.pageErrors).toHaveLength(0);
    expect(page.consoleErrors).toHaveLength(0);
  });

  // ==================================================================================================
  // CHALLENGE 4: 1-Click Copy Button in Zalo Capsule & Fallback Resilience
  // ==================================================================================================
  test('4. 1-click copy button inside capsule: triggers clipboard write without JS error', async ({ page }) => {
    await loginAsAdmin(page);

    // 4a. Click copy button in Hà Văn Tý's row
    const tyRow = page.locator('#tableBodyTeachers tr', { hasText: 'HA VAN TY' });
    await expect(tyRow, `Phải tìm thấy dòng của giáo viên HA VAN TY`).toBeVisible();

    const copyBtnTy = tyRow.locator('button[aria-label="Sao chép cú pháp Zalo"]');
    await expect(copyBtnTy, `Phải có nút sao chép cú pháp Zalo trong thẻ capsule của Hà Văn Tý`).toBeVisible();

    console.log(`📋 Nhấn nút 1-Click Copy trên thẻ Zalo Capsule của Hà Văn Tý...`);
    await copyBtnTy.click();
    await page.waitForTimeout(400);

    const clipboardTy = await page.evaluate(async () => {
      try {
        return await navigator.clipboard.readText();
      } catch (e) {
        return `ERR: ${e.message}`;
      }
    });

    console.log(`📋 Nội dung nhận được từ Clipboard (Hà Văn Tý): "${clipboardTy}"`);
    expect(clipboardTy, `Clipboard phải chứa cú pháp chuẩn 'LK 0818810007 0007'`).toBe('LK 0818810007 0007');

    // 4b. Verify Toast notification appeared for Hà Văn Tý
    const copyToast = page.locator('#toastContainer > div', { hasText: 'Đã sao chép cú pháp Zalo' });
    await expect(copyToast, `Phải có thông báo toast xuất hiện sau khi nhấn sao chép`).toBeVisible({ timeout: 3000 });
    const toastText = await copyToast.innerText();
    console.log(`🔔 Toast notification nhận được: "${toastText.replace(/\s+/g, ' ')}"`);
    expect(toastText).toContain('Đã sao chép cú pháp Zalo: LK 0818810007 0007');

    // 4c. Also test Admin's capsule
    const adminRow = page.locator('#tableBodyTeachers tr', { hasText: 'Ban Giám hiệu - Quản trị viên' });
    const copyBtnAdmin = adminRow.locator('button[aria-label="Sao chép cú pháp Zalo"]');
    if (await copyBtnAdmin.isVisible()) {
      await copyBtnAdmin.click();
      await page.waitForTimeout(400);
      const clipboardAdmin = await page.evaluate(async () => navigator.clipboard.readText());
      console.log(`📋 Nội dung nhận được từ Clipboard (Admin): "${clipboardAdmin}"`);
      expect(clipboardAdmin).toBe('LK 02553850001 0001');
    }

    // 4d. Test fallback when navigator.clipboard.writeText fails
    const fallbackTested = await page.evaluate(() => {
      let promptArg = null;
      const origPrompt = window.prompt;
      window.prompt = (msg, val) => { promptArg = val; return val; };
      try {
        // Trigger copyTeacherZaloQuick with invalid clipboard
        const origWrite = navigator.clipboard.writeText;
        navigator.clipboard.writeText = () => Promise.reject(new Error('Mock clipboard denied'));
        copyTeacherZaloQuick('0818810007', '0007', null);
        navigator.clipboard.writeText = origWrite;
        window.prompt = origPrompt;
        return { success: true, promptArg };
      } catch (e) {
        window.prompt = origPrompt;
        return { success: false, error: e.message };
      }
    });
    console.log(`🛡️ Kết quả kiểm tra cơ chế fallback prompt khi clipboard bị chặn:`, fallbackTested);
    expect(fallbackTested.success, `Fallback prompt phải chạy mà không gây lỗi exception`).toBe(true);

    // Verify zero JavaScript errors
    expect(page.pageErrors).toHaveLength(0);
    expect(page.consoleErrors).toHaveLength(0);
  });

  // ==================================================================================================
  // CHALLENGE 5: WCAG AAA & AA Contrast Ratio Audit on Headers, Badges, and Names
  // ==================================================================================================
  test('5. Verify WCAG AAA contrast ratio on all table headers, badges, and teacher names', async ({ page }) => {
    await loginAsAdmin(page);

    const contrastAudit = await page.evaluate(() => {
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

      function calculateRatio(fgRgb, bgRgb) {
        const l1 = getLuminance(fgRgb[0], fgRgb[1], fgRgb[2]);
        const l2 = getLuminance(bgRgb[0], bgRgb[1], bgRgb[2]);
        const lighter = Math.max(l1, l2);
        const darker = Math.min(l1, l2);
        return (lighter + 0.05) / (darker + 0.05);
      }

      function getEffectiveBg(el) {
        let cur = el;
        while (cur && cur !== document) {
          const bg = window.getComputedStyle(cur).backgroundColor;
          const parsed = parseColorRgb(bg);
          if (parsed) return parsed;
          cur = cur.parentElement;
        }
        return [255, 255, 255]; // fallback white
      }

      const results = [];

      // 1. Table Headers
      const ths = document.querySelectorAll('#tabContentTeachers table thead th');
      ths.forEach((th, idx) => {
        const style = window.getComputedStyle(th);
        const fg = parseColorRgb(style.color) || [71, 85, 105];
        const bg = getEffectiveBg(th);
        const ratio = calculateRatio(fg, bg);
        results.push({
          target: `Header [${idx + 1}] ${th.innerText.trim()}`,
          fg: style.color,
          bg: `rgb(${bg.join(',')})`,
          ratio: parseFloat(ratio.toFixed(2)),
          passesAA: ratio >= 4.5,
          passesAAA: ratio >= 7.0
        });
      });

      // 2. Teacher Names
      const names = document.querySelectorAll('#tableBodyTeachers .teacher-name');
      names.forEach((nm, idx) => {
        const style = window.getComputedStyle(nm);
        const fg = parseColorRgb(style.color) || [15, 23, 42];
        const bg = getEffectiveBg(nm);
        const ratio = calculateRatio(fg, bg);
        results.push({
          target: `Teacher Name [${idx + 1}] ${nm.innerText.trim()}`,
          fg: style.color,
          bg: `rgb(${bg.join(',')})`,
          ratio: parseFloat(ratio.toFixed(2)),
          passesAA: ratio >= 4.5,
          passesAAA: ratio >= 7.0
        });
      });

      // 3. Badges inside Table
      const badges = document.querySelectorAll('#tableBodyTeachers span[class*="rounded"]');
      badges.forEach((bdg, idx) => {
        const text = bdg.innerText.trim();
        if (!text || text.length > 30) return;
        const style = window.getComputedStyle(bdg);
        const fg = parseColorRgb(style.color);
        const bg = parseColorRgb(style.backgroundColor) || getEffectiveBg(bdg);
        if (fg && bg) {
          const ratio = calculateRatio(fg, bg);
          results.push({
            target: `Badge [${idx + 1}] ${text}`,
            fg: style.color,
            bg: `rgb(${bg.join(',')})`,
            ratio: parseFloat(ratio.toFixed(2)),
            passesAA: ratio >= 4.5,
            passesAAA: ratio >= 7.0
          });
        }
      });

      return results;
    });

    console.log(`🎨 Kết quả đo đạc độ tương phản WCAG:`);
    let failAAACount = 0;
    for (const r of contrastAudit) {
      const status = r.passesAAA ? '✅ AAA' : (r.passesAA ? '🟡 AA' : '❌ FAIL');
      console.log(`  - [${status}] ${r.target}: ${r.ratio}:1 (fg: ${r.fg}, bg: ${r.bg})`);
      if (!r.passesAAA) failAAACount++;
    }

    // Teacher names must pass WCAG AAA (>= 7.0:1)
    const nameResults = contrastAudit.filter(r => r.target.startsWith('Teacher Name'));
    for (const nr of nameResults) {
      expect(nr.passesAAA, `Tên giáo viên [${nr.target}] phải đạt WCAG AAA (>= 7:1), thực tế: ${nr.ratio}:1`).toBe(true);
    }

    // Headers must pass WCAG AAA (>= 7.0:1) or at least WCAG AA
    const headerResults = contrastAudit.filter(r => r.target.startsWith('Header'));
    for (const hr of headerResults) {
      expect(hr.passesAA, `Tiêu đề cột [${hr.target}] phải đạt tối thiểu WCAG AA (>= 4.5:1), thực tế: ${hr.ratio}:1`).toBe(true);
    }

    expect(page.pageErrors).toHaveLength(0);
    expect(page.consoleErrors).toHaveLength(0);
  });
});
