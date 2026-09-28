# Critic review: homework redesign (features/learninghub/homework/*)

Status of evidence: STATIC (code + server contract read line by line) is complete. The REAL-BROWSER pass (tutor / parent / kid at 1440/768/390, API probes) is written and QUEUED behind the shared e2e lock (about 7 tickets ahead, holder on one run for 20+ min). When it runs it writes screenshots to `docs/reviews/shots/homework/` and a findings log to `docs/reviews/shots/homework/_log.txt` (lines prefixed with FAIL / OAK VISIBLE / H-SCROLL / probe results). Spec: `/private/tmp/claude-501/-Users-kazjames-Downloads-activtyos-app-/9019c60e-ba39-4e52-8a1c-d81f4f3bd850/scratchpad/crit/crit.spec.ts` (own config, runs under `E2E_CMD` through `scripts/e2e-locked.sh`, throwaway accounts only, no cleanup). Items marked (UNVERIFIED-IN-BROWSER) need that log to confirm.

## CRITICAL

None that lose data or leak another family's data. The closest is H1 (the "auto-marked" promise does not reach the markbook).

## HIGH

**H1. Auto-marked worksheets never become a mark; the markbook grid never shows them as done.**
Nothing in `server/src/routes/hub/attempts.ts` writes to `hubSubmissions` (only `homeworkApi.ts` / `inPersonApi.ts` touch it). A child finishes an interactive worksheet, is auto-scored, hands in, and the grid cell stays blue "Handed in" / score "in" until the tutor opens MarkDialog, clicks "Use the quiz score (x/y)" (MarkDialog.tsx:119) and Save. With 30 children x 8 homework that is 240 manual clicks, which defeats "auto-marked" and the whole markbook (the traffic light only goes green/amber after a human mark).
Fix (minimal, server): in `POST /submissions/:id/submit` (homeworkApi.ts ~552), if the linked attempt is `marked` and `maxMarks>0`, also write `mark={score:scoreMarks,max:maxMarks,feedback:"",markedBy:"auto",markedByName:"Automatic",markedAt:now}` and `status:"marked"`; and when a `pending_marking` attempt is later marked, patch its submission the same way. Tutor can still override.

**H2. Worksheet attempt is rejected on a homework that also has a legacy quiz; only ONE worksheet result is ever linked.**
Server submit (homeworkApi.ts:541-542): `hwAssessment && a.assessmentId !== hwAssessment` -> 400 "That isn't a finished attempt at this homework's quiz". Client sends `linkedAttemptId = sub.attemptId ?? finished?.id ?? wsFinished?.id` (StudentHomework.tsx:178). For a legacy homework (quiz + Edit form now lets you add a worksheet) where the child did only the worksheet, hand-in fails with a raw 400. Also `wsAttempts.find(...)` takes the first finished worksheet; a homework with 3 worksheets links one attempt, so the tutor sees one third of the work (MarkDialog renders a single `row.attemptId`), and a child can hand in after finishing 1 of 3 with no warning.
Fix: on submit accept `a.assessmentId === hwAssessment || a.assessmentId in worksheetQuizIds(hw)`; store `attemptIds[]` (or sum) and render each in MarkDialog; disable "Hand in" until every interactive worksheet is Done (or show "2 of 3 worksheets done").

**H3. Draft worksheet notes can be attached silently, and then vanish for families.**
`checkRefs` (homeworkApi.ts:80-84) only requires `worksheetFile`, not `published`. Tutor list uses `worksheetsOut(..., publishedOnly=false)` so it looks fine; the family uses `publishedOnly=true` (line 259) so the child sees a homework with NO worksheet and no explanation. The form warns about draft quizzes and draft lessons (HomeworkForm.tsx:180-191) but has no equivalent for worksheets, and the picker (`worksheet=1` on /notes) lists drafts. Also `GET /notes/:id/worksheet` correctly 404s drafts for families, so the failure is invisible.
Fix: picker rows show a "Draft" pill + the same "Publish it" banner (reuse `attachedDrafts` over `wsRows`), and server `checkRefs` returns 400 "Publish the lesson first" for unpublished worksheet notes (mirror the quiz rule at line 74).

