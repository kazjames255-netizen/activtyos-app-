# T3 journal — group / camp teacher (HAF club, 15-25 children, tablet on a trolley, patchy Wi-Fi)

Method: walked through code only (no browser, no product changes). Taps count from the hub Home. "Unverified" = read, not run. Line numbers in `features/learninghub/` unless stated.

## Scenario 6 — Teach in person to a group of 6: register, quick quiz, record results (then 20 kids)
- **Goal:** register 6 children, run a 5-question quiz, get a score per child recorded.
- **Start:** Hub Home. "Teach in person / No video call" tile is in the Quick actions grid (home/TutorHome.tsx:185-189). It is the LAST tile, after 5 others. The same button also exists on Live lessons (LiveLessonsPanel.tsx:187).
- **Path and taps:**
  1. Tap the tile (1). A full-screen dialog opens, "Loading your students…" (InPersonApp.tsx:66).
  2. Setup page (SetupStep.tsx:104-177) is one long scroll: "Run a lesson with the children beside you", then 3 numbered sections. Section 1 "What are you teaching?" defaults to the "An interactive lesson" tab, so for a quiz I tap "A quiz or placement test" (2). There is a Subject select and 13 year buttons, "All years" through "Year 13", which I ignore. I search or scroll a radio list of quizzes, then tap one (3).
  3. Section 2 "Who's here?": tap a group chip (4) or each child. Groups exist so this is one tap.
  4. Section 3 "Also send this to the children's portals?" defaults to "No — just teach it here". Skip it.
  5. Tap "Start the lesson →" (5). The button says "lesson" even for a quiz. Next comes a Capture grid, one question at a time (CaptureGrid.tsx). Each row is a child name, A/B/C/D buttons and a tick/cross (:148-165). Per question: 6 taps for 6 children, plus "Everyone got it" (:84) as a shortcut. 5 questions is about 30 taps, or fewer with the shortcut.
  6. After Q5 tap "Mark the class →" (:105), then "Mark and record results" in the confirm dialog. The dialog warns "N answers aren't recorded — those score no marks" (:113).
  7. Results table shows every child x question with ticks and crosses, class average, and "hardest: question N" (ResultsPanel.tsx:38-58). Then "Finish session".
