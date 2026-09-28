# Critic: Lantern Cove "Storm Night" (arcade mode)

URL (updated in place): https://claude.ai/artifact/5QpzTCRRVx8rPEfdcLGNnA

## What was built
- PLAY launches Storm Night. The original campaign is embedded and loaded lazily behind "Journey" (title screen). Calm is an option, off by default (auto-on for reduced motion).
- Loop: tap order bubbles (questions) and build/upgrade on an 8x8 grid. Buildings produce and need materials over time (lighthouse needs sails, bakery needs bricks), with adjacency bonuses (library+cafe +20%) and a +25% waterfront bonus. Every 40-58 s a storm: 10 rapid questions, one wave and one sea-wall section each. Right answer raises the section; wrong or timeout floods the shore-side building in that column (repair with materials or a one-question quick fix; flooded twice = washed away). 4 floods = breach = lose a heart. Storm subject picked at dusk.
- Banks: maths 412, science 255, English 300, French 404 generated items (was ~15 each). True/False appears in storms and now updates mastery (also fixed in Journey: TF lifts a fact to 1, only multiple choice secures it).
- Kept: grid, BFS residents (they shelter during storms), day/night, keepsakes (12 postcards). Added: combo, live score, juice, coins, shop (walls, themes), Daily Storm (seeded), missed-item review, PLAY AGAIN.

## Verification
- Playwright, 375x812 touch and 1280x800 mouse/keyboard; replay x5 measured constant (wave timer 1.00 s/s, one rAF loop, ~120 rAF/s in every run); storage blocked run clean; 0 console errors; multi-storm bot run (4 storms at 60% accuracy) and Daily run completed.

## Critique round 1 (bored 9-year-old, independent agent + own play) and fixes
1. No first-10-second reward: first order is now always an easy question.
2. Wall too thin to read: wall taller, HUD shows "Wall n/10".
3. Desktop answers small: larger answer buttons and question text at >=900px.
4. Heart loss unclear: "-1 heart" pop plus BREACH banner.
5. Palette clipped on phone: fade mask, card state now updates in place (no re-render eating taps).
6. Subject chips confused with materials: added "Choose your storm subject" label.
7. Title link contrast raised.
Not reproduced: "no pressure in storm 1" (headless auto-pause on visibility change was the cause; verified timer drains at 1.00 s/s).

## Remaining gaps
- Real touch feel and audio not verifiable headless. Music/sfx are synthesised and untested by ear.
- Economy balance is untuned beyond a bot; idle days cost only missed points (no leak).
- Resident BFS during storms is cosmetic.
- Tutorial is one bubble plus ghost hand; placement is not taught.
- Read-aloud uses device voices, not verified.
