# T1 journal, after (round 2 review): T1 tutor, Tuesday 6:55pm (mark, set homework)

Checked against code on branch teaching-hub-redesign and screenshots/after/. No browser run by the reviewer.

## Improved
- Nudge now opens the homework form with the student ticked (TutorHome/ClassSnapshot, P-06): T1-05 fixed, 4 taps -> 1. Overdue row opens 'Not handed in' (T1-03): 2 taps -> 1.
- Curriculum grid closed, one summary line first on Lessons (screenshots/after/tutor/lessons-390.png) (T1-25). Tools shows ready only (T1-30).
- Hero: Worksheets tile deleted, 4 tiles -> 3; still about 45 words and 3 tiles before 'Next lesson' at 390 (tutor/home-390.png). Partly (T1-09). P-02 said collapsed by default; HubHero.tsx:65 is useState(true), so it is NOT collapsed.

## Still broken
- Marking untouched: three queues, one-at-a-time, no batch (T1-01/02/04). Still about 28 clicks to clear 9+7 items.
- Quiz builder (T1-18..21), flashcards (T1-22), topic select 2,457 (T1-24), Messages accordions (T1-27/28) not touched. Start lesson still only switches tab (T1-10).
- Lessons search still title only (T1-12); the new Year/Subject filter exists only in the homework lesson picker.

## New problems introduced
- H-01 removed the reader's one-click 'Set this lesson' shortcut and the list icon: +1 tap for a tutor who used it (logged in H-01.md). Not caught as a regression by the builders, but a small loss for the busiest verb.
- Home Nudge with a view-only role opens progress: fine.
