#!/bin/bash
# Run a Playwright e2e command while holding a global lock — the hub specs share the standing e2e tenants, so two runs at once corrupt each other.
# FIFO: callers take a numbered ticket and run in arrival order (dead callers' tickets are dropped), so nobody starves.
# usage: scripts/e2e-locked.sh e2e/learning-hub-lessons.spec.ts [-g "name"]   (adds --project=e2e --no-deps --workers=1)
LOCK=/tmp/activityos-e2e.lock
Q=/tmp/activityos-e2e.queue
mkdir -p "$Q"
TICKET="$Q/$(python3 -c 'import time;print(int(time.time()*1000))')-$$"
echo $$ > "$TICKET"
cleanup() { rm -f "$TICKET"; [ "$HOLD" = 1 ] && rmdir "$LOCK" 2>/dev/null; }
trap cleanup EXIT INT TERM
HOLD=0; waited=0
while true; do
  # drop tickets whose process is gone
  for t in "$Q"/*; do [ -e "$t" ] || continue; p=$(cat "$t" 2>/dev/null); [ -n "$p" ] && ! kill -0 "$p" 2>/dev/null && rm -f "$t"; done
  first=$(ls "$Q" | sort -n | head -1)
  if [ "$Q/$first" = "$TICKET" ]; then
    if mkdir "$LOCK" 2>/dev/null; then HOLD=1; break; fi
    # stale lock (holder gone for > 25 min) → break it
    if [ -n "$(find "$LOCK" -maxdepth 0 -mmin +25 2>/dev/null)" ]; then rmdir "$LOCK" 2>/dev/null || rm -rf "$LOCK"; continue; fi
  fi
  sleep 5; waited=$((waited+5))
done
[ $waited -gt 0 ] && echo "(waited ${waited}s for the e2e lock)"
cd "$(dirname "$0")/.." || exit 1
# E2E_CMD overrides the command (e.g. the tenant data wipe) while still holding the lock
if [ -n "$E2E_CMD" ]; then bash -c "$E2E_CMD"; else npx playwright test "$@" --project=e2e --no-deps --workers=1; fi
