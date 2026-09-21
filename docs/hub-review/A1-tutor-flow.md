# A1 — Tutor hat, Learning Hub (audit, read-only)

Auditor A1, 20 Sept 2026 (~02:30-02:50). Method: read every tutor-facing panel and its server route, plus a live Playwright walk of the freelancer portal
(standing e2e tutor, storage state, screenshots in `scratch/audit-A1/`). Staff / franchise / company: see "Live-walk status".

**Concurrent change to note.** While I was auditing, another agent added the fix for the known bug: `Set for children` now exists on the lesson
reader toolbar, on the interactive-lesson panel and on each lesson card (`NotesPanel.tsx:209,409,503`, `lesson/LessonTutorPanel.tsx`,
`hubIntent.ts lessonHomeworkIntent`). Verified live: the button shows and hands off to the Homework form. Remaining problems with that fix are F6, F14 and F17.
Line numbers below are as of ~02:40; files were still being edited.

Journey walked: enable hub -> enrol / group -> Lessons -> assign -> Quizzes / Placement -> Homework marking -> Flashcards -> Progress -> Home.
Sizes: S <= 1h, M <= half a day, L = a day or more.

---

## P0 — broken or blocking

### F1. Staff with "View" access get a full authoring UI whose every write fails (403)
- `server/src/routes/learningHub.ts:67` returns `canEdit: true` for every operator, staff included. `features/learninghub/LearningHubApp.tsx:46`
  uses that as the only switch for New lesson / Enrol / Set homework / Edit / Delete / Publish.
- The server does gate writes for staff: `capForApi` maps every non-GET under `/api/learning-hub` to `edit` (`middleware/access.ts`). Learning Hub also
  defaults to `none` for staff (`accessMap.ts DEFAULT_NONE_AREAS`), so a manager who ticks "View" is the normal case.
- Result: a view-only staff tutor sees green "Set homework", "Enrol a student", "Mark" buttons, clicks, and gets "Your role doesn't have access to the
  Learning Hub". The in-call workspace, marking dialogs and forms have no read-only state at all.
- Fix: `/providers` should return the staff member's real level (`canEdit: capLevel(caps,"learninghub")==="edit"`). The client already keys everything off
  `provider.canEdit`, so the panels then flip to read-only. Also show a one-line "View only — ask a manager for Edit access" bar. **S** server + **S** banner.

### F2. A tutor cannot run anything WITH the child (no "sit with a student" path anywhere)
The product says the child has no login and sits with the tutor. The server supports it (`POST /assessments/:id/attempts` accepts `childId` for tutors;
`hubCore` contract "T may start on behalf"), but no tutor UI calls it:
- `shared-assess/TakeAssessment.tsx` is only mounted by `shared-assess/StudentAssess.tsx` (parent). `QuizzesPanel`/`DiagnosticPanel` render `TutorAssess` for
  tutors, which has Edit/Publish/Delete only (`quiz/AssessmentList.tsx` ~L320 TutorCard). A tutor cannot give a child a placement test in the room.
- Lessons: `NotesPanel.tsx:393` plays the interactive lesson `readOnly={canEdit}` — "Nothing you do here is saved or counted", including the real exit quiz.
- Flashcards: `TutorFlashcards.tsx` is a card bank + stats; the only review UI is `StudentFlashcards`/`ReviewSession`. The in-call `CardsTab` is display-only
  ("no reviews are recorded from here").
- Consequence: the diagnostic/placement flow (baseline, `requireDiagnostic` gate) can only be completed by a parent logging in. A tutor with a child in the
  room has no button.
- Fix (M each): a "Sit a student" action on quiz / placement cards and in the in-call Quiz tab: pick a child, open `TakeAssessment` with that `childId`
  (props already take `childId`). Same for `LessonPlayer` (`readOnly=false`, `childId`) and `ReviewSession` from a student card. Start with placement + quiz. **M**

---

## P1 — wrong or awkward flow

### F3. Assigning things a child cannot open (silent dead assignments)
- `server/src/routes/hub/homeworkApi.ts` (`eligibleStudents`, `checkRefs` L66-75) only checks the child is an active enrolment. It does not check the quiz's
  `subject` against the child's enrolled `subjects`, nor the quiz `audience` (year group / age), nor `retake_blocked`.
