# Critic review: Blackout (arcade, local build)

Method: played ~6 sessions with Playwright at 375x812 (touch, DPR2) and 1280x800 (mouse + keyboard): tutorial, a fast accurate run (~70s), a slow "human pace" run and an idle run to meter-fill, a 3-wrong-answers Game Over, the boss (api.run.lv=4 shortcut) win, Shop, Journey title. No console errors or warnings in any session. Not played: Daily, Endless, a boss loss via meter, a real human-speed 10-minute session. Screenshots are in scratchpad/ar/critic-cr/.

## Verdict
A polished, readable fix-the-circuit game with good juice (glowing sparks, POWER ON, combo, penguin) and unusually honest science explanations. But as an ARCADE game it is far too gentle and too slow. The darkness meter almost never creates pressure, wrong answers are punished harder than slowness, and rooms look identical to each other, so the loop is "answer a quiz, tap one of 3 cards" with a few seconds of animation. A bored 9-year-old would play 2 to 3 minutes, enjoy the boss, and go back to YouTube. It is a good 3-minute revision game, not yet a 10-minute choice. Layout bugs on every overlay screen (stale canvas text) make it look unfinished.

## What works
- Clear core read: dark lamp, dashed gold "fix here" circle, 3 big tappable part cards with icons. The tutorial hand shows exactly what to do.
- Juice is strong: sparks travelling along wires, lamp glow, "+17" floaters, confetti, screen tint change on fix, POWER ON banner.
- Feedback text is genuinely educational and short ("Brass is a mix of metals, so a key conducts").
- Wrong-answer game over screen shows the chosen wrong part and the explanation, and PLAY AGAIN is a large primary button.
- Touch targets are big (cards ~100x108 CSS px, tiles 52x44, buttons 48-64px). Keyboard works (Enter to start, 1-6, arrows, Enter). Tapping empty board space is safely ignored (no accidental heart loss).
- Boss is the best moment: spreading red shorts, a readable branch diagram, a "PRECISE!" bonus, clear win screen with heart back. 100%-accuracy clear took 36s.
- Guardrails respected: no green, no Oak, no random rewards, no chat ("Nothing is random" in the shop).

## Top flaws (ranked)
1. **Meter pressure is near zero.** At a slow ~4.5s per fix the meter sat at 3 to 19% for a full minute; with one room left dark and no action it rose only ~0.85% per second (82% after ~95s, Game Over after ~110s). The bot at 0.7s per fix never left 0%. Rooms go dark one or two at a time, so there is never "6 rooms dark, panic". The fiction (rooms going dark one by one, darkness fills) is not felt. Fix: spawn faster and in bursts, 2 to 3 dark at once from 20s, meter rate scaling with dark-room count squared, first Game Over-by-meter reachable within ~45s of idling, show a red vignette and heartbeat above 60%.
2. **Hearts are the real fail state, and they never come back mid-run.** 3 wrong taps ends the run in ~25s with a 1-of-4 review. Slowness is barely punished but a mis-tap on a similar-looking card is fatal. Wrong answers on 3-card multiple choice with an obvious answer (Wool sock / Coin / Paper) are also trivially guessable, so it reads as quiz, not skill. Fix: give a heart back every 5 to 8 right in a row (or a shield power-up drop), make the meter the main fail state, and make distractors less trivial (e.g. Pencil lead vs Wooden pencil casing, Plastic-coated wire).
3. **Repetition and low variety in the first minutes.** Level 1 was "gap:e" 6 times in a row (Airlock/Bridge same board, only the key/coin changes). No difficulty ramp in what you do, only the timer. A 9-year-old will see the same wire loop with the same three cards over and over. Fix: interleave switch, cell, flip, screw from room 2, vary board shape, and add a "dark room needs series/parallel" every third fix.
4. **Stale canvas text bleeds through every overlay.** "Lights on. Wait for trouble..." is drawn under LEVEL CLEAR, WORLD CLEAR and GAME OVER ("Worth another go" collides with it), and the room tiles, darkness bar, and score sit behind the result panel. On Game Over the big score "19" is printed on top of the room tiles. Looks broken. Fix: clear the play-field layer (tiles, darkness bar, hint text) when the results panel is shown, or hide the hint string in non-playing states.
5. **The answer banner hides the lamp and the wires.** In the tutorial, the "Tap the part that fixes it!" banner covers the bulb and bottom wire, so the child cannot see the lamp they are meant to be lighting. After a wrong answer, the red explanation banner sits on top of the "Dock control is dark" caption and the penguin. Fix: anchor the banner below the tray or above the board; never over the circuit.
6. **The phone layout wastes about 25% of the screen.** At 375x812 the game is a 360x640 card with ~190 CSS px empty at the bottom, and on 1280x800 it is a 430px column with two text panels beside it. The circuit board is small (about 250px wide) with thin 3px wires; the lamp icon is ~28px. Fix: scale the canvas to available height (or make the layout 9:19.5 on phones) and enlarge the board, lamp and cell.
7. **Pause button and new-dark ring collide with the top HUD.** The round pause button floats over the 6th room tile (the "!" ring on Dock control is clipped by the right edge and sits behind the pause button), and it overlaps the boss health bar area. Fix: move pause into the HUD row or above the tiles.
8. **Wrong-answer explanation is delayed to Game Over and deduplicated.** Three wrong answers of different gap types produced one review entry ("1 of 4 right", one item). The child does not see why they lost hearts 2 and 3. Fix: show the reason inline on the failed card (already have `why`), and list each miss (or group with a count) in the review.
9. **Boss instruction not persistent.** During the fight nothing on screen says "tap the switch between the red and the reactor" (only in the desktop side text). Boss rooms are unlabelled yellow bars and the boss health % bar duplicates the meter. Bot at 75% accuracy lost 2 hearts in about 6 taps with no clear reason on screen. Fix: a one-line sticky hint ("Open the switch UNDER the red bit") for the first 10s and a red flash on the correct switch after a miss.
10. **Progression feels flat and modes feel disconnected.** Score-only reward, 0 coins after a full run, the Shop is all locked until 40 to 60 coins (a run earned 1 coin), Endless is locked behind "beat World 1", Daily is a plain button, and Journey is a completely different visual style (light body, Back to Arcade). Fix: reward 5 to 15 coins per run so the first hat is reachable in 2 runs, unlock Endless sooner or show a progress bar, and share the header and colours between modes.

