/**
 * ====================================================================================================
 *   🤖 GOOGLE APPS SCRIPT: HỆ THỐNG ZALO BOT EDUSIGN & LƯU TRỮ GOOGLE DRIVE/SHEETS TỰ ĐỘNG
 *   Trường THCS Chu Văn An - Xã Đăk Hà - Tỉnh Quảng Ngãi
 * ====================================================================================================
 * Nền tảng: Google Apps Script + Zalo Bot Platform + Google Drive + Google Sheets
 * 
 * HƯỚNG DẪN TRIỂN KHAI TRÊN SCRIPT.GOOGLE.COM (CHỈ MẤT 3 PHÚT):
 * 1. Truy cập https://script.google.com -> Tạo "Dự án mới" (New project) -> Đặt tên: "EduSign Zalo Bot".
 * 2. Xóa sạch mã cũ, dán toàn bộ nội dung tệp này vào Code.gs.
 * 3. Điền cấu hình ở MỤC 1 bên dưới (ZALO_BOT_TOKEN, SPREADSHEET_ID, DRIVE_FOLDER_ID).
 * 4. Bấm "Lưu" (Ctrl + S) -> Bấm chọn hàm "initSheetsIfMissing" -> Bấm "Chạy" (Run) để tự tạo cấu trúc bảng tính.
 * 5. Bấm chọn hàm "setZaloBotWebhook" -> Bấm "Chạy" (Run) để liên kết Webhook với Zalo Bot.
 * 6. Bấm "Triển khai" (Deploy) -> "Bản triển khai mới" (New deployment):
 *    - Loại: "Ứng dụng web" (Web App)
 *    - Thực thi dưới dạng: "Tôi" (Me)
 *    - Ai có quyền truy cập: "Bất kỳ ai" (Anyone)
 *    - Bấm "Triển khai" và COPY đường link Web App URL để điền vào phần mềm EduSign!
 */

// ====================================================================================================
// 🌟 1. CẤU HÌNH HỆ THỐNG (VUI LÒNG ĐIỀN ĐẦY ĐỦ THÔNG TIN TRƯỚC KHI CHẠY)
// ====================================================================================================
var CONFIG = {
  // Token Zalo Bot (Lấy từ Zalo Platform Developer hoặc bot token đã tạo)
  ZALO_BOT_TOKEN: "2294655560219778902:jzfmNEYGuXlSvmyKEYeCrbSWIKGrmumxQhoSsFXkgNBXsnOaWWDwTjSYqjoAdaqp",
  
  // ID file Google Sheets dùng làm cơ sở dữ liệu (để trống nếu muốn script tự động tạo mới)
  SPREADSHEET_ID: "", 
  
  // Tên trường và Cổng tra cứu báo cáo
  SCHOOL_NAME: "TRƯỜNG THCS CHU VĂN AN",
  PORTAL_URL: "https://mrkhang-khoi.github.io/cvakyso/portal-baocao.html",
  
  // Tên các bảng tính trong Google Sheets
  SHEET_USERS: "Danh bạ GV",
  SHEET_REPORTS: "Sổ Lưu Báo Cáo",
  
  // Tên thư mục gốc lưu Báo cáo trên Google Drive
  DRIVE_ROOT_FOLDER: "KHO_BAO_CAO_THCS_CHU_VAN_AN"
};

