# Critic review: Sinking Berg (arcade balance-the-berg)

Build: scratchpad/ax/berg/preview.html. Played with Playwright at 375x812 touch and 1280x800 mouse/keys.
Scripts and screenshots: scratchpad/ax/berg/critic/ (c1-c5.mjs, *.png). No console errors in any run.

## Scores (/10)
| Area | Score |
| --- | --- |
| Fun | 6 |
| Clarity in 5s | 8 |
| Pressure | 4 |
| Juice | 8 |
| Fairness | 3 |
| Boss fight | 5 |
| Inequalities world | 7 |
| End screens | 5 |
| Touch targets / layout | 7 |
| Robustness (errors/overflow) | 9 |

## Top 10 flaws, ranked

1. **Random guessing beats the game (biggest flaw).** A bot that taps a random non-dim tile every ~0.3s (no thought at all) cleared World 1 including boss Wally: 42 of 43 "right", 3 stars, 0 lives lost, score 1165 (c3.mjs, `c3_0_m_worldclear.png`).
   Cause: in `playTile`, a wrong tile only does `R.bu -= .16`, dims 1 tile and calls `api.slip`. It never costs a heart and never turns the answer into a miss. With 4 tiles and at most 3 wrong picks (0.48 berg) per step, you can always eliminate your way to the answer. The equation is still logged `ok:true` when finally solved.
   Fix: (a) after the first wrong tap in a round, record `R.slipped=true` and call `api.answer(item,{ok:false})` when solved (heart lost on the 2nd wrong tap of one equation, or the solve gives 0 points and no combo); (b) raise the wrong-tap cost to `R.bu -= .3` and dim for the whole round (`tl.dim=99`, not the 2.5s decay); (c) count slipped equations as wrong in accuracy/stars.
2. **Accuracy and stars lie.** "42 of 43 right (98%)" was shown to a random guesser because slips are excluded from `correctN/totalN`. Stars "come from accuracy" (World clear text), so the honest signal is lost for the teacher/parent. Fix: on `slip`, increment `run.totalN` once per equation (first slip) without incrementing `correctN`; or show "first-try" % separately.
3. **Level clear / world clear overlays collide with the play scene.** "LEVEL 1 CLEAR" text is drawn over the pans and penguin (`b_end.png`); on World clear the score "1165" sits on the "=" and pan cards, stars overlap the penguin's head, "+15 coins" text runs across the beam (`c3_0_m_worldclear.png`). Fix: hide the scale/pans (`R=null` visuals, or draw a 60% dark scrim) while `state` is toast/worldclear/over, and give the overlay its own vertical layout.
4. **Stale equation ghosted behind the end screen.** GAME OVER (`e_over.png`) shows "3x + 5 = 20" behind the card, but the player was dying on "6x = 48". Same "3x+5 / 20" appears on the level-clear and world-clear screens. Looks like a bug or leftover default. Fix: skip drawing pans when `R` is null or draw the last real equation; never draw the demo/default one.
5. **"NEW BEST!" + confetti for a 25% run.** Idle player scored 22 = new best, confetti, 0 stars. First-ever run always beats 0. Fix: show NEW BEST only if `prev>0` or score >= the first star threshold (300).
6. **Game over review card is clipped.** Mistake list ("Worth another go") is cut off behind the PLAY AGAIN button in the desktop column (`e_over.png`), second item is half hidden, no visible scroll cue. Fix: make the list `max-height` with `overflow:auto` plus a fade-out, or cap to the top 2 misses with "+N more".
7. **Pressure is only a slow timer; risk is flat.** A passive player takes ~7.5s per equation, loses 1 heart per ~8s and is dead in 26s (fair), but a competent player never feels squeezed: time 4.6+3.3*steps and `gameSpeed` only grows 3% per answer up to +24%. Level 1-4 are 5 equations each with 3 hearts and a heart back per world. Fix: cap speed growth higher (`Math.min(14,...)*.03`), drop heart refund on world clear to only when accuracy >= 80%, shrink T by 10% per world.
8. **Boss difficulty cliff and trivial early boss.** World 1 boss died to a random guesser (hp 60, no danger). World 5 (wIdx 4, "King Wally", hp 72, interval 4.6s) killed a 70%-accuracy bot in 80s (hp 41/72 left, `boss4.log`). Meanwhile a competent player is fine. Fix: give wrong counter-taps a real cost (each counter miss = `loseLife` after the 2nd miss), and reduce W5 hp to ~60 or lengthen interval to 5.2s to smooth the ramp.
9. **Tutorial hint hands over the answer and covers the penguin.** "Undo the number next to x. Tap +7" is fine for the first equation, but the box covers the mascot and the tap hand points at the tile (`a_idle5000.png`). A 9-year-old just taps what it says and learns nothing. Also the game holds forever with no fade, so a bored child idles safely. Fix: hint text "Undo the −7" (no "Tap +7") for the 2nd tutorial equation, add a 10s "need a hint?" delay, and move the box above the penguin.
10. **Layout wastes space.** Mobile 375x812: the canvas is 360x640 letterboxed, leaving ~25% empty dark band at the bottom (`a_idle5000.png`, tiles crowd the bottom edge, hand pointer is cropped at the frame). Desktop: the game column is only ~430px wide between two text sidebars, tiles ~110x75px. Fix: scale canvas to `height:100dvh` with `object-fit:contain` and anchor tiles to the bottom safe area; on desktop allow the column to grow to ~560px.

## Other observations
- Clarity within 5s is good: pans, "Get x on its own" pill, numbered tiles, pointing hand. A child understands "tap a tile" instantly.
- Juice is strong: shake, flash, combo bump, "ON FIRE" announcers, penguin reactions, beam physics. "Not the same" pop-up overlaps the penguin/beam during boss fights (`boss0.png`) but is readable.
- Distractor tiles are lazy: a constant `+3`/`-3` filler shows up on many equations, so kids learn to ignore it (see eq log in c4 output). Vary the filler, include the opposite sign of the right move more often, and include a wrong-multiplier tile.
- Inequalities (wIdx 4 forced via `__bg.api.run`): 30 equations in 90s all rendered fine, `≤ ≥ < >` show on the plate, sign-flip items (`-2x+5 ≤ -7`, `-x+4 > 0`) appear with sensible tile sets. No text overflow. `-x + 4 > 0` best move is `÷(−1)` first; fine but a kid may prefer -4, which is also accepted.
- Touch targets: mobile tiles ~85x60 CSS px with hit box 92x66 canvas units: good. Title buttons 48-64px high, Grown-ups button 44px: ok.
- Exploits: guess-elimination (flaw 1); tutorial pause is permanent; keys 1-4 give instant multi-tile access, which makes spam faster.
- Console errors: none across all runs.
