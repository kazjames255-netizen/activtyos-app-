# 09 - Engineer challenge of 06-proposals.md (v1)

Read-only review against the real code (24 Sep 2026). `LH/` = `features/learninghub/`, `SRV/` = `server/src/`. Effort: S under 2 h, M half a day, L a day or more, XL a rewrite.

## Verdict table

| P | Problem real? | Effort (lead -> engineer) | Verdict | Main risk |
|---|---|---|---|---|
| P-01 | Yes | S -> M | Do, with a changed expiry rule | 45 min idle can end a real lesson mid-flight; the child heartbeat resets the clock today |
| P-02 | Yes | S-M -> M | Do | Needs an additive server field; UI-only cannot give a true lesson count |
| P-03 | Yes | M -> M | Do | Kid mode "hidden routes" must not show in the tab strip (two specs assert that) |
| P-04 | Yes | S -> S (+ optional M) | Do | Shared fetch is a real refactor; error/Retry alone fixes the contradiction |
| P-05 | Yes | S -> S | Do | The developer string comes from `lib/api.ts` (outside the hub): classify in the hub, do not edit it |
| P-06 | Yes | M -> M | Do | Three e2e assertions on Home must keep their accessible names |
| P-07 | Partly (some done) | M -> L | Do, as 3 sub-commits inside one proposal | Tenant `--brand` is white-label, so "white on brand" cannot be proven for every tenant |
| P-08 | Yes | S -> S | Do | None. Tools becomes a Lessons sub-view under P-10, so the icon fix is moot then |
| P-09 | Yes, smaller than stated | S -> S | Do | Collapsed card must still fetch data for its summary line; stored `open:true` prefs override the new default |
| P-10 | Yes | M -> L | Do last, alias approach only | Breaks 3 specs; the shell (`LearningHubApp`/`HubTabs`) is the hottest file |
| P-11 | Yes | S-M -> S | Do (hubDoubts + liveAnswers only) | Irreversible deletion by design; owner should still glance at it |
| P-12 | Yes | M -> M | Do | None hard; server already supports `year` and `subject` on GET /notes |
| P-13 | Yes | S -> S | Do, but keep "Not quite" | Changing "Not quite" breaks 6 e2e assertions and is already the kind wording |

## Hard-rule check

No proposal breaks a hard rule outright. Items that need a line in `11-open-questions.md`:
- P-02 adds fields to the `GET /notes/counts` response (additive, backwards compatible). Document.
- P-11 changes what the erase/export functions remove/return (`SRV/lib/hubPrivacy.ts` only; `routes/privacy.ts` and `routes/my.ts` untouched). New export key `learningDoubts`. Not schema, but it is privacy behaviour: document for owner review. Do NOT touch the notifications collection or `/api/privacy` summary in this pass (outside the hub module).
- P-01: do not add a new `tutorAt` doc field. Use the existing fields (see recipe). If a builder adds one anyway it becomes an additive schema change and must be documented.
- P-07: keep every token change inside `HubStyles` in `LH/kit.tsx` (scoped to `#learning-hub`). Editing `app/globals.css` would be outside the module.
- P-05: do not edit `lib/api.ts`.
- P-09: conflicts with an earlier owner instruction (already logged); one-line reversible.
- Hard rule 6 (net burden): P-10 removes 2 tabs and adds 2 segmented controls; net down, passes. P-06 and P-12 add a Today block and a first-run guide; they must remove the stat tiles / only show at zero data, as proposed.
- Hard rule 4 (nothing ships broken): P-10 and P-13 must update the specs listed below in the SAME commit.

## Per-proposal findings

