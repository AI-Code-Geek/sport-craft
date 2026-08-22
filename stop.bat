@echo off
REM Stop the local dev server started by start.bat.
setlocal
set PORT=3100

for /f %%p in ('powershell -NoProfile -Command "(Get-NetTCPConnection -LocalPort %PORT% -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty OwningProcess)"') do set PID=%%p

if not defined PID (
	echo No dev server found listening on port %PORT%.
	goto :eof
)

taskkill /F /PID %PID% >nul 2>&1
if %errorlevel%==0 (
	echo Dev server stopped ^(port %PORT% freed^).
) else (
	echo Could not stop process %PID% - it may need elevated permissions.
)
endlocal
