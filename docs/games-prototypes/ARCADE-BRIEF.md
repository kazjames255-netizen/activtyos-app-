# ARCADE MODE brief (owner decision: "Add Arcade mode")

Kaz's decision: every game gets a fast ARCADE mode built on ONE shared arcade engine. Arcade is what Play launches by default. The existing journey campaigns (worlds, stories, stakes) stay as a second mode ("Journey") on the title screen. Calm mode stays an option (slows 40%, removes lives and timer). Update each existing artifact URL IN PLACE (do not create new artifacts).

Why: the journey games are well made but read as worksheets with art: little real-time pressure, no real fail states, lesson cards, fake bosses. Kids should CHOOSE to play: fast, tense, rewarding, replayable (Subway Surfers, Fruit Ninja, Crossy Road, Space Invaders). Learning stays rigorous; the fun comes from delivery.

Guardrails that still apply (owner rules): no "Oak" anywhere; no green as a theme colour (semantic ticks only); no random/paid rewards or loot boxes (coins and unlocks are earned deterministically); no chat; no public ranking (high-score table is local, localStorage in try/catch); no external requests except Google Fonts; no dark patterns or guilt copy; Calm auto-on for prefers-reduced-motion; keep the penguin (Pip) as main mascot with Junior/Explorer looks (Explorer must not be cute for older kids); UK curriculum-correct content; every game works with storage blocked.

## Design pillars
1. The player controls something in real time, all the time (character, cannon, sled, boat, paddle, cursor). Answering = moving to, catching, hitting, shooting or steering into the right thing. Never "tap an answer then Check".
2. Pressure is the default in Arcade: things approach, fall, scroll or tick. Do nothing = lose. Speed ramps during a run.
3. Failing is real: 3 lives (hearts); losing all ends the run with Game Over and PLAY AGAIN as the biggest button.
4. Score = base x combo multiplier + speed bonus; combo x2..x5 with consecutive correct, resets on a miss. Live score always visible.
5. Never stop the flow on a correct answer. No lesson cards mid-run. On a miss: a short (<=1.5s) in-world flash of the right answer. Full explanations of every missed item on the end-of-run review.
6. Juice: screen shake, particles, hit-stop 40-80ms, popping score numbers, combo announcements (ON FIRE / UNSTOPPABLE), music pitch/tempo rising with combo, crunch on correct, dull thud on a miss, confetti + score count-up at the end. Respect prefers-reduced-motion.
7. Real bosses at the end of each world: HP bar, timed attacks, behaviour change at 50% HP, can defeat you, 60-120 s. Correct = damage, fast = more, combo = double.
8. Reasons to return: personal best per mode, stars for score thresholds, unlockable characters/skins/trails bought with earned coins, a daily challenge with fixed seed, endless mode with local high-score table.
9. Calm mode is an OPTION not the default in Arcade.

## Shared engine (build first; reuse everywhere)
Single-file friendly, canvas rendering (DOM for menus/HUD), one rAF loop with delta time. Modules:
- Game loop: ONE loop only (guard against stacking on Replay: a known bug); pause on visibilitychange, Esc/P and a pause button.
- Input: keyboard (arrows/WASD/space), touch (tap/swipe/drag), mouse. Lane games: swipe or tap left/right half. Works at 360px portrait and desktop. Buttons >=44px.
- Question engine: nextItem(difficulty) -> {prompt, correct, distractors[], explanation, tag} on top of each game's existing generators/banks and misconception tags. No repeat within 5 items. Spaced repetition: missed items return 3-6 items later, weighted up next runs.
- Difficulty director: rolling accuracy over last 8 items: >85% -> +8% speed and +1 difficulty step; <60% ease both; caps per age band; speed also ramps slowly with time survived.
- Scoring: base 10, combo up to x5, speed bonus up to +10 in the first third of the window, boss damage bonus. HUD: score top-left, combo top-centre, hearts top-right, level/progress bar.
- Juice kit: shake(intensity,ms), hitStop(ms), burst(x,y,color,n), popText(x,y,text,color), flash(color), announce(text). WebAudio synth sfx (correct pitch rises with combo, wrong, whoosh, coin, boss hit, boss roar, level up, game over) and looping music that speeds up at combo x3+. Mute toggle remembered.
- Power-ups (every 8-12 correct): Shield (absorbs one miss), Slow-mo (5s half speed), Magnet/Reveal (removes one wrong option for 3 items), Double points (10s).
- Screens: Title (big PLAY, best score, daily challenge, Journey mode link, small "Grown-ups" link), mode select, HUD, pause, Game Over / Level Complete (count-up, stars, new-best fanfare, coins, missed-item review, PLAY AGAIN primary), shop/unlocks, settings (calm, sound, music, text size, read-aloud).
- Read-aloud: for KS1 games every prompt and instruction is spoken (speechSynthesis en-GB) with a replay speaker button; assume the child cannot read.
- Persistence: localStorage (best scores, coins, unlocks, settings, SR queue) in try/catch.
- Teacher/parent view stays, behind "Grown-ups".
Run structure: LEVEL = 60-90 s or 15-20 items, whichever ends first. WORLD = 4 levels + boss. Endless unlocks after World 1. First 10 s of Level 1 = playable tutorial (ghost hand; game waits for first input).

