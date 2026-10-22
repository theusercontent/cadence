@echo off
setlocal EnableExtensions
title OpenCode Uninstaller for Windows
color 0E

set "PURGE=0"
set "DRYRUN=0"
set "ASSUME_YES=0"

:parse_args
if "%~1"=="" goto :args_done
if /I "%~1"=="--purge" set "PURGE=1"
if /I "%~1"=="--dry-run" set "DRYRUN=1"
if /I "%~1"=="--yes" set "ASSUME_YES=1"
if /I "%~1"=="-y" set "ASSUME_YES=1"
if /I "%~1"=="--help" goto :usage
if /I "%~1"=="-h" goto :usage
shift
goto :parse_args
:args_done

echo.
echo  ============================================================
echo    OpenCode Uninstaller for Windows
echo  ============================================================
echo.
echo  This removes the OpenCode program from this account.
echo  Sessions, settings, and credentials are KEPT by default.
echo.
echo  IMPORTANT: Close every OpenCode window and terminal first.
echo  Do not run this from inside an OpenCode session.
echo.

if "%DRYRUN%"=="1" echo  [DRY RUN] No changes will be made.
if "%DRYRUN%"=="1" echo.

set "HAD_STANDALONE=0"
if exist "%USERPROFILE%\.opencode\bin\opencode.exe" set "HAD_STANDALONE=1"

if "%PURGE%"=="1" goto :purge_chosen
if "%ASSUME_YES%"=="1" goto :purge_chosen
if "%DRYRUN%"=="1" goto :purge_chosen
choice /C YN /N /T 20 /D N /M "Also reset settings, sessions, and sign-ins? A backup will be kept. [Y/N] "
if errorlevel 2 goto :purge_chosen
set "PURGE=1"
:purge_chosen

if "%ASSUME_YES%"=="1" goto :confirmed
choice /C YN /N /T 30 /D N /M "Continue with the uninstall? [Y/N] "
if errorlevel 2 goto :cancelled
:confirmed

echo.
echo  [1/5] Checking for running OpenCode processes...
tasklist /FI "IMAGENAME eq opencode.exe" /NH 2>nul | find /I "opencode.exe" >nul
if errorlevel 1 goto :no_running

echo  OpenCode is currently running.
if "%ASSUME_YES%"=="1" goto :close_running
choice /C YN /N /T 20 /D N /M "Close all OpenCode processes now? [Y/N] "
if errorlevel 2 goto :still_running
:close_running
if "%DRYRUN%"=="1" goto :no_running
taskkill /F /T /IM opencode.exe >nul 2>&1
taskkill /F /T /IM opencode-desktop.exe >nul 2>&1
echo  OpenCode processes closed.
:no_running

echo.
echo  [2/5] Stopping the background service...
where opencode >nul 2>&1
if errorlevel 1 goto :service_done
if "%DRYRUN%"=="1" goto :service_done
call opencode service stop >nul 2>&1
:service_done
echo  Background service stopped or was not running.

echo.
echo  [3/5] Running the OpenCode uninstaller...
where opencode >nul 2>&1
if errorlevel 1 goto :manual_remove
if not "%DRYRUN%"=="1" goto :run_official
call opencode uninstall --dry-run
goto :cleanup
:run_official
call opencode uninstall --force
if errorlevel 1 goto :manual_remove
goto :cleanup

:manual_remove
echo.
echo  The built-in uninstaller was not available. Using manual cleanup.
where npm >nul 2>&1
if errorlevel 1 goto :cleanup
if "%DRYRUN%"=="1" (
  echo   ^> npm uninstall -g @opencode/cli @opencode-ai/cli opencode-ai
  goto :cleanup
)
call npm uninstall -g @opencode/cli @opencode-ai/cli opencode-ai >nul 2>&1
if errorlevel 1 echo  Warning: npm reported an error while uninstalling.

:cleanup
echo.
echo  [4/5] Removing left-over OpenCode files...
set "NPM_PREFIX="
for /f "usebackq delims=" %%P in (`npm config get prefix 2^>nul`) do set "NPM_PREFIX=%%P"

if not defined NPM_PREFIX goto :cleanup_standalone
call :delete_file "%NPM_PREFIX%\opencode"
call :delete_file "%NPM_PREFIX%\opencode.cmd"
call :delete_file "%NPM_PREFIX%\opencode.ps1"
call :delete_file "%NPM_PREFIX%\opencode.exe"
call :delete_file "%NPM_PREFIX%\opencode2"
call :delete_file "%NPM_PREFIX%\opencode2.cmd"
call :delete_file "%NPM_PREFIX%\opencode2.ps1"
call :delete_file "%NPM_PREFIX%\opencode2.exe"
call :delete_dir  "%NPM_PREFIX%\node_modules\@opencode\cli"
call :delete_dir  "%NPM_PREFIX%\node_modules\@opencode-ai\cli"
call :delete_dir  "%NPM_PREFIX%\node_modules\opencode-ai"

