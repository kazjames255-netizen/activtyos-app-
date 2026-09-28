# Critic: Sled Run (Arcade mode for Sound Snowdrift)

Artifact (updated in place): https://claude.ai/artifact/1cTgMXbso1noB1uSoMiDnZ
Built on the shared arcade engine (engine v1.1). Source and tests: scratchpad `arc2/` (`ss.game.js`, `ss.speech.js`, `common.js`, data from `ss/data.js`, `mk.cjs ss`).

## What it is now
PLAY launches ARCADE. Pip sleds downhill on his own; you steer between three lanes. A sound is spoken (the formant phoneme synthesiser from Sound Snowdrift) and three ice blocks show graphemes; steer into the match. Later a picture appears with a frame of boxes and the gates spell its sounds in order; in World 4 the gates offer alternative spellings (ai / ay / a-e) and the picture decides. Everything is spoken: an en-GB speechSynthesis voice reads the instructions, words, level and boss announcements, title and Game Over screens; a "Hear it" button on the title screen and the speaker button in play repeat the sound or word; after a miss the correct spelling is spoken. Read-aloud is ON by default for this game.
Alien Zorp (each world) fires real and alien (nonsense) words in phonics-screening-check style: swipe or tap left for REAL, right for ALIEN, or press the arrow keys. He has an HP bar, changes at 50% (faster, message "ZORP SPEEDS UP!"), and hits you if you do not decide in time (3.1 s, then 2.4 s).
Same arcade layer as Grammar Runner: 3 hearts, combo x2 to x5, live score, power-ups, coins and unlockables, daily seed, endless, Calm as an option (off by default), missed-item review with explanations, PLAY AGAIN. Journey (the original Sound Snowdrift campaign) is the second button on the title screen.

Phonics phases (Letters and Sounds):
- World 1, Phase 2: s a t p i n m d, then g o c k, ck e u r, then h b f ff l ll ss; picture words are CVC only.
- World 2, Phase 3: j v w x y z qu; ch sh th ng; ai ee igh oa oo (long and short); ar or ur ow oi ear air ure er; picture words with digraphs.
- World 3, Phase 4: adjacent consonants (CCVC and CVCC picture words, plus digraph words).
- World 4, Phase 5: alternative spellings (ai ay a-e, ee ea, igh ie i-e y, oa ow o-e, oo ue ew u-e, ow ou, oi oy, air are ear, ur ir er, or aw au) in picture gap-fills, plus longer picture words.
Words are filtered by the phase of their graphemes, so a Phase 2 world never shows y, j, v, z or a digraph. Boss words follow the same phase filter (Phase 2 has its own alien list with only Phase 2 letters).

## Test evidence (Playwright, real input)
- Keyboard, touch (375x812) and mouse (1280x800): lane changes, pause freezes the clock, resume works. Boss by keyboard, by touch tap and by a touch swipe (17 of 17 correct).
- Replay x5 at 375x812 touch: 1 rAF loop, row speed / director speed = 108 px/s on all five runs; same with `localStorage` throwing. No console errors anywhere; no horizontal scroll.
- Perfect bot: World 1 fully cleared (4 levels and boss) in about 200 s; boss 53 s. Daily, Endless and Calm ran without errors; Calm keeps lives at 3.
- Journey enters, renders, returns and re-enters; Arcade starts afterwards.
- Generator dump checked by eye for all four worlds (frames, distractors and explanations).

## Critique pass 1 (as a bored 5 to 7 year old, and as their teacher) and fixes
1. World 1 level 1 had only six letters and a no-repeat-in-5 rule, so the order became a fixed cycle (t i n s p a, t i n s p a). Now uses Letters and Sounds sets 1 and 2 (eight letters) and a no-repeat-in-3 rule.
2. Phase 2 questions used distractors from Phase 3 (y, z, v, oa). Distractors are now taken only from graphemes taught so far.
3. The Phase 2 boss fired alien words such as "yib", "zam", "vop" (Phase 3 letters). Added Phase 2 alien words and filtered by phase.
4. The picture panel covered the speaker and pause buttons; narrowed.
5. The boss REAL and ALIEN buttons sat under the miss banner; moved to the top under Zorp.
6. Sound labels used /ay/ for the ai sound, which reads as a different grapheme; now /ai/, /oa/, /long oo/, /short oo/.
7. A distractor explanation repeated the split-digraph sentence twice; fixed.
8. Alternative-spelling gap-fills hid the later letters; all other letters are now shown so the child only decides the gap.
9. A 4 to 7 year old should not read "ENRAGED!"; the phase change now says "ZORP SPEEDS UP!".
10. After a miss nothing was said; the correct spelling or word is now spoken, and the next item waits so the two voices do not cut each other off.
11. The tutorial waited for the end of a spoken sentence that never ends when no voice exists; added a timer fallback so the first sound always plays.
12. In Calm the boss timer still expired; removed. Director speed cap lowered to x1.1 (top speed about 155 px/s).

## Critique pass 2 (final state) and what is still weak
- Phoneme audio is a formant synthesiser, not recordings. It was not heard by a human in this run and may sound robotic; some phonemes (for example /x/ as k+s, /qu/ as k+w) are approximations.
- en-GB voices are not on every device; the code falls back to any English voice, then to silence. Real and alien words are both read by text-to-speech, and it can make nonsense words sound like real ones.
- The boss words are spoken and shown, so it tests listening and decoding together. It is not the same as a child reading the word aloud, which is what the real check does.
- Phase 4 has no new graphemes, so World 3 is picture spelling only; there is no blending or reading task outside the boss.
- Picture gates rely on emoji, which differ by device (a ship, a paintbrush, a wave for sea). Some pictures are ambiguous to a 5 year old (sea vs see).
- Split digraph gap-fills show two linked gaps; a 5 year old may not understand the linked boxes without help.
- Stage is 343x610 on a 375x812 phone with empty space below (engine design). Blocks are 50 px tall text at most, which is fine, but gates are close together on a small phone.
- Not tested on a real phone or a screen reader; not tested in Safari or Firefox. Read-aloud on iOS requires a tap before speech starts (the title "Hear it" button covers this).

## Verdict
The core loop is a real-time steering game with sound first, no reading required for the letter gates, and correct Letters and Sounds sequencing. Whether the synthesised phonemes are clear enough for a 5 year old is the largest unknown and needs one human listening session before this goes to a class.