// ====================================================================================================
// 🔧 2. KHỞI TẠO TỰ ĐỘNG BẢNG TÍNH & THƯ MỤC NẾU CHƯA CÓ
// ====================================================================================================
function initSheetsIfMissing() {
  var ss;
  if (CONFIG.SPREADSHEET_ID && CONFIG.SPREADSHEET_ID.trim() !== "") {
    try {
      ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID.trim());
    } catch (e) {
      Logger.log("⚠️ Không mở được Sheet với ID đã cấu hình. Đang tạo Sheet mới...");
    }
  }

  if (!ss) {
    ss = SpreadsheetApp.create("EduSign_DuLieu_KYS_THCS_ChuVanAn");
    Logger.log("✅ ĐÃ TẠO GOOGLE SHEET MỚI THÀNH CÔNG! ID: " + ss.getId());
    Logger.log("👉 Hãy copy ID này dán vào mục CONFIG.SPREADSHEET_ID: " + ss.getId());
  }

  // 1. Khởi tạo Sheet "Danh bạ GV" (Dùng map SĐT -> Zalo Chat ID)
  var sheetUsers = ss.getSheetByName(CONFIG.SHEET_USERS);
  if (!sheetUsers) {
    sheetUsers = ss.insertSheet(CONFIG.SHEET_USERS);
    sheetUsers.getRange(1, 1, 1, 7).setValues([[
      "STT", "Họ và Tên", "Số Điện Thoại", "Tổ Chuyên Môn", "Email Công Vụ", "Zalo_Chat_ID", "Ngày Liên Kết"
    ]]);
    sheetUsers.getRange(1, 1, 1, 7).setBackground("#1e40af").setFontColor("#ffffff").setFontWeight("bold");
    sheetUsers.setFrozenRows(1);

    // Thêm dữ liệu mẫu danh bạ
    sheetUsers.appendRow([1, "Ban Giám hiệu", "02553850001", "Ban Giám hiệu", "bgh-dakha@quangngai.gov.vn", "", ""]);
    sheetUsers.appendRow([2, "Ngô Thị Liền", "0905123456", "Ban Giám hiệu", "cva.lien@quangngai.gov.vn", "", ""]);
    sheetUsers.appendRow([3, "Hà Văn Tý", "0912345678", "Tổ Toán - Tin", "cva.ty@thcschuvanan.edu.vn", "", ""]);
    sheetUsers.appendRow([4, "Trần Văn Nam", "0987654321", "Tổ Toán - Tin", "tvnam@thcschuvanan.edu.vn", "", ""]);
  }

  // 2. Khởi tạo Sheet "Sổ Lưu Báo Cáo" (Dùng làm cơ sở dữ liệu tra cứu)
  var sheetReports = ss.getSheetByName(CONFIG.SHEET_REPORTS);
  if (!sheetReports) {
    sheetReports = ss.insertSheet(CONFIG.SHEET_REPORTS);
    sheetReports.getRange(1, 1, 1, 11).setValues([[
      "Mã Hồ Sơ", "Tiêu Đề Báo Cáo", "Tác Giả", "Số Điện Thoại", "Tổ Chuyên Môn",
      "Người Ký BGH", "Ngày Ký Duyệt", "Trạng Thái", "Link Xem Drive", "Link Tải", "Ghi Chú"
    ]]);
    sheetReports.getRange(1, 1, 1, 11).setBackground("#047857").setFontColor("#ffffff").setFontWeight("bold");
    sheetReports.setFrozenRows(1);
  }

  Logger.log("🎉 Khởi tạo bảng dữ liệu hoàn tất!");
  return ss.getId();
}

function getDatabaseSpreadsheet() {
  if (CONFIG.SPREADSHEET_ID && CONFIG.SPREADSHEET_ID.trim() !== "") {
    try {
      return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID.trim());
    } catch (e) {
      Logger.log("Lỗi mở spreadsheet ID: " + e.message);
    }
  }
  // Tìm kiếm spreadsheet theo tên mặc định trong Drive
  var files = DriveApp.getFilesByName("EduSign_DuLieu_KYS_THCS_ChuVanAn");
  if (files.hasNext()) {
    return SpreadsheetApp.open(files.next());
  }
  // Nếu chưa có thì khởi tạo
  var newId = initSheetsIfMissing();
  return SpreadsheetApp.openById(newId);
}

// ====================================================================================================
// 🚀 3. ĐĂNG KÝ WEBHOOK CHO ZALO BOT (Chạy 1 lần trong Apps Script)
// ====================================================================================================
function setZaloBotWebhook() {
  if (!CONFIG.ZALO_BOT_TOKEN) {
    Logger.log("❌ Vui lòng điền CONFIG.ZALO_BOT_TOKEN!");
    return;
  }
  var webAppUrl = ScriptApp.getService().getUrl();
  if (!webAppUrl) {
    Logger.log("❌ Vui lòng Triển khai (Deploy) dự án thành Web App trước khi set webhook!");
    return;
  }
  var apiUrl = "https://bot-api.zaloplatforms.com/bot" + CONFIG.ZALO_BOT_TOKEN + "/setWebhook";
  var payload = {
    url: webAppUrl,
    secret_token: "EduSignZaloCVA2026Secret"
  };
  var options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  try {
    var response = UrlFetchApp.fetch(apiUrl, options);
    Logger.log("✅ Kết quả đăng ký Webhook: " + response.getContentText());
  } catch (err) {
    Logger.log("❌ Lỗi khi đăng ký Webhook: " + err.toString());
  }
}

// ====================================================================================================
// 🌐 4. XỬ LÝ GET (Cung cấp API cho Cổng tra cứu báo cáo độc lập & PING)
// ====================================================================================================
function doGet(e) {
  var params = (e && e.parameter) ? e.parameter : {};
  var action = params.action || "PING";

  // A. API phục vụ Cổng Tra Cứu Báo Cáo Độc Lập
  if (action === "GET_REPORTS" || action === "PORTAL_REPORTS") {
    try {
      var reports = fetchReportsFromSheet(params);
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        school: CONFIG.SCHOOL_NAME,
        total: reports.total,
        page: reports.page,
        limit: reports.limit,
        data: reports.data
      })).setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: err.toString()
      })).setMimeType(ContentService.MimeType.JSON);
    }
  }

  // B. Health Check & Hướng dẫn
  return ContentService.createTextOutput(JSON.stringify({
    status: "active",
    system: "EduSign Zalo Bot & Archive Gateway",
    school: CONFIG.SCHOOL_NAME,
    timestamp: new Date().toISOString(),
    guide: "Webhook sẵn sàng nhận sự kiện ký số và tin nhắn Zalo Bot."
  })).setMimeType(ContentService.MimeType.JSON);
}

