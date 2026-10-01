#!/bin/sh
OUT=/private/tmp/claude-501/-Users-kazjames-Downloads-activtyos-app-/d6be64b6-4124-4419-9525-b7eb6fbb7058/scratchpad/out
cd /Users/kazjames/Downloads/activtyos-app-/.claude/worktrees/agent-a8b06c0f3ba036940 || exit 1
arch -x86_64 python3 scripts/mobile-v2/pack.py "$OUT/before" "$OUT/finalshots" docs/mobile/shots
