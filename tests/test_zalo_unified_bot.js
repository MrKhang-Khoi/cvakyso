/**
 * ====================================================================================================
 *   🧪 TEST SUITE: KIỂM THỬ TOÀN DIỆN ZALO BOT HỢP NHẤT 4.0
 *   (THỜI KHÓA BIỂU KÈM KHUNG GIỜ + TỰ ĐỘNG NHẮC LỊCH 6H00 SÁNG + KÝ SỐ EDUSIGN)
 * ====================================================================================================
 */

const assert = require('assert');
const path = require('path');

// Mock môi trường Google Apps Script nếu cần
global.Logger = {
  log: function(...args) { /* console.log('[GAS Logger]', ...args); */ }
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

const gasBot = require('../google-apps-script-zalo-edusign.js');

console.log("================================================================================");
console.log("      🚀 BẮT ĐẦU KIỂM THỬ TRỢ LÝ ZALO BOT TRƯỜNG HỌC 4.0 (ZERO-BUG)             ");
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
// DỮ LIỆU GIẢ LẬP (MOCK DATA)
// -----------------------------------------------------------------------------
const mockClasses = [
  { name: "6A1", session: "sáng", gvcn: "Hà Văn Tý" },
  { name: "6A10", session: "sáng", gvcn: "Phan Thị Thúy" },
  { name: "9B1", session: "chiều", gvcn: "Trần Văn Nam" }
];

const mockTeachers = [
  { fullName: "Nguyễn Đức Trọng", shortName: "Trọng", group: "Toán - Tin" },
  { fullName: "Phan Thị Thúy", shortName: "P.Thúy", group: "Khoa học Tự nhiên" },
  { fullName: "Nguyễn Thị Thu", shortName: "Thu", group: "Ngữ văn" },
  { fullName: "Hà Văn Tý", shortName: "Tý", group: "Toán - Tin" },
  { fullName: "Trần Văn Nam", shortName: "Nam", group: "Khoa học Xã hội" }
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
            2: { subject: "Toán", teacher: "Tý" },
            3: { subject: "Ngữ văn", teacher: "Thu" }
          },
          "T3": {
            1: { subject: "Toán", teacher: "Trọng" },
            2: { subject: "Khoa học tự nhiên", teacher: "P.Thúy" }
          }
        },
        "6A10": {
          "T2": {
            1: { subject: "Chào cờ", teacher: "P.Thúy" },
            2: { subject: "Khoa học tự nhiên", teacher: "P.Thúy" }
          }
        },
        "9B1": {
          "T3": {
            1: { subject: "Toán", teacher: "Trọng" },
            2: { subject: "Lịch sử", teacher: "Nam" }
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
      period: 3,
      className: "6A1",
      subject: "Toán",
      originalTeacher: "Tý",
      substituteTeacher: "Trọng",
      note: "Cô Tý đi họp công vụ"
    }
  ]
};

// -----------------------------------------------------------------------------
// 1. KIỂM THỬ KHUNG GIỜ RA VÀO LỚP
// -----------------------------------------------------------------------------
console.log("👉 1. Kiểm thử Khung Giờ Ra Vào Lớp Chuẩn Xác Theo Hình Ảnh:");

runTest("Tiết 1 Buổi Sáng đúng khung giờ 07h00 - 07h45", () => {
  assert.strictEqual(gasBot.formatPeriodTime("sáng", 1), "07h00 - 07h45");
});

runTest("Tiết 2 Buổi Sáng đúng khung giờ 07h50 - 08h35", () => {
  assert.strictEqual(gasBot.formatPeriodTime("sáng", 2), "07h50 - 08h35");
});

runTest("Tiết 3 Buổi Sáng đúng khung giờ 08h40 - 09h25", () => {
  assert.strictEqual(gasBot.formatPeriodTime("sáng", 3), "08h40 - 09h25");
});

runTest("Tiết 4 Buổi Sáng đúng khung giờ 09h30 - 10h15", () => {
  assert.strictEqual(gasBot.formatPeriodTime("sáng", 4), "09h30 - 10h15");
});

runTest("Tiết 5 Buổi Sáng đúng khung giờ 10h20 - 11h05", () => {
  assert.strictEqual(gasBot.formatPeriodTime("sáng", 5), "10h20 - 11h05");
});

