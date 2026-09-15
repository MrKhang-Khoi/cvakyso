# BÁO CÁO ĐỐI SOÁT KIỂM THỬ THỰC NGHIỆM ĐỘC LẬP (CHALLENGER 1)
**Milestone**: Requirement 1 — Phone & PIN Data Integrity & Zalo Bot Verification  
**Agent**: Challenger 1 (Roles: Critic, Specialist)  
**Verdict**: `DEFECT_FOUND`  
**Date**: 2026-09-15  

---

## 1. Observation (Quan sát Thực nghiệm Trực tiếp)

### 1.1. Kết quả kiểm tra bộ test cơ bản có sẵn
Chạy lệnh thực tế:
```bash
node tests/test_r1_phone_pin_integrity.js
```
Kết quả:
```
📊 TỔNG KẾT KIỂM TOÁN DỮ LIỆU R1: 10/10 TESTS PASSED
🎉 TOÀN BỘ CÁC PHÉP THỬ TÍNH TOÀN VẸN SỐ ĐIỆN THOẠI & MÃ PIN ĐẠT 100%!
```
*Ghi chú*: Bộ test này chỉ kiểm tra unit test trên các hàm độc lập với dữ liệu chuẩn bị sẵn, chưa quét qua bộ định tuyến tin nhắn thực tế (`processUnifiedZaloMessage`) và chưa đưa các dữ liệu góc chết (adversarial edge cases) vào bài toán.

---

### 1.2. Kết quả kiểm thử đối kháng đa tầng (Adversarial Stress Test Suite)
Chạy lệnh kiểm thử độc lập:
```bash
node .agents/challenger_r1/stress_test_phone_pin.js
# hoặc
node tests/stress_test_r1_phone_pin.js
```
Kết quả đo đạc trực tiếp:
```
📊 ADVERSARIAL STRESS TEST SUMMARY: 32/39 PASSED (7 FAILED)
Verdict: DEFECT_FOUND
```

Bảng phân rã chi tiết từng nhóm kiểm thử:

| Suite | Nội dung kiểm thử | Số ca | Đạt (PASS) | Lỗi (FAIL) | Trạng thái |
|---|---|---|---|---|---|
| **Suite 1** | Phone Normalization Engine (`normalizePhone`) | 8 | 8 | 0 | 100% PASS |
| **Suite 2** | PIN Formats & padStart Defense | 8 | 7 | 1 | **FAIL: PIN 0000** |
| **Suite 3** | Legacy Sheet Simulation & Self-Healing | 5 | 5 | 0 | 100% PASS |
| **Suite 4** | Negative Security Tests | 5 | 4 | 1 | **FAIL: Security Isolation** |
| **Suite 5** | Zalo Bot Webhook NLP Router (`processUnifiedZaloMessage`) | 11 | 6 | 5 | **FAIL: Formatted Phones** |
| **Suite 6** | Sheet Write-Path Integrity (`handleSyncTeacher`) | 2 | 2 | 0 | 100% PASS |

---

### 1.3. Các lỗi cụ thể phát hiện được (Verbatim Observations & Errors)

#### 🔴 LỖI 1: Lỗi ép kiểu sai giá trị 0 (Falsy Zero Evaluation) đối với Mã PIN 0000
- **Tọa độ**: `google-apps-script-zalo-edusign.js:1536`
- **Mã nguồn thực tế**:
  ```javascript
  1536: storedPin = String(data[i][8] || "").replace(/^'+/, "").trim();
  ```
