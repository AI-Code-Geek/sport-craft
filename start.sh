#!/usr/bin/env bash
# Start the local dev server in the background.
#
# Usage:
#   ./start.sh              start the dev server
#   ./start.sh load-data    start the dev server, then seed "SportCraft Club"
#                           (1 Super Admin, 1 Org Admin, 36 players — see output for credentials)
#
# Stop it with ./stop.sh. Re-running load-data is safe — the seed is idempotent.
set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

PORT=3100
PID_FILE=.dev-server.pid
LOG_FILE=.dev-server.log
LOAD_DATA=false
for arg in "$@"; do
	[ "$arg" = "load-data" ] && LOAD_DATA=true
done

if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
	echo "Dev server already running (pid $(cat "$PID_FILE")). Run ./stop.sh first if you need to restart it."
	exit 0
fi

echo "Starting dev server (logs: $LOG_FILE)..."
nohup npm run dev > "$LOG_FILE" 2>&1 &
echo $! > "$PID_FILE"

echo "Waiting for http://localhost:$PORT ..."
up=false
for _ in $(seq 1 60); do
	if curl -sf "http://localhost:$PORT/" >/dev/null 2>&1; then
		up=true
		break
	fi
	sleep 1
done

if [ "$up" != true ]; then
	echo "Server did not come up — check $LOG_FILE"
	exit 1
fi
echo "Dev server is up at http://localhost:$PORT (pid $(cat "$PID_FILE"))"

if [ "$LOAD_DATA" = true ]; then
	echo "Seeding SportCraft Club test org..."
	RESPONSE=$(curl -sf -X POST "http://localhost:$PORT/api/dev/seed-sportcraft-club")
	echo "$RESPONSE"
	echo ""
	echo "SportCraft Club is ready. Log in at http://localhost:$PORT/ with:"
	echo "  Super Admin: superadmin@sportcraftclub.local"
	echo "  Org Admin:   orgadmin@sportcraftclub.local"
	echo "  Password (all accounts, incl. the 36 players): sportcraft2026"
fi