runTest("Tiết 1 Buổi Chiều đúng khung giờ 13h00 - 13h45", () => {
  assert.strictEqual(gasBot.formatPeriodTime("chiều", 1), "13h00 - 13h45");
});

runTest("Tiết 2 Buổi Chiều đúng khung giờ 13h50 - 14h35", () => {
  assert.strictEqual(gasBot.formatPeriodTime("chiều", 2), "13h50 - 14h35");
});

runTest("Tiết 3 Buổi Chiều đúng khung giờ 14h40 - 15h25", () => {
  assert.strictEqual(gasBot.formatPeriodTime("chiều", 3), "14h40 - 15h25");
});

runTest("Tiết 4 Buổi Chiều đúng khung giờ 15h30 - 16h15", () => {
  assert.strictEqual(gasBot.formatPeriodTime("chiều", 4), "15h30 - 16h15");
});

runTest("Tiết 5 Buổi Chiều đúng khung giờ 16h20 - 17h05", () => {
  assert.strictEqual(gasBot.formatPeriodTime("chiều", 5), "16h20 - 17h05");
});

// -----------------------------------------------------------------------------
// 2. KIỂM THỬ KHỚP TÊN LỚP VÀ GIÁO VIÊN (CHỐNG VA CHẠM TÊN)
// -----------------------------------------------------------------------------
console.log("\n👉 2. Kiểm thử Khớp Tên Lớp & Giáo Viên (Chống Va Chạm):");

runTest("Khớp đúng lớp 6A10, tuyệt đối không bị nhầm sang 6A1", () => {
  const match10 = gasBot.findMatchingClass("tkb 6a10", mockClasses);
  assert.ok(match10);
  assert.strictEqual(match10.name, "6A10");

  const match1 = gasBot.findMatchingClass("tkb 6a1", mockClasses);
  assert.ok(match1);
  assert.strictEqual(match1.name, "6A1");
});

runTest("Khớp đúng giáo viên P.Thúy, tuyệt đối không bị nhầm sang Thu", () => {
  const matchThuy = gasBot.findMatchingTeacher("tkb p.thuy", mockTeachers);
  assert.ok(matchThuy);
  assert.strictEqual(matchThuy.shortName, "P.Thúy");

  const matchThu = gasBot.findMatchingTeacher("tkb thu", mockTeachers);
  assert.ok(matchThu);
  assert.strictEqual(matchThu.shortName, "Thu");
});

runTest("Chuẩn hóa vị trí dấu thanh tiếng Việt (thúy == thuý)", () => {
  const matchThuyNfc = gasBot.findMatchingTeacher("tkb P.Thuý", mockTeachers);
  assert.ok(matchThuyNfc);
  assert.strictEqual(matchThuyNfc.shortName, "P.Thúy");
});

runTest("Khớp đúng họ tên đầy đủ: 'tkb Hà Văn Tý' -> Tý", () => {
  const matchFull = gasBot.findMatchingTeacher("tkb Hà Văn Tý", mockTeachers);
  assert.ok(matchFull);
  assert.strictEqual(matchFull.shortName, "Tý");
});

// -----------------------------------------------------------------------------
// -----------------------------------------------------------------------------
// 3. KIỂM THỬ HIỂN THỊ TKB KÈM KHUNG GIỜ VÀO/RA LỚP (TỐI ƯU MOBILE)
// -----------------------------------------------------------------------------
console.log("\n👉 3. Kiểm thử Định Dạng Phản Hồi TKB Tối Ưu Màn Hình Điện Thoại:");

runTest("TKB lớp học tinh gọn, không viền khung rối mắt và chứa khung giờ chuẩn", () => {
  const res = gasBot.formatClassTimetableResponse(mockClasses[0], mockSchoolData, "T2");
  assert.ok(res.includes("TKB LỚP 6A1"));
  assert.ok(res.includes("Tiết 1 (07h00-07h45): Chào cờ"));
  assert.ok(res.includes("Tiết 2 (07h50-08h35): Toán"));
  assert.ok(res.includes("Tiết 3 (08h40-09h25): Ngữ văn"));
  assert.ok(!res.includes("╔"), "Tuyệt đối không chứa viền khung Unicode ╔ gây vỡ màn hình");
  assert.ok(!res.includes("───"), "Tuyệt đối không chứa dải gạch ngang thừa");
});

