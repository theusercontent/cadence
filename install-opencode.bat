@echo off
setlocal EnableExtensions
title OpenCode Installer for Windows
color 0B

set "DRYRUN=0"
set "METHOD="
set "ASSUME_YES=0"

:parse_args
if "%~1"=="" goto :args_done
if /I "%~1"=="--dry-run" set "DRYRUN=1"
if /I "%~1"=="--npm" set "METHOD=2"
if /I "%~1"=="--standalone" set "METHOD=1"
if /I "%~1"=="--yes" set "ASSUME_YES=1"
if /I "%~1"=="-y" set "ASSUME_YES=1"
if /I "%~1"=="--help" goto :usage
if /I "%~1"=="-h" goto :usage
shift
goto :parse_args
:args_done
if not defined METHOD if "%ASSUME_YES%"=="1" set "METHOD=1"

echo.
echo  ============================================================
echo    OpenCode Installer for Windows
echo  ============================================================
echo.
echo  This installs the latest OpenCode CLI for this account.
echo  Any previous OpenCode program is replaced.
echo  Sessions, settings, and credentials are KEPT.
echo.
echo  IMPORTANT: Close every OpenCode window and terminal first.
echo  Do not run this from inside an OpenCode session.
echo.

if "%DRYRUN%"=="1" echo  [DRY RUN] No changes will be made.
if "%DRYRUN%"=="1" echo.

set "HAD_STANDALONE=0"
if exist "%USERPROFILE%\.opencode\bin\opencode.exe" set "HAD_STANDALONE=1"

echo  [1/5] Checking for running OpenCode processes...
tasklist /FI "IMAGENAME eq opencode.exe" /NH 2>nul | find /I "opencode.exe" >nul
if errorlevel 1 goto :choose_method

echo  OpenCode is currently running.
if "%ASSUME_YES%"=="1" goto :close_running
choice /C YN /N /T 20 /D N /M "Close all OpenCode processes now? [Y/N] "
if errorlevel 2 goto :still_running
:close_running
if "%DRYRUN%"=="1" goto :choose_method
where opencode >nul 2>&1
if not errorlevel 1 call opencode service stop >nul 2>&1
taskkill /F /T /IM opencode.exe >nul 2>&1
taskkill /F /T /IM opencode-desktop.exe >nul 2>&1
echo  OpenCode processes closed.

:choose_method
if defined METHOD goto :method_chosen
echo.
echo  Install method:
echo    [1] Standalone binary  - recommended, no Node.js needed
echo    [2] npm global package - uses Node.js and npm
echo.
choice /C 12 /N /T 20 /D 1 /M "Choose 1 or 2: "
if errorlevel 2 goto :npm_method
set "METHOD=1"
goto :method_chosen
:npm_method
set "METHOD=2"
:method_chosen

echo.
echo  [2/5] Removing any previous OpenCode installation...
echo        Your sessions and settings are kept.
set "NPM_PREFIX="
for /f "usebackq delims=" %%P in (`npm config get prefix 2^>nul`) do set "NPM_PREFIX=%%P"
where npm >nul 2>&1
if errorlevel 1 goto :cleanup_shims
if "%DRYRUN%"=="1" (
  echo   ^> npm uninstall -g @opencode/cli @opencode-ai/cli opencode-ai
  goto :cleanup_shims
)
call npm uninstall -g @opencode/cli @opencode-ai/cli opencode-ai >nul 2>&1

:cleanup_shims
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
if "%METHOD%"=="2" if "%HAD_STANDALONE%"=="1" call :remove_standalone_path

if "%METHOD%"=="1" goto :install_standalone
goto :install_npm

:install_standalone
set "INSTALL_DIR=%USERPROFILE%\.opencode\bin"
set "TARGET=%INSTALL_DIR%\opencode.exe"
set "ARCH=x64"
if /I "%PROCESSOR_ARCHITECTURE%"=="ARM64" set "ARCH=arm64"
if /I "%PROCESSOR_ARCHITEW6432%"=="ARM64" set "ARCH=arm64"
set "URL=https://opencode.ai/update/api/latest/cli/opencode/opencode-windows-%ARCH%.zip"
set "TMPDIR=%TEMP%\opencode-install-%RANDOM%%RANDOM%"
set "ZIP=%TMPDIR%\opencode.zip"

