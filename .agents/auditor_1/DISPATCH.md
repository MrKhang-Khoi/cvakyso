# DISPATCH ASSIGNMENT — Forensic Auditor (Integrity Forensics)

- Working Directory: `c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\auditor_1`
- Original Request: `c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\ORIGINAL_REQUEST.md`
- Worker Handoff: `c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\worker_r1_to_r5\handoff.md`

## Objectives:
Kiểm toán độc lập toàn diện về tính toàn vẹn (Integrity Forensics):
1. **Zero-Cheating & Zero-Hardcoding**:
   - Kiểm tra xem mã nguồn có bị hardcode chuỗi kết quả test, fake mock, bypass điều kiện, hay tạo facade dối gạt không.
   - Logic đồng bộ PIN, logic bảo mật Zalo Bot, logic đọc/ghi Excel SheetJS, logic 2 cột CSS có phải là giải pháp thực chất (genuine implementation) không.
2. **Mirror Consistency**:
   - Tính toán và so sánh SHA-256 hash của:
     * `index.html` vs `public/index.html` vs `docs/index.html`
     * `js/app.js` vs `public/js/app.js` vs `docs/js/app.js`
   - Bắt buộc 100% SHA256 match tuyệt đối giữa các bản mirror.
3. **Dọn dẹp Dữ liệu**:
   - Kiểm tra `data/documents.json`: có thực sự là mảng rỗng `[]` không, có còn sót bản ghi rác nào không.
4. **Đưa ra Phán Quyết (Binary Verdict)**:
   - Nếu phát hiện bất kỳ dấu hiệu gian lận nào -> `INTEGRITY VIOLATION` (với bằng chứng cụ thể).
   - Nếu trung thực, thực chất và toàn vẹn -> `CLEAN`.

## 2026-09-15T06:55:12Z
You are the Forensic Auditor (`teamwork_preview_auditor`) for EduSign VGCA.
Your working directory is: `c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\auditor_1`.
You must maintain `progress.md` and write your final report to `handoff.md` in your working directory.

Please read:
- `c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\ORIGINAL_REQUEST.md`
- `c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\worker_r1_to_r5\handoff.md`

Your tasks:
Execute comprehensive Forensic Integrity Checks across the codebase:
1. **Zero-Cheating / Anti-Hardcoding Audit**:
   - Inspect all modifications in `index.html`, `js/app.js`, `google-apps-script-zalo-edusign.js`, `scripts/clean_garbage_documents.js`, `tests/test_requirements_r1_to_r5.js`.
   - Check if there are any hardcoded test fixtures, fake mocks, conditional bypasses (`if (test) ...`), or dummy facades that pretend to pass tests without genuine implementation.
   - Verify that PIN sync, Zalo Bot auth, SheetJS Excel import, and modal layouts are 100% genuine and fully functional.
2. **Mirror Consistency Audit**:
   - Compute SHA-256 for:
     * `index.html`, `public/index.html`, `docs/index.html`
     * `js/app.js`, `public/js/app.js`, `docs/js/app.js`
   - Confirm 100% identical SHA-256 hashes across all 3 mirrors.
3. **Data Hygiene Audit**:
   - Verify `data/documents.json` is clean and contains 0 test records (`[]`).
4. Deliver a strict binary verdict in `handoff.md`:
   - `CLEAN`: If 100% genuine, 0 cheating, 0 facade, 100% mirror match.
   - `INTEGRITY VIOLATION`: If any cheating, bypass, or fake logic is found.
Report your verdict and full evidence via `send_message`.