## Visual/feel
Consistent penguin/ice style, bold outline, soft shading, bright colours; everything moves (idle bob, parallax, particles); answer text >=28px on mobile; max 8 words on screen during play; correct = gold burst, wrong = red flash + shake, never colour alone.

## Game-by-game arcade specs
1. Bridge Builder -> "Convoy Rush": side-scrolling road; trucks drive toward a gap; fraction planks slide on a conveyor; drag/tap the plank(s) that exactly fill the gap before the truck arrives; wrong total = truck falls, lose heart. Levels: equivalent fractions, adding unlike denominators, fractions of amounts. Boss: Storm Troll smashes deck sections every 6 s; repair each with an equivalent fraction; three smashed = lose. Keep: to-scale planks, spring-sag physics, generators.
2. Bond Igloos -> "Fish Catch": Pip holds a bucket with a target (10, later 20); numbered fish fall; slide to catch the right one; wrong fish = lose heart; missed right fish gone, no penalty for missing wrong ones. Everything spoken; digits AND dots on fish. Levels: bonds to 5, 10, 20, multiples of 10 to 100. Boss: Gale the Owl carries a number; catch the partner and it auto-throws at him; five hits.
3. Sound Snowdrift -> "Sled Run": Pip sleds downhill; a phoneme is spoken; three gates show graphemes; steer through the match; later a picture and gates spelling its sounds in order. Phases follow Letters and Sounds. Boss: Alien Zorp fires real and nonsense words; swipe real left, alien right; HP bar. Keep phoneme audio, en-GB speech, word lists.
4. Word Class Sprint -> "Grammar Runner": three-lane endless runner; HUD shows target class; word gates rush at you; switch lanes to run through the target-class word; target changes every 10 s with announcement; wrong gate = crash, lose heart. Levels: noun/verb/adjective; adverb/pronoun; preposition/conjunction/determiner; subordinate clauses, tenses, fronted adverbials. Boss: Tob throws sentences; tap the called class word within 3 s to reflect; combos double damage. Add a live score (paintScore was empty).
5. Balance the Berg -> "Sinking Berg": iceberg with the equation slowly tips and sinks; four inverse-operation tiles float; tap the correct next move (applies to both sides automatically, big balance animation, berg rises); wrong = lurches down; reaching the water = lose heart. Levels: one-step, two-step, unknowns both sides, brackets, inequalities. Boss: Wally drops weights every 5 s; counter with the right operation on the other side.
6. Iceberg Detective -> "Line-Up": worked solution scrolls up line by line; tap the line with the error before it leaves the top; then pick the fix from 3 within 5 s; correct = arrest animation + combo; wrong tap or missed error = lose heart; scroll speed ramps. Boss: The Forger, two hidden errors at speed. Keep 40+ authored cases, generators, misconception taxonomy.
7. Deep Freeze -> real TIMES TABLES "Ice Blaster" (Space Invaders): ice blocks with answers descend in rows; question at bottom ("7 x 8"); move the penguin cannon and fire at the right block; blocks reaching the bottom cost a heart. Modes: single table, mixed, division facts, 60-second blitz, MTC practice (25 questions, 6 s each, Year 4 check). Boss: Frost Giant weak points show sums, hit in order. (Keep its science content as a separate future game.)
8. Verb Tides -> "Port Defence": pronoun boats (je, tu, il/elle...; yo, tu, el...) sail toward the dock with an infinitive on the sail; fire the correct conjugated shell from 3-4 before docking; docked boat = lose a hull plank. Correct forms spoken (fr-FR / es-ES). Levels: regular verbs, -ir/-re/-er, irregulars (etre, avoir, aller, ser, estar, tener), past tense. Boss: Pirate Queen fires gap sentences under rapid fire.
9. Timeline Tumble -> "River Rush": event cards float down a fast river; era docks line the bank; drag/flick each card to its dock before it drifts off; missed = lose heart; perfect chains combo. Variants: before-or-after rapid swipes, cause-and-consequence pairs. Boss: Mo the Mammoth charges down the timeline; each correct placement knocks him back; reaching camp = lose. Keep event banks and dates.
10. Circuit Rescue -> "Blackout": space-station rooms go dark one by one on a timer; fix each broken circuit (place component, close switch, swap part, series/parallel) and the room lights; darkness meter filling = game over; faster fixes buy time. Current shown as a travelling spark. Failed power-ons COUNT as misses (fails was never incremented). Boss: The Overload: short circuits spread; isolate with switches. Keep the linear circuit solver.
11. Lantern Cove -> "Storm Night": keep the city but make it matter: buildings produce resources over time and have needs; adjacency bonuses; every few minutes a storm: waves roll in and each correct answer in a rapid-fire burst (10 questions, 5 s each) raises a sea wall section; missed sections flood buildings to repair. Questions from the chosen subject; expand banks to 100+ per subject with generators. Fix: True/False must update mastery. Keep grid, BFS residents, day/night, postcards.
12. Detective Agency -> keep story, add action: each case is an INTERROGATION: the suspect's worked solution types out line by line at speed; hit OBJECTION on the faulty line before it passes, then drag in the fix under a 10 s clock; credibility meter drains on wrong objections; empty = case goes cold. Between chapters: chase set-pieces (rooftop, canal) with quick-fire mini-errors. Music on by default; remove the forced 900 ms input lock after a slip; allow replaying cases for a better score (remove the per-case RP cap). Keep cases, tags, ranks, story choices.
Penguin Slide (reference): rebuild on the shared engine FIRST with lives, combo, power-ups, boss and juice; must feel great before moving on. (The in-app Penguin Slide at /dev/games/penguin-slide is a separate journey build being finished by another agent; the artifact prototype at https://claude.ai/artifact/2NuCQAbUwta4BhgPrfZLiy is the one to upgrade here.)

## Known bugs in older builds (do not carry over; verify whether still present)
- Replay stacks a second rAF loop (speeds up each replay); endRun never stops the loop.
- Boss HP decorative; boss dies when the queue ends regardless of HP.
- `if(!run.boss||true)` dead code; `const dead=false`; `E.dead=()=>false`; after the first wrong guess further guesses are free.
- A mis-aimed flick scored as a knowledge error (motor error vs knowledge error).
- `paintScore(){}` empty (no live score); `streakN` computed and unused; `pipsLeft` can go negative; crates stop under keyboard input; `fails` never incremented; `J.shake(0)` does nothing.
- Rush brief says "no timer" when a clock is on. True/False never updates mastery.

## Definition of done (per game, phone 375x812 and desktop 1280x800)
- Within 5 s of PLAY I'm moving something under pressure. Doing nothing makes me lose. Speed visibly ramps within one level.
- Combo, live score, hearts visible and working. Correct never stops the action; misses show the answer in <1.5 s without a modal.
- End screen: score count-up, stars, new best, coins, missed-item review with explanations, PLAY AGAIN.
- Boss has real HP, attacks, changes at 50%, can beat me.
- Replay 5 times: speed unchanged (no loop stacking).
- Touch, keyboard, mouse; no horizontal scroll on phone. Calm works and is OFF by default in Arcade. KS1 games speak every instruction. Storage blocked: still runs. No console errors.
- Content age-correct per UK National Curriculum; distractors are real misconceptions.
- Honest test: would a 9-year-old choose this over YouTube for 10 minutes? If not, add juice, pressure or reward.

## Order
Shared engine + Penguin Slide -> Deep Freeze (times tables) -> Bond Igloos -> Word Class Sprint -> Sound Snowdrift -> the rest. After each game report: what changed, the core loop in one sentence, a screenshot, content gaps found. Each game is then independently critiqued (play it as a bored 9-year-old; fix; republish to the same URL).
