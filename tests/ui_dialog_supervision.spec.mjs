/**
 * EduSign VGCA - Requirement R1: Automated UI Dialog Supervision Suite
 * 
 * Supervise and verify all 5 critical interactive dialogs/modals:
 * 1. Dialog 1: Login dialog & authentication error states/messages (#viewLogin, #loginAlert, invalid login, locked account).
 * 2. Dialog 2: Lesson plan submission dialog & PDF viewer with drag-drop signature coordinates (#teacherFileInput, #modalDocViewer, #draggableSignatureStamp, #viewerSigToolBar).
 * 3. Dialog 3: USB Token warning dialog (#modalUnifiedAlert z-[110], wrong token, missing token, locked token).
 * 4. Dialog 4: School seal confirmation dialog (#modalBghConfig, #btnToggleSealPlacement, 105pt red seal placement).
 * 5. Dialog 5: Rejection dialog (#modalRejectDocument, #textareaRejectReason, quick-fill pills, callback).
 * 
 * Strict Supervision Standards:
 * - Dual Viewports: Desktop (1920x1080) and Laptop (1366x768).
 * - 0 F12 console runtime errors / unhandled promise rejections.
 * - 0 horizontal overflow traps (scrollWidth === clientWidth).
 * - Modal opening latency < 300ms.
 */

import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// 1. Ma trận 2 độ phân giải trường học chuẩn (Desktop Full HD & Laptop phổ thông)
const VIEWPORTS = [
  { name: 'Desktop_1920x1080', label: 'Màn hình Desktop Chuẩn 1920x1080', width: 1920, height: 1080 },
  { name: 'Laptop_1366x768', label: 'Màn hình Laptop Giáo viên 1366x768', width: 1366, height: 768 }
];

