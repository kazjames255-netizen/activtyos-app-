# Tab strip fits at 1440 and cues overflow on phones

**What.** `HubTabs.tsx`: tab icons now show from 2xl (1536px) instead of lg, and the lg padding bump is gone, so the strip fits 1192px at 1440. On phones the active tab is scrolled into view on first paint (instant, not smooth) with room for a wider (56px) edge fade, so a tab is never cut under the fade and the fade shows more tabs exist. Tab order, tabs and KID_TABS whitelist untouched.

**Revert.** `git revert` the commit.
