# Critic review: Verb Tides, Port Defence arcade mode

Artifact (updated in place, version 6): https://claude.ai/artifact/UBAF5UH4wEeLxuNQTdEoUK
Source: scratchpad `aa/vt/` (game.js, game.src.html, data.js from the Journey build, journey.js lazily booted). Engine: `aa/engine-vt.js` (Line-Up engine copy plus soft-miss / quiet resolve, plank icon, title extras, review "Hear it" buttons, movable banner).

## Core loop
Pronoun boats sail down to the dock. The flag shows the pronoun, the sail the infinitive. Fire one of 3 (4 from difficulty 2) shells with the conjugated form at the boat nearest the dock (tap another boat or use the arrow keys to aim at it). Correct = boom, combo. Wrong shell = splash, combo reset, that shell is spent, boat keeps coming, the slip is queued for retest. Docked boat = lose a hull plank (3 planks). Worlds: regular family 1, other regular families, irregulars (+ stem changers at difficulty 3+), past tense (preterite in Spanish, passé composé in French). Boss per world: the Pirate Queen fires gap sentences under rapid fire (HP 80/92/104/116, more cannonballs and faster at 50%). Correct forms are spoken with es-ES / fr-FR voices when the device has one (default on with sound; replay button and "Hear it" in the review).

## Method
Playwright with real touch (375x812), mouse and keyboard (1280x800): title with language switch, tutorial hold, wrong shell then correct via Enter, unattended dock, pause/resume, retarget with arrows, French run to the boss, Spanish boss with a 85% bot at human pace, Daily, Endless, Journey open/return (both languages of the Journey shell still work), replay x5 (one rAF loop, boat speed 33.8 px/s at speed 1 every run), storage blocked, console errors (0 after the fix below).

## Bug found and fixed during testing
Retried (missed) items returned by the spaced-repetition queue during a boss fight had no sentence and threw `split of undefined` every frame. Fixed: boss spawn converts any item into a sentence.

## What a bored 14-year-old would say, and what was done
1. Boss died in 10 s to a perfect bot (HP 50). Raised to 80-116; a human-paced 85% bot now needs about 50 s+, real players longer.
2. Tutorial banner sat on top of the boat. Moved down; hand points at the correct shell.
3. Mast line struck through the infinitive on the sail. Redrawn so the text is clear.
4. Flag ran off the right edge on the right lane. Lanes and spawn height adjusted; flags clear the pause button.
5. Nonsense decoys such as "êts" or "avoissons". Regularised decoys now only for verbs where the mistake is a real one (es -ar/-er irregulars, fr -er irregulars); wrong-person, wrong-family, wrong-auxiliary and infinitive-as-participle decoys stay.
6. Boss sentences did not say which verb the tray belonged to. Caption now shows the infinitive of the ringed sentence.
7. Boats felt slow on level 1. Base speed raised a little; belt ramps 25% inside each level on top of the director.

## Content check (dumped and read for both languages)
Regular families, irregulars (es ser, estar, tener, ir, hacer, decir, ver, dar and more; fr être, avoir, aller, faire and more), stem changers, past tense (es preterite for 11 regular and 8 irregular verbs; fr passé composé with avoir and être, irregular participles). 36-120 forms per world per language, each with real distractors and a one-line reason shown in the review.

## Remaining gaps (not fixed)
- Speech was verified only as code paths in headless Chromium (no voices there). Voice availability and quality on real devices unknown; if no voice exists the game is silent for words.
- Spanish nosotros preterite equals the present for -ar and -ir verbs, so that item is ambiguous by design; the present decoy is filtered out.
- French être verbs use the masculine participle (allé, allés); feminine agreement is not taught here.
- Past tense uses only 19 (es) and 17 (fr) verbs; no imperfect or future.
- A perfect player clears a world quickly because boats respawn as soon as the sea is empty; the challenge comes from speed ramp, 4 options and boss sentences.
- Journey mode is the unchanged 5-world drag-and-drop campaign, with its own save key and language switch (independent of the arcade language).
- No real-device touch latency or iOS audio checks.
