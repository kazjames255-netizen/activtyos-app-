# O Year-first curriculum map
**Before:** tutor view was a topic x Y1-Y11 grid; years a topic isn't part of (e.g. Algebra Y1-Y5) were blank squares that read as "no lesson".
**After** (`curriculum/CurriculumCard.tsx`, `cells.ts`): inside the same collapsible card (one-line all-years summary bar and remembered `open` pref unchanged):
- Year pills Y1-Y11 (tablist, scroll sideways with an edge fade, 44px). Default = most common year among active students (`GET /students`, yearGroup), else the year with most lessons; last pick remembered in `hub.curriculum.v2` (`year`, try/catch).
- Headline `N of M areas covered in <Subject> · Year X` + ring + covered/thin/gap legend, computed for the selected year only.
- List of ONLY areas the curriculum expects that year (`expectedInYear`), grouped by strand; row = name, lesson bar (green >=5 / amber 1-4 striped / red hatched 0), count, plus word and glyph (check / ! / x) so it is not colour-only. Tap opens the existing AreaDrawer (lessons, "Wrong place?").
- Lessons on topics not expected that year: one quiet "Also in this year: n extra lessons" line, never a gap. "Show only gaps & thin spots" and framework/subject switches kept. Subjects with no checklist (languages) list areas holding lessons, neutrally.
- Child mode (stars + grid) and ProgressPanel/CurriculumRings unchanged.
- New pure logic + selftest: `expectedInYear`, `extraInYear`, `yearSummary`, `parseYear`, `defaultYear`, `KEY_STAGES` (unused).
- Spec: `e2e/review/curriculum-year.spec.ts` (curriculum API mocked; screenshots in `screenshots/after/curriculum/`).
**Revert:** `git revert` the "hub: year-first curriculum map" commit.

## Student lens (tutor) and sticker book (child)
- **Student lens:** a row of student pills above the year pills ("Everyone" = the year-first view; each active student "Name · Y<n>"). Picking one jumps to that student's year and shows the areas expected that year as cards: Done (exit quiz handed in) / Assigned / Ready to set / No lesson yet, each with one action: Review, View, Set homework (existing homework flow via `setHubIntent` with `childIds`, `noteIds`, `packNoteId`), + New lesson (existing `startNew`). NotesPanel passes two optional props (`onSetHomework`, `onNewLesson`) to the card.
- **New server read (additive, tutor only, writes nothing):** `GET /api/learning-hub/curriculum/student?framework=&childId=&year=` in `server/src/routes/hub/curriculumApi.ts`. Checks the child is one of the caller's active students (`canSeeStudent`); returns per area: library / assigned / done counts and one lesson to open, review or set next. Needed because the tutor map has no per-child data.
- **Sticker book (child / parent-of-child view, replaces the grid):** the child's own year only (from the student's yearGroup; falls back to the subject's busiest year). KS1/KS2: a big tile (>=120px) per expected area, emoji per area (`curriculum/stickers.ts`, fallback star), dashed grey "Next up" until a lesson in that area is finished, then coloured "Got it!" (finished across the key-stage span); a stars row for the total; no percentages, "gap", "overdue". Tap opens the existing area drawer. Year 7+: plain checklist "My progress by topic", no emoji. No animation is used (so nothing to switch off for calm mode / reduced motion); the calm flag is exposed as `data-calm`.
- Specs: `e2e/review/curriculum-year.spec.ts` (lens test added), `e2e/review/curriculum-sticker.spec.ts`. Selftest extended (`studentState`, `stickerDone`, `stickerStars`, `emojiFor`).
- Revert: `git revert` the "hub: student lens + sticker book" commit.
