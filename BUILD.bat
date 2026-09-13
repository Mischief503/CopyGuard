@echo off
setlocal
title CopyGuard Builder
color 0A
cls

echo.
echo  ============================================================
echo   CopyGuard Builder
echo   Produces a self-contained CopyGuard-Setup.exe
echo   Recipients need NOTHING installed to run it.
echo  ============================================================
echo.

:: Check Node.js
node --version >nul 2>nul
if errorlevel 1 (
    echo  [!] Node.js required to BUILD (not to run the app).
    echo      Install from nodejs.org/en/download - LTS version.
    pause
    start https://nodejs.org/en/download/
    exit /b 1
)

echo  Node.js found: 
node --version
echo.

:: Install dependencies
echo  Installing build dependencies...
call npm install --silent
if errorlevel 1 ( echo  [!] npm install failed. & pause & exit /b 1 )

echo  Building Windows installer...
echo  (Downloads ~150MB Electron binary first time - please wait)
echo.
call npm run dist:win

echo.
if exist "dist-build\*.exe" (
    echo  ============================================================
    echo   SUCCESS! Installer is ready in the dist-build\ folder.
    echo.
    dir /b "dist-build\*.exe"
    echo.
    echo   Share that .exe file with anyone.
    echo   They double-click it - CopyGuard installs and launches.
    echo   No Node.js, no npm, nothing else required.
    echo  ============================================================
    echo.
    explorer dist-build
) else (
    echo  [!] Build may have failed - check output above.
)
pause
