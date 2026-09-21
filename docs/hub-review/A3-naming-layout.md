# A3 — Naming consistency & layout audit (Learning Hub UI)

Auditor A3, 2026-09-20 overnight run. READ-ONLY on source; only this report and `scratch/audit-A3/` were written.
Evidence: full-tree greps (client + `server/src`), and a Playwright drive of the live app (tutor = `freelancer` standing account, parent = `custdash` standing account) at 390 / 820 / 1280 wide. ~110 screenshots are in `scratch/audit-A3/`, raw audit numbers in `scratch/audit-A3/results*.json`, scripts `audit.spec.ts` / `supp.spec.ts` / `pw.config.ts` (they seed extra `Audkid…` data into the standing e2e freelancer tenant, which the next e2e run wipes).

IMPORTANT context: other agents were editing the same files while I worked. My first read of the tree (~02:30) found ~45 visible "note" strings; by ~04:00 nearly all had been converted to "lesson". Part (a) therefore records every occurrence I saw, marked DONE (verified changed in the tree at ~04:55) or OPEN (verified still present). Re-run the grep at the bottom of (a) before acting.

---------------------------------------------------------------------------------------------------
## (a) Rename table — "notes" -> "Lessons" (visible copy only)

Rule applied: a library item (`hubNotes` doc) is a **Lesson**; a video session is a **Live lesson**; the free-text field on a live session (`hubLessons.notes`) is NOT a library item, so it is a **Message** ("Message for students"), never "Lessons". Whiteboard sticky notes stay "sticky note".

### OPEN (still wrong in the tree right now)

