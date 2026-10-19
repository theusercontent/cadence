@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Cadence Launcher
set "APP_URL=http://127.0.0.1:4173/"

set "NODE=%~dp0runtime\node.exe"
if not exist "%NODE%" (
  set "NODE=node"
  where node >nul 2>nul
  if errorlevel 1 (
    echo.
    echo  Cadence cannot start because no Node.js runtime was found.
    echo  Run requirements.bat for details.
    echo.
    pause
    exit /b 1
  )
)

if not exist "%~dp0app\index.html" (
  echo.
  echo  Cadence is missing its app files.
  echo  Extract the complete ZIP again, keeping every folder together.
  echo.
  pause
  exit /b 1
)

rem If Cadence is already running, just open it instead of starting a second copy.
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ProgressPreference='SilentlyContinue'; try { $r=Invoke-WebRequest -UseBasicParsing '%APP_URL%' -TimeoutSec 2; if ($r.StatusCode -eq 200) { exit 0 } } catch {}; exit 1" >nul 2>nul
if not errorlevel 1 (
  start "" "%APP_URL%"
  exit /b 0
)

set "CADENCE_OPEN=1"
start "Cadence Server" /min "%NODE%" "%~dp0server.mjs"
exit /b 0
