@echo off
setlocal
title Email Sender - Update

echo ================================================================
echo                    Email Sender - Update
echo ================================================================
echo.

echo [1/3] Stopping any running instances...
call Stop-Email-Sender.cmd

echo.
echo [2/3] Updating dependencies...
call npm ci
if %ERRORLEVEL% neq 0 (
    echo ERROR: Failed to update dependencies
    pause
    exit /b 1
)

echo.
echo [3/3] Rebuilding application...
call npm run build:server
if %ERRORLEVEL% neq 0 (
    echo ERROR: Failed to rebuild application
    pause
    exit /b 1
)

echo.
echo ================================================================
echo    Update completed successfully!
    echo    
    echo    Your Email Sender has been updated to the latest version.
    echo    Run Start-Email-Sender.cmd to launch the updated application.
echo ================================================================
echo.
pause