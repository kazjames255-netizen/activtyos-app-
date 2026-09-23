# 06b - Implementation notes (recipes and builder split)

Companion to `06-proposals.md` and `09-challenges/engineer.md` (read that for the evidence and risks). `LH/` = `features/learninghub/`, `SRV/` = `server/src/`.

## Rules for every builder
1. Branch `teaching-hub-redesign`. One proposal = one commit, message starts `hub:`. Sub-commits are fine inside P-07, but squash-friendly and each green.
2. Before each commit: `npx tsc --noEmit` (root and `server/`), lint, `cd server && npx tsx src/hubSelfTest.ts` (and 2/3/4), and the Playwright specs named in the recipe at phone (390 px) and desktop (1280 px). If it cannot be made green, revert it and record why.
3. Baseline first: run `npx playwright test e2e/learning-hub*.spec.ts` on the untouched branch and save the failures. `learning-hub.spec.ts:143` (End -> Flashcards) looks stale.
4. Never edit: `lib/api.ts`, `app/globals.css`, `routes/privacy.ts`, `routes/my.ts`, auth, payments, schema. Never edit these (they restart the API and are not needed): `LH/tools/problems.ts`, `LH/tools/maths/geometry/*`, `LH/tools/engine/geometry.ts`, `LH/lesson/types.ts`, `LH/lesson/plan.ts`, `LH/lesson/slides/types.ts`.
5. Keep old components in place; no deletions (final clean-up commit is separate).
6. Use seeded/test tenants only. Never run against an impersonated real account.
7. Server edits (P-01, P-02, P-11) restart `tsx watch`: wait about 1 minute (hub caches warm again from the disk snapshot `aos-hub-cache.notes.v2.<tenant>.json`) before running e2e.
8. British English. No emojis in code or copy unless the file already uses them.

## Recipes

### P-01 End a forgotten broadcast (M) - Builder B
Files: `SRV/routes/hub/remoteSyncApi.ts`, `LH/remotesync/TutorLiveBanner.tsx` (calls `endRemoteSync` from `LH/remotesync/api.ts:51`, no change there).
1. Server: change `STALE_MS` (:66) from 6 h to 90 min (brief said 45; use 60-90 and write the choice in the code comment and `11-open-questions.md`; see engineer.md).
2. Server: remove `updatedAt: now` from the child heartbeat update (:328) and the child live-answer update (:374). Keep `attendance.<id>` and `liveAnswers.<id>.updatedAt`. Tutor writes (:242 progress, :277 students, create :196, end :290) keep bumping `updatedAt`. Update the comment above `STALE_MS`.
3. UI: in `TutorLiveBanner`, add an "End lesson" button next to Rejoin. One-tap confirm: first tap turns it into "Tap again to end for everyone" (5 s), second calls `endRemoteSync(qs, s.id)` then `poll()`. Disable while pending; show a friendly error if it fails. Use `FOCUS` ring, min height 44.
4. Gotchas: the banner is mounted twice (Home `TutorHome.tsx:151`, Lessons `NotesPanel.tsx:644`); nothing else to change. `useRealtime(["hubLessons"])` already refreshes both after `/end` pings. Child side needs no change (`/active` and `JoinRemoteSyncBanner` already drop non-live rows; a child mid-lesson gets 409 `lesson_closed` from heartbeat, already handled).
5. Verify: start a remote session as the seeded tutor, see the banner, End, banner disappears on Home and Lessons, child banner disappears within 8 s.

