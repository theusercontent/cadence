@echo off
setlocal EnableExtensions
title OpenCode Office Proxy Setup
color 0B

set "UNSET=0"
set "DETECTONLY=0"

:parse_args
if "%~1"=="" goto :args_done
if /I "%~1"=="--unset" set "UNSET=1"
if /I "%~1"=="--detect" set "DETECTONLY=1"
if /I "%~1"=="--help" goto :usage
if /I "%~1"=="-h" goto :usage
shift
goto :parse_args
:args_done

echo.
echo  ============================================================
echo    OpenCode Office Proxy Setup
echo  ============================================================
echo.
echo  Use this when OpenCode starts, but requests fail with
echo  HTTP 503, 407, timeouts, or connection errors on a company
echo  network that uses a proxy.
echo.
echo  The script finds the Windows proxy, saves it for your user,
echo  and configures the OpenCode background service.
echo.

if "%UNSET%"=="1" goto :unset_proxy

set "DETECT_FILE=%TEMP%\opencode-proxy-detect.txt"
del "%DETECT_FILE%" >nul 2>&1

echo  Looking for the Windows proxy configuration...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$o=New-Object System.Collections.ArrayList; $r=Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings' -ErrorAction SilentlyContinue; if($r){ if($r.ProxyEnable -eq 1 -and $r.ProxyServer){ $p=$r.ProxyServer; if($p -match '='){ $m=@{}; foreach($x in $p.Split(';')){ $kv=$x.Split('=',2); if($kv.Count -eq 2){ $m[$kv[0]]=$kv[1] } }; if($m['https']){$p=$m['https']} elseif($m['http']){$p=$m['http']} }; [void]$o.Add('IE=' + $p) }; if($r.AutoConfigURL){ [void]$o.Add('PAC=' + $r.AutoConfigURL); if($r.AutoConfigURL -match '^(https?|file)://'){ try { $pac=(Invoke-WebRequest -UseBasicParsing -Uri $r.AutoConfigURL -TimeoutSec 8).Content; $pm=[regex]::Matches($pac,'(?i)(?:PROXY|HTTPS)\s+([A-Za-z0-9.-]+:\d+)'); foreach($z in $pm){ [void]$o.Add('PACPROXY=' + $z.Groups[1].Value) } } catch {} } } }; $w=(netsh winhttp show proxy) -join ' '; $wm=[regex]::Match($w,'([A-Za-z0-9.-]+:\d+)'); if($wm.Success){ [void]$o.Add('WINHTTP=' + $wm.Groups[1].Value) }; if($env:HTTPS_PROXY){ [void]$o.Add('ENV=' + $env:HTTPS_PROXY) } elseif($env:HTTP_PROXY){ [void]$o.Add('ENV=' + $env:HTTP_PROXY) }; Set-Content -Path '%DETECT_FILE%' -Value $o -Encoding ASCII"

echo.
if not exist "%DETECT_FILE%" goto :no_detect
type "%DETECT_FILE%"
goto :detect_done
:no_detect
echo  Could not read the Windows proxy configuration.

:detect_done
set "IE_PROXY="
set "WINHTTP_PROXY="
set "ENV_PROXY="
set "PAC_PROXY="
for /f "usebackq tokens=1,* delims==" %%A in ("%DETECT_FILE%") do (
  if /I "%%A"=="IE" set "IE_PROXY=%%B"
  if /I "%%A"=="WINHTTP" set "WINHTTP_PROXY=%%B"
  if /I "%%A"=="ENV" set "ENV_PROXY=%%B"
  if /I "%%A"=="PACPROXY" set "PAC_PROXY=%%B"
)

set "DETECTED="
if defined ENV_PROXY set "DETECTED=%ENV_PROXY%"
if not defined DETECTED if defined IE_PROXY set "DETECTED=%IE_PROXY%"
if not defined DETECTED if defined WINHTTP_PROXY set "DETECTED=%WINHTTP_PROXY%"
if not defined DETECTED if defined PAC_PROXY set "DETECTED=%PAC_PROXY%"

if "%DETECTONLY%"=="1" (
  echo.
  if defined DETECTED (
    echo  Best proxy candidate: %DETECTED%
  ) else (
    echo  No proxy address was detected automatically.
  )
  echo.
  echo  Detection complete. No changes were made.
  echo.
  pause
  exit /b 0
)

echo.
if defined DETECTED (
  echo  Best proxy candidate: %DETECTED%
) else (
  echo  No proxy address was detected automatically.
  echo.
  echo  To find it manually:
  echo    1. Open Settings -^> Network ^& Internet -^> Proxy.
  echo    2. If "Use a proxy server" is on, copy the Address.
  echo    3. If only a setup script is configured, ask IT for the
  echo       proxy host and port.
)

echo.
echo  Examples:
echo    http://proxy.company.com:8080
echo    http://DOMAIN\user:password@proxy.company.com:8080
echo.
set "PROXY="
if defined DETECTED (
  set /p "PROXY=Proxy URL, or press Enter to use the detected one: "
) else (
  set /p "PROXY=Proxy URL: "
)
if not defined PROXY if defined DETECTED set "PROXY=%DETECTED%"
if not defined PROXY goto :no_proxy
set "PROXY=%PROXY:"=%"

set "SCHEME=%PROXY:~0,6%"
if /I "%SCHEME%"=="socks4" goto :socks_proxy
if /I "%SCHEME%"=="socks5" goto :socks_proxy

set "SCHEME=%PROXY:~0,7%"
if /I "%SCHEME%"=="http://" goto :scheme_ok
set "SCHEME=%PROXY:~0,8%"
if /I "%SCHEME%"=="https://" goto :scheme_ok
set "PROXY=http://%PROXY%"
:scheme_ok

