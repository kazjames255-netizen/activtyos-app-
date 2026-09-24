# 14 - Round 2 review (adversarial, read-only)

Method: read 06/09/07/13, diffed `curriculum/map..teaching-hub-redesign`, read the changed code where a claim mattered, and looked at 8 screenshots (kid/home-390, tutor/home-390, parent/home-verdict-390, tutor/lessons-390 and others listed in each journal). I did not run a browser or the stack. Row verdicts for the 233 friction rows are by reading each row against the change notes; I spot-checked about 25 in code (file:line below). Rows not touched by any change note are "not addressed" without further checking. Treat counts as +/- 8.

## 1. Friction rows: 233 -> fixed / partly / not

| Persona (rows) | Fixed | Partly | Not |
|---|---|---|---|
| C1 (15) | 4 | 1 | 10 |
| C2 (10) | 4 | 4 | 2 |
| C3 (13) | 1 | 3 | 9 |
| C4 (12) | 3 | 3 | 6 |
| P1 (15) | 1 | 2 | 12 |
| P2 (16) | 0 | 3 | 13 |
| T1 (33) | 4 | 5 | 24 |
| T2 (15) | 1 | 2 | 12 |
| T3 (14) | 2 | 0 | 12 |
| T4 (10) | 2 | 2 | 6 |
| T5 (14) | 2 | 3 | 9 |
| X1 (20) | 5 | 4 | 11 |
| X2 (15) | 1 | 2 | 12 |
| X3 (31) | 6 | 9 | 16 |
| **Total 233** | **36 (15%)** | **43 (18%)** | **154 (66%)** |

By theme (which proposal moved it):
- Child Home / next step / dead buttons (C1-01/04, C2-01/02/03/10, C4-04/10, T4-07, X3-27, C3-09): mostly fixed. This is the redesign's real win.
- Kind wording and friendly errors (C1-05/07, C4-05/06, C2-05): fixed for network errors and quiz results; raw messages still pass through (kit.tsx `friendlyError`, P-05.md).
- One truth for homework, header numbers, forgotten broadcast, duplicate curriculum, safeguarding erase (X3-28, X3-06, X3-16/T3-01/T3-11, X3-20, X2-04/05): fixed.
- Accessibility (X1): 5 fixed, 4 partly; 11 untouched (board keyboard, timer, small text, form errors).
- Tutor workflow: marking, quiz builder, assign entry points, messages threads, student profile, enrol (T1 rows 01-02, 04, 06-24, 26-28; T3-02..09; T5-01, T5-06; X3-03/04/12/13): essentially untouched. This is the bulk of the 154.
- Accommodations, read-aloud, timers, teen mode (C1-02, C3-01, C4-01/02/03/12, T4-01/02/03/05): 0 of 12 addressed except kid-mode hiding streak. Roadmap R-5/R-6.
- Parent comms, notifications, i18n, jargon (P1-03..10, P2-01..04/06/13/15/16): 0 fixed.
- Owner oversight (T2-01/02/05/07/08/10, X2-01/03/07/08/09): 0 fixed, deliberate.

Honest read: 15% fixed is a strong result for a first pass concentrated on the child and header, but the tutor's evening job (mark, assign, build a quiz) is unchanged.

## 2. Regressions and new problems (severity)