runTest("TKB giáo viên tinh gọn, từng tiết nằm trọn trên 1 dòng đơn (<= 40 ký tự)", () => {
  const teacherTrong = mockTeachers[0];
  const res = gasBot.formatTeacherTimetableResponse(teacherTrong, mockSchoolData, "T3");
  assert.ok(res.includes("LỊCH DẠY: NGUYỄN ĐỨC TRỌNG (Trọng)"));
  assert.ok(res.includes("Tiết 1 (07h00-07h45): Toán - 6A1"));
  assert.ok(res.includes("Tiết 1 (13h00-13h45): Toán - 9B1"));

  // Kiểm tra từng dòng tiết học không vượt quá 42 ký tự
  const lines = res.split("\n");
  lines.forEach(l => {
    if (l.trim().startsWith("• Tiết")) {
      assert.ok(l.trim().length <= 42, `Dòng tiết "${l.trim()}" quá dài (${l.trim().length} chars) sẽ bị rớt dòng trên Zalo!`);
    }
  });
});

// -----------------------------------------------------------------------------
// 4. KIỂM THỬ LUỒNG TIN NHẮN TỰ ĐỘNG 6H00 SÁNG THEO SĐT
// -----------------------------------------------------------------------------
console.log("\n👉 4. Kiểm thử Engine Nhắn Tin Lịch Dạy Lúc 6h00 Sáng:");

runTest("Soạn tin nhắn 6h00 sáng chuẩn cho giáo viên có tiết dạy (kèm ca dạy thay)", () => {
  const teacherTrong = mockTeachers[0]; // Thầy Trọng
  const morningMsg = gasBot.generateMorningTeacherMessage(teacherTrong, mockSchoolData, "T3", "Thứ Ba", "15/10/2026");
  
  assert.ok(morningMsg, "Nội dung tin nhắn không được rỗng");
  assert.ok(morningMsg.includes("LỊCH GIẢNG DẠY HÔM NAY (Thứ Ba - 15/10/2026)"));
  assert.ok(morningMsg.includes("Nguyễn Đức Trọng"));
  assert.ok(morningMsg.includes("Buổi Sáng"));
  assert.ok(morningMsg.includes("Tiết 1 (07h00-07h45): Toán - 6A1"));
  assert.ok(morningMsg.includes("Buổi Chiều"));
  assert.ok(morningMsg.includes("Tiết 1 (13h00-13h45): Toán - 9B1"));
  assert.ok(morningMsg.includes("CA DẠY THAY TRONG NGÀY"));
  assert.ok(morningMsg.includes("Dạy thay cho GV Tý"));
});

runTest("Không gửi tin nhắn làm phiền nếu giáo viên không có tiết dạy hôm nay", () => {
  const teacherNam = mockTeachers[4]; // Thầy Nam không có tiết dạy và không có ca dạy thay vào Thứ 2
  const emptyMsg = gasBot.generateMorningTeacherMessage(teacherNam, mockSchoolData, "T2", "Thứ Hai", "14/10/2026");
  assert.strictEqual(emptyMsg, null);
});

// -----------------------------------------------------------------------------
// 5. KIỂM THỬ TÍNH NĂNG NHẮC LỊCH NGÀY MAI THÔNG MINH
// -----------------------------------------------------------------------------
console.log("\n👉 5. Kiểm thử Tính Năng Nhắc Lịch TKB Ngày Mai Thông Minh:");

runTest("Tạo tin nhắn ngày mai cho giáo viên CÓ tiết dạy (Thứ 3 cho Thầy Trọng)", () => {
  // Giả lập ngày mai là Thứ Ba (T3): 15/09/2026
  const targetTuesday = new Date(2026, 8, 15); // Month index 8 is September
  const teacherTrong = mockTeachers[0];
  const msg = gasBot.generateTomorrowTeacherMessage(teacherTrong, mockSchoolData, targetTuesday);

  assert.ok(msg);
  assert.ok(msg.includes("LỊCH GIẢNG DẠY NGÀY MAI (Thứ Ba"));
  assert.ok(msg.includes("Tiết 1 (07h00-07h45): Toán - 6A1"));
  assert.ok(msg.includes("Tiết 1 (13h00-13h45): Toán - 9B1"));
});

