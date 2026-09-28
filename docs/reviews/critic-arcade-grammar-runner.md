# Critic: Grammar Runner (Arcade mode for Word Class Sprint)

Artifact (updated in place): https://claude.ai/artifact/E3qHddMA2w7vDqAkTL51eV
Built on the shared arcade engine (engine v1.1). Source and tests: scratchpad `arc2/` (`gr.game.js`, `gr.data.js`, `common.js`, `mk.cjs gr`).

## What it is now
PLAY launches ARCADE. A three-lane runner: the HUD shows the target class (NOUN), word gates rush at you, you switch lanes to run through the gate holding a word of that class. The target changes every 10 s with a NEW TARGET banner; the next row shows a NEXT: VERB tag when it will differ. Wrong gate = crash, lose a heart (3 hearts), the right answer flashes in-world for 1.5 s. Combo x2 to x5, live score always top-left, power-ups (shield, slow-mo, reveal, double points), coins, unlockable skins and trails, daily challenge (fixed seed), endless (unlocks after boss 1, local top 5), Calm as an option (off by default, auto on for reduced motion), PLAY AGAIN as the biggest button.
Worlds: (1) noun/verb/adjective, (2) adverb/pronoun, (3) preposition/conjunction/determiner, (4) subordinate and main clauses, four tenses (past, present, future, present perfect), fronted adverbials. Four levels then Tob the Tricky Trader in each world. Tob throws a sentence; tap a word of the called class within 3.4 s (2.7 s after 50% HP) to reflect it; combo x3 or more doubles damage; a miss or a timeout costs a heart; at 50% HP he changes colour, the timer shortens and twin-word sentences (same word, two jobs) appear. Journey (the original campaign) is the second button on the title screen, started lazily inside the same page.
Kept: sentence bank with word-class tags, twin sentences, misconception explanations, adjective/adverb and adjective/abstract-noun twins as distractors.

## Test evidence (Playwright, real input)
- Keyboard (arrows/WASD/1-3/P/Esc), touch (375x812, tap left/right thirds), mouse (1280x800 click): lane changes, pause freezes the clock, resume works. Boss by mouse, by touch and by keyboard cursor (arrow keys and Space): 19/19 correct by keyboard.
- Replay x5 at 375x812 touch: 1 rAF loop each time, row speed / director speed = 150 px/s on all five runs. Also with `localStorage` throwing: same result, no errors.
- Console errors: none in any run. No horizontal scroll at 375 or 1280. Stage 343x610 at 375x812, 432x768 at 1280x800.
- Perfect bot: World 1 boss defeated in about 60 s. 85% bot: dies in about 77 s during level 3. Daily, Endless and Calm each ran with no errors; in Calm lives stay at 3 with 40% accuracy.
- Journey: enters, renders the map, returns to the title, re-enters, and Arcade still starts afterwards. Journey document listeners and timers are removed on exit.

## Critique pass 1 (as a bored 9-year-old) and fixes
1. The big NEW TARGET announcement (engine) landed on top of the gates, exactly when you need to read them, and wrapped to two lines for SUBORDINATE CLAUSE. Replaced with a canvas banner above the lanes; the gates stay clear.
2. Speed climbed to x1.58 (about 237 px/s) by 55 s, so a row of three phrases arrived every 1.3 s. Director speed cap lowered to x1.15 (total about x1.5).
3. The target chip drew over the Game Over card. Now hidden outside play.
4. Boss layout: Tob's face sat behind the target chip; the sentence panel title collided with the first line of words. Rebuilt the boss layout (chip hidden in boss, panel has its own title and timer bar, Tob lower).
5. A perfect run beat Tob in 50 s, below the 60 to 120 s brief. Boss HP raised to 72, 84, 96, 108 (about 60 s perfect, longer for a real child).
6. In Calm the boss sentence timer still expired. Calm now removes the timer.
7. The engine miss banner overflowed on long text ("subordinate clause: ..."). The banner text now auto-fits and takes a per-item sub-line.
8. You could not see that the next row would ask for a different class. Added the NEXT tag above such a row.
9. Retried (spaced repetition) items could carry an old target. Retries with a different target are pushed back and a fresh gate is made.

## Critique pass 2 (final state) and what is still weak
- Gate text is 29 px at most and shrinks (down to 13 to 17 px) for long words and clause phrases. That is below the 28 px target for phrases on a phone. Tier 4 gates are dense; a younger child will struggle.
- The stage is 9:16 and only 343x610 on a 375x812 phone, so a band of empty space remains under the game (engine design).
- Content pools are modest: about 70 nouns, 90 verbs, 60 adjectives, 50 adverbs, 34 prepositions, 24 pronouns, 14 determiners, 12 conjunctions; only 28 subordinate and 22 main clauses, 36 verbs for tenses and 22 fronted adverbials. Expect repeats after a few runs. Homograph words are removed by a hand-made list, so a rare ambiguous word may remain.
- The same boss character (Tob) appears in all four worlds; only the palette, HP, class set and sentence pool change.
- Sounds are synthesized and were not heard by a human. Music tempo rising with combo is in the engine but was not judged by ear.
- The boss timer is 3.4 s; sentences of 8 or 9 words are hard for a slower reader. There is no per-child timer setting apart from Calm.
- Journey lives in the same page. It was checked in Chromium only. Its styles switch on only while Journey is open.
- Not checked on a real phone (touch feel, safe areas), or in Safari and Firefox.

## Verdict
Fast, tense and replayable, with real fail states and a real boss. The learning is the same rigorous class tagging as before, delivered as pressure instead of a worksheet. Would a 9-year-old choose it over YouTube for 10 minutes? Probably for two or three runs; the reasons to return (daily seed, unlocks, personal best, endless) are in place but the content pool for tier 4 needs to grow.
