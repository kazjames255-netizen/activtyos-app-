# A4 - Live lessons (video) audit

Auditor A4, read-only. Nothing in source was edited. Probe copies of the two specs live in `scratch/audit-A4/`
(`audit.spec.ts`, `lessons.spec.ts`, `pw.config.ts`); they are throwaway and change nothing but the one line each fix describes.
Env checked: `server/.env` has `DAILY_API_KEY` + `DAILY_DOMAIN`; in the failing trace `POST /lessons/:id/join` returned **200**
(Daily room + token minted fine). So neither failure is Daily/network.

Line numbers are as of 2026-09-20 ~03:00; other agents are editing `NotesTab.tsx` / `LessonNotesEditor.tsx` (wording pass), so re-grep before patching.

---------------------------------------------------------------------------------------------------------------------------------

## 1. Root causes of the two failing e2e tests

### 1.1 `learning-hub-teaching-ui.spec.ts:320` "a lesson about to start can be joined" - PRODUCT BUG (P0, affects real users)

Symptom: `[data-testid=hub-daily-frame] iframe` never attaches. Screenshot = the app-level error boundary
("This page hit a problem", Next issue badge "1 Issue"). The whole page, including the call, is gone.

Console (from `trace.zip`), the actual error:

```
TypeError: Cannot read properties of undefined (reading 'trim')
    at noteCard  (features_learninghub_live_workspace_*.js)   -> NotesTab.tsx noteCard
    at Array.map / NotesTab
```

Chain of cause:
1. The server's `GET /api/learning-hub/notes` was made LIGHT: rows are `NoteLite` (no `body`; `excerpt`, `hasBody`, `readMinutes`)
   unless `?full=1` (`server/src/routes/learningHub.ts` `noteListOut` ~L428, route `/notes` ~L449, `full === "1"` branch ~L483).
   `features/learninghub/types.ts:41` already models `NoteLite`, and `NotesPanel.tsx` was migrated to it.
2. The in-call workspace was NOT migrated. `useNotesList` (`live/workspace/LessonNotesEditor.tsx:25-33`) still does
   `get<Note[]>("/api/learning-hub/notes")` and hands the rows to `NotesTab` as full `Note`s.
3. `NotesTab` auto-opens the first note (`useEffect` "first.current") and `noteCard` calls `n.body.trim()`
   (`live/workspace/NotesTab.tsx:70`) and `ReadingView` calls `note.body.trim()` (`:140`). `body` is `undefined` -> TypeError during render.
4. There is no error boundary around workspace tabs (only the whiteboard has `BoardBoundary`, `LessonBoard.tsx:287`), so the throw
   unmounts everything up to the app boundary. The Daily frame (`DailyFrame` in `LessonStage.tsx`) is destroyed with it. Playwright
   polls for the iframe, which is created by a dynamic import + `createFrame`, and loses the race to the crash.

Why it matters beyond the test: the family default workspace tab is `notes` (`LessonStage.tsx:178`), so **any family (or tutor
opening the Lessons tab) joining a call whose tenant/topic has at least one lesson in scope crashes the call the moment the list loads.**
That is a strong candidate for the reported "family can't see the board / join" symptom in `docs/board-review/05-live-collab-layout.md`.

Verified: I ran a copy of the spec with ONE change - a `ctx.route` that appends `full=1` to the notes-list request - and it
**passed** (`scratch/audit-A4/audit.spec.ts`, 2.4 min, incl. the workspace tab count = 4, note text, Cards deck present, mini-leave).

Proposed fix (do not apply blindly; re-read the files first). Two parts; part A alone ends the crash, part B makes it correct.

