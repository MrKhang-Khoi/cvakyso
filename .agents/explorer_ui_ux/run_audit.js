const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const VIEWPORTS = [
  { name: 'Desktop-1920x1080', width: 1920, height: 1080, isMobile: false },
  { name: 'Laptop-1366x768', width: 1366, height: 768, isMobile: false },
  { name: 'Tablet-768x1024', width: 768, height: 1024, isMobile: true, hasTouch: true },
  { name: 'Mobile-390x844', width: 390, height: 844, isMobile: true, hasTouch: true }
];

const BASE_URL = 'http://localhost:3000';
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');
const RESULTS_FILE = path.join(__dirname, 'audit_metrics.json');

const METRICS_EVAL_FN = `
(() => {
  function getLuminance(r, g, b) {
    const a = [r, g, b].map(v => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
  }

  function parseColor(str) {
    if (!str || str === 'transparent' || str.includes('rgba(0, 0, 0, 0)')) return null;
    const m = str.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)(?:,\\s*([\\d.]+))?\\)/);
    if (!m) return null;
    return { r: parseInt(m[1]), g: parseInt(m[2]), b: parseInt(m[3]), a: m[4] !== undefined ? parseFloat(m[4]) : 1 };
  }

  function getContrast(fgStr, bgStr) {
    const fg = parseColor(fgStr);
    const bg = parseColor(bgStr) || { r: 255, g: 255, b: 255, a: 1 };
    if (!fg) return null;
    const l1 = getLuminance(fg.r, fg.g, fg.b);
    const l2 = getLuminance(bg.r, bg.g, bg.b);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
  }

  // 1. Page and element horizontal overflow audit
  const bodyScrollW = document.body ? document.body.scrollWidth : 0;
  const docScrollW = document.documentElement ? document.documentElement.scrollWidth : 0;
  const clientW = window.innerWidth;
  const hasPageOverflow = docScrollW > clientW || bodyScrollW > clientW;

  const overflowElements = [];
  document.querySelectorAll('*').forEach(el => {
    if (el.offsetWidth > 0 && el.offsetHeight > 0) {
      if (el.scrollWidth > el.clientWidth + 1) {
        const style = window.getComputedStyle(el);
        const ox = style.overflowX;
        overflowElements.push({
          tag: el.tagName.toLowerCase(),
          id: el.id || '',
          className: (el.className && typeof el.className === 'string') ? el.className.slice(0, 100) : '',
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth,
          diff: el.scrollWidth - el.clientWidth,
          overflowX: ox,
          text: (el.innerText || '').slice(0, 50).replace(/\\s+/g, ' ')
        });
      }
    }
  });

  // 2. Touch target audit for interactive elements
  const touchTargets = [];
  const interactiveSelector = 'button, a, input, select, textarea, [onclick], [role="button"]';
  document.querySelectorAll(interactiveSelector).forEach(el => {
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      const style = window.getComputedStyle(el);
      if (style.visibility !== 'hidden' && style.display !== 'none') {
        const isTooSmall = rect.width < 44 || rect.height < 44;
        const fg = style.color;
        let bg = style.backgroundColor;
        let parent = el.parentElement;
        while (parent && (!bg || bg === 'transparent' || bg.includes('rgba(0, 0, 0, 0)'))) {
          bg = window.getComputedStyle(parent).backgroundColor;
          parent = parent.parentElement;
        }
        const contrast = getContrast(fg, bg);

        touchTargets.push({
          tag: el.tagName.toLowerCase(),
          id: el.id || '',
          className: (el.className && typeof el.className === 'string') ? el.className.slice(0, 100) : '',
          width: Math.round(rect.width * 10) / 10,
          height: Math.round(rect.height * 10) / 10,
          isTooSmall,
          text: (el.innerText || el.value || el.placeholder || el.title || el.getAttribute('aria-label') || '').trim().slice(0, 40),
          color: fg,
          bgColor: bg,
          contrastRatio: contrast ? Math.round(contrast * 100) / 100 : null
        });
      }
    }
  });

  // 3. Contrast audit for text elements
  const textContrastItems = [];
  document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, span, label, td, th').forEach(el => {
    if (el.children.length === 0 && el.offsetWidth > 0 && el.offsetHeight > 0 && el.innerText.trim().length > 0) {
      const style = window.getComputedStyle(el);
      if (style.visibility !== 'hidden' && style.display !== 'none') {
        const fg = style.color;
        let bg = style.backgroundColor;
        let parent = el.parentElement;
        while (parent && (!bg || bg === 'transparent' || bg.includes('rgba(0, 0, 0, 0)'))) {
          bg = window.getComputedStyle(parent).backgroundColor;
          parent = parent.parentElement;
        }
        const ratio = getContrast(fg, bg);
        const fontSize = parseFloat(style.fontSize);
        const isBold = parseInt(style.fontWeight) >= 600 || style.fontWeight === 'bold';
        const isHeading = ['h1','h2','h3','h4'].includes(el.tagName.toLowerCase()) || fontSize >= 18;
        const requiredRatio = isHeading ? 7.0 : 4.5;
        const fails = ratio !== null && ratio < requiredRatio;

        if (fails || (ratio !== null && ratio < 4.5)) {
          textContrastItems.push({
            tag: el.tagName.toLowerCase(),
            id: el.id || '',
            text: el.innerText.slice(0, 60).trim().replace(/\\s+/g, ' '),
            fontSize: style.fontSize,
            fontWeight: style.fontWeight,
            color: fg,
            bgColor: bg,
            ratio: ratio ? Math.round(ratio * 100) / 100 : null,
            requiredRatio,
            isHeading,
            fails
          });
        }
      }
    }
  });

  return {
    viewport: { width: window.innerWidth, height: window.innerHeight },
    hasPageOverflow,
    docScrollW,
    clientW,
    bodyScrollW,
    overflowElementsCount: overflowElements.length,
    overflowElements: overflowElements.slice(0, 30),
    touchTargetsTotal: touchTargets.length,
    touchTargetViolations: touchTargets.filter(t => t.isTooSmall),
    textContrastFails: textContrastItems.slice(0, 30)
  };
})()
`;

