const assert = require('assert');
const path = require('path');

// Setup mock environment
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
  log: function(...args) { console.log("   [LOGGER]", ...args); }
};

global.Utilities = {
  formatDate: (d) => `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`,
  sleep: () => {}
};

let mockUsers = [
  ["STT", "Họ và Tên", "Số Điện Thoại", "Tổ Chuyên Môn", "Email Công Vụ", "Zalo_Chat_ID", "Ngày Liên Kết", "Tên_Viết_Tắt_TKB"]
];

global.SpreadsheetApp = {
  openById: () => ({
    getSheetByName: () => ({
      getDataRange: () => ({
        getValues: () => {
          console.log("   [DEBUG getValues] count =", mockUsers.length);
          return mockUsers;
        }
      })
    })
  })
};

let fetchResult = null;
let fetchThrows = null;

global.UrlFetchApp = {
  fetch: () => {
    if (fetchThrows) throw fetchThrows;
    return fetchResult;
  }
};

const gasBot = require('../../google-apps-script-zalo-edusign.js');

console.log("================================================================================");
console.log(" 🧪 ADVERSARIAL STRESS TEST SUITE - REVIEWER CRITIC");
console.log("================================================================================\n");

let passed = 0;
let failed = 0;

function stress(name, fn) {
  try {
    fn();
    console.log(`  ✅ [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}:`, err.message);
    failed++;
  }
}

// 1. Stress removeOldTriggers with malformed triggers array
stress("removeOldTriggers handles trigger objects missing getHandlerFunction or throwing", () => {
  mockTriggers = [
    null,
    {},
    { getHandlerFunction: null },
    { getHandlerFunction: () => { throw new Error("Trigger corrupted"); } },
    { getHandlerFunction: () => "sendDailyMorningPersonalSchedule" }
  ];
  // Should delete only the valid one, ignore others gracefully
  const count = gasBot.removeOldTriggers("sendDailyMorningPersonalSchedule");
  assert.strictEqual(count, 1, "Should delete exactly 1 matching trigger");
});

// 2. Stress setupMorningBriefGroupTrigger with whitespace or null
stress("setupMorningBriefGroupTrigger rejects empty strings, tabs, newlines", () => {
  gasBot.CONFIG.MORNING_BRIEF_CHAT_ID = "";
  assert.strictEqual(gasBot.setupMorningBriefGroupTrigger("   ").success, false);
  assert.strictEqual(gasBot.setupMorningBriefGroupTrigger("\t\n").success, false);
  assert.strictEqual(gasBot.setupMorningBriefGroupTrigger(null).success, false);
  assert.strictEqual(gasBot.setupMorningBriefGroupTrigger(undefined).success, false);
});

// 3. Stress generateMorningSchoolBriefMessage with null/empty items in data
stress("generateMorningSchoolBriefMessage handles empty/null classes, substitutions, active timetable", () => {
  const resultNull = gasBot.generateMorningSchoolBriefMessage(null, "T2", "Thứ Hai", "15/09/2026");
  assert.strictEqual(resultNull, null);

  const emptyData = { classes: null, substitutions: null, weeklyTimetables: [] };
  const resEmpty = gasBot.generateMorningSchoolBriefMessage(emptyData, "T2", "Thứ Hai", "15/09/2026");
  assert.ok(resEmpty);
  assert.ok(resEmpty.includes("0 lớp học (Không có)"));
  assert.ok(resEmpty.includes("không có ca dạy thay"));

  const corruptClasses = {
    classes: [null, undefined, {}, { name: "7A1", session: null }],
    substitutions: [null, undefined, {}, { date: "15/09/2026", day: "T2", period: 1, className: "7A1", originalTeacher: "A", substituteTeacher: "B" }]
  };
  const resCorrupt = gasBot.generateMorningSchoolBriefMessage(corruptClasses, "T2", "Thứ Hai", "15/09/2026");
  assert.ok(resCorrupt);
  assert.ok(resCorrupt.includes("PHÂN CÔNG DẠY THAY HÔM NAY (1 ca)"));
});

// 4. Stress generateMorningTeacherMessage when teacher has NO teaching slots
stress("generateMorningTeacherMessage returns null when teacher has zero periods to avoid spamming", () => {
  const teacher = { fullName: "Trần Văn Nam", shortName: "Nam" };
  const schoolData = { classes: [], weeklyTimetables: [], substitutions: [] };
  const msg = gasBot.generateMorningTeacherMessage(teacher, schoolData, "T2", "Thứ Hai", "15/09/2026");
  assert.strictEqual(msg, null);
});

// 5. Stress getSessionSpan with unknown session
stress("getSessionSpan handles unexpected inputs gracefully", () => {
  assert.strictEqual(gasBot.getSessionSpan("sáng"), "07:00 - 11:15");
  assert.strictEqual(gasBot.getSessionSpan("SÁNG"), "07:00 - 11:15");
  assert.strictEqual(gasBot.getSessionSpan("chiều"), "12:45 - 17:00");
  assert.strictEqual(gasBot.getSessionSpan("CHIỀU"), "12:45 - 17:00");
  assert.strictEqual(gasBot.getSessionSpan("tối"), "07:00 - 11:15"); // fallback
  assert.strictEqual(gasBot.getSessionSpan(null), "07:00 - 11:15"); // fallback
});

