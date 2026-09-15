/**
 * ====================================================================================================
 * 🧪 VERIFICATION TEST SUITE: ZALO MORNING SCHEDULE REMINDER & GAS TRIGGERS (MILESTONE 3)
 * ====================================================================================================
 * System: EduSign VGCA - Zalo Schedule Integration & Morning Brief Engine
 * File: tests/test_zalo_morning_schedule_m3.js
 * Verification Objectives:
 * 1. setupDailyMorningTrigger() & removeOldTriggers() deduplication & 06:00 AM configuration
 * 2. setupMorningBriefGroupTrigger() & sendMorningBriefGroup() group brief configuration
 * 3. Class period timetable accuracy (07:00-11:15 sáng, 12:45-17:00 chiều) & substitution separation
 * 4. Fault tolerance: Firebase downtime, network timeouts, null bodies, HTTP errors handled gracefully
 * ====================================================================================================
 */

const assert = require('assert');
const path = require('path');

// -----------------------------------------------------------------------------
// GAS MOCK ENVIRONMENT FOR TESTING
// -----------------------------------------------------------------------------
let mockTriggers = [];

class MockTriggerBuilder {
  constructor(fnName) {
    this.fnName = fnName;
    this.timeBasedObj = null;
  }
  timeBased() {
    this.timeBasedObj = {
      everyDaysVal: 1,
      atHourVal: 6,
      everyDays: (n) => { this.timeBasedObj.everyDaysVal = n; return this.timeBasedObj; },
      atHour: (h) => { this.timeBasedObj.atHourVal = h; return this.timeBasedObj; },
      create: () => {
        const triggerInstance = {
          getHandlerFunction: () => this.fnName,
          getTriggerSource: () => "CLOCK",
          _config: {
            handler: this.fnName,
            everyDays: this.timeBasedObj.everyDaysVal,
            atHour: this.timeBasedObj.atHourVal
          }
        };
        mockTriggers.push(triggerInstance);
        return triggerInstance;
      }
    };
    return this.timeBasedObj;
  }
}

global.ScriptApp = {
  getProjectTriggers: () => mockTriggers.slice(),
  deleteTrigger: (trig) => {
    const idx = mockTriggers.indexOf(trig);
    if (idx !== -1) mockTriggers.splice(idx, 1);
  },
  newTrigger: (fnName) => new MockTriggerBuilder(fnName)
};

global.Logger = {
  log: function(...args) { /* silent or debug */ }
};

global.Utilities = {
  formatDate: function(d, tz, fmt) {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  },
  sleep: function(ms) {}
};

// Spreadsheet Mock
let mockUsersSheetData = [
  ["STT", "Họ và Tên", "Số Điện Thoại", "Tổ Chuyên Môn", "Email Công Vụ", "Zalo_Chat_ID", "Ngày Liên Kết", "Tên_Viết_Tắt_TKB"],
  [1, "Hà Văn Tý", "0912345678", "Tổ Toán - Tin", "cva.ty@thcschuvanan.edu.vn", "chat_ty", "10/09/2026", "Tý"],
  [2, "Nguyễn Đức Trọng", "0818810007", "Tổ Toán - Tin", "cva.trong@thcschuvanan.edu.vn", "chat_trong", "10/09/2026", "Trọng"],
  [3, "Trần Văn Nam", "0987654321", "Tổ Toán - Tin", "tvnam@thcschuvanan.edu.vn", "", "", "Nam"]
];

global.SpreadsheetApp = {
  openById: (id) => ({
    getSheetByName: (name) => {
      if (name === "Danh bạ GV") {
        return {
          getDataRange: () => ({
            getValues: () => mockUsersSheetData
          })
        };
      }
      return null;
    }
  })
};

let simulatedFetchResponse = null;
let simulatedFetchError = null;

global.UrlFetchApp = {
  fetch: (url, options) => {
    if (simulatedFetchError) {
      throw simulatedFetchError;
    }
    return simulatedFetchResponse;
  }
};

const gasBot = require('../google-apps-script-zalo-edusign.js');

console.log("================================================================================");
console.log(" 🧪 BẮT ĐẦU KIỂM THỬ ZALO MORNING SCHEDULE & GAS TRIGGERS (MILESTONE 3)");
console.log("================================================================================\n");

let passed = 0;
let failed = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`  ✅ [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}:`, err.message);
    failed++;
  }
}

// -----------------------------------------------------------------------------
// MOCK DATA FOR TKB
// -----------------------------------------------------------------------------
const mockClasses = [
  { name: "6A1", session: "sáng", gvcn: "Hà Văn Tý" },
  { name: "9B1", session: "chiều", gvcn: "Nguyễn Đức Trọng" }
];

