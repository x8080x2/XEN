@echo off
setlocal
title Email Sender - Starting Server

echo ================================================================
echo                    Email Sender - Starting
echo ================================================================

rem Load configuration from setup.ini file
set PORT=5000
set CLIENT_VERSION=1.0.0
set NODE_ENV=production

rem Check if configuration file exists
if not exist "config\setup.ini" (
    echo ERROR: Configuration file not found!
    echo Please make sure config\setup.ini exists with your license key.
    echo Run Install-Email-Sender.cmd first to set up configuration.
    pause
    exit /b 1
)

rem Read backend URL from config file
for /f "tokens=1,2 delims==" %%a in ('type config\setup.ini ^| findstr "MAIN_BACKEND_URL="') do set MAIN_BACKEND_URL=%%b
for /f "tokens=1,2 delims==" %%a in ('type config\setup.ini ^| findstr "LICENSE_KEY="') do set LICENSE_KEY=%%b

rem Validate configuration
if "%MAIN_BACKEND_URL%"=="" (
    echo ERROR: MAIN_BACKEND_URL not configured in config\setup.ini
    echo Please contact support for configuration instructions.
    pause
    exit /b 1
)

if "%LICENSE_KEY%"=="" (
    echo ERROR: LICENSE_KEY not configured in config\setup.ini
    echo Please edit config\setup.ini with your license key.
    pause
    exit /b 1
)

if "%LICENSE_KEY%"=="ENTER-YOUR-LICENSE-KEY-HERE" (
    echo ERROR: LICENSE_KEY not set in config\setup.ini
    echo Please edit config\setup.ini with your actual license key.
    pause
    exit /b 1
)

echo Starting Email Sender on port %PORT%...
echo Backend URL: %MAIN_BACKEND_URL%
echo.

echo Checking if port %PORT% is available...
netstat -an | find ":%PORT%" | find "LISTENING" >nul
if %ERRORLEVEL% equ 0 (
    echo WARNING: Port %PORT% is already in use!
    echo Please stop any existing Email Sender instances or change PORT in this script.
    pause
    exit /b 1
)

echo Starting server...
start "Email Sender Server" cmd /c "npm start & pause"

echo Waiting for server to start...
set /a attempts=0
:wait_loop
set /a attempts+=1
timeout /t 2 >nul
curl -s http://localhost:%PORT% >nul 2>&1
if %ERRORLEVEL% equ 0 goto server_ready
if %attempts% geq 15 (
    echo ERROR: Server failed to start after 30 seconds
    echo Check the server window for error messages
    pause
    exit /b 1
)
goto wait_loop

:server_ready
echo.
echo ================================================================
echo    Email Sender is now running!
echo    
echo    Server URL: http://localhost:%PORT%
echo    Opening in your default browser...
echo    
echo    To stop the server, close the server window or run:
echo    Stop-Email-Sender.cmd
echo ================================================================
echo.

rem Open the application in default browser
start "" http://localhost:%PORT%/

echo Email Sender is ready to use!
echo Press any key to close this window...
pause >nul