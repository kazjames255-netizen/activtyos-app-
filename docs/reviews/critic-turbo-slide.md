# Critic review: Turbo Slide (times-tables racing arcade)

Artifact: https://claude.ai/artifact/9FaF5ULQTMNyLhswFzWUGo (republished in place, version 3)
Source: scratchpad `turbo/` (`head.html`, `body.html`, `game.js`, built to `page.html`; v1 kept as `*.v1.*`).
Method: Playwright with real keyboard, real mouse, and CDP touch events (swipe, tap, boost-button hold) at 375x812 (DPR 2, touch) and 1280x800. Bots with human-like reaction delay and configurable accuracy played Career (incl. forced boss), Endless, Blitz, Times Tables Check (25 answers, ended via forced count), Daily, Free and Calm. Console watched, storage blocked run, 5x replay speed measurement.

## Verdict as a bored 9-year-old and as a designer
- v1 looked good but was cramped by its own rules: rows came 1.2 s apart at top speed, the feedback text hid the NEXT question, and the sled felt like a slider. Nitro was a plain speed toggle. Nothing to chase after five runs except four skins.
- v2: steering is snappier (lerp 15/s, lean, snow spray), nitro is a charge-and-release blast with a smash, drops arrive every 8-12 correct, the boss has 40 HP and a phase change, and there is always something to unlock.
- Honest test: for 10 minutes, yes for a times-tables kid; the variety ceiling (one road, one mechanic) is still the limit. See Still open.

## Top 10 flaws found (all fixed unless noted)
1. HI-DPI PHONES WERE BROKEN: the canvas had no CSS width/height, so at devicePixelRatio 2 it rendered at 2x size, cropped and shifted (no sled visible). Only worked at DPR 1. FIXED (`#c` 100% x 100%).
2. Rows only 1.2 s apart at max speed (48 units at v=40): the next question was on screen barely long enough to read. FIXED: spacing is now at least 2.0 s (Blitz 1.5 s) at any speed, speed capped at 34 (the rest is visual: speed lines, FOV kick).
3. Correct/wrong feedback replaced the question text for 1.5 s, so the NEXT question was hidden exactly when it mattered. FIXED: feedback moved to a separate bubble under the panel, the question is never overwritten; the right answer also pops above the correct car in the world and stays 1 s.
4. Steering on touch: pointer was absolute-lane, so swipes and taps could not be told apart and a swipe from the wrong side jumped lanes. FIXED: tap jumps to that lane on release, drag/swipe moves lane-by-lane from where you are (verified with CDP touch; the first version of this fix, tap on down, made swipes wrong 3 of 6, caught in test).
5. Nitro was a hold-to-go toggle with no decision in it. FIXED: hold to charge (sled slows and shakes, ring fills on the button and around the sled, rising whine), release to blast (0.7-2.6 s of 1.65x speed, x2 points, smashes traffic, 2 boss damage per smashed block). Charge costs nitro, refilled by right answers (about 5 answers per full charge).
6. Calm did not remove lives (brief says it does). FIXED: Calm runs lose no hearts/time, and a Calm Blitz ends after 25 answers instead of a clock.
7. Boss was 16 HP, dead in about 35 s for a perfect player, attacks were a strict q,b,q,b loop with no telegraph. FIXED: 40 HP (about 80-100 s at high accuracy), red lane telegraphs, coins in the safe lane, phase 2 at 50% (faster, oncoming blocks, sometimes two attack rows in a row), roars, boss lunges on attack, smash damage. Boss can still defeat you (hearts).
8. Overlays (game over, Grown-ups, Garage) were translucent: old cars and numbers bled through the score. FIXED: solid backgrounds.
9. Missed-item review was one line per fact, no explanation (brief asks for explanations). FIXED: each missed fact shows what you chose and why it is wrong (one too many groups, adds instead of multiplies, digits swapped...) plus a strategy line.
10. No first-run onboarding and no waiting on first input. FIXED: ghost hand + one-line hint, the game holds (with the first row already visible) until the first steer/tap/key on the very first run.