**H4. "Bare on creation" is not enforced: prefilled entry points still link a lesson, quiz and flashcards.**
`HomeworkForm` still takes `packNoteId`, `initialNoteIds`, `initialAssessmentId` and `applyPack` (HomeworkForm.tsx:72-76) which sets `assessmentId`, `noteIds`, `flashTopic`. Any "Set for children" from a lesson, group quick action or Home tile produces exactly the linked homework the owner ruled out, and the only sign is a small "Already linked (from before)" row (a mislabel for a brand-new homework). Empty state copy in TutorHomework.tsx still says "optionally attach a quiz and lessons".
Fix: drop `assessmentId/noteIds/flashcardTopicId` from `applyPack` and the `initial*` props on create (keep them only when editing an existing homework); attach the lesson's worksheet instead via `worksheetNoteIds`; reword the label and empty state.

**H5. Whole product is English-only in these files.**
Zero `useT()` in `features/learninghub/homework/*` (StudentHomework has one), while 141 sibling hub files use it and `e2e/i18n/*-locales.spec.ts` exist. Every label is a literal: LIGHT_TEXT, "Class results", "Their answer", "Model answer", "Waiting for your marks", QUICK feedback phrases, "Interactive / PDF only", pluralisation by `s` suffix (`note${...}`, `worksheet${...}`), and dates via `toLocaleDateString("en-GB", ...)` in TutorHomework.tsx and hwTypes.ts:`dueState` (teachKit has language-aware date helpers). A Polish/Arabic family sees an English homework page beside a translated Lessons area.
Fix: route through `useT()` keys like the rest of the hub; use `fmtDay`/`fmtDayTime`; ICU plurals.

## MEDIUM

**M1. Attempt-linking loophole for worksheet-only homework (worksheetQuizId rule is not a rule).**
attempts.ts:228: the guard is `h.get("assessmentId") && h.get("assessmentId") !== aSnap.id && !viaWorksheet`. When the homework has NO assessmentId but has worksheets, `viaWorksheet` is computed but never required: ANY quiz the child can reach can be started "for" that homework. Likewise submit (homeworkApi.ts:541) skips the check when `hwAssessment` is null, so any finished attempt of this child with `homeworkId` null/this can be attached as the hand-in (an old easy quiz result). Probe to confirm: log line "start UNRELATED quiz on worksheet-only homework status=" (want 404).
Fix: when `wsQuizIds.length && !h.assessmentId`, require `aSnap.id in wsQuizIds`, and enforce the same in submit.

**M2. Grid traffic-light semantics are inconsistent and the thresholds are hard-coded.**
hwResults.tsx:15-21: marked >= 60% green regardless of the quiz's own `passMarkPct`; marked late + high = GREEN "On track (late)" while submitted-but-late-and-unmarked = RED "Late" and not-handed-in-overdue = RED; the legend collapses "Not handed in / late" into one red. The tutor cannot tell late-but-done from missing. Grey (not due yet) is missing from the key. "On track" is also the wrong word for a finished, marked homework (MyMaths says the score). Also `amber` label "Needs attention" is reused for a perfectly complete 55%.
Fix: 4 distinct states with different icon shapes (tick, half, cross, clock) and text; use `passMarkPct` when the homework has a quiz; make late a badge on the cell rather than a colour.

**M3. The markbook is hard to find and small.**
`ResultsGrid` renders only under the "Set homework" sub-tab (TutorHomework.tsx `view==="assignments"`), above a list of cards, under the title "Class results". A tutor looking for the markbook goes to "Inbox". It is capped at the 8 most recent homework by due date (`MAX_COLS`), silently (no "showing 8 of 23", no scroll to older), has no class-average row/column, no sort, no filter by group/year, no print/export. At 390px the table needs horizontal scroll inside the card with a sticky 140px name column plus 112px x 8 columns (about 1050px) - usable but the "Done" column and the key are off-screen; 10.5px status text is below readable size.
Fix: own sub-tab "Markbook"; "Showing latest 8 of N" with a homework picker; average row/column; group filter.

