
@echo off
echo Starting XEN Email Sender in Development Mode...
echo.

echo Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo Starting development server...
echo Browser should open automatically at http://localhost:5000
set NODE_ENV=development
call npm run dev