- **Total:** about 5 taps to start, about 35 to capture, 3 to record and finish. Roughly 45 taps. It is 4 screens. I read about 250 words on setup, then about 40 per question.
- **The register:** there is no register step. "Who's here?" is baked into setup (childIds required, :91). Attendance can be edited from the top-right "6 of 6 here" button (InPersonApp.tsx:173). Nothing says "Register" and no attendance record is kept for HAF reporting (unverified server-side: `attendance` is stored on the session, but I can't find an export).
- **Hesitations / dead ends:**
  - The default is "lesson", not "quiz". A quiz-only tutor lands on an empty-ish lesson list.
  - The lesson list is filtered to interactive lessons only. The empty text is "No interactive lessons found…" (:139).
  - If the quiz is not published it never shows. Only "No published quizzes found." appears.
  - The "Show answer (tutor only)" button is good, but the whole capture screen is a tutor screen, not a projected one. There is no way to show the question big to the room and capture separately.
- **Expected vs actual:** I expected a tick-list register, then "Start". I got a 3-section form with a long year filter. The capture grid itself is strong.
- **Confidence 3/5. Effort 3/5.**
- **The ONE change:** put a "Register" first step: a group's names as big tap-to-toggle chips, all ticked by default, with "Start" next to it. Remember the last quiz and group so a repeat session is 2 taps.

### Scale to 20 kids: what breaks
- The cap is `CLASS_MAX = 30` (server/src/routes/hub/inPersonApi.ts:56), so 20 is fine.
- Capture per question is 20 rows of 48px buttons with 4 options, so about 1,500 px of scroll per question. Each row has a 140px name and wraps. "Everyone got it" exists but there is no "Everyone the same answer" and no "All others right except…".
- 20 kids x 10 questions is 200+ taps unless "Everyone got it" is used. That defeats per-child data.
- Names are full names truncated at 112-140px. Two "Amir K…" is ambiguous.
- No sort or reorder, and no "jump to child". The nav is by question, never by child. A 20-row list that is answered "by child" (the paper-based reality) means scrolling up and down through 10 questions.
- The Results table gets Q1..Qn columns with `overflow-x-auto`. 20 rows x 10 columns is wide but works.
- If one child is added mid-quiz, "Someone else turned up?" works (InPersonApp.tsx:191-196).
- "Hide names" toggle is thoughtful for projection.

## Scenario 5 — Schedule a video lesson, run it, 0 of 8 connect, forgotten broadcast
- **Goal:** book a video lesson for 8 kids, run it, and end a broadcast I forgot about.
- **Start:** Live lessons tab has "Schedule video lesson" (LiveLessonsPanel.tsx:188). Home has the same tile. Path is about 4-6 taps plus the LessonForm (not walked in depth, unverified).
- **What "broadcast" is:** there are two things. (a) Scheduled video lesson (Lobby/Call). (b) "Start lesson now (remote)", a RemoteSync session that the children join from their portal (remotesync/). A forgotten "broadcast" is (b).
- **0 of 8 connect:**
  - The tutor banner (remotesync/TutorLiveBanner.tsx:29) says: `You're broadcasting “<title>” — 0 of 8 connected.` with one button, "Rejoin".
  - Nothing else. No "0 connected for 20 min, end it?". "Connected" means a child heartbeat in the last 30s (01c-data-truth.md:88).
- **Ending it:** there is no End. "Leave lesson" (remotesync/RemoteSyncApp.tsx:284-285) is styled as a red destructive button and testid `remote-sync-end`, but by design leaves the session live (:247). `endRemoteSync` (remotesync/api.ts:51) has no UI caller. The only end is the lazy 6-hour sweep (server remoteSyncApi.ts:66-76).
- **Effect on others:** children with the class in their portal keep seeing a "Resume"/join banner (JoinRemoteSyncBanner, polls every 8s) for up to 6 hours. If several were left live the banner shows "(+N more live)" but only `live[0]`.
- **Tap count to give up:** Rejoin (1) -> Lessons tab opens the lesson -> "Resume broadcasting" (2) -> Leave (3) -> banner is still there. It cannot be fixed by me. Dead end.
- **Expected vs actual:** expected End broadcast on the banner. Actual: a green "still broadcasting" strip that I cannot dismiss. I would ring support.
- **Confidence 1/5. Effort 5/5.**
- **The ONE change:** add "End broadcast" on TutorLiveBanner calling existing `endRemoteSync` with a confirm; the rest is optional.

## Scenario 4 — New child joins mid-week: get them into the group fast
- **Goal:** the child has just been registered by a parent/admin. I want them in "Group B" for tomorrow.
- **Path:** Students tab -> "Enrol a student" (StudentsPanel.tsx:431) -> EnrolModal searches `/api/children/lookup` by name/parent/postcode/ref (:158-170) -> pick -> choose subjects (chips) and year -> "Enrol student" (:196). That is about 6 taps. The group is NOT set here. Then the student card menu -> Edit -> group checkboxes -> Save (StudentsPanel.tsx:379-399), a further 4 taps, with several sequential PUTs and an undo on failure. Or "New group"/Edit group dialog to change members (GroupsSection.tsx:135).
- **Total:** about 10 taps across 2 modals. A child who does not exist in the system yet cannot be created here (lookup only lists existing children). Unverified: who creates the child record.
- **In the session:** if a session is already running, "Someone else turned up?" (InPersonApp.tsx:191) adds a rostered child in 3 taps, but only children already enrolled and active (`roster.filter(active)`). An unenrolled visitor is impossible on the day.
- **Hesitations:** Enrol modal forces me to choose subjects for a child who will only ever do the camp quiz. Not clear whether zero subjects is allowed.
- **Confidence 3/5. Effort 3/5.**
- **The ONE change:** "Group" picker in the Enrol modal (pre-set to the current group filter) so enrol + group is one save.

## Scenario 2 — Clear marking after the session
- **Goal:** everything marked, nothing owing.
- **What the in-person session leaves behind:** multiple choice / numeric / exact are marked server-side on "Mark the class". Anything written or "manual" shows `written to mark` on the Results row (ResultsPanel.tsx:88) and the attempt is `pending_marking`. Those wait in Quizzes -> Marking sub-tab (quiz/MarkingQueue.tsx), one child at a time (list row -> MarkForm -> save -> next). Home's Attention card jumps to it.
- **Homework (if "send to portals" = yes):** Homework -> Inbox -> "To mark" filter -> open each -> score/max/feedback with three canned lines ("Great work — well done!") (homework/MarkDialog.tsx:14) -> "Mark & next". Good for 6, painful for 20: about 4 taps + typing per child, no "same mark to all", no bulk approve.
- **Two places to clear** (Quizzes Marking and Homework Inbox) and two Home entry points. No single "all clear" state at the end of the session.
- **Confidence 3/5. Effort 4/5 at 20 kids.**
- **The ONE change:** on the in-person Results screen, list "N written answers still to mark" with a link that opens the Marking queue filtered to this session, with Next after each save.

## (a) Whole session on a tablet at 768px
- In-person is a `fixed inset-0` full-screen layer, `max-w-[820px]`/`900px` (InPersonApp.tsx:66, 148), so the hub chrome (drawer below 1024px, tab strip) is out of the way. The tap targets are 44-48px and it works at 768.
- Getting there: at 768 the portal is in drawer mode (inventory: `lg:` at 1024). Home Quick actions are 3 columns at `sm:` (TutorHome.tsx:176); "Teach in person" is the 6th tile, so likely on row 2 beneath the fold after the hero, 4 stat tiles and banner. About one scroll.
- Setup asks for scrolling through 13 year buttons (a wrapped row) before I reach the quiz list.
- The results table scrolls sideways at 10+ questions.
- Verdict: the session can be run at 768. The marking and enrolment afterwards are hub screens with 40-44px targets. OK but nothing is designed for the trolley.

## (b) Wi-Fi drops mid-session: what happens to captured answers
- **Captured taps are safe.** `useClassState` mirrors every cell to `localStorage["hubclass:<id>"]` (inperson/useClassState.ts:20-36). Refresh, tab closed, tablet asleep: state comes back, and the app jumps straight to Results if any results exist (InPersonApp.tsx:99). The Leave dialog says the same (:170).
- **Not safe / silent:**
  - The quiz paper (`getPaper`) is fetched on mount (CaptureGrid.tsx:38-42). Offline at that moment: "Couldn't load the quiz" + Back. No retry button. The lesson (`get notes/:id`) likewise: "Couldn't open that lesson".
  - "Mark the class" is one POST. Failure shows a red bar "Couldn't record the results — nothing was lost, try again" (InPersonApp.tsx:125). It is honest and the submit is idempotent (server "duplicate" status, inPersonApi.ts:358,395). But there is no auto retry, no "offline" indicator, and the confirm dialog closes (CaptureGrid.tsx:59-60), so the error appears above the grid, out of sight if scrolled down.
  - Attendance toggles are server PUTs; a failure only shows "Couldn't update who is here" and the toggle doesn't move.
  - Warm-up right/wrong tallies are only sent with Finish (`endSession`); local until then. If Finish fails: "Couldn't finish the session", stays open; localStorage kept.
  - Start: creating the session needs network. Idempotent key protects double-taps (InPersonApp.tsx:44-52).
  - localStorage blocked (private window): silently loses everything on refresh (:26).
- **Worst case:** tablet drops to no signal, I press "Mark and record", get an error, close the app thinking it went through. Parents see nothing and no reminder appears next day. The only nudge is "A session is still open" -> Resume in the Teach setup (SetupStep.tsx:118-131), which needs the tutor to open Teach in person again.
- **Confidence 3/5. Effort 2/5.**
- **The ONE change:** a visible "Saved on this tablet - N answers not yet recorded" banner and an automatic retry on reconnect; keep the confirm dialog open on failure.

## TOP 10 frictions
1. No End for a forgotten remote broadcast; banner says "0 of 8 connected" for up to 6 hours (TutorLiveBanner.tsx:29, RemoteSyncApp.tsx:247-285).
2. No register step; attendance hides in "Who's here?" with no record/export (SetupStep.tsx:153; InPersonApp.tsx:173).
3. Capture grid has no by-child mode and scrolls at 20 kids; only "Everyone got it" bulk (CaptureGrid.tsx:84, 121).
4. "Mark the class" failure is a page-top red bar, no retry, no offline state (InPersonApp.tsx:125; CaptureGrid.tsx:59).
5. Quiz/lesson paper fetch has no retry when Wi-Fi is down at the moment of opening (CaptureGrid.tsx:38-42).
6. Setup defaults to "An interactive lesson", plus 13 year buttons before the quiz list; button says "Start the lesson" for a quiz (SetupStep.tsx:71, 146, 183).
7. New child: enrol and group are separate flows (about 10 taps) (StudentsPanel.tsx:196, 379-399).
8. Written answers from a session land in a separate Marking queue, one child at a time, with no link from the Results screen (ResultsPanel.tsx:88; quiz/MarkingQueue.tsx).
9. Homework Marking has no bulk / "same mark for all" (homework/MarkDialog.tsx).
10. "Teach in person" is the 6th tile on Home, below hero/stat tiles at 768 (TutorHome.tsx:185); and "Leave lesson" styled as red "End" (RemoteSyncApp.tsx:284).

## TOP 5 keep
1. Local persistence of every tap (`hubclass:<session>`) and "Resume" for open sessions (useClassState.ts; SetupStep.tsx:118).
2. "Everyone got it", "Show answer (tutor only)" and "Hide names" on the capture screen.
3. Honest confirm dialog: "N answers aren't recorded — those score no marks" (CaptureGrid.tsx:113).
4. Results table with per-question ticks, class average, hardest question and "Set for the N under the pass mark" follow-up (ResultsPanel.tsx:38-58, 122-130).
5. Group quick-pick in setup, "Someone else turned up?" adder, idempotent start/submit, 44-48px targets.
