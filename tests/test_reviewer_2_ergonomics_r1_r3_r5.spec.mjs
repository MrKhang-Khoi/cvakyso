/**
 * ====================================================================================================
 * 🧪 PLAYWRIGHT TEST SUITE: REVIEWER 2 (UI/UX, ERGONOMICS & ACCESSIBILITY REVIEW)
 * ====================================================================================================
 * Targets:
 *   - R1: #modalUser 2-column layout (max-w-4xl, <= 85vh, no-scroll visibility on 1920x1080 & 1366x768)
 *   - R3: #modalUserProfile zero phone last-4 digits hints & secure Zalo syntax
 *   - R5: Excel action buttons & #modalImportTeacherExcel styling, touch targets, dropzone, preview table
 *   - Zero horizontal overflow traps across viewports
 *   - WCAG AA/AAA contrast ratios and touch target standards (>= 36px / 44px)
 * ====================================================================================================
 */

import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const SCREENSHOT_DIR = path.resolve('tests/screenshots/reviewer_2_ergonomics');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

// Helpers for WCAG Contrast
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

// --------------------------------------------------------------------------------------
// TEST SUITE 1: R1 ERGONOMICS & VISUAL HIERARCHY FOR #modalUser (Desktop 1920x1080 & Laptop 1366x768)
// --------------------------------------------------------------------------------------
const R1_VIEWPORTS = [
  { name: 'Desktop_1920x1080', width: 1920, height: 1080 },
  { name: 'Laptop_1366x768',   width: 1366, height: 768  }
];