// ====================================================================================================
// 📩 5. XỬ LÝ POST (Nhận Webhook từ Zalo Bot VÀ từ EduSign Server)
// ====================================================================================================
function doPost(e) {
  try {
    var postData = {};
    if (e && e.postData && e.postData.contents) {
      try {
        postData = JSON.parse(e.postData.contents);
      } catch (err) {
        postData = e.parameter || {};
      }
    } else if (e && e.parameter) {
      postData = e.parameter;
    }

    var action = postData.action || "";

    // ----------------------------------------------------------------------------------
    // NHÁNH 1: NHẬN LỆNH TỪ HỆ THỐNG KÝ SỐ EDUSIGN (EduSign Server Webhook)
    // ----------------------------------------------------------------------------------

    // 1.1 Thông báo sự kiện Ký số (Trình ký, Trả về, Ký duyệt hoàn thành)
    if (action === "NOTIFY_SIGN_EVENT") {
      var eventResult = handleEduSignNotification(postData);
      return ContentService.createTextOutput(JSON.stringify(eventResult)).setMimeType(ContentService.MimeType.JSON);
    }

    // 1.2 Lưu trữ Báo cáo vào Google Drive & Google Sheets
    if (action === "UPLOAD_SIGNED_DOC" || action === "ARCHIVE_REPORT") {
      var archiveResult = handleReportArchive(postData);
      return ContentService.createTextOutput(JSON.stringify(archiveResult)).setMimeType(ContentService.MimeType.JSON);
    }

    // ----------------------------------------------------------------------------------
    // NHÁNH 2: NHẬN TIN NHẮN TỪ ZALO BOT (Giáo viên chat với Bot)
    // ----------------------------------------------------------------------------------
    var userMessage = "";
    var chatId = "";
    var eventName = postData.event_name || "";

    if (postData.message) {
      userMessage = postData.message.text || "";
      if (!userMessage && postData.message.attachments && postData.message.attachments.length > 0) {
        for (var a = 0; a < postData.message.attachments.length; a++) {
          var item = postData.message.attachments[a];
          if (item && item.payload && item.payload.phone_number) {
            userMessage = item.payload.phone_number;
            break;
          }
        }
      }
      if (!userMessage && postData.message.contact && postData.message.contact.phone_number) {
        userMessage = postData.message.contact.phone_number;
      }
      if (postData.message.chat) {
        chatId = postData.message.chat.id;
      } else if (postData.message.from) {
        chatId = postData.message.from.id;
      }
    } else if (postData.text) {
      userMessage = postData.text;
      chatId = postData.chat_id || postData.sender_id || postData.user_id;
    } else if (eventName === "user_send_text") {
      userMessage = postData.message ? (typeof postData.message === 'string' ? postData.message : (postData.message.text || "")) : "";
      chatId = postData.sender ? (typeof postData.sender === 'object' ? postData.sender.id : postData.sender) : "";
    }

    if (!chatId && postData.chat_id) chatId = postData.chat_id;
    if (!chatId && postData.sender) chatId = (typeof postData.sender === 'object' ? postData.sender.id : postData.sender);
    if (!chatId && postData.user_id) chatId = postData.user_id;
    if (!chatId && postData.from) chatId = (typeof postData.from === 'object' ? postData.from.id : postData.from);

    // A. Khi giáo viên vừa mở Bot hoặc bấm Quan tâm / Bắt đầu (Start)
    if (eventName === "follow" || eventName === "user_open_bot" || eventName === "join" || userMessage === "/start") {
      var welcomeMsg = "╔════════════════════════════════════════╗\n" +
                       "  🏫 CHÀO MỪNG ĐẾN VỚI TRỢ LÝ KÝ SỐ EDUSIGN\n" +
                       "  TRƯỜNG THCS CHU VĂN AN\n" +
                       "╚════════════════════════════════════════╝\n\n" +
                       "✨ Bot tự động thông báo kết quả duyệt/trả về hồ sơ chuyên môn.\n\n" +
                       "📱 ĐỂ KÍCH HOẠT NHẬN THÔNG BÁO:\n" +
                       "Thầy/Cô vui lòng nhập SỐ ĐIỆN THOẠI của mình (Ví dụ: 0912345678) và gửi vào đây.\n\n" +
                       "💡 Cú pháp tra cứu nhanh:\n" +
                       "👉 Gõ: hoso (Xem tình trạng hồ sơ)\n" +
                       "👉 Gõ: baocao (Xem link kho báo cáo)\n" +
                       "👉 Gõ: help (Xem trợ giúp)";
      if (chatId) sendZaloBotReply(chatId, welcomeMsg);
      return ContentService.createTextOutput(JSON.stringify({ status: "welcome_sent" })).setMimeType(ContentService.MimeType.JSON);
    }

    // B. Xử lý nội dung tin nhắn của Giáo viên
    if (userMessage && chatId) {
      var replyText = processTeacherZaloMessage(chatId, userMessage);
      if (replyText) {
        sendZaloBotReply(chatId, replyText);
        return ContentService.createTextOutput(JSON.stringify({ status: "success", reply: replyText })).setMimeType(ContentService.MimeType.JSON);
      }
    }

    return ContentService.createTextOutput(JSON.stringify({ status: "ignored" })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", error: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ====================================================================================================
// 🤖 6. BỘ XỬ LÝ TIN NHẮN GIÁO VIÊN (Mapping SĐT & Tra cứu 1-chạm)
// ====================================================================================================
function processTeacherZaloMessage(chatId, rawText) {
  var text = (rawText || "").trim();
  var clean = removeVietnameseTones(text).toLowerCase();

  // 1. Kiểm tra nếu tin nhắn là SỐ ĐIỆN THOẠI (để liên kết tài khoản)
  var phoneMatch = text.replace(/[^0-9]/g, "");
  if (phoneMatch.length >= 9 && phoneMatch.length <= 12) {
    return handlePhoneMapping(chatId, phoneMatch);
  }

  // 2. Tra cứu danh sách hồ sơ báo cáo của giáo viên
  if (clean === "hoso" || clean === "ho so" || clean === "trangthai" || clean === "trang thai" || clean === "kiemtra") {
    return handleLookupTeacherReports(chatId);
  }

  // 3. Lấy link Cổng tra cứu báo cáo của trường
  if (clean === "baocao" || clean === "bao cao" || clean === "kho" || clean === "drive") {
    return "🌐 CỔNG TRA CỨU BÁO CÁO ĐIỆN TỬ - THCS CHU VĂN AN:\n" +
           "Thầy/Cô bấm vào liên kết bên dưới để xem toàn bộ báo cáo chuyên môn đã được ký duyệt & đóng dấu:\n👉 " + CONFIG.PORTAL_URL;
  }

  // 4. Trợ giúp / Menu
  if (clean === "help" || clean === "menu" || clean === "tro giup" || clean === "huong dan") {
    return "📌 HƯỚNG DẪN SỬ DỤNG TRỢ LÝ KÝ SỐ THCS CHU VĂN AN:\n\n" +
           "1️⃣ Nhập [Số điện thoại]: Để liên kết nhận thông báo duyệt/trả hồ sơ.\n" +
           "2️⃣ Gõ 'hoso': Để xem trạng thái các hồ sơ báo cáo của Thầy/Cô.\n" +
           "3️⃣ Gõ 'baocao': Để lấy đường link cổng tra cứu báo cáo trực tuyến.\n" +
           "4️⃣ Gõ 'huylienket': Để hủy kết nối với số điện thoại cũ.";
  }

  // Mặc định nhắc giáo viên nhập SĐT nếu chưa rõ cú pháp
  return "🤖 Trợ lý Ký số THCS Chu Văn An chưa nhận diện được yêu cầu: \"" + text + "\"\n\n" +
         "👉 Nếu Thầy/Cô muốn liên kết tài khoản: Vui lòng gửi [Số Điện Thoại].\n" +
         "👉 Nếu muốn kiểm tra trạng thái hồ sơ: Vui lòng gõ 'hoso'.";
}

// ====================================================================================================
// 🔗 7. HÀM MAPPING SỐ ĐIỆN THOẠI -> ZALO CHAT ID
// ====================================================================================================
function handlePhoneMapping(chatId, phoneInput) {
  var ss = getDatabaseSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_USERS);
  if (!sheet) {
    return "⚠️ Hệ thống chưa tìm thấy bảng 'Danh bạ GV'. Vui lòng báo Quản trị viên!";
  }

  var data = sheet.getDataRange().getValues();
  var normPhone = normalizePhone(phoneInput);
  var matchedRow = -1;
  var teacherName = "";
  var department = "";

  for (var i = 1; i < data.length; i++) {
    var rowPhone = normalizePhone(String(data[i][2]));
    if (rowPhone === normPhone) {
      matchedRow = i + 1;
      teacherName = data[i][1];
      department = data[i][3];
      break;
    }
  }

  if (matchedRow !== -1) {
    // Ghi Zalo Chat ID và ngày liên kết vào bảng
    sheet.getRange(matchedRow, 6).setValue(String(chatId));
    sheet.getRange(matchedRow, 7).setValue(new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }));

    return "🎉 LIÊN KẾT ZALO THÀNH CÔNG!\n\n" +
           "👤 Họ và Tên: " + teacherName + "\n" +
           "🏫 Đơn vị: " + department + "\n" +
           "📱 Số điện thoại: " + phoneInput + "\n\n" +
           "✅ Từ bây giờ, mọi thông báo khi có hồ sơ trình ký mới, hồ sơ được BGH ký duyệt hoặc hồ sơ bị trả về sẽ được gửi trực tiếp tới Zalo của Thầy/Cô!";
  } else {
    return "⚠️ Số điện thoại [" + phoneInput + "] không có trong danh bạ cán bộ - giáo viên nhà trường.\n" +
           "Vui lòng kiểm tra lại hoặc liên hệ Văn thư nhà trường để được cập nhật số điện thoại chính xác!";
  }
}

