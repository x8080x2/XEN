@echo off
setlocal enabledelayedexpansion
title Email Sender - Stopping Server

echo ================================================================
echo                    Email Sender - Stopping
echo ================================================================
echo.

rem Configuration - must match the PORT in Start-Email-Sender.cmd
set PORT=5000
set "FOUND_PROCESS=false"

echo Stopping Email Sender on port %PORT%...
echo.

rem Find and kill process using the port
for /f "tokens=5" %%a in ('netstat -aon ^| find ":%PORT%" ^| find "LISTENING"') do (
    echo Found process ID: %%a
    set "FOUND_PROCESS=true"
    taskkill /PID %%a /F >nul 2>&1
    if !ERRORLEVEL! equ 0 (
        echo Email Sender stopped successfully (PID: %%a^)
    ) else (
        echo Warning: Failed to stop process %%a
    )
)

if "!FOUND_PROCESS!"=="false" (
    echo No Email Sender process found on port %PORT%
    echo The server may already be stopped.
)

echo.
echo ================================================================
echo    Email Sender shutdown complete.
echo    
echo    You can restart it anytime with Start-Email-Sender.cmd
echo ================================================================
echo.
pause