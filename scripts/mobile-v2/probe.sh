#!/bin/sh
export NODE_PATH=/Users/kazjames/Downloads/activtyos-app-/node_modules
cd /Users/kazjames/Downloads/activtyos-app-/.claude/worktrees/agent-a8b06c0f3ba036940 || exit 1
node scripts/mobile-v2/probe.mjs "$@"