### P-01 End a forgotten broadcast
- Verified. `LH/remotesync/TutorLiveBanner.tsx:14-38` has only "Rejoin". `endRemoteSync` is defined at `LH/remotesync/api.ts:51` and never called. Server `POST /remote-sync/sessions/:id/end` exists (`SRV/routes/hub/remoteSyncApi.ts:283-295`, requires edit, pings `hubLessons`).
- Expiry: `STALE_MS = 6h` at `remoteSyncApi.ts:66`, swept lazily at `:223` (tutor list) and `:313` (family /active).
- Why 6 h never fires: `updatedAt` is bumped by the child heartbeat (`:328`) and by child live answers (`:374`) as well as tutor writes (`:242` progress, `:277` students/rejoin). One open child tab keeps a dead lesson alive forever.
- Child banner already hides when not live: `/active` only queries `status==="live"` (`:311`) and `JoinRemoteSyncBanner.tsx:56-60` filters `status==="live"`. So "child banner hides when ended" needs no work; the fix is making the row actually end.
- Changed rule: remove `updatedAt: now` from the heartbeat (`:328`) and live-answer (`:374`) writes (they already record `attendance.<id>` / `liveAnswers.<id>.updatedAt`), so `updatedAt` means "tutor activity". Then set STALE to 90 min, not 45. Reason: in own-pace lessons a tutor may sit on one step for a long time watching mini-screens; the sweep would flip the row to ended and every child's next heartbeat returns 409 `lesson_closed` ("Your tutor has ended this lesson"). With End on the banner the expiry is only a backstop. 45 min is defensible only with the heartbeat change AND if the tutor's progress pings are frequent; recommend 60-90 min and record the choice.
- Server restart: `SRV/routes/hub/remoteSyncApi.ts` is a server file, so `tsx watch` restarts the API (about 1 min of cold caches). Batch with P-02 and P-11 server edits.
- Tests: no e2e or selftest references STALE or the banner test ids. `learning-hub-teaching-ui.spec.ts:475-503` covers "End lesson"/"Rejoin lesson" for video lessons (a different feature), keep untouched. Add e2e for the new button only if time.
- readOnly staff: the tutor sessions route calls `requireEdit`, so view-only staff never receive sessions and never see the banner. Still pass nothing extra.
- Kid mode: banner is tutor only. Child side unchanged.

### P-02 Numbers that agree
- Verified. `LH/HubHero.tsx:148-160` renders Subjects (`subjectsOf(topics)`), Lessons (`noteStats.total`), Worksheets (`files`), Students. `SRV/routes/learningHub.ts:591-614` counts every visible note (`total++` with no `isLesson`/`kind`/`oakKey` test) and sums attachments.
- The hero already has a Hide/Show toggle (`HubHero.tsx:54-58`, key `aos.hero.learninghub`, default open). "Collapsed by default" is a one-line default change plus a one-line summary; users who ever clicked Show have `"1"` stored, so bump the key to `.v2`.
- Cannot be done UI-only: the notes list is not on the client. Add additive fields to `/notes/counts`: `lessons` (published-or-visible `isLesson || oakKey`, `kind !== "board"`, same rule as `curriculumApi.ts:63`) and `lessonTopicIds` (or `lessonsBySubject`). `NoteRow` already carries `isLesson`, `kind`, `oakKey` (`SRV/lib/hubIndex.ts:104-115`), so **no noteIndex change and no `SNAPSHOT_VERSION` bump** (`SRV/lib/hubCache.ts:36` stays `.v2`). If a builder instead adds a field to `NoteRow`, they MUST bump `SNAPSHOT_VERSION.notes` to `.v3` or the old disk snapshot will serve rows without the field.
- Keep `total`, `drafts`, `files`, `fresh`, `byTopic` exactly as they are: `TopicFilter` (sidebar badges) and the tutor Lessons tab use them.
- Client: `LH/types.ts:62` `NoteStats` gets optional `lessons?`/`lessonTopicIds?` (optional so an old cached response does not crash). Header "Subjects" = distinct subjects of `lessonTopicIds`.
- Note the counts call is scoped by the Lessons year filter (`useHubData.ts:35,96`): header changes when a year is picked. Summary line should say "for Year N" or ignore the year (use a separate unscoped call is not needed; accept it and label).
- Restart: server file edit.
- Tests: no spec asserts "PDFs and images", "enrolled and active" or the tiles. `hubSelfTest*.ts` are pure maths; none affected. Extract the lesson-count predicate to a pure function in `SRV/lib/hubRules.ts` and add 3 assertions to `hubSelfTest.ts` (optional).
- Kid mode: hero is not rendered in kid mode. Parent: hero shows "Learning as <child>"; keep it.