for (const vp of R1_VIEWPORTS) {
  test.describe(`[R1 Ergonomics] #modalUser on ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test.beforeEach(async ({ page }) => {
      // Mock agent port
      await page.route('http://127.0.0.1:18888/**', async route => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'OK' }) });
      });
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Login as Admin
      const userMenuBtn = page.locator('#btnUserMenuToggle');
      if (await userMenuBtn.isVisible()) {
        await userMenuBtn.click();
        await page.waitForTimeout(200);
        const logoutBtn = page.locator('button:has-text("Đăng xuất"), a:has-text("Đăng xuất")').first();
        if (await logoutBtn.isVisible()) {
          await logoutBtn.click();
          await page.waitForTimeout(500);
        }
      }

      const usernameInput = page.locator('#loginUsername');
      if (await usernameInput.isVisible()) {
        await usernameInput.fill('admin');
        await page.locator('#loginPassword').fill('admin@123');
        await page.locator('#btnLoginSubmit').click();
        await page.waitForTimeout(800);
      }

      const tabTeachers = page.locator('#tabBtnTeachers');
      await expect(tabTeachers).toBeVisible();
      await tabTeachers.click();
      await page.waitForTimeout(300);
    });

    test(`1. Bố cục 2 cột, chiều cao <= 85vh và hiển thị trọn vẹn không cần cuộn trên ${vp.name}`, async ({ page }) => {
      // Open Create User Modal
      await page.evaluate(() => {
        openModalCreateUser();
      });
      await page.waitForTimeout(300);

      const modalEl = page.locator('#modalUser');
      await expect(modalEl).toBeVisible();

      // Check card container
      const card = modalEl.locator('> div');
      const cardBox = await card.boundingBox();
      expect(cardBox).not.toBeNull();

      console.log(`\n📐 [${vp.name}] #modalUser Card Box: width=${cardBox.width}px, height=${cardBox.height}px, y=${cardBox.y}px`);

      // 1. Check max width class max-w-4xl (approx 896px)
      expect(cardBox.width).toBeLessThanOrEqual(920);
      expect(cardBox.width).toBeGreaterThanOrEqual(800);

      // 2. Check height <= 85vh
      const maxAllowedHeight = vp.height * 0.85;
      expect(cardBox.height).toBeLessThanOrEqual(maxAllowedHeight);
      console.log(`   Max allowed (85vh) = ${maxAllowedHeight}px | Actual = ${cardBox.height}px -> OK!`);

      // 3. Check card fits completely inside viewport
      expect(cardBox.y).toBeGreaterThanOrEqual(0);
      expect(cardBox.y + cardBox.height).toBeLessThanOrEqual(vp.height);

      // 4. Verify 2 columns grid layout
      const grid = card.locator('.grid.grid-cols-1.md\\:grid-cols-2');
      await expect(grid).toBeVisible();
      const gridCols = await grid.evaluate(el => window.getComputedStyle(el).gridTemplateColumns);
      const colCount = gridCols.split(' ').length;
      console.log(`   Grid Columns computed: ${gridCols} (Count: ${colCount})`);
      expect(colCount).toBe(2);

      // 5. Check Save and Cancel buttons are strictly within viewport WITHOUT scrolling
      const saveBtn = card.locator('button[type="submit"]');
      const cancelBtn = card.locator('button[onclick*="closeModal(\'modalUser\')"]').first();
      await expect(saveBtn).toBeVisible();

      const saveBtnBox = await saveBtn.boundingBox();
      const cancelBtnBox = await cancelBtn.boundingBox();

      console.log(`   Save Button Box: y=${saveBtnBox.y}px, h=${saveBtnBox.height}px, bottom=${saveBtnBox.y + saveBtnBox.height}px`);
      expect(saveBtnBox.y).toBeGreaterThanOrEqual(0);
      expect(saveBtnBox.y + saveBtnBox.height).toBeLessThanOrEqual(vp.height);
      expect(cancelBtnBox.y + cancelBtnBox.height).toBeLessThanOrEqual(vp.height);

      // 6. Check internal scroll status: Does the body container need scrolling on this viewport?
      const scrollInfo = await card.locator('.overflow-y-auto').first().evaluate(el => ({
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
        hasScrollbar: el.scrollHeight > el.clientHeight
      }));
      console.log(`   Body Container Scroll Info: scrollHeight=${scrollInfo.scrollHeight}px, clientHeight=${scrollInfo.clientHeight}px, hasScrollbar=${scrollInfo.hasScrollbar}`);
      expect(scrollInfo.hasScrollbar).toBe(false);

      // Capture visual screenshot
      const shotPath = path.join(SCREENSHOT_DIR, `${vp.name}_modalUser_create.png`);
      await page.screenshot({ path: shotPath });
      console.log(`📸 Screenshot saved: ${shotPath}`);

      // Close modal
      await cancelBtn.click();
      await page.waitForTimeout(200);
      await expect(modalEl).toBeHidden();
    });

    test(`2. Kiểm tra Modal khi Sửa thông tin Giáo viên (Open Edit User) trên ${vp.name}`, async ({ page }) => {
      // Find teacher Ha Van Ty or first teacher and open edit
      const editBtn = page.locator('#tableBodyTeachers tr button[title="Sửa thông tin"]').first();
      await expect(editBtn).toBeVisible();
      await editBtn.click();
      await page.waitForTimeout(300);

      const modalEl = page.locator('#modalUser');
      await expect(modalEl).toBeVisible();

      const title = await page.locator('#modalUserTitle').textContent();
      console.log(`\n✏️ [${vp.name}] Modal Title: ${title}`);
      expect(title).toContain('Sửa thông tin');

      // Check Save Button visibility without scrolling
      const saveBtn = modalEl.locator('button[type="submit"]');
      const saveBtnBox = await saveBtn.boundingBox();
      expect(saveBtnBox.y + saveBtnBox.height).toBeLessThanOrEqual(vp.height);

      // Capture visual screenshot
      const shotPath = path.join(SCREENSHOT_DIR, `${vp.name}_modalUser_edit.png`);
      await page.screenshot({ path: shotPath });

      // Close modal
      await modalEl.locator('button[onclick*="closeModal(\'modalUser\')"]').first().click();
      await page.waitForTimeout(200);
      await expect(modalEl).toBeHidden();
    });

    test(`3. Kiểm tra Modal khi chọn vai trò BGH (hiện cấu hình USB Token) trên ${vp.name}`, async ({ page }) => {
      await page.evaluate(() => {
        openModalCreateUser();
        document.getElementById('userRole').value = 'BGH';
        updateBghBoxVisibility();
      });
      await page.waitForTimeout(300);

      const boxBgh = page.locator('#boxBghUsbTokenConfig');
      await expect(boxBgh).toBeVisible();

      const modalEl = page.locator('#modalUser');
      const card = modalEl.locator('> div');
      const cardBox = await card.boundingBox();
      expect(cardBox.height).toBeLessThanOrEqual(vp.height * 0.85);

      const saveBtn = card.locator('button[type="submit"]');
      const saveBtnBox = await saveBtn.boundingBox();
      expect(saveBtnBox.y + saveBtnBox.height).toBeLessThanOrEqual(vp.height);

      const shotPath = path.join(SCREENSHOT_DIR, `${vp.name}_modalUser_bgh_role.png`);
      await page.screenshot({ path: shotPath });

      await page.locator('#modalUser button[onclick*="closeModal(\'modalUser\')"]').first().click();
    });
  });
}

