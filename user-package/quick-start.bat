@echo off
echo ====================================================
echo   Email Sender Desktop - Quick Start
echo ====================================================
echo.

REM Check if dist folder exists
if exist "dist\index.html" (
    echo [INFO] Found existing build in dist folder
    echo [INFO] Skipping rebuild, launching directly...
    echo.
    goto launch
)

echo [INFO] No existing build found, building now...
echo.

:build
echo Building application...
call npm run build
if errorlevel 1 (
    echo [ERROR] Build failed!
    pause
    exit /b 1
)

:launch
echo.
echo ====================================================
echo   Launching Electron App
echo ====================================================
echo.
call npm run electron
