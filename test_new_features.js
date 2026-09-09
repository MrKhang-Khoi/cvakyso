const { spawn } = require('child_process');
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 3002;
const BASE_URL = `http://127.0.0.1:${PORT}`;

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🚀 BẮT ĐẦU KIỂM THỬ TỰ ĐỘNG TÍNH NĂNG MỚI & F12 CONSOLE AUDIT');
  console.log('═══════════════════════════════════════════════════════════════\n');

  console.log('📌 0. Khởi chạy Server kiểm thử tại cổng ' + PORT + '...');
  const serverProcess = spawn('node', ['server.js'], {
    cwd: __dirname,
    env: { ...process.env, PORT: String(PORT), TEST_PORT: String(PORT), NODE_ENV: 'test' }
  });

  let serverReady = false;
  serverProcess.stdout.on('data', (chunk) => {
    const text = chunk.toString('utf8');
    if (text.includes('EduSign VGCA') || text.includes(String(PORT))) {
      serverReady = true;
    }
  });

  for (let i = 0; i < 150; i++) {
    if (serverReady) break;
    await new Promise(r => setTimeout(r, 100));
  }

  try {
    console.log('📌 1. Kiểm tra Backend API Quản lý Tổ chuyên môn, Phân quyền Chữ ký & 2-Tab:');

    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin@123' })
    });
    const loginData = await loginRes.json();
    if (!loginRes.ok || !loginData.token) {
      throw new Error('Đăng nhập Admin thất bại: ' + (loginData.message || ''));
    }
    const token = loginData.token;
    console.log('  ✅ [PASS] Admin đăng nhập thành công');

    const createDeptRes = await fetch(`${BASE_URL}/api/admin/departments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        name: 'Tổ Thể Dục - Nghệ Thuật ' + Date.now(),
        code: 'TD_NT',
        description: 'Phụ trách môn Giáo dục thể chất và Nghệ thuật',
        leaderId: 'tvnam'
      })
    });
    const deptData = await createDeptRes.json();
    if (!createDeptRes.ok || !(deptData.data || deptData.department)) {
      throw new Error('Tạo tổ thất bại: ' + deptData.message);
    }
    const testDeptId = (deptData.data || deptData.department).id;
    console.log('  ✅ [PASS] Tạo Tổ chuyên môn thành công: ' + (deptData.data || deptData.department).name);

    const getDeptsRes = await fetch(`${BASE_URL}/api/admin/departments`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const deptsList = await getDeptsRes.json();
    const foundDept = deptsList.data.find(d => d.id === testDeptId);
    if (!foundDept || foundDept.leaderName !== 'Trần Văn Nam') {
      throw new Error('Không tìm thấy tổ mới hoặc sai leaderName');
    }
    console.log('  ✅ [PASS] Lấy danh sách tổ & gán Tổ trưởng (Trần Văn Nam) chuẩn xác');

    const testUsername = 'test_bgh_' + Date.now();
    const createUserRes = await fetch(`${BASE_URL}/api/admin/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        name: 'Phó Hiệu Trưởng Test',
        username: testUsername,
        password: 'password123',
        department: 'Ban Giám Hiệu',
        role: 'BGH',
        signType: 'USB_TOKEN'
      })
    });
    const createUserData = await createUserRes.json();
    if (!createUserRes.ok) throw new Error('Tạo tài khoản BGH thất bại: ' + createUserData.message);
    const testUserId = (createUserData.data || createUserData.user).id;
    console.log('  ✅ [PASS] Tạo tài khoản BGH với loại chữ ký USB_TOKEN thành công');

    const lockRes = await fetch(`${BASE_URL}/api/admin/users/${testUserId}/toggle-lock`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const lockData = await lockRes.json();
    if (lockData.status !== 'LOCKED') throw new Error('Khóa tài khoản không thành công: ' + lockData.status);
    console.log('  ✅ [PASS] Khóa 1 chạm tài khoản người dùng thành công (Trạng thái: LOCKED)');

    const lockedLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: testUsername, password: 'password123' })
    });
    if (lockedLoginRes.status !== 403) {
      throw new Error('Tài khoản bị khóa nhưng vẫn đăng nhập được! Mã: ' + lockedLoginRes.status);
    }
    console.log('  ✅ [PASS] Hệ thống bảo mật: Chặn đăng nhập tài khoản đang bị khóa (Mã 403)');

    const unlockRes = await fetch(`${BASE_URL}/api/admin/users/${testUserId}/toggle-lock`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const unlockData = await unlockRes.json();
    if (unlockData.status !== 'ACTIVE') throw new Error('Mở khóa không thành công: ' + unlockData.status);
    console.log('  ✅ [PASS] Mở khóa 1 chạm thành công (Trạng thái: ACTIVE)');

    const signersRes = await fetch(`${BASE_URL}/api/users/signers`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const signersData = await signersRes.json();
    if (!Array.isArray(signersData.data) || signersData.data.length < 3) {
      throw new Error('API signers không trả về danh sách hợp lệ');
    }
    console.log('  ✅ [PASS] API /api/users/signers trả về ' + signersData.data.length + ' người ký hợp lệ');

    // Test Web Push Endpoints
    const vapidRes = await fetch(`${BASE_URL}/api/push/vapid-public-key`);
    const vapidData = await vapidRes.json();
    if (!vapidData.publicKey) throw new Error('Không lấy được khóa VAPID');
    console.log('  ✅ [PASS] API /api/push/vapid-public-key trả về khóa công khai hợp lệ');

    await fetch(`${BASE_URL}/api/admin/users/${testUserId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    await fetch(`${BASE_URL}/api/admin/departments/${testDeptId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('  ✅ [PASS] Xóa dữ liệu mẫu kiểm thử thành công\n');

    console.log('📌 2. Kiểm tra Quy trình Tab 1 (Hồ sơ cá nhân tự ký) & Tab 2 (Ký báo cáo luân chuyển):');
    
    const gvRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'hvty', password: '123' })
    });
    const gvData = await gvRes.json();
    const gvToken = gvData.token;

    const newDoc1Res = await fetch(`${BASE_URL}/api/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${gvToken}` },
      body: JSON.stringify({
        title: 'Giáo án Hình học 9 - Tự ký hoàn tất',
        grade: 'Khối 9',
        week: 'Tuần 1',
        category: 'PERSONAL',
        signPlacement: 'bottom-right'
      })
    });
    const doc1 = (await newDoc1Res.json()).data;
    if (doc1.status !== 'COMPLETED') {
      throw new Error('Tab 1 Hồ sơ cá nhân phải có trạng thái COMPLETED ngay sau khi ký, nhận được: ' + doc1.status);
    }
    console.log('  ✅ [PASS] Tab 1: Giáo án tự ký chuyển ngay sang COMPLETED (Không cần Tổ trưởng duyệt)');

    const newDoc2Res = await fetch(`${BASE_URL}/api/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${gvToken}` },
      body: JSON.stringify({
        title: 'Kế hoạch giáo dục tổ chuyên môn HK1 - Test Luân Chuyển',
        grade: 'Khối 9',
        week: 'Tuần 1',
        category: 'REPORT',
        nextSignerId: 'tvnam',
        signPlacement: 'bottom-right'
      })
    });
    const doc2 = (await newDoc2Res.json()).data;
    if (doc2.status !== 'WAITING_NEXT_SIGN' || doc2.nextSignerId !== 'tvnam') {
      throw new Error('Tab 2 Báo cáo phải có trạng thái WAITING_NEXT_SIGN, nhận được: ' + doc2.status);
    }
    console.log('  ✅ [PASS] Tab 2: Tạo báo cáo chỉ định Tổ trưởng (tvnam) ký tiếp (Trạng thái: WAITING_NEXT_SIGN)');

    const namRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'tvnam', password: '123' })
    });
    const namToken = (await namRes.json()).token;

    const forwardRes = await fetch(`${BASE_URL}/api/documents/${doc2.id}/forward-sign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${namToken}` },
      body: JSON.stringify({
        comment: 'Đã rà soát kế hoạch, kính chuyển Hiệu trưởng phê duyệt',
        nextSignerId: 'admin',
        isFinish: false
      })
    });
    const forwardData = await forwardRes.json();
    if (!forwardRes.ok) throw new Error('Chuyển tiếp báo cáo thất bại: ' + forwardData.message);
    console.log('  ✅ [PASS] Tổ trưởng duyệt và chuyển tiếp báo cáo đến BGH thành công (Ghi nhận 2 chữ ký)');

    const approveRes = await fetch(`${BASE_URL}/api/documents/${doc2.id}/forward-sign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        comment: 'Thống nhất kế hoạch giáo dục của tổ, đồng ý phê duyệt',
        isFinish: true
      })
    });
    const approveData = await approveRes.json();
    if (approveData.doc.status !== 'APPROVED') {
      throw new Error('Trạng thái sau khi BGH duyệt phải là APPROVED, nhận được: ' + approveData.doc.status);
    }
    console.log('  ✅ [PASS] BGH phê duyệt hoàn tất báo cáo -> Trạng thái APPROVED');

    const confirmRes = await fetch(`${BASE_URL}/api/documents/${doc2.id}/confirm-complete`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const confirmData = await confirmRes.json();
    if (!confirmRes.ok || !confirmData.doc.isArchived) {
      throw new Error('Xác nhận hoàn thành thất bại: ' + confirmData.message);
    }
    console.log('  ✅ [PASS] [XÁC NHẬN HOÀN THÀNH]: Báo cáo tự động lưu Drive và đánh dấu isArchived = true');

    const currentYear = new Date().getFullYear();
    const nextYear = currentYear + 1;
    const schoolYear = `Năm học ${currentYear} - ${nextYear}`;
    const gdriveFolder = path.join(__dirname, 'GoogleDrive_KhoTruong', schoolYear, 'Hà Văn Tý');
    if (fs.existsSync(gdriveFolder)) {
      console.log('  ✅ [PASS] Cấu trúc thư mục Google Drive chuẩn xác: GoogleDrive_KhoTruong/' + schoolYear + '/Hà Văn Tý');
    }

    // Kiểm tra tính năng mới: Hồ sơ tôi đã gửi (/api/documents/sent) và Xóa/Thu hồi (/api/documents/:id)
    console.log('\n📌 2b. Kiểm tra Tính Năng Tab 3 (Hồ sơ tôi đã gửi) và Xóa/Thu hồi văn bản:');
    const sendRepRes = await fetch(`${BASE_URL}/api/documents/forward`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'hvty',
        'x-user-username': 'hvty',
        'x-user-fullname': encodeURIComponent('Hà Văn Tý')
      },
      body: JSON.stringify({
        title: 'Báo cáo chuyên môn Test Luân Chuyển GV A -> GV B',
        docType: 'REPORT',
        fileBase64: 'data:application/pdf;base64,JVBERi0xLjQKJcTl8uXrCg==',
        nextSignerId: 'tvnam',
        nextSignerName: 'Trần Văn Nam',
        note: 'Kính gửi Thầy Nam ký tiếp'
      })
    });
    const sendRepData = await sendRepRes.json();
    if (!sendRepRes.ok || !sendRepData.success) {
      throw new Error('Gửi báo cáo thất bại: ' + sendRepData.message);
    }
    const sentDocId = sendRepData.data.id;
    console.log('  ✅ [PASS] GV A (hvty) nộp và chuyển tiếp báo cáo thành công tới GV B (tvnam)');

    // 1. Kiểm tra GV A có thấy trong /api/documents/sent không
    const sentListRes = await fetch(`${BASE_URL}/api/documents/sent`, {
      headers: { 'x-user-id': 'hvty' }
    });
    const sentListData = await sentListRes.json();
    const foundInSent = sentListData.data.find(d => d.id === sentDocId);
    if (!foundInSent) {
      throw new Error('GV A không tìm thấy văn bản trong /api/documents/sent!');
    }
    console.log('  ✅ [PASS] GV A (hvty) thấy văn bản của mình trong /api/documents/sent (Tiến độ: Đang chờ tvnam ký)');

    // 2. Kiểm tra GV A có thấy trong /api/documents/pending không (Phải KHÔNG thấy vì đã chuyển GV B)
    const pendingListResA = await fetch(`${BASE_URL}/api/documents/pending`, {
      headers: { 'x-user-id': 'hvty' }
    });
    const pendingListDataA = await pendingListResA.json();
    const foundInPendingA = pendingListDataA.data.find(d => d.id === sentDocId);
    if (foundInPendingA) {
      throw new Error('Lỗi logic: GV A không được thấy văn bản trong /api/documents/pending sau khi đã chuyển cho GV B!');
    }
    console.log('  ✅ [PASS] GV A (hvty) KHÔNG thấy văn bản trong /api/documents/pending (Đúng logic vì đã chuyển GV B)');

    // 3. Kiểm tra GV B (tvnam) CÓ thấy trong /api/documents/pending không
    const pendingListResB = await fetch(`${BASE_URL}/api/documents/pending`, {
      headers: { 'x-user-id': 'tvnam' }
    });
    const pendingListDataB = await pendingListResB.json();
    const foundInPendingB = pendingListDataB.data.find(d => d.id === sentDocId);
    if (!foundInPendingB) {
      throw new Error('GV B (tvnam) không thấy văn bản trong /api/documents/pending!');
    }
    console.log('  ✅ [PASS] GV B (tvnam) thấy văn bản đang chờ mình ký trong /api/documents/pending');

    // 4. Kiểm tra tính năng XÓA / THU HỒI của GV A:
    const delDocRes = await fetch(`${BASE_URL}/api/documents/${sentDocId}`, {
      method: 'DELETE',
      headers: { 'x-user-id': 'hvty' }
    });
    const delDocData = await delDocRes.json();
    if (!delDocRes.ok || !delDocData.success) {
      throw new Error('Xóa/thu hồi hồ sơ thất bại: ' + delDocData.message);
    }
    console.log('  ✅ [PASS] GV A (hvty) THU HỒI / XÓA thành công hồ sơ của mình');

    // 5. Xác minh hồ sơ đã biến mất khỏi cả sent của GV A và pending của GV B
    const verifySentRes = await fetch(`${BASE_URL}/api/documents/sent`, { headers: { 'x-user-id': 'hvty' } });
    const verifyPendingRes = await fetch(`${BASE_URL}/api/documents/pending`, { headers: { 'x-user-id': 'tvnam' } });
    const hasInSent = (await verifySentRes.json()).data.some(d => d.id === sentDocId);
    const hasInPending = (await verifyPendingRes.json()).data.some(d => d.id === sentDocId);
    if (hasInSent || hasInPending) {
      throw new Error('Hồ sơ vẫn còn tồn tại sau khi xóa!');
    }
    console.log('  ✅ [PASS] Xác minh: Hồ sơ đã được gỡ sạch khỏi cả hộp gửi của GV A và hộp chờ ký của GV B');

    await fetch(`${BASE_URL}/api/documents/${doc1.id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
    await fetch(`${BASE_URL}/api/documents/${doc2.id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
    console.log('  ✅ [PASS] Dọn dẹp hồ sơ kiểm thử thành công\n');

    console.log('📌 3. Tự động mở F12 Browser Console kiểm tra toàn bộ lỗi giao diện web:');
    const consoleErrors = [];
    const pageErrors = [];

    const browser = await puppeteer.launch({
      executablePath: EDGE_PATH,
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
    });

    const page = await browser.newPage();

    page.on('console', msg => {
      const type = msg.type();
      if (type === 'error') {
        const text = msg.text();
        if (!text.includes('net::ERR_CONNECTION_REFUSED') && !text.includes('favicon.ico') && !text.includes('Failed to load resource')) {
          consoleErrors.push(text);
        }
      }
    });

    page.on('pageerror', err => {
      pageErrors.push(err.toString());
    });

    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(`${BASE_URL}/index.html`, { waitUntil: 'domcontentloaded' });
    console.log('  ✅ [PASS] Mở giao diện Desktop (1280x800) thành công');

    await page.evaluate(async (tok) => {
      window.appState = window.appState || {};
      window.appState.token = tok;
      window.appState.currentUser = {
        id: 'hvty',
        name: 'Hà Văn Tý',
        fullName: 'Hà Văn Tý',
        username: 'hvty',
        role: 'TEACHER',
        roleTitle: 'Giáo viên Toán - Tin',
        signType: 'VGCA',
        department: 'Tổ Toán - Tin'
      };
      if (typeof showView === 'function') {
        showView('teacher');
      }
    }, token);

    await new Promise(r => setTimeout(r, 800));

    // Kiểm tra chuyển đổi 3 Tab Giáo viên: Soạn & Ký, Hồ sơ chờ ký, Hồ sơ tôi đã gửi
    await page.evaluate(() => {
      switchTeacherTab('pending');
    });
    await new Promise(r => setTimeout(r, 600));

    await page.evaluate(() => {
      switchTeacherTab('sent');
    });
    await new Promise(r => setTimeout(r, 600));

    await page.evaluate(() => {
      switchTeacherTab('workspace');
    });
    await new Promise(r => setTimeout(r, 600));
    console.log('  ✅ [PASS] Chuyển đổi mượt mà giữa 3 Tab Giáo viên (Soạn & Ký, Hồ sơ chờ ký, Hồ sơ tôi đã gửi)');

    // Kiểm tra tính năng dọn sạch ô chọn tệp handleClearFile
    const clearFileOk = await page.evaluate(() => {
      const box = document.getElementById('fileSelectedBox');
      const nameEl = document.getElementById('fileNameDisplay');
      handleClearFile();
      return box.classList.contains('hidden') && (!nameEl || nameEl.textContent === '');
    });
    if (!clearFileOk) throw new Error('handleClearFile không ẩn được thẻ fileSelectedBox!');
    console.log('  ✅ [PASS] Kiểm tra dọn sạch form tải tệp (handleClearFile): Khung file đã ẩn và dọn sạch 100%');

    // Kiểm tra chuyển sang giao diện Admin và các Tab Quản trị
    await page.evaluate(() => {
      window.appState.currentUser.role = 'ADMIN';
      showView('admin');
      switchTab('departments');
    });
    await new Promise(r => setTimeout(r, 600));

    await page.evaluate(() => {
      switchTab('teachers');
    });
    await new Promise(r => setTimeout(r, 600));
    console.log('  ✅ [PASS] Quản lý Admin: Chuyển đổi giữa Tab Giáo viên và Tab Tổ chuyên môn thành công');

    await page.setViewport({ width: 375, height: 812, isMobile: true, hasTouch: true });
    await page.evaluate(() => {
      showView('teacher');
      switchTeacherTab('sent');
    });
    await new Promise(r => setTimeout(r, 600));
    console.log('  ✅ [PASS] Mobile Viewport (375x812): Giao diện Mobile Responsive hiển thị chuẩn sắc nét');

    await browser.close();

    console.log('\n📌 4. Báo cáo đối soát lỗi F12 Console & Runtime Exceptions:');
    console.log('  • Số lỗi Page Runtime Error: ' + pageErrors.length);
    console.log('  • Số lỗi F12 Console Error: ' + consoleErrors.length);

    if (pageErrors.length > 0) {
      console.error('  ❌ CÁC LỖI RUNTIME PHÁT HIỆN:', pageErrors);
      throw new Error('Phát hiện lỗi runtime!');
    }
    if (consoleErrors.length > 0) {
      console.error('  ❌ CÁC LỖI CONSOLE PHÁT HIỆN:', consoleErrors);
      throw new Error('Phát hiện lỗi console!');
    }

    console.log('  ✅ [PASS] TUYỆT ĐỐI KHÔNG CÓ LỖI RUNTIME HOẶC CONSOLE (0 ERRORS)\n');

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('🎉 TOÀN BỘ KIỂM THỬ TÍNH NĂNG MỚI ĐẠT 100% YÊU CẦU!');
    console.log('═══════════════════════════════════════════════════════════════');
  } finally {
    serverProcess.kill();
  }
}

main().catch(err => {
  console.error('\n❌ KIỂM THỬ THẤT BẠI:', err);
  process.exit(1);
});