- **Hành vi lỗi thực nghiệm**:
  Khi Google Sheet tự động ép kiểu chuỗi `"0000"` thành số `0`, biểu thức `0 || ""` trong JavaScript trả về `""` (do số `0` là falsy).
  Hệ quả: `storedPin` bị rỗng `""`. Hàm bỏ qua bước bù `padStart(4, "0")` tại dòng 1547:
  ```javascript
  1547: if (storedPin && /^\d+$/.test(storedPin) && storedPin.length < 4) {
  1548:   storedPin = storedPin.padStart(4, "0");
  1549: }
  ```
  Và tại dòng 1558:
  ```javascript
  1558: var validPin = storedPin || phone4;
  ```
  `validPin` bị gán bằng `phone4` (4 số cuối số điện thoại).
  Khi giáo viên nhập đúng mã PIN `0000` của mình (`LK 0933445566 0000`), hệ thống từ chối xác thực:
  ```
  ❌ Mã PIN bảo mật không chính xác!
  💡 Thầy/Cô chỉ cần nhắn cú pháp kèm 4 số cuối SĐT (5566):
  👉 LK 0933445566 5566
  ```

---

#### 🔴 LỖI 2: Bộ định tuyến Zalo NLP Webhook chặn đứng các số điện thoại có định dạng
- **Tọa độ**: `google-apps-script-zalo-edusign.js:557` và dòng 566
- **Mã nguồn thực tế**:
  ```javascript
  557: var linkPattern = text.match(/^(LK|LIENKET)\s+([0-9]{9,11})\s+([0-9A-Za-z]{1,8})$/i);
  ```
- **Hành vi lỗi thực nghiệm**:
  Regex `([0-9]{9,11})` yêu cầu nghiêm ngặt 9 đến 11 ký tự số ASCII liền nhau, **hoàn toàn không hỗ trợ dấu cách, dấu gạch nối, dấu cộng, hoặc 12 chữ số** (như đầu số quốc tế `840...`).
  Dù hàm `normalizePhone` được viết rất chuẩn để xử lý `+84 818 810 007`, `840818810007`, `0905 123 456`, `+84-905-123-456`, nhưng tin nhắn của giáo viên gửi vào Bot đã bị chặn ngay từ cổng vào webhook tại dòng 557:
  - `LK +84 818 810 007 0007` ➔ `🤖 Trợ lý Trường học THCS Chu Văn An chưa nhận diện được yêu cầu`
  - `LK +84818810007 0007` ➔ `🤖 Trợ lý Trường học THCS Chu Văn An chưa nhận diện được yêu cầu`
  - `LK 840818810007 0007` ➔ `🤖 Trợ lý Trường học THCS Chu Văn An chưa nhận diện được yêu cầu`
  - `LK 0905 123 456 3456` ➔ `🤖 Trợ lý Trường học THCS Chu Văn An chưa nhận diện được yêu cầu`
  - `LK +84-905-123-456 3456` ➔ `🤖 Trợ lý Trường học THCS Chu Văn An chưa nhận diện được yêu cầu`

---

#### 🔴 LỖI 3: Lỗ hổng Bảo mật — Cho phép 4 số cuối SĐT vượt rào mã PIN bí mật của Giáo viên & Rò rỉ thông tin
- **Tọa độ**: `google-apps-script-zalo-edusign.js:1558-1561`
- **Mã nguồn thực tế**:
  ```javascript
  1557: var phone4 = normPhone.length >= 4 ? normPhone.slice(-4) : "1234";
  1558: var validPin = storedPin || phone4;
  1559: if (pinClean !== validPin && pinClean !== phone4) {
  1560:   return "❌ Mã PIN bảo mật không chính xác!\n\n💡 Thầy/Cô chỉ cần nhắn cú pháp kèm 4 số cuối SĐT (" + phone4 + "):\n👉 LK " + phoneInput + " " + phone4;
  1561: }
  ```
- **Hành vi lỗi thực nghiệm**:
  Điều kiện `pinClean !== validPin && pinClean !== phone4` tạo ra cơ chế **vượt rào vạn năng (Universal Bypass)**.
  Nếu một giáo viên chủ động đổi mã PIN bí mật sang chuỗi bảo mật cao (ví dụ: `9876` hoặc `ABCD`), bất kỳ ai biết số điện thoại của giáo viên đó (vốn là thông tin công khai trong danh bạ trường) chỉ cần gõ 4 số cuối số điện thoại là liên kết chiếm đoạt thành công tài khoản Zalo Bot của giáo viên đó!
  Đồng thời, tại dòng 1560, khi kẻ tấn công đoán sai PIN, hệ thống thông báo lộ luôn mã bypass 4 số cuối trong tin nhắn phản hồi:
  `💡 Thầy/Cô chỉ cần nhắn cú pháp kèm 4 số cuối SĐT (6677): 👉 LK 0944556677 6677`