### P-03 Child Home
- Verified in `LH/home/StudentHome.tsx`: blocks in order are parent summary (:105), part errors (:119), greeting hero with attainment ring + streak + next lesson (:124-153), flashcards + homework (:156-205), latest results + mastery (:208-248), "Keep going" last (:251-268).
- Dead controls: "See progress" (`:243`, `go("dashboard")`) and the Join/Start in `NextLessonHero` (`:150`, `go("live")`). In `LearningHubApp.tsx:105` `active = kid && !KID_TABS.includes(wanted) ? "home" : wanted`, and `KID_TABS` (`LH/family/KidMode.tsx:15`) has neither `dashboard` nor `live`, so both bounce to Home.
- Do NOT add `live`/`dashboard` to `KID_TABS`: the tab strip is built from `KID_TABS` (`LearningHubApp.tsx:177`) and `learning-hub-family-hat.spec.ts:217-221` and `learning-hub-g2-child-parent.spec.ts:209-210` and `learning-hub-oak-journey.spec.ts:482` assert a kid does not see Progress/Live lessons. Add a second constant `KID_HIDDEN_TABS = ["live","dashboard"]`, allow them in the `active` guard only, keep them out of the strip, and render a visible "Back" button (child has no tab to click back).
- Open questions for the builder: the family branch of `LiveLessonsPanel` runs under `CallProvider` and may open full-screen layers with a z-index below kid mode's `z-[320]`; the remote-sync join already works on kid Home via `JoinRemoteSyncBanner` (:104), so consider limiting kid "Join lesson" to that banner and leaving the video-call join out. Also the Progress panel for a family may expose tutor-ish detail; the proposal says kid wording: use `Attainment` + topic list, not the full `ProgressPanel`, if it shows anything a child should not see.
- All data already loaded by `useStudentHome` (`home/useHomeData.ts`): reordering costs no new fetches. Kid hero next-step order: homework due -> cards due -> next lesson, then the rest.
- Tests that touch this file: `learning-hub-home.spec.ts:160` (heading `${childName}.`), `:163` (button named `${hwTitle}. Due`), `:164` (result ring `${quizTitle}: 100 percent`), `:168` ("Review flashcards now"), `:170-171` ("See progress" -> Progress tab, PARENT mode: keep parent behaviour), `:181-186` (empty states "No results yet", "Mastery builds with every quiz", "Start a streak today"), `learning-hub-family-hat.spec.ts:334` (`hub-parent-summary`), `:202,333` (Home for child). Keep those strings/roles or update the spec.
- Deep links: none change. `?tab=home&child=` unchanged.

### P-04 One truth for homework
- Verified. `LH/homework/StudentHomework.tsx:41-43`: `.catch` sets `list` to `[]` and calls `onError`; `:60-62` renders "No homework right now" for `list.length===0`. Home says "due soon" for `urgent` which includes overdue (`StudentHome.tsx:54,98`).
- Fix: keep `list` null on failure and track `failed`; render `Notice`/`PartError` + Retry (`home/homeKit.tsx:126` has `PartError`); never the empty state on failure. Overdue vs due-soon wording is a copy change in `StudentHome.tsx:98` ("N due soon" / "N overdue").
- Shared fetch: `useStudentHome` and `StudentHomework` both call `GET /homework?childId=`. A module-level cache keyed by `path` with a 10 s TTL plus the existing `useRealtime(["hubHomework","hubSubmissions"])` invalidation is enough (M). Not required to fix the contradiction; mark optional.
- Tests: `learning-hub-family-hat.spec.ts:302` opens `?tab=homework&open=hw:<id>`; keep `useLinkOpen("hw")` behaviour.

### P-05 Friendly errors
- Verified. The strings are built in `lib/api.ts:130-131` and shown raw by `ErrorBanner` (`LH/kit.tsx:382-390`), mounted once at `LearningHubApp.tsx:236`. 44 `onError(` call sites feed the same banner. The gate screen already has the offline regexp at `LearningHubApp.tsx:158`; reuse it.
- Recipe: put `friendlyError(message)` (pure, exported, regexp `/reach the server|didn't respond within|Is the API running/i`) in `LH/kit.tsx` or a new `LH/errorCopy.ts`; `ErrorBanner` shows the friendly line + "Try again" (calls `refresh` passed from the shell) and a "Details" toggle only when `canEdit` (tutor). `home/homeKit.tsx PartError` has its own `message`: apply the same helper.
- Tests: none assert the banner text.
- Kid/parent: they never see the URL.

