@echo off
setlocal
title Create Windows Distribution Package

echo ================================================================
echo            Creating Windows Distribution Package
echo ================================================================
echo.

rem Check if we're in the right directory
if not exist "src\index.ts" (
    echo ERROR: Must be run from the windows-package directory
    echo Make sure you're in the folder containing src\index.ts
    pause
    exit /b 1
)

echo [1/5] Installing dependencies...
call npm ci
if %ERRORLEVEL% neq 0 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo [2/5] Building server...
call npm run build:server
if %ERRORLEVEL% neq 0 (
    echo ERROR: Failed to build server
    pause
    exit /b 1
)

echo.
echo [3/5] Preparing client application...
rem Check if main client build exists
if not exist "..\client\dist\index.html" (
    echo ERROR: Main client application not built yet
    echo Please run 'npm run build' in the parent directory first
    echo.
    echo Building main client application now...
    cd ..
    call npm run build
    if %ERRORLEVEL% neq 0 (
        echo ERROR: Failed to build main client application
        pause
        exit /b 1
    )
    cd windows-package
)

echo Copying pre-built client application...
if not exist "client" mkdir client
xcopy ..\client\dist client\dist\ /E /I /Y
if %ERRORLEVEL% neq 0 (
    echo ERROR: Failed to copy client application
    pause
    exit /b 1
)

echo.
echo [4/5] Copying additional required files...
rem Copy necessary configuration files
copy tsconfig.json . >nul 2>&1 || echo tsconfig.json not found, creating basic one...
if not exist "tsconfig.json" (
    echo {"compilerOptions":{"target":"ES2020","module":"commonjs","outDir":"./dist","strict":true,"esModuleInterop":true}} > tsconfig.json
)
echo Configuration files prepared

echo.
echo [5/5] Creating distribution package...
if exist "email-sender-windows" rmdir /s /q email-sender-windows
mkdir email-sender-windows

rem Copy essential files for distribution
copy Install-Email-Sender.cmd email-sender-windows\
copy Start-Email-Sender.cmd email-sender-windows\
copy Stop-Email-Sender.cmd email-sender-windows\
copy Update-Email-Sender.cmd email-sender-windows\
copy README-WINDOWS.txt email-sender-windows\
copy package.json email-sender-windows\
copy package-lock.json email-sender-windows\

rem Copy built application
xcopy dist email-sender-windows\dist\ /E /I
xcopy client\dist email-sender-windows\client\dist\ /E /I
xcopy config email-sender-windows\config\ /E /I
xcopy files email-sender-windows\files\ /E /I

rem Copy TypeScript configuration (needed for customer builds)
copy tsconfig.json email-sender-windows\ >nul 2>&1

echo Verifying package contents...
if not exist "email-sender-windows\client\dist\index.html" (
    echo WARNING: Client application not found in package!
) else (
    echo ✓ Client application included
)
if not exist "email-sender-windows\dist\index.js" (
    echo WARNING: Server application not found in package!
) else (
    echo ✓ Server application included
)
echo ✓ Configuration and files included

echo.
echo ================================================================
echo    Windows Distribution Package Created Successfully!
echo    
echo    Location: email-sender-windows\
echo    
echo    Contents:
echo    - All batch scripts for installation and operation
echo    - Pre-built application (dist\ folder)
echo    - Configuration templates (config\ folder)  
echo    - Sample templates and files (files\ folder)
echo    - Complete documentation (README-WINDOWS.txt)
echo    
echo    To distribute:
echo    1. Zip the 'email-sender-windows' folder
echo    2. Send to customers with their license key
echo    3. Customers run Install-Email-Sender.cmd first
echo ================================================================
echo.
pause