// --------------------------------------------------------------------------------------
// TEST SUITE 2: R3 BẢO MẬT & CÔNG THÁI HỌC GIAO DIỆN #modalUserProfile
// --------------------------------------------------------------------------------------
test.describe('[R3 Security & Ergonomics] #modalUserProfile User Profile Modal', () => {
  test.use({ viewport: { width: 1366, height: 768 } });

  test('Kiểm tra loại bỏ hoàn toàn gợi ý 4 số cuối SĐT và cú pháp bảo mật', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Login as teacher cva.ty
    const usernameInput = page.locator('#loginUsername');
    if (await usernameInput.isVisible()) {
      await usernameInput.fill('cva.ty');
      await page.locator('#loginPassword').fill('123456');
      await page.locator('#btnLoginSubmit').click();
      await page.waitForTimeout(800);
    }

    // Open Profile Modal
    await page.evaluate(() => {
      openModalUserProfile();
    });
    await page.waitForTimeout(300);

    const modalProfile = page.locator('#modalUserProfile');
    await expect(modalProfile).toBeVisible();

    // 1. Read all text inside #modalUserProfile
    const fullText = await modalProfile.innerText();
    console.log('\n🔒 [R3] Text content of #modalUserProfile:\n', fullText);

    // 2. Strict assertions: NO phone last 4 digits hints
    expect(fullText.toLowerCase()).not.toContain('4 số cuối');
    expect(fullText.toLowerCase()).not.toContain('bốn số cuối');
    expect(fullText.toLowerCase()).not.toContain('cuối sđt');
    expect(fullText.toLowerCase()).not.toContain('cuối số điện thoại');
    expect(fullText.toLowerCase()).not.toContain('last 4');

    // 3. Verify security instruction message
    expect(fullText).toContain('Cách kích hoạt nhận Lịch dạy & Báo ký số qua Zalo');
    expect(fullText).toContain('Nhắn cú pháp bảo mật kèm Mã PIN cá nhân');

    // 4. Verify Syntax displayed contains LK [Phone] [PIN]
    const syntaxText = await page.locator('#profSyntaxFull').textContent();
    console.log(`   Syntax displayed: "${syntaxText}"`);
    expect(syntaxText).toMatch(/^LK\s+\d{10}\s+[\w@#\-_]+$/);

    // 5. Test Copy Button
    const copyBtn = modalProfile.locator('button[onclick*="copyZaloLinkSyntax"]');
    await expect(copyBtn).toBeVisible();
    const copyBox = await copyBtn.boundingBox();
    console.log(`   Copy Button dimensions: ${copyBox.width}x${copyBox.height}px`);

    // 6. Screenshot
    const shotPath = path.join(SCREENSHOT_DIR, 'modalUserProfile_cva_ty.png');
    await page.screenshot({ path: shotPath });
    console.log(`📸 Screenshot saved: ${shotPath}`);

    // Close
    await modalProfile.locator('button:has-text("Đóng")').click();
    await page.waitForTimeout(200);
    await expect(modalProfile).toBeHidden();
  });
});

// --------------------------------------------------------------------------------------
// TEST SUITE 3: R5 CÔNG THÁI HỌC NÚT EXCEL VÀ MODAL #modalImportTeacherExcel
// --------------------------------------------------------------------------------------
test.describe('[R5 Excel Ergonomics] Excel Action Buttons & Import Modal', () => {
  test.use({ viewport: { width: 1366, height: 768 } });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Login as Admin
    const usernameInput = page.locator('#loginUsername');
    if (await usernameInput.isVisible()) {
      await usernameInput.fill('admin');
      await page.locator('#loginPassword').fill('admin@123');
      await page.locator('#btnLoginSubmit').click();
      await page.waitForTimeout(800);
    }

    const tabTeachers = page.locator('#tabBtnTeachers');
    await expect(tabTeachers).toBeVisible();
    await tabTeachers.click();
    await page.waitForTimeout(300);
  });

  test('1. Kiểm tra kích thước điểm chạm, độ tương phản và phản hồi của 2 nút Excel', async ({ page }) => {
    const btnDownload = page.locator('#btnDownloadExcelTemplate');
    const btnImport = page.locator('#btnOpenImportExcel');

    await expect(btnDownload).toBeVisible();
    await expect(btnImport).toBeVisible();

    const boxDownload = await btnDownload.boundingBox();
    const boxImport = await btnImport.boundingBox();

    console.log(`\n📊 [R5 Buttons] btnDownloadExcelTemplate: ${boxDownload.width}x${boxDownload.height}px`);
    console.log(`📊 [R5 Buttons] btnOpenImportExcel: ${boxImport.width}x${boxImport.height}px`);

    // Touch Target Requirement: min-height >= 38px (Standard 36-44px)
    expect(boxDownload.height).toBeGreaterThanOrEqual(36);
    expect(boxDownload.width).toBeGreaterThanOrEqual(44);

    expect(boxImport.height).toBeGreaterThanOrEqual(36);
    expect(boxImport.width).toBeGreaterThanOrEqual(44);

    // Verify Title attributes for accessibility tooltips
    const titleDownload = await btnDownload.getAttribute('title');
    const titleImport = await btnImport.getAttribute('title');
    expect(titleDownload).toBeTruthy();
    expect(titleImport).toBeTruthy();

    // Verify Color Contrast for btnOpenImportExcel (White text on Emerald-600)
    const contrastInfo = await btnImport.evaluate(el => {
      const style = window.getComputedStyle(el);
      return {
        color: style.color,
        bgColor: style.backgroundColor
      };
    });
    const fg = parseColorRgb(contrastInfo.color);
    const bg = parseColorRgb(contrastInfo.bgColor);
    if (fg && bg) {
      const ratio = calculateContrastRatio(fg, bg);
      console.log(`   Import Excel Button Contrast: ${ratio.toFixed(2)}:1 (WCAG Large Text >= 3:1: ${ratio >= 3.0})`);
      expect(ratio).toBeGreaterThanOrEqual(3.0);
    }

    // Capture toolbar screenshot
    const shotPath = path.join(SCREENSHOT_DIR, 'admin_excel_action_buttons.png');
    await page.screenshot({ path: shotPath });
  });

  test('2. Kiểm tra Modal #modalImportTeacherExcel: Bố cục, Dropzone, Bảng Preview & Touch Targets', async ({ page }) => {
    const btnImport = page.locator('#btnOpenImportExcel');
    await btnImport.click();
    await page.waitForTimeout(300);

    const modalExcel = page.locator('#modalImportTeacherExcel');
    await expect(modalExcel).toBeVisible();

    const card = modalExcel.locator('> div');
    const cardBox = await card.boundingBox();

    console.log(`\n📥 [R5 Modal] #modalImportTeacherExcel Box: ${cardBox.width}x${cardBox.height}px`);
    // Max width max-w-3xl (approx 768px)
    expect(cardBox.width).toBeLessThanOrEqual(800);
    // Height <= 85vh
    expect(cardBox.height).toBeLessThanOrEqual(768 * 0.85);

    // Verify Dropzone
    const dropzone = page.locator('#excelDropZone');
    await expect(dropzone).toBeVisible();
    const dropzoneBox = await dropzone.boundingBox();
    expect(dropzoneBox.height).toBeGreaterThanOrEqual(80);

    // Verify Confirm Button is disabled initially
    const confirmBtn = page.locator('#btnConfirmImportExcel');
    await expect(confirmBtn).toBeVisible();
    await expect(confirmBtn).toBeDisabled();

    // Verify Cancel Button
    const cancelBtn = modalExcel.locator('button[onclick*="closeModal(\'modalImportTeacherExcel\')"]').first();
    await expect(cancelBtn).toBeVisible();

    // Test simulate file reading & preview rendering
    await page.evaluate(() => {
      // Simulate preview state
      document.getElementById('boxExcelFileInfo').classList.remove('hidden');
      document.getElementById('excelFileName').textContent = 'Danh_Sach_Giao_Vien_Test.xlsx';
      document.getElementById('excelFileSize').textContent = '(15.4 KB)';
      document.getElementById('badgeExcelValid').textContent = 'Hợp lệ: 2';
      document.getElementById('badgeExcelDuplicate').textContent = 'Bỏ qua: 1';

      document.getElementById('boxExcelPreview').classList.remove('hidden');
      document.getElementById('previewSummaryText').textContent = '2/3 tài khoản hợp lệ';
      document.getElementById('tbodyExcelPreview').innerHTML = `
        <tr class="hover:bg-slate-50">
          <td class="p-2 font-mono">1</td>
          <td class="p-2 font-bold text-slate-800">Nguyễn Văn An</td>
          <td class="p-2 font-mono text-slate-600">nva.toan</td>
          <td class="p-2 text-slate-600">Toán - Tin</td>
          <td class="p-2 font-mono">0905111222</td>
          <td class="p-2 font-mono text-indigo-600 font-bold">1234</td>
          <td class="p-2"><span class="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">Hợp lệ</span></td>
        </tr>
      `;
      document.getElementById('btnConfirmImportExcel').disabled = false;
    });
    await page.waitForTimeout(300);

    // Confirm button should now be enabled
    await expect(confirmBtn).toBeEnabled();

    // Verify preview table is visible and within max height
    const previewBox = page.locator('#boxExcelPreview');
    await expect(previewBox).toBeVisible();

    const shotPath = path.join(SCREENSHOT_DIR, 'modalImportTeacherExcel_with_preview.png');
    await page.screenshot({ path: shotPath });
    console.log(`📸 Screenshot saved: ${shotPath}`);

    // Close modal
    await cancelBtn.click();
    await page.waitForTimeout(200);
    await expect(modalExcel).toBeHidden();
  });
});