// ====================================================================================================
// 📊 8. TRA CỨU TRẠNG THÁI HỒ SƠ 1-CHẠM QUA ZALO
// ====================================================================================================
function handleLookupTeacherReports(chatId) {
  var ss = getDatabaseSpreadsheet();
  var sheetUsers = ss.getSheetByName(CONFIG.SHEET_USERS);
  var sheetReports = ss.getSheetByName(CONFIG.SHEET_REPORTS);

  if (!sheetUsers || !sheetReports) return "⚠️ Dữ liệu chưa sẵn sàng.";

  // Tìm giáo viên theo chatId
  var usersData = sheetUsers.getDataRange().getValues();
  var teacherName = "";
  var teacherPhone = "";
  for (var i = 1; i < usersData.length; i++) {
    if (String(usersData[i][5]) === String(chatId)) {
      teacherName = usersData[i][1];
      teacherPhone = normalizePhone(String(usersData[i][2]));
      break;
    }
  }

  if (!teacherName) {
    return "⚠️ Thầy/Cô chưa liên kết tài khoản Zalo!\n👉 Vui lòng gửi [Số Điện Thoại] để hệ thống kích hoạt trước khi tra cứu.";
  }

  // Tìm các báo cáo của giáo viên này trong sheetReports
  var reportsData = sheetReports.getDataRange().getValues();
  var myReports = [];

  for (var j = reportsData.length - 1; j >= 1; j--) {
    var row = reportsData[j];
    var author = String(row[2] || "");
    var phone = normalizePhone(String(row[3] || ""));

    if ((teacherPhone && phone === teacherPhone) || (teacherName && author.toLowerCase().indexOf(teacherName.toLowerCase()) !== -1)) {
      myReports.push({
        id: row[0],
        title: row[1],
        approver: row[5],
        date: row[6],
        status: row[7],
        viewUrl: row[8]
      });
      if (myReports.length >= 5) break; // Lấy tối đa 5 báo cáo gần nhất
    }
  }

  if (myReports.length === 0) {
    return "📋 Kính chào Thầy/Cô " + teacherName + "!\n" +
           "Hiện tại chưa có báo cáo chuyên môn nào của Thầy/Cô được lưu trữ trên hệ thống.\n\n" +
           "🌐 Xem cổng báo cáo chung: " + CONFIG.PORTAL_URL;
  }

  var msg = "📋 CÁC BÁO CÁO GẦN NHẤT CỦA THẦY/CÔ (" + teacherName + "):\n";
  msg += "════════════════════════════════════════\n\n";

  for (var k = 0; k < myReports.length; k++) {
    var r = myReports[k];
    var statusIcon = (r.status === "ĐÃ KÝ DUYỆT & ĐÓNG DẤU" || r.status === "COMPLETED") ? "✅" : (r.status === "BỊ TRẢ VỀ" ? "⚠️" : "⏳");
    msg += (k + 1) + ". " + statusIcon + " " + r.title + "\n";
    msg += "   • Trạng thái: " + r.status + "\n";
    msg += "   • Ngày: " + (r.date || "N/A") + "\n";
    if (r.viewUrl) msg += "   • Link xem: " + r.viewUrl + "\n";
    msg += "\n";
  }

  msg += "🌐 Tra cứu chi tiết tại: " + CONFIG.PORTAL_URL;
  return msg;
}

