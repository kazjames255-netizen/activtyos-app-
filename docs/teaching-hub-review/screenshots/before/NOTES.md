# Screenshotter notes (Phase 0) - INCOMPLETE

Only 5 desktop screenshots captured (files in tutor/, copied from the tool's temp dir). Two blockers:

1. resize_window does NOT change the viewport: after resize to 768x1024, window.innerWidth stayed 1728 (screenshots 1512x793). Phone/tablet captures were impossible with this browser tool. Use Playwright with explicit viewports instead.
2. API :4000 was overloaded/slow (other agents sharing it). Each full page load stalled; the hub failed with "We can't reach Teaching Hub right now" on ?tab=students, and a retry also failed. Child view (/custdash/learninghub) not attempted; not reachable without a child/parent identity.

| File | URL | Viewport | Time to content | Notes |
|---|---|---|---|---|
| tutor/home-desktop-checking-access.jpg | /freelancer/learninghub?tab=home | 1512 | 0-10s | "Checking access..." blank shell |
| tutor/home-desktop-skeleton.jpg | same | 1512 | 10-20s | grey skeleton cards |
| tutor/home-desktop-skeleton.jpg (2) | same | 1512 | ~30-35s | hero + stat cards + tab strip, body still skeleton |
| tutor/home-desktop-loaded-with-timeout-error.jpg | same | 1512 | ~40s | red banner "The server didn't respond within 15s (http://localhost:4000). Is the API running?" |
| tutor/students-desktop-cant-reach*.jpg | ?tab=students | 1512 | 30s+ then fail | full-page error state with Try again; retry fails too |

Observations
- Load time 35-40s to first content on home; "Checking access..." then skeletons then an API timeout banner.
- Tab strip at 1512 width: all 11 tabs visible but the last ("Student message centre") is clipped at the right edge, so it is cut off even on desktop.
- No "You're broadcasting" banner shown this session (stale broadcast apparently gone).
- Data differs from brief: Needs attention = "7 things" (0 homework, 0 written, 0 overdue, 7 quiet for 14+ days: Callum, Hannah...), Next lesson empty.
- Hero + 4 stat cards (7 subjects/2457 topics, 7894 lessons, 1 worksheet, 8 students) push tabs to y~340-395 and content below y~440 on a 793px-high viewport.
- Error copy is technical (mentions localhost:4000) and the timeout banner sits between stats and tabs, shifting layout.
- Students-tab failure shows a hub-level error, not a per-panel one; no cached shell.
