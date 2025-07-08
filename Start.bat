@echo off
setlocal EnableDelayedExpansion
title CLI Password Manager
goto :main

color 0F

:divider
echo ==================================================
goto :eof

:main
where node >nul 2>nul
if errorlevel 1 (
    call :divider
    echo Node.js not found.
    echo Installing Node.js...
    powershell -Command "Set-ExecutionPolicy RemoteSigned -Scope CurrentUser -Force"
    powershell -Command "Invoke-WebRequest -Uri 'https://nodejs.org/dist/v22.16.0/node-v22.16.0-x64.msi' -OutFile '%TEMP%\node-v22.16.0-x64.msi'"
    if exist "%TEMP%\node-v22.16.0-x64.msi" (
        start /wait msiexec /i "%TEMP%\node-v22.16.0-x64.msi"
        del "%TEMP%\node-v22.16.0-x64.msi"
        echo Done. Restart this script.
        timeout /t 3 >nul
        exit
    ) else (
        echo Download failed. Get Node.js manually.
        pause
        exit /b
    )
    exit /b
)

cls
call :divider
echo CLI Password Manager v0.0.6
call :divider

if not exist "app" (
    echo 'app' folder missing.
    pause
    exit /b
)
cd /d app

if not exist "package.json" (
    echo 'package.json' not found.
    pause
    exit /b
)

call where node >nul 2>nul
if %errorlevel% neq 0 (
    echo Compile failed.
    pause
    exit /b
)

call npm install >nul 2>nul

call npx tsc >nul 2>nul
if %errorlevel% neq 0 (
    echo Compile failed.
    pause
    exit /b
)

echo Cleaning up...
rmdir /s /q node_modules >nul 2>nul
call npm install --omit-dev >nul 2>nul

echo Launching...
timeout /t 1 >nul

call node ./dist/src/index.js
if %errorlevel% neq 0 (
    echo App error.
    pause
)

pause
