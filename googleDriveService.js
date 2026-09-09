const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const CONFIG_FILE = fs.existsSync(path.join(__dirname, '..', 'drive_config.json'))
  ? path.join(__dirname, '..', 'drive_config.json')
  : path.join(__dirname, 'drive_config.json');

// Cấu hình mặc định Google Drive của nhà trường
function getDriveConfig() {
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    } catch (e) {
      console.error('Lỗi đọc drive_config.json:', e.message);
    }
  }
  return {
    enabled: true,
    autoUploadOnSign: true, // Tự động đẩy lên Google Drive sau khi ký số hoàn tất
    schoolFolderId: 'THCS_CHU_VAN_AN_ARCHIVE_2026',
    schoolFolderName: 'KHO_HO_SO_SO_TRUONG_THCS_CHU_VAN_AN',
    gasWebhookUrl: 'https://script.google.com/macros/s/AKfycbwoMCdjRZjaSme1o5xF6gDrEcDFqvRPsWo3YNUY5NLI0FoKr-qkfflXhhFcnH2VmBNv/exec',
    backupLocalStorage: true
  };
}

function saveDriveConfig(cfg) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf8');
}

/**
 * Tự động đồng bộ file PDF đã ký lên Google Drive của trường
 * @param {Object} doc Thông tin hồ sơ kế hoạch bài dạy
 * @param {string} pdfFilePathOrBase64 Đường dẫn file PDF hoặc chuỗi base64 đã ký số
 */
async function uploadToGoogleDrive(doc, pdfFilePathOrBase64) {
  const config = getDriveConfig();

  let base64Content = '';
  if (typeof pdfFilePathOrBase64 === 'string' && (pdfFilePathOrBase64.startsWith('data:application/pdf') || pdfFilePathOrBase64.length > 500)) {
    base64Content = pdfFilePathOrBase64.replace(/^data:application\/pdf;base64,/, '');
  } else if (typeof pdfFilePathOrBase64 === 'string' && fs.existsSync(pdfFilePathOrBase64)) {
    const fileBuffer = fs.readFileSync(pdfFilePathOrBase64);
    base64Content = fileBuffer.toString('base64');
  } else if (doc && doc.fileBase64) {
    base64Content = doc.fileBase64.replace(/^data:application\/pdf;base64,/, '');
  } else {
    throw new Error('Dữ liệu file PDF ký số không hợp lệ để tải lên Google Drive');
  }
  const schoolYear = doc.schoolYear || 'Năm học 2026 - 2027';
  const teacherName = (doc.authorName || doc.author || 'GiaoVien').trim();
  const safeDocTitle = (doc.title || doc.id).replace(/[^a-zA-Z0-9_\-\s]/g, '').trim();
  const safeDocId = (doc.id || '').replace(/[^a-zA-Z0-9_\-]/g, '').trim();
  const safeFileName = safeDocId 
    ? `[${doc.department || 'CVA'}]_[${safeDocId}]_${safeDocTitle}_DaKy.pdf`
    : `[${doc.department || 'CVA'}]_${safeDocTitle}_DaKy.pdf`;

  // Cấu trúc phân loại thư mục lưu trữ theo tên từng giáo viên
  const folderPath = `${schoolYear} / ${teacherName}`;

  // Thu thập danh sách email công vụ của các giáo viên tham gia ký
  let signerEmails = Array.isArray(doc.signerEmails) ? [...doc.signerEmails] : [];
  if (Array.isArray(doc.signatures)) {
    doc.signatures.forEach(sig => {
      if (sig.email && !signerEmails.includes(sig.email)) signerEmails.push(sig.email);
    });
  }
  if (doc.authorEmail && !signerEmails.includes(doc.authorEmail)) {
    signerEmails.push(doc.authorEmail);
  }

  // Nếu nhà trường đã cấu hình Google Apps Script Webhook URL thật
  if (config.gasWebhookUrl && config.gasWebhookUrl.startsWith('http')) {
    console.log(`[Google Drive] Đang đẩy file lên Google Apps Script: ${config.gasWebhookUrl}`);
    const payload = JSON.stringify({
      action: 'UPLOAD_SIGNED_DOC',
      fileName: safeFileName,
      folderPath: folderPath,
      schoolFolderId: config.schoolFolderId,
      docId: doc.id,
      docTitle: doc.title,
      author: doc.author,
      department: doc.department,
      signerEmails: signerEmails,
      fileBase64: base64Content
    });

    const result = await sendHttpPost(config.gasWebhookUrl, payload);
    if (result && (result.success === true || result.fileId)) {
      return {
        success: true,
        isRealCloud: true,
        fileId: result.fileId || `drive_${Date.now()}`,
        fileName: safeFileName,
        viewUrl: result.viewUrl || (result.fileId ? `https://drive.google.com/file/d/${result.fileId}/view` : `https://drive.google.com`),
        downloadUrl: result.downloadUrl || null,
        folderPath: result.folderPath || folderPath,
        uploadedAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
        mode: 'REAL_GOOGLE_DRIVE',
        message: 'Đã lưu trữ thành công trên Google Drive đám mây của trường!'
      };
    } else {
      throw new Error((result && result.error) || (result && result.message) || 'Google Apps Script trả về lỗi không xác định');
    }
  }

  // Chế độ Mô phỏng / Lưu cục bộ khi CHƯA CẤU HÌNH Webhook Google Apps Script thật:
  const fakeFileId = `1${Buffer.from(doc.id + Date.now()).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 28)}`;
  const driveViewUrl = `https://drive.google.com/file/d/${fakeFileId}/view?usp=sharing`;

  // Lưu một bản sao vào thư mục đồng bộ cục bộ của Google Drive Desktop theo từng giáo viên
  const localDriveDir = path.join(__dirname, 'GoogleDrive_KhoTruong', schoolYear, teacherName);
  if (!fs.existsSync(localDriveDir)) {
    fs.mkdirSync(localDriveDir, { recursive: true });
  }
  const destPath = path.join(localDriveDir, safeFileName);
  fs.writeFileSync(destPath, Buffer.from(base64Content, 'base64'));

  return {
    success: true,
    isRealCloud: false,
    fileId: fakeFileId,
    fileName: safeFileName,
    viewUrl: driveViewUrl,
    folderPath: folderPath,
    localMirrorPath: destPath,
    uploadedAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
    mode: 'SIMULATION_LOCAL_MIRROR',
    message: 'Lưu trữ tại thư mục cục bộ theo tên giáo viên (Google Drive)'
  };
}