// ====================================================================================================
// 🔔 9. XỬ LÝ SỰ KIỆN TỪ PHẦN MỀM KÝ SỐ EDUSIGN (Bắn tin 1-1 cho Giáo viên)
// ====================================================================================================
function handleEduSignNotification(data) {
  var eventType = data.eventType; // "SUBMITTED", "REJECTED", "COMPLETED"
  var docTitle = data.docTitle || "Báo cáo chuyên môn";
  var docId = data.docId || "";
  var authorPhone = normalizePhone(data.authorPhone || "");
  var recipientPhone = normalizePhone(data.recipientPhone || "");
  var senderName = data.senderName || "Giáo viên";
  var approverName = data.approverName || "Ban Giám hiệu";
  var reason = data.reason || "";
  var viewUrl = data.viewUrl || CONFIG.PORTAL_URL;

  var messageText = "";
  var targetPhone = "";

  // 1. Trường hợp: BÁO CÁO BỊ TRẢ VỀ -> Bắn tin cho người tạo
  if (eventType === "REJECTED") {
    targetPhone = authorPhone;
    messageText = "╔════════════════════════════════════════╗\n" +
                  "  ⚠️ THÔNG BÁO: HỒ SƠ BỊ TRẢ VỀ\n" +
                  "╚════════════════════════════════════════╝\n\n" +
                  "📋 Hồ sơ: " + docTitle + "\n" +
                  "🆔 Mã hồ sơ: " + docId + "\n" +
                  "👤 Người trả về: " + approverName + "\n" +
                  "❌ Lý do trả về: \"" + reason + "\"\n" +
                  "⏰ Thời gian: " + new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) + "\n\n" +
                  "📌 Thầy/Cô vui lòng truy cập Tab [Hồ sơ bị trả về] trên phần mềm EduSign để chỉnh sửa và nộp lại.";
  }

  // 2. Trường hợp: BÁO CÁO ĐÃ ĐƯỢC DUYỆT & ĐÓNG DẤU HOÀN THÀNH -> Bắn tin cho người tạo
  else if (eventType === "COMPLETED") {
    targetPhone = authorPhone;
    messageText = "╔════════════════════════════════════════╗\n" +
                  "  🎉 THÔNG BÁO: HỒ SƠ ĐÃ ĐƯỢC PHÊ DUYỆT\n" +
                  "╚════════════════════════════════════════╝\n\n" +
                  "📋 Báo cáo: " + docTitle + "\n" +
                  "🆔 Mã hồ sơ: " + docId + "\n" +
                  "✍️ Người ký duyệt: " + approverName + "\n" +
                  "🔴 Con dấu: Đã đóng mộc số của trường THCS Chu Văn An.\n" +
                  "📂 Nơi lưu: Đã lưu trữ an toàn trên Google Drive nhà trường.\n\n" +
                  "🌐 Thầy/Cô có thể tra cứu và tải báo cáo tại:\n👉 " + viewUrl;
  }

  // 3. Trường hợp: GIÁO VIÊN TỰ KÝ GIÁO ÁN / HỒ SƠ CÁ NHÂN HOÀN TẤT
  else if (eventType === "PERSONAL_SIGNED" || eventType === "CREATED") {
    targetPhone = authorPhone;
    messageText = "╔════════════════════════════════════════╗\n" +
                  "  🎉 KÝ SỐ HỒ SƠ / GIÁO ÁN THÀNH CÔNG\n" +
                  "╚════════════════════════════════════════╝\n\n" +
                  "📄 Kế hoạch/Giáo án: " + docTitle + "\n" +
                  (docId ? ("🆔 Mã hồ sơ: " + docId + "\n") : "") +
                  "👤 Giáo viên: " + senderName + "\n" +
                  "⏰ Thời gian: " + new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) + "\n\n" +
                  "✅ Thầy/Cô đã ký số điện tử thành công vào tệp tài liệu này!";
  }

  // 4. Trường hợp: CÓ HỒ SƠ MỚI CẦN DUYỆT KÝ (Trình ký)
  else if (eventType === "SUBMITTED" || eventType === "FORWARDED") {
    targetPhone = recipientPhone;
    messageText = "╔════════════════════════════════════════╗\n" +
                  "  📋 THÔNG BÁO CÓ HỒ SƠ CẦN KÝ DUYỆT\n" +
                  "╚════════════════════════════════════════╝\n\n" +
                  "📄 Hồ sơ: " + docTitle + "\n" +
                  (docId ? ("🆔 Mã hồ sơ: " + docId + "\n") : "") +
                  "👤 Người trình ký: " + senderName + "\n" +
                  "⏰ Thời gian: " + new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) + "\n\n" +
                  "👉 Kính mời Thầy/Cô truy cập hệ thống EduSign để kiểm tra và ký duyệt.";

    // ĐỒNG THỜI: Bắn tin xác nhận tức thì cho Người tạo (Tác giả) để biết hồ sơ đã được nộp thành công!
    if (authorPhone) {
      var authorChatId = getChatIdByPhone(authorPhone);
      if (authorChatId) {
        var authorConfirmMsg = "╔════════════════════════════════════════╗\n" +
                               "  🎉 XÁC NHẬN: TẠO HỒ SƠ THÀNH CÔNG\n" +
                               "╚════════════════════════════════════════╝\n\n" +
                               "📄 Hồ sơ: " + docTitle + "\n" +
                               (docId ? ("🆔 Mã hồ sơ: " + docId + "\n") : "") +
                               (data.recipientName ? ("👤 Chuyển tiếp tới: " + data.recipientName + "\n") : "") +
                               "⏰ Thời gian: " + new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) + "\n\n" +
                               "✅ Hồ sơ đã được khởi tạo và chuyển tiếp thành công trên hệ thống Ký số THCS Chu Văn An!";
        sendZaloBotReply(authorChatId, authorConfirmMsg);
      }
    }
  }

  var anySent = false;
  if (targetPhone) {
    // Tra cứu Zalo Chat ID từ số điện thoại
    var targetChatId = getChatIdByPhone(targetPhone);
    if (targetChatId && messageText) {
      sendZaloBotReply(targetChatId, messageText);
      anySent = true;
    }
  }

  return { success: true, messageSent: anySent, targetPhone: targetPhone, authorPhone: authorPhone };
}

