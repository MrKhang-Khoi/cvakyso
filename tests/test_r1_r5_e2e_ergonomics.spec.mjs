import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const VIEWPORTS = [
  { name: 'Desktop_1920x1080', width: 1920, height: 1080, targetPin: '8910' },
  { name: 'Laptop_1366x768', width: 1366, height: 768, targetPin: '9876' }
];

for (const vp of VIEWPORTS) {
  test.describe(`EduSign R1-R5 Ergonomics & Verification Suite [${vp.name}]`, () => {
    test.use({
      viewport: { width: vp.width, height: vp.height }
    });

    test(`Full R1-R5 Ergonomics, PIN Sync, Security & Excel Suite on ${vp.name}`, async ({ page }) => {
      const consoleErrors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          const text = msg.text();
          // Filter out normal browser background noise (favicon, ws reconnect)
          if (!text.includes('favicon') && !text.includes('WebSocket') && !text.includes('net::ERR_')) {
            consoleErrors.push(text);
          }
        }
      });
      page.on('pageerror', err => {
        consoleErrors.push(`PageError: ${err.message}`);
      });

      // -----------------------------------------------------------------------
      // BƯỚC 1: MỞ TRANG CHỦ VÀ ĐĂNG NHẬP ADMIN
      // -----------------------------------------------------------------------
      console.log(`\n===============================================================`);
      console.log(`🚀 [${vp.name}] Bắt đầu kiểm thử E2E Đa độ phân giải & Công thái học`);
      console.log(`===============================================================`);

      await page.goto('http://localhost:3000');
      await page.waitForLoadState('networkidle');

      await page.fill('#loginUsername', 'admin');
      await page.fill('#loginPassword', 'admin@123');
      await page.click('#btnLoginSubmit');

      await expect(page.locator('#viewAdmin')).toBeVisible({ timeout: 10000 });
      await page.waitForFunction(() => window.appState && window.appState.users && window.appState.users.length > 0);

      // Đảm bảo thư mục lưu screenshot tồn tại
      const ssDir = path.resolve('tests/screenshots/r1_r5');
      if (!fs.existsSync(ssDir)) {
        fs.mkdirSync(ssDir, { recursive: true });
      }
      const prefix = vp.name.toLowerCase();

      // -----------------------------------------------------------------------
      // BƯỚC 2: R1 — KIỂM ĐỊNH CÔNG THÁI HỌC MODAL USER (THÊM MỚI)
      // -----------------------------------------------------------------------
      console.log(`[${vp.name}] [R1] Kiểm định Modal Thêm Giáo viên mới...`);
      await page.click('button.btn-create-user, button[onclick*="openModalCreateUser"]');
      await expect(page.locator('#modalUser')).toBeVisible({ timeout: 5000 });

      const modalAddCard = page.locator('#modalUser > div.bg-white');
      await expect(modalAddCard).toBeVisible();

      const modalAddBox = await modalAddCard.boundingBox();
      expect(modalAddBox).not.toBeNull();
      console.log(`[${vp.name}] [R1] Modal Add BoundingBox:`, {
        x: Math.round(modalAddBox.x),
        y: Math.round(modalAddBox.y),
        width: Math.round(modalAddBox.width),
        height: Math.round(modalAddBox.height),
        viewportHeight: vp.height,
        maxLimit85vh: Math.round(vp.height * 0.85)
      });

      // R1.1: Chiều cao modal <= 85vh
      expect(modalAddBox.height).toBeLessThanOrEqual(vp.height * 0.85);

      // R1.2: Nút Lưu và Hủy nằm trọn trong viewport mà KHÔNG cần cuộn
      const saveBtn = page.locator('#modalUser button[type="submit"]');
      const cancelBtn = page.locator('#modalUser button:has-text("Hủy")');
      await expect(saveBtn).toBeVisible();
      await expect(cancelBtn).toBeVisible();

      const saveBox = await saveBtn.boundingBox();
      const cancelBox = await cancelBtn.boundingBox();
      expect(saveBox).not.toBeNull();
      expect(cancelBox).not.toBeNull();

      console.log(`[${vp.name}] [R1] SaveBtn Y:`, Math.round(saveBox.y), 'Bottom:', Math.round(saveBox.y + saveBox.height));
      console.log(`[${vp.name}] [R1] CancelBtn Y:`, Math.round(cancelBox.y), 'Bottom:', Math.round(cancelBox.y + cancelBox.height));

      expect(saveBox.y + saveBox.height).toBeLessThanOrEqual(vp.height);
      expect(cancelBox.y + cancelBox.height).toBeLessThanOrEqual(vp.height);
      expect(saveBox.y).toBeGreaterThanOrEqual(0);
      expect(cancelBox.y).toBeGreaterThanOrEqual(0);

      // Xác nhận trang web ở vị trí scroll = 0 (không bị cuộn)
      const pageScrollY = await page.evaluate(() => window.scrollY);
      expect(pageScrollY).toBe(0);

      // R1.3: Cấu trúc 2 cột ngang (side-by-side)
      const gridContainer = page.locator('#modalUser .grid.grid-cols-1.md\\:grid-cols-2');
      await expect(gridContainer).toBeVisible();

      const columns = page.locator('#modalUser .grid.grid-cols-1.md\\:grid-cols-2 > div.space-y-3');
      expect(await columns.count()).toBe(2);

      const leftCol = columns.nth(0);
      const rightCol = columns.nth(1);
      const leftColBox = await leftCol.boundingBox();
      const rightColBox = await rightCol.boundingBox();

      console.log(`[${vp.name}] [R1] Left Col Right-Edge:`, Math.round(leftColBox.x + leftColBox.width), 'vs Right Col X:', Math.round(rightColBox.x));
      expect(leftColBox.x + leftColBox.width).toBeLessThanOrEqual(rightColBox.x + 20);
      expect(Math.abs(leftColBox.y - rightColBox.y)).toBeLessThan(35); // Cùng dòng theo trục ngang

      // Chụp ảnh minh chứng Modal Add User
      await page.screenshot({
        path: `tests/screenshots/r1_r5/${prefix}_modal_user_add.png`
      });

      // Đóng modal add
      await cancelBtn.click();
      await expect(page.locator('#modalUser')).toBeHidden({ timeout: 5000 });

      // -----------------------------------------------------------------------
      // BƯỚC 3: R1 & R2 — MODAL SỬA GIÁO VIÊN & ĐỒNG BỘ PIN TỨC THỜI
      // -----------------------------------------------------------------------
      console.log(`[${vp.name}] [R1 & R2] Mở Sửa Giáo viên Hà Văn Tý và cập nhật PIN...`);
      const tyUser = await page.evaluate(() =>
        window.appState.users.find(u => u.username === 'cva.ty' || (u.name && u.name.includes('Tý')))
      );
      expect(tyUser).toBeDefined();
      const tyUserId = tyUser.id;

      await page.evaluate(id => {
        window.openModalEditUser(id);
      }, tyUserId);
      await expect(page.locator('#modalUser')).toBeVisible({ timeout: 5000 });

      // Đo đạc công thái học của Edit Modal
      const modalEditCard = page.locator('#modalUser > div.bg-white');
      const modalEditBox = await modalEditCard.boundingBox();
      expect(modalEditBox.height).toBeLessThanOrEqual(vp.height * 0.85);

      const editSaveBtn = page.locator('#modalUser button[type="submit"]');
      const editSaveBox = await editSaveBtn.boundingBox();
      expect(editSaveBox.y + editSaveBox.height).toBeLessThanOrEqual(vp.height);

      // Chụp ảnh minh chứng Modal Edit User
      await page.screenshot({
        path: `tests/screenshots/r1_r5/${prefix}_modal_user_edit.png`
      });

      // Nhập PIN mới (vp.targetPin)
      const pinInput = page.locator('#userZaloPin');
      await expect(pinInput).toBeVisible();
      await pinInput.fill(vp.targetPin);

      // Bấm Lưu thông tin
      await editSaveBtn.click();
      await page.waitForTimeout(1000);
      await expect(page.locator('#modalUser')).toBeHidden({ timeout: 5000 });

      // Kiểm tra ngay trong localStorage 'edusign_users'
      const storedUsersRaw = await page.evaluate(() => localStorage.getItem('edusign_users'));
      expect(storedUsersRaw).not.toBeNull();
      const storedUsers = JSON.parse(storedUsersRaw);
      const storedTy = storedUsers.find(u => u.id === tyUserId || u.username === 'cva.ty');
      expect(storedTy).toBeDefined();
      console.log(`[${vp.name}] [R2] localStorage edusign_users PIN:`, storedTy.pinCode, storedTy.zaloPin);
      expect(storedTy.pinCode).toBe(vp.targetPin);
      expect(storedTy.zaloPin).toBe(vp.targetPin);

      // -----------------------------------------------------------------------
      // BƯỚC 4: R5 — CÁC NÚT EXCEL TẠI TAB GIÁO VIÊN & MODAL IMPORT EXCEL
      // -----------------------------------------------------------------------
      console.log(`[${vp.name}] [R5] Kiểm tra nút Excel và Modal Import...`);
      const btnDownloadExcel = page.locator('#btnDownloadExcelTemplate');
      const btnImportExcel = page.locator('#btnOpenImportExcel');

      await expect(btnDownloadExcel).toBeVisible();
      await expect(btnImportExcel).toBeVisible();

      // Chụp ảnh thanh công cụ Excel
      await page.screenshot({
        path: `tests/screenshots/r1_r5/${prefix}_excel_buttons.png`
      });

      // Kiểm tra tính năng Tải file mẫu Excel (trigger download)
      const [ download ] = await Promise.all([
        page.waitForEvent('download', { timeout: 10000 }),
        btnDownloadExcel.click()
      ]);
      const downloadFilename = download.suggestedFilename();
      console.log(`[${vp.name}] [R5] File mẫu tải về:`, downloadFilename);
      expect(downloadFilename).toBe('Mau_Danh_Sach_Giao_Vien_EduSign_THCS_ChuVanAn.xlsx');

      // Click "Nhập từ Excel"
      await btnImportExcel.click();
      await expect(page.locator('#modalImportTeacherExcel')).toBeVisible({ timeout: 5000 });

      await expect(page.locator('#excelDropZone')).toBeVisible();
      await expect(page.locator('#inputTeacherExcelFile')).toBeAttached();
      const btnConfirmImport = page.locator('#btnConfirmImportExcel');
      await expect(btnConfirmImport).toBeVisible();
      expect(await btnConfirmImport.isDisabled()).toBe(true);

      // Chụp ảnh Modal Import Excel
      await page.screenshot({
        path: `tests/screenshots/r1_r5/${prefix}_modal_import_excel.png`
      });

      // Đóng modal Import Excel
      await page.click('#modalImportTeacherExcel button:has-text("Hủy")');
      await expect(page.locator('#modalImportTeacherExcel')).toBeHidden({ timeout: 5000 });

      // -----------------------------------------------------------------------
      // BƯỚC 5: ĐĂNG XUẤT ADMIN & ĐĂNG NHẬP GIÁO VIÊN KIỂM CHỨNG R2 & R3
      // -----------------------------------------------------------------------
      console.log(`[${vp.name}] [R2 & R3] Đăng nhập Giáo viên cva.ty để kiểm tra Profile...`);
      await page.click('button[onclick*="adminSettingsDropdown"]');
      await page.waitForTimeout(300);
      await page.click('#adminSettingsDropdown button:has-text("Đăng xuất")');
      await expect(page.locator('#viewLogin')).toBeVisible({ timeout: 5000 });

      await page.fill('#loginUsername', 'cva.ty');
      await page.fill('#loginPassword', '123456');
      await page.click('#btnLoginSubmit');
      await expect(page.locator('#viewTeacher')).toBeVisible({ timeout: 10000 });

      // Mở Thông tin cá nhân & Zalo của giáo viên
      await page.click('button[onclick*="teacherSettingsDropdown"]');
      await page.waitForTimeout(300);
      await page.click('#teacherSettingsDropdown button:has-text("Thông tin cá nhân")');
      await expect(page.locator('#modalUserProfile')).toBeVisible({ timeout: 5000 });

      // R2: Kiểm tra PIN phản ánh ngay giá trị vừa lưu
      const profPinCode = await page.locator('#profPinCode').textContent();
      const profSyntaxFull = await page.locator('#profSyntaxFull').textContent();

      console.log(`[${vp.name}] [R2] Giáo viên hiển thị PIN:`, profPinCode.trim());
      console.log(`[${vp.name}] [R2] Cú pháp Zalo hiển thị:`, profSyntaxFull.trim());

      expect(profPinCode.trim()).toBe(vp.targetPin);
      expect(profSyntaxFull.trim()).toBe(`LK 0818810007 ${vp.targetPin}`);

      // R3: Kiểm tra ZERO mentions của 4 số cuối SĐT
      const modalProfileText = await page.locator('#modalUserProfile').innerText();
      console.log(`[${vp.name}] [R3] Thẩm định nội dung bảo mật trong Modal Profile...`);

      expect(modalProfileText).not.toMatch(/4 số cuối/i);
      expect(modalProfileText).not.toMatch(/bốn số cuối/i);
      expect(modalProfileText).not.toMatch(/last 4/i);
      expect(modalProfileText).not.toMatch(/4-digit/i);
      expect(modalProfileText).toContain('Mã PIN');

      // Chụp ảnh minh chứng Modal Profile Teacher với PIN mới và không có gợi ý 4 số cuối
      await page.screenshot({
        path: `tests/screenshots/r1_r5/${prefix}_teacher_profile_pin.png`
      });

      await page.click('#modalUserProfile button:has-text("Đóng")');
      await expect(page.locator('#modalUserProfile')).toBeHidden({ timeout: 5000 });

      // -----------------------------------------------------------------------
      // BƯỚC 6: KIỂM CHỨNG CONSOLE F12 SẠCH 100% (0 LỖI)
      // -----------------------------------------------------------------------
      console.log(`[${vp.name}] Console Errors Count:`, consoleErrors.length);
      if (consoleErrors.length > 0) {
        console.error(`[${vp.name}] Detected Console Errors:`, consoleErrors);
      }
      expect(consoleErrors.length).toBe(0);

      console.log(`✅ [${vp.name}] Toàn bộ các tiêu chí R1, R2, R3, R5, Console đều ĐẠT 100% PASS!`);
    });
  });
}
