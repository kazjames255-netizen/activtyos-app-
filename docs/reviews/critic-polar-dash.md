# Polar Dash: critic pass (27 Sep)

Artifact (updated in place): https://claude.ai/artifact/UAtpCWkeMTCiAXRuogSfur
Source (scratch): `scratchpad/dash/` (`part1.html`, `part2..5.js`, `build.sh`, test bots `bot2.mjs`, `replay.mjs`, `daily.mjs`, `shots.mjs`).

Method: headless Playwright against the built page at 1280x800 and 375x812 (touch emulation). Real input only: keyboard (Space/Down/digits), mouse press-and-hold on the canvas halves, CDP touch events on the canvas, and touch on the on-screen JUMP/DUCK pads. The bot reads the sim through `window.__dbg` for sensing only. Runs were WITHOUT god-mode unless stated. Noise parameter simulates a tired human (late/early jumps, held-too-long, and missed actions).

## Top 10 flaws found (as a bored 9-year-old and as a designer), and the fix

| # | Flaw | Fix |
| --- | --- | --- |
| 1 | Too punishing: a non-god bot lost 3 hearts in about 40 s of level 1. Hazards every other chunk, 1.4 s invulnerability, a wrong bubble also cost a heart. | Level 1 (Glacier) has gaps only, none for the first ~2.5 s, wider spacing (gaps 58-72 px early, 190+ px between), no double hazards. Hazard density and gap width ramp with level progress. Invulnerability 1.7 s. Streak of 6 correct wins a heart back. Hitboxes: player 20x44, icicle hit-box narrowed, snowball radius 15, correct bubbles +4 px pickup radius, wrong bubbles -6 px. Result: perfect bot 0 hearts lost; tired-human bot (noise 0.4) lost 0-1 heart in level 1 over 6 runs. |
| 2 | Jump feel: "hold" barely changed the height (110 to 136 px), so it was not really variable. | Real variable jump: v0 -700, gravity 1700 while rising and held, jump-cut to -330 on release (after 70 ms), fall gravity 3300. Range about 50 to 144 px. Coyote 120 ms, jump buffer 140 ms. Tap = hop for middle bubbles, hold = gap or high bubble. |
| 3 | Top bubbles (y=150) needed a perfectly held jump at the apex; almost impossible on touch. | Height lanes retuned to 316 / 250 / 176. Intro card now says "Low bubbles: just run. Middle: small hop. High: big jump." |
| 4 | One boss with a fake feel; no mid-run beats. | Story is now 3 worlds (Glacier, Aurora, Storm), each with its own new hazard, its own puzzle and a mini-boss, then the Baron Blizzard final boss: L0, P0, M0, L1, P1, M1, L2, P2, M2, B. |
| 5 | Boss unfair or thin: attacks telegraphed 0.75 s, Baron had 10 HP (defeated in 31 s by a perfect bot), phase 2 only recoloured. | Telegraph 0.85 s, attacks arrive after the wave ends so they never overlap the same ball window. Baron HP 14. Phase 2: red-violet vignette pulse, denser snow, glowing aura, angry face, new attack order (duck then jump), faster balls. Minis scale: Frostling 5 HP no attacks, Aurora Wisp 6 HP ribbons (duck), Thunder Puff 7 HP shock plus ribbons. |
| 6 | Puzzle: a double-tap during the 650 ms round delay skipped rounds (real bug). Puzzles were the same four rounds for every world and not keyboard friendly. | Input lock per round. Each world has its own puzzle (Ice bridge, Aurora lights, Storm lock) with a different round order. Keyboard only: first tile auto-focused, Tab and Enter, or keys 1 to 4 pick the nth open tile. HUD hidden behind the puzzle card. |
| 7 | Endless/MTC results showed a ghost of the question pill behind GAME OVER (a stale showQ after death in the same frame). | `showQ` ignores calls once the run is over. |
| 8 | Phone layout: stage 342x428 with 100 px of dead space under the pads; title card overflowed and clipped Shop/Settings. | Portrait aspect floor .72 (stage about 302x476 logical), taller pads, title compacted (Tables moved to its own screen, one row of Tables/Shop/Settings). |
| 9 | Economy was hollow: one endless run earned 138 coins and bought the whole shop. Cosmetics unlock by grinding only. | Prices x3 (90 to 400). Seven earned-only unlockables with a stated condition in the shop: Explorer goggles (finish Story), Storm helmet (beat Thunder Puff), Laurel wreath (MTC 24+), Star badge (Story with no misses), Aurora ribbon (clear World 2), Spark trail (Endless 1500), Daily comet (finish a Today's Dash). Nothing random, nothing paid. |
| 10 | Missing: daily, read-aloud, Explorer look, aria announcements, tempo. | See list below. |

## Gaps filled

- Daily challenge: "Today's Dash", 60 s course seeded from the local date (`polar-dash-YYYY-MM-DD`). Hazards, questions and distractors come from a separate seeded stream that misses do not consume (requeues use a side stream), no adaptive speed. Two fresh browser contexts on different start times produced identical first hazard and question sets. First finish each day gives +15 coins. No streak counter (no guilt copy).
- Read-aloud (Settings): `speechSynthesis`, lang en-GB, prefers an en-GB voice. Speaks each question as it appears, puzzle prompts, and the correct fact after a miss ("seven times eight is fifty six"). Speaker button (bottom left) repeats the current question. Fails silently if speech is missing.
- Explorer look (Settings, Junior/Explorer): smaller eyes, no cheeks, brow line, sash, slimmer body, and rounded-square answer tags instead of bubbles. Works with every hat and trail.
- New hazards: icicles (Aurora, duck), snowballs (Storm), lightning columns (Storm: a timed 1.6 s cycle with a 0.3 s strike, flickering red warning and a ZAP label; harmless above 30 px, jump or time it).
- Hit-stop 45 ms on correct and 70 ms on hurt (skipped in Calm), combo callouts NICE / ON FIRE / UNSTOPPABLE / LEGEND / UNBEATABLE, music tempo and pitch now rise with the streak (`mInt` was declared but never set before) and drop on a miss.
- Aria: `#live` region announces world start, boss and phase, hearts lost/gained, misses with the fact, puzzle round prompt, results and unlocks. Ticks and hearts are also text.
- Keyboard: the whole game is playable with keys (Space/Up/W, Down/S, P/Esc), all menus are focusable buttons, puzzles by keys 1-4.

## Verification (final build)

| Check | Result |
| --- | --- |
| Story, keyboard, 1280x800, no god-mode, noise 0.3 | Completed all 10 stages, 3 hearts left, 48 of 50 correct. |
| Story, touch (CDP) 375x812, noise 0.3 | Completed, 1 heart left. |
| Story, mouse 1280x800, noise 0.5 | Reached the Storm world before losing (bot lags on snowballs). |
| Endless (mouse), MTC (keyboard), Daily (touch pads, storage blocked) | All ran to the results screen, no errors. |
| Calm and Explorer runs | Ran, no errors. |
| Replay x5 (Endless, storage blocked) | World speed 166.3, 166.4, 165.9, 165.9, 166.1 px/s and `loops` stayed 1. No loop stacking. |
| Console and page errors | None in any run (Google Fonts failures ignored offline). |
| Storage blocked (`localStorage` getter throws) | Runs and saves nothing, no errors. |

## Second critique (what is still weak)

- Level 1 length is short (about 8 questions in 46 s). Fine for a bored kid, thin for practice. Endless and MTC cover volume.
- The Explorer look is less cute, not mature: the penguin body is still round. A full alternative sprite would need art time.
- The tired-human bot dies more often in the Storm world when the timing of snowball jumps slips. That is intended difficulty growth, but a real 9-year-old on touch is untested; the target is "beat World 1 in 1-2 tries", which the bots support.
- Lightning columns are legible on desktop but small on a phone; the ZAP label helps. Watch for a first-time confusion on touch.
- Speech voice quality depends on the browser; no en-GB voice falls back to any English voice.
- `window.__dbg` is left exposed for the tests. It is harmless but should be removed before any real release.
- Not verified on a real phone (haptics, audio unlock, real thumb reach).
- Daily determinism holds for hazard and question order; the position of power-ups depends on how many correct answers the player has made.

## Guardrail check

No Mario or Nintendo names or imagery, no mention of the forbidden name, no green theme colour (navy, violet, gold, red, ice blue), no random or paid rewards (all unlocks are conditions), no chat, no public ranking (local best only, storage in try/catch), no external requests except Google Fonts. Nothing committed; no dev servers touched; no e2e queue.
