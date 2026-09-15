/**
 * ====================================================================================================
 * ⚔️ EMPIRICAL ADVERSARIAL STRESS TEST: REQUIREMENT 1 (PHONE & PIN DATA INTEGRITY & ZALO BOT)
 * ====================================================================================================
 * System: EduSign VGCA Digital Signing Platform - THCS Chu Văn An
 * Target: google-apps-script-zalo-edusign.js
 * Runner: Node.js Standalone (node .agents/challenger_r1/stress_test_phone_pin.js)
 * Standard: Genuine Empirical Testing, Zero Guesswork, Comprehensive Evidence Chain
 * ====================================================================================================
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const vm = require('vm');

const PROJECT_ROOT = fs.existsSync(path.join(__dirname, '..', '..', 'google-apps-script-zalo-edusign.js'))
  ? path.resolve(__dirname, '..', '..')
  : (fs.existsSync(path.join(__dirname, '..', 'google-apps-script-zalo-edusign.js'))
    ? path.resolve(__dirname, '..')
    : path.resolve(__dirname));

const GAS_SCRIPT_PATH = path.join(PROJECT_ROOT, 'google-apps-script-zalo-edusign.js');

console.log("================================================================================");
console.log(" ⚔️ [CHALLENGER 1] ADVERSARIAL STRESS TEST: R1 PHONE & PIN INTEGRITY & ZALO BOT ");
console.log("    Path: " + GAS_SCRIPT_PATH);
console.log("================================================================================\n");

// Initial mock sheet data
let mockUsersSheetData = [
  ["STT", "Họ và Tên", "Số Điện Thoại", "Tổ Chuyên Môn", "Email Công Vụ", "Zalo_Chat_ID", "Ngày Liên Kết", "Tên_Viết_Tắt_TKB", "Mã_PIN_EduSign"],
  // Row 1: Legacy unpadded row (Phone: 818810007 [number], PIN: 7 [number])
  [1, "Hà Văn Tý (Legacy)", 818810007, "Tổ Toán - Tin", "cva.ty@thcschuvanan.edu.vn", "", "", "Tý", 7],
  // Row 2: Standard padded text row (Phone: '0905123456', PIN: '3456')
  [2, "Nguyễn Văn Hiển", "0905123456", "Ban Giám hiệu", "cva.hien@thcschuvanan.edu.vn", "", "", "Hiển", "3456"],
  // Row 3: Alphanumeric PIN row (Phone: '0978760924', PIN: 'ABCD')
  [3, "Phan Văn Tuấn", "0978760924", "Tổ KHTN", "cva.pvtuan@thcschuvanan.edu.vn", "", "", "Tuấn", "ABCD"],
  // Row 4: Quang Ngai Landline row (Phone: '02553850001', PIN: '0001')
  [4, "Văn Phòng Trường", "02553850001", "Hành chính", "vanphong@thcschuvanan.edu.vn", "", "", "VP", "0001"],
  // Row 5: Empty PIN row (fallback to phone4: 9999)
  [5, "Lê Thị Thảo", "0912349999", "Tổ Văn", "cva.thao@thcschuvanan.edu.vn", "", "", "Thảo", ""],
  // Row 6: Legacy row where PIN was 0000 and Google Sheets auto-cast stripped it to numeric 0
  [6, "Trần Văn Zero", "0933445566", "Tổ Sử - Địa", "cva.zero@thcschuvanan.edu.vn", "", "", "Zero", 0],
  // Row 7: Teacher with custom secret PIN 9876 (to test security isolation vs phone4)
  [7, "Đặng Bảo Mật", "0944556677", "Tổ Ngoại ngữ", "cva.baomat@thcschuvanan.edu.vn", "", "", "Mật", "9876"]
];

const gasContext = {
  console: console,
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  Date: Date,
  Math: Math,
  JSON: JSON,
  String: String,
  Array: Array,
  RegExp: RegExp,
  parseInt: parseInt,
  parseFloat: parseFloat,
  isNaN: isNaN,
  Boolean: Boolean,
  Logger: { log: function(...args) {} },
  Utilities: {
    formatDate: (d, _tz, _fmt) => `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`,
    sleep: () => {}
  },
  ContentService: {
    MimeType: { JSON: "application/json" },
    createTextOutput: (str) => ({
      setMimeType: () => ({ getContentText: () => str, raw: str })
    })
  },
  SpreadsheetApp: {
    openById: () => ({
      getId: () => "mock_spreadsheet_edusign_2026",
      getSheetByName: (name) => {
        if (name === "Danh bạ GV") {
          return {
            getDataRange: () => ({
              getValues: () => mockUsersSheetData
            }),
            getLastColumn: () => 9,
            getLastRow: () => mockUsersSheetData.length,
            getRange: (row, col, numRows, numCols) => ({
              getValues: () => {
                const r = row - 1;
                const c = col - 1;
                const nrows = numRows || 1;
                const ncols = numCols || 1;
                const result = [];
                for (let i = 0; i < nrows; i++) {
                  const rowData = [];
                  for (let j = 0; j < ncols; j++) {
                    rowData.push(mockUsersSheetData[r + i] ? mockUsersSheetData[r + i][c + j] : "");
                  }
                  result.push(rowData);
                }
                return result;
              },
              setValue: (val) => {
                if (mockUsersSheetData[row - 1]) {
                  mockUsersSheetData[row - 1][col - 1] = val;
                }
              },
              setBackground: function() { return this; },
              setFontColor: function() { return this; },
              setFontWeight: function() { return this; },
              setNumberFormat: function() { return this; }
            }),
            appendRow: (rowArr) => {
              mockUsersSheetData.push(rowArr);
            }
          };
        }
        return null;
      }
    })
  },
  UrlFetchApp: {
    fetch: () => ({
      getResponseCode: () => 200,
      getContentText: () => JSON.stringify({ ok: true })
    })
  }
};

const gasScriptRaw = fs.readFileSync(GAS_SCRIPT_PATH, 'utf8');
vm.createContext(gasContext);
vm.runInContext(gasScriptRaw, gasContext);
gasContext.CONFIG.SPREADSHEET_ID = "mock_spreadsheet_edusign_2026";

const results = [];

function recordTest(category, name, fn) {
  try {
    const outcome = fn();
    const result = { category, name, status: 'PASS', details: outcome || 'OK' };
    results.push(result);
    console.log(`  ✅ [PASS] [${category}] ${name}`);
    return result;
  } catch (err) {
    const result = { category, name, status: 'FAIL', error: err.message };
    results.push(result);
    console.log(`  ❌ [FAIL] [${category}] ${name}`);
    console.log(`     ↳ Error: ${err.message}`);
    return result;
  }
}

// ==================================================================================
// SUITE 1: PHONE NORMALIZATION ENGINE (normalizePhone)
// ==================================================================================
console.log("--------------------------------------------------------------------------------");
console.log("📞 SUITE 1: PHONE NORMALIZATION ENGINE (normalizePhone)");
console.log("--------------------------------------------------------------------------------");

recordTest("PHONE", "Format 1: Standard 10-digit mobile '0818810007' -> '0818810007'", () => {
  assert.strictEqual(gasContext.normalizePhone("0818810007"), "0818810007");
});

recordTest("PHONE", "Format 2: Stripped leading zero '818810007' -> '0818810007'", () => {
  assert.strictEqual(gasContext.normalizePhone("818810007"), "0818810007");
  assert.strictEqual(gasContext.normalizePhone(818810007), "0818810007");
});

recordTest("PHONE", "Format 3: International with spaces & plus '+84 818 810 007' -> '0818810007'", () => {
  assert.strictEqual(gasContext.normalizePhone("+84 818 810 007"), "0818810007");
});

recordTest("PHONE", "Format 4: 12-digit 840 prefix '840818810007' -> '0818810007'", () => {
  assert.strictEqual(gasContext.normalizePhone("840818810007"), "0818810007");
});

recordTest("PHONE", "Format 5: Quang Ngai landline '02553850001' -> '02553850001'", () => {
  assert.strictEqual(gasContext.normalizePhone("02553850001"), "02553850001");
});

recordTest("PHONE", "Format 6: Quang Ngai landline missing zero '2553850001' -> '02553850001'", () => {
  assert.strictEqual(gasContext.normalizePhone("2553850001"), "02553850001");
});

recordTest("PHONE", "Format 7: Mobile with spaces '0905 123 456' -> '0905123456'", () => {
  assert.strictEqual(gasContext.normalizePhone("0905 123 456"), "0905123456");
});

recordTest("PHONE", "Format 8: International mobile with dashes '+84-905-123-456' -> '0905123456'", () => {
  assert.strictEqual(gasContext.normalizePhone("+84-905-123-456"), "0905123456");
});

// ==================================================================================
// SUITE 2: PIN FORMATS & PADSTART DEFENSE IN handleSecurePhoneMapping
// ==================================================================================
console.log("\n--------------------------------------------------------------------------------");
console.log("🔐 SUITE 2: PIN FORMATS & PADSTART DEFENSE IN handleSecurePhoneMapping");
console.log("--------------------------------------------------------------------------------");

recordTest("PIN", "PIN format '0007' matches stored PIN '0007'", () => {
  const res = gasContext.handleSecurePhoneMapping("chat_01", "0818810007", "0007");
  assert.ok(res.includes("LIÊN KẾT ZALO THÀNH CÔNG"), res);
});

recordTest("PIN", "PIN format '7' auto-pads to '0007'", () => {
  const res = gasContext.handleSecurePhoneMapping("chat_02", "0818810007", "7");
  assert.ok(res.includes("LIÊN KẾT ZALO THÀNH CÔNG"), res);
});

recordTest("PIN", "PIN format '07' auto-pads to '0007'", () => {
  const res = gasContext.handleSecurePhoneMapping("chat_03", "0818810007", "07");
  assert.ok(res.includes("LIÊN KẾT ZALO THÀNH CÔNG"), res);
});

recordTest("PIN", "PIN format '007' auto-pads to '0007'", () => {
  const res = gasContext.handleSecurePhoneMapping("chat_04", "0818810007", "007");
  assert.ok(res.includes("LIÊN KẾT ZALO THÀNH CÔNG"), res);
});

recordTest("PIN", "PIN format '1234' with teacher whose phone4 is '1234'", () => {
  const res = gasContext.handleSecurePhoneMapping("chat_hien", "0905123456", "3456");
  assert.ok(res.includes("LIÊN KẾT ZALO THÀNH CÔNG"), res);
});

recordTest("PIN", "Alphanumeric PIN 'ABCD' preserved without padStart corruption", () => {
  const res = gasContext.handleSecurePhoneMapping("chat_tuan", "0978760924", "ABCD");
  assert.ok(res.includes("LIÊN KẾT ZALO THÀNH CÔNG"), res);
});

recordTest("PIN", "Empty PIN in sheet falls back to last 4 digits of phone ('0912349999' -> '9999')", () => {
  const res = gasContext.handleSecurePhoneMapping("chat_thao", "0912349999", "9999");
  assert.ok(res.includes("LIÊN KẾT ZALO THÀNH CÔNG"), res);
});

recordTest("PIN", "Numeric 0 in sheet (PIN 0000 stripped to 0 by Sheets): Verify if '0000' authenticates", () => {
  const res = gasContext.handleSecurePhoneMapping("chat_zero", "0933445566", "0000");
  if (!res.includes("LIÊN KẾT ZALO THÀNH CÔNG")) {
    throw new Error(`CRITICAL DEFECT: Stored PIN 0 coerced to empty string by 'data[i][8] || \"\"'! Response: ${res.split('\n')[0]}`);
  }
});

// ==================================================================================
// SUITE 3: LEGACY SHEET SIMULATION & SELF-HEALING
// ==================================================================================
console.log("\n--------------------------------------------------------------------------------");
console.log("📜 SUITE 3: LEGACY SHEET SIMULATION & SELF-HEALING");
console.log("--------------------------------------------------------------------------------");

recordTest("LEGACY", "Authenticate legacy row with 'LK 0818810007 0007'", () => {
  const res = gasContext.handleSecurePhoneMapping("chat_ty_01", "0818810007", "0007");
  assert.ok(res.includes("LIÊN KẾT ZALO THÀNH CÔNG"), res);
  assert.ok(res.includes("Hà Văn Tý"));
});

recordTest("LEGACY", "Authenticate legacy row with 'LK 0818810007 7'", () => {
  const res = gasContext.handleSecurePhoneMapping("chat_ty_02", "0818810007", "7");
  assert.ok(res.includes("LIÊN KẾT ZALO THÀNH CÔNG"), res);
});

recordTest("LEGACY", "Authenticate legacy row with unpadded phone input 'LK 818810007 0007'", () => {
  const res = gasContext.handleSecurePhoneMapping("chat_ty_03", "818810007", "0007");
  assert.ok(res.includes("LIÊN KẾT ZALO THÀNH CÔNG"), res);
});

recordTest("LEGACY", "Authenticate legacy row with both unpadded 'LK 818810007 7'", () => {
  const res = gasContext.handleSecurePhoneMapping("chat_ty_04", "818810007", "7");
  assert.ok(res.includes("LIÊN KẾT ZALO THÀNH CÔNG"), res);
});

recordTest("LEGACY", "Confirm Self-Healing: Sheet row updated with text prefix \"'0818810007\" and \"'0007\"", () => {
  const row = mockUsersSheetData[1];
  const phoneCell = String(row[2]);
  const pinCell = String(row[8]);
  assert.strictEqual(phoneCell, "'0818810007", `Phone cell was: ${phoneCell}`);
  assert.strictEqual(pinCell, "'0007", `PIN cell was: ${pinCell}`);
});

// ==================================================================================
// SUITE 4: NEGATIVE SECURITY TESTS
// ==================================================================================
console.log("\n--------------------------------------------------------------------------------");
console.log("🛡️ SUITE 4: NEGATIVE SECURITY TESTS");
console.log("--------------------------------------------------------------------------------");

recordTest("SECURITY", "Wrong PIN MUST fail ('LK 0818810007 9999')", () => {
  const res = gasContext.handleSecurePhoneMapping("chat_bad", "0818810007", "9999");
  assert.ok(res.includes("Mã PIN bảo mật không chính xác"), `Expected rejection but got: ${res}`);
});

recordTest("SECURITY", "Non-existent phone MUST fail ('LK 0999999999 1234')", () => {
  const res = gasContext.handleSecurePhoneMapping("chat_bad", "0999999999", "1234");
  assert.ok(res.includes("không có trong danh bạ"), `Expected not-found but got: ${res}`);
});

recordTest("SECURITY", "Wrong PIN against Alphanumeric PIN MUST fail ('0978760924' PIN ABCD vs guess '1234')", () => {
  const res = gasContext.handleSecurePhoneMapping("chat_bad", "0978760924", "1234");
  assert.ok(res.includes("Mã PIN bảo mật không chính xác"), `Expected rejection but got: ${res}`);
});

recordTest("SECURITY", "Naked phone number without PIN MUST NOT authenticate (returns security warning)", () => {
  const res = gasContext.processUnifiedZaloMessage("chat_naked", "0818810007");
  assert.ok(res.includes("BẢO VỆ ĐỊNH DANH GIÁO VIÊN"), `Must return security prompt, got: ${res}`);
  assert.ok(!res.includes("LIÊN KẾT ZALO THÀNH CÔNG"), `Must not link!`);
});

recordTest("SECURITY", "Security audit: Custom PIN 9876 should NOT be bypassable by phone4 (6677)", () => {
  // Row 7: Đặng Bảo Mật has phone 0944556677 and custom PIN 9876
  const res = gasContext.handleSecurePhoneMapping("chat_intruder", "0944556677", "6677");
  if (res.includes("LIÊN KẾT ZALO THÀNH CÔNG")) {
    throw new Error("SECURITY GAP: Custom PIN 9876 was bypassed by phone4 (6677) due to 'pinClean !== phone4' fallback!");
  }
});

// ==================================================================================
// SUITE 5: ZALO BOT WEBHOOK MESSAGE ROUTER (processUnifiedZaloMessage)
// ==================================================================================
console.log("\n--------------------------------------------------------------------------------");
console.log("🤖 SUITE 5: ZALO BOT WEBHOOK MESSAGE ROUTER (processUnifiedZaloMessage)");
console.log("--------------------------------------------------------------------------------");

recordTest("ROUTER", "Standard command: 'LK 0818810007 0007'", () => {
  const res = gasContext.processUnifiedZaloMessage("chat_nlp_01", "LK 0818810007 0007");
  assert.ok(res.includes("LIÊN KẾT ZALO THÀNH CÔNG"), res);
});

recordTest("ROUTER", "Alternative keyword: 'LIENKET 0818810007 0007'", () => {
  const res = gasContext.processUnifiedZaloMessage("chat_nlp_02", "LIENKET 0818810007 0007");
  assert.ok(res.includes("LIÊN KẾT ZALO THÀNH CÔNG"), res);
});

recordTest("ROUTER", "Short PIN command: 'LK 0818810007 7'", () => {
  const res = gasContext.processUnifiedZaloMessage("chat_nlp_03", "LK 0818810007 7");
  assert.ok(res.includes("LIÊN KẾT ZALO THÀNH CÔNG"), res);
});

recordTest("ROUTER", "Quang Ngai landline: 'LK 02553850001 0001'", () => {
  const res = gasContext.processUnifiedZaloMessage("chat_nlp_04", "LK 02553850001 0001");
  assert.ok(res.includes("LIÊN KẾT ZALO THÀNH CÔNG"), res);
});

recordTest("ROUTER", "Quang Ngai landline missing zero: 'LK 2553850001 0001'", () => {
  const res = gasContext.processUnifiedZaloMessage("chat_nlp_05", "LK 2553850001 0001");
  assert.ok(res.includes("LIÊN KẾT ZALO THÀNH CÔNG"), res);
});

recordTest("ROUTER", "Alphanumeric PIN: 'LK 0978760924 ABCD'", () => {
  const res = gasContext.processUnifiedZaloMessage("chat_nlp_06", "LK 0978760924 ABCD");
  assert.ok(res.includes("LIÊN KẾT ZALO THÀNH CÔNG"), res);
});

// ADVERSARIAL EDGE CASES: Formatted phones in Zalo chat command
recordTest("ROUTER", "International phone with spaces & plus in command: 'LK +84 818 810 007 0007'", () => {
  const res = gasContext.processUnifiedZaloMessage("chat_nlp_07", "LK +84 818 810 007 0007");
  if (!res.includes("LIÊN KẾT ZALO THÀNH CÔNG")) {
    throw new Error(`DEFECT: Router regex failed to parse formatted phone '+84 818 810 007'! Result: ${res.split('\n')[0]}`);
  }
});

recordTest("ROUTER", "International phone without spaces: 'LK +84818810007 0007'", () => {
  const res = gasContext.processUnifiedZaloMessage("chat_nlp_08", "LK +84818810007 0007");
  if (!res.includes("LIÊN KẾT ZALO THÀNH CÔNG")) {
    throw new Error(`DEFECT: Router regex failed to parse '+84818810007'! Result: ${res.split('\n')[0]}`);
  }
});

recordTest("ROUTER", "12-digit 840 prefix in command: 'LK 840818810007 0007'", () => {
  const res = gasContext.processUnifiedZaloMessage("chat_nlp_09", "LK 840818810007 0007");
  if (!res.includes("LIÊN KẾT ZALO THÀNH CÔNG")) {
    throw new Error(`DEFECT: Router regex failed to parse 12-digit '840818810007'! Result: ${res.split('\n')[0]}`);
  }
});

recordTest("ROUTER", "Phone with spaces in command: 'LK 0905 123 456 3456'", () => {
  const res = gasContext.processUnifiedZaloMessage("chat_nlp_10", "LK 0905 123 456 3456");
  if (!res.includes("LIÊN KẾT ZALO THÀNH CÔNG")) {
    throw new Error(`DEFECT: Router regex failed to parse spaced phone '0905 123 456'! Result: ${res.split('\n')[0]}`);
  }
});

recordTest("ROUTER", "Phone with dashes in command: 'LK +84-905-123-456 3456'", () => {
  const res = gasContext.processUnifiedZaloMessage("chat_nlp_11", "LK +84-905-123-456 3456");
  if (!res.includes("LIÊN KẾT ZALO THÀNH CÔNG")) {
    throw new Error(`DEFECT: Router regex failed to parse dashed phone '+84-905-123-456'! Result: ${res.split('\n')[0]}`);
  }
});

// ==================================================================================
// SUITE 6: SHEET WRITE-PATH INTEGRITY (handleSyncTeacher)
// ==================================================================================
console.log("\n--------------------------------------------------------------------------------");
console.log("📊 SUITE 6: SHEET WRITE-PATH INTEGRITY (handleSyncTeacher)");
console.log("--------------------------------------------------------------------------------");

recordTest("SYNC", "handleSyncTeacher updates existing teacher preserving text prefix and format", () => {
  const updatePayload = {
    teacher: {
      fullName: "Nguyễn Văn Hiển",
      phone: "0905123456",
      department: "Ban Giám hiệu",
      email: "cva.hien@thcschuvanan.edu.vn",
      pinCode: "0007"
    }
  };
  const res = gasContext.handleSyncTeacher(updatePayload);
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.action_performed, "UPDATED");
  assert.strictEqual(String(mockUsersSheetData[2][2]), "'0905123456");
  assert.strictEqual(String(mockUsersSheetData[2][8]), "'0007");
});

recordTest("SYNC", "handleSyncTeacher adds new teacher with unique phone preserving text prefix and format", () => {
  const newPayload = {
    teacher: {
      fullName: "Đỗ Mười",
      phone: "0911223344", // Unique phone
      department: "Tổ GDTC",
      email: "cva.muoi@thcschuvanan.edu.vn",
      pinCode: "7"
    }
  };
  const res = gasContext.handleSyncTeacher(newPayload);
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.action_performed, "CREATED");
  const lastRow = mockUsersSheetData[mockUsersSheetData.length - 1];
  assert.strictEqual(String(lastRow[2]), "'0911223344");
  assert.strictEqual(String(lastRow[8]), "'0007"); // 7 padded to 0007
});

// ==================================================================================
// SUMMARY REPORT
// ==================================================================================
console.log("\n================================================================================");
const passed = results.filter(r => r.status === 'PASS').length;
const failed = results.filter(r => r.status === 'FAIL').length;
const total = results.length;
console.log(`📊 ADVERSARIAL STRESS TEST SUMMARY: ${passed}/${total} PASSED (${failed} FAILED)`);
console.log("================================================================================");

const failedList = results.filter(r => r.status === 'FAIL');
if (failedList.length > 0) {
  console.log("\n❌ DEFECTS & SECURITY GAPS DETECTED DURING EMPIRICAL TESTING:");
  failedList.forEach((f, idx) => {
    console.log(`  ${idx + 1}. [${f.category}] ${f.name}`);
    console.log(`     ↳ ${f.error}`);
  });
  console.log("\nVerdict: DEFECT_FOUND");
} else {
  console.log("\nVerdict: CONFIRM_CORRECTNESS");
}