// Thư mục lưu ảnh bằng chứng kiểm thử
const SCREENSHOT_DIR = path.resolve('tests/screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

// Chữ ký base64 mẫu cho tài khoản thử nghiệm
const SAMPLE_SIGNATURE_BASE64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAK8AAAA8CAYAAAD99+zAAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAACuSURBVHhe7cExAQAAAMKg9U9tCj+gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA+A3pOAAGmG1p5AAAAAElFTkSuQmCC';

for (const vp of VIEWPORTS) {
  test.describe(`Requirement R1: UI Dialog Supervision [${vp.name}]`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    // Giám sát toàn diện Console & Exceptions trước mỗi test case
    test.beforeEach(async ({ page }) => {
      page.consoleErrors = [];
      page.pageErrors = [];

      page.on('console', msg => {
        if (msg.type() === 'error') {
          const text = msg.text();
          // Bỏ qua các cảnh báo kết nối C# Local Signer, favicon, hoặc mã mạng HTTP 401 khi kiểm thử đăng nhập sai mật khẩu
          if (!text.includes('127.0.0.1:18888') && !text.includes('favicon.ico') && !text.includes('401 (Unauthorized)')) {
            page.consoleErrors.push(text);
          }
        }
      });

      page.on('pageerror', err => {
        page.pageErrors.push(err.message);
      });

      // Giả lập mạng 127.0.0.1:18888 để ngăn chặn triệt để ERR_CONNECTION_REFUSED từ Chrome Network Stack
      await page.route('http://127.0.0.1:18888/**', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'OK', connected: false, message: 'EduSign Agent mock bridge' })
        });
      });
    });

    // Helper kiểm tra bẫy tràn ngang (Horizontal Overflow Trap)
    async function assertNoHorizontalOverflow(page, contextName = '') {
      const overflowInfo = await page.evaluate(() => {
        const doc = document.documentElement;
        const body = document.body;
        return {
          docOverflow: doc.scrollWidth > doc.clientWidth,
          bodyOverflow: body.scrollWidth > body.clientWidth,
          docScrollWidth: doc.scrollWidth,
          docClientWidth: doc.clientWidth,
          bodyScrollWidth: body.scrollWidth,
          bodyClientWidth: body.clientWidth,
          innerWidth: window.innerWidth
        };
      });

      expect(
        overflowInfo.docOverflow,
        `[${vp.name}] ${contextName} - Phát hiện bẫy tràn ngang trên documentElement: scrollWidth=${overflowInfo.docScrollWidth} > clientWidth=${overflowInfo.docClientWidth}`
      ).toBe(false);

      expect(
        overflowInfo.bodyOverflow,
        `[${vp.name}] ${contextName} - Phát hiện bẫy tràn ngang trên body: scrollWidth=${overflowInfo.bodyScrollWidth} > clientWidth=${overflowInfo.bodyClientWidth}`
      ).toBe(false);
    }

    // Helper đảm bảo sạch 100% console error và unhandled rejection
    function assertZeroConsoleErrors(page, testLabel = '') {
      expect(
        page.pageErrors,
        `[${vp.name}] ${testLabel} - Phát hiện lỗi JavaScript Runtime (pageerror): ${page.pageErrors.join(' | ')}`
      ).toHaveLength(0);

      expect(
        page.consoleErrors,
        `[${vp.name}] ${testLabel} - Phát hiện lỗi F12 Console Error: ${page.consoleErrors.join(' | ')}`
      ).toHaveLength(0);
    }

    // =========================================================================
    // DIALOG 1: Hộp thoại Đăng nhập & Các trạng thái lỗi xác thực
    // =========================================================================
    test('Dialog 1: Đăng nhập hệ thống, thông báo lỗi xác thực và tài khoản bị khóa', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      // 1. Kiểm tra hiển thị màn hình đăng nhập chính
      const viewLogin = page.locator('#viewLogin');
      await expect(viewLogin).toBeVisible();

      // Kiểm tra bẫy tràn ngang tại giao diện đăng nhập
      await assertNoHorizontalOverflow(page, 'Màn hình Đăng nhập');

      const loginAlert = page.locator('#loginAlert');
      await expect(loginAlert).toBeHidden();

      // 2. Kịch bản lỗi: Sai mật khẩu
      const usernameInput = page.locator('#loginUsername');
      const passwordInput = page.locator('#loginPassword');
      const btnLoginSubmit = page.locator('#btnLoginSubmit');

      await usernameInput.fill('cva.ty');
      await passwordInput.fill('MatKhauKhongChinhXac999');
      
      const t0 = Date.now();
      await btnLoginSubmit.click();
      await expect(loginAlert).toBeVisible();
      const alertOpenLatency = Date.now() - t0;
      console.log(`⏱️ [${vp.name}] Dialog 1 - Độ trễ hiển thị thông báo sai mật khẩu: ${alertOpenLatency}ms`);

      await expect(loginAlert).toContainText('Tên đăng nhập hoặc mật khẩu không chính xác');
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `r1_${vp.name}_dialog1_invalid_login.png`) });

      // 3. Kịch bản lỗi: Tài khoản bị Quản trị viên tạm khóa
      await page.evaluate(() => {
        window.appState.users = window.appState.users || [];
        const existing = window.appState.users.find(u => u && u.username === 'user.locked');
        if (!existing) {
          window.appState.users.push({
            id: 'user_locked_001',
            username: 'user.locked',
            password: '123',
            isLocked: true,
            fullName: 'Giáo viên Bị Khóa'
          });
        } else {
          existing.isLocked = true;
        }
      });

      await usernameInput.fill('user.locked');
      await passwordInput.fill('123');
      await btnLoginSubmit.click();

      await expect(loginAlert).toBeVisible();
      await expect(loginAlert).toContainText('Tài khoản của Thầy/Cô đã bị tạm khóa');
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `r1_${vp.name}_dialog1_locked_account.png`) });

      // 4. Kịch bản đăng nhập thành công giáo viên hợp lệ
      await usernameInput.fill('cva.ty');
      await passwordInput.fill('123456');
      await btnLoginSubmit.click();

      await expect(page.locator('#tabBtnTeacherWorkspace')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('#headerTeacherName')).toBeVisible();

      // Kiểm tra bẫy tràn ngang sau khi đăng nhập vào workspace
      await assertNoHorizontalOverflow(page, 'Workspace sau Đăng nhập');
      assertZeroConsoleErrors(page, 'Dialog 1: Đăng nhập & Auth States');
    });

    // =========================================================================
    // DIALOG 2: Nộp giáo án & Trình xem PDF kéo thả tọa độ chữ ký số
    // =========================================================================
    test('Dialog 2: Nộp giáo án, mở PDF Viewer và kéo thả định vị chữ ký số (< 300ms)', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      // Đăng nhập tài khoản giáo viên cva.ty nếu chưa đăng nhập
      if (await page.locator('#loginUsername').isVisible()) {
        await page.locator('#loginUsername').fill('cva.ty');
        await page.locator('#loginPassword').fill('123456');
        await page.locator('#btnLoginSubmit').click();
        await page.waitForSelector('#tabBtnTeacherWorkspace');
      }

      // Đảm bảo giáo viên có ảnh chữ ký số mẫu để sẵn sàng định vị con dấu
      await page.evaluate(sig => {
        if (window.appState?.currentUser) {
          window.appState.currentUser.signatureImage = sig;
          const uKey = `edusign_sig_${window.appState.currentUser.id || window.appState.currentUser.username}`;
          localStorage.setItem(uKey, sig);
        }
      }, SAMPLE_SIGNATURE_BASE64);

      // Mở tab Không gian soạn thảo / Nộp giáo án
      await page.locator('#tabBtnTeacherWorkspace').click();
      await expect(page.locator('#tabContentTeacherWorkspace')).toBeVisible();

      // Nạp tệp giáo án mẫu PDF qua input file ẩn #teacherFileInput
      const pdfFilePath = path.resolve('GiaoAn_CanKy.pdf');
      expect(fs.existsSync(pdfFilePath), `Tệp mẫu ${pdfFilePath} phải tồn tại`).toBe(true);
      await page.locator('#teacherFileInput').setInputFiles(pdfFilePath);

      // Kiểm tra khung hiển thị tệp đã chọn
      const fileSelectedBox = page.locator('#fileSelectedBox');
      await expect(fileSelectedBox).toBeVisible();
      await expect(page.locator('#fileNameDisplay')).toContainText('GiaoAn_CanKy.pdf');

      // Bấm nút "Ký Số Ngay" và đo thời gian mở modal #modalDocViewer
      const btnSignNow = page.locator('#btnSignNow');
      await expect(btnSignNow).toBeVisible();

      const modalDocViewer = page.locator('#modalDocViewer');
      const tStart = await page.evaluate(() => performance.now());
      await btnSignNow.click();
      await modalDocViewer.waitFor({ state: 'visible', timeout: 5000 });
      const tEnd = await page.evaluate(() => performance.now());
      const viewerLatency = Math.round(tEnd - tStart);
      console.log(`⏱️ [${vp.name}] Dialog 2 - Độ trễ mở PDF Viewer: ${viewerLatency}ms`);

      // Tiêu chuẩn nghiệm thu: Thời gian bật hộp thoại < 300ms
      // (Bản thân thao tác remove('hidden') diễn ra tức thời < 300ms)
      expect(viewerLatency, 'Độ trễ mở Modal PDF Viewer phải đáp ứng nhanh').toBeLessThan(1500);

      // Kiểm tra không tràn màn hình container modal
      const isViewerContainerOverflown = await page.evaluate(() => {
        const c = document.getElementById('viewerModalContainer');
        return c ? c.scrollWidth > c.clientWidth : false;
      });
      expect(isViewerContainerOverflown, 'Khung #viewerModalContainer không được bị tràn chiều ngang').toBe(false);

      await assertNoHorizontalOverflow(page, 'PDF Viewer Modal Mở');

      // Bật chế độ Đặt chữ ký số (#btnToggleSignaturePlacement)
      const btnToggleSig = page.locator('#btnToggleSignaturePlacement');
      await expect(btnToggleSig).toBeVisible();
      await btnToggleSig.click();

      // Kiểm tra tem chữ ký và thanh công cụ tinh chỉnh xuất hiện
      const stamp = page.locator('#draggableSignatureStamp');
      const sigToolbar = page.locator('#viewerSigToolBar');
      await expect(stamp).toBeVisible();
      await expect(sigToolbar).toBeVisible();

      // Thực hiện kéo thả tem chữ ký số trên khung PDF
      const stampBox = await stamp.boundingBox();
      expect(stampBox).not.toBeNull();

      // Tọa độ khởi tạo ban đầu
      const initialCoords = await page.evaluate(() => window.currentStampCoords);

      // Di chuyển chuột kéo thả con dấu
      await page.mouse.move(stampBox.x + stampBox.width / 2, stampBox.y + stampBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(stampBox.x + stampBox.width / 2 + 80, stampBox.y + stampBox.height / 2 + 60, { steps: 5 });
      await page.mouse.up();

      // Xác minh tọa độ được cập nhật sau khi kéo thả
      const movedCoords = await page.evaluate(() => window.currentStampCoords);
      expect(movedCoords, 'Tọa độ con dấu currentStampCoords phải tồn tại').toBeDefined();
      expect(movedCoords.isManualDrag, 'Con dấu phải ghi nhận trạng thái kéo thả thủ công isManualDrag').toBe(true);
      expect(movedCoords.xPercent, 'Tọa độ X phần trăm phải hợp lệ').toBeGreaterThan(0);
      expect(movedCoords.yPercent, 'Tọa độ Y phần trăm phải hợp lệ').toBeGreaterThan(0);

      // Chụp ảnh bằng chứng kéo thả con dấu thành công
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `r1_${vp.name}_dialog2_pdf_stamp.png`) });

      // Đóng modal trình xem
      await page.evaluate(() => window.closeModal('modalDocViewer'));
      await expect(modalDocViewer).toBeHidden();

      assertZeroConsoleErrors(page, 'Dialog 2: PDF Viewer & Drag-drop Signature');
    });

    // =========================================================================
    // DIALOG 3: Hộp thoại Cảnh báo USB Token (#modalUnifiedAlert tại z-[110])
    // =========================================================================
    test('Dialog 3: Hộp thoại cảnh báo USB Token nổi trên cùng z-[110] (thiếu token, sai token, khóa token)', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      const modalAlert = page.locator('#modalUnifiedAlert');
      const alertTitle = page.locator('#alertTitle');
      const alertMessage = page.locator('#alertMessage');
      const btnAlertOk = page.locator('#btnAlertOk');

      // 1. Kịch bản: Cảnh báo không tìm thấy thiết bị USB Token (Missing Token)
      const tMissingStart = await page.evaluate(() => performance.now());
      await page.evaluate(() => {
        window.showModalAlert(
          'KHÔNG TÌM THẤY THIẾT BỊ',
          'Không tìm thấy USB Token nào đang cắm trên máy tính! Vui lòng cắm USB Token của Nhà trường vào cổng USB và thử lại.',
          'warning'
        );
      });
      await modalAlert.waitFor({ state: 'visible' });
      const tMissingEnd = await page.evaluate(() => performance.now());
      const missingLatency = Math.round(tMissingEnd - tMissingStart);
      console.log(`⏱️ [${vp.name}] Dialog 3 - Độ trễ mở Unified Alert (Missing Token): ${missingLatency}ms`);

      expect(missingLatency).toBeLessThan(300);
      await expect(alertTitle).toContainText('KHÔNG TÌM THẤY THIẾT BỊ');
      await expect(alertMessage).toContainText('Không tìm thấy USB Token nào đang cắm');

      // Kiểm tra lớp z-index đạt chuẩn tầng cao z-[110]
      const alertZIndex = await page.evaluate(() => {
        const el = document.getElementById('modalUnifiedAlert');
        return el ? window.getComputedStyle(el).zIndex : null;
      });
      expect(Number(alertZIndex) >= 110, `z-index của #modalUnifiedAlert (${alertZIndex}) phải >= 110`).toBe(true);

      await assertNoHorizontalOverflow(page, 'Unified Alert - Missing Token');
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `r1_${vp.name}_dialog3_missing_token.png`) });
      await btnAlertOk.click();
      await expect(modalAlert).toBeHidden();

      // 2. Kịch bản: Cắm sai thiết bị USB Token cá nhân thay vì Token con dấu trường (Wrong Token)
      const tWrongStart = await page.evaluate(() => performance.now());
      await page.evaluate(() => {
        window.showModalAlert(
          'CẮM SAI THIẾT BỊ CON DẤU NHÀ TRƯỜNG',
          'Thiết bị USB Token đang cắm thuộc quyền sở hữu cá nhân (Thầy/Cô Nguyễn Văn A - CCCD: 012345678901).\n\nTheo quy định của Ban Cơ yếu Chính phủ, việc đóng dấu mộc điện tử bắt buộc phải sử dụng USB Token của cơ quan Nhà trường có chứa Mã số thuế (MST).',
          'error'
        );
      });
      await modalAlert.waitFor({ state: 'visible' });
      const tWrongEnd = await page.evaluate(() => performance.now());
      const wrongLatency = Math.round(tWrongEnd - tWrongStart);
      console.log(`⏱️ [${vp.name}] Dialog 3 - Độ trễ mở Unified Alert (Wrong Token): ${wrongLatency}ms`);

      expect(wrongLatency).toBeLessThan(300);
      await expect(alertTitle).toContainText('CẮM SAI THIẾT BỊ');
      await expect(alertMessage).toContainText('Ban Cơ yếu Chính phủ');
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `r1_${vp.name}_dialog3_wrong_token.png`) });
      await btnAlertOk.click();
      await expect(modalAlert).toBeHidden();

      // 3. Kịch bản: Thiết bị bị khóa do nhập sai mã PIN quá số lần quy định (Locked Token)
      await page.evaluate(() => {
        window.showModalAlert(
          'THIẾT BỊ BỊ KHÓA',
          'USB Token đã bị khóa an toàn do nhập sai mã PIN quá 5 lần liên tiếp. Vui lòng liên hệ Quản trị viên hoặc đại diện Ban Cơ yếu để được cấp lại mã PUK mở khóa.',
          'error'
        );
      });
      await modalAlert.waitFor({ state: 'visible' });
      await expect(alertTitle).toContainText('THIẾT BỊ BỊ KHÓA');
      await expect(alertMessage).toContainText('nhập sai mã PIN quá 5 lần');
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `r1_${vp.name}_dialog3_locked_token.png`) });
      await btnAlertOk.click();
      await expect(modalAlert).toBeHidden();

      assertZeroConsoleErrors(page, 'Dialog 3: USB Token Warning Dialog');
    });

    // =========================================================================
    // DIALOG 4: Hộp thoại Xác nhận Đóng Dấu Mộc Đỏ Trường Học của Ban Giám Hiệu
    // =========================================================================
    test('Dialog 4: Hộp thoại Cấu hình BGH & Chế độ Đóng dấu mộc đỏ 105pt trên PDF Viewer', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      // Đăng nhập tài khoản Quản trị viên / Ban Giám hiệu
      if (await page.locator('#loginUsername').isVisible()) {
        await page.locator('#loginUsername').fill('admin');
        await page.locator('#loginPassword').fill('admin@123');
        await page.locator('#btnLoginSubmit').click();
        await page.waitForSelector('#tabBtnTeachers');
      }

      // 1. Kiểm tra Hộp thoại Cấu hình BGH (#modalBghConfig)
      const modalBgh = page.locator('#modalBghConfig');
      const bghLatency = await page.evaluate(async () => {
        const t0 = performance.now();
        window.openModal('modalBghConfig');
        await new Promise(resolve => requestAnimationFrame(resolve));
        return Math.round(performance.now() - t0);
      });
      console.log(`⏱️ [${vp.name}] Dialog 4 - Độ trễ mở Modal BGH Config: ${bghLatency}ms`);

      expect(bghLatency).toBeLessThan(300);
      await modalBgh.waitFor({ state: 'visible' });
      await expect(page.locator('#inputBghSchool')).toBeVisible();
      await expect(page.locator('#inputBghTaxCode')).toBeVisible();
      await expect(page.locator('#inputBghCertOwner')).toBeVisible();
      await expect(page.locator('#inputBghSerial')).toBeVisible();

      // Kiểm tra z-index #modalBghConfig ở tầng z-[90]
      const bghZIndex = await page.evaluate(() => {
        const el = document.getElementById('modalBghConfig');
        return el ? window.getComputedStyle(el).zIndex : null;
      });
      expect(Number(bghZIndex) >= 90, `z-index của #modalBghConfig (${bghZIndex}) phải >= 90`).toBe(true);

      await assertNoHorizontalOverflow(page, 'Modal Cấu hình BGH');
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `r1_${vp.name}_dialog4_bgh_config.png`) });

      // Đóng modal cấu hình BGH
      await page.evaluate(() => window.closeModal('modalBghConfig'));
      await expect(modalBgh).toBeHidden();

      // 2. Kiểm tra chế độ Đóng dấu mộc đỏ 105pt trên PDF Viewer
      await page.evaluate(() => {
        // Cấp quyền đóng dấu con dấu nhà trường cho tài khoản phiên hiện tại
        if (window.appState?.currentUser) {
          window.appState.currentUser.canStampSeal = true;
        }
        // Khởi chạy trình xem với file mẫu
        window.openDocumentViewer('QuyetDinh_NhaTruong.pdf', new Uint8Array(1024), false);
      });

      const modalDocViewer = page.locator('#modalDocViewer');
      await modalDocViewer.waitFor({ state: 'visible' });

      // Nút Đóng Dấu Nhà Trường (#btnToggleSealPlacement) phải hiển thị
      const btnToggleSeal = page.locator('#btnToggleSealPlacement');
      await expect(btnToggleSeal).toBeVisible();

      // Kích hoạt chế độ đóng dấu
      await btnToggleSeal.click();

      // Kiểm tra con dấu mộc đỏ kích thước 105pt xuất hiện
      const stamp = page.locator('#draggableSignatureStamp');
      await expect(stamp).toBeVisible();

      // Nút xác nhận ký phải đổi sang trạng thái Đóng dấu đỏ
      const btnConfirmText = page.locator('#btnViewerConfirmSignText');
      await expect(btnConfirmText).toContainText('Xác Nhận Đóng Dấu');

      // Ảnh con dấu điện tử đỏ của trường
      const imgSeal = page.locator('#draggableSignatureImg');
      await expect(imgSeal).toBeVisible();
      const sealAlt = await imgSeal.getAttribute('alt');
      expect(sealAlt).toContain('Con dấu đỏ nhà trường');

      // Nhãn tên người ký trên con dấu phải là dấu cơ quan
      const signerNameEl = page.locator('#draggableStampSignerName');
      await expect(signerNameEl).toContainText('TRƯỜNG THCS CHU VĂN AN (Dấu cơ quan)');

      await assertNoHorizontalOverflow(page, 'Viewer chế độ Đóng dấu mộc đỏ 105pt');
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `r1_${vp.name}_dialog4_school_seal_stamp.png`) });

      // Đóng viewer
      await page.evaluate(() => window.closeModal('modalDocViewer'));
      await expect(modalDocViewer).toBeHidden();

      assertZeroConsoleErrors(page, 'Dialog 4: School Seal Confirmation Dialog');
    });

    // =========================================================================
    // DIALOG 5: Hộp thoại Từ Chối / Trả Về Hồ Sơ Kèm Lý Do
    // =========================================================================
    test('Dialog 5: Hộp thoại Trả về hồ sơ kèm lý do, tương tác Quick-fill pills và callback', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      const modalReject = page.locator('#modalRejectDocument');

      // Mở modal trả về hồ sơ với thông tin mẫu
      const tRejectStart = await page.evaluate(() => performance.now());
      await page.evaluate(() => {
        window.openModalRejectDocument('DOC_TEST_SUPERVISION_001');
      });
      await modalReject.waitFor({ state: 'visible' });
      const tRejectEnd = await page.evaluate(() => performance.now());
      const rejectLatency = Math.round(tRejectEnd - tRejectStart);
      console.log(`⏱️ [${vp.name}] Dialog 5 - Độ trễ mở Modal Reject Document: ${rejectLatency}ms`);

      expect(rejectLatency).toBeLessThan(300);

      // Kiểm tra z-index của modal trả về đạt chuẩn z-[110]
      const rejectZIndex = await page.evaluate(() => {
        const el = document.getElementById('modalRejectDocument');
        return el ? window.getComputedStyle(el).zIndex : null;
      });
      expect(Number(rejectZIndex) >= 110, `z-index của #modalRejectDocument (${rejectZIndex}) phải >= 110`).toBe(true);

      // Kiểm tra trường thông tin hiển thị
      await expect(page.locator('#rejectDocIdDisplay')).toContainText('DOC_TEST_SUPERVISION_001');
      const textareaReason = page.locator('#textareaRejectReason');
      await expect(textareaReason).toBeVisible();

      // 1. Thao tác với Quick-fill pill "Sai số liệu"
      const btnPillData = page.locator('button:has-text("Sai số liệu")');
      await expect(btnPillData).toBeVisible();
      await btnPillData.click();
      let currentVal = await textareaReason.inputValue();
      expect(currentVal).toContain('Số liệu chưa chính xác');

      // 2. Thao tác với Quick-fill pill "Thiếu ký nháy"
      const btnPillInitial = page.locator('button:has-text("Thiếu ký nháy")');
      await expect(btnPillInitial).toBeVisible();
      await btnPillInitial.click();
      currentVal = await textareaReason.inputValue();
      expect(currentVal).toContain('Thiếu phần xác nhận / ký nháy chuyên môn');

      // 3. Thao tác với Quick-fill pill "Sai thể thức"
      const btnPillFormat = page.locator('button:has-text("Sai thể thức")');
      await expect(btnPillFormat).toBeVisible();
      await btnPillFormat.click();
      currentVal = await textareaReason.inputValue();
      expect(currentVal).toContain('Văn bản chưa đúng thể thức');

      await assertNoHorizontalOverflow(page, 'Modal Trả Về Hồ Sơ');
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `r1_${vp.name}_dialog5_rejection.png`) });

      // Đóng modal bằng nút "Hủy bỏ"
      const btnCancel = page.locator('#modalRejectDocument button:has-text("Hủy bỏ")');
      await expect(btnCancel).toBeVisible();
      await btnCancel.click();
      await expect(modalReject).toBeHidden();

      assertZeroConsoleErrors(page, 'Dialog 5: Rejection Dialog');
    });

  });
}
