#!/bin/sh
# shot.sh <page> <w> <h> <scrollY> <name> [clickSelector] [full]  -> $OUT/s/<name>.png
export NODE_PATH=/Users/kazjames/Downloads/activtyos-app-/node_modules
OUT=${OUT:-/private/tmp/claude-501/-Users-kazjames-Downloads-activtyos-app-/d6be64b6-4124-4419-9525-b7eb6fbb7058/scratchpad/out}
mkdir -p "$OUT/s"
cd /Users/kazjames/Downloads/activtyos-app-/.claude/worktrees/agent-a8b06c0f3ba036940 || exit 1
node scripts/mobile-v2/shot.mjs "$1" "$2" "$3" "$4" "$OUT/s/$5.png" "$6" "$7"
