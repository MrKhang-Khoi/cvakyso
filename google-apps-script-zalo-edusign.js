/**
 * ====================================================================================================
 *   🤖 GOOGLE APPS SCRIPT: HỆ THỐNG ZALO BOT HỢP NHẤT TRỢ LÝ TRƯỜNG HỌC 4.0
 *   THỜI KHÓA BIỂU (KÈM KHUNG GIỜ VÀO/RA LỚP) + KÝ SỐ GIÁO ÁN EDUSIGN
 *   Trường THCS Chu Văn An - Xã Đăk Hà - Tỉnh Quảng Ngãi
 * ====================================================================================================
 * Nền tảng: Google Apps Script + Zalo Bot Platform + Google Drive + Google Sheets + Firebase RTDB
 * 
 * CÁC TÍNH NĂNG CHÍNH:
 * 1. 🔔 Thông báo Ký số EduSign 1-1 (Trình ký, Trả về kèm lý do, Ký duyệt hoàn tất đóng dấu).
 * 2. 📱 Liên kết Zalo 0 đồng: Giáo viên chỉ cần gửi Số Điện Thoại -> Tự động ánh xạ Zalo_Chat_ID.
 * 3. ⏰ Khung giờ ra vào lớp chuẩn xác:
 *    - Sáng:  Tiết 1 (07h00-07h45), T2 (07h50-08h35), T3 (08h40-09h25), T4 (09h30-10h15), T5 (10h20-11h05)
 *    - Chiều: Tiết 1 (13h00-13h45), T2 (13h50-14h35), T3 (14h40-15h25), T4 (15h30-16h15), T5 (16h20-17h05)
 * 4. 🌅 TỰ ĐỘNG NHẮN TIN LÚC 6H00 SÁNG: Nhắc lịch giảng dạy chi tiết trong ngày cho từng giáo viên theo SĐT.
 * 5. 📅 Tra cứu TKB thông minh: Lớp học, Giáo viên, Dạy thay, Tìm giáo viên trống tiết, Cổng Web 1-chạm.
 * 6. 📁 Tự động lưu trữ hồ sơ báo cáo giáo án vào Google Drive & Google Sheets.
 * 
 * HƯỚNG DẪN TRIỂN KHAI TRÊN SCRIPT.GOOGLE.COM (CHỈ MẤT 3 PHÚT):
 * 1. Mở dự án trên https://script.google.com -> Dán toàn bộ mã này vào Code.gs.
 * 2. Điền cấu hình ở MỤC 1 bên dưới (CONFIG).
 * 3. Chọn hàm "initSheetsIfMissing" -> Bấm "Chạy" (Run) để tự tạo cấu trúc bảng tính.
 * 4. Chọn hàm "setupDailyMorningTrigger" -> Bấm "Chạy" (Run) để kích hoạt lịch tự động 6h00 sáng.
 * 5. Chọn hàm "setZaloBotWebhook" -> Bấm "Chạy" (Run) để liên kết Webhook với Zalo Bot.
 * 6. Bấm "Triển khai" (Deploy) -> "Bản triển khai mới" (Web App, Thực thi dưới dạng Tôi, Bất kỳ ai truy cập) -> Copy URL.
 */

// ====================================================================================================
// 🌟 1. CẤU HÌNH HỆ THỐNG TOÀN DIỆN
// ====================================================================================================
var CONFIG = {
  // Token Zalo Bot Platform (Cấp từ Zalo Platform Developer)
  ZALO_BOT_TOKEN: "2294655560219778902:jzfmNEYGuXlSvmyKEYeCrbSWIKGrmumxQhoSsFXkgNBXsnOaWWDwTjSYqjoAdaqp",
  
  // ID file Google Sheets làm cơ sở dữ liệu (để trống nếu muốn script tự động tạo mới)
  SPREADSHEET_ID: "", 
  
  // Tên trường & Cổng thông tin trực tuyến
  SCHOOL_NAME: "TRƯỜNG THCS CHU VĂN AN",
  PORTAL_URL: "https://mrkhang-khoi.github.io/cvakyso/portal-baocao.html",
  PUBLIC_TKB_PORTAL: "https://mrkhang-khoi.github.io/tkb/",
  
  // Tên các bảng tính trong Google Sheets
  SHEET_USERS: "Danh bạ GV",
  SHEET_REPORTS: "Sổ Lưu Báo Cáo",
  
  // Tên thư mục lưu trữ Báo cáo trên Google Drive
  DRIVE_ROOT_FOLDER: "KHO_BAO_CAO_THCS_CHU_VAN_AN",

  // Kết nối Cơ sở dữ liệu Thời khóa biểu (Firebase Realtime Database)
  FIREBASE_DATABASE_URL: "https://tkb-fet-default-rtdb.asia-southeast1.firebasedatabase.app/school_data.json",

  // ID nhóm Zalo trường nếu muốn gửi bản tin TKB tổng hợp vào nhóm lúc 6h30 sáng (tùy chọn)
  MORNING_BRIEF_CHAT_ID: "",

  // KHUNG GIỜ RA VÀO LỚP CHUẨN XÁC CỦA NHÀ TRƯỜNG (CẤU HÌNH LINH HOẠT)
  PERIOD_TIMES: {
    "sáng": {
      1: "07h00 - 07h45",
      2: "07h50 - 08h35",
      3: "08h40 - 09h25",
      4: "09h30 - 10h15",
      5: "10h20 - 11h05"
    },
    "chiều": {
      1: "13h00 - 13h45",
      2: "13h50 - 14h35",
      3: "14h40 - 15h25",
      4: "15h30 - 16h15",
      5: "16h20 - 17h05"
    }
  }
};

// ====================================================================================================
// 🔧 2. KHỞI TẠO TỰ ĐỘNG BẢNG TÍNH & CƠ SỞ DỮ LIỆU
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

  // 1. Khởi tạo Sheet "Danh bạ GV" (Dùng map SĐT -> Zalo Chat ID & TKB ShortName)
  var sheetUsers = ss.getSheetByName(CONFIG.SHEET_USERS);
  if (!sheetUsers) {
    sheetUsers = ss.insertSheet(CONFIG.SHEET_USERS);
    sheetUsers.getRange(1, 1, 1, 8).setValues([[
      "STT", "Họ và Tên", "Số Điện Thoại", "Tổ Chuyên Môn", "Email Công Vụ", "Zalo_Chat_ID", "Ngày Liên Kết", "Tên_Viết_Tắt_TKB"
    ]]);
    sheetUsers.getRange(1, 1, 1, 8).setBackground("#1e40af").setFontColor("#ffffff").setFontWeight("bold");
    sheetUsers.setFrozenRows(1);

    // Thêm dữ liệu mẫu danh bạ
    sheetUsers.appendRow([1, "Ban Giám hiệu", "02553850001", "Ban Giám hiệu", "bgh-dakha@quangngai.gov.vn", "", "", "BGH"]);
    sheetUsers.appendRow([2, "Ngô Thị Liền", "0905123456", "Ban Giám hiệu", "cva.lien@quangngai.gov.vn", "", "", "Liền"]);
    sheetUsers.appendRow([3, "Hà Văn Tý", "0912345678", "Tổ Toán - Tin", "cva.ty@thcschuvanan.edu.vn", "", "", "Tý"]);
    sheetUsers.appendRow([4, "Trần Văn Nam", "0987654321", "Tổ Toán - Tin", "tvnam@thcschuvanan.edu.vn", "", "", "Nam"]);
  }

  // 2. Khởi tạo Sheet "Sổ Lưu Báo Cáo"
  var sheetReports = ss.getSheetByName(CONFIG.SHEET_REPORTS);
  if (!sheetReports) {
    sheetReports = ss.insertSheet(CONFIG.SHEET_REPORTS);
    sheetReports.getRange(1, 1, 1, 11).setValues([[
      "Mã Hồ Sơ", "Tiêu Đề Báo Cáo", "Tác GiẢ", "Số Điện Thoại", "Tổ Chuyên Môn",
      "Người Ký BGH", "Ngày Ký Duyệt", "Trạng Thái", "Link Xem Drive", "Link Tải", "Ghi Chú"
    ]]);
    sheetReports.getRange(1, 1, 1, 11).setBackground("#047857").setFontColor("#ffffff").setFontWeight("bold");
    sheetReports.setFrozenRows(1);
  }

  Logger.log("🎉 Khởi tạo bảng dữ liệu hoàn tất!");
  return ss.getId();
}

function getDatabaseSpreadsheet() {
  if (typeof SpreadsheetApp === "undefined") return null;
  if (CONFIG.SPREADSHEET_ID && CONFIG.SPREADSHEET_ID.trim() !== "") {
    try {
      return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID.trim());
    } catch (e) {
      Logger.log("Lỗi mở spreadsheet ID: " + e.message);
    }
  }
  if (typeof DriveApp !== "undefined") {
    var files = DriveApp.getFilesByName("EduSign_DuLieu_KYS_THCS_ChuVanAn");
    if (files.hasNext()) {
      return SpreadsheetApp.open(files.next());
    }
  }
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
    secret_token: "UnifiedZaloBotTHCSCVA2026Secret"
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
// ⏰ 4. THIẾT LẬP TRIGGER TỰ ĐỘNG GỬI LỊCH DẠY LÚC 6H00 SÁNG
// ====================================================================================================
function setupDailyMorningTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    var fnName = triggers[i].getHandlerFunction();
    if (fnName === "sendDailyMorningPersonalSchedule" || fnName === "sendDailyMorningBrief") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  // Tạo Trigger kích hoạt hàm gửi lịch cá nhân mỗi ngày lúc 6h00 sáng
  ScriptApp.newTrigger("sendDailyMorningPersonalSchedule")
    .timeBased()
    .everyDays(1)
    .atHour(6)
    .create();

  Logger.log("✅ ĐÃ THIẾT LẬP TRIGGER THÀNH CÔNG! Bot sẽ tự động gửi tin nhắn lịch dạy cho giáo viên lúc 6h00 sáng hàng ngày.");
}

