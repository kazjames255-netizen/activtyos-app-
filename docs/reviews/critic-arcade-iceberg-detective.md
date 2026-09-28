# Critic review: Iceberg Detective, Line-Up arcade mode

Artifact (updated in place, version 4): https://claude.ai/artifact/8qrMNDobNHtCE3QY4zsDdh
Source: scratchpad `aa/icb/` (game.js, game.src.html, data.js split from the Journey build, journey.js lazily booted). Engine: shared Arcade engine copy in `aa/engine.js` (adds raw-key forwarding, suspend/resume for the Journey switch, Journey title button, banner text fit, Grown-ups extra hook).

## Core loop
A worked solution scrolls up a conveyor. Tap the first wrong line before it crosses the escape line, then choose the repair from 3 within 5 s. Correct = ARRESTED stamp, burst, combo. Wrong tap, wrong repair, timeout or an escaped error = lose a heart. Boss The Forger (three versions, HP 52/62/72) sends two-error files and throws FORGED stamps at Hattie that must be smashed; at 50% HP the belt and stamps speed up.

## Method
Playwright, real mouse, real touch (375x812) and keyboard (1280x800): title, tutorial hold, catch + fix, wrong fix, missed error, false accusation on a clean file, boss with a perfect bot and a 90% bot, Calm, Daily, Endless, game over + review, Journey launch and return, replay x5 (rAF loops = 1, belt 56 px/s at speed 1 every run), storage blocked, console errors (0 throughout).

## What a bored 13-year-old would say, and what was done
1. First seconds were empty (first card hid behind the desk). FIXED: first file starts mid-screen, tutorial hold with a ghost hand on the wrong line.
2. Speed ramp was barely visible inside one level. FIXED: belt +30% across each level on top of the director, reset per level.
3. Fat-finger taps in the 8 px gaps between rows cost hearts. FIXED: 6 px dead zone between rows.
4. Boss was hidden behind the HUD bar and only 39 s for a perfect player. FIXED: boss lowered and enlarged, HP raised (perfect bot now about 60 s+, humans longer).
5. Wrong repair left no in-world answer. FIXED: the line swaps to the right repair with a red X plus the engine flash.
6. First keyboard press in the tutorial tapped line 1 (wrong). FIXED: cursor starts on the wrong line during the tutorial hold.
7. Title screen demo belt was noisy behind the buttons. FIXED: dimmed to 18%.
8. Long answer text overflowed the shared flash banner. FIXED in the engine copy (auto-fit).

## Remaining gaps (not fixed)
- The repair step freezes the belt for up to 5 s; it is the one moment that feels like a quiz. Kept because the brief specifies it.
- Clean files (12% at difficulty 2+) reward waiting; some players may find "do nothing" odd. It does stop tap-everything play.
- End-of-run review list is a short scroll box; Menu/Shop row sits below the fold on a phone.
- No voice. Real device touch latency and iOS audio not verified (headless only).
- Journey mode is the unchanged 44-case campaign; it keeps its own save key so old progress survives.
- Content: 44 authored cases + ~55 generated skill types (fresh numbers each time), 13 misconception tags, taxonomy shown on Grown-ups. Difficulty tiers use the Journey item weights, not a separate curriculum audit.
