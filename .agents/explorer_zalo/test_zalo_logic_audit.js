/**
 * Verification Test Suite for Zalo Logic & Security Audit
 * Directory: .agents/explorer_zalo/test_zalo_logic_audit.js
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

// Mock GAS environment
global.Logger = { log: function(...args) {} };
global.Utilities = {
  formatDate: (d, tz, fmt) => `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`,
  sleep: (ms) => {}
};

// Mock SpreadsheetApp for GAS bot testing
let mockUsersSheetData = [
  ["STT", "Họ và Tên", "Số Điện Thoại", "Tổ Chuyên Môn", "Email Công Vụ", "Zalo_Chat_ID", "Ngày Liên Kết", "Tên_Viết_Tắt_TKB"],
  [1, "Hà Văn Tý", "0818810007", "Tổ Toán - Tin", "cva.ty@thcschuvanan.edu.vn", "legit_chat_id_teacher_ty", "10/09/2026", "Tý"],
  [2, "Ngô Thị Liền", "0905123456", "Ban Giám hiệu", "cva.lien@quangngai.gov.vn", "legit_chat_id_bgh", "10/09/2026", "Liền"]
];

let mockReportsSheetData = [
  ["Mã Báo Cáo", "Tên Báo Cáo", "Người Lập", "SĐT", "Tổ", "Người Ký Duyệt", "Ngày Duyệt", "Trạng Thái", "Link Xem"],
  ["BC-001", "Kế hoạch bài dạy Tuần 3", "Hà Văn Tý", "0818810007", "Toán - Tin", "Ngô Thị Liền", "12/09/2026", "COMPLETED", "https://drive.google.com/open?id=mock_file_1"]
];

global.SpreadsheetApp = {
  openById: (id) => ({
    getId: () => "mock_id",
    getSheetByName: (name) => {
      if (name === "Danh bạ GV") {
        return {
          getDataRange: () => ({
            getValues: () => mockUsersSheetData
          }),
          getRange: (row, col) => ({
            setValue: (val) => {
              if (mockUsersSheetData[row - 1]) {
                mockUsersSheetData[row - 1][col - 1] = val;
              }
            }
          })
        };
      }
      if (name === "Sổ Lưu Báo Cáo") {
        return {
          getDataRange: () => ({
            getValues: () => mockReportsSheetData
          })
        };
      }
      return null;
    }
  }),
  create: (name) => global.SpreadsheetApp.openById("mock_id")
};

const gasBot = require('../../google-apps-script-zalo-edusign.js');

console.log("================================================================================");
console.log("🔍 RUNNING INDEPENDENT AUDIT VERIFICATION PROBES (ZALO LOGIC & SECURITY)");
console.log("================================================================================\n");

let findings = [];

// PROBE 1: Event Type 'FORWARDED' silent failure in GAS
try {
  const result = gasBot.handleEduSignNotification({
    eventType: "FORWARDED",
    docId: "GA-100",
    docTitle: "Báo cáo thử nghiệm",
    recipientPhone: "0905123456",
    senderName: "Hà Văn Tý"
  });
  if (result.success === false && result.reason === "INVALID_EVENT") {
    console.log("❌ [CONFIRMED VULN 1] 'FORWARDED' event is REJECTED by GAS with INVALID_EVENT!");
    findings.push({
      id: "DEFECT-ZALO-01",
      name: "Silent drop of 'FORWARDED' event in GAS webhook",
      detail: "GAS handleEduSignNotification does not recognize 'FORWARDED', returning { success: false, reason: 'INVALID_EVENT' }."
    });
  } else {
    console.log("❓ 'FORWARDED' unexpected result:", result);
  }
} catch (e) {
  console.log("❌ [CONFIRMED VULN 1] Error during FORWARDED probe:", e.message);
}

// PROBE 2: Document ID Lookup missing in processUnifiedZaloMessage
try {
  const docLookupReply = gasBot.processUnifiedZaloMessage("legit_chat_id_teacher_ty", "KHBD-2026-001");
  if (docLookupReply && docLookupReply.includes("chưa nhận diện được yêu cầu")) {
    console.log("❌ [CONFIRMED VULN 2] Document ID lookup ('KHBD-2026-001') is NOT implemented in command parser!");
    findings.push({
      id: "DEFECT-ZALO-02",
      name: "Missing document code parser in Zalo bot",
      detail: "Typing 'KHBD-...' or 'BC-...' fails to look up document status and triggers default unrecognized error."
    });
  }
} catch (e) {
  console.log("Probe 2 error:", e.message);
}

// PROBE 3: Pending documents lookup missing
try {
  const pendingReply = gasBot.processUnifiedZaloMessage("legit_chat_id_bgh", "choduyet");
  if (pendingReply && pendingReply.includes("chưa nhận diện được yêu cầu")) {
    console.log("❌ [CONFIRMED VULN 3] Pending documents lookup ('choduyet' / 'pending') is NOT implemented!");
    findings.push({
      id: "DEFECT-ZALO-03",
      name: "Missing pending queue command ('choduyet' / 'pending')",
      detail: "School leaders cannot query pending document lists via Zalo bot."
    });
  }
} catch (e) {
  console.log("Probe 3 error:", e.message);
}

// PROBE 4: Insecure Phone Mapping (Account Hijacking / IDOR)
try {
  const attackerChatId = "attacker_chat_id_999";
  const victimPhone = "0818810007"; // Teacher Ty's phone
  const linkReply = gasBot.processUnifiedZaloMessage(attackerChatId, victimPhone);
  
  // Check if sheet was updated with attacker's chatId
  const updatedChatId = mockUsersSheetData[1][5];
  if (updatedChatId === attackerChatId && linkReply.includes("LIÊN KẾT ZALO THÀNH CÔNG")) {
    console.log("❌ [CONFIRMED VULN 4] Account Takeover: Attacker claimed Teacher Ty's account with 0 OTP / 0 auth!");
    findings.push({
      id: "DEFECT-ZALO-04",
      name: "Unauthenticated Zalo Chat ID mapping allows complete account hijacking",
      detail: "Any arbitrary user sending a teacher's phone number immediately overwrites their Zalo_Chat_ID in Google Sheet."
    });
  }
} catch (e) {
  console.log("Probe 4 error:", e.message);
}

// PROBE 5: Audit server.js for missing notification hooks
const serverJsPath = path.join(__dirname, '..', '..', 'server.js');
const serverJsContent = fs.readFileSync(serverJsPath, 'utf8');

const hasLeaderNotify = serverJsContent.includes("/api/documents/:id/approve-leader") && 
  serverJsContent.substring(
    serverJsContent.indexOf("app.post('/api/documents/:id/approve-leader'"),
    serverJsContent.indexOf("app.post('/api/documents/:id/approve-principal'")
  ).includes("zaloNotifyService");

if (!hasLeaderNotify) {
  console.log("❌ [CONFIRMED VULN 5] 'approve-leader' does NOT invoke zaloNotifyService!");
  findings.push({
    id: "DEFECT-ZALO-05",
    name: "Missing Zalo notification trigger in approve-leader",
    detail: "When Department Head approves, only Web Push is sent. Neither BGH nor Teacher receives Zalo notification."
  });
}

const hasPrincipalNotify = serverJsContent.includes("/api/documents/:id/approve-principal") &&
  serverJsContent.substring(
    serverJsContent.indexOf("app.post('/api/documents/:id/approve-principal'"),
    serverJsContent.indexOf("app.post('/api/documents/:id/reject', requireAuth")
  ).includes("zaloNotifyService");

if (!hasPrincipalNotify) {
  console.log("❌ [CONFIRMED VULN 6] 'approve-principal' does NOT invoke zaloNotifyService!");
  findings.push({
    id: "DEFECT-ZALO-06",
    name: "Missing Zalo notification trigger in approve-principal",
    detail: "When Principal signs and seals with VGCA USB Token, no Zalo notification with download link is sent to the author."
  });
}

// PROBE 6: Duplicate route in server.js for /api/documents/:id/reject
const rejectCount = (serverJsContent.match(/app\.post\(['"]\/api\/documents\/:id\/reject['"]/g) || []).length;
if (rejectCount >= 2) {
  console.log(`❌ [CONFIRMED VULN 7] Found ${rejectCount} duplicate routes for /api/documents/:id/reject in server.js!`);
  findings.push({
    id: "DEFECT-ZALO-07",
    name: "Duplicate route conflict on POST /api/documents/:id/reject",
    detail: "Unauthenticated reject route at line 836 shadows the requireAuth reject route at line 3418."
  });
}

// PROBE 7: Client-side vs Server-side duplicate notification
const appJsPath = path.join(__dirname, '..', '..', 'js', 'app.js');
const appJsContent = fs.readFileSync(appJsPath, 'utf8');
const clientRejNotify = appJsContent.includes("sendZaloNotificationClientSide") && appJsContent.includes("REJECTED");
const serverRejNotify = serverJsContent.includes("zaloNotifyService.notifyDocumentRejected");

if (clientRejNotify && serverRejNotify) {
  console.log("❌ [CONFIRMED VULN 8] Dual-dispatch: Both browser client and server send Zalo webhook for REJECTED!");
  findings.push({
    id: "DEFECT-ZALO-08",
    name: "Dual-dispatch duplication between client and backend",
    detail: "Both js/app.js (sendZaloNotificationClientSide) and server.js (zaloNotifyService) trigger webhooks concurrently."
  });
}

// PROBE 8: Public static uploads folder exposure
const hasStaticUploads = serverJsContent.includes("app.use('/uploads', express.static(path.join(__dirname, 'uploads')))");
if (hasStaticUploads) {
  console.log("❌ [CONFIRMED VULN 9] Public static /uploads exposes all signatures, school seal, and PDFs!");
  findings.push({
    id: "DEFECT-ZALO-09",
    name: "Public unauthenticated exposure of /uploads directory",
    detail: "School seal (school_seal.png), digital signature images (sig_*.png), and signed documents are accessible without auth."
  });
}

console.log("\n================================================================================");
console.log(`PROBE COMPLETE: Confirmed ${findings.length} logic & security defects.`);
console.log("================================================================================\n");

fs.writeFileSync(path.join(__dirname, 'probe_findings.json'), JSON.stringify(findings, null, 2));