// ====================================================================================================
// 📁 10. LƯU TRỮ BÁO CÁO VÀO GOOGLE DRIVE & GHI GOOGLE SHEETS
// ====================================================================================================
function handleReportArchive(data) {
  var fileName = data.fileName || ("BaoCao_DaKy_" + new Date().getTime() + ".pdf");
  var docTitle = data.docTitle || fileName;
  var docId = data.docId || ("BC-" + new Date().getTime());
  var author = data.author || "Giáo viên";
  var authorPhone = normalizePhone(data.authorPhone || "");
  var department = data.department || "Toán - Tin";
  var approver = data.approver || "Ban Giám hiệu";
  var notes = data.notes || "";

  if (!data.fileBase64) {
    throw new Error("Thiếu nội dung file base64 của báo cáo!");
  }

  var fileBytes = Utilities.base64Decode(data.fileBase64);
  if (fileBytes.length < 500) {
    throw new Error("Tệp quá nhỏ, không phải file PDF ký số hợp lệ!");
  }
  var blob = Utilities.newBlob(fileBytes, "application/pdf", fileName);

  // 1. Phân cấp thư mục trên Google Drive: [KHO_BAO_CAO] / [Năm học] / [Tổ chuyên môn]
  var folderPath = CONFIG.DRIVE_ROOT_FOLDER + " / Năm học 2026 - 2027 / " + department;
  var targetFolder = getOrCreateFolderHierarchy(folderPath);

  // Xóa tệp cũ trùng mã hồ sơ (nếu nộp lại)
  try {
    var filesIt = targetFolder.getFiles();
    while (filesIt.hasNext()) {
      var exFile = filesIt.next();
      var exDesc = exFile.getDescription() || "";
      if (exDesc.indexOf(docId) !== -1 || exFile.getName() === fileName) {
        exFile.setTrashed(true);
      }
    }
  } catch (e) {}

  // Lưu file PDF vào Google Drive
  var file = targetFolder.createFile(blob);
  file.setDescription(
    "Báo cáo chuyên môn đã được ký số và đóng mộc trường THCS Chu Văn An.\n" +
    "• Mã: " + docId + "\n" +
    "• Tiêu đề: " + docTitle + "\n" +
    "• Tác giả: " + author + " (" + authorPhone + ")\n" +
    "• Tổ: " + department + "\n" +
    "• BGH duyệt: " + approver + "\n" +
    "• Ngày lưu: " + new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })
  );

  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (e) {}

  var viewUrl = file.getUrl();
  var downloadUrl = file.getDownloadUrl();
  var signDateStr = new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });

  // 2. Ghi một dòng vào Sheet "Sổ Lưu Báo Cáo"
  var ss = getDatabaseSpreadsheet();
  var sheetReports = ss.getSheetByName(CONFIG.SHEET_REPORTS);
  if (sheetReports) {
    sheetReports.appendRow([
      docId,
      docTitle,
      author,
      authorPhone,
      department,
      approver,
      signDateStr,
      "ĐÃ KÝ DUYỆT & ĐÓNG DẤU",
      viewUrl,
      downloadUrl,
      notes
    ]);
  }

  // 3. Tự động bắn tin Zalo 1-1 thông báo cho tác giả
  if (authorPhone) {
    handleEduSignNotification({
      eventType: "COMPLETED",
      docId: docId,
      docTitle: docTitle,
      authorPhone: authorPhone,
      approverName: approver,
      viewUrl: viewUrl
    });
  }

  return {
    success: true,
    fileId: file.getId(),
    fileName: fileName,
    viewUrl: viewUrl,
    downloadUrl: downloadUrl,
    folderPath: folderPath,
    message: "Đã lưu Báo cáo lên Google Drive & cập nhật Sổ lưu trữ thành công!"
  };
}