### P-02 Numbers that agree (M) - Builder B
Files: `SRV/routes/learningHub.ts` (`/notes/counts` :591), `LH/types.ts` (`NoteStats`), `LH/HubHero.tsx`.
1. Server: in the loop at :604-611 also compute `lessons` (count where `n.published || ctx.canEdit` already passes and `(n.isLesson || n.oakKey) && n.kind !== "board"`) and `lessonTopicIds` (Set -> array). Do not change existing fields. No `NoteRow` change, so no `SNAPSHOT_VERSION` bump.
2. Types: add `lessons?: number; lessonTopicIds?: string[]` to `NoteStats` (optional).
3. HubHero: Lessons tile value = `noteStats.lessons ?? noteStats.total`; Subjects = distinct `subject` of topics whose id is in `lessonTopicIds` (fallback to old logic when absent). Remove the Subjects sub-line "N topics" and the Worksheets tile; keep Students (tutor) / Learning as (family). Grid `lg:grid-cols-4` becomes 3.
4. Collapsed by default: `useState(false)` and key `aos.hero.learninghub.v2`; when collapsed show the one-line summary in the bar: `${activeStudents} students · ${lessons} lessons · ${subjects} subjects` (tutor) . Keep the Hide/Show button, rename to "Show numbers"/"Hide numbers".
5. Gotchas: the counts call is scoped by the Lessons year filter (`useHubData.ts:35,96`), so the header number moves when a year is picked; label it "for Year N" when a filter is active or accept and note it. `byTopic`, `total`, `drafts`, `fresh` must stay (TopicFilter).
6. Optional: extract the predicate to `SRV/lib/hubRules.ts` and assert it in `hubSelfTest.ts`.

### P-03 Child Home answers "what do I do now?" (M) - Builder D (last commit needs Builder A's shell to have landed)
Files: `LH/home/StudentHome.tsx`, `LH/family/KidMode.tsx`, `LH/LearningHubApp.tsx` (one line; see gotcha), maybe `LH/home/NextLesson.tsx` (do not edit; pass a different `onGo`).
1. In `StudentHomeFor`, compute one "next step": homework overdue/soon first (`d.todo[0]`), then flashcards due (`dueCards>0`), then next lesson (`d.upcoming[0]`), then `d.step` (existing). Render it first as a single large card with one `BigButton`.
2. Below it a short list (homework, flashcards, next lesson, last result) using the existing `Card`s; move greeting/streak/attainment lower or collapse. Keep the mastery card, but the "How I'm doing" ring must keep its existing strings for the specs.
3. Kid mode only: add `export const KID_HIDDEN_TABS = ["live","dashboard"] as const` in `KidMode.tsx`. In `LearningHubApp.tsx:105` change the guard to allow `KID_TABS` plus `KID_HIDDEN_TABS`, leaving the tab strip source (`:177`) on `KID_TABS` only. Show a "Back" button at the top of the panel when a kid is on a hidden tab (calls `go("home")`).
4. "Join lesson" in kid mode: prefer the remote-sync banner that already sits on kid Home (`JoinRemoteSyncBanner`); for a video lesson go to the hidden `live` tab. Test that the family `LiveLessonsPanel` renders under the kid layer (z-index `z-[320]`) before shipping; if not, limit to the banner and hide the dead button.
5. "See progress" in kid mode: go to hidden `dashboard`, but only if the panel is child-safe. If it is not, render `Attainment` + the topic list in a small kid view instead. Parent mode keeps `go("dashboard")` (spec `learning-hub-home.spec.ts:170-171`).
6. Parent Home: put an on-track/overdue verdict line at the top of `hub-parent-summary` (data already present).
7. Keep strings the specs read: heading `${name}.`, button `${hwTitle}. Due...`, "Review flashcards now", result ring names, "No results yet", "Mastery builds with every quiz", "Start a streak today", `hub-parent-summary`.
8. Verify with specs: `learning-hub-home.spec.ts`, `learning-hub-family-hat.spec.ts`, `learning-hub-g2-child-parent.spec.ts`, `learning-hub-oak-journey.spec.ts` (kid tabs assertion). Phone width, kid mode.