### P-06 Tutor Home = Today
- Verified. `LH/home/TutorHome.tsx`: hero + attention card (:159-175), quick actions (:177-190), snapshot + callouts (:193-196), feed + rhythm (:198-220). "Overdue homework" and "Homework to mark" both `go("homework")` (:168,171); nudge rows call `onGo("homework")` (`ClassSnapshot.tsx:163`) with no student.
- `setHubIntent({kind:"homework", groupId:"", childIds:[id]})` already exists and `TutorHomework.tsx:54` consumes it and opens the form with those students ticked: nudge -> pre-selected form is a few lines (`Callouts` needs the child id passed up: change `onGo` to accept `(k, childId?)`).
- Overdue list: `TutorHomework` has filter state `"submitted"|"marked"|"assigned"|"all"` (line 45). Add a one-shot in `LH/hubIntent.ts` (like `takeOpenStudent`) `requestHomeworkFilter("assigned")`, or a real "Overdue" filter chip. Keep it small.
- The hero stat tiles above content are in `HubHero` (Home only, full mode), so "stats collapsed" is P-02's default flip, not a TutorHome edit.
- Tests: `learning-hub-home.spec.ts:129-131` (`#hub-home-tutor`, heading "Needs your attention", button "Homework to mark"), `:136` (Recent activity card), `:139-141` (Weekly rhythm img + "Show as table"), `:144-149` (quick action buttons named "Assign homework Set the next task" and "Schedule video lesson Pick a time"), and the class snapshot img name (`:134`). Keep these names, or update them in the same commit.
- Known data bug worth folding in (S): Home's attempts call has no `?status=pending_marking`, so the "written answers" count under-reports past 300 attempts (`SRV/routes/hub/attempts.ts:397`); pass the filter in `home/useHomeData.ts:73-80`.
- readOnly staff: quick actions are already hidden with `!props.readOnly`; "Set homework" button must follow suit.

### P-07 Accessibility
- Partly done already: `LH/kit.tsx:99-101` overrides `--ink-3` to `#6b6788` and adds `--hub-green-ink/fill`, `--hub-red-ink`, scoped to `#learning-hub`. Remaining work is in scope of that block only.
- Verified gaps: `HubTabs.tsx` selects tabs but nothing moves focus to the panel or updates `document.title` (no `document.title` write anywhere in the hub); `LearningHubApp.tsx:249-253` gives the panel `tabIndex={-1}` but never focuses it. Escape: `kit.tsx:316,364,433`, `teachKit.tsx:202,361` call `stopPropagation`, while `AreaDrawer.tsx:60`, `YearGroupPicker.tsx:40`, `ToolHost.tsx:41` use window listeners without a stack, so nested layers can all close. `curriculum/CurriculumCard.tsx:127-129` has `role="tablist"`/`role="tab"` buttons with no `tabpanel`, no roving tabindex, no arrow keys. Skeleton already has `role="status" aria-busy` (`kit.tsx:200`); the child switcher (`HubHero.tsx` `role="radiogroup"`) and topic filter skeletons need it.
- Effort is L, not M. Split into three commits inside the one proposal: (a) tokens in `HubStyles` (`--gold` text, control borders 3:1, white-on-status pairs), (b) focus + title on tab change + Escape layer stack (one `useEscapeLayer` in `kit.tsx`), (c) tablist ARIA and skeleton semantics.
- Caveat: `--brand` is per-tenant, so any white-on-brand text (`HubTabs` active pill, `BigButton`) is only as accessible as the tenant colour. Fix what the hub controls; note the rest.
- Risk: moving focus on tab change must not steal focus while a user is arrowing through tabs (`HubTabs.onKey` calls `onSelect` then focuses the tab button). Move focus to the panel only on click/Enter, not on arrow-key roving.
- Tests: `learning-hub.spec.ts:128-147` (roving tabindex, End key) and every spec that clicks by role are sensitive to tab semantics; run the whole hub suite. Kid mode inherits the same tokens.

### P-08 Tools honest
- Verified `LH/tools/ToolsPanel.tsx:51` `readyOnly` defaults false; `BADGE` at :18. Change default to true and render a "What's coming (N)" fold below the grid for the rest. `PANEL_ICON` (`kit.tsx:77`) has no `tools` key (falls back to `sparkle`).
- Restart: NONE. The server only imports `tools/problems.ts` and its imports (`maths/geometry/{generators,model,checkers}`, `engine/geometry`) and `lesson/{types,plan,slides/types}`. `ToolsPanel.tsx` is not in that graph. Avoid editing those files anywhere in this redesign.
- Tests: no spec asserts on tool tiles or "Ready to use only".
- Note: `logToolEvent` demand counting for unreleased tools must still work from the fold.

### P-09 Curriculum map out of the way
- Verified, and smaller than described: `LH/curriculum/CurriculumCard.tsx:61` `open = pref.open !== false` (default open), the header button is already the collapse control and already prints the summary line (:97-100 area). Changes: default `pref.open === true`; bump `LS` key to `hub.curriculum.v2` (stored `open:true` from earlier visits would otherwise stay open); the fetch effect at :75 `if (open) return load()` must also run when collapsed or the summary line stays empty; child summary already exists (`childSummary`, `kid` at :82).
- Cost check: one extra curriculum-map request (`getMap`, `LH/curriculum/api.ts`) per Lessons visit when collapsed. Acceptable (server computes from the cached noteIndex).
- Update the stale comment "the first thing on the Lessons tab" in `NotesPanel.tsx:645`.
- Tests: no e2e references the card (`grep curriculum e2e` is empty).