Also fixed on the way: `#q` showed "Watch out!" when a traffic row was nearest (now "DODGE!"/"GET READY"), a 0.9 s free-wrong window after a crash (wrong answers are now always penalised), stars thresholds rebased after measuring a perfect bot (Career 900/2000/3500; Endless and Daily 800/2000/3500; Blitz 400/900/1500; MTC 15/20/25), coins for stars.

## Brief gaps filled
- Power-ups: Shield (absorbs one miss or crash, combo kept), Slow-mo 5 s, Reveal (removes one wrong option for 3 items), Double points 10 s. Drop every 8, 10, 12, 9, 11 correct answers as a pickup in a lane (fixed order, not random), never in the boss fight or MTC.
- Hold-to-charge nitro (above), with smash.
- "Grown-ups" link on the title: 11x11 fact grid (blue tick secure, violet ~ learning, red ! needs practice, blank not asked; symbols so colour is not the only signal), tap a fact for its history, "Missed most" list with last six answers, totals, reset (two-tap). Weak facts are up-weighted in later runs from the same data. Nothing leaves the device.
- Juice: hit-stop clamped 40-80 ms, screen shake, ON FIRE x4 / UNSTOPPABLE x5 announcements plus orange/violet edge glow at x4/x5, layered music (kick, hats at x3, arp at x4, top line at x5, tempo rises with combo and nitro), crunch on correct, low thud on a miss, haptics via vibrate, trail particles.
- Speed/lanes readability on phone: gentler perspective (labels legible farther out), active row highlighted with a gold ring and larger label, other rows dimmed, speed streaks scale with speed, coins mark the safe lane, red pulse marks blocked lanes, minimum label size, sled 15% smaller so it does not hide the row behind it.
- Unlockables (earned only): 7 sleds and 5 trails in a Garage. Coins buy Violet/Gold/Frost sleds and the Frost trail; Ember (reach x5), Midnight (beat the boss), Rose (100 right), Stars trail (3 stars), Comet trail (Daily on 3 days), Ribbon trail (500 right) unlock by doing the challenge. New unlocks are announced on the end screen.
- Stars: shown live in the HUD, animated in on the end screen with a rising note, best stars shown on each mode button, "Next star at N".

## Verification
- Input: keyboard (arrows, Space held/released), mouse (click lane, drag), touch via CDP (relative swipe, tap, boost button hold). All steer correctly; boost hold charges and blasts on all three.
- Console errors: 0 in every session, including storage blocked (localStorage getter throws) and a session that plays, dies, opens Grown-ups and Garage.
- Replay 5 times with storage blocked: 1.01 game-seconds per real second and v=18.0 on every replay (no loop stacking; one rAF loop). Also verified the tutorial hold releases on first input.
- Daily: identical first rows across two independent page loads (seeded).
- Shield test: first forced wrong answer kept 3 hearts, next two dropped to 2 then 1. Reveal shows a crossed-out ice block and decrements. Slow/Double chips count down.
- Perfect-bot career: Stage 5 reached at about 90 s, boss about 40 HP taking over 100 s, phase 2 triggered, no errors.
- Guardrails: no "Oak", no green in the colour list (checked all hex values), no random or paid rewards, no chat, no ranking (local best only), no external requests except Google Fonts.

## Repeat critique (after fixes)
Replayed Endless at phone size with difficulty forced to maximum: two rows visible with clear gap, coins in the safe lane, labels readable, nitro blast reads as fast. Nothing blocking. Remaining items are below.

## Still open
- Only one road and one mechanic: after about 5 runs the variety comes from stage lighting, power-ups and traffic, not new obstacle types. Ideas: ice patches that drift the sled, a bonus coin lane rush, a boss per stage set.
- Blitz pace (1.5 s gaps) is fast for weaker readers; consider a Blitz "easy" tier.
- Audio balance and real vibration/touch feel unverified on a physical phone; a real 60 fps device check is still needed (headless timing only).
- Boss art is one sprite in two colours; a reactive face or a second attack type (snowballs in the answer lane) would add tension.
- KS1 read-aloud is not applicable (times tables are Year 3-4) and was not added.
- Grown-ups view shows the last six answers only; no long-term trend chart.
