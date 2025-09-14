
@echo off
echo Installing Email Sender User Package for Windows...
echo.

echo Step 1: Installing Node.js dependencies...
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo Error: Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo Step 2: Building application...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo Error: Failed to build application
    pause
    exit /b 1
)

echo.
echo Step 3: Checking environment configuration...
if not exist .env (
    echo Creating .env file from example...
    copy .env.example .env
    echo.
    echo IMPORTANT: Please edit .env file and set your MAIN_BACKEND_URL
    echo Example: MAIN_BACKEND_URL=https://your-replit-app.replit.dev
    echo.
)

echo.
echo Installation completed successfully!
echo.
echo To start the application:
echo   npm start
echo.
echo Or in development mode:
echo   npm run dev
echo.
pause