### P-10 Tabs 11 -> 9
- Verified: `panels.tsx:31` TAB_ORDER; `HubTabs` clips at narrow widths.
- Recommended mechanism (keeps every URL working): keep `diagnostic` and `tools` as valid internal tab keys, but for tutors and parents do not list them in the strip. In `LearningHubApp.tsx` build `tabs` without them, pass `HubTabs active={alias(active)}` where `alias(diagnostic)=quizzes`, `alias(tools)=notes`, and render a two-option segmented control above the panel ("Quizzes | Starting quizzes", "Lessons | Tools"). Selecting an option calls `go("diagnostic")` etc. So `?tab=diagnostic`, `?tab=tools`, `goTo("diagnostic")` (`shared-assess/StudentAssess.tsx:49,147`), notification links and `family/link.ts` params all keep working with no redirect map. Panel ids: `HubTabs` uses `aria-controls=hub-tabpanel-${key}`; pass the aliased key consistently or the `aria-labelledby` breaks.
- `NotesPanel` stays mounted (hidden) unless `active==="notes"`: when the user switches Lessons -> Tools the hidden notes panel keeps unsaved drafts (`dirty` "Unsaved" badge logic keys on `m.meta.key === "notes"`). Good; keep.
- Kid mode: keep the kid "Starting quiz" tab (specs require it: `learning-hub-g2-child-parent.spec.ts:209`, `learning-hub-family-hat.spec.ts:219-220`). Fold only for tutor and parent.
- `chips`/`sidebar` layout switches (`LearningHubApp.tsx:185-186`) key on `active` and continue to work unchanged.
- Rename "Student message centre" -> "Messages": `LH/QuestionsPanel.tsx:21` meta label; also drop the special case at `LearningHubApp.tsx:178-179` and the comment. No spec references the old name.
- Single verb "Set homework": careful. `TutorHomework.tsx:126` has a Segmented option labelled "Set homework" that means "the assignments list", and 4 specs click it as a tab. Do NOT rename it. Rename the Home quick action "Assign homework" only together with `learning-hub-home.spec.ts:144`.
- Specs that break and the change:
  1. `e2e/learning-hub.spec.ts:138-140` loops `[role="tab"][data-panel="diagnostic"]` visible -> remove `diagnostic` (and `tools`) from that list for tutor mode; add an assertion for the segmented control.
  2. `e2e/learning-hub-quizzes-ui.spec.ts:338` `openParentHub(page, /Placement test/)` (parent, non-kid) -> open with `/Quizzes/` then click the "Starting quizzes" segment (or `page.goto("?tab=diagnostic")`).
  3. `e2e/learning-hub.spec.ts:143-146` presses End and expects Flashcards selected, but the last tab today is `questions`: this assertion looks already stale. Run the baseline before P-10; if it fails today, fix it in P-10 (End -> Messages) and note it.
  4. Tab-count based: `learning-hub-home.spec.ts:126` reads the first tab only (safe). `learning-hub-teaching-ui.spec.ts:354,420` count tabs in the LIVE workspace, not the hub strip (safe).
  Kid specs (`family-hat:217-221`, `g2:209-211`, `oak-journey:482`) are unaffected because kid keeps its own list.
- Effort L: shell rewrite + 3 spec edits + manual phone/desktop check.

### P-11 Safeguarding
- Verified `SRV/lib/hubPrivacy.ts`: `eraseChildLearning` clears `hubEnrolments, hubSubmissions, hubFlashcardReviews, hubAttempts, hubMastery` (:88), lessons attendance (:91-97), groups, invites, boards, tool states, homework. It does NOT clear `hubDoubts` (child text; docs carry `childId` and `messages[]`, `doubtsApi.ts:20-28`) or `liveAnswers.<childId>` on `hubLessons` (`remoteSyncApi.ts:96,374`). `exportChildLearning` (:23-58) omits both.
- Recipe: export: `byChildren("hubDoubts", childIds)` -> `learningDoubts` (allow-list: id, tenantId, lessonTitle, childId, messages with from/text/at, createdAt). Erase: add `"hubDoubts"` to the loop at :88 (it queries `where childId == x`, already matching); in the existing `hubLessons` update (:94) add `[`liveAnswers.${childId}`]: FieldValue.delete()`. Existing doc field is `childId` so no index change (single-field equality).
- Also delete a child's own text from doubt threads written by the tutor? Deleting the whole thread with the child is the simple, safe reading.
- Not for tonight (outside hub / larger): notifications collection, board images in the `images` collection beyond submissions, `/api/privacy` summary counts (`routes/privacy.ts`), acting-as stamping.
- Restart: server file. Tests: `learning-hub-teaching.spec.ts:475-505` exercises export + delete; adding a key does not break `toHaveProperty` checks. Add a doubt for child2 to that spec and assert both endpoints (recommended).
- Safe to run twice (queries, not counters).

