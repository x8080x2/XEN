@echo off
echo ====================================================
echo   Email Sender Desktop - Installation Script
echo ====================================================
echo.

:: Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not installed!
    echo Please download and install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

:: Display Node and npm versions
echo [INFO] Node.js version:
node --version
echo [INFO] npm version:
npm --version
echo.

:: Clean previous installations (optional - uncomment if needed)
:: echo [CLEAN] Removing old node_modules...
:: if exist node_modules rmdir /s /q node_modules
:: if exist package-lock.json del package-lock.json
:: echo.

:: Install dependencies
echo [INSTALL] Installing project dependencies...
echo This may take a few minutes...
echo.

npm install

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] npm install failed!
    echo Please check the error messages above.
    pause
    exit /b 1
)

echo.
echo ====================================================
echo   Installation Complete!
echo ====================================================
echo.
echo To start the application, run: start-build.bat
echo.
pause