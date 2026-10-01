#!/bin/sh
# diff.sh <dirA-name> <dirB-name> <vp,vp>  (names under $OUT)
OUT=${OUT:-/private/tmp/claude-501/-Users-kazjames-Downloads-activtyos-app-/d6be64b6-4124-4419-9525-b7eb6fbb7058/scratchpad/out}
arch -x86_64 python3 /Users/kazjames/Downloads/activtyos-app-/.claude/worktrees/agent-a8b06c0f3ba036940/scripts/mobile-v2/diff.py "$OUT/$1" "$OUT/$2" "$3"