async function main() {
  console.log('--- STARTING REFINED PLAYWRIGHT MULTI-VIEWPORT AUDIT ---');

  // Check if server running
  const isPortOpen = await new Promise(resolve => {
    const net = require('net');
    const socket = new net.Socket();
    socket.setTimeout(1000);
    socket.on('connect', () => { socket.destroy(); resolve(true); });
    socket.on('error', () => { socket.destroy(); resolve(false); });
    socket.on('timeout', () => { socket.destroy(); resolve(false); });
    socket.connect(3000, '127.0.0.1');
  });

  let serverProcess = null;
  if (!isPortOpen) {
    console.log('Starting server.js on port 3000...');
    serverProcess = cp.spawn('node', ['server.js'], { cwd: path.join(__dirname, '../..') });
    await new Promise(r => setTimeout(r, 2500));
  } else {
    console.log('Server is already running on port 3000.');
  }

  const browser = await chromium.launch({ headless: true });
  const allResults = {
    timestamp: new Date().toISOString(),
    viewports: {}
  };

  try {
    for (const vp of VIEWPORTS) {
      console.log(`\n======================================================`);
      console.log(`AUDITING VIEWPORT: ${vp.name} (${vp.width}x${vp.height})`);
      console.log(`======================================================`);

      const vpResults = {
        name: vp.name,
        width: vp.width,
        height: vp.height,
        views: {},
        consoleLogs: []
      };

      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        isMobile: vp.isMobile,
        hasTouch: vp.hasTouch
      });

      const page = await context.newPage();

      page.on('console', msg => {
        const type = msg.type();
        const text = msg.text();
        if (type === 'error' || type === 'warn') {
          vpResults.consoleLogs.push({ type, text });
        }
      });
      page.on('pageerror', err => {
        vpResults.consoleLogs.push({ type: 'uncaught-error', text: err.message });
      });

      // 1. INDEX.HTML - LOGIN VIEW
      console.log(`[${vp.name}] 1. Login View (#viewLogin)...`);
      await page.goto(`${BASE_URL}/index.html`, { waitUntil: 'networkidle' });
      await page.waitForSelector('#viewLogin', { state: 'visible' });

      vpResults.views['viewLogin'] = await page.evaluate(METRICS_EVAL_FN);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${vp.name}_viewLogin.png`), fullPage: false });

      // VGCA Login Modal
      console.log(`[${vp.name}] 1b. Modal VGCA Login (#modalVgcaLogin)...`);
      await page.evaluate(() => {
        const m = document.getElementById('modalVgcaLogin');
        if (m) m.classList.remove('hidden');
      });
      await page.waitForTimeout(200);
      vpResults.views['modalVgcaLogin'] = await page.evaluate(METRICS_EVAL_FN);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${vp.name}_modalVgcaLogin.png`), fullPage: false });
      await page.evaluate(() => {
        const m = document.getElementById('modalVgcaLogin');
        if (m) m.classList.add('hidden');
      });

      // 2. TEACHER WORKSPACE
      console.log(`[${vp.name}] 2. Logging in as Teacher (cva.ty)...`);
      await page.fill('#loginUsername', 'cva.ty');
      await page.fill('#loginPassword', '123456');
      await page.click('#formLogin button[type="submit"]');
      await page.waitForSelector('#viewTeacher', { state: 'visible', timeout: 5000 });

      // Tab 1: Soạn & Trình ký
      console.log(`[${vp.name}] 2a. Teacher Tab 1: Soạn & Trình ký...`);
      vpResults.views['teacherTab1_Workspace'] = await page.evaluate(METRICS_EVAL_FN);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${vp.name}_teacher_tab1.png`), fullPage: false });

      // Settings dropdown
      await page.evaluate(() => {
        const dd = document.getElementById('teacherSettingsDropdown');
        if (dd) dd.classList.remove('hidden');
      });
      await page.waitForTimeout(200);
      vpResults.views['teacherSettingsDropdown'] = await page.evaluate(METRICS_EVAL_FN);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${vp.name}_teacher_dropdown.png`), fullPage: false });
      await page.evaluate(() => {
        const dd = document.getElementById('teacherSettingsDropdown');
        if (dd) dd.classList.add('hidden');
      });

      // Tab 2: Cần tôi ký
      console.log(`[${vp.name}] 2b. Teacher Tab 2: Cần tôi ký...`);
      await page.click('#tabBtnTeacherPending');
      await page.waitForTimeout(400);
      vpResults.views['teacherTab2_Pending'] = await page.evaluate(METRICS_EVAL_FN);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${vp.name}_teacher_tab2.png`), fullPage: false });

      // Tab 3: Tiến độ hồ sơ
      console.log(`[${vp.name}] 2c. Teacher Tab 3: Tiến độ hồ sơ...`);
      await page.click('#tabBtnTeacherSent');
      await page.waitForTimeout(400);
      vpResults.views['teacherTab3_Sent'] = await page.evaluate(METRICS_EVAL_FN);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${vp.name}_teacher_tab3.png`), fullPage: false });

      // Tab 3 Subfilter: Bị trả về
      console.log(`[${vp.name}] 2d. Teacher Tab 3 Subfilter: Cần sửa lại / Bị trả về...`);
      const subBtnReturned = await page.$('#sentFilterBtnReturned');
      if (subBtnReturned) {
        await subBtnReturned.click();
        await page.waitForTimeout(300);
        vpResults.views['teacherTab3_SubReturned'] = await page.evaluate(METRICS_EVAL_FN);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${vp.name}_teacher_tab3_returned.png`), fullPage: false });
      }

      // Tab 4: Kho Báo cáo số
      console.log(`[${vp.name}] 2e. Teacher Tab 4: Kho Báo cáo số...`);
      await page.click('#tabBtnTeacherReports');
      await page.waitForTimeout(400);
      vpResults.views['teacherTab4_Reports'] = await page.evaluate(METRICS_EVAL_FN);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${vp.name}_teacher_tab4_reports.png`), fullPage: false });

      // 3. PDF VIEWER & DRAG STAMP MODAL
      console.log(`[${vp.name}] 3. PDF Doc Viewer (#modalDocViewer)...`);
      await page.evaluate(() => {
        const m = document.getElementById('modalDocViewer');
        if (m) {
          m.classList.remove('hidden');
          const tb = document.getElementById('viewerSigToolBar');
          if (tb) tb.classList.remove('hidden');
          const stamp = document.getElementById('draggableSignatureStamp');
          if (stamp) stamp.classList.remove('hidden');
          const sealBtn = document.getElementById('btnToggleSealPlacement');
          if (sealBtn) sealBtn.classList.remove('hidden');
          const chained = document.getElementById('viewerChainedSignBar');
          if (chained) chained.classList.remove('hidden');
        }
      });
      await page.waitForTimeout(300);
      vpResults.views['modalDocViewer'] = await page.evaluate(METRICS_EVAL_FN);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${vp.name}_modalDocViewer.png`), fullPage: false });

      // Signing Overlay
      console.log(`[${vp.name}] 3b. Signing Overlay in DocViewer...`);
      await page.evaluate(() => {
        const overlay = document.getElementById('viewerSigningOverlay');
        if (overlay) overlay.classList.remove('hidden');
      });
      await page.waitForTimeout(200);
      vpResults.views['viewerSigningOverlay'] = await page.evaluate(METRICS_EVAL_FN);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${vp.name}_viewerSigningOverlay.png`), fullPage: false });
      await page.evaluate(() => {
        const overlay = document.getElementById('viewerSigningOverlay');
        if (overlay) overlay.classList.add('hidden');
        const m = document.getElementById('modalDocViewer');
        if (m) m.classList.add('hidden');
      });

      // 4. MODALS: Upload Signature, Check Agent, Reject Dialog
      console.log(`[${vp.name}] 4a. Modal Upload Signature (Personal)...`);
      await page.evaluate(() => {
        if (typeof openModalUploadSignature === 'function') openModalUploadSignature('PERSONAL');
      });
      await page.waitForTimeout(250);
      vpResults.views['modalUploadSignature_Personal'] = await page.evaluate(METRICS_EVAL_FN);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${vp.name}_modalUploadSig_Personal.png`), fullPage: false });

      console.log(`[${vp.name}] 4b. Modal Upload Signature (School Seal)...`);
      await page.evaluate(() => {
        if (typeof switchUploadSignatureTarget === 'function') switchUploadSignatureTarget('SCHOOL_SEAL');
      });
      await page.waitForTimeout(200);
      vpResults.views['modalUploadSignature_SchoolSeal'] = await page.evaluate(METRICS_EVAL_FN);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${vp.name}_modalUploadSig_SchoolSeal.png`), fullPage: false });
      await page.evaluate(() => {
        const m = document.getElementById('modalUploadSignature');
        if (m) m.classList.add('hidden');
      });

      // Modal Check Agent
      console.log(`[${vp.name}] 4c. Modal Check Agent...`);
      await page.evaluate(() => {
        if (typeof openModalCheckAgent === 'function') openModalCheckAgent();
      });
      await page.waitForTimeout(200);
      vpResults.views['modalCheckAgent'] = await page.evaluate(METRICS_EVAL_FN);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${vp.name}_modalCheckAgent.png`), fullPage: false });
      await page.evaluate(() => {
        const m = document.getElementById('modalCheckAgent');
        if (m) m.classList.add('hidden');
      });

      // Modal Reject Document
      console.log(`[${vp.name}] 4d. Modal Reject Document...`);
      await page.evaluate(() => {
        if (typeof openModalRejectDocument === 'function') openModalRejectDocument('doc_test_123');
      });
      await page.waitForTimeout(200);
      vpResults.views['modalRejectDocument'] = await page.evaluate(METRICS_EVAL_FN);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${vp.name}_modalRejectDocument.png`), fullPage: false });
      await page.evaluate(() => {
        const m = document.getElementById('modalRejectDocument');
        if (m) m.classList.add('hidden');
      });

      // 5. ADMIN WORKSPACE (#viewAdmin) - Login: admin
      console.log(`[${vp.name}] 5. Logging into Admin Workspace...`);
      await page.evaluate(() => {
        if (typeof handleLogout === 'function') handleLogout();
        else localStorage.clear();
      });
      await page.goto(`${BASE_URL}/index.html`, { waitUntil: 'networkidle' });
      await page.fill('#loginUsername', 'admin');
      await page.fill('#loginPassword', 'admin@123');
      await page.click('#formLogin button[type="submit"]');
      await page.waitForSelector('#viewAdmin', { state: 'visible', timeout: 5000 });

      // Admin Tab 1: Danh sách giáo viên
      console.log(`[${vp.name}] 5a. Admin Tab 1: Danh sách Giáo viên...`);
      vpResults.views['adminTab1_Teachers'] = await page.evaluate(METRICS_EVAL_FN);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${vp.name}_admin_tab1.png`), fullPage: false });

      // Admin Tab 2: Tổ chuyên môn
      console.log(`[${vp.name}] 5b. Admin Tab 2: Tổ chuyên môn...`);
      await page.click('#tabBtnDepartments');
      await page.waitForTimeout(400);
      vpResults.views['adminTab2_Departments'] = await page.evaluate(METRICS_EVAL_FN);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${vp.name}_admin_tab2.png`), fullPage: false });

      // Admin Tab 3: Quản lý & Làm sạch báo cáo
      console.log(`[${vp.name}] 5c. Admin Tab 3: Quản lý & Làm sạch báo cáo...`);
      await page.click('#tabBtnAdminReports');
      await page.waitForTimeout(400);
      vpResults.views['adminTab3_Reports'] = await page.evaluate(METRICS_EVAL_FN);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${vp.name}_admin_tab3.png`), fullPage: false });

      // Modal BGH Config
      console.log(`[${vp.name}] 5d. Modal BGH Seal Config...`);
      await page.evaluate(() => {
        if (typeof openModalBghConfig === 'function') openModalBghConfig();
      });
      await page.waitForTimeout(200);
      vpResults.views['modalBghConfig'] = await page.evaluate(METRICS_EVAL_FN);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${vp.name}_modalBghConfig.png`), fullPage: false });
      await page.evaluate(() => {
        const m = document.getElementById('modalBghConfig');
        if (m) m.classList.add('hidden');
      });

      // Modal Confirm Reset Reports
      console.log(`[${vp.name}] 5e. Modal Confirm Reset All Reports...`);
      await page.evaluate(() => {
        if (typeof openModalConfirmResetAllReports === 'function') openModalConfirmResetAllReports();
      });
      await page.waitForTimeout(200);
      vpResults.views['modalConfirmResetReports'] = await page.evaluate(METRICS_EVAL_FN);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${vp.name}_modalConfirmResetReports.png`), fullPage: false });
      await page.evaluate(() => {
        const m = document.getElementById('modalConfirmResetReports');
        if (m) m.classList.add('hidden');
      });

      // 6. PUBLIC REPORT PORTAL (portal-baocao.html)
      console.log(`[${vp.name}] 6a. Public Report Portal Guest View...`);
      await page.goto(`${BASE_URL}/portal-baocao.html`, { waitUntil: 'networkidle' });
      await page.waitForSelector('#reportTableBody');
      await page.waitForTimeout(400);
      vpResults.views['portal_GuestView'] = await page.evaluate(METRICS_EVAL_FN);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${vp.name}_portal_guest.png`), fullPage: false });

      // Portal Admin Auth Modal
      console.log(`[${vp.name}] 6b. Portal Admin Auth Modal...`);
      await page.evaluate(() => {
        if (typeof openAdminModal === 'function') openAdminModal();
      });
      await page.waitForTimeout(200);
      vpResults.views['portal_modalAdminAuth'] = await page.evaluate(METRICS_EVAL_FN);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${vp.name}_portal_adminModal.png`), fullPage: false });

      // Log in to Portal Admin Mode
      console.log(`[${vp.name}] 6c. Portal Admin Active View...`);
      await page.fill('#adminPasswordInput', 'admin@123');
      await page.click('#modalAdminAuth button[onclick*="handleAdminLogin"]');
      await page.waitForTimeout(400);
      vpResults.views['portal_AdminActiveView'] = await page.evaluate(METRICS_EVAL_FN);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${vp.name}_portal_adminActive.png`), fullPage: false });

      // Portal Batch Delete Modal
      console.log(`[${vp.name}] 6d. Portal Batch Delete Modal...`);
      await page.evaluate(() => {
        if (typeof confirmBatchDeleteReports === 'function') confirmBatchDeleteReports();
      });
      await page.waitForTimeout(200);
      vpResults.views['portal_modalConfirmBatchDelete'] = await page.evaluate(METRICS_EVAL_FN);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${vp.name}_portal_batchDeleteModal.png`), fullPage: false });
      await page.evaluate(() => {
        const m = document.getElementById('modalConfirmBatchDelete');
        if (m) m.classList.add('hidden');
      });

      // Portal PDF Modal
      console.log(`[${vp.name}] 6e. Portal PDF Viewer Modal...`);
      await page.evaluate(() => {
        if (typeof openPdfModal === 'function') openPdfModal('https://example.com/test.pdf', 'Báo cáo Kiểm tra Chuyên môn Học kỳ 1');
      });
      await page.waitForTimeout(200);
      vpResults.views['portal_pdfModal'] = await page.evaluate(METRICS_EVAL_FN);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${vp.name}_portal_pdfModal.png`), fullPage: false });
      await page.evaluate(() => {
        if (typeof closePdfModal === 'function') closePdfModal();
      });

      // Portal Config Modal
      console.log(`[${vp.name}] 6f. Portal Config Modal...`);
      await page.evaluate(() => {
        if (typeof toggleConfigModal === 'function') toggleConfigModal();
      });
      await page.waitForTimeout(200);
      vpResults.views['portal_configModal'] = await page.evaluate(METRICS_EVAL_FN);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${vp.name}_portal_configModal.png`), fullPage: false });
      await page.evaluate(() => {
        const m = document.getElementById('configModal');
        if (m) m.classList.add('hidden');
      });

      allResults.viewports[vp.name] = vpResults;
      console.log(`[${vp.name}] COMPLETED ALL AUDITS SUCCESSFULLY!`);
      await context.close();
    }
  } catch (err) {
    console.error('Fatal error during audit:', err);
  } finally {
    await browser.close();
    if (serverProcess) {
      serverProcess.kill();
    }
  }

  // Save audit data
  fs.writeFileSync(RESULTS_FILE, JSON.stringify(allResults, null, 2), 'utf8');
  console.log(`\n======================================================`);
  console.log(`✅ AUDIT METRICS WRITTEN TO: ${RESULTS_FILE}`);
  console.log(`======================================================`);
}

main().catch(err => {
  console.error('Error running audit script:', err);
  process.exit(1);
});
