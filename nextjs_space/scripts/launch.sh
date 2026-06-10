#!/usr/bin/env bash
# Fully-detached launcher that RETURNS INSTANTLY so the calling bash tool
# never blocks (and is never SIGKILL'd at the 120s timeout, which previously
# killed the child). All child stdio goes to a log file, fully detached from
# the controlling terminal via setsid + </dev/null.
#
# Usage: scripts/launch.sh <logfile> <command...>
set -euo pipefail
LOG="$1"; shift
cd /home/ubuntu/manifest_reel_ai/nextjs_space
set -a; source .env; set +a
setsid bash -c "exec $* >> '$LOG' 2>&1" < /dev/null >> "$LOG" 2>&1 &
PID=$!
disown "$PID" 2>/dev/null || true
echo "launched pid=$PID log=$LOG"
exit 0