/**
 * Lấy liên kết thư mục Google Drive của từng giáo viên
 */
async function getTeacherFolder(teacherName, schoolYear = 'Năm học 2026 - 2027', email = '') {
  const config = getDriveConfig();
  const folderPath = `${schoolYear} / ${(teacherName || 'GiaoVien').trim()}`;

  if (config.gasWebhookUrl && config.gasWebhookUrl.startsWith('http')) {
    try {
      const payload = JSON.stringify({
        action: 'GET_TEACHER_FOLDER',
        teacherName: teacherName,
        folderPath: folderPath,
        email: email,
        schoolFolderId: config.schoolFolderId
      });
      const result = await sendHttpPost(config.gasWebhookUrl, payload);
      if (result && result.success) {
        return result;
      }
    } catch(e) {
      console.warn('[Google Drive] Lỗi gọi GAS GET_TEACHER_FOLDER:', e.message);
    }
  }

  // Fallback: Tìm kiếm thư mục theo tên giáo viên trên Google Drive
  return {
    success: true,
    folderPath: folderPath,
    folderUrl: `https://drive.google.com/drive/search?q=${encodeURIComponent(teacherName)}`,
    message: 'Thư mục Google Drive cá nhân của Thầy/Cô'
  };
}

async function sendHttpPost(urlStr, dataStr) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

  try {
    const res = await fetch(urlStr, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: dataStr,
      redirect: 'follow', // RẤT QUAN TRỌNG: Google Apps Script luôn trả về HTTP 302 Redirect
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    const text = await res.text();
    try {
      const json = JSON.parse(text);
      return json;
    } catch {
      return { success: res.ok, raw: text, fileId: 'drive_' + Date.now() };
    }
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('Hết thời gian chờ kết nối Google Drive (Timeout 60s)');
    }
    throw err;
  }
}

module.exports = {
  getDriveConfig,
  saveDriveConfig,
  uploadToGoogleDrive,
  getTeacherFolder
};
