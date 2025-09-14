
@echo off
echo Starting Email Sender User Package in Development Mode...
echo.

set NODE_ENV=development
npx tsx server/index.ts