// ====================================================================================================
// 🔍 11. HÀM TRUY VẤN BÁO CÁO PHỤC VỤ CỔNG TRA CỨU ĐỘC LẬP (PORTAL)
// ====================================================================================================
function fetchReportsFromSheet(params) {
  var ss = getDatabaseSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_REPORTS);
  if (!sheet) return { total: 0, page: 1, limit: 10, data: [] };

  var raw = sheet.getDataRange().getValues();
  var search = (params.search || "").toLowerCase().trim();
  var dept = (params.dept || "").toLowerCase().trim();
  var status = (params.status || "").toLowerCase().trim();
  var page = parseInt(params.page || 1, 10);
  var limit = parseInt(params.limit || 20, 10);

  var list = [];
  for (var i = raw.length - 1; i >= 1; i--) {
    var r = raw[i];
    var docId = String(r[0] || "");
    var title = String(r[1] || "");
    var author = String(r[2] || "");
    var phone = String(r[3] || "");
    var rowDept = String(r[4] || "");
    var approver = String(r[5] || "");
    var signDate = String(r[6] || "");
    var rowStatus = String(r[7] || "");
    var viewUrl = String(r[8] || "");
    var downloadUrl = String(r[9] || "");
    var notes = String(r[10] || "");

    // Bộ lọc
    if (dept && rowDept.toLowerCase().indexOf(dept) === -1) continue;
    if (status && rowStatus.toLowerCase().indexOf(status) === -1) continue;
    if (search) {
      var textAll = (docId + " " + title + " " + author + " " + phone + " " + rowDept + " " + approver).toLowerCase();
      if (textAll.indexOf(search) === -1) continue;
    }

    list.push({
      id: docId,
      title: title,
      author: author,
      phone: phone,
      department: rowDept,
      approver: approver,
      signDate: signDate,
      status: rowStatus,
      viewUrl: viewUrl,
      downloadUrl: downloadUrl,
      notes: notes
    });
  }

  var total = list.length;
  var startIndex = (page - 1) * limit;
  var paginated = list.slice(startIndex, startIndex + limit);

  return {
    total: total,
    page: page,
    limit: limit,
    data: paginated
  };
}

