@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Cadence Requirements Check
echo.
echo  Cadence Offline - Requirements Check
echo  ====================================
echo.

if exist "runtime\node.exe" (
  echo  [OK] Bundled Node.js runtime found:
  ".\runtime\node.exe" --version
) else (
  where node >nul 2>nul
  if errorlevel 1 (
    echo  [MISSING] No bundled or system Node.js runtime was found.
    echo            Extract the complete ZIP again.
  ) else (
    echo  [OK] System Node.js runtime found:
    node --version
  )
)

echo.
if exist "app\index.html" (
  echo  [OK] Cadence app files found.
) else (
  echo  [MISSING] Cadence app files are missing.
  echo            Extract the complete ZIP again.
)

if exist "app\sw.js" (
  echo  [OK] Offline service worker found.
) else (
  echo  [MISSING] Offline service worker is missing.
  echo            Extract the complete ZIP again.
)

if exist "server.mjs" (
  echo  [OK] Local server found.
) else (
  echo  [MISSING] Local server is missing.
  echo            Extract the complete ZIP again.
)

echo.
echo  No internet connection, account, npm install, or extra downloads
echo  are required. The portable Node runtime is included.
echo.
echo  Supported: Windows 10/11 with Chrome, Edge, or Firefox.
echo  Start Cadence by double-clicking run.bat.
echo.
pause