A. Hot-fix, type the list honestly and stop assuming a body (`LessonNotesEditor.tsx`):
```diff
-export function useNotesList(qs: string) {
-  const [notes, setNotes] = useState<Note[] | null>(null);
+export function useNotesList(qs: string) {
+  const [notes, setNotes] = useState<NoteLite[] | null>(null);
   const load = useCallback(() => {
-    get<Note[]>(`/api/learning-hub/notes${withQs(qs, {})}`).then((n) => setNotes(Array.isArray(n) ? n : []))...
+    get<NoteLite[]>(`/api/learning-hub/notes${withQs(qs, {})}`).then((n) => setNotes(Array.isArray(n) ? n : []))...
```
(and `notes: NoteLite[] | null` in `LessonNotesEditor` / `AttachDialog` props; they only read id/title/topicId/attachments, so no other change).

B. `NotesTab.tsx`: fetch the body when a card is opened or presented (the single-note route already exists, `GET /notes/:id`):
```tsx
const [bodies, setBodies] = useState<Record<string, string | null>>({});   // null = failed
const want = open ?? reading?.id ?? null;
useEffect(() => {
  if (!want || bodies[want] !== undefined) return;
  let live = true;
  get<Note>(`/api/learning-hub/notes/${want}${withQs(p.qs, {})}`)
    .then((n) => live && setBodies((b) => ({ ...b, [want]: n.body ?? "" })))
    .catch(() => live && setBodies((b) => ({ ...b, [want]: null })));
  return () => { live = false; };
}, [want, p.qs]);
// in noteCard:   const body = bodies[n.id];
//   body === undefined ? <Skeleton className="h-16" /> : body === null ? <p>Couldn't load this lesson.</p>
//   : body.trim() ? renderMarkdown(body) : <p>No written text - see the attached files.</p>
// ReadingView: take `body` as a prop from the same map.
```
Do NOT "fix" by `?full=1` on the list: the library is ~1 MB of markdown for a full tenant (the server comment says so) and this
runs on every family join. Do NOT "fix" by `(n.body ?? "").trim()` alone: it hides the crash but tells families "No written
text" for lessons that have text.

Also add a tab-level error boundary (see finding P0-2) so a future shape drift cannot kill the call again.

### 1.2 `learning-hub-lessons.spec.ts:314` "start -> learn ... -> done" - STALE/RACY TEST (not a product bug)

Symptom: after the exit quiz, `data-step` stays `"quiz"`; screenshot shows quiz "3 of 3" with the alert
"You haven't answered 1 question. Unanswered questions score no marks." plus "Go back / Hand in anyway".
So `lesson-finish` was pressed with question 1 unanswered and QuizStep correctly refused to submit silently
(`features/learninghub/lesson/QuizStep.tsx` `warn` path, ~L138-146). The product is behaving as designed.

Root cause, from the Playwright trace action list (fresh run, `--output` kept):
```
expect  lesson-player  data-step=quiz          <- passes as soon as the step flips
evalOnSelectorAll  hub-match-term              <- 21 ms later, returns []   (the quiz question 1 is a MATCH question)
click   lesson-next                            <- no tile / slot clicks happened in between
click   text="fat"  (Q2)   click lesson-next   fill "zzz wrong" (Q3)   click lesson-finish
```
`QuizStep` first shows a skeleton while it POSTs `/assessments/:id/attempts` (`phase === "starting"`, QuizStep ~L84-86). The step's
`data-step` is already `"quiz"` then, so `stepIs(page,"quiz")` (`e2e/learning-hub-lessons.spec.ts:307`) does not wait for the
question. In `answer()` the match/order branches use `root.getByTestId("hub-match-term").allInnerTexts()`
(`:147`), which does NOT auto-wait and returns `[]`, so the for-loop answers nothing; the next `lesson-next` click then auto-waits for the
real "Skip ->" button and skips Q1. (Warm-up never hits this because its questions are preloaded; single/short kinds
auto-wait in `click`/`fill`, which is why only the match Q1 breaks. The exit-quiz seed is `[match, single "fat", short]` because the Oak
fixture drops the ambiguous MCQ and the picture-only match.)
Not a regression in QuizStep and not the network: it only became visible now because Q1 of the seeded quiz is a match and the
attempt start takes ~0.3-1 s on a busy dev stack.

