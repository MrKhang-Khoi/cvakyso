const googleDriveService = require('./googleDriveService');
const dataStore = require('./dataStore');

/**
 * Service gửi thông báo Zalo 1-1 thông qua Google Apps Script Webhook
 * Chuẩn Kịch bản A: Mapping Số Điện Thoại -> Zalo Chat ID (0 đồng, không lo khóa nick)
 */

function getWebhookUrl() {
  const cfg = googleDriveService.getDriveConfig();
  return cfg && cfg.gasWebhookUrl ? cfg.gasWebhookUrl : '';
}

/**
 * Gửi yêu cầu HTTP POST tới Google Apps Script Webhook
 */
async function sendWebhookPost(payloadObj) {
  const url = getWebhookUrl();
  if (!url || !url.startsWith('http')) {
    console.log('[ZaloNotify] Chưa cấu hình gasWebhookUrl trong drive_config.json, bỏ qua gửi Zalo.');
    return { success: false, reason: 'NO_WEBHOOK_URL' };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payloadObj),
      redirect: 'follow', // Chấp nhận redirect 302 từ Google Apps Script
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      return { success: res.ok, raw: text };
    }
  } catch (err) {
    console.warn('[ZaloNotify] Lỗi gửi thông báo sang Google Apps Script:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Tìm số điện thoại của người dùng theo ID hoặc Username
 */
function findUserPhone(userIdOrUsername) {
  if (!userIdOrUsername) return '';
  const users = dataStore.getUsers();
  const u = users.find(x => x.id === userIdOrUsername || x.username === userIdOrUsername);
  return u && u.phone ? u.phone : '';
}

/**
 * 1. Bắn tin Zalo khi hồ sơ BỊ TRẢ VỀ (REJECTED)
 */
async function notifyDocumentRejected(doc, approverUser, reason) {
  if (!doc) return;
  const authorPhone = findUserPhone(doc.creatorId || doc.creatorUsername || doc.authorId || doc.authorUsername);
  const approverName = (approverUser && (approverUser.fullName || approverUser.name)) || doc.returnedByName || 'Ban Giám hiệu';

  console.log(`[ZaloNotify] Đang gửi thông báo TRẢ VỀ tới SĐT tác giả: ${authorPhone || 'Chưa có SĐT'}`);

  return await sendWebhookPost({
    action: 'NOTIFY_SIGN_EVENT',
    eventType: 'REJECTED',
    docId: doc.id,
    docTitle: doc.title,
    authorPhone: authorPhone,
    approverName: approverName,
    reason: reason || doc.returnReason || 'Cần chỉnh sửa nội dung',
    senderName: approverName
  });
}

/**
 * 2. Bắn tin Zalo khi có HỒ SƠ MỚI CẦN KÝ DUYỆT (SUBMITTED / FORWARDED)
 */
async function notifyDocumentSubmitted(doc, senderUser, targetUserId) {
  if (!doc || !targetUserId) return;
  const recipientPhone = findUserPhone(targetUserId);
  const senderName = (senderUser && (senderUser.fullName || senderUser.name)) || doc.creatorName || doc.author || 'Giáo viên';

  console.log(`[ZaloNotify] Đang gửi thông báo TRÌNH KÝ tới SĐT người duyệt: ${recipientPhone || 'Chưa có SĐT'}`);

  return await sendWebhookPost({
    action: 'NOTIFY_SIGN_EVENT',
    eventType: 'SUBMITTED',
    docId: doc.id,
    docTitle: doc.title,
    recipientPhone: recipientPhone,
    senderName: senderName
  });
}

/**
 * 3. Bắn tin Zalo khi BÁO CÁO ĐÃ ĐƯỢC DUYỆT & ĐÓNG DẤU HOÀN THÀNH (COMPLETED)
 */
async function notifyDocumentCompleted(doc, approverUser, viewUrl = '') {
  if (!doc) return;
  const authorPhone = findUserPhone(doc.creatorId || doc.creatorUsername || doc.authorId || doc.authorUsername);
  const approverName = (approverUser && (approverUser.fullName || approverUser.name)) || 'Ban Giám hiệu';

  console.log(`[ZaloNotify] Đang gửi thông báo HOÀN TẤT KÝ DUYỆT tới SĐT tác giả: ${authorPhone || 'Chưa có SĐT'}`);

  return await sendWebhookPost({
    action: 'NOTIFY_SIGN_EVENT',
    eventType: 'COMPLETED',
    docId: doc.id,
    docTitle: doc.title,
    authorPhone: authorPhone,
    approverName: approverName,
    viewUrl: viewUrl
  });
}

module.exports = {
  sendWebhookPost,
  findUserPhone,
  notifyDocumentRejected,
  notifyDocumentSubmitted,
  notifyDocumentCompleted
};
