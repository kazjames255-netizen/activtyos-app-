# Critic review: Fish Catch (KS1 number-bonds arcade)

Tested: preview.html at 375x812 touch and 1280x800 keyboard/mouse, Playwright, speechSynthesis spy, "slow wriggly 6-year-old" bot (1.2-2.5 s reactions, mis-taps, 15% wrong picks). Screenshots and scripts are in fc_snap/crit/.

## Verdict

A charming, technically solid game with a genuinely good core loop: catch the fish that finishes the sum, big digit plus dots, calm pacing, forgiving catch zone. Storage-blocked, no console errors, no horizontal scroll, PLAY AGAIN speed is constant (1.00 at the start of every run), pause freezes everything. Beatable on world 1-2 by the simulated child.

But the headline promise, "everything is spoken aloud", is false in practice. The engine's `say()` calls `speechSynthesis.cancel()` before every utterance, and the next wave prompt fires in the same millisecond as the miss explanation, combo toast, level toast and shield toast. Result: a non-reader NEVER hears why they were wrong, and rarely hears level or combo announcements. Dots are illegible above 10, the digit "1" reads as "!", and calm mode is not actually slower. Score: 6.5/10 as a game, 5/10 as a no-reading experience.

## Top 10 flaws, ranked, with fixes

1. **Speech is cancelled by the next utterance; miss/wrong explanations are never heard.** Spy log (ms, all from one run): `22573 "4 and 1 make 5."` then `22573 "2 and how many more make 4?"` in the same ms, so the explanation is cut to nothing. Same for `ON FIRE! x3 combo` (25091, next prompt 25092), `SHIELD. Absorbs one mistake`, `UNSTOPPABLE!`, `LEVEL 2. Snow Village`, `ENRAGED! Faster attacks`. The tutorial line (3635) also chops the first question mid-sentence (question 2145, cut after 1.5 s). Fix: a speech queue with priorities. Do not cancel for lower-priority lines; delay the next prompt (and its fish becoming "active") until the miss line finishes, or speak miss + next prompt as one utterance ("4 and 1 make 5. Next: 2 and how many more make 4?"). Drop combo toasts from speech or queue them.

2. **Dots are unreadable above ~6, and inconsistent.** 9, 11, 13 spill outside the belly plate (screenshots w2_1.png, w3_2.png); 20/70/80 become thin tally bars that collide with the digit; 10 is dots but 20 is bars, so tens change representation mid-game; distractors up to 40 (e.g. 39 = a+N) are just noise. Fix: draw dots in two rows of five (ten-frame) with a fixed-size plate that fits, cap dots at 10 and for >10 show a ten-frame plus ones; for tens show consistent "ten sticks" (a stick = 10) grouped, sized to fit, and never overlap the digit (put dots above/below with the digit shrunk). Use the same visual for 10 in the tens world.

3. **The digit "1" with a dot beneath looks like "!"** (title/tutorial fish, boss sign at boss0_ball.png). A 5-6-year-old will read "!" and not "1". Fix: use a serif/slab-1 (flag and base) font for digits, or a Fredoka alternate glyph, or put the dot(s) to the side/under a dividing line.

4. **Calm mode is not slower.** Settings copy says "slower, no lives, no timer"; measured speed in calm was 1.03 (same as normal), only lives are removed and heart HUD hidden. Fish keep falling into the ground with no consequence, so a calm child idling gets no pause. Fix: apply a real 0.65x multiplier in `speed()` when calm, and spawn the next wave only after the current one resolves.

5. **Tutorial teaches by ghost hand + a spoken sentence a non-reader cannot use, and the banner text is unspoken.** The tutorial pauses (good) and points at the right fish (good), but the spoken line is long: "Slide Pip under the fish that finishes the sum. Drag, or tap where you want to go." Also the on-screen "Slide Pip under the right fish!" bubble is not the spoken text. It also cuts off the question (see flaw 1). In the test the correct fish was already over Pip, so the "slide" was never demonstrated. Fix: guarantee the tutorial's correct fish spawns far from Pip so the drag is needed; shorten speech to "Tap where the right fish is!"; animate the hand moving from Pip to the fish.