- `attempts.ts:135` (`childSubjectOk` -> 404) and `:151` (`not_for_this_child` -> 409) then refuse the child at start. The family sees homework they can never
  start; the tutor sees a healthy "Waiting" row.
- Set-for-children makes this easier to hit: `HomeworkForm` lists every enrolled student regardless of the quiz.
- Fix: in the form, after picking a quiz, flag students it won't reach ("Maya can't see French — subjects: Maths") using the existing `eligibleCount`/
  `audience` fields; server returns a 400/warn list. **M**

### F4. Set-for-children on a draft lesson (or a lesson whose exit quiz is a draft) does nothing useful, with no warning
- Server drops unpublished notes from a family's homework (`homeworkApi.ts:187` filters `published !== false`), and refuses an unpublished quiz
  ("Publish that quiz before setting it as homework", L71).
- Client: `HomeworkForm` only shows a small "Draft" badge on a note; for a lesson-supplied quiz that is unpublished the fetch-by-id is discarded
  (`published === false` not unshifted), the `<select>` shows "No quiz" while state still holds the id, and Save returns the 400 with no context.
- Fix: in `lessonHomeworkIntent`/form: if the lesson is a draft, show "This lesson is a draft — publish it so children can open it" with a Publish button;
  if the quiz is a draft, say so on the quiz field. **S**

### F5. Home "Written answers to mark" sends the tutor to the wrong tab and mixes in placement tests
- `home/TutorHome.tsx:75` `written = attempts.filter(a => a.status === "pending_marking")` (all types), and `:134` routes it to `quizzes`. `TutorAssess.tsx`
  filters the Marking tab by `type`, so a placement paper waiting for marks shows on Home but not in Quizzes -> Marking (it is in Placement test -> Marking).
- Fix: split by `assessmentType`, or route to `diagnostic` when the oldest pending row is a placement test. **S**

### F6. Set-for-children buttons are duplicated and lead to a cold form
- Reader shows two identical yellow "Set for children" buttons on an interactive lesson (toolbar + panel; screenshot `freelancer-lesson-reader.png`). Keep one.
- Handing off to Homework loses context: no "back to the lesson", and the fixer's instructions text is pre-filled but the student picker is empty and
  unsearchable (F8). **S**

### F7. Quizzes and placement tests cannot be assigned or previewed from their own tab
`quiz/AssessmentList.tsx` TutorCard: Edit / Unpublish / Delete only. To set a quiz you must know to go to Homework -> Attach a quiz (the in-call Quiz tab has
"Set as homework" + "Preview questions", the Quizzes tab has neither). The intent plumbing already exists (`setHubIntent({kind:"homework", assessmentId})`).
- Fix: add "Set for children" (and "Preview") to TutorCard, and "Duplicate". **S**

### F8. Pickers do not scale: 56 chip wall, 450-item `<select>`, no search
- `teachKit.tsx:235 StudentPicker`: flat chip list in a 210px scroller, no search, no year/subject/group filter (used by Homework, Live lesson, Group forms).
  The live e2e tenant has 56 students; a real tutor with 40 is unusable for "everyone in Year 5 except two".
- `HomeworkForm.tsx:129-133`: quiz `<select>` of every published quiz (a seeded tenant has ~450) with no search, and a note checklist of all notes
  (un-paged `GET /notes`, all ~450).
- Fix: a searchable combobox for quizzes/notes (server `q`/`limit` already exist), search + "select all shown" in StudentPicker. **M**

### F9. Student cards are dead ends; no per-student hub
`StudentsPanel.tsx:354` RowMenu = Edit details / Pause / Un-enrol. The card is not clickable; no Open progress, Set homework for this child, Schedule lesson,
Allow retake, Waive placement, Message parent. The Home nudge "Quiet for 14+ days" also just switches to the Students tab.
- Fix: make the card open the Progress detail (`ProgressView`) with action buttons (homework / lesson / waive). Waive currently lives in a separate
  Placement-tab card (`quiz/WaiveCard.tsx`). **M**

### F10. Progress detail shows the parent's second-person copy to a tutor
`progress/ProgressView.tsx:53` "Your progress starts with the first quiz", `:85` "Your last N quiz scores", `:146` "marks your placement-test starting point". The
tutor opens the same component; `p.canEdit` is available. It also shows no homework, flashcard, attendance or lesson history — Progress is quizzes only.
- Fix: branch copy on `p.canEdit` ("{name} hasn't taken a quiz yet — set one"); add a student header with quick actions. **S** copy, **M** for context.