Verified: a copy of the spec with the patch below **passed** (52.6 s, `scratch/audit-A4/lessons.spec.ts`).

Fix (test only), in `answer()` at the top (`e2e/learning-hub-lessons.spec.ts:126`):
```ts
async function answer(page: Page, q: SeedQ, how: "right" | "wrong") {
  const root = player(page);
  // The quiz step starts a real attempt first (skeleton) - wait for THIS question to render before reading its DOM.
  await expect(
    q.kind === "match" ? root.getByTestId("hub-match-term").first()
    : q.kind === "order" ? root.getByTestId("hub-order-item").first()
    : q.kind === "short" ? root.getByPlaceholder("Type your answer")
    : root.getByText(q.right, { exact: true }),
  ).toBeVisible({ timeout: 20_000 });
  ...
```
Optional product polish (P2, not needed for the test): `data-step="quiz"` could be set only once the questions are ready
(add `data-ready` to the player) so tests and AT users do not see a "quiz" step that is still a skeleton.

---------------------------------------------------------------------------------------------------------------------------------

## 2. Findings (ranked)

Sizes: S <= 1 h, M = half a day, L = day+.

### P0

**P0-1. In-call Lessons tab crashes the whole page (root cause 1.1).** `live/workspace/NotesTab.tsx:70,140`,
`live/workspace/LessonNotesEditor.tsx:25-33`. Fix: patch A + B above. S (A) + M (B). Also covers the tutor path
(tutor opens the Lessons tab -> same crash).

**P0-2. No error boundary around workspace tabs.** `live/workspace/Workspace.tsx` mounts Students/Lessons/Progress/Homework/Quiz/Cards
straight into the call tree; only the Board has `BoardBoundary` (`board/LessonBoard.tsx:287`). One bad render in any tab destroys
the video call for every user (the Daily frame is unmounted with the page). Fix: wrap each `t.key` panel body in a small
`TabBoundary` (per-tab "This tab hit a problem - Try again", `onError` -> `p.onError`) and, better, hoist a boundary above
`renderWorkspace` in `CallProvider` so `CallRoom`'s stage survives a workspace failure. S.

**P0-3. The interactive lessons cannot be taught inside the call.** grep for `LessonPlayer|SlideDeck|isLesson|LessonTutorPanel`
in `features/learninghub/live/**` returns nothing. In-call, "Lessons" renders only the markdown `body`, videos and file chips
(`NotesTab.tsx`, `ReadingView`). An interactive lesson (slides, Explore widget, key words, warm-up, exit quiz - the product's main
asset, 4,679 curriculum questions) attached to a live lesson shows "No written text" or its plain body. What a tutor CAN do in the
call with a lesson today: attach from the library (max 12), create a plain markdown lesson, edit the message, add YouTube videos,
"Present" the markdown big, open the whiteboard, set homework/quiz/cards from their tabs, "Save board as a lesson".
What they CANNOT: open/preview/present an interactive lesson, step slides together with the student, run the warm-up/quiz
together, launch the Explore widget. Families are worse off (they can only read text, cannot even play the lesson beside the call).
Fix: in `noteCard`/`ReadingView`, when the row has `isLesson` (present on `NoteLite`) show "Teach this lesson" (tutor) / "Open lesson"
(family) that mounts the existing `LessonPlayer` (tutor `readOnly` preview with `SlideDeck`; family real, childId from `p.childId`)
inside `PaneOverlay`, exactly as `NotesPanel` does. Phase 2: share-the-step (a `{wb:1, lesson:{id,step}}` app-message, tutor-only
owner check like `present`) so the child follows. M for phase 1, L for phase 2.

### P1

