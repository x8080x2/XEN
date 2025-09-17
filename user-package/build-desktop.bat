@echo off
echo Installing dependencies...
npm install

echo.
echo Building application...
npm run build

echo.
echo Starting Email Sender Desktop App...
npm run electron

pause