const mockTeachers = [
  { fullName: "Nguyễn Đức Trọng", shortName: "Trọng", group: "Toán - Tin" },
  { fullName: "Hà Văn Tý", shortName: "Tý", group: "Toán - Tin" },
  { fullName: "Trần Văn Nam", shortName: "Nam", group: "Toán - Tin" }
];

const mockSchoolData = {
  timetableApplyDate: "01/09/2026",
  currentWeekId: "w1",
  weeklyTimetables: [
    {
      id: "w1",
      weekName: "Đợt 1 - Học kỳ I",
      applyDate: "01/09/2026",
      timetable: {
        "6A1": {
          "T2": {
            1: { subject: "Chào cờ", teacher: "Tý" },
            2: { subject: "Toán", teacher: "Tý" }
          },
          "T3": {
            1: { subject: "Toán", teacher: "Trọng" }
          }
        },
        "9B1": {
          "T3": {
            1: { subject: "Toán", teacher: "Trọng" }
          }
        }
      }
    }
  ],
  classes: mockClasses,
  teachers: mockTeachers,
  substitutions: [
    {
      date: "Hôm nay",
      day: "T3",
      period: 2,
      className: "6A1",
      subject: "Toán",
      originalTeacher: "Tý",
      substituteTeacher: "Trọng",
      note: "Thầy Tý đi công tác"
    }
  ]
};

// -----------------------------------------------------------------------------
// 1. TRIGGER SETUP & DEDUPLICATION (removeOldTriggers & setupDailyMorningTrigger)
// -----------------------------------------------------------------------------
console.log("👉 1. Kiểm thử Quản lý Trigger & Chống Spam Lặp Lịch:");

runTest("removeOldTriggers dọn dẹp chính xác trigger theo tên hàm", () => {
  mockTriggers = [
    { getHandlerFunction: () => "sendDailyMorningPersonalSchedule" },
    { getHandlerFunction: () => "sendDailyMorningPersonalSchedule" },
    { getHandlerFunction: () => "otherFunction" }
  ];
  const deleted = gasBot.removeOldTriggers("sendDailyMorningPersonalSchedule");
  assert.strictEqual(deleted, 2);
  assert.strictEqual(mockTriggers.length, 1);
  assert.strictEqual(mockTriggers[0].getHandlerFunction(), "otherFunction");
});

runTest("setupDailyMorningTrigger tạo trigger 06:00 sáng và dọn dẹp trigger cũ", () => {
  mockTriggers = [
    { getHandlerFunction: () => "sendDailyMorningPersonalSchedule" }
  ];
  const trig = gasBot.setupDailyMorningTrigger();
  assert.ok(trig, "Trigger phải được tạo");
  assert.strictEqual(trig._config.handler, "sendDailyMorningPersonalSchedule");
  assert.strictEqual(trig._config.atHour, 6, "Trigger phải được đặt lúc 6 giờ sáng");
  assert.strictEqual(trig._config.everyDays, 1, "Trigger phải lặp lại mỗi ngày");

  // Đảm bảo không còn trigger trùng lặp: chỉ có duy nhất 1 trigger
  assert.strictEqual(mockTriggers.length, 1);
});

runTest("Gọi setupDailyMorningTrigger nhiều lần không gây duplicate triggers", () => {
  gasBot.setupDailyMorningTrigger();
  gasBot.setupDailyMorningTrigger();
  gasBot.setupDailyMorningTrigger();
  assert.strictEqual(mockTriggers.length, 1, "Sau nhiều lần gọi chỉ được phép tồn tại 1 trigger");
});

// -----------------------------------------------------------------------------
// 2. SETUP MORNING BRIEF GROUP TRIGGER
// -----------------------------------------------------------------------------
console.log("\n👉 2. Kiểm thử Trigger Bản Tin Nhóm Zalo (setupMorningBriefGroupTrigger):");

runTest("setupMorningBriefGroupTrigger báo lỗi an toàn khi chưa có MORNING_BRIEF_CHAT_ID", () => {
  const origId = gasBot.CONFIG.MORNING_BRIEF_CHAT_ID;
  gasBot.CONFIG.MORNING_BRIEF_CHAT_ID = "";
  const res = gasBot.setupMorningBriefGroupTrigger();
  assert.strictEqual(res.success, false);
  assert.strictEqual(res.error, "MISSING_GROUP_CHAT_ID");
  gasBot.CONFIG.MORNING_BRIEF_CHAT_ID = origId;
});

