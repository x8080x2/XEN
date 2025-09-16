
@echo off
echo XEN Email Sender - Installation Script
echo ====================================
echo.

echo Step 1: Checking Node.js installation...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo Node.js found!
node --version

echo.
echo Step 2: Installing project dependencies...
call npm install
if %errorlevel% neq 0 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo Step 3: Initial build...
call npm run build
if %errorlevel% neq 0 (
    echo ERROR: Build failed
    pause
    exit /b 1
)

echo.
echo ====================================
echo Installation completed successfully!
echo ====================================
echo.
echo To run the application:
echo   - Development mode: dev.bat
echo   - Production mode: build-and-run.bat
echo.
pause
