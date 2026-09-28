# Product critic: Teaching Hub / Learning Hub, first-time-user walk

Method: real Chromium via `scripts/e2e-locked.sh`, three fresh throwaway `@activityos-test.com` accounts (freelancer tutor with the hub OFF, parent with Year 2 "Mia" and Year 8 "Theo"). Viewports 1440, 768, 390. Screenshots in `docs/reviews/shots/product/` (159 files). Text dumps were kept outside the repo.

Caveats, stated up front:
- This is the dev server. Several "Loading..." and "Compiling" delays are dev compilation, so I only call out delays that are structural (the splash) or that recur across screens.
- The lock queue cost about 4 hours of waiting. The kid quiz-taking loop (answer, feedback, results), tool-added-to-question state, and the parent verdict/report were NOT completed in a run. My selectors missed the kid "Go"/"Start" buttons. I do not claim to have judged those. Parent progress and report screens were captured only behind the splash and are not judged either.
- Mark dialog: I entered feedback but no score. "Save mark" stayed disabled, so marking was never completed.
- Seeded lesson content came from the e2e fixture, not a real import.

## Friction list

### CRITICAL

**C1. "Oak National Academy licensed under Open Government Licence (OGL)" renders on the tutor lesson reader.**
- Where: Lessons, open a lesson, last line of the reader (`r4-l02-lesson-reader-full.png`, `l04-lesson-open.png`, `l09-back-in-reader.png`). Also on 390 and 768 (`r4m390-lesson-reader.png`).
- Cause: the body of a plain lesson note is shown verbatim. The render-time scrub in `server/src/routes/learningHub.ts` (`isOakAttributionText`) only covers slide blocks.
- Caveat: the string came from the e2e fixture (`e2e/helpers/lessonFixture.ts:167`), which writes the credit into the note body. Real imports go through `scrubText`, and `noOakSelftest` asserts that. So this is real for any note that already contains the credit, and not proof that production imports leak.
- Fix: scrub attribution at read time for note bodies too. Also stop the fixture writing it, so the live no-oak spec means something.
- No other hit anywhere: the tutor, parent, kid and how-it-works dumps were otherwise clean.

**C2. Splash on every entry to the hub: about 4.8 s, on every hard load and deep link, for tutors, parents and kids.**
- Measured splash time: 4.82 to 5.04 s across about 20 loads.
- Screens: `l01-hub-home-with-content.png`, `pp1440-02-hub-home-y2.png`, `tm390-lessons.png`.
- It says "Tap anywhere to continue" but auto-plays 3.4 s plus 1.5 s dissolve.
- It covers the real page, including deep links like "Open Learning Hub" and homework links from notifications.
- A parent sees copy aimed at tutors: "to support teaching and learning".
- It also introduces a third product name (see H2).
- Fix: show it once per account or per first visit. Never on deep links or in kid mode.

### HIGH

**H1. KS1 "Play & learn" is a wall of locked quizzes with clipped text at 390.**
- Screen: `k2-03-play.png`.
- 39 cards headed "Finish a lesson to unlock", each with a full-width "Start the lesson first" button.
- Card text and buttons run off the right edge.
- Tapping the first one gave a red **"Lesson not found"** (`k2-05-started.png`). That is a dead end for a 6-year-old.
- The header "Mia's le..." is truncated.
- Today's homework, the thing they need, is on the Today tab and is clear (`k2-02-kid-home.png`).
- Fix: hide locked items from KS1 or collapse them. Never link to a missing lesson. Fix the card width.

**H2. Three names for one product.**
- Tutor sidebar and hero: "Teaching Hub".
- Splash: "Teaching and Learning Hub".
- Parent sidebar and invite: "Learning Hub".
- Tutor-side copy also says "Learning Hub": "Families only see Learning Hub once you've enrolled..." (`t10-top-students.png`).
- Tutor-side copy says "ActivityOS parent account" (`t23-invite-created.png`) while the chrome says "Activly".
- "My Classroom" leftover in user-visible copy: `lib/i18n/messages/areas/hubshell-parts/kit.ts:73` ("...and in My Classroom for your families").
- The how-it-works page is the only consistent surface ("Teaching Hub" / "Learning Hub for parents").

