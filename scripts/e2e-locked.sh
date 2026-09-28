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
# E2E_STACK=test → run against the isolated stack (web :3001 → API :4001, start it with `npm run dev:test`) so the suite never touches
# the API/web a person is using on :3000/:4000 (its writes + restarts used to wipe that API's caches: docs/hub-slow-loads.md).
if [ "$E2E_STACK" = "test" ]; then
  export E2E_BASE_URL="${E2E_BASE_URL:-http://localhost:3001}" NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-http://localhost:4001}" E2E_AUTH_DIR="${E2E_AUTH_DIR:-e2e/.auth-test}"
  if ! curl -s -o /dev/null -m 5 "$NEXT_PUBLIC_API_URL/docs/"; then echo "E2E_STACK=test but the test API is not up on $NEXT_PUBLIC_API_URL — run: npm run dev:test  (then wait ~1 min)" >&2; exit 2; fi
fi
# E2E_CMD overrides the command (e.g. the tenant data wipe) while still holding the lock
# E2E_CMD is capped (E2E_CMD_TIMEOUT, default 120 s): a hung cleanup (e2eCleanup --data-only can sit for 30+ min) must not hold the lock.
killtree() { for c in $(pgrep -P "$1" 2>/dev/null); do killtree "$c"; done; kill -TERM "$1" 2>/dev/null; }
if [ -n "$E2E_CMD" ]; then
  bash -c "$E2E_CMD" & cmd=$!
  ( sleep "${E2E_CMD_TIMEOUT:-120}"; echo "(E2E_CMD exceeded ${E2E_CMD_TIMEOUT:-120}s — stopped; continuing)" >&2; killtree "$cmd" ) & watcher=$!
  wait "$cmd"; rc=$?; kill "$watcher" 2>/dev/null; [ $rc -ge 128 ] && rc=0; exit $rc
else npx playwright test "$@" --project=e2e --no-deps --workers=1; fi