**M4. Marking is still manual score/out-of, not the MyMaths per-question flow.** See the MyMaths grade below. MarkDialog cannot award marks to a single written question; for `pending_marking` it says "mark them in the Quizzes tab" (MarkDialog.tsx:117), so a tutor bounces between tabs to finish one child's homework. "Out of" defaults to 10 (line 47) and has no link to the attempt's max unless the quiz is already marked.

**M5. Linked attempt goes stale after a retake.**
`linkedAttemptId = sub.attemptId ?? ...` (StudentHomework.tsx:178) prefers the attempt stored at first hand-in, so "Update hand-in" after a retake keeps the old result. Server `latest` auto-link only runs when `!attemptId` (homeworkApi.ts:543). Whether double attempts are possible depends on quiz retake policy; `POST /assessments/:id/attempts` with the same homework will create a second one if the policy allows. Fix: prefer the newest finished attempt for this homework.

**M6. Performance at 100+ children x many homework.**
`GET /homework/inbox` is unbounded (one row per child per homework) and is refetched together with `GET /homework` on every `hubHomework|hubSubmissions|hubAttempts` realtime tick (TutorHomework.tsx `useRealtime`), so any child answering any quiz re-downloads the whole inbox for every open tutor tab. Grid = kids x 8 real `<button>`s, no windowing (800 buttons at 100 kids, fine; 20k inbox rows at 100 kids x 200 homework is not). `GET /notes/:id/worksheet` runs one `hubHomework where assignedChildIds array-contains` per child on every PDF open. Fix: `?limit`/`?since` on the inbox, build the grid from a purpose-made `/homework/results?last=8` aggregate, debounce the realtime refetch.

**M7. Model answers are shown to whoever can load the attempt.**
`QuizBreakdown` renders "Model answer" whenever `a.correctAnswer != null` and is also used in StudentHomework (lines 305, 400). If the attempts API returns `correctAnswer` to families for retakable quizzes, a child can read the answers then retake. (UNVERIFIED-IN-BROWSER: probe logs `child result answers[0] keys=` / `correctAnswer=`.) Fix if present: strip `correctAnswer` for family callers while the retake policy still allows another go.

**M8. PDF `<object>` does not render on iOS Safari / many phones** (hwPreview.tsx worksheet dialog, StudentHomework.tsx WorksheetCard). The fallback text only appears if the type is unsupported at load, and iOS shows a blank frame. The download link uses `download={ws.name}` on a cross-origin signed URL, which browsers ignore. Fix: always show the "Open PDF" button beside the frame on touch devices and hide the `<object>` below `md`.

## LOW

- L1. HomeworkForm.tsx:167-168 stray empty nested `<div><div>` around Due date.
- L2. Worksheet picker `.slice(0, 10)` silently drops the 11th choice (server max 10 too); show a limit message.
- L3. Question rail is `role=tablist` with no arrow-key roving, no `aria-controls`, tabpanel unlabeled (hwBreakdown.tsx:33,46). Every tab is a tab stop. Also each rail item shows "3/4" with colour only for full marks; add a tick/cross glyph. The `[n]` bracket is green only; fine as text, but `aria-label` says marks available while the bracket is meant to show marks AWARDED in MyMaths.
- L4. Stacked dialogs: the lower dialog is not `inert`/`aria-hidden` while the preview is open; both have `aria-modal`. Focus trap and scroll lock behave (each restores on close) but screen-reader users can still reach the lower one.
- L5. `.hub-sheet input {color-scheme: light}` (kit.tsx:~126) still forces the light native date picker inside `.hub-plain` dialogs on a dark theme.
- L6. `Late` pill in MarkDialog subtitle and the red "Handed in late" chip in StudentHomework are red for parents and tutors but neutral for a kid (good), yet the grid shows red for the tutor only; consistent, but the kid's wording "Handed in" for a late one hides information a parent viewing in kid mode needs.
- L7. Worksheet filename (`wf.name`, e.g. "e2e-worksheet.pdf" / original PDF names) is shown in preview headings/`aria-label`s when the title is missing (`title ?? ws?.name`); confirm the seeded names never contain the provider's brand. The literal string "Oak" does NOT appear in any file under `features/learninghub/homework/` or in `teachKit.tsx`/`kit.tsx` (grep clean). Component/testid names are not user-visible. The e2e `no-oak.spec.ts` covers routes; add the worksheet dialog and picker to it.