**H3. Tool adding is confusing and split across three places.**
- The Tools tab is explicitly a dead-end "viewing area" (`t11-lessons-tools.png`). It says to add a tool from a lesson "using Add tool in the Tools card".
- The real path is: Lessons, open a lesson, Preview lesson, Start, floating "Tools for this lesson", then "Add tool to this question".
- The panel is titled "Tools for this lesson" but its only button says "Add tool to this question".
- It also says "No tool on this question... it would give the answer away" while the tutor is on a teaching slide, not a question (`l06b-tools-for-lesson-opened.png`).
- I could not find a way to add a tool to the lesson itself (as opposed to a question). Two "add" paths exist, so I don't know which is the lesson-level one.
- The picker itself is good once you pick Maths (`r4-t01-picker-maths.png`). Before that it shows only search and category chips, and no tools (`l07-tool-picker.png`).
- Clicks from cold: about 8 (lesson, Preview, Start, Tools, Add tool, category, tool, confirm).

**H4. Enrolment is heavy and lists the wrong people.**
- The "family already booked" route lists both children of a booked family, including Theo, who never booked (`t20-enrol-dialog.png`).
- Clicking a row opens a second full form: 7 subject chips, year group, 4 support toggles, "Extra time", "Text size" (`t21-after-enrol-click.png`). About 3 decisions before "Enrol student".
- The invite route is better: one field, one button, a copy link, and status "waiting for them to open it" (`t23-invite-created.png`).
- Invite claim for the parent is very clear (`p02-invite-claim.png`) and the Learning Hub appeared in their sidebar within about 3 s of Enrol.
- But it sits inside the collapsed "My children" group (`p03-after-enrol-y8.png`), so it is easy to miss.

**H5. A tutor's first dashboard is a camps dashboard.**
- The hub is switched on from a card that only appears after the dashboard finishes loading (`t02-dash-hub-off.png` is a bare "Loading..."). The link appeared about 4.4 s after the click.
- The dashboard is "On site today", "Live listings", "Spaces left", "Registers" (`t03-after-turn-on.png`).
- Nothing says "you are a tutor, start here".

**H6. Homework sub-tabs show the wrong empty state.**
- With 0 students, Homework opens on Inbox. Inbox and Results both show "Set your first homework. Enrol a student first" (`t10-top-homework.png`, `t11-homework-results.png`).
- Home and Set-homework empty states do give guidance. Inbox and Results do not describe themselves.

### MEDIUM

- **M1. The lesson reader offers Print, Open, Set for children, Edit, Delete and a separate "Preview lesson".** "Open" versus "Preview" is unexplained. I could not click "Open" in a test (it timed out), so I do not know what it does.
- **M2. Mark dialog: "Save mark" is disabled with no hint that a score is required** (`r4-h03-mark-dialog.png`). Otherwise the dialog is good: canned feedback chips and "The family is notified when you save".
- **M3. Three dialog styles.**
  - Enrol is cream (`t20-enrol-dialog.png`).
  - Set homework and Mark are white and grey (`t11-homework-set.png`, `r4-h03-mark-dialog.png`).
  - Teach-in-person is a full-page white card that hides the sidebar.
  - The tool picker is a big white modal.
  - The parent invite is a white card.
  - The hub shell is blue throughout.
- **M4. The Set homework dialog does not show who it is for above the fold.** "Assign homework" is disabled and the student picker is off-screen (`t11-homework-set.png`). The tutor must guess to scroll.
- **M5. Curriculum jargon on the Lessons landing page.**
  - "Where our lessons fit the curriculum. 208 of 277 curriculum areas covered - thin: 26 - gaps: 43" (`t10-top-lessons.png`).
  - Search for a lesson while "Maths" is selected returns Science areas (`l03-lessons-search.png`).
  - A tutor's own lesson is found only via an area card, not a plain result row.
  - Hub header: "0 students - 7470 lessons - 6 subjects". Fine, but the unexplained "Show" button next to Settings is not.
