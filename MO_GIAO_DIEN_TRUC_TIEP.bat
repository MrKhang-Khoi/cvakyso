@echo off
chcp 65001 >nul
title HỆ THỐNG KÝ SỐ ĐIỆN TỬ - THCS CHU VĂN AN (BẢN TEST FIX)
color 0B
echo =========================================================================
echo   TRƯỜNG THCS CHU VĂN AN - HỆ THỐNG KÝ SỐ ĐIỆN TỬ EDUSIGN
echo   Phiên bản thử nghiệm thực tế (Nhánh fix/safe-hardening)
echo =========================================================================
echo.
echo Đang mở giao diện Ký số trên trình duyệt của Thầy/Cô...
start "" "%~dp0index.html"
echo.
echo [OK] Đã mở giao diện thành công!
echo.
echo Tài khoản thử nghiệm có sẵn:
echo   - Giáo viên: cva.ty (Thầy Hà Văn Tý - Tổ Toán Tin)
echo   - Quản trị:  admin  (Ban Giám hiệu - Quản trị viên)
echo.
echo Thầy/Cô hãy kiểm tra nút "Làm mới" trên Header và Tab Bar!
echo.
timeout /t 5 >nul
