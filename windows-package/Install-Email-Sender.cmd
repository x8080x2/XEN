@echo off
setlocal enabledelayedexpansion
title Email Sender - Installation

echo ================================================================
echo                    Email Sender Installation
echo ================================================================
echo.

echo [1/4] Checking Node.js installation...
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo Node.js not found. Installing Node.js LTS via winget...
    echo.
    winget install -e --id OpenJS.NodeJS.LTS -h
    if !ERRORLEVEL! neq 0 (
        echo.
        echo ERROR: Could not install Node.js automatically.
        echo Please install Node.js LTS manually from: https://nodejs.org
        echo Then run this installer again.
        echo.
        pause
        exit /b 1
    )
    echo Node.js installed successfully!
    echo Please restart your command prompt and run this installer again.
    pause
    exit /b 0
) else (
    echo Node.js found: 
    node --version
)

echo.
echo [2/4] Installing dependencies...
call npm ci
if %ERRORLEVEL% neq 0 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo [3/4] Building application...
call npm run build:server
if %ERRORLEVEL% neq 0 (
    echo ERROR: Failed to build application
    pause
    exit /b 1
)

echo.
echo [4/4] Installation complete!
echo.
echo ================================================================
echo    Installation completed successfully!
echo    
echo    Next steps:
echo    1. Edit config\setup.ini with your license key
echo    2. Run Start-Email-Sender.cmd to launch the application
echo ================================================================
echo.
pause