// ====================================================================================================
// 🛠️ 12. CÁC HÀM TIỆN ÍCH TRỢ GIÚP (HELPER FUNCTIONS)
// ====================================================================================================
function sendZaloBotReply(chatId, text) {
  if (!CONFIG.ZALO_BOT_TOKEN || !chatId) return;
  var apiUrl = "https://bot-api.zaloplatforms.com/bot" + CONFIG.ZALO_BOT_TOKEN + "/sendMessage";
  var payload = {
    chat_id: String(chatId),
    text: text
  };
  try {
    UrlFetchApp.fetch(apiUrl, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
  } catch (e) {
    Logger.log("Lỗi gửi tin Zalo Bot: " + e.toString());
  }
}

function getChatIdByPhone(phoneNumber) {
  var ss = getDatabaseSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_USERS);
  if (!sheet) return null;

  var data = sheet.getDataRange().getValues();
  var targetNorm = normalizePhone(phoneNumber);

  for (var i = 1; i < data.length; i++) {
    var rowPhone = normalizePhone(String(data[i][2]));
    if (rowPhone === targetNorm) {
      var chatId = String(data[i][5] || "").trim();
      return chatId ? chatId : null;
    }
  }
  return null;
}

function normalizePhone(p) {
  if (!p) return "";
  var clean = String(p).replace(/[^0-9]/g, "");
  if (clean.startsWith("84") && clean.length >= 10) {
    clean = "0" + clean.slice(2);
  }
  // Tự động bù số 0 ở đầu nếu Google Sheets cắt mất số 0 (ví dụ 905123456 -> 0905123456)
  if (clean.length === 9 && !clean.startsWith("0")) {
    clean = "0" + clean;
  }
  // Số máy bàn có mã vùng bị cắt số 0 (ví dụ 2553850001 -> 02553850001)
  if (clean.length === 10 && !clean.startsWith("0") && clean.startsWith("2")) {
    clean = "0" + clean;
  }
  return clean;
}

function removeVietnameseTones(str) {
  if (!str) return "";
  str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
  str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
  str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
  str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
  str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
  str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
  str = str.replace(/đ/g, "d");
  str = str.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, "A");
  str = str.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, "E");
  str = str.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, "I");
  str = str.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, "O");
  str = str.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, "U");
  str = str.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, "Y");
  str = str.replace(/Đ/g, "D");
  return str;
}

function getOrCreateFolderHierarchy(pathStr) {
  var parts = pathStr.split("/").map(function(s) { return s.trim(); }).filter(Boolean);
  var currentFolder = DriveApp.getRootFolder();

  for (var i = 0; i < parts.length; i++) {
    var name = parts[i];
    var folders = currentFolder.getFoldersByName(name);
    if (folders.hasNext()) {
      currentFolder = folders.next();
    } else {
      currentFolder = currentFolder.createFolder(name);
    }
  }
  return currentFolder;
}
