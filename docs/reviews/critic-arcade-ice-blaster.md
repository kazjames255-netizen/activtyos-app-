# Critic review: Ice Blaster (times-tables arcade)

Method: Playwright-driven play of `preview.html` (scripts in `scratchpad/ib/crit/`, sources untouched) at 375x812 touch and 1280x800 keyboard/mouse. The player was a bored, imperfect 9-year-old: 0.7 to 1.6 s reaction, about 75% intended accuracy (half of the misses a wrong-answer knowledge slip, half a mis-tap on the adjacent column), occasional stray taps. Also ran a "perfect" player (150 ms reaction) as a ceiling. 3 runs per device for levels 1-4, 4 boss runs, blitz, MTC, division, single table, Calm, pause, Journey link and back, PLAY AGAIN x5, blocked localStorage. Console: zero errors or warnings in every run, including blocked storage. No horizontal scroll at either size.

Caveat: my bot's timing is coarser than a person's (about 150 to 400 ms per action). Dying times are indicative, not exact. The structural findings (lives economy, stray taps, boss HP maths) do not depend on that.

## Verdict

Looks great, feels good for the first 5 seconds, and is then unfairly punishing. The presentation (chunky ice blocks, penguin cannon, big Fredoka numerals, combo, "ENRAGED!" beat, explanations on the end screen) is well above typical educational-arcade quality. But the difficulty economy is broken for the target audience. A 70-75% accurate kid has 3 hearts for a whole world and no way to earn any back until the boss. Measured: all 6 of 6 human-like runs at levels 1-2 ended in GAME OVER in 15 to 38 seconds. Not one reached level 3, let alone the boss. The boss, if reached, needs roughly 90+ correct hits (160 HP at 1 to 2 damage per hit) with at most 2 mistakes in that span. The average player will never see the Frost Giant, and the main game reads as a fail screen with a nice skin. A "fun within 5 s" pass, a "fair" fail.

Rating for the target player (Year 3/4 kid, 70 to 80% accuracy): fun in 5 s 8/10, pressure 9/10 (too much), fairness 3/10, legibility 8/10, boss reachability 1/10, juice 8/10, rewards 4/10.

## Top 10 flaws (ranked)

1. **Lives economy: 3 hearts per world, no regen, every error costs 1.** Human-like runs (74% accuracy, 6 to 17 answers) died at 15 s, 16 s, 21 s, 23 s, 24 s, 31 s, 38 s. Hearts only refill (+1) at boss defeat (`engine.js` line 299). Expected errors at 75% over one level (~15 items) is about 4, i.e. dead in level 1.
   Fix: refill 1 heart per level clear plus 1 per 8-answer streak; or make errors cost "shield charge" not a heart; or give 5 hearts on the default (Year 3) difficulty. Better: heart cost only for landings, and a wrong shot just breaks combo and re-queues the fact. Also let the difficulty director (`Dir`) grant a silent extra heart when the player is at 1 heart and 3 below their recent accuracy.

2. **Blitz "60 seconds" ends in seconds because of hearts.** Two blitz runs ended at 9 s and 5 s with about 52 s left on the clock (3 wrong of 4 answers). A timer mode should be a pure timer. It also awarded "NEW BEST!" for a score of 3.
   Fix: no lives in blitz (wrong = minus 2 s or lose the combo), and do not show NEW BEST below some floor (e.g. score under 50, or fewer than 8 answers).

3. **Any tap anywhere fires an instantly-judged shot, so stray taps cost hearts.** Repro: play a level, tap empty snow near the cannon (or a blank part of the field) while a row is active. Controlled test with a perfect-knowledge bot and 23 stray taps in 40 s: 9 wrong answers (hearts) vs 0 wrong with no stray taps. On touch, `onPointer` 'up' sets `pendFire`, so a bored kid's fidgeting or a fat-finger just left of the last block is scored as an answer. Keyboard: Space when not aligned fires at whatever column the cannon is over.
   Fix: only tap on or near the answer row (y within the row band plus 40 px) fires; taps below the row only aim. Or a "misfire" (shot into the gap between blocks, or a shot at a column that is not near a block edge) costs nothing and shows a whiff puff. Better: forgiveness window, first wrong shot per row only dims the block (no heart) if the second tap within 1.5 s is correct.

