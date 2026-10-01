#!/bin/sh
# run.sh <label> [pages] [viewports]  -> results under $OUT (default: session scratchpad)
export NODE_PATH=/Users/kazjames/Downloads/activtyos-app-/node_modules
export OUT=${OUT:-/private/tmp/claude-501/-Users-kazjames-Downloads-activtyos-app-/d6be64b6-4124-4419-9525-b7eb6fbb7058/scratchpad/out}
cd /Users/kazjames/Downloads/activtyos-app-/.claude/worktrees/agent-a8b06c0f3ba036940
node scripts/mobile-v2/audit.mjs "$@" > "$OUT/$1.log" 2>&1