## Science accuracy issues
- **Pencil lead note** says "not a metal, but it does conduct. It resists the current a bit, so the bulb is dimmer." Accurate for graphite (a KS2 "surprising conductor"), but check that the simulator really dims the bulb in the loop when lead is placed, and that the bulb dims for a kid-visible amount. The claim of "dimmer" is only true if the lead is long or thin; a 1-2cm lead would barely dim it. Suggest "may make the bulb a little dimmer".
- **Conductor/insulator:** "Brass is a mix of metals" is correct (copper+zinc). "Steel paper clip", "Iron nail" correct. "Wool cloth", "Dry wood" insulators are correct; the "Dry" is good. Aluminium foil is correct. Rubber, plastic, glass, paper are correct. (Marble = glass: fine.)
- **Cells opposing:** "Cells facing opposite ways push against each other and cancel out, like a tug of war." Correct for two identical cells. But it implies either fix works ("Flip one cell"); good. Wording "cancel out" is fine, but note the lamp will not glow at all only if the cells are identical.
- **Current direction:** sparks travel round the loop, but the cell art shows "+" on the right end and the spark flow direction was not checked against conventional current (+ to -) in stills. Verify sparks leave the positive terminal; UK KS2 uses conventional current. Also please make sure the sparks are not implied to be "electrons".
- **Series/parallel explanations** ("In a line, one path. One broken lamp stops both"; "each lamp has its own loop back to the cells") are correct. "Parallel: closing either switch completes a loop" is correct.
- **Sw:4 decoy:** "The other switch sits on a dead-end branch" (open dead-end branch does not matter): correct.
- **Wire in the cell slot:** "A wire completes the loop but nothing pushes current" fine. "Another bulb has no push of its own": fine, although a bulb in the cell slot also completes the loop; add "and the lamp would be dimmer" is not needed.
- **Boss text:** "A short circuit spreads along closed wires" is game fiction, not physics: a short circuit does not spread along wires. Acceptable as fiction but label it "in this game". "Short circuit" in the real world is a low-resistance path bypassing the load; the boss fix (open a switch to isolate) is OK.
- "Cells give the push" is fine for KS2; avoid "power source" alone.

