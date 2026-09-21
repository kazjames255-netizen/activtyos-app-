# A2 — Parent hat + child hat audit (Learning Hub)

Auditor A2, 2026-09-20 overnight. READ-ONLY: no source was edited. Evidence: code reading of
`features/learninghub/*` and `server/src/routes/hub/*`, plus a live Playwright drive of `/custdash/learninghub`
as the standing e2e parent with two freshly seeded children, at 1280 px and 390 px.
Screenshots and log: `scratch/audit-A2/` (`desk-*.png`, `phone-*.png`, `log.txt`; driver `audit.spec.ts`, `run.sh`).

Tags: **[live]** seen in the running app, **[code]** read in source only.
Sizes: S under half a day, M about a day, L multi-day.

## Verdict in five lines

1. Tenancy and per-child isolation on the API are sound. A parent can only reach their own enrolled children, and a
   foreign id is a 404 [code: `hubCore.ts` `resolveCtx`, `attempts.ts` `loadAttempt`, `shared.ts` `childFor`]. No tutor-only panel is
   mounted for a parent (`LearningHubApp.tsx` gates `students` on `tutor`; server `requireEdit`).
2. The quiz, flashcard and lesson runners are genuinely good on a phone: 60 px answer buttons, 44 px controls, no horizontal
   overflow at 390 px [live]. The copy is child-friendly ("Skip", "Hand in", "Leave this paper for now?").
3. There is **no kid path**. The "child" is whoever holds the parent's phone, inside the parent's full portal, with nothing
   saying which child they are being recorded as (P0-1, P0-2).
4. Refresh and Back are half-handled. Quiz resume works [live], lesson progress and everything else is lost, and Back leaves the hub (P1-2).
5. In-person mode is mostly buildable on the existing attempts API. A batch endpoint and a class-session UI are what is missing
   (see the design at the end).

---

## P0 — fix before a real child uses it

### P0-1  The runners never say WHICH child is doing it, so a sibling's result can be recorded against the wrong child
- **Where:** `features/learninghub/shared-assess/TakeAssessment.tsx:257-266` (header shows only quiz title and "Question 1 of 3"),
  `lesson/LessonPlayer.tsx` header (subject/year/title, XP), `lesson/QuizStep.tsx:107` ("Quiz · 1 of 3"),
  `flashcards/ReviewSession.tsx` (no name). The child comes from `useHubData.ts:48-53`: last pick remembered in
  `localStorage["aos.hub.child.<tenant>"]`, else the FIRST child.
