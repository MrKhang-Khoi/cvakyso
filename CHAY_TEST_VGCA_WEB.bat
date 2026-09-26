@echo off
chcp 65001 >nul
title HỆ THỐNG THỬ NGHIỆM KÝ SỐ TỪ XA VGCA - TRƯỜNG THCS & THPT CHU VĂN AN
cls

echo ===============================================================================
echo   HỆ THỐNG KÝ SỐ TỪ XA CHUYÊN DÙNG CÔNG VỤ (VGCA WEB-DIRECT SIGNER)
echo   Trường THCS & THPT Chu Văn An - Phục Vụ Chuyển Đổi Số Giáo Dục
echo   Tiêu chuẩn: Nghị định 30/2020/NĐ-CP | ETSI TS 119 432 v2.0 | PAdES-B-T
echo ===============================================================================
echo.
echo [1/3] Đang chuyển hướng vào thư mục module vgca-web-signer...
cd /d "%~dp0vgca-web-signer"

echo [2/3] Đang khởi động giao diện kiểm thử trực quan...
start "" "http://localhost:8088"

echo [3/3] Đang kích hoạt Server Ký số Cổng 8088...
node test-ui-server.js

pause