### F11. No "my students / my lessons" for multi-tutor businesses; `tutorUid` is dead
Enrolment has `tutorUid/tutorName` (`learningHub.ts:113,154`) but the UI never sets or filters by it (grep in `features/learninghub`: read-only display
fallbacks). A company with 5 staff tutors: every tutor sees every student, every lesson, every hand-in (inbox, Home "Next lesson", Progress grid); any
tutor can cancel / join-as-owner another tutor's lesson (`is_owner` is granted to anyone who can write the lesson). "Many hats": one person is company owner
AND tutor, but a staff tutor has no view of just their own class.
- Fix: assign a tutor on Enrol/Edit (staff picker), add a "Mine / Everyone" filter on Students, Homework inbox, Live lessons and Home (server already
  returns `tutorUid` on lessons; add `?mine=1`). **L**

### F12. Franchise tutors are shown head-office content as editable
Client has no franchise awareness (zero `franchiseId` uses in `features/learninghub`), while server makes head-office topics/lessons/quizzes/questions read-only
for a franchise (`hubCore canWriteRow`; students also 403 "That student belongs to head office"). Franchise users see Edit / Delete / Rename / Publish on
HO rows and get a 403 banner. Topics and notes rows carry `franchiseId` (`topicOut`, note rows) but the UI never compares it.
- Fix: pass `franchiseId` from `/providers`, mark rows "From head office" and hide/disable write controls. **M**

### F13. No way to onboard a family you have not already booked
`StudentsPanel.tsx EnrolModal` candidates = `GET /api/children/lookup` (children who booked with, or self-joined, the provider). A pure tutoring freelancer with
no booking history sees "No children to enrol yet — a child shows up once their family has booked with you or joined you" and no next step (no invite link,
no "add a family"). For staff with a site scope the list is further narrowed.
- Fix: add "Invite a family" (link/email through the existing invites route) to the empty state. **M** (booking untouched: use invites, not bookings).

### F14. Video-lesson scheduling has no repeat and cannot log a lesson already held
`live/LessonForm.tsx:52` refuses a past start ("That start time is in the past"; server refuses finished lessons too). Tutoring is weekly: each lesson is a fresh
form, six students each. No "repeat weekly x N", no "duplicate". The form has no lesson/quiz attach (`noteIds` exists server-side and in the post-schedule
Notes editor; the create form only offers a topic).
- Fix: add "Repeat weekly for N weeks" (creates N lessons, server already allows), and an "Attach lessons" step. **M**

### F15. The Home quick actions only switch tab; "Quiet 14+ days" flags brand-new students
- `home/TutorHome.tsx:43-50` ACTIONS call `go(key)`: "New lesson", "New quiz", "Assign homework", "Enrol student" land on the list, not on the open form. The
  `hubIntent` mechanism (used by Groups) is unused here, so it is two clicks where the label promises one.
- `:71` `quiet = active.filter(s => now - (seen.get(id) ?? 0) > 14d)`: a student enrolled today with no activity is "Quiet for 14+ days"; live Home showed
  "Needs your attention 5" on a tenant of untouched students.
- Fix: exclude students enrolled < 14 days (`createdAt` is on the roster row); open the relevant form via intent. **S**

---

## P2 — polish

### F16. "Lesson" means three different things in the tutor UI
The Lessons tab (notes / interactive lessons) and video lessons both say "lesson": `NotesPanel` "Couldn't save the lesson", `LiveLessonsPanel` "Couldn't cancel the
lesson", `LessonForm` "Couldn't save the lesson" (a video lesson). Homework says "notes" (`TutorHomework.tsx:122,202` "attach a quiz and notes", "N notes"),
in-call editor "Attach notes from my library / New note" (`live/workspace/LessonNotesEditor.tsx:137`), `LessonForm.tsx:95` "The topic's notes appear
beside the video". The tab is "Lessons" so the tutor hunts for a Notes tab that no longer exists.
- Fix: user-facing copy pass: Lessons tab items = "lesson"/"resource", scheduled sessions = "video lesson"/"session". **S**