4. **Frost Giant is effectively unbeatable and far too long.** HP 160 (world 1). Damage per hit is `(1 + speedBonus) * (combo >= 6 ? 2 : 1)`, almost always 1 to 2 for a 75% player (combos rarely reach x2, which needs 3 in a row, and x3 needs 6). Measured: 90% accuracy, 26 hits landed, HP 160 to 115 in 65 s (1.7 damage per hit), then dead. Extrapolated to a kill: 90+ answers, about 4 minutes if you never die. Even a flawless 150 ms bot only reached 50% at 40 s and needed roughly 80+ s with x4/x5 combos, so only a near-perfect player can win in the 60 to 120 s target.
   Fix: HP 60 to 80 for world 1 (target ~30 hits) or 3 damage base and let combo add. Scale 160/180/200/220 down to about 70/85/100/120. Make hearts refill on phase change (50%), which also fixes the "no comeback" feel.

5. **Boss icicle fairness bug: icicle grid can be misaligned with the row grid.** `launchAttack` reads `n` from the active row, or 4 if no row is active (`game.js` line 203). In phase 2 rows are 5-wide (`rowN`), so icicles launched between rows sit on the 4-column grid (x = 51/137/223/309) while blocks sit at 42/111/180/249/318. Icicle radius is 34 px, so an icicle at x=137 hits a player correctly parked on the 111 column (distance 26). Observed 1 in 34 icicles in my perfect-play trace; also the game recorded "loss=icicle" for a perfect bot in two of three runs. And when no row is active `ci = -1`, so nothing is protected, and the correct column of the next spawned row can already be under a telegraphed icicle. Icicles also stack the player's own previous position: after each shot the cannon stays on the last correct column, which is then a random icicle target.
   Fix: compute `n` from `rowN(run)` not from the active row; exclude the next row's correct column (pre-roll it) or delay the attack until a row is active; shrink hit radius to about 24 px; add a 0.3 s invulnerability after an icicle.

6. **One wrong or missed row = a full heart, with no motor/knowledge separation.** Mis-tap on the adjacent block (motor slip, 3 of 4 runs had one) is scored identically to not knowing 7 x 8. There is no aim confirmation: the block under the cannon at tap time is judged immediately, and blocks sway +/-5 px so a correct tap right at a column edge can flip to the neighbour (`bxOf` includes sway; hit test picks the nearest block, half-width plus 2).
   Fix: for the first 2 wrong shots per level, "wobble" the block instead (shake, no heart) if the tapped block is adjacent to the correct one and the player re-taps within 1 s; stop swaying blocks while the cannon is aiming at them; at least 8 px dead zone between adjacent blocks.

7. **Dead space and wasted screen.** On 375x812 the canvas ends at about 683 px, leaving about 130 px of empty dark bar under the prompt (tap targets could live there). On 1280x800 the game is a 395 px-wide column in a sea of nothing (text panels left and right), so the game is smaller than on the phone, and "Move and press Space" needs both hands on tiny targets. Row 1 spends about 2 s crossing empty sky with no threat (spawn y=140, danger y=490 at 54 px/s is 6.5 s of travel), which dulls the first 5 s.
   Fix: scale canvas to viewport height on desktop (cap 720 px tall); on phones fill the viewport; start row 1 at y about 240.

8. **Distractor quality: some are silly, which makes elimination too easy.** Digit-reversal for a x10 fact gives 9 for 9 x 10 and 21 for 10 x 12 (seen on screen: options 132, 130, 120, 21). "ans - 10" for small answers is not plausible either. "99" for 9 x 10 (a x (b+1) = 9 x 11) is fine but the reversed-digit "9" and "21" are obvious. That teaches "pick the number that looks right in size", not the fact. Also the same facts repeat within a few questions (10 x 8 twice in 25 MTC questions; 6 / 2 twice in 8 division questions), which is not what a real MTC does.
   Fix: drop `rev` when it has fewer digits than the answer or is under 10; never allow the same fact twice in the last 6 (7 for MTC 25).

