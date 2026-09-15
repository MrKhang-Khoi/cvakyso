const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const DOCS_FILE = path.join(DATA_DIR, 'documents.json');
const DEPTS_FILE = path.join(DATA_DIR, 'departments.json');
const SUBS_FILE = path.join(DATA_DIR, 'subscriptions.json');

// Đảm bảo thư mục data tồn tại
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Khởi tạo danh sách tổ chuyên môn mặc định nếu chưa có
function initDefaultDepts() {
  if (!fs.existsSync(DEPTS_FILE)) {
    const defaultDepts = [
      { id: 'dept_bgh', name: 'Ban Giám hiệu', code: 'BGH', description: 'Lãnh đạo và quản lý toàn diện các hoạt động nhà trường', leaderId: 'admin', createdAt: new Date().toISOString() },
      { id: 'dept_toan_tin', name: 'Tổ Toán - Tin', code: 'TOAN_TIN', description: 'Tổ chuyên môn Toán học và Tin học', leaderId: null, createdAt: new Date().toISOString() },
      { id: 'dept_ngu_van', name: 'Tổ Ngữ Văn', code: 'NGU_VAN', description: 'Tổ chuyên môn Ngữ văn và Nghệ thuật', leaderId: null, createdAt: new Date().toISOString() },
      { id: 'dept_ngoai_ngu', name: 'Tổ Ngoại Ngữ', code: 'NGOAI_NGU', description: 'Tổ chuyên môn Tiếng Anh', leaderId: null, createdAt: new Date().toISOString() },
      { id: 'dept_khtn', name: 'Tổ Khoa học Tự nhiên', code: 'KHTN', description: 'Tổ chuyên môn Vật lý, Hóa học, Sinh học', leaderId: null, createdAt: new Date().toISOString() },
      { id: 'dept_ls_dl', name: 'Tổ Lịch sử - Địa lý', code: 'LS_DL', description: 'Tổ chuyên môn Lịch sử, Địa lý, GDCD', leaderId: null, createdAt: new Date().toISOString() },
      { id: 'dept_gdtc_nt', name: 'Tổ Giáo dục Thể chất - Nghệ thuật', code: 'GDTC_NT', description: 'Tổ chuyên môn Thể dục, Âm nhạc, Mỹ thuật', leaderId: null, createdAt: new Date().toISOString() },
      { id: 'dept_van_phong', name: 'Văn phòng nhà trường', code: 'VAN_PHONG', description: 'Bộ phận hành chính, kế toán, văn thư, y tế', leaderId: null, createdAt: new Date().toISOString() }
    ];
    fs.writeFileSync(DEPTS_FILE, JSON.stringify(defaultDepts, null, 2), 'utf8');
  }
}

// Khởi tạo danh sách đăng ký thông báo Web Push
function initDefaultSubscriptions() {
  if (!fs.existsSync(SUBS_FILE)) {
    fs.writeFileSync(SUBS_FILE, JSON.stringify([], null, 2), 'utf8');
  }
}

// Khởi tạo tài khoản Admin mặc định nếu chưa có
function initDefaultUsers() {
  if (!fs.existsSync(USERS_FILE)) {
    const defaultUsers = [
      {
        id: 'admin',
        username: 'admin',
        password: 'admin@123',
        name: 'Ban Giám hiệu - Quản trị viên',
        role: 'ADMIN',
        roleTitle: 'Quản trị viên nhà trường',
        department: 'Ban Giám hiệu',
        departmentId: 'dept_bgh',
        signType: 'USB_TOKEN',
        status: 'ACTIVE',
        email: 'bgh-dakha@quangngai.gov.vn',
        officialEmail: 'bgh-dakha@quangngai.gov.vn',
        cccd: '042084002100',
        certSerial: '025E056A3F133DA9',
        school: 'TRƯỜNG TRUNG HỌC CƠ SỞ CHU VĂN AN',
        phone: '0255.385.0001',
        createdAt: new Date().toISOString()
      }
    ];
    fs.writeFileSync(USERS_FILE, JSON.stringify(defaultUsers, null, 2), 'utf8');
  }
}

// Khởi tạo danh sách tài liệu trống
function initDefaultDocs() {
  if (!fs.existsSync(DOCS_FILE)) {
    fs.writeFileSync(DOCS_FILE, JSON.stringify([], null, 2), 'utf8');
  }
}

initDefaultDepts();
initDefaultSubscriptions();
initDefaultUsers();
initDefaultDocs();

const DEPARTMENTS = [
  'Tổ Toán - Tin',
  'Tổ Ngữ Văn',
  'Tổ Ngoại Ngữ',
  'Tổ Khoa học Tự nhiên',
  'Tổ Lịch sử - Địa lý',
  'Tổ Giáo dục Thể chất - Nghệ thuật',
  'Văn phòng nhà trường',
  'Ban Giám hiệu'
];

