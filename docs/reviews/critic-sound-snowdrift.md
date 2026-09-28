# Critic and fix pass: Sound Snowdrift (Y1-2 phonics)

Artifact (same URL, now version 4): https://claude.ai/artifact/1cTgMXbso1noB1uSoMiDnZ
Source: scratchpad `ss/` (build.sh), test scripts in `ss/crit/`. Nothing committed.

Method: Playwright with real mouse drags, CDP touch drags, tap-to-carry and keyboard-only paths. All 25 stages played at 390 and 1280 (calm), no console errors. Wrong-answer flows for every round type re-run. Overflow checked at 360/390/430 on every view. Junior, Calm and reduced-motion checked. Audio rendered offline (no NaN, no silence). Phonics data audited item by item.

## Top flaws found, and status
1. Tricky words were a 4-option drag (recognition, not spelling). FIXED: now a spelling build, sentence prompt, sound boxes, heart on the tricky part, sound-it-out decoys (e.g. `e` for said), "right sound, wrong spelling" feedback. Silent e supported. Finale and Rush use it too.
2. First screen overflowed by 28px at 390 (header nowrap + star/cocoa pill; Adults settings select). FIXED; zero overflow at 360/390/430 on all views and rounds.
3. Sound count given away: Scale and Slow tools worked during the Pike's counting phase and in Cut. FIXED: disabled there; Lake stage 1 and Lake Dash now count-first on alternate rounds.
4. Sled was a pure validator. PARTLY FIXED: on a stall it now says what you built ("The sled read sop, not the word") and blends it aloud. Trial-and-error is still cheap.
5. Word never spoken unless the child found "Hear it"; with no real voice, speech silently did nothing. FIXED: word auto-spoken for build/cut/swap (setting to turn off); voice used only if one exists, else blended phonemes. Magic e round deliberately not auto-spoken (would give the answer).
6. Ambiguous pictures (song, wish, tray, farm, park, fern, burn, letter vs mail, zoo, doll, cub, mane, cane and others). FIXED by removing or replacing; magic pairs cut to 6 clean ones. Remaining: bug (caterpillar), cape (superhero), fair, sky.
7. Phonics data: climb had short i (now i>igh); hammer/ladder/flower er was labelled /ur/ (now schwa /u/); alien "spel" was a pseudohomophone (now skel); magic lesson text said "leaps over the a_e" for plan/plane; Sound Book ck page was empty (0/0). All FIXED.
8. Wide screen (1280): 640px column with empty sides. FIXED: 1120px layout, tools as side rail, larger tiles/boxes, 4-across sort bins, two-column map.
9. Junior differed only by font size. FIXED: bigger tiles, 2 read pictures, thin-ice is a hint not a penalty.
10. Phoneme audio far quieter than effects. FIXED: phoneme bus ×2.4 (peak 0.21, no clipping).

## Still open (honest)
- Sorting is still drag-a-word-to-a-bin (improved: word spoken on pick-up, vowel grapheme underlined after placement). Not a generative task.
- Sled still lets a child guess in three tries; help tile appears on second stall.
- Synthesised phonemes are approximations (no voiced/unvoiced th, schwa shown as short u); cannot be judged by ear here. u_e in cube/cute is /yoo/ but taught as oo. "bath" short-a is regional.
- Non-calm full run at 390 was started but not finished; calm runs all clean. Real device touch feel untested (CDP touch only).

## Re-critique (after fixes)
Full 25-stage pass at 390 clean; tricky, count-first, stall-read, Junior, keyboard/touch flows verified. Remaining weakest points: sorting and guessability above.
