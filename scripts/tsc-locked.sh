#!/bin/bash
# Run a TypeScript check while holding a global lock — the machine has 4 cores and several agents type-check at once (load avg 580).
# usage: scripts/tsc-locked.sh            → root  `npx tsc --noEmit`
#        scripts/tsc-locked.sh server     → server `npx tsc --noEmit`
LOCK=/tmp/activityos-tsc.lock
waited=0
while ! mkdir "$LOCK" 2>/dev/null; do
  # stale lock (holder gone for > 15 min) → break it
  if [ -n "$(find "$LOCK" -maxdepth 0 -mmin +15 2>/dev/null)" ]; then rmdir "$LOCK" 2>/dev/null; continue; fi
  sleep 5; waited=$((waited+5))
done
trap 'rmdir "$LOCK" 2>/dev/null' EXIT INT TERM
[ $waited -gt 0 ] && echo "(waited ${waited}s for the tsc lock)"
cd "$(dirname "$0")/.." || exit 1
if [ "$1" = "server" ]; then cd server && npx tsc --noEmit; else npx tsc --noEmit; fi