runTest("setupMorningBriefGroupTrigger thiết lập thành công khi truyền chatId hợp lệ", () => {
  const testChatId = "group_cva_thcs_general";
  const res = gasBot.setupMorningBriefGroupTrigger(testChatId);
  assert.strictEqual(res.success, true);
  assert.ok(res.trigger);
  assert.strictEqual(res.trigger._config.handler, "sendMorningBriefGroup");
  assert.strictEqual(res.trigger._config.atHour, 6);
  assert.strictEqual(res.chatId, testChatId);
});

// -----------------------------------------------------------------------------
// 3. TIMETABLE PERIODS & RICH FORMATTING
// -----------------------------------------------------------------------------
console.log("\n👉 3. Kiểm thử Khung Giờ Ca Học & Tách Biệt Tiết Chính Khóa / Dạy Thay:");

runTest("Khung giờ tiết 1-5 buổi sáng (07h00-11h05) và tổng ca (07:00-11:15)", () => {
  assert.strictEqual(gasBot.formatPeriodTime("sáng", 1), "07h00 - 07h45");
  assert.strictEqual(gasBot.formatPeriodTime("sáng", 2), "07h50 - 08h35");
  assert.strictEqual(gasBot.formatPeriodTime("sáng", 3), "08h40 - 09h25");
  assert.strictEqual(gasBot.formatPeriodTime("sáng", 4), "09h30 - 10h15");
  assert.strictEqual(gasBot.formatPeriodTime("sáng", 5), "10h20 - 11h05");
  assert.strictEqual(gasBot.getSessionSpan("sáng"), "07:00 - 11:15");
});

runTest("Khung giờ tiết 1-5 buổi chiều (13h00-17h05) và tổng ca (12:45-17:00)", () => {
  assert.strictEqual(gasBot.formatPeriodTime("chiều", 1), "13h00 - 13h45");
  assert.strictEqual(gasBot.formatPeriodTime("chiều", 2), "13h50 - 14h35");
  assert.strictEqual(gasBot.formatPeriodTime("chiều", 3), "14h40 - 15h25");
  assert.strictEqual(gasBot.formatPeriodTime("chiều", 4), "15h30 - 16h15");
  assert.strictEqual(gasBot.formatPeriodTime("chiều", 5), "16h20 - 17h05");
  assert.strictEqual(gasBot.getSessionSpan("chiều"), "12:45 - 17:00");
});

runTest("Bản tin nhóm toàn trường hiển thị ca sáng/chiều và danh sách dạy thay rõ ràng", () => {
  const brief = gasBot.generateMorningSchoolBriefMessage(mockSchoolData, "T3", "Thứ Ba", "15/09/2026");
  assert.ok(brief);
  assert.ok(brief.includes("BẢN TIN THỜI KHÓA BIỂU TOÀN TRƯỜNG (*Thứ Ba* - 15/09/2026)"));
  assert.ok(brief.includes("Buổi Sáng (07:00 - 11:15)"));
  assert.ok(brief.includes("Buổi Chiều (12:45 - 17:00)"));
  assert.ok(brief.includes("PHÂN CÔNG DẠY THAY HÔM NAY (1 ca)"));
  assert.ok(brief.includes("GV vắng: Tý"));
  assert.ok(brief.includes("GV DẠY THAY: *Trọng*"));
});

runTest("Bản tin nhóm khi không có ca dạy thay hiển thị thông báo chính khóa chuẩn", () => {
  const noSubData = { ...mockSchoolData, substitutions: [] };
  const brief = gasBot.generateMorningSchoolBriefMessage(noSubData, "T2", "Thứ Hai", "14/09/2026");
  assert.ok(brief);
  assert.ok(brief.includes("DẠY THAY: ✨ Toàn trường thực hiện đúng TKB chính khóa, không có ca dạy thay."));
});

runTest("Lịch cá nhân giáo viên bóc tách rõ tiết chính khóa và ca dạy thay", () => {
  const teacherTrong = mockTeachers[0];
  const msg = gasBot.generateMorningTeacherMessage(teacherTrong, mockSchoolData, "T3", "Thứ Ba", "15/09/2026");
  assert.ok(msg);
  assert.ok(msg.includes("🌅 Sáng (1 tiết)"));
  assert.ok(msg.includes("Tiết 1 (07h00-07h45): Toán - 6A1"));
  assert.ok(msg.includes("🌇 Chiều (1 tiết)"));
  assert.ok(msg.includes("Tiết 1 (13h00-13h45): Toán - 9B1"));
  assert.ok(msg.includes("CA DẠY THAY TRONG NGÀY:"));
  assert.ok(msg.includes("Dạy thay cho GV Tý"));
});

// -----------------------------------------------------------------------------
// 4. FAULT TOLERANCE & EXCEPTION HANDLING
// -----------------------------------------------------------------------------
console.log("\n👉 4. Kiểm thử Khả Năng Chống Lỗi (Fault Tolerance & Firebase Safeguards):");