function readJsonSafe(filePath, defaultVal = []) {
  try {
    if (!fs.existsSync(filePath)) return defaultVal;
    let data = fs.readFileSync(filePath, 'utf8');
    if (data.charCodeAt(0) === 0xFEFF) data = data.slice(1);
    return JSON.parse(data.trim());
  } catch {
    return defaultVal;
  }
}

// =================== CƠ CHẾ HÀNG ĐỢI GHI ĐĨA BẤT ĐỒNG BỘ & BỘ NHỚ ĐỆM ===================
let _usersCache = null;

// Đọc danh sách người dùng (ưu tiên bộ nhớ RAM, chống lệch pha dữ liệu)
function getUsers(forceReload = false) {
  if (forceReload || !_usersCache) {
    _usersCache = readJsonSafe(USERS_FILE, []);
  }
  return _usersCache;
}

// Dọn dẹp các tệp tạm .tmp tồn đọng từ các phiên làm việc trước
try {
  const dataDir = path.dirname(USERS_FILE);
  if (fs.existsSync(dataDir)) {
    fs.readdirSync(dataDir).forEach(f => {
      if (f.endsWith('.tmp')) {
        try { fs.unlinkSync(path.join(dataDir, f)); } catch {}
      }
    });
  }
} catch {}

/**
 * Ghi tệp JSON bất đồng bộ an toàn với cơ chế retry phi nghẽn (non-blocking).
 * TUYỆT ĐỐI KHÔNG dùng Atomics.wait gây đóng băng V8 Event Loop.
 */