**P1-1. After the tutor presses "End for everyone", any family can recreate the room and sit in it with no tutor.**
`server/src/routes/hub/lessonsApi.ts:384` (`status === "ended"` -> `live` for ANY joiner, incl. a parent), join route ~L340-390,
plus `extend` (a family can extend by 15 min, capped 4 h). `LessonStage.tsx` shows "Rejoin call" to families on the ended state, and the
End confirm text literally promises "You and your students can still rejoin until ...". For a GROUP lesson this leaves children
in an unsupervised video room with each other for up to the window (30 min) and beyond via "Stay". Safeguarding issue for a
children's platform. Fix: if `lesson.status === "ended"` and caller is a parent, return 409 `{code:"waiting_for_tutor"}`
("Your tutor ended the lesson; you can rejoin when they reopen it") unless `tutorJoinedAt > endedAt`; the tutor's rejoin
flips status to live as it does now. UI: map the code in `classifyJoinError` to a friendly state. Same idea (P2) for families joining
10 min early with no tutor in a group lesson. S.

**P1-2. Room cap `max_participants: 12` vs lessons of up to 30 students** (`server/src/lib/hubVideo.ts:104`, `lessonsApi.ts` zod `.max(30)`).
Every device counts (child + guardian + tutor + second device), so a group of 8 with guardians is already at the cap; the 13th
person gets a raw Daily error surfaced as "The connection dropped" (`LessonStage.tsx` `onFail`), which looks like a family
join bug. Also `ensureRoom` never updates `max_participants` on an existing room. Fix: derive cap from `childIds.length * 2 + 2`
(<= Daily plan limit) at create time and in the "reuse" POST; map Daily's "room full" to a clear message + tutor toast. S.

**P1-3. Family join causes (cross-check of docs/board-review/05 section 1).** Current status:
 - Late joiner never learns the tutor is presenting: FIXED (`sync.ts` re-sends `present` on hello/req; `callObject.ts:64` owner-only).
 - Board tab lazy mount: FIXED (`Workspace.tsx` mounts `"board"` from the start).
 - Student identity bound to token: FIXED (`hubVideo.ts:129` `user_id`, `lessonsApi.ts` passes `c:<childId>`, `sync.ts:160`).
 - Still open: (a) the notes crash above (default family tab) - P0-1; (b) room cap - P1-2; (c) `loadLayout` on phones/tablets
   defaults to `video` with the workspace collapsed and remembers the choice in `localStorage` (`LessonStage.tsx` `loadLayout`,
   `hub-ws-layout`), so a phone family sees only video until they tap the bottom nav; consider defaulting to `split` when the
   tutor is presenting and ignoring a remembered `video` on first join (S);
   (d) a parent with two children in the same lesson and no child selected: the join body has `childId: null`, the server silently
   picks `inLesson[0]` (`lessonsApi.ts` `kid = wanted ? ... : inLesson[0]`), so attendance/board identity go to the wrong child (S: require
   `childId` when >1 match, 400 `child_required`; Lobby shows a child picker);
   (e) a second guardian who is not an enrolled parent gets 404 -> "We couldn't connect you" (`classifyJoinError` falls through to `other`)
   with a "Try again" button that can never work; map 404 to `forbidden` copy ("This lesson isn't linked to your account") (S).

**P1-4. Nothing tells a tutor who is actually in the call, and "attendance" is recorded at token mint, not at connection.**
`lessonsApi.ts` join writes `attendance.<childId>` before the client has connected (a failed Daily join, or a parent who closes the
lobby on the "unavailable" screen, still counts as attended); it is only shown after the lesson ends (`LessonCards.tsx:224`,
tutors only). The live roster (`StudentsPop`) exists only inside the whiteboard. Fix: tutor-side "In the room" chips in the workspace
header from Daily `participant-joined/left` (owner call object already published via `publishCall`), and POST a lightweight
`/lessons/:id/attended {childId}` from the family client on Daily `joined-meeting`, moving the `attendance` write there. M.

**P1-5. Reopen does not notify families.** `POST /lessons/:id/reopen` (`lessonsApi.ts` ~L300) never calls `notifyFamilies`
while the UI text says families "see Rejoin". A tutor reopening an old lesson for catch-up gets no family unless they are on the
page with realtime open. Fix: `notifyFamilies({... title: "Lesson reopened" ...})` when `!stillOpen` or status was `ended`. S.