- **Problem [live + code]:** focus mode hides the hero (the only place the child's name and picker live). Parent with Ava and Ben
  left Ben selected, hands the phone to Ava, Ava opens a lesson or quiz. Nothing on screen says "Ben". The quiz start
  (`TakeAssessment.tsx:67`), the lesson's exit quiz, the flashcard ratings and homework hand-in all post `childId=Ben`. This
  silently corrupts Ben's mastery/streak and there is no delete/undo for a parent. It also makes mastery the tutor sees wrong.
- **Fix:** (a) pass `child?.childName` into `TakeAssessment`, `LessonPlayer`, `QuizStep` and `ReviewSession` and show a persistent
  avatar+name chip in each sticky header ("Ava's quiz"); (b) on the intro/start screens with more than one enrolled child, add a
  one-tap "This is Ava. Not Ava? Switch" line; (c) do not default to `children[0]` when the family has more than one child and no
  remembered pick: show a "Who's learning?" picker first.
- **Size:** S.

### P0-2  Focus mode is cosmetic: a child can walk into the entire parent portal (and back into siblings' data)
- **Where:** `LearningHubApp.tsx:160-170` (focus bar), `:161` "Show menu"; the portal shell (sidebar and top bar) is outside the hub.
- **Problem [live]:** in the middle of a quiz and inside a lesson the portal sidebar stays: Children & details (all the family's
  child records), Meals, Trips & consent, Messages, My bookings, Memberships, Sign out, plus the bell (86 unread in the test run).
  On phone the top bar has mail/search/calendar/bell and a hamburger to the same menu. Inside the quiz the "Show menu"
  bar is one tap from the hub hero, which has the **sibling picker** ([live] screenshot `desk-05`), so a child can open a
  brother's or sister's results. The parent has no "kid mode".
- **Fix:** add a "Hand over to Ava" mode:
  - Started from Home/Lessons/Quizzes with the child already chosen. Renders through the existing `FullscreenPortal`
    (`teachKit.tsx:~200`, already used by the live Lobby) so it covers all portal chrome.
  - Hard-scoped to one child: no provider/child pickers, tabs limited to Home, Lessons, Quizzes, Homework, Flashcards
    (no Progress mastery table, no Live-lessons list, no settings). No "Show menu".
  - The only exit is a parent gate (hold-for-3s or a small sum) that returns to the normal hub. Persist the mode in
    `sessionStorage` so a refresh stays in kid mode.
  - Add the same gate to the "Show menu" button as a minimum step.
- **Size:** M (shell flag plus wrapper plus gate; panels are reused as-is).

---

## P1 — real friction, visible to every family

### P1-1  There is no way to "hand a child a lesson/quiz"; the only deep link is the homework button, and it is a DOM-click hack
- **Where:** `homework/StudentHomework.tsx:176` (`goQuiz` and `goToTab` in `teachKit.tsx:275-283` do `document.querySelector('[role=tab]').click()`),
  `TakeAssessment.tsx:67` (start posts `{childId}` only, never `homeworkId`).
- **Problem [code]:** "Take the quiz" in a homework just jumps to the Quizzes tab; the child then hunts for it among up to 24 cards.
  `POST /assessments/:id/attempts` already accepts `homeworkId` (`attempts.ts` `startBody`) but the UI never sends it. The
  homework link is a heuristic (`StudentHomework.tsx` `finished` = ANY earlier finished attempt of that quiz, even one from before the homework existed).
  There is no `?child=&open=quiz:<id>` URL, so the parent cannot send Ava straight to "Fractions quiz".
  (Another agent is adding `requestOpenLesson` for homework lessons; it uses the same tab-click hack. Keep in step with it.)
- **Fix:** URL-addressable state: `?tab=quizzes&child=<id>&open=quiz:<assessmentId>[&hw=<id>]` and `open=lesson:<noteId>`, read once in
  `LearningHubApp`/panels (generalise `requestOpenLesson`). From a homework, start with `{childId, homeworkId}` directly instead of
  navigating. Add "Start" deep-link buttons on the Home "Keep going" card that open the runner immediately.
- **Size:** M.

### P1-2  Refresh / Back: only the tab survives; Back exits the hub; lesson progress and quiz answers are single-device
- **Where:** `LearningHubApp.tsx:36,72-74` (`replaceState` for `?tab=` only). Open lesson (`NotesPanel.tsx:92 reading`), quiz (`StudentAssess.tsx taking`),
  homework detail (`openId`) and the chosen child are React state only. Quiz drafts are `localStorage["hubdraft:<attemptId>"]` (`TakeAssessment.tsx:41`).
- **Verified [live]:**
  - Refresh mid-quiz: lands on the quiz list with a "Pick up where you left off / Resume your quiz" card, works (draft restored on same device).
  - Refresh mid-lesson: back on the Lessons list, all steps, XP and warm-up answers lost (`after refresh in lesson: player=false`).
  - Back button: no history entries are pushed, so on a phone/tablet Back or the Android gesture leaves the whole hub, and any open quiz/lesson is dropped.
- **Problem:** on a shared family tablet a child hits Back constantly. A different device or a cleared browser loses the answers (server keeps the attempt, not the answers: `attempts.ts` says "answers only travel at hand-in").
- **Fix:** (a) `history.pushState` when opening a lesson/quiz/homework so Back closes the runner (with the existing leave-confirm)
  and does not exit; store `open=` and `child=` in the URL so refresh restores the lesson start screen; (b) optional server-side draft
  `PUT /attempts/:id/draft {answers}` (debounced) so a resume works on another device; (c) lesson player: persist `step` in `sessionStorage` per note+child.
- **Size:** M (a and c are S; b is M).

### P1-3  The exit quiz of every lesson also appears as a stand-alone quiz, and can be recommended before the lesson
- **Where:** `shared-assess/StudentAssess.tsx` lists all published quizzes; `home/StudentHome.tsx:66-72` ("Up next" = first quiz with no attempt).
- **Problem [live]:** the test child's Quizzes tab shows "Lesson quiz — Neurones and synapses …" next to the real quiz ("To do 2"). Home
  "Keep going" can send the child to an exit quiz cold, before doing the lesson. Taking it from the list attaches it to no lesson.
- **Fix:** server: mark assessments referenced by a lesson (`lesson.quizId`) with `lessonNoteId` in `GET /assessments`; UI hides them from
  "To do"/"Keep going" (or shows a "Part of: <lesson>" chip and a "Start the lesson first" hint that links to it).
- **Size:** S-M.

### P1-4  Notifications lose the child and the target; a quiz being marked never notifies
- **Where:** `server/src/lib/hubNotify.ts:14` (`HREF = "/custdash/learninghub"` constant for every notice); `attempts.ts` `PUT /attempts/:id/mark` (no `notifyFamilies` call; grep confirms the only callers are `homeworkApi.ts`, `lessonsApi.ts`, `learningHub.ts`).
- **Problem [code]:** a parent of two children taps "Homework marked for Ava", lands on the hub with whichever child was last picked (often Ben) and the Home tab.
  When the tutor marks written answers on a quiz (status `pending_marking` to `marked`), the family is never told. Also nothing for new quizzes/flashcards, and (see P2-3) nothing for in-class results.
- **Fix:** let `notifyFamilies` take an `href`; build `/custdash/learninghub?tab=homework&child=<childId>&open=hw:<id>` (one notice per child so the deep link is unambiguous, and the parent's mute still applies). Add a "Quiz marked" notice in the mark route. Needs the URL state from P1-1/P1-2.
- **Size:** S (server) plus the URL work.

### P1-5  "Show menu" inside a paper leaves a broken half-state, and a child switch silently discards the runner
- **Where:** `LearningHubApp.tsx:164-168` (`setFocusFor(null)` only), `TakeAssessment.tsx:147-152` (focus is set once on mount), `LearningHubApp.tsx` body gate `if (!ready) return <SkeletonRows/>`.
- **Verified [live] (`desk-05`, `desk-06`):** tap "Show menu" mid-quiz and the hero, tab strip and topic chips reappear ABOVE the still-open question; the focus bar never returns. Then switch child: the runner unmounts to skeleton cards with no warning (the attempt stays open on the server, and shows as "Resume" for the first child).
- **Fix:** while a paper or lesson is open, do not render "Show menu"; the paper's own X (which already confirms) is the exit. With P0-2 done this button goes away in kid mode; for the normal hub use a `Leave?` confirm before switching child while `focus` is on.
- **Size:** S.

### P1-6  The hub speaks to the child but its reader/owner is the parent; parents have no summary and no "Ask your tutor" action
- **Where:** `home/StudentHome.tsx:96-105` ("Hello, Ava. You have 2 flashcards…"), `progress/ProgressView.tsx` ("Your progress starts with the first quiz…"),
  `shared-assess/retake.tsx:45,54` and `TakeAssessment.tsx:82,237` ("Ask your tutor if you need another go") with no way to do it.
- **Problem [code + live]:** the tone suits a child, and there is nothing parent-shaped: no "this week Ava did 2 quizzes, one flagged", no
  weekly digest, no button to message the tutor (the portal has `/custdash/messages` but the hub never links to it).
  "Ask your tutor" (retake, year group, placement) is a dead end.
- **Fix:** a small parent strip on Home ("Ava this week: 2 quizzes, 1 homework in, focus: Fractions" from existing `/attempts`+`/mastery`), and a "Message {tutorName}" button
  (`/custdash/messages`) wherever "Ask your tutor" appears. Keep the child-voice content for kid mode.
- **Size:** S-M.

---

## P2 — polish

### P2-1  Adult jargon in child-facing screens
"Mastery snapshot", "Attainment", "Learning / Developing / Secure", "Placement test", "Awaiting marking", "baseline" (`home/StudentHome.tsx:154-170`, `progress/Attainment.tsx`, `shared-assess/StudentAssess.tsx` WELCOME copy is good).
Fix: in kid mode swap labels ("How I'm doing", "Getting there / Nearly there / Got it", "Marked by your tutor soon"). Size S.

### P2-2  Siblings in one live lesson cannot both be recorded present
`lessonsApi.ts:333-342`: a parent joins ONE child per join; the video identity is that child's first name and `attendance` is set for that child only.
Two children on one device have to leave and rejoin as the other (a second tab is a second participant with the same identity). Fix: allow `childIds:[a,b]` in the join body when the parent has both in the lesson and show both names on one tile ("Ava and Ben"), marking both present. Size M.

### P2-3  Tutor-run results are not surfaced to the parent as in-class
Attempts created by a tutor (existing API) carry `startedBy` = tutor and `parentUid` = parent, so the parent already sees them in Latest results, but nothing marks them "done in class" and there is no notification. See the design (add `mode`).

### P2-4  Retake unlimited plus reveal-after-submit lets a child farm the key
Defaults (`lib/hubConfig.ts:50,54`): `revealAnswers: "after_submit"`, `retakePolicy: "unlimited"`. A 3-question quiz can be re-sat until 100%, each attempt reads the key and feeds mastery. Not a bug, but worth a "Practice attempts don't raise mastery after the first pass" rule or a default of `cooldown`. Config decision for the owner. Size S.

### P2-5  Small text and touch sizes outside the runners
Runners measured [live]: option 60 px, buttons 44 px, question chips 44 px (good). Chrome labels are 10.5-12 px (`kit`/`homeKit` overlines, ScoreRing sub-labels), and the flashcard hints "1 Again 2 Hard" keyboard row is hidden on phones (fine). Sub-44 px targets: the lesson step bar buttons in preview only. Nothing blocking; a `text-[13px]` floor in kid mode is enough.

### P2-6  Stale local drafts
`hubdraft:<attemptId>` is never removed unless the attempt is submitted (`TakeAssessment.tsx:41-43`). Contains answers only; sweep entries older than 7 days on hub mount. Size S.

### P2-7  Hero child picker becomes a `<select>` above 4 children (`HubHero.tsx:82`)
Fine for adults, awkward for a child; irrelevant once kid mode hides it.

---

## What already works (verified)
- 390 px: `scrollWidth == innerWidth` on Home, quiz and lists; quiz answer buttons 332x60 [live].
- Quiz "X" leave modal ("Your answers are kept on this device"), 44 px controls, question jump chips, timer with auto hand-in [code].
- Flashcards: every rating saves immediately (`ReviewSession.tsx` `save`), so refresh/leave loses nothing; the session resets cleanly on child change [code].
- Server never sends the answer key inside a running attempt, and match/order shuffles are seeded per attempt so resume is stable [code: `attempts.ts` `questionOut`].
- Cross-family/child isolation returns 404, not 403 [code].

---

# Design: IN-PERSON mode ("Run in class")

Goal: a tutor runs a lesson or quiz on THEIR device with children beside them (no video call) and every child's answers land as a real,
marked attempt that shows in that child's parent Progress. Nothing here needs a child login.

## What the existing data model/API already gives us
| Piece | Already supports | Gap |
| --- | --- | --- |
| `POST /assessments/:id/attempts` (`attempts.ts:~115`) | A tutor may start for a student via body `childId` (`wantedChild = parsed.data.childId`). Optional `homeworkId`. Sets `startedBy=tutorUid`, `parentUid=child's parent`. | Same retake/diagnostic gates apply (409 `retake_blocked`, `diagnostic_required`); resumes any running attempt (could be the parent's own). No `mode`/`sessionId` on `AttemptDoc`. |
| `POST /attempts/:id/submit` | `loadAttempt` lets a tutor act on any in-scope attempt; server marks, `recomputeChildMastery`, `pingHub`. Result reveals the key to tutors (`canEdit`). | One request per child per quiz, not atomic; N mastery recomputes. |
| Parent visibility | `GET /attempts` filters by `parentUid`, so in-class attempts already appear for the right parent. | No "in class" badge; no notification. |
| Lessons (`hubLessons`, `lessonsApi.ts`) | `childIds`, `groupIds`, `noteIds`, `notes`, `status`, `attendance{childId: iso}`, `endedAt`, whiteboard `hubBoards`. Families notified on schedule/change/cancel. | Only video: no `mode`, join window/`ensureRoom` assumed, `attendance` is only ever set by a family joining (line 385), never by the tutor. |
| Warm-up (`lessonApi.ts` `warmup-check`) | Stateless instant check that reveals the key for tutors. Good for class discussion. | Records nothing (by design). |
| Groups (`hubGroups`, `activeMembers`) | Pick a class in one tap. | none |
| `LessonPlayer readOnly` | Tutor can walk the slides/steps as a presenter. | Its XP/streak header and "pupil" copy are single-child; no per-child capture. |

Conclusion: an MVP works with NO server change (N x start + N x submit from the tutor device). The proper version needs a small batch
endpoint, a `mode` field and tutor-settable attendance.

## Data flow

```
Tutor (Live lessons or Quiz/Lesson card)  -> "Run in class"
  1 create session   POST /lessons {mode:"in_person", childIds|groupIds, noteIds|quizId, startsAt:now, durationMins}
                     -> hubLessons doc, status "live", no room/no join window, families NOT emailed by default
  2 register         PUT  /lessons/:id {attendance:{childId: iso}}   (tutor ticks who is here)
  3 teach            LessonPlayer/SlideDeck in presenter mode; warm-up via existing warmup-check (class-level, nothing saved)
  4 capture (quiz)   GET  questions once via  POST /assessments/:id/class-start {lessonId, childIds}  (one snapshot + one shared shuffle seed)
                     client store: answers[childId][questionId]  (zustand + localStorage "hubclass:<lessonId>")
  5 hand in          POST /assessments/:id/class-submit {lessonId, homeworkId?, children:[{childId, answers:[{questionId,response}]}], override?:bool}
                     server, per child: create attempt (mode:"in_person", sessionId=lessonId, startedBy=submittedBy=tutorUid), mark, store;
                     recompute mastery once per child; one pingHub; notifyFamilies("Ava scored 80% on X in class").
                     returns [{childId, attemptId, status, pct, skipped?:{code:"retake_blocked"|"diagnostic_required"}}]
  6 close            PUT  /lessons/:id {status:"ended"} ; optional "Set homework for those under pass mark" -> existing POST /homework prefilled
```

New server surface (all tutor-only via `resolveCtx` + `requireEdit` + `canWriteRow`, same 404 rules):
1. `AttemptDoc.mode?: "self" | "in_person"` and `sessionId?: string|null` (additive; defaults keep every current reader working).
2. `hubLessons.mode?: "video" | "in_person"`; `windowOut`/`joinWindow` treat in-person as always open, never call `ensureRoom`; `attendance` writable by tutors for in-person (validate keys are in `childIds`).
3. `POST /assessments/:id/class-start` returns the shared question set with ONE shuffle seed = lessonId. Today `presentMatch/presentOrder` seed on `attemptId:questionId` (`attempts.ts:52-53`), so each child would see a different arrangement and one projected screen could not match them. The seed only affects presentation; marking reads canonical answers so it is safe.
4. `POST /assessments/:id/class-submit` as above. Rules: skip (not fail the batch) any child hitting a retake/diagnostic gate unless `override:true` from a tutor with edit rights; ignore children not in the lesson's `childIds`; idempotent per (`sessionId`,`childId`,`assessmentId`) so a double tap or retry does not create a second attempt. Size: M.
5. `notifyFamilies` for the result (uses P1-4 deep link).

## UI steps (tutor device, large type; reuse `features/learninghub/live/*` shell pieces and the `features/bookings` zustand pattern)
1. **Start**: new button "Run in class" beside "Schedule video lesson" (`LiveLessonsPanel.tsx`), and on Lesson/Quiz cards. Modal: pick group or children, pick lesson and/or quiz, Start. Then a **Register** screen: big avatar toggles (one per child, 64 px), "Everyone here" shortcut, saves `attendance`.
2. **Teach**: presenter view. Slides/steps full width, no XP/streak. Warm-up questions appear one at a time with **Show answer** (server check, key visible to tutor only). Under each question a compact "Who got it?" strip: per present child a tap-cycle chip (blank / correct / not yet) for oral work.
3. **Quiz (capture grid)**: one question per screen for the class; below it a **children x options grid** (choice/multi), or a small per-child text/number field (exact/numeric), or tap-to-mark for written/manual work. Next/Back through questions; a footer shows "5 of 6 have answered this". Answers are written to the store immediately and mirrored to `localStorage` (`hubclass:<lessonId>`), so a tutor refresh shows "Resume class session".
4. **Hand in**: one **Mark class** button, then a per-child result table (children x questions, green/red, %, needs-follow-up chip), plus class average and weakest topic. Skipped children (retake gate) listed with an "Allow anyway" action.
5. **Finish**: status `ended`; "Set homework for anyone under the pass mark" (prefills `POST /homework`); parents see the result under Latest results, tagged "In class".
6. **Privacy switch**: "Hide names on screen" (initials only) for projecting; never show one child's answers to the room unless the tutor turns it on.
7. **Exit / refresh**: X opens "Leave class session? Your answers are saved on this device"; refresh resumes from the local store; the lesson stays `live` until ended.

## Sizing
- MVP (no server change): tutor UI capture grid plus N sequential `start`+`submit` calls, surface 409s per child. **M**. Drawbacks: N requests, per-child shuffles, no "in class" marker, no notification.
- Proper: server batch, `mode`/`sessionId`, tutor attendance, shared seed, notify (**M**), plus the presenter/capture/result UI (**L**). Total about **L**.
- Kid mode (P0-2) and URL state (P1-1/P1-2) are shared foundations: the same runners serve "child on the parent's device" and, with a `presenter` flag, "tutor runs the class".

## Not verified / caveats
- The homework "Notes to read first" path is being rewritten by another agent (`StudentHomework.tsx` now has an `interactive` lesson button and `requestOpenLesson`); I did not re-test it. Whether it lands on the right child depends on P1-1.
- The homework and lesson screens for the seeded child were not screenshotted (my driver left the sibling selected after the child-switch test, and the API restarted twice during the run); those parts are from code.
- Live runs wrote throwaway data (children `Ava…`/`Ben…`, subject `Audit …`) to the standing e2e freelancer and parent accounts only; `npm run e2e` wipes it.