9. **Rewards and messaging are hollow on failure.** "GAME OVER / NEW BEST! 3" with 3 empty stars, "+1 coins" and a "Worth another go" list of explanations is honest but flat. The game over screen arrives with confetti in the background (celebratory) after a 4-answer run. There is no "so close" progress framing (e.g. "2 more to the next star"), and coins are 1 per answer regardless of level or world.
   Fix: show stars threshold ("30 pts to 1 star"), no confetti under 1 star, 5-coin bonus per level clear, a "best streak" callout instead of NEW BEST on trivial scores.

10. **Legibility slips at the edges.** Canvas scale on 375 px wide is 0.953. 4-column blocks use 33 px numerals (about 31 px, fine); 5-column rows (boss phase 2, worlds 2+) use 28 px numerals, about 26.7 px on a 375 px phone, under the 28 px target. Block size at 5 columns is about 58 x 55 px (OK for touch). In the boss ENRAGED frame the "11 IN A ROW" combo label is clipped behind the boss HP bar, and the boss tip text ("Shoot the answer to the glowing crystal") overlaps the play field where blocks will appear. Crystal text ("9 x 10") is small (about 22 px) and is the only place the actual question also appears in the boss arena.
   Fix: 5-col font 30 px with tighter kerning (blocks are 58 px wide so 2-digit numerals fit); move the combo label under the score or hide it while the boss bar is on; keep the tip above the ridge only.

## Bugs with repro

- **B1: Blitz mode ends on lives.** More modes > 60-second blitz > miss 3 of the first 4. Game over at 5 to 9 s of 60 s. (Design bug, see flaw 2.)
- **B2: Stray tap costs a heart.** Any level: tap a blank area (x random, y 300 to 600) while a row is active. About 40% of stray taps resolve as wrong answers. (See flaw 3.)
- **B3: Icicle grid mismatch in phase 2.** Boss to 50% HP: icicles launched while no row is active are on the 4-column grid, rows are on the 5-column grid. Icicle at x=137 hits a player standing on the correct 111 column. (See flaw 5.)
- **B4: Icicle can be launched with no protected column.** Same fight: `ci = -1` when no active row, so the next row's correct column can be under a telegraphed icicle. Seen as "loss=icicle" for a perfect-knowledge bot in 2 of 3 boss runs.
- **B5: NEW BEST on a score of 3 (blitz) and on the first play of each mode** (all three of blitz, MTC, division showed NEW BEST on run 1; expected since best starts at 0, but the banner is meaningless below a floor).
- **B6: Boss combo label clipping.** In boss phase 2 with a streak, "11 IN A ROW" is drawn behind the boss HP bar (see `shot_boss2_tap_1.png`).
- Not bugs, verified OK: no console errors in any run; blocked localStorage plays normally (settings and coins just do not persist, no crash); pause freezes rows completely (row dy 0.00 over 1.5 s) and resumes; PLAY AGAIN x5 keeps constant row speed (54.0, 54.0, 54.1, 54.1, 53.8 px/s at speed 1.0008, so no creep); Journey link opens the hub view, Back returns to the title, PLAY still works afterwards; Calm mode with 30% accuracy for 25 s: still playing, 3/3 lives; scrollWidth equals innerWidth on all screens.

## What works