6. **Wrong-fish risk from sweeping.** Catch fires the instant any fish's centre is in a 36 px window and within 44 px (HALF+4) of Pip, so dragging/sliding Pip across the row while fish are at bucket height catches the wrong fish, and mis-taps of 25-30 px in the 4-fish worlds (spacing 86 px) hit a neighbour. Observed on world 4: a "correct-intent" bot with +-25 px jitter took a wrong fish. Fix: for 4 fish keep neighbour spacing >= 100 px (shrink fish or drop to 3), or require Pip to be stationary/within 20 px of a fish centre for ~80 ms before a catch, and show a magnetic snap toward the nearest fish's column on tap.

7. **Boss fights get harsh in worlds 3-4 for a 6-year-old.** With reactions of 1.2-2.5 s and 15% mis-picks, Gale/Barnacle were cleared in 40-50 s, but Fenn (7 hp) and Haggle (8 hp, 4 fish of 62 px, phase-2 1.12x speed, double snowballs, wind that pushes Pip 85 px/s for 1.6 s) killed the bot at 2/7 and 6/8 hp within 37-45 s. Wrong fish and snowball both cost a heart, and there is no boss-specific heart refill beyond ENRAGED. Fix: in boss phase 2 fall back to 3 fish, make snowballs cost half a heart (or only when Pip is not shielded, and give the shield back per phase), drop wind for the age band, and make the ! marker also speak "Snowball!" once.

8. **Boss speech is a mouthful and repeats every wave.** "Gale the Snow Owl has 3. Catch the fish that makes 5." Non-readers must hold two numbers. Fix: speak the full sentence once, then the sum form used everywhere else: "3 and how many more make 5?" The owl sign shows only "3" (no "+ ? = 5"), and the boss health bar overlaps the owl's head at the top (boss0_ball.png).

9. **Pace: a wave every ~3.7 s, plus a queued wave overhead.** Level 1 = 12 questions in ~45-47 s; speed ramps from 1.0 to 1.27 by the end of level 1 (+1.5% of speed per correct answer over 12 answers) and world adds 4% each. For a child who answers in 1-2.5 s this is fine; for a wriggly one who ignores fish, the game keeps throwing waves (the second wave sits as "?" frost fish 190 px above, fine visually) and the prompt for wave 2 is spoken while wave 1 is still being caught, which is confusing (the bucket number also switches at that moment). Fix: do not activate the next wave (speech, bucket number, strip) until the catch animation finishes, and cap the in-run ramp at +10%.

10. **Small clutter/UX.** The unlabeled shield badge (bottom-left) overlaps Pip when Pip is at the left edge (w3_2.png); it is unexplained apart from a toast. Title screen shows five text buttons plus two tiny links; "Endless (beat World 1)" is greyed with small print. "Pick a level: 5, 10, 20 or tens" is a wall of reading. Title Pip has an odd brown box in the bucket. Journey page: the top-right star/fish pills and the main card are clipped by the right edge at 375 px (journey.png), though document scroll width is 375. Fix: use icons plus numerals (a fish-in-bucket 5/10/20/100 tile row), label or auto-place the shield, and fix Journey card widths (max-width:100%, box-sizing).

## Bugs with repro