// ====================================================================================================
// 🌐 5. XỬ LÝ GET (Cổng Tra Cứu Báo Cáo & API Trực Tuyến)
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

  // B. Tra cứu TKB nhanh qua đường dẫn URL (?query=tkb 6a1 hoặc ?action=TEST_TOMORROW)
  var query = params.query || params.text || "";
  var chatId = params.chat_id || params.chatId || "";

  if (action === "TEST_TOMORROW" || action === "TEST_SCHEDULE") {
    var testPhone = params.phone || "0818810007";
    var testResult = testSendTomorrowSchedule(testPhone);
    return ContentService.createTextOutput(JSON.stringify(testResult, null, 2)).setMimeType(ContentService.MimeType.JSON);
  }

  if (query) {
    var responseText = processUnifiedZaloMessage(chatId, query);
    return ContentService.createTextOutput(responseText).setMimeType(ContentService.MimeType.TEXT);
  }

  // C. Health Check
  return ContentService.createTextOutput(JSON.stringify({
    status: "active",
    system: "Unified Zalo Assistant 4.0 (Timetable + EduSign)",
    school: CONFIG.SCHOOL_NAME,
    timestamp: new Date().toISOString(),
    guide: "Webhook sẵn sàng phục vụ Tra cứu Thời khóa biểu và Ký số."
  })).setMimeType(ContentService.MimeType.JSON);
}