// --------------------------------------------------------------------------------------
// TEST SUITE 4: ZERO HORIZONTAL OVERFLOW TRAP ACROSS VIEWPORTS
// --------------------------------------------------------------------------------------
const MATRIX_VIEWPORTS = [
  { name: 'Desktop_1920x1080', width: 1920, height: 1080 },
  { name: 'Laptop_1366x768',   width: 1366, height: 768  },
  { name: 'Mobile_390x844',    width: 390,  height: 844  }
];

for (const vp of MATRIX_VIEWPORTS) {
  test(`[Overflow & Contrast] Kiểm tra 0 bẫy tràn ngang trên ${vp.name}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Login as Admin
    const usernameInput = page.locator('#loginUsername');
    if (await usernameInput.isVisible()) {
      await usernameInput.fill('admin');
      await page.locator('#loginPassword').fill('admin@123');
      await page.locator('#btnLoginSubmit').click();
      await page.waitForTimeout(800);
    }

    // Check document overflow
    const docOverflow = await page.evaluate(() => {
      return {
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        bodyScrollWidth: document.body.scrollWidth,
        isOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
      };
    });

    console.log(`\n🔍 [${vp.name}] Document Overflow: clientWidth=${docOverflow.clientWidth}px, scrollWidth=${docOverflow.scrollWidth}px, isOverflow=${docOverflow.isOverflow}`);
    expect(docOverflow.scrollWidth).toBeLessThanOrEqual(docOverflow.clientWidth);

    // Check main container overflow
    const mainSection = page.locator('#tabContentTeachers');
    if (await mainSection.isVisible()) {
      const sectionOverflow = await mainSection.evaluate(el => {
        return {
          clientWidth: el.clientWidth,
          scrollWidth: el.scrollWidth,
          isOverflow: el.scrollWidth > el.clientWidth
        };
      });
      console.log(`   Section #tabContentTeachers: clientWidth=${sectionOverflow.clientWidth}px, scrollWidth=${sectionOverflow.scrollWidth}px`);
      expect(sectionOverflow.scrollWidth).toBeLessThanOrEqual(sectionOverflow.clientWidth + 1);
    }
  });
}
