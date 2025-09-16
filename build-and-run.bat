
@echo off
echo Building and running XEN Email Sender...
echo.

echo Step 1: Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo Step 2: Building the project...
call npm run build
if %errorlevel% neq 0 (
    echo ERROR: Build failed
    pause
    exit /b 1
)

echo.
echo Step 3: Starting the application...
echo Opening browser automatically...
set NODE_ENV=production
node dist/index.js

echo.
echo Application stopped. Press any key to exit.
pause
