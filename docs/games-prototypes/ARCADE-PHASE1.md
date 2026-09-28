# Arcade mode, phase 1 (Penguin Slide)

Built in-app on the real Learning Hub Games tab. Journey and free play are untouched; Arcade is a new card on the Penguin Slide map.

## What exists

| Brief item | Status |
| --- | --- |
| 3 lives (hearts) and Game Over | Built. Third miss ends the run; the run stops one beat later so the answer can be seen. |
| Combo x2 to x5 | Built. Multiplier = consecutive right answers, capped at x5, reset on a miss. |
| Scoring = base x combo + speed bonus | Built. `(10 + speed bonus 0..10) x multiplier`. The bonus is linear over the first third of the gate clock. |
| Gate clock (do nothing = lose) | Built. 9 s a gate (12 s under 8). A gate that arrives untouched is a miss and costs a heart. |
| Daily challenge, fixed seed | Built. One seed + four tables per calendar day (UTC), identical for every child, no personal history in the plan. |
| Endless mode | Built. Up to 40 gates or until the hearts run out. |
| Local high-score table | Built. Top 5 on this device (`localStorage`, try/catch). Never shared, never ranked against anyone. |
| Personal best per mode | Built, kept on the server (`profile.arcade.{run,daily,endless}`); the daily best is per day. |
| Stars | Built. Run / daily: clear the run for 2, clear it without losing a heart for 3. Endless: score thresholds 200 / 600 / 1200. |
| Calm | Built. Calm keeps the run and the score but removes hearts, the clock and Game Over. |
| End screen | Built. Score count-up (instant in Calm), hearts, stars, new best, best streak, the facts to look at, PLAY AGAIN as the biggest button. |

## How it stays server-authoritative

`features/learninghub/games/penguin/arcade.ts` is a pure fold over the simulation's own `Result`s. The simulation is unchanged (`CORE_VERSION` stays 3), so old runs replay exactly as before.

- **Client**: folds each result live to draw hearts, score and combo, and to call `finishNow()` at Game Over.
- **Server**: `finishSession` replays the input log, then `recordRun` (record.ts) folds the same rules over the re-simulated results. Lives, combo, score, stars and Game Over come from there; anything after the last heart is ignored. The browser never sends a score.
- `buildRun` (run.ts) builds the three modes (`arcade`, `arcade-daily`, `arcade-endless`); the daily returns a fixed `seed`, which `startSession` uses instead of a random one.

Tests: `arcade.selftest.ts` (rules, determinism, daily identity, bot runs through the real sim), `e2e/games-arcade.spec.ts` (server result equals the local fold, Game Over, daily identity across two children, Journey untouched, and a UI run).

## Not built yet (the rest of ARCADE-BRIEF.md)

- The shared arcade ENGINE for the other games (loop, question engine, difficulty director, juice kit). Only Penguin Slide has Arcade.
- Speed ramp / difficulty director (the gate clock is fixed per run).
- Power-ups (shield, slow-mo, reveal, double points), coins and unlocks.
- Real bosses with HP as an Arcade stage; worlds of 4 levels + boss.
- Juice: screen shake, hit-stop, particles, combo announcements, rising music tempo.
- Read-aloud for KS1, the shop / unlocks screen, a first-10-seconds playable tutorial.
- The 12 game-specific rebuilds (Convoy Rush, Fish Catch, Sled Run, ...).
- Arcade in Turbo Slide (same simulation, so it is a small follow-up: it shares `buildRun`).
- Translations: the `arc_*` strings exist in English only; other locales fall back to English.