// ====================================================================================================
// 📩 6. XỬ LÝ POST (TIẾP NHẬN WEBHOOK TỪ SERVER KÝ SỐ VÀ TỪ ZALO BOT)
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
    // NHÁNH 1: NHẬN LỆNH TỪ SERVER KÝ SỐ EDUSIGN
    // ----------------------------------------------------------------------------------
    if (action === "NOTIFY_SIGN_EVENT") {
      var eventResult = handleEduSignNotification(postData);
      return ContentService.createTextOutput(JSON.stringify(eventResult)).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === "UPLOAD_SIGNED_DOC" || action === "ARCHIVE_REPORT") {
      var archiveResult = handleReportArchive(postData);
      return ContentService.createTextOutput(JSON.stringify(archiveResult)).setMimeType(ContentService.MimeType.JSON);
    }

    // ----------------------------------------------------------------------------------
    // NHÁNH 2: NHẬN TIN NHẮN TỪ ZALO BOT (GIÁO VIÊN / HỌC SINH TƯƠNG TÁC)
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
      userMessage = postData.message ? (typeof postData.message === "string" ? postData.message : (postData.message.text || "")) : "";
      chatId = postData.sender ? (typeof postData.sender === "object" ? postData.sender.id : postData.sender) : "";
    }

    if (!chatId && postData.chat_id) chatId = postData.chat_id;
    if (!chatId && postData.sender) chatId = (typeof postData.sender === "object" ? postData.sender.id : postData.sender);
    if (!chatId && postData.user_id) chatId = postData.user_id;
    if (!chatId && postData.from) chatId = (typeof postData.from === "object" ? postData.from.id : postData.from);

    // Khi người dùng vừa mở bot hoặc gửi lệnh /start
    if (eventName === "follow" || eventName === "user_open_bot" || eventName === "join" || userMessage === "/start") {
      var welcomeMsg = getUnifiedWelcomeGuideText();
      if (chatId) sendZaloBotReply(chatId, welcomeMsg);
      return ContentService.createTextOutput(JSON.stringify({ status: "welcome_sent" })).setMimeType(ContentService.MimeType.JSON);
    }

    // Xử lý nội dung tin nhắn và phản hồi
    if (userMessage || chatId) {
      var replyText = processUnifiedZaloMessage(chatId, userMessage);
      if (replyText && chatId) {
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
// 🧠 7. BỘ ĐIỀU PHỐI TIN NHẮN THÔNG MINH HỢP NHẤT (UNIFIED NLP ROUTER)
// ====================================================================================================
function processUnifiedZaloMessage(chatId, rawText) {
  var text = (rawText || "").trim();
  if (!text) return getUnifiedWelcomeGuideText();

  var clean = removeVietnameseTones(text).toLowerCase();

  // ----------------------------------------------------------------------------
  // 1. LIÊN KẾT TÀI KHOẢN QUA SỐ ĐIỆN THOẠI (Dành cho Giáo viên)
  // ----------------------------------------------------------------------------
  var phoneDigits = text.replace(/[^0-9]/g, "");
  if (phoneDigits.length >= 9 && phoneDigits.length <= 12 && !clean.startsWith("tkb") && !clean.startsWith("lop")) {
    if (chatId) {
      return handlePhoneMapping(chatId, phoneDigits);
    }
  }

  // ----------------------------------------------------------------------------
  // 2. CÁC LỆNH KÝ SỐ & HỒ SƠ BÁO CÁO CHUYÊN MÔN
  // ----------------------------------------------------------------------------
  if (clean === "hoso" || clean === "ho so" || clean === "trangthai" || clean === "trang thai" || clean === "kiemtra") {
    return handleLookupTeacherReports(chatId);
  }

  if (clean === "baocao" || clean === "bao cao" || clean === "kho" || clean === "drive") {
    return "🌐 CỔNG TRA CỨU BÁO CÁO ĐIỆN TỬ - THCS CHU VĂN AN:\n" +
           "Thầy/Cô bấm vào liên kết bên dưới để tra cứu toàn bộ báo cáo chuyên môn đã được ký duyệt & đóng dấu:\n👉 " + CONFIG.PORTAL_URL;
  }

  if (clean === "huylienket" || clean === "huy lien ket") {
    return handleUnlinkPhone(chatId);
  }

  // ----------------------------------------------------------------------------
  // 3. TRỢ GIÚP / MENU HƯỚNG DẪN
  // ----------------------------------------------------------------------------
  if (clean === "help" || clean === "menu" || clean === "tro giup" || clean === "huong dan" || clean === "?" || clean === "chao" || clean === "xin chao" || clean === "hi" || clean === "hello") {
    return getUnifiedWelcomeGuideText();
  }

  // ----------------------------------------------------------------------------
  // 4. TIỆN ÍCH TKB CÁ NHÂN HÓA 1-CHẠM (Dành cho Giáo viên đã liên kết SĐT)
  // ----------------------------------------------------------------------------
  var isPersonalTkb = (
    clean === "tkb" || clean === "tkb hom nay" || clean === "tkb hn" ||
    clean === "tkb mai" || clean === "tkb ngay mai" || clean === "lich mai" ||
    clean === "lich ngay mai" || clean === "nhac lich" || clean === "lich day" ||
    clean === "mai" || clean === "hom nay"
  );
  if (chatId && isPersonalTkb) {
    var teacherProfile = getTeacherProfileByChatId(chatId);
    if (teacherProfile && teacherProfile.fullName) {
      var schoolData = fetchSchoolTimetableData();
      if (schoolData) {
        var matchedTeacher = findMatchingTeacher(teacherProfile.shortName || teacherProfile.fullName, schoolData.teachers || []);
        if (matchedTeacher) {
          var isTomorrow = (clean.indexOf("mai") !== -1);
          if (isTomorrow) {
            return generateTomorrowTeacherMessage(matchedTeacher, schoolData);
          }
          var dayKey = parseDayFilter(clean);
          return formatTeacherTimetableResponse(matchedTeacher, schoolData, dayKey);
        }
      }
    }
  }

  // ----------------------------------------------------------------------------
  // 5. TRA CỨU LỊCH DẠY THAY & ĐỔI TIẾT
  // ----------------------------------------------------------------------------
  if (clean.includes("day thay") || clean.includes("hoc thay") || clean.includes("doi tiet") || clean.includes("lich thay")) {
    var schoolData = fetchSchoolTimetableData();
    return handleSubstitutionQuery(schoolData);
  }

  // ----------------------------------------------------------------------------
  // 6. TÌM GIÁO VIÊN ĐANG TRỐNG TIẾT (SMART FREE TEACHER FINDER)
  // ----------------------------------------------------------------------------
  if (clean.startsWith("tim gv") || clean.startsWith("gv trong") || clean.startsWith("ai ranh") || clean.includes("trong tiet") || clean.includes("ranh tiet")) {
    var schoolData = fetchSchoolTimetableData();
    return handleFindFreeTeacherQuery(text, clean, schoolData);
  }

  // ----------------------------------------------------------------------------
  // 7. THÔNG BÁO ĐỢT TKB MỚI / TẢI IN TKB
  // ----------------------------------------------------------------------------
  if (clean === "tkb moi" || clean === "dot tkb" || clean === "thong bao" || clean === "thong bao tkb") {
    var schoolData = fetchSchoolTimetableData();
    return handleNewTimetableAnnouncement(schoolData);
  }

  // ----------------------------------------------------------------------------
  // 8. TRA CỨU THỜI KHÓA BIỂU THEO LỚP HOẶC GIÁO VIÊN
  // ----------------------------------------------------------------------------
  var schoolData = fetchSchoolTimetableData();
  if (schoolData) {
    var tkbResponse = handleNaturalTimetableQuery(text, clean, schoolData);
    if (tkbResponse) {
      return tkbResponse;
    }
  }

  // Nếu không khớp cú pháp nào
  return "🤖 Trợ lý Trường học THCS Chu Văn An chưa nhận diện được yêu cầu: \"" + text + "\"\n\n" +
         "💡 Gợi ý cú pháp tra cứu nhanh:\n" +
         "👉 Gửi [Số điện thoại]: Kích hoạt nhận tin Ký số & Lịch dạy 6h00 sáng.\n" +
         "👉 Gõ: tkb 6a1 (hoặc tkb [Tên GV]): Xem TKB kèm khung giờ ra vào lớp.\n" +
         "👉 Gõ: hoso: Kiểm tra trạng thái giáo án đã nộp.\n" +
         "👉 Gõ: menu (hoặc help): Xem đầy đủ hướng dẫn.";
}

function formatDateSafe(date, fmt) {
  if (typeof Utilities !== "undefined" && Utilities.formatDate) {
    return Utilities.formatDate(date, "Asia/Ho_Chi_Minh", fmt || "dd/MM/yyyy");
  }
  var d = date || new Date();
  var day = String(d.getDate()).padStart(2, "0");
  var month = String(d.getMonth() + 1).padStart(2, "0");
  var year = d.getFullYear();
  if (fmt === "yyyy/MM") return year + "/" + month;
  return day + "/" + month + "/" + year;
}

// ====================================================================================================
// 🌅 8. ENGINE TỰ ĐỘNG GỬI LỊCH DẠY 6H00 SÁNG CHO TỪNG GIÁO VIÊN THEO SĐT
// ====================================================================================================
function sendDailyMorningPersonalSchedule() {
  Logger.log("⏰ [MorningEngine] Bắt đầu quét lịch giảng dạy buổi sáng...");

  var todayDate = new Date();
  var dayOfWeek = todayDate.getDay(); // 0: Chủ Nhật, 1: Thứ Hai, ..., 6: Thứ Bảy

  // Chủ Nhật: Không gửi lịch học chính khóa
  if (dayOfWeek === 0) {
    Logger.log("🌴 Hôm nay là Chủ Nhật. Bỏ qua gửi tin nhắn giảng dạy.");
    return { status: "sunday_skip" };
  }

  var dayMap = { 1: "T2", 2: "T3", 3: "T4", 4: "T5", 5: "T6", 6: "T7" };
  var dayKey = dayMap[dayOfWeek] || "T2";
  var dayNames = { "T2": "Thứ Hai", "T3": "Thứ Ba", "T4": "Thứ Tư", "T5": "Thứ Năm", "T6": "Thứ Sáu", "T7": "Thứ Bảy" };

  var schoolData = fetchSchoolTimetableData();
  if (!schoolData) {
    Logger.log("❌ Không thể kết nối dữ liệu Firebase TKB.");
    return { status: "error", message: "NO_TKB_DATA" };
  }

  var ss = getDatabaseSpreadsheet();
  var sheetUsers = ss.getSheetByName(CONFIG.SHEET_USERS);
  if (!sheetUsers) {
    Logger.log("❌ Không tìm thấy bảng Danh bạ GV.");
    return { status: "error", message: "NO_SHEET_USERS" };
  }

  var usersData = sheetUsers.getDataRange().getValues();
  var sentCount = 0;
  var skipCount = 0;
  var dateStr = formatDateSafe(todayDate, "dd/MM/yyyy");

  for (var i = 1; i < usersData.length; i++) {
    var teacherName = String(usersData[i][1] || "").trim();
    var phone = String(usersData[i][2] || "").trim();
    var chatId = String(usersData[i][5] || "").trim();
    var shortName = String(usersData[i][7] || "").trim();

    // Bỏ qua nếu giáo viên chưa liên kết Zalo
    if (!chatId) {
      skipCount++;
      continue;
    }

    // Tìm đối tượng giáo viên trong TKB
    var searchKey = shortName || teacherName;
    var matchedTeacher = findMatchingTeacher(searchKey, schoolData.teachers || []);

    if (!matchedTeacher) {
      continue;
    }

    // Soạn tin nhắn lịch dạy cá nhân hôm nay
    var morningMsg = generateMorningTeacherMessage(matchedTeacher, schoolData, dayKey, dayNames[dayKey], dateStr);

    if (morningMsg) {
      sendZaloBotReply(chatId, morningMsg);
      sentCount++;
      // Nghỉ 150ms để chống nghẽn rate limit Zalo Bot API
      Utilities.sleep(150);
    }
  }

  Logger.log("🎉 [MorningEngine] Hoàn tất gửi lịch sáng: Đã gửi cho " + sentCount + " giáo viên. Bỏ qua " + skipCount + " chưa liên kết Zalo.");
  return { status: "success", sentCount: sentCount, skipCount: skipCount };
}

/**
 * Trình tạo nội dung tin nhắn chào buổi sáng tinh gọn kèm khung giờ chuẩn
 */
function generateMorningTeacherMessage(teacher, schoolData, dayKey, dayName, dateStr) {
  var active = getActiveTimetable(schoolData);
  var timetable = active.timetable || {};
  var classes = schoolData.classes || [];
  var substitutions = schoolData.substitutions || [];

  var morningSlots = [];
  var afternoonSlots = [];

  // 1. Quét các tiết dạy chính khóa của giáo viên
  classes.forEach(function(c) {
    var session = (c.session || "sáng").toLowerCase();
    var clsTkb = timetable[c.name];
    if (clsTkb && clsTkb[dayKey]) {
      for (var p = 1; p <= 5; p++) {
        if (clsTkb[dayKey][p] && clsTkb[dayKey][p].teacher === teacher.shortName) {
          var timeStr = (formatPeriodTime(session, p) || "").replace(/\s+/g, "");
          var item = {
            period: p,
            subject: clsTkb[dayKey][p].subject,
            className: c.name,
            session: session,
            time: timeStr
          };
          if (session === "sáng") morningSlots.push(item);
          else afternoonSlots.push(item);
        }
      }
    }
  });

  morningSlots.sort(function(a, b) { return a.period - b.period; });
  afternoonSlots.sort(function(a, b) { return a.period - b.period; });

  // 2. Quét các ca dạy thay hôm nay (nếu có)
  var mySubs = [];
  substitutions.forEach(function(sub) {
    if (sub && sub.substituteTeacher === teacher.shortName) {
      mySubs.push(sub);
    }
  });

  var totalPeriods = morningSlots.length + afternoonSlots.length + mySubs.length;

  // Nếu hôm nay giáo viên không có tiết dạy nào
  if (totalPeriods === 0) {
    return null; // Không gửi để tránh làm phiền giáo viên trong ngày nghỉ
  }

  var msg = "🌅 LỊCH GIẢNG DẠY HÔM NAY (*" + dayName + "* - " + dateStr + ")\n" +
            "Kính chào Thầy/Cô *" + teacher.fullName.toUpperCase() + "*! ✨\n" +
            "Chúc Thầy/Cô một ngày làm việc hiệu quả.\n\n" +
            "📋 Hôm nay Thầy/Cô có " + totalPeriods + " tiết dạy:\n";

  if (morningSlots.length > 0) {
    msg += "\n🌅 Sáng (" + morningSlots.length + " tiết):\n";
    morningSlots.forEach(function(s) {
      msg += "• Tiết " + s.period + " (" + s.time + "): " + s.subject + " - " + s.className + "\n";
    });
  }

  if (afternoonSlots.length > 0) {
    msg += "\n🌇 Chiều (" + afternoonSlots.length + " tiết):\n";
    afternoonSlots.forEach(function(s) {
      msg += "• Tiết " + s.period + " (" + s.time + "): " + s.subject + " - " + s.className + "\n";
    });
  }

  if (mySubs.length > 0) {
    msg += "\n🔄 CA DẠY THAY TRONG NGÀY:\n";
    mySubs.forEach(function(sub) {
      msg += "• Tiết " + (sub.period || "N/A") + " (" + (sub.className || "") + "): Dạy thay cho GV " + (sub.originalTeacher || "") + "\n";
    });
  }

  msg += "\n🌐 In TKB: " + CONFIG.PUBLIC_TKB_PORTAL + "?gv=" + encodeURIComponent(teacher.shortName) + "\n" +
         "💡 Để xem hồ sơ giáo án: gõ \"hoso\"";

  return msg;
}

// ====================================================================================================
// ⏰ 9. ĐỊNH DẠNG KHUNG GIỜ VÀO/RA LỚP (TIME SLOTS FORMATTER)
// ====================================================================================================
function formatPeriodTime(session, period) {
  var sess = (session || "sáng").toLowerCase();
  var times = CONFIG.PERIOD_TIMES[sess];
  if (times && times[period]) {
    return times[period];
  }
  return (sess === "chiều" ? "13h00 - 17h05" : "07h00 - 11h05");
}

function formatDepartmentName(raw) {
  if (!raw) return "";
  var map = {
    "g_toan_tin": "Tổ Toán - Tin",
    "g_khtn": "Tổ Khoa học Tự nhiên",
    "g_khxh": "Tổ Khoa học Xã hội",
    "g_su_dia": "Tổ Lịch sử - Địa lý",
    "g_van": "Tổ Ngữ văn",
    "g_anh": "Tổ Ngoại ngữ",
    "g_gdcd": "Tổ Giáo dục Công dân",
    "g_nghe_thuat": "Tổ Âm nhạc - Mỹ thuật",
    "g_the_chat": "Tổ Giáo dục Thể chất"
  };
  var lower = String(raw).trim().toLowerCase();
  if (map[lower]) return map[lower];
  return raw.replace(/^g_/, "Tổ ").replace(/_/g, " ");
}

// ====================================================================================================
// 📊 10. TRÌNH ĐỊNH DẠNG THỜI KHÓA BIỂU KÈM KHUNG GIỜ (TỐI ƯU MÀN HÌNH ĐIỆN THOẠI)
// ====================================================================================================
function formatTeacherTimetableResponse(teacher, schoolData, dayFilter) {
  var active = getActiveTimetable(schoolData);
  var timetable = active.timetable || {};
  var classes = schoolData.classes || [];
  var weekdays = dayFilter ? [dayFilter] : ["T2", "T3", "T4", "T5", "T6", "T7"];
  var dayNames = { "T2": "Thứ Hai", "T3": "Thứ Ba", "T4": "Thứ Tư", "T5": "Thứ Năm", "T6": "Thứ Sáu", "T7": "Thứ Bảy" };

  var out = "📅 LỊCH DẠY: *" + teacher.fullName.toUpperCase() + "* (" + teacher.shortName + ")\n";
  if (teacher.group) {
    out += "🏢 *" + formatDepartmentName(teacher.group) + "*\n";
  }
  if (active.weekName) {
    out += "📌 " + active.weekName + (active.applyDate ? " (từ " + active.applyDate + ")" : "") + "\n";
  }

  var hasAnyPeriod = false;

  weekdays.forEach(function(day) {
    var daySlots = {};

    classes.forEach(function(c) {
      var session = (c.session || "sáng").toLowerCase();
      var clsTkb = timetable[c.name];
      if (clsTkb && clsTkb[day]) {
        for (var p = 1; p <= 5; p++) {
          if (clsTkb[day][p] && clsTkb[day][p].teacher === teacher.shortName) {
            var key = session + "_" + p;
            if (!daySlots[key]) {
              var timeStr = (formatPeriodTime(session, p) || "").replace(/\s+/g, "");
              daySlots[key] = {
                p: p,
                sub: clsTkb[day][p].subject,
                classes: [c.name],
                session: session,
                time: timeStr
              };
            } else {
              if (daySlots[key].classes.indexOf(c.name) === -1) {
                daySlots[key].classes.push(c.name);
              }
            }
          }
        }
      }
    });

    var morning = [];
    var afternoon = [];
    Object.keys(daySlots).forEach(function(k) {
      var s = daySlots[k];
      if (s.session === "sáng") morning.push(s);
      else afternoon.push(s);
    });

    morning.sort(function(a, b) { return a.p - b.p; });
    afternoon.sort(function(a, b) { return a.p - b.p; });

    if (morning.length > 0 || afternoon.length > 0) {
      hasAnyPeriod = true;
      var dayTitle = (dayNames[day] || day).toUpperCase();
      out += "\n🗓️ *" + dayTitle + "*:\n";

      if (morning.length > 0) {
        out += "🌅 Sáng:\n";
        morning.forEach(function(s) {
          out += "• Tiết " + s.p + " (" + s.time + "): " + s.sub + " - " + s.classes.join(", ") + "\n";
        });
      }

      if (afternoon.length > 0) {
        out += "🌇 Chiều:\n";
        afternoon.forEach(function(s) {
          out += "• Tiết " + s.p + " (" + s.time + "): " + s.sub + " - " + s.classes.join(", ") + "\n";
        });
      }
    }
  });

  if (!hasAnyPeriod) {
    if (dayFilter) {
      var dName = dayNames[dayFilter] || dayFilter;
      out += "\n🌴 *" + dName + "*: Thầy/Cô không có tiết dạy.\n";
      var nextSchedule = findNextTeachingSession(teacher, schoolData, dayFilter);
      if (nextSchedule) {
        out += "\n🗓️ *LỊCH DẠY BUỔI TIẾP THEO* (*" + nextSchedule.dayName + "*):\n" + nextSchedule.content + "\n";
      }
    } else {
      out += "\n🌴 Thầy/Cô không có tiết dạy trong thời khóa biểu tuần này.\n";
    }
  }

  out += "\n🌐 In TKB: " + CONFIG.PUBLIC_TKB_PORTAL + "?gv=" + encodeURIComponent(teacher.shortName);
  return out;
}

function formatClassTimetableResponse(cls, schoolData, dayFilter) {
  var active = getActiveTimetable(schoolData);
  var timetable = active.timetable || {};
  var session = (cls.session || "sáng").toLowerCase();
  var weekdays = dayFilter ? [dayFilter] : ["T2", "T3", "T4", "T5", "T6", "T7"];
  var dayNames = { "T2": "Thứ Hai", "T3": "Thứ Ba", "T4": "Thứ Tư", "T5": "Thứ Năm", "T6": "Thứ Sáu", "T7": "Thứ Bảy" };

  var gvcnInfo = getHomeroomTeacher(cls, timetable, schoolData.assignments, schoolData.teachers);

  var out = "🏫 TKB LỚP *" + cls.name + "* (*" + (session === "chiều" ? "Buổi Chiều" : "Buổi Sáng") + "*)\n";
  if (gvcnInfo) {
    out += "👨‍🏫 GVCN: *" + gvcnInfo + "*\n";
  }
  if (active.weekName) {
    out += "📌 " + active.weekName + (active.applyDate ? " (từ " + active.applyDate + ")" : "") + "\n";
  }

  var hasSlots = false;
  var clsSchedule = timetable[cls.name] || {};

  weekdays.forEach(function(day) {
    var slots = [];
    for (var p = 1; p <= 5; p++) {
      if (clsSchedule[day] && clsSchedule[day][p]) {
        var timeStr = (formatPeriodTime(session, p) || "").replace(/\s+/g, "");
        slots.push({
          p: p,
          sub: clsSchedule[day][p].subject,
          tea: clsSchedule[day][p].teacher,
          time: timeStr
        });
      }
    }

    if (slots.length > 0) {
      hasSlots = true;
      var dayTitle = (dayNames[day] || day).toUpperCase();
      out += "\n🗓️ *" + dayTitle + "*:\n";
      out += (session === "chiều" ? "🌇 Chiều:\n" : "🌅 Sáng:\n");
      slots.forEach(function(s) {
        var teacherStr = s.tea ? " (" + s.tea + ")" : "";
        out += "• Tiết " + s.p + " (" + s.time + "): " + s.sub + teacherStr + "\n";
      });
    }
  });

  if (!hasSlots) {
    out += "\n🌴 Lớp không có tiết học trong thời gian này.\n";
  }

  out += "\n🌐 Xem TKB: " + CONFIG.PUBLIC_TKB_PORTAL + "?lop=" + encodeURIComponent(cls.name);
  return out;
}

/**
 * Tạo tin nhắn TKB ngày mai thông minh cho Giáo viên
 */
function generateTomorrowTeacherMessage(teacher, schoolData, targetDate) {
  var tomorrow = targetDate || new Date(new Date().getTime() + 24 * 60 * 60 * 1000);
  var dayOfWeek = tomorrow.getDay(); // 0: Chủ Nhật, 1: T2, ..., 6: T7
  var dayMap = { 0: "CN", 1: "T2", 2: "T3", 3: "T4", 4: "T5", 5: "T6", 6: "T7" };
  var dayKey = dayMap[dayOfWeek] || "T2";
  var dayNames = { "T2": "Thứ Hai", "T3": "Thứ Ba", "T4": "Thứ Tư", "T5": "Thứ Năm", "T6": "Thứ Sáu", "T7": "Thứ Bảy", "CN": "Chủ Nhật" };
  var dayName = dayNames[dayKey] || dayKey;
  var dateStr = formatDateSafe(tomorrow, "dd/MM/yyyy");

  var active = getActiveTimetable(schoolData);
  var timetable = active.timetable || {};
  var classes = schoolData.classes || [];

  var morningSlots = [];
  var afternoonSlots = [];

  if (dayKey !== "CN") {
    classes.forEach(function(c) {
      var session = (c.session || "sáng").toLowerCase();
      var clsTkb = timetable[c.name];
      if (clsTkb && clsTkb[dayKey]) {
        for (var p = 1; p <= 5; p++) {
          if (clsTkb[dayKey][p] && clsTkb[dayKey][p].teacher === teacher.shortName) {
            var timeStr = (formatPeriodTime(session, p) || "").replace(/\s+/g, "");
            var item = {
              period: p,
              subject: clsTkb[dayKey][p].subject,
              className: c.name,
              session: session,
              time: timeStr
            };
            if (session === "sáng") morningSlots.push(item);
            else afternoonSlots.push(item);
          }
        }
      }
    });
  }

  morningSlots.sort(function(a, b) { return a.period - b.period; });
  afternoonSlots.sort(function(a, b) { return a.period - b.period; });
  var totalPeriods = morningSlots.length + afternoonSlots.length;

  var msg = "📅 LỊCH GIẢNG DẠY NGÀY MAI (*" + dayName + "* - " + dateStr + ")\n" +
            "👤 Thầy/Cô: *" + teacher.fullName.toUpperCase() + "* (" + teacher.shortName + ")\n";

  if (totalPeriods === 0) {
    msg += "\n🌴 Ngày mai Thầy/Cô *KHÔNG CÓ TIẾT DẠY*. Chúc Thầy/Cô có thời gian nghỉ ngơi vui vẻ!\n";
    var nextSchedule = findNextTeachingSession(teacher, schoolData, dayKey);
    if (nextSchedule) {
      msg += "\n🗓️ *LỊCH DẠY BUỔI TIẾP THEO* (*" + nextSchedule.dayName + "*):\n" + nextSchedule.content + "\n";
    }
  } else {
    msg += "📋 Ngày mai Thầy/Cô có " + totalPeriods + " tiết dạy:\n";
    if (morningSlots.length > 0) {
      msg += "\n🌅 Sáng (" + morningSlots.length + " tiết):\n";
      morningSlots.forEach(function(s) {
        msg += "• Tiết " + s.period + " (" + s.time + "): " + s.subject + " - " + s.className + "\n";
      });
    }
    if (afternoonSlots.length > 0) {
      msg += "\n🌇 Chiều (" + afternoonSlots.length + " tiết):\n";
      afternoonSlots.forEach(function(s) {
        msg += "• Tiết " + s.period + " (" + s.time + "): " + s.subject + " - " + s.className + "\n";
      });
    }
  }

  msg += "\n🌐 Tra cứu chi tiết: " + CONFIG.PUBLIC_TKB_PORTAL + "?gv=" + encodeURIComponent(teacher.shortName);
  return msg;
}

/**
 * Tự động tìm buổi dạy gần nhất tiếp theo trong tuần
 */
function findNextTeachingSession(teacher, schoolData, afterDayKey) {
  var active = getActiveTimetable(schoolData);
  var timetable = active.timetable || {};
  var classes = schoolData.classes || [];
  var order = ["T2", "T3", "T4", "T5", "T6", "T7"];
  var dayNames = { "T2": "Thứ Hai", "T3": "Thứ Ba", "T4": "Thứ Tư", "T5": "Thứ Năm", "T6": "Thứ Sáu", "T7": "Thứ Bảy" };

  var startIdx = order.indexOf(afterDayKey);
  if (startIdx === -1) startIdx = 0;

  for (var step = 1; step <= 6; step++) {
    var d = order[(startIdx + step) % 6];
    var slots = [];
    classes.forEach(function(c) {
      var session = (c.session || "sáng").toLowerCase();
      var clsTkb = timetable[c.name];
      if (clsTkb && clsTkb[d]) {
        for (var p = 1; p <= 5; p++) {
          if (clsTkb[d][p] && clsTkb[d][p].teacher === teacher.shortName) {
            var timeStr = (formatPeriodTime(session, p) || "").replace(/\s+/g, "");
            slots.push({
              p: p,
              sub: clsTkb[d][p].subject,
              cls: c.name,
              session: session,
              time: timeStr
            });
          }
        }
      }
    });

    if (slots.length > 0) {
      slots.sort(function(a, b) { return a.p - b.p; });
      var morning = slots.filter(function(s) { return s.session === "sáng"; });
      var afternoon = slots.filter(function(s) { return s.session !== "sáng"; });
      var lines = [];
      if (morning.length > 0) {
        lines.push("🌅 Sáng:");
        morning.forEach(function(s) {
          lines.push("• Tiết " + s.p + " (" + s.time + "): " + s.sub + " - " + s.cls);
        });
      }
      if (afternoon.length > 0) {
        lines.push("🌇 Chiều:");
        afternoon.forEach(function(s) {
          lines.push("• Tiết " + s.p + " (" + s.time + "): " + s.sub + " - " + s.cls);
        });
      }
      return {
        dayKey: d,
        dayName: dayNames[d] || d,
        content: lines.join("\n")
      };
    }
  }
  return null;
}

/**
 * HÀM TEST NHANH 1-CHẠM: Gửi thử lịch ngày mai cho giáo viên theo SĐT
 */
function testSendTomorrowSchedule(targetPhone) {
  var phone = targetPhone || "0818810007";
  var normPhone = normalizePhone(phone);
  Logger.log("🚀 [TestTomorrow] Bắt đầu kiểm tra gửi lịch ngày mai cho SĐT: " + phone);

  var schoolData = fetchSchoolTimetableData();
  if (!schoolData) {
    return { success: false, error: "Không thể kết nối dữ liệu Firebase TKB" };
  }

  var ss = getDatabaseSpreadsheet();
  if (!ss) {
    return { success: false, error: "Không mở được cơ sở dữ liệu Spreadsheet" };
  }
  var sheetUsers = ss.getSheetByName(CONFIG.SHEET_USERS);
  if (!sheetUsers) {
    return { success: false, error: "Không tìm thấy Sheet Danh bạ GV" };
  }

  var data = sheetUsers.getDataRange().getValues();
  var foundTeacher = null;
  var chatId = null;
  var shortName = null;

  for (var i = 1; i < data.length; i++) {
    var rowPhone = normalizePhone(String(data[i][2] || ""));
    if (rowPhone === normPhone) {
      foundTeacher = String(data[i][1] || "");
      chatId = String(data[i][5] || "").trim();
      shortName = String(data[i][7] || "").trim();
      break;
    }
  }

  if (!foundTeacher) {
    return { success: false, error: "Không tìm thấy giáo viên với SĐT " + phone + " trong Danh bạ GV" };
  }

  var matchedTeacher = findMatchingTeacher(shortName || foundTeacher, schoolData.teachers || []);
  if (!matchedTeacher) {
    return { success: false, error: "Không khớp được giáo viên trong dữ liệu TKB với tên: " + (shortName || foundTeacher) };
  }

  var tomorrowMsg = generateTomorrowTeacherMessage(matchedTeacher, schoolData);
  Logger.log("📝 Nội dung tin nhắn chuẩn bị gửi:\n" + tomorrowMsg);

  if (chatId) {
    sendZaloBotReply(chatId, tomorrowMsg);
    Logger.log("✅ Đã phát lệnh gửi Zalo Bot tới Chat ID: " + chatId);
  } else {
    Logger.log("⚠️ Giáo viên chưa có Zalo_Chat_ID trong Sheet. Tin nhắn chưa thể chuyển trực tiếp qua Zalo.");
  }

  return {
    success: true,
    teacher: matchedTeacher.fullName,
    shortName: matchedTeacher.shortName,
    chatId: chatId,
    message: tomorrowMsg
  };
}

// ====================================================================================================
// 🔍 11. XỬ LÝ TRA CỨU NGÔN NGỮ TỰ NHIÊN (NLP MATCHERS)
// ====================================================================================================
function handleNaturalTimetableQuery(text, clean, schoolData) {
  var classes = schoolData.classes || [];
  var teachers = schoolData.teachers || [];
  var dayFilter = parseDayFilter(clean);

  // 1. Kiểm tra Lớp học (Chính xác 100%, chống 6A10 ra 6A1)
  var matchedClass = findMatchingClass(text, classes);
  if (matchedClass) {
    return formatClassTimetableResponse(matchedClass, schoolData, dayFilter);
  }

  // 2. Kiểm tra Giáo viên (Chính xác 100%, chống P.Thúy ra Thu)
  var matchedTeacher = findMatchingTeacher(text, teachers);
  if (matchedTeacher) {
    var isTomorrow = (clean.indexOf("mai") !== -1);
    if (isTomorrow) {
      return generateTomorrowTeacherMessage(matchedTeacher, schoolData);
    }
    return formatTeacherTimetableResponse(matchedTeacher, schoolData, dayFilter);
  }

  // 3. Nếu người dùng chỉ gõ "tkb" nhưng chưa liên kết SĐT
  if (clean.startsWith("tkb") || clean.startsWith("thoi khoa bieu") || clean.startsWith("lich day")) {
    return "💡 Thầy/Cô vui lòng nhập đúng Tên viết tắt (VD: \"tkb Trọng\", \"tkb P.Thúy\") hoặc Tên lớp (VD: \"tkb 6A1\", \"tkb 9B2\").\n\n" +
           "📱 Nếu Thầy/Cô là Giáo viên: Hãy gửi [Số Điện Thoại] để kích hoạt nhận lịch dạy tự động lúc 6h00 sáng!";
  }

  return null;
}

function handleSubstitutionQuery(schoolData) {
  if (!schoolData) return "❌ Không thể kết nối cơ sở dữ liệu thời khóa biểu.";
  var subs = schoolData.substitutions || [];
  if (subs.length === 0) {
    return "🔄 LỊCH DẠY THAY & HỌC THAY\n✨ Hiện tại không có ca dạy thay / học thay nào trong tuần này.";
  }

  var out = "🔄 LỊCH DẠY THAY & HỌC THAY\n📌 Cập nhật danh sách phân công dạy thay:\n\n";

  subs.forEach(function(s, idx) {
    out += (idx + 1) + ". Ngày " + (s.date || s.day || "Trong tuần") + " - Tiết " + (s.period || "") + "\n" +
           "• Lớp: " + (s.className || "") + " | Môn: " + (s.subject || "") + "\n" +
           "• GV vắng: " + (s.originalTeacher || "N/A") + "\n" +
           "• 👉 GV DẠY THAY: " + (s.substituteTeacher || "Chưa phân công") + "\n" +
           (s.note ? ("• Ghi chú: " + s.note + "\n") : "") + "\n";
  });

  return out.trim();
}

function handleFindFreeTeacherQuery(text, clean, schoolData) {
  if (!schoolData) return "❌ Không thể kết nối cơ sở dữ liệu trường.";

  var teachers = schoolData.teachers || [];
  var classes = schoolData.classes || [];
  var timetable = getActiveTimetable(schoolData).timetable || {};

  var day = parseDayFilter(clean) || "T2";
  var period = 1;
  var pMatch = clean.match(/tiet\s*(\d)|t(\d)/);
  if (pMatch) {
    period = parseInt(pMatch[1] || pMatch[2]);
  }

  var freeTeachers = [];
  teachers.forEach(function(t) {
    if (!t || !t.shortName) return;
    var isBusy = false;
    classes.forEach(function(c) {
      if (timetable[c.name] && timetable[c.name][day] && timetable[c.name][day][period]) {
        if (timetable[c.name][day][period].teacher === t.shortName) {
          isBusy = true;
        }
      }
    });
    if (!isBusy) {
      freeTeachers.push(t);
    }
  });

  var dayNames = { "T2": "Thứ Hai", "T3": "Thứ Ba", "T4": "Thứ Tư", "T5": "Thứ Năm", "T6": "Thứ Sáu", "T7": "Thứ Bảy" };
  var out = "👥 GIÁO VIÊN TRỐNG TIẾT DẠY THAY\n" +
            "🗓️ Thời gian: " + (dayNames[day] || day) + " - Tiết " + period + "\n\n";

  if (freeTeachers.length === 0) {
    out += "⚠️ Rất tiếc, không có giáo viên nào đang trống ở Tiết " + period + " " + (dayNames[day] || day) + ".";
  } else {
    out += "✅ Tìm thấy " + freeTeachers.length + " Giáo viên đang TRỐNG TIẾT có thể phân công dạy thay:\n\n";
    freeTeachers.forEach(function(t, i) {
      var groupStr = t.group ? (" - Tổ: " + t.group.replace(/^g_/, "Tổ ").replace(/_/g, " ")) : "";
      out += (i + 1) + ". 👤 " + t.fullName + " (" + t.shortName + ")" + groupStr + "\n";
    });
  }

  return out;
}

function handleNewTimetableAnnouncement(schoolData) {
  if (!schoolData) return "❌ Không thể kết nối cơ sở dữ liệu thời khóa biểu.";
  var active = getActiveTimetable(schoolData);
  return "📢 THÔNG BÁO THỜI KHÓA BIỂU\n" +
         "📌 Đợt TKB: " + (active.weekName || "Thời khóa biểu chính thức") + "\n" +
         "🗓️ Áp dụng từ: " + (active.applyDate || "Toàn trường") + "\n\n" +
         "Thầy/Cô và các em học sinh có thể tra cứu nhanh bằng cách gõ:\n" +
         "👉 tkb [Tên Lớp hoặc Tên GV]\n\n" +
         "🌐 Hoặc xem bảng trực tuyến 1 chạm tại:\n" +
         CONFIG.PUBLIC_TKB_PORTAL + "?tra-cuu";
}

// ====================================================================================================
// 🔗 12. HÀM MAPPING SỐ ĐIỆN THOẠI -> ZALO CHAT ID
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
  var shortName = "";

  for (var i = 1; i < data.length; i++) {
    var rowPhone = normalizePhone(String(data[i][2]));
    if (rowPhone === normPhone) {
      matchedRow = i + 1;
      teacherName = data[i][1];
      department = data[i][3];
      shortName = data[i][7] || "";
      break;
    }
  }

  if (matchedRow !== -1) {
    sheet.getRange(matchedRow, 6).setValue(String(chatId));
    sheet.getRange(matchedRow, 7).setValue(new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }));

    // Tự động tìm tên viết tắt TKB nếu chưa có
    if (!shortName) {
      var schoolData = fetchSchoolTimetableData();
      if (schoolData && schoolData.teachers) {
        var tObj = findMatchingTeacher(teacherName, schoolData.teachers);
        if (tObj && tObj.shortName) {
          sheet.getRange(matchedRow, 8).setValue(tObj.shortName);
        }
      }
    }

    return "🎉 LIÊN KẾT ZALO THÀNH CÔNG!\n\n" +
           "👤 Họ và Tên: " + teacherName + "\n" +
           "🏫 Đơn vị: " + department + "\n" +
           "📱 Số điện thoại: " + phoneInput + "\n\n" +
           "✅ TỪ BÂY GIỜ THẦY/CÔ SẼ TỰ ĐỘNG NHẬN:\n" +
           "1️⃣ 🌅 Tin nhắn nhắc lịch giảng dạy chi tiết lúc 6h00 sáng mỗi ngày.\n" +
           "2️⃣ 🔔 Thông báo tức thì khi có hồ sơ trình ký, giáo án được ký duyệt hoặc bị trả về.\n" +
           "3️⃣ 📅 Tra cứu nhanh: Chỉ cần gõ 'tkb' là xem được lịch dạy cá nhân ngay lập tức!";
  } else {
    return "⚠️ Số điện thoại [" + phoneInput + "] không có trong danh bạ cán bộ - giáo viên nhà trường.\n" +
           "Vui lòng kiểm tra lại hoặc liên hệ Văn thư nhà trường để cập nhật số điện thoại chính xác!";
  }
}