async function _writeJsonAsyncWithRetry(filePath, data, maxAttempts = 12) {
  const content = JSON.stringify(data, null, 2);
  let tempPath = null;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      tempPath = `${filePath}.${Date.now()}.${Math.random().toString(36).slice(2, 6)}.tmp`;
      await fs.promises.writeFile(tempPath, content, 'utf8');
      try {
        await fs.promises.rename(tempPath, filePath);
      } catch (renameErr) {
        // Khắc phục tranh chấp khóa tệp NTFS trên Windows: copy đè và xóa tệp tạm
        try {
          await fs.promises.copyFile(tempPath, filePath);
          try { await fs.promises.unlink(tempPath); } catch {}
        } catch (copyErr) {
          throw renameErr;
        }
      }
      return;
    } catch (err) {
      if (tempPath) {
        try {
          if (fs.existsSync(tempPath)) {
            await fs.promises.unlink(tempPath);
          }
        } catch {}
      }
      try {
        // Fallback ghi trực tiếp nếu thao tác đổi tên tạm thất bại
        await fs.promises.writeFile(filePath, content, 'utf8');
        return;
      } catch (err2) {
        if (attempt === maxAttempts - 1) {
          throw err2;
        }
        // Non-blocking backoff delay: nhường CPU cho Event Loop xử lý các request khác
        const delay = Math.min(200, 15 * Math.pow(1.3, attempt) + Math.random() * 10);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
}

// Quản lý hàng đợi ghi đĩa tuần tự độc lập cho từng file đường dẫn (Serialized Queue)
const _fileQueues = new Map();

function _getFileQueue(filePath) {
  const normalizedPath = path.resolve(filePath);
  let q = _fileQueues.get(normalizedPath);
  if (!q) {
    q = {
      isWriting: false,
      hasPending: false,
      pendingData: null,
      resolvers: []
    };
    _fileQueues.set(normalizedPath, q);
  }
  return q;
}

function _hasPendingWrites(filePath) {
  const normalizedPath = path.resolve(filePath);
  const q = _fileQueues.get(normalizedPath);
  return q ? (q.isWriting || q.hasPending) : false;
}

function _queueFileSave(filePath, data) {
  if (!filePath) return Promise.resolve(true);
  const normalizedPath = path.resolve(filePath);
  const q = _getFileQueue(normalizedPath);

  q.pendingData = data;

  const promise = new Promise((resolve, reject) => {
    q.resolvers.push({ resolve, reject });

    if (q.isWriting) {
      // Đã có luồng ghi đang chạy -> đánh dấu pending để gom đợt ghi tiếp theo (coalescing)
      q.hasPending = true;
      return;
    }

    _processFileQueue(normalizedPath, q);
  });

  // Bắt lỗi ngầm để tránh unhandledRejection nếu caller gọi save không dùng await
  promise.catch(() => {});
  return promise;
}

async function _processFileQueue(filePath, q) {
  q.isWriting = true;

  while (true) {
    q.hasPending = false;
    const currentResolvers = q.resolvers;
    q.resolvers = [];

    // Đối với DOCS_FILE, luôn lấy trực tiếp _docsCache mới nhất trong RAM để tránh Lost Update
    let dataToSave;
    if (path.resolve(filePath) === path.resolve(DOCS_FILE)) {
      dataToSave = _docsCache || [];
    } else {
      dataToSave = q.pendingData;
    }

    let success = false;
    let writeErr = null;

    try {
      await _writeJsonAsyncWithRetry(filePath, dataToSave);
      success = true;
    } catch (err) {
      writeErr = err;
      console.error(`[DataStore] Lỗi khi ghi đĩa file ${path.basename(filePath)}:`, err);
    }

    for (const r of currentResolvers) {
      try {
        if (success) {
          r.resolve(true);
        } else {
          r.reject(writeErr);
        }
      } catch {}
    }

    // Nếu trong lúc ghi vừa rồi có yêu cầu lưu mới đến, tiếp tục vòng lặp ghi đợt tiếp theo
    if (q.hasPending) {
      continue;
    } else {
      break;
    }
  }

  q.isWriting = false;
}

async function waitForPendingWrites(filePath = DOCS_FILE) {
  const normalizedPath = path.resolve(filePath);
  const q = _fileQueues.get(normalizedPath);
  if (!q || (!q.isWriting && !q.hasPending)) {
    return true;
  }
  return new Promise(resolve => {
    q.resolvers.push({ resolve, reject: resolve });
  });
}

function saveJsonSafe(filePath, data) {
  return _queueFileSave(filePath, data);
}

function saveJsonSafeSync(filePath, data) {
  const content = JSON.stringify(data, null, 2);
  const tempPath = `${filePath}.${Date.now()}.${Math.random().toString(36).slice(2, 6)}.tmp`;
  try {
    fs.writeFileSync(tempPath, content, 'utf8');
    fs.renameSync(tempPath, filePath);
  } catch {
    if (fs.existsSync(tempPath)) {
      try { fs.unlinkSync(tempPath); } catch {}
    }
    fs.writeFileSync(filePath, content, 'utf8');
  }
}

function saveUsers(users) {
  if (Array.isArray(users)) {
    _usersCache = users;
  }
  return saveJsonSafe(USERS_FILE, _usersCache);
}

function getUserById(id) {
  return getUsers().find(u => u.id === id);
}

function getUserByUsername(username) {
  if (!username) return null;
  return getUsers().find(u => u.username.toLowerCase() === username.toLowerCase().trim());
}

// =================== QUẢN LÝ TỔ CHUYÊN MÔN (DEPARTMENTS) ===================
let _deptsCache = null;

function getDepartments(forceReload = false) {
  if (forceReload || !_deptsCache) {
    _deptsCache = readJsonSafe(DEPTS_FILE, []);
  }
  return _deptsCache;
}

function saveDepartments(depts) {
  if (Array.isArray(depts)) {
    _deptsCache = depts;
  }
  return saveJsonSafe(DEPTS_FILE, _deptsCache);
}

function getDepartmentById(id) {
  return getDepartments().find(d => d.id === id);
}

function createDepartment(deptData) {
  const depts = getDepartments();
  const name = (deptData.name || '').trim();
  if (!name) throw new Error('Tên tổ chuyên môn không được để trống!');
  if (depts.some(d => d.name.toLowerCase() === name.toLowerCase())) {
    throw new Error(`Tổ chuyên môn "${name}" đã tồn tại!`);
  }
  const id = 'dept_' + (deptData.code ? deptData.code.toLowerCase().replace(/[^a-z0-9_]/g, '_') : crypto.randomBytes(3).toString('hex'));
  const newDept = {
    id,
    name,
    code: deptData.code ? deptData.code.trim().toUpperCase() : name.toUpperCase().slice(0, 8),
    description: deptData.description ? deptData.description.trim() : '',
    leaderId: deptData.leaderId || null,
    createdAt: new Date().toISOString()
  };
  depts.push(newDept);
  saveDepartments(depts);
  return newDept;
}

function updateDepartment(id, updates) {
  const depts = getDepartments();
  const index = depts.findIndex(d => d.id === id);
  if (index === -1) throw new Error('Không tìm thấy tổ chuyên môn!');
  if (updates.name) depts[index].name = updates.name.trim();
  if (updates.code) depts[index].code = updates.code.trim().toUpperCase();
  if (updates.description !== undefined) depts[index].description = updates.description.trim();
  if (updates.leaderId !== undefined) depts[index].leaderId = updates.leaderId;
  saveDepartments(depts);
  return depts[index];
}

function deleteDepartment(id) {
  if (id === 'dept_bgh') throw new Error('Không thể xóa Ban Giám hiệu!');
  let depts = getDepartments();
  depts = depts.filter(d => d.id !== id);
  saveDepartments(depts);
  return true;
}

// =================== QUẢN LÝ THÔNG BÁO WEB PUSH (PWA) ===================
let _subsCache = null;

function getSubscriptions(forceReload = false) {
  if (forceReload || !_subsCache) {
    _subsCache = readJsonSafe(SUBS_FILE, []);
  }
  return _subsCache;
}

function saveSubscriptions(subs) {
  if (Array.isArray(subs)) {
    _subsCache = subs;
  }
  return saveJsonSafe(SUBS_FILE, _subsCache);
}

function saveSubscription(userId, subscription) {
  if (!subscription || !subscription.endpoint) return;
  const subs = getSubscriptions();
  const existingIdx = subs.findIndex(s => s.endpoint === subscription.endpoint);
  if (existingIdx !== -1) {
    subs[existingIdx].userId = userId;
    subs[existingIdx].updatedAt = new Date().toISOString();
  } else {
    subs.push({
      userId,
      subscription,
      endpoint: subscription.endpoint,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }
  saveSubscriptions(subs);
}

function getSubscriptionsForUser(userId) {
  return getSubscriptions().filter(s => s.userId === userId).map(s => s.subscription);
}

// =================== QUẢN LÝ TÀI KHOẢN GIÁO VIÊN & BGH ===================
function createUser(userData) {
  const users = getUsers();
  const username = userData.username.trim().toLowerCase();
  
  if (users.some(u => u.username.toLowerCase() === username)) {
    throw new Error(`Tên đăng nhập "${username}" đã tồn tại trên hệ thống!`);
  }

  const roleTitleMap = {
    'ADMIN': 'Quản trị viên hệ thống',
    'BGH': 'Ban Giám hiệu nhà trường',
    'HEAD_DEPT': `Tổ trưởng ${userData.department || ''}`,
    'TEACHER': `Giáo viên ${userData.department || ''}`
  };

  const newUser = {
    id: userData.id || ('user_' + crypto.randomBytes(4).toString('hex')),
    username: username,
    password: userData.password || '123456',
    name: userData.name ? userData.name.trim() : username,
    role: userData.role || 'TEACHER', // ADMIN, BGH, HEAD_DEPT, TEACHER
    roleTitle: roleTitleMap[userData.role] || 'Giáo viên',
    department: userData.department || 'Tổ Toán - Tin',
    departmentId: userData.departmentId || null,
    signType: userData.signType || (userData.role === 'BGH' || userData.role === 'ADMIN' ? 'USB_TOKEN' : 'VGCA'), // VGCA, USB_TOKEN
    status: userData.status || 'ACTIVE', // ACTIVE, LOCKED
    email: userData.email ? userData.email.trim() : `${username}@thcschuvanan.edu.vn`,
    officialEmail: userData.officialEmail ? userData.officialEmail.trim() : (userData.email ? userData.email.trim() : ''),
    cccd: userData.cccd ? userData.cccd.trim() : '',
    certSerial: userData.certSerial ? userData.certSerial.trim() : '',
    school: 'TRƯỜNG TRUNG HỌC CƠ SỞ CHU VĂN AN',
    phone: userData.phone ? userData.phone.trim() : '',
    pinCode: userData.pinCode ? String(userData.pinCode).trim() : ((userData.phone && userData.phone.replace(/\D/g, '').length >= 4) ? userData.phone.replace(/\D/g, '').slice(-4) : '1234'),
    canUploadWord: userData.canUploadWord !== undefined ? Boolean(userData.canUploadWord) : true,
    canStampSeal: (userData.role === 'ADMIN') ? false : (userData.canStampSeal !== undefined ? Boolean(userData.canStampSeal) : false),
    signatureImage: null,
    createdAt: new Date().toISOString()
  };

  users.push(newUser);
  saveUsers(users);
  return newUser;
}

function updateUser(id, updates) {
  const users = getUsers();
  let index = users.findIndex(u => u.id === id);
  if (index === -1 && updates.username) {
    index = users.findIndex(u => (u.username || '').toLowerCase() === updates.username.toLowerCase().trim());
  }
  if (index === -1) {
    return createUser({ id, ...updates });
  }

  // Không cho đổi id hoặc hạ quyền/khóa admin gốc
  if (users[index].id === 'admin') {
    if (updates.role && updates.role !== 'ADMIN') {
      throw new Error('Không thể hạ quyền của tài khoản Quản trị viên gốc!');
    }
    if (updates.status && updates.status === 'LOCKED') {
      throw new Error('Không thể khóa tài khoản Quản trị viên gốc!');
    }
  }

  const roleTitleMap = {
    'ADMIN': 'Quản trị viên hệ thống',
    'BGH': 'Ban Giám hiệu nhà trường',
    'HEAD_DEPT': `Tổ trưởng ${updates.department || users[index].department || ''}`,
    'TEACHER': `Giáo viên ${updates.department || users[index].department || ''}`
  };

  if (updates.name) users[index].name = updates.name.trim();
  if (updates.role) {
    users[index].role = updates.role;
    users[index].roleTitle = roleTitleMap[updates.role];
  }
  if (updates.department) {
    users[index].department = updates.department;
    if (users[index].role === 'HEAD_DEPT' || users[index].role === 'TEACHER') {
      users[index].roleTitle = roleTitleMap[users[index].role];
    }
  }
  if (updates.departmentId !== undefined) users[index].departmentId = updates.departmentId;
  if (updates.signType !== undefined) users[index].signType = updates.signType;
  if (updates.status !== undefined) users[index].status = updates.status;
  if (updates.email) users[index].email = updates.email.trim();
  if (updates.officialEmail !== undefined) users[index].officialEmail = updates.officialEmail.trim();
  if (updates.cccd !== undefined) users[index].cccd = updates.cccd.trim();
  if (updates.canUploadWord !== undefined) users[index].canUploadWord = Boolean(updates.canUploadWord);
  if (updates.canStampSeal !== undefined) users[index].canStampSeal = Boolean(updates.canStampSeal);
  if (updates.certSerial !== undefined) users[index].certSerial = updates.certSerial.trim();
  if (updates.phone !== undefined) users[index].phone = updates.phone.trim();
  if (updates.pinCode !== undefined) users[index].pinCode = String(updates.pinCode).trim();
  if (updates.zaloPin !== undefined) users[index].pinCode = String(updates.zaloPin).trim();
  if (updates.signatureImage !== undefined) users[index].signatureImage = updates.signatureImage;
  if (updates.vgcaAuth !== undefined) users[index].vgcaAuth = updates.vgcaAuth;

  saveUsers(users);
  return users[index];
}

function toggleUserLock(id) {
  if (id === 'admin') throw new Error('Không thể khóa tài khoản Quản trị viên gốc!');
  const users = getUsers();
  const user = users.find(u => u.id === id);
  if (!user) throw new Error('Không tìm thấy người dùng!');
  user.status = (user.status === 'LOCKED') ? 'ACTIVE' : 'LOCKED';
  saveUsers(users);
  return user;
}

function resetPassword(id, newPassword) {
  const users = getUsers();
  const user = users.find(u => u.id === id);
  if (!user) throw new Error('Không tìm thấy người dùng!');
  user.password = newPassword || '123456';
  saveUsers(users);
  return true;
}

function deleteUser(id) {
  if (id === 'admin') throw new Error('Không thể xóa tài khoản Quản trị viên gốc!');
  let users = getUsers();
  users = users.filter(u => u.id !== id);
  saveUsers(users);
  return true;
}

function getSigners() {
  return getUsers()
    .filter(u => u.status !== 'LOCKED')
    .map(u => ({
      id: u.id,
      name: u.name,
      role: u.role,
      roleTitle: u.roleTitle,
      department: u.department,
      email: u.email
    }));
}

// =================== QUẢN LÝ HỒ SƠ GIÁO ÁN & TỐI ƯU HÓA LƯU TRỮ ===================

/**
 * Kiểm tra hồ sơ đã được lưu trữ / ẩn khỏi bảng chính hay chưa
 * Hồ sơ được coi là ĐÃ LƯU TRỮ (Archived) nếu:
 * 1. isArchived === true
 * 2. status === 'ARCHIVED'
 * 3. Đã lưu Google Drive (driveInfo != null)
 * 4. Đã lưu OneDrive (oneDriveSynced === true hoặc oneDriveUploaded === true)
 * 5. Đã có thời gian lưu trữ archivedAt
 */
function isDocArchived(d) {
  if (!d) return false;
  // Hồ sơ được coi là ĐÃ LƯU TRỮ và ẨN KHỎI BẢNG CHÍNH khi:
  // 1. Đã được lưu vào OneDrive (oneDriveSynced === true hoặc oneDriveUploaded === true hoặc oneDriveInfo)
  // 2. Đã được lưu vào Google Drive (driveInfo có fileId/folderPath hoặc googleDriveUrl)
  // 3. Đã có cờ lưu trữ hệ thống (isArchived === true hoặc status === 'ARCHIVED')
  return Boolean(
    d.isArchived === true ||
    d.status === 'ARCHIVED' ||
    d.oneDriveSynced === true ||
    d.oneDriveUploaded === true ||
    Boolean(d.oneDriveInfo) ||
    (d.driveInfo && (d.driveInfo.fileId || d.driveInfo.folderPath)) ||
    d.googleDriveUrl != null
  );
}

let _hasRunSanitization = false;

/**
 * Cơ chế Đồng bộ & Dọn dẹp Dữ liệu:
 * - CHỈ lưu trữ và ẩn các file khi đã thực sự lưu thành công vào OneDrive / Drive
 * - Phục hồi các file chưa lưu OneDrive để hiển thị trên bảng làm việc chính
 * - Dọn sạch các trường nhị phân nặng (fileBase64, signedPdfBase64) khỏi DB để máy chủ siêu nhẹ
 */
function sanitizeDocuments(docs) {
  if (!Array.isArray(docs)) return [];
  let changed = false;
  docs.forEach(doc => {
    if (!doc) return;

    const hasCloudSaved = Boolean(
      doc.oneDriveSynced === true ||
      doc.oneDriveUploaded === true ||
      (doc.driveInfo && (doc.driveInfo.fileId || doc.driveInfo.folderPath)) ||
      doc.googleDriveUrl != null
    );

    // 1. Nếu ĐÃ lưu OneDrive/Drive thành công -> đánh dấu isArchived = true
    if (hasCloudSaved) {
      if (!doc.isArchived || doc.status !== 'ARCHIVED') {
        doc.isArchived = true;
        doc.status = 'ARCHIVED';
        if (!doc.archivedAt) doc.archivedAt = doc.createdAt || new Date().toISOString().replace('T', ' ').substring(0, 19);
        changed = true;
      }
    } else {
      // 2. Nếu CHƯA lưu OneDrive/Drive -> TUYỆT ĐỐI KHÔNG ẨN, giữ nguyên trên bảng chính!
      if (doc.isArchived === true || doc.status === 'ARCHIVED') {
        doc.isArchived = false;
        doc.status = 'COMPLETED';
        delete doc.archivedAt;
        changed = true;
      }
    }

    // 2. Chuẩn hóa category nếu thiếu
    if (!doc.category) {
      doc.category = (doc.title && (doc.title.includes('Báo cáo') || doc.title.includes('Kế hoạch giáo dục'))) ? 'REPORT' : 'PERSONAL';
      changed = true;
    }

    // 3. Giải phóng bộ nhớ máy chủ triệt để: Xóa bỏ chuỗi nhị phân base64 nặng khỏi JSON/RAM
    if (doc.fileBase64) {
      delete doc.fileBase64;
      changed = true;
    }
    if (doc.signedPdfBase64) {
      delete doc.signedPdfBase64;
      changed = true;
    }
  });

  if (changed) {
    saveDocuments(docs);
  }
  return docs;
}

let _docsCache = null;

function getDocuments(forceReload = false) {
  const hasPending = _hasPendingWrites(DOCS_FILE);
  if ((forceReload && !hasPending) || !_docsCache) {
    const docs = readJsonSafe(DOCS_FILE, []);
    _docsCache = docs;
    if (!_hasRunSanitization) {
      _hasRunSanitization = true;
      _docsCache = sanitizeDocuments(_docsCache);
    }
  }
  return _docsCache;
}

function saveDocuments(docs) {
  if (Array.isArray(docs)) {
    _docsCache = docs;
  }
  return saveJsonSafe(DOCS_FILE, _docsCache);
}

/**
 * Đảm bảo tất cả các cập nhật hồ sơ đang trong hàng đợi được ghi hoàn tất vào đĩa
 */
async function flushDocuments() {
  if (_docsCache) {
    saveDocuments(_docsCache);
  }
  await waitForPendingWrites(DOCS_FILE);
  return true;
}

function getDocumentById(id) {
  return getDocuments().find(d => d.id === id);
}

function normalizeFilePath(p) {
  if (!p || typeof p !== 'string') return null;
  const match = p.match(/[\\\/](uploads[\\\/].+)$/i);
  if (match) {
    return match[1].replace(/\\/g, '/');
  }
  if (p.startsWith('uploads/') || p.startsWith('uploads\\')) {
    return p.replace(/\\/g, '/');
  }
  return p;
}

function resolveFilePath(filePath) {
  if (!filePath || typeof filePath !== 'string') return null;
  // 1. Nếu đường dẫn trực tiếp tồn tại trên hệ thống hiện tại
  if (fs.existsSync(filePath)) return path.resolve(filePath);
  // 2. Nếu là đường dẫn tương đối hoặc chứa 'uploads/'
  const match = filePath.match(/[\\\/]?(uploads[\\\/].+)$/i);
  if (match) {
    const rel = match[1].replace(/\\/g, '/');
    const local = path.join(__dirname, rel);
    if (fs.existsSync(local)) return local;
  }
  // 3. Tìm theo tên tệp trong thư mục uploads/documents
  const basename = path.basename(filePath);
  const inUploads = path.join(__dirname, 'uploads', 'documents', basename);
  if (fs.existsSync(inUploads)) return inUploads;
  return null;
}

function generateTrackingId(deptName, docType = 'REPORT') {
  const clean = (deptName || 'CVA').replace(/Tổ\s*/gi, '').trim();
  const map = {
    'Toán - Tin': 'TOAN-TIN',
    'Toán': 'TOAN',
    'Tin': 'TIN',
    'Khoa học Tự nhiên': 'KHTN',
    'Khoa học Xã hội': 'KHXH',
    'Ngữ văn': 'VAN',
    'Tiếng Anh': 'ANH',
    'Nghệ thuật': 'NT',
    'GDTC': 'GDTC'
  };
  const deptCode = map[clean] || clean.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 8) || 'CVA';
  const prefix = (docType === 'REPORT' || docType === 'BC') ? 'BC' : 'KHBD';
  const year = new Date().getFullYear();
  const rand = Math.floor(100000 + Math.random() * 900000);
  return `${prefix}-${year}-${deptCode}-${rand}`;
}

function createDocument(docData, currentUser = {}) {
  const docs = getDocuments();
  const deptName = currentUser.department || currentUser.departmentName || docData.creatorDept || docData.department || 'Tổ Toán - Tin';
  const newId = docData.id || generateTrackingId(deptName, docData.category === 'REPORT' ? 'REPORT' : 'KHBD');

  const authorName = currentUser.name || currentUser.fullName || docData.creatorName || docData.author || 'Giáo viên';
  const authorId = currentUser.id || docData.creatorId || docData.authorId || 'teacher';
  const authorUsername = currentUser.username || docData.creatorUsername || docData.authorUsername || authorId;

  const category = docData.category || 'PERSONAL';
  const isPersonal = (category === 'PERSONAL');
  const defaultStatus = docData.status || (isPersonal ? 'COMPLETED' : (docData.nextSignerId ? 'WAITING_SIGNER_APPROVAL' : 'WAITING_LEADER_APPROVAL'));
  const currentSignerRole = isPersonal ? null : (docData.nextSignerRole || 'Tổ trưởng Chuyên môn');

  const newDoc = {
    id: newId,
    title: docData.title,
    category: category,
    author: authorName,
    authorId: authorId,
    authorUsername: authorUsername,
    creatorId: docData.creatorId || authorId,
    creatorName: docData.creatorName || authorName,
    creatorDept: docData.creatorDept || deptName,
    assignedTo: docData.assignedTo || null,
    assignedToName: docData.assignedToName || null,
    currentSignerId: docData.currentSignerId || null,
    currentSignerName: docData.currentSignerName || null,
    department: deptName,
    grade: docData.grade || 'Khối 9',
    week: docData.week || 'Tuần 1',
    term: docData.term || 'Học kỳ I',
    createdAt: docData.createdAt || new Date().toISOString().replace('T', ' ').substring(0, 19),
    updatedAt: docData.updatedAt || new Date().toISOString(),
    status: defaultStatus,
    currentSignerRole: currentSignerRole,
    nextSignerId: docData.nextSignerId || null,
    nextSignerName: docData.nextSignerName || null,
    nextSignerRole: docData.nextSignerRole || null,
    isArchived: docData.isArchived || false,
    fileName: docData.fileName || 'GiaoAn_Chuan.pdf',
    fileType: docData.fileType || 'pdf', // 'pdf', 'docx', 'doc'
    filePath: normalizeFilePath(docData.filePath) || (() => {
      if (docData.fileBase64) {
        try {
          const uploadDir = path.join(__dirname, 'uploads', 'documents');
          if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
          const cleanBase64 = docData.fileBase64.replace(/^data:[^;]+;base64,/, '');
          const rawBuffer = Buffer.from(cleanBase64, 'base64');
          const safeId = newId.replace(/[^a-zA-Z0-9_\-]/g, '_');
          const fname = `doc_${safeId}.pdf`;
          fs.writeFileSync(path.join(uploadDir, fname), rawBuffer);
          return `uploads/documents/${fname}`;
        } catch (e) { return null; }
      }
      return null;
    })(),
    fileBase64: null,
    customContentHtml: docData.customContentHtml || null,
    realSignedPath: normalizeFilePath(docData.realSignedPath),
    signedPdfBase64: null,
    signPlacement: docData.signPlacement || 'bottom-right',
    fileSize: docData.fileSize || '1.5 MB',
    pages: docData.pages || 10,
    signType: docData.signType || 'STANDARD',
    isCopySign: docData.isCopySign || (docData.signType === 'COPY'),
    copyType: docData.copyType || null,
    copyText: docData.copyText || null,
    copySignBannerBase64: docData.copySignBannerBase64 || null,
    copySignBannerWidthPt: docData.copySignBannerWidthPt || null,
    copySignBannerHeightPt: docData.copySignBannerHeightPt || null,
    signatures: docData.signatures || [],
    driveInfo: docData.driveInfo || null,
    googleDriveUrl: docData.googleDriveUrl || null,
    googleDriveFolder: docData.googleDriveFolder || null,
    googleDriveFileName: docData.googleDriveFileName || null,
    logs: [
      {
        time: new Date().toISOString().replace('T', ' ').substring(0, 19),
        actor: currentUser.name,
        action: `Khởi tạo và nộp hồ sơ "${docData.title}" (${category === 'PERSONAL' ? 'Giáo án cá nhân' : 'Báo cáo liên cấp'})`
      }
    ]
  };

  docs.unshift(newDoc);
  saveDocuments(docs);
  syncDocToFirebase(newDoc);
  return newDoc;
}

const FIREBASE_RTDB_URL = 'https://edusign-school-default-rtdb.asia-southeast1.firebasedatabase.app';

function syncDocToFirebase(doc) {
  if (!doc || !doc.id) return;
  try {
    const cleanDoc = { ...doc };
    delete cleanDoc.fileBase64;
    delete cleanDoc.signedPdfBase64;
    fetch(`${FIREBASE_RTDB_URL}/documents/${doc.id}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cleanDoc)
    }).catch(() => {});
  } catch (e) {}
}

function syncSignatureToFirebase(userId, signatureImage) {
  if (!userId || !signatureImage) return;
  try {
    fetch(`${FIREBASE_RTDB_URL}/signatures/${userId}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        signatureImage,
        updatedAt: new Date().toISOString()
      })
    }).catch(() => {});
  } catch (e) {}
}

