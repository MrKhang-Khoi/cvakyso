# DISPATCH ASSIGNMENT — Deployment Worker

- Working Directory: `c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\worker_deploy_m5`
- Parent: `teamwork_preview_orchestrator_5`

## Mission
1. Cập nhật tài liệu `HUONG_DAN_CAP_NHAT_CODE_GS.md` tại thư mục gốc của dự án:
   - Bổ sung nội dung cập nhật R3: Bảo mật tuyệt đối Zalo Bot, bỏ hoàn toàn gợi ý 4 số cuối SĐT, cú pháp chuẩn `LK [SốĐiệnThoại] [MãPIN]`, kiểm soát chặt chẽ `secretPin === storedPin`.
   - Hướng dẫn Quản trị viên trường cách copy code mới `google-apps-script-zalo-edusign.js` và Deploy Web App phiên bản mới trên Google Apps Script.
2. Thực hiện kiểm tra git status, git add, git commit với thông điệp:
   `feat(edusign): hoàn tất R1 modal 2 cột không cuộn, R2 đồng bộ PIN realtime, R3 bảo mật Zalo Bot bỏ 4 số cuối SĐT, R4 dọn sạch 100% rác, R5 tải mẫu và nhập Excel SheetJS`
3. Thực hiện `git push origin main`.
4. Báo cáo kết quả và commit hash trong `handoff.md` và gửi tin nhắn qua `send_message`.

## 2026-09-15T07:05:39Z

You are the Deployment Worker (`worker_deploy_m5`) for EduSign VGCA.
Your working directory is: `c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\worker_deploy_m5`.
You must maintain `progress.md` and write your final report to `handoff.md` in your working directory.

Please read:
- `c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\ORIGINAL_REQUEST.md`
- `c:\Users\HPZBook\Desktop\KÝ SỐ\.agents\worker_deploy_m5\DISPATCH.md`

Your tasks:
1. Update `HUONG_DAN_CAP_NHAT_CODE_GS.md` in the project root:
   - Add detailed instructions regarding the R3 security upgrade in `google-apps-script-zalo-edusign.js`:
     * Complete removal of the 4-last-digits phone fallback.
     * New secure syntax: `LK [SốĐiệnThoại] [MãPIN]`.
     * Strict check `secretPin === storedPin`.
     * Instructions for school administrators on copying the new script to script.google.com and deploying a New Web App version.
2. Check git status. Stage all modified and new project files (HTML, JS, tests, scripts, screenshots, markdown docs).
3. Commit with message:
   `feat(edusign): hoàn tất R1 modal 2 cột không cuộn, R2 đồng bộ PIN realtime, R3 bảo mật Zalo Bot bỏ 4 số cuối SĐT, R4 dọn sạch 100% rác, R5 tải mẫu và nhập Excel SheetJS`
4. Execute `git push origin main`.
5. Report the commit hash, push status, and verification in `handoff.md` and via `send_message`.
