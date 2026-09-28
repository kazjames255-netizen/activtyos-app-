# Kids' UX review — Learn, Games, Flashcards, Progress (28 Sep 2026)

Method: screenshots of the child's own screens (child mode) at 390px and 1440px for three age bands — KS1 (Year 1), KS2 (Year 4), teen (Year 9) —
captured with `e2e/review/kid-ux-shots.spec.ts` (run it under `scripts/e2e-locked.sh` with the review config; `KID_UX_TAG=before|after`
writes `scratch/kid-ux/<tag>/`, git-ignored). Judged against: one obvious primary action; tap targets 48px+; words + icons; short text
(KS1 near wordless); at most 5 items visible in a group with Open/Close for more; where-am-I cue; no clipping.

## What I disliked → what changed
| Screen | Problem seen | Change (commit) |
|---|---|---|
| Games | An 18-card wall, each with a paragraph; no clear starting point | "Play next" card (a run left half-way, else Penguin Slide) + four big coloured topic tiles (Numbers, Words, World & science, Puzzles); a tile opens at most 5 games with "Show all N"; Reception–Y2 see names only. Big 52px Play buttons. (`f343708f`, later width fix) |
| Stars (KS1) | A typing box and subject chip on a screen for 5–7 year olds | No search box or subject chips for KS1; no typing box anywhere for KS1 (`d4fea951`) |
| Progress cards | Two-column tiles clipped their text at 390px ("Quizzes taken", "across 0 subjects") | One column below 440px (`4cab8866`) |
| Lessons (KS1/KS2) | GCSE (AQA) switch shown to primary children | Hidden for KS1/KS2 (`1c58901f`) |
| Flashcards | Grown-up "X is doing this" chip on the child's own screen; small Start button; paragraph + chips for 5–7 year olds | Chip hidden for children; big full-width Start (`7e6f20a1`); KS1 start screen is the big number, the deck and Start only (`07b24b08`) |

## Still open (not changed — outside this pass or needs a decision)
- The child's tab strip (KS2/teen) scrolls sideways and clips "Home"/"Messages" at the edges; a "Messages" tab shows for children. The navigation shell is a separate task.
- "Go back to parent portal" is small grey-blue text above everything; a bigger Back/Home affordance would help.
- KS2 Progress shows two empty-state blocks ("Your stars are on the way" plus a not-started orb) before any content.
- The sticker book shows the star row twice (card header and inside the book).
- Teen views were captured but not critiqued in depth.
- No native review of the Urdu / Punjabi / Bengali / Welsh text added here (`hubshell.games*`).