function updateDocument(id, updates) {
  const docs = getDocuments();
  const index = docs.findIndex(d => d.id === id);
  if (index === -1) throw new Error('Không tìm thấy hồ sơ!');

  const cleanUpdates = { ...updates };
  if (cleanUpdates.fileBase64 && (!cleanUpdates.filePath || !docs[index].filePath)) {
    try {
      const uploadDir = path.join(__dirname, 'uploads', 'documents');
      if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
      const cleanBase64 = cleanUpdates.fileBase64.replace(/^data:[^;]+;base64,/, '');
      const rawBuffer = Buffer.from(cleanBase64, 'base64');
      const safeId = id.replace(/[^a-zA-Z0-9_\-]/g, '_');
      const fname = `doc_${safeId}_updated.pdf`;
      fs.writeFileSync(path.join(uploadDir, fname), rawBuffer);
      cleanUpdates.filePath = `uploads/documents/${fname}`;
    } catch (e) {}
  }

  delete cleanUpdates.fileBase64;
  delete cleanUpdates.signedPdfBase64;
  if (cleanUpdates.filePath) cleanUpdates.filePath = normalizeFilePath(cleanUpdates.filePath);
  if (cleanUpdates.realSignedPath) cleanUpdates.realSignedPath = normalizeFilePath(cleanUpdates.realSignedPath);

  Object.assign(docs[index], cleanUpdates);
  saveDocuments(docs);
  syncDocToFirebase(docs[index]);
  return docs[index];
}

