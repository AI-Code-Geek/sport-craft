#!/usr/bin/env bash
# Start the local dev server in the background, optionally seeding "SportCraft Club" up to a stage.
#
# Usage:
#   ./start.sh                start the dev server only
#   ./start.sh load-data      ... + seed the org/users (1 Super Admin, 1 Org Admin, 36 players)
#   ./start.sh vote           ... + create the tournament, open the poll, have everyone vote
#   ./start.sh poll-closed    ... + close the poll
#   ./start.sh captains       ... + pick captains, name teams
#   ./start.sh positions      ... + categorize the remaining players
#   ./start.sh auction        ... + run the position auction to completion
#   ./start.sh schedule       ... + generate the schedule, start one match live for real scoring
#   ./start.sh score          ... + fill in results for some of the other matches
#   ./start.sh live           ... + play out every remaining match
#   ./start.sh playoffs       ... + finish the group stage, generate the bracket
#
# Each stage picks up from wherever SportCraft Club last stopped — you can call a later stage on a
# fresh server to fast-forward, or an earlier/already-reached one as a no-op. Add `reset` (in any
# position) to drop SportCraft Club's tournament first and start that stage from scratch — the org and
# its 38 accounts stay put, only the tournament/poll/teams/matches/bracket get wiped. Stop with ./stop.sh.
set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

PORT=3100
PID_FILE=.dev-server.pid
LOG_FILE=.dev-server.log
STAGE=""
RESET=false
for arg in "$@"; do
	if [ "$arg" = "reset" ]; then
		RESET=true
	elif [ "$arg" = "load-data" ]; then
		STAGE="users"
	else
		STAGE="$arg"
	fi
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

if [ -n "$STAGE" ] || [ "$RESET" = true ]; then
	[ -z "$STAGE" ] && STAGE="users"
	echo "Seeding SportCraft Club test org up to stage '$STAGE'$([ "$RESET" = true ] && echo " (reset first)")..."
	RESPONSE=$(curl -sf -X POST "http://localhost:$PORT/api/dev/seed-sportcraft-club" \
		-H "Content-Type: application/json" -d "{\"stage\":\"$STAGE\",\"reset\":$RESET}")
	echo "$RESPONSE"
	echo ""
	echo "SportCraft Club is ready. Log in at http://localhost:$PORT/ with:"
	echo "  Super Admin: superadmin@sportcraftclub.local"
	echo "  Org Admin:   orgadmin@sportcraftclub.local"
	echo "  Password (all accounts, incl. the 36 players): sportcraft2026"
fi
