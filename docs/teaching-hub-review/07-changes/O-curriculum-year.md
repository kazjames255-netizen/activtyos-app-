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
