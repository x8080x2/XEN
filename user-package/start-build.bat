@echo off
echo ====================================================
echo   Email Sender Desktop - Build and Launch
echo ====================================================
echo.

REM Validate license before building
node validateLicense.js
if %ERRORLEVEL% neq 0 (
    echo.
    echo Build cancelled due to license validation failure.
    pause
    exit /b 1
)

echo.
echo Building application...
npm run build
if %ERRORLEVEL% neq 0 (
    echo Build failed!
    pause
    exit /b 1
)

echo.
echo Starting Email Sender Desktop App...
npm run electron
