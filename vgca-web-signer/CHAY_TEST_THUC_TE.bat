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
echo [1/3] Đang kiểm tra môi trường Node.js...
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [LỖI]: Không tìm thấy Node.js trên máy tính! Vui lòng cài đặt Node.js v18+.
    pause
    exit /b 1
)

echo [2/3] Đang khởi động Máy chủ Thử nghiệm Ký số (Cổng 8088 & Mock Ban Cơ yếu 8099)...
echo.
start "" "http://localhost:8088"

node test-ui-server.js

pause