echo.
echo  [3/5] Downloading the latest standalone OpenCode binary...
echo        Architecture: %ARCH%
echo        Source: %URL%
if "%DRYRUN%"=="1" goto :standalone_planned

mkdir "%TMPDIR%" >nul 2>&1
if errorlevel 1 goto :temp_failed

where curl.exe >nul 2>&1
if errorlevel 1 goto :download_ps
curl.exe -fL --retry 3 --retry-delay 2 --progress-bar -o "%ZIP%" "%URL%"
if errorlevel 1 goto :download_failed
goto :extract

:download_ps
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ProgressPreference='SilentlyContinue'; Invoke-WebRequest -UseBasicParsing -Uri '%URL%' -OutFile '%ZIP%'"
if errorlevel 1 goto :download_failed

:extract
echo.
echo        [4/5] Extracting and installing...
where tar.exe >nul 2>&1
if errorlevel 1 goto :extract_ps
tar.exe -xf "%ZIP%" -C "%TMPDIR%"
if errorlevel 1 goto :extract_failed
goto :extract_done

:extract_ps
powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -LiteralPath '%ZIP%' -DestinationPath '%TMPDIR%' -Force"
if errorlevel 1 goto :extract_failed

:extract_done
if not exist "%TMPDIR%\opencode.exe" goto :extract_failed
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%" >nul 2>&1
move /Y "%TMPDIR%\opencode.exe" "%TARGET%" >nul
if errorlevel 1 goto :move_failed
rd /S /Q "%TMPDIR%" >nul 2>&1

call :add_to_path "%INSTALL_DIR%"
set "PATH=%PATH%;%INSTALL_DIR%"

echo.
echo  [5/5] Verifying the installation...
"%TARGET%" --version
if errorlevel 1 goto :verify_failed

echo.
echo  OpenCode installed successfully.
echo    Location: "%TARGET%"
goto :done

:standalone_planned
echo.
echo  [DRY RUN] Would download and install:
echo    %URL%
echo    -^> "%TARGET%"
echo    and add "%INSTALL_DIR%" to your user PATH.
goto :done

:install_npm
echo.
echo  [3/5] Checking Node.js and npm...
where npm >nul 2>&1
if errorlevel 1 goto :no_npm
set "NODE_VERSION=unknown"
set "NPM_VERSION=unknown"
for /f "usebackq delims=" %%V in (`node --version 2^>nul`) do set "NODE_VERSION=%%V"
for /f "usebackq delims=" %%V in (`npm --version 2^>nul`) do set "NPM_VERSION=%%V"
echo        Node.js: %NODE_VERSION%
echo        npm:     %NPM_VERSION%

echo.
echo  [4/5] Installing @opencode/cli@latest...
echo        This downloads about 100 MB.
if "%DRYRUN%"=="1" (
  echo   ^> npm install -g @opencode/cli@latest --include=optional
  goto :npm_verify
)
call npm install -g @opencode/cli@latest --include=optional
if errorlevel 1 goto :npm_failed

:npm_verify
set "NPM_PREFIX="
for /f "usebackq delims=" %%P in (`npm config get prefix 2^>nul`) do set "NPM_PREFIX=%%P"
if not defined NPM_PREFIX goto :npm_failed
if "%DRYRUN%"=="1" goto :npm_path
if not exist "%NPM_PREFIX%\opencode.cmd" goto :npm_failed

:npm_path
echo.
echo  [5/5] Configuring PATH and verifying the installation...
echo ;%PATH%; | find /I ";%NPM_PREFIX%;" >nul
if errorlevel 1 call :add_to_path "%NPM_PREFIX%"
set "PATH=%PATH%;%NPM_PREFIX%"
if "%DRYRUN%"=="1" goto :done
call "%NPM_PREFIX%\opencode.cmd" --version
if errorlevel 1 goto :verify_failed

echo.
echo  OpenCode installed successfully.
echo    Command: "%NPM_PREFIX%\opencode.cmd"
goto :done