echo.
echo  OpenCode will use this proxy:
echo    %PROXY%
echo  Local addresses will bypass it:
echo    localhost,127.0.0.1,::1
echo.
echo  If the URL contains a password, it is visible in this window.
echo.
choice /C YN /N /T 30 /D N /M "Apply this proxy? [Y/N] "
if errorlevel 2 goto :cancelled

echo.
echo  Saving proxy for your Windows user...
set "OC_PROXY=%PROXY%"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$v=$env:OC_PROXY; [Environment]::SetEnvironmentVariable('HTTP_PROXY',$v,'User'); [Environment]::SetEnvironmentVariable('HTTPS_PROXY',$v,'User'); [Environment]::SetEnvironmentVariable('NO_PROXY','localhost,127.0.0.1,::1','User'); Write-Host '  User proxy variables saved.'"
if errorlevel 1 echo  Warning: could not save the user proxy variables.
set "OC_PROXY="
set "HTTP_PROXY=%PROXY%"
set "HTTPS_PROXY=%PROXY%"
set "NO_PROXY=localhost,127.0.0.1,::1"

where opencode >nul 2>&1
if errorlevel 1 goto :no_opencode

echo.
echo  Configuring the OpenCode background service...
call opencode service set env HTTP_PROXY "%PROXY%"
if errorlevel 1 echo  Warning: could not set HTTP_PROXY for the service.
call opencode service set env HTTPS_PROXY "%PROXY%"
if errorlevel 1 echo  Warning: could not set HTTPS_PROXY for the service.
call opencode service set env NO_PROXY "localhost,127.0.0.1,::1"
if errorlevel 1 echo  Warning: could not set NO_PROXY for the service.
call opencode service restart
if errorlevel 1 echo  Warning: could not restart the service.

echo.
echo  Testing connectivity...
where curl.exe >nul 2>&1
if errorlevel 1 goto :no_curl
echo    Direct to models.dev:
curl.exe -sS -o nul --max-time 15 -w "      HTTP %%{http_code}\n" https://models.dev
echo    Through the proxy to models.dev:
curl.exe -x "%PROXY%" -sS -o nul --max-time 20 -w "      HTTP %%{http_code}\n" https://models.dev
echo    Through the proxy to opencode.ai:
curl.exe -x "%PROXY%" -sS -o nul --max-time 20 -w "      HTTP %%{http_code}\n" https://opencode.ai

echo.
echo  What the test means:
echo    200, 301, 302, 401, 403 - the proxy connection works.
echo    407 - the proxy needs authentication.
echo    503 - the proxy or firewall is blocking the site.
echo    000 - the proxy could not be reached; check the address and port.
echo    SSL certificate error - the company uses its own CA; ask IT for
echo    the CA .pem file and set NODE_EXTRA_CA_CERTS to it.
echo.
echo  If the direct test works but the proxy test fails, do not use the
echo  proxy. Run: configure-opencode-proxy.bat --unset
echo.
echo  If it is blocked, send this output to IT and ask them to allow:
echo    opencode.ai
echo    models.dev
echo    your model provider API, for example api.openai.com
goto :apply_done

:no_curl
echo  curl.exe was not found, so the connection test was skipped.

:apply_done
echo.
echo  Next steps:
echo    1. Close OpenCode completely.
echo    2. Open a NEW terminal.
echo    3. Run: opencode
echo.
pause
exit /b 0

:no_opencode
echo.
echo  OpenCode was not found on PATH. The proxy was saved for your
echo  user, but the OpenCode service could not be configured.
echo  Install OpenCode first, then run this script again.
echo.
pause
exit /b 1

:unset_proxy
echo  This removes HTTP_PROXY, HTTPS_PROXY, and NO_PROXY from your
echo  Windows user environment and from the OpenCode service.
echo.
echo  Only do this if you added them for OpenCode. Other tools may
echo  rely on those variables.
echo.
choice /C YN /N /M "Continue? [Y/N] "
if errorlevel 2 goto :cancelled

echo.
echo  Removing user proxy variables...
powershell -NoProfile -ExecutionPolicy Bypass -Command "[Environment]::SetEnvironmentVariable('HTTP_PROXY',$null,'User'); [Environment]::SetEnvironmentVariable('HTTPS_PROXY',$null,'User'); [Environment]::SetEnvironmentVariable('NO_PROXY',$null,'User'); Write-Host '  Removed.'"

where opencode >nul 2>&1
if errorlevel 1 goto :unset_done
echo  Removing OpenCode service proxy variables...
call opencode service unset env HTTP_PROXY >nul 2>&1
call opencode service unset env HTTPS_PROXY >nul 2>&1
call opencode service unset env NO_PROXY >nul 2>&1
call opencode service restart >nul 2>&1

:unset_done
echo.
echo  Proxy settings removed. Open a new terminal before using OpenCode.
echo.
pause
exit /b 0

:socks_proxy
echo.
echo  SOCKS proxies are not supported by this script.
echo  Use the HTTP or HTTPS proxy address instead.
goto :cancelled

:no_proxy
echo.
echo  No proxy address was entered. Nothing was changed.
echo.
pause
exit /b 1

:cancelled
echo.
echo  Cancelled. Nothing was changed.
echo.
pause
exit /b 1

:usage
echo.
echo  Usage: configure-opencode-proxy.bat [options]
echo.
echo    --detect   Show the Windows proxy settings and exit.
echo    --unset    Remove the proxy settings from your user and OpenCode.
echo    --help     Show this help.
echo.
echo  With no option, the script asks for the proxy URL and applies it.
echo.
exit /b 0