runTest("fetchSchoolTimetableData xử lý an toàn khi mất mạng hoặc Firebase throw exception", () => {
  simulatedFetchError = new Error("ENOTFOUND: tkb-fet-default-rtdb.asia-southeast1.firebasedatabase.app");
  const result = gasBot.fetchSchoolTimetableData();
  assert.strictEqual(result, null, "Khi gặp lỗi mạng, hàm phải trả về null an toàn, không được throw unhandled error");
  simulatedFetchError = null;
});

runTest("fetchSchoolTimetableData xử lý an toàn khi Firebase trả về HTTP 404 hoặc 500", () => {
  simulatedFetchResponse = {
    getResponseCode: () => 503,
    getContentText: () => "Service Unavailable"
  };
  const result = gasBot.fetchSchoolTimetableData();
  assert.strictEqual(result, null, "Khi Firebase trả về mã lỗi 503, phải trả về null an toàn");
});

runTest("fetchSchoolTimetableData xử lý an toàn khi Firebase trả về chuỗi null hoặc rỗng", () => {
  simulatedFetchResponse = {
    getResponseCode: () => 200,
    getContentText: () => "null"
  };
  const result = gasBot.fetchSchoolTimetableData();
  assert.strictEqual(result, null);

  simulatedFetchResponse = {
    getResponseCode: () => 200,
    getContentText: () => ""
  };
  const resultEmpty = gasBot.fetchSchoolTimetableData();
  assert.strictEqual(resultEmpty, null);
});

runTest("fetchSchoolTimetableData xử lý an toàn khi Firebase trả về JSON hỏng", () => {
  simulatedFetchResponse = {
    getResponseCode: () => 200,
    getContentText: () => "{ malformed_json: true, "
  };
  const result = gasBot.fetchSchoolTimetableData();
  assert.strictEqual(result, null, "JSON hỏng phải được bắt bằng try/catch và trả về null");
});

runTest("sendDailyMorningPersonalSchedule không crash khi Firebase offline", () => {
  simulatedFetchError = new Error("ETIMEDOUT: Connection timed out after 30000ms");
  
  // Giả lập ngày làm việc (Thứ Hai = 1)
  const origDate = global.Date;
  global.Date = class extends origDate {
    constructor(...args) {
      if (args.length === 0) {
        super(2026, 8, 14); // Thứ Hai 14/09/2026
      } else {
        super(...args);
      }
    }
  };

  const status = gasBot.sendDailyMorningPersonalSchedule();
  assert.strictEqual(status.status, "error");
  assert.strictEqual(status.error, "NO_TKB_DATA");

  global.Date = origDate;
  simulatedFetchError = null;
});

runTest("sendMorningBriefGroup không crash khi Firebase offline", () => {
  simulatedFetchError = new Error("ECONNREFUSED");
  gasBot.CONFIG.MORNING_BRIEF_CHAT_ID = "group_123";

  const origDate = global.Date;
  global.Date = class extends origDate {
    constructor(...args) {
      if (args.length === 0) {
        super(2026, 8, 14); // Thứ Hai
      } else {
        super(...args);
      }
    }
  };

  const status = gasBot.sendMorningBriefGroup();
  assert.strictEqual(status.status, "error");
  assert.strictEqual(status.error, "NO_TKB_DATA");

  global.Date = origDate;
  simulatedFetchError = null;
  gasBot.CONFIG.MORNING_BRIEF_CHAT_ID = "";
});

runTest("Chủ Nhật tự động bỏ qua (sunday_skip) cả lịch cá nhân lẫn bản tin nhóm", () => {
  // Giả lập ngày Chủ Nhật (getDay() === 0)
  const origDate = global.Date;
  global.Date = class extends origDate {
    constructor(...args) {
      if (args.length === 0) {
        super(2026, 8, 13); // Chủ Nhật 13/09/2026
      } else {
        super(...args);
      }
    }
  };

  const personalStatus = gasBot.sendDailyMorningPersonalSchedule();
  assert.strictEqual(personalStatus.status, "sunday_skip");

  gasBot.CONFIG.MORNING_BRIEF_CHAT_ID = "group_123";
  const groupStatus = gasBot.sendMorningBriefGroup();
  assert.strictEqual(groupStatus.status, "sunday_skip");

  global.Date = origDate;
  gasBot.CONFIG.MORNING_BRIEF_CHAT_ID = "";
});

console.log("\n================================================================================");
console.log(`🎉 KẾT QUẢ KIỂM THỬ: ${passed} PASS, ${failed} FAIL`);
console.log("================================================================================\n");

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