### F17. Edge-case polish on the new Set-for-children path
- Any lesson list card has both the edit, delete, and now set-for-children icon buttons over the coloured cover; on the cover the large star watermark overlaps
  the trash icon (screenshot `freelancer-notes.png`). Small tap-target collision.
- `lessonHomeworkIntent` marks every hand-in "homework"; a lesson without a quiz has nothing to hand in but text (the form will demand a due date and
  instructions). Consider an "assign to read" mode that needs no hand-in. **S**

### F18. Setup discovery for the tutor: how to enable
Verified live (company and franchise standing accounts have the hub off): the direct URL shows a clear "Learning Hub is turned off ... Open Setup -> Features"
gate (`components/auth/ViewGate.tsx`), good. Gaps: the sidebar item is hidden when off (`accessMap` OPT_IN), so a new tutor has no discoverable
entry point; the second-level gate text in `LearningHubApp.tsx:114-126` (used when the API says the hub is unavailable) only links to Setup for
company / franchise / freelancer and gives staff no "ask a manager to switch it on". **S**: a dashboard card "Teach online? Turn on the Learning Hub" while
off, and staff wording.

### F19. Flashcards tab
- `TutorFlashcards.tsx` "Publish N drafts" fires N parallel PUTs (`Promise.all`, up to 60 cards at a time): use one bulk route. **S**
- Header stat cards are tenant-wide (`stats.totalCards`) while the list beneath is filtered by the sidebar topic; totals look inconsistent when a topic is
  selected. **S**
- Cards can be attached to homework only through `flashcardTopicId` (whole topic); no "assign these 10 cards" and no per-child deck status link.

### F20. Marking and results
- `quiz/MarkingQueue.tsx`: queue rows have no filter by student/quiz and the list is unbounded for a large tenant (`/attempts` un-paged, every attempt in the
  tenant downloaded to render the Quizzes tab; `TutorAssess.tsx:43`). **M**
- Results has "Allow one more attempt" (good) but no per-question analytics ("which question did most students miss"). Nice-to-have.
- Home feed says "scored 62% on a quiz" when the title is missing; placement papers appear as "quiz".

### F21. Minor labels / states
- Provider name in the hero for every operator is the generic "Your Learning Hub" (`learningHub.ts:67`); the business name is not shown.
- Roster: a paused student shows "Re-enrol" in the enrol list, and "Resume" in the card menu (two verbs for one action).
- Progress overview: the grid sorts scored students first; enrolled-but-blank students look identical to paused ones; no group or year filter (groups exist
  in Students but not Progress/Homework inbox).
- `StudentsPanel.saveDetails` writes the student, then each group in sequence with no rollback if the second write fails.

---

## What works (verified live / by code)
- Enable/disable gate, tab shell, tab deep link (`?tab=`), Home tiles, Students grid with mastery ring and next-lesson badge, group cards, Lessons list + reader,
  Set for children button, tutor Progress grid, Flashcards bank + stats all render for the freelancer portal with no console/API errors (0 API 4xx during the walk).
- Realtime refresh, quiz -> marking -> mastery loop, homework inbox with MarkDialog, retake control and waive-placement exist and are reachable.

## Priority order I would fix
F1, F2 (placement + quiz sit-with), F3, F4, F7, F8, F5, F15, F9/F10, then F11-F14 (bigger), then polish.

## Live-walk status
- Freelancer portal (hub on, 56 polluted e2e students, 19 lessons): all 9 tabs loaded, 0 API 4xx; screenshots `scratch/audit-A1/freelancer-*.png`.
- Company and franchise standing accounts have the hub OFF (gate page, screenshots `company-0-landing.png`, `franchise-0-landing.png`). Staff walk timed out on
  a busy dev server (other agents compiling). I did not switch the hub on for those tenants (shared e2e state), so F1 (staff view-only), F12 (franchise
  head-office rows) and F11 (multi-tutor scoping) are established from code (`learningHub.ts:67`, `hubCore.ts canSee/canWriteRow`, no `franchiseId`/`tutorUid`
  use in `features/learninghub`), not from a live run. Worth a targeted e2e once a staff (View) and a franchise account with the hub on exist.
- Not audited in depth: live video call/whiteboard internals (other agents), parent-side screens.