**P1-6. In-person mode is missing (teach a lesson beside the kids, no video).** grep for `in.person|inPerson|no video` finds
only unrelated strings. Today every lesson is a Daily room: `join` returns 503 if `DAILY_API_KEY` is unset, the Lobby demands
camera/mic, and there is no way to run the workspace, board and lessons from the tutor's own device with the child next to them.
Design (MVP, no new infrastructure):
 - Server: `format: "video" | "in_person"` on `lessonBody`/`LessonDoc` (default `video`, back-compat); `POST /join` for `in_person`
   returns `{mode:"in_person"}` (tutor only; no Daily call, no 503 path), sets `tutorJoinedAt`, `status: live`; families get no join button.
   `attendance` becomes a tutor-ticked map via `PUT /lessons/:id/attendance {childId, present}` (needed anyway, see P1-4).
   Note the join window still applies or is dropped (tutor may start any time inside the slot).
 - Client: `LessonStage` gets a stage state `{kind:"in-person"}` that renders NO `DailyFrame`; force `layout.mode="work"`,
   hide the video preset buttons; the Lobby is skipped (no cam/mic check) and hero CTA reads "Start teaching". The Board works locally
   without a call (`callObject.ts` comment "the board can still work locally"; `LessonBoard.tsx:119` only skips the live link when
   `!call`); Students tab gets present/absent toggles and per-student "hand over" (opens the family's own child for a
   `LessonPlayer`, phase 1 of P0-3, with `childId` = that kid so mastery is recorded for the right child).
 - Family view: card says "In person with <tutor>" plus location/note; no Join.
 - Schedule form: a "How is this lesson taught" segmented control (Video / In person) and an optional location text.
 - e2e: schedule in-person -> Start teaching -> no `hub-daily-frame`, tabs present, attendance ticks, End.
 Size L (S server, M client). The whole "teach beside the kids" flow also needs P0-3 phase 1 to be useful.

### P2

**P2-1. Wording ("notes" must read "lessons").** Most visible strings in the live area are already "lessons" (working tree, mid-edit by
another agent): `NotesTab` headings, `LessonNotesEditor` buttons ("Attach lessons from my library", "New lesson"), `liveKit`
("N lessons attached"), tab label `Lessons` (`workspace/tabs.ts`), board menu "Save this page as a lesson". Remaining:
 - Vocabulary collision: "Live lesson" vs "video lesson" vs "lesson". The panel/tab says "Live lessons", the CTA says
   "Schedule video lesson", the form "Edit video lesson", and the in-call tab that lists library items is "Lessons" while
   the section reads "Lessons for this live lesson". Pick one noun for the scheduled event (recommend "Live lesson" everywhere; the
   library object stays "Lesson"). `LessonForm.tsx` title/CTA/subtitle, `LiveLessonsPanel.tsx` empty states + Segmented label
   "Lessons" (which lists live lessons), `LessonNotesEditor.tsx:246` dialog title.
 - Code-level: prop/route names (`NotesTab`, `LessonNotesEditor`, `data-action="add-notes"`, `data-testid` `hub-lesson-notes-dialog`,
   `lesson-notes-editor`) are fine to keep (specs depend on them) but new e2e text asserts must use the new copy.
 - `board/exportBoard.ts:100` creates a library "note" titled "Board - <lesson> - <date>" with body "Saved from the live lesson whiteboard."
   These clutter the family's Lessons list as text-less lessons; tag them so the list can group them ("Whiteboards").
 - The lesson "message" (`lesson.notes`) is now labelled "Message for students" - good; keep the API field name.
 S.

**P2-2. Daily room/token hardening for children** (`hubVideo.ts:100-101,129`). Room has `enable_chat: true` and `enable_screenshare: true`
for everyone. Kids can chat unmoderated and share their screen. Set `enable_screenshare` and `enable_chat` per token
(owner true, family false or "chat on" only if the tutor opts in), and add `start_video_off`/`start_audio_off` false only for the tutor.
S. Also `eject_at_token_exp:false` is right; do not change.