---

## 2. Logic Chain (Chuỗi Lập luận & Suy luận Kỹ thuật)

1. **Từ Quan sát 1.1 và 1.2**: Bộ test sẵn có `test_r1_phone_pin_integrity.js` chỉ gọi hàm độc lập với dữ liệu chuỗi giả lập lý tưởng. Khi Challenger 1 đưa vào các tình huống thực tế của người dùng thật (gửi tin nhắn qua Zalo webhook, nhập số có định dạng, dữ liệu số 0 trên bảng tính), 7/39 ca kiểm thử lập tức thất bại.
2. **Từ Quan sát 1.3 - Lỗi 1**: Google Sheets có hành vi tự động ép kiểu các ô chứa chuỗi số `"0000"` thành giá trị kiểu số `0`. Do Javascript coi `0` là falsy, `0 || ""` trở thành `""`, biến một mã PIN hợp lệ thành rỗng, phá vỡ cam kết "bảo toàn số 0 ở đầu" của Requirement 1.
3. **Từ Quan sát 1.3 - Lỗi 2**: Regex phân tích cú pháp tin nhắn Zalo tại cổng Webhook quá cứng nhắc (`[0-9]{9,11}`), vô hiệu hóa hoàn toàn năng lực chuẩn hóa của hàm `normalizePhone` phía sau. Giáo viên sao chép số điện thoại từ danh bạ điện thoại (thường có dấu cách `0905 123 456` hoặc mã quốc tế `+84`) sẽ bị bot báo lỗi không nhận diện được cú pháp.
4. **Từ Quan sát 1.3 - Lỗi 3**: Mục tiêu của DEFECT-ZALO-04 trong bản vá trước là ngăn chặn chiếm đoạt tài khoản (Account Takeover). Tuy nhiên việc cho phép `pinClean === phone4` ngay cả khi đã có `storedPin` biến mã PIN bí mật thành vô nghĩa, vi phạm nguyên tắc bảo mật thông tin.
5. **Tổng hợp**: Việc triển khai Requirement 1 mặc dù đã đạt được các cải tiến lớn về `normalizePhone` và định dạng Text trên Sheet, nhưng vẫn tồn tại 3 khiếm khuyết kỹ thuật cụ thể. Vì vậy kết luận bắt buộc là **DEFECT_FOUND**.

---

## 3. Caveats (Phạm vi & Giới hạn)
- **Môi trường thực thi**: Các bài test được chạy trên máy tính lập trình viên thông qua Node.js VM giả lập đối tượng Google Apps Script (`SpreadsheetApp`, `UrlFetchApp`, `ContentService`).
- **Hành vi Google Sheets thật**: Trên Google Sheets thực tế của Google Cloud, khi một ô có giá trị số `0`, hàm `getValues()` trả về chính xác số `0` (Number). Điều này càng khẳng định kết quả thực nghiệm là hoàn toàn chính xác.

---

## 4. Conclusion & Actionable Patches (Kết luận & Đề xuất Bản vá Cụ thể)

**Phán quyết**: **DEFECT_FOUND** (Phát hiện 3 lỗi cần vá).

### 🛠️ Đoạn Code đề xuất sửa chữa chính xác (Verified Patches)

