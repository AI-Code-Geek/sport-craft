@echo off
REM Start the local dev server in the background.
REM
REM Usage:
REM   start.bat              start the dev server
REM   start.bat load-data    start the dev server, then seed "SportCraft Club"
REM                          (1 Super Admin, 1 Org Admin, 36 players)
REM
REM Stop it with stop.bat. Re-running load-data is safe - the seed is idempotent.
setlocal
cd /d "%~dp0"

set PORT=3100
set LOAD_DATA=0
if /i "%~1"=="load-data" set LOAD_DATA=1

for /f %%r in ('powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort %PORT% -State Listen -ErrorAction SilentlyContinue) { 'busy' } else { 'free' }"') do set PORT_STATE=%%r
if "%PORT_STATE%"=="busy" (
	echo Dev server already running on port %PORT%. Run stop.bat first if you need to restart it.
	goto :eof
)

echo Starting dev server (logs: .dev-server.log)...
start "sportcraft-dev" /min cmd /c "npm run dev > .dev-server.log 2>&1"

echo Waiting for http://localhost:%PORT% ...
set /a TRIES=0
:wait
curl -sf "http://localhost:%PORT%/" >nul 2>&1
if %errorlevel%==0 goto ready
set /a TRIES+=1
if %TRIES% GEQ 60 goto fail
timeout /t 1 /nobreak >nul
goto wait

:fail
echo Server did not come up - check .dev-server.log
exit /b 1

:ready
echo Dev server is up at http://localhost:%PORT%

if %LOAD_DATA%==1 (
	echo Seeding SportCraft Club test org...
	curl -sf -X POST "http://localhost:%PORT%/api/dev/seed-sportcraft-club"
	echo.
	echo.
	echo SportCraft Club is ready. Log in at http://localhost:%PORT%/ with:
	echo   Super Admin: superadmin@sportcraftclub.local
	echo   Org Admin:   orgadmin@sportcraftclub.local
	echo   Password ^(all accounts, incl. the 36 players^): sportcraft2026
)

endlocal