**P2-3. `extend` is open to a family** (`lessonsApi.ts` `/extend`): a child can press "Stay" repeatedly to keep the room alive to 4 h after
the end even after the tutor left (interacts with P1-1). Restrict to tutor, or to family only while the tutor is in the room
(needs presence or `tutorJoinedAt`/last-seen). S.

**P2-4. `classifyJoinError` (`live/lessonTypes.ts`) is regex-on-message.** The API already returns `code` (`outside_join_window`,
`lesson_closed`, `video_unavailable`, `extension_limit`); `CallProvider.join` drops it (`errMsg` only). Pass `e.body.code` and
switch on it; also lets P1-1's `waiting_for_tutor` land. S.

**P2-5. Rescheduling a live/ended lesson and room state.** `PUT /lessons/:id` on a `live` lesson with a moved `startsAt` updates the room expiry
but not `roomUntil`/`reopenedAt`; a lesson moved earlier while a call is running can put `expiresAt` in the past and the client
shows "time's up". Guard: refuse `startsAt` moves once `tutorJoinedAt` is set (409 "live lessons can't be moved"). S.

**P2-6. `TodayStrip`/`LiveLessonsPanel` list caps.** Tutors see 90 days, families 30 (`HISTORY_DAYS`, `FAMILY_DAYS`), Past shows the newest 40
(`LiveLessonsPanel.tsx` `past.slice(0, 40)`) with no "show more"; a busy tutor silently loses older rows. S.

**P2-7. Test/product hygiene.**
 - `data-step="quiz"` is set while QuizStep is still starting (skeleton). Add a `data-ready` flag (see 1.2). S.
 - New spec needed for "family joins and the Lessons tab shows a real body" (opening a card fetches `/notes/:id`), one for the tab error
   boundary, and one for "End -> family cannot rejoin until the tutor reopens" once P1-1 lands. Use `cardWith`-style anchoring per
   AGENTS.md. M.

---------------------------------------------------------------------------------------------------------------------------------

## 3. What I checked and found OK (no action)

- Daily room/token path: private room, per-join token, `is_owner` only for tutors, join window 10 min before -> 30 min after end,
  expiry + "Stay" (+15 min, hard cap 4 h from scheduled end/reopen), tenant 404 for foreign lessons, franchise scope (`canSeeStudent`/
  `canWriteRow`), lesson delete/cancel tears the room down. `ensureRoom` is idempotent by deterministic name.
- Env: `DAILY_API_KEY`/`DAILY_DOMAIN` present; a real room and token are created in the e2e run (join 200).
- `CallProvider` keeps one `CallRoom` mounted across hub tabs; inline/full/mini placement, "Back to lessons" mini window, mini leave
  (all exercised by the passing probe).
- StayPrompt: alertdialog, countdown re-announced every 30 s, focus handling, limit state.
- Live-list realtime (`useRealtime(["hubLessons"])`) in both `LiveLessonsPanel` and `CallProvider` (cancelled lesson closes the room,
  deleted lesson closes the session).
- Whiteboard-side family issues from doc 05 (present late-join, lazy board mount, token-bound identity) are already addressed in the tree.

## 4. Suggested order

1. P0-1 (A then B) and P0-2 - stop the crash (S+M). Re-run `learning-hub-teaching-ui.spec.ts -g "about to start"` and the
   `learning-hub-live*` specs.
2. Apply the 1.2 test patch (S) so the lessons spec is green.
3. P1-1 safeguarding + P1-2 cap + P1-3(d,e) (all S).
4. P0-3 phase 1 (teach an interactive lesson in the call) together with P1-6 in-person mode (they compound).
5. P1-4, P1-5, then P2 sweep (wording pass last, once the agent currently editing `NotesTab`/`LessonNotesEditor` is done).