function handleUnlinkPhone(chatId) {
  var ss = getDatabaseSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_USERS);
  if (!sheet) return "⚠️ Dữ liệu chưa sẵn sàng.";

  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][5]) === String(chatId)) {
      sheet.getRange(i + 1, 6).setValue("");
      return "✅ Đã hủy liên kết Zalo thành công. Thầy/Cô có thể gửi lại Số điện thoại mới bất cứ lúc nào.";
    }
  }
  return "⚠️ Tài khoản Zalo này chưa từng liên kết với số điện thoại nào.";
}

function getTeacherProfileByChatId(chatId) {
  var ss = getDatabaseSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_USERS);
  if (!sheet) return null;

  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][5]) === String(chatId)) {
      return {
        fullName: data[i][1],
        phone: normalizePhone(String(data[i][2])),
        department: data[i][3],
        shortName: data[i][7] || ""
      };
    }
  }
  return null;
}

// ====================================================================================================
// 📊 13. TRA CỨU TRẠNG THÁI HỒ SƠ 1-CHẠM QUA ZALO
// ====================================================================================================
function handleLookupTeacherReports(chatId) {
  var ss = getDatabaseSpreadsheet();
  var sheetUsers = ss.getSheetByName(CONFIG.SHEET_USERS);
  var sheetReports = ss.getSheetByName(CONFIG.SHEET_REPORTS);

  if (!sheetUsers || !sheetReports) return "⚠️ Dữ liệu chưa sẵn sàng.";

  var teacher = getTeacherProfileByChatId(chatId);
  if (!teacher) {
    return "⚠️ Thầy/Cô chưa liên kết tài khoản Zalo!\n👉 Vui lòng gửi [Số Điện Thoại] để hệ thống kích hoạt trước khi tra cứu.";
  }

  var reportsData = sheetReports.getDataRange().getValues();
  var myReports = [];

  for (var j = reportsData.length - 1; j >= 1; j--) {
    var row = reportsData[j];
    var author = String(row[2] || "");
    var phone = normalizePhone(String(row[3] || ""));

    if ((teacher.phone && phone === teacher.phone) || (teacher.fullName && author.toLowerCase().indexOf(teacher.fullName.toLowerCase()) !== -1)) {
      myReports.push({
        id: row[0],
        title: row[1],
        approver: row[5],
        date: row[6],
        status: row[7],
        viewUrl: row[8]
      });
      if (myReports.length >= 5) break;
    }
  }

  if (myReports.length === 0) {
    return "📋 Kính chào Thầy/Cô " + teacher.fullName + "!\n" +
           "Hiện tại chưa có báo cáo chuyên môn nào của Thầy/Cô được lưu trữ trên hệ thống.\n\n" +
           "🌐 Xem cổng báo cáo chung: " + CONFIG.PORTAL_URL;
  }

  var msg = "📋 CÁC BÁO CÁO GẦN NHẤT CỦA THẦY/CÔ (" + teacher.fullName + "):\n";
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
// 🔔 14. XỬ LÝ SỰ KIỆN TỪ SERVER KÝ SỐ EDUSIGN
// ====================================================================================================
function handleEduSignNotification(data) {
  var eventType = data.eventType;
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
                  "📌 Thầy/Cô vui lòng truy cập phần mềm EduSign để chỉnh sửa và nộp lại.";
  } else if (eventType === "COMPLETED") {
    targetPhone = authorPhone;
    messageText = "╔════════════════════════════════════════╗\n" +
                  "  🎉 THÔNG BÁO: HỒ SƠ ĐÃ ĐƯỢC PHÊ DUYỆT\n" +
                  "╚════════════════════════════════════════╝\n\n" +
                  "📋 Báo cáo: " + docTitle + "\n" +
                  "🆔 Mã hồ sơ: " + docId + "\n" +
                  "✍️ Người ký duyệt: " + approverName + "\n" +
                  "🔴 Con dấu: Đã đóng mộc số của trường THCS Chu Văn An.\n" +
                  (viewUrl ? ("📂 Link xem tài liệu: " + viewUrl + "\n\n") : "\n") +
                  "🌐 Tra cứu tại Cổng báo cáo: " + CONFIG.PORTAL_URL;
  } else if (eventType === "SUBMITTED") {
    targetPhone = recipientPhone;
    messageText = "╔════════════════════════════════════════╗\n" +
                  "  📥 THÔNG BÁO: CÓ HỒ SƠ MỚI CẦN KÝ DUYỆT\n" +
                  "╚════════════════════════════════════════╝\n\n" +
                  "📋 Tên hồ sơ: " + docTitle + "\n" +
                  "🆔 Mã hồ sơ: " + docId + "\n" +
                  "👤 Người trình ký: " + senderName + "\n" +
                  "⏰ Thời gian gửi: " + new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) + "\n\n" +
                  "👉 Kính mời Quý Thầy/Cô vào phần mềm EduSign để kiểm tra và ký duyệt.";
  } else if (eventType === "PERSONAL_SIGNED") {
    targetPhone = authorPhone;
    messageText = "╔════════════════════════════════════════╗\n" +
                  "  ✅ XÁC NHẬN: KÝ SỐ GIÁO ÁN HOÀN TẤT\n" +
                  "╚════════════════════════════════════════╝\n\n" +
                  "📋 Giáo án: " + docTitle + "\n" +
                  "🆔 Mã hồ sơ: " + docId + "\n" +
                  "✍️ Tác giả: " + senderName + "\n" +
                  "⏰ Thời gian ký: " + new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) + "\n\n" +
                  "🎉 Hồ sơ cá nhân của Thầy/Cô đã được ký số hợp lệ và lưu trữ vào sổ sách điện tử.";
  }

  if (targetPhone && messageText) {
    var chatId = getChatIdByPhone(targetPhone);
    if (chatId) {
      sendZaloBotReply(chatId, messageText);
      return { success: true, delivered: true, phone: targetPhone, chatId: chatId };
    } else {
      return { success: true, delivered: false, phone: targetPhone, note: "CHUA_LIEN_KET_ZALO" };
    }
  }

  return { success: false, reason: "INVALID_EVENT" };
}