#### Vá Điểm 1: Chống lỗi falsy khi đọc ô số 0 trên Google Sheet
Tệp: `google-apps-script-zalo-edusign.js:1536`
```javascript
// TRƯỚC KHI SỬA:
storedPin = String(data[i][8] || "").replace(/^'+/, "").trim();

// SAU KHI SỬA (CHUẨN HÓA AN TOÀN):
var rawPinVal = data[i][8];
storedPin = (rawPinVal !== undefined && rawPinVal !== null) ? String(rawPinVal).replace(/^'+/, "").trim() : "";
```

#### Vá Điểm 2: Mở rộng Regex Webhook Zalo chấp nhận số điện thoại có dấu cách, dấu +, dấu -
Tệp: `google-apps-script-zalo-edusign.js:557` và dòng 566
```javascript
// TRƯỚC KHI SỬA:
var linkPattern = text.match(/^(LK|LIENKET)\s+([0-9]{9,11})\s+([0-9A-Za-z]{1,8})$/i);

// SAU KHI SỬA:
var linkPattern = text.match(/^(LK|LIENKET)\s+([\+0-9\s\-\.\(\)]{9,25})\s+([0-9A-Za-z]{1,8})$/i);
if (linkPattern) {
  if (chatId) {
    return handleSecurePhoneMapping(chatId, linkPattern[2].trim(), linkPattern[3].trim());
  }
}

// Và tại dòng 566 (cho phép đến 12 số để bao phủ đầu số 840...):
var rawDigits = text.replace(/[^0-9]/g, "");
if (rawDigits.length >= 9 && rawDigits.length <= 12 && !clean.startsWith("tkb") && !clean.startsWith("lop")) {
```

#### Vá Điểm 3: Cô lập bảo mật mã PIN tùy chỉnh, chỉ fallback phone4 khi chưa cài PIN
Tệp: `google-apps-script-zalo-edusign.js:1558-1561`
```javascript
// TRƯỚC KHI SỬA:
var phone4 = normPhone.length >= 4 ? normPhone.slice(-4) : "1234";
var validPin = storedPin || phone4;
if (pinClean !== validPin && pinClean !== phone4) {
  return "❌ Mã PIN bảo mật không chính xác!\n\n💡 Thầy/Cô chỉ cần nhắn cú pháp kèm 4 số cuối SĐT (" + phone4 + "):\n👉 LK " + phoneInput + " " + phone4;
}

// SAU KHI SỬA (BẢO VỆ TUYỆT ĐỐI MÃ PIN RIÊNG):
var phone4 = normPhone.length >= 4 ? normPhone.slice(-4) : "1234";
var validPin = storedPin || phone4;
if (pinClean !== validPin) {
  if (storedPin) {
    return "❌ Mã PIN bảo mật không chính xác!\n\n💡 Tài khoản của Thầy/Cô đã được cài đặt Mã PIN bảo mật riêng. Vui lòng kiểm tra lại tại website EduSign hoặc liên hệ Quản trị viên.";
  } else {
    return "❌ Mã PIN bảo mật không chính xác!\n\n💡 Thầy/Cô chỉ cần nhắn cú pháp kèm 4 số cuối SĐT (" + phone4 + "):\n👉 LK " + phoneInput + " " + phone4;
  }
}
```

---

## 5. Verification Method (Phương pháp Kiểm chứng Độc lập)

Người nhận báo cáo hoặc các Agent khác có thể tự kiểm chứng kết quả này qua 2 lệnh:

1. **Chạy kịch bản Stress Test đối kháng độc lập**:
   ```bash
   node .agents/challenger_r1/stress_test_phone_pin.js
   ```
   *Kỳ vọng*: Xuất hiện 7 ca kiểm thử FAILED trên bản code hiện tại, khẳng định phán quyết `DEFECT_FOUND`.

2. **Chạy kịch bản Thẩm định Bản vá Đề xuất**:
   ```bash
   node tests/test_verify_patches.js
   ```
   *Kỳ vọng*: 100% PASS (Tất cả 3 lỗi được triệt tiêu hoàn toàn, chấp nhận mọi định dạng số điện thoại, bảo toàn PIN 0000, và đóng kín lỗ hổng bypass mã PIN riêng).
