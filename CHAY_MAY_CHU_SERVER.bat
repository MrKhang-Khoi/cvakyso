@echo off
chcp 65001 >nul
title MÁY CHỦ EDUSIGN CỤC BỘ (PORT 3000)
color 0A
echo =========================================================================
echo   KHỞI ĐỘNG MÁY CHỦ EDUSIGN CỤC BỘ (FULL BACKEND API)
echo   Trường THCS Chu Văn An - Nhánh fix/safe-hardening
echo =========================================================================
echo.
echo Đang kiểm tra Node.js...
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [LỖI] Máy tính chưa nhận diện Node.js. Vui lòng mở bằng file MO_GIAO_DIEN_TRUC_TIEP.bat!
    pause
    exit /b 1
)

echo Đang khởi động Backend Server trên cổng 3000...
start cmd /k "title Backend Server CVA && node server.js"

echo Đợi máy chủ sẵn sàng trong 2 giây...
timeout /t 2 >nul

echo Đang mở trình duyệt tới địa chỉ http://localhost:3000...
start "" "http://localhost:3000"

echo.
echo [HOÀN TẤT] Máy chủ đang chạy ngầm và trình duyệt đã được mở!
echo.
pause
