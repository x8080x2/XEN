@echo off
title Email Sender Desktop App
echo ================================================
echo   Email Sender Desktop App - Build and Run
echo ================================================
echo.

echo [1/3] Building application...
echo.
call npm run build
if errorlevel 1 (
    echo.
    echo ❌ Build failed! Check the error above.
    echo.
    pause
    exit /b 1
)

echo.
echo ✅ Build completed successfully!
echo.
echo [2/3] Starting Email Sender Desktop App...
echo.
call npm run electron

echo.
echo ================================================
echo Application closed
echo ================================================
echo.
pause
