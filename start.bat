@echo off
REM Start the local dev server in the background, optionally seeding "SportCraft Club" up to a stage.
REM
REM Usage:
REM   start.bat                start the dev server only
REM   start.bat load-data      ... + seed the org/users (1 Super Admin, 1 Org Admin, 36 players)
REM   start.bat vote           ... + create the tournament, open the poll, have everyone vote
REM   start.bat poll-closed    ... + close the poll
REM   start.bat captains       ... + pick captains, name teams
REM   start.bat positions      ... + categorize the remaining players
REM   start.bat auction        ... + run the position auction to completion
REM   start.bat schedule       ... + generate the round-robin schedule
REM   start.bat live           ... + play some matches, leave one live
REM   start.bat playoffs       ... + finish the group stage, generate the bracket
REM
REM Each stage picks up from wherever SportCraft Club last stopped - you can call a later stage on a
REM fresh server to fast-forward, or an earlier/already-reached one as a no-op. Stop with stop.bat.
setlocal
cd /d "%~dp0"

set PORT=3100
set STAGE=%~1
if /i "%STAGE%"=="load-data" set STAGE=users

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

if not "%STAGE%"=="" (
	echo Seeding SportCraft Club test org up to stage "%STAGE%"...
	curl -sf -X POST "http://localhost:%PORT%/api/dev/seed-sportcraft-club" -H "Content-Type: application/json" -d "{\"stage\":\"%STAGE%\"}"
	echo.
	echo.
	echo SportCraft Club is ready. Log in at http://localhost:%PORT%/ with:
	echo   Super Admin: superadmin@sportcraftclub.local
	echo   Org Admin:   orgadmin@sportcraftclub.local
	echo   Password ^(all accounts, incl. the 36 players^): sportcraft2026
)

endlocal
