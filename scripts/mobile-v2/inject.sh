#!/bin/sh
# Adds the responsive link+script immediately before the first </head> of each public page (idempotent).
cd /Users/kazjames/Downloads/activtyos-app-/.claude/worktrees/agent-a8b06c0f3ba036940/public/v2 || exit 1
for f in activly parents companies franchises freelancers schools pricing tour safeguarding security platform-bookings platform-comms platform-finance platform-safeguarding platform-staff privacy terms dpa; do
  if grep -q 'v2/responsive.css' "$f.html"; then echo "skip $f"; continue; fi
  perl -0pi -e 's#</head>#<link rel="stylesheet" href="/v2/responsive.css"><script src="/v2/responsive.js" defer></script></head>#' "$f.html"
  echo "ok $f"
done