:cleanup_standalone
call :delete_dir "%USERPROFILE%\.opencode\bin"
if "%HAD_STANDALONE%"=="1" call :remove_standalone_path

echo.
echo  [5/5] Finishing up...
if "%PURGE%"=="1" call :purge_data
if not "%PURGE%"=="1" echo  Your sessions and settings were kept.

echo.
echo  ============================================================
echo    Result
echo  ============================================================
where opencode >nul 2>&1
if errorlevel 1 (
  echo  OpenCode is no longer on your PATH.
) else (
  echo  WARNING: an "opencode" command is still visible here:
  where opencode
  echo  Open a new Command Prompt and check again.
)
echo.
echo  Next step: run install-opencode.bat
echo.
pause
exit /b 0

:purge_data
echo.
echo  Backing up and resetting OpenCode user data...
for /f "usebackq delims=" %%I in (`powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"`) do set "STAMP=%%I"
if not defined STAMP set "STAMP=%RANDOM%"
set "BACKUP=%USERPROFILE%\opencode-backup-%STAMP%"

if "%DRYRUN%"=="1" (
  echo   would move user data to: "%BACKUP%"
  exit /b 0
)

mkdir "%BACKUP%" >nul 2>&1
call :move_dir "%USERPROFILE%\.local\share\opencode" "%BACKUP%\share-opencode"
call :move_dir "%USERPROFILE%\.local\state\opencode" "%BACKUP%\state-opencode"
call :move_dir "%USERPROFILE%\.config\opencode" "%BACKUP%\config-opencode"
call :move_dir "%USERPROFILE%\.cache\opencode" "%BACKUP%\cache-opencode"
echo.
echo  A backup of your data is here:
echo    "%BACKUP%"
exit /b 0

:remove_standalone_path
if "%DRYRUN%"=="1" (
  echo   would remove "%USERPROFILE%\.opencode\bin" from your user PATH
  exit /b 0
)
powershell -NoProfile -ExecutionPolicy Bypass -Command "$d=Join-Path $env:USERPROFILE '.opencode\bin'; $p=[Environment]::GetEnvironmentVariable('Path','User'); if($p){ $parts=@($p.Split(';') | Where-Object { $_ -and $_.TrimEnd('\') -ne $d.TrimEnd('\') }); $new=($parts -join ';'); if($new -ne $p){ [Environment]::SetEnvironmentVariable('Path',$new,'User'); Write-Host '  Removed OpenCode from your user PATH.' } }"
exit /b 0

:delete_file
if not exist "%~1" exit /b 0
if "%DRYRUN%"=="1" (
  echo   would delete: "%~1"
  exit /b 0
)
del /F /Q "%~1" >nul 2>&1
if exist "%~1" echo  Warning: could not delete "%~1"
exit /b 0

:delete_dir
if not exist "%~1" exit /b 0
if "%DRYRUN%"=="1" (
  echo   would delete: "%~1"
  exit /b 0
)
rd /S /Q "%~1" >nul 2>&1
if exist "%~1" echo  Warning: could not delete "%~1"
exit /b 0

:move_dir
if not exist "%~1" exit /b 0
if "%DRYRUN%"=="1" (
  echo   would move: "%~1"
  exit /b 0
)
echo   moving: "%~1"
move "%~1" "%~2" >nul 2>&1
if errorlevel 1 (
  echo   Warning: could not move "%~1"
  echo   Close OpenCode and run this script again to back it up.
) else (
  echo   backed up.
)
exit /b 0

:cancelled
echo.
echo  Uninstall cancelled. Nothing was changed.
echo.
pause
exit /b 1

:still_running
echo.
echo  Uninstall cancelled. Close all OpenCode windows and terminals,
echo  then run this script again.
echo.
pause
exit /b 1

:usage
echo.
echo  Usage: uninstall-opencode.bat [options]
echo.
echo    --purge      Also reset settings, sessions, and sign-ins. A backup is kept.
echo    --dry-run    Show what would be done without changing anything.
echo    --yes, -y    Do not ask for confirmation. Keeps data unless --purge is used.
echo    --help       Show this help.
echo.
echo  By default the program is removed but your data is kept.
echo.
exit /b 0
