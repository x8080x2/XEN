@echo off
title Email Sender Desktop - Installation
color 0A
cls

echo ====================================================
echo   Email Sender Desktop - Installation Script
echo ====================================================
echo.
echo Current directory: %CD%
echo.

if not exist "package.json" (
    color 0C
    echo [ERROR] package.json not found!
    echo Please make sure you are running this script from the user-package directory.
    echo.
    goto :error
)

where node >nul 2>nul
if errorlevel 1 (
    color 0C
    echo [ERROR] Node.js is not installed!
    echo Please download and install Node.js from https://nodejs.org/
    echo.
    goto :error
)

echo [INFO] Node.js version:
node --version
echo [INFO] npm version:
npm --version
echo.

echo [INSTALL] Installing project dependencies...
echo This may take a few minutes...
echo.

npm install

if errorlevel 1 (
    color 0C
    echo.
    echo [ERROR] npm install failed!
    echo Please check the error messages above.
    echo.
    goto :error
)

color 0A
echo.
echo ====================================================
echo   Installation Complete!
echo ====================================================
echo.
echo [SUCCESS] All dependencies installed successfully!
echo.
echo To start the application, run: start-build.bat
echo.
pause
exit /b 0

:error
echo.
echo Installation failed. Press any key to exit...
pause >nul
exit /b 1
