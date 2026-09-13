@echo off
setlocal enabledelayedexpansion
title CopyGuard
cd /d "%~dp0"

:: ── Check Node.js ─────────────────────────────────────────────
node --version >nul 2>nul
if errorlevel 1 (
    echo.
    echo  Node.js not found.
    echo  Install the LTS version from nodejs.org, then double-click this file again.
    echo.
    pause
    start https://nodejs.org/en/download/
    exit /b 1
)

:: ── Install Electron + dependencies on first launch ───────────
if not exist "node_modules\electron" (
    echo.
    echo  First launch - setting up CopyGuard...
    echo  This downloads Electron (~50MB) and takes about 2 minutes.
    echo.
    call npm install --prefer-offline
    if errorlevel 1 (
        echo.
        echo  Setup failed. Check your internet connection and try again.
        pause
        exit /b 1
    )
    echo.
    echo  Done! Starting CopyGuard...
    echo.
)

:: ── Launch ────────────────────────────────────────────────────
start "" /B npx electron . --no-sandbox
exit /b 0
