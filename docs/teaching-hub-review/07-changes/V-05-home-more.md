# Tutor Home on phones: More toggle

**What.** `TutorHome.tsx`: below lg, Recent activity and the rhythm chart sit behind one "More" button (default closed, `aria-expanded`, remembered in localStorage `hub.home.more` with try/catch). On lg+ nothing changes. Attention list, quick actions, marking, set homework and rejoin are untouched (no extra taps).

**Revert.** `git revert`.