:add_to_path
if "%DRYRUN%"=="1" (
  echo   would add "%~1" to your user PATH
  exit /b 0
)
powershell -NoProfile -ExecutionPolicy Bypass -Command "$d='%~1'; $p=[Environment]::GetEnvironmentVariable('Path','User'); if(-not $p){$p=''}; $parts=@($p.Split(';') | Where-Object { $_ }); if($parts -notcontains $d){ [Environment]::SetEnvironmentVariable('Path', (($parts + $d) -join ';'), 'User'); Write-Host '  Added to your user PATH.' }"
exit /b 0

:remove_standalone_path
if "%DRYRUN%"=="1" (
  echo   would remove "%USERPROFILE%\.opencode\bin" from your user PATH
  exit /b 0
)
powershell -NoProfile -ExecutionPolicy Bypass -Command "$d=Join-Path $env:USERPROFILE '.opencode\bin'; $p=[Environment]::GetEnvironmentVariable('Path','User'); if($p){ $parts=@($p.Split(';') | Where-Object { $_ -and $_.TrimEnd('\') -ne $d.TrimEnd('\') }); $new=($parts -join ';'); if($new -ne $p){ [Environment]::SetEnvironmentVariable('Path',$new,'User'); Write-Host '  Removed old OpenCode entry from your user PATH.' } }"
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

:temp_failed
echo.
echo  Could not create a temporary folder in "%TEMP%".
echo  Check free disk space and permissions, then try again.
goto :failed

:download_failed
echo.
echo  The download failed.
echo  Check your internet connection or proxy, then run this again.
echo  You can also download the Windows ZIP manually from:
echo    https://opencode.ai/v2/docs/
goto :failed

:extract_failed
echo.
echo  Could not extract the downloaded ZIP file.
echo  Try downloading it again. If it keeps failing, your antivirus may
echo  be blocking the file.
goto :failed

:move_failed
echo.
echo  Could not write the OpenCode program to:
echo    "%INSTALL_DIR%"
echo  Close all OpenCode windows and try again.
goto :failed

:npm_failed
echo.
echo  npm could not install OpenCode.
echo  Try these steps, in order:
echo    1. Run: npm cache clean --force
echo    2. Run this installer again
echo    3. If it still fails, choose option 1 - standalone binary
goto :failed

:no_npm
echo.
echo  Node.js and npm were not found on your PATH.
echo  Either install the Node.js LTS release from https://nodejs.org
echo  and run this again, or choose option 1 - standalone binary,
echo  which does not need Node.js.
goto :failed

:verify_failed
echo.
echo  The files were installed, but "opencode --version" failed.
echo  Close all OpenCode windows, then try this installer again.
echo  If it keeps failing, your antivirus may be blocking the program.
goto :failed

:failed
echo.
echo  Installation did not complete.
echo  Troubleshooting guide: https://opencode.ai/v2/docs/troubleshooting
echo.
if defined TMPDIR if exist "%TMPDIR%" rd /S /Q "%TMPDIR%" >nul 2>&1
pause
exit /b 1

:done
echo.
echo  ============================================================
if "%DRYRUN%"=="1" (
  echo    Dry run complete. No changes were made.
) else (
  echo    Done
)
echo  ============================================================
echo.
echo  Open a NEW terminal so PATH is refreshed, then run:
echo.
echo      opencode
echo.
echo  If OpenCode still misbehaves, run:
echo      opencode service restart
echo      opencode service status
echo.
pause
exit /b 0

:still_running
echo.
echo  Installation cancelled. Close all OpenCode windows and
echo  terminals, then run this script again.
echo.
pause
exit /b 1

:usage
echo.
echo  Usage: install-opencode.bat [options]
echo.
echo    --standalone   Install the standalone binary. No Node.js needed.
echo    --npm          Install the npm package. Requires Node.js and npm.
echo    --dry-run      Show what would be done without changing anything.
echo    --yes, -y      Do not ask questions. Defaults to standalone.
echo    --help         Show this help.
echo.
echo  With no option, the script asks which method to use.
echo.
exit /b 0
