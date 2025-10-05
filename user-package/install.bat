@echo off
setlocal enabledelayedexpansion

:: Force the window to stay open
if not "%1"=="am_admin" (
    start "" /wait cmd /c "%~f0" am_admin
    exit /b
)

title Email Sender Desktop - Installation
color 0A
cls

echo ====================================================
echo   Email Sender Desktop - Installation Script
echo ====================================================
echo.
echo Script started successfully!
echo Current directory: %CD%
echo.
echo Press any key to continue...
pause >nul
echo.

:: Check if package.json exists in current directory
if not exist "package.json" (
    color 0C
    echo [ERROR] package.json not found!
    echo.
    echo Please make sure you are running this script from the user-package directory.
    echo Current location: %CD%
    echo.
    echo Press any key to exit...
    pause >nul
    exit /b 1
)

echo [OK] package.json found!
echo.

:: Check if Node.js is installed
where node >nul 2>nul
if errorlevel 1 (
    color 0C
    echo [ERROR] Node.js is not installed!
    echo.
    echo Please download and install Node.js from https://nodejs.org/
    echo.
    echo Press any key to exit...
    pause >nul
    exit /b 1
)

echo [OK] Node.js is installed!
echo.

:: Display Node and npm versions
echo [INFO] Node.js version:
node --version
echo.
echo [INFO] npm version:
npm --version
echo.

:: Install dependencies
echo ====================================================
echo   Installing Dependencies
echo ====================================================
echo.
echo [INSTALL] Installing project dependencies...
echo This may take a few minutes. Please wait...
echo.

call npm install

if errorlevel 1 (
    color 0C
    echo.
    echo ====================================================
    echo [ERROR] npm install failed!
    echo ====================================================
    echo.
    echo Please check the error messages above.
    echo.
    echo Press any key to exit...
    pause >nul
    exit /b 1
)

color 0A
echo.
echo ====================================================
echo   Installation Complete!
echo ====================================================
echo.
echo [SUCCESS] All dependencies have been installed successfully!
echo.
echo To start the application, run: start-build.bat
echo.
echo ====================================================
echo.
echo Press any key to close this window...
pause >nul

endlocal
exit /b 0