- **Speech cancels itself.** Instrument `speechSynthesis.speak/cancel`. Play, deliberately catch a wrong fish. `sayMiss` and the next `say` share the same millisecond; `cancel()` kills the miss line. `game.js` `catchFish`/`missWave` call `api.say(w.item.sayMiss)`, and `update()` then calls `api.say(cur.item.say)` as soon as the next wave becomes `wave`. Engine `say()` (engine.js ~line 490) always cancels.
- **Tutorial line truncates the first question.** Press PLAY: question spoken at 2145 ms, tutorial line at 3635 ms cancels it mid-sentence.
- **Calm mode speed unchanged.** Settings > Calm, PLAY, `__fc.api.speed()` reads ~1.03; the settings copy promises slower.
- **Journey speaks nothing.** Open Journey link: Pip's intro card is not read (only the title line stays as the last utterance). Non-reader cannot use it. (Separate game, but it is behind this game's link.)
- **Journey layout clip at 375 px** (see screenshot journey.png): right-hand pills/cards cut off.
- **Catch mismatch feel:** correct in principle (fish touch the bucket rim at fish-centre y=626), but the horizontal window (44 px from Pip's centre with a 40 px half-width bucket and 74 px fish) lets a fish that is visually mostly beside the bucket get caught; and never the reverse. Feels generous, not unfair.
- **Band 0 items include N=3 and 4** ("1 + ? = 3", "1 + ? = 4"), titled "Bonds to 5". Not wrong, but they are bonds to 3/4. Band 2 "Bonds to 20" begins at N=11: "2 + ? = 13" (answer 11) is a count-on-11 fact, not a bond to 20, and `1 + ? = 19` (answer 18) is very hard for Year 1; the a+N distractor (up to 39) has no curriculum value.

## Maths/curriculum check

- Bonds to 5 (N in 3-5, later 5): good Year 1 (all pairs). Distractors: a (Pip's number), N (the whole), +-1, +-2: smart, targeted misconceptions.
- Bonds to 10 (N 6-10): good, Year 1. Distractor "N" and "a" correct as common errors.
- Bonds to 20 (N 11-20, a 1..N-1): mixes Y1 and Y2 and wide difficulty; cluster N=20 and N=10+ making-ten facts first (e.g. 7 + ? = 20 (13) vs 2 + ? = 13). The dot representation cannot show 13-19 legibly (flaw 2).
- Tens to 100 (a, N multiples of 10, a<N, N 50-100): Year 2 appropriate. Distractors: a, N, corr/10 ("3 tens vs 30"), +-10, +20: excellent. But 10 shows as ten dots while 20-100 show as bars, so the digit 10 "looks" different from a ten.
- Missed-item words in `explanation` (Count on from ...) are never read aloud during play because of flaw 1.

## What works

- Core loop is immediate: the strip "1 + ? = 4" plus the bucket number, big fish digits, ghost hand on the first fish; a 6-year-old figures out "move under a fish" in about 3 seconds.
- Fairness rules are good: first miss free, tutorial pauses until input, level shield, hearts returned on level/world clear, boss telegraphs snowballs with a red "!" ellipse 0.9-1.15 s ahead and never targets the correct fish's column.
- Speed is not too fast: ~5-6 s fall time, waves ~3.7 s apart, PLAY AGAIN x5 constant at 1.00 speed at start.
- Robust: localStorage blocked works, no console errors in 5 runs, no horizontal page scroll at 375 or 1280, pause freezes fish, keyboard/mouse/touch all catch correctly, Journey link and "Back to Fish Catch" round-trip.
- Boss: Gale and Captain Barnacle beatable in 40-50 s by the slow-kid bot, world 4 clearable at zero-error; five-hit owl scale is right.
- Visual identity (Pip, fish, worlds with distinct skies) is charming and consistent.

## Round 2 (after fixes)

Tested: preview.html in fc_snap2, 375x812 touch (tap and CDP touch-drag) and 1280x800 keyboard/mouse. `speechSynthesis` was replaced with a timing mock (speech takes ~62 ms per character, cancel cuts the current line) so ordering and truncation are measurable. Scripts and screenshots are in fc_snap2/crit/ (a_speech, b_feel, c_dots, d_boss, e_tut, f_key, g_mouse, h_sweep, i_misc, j_pause, k_journey).

### Verdict

Big improvement: 8/10 as a game, 7.5/10 as a no-reading experience (was 6.5 and 5). The two headline promises now hold. Everything is spoken, in order, and nothing is chopped. Dots are readable up to 10 and the "1" is a clear 1. Calm is genuinely slow. The remaining problems are the boss in world 4 (still kills a slow child), the mouse-only tutorial dead end, tiny "rods" for 11-20, a still-clipped Journey page, and a silent Journey.

### What now works (verified)

- **Speech order and integrity.** 80 s slow-child run (1.2-2.5 s reaction, 15% wrong): 40 utterances, every one played to its end, zero cuts of a playing line. Miss lines ("4 and 1 make 5.") play immediately, and the next question starts right after (about 1 s later). Sequence seen: `2 and how many more make 4?` then `Slide Pip under the right fish.` (tutorial, 1.7 s after the question, no truncation), `ON FIRE! x3 combo` queued between questions, `SHIELD. Absorbs one mistake`, `LEVEL 1 CLEAR. 9 of 12 right`, `LEVEL 2. Snow Village`, `UNSTOPPABLE!`, `SLOW-MO`. Boss intro line plays once ("Fenn the Arctic Fox has 6. Catch the fish that makes 17.") and afterwards only the sum form; the ENRAGED and "DOWN!" lines are spoken.
- **Tutorial.** Correct fish is forced to an edge (x 76 vs Pip 180), the hand points to it, the spoken line is short, the on-screen bubble ("Slide Pip under the right fish!") matches the speech. Touch tap dismisses and the child catches it.
- **Dots.** 9 = two rows of 5 (5+4), 10 = 2x5, 14 = tick rod + 4 dots, 17 = rod + 7, 20 = two rods, 70/90 = 7/9 vertical bars, 30 = 3 bars, 100 = 10 bars. The divider under the digit fixes "1 vs !" (screenshot dots_1.png shows a clear 1 with one dot). Nothing spills outside the belly plate.
- **Catch feel.** Tap, touch-drag, keyboard and mouse: 0 "fish passes through the bucket" events in 4 modes x ~40 s (measured by tracking each fish's minimum distance to Pip while at bucket height; every fish within 34 px was caught). Keyboard at 230 px/s catches (below the 260 threshold): 11/11 correct with a 0.6-1.5 s reaction bot. Mouse hover: 11/11. Speed at 375 with a tap: Pip needs ~0.2 s to settle inside the 22 px window, the window lasts ~0.6 s, so a normal tap is safe.
- **Calm** is 0.6x (fall speed 42 px/s vs 70 normal), hearts hidden.
- **Bosses beatable by the simulated child (85% accuracy, dodges half the snowballs):** world 1 Gale: 28 s, 0 hearts lost. World 2 Barnacle: 44 s, finished on 1 heart. World 3 Fenn: 41 s, finished on 2 hearts. World 4 Haggle: NOT beaten (see flaw 1).
- **PLAY AGAIN x5:** speed 1.000 every time. **Storage blocked:** no errors, replay 1.000. **Console errors:** none in any run. **Horizontal scroll:** none (375 and 1280, title, game over, Journey). **Pause:** state paused, fish y and run time frozen for 2.5 s, no speech during pause, resume continues. **Journey link and "Back to Fish Catch":** round-trips at both sizes.
- Shield badge now top-left, no longer overlaps Pip. Owl sign shows the whole sum ("3 + ? = 4").

### Remaining flaws, ranked, with fixes

1. **World 4 boss (Haggle, 8 hp, 4 fish in phase 2, double snowballs, wind) still kills the slow child.** Run: 8 hp -> 2 hp left at 38 s, hearts 3 -> 2 (42.6 s) -> 1 (48 s) -> dead at 59 s, with only 2 deliberate wrong picks; the rest was snowballs/wind. The 3 s grace after a hit and the phase-2 "heart or shield" did not save it (hearts were still 3 when phase 2 began, so no heart was granted, and the shield does not appear to have refilled). Fix: in world 4 phase 2 also drop to 3 fish and one snowball with no wind for the KS1 band (or make it a Year 2 option only); grant the phase-2 heart when the player is at 2 or fewer, not only when hearts are missing at a fixed moment; give a shield at phase 2 unconditionally; and have a snowball cost the shield first and a heart only when there is no shield.
2. **Rods for 11-20 are tiny.** A rod is ten hairline ticks about 1 px wide inside a 60 px plate (13, 17, 20 in dots_0.png). At 375 px width a 6-year-old cannot count the ticks; it reads as a grey bar. Fix: draw the ten as a bar of 2 rows of 5 small squares (or one thick bar with a bold "10" label) and the ones as dots underneath, or scale the plate by 1.3 for those numbers and let the digit shrink. 100 shows ten bars packed edge to edge with the "100" digit larger than the plate and the fish overlaps its neighbour's tail; widen spacing for three-digit fish.
3. **Mouse-only tutorial dead end.** On desktop, moving the mouse under the correct fish does not resume the paused tutorial; only a click or key does, while the bubble says "Slide Pip under the right fish!". Repro: PLAY at 1280x800, move the mouse only, nothing happens (e_tut.mjs). Fix: treat a pointermove of mouse type (after a tiny threshold) as first input in the tutorial, or change the bubble text on desktop to "Click or press a key to start".
4. **Journey page is still clipped at 375.** The star pill "0 / 75" and the fish pill run into the right edge and the main card and week card lose their right border (journey_375.png). Document scrollWidth is 375 so the earlier fix removed only the horizontal scroll, not the clipping. Fix: `max-width:100%; box-sizing:border-box` on the pills and cards, and let the header wrap. The "Back to Fish Catch" label wraps to two lines and a small "Journey mode: Bond Igloos" line floats beside it.
5. **Journey still speaks nothing about its own content.** Only the title line ("Fish Catch. Press the big yellow button: PLAY") is heard when Journey opens; Pip's intro card "Hi, I'm Pip! Six chicks are hungry..." is silent, and the "Start playing" button is not announced. Fix: speak the intro card on load, and add a listen button.
6. **Keyboard sweeping still catches wrong fish.** The no-sweep rule only stops touch/mouse moves above 260 px/s; the keyboard moves at 230 px/s, so holding an arrow across the row while fish are at bucket height catches the first fish you pass (h_sweep.mjs, "key sweep" caught a fish with 0 correct). Slow mouse sweeps (150 px/s) do the same. This is consistent with "you were under it", but it is different behaviour from the fast-drag rule and a keyboard child cannot avoid it. Fix: lower the threshold to about 140 px/s, or require the fish centre to stay within HALF for 100-150 ms before the catch.
7. **Wind plus keyboard blocks catches.** Wind adds 85 px/s, so holding the arrow in the wind direction gives 315 px/s (above 260) and no catch happens; the child sees the fish pass through Pip. Only in worlds 3-4 boss phase 2. Fix: exclude wind velocity from `pvx`.
8. **ENRAGED banner blocks the boss.** The announcement covers the owl's face and its sign for about 1.5 s right when the next fish are falling (boss0_p2.png). The boss health bar also sits over the mute and pause buttons. Fix: put the banner in the lower third; move the boss bar down 40 px or shrink it.
9. **Bucket/strip hold shows a mismatch.** After a catch the strip and bucket show the previous sum for 0.8 s while the owl sign already shows the next ("3 + ? = 4" above, "2 + ? = 3" below, bucket "3"). It is intended, but in a boss fight it reads as an error. Fix: fade the held item to 50% opacity or add a tick mark.
10. **Curriculum and copy carry-overs.** Title button "Pick a level: 5, 10, 20 or tens" is still a wall of reading; "Endless (beat World 1)" remains greyed with small print. Band 0 still contains N=3 and 4, band 2 still starts at N=11.
11. **Spoken symbols.** "LEVEL 1 CLEAR. 9 of 12 right ★★☆" includes stars; some voices read "black star". Strip symbols from speech.

### New bugs and regressions

- **Mouse-only tutorial dead end** (flaw 3), the only new regression I found.
- The Journey clip (flaw 4) is a not-fully-fixed bug; not new.
- No pass-through frustration, no console errors, no scroll, no regression in speed, storage, pause, hearts or PLAY AGAIN.

### Notes on method

The boss runs used the same shortcut as round 1 (`run.lv=4` to jump to the boss) with 85% accuracy and a 50% chance of dodging each snowball. A run with a real child may differ. The speech mock times each line at about 62 ms per character and does not simulate a real voice queue; it is safe for ordering and truncation, not for absolute timing.

## Fixes applied after Round 2 (published in place, Fish Catch version 9)

- World 3 and 4 bosses: phase 2 no longer adds a 4th fish, a second snowball or wind. Haggle HP 7.
- Numbers 11 to 20: the ten is now a 2x5 block of squares (two blocks for 20) with the ones as dots beneath.
- Mouse-only players now resume the tutorial by moving the mouse more than 25 px.
- Wind no longer changes Pip's speed at all, so it cannot block a catch.
- Star symbols are no longer read out in level-clear speech.
- Journey page: the page's own `main` sizing rule was leaking into the embedded hub and pushing cards 32 px wide of the frame; scoped it to the arcade wrapper. Cards now end at the right gutter at 375 px.
- Not fixed: keyboard/slow-mouse sweeps still catch the first fish passed (consistent with "you were under it"); Journey's own intro card is not read aloud; boss is short (Gale about 30 s for a good player, 45 s for a slow one); bucket and strip hold the previous sum for 0.8 s.