// ====================================================================================================
// 📁 15. LƯU TRỮ BÁO CÁO VÀO GOOGLE DRIVE & GOOGLE SHEETS
// ====================================================================================================
function handleReportArchive(data) {
  try {
    var ss = getDatabaseSpreadsheet();
    var sheet = ss.getSheetByName(CONFIG.SHEET_REPORTS);
    if (!sheet) {
      return { success: false, error: "Khong tim thay Sheet So Luu Bao Cao" };
    }

    var docId = data.docId || ("BC-" + Date.now());
    var title = data.title || "Báo cáo chuyên môn";
    var author = data.author || "Giáo viên";
    var authorPhone = normalizePhone(data.authorPhone || "");
    var department = data.department || "Tổ chuyên môn";
    var approver = data.approver || "Ban Giám hiệu";
    var signDate = data.signDate || new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
    var status = data.status || "ĐÃ KÝ DUYỆT & ĐÓNG DẤU";
    var note = data.note || "";
    var fileBase64 = data.fileBase64 || "";
    var fileName = data.fileName || (docId + "_" + title.replace(/[^a-zA-Z0-9]/g, "_") + ".pdf");

    var viewUrl = data.viewUrl || "";
    var downloadUrl = data.downloadUrl || "";

    if (fileBase64 && (!viewUrl || viewUrl === "")) {
      try {
        var rootFolder = getOrCreateFolderHierarchy(CONFIG.DRIVE_ROOT_FOLDER);
        var yearMonth = Utilities.formatDate(new Date(), "Asia/Ho_Chi_Minh", "yyyy/MM");
        var targetFolder = getOrCreateFolderHierarchy(CONFIG.DRIVE_ROOT_FOLDER + "/" + yearMonth);

        var decodedBytes = Utilities.base64Decode(fileBase64);
        var blob = Utilities.newBlob(decodedBytes, "application/pdf", fileName);
        var driveFile = targetFolder.createFile(blob);
        driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

        viewUrl = driveFile.getUrl();
        downloadUrl = driveFile.getDownloadUrl();
      } catch (driveErr) {
        Logger.log("Lỗi tải tệp lên Drive: " + driveErr.toString());
      }
    }

    sheet.appendRow([
      docId, title, author, authorPhone, department,
      approver, signDate, status, viewUrl, downloadUrl, note
    ]);

    return {
      success: true,
      docId: docId,
      viewUrl: viewUrl,
      downloadUrl: downloadUrl,
      message: "Luu tru bao cao thanh cong!"
    };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

function fetchReportsFromSheet(params) {
  var ss = getDatabaseSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_REPORTS);
  if (!sheet) return { total: 0, page: 1, limit: 10, data: [] };

  var data = sheet.getDataRange().getValues();
  var search = (params.search || "").toLowerCase().trim();
  var authorFilter = (params.author || "").toLowerCase().trim();
  var deptFilter = (params.dept || "").toLowerCase().trim();
  var page = parseInt(params.page || "1", 10);
  var limit = parseInt(params.limit || "10", 10);

  var filtered = [];
  for (var i = data.length - 1; i >= 1; i--) {
    var row = data[i];
    var docId = String(row[0] || "");
    var title = String(row[1] || "");
    var author = String(row[2] || "");
    var phone = String(row[3] || "");
    var department = String(row[4] || "");
    var approver = String(row[5] || "");
    var date = String(row[6] || "");
    var status = String(row[7] || "");
    var viewUrl = String(row[8] || "");
    var downloadUrl = String(row[9] || "");
    var note = String(row[10] || "");

    if (search) {
      var combined = (docId + " " + title + " " + author + " " + approver).toLowerCase();
      if (combined.indexOf(search) === -1) continue;
    }
    if (authorFilter && author.toLowerCase().indexOf(authorFilter) === -1) continue;
    if (deptFilter && department.toLowerCase().indexOf(deptFilter) === -1) continue;

    filtered.push({
      docId: docId,
      title: title,
      author: author,
      authorPhone: phone,
      department: department,
      approver: approver,
      signDate: date,
      status: status,
      viewUrl: viewUrl,
      downloadUrl: downloadUrl,
      note: note
    });
  }

  var startIndex = (page - 1) * limit;
  var paginated = filtered.slice(startIndex, startIndex + limit);

  return {
    total: filtered.length,
    page: page,
    limit: limit,
    data: paginated
  };
}

// ====================================================================================================
// 🛠️ 16. CÁC HÀM TIỆN ÍCH TRỢ GIÚP (HELPERS & NLP MATCHER ENGINE)
// ====================================================================================================
function getUnifiedWelcomeGuideText() {
  var schoolData = fetchSchoolTimetableData();
  var currentInfo = "";
  if (schoolData) {
    var active = getActiveTimetable(schoolData);
    if (active && active.weekName) {
      currentInfo = "\n📌 Đợt TKB: " + active.weekName + (active.applyDate ? " (từ " + active.applyDate + ")" : "");
    }
  }

  return "🏫 TRỢ LÝ THÔNG MINH THCS CHU VĂN AN 4.0\n" +
         "Chào mừng Quý Thầy/Cô và các em học sinh!" + currentInfo + "\n\n" +
         "📱 1. NHẬN LỊCH DẠY 6H00 SÁNG & KÝ SỐ:\n" +
         "👉 Gửi: [Số điện thoại]\n" +
         "   ↳ VD: 0818810007\n\n" +
         "🔹 2. TRA CỨU THỜI KHÓA BIỂU:\n" +
         "• tkb [Tên Lớp]\n" +
         "  ↳ VD: tkb 6a1\n" +
         "• tkb [Tên GV]\n" +
         "  ↳ VD: tkb Tý (hoặc tkb Trọng)\n" +
         "• tkb hôm nay\n" +
         "  ↳ Xem lịch dạy hôm nay\n" +
         "• tkb ngày mai\n" +
         "  ↳ Xem lịch dạy ngày mai\n\n" +
         "🔹 3. LỊCH DẠY THAY & GV TRỐNG TIẾT:\n" +
         "• day thay\n" +
         "  ↳ Xem ca phân công dạy thay\n" +
         "• tim gv t3\n" +
         "  ↳ Tìm GV rảnh tiết Thứ 3\n\n" +
         "🔹 4. HỒ SƠ & BÁO CÁO KÝ SỐ:\n" +
         "• hoso\n" +
         "  ↳ Tra cứu giáo án đã nộp\n" +
         "• baocao\n" +
         "  ↳ Cổng lưu trữ báo cáo số\n\n" +
         "🌐 Cổng TKB Online:\n" +
         CONFIG.PUBLIC_TKB_PORTAL + "\n\n" +
         "🌐 Cổng Báo Cáo Ký Số:\n" +
         CONFIG.PORTAL_URL;
}

function fetchSchoolTimetableData() {
  try {
    if (typeof CacheService !== "undefined") {
      var cache = CacheService.getScriptCache();
      var cachedStr = cache ? cache.get("CACHED_TKB_DATA") : null;
      if (cachedStr) {
        return JSON.parse(cachedStr);
      }
    }
  } catch (ce) {}

  try {
    var response = UrlFetchApp.fetch(CONFIG.FIREBASE_DATABASE_URL, { muteHttpExceptions: true });
    var text = response.getContentText();
    var data = JSON.parse(text);

    try {
      if (typeof CacheService !== "undefined") {
        var cache = CacheService.getScriptCache();
        if (cache && text.length < 100000) {
          cache.put("CACHED_TKB_DATA", text, 60);
        }
      }
    } catch (pe) {}

    return data;
  } catch (e) {
    if (typeof Logger !== "undefined") Logger.log("Lỗi tải dữ liệu Firebase: " + e.toString());
    return null;
  }
}

function getActiveTimetable(schoolData) {
  if (!schoolData) return { timetable: {}, weekName: "Đợt chính thức", applyDate: "" };
  var timetable = schoolData.timetable || {};
  var weekName = "Đợt hiện hành";
  var applyDate = schoolData.timetableApplyDate || "";

  if (schoolData.currentWeekId && schoolData.weeklyTimetables) {
    var wt = schoolData.weeklyTimetables.find(function(w) { return w && w.id === schoolData.currentWeekId; });
    if (wt && wt.timetable) {
      timetable = wt.timetable;
      weekName = wt.weekName || weekName;
      applyDate = wt.applyDate || applyDate;
    }
  }
  return { timetable: timetable, weekName: weekName, applyDate: applyDate };
}

function parseDayFilter(keyword) {
  if (!keyword) return null;
  var clean = removeVietnameseTones(keyword);
  var dayOfWeek = (new Date()).getDay();
  if (/(?:^|[^a-z0-9])(hom nay|hn|today)(?:[^a-z0-9]|$)/i.test(clean)) {
    var map = { 1: "T2", 2: "T3", 3: "T4", 4: "T5", 5: "T6", 6: "T7" };
    return map[dayOfWeek] || "T2";
  }
  if (/(?:^|[^a-z0-9])(mai|ngay mai|tomorrow)(?:[^a-z0-9]|$)/i.test(clean)) {
    var nextDay = (dayOfWeek + 1) % 7;
    var map = { 1: "T2", 2: "T3", 3: "T4", 4: "T5", 5: "T6", 6: "T7" };
    return map[nextDay] || "T2";
  }
  if (/(?:^|[^a-z0-9])(t2|thu 2|thu hai)(?:[^a-z0-9]|$)/i.test(clean)) return "T2";
  if (/(?:^|[^a-z0-9])(t3|thu 3|thu ba)(?:[^a-z0-9]|$)/i.test(clean)) return "T3";
  if (/(?:^|[^a-z0-9])(t4|thu 4|thu tu)(?:[^a-z0-9]|$)/i.test(clean)) return "T4";
  if (/(?:^|[^a-z0-9])(t5|thu 5|thu nam)(?:[^a-z0-9]|$)/i.test(clean)) return "T5";
  if (/(?:^|[^a-z0-9])(t6|thu 6|thu sau)(?:[^a-z0-9]|$)/i.test(clean)) return "T6";
  if (/(?:^|[^a-z0-9])(t7|thu 7|thu bay)(?:[^a-z0-9]|$)/i.test(clean)) return "T7";
  return null;
}

function canonicalizeVietnameseTone(str) {
  if (!str) return "";
  var s = str.normalize("NFC").toLowerCase();
  s = s.replace(/úy/g, "uý").replace(/ùy/g, "uỳ").replace(/ủy/g, "uỷ").replace(/ũy/g, "uỹ").replace(/ụy/g, "uỵ");
  s = s.replace(/óa/g, "oá").replace(/òa/g, "oà").replace(/ỏa/g, "oả").replace(/õa/g, "oã").replace(/ọa/g, "oạ");
  s = s.replace(/óe/g, "oé").replace(/òe/g, "oè").replace(/ỏe/g, "oẻ").replace(/õe/g, "oẽ").replace(/ọe/g, "oẹ");
  return s;
}

function normToken(str) {
  return removeVietnameseTones(str).replace(/[^a-z0-9]/g, "");
}

function findMatchingClass(query, classes) {
  if (!query || !classes || classes.length === 0) return null;
  var raw = query.trim();
  var clean = removeVietnameseTones(raw);

  var cleanTarget = clean;
  var prefixes = ["thoi khoa bieu", "lich day", "lich hoc", "xem tkb", "in tkb", "tkb", "lop"];
  var matchedPrefix = true;
  while (matchedPrefix) {
    matchedPrefix = false;
    for (var i = 0; i < prefixes.length; i++) {
      var p = prefixes[i];
      if (cleanTarget === p) {
        cleanTarget = "";
        matchedPrefix = true;
        break;
      } else if (cleanTarget.startsWith(p + " ")) {
        cleanTarget = cleanTarget.substring(p.length).trim();
        matchedPrefix = true;
        break;
      }
    }
  }

  cleanTarget = cleanTarget.replace(/(?:^|[^a-z0-9])(hom nay|hn|today|ngay mai|mai|tomorrow|thu \d|t\d|thu hai|thu ba|thu tu|thu nam|thu sau|thu bay)(?:[^a-z0-9]|$)/g, " ").trim();
  var targetToken = normToken(cleanTarget);
  var sortedClasses = classes.slice().sort(function(a, b) { return (b.name || "").length - (a.name || "").length; });

  if (targetToken) {
    for (var i = 0; i < sortedClasses.length; i++) {
      var c = sortedClasses[i];
      if (c && normToken(c.name) === targetToken) {
        return c;
      }
    }
  }

  var queryTokens = clean.split(/[^a-z0-9]+/).filter(Boolean);
  for (var i = 0; i < sortedClasses.length; i++) {
    var c = sortedClasses[i];
    if (c && queryTokens.indexOf(removeVietnameseTones(c.name)) !== -1) {
      return c;
    }
  }

  for (var i = 0; i < sortedClasses.length; i++) {
    var c = sortedClasses[i];
    if (c && c.name) {
      var cClean = removeVietnameseTones(c.name);
      var regex = new RegExp("(?:^|[^a-z0-9])" + cClean + "(?:[^a-z0-9]|$)", "i");
      if (regex.test(clean)) {
        return c;
      }
    }
  }

  return null;
}

function findMatchingTeacher(rawQuery, teachers) {
  if (!rawQuery || !teachers || teachers.length === 0) return null;
  var text = rawQuery.trim();
  var clean = removeVietnameseTones(text);

  var cleanTarget = clean;
  var prefixes = ["thoi khoa bieu", "lich day", "lich hoc", "xem tkb", "in tkb", "tkb", "thay", "co", "gv"];
  var matchedPrefix = true;
  while (matchedPrefix) {
    matchedPrefix = false;
    for (var i = 0; i < prefixes.length; i++) {
      var p = prefixes[i];
      if (cleanTarget === p) {
        cleanTarget = "";
        matchedPrefix = true;
        break;
      } else if (cleanTarget.startsWith(p + " ")) {
        cleanTarget = cleanTarget.substring(p.length).trim();
        matchedPrefix = true;
        break;
      }
    }
  }

  cleanTarget = cleanTarget.replace(/(?:^|[^a-z0-9])(hom nay|hn|today|ngay mai|mai|tomorrow|thu \d|t\d|thu hai|thu ba|thu tu|thu nam|thu sau|thu bay)(?:[^a-z0-9]|$)/g, " ").trim();
  var targetCanon = canonicalizeVietnameseTone(cleanTarget).replace(/[^a-z0-9à-ỹ]/g, "");
  var targetToken = normToken(cleanTarget);

  // 1. Khớp chính xác shortName
  for (var i = 0; i < teachers.length; i++) {
    var t = teachers[i];
    if (t && t.shortName) {
      var tCanon = canonicalizeVietnameseTone(t.shortName).replace(/[^a-z0-9à-ỹ]/g, "");
      if (tCanon && tCanon === targetCanon) return t;
    }
  }

  // 2. Khớp chính xác fullName
  for (var i = 0; i < teachers.length; i++) {
    var t = teachers[i];
    if (t && t.fullName) {
      var tCanon = canonicalizeVietnameseTone(t.fullName).replace(/[^a-z0-9à-ỹ]/g, "");
      if (tCanon && tCanon === targetCanon) return t;
    }
  }

  // 3. Khớp token
  if (targetToken) {
    var shortMatches = teachers.filter(function(t) { return t && t.shortName && normToken(t.shortName) === targetToken; });
    if (shortMatches.length === 1) return shortMatches[0];
    if (shortMatches.length > 1) {
      var exactCanon = shortMatches.find(function(t) { return canonicalizeVietnameseTone(t.shortName).replace(/[^a-z0-9à-ỹ]/g, "") === targetCanon; });
      if (exactCanon) return exactCanon;
      return shortMatches[0];
    }

    var fullMatches = teachers.filter(function(t) { return t && t.fullName && normToken(t.fullName) === targetToken; });
    if (fullMatches.length === 1) return fullMatches[0];
    if (fullMatches.length > 1) {
      var exactCanon = fullMatches.find(function(t) { return canonicalizeVietnameseTone(t.fullName).replace(/[^a-z0-9à-ỹ]/g, "") === targetCanon; });
      if (exactCanon) return exactCanon;
      return fullMatches[0];
    }
  }

  // 4. Khớp shortName với ranh giới từ
  var sortedByShort = teachers.slice().sort(function(a, b) { return (b.shortName || "").length - (a.shortName || "").length; });
  for (var i = 0; i < sortedByShort.length; i++) {
    var t = sortedByShort[i];
    if (!t || !t.shortName) continue;
    var sClean = removeVietnameseTones(t.shortName);
    var sPattern = sClean.replace(/\./g, "[._\\s]?");
    var regex = new RegExp("(?:^|[^a-z0-9])" + sPattern + "(?:[^a-z0-9]|$)", "i");
    if (regex.test(clean)) return t;
  }

  // 5. Khớp fullName với ranh giới từ
  var sortedByFull = teachers.slice().sort(function(a, b) { return (b.fullName || "").length - (a.fullName || "").length; });
  for (var i = 0; i < sortedByFull.length; i++) {
    var t = sortedByFull[i];
    if (!t || !t.fullName) continue;
    var fClean = removeVietnameseTones(t.fullName);
    if (fClean.length >= 4) {
      var regex = new RegExp("(?:^|[^a-z0-9])" + fClean.replace(/\s+/g, "\\s+") + "(?:[^a-z0-9]|$)", "i");
      if (regex.test(clean)) return t;
    }
  }

  return null;
}

function getHomeroomTeacher(classObj, timetable, assignments, teachers) {
  if (!classObj) return null;
  if (classObj.gvcn && classObj.gvcn.trim()) {
    var rawGv = classObj.gvcn.trim();
    var t = teachers ? teachers.find(function(x) { return x && (x.shortName === rawGv || x.fullName === rawGv); }) : null;
    return t ? (t.fullName + " (" + t.shortName + ")") : rawGv;
  }

  var className = classObj.name;
  var gvShort = "";
  var clsSchedule = (timetable && timetable[className]) ? timetable[className] : {};
  var days = ["T2", "T3", "T4", "T5", "T6", "T7"];

  for (var d = 0; d < days.length; d++) {
    var daySlots = clsSchedule[days[d]] || {};
    for (var p = 1; p <= 5; p++) {
      var slot = daySlots[p];
      if (slot && slot.teacher && slot.subject) {
        var sub = slot.subject.toLowerCase();
        if (sub.includes("shl") || sub.includes("sinh hoat") || sub.includes("hdtn")) {
          gvShort = slot.teacher;
          break;
        }
      }
    }
    if (gvShort) break;
  }

  if (!gvShort) return null;
  var tObj = teachers ? teachers.find(function(x) { return x && x.shortName === gvShort; }) : null;
  return tObj ? (tObj.fullName + " (" + tObj.shortName + ")") : gvShort;
}

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
  if (!ss) return null;
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
  if (clean.length === 9 && !clean.startsWith("0")) {
    clean = "0" + clean;
  }
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
  return str.toLowerCase().trim();
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

// Hỗ trợ xuất Module để chạy kiểm thử tự động trên môi trường Node.js
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    CONFIG: CONFIG,
    normalizePhone: normalizePhone,
    removeVietnameseTones: removeVietnameseTones,
    canonicalizeVietnameseTone: canonicalizeVietnameseTone,
    parseDayFilter: parseDayFilter,
    findMatchingClass: findMatchingClass,
    findMatchingTeacher: findMatchingTeacher,
    getHomeroomTeacher: getHomeroomTeacher,
    getActiveTimetable: getActiveTimetable,
    formatPeriodTime: formatPeriodTime,
    formatTeacherTimetableResponse: formatTeacherTimetableResponse,
    formatClassTimetableResponse: formatClassTimetableResponse,
    generateMorningTeacherMessage: generateMorningTeacherMessage,
    generateTomorrowTeacherMessage: generateTomorrowTeacherMessage,
    findNextTeachingSession: findNextTeachingSession,
    testSendTomorrowSchedule: testSendTomorrowSchedule,
    getUnifiedWelcomeGuideText: getUnifiedWelcomeGuideText,
    handleNaturalTimetableQuery: handleNaturalTimetableQuery,
    handleSubstitutionQuery: handleSubstitutionQuery,
    handleFindFreeTeacherQuery: handleFindFreeTeacherQuery,
    handleNewTimetableAnnouncement: handleNewTimetableAnnouncement,
    processUnifiedZaloMessage: processUnifiedZaloMessage,
    handleEduSignNotification: handleEduSignNotification
  };
}