### P-04 One truth for homework (S) - Builder D
Files: `LH/homework/StudentHomework.tsx`, `LH/home/StudentHome.tsx` (copy line :98), optional `LH/home/useHomeData.ts`.
1. In `load`, on failure keep `list` at `null` and set a `failed` message state; render `PartError`-style notice with a Retry button (reuse `PartError` from `home/homeKit.tsx`, import only) instead of the empty state. Only render "No homework right now" after a successful empty response.
2. `StudentHome.tsx:98` lead text: split `urgent` into overdue and soon: "N overdue" / "N due soon".
3. Optional: module-level 10 s cache keyed by request path shared by Home and the tab, invalidated by `useRealtime(["hubHomework","hubSubmissions"])`.
4. Gotcha: the tutor previewing the child view gets the tutor-shaped list; keep the existing guard for that (`homeworkApi.ts:212-226`).

### P-05 Friendly errors (S) - Builder A
Files: `LH/kit.tsx` (`ErrorBanner` :382), `LH/LearningHubApp.tsx` (:236 pass `onRetry={refresh}`, `details={canEdit}`), `LH/home/homeKit.tsx` `PartError` (optional; Builder C owns homeKit, so make this a follow-up or ask C to apply `friendlyError`).
1. Add exported pure `friendlyError(msg)`: regexp `/reach the server|didn't respond within|Is the API running/i` -> "We can't reach the Teaching Hub right now. Check your connection and try again." (use "My Classroom" for family via `hubName(mode)`), otherwise return the message unchanged.
2. `ErrorBanner`: show friendly line, "Try again" button (44 px) that calls `onRetry` then dismisses; a "Details" toggle showing the raw message only when `details` is true.
3. Do not edit `lib/api.ts`.
4. Verify by stopping the API and loading the hub as parent and tutor.

### P-06 Tutor Home = Today (M) - Builder C
Files: `LH/home/TutorHome.tsx`, `LH/home/ClassSnapshot.tsx` (`Callouts`), `LH/hubIntent.ts`, `LH/homework/TutorHomework.tsx` (initial filter), `LH/home/useHomeData.ts` (status filter).
1. Reorder: Today block first (next lesson, to mark, overdue/quiet, one "Set homework" button using `setHubIntent({kind:"homework",groupId:""})`), then the rest. Hero stat tiles collapse is Builder B's P-02; do not touch `HubHero`.
2. Nudge: change `Callouts.onGo` to accept `(tab, childId?)`; nudge click does `setHubIntent({kind:"homework",groupId:"",childIds:[id]})` then `go("homework")`. `TutorHomework.tsx:54` already consumes `childIds`. Add a friendly parent-message template only if `HomeworkForm` has an instructions field pre-fill path (`title`/`instructions` intent fields exist).
3. Overdue: add `requestHomeworkFilter(f)` / `takeHomeworkFilter()` to `hubIntent.ts` (module var, like `takeOpenStudent`), consumed once in `TutorHomework` to `setFilter("assigned")`. "Homework to mark" keeps `submitted`.
4. Pass `?status=pending_marking` for the written-answers count in `useHomeData.ts:73-80`.
5. Keep for specs (`learning-hub-home.spec.ts:129-149`): `#hub-home-tutor`, heading "Needs your attention", button name matching /Homework to mark/, "Recent activity" card, Weekly rhythm image + "Show as table", quick action buttons "Assign homework Set the next task" and "Schedule video lesson Pick a time", class snapshot image names.
6. readOnly: hide "Set homework" and nudge action when `props.readOnly`.

