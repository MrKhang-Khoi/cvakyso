const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

let code = fs.readFileSync('google-apps-script-zalo-edusign.js', 'utf8');

// Patch 1: Falsy 0 bug in line 1536
code = code.replace(
  'storedPin = String(data[i][8] || "").replace(/^\\x27+/, "").trim();',
  'var rawPinVal = data[i][8];\n      storedPin = (rawPinVal !== undefined && rawPinVal !== null) ? String(rawPinVal).replace(/^\\x27+/, "").trim() : "";'
);
// In case of literal '
if (!code.includes('var rawPinVal = data[i][8];')) {
  code = code.replace(
    /storedPin = String\(data\[i\]\[8\] \|\| ""\)\.replace\(\/\^\'\+\/, ""\)\.trim\(\);/,
    'var rawPinVal = data[i][8];\n      storedPin = (rawPinVal !== undefined && rawPinVal !== null) ? String(rawPinVal).replace(/^\'+/, "").trim() : "";'
  );
}

// Patch 2: Router regex to allow formatted phones
code = code.replace(
  /var linkPattern = text\.match\(\/\^\(LK\|LIENKET\)\\s\+\(\[0-9\]\{9,11\}\)\\s\+\(\[0-9A-Za-z\]\{1,8\}\)\$\/i\);/,
  'var linkPattern = text.match(/^(LK|LIENKET)\\s+([\\+0-9\\s\\-\\.\\(\\)]{9,25})\\s+([0-9A-Za-z]{1,8})$/i);'
);

// Patch 3: Custom PIN security isolation
code = code.replace(
  'if (pinClean !== validPin && pinClean !== phone4) {',
  'if (pinClean !== validPin) {'
);

let mockUsersSheetData = [
  ['STT', 'Họ và Tên', 'Số Điện Thoại', 'Tổ Chuyên Môn', 'Email Công Vụ', 'Zalo_Chat_ID', 'Ngày Liên Kết', 'Tên_Viết_Tắt_TKB', 'Mã_PIN_EduSign'],
  [1, 'Hà Văn Tý (Legacy)', 818810007, 'Tổ Toán - Tin', 'cva.ty@thcschuvanan.edu.vn', '', '', 'Tý', 7],
  [2, 'Nguyễn Văn Hiển', '0905123456', 'Ban Giám hiệu', 'cva.hien@thcschuvanan.edu.vn', '', '', 'Hiển', '3456'],
  [3, 'Phan Văn Tuấn', '0978760924', 'Tổ KHTN', 'cva.pvtuan@thcschuvanan.edu.vn', '', '', 'Tuấn', 'ABCD'],
  [4, 'Văn Phòng Trường', '02553850001', 'Hành chính', 'vanphong@thcschuvanan.edu.vn', '', '', 'VP', '0001'],
  [5, 'Lê Thị Thảo', '0912349999', 'Tổ Văn', 'cva.thao@thcschuvanan.edu.vn', '', '', 'Thảo', ''],
  [6, 'Trần Văn Zero', '0933445566', 'Tổ Sử - Địa', 'cva.zero@thcschuvanan.edu.vn', '', '', 'Zero', 0],
  [7, 'Đặng Bảo Mật', '0944556677', 'Tổ Ngoại ngữ', 'cva.baomat@thcschuvanan.edu.vn', '', '', 'Mật', '9876']
];

const gasContext = {
  console,
  SpreadsheetApp: {
    openById: () => ({
      getId: () => 'mock_spreadsheet_edusign_2026',
      getSheetByName: (name) => ({
        getDataRange: () => ({ getValues: () => mockUsersSheetData }),
        getLastColumn: () => 9,
        getLastRow: () => mockUsersSheetData.length,
        getRange: (row, col, numRows, numCols) => ({
          getValues: () => [[mockUsersSheetData[row - 1][col - 1]]],
          setValue: (val) => { mockUsersSheetData[row - 1][col - 1] = val; },
          setNumberFormat: () => {}
        }),
        appendRow: (rowArr) => { mockUsersSheetData.push(rowArr); }
      })
    })
  },
  CONFIG: { SPREADSHEET_ID: 'mock_spreadsheet_edusign_2026', SHEET_USERS: 'Danh bạ GV', PORTAL_URL: 'url' }
};

vm.createContext(gasContext);
vm.runInContext(code, gasContext);

console.log('--- Test 1: PIN 0000 when sheet has numeric 0 ---');
const r1 = gasContext.handleSecurePhoneMapping('chat_zero', '0933445566', '0000');
console.log('Result:', r1.includes('LIÊN KẾT ZALO THÀNH CÔNG') ? 'PASS ✅' : 'FAIL ❌: ' + r1);

console.log('--- Test 2: Custom PIN 9876 security isolation vs phone4 (6677) ---');
const r2 = gasContext.handleSecurePhoneMapping('chat_intruder', '0944556677', '6677');
console.log('Result (must reject):', r2.includes('Mã PIN bảo mật không chính xác') ? 'PASS (Securely Rejected) ✅' : 'FAIL ❌: ' + r2);

console.log('--- Test 3: Formatted phone numbers in Zalo Chat Router ---');
const formatted = [
  'LK +84 818 810 007 0007',
  'LK +84818810007 0007',
  'LK 840818810007 0007',
  'LK 0905 123 456 3456',
  'LK +84-905-123-456 3456'
];
formatted.forEach(f => {
  const rf = gasContext.processUnifiedZaloMessage('chat_test', f);
  console.log(f, '=>', rf.includes('LIÊN KẾT ZALO THÀNH CÔNG') ? 'PASS ✅' : 'FAIL ❌: ' + rf.split('\n')[0]);
});
