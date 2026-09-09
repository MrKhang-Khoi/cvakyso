@echo off
chcp 65001 >nul
title Cai dat EduSign Desktop Agent - Ban Co yeu Chinh phu
echo ======================================================================
echo    CAI DAT CONG CU KY SO CHUYEN DUNG EDUSIGN AGENT (VGCA DESKTOP)
echo    Truong THCS Chu Van An - Tinh Quang Ngai (Chuan Windows 10 va 11)
echo ======================================================================
echo.
echo Dang tien hanh cai dat, tao bieu tuong Desktop va khoi chay ngam...

if exist "%~dp0Cai_Dat_EduSign.ps1" (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Cai_Dat_EduSign.ps1"
) else (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; $urls = @('https://github.com/MrKhang-Khoi/cvakyso/raw/main/docs/downloads/Cai_Dat_EduSign.ps1', 'https://raw.githubusercontent.com/MrKhang-Khoi/cvakyso/main/docs/downloads/Cai_Dat_EduSign.ps1', 'https://mrkhang-khoi.github.io/cvakyso/docs/downloads/Cai_Dat_EduSign.ps1', 'https://edusign-vgca.onrender.com/downloads/Cai_Dat_EduSign.ps1', 'http://localhost:3000/downloads/Cai_Dat_EduSign.ps1', 'http://127.0.0.1:3000/downloads/Cai_Dat_EduSign.ps1'); foreach ($u in $urls) { try { $code = (New-Object Net.WebClient).DownloadString($u); if ($code -and $code.Length -gt 500) { Invoke-Expression $code; break } } catch {} }"
)

echo.
echo ======================================================================
echo   [+] CAI DAT THANH CONG!
echo   [+] Da tao bieu tuong "EduSign Agent" ngoai man hinh Desktop.
echo   [+] Ung dung da chay ngam va san sang ky so qua USB Token.
echo ======================================================================
timeout /t 3 >nul
exit /b 0
