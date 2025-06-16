@echo off
setlocal EnableDelayedExpansion
title CLI Password Manager

:: === Color codes ===
::  0 - Black
::  1 - Blue
::  2 - Green
::  3 - Aqua
::  4 - Red
::  5 - Purple
::  6 - Yellow
::  7 - White
::  8 - Gray
::  9 - Light Blue
::  A - Light Green
::  B - Light Aqua
::  C - Light Red
::  D - Light Purple
::  E - Light Yellow
::  F - Bright White

color 0F
set "divider=echo. "

goto :main

:colorText
    setlocal
    set "colorCode=%~1"
    set "text=%~2"
    echo !text!
    endlocal
    goto :eof

:main
:: Check for Node.js
where node >nul 2>nul
if errorlevel 1 (
    call %divider%
    call :colorText "1;37" "    |----------------------------------------------|"
    call :colorText "1;31"  "   |        ! Node.js is not installed.           |"
    call :colorText "1;37"  "   |----------------------------------------------|"
    call %divider%
    call :colorText "1;33" "   [*] Node.js will now be installed automatically."
    call %divider%
    call :colorText "1;36" "   [*] Node.js is required to run this application."
    call :colorText "1;36" "   [*] The Node.js installer GUI will appear."
    call :colorText "1;36" "       Please leave all options as default and click 'Next' to finish."
    call %divider%

    call :colorText "1;36" "   [*] Security permissions will now be assigned temporarily to allow the script to run."
    timeout /t 3 >nul
    call powershell -Command "Set-ExecutionPolicy RemoteSigned -Scope CurrentUser -Force"

    call :colorText "1;33" "   [*] Downloading Node.js installer..."
    timeout /t 1 >nul

    call powershell -Command "Invoke-WebRequest -Uri 'https://nodejs.org/dist/v22.16.0/node-v22.16.0-x64.msi' -OutFile '%TEMP%\node-v22.16.0-x64.msi'"
    
    if exist "%TEMP%\node-v22.16.0-x64.msi" (
        call :colorText "1;33" "   [*] Running Node.js installer..."
        timeout /t 1 >nul
        start /wait msiexec /i node-v22.16.0-x64.msi
        del node-v22.16.0-x64.msi
        call :colorText "1;32" "   [*] Node.js installation complete. Please restart this script. This window will close in 5 seconds."
        timeout /t 5 >nul
        exit
    ) else (
        call :colorText "1;31" "   [*] Failed to download Node.js installer."
        timeout /t 1 >nul
        call :colorText "1;31" "   [*] Please download it manually from https://nodejs.org/dist/v22.16.0/node-v22.16.0-x64.msi"
        pause
        exit /b
    )
)

cls
call %divider%
call :colorText "1;37" "   |----------------------------------------------|"
call :colorText "1;31" "   |   CLI Password Manager - Alpha build v0.0.5  |"
call :colorText "1;37" "   |----------------------------------------------|"
call %divider%

call :colorText "1;33" "   [*] Starting application ..."
cd /d ./app

call npm install >nul 2>nul
if %errorlevel% neq 0 (
    call :colorText "1;31" "   [*] npm install failed."
    pause
    exit /b
)

call npx tsc >nul 2>nul
if %errorlevel% neq 0 (
    call :colorText "1;31" "   [*] Failed to compile."
    pause
    exit /b
)

call :colorText "1;33" "   [*] Cleaning up development dependencies ..."
call rmdir /s /q node_modules >nul 2>nul

call npm install --omit-dev >nul 2>nul

call :colorText "1;32" "   [*] Launching application ..."
timeout /t 1 >nul

call node .
if %errorlevel% neq 0 (
    pause
)

pause