### P-07 Accessibility (L, three commits) - Builder A
Files: `LH/kit.tsx` (`HubStyles`, Dialog/RowMenu Escape, skeleton), `LH/HubTabs.tsx`, `LH/LearningHubApp.tsx`, `LH/teachKit.tsx` (Escape :202,361), `LH/curriculum/CurriculumCard.tsx` (tablist; coordinate with Builder E's P-09 - do P-09 first or make only the tablist edit), `LH/TopicFilter.tsx`, `LH/YearGroupPicker.tsx`, `LH/curriculum/AreaDrawer.tsx`, `LH/tools/ToolHost.tsx` (Escape only).
a. Tokens: extend the `#learning-hub` block in `HubStyles` (`kit.tsx:98`): AA text pairs for gold (`--hub-gold-ink`), status fills, control border token at 3:1 (`--hub-control-line`). Apply through classes/inline vars in the hub only. Use a contrast checker on each pair; record ratios in the commit message. No edits to `app/globals.css`.
b. Focus and title: after a click/Enter tab switch, focus the panel heading or panel (`tabIndex=-1` already at `LearningHubApp.tsx:249,253`) and set `document.title` to `<tab label> - Teaching Hub`; do not do this for arrow-key roving (`HubTabs.onKey`). Escape: add a tiny module-level layer stack (`useEscapeLayer(open, onClose)` in `kit.tsx`) and use it in Dialog, RowMenu, AreaDrawer, YearGroupPicker, ToolHost so only the topmost closes.
c. ARIA: CurriculumCard tabs get `aria-controls`, roving tabindex, arrow keys, and a `role="tabpanel"` region; child switcher (`HubHero` `radiogroup`) and TopicFilter skeletons `role="status" aria-busy`; announce child switch with a polite live region.
Gotchas: `learning-hub.spec.ts:128-147` tests roving tabindex; the kid layer is `fixed inset-0 z-[320]` so focus traps must not fight `useKidGuards`.

### P-08 Tools honest by default (S) - Builder E
File: `LH/tools/ToolsPanel.tsx` (no server restart). `readyOnly` default `true`; below the grid a `<details>`/toggle "What's coming (N)" listing `building`/`soon` tools with the existing badges and `onOpen` demand logging. Icon: `PANEL_ICON` in `LH/kit.tsx` is Builder A's file: ask A to add `tools: "layers"` (moot once P-10 folds Tools into Lessons).

### P-09 Curriculum map out of the way (S) - Builder E
File: `LH/curriculum/CurriculumCard.tsx` (and the stale comment at `NotesPanel.tsx:645`, comment only).
1. `useState(pref.open === true)`; `LS = "hub.curriculum.v2"`.
2. Load data when collapsed too: change `useEffect(() => { if (open) return load(); }, ...)` to always load (keep `open` only for showing the grid).
3. Collapsed header already renders the summary line; verify child text "N of M topics started" (use `childSummary`).
4. Record the reversible line in `11-open-questions.md`.

### P-10 Tabs 11 -> 9 (L) - Builder A (after P-05 and P-07)
Files: `LH/LearningHubApp.tsx`, `LH/HubTabs.tsx` (only if aliasing needs a prop), `LH/QuestionsPanel.tsx` (label), plus specs.
1. Do not change `TAB_ORDER` or `TabKey`. In the shell, build the strip without `diagnostic` and `tools` when `!kid`. Compute `stripActive = active==="diagnostic" ? "quizzes" : active==="tools" ? "notes" : active` and give `HubTabs` that; `HubTabs` `aria-controls` must match a real panel id: either render the panel with the strip key id, or add an `aria-controls` override.
2. Above the panel body, for `!kid` and `active` in {quizzes, diagnostic}: two-option `Segmented` ("Quizzes", "Starting quizzes") calling `go(...)`. Same for {notes, tools}: ("Lessons", "Tools"). Use `Segmented` from `LH/teachKit.tsx:154`.
3. Labels: `QuestionsPanel.tsx:21` -> "Messages"; remove the special case in `LearningHubApp.tsx:178-179` (family already shows "Messages"). Child copy "Starting quiz" everywhere (already `KID_TAB_LABEL`); parent-facing text that says "Placement test" may stay in tutor-only screens.
4. Home quick action rename "Assign homework" -> "Set homework" only with `learning-hub-home.spec.ts:144` updated. Leave the Segmented option "Set homework" in `TutorHomework.tsx:126` as it is (4 specs click it by role).
5. Kid: unchanged tab list.
6. Spec updates (same commit): `e2e/learning-hub.spec.ts:138-140` (drop `diagnostic`; add segmented assertion); `e2e/learning-hub-quizzes-ui.spec.ts:338` (parent opens Quizzes, then "Starting quizzes"); `e2e/learning-hub.spec.ts:143-146` (End key target, after baseline check).
7. Verify deep links by URL: `?tab=diagnostic`, `?tab=tools`, `?tab=quizzes&open=quiz:<id>`, `?tab=questions&open=doubt:<id>`, kid `?tab=diagnostic`.

### P-11 Safeguarding (S) - Builder B
File: `SRV/lib/hubPrivacy.ts` only.
1. Export: add `byChildren("hubDoubts", childIds)` to the `Promise.all` and return `learningDoubts` as an allow-list (id, tenantId, lessonTitle, childId, childName, messages[{from,text,byName,at}], createdAt).
2. Erase: add `"hubDoubts"` to the collection list at :88; in the `hubLessons` update (:94) add `` [`liveAnswers.${childId}`]: FieldValue.delete() ``.
3. Spec: extend `e2e/learning-hub-teaching.spec.ts:488-520`: create a doubt for child2 before delete, assert it is in export, then gone after `DELETE /api/my/children/:id`.
4. Add a paragraph to `11-open-questions.md`: notifications, board images, `/api/privacy` summary not covered; owner to review.

### P-12 First-run for a new tutor (M) - Builder C
Files: `LH/home/TutorHome.tsx`, `LH/homework/hwPickers.tsx` (`NoteChecklist`), `LH/homework/HomeworkForm.tsx` (pass default year/subject).
1. Zero students and no failure: render a 3-step card (Add a student -> Pick a lesson -> Set homework) at the top of Home; hide the zero-count attention/snapshot cards in that state. Steps use `go("students")`, `go("notes")`, `setHubIntent`+`go("homework")`. Hide for `readOnly`.
2. `NoteChecklist`: add Year and Subject `Select`s that add `year=` and `subject=` to the existing `/notes` call (supported at `SRV/routes/learningHub.ts:537-553`); default year from the chosen students' `yearGroup` ("Year 5" -> `5`). Keep `id="hub-hw-note-search"` and checkbox labels.
3. Do not add enrol-by-name (roadmap R-13).

### P-13 Kind child language (S) - Builder D
Files: `LH/homework/hwTypes.ts`, `LH/homework/StudentHomework.tsx`, `LH/home/StudentHome.tsx`, `LH/shared-assess/ResultView.tsx`, `LH/shared-assess/StudentAssess.tsx` (chips).
1. `dueState(dueAt, status, now, kid = false)`: kid labels "Waiting for you" / "Waiting for you since Tuesday" instead of "Overdue"; default behaviour unchanged for tutor/parent. Pass `useFamily().kid` from the child screens only.
2. "Handed in late" -> "Handed in" in kid mode; `ResultView` line 126: in kid mode drop "N points short of the X% pass mark" and use "Nearly there. Have another go." (keep the tutor and parent sentence).
3. Do NOT change "Not quite" (six specs and already kind). Leave `ParentGate` alone.
4. Hide raw percentages / pass-mark arithmetic in kid mode where they appear as text; keep the ring `aria-label` readable.

## Conflict map

| File | Proposals |
|---|---|
| `LH/LearningHubApp.tsx` | P-03 (1 line), P-05, P-07, P-10 |
| `LH/kit.tsx` | P-05, P-07, P-08 (icon only) |
| `LH/HubTabs.tsx` | P-07, P-10 |
| `LH/HubHero.tsx`, `LH/types.ts` (NoteStats) | P-02 |
| `LH/home/TutorHome.tsx`, `ClassSnapshot.tsx`, `hubIntent.ts`, `home/useHomeData.ts` | P-06, P-12 (TutorHome) |
| `LH/home/homeKit.tsx` (PartError, shared) | P-05 optional, P-04 (import only), P-06 |
| `LH/home/StudentHome.tsx` | P-03, P-04 (copy), P-13 |
| `LH/homework/StudentHomework.tsx`, `hwTypes.ts` | P-04, P-13 |
| `LH/homework/TutorHomework.tsx` | P-06 (filter intent) |
| `LH/homework/hwPickers.tsx`, `HomeworkForm.tsx` | P-12 |
| `LH/shared-assess/ResultView.tsx`, `StudentAssess.tsx` | P-13 |
| `LH/family/KidMode.tsx` | P-03 |
| `LH/curriculum/CurriculumCard.tsx` | P-09, P-07 (tablist) |
| `LH/tools/ToolsPanel.tsx` | P-08 |
| `SRV/routes/hub/remoteSyncApi.ts`, `LH/remotesync/TutorLiveBanner.tsx` | P-01 |
| `SRV/routes/learningHub.ts` (counts) | P-02 |
| `SRV/lib/hubPrivacy.ts` | P-11 |
| `e2e/learning-hub.spec.ts`, `learning-hub-quizzes-ui.spec.ts` | P-10 |
| `e2e/learning-hub-teaching.spec.ts` | P-11 |

## Proposed builder split and order

- **Builder A - Shell and accessibility**: P-05 -> P-07 -> P-10. Owns `LearningHubApp.tsx`, `kit.tsx`, `HubTabs.tsx`, `teachKit.tsx`, `QuestionsPanel.tsx`, `panels.tsx`, and the P-10 spec edits. Adds `PANEL_ICON.tools` on request. The hottest files: nobody else edits them except D's one-line `KID_HIDDEN_TABS` guard after A's P-10 lands.
- **Builder B - Server and data truth**: P-01, P-11, P-02 (in that order, one server-restart window). Owns `remoteSyncApi.ts`, `hubPrivacy.ts`, `learningHub.ts` counts, `TutorLiveBanner.tsx`, `HubHero.tsx`, `types.ts` NoteStats, `learning-hub-teaching.spec.ts` edit.
- **Builder C - Tutor Home and homework entry**: P-06 -> P-12. Owns `home/TutorHome.tsx`, `ClassSnapshot.tsx`, `home/homeKit.tsx`, `home/useHomeData.ts`, `hubIntent.ts`, `homework/TutorHomework.tsx`, `hwPickers.tsx`, `HomeworkForm.tsx`.
- **Builder D - Child and family**: P-04 -> P-13 -> P-03. Owns `home/StudentHome.tsx`, `homework/StudentHomework.tsx`, `hwTypes.ts`, `shared-assess/ResultView.tsx`, `StudentAssess.tsx`, `family/KidMode.tsx`. The single `LearningHubApp.tsx` line lands last, after A.
- **Builder E - Small isolated**: P-08, P-09. Owns `tools/ToolsPanel.tsx`, `curriculum/CurriculumCard.tsx` (A's P-07c tablist edit to that file goes after E finishes).

Order:
1. Wave 1 in parallel (disjoint files): A (P-05, then P-07), B, C, D (P-04, P-13), E. B is the only one restarting the API; tell the others when it does.
2. Wave 2: A finishes P-10 (needs P-07 landed); D does P-03 after P-10 (needs the shell guard and the hidden-tab constant).
3. Final: full hub Playwright pass at phone and desktop as tutor, parent, kid, staff view-only; `11-open-questions.md` entries for P-01 (expiry choice), P-02 (additive fields), P-09 (owner instruction), P-11 (privacy scope); then the separate clean-up commit.

Solo-builder fallback order if only one agent: P-05, P-04, P-08, P-09, P-13, P-01, P-02, P-11, P-06, P-12, P-03, P-07, P-10.