## What checked out

- Legacy homework preserved on save: `save()` sends `assessmentId`, `noteIds`, `flashcardTopicId` from state, and the PATCH keeps `worksheetNoteIds` unless sent, so an unchanged Edit -> Save round-trips. Removing a linked row only clears that field; server accepts `null`. (Probe logs before/after.)
- Families cannot fetch a worksheet that is not on a homework assigned to one of their children, drafts 404, path comes from server-side tenant + note id (learningHub.ts:724-746). Sibling worksheets are reachable within one family, which is expected.
- Traffic lights are NOT colour-only: every cell has a numeric/text label and an `aria-label` with child, homework, state and score; 44px targets.
- Dialogs: Esc closes only the top layer (escape stack), focus trapped and restored, body scroll locked and restored.
- `plain` Dialog: cream `--hub-warm*` tokens are re-pointed to `--surface`/`--line`, so the homework dialogs no longer look warm.

## Closeness to the MyMaths references: about 50%

| MyMaths element | Here | Verdict |
| --- | --- | --- |
| Left rail of question tabs with per-question marks and running total | `QuizBreakdown` rail (Q1 3/4 ... Total), read-only, only AFTER marking, in results views | Present but only as a review; the child's DOING screen is the generic quiz runner with no rail |
| Marks in green brackets [n] | `[n]` on the prompt = marks AVAILABLE, green | Partial (MyMaths shows marks per question and awarded) |
| Clear "Mark it" | Child: "Do the worksheet" then "Hand in homework"; tutor: "Save mark" | Missing an explicit per-question "Mark it / Check" step and any instant feedback loop |
| Running total | "Total x/y" in the rail | Present |
| Markbook: children x homework, traffic lights | `ResultsGrid` (8 latest, lights + score + label) | Good bones, buried in Set homework, no averages/sorting/filter, mixed late semantics, blue "handed in" state that auto-marked work never leaves |
| Auto marking flows into the markbook | No | Missing (H1) |
| Tutor overrides one question's marks | No (must use Quizzes tab) | Missing (M4) |
| Retry / "have another go" per question | `RetryFace` exists, not on worksheets | Missing |

## Top 10 fixes (in order)

1. Auto-create the submission mark from a marked attempt on hand-in and on later marking (H1).
2. Accept worksheet attempts on mixed homework, link ALL worksheet attempts, block hand-in until all interactive worksheets are done (H2).
3. Block/flag draft worksheets in the picker and in `checkRefs` (H3).
4. Make creation truly bare: strip quiz/lesson/flashcard from `applyPack`/`initial*` props; fix the "Already linked" label and empty-state copy (H4).
5. Move all strings and dates in `homework/*` onto `useT()` / language-aware date helpers (H5).
6. Enforce the worksheet-quiz rule in attempt start and submit when the homework has no assessment (M1).
7. Redesign the traffic lights: separate Late / Missing / Done / Not due, use `passMarkPct`, add the missing legend entry, add non-colour glyphs (M2).
8. Give the markbook its own sub-tab with "latest 8 of N", averages and a group filter (M3).
9. Per-question tutor marking in the rail and a MyMaths-style doing rail with "Mark it" for the child (M4 / MyMaths gap).
10. Stop the full-inbox refetch on every hubAttempts tick and add a results aggregate endpoint; hide `<object>` PDFs on phones (M6, M8).