- The first 5 seconds are readable and inviting: one giant question at the bottom, four big ice blocks, a highlighted aim block, a hint on the first row. The 33 px numerals and 60 px tall blocks are properly finger-sized. Tap targets on the title and modes screens are 44 to 64 px tall.
- Juice is strong: hit-stop, burst particles, score pops, "ON FIRE!/UNSTOPPABLE!" combo callouts, screen shake, the crystal-to-boss beam, "ENRAGED!" banner with red eyes on the giant at 50% (the phase change is legible and dramatic), pulsing correct-answer reveal after a miss.
- The end screen turns errors into teaching: it shows "You chose 45. Check the tens digit. It is 35." and a strategy line ("Split it: 5 x 5 = 25 and 2 x 5 = 10"). Distractor explanations are pedagogically specific (wrong table, one group short, you subtracted).
- Maths is correct across everything I sampled: multiplication answers, distractor arithmetic and division facts (35 / 5, 80 / 10, 18 / 2). No item had the correct answer duplicated among the options, and no zero or negative options. Division mode uses tables backwards as claimed. One-table mode stayed on the chosen table (7 x n for n = 2..12, in either order).
- Calm mode and pause are respectful (no lives, slower, no timer; pause fully freezes). Storage failure degrades gracefully. Speed is stable across replays. Modes menu, Grown-ups and Journey link are all present and reachable at 44 px+.
- Fair icicle design intent: telegraph 1.05 s (0.85 s in phase 2), a fall of 0.3 s and never over the current correct column is a good rule; it just needs the grid fix (flaw 5).

## Suggested first fixes (highest return, lowest effort)

1. Lives: refill 1 heart per level clear, and no lives in blitz.
2. Boss HP to about 70, base damage 2.
3. Restrict tap-to-fire to the answer band (or forgive the first misfire).
4. Fix `launchAttack` grid (`rowN(run)`), pre-roll the next correct column.
5. Distractor filter for reversed and low-digit numbers, and a no-repeat window for facts.

## Round 2 (after fixes)

Method: Playwright bots in `ib/crit2/` (run.mjs, boss.mjs, sweep.mjs, stray.mjs, misc.mjs, replay.mjs, blocked.mjs). Persona: 9-year-old, 85% accuracy, 0.6 to 1.5 s reaction, some spam taps. 375x812 touch and 1280x800 keyboard. Small samples (2 to 3 runs per config), so treat numbers as indicative.

### Verdict

Clearly better and finally playable through the opening, but not yet ship-ready. Two things stop it: (1) a new zero-skill exploit made by the "bounce" rule, and (2) the boss is still lethal for the target persona. Score: 6.5/10 (was about 4).

### Numbers

- Levels 1-4 survival at 85% / slow reactions: tap died on level 3 at 77 s (score 1052); keyboard died on level 2 at 53 s and on level 4 at 108 s. Levels last about 27 to 30 s each. So an average child reaches level 2 to 4, and the boss (level 5 after 4 levels, or injected at lv4 in my tests) is rarely reached without practice. That is acceptable for an arcade game, but marginal for a "bored 9-year-old".
- Boss (injected at start, 3 hearts, HP 60): tap at 85%: reached phase 2 at 32 s (HP 30), lost all 3 hearts between 53 and 67 s with the boss at 9/60. Tap at 90% (two runs): dead at 38 s (HP 42) and 43 s (HP 39). Keyboard at 85%: dead at 20 s (HP 55; 4 of 8 answers correct, the bot has motor slips). A flawless player needs about 70 s, so the 60-120 s target is right for winners, but the average player never sees the end. The phase-2 heart is not visible as a rescue because it is capped at 3.
- Blitz (85%, phone): 34/39 correct, ended at the 60 s clock (wrong = -2 s), 3 hearts never shown. Works as designed and feels fair.
- MTC (85%): 23/25 in 41 s, 12-item window works (no near repeats seen). Timer 6 s per question felt fine.
- Row speed: 60 px/s and identical across 5 PLAY AGAINs (60.14, 60.04, 60.31, 60.05, 60.03), no creep.

### New bugs

