# Critic: Detective Agency "Interrogation" (arcade mode)

URL (updated in place): https://claude.ai/artifact/S46trde48ywWwpUg5nBLiJ

## What was built
- PLAY launches Interrogation. The original campaign is embedded lazily behind "Journey". Music on by default; Calm optional (no timers, no credibility loss, lines wait for "Next line").
- Each case is an interrogation: the suspect's working types out line by line; OBJECTION (button, Space, or tap a line) on the faulty line while it types or its red window bar drains; then drag or tap the fix among 3 tiles under a 10 s clock. Flaw cases ask "why is it wrong", contradiction cases ask "which line does it contradict". Boss cases have two objections. Credibility drains on wrong objections (-25), wrong fixes (-15), passed faults (-10), timeouts; empty = case goes cold (Game Over, PLAY AGAIN). Combo x1-x5, live score, powers earned every 3 solves (Slow-mo, Shield, Cross-out), coins, shop, Daily case, Cold Files endless (top 5 local).
- 111 of 131 cases play as interrogations; cmp and rev cases (20) plus quick-fire windows of find cases feed the chase set-pieces (rooftop, canal) after each chapter. Story kept: briefing, Vane and Wren choices, outros, epilogue, rank system (Trainee..Chief), 20 misconception tags with end-of-run review. No forced input lock after a slip; per-case RP cap removed (RP awarded on every solve, replay for better score, per-case best stored).

## Verification
Playwright at 375x812 and 1280x800: full chapter (7 cases, story scene, chase, outro, results) bot-run; replay x5 constant (speed multiplier stable, one rAF loop); storage blocked clean; 0 console errors.

## Critique round 1 (bored 12-year-old, independent agent) and fixes
1. Objection window too short on case 1: first three solves run at 0.55x speed with no pass penalty and a prompt; dwell windows lengthened for everyone.
2. Idle case cost 45% credibility: tutorial cases now cost 12 instead of 35.
3. Dead briefing at start: first case starts immediately; the chapter 1 briefing and choice play after the first solve.
4. Weak wrong-fix feedback: shake plus "WRONG FIX" banner.
5. Small text: hook and hint text enlarged; hook now shows case kind (old flavour text could mislead).
6. Credibility meter tiny: mute button moved to pause menu on phones.
Not changed: tile order reshuffle report could not be reproduced.

## Remaining gaps
- Uncapped RP per owner decision means farming is possible; rank gates could be trivial after replays.
- Objection reading speed at higher ranks is untested with real children.
- cmp/rev cases only appear in chase; chase not play-tested by a critic.
- Audio and real touch drag not verifiable headless.
