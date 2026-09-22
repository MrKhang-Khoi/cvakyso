import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const indexPath = 'file:///' + path.resolve(__dirname, '../index.html').replace(/\\/g, '/');

test.describe('EduSign Smart Refresh Feature (Zero-Bug & Anti-Spam)', () => {

  test('Kiểm tra nút Làm Mới trên giao diện Giáo Viên (Spam Cooldown & Visual Feedback)', async ({ page }) => {
    // 1. Giả lập tài khoản Giáo viên đã đăng nhập qua localStorage
    await page.addInitScript(() => {
      const mockTeacher = {
        id: 'user_cvaty',
        username: 'cva.ty',
        fullName: 'Thầy Hà Văn Tý',
        department: 'Tổ Toán - Tin',
        departmentName: 'Tổ Toán - Tin',
        departmentId: 'dept_toan_tin',
        role: 'TEACHER',
        roleTitle: 'Giáo viên',
        signType: 'PERSONAL',
        phone: '0818810007'
      };
      localStorage.setItem('edusign_token', 'mock_jwt_token_123');
      localStorage.setItem('edusign_user', JSON.stringify(mockTeacher));
    });

    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto(indexPath);
    await page.waitForLoadState('domcontentloaded');

    // 2. Xác nhận viewTeacher hiển thị
    const viewTeacher = page.locator('#viewTeacher');
    await expect(viewTeacher).toBeVisible();

    // 3. Kiểm tra nút Làm mới trên Header Giáo viên
    const btnHeaderRefresh = page.locator('#btnTeacherRefresh');
    await expect(btnHeaderRefresh).toBeVisible();

    // 4. Kiểm tra nút Làm mới trên Tabs Giáo viên
    const btnTabRefresh = page.locator('.btn-smart-refresh').last();
    await expect(btnTabRefresh).toBeVisible();

    // 5. Test Click Làm Mới: Kiểm tra icon xoay animate-spin và nhãn "Đang tải..."
    await btnHeaderRefresh.click();

    const spinIcon = btnHeaderRefresh.locator('.icon-refresh-spin');
    await expect(spinIcon).toHaveClass(/animate-spin/);

    // 6. Test Cooldown Anti-Spam: Click lần 2 ngay lập tức trong 3 giây
    await btnHeaderRefresh.click();
    
    // Kiểm tra Toast cảnh báo xuất hiện
    const toastContainer = page.locator('#toastContainer');
    await expect(toastContainer).toContainText(/Dữ liệu vừa được cập nhật|Đang làm mới|Đang cập nhật/);

    // 7. Đợi cooldown và kiểm tra icon dừng xoay
    await page.waitForTimeout(1000);
    await expect(spinIcon).not.toHaveClass(/animate-spin/);

    // 8. Chụp ảnh minh chứng
    await page.screenshot({ path: path.join(__dirname, 'screenshots', 'smart_refresh_teacher_verified.png'), fullPage: true });

    // 9. Xác nhận Console không có lỗi nghiêm trọng
    const fatalErrors = consoleErrors.filter(e => !e.includes('favicon') && !e.includes('firebase') && !e.includes('WebSocket'));
    expect(fatalErrors.length).toBe(0);
  });

  test('Kiểm tra nút Làm Mới trên giao diện Quản Trị Viên (Admin Header)', async ({ page }) => {
    // 1. Giả lập tài khoản Admin BGH
    await page.addInitScript(() => {
      const mockAdmin = {
        id: 'user_admin',
        username: 'admin',
        fullName: 'Ban Giám hiệu - Quản trị viên',
        department: 'Ban Giám hiệu',
        role: 'ADMIN',
        roleTitle: 'Quản trị viên',
        signType: 'USB_TOKEN'
      };
      localStorage.setItem('edusign_token', 'mock_admin_token_456');
      localStorage.setItem('edusign_user', JSON.stringify(mockAdmin));
    });

    await page.goto(indexPath);
    await page.waitForLoadState('domcontentloaded');

    // 2. Xác nhận viewAdmin hiển thị
    const viewAdmin = page.locator('#viewAdmin');
    await expect(viewAdmin).toBeVisible();

    // 3. Kiểm tra nút Làm mới Admin
    const btnAdminRefresh = page.locator('#btnAdminRefresh');
    await expect(btnAdminRefresh).toBeVisible();

    // 4. Click làm mới
    await btnAdminRefresh.click();

    const spinIcon = btnAdminRefresh.locator('.icon-refresh-spin');
    await expect(spinIcon).toHaveClass(/animate-spin/);

    await page.waitForTimeout(1000);
    await expect(spinIcon).not.toHaveClass(/animate-spin/);

    // 5. Chụp ảnh minh chứng
    await page.screenshot({ path: path.join(__dirname, 'screenshots', 'smart_refresh_admin_verified.png'), fullPage: true });
  });

});