- **N1 (critical): sweep-and-spam exploit.** Repro: start Mixed on desktop, hold ArrowLeft, tap Space every 90 ms, reverse at the walls (`crit2/sweep.mjs`). Result in 25 s: 16/16 correct, 0 hearts lost, level 1 cleared, score 573, with no knowledge at all. Cause: `game.js` line ~173, `slip = !best.ok && (b.moving || ...)`; a moving bullet on a wrong block bounces free, and on the correct block it scores. The same works on touch by dragging a finger across the row while re-tapping. Fix: a bounce should still cost something small (break combo and drop 1 star-point, or a 0.6 s fire lock), and cap free bounces to 1 per row; or only forgive when the cannon was moving AND the player had not fired in the previous 400 ms. Also give the correct block a hit only if the cannon has been within 14 px of its column for at least 120 ms (settled aim).
- **N2 (medium): boss is not survivable for slow players.** In the boss arena a wrong answer AND an icicle both cost hearts, and the two losses cluster (three hearts in 14 s in the 85% tap run). Fix: after any heart loss during the boss give 4 s of invulnerability (no icicles, row paused), and have phase 2 give +1 heart even when at 3 (grant a 4th "bonus" heart slot).
- **N3 (low): ENRAGED banner covers the row.** The "ENRAGED! / Faster attacks" banner and the boss body sit right over the active blocks (see `crit2/shot_boss2_tap_0.85.png`), hiding the numerals for about 1.5 s at the exact moment attacks speed up. Fix: draw the banner above the HP bar or above y=150 and freeze the row for the banner duration.
- **N4 (low): the boss art overlaps the blocks** in the 5-column layout (the giant's arms sit behind blocks 1 and 5 at y about 340). Legible, but visually noisy; lower the boss 30 px.

### Verified fixed

Stray taps: 9 far taps (above the row, just above, below, mid-screen) cost 0 hearts and fired nothing; cannon-zone taps are treated as shots as designed. B2 fixed. Blitz has no hearts (B1 fixed). Icicle grid uses the row grid (B3, B4: no icicle deaths seen in 5 boss runs, all losses were "answer"). Combo label no longer clipped (B6). 5-column numerals readable. Pause freezes rows exactly (dy 0.00 over 1.5 s). Journey opens, Back returns to the title, PLAY works after. Storage blocked: plays normally, no errors, no overflow (scrollWidth 375 = innerWidth). Console errors: none in any run. Tutorial: with no input for 14 s the row holds at y 251, 3 hearts intact, and continues after one correct tap (no stuck state).

### Remaining flaws, ranked

1. **Bounce exploit (N1)**: removes the whole learning premise. Fix as above; highest priority.
2. **Boss lethality for average players (N2)**: lower to about 3 hits per heart lost, i.e. invulnerability window plus a heart at phase 2 above the cap; or HP 50/60/70/80 for the first play of each world.
3. **Level 2-4 survival is only about 30 to 105 s** for a slow 85% player, with keyboard the harder (motor slips while steering). Fix: the keyboard cannon should snap to the nearest column with the arrows (one press = one column, hold = repeat) instead of continuous 400 px/s glide; slow the first three rows of each level by 15%.
4. **Banner/boss overlap (N3, N4).**
5. **Game-over framing**: still no "so close" copy on the failure screen beyond the next-star line; consider a best-streak callout.
6. **Desktop**: still a narrow column (390 px) in a 1280 px page; scaling to about 720 px tall would help both sides.

### What now works

Fair-feeling first minute, stable pacing, stray taps harmless, blitz and MTC modes are good fun, pause/Journey/replay/storage failure all robust, visuals and combo readout clean, and the boss fight has real drama (enrage phase reads well). Fix the exploit and soften the boss and this is a solid times-tables arcade.

## Fixes applied after Round 2 (published in place, version 8 and 9)

- Sweep-and-spam exploit: a bounce (keyboard moving-fire or adjacent edge slip) now costs the combo, locks firing for 0.5 s and is limited to one free bounce per row. Keyboard steering slowed from 400 to 340 px/s.
- Boss: HP 50/60/70/80. After any heart lost during a boss fight there are 3 s where further misses cost no heart. At phase 2 the player gets a heart, or a shield when already at 3 hearts. With the 0.9-accuracy tap bot a full world (four levels and the Frost Giant) now completes in about 84 s with all hearts intact at the end.
- The ENRAGED and power-up banners moved up to 13% of the stage height so they no longer cover the active row.
- Journey page: the embedded hub now cancels the page gutter so its pills and cards are no longer clipped at 375 px.
- Still open: desktop is a portrait column with side text panels; failure screen "so close" line is text only (no progress bar); levels 2-4 remain short for a very slow 85% player.