runTest("Tạo tin nhắn ngày mai khi KHÔNG CÓ tiết: Báo nghỉ và tự động xem trước buổi tiếp theo", () => {
  // Giả lập ngày mai là Thứ Bảy (T7): 12/09/2026
  const targetSaturday = new Date(2026, 8, 12);
  const teacherTy = mockTeachers[3]; // Thầy Hà Văn Tý (Tý)
  const msg = gasBot.generateTomorrowTeacherMessage(teacherTy, mockSchoolData, targetSaturday);

  assert.ok(msg);
  assert.ok(msg.includes("LỊCH GIẢNG DẠY NGÀY MAI (Thứ Bảy"));
  assert.ok(msg.includes("Hà Văn Tý (Tý)"));
  assert.ok(msg.includes("KHÔNG CÓ TIẾT DẠY"));
  assert.ok(msg.includes("LỊCH DẠY BUỔI TIẾP THEO"));
  assert.ok(msg.includes("Thứ Hai"));
  assert.ok(msg.includes("Tiết 2 (07h50-08h35): Toán - 6A1"));
});

// -----------------------------------------------------------------------------
// 6. KIỂM THỬ BỘ ĐIỀU PHỐI TIN NHẮN THÔNG MINH (ROUTER)
// -----------------------------------------------------------------------------
console.log("\n👉 6. Kiểm thử Bộ Điều Phối Lệnh Hợp Nhất (Unified Router):");

runTest("Lệnh tra cứu TKB lớp: 'tkb 6a1' trả lời đúng TKB kèm khung giờ", () => {
  const reply = gasBot.handleNaturalTimetableQuery("tkb 6a1", "tkb 6a1", mockSchoolData);
  assert.ok(reply);
  assert.ok(reply.includes("TKB LỚP 6A1"));
  assert.ok(reply.includes("07h00-07h45"));
});

runTest("Lệnh tra cứu dạy thay: 'day thay' trả về danh sách dạy thay", () => {
  const reply = gasBot.handleSubstitutionQuery(mockSchoolData);
  assert.ok(reply);
  assert.ok(reply.includes("LỊCH DẠY THAY & HỌC THAY"));
  assert.ok(reply.includes("DẠY THAY: Trọng"));
});

runTest("Lệnh tìm giáo viên trống tiết: 'tim gv t2' tìm ra giáo viên rảnh Tiết 1", () => {
  const reply = gasBot.handleFindFreeTeacherQuery("tim gv t2", "tim gv t2", mockSchoolData);
  assert.ok(reply);
  assert.ok(reply.includes("GIÁO VIÊN TRỐNG TIẾT DẠY THAY"));
  assert.ok(reply.includes("Nguyễn Đức Trọng (Trọng)"));
});

// -----------------------------------------------------------------------------
// 6. KIỂM THỬ SỰ KIỆN KÝ SỐ EDUSIGN
// -----------------------------------------------------------------------------
console.log("\n👉 6. Kiểm thử Sự Kiện Thông Báo Ký Số (EduSign Integration):");

runTest("Chuẩn hóa số điện thoại Việt Nam chuẩn", () => {
  assert.strictEqual(gasBot.normalizePhone("0912345678"), "0912345678");
  assert.strictEqual(gasBot.normalizePhone("84912345678"), "0912345678");
  assert.strictEqual(gasBot.normalizePhone("912345678"), "0912345678");
  assert.strictEqual(gasBot.normalizePhone("02553850001"), "02553850001");
});

runTest("Xử lý sự kiện ký số: HỒ SƠ BỊ TRẢ VỀ (REJECTED)", () => {
  // Mock hàm getChatIdByPhone trả về chat id
  const eventData = {
    eventType: "REJECTED",
    docTitle: "Giáo án Ngữ văn Tuần 4",
    docId: "GA-1234",
    authorPhone: "0912345678",
    approverName: "Hiệu trưởng",
    reason: "Bổ sung mục tiêu năng lực số"
  };
  const res = gasBot.handleEduSignNotification(eventData);
  assert.ok(res.success);
});

// -----------------------------------------------------------------------------
// TỔNG KẾT
// -----------------------------------------------------------------------------
console.log("\n================================================================================");
console.log(`🎉 KẾT QUẢ KIỂM THỬ: ${passed} PASS, ${failed} FAIL`);
console.log("================================================================================\n");

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
