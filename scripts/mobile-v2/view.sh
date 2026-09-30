#!/bin/sh
# view.sh <label> <page> <vp> [seg_h] [cols]  -> $OUT/v/<label>_<page>_<vp>_N.png contact sheets
OUT=${OUT:-/private/tmp/claude-501/-Users-kazjames-Downloads-activtyos-app-/d6be64b6-4124-4419-9525-b7eb6fbb7058/scratchpad/out}
mkdir -p "$OUT/v"
rm -f "$OUT/v/$1_$2_$3"_*.png
arch -x86_64 python3 /Users/kazjames/Downloads/activtyos-app-/.claude/worktrees/agent-a8b06c0f3ba036940/scripts/mobile-v2/contact.py "$OUT/$1/$2__$3.png" "$OUT/v/$1_$2_$3" "${4:-2200}" "${5:-5}"
