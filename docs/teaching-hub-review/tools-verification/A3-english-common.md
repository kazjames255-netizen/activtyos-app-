# A3 English and Common tools verification

## Status: PARTIAL. Browser verification was blocked.
The Teaching Hub never loaded in my tab. The API on :4000 returned 503 or left requests pending
(/api/events/ticket, /api/library, /api/me, /api/bookings), and the page showed "We can't reach
Teaching Hub". I tried Try again, the bookings-then-hub route, and a fresh tab group over about 10 minutes.
Unauthenticated curl to the API was instant, so the authenticated endpoints looked saturated
(many parallel agents). No tool was opened in a browser. No screenshots were taken.
Everything below comes from code and content review plus the selftests.

## Fixes made
- common/packs.ts: sci "Square or cube numbers" had 64 as a cube, but 64 is also a square (8 x 8). Replaced with 216.
- common/packs.ts: mat-bidmas listed Division before Multiplication and Addition before Subtraction as separate steps, which implies a false order. Now 4 steps: Brackets, Indices (powers), Division and multiplication left to right, Addition and subtraction left to right.
- common/shared.tsx: drag handles used touch-action:none, so touching any card blocked page scrolling on phones. Now pan-y. Touch users tap-then-tap-category or use the Move to menu; mouse drag is unchanged. Touch drag is effectively lost.
- english/FrameWriter.tsx, TimedWriting.tsx, readingOptions.tsx: 40px controls raised to 44px (chips, summaries, A/A+/A++ buttons).
- english/TimedWriting.tsx: the timer defaulted ON when no keyStage was passed. Now off unless keyStage >= 3 is passed (opt-in).

## Content reviewed (about 60 sets)
I read all sort, sequence and Venn sets in packs.ts. Nothing else was factually wrong.
Judgement calls, left as they are: lentils as protein only; "Two equal angles" as isosceles-not-equilateral; Beaker pots as Bronze Age.

## Not fixed
- FrameWriter: changing the frame dropdown discards typed text without a warning.
- TimedWriting: the sessionStorage key is per tool, so a text left in the tab shows for the next pupil in the same session.
- Untested in a browser: the interaction and layout checks below.

## Verification run
- english.selftest: 564/564 passed. sorting.selftest: 103 checks, 0 failed.
- tsc filtered to tools/english and tools/common: no output.

## Verdicts (code-level only)
Ready pending browser re-check: N-06, N-07, N-08, E-04, E-05, X-15, E-06, S-15, X-05, X-07, S-16, H-H02.
The following need a browser pass:
- Tap-then-tap-category, drag and the Move to menu.
- Check, Hint, Reveal and Try another.
- 390px layout.
- Frame picker rendering (letter, speech, persuasive, newspaper).
- Timed writing: word count, Finish, sentence-check panel, text size and line spacing, reload autosave.
