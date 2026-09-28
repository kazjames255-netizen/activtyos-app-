# Kids' UX review — navigation shell (28 Sep 2026)

Method: same screenshot method as `docs/kid-ux-review-learn.md` (`e2e/review/kid-ux-shots.spec.ts`, `KID_UX_TAG=nav-after` →
`scratch/kid-ux/nav-after/`, git-ignored), three age bands (KS1 Year 1, KS2 Year 4, teen Year 9) × phone/desktop.

## What I disliked → what changed

| Screen | Problem seen | Change |
|---|---|---|
| KS2/teen tab strip | A child (Year 3+) got the full **11-tab tutor-style strip** (Home, Live lessons, How I'm doing, Starting quiz, Quizzes, Homework, Lessons, Tools, Flashcards, Games, Messages) — scrolled sideways, clipped at both edges, showed a "Messages" tab and adult-only entries (Tools, Live lessons as a top tab) to a child | New `KID_TOPS` in `familyGroups.ts`: **five big tabs** — Home, Learn, Homework, Games, My progress — that can never overflow (same fixed-grid `FamilyTabBar` pattern the parent strip already used, `kid` prop makes the buttons bigger: 64px tall, 26px emoji). Live lessons, Quizzes, Flashcards and Starting quiz live as sub-tabs inside Learn. Tools and Messages are not in a child's strip at all (a grown-up handles those; still reachable by a direct `?tab=` link). |
| "Go back to parent portal" | Small plain-blue text link sitting flush above everything else — easy to miss, easy to tap by accident | A proper 48px bordered pill button (`KidBar`), tucked top-right so it's out of a child's main flow but a grown-up can spot it in a second (`family/KidMode.tsx`) |
| Progress (KS2) empty state | Two big empty-state blocks stacked before any content: "Your stars are on the way" (a full `EmptyState` card) then an empty orb below it | One compact, friendly line ("⭐ Your stars are on the way — Do a quiz and your first star will shine here.") instead of a second full-size card; the subject orbs below already show each subject waiting to start, so nothing is lost (`progress/KidStars.tsx`) |
| Sticker book | The star row showed twice: once in the Curriculum card's own header, once inside the sticker book underneath | Header star row is now hidden in child mode (`mode === "child"`) — the book's own row is the only one (`curriculum/CurriculumCard.tsx`) |
| Teen (Y7+) | Screenshots taken and reviewed; same nav rules already apply (five tabs, Learn sub-tabs). No separate teen-only nav needed — a Year 9 child on the new strip already reads cleanly at both widths | No change needed beyond the strip fix above |

## Confirmed by screenshot (after)
- `ks2-home-390`, `teen-home-1440`: five tabs, no scroll, no clipping, "Go back to parent portal" as a clear pill top-right.
- `ks1-home-390`: KS1's own three-icon strip (Today / Play & learn / Stars) is unchanged, "Go back" pill applied there too.
- `ks2-dashboard-390`: one compact "stars are on the way" prompt, not two empty blocks.
- `ks2-notes-1440` (Learn → Lessons): sticker book star row appears once, Learn's own sub-tabs (Lessons/Quizzes/Flashcards/Live lessons/Starting quiz) render correctly.

## How child mode is entered/exited now
The old "Hand over to…" strip is gone (owner decision, already in the code). Child mode is a `sessionStorage` flag
(`aos.hub.kid = {t: tenantId, c: childId}`, `family/KidMode.tsx`) set by `FamilyCtx.handOver()` from the child-switcher
pills on Home. There was no other in-app entry point to audit. Exiting is the tucked "Go back to parent portal" button,
which clears the flag (`writeKid(null)`).

## Files changed
- `features/learninghub/familyGroups.ts` — `KID_TOPS`, generalised `famTopOfKey`/`famSubFor` to take an explicit
  `tops` list (family strip stays the default, so nothing else calls this differently).
- `features/learninghub/LearningHubApp.tsx` — kid mode (Year 3+) now drives the family-style grouped nav off
  `KID_TOPS` instead of the flat `KID_TABS` strip; KS1 (`KidIconTabs`) is unchanged.
- `features/learninghub/family/FamilyTabBar.tsx` — takes an optional `tops`/`kid` prop (bigger targets in kid mode).
- `features/learninghub/family/KidMode.tsx` — `KidBar` is now a tucked, bordered 48px button.
- `features/learninghub/progress/KidStars.tsx` — the empty state is one compact prompt, not a full `EmptyState`.
- `features/learninghub/curriculum/CurriculumCard.tsx` — header star row hidden in child mode (sticker book keeps
  the only row).
- `lib/i18n/messages/areas/hubshell-parts/shell.ts` — two label keys the new tabs need (`lbl_my_progress`,
  `lbl_starting_quiz`), all 11 locales; everything else reuses existing labels (`Home`, `Learn`, `Homework`,
  `Games`, `Lessons`, `Quizzes`, `Flashcards`, `Live lessons`).
- `e2e/review/fixture.ts` — `handOver()` now sets the real `aos.hub.kid` sessionStorage flag and reloads (the old
  "Hand over" strip it used to click is gone); exported `lastFixtureTenant` as its default tenant.
- `e2e/learning-hub-g2-child-parent.spec.ts`, `e2e/review/age-bands.spec.ts` — updated to the same flag-based
  hand-over and the new five-tab adult-tab assertions (`Students|Messages|Tools` hidden, not `Progress|Live
  lessons|Students`).

## Not done / left for later
- I didn't re-verify every other spec that assumes the old flat `KID_TABS` strip or the exact tab count/order
  (e.g. anything asserting a specific `role=tab` position) — the e2e triage owns running the full suite.
- Teen screens were reviewed but not deeply critiqued beyond confirming the nav fix reads well; no teen-specific
  content changes made (out of scope: another fork owns Learn/Games/Flashcards content).
- No native-speaker review of the two new label translations (`lbl_my_progress`, `lbl_starting_quiz`) — same
  caveat as every other MT string added tonight.
