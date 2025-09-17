@echo off
echo Installing dependencies...
npm install

echo.
echo Starting Email Sender Desktop App...
echo.
echo Development mode (with developer tools):
npm run electron-dev

pause