| file:line | current | replacement |
| --- | --- | --- |
| `features/learninghub/quiz/MarkingQueue.tsx:98` | `<b>Notes:</b> {a.explanation}` | `<b>Explanation:</b> {a.explanation}` (it is the question's explanation, not a note) |
| `lib/settings.ts:479` | `note: "Topics, notes, quizzes & marking. View can read; Edit can author and mark"` | `"Topics, lessons, quizzes & marking. …"` |
| `server/src/routes/hub/lessonsApi.ts:183,271` | notification title `"Lesson scheduled"` (family bell/email) | `"Live lesson scheduled"` (a family now also has "Lessons" = library; see glossary) |
| `server/src/routes/hub/lessonsApi.ts:264,286` | `"Lesson cancelled"` | `"Live lesson cancelled"` |
| `server/src/routes/hub/lessonsApi.ts:269` | `"Lesson time changed"` | `"Live lesson time changed"` |
| `features/learninghub/live/LessonStage.tsx:150,332,373` and `features/learninghub/live/Lobby.tsx:104` | back button text `Lessons` / `Back to lessons` (leads to the Live lessons list, but a "Lessons" tab also exists in the hub AND in the room's workspace) | `Live lessons` / `Back to live lessons` |
| `features/learninghub/live/board/BoardUi.tsx:411-412` | `Save this page as a lesson` / `Save all pages as a lesson` (produces a plain Lesson from a board image) | OK wording; keep. Only confirm the toast in `LessonBoard.tsx` says "Saved to your Lessons" (it does at last read). |

### DONE by other agents (verified changed) — kept for the record / regression grep

| file:line (at first read) | was | now |
| --- | --- | --- |
| `LiveLessonsPanel.tsx:32,184` | "with your notes and topics alongside" / "your notes stay right beside the call" | lessons |
| `live/workspace/tabs.ts:6` | tab label `Notes` | `Lessons` |
| `live/workspace/NotesTab.tsx:94-113` | `Notes` / `All X notes` / `No notes yet` / `Attach a note` / `New note` / `Resource shelf` | `Lessons` / `All X lessons` / `No lessons yet` / `Attach a lesson` / `New lesson` / `Worksheets & files` |
| `live/workspace/LessonNotesEditor.tsx:103-246` | `Note for students`, `Notes attached to this lesson`, `Attach notes from my library`, `New note for this lesson`, `Notes & videos for this lesson` | `Message for students`, `Lessons attached to this live lesson`, `Attach lessons from my library`, `New lesson for this live lesson`, `Message, lessons & videos for this live lesson` |
| `live/liveKit.tsx:122,133,144` | `Add notes / videos`, `Your note for students`, `Note from your tutor`, `N notes attached` | `Add a message / lessons / videos`, `Your message for students`, `Message from your tutor`, `N lessons attached` |
| `live/LessonStage.tsx:349` | "Your notes are still in the Notes tab" | lessons wording |
| `live/LessonForm.tsx:95,127` | "The topic's notes appear beside the video" / "Notes for students" | lessons / "Message for students" |
| `live/board/ImagePicker.tsx:55,57`, `exportBoard.ts:91-93`, `LessonBoard.tsx:139-153` | "From your notes", "Notes tab", "lesson notes" | lessons |
| `homework/HomeworkForm.tsx:138-140`, `StudentHomework.tsx:220,237`, `TutorHomework.tsx:122,202` | "Link notes", "Notes & resources tab", "N notes", "Notes to read first" | lessons ("Lessons to read first" / "Lessons to do first") |
| `home/TutorHome.tsx:44` | "Share a lesson or resource" | "Share a lesson or worksheet" |
| `features/setup/SetupApp.tsx:217` | "topics, notes, quizzes…" | lessons |
| `server/src/lib/hubNotify.ts:75` | `"New learning notes"` / `New notes for …` | `"New lesson shared"` / `New lesson for …` |
| `server/src/routes/learningHub.ts:511,514,516,610,612,613,662`, `hub/homeworkApi.ts:73,75`, `hub/lessonsApi.ts:162,212`, `lib/hubMedia.ts:46` | `Note not found`, `That note belongs to head office`, `plain note, not an interactive lesson`, `attached to a note` | lesson wording |

### Intentionally NOT renamed (internal — must not change)
`hubNotes` collection, `/api/learning-hub/notes*` routes, `noteIds`, `Note` type, `NotesPanel.tsx` / `NotesTab.tsx` / `LessonNotesEditor.tsx` filenames, `key:"notes"` panel/tab keys, `#hub-note-*` / `#ws-*` DOM ids and `data-testid`s, `icon="notes"`, `role="note"` (ARIA), `hubLessons.notes` field. Whiteboard: `Sticky note`, `Note colour`, `Write a note…` (`BoardUi.tsx:52,154,230`, `BoardCanvas.tsx:154`) are sticky notes on the board, keep.

### Docs shown to users
None reference "notes": `docs/learning-hub.md` is internal (still says notes/resources — update for tidiness, not user-visible). e2e: `e2e/learning-hub-lessons.spec.ts:179` asserts `/Notes & resources/` count 0 (fine); `e2e/learning-hub.spec.ts:178` is a comment only.

Regression grep (should print only internals after the OPEN rows are fixed):
`grep -rnE '(>|")[^<"]*\b[Nn]otes?\b' features/learninghub server/src/routes/hub server/src/routes/learningHub.ts server/src/lib/hub*.ts | grep -vE 'api/learning-hub|hubNotes|data-|role="note"|Sticky|sticky'`

### Other inconsistent terms found (OPEN unless stated)
| file:line | issue | fix |
| --- | --- | --- |
| `NotesPanel.tsx:269`, `HomeworkForm.tsx:174`, `lesson/LessonPlayer.tsx:128`, `lesson/QuizStep.tsx:80,146`, `lesson/DoneStep.tsx:48`, `lesson/LessonTutorPanel.tsx:32,46` | "pupils" (8x) — everywhere else in the hub says "students" (parent-facing: "your child") | "students" |
| `quiz/Results.tsx:69`, `quiz/MarkingQueue.tsx:23,49`, `quiz/AssessmentBuilder.tsx:102,208`, `quiz/AssessmentList.tsx:147` ("marked papers"), `quiz/QuestionBank.tsx:145` ("In N papers"), `shared-assess/TakeAssessment.tsx:68,126,220,248,257,273`, `shared-assess/ResultView.tsx:108` | "paper" used for a quiz/placement test attempt, while the rest of the UI says quiz / placement test | use the noun already in scope (`quiz` / `placement test`), or "attempt" for a student's hand-in: "hand in your quiz", "In N quizzes", "Loading the quiz" |
| `homework/TutorHomework.tsx:126` | segmented "Inbox / Assignments" — everywhere else it is "homework" | "Inbox / Set homework" (or "All homework") |
| `home/ClassSnapshot.tsx:71` "Class snapshot", `TutorHome.tsx:120` "class mastery" | "class" vs students/groups (hub has Groups) | "Student snapshot" / "student mastery" |
| tab label `Placement test` (`DiagnosticPanel.tsx:12`) vs key `diagnostic`, and `Progress` (`ProgressPanel.tsx:17`) vs key `dashboard` | fine in UI, just don't leak "diagnostic"/"dashboard" into copy | keep UI wording |
| parent copy: "your provider" (`StudentHome.tsx:24`, `LearningHubApp.tsx`) vs "your tutor" (`liveKit`, `StudentAssess`) | family sees both for the same person | "your tutor" inside the hub; "provider" only in the provider picker |
| Live-lesson buttons `Rejoin lesson` + `Rejoin now` side by side (tutor Live card, `tutor-820-tab-1`) | two near-identical primary actions | keep one; second = "Rejoin without preview" if that is what it is |
| Nav: `Learning Hub` (hub) vs `Learning Centre` (staff training, `lib/nav/config.ts:131,231`) | two "Learning X" items in the same sidebar | leave, but never write "learning centre" in hub copy |

---------------------------------------------------------------------------------------------------
## (b) Glossary (recommended, one word per thing)

| Concept | Use | Never |
| --- | --- | --- |
| Library item a tutor writes / Oak import (`hubNotes`) — plain text or interactive | **Lesson** (tab "Lessons"; adjectives "interactive lesson", "draft lesson") | note, notes, resource, "Notes & resources" |
| Video session (`hubLessons`) | **Live lesson** (tab "Live lessons"; "Schedule a live lesson"; notifications "Live lesson scheduled") | bare "lesson" when a library Lesson could be meant |
| Free text on a live session | **Message** ("Message for students / from your tutor") | note |
| PDFs / images attached to a Lesson | **Worksheets & files** | resources |
| A child enrolled in the hub | **Student** (tutor UI, and parent UI when talking about the roster); **your child / <first name>** on parent copy | pupil, learner, kid (kid mode = "Hand over to Ava", brand it once) |
| Person teaching | **Tutor** | teacher, provider (except provider picker) |
| Scored set of questions | **Quiz**; the one-off level check = **Placement test** | test (alone), assessment (only in code/aria of shared builder), paper, exam |
| A student's hand-in of a quiz | **attempt** (internal) / "your answers" (student copy) | paper |
| Set work | **Homework** (set homework, homework inbox) | assignment, task |
| Question review deck | **Flashcards** | cards (ok as short tab label in the room) |
| Group of students | **Group** | class |
| Mastery view | **Progress** | dashboard |

---------------------------------------------------------------------------------------------------
## (c) Layout findings, ranked

Method: for each hub tab, lesson reader, lesson player, live-lesson list, lobby and call room I ran an in-page audit (horizontal overflow, clipped text, tap targets < 44 px, WCAG contrast from computed colours, elements covered by other elements) and took full-page screenshots (`scratch/audit-A3/{tutor|parent}-{390|820|1280}-*.png`). Cover / tap counts exclude the shell topbar (34 px buttons in `components/shell` — outside the hub; worth a separate ticket).
Coverage honesty: tutor 390 + 820 and parent 390 + 820 + 1280 tabs, reader, editor, player, lobby and room were captured. Tutor 1280 (all tabs, reader, preview, player, editor; no room) was captured in a second pass; the 1280 tab strip just fits (9 tabs in ~1000 px) and 1280 shows no new hub-specific layout problems beyond findings 2, 3, 5, 8. Tutor 820 audit NUMBERS were lost (results file overwritten; screenshots kept). In the room, the tutor "Students" workspace tab (98 students on this tenant) hung my script for minutes at 390 — I could not tell if the page or my auditor hung; retest with a large roster.
Positives verified: the lesson player at 390/820/1280 (all 6 steps captured for a parent) is clean — 48 px CTAs, sticky header does not overlap content, only the 11 px `--ink-3` subject line (finding 2) and a truncated subject crumb on phone. NO page-level horizontal overflow in any captured view at 390 or 820 (`documentElement.scrollWidth == clientWidth` everywhere); no text clipping found by the auditor outside the room; hub tab strip has correct roving-tabindex/aria.

| # | Sev | Size | Finding | Where / fix |
| --- | --- | --- | --- | --- |
| 1 | HIGH | M | **Room on a phone leaves the workspace ~215 px tall.** Family default split is 35 % workspace (`LessonStage.tsx:134` `frac: 0.35`, applied `:364` `wsStyle`). At 390x844 the board canvas is ~150 px, the Lessons list is cut off and the workspace "Open" button is clipped by the pane's right edge (`parent-390-live-ws-notes.png`, `-ws-board.png`). Tutor phone default is video-only (`:134`) so Lessons/Board need 2 taps + drag. | Phone (`!desktop`): default `frac: 0.55` for families, and cap the video tile `max-h-[36dvh]`. Add `min-w-0` on the tabpanel child (`Workspace.tsx:112`) / `WsSection` root (`wsKit.tsx:43`) — the section is wider than its pane (`h3.truncate flex-1` + non-shrinking `aside` pill and `TeachLesson.tsx:200` button); give the aside `shrink-0 max-w-[45%] truncate` and the row `flex-wrap`. Better: when a non-video workspace tab is chosen on phone, switch to `mode:"work"` + the existing floating tile (`useFloatingTile`, `:363`). |
| 2 | HIGH | S | **Secondary text fails WCAG AA everywhere.** `--ink-3` `#8a86a3` = **3.49:1 on white, 3.28:1 on page bg #f5f8fd, 3.31:1 on panel**, used for 10.5–12.5 px helper text on every tab (≥10 hits per view: "SUBJECTS", "68 topics", "Active 8 h ago", "MASTERY", step-list hints, "Tutor is drawing"…). | Token, `app/[portal]/layout.tsx:30` and `app/globals.css:118`: change to `#6b6788` (5.36 / 5.03 / 5.08:1). One-line, all portals; if shell owner objects, add `--hub-ink-3: #6b6788` and replace `var(--ink-3)` in `features/learninghub` (sed-able). |
| 3 | HIGH | S | **Amber used as text: 2.0:1.** `ACT_C[4] = #F5A524` (`features/money/finance-kit.tsx:24`) flows through `subjectColor` (`kit.tsx:16`) into text: subject eyebrow "MATHS …" (1.92:1) and "N min read" (2.04:1) in `NotesPanel.tsx:416,496,549`, subject chips in `StudentsPanel`. | Add `subjectInk(subject) = color-mix(in srgb, ${subjectColor(s)} 60%, #000)` (or map amber to `#9a5b00`, 5.4:1) and use it for `color:`; keep the bright value only for fills/borders. |
| 4 | MED | S | **Status pills fail contrast.** "ROOM OPEN" white on `#15b364` = 2.74:1 (parent Live tab, 10.5 px); "8 live now" `#15b364` on tint = 2.49:1 (tutor Live tab); "End lesson" red on pink 4.12:1 (`LessonStage.tsx:399`); tab-strip badge "Soon" fine. | Filled green pills: bg `#0b7a44` (white 5.41:1). Green text on tint: `#0a6b3a` (6.0:1). "End lesson" text `#b3131c`. |
| 5 | MED | S | **Tap targets 32–42 px** (need 44): `Segmented` `min-h-[40px]` (`teachKit.tsx:161`; Upcoming/Past, Homework Inbox/Assignments) and `min-h-[34px]` roomy=false (`kit.tsx:337`); `NotesPanel.tsx:308` editor Write/Preview `min-h-[32px]`; reader actions Print / Set for children / Edit 40 px, Delete 34 px (`NotesPanel.tsx` reader bar); Save lesson / Cancel 40 px; `liveKit.tsx:127` "Edit message, lessons & videos" `min-h-[40px]`, "Show more" 36 px; room toolbar icon-only buttons (Large type, Keyboard shortcuts…) measure 41–42 px wide: `tog` (`LessonStage.tsx:367`) has `min-h-[44px]` but no `min-w-[44px]` (`seg` at :366 does); `TopicFilter.tsx:268,274,309` 40 px; `AssessmentList.tsx:139,180,191`, `StudentHomework.tsx:253,298,314,320`, `hwPickers.tsx:49,86`, `SlideEditor.tsx:64`. | Global rule: replace `min-h-[32px|34px|36px|40px]` on buttons with `min-h-[44px]` (grep list above); keep 32–40 only where `lg:` override exists (`kit.tsx:442` pattern `min-h-[44px] lg:min-h-[40px]` is the right one). Delete: add `min-w-[44px]`. |
| 6 | MED | S | **Tab strip too long for phone/iPad.** Tutor has 9 tabs = 998 px, parent 8 = 878 px (`HubTabs.tsx:87-112`, `px-3 gap-1`, labels + icon). At 390 only ~3.3 tabs show; "Lessons" needs two swipes; at 820 (iPad portrait, `tutor-820-tab-2`) the strip still scrolls and "Homework" is cut mid-pill with no chevron cue (fade only after first scroll). | (1) Shorten: `Placement test`→`Placement`, `Live lessons`→`Live` under `sm` (keep full label in `title`/`aria-label`); (2) `sm:flex-wrap` is wrong (ragged) — instead `md:grid md:grid-cols-9`-style not needed; simply reduce `px-3`→`px-2.5` and hide icons `<md`: saves ~140 px, fits 820. (3) Show the right fade from first paint (`edges.r` initial state true when `scrollWidth>clientWidth`). |
| 7 | MED | S | **Parent "Hand over to <child>" stack.** One full-size pill per child, stacked, above the tab bar (`family/FamilyContext.tsx:114-118`). With 15 children on the test account it pushes the tabs to y≈1300 at 390 (`parent-390-tab-0-Home.png`); real families of 2–4 still eat ~250 px before the tabs. | If `kids.length > 2`: one button "Hand over to…" opening a small `Select`/popover (there is already a child `Select` in the hero); keep the current pills for ≤2. Also collapse the sentence to a `title`/"?" on `<sm`. |
| 8 | MED | S | **Decorative star sits directly on the Delete (trash) icon on every tutor lesson card at 390, 820 and 1280** (`tutor-1280-tab-7-Lessons.png`, card header top-right; art from `subjectArt.tsx`, cards in `NotesPanel.tsx` ~:496-549) — a destructive control overprinted by artwork; can intercept taps. | `pointer-events-none` on the art layer, `opacity-50`, or anchor it bottom-right; ensure action buttons `relative z-[1]`. |
| 9 | LOW | S | **Micro-type**: "MASTERY" 8.5 px, "to pass" 10 px, uppercase labels 10.5 px (`StudentsPanel.tsx`, `progress/Overview.tsx:160`, `quiz/AssessmentList.tsx`). | floor at 11 px; uppercase labels 11 px + `tracking-wide`. |
| 10 | LOW | S | **Lobby bottom CTA** (`Lobby.tsx:228` `sticky bottom-0`) sits over the Microphone status row at 390 and the dev "N" badge; content under it is unreachable until scrolled. | add `pb-[calc(88px+env(safe-area-inset-bottom))]` to the lobby scroller (`:101`) so the last row clears the CTA; `env(safe-area-inset-bottom)` on the sticky bar. |
| 11 | LOW | S | Readable-but-cramped 820 room: video-only preset leaves a 700 px empty tutor room with a 12 px bottom tab row (`tutor-820-live-room.png`); workspace tab labels 12 px; Cards/Quiz/Board reachable only via the bottom strip. | default tutor tablet preset = `split 0.35` like family (`LessonStage.tsx:134`: `desktop` = `useIsDesktop()` = min-width 1024px, so iPad portrait 820 is treated as a phone; use 768). Layout is persisted in localStorage `hub-ws-layout`, so existing users keep whatever they last picked. |
| 12 | INFO | — | False positives to ignore in the raw JSON: active tab "1.06:1" (white text over the gradient pill drawn by a separate `<span>`; real contrast is fine), disabled "Save lesson" 2.78:1 (opacity), covered "Hand over" buttons (auditor artefact from full-page scroll under the sticky header). |

### Sticky-bar / overlap check
- Fixed/sticky layers seen: shell topbar, Progress matrix sticky header cells (`progress/Overview.tsx:160-173`, correct z-order), reader header `LessonPlayer.tsx:130` (`sticky top-0`) and `TakeAssessment.tsx:255`, `SlideDeck.tsx:80` sticky bottom, `MarkingQueue.tsx:76` sticky bottom, `NotesPanel.tsx:354` sticky save bar, Lobby CTA. In the captured views none of the hub sticky bars overlapped content or each other. NOTE: hub sticky headers use `top-0` but the shell topbar is also fixed (~56 px) — at 390 the player header (`parent-390-lesson-open.png`) sits below it correctly because the page container offsets; retest if the topbar becomes `position:fixed`.
- Next dev overlay ("Compiling…", "N") overlaps bottom-left controls in screenshots — dev only.

### Suggested order of work
1) #2 + #3 + #4 (contrast: 3 token/one-file edits, biggest a11y win) 2) #1 (phone room) 3) #5 (tap-target sweep, mechanical) 4) #6/#7 (tab strip, hand-over) 5) copy: OPEN rows in (a), pupils→students, paper→quiz.
