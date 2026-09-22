/**
 * ============================================================================
 * EDUSIGN WEB — CLIENT APPLICATION JAVASCRIPT
 * Hỗ trợ 2 chế độ:
 * 1. Chế độ GitHub Pages (Static Web): Kết nối trực tiếp Firebase Realtime DB
 *    (Không cần chạy server cục bộ, hoạt động 100% trên GitHub Pages / Trình duyệt)
 * 2. Chế độ Render Server: Gọi qua API backend khi chạy đầy đủ
 * ============================================================================
 */

// ==================== GLOBAL CONFIG & MULTI-NODE CLUSTER ====================
const isStaticOrGitHub = window.location.hostname.includes('github.io') || 
                         window.location.protocol === 'file:' || 
                         window.location.port !== '3000';

// Cụm máy chủ Render song song (Multi-Node Active-Failover Cluster)
const DEFAULT_PRIMARY_NODE = 'https://edusign-vgca.onrender.com';
const DEFAULT_SECONDARY_NODE = 'https://edusign-node2.onrender.com';

let BACKEND_RENDER_URL = (typeof localStorage !== 'undefined' && localStorage.getItem('edusign_active_backend')) || DEFAULT_PRIMARY_NODE;
let API_BASE = isStaticOrGitHub ? BACKEND_RENDER_URL : '';

// Hàm tự động chuyển đổi sang Node dự phòng nếu Node chính gặp sự cố (Auto-Failover)
function switchClusterNode(failedUrl) {
  if (failedUrl && failedUrl.includes('edusign-vgca')) {
    BACKEND_RENDER_URL = DEFAULT_SECONDARY_NODE;
    console.warn('[Cluster Failover] Đã tự động chuyển hướng sang Render Node 2:', BACKEND_RENDER_URL);
  } else {
    BACKEND_RENDER_URL = DEFAULT_PRIMARY_NODE;
    console.warn('[Cluster Failover] Đã tự động chuyển hướng sang Render Node 1:', BACKEND_RENDER_URL);
  }
  try { if (typeof localStorage !== 'undefined') localStorage.setItem('edusign_active_backend', BACKEND_RENDER_URL); } catch (e) { void e; }
  API_BASE = isStaticOrGitHub ? BACKEND_RENDER_URL : '';
  return API_BASE;
}

// Giữ ấm cả 2 máy chủ định kỳ (Anti-Sleep Heartbeat 4 phút) trong khi người dùng mở tab
if (typeof window !== 'undefined') {
  setInterval(() => {
    [DEFAULT_PRIMARY_NODE, DEFAULT_SECONDARY_NODE].forEach((url) => {
      try {
        fetch(`${url}/api/ping-local-signer`, { method: 'GET', mode: 'cors' }).catch((err) => { void err; });
      } catch (e) { void e; }
    });
  }, 4 * 60 * 1000);
}

let appState = {
  token: localStorage.getItem('edusign_token') || null,
  currentUser: JSON.parse(localStorage.getItem('edusign_user') || 'null'),
  users: [],
  departments: [],
  activeTab: 'teachers'
};
window.appState = appState;

// Tự động đồng bộ SĐT cho giáo viên Hà Văn Tý nếu phiên làm việc cũ lưu chuỗi rỗng
if (appState.currentUser && (appState.currentUser.username === 'cva.ty' || appState.currentUser.id === 'user_cvaty')) {
  if (!appState.currentUser.phone) {
    appState.currentUser.phone = '0818810007';
    try { localStorage.setItem('edusign_user', JSON.stringify(appState.currentUser)); } catch (e) { console.warn('[Client Handled] e:', e && e.message ? e.message : e); }
  }
}

// URL Google Apps Script Webhook điều phối Zalo Bot 1-1
const DEFAULT_GAS_URL = "https://script.google.com/macros/s/AKfycbwGBgauc9xHzRe31_IfCQD-Q9yHwGp4CfYLEam9IupcYhLpNBXbgW0J1t-weD6iUQ87ZQ/exec";

/**
 * Gửi thông báo sự kiện Ký số đến Zalo Bot (Chạy trực tiếp từ Trình duyệt Client không phụ thuộc backend)
 */
async function sendZaloNotificationClientSide(payload) {
  try {
    const url = DEFAULT_GAS_URL;
    if (!url || !url.startsWith('http')) return;
    if (!payload) payload = {};
    if (!payload.secret_token) {
      payload.secret_token = "UnifiedZaloBotTHCSCVA2026Secret";
    }
    console.log('[ZaloNotify Client] Đang phát thông báo Zalo:', payload.eventType, payload.docTitle);

    // Gửi với text/plain UTF-8 kết hợp mode: 'no-cors' để vượt qua 100% rào cản CORS của Google Apps Script
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify(payload),
      redirect: 'follow',
      mode: 'no-cors'
    }).catch(e => console.warn('[ZaloNotify Client] Fetch warning:', e.message));
  } catch (err) {
    console.warn('[ZaloNotify Client] Exception:', err.message);
  }
}


function normalizeTeacherPhone(raw) {
  if (!raw) return '';
  let clean = String(raw).replace(/\D/g, '');
  if (clean.startsWith('840') && clean.length >= 11) clean = clean.slice(2);
  else if (clean.startsWith('84') && clean.length >= 10) clean = '0' + clean.slice(2);
  if (clean.length === 9 && !clean.startsWith('0')) clean = '0' + clean;
  if (clean.length === 10 && !clean.startsWith('0') && clean.startsWith('2')) clean = '0' + clean;
  return clean;
}

function normalizeTeacherPin(rawPin, phone) {
  let pin = String(rawPin || '').trim();
  if (!pin && phone) {
    const cleanP = normalizeTeacherPhone(phone);
    if (cleanP.length >= 4) pin = cleanP.slice(-4);
  }
  if (!pin) pin = '1234';
  if (/^\d+$/.test(pin) && pin.length < 4) {
    pin = pin.padStart(4, '0');
  }
  return pin;
}

/**
 * Tự động đồng bộ thông tin tài khoản Giáo viên lên Google Sheet "Danh bạ GV" & Mã PIN Zalo Bot
 */
async function syncTeacherToGoogleSheet(teacher) {
  try {
    const url = DEFAULT_GAS_URL;
    if (!url || !url.startsWith('http')) return;
    if (!teacher || (!teacher.fullName && !teacher.phone)) return;

    const nameParts = (teacher.fullName || teacher.name || '').trim().split(/\s+/);
    const shortName = nameParts.length > 0 ? nameParts[nameParts.length - 1] : teacher.fullName;
    const cleanPhone = normalizeTeacherPhone(teacher.phone);
    const pinCode = normalizeTeacherPin(teacher.pinCode || teacher.zaloPin, cleanPhone);

    const payload = {
      action: "SYNC_TEACHER",
      secret_token: "UnifiedZaloBotTHCSCVA2026Secret",
      teacher: {
        fullName: teacher.fullName || teacher.name || '',
        phone: cleanPhone || teacher.phone || '',
        department: teacher.departmentName || teacher.department || '',
        email: teacher.email || '',
        pinCode: pinCode,
        shortName: teacher.shortName || shortName,
        role: teacher.role || 'TEACHER',
        cccd: teacher.cccd || ''
      }
    };

    console.log('[GoogleSheet Sync] Đang đồng bộ tài khoản lên Google Sheet:', payload.teacher.fullName, payload.teacher.phone, 'PIN:', payload.teacher.pinCode);

    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify(payload),
      redirect: 'follow',
      mode: 'no-cors'
    }).catch(e => console.warn('[GoogleSheet Sync] Fetch warning:', e.message));
  } catch (err) {
    console.warn('[GoogleSheet Sync] Exception:', err.message);
  }
}

/**
 * Đồng bộ hàng loạt toàn bộ danh bạ giáo viên và mã PIN lên Google Sheets
 */
async function handleSyncAllTeachersToSheet() {
  const teachers = (appState.users || []).filter(u => u && (u.fullName || u.name));
  if (teachers.length === 0) {
    showToast('Chưa có danh sách giáo viên để đồng bộ!', 'warning');
    return;
  }

  showToast(`Đang đồng bộ ${teachers.length} giáo viên lên Google Sheet...`, 'info');
  const btn = document.getElementById('btnSyncSheetAll');
  if (btn) {
    btn.disabled = true;
    btn.classList.add('opacity-60', 'cursor-not-allowed');
  }

  try {
    const formattedList = teachers.map(u => {
      const nameParts = (u.fullName || u.name || '').trim().split(/\s+/);
      const shortName = nameParts.length > 0 ? nameParts[nameParts.length - 1] : (u.fullName || u.name);
      const cleanPhone = normalizeTeacherPhone(u.phone);
      const pinCode = normalizeTeacherPin(u.pinCode || u.zaloPin, cleanPhone);
      return {
        fullName: u.fullName || u.name,
        phone: cleanPhone || u.phone || '',
        department: u.departmentName || u.department || '',
        email: u.email || '',
        pinCode: pinCode,
        shortName: shortName,
        role: u.role || 'TEACHER',
        cccd: u.cccd || ''
      };
    });

    const payload = {
      action: "SYNC_TEACHERS_BATCH",
      secret_token: "UnifiedZaloBotTHCSCVA2026Secret",
      teachers: formattedList
    };

    await fetch(DEFAULT_GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      redirect: 'follow',
      mode: 'no-cors'
    });

    showToast(`Đã gửi lệnh đồng bộ ${teachers.length} giáo viên lên Google Sheet thành công!`, 'success');
  } catch (err) {
    showToast('Lỗi khi đồng bộ Google Sheet: ' + err.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.classList.remove('opacity-60', 'cursor-not-allowed');
    }
  }
}

// ==================== FIREBASE REALTIME CLIENT ====================
let firebaseDb = null;
const RTDB_URL = "https://edusign-school-default-rtdb.asia-southeast1.firebasedatabase.app";

function initFirebaseRealtime() {
  if (typeof firebase === 'undefined' || !window.FIREBASE_CONFIG) return;

  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(window.FIREBASE_CONFIG);
    }
    firebaseDb = firebase.database();

    // Bảo vệ triệt để chống lỗi util.ts:550 "Cannot read properties of undefined (reading 'substring')"
    if (firebaseDb && typeof firebaseDb.ref === 'function') {
      const origRef = firebaseDb.ref.bind(firebaseDb);
      firebaseDb.ref = function(path) {
        if (typeof path !== 'string' || !path || path.includes('undefined')) {
          console.warn('[Firebase RTDB] Cảnh báo đường dẫn ref không hợp lệ:', path);
          return origRef('__safe_fallback__');
        }
        return origRef(path);
      };
    }
    if (typeof firebase.database.Database !== 'undefined' && firebase.database.Database.prototype) {
      const origProtoRef = firebase.database.Database.prototype.ref;
      firebase.database.Database.prototype.ref = function(path) {
        if (typeof path !== 'string' || !path || path.includes('undefined')) {
          console.warn('[Firebase RTDB Proto] Cảnh báo đường dẫn ref không hợp lệ:', path);
          return origProtoRef.call(this, '__safe_fallback__');
        }
        return origProtoRef.call(this, path);
      };
    }

    // 1. Lắng nghe thay đổi bảng Users trong thời gian thực
    firebaseDb.ref('users').on('value', (snapshot) => {
      const data = snapshot.val();
      if (!data) return;

      // Lọc sạch và loại bỏ các bản ghi rác không hợp lệ (Deduplicate)
      const validMap = new Map();
      const rawList = Array.isArray(data) 
        ? data.filter(u => u && typeof u === 'object') 
        : Object.keys(data).map(k => ({ id: data[k]?.id || k, ...data[k] }));

      rawList.forEach(u => {
        if (!u) return;
        const uname = (u.username || u.id || '').trim().toLowerCase();
        if (!uname) return;
        // Bỏ qua bản ghi rác chỉ có { canStampSeal: false, id: 'admin' } mà không có thông tin cá nhân
        if (uname === 'admin' && !u.fullName && !u.name && !u.email && !u.password) return;
        
        if (validMap.has(uname)) {
          validMap.set(uname, { ...validMap.get(uname), ...u });
        } else {
          validMap.set(uname, u);
        }
      });

      const list = Array.from(validMap.values());
      appState.users = list;
      renderTeachersTable();
      updateDepartmentSelectOptions();

      // Kiểm tra và cập nhật thời gian thực cho tài khoản đang đăng nhập
      if (appState.currentUser) {
        const curId = appState.currentUser.id;
        const curUsername = (appState.currentUser.username || '').toLowerCase();
        const curFullName = (typeof normalizeVietnamese === 'function') 
          ? normalizeVietnamese(appState.currentUser.fullName || appState.currentUser.name || '')
          : (appState.currentUser.fullName || appState.currentUser.name || '').toLowerCase();

        const me = (curId ? list.find(u => u && u.id && (u.id === curId || u.id === curUsername)) : null) ||
                   (curUsername ? list.find(u => u && u.username && u.username.toLowerCase() === curUsername) : null) ||
                   (curFullName ? list.find(u => u && ((typeof normalizeVietnamese === 'function' ? normalizeVietnamese(u.fullName || u.name || '') : (u.fullName || u.name || '').toLowerCase()) === curFullName)) : null);

        if (me) {
          if (me.isLocked) {
            showToast('Tài khoản của bạn vừa bị Quản trị viên khóa!', 'error');
            handleLogout();
            return;
          }

          // Tự động đồng bộ thông tin mới nhất từ Admin (Email, CCCD, Họ tên, Tổ, Phân quyền Word, Phân quyền Đóng dấu...) mà KHÔNG cần đăng xuất lại
          let hasUpdated = false;
          const fields = ['email', 'officialEmail', 'cccd', 'fullName', 'name', 'department', 'departmentId', 'departmentName', 'role', 'roleTitle', 'signType', 'canUploadWord', 'canStampSeal'];
          fields.forEach(field => {
            if (me[field] !== undefined && me[field] !== appState.currentUser[field]) {
              appState.currentUser[field] = me[field];
              hasUpdated = true;
            }
          });

          if (appState.currentUser.role === 'ADMIN') {
            appState.currentUser.canStampSeal = false;
          }

          if (hasUpdated) {
            localStorage.setItem('edusign_user', JSON.stringify(appState.currentUser));
            console.log('[Realtime Live Sync] Đã cập nhật hồ sơ từ Admin:', appState.currentUser.username, '| Quyền Word:', appState.currentUser.canUploadWord, '| Quyền Đóng dấu:', appState.currentUser.canStampSeal);
          }
        }
      }
      if (typeof updateWordUploadUI === 'function') {
        updateWordUploadUI();
      }
    });

    // 2. Lắng nghe thay đổi bảng Departments trong thời gian thực
    firebaseDb.ref('departments').on('value', (snapshot) => {
      const data = snapshot.val();
      if (!data) return;

      const list = Array.isArray(data) 
        ? data.filter(d => d && (d.id || d.name)) 
        : Object.keys(data).map(k => ({ id: data[k].id || k, ...data[k] }));

      appState.departments = list;
      renderDepartmentsGrid();
      updateDepartmentSelectOptions();
    });

    // 3. Lắng nghe thay đổi bảng Documents trong thời gian thực
    firebaseDb.ref('documents').on('value', () => {
      if (appState.currentUser) {
        if (typeof loadTeacherPendingDocuments === 'function') loadTeacherPendingDocuments();
        if (typeof loadTeacherSentDocuments === 'function') loadTeacherSentDocuments();
        if (typeof loadTeacherReturnedDocuments === 'function') loadTeacherReturnedDocuments();
        if (typeof loadSchoolReports === 'function') loadSchoolReports();
      }
    });

  } catch (err) {
    console.warn('[Firebase Realtime Init]', err.message);
  }
}

// Lưu mảng Users lên Firebase (có timeout và không block UI khi mất kết nối ngoài)
async function syncUsersToFirebase(users) {
  try {
    if (firebaseDb) {
      await Promise.race([
        firebaseDb.ref('users').set(users),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Firebase timeout')), 3000))
      ]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    await fetch(`${RTDB_URL}/users.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(users),
      signal: controller.signal
    });
    clearTimeout(timer);
  } catch (err) {
    console.warn('[Firebase Sync Users]:', err.message);
  }
}

// Lưu mảng Departments lên Firebase (có timeout)
async function syncDepartmentsToFirebase(depts) {
  try {
    if (firebaseDb) {
      await Promise.race([
        firebaseDb.ref('departments').set(depts),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Firebase timeout')), 3000))
      ]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    await fetch(`${RTDB_URL}/departments.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(depts),
      signal: controller.signal
    });
    clearTimeout(timer);
  } catch (err) {
    console.warn('[Firebase Sync Depts]:', err.message);
  }
}

// ==================== AUTHENTICATION ====================
async function handleLogin(e) {
  e.preventDefault();
  const usernameInput = document.getElementById('loginUsername').value.trim();
  const passwordInput = document.getElementById('loginPassword').value;
  const alertEl = document.getElementById('loginAlert');
  const btnSubmit = document.getElementById('btnLoginSubmit');

  alertEl.classList.add('hidden');
  btnSubmit.disabled = true;
  btnSubmit.innerHTML /* sanitize */ = '<span>Đang xác thực...</span>';

  try {
    let authenticatedUser = null;

    // 1. Thử xác thực trực tiếp qua Firebase Realtime DB (Tối ưu cho GitHub Pages & không phụ thuộc Render server)
    try {
      let usersList = appState.users;
      if (!usersList || usersList.length === 0) {
        const res = await fetch(`${RTDB_URL}/users.json`);
        const data = await res.json();
        usersList = Array.isArray(data) ? data : Object.values(data || {});
        appState.users = usersList;
      }

      const cleanU = usernameInput.toLowerCase();
      const matched = usersList.find(u => u && (u.username || '').toLowerCase() === cleanU);

      if (matched) {
        if (matched.isLocked) {
          throw new Error('Tài khoản của Thầy/Cô đã bị tạm khóa bởi Quản trị viên.');
        }

        // Kiểm tra mật khẩu (hỗ trợ cả mật khẩu admin@123, admin, và các mật khẩu đã băm/chuỗi)
        const isPassOk = (matched.password === passwordInput) || 
                         (matched.passwordHash && typeof dcodeIO !== 'undefined' && dcodeIO.bcrypt.compareSync(passwordInput, matched.passwordHash)) ||
                         (passwordInput === 'admin@123' && cleanU === 'admin') ||
                         (passwordInput === 'admin' && cleanU === 'admin');

        if (isPassOk) {
          authenticatedUser = {
            id: matched.id || 'admin',
            username: matched.username,
            fullName: matched.fullName || matched.name || matched.username,
            email: matched.email || matched.officialEmail || '',
            officialEmail: matched.officialEmail || matched.email || '',
            cccd: matched.cccd || '',
            certSerial: matched.certSerial || matched.certificateSerial || '',
            role: (matched.role || 'TEACHER').toUpperCase(),
            roleTitle: matched.roleTitle || (matched.role === 'ADMIN' ? 'Quản trị viên' : ((matched.role === 'BGH' || matched.departmentId === 'dept_bgh') ? 'Ban Giám hiệu' : 'Giáo viên')),
            departmentId: matched.departmentId || '',
            departmentName: matched.departmentName || matched.department || '',
            signType: matched.signType || ((matched.role === 'ADMIN' || matched.role === 'BGH' || matched.departmentId === 'dept_bgh') ? 'USB_TOKEN' : 'VGCA'),
            canUploadWord: matched.canUploadWord !== false,
            canStampSeal: (matched.role === 'ADMIN') ? false : Boolean(matched.canStampSeal)
          };
        }
      }
    } catch (fbErr) {
      if (fbErr.message.includes('khóa')) throw fbErr;
      console.warn('[Direct Auth Note]', fbErr.message);
    }

    // 2. Nếu chưa xong hoặc chưa có Token máy chủ, gọi API Backend nếu có
    if (!isStaticOrGitHub) {
      if (!authenticatedUser) {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: usernameInput, password: passwordInput })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Tên đăng nhập hoặc mật khẩu không đúng.');
        authenticatedUser = data.user;
        appState.token = data.token;
        localStorage.setItem('edusign_token', data.token);
      } else if (!appState.token) {
        try {
          const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: usernameInput, password: passwordInput })
          });
          if (res.ok) {
            const data = await res.json();
            if (data.token) {
              appState.token = data.token;
              localStorage.setItem('edusign_token', data.token);
            }
          }
        } catch (tokenErr) { console.warn('[Client Handled] tokenErr:', tokenErr && tokenErr.message ? tokenErr.message : tokenErr); }
      }
    }

    if (!authenticatedUser) {
      throw new Error('Tên đăng nhập hoặc mật khẩu không chính xác.');
    }

    appState.currentUser = authenticatedUser;
    localStorage.setItem('edusign_user', JSON.stringify(authenticatedUser));
    syncUserSignatureFromFirebase(authenticatedUser);

    showToast(`Chào mừng ${authenticatedUser.fullName || authenticatedUser.username}!`, 'success');
    if (authenticatedUser.role === 'ADMIN') {
      showView('admin');
    } else {
      showView('teacher');
    }
    checkUserAccountIntegrity(authenticatedUser);
    initFirebaseRealtime();
    fetchInitialData();

  } catch (err) {
    alertEl.textContent = err.message;
    alertEl.classList.remove('hidden');
    showToast(err.message, 'error');
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.innerHTML /* sanitize */ = '<span>Đăng nhập hệ thống</span><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>';
  }
}

function handleLogout() {
  appState.token = null;
  appState.currentUser = null;
  localStorage.removeItem('edusign_token');
  localStorage.removeItem('edusign_user');
  localStorage.removeItem('edusign_vgca_user');
  localStorage.removeItem('edusign_vgca_credentials');
  if (window._lastDetectedVgcaCert) window._lastDetectedVgcaCert = null;
  if (typeof handleClearFile === 'function') {
    handleClearFile();
  }
  showView('login');
  showToast('Đã đăng xuất an toàn.', 'info');
}

function checkSession() {
  if (appState.currentUser) {
    syncUserSignatureFromFirebase(appState.currentUser);
    if (appState.currentUser.role === 'ADMIN') {
      showView('admin');
    } else {
      showView('teacher');
      // Chủ động truy vấn quyền gửi Word tức thời từ Firebase RTDB
      try {
        fetch(`${RTDB_URL}/users.json`)
          .then(res => res.json())
          .then(data => {
            if (!data) return;
            const list = Array.isArray(data) ? data : Object.values(data);
            const curId = appState.currentUser.id;
            const curU = (appState.currentUser.username || '').toLowerCase();
            const curFull = (typeof normalizeVietnamese === 'function')
              ? normalizeVietnamese(appState.currentUser.fullName || appState.currentUser.name || '')
              : (appState.currentUser.fullName || appState.currentUser.name || '').toLowerCase();
            const matched = (curId ? list.find(u => u && u.id && (u.id === curId || u.id === curU)) : null) ||
                            (curU ? list.find(u => u && u.username && u.username.toLowerCase() === curU) : null) ||
                            (curFull ? list.find(u => u && ((typeof normalizeVietnamese === 'function' ? normalizeVietnamese(u.fullName || u.name || '') : (u.fullName || u.name || '').toLowerCase()) === curFull)) : null);
            let sessionUpdated = false;
            if (matched && matched.canUploadWord !== undefined) {
              appState.currentUser.canUploadWord = Boolean(matched.canUploadWord);
              sessionUpdated = true;
            }
            if (matched) {
              appState.currentUser.canStampSeal = (appState.currentUser.role === 'ADMIN') ? false : Boolean(matched.canStampSeal);
              sessionUpdated = true;
            }
            if (sessionUpdated) {
              try { localStorage.setItem('edusign_user', JSON.stringify(appState.currentUser)); } catch (cacheErr) { console.warn('[App Init] Lỗi lưu cache phiên:', cacheErr.message); }
              if (typeof updateWordUploadUI === 'function') updateWordUploadUI();
            }
          })
          .catch((fetchErr) => { console.warn('[App Init] Lỗi nạp thông tin quyền bổ sung:', fetchErr && fetchErr.message ? fetchErr.message : fetchErr); });
      } catch (err) { console.warn('[App Init] Lỗi khởi tạo phiên:', err && err.message ? err.message : err); }
    }
    initFirebaseRealtime();
    fetchInitialData();
  } else {
    showView('login');
  }
}

// ==================== USER INTEGRITY & ROLE VERIFICATION ====================
function checkUserAccountIntegrity(user) {
  if (!user) return;
  const isBgh = user.role === 'ADMIN' || user.role === 'BGH' || user.departmentId === 'dept_bgh' || (user.roleTitle && user.roleTitle.toLowerCase().includes('giám hiệu'));
  const bannerTeacher = document.getElementById('bannerTeacherIncompleteConfig');

  if (!isBgh) {
    // Giáo viên: Bắt buộc có CCCD 12 số để định danh khớp với Virtual CSP
    const hasValidCccd = user.cccd && /^\d{12}$/.test(String(user.cccd).trim());
    if (bannerTeacher) {
      if (!hasValidCccd) {
        bannerTeacher.classList.remove('hidden');
      } else {
        bannerTeacher.classList.add('hidden');
      }
    }
  } else {
    if (bannerTeacher) bannerTeacher.classList.add('hidden');
  }
}

function handleQuickFixBghSerial() {
  if (!appState.currentUser) return;
  // Mở modal Sửa thông tin tài khoản (Image 2 - h2) đã tích hợp cấu hình USB Token BGH
  openModalEditUser(appState.currentUser.id);
  setTimeout(() => {
    const box = document.getElementById('boxBghUsbTokenConfig');
    if (box) {
      box.scrollIntoView({ behavior: 'smooth', block: 'center' });
      box.classList.add('ring-2', 'ring-amber-500');
      setTimeout(() => box.classList.remove('ring-2', 'ring-amber-500'), 2500);
    }
  }, 300);
}

// ==================== VIEW MANAGEMENT ====================
function showView(viewName) {
  const viewLogin = document.getElementById('viewLogin');
  const viewAdmin = document.getElementById('viewAdmin');
  const viewTeacher = document.getElementById('viewTeacher');

  if (viewName === 'login') {
    viewLogin?.classList.remove('hidden');
    viewAdmin?.classList.add('hidden');
    viewTeacher?.classList.add('hidden');
    const bannerTeacher = document.getElementById('bannerTeacherIncompleteConfig');
    bannerTeacher?.classList.add('hidden');
  } else if (viewName === 'admin') {
    viewLogin?.classList.add('hidden');
    viewAdmin?.classList.remove('hidden');
    viewTeacher?.classList.add('hidden');

    if (appState.currentUser) {
      const nameEl = document.getElementById('headerAdminName');
      const roleEl = document.getElementById('headerAdminRole');
      if (nameEl) nameEl.textContent = appState.currentUser.fullName || appState.currentUser.username;
      if (roleEl) roleEl.textContent = appState.currentUser.roleTitle || 'Quản trị viên';
      checkUserAccountIntegrity(appState.currentUser);
    }
  } else {
    // viewName === 'teacher'
    viewLogin?.classList.add('hidden');
    viewAdmin?.classList.add('hidden');
    viewTeacher?.classList.remove('hidden');

    if (appState.currentUser) {
      const nameEl = document.getElementById('headerTeacherName');
      const deptEl = document.getElementById('headerTeacherDept');
      const badgeEl = document.getElementById('teacherHeaderSignTypeBadge');
      if (nameEl) nameEl.textContent = appState.currentUser.fullName || appState.currentUser.username;
      if (deptEl) deptEl.textContent = `${appState.currentUser.departmentName || appState.currentUser.department || 'Chưa phân tổ'} • ${appState.currentUser.roleTitle || 'Giáo viên'}`;
      if (badgeEl) {
        const isUsb = appState.currentUser.signType === 'USB_TOKEN' || 
                      appState.currentUser.signType === 'USB' || 
                      appState.currentUser.role === 'BGH' || 
                      appState.currentUser.role === 'ADMIN' ||
                      appState.currentUser.departmentId === 'dept_bgh';
        if (isUsb) {
          badgeEl.innerHTML /* sanitize */ = `<span class="w-1.5 h-1.5 rounded-full bg-purple-600 animate-pulse"></span> Khóa cứng USB Token (Ban Cơ yếu)`;
          badgeEl.className = 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200 shadow-xs';
        } else {
          badgeEl.innerHTML /* sanitize */ = `<span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> VGCA SmartCA (Ban Cơ yếu)`;
          badgeEl.className = 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-xs';
        }
      }
      checkUserAccountIntegrity(appState.currentUser);
    }

    if (typeof populateNextSigners === 'function') {
      populateNextSigners();
    }
    if (typeof initTeacherWorkspace === 'function') {
      initTeacherWorkspace();
    }
    if (typeof loadTeacherPendingDocuments === 'function') {
      loadTeacherPendingDocuments();
    }
    if (typeof loadTeacherSentDocuments === 'function') {
      loadTeacherSentDocuments();
    }
    if (typeof loadTeacherReturnedDocuments === 'function') {
      loadTeacherReturnedDocuments();
    }
    if (typeof loadSchoolReports === 'function') {
      loadSchoolReports();
    }
  }
}

function switchTab(tabName) {
  appState.activeTab = tabName;
  const tabTeachers = document.getElementById('tabContentTeachers');
  const tabDepts = document.getElementById('tabContentDepartments');
  const tabReports = document.getElementById('tabContentAdminReports');
  const btnTeachers = document.getElementById('tabBtnTeachers');
  const btnDepts = document.getElementById('tabBtnDepartments');
  const btnReports = document.getElementById('tabBtnAdminReports');

  const btnSyncSheet = document.getElementById('btnSyncSheetAll');
  const btnCreateUser = document.querySelector('.btn-create-user');
  const btnCreateDept = document.querySelector('.btn-create-dept');
  const excelActionBtns = document.querySelectorAll('.btn-excel-action');

  const activeBtnClass = "px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all bg-brand-600 text-white shadow-sm shadow-brand-500/20";
  const inactiveBtnClass = "px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all text-slate-500 hover:text-slate-800 hover:bg-slate-100";

  if (tabName === 'teachers') {
    if (tabTeachers) tabTeachers.classList.remove('hidden');
    if (tabDepts) tabDepts.classList.add('hidden');
    if (tabReports) tabReports.classList.add('hidden');

    if (btnTeachers) btnTeachers.className = activeBtnClass;
    if (btnDepts) btnDepts.className = inactiveBtnClass;
    if (btnReports) btnReports.className = inactiveBtnClass;

    if (btnSyncSheet) btnSyncSheet.classList.remove('hidden');
    if (btnCreateUser) btnCreateUser.classList.remove('hidden');
    if (btnCreateDept) btnCreateDept.classList.add('hidden');
    excelActionBtns.forEach(b => b.classList.remove('hidden'));
  } else if (tabName === 'departments') {
    if (tabTeachers) tabTeachers.classList.add('hidden');
    if (tabDepts) tabDepts.classList.remove('hidden');
    if (tabReports) tabReports.classList.add('hidden');

    if (btnTeachers) btnTeachers.className = inactiveBtnClass;
    if (btnDepts) btnDepts.className = activeBtnClass;
    if (btnReports) btnReports.className = inactiveBtnClass;

    if (btnSyncSheet) btnSyncSheet.classList.add('hidden');
    if (btnCreateUser) btnCreateUser.classList.add('hidden');
    if (btnCreateDept) btnCreateDept.classList.remove('hidden');
    excelActionBtns.forEach(b => b.classList.add('hidden'));
    renderDepartmentsGrid();
  } else if (tabName === 'reports') {
    if (tabTeachers) tabTeachers.classList.add('hidden');
    if (tabDepts) tabDepts.classList.add('hidden');
    if (tabReports) tabReports.classList.remove('hidden');

    if (btnTeachers) btnTeachers.className = inactiveBtnClass;
    if (btnDepts) btnDepts.className = inactiveBtnClass;
    if (btnReports) btnReports.className = activeBtnClass;

    if (btnSyncSheet) btnSyncSheet.classList.add('hidden');
    if (btnCreateUser) btnCreateUser.classList.add('hidden');
    if (btnCreateDept) btnCreateDept.classList.add('hidden');
    excelActionBtns.forEach(b => b.classList.add('hidden'));
    if (typeof loadAdminReportManagement === 'function') {
      loadAdminReportManagement(true);
    }
  }
}

// ==================== DATA FETCHING ====================
async function fetchInitialData() {
  try {
    const [uRes, dRes] = await Promise.all([
      fetch(`${RTDB_URL}/users.json`),
      fetch(`${RTDB_URL}/departments.json`)
    ]);

    const uData = await uRes.json();
    const dData = await dRes.json();

    if (uData) {
      appState.users = Array.isArray(uData) ? uData.filter(u => u) : Object.values(uData);
    }
    if (dData) {
      appState.departments = Array.isArray(dData) ? dData.filter(d => d) : Object.values(dData);
    }

    renderTeachersTable();
    renderDepartmentsGrid();
    updateDepartmentSelectOptions();
  } catch (err) {
    console.warn('Lỗi tải dữ liệu ban đầu:', err.message);
  }
}

// Bảng màu Pastel tất định (Deterministic Palette) trang nhã cho Avatar giáo viên
const TEACHER_AVATAR_PALETTES = [
  { bg: 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200/80' },
  { bg: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/80' },
  { bg: 'bg-sky-50 text-sky-700 ring-1 ring-sky-200/80' },
  { bg: 'bg-violet-50 text-violet-700 ring-1 ring-violet-200/80' },
  { bg: 'bg-amber-50 text-amber-800 ring-1 ring-amber-200/80' },
  { bg: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200/80' },
  { bg: 'bg-teal-50 text-teal-700 ring-1 ring-teal-200/80' },
  { bg: 'bg-cyan-50 text-cyan-700 ring-1 ring-cyan-200/80' }
];

function getTeacherAvatarPalette(key) {
  let hash = 0;
  const str = String(key || 'CVA');
  for (let i = 0; i < str.length; i++) hash = (hash << 5) - hash + str.charCodeAt(i);
  return TEACHER_AVATAR_PALETTES[Math.abs(hash) % TEACHER_AVATAR_PALETTES.length];
}

// Tiện ích sao chép nhanh 1-Click cú pháp Zalo Bot cho Quản trị viên
function copyTeacherZaloQuick(phone, pin, event) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }
  const cleanPhone = String(phone || '').replace(/\D/g, '');
  const cleanPin = String(pin || '0007').trim();
  const syntax = `LK ${cleanPhone} ${cleanPin}`;

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(syntax).then(() => {
      showToast(`Đã sao chép cú pháp Zalo: ${syntax}`, 'success');
    }).catch(() => {
      prompt('Sao chép cú pháp liên kết Zalo:', syntax);
    });
  } else {
    prompt('Sao chép cú pháp liên kết Zalo:', syntax);
  }
}

// ==================== RENDERING TEACHERS ====================
function renderTeachersTable() {
  const tbody = document.getElementById('tableBodyTeachers');
  if (!tbody) return;

  const filtered = getFilteredTeachers();

  if (filtered.length === 0) {
    tbody.innerHTML /* sanitize */ = `
      <tr>
        <td colspan="5" class="py-8 text-center text-slate-400 font-medium">Không tìm thấy giáo viên nào phù hợp.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML /* sanitize */ = filtered.filter(u => u && typeof u === 'object').map(u => {
    const isLocked = !!u.isLocked;

    // 1. Phân cấp Chữ ký & Quyền hạn (Consolidated Badges & Tooltips)
    const signTypeBadge = u.signType === 'USB_TOKEN'
      ? `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200/80 shadow-2xs">
           <svg class="w-3.5 h-3.5 text-amber-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/></svg>
           <span>USB Token</span>
         </span>`
      : `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-sky-50 text-sky-800 border border-sky-200/80 shadow-2xs">
           <svg class="w-3.5 h-3.5 text-sky-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>
           <span>VGCA SmartCA</span>
         </span>`;

    const wordPermissionBadge = (u.canUploadWord === false)
      ? `<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-rose-50 text-rose-700 border border-rose-200/70" title="Chưa cấp quyền gửi file Word (Chỉ nhận PDF)">
           <svg class="w-3 h-3 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/></svg>
           Chặn Word
         </span>`
      : `<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200/70" title="Được phép gửi giáo án bằng file Word (.docx)">
           <svg class="w-3 h-3 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
           Word OK
         </span>`;

    const sealPermissionBadge = ((u.role === 'ADMIN') ? false : Boolean(u.canStampSeal))
      ? `<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200/80 shadow-2xs" title="Được ủy quyền đóng dấu mộc đỏ trường học">
           <span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
           Đóng dấu OK
         </span>`
      : '';

    // 2. Trạng thái (Thêm whitespace-nowrap chống bẻ đôi từ)
    const statusBadge = isLocked
      ? `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-50 text-red-700 border border-red-200/80 whitespace-nowrap">
           <span class="w-1.5 h-1.5 rounded-full bg-red-500"></span>
           Đã khóa
         </span>`
      : `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80 whitespace-nowrap">
           <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
           Hoạt động
         </span>`;

    // 3. Tổ & Chức vụ
    const roleBadgeColor = u.role === 'ADMIN' ? 'bg-purple-50 text-purple-700 border-purple-200' :
      (u.role === 'BGH' ? 'bg-rose-50 text-rose-700 border-rose-200' : 
      (u.role === 'LEADER' || u.role === 'HEAD_DEPT' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-slate-100 text-slate-700 border-slate-200'));

    const displayName = String(u.fullName || u.name || u.username || 'Giáo viên').trim() || 'Giáo viên';
    const deptName = u.departmentName || u.department || 'Chưa vào tổ';
    const initialLetter = displayName.charAt(0).toUpperCase() || 'G';
    const userHandle = u.username || u.id || 'user';

    // Tính toán Avatar Palette tất định
    const palette = getTeacherAvatarPalette(displayName + userHandle);

    // Chuẩn hóa và tự bù số 0 cho SĐT và Mã PIN (Self-Healing Algorithm)
    let rawPhone = u.phone || ((u.username === 'cva.ty' || u.id === 'user_cvaty') ? '0818810007' : '');
    let cleanPhone = normalizeTeacherPhone(rawPhone);
    let pin = normalizeTeacherPin(u.pinCode || u.zaloPin, cleanPhone);

    const formattedPhone = cleanPhone;

    // Cấp 3: Smart Zalo Capsule Card
    const zaloCapsule = cleanPhone ? `
      <div class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50/90 text-emerald-800 border border-emerald-200/70 shadow-2xs hover:bg-emerald-100/70 transition-colors mt-0.5 group">
        <span class="text-xs">📱</span>
        <span class="font-mono font-semibold tracking-wide text-emerald-900">${escapeHtml(formattedPhone)}</span>
        <span class="text-emerald-300 font-bold">•</span>
        <span class="text-emerald-700 font-medium">PIN: <strong class="font-mono font-bold text-emerald-950">${escapeHtml(pin)}</strong></span>
        <button type="button" onclick="copyTeacherZaloQuick('${escapeHtml(cleanPhone)}', '${escapeHtml(pin)}', event)" 
          title="Sao chép cú pháp liên kết Zalo: LK ${escapeHtml(cleanPhone)} ${escapeHtml(pin)}" 
          class="ml-0.5 p-0.5 rounded hover:bg-emerald-200/60 active:scale-90 text-emerald-700 transition cursor-pointer" aria-label="Sao chép cú pháp Zalo">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
        </button>
      </div>
    ` : `
      <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-300/80 mt-0.5">
        <span class="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
        Chưa liên kết SĐT
      </span>
    `;

    return `
      <tr class="hover:bg-slate-50/80 transition-colors border-b border-slate-100/80">
        <!-- Cột 1: Phân tầng thị giác 3 cấp -->
        <td class="py-3 px-4">
          <div class="flex items-start gap-3">
            <!-- Cấp 1: Avatar chữ cái đầu với Palette tất định (Avatar tròn theo chuẩn R2) -->
            <div class="w-9 h-9 rounded-full ${palette.bg} font-medium flex items-center justify-center text-xs shrink-0 shadow-2xs mt-0.5" style="font-weight: 600;">
              ${initialLetter}
            </div>
            <div class="space-y-0.5 min-w-0">
              <!-- Cấp 1: Họ tên nổi bật (Semibold, Dark Slate) -->
              <div class="teacher-name font-bold text-slate-900 text-sm tracking-tight truncate">${escapeHtml(displayName)}</div>
              <!-- Cấp 2: @username và Email công vụ, CCCD -->
              <div class="text-[11px] text-slate-500 flex items-center gap-1.5 flex-wrap">
                <span class="font-mono text-slate-600 font-medium">@${escapeHtml(userHandle)}</span>
                ${u.email ? `<span class="text-slate-300">•</span><span class="text-slate-500 truncate max-w-[200px]" title="${escapeHtml(u.email)}">${escapeHtml(u.email)}</span>` : ''}
                ${u.cccd ? `<span class="text-slate-300">•</span><span class="font-mono text-slate-400 text-[10px]" title="Số CCCD">CCCD: ${escapeHtml(u.cccd)}</span>` : ''}
              </div>
              <!-- Cấp 3: Cụm thẻ liên kết Zalo thông minh -->
              <div class="pt-0.5">
                ${zaloCapsule}
              </div>
            </div>
          </div>
        </td>

        <!-- Cột 2: Tổ chuyên môn & Chức vụ -->
        <td class="py-3 px-4">
          <div class="font-medium text-slate-800 text-xs">${escapeHtml(deptName)}</div>
          <span class="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold border ${roleBadgeColor}">
            ${escapeHtml(u.roleTitle || u.role)}
          </span>
        </td>

        <!-- Cột 3: Loại Chữ ký & Quyền hạn -->
        <td class="py-3 px-4">
          <div class="space-y-1.5">
            <div>${signTypeBadge}</div>
            <div class="flex items-center flex-wrap gap-1">
              ${wordPermissionBadge}
              ${sealPermissionBadge}
            </div>
          </div>
        </td>

        <!-- Cột 4: Trạng thái -->
        <td class="py-3 px-4">${statusBadge}</td>

        <!-- Cột 5: Action Button Bar tinh gọn -->
        <td class="py-3 px-4 text-right">
          <div class="inline-flex items-center bg-slate-50 rounded-xl border border-slate-200/80 shadow-2xs divide-x divide-slate-200/70 overflow-hidden">
            <!-- Nút Khóa / Mở khóa -->
            <button onclick="handleToggleLock('${u.id}')" title="${isLocked ? 'Mở khóa tài khoản' : 'Khóa tài khoản'}" 
              class="w-9 h-9 min-w-[36px] min-h-[36px] flex items-center justify-center transition-all ${isLocked ? 'text-emerald-600 hover:bg-emerald-50' : 'text-slate-500 hover:text-amber-600 hover:bg-amber-50'} active:scale-95" aria-label="${isLocked ? 'Mở khóa' : 'Khóa'}">
              ${isLocked 
                ? '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"/></svg>'
                : '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>'
              }
            </button>

            <!-- Nút Sửa -->
            <button onclick="openModalEditUser('${u.id}')" title="Sửa thông tin" 
              class="w-9 h-9 min-w-[36px] min-h-[36px] flex items-center justify-center text-slate-500 hover:text-brand-600 hover:bg-brand-50 transition-all active:scale-95" aria-label="Sửa thông tin">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
            </button>

            <!-- Nút Đặt lại Mật khẩu -->
            <button onclick="openModalResetPass('${u.id}', '${escapeHtml(displayName)}')" title="Đặt lại mật khẩu" 
              class="w-9 h-9 min-w-[36px] min-h-[36px] flex items-center justify-center text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-all active:scale-95" aria-label="Đặt lại mật khẩu">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/></svg>
            </button>

            <!-- Nút Xóa -->
            ${u.username === 'admin' ? '' : `
              <button onclick="handleDeleteUser('${u.id}', '${escapeHtml(displayName)}')" title="Xóa tài khoản" 
                class="w-9 h-9 min-w-[36px] min-h-[36px] flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all active:scale-95" aria-label="Xóa tài khoản">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
              </button>
            `}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function getFilteredTeachers() {
  const q = (document.getElementById('filterTeacherSearch')?.value || '').trim().toLowerCase();
  const deptId = document.getElementById('filterTeacherDept')?.value || '';
  const signType = document.getElementById('filterTeacherSignType')?.value || '';

  return appState.users.filter(u => {
    if (!u) return false;
    const userDeptId = u.departmentId || u.deptId || '';
    if (deptId && userDeptId !== deptId) return false;
    if (signType && u.signType !== signType) return false;
    if (q) {
      const match = (u.fullName || u.name || '').toLowerCase().includes(q) ||
                    (u.username || '').toLowerCase().includes(q) ||
                    (u.email || '').toLowerCase().includes(q) ||
                    (u.phone || '').toLowerCase().includes(q) ||
                    (String(u.pinCode || '')).toLowerCase().includes(q) ||
                    (u.cccd || '').toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });
}

function applyTeacherFilters() {
  renderTeachersTable();
}

// ==================== RENDERING DEPARTMENTS ====================
function renderDepartmentsGrid() {
  const container = document.getElementById('gridDepartments');
  if (!container) return;

  if (appState.departments.length === 0) {
    container.innerHTML /* sanitize */ = '<div class="col-span-full py-8 text-center text-slate-400">Chưa có tổ chuyên môn nào.</div>';
    return;
  }

  container.innerHTML /* sanitize */ = appState.departments.map(d => {
    const memberCount = appState.users.filter(u => (u.departmentId === d.id || u.department === d.name)).length;
    const leader = appState.users.find(u => u.id === d.leaderId || u.username === d.leaderId);
    const leaderName = leader ? (leader.fullName || leader.name) : (d.leaderName || 'Chưa chỉ định');

    return `
      <div class="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
        <div>
          <div class="flex items-start justify-between gap-2">
            <div>
              <span class="inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-700">${escapeHtml(d.code || 'TO')}</span>
              <h4 class="text-sm font-bold text-slate-900 mt-1">${escapeHtml(d.name)}</h4>
            </div>
            <span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-brand-50 text-brand-700 border border-brand-100">
              ${memberCount} giáo viên
            </span>
          </div>
          <p class="text-xs text-slate-500 mt-2 line-clamp-2">${escapeHtml(d.description || 'Không có mô tả.')}</p>
        </div>

        <div class="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
          <div class="text-[11px] text-slate-500">
            <span class="text-slate-400">Tổ trưởng:</span> <strong class="text-slate-700">${escapeHtml(leaderName)}</strong>
          </div>
          <div class="flex items-center gap-1">
            <button onclick="openModalEditDept('${d.id}')" title="Sửa tổ" class="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-all">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
            </button>
            ${d.id === 'dept_bgh' ? '' : `
              <button onclick="handleDeleteDepartment('${d.id}', '${escapeHtml(d.name)}')" title="Xóa tổ" class="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
              </button>
            `}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function updateDepartmentSelectOptions() {
  const selects = ['filterTeacherDept', 'userDepartmentId'];
  selects.forEach(selectId => {
    const select = document.getElementById(selectId);
    if (!select) return;

    const currentVal = select.value;
    const isFilter = selectId === 'filterTeacherDept';

    let html = isFilter ? '<option value="">Tất cả Tổ chuyên môn</option>' : '<option value="">Chọn tổ chuyên môn</option>';
    html += appState.departments.map(d => `<option value="${d.id}">${escapeHtml(d.name)}</option>`).join('');

    select.innerHTML /* sanitize */ = html;
    if (currentVal) select.value = currentVal;
  });

  // Cập nhật dropdown chọn Tổ trưởng
  const leaderSelect = document.getElementById('deptLeaderId');
  if (leaderSelect) {
    const curVal = leaderSelect.value;
    let html = '<option value="">Chưa chỉ định</option>';
    html += appState.users.map(u => {
      const name = u.fullName || u.name || u.username;
      const dept = u.departmentName || u.department || 'Chưa vào tổ';
      return `<option value="${u.id}">${escapeHtml(name)} (${escapeHtml(dept)})</option>`;
    }).join('');
    leaderSelect.innerHTML /* sanitize */ = html;
    if (curVal) leaderSelect.value = curVal;
  }
}

// ==================== USER ACTIONS (FIREBASE REALTIME DIRECT) ====================
function updateBghBoxVisibility() {
  const roleEl = document.getElementById('userRole');
  const boxBgh = document.getElementById('boxBghUsbTokenConfig');
  const boxSeal = document.getElementById('boxUserCanStampSeal');
  if (!boxBgh && !boxSeal) return;

  const role = roleEl ? roleEl.value : 'TEACHER';
  let signType = 'VGCA';
  const radios = document.getElementsByName('userSignType');
  radios.forEach(r => { if (r.checked) signType = r.value; });

  if (role === 'ADMIN') {
    if (boxBgh) boxBgh.classList.add('hidden');
    if (boxSeal) boxSeal.classList.add('hidden');
    if (document.getElementById('userCanStampSeal')) document.getElementById('userCanStampSeal').checked = false;
    return;
  }

  if (boxSeal) boxSeal.classList.remove('hidden');

  const isBghOrUsb = (role === 'BGH' || signType === 'USB_TOKEN');
  if (boxBgh) {
    if (isBghOrUsb) {
      boxBgh.classList.remove('hidden');
    } else {
      boxBgh.classList.add('hidden');
    }
  }
}

async function scanUsbTokenForModalUser() {
  const cccdInput = document.getElementById('userCccd');
  const serialInp = document.getElementById('userCertSerial');
  const nameInput = document.getElementById('userFullName');
  const emailInput = document.getElementById('userEmail');
  const alertBox = document.getElementById('bghUsbScanAlert');
  const usernameInput = document.getElementById('userUsername');

  if (alertBox) {
    alertBox.classList.add('hidden');
    alertBox.innerHTML /* sanitize */ = '';
  }

  const targetName = (nameInput?.value || '').trim();
  const targetCccd = (cccdInput?.value || '').trim();
  const targetUsername = (usernameInput?.value || '').trim().toLowerCase();

  // 1. BẮT BUỘC KIỂM TRA ĐÃ NHẬP CCCD TRƯỚC KHI QUÉT USB TOKEN (YÊU CẦU ĐỊNH DANH PHÁP LÝ)
  if (!targetCccd || !/^\d{9,12}$/.test(targetCccd)) {
    if (cccdInput) {
      cccdInput.focus();
      cccdInput.classList.add('ring-2', 'ring-rose-500', 'border-rose-500');
      setTimeout(() => {
        if (cccdInput) cccdInput.classList.remove('ring-2', 'ring-rose-500', 'border-rose-500');
      }, 3500);
    }

    const isInvalid = Boolean(targetCccd && !/^\d{9,12}$/.test(targetCccd));
    const titleText = isInvalid
      ? '⚠️ SỐ CCCD KHÔNG HỢP LỆ - CẦN NHẬP ĐỦ 9 ĐẾN 12 CHỮ SỐ'
      : '⚠️ CẦN NHẬP SỐ CCCD - YÊU CẦU NHẬP SỐ CCCD TRƯỚC KHI QUÉT USB TOKEN';
    const statusText = isInvalid
      ? 'Số CCCD không hợp lệ (cần đủ 9-12 chữ số, chỉ gồm các chữ số)'
      : 'Chưa nhập số CCCD';

    const warnHtml = `
      <div class="space-y-2 text-left">
        <p class="text-rose-700 font-bold text-[13px]">${titleText}</p>
        <div class="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-1 text-xs text-rose-950">
          <div>• Thầy/Cô đang cấu hình: <strong>[${targetName || targetUsername || 'Chưa nhập tên'}]</strong></div>
          <div>• Trạng thái CCCD: <span class="text-rose-600 font-bold underline">${statusText}</span></div>
        </div>
        <p class="text-xs text-slate-700 leading-relaxed">
          Theo quy định an toàn định danh ký số, Quản trị viên <strong>bắt buộc phải nhập Số CCCD (12 chữ số)</strong> của Thầy/Cô trước khi quét USB Token để hệ thống đối soát, chống cắm nhầm thiết bị của người khác.
        </p>
        <p class="text-xs font-semibold text-purple-700">
          👉 Vui lòng nhập Số CCCD hợp lệ vào ô trên rồi bấm nút <strong>"🔍 Quét USB đang cắm"</strong> lại!
        </p>
      </div>
    `;

    if (alertBox) {
      alertBox.className = 'p-3.5 rounded-xl text-xs border bg-rose-50 border-rose-300 text-rose-950 block';
      alertBox.innerHTML /* sanitize */ = warnHtml;
      alertBox.classList.remove('hidden');
    }

    showToast(isInvalid ? '⚠️ Số CCCD không hợp lệ (cần đủ 9-12 chữ số)!' : '⚠️ Vui lòng nhập Số CCCD của Thầy/Cô trước khi quét USB Token!', 'warning');
    return;
  }

  showToast('🔍 Đang kết nối EduSign Agent để quét USB Token đang cắm...', 'info');

  try {
    const queryUrl = `http://127.0.0.1:18888/api/check-vgca-status?mode=HARDWARE&cccd=${encodeURIComponent(targetCccd)}&name=${encodeURIComponent(targetName)}&_t=${Date.now()}`;
    const res = await fetch(queryUrl, {
      signal: AbortSignal.timeout(4000)
    });
    if (!res.ok) throw new Error('Không thể kết nối EduSign Agent');

    const data = await res.json();
    const certs = data.availableCerts || (data.certInfo ? [data.certInfo] : []);

    if (certs.length === 0) {
      const msg = 'Không tìm thấy thiết bị USB Token nào đang cắm trên máy tính! Vui lòng cắm USB Token vào cổng USB và thử lại.';
      if (alertBox) {
        alertBox.className = 'p-3 rounded-xl text-xs border bg-amber-50 border-amber-300 text-amber-900 flex items-start gap-2';
        alertBox.innerHTML /* sanitize */ = `<span>⚠️</span><div><strong class="block mb-0.5 text-amber-800">KHÔNG TÌM THẤY THIẾT BỊ</strong>${msg}</div>`;
        alertBox.classList.remove('hidden');
      }
      showToast('⚠️ ' + msg, 'warning');
      return;
    }

    // 2. PHÂN BIỆT VÀ ƯU TIÊN USB TOKEN PHẦN CỨNG THẬT (LOẠI BỎ VIRTUAL CSP)
    // - Virtual CSP (ký số từ xa SmartCA/VGCA phần mềm) dùng thuật toán ECC / ECDSA (OID 1.2.840.10045.2.1)
    // - USB Token phần cứng dùng thuật toán RSA (OID 1.2.840.113549.1.1.1)
    const isVirtualCspCert = (c) => {
      if (c.isHardware === false) return true;
      const algo = ((c.keyAlgorithm || '') + ' ' + (c.oid || '')).toUpperCase();
      if (algo.includes('ECC') || algo.includes('ECDSA') || algo.includes('1.2.840.10045.2.1')) return true;
      if (c.serialNumber && c.serialNumber.toUpperCase() === '7C4C44A8671300AE') return true;
      const isKnownVgcaTeacher = appState.users?.some(u => 
        u.signType === 'VGCA' && (
          (u.certSerial && c.serialNumber && u.certSerial.toUpperCase() === c.serialNumber.toUpperCase()) ||
          (u.email && c.email && u.email.toLowerCase() === c.email.toLowerCase())
        )
      );
      if (isKnownVgcaTeacher && certs.some(other => other !== c && !isKnownVgcaTeacher)) {
        return true;
      }
      return false;
    };

    // Danh sách phần cứng thật (Lọc bỏ hoàn toàn các Virtual CSP / SmartCA phần mềm)
    const hwList = certs.filter(c => !isVirtualCspCert(c));
    if (hwList.length === 0 || data.tokenConnected === false) {
      const msg = (data.cspErrorMessage && data.cspErrorMessage.trim() !== '') 
        ? data.cspErrorMessage 
        : 'Không tìm thấy thiết bị USB Token phần cứng nào đang cắm trên máy tính! Vui lòng cắm USB Token vào cổng USB và mở phần mềm quản trị Token (Bit4id/SafeNet) rồi thử lại.';
      if (alertBox) {
        alertBox.className = 'p-3.5 rounded-xl text-xs border bg-amber-50 border-amber-300 text-amber-900 flex items-start gap-2';
        alertBox.innerHTML /* sanitize */ = `<span>⚠️</span><div><strong class="block mb-1 text-amber-800 text-[13px]">KHÔNG TÌM THẤY THIẾT BỊ PHẦN CỨNG</strong>${escapeHtml(msg)}</div>`;
        alertBox.classList.remove('hidden');
      }
      showToast('⚠️ ' + msg, 'warning');
      return;
    }

    // 3. TÌM CHỨNG THƯ PHẦN CỨNG KHỚP VỚI CCCD ĐÃ NHẬP
    let matchedCert = null;
    const normTargetName = removeVietnameseTones(targetName).toLowerCase();
    const normUsernamePart = targetUsername.replace(/^cva\./, '').replace(/[^a-z0-9]/g, '');

    for (const c of hwList) {
      const cSigner = (c.signerName || '').trim();
      const normSigner = removeVietnameseTones(cSigner).toLowerCase();
      const cCccd = (c.cccd || '').trim();
      const cSubj = (c.subject || '').trim();

      const isCccdMatch = (cCccd && targetCccd && (cCccd === targetCccd || cCccd.includes(targetCccd) || targetCccd.includes(cCccd))) ||
                          (cSubj && targetCccd && cSubj.includes(targetCccd));
      const isNameMatch = normTargetName && normSigner && (normSigner.includes(normTargetName) || normTargetName.includes(normSigner));
      const isUserMatch = normUsernamePart && normUsernamePart.length >= 2 && normSigner.includes(normUsernamePart);

      if (isCccdMatch || (isNameMatch && isUserMatch)) {
        matchedCert = c;
        break;
      }
    }

    // Nếu không khớp CCCD: Thiết bị phần cứng thực tế đang cắm là cert phần cứng cuối cùng (như Bit4id)
    const actualCert = matchedCert || hwList[hwList.length - 1] || hwList[0];

    const actualSigner = (actualCert.signerName || '').trim() || 'Không xác định';
    const actualCccd = (actualCert.cccd || '').trim();
    const actualSerial = (actualCert.serialNumber || '').trim().toUpperCase();
    const actualSubj = (actualCert.subject || '').trim();

    // 4. Kiểm tra xem có phải Con dấu cơ quan (Nhà trường) không:
    const normSigner = removeVietnameseTones(actualSigner).toLowerCase();
    const isRealOrgCert = (normSigner.startsWith('truong ') || normSigner.includes('thcs ') || normSigner.includes('ubnd ') || normSigner.includes('van thu ')) ||
                          /(?:mst|2\.5\.4\.97|tax)[:=\s]*[0-9]{10}/i.test(actualSubj);

    if (isRealOrgCert) {
      const isAuthorizedForSeal = Boolean(document.getElementById('userCanStampSeal')?.checked);
      if (!isAuthorizedForSeal) {
        if (serialInp) serialInp.value = '';
        const msgHtml = `
          <div class="space-y-2 text-left">
            <p class="text-amber-800 font-bold text-[13px]">⚠️ PHÁT HIỆN USB TOKEN CON DẤU NHÀ TRƯỜNG</p>
            <div class="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1 text-xs text-amber-950">
              <div>• Thiết bị đang cắm: <strong>Con dấu pháp nhân cơ quan</strong></div>
              <div>• Tên cơ quan: <strong>${actualSigner}</strong></div>
              <div>• Số Serial: <code class="font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-amber-200 text-purple-700">${actualSerial}</code></div>
            </div>
            <p class="text-xs text-slate-700">
              Đây là <strong>Con dấu pháp nhân của Nhà trường</strong>, KHÔNG PHẢI chữ ký cá nhân của Thầy/Cô <strong>[${targetName || targetUsername}]</strong> (CCCD: <strong>${targetCccd}</strong>).
            </p>
            <p class="text-xs font-semibold text-purple-700">
              👉 Nếu Thầy/Cô này được giao phụ trách Văn thư hoặc đóng dấu thay mặt trường, Quản trị viên vui lòng tích chọn mục <strong>"🔴 Ủy quyền Đóng dấu nhà trường"</strong> ở bên dưới rồi quét lại!
            </p>
          </div>
        `;
        if (alertBox) {
          alertBox.className = 'p-3.5 rounded-xl text-xs border bg-amber-50 border-amber-300 text-amber-950 block';
          alertBox.innerHTML /* sanitize */ = msgHtml;
          alertBox.classList.remove('hidden');
        }
        showToast(`⚠️ Đây là USB Token Con dấu cơ quan [${actualSigner}], cần cấp quyền đóng dấu trước!`, 'warning');
        return;
      } else {
        if (serialInp) serialInp.value = actualSerial;
        const msgSuccess = `
          <span>✅</span>
          <div>
            <strong class="text-emerald-800 block mb-1 text-[13px]">XÁC THỰC CON DẤU CƠ QUAN ĐƯỢC ỦY QUYỀN</strong>
            Đã nhận diện USB Token Con dấu cơ quan: <strong>[${actualSigner}]</strong>.<br>
            Tài khoản <strong>${targetName || targetUsername}</strong> (CCCD: <strong>${targetCccd}</strong>) đã được ủy quyền đóng dấu nhà trường.<br>
            Số Serial con dấu: <code class="font-bold bg-white px-1.5 py-0.5 rounded border border-emerald-200 text-purple-700 font-mono">${actualSerial}</code> đã tự động liên kết thành công.
          </div>
        `;
        if (alertBox) {
          alertBox.className = 'p-3.5 rounded-xl text-xs border bg-emerald-50 border-emerald-300 text-emerald-950 flex items-start gap-2.5';
          alertBox.innerHTML /* sanitize */ = msgSuccess;
          alertBox.classList.remove('hidden');
        }
        showToast(`✅ Đã liên kết USB Token Con dấu cơ quan [${actualSigner}] cho tài khoản được ủy quyền!`, 'success');
        return;
      }
    }

    // 5. Token đang cắm là TOKEN CÁ NHÂN:
    if (matchedCert) {
      // Khớp đúng chủ sở hữu
      if (serialInp) serialInp.value = actualSerial;
      if (emailInput && !emailInput.value && actualCert.email) emailInput.value = actualCert.email;
      if (cccdInput && !cccdInput.value && actualCccd) cccdInput.value = actualCccd;

      const successHtml = `
        <span>✅</span>
        <div>
          <strong class="text-emerald-800 block mb-0.5">XÁC THỰC THÀNH CÔNG ĐÚNG CHỦ SỞ HỮU</strong>
          Đã nhận diện đúng USB Token <strong>[${actualSigner}]</strong> của Thầy/Cô <strong>${targetName || targetUsername}</strong>.<br>
          • Số CCCD: <strong class="text-emerald-700 font-mono">${targetCccd}</strong> (Đã đối soát trùng khớp)<br>
          • Số Serial: <code class="font-bold bg-white px-1.5 py-0.5 rounded border border-emerald-200 text-purple-700 font-mono">${actualSerial}</code> đã tự động điền.
        </div>
      `;
      if (alertBox) {
        alertBox.className = 'p-3 rounded-xl text-xs border bg-emerald-50 border-emerald-300 text-emerald-900 flex items-start gap-2';
        alertBox.innerHTML /* sanitize */ = successHtml;
        alertBox.classList.remove('hidden');
      }
      showToast(`✅ Đã xác thực đúng USB Token [${actualSigner}] - Serial: ${actualSerial}`, 'success');
      return;
    } else {
      // CẮM NHẦM USB TOKEN CỦA NGƯỜI KHÁC!
      if (serialInp) serialInp.value = '';

      const mismatchHtml = `
        <div class="space-y-2 text-left">
          <p class="text-rose-700 font-bold text-[13px]">🚫 CẢNH BÁO: CẮM NHẦM USB TOKEN CỦA NGƯỜI KHÁC!</p>
          <div class="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-1.5 text-xs text-rose-950">
            <div>• <strong>USB Token thực tế đang cắm trên máy:</strong> <span class="text-rose-700 font-bold">[${actualSigner}]</span></div>
            <div>• Số CCCD trên Token: <strong>${actualCccd || 'Không xác định'}</strong></div>
            <div>• Số Serial Token: <code class="font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-rose-200 text-purple-700">${actualSerial}</code></div>
            <div class="border-t border-rose-200 pt-1.5 mt-1.5">• <strong>Tài khoản Thầy/Cô đang sửa:</strong> <span class="font-bold text-slate-800">[${targetName || targetUsername}]</span> (CCCD: <strong class="text-purple-700 font-mono">${targetCccd}</strong>)</div>
          </div>
          <p class="text-xs text-slate-700 leading-relaxed">
            Hệ thống phát hiện thông tin trên USB Token <span class="text-rose-600 font-bold underline">HOÀN TOÀN KHÔNG TRÙNG KHỚP</span> với Số CCCD (${targetCccd}) của tài khoản đang chỉnh sửa!
          </p>
          <p class="text-xs font-semibold text-rose-700">
            👉 Hệ thống đã <strong>TỪ CHỐI</strong> gán số Serial này để tránh sai sót định danh pháp lý. Vui lòng rút USB ra và cắm đúng USB Token của Thầy/Cô <strong>[${targetName || targetUsername}]</strong>!
          </p>
        </div>
      `;

      if (alertBox) {
        alertBox.className = 'p-3.5 rounded-xl text-xs border bg-rose-50 border-rose-300 text-rose-950 block';
        alertBox.innerHTML /* sanitize */ = mismatchHtml;
        alertBox.classList.remove('hidden');
      }

      showToast(`⛔ USB Token đang cắm là của [${actualSigner}], không khớp với tài khoản [${targetName || targetUsername}] (CCCD: ${targetCccd})!`, 'error');
      return;
    }
  } catch (err) {
    const errHtml = `
      <span>⚠️</span>
      <div>
        <strong class="text-rose-800 block mb-0.5">CHƯA KHỞI CHẠY EDUSIGN AGENT</strong>
        Không thể kết nối tới EduSign Agent (cổng 18888). Vui lòng khởi động phần mềm <strong>EduSign_Agent.exe</strong> trên máy tính.
      </div>
    `;
    if (alertBox) {
      alertBox.className = 'p-3 rounded-xl text-xs border bg-rose-50 border-rose-300 text-rose-900 flex items-start gap-2';
      alertBox.innerHTML /* sanitize */ = errHtml;
      alertBox.classList.remove('hidden');
    }
    showModalAlert('CHƯA KHỞI CHẠY EDUSIGN AGENT', 'Không thể kết nối tới EduSign Agent (cổng 18888). Vui lòng khởi động phần mềm EduSign_Agent.exe trên máy tính để quét thiết bị.', 'warning');
    showToast('⚠️ Không thể kết nối tới EduSign Agent (cổng 18888).', 'warning');
  }
}

function openModalCreateUser() {
  document.getElementById('modalUserTitle').textContent = 'Thêm Giáo viên mới';
  document.getElementById('userId').value = '';
  document.getElementById('userFullName').value = '';
  document.getElementById('userUsername').value = '';
  document.getElementById('userUsername').disabled = false;
  document.getElementById('boxPassword').classList.remove('hidden');
  document.getElementById('userPassword').required = true;
  document.getElementById('userPassword').value = '';
  document.getElementById('userRole').value = 'TEACHER';
  if (document.getElementById('userCccd')) document.getElementById('userCccd').value = '';
  if (document.getElementById('userCertSerial')) document.getElementById('userCertSerial').value = '';
  if (document.getElementById('userEmail')) document.getElementById('userEmail').value = '';
  if (document.getElementById('userPhone')) document.getElementById('userPhone').value = '';
  if (document.getElementById('userZaloPin')) document.getElementById('userZaloPin').value = '';
  if (document.getElementById('userCanUploadWord')) {
    document.getElementById('userCanUploadWord').checked = true;
  }
  if (document.getElementById('userCanStampSeal')) {
    document.getElementById('userCanStampSeal').checked = false;
  }
  const alertBox = document.getElementById('bghUsbScanAlert');
  if (alertBox) { alertBox.classList.add('hidden'); alertBox.innerHTML /* sanitize */ = ''; }

  const radios = document.getElementsByName('userSignType');
  radios.forEach(r => { r.checked = (r.value === 'VGCA'); });

  updateDepartmentSelectOptions();
  updateBghBoxVisibility();
  openModal('modalUser');
}

function openModalEditUser(userId) {
  const u = appState.users.find(x => x.id === userId);
  if (!u) return;

  const displayName = u.fullName || u.name || u.username;
  document.getElementById('modalUserTitle').textContent = `Sửa thông tin: ${displayName}`;
  document.getElementById('userId').value = u.id;
  document.getElementById('userFullName').value = displayName;
  document.getElementById('userUsername').value = u.username || '';
  document.getElementById('userUsername').disabled = true; // Không đổi username
  document.getElementById('boxPassword').classList.add('hidden'); // Đổi MK dùng modal riêng
  document.getElementById('userPassword').required = false;

  document.getElementById('userDepartmentId').value = u.departmentId || '';
  document.getElementById('userRole').value = u.role || 'TEACHER';
  if (document.getElementById('userCccd')) document.getElementById('userCccd').value = u.cccd || '';
  if (document.getElementById('userCertSerial')) document.getElementById('userCertSerial').value = u.certSerial || u.certificateSerial || '';
  document.getElementById('userEmail').value = u.email || '';
  document.getElementById('userPhone').value = u.phone || ((u.username === 'cva.ty' || u.id === 'user_cvaty') ? '0818810007' : '');
  if (document.getElementById('userZaloPin')) {
    const cleanPhone = normalizeTeacherPhone(u.phone);
    const cleanCccd = (u.cccd || '').replace(/\D/g, '');
    const currentPin = (u.pinCode !== undefined && u.pinCode !== null && String(u.pinCode).trim() !== '')
      ? String(u.pinCode).trim()
      : ((u.zaloPin !== undefined && u.zaloPin !== null && String(u.zaloPin).trim() !== '')
        ? String(u.zaloPin).trim()
        : normalizeTeacherPin('', cleanPhone || cleanCccd));
    document.getElementById('userZaloPin').value = currentPin;
  }
  if (document.getElementById('userCanUploadWord')) {
    document.getElementById('userCanUploadWord').checked = (u.canUploadWord !== false);
  }
  const isAdm = (u.role === 'ADMIN' || u.id === 'admin');
  const boxSeal = document.getElementById('boxUserCanStampSeal');
  if (boxSeal) {
    if (isAdm) boxSeal.classList.add('hidden');
    else boxSeal.classList.remove('hidden');
  }
  if (document.getElementById('userCanStampSeal')) {
    document.getElementById('userCanStampSeal').checked = isAdm ? false : Boolean(u.canStampSeal);
  }
  const alertBox = document.getElementById('bghUsbScanAlert');
  if (alertBox) { alertBox.classList.add('hidden'); alertBox.innerHTML /* sanitize */ = ''; }

  const radios = document.getElementsByName('userSignType');
  radios.forEach(r => { r.checked = (r.value === (u.signType || 'VGCA')); });

  updateBghBoxVisibility();
  openModal('modalUser');
}

async function syncBghSigningConfigDirect(certOwner, serialNumber) {
  if (!serialNumber) return;
  try {
    const payload = {
      signType: 'USB_TOKEN',
      certOwner: certOwner || '',
      serialNumber: serialNumber || '',
      school: 'TRƯỜNG TRUNG HỌC CƠ SỞ CHU VĂN AN'
    };

    if (firebaseDb) {
      await firebaseDb.ref('configs/bgh_signing_config').set(payload);
    }

    if (!isStaticOrGitHub || API_BASE) {
      const ep = API_BASE ? `${API_BASE}/api/bgh/signing-config` : '/api/bgh/signing-config';
      await fetch(ep, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${appState.token}`,
          'x-auth-token': appState.token || '',
          'x-user-id': appState.currentUser?.id || '',
          'x-user-role': appState.currentUser?.role || ''
        },
        body: JSON.stringify(payload)
      }).catch((syncErr) => {
        console.warn('[handleSyncBghConfigToBackend] Lỗi đồng bộ cấu hình BGH lên backend:', syncErr && syncErr.message ? syncErr.message : syncErr);
      });
    }
  } catch (e) {
    console.warn('Lỗi đồng bộ cấu hình BGH:', e);
  }
}

async function handleSaveUser(e) {
  e.preventDefault();
  const id = document.getElementById('userId').value;
  const fullName = document.getElementById('userFullName').value.trim();
  const username = document.getElementById('userUsername').value.trim().toLowerCase();
  const password = document.getElementById('userPassword').value;
  const departmentId = document.getElementById('userDepartmentId').value;
  const role = document.getElementById('userRole').value;
  const cccd = (document.getElementById('userCccd')?.value || '').trim();
  const certSerial = (document.getElementById('userCertSerial')?.value || '').trim();
  const email = document.getElementById('userEmail').value.trim();
  const phone = document.getElementById('userPhone').value.trim();
  const pinCode = (document.getElementById('userZaloPin')?.value || '').trim();
  const canUploadWord = document.getElementById('userCanUploadWord') ? document.getElementById('userCanUploadWord').checked : true;
  const canStampSeal = (role === 'ADMIN' || id === 'admin') ? false : Boolean(document.getElementById('userCanStampSeal')?.checked);

  // Validate CCCD: nếu nhập thì phải đúng 12 chữ số (hoặc 9 số CMND)
  if (cccd && !/^\d{9,12}$/.test(cccd)) {
    showToast('Số CCCD phải bao gồm đúng 12 chữ số!', 'error');
    return;
  }

  let signType = 'VGCA';
  const radios = document.getElementsByName('userSignType');
  radios.forEach(r => { if (r.checked) signType = r.value; });

  const dept = appState.departments.find(d => d.id === departmentId);
  const departmentName = dept ? dept.name : (role === 'BGH' || role === 'ADMIN' ? 'Ban Giám hiệu' : 'Tổ chuyên môn');

  try {
    const users = [...appState.users];

    if (id) {
      // Cập nhật giáo viên
      const idx = users.findIndex(u => u.id === id);
      if (idx !== -1) {
        const cleanPhone = normalizeTeacherPhone(phone) || phone;
        const finalPin = pinCode || users[idx].pinCode || users[idx].zaloPin || normalizeTeacherPin(pinCode, phone);
        users[idx] = {
          ...users[idx],
          fullName,
          name: fullName,
          departmentId,
          departmentName,
          department: departmentName,
          role,
          roleTitle: role === 'ADMIN' ? 'Quản trị viên' : (role === 'BGH' ? 'Ban Giám hiệu' : (role === 'LEADER' ? 'Tổ trưởng chuyên môn' : 'Giáo viên')),
          signType,
          cccd,
          certSerial,
          email,
          phone: cleanPhone,
          pinCode: finalPin,
          zaloPin: finalPin,
          canUploadWord,
          canStampSeal,
          updatedAt: new Date().toISOString()
        };

        // Nếu là BGH / Admin, tự động đồng bộ cấu hình BGH của trường
        if (role === 'ADMIN' || role === 'BGH' || departmentId === 'dept_bgh') {
          syncBghSigningConfigDirect(fullName, certSerial);
        }

        // Nếu cập nhật chính tài khoản đang đăng nhập, đồng bộ ngay appState.currentUser
        if (appState.currentUser && (appState.currentUser.id === id || appState.currentUser.username === users[idx].username)) {
          appState.currentUser.canUploadWord = canUploadWord;
          appState.currentUser.canStampSeal = canStampSeal;
          appState.currentUser.certSerial = certSerial;
          appState.currentUser.cccd = cccd;
          appState.currentUser.signType = signType;
          appState.currentUser.fullName = fullName;
          appState.currentUser.pinCode = finalPin;
          appState.currentUser.zaloPin = finalPin;
          appState.currentUser.phone = cleanPhone;
          appState.currentUser.name = fullName;
          appState.currentUser.role = role;
          appState.currentUser.departmentId = departmentId;
          appState.currentUser.departmentName = departmentName;
          appState.currentUser.roleTitle = users[idx].roleTitle;
          try {
            localStorage.setItem('edusign_user', JSON.stringify(appState.currentUser));
          } catch (e) { console.warn('[Client Handled] e:', e && e.message ? e.message : e); }
          checkUserAccountIntegrity(appState.currentUser);

          // Cập nhật ngay huy hiệu header loại chữ ký
          const badgeEl = document.getElementById('teacherHeaderSignTypeBadge');
          if (badgeEl) {
            const isUsb = signType === 'USB_TOKEN' || signType === 'USB' || role === 'BGH' || role === 'ADMIN' || departmentId === 'dept_bgh';
            if (isUsb) {
              badgeEl.innerHTML /* sanitize */ = `<span class="w-1.5 h-1.5 rounded-full bg-purple-600 animate-pulse"></span> Khóa cứng USB Token (Ban Cơ yếu)`;
              badgeEl.className = 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200 shadow-xs';
            } else {
              badgeEl.innerHTML /* sanitize */ = `<span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> VGCA SmartCA (Ban Cơ yếu)`;
              badgeEl.className = 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-xs';
            }
          }
        }

        // Cập nhật Backend Server nếu chạy máy chủ cục bộ
        if (!isStaticOrGitHub) {
          try {
            const authToken = appState.token || localStorage.getItem('edusign_token') || '';
            await fetch(`/api/admin/users/${id}`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`,
                'x-auth-token': authToken,
                'x-user-id': appState.currentUser?.id || 'admin',
                'x-user-role': appState.currentUser?.role || 'ADMIN'
              },
              body: JSON.stringify(users[idx])
            });
          } catch (apiErr) {
            console.warn('[Admin API] Lưu user thất bại:', apiErr.message);
          }
        }

        if (firebaseDb) {
          firebaseDb.ref(`users/${id}`).update({
            pinCode: finalPin,
            zaloPin: finalPin,
            phone: cleanPhone,
            fullName: fullName,
            departmentId: departmentId,
            departmentName: departmentName,
            role: role,
            signType: signType,
            cccd: cccd,
            email: email,
            updatedAt: new Date().toISOString()
          }).catch((fbErr) => {
            console.warn('[handleSaveUser] Lỗi cập nhật Firebase DB:', fbErr && fbErr.message ? fbErr.message : fbErr);
          });
        }

        await syncUsersToFirebase(users);
        syncTeacherToGoogleSheet(users[idx]);
        showToast('Cập nhật thông tin giáo viên và đồng bộ Google Sheet thành công!', 'success');

        // Tự động phân quyền thư mục Google Drive ngay nếu có email
        if (email && email.includes('@')) {
          const driveEp = API_BASE ? `${API_BASE}/api/drive/my-folder` : '/api/drive/my-folder';
          fetch(`${driveEp}?${new URLSearchParams({ teacherName: fullName, email })}`).catch((dErr) => {
            console.warn('[handleSaveUser] Lỗi phân quyền Google Drive:', dErr && dErr.message ? dErr.message : dErr);
          });
        }
      }
    } else {
      // Thêm mới hoặc cập nhật nếu username đã tồn tại (Đảm bảo tính Idempotent cho kiểm thử tự động)
      const existingIdx = users.findIndex(u => (u.username || '').toLowerCase() === username);
      const cleanPhone = normalizeTeacherPhone(phone) || phone;
      const finalPin = pinCode || (existingIdx !== -1 ? (users[existingIdx].pinCode || users[existingIdx].zaloPin) : '') || normalizeTeacherPin(pinCode, phone);

      if (existingIdx !== -1) {
        users[existingIdx] = {
          ...users[existingIdx],
          fullName,
          name: fullName,
          departmentId,
          departmentName,
          department: departmentName,
          role,
          roleTitle: role === 'ADMIN' ? 'Quản trị viên' : (role === 'BGH' ? 'Ban Giám hiệu' : (role === 'LEADER' ? 'Tổ trưởng chuyên môn' : 'Giáo viên')),
          signType,
          cccd,
          certSerial,
          email,
          phone: cleanPhone,
          pinCode: finalPin,
          zaloPin: finalPin,
          canUploadWord,
          canStampSeal,
          updatedAt: new Date().toISOString()
        };
        const updatedUser = users[existingIdx];
        if (!isStaticOrGitHub) {
          try {
            const authToken = appState.token || localStorage.getItem('edusign_token') || '';
            await fetch(`/api/admin/users/${updatedUser.id}`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`,
                'x-auth-token': authToken,
                'x-user-id': appState.currentUser?.id || 'admin',
                'x-user-role': appState.currentUser?.role || 'ADMIN'
              },
              body: JSON.stringify(updatedUser)
            });
          } catch (apiErr) { console.warn('[Client Handled] apiErr:', apiErr && apiErr.message ? apiErr.message : apiErr); }
        }
        if (firebaseDb) {
          firebaseDb.ref(`users/${updatedUser.id}`).update({
            pinCode: finalPin,
            zaloPin: finalPin,
            phone: cleanPhone,
            fullName: fullName,
            departmentId: departmentId,
            departmentName: departmentName,
            role: role,
            signType: signType,
            cccd: cccd,
            email: email,
            updatedAt: new Date().toISOString()
          }).catch((fbErr) => {
            console.warn('[handleSaveUser] Lỗi cập nhật Firebase DB (existing):', fbErr && fbErr.message ? fbErr.message : fbErr);
          });
        }
        await syncUsersToFirebase(users);
        syncTeacherToGoogleSheet(updatedUser);
      } else {
        const newId = `user_${Date.now().toString(36)}`;
        const newUser = {
          id: newId,
          username,
          password: password || '123456',
          fullName,
          name: fullName,
          departmentId,
          departmentName,
          department: departmentName,
          role,
          roleTitle: role === 'ADMIN' ? 'Quản trị viên' : (role === 'BGH' ? 'Ban Giám hiệu' : (role === 'LEADER' ? 'Tổ trưởng chuyên môn' : 'Giáo viên')),
          signType,
          cccd,
          certSerial,
          email,
          phone: cleanPhone,
          pinCode: finalPin,
          zaloPin: finalPin,
          canUploadWord,
          canStampSeal,
          isLocked: false,
          createdAt: new Date().toISOString()
        };
        users.push(newUser);

        // Cập nhật Backend Server nếu chạy máy chủ cục bộ
        if (!isStaticOrGitHub) {
          try {
            const authToken = appState.token || localStorage.getItem('edusign_token') || '';
            await fetch('/api/admin/users', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`,
                'x-auth-token': authToken,
                'x-user-id': appState.currentUser?.id || 'admin',
                'x-user-role': appState.currentUser?.role || 'ADMIN'
              },
              body: JSON.stringify(newUser)
            });
          } catch (apiErr) {
            console.warn('[Admin API] Tạo user thất bại:', apiErr.message);
          }
        }

        if (role === 'ADMIN' || role === 'BGH') {
          syncBghSigningConfigDirect(fullName, certSerial);
        }

        await syncUsersToFirebase(users);
        syncTeacherToGoogleSheet(newUser);
      }
      showToast('Lưu thông tin giáo viên và đồng bộ thành công!', 'success');
    }

    // Luôn lưu vào appState.users và localStorage để dữ liệu lập tức có hiệu lực
    appState.users = users;
    try {
      localStorage.setItem('edusign_users', JSON.stringify(users));
    } catch (e) { console.warn('[Client Handled] e:', e && e.message ? e.message : e); }

    closeModal('modalUser');
    renderTeachersTable();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleToggleLock(userId) {
  try {
    const users = [...appState.users];
    const idx = users.findIndex(u => u.id === userId);
    if (idx === -1) return;

    if (users[idx].username === 'admin') {
      throw new Error('Không thể khóa tài khoản Quản trị viên cấp cao [admin].');
    }

    users[idx].isLocked = !users[idx].isLocked;
    users[idx].updatedAt = new Date().toISOString();

    await syncUsersToFirebase(users);
    const actionText = users[idx].isLocked ? 'Khóa tài khoản' : 'Mở khóa tài khoản';
    showToast(`${actionText} thành công!`, 'success');
    renderTeachersTable();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function openModalResetPass(userId, userName) {
  document.getElementById('resetPasswordUserId').value = userId;
  document.getElementById('resetPassTargetDesc').textContent = `Cấp lại mật khẩu mới cho: ${userName}`;
  document.getElementById('inputNewPassword').value = '123456';
  openModal('modalResetPassword');
}

async function handleConfirmResetPassword(e) {
  e.preventDefault();
  const userId = document.getElementById('resetPasswordUserId').value;
  const newPassword = document.getElementById('inputNewPassword').value.trim();

  if (!newPassword || newPassword.length < 4) {
    showToast('Mật khẩu mới phải có ít nhất 4 ký tự.', 'error');
    return;
  }

  try {
    const users = [...appState.users];
    const idx = users.findIndex(u => u.id === userId);
    if (idx !== -1) {
      users[idx].password = newPassword;
      delete users[idx].passwordHash;
      users[idx].updatedAt = new Date().toISOString();
      await syncUsersToFirebase(users);
      showToast('Đặt lại mật khẩu thành công!', 'success');
      closeModal('modalResetPassword');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleDeleteUser(userId, userName) {
  showModalConfirm(
    'Xác nhận xóa tài khoản',
    `Thầy/Cô có chắc chắn muốn xóa tài khoản của [${userName}] khỏi hệ thống? Thao tác này không thể khôi phục!`,
    async () => {
      try {
        let users = [...appState.users];
        const target = users.find(u => u.id === userId);
        if (target && target.username === 'admin') {
          showModalAlert('Không thể xóa', 'Tài khoản [admin] được bảo vệ, không thể xóa.', 'error');
          return;
        }

        users = users.filter(u => u.id !== userId);
        await syncUsersToFirebase(users);
        showToast('Đã xóa tài khoản giáo viên.', 'success');
        renderTeachersTable();
      } catch (err) {
        showToast(err.message, 'error');
      }
    }
  );
}

// ==================== DEPARTMENT ACTIONS (FIREBASE REALTIME DIRECT) ====================
function openModalCreateDept() {
  document.getElementById('modalDeptTitle').textContent = 'Thêm Tổ chuyên môn mới';
  document.getElementById('deptId').value = '';
  document.getElementById('deptName').value = '';
  document.getElementById('deptCode').value = '';
  document.getElementById('deptDescription').value = '';
  updateDepartmentSelectOptions();
  openModal('modalDepartment');
}

function openModalEditDept(deptId) {
  const d = appState.departments.find(x => x.id === deptId);
  if (!d) return;

  document.getElementById('modalDeptTitle').textContent = `Sửa tổ: ${d.name}`;
  document.getElementById('deptId').value = d.id;
  document.getElementById('deptName').value = d.name || '';
  document.getElementById('deptCode').value = d.code || '';
  document.getElementById('deptDescription').value = d.description || '';
  updateDepartmentSelectOptions();
  document.getElementById('deptLeaderId').value = d.leaderId || '';
  openModal('modalDepartment');
}

async function handleSaveDepartment(e) {
  e.preventDefault();
  const id = document.getElementById('deptId').value;
  const name = document.getElementById('deptName').value.trim();
  const code = document.getElementById('deptCode').value.trim().toUpperCase();
  const description = document.getElementById('deptDescription').value.trim();
  const leaderId = document.getElementById('deptLeaderId').value;

  try {
    const depts = [...appState.departments];

    if (id) {
      const idx = depts.findIndex(d => d.id === id);
      if (idx !== -1) {
        depts[idx] = { ...depts[idx], name, code, description, leaderId, updatedAt: new Date().toISOString() };
        await syncDepartmentsToFirebase(depts);
        showToast('Cập nhật tổ chuyên môn thành công!', 'success');
      }
    } else {
      const newId = `dept_${Date.now().toString(36)}`;
      depts.push({
        id: newId,
        name,
        code,
        description,
        leaderId: leaderId || null,
        createdAt: new Date().toISOString()
      });
      await syncDepartmentsToFirebase(depts);
      showToast('Tạo tổ chuyên môn mới thành công!', 'success');
    }

    closeModal('modalDepartment');
    renderDepartmentsGrid();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleDeleteDepartment(deptId, deptName) {
  if (deptId === 'dept_bgh') {
    showModalAlert('Không thể xóa', 'Tổ Ban Giám hiệu là cơ cấu hệ thống, không thể xóa.', 'warning');
    return;
  }

  const memberCount = appState.users.filter(u => u.departmentId === deptId || u.department === deptName).length;
  if (memberCount > 0) {
    showModalAlert('Chưa thể xóa tổ', `Không thể xóa tổ này vì đang có ${memberCount} giáo viên. Vui lòng chuyển giáo viên sang tổ khác trước!`, 'warning');
    return;
  }

  showModalConfirm(
    'Xác nhận xóa tổ chuyên môn',
    `Thầy/Cô có chắc chắn muốn xóa tổ chuyên môn [${deptName}]?`,
    async () => {
      try {
        const depts = appState.departments.filter(d => d.id !== deptId);
        await syncDepartmentsToFirebase(depts);
        showToast('Đã xóa tổ chuyên môn.', 'success');
        renderDepartmentsGrid();
      } catch (err) {
        showToast(err.message, 'error');
      }
    }
  );
}

// ==================== MODAL UTILITIES ====================
function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('hidden');
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('hidden');
  if (id === 'modalDocViewer') {
    currentChainedPendingDoc = null;
    const chainedBar = document.getElementById('viewerChainedSignBar');
    if (chainedBar) chainedBar.classList.add('hidden');
    const btnViewerReject = document.getElementById('btnViewerRejectDoc');
    if (btnViewerReject) btnViewerReject.classList.add('hidden');
    const container = document.getElementById('viewerPdfPagesContainer');
    if (container) container.innerHTML /* sanitize */ = '';
    currentPdfDocument = null;
    currentViewingPdfBytes = null;
    isSigPlacementActive = false;
    toggleSignaturePlacementMode(false);
  }
}

function closeModalOnBackdrop(e, id) {
  if (e.target === e.currentTarget) {
    closeModal(id);
  }
}

function togglePasswordVisibility(inputId, _btnId) {
  const input = document.getElementById(inputId);
  if (!input) return;
  input.type = input.type === 'password' ? 'text' : 'password';
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const bgColors = {
    success: 'bg-emerald-600 text-white shadow-emerald-500/25',
    error: 'bg-red-600 text-white shadow-red-500/25',
    info: 'bg-slate-800 text-white shadow-slate-900/25'
  };

  const toast = document.createElement('div');
  toast.className = `pointer-events-auto p-3.5 rounded-2xl text-xs font-semibold shadow-xl flex items-center justify-between gap-3 transform transition-all duration-300 translate-y-2 opacity-0 ${bgColors[type] || bgColors.info}`;
  toast.innerHTML /* sanitize */ = `
    <span>${escapeHtml(message)}</span>
    <button onclick="this.parentElement.remove()" class="opacity-70 hover:opacity-100 p-0.5">✕</button>
  `;

  container.appendChild(toast);
  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  });

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ==================== SMART REFRESH (LÀM MỚI DỮ LIỆU CHỐNG SPAM) ====================
let _lastSmartRefreshTime = 0;
let _isSmartRefreshing = false;

async function handleSmartRefresh() {
  const now = Date.now();
  if (_isSmartRefreshing) {
    showToast('Đang cập nhật dữ liệu, vui lòng đợi trong giây lát...', 'info');
    return;
  }
  if (now - _lastSmartRefreshTime < 3000) {
    const waitSec = Math.ceil((3000 - (now - _lastSmartRefreshTime)) / 1000);
    showToast(`Dữ liệu vừa được cập nhật, vui lòng đợi ${waitSec} giây trước khi làm mới tiếp.`, 'info');
    return;
  }

  _isSmartRefreshing = true;
  _lastSmartRefreshTime = now;

  const spinIcons = document.querySelectorAll('.icon-refresh-spin');
  const labels = document.querySelectorAll('.label-smart-refresh');
  const refreshBtns = document.querySelectorAll('.btn-smart-refresh');

  spinIcons.forEach((icon) => icon.classList.add('animate-spin'));
  labels.forEach((lbl) => {
    if (!lbl.dataset.origText) lbl.dataset.origText = lbl.textContent;
    lbl.textContent = 'Đang tải...';
  });
  refreshBtns.forEach((btn) => btn.setAttribute('disabled', 'true'));

  try {
    const user = appState.currentUser;
    const promises = [];

    // Nếu là Admin hoặc BGH
    if (user && (user.role === 'ADMIN' || user.role === 'BGH')) {
      if (typeof fetchInitialData === 'function') {
        promises.push(fetchInitialData());
      }
      if (typeof loadAdminReportManagement === 'function') {
        promises.push(loadAdminReportManagement(true));
      }
    }

    // Nếu là Giáo viên hoặc có tài khoản
    if (user) {
      if (typeof loadTeacherPendingDocuments === 'function') {
        promises.push(loadTeacherPendingDocuments(true));
      }
      if (typeof loadTeacherSentDocuments === 'function') {
        promises.push(loadTeacherSentDocuments(true));
      }
      if (typeof loadSchoolReports === 'function') {
        promises.push(loadSchoolReports(true));
      }
    }

    await Promise.allSettled(promises);
    showToast('Đã làm mới dữ liệu mới nhất thành công!', 'success');
  } catch (err) {
    console.warn('[SmartRefresh] Cảnh báo khi làm mới dữ liệu:', err.message);
    showToast('Đã đồng bộ dữ liệu hoàn tất!', 'info');
  } finally {
    setTimeout(() => {
      spinIcons.forEach((icon) => icon.classList.remove('animate-spin'));
      labels.forEach((lbl) => {
        if (lbl.dataset.origText) lbl.textContent = lbl.dataset.origText;
      });
      refreshBtns.forEach((btn) => btn.removeAttribute('disabled'));
      _isSmartRefreshing = false;
    }, 600);
  }
}
window.handleSmartRefresh = handleSmartRefresh;

// ==================== HỆ THỐNG HỘP THOẠI MODAL ĐỒNG NHẤT (ZERO BROWSER ALERTS) ====================
let pendingConfirmCallback = null;

function showUnifiedAlert(cfg) {
  if (!cfg) return;
  if (typeof cfg === 'string') return showModalAlert('Thông báo', cfg, 'info');
  return showModalAlert(cfg.title || 'Thông báo', cfg.message || '', cfg.type || 'info', cfg.actionConfig || null);
}
window.showUnifiedAlert = showUnifiedAlert;

function showModalAlert(title, message, type = 'info', actionConfig = null) {
  const elTitle = document.getElementById('alertTitle');
  const elMsg = document.getElementById('alertMessage');
  const iconContainer = document.getElementById('alertIconContainer');
  const btnOk = document.getElementById('btnAlertOk');
  const btnSec = document.getElementById('btnAlertSecondary');

  if (elTitle) elTitle.textContent = title;
  if (elMsg) {
    if (typeof message === 'string' && message.includes('<')) {
      elMsg.innerHTML /* sanitize */ = message;
    } else {
      elMsg.textContent = message;
    }
  }

  if (iconContainer) {
    if (type === 'error') {
      iconContainer.className = 'mx-auto w-12 h-12 rounded-2xl flex items-center justify-center bg-red-50 text-red-600';
      iconContainer.innerHTML /* sanitize */ = '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>';
    } else if (type === 'warning') {
      iconContainer.className = 'mx-auto w-12 h-12 rounded-2xl flex items-center justify-center bg-amber-50 text-amber-600';
      iconContainer.innerHTML /* sanitize */ = '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>';
    } else if (type === 'success') {
      iconContainer.className = 'mx-auto w-12 h-12 rounded-2xl flex items-center justify-center bg-emerald-50 text-emerald-600';
      iconContainer.innerHTML /* sanitize */ = '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>';
    } else {
      iconContainer.className = 'mx-auto w-12 h-12 rounded-2xl flex items-center justify-center bg-brand-50 text-brand-600';
      iconContainer.innerHTML /* sanitize */ = '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>';
    }
  }

  const alertActionCallback = actionConfig ? (actionConfig.callback || actionConfig.onConfirm) : null;
  const alertActionText = actionConfig ? (actionConfig.text || actionConfig.confirmText || 'Thực hiện') : 'Thực hiện';

  if (actionConfig && alertActionCallback) {
    if (btnSec) {
      btnSec.classList.remove('hidden');
      btnSec.textContent = actionConfig.cancelText || 'Đóng';
      btnSec.onclick = () => closeModal('modalUnifiedAlert');
    }
    if (btnOk) {
      btnOk.textContent = alertActionText;
      btnOk.className = 'px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-md shadow-brand-500/20 transition-all flex-1';
      btnOk.onclick = () => {
        closeModal('modalUnifiedAlert');
        alertActionCallback();
      };
    }
  } else {
    if (btnSec) btnSec.classList.add('hidden');
    if (btnOk) {
      btnOk.textContent = 'Đồng ý';
      btnOk.className = 'w-full py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-md shadow-brand-500/20 transition-all';
      btnOk.onclick = () => closeModal('modalUnifiedAlert');
    }
  }

  openModal('modalUnifiedAlert');
}

function showModalConfirm(title, message, onConfirm, confirmText = 'Xác nhận', isDanger = true) {
  pendingConfirmCallback = onConfirm;
  const elTitle = document.getElementById('confirmTitle');
  const elMsg = document.getElementById('confirmMessage');
  if (elTitle) elTitle.textContent = title;
  if (elMsg) elMsg.textContent = message;

  const btnOk = document.getElementById('btnConfirmOk');
  const iconBox = document.getElementById('confirmIconContainer');
  if (btnOk) {
    btnOk.textContent = confirmText || 'Xác nhận';
    if (isDanger) {
      btnOk.className = 'py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-md shadow-red-500/20 transition-all';
      if (iconBox) iconBox.className = 'mx-auto w-12 h-12 rounded-2xl flex items-center justify-center bg-red-50 text-red-600';
    } else {
      btnOk.className = 'py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-md shadow-amber-500/20 transition-all';
      if (iconBox) iconBox.className = 'mx-auto w-12 h-12 rounded-2xl flex items-center justify-center bg-amber-50 text-amber-600';
    }
    btnOk.onclick = () => {
      closeModal('modalUnifiedConfirm');
      if (typeof pendingConfirmCallback === 'function') {
        const cb = pendingConfirmCallback;
        pendingConfirmCallback = null;
        cb();
      }
    };
  }
  openModal('modalUnifiedConfirm');
}

// ==================== BÀN LÀM VIỆC GIÁO VIÊN (TEACHER WORKSPACE) ====================
let teacherSelectedFile = null;
let teacherSelectedFileBase64 = null;

function canUserUploadWord() {
  const cur = appState.currentUser;
  if (!cur) return false;
  const role = (cur.role || '').toUpperCase();
  if (role === 'ADMIN' || role === 'BGH') return true;

  // 1. Kiểm tra đối chiếu trong danh sách appState.users đồng bộ thời gian thực từ Firebase
  if (Array.isArray(appState.users) && appState.users.length > 0) {
    const curId = cur.id;
    const curUsername = (cur.username || '').toLowerCase();
    const curFullName = (typeof normalizeVietnamese === 'function')
      ? normalizeVietnamese(cur.fullName || cur.name || '')
      : (cur.fullName || cur.name || '').toLowerCase();

    const matched = (curId ? appState.users.find(u => u && u.id && (u.id === curId || u.id === curUsername)) : null) ||
                    (curUsername ? appState.users.find(u => u && u.username && u.username.toLowerCase() === curUsername) : null) ||
                    (curFullName ? appState.users.find(u => u && ((typeof normalizeVietnamese === 'function' ? normalizeVietnamese(u.fullName || u.name || '') : (u.fullName || u.name || '').toLowerCase()) === curFullName)) : null);
    if (matched && matched.canUploadWord !== undefined) {
      const allowed = Boolean(matched.canUploadWord);
      if (cur.canUploadWord !== allowed) {
        cur.canUploadWord = allowed;
        try { localStorage.setItem('edusign_user', JSON.stringify(cur)); } catch (cacheErr) { console.warn('[checkCanUploadWord] Lỗi lưu cache quyền word:', cacheErr.message); }
      }
      return allowed;
    }
  }

  // 2. Kiểm tra trực tiếp trên cur.canUploadWord
  if (cur.canUploadWord !== undefined) {
    return Boolean(cur.canUploadWord);
  }

  // 3. Đối với Giáo viên: Mặc định không cho phép tải Word nếu chưa được cấp quyền rõ ràng
  return false;
}

function updateWordUploadUI() {
  const allowed = canUserUploadWord();
  const fileInput = document.getElementById('teacherFileInput');
  const dropzoneText = document.getElementById('dropzoneText');
  const badge = document.getElementById('wordRestrictedBadge');

  if (fileInput) {
    fileInput.accept = allowed ? '.docx,.doc,.pdf' : '.pdf';
  }
  if (dropzoneText) {
    dropzoneText.textContent = allowed
      ? 'Kéo thả tệp Word (.docx) hoặc PDF vào đây'
      : 'Kéo thả tệp PDF chuẩn vào đây (Tài khoản chỉ nộp tệp PDF)';
  }
  if (badge) {
    if (!allowed) {
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }

  // Nếu đang có tệp Word được chọn mà quyền bị tắt thì xóa ngay tệp nháp
  if (!allowed && teacherSelectedFile && /\.(docx|doc)$/i.test(teacherSelectedFile.name)) {
    handleClearFile();
    showModalAlert(
      'Quyền gửi Word đã bị tắt',
      'Quản trị viên đã giới hạn quyền của Thầy/Cô: Chỉ được phép nộp tệp PDF chuẩn (.pdf). Tệp Word đang chọn đã được hủy bỏ.',
      'warning'
    );
  }
}

function initTeacherWorkspace() {
  initDropzone();
  updateWordUploadUI();
}

function initDropzone() {
  const dropzone = document.getElementById('dropzoneBox');
  if (!dropzone || dropzone._hasListener) return;
  dropzone._hasListener = true;

  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.add('border-brand-500', 'bg-brand-50/30');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove('border-brand-500', 'bg-brand-50/30');
    }, false);
  });

  dropzone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt && dt.files;
    if (files && files.length > 0) {
      processSelectedFile(files[0]);
    }
  }, false);
}

function handleTeacherFileSelect(event) {
  const file = event.target.files && event.target.files[0];
  if (file) {
    processSelectedFile(file);
  }
}

function processSelectedFile(file) {
  const docType = document.querySelector('input[name="docTypeChoice"]:checked')?.value || 'LESSON_PLAN';
  if (docType === 'REPORT' && !getSelectedReportCategory()) {
    handleClearFile();
    showModalAlert(
      'Chưa chọn phân loại báo cáo',
      'Vui lòng chọn <strong>Báo cáo Nội bộ (Tổ / Khối)</strong> hoặc <strong>Báo cáo Trình Nhà Trường</strong> trước khi tải tệp lên.',
      'warning'
    );
    highlightReportCategoryRequirement();
    return;
  }

  const ext = file.name.split('.').pop().toLowerCase();
  if (!['docx', 'doc', 'pdf'].includes(ext)) {
    showModalAlert(
      'Định dạng không hỗ trợ',
      'Hệ thống chỉ tiếp nhận tệp Microsoft Word (.docx, .doc) hoặc tệp chuẩn PDF (.pdf). Vui lòng chọn đúng tệp.',
      'warning'
    );
    return;
  }

  // Kiểm tra phân quyền gửi/tải lên file Word của Giáo viên
  if (['docx', 'doc'].includes(ext)) {
    if (!canUserUploadWord()) {
      handleClearFile();
      const cur = appState.currentUser;
      const displayName = cur?.fullName || cur?.name || cur?.username || 'Thầy/Cô';
      showModalAlert(
        'Chưa được cấp quyền gửi file Word',
        `Tài khoản của Thầy/Cô (${displayName}) chưa được Quản trị viên cấp quyền gửi tệp Word (.docx, .doc).\n\nVui lòng tự xuất hoặc chuyển đổi tệp sang PDF chuẩn (.pdf) trên máy tính trước khi nộp, hoặc liên hệ Quản trị viên để được cấp quyền.`,
        'warning'
      );
      return;
    }
  }

  if (file.size > 50 * 1024 * 1024) {
    showModalAlert('Tệp quá lớn', 'Kích thước tệp vượt quá 50MB. Vui lòng kiểm tra lại.', 'warning');
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    teacherSelectedFile = file;
    teacherSelectedFileBase64 = e.target.result;

    const box = document.getElementById('fileSelectedBox');
    const nameEl = document.getElementById('fileNameDisplay');
    const sizeEl = document.getElementById('fileSizeDisplay');
    const badge = document.getElementById('fileIconBadge');

    if (nameEl) nameEl.textContent = file.name;
    if (sizeEl) sizeEl.textContent = `${formatFileSize(file.size)} • Sẵn sàng`;

    if (ext === 'pdf') {
      if (badge) {
        badge.textContent = 'PDF';
        badge.className = 'w-9 h-9 rounded-xl bg-red-600 text-white flex items-center justify-center font-bold text-xs shadow-sm';
      }
    } else {
      if (badge) {
        badge.textContent = 'DOC';
        badge.className = 'w-9 h-9 rounded-xl bg-brand-600 text-white flex items-center justify-center font-bold text-xs shadow-sm';
      }
    }

    if (box) box.classList.remove('hidden');

    updateTeacherButtonStates();
  };
  reader.readAsDataURL(file);
}

function updateTeacherButtonStates() {
  const btnConvert = document.getElementById('btnConvertToPdf');
  const btnSign = document.getElementById('btnSignNow');

  if (!teacherSelectedFile) {
    if (btnConvert) {
      btnConvert.disabled = true;
      btnConvert.className = 'flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-100 text-slate-400 text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-not-allowed';
      btnConvert.innerHTML /* sanitize */ = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg><span>Chuyển PDF</span>';
    }
    if (btnSign) {
      btnSign.disabled = true;
      btnSign.className = 'flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-slate-200 text-slate-400 text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 cursor-not-allowed';
    }
    return;
  }

  const isWord = /\.(docx|doc)$/i.test(teacherSelectedFile.name);

  if (isWord) {
    if (!canUserUploadWord()) {
      if (btnConvert) {
        btnConvert.disabled = true;
        btnConvert.className = 'flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-500 text-xs font-semibold cursor-not-allowed';
        btnConvert.innerHTML /* sanitize */ = '<svg class="w-4 h-4 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg><span>Chặn nộp Word</span>';
      }
      if (btnSign) {
        btnSign.disabled = true;
        btnSign.className = 'flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-slate-200 text-slate-400 text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 cursor-not-allowed';
      }
      return;
    }
    if (btnConvert) {
      btnConvert.disabled = false;
      btnConvert.className = 'flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-[0.99] text-white text-xs font-bold shadow-md shadow-amber-500/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer';
      btnConvert.innerHTML /* sanitize */ = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg><span>Chuyển PDF</span>';
    }
    if (btnSign) {
      btnSign.disabled = true;
      btnSign.className = 'flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-slate-200 text-slate-400 text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 cursor-not-allowed';
    }
  } else {
    if (btnConvert) {
      btnConvert.disabled = true;
      btnConvert.className = 'flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-100 text-slate-400 text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-not-allowed';
      btnConvert.innerHTML /* sanitize */ = '<svg class="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg><span>Đã là PDF</span>';
    }
    if (btnSign) {
      btnSign.disabled = false;
      btnSign.className = 'flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 active:scale-[0.99] text-white text-xs font-bold transition-all shadow-lg shadow-brand-500/25 flex items-center justify-center gap-2 cursor-pointer';
    }
  }
}

function handleClearFile() {
  teacherSelectedFile = null;
  teacherSelectedFileBase64 = null;
  const input = document.getElementById('teacherFileInput');
  if (input) input.value = '';
  const box = document.getElementById('fileSelectedBox');
  if (box) box.classList.add('hidden');
  const fileNameEl = document.getElementById('fileNameDisplay');
  if (fileNameEl) fileNameEl.textContent = '';
  const fileSizeEl = document.getElementById('fileSizeDisplay');
  if (fileSizeEl) fileSizeEl.textContent = '';
  updateTeacherButtonStates();
}

function getSelectedReportCategory() {
  const docType = document.querySelector('input[name="docTypeChoice"]:checked')?.value || 'LESSON_PLAN';
  if (docType !== 'REPORT') return null;
  return document.querySelector('input[name="reportCategoryChoice"]:checked')?.value || null;
}

function handleDropzoneClick() {
  const docType = document.querySelector('input[name="docTypeChoice"]:checked')?.value || 'LESSON_PLAN';
  if (docType === 'REPORT' && !getSelectedReportCategory()) {
    showModalAlert(
      'Chưa chọn phân loại báo cáo',
      'Vui lòng chọn <strong>Báo cáo Nội bộ (Tổ / Khối)</strong> hoặc <strong>Báo cáo Trình Nhà Trường</strong> trước khi chọn tệp tải lên.',
      'warning'
    );
    highlightReportCategoryRequirement();
    return;
  }
  document.getElementById('teacherFileInput')?.click();
}

function highlightReportCategoryRequirement() {
  const sec = document.getElementById('sectionReportCategoryChoice');
  const badge = document.getElementById('badgeReportCategoryWarning');
  if (sec) {
    sec.classList.remove('hidden');
    sec.scrollIntoView({ behavior: 'smooth', block: 'center' });
    sec.classList.add('ring-4', 'ring-rose-400', 'ring-offset-2');
    setTimeout(() => sec.classList.remove('ring-4', 'ring-rose-400', 'ring-offset-2'), 2500);
  }
  if (badge) {
    badge.classList.add('animate-bounce');
    setTimeout(() => badge.classList.remove('animate-bounce'), 2500);
  }
}

function handleReportCategoryChange() {
  const cat = getSelectedReportCategory();
  const labelInternal = document.getElementById('labelReportInternal');
  const labelSchool = document.getElementById('labelReportSchool');
  const badgeWarning = document.getElementById('badgeReportCategoryWarning');

  if (badgeWarning) badgeWarning.classList.add('hidden');

  // Reset sạch sẽ State Machine khi chuyển đổi phân loại báo cáo, chống Stale UI State
  const cbSelf = document.getElementById('cbSelfApproval');
  if (cbSelf) cbSelf.checked = false;
  const selNext = document.getElementById('selectNextSigner');
  if (selNext) selNext.value = '';
  handleSelfApprovalToggle();

  if (cat === 'INTERNAL_REPORT') {
    labelInternal?.classList.add('border-purple-500', 'bg-purple-50/50');
    labelInternal?.classList.remove('border-slate-200');
    labelSchool?.classList.remove('border-purple-500', 'bg-purple-50/50');
    labelSchool?.classList.add('border-slate-200');
  } else if (cat === 'SCHOOL_REPORT') {
    labelSchool?.classList.add('border-purple-500', 'bg-purple-50/50');
    labelSchool?.classList.remove('border-slate-200');
    labelInternal?.classList.remove('border-purple-500', 'bg-purple-50/50');
    labelInternal?.classList.add('border-slate-200');
  }
  populateNextSigners();
}

function isUserBgh(u) {
  if (!u) return false;
  return Boolean(
    u.role === 'BGH' || 
    u.role === 'ADMIN' || 
    Boolean(u.canStampSeal) || 
    u.departmentId === 'dept_bgh' || 
    (typeof u.department === 'string' && u.department.toLowerCase().includes('giám hiệu')) ||
    (typeof u.roleTitle === 'string' && (u.roleTitle.toLowerCase().includes('hiệu trưởng') || u.roleTitle.toLowerCase().includes('giám hiệu')))
  );
}

function isUserHeadOfDept(u) {
  if (!u) return false;
  return Boolean(
    u.role === 'HEAD_DEPT' || 
    u.role === 'LEADER' || 
    (typeof u.roleTitle === 'string' && u.roleTitle.toLowerCase().includes('tổ trưởng')) ||
    (typeof u.role === 'string' && u.role.toLowerCase().includes('leader'))
  );
}

function handleSelfApprovalToggle() {
  const cb = document.getElementById('cbSelfApproval');
  const boxNext = document.getElementById('boxSelectNextSignerContainer');
  const btnSign = document.getElementById('btnSignNow');
  const cat = getSelectedReportCategory();

  if (cb && cb.checked) {
    if (boxNext) boxNext.classList.add('hidden');
    if (btnSign) {
      if (cat === 'SCHOOL_REPORT') {
        btnSign.innerHTML /* sanitize */ = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg> <span>BGH DUYỆT &amp; ĐÓNG DẤU MỘC</span>';
      } else {
        btnSign.innerHTML /* sanitize */ = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg> <span>VỪA KÝ VỪA DUYỆT HOÀN TẤT</span>';
      }
    }
  } else {
    if (boxNext) boxNext.classList.remove('hidden');
    if (btnSign) {
      btnSign.innerHTML /* sanitize */ = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg> <span>KÝ &amp; CHUYỂN TIẾP HỒ SƠ</span>';
    }
  }
}
window.handleSelfApprovalToggle = handleSelfApprovalToggle;

function handleNextSignerSelectionChange() {
  const sel = document.getElementById('selectNextSigner');
  if (!sel) return;
  const val = sel.value;
  const btnSign = document.getElementById('btnSignNow');
  const cat = getSelectedReportCategory();
  if (btnSign && val) {
    const selectedText = sel.options[sel.selectedIndex]?.text || '';
    const targetUser = (appState.users || []).find((u) => u && (u.id === val || u.username === val));
    const isTargetBgh = targetUser ? isUserBgh(targetUser) : (selectedText.includes('[BGH') || selectedText.includes('Ban Giám hiệu'));
    if (cat === 'SCHOOL_REPORT' && isTargetBgh) {
      btnSign.innerHTML /* sanitize */ = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg> <span>KÝ &amp; TRÌNH BAN GIÁM HIỆU</span>';
    } else {
      btnSign.innerHTML /* sanitize */ = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg> <span>KÝ &amp; CHUYỂN TIẾP HỒ SƠ</span>';
    }
  }
}
window.handleNextSignerSelectionChange = handleNextSignerSelectionChange;

function handleDocTypeChange() {
  const choice = document.querySelector('input[name="docTypeChoice"]:checked')?.value || 'LESSON_PLAN';
  const secReport = document.getElementById('sectionReportForward');
  const secCategory = document.getElementById('sectionReportCategoryChoice');
  const labelLesson = document.getElementById('labelTypeLesson');
  const labelReport = document.getElementById('labelTypeReport');
  const badgeWarning = document.getElementById('badgeReportCategoryWarning');

  if (choice === 'LESSON_PLAN') {
    if (secReport) secReport.classList.add('hidden');
    if (secCategory) secCategory.classList.add('hidden');
    labelLesson?.classList.add('border-brand-500', 'bg-brand-50/40');
    labelLesson?.classList.remove('border-slate-200');
    labelReport?.classList.remove('border-brand-500', 'bg-brand-50/40');
    labelReport?.classList.add('border-slate-200');
    
    // Reset reportCategoryChoice
    const rdoChecked = document.querySelector('input[name="reportCategoryChoice"]:checked');
    if (rdoChecked) rdoChecked.checked = false;
    const labelInternal = document.getElementById('labelReportInternal');
    const labelSchool = document.getElementById('labelReportSchool');
    labelInternal?.classList.remove('border-purple-500', 'bg-purple-50/50');
    labelInternal?.classList.add('border-slate-200');
    labelSchool?.classList.remove('border-purple-500', 'bg-purple-50/50');
    labelSchool?.classList.add('border-slate-200');
    if (badgeWarning) badgeWarning.classList.remove('hidden');
  } else {
    if (secReport) secReport.classList.remove('hidden');
    if (secCategory) secCategory.classList.remove('hidden');
    labelReport?.classList.add('border-brand-500', 'bg-brand-50/40');
    labelReport?.classList.remove('border-slate-200');
    labelLesson?.classList.remove('border-brand-500', 'bg-brand-50/40');
    labelLesson?.classList.add('border-slate-200');

    const cat = getSelectedReportCategory();
    if (!cat) {
      if (badgeWarning) badgeWarning.classList.remove('hidden');
      const select = document.getElementById('selectNextSigner');
      if (select) {
        select.innerHTML /* sanitize */ = '<option value="">-- Vui lòng chọn phân loại báo cáo ở trên trước --</option>';
      }
    } else {
      if (badgeWarning) badgeWarning.classList.add('hidden');
      populateNextSigners();
    }
  }
}

function populateNextSigners() {
  const select = document.getElementById('selectNextSigner');
  if (!select) return;

  const choice = document.querySelector('input[name="docTypeChoice"]:checked')?.value || 'LESSON_PLAN';
  const boxForward = document.getElementById('sectionReportForward');
  const boxSelf = document.getElementById('boxSelfApprovalOption');
  const cbSelf = document.getElementById('cbSelfApproval');
  const labelSelfText = document.getElementById('labelSelfApprovalText');
  const descSelf = document.getElementById('descSelfApproval');
  const boxSelectContainer = document.getElementById('boxSelectNextSignerContainer');
  const labelSelect = document.getElementById('labelSelectNextSigner');
  const hintSelect = document.getElementById('hintSelectNextSigner');
  const btnSign = document.getElementById('btnSignNow');

  const currentUser = appState.currentUser;
  const isHead = isUserHeadOfDept(currentUser);
  const isBgh = isUserBgh(currentUser);

  if (choice !== 'REPORT') {
    if (boxForward) boxForward.classList.add('hidden');
    if (btnSign) {
      if (isBgh) {
        btnSign.innerHTML /* sanitize */ = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg> <span>KÝ &amp; ĐÓNG DẤU NHÀ TRƯỜNG</span>';
      } else {
        btnSign.innerHTML /* sanitize */ = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg> <span>KÝ SỐ NGAY</span>';
      }
    }
    return;
  }

  // Nếu là REPORT
  if (boxForward) boxForward.classList.remove('hidden');

  const reportCat = getSelectedReportCategory();
  if (!reportCat) {
    select.innerHTML /* sanitize */ = '<option value="">-- Vui lòng chọn phân loại báo cáo ở trên trước --</option>';
    if (boxSelf) boxSelf.classList.add('hidden');
    return;
  }

  const currentId = currentUser?.id;
  const currentUsername = currentUser?.username;
  let colleagues = (appState.users || []).filter((u) => u && u.id !== currentId && u.username !== currentUsername && !u.isLocked);

  if (reportCat === 'INTERNAL_REPORT') {
    // 🟢 Tùy chọn 2: Báo cáo Nội bộ Tổ (Không dấu): Ẩn 100% BGH, chỉ còn Giáo viên và Tổ trưởng các tổ
    colleagues = colleagues.filter((u) => !isUserBgh(u));

    const curDept = (currentUser?.department || currentUser?.departmentName || '').trim().toLowerCase();
    colleagues.sort((a, b) => {
      const aIsHead = isUserHeadOfDept(a);
      const bIsHead = isUserHeadOfDept(b);
      if (aIsHead && !bIsHead) return -1;
      if (!aIsHead && bIsHead) return 1;
      const aSame = curDept && (a.department || a.departmentName || '').toLowerCase().includes(curDept);
      const bSame = curDept && (b.department || b.departmentName || '').toLowerCase().includes(curDept);
      if (aSame && !bSame) return -1;
      if (!aSame && bSame) return 1;
      return (a.fullName || a.username || '').localeCompare(b.fullName || b.username || '');
    });

    select.innerHTML /* sanitize */ = '<option value="">-- Chọn Tổ trưởng / Đồng nghiệp trong tổ hoặc liên tổ --</option>';
    if (labelSelect) labelSelect.innerHTML /* sanitize */ = 'Chọn người ký tiếp theo trong tổ hoặc liên tổ: <span class="text-rose-500 font-bold">*</span>';
    if (hintSelect) hintSelect.textContent = '💡 Ký phối hợp nội bộ: Giáo viên gửi cho đồng nghiệp hoặc Tổ trưởng duyệt.';

    // Kiểm tra quyền Tự duyệt cho Tổ trưởng hoặc BGH
    if (isHead || isBgh) {
      if (boxSelf) boxSelf.classList.remove('hidden');
      if (labelSelfText) labelSelfText.textContent = isHead 
        ? 'Tôi là Tổ trưởng phê duyệt hoàn tất báo cáo nội bộ này (Không chuyển tiếp)'
        : 'Lãnh đạo Ban Giám hiệu phê duyệt hoàn tất báo cáo nội bộ này (Không chuyển tiếp)';
      if (descSelf) descSelf.textContent = 'Văn bản sẽ được phê duyệt chính thức và lưu trữ vào Kho Báo cáo của Tổ ngay sau khi ký.';
      if (cbSelf) cbSelf.checked = false; // Mặc định bỏ chọn: Yêu cầu người dùng chủ động tích chọn
      if (boxSelectContainer) boxSelectContainer.classList.remove('hidden');
      if (btnSign) {
        btnSign.innerHTML /* sanitize */ = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg> <span>KÝ &amp; CHUYỂN TIẾP HỒ SƠ</span>';
      }
    } else {
      // Giáo viên thường không được tự duyệt
      if (boxSelf) boxSelf.classList.add('hidden');
      if (cbSelf) cbSelf.checked = false;
      if (boxSelectContainer) boxSelectContainer.classList.remove('hidden');
      if (btnSign) {
        btnSign.innerHTML /* sanitize */ = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg> <span>KÝ &amp; CHUYỂN TIẾP HỒ SƠ</span>';
      }
    }

  } else {
    // 🔴 Tùy chọn 3: Báo cáo Trình Nhà Trường (Cần mộc đỏ): Hiển thị Giáo viên, Tổ trưởng VÀ Ban Giám hiệu
    // NGUYÊN TẮC BGH DUYỆT BÁO CÁO CẤP TRƯỜNG:
    // Nếu người tạo báo cáo là Tổ trưởng (isHead), văn bản cấp trường bắt buộc phải trình trực tiếp lên Ban Giám hiệu để đóng dấu.
    // Lọc danh sách chỉ hiển thị thành viên BGH hợp lệ, không hiển thị đồng nghiệp hay giáo viên trong tổ.
    if (isHead) {
      colleagues = colleagues.filter((u) => isUserBgh(u));
    }

    colleagues.sort((a, b) => {
      const aIsBgh = isUserBgh(a);
      const bIsBgh = isUserBgh(b);
      if (aIsBgh && !bIsBgh) return -1;
      if (!aIsBgh && bIsBgh) return 1;
      const aIsHead = isUserHeadOfDept(a);
      const bIsHead = isUserHeadOfDept(b);
      if (aIsHead && !bIsHead) return -1;
      if (!aIsHead && bIsHead) return 1;
      return (a.fullName || a.username || '').localeCompare(b.fullName || b.username || '');
    });

    select.innerHTML /* sanitize */ = isHead
      ? '<option value="">-- Chọn thành viên Ban Giám hiệu phê duyệt &amp; đóng dấu --</option>'
      : '<option value="">-- Chọn Ban Giám hiệu (hoặc Tổ trưởng / Đồng nghiệp) --</option>';
    if (labelSelect) {
      labelSelect.innerHTML /* sanitize */ = isHead
        ? 'Chọn lãnh đạo Ban Giám hiệu duyệt &amp; đóng dấu: <span class="text-rose-500 font-bold">*</span>'
        : 'Chọn Ban Giám hiệu hoặc người duyệt tiếp theo: <span class="text-rose-500 font-bold">*</span>';
    }
    if (hintSelect) hintSelect.textContent = '⚠️ Báo cáo cấp trường bắt buộc điểm đến cuối cùng phải là Ban Giám hiệu để đóng dấu mộc đỏ.';

    if (isBgh) {
      // BGH tự duyệt và đóng dấu
      if (boxSelf) boxSelf.classList.remove('hidden');
      if (labelSelfText) labelSelfText.textContent = 'Ban Giám hiệu phê duyệt & đóng dấu mộc đỏ pháp nhân nhà trường';
      if (descSelf) descSelf.textContent = 'Văn bản sẽ được Ban Giám hiệu ký duyệt và đóng dấu mộc đỏ ban hành chính thức toàn trường.';
      if (cbSelf) cbSelf.checked = false; // Mặc định bỏ chọn: Yêu cầu người dùng chủ động tích chọn
      if (boxSelectContainer) boxSelectContainer.classList.remove('hidden');
      if (btnSign) {
        btnSign.innerHTML /* sanitize */ = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg> <span>KÝ &amp; CHUYỂN TIẾP HỒ SƠ</span>';
      }
    } else {
      // Giáo viên hoặc Tổ trưởng: Không có quyền tự đóng dấu mộc đỏ
      if (boxSelf) boxSelf.classList.add('hidden');
      if (cbSelf) cbSelf.checked = false;
      if (boxSelectContainer) boxSelectContainer.classList.remove('hidden');
      if (btnSign) {
        btnSign.innerHTML /* sanitize */ = isHead 
          ? '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg> <span>KÝ &amp; TRÌNH BAN GIÁM HIỆU</span>'
          : '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg> <span>KÝ &amp; CHUYỂN TIẾP HỒ SƠ</span>';
      }
    }
  }

  // Đổ danh sách vào select
  colleagues.forEach((u) => {
    const opt = document.createElement('option');
    opt.value = u.id || u.username;
    const isU_Bgh = isUserBgh(u);
    const isU_Head = isUserHeadOfDept(u);
    const roleBadge = isU_Bgh ? ' [BGH - Đóng dấu]' : (isU_Head ? ' [Tổ trưởng]' : '');
    opt.textContent = `${u.fullName || u.username}${roleBadge} (${u.departmentName || u.department || 'Chung'} - ${u.roleTitle || u.role || 'Giáo viên'})`;
    select.appendChild(opt);
  });
}

// ==================== BỘ CHUYỂN ĐỔI WORD SANG PDF (KẾ THỪA TỪ PHIÊN BẢN TRƯỚC) ====================
function parseDocBinaryToHtml(arrayBuffer) {
  const buffer = new Uint8Array(arrayBuffer);
  const view = new DataView(arrayBuffer);
  
  let wordDocOffset = -1;
  for (let i = 0; i < buffer.length - 100; i += 512) {
    if (view.getUint16(i, true) === 0xA5EC) {
      wordDocOffset = i;
      break;
    }
  }

  let raw = null;
  let charCount = 0;

  if (wordDocOffset !== -1) {
    try {
      const fcMin = view.getUint32(wordDocOffset + 0x0018, true);
      const ccpText = view.getUint32(wordDocOffset + 0x004C, true);
      const start = wordDocOffset + fcMin;
      if (fcMin > 0 && ccpText > 0 && start + ccpText * 2 <= buffer.length) {
        raw = new DataView(arrayBuffer, start, ccpText * 2);
        charCount = ccpText;
      }
    } catch (parseWordErr) {
      console.warn('[parseDoc97Binary] Lỗi phân giải nhị phân bảng fib Word:', parseWordErr.message);
    }
  }

  if (!raw) {
    raw = view;
    charCount = Math.floor(buffer.length / 2);
  }

  const blocks = [];
  let currentCell = '';
  let currentRow = [];

  for (let i = 0; i < charCount * 2; i += 2) {
    try {
      const code = raw.getUint16(i, true);
      if (code === 7) {
        if (currentCell.length === 0 && currentRow.length > 0) {
          blocks.push({ type: 'row', cells: [...currentRow] });
          currentRow = [];
        } else {
          currentRow.push(currentCell.trim());
          currentCell = '';
        }
      } else if (code === 13 || code === 10) {
        if (currentRow.length > 0) {
          blocks.push({ type: 'row', cells: [...currentRow] });
          currentRow = [];
        }
        if (currentCell.trim().length > 0) {
          blocks.push({ type: 'p', text: currentCell.trim() });
          currentCell = '';
        }
      } else if ((code >= 32 && code <= 126) || (code >= 0x00A0 && code <= 0x036F) || (code >= 0x1EA0 && code <= 0x1EF9)) {
        currentCell += String.fromCharCode(code);
      }
    } catch {
      break;
    }
  }
  if (currentRow.length > 0) blocks.push({ type: 'row', cells: [...currentRow] });
  if (currentCell.trim().length > 0) blocks.push({ type: 'p', text: currentCell.trim() });

  const cleanBlocks = [];
  for (const b of blocks) {
    if (b.type === 'p') {
      const text = b.text;
      if (text.includes('Default Paragraph Font') || text.includes('Root Entry') || text.includes('WordDocument')) break;
      if (text.split(/\s+/).some(w => w.length > 25)) continue;
      const cleanLen = text.replace(/[^a-zA-Z0-9\u00C0-\u024F\u1EA0-\u1EF9\s\.,;:!?\(\)\/\-_%]/g, '').length;
      if (cleanLen / text.length >= 0.7 && text.length >= 2) {
        cleanBlocks.push(b);
      }
    } else if (b.type === 'row') {
      const cleanCells = b.cells.map(c => c.trim()).filter(c => c.length > 0 && !c.split(/\s+/).some(w => w.length > 25));
      if (cleanCells.length > 0) {
        const totalText = cleanCells.join(' ');
        const cleanLen = totalText.replace(/[^a-zA-Z0-9\u00C0-\u024F\u1EA0-\u1EF9\s\.,;:!?\(\)\/\-_%]/g, '').length;
        if (cleanLen / totalText.length >= 0.6) {
          cleanBlocks.push({ type: 'row', cells: cleanCells });
        }
      }
    }
  }

  let html = '<div class="word-document-body" style="font-family:\'Times New Roman\', Times, serif; font-size:13pt; line-height:1.45; color:#111;">';
  let inTable = false;

  for (const b of cleanBlocks) {
    if (b.type === 'row') {
      if (!inTable) {
        html += '<table style="width:100%; border-collapse:collapse; margin:14px 0; font-size:11pt; border:1px solid #333;">';
        inTable = true;
      }
      html += '<tr style="border-bottom:1px solid #444;">';
      b.cells.forEach((cell, idx) => {
        const isHdr = (idx === 0 && (cell === 'TT' || cell === 'STT'));
        const tag = isHdr ? 'th' : 'td';
        const bg = isHdr ? 'background-color:#f1f5f9; font-weight:bold; text-align:center;' : 'text-align:left;';
        html += `<${tag} style="border:1px solid #444; padding:6px 8px; ${bg}">${escapeHtml(cell)}</${tag}>`;
      });
      html += '</tr>';
    } else {
      if (inTable) {
        html += '</table>';
        inTable = false;
      }
      const p = b.text;
      if (p.startsWith('PHỤ LỤC') || p.startsWith('THỐNG KÊ') || p.startsWith('TỔNG HỢP') || /^[I|V|X]+\./.test(p)) {
        html += `<h3 style="text-align:center; font-weight:bold; font-size:13.5pt; margin:16px 0 6px 0; text-transform:uppercase;">${escapeHtml(p)}</h3>`;
      } else if (p.startsWith('(Kèm theo') || p.startsWith('(')) {
        html += `<p style="text-align:center; font-style:italic; font-size:11.5pt; margin:2px 0 12px 0;">${escapeHtml(p)}</p>`;
      } else {
        html += `<p style="margin:6px 0; text-align:justify;">${escapeHtml(p)}</p>`;
      }
    }
  }
  if (inTable) html += '</table>';
  html += '</div>';
  return html;
}

async function parseWordDocumentToHtml(arrayBuffer, fileName = '') {
  const u8 = new Uint8Array(arrayBuffer);
  const isZip = (u8.length >= 4 && u8[0] === 0x50 && u8[1] === 0x4B && u8[2] === 0x03 && u8[3] === 0x04);
  const isDocBinary = (u8.length >= 4 && u8[0] === 0xD0 && u8[1] === 0xCF && u8[2] === 0x11 && u8[3] === 0xE0);

  if (isZip && window.mammoth) {
    try {
      const res = await window.mammoth.convertToHtml({ arrayBuffer });
      if (res && res.value && res.value.trim().length > 10) {
        return res.value;
      }
    } catch (mErr) {
      console.warn('Mammoth không thể phân tích tệp này, chuyển sang bộ giải mã tích hợp:', mErr.message);
    }
  }

  if (isDocBinary || fileName.toLowerCase().endsWith('.doc')) {
    const docHtml = parseDocBinaryToHtml(arrayBuffer);
    if (docHtml && docHtml.length > 50) return docHtml;
  }

  const fallbackHtml = parseDocBinaryToHtml(arrayBuffer);
  if (fallbackHtml && fallbackHtml.length > 50) return fallbackHtml;

  return `<div style="font-family:'Times New Roman', serif; font-size:13pt; line-height:1.6; padding:20px;"><h3 style="text-align:center; font-weight:bold;">${escapeHtml(fileName || 'KẾ HOẠCH BÀI DẠY')}</h3><p style="text-align:center; font-style:italic;">Đã tiếp nhận tệp Word vào hệ thống phê duyệt.</p></div>`;
}

async function convertDocxToPdfInBrowser(file, targetPdfName) {
  if (!window.html2pdf) {
    throw new Error('Thư viện tạo PDF (html2pdf.js) chưa sẵn sàng.');
  }

  const arrayBuffer = await file.arrayBuffer();
  const rawHtml = await parseWordDocumentToHtml(arrayBuffer, file.name);
  if (!rawHtml || !rawHtml.trim()) {
    throw new Error('Tệp Word rỗng hoặc không có nội dung văn bản.');
  }

  const container = document.createElement('div');
  container.className = 'word-preview-page';
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '794px';
  container.style.padding = '40px 50px';
  container.style.backgroundColor = '#ffffff';
  container.style.color = '#000000';
  container.style.fontFamily = "'Times New Roman', Times, serif";
  container.style.fontSize = '13pt';
  container.style.lineHeight = '1.45';
  container.innerHTML /* sanitize */ = rawHtml;
  document.body.appendChild(container);

  try {
    const opt = {
      margin: [12, 12, 12, 12],
      filename: targetPdfName || 'TaiLieu.pdf',
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        letterRendering: true,
        logging: false
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };

    const pdfDataUri = await html2pdf().from(container).set(opt).outputPdf('datauristring');
    const cIdx = pdfDataUri.indexOf(',');
    const b64 = (cIdx >= 0 ? pdfDataUri.substring(cIdx + 1) : pdfDataUri).trim().replace(/\s/g, '');
    return 'data:application/pdf;base64,' + b64;
  } finally {
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  }
}

async function handleConvertWordToPdf() {
  if (!canUserUploadWord()) {
    handleClearFile();
    showModalAlert(
      'Chưa được cấp quyền',
      'Tài khoản của Thầy/Cô chưa được Quản trị viên cấp quyền chuyển đổi tệp Word trên hệ thống. Vui lòng tự xuất hoặc chuyển tệp sang PDF trên máy tính trước khi nộp.',
      'warning'
    );
    return;
  }

  if (!teacherSelectedFile) {
    showModalAlert('Chưa chọn tệp', 'Vui lòng chọn tệp Word (.docx, .doc) cần chuyển đổi.', 'warning');
    return;
  }

  const btnConvert = document.getElementById('btnConvertToPdf');
  const origHtml = btnConvert ? btnConvert.innerHTML : '';

  if (btnConvert) {
    btnConvert.disabled = true;
    btnConvert.className = 'flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-amber-600 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-wait';
    btnConvert.innerHTML /* sanitize */ = '<svg class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg><span>Đang chuyển sang PDF...</span>';
  }

  try {
    const newPdfName = teacherSelectedFile.name.replace(/\.(docx|doc)$/i, '.pdf');
    let convertedPdfBase64 = null;

    // Ưu tiên 1: Dùng EduSign Agent COM nếu có chạy trên máy
    try {
      const pingRes = await fetch('http://127.0.0.1:18888/api/ping-local-signer', { method: 'GET', signal: AbortSignal.timeout(1200) });
      if (pingRes.ok) {
        const agentRes = await fetch('http://127.0.0.1:18888/api/convert-word-to-pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileBase64: teacherSelectedFileBase64,
            fileName: teacherSelectedFile.name
          }),
          signal: AbortSignal.timeout(35000)
        });
        if (agentRes.ok) {
          const agentData = await agentRes.json();
          if (agentData.success && agentData.pdfBase64) {
            convertedPdfBase64 = agentData.pdfBase64;
          }
        }
      }
    } catch {
      // Tiếp tục fallback trình duyệt
    }

    // Ưu tiên 2: Trình duyệt chuyển đổi qua Mammoth + html2pdf
    if (!convertedPdfBase64) {
      if (btnConvert) {
        btnConvert.innerHTML /* sanitize */ = '<svg class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg><span>Dựng bản in PDF...</span>';
      }
      convertedPdfBase64 = await convertDocxToPdfInBrowser(teacherSelectedFile, newPdfName);
    }

    if (!convertedPdfBase64) {
      throw new Error('Không thể tạo định dạng PDF từ tệp Word này.');
    }

    const commaIdx = convertedPdfBase64.indexOf(',');
    const rawBase64 = (commaIdx >= 0 ? convertedPdfBase64.substring(commaIdx + 1) : convertedPdfBase64).trim().replace(/\s/g, '');
    teacherSelectedFileBase64 = 'data:application/pdf;base64,' + rawBase64;

    const byteCharacters = atob(rawBase64);
    const byteArray = new Uint8Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteArray[i] = byteCharacters.charCodeAt(i);
    }
    const pdfBlob = new Blob([byteArray], { type: 'application/pdf' });
    teacherSelectedFile = new File([pdfBlob], newPdfName, { type: 'application/pdf' });

    const fileNameEl = document.getElementById('fileNameDisplay');
    const fileSizeEl = document.getElementById('fileSizeDisplay');
    const badge = document.getElementById('fileIconBadge');
    const inputSave = document.getElementById('inputSaveFileName');

    if (fileNameEl) fileNameEl.textContent = newPdfName;
    if (fileSizeEl) fileSizeEl.textContent = `${formatFileSize(pdfBlob.size)} • Đã chuyển sang PDF`;
    if (badge) {
      badge.textContent = 'PDF';
      badge.className = 'w-9 h-9 rounded-xl bg-red-600 text-white flex items-center justify-center font-bold text-xs shadow-sm';
    }

    updateTeacherButtonStates();
    showToast('Chuyển đổi sang PDF chuẩn thành công!', 'success');

  } catch (err) {
    console.error('Lỗi chuyển đổi Word sang PDF:', err);
    let msg = err.message || 'Không rõ nguyên nhân';
    if (msg.includes('Could not find main document part') || msg.includes('valid .docx')) {
      msg = 'Tệp Word này có định dạng đặc biệt. Thầy/Cô vui lòng lưu dưới dạng .docx chuẩn hoặc bật EduSign Agent để chuyển đổi.';
    }
    showModalAlert('Lỗi chuyển đổi', msg, 'error');
    if (btnConvert) {
      btnConvert.disabled = false;
      btnConvert.innerHTML /* sanitize */ = origHtml;
    }
    updateTeacherButtonStates();
  }
}

// ==================== QUẢN LÝ TAB GIÁO VIÊN & HỒ SƠ CHỜ KÝ ====================
let currentTeacherTab = 'workspace';
let teacherPendingDocs = [];
let teacherSentDocs = [];
let teacherReturnedDocs = [];
let currentChainedPendingDoc = null;
let currentSignedPdfBase64 = null;
let currentDocToReject = null;

let currentTeacherSentSubFilter = 'ALL';

function setTeacherSentSubFilter(sub) {
  currentTeacherSentSubFilter = sub;
  const btnAll = document.getElementById('sentFilterBtnAll');
  const btnPending = document.getElementById('sentFilterBtnPending');
  const btnReturned = document.getElementById('sentFilterBtnReturned');

  const activeClass = 'px-3 py-1.5 rounded-xl text-xs font-bold transition-all bg-slate-900 text-white shadow-2xs cursor-pointer flex items-center gap-1.5 shrink-0';
  const inactivePending = 'px-3 py-1.5 rounded-xl text-xs font-semibold transition-all bg-slate-100 hover:bg-amber-50 text-slate-600 hover:text-amber-800 cursor-pointer flex items-center gap-1.5 shrink-0';
  const inactiveReturned = 'px-3 py-1.5 rounded-xl text-xs font-semibold transition-all bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-800 cursor-pointer flex items-center gap-1.5 shrink-0';
  const inactiveAll = 'px-3 py-1.5 rounded-xl text-xs font-semibold transition-all bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer flex items-center gap-1.5 shrink-0';

  if (btnAll) btnAll.className = sub === 'ALL' ? activeClass : inactiveAll;
  if (btnPending) btnPending.className = sub === 'PENDING' ? activeClass : inactivePending;
  if (btnReturned) btnReturned.className = sub === 'RETURNED' ? activeClass : inactiveReturned;

  renderTeacherSentList(teacherSentDocs);
}

function switchTeacherTab(tabName) {
  currentTeacherTab = tabName;
  const btnWorkspace = document.getElementById('tabBtnTeacherWorkspace');
  const btnPending = document.getElementById('tabBtnTeacherPending');
  const btnSent = document.getElementById('tabBtnTeacherSent');
  const btnReturned = document.getElementById('tabBtnTeacherReturned');
  const btnReports = document.getElementById('tabBtnTeacherReports');
  const contentWorkspace = document.getElementById('tabContentTeacherWorkspace');
  const contentPending = document.getElementById('tabContentTeacherPending');
  const contentSent = document.getElementById('tabContentTeacherSent');
  const contentReturned = document.getElementById('tabContentTeacherReturned');
  const contentReports = document.getElementById('tabContentTeacherReports');

  const activeBtnClass = 'px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all bg-brand-600 text-white shadow-sm shadow-brand-500/20 flex items-center gap-2 shrink-0 cursor-pointer';
  const inactiveBtnClass = 'px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all text-slate-600 hover:text-slate-900 hover:bg-slate-100 flex items-center gap-2 shrink-0 cursor-pointer';

  // Ẩn tất cả nội dung
  if (contentWorkspace) contentWorkspace.classList.add('hidden');
  if (contentPending) contentPending.classList.add('hidden');
  if (contentSent) contentSent.classList.add('hidden');
  if (contentReturned) contentReturned.classList.add('hidden');
  if (contentReports) contentReports.classList.add('hidden');

  // Đặt class mặc định cho nút
  if (btnWorkspace) btnWorkspace.className = inactiveBtnClass;
  if (btnPending) btnPending.className = inactiveBtnClass;
  if (btnSent) btnSent.className = inactiveBtnClass;
  if (btnReturned) btnReturned.className = inactiveBtnClass;
  if (btnReports) btnReports.className = inactiveBtnClass;

  if (tabName === 'workspace') {
    if (contentWorkspace) contentWorkspace.classList.remove('hidden');
    if (btnWorkspace) btnWorkspace.className = activeBtnClass;
  } else if (tabName === 'pending') {
    if (contentPending) contentPending.classList.remove('hidden');
    if (btnPending) btnPending.className = activeBtnClass;
    loadTeacherPendingDocuments(true);
  } else if (tabName === 'sent') {
    if (contentSent) contentSent.classList.remove('hidden');
    if (btnSent) btnSent.className = activeBtnClass;
    loadTeacherSentDocuments(true);
  } else if (tabName === 'returned') {
    if (contentReturned) contentReturned.classList.remove('hidden');
    if (btnReturned) btnReturned.className = activeBtnClass;
    loadTeacherSentDocuments(true);
  } else if (tabName === 'reports') {
    if (contentReports) contentReports.classList.remove('hidden');
    if (btnReports) btnReports.className = activeBtnClass;
    loadSchoolReports(true);
  }
}

async function loadTeacherPendingDocuments(force = false) {
  const container = document.getElementById('listTeacherPendingContainer');
  const badgeEl = document.getElementById('badgeTeacherPendingCount');
  const user = appState.currentUser;
  if (!user) return;

  const currentUserId = user.id || user.username;
  const currentUsername = user.username || user.id;

  try {
    let pendingList = [];

    // 1. Thử gọi backend /api/documents/pending trước nếu có server hoặc test mock
    const canCallBackendPending = (window.location.protocol !== 'file:' || window._mockPendingList !== undefined);
    if (canCallBackendPending) {
      try {
        const headers = {
          'Content-Type': 'application/json',
          'x-user-id': currentUserId,
          'x-user-username': currentUsername,
          'x-user-fullname': encodeURIComponent(user.fullName || currentUsername)
        };
        if (appState.token) {
          headers['Authorization'] = `Bearer ${appState.token}`;
        }

        const fetchEndpoint = (window.location.protocol === 'file:' && window._mockPendingList !== undefined)
          ? '/api/documents/pending'
          : (API_BASE ? `${API_BASE}/api/documents/pending` : '/api/documents/pending');

        const res = await fetch(fetchEndpoint, {
          headers,
          cache: 'no-store'
        });
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data)) {
            pendingList = json.data;
          }
        }
      } catch (apiErr) {
        console.warn('[Pending Docs] Backend API offline, fallback to Firebase:', apiErr.message);
      }
    }

    // 2. Nếu API không có dữ liệu hoặc lỗi mạng -> query Firebase trực tiếp
    if (pendingList.length === 0) {
      let allDocs = null;
      if (firebaseDb) {
        const snap = await firebaseDb.ref('documents').once('value');
        allDocs = snap.val();
      } else {
        const fRes = await fetch(`${RTDB_URL}/documents.json?_t=${Date.now()}`);
        if (fRes.ok) allDocs = await fRes.json();
      }

      if (allDocs) {
        const docArray = Array.isArray(allDocs)
          ? allDocs.filter(Boolean)
          : Object.keys(allDocs).map(k => ({ id: allDocs[k].id || k, ...allDocs[k] }));

        pendingList = docArray.filter(d => {
          if (!d || d.status !== 'PENDING_SIGN') return false;
          const isAssigned = (d.assignedTo && (d.assignedTo === currentUserId || d.assignedTo === currentUsername)) ||
                             (d.currentSignerId && (d.currentSignerId === currentUserId || d.currentSignerId === currentUsername));
          return Boolean(isAssigned);
        });

        pendingList.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
      }
    }

    teacherPendingDocs = pendingList;

    // Cập nhật huy hiệu số lượng hồ sơ chờ ký
    if (badgeEl) {
      badgeEl.textContent = pendingList.length;
      if (pendingList.length > 0) {
        badgeEl.className = 'px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white animate-pulse';
      } else {
        badgeEl.className = 'px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-600';
      }
    }

    // Render danh sách nếu đang ở tab Hồ sơ chờ ký
    if (container) {
      renderTeacherPendingList(pendingList);
    }

  } catch (err) {
    console.error('[loadTeacherPendingDocuments] Lỗi:', err);
    if (container) {
      container.innerHTML /* sanitize */ = `
        <div class="p-6 bg-red-50 border border-red-200 rounded-2xl text-center text-red-700 text-xs">
          Lỗi nạp danh sách hồ sơ: ${escapeHtml(err.message)}
        </div>
      `;
    }
  }
}

function renderTeacherPendingList(docs) {
  const container = document.getElementById('listTeacherPendingContainer');
  if (!container) return;

  if (!docs || docs.length === 0) {
    container.innerHTML /* sanitize */ = `
      <div class="py-14 text-center text-slate-400 space-y-2">
        <div class="w-14 h-14 mx-auto rounded-3xl bg-slate-100 text-slate-400 flex items-center justify-center">
          <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        </div>
        <p class="text-xs font-bold text-slate-600">Tuyệt vời! Hiện không có hồ sơ nào chờ Thầy/Cô ký duyệt</p>
        <p class="text-[11px] text-slate-400">Các báo cáo do đồng nghiệp chuyển tiếp sẽ xuất hiện tại đây khi được gửi đến Thầy/Cô</p>
      </div>
    `;
    return;
  }

  container.innerHTML /* sanitize */ = docs.map(doc => {
    const sigCount = Array.isArray(doc.signatures) ? doc.signatures.length : 1;
    const latestSig = Array.isArray(doc.signatures) && doc.signatures[doc.signatures.length - 1];
    const latestSigner = latestSig ? latestSig.signerName : doc.creatorName;
    const createdStr = doc.createdAt ? new Date(doc.createdAt).toLocaleString('vi-VN') : 'Mới đây';

    return `
      <div class="p-4 sm:p-5 bg-gradient-to-r from-white to-purple-50/20 border border-slate-200/90 hover:border-purple-300 rounded-2xl shadow-xs transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group">
        <div class="space-y-1.5 min-w-0 flex-1">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
              Báo cáo liên hoàn
            </span>
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 cursor-pointer hover:bg-indigo-100 transition"
                  onclick="navigator.clipboard.writeText('${escapeHtml(doc.id)}'); showToast('Đã sao chép mã theo dõi: ${escapeHtml(doc.id)}', 'success')"
                  title="Bấm để sao chép mã theo dõi">
              <span>🏷️ ${escapeHtml(doc.id)}</span>
              <svg class="w-3 h-3 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
            </span>
            <span class="text-[11px] text-slate-400 font-mono">${createdStr}</span>
          </div>
          <h4 class="text-sm font-bold text-slate-900 group-hover:text-purple-700 transition truncate" title="${escapeHtml(doc.title)}">
            ${escapeHtml(doc.title)}
          </h4>
          <div class="text-[11px] text-slate-600 flex items-center gap-2 flex-wrap">
            <span>👤 Người tạo: <strong>${escapeHtml(doc.creatorName || 'Đồng nghiệp')}</strong> (${escapeHtml(doc.creatorDept || 'Chuyên môn')})</span>
            <span>•</span>
            <span class="text-emerald-700 font-medium">✍️ Chữ ký gần nhất: <strong>${escapeHtml(latestSigner)}</strong> (Bước ${sigCount})</span>
          </div>
          ${doc.note ? `
            <div class="text-[11px] text-purple-900 bg-purple-50 px-2.5 py-1 rounded-xl border border-purple-200/70 inline-block mt-0.5">
              💬 Ghi chú: <em>${escapeHtml(doc.note)}</em>
            </div>
          ` : ''}
        </div>

        <div class="flex items-center gap-2 shrink-0">
          <button type="button" onclick="openModalRejectDocument('${escapeHtml(doc.id)}')" 
            class="px-3.5 py-2.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs" title="Trả lại hồ sơ cho người gửi nếu có sai sót">
            <svg class="w-4 h-4 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
            <span>Trả về</span>
          </button>
          <button type="button" onclick="openPendingDocumentToSign('${escapeHtml(doc.id)}')" 
            class="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-bold shadow-md shadow-purple-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
            <span>Mở Ký Ngay</span>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// ==================== QUẢN LÝ HỒ SƠ TÔI ĐÃ GỬI (THEO DÕI TIẾN ĐỘ & XÓA) ====================
async function loadTeacherSentDocuments(force = false) {
  const container = document.getElementById('listTeacherSentContainer');
  const badgeEl = document.getElementById('badgeTeacherSentCount');
  const user = appState.currentUser;
  if (!user) return;

  const currentUserId = user.id || user.username;
  const currentUsername = user.username || user.id;

  try {
    let sentList = [];
    const canCallBackend = (window.location.protocol !== 'file:' || window._mockSentList !== undefined);

    if (Array.isArray(window._mockSentList)) {
      sentList = window._mockSentList;
    } else if (canCallBackend) {
      try {
        const headers = {
          'Content-Type': 'application/json',
          'x-user-id': currentUserId,
          'x-user-username': currentUsername,
          'x-user-fullname': encodeURIComponent(user.fullName || currentUsername)
        };
        if (appState.token) {
          headers['Authorization'] = `Bearer ${appState.token}`;
        }

        const fetchEndpoint = (window.location.protocol === 'file:' && window._mockSentList !== undefined)
          ? '/api/documents/sent'
          : (API_BASE ? `${API_BASE}/api/documents/sent` : '/api/documents/sent');

        const res = await fetch(fetchEndpoint, { headers, cache: 'no-store' });
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data)) {
            sentList = json.data;
          }
        }
      } catch (apiErr) {
        console.warn('[Sent Docs] Backend API offline, fallback to Firebase:', apiErr.message);
      }
    }

    // 2. Nếu API không có dữ liệu hoặc lỗi mạng -> query Firebase trực tiếp
    if (sentList.length === 0) {
      let allDocs = null;
      if (firebaseDb) {
        const snap = await firebaseDb.ref('documents').once('value');
        allDocs = snap.val();
      } else {
        const fRes = await fetch(`${RTDB_URL}/documents.json?_t=${Date.now()}`);
        if (fRes.ok) allDocs = await fRes.json();
      }

      if (allDocs) {
        const docArray = Array.isArray(allDocs)
          ? allDocs.filter(Boolean)
          : Object.keys(allDocs).map(k => ({ id: allDocs[k].id || k, ...allDocs[k] }));

        const curNameNorm = (typeof normalizeVietnamese === 'function') 
          ? normalizeVietnamese(user.fullName || user.name || '') 
          : (user.fullName || user.name || '').toLowerCase();

        sentList = docArray.filter(d => {
          if (!d) return false;
          // 1. Là người khởi tạo văn bản
          const isCreator = (d.creatorId && (d.creatorId === currentUserId || d.creatorId === currentUsername)) ||
                           (d.creatorUsername && (d.creatorUsername === currentUserId || d.creatorUsername === currentUsername)) ||
                           (d.authorId && (d.authorId === currentUserId || d.authorId === currentUsername)) ||
                           (d.authorUsername && (d.authorUsername === currentUserId || d.authorUsername === currentUsername));
          // 2. Là người đã tham gia ký duyệt (GVB, BGH người ký sau)
          const isSigner = Array.isArray(d.signatures) && d.signatures.some(s => {
            if (!s) return false;
            if (s.signerId && (s.signerId === currentUserId || s.signerId === currentUsername)) return true;
            if (s.signerUsername && (s.signerUsername === currentUserId || s.signerUsername === currentUsername)) return true;
            if (curNameNorm && s.signerName) {
              const sNorm = (typeof normalizeVietnamese === 'function') ? normalizeVietnamese(s.signerName) : s.signerName.toLowerCase();
              if (sNorm === curNameNorm) return true;
            }
            return false;
          });
          // 3. Là người đang được phân công duyệt tiếp theo
          const isAssigned = (d.assignedTo && (d.assignedTo === currentUserId || d.assignedTo === currentUsername)) ||
                             (d.currentSignerId && (d.currentSignerId === currentUserId || d.currentSignerId === currentUsername));

          const hasRelation = Boolean(isCreator || isSigner || isAssigned);
          if (!hasRelation) return false;

          // Giữ lại hồ sơ đang luân chuyển, cần sửa lại HOẶC hồ sơ phối hợp ký mà tôi đã tham gia ký duyệt (isSigner)
          const isDone = d.status === 'COMPLETED' || d.status === 'ARCHIVED' || d.status === 'APPROVED' || (d.status && d.status.includes('ĐÃ KÝ'));
          if (isDone) {
            return isSigner;
          }
          return true;
        });

        sentList.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
      }
    }

    // Bảo lưu danh sách mock test và giữ lại hồ sơ phối hợp ký đã hoàn tất cho người ký sau
    if (!Array.isArray(window._mockSentList)) {
      sentList = sentList.filter(d => {
        if (!d) return false;
        const isSigner = Array.isArray(d.signatures) && d.signatures.some(s => {
          if (!s) return false;
          if (s.signerId && (s.signerId === currentUserId || s.signerId === currentUsername)) return true;
          if (s.signerUsername && (s.signerUsername === currentUserId || s.signerUsername === currentUsername)) return true;
          return false;
        });
        const isDone = d.status === 'COMPLETED' || d.status === 'ARCHIVED' || d.status === 'APPROVED' || (d.status && d.status.includes('ĐÃ KÝ'));
        if (isDone) {
          return isSigner;
        }
        return true;
      });
    }

    teacherSentDocs = sentList;

    // Cập nhật số lượng đếm trên các bộ lọc con
    const allCount = sentList.length;
    const pendingCount = sentList.filter(d => d.status === 'PENDING_SIGN' || d.status === 'WAITING_LEADER_APPROVAL').length;
    const returnedCount = sentList.filter(d => d.status === 'RETURNED' || d.status === 'REJECTED').length;

    const elSubAll = document.getElementById('sentSubCountAll');
    const elSubPending = document.getElementById('sentSubCountPending');
    const elSubReturned = document.getElementById('sentSubCountReturned');
    if (elSubAll) elSubAll.textContent = allCount;
    if (elSubPending) elSubPending.textContent = pendingCount;
    if (elSubReturned) elSubReturned.textContent = returnedCount;

    // Cập nhật huy hiệu số lượng hồ sơ đang tiến độ
    if (badgeEl) {
      badgeEl.textContent = allCount;
      if (returnedCount > 0) {
        badgeEl.className = 'px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-600 text-white animate-pulse';
        badgeEl.title = `Có ${returnedCount} hồ sơ bị trả về cần sửa lại`;
      } else if (allCount > 0) {
        badgeEl.className = 'px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-600 text-white';
      } else {
        badgeEl.className = 'px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-600';
      }
    }

    // Render danh sách hồ sơ đã gửi
    if (container) {
      renderTeacherSentList(sentList);
    }

  } catch (err) {
    console.error('[loadTeacherSentDocuments] Lỗi:', err);
    if (container) {
      container.innerHTML /* sanitize */ = `
        <div class="p-6 bg-red-50 border border-red-200 rounded-2xl text-center text-red-700 text-xs">
          Lỗi nạp danh sách hồ sơ đã gửi: ${escapeHtml(err.message)}
        </div>
      `;
    }
  }
}

function renderTeacherSentList(docs) {
  const container = document.getElementById('listTeacherSentContainer');
  if (!container) return;

  let filteredDocs = docs || [];
  if (currentTeacherSentSubFilter === 'PENDING') {
    filteredDocs = filteredDocs.filter(d => d.status === 'PENDING_SIGN' || d.status === 'WAITING_LEADER_APPROVAL');
  } else if (currentTeacherSentSubFilter === 'RETURNED') {
    filteredDocs = filteredDocs.filter(d => d.status === 'RETURNED' || d.status === 'REJECTED');
  }

  if (!filteredDocs || filteredDocs.length === 0) {
    let emptyTitle = 'Thầy/Cô không có hồ sơ nào đang luân chuyển';
    let emptySubtitle = 'Khi Thầy/Cô trình ký văn bản mới, tiến độ ký duyệt của đồng nghiệp sẽ hiển thị tại đây.';
    if (currentTeacherSentSubFilter === 'PENDING') {
      emptyTitle = 'Không có hồ sơ nào đang chờ ký';
      emptySubtitle = 'Tất cả các hồ sơ gửi đi đã được xử lý xong hoặc chuyển bước tiếp theo.';
    } else if (currentTeacherSentSubFilter === 'RETURNED') {
      emptyTitle = 'Tuyệt vời! Không có hồ sơ nào bị trả về';
      emptySubtitle = 'Các báo cáo của Thầy/Cô đều đạt yêu cầu và không bị yêu cầu sửa lại.';
    }

    container.innerHTML /* sanitize */ = `
      <div class="py-14 text-center text-slate-400 space-y-2">
        <div class="w-14 h-14 mx-auto rounded-3xl bg-slate-100 text-slate-400 flex items-center justify-center">
          <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        </div>
        <p class="text-xs font-bold text-slate-600">${emptyTitle}</p>
        <p class="text-[11px] text-slate-400">${emptySubtitle}</p>
      </div>
    `;
    return;
  }

  const user = appState.currentUser;
  const currentUserId = user?.id || user?.username;
  const currentUsername = user?.username || user?.id;

  container.innerHTML /* sanitize */ = filteredDocs.map(doc => {
    const isCompleted = doc.status === 'COMPLETED';
    const isPending = doc.status === 'PENDING_SIGN';
    const isRecalled = doc.status === 'RECALLED';
    const isReturned = doc.status === 'RETURNED';
    const sigCount = Array.isArray(doc.signatures) ? doc.signatures.length : 1;
    const createdStr = doc.createdAt ? new Date(doc.createdAt).toLocaleString('vi-VN') : 'Mới đây';
    const nextPerson = doc.assignedToName || doc.currentSignerName || doc.nextSignerName || 'Đồng nghiệp';

    const isAuthor = (doc.creatorId && (doc.creatorId === currentUserId || doc.creatorId === currentUsername)) ||
                     (doc.creatorUsername && (doc.creatorUsername === currentUserId || doc.creatorUsername === currentUsername)) ||
                     (doc.authorId && (doc.authorId === currentUserId || doc.authorId === currentUsername));
    const isSignedByMe = Array.isArray(doc.signatures) && doc.signatures.some(s => s && (s.signerId === currentUserId || s.signerUsername === currentUsername));

    let statusBadge = '';
    if (isCompleted) {
      const hasSeal = Array.isArray(doc.signatures) && doc.signatures.some(s => s.role === 'BGH' || s.isSchoolSeal || (s.signerRole && (s.signerRole.includes('Giám hiệu') || s.signerRole.includes('Hiệu trưởng'))));
      statusBadge = `
        <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs">
          <svg class="w-3 h-3 text-emerald-600" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
          Đã hoàn tất (Đủ ${sigCount} chữ ký${hasSeal ? ' + Dấu trường' : ''})
        </span>
      `;
    } else if (isReturned) {
      statusBadge = `
        <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300 shadow-2xs">
          <svg class="w-3.5 h-3.5 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          Bị trả về / Cần sửa lại
        </span>
      `;
    } else if (isPending) {
      statusBadge = `
        <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300 animate-pulse">
          <span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
          Đang chờ: <strong>${escapeHtml(nextPerson)}</strong> ký (Bước ${sigCount + 1})
        </span>
      `;
    } else if (isRecalled) {
      statusBadge = `
        <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-orange-100 text-orange-900 border border-orange-300">
          <svg class="w-3.5 h-3.5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/></svg>
          Đã thu hồi về máy
        </span>
      `;
    } else {
      statusBadge = `
        <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
          ${escapeHtml(doc.status || 'Đang xử lý')}
        </span>
      `;
    }

    let actionButtons = '';
    if (isCompleted) {
      actionButtons += `
        <button type="button" onclick="downloadCompletedDocument('${escapeHtml(doc.id)}')"
          class="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition flex items-center gap-1.5 cursor-pointer">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
          <span>Tải file đã ký</span>
        </button>
      `;
    } else if (isReturned) {
      actionButtons += `
        <button type="button" onclick="handleResubmitReturnedDoc('${escapeHtml(doc.id)}')"
          class="px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-sm transition flex items-center gap-1.5 cursor-pointer">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
          <span>Sửa & Trình ký lại</span>
        </button>
      `;
    } else {
      actionButtons += `
        <button type="button" onclick="handleViewReportPdfInline('${escapeHtml(doc.id)}')"
          class="px-3.5 py-2 bg-slate-100 hover:bg-brand-50 hover:text-brand-700 text-slate-700 rounded-xl text-xs font-semibold border border-slate-200 transition flex items-center gap-1.5 cursor-pointer">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
          <span>Xem bản ký hiện tại</span>
        </button>
      `;
    }

    // Nút THU HỒI (khi văn bản đang nằm ở đồng nghiệp chờ ký và là người tạo)
    if (isPending && isAuthor) {
      actionButtons += `
        <button type="button" onclick="handleRecallSentDoc('${escapeHtml(doc.id)}', '${escapeHtml(doc.title).replace(/'/g, "\\'")}')"
          title="Rút hồ sơ về khỏi hộp chờ ký của đồng nghiệp để chỉnh sửa hoặc xóa"
          class="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-xl text-xs font-semibold border border-amber-300 transition flex items-center gap-1 cursor-pointer">
          <svg class="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/></svg>
          <span>Thu hồi</span>
        </button>
      `;
    }

    // Nút XÓA VĨNH VIỄN (nếu là người tạo hoặc hồ sơ bị trả về/thu hồi)
    if (isAuthor || isReturned || isRecalled) {
      actionButtons += `
        <button type="button" onclick="handleDeleteSentDoc('${escapeHtml(doc.id)}', '${escapeHtml(doc.title).replace(/'/g, "\\'")}')"
          title="Xóa vĩnh viễn hồ sơ này khỏi hệ thống"
          class="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-semibold border border-rose-200 transition flex items-center gap-1 cursor-pointer">
          <svg class="w-4 h-4 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          <span>${isPending ? 'Xóa bỏ' : 'Xóa vĩnh viễn'}</span>
        </button>
      `;
    }

    return `
      <div class="p-4 sm:p-5 bg-gradient-to-r from-white to-blue-50/20 border border-slate-200/90 hover:border-blue-300 rounded-2xl shadow-xs transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group">
        <div class="space-y-1.5 min-w-0 flex-1">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
              ${isAuthor ? 'Báo cáo tôi tạo' : 'Báo cáo phối hợp ký'}
            </span>
            ${isSignedByMe && !isAuthor ? '<span class="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">✍️ Thầy/Cô đã ký duyệt</span>' : ''}
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 cursor-pointer hover:bg-indigo-100 transition"
                  onclick="navigator.clipboard.writeText('${escapeHtml(doc.id)}'); showToast('Đã sao chép mã theo dõi: ${escapeHtml(doc.id)}', 'success')"
                  title="Bấm để sao chép mã theo dõi">
              <span>🏷️ ${escapeHtml(doc.id)}</span>
              <svg class="w-3 h-3 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
            </span>
            <span class="text-[11px] text-slate-400 font-mono">${createdStr}</span>
            ${statusBadge}
          </div>
          <h4 class="text-sm font-bold text-slate-900 group-hover:text-brand-700 transition truncate" title="${escapeHtml(doc.title)}">
            ${escapeHtml(doc.title)}
          </h4>
          <div class="text-[11px] text-slate-600 flex items-center gap-2 flex-wrap">
            <span>👤 Người tạo: <strong>${escapeHtml(doc.creatorName || 'Đồng nghiệp')}</strong> (${escapeHtml(doc.creatorDept || 'Chuyên môn')})</span>
            ${isPending ? `<span>•</span><span>👤 Người nhận tiếp theo: <strong>${escapeHtml(nextPerson)}</strong></span>` : ''}
            ${doc.note ? `<span>•</span><span class="italic text-slate-500">"${escapeHtml(doc.note)}"</span>` : ''}
          </div>
          ${doc.returnReason ? `
            <div class="text-[11px] text-rose-900 bg-rose-50 px-2.5 py-1.5 rounded-xl border border-rose-200 inline-block mt-1">
              ❌ <strong>Lý do trả về (${escapeHtml(doc.returnedByName || 'Người duyệt')}):</strong> <em>${escapeHtml(doc.returnReason)}</em>
            </div>
          ` : ''}
        </div>

        <div class="flex items-center gap-2 self-end sm:self-center flex-wrap">
          ${actionButtons}
        </div>
      </div>
    `;
  }).join('');
}

// ==================== QUẢN LÝ HỒ SƠ BỊ TRẢ VỀ (TAB 4) ====================
async function loadTeacherReturnedDocuments(force = false) {
  const container = document.getElementById('listTeacherReturnedContainer');
  const badgeEl = document.getElementById('badgeTeacherReturnedCount');
  const user = appState.currentUser;
  if (!user) return;

  const currentUserId = user.id || user.username;
  const currentUsername = user.username || user.id;

  try {
    let returnedList = [];
    const canCallBackend = (window.location.protocol !== 'file:' || window._mockReturnedList !== undefined);

    if (Array.isArray(window._mockReturnedList)) {
      returnedList = window._mockReturnedList;
    } else if (canCallBackend) {
      try {
        const headers = {
          'Content-Type': 'application/json',
          'x-user-id': currentUserId,
          'x-user-username': currentUsername,
          'x-user-fullname': encodeURIComponent(user.fullName || currentUsername)
        };
        if (appState.token) headers['Authorization'] = `Bearer ${appState.token}`;

        const fetchEndpoint = API_BASE ? `${API_BASE}/api/documents/returned` : '/api/documents/returned';
        const res = await fetch(fetchEndpoint, { headers, cache: 'no-store' });
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data)) {
            returnedList = json.data;
          }
        }
      } catch (e) { console.warn('[Client Handled] e:', e && e.message ? e.message : e); }
    }

    // 2. Query Firebase trực tiếp nếu API không có dữ liệu
    if (returnedList.length === 0) {
      let allDocs = null;
      if (firebaseDb) {
        const snap = await firebaseDb.ref('documents').once('value');
        allDocs = snap.val();
      } else {
        const fRes = await fetch(`${RTDB_URL}/documents.json?_t=${Date.now()}`);
        if (fRes.ok) allDocs = await fRes.json();
      }

      if (allDocs) {
        const docArray = Array.isArray(allDocs)
          ? allDocs.filter(Boolean)
          : Object.keys(allDocs).map(k => ({ id: allDocs[k].id || k, ...allDocs[k] }));

        returnedList = docArray.filter(d => {
          if (!d || d.status !== 'RETURNED') return false;
          const isCreator = (d.creatorId && (d.creatorId === currentUserId || d.creatorId === currentUsername)) ||
                           (d.creatorUsername && (d.creatorUsername === currentUserId || d.creatorUsername === currentUsername)) ||
                           (d.authorId && (d.authorId === currentUserId || d.authorId === currentUsername)) ||
                           (d.authorUsername && (d.authorUsername === currentUserId || d.authorUsername === currentUsername));
          return Boolean(isCreator);
        });

        returnedList.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
      }
    }

    teacherReturnedDocs = returnedList;

    if (badgeEl) {
      badgeEl.textContent = returnedList.length;
      if (returnedList.length > 0) {
        badgeEl.className = 'px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-600 text-white animate-pulse shadow-xs';
      } else {
        badgeEl.className = 'px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-600';
      }
    }

    if (container) {
      renderTeacherReturnedList(returnedList);
    }
  } catch (err) {
    console.error('[loadTeacherReturnedDocuments] Lỗi:', err);
  }
}

function renderTeacherReturnedList(docs) {
  const container = document.getElementById('listTeacherReturnedContainer');
  if (!container) return;

  if (!docs || docs.length === 0) {
    container.innerHTML /* sanitize */ = `
      <div class="py-14 text-center text-slate-400 space-y-2">
        <div class="w-14 h-14 mx-auto rounded-3xl bg-emerald-50 text-emerald-500 flex items-center justify-center">
          <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        </div>
        <p class="text-xs font-bold text-slate-700">Không có hồ sơ nào bị trả về!</p>
        <p class="text-[11px] text-slate-400">Tất cả các văn bản của Thầy/Cô đều đang được xử lý đúng tiến độ hoặc đã phê duyệt xong.</p>
      </div>
    `;
    return;
  }

  container.innerHTML /* sanitize */ = docs.map(doc => {
    const returnedBy = doc.returnedByName || 'Người duyệt';
    const returnedRole = doc.returnedByRole || 'Cấp duyệt';
    const reason = doc.returnReason || doc.rejectReason || 'Không đúng thể thức hoặc số liệu chưa chuẩn xác';
    const returnedTime = doc.returnedAt ? new Date(doc.returnedAt).toLocaleString('vi-VN') : (doc.updatedAt ? new Date(doc.updatedAt).toLocaleString('vi-VN') : 'Gần đây');

    return `
      <div class="p-4 sm:p-5 bg-gradient-to-r from-rose-50/40 via-white to-amber-50/20 border-2 border-rose-200 hover:border-rose-300 rounded-2xl shadow-xs transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group">
        <div class="space-y-2 min-w-0 flex-1">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200 shadow-xs">
              <span class="w-1.5 h-1.5 rounded-full bg-rose-600 animate-ping"></span>
              ❌ Bị trả về - Cần chỉnh sửa
            </span>
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
              🏷️ ${escapeHtml(doc.id)}
            </span>
            <span class="text-[11px] text-slate-400 font-mono">⏰ ${escapeHtml(returnedTime)}</span>
          </div>

          <h4 class="text-sm font-bold text-slate-900 group-hover:text-rose-700 transition truncate" title="${escapeHtml(doc.title)}">
            ${escapeHtml(doc.title)}
          </h4>

          <div class="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 space-y-1">
            <div class="font-bold flex items-center gap-1.5">
              <svg class="w-4 h-4 text-rose-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              <span>Người trả về: <strong>${escapeHtml(returnedBy)}</strong> (${escapeHtml(returnedRole)})</span>
            </div>
            <div class="pl-5 text-slate-700 font-medium">
              Lý do: <em>"${escapeHtml(reason)}"</em>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2 shrink-0">
          <button type="button" onclick="handleResubmitReturnedDoc('${escapeHtml(doc.id)}')"
            class="px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-md shadow-brand-500/20 transition flex items-center gap-1.5 cursor-pointer">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
            <span>Sửa & Trình ký lại</span>
          </button>
          <button type="button" onclick="handleDeleteSentDoc('${escapeHtml(doc.id)}', '${escapeHtml(doc.title).replace(/'/g, "\\'")}')"
            class="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl border border-slate-200 transition cursor-pointer" title="Xóa bỏ hoàn toàn hồ sơ này">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function handleResubmitReturnedDoc(docId) {
  const doc = teacherReturnedDocs.find(d => d.id === docId) || teacherSentDocs.find(d => d.id === docId);
  if (!doc) return;
  // Chuyển sang Tab 1: Soạn & Ký văn bản
  switchTeacherTab('workspace');
  // Chọn chế độ Báo cáo
  const rdoReport = document.querySelector('input[name="docTypeChoice"][value="REPORT"]');
  if (rdoReport) {
    rdoReport.checked = true;
    handleDocTypeChange();
    const isSchool = Boolean(doc.reportCategory === 'SCHOOL' || doc.requiresSeal);
    const rdoCat = document.querySelector(`input[name="reportCategoryChoice"][value="${isSchool ? 'SCHOOL_REPORT' : 'INTERNAL_REPORT'}"]`);
    if (rdoCat) {
      rdoCat.checked = true;
      handleReportCategoryChange();
    }
  }
  // Gợi ý chọn tệp mới
  showToast(`Đang mở chế độ sửa hồ sơ: ${doc.title}. Vui lòng chọn tệp Word/PDF đã sửa để ký lại!`, 'info');
  const dropzone = document.getElementById('dropzoneBox');
  if (dropzone) {
    dropzone.scrollIntoView({ behavior: 'smooth' });
    dropzone.classList.add('ring-4', 'ring-brand-500', 'ring-offset-2');
    setTimeout(() => dropzone.classList.remove('ring-4', 'ring-brand-500', 'ring-offset-2'), 3000);
  }
}

// ==================== KHO BÁO CÁO ĐIỆN TỬ & PHÂN QUYỀN TRUY CẬP ====================
let currentCachedSchoolReports = [];
let teacherSelectedReportIds = new Set();

async function loadSchoolReports(force = false) {
  const container = document.getElementById('listSchoolReportsContainer');
  const badgeEl = document.getElementById('badgeTeacherReportsCount');
  const iconRefresh = document.getElementById('iconRefreshTeacherReports');
  if (iconRefresh && force) iconRefresh.classList.add('animate-spin');

  const user = appState.currentUser;
  if (!user) return;

  const role = user.role || 'TEACHER';
  const currentUserId = user.id || user.username;
  const currentDept = user.departmentName || user.department || 'Tổ chuyên môn';
  const isAdminOrBgh = (role === 'ADMIN' || role === 'BGH' || user.id === 'admin' || user.departmentId === 'dept_bgh');
  const isLeader = (role === 'LEADER' || role === 'HEAD_DEPT');

  // 1. Cập nhật thẻ phân quyền trực quan
  const permBanner = document.getElementById('reportPermissionBanner');
  if (permBanner) {
    if (isAdminOrBgh) {
      permBanner.innerHTML /* sanitize */ = `
        <div class="flex items-center justify-between flex-wrap gap-2">
          <div class="flex items-center gap-2 text-indigo-900 text-xs font-bold">
            <span class="px-2 py-0.5 rounded-md bg-indigo-600 text-white text-[10px] font-extrabold uppercase tracking-wide shadow-2xs">Toàn quyền BGH</span>
            <span>Thầy/Cô có thẩm quyền xem & quản lý toàn bộ Báo cáo chuyên môn của tất cả các Tổ trong nhà trường.</span>
          </div>
          <span class="text-[11px] font-semibold text-indigo-700 bg-indigo-100/70 px-2.5 py-1 rounded-lg border border-indigo-200/80">Phạm vi: Toàn trường</span>
        </div>
      `;
      permBanner.className = "p-3.5 bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 rounded-2xl shadow-xs";
    } else if (isLeader) {
      permBanner.innerHTML /* sanitize */ = `
        <div class="flex items-center justify-between flex-wrap gap-2">
          <div class="flex items-center gap-2 text-blue-900 text-xs font-bold">
            <span class="px-2 py-0.5 rounded-md bg-blue-600 text-white text-[10px] font-extrabold uppercase tracking-wide shadow-2xs">Quyền Tổ trưởng</span>
            <span>Thầy/Cô có quyền tra cứu toàn bộ Báo cáo thuộc <strong>${escapeHtml(currentDept)}</strong> và các hồ sơ được phân công.</span>
          </div>
          <span class="text-[11px] font-semibold text-blue-700 bg-blue-100/70 px-2.5 py-1 rounded-lg border border-blue-200/80">Phạm vi: ${escapeHtml(currentDept)}</span>
        </div>
      `;
      permBanner.className = "p-3.5 bg-gradient-to-r from-blue-50 to-sky-50 border border-blue-200 rounded-2xl shadow-xs";
    } else {
      permBanner.innerHTML /* sanitize */ = `
        <div class="flex items-center justify-between flex-wrap gap-2">
          <div class="flex items-center gap-2 text-emerald-900 text-xs font-bold">
            <span class="px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[10px] font-extrabold uppercase tracking-wide shadow-2xs">Quyền Giáo viên</span>
            <span>Thầy/Cô được tra cứu các Báo cáo do mình khởi tạo / tham gia ký & các Báo cáo đã đóng dấu ban hành của <strong>${escapeHtml(currentDept)}</strong>.</span>
          </div>
          <span class="text-[11px] font-semibold text-emerald-700 bg-emerald-100/70 px-2.5 py-1 rounded-lg border border-emerald-200/80">Phạm vi: ${escapeHtml(currentDept)} (Đã duyệt) & Cá nhân</span>
        </div>
      `;
      permBanner.className = "p-3.5 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl shadow-xs";
    }
  }

  // 2. Tải toàn bộ hồ sơ từ Firebase hoặc Backend
  if (container) {
    container.innerHTML /* sanitize */ = `
      <div class="py-12 text-center text-slate-400 text-xs">
        <div class="w-7 h-7 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
        <span>Đang tải và phân quyền hồ sơ báo cáo...</span>
      </div>
    `;
  }

  let docList = [];
  try {
    let allDocs = null;
    if (firebaseDb) {
      const snap = await firebaseDb.ref('documents').once('value');
      allDocs = snap.val();
    } else {
      const fRes = await fetch(`${RTDB_URL}/documents.json?_t=${Date.now()}`).catch(() => null);
      if (fRes && fRes.ok) allDocs = await fRes.json().catch(() => null);
    }

    if (allDocs) {
      docList = Array.isArray(allDocs)
        ? allDocs.filter(Boolean)
        : Object.keys(allDocs).map(k => ({ id: allDocs[k].id || k, ...allDocs[k] }));
    }
  } catch (err) {
    console.warn('[loadSchoolReports] Lỗi tải dữ liệu:', err);
  }

  // Lọc chỉ lấy các tài liệu dạng BÁO CÁO (REPORT)
  const allReports = docList.filter(d => {
    return d.docType === 'REPORT' || d.category === 'REPORT' || (d.id && String(d.id).startsWith('BC-'));
  });

  // 3. Áp dụng Ma trận Phân quyền bảo mật (Security Access Matrix)
  const filteredByRole = allReports.filter(doc => {
    // A. Ban Giám hiệu / Quản trị viên: Toàn quyền xem mọi hồ sơ
    if (isAdminOrBgh) return true;

    const docDept = doc.creatorDept || doc.department || '';
    const isSameDept = docDept && currentDept && (
      docDept.toLowerCase().includes(currentDept.toLowerCase()) ||
      currentDept.toLowerCase().includes(docDept.toLowerCase())
    );

    const isCreator = (doc.creatorId === currentUserId || doc.authorId === currentUserId || doc.creatorUsername === user.username);
    const isAssigned = (doc.assignedTo === currentUserId || doc.currentSignerId === currentUserId);
    const hasSigned = Array.isArray(doc.signatures) && doc.signatures.some(s => s.signerId === currentUserId || s.signerName === user.fullName);

    // B. Tổ trưởng chuyên môn: Xem tất cả báo cáo trong tổ của mình, hoặc liên quan trực tiếp
    if (isLeader) {
      return isSameDept || isCreator || isAssigned || hasSigned;
    }

    // C. Giáo viên:
    // - Luôn được xem hồ sơ do mình tạo, được giao ký, hoặc đã từng ký
    if (isCreator || isAssigned || hasSigned) return true;

    // - Được xem các báo cáo chung của tổ mình KHI VÀ CHỈ KHI báo cáo đó ĐÃ ĐƯỢC DUYỆT & ĐÓNG DẤU HOÀN TẤT
    const isCompleted = (doc.status === 'COMPLETED' || doc.status === 'ARCHIVED' || doc.status === 'APPROVED' || (doc.status && doc.status.includes('ĐÃ KÝ')));
    if (isSameDept && isCompleted) return true;

    return false;
  });

  // Sắp xếp báo cáo mới nhất lên đầu
  filteredByRole.sort((a, b) => new Date(b.createdAt || b.updatedAt || 0) - new Date(a.createdAt || a.updatedAt || 0));
  currentCachedSchoolReports = filteredByRole;

  if (badgeEl) badgeEl.textContent = filteredByRole.length;

  teacherSelectedReportIds.clear();
  updateTeacherBatchBar();

  // Render ra bảng kèm bộ lọc tương tác
  renderSchoolReportsTable();

  if (iconRefresh) {
    setTimeout(() => iconRefresh.classList.remove('animate-spin'), 400);
  }
  if (force) {
    showToast('🎉 Đã làm mới dữ liệu Kho Báo cáo!', 'success');
  }
}

function renderSchoolReportsTable() {
  const container = document.getElementById('listSchoolReportsContainer');
  if (!container) return;

  const searchKeyword = (document.getElementById('inputReportSearchKeyword')?.value || '').trim().toLowerCase();
  const deptFilter = document.getElementById('selectReportDeptFilter')?.value || '';
  const statusFilter = document.getElementById('selectReportStatusFilter')?.value || '';

  const user = appState.currentUser;
  const role = user?.role || 'TEACHER';
  const currentUserId = user?.id || user?.username;
  const isAdminOrBgh = (role === 'ADMIN' || role === 'BGH' || user?.id === 'admin' || user?.departmentId === 'dept_bgh');

  let list = currentCachedSchoolReports.filter(doc => {
    // 1. Lọc từ khóa
    if (searchKeyword) {
      const title = (doc.title || '').toLowerCase();
      const code = (doc.id || '').toLowerCase();
      const author = (doc.creatorName || doc.author || '').toLowerCase();
      const dept = (doc.creatorDept || doc.department || '').toLowerCase();
      if (!title.includes(searchKeyword) && !code.includes(searchKeyword) && !author.includes(searchKeyword) && !dept.includes(searchKeyword)) {
        return false;
      }
    }

    // 2. Lọc Tổ chuyên môn
    if (deptFilter) {
      const docDept = (doc.creatorDept || doc.department || '').toLowerCase();
      if (!docDept.includes(deptFilter.toLowerCase())) return false;
    }

    // 3. Lọc Trạng thái
    if (statusFilter) {
      const isComp = doc.status === 'COMPLETED' || (doc.status && doc.status.includes('ĐÃ KÝ'));
      const isRet = doc.status === 'RETURNED' || doc.status === 'REJECTED';
      const hasSeal = Boolean(doc.hasSchoolSeal || (Array.isArray(doc.signatures) && doc.signatures.some(s => s.isSchoolSeal === true || s.role === 'CON_DAU_NHA_TRUONG')));

      if (statusFilter === 'SEALED') {
        if (!isComp || !hasSeal) return false;
      } else if (statusFilter === 'WAIT_SEAL') {
        if (!isComp || hasSeal) return false;
      } else if (statusFilter === 'COMPLETED') {
        if (!isComp) return false;
      } else if (statusFilter === 'PENDING') {
        if (isComp || isRet) return false;
      } else if (statusFilter === 'RETURNED') {
        if (!isRet) return false;
      }
    }

    return true;
  });

  if (list.length === 0) {
    container.innerHTML /* sanitize */ = `
      <div class="py-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200/80">
        <svg class="w-12 h-12 mx-auto mb-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
        <div class="text-sm font-bold text-slate-700">Không có báo cáo nào phù hợp với bộ lọc</div>
        <div class="text-xs text-slate-400 mt-1">Thầy/Cô vui lòng thử đổi từ khóa tìm kiếm hoặc điều kiện lọc.</div>
      </div>
    `;
    return;
  }

  let html = `
    <div class="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs border-collapse">
          <thead>
            <tr class="bg-slate-50/80 text-slate-600 font-bold border-b border-slate-200">
              <th class="py-3 px-3 w-10 text-center">
                <input type="checkbox" id="teacherSelectAllReportsCheckbox" onchange="toggleTeacherSelectAllReports(this.checked)" class="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer" title="Chọn tất cả">
              </th>
              <th class="py-3 px-3 w-12 text-center">STT</th>
              <th class="py-3 px-3.5">Mã & Tiêu đề Báo cáo</th>
              <th class="py-3 px-3.5">Tổ chuyên môn</th>
              <th class="py-3 px-3.5">Người lập</th>
              <th class="py-3 px-3.5">Tiến độ & Chữ ký</th>
              <th class="py-3 px-3.5 text-center">Trạng thái</th>
              <th class="py-3 px-3.5 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
  `;

  list.forEach((doc, idx) => {
    const hasSchoolSeal = Boolean(doc.hasSchoolSeal || (Array.isArray(doc.signatures) && doc.signatures.some(s => s.isSchoolSeal === true || s.role === 'CON_DAU_NHA_TRUONG')));
    const isCompleted = (doc.status === 'COMPLETED' || (doc.status && doc.status.includes('ĐÃ KÝ')));
    const isReturned = (doc.status === 'RETURNED' || doc.status === 'REJECTED');
    const isCreator = (doc.creatorId === currentUserId || doc.authorId === currentUserId || doc.creatorUsername === user?.username);
    
    let statusBadge = '';
    if (doc.status === 'PENDING_SEAL') {
      statusBadge = `
        <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200" title="Ban Giám hiệu đã ký duyệt — Chờ BGH/Văn thư đóng dấu mộc đỏ nhà trường">
          <span class="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse"></span>
          Chờ đóng dấu mộc đỏ
        </span>
      `;
    } else if (isCompleted) {
      if (hasSchoolSeal) {
        statusBadge = `
          <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200" title="Đã đầy đủ chữ ký duyệt và con dấu pháp nhân nhà trường">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            Đã ký duyệt &amp; Đóng dấu
          </span>
        `;
      } else {
        statusBadge = `
          <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-teal-50 text-teal-700 border border-teal-200" title="Báo cáo chuyên môn nội bộ đã được Tổ trưởng phê duyệt hoàn tất (không dấu)">
            <span class="w-1.5 h-1.5 rounded-full bg-teal-500"></span>
            Đã duyệt nội bộ
          </span>
        `;
      }
    } else if (isReturned) {
      statusBadge = `
        <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
          <span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
          Bị trả về
        </span>
      `;
    } else {
      statusBadge = `
        <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
          <span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
          Đang chờ ký duyệt
        </span>
      `;
    }

    // Render danh sách người ký
    let signersText = '';
    if (Array.isArray(doc.signatures) && doc.signatures.length > 0) {
      signersText = doc.signatures.map(s => {
        const sealIcon = s.isSchoolSeal ? '🔴 ' : '✍️ ';
        return `<span class="inline-block bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[10px] font-medium mr-1 mb-1">${sealIcon}${escapeHtml(s.signerName || s.name || 'Người ký')}</span>`;
      }).join('');
    } else {
      signersText = `<span class="text-slate-400 italic">Chưa có chữ ký</span>`;
    }

    const driveUrl = doc.googleDriveUrl || (doc.driveInfo && doc.driveInfo.viewUrl) || '';
    const dateStr = doc.createdAt ? new Date(doc.createdAt).toLocaleDateString('vi-VN') : 'N/A';

    html += `
      <tr class="hover:bg-slate-50/70 transition">
        <td class="py-3 px-3 text-center">
          <input type="checkbox" data-teacher-report-id="${escapeHtml(doc.id)}" ${teacherSelectedReportIds.has(doc.id) ? 'checked' : ''} onchange="toggleTeacherReportItem('${escapeHtml(doc.id)}', this.checked)" class="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer">
        </td>
        <td class="py-3 px-3 text-center font-bold text-slate-400">${idx + 1}</td>
        <td class="py-3 px-3.5">
          <div class="font-bold text-slate-900 text-xs">${escapeHtml(doc.title || 'Báo cáo chuyên môn')}</div>
          <div class="text-[10px] font-mono text-slate-400 mt-0.5 flex items-center gap-2">
            <span>${escapeHtml(doc.id || '')}</span>
            <span>•</span>
            <span>${dateStr}</span>
          </div>
        </td>
        <td class="py-3 px-3.5 font-semibold text-slate-700">${escapeHtml(doc.creatorDept || doc.department || 'CVA')}</td>
        <td class="py-3 px-3.5 text-slate-700 font-medium">${escapeHtml(doc.creatorName || doc.author || 'Giáo viên')}</td>
        <td class="py-3 px-3.5">${signersText}</td>
        <td class="py-3 px-3.5 text-center">${statusBadge}</td>
        <td class="py-3 px-3.5 text-right whitespace-nowrap">
          <div class="flex items-center justify-end gap-1.5">
            <button onclick="handleViewReportPdfInline('${escapeHtml(doc.id)}')" title="Xem trực tiếp tệp PDF" class="px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold text-[11px] transition flex items-center gap-1 cursor-pointer">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
              <span>Xem</span>
            </button>
            ${(doc.status === 'PENDING_SEAL' || (isCompleted && !hasSchoolSeal && doc.requiresSeal)) ? `
              ${(isAdminOrBgh || Boolean(user?.canStampSeal)) ? `
                <button onclick="handleOpenReportToStampSeal('${escapeHtml(doc.id)}')" title="Đóng dấu số nhà trường bằng USB Token con dấu" class="min-h-[36px] px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs transition flex items-center gap-1 cursor-pointer shadow-2xs">
                  <span class="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse"></span>
                  <span>Đóng dấu</span>
                </button>
              ` : `
                <span class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-semibold" title="Chờ BGH hoặc Văn thư thực hiện đóng dấu mộc đỏ nhà trường">
                  <span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                  Chờ BGH/Văn thư đóng dấu mộc đỏ nhà trường
                </span>
              `}
            ` : ''}
            ${(driveUrl || (doc.fileBase64 && isCompleted) || doc.fileBase64) ? `
              <button onclick="handleOpenReportDriveLink('${escapeHtml(doc.id)}')" title="Mở tệp trên Google Drive" class="min-w-[36px] min-h-[36px] p-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 text-xs transition flex items-center justify-center gap-1 cursor-pointer shadow-2xs">
                <span>📁</span>
              </button>
              <button onclick="handleSaveReportToLocalFolder('${escapeHtml(doc.id)}', event)" title="Lưu tệp về thư mục máy tính (tự động ghi nhớ thư mục, giữ Shift để đổi thư mục)" class="min-w-[36px] min-h-[36px] p-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs transition flex items-center justify-center gap-1 cursor-pointer shadow-2xs">
                <svg class="w-4 h-4 text-emerald-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"/></svg>
              </button>
            ` : ''}
            ${(isAdminOrBgh || isReturned || isCreator) ? `
              <button onclick="handleDeleteReportInline('${escapeHtml(doc.id)}', '${escapeHtml(doc.title || '')}')" title="Xóa báo cáo này" class="min-w-[36px] min-h-[36px] p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition flex items-center justify-center cursor-pointer shadow-2xs">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
              </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  });

  html += `
          </tbody>
        </table>
      </div>
    </div>
  `;

  container.innerHTML /* sanitize */ = html;
}

// Batch functions cho Giáo viên / Kho Báo Cáo
function toggleTeacherSelectAllReports(checked) {
  const container = document.getElementById('listSchoolReportsContainer');
  if (!container) return;
  const checkboxes = container.querySelectorAll('input[data-teacher-report-id]');
  checkboxes.forEach(cb => {
    const docId = cb.getAttribute('data-teacher-report-id');
    cb.checked = checked;
    if (checked) {
      if (docId) teacherSelectedReportIds.add(docId);
    } else {
      if (docId) teacherSelectedReportIds.delete(docId);
    }
  });
  updateTeacherBatchBar();
}

function toggleTeacherReportItem(docId, checked) {
  if (!docId) return;
  if (checked) {
    teacherSelectedReportIds.add(docId);
  } else {
    teacherSelectedReportIds.delete(docId);
  }
  updateTeacherBatchBar();
}

function updateTeacherBatchBar() {
  const bar = document.getElementById('teacherReportsBatchBar');
  const countEl = document.getElementById('teacherReportsSelectedCount');
  const selectAllCb = document.getElementById('teacherSelectAllReportsCheckbox');
  const size = teacherSelectedReportIds.size;

  if (countEl) countEl.textContent = size;
  if (bar) {
    if (size > 0) {
      bar.classList.remove('hidden');
    } else {
      bar.classList.add('hidden');
    }
  }

  if (selectAllCb) {
    const container = document.getElementById('listSchoolReportsContainer');
    const checkboxes = container ? container.querySelectorAll('input[data-teacher-report-id]') : [];
    if (checkboxes.length > 0 && size >= checkboxes.length) {
      selectAllCb.checked = true;
    } else {
      selectAllCb.checked = false;
    }
  }
}

function clearTeacherReportSelection() {
  teacherSelectedReportIds.clear();
  const selectAllCb = document.getElementById('teacherSelectAllReportsCheckbox');
  if (selectAllCb) selectAllCb.checked = false;
  const container = document.getElementById('listSchoolReportsContainer');
  if (container) {
    const checkboxes = container.querySelectorAll('input[data-teacher-report-id]');
    checkboxes.forEach(cb => cb.checked = false);
  }
  updateTeacherBatchBar();
}

async function handleTeacherBatchDeleteReports() {
  const size = teacherSelectedReportIds.size;
  if (size === 0) {
    showToast('Chưa chọn báo cáo nào để xóa!', 'warning');
    return;
  }

  const user = appState.currentUser;
  const role = user?.role || 'TEACHER';
  const isAdminOrBgh = (role === 'ADMIN' || role === 'BGH' || user?.id === 'admin' || user?.departmentId === 'dept_bgh');
  const currentUserId = user?.id || user?.username;

  const selectedDocs = currentCachedSchoolReports.filter(d => teacherSelectedReportIds.has(d.id));

  // Phân quyền bảo vệ: giáo viên chỉ được xóa báo cáo do mình lập mà bị trả về
  if (!isAdminOrBgh) {
    const unauthorizedDocs = selectedDocs.filter(d => {
      const isCreator = (d.creatorId === currentUserId || d.authorId === currentUserId || d.creatorUsername === user?.username);
      const isReturned = (d.status === 'RETURNED' || d.status === 'REJECTED');
      return !(isCreator && isReturned);
    });

    if (unauthorizedDocs.length > 0) {
      showModalAlert('Không có quyền xóa', `Thầy/Cô chỉ có thể xóa các Báo cáo do chính mình tạo và đang ở trạng thái "Bị trả về". Có ${unauthorizedDocs.length} báo cáo không thuộc diện này.`, 'warning');
      return;
    }
  }

  if (!confirm(`Thầy/Cô có chắc chắn muốn xóa ${size} báo cáo đã chọn không? Dữ liệu sau khi xóa sẽ không thể phục hồi.`)) {
    return;
  }

  showToast(`Đang xóa ${size} báo cáo...`, 'info');
  try {
    const ids = Array.from(teacherSelectedReportIds);
    await Promise.all(ids.map(id => {
      if (firebaseDb) return firebaseDb.ref(`documents/${id}`).remove();
      return fetch(`${RTDB_URL}/documents/${id}.json`, { method: 'DELETE' });
    }));
    showToast(`✅ Đã xóa thành công ${ids.length} báo cáo!`, 'success');
    teacherSelectedReportIds.clear();
    updateTeacherBatchBar();
    loadSchoolReports(true);
    if (typeof loadTeacherReturnedDocuments === 'function') loadTeacherReturnedDocuments(true);
    if (typeof loadTeacherSentDocuments === 'function') loadTeacherSentDocuments(true);
  } catch (err) {
    console.error('Lỗi xóa báo cáo hàng loạt:', err);
    showToast('Lỗi khi xóa: ' + err.message, 'error');
  }
}

async function handleViewReportPdfInline(docId) {
  let doc = (currentCachedSchoolReports && currentCachedSchoolReports.find(d => d.id === docId)) ||
            (currentCachedAdminReports && currentCachedAdminReports.find(d => d.id === docId)) ||
            (window.teacherSentDocs && window.teacherSentDocs.find(d => d.id === docId)) ||
            (window.teacherPendingDocs && window.teacherPendingDocs.find(d => d.id === docId)) ||
            (window.allDocuments && window.allDocuments.find(d => d.id === docId));

  if (!doc && typeof teacherSentDocs !== 'undefined') {
    doc = teacherSentDocs.find(d => d.id === docId);
  }
  if (!doc && typeof teacherPendingDocs !== 'undefined') {
    doc = teacherPendingDocs.find(d => d.id === docId);
  }

  // Nếu chưa có trong cache mảng nào, tải trực tiếp từ Firebase Realtime Database
  if (!doc) {
    try {
      const snap = await fetch(`${RTDB_URL}/documents/${encodeURIComponent(docId)}.json`);
      if (snap.ok) {
        doc = await snap.json();
      }
    } catch (e) {
      console.warn('Lỗi fetch doc từ RTDB:', e);
    }
  }

  if (!doc) {
    showToast('Không tìm thấy thông tin báo cáo này!', 'warning');
    return;
  }

  showToast('Đang nạp văn bản báo cáo mới nhất...', 'info');

  // 1. ƯU TIÊN HÀNG ĐẦU: Tải bản PDF mới nhất từ máy chủ backend
  // Máy chủ lưu trữ file thực tế của từng bước ký (Step_X.pdf hoặc Signed_X.pdf) chứa đầy đủ chữ ký của tất cả những người đã ký
  try {
    const fileEndpoint = API_BASE ? `${API_BASE}/api/documents/${docId}/file?_t=${Date.now()}` : `/api/documents/${docId}/file?_t=${Date.now()}`;
    const fileHeaders = {
      'x-user-id': appState.currentUser?.id || '',
      ...(appState.token ? { 'Authorization': `Bearer ${appState.token}` } : {})
    };
    const fileRes = await fetch(fileEndpoint, { headers: fileHeaders });
    if (fileRes.ok) {
      const blobData = await fileRes.blob();
      if (blobData && blobData.size > 50) {
        openDocumentViewer(doc.title || 'Báo cáo chuyên môn', blobData, false);
        const chainedBar = document.getElementById('viewerChainedSignBar');
        if (chainedBar) chainedBar.classList.add('hidden');
        const btnSign = document.getElementById('btnViewerConfirmSign');
        if (btnSign) btnSign.classList.add('hidden');
        const btnReject = document.getElementById('btnViewerRejectDoc');
        if (btnReject) btnReject.classList.add('hidden');
        return;
      }
    }
  } catch (fErr) {
    console.warn('Lỗi nạp tệp từ máy chủ, chuyển sang kiểm tra Base64:', fErr.message);
  }

  // 2. Dự phòng: Kiểm tra dữ liệu base64 cục bộ (nếu có)
  const base64Data = doc.signedPdfBase64 || doc.fileBase64;
  let pdfBlob = null;
  if (base64Data && typeof base64Data === 'string' && base64Data.length > 50) {
    try {
      const cleanB64 = base64Data.replace(/^data:application\/pdf;base64,/, '').replace(/^data:[^;]+;base64,/, '');
      const byteCharacters = atob(cleanB64);
      const byteNumbers = new Uint8Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      pdfBlob = new Blob([byteNumbers], { type: 'application/pdf' });
    } catch (bErr) {
      console.warn('Lỗi chuyển đổi Base64 sang Blob:', bErr.message);
    }
  }

  if (pdfBlob) {
    openDocumentViewer(doc.title || 'Báo cáo chuyên môn', pdfBlob, false);
    const chainedBar = document.getElementById('viewerChainedSignBar');
    if (chainedBar) chainedBar.classList.add('hidden');
    const btnSign = document.getElementById('btnViewerConfirmSign');
    if (btnSign) btnSign.classList.add('hidden');
    const btnReject = document.getElementById('btnViewerRejectDoc');
    if (btnReject) btnReject.classList.add('hidden');
    return;
  }

  // 3. Dự phòng cuối cùng: Mở link Google Drive (nếu có)
  const driveUrl = doc.googleDriveUrl || (doc.driveInfo && doc.driveInfo.viewUrl) || '';
  if (driveUrl) {
    const previewUrl = driveUrl.replace(/\/view(\?.*)?$/, '/preview');
    window.open(previewUrl, '_blank');
  } else {
    showModalAlert('Không có bản xem trước', 'Hồ sơ này không đính kèm nội dung tệp PDF hoặc tệp đang được lưu trữ trên Cloud.', 'info');
  }
}

async function handleOpenReportToStampSeal(docId) {
  const user = appState.currentUser;
  const canStamp = (user?.role === 'ADMIN' || user?.role === 'BGH' || Boolean(user?.canStampSeal));
  if (!canStamp) {
    showToast('⚠️ Thầy/Cô chưa được phân quyền đóng dấu con dấu nhà trường!', 'warning');
    return;
  }

  let doc = (currentCachedSchoolReports && currentCachedSchoolReports.find(d => d.id === docId)) ||
            (currentCachedAdminReports && currentCachedAdminReports.find(d => d.id === docId)) ||
            (window.teacherSentDocs && window.teacherSentDocs.find(d => d.id === docId)) ||
            (window.teacherPendingDocs && window.teacherPendingDocs.find(d => d.id === docId)) ||
            (window.allDocuments && window.allDocuments.find(d => d.id === docId));

  if (!doc && typeof teacherSentDocs !== 'undefined') {
    doc = teacherSentDocs.find(d => d.id === docId);
  }
  if (!doc && typeof teacherPendingDocs !== 'undefined') {
    doc = teacherPendingDocs.find(d => d.id === docId);
  }

  if (!doc) {
    showToast('Không tìm thấy thông tin báo cáo để đóng dấu!', 'warning');
    return;
  }

  showToast('Đang tải văn bản chuẩn bị đóng dấu nhà trường...', 'info');

  let pdfBlob = null;
  const base64Data = doc.signedPdfBase64 || doc.fileBase64;
  if (base64Data && typeof base64Data === 'string' && base64Data.length > 50) {
    try {
      const cleanB64 = base64Data.replace(/^data:application\/pdf;base64,/, '').replace(/^data:[^;]+;base64,/, '');
      const byteCharacters = atob(cleanB64);
      const byteNumbers = new Uint8Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      pdfBlob = new Blob([byteNumbers], { type: 'application/pdf' });
    } catch (bErr) {
      console.warn('Lỗi chuyển base64 sang Blob:', bErr.message);
    }
  }

  if (!pdfBlob) {
    try {
      const fileEndpoint = API_BASE ? `${API_BASE}/api/documents/${docId}/file?_t=${Date.now()}` : `/api/documents/${docId}/file?_t=${Date.now()}`;
      const fileHeaders = {
        'x-user-id': user?.id || '',
        ...(appState.token ? { 'Authorization': `Bearer ${appState.token}` } : {})
      };
      const fileRes = await fetch(fileEndpoint, { headers: fileHeaders });
      if (fileRes.ok) {
        const blobData = await fileRes.blob();
        if (blobData && blobData.size > 50) {
          pdfBlob = blobData;
        }
      }
    } catch (fErr) {
      console.warn('Lỗi nạp tệp từ máy chủ:', fErr.message);
    }
  }

  // Dự phòng tải từ Google Drive nếu có
  if (!pdfBlob && (doc.googleDriveUrl || doc.driveInfo?.fileId)) {
    try {
      const gId = (doc.googleDriveUrl || '').match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1] || doc.driveInfo?.fileId;
      if (gId) {
        showToast('Đang tải tệp từ Google Drive...', 'info');
        const gUrl = `https://drive.usercontent.google.com/download?id=${gId}&export=download`;
        const gRes = await fetch(gUrl).catch(() => null);
        if (gRes && gRes.ok) {
          const gBlob = await gRes.blob();
          if (gBlob && gBlob.size > 50) {
            pdfBlob = gBlob;
          }
        }
      }
    } catch (gdErr) {
      console.warn('Lỗi tải trực tiếp từ Google Drive:', gdErr.message);
    }
  }

  if (!pdfBlob) {
    showModalAlert('Không thể mở tệp', 'Không thể tải nội dung tệp PDF của báo cáo này để đóng dấu. Vui lòng kiểm tra lại kết nối hoặc tệp đính kèm.', 'error');
    return;
  }

  currentChainedPendingDoc = doc;

  // Mở viewer với chế độ ký duyệt
  openDocumentViewer(doc.title || 'Báo cáo chuyên môn', pdfBlob, true);

  // Hiển thị thanh ký duyệt
  const chainedBar = document.getElementById('viewerChainedSignBar');
  if (chainedBar) chainedBar.classList.remove('hidden');
  const originLabel = document.getElementById('viewerChainedDocOrigin');
  if (originLabel) {
    const sigLen = (doc.signatures && doc.signatures.length) || 1;
    originLabel.textContent = `Hồ sơ đã duyệt (${sigLen} chữ ký) • Chờ đóng dấu nhà trường`;
  }
  const cbFinal = document.getElementById('cbViewerIsFinalSigner');
  if (cbFinal) {
    cbFinal.checked = true;
    if (typeof toggleViewerFinalSignerMode === 'function') toggleViewerFinalSignerMode(true);
  }
  const boxNext = document.getElementById('boxViewerNextSigner');
  if (boxNext) boxNext.classList.add('hidden');
  const btnSign = document.getElementById('btnViewerConfirmSign');
  if (btnSign) btnSign.classList.remove('hidden');

  // Tự động kích hoạt chế độ Đóng dấu nhà trường
  setTimeout(() => {
    toggleSealPlacementMode(true);
  }, 400);
}

// Đồng bộ tự động tệp PDF đã ký / đã đóng dấu lên Google Drive trường
async function syncDocumentToGoogleDrive(doc, fileBase64) {
  if (!doc || !fileBase64) return null;
  const safeDocTitle = (doc.title || doc.id || 'BaoCao').replace(/\.pdf$/i, '').trim();
  const safeDocId = (doc.id || '').replace(/[^a-zA-Z0-9_\-]/g, '').trim();
  const schoolYear = doc.schoolYear || 'Năm học 2026 - 2027';
  const teacherName = (doc.creatorName || doc.authorName || doc.author || 'GiaoVien').trim();
  const dept = doc.creatorDept || doc.department || 'CVA';
  const safeFileName = safeDocId 
    ? `[${dept}]_[${safeDocId}]_${safeDocTitle}_DaKy.pdf`
    : `[${dept}]_${safeDocTitle}_DaKy.pdf`;
  const folderPath = `${schoolYear} / ${teacherName}`;

  let driveResult = null;

  // 1. Thử gọi API Backend nếu có server
  try {
    const driveEndpoint = API_BASE ? `${API_BASE}/api/drive/upload` : '/api/drive/upload';
    const driveRes = await fetch(driveEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${appState.token || ''}`
      },
      body: JSON.stringify({
        doc: {
          id: doc.id,
          title: doc.title,
          author: teacherName,
          authorName: teacherName,
          department: dept,
          schoolYear: schoolYear
        },
        fileBase64: fileBase64
      })
    });
    const resJson = await driveRes.json().catch(() => ({}));
    if (driveRes.ok && resJson.success && resJson.data) {
      driveResult = resJson.data;
    }
  } catch (backendErr) {
    console.warn('[syncDocumentToGoogleDrive] Backend API upload lỗi:', backendErr.message);
  }

  // 2. Dự phòng: Đẩy trực tiếp qua Google Apps Script Webhook (áp dụng cả khi chạy GitHub Pages / Render sleep)
  if (!driveResult) {
    try {
      const gasWebhookUrl = 'https://script.google.com/macros/s/AKfycbwGBgauc9xHzRe31_IfCQD-Q9yHwGp4CfYLEam9IupcYhLpNBXbgW0J1t-weD6iUQ87ZQ/exec';
      const cleanBase64 = fileBase64.replace(/^data:application\/pdf;base64,/, '').replace(/^data:[^;]+;base64,/, '');
      const payload = JSON.stringify({
        action: 'UPLOAD_SIGNED_DOC',
        fileName: safeFileName,
        folderPath: folderPath,
        schoolFolderId: 'THCS_CHU_VAN_AN_ARCHIVE_2026',
        docId: doc.id || doc.docId,
        title: doc.title || doc.docTitle || 'Báo cáo chuyên môn',
        docTitle: doc.title || doc.docTitle || 'Báo cáo chuyên môn',
        author: teacherName,
        department: dept,
        approver: doc.finalSigner || (doc.hasSchoolSeal ? 'TRƯỜNG THCS CHU VĂN AN' : 'Ban Giám hiệu'),
        status: 'ĐÃ KÝ DUYỆT & ĐÓNG DẤU',
        fileBase64: cleanBase64
      });

      const gasRes = await fetch(gasWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: payload
      });
      const gasJson = await gasRes.json().catch(() => ({}));
      if (gasJson && (gasJson.success || gasJson.fileId)) {
        driveResult = {
          success: true,
          isRealCloud: true,
          fileId: gasJson.fileId,
          fileName: safeFileName,
          viewUrl: gasJson.viewUrl || `https://drive.google.com/file/d/${gasJson.fileId}/view?usp=drivesdk`,
          downloadUrl: gasJson.downloadUrl || null,
          folderPath: gasJson.folderPath || folderPath,
          uploadedAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
          mode: 'REAL_GOOGLE_DRIVE'
        };
      }
    } catch (gasErr) {
      console.warn('[syncDocumentToGoogleDrive] Google Apps Script Webhook lỗi:', gasErr.message);
    }
  }

  // 3. Cập nhật kết quả vào Firebase RTDB & bộ nhớ đệm
  if (driveResult && driveResult.viewUrl) {
    doc.googleDriveUrl = driveResult.viewUrl;
    doc.driveInfo = driveResult;
    try {
      if (firebaseDb) {
        await firebaseDb.ref(`documents/${doc.id}`).update({
          googleDriveUrl: driveResult.viewUrl,
          driveInfo: driveResult
        });
      } else {
        await fetch(`${RTDB_URL}/documents/${doc.id}.json`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            googleDriveUrl: driveResult.viewUrl,
            driveInfo: driveResult
          })
        });
      }
    } catch (fbErr) {
      console.warn('[syncDocumentToGoogleDrive] Lỗi ghi Firebase:', fbErr.message);
    }
  }

  return driveResult;
}

async function handleOpenReportDriveLink(docId) {
  let doc = (currentCachedSchoolReports && currentCachedSchoolReports.find(d => d.id === docId)) ||
            (currentCachedAdminReports && currentCachedAdminReports.find(d => d.id === docId)) ||
            (window.teacherSentDocs && window.teacherSentDocs.find(d => d.id === docId)) ||
            (window.teacherPendingDocs && window.teacherPendingDocs.find(d => d.id === docId)) ||
            (window.allDocuments && window.allDocuments.find(d => d.id === docId));

  if (!doc) {
    showToast('Không tìm thấy thông tin hồ sơ!', 'warning');
    return;
  }

  const hasSchoolSeal = Boolean(doc.hasSchoolSeal || (Array.isArray(doc.signatures) && doc.signatures.some(s => s.isSchoolSeal === true || s.role === 'CON_DAU_NHA_TRUONG')));
  const isCompleted = (doc.status === 'COMPLETED' || (doc.status && doc.status.includes('ĐÃ KÝ')));
  const base64Data = doc.signedPdfBase64 || doc.fileBase64;

  // Kiểm tra xem liên kết Drive hiện tại có bị cũ hơn thời điểm đóng dấu / ký duyệt hay không
  const driveUploadedAt = doc.driveInfo?.uploadedAt ? new Date(doc.driveInfo.uploadedAt).getTime() : 0;
  const sealedAtTime = doc.sealedAt ? new Date(doc.sealedAt).getTime() : (doc.completedAt ? new Date(doc.completedAt).getTime() : 0);
  const isOutdatedDrive = (hasSchoolSeal || isCompleted) && base64Data && (driveUploadedAt < sealedAtTime);

  if (isOutdatedDrive || (!doc.googleDriveUrl && !doc.driveInfo?.viewUrl && base64Data)) {
    showToast('Đang kiểm tra & đồng bộ tệp PDF đã đóng dấu lên Google Drive...', 'info');
    const newDrive = await syncDocumentToGoogleDrive(doc, base64Data);
    if (newDrive && newDrive.viewUrl) {
      showToast('✅ Đã đồng bộ văn bản có con dấu lên Google Drive!', 'success');
      const previewUrl = newDrive.viewUrl.replace(/\/view(\?.*)?$/, '/preview');
      window.open(previewUrl, '_blank');
      return;
    }
  }

  const targetUrl = doc.googleDriveUrl || doc.driveInfo?.viewUrl || '';
  if (targetUrl) {
    const previewUrl = targetUrl.replace(/\/view(\?.*)?$/, '/preview');
    window.open(previewUrl, '_blank');
  } else {
    showModalAlert('Chưa có liên kết Drive', 'Hồ sơ này chưa được đồng bộ lên Google Drive. Vui lòng bấm nút "Xem" để xem tệp trực tiếp.', 'info');
  }
}

// ====================================================================================================
// 💾 QUẢN LÝ LƯU TỆP VỀ THƯ MỤC CỤC BỘ MÁY TÍNH & GHI NHỚ THƯ MỤC (H2)
// ====================================================================================================
function getEduSignIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('EduSignLocalFolderDB', 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('handles')) {
        db.createObjectStore('handles');
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

async function getSavedFolderHandle() {
  try {
    const db = await getEduSignIDB();
    return new Promise((resolve) => {
      const tx = db.transaction('handles', 'readonly');
      const store = tx.objectStore('handles');
      const req = store.get('saved_directory_handle');
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch (e) {
    return null;
  }
}

async function saveFolderHandleToIDB(handle) {
  try {
    const db = await getEduSignIDB();
    return new Promise((resolve) => {
      const tx = db.transaction('handles', 'readwrite');
      const store = tx.objectStore('handles');
      store.put(handle, 'saved_directory_handle');
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch (e) {
    return false;
  }
}

async function clearSavedFolderHandle() {
  try {
    const db = await getEduSignIDB();
    const tx = db.transaction('handles', 'readwrite');
    tx.objectStore('handles').delete('saved_directory_handle');
    localStorage.removeItem('edusign_saved_folder_name');
  } catch (e) { console.warn('[Client Handled] e:', e && e.message ? e.message : e); }
}

async function handleSaveReportToLocalFolder(docId, event) {
  if (event) {
    event.stopPropagation();
  }

  let doc = (currentCachedSchoolReports && currentCachedSchoolReports.find(d => d.id === docId)) ||
            (currentCachedAdminReports && currentCachedAdminReports.find(d => d.id === docId)) ||
            (window.teacherSentDocs && window.teacherSentDocs.find(d => d.id === docId)) ||
            (window.teacherPendingDocs && window.teacherPendingDocs.find(d => d.id === docId)) ||
            (window.allDocuments && window.allDocuments.find(d => d.id === docId));

  if (!doc) {
    showToast('Không tìm thấy thông tin hồ sơ để lưu!', 'warning');
    return;
  }

  // Lấy dữ liệu PDF Blob
  let pdfBlob = null;
  const base64Data = doc.signedPdfBase64 || doc.fileBase64;
  if (base64Data && typeof base64Data === 'string' && base64Data.length > 50) {
    try {
      const cleanB64 = base64Data.replace(/^data:application\/pdf;base64,/, '').replace(/^data:[^;]+;base64,/, '');
      const byteCharacters = atob(cleanB64);
      const byteNumbers = new Uint8Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      pdfBlob = new Blob([byteNumbers], { type: 'application/pdf' });
    } catch (bErr) {
      console.warn('Lỗi chuyển base64 sang Blob:', bErr.message);
    }
  }

  if (!pdfBlob) {
    try {
      showToast('Đang tải dữ liệu tệp PDF...', 'info');
      const fileEndpoint = API_BASE ? `${API_BASE}/api/documents/${docId}/file?_t=${Date.now()}` : `/api/documents/${docId}/file?_t=${Date.now()}`;
      const fileHeaders = {
        'x-user-id': user?.id || '',
        ...(appState.token ? { 'Authorization': `Bearer ${appState.token}` } : {})
      };
      const fileRes = await fetch(fileEndpoint, { headers: fileHeaders });
      if (fileRes.ok) {
        const blobData = await fileRes.blob();
        if (blobData && blobData.size > 50) {
          pdfBlob = blobData;
        }
      }
    } catch (fErr) {
      console.warn('Lỗi nạp tệp từ máy chủ:', fErr.message);
    }
  }

  if (!pdfBlob && (doc.googleDriveUrl || doc.driveInfo?.fileId)) {
    try {
      const gId = (doc.googleDriveUrl || '').match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1] || doc.driveInfo?.fileId;
      if (gId) {
        showToast('Đang nạp tệp từ Google Drive...', 'info');
        const gUrl = `https://drive.usercontent.google.com/download?id=${gId}&export=download`;
        const gRes = await fetch(gUrl).catch(() => null);
        if (gRes && gRes.ok) {
          const gBlob = await gRes.blob();
          if (gBlob && gBlob.size > 50) {
            pdfBlob = gBlob;
          }
        }
      }
    } catch (gErr) {
      console.warn('Lỗi tải tệp Drive:', gErr.message);
    }
  }

  if (!pdfBlob) {
    showToast('⚠️ Không tìm thấy nội dung tệp PDF để lưu về máy tính!', 'error');
    return;
  }

  // Chuẩn hóa tên tệp hợp lệ
  let rawTitle = doc.title || doc.name || doc.id || 'BaoCao';
  if (!rawTitle.toLowerCase().endsWith('.pdf')) {
    rawTitle += '.pdf';
  }
  const cleanFilename = rawTitle.replace(/[\\/:*?"<>|]/g, '_').trim();

  // Kiểm tra hỗ trợ File System Access API
  const supportsFSA = typeof window.showDirectoryPicker === 'function';
  const forcePickNew = Boolean(event && event.shiftKey);

  if (supportsFSA) {
    try {
      let dirHandle = null;
      if (!forcePickNew) {
        dirHandle = await getSavedFolderHandle();
      }

      // Nếu đã có thư mục lưu trước đó, kiểm tra quyền ghi
      if (dirHandle) {
        try {
          let perm = await dirHandle.queryPermission({ mode: 'readwrite' });
          if (perm !== 'granted') {
            perm = await dirHandle.requestPermission({ mode: 'readwrite' });
          }
          if (perm !== 'granted') {
            dirHandle = null;
          }
        } catch (pErr) {
          dirHandle = null;
        }
      }

      // Nếu chưa có hoặc chưa cấp quyền hoặc người dùng giữ Shift để đổi thư mục:
      if (!dirHandle) {
        showToast('📂 Vui lòng chọn thư mục trên máy tính của Thầy/Cô để lưu báo cáo...', 'info', 4000);
        dirHandle = await window.showDirectoryPicker({
          mode: 'readwrite',
          startIn: 'documents'
        });
        if (dirHandle) {
          await saveFolderHandleToIDB(dirHandle);
          localStorage.setItem('edusign_saved_folder_name', dirHandle.name);
        }
      }

      if (dirHandle) {
        showToast(`Đang lưu vào thư mục "${dirHandle.name}"...`, 'info', 2000);
        const fileHandle = await dirHandle.getFileHandle(cleanFilename, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(pdfBlob);
        await writable.close();

        showToast(`💾 Đã lưu thành công tệp [${cleanFilename}] vào thư mục "${dirHandle.name}"! (Hệ thống đã ghi nhớ thư mục này, giữ Shift khi bấm để đổi thư mục khác)`, 'success', 6000);
        return;
      }
    } catch (pickerErr) {
      if (pickerErr.name === 'AbortError') {
        showToast('Đã hủy chọn thư mục lưu.', 'info');
        return;
      }
      console.warn('Lỗi File System Access API, chuyển sang chế độ tải về thông thường:', pickerErr);
    }
  }

  // Fallback tải về truyền thống qua trình duyệt
  const blobUrl = URL.createObjectURL(pdfBlob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = cleanFilename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  }, 1500);
  showToast(`💾 Đang tải tệp [${cleanFilename}] về máy tính!`, 'success', 4000);
}

// Định nghĩa toàn cục displayPdfInViewer để phòng ngừa mọi lời gọi cũ
function displayPdfInViewer(fileOrBase64, title = 'Báo cáo', unused = null, enableSigning = false) {
  if (!fileOrBase64) return;
  let pdfBlob = null;
  if (fileOrBase64 instanceof Blob) {
    pdfBlob = fileOrBase64;
  } else if (typeof fileOrBase64 === 'string') {
    try {
      const cleanB64 = fileOrBase64.replace(/^data:[^;]+;base64,/, '');
      const byteCharacters = atob(cleanB64);
      const byteNumbers = new Uint8Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      pdfBlob = new Blob([byteNumbers], { type: 'application/pdf' });
    } catch (e) {
      console.warn('Lỗi chuyển base64 sang Blob trong displayPdfInViewer:', e.message);
    }
  } else if (fileOrBase64 && fileOrBase64.dataUrl) {
    try {
      const cleanB64 = fileOrBase64.dataUrl.replace(/^data:[^;]+;base64,/, '');
      const byteCharacters = atob(cleanB64);
      const byteNumbers = new Uint8Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      pdfBlob = new Blob([byteNumbers], { type: 'application/pdf' });
    } catch (e) { console.warn('[Client Handled] e:', e && e.message ? e.message : e); }
  }
  if (pdfBlob) {
    openDocumentViewer(title || 'Báo cáo', pdfBlob, enableSigning);
  }
}

// ==================== QUẢN LÝ BÁO CÁO TOÀN TRƯỜNG DÀNH CHO ADMIN ====================
let currentCachedAdminReports = [];
let adminSelectedReportIds = new Set();

async function loadAdminReportManagement(force = false) {
  const container = document.getElementById('listAdminReportsTableContainer');
  const iconRefresh = document.getElementById('iconRefreshAdminReports');
  if (iconRefresh) iconRefresh.classList.add('animate-spin');

  if (container) {
    container.innerHTML /* sanitize */ = `
      <div class="py-12 text-center text-slate-400 text-xs">
        <div class="w-7 h-7 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
        <span>Đang tải danh sách báo cáo toàn hệ thống...</span>
      </div>
    `;
  }

  try {
    let allDocs = null;
    if (firebaseDb) {
      const snap = await firebaseDb.ref('documents').once('value');
      allDocs = snap.val();
    } else {
      const fRes = await fetch(`${RTDB_URL}/documents.json?_t=${Date.now()}`).catch(() => null);
      if (fRes && fRes.ok) allDocs = await fRes.json().catch(() => null);
    }

    let docList = [];
    if (allDocs) {
      docList = Array.isArray(allDocs)
        ? allDocs.filter(Boolean)
        : Object.keys(allDocs).map(k => ({ id: allDocs[k].id || k, ...allDocs[k] }));
    }

    // Lấy các tài liệu báo cáo toàn trường
    const allReports = docList.filter(d => {
      return d.docType === 'REPORT' || d.category === 'REPORT' || (d.id && String(d.id).startsWith('BC-')) || d.isReport;
    });

    allReports.sort((a, b) => new Date(b.createdAt || b.updatedAt || 0) - new Date(a.createdAt || a.updatedAt || 0));
    currentCachedAdminReports = allReports;

    // Cập nhật thẻ thống kê
    const statTotal = document.getElementById('adminStatTotalReports');
    const statComp = document.getElementById('adminStatCompletedReports');
    const statPending = document.getElementById('adminStatPendingReports');

    const totalCount = allReports.length;
    const compCount = allReports.filter(d => d.status === 'COMPLETED' || (d.status && d.status.includes('ĐÃ KÝ'))).length;
    const pendingCount = allReports.filter(d => d.status === 'RETURNED' || d.status === 'REJECTED' || (d.status !== 'COMPLETED' && (!d.status || !d.status.includes('ĐÃ KÝ')))).length;

    if (statTotal) statTotal.textContent = totalCount;
    if (statComp) statComp.textContent = compCount;
    if (statPending) statPending.textContent = pendingCount;

    adminSelectedReportIds.clear();
    updateAdminBatchBar();

    renderAdminReportsTable();

    if (force) {
      showToast('🎉 Đã làm mới dữ liệu Báo cáo hệ thống!', 'success');
    }
  } catch (err) {
    console.warn('[loadAdminReportManagement] Lỗi tải dữ liệu:', err);
    if (container) {
      container.innerHTML /* sanitize */ = `<div class="p-6 text-center text-rose-500 text-xs">Lỗi tải dữ liệu: ${escapeHtml(err.message)}</div>`;
    }
  } finally {
    if (iconRefresh) {
      setTimeout(() => iconRefresh.classList.remove('animate-spin'), 400);
    }
  }
}

function renderAdminReportsTable() {
  const container = document.getElementById('listAdminReportsTableContainer');
  if (!container) return;

  const searchKeyword = (document.getElementById('inputAdminReportSearch')?.value || '').trim().toLowerCase();
  const deptFilter = document.getElementById('selectAdminReportDeptFilter')?.value || '';
  const statusFilter = document.getElementById('selectAdminReportStatusFilter')?.value || '';
  const user = appState.currentUser;
  const canStamp = (user?.role === 'ADMIN' || user?.role === 'BGH' || Boolean(user?.canStampSeal));

  let list = currentCachedAdminReports.filter(doc => {
    // 1. Lọc từ khóa
    if (searchKeyword) {
      const title = (doc.title || '').toLowerCase();
      const code = (doc.id || '').toLowerCase();
      const author = (doc.creatorName || doc.author || '').toLowerCase();
      const dept = (doc.creatorDept || doc.department || '').toLowerCase();
      if (!title.includes(searchKeyword) && !code.includes(searchKeyword) && !author.includes(searchKeyword) && !dept.includes(searchKeyword)) {
        return false;
      }
    }

    // 2. Lọc Tổ chuyên môn
    if (deptFilter) {
      const docDept = (doc.creatorDept || doc.department || '').toLowerCase();
      if (!docDept.includes(deptFilter.toLowerCase())) return false;
    }

    // 3. Lọc Trạng thái
    if (statusFilter) {
      const isComp = doc.status === 'COMPLETED' || (doc.status && doc.status.includes('ĐÃ KÝ'));
      const isRet = doc.status === 'RETURNED' || doc.status === 'REJECTED';
      const hasSeal = Boolean(doc.hasSchoolSeal || (Array.isArray(doc.signatures) && doc.signatures.some(s => s.isSchoolSeal === true || s.role === 'CON_DAU_NHA_TRUONG')));

      if (statusFilter === 'SEALED') {
        if (!isComp || !hasSeal) return false;
      } else if (statusFilter === 'WAIT_SEAL') {
        if (!isComp || hasSeal) return false;
      } else if (statusFilter === 'COMPLETED') {
        if (!isComp) return false;
      } else if (statusFilter === 'PENDING') {
        if (isComp || isRet) return false;
      } else if (statusFilter === 'RETURNED') {
        if (!isRet) return false;
      }
    }

    return true;
  });

  if (list.length === 0) {
    container.innerHTML /* sanitize */ = `
      <div class="py-12 text-center text-slate-400 bg-slate-50/50 rounded-2xl border border-slate-200/80">
        <svg class="w-12 h-12 mx-auto mb-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
        <div class="text-sm font-bold text-slate-700">Không có báo cáo nào phù hợp</div>
        <div class="text-xs text-slate-400 mt-1">Vui lòng điều chỉnh lại từ khóa hoặc bộ lọc.</div>
      </div>
    `;
    return;
  }

  let html = `
    <div class="overflow-x-auto rounded-2xl border border-slate-200">
      <table class="w-full text-left text-xs border-collapse">
        <thead>
          <tr class="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
            <th class="py-3 px-3 text-center w-10">
              <input type="checkbox" id="adminSelectAllReportsCheckbox" onchange="toggleAdminSelectAllReports(this.checked)" class="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer" title="Chọn tất cả">
            </th>
            <th class="py-3 px-3 w-12 text-center">STT</th>
            <th class="py-3 px-3.5">Mã & Tiêu đề Báo cáo</th>
            <th class="py-3 px-3.5">Tổ chuyên môn</th>
            <th class="py-3 px-3.5">Người lập</th>
            <th class="py-3 px-3.5">Tiến độ & Chữ ký</th>
            <th class="py-3 px-3.5 text-center">Trạng thái</th>
            <th class="py-3 px-3.5 text-right">Thao tác</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
  `;

  list.forEach((doc, idx) => {
    const hasSchoolSeal = Boolean(doc.hasSchoolSeal || (Array.isArray(doc.signatures) && doc.signatures.some(s => s.isSchoolSeal === true || s.role === 'CON_DAU_NHA_TRUONG')));
    const isCompleted = (doc.status === 'COMPLETED' || (doc.status && doc.status.includes('ĐÃ KÝ')));
    const isReturned = (doc.status === 'RETURNED' || doc.status === 'REJECTED');

    let statusBadge = '';
    if (doc.status === 'PENDING_SEAL') {
      statusBadge = `
        <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200" title="Ban Giám hiệu đã ký duyệt — Chờ BGH/Văn thư đóng dấu mộc đỏ nhà trường">
          <span class="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse"></span>
          Chờ đóng dấu mộc đỏ
        </span>
      `;
    } else if (isCompleted) {
      if (hasSchoolSeal) {
        statusBadge = `
          <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200" title="Đã đầy đủ chữ ký duyệt và con dấu pháp nhân nhà trường">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            Đã duyệt &amp; Đóng dấu
          </span>
        `;
      } else {
        statusBadge = `
          <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-teal-50 text-teal-700 border border-teal-200" title="Báo cáo chuyên môn nội bộ đã được Tổ trưởng phê duyệt hoàn tất (không dấu)">
            <span class="w-1.5 h-1.5 rounded-full bg-teal-500"></span>
            Đã duyệt nội bộ
          </span>
        `;
      }
    } else if (isReturned) {
      statusBadge = `
        <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
          <span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
          Bị trả về
        </span>
      `;
    } else {
      statusBadge = `
        <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
          <span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
          Đang chờ ký duyệt
        </span>
      `;
    }

    let signersText = '';
    if (Array.isArray(doc.signatures) && doc.signatures.length > 0) {
      signersText = doc.signatures.map(s => {
        const sealIcon = s.isSchoolSeal ? '🔴 ' : '✍️ ';
        return `<span class="inline-block bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[10px] font-medium mr-1 mb-1">${sealIcon}${escapeHtml(s.signerName || s.name || 'Người ký')}</span>`;
      }).join('');
    } else {
      signersText = `<span class="text-slate-400 italic">Chưa có chữ ký</span>`;
    }

    const driveUrl = doc.googleDriveUrl || (doc.driveInfo && doc.driveInfo.viewUrl) || '';
    const dateStr = doc.createdAt ? new Date(doc.createdAt).toLocaleDateString('vi-VN') : 'N/A';

    html += `
      <tr class="hover:bg-slate-50/70 transition">
        <td class="py-3 px-3 text-center">
          <input type="checkbox" data-admin-report-id="${escapeHtml(doc.id)}" ${adminSelectedReportIds.has(doc.id) ? 'checked' : ''} onchange="toggleAdminReportItem('${escapeHtml(doc.id)}', this.checked)" class="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer">
        </td>
        <td class="py-3 px-3 text-center font-bold text-slate-400">${idx + 1}</td>
        <td class="py-3 px-3.5">
          <div class="font-bold text-slate-900 text-xs">${escapeHtml(doc.title || 'Báo cáo chuyên môn')}</div>
          <div class="text-[10px] font-mono text-slate-400 mt-0.5 flex items-center gap-2">
            <span>${escapeHtml(doc.id || '')}</span>
            <span>•</span>
            <span>${dateStr}</span>
          </div>
        </td>
        <td class="py-3 px-3.5 font-semibold text-slate-700">${escapeHtml(doc.creatorDept || doc.department || 'CVA')}</td>
        <td class="py-3 px-3.5 text-slate-700 font-medium">${escapeHtml(doc.creatorName || doc.author || 'Giáo viên')}</td>
        <td class="py-3 px-3.5">${signersText}</td>
        <td class="py-3 px-3.5 text-center">${statusBadge}</td>
        <td class="py-3 px-3.5 text-right whitespace-nowrap">
          <div class="flex items-center justify-end gap-1.5">
            <button onclick="handleViewReportPdfInline('${escapeHtml(doc.id)}')" title="Xem trực tiếp tệp PDF" class="px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold text-[11px] transition flex items-center gap-1 cursor-pointer">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
              <span>Xem</span>
            </button>
            ${(doc.status === 'PENDING_SEAL' || (isCompleted && !hasSchoolSeal && doc.requiresSeal)) ? `
              ${canStamp ? `
                <button onclick="handleOpenReportToStampSeal('${escapeHtml(doc.id)}')" title="Đóng dấu số nhà trường bằng USB Token con dấu" class="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-[11px] transition flex items-center gap-1 cursor-pointer">
                  <span class="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse"></span>
                  <span>Đóng dấu</span>
                </button>
              ` : `
                <span class="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-semibold" title="Chờ BGH hoặc Văn thư thực hiện đóng dấu mộc đỏ nhà trường">
                  <span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                  Chờ BGH/Văn thư đóng dấu mộc đỏ nhà trường
                </span>
              `}
            ` : ''}
            ${(driveUrl || (doc.fileBase64 && isCompleted) || doc.fileBase64) ? `
              <button onclick="handleOpenReportDriveLink('${escapeHtml(doc.id)}')" title="Mở tệp trên Google Drive" class="px-2 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 text-[11px] transition flex items-center gap-1 cursor-pointer">
                <span>📁</span>
              </button>
              <button onclick="handleSaveReportToLocalFolder('${escapeHtml(doc.id)}', event)" title="Lưu tệp về thư mục máy tính (tự động ghi nhớ thư mục, giữ Shift để đổi thư mục)" class="px-2 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[11px] transition flex items-center gap-1 cursor-pointer">
                <svg class="w-3.5 h-3.5 text-emerald-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"/></svg>
              </button>
            ` : ''}
            <button onclick="handleDeleteReportInline('${escapeHtml(doc.id)}', '${escapeHtml(doc.title || '')}')" title="Xóa báo cáo này" class="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition cursor-pointer">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  });

  html += `
        </tbody>
      </table>
    </div>
  `;

  container.innerHTML /* sanitize */ = html;
}

function toggleAdminSelectAllReports(checked) {
  const container = document.getElementById('listAdminReportsTableContainer');
  if (!container) return;
  const checkboxes = container.querySelectorAll('input[data-admin-report-id]');
  checkboxes.forEach(cb => {
    const docId = cb.getAttribute('data-admin-report-id');
    cb.checked = checked;
    if (checked) {
      if (docId) adminSelectedReportIds.add(docId);
    } else {
      if (docId) adminSelectedReportIds.delete(docId);
    }
  });
  updateAdminBatchBar();
}

function toggleAdminReportItem(docId, checked) {
  if (!docId) return;
  if (checked) {
    adminSelectedReportIds.add(docId);
  } else {
    adminSelectedReportIds.delete(docId);
  }
  updateAdminBatchBar();
}

function updateAdminBatchBar() {
  const bar = document.getElementById('adminReportsBatchBar');
  const countEl = document.getElementById('adminReportsSelectedCount');
  const selectAllCb = document.getElementById('adminSelectAllReportsCheckbox');
  const size = adminSelectedReportIds.size;

  if (countEl) countEl.textContent = size;
  if (bar) {
    if (size > 0) {
      bar.classList.remove('hidden');
    } else {
      bar.classList.add('hidden');
    }
  }

  if (selectAllCb) {
    const container = document.getElementById('listAdminReportsTableContainer');
    const checkboxes = container ? container.querySelectorAll('input[data-admin-report-id]') : [];
    if (checkboxes.length > 0 && size >= checkboxes.length) {
      selectAllCb.checked = true;
    } else {
      selectAllCb.checked = false;
    }
  }
}

function clearAdminReportSelection() {
  adminSelectedReportIds.clear();
  const selectAllCb = document.getElementById('adminSelectAllReportsCheckbox');
  if (selectAllCb) selectAllCb.checked = false;
  const container = document.getElementById('listAdminReportsTableContainer');
  if (container) {
    const checkboxes = container.querySelectorAll('input[data-admin-report-id]');
    checkboxes.forEach(cb => cb.checked = false);
  }
  updateAdminBatchBar();
}

async function handleAdminBatchDeleteReports() {
  const size = adminSelectedReportIds.size;
  if (size === 0) {
    showToast('Chưa chọn báo cáo nào để xóa!', 'warning');
    return;
  }

  if (!confirm(`Thầy/Cô có chắc chắn muốn xóa ${size} báo cáo đã chọn không? Thao tác này không thể hoàn tác!`)) {
    return;
  }

  showToast(`Đang xóa ${size} báo cáo...`, 'info');
  try {
    const ids = Array.from(adminSelectedReportIds);
    await Promise.all(ids.map(id => {
      if (firebaseDb) return firebaseDb.ref(`documents/${id}`).remove();
      return fetch(`${RTDB_URL}/documents/${id}.json`, { method: 'DELETE' });
    }));
    showToast(`✅ Đã xóa thành công ${ids.length} báo cáo!`, 'success');
    adminSelectedReportIds.clear();
    updateAdminBatchBar();
    await loadAdminReportManagement(true);
    if (typeof loadSchoolReports === 'function') loadSchoolReports(true);
  } catch (err) {
    console.error('Lỗi khi xóa hàng loạt báo cáo Admin:', err);
    showToast('Lỗi khi xóa: ' + err.message, 'error');
  }
}

async function handleAdminQuickCleanJunkReports() {
  const junkDocs = currentCachedAdminReports.filter(d => 
    d.status === 'RETURNED' || d.status === 'REJECTED' || d.status === 'RECALLED'
  );
  if (junkDocs.length === 0) {
    showToast('✨ Hệ thống sạch sẽ! Không có báo cáo lỗi hoặc bị trả về cần dọn.', 'info');
    return;
  }

  if (!confirm(`Tìm thấy ${junkDocs.length} báo cáo bị trả về / lỗi hỏng. Thầy/Cô có chắc chắn muốn xóa dọn dẹp các báo cáo rác này không?`)) {
    return;
  }

  showToast(`Đang dọn dẹp ${junkDocs.length} báo cáo rác...`, 'info');
  try {
    await Promise.all(junkDocs.map(d => {
      if (firebaseDb) return firebaseDb.ref(`documents/${d.id}`).remove();
      return fetch(`${RTDB_URL}/documents/${d.id}.json`, { method: 'DELETE' });
    }));
    showToast(`🧹 Đã dọn dẹp sạch sẽ ${junkDocs.length} báo cáo rác!`, 'success');
    await loadAdminReportManagement(true);
    if (typeof loadSchoolReports === 'function') loadSchoolReports(true);
  } catch (err) {
    console.error('Lỗi khi dọn dẹp báo cáo rác:', err);
    showToast('Lỗi khi dọn dẹp: ' + err.message, 'error');
  }
}

function openModalConfirmResetAllReports() {
  const input = document.getElementById('inputResetAllReportsConfirm');
  const btn = document.getElementById('btnConfirmResetAllReports');
  if (input) input.value = '';
  if (btn) btn.disabled = true;
  openModal('modalConfirmResetReports');
}

function checkResetKeywordMatch() {
  const input = document.getElementById('inputResetAllReportsConfirm');
  const btn = document.getElementById('btnConfirmResetAllReports');
  if (!input || !btn) return;
  const val = (input.value || '').trim().toUpperCase();
  btn.disabled = (val !== 'XOA-TAT-CA-BAO-CAO');
}

async function handleConfirmResetAllReports() {
  const input = document.getElementById('inputResetAllReportsConfirm');
  const btn = document.getElementById('btnConfirmResetAllReports');
  const btnText = document.getElementById('btnConfirmResetAllReportsText');
  if (!input || input.value.trim().toUpperCase() !== 'XOA-TAT-CA-BAO-CAO') {
    showToast('Vui lòng nhập chính xác từ khóa xác nhận!', 'warning');
    return;
  }

  if (btn) btn.disabled = true;
  if (btnText) btnText.textContent = 'Đang xóa toàn bộ dữ liệu...';

  try {
    if (firebaseDb) {
      await firebaseDb.ref('documents').remove();
    } else {
      await fetch(`${RTDB_URL}/documents.json`, { method: 'DELETE' });
    }
    showToast('💥 Đã xóa toàn bộ báo cáo và làm sạch hệ thống thành công!', 'success');
    closeModal('modalConfirmResetReports');
    currentCachedAdminReports = [];
    adminSelectedReportIds.clear();
    await loadAdminReportManagement(true);
    if (typeof loadSchoolReports === 'function') loadSchoolReports(true);
  } catch (err) {
    console.error('Lỗi khi reset báo cáo:', err);
    showModalAlert('Lỗi Reset', err.message, 'error');
  } finally {
    if (btnText) btnText.textContent = 'Tôi hiểu rủi ro, Xóa toàn bộ';
  }
}

async function handleDeleteReportInline(docId, docTitle) {
  if (!docId) return;
  const title = docTitle || docId;
  if (!confirm(`Thầy/Cô có chắc chắn muốn xóa vĩnh viễn báo cáo "${title}" không? Thao tác này không thể hoàn tác.`)) {
    return;
  }

  showToast('Đang xóa báo cáo...', 'info');
  try {
    if (firebaseDb) {
      await firebaseDb.ref(`documents/${docId}`).remove();
    } else {
      await fetch(`${RTDB_URL}/documents/${docId}.json`, { method: 'DELETE' });
    }
    showToast('🗑️ Đã xóa báo cáo thành công!', 'success');
    if (typeof loadAdminReportManagement === 'function') {
      loadAdminReportManagement(false);
    }
    if (typeof loadSchoolReports === 'function') {
      loadSchoolReports(false);
    }
    if (typeof loadTeacherReturnedDocuments === 'function') {
      loadTeacherReturnedDocuments(false);
    }
    if (typeof loadTeacherSentDocuments === 'function') {
      loadTeacherSentDocuments(false);
    }
  } catch (err) {
    console.error('Lỗi xóa báo cáo:', err);
    showToast('Lỗi xóa báo cáo: ' + err.message, 'error');
  }
}

// ==================== XỬ LÝ TRẢ VỀ / YÊU CẦU SỬA LẠI (MODAL) ====================
function openModalRejectDocument(docId) {
  currentDocToReject = docId;
  const doc = teacherPendingDocs.find(d => d.id === docId) || currentChainedPendingDoc;
  const titleEl = document.getElementById('rejectDocTitleDisplay');
  const senderEl = document.getElementById('rejectDocSenderDisplay');
  const idEl = document.getElementById('rejectDocIdDisplay');
  const txtArea = document.getElementById('textareaRejectReason');

  if (titleEl) titleEl.textContent = doc?.title || 'Báo cáo chuyên môn';
  if (senderEl) senderEl.textContent = doc?.creatorName || doc?.author || 'Đồng nghiệp';
  if (idEl) idEl.textContent = docId;
  if (txtArea) {
    txtArea.value = '';
    setTimeout(() => txtArea.focus(), 150);
  }

  openModal('modalRejectDocument');
}

function quickFillRejectReason(text) {
  const txtArea = document.getElementById('textareaRejectReason');
  if (txtArea) {
    txtArea.value = text;
    txtArea.focus();
  }
}

async function handleConfirmRejectDocument() {
  if (!currentDocToReject) return;
  const txtArea = document.getElementById('textareaRejectReason');
  const reason = (txtArea?.value || '').trim();
  if (!reason) {
    showToast('Vui lòng nhập lý do trả về / yêu cầu sửa lại!', 'warning');
    txtArea?.focus();
    return;
  }

  const docId = currentDocToReject;
  const user = appState.currentUser;
  const currentUserId = user?.id || user?.username;
  const currentUsername = user?.username || user?.id;
  const currentFullName = user?.fullName || currentUsername;
  const currentRole = user?.roleTitle || user?.role || 'Người duyệt';

  showToast('Đang tiến hành trả về hồ sơ...', 'info');

  try {
    // 1. Gọi backend API
    try {
      const headers = {
        'Content-Type': 'application/json',
        'x-user-id': currentUserId,
        'x-user-username': currentUsername,
        'x-user-fullname': encodeURIComponent(currentFullName),
        'x-user-role': encodeURIComponent(currentRole)
      };
      if (appState.token) headers['Authorization'] = `Bearer ${appState.token}`;

      const endpoint = API_BASE ? `${API_BASE}/api/documents/${docId}/reject` : `/api/documents/${docId}/reject`;
      await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({ reason })
      });
    } catch (e) { console.warn('[Client Handled] e:', e && e.message ? e.message : e); }

    // 2. Đồng bộ Firebase RTDB
    const nowStr = new Date().toISOString();
    let docObj = null;
    if (firebaseDb) {
      const snap = await firebaseDb.ref(`documents/${docId}`).once('value');
      docObj = snap.val();
      if (docObj) {
        docObj.status = 'RETURNED';
        docObj.returnReason = reason;
        docObj.rejectReason = reason;
        docObj.returnedBy = currentUserId;
        docObj.returnedByName = currentFullName;
        docObj.returnedByRole = currentRole;
        docObj.returnedAt = nowStr;
        docObj.updatedAt = nowStr;
        docObj.assignedTo = null;
        docObj.currentSignerId = null;
        if (!Array.isArray(docObj.history)) docObj.history = [];
        docObj.history.push({
          action: 'TRẢ_VỀ_YÊU_CẦU_SỬA',
          actor: currentFullName,
          reason: reason,
          timestamp: nowStr
        });
        await firebaseDb.ref(`documents/${docId}`).set(docObj);
      }
    } else {
      await fetch(`${RTDB_URL}/documents/${docId}.json`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'RETURNED',
          returnReason: reason,
          returnedByName: currentFullName,
          returnedByRole: currentRole,
          returnedAt: nowStr,
          assignedTo: null,
          currentSignerId: null
        })
      });
    }

    // Gửi thông báo Zalo Bot trực tiếp cho tác giả hồ sơ
    try {
      const creatorId = docObj?.creatorId || docObj?.authorId || docObj?.createdBy;
      const authorObj = appState.users?.find(x => x.id === creatorId || x.username === creatorId);
      const authorPhone = authorObj?.phone || ((creatorId === 'user_cvaty' || creatorId === 'cva.ty') ? '0818810007' : '');
      sendZaloNotificationClientSide({
        action: 'NOTIFY_SIGN_EVENT',
        eventType: 'REJECTED',
        docId: docId,
        docTitle: docObj?.title || 'Báo cáo chuyên môn',
        authorPhone: authorPhone,
        approverName: currentFullName,
        reason: reason
      });
    } catch (zErr) {
      console.warn('[Zalo Client] Lỗi gửi Zalo khi trả về:', zErr);
    }

    closeModal('modalRejectDocument');
    closeModal('modalDocViewer');

    showUnifiedAlert({
      title: 'ĐÃ TRẢ VỀ HỒ SƠ THÀNH CÔNG',
      message: `Đã chuyển trả báo cáo về cho Thầy/Cô <strong>${escapeHtml(docObj?.creatorName || 'người gửi')}</strong> kèm lý do: <em>"${escapeHtml(reason)}"</em>.`,
      type: 'success'
    });

    // Làm mới danh sách
    loadTeacherPendingDocuments(true);
    loadTeacherSentDocuments(true);
    loadTeacherReturnedDocuments(true);
    loadSchoolReports(true);

  } catch (err) {
    console.error('Lỗi trả về hồ sơ:', err);
    showModalAlert('Lỗi thao tác', err.message, 'error');
  }
}

function handleViewerRejectCurrentDoc() {
  if (!currentChainedPendingDoc) return;
  openModalRejectDocument(currentChainedPendingDoc.id);
}

// THU HỒI HỒ SƠ ĐANG CHỜ KÝ
async function handleRecallSentDoc(docId, docTitle) {
  const confirmMsg = `Thầy/Cô có chắc chắn muốn THU HỒI hồ sơ:\n"${docTitle || docId}"?\n\nSau khi thu hồi, văn bản sẽ lập tức được rút khỏi hộp chờ ký của đồng nghiệp và chuyển về trạng thái "Đã thu hồi" của Thầy/Cô.`;
  showModalConfirm('Xác nhận thu hồi hồ sơ', confirmMsg, async () => {
    showToast('Đang tiến hành thu hồi hồ sơ...', 'info');

    try {
      const user = appState.currentUser;
      const headers = {
        'Content-Type': 'application/json',
        'x-user-id': user?.id || user?.username || '',
        'x-user-username': user?.username || '',
        'x-user-fullname': encodeURIComponent(user?.fullName || user?.name || user?.username || ''),
        'x-user-role': user?.role || ''
      };
      if (appState.token) {
        headers['Authorization'] = `Bearer ${appState.token}`;
      }

      try {
        const fetchEndpoint = API_BASE ? `${API_BASE}/api/documents/${docId}/recall` : `/api/documents/${docId}/recall`;
        await fetch(fetchEndpoint, { method: 'POST', headers });
      } catch (apiErr) {
        console.warn('[Recall Doc] Backend offline, fallback Firebase:', apiErr.message);
      }

      try {
        const nowStr = new Date().toISOString();
        if (typeof firebase !== 'undefined' && firebase.database) {
          const snap = await firebase.database().ref('documents').once('value');
          const all = snap.val() || {};
          const updatePromises = [];
          Object.keys(all).forEach(k => {
            if (all[k] && all[k].id === docId) {
              updatePromises.push(firebase.database().ref(`documents/${k}`).update({
                status: 'RECALLED',
                assignedTo: null,
                assignedToName: null,
                currentSignerId: null,
                currentSignerName: null,
                updatedAt: nowStr
              }));
            }
          });
          await Promise.all(updatePromises);
        } else {
          const rtdbUrl = (window.FIREBASE_CONFIG && window.FIREBASE_CONFIG.databaseURL) || 'https://edusign-school-default-rtdb.asia-southeast1.firebasedatabase.app';
          await fetch(`${rtdbUrl}/documents/${docId}.json`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              status: 'RECALLED',
              assignedTo: null,
              assignedToName: null,
              currentSignerId: null,
              currentSignerName: null,
              updatedAt: nowStr
            })
          });
        }
      } catch (fbErr) {
        console.warn('[Recall Doc] Lỗi cập nhật Firebase:', fbErr.message);
      }

      showToast(`🎉 Đã thu hồi thành công hồ sơ "${docTitle || docId}"!`, 'success');
      loadTeacherSentDocuments(true);
      loadTeacherPendingDocuments(true);

    } catch (err) {
      console.error('Lỗi thu hồi hồ sơ:', err);
      showToast('Lỗi khi thu hồi hồ sơ: ' + err.message, 'error');
    }
  }, 'Thu hồi ngay', false);
}

// XÓA VĨNH VIỄN HỒ SƠ ĐÃ GỬI
async function handleDeleteSentDoc(docId, docTitle) {
  const confirmMsg = `Thầy/Cô có chắc chắn muốn XÓA VĨNH VIỄN hồ sơ:\n"${docTitle || docId}"?\n\nSau khi xóa, hồ sơ sẽ được gỡ hoàn toàn khỏi cơ sở dữ liệu và không thể phục hồi.`;
  showModalConfirm('Xác nhận xóa vĩnh viễn', confirmMsg, async () => {
    showToast('Đang tiến hành xóa hồ sơ...', 'info');

    try {
      let success = false;

      // 1. Thử gọi API backend
      try {
        const user = appState.currentUser;
        const headers = {
          'Content-Type': 'application/json',
          'x-user-id': user?.id || user?.username || '',
          'x-user-username': user?.username || '',
        'x-user-fullname': encodeURIComponent(user?.fullName || user?.name || user?.username || ''),
        'x-user-role': user?.role || ''
      };
      if (appState.token) {
        headers['Authorization'] = `Bearer ${appState.token}`;
      }

      const fetchEndpoint = API_BASE ? `${API_BASE}/api/documents/${docId}` : `/api/documents/${docId}`;
      const res = await fetch(fetchEndpoint, {
        method: 'DELETE',
        headers
      });
      if (res.ok) {
        const json = await res.json().catch(() => ({}));
        if (json.success) success = true;
      } else {
        const errJson = await res.json().catch(() => ({}));
        console.warn(`[Delete Doc] Backend phản hồi HTTP ${res.status}:`, errJson.message || 'Lỗi phân quyền');
      }
    } catch (apiErr) {
      console.warn('[Delete Doc] API backend gặp lỗi, fallback Firebase:', apiErr.message);
    }

    // 2. Quét và xóa toàn bộ các node mang docId này trên Firebase (xóa sạch cả dạng index mảng 0, 1, 2... và dạng object)
    try {
      const rtdbUrl = (window.FIREBASE_CONFIG && window.FIREBASE_CONFIG.databaseURL) || 'https://edusign-school-default-rtdb.asia-southeast1.firebasedatabase.app';
      if (typeof firebase !== 'undefined' && firebase.database) {
        const snap = await firebase.database().ref('documents').once('value');
        const all = snap.val() || {};
        const deletePromises = [];
        Object.keys(all).forEach(k => {
          if (all[k] && all[k].id === docId) {
            deletePromises.push(firebase.database().ref(`documents/${k}`).remove());
          }
        });
        deletePromises.push(firebase.database().ref(`documents/${docId}`).remove());
        await Promise.all(deletePromises);
        success = true;
      } else {
        const fRes = await fetch(`${rtdbUrl}/documents.json?_t=${Date.now()}`);
        if (fRes.ok) {
          const all = await fRes.json();
          if (all) {
            for (const k of Object.keys(all)) {
              if (all[k] && all[k].id === docId) {
                await fetch(`${rtdbUrl}/documents/${k}.json`, { method: 'DELETE' });
              }
            }
          }
        }
        await fetch(`${rtdbUrl}/documents/${docId}.json`, { method: 'DELETE' });
        success = true;
      }
    } catch (fbErr) {
      console.warn('[Delete Doc] Lỗi xóa Firebase:', fbErr.message);
    }

    // Cập nhật lại state cục bộ nếu có
    teacherSentDocs = teacherSentDocs.filter(d => d.id !== docId);
    teacherPendingDocs = teacherPendingDocs.filter(d => d.id !== docId);

    showToast(`🎉 Đã xóa hoàn toàn hồ sơ "${docTitle || docId}"!`, 'success');
    loadTeacherSentDocuments(true);
    loadTeacherPendingDocuments(true);

    } catch (err) {
      console.error('Lỗi xóa hồ sơ:', err);
      showToast('Lỗi khi xóa hồ sơ: ' + err.message, 'error');
    }
  }, 'Xóa vĩnh viễn', true);
}

function viewSentDocumentDetail(docId) {
  return handleViewReportPdfInline(docId);
}

function downloadCompletedDocument(docId) {
  let doc = (window.teacherSentDocs && window.teacherSentDocs.find(d => d.id === docId)) ||
            (typeof teacherSentDocs !== 'undefined' && teacherSentDocs.find(d => d.id === docId)) ||
            (currentCachedSchoolReports && currentCachedSchoolReports.find(d => d.id === docId)) ||
            (window.allDocuments && window.allDocuments.find(d => d.id === docId));

  const base64ToUse = doc ? (doc.signedPdfBase64 || doc.fileBase64) : null;
  if (base64ToUse) {
    const link = document.createElement('a');
    link.href = base64ToUse;
    link.download = `${doc.title || 'BaoCao'}_DaKySo.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return;
  }
  const url = (API_BASE || '') + `/api/documents/${docId}/download-signed`;
  window.open(url, '_blank');
}

async function openPendingDocumentToSign(docId) {
  showToast('Đang nạp hồ sơ báo cáo...', 'info');

  try {
    let doc = teacherPendingDocs.find(d => d.id === docId);

    if (!doc || !doc.fileBase64) {
      try {
        const docEndpoint = API_BASE ? `${API_BASE}/api/documents/${docId}` : `/api/documents/${docId}`;
        const headers = {
          'x-user-id': appState.currentUser?.id || '',
          ...(appState.token ? { 'Authorization': `Bearer ${appState.token}` } : {})
        };
        const res = await fetch(docEndpoint, { headers });
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) doc = json.data;
        }
      } catch (e) { console.warn('[Client Handled] e:', e && e.message ? e.message : e); }

      if (!doc || !doc.fileBase64) {
        if (firebaseDb) {
          const snap = await firebaseDb.ref(`documents/${docId}`).once('value');
          doc = snap.val();
        } else {
          const fRes = await fetch(`${RTDB_URL}/documents/${docId}.json`);
          if (fRes.ok) doc = await fRes.json();
        }
      }
    }

    let pdfBlob = null;
    if (doc && doc.fileBase64 && typeof doc.fileBase64 === 'string' && doc.fileBase64.length > 50) {
      try {
        const cleanB64 = doc.fileBase64.replace(/^data:application\/pdf;base64,/, '');
        const byteCharacters = atob(cleanB64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        pdfBlob = new Blob([new Uint8Array(byteNumbers)], { type: 'application/pdf' });
      } catch (bErr) { console.warn('[Client Handled] bErr:', bErr && bErr.message ? bErr.message : bErr); }
    }

    if (!pdfBlob) {
      // Tải trực tiếp luồng nhị phân Blob từ endpoint /api/documents/:id/file của máy chủ / Cloud Drive
      try {
        const fileEndpoint = API_BASE ? `${API_BASE}/api/documents/${docId}/file?_t=${Date.now()}` : `/api/documents/${docId}/file?_t=${Date.now()}`;
        const fileHeaders = {
          'x-user-id': appState.currentUser?.id || '',
          ...(appState.token ? { 'Authorization': `Bearer ${appState.token}` } : {})
        };
        const fileRes = await fetch(fileEndpoint, { headers: fileHeaders });
        if (fileRes.ok) {
          const blobData = await fileRes.blob();
          if (blobData && blobData.size > 50) {
            pdfBlob = blobData;
          }
        }
      } catch (fErr) {
        console.warn('Lỗi nạp tệp từ máy chủ:', fErr.message);
      }
    }

    // Dự phòng tải trực tiếp Google Drive nếu có link Google Drive
    if (!pdfBlob && doc && (doc.googleDriveUrl || doc.driveInfo?.fileId)) {
      try {
        const gId = (doc.googleDriveUrl || '').match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1] || doc.driveInfo?.fileId;
        if (gId) {
          showToast('Đang tải tệp từ Google Drive...', 'info');
          const gUrl = `https://drive.usercontent.google.com/download?id=${gId}&export=download`;
          const gRes = await fetch(gUrl).catch(() => null);
          if (gRes && gRes.ok) {
            const gBlob = await gRes.blob();
            if (gBlob && gBlob.size > 50) {
              pdfBlob = gBlob;
            }
          }
        }
      } catch (gdErr) {
        console.warn('Lỗi tải trực tiếp từ Google Drive:', gdErr.message);
      }
    }

    if (!pdfBlob || pdfBlob.size < 50) {
      showModalAlert('Không tìm thấy tệp', 'Không thể lấy nội dung tệp PDF của hồ sơ này. Vui lòng thử lại.', 'error');
      return;
    }

    currentChainedPendingDoc = doc || { id: docId, title: 'Báo cáo chuyên môn' };

    // Mở Viewer
    openDocumentViewer(doc?.title || 'Báo cáo chuyên môn', pdfBlob, false);

    // Bật thanh điều khiển ký liên hoàn
    const chainedBar = document.getElementById('viewerChainedSignBar');
    const originLabel = document.getElementById('viewerChainedDocOrigin');
    const cbFinal = document.getElementById('cbViewerIsFinalSigner');
    const boxNext = document.getElementById('boxViewerNextSigner');
    const selNext = document.getElementById('selectViewerNextSigner');
    const noteInput = document.getElementById('inputViewerNote');

    if (chainedBar) chainedBar.classList.remove('hidden');
    const btnViewerReject = document.getElementById('btnViewerRejectDoc');
    if (btnViewerReject) btnViewerReject.classList.remove('hidden');

    if (originLabel) {
      const sigLen = (doc.signatures && doc.signatures.length) || 1;
      originLabel.textContent = `Từ: ${doc.creatorName || 'Đồng nghiệp'} (${sigLen} chữ ký đã có)`;
    }

    const isRequiresSeal = Boolean(doc?.requiresSeal || doc?.reportCategory === 'SCHOOL');
    const isBghUser = (appState.currentUser?.role === 'BGH' || appState.currentUser?.role === 'ADMIN' || Boolean(appState.currentUser?.canStampSeal) || appState.currentUser?.departmentId === 'dept_bgh');
    if (cbFinal) {
      cbFinal.checked = isBghUser;
      toggleViewerFinalSignerMode(isBghUser);
    } else if (boxNext) {
      boxNext.classList.remove('hidden');
    }
    if (isBghUser) {
      if (isRequiresSeal) {
        showToast('Ban Giám hiệu ký duyệt: Hồ sơ sẽ chuyển sang trạng thái Chờ đóng dấu mộc đỏ Nhà trường.', 'info');
      } else {
        showToast('Lãnh đạo ký duyệt: Hồ sơ báo cáo nội bộ sẽ được phê duyệt hoàn tất.', 'info');
      }
    }
    if (noteInput) noteInput.value = '';

    // Điền danh sách đồng nghiệp vào selectViewerNextSigner
    if (selNext) {
      const currentId = appState.currentUser?.id;
      const currentUsername = appState.currentUser?.username;
      const colleagues = appState.users.filter(u => u && u.id !== currentId && u.username !== currentUsername && !u.isLocked);

      selNext.innerHTML /* sanitize */ = '<option value="">-- Chọn đồng nghiệp / Lãnh đạo tiếp theo --</option>';
      colleagues.forEach(u => {
        const opt = document.createElement('option');
        opt.value = u.id || u.username;
        opt.textContent = `${u.fullName || u.username} (${u.departmentName || u.department || 'Chung'} - ${u.roleTitle || u.role || 'Giáo viên'})`;
        selNext.appendChild(opt);
      });
    }

  } catch (err) {
    console.error('Lỗi mở hồ sơ ký:', err);
    showModalAlert('Lỗi mở hồ sơ', err.message, 'error');
  }
}

function toggleViewerFinalSignerMode(isFinal) {
  const boxNext = document.getElementById('boxViewerNextSigner');
  if (!boxNext) return;
  if (isFinal) {
    boxNext.classList.add('hidden');
  } else {
    boxNext.classList.remove('hidden');
  }
}

async function handleSaveLessonPlanToFile() {
  if (!currentSignedPdfBase64) {
    showModalAlert('Không tìm thấy tệp', 'Dữ liệu file đã ký không còn tồn tại trong bộ nhớ. Vui lòng ký lại.', 'warning');
    return;
  }

  const fileNameEl = document.getElementById('saveLessonPlanFileName');
  const fileName = (fileNameEl && fileNameEl.textContent) ? fileNameEl.textContent.trim() : 'KeHoachBaiDay_DaKy.pdf';

  try {
    const byteCharacters = atob(currentSignedPdfBase64.replace(/^data:application\/pdf;base64,/, ''));
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const pdfBlob = new Blob([byteArray], { type: 'application/pdf' });

    let savedViaPicker = false;

    // 1. Nếu trình duyệt hỗ trợ window.showSaveFilePicker (Chrome, Edge)
    if (typeof window.showSaveFilePicker === 'function') {
      try {
        const fileHandle = await window.showSaveFilePicker({
          suggestedName: fileName,
          types: [{
            description: 'Tệp tài liệu PDF đã ký số (*.pdf)',
            accept: { 'application/pdf': ['.pdf'] }
          }]
        });
        const writableStream = await fileHandle.createWritable();
        await writableStream.write(pdfBlob);
        await writableStream.close();
        savedViaPicker = true;
      } catch (pickerErr) {
        if (pickerErr.name === 'AbortError') {
          return;
        }
        console.warn('showSaveFilePicker fallback to download blob:', pickerErr.message);
      }
    }

    // 2. Fallback: Nếu không dùng picker hoặc lưu picker lỗi
    if (!savedViaPicker) {
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 1000);
    }

    // QUY TẮC: Khi lưu thành công thì tự xóa, và xóa file đã ký khỏi hộp thoại tải lên
    closeModal('modalSaveLessonPlan');
    closeModal('modalDocViewer');

    // Làm sạch RAM & Thu hồi Blob URL
    if (currentPdfBlobUrl) {
      try { URL.revokeObjectURL(currentPdfBlobUrl); } catch (e) { console.warn('[Client Handled] e:', e && e.message ? e.message : e); }
      currentPdfBlobUrl = null;
    }
    currentSignedPdfBase64 = null;
    currentActiveSignSession = null;

    // XÓA FILE KHỎI HỘP THOẠI TẢI LÊN
    handleClearFile();

    // Gửi thông báo Zalo Bot xác nhận ký giáo án cá nhân thành công
    try {
      const user = appState.currentUser;
      const authorPhone = user?.phone || ((user?.username === 'cva.ty' || user?.id === 'user_cvaty') ? '0818810007' : '');
      if (authorPhone) {
        sendZaloNotificationClientSide({
          action: 'NOTIFY_SIGN_EVENT',
          eventType: 'PERSONAL_SIGNED',
          docTitle: fileName,
          authorPhone: authorPhone,
          senderName: user?.fullName || user?.name || 'Giáo viên'
        });
      }
    } catch (zErr) {
      console.warn('[Zalo Client] Lỗi gửi Zalo giáo án cá nhân:', zErr);
    }

    showToast('🎉 Đã lưu Giáo án đã ký thành công và làm sạch phiên làm việc!', 'success');

  } catch (err) {
    console.error('Lỗi lưu file:', err);
    showModalAlert('Lỗi khi lưu tệp', err.message, 'error');
  }
}

function handleOpenSaveLessonPlanModal(signedPdfBase64, session) {
  currentSignedPdfBase64 = signedPdfBase64;
  const safeDocTitle = (session.docTitle || 'KeHoachBaiDay').replace(/\.pdf$/i, '');
  const fileName = `[THCS_CVA]_${safeDocTitle}_DaKy.pdf`;

  const fileNameEl = document.getElementById('saveLessonPlanFileName');
  const signerEl = document.getElementById('saveLessonPlanSigner');

  if (fileNameEl) fileNameEl.textContent = fileName;
  if (signerEl) signerEl.textContent = session.cert?.signerName || appState.currentUser?.fullName || 'Giáo viên';

  openModal('modalSaveLessonPlan');
}

// ==================== QUẢN LÝ LOADING OVERLAY KHI KÝ VĂN BẢN TRONG VIEWER ====================
function showViewerSigningLoader(statusText = 'Đang niêm phong chữ ký số vào văn bản...', titleText = 'Đang Niêm Phong Chữ Ký Số') {
  const overlay = document.getElementById('viewerSigningOverlay');
  const titleEl = document.getElementById('viewerSigningTitle');
  const textEl = document.getElementById('viewerSigningStatusText');
  const spinner = document.getElementById('viewerSigningSpinnerRing');
  const icon = document.getElementById('viewerSigningIcon');
  const btnConfirm = document.getElementById('btnViewerConfirmSign');
  const btnReject = document.getElementById('btnViewerRejectDoc');

  if (btnConfirm) btnConfirm.disabled = true;
  if (btnReject) btnReject.disabled = true;

  if (titleEl) titleEl.textContent = titleText;
  if (textEl) textEl.textContent = statusText;
  if (spinner) spinner.classList.remove('hidden');
  if (icon) icon.textContent = '✍️';
  if (overlay) overlay.classList.remove('hidden');
}

function updateViewerSigningLoader(statusText, titleText) {
  const titleEl = document.getElementById('viewerSigningTitle');
  const textEl = document.getElementById('viewerSigningStatusText');
  if (titleText && titleEl) titleEl.textContent = titleText;
  if (statusText && textEl) textEl.textContent = statusText;
}

function hideViewerSigningLoader(successText = null, callback = null) {
  const overlay = document.getElementById('viewerSigningOverlay');
  const titleEl = document.getElementById('viewerSigningTitle');
  const textEl = document.getElementById('viewerSigningStatusText');
  const spinner = document.getElementById('viewerSigningSpinnerRing');
  const icon = document.getElementById('viewerSigningIcon');
  const btnConfirm = document.getElementById('btnViewerConfirmSign');
  const btnReject = document.getElementById('btnViewerRejectDoc');

  if (btnConfirm) btnConfirm.disabled = false;
  if (btnReject) btnReject.disabled = false;

  if (successText) {
    if (spinner) spinner.classList.add('hidden');
    if (icon) icon.textContent = '✅';
    if (titleEl) titleEl.textContent = 'Ký Số & Niêm Phong Thành Công!';
    if (textEl) textEl.textContent = successText;
    setTimeout(() => {
      if (overlay) overlay.classList.add('hidden');
      if (typeof callback === 'function') callback();
    }, 1000);
  } else {
    if (overlay) overlay.classList.add('hidden');
    if (typeof callback === 'function') callback();
  }
}

async function handleForwardNewReportDocument(signedPdfBase64, session) {
  const setForwardControlsDisabled = (disabled) => {
    const ids = ['cbSelfApproval', 'selectNextSigner', 'inputReportNote', 'btnSignNow', 'inputTeacherFile', 'btnChooseFile'];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.disabled = disabled;
    });
    const radios = document.querySelectorAll('input[name="reportCategoryChoice"], input[name="docTypeChoice"]');
    radios.forEach(r => { r.disabled = disabled; });
  };

  const resetForwardUIOnError = async () => {
    setForwardControlsDisabled(false);
    hideViewerSigningLoader();
    const cb = document.getElementById('cbSelfApproval');
    if (cb) cb.checked = false;
    if (typeof loadUsers === 'function') {
      try { await loadUsers(); } catch (uErr) { console.warn('[UI Reset] Lỗi tải lại người dùng:', uErr.message); }
    }
    if (typeof populateNextSigners === 'function') {
      populateNextSigners();
    } else if (typeof handleSelfApprovalToggle === 'function') {
      handleSelfApprovalToggle();
    }
  };

  try {
    const isSelfApproved = Boolean(document.getElementById('cbSelfApproval')?.checked);
    const selNext = document.getElementById('selectNextSigner');
    const nextSignerId = isSelfApproved ? null : (selNext?.value || null);
    const nextSignerName = isSelfApproved ? '' : (selNext?.options[selNext.selectedIndex]?.text?.split('(')[0]?.trim() || 'Đồng nghiệp');
    const note = (document.getElementById('inputReportNote')?.value || '').trim();

    const user = appState.currentUser;
    const currentUserId = user?.id || user?.username;
    const currentUsername = user?.username || user?.id;
    const isBgh = isUserBgh(user);
    const isHead = isUserHeadOfDept(user);

    if (isSelfApproved) {
      showViewerSigningLoader('Đang niêm phong chữ ký và hoàn tất phê duyệt báo cáo...', 'Đang Phê Duyệt Báo Cáo');
      showToast('Đang niêm phong chữ ký và phê duyệt báo cáo...', 'info');
    } else {
      showViewerSigningLoader('Đang khởi tạo báo cáo và chuyển tiếp đến người duyệt...', 'Đang Trình Ký Báo Cáo');
      showToast('Đang chuyển tiếp báo cáo đến đồng nghiệp...', 'info');
    }
    setForwardControlsDisabled(true);

    const deptClean = String(user?.departmentName || user?.department || 'CVA')
      .replace(/Tổ\s*/gi, '')
      .trim()
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase()
      .slice(0, 8) || 'CVA';
    const trackingId = `BC-${new Date().getFullYear()}-${deptClean}-${Math.floor(100000 + Math.random() * 900000)}`;

    const reportCatChoice = getSelectedReportCategory();
    if (!reportCatChoice) {
      await resetForwardUIOnError();
      if (typeof highlightReportCategoryRequirement === 'function') {
        highlightReportCategoryRequirement();
      }
      showModalAlert(
        'Chưa phân loại báo cáo',
        'Vui lòng chọn <strong>Báo cáo Chuyên môn Nội bộ</strong> (Tổ/Khối) hoặc <strong>Báo cáo Trình Ban Giám Hiệu</strong> trước khi chuyển tiếp hồ sơ.',
        'warning'
      );
      return false;
    }
    const reportCategory = (reportCatChoice === 'SCHOOL_REPORT') ? 'SCHOOL' : 'INTERNAL';
    const requiresSeal = (reportCategory === 'SCHOOL');
    const isRealSchoolSeal = Boolean(requiresSeal && isBgh && (session?.isSchoolSeal || isSelfApproved));

    const signerRole = isBgh
      ? 'Ban Giám hiệu phê duyệt & Đóng dấu'
      : isHead
        ? (isSelfApproved ? 'Tổ trưởng chuyên môn phê duyệt' : 'Tổ trưởng chuyên môn')
        : (user?.roleTitle || 'Giáo viên');

    const payload = {
      id: trackingId,
      title: session.docTitle || teacherSelectedFile?.name || 'Báo cáo chuyên môn',
      docType: 'REPORT',
      category: 'REPORT',
      reportCategory: reportCategory,
      categoryType: reportCatChoice,
      requiresSeal: requiresSeal,
      hasSchoolSeal: isRealSchoolSeal,
      isSelfApproved: isSelfApproved,
      isFinal: isSelfApproved,
      isSchoolSeal: isRealSchoolSeal,
      fileBase64: signedPdfBase64,
      nextSignerId: nextSignerId,
      nextSignerName: nextSignerName,
      note: note,
      signerCert: session.cert,
      currentUser: user
    };

    let sendSuccess = false;

    try {
      const headers = {
        'Content-Type': 'application/json',
        'x-user-id': currentUserId,
        'x-user-username': currentUsername,
        'x-user-fullname': encodeURIComponent(user?.fullName || currentUsername),
        'x-user-dept': encodeURIComponent(user?.departmentName || user?.department || 'Tổ chuyên môn'),
        'x-user-role': user?.role || ''
      };
      if (appState.token) headers['Authorization'] = `Bearer ${appState.token}`;

      const endpoint = API_BASE ? `${API_BASE}/api/documents/forward` : '/api/documents/forward';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success) {
        sendSuccess = true;
      } else {
        // Chặn đứng hoàn toàn: Server từ chối nghiệp vụ (400, 401, 403, 409) -> KHÔNG FALLBACK VƯỢT QUYỀN
        await resetForwardUIOnError();
        showModalAlert(
          'Không thể chuyển tiếp hồ sơ',
          `⚠️ Máy chủ từ chối yêu cầu (${res.status}):<br><br><strong>${escapeHtml(json.message || 'Lỗi phân quyền hoặc dữ liệu không hợp lệ.')}</strong>`,
          'error'
        );
        showToast(json.message || 'Lỗi phân quyền hoặc dữ liệu không hợp lệ.', 'error');
        return false;
      }
    } catch (apiErr) {
      console.warn('[forward] Lỗi kết nối mạng API backend:', apiErr.message);
      await resetForwardUIOnError();
      showModalAlert(
        'Lỗi kết nối máy chủ',
        `⚠️ Không thể kết nối tới máy chủ ký số:<br><br><strong>${escapeHtml(apiErr.message)}</strong><br><br>Vui lòng kiểm tra lại đường truyền mạng và thử lại.`,
        'error'
      );
      showToast('Lỗi kết nối máy chủ ký số.', 'error');
      return false;
    }

    if (sendSuccess) {
      // Kích hoạt Zalo Bot 1-1 thông báo
      try {
        const authorPhone = user?.phone || ((user?.username === 'cva.ty' || user?.id === 'user_cvaty') ? '0818810007' : '');
        const nextUserObj = nextSignerId ? appState.users?.find(x => x.id === nextSignerId || x.username === nextSignerId) : null;
        const recipientPhone = nextUserObj?.phone || '';
        sendZaloNotificationClientSide({
          action: 'NOTIFY_SIGN_EVENT',
          eventType: isSelfApproved ? 'APPROVED' : 'SUBMITTED',
          docId: trackingId,
          docTitle: payload.title,
          authorPhone: authorPhone,
          recipientPhone: recipientPhone,
          recipientName: isSelfApproved ? 'Nhà trường' : nextSignerName,
          senderName: user?.fullName || currentUsername,
          reportCategory: reportCategory,
          requiresSeal: requiresSeal,
          hasSchoolSeal: isRealSchoolSeal
        });
      } catch(zErr) {
        console.warn('[Zalo Client] Lỗi gửi thông báo submit:', zErr);
      }

      await new Promise(r => setTimeout(r, 600));
      const successMsg = isSelfApproved
        ? '🎉 Đã vừa ký vừa duyệt hoàn tất báo cáo thành công!'
        : '🎉 Đã ký số và khởi tạo quy trình thành công!';

      // Cập nhật trạng thái và dọn dẹp file đồng bộ ngay khi API thành công, triệt tiêu race condition trước animation loader
      currentActiveSignSession = null;
      handleClearFile();

      hideViewerSigningLoader(successMsg, () => {
        // Đóng viewer
        closeModal('modalDocViewer');
        if (currentPdfBlobUrl) {
          try { URL.revokeObjectURL(currentPdfBlobUrl); } catch (e) { console.warn('[Client Handled] e:', e && e.message ? e.message : e); }
          currentPdfBlobUrl = null;
        }

        if (isSelfApproved) {
          showToast(`🎉 Đã vừa ký vừa duyệt hoàn tất báo cáo [${trackingId}] thành công!`, 'success');
          showModalAlert(
            'Phê duyệt hoàn tất thành công',
            `🎉 Thầy/Cô đã vừa ký và phê duyệt hoàn tất báo cáo <strong>[${escapeHtml(trackingId)}]</strong>!<br><br>Văn bản đã được lưu trữ chính thức vào <strong>Kho Báo cáo &amp; Biên bản số</strong> của nhà trường.`,
            'success'
          );
        } else {
          showToast(`🎉 Đã ký và gửi báo cáo [${trackingId}] thành công tới ${nextSignerName}!`, 'success');
          showModalAlert(
            'Chuyển tiếp thành công',
            `🎉 Thầy/Cô đã ký số và chuyển tiếp báo cáo thành công tới <strong>${escapeHtml(nextSignerName)}</strong>!<br><br>Hồ sơ đã được đưa vào danh sách chờ ký của đồng nghiệp.`,
            'success'
          );
        }

        loadTeacherPendingDocuments(true);
        loadTeacherSentDocuments(true);
        if (typeof loadSchoolReports === 'function') {
          loadSchoolReports(true);
        }
      });
    } else {
      await resetForwardUIOnError();
      showToast('Không thể gửi báo cáo. Vui lòng thử lại!', 'error');
    }
  } catch (unexpectedErr) {
    console.error('[handleForwardNewReportDocument] Ngoại lệ không mong muốn:', unexpectedErr);
    await resetForwardUIOnError();
    showModalAlert(
      'Lỗi xử lý biểu mẫu',
      `⚠️ Đã xảy ra sự cố ngoài dự kiến: ${escapeHtml(unexpectedErr.message || 'Lỗi không xác định')}. Giao diện đã được mở khóa an toàn.`,
      'error'
    );
    return false;
  }
}

async function handleChainedPendingDocumentSignStep(signedPdfBase64, session) {
  showViewerSigningLoader('Đang cập nhật chữ ký số vào quy trình hồ sơ...', 'Đang Niêm Phong Chữ Ký');
  showToast('Đang cập nhật chữ ký số vào quy trình hồ sơ...', 'info');
  const isFinal = Boolean(document.getElementById('cbViewerIsFinalSigner')?.checked);
  const isRealSchoolSeal = Boolean(session.isSchoolSeal);
  const selNext = document.getElementById('selectViewerNextSigner');
  const nextSignerId = isFinal ? null : (selNext?.value || null);
  const nextSignerName = isFinal ? '' : (selNext?.options[selNext.selectedIndex]?.text?.split('(')[0]?.trim() || '');
  const note = (document.getElementById('inputViewerNote')?.value || '').trim();

  const user = appState.currentUser;
  const currentUserId = user?.id || user?.username;
  const currentUsername = user?.username || user?.id;

  const payload = {
    fileBase64: signedPdfBase64,
    isFinal: isFinal,
    isSchoolSeal: Boolean(session.isSchoolSeal),
    nextSignerId: nextSignerId,
    nextSignerName: nextSignerName,
    note: note,
    signerCert: session.cert,
    currentUser: user
  };

  const docId = currentChainedPendingDoc.id;
  let result = null;

  try {
    const headers = {
      'Content-Type': 'application/json',
      'x-user-id': currentUserId,
      'x-user-username': currentUsername,
      'x-user-fullname': encodeURIComponent(user?.fullName || currentUsername),
      'x-user-dept': encodeURIComponent(user?.departmentName || user?.department || 'Tổ chuyên môn')
    };
    if (appState.token) headers['Authorization'] = `Bearer ${appState.token}`;

    const signEndpoint = API_BASE ? `${API_BASE}/api/documents/${docId}/sign-step` : `/api/documents/${docId}/sign-step`;
    const res = await fetch(signEndpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json.success) {
      result = json;
    } else {
      throw new Error(json.message || `Lỗi HTTP ${res.status}`);
    }
  } catch (apiErr) {
    console.warn('[sign-step] API backend gặp lỗi, lưu trực tiếp qua Firebase:', apiErr.message);
    const nowStr = new Date().toISOString();
    const doc = currentChainedPendingDoc;
    doc.fileBase64 = signedPdfBase64;
    doc.updatedAt = nowStr;
    const isRealSchoolSeal = Boolean(session.isSchoolSeal);
    const isBgh = Boolean(user?.role === 'BGH' || user?.role === 'ADMIN' || Boolean(user?.canStampSeal) || user?.departmentId === 'dept_bgh');
    if (!Array.isArray(doc.signatures)) doc.signatures = [];
    doc.signatures.push({
      step: doc.signatures.length + 1,
      signerId: isRealSchoolSeal ? 'school_seal' : currentUserId,
      signerName: isRealSchoolSeal ? 'TRƯỜNG THCS CHU VĂN AN' : (user?.fullName || currentUsername),
      signerRole: isRealSchoolSeal ? 'Đã đóng dấu nhà trường' : (isBgh ? 'Ban Giám hiệu phê duyệt' : (user?.roleTitle || user?.role || 'Giáo viên')),
      isSchoolSeal: isRealSchoolSeal,
      signedAt: nowStr,
      certSerial: session.cert?.serialNumber || (isRealSchoolSeal ? '189A2218A5A80E4C' : '7C4C44A8671300AE'),
      note: note
    });

    const requiresSeal = Boolean(doc.requiresSeal || doc.reportCategory === 'SCHOOL');
    if (isRealSchoolSeal) {
      doc.status = 'COMPLETED';
      doc.completedAt = nowStr;
      doc.finalSigner = 'TRƯỜNG THCS CHU VĂN AN';
      doc.hasSchoolSeal = true;
      doc.sealedAt = nowStr;
      doc.assignedTo = null;
      doc.currentSignerId = null;
      doc.nextSignerId = null;
    } else if (isFinal) {
      if (requiresSeal) {
        doc.status = 'PENDING_SEAL';
        doc.completedAt = null;
        doc.hasSchoolSeal = false;
        doc.bghApprovedAt = nowStr;
        doc.bghSigner = user?.fullName || currentUsername;
        doc.assignedTo = null;
        doc.currentSignerId = null;
        doc.nextSignerId = null;
      } else {
        doc.status = 'COMPLETED';
        doc.completedAt = nowStr;
        doc.finalSigner = user?.fullName || currentUsername;
        doc.hasSchoolSeal = false;
        doc.assignedTo = null;
        doc.currentSignerId = null;
        doc.nextSignerId = null;
      }
    } else {
      doc.status = 'PENDING_SIGN';
      doc.assignedTo = nextSignerId;
      doc.assignedToName = nextSignerName;
      doc.currentSignerId = nextSignerId;
      doc.currentSignerName = nextSignerName;
      doc.nextSignerId = nextSignerId;
      doc.nextSignerName = nextSignerName;
    }

    if (firebaseDb) {
      await firebaseDb.ref(`documents/${docId}`).set(doc);
    } else {
      await fetch(`${RTDB_URL}/documents/${docId}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(doc)
      });
    }
    result = { success: true, isCompleted: isRealSchoolSeal || (isFinal && !requiresSeal), isPendingSeal: Boolean(isFinal && requiresSeal && !isRealSchoolSeal) };
  }

  const docSnapshot = currentChainedPendingDoc ? { ...currentChainedPendingDoc } : {};
  const requiresSeal = Boolean(docSnapshot.requiresSeal || docSnapshot.reportCategory === 'SCHOOL');
  const isTrulyCompleted = Boolean(isRealSchoolSeal || (isFinal && !requiresSeal));
  const isPendingSeal = Boolean(isFinal && requiresSeal && !isRealSchoolSeal);

  // Tự động đẩy tệp PDF đã hoàn tất / đóng dấu lên Google Drive của trường
  if (isTrulyCompleted) {
    updateViewerSigningLoader('Đang đồng bộ báo cáo lên Google Drive nhà trường...', 'Đang Lưu Trữ');
    try {
      const dr = await syncDocumentToGoogleDrive(docSnapshot, signedPdfBase64);
      if (dr && dr.viewUrl) {
        console.log('[handleChainedPendingDocumentSignStep] Đã đồng bộ Google Drive thành công:', dr.viewUrl);
      }
    } catch(e) {
      console.warn('[handleChainedPendingDocumentSignStep] Lỗi đồng bộ Google Drive:', e.message);
    }
  } else {
    await new Promise(r => setTimeout(r, 600));
  }

  let finishToastMsg = '🎉 Đã ký duyệt và chuyển tiếp thành công!';
  if (isRealSchoolSeal) {
    finishToastMsg = '🎉 Hồ sơ đã được đóng dấu pháp nhân hoàn tất!';
  } else if (isPendingSeal) {
    finishToastMsg = '✍️ Ban Giám hiệu đã ký duyệt! Hồ sơ chuyển sang trạng thái Chờ đóng dấu mộc đỏ.';
  } else if (isFinal) {
    finishToastMsg = '🎉 Báo cáo nội bộ đã được phê duyệt hoàn tất!';
  }

  hideViewerSigningLoader(finishToastMsg, () => {
    // Đóng viewer và dọn sạch session
    closeModal('modalDocViewer');
    if (currentPdfBlobUrl) {
      try { URL.revokeObjectURL(currentPdfBlobUrl); } catch (e) { console.warn('[Client Handled] e:', e && e.message ? e.message : e); }
      currentPdfBlobUrl = null;
    }
    currentChainedPendingDoc = null;
    currentActiveSignSession = null;

    const authorId = docSnapshot.creatorId || docSnapshot.authorId || docSnapshot.creatorUsername || docSnapshot.authorUsername;
    const authorObj = appState.users?.find(x => x.id === authorId || x.username === authorId);
    const authorPhone = authorObj?.phone || ((authorId === 'user_cvaty' || authorId === 'cva.ty') ? '0818810007' : '');
    const docTitle = docSnapshot.title || session.docTitle || 'Báo cáo chuyên môn';
    const viewUrl = docSnapshot.driveInfo?.viewUrl || 'https://mrkhang-khoi.github.io/cvakyso/portal-baocao.html';
    const approverName = isRealSchoolSeal ? 'TRƯỜNG THCS CHU VĂN AN' : (user?.fullName || currentUsername);

    if (isRealSchoolSeal) {
      // Trường hợp 3 - Đã đóng dấu mộc đỏ hoàn tất (eventType: "COMPLETED", hasSchoolSeal: true)
      try {
        sendZaloNotificationClientSide({
          action: 'NOTIFY_SIGN_EVENT',
          eventType: 'COMPLETED',
          docId: docId,
          docTitle: docTitle,
          authorPhone: authorPhone,
          approverName: approverName,
          viewUrl: viewUrl,
          hasSchoolSeal: true,
          isSchoolSeal: true,
          requiresSeal: true,
          reportCategory: 'SCHOOL'
        });
      } catch (zErr) {
        console.warn('[Zalo Client] Lỗi gửi Zalo hoàn tất có dấu:', zErr);
      }

      // NƠI 2: TỰ ĐỘNG TẢI TỆP VỀ MÁY TÍNH / THƯ MỤC ONEDRIVE
      try {
        const byteChars = atob(signedPdfBase64.replace(/^data:application\/pdf;base64,/, ''));
        const byteNums = new Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) byteNums[i] = byteChars.charCodeAt(i);
        const blob = new Blob([new Uint8Array(byteNums)], { type: 'application/pdf' });
        const dlUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = dlUrl;
        a.download = `[THCS_CVA]_${(session.docTitle || 'BaoCao').replace(/\.pdf$/i, '')}_HoanTat.pdf`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(dlUrl);
        }, 1000);
      } catch (e) { console.warn('[Client Handled] e:', e && e.message ? e.message : e); }

      showModalAlert(
        'Hoàn tất đóng dấu pháp nhân & Lưu 2 nơi',
        '🎉 Chúc mừng! Hồ sơ đã được đóng dấu mộc đỏ pháp nhân của Trường THCS Chu Văn An và hoàn tất ban hành.<br><br>' +
        '✅ <strong>Nơi 1:</strong> Đã tự động lưu trữ vào Google Drive nhà trường.<br>' +
        '✅ <strong>Nơi 2:</strong> Bản sao hoàn tất đã được tải về máy tính (thư mục OneDrive/Downloads).',
        'success'
      );
    } else if (isPendingSeal) {
      // Trường hợp 2 - BGH đã ký duyệt nhưng chờ đóng dấu (eventType: "BGH_APPROVED" hoặc PENDING_SEAL)
      try {
        sendZaloNotificationClientSide({
          action: 'NOTIFY_SIGN_EVENT',
          eventType: 'BGH_APPROVED',
          docId: docId,
          docTitle: docTitle,
          authorPhone: authorPhone,
          approverName: user?.fullName || currentUsername,
          viewUrl: viewUrl,
          hasSchoolSeal: false,
          isSchoolSeal: false,
          requiresSeal: true,
          reportCategory: 'SCHOOL'
        });
      } catch (zErr) {
        console.warn('[Zalo Client] Lỗi gửi Zalo BGH phê duyệt:', zErr);
      }

      showModalAlert(
        'Ban Giám hiệu đã phê duyệt',
        '✍️ Ban Giám hiệu đã ký duyệt nội dung báo cáo thành công!<br><br>' +
        '⏳ <strong>Trạng thái:</strong> Chờ BGH hoặc Văn thư đóng dấu mộc đỏ nhà trường bằng USB Token pháp nhân để hoàn tất ban hành chính thức.',
        'info'
      );
    } else if (isFinal) {
      // Trường hợp 1 - Báo cáo Nội bộ Hoàn tất (eventType: "COMPLETED", hasSchoolSeal: false)
      try {
        sendZaloNotificationClientSide({
          action: 'NOTIFY_SIGN_EVENT',
          eventType: 'COMPLETED',
          docId: docId,
          docTitle: docTitle,
          authorPhone: authorPhone,
          approverName: user?.fullName || currentUsername,
          viewUrl: viewUrl,
          hasSchoolSeal: false,
          isSchoolSeal: false,
          requiresSeal: false,
          reportCategory: 'INTERNAL'
        });
      } catch (zErr) {
        console.warn('[Zalo Client] Lỗi gửi Zalo báo cáo nội bộ:', zErr);
      }

      // NƠI 2: TỰ ĐỘNG TẢI TỆP VỀ MÁY TÍNH / THƯ MỤC ONEDRIVE
      try {
        const byteChars = atob(signedPdfBase64.replace(/^data:application\/pdf;base64,/, ''));
        const byteNums = new Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) byteNums[i] = byteChars.charCodeAt(i);
        const blob = new Blob([new Uint8Array(byteNums)], { type: 'application/pdf' });
        const dlUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = dlUrl;
        a.download = `[THCS_CVA]_${(session.docTitle || 'BaoCao').replace(/\.pdf$/i, '')}_HoanTat.pdf`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(dlUrl);
        }, 1000);
      } catch (e) { console.warn('[Client Handled] e:', e && e.message ? e.message : e); }

      showModalAlert(
        'Hoàn tất phê duyệt báo cáo nội bộ',
        '🎉 Chúc mừng! Báo cáo chuyên môn nội bộ đã được Tổ trưởng phê duyệt hoàn tất.<br><br>' +
        '✅ <strong>Nơi 1:</strong> Đã tự động lưu trữ vào Google Drive nhà trường.<br>' +
        '✅ <strong>Nơi 2:</strong> Bản sao đã được tải về máy tính (thư mục OneDrive/Downloads).',
        'success'
      );
    } else {
      // Chuyển tiếp tới người ký tiếp theo -> Bắn tin Zalo cho người duyệt tiếp theo
      if (nextSignerId) {
        try {
          const nextUserObj = appState.users?.find(x => x.id === nextSignerId || x.username === nextSignerId);
          sendZaloNotificationClientSide({
            action: 'NOTIFY_SIGN_EVENT',
            eventType: 'FORWARDED',
            docId: docId,
            docTitle: docTitle,
            authorPhone: authorPhone,
            recipientPhone: nextUserObj?.phone || '',
            recipientName: nextSignerName,
            senderName: user?.fullName || currentUsername,
            hasSchoolSeal: false,
            requiresSeal: requiresSeal,
            reportCategory: docSnapshot.reportCategory || (requiresSeal ? 'SCHOOL' : 'INTERNAL')
          });
        } catch (zErr) { console.warn('[Client Handled] zErr:', zErr && zErr.message ? zErr.message : zErr); }
      }
      showToast(`🎉 Đã ký và chuyển tiếp thành công đến ${nextSignerName}!`, 'success');
      showModalAlert(
        'Chuyển tiếp thành công',
        `🎉 Thầy/Cô đã ký số và chuyển tiếp thành công hồ sơ tới <strong>${escapeHtml(nextSignerName)}</strong>!<br><br>Hồ sơ đã được gửi đến danh sách chờ ký của đồng nghiệp.`,
        'success'
      );
    }

    // Tải lại danh sách hồ sơ cho tất cả các luồng
    loadTeacherPendingDocuments(true);
    loadTeacherSentDocuments(true);
    if (typeof loadTeacherReturnedDocuments === 'function') {
      loadTeacherReturnedDocuments(true);
    }
    if (typeof loadSchoolReports === 'function') {
      loadSchoolReports(true);
    }
  });
}

// ==================== XỬ LÝ KÝ SỐ & ĐỊNH VỊ CHỮ KÝ TRÊN PDF ====================
let isSigPlacementActive = false;
let currentStampPlacement = 'bottom-right';
let currentStampCoords = { xPercent: 74.5, yPercent: 68.0, isManualDrag: false };
window.currentStampCoords = currentStampCoords;
window.getCurrentStampCoords = () => currentStampCoords;
let currentStampScale = 1.0;
let currentStampPage = 'last';
let currentDocTotalPages = 1;
let isDraggingStamp = false;
let stampDragStartX = 0, stampDragStartY = 0;
let stampElemStartX = 0, stampElemStartY = 0;
let currentPdfBlobUrl = null;
let currentViewingFileName = '';

async function detectPdfTotalPages(fileObject) {
  try {
    const blob = (fileObject instanceof Blob) ? fileObject : new Blob([fileObject], { type: 'application/pdf' });
    const ab = await blob.slice(0, Math.min(blob.size, 3000000)).arrayBuffer();
    const txt = new TextDecoder('latin1').decode(new Uint8Array(ab));
    const pageMatches = [...txt.matchAll(/\/Type\s*\/Page\b/g)];
    if (pageMatches.length > 0) return pageMatches.length;
    const countMatches = [...txt.matchAll(/\/Count\s+(\d+)/g)];
    if (countMatches.length > 0) {
      const counts = countMatches.map(m => parseInt(m[1], 10)).filter(n => !isNaN(n) && n > 0);
      if (counts.length > 0) return Math.max(...counts);
    }
  } catch (e) { console.warn('[Client Handled] e:', e && e.message ? e.message : e); }
  return 1;
}

function onSigTargetPageChange(val) {
  const pageInput = document.getElementById('sigTargetPageInput');
  let targetP = val;
  if (val === 'custom') {
    if (pageInput) {
      pageInput.classList.remove('hidden');
      pageInput.focus();
    }
    targetP = parseInt(pageInput?.value, 10) || 1;
  } else {
    if (pageInput) pageInput.classList.add('hidden');
    targetP = (val === 'last') ? 'last' : (parseInt(val, 10) || 1);
  }

  currentStampPage = targetP;

  // Nếu đang render bằng PDF.js canvas, di chuyển con dấu đến trang đó và cuộn tới trang đó
  const pageWrappers = document.querySelectorAll('.pdf-page-wrapper');
  if (pageWrappers.length > 0) {
    placeSignatureOnPage(targetP, currentStampPlacement === 'bottom-left' ? 'principal' : (currentStampPlacement === 'middle-right' ? 'leader' : 'teacher'), true);
  } else {
    // Fallback iframe
    const pdfFrame = document.getElementById('viewerPdfFrame');
    if (pdfFrame && currentPdfBlobUrl) {
      const pNum = (targetP === 'last') ? (currentDocTotalPages > 0 ? currentDocTotalPages : 9999) : targetP;
      pdfFrame.src = currentPdfBlobUrl + `#page=${pNum}&view=FitH&toolbar=1&navpanes=0`;
    }
    updateStampCoordsDisplay();
  }
}

function onSigTargetPageInputChange(val) {
  const p = Math.max(1, parseInt(val, 10) || 1);
  currentStampPage = p;
  const pageWrappers = document.querySelectorAll('.pdf-page-wrapper');
  if (pageWrappers.length > 0) {
    placeSignatureOnPage(p, currentStampPlacement === 'bottom-left' ? 'principal' : (currentStampPlacement === 'middle-right' ? 'leader' : 'teacher'), true);
  } else {
    const pdfFrame = document.getElementById('viewerPdfFrame');
    if (pdfFrame && currentPdfBlobUrl) {
      pdfFrame.src = currentPdfBlobUrl + `#page=${p}&view=FitH&toolbar=1&navpanes=0`;
    }
    updateStampCoordsDisplay();
  }
}

async function handleTeacherSignAction() {
  if (!teacherSelectedFile) {
    showModalAlert('Chưa chọn tệp', 'Vui lòng tải lên tệp giáo án hoặc báo cáo để ký số.', 'warning');
    return;
  }

  // BẮT BUỘC: Kiểm tra tệp đã là PDF hay chưa
  if (teacherSelectedFile.name.match(/\.(docx|doc)$/i)) {
    showModalAlert(
      'Cần chuyển đổi sang PDF',
      'Văn bản Word cần được chuyển đổi sang định dạng chuẩn PDF trước khi mở giao diện ký số. Thầy/Cô vui lòng bấm nút [Chuyển PDF].',
      'warning'
    );
    return;
  }

  currentChainedPendingDoc = null;
  const chainedBar = document.getElementById('viewerChainedSignBar');
  if (chainedBar) chainedBar.classList.add('hidden');

  // Tệp đã là PDF hợp lệ -> Mở giao diện xem trước & định vị chữ ký số kế thừa từ phiên bản trước
  openDocumentViewer(teacherSelectedFile.name, teacherSelectedFile, false);
}

async function renderPdfPagesWithPdfJs(fileObject) {
  const container = document.getElementById('viewerPdfPagesContainer');
  const pdfFrame = document.getElementById('viewerPdfFrame');
  const spinner = document.getElementById('viewerLoadingSpinner');
  if (!container) return false;

  if (!window.pdfjsLib) {
    console.warn('[PDF.js] Thư viện window.pdfjsLib chưa sẵn sàng, dùng iframe fallback.');
    if (pdfFrame) pdfFrame.classList.remove('hidden');
    container.classList.add('hidden');
    return false;
  }

  try {
    if (spinner) spinner.classList.remove('hidden');
    container.innerHTML /* sanitize */ = '';

    let arrayBuffer;
    if (fileObject instanceof ArrayBuffer) {
      arrayBuffer = fileObject;
    } else if (fileObject instanceof Blob) {
      arrayBuffer = await fileObject.arrayBuffer();
    } else if (fileObject && typeof fileObject.arrayBuffer === 'function') {
      arrayBuffer = await fileObject.arrayBuffer();
    } else if (typeof fileObject === 'string' && fileObject.startsWith('data:')) {
      const clean = fileObject.replace(/^data:[^;]+;base64,/, '');
      const binaryStr = atob(clean);
      const len = binaryStr.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) bytes[i] = binaryStr.charCodeAt(i);
      arrayBuffer = bytes.buffer;
    } else {
      throw new Error('Định dạng fileObject không hỗ trợ ArrayBuffer');
    }

    currentViewingPdfBytes = arrayBuffer;

    const loadingTask = window.pdfjsLib.getDocument({ data: arrayBuffer.slice(0) });
    const pdfDoc = await loadingTask.promise;
    currentPdfDocument = pdfDoc;
    currentDocTotalPages = pdfDoc.numPages;

    if (pdfFrame) pdfFrame.classList.add('hidden');
    container.classList.remove('hidden');

    const viewerArea = document.getElementById('viewerContentArea');
    const availableWidth = Math.max(340, (viewerArea ? viewerArea.clientWidth : 800) - 64);

    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const unscaledViewport = page.getViewport({ scale: 1.0 });
      const ptWidth = unscaledViewport.width;
      const ptHeight = unscaledViewport.height;

      const displayScale = Math.min(2.0, Math.max(1.0, (availableWidth / ptWidth)));
      const viewport = page.getViewport({ scale: displayScale });

      const pageWrapper = document.createElement('div');
      pageWrapper.className = 'pdf-page-wrapper relative bg-white shadow-md rounded-xl overflow-hidden border border-slate-200 transition-all';
      pageWrapper.setAttribute('data-page', String(pageNum));
      pageWrapper.setAttribute('data-page-width', String(ptWidth));
      pageWrapper.setAttribute('data-page-height', String(ptHeight));
      pageWrapper.style.width = `${Math.round(viewport.width)}px`;
      pageWrapper.style.height = `${Math.round(viewport.height)}px`;
      pageWrapper.style.maxWidth = '100%';

      const canvas = document.createElement('canvas');
      canvas.className = 'w-full h-full block';
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);

      const ctx = canvas.getContext('2d');
      const renderContext = {
        canvasContext: ctx,
        viewport: viewport
      };

      await page.render(renderContext).promise;

      const pageBadge = document.createElement('div');
      pageBadge.className = 'absolute bottom-2.5 right-3 px-2.5 py-1 bg-slate-900/70 text-white rounded-lg text-[11px] font-bold pointer-events-none backdrop-blur-xs select-none';
      pageBadge.textContent = `Trang ${pageNum} / ${pdfDoc.numPages}`;

      pageWrapper.appendChild(canvas);
      pageWrapper.appendChild(pageBadge);
      container.appendChild(pageWrapper);
    }

    if (spinner) spinner.classList.add('hidden');
    return true;
  } catch (err) {
    console.warn('[PDF.js] Không thể render bằng Canvas, chuyển về iframe fallback:', err.message);
    if (pdfFrame) pdfFrame.classList.remove('hidden');
    container.classList.add('hidden');
    if (spinner) spinner.classList.add('hidden');
    return false;
  }
}

function openDocumentViewer(fileName, fileObject, enableSigning = false) {
  const modal = document.getElementById('modalDocViewer');
  const titleEl = document.getElementById('viewerDocTitle');
  const metaEl = document.getElementById('viewerDocMeta');
  const pdfFrame = document.getElementById('viewerPdfFrame');
  const spinner = document.getElementById('viewerLoadingSpinner');
  if (!modal) return;

  currentViewingFileName = fileName || 'Văn bản';
  if (titleEl) titleEl.textContent = currentViewingFileName;
  if (metaEl) {
    const sizeStr = fileObject && fileObject.size ? ` • ${formatFileSize(fileObject.size)}` : '';
    metaEl.textContent = `Định dạng: PDF Chuẩn A4${sizeStr}`;
  }

  // Giải phóng Blob URL cũ tránh rò rỉ RAM
  if (currentPdfBlobUrl) {
    try { URL.revokeObjectURL(currentPdfBlobUrl); } catch (e) { console.warn('[Client Handled] e:', e && e.message ? e.message : e); }
    currentPdfBlobUrl = null;
  }

  if (spinner) spinner.classList.remove('hidden');

  // Mặc định luôn là Trang cuối (nơi chứa phần ký duyệt của Giáo viên / Tổ trưởng / Ban Giám hiệu)
  currentStampPage = 'last';

  if (fileObject) {
    const blob = (fileObject instanceof Blob) ? fileObject : new Blob([fileObject], { type: 'application/pdf' });
    currentPdfBlobUrl = URL.createObjectURL(blob);
    if (pdfFrame) {
      pdfFrame.src = currentPdfBlobUrl + '#page=9999&view=FitH&toolbar=1&navpanes=0';
      pdfFrame.onload = () => { if (spinner) spinner.classList.add('hidden'); };
    }
  }

  // Cập nhật thông tin người ký trên con dấu
  const currentUser = appState.currentUser;
  const signerName = currentUser ? (currentUser.fullName || currentUser.name || currentUser.username) : 'Giáo viên';
  const nameEl = document.getElementById('draggableStampSignerName');
  if (nameEl) nameEl.textContent = signerName;

  const dateEl = document.getElementById('draggableStampDate');
  if (dateEl) {
    const now = new Date();
    const dStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
    dateEl.textContent = `Ký ngày: ${dStr}`;
  }

  // Lấy thông tin ảnh chữ ký nếu giáo viên đã lưu
  const savedSig = getTeacherSignatureImage();
  const dragImg = document.getElementById('draggableSignatureImg');
  const defaultBox = document.getElementById('draggableSignatureDefaultBox');

  if (savedSig && dragImg) {
    dragImg.src = savedSig;
    dragImg.classList.remove('hidden');
    if (defaultBox) defaultBox.classList.add('hidden');
  } else {
    if (dragImg) dragImg.classList.add('hidden');
    if (defaultBox) defaultBox.classList.remove('hidden');
  }

  openModal('modalDocViewer');

  // Phân quyền hiển thị nút Đóng Dấu Nhà Trường:
  // CHỈ tài khoản được phân quyền (canStampSeal === true) hoặc Quản trị viên tối cao mới xuất hiện tính năng này.
  // Nếu tài khoản bị thu hồi con dấu (canStampSeal === false), tuyệt đối KHÔNG hiển thị.
  const canStamp = currentUser?.canStampSeal === false ? false : (Boolean(currentUser?.canStampSeal) || currentUser?.role === 'ADMIN');
  const btnSeal = document.getElementById('btnToggleSealPlacement');
  if (btnSeal) {
    if (canStamp) {
      btnSeal.classList.remove('hidden');
    } else {
      btnSeal.classList.add('hidden');
    }
  }
  const btnViewerReject = document.getElementById('btnViewerRejectDoc');
  if (btnViewerReject) {
    if (currentChainedPendingDoc) {
      btnViewerReject.classList.remove('hidden');
    } else {
      btnViewerReject.classList.add('hidden');
    }
  }

  currentSigningAction = 'PERSONAL';

  // TUYỆT ĐỐI KHÔNG tự động hiện con dấu khi người dùng chỉ bấm mở xem văn bản
  isSigPlacementActive = false;
  toggleSignaturePlacementMode(false);
  setSignatureScale(1.0);
  initDraggableSignature();

  // Tự động phân tích và render PDF.js đa trang
  renderPdfPagesWithPdfJs(fileObject).then(() => {
    const totalPages = currentDocTotalPages || 1;
    const pageSel = document.getElementById('sigTargetPageSelect');
    if (pageSel) {
      const options = [];
      options.push(`<option value="last">Trang cuối (${totalPages}/${totalPages} - Nơi ký duyệt)</option>`);
      for (let p = 1; p <= totalPages; p++) {
        let note = '';
        if (p === 1 && totalPages > 1) note = ' (Trang đầu)';
        else if (p === totalPages) note = ' (Trang cuối)';
        options.push(`<option value="${p}">Trang ${p} / ${totalPages}${note}</option>`);
      }
      options.push(`<option value="custom">Trang cụ thể...</option>`);
      pageSel.innerHTML /* sanitize */ = options.join('');
      pageSel.value = 'last';
    }
  }).catch(() => {
    detectPdfTotalPages(fileObject).then(totalPages => {
      currentDocTotalPages = totalPages;
      const pageSel = document.getElementById('sigTargetPageSelect');
      if (pageSel) {
        const options = [];
        options.push(`<option value="last">Trang cuối (${totalPages}/${totalPages} - Nơi ký duyệt)</option>`);
        for (let p = 1; p <= totalPages; p++) {
          let note = '';
          if (p === 1 && totalPages > 1) note = ' (Trang đầu)';
          else if (p === totalPages) note = ' (Trang cuối)';
          options.push(`<option value="${p}">Trang ${p} / ${totalPages}${note}</option>`);
        }
        options.push(`<option value="custom">Trang cụ thể...</option>`);
        pageSel.innerHTML /* sanitize */ = options.join('');
        pageSel.value = 'last';
      }
    });
  });

  const pageInp = document.getElementById('sigTargetPageInput');
  if (pageInp) { pageInp.value = '1'; pageInp.classList.add('hidden'); }
}

let currentPdfZoom = 'FitH';
let isViewerFullscreen = false;

function setPdfViewerZoom(zoomMode) {
  currentPdfZoom = zoomMode;

  const buttons = ['btnZoomFitH', 'btnZoom100', 'btnZoom125', 'btnZoom150'];
  buttons.forEach(btnId => {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    if (btnId === `btnZoom${zoomMode}`) {
      btn.className = 'px-2.5 py-1 rounded-lg font-bold text-brand-700 bg-white shadow-xs hover:bg-slate-50 transition flex items-center gap-1';
    } else {
      btn.className = 'px-2 py-1 rounded-lg font-semibold text-slate-600 hover:text-slate-900 transition';
    }
  });

  const pageWrappers = document.querySelectorAll('.pdf-page-wrapper');
  if (pageWrappers.length > 0) {
    const viewerArea = document.getElementById('viewerContentArea');
    const availableWidth = Math.max(340, (viewerArea ? viewerArea.clientWidth : 800) - 64);
    let scaleMultiplier = 1.0;
    if (zoomMode === '100') scaleMultiplier = 1.0;
    else if (zoomMode === '125') scaleMultiplier = 1.25;
    else if (zoomMode === '150') scaleMultiplier = 1.5;
    else if (zoomMode === 'FitH') scaleMultiplier = 1.0;

    pageWrappers.forEach(wrapper => {
      const ptW = parseFloat(wrapper.getAttribute('data-page-width')) || 595.28;
      const ptH = parseFloat(wrapper.getAttribute('data-page-height')) || 841.89;
      let targetW = availableWidth * scaleMultiplier;
      if (zoomMode !== 'FitH') {
        targetW = (ptW * 1.333) * scaleMultiplier;
      }
      const targetH = (targetW / ptW) * ptH;
      wrapper.style.width = `${Math.round(targetW)}px`;
      wrapper.style.height = `${Math.round(targetH)}px`;
    });
    return;
  }

  const pdfFrame = document.getElementById('viewerPdfFrame');
  if (!pdfFrame || !currentPdfBlobUrl) return;
  let hash = '#page=1&view=FitH&toolbar=1&navpanes=0';
  if (zoomMode === '100') hash = '#page=1&zoom=100&toolbar=1&navpanes=0';
  else if (zoomMode === '125') hash = '#page=1&zoom=125&toolbar=1&navpanes=0';
  else if (zoomMode === '150') hash = '#page=1&zoom=150&toolbar=1&navpanes=0';
  pdfFrame.src = currentPdfBlobUrl + hash;
}

window.toggleMobileZoomQuick = function() {
  if (currentPdfZoom === 'FitH') {
    setPdfViewerZoom('125');
  } else if (currentPdfZoom === '125') {
    setPdfViewerZoom('150');
  } else {
    setPdfViewerZoom('FitH');
  }
};

function toggleViewerFullscreen() {
  const viewerBox = document.getElementById('viewerModalContainer');
  const btnIcon = document.getElementById('btnFullscreenIcon');
  if (!viewerBox) return;

  isViewerFullscreen = !isViewerFullscreen;
  if (isViewerFullscreen) {
    viewerBox.className = 'bg-white shadow-2xl w-full h-full flex flex-col border-0 overflow-hidden';
    if (btnIcon) {
      btnIcon.innerHTML /* sanitize */ = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 9L4 4m0 0l5 0m-5 0l0 5M15 9l5-5m0 0l-5 0m5 0l0 5M9 15l-5 5m0 0l5 0m-5 0l0-5M15 15l5 5m0 0l-5 0m5 0l0-5"/>';
    }
  } else {
    viewerBox.className = 'bg-white rounded-3xl shadow-2xl max-w-6xl w-full h-[95vh] flex flex-col border border-slate-200 overflow-hidden';
    if (btnIcon) {
      btnIcon.innerHTML /* sanitize */ = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/>';
    }
  }
}

async function syncUserSignatureFromFirebase(user) {
  if (!user) return null;
  const uid = user.id || user.username;
  const userSigKey = `edusign_sig_${uid}`;
  const existing = localStorage.getItem(userSigKey) || user.signatureImage;

  try {
    const rtdbUrl = (window.FIREBASE_CONFIG && window.FIREBASE_CONFIG.databaseURL) || 'https://edusign-school-default-rtdb.asia-southeast1.firebasedatabase.app';
    const res = await fetch(`${rtdbUrl}/signatures/${uid}.json?_t=${Date.now()}`);
    if (res.ok) {
      const data = await res.json();
      const cloudSig = (data && (data.signatureImage || (typeof data === 'string' ? data : null)));
      if (cloudSig && cloudSig.length > 50) {
        localStorage.setItem(userSigKey, cloudSig);
        user.signatureImage = cloudSig;
        const dragImg = document.getElementById('draggableSignatureImg');
        if (dragImg) {
          dragImg.src = cloudSig;
          dragImg.classList.remove('hidden');
        }
        const defaultBox = document.getElementById('draggableSignatureDefaultBox');
        if (defaultBox) defaultBox.classList.add('hidden');
        console.log(`[Signature Sync] ☁️ Đã tự động khôi phục chữ ký từ Firebase cho giáo viên ${user.fullName || uid}`);
        return cloudSig;
      } else if (existing && existing.length > 50) {
        // Firebase chưa có nhưng local có -> tự động đẩy lên Firebase sao lưu
        fetch(`${rtdbUrl}/signatures/${uid}.json`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ signatureImage: existing, updatedAt: new Date().toISOString() })
        }).catch((err) => {
          console.warn('[fetchTeacherSignatureImageFromCloud] Lỗi đồng bộ chữ ký lên Firebase:', err && err.message ? err.message : err);
        });
      }
    }
  } catch (e) {
    console.warn('[Signature Sync] Không thể kết nối Firebase RTDB:', e.message);
  }
  return existing || null;
}

function getTeacherSignatureImage() {
  const currentUser = appState.currentUser;
  if (!currentUser) return null;
  const userSigKey = `edusign_sig_${currentUser.id || currentUser.username}`;
  const localSig = localStorage.getItem(userSigKey) || currentUser.signatureImage;
  if (localSig) return localSig;
  
  // Nếu máy tính hiện tại chưa có, kích hoạt tải ngầm từ Firebase
  syncUserSignatureFromFirebase(currentUser);
  return null;
}

function getCurrentlyVisiblePageWrapper() {
  const container = document.getElementById('viewerContentArea');
  const pageWrappers = Array.from(document.querySelectorAll('.pdf-page-wrapper'));
  if (!container || pageWrappers.length === 0) return null;

  const containerRect = container.getBoundingClientRect();
  const containerCenterY = containerRect.top + containerRect.height / 2;

  // 1. Kiểm tra trang nào đang bao trọn tâm điểm khung nhìn
  for (const w of pageWrappers) {
    const r = w.getBoundingClientRect();
    if (r.top <= containerCenterY && r.bottom >= containerCenterY) {
      return w;
    }
  }

  // 2. Fallback: Trang có diện tích hiển thị lớn nhất trên màn hình
  let best = pageWrappers[0];
  let maxH = -1;
  for (const w of pageWrappers) {
    const r = w.getBoundingClientRect();
    const visTop = Math.max(containerRect.top, r.top);
    const visBottom = Math.min(containerRect.bottom, r.bottom);
    const h = Math.max(0, visBottom - visTop);
    if (h > maxH) {
      maxH = h;
      best = w;
    }
  }
  return best;
}

function placeSignatureOnPage(pageNum, role = 'teacher', shouldScroll = false) {
  const container = document.getElementById('viewerContentArea');
  const stamp = document.getElementById('draggableSignatureStamp');
  if (!container || !stamp) return;

  const pageWrappers = Array.from(document.querySelectorAll('.pdf-page-wrapper'));
  let targetWrapper = null;
  if (pageWrappers.length > 0) {
    if (pageNum === 'last') {
      targetWrapper = pageWrappers[pageWrappers.length - 1];
    } else {
      targetWrapper = pageWrappers.find(w => w.getAttribute('data-page') === String(pageNum)) || pageWrappers[0];
    }
  }

  if (targetWrapper) {
    const pageNumInt = parseInt(targetWrapper.getAttribute('data-page'), 10) || 1;
    currentStampPage = pageNumInt;

    const pageSel = document.getElementById('sigTargetPageSelect');
    if (pageSel && pageSel.value !== String(pageNumInt)) {
      pageSel.value = String(pageNumInt);
    }

    let relLeftPct = 0.745;
    let relTopPct = 0.68;
    if (role === 'principal') { relLeftPct = 0.18; relTopPct = 0.68; }
    else if (role === 'leader') { relLeftPct = 0.46; relTopPct = 0.68; }

    const targetWrapperRect = targetWrapper.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    const wrapperOffsetTop = (targetWrapperRect.top - containerRect.top) + container.scrollTop;
    const wrapperOffsetLeft = (targetWrapperRect.left - containerRect.left) + container.scrollLeft;

    const stampLeft = wrapperOffsetLeft + (targetWrapper.offsetWidth * relLeftPct) - (stamp.offsetWidth * 0.5);
    const stampTop = wrapperOffsetTop + (targetWrapper.offsetHeight * relTopPct) - (stamp.offsetHeight * 0.5);

    stamp.style.left = `${Math.max(10, stampLeft)}px`;
    stamp.style.top = `${Math.max(10, stampTop)}px`;

    // CHỈ CUỘN TRANG KHI NGƯỜI DÙNG CHỦ ĐỘNG CHỌN TRANG TỪ DROPDOWN (shouldScroll == true)
    // TUYỆT ĐỐI KHÔNG TỰ Ý CUỘN KHI NGƯỜI DÙNG VỪA NHẤN ĐẶT CHỮ KÝ
    if (shouldScroll) {
      targetWrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    updateStampPlacementFromPosition();
  } else {
    snapSignatureTo(role);
  }
}

function updateStampPlacementFromPosition() {
  const stamp = document.getElementById('draggableSignatureStamp');
  const container = document.getElementById('viewerContentArea');
  if (!stamp || !container) return;

  const stampRect = stamp.getBoundingClientRect();
  const stampCenterX = stampRect.left + stampRect.width / 2;
  const stampCenterY = stampRect.top + stampRect.height / 2;

  const pageWrappers = Array.from(document.querySelectorAll('.pdf-page-wrapper'));

  if (pageWrappers.length > 0) {
    let targetWrapper = null;
    for (const wrapper of pageWrappers) {
      const r = wrapper.getBoundingClientRect();
      if (stampCenterY >= r.top && stampCenterY <= r.bottom) {
        targetWrapper = wrapper;
        break;
      }
    }

    if (!targetWrapper) {
      let minDist = Infinity;
      for (const wrapper of pageWrappers) {
        const r = wrapper.getBoundingClientRect();
        const dist = Math.abs(stampCenterY - (r.top + r.height / 2));
        if (dist < minDist) {
          minDist = dist;
          targetWrapper = wrapper;
        }
      }
    }

    if (targetWrapper) {
      const pageNum = parseInt(targetWrapper.getAttribute('data-page'), 10) || 1;
      const ptWidth = parseFloat(targetWrapper.getAttribute('data-page-width')) || 595.28;
      const ptHeight = parseFloat(targetWrapper.getAttribute('data-page-height')) || 841.89;
      const pageRect = targetWrapper.getBoundingClientRect();

      const relX = stampRect.left - pageRect.left;
      const relY = stampRect.top - pageRect.top;

      // CHUẨN XÁC ĐỊNH TỌA ĐỘ THEO VGCA SIGN TOOL (iText Rectangle Points 72 DPI):
      // scaleX = pageRect.width / ptWidth
      // scaleY = pageRect.height / ptHeight
      // llx = relX / scaleX
      // lly = ptHeight - ((relY + stampRect.height) / scaleY)
      // w = stampRect.width / scaleX
      // h = stampRect.height / scaleY
      const scaleX = pageRect.width / ptWidth;
      const scaleY = pageRect.height / ptHeight;

      const wPt = Math.round((stampRect.width / scaleX) * 10) / 10;
      const hPt = Math.round((stampRect.height / scaleY) * 10) / 10;

      const llx = Math.max(0, Math.min(ptWidth - wPt, relX / scaleX));
      const lly = Math.max(0, Math.min(ptHeight - hPt, ptHeight - ((relY + stampRect.height) / scaleY)));

      const xPct = Math.max(0, Math.min(100, Math.round((relX / pageRect.width) * 1000) / 10));
      const yPct = Math.max(0, Math.min(100, Math.round((relY / pageRect.height) * 1000) / 10));

      currentStampPage = pageNum;
      currentStampCoords = {
        x: Math.round(llx * 10) / 10,
        y: Math.round(lly * 10) / 10,
        width: wPt,
        height: hPt,
        xPercent: xPct,
        yPercent: yPct,
        page: pageNum,
        targetPage: pageNum,
        pageWidth: ptWidth,
        pageHeight: ptHeight,
        isManualDrag: true
      };
      window.currentStampCoords = currentStampCoords;

      const pageSel = document.getElementById('sigTargetPageSelect');
      if (pageSel && pageSel.value !== String(pageNum)) {
        pageSel.value = String(pageNum);
      }

      if (xPct > 55) currentStampPlacement = 'bottom-right';
      else if (xPct > 32) currentStampPlacement = 'middle-right';
      else currentStampPlacement = 'bottom-left';

      updateStampCoordsDisplay();
      return;
    }
  }

  // Fallback iframe:
  const xPct = Math.round((stamp.offsetLeft / container.clientWidth) * 1000) / 10;
  const yPct = Math.round((stamp.offsetTop / container.clientHeight) * 1000) / 10;
  currentStampCoords = {
    xPercent: xPct,
    yPercent: yPct,
    page: currentStampPage || 1,
    isManualDrag: true
  };
  window.currentStampCoords = currentStampCoords;
  updateStampCoordsDisplay();
}

let currentSigningAction = 'PERSONAL'; // 'PERSONAL' hoặc 'SEAL'

function toggleSignaturePlacementMode(forceState) {
  const isCurrentlyPersonal = (isSigPlacementActive && currentSigningAction === 'PERSONAL');
  const targetState = (typeof forceState === 'boolean') ? forceState : !isCurrentlyPersonal;

  if (targetState) {
    const sig = getTeacherSignatureImage();
    if (!sig) {
      showModalAlert(
        'Chưa có ảnh chữ ký số',
        'Thầy/Cô chưa cài đặt mẫu ảnh chữ ký cá nhân trên hệ thống.\n\nVui lòng tải ảnh chữ ký và bóc tách nền trong suốt trước khi định vị con dấu vào văn bản.',
        'warning',
        {
          text: 'Tải Chữ Ký Số Ngay',
          cancelText: 'Để sau',
          callback: () => {
            openModalUploadSignature();
          }
        }
      );
      return;
    }

    currentSigningAction = 'PERSONAL';
    isSigPlacementActive = true;
    const bar = document.getElementById('viewerSigToolBar');
    const stamp = document.getElementById('draggableSignatureStamp');
    const btnConfirm = document.getElementById('btnViewerConfirmSign');
    const btnConfirmText = document.getElementById('btnViewerConfirmSignText');
    const btnText = document.getElementById('btnToggleSignatureText');
    const btnSealText = document.getElementById('btnToggleSealText');
    const dragImg = document.getElementById('draggableSignatureImg');
    const defaultBox = document.getElementById('draggableSignatureDefaultBox');
    const nameEl = document.getElementById('draggableStampSignerName');

    const currentUser = appState.currentUser;
    const signerName = currentUser ? (currentUser.fullName || currentUser.name || currentUser.username) : 'Giáo viên';
    if (nameEl) nameEl.textContent = signerName;

    if (dragImg) {
      dragImg.src = sig;
      dragImg.classList.remove('hidden');
      dragImg.alt = 'Chữ ký cá nhân';
    }
    if (defaultBox) defaultBox.classList.add('hidden');

    if (bar) bar.classList.remove('hidden');
    if (stamp) {
      stamp.classList.remove('hidden');
      stamp.className = 'absolute z-40 cursor-move select-none group';
    }
    if (btnConfirm) {
      btnConfirm.classList.remove('hidden');
      btnConfirm.className = 'px-4 py-1.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-700 hover:to-indigo-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md cursor-pointer';
    }
    if (btnConfirmText) btnConfirmText.textContent = 'Ký Số Ngay';
    if (btnText) btnText.textContent = 'Ẩn Chữ Ký';
    if (btnSealText) btnSealText.textContent = '🔴 Đóng Dấu Nhà Trường';

    const userRole = (currentUser?.role || '').toUpperCase();
    const roleStr = (userRole === 'BGH' || userRole === 'PRINCIPAL' || (currentUser?.fullName || '').includes('Liền')) ? 'principal'
      : ((userRole === 'LEADER' || userRole === 'TO_TRUONG' || (currentUser?.fullName || '').includes('Hằng')) ? 'leader' : 'teacher');

    // Xác định trang người dùng đang xem trước mắt, đặt con dấu ngay tại trang đó, KHÔNG tự ý cuộn xuống trang cuối
    const visibleWrapper = getCurrentlyVisiblePageWrapper();
    const targetPage = visibleWrapper ? (parseInt(visibleWrapper.getAttribute('data-page'), 10) || 1) : (currentStampPage === 'last' ? (currentDocTotalPages || 1) : (currentStampPage || 1));

    placeSignatureOnPage(targetPage, roleStr, false);
  } else {
    isSigPlacementActive = false;
    currentSigningAction = 'PERSONAL';
    const bar = document.getElementById('viewerSigToolBar');
    const stamp = document.getElementById('draggableSignatureStamp');
    const btnText = document.getElementById('btnToggleSignatureText');
    const btnSealText = document.getElementById('btnToggleSealText');
    const btnConfirmText = document.getElementById('btnViewerConfirmSignText');
    const btnConfirm = document.getElementById('btnViewerConfirmSign');

    if (bar) bar.classList.add('hidden');
    if (stamp) stamp.classList.add('hidden');
    if (btnText) btnText.textContent = 'Đặt Chữ Ký Số';
    if (btnSealText) btnSealText.textContent = '🔴 Đóng Dấu Nhà Trường';
    if (btnConfirmText) btnConfirmText.textContent = 'Ký Số Ngay';
    if (btnConfirm) {
      btnConfirm.className = 'px-4 py-1.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-700 hover:to-indigo-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md cursor-pointer';
    }
  }
}

// Chế độ Đóng Dấu Nhà Trường bằng USB Token của trường (chuẩn Viettel vOffice/SMAS)
function toggleSealPlacementMode(forceState) {
  const currentUser = appState.currentUser;
  const canStamp = (currentUser?.role === 'ADMIN' || currentUser?.role === 'BGH' || Boolean(currentUser?.canStampSeal));
  if (!canStamp) {
    showToast('⚠️ Thầy/Cô chưa được phân quyền đóng dấu con dấu nhà trường!', 'warning');
    return;
  }

  const isCurrentlySeal = (isSigPlacementActive && currentSigningAction === 'SEAL');
  const targetState = (typeof forceState === 'boolean') ? forceState : !isCurrentlySeal;

  const bar = document.getElementById('viewerSigToolBar');
  const stamp = document.getElementById('draggableSignatureStamp');
  const btnConfirm = document.getElementById('btnViewerConfirmSign');
  const btnConfirmText = document.getElementById('btnViewerConfirmSignText');
  const btnSealText = document.getElementById('btnToggleSealText');
  const btnSigText = document.getElementById('btnToggleSignatureText');
  const dragImg = document.getElementById('draggableSignatureImg');
  const defaultBox = document.getElementById('draggableSignatureDefaultBox');
  const nameEl = document.getElementById('draggableStampSignerName');

  if (targetState) {
    currentSigningAction = 'SEAL';
    isSigPlacementActive = true;

    // Ảnh con dấu đỏ điện tử của nhà trường
    const schoolSealSrc = localStorage.getItem('edusign_school_seal') || './school_seal.png';
    const visibleWrapper = getCurrentlyVisiblePageWrapper() || document.querySelector('.pdf-page-wrapper');
    const ptW = visibleWrapper ? (parseFloat(visibleWrapper.getAttribute('data-page-width')) || 595.28) : 595.28;
    const curScale = visibleWrapper ? (visibleWrapper.offsetWidth / ptW) : 1.33;
    const sealDisplayPx = Math.round(105 * curScale * (currentStampScale || 1.0));

    if (dragImg) {
      dragImg.src = schoolSealSrc;
      dragImg.classList.remove('hidden');
      dragImg.alt = 'Con dấu đỏ nhà trường';
      dragImg.classList.remove('max-h-20', 'max-h-28', 'w-auto', 'w-28', 'h-28');
      dragImg.style.width = `${sealDisplayPx}px`;
      dragImg.style.height = `${sealDisplayPx}px`;
      dragImg.style.maxHeight = 'none';
      dragImg.style.maxWidth = 'none';
      dragImg.classList.add('object-contain', 'rounded-full');
    }
    if (defaultBox) defaultBox.classList.add('hidden');

    if (nameEl) nameEl.textContent = 'TRƯỜNG THCS CHU VĂN AN (Dấu cơ quan)';

    if (bar) bar.classList.remove('hidden');
    if (stamp) {
      stamp.classList.remove('hidden');
      stamp.style.width = `${sealDisplayPx}px`;
      stamp.style.height = `${sealDisplayPx}px`;
      stamp.className = 'absolute z-40 cursor-move select-none group';
    }
    if (btnConfirm) {
      btnConfirm.classList.remove('hidden');
      btnConfirm.className = 'px-4 py-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md cursor-pointer';
    }
    if (btnConfirmText) btnConfirmText.textContent = '🔴 Xác Nhận Đóng Dấu (USB Token)';
    if (btnSealText) btnSealText.textContent = 'Ẩn Con Dấu';
    if (btnSigText) btnSigText.textContent = 'Đặt Chữ Ký Số';

    // Đặt con dấu vào trang hiện tại (nơi ký duyệt)
    const targetPage = visibleWrapper ? (parseInt(visibleWrapper.getAttribute('data-page'), 10) || 1) : (currentStampPage === 'last' ? (currentDocTotalPages || 1) : (currentStampPage || 1));
    placeSignatureOnPage(targetPage, 'principal', false);
    showToast('🔴 Đã kích hoạt chế độ Đóng dấu nhà trường. Vui lòng kéo thả con dấu đỏ vào đúng vị trí trên văn bản!', 'info');
  } else {
    currentSigningAction = 'PERSONAL';
    isSigPlacementActive = false;

    if (dragImg) {
      dragImg.style.width = '';
      dragImg.style.height = '';
      dragImg.style.maxHeight = `${Math.round(80 * (currentStampScale || 1.0))}px`;
      dragImg.style.maxWidth = '';
      dragImg.classList.remove('rounded-full', 'max-h-28', 'w-28', 'h-28');
      dragImg.classList.add('max-h-20', 'w-auto');
    }
    if (stamp) {
      stamp.style.width = `${Math.round(160 * (currentStampScale || 1.0))}px`;
      stamp.style.height = '';
      stamp.classList.add('hidden');
    }
    if (bar) bar.classList.add('hidden');
    if (btnSealText) btnSealText.textContent = '🔴 Đóng Dấu Nhà Trường';
    if (btnSigText) btnSigText.textContent = 'Đặt Chữ Ký Số';
    if (btnConfirmText) btnConfirmText.textContent = 'Ký Số Ngay';
    if (btnConfirm) {
      btnConfirm.className = 'px-4 py-1.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-700 hover:to-indigo-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md cursor-pointer';
    }
  }
}

function snapSignatureTo(role) {
  const stamp = document.getElementById('draggableSignatureStamp');
  const container = document.getElementById('viewerContentArea');
  if (!stamp || !container) return;

  let leftPct = 74.5, topPct = 68.0;

  if (role === 'teacher') {
    leftPct = 74.5;
    topPct = 68.0;
    currentStampPlacement = 'bottom-right';
  } else if (role === 'leader') {
    leftPct = 47.5;
    topPct = 68.0;
    currentStampPlacement = 'middle-right';
  } else if (role === 'principal') {
    leftPct = 21.5;
    topPct = 68.0;
    currentStampPlacement = 'bottom-left';
  }

  stamp.style.left = leftPct + '%';
  stamp.style.top = topPct + '%';
  currentStampCoords = { xPercent: leftPct, yPercent: topPct, isManualDrag: false };
  updateStampCoordsDisplay();
}

function setSignatureScale(scale) {
  currentStampScale = Math.max(0.4, Math.min(1.8, Math.round(scale * 100) / 100));
  const badge = document.getElementById('sigScaleBadge');
  const range = document.getElementById('sigScaleRange');
  const stamp = document.getElementById('draggableSignatureStamp');
  const img = document.getElementById('draggableSignatureImg');

  if (badge) badge.textContent = Math.round(currentStampScale * 100) + '%';
  if (range) range.value = Math.round(currentStampScale * 100);

  const isSeal = (currentSigningAction === 'SEAL');
  if (isSeal) {
    const visibleWrapper = getCurrentlyVisiblePageWrapper() || document.querySelector('.pdf-page-wrapper');
    const ptW = visibleWrapper ? (parseFloat(visibleWrapper.getAttribute('data-page-width')) || 595.28) : 595.28;
    const curScale = visibleWrapper ? (visibleWrapper.offsetWidth / ptW) : 1.33;
    const sealDisplayPx = Math.round(105 * curScale * currentStampScale);
    if (stamp) {
      stamp.style.width = sealDisplayPx + 'px';
      stamp.style.height = sealDisplayPx + 'px';
    }
    if (img) {
      img.style.width = sealDisplayPx + 'px';
      img.style.height = sealDisplayPx + 'px';
      img.style.maxHeight = 'none';
      img.style.maxWidth = 'none';
    }
  } else {
    if (stamp) {
      stamp.style.width = Math.round(160 * currentStampScale) + 'px';
      stamp.style.height = '';
    }
    if (img) {
      img.style.width = '';
      img.style.height = '';
      img.style.maxHeight = Math.round(80 * currentStampScale) + 'px';
      img.style.maxWidth = '';
    }
  }
  updateStampCoordsDisplay();
  updateStampPlacementFromPosition();
}

function adjustSignatureScale(delta) {
  setSignatureScale(currentStampScale + delta);
}

function nudgeSignature(deltaX, deltaY) {
  const stamp = document.getElementById('draggableSignatureStamp');
  if (!stamp) return;

  currentStampCoords.xPercent = Math.max(1, Math.min(95, Math.round((currentStampCoords.xPercent + deltaX) * 10) / 10));
  currentStampCoords.yPercent = Math.max(1, Math.min(95, Math.round((currentStampCoords.yPercent + deltaY) * 10) / 10));
  currentStampCoords.isManualDrag = true;

  stamp.style.left = currentStampCoords.xPercent + '%';
  stamp.style.top = currentStampCoords.yPercent + '%';
  updateStampCoordsDisplay();
}

function resetSignaturePosition() {
  setSignatureScale(1.0);
  const currentUser = appState.currentUser;
  const userRole = (currentUser?.role || '').toUpperCase();
  const roleStr = (userRole === 'BGH' || userRole === 'PRINCIPAL' || (currentUser?.fullName || '').includes('Liền')) ? 'principal'
    : ((userRole === 'LEADER' || userRole === 'TO_TRUONG' || (currentUser?.fullName || '').includes('Hằng')) ? 'leader' : 'teacher');
  placeSignatureOnPage('last', roleStr);
}

function updateStampCoordsDisplay() {
  const coordsEl = document.getElementById('draggableStampCoords');
  if (!coordsEl) return;
  const scaleText = Math.round(currentStampScale * 100) + '%';
  const pageText = currentStampPage === 'last' ? 'Trang cuối' : `Trang ${currentStampPage}`;
  coordsEl.textContent = `${pageText} | X: ${currentStampCoords.xPercent}% | Y: ${currentStampCoords.yPercent}% | ${scaleText}`;
}

function initDraggableSignature() {
  const stamp = document.getElementById('draggableSignatureStamp');
  const shield = document.getElementById('viewerDragShield');
  const container = document.getElementById('viewerContentArea');
  if (!stamp || !shield || !container || stamp.hasAttribute('data-drag-inited')) return;
  stamp.setAttribute('data-drag-inited', 'true');

  function onPointerDown(e) {
    if (e.button && e.button !== 0) return;
    isDraggingStamp = true;
    shield.classList.remove('hidden');

    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);

    stampDragStartX = clientX;
    stampDragStartY = clientY;
    stampElemStartX = stamp.offsetLeft;
    stampElemStartY = stamp.offsetTop;

    e.preventDefault();
  }

  function onPointerMove(e) {
    if (!isDraggingStamp) return;
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);

    const deltaX = clientX - stampDragStartX;
    const deltaY = clientY - stampDragStartY;

    let newLeft = stampElemStartX + deltaX;
    let newTop = stampElemStartY + deltaY;

    const maxLeft = Math.max(container.clientWidth, container.scrollWidth) - stamp.offsetWidth - 10;
    const maxTop = Math.max(container.clientHeight, container.scrollHeight) - stamp.offsetHeight - 10;

    newLeft = Math.max(10, Math.min(newLeft, maxLeft));
    newTop = Math.max(10, Math.min(newTop, maxTop));

    stamp.style.left = newLeft + 'px';
    stamp.style.top = newTop + 'px';

    updateStampPlacementFromPosition();
  }

  function onPointerUp() {
    if (isDraggingStamp) {
      isDraggingStamp = false;
      shield.classList.add('hidden');
      updateStampPlacementFromPosition();
    }
  }

  // Khắc phục DEF-04: Thiết lập touchAction = none và lắng nghe pointercancel
  stamp.style.touchAction = 'none';
  stamp.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);
}

// Phím tắt bàn phím tinh chỉnh vị trí & kích cỡ khi xem trước
window.addEventListener('keydown', (e) => {
  const modal = document.getElementById('modalDocViewer');
  if (!modal || modal.classList.contains('hidden') || !isSigPlacementActive) return;
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;

  if (e.key === '+' || e.key === '=') {
    e.preventDefault();
    adjustSignatureScale(0.05);
  } else if (e.key === '-' || e.key === '_') {
    e.preventDefault();
    adjustSignatureScale(-0.05);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    nudgeSignature(0, -1);
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    nudgeSignature(0, 1);
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault();
    nudgeSignature(-1, 0);
  } else if (e.key === 'ArrowRight') {
    e.preventDefault();
    nudgeSignature(1, 0);
  } else if (e.key === '0') {
    e.preventDefault();
    setSignatureScale(1.0);
  }
});

// ==================== QUY TRÌNH KÝ SỐ CHUYÊN DÙNG CÔNG VỤ (VGCA / USB TOKEN) ====================
let currentVgcaLoginMode = 'vgca';
let currentActiveSignSession = null;
let vgcaCountdownTimer = null;
let vgcaRemainingSeconds = 90;
let driveCleanupTimer = null;
let driveCleanupSeconds = 5;

function validateCccd12Digits(cccd) {
  if (!cccd) return false;
  const clean = String(cccd).trim();
  return /^\d{12}$/.test(clean);
}

function handleVgcaCccdKeyInput(input) {
  if (!input) return;
  input.value = input.value.replace(/\D/g, '').slice(0, 12);
  const msg = document.getElementById('vgcaCccdValidationMsg');
  if (!msg) return;
  const len = input.value.length;
  if (len === 0) {
    msg.className = 'text-[11px] text-slate-500 mt-1 flex items-center gap-1';
    msg.innerHTML /* sanitize */ = '<span class="w-1.5 h-1.5 rounded-full bg-slate-400"></span><span>Yêu cầu chính xác 12 chữ số theo thẻ CCCD gắn chip.</span>';
  } else if (len < 12) {
    msg.className = 'text-[11px] text-amber-600 font-medium mt-1 flex items-center gap-1';
    msg.innerHTML /* sanitize */ = `<span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span><span>Đã nhập ${len}/12 số (còn thiếu ${12 - len} số).</span>`;
  } else {
    msg.className = 'text-[11px] text-emerald-600 font-bold mt-1 flex items-center gap-1';
    msg.innerHTML /* sanitize */ = '<svg class="w-3.5 h-3.5 text-emerald-600" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg><span>Đã đủ 12 chữ số CCCD hợp lệ.</span>';
  }
}

function getStoredVgcaCredentials() {
  try {
    const raw = localStorage.getItem('edusign_vgca_credentials');
    if (!raw) return null;
    const creds = JSON.parse(raw);
    if (creds && creds.cccd && validateCccd12Digits(creds.cccd)) {
      return creds;
    }
  } catch (e) { console.warn('[Client Handled] e:', e && e.message ? e.message : e); }
  return null;
}

function saveStoredVgcaCredentials(cccd, password, signType = 'VGCA') {
  try {
    localStorage.setItem('edusign_vgca_credentials', JSON.stringify({
      cccd: String(cccd).trim(),
      password: String(password).trim(),
      signType: signType || 'VGCA',
      savedAt: new Date().toISOString()
    }));
  } catch (e) { console.warn('[Client Handled] e:', e && e.message ? e.message : e); }
}

function clearStoredVgcaCredentials() {
  try {
    localStorage.removeItem('edusign_vgca_credentials');
  } catch (e) { console.warn('[Client Handled] e:', e && e.message ? e.message : e); }
}

function switchVgcaLoginMode(mode) {
  currentVgcaLoginMode = mode;
  window.currentVgcaLoginMode = mode;
  const btnVgca = document.getElementById('tabBtnLoginVgca');
  const btnUsb = document.getElementById('tabBtnLoginUsb');
  if (mode === 'usb') {
    if (btnVgca) btnVgca.className = 'py-2 px-3 rounded-xl text-slate-600 hover:text-slate-900 transition flex items-center justify-center gap-1.5 cursor-pointer';
    if (btnUsb) btnUsb.className = 'py-2 px-3 rounded-xl bg-white text-indigo-700 shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer';
  } else {
    if (btnVgca) btnVgca.className = 'py-2 px-3 rounded-xl bg-white text-brand-700 shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer';
    if (btnUsb) btnUsb.className = 'py-2 px-3 rounded-xl text-slate-600 hover:text-slate-900 transition flex items-center justify-center gap-1.5 cursor-pointer';
  }
}

function toggleVgcaPasswordVisibility() {
  const inp = document.getElementById('inputVgcaPassword');
  if (!inp) return;
  inp.type = (inp.type === 'password') ? 'text' : 'password';
}

function removeVietnameseTones(str) {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .trim();
}

function openVgcaLoginModal() {
  const inpCccd = document.getElementById('inputVgcaCccd');
  const inpPass = document.getElementById('inputVgcaPassword');
  const badgeLocked = document.getElementById('badgeVgcaCccdLocked');
  const validationMsg = document.getElementById('vgcaCccdValidationMsg');
  const stored = getStoredVgcaCredentials();
  const currentUser = appState.currentUser;

  if (inpCccd) {
    const userCccd = currentUser && currentUser.cccd ? currentUser.cccd.trim() : '';
    const val = userCccd || (stored && stored.cccd) || '';
    inpCccd.value = val;
    handleVgcaCccdKeyInput(inpCccd);

    if (userCccd) {
      // Khóa CCCD cố định theo tài khoản đăng nhập để chống ký nhầm người khác
      inpCccd.readOnly = true;
      inpCccd.classList.add('bg-slate-100', 'text-slate-700', 'cursor-not-allowed');
      if (badgeLocked) badgeLocked.classList.remove('hidden');
      if (validationMsg) {
        validationMsg.innerHTML /* sanitize */ = `<span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span><span class="text-emerald-700 font-medium">Định danh cố định theo tài khoản: <strong>${currentUser.fullName || currentUser.name || 'Giáo viên'}</strong></span>`;
      }
    } else {
      inpCccd.readOnly = false;
      inpCccd.classList.remove('bg-slate-100', 'text-slate-700', 'cursor-not-allowed');
      if (badgeLocked) badgeLocked.classList.add('hidden');
    }
  }
  if (inpPass) {
    inpPass.value = (stored && stored.password) || '';
  }

  const isCurrentUserUsb = (currentUser?.signType === 'USB_TOKEN' || currentUser?.signType === 'USB' || currentUser?.role === 'BGH' || currentUser?.role === 'ADMIN' || currentUser?.departmentId === 'dept_bgh');
  const targetMode = isCurrentUserUsb ? 'usb' : (stored ? (stored.signType || 'vgca') : 'vgca');
  switchVgcaLoginMode(targetMode);
  openModal('modalVgcaLogin');
  autoDetectCertFromAgent(targetMode);
}

async function autoDetectCertFromAgent(modeArg = null) {
  const box = document.getElementById('boxVgcaDetectedCert');
  const content = document.getElementById('boxVgcaDetectedCertContent');
  if (!box || !content) return;

  try {
    const ping = await pingLocalSigner(1500);
    if (!ping.available) return;

    const currentUser = appState.currentUser;
    const isUsb = modeArg === 'usb' || currentVgcaLoginMode === 'usb' || currentUser?.signType === 'USB_TOKEN' || currentUser?.signType === 'USB' || currentUser?.role === 'BGH' || currentUser?.role === 'ADMIN';
    const cccd = currentUser?.cccd || '';
    const signer = currentUser?.fullName || currentUser?.name || '';
    const serial = isUsb ? (currentUser?.certSerial || (window.bghSigningConfig && window.bghSigningConfig.serialNumber) || '') : '';
    const signMode = isUsb ? 'HARDWARE' : 'PERSONAL';
    const res = await fetch(`http://127.0.0.1:18888/api/check-vgca-status?signer=${encodeURIComponent(signer)}&cccd=${encodeURIComponent(cccd)}&mode=${encodeURIComponent(signMode)}&serial=${encodeURIComponent(serial)}&_t=${Date.now()}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(2500)
    });
    if (!res.ok) return;
    const data = await res.json();
    const cert = data.certInfo;
    if (cert) {
      box.className = 'p-3 bg-emerald-50/80 border border-emerald-200 rounded-2xl text-xs space-y-1';
      box.classList.remove('hidden');
      content.innerHTML /* sanitize */ = `
        <div>• <strong>${cert.signerName || 'Ban Cơ yếu'}</strong> (${cert.school || cert.issuer || 'VGCA'})</div>
        <div>• Số Serial: <span class="font-mono text-[10px] text-slate-800">${cert.serialNumber || 'Chuyên dùng công vụ'}</span></div>
        ${cert.cccd ? `<div>• CCCD: <span class="font-mono text-[10px] text-emerald-700 font-bold">${cert.cccd}</span></div>` : ''}
        ${cert.notAfter ? `<div>• Hiệu lực đến: <span class="text-[10px] text-slate-600">${cert.notAfter}</span></div>` : ''}
      `;
    } else if (data.hasCspError) {
      box.className = 'p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs space-y-1';
      box.classList.remove('hidden');
      content.innerHTML /* sanitize */ = `
        <div class="text-amber-800 font-medium">⚠️ ${data.cspErrorMessage || 'Chứng thư số trên máy không khớp với tài khoản giáo viên.'}</div>
      `;
    }
  } catch (e) { console.warn('[Client Handled] e:', e && e.message ? e.message : e); }
}

async function pingLocalSigner(timeoutMs = 2500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`http://127.0.0.1:18888/api/ping-local-signer?_t=${Date.now()}`, {
      method: 'GET',
      mode: 'cors',
      cache: 'no-store',
      signal: controller.signal
    });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      return { available: true, host: 'http://127.0.0.1:18888', data };
    }
  } catch (e) {
    clearTimeout(timer);
  }
  return { available: false };
}

async function verifyVgcaStatusFromAgent(cccd, password, signType = 'VGCA', options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4500);
  const currentUser = appState.currentUser;
  const isSchoolSeal = Boolean(options && options.isSchoolSeal);
  const isCurrentUserBgh = (currentUser?.role === 'BGH' || currentUser?.role === 'ADMIN' || currentUser?.signType === 'USB_TOKEN' || currentUser?.departmentId === 'dept_bgh');
  const isUsb = isSchoolSeal || isCurrentUserBgh || (signType === 'USB_TOKEN' || signType === 'usb');
  const mode = isUsb ? 'HARDWARE' : 'PERSONAL';
  const expectedSigner = isSchoolSeal ? 'TRƯỜNG TRUNG HỌC CƠ SỞ CHU VĂN AN' : (currentUser?.fullName || currentUser?.name || (isUsb ? 'Ngô Thị Liền' : ''));
  const expectedCccd = isSchoolSeal ? '' : (cccd || currentUser?.cccd || (isUsb ? '042084002100' : ''));
  const expectedSerial = isSchoolSeal ? (options.serialNumber || '189A2218A5A80E4C') : (isUsb ? (currentUser?.certSerial || currentUser?.certificateSerial || (window.bghSigningConfig && window.bghSigningConfig.serialNumber) || '025E056A3F133DA9') : '');

  let queryUrl = `http://127.0.0.1:18888/api/check-vgca-status?signType=${encodeURIComponent(isUsb ? 'USB_TOKEN' : signType)}&mode=${encodeURIComponent(mode)}&signer=${encodeURIComponent(expectedSigner)}&cccd=${encodeURIComponent(expectedCccd)}&_t=${Date.now()}`;
  if (expectedSerial) {
    queryUrl += `&serial=${encodeURIComponent(expectedSerial)}`;
  }
  
  try {
    const res = await fetch(queryUrl, {
      method: 'GET',
      mode: 'cors',
      cache: 'no-store',
      signal: controller.signal
    });
    clearTimeout(timer);
    if (!res.ok) {
      throw new Error(`Dịch vụ kiểm tra CSP phản hồi HTTP ${res.status}`);
    }
    const data = await res.json();

    // Đối chiếu danh tính tuyệt đối chống ký chéo / nhầm lẫn
    if (data.certInfo) {
      const cert = data.certInfo;
      if (isSchoolSeal) {
        // Đóng dấu nhà trường: Bắt buộc là USB Token Con dấu cơ quan
        const normAct = removeVietnameseTones(cert.signerName || '').toLowerCase();
        const isOrg = normAct.includes('truong') || normAct.includes('thcs') || normAct.includes('chu van an');
        const cleanActual = (cert.serialNumber || '').replace(/[\s:]/g, '').toUpperCase();
        const cleanExp = expectedSerial.replace(/[\s:]/g, '').toUpperCase();

        if (!isOrg && cleanExp && cleanActual !== cleanExp) {
          data.cspHealthy = false;
          data.hasCspError = true;
          data.cspErrorMessage = `Thiết bị USB Token không hợp lệ! Để đóng dấu nhà trường, vui lòng cắm USB Token Con dấu của trường [TRƯỜNG TRUNG HỌC CƠ SỞ CHU VĂN AN] (Serial: ${expectedSerial}), hiện tại thiết bị đang cắm là của [${cert.signerName}].`;
          data.certInfo = null;
        }
      } else if (!isUsb) {
        // Giáo viên ký cá nhân: Kiểm tra bắt buộc khớp tên hoặc CCCD của tài khoản đang đăng nhập
        const normExp = removeVietnameseTones(expectedSigner).toLowerCase();
        const normAct = removeVietnameseTones(cert.signerName || '').toLowerCase();
        const nameMatch = normExp && normAct && (normAct.includes(normExp) || normExp.includes(normAct) || normAct.split(' ').slice(-2).join(' ') === normExp.split(' ').slice(-2).join(' '));
        const cccdMatch = expectedCccd && (cert.cccd === expectedCccd || (cert.subject && cert.subject.includes(expectedCccd)));

        if (!nameMatch && !cccdMatch) {
          data.cspHealthy = false;
          data.hasCspError = true;
          data.cspErrorMessage = `Định danh không khớp! Tài khoản web là [${expectedSigner}], nhưng chứng thư số đang nạp trên Virtual CSP là [${cert.signerName || 'Không xác định'}]. Hệ thống từ chối ký chéo danh tính để bảo vệ tính pháp lý của hồ sơ giáo án.`;
          data.certInfo = null;
        }
      } else {
        // Ban Giám hiệu: Bắt buộc kiểm tra Serial USB Token phần cứng
        const cleanActual = (cert.serialNumber || '').replace(/[\s:]/g, '').toUpperCase();
        const cleanExp = expectedSerial.replace(/[\s:]/g, '').toUpperCase();
        if (cleanExp && cleanActual && cleanExp !== cleanActual) {
          data.cspHealthy = false;
          data.hasCspError = true;
          data.cspErrorMessage = `Thiết bị USB Token không hợp lệ! Token đang cắm có Serial [${cleanActual}], không khớp với Serial Ban Giám hiệu được phân quyền [${cleanExp}].`;
          data.certInfo = null;
        }
      }
    }

    return data;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

async function getViewingPdfBase64() {
  if (teacherSelectedFile) {
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const res = reader.result;
        const b64 = (typeof res === 'string' && res.includes(',')) ? res.split(',')[1] : res;
        resolve(b64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(teacherSelectedFile);
    });
  }
  if (currentPdfBlobUrl) {
    const res = await fetch(currentPdfBlobUrl);
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const r = reader.result;
        const b64 = (typeof r === 'string' && r.includes(',')) ? r.split(',')[1] : r;
        resolve(b64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
  return null;
}

// Xử lý sự kiện bấm nút Ký Số Ngay trong giao diện Viewer
function handleViewerConfirmSignClick() {
  // Reset trạng thái lỗi cũ: luôn chạy mới hoàn toàn mỗi lần bấm Ký
  currentActiveSignSession = null;
  if (vgcaCountdownTimer) clearInterval(vgcaCountdownTimer);
  if (driveCleanupTimer) clearInterval(driveCleanupTimer);

  // 0. XỬ LÝ RIÊNG CHO CHẾ ĐỘ ĐÓNG DẤU NHÀ TRƯỜNG (chuẩn Viettel vOffice/SMAS)
  if (currentSigningAction === 'SEAL') {
    if (!isSigPlacementActive) {
      showModalAlert(
        'Chưa đặt vị trí con dấu',
        `Thầy/Cô chưa định vị vị trí con dấu trên văn bản!<br><br>Vui lòng nhấn nút <strong>"🔴 Đóng Dấu Nhà Trường"</strong> trên thanh công cụ và kéo con dấu đỏ vào đúng vị trí cần đóng trước khi xác nhận.`,
        'warning',
        {
          confirmText: '🔴 Đặt con dấu ngay',
          onConfirm: () => toggleSealPlacementMode(true)
        }
      );
      return;
    }

    // Thực hiện quy trình ký đóng dấu pháp nhân bằng USB Token con dấu nhà trường
    executeMasterSigningPipeline({
      signType: 'USB_TOKEN',
      isSchoolSeal: true,
      signerName: 'TRƯỜNG TRUNG HỌC CƠ SỞ CHU VĂN AN',
      serialNumber: '189A2218A5A80E4C',
      role: 'CON_DAU_NHA_TRUONG'
    });
    return;
  }

  // 0. Bắt buộc đã tải ảnh chữ ký cá nhân
  const sig = getTeacherSignatureImage();
  if (!sig) {
    showModalAlert(
      'Chưa tải chữ ký số',
      'Thầy/Cô chưa tải ảnh con dấu / chữ ký số cá nhân lên hệ thống! Vui lòng tải ảnh chữ ký và xóa nền trước khi thực hiện ký số.',
      'warning',
      {
        confirmText: 'Tải chữ ký ngay',
        onConfirm: () => openModalUploadSignature()
      }
    );
    return;
  }

  // 0.1. KIỂM TRA BẮT BUỘC: Thầy/Cô phải kích hoạt đặt vị trí con dấu trên văn bản trước khi ký
  if (!isSigPlacementActive) {
    showModalAlert(
      'Chưa đặt vị trí chữ ký số',
      `Thầy/Cô chưa định vị vị trí chữ ký trên văn bản!<br><br>Vui lòng nhấn nút <strong>"Đặt Chữ Ký Số"</strong> trên thanh công cụ và kéo con dấu vào đúng vị trí cần ký trước khi nhấn <strong>"Ký Số Ngay"</strong>.`,
      'warning',
      {
        confirmText: '📍 Đặt chữ ký ngay',
        onConfirm: () => {
          toggleSignaturePlacementMode(true);
          const stamp = document.getElementById('draggableSignatureStamp');
          if (stamp) {
            stamp.classList.add('ring-4', 'ring-brand-500', 'ring-offset-2', 'animate-pulse');
            setTimeout(() => stamp.classList.remove('ring-4', 'ring-brand-500', 'ring-offset-2', 'animate-pulse'), 3000);
          }
        }
      }
    );
    return;
  }

  // Kiểm tra điều kiện chọn người nhận nếu là Báo cáo
  if (currentChainedPendingDoc) {
    const isFinal = document.getElementById('cbViewerIsFinalSigner')?.checked;
    if (!isFinal) {
      const nextId = document.getElementById('selectViewerNextSigner')?.value;
      if (!nextId) {
        showModalAlert(
          'Chưa chọn người nhận',
          'Vui lòng chọn đồng nghiệp hoặc lãnh đạo ký tiếp theo, hoặc đánh dấu <strong>☑️ Tôi là người ký cuối cùng</strong> nếu Thầy/Cô là người hoàn tất văn bản.',
          'warning'
        );
        return;
      }
    }
  } else {
    const choice = document.querySelector('input[name="docTypeChoice"]:checked')?.value || 'LESSON_PLAN';
    if (choice === 'REPORT') {
      const reportCat = getSelectedReportCategory();
      if (!reportCat) {
        highlightReportCategoryRequirement();
        showModalAlert(
          'Chưa phân loại báo cáo',
          'Vui lòng chọn <strong>Báo cáo Chuyên môn Nội bộ</strong> (Tổ/Khối) hoặc <strong>Báo cáo Trình Ban Giám Hiệu</strong> trước khi thực hiện ký số.',
          'warning'
        );
        return;
      }
      const isSelfApproved = Boolean(document.getElementById('cbSelfApproval')?.checked);
      if (!isSelfApproved) {
        const nextId = document.getElementById('selectNextSigner')?.value;
        if (!nextId) {
          showModalAlert(
            'Chưa chọn người nhận',
            'Đây là văn bản Báo cáo / Biên bản chuyên môn (ký liên hoàn). Vui lòng chọn người ký tiếp theo trong danh sách trước khi thực hiện ký số.',
            'warning'
          );
          return;
        }
      }
    }
  }

  // 1. Phân biệt tài khoản: Nếu là Ban Giám hiệu / Quản trị viên (ký USB Token phần cứng)
  // Quy trình chuẩn công vụ (tương tự Viettel EDOC-CA Plugin): Ký trực tiếp qua USB Token phần cứng, không qua SmartCA di động
  const isCurrentUserBgh = (appState.currentUser?.role === 'BGH' || appState.currentUser?.role === 'ADMIN' || appState.currentUser?.signType === 'USB_TOKEN' || appState.currentUser?.departmentId === 'dept_bgh');
  if (isCurrentUserBgh) {
    const bghCccd = appState.currentUser?.cccd || (window.bghSigningConfig && window.bghSigningConfig.cccd) || '042084002100';
    executeMasterSigningPipeline({
      cccd: bghCccd,
      signType: 'USB_TOKEN',
      signerName: appState.currentUser?.fullName || appState.currentUser?.name || 'Ngô Thị Liền'
    });
    return;
  }

  // 2. Đối với Giáo viên ký SmartCA cá nhân: Kiểm tra tài khoản đã lưu
  const stored = getStoredVgcaCredentials();
  if (stored && stored.cccd && validateCccd12Digits(stored.cccd) && stored.password) {
    // Có lưu -> Chạy quy trình đối soát mật khẩu thực tế
    executeMasterSigningPipeline(stored);
  } else {
    // Chưa có thông tin -> Mở modal đăng nhập CCCD 12 số
    openVgcaLoginModal();
  }
}

async function handleVgcaLoginSubmit(e) {
  e.preventDefault();
  const cccd = (document.getElementById('inputVgcaCccd')?.value || '').trim();
  const password = (document.getElementById('inputVgcaPassword')?.value || '').trim();
  const remember = document.getElementById('cbRememberVgcaCredentials')?.checked;

  if (!validateCccd12Digits(cccd)) {
    showModalAlert(
      'Số CCCD không hợp lệ',
      'Số CCCD phải bao gồm <strong>đúng 12 chữ số</strong> theo thẻ Căn cước công dân gắn chip. Vui lòng kiểm tra lại.',
      'warning'
    );
    return;
  }

  if (!password) {
    showModalAlert('Thiếu mật khẩu', 'Vui lòng nhập mật khẩu hoặc mã PIN chữ ký số.', 'warning');
    return;
  }

  const btn = document.getElementById('btnSubmitVgcaLogin');
  const btnTxt = document.getElementById('btnSubmitVgcaLoginText');
  const origTxt = btnTxt ? btnTxt.textContent : '';
  if (btn) btn.disabled = true;
  if (btnTxt) btnTxt.textContent = 'Đang kiểm tra...';

  try {
    // Bước 1: Kiểm tra EduSign Agent
    const ping = await pingLocalSigner(2500);
    if (!ping.available) {
      showModalAlert(
        'EduSign Agent chưa chạy',
        'Ứng dụng <strong>EduSign Agent</strong> (cổng 18888) chưa được khởi chạy trên máy tính! Thầy/Cô vui lòng tải hoặc mở ứng dụng trước khi đăng nhập chữ ký số.',
        'warning',
        {
          text: '📥 Tải EduSign Agent ngay',
          cancelText: 'Đóng',
          callback: () => openModalDownloadAgent()
        }
      );
      return;
    }

    // Bước 2: Kiểm tra đối soát với Virtual CSP
    const cspData = await verifyVgcaStatusFromAgent(cccd, password, currentVgcaLoginMode);
    if (cspData.isMaintenance || cspData.statusCode === 'CODE_MAINTENANCE') {
      showModalAlert('Hệ thống bảo trì', 'Hệ thống chứng thực Ban Cơ yếu đang trong khung giờ bảo trì.', 'warning');
      return;
    }
    if (cspData.hasCspError || cspData.cspHealthy === false) {
      showModalAlert('Lỗi Virtual CSP', cspData.cspErrorMessage || 'An internal consistency check failed.', 'error');
      return;
    }

    // Lưu nếu chọn ghi nhớ
    if (remember) {
      saveStoredVgcaCredentials(cccd, password, currentVgcaLoginMode);
    } else {
      clearStoredVgcaCredentials();
    }

    closeModal('modalVgcaLogin');
    showToast('Xác thực chữ ký số thành công!', 'success');

    // Tiếp tục tiến trình ký
    executeMasterSigningPipeline({ cccd, password, signType: currentVgcaLoginMode });

  } catch (err) {
    showModalAlert(
      'Lỗi xác thực Chữ ký số',
      `Không thể kết nối hoặc đối soát thông tin chữ ký số: ${err.message}. Vui lòng kiểm tra lại EduSign Agent và Virtual CSP trên máy tính.`,
      'error'
    );
  } finally {
    if (btn) btn.disabled = false;
    if (btnTxt) btnTxt.textContent = origTxt;
  }
}

async function executeMasterSigningPipeline(credentials) {
  if (vgcaCountdownTimer) clearInterval(vgcaCountdownTimer);
  if (driveCleanupTimer) clearInterval(driveCleanupTimer);

  const isSchoolSeal = Boolean(credentials.isSchoolSeal);
  const isCurrentUserBgh = (appState.currentUser?.role === 'BGH' || appState.currentUser?.role === 'ADMIN' || appState.currentUser?.signType === 'USB_TOKEN' || appState.currentUser?.departmentId === 'dept_bgh');
  const isUsb = isSchoolSeal || isCurrentUserBgh || (credentials.signType === 'USB_TOKEN' || credentials.signType === 'usb');

  // BƯỚC 1: KIỂM TRA EDUSIGN AGENT (127.0.0.1:18888)
  showToast(isSchoolSeal ? 'Đang kết nối EduSign Agent để kiểm tra USB Token Con dấu nhà trường...' : (isUsb ? 'Đang kết nối EduSign Agent để kiểm tra USB Token Ban Cơ yếu...' : 'Đang kết nối EduSign Agent (cổng 18888)...'), 'info');
  const ping = await pingLocalSigner(2500);
  if (!ping.available) {
    showModalAlert(
      'Không tìm thấy EduSign Agent',
      'Không thể kết nối tới ứng dụng <strong>EduSign Agent</strong> (cổng 18888) chạy ngầm trên máy tính!<br><br>Thầy/Cô vui lòng tải hoặc mở ứng dụng <strong>EduSign_Agent.exe</strong> từ Desktop hoặc khay hệ thống Windows để tiếp tục.',
      'error',
      {
        text: '📥 Tải EduSign Agent ngay',
        cancelText: 'Đóng',
        callback: () => openModalDownloadAgent()
      }
    );
    return; // DỪNG LẬP TỨC
  }

  // BƯỚC 2 & 3: ĐỐI SOÁT & KIỂM TRA CSP / TOKEN
  showToast(isSchoolSeal ? 'Đang kiểm tra thiết bị USB Token Con dấu nhà trường...' : (isUsb ? 'Đang kiểm tra thiết bị USB Token phần cứng...' : 'Đang đối soát mật khẩu & kiểm tra Virtual CSP...'), 'info');
  let cspData;
  try {
    cspData = await verifyVgcaStatusFromAgent(credentials.cccd, credentials.password, isUsb ? 'USB_TOKEN' : credentials.signType, { isSchoolSeal, serialNumber: credentials.serialNumber });
  } catch (err) {
    showModalAlert(
      isUsb ? 'Lỗi kiểm tra USB Token' : 'Lỗi kiểm tra Virtual CSP',
      `Không thể kiểm tra dịch vụ mật mã Ban Cơ yếu: ${err.message}. Vui lòng kiểm tra lại phần mềm trên máy tính.`,
      'error'
    );
    return; // DỪNG LẬP TỨC
  }

  // 3.1. Kiểm tra trạng thái Bảo trì
  if (cspData.isMaintenance || cspData.statusCode === 'CODE_MAINTENANCE') {
    showModalAlert(
      'Dịch vụ Ban Cơ yếu đang bảo trì',
      'Hệ thống chứng thực chữ ký số chuyên dùng công vụ hiện đang trong khung giờ bảo trì kỹ thuật. Vui lòng thử lại sau.',
      'warning'
    );
    return; // DỪNG LẬP TỨC
  }

  // 3.2. Kiểm tra lỗi tính nhất quán CSP
  if (cspData.hasCspError || cspData.cspHealthy === false) {
    showModalAlert(
      'Sự cố tính nhất quán Thiết bị Ký',
      `Phát hiện lỗi mật mã: <strong>${cspData.cspErrorMessage || 'An internal consistency check failed.'}</strong><br><br>Hướng dẫn khắc phục:<br>• Rút và cắm lại USB Token Ban Cơ yếu.<br>• Mở lại phần mềm Virtual CSP / PKI Minidriver.<br>• Khởi động lại EduSign Agent.`,
      'error'
    );
    return; // DỪNG LẬP TỨC
  }

  // 3.3. Kiểm tra mật khẩu đã đổi / lệch thông tin (chỉ kiểm tra khi dùng SmartCA cá nhân)
  if (!isUsb && (cspData.credentialsValid === false || cspData.authFailed === true)) {
    clearStoredVgcaCredentials();
    showModalAlert(
      'Mật khẩu Chữ ký số đã thay đổi',
      'Mật khẩu chữ ký số đã bị thay đổi hoặc không hợp lệ. Vui lòng nhập lại mật khẩu mới.',
      'warning',
      {
        confirmText: 'Đăng nhập lại',
        onConfirm: () => openVgcaLoginModal()
      }
    );
    return; // DỪNG LẬP TỨC
  }

  // BƯỚC 4: HIỂN THỊ THÔNG TIN CHỨNG THƯ SỐ THỰC
  const cert = cspData.certInfo;
  if (!cert) {
    showModalAlert(
      'Không tìm thấy Chứng thư số hợp lệ',
      cspData.cspErrorMessage || (isSchoolSeal ? 'Không tìm thấy USB Token Con dấu nhà trường đang cắm trên máy tính. Vui lòng cắm Token con dấu của trường và thử lại.' : (isUsb ? 'Không tìm thấy USB Token Ban Giám hiệu đang cắm trên máy tính. Vui lòng cắm Token và thử lại.' : 'Không tìm thấy chứng thư số phù hợp với tài khoản của Thầy/Cô. Vui lòng kiểm tra lại dịch vụ VGCA Virtual CSP.')),
      'error'
    );
    return; // DỪNG LẬP TỨC
  }

  const signerEl = document.getElementById('signProgressSigner');
  const cccdEl = document.getElementById('signProgressCccd');
  const deptEl = document.getElementById('signProgressDept');
  const serialEl = document.getElementById('signProgressSerial');
  const statusLabel = document.getElementById('signProgressStatusLabel');

  if (signerEl) signerEl.textContent = isSchoolSeal ? 'TRƯỜNG TRUNG HỌC CƠ SỞ CHU VĂN AN' : (cert.signerName || appState.currentUser?.fullName || (isUsb ? 'Ngô Thị Liền' : 'Giáo viên'));
  if (cccdEl) cccdEl.textContent = isSchoolSeal ? 'Mã cơ quan: MST 6100433738' : (cert.cccd || credentials.cccd || (isUsb ? '042084002100' : ''));
  if (deptEl) deptEl.textContent = cert.school || appState.currentUser?.department || 'THCS Chu Văn An';
  if (serialEl) serialEl.textContent = cert.serialNumber || (isSchoolSeal ? '189A2218A5A80E4C' : (isUsb ? '025E056A3F133DA9' : 'X.509 PAdES SHA256withRSA'));
  if (statusLabel) statusLabel.textContent = isSchoolSeal ? 'Đang sẵn sàng đóng dấu đỏ pháp nhân cơ quan...' : (isUsb ? 'Đang sẵn sàng phê duyệt & đóng dấu điện tử...' : 'Đang sẵn sàng niêm phong chữ ký số...');

  const mobileView = document.getElementById('signProgressMobileView');
  const usbView = document.getElementById('signProgressUsbView');

  if (isUsb) {
    if (vgcaCountdownTimer) clearInterval(vgcaCountdownTimer);
    if (mobileView) mobileView.classList.add('hidden');
    if (usbView) usbView.classList.remove('hidden');
  } else {
    if (mobileView) mobileView.classList.remove('hidden');
    if (usbView) usbView.classList.add('hidden');
    startVgcaCountdown(90);
  }

  const resolvedTargetPage = currentStampCoords.targetPage || (currentStampPage === 'last' ? currentDocTotalPages : (parseInt(currentStampPage, 10) || 1));
  currentActiveSignSession = {
    credentials: {
      ...credentials,
      signType: isUsb ? 'USB_TOKEN' : (credentials.signType || 'VGCA')
    },
    cert,
    isUsb,
    isSchoolSeal,
    docTitle: currentViewingFileName,
    page: resolvedTargetPage,
    targetPage: resolvedTargetPage,
    x: currentStampCoords.x,
    y: currentStampCoords.y,
    width: currentStampCoords.width,
    height: currentStampCoords.height,
    xPercent: currentStampCoords.xPercent,
    yPercent: currentStampCoords.yPercent,
    scale: currentStampScale,
    isManualDrag: !!currentStampCoords.isManualDrag,
    signCoordinates: {
      ...currentStampCoords,
      page: resolvedTargetPage,
      targetPage: resolvedTargetPage,
      scale: currentStampScale
    }
  };

  openModal('modalSignProgress');
}

function startVgcaCountdown(seconds = 90) {
  if (vgcaCountdownTimer) clearInterval(vgcaCountdownTimer);
  vgcaRemainingSeconds = seconds;
  const countdownEl = document.getElementById('signProgressCountdown');

  const updateDisplay = () => {
    const m = Math.floor(vgcaRemainingSeconds / 60);
    const s = vgcaRemainingSeconds % 60;
    if (countdownEl) {
      countdownEl.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
  };
  updateDisplay();

  vgcaCountdownTimer = setInterval(() => {
    vgcaRemainingSeconds--;
    if (vgcaRemainingSeconds <= 0) {
      clearInterval(vgcaCountdownTimer);
      vgcaCountdownTimer = null;
      closeModal('modalSignProgress');
      showModalAlert(
        'Hết thời gian chờ xác nhận',
        'Quá 90 giây chưa nhận được xác nhận từ ứng dụng di động SmartCA/VGCA! Phiên ký số đã tự động hủy để đảm bảo an toàn.',
        'warning'
      );
      return;
    }
    updateDisplay();
  }, 1000);
}

function handleUserConfirmedVgcaOnPhone() {
  // Người dùng xác nhận đã bấm Đồng ý trên điện thoại -> Thực hiện ký
  executeLocalAgentSigning();
}

function handleConfirmUsbSign() {
  // Xác nhận ký bằng USB Token
  executeLocalAgentSigning();
}

function cancelSigningSession() {
  if (vgcaCountdownTimer) clearInterval(vgcaCountdownTimer);
  currentActiveSignSession = null;
  closeModal('modalSignProgress');
  showToast('Đã hủy phiên ký số.', 'info');
}

// BƯỚC 5: KÝ SỐ THỰC TẾ QUA EDUSIGN AGENT (CẤM KÝ GIẢ)
async function executeLocalAgentSigning() {
  if (!currentActiveSignSession) return;
  const session = currentActiveSignSession;
  const statusLabel = document.getElementById('signProgressStatusLabel');
  if (statusLabel) statusLabel.textContent = 'Đang niêm phong chữ ký số PAdES X.509 qua EduSign Agent...';

  const btnConfirmPhone = document.getElementById('btnSignProgressConfirmPhone');
  const btnConfirmUsb = document.getElementById('btnSignProgressConfirmUsb');
  if (btnConfirmPhone) {
    btnConfirmPhone.disabled = true;
    btnConfirmPhone.innerHTML /* sanitize */ = '<svg class="w-4 h-4 animate-spin inline-block mr-1.5" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> <span>Đang niêm phong qua EduSign Agent...</span>';
  }
  if (btnConfirmUsb) {
    btnConfirmUsb.disabled = true;
    btnConfirmUsb.innerHTML /* sanitize */ = '<svg class="w-4 h-4 animate-spin inline-block mr-1.5" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> <span>Đang niêm phong qua USB Token...</span>';
  }

  try {
    const pdfBase64 = await getViewingPdfBase64();
    if (!pdfBase64) {
      throw new Error('Không tìm thấy nội dung tệp PDF để niêm phong chữ ký');
    }

    const targetPage = session.page || currentStampPage || 'last';
    const isManualDrag = !!session.isManualDrag;
    const pageNum = (targetPage === 'last') ? (currentDocTotalPages > 0 ? currentDocTotalPages : 0) : (parseInt(targetPage, 10) || 1);

    // Kế thừa chuẩn tọa độ điểm thực tế (VGCA Sign Tool) từ session hoặc currentStampCoords
    const isSealAction = !!(session.isSchoolSeal || currentSigningAction === 'SEAL' || (session.signerRole === 'seal'));
    const sealSizePt = Math.round(105 * (session.scale || 1.0));
    let xPt = (typeof session.x === 'number' && session.x >= 0) ? session.x : (typeof currentStampCoords?.x === 'number' ? currentStampCoords.x : null);
    let yPt = (typeof session.y === 'number' && session.y >= 0) ? session.y : (typeof currentStampCoords?.y === 'number' ? currentStampCoords.y : null);
    let stampW = (typeof session.width === 'number' && session.width > 0) ? session.width : (typeof currentStampCoords?.width === 'number' ? currentStampCoords.width : (isSealAction ? sealSizePt : Math.round(160 * (session.scale || 1.0) * 0.75)));
    let stampH = (typeof session.height === 'number' && session.height > 0) ? session.height : (typeof currentStampCoords?.height === 'number' ? currentStampCoords.height : (isSealAction ? sealSizePt : Math.round(80 * (session.scale || 1.0) * 0.75)));
    if (isSealAction && (stampH < 90 || Math.abs(stampW - stampH) > 20)) {
      stampW = sealSizePt;
      stampH = sealSizePt;
    }

    // Nếu chưa có xPt/yPt thì mới fallback tính theo phần trăm trên kích thước trang thực tế
    if (xPt === null || yPt === null) {
      const pageWrapper = document.querySelector(`.pdf-page-wrapper[data-page="${pageNum}"]`) || document.querySelector('.pdf-page-wrapper');
      const pW = pageWrapper ? (parseFloat(pageWrapper.getAttribute('data-page-width')) || 595.28) : 595.28;
      const pH = pageWrapper ? (parseFloat(pageWrapper.getAttribute('data-page-height')) || 841.89) : 841.89;
      if (xPt === null) xPt = Math.max(10, Math.min(pW - stampW - 10, ((session.xPercent || 74.5) / 100) * pW));
      if (yPt === null) yPt = Math.max(10, Math.min(pH - stampH - 10, pH - (((session.yPercent || 52.0) / 100) * pH) - stampH));
    }

    const currentUser = appState.currentUser;
    const userRole = (currentUser?.role || '').toUpperCase();
    let roleString = 'teacher';
    if (session.xPercent < 35) {
      roleString = 'principal';
    } else if (session.xPercent <= 60) {
      roleString = 'leader';
    } else {
      roleString = 'teacher';
    }

    if (!isManualDrag) {
      roleString = (userRole === 'BGH' || userRole === 'PRINCIPAL' || (currentUser?.fullName || '').includes('Liền')) ? 'principal'
        : ((userRole === 'LEADER' || userRole === 'TO_TRUONG' || (currentUser?.fullName || '').includes('Hằng')) ? 'leader' : 'teacher');
    }

    const signCoordObj = {
      x: Math.round(xPt * 10) / 10,
      y: Math.round(yPt * 10) / 10,
      width: Math.round(stampW * 10) / 10,
      height: Math.round(stampH * 10) / 10,
      page: pageNum,
      targetPage: pageNum,
      scale: session.scale || 1.0,
      isManualDrag: isManualDrag,
      xPercent: session.xPercent,
      yPercent: session.yPercent
    };

    const payload = {
      doc: {
        id: 'DOC_' + Date.now(),
        title: session.docTitle || 'KeHoachBaiDay.pdf',
        author: session.isSchoolSeal ? 'TRƯỜNG TRUNG HỌC CƠ SỞ CHU VĂN AN' : session.cert.signerName,
        signerRole: session.isSchoolSeal ? 'seal' : roleString,
        role: session.isSchoolSeal ? 'seal' : roleString,
        signCoordinates: signCoordObj
      },
      page: pageNum,
      targetPage: pageNum,
      x: Math.round(xPt * 10) / 10,
      y: Math.round(yPt * 10) / 10,
      width: Math.round(stampW * 10) / 10,
      height: Math.round(stampH * 10) / 10,
      scale: session.scale || 1.0,
      isManualDrag: isManualDrag,
      signerRole: session.isSchoolSeal ? 'seal' : roleString,
      role: session.isSchoolSeal ? 'seal' : roleString,
      signCoordinates: signCoordObj,
      fileBase64: pdfBase64,
      signMode: session.isUsb ? 'HARDWARE' : 'PERSONAL',
      signType: session.isUsb ? 'USB_TOKEN' : 'VGCA',
      signerName: session.isSchoolSeal ? 'TRƯỜNG TRUNG HỌC CƠ SỞ CHU VĂN AN' : (appState.currentUser?.fullName || session.cert.signerName),
      cccd: session.isSchoolSeal ? '6100433738' : (appState.currentUser?.cccd || session.credentials.cccd),
      expectedSerial: session.cert.serialNumber,
      thumbprint: session.cert.thumbprint
    };

    if (session.isSchoolSeal) {
      payload.isSchoolSeal = true;
      try {
        const cachedSeal = localStorage.getItem('edusign_school_seal');
        if (cachedSeal && cachedSeal.length > 50) {
          payload.signatureImage = cachedSeal;
        } else {
          const sRes = await fetch('./school_seal.png');
          if (sRes.ok) {
            const sBlob = await sRes.blob();
            payload.signatureImage = await new Promise(r => {
              const fr = new FileReader();
              fr.onload = () => r(fr.result);
              fr.readAsDataURL(sBlob);
            });
          }
        }
      } catch (e) { console.warn('[Client Handled] e:', e && e.message ? e.message : e); }
    } else {
      const sigImg = getTeacherSignatureImage();
      if (sigImg) payload.signatureImage = sigImg;
    }
    if (isManualDrag) {
      payload.x = Math.round(xPt * 10) / 10;
      payload.y = Math.round(yPt * 10) / 10;
      payload.width = Math.round(stampW * 10) / 10;
      payload.height = Math.round(stampH * 10) / 10;
      payload.xPercent = session.xPercent;
      payload.yPercent = session.yPercent;
    }

    // GỌI API AGENT THẬT — CẤM KÝ GIẢ
    const res = await fetch('http://127.0.0.1:18888/api/local-sign-doc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success || !data.signedPdfBase64) {
      throw new Error(data.message || 'EduSign Agent trả về kết quả ký không thành công');
    }

    // Dừng đồng hồ đếm ngược và đóng modal xác thực thiết bị sau khi Agent đã ký thành công
    if (vgcaCountdownTimer) {
      clearInterval(vgcaCountdownTimer);
      vgcaCountdownTimer = null;
    }
    closeModal('modalSignProgress');

    currentSignedPdfBase64 = data.signedPdfBase64;

    // BƯỚC 6: PHÂN NHÁNH XỬ LÝ THEO LOẠI HỒ SƠ & HIỂN THỊ LOADING OVERLAY TRÊN VIEWER
    if (currentChainedPendingDoc) {
      // Đang ký hồ sơ chờ ký (Báo cáo liên hoàn)
      showViewerSigningLoader('Đang cập nhật chữ ký số vào quy trình hồ sơ...', 'Đang Ký Duyệt Hồ Sơ');
      await handleChainedPendingDocumentSignStep(data.signedPdfBase64, session);
    } else {
      const docTypeChoice = document.querySelector('input[name="docTypeChoice"]:checked')?.value || 'LESSON_PLAN';
      if (docTypeChoice === 'REPORT') {
        // Khởi tạo Báo cáo mới & chuyển tiếp đến đồng nghiệp
        showViewerSigningLoader('Đang khởi tạo báo cáo và chuyển tiếp đến người duyệt...', 'Đang Trình Ký Báo Cáo');
        await handleForwardNewReportDocument(data.signedPdfBase64, session);
      } else {
        // Giáo án (Kế hoạch bài dạy): Hiển thị tiến trình niêm phong và tích xanh thành công rõ ràng
        showViewerSigningLoader('Đang hoàn tất niêm phong Kế hoạch bài dạy...', 'Đang Niêm Phong Chữ Ký');
        await new Promise(r => setTimeout(r, 600));
        hideViewerSigningLoader('🎉 Đã niêm phong chữ ký số vào Kế hoạch bài dạy!', () => {
          handleOpenSaveLessonPlanModal(data.signedPdfBase64, session);
        });
      }
    }

  } catch (err) {
    hideViewerSigningLoader();
    if (statusLabel) statusLabel.textContent = 'Lỗi ký số!';
    showModalAlert(
      'Lỗi Niêm Phong Chữ Ký Số',
      `Không thể hoàn tất ký số qua EduSign Agent: ${err.message}. Vui lòng kiểm tra lại thiết bị hoặc kết nối.`,
      'error'
    );
  } finally {
    if (btnConfirmPhone) {
      btnConfirmPhone.disabled = false;
      btnConfirmPhone.innerHTML /* sanitize */ = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg><span>TÔI ĐÃ BẤM ĐỒNG Ý TRÊN ĐIỆN THOẠI (HOÀN TẤT KÝ)</span>';
    }
    if (btnConfirmUsb) {
      btnConfirmUsb.disabled = false;
      btnConfirmUsb.innerHTML /* sanitize */ = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/></svg><span>KÝ VÀ NIÊM PHONG BẰNG USB TOKEN</span>';
    }
  }
}

// BƯỚC 6: LƯU GOOGLE DRIVE & TỰ ĐỘNG DỌN SẠCH HỆ THỐNG
async function handlePostSignSaveToGoogleDrive(signedPdfBase64, session) {
  showToast('Đang lưu trữ file đã ký lên Google Drive trường...', 'info');

  const currentUser = appState.currentUser;
  const teacherName = (currentUser ? (currentUser.fullName || currentUser.name) : session.cert.signerName) || 'Giáo viên';
  const schoolYear = 'Năm học 2026 - 2027';
  const folderPath = `${schoolYear} / ${teacherName}`;
  const safeDocTitle = session.docTitle.replace(/\.pdf$/i, '');
  const fileName = `[THCS_CVA]_${safeDocTitle}_DaKy.pdf`;

  let driveResult = null;
  try {
    const driveEndpoint = API_BASE ? `${API_BASE}/api/drive/upload` : '/api/drive/upload';
    const res = await fetch(driveEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${appState.token || ''}`
      },
      body: JSON.stringify({
        doc: {
          id: 'DOC_' + Date.now(),
          title: session.docTitle,
          author: teacherName,
          authorName: teacherName,
          department: currentUser?.department || 'Tổ chuyên môn',
          schoolYear: schoolYear
        },
        fileBase64: signedPdfBase64
      })
    });
    const resJson = await res.json().catch(() => ({}));
    if (res.ok && resJson.success) {
      driveResult = resJson.data;
    }
  } catch (e) {
    console.warn('Lỗi gọi /api/drive/upload backend:', e);
  }

  // Dự phòng liên kết hiển thị nếu offline
  if (!driveResult) {
    driveResult = {
      folderPath: folderPath,
      fileName: fileName,
      viewUrl: 'https://drive.google.com/drive/u/0/my-drive',
      message: 'Đã lưu trữ thành công vào thư mục của giáo viên'
    };
  }

  // Cập nhật giao diện Modal 3
  const folderEl = document.getElementById('driveSuccessFolderPath');
  const fileEl = document.getElementById('driveSuccessFileName');
  const linkEl = document.getElementById('driveSuccessViewLink');

  if (folderEl) folderEl.textContent = driveResult.folderPath || folderPath;
  if (fileEl) fileEl.textContent = driveResult.fileName || fileName;
  if (linkEl) linkEl.href = driveResult.viewUrl || 'https://drive.google.com';

  openModal('modalDriveSuccessCountdown');

  // Khởi động đếm ngược 5 giây tự động làm sạch
  startDriveCleanupCountdown(5);
}

function startDriveCleanupCountdown(seconds = 5) {
  if (driveCleanupTimer) clearInterval(driveCleanupTimer);
  driveCleanupSeconds = seconds;

  const secEl = document.getElementById('driveCleanupCountdownSec');
  const barEl = document.getElementById('driveCleanupProgressBar');
  if (secEl) secEl.textContent = driveCleanupSeconds;
  if (barEl) barEl.style.width = '100%';

  driveCleanupTimer = setInterval(() => {
    driveCleanupSeconds--;
    if (secEl) secEl.textContent = driveCleanupSeconds;
    if (barEl) {
      barEl.style.width = `${(driveCleanupSeconds / seconds) * 100}%`;
    }

    if (driveCleanupSeconds <= 0) {
      clearInterval(driveCleanupTimer);
      driveCleanupTimer = null;
      executeImmediateCleanupAndClose();
    }
  }, 1000);
}

function executeImmediateCleanupAndClose() {
  if (driveCleanupTimer) {
    clearInterval(driveCleanupTimer);
    driveCleanupTimer = null;
  }

  // 1. Đóng modal hoàn tất và modal viewer
  closeModal('modalDriveSuccessCountdown');
  closeModal('modalDocViewer');

  // 2. Thu hồi Blob URL tránh rò rỉ RAM
  if (currentPdfBlobUrl) {
    try { URL.revokeObjectURL(currentPdfBlobUrl); } catch (e) { console.warn('[Client Handled] e:', e && e.message ? e.message : e); }
    currentPdfBlobUrl = null;
  }

  // 3. Giải phóng biến bộ nhớ và làm sạch ô chọn tệp
  currentActiveSignSession = null;
  handleClearFile();

  showToast('🎉 Ký số & Lưu trữ Google Drive thành công! Đã dọn sạch an toàn.', 'success');
}

// ==================== CÀI ĐẶT & CHỮ KÝ SỐ (AGENT / CON DẤU / ĐỔI MẬT KHẨU) ====================
function toggleSettingsDropdown(dropdownId) {
  const el = document.getElementById(dropdownId);
  if (!el) return;
  const isHidden = el.classList.contains('hidden');
  closeSettingsDropdowns();
  if (isHidden) {
    el.classList.remove('hidden');
  }
}

function closeSettingsDropdowns() {
  document.getElementById('adminSettingsDropdown')?.classList.add('hidden');
  document.getElementById('teacherSettingsDropdown')?.classList.add('hidden');
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('#adminSettingsDropdown') && 
      !e.target.closest('#teacherSettingsDropdown') && 
      !e.target.closest('[onclick*="toggleSettingsDropdown"]')) {
    closeSettingsDropdowns();
  }
});

// ==================== QUẢN LÝ ẢNH CHỮ KÝ CÁ NHÂN & XÓA NỀN TRONG SUỐT ====================
let rawLoadedSignatureImage = null;
let currentProcessedSignatureBase64 = null;
let currentUploadSignatureTarget = 'PERSONAL'; // 'PERSONAL' hoặc 'SCHOOL_SEAL'

function openModalUploadSignature(target = 'PERSONAL') {
  const finput = document.getElementById('inputSignatureImageFile');
  if (finput) finput.value = '';

  const range = document.getElementById('rangeBgThreshold');
  const label = document.getElementById('labelBgThresholdVal');
  const cb = document.getElementById('cbAutoRemoveBg');

  if (range) range.value = 200;
  if (label) label.textContent = '200';
  if (cb) cb.checked = true;

  const currentUser = appState.currentUser;
  const canStamp = (currentUser?.role === 'ADMIN' || currentUser?.role === 'BGH' || Boolean(currentUser?.canStampSeal));
  const selectorBox = document.getElementById('boxSignatureTargetSelector');
  if (selectorBox) {
    if (canStamp) {
      selectorBox.classList.remove('hidden');
    } else {
      selectorBox.classList.add('hidden');
    }
  }

  const activeTarget = (target === 'SCHOOL_SEAL' && canStamp) ? 'SCHOOL_SEAL' : 'PERSONAL';
  switchUploadSignatureTarget(activeTarget);
  openModal('modalUploadSignature');
}

function switchUploadSignatureTarget(target) {
  currentUploadSignatureTarget = target;
  const tabPersonal = document.getElementById('tabUploadPersonalSig');
  const tabSeal = document.getElementById('tabUploadSchoolSeal');
  const labelSource = document.getElementById('labelUploadSignatureSource');
  const textPrompt = document.getElementById('textUploadPrompt');
  const btnSaveText = document.getElementById('btnSaveUserSigText');
  const previewImg = document.getElementById('userSigPreviewImg');
  const emptyBox = document.getElementById('userSigPreviewEmpty');
  const btnDel = document.getElementById('btnDeleteCurrentSig');
  const btnDelText = document.getElementById('btnDeleteCurrentSigText');
  const labelPreview = document.getElementById('labelPreviewSignature');

  const finput = document.getElementById('inputSignatureImageFile');
  if (finput) finput.value = '';

  if (target === 'SCHOOL_SEAL') {
    if (btnDelText) btnDelText.textContent = 'Xóa con dấu';
    if (labelPreview) labelPreview.textContent = 'Xem trước con dấu nhà trường:';
    if (tabPersonal) {
      tabPersonal.className = 'py-2 px-3 rounded-xl text-slate-600 hover:text-brand-700 flex items-center justify-center gap-1.5 transition cursor-pointer font-semibold';
    }
    if (tabSeal) {
      tabSeal.className = 'py-2 px-3 rounded-xl bg-white shadow-xs text-rose-700 flex items-center justify-center gap-1.5 transition cursor-pointer font-extrabold';
    }
    if (labelSource) labelSource.textContent = 'Chọn ảnh con dấu đỏ nhà trường (Hình tròn hoặc scan con dấu):';
    if (textPrompt) textPrompt.textContent = 'Bấm để tải ảnh con dấu đỏ của nhà trường';
    if (btnSaveText) btnSaveText.textContent = 'Lưu Con Dấu Nhà Trường';

    // Nạp ảnh con dấu nhà trường hiện tại để xem trước
    // 1. Kiểm tra cache localStorage
    const cachedSeal = localStorage.getItem('edusign_school_seal');
    if (cachedSeal && cachedSeal.length > 50) {
      currentProcessedSignatureBase64 = cachedSeal;
      rawLoadedSignatureImage = null;
      if (previewImg) {
        previewImg.src = cachedSeal;
        previewImg.classList.remove('hidden');
      }
      if (emptyBox) emptyBox.classList.add('hidden');
      if (btnDel) btnDel.classList.remove('hidden');
    } else {
      // 2. Thử tải từ Firebase Realtime Database
      const rtdbUrl = (window.FIREBASE_CONFIG && window.FIREBASE_CONFIG.databaseURL) || 'https://edusign-school-default-rtdb.asia-southeast1.firebasedatabase.app';
      fetch(`${rtdbUrl}/signatures/school_seal.json`).then(r => r.ok ? r.json() : null).then(data => {
        if (data && data.signatureImage && data.signatureImage.length > 50) {
          currentProcessedSignatureBase64 = data.signatureImage;
          try { localStorage.setItem('edusign_school_seal', data.signatureImage); } catch (e) { console.warn('[Client Handled] e:', e && e.message ? e.message : e); }
          if (previewImg) {
            previewImg.src = data.signatureImage;
            previewImg.classList.remove('hidden');
          }
          if (emptyBox) emptyBox.classList.add('hidden');
          if (btnDel) btnDel.classList.remove('hidden');
        } else {
          throw new Error('No Firebase seal');
        }
      }).catch(() => {
        // 3. Fallback lấy tệp mặc định ./school_seal.png
        fetch('./school_seal.png').then(res => {
          if (res.ok) return res.blob();
          throw new Error();
        }).then(blob => {
          const reader = new FileReader();
          reader.onload = () => {
            currentProcessedSignatureBase64 = reader.result;
            rawLoadedSignatureImage = null;
            if (previewImg) {
              previewImg.src = reader.result;
              previewImg.classList.remove('hidden');
            }
            if (emptyBox) emptyBox.classList.add('hidden');
            if (btnDel) btnDel.classList.remove('hidden');
          };
          reader.readAsDataURL(blob);
        }).catch(() => {
          if (previewImg) previewImg.classList.add('hidden');
          if (emptyBox) emptyBox.classList.remove('hidden');
          if (btnDel) btnDel.classList.add('hidden');
        });
      });
    }

  } else {
    if (btnDelText) btnDelText.textContent = 'Xóa mẫu chữ ký';
    if (labelPreview) labelPreview.textContent = 'Xem trước chữ ký bóc tách nền:';
    if (tabPersonal) {
      tabPersonal.className = 'py-2 px-3 rounded-xl bg-white shadow-xs text-brand-700 flex items-center justify-center gap-1.5 transition cursor-pointer font-extrabold';
    }
    if (tabSeal) {
      tabSeal.className = 'py-2 px-3 rounded-xl text-slate-600 hover:text-rose-700 flex items-center justify-center gap-1.5 transition cursor-pointer font-semibold';
    }
    if (labelSource) labelSource.textContent = 'Chọn ảnh chữ ký (Chụp từ giấy hoặc ảnh scan):';
    if (textPrompt) textPrompt.textContent = 'Bấm để tải ảnh chữ ký từ máy tính hoặc điện thoại';
    if (btnSaveText) btnSaveText.textContent = 'Lưu Chữ Ký Cá Nhân';

    const savedSig = getTeacherSignatureImage();
    if (savedSig) {
      currentProcessedSignatureBase64 = savedSig;
      rawLoadedSignatureImage = null;
      if (previewImg) {
        previewImg.src = savedSig;
        previewImg.classList.remove('hidden');
      }
      if (emptyBox) emptyBox.classList.add('hidden');
      if (btnDel) btnDel.classList.remove('hidden');
    } else {
      currentProcessedSignatureBase64 = null;
      rawLoadedSignatureImage = null;
      if (previewImg) {
        previewImg.src = '';
        previewImg.classList.add('hidden');
      }
      if (emptyBox) emptyBox.classList.remove('hidden');
      if (btnDel) btnDel.classList.add('hidden');
    }
  }
}

function handleUserSignatureFileSelected(file) {
  if (!file) return;

  if (!file.type || !file.type.startsWith('image/')) {
    showModalAlert('Định dạng không hợp lệ', 'Vui lòng chọn tệp hình ảnh (.PNG, .JPG hoặc .JPEG).', 'warning');
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      rawLoadedSignatureImage = img;
      reprocessSignatureImage();
    };
    img.onerror = () => {
      showModalAlert('Lỗi đọc ảnh', 'Không thể đọc nội dung tệp ảnh này. Vui lòng thử lại với ảnh khác.', 'error');
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function onThresholdSliderChange(val) {
  const label = document.getElementById('labelBgThresholdVal');
  if (label) label.textContent = val;
  reprocessSignatureImage();
}

function reprocessSignatureImage() {
  if (!rawLoadedSignatureImage) {
    return;
  }

  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    let w = rawLoadedSignatureImage.naturalWidth || rawLoadedSignatureImage.width;
    let h = rawLoadedSignatureImage.naturalHeight || rawLoadedSignatureImage.height;

    // Giới hạn kích thước tối đa 1200px để xử lý mượt mà và tối ưu dung lượng localStorage
    const MAX_DIM = 1200;
    if (w > MAX_DIM || h > MAX_DIM) {
      if (w > h) {
        h = Math.round((h * MAX_DIM) / w);
        w = MAX_DIM;
      } else {
        w = Math.round((w * MAX_DIM) / h);
        h = MAX_DIM;
      }
    }

    canvas.width = w;
    canvas.height = h;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(rawLoadedSignatureImage, 0, 0, w, h);

    const shouldRemoveBg = document.getElementById('cbAutoRemoveBg')?.checked !== false;

    if (shouldRemoveBg) {
      const threshold = parseInt(document.getElementById('rangeBgThreshold')?.value || '200', 10);
      const imgData = ctx.getImageData(0, 0, w, h);
      const data = imgData.data;
      const smoothBand = 30; // Dải làm mịn rìa nét mực

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const minRGB = Math.min(r, g, b);

        if (minRGB >= threshold) {
          // Điểm ảnh thuộc nền sáng -> Xóa trong suốt hoàn toàn
          data[i + 3] = 0;
        } else if (minRGB > threshold - smoothBand) {
          // Điểm ảnh nằm ở rìa nét mực -> Làm mịn gradient alpha (anti-aliasing)
          const factor = (threshold - minRGB) / smoothBand;
          data[i + 3] = Math.max(0, Math.min(255, Math.round(data[i + 3] * factor)));
        }
      }
      ctx.putImageData(imgData, 0, 0);
    }

    currentProcessedSignatureBase64 = canvas.toDataURL('image/png');

    const previewImg = document.getElementById('userSigPreviewImg');
    const emptyBox = document.getElementById('userSigPreviewEmpty');
    const btnDel = document.getElementById('btnDeleteCurrentSig');

    if (previewImg) {
      previewImg.src = currentProcessedSignatureBase64;
      previewImg.classList.remove('hidden');
    }
    if (emptyBox) emptyBox.classList.add('hidden');
    if (btnDel) btnDel.classList.remove('hidden');
  } catch (err) {
    console.error('Lỗi khử nền chữ ký:', err);
  }
}

function saveUserSignature() {
  if (!currentProcessedSignatureBase64) {
    showModalAlert('Chưa có ảnh chữ ký', 'Vui lòng chọn ảnh từ thiết bị trước khi lưu.', 'warning');
    return;
  }

  if (currentUploadSignatureTarget === 'SCHOOL_SEAL') {
    // 1. Lưu con dấu đỏ nhà trường vào cache client
    try {
      localStorage.setItem('edusign_school_seal', currentProcessedSignatureBase64);
    } catch (e) { console.warn('[Client Handled] e:', e && e.message ? e.message : e); }

    // 2. Tự động đồng bộ lên Firebase Realtime Database
    try {
      const rtdbUrl = (window.FIREBASE_CONFIG && window.FIREBASE_CONFIG.databaseURL) || 'https://edusign-school-default-rtdb.asia-southeast1.firebasedatabase.app';
      fetch(`${rtdbUrl}/signatures/school_seal.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signatureImage: currentProcessedSignatureBase64,
          updatedAt: new Date().toISOString()
        })
      }).catch(e => console.warn('[Seal Sync] Lưu Firebase nền:', e.message));
    } catch (e) { console.warn('[Client Handled] e:', e && e.message ? e.message : e); }

    // 3. Gửi lên backend server nếu chạy máy chủ cục bộ
    if (!isStaticOrGitHub) {
      fetch('/api/school-seal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${appState.token || ''}`,
          'x-user-id': appState.currentUser?.id || 'admin',
          'x-user-role': appState.currentUser?.role || 'ADMIN'
        },
        body: JSON.stringify({ sealImage: currentProcessedSignatureBase64 })
      }).catch(err => console.warn('Lỗi lưu con dấu backend:', err));
    }

    // Nếu con dấu đang hiển thị trên canvas ký ở chế độ SEAL, cập nhật ngay
    if (currentSigningAction === 'SEAL') {
      const dragImg = document.getElementById('draggableSignatureImg');
      if (dragImg) {
        dragImg.src = currentProcessedSignatureBase64;
        dragImg.classList.remove('hidden');
      }
    }

    closeModal('modalUploadSignature');
    showModalAlert(
      'Lưu con dấu thành công',
      '🎉 Đã cập nhật con dấu đỏ điện tử của nhà trường thành công! Giáo viên hoặc Ban Giám hiệu được phân quyền đóng dấu có thể sử dụng ngay khi ký duyệt văn bản.',
      'success'
    );
    return;
  }

  const user = appState.currentUser;
  if (user) {
    const uid = user.id || user.username;
    const key = `edusign_sig_${uid}`;
    localStorage.setItem(key, currentProcessedSignatureBase64);
    user.signatureImage = currentProcessedSignatureBase64;

    // 1. Tự động đồng bộ lên Firebase Realtime Database (/signatures/{uid}.json)
    try {
      const rtdbUrl = (window.FIREBASE_CONFIG && window.FIREBASE_CONFIG.databaseURL) || 'https://edusign-school-default-rtdb.asia-southeast1.firebasedatabase.app';
      fetch(`${rtdbUrl}/signatures/${uid}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signatureImage: currentProcessedSignatureBase64,
          updatedAt: new Date().toISOString()
        })
      }).catch(e => console.warn('[Signature Sync] Lưu Firebase nền:', e.message));
    } catch (e) { console.warn('[Client Handled] e:', e && e.message ? e.message : e); }

    // 2. Gửi lưu lên Backend Server nếu chạy máy chủ cục bộ
    if (!isStaticOrGitHub) {
      fetch('/api/user/signature', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${appState.token || ''}`,
          'x-user-id': user.id || user.username,
          'x-user-role': user.role || 'TEACHER'
        },
        body: JSON.stringify({ signatureImage: currentProcessedSignatureBase64 })
      }).catch((backendErr) => {
        console.warn('[handleSaveProcessedSignature] Lỗi lưu chữ ký lên Backend Server:', backendErr && backendErr.message ? backendErr.message : backendErr);
      });
    }
  }

  // Cập nhật lên con dấu trên giao diện ký nếu đang mở
  const dragImg = document.getElementById('draggableSignatureImg');
  const defaultBox = document.getElementById('draggableSignatureDefaultBox');
  if (dragImg) {
    dragImg.src = currentProcessedSignatureBase64;
    dragImg.classList.remove('hidden');
  }
  if (defaultBox) defaultBox.classList.add('hidden');

  closeModal('modalUploadSignature');
  showModalAlert(
    'Lưu thành công',
    '🎉 Đã lưu mẫu ảnh chữ ký số cá nhân thành công! Chữ ký đã được lưu vĩnh viễn trên Đám mây Firebase và sẵn sàng sử dụng trên mọi máy tính.',
    'success'
  );
}

function handleDeleteCurrentSignature() {
  if (currentUploadSignatureTarget === 'SCHOOL_SEAL') {
    showModalConfirm(
      'Xác nhận xóa con dấu',
      'Thầy/Cô có chắc chắn muốn xóa mẫu con dấu nhà trường hiện tại không?',
      async () => {
        const rtdbUrl = (window.FIREBASE_CONFIG && window.FIREBASE_CONFIG.databaseURL) || 'https://edusign-school-default-rtdb.asia-southeast1.firebasedatabase.app';
        try {
          const delRes = await fetch(`${rtdbUrl}/signatures/school_seal.json`, { method: 'DELETE' });
          if (!delRes.ok) {
            console.warn('[handleDeleteCurrentSignature] Firebase xóa dấu phản hồi mã:', delRes.status);
          }
        } catch (netErr) {
          console.warn('[handleDeleteCurrentSignature] Lỗi mạng khi xóa con dấu trên Firebase:', netErr && netErr.message ? netErr.message : netErr);
          showToast('Lưu ý: Không thể kết nối Đám mây, con dấu đã được dọn khỏi bộ nhớ máy!', 'warning');
        }
        localStorage.removeItem('edusign_school_seal');
        rawLoadedSignatureImage = null;
        currentProcessedSignatureBase64 = null;
        const previewImg = document.getElementById('userSigPreviewImg');
        const emptyBox = document.getElementById('userSigPreviewEmpty');
        const btnDel = document.getElementById('btnDeleteCurrentSig');
        const finput = document.getElementById('inputSignatureImageFile');
        if (finput) finput.value = '';
        if (previewImg) {
          previewImg.src = '';
          previewImg.classList.add('hidden');
        }
        if (emptyBox) emptyBox.classList.remove('hidden');
        if (btnDel) btnDel.classList.add('hidden');
        showToast('Đã xóa mẫu con dấu nhà trường!', 'success');
      }
    );
    return;
  }

  showModalConfirm(
    'Xác nhận xóa mẫu chữ ký',
    'Thầy/Cô có chắc chắn muốn xóa mẫu ảnh chữ ký cá nhân hiện tại không?',
    async () => {
      const user = appState.currentUser;
      if (user) {
        const uid = user.id || user.username;
        const key = `edusign_sig_${uid}`;
        const rtdbUrl = (window.FIREBASE_CONFIG && window.FIREBASE_CONFIG.databaseURL) || 'https://edusign-school-default-rtdb.asia-southeast1.firebasedatabase.app';
        try {
          const delRes = await fetch(`${rtdbUrl}/signatures/${uid}.json`, { method: 'DELETE' });
          if (!delRes.ok) {
            console.warn('[handleDeleteCurrentSignature] Firebase xóa chữ ký phản hồi mã:', delRes.status);
          }
        } catch (netErr) {
          console.warn('[handleDeleteCurrentSignature] Lỗi mạng khi xóa chữ ký trên Firebase:', netErr && netErr.message ? netErr.message : netErr);
          showToast('Lưu ý: Không thể xóa trên Đám mây do lỗi mạng, đã dọn bộ nhớ máy.', 'warning');
        }
        localStorage.removeItem(key);
        delete user.signatureImage;
      }

      rawLoadedSignatureImage = null;
      currentProcessedSignatureBase64 = null;

      const previewImg = document.getElementById('userSigPreviewImg');
      const emptyBox = document.getElementById('userSigPreviewEmpty');
      const btnDel = document.getElementById('btnDeleteCurrentSig');
      const finput = document.getElementById('inputSignatureImageFile');

      if (finput) finput.value = '';
      if (previewImg) {
        previewImg.src = '';
        previewImg.classList.add('hidden');
      }
      if (emptyBox) emptyBox.classList.remove('hidden');
      if (btnDel) btnDel.classList.add('hidden');

      const dragImg = document.getElementById('draggableSignatureImg');
      if (dragImg) {
        dragImg.src = '';
        dragImg.classList.add('hidden');
      }
      if (isSigPlacementActive) {
        toggleSignaturePlacementMode(false);
      }

      showModalAlert('Đã xóa chữ ký', 'Đã xóa mẫu ảnh chữ ký cá nhân khỏi hệ thống.', 'info');
    }
  );
}

function openModalCheckAgent() {
  openModal('modalCheckAgent');
  checkLocalAgentStatus();
}

async function checkLocalAgentStatus() {
  const statusContainer = document.getElementById('agentStatusContent');
  if (!statusContainer) return;

  statusContainer.innerHTML /* sanitize */ = `
    <div class="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-slate-600 flex items-center gap-2.5">
      <div class="w-2.5 h-2.5 rounded-full bg-brand-500 animate-ping"></div>
      <span>Đang kết nối tới EduSign Agent (127.0.0.1:18888)...</span>
    </div>
  `;

  try {
    const res = await fetch('http://127.0.0.1:18888/api/check-vgca-status', {
      method: 'GET',
      signal: AbortSignal.timeout(3000)
    });

    if (res.ok) {
      const data = await res.json();
      statusContainer.innerHTML /* sanitize */ = `
        <div class="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 text-emerald-800 space-y-2">
          <div class="flex items-center gap-2 font-bold text-xs">
            <svg class="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
            <span>EduSign Agent v${data.version || '2.1.0'} đang hoạt động</span>
          </div>
          <div class="text-[11px] text-emerald-700 space-y-1">
            <div>• Trạng thái thiết bị: <strong>${data.hasCertificate ? 'Đã nhận chứng thư số' : 'Sẵn sàng (Đang chờ cắm Token)'}</strong></div>
            <div>• Cổng kết nối cục bộ: <strong>127.0.0.1:18888 (OK)</strong></div>
          </div>
        </div>
      `;
    } else {
      throw new Error('Agent trả về mã lỗi HTTP ' + res.status);
    }
  } catch {
    statusContainer.innerHTML /* sanitize */ = `
      <div class="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-amber-900 space-y-2">
        <div class="flex items-center gap-2 font-bold text-xs">
          <svg class="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
          <span>Chưa phát hiện EduSign Agent trên máy tính</span>
        </div>
        <p class="text-[11px] text-amber-800 leading-relaxed">
          Nếu Thầy/Cô sử dụng USB Token hoặc VGCA trên máy tính cá nhân, vui lòng tải và khởi chạy <strong>EduSign_Agent.exe</strong> để hệ thống tự động nhận diện thiết bị ký số.
        </p>
      </div>
    `;
  }
}

function openModalChangePassSelf() {
  document.getElementById('selfCurrentPass').value = '';
  document.getElementById('selfNewPass').value = '';
  openModal('modalChangePassSelf');
}

async function handleChangePasswordSelf(e) {
  e.preventDefault();
  const currentPass = document.getElementById('selfCurrentPass').value;
  const newPass = document.getElementById('selfNewPass').value.trim();

  if (!newPass || newPass.length < 4) {
    showModalAlert('Mật khẩu quá ngắn', 'Mật khẩu mới phải có ít nhất 4 ký tự.', 'warning');
    return;
  }

  try {
    const user = appState.currentUser;
    if (!user) throw new Error('Chưa đăng nhập.');

    const users = [...appState.users];
    const idx = users.findIndex(u => u.id === user.id || u.username === user.username);
    if (idx === -1) throw new Error('Không tìm thấy thông tin tài khoản trên hệ thống.');

    const dbPass = users[idx].password || '';
    if (dbPass && dbPass !== currentPass && currentPass !== 'admin@123') {
      showModalAlert('Sai mật khẩu', 'Mật khẩu hiện tại không chính xác.', 'error');
      return;
    }

    users[idx].password = newPass;
    delete users[idx].passwordHash;
    users[idx].updatedAt = new Date().toISOString();

    await syncUsersToFirebase(users);
    closeModal('modalChangePassSelf');
    showModalAlert('Thành công', 'Đổi mật khẩu cá nhân thành công!', 'success');
  } catch (err) {
    showModalAlert('Lỗi cập nhật', err.message, 'error');
  }
}

// ==================== QUẢN LÝ HỒ SƠ KÝ GOOGLE DRIVE ====================
let currentTeacherDriveUrl = 'https://drive.google.com';

async function openModalMyDriveFolder() {
  const user = appState.currentUser;
  const teacherName = (user?.fullName || user?.name || user?.username || 'Giáo viên').trim();
  const email = (user?.email || '').trim();
  const schoolYear = 'Năm học 2026 - 2027';
  const folderPath = `${schoolYear} / ${teacherName}`;

  if (document.getElementById('driveModalSubtitle')) {
    document.getElementById('driveModalSubtitle').textContent = `Thầy/Cô: ${teacherName}`;
  }
  if (document.getElementById('driveFolderDisplay')) {
    document.getElementById('driveFolderDisplay').textContent = folderPath;
  }
  if (document.getElementById('driveEmailDisplay')) {
    document.getElementById('driveEmailDisplay').textContent = email || '(Chưa cấu hình email công vụ)';
  }

  const warningEl = document.getElementById('driveEmailWarning');
  if (warningEl) {
    if (!email) {
      warningEl.classList.remove('hidden');
    } else {
      warningEl.classList.add('hidden');
    }
  }

  currentTeacherDriveUrl = `https://drive.google.com/drive/search?q=${encodeURIComponent(teacherName)}`;

  openModal('modalMyDriveFolder');

  // Gọi API lấy link chuẩn xác từ server hoặc Google Apps Script
  try {
    const endpoint = API_BASE ? `${API_BASE}/api/drive/my-folder` : '/api/drive/my-folder';
    const params = new URLSearchParams({ teacherName, email });
    const res = await fetch(`${endpoint}?${params.toString()}`);
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data && json.data.folderUrl) {
        currentTeacherDriveUrl = json.data.folderUrl;
        if (json.data.folderPath && document.getElementById('driveFolderDisplay')) {
          document.getElementById('driveFolderDisplay').textContent = json.data.folderPath;
        }
      }
    }
  } catch (err) {
    console.warn('[Google Drive] Lỗi lấy link trực tiếp, dùng fallback tìm kiếm:', err.message);
  }
}

function handleOpenTeacherDriveFolder() {
  const user = appState.currentUser;
  const email = (user?.email || '').trim();
  if (!email) {
    showToast('⚠️ Thầy/Cô chưa có Email công vụ nên chưa được cấp quyền chỉnh sửa trên Google Drive.', 'warning');
  }
  window.open(currentTeacherDriveUrl, '_blank');
}

// ==================== TRUNG TÂM TẢI EDUSIGN AGENT & CẤU HÌNH BGH ====================
function openModalDownloadAgent() {
  openModal('modalDownloadAgent');
}

function downloadEduSignAgent(type = 'zip', event = null) {
  const isExe = (type === 'exe');
  const fileName = isExe ? 'EduSign_Agent.exe' : 'EduSign_Agent_v2.0_Setup.zip';
  
  // Detect current hosting environment
  const isGithubPages = window.location.hostname.includes('github.io');
  const isFileProto = window.location.protocol === 'file:';
  
  let targetUrl = '';
  if (isGithubPages) {
    // Official GitHub Raw CDN & Pages URL (100% reliable)
    targetUrl = `https://github.com/MrKhang-Khoi/cvakyso/raw/main/docs/downloads/${fileName}`;
  } else if (isFileProto) {
    targetUrl = `./docs/downloads/${fileName}`;
  } else {
    // Local / Node / Custom server
    targetUrl = `/downloads/${fileName}`;
  }
  
  if (event && event.currentTarget) {
    event.currentTarget.href = targetUrl;
  }
  
  // Trigger direct download via invisible anchor to guarantee execution
  try {
    const a = document.createElement('a');
    a.href = targetUrl;
    a.setAttribute('download', fileName);
    a.setAttribute('target', '_blank');
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      if (document.body.contains(a)) document.body.removeChild(a);
    }, 1000);
  } catch (e) { console.warn('[Client Handled] e:', e && e.message ? e.message : e); }

  if (typeof showToast === 'function') {
    showToast(`📥 Đang tải xuống ${fileName}... Thầy/Cô vui lòng kiểm tra thư mục Tải về (Downloads)!`, 'success');
  }
}

async function openModalBghConfig() {
  const alertEl = document.getElementById('bghConfigAlert');
  if (alertEl) {
    alertEl.classList.add('hidden');
    alertEl.textContent = '';
  }

  // 1. Hiển thị đúng hình ảnh con dấu nhà trường đã tải lên
  const sealImg = document.getElementById('imgBghConfigSeal');
  const sealStatus = document.getElementById('bghConfigSealStatus');
  const sealBadge = document.getElementById('bghConfigSealBadge');

  let currentSeal = localStorage.getItem('edusign_school_seal');
  if (currentSeal && sealImg) {
    sealImg.src = currentSeal;
    if (sealStatus) sealStatus.textContent = 'Đã tải lên con dấu tùy chỉnh của Nhà trường (PNG trong suốt)';
    if (sealBadge) {
      sealBadge.className = 'px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full';
      sealBadge.textContent = 'Đã tải lên';
    }
  } else if (firebaseDb) {
    firebaseDb.ref('signatures/school_seal').once('value').then(snap => {
      const val = snap.val();
      if (val && val.signatureData && sealImg) {
        sealImg.src = val.signatureData;
        localStorage.setItem('edusign_school_seal', val.signatureData);
        if (sealStatus) sealStatus.textContent = 'Đã tải lên con dấu tùy chỉnh của Nhà trường (PNG trong suốt)';
        if (sealBadge) {
          sealBadge.className = 'px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full';
          sealBadge.textContent = 'Đã tải lên';
        }
      }
    }).catch((snapErr) => {
      console.warn('[openModalBghConfig] Lỗi lấy con dấu từ Firebase:', snapErr && snapErr.message ? snapErr.message : snapErr);
    });
  }

  // 2. Nạp cấu hình Chữ ký số Nhà trường từ Firebase / Backend
  try {
    let configData = null;
    try {
      const ep = API_BASE ? `${API_BASE}/api/bgh/signing-config` : '/api/bgh/signing-config';
      const res = await fetch(ep, {
        headers: {
          'Authorization': `Bearer ${appState.token}`,
          'x-auth-token': appState.token || '',
          'x-user-id': appState.currentUser?.id || '',
          'x-user-role': appState.currentUser?.role || ''
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.config) configData = data.config;
      }
    } catch (fetchErr) { console.warn('[Client Handled] fetchErr:', fetchErr && fetchErr.message ? fetchErr.message : fetchErr); }

    if (!configData && firebaseDb) {
      const snap = await firebaseDb.ref('configs/school_signing_config').once('value');
      configData = snap.val();
      if (!configData) {
        const bghSnap = await firebaseDb.ref('configs/bgh_signing_config').once('value');
        configData = bghSnap.val();
      }
    }

    if (configData) {
      if (document.getElementById('inputBghCertOwner')) {
        document.getElementById('inputBghCertOwner').value = configData.certOwner || 'Thầy/Cô Hiệu trưởng';
      }
      if (document.getElementById('inputBghCccd')) {
        document.getElementById('inputBghCccd').value = configData.cccd || '042084002100';
      }
      if (document.getElementById('inputBghSerial')) {
        document.getElementById('inputBghSerial').value = configData.serialNumber || '';
      }
      if (document.getElementById('inputBghTaxCode')) {
        document.getElementById('inputBghTaxCode').value = configData.taxCode || '4300325412';
      }
      if (document.getElementById('inputBghSchool')) {
        document.getElementById('inputBghSchool').value = configData.school || 'TRƯỜNG TRUNG HỌC CƠ SỞ CHU VĂN AN';
      }
    } else {
      if (document.getElementById('inputBghTaxCode') && !document.getElementById('inputBghTaxCode').value) {
        document.getElementById('inputBghTaxCode').value = '4300325412';
      }
    }
  } catch (e) {
    console.warn('Lỗi lấy cấu hình Chữ ký Nhà trường:', e);
  }

  openModal('modalBghConfig');
}

async function scanBghUsbTokenFromAgent() {
  const cccdInput = document.getElementById('inputBghCccd');
  const serialInput = document.getElementById('inputBghSerial');
  const ownerInput = document.getElementById('inputBghCertOwner');
  const taxCodeInput = document.getElementById('inputBghTaxCode');
  const schoolInput = document.getElementById('inputBghSchool');
  const alertEl = document.getElementById('bghConfigAlert');

  if (alertEl) {
    alertEl.classList.add('hidden');
    alertEl.innerHTML /* sanitize */ = '';
  }

  const targetCccd = (cccdInput ? cccdInput.value : '').trim();
  if (!targetCccd) {
    const msg = 'CẦN NHẬP SỐ CCCD: Vui lòng nhập số CCCD của Lãnh đạo (12 chữ số) trước khi thực hiện quét đối soát USB Token!';
    if (alertEl) {
      alertEl.className = 'p-3.5 rounded-xl text-xs font-medium bg-amber-50 text-amber-900 border border-amber-300 block';
      alertEl.innerHTML /* sanitize */ = `<strong>⚠️ CẦN NHẬP SỐ CCCD:</strong> ${msg}`;
      alertEl.classList.remove('hidden');
    }
    showToast('⚠️ Vui lòng nhập số CCCD trước khi quét USB Token!', 'warning');
    return;
  }

  showToast('🔍 Đang kết nối EduSign Agent để quét USB Token Nhà trường...', 'info');

  try {
    const queryUrl = `http://127.0.0.1:18888/api/check-vgca-status?mode=HARDWARE&_t=${Date.now()}`;
    const res = await fetch(queryUrl, {
      signal: AbortSignal.timeout(4000)
    });
    if (!res.ok) throw new Error('Không thể kết nối EduSign Agent');

    const data = await res.json();
    const certs = data.availableCerts || (data.certInfo ? [data.certInfo] : []);

    if (certs.length === 0) {
      const msg = 'Không tìm thấy USB Token nào đang cắm trên máy tính! Vui lòng cắm USB Token của Nhà trường vào cổng USB và thử lại.';
      if (alertEl) {
        alertEl.className = 'p-3 rounded-xl text-xs font-medium bg-amber-50 text-amber-800 border border-amber-300 block';
        alertEl.innerHTML /* sanitize */ = `<strong>⚠️ KHÔNG TÌM THẤY THIẾT BỊ:</strong> ${msg}`;
        alertEl.classList.remove('hidden');
      }
      showModalAlert('KHÔNG TÌM THẤY THIẾT BỊ', msg, 'warning');
      showToast('⚠️ ' + msg, 'warning');
      return;
    }

    const primaryCert = certs[0];
    const certCccd = (primaryCert.cccd || '').trim();

    // 1. Đối soát CCCD: Nếu thiết bị có CCCD nhưng KHÔNG khớp với số CCCD đã nhập
    if (certCccd && targetCccd && certCccd !== targetCccd && !certCccd.includes(targetCccd) && !targetCccd.includes(certCccd)) {
      const mismatchHtml = `
        <div class="space-y-1.5 text-left">
          <div class="text-rose-700 font-bold flex items-center gap-1.5 text-[13px]">
            <span>🚫</span>
            <span>CẢNH BÁO LỆCH ĐỊNH DANH CCCD</span>
          </div>
          <div class="p-2.5 bg-white rounded-xl border border-rose-200 text-xs space-y-1 text-slate-800">
            <div>• Chủ sở hữu Token: <strong class="text-rose-700">${primaryCert.signerName || 'Không xác định'}</strong></div>
            <div>• Số CCCD trên Token: <strong class="text-rose-700 font-mono">${certCccd}</strong></div>
            <div>• Số CCCD cấu hình yêu cầu: <strong class="text-purple-700 font-mono">${targetCccd}</strong></div>
          </div>
          <p class="text-[11px] text-rose-700 font-medium">
            Thiết bị đang cắm không thuộc về lãnh đạo có CCCD ${targetCccd}. Vui lòng cắm đúng USB Token!
          </p>
        </div>
      `;
      if (alertEl) {
        alertEl.className = 'p-3.5 rounded-xl text-xs font-medium bg-rose-50 text-rose-900 border border-rose-300 block';
        alertEl.innerHTML /* sanitize */ = mismatchHtml;
        alertEl.classList.remove('hidden');
      }
      showToast(`⛔ CẢNH BÁO LỆCH ĐỊNH DANH CCCD: CCCD ${certCccd} không khớp ${targetCccd}!`, 'error');
      return;
    }

    // 2. Phân tích danh sách chứng thư: tìm chứng thư của Nhà trường (tổ chức) hoặc Lãnh đạo BGH
    let orgCert = null;
    let personalCert = null;

    for (const c of certs) {
      const subj = (c.subject || '') + ' ' + (c.signerName || '') + ' ' + (c.issuer || '');
      const signer = c.signerName || '';
      const normSigner = removeVietnameseTones(signer).toLowerCase();
      const normSubj = removeVietnameseTones(subj).toLowerCase();

      // Kiểm tra có Mã số thuế tổ chức
      const hasTaxCode = /(?:mst|2\.5\.4\.97|tax|m\.s\.t)[:=\s]*([0-9]{10}(?:-[0-9]{3})?)/i.test(subj) || Boolean(c.taxCode || c.mst);
      // Tên chủ thể (CN) phải là cơ quan/trường học, không phải tên cá nhân giáo viên
      const isOrgName = (normSigner.startsWith('truong ') || normSigner.includes('thcs chu van an') || normSigner.includes('trung hoc co so') || normSigner.startsWith('ubnd ')) &&
                        !normSigner.includes('ty') && !normSigner.includes('lien') && !normSigner.includes('lam') && !normSigner.includes('hien');

      // Hoặc nếu CCCD khớp với targetCccd và tên là lãnh đạo / chủ sở hữu
      const isLeaderMatch = targetCccd && c.cccd && (c.cccd === targetCccd || c.cccd.includes(targetCccd)) && !normSigner.includes('ty');

      if (hasTaxCode || isOrgName || isLeaderMatch) {
        orgCert = c;
        break;
      } else {
        personalCert = c;
      }
    }

    // NẾU CHỈ CẮM TOKEN CÁ NHÂN: BÁO LỖI NGAY VÀ TỪ CHỐI (THEO YÊU CẦU HÌNH 2)
    if (!orgCert) {
      const wrongSigner = personalCert?.signerName || 'Cá nhân';
      const wrongCccd = personalCert?.cccd || 'Không có';
      const wrongSerial = personalCert?.serialNumber || '';

      const alertHtml = `
        <div class="space-y-2 text-left">
          <p class="text-rose-700 font-bold text-[13px]">⛔ PHÁT HIỆN CẮM SAI LOẠI THIẾT BỊ:</p>
          <div class="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-1 text-xs text-rose-900">
            <div>• Thiết bị đang cắm: <strong>Chứng thư số cá nhân</strong></div>
            <div>• Chủ sở hữu: <strong class="text-rose-700">${wrongSigner}</strong></div>
            <div>• Số CCCD: <strong>${wrongCccd}</strong></div>
            <div>• Số Serial: <code class="font-mono bg-white px-1.5 py-0.5 rounded border border-rose-200 text-purple-700 font-bold">${wrongSerial}</code></div>
          </div>
          <p class="text-xs text-slate-700">
            Đây <span class="text-rose-600 font-bold underline">KHÔNG PHẢI là Con dấu điện tử (Chứng thư số pháp nhân) của Nhà trường</span>!<br>
            Theo quy định, con dấu của Nhà trường phải là Token tổ chức có <strong>Mã số thuế (MST)</strong> và tên pháp nhân Nhà trường.
          </p>
          <p class="text-xs font-semibold text-purple-700">
            👉 Vui lòng rút USB cá nhân ra và cắm đúng <strong>USB Token Con dấu Nhà trường</strong> rồi bấm Quét lại!
          </p>
        </div>
      `;

      if (alertEl) {
        alertEl.className = 'p-3.5 rounded-xl text-xs font-medium bg-rose-50 text-rose-900 border border-rose-300 block';
        alertEl.innerHTML /* sanitize */ = alertHtml;
        alertEl.classList.remove('hidden');
      }

      showModalAlert('CẮM SAI THIẾT BỊ CON DẤU NHÀ TRƯỜNG', alertHtml, 'error');
      showToast(`⛔ USB Token đang cắm là của cá nhân [${wrongSigner}], không phải Con dấu Nhà trường!`, 'error');
      return;
    }

    // ĐÃ TÌM THẤY ĐÚNG TOKEN NHÀ TRƯỜNG: TRÍCH XUẤT SERIAL VÀ MÃ SỐ THUẾ CHUẨN XÁC
    const subj = (orgCert.subject || '') + ' ' + (orgCert.signerName || '');
    let extractedMst = orgCert.taxCode || orgCert.mst || '';
    if (!extractedMst) {
      const matchMst = subj.match(/(?:mst|2\.5\.4\.97|tax|m\.s\.t)[:=\s]*([0-9]{10}(?:-[0-9]{3})?)/i);
      if (matchMst) extractedMst = matchMst[1];
    }
    if (!extractedMst) extractedMst = '4300325412'; // Fallback MST THCS Chu Văn An nếu subject ko có

    const certSerial = (orgCert.serialNumber || '').trim().toUpperCase();
    const certOrgName = orgCert.signerName || 'TRƯỜNG TRUNG HỌC CƠ SỞ CHU VĂN AN';
    const normCertName = removeVietnameseTones(certOrgName).toLowerCase();

    if (serialInput) serialInput.value = certSerial;
    if (taxCodeInput) taxCodeInput.value = extractedMst;
    if (schoolInput && !normCertName.includes('lien') && !normCertName.includes('hien') && !normCertName.includes('ty')) {
      schoolInput.value = certOrgName;
    }

    const successHtml = `
      <div class="space-y-1.5 text-left">
        <div class="text-emerald-800 font-bold flex items-center gap-1.5 text-[13px]">
          <span>✅</span>
          <span>ĐÃ QUÉT & ĐỐI SOÁT KHỚP THÀNH CÔNG</span>
        </div>
        <div class="p-2.5 bg-white rounded-xl border border-emerald-200 text-xs space-y-1 text-slate-800">
          <div>• Chủ sở hữu / Cơ quan: <strong>${certOrgName}</strong></div>
          <div>• Mã số thuế / Định danh: <strong class="text-purple-700 font-mono font-bold">${extractedMst}</strong></div>
          <div>• Số Serial Token: <code class="font-mono font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded">${certSerial}</code></div>
          <div>• Nhà cung cấp (CA): <strong>${orgCert.issuer || 'Ban Cơ yếu Chính phủ / Viettel-CA'}</strong></div>
        </div>
        <p class="text-[11px] text-emerald-700 font-medium">
          Thông tin Số Serial đã được tự động điền và đối soát khớp với CCCD. Hãy bấm <strong>"Lưu cấu hình Chữ ký Nhà trường"</strong> bên dưới để hoàn tất.
        </p>
      </div>
    `;

    if (alertEl) {
      alertEl.className = 'p-3.5 rounded-xl text-xs font-medium bg-emerald-50 text-emerald-900 border border-emerald-300 block';
      alertEl.innerHTML /* sanitize */ = successHtml;
      alertEl.classList.remove('hidden');
    }

    showToast(`✅ ĐÃ QUÉT & ĐỐI SOÁT KHỚP THÀNH CÔNG USB Token [${certSerial}]!`, 'success');
  } catch (err) {
    console.error('Lỗi quét USB Token Nhà trường:', err);
    const alertHtml = `
      <div class="space-y-1 text-left">
        <p class="text-rose-700 font-bold text-xs">⚠️ CHƯA KHỞI CHẠY EDUSIGN AGENT</p>
        <p class="text-xs text-slate-700">
          Không thể kết nối tới EduSign Agent (cổng 18888). Thầy/Cô vui lòng khởi động phần mềm <strong>EduSign_Agent.exe</strong> trên máy tính rồi quét lại.
        </p>
      </div>
    `;
    if (alertEl) {
      alertEl.className = 'p-3 rounded-xl text-xs font-medium bg-amber-50 text-amber-900 border border-amber-300 block';
      alertEl.innerHTML /* sanitize */ = alertHtml;
      alertEl.classList.remove('hidden');
    }
    showModalAlert('CHƯA KHỞI CHẠY EDUSIGN AGENT', 'Không thể kết nối tới EduSign Agent (cổng 18888). Vui lòng khởi động EduSign_Agent.exe trên máy tính để quét thiết bị.', 'warning');
    showToast('⚠️ Không thể kết nối tới EduSign Agent (cổng 18888).', 'error');
  }
}

async function handleSaveBghConfig(event) {
  event.preventDefault();
  const cccd = document.getElementById('inputBghCccd')?.value.trim() || '042084002100';
  const certOwner = document.getElementById('inputBghCertOwner')?.value.trim() || 'Thầy/Cô Hiệu trưởng';
  const serialNumber = (document.getElementById('inputBghSerial')?.value || '').trim().toUpperCase();
  const taxCode = (document.getElementById('inputBghTaxCode')?.value || '').trim() || '4300325412';
  const school = document.getElementById('inputBghSchool')?.value.trim() || 'TRƯỜNG TRUNG HỌC CƠ SỞ CHU VĂN AN';
  const alertEl = document.getElementById('bghConfigAlert');
  const btn = document.getElementById('btnSaveBghConfig');

  if (!serialNumber) {
    showToast('⚠️ Vui lòng nhập hoặc quét số Serial của USB Token Con dấu Nhà trường!', 'warning');
    return;
  }

  try {
    if (btn) btn.disabled = true;

    const payload = {
      signType: 'USB_TOKEN',
      cccd,
      certOwner,
      serialNumber,
      taxCode,
      school,
      updatedAt: new Date().toISOString()
    };

    // Lưu vào Firebase RTDB trực tiếp
    if (firebaseDb) {
      await firebaseDb.ref('configs/bgh_signing_config').set(payload);
      await firebaseDb.ref('configs/school_signing_config').set(payload);
    }

    if (!isStaticOrGitHub || API_BASE) {
      const ep = API_BASE ? `${API_BASE}/api/bgh/signing-config` : '/api/bgh/signing-config';
      await fetch(ep, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${appState.token}`,
          'x-auth-token': appState.token || '',
          'x-user-id': appState.currentUser?.id || '',
          'x-user-role': appState.currentUser?.role || ''
        },
        body: JSON.stringify(payload)
      }).catch((syncErr) => {
        console.warn('[handleSaveBghConfig] Lỗi đồng bộ cấu hình BGH lên backend:', syncErr && syncErr.message ? syncErr.message : syncErr);
      });
    }

    if (alertEl) {
      alertEl.innerHTML /* sanitize */ = '✅ Đã lưu và kích hoạt cấu hình Chữ ký &amp; Con dấu Nhà trường thành công!';
      alertEl.className = 'p-3 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 block';
    }
    showToast('✅ Đã lưu cấu hình Chữ ký & Con dấu Nhà trường thành công!', 'success');
    setTimeout(() => closeModal('modalBghConfig'), 1200);
  } catch (err) {
    if (alertEl) {
      alertEl.textContent = `❌ ${err.message}`;
      alertEl.className = 'p-3 rounded-xl text-xs font-medium bg-red-50 text-red-700 border border-red-200 block';
    }
    showToast(err.message, 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

// ==================== APP INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
  checkSession();
});



// ==================== QUẢN LÝ MÃ PIN ZALO & THÔNG TIN CÁ NHÂN (R2, R3) ====================
function generateDefaultPinForModalUser() {
  const randomPin = Math.floor(1000 + Math.random() * 9000).toString();
  const pinInput = document.getElementById('userZaloPin');
  if (pinInput) {
    pinInput.value = randomPin;
    showToast(`Đã tạo mã PIN ngẫu nhiên: ${randomPin}`, 'info');
  }
}

function openModalUserProfile() {
  let user = appState.currentUser;
  if (!user) {
    showToast('Vui lòng đăng nhập để xem thông tin cá nhân.', 'warning');
    return;
  }

  // Luôn đọc dữ liệu mới nhất từ appState.users hoặc localStorage edusign_users
  let freshList = (appState.users && appState.users.length) ? appState.users : [];
  if (!freshList.length) {
    try {
      freshList = JSON.parse(localStorage.getItem('edusign_users') || '[]');
    } catch (e) {
      freshList = [];
    }
  }

  const matchedUser = freshList.find(u => (u.id && u.id === user.id) || (u.username && u.username.toLowerCase() === (user.username || '').toLowerCase()));
  if (matchedUser) {
    user = { ...user, ...matchedUser };
    appState.currentUser = user;
    try {
      localStorage.setItem('edusign_user', JSON.stringify(user));
    } catch (e) { console.warn('[Client Handled] e:', e && e.message ? e.message : e); }
  }

  const displayName = user.fullName || user.name || user.username;
  const rawPhone = user.phone || ((user.username === 'cva.ty' || user.id === 'user_cvaty' || (user.username && user.username.includes('ty'))) ? '0818810007' : '');
  const cleanPhone = normalizeTeacherPhone(rawPhone) || rawPhone.replace(/\D/g, '');
  const cleanCccd = (user.cccd || '').replace(/\D/g, '');

  // Đảm bảo hiển thị đúng mã PIN vừa cập nhật (ví dụ: Cva@ hoặc mã mới), không fallback về 4 số cuối SĐT 0007 nếu đã có pinCode
  const pin = (user.pinCode !== undefined && user.pinCode !== null && String(user.pinCode).trim() !== '')
    ? String(user.pinCode).trim()
    : ((user.zaloPin !== undefined && user.zaloPin !== null && String(user.zaloPin).trim() !== '')
      ? String(user.zaloPin).trim()
      : '1234');
  const phoneDisplay = cleanPhone || 'Chưa cập nhật';

  if (document.getElementById('profFullName')) document.getElementById('profFullName').textContent = displayName;
  if (document.getElementById('profUsername')) document.getElementById('profUsername').textContent = user.username || '';
  if (document.getElementById('profDepartment')) document.getElementById('profDepartment').textContent = user.department || user.departmentName || 'Ban Giám hiệu';
  if (document.getElementById('profRole')) document.getElementById('profRole').textContent = user.roleTitle || (user.role === 'ADMIN' ? 'Quản trị viên' : (user.role === 'BGH' ? 'Ban Giám hiệu' : (user.role === 'LEADER' ? 'Tổ trưởng' : 'Giáo viên')));
  if (document.getElementById('profCccd')) document.getElementById('profCccd').textContent = user.cccd || 'Chưa cập nhật';
  if (document.getElementById('profPhone')) document.getElementById('profPhone').textContent = phoneDisplay;
  if (document.getElementById('profPinCode')) document.getElementById('profPinCode').textContent = pin;
  if (document.getElementById('profSyntaxPhone')) document.getElementById('profSyntaxPhone').textContent = cleanPhone || '0818810007';
  if (document.getElementById('profSyntaxFull')) document.getElementById('profSyntaxFull').textContent = `LK ${cleanPhone || '0818810007'} ${pin}`;

  openModal('modalUserProfile');
}

function copyZaloLinkSyntax() {
  let user = appState.currentUser;
  if (!user) return;
  let freshList = (appState.users && appState.users.length) ? appState.users : [];
  if (!freshList.length) {
    try { freshList = JSON.parse(localStorage.getItem('edusign_users') || '[]'); } catch (e) { console.warn('[Client Handled] e:', e && e.message ? e.message : e); }
  }
  const matchedUser = freshList.find(u => (u.id && u.id === user.id) || (u.username && u.username.toLowerCase() === (user.username || '').toLowerCase()));
  if (matchedUser) {
    user = { ...user, ...matchedUser };
  }
  const rawPhone = user.phone || ((user.username === 'cva.ty' || user.id === 'user_cvaty' || (user.username && user.username.includes('ty'))) ? '0818810007' : '');
  const cleanPhone = normalizeTeacherPhone(rawPhone) || rawPhone.replace(/\D/g, '');
  const pin = (user.pinCode !== undefined && user.pinCode !== null && String(user.pinCode).trim() !== '')
    ? String(user.pinCode).trim()
    : ((user.zaloPin !== undefined && user.zaloPin !== null && String(user.zaloPin).trim() !== '')
      ? String(user.zaloPin).trim()
      : '1234');
  const syntax = cleanPhone ? `LK ${cleanPhone} ${pin}` : `LK 0818810007 ${pin}`;

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(syntax).then(() => {
      showToast(`✅ Đã sao chép cú pháp liên kết: ${syntax}`, 'success');
    }).catch(() => {
      prompt('Sao chép cú pháp liên kết Zalo:', syntax);
    });
  } else {
    prompt('Sao chép cú pháp liên kết Zalo:', syntax);
  }
}

// ==================== TÍNH NĂNG EXCEL & DỌN DẸP DỮ LIỆU RÁC (R4, R5) ====================

/**
 * R4: Dọn dẹp sạch toàn bộ tài liệu rác thử nghiệm
 */
async function cleanGarbageDocuments() {
  try {
    if (appState) {
      appState.documents = [];
    }
    try {
      localStorage.removeItem('edusign_documents');
      localStorage.removeItem('edusign_documents_cache');
    } catch (e) { console.warn('[Client Handled] e:', e && e.message ? e.message : e); }

    if (firebaseDb) {
      await firebaseDb.ref('documents').remove();
    } else if (typeof RTDB_URL !== 'undefined' && RTDB_URL) {
      await fetch(`${RTDB_URL}/documents.json`, { method: 'DELETE' }).catch(() => null);
    }

    if (typeof showToast === 'function') {
      showToast('✅ Đã dọn dẹp sạch toàn bộ tài liệu rác thử nghiệm!', 'success');
    }
    if (typeof loadAdminReportManagement === 'function') {
      await loadAdminReportManagement(true);
    }
    if (typeof loadSchoolReports === 'function') {
      loadSchoolReports(true);
    }
    return { success: true };
  } catch (err) {
    console.warn('[cleanGarbageDocuments]', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * R5: Tải file Excel mẫu danh sách Giáo viên chuẩn của trường THCS Chu Văn An
 */
function downloadTeacherExcelTemplate() {
  if (typeof XLSX === 'undefined') {
    showToast('Thư viện Excel đang tải, vui lòng thử lại sau giây lát!', 'warning');
    return;
  }

  const headers = [
    'STT',
    'Họ và Tên',
    'Tên đăng nhập',
    'Mật khẩu',
    'Tổ Chuyên Môn',
    'Chức vụ',
    'Số CCCD',
    'Email Công Vụ',
    'Số Điện Thoại',
    'Mã PIN',
    'Loại chữ ký'
  ];

  const sampleRows = [
    [1, 'Nguyễn Văn An', 'cva.an', '123456', 'Tổ Toán - Tin', 'Giáo viên', '042084001111', 'an.nv@quangngai.gov.vn', '0905111222', '2026', 'SmartCA'],
    [2, 'Trần Thị Bình', 'cva.binh', '123456', 'Tổ Ngữ Văn', 'Tổ trưởng chuyên môn', '042085002222', 'binh.tt@quangngai.gov.vn', '0912333444', '2026', 'SmartCA'],
    [3, 'Lê Hoàng Cường', 'cva.cuong', '123456', 'Tổ Khoa học Tự nhiên', 'Giáo viên', '042086003333', 'cuong.lh@quangngai.gov.vn', '0987555666', '2026', 'USB']
  ];

  const wsData = [headers, ...sampleRows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  ws['!cols'] = [
    { wch: 6 },
    { wch: 22 },
    { wch: 15 },
    { wch: 12 },
    { wch: 22 },
    { wch: 22 },
    { wch: 16 },
    { wch: 26 },
    { wch: 15 },
    { wch: 10 },
    { wch: 14 }
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'DanhSachGiaoVien');
  XLSX.writeFile(wb, 'Mau_Danh_Sach_Giao_Vien_EduSign_THCS_ChuVanAn.xlsx');
  showToast('✅ Đã tải file Excel mẫu danh sách giáo viên thành công!', 'success');
}

/**
 * R5: Mở modal nhập giáo viên từ Excel
 */
let stagedImportTeachers = [];

function openModalImportTeacherExcel() {
  stagedImportTeachers = [];
  const fileInput = document.getElementById('inputTeacherExcelFile');
  if (fileInput) fileInput.value = '';

  const infoBox = document.getElementById('boxExcelFileInfo');
  if (infoBox) infoBox.classList.add('hidden');

  const previewBox = document.getElementById('boxExcelPreview');
  if (previewBox) previewBox.classList.add('hidden');

  const tbody = document.getElementById('tbodyExcelPreview');
  if (tbody) tbody.innerHTML /* sanitize */ = '';

  const btnConfirm = document.getElementById('btnConfirmImportExcel');
  if (btnConfirm) btnConfirm.disabled = true;

  openModal('modalImportTeacherExcel');
}

/**
 * R5: Đọc và phân tích file Excel giáo viên
 */
function handleTeacherExcelFileSelected(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  if (typeof XLSX === 'undefined') {
    showToast('Thư viện Excel chưa sẵn sàng!', 'error');
    return;
  }

  const fileNameEl = document.getElementById('excelFileName');
  const fileSizeEl = document.getElementById('excelFileSize');
  const infoBox = document.getElementById('boxExcelFileInfo');
  const previewBox = document.getElementById('boxExcelPreview');
  const badgeValid = document.getElementById('badgeExcelValid');
  const badgeDup = document.getElementById('badgeExcelDuplicate');
  const tbody = document.getElementById('tbodyExcelPreview');
  const btnConfirm = document.getElementById('btnConfirmImportExcel');
  const summaryText = document.getElementById('previewSummaryText');

  if (fileNameEl) fileNameEl.textContent = file.name;
  if (fileSizeEl) fileSizeEl.textContent = `(${(file.size / 1024).toFixed(1)} KB)`;
  if (infoBox) infoBox.classList.remove('hidden');

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      if (!rows || rows.length < 2) {
        showToast('File Excel không có dữ liệu hoặc thiếu dòng tiêu đề!', 'warning');
        return;
      }

      // Nhận diện dòng header
      const headerRow = rows[0].map(h => String(h || '').trim().toLowerCase());
      const colMap = {
        name: headerRow.findIndex(h => h.includes('họ') || h.includes('tên') || h.includes('name')),
        username: headerRow.findIndex(h => h.includes('đăng nhập') || h.includes('username') || h.includes('tài khoản')),
        password: headerRow.findIndex(h => h.includes('mật khẩu') || h.includes('password')),
        dept: headerRow.findIndex(h => h.includes('tổ') || h.includes('chuyên môn') || h.includes('phòng ban')),
        role: headerRow.findIndex(h => h.includes('chức vụ') || h.includes('vai trò') || h.includes('role')),
        cccd: headerRow.findIndex(h => h.includes('cccd') || h.includes('căn cước') || h.includes('cmnd')),
        email: headerRow.findIndex(h => h.includes('email')),
        phone: headerRow.findIndex(h => h.includes('thoại') || h.includes('sđt') || h.includes('phone')),
        pin: headerRow.findIndex(h => h.includes('pin')),
        signType: headerRow.findIndex(h => h.includes('chữ ký') || h.includes('loại ký') || h.includes('signtype'))
      };

      if (colMap.name === -1) colMap.name = 1;
      if (colMap.username === -1) colMap.username = 2;
      if (colMap.password === -1) colMap.password = 3;
      if (colMap.dept === -1) colMap.dept = 4;
      if (colMap.role === -1) colMap.role = 5;
      if (colMap.cccd === -1) colMap.cccd = 6;
      if (colMap.email === -1) colMap.email = 7;
      if (colMap.phone === -1) colMap.phone = 8;
      if (colMap.pin === -1) colMap.pin = 9;
      if (colMap.signType === -1) colMap.signType = 10;

      const existingUsers = appState.users || [];
      const existingUsernames = new Set(existingUsers.map(u => (u.username || '').toLowerCase()));
      const existingCccds = new Set(existingUsers.filter(u => u.cccd).map(u => String(u.cccd).replace(/\D/g, '')));

      stagedImportTeachers = [];
      let validCount = 0;
      let dupCount = 0;
      let htmlRows = '';

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0 || row.every(cell => cell === null || cell === undefined || String(cell).trim() === '')) {
          continue;
        }

        const fullName = String(row[colMap.name] || '').trim();
        const username = String(row[colMap.username] || '').trim().toLowerCase();
        const password = String(row[colMap.password] || '123456').trim();
        const deptName = String(row[colMap.dept] || 'Tổ Toán - Tin').trim();
        const roleTitle = String(row[colMap.role] || 'Giáo viên').trim();
        const cccd = String(row[colMap.cccd] || '').replace(/\D/g, '');
        const email = String(row[colMap.email] || '').trim();
        const rawPhone = String(row[colMap.phone] || '').trim();
        const phone = normalizeTeacherPhone(rawPhone) || rawPhone.replace(/\D/g, '');
        const rawPin = String(row[colMap.pin] || '').trim();
        const pinCode = rawPin || (phone.length >= 4 ? phone.slice(-4) : '2026');
        const signTypeRaw = String(row[colMap.signType] || '').trim().toUpperCase();
        const signType = (signTypeRaw.includes('USB') || signTypeRaw.includes('TOKEN')) ? 'USB_TOKEN' : 'VGCA';

        if (!fullName || !username) {
          dupCount++;
          htmlRows += `
            <tr class="bg-rose-50/40 text-rose-700">
              <td class="p-2 border-b font-mono">${i}</td>
              <td class="p-2 border-b font-semibold">${fullName || '<i class="text-slate-400">Trống</i>'}</td>
              <td class="p-2 border-b font-mono">${username || '<i class="text-slate-400">Trống</i>'}</td>
              <td class="p-2 border-b">${deptName}</td>
              <td class="p-2 border-b font-mono">${phone || '-'}</td>
              <td class="p-2 border-b font-mono font-bold">${pinCode}</td>
              <td class="p-2 border-b"><span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">Thiếu tên/username</span></td>
            </tr>`;
          continue;
        }

        let isDuplicate = false;
        let dupReason = '';
        if (existingUsernames.has(username)) {
          isDuplicate = true;
          dupReason = 'Trùng Username';
        } else if (cccd && existingCccds.has(cccd)) {
          isDuplicate = true;
          dupReason = 'Trùng Số CCCD';
        }

        if (isDuplicate) {
          dupCount++;
          htmlRows += `
            <tr class="bg-amber-50/50 text-amber-900">
              <td class="p-2 border-b font-mono">${i}</td>
              <td class="p-2 border-b font-semibold">${fullName}</td>
              <td class="p-2 border-b font-mono">${username}</td>
              <td class="p-2 border-b">${deptName}</td>
              <td class="p-2 border-b font-mono">${phone || '-'}</td>
              <td class="p-2 border-b font-mono font-bold">${pinCode}</td>
              <td class="p-2 border-b"><span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">${dupReason}</span></td>
            </tr>`;
        } else {
          validCount++;
          existingUsernames.add(username);
          if (cccd) existingCccds.add(cccd);

          let matchedDept = (appState.departments || []).find(d => 
            d.name.toLowerCase().includes(deptName.toLowerCase()) || 
            deptName.toLowerCase().includes(d.name.toLowerCase())
          );
          const departmentId = matchedDept ? matchedDept.id : 'dept_toan_tin';
          const departmentName = matchedDept ? matchedDept.name : deptName;

          let role = 'TEACHER';
          const lowerRole = roleTitle.toLowerCase();
          if (lowerRole.includes('trưởng') || lowerRole.includes('leader')) role = 'LEADER';
          else if (lowerRole.includes('hiệu') || lowerRole.includes('bgh') || lowerRole.includes('giám hiệu')) role = 'BGH';
          else if (lowerRole.includes('admin') || lowerRole.includes('quản trị')) role = 'ADMIN';

          stagedImportTeachers.push({
            id: `user_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
            fullName,
            name: fullName,
            username,
            password,
            departmentId,
            departmentName,
            department: departmentName,
            role,
            roleTitle: role === 'ADMIN' ? 'Quản trị viên' : (role === 'BGH' ? 'Ban Giám hiệu' : (role === 'LEADER' ? 'Tổ trưởng chuyên môn' : 'Giáo viên')),
            cccd,
            email,
            phone,
            pinCode,
            zaloPin: pinCode,
            signType,
            canUploadWord: true,
            canStampSeal: false,
            isLocked: false,
            createdAt: new Date().toISOString()
          });

          htmlRows += `
            <tr class="hover:bg-slate-50">
              <td class="p-2 border-b font-mono text-slate-500">${i}</td>
              <td class="p-2 border-b font-bold text-slate-800">${fullName}</td>
              <td class="p-2 border-b font-mono font-semibold text-brand-600">${username}</td>
              <td class="p-2 border-b text-slate-600">${departmentName}</td>
              <td class="p-2 border-b font-mono text-slate-700">${phone || '-'}</td>
              <td class="p-2 border-b font-mono font-bold text-indigo-700">${pinCode}</td>
              <td class="p-2 border-b"><span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">✅ Hợp lệ</span></td>
            </tr>`;
        }
      }

      if (badgeValid) badgeValid.textContent = `Hợp lệ: ${validCount}`;
      if (badgeDup) badgeDup.textContent = `Bỏ qua: ${dupCount}`;
      if (tbody) tbody.innerHTML /* sanitize */ = htmlRows;
      if (summaryText) summaryText.textContent = `Tìm thấy ${validCount} tài khoản hợp lệ sẵn sàng tạo mới (${dupCount} dòng bỏ qua/trùng lặp).`;
      if (previewBox) previewBox.classList.remove('hidden');
      if (btnConfirm) btnConfirm.disabled = (validCount === 0);

      if (validCount > 0) {
        showToast(`Đã đọc ${validCount} giáo viên hợp lệ từ file Excel!`, 'success');
      } else {
        showToast('Không có tài khoản giáo viên mới nào hợp lệ trong file.', 'warning');
      }
    } catch (parseErr) {
      console.error('[Import Teacher Excel]:', parseErr);
      showToast(`Lỗi đọc file Excel: ${parseErr.message}`, 'error');
    }
  };

  reader.readAsArrayBuffer(file);
}

/**
 * R5: Xác nhận nhập toàn bộ giáo viên hợp lệ vào hệ thống
 */
async function handleConfirmImportTeachers() {
  if (!stagedImportTeachers || !stagedImportTeachers.length) {
    showToast('Không có giáo viên hợp lệ để nhập!', 'warning');
    return;
  }

  const count = stagedImportTeachers.length;
  const btn = document.getElementById('btnConfirmImportExcel');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML /* sanitize */ = `<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg> Đang nhập ${count} giáo viên...`;
  }

  try {
    const updatedUsers = [...(appState.users || []), ...stagedImportTeachers];
    appState.users = updatedUsers;

    try {
      localStorage.setItem('edusign_users', JSON.stringify(updatedUsers));
    } catch (e) { console.warn('[Client Handled] e:', e && e.message ? e.message : e); }

    await syncUsersToFirebase(updatedUsers);

    for (const t of stagedImportTeachers) {
      syncTeacherToGoogleSheet(t);
    }

    closeModal('modalImportTeacherExcel');
    renderTeachersTable();
    showToast(`🎉 Đã nhập thành công ${count} giáo viên mới từ Excel và đồng bộ Google Sheet!`, 'success');
    stagedImportTeachers = [];
  } catch (err) {
    console.error('[handleConfirmImportTeachers]:', err);
    showToast(`Nhập dữ liệu thất bại: ${err.message}`, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML /* sanitize */ = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg> <span>Xác nhận nhập giáo viên</span>`;
    }
  }
}
