@echo off
echo ==================================================== & echo   Email Sender Desktop - Installation & echo ==================================================== & echo. & echo Installing dependencies... & echo.
npm install
if errorlevel 1 (echo Installation failed! & pause & exit /b 1)
echo. & echo Installation Complete! Run start-build.bat to start. & pause
