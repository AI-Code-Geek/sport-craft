#!/usr/bin/env bash
# Stop the local dev server started by ./start.sh.
set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

PORT=3100
PID_FILE=.dev-server.pid

if [ -f "$PID_FILE" ]; then
	pid=$(cat "$PID_FILE")
	kill "$pid" 2>/dev/null || true
	rm -f "$PID_FILE"
fi

# npm doesn't reliably forward the kill signal to the actual `next dev` process it spawns,
# so free the port directly too — that's what actually stops the server.
killed=false
if command -v lsof >/dev/null 2>&1; then
	port_pid=$(lsof -ti ":$PORT" -sTCP:LISTEN 2>/dev/null || true)
	if [ -n "$port_pid" ]; then
		kill -9 $port_pid 2>/dev/null || true
		killed=true
	fi
elif command -v netstat >/dev/null 2>&1; then
	port_pid=$(netstat -ano 2>/dev/null | awk -v p=":$PORT" '$2 ~ p && $4=="LISTENING"{print $5}' | head -n1)
	if [ -n "$port_pid" ]; then
		powershell -NoProfile -Command "Stop-Process -Id $port_pid -Force" >/dev/null 2>&1 || true
		killed=true
	fi
fi

if [ "$killed" = true ]; then
	echo "Dev server stopped (port $PORT freed)."
else
	echo "No dev server found listening on port $PORT."
fi