// 6. Stress fetchSchoolTimetableData with 500 error, 401, 301, and empty JSON object
stress("fetchSchoolTimetableData status code boundary checks", () => {
  // Status 200 with {} -> returns {}
  fetchResult = { getResponseCode: () => 200, getContentText: () => "{}" };
  const r200 = gasBot.fetchSchoolTimetableData();
  assert.deepStrictEqual(r200, {});

  // Status 299 -> returns {}
  fetchResult = { getResponseCode: () => 299, getContentText: () => "{\"ok\":true}" };
  assert.deepStrictEqual(gasBot.fetchSchoolTimetableData(), { ok: true });

  // Status 301 redirect without follow -> returns null
  fetchResult = { getResponseCode: () => 301, getContentText: "Moved" };
  assert.strictEqual(gasBot.fetchSchoolTimetableData(), null);

  // Status 401 -> returns null
  fetchResult = { getResponseCode: () => 401, getContentText: "Unauthorized" };
  assert.strictEqual(gasBot.fetchSchoolTimetableData(), null);

  // Status 500 -> returns null
  fetchResult = { getResponseCode: () => 500, getContentText: "Internal Error" };
  assert.strictEqual(gasBot.fetchSchoolTimetableData(), null);
});

// 7. Stress all 7 days of the week in sendDailyMorningPersonalSchedule
stress("sendDailyMorningPersonalSchedule tests Sunday skip vs Weekday run", () => {
  const origDate = global.Date;
  gasBot.CONFIG.SPREADSHEET_ID = "mock_sheet_id";

  // Day 0: Sunday
  global.Date = class extends origDate {
    constructor(...args) {
      if (args.length === 0) super(2026, 8, 13); // Sunday
      else super(...args);
    }
  };
  const sunRes = gasBot.sendDailyMorningPersonalSchedule();
  assert.strictEqual(sunRes.status, "sunday_skip");

  // Day 1 to 6: Monday to Saturday
  for (let dayOffset = 14; dayOffset <= 19; dayOffset++) {
    global.Date = class extends origDate {
      constructor(...args) {
        if (args.length === 0) super(2026, 8, dayOffset);
        else super(...args);
      }
    };
    fetchResult = { getResponseCode: () => 200, getContentText: () => "{\"classes\":[]}" };
    const weekdayRes = gasBot.sendDailyMorningPersonalSchedule();
    if (weekdayRes.status === "error") {
      console.log("DEBUG weekdayRes.error:", weekdayRes.error);
    }
    // With empty users sheet, should return empty_users
    assert.strictEqual(weekdayRes.status, "empty_users");
  }

  global.Date = origDate;
});

// 8. Stress Rate-limit delay between teachers
stress("sendDailyMorningPersonalSchedule rate-limiting sleep is invoked", () => {
  let sleepCount = 0;
  global.Utilities.sleep = (ms) => {
    assert.strictEqual(ms, 150, "Sleep duration should be 150ms");
    sleepCount++;
  };

  mockUsers = [
    ["STT", "Họ và Tên", "Số Điện Thoại", "Tổ Chuyên Môn", "Email Công Vụ", "Zalo_Chat_ID", "Ngày Liên Kết", "Tên_Viết_Tắt_TKB"],
    [1, "Giáo Viên 1", "0900000001", "Toán", "gv1@edu.vn", "chat1", "01/09/2026", "GV1"],
    [2, "Giáo Viên 2", "0900000002", "Toán", "gv2@edu.vn", "chat2", "01/09/2026", "GV2"]
  ];

  const origDate = global.Date;
  global.Date = class extends origDate {
    constructor(...args) {
      if (args.length === 0) super(2026, 8, 14); // Monday
      else super(...args);
    }
  };

  fetchResult = {
    getResponseCode: () => 200,
    getContentText: () => JSON.stringify({
      currentWeekId: "w1",
      classes: [{ name: "6A1", session: "sáng" }],
      teachers: [
        { fullName: "Giáo Viên 1", shortName: "GV1" },
        { fullName: "Giáo Viên 2", shortName: "GV2" }
      ],
      weeklyTimetables: [{
        id: "w1",
        timetable: {
          "6A1": {
            "T2": {
              1: { subject: "Toán", teacher: "GV1" },
              2: { subject: "Toán", teacher: "GV2" }
            }
          }
        }
      }],
      substitutions: []
    })
  };

  // Mock sendZaloBotReply
  let sendCount = 0;
  global.UrlFetchApp.fetch = (url, options) => {
    if (url.includes("zaloplatforms.com") || url.includes("zalo.me") || url.includes("webhook")) {
      sendCount++;
      return { getResponseCode: () => 200, getContentText: () => "{\"error\":0}" };
    }
    return fetchResult;
  };

  const td = JSON.parse(fetchResult.getContentText());
  console.log("   [DEBUG Test 8] findMatchingTeacher:", gasBot.findMatchingTeacher("GV1", td.teachers));
  const tMsg = gasBot.generateMorningTeacherMessage(td.teachers[0], td, "T2", "Thứ Hai", "14/09/2026");
  console.log("   [DEBUG Test 8] generateMorningTeacherMessage:", tMsg);

  const res = gasBot.sendDailyMorningPersonalSchedule();
  console.log("DEBUG Test 8 result:", res);
  assert.strictEqual(res.status, "success");
  assert.strictEqual(res.sentCount, 2);
  assert.strictEqual(sleepCount, 2, "Sleep should be called for each teacher message sent");

  global.Date = origDate;
});

console.log("\n================================================================================");
console.log(`🎉 ADVERSARIAL STRESS TEST SUMMARY: ${passed} PASS, ${failed} FAIL`);
console.log("================================================================================\n");

if (failed > 0) process.exit(1);