## Bugs
- Stale "Lights on. Wait for trouble..." text visible under LEVEL CLEAR / WORLD CLEAR / GAME OVER (Game Over: overlaps "Worth another go").
- Game Over: big score number overlaps the room tiles; tiles and "DARKNESS 0%" bar remain behind panel.
- Tutorial banner covers the lamp and lower wire (375x812).
- Wrong-answer banner overlaps the caption and penguin.
- Pause button overlaps the 6th room tile and its dark ring is clipped at the right edge.
- Boss screen: "-4" damage floater overlaps the boss face, and "PRECISE!" floater overlaps "+50" (both faint but messy).
- Review de-duplicates by `item.key`, so three separate misses show as one line ("1 of 4 right").
- Tutorial hand cursor sits on top of the "Coin" label, hiding the word.
- Title screen: the "Blackout" logo overlaps the row of room tiles behind it (tiles visible under the title).
- Combo display: the internal combo counts (x42 in bot logs) while the displayed multiplier is capped at x5: "42 IN A ROW" is fine, but the multiplier cap is not explained.
- Boss with keyboard: keyboard doesn't seem to reach boss switches (only the desktop text says to tap); not verified thoroughly.
- Intermittent first-load timeout in Playwright `goto(load)` (one of 8 loads, file:// build, ~270KB): possibly a font request; harmless offline but check that fonts do not block `load`.
- No console errors or warnings in any run.

## Suggested fixes (short list, in priority order)
1. Make the darkness meter matter: burst spawns, faster fill with more dark rooms, urgent audio/visual cues.
2. Give hearts back on streaks; make the meter the main loss condition.
3. Clear the play layer under all overlays (stale text, tiles, bar).
4. Move the hint banner off the circuit; enlarge and fill the phone canvas.
5. Reposition pause; fix HUD collisions.
6. Show the reason inline at the moment of a miss; list every miss in the review.
7. Add variety in early levels; make distractors trickier (pencil lead, wire with plastic coat).
8. Persistent boss hint; flash the correct switch after a miss.
9. Make the first 40-60 coins reachable in 2 runs; unify Journey styling with the arcade.
10. Tighten wording: "may dim the bulb", "in this game a short spreads", and verify spark direction.

## Response after the first critique (republished in place, version 5)
Fixed: meter pressure raised (rate scales with dark rooms to the power 1.35, occasional two-room bursts from level 2, gentler at level 1, heartbeat tick above 70%); a heart returns every 8 in a row; the cell and loose-bulb rooms now appear from the first level; stale canvas text and room tiles are no longer drawn under Game Over, level clear and world clear; the tutorial tip sits at the bottom so the lamp stays visible; room tiles are smaller and clear of the pause button; the review lists each miss by the part chosen (dedupe key includes the choice); the boss shows a 14 second on-screen instruction; shop prices roughly halved; the pencil lead note now says the bulb "may be dimmer" and the boss explanation says "in this game a short circuit spreads" (also applied to Journey text). Spark direction checked against the solver: sparks travel from the cell's + end round the loop (conventional current).
Not fixed (engine or layout limits): unused space below the 9:16 canvas on tall phones; Journey keeps its own lighter look.

## Second pass
Method: touch at 375x812, runs: a human-pace run (2.5s per fix, 85% accuracy, reached level 2), a deliberate Game Over, the boss at level 4 (80% accuracy, boss reached 12 of 44 HP with a heart left), and an idle-meter check. Screenshots in scratchpad/ar/critic2/bo/. Console errors or warnings: none.

Verified fixed:
- Game Over is now clean: no stale "Lights on..." text, no tiles behind the panel, and a clear "Add a cell" review with a plain reason. PLAY AGAIN, Menu and Shop are all in the canvas.
- The boss hint "Open the switch between the red short and the reactor" is visible on screen in the boss intro. The pause button is clear of the tiles, and the tiles are smaller.
- Boss intro screen is readable, with the boss face and HP bar.
- Level 2 title card is fine.

Remaining or new flaws (ranked):
1. Pressure is still barely felt. At a human 2.5s per fix the meter peaked at about 11%. I could not confirm the new bursts and heartbeat, because the idle test stayed at 0% for 65s with one room dark (the tutorial seems to freeze the meter). Unverified above 70%.
2. The Level 2 card ("Lights on. Wait for trouble...") shows a big empty panel with a lot of dead time between rooms, and the darkness bar stays at 0% there. Nothing to do for a bored child.
3. The boss intro title "THE OVERLOAD" and its subtitle sit on top of the switch diagram for the first seconds, so the hint is hard to use until it fades.
4. The phone layout still leaves about 190px empty at the bottom (unchanged).
5. Game Over came from 3 wrong picks in a row for a child who guessed (0 of 3, 0 coins), so early failure is still abrupt. The hearts-back-every-8-combo fix only helps kids who are already winning.

Verdict: much cleaner than before and the explanations are still the best part, but with almost no time pressure it is a quiz. A 9-year-old would give it 5 minutes, not choose it over YouTube for 10.
