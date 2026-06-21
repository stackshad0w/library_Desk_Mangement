@echo off
title Swami Abhyasika - Library Management
cd /d "%~dp0"

echo ==================================================
echo    Swami Abhyasika - Library Management System
echo ==================================================
echo.

REM --- Make sure Node.js is installed ---
where node >nul 2>nul
if errorlevel 1 echo [!] Node.js is not installed on this computer.
if errorlevel 1 echo     Please install it (version 22.13 or newer) from:
if errorlevel 1 echo         https://nodejs.org
if errorlevel 1 echo     Then double-click this file again.
if errorlevel 1 echo.
if errorlevel 1 pause
if errorlevel 1 exit /b 1

REM --- First-time setup: install components ---
if not exist "node_modules" echo First-time setup: installing components. This can take a minute...
if not exist "node_modules" call npm install
if not exist "node_modules" echo.

REM --- Create a local settings file once (keeps you logged in across restarts) ---
if not exist ".env" node -e "const c=require('crypto'),fs=require('fs');fs.writeFileSync('.env','JWT_SECRET='+c.randomBytes(32).toString('hex')+'\r\nPORT=3000\r\n')"

echo Starting the library system...
echo.
echo   * Keep THIS window open while you use the app.
echo   * The app opens in your browser at:  http://localhost:3000
echo   * To stop the app, just close this window.
echo.

REM --- Open the browser a few seconds after the server starts ---
start "" cmd /c "timeout /t 4 >nul & start http://localhost:3000"

REM --- Start the server (keeps running until this window is closed) ---
call npm start

echo.
echo The library system has stopped. You can close this window.
pause