function archiveDocument(id, driveInfo = null) {
  const docs = getDocuments();
  const index = docs.findIndex(d => d.id === id);
  if (index === -1) throw new Error('Không tìm thấy hồ sơ để lưu trữ!');

  const doc = docs[index];
  doc.isArchived = true;
  doc.status = 'ARCHIVED';
  doc.archivedAt = new Date().toISOString();
  if (driveInfo) doc.driveInfo = driveInfo;

  saveDocuments(docs);
  syncDocToFirebase(doc);
  return doc;
}

function deleteDocument(id) {
  let docs = getDocuments();
  docs = docs.filter(d => d.id !== id);
  saveDocuments(docs);
  try {
    fetch(`${FIREBASE_RTDB_URL}/documents/${id}.json`, { method: 'DELETE' }).catch(() => {});
  } catch (e) {}
  return true;
}

const BGH_CONFIG_FILE = path.join(DATA_DIR, 'bgh_signing_config.json');
let _bghConfigCache = null;

function getBghSigningConfig(forceReload = false) {
  if (!forceReload && _bghConfigCache) {
    return _bghConfigCache;
  }
  try {
    if (fs.existsSync(BGH_CONFIG_FILE)) {
      _bghConfigCache = JSON.parse(fs.readFileSync(BGH_CONFIG_FILE, 'utf8'));
      return _bghConfigCache;
    }
  } catch (err) {}
  _bghConfigCache = {
    signType: 'USB_TOKEN', // 'USB_TOKEN' hoặc 'SMART_CA'
    serialNumber: '025E056A3F133DA9', // USB Token Ban Giám hiệu (Cô Ngô Thị Liền)
    certOwner: 'Ngô Thị Liền',
    cccd: '042084002100',
    school: 'TRƯỜNG TRUNG HỌC CƠ SỞ CHU VĂN AN',
    updatedAt: new Date().toISOString()
  };
  return _bghConfigCache;
}

function saveBghSigningConfig(config) {
  const current = getBghSigningConfig();
  const updated = {
    ...current,
    ...config,
    updatedAt: new Date().toISOString()
  };
  _bghConfigCache = updated;
  saveJsonSafe(BGH_CONFIG_FILE, updated);
  return updated;
}

module.exports = {
  DEPARTMENTS,
  getUsers,
  saveUsers,
  getUserById,
  getUserByUsername,
  createUser,
  updateUser,
  toggleUserLock,
  getSigners,
  resetPassword,
  deleteUser,
  getDepartments,
  saveDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  getSubscriptions,
  saveSubscriptions,
  saveSubscription,
  getSubscriptionsForUser,
  getDocuments,
  saveDocuments,
  flushDocuments,
  waitForPendingWrites,
  saveJsonSafe,
  saveJsonSafeSync,
  getDocumentById,
  createDocument,
  addDocument: createDocument,
  updateDocument,
  deleteDocument,
  archiveDocument,
  normalizeFilePath,
  resolveFilePath,
  getBghSigningConfig,
  saveBghSigningConfig,
  isDocArchived,
  sanitizeDocuments,
  syncSignatureToFirebase
};