### P-12 First-run
- Verified no zero-data guide exists; `ClassSnapshot.tsx:77` only shows "Enrol a student" inside an empty card. The homework lesson picker `LH/homework/hwPickers.tsx:67-100` (`NoteChecklist`) is search-only.
- Server already supports it: `GET /notes` accepts `subject` and `year` (`SRV/routes/learningHub.ts:537-553`) and `Student.yearGroup` exists (`LH/types.ts:81`). No backend work.
- Recipe: (a) `TutorHome`: when `students.length===0 && !failed`, render a 3-step card (Add a student -> Pick a lesson -> Set homework) above the rest; each step is a button using `go()`; hide the attention/snapshot cards that show zeros. (b) `NoteChecklist` gets Year and Subject selects; default year = the selected students' year (`HomeworkForm` knows `childIds`).
- Tests: `learning-hub.spec.ts` and the home spec always run with enrolled students, so unaffected; the picker's `id="hub-hw-note-search"` and checkbox labels are used by assign-lesson specs: keep them.

### P-13 Kind child language
- Verified strings: `homework/hwTypes.ts:44` "Overdue"/"Overdue by N days"; `homework/StudentHomework.tsx:190` "Handed in late"; `home/StudentHome.tsx:306` chip "Not yet"; `shared-assess/ResultView.tsx:126` "N points short of the X% pass mark"; `ResultView.tsx:194` per-answer "Not quite".
- `dueState` is shared with tutor and live-workspace code (`TutorHomework.tsx:153`, `live/workspace/*`), so add an optional `kid` argument (default false) instead of changing the strings. Get `kid` from `useFamily().kid` (`family/FamilyContext.tsx`); the results and homework screens already have it or can import it.
- Keep "Not quite": it is already the gentle form and six e2e assertions expect it (`learning-hub-kinds.spec.ts:422,423,437`, `learning-hub-lessons.spec.ts:329`, `learning-hub-oak-journey.spec.ts:502`, `learning-hub-family-hat.spec.ts:243` which is the ParentGate). P-13 scope should be Overdue, Handed in late, "points short", percentages/pass-mark arithmetic in kid mode.
- Kid-only means `family.kid`; a parent viewing the same child keeps factual wording.
- No i18n layer exists in the hub (roadmap R-10): British English strings inline.

## Cross-cutting

- Deep links and routes: only P-10 touches routing. With the alias approach nothing needs redirecting. Never change `TabKey` values or `TAB_ORDER` membership; hide, do not remove.
- Realtime: P-01 keeps `useRealtime(["hubLessons"])`; P-04 shared cache must still invalidate on `hubHomework`/`hubSubmissions`; P-06 keeps the 350 ms refetch in `useHomeData.ts:16`.
- Caches: no proposal changes what `noteIndex` stores if P-02 uses the additive-counts route (no `SNAPSHOT_VERSION` bump). `/notes/counts` itself is uncached beyond the index.
- Server restarts: P-01, P-02, P-11 edit server files (restart, about 1 min cold). Nothing edits `tools/problems.ts`, `tools/maths/geometry/*`, `tools/engine/geometry.ts`, `lesson/types.ts`, `lesson/plan.ts`, `lesson/slides/types.ts`: keep it so. Do all three server edits in one window, then run the smoke.
- Kid mode / parent / readOnly: P-03, P-04, P-13 are kid-visible; P-10 keeps kid tabs; P-01, P-06, P-12 are tutor-only and must honour `readOnly`.
- i18n: none in the hub; no keys to update.
- Pre-existing risk: `learning-hub.spec.ts:143` (End -> Flashcards) looks stale today. Run `npx playwright test e2e/learning-hub*.spec.ts` on the untouched branch first to get a baseline so builders do not "fix" a test that already fails.