- **M4b. Default subject chips include French, German and Spanish for a maths/science tutor** (Edit lesson topic, homework filters). They are not the tutor's own.
- **M5b. Progress empty state** offers "Recalculate" and "Edit levels" with no student to apply them to (`t10-top-progress.png`). Copy is fine.
- **M6. Teach-in-person page is clipped on the right.** Search bar and year chips are cut at "Y11 / All le..." at 1440 (`t11-quizzes-teach.png`, `r4-ip01-teach.png`). Setup says "No students enrolled yet".
- **M7. Teen kid mode is mostly empty whitespace at 1440.** The heading "Theo" sits at x=290 and cards at x=100, so they are misaligned. Home shows one auto-assigned "English placement - Year 8" quiz and no sense of "today" (`k8-02-kid-home.png`). Homework tab is good (`k8-04-after-start.png`, three counters).
- **M8. Full stamped names in the kid UI** ("Homework for Theo pcmuixx9rv"). Test artefact, but worth checking that real surnames are not shown to children.
- **M9. Parent landing is "Browse activities"** with a highlighted "Memberships" chip (`p01-parent-landing.png`). The hub is not in the top bar, only in the sidebar.

### LOW

- L1. Lessons "Schedule video lesson" and "Live lessons" sub-tabs and the "Teach in person" button duplicate one another. Three routes to the same screen.
- L2. Sub-tab card labels truncate ("Notes, worksh...", "Hand-ins and writt...").
- L3. Two exits in lesson preview: X and "Back".
- L4. 404 page is dark while the app is light. I probed `/how-it-works/kids`, which is not a real route (the page's chip is "For children"); the 404 is correct behaviour.
- L5. Read-aloud on the KS1 home works as a toggle (speaker to stop icon, `r4k2-04-read-aloud-pressed.png`). No speaker on the teen home (expected).
- L6. Small tap targets: the count of buttons or inputs under 40 px is 7 to 9 at 390 on parent/kid screens, up to 35 on the tutor lessons page.

## Timings (dev server, indicative only)

| Screen | Observation |
| --- | --- |
| Hub entry, any role | 4.8 to 5.0 s splash, then 3 to 15 s to first content in dev |
| Tutor Lessons > Tools | about 22 s in the first cold run (dev compile) |
| Parent landing (first) | 37 s "Loading activities..." (dev compile) |
| Invite link to claim screen | 17 s cold |
| Skeletons > 2 s | none observed persisting; the delays were "Loading...", "Checking access..." text screens (see `t11-lessons-schedule.png`, `t02-dash-hub-off.png`) |

## Scores per journey

| Journey | Time to first success | Clicks / decisions | Doubts | Dead ends |
| --- | --- | --- | --- | --- |
| Tutor: hub on to first enrolled family | about 1 min (invite) | 6 (invite) or 8 (booked route) | "which route?", "what are support settings?" | Inbox and Results empty states |
| Tutor: lesson to preview | about 30 s | 5 | Open versus Preview | none |
| Tutor: add tool | not reached first time | about 8 | lesson versus question | Tools tab says "viewing area" |
| Tutor: homework and mark | about 45 s to the mark dialog | 4 | score required | none |
| Parent: invite | about 20 s | 2 (Enrol, Open) | none | none |
| Parent: sees hub | instant | sidebar group collapsed | where is it | none |
| Kid KS1 | homework found in 0 clicks | 1 | none | Play & learn to "Lesson not found" |
| Kid teen | placement quiz visible on home | 1 | why English? | none seen |

## Ten changes that would most improve first-week retention

1. Show the splash once per account, never on deep links or in kid mode, and use parent/kid copy for those roles (C2).
2. Scrub attribution from note bodies at read time and remove it from the fixture (C1).
3. Pick one name per audience (tutor and parent) and purge "Teaching and Learning Hub", "My Classroom" and "ActivityOS" from copy (H2).
4. Give a new tutor a hub-first landing after turning the hub on (deep link to Teaching Hub, not the camps dashboard), and surface the enable card without waiting for the dashboard (H5).
5. Enrol dialog: enrol in one click with sensible defaults (all subjects, automatic year) and tuck "Support" behind a link. Only list children who actually booked (H4).
6. Make "Add tool" one obvious button on the lesson reader that says whether it is lesson-wide or per-question, and make the Tools tab link straight to it (H3).
7. KS1 Play & learn: hide locked items, fix the clipped card width, and never link to a missing lesson (H1).
8. Explain the disabled "Save mark" and show the student picker first in Set homework (M2, M4).
9. Fix Inbox and Results empty states so each describes its own page (H6).
10. Unify dialogs to one surface and fix the teach-in-person clipping at desktop width (M3, M6).

## What a tutor sees in minute 1

0:00 Signs in and lands on Bookings: a booking table for camps. Nothing mentions tutoring.
0:10 The sidebar has Dashboard and Blocks & listings, and five collapsed groups. No Teaching Hub yet.
0:15 The dashboard shows "Loading...". About a second or two later it fills with "On site today", "Spaces left" and "Live listings". The one relevant card, "Turn on the Teaching Hub", is below or beside it and only appears after load.
0:25 The tutor clicks Turn on. About 4 s later "Teaching Hub" appears in the sidebar with no explanation of what changed.
0:30 Clicks Teaching Hub and gets a full-screen "Welcome to the Teaching and Learning Hub" splash for about 5 s. A different name, and a promise about "resources across all subjects" that the next screen has to keep.
0:40 The hub Home: "Get started in three steps" (Add a student, Pick a lesson, Set homework) and "Nothing on the calendar yet". This is the strongest screen: three clear cards. It is also the only place that gives the tutor a sequence.
0:50 Tabs: Home, Lessons, Students, Progress, Quizzes, Homework, Messages, each with a sub-row of 2 to 6 items. About 20 destinations in total, several duplicated.
1:00 Clicks "Add a student", gets a cream dialog with a search box listing children with an "Enrol" button each, and below it "Invite a family who hasn't booked". If they know a family they choose invite; a first-time tutor with no bookings sees an empty list and must find that box unaided. "How does enrolling work?" is a link, and there is a how-it-works page (good, and findable from the hero button) but it is 8 videos deep.

Verdict: minute 1 has one good moment (three-step card) and three trust-eroding ones: a camp dashboard, a name change, and a 5 s splash. Nothing breaks, but nothing reassures a tutor that they are in the right product.

## Fix status (overnight pass, 27 Sep)

Legend: FIXED = changed and root/server `tsc --noEmit` clean; VERIFIED = also exercised in a headless run on a throwaway tenant; OPEN = not done.

| Finding | Status | What changed |
| --- | --- | --- |
| C1 Oak credit in note bodies | FIXED, selftest VERIFIED | `server/src/oak/noOakResponse.ts` is mounted on `/api/learning-hub` (index.ts): every JSON response (notes, list excerpts, lessons, homework, search, family and kid views) and every HTML response (digest preview, print views) is regex pre-checked and scrubbed with `scrubDeep` / `scrubHtml`. Digest emails (`renderDigest`, `renderNudge`) are scrubbed too. `npx tsx src/oak/noOakSelftest.ts` now greps a rendered note payload and HTML. The fixture no longer writes the credit (`e2e/helpers/lessonFixture.ts`). Read-only count of real data: 68 of 31,505 `hubNotes` bodies mention the brand (across ~40 tenants, mostly test tenants; nothing was written). They now render clean. |
| C2 Splash | FIXED | Tutors only, once per browser session (`sessionStorage`), 0.3 s min + 0.8 s hold + 0.5 s feathered dissolve (about 1.3 s), tap or key skips. Parents and kids never see it (its artwork carries tutor copy). OPEN: the artwork `public/images/hub-welcome.jpg` still bakes in the words "Teaching and Learning Hub"; it needs new artwork. |
| H1 KS1 Play and learn | FIXED | `server/src/routes/hub/assessments.ts`: a lesson-quiz whose lesson the family may not open (provider `lessonAccess`) is no longer offered, so no card links to "Lesson not found". Client: cards wrap text, capped at 3 (kid) / 12 with a "show more" count. |
| H2 Naming | FIXED (copy) | "My Classroom" removed from `hubshell-parts/kit.ts` in all 11 locales; "ActivityOS" removed from the invite copy (`students.ts`, 22 strings) and from the 403 message; `TeachingHubMark` and the splash aria say "Teaching Hub". Left as is: tutor-side "families only see Learning Hub" (that is the family name). |
| H3 Tools | FIXED | Lesson-level picker button now reads "Add tool to this lesson" (question-level keeps "to this question"); the lesson panel no longer says "No tool on this question"; the Tools tab note has a "Go to Lessons to add a tool" button. |
| H4 Enrolment | FIXED (partly) | `/api/children/lookup` returns `booked`; the dialog labels children added by the family ("Added by their family"). Support settings are tucked behind an optional disclosure; empty subjects still means all. OPEN: one-click enrol (it is still a second step). |
| H5 Tutor landing | FIXED | The enable-hub card renders while the dashboard is still loading, and turning it on goes straight to `/…/learninghub`. OPEN: a tutor-first dashboard. |
| H6 Inbox/Results empty | FIXED | Inbox and Results each describe themselves (11 locales). |
| M2 disabled Save mark | FIXED | Footer hint "Fill in a score to save the mark" (11 locales). |
| M5 curriculum jargon | FIXED (en) | "208 of 277 topics have lessons, only a few: 26, none yet: 43". The hub header "Show" button now says "Show the numbers". |
| M6 Teach-in-person clipping | NOT REPRODUCIBLE now | At 1440 and 390 the search box, groups and the year chips sit inside the card (`ip-1440.png`); the suggestion cards and topic chips are intended horizontal scrollers. Presumably fixed by the concurrent picker work; no change from this pass. |
| M3 dialog surfaces, M1 Open vs Preview, M4 Set-homework student picker, M4b default subject chips, L1-L3, L6 | OPEN | Not attempted; they are cross-cutting visual decisions. |
| M7/M8 kid names | CHECKED | Kid home and the kid bar already use the first name only; the full stamped names come from the tutor-typed homework title. |
| M9 parent landing | OPEN | The hub is in the sidebar only. |

## Journeys run (own throwaway tenant, headless Chromium)

Spec: `e2e/review/product-journeys.spec.ts` (own signed-in states under `e2e/review/.auth-pj`, `REVIEW_AUTH_DIR`), fixture `buildFixture(3, true, undefined, 1)` = a Year 1 (KS1) child, a Year 3 and a Year 5 child on one fresh `@activityos-test.com` tenant. It never touches the locked queue or a real tenant. Screenshots in `docs/reviews/shots/product-fix/`.

- KS1 kid, Play & learn at 390 px: no lesson-first cards, no horizontal overflow, no "Lesson not found". Quiz loop VERIFIED end to end (start, pick an answer per question, review, hand in, result banner, per-question review with "Correct", marks 3/3, Passed).
- Tutor: marking a hand-in VERIFIED. The mark dialog shows "Fill in a score to save the mark" and Save stays disabled until a score is typed; after saving, the to-mark count went 3 to 2 and the parent's homework view shows the item under MARKED with feedback.
- Tutor lesson-level tool add VERIFIED: on a teaching step the panel says "Add tool to this lesson" and "No tools on this lesson yet..."; adding "Angle facts board" flips the panel to "A child gets: Angle facts board" with the "use on ALL questions" option (`t6-tool-added.png` was taken before the picker-item selector fix; the final run logged the added state). The old per-question wording still shows on question steps.
- C1 VERIFIED at API level: a note whose stored body holds the credit line, plus a homework whose instructions hold it, produced no brand string in tutor GET /notes/:id, list (full and light, with search), tutor homework list, parent homework list or parent GET note (`C1 API LEAKS: []`); the readable lesson text is intact. The UI reader itself was not driven for this probe (a plain note is not found by the lesson search box).
- Parent VERIFIED: hub Home verdict "Benmuj4y799: 1 homework overdue" with a See it link, no splash, Progress page, and the printable report names only the chosen child and none of the siblings and contains no brand text.
- Teach-in-person setup screenshots at 1440 and 390 taken; see M6.
- Cannot be shown by this run: a pre-fix repro of the KS1 "Lesson not found" (the fixture kid had finished the only quiz and has no locked lesson-quiz cards), so H1 is verified as "no dead cards now", not as a before/after.
- Splash VERIFIED in a screenshot mid-dissolve (feathered mask + penguin lift): tutors only, once per session. Parent and kid views load with no splash.

## Second overnight pass (27 Sep): the open items

Verified in own headless Chromium on throwaway `@activityos-test.com` accounts (no locked queue, no e2e:cleanup). Specs: `e2e/review/ks1-locked-lesson.spec.ts`, `oak-credit-reader.spec.ts`, `first-run-tutor.spec.ts`. Shots in `docs/reviews/shots/product-fix/`. Root and server `tsc --noEmit` clean.

| Item | Status | What changed / what was proven |
| --- | --- | --- |
| Splash artwork | FIXED, VERIFIED | `public/images/hub-welcome.jpg/.png` deleted. New text-free scene `public/images/hub-welcome-scene.svg` (navy, royal blue, violet, gold, floating subject tiles); the splash draws the penguin mascot plus live translated text ("Welcome to the" + `hm_hubName` = "Teaching Hub"). Feathered mask dissolve, sparkles, tap-to-skip and reduced-motion fade kept. `hm_splashAlt` (baked-in tutor copy) removed; `hm_splashAria` fixed in all 11 locales (the translations still said "Teaching and Learning Hub"). Screenshots `splash-new-1440.png`, `splash-new-390.png`. No other image under `public/` carries "Oak" or a product name (metadata grep; the how-it-works screenshots are captures of the app UI, checked at thumbnail level only, no OCR available). |
| KS1 "Lesson not found" | REPRODUCED, FIXED, VERIFIED | Fixture: Year 1 child, tenant default `lessonAccess: assigned`, a fresh published lesson with an exit quiz that the tutor has NOT set. (A) the family GETs that lesson: 404 `{"error":"Lesson not found"}`, the dead end the old card linked to. (B) `/assessments` for the child no longer offers the lesson's quiz, and the KS1 Play & learn tab shows no card for it. (C) after the tutor sets the lesson as homework the card appears and the lesson opens (`ks1-locked-lesson-opened.png`). The pre-fix client build cannot be run alongside the fix, so "before" is proven by the 404 the card used to hit. Side finding: a lesson filed under a subject the child is NOT enrolled in (for example a shared-library Maths topic when the child only has the tutor's own Maths) still 404s for the family even when assigned; that is subject scoping, not changed here. |
| Oak credit in the tutor reader | VERIFIED in the UI | An interactive lesson whose STORED body ends with the credit line (Firestore read on the throwaway tenant confirms it is stored) was opened through Lessons, the area tile and the row: the reader text, its HTML and the whole page contain no brand string (`c1-tutor-reader.png`). |
| Enrolment, one click for the link route | FIXED | Invite: Enter submits, the link is copied to the clipboard the moment it exists ("Link created and copied. Send it to the family."), so the route is name (optional) then one press. The pick-a-child route is unchanged (two steps); its form is optional-only already. |
| Tutor-first first-run dashboard | FIXED, VERIFIED | With no listings and no bookings the enable-hub card leads the dashboard ("Are you a tutor? Start here", `fr1-dashboard-hub-off.png`, above the camps hero); turning it on goes into the hub; back on the dashboard an "Open Teaching Hub" card replaces it (`fr2-dashboard-hub-on.png`). The button now says "Teaching Hub" (was "Learning Hub"). Not done: automatic redirect of a hub-only tutor to the hub on login; the card was judged safer than a redirect that fights the back button. |
| M3 dialog surfaces | FIXED | One sheet surface for every hub dialog (`.hub-sheet` is now the plain surface that Set homework, Mark and previews already used); the cream tint stays only on menus and popovers. Enrol, Set homework: `m3-enrol-dialog.png`, `m4-homework-form.png`. The teach-in-person overlay is intentionally a full-page mode. |
| M1 Open versus Preview | FIXED | "Open" is now "Teach this lesson" (all 11 locales) with a tooltip saying it starts the lesson with a student and that Preview lesson is the solo look. |
| M4 student picker | FIXED, VERIFIED | Set homework shows who it is for FIRST; the footer says why Assign is disabled ("Give the homework a title."). |
| M9 parent landing | FIXED, VERIFIED | An enrolled parent gets a Learning Hub tab in the top bar next to My bookings (`m9-parent-topbar.png`), not only inside the collapsed sidebar group. |
| L1 | FIXED | Teach in person button on Live lessons appears only when a group is in view (pre-filled), otherwise it duplicated the sub-tab. |
| L2 | FIXED | Sub-tab card descriptions wrap to two lines with a tooltip instead of truncating. |
| L3 | FIXED | The tutor's lesson preview has one exit (Back); the header X is hidden there (`hideLeave`). |
| L6 | FIXED (Lessons) | Curriculum framework, subject, year and topic chips and the "Search for one" link are 44 px tall below `lg` (were 36 and 16). Other tutor pages were not re-measured. |
| M4b default subject chips | NOT A UI DEFAULT | French, German and Spanish come from the shared library's own subjects, not a hard-coded list; nothing changed. |
| Kid result ring and reduced motion | CHECKED | `useCountUp` returns the final value immediately under `prefers-reduced-motion`. |
| Translations | DONE | New keys in all 11 locales: `hm_splashWelcome`, `hm_firstTitle`, `hm_firstBody`, `hm_readyTitle`, `hm_readyBody`, `hm_openHub`, `st_linkReady`, `npOpenTitle`; changed: `hm_splashAria`, `hm_turnOnHub`, `npOpen`. `hubfam.asShowMore` (the Play & learn "show more" line) already had all 11. |
| Oak purge (real data) | DRY RUN ONLY, awaiting Kaz | `server/src/oak/purgeOakNoteBodies.ts` (default dry run, read-only; a write needs BOTH `--apply` and `--approved-by-kaz`). Report: `docs/oak-purge-dry-run.md`. Finding on the way: the brand detector flagged a botanical sentence in three REAL science notes ("holly-or-oak question ... oak is wavy-lobed"), so it was stripping legitimate lesson text at read time and the purge would have deleted it from storage. `noOak.ts` now treats an "oak" next to tree vocabulary as the tree (selftest and cases pass); the report was regenerated after the fix. |

Remaining OPEN: one-click enrolment for the pick-a-child route; a redirect for a hub-only tutor after login; L6 on tutor pages other than Lessons; the purge write itself (needs Kaz).

## Superseded: open after the first pass (see the second pass above)

- Splash artwork (`public/images/hub-welcome.jpg`) still says "Teaching and Learning Hub" and "support teaching and learning"; it needs new art. It is tutor-only now.
- Enrolment is still two steps (pick the child, then the form); only the labelling and the support disclosure changed.
- Tutor-first first-run dashboard (the dashboard is still the camps dashboard until the hub is on).
- Cross-cutting visual items: M3 dialog surfaces, M1 Open vs Preview, M4 student picker above the fold, L1 duplicate routes to Teach in person, L2 truncated sub-tab labels, L6 tap targets.
- Kid result ring counts up (captured at 40 to 81 percent in a screenshot mid-animation before settling); worth a `prefers-reduced-motion` check.