1. MEDIUM - End lesson can silently not happen. `remotesync/TutorLiveBanner.tsx:26` clears the pending timer on unmount; the End call is only sent after the 6 s Undo (`:30-33`). The banner is mounted separately on Home and Lessons, so a tab switch inside 6 s cancels the End, the strip vanishes from view, and the broadcast keeps running (child join banner stays up until the 90 min expiry). Defeats P-01's purpose in the exact case (tutor rushes on). Fix: send `/end` immediately and make Undo a re-open, or flush on unmount.
2. MEDIUM - P-02 "collapsed by default" was not delivered. `HubHero.tsx:65` `useState(true)`; tutor/home-390.png shows 3 tiles + lede before Next lesson. The 09 log promised a collapsed hero. Not a regression, but the report (10-roadmap) implies done.
3. LOW-MEDIUM - Parent hero contradicts the verdict card: "0 lessons - 0 subjects", 0/0 tiles and a clipped "Av" tile (parent/home-390.png) directly above "1 homework task overdue". Flagged in 13-verification and left.
4. LOW-MEDIUM - H-01 removed the reader's one-click "Set this lesson" and the in-person "also send to portals": +1 tap for the most frequent tutor verb; the trade-off is logged (H-01.md) but no "Set homework" button was added to the live workspace after the lesson.
5. LOW - Kid Home contradicts the challenge decision "no list under the card": `home/KidHome.tsx:16` shows up to 4 rows for Years 3-6 and 6 for 7+. Tutor free-text titles leak the shame word ("Overdue reading" in kid/home-390.png), so P-13's kind language is bypassed.
6. LOW - Kid tab allow-list grew 7 -> 9 (`family/KidMode.tsx:16`). KidStars is child-scoped, no leak found, but Messages (free text to any in-scope tutor) is still in kid mode.
7. LOW - Kid Progress is stars only with invented 70/40 thresholds; for teens it is less useful than before (weak topics unreachable).
8. LOW - Dead code left: `KID_TAB_LABEL.dashboard` (`KidMode.tsx:20`); alias entries `lessons`/`progress` with no UI use.
9. Test debt: 13-verification says no single run had every spec green at once; two assign-lesson tests are timing-flaky; dark mode, keyboard and screen reader not tested; first-run guide never screenshotted.

No data-loss, auth or privacy regression found. The erase manifest with a drift self-test (`server/src/hubSelfTest5.ts`) is good.

## 3. Burden check per proposal (did anything ADD a screen/tab/setting/notification?)

| P | Added | Removed | Verdict |
|---|---|---|---|
| P-01 | End button, 6 s Undo strip | forgotten-broadcast class | small add, worth it (but see bug 1) |
| P-02 | one summary line | Worksheets tile, topics sub-line | net remove; hero not collapsed |
| P-03 | KidHome card, KidStars screen (new), 2 hidden kid routes | 5 kid blocks | new screen but replaces a dead button; net simpler |
| P-04 | RetryFace | false empty state | neutral |
| P-05 | Try again button | dev text | neutral |
| P-06 | none | 3 taps | good |
| P-07 | none visible | - | good; an invisible `--on-brand` hook |
| P-08 | none | 138 tiles | good |
| P-09 | none | grid, duplicate rings | good |
| P-10 | alias map | 2 names | rename only; tab count still 11 |
| P-11 | none (server) | - | good |
| P-12 | 3-step card (zero-student only), Year + Subject filters (hidden when N/A) | empty zeros | small add, self-removing |
| P-13 | string table | shame words | neutral |
| H-01 | none | 3 homework paths, list icon | good, at a +1 tap cost |

No new tab, setting or notification anywhere. That is the discipline the hawk asked for. The flip side: nothing was removed at the tab level (still 11).

## 4. Ranked next 10 changes

1. Fix End lesson unmount cancel (flush or send immediately). S. Safeguarding of the whole P-01 win.
2. One Mark queue (R-2): homework, quiz written, placement in one list with Mark-and-next. L. T1/X3's biggest cluster (about 20 rows, ~28 clicks).
3. Read-aloud speaker on the kid card, question prompt and result headline, reusing the existing `speak()` in `lesson/slides/blocks.tsx`. S-M. C1-02, C4-02, T4-05, C2.
4. Per-child accommodations flag set (no timer/extra time, streaks/confetti off, text size) as additive enrolment fields (R-5). M. T4-01/02/03, C4-01/07/12, X1-04.
5. Make the tutor hero actually collapsed by default and hide 0/0 tiles for families (parent hero contradiction). S. Finishes P-02 and fixes the visible parent oddity.
6. Enrol-by-name plus first-run for the invite flow (R-13). M. T5-01, X3-12.
7. Parent notifications for overdue and lesson-soon, one category (R-14) plus grammar fix. M. P1-03/04/07.
8. Tutor->child messaging rules, DSL view and acting-as stamp (R-8/R-9). M-L. X2-01/03/08/09 (owner review first).
9. Merge tabs 11 -> 9 now that naming agrees (Starting quizzes into Quizzes filter, Tools into Lessons) after item 2. M. X3-01/11/19.
10. Assign in one sheet (R-1) with group and "all Year N" chips and tomorrow chips; restore a "Set homework" button in the live workspace. M. T1-14..17, T1-22/23, X3-02.

Also cheap: in kid mode render item titles through a kind filter (or hide the title's state words), and remove the four KS2 rows to honour the challenge log. And run the untouched a11y checks (dark mode, keyboard, screen reader) before merge.
