# Challenge: the Overloaded Tutor (Friday 11pm, 30 students, the 40th Tuesday)

Test for every proposal: does it save me time on the 40th Tuesday, or cost a click/decision? Taps are counted from code (`TutorHome.tsx`, `ClassSnapshot.tsx`, `HubHero.tsx`, `TutorLiveBanner.tsx`, `LearningHubApp.tsx`, `hubIntent.ts`, `homework/*`, `StudentsPanel.tsx`), not measured. Novelty does not matter to me. Nothing that moves a thing I already hit without thinking.

## Verdict table

| # | Proposal | Verdict |
|---|---|---|
| P-01 | End broadcast + stale banner | KEEP, REVISE (no confirm when nobody is connected; idle 45 min is too short) |
| P-02 | Numbers agree, tiles collapsed | KEEP (respect the saved Hide/Show; keep the settings gear) |
| P-03 | Child Home | NO OPINION on the design. Condition: hand-over to a child and back must not gain a tap |
| P-04 | One truth on homework | KEEP |
| P-05 | Friendly errors | KEEP (tutor "Details" only costs a tap on failure) |
| P-06 | Tutor Home = Today | REVISE (keep only the Nudge pre-select and the Overdue landing; drop "one Set homework button" and any reorder) |
| P-07 | Accessibility | KEEP (one condition on focus moves) |
| P-08 | Tools ready-only default | KEEP |
| P-09 | Curriculum map collapsed | KEEP, REVISE (remember open/closed per device) |
| P-10 | Tabs 11 to 9 | REVISE hard (rename + alias only; do not merge Placement or Tools tonight) |
| P-11 | Safeguarding | KEEP (invisible to me, additive) |
| P-12 | First-run + picker filters | KEEP, REVISE (default the filter only for a single student) |
| P-13 | Kind child wording | KEEP for child views only. Tutor wording stays factual ("Late", "Overdue") |
| R-1 | One Assign sheet | KEEP as roadmap, on conditions (see below) |
| R-2 | One Mark queue | KEEP: this is the real win |
| R-4 | Option A navigation | DROP until R-1 and R-2 are proven, or ship with a redirect map |

## Per proposal

### P-01 End a forgotten broadcast: KEEP, REVISE
- Today: `TutorLiveBanner.tsx` has only "Rejoin". `endRemoteSync` has no UI caller. To end a session I cannot. Rejoin = 1 tap, then Go live > End inside the lesson.
- After as written: End = tap + confirm tap = 2. I never wanted the confirm. But accidentally ending a lesson with 6 kids connected is bad.
- Smallest change: End button with NO confirm when `connectedCount === 0` (the forgotten-banner case, which is the whole point), and a confirm only when someone is connected. Keep Rejoin as the primary button and put End second, so the muscle-memory tap on the banner still means Rejoin.
- Idle expiry 6h to 45 min is the risk. A silent worksheet block or a mid-lesson break can exceed 45 min, and the banner and the kids' broadcast die under me. Make the tutor client heartbeat count as activity, or use 2h. Server timeout is otherwise fine.
- Silent workflow change: children's banner hides when the session is not `live`. If a tutor has "Resume broadcasting" behaviour (`listLiveRemoteSync` check in RemoteSyncApp), ending must stay resumable-by-restarting, not delete anything.

### P-02 Numbers that agree: KEEP
- Saves 0 taps but ~90 words to scroll past on a phone at 6:55. Hero already has a Hide/Show toggle stored in `localStorage` key `aos.hero.learninghub` (`HubHero.tsx:19,63`). Collapsing by default only applies when the key is unset. Do not reset a saved "Show" or wipe that key.
- Keep the settings gear (`HubHero.tsx:72`, `?tab=hub` setup link) visible when collapsed. It is inside the hero today.
- Removing "topics" and "worksheets" tiles: fine.

### P-04, P-05: KEEP
- P-04 is the same failure I hit: failed load shown as empty. Retry costs 1 tap, only on failure, and beats silently thinking nobody handed in. Home already has `PartError` with retry (`TutorHome.tsx`); reuse it, do not add a new pattern.
- P-05: "Details" toggle only for tutors, only on failure. Fine.

### P-06 Tutor Home = Today: REVISE
Counts, from code:
- Nudge to assign, today: tap "Assign" on a nudge (`ClassSnapshot.tsx:163` calls `onGo("homework")` and sets no intent) = 1 tap to land on the Homework tab, 1 tap "Set homework" (`#hub-new-homework`), 1+ taps to pick the student (list of 30), then lesson, due date, save. About 4 taps before the lesson.
- After (nudge opens `HomeworkForm` with `childIds: [id]`, via the existing `setHubIntent({kind:"homework", childIds})` that `StudentsPanel.tsx:504` already uses): 1 tap to a form with the student ticked. Saves 3 taps and one 30-row scan, every time. KEEP this part. Cheap: the plumbing exists.
- The "kind parent message template": a template I must read and edit is a decision. Make it opt-in on the form (one pre-filled line I can ignore), never a gate.
- Overdue landing: today `onClick={() => go("homework")}` lands on the default inbox, where "overdue" means scrolling past To-mark. Landing on the overdue filter = saves 1 to 2 taps and a scroll. KEEP. The Homework panel already has a `filter` state (`data-filter`); preset it.
- "One Set homework button": already exists as the "Assign homework" quick action (`ACTIONS` in `TutorHome.tsx:50`). A second one is clutter. DROP.
- "Today first, stats collapsed": the stat tiles are in `HubHero`, not TutorHome (P-02 already handles them). Do NOT reorder TutorHome. The 2-column top row (Next lesson | Needs your attention) is already Today. Moving the quick-action grid or Attention card changes where my thumb lands.
- Workflow at risk: Attention rows for written answers call `setHubIntent({kind:"marking"})` then `go("quizzes")` / `go("diagnostic")`. These must keep working after any tab change (see P-10).

### P-07 Accessibility: KEEP
- No tap cost. Condition: "move focus to the panel heading after a tab switch" must not scroll the page or steal the position from the strip on a phone. Escape fix: the topmost layer only is right (Escape currently closes too much).
- Darker tokens: fine. Status colours must stay distinguishable at a glance (overdue red vs quiet gold).

### P-08 Tools ready-only: KEEP
- Removes ~138 tiles of noise; costs 0 taps for me. "What's coming" fold: 1 tap for the curious. Persist the fold state so it does not re-collapse each visit.

### P-09 Curriculum map collapsed: KEEP, REVISE
- Today: scroll past a 200-cell grid on every Lessons visit. After: 0 scroll; 1 tap to open when I want the gaps. Owner previously asked for it first; that is a conflict for them to resolve, not me.
- Revise: remember open/closed per device (like the hero). Otherwise I pay 1 tap on every visit if I use it. Put the "9 gaps" text on the summary line so I only open it when the number is non-zero.

### P-10 Tabs 11 to 9: REVISE (rename + alias, no merge tonight)
- What I save: nothing on the 40th Tuesday. A tab strip is one tap either way; the strip already scrolls (`HubTabs.tsx`). Merging Placement into Quizzes ("Starting quizzes" filter that keeps its sub-tabs) is nested navigation: Quizzes tab (1) then filter (2) then sub-tab (3), versus Placement tab (1) then sub-tab (2) today. That is +1 tap for anyone who marks or sets placement work. Tools inside Lessons: +1 tap the same way.
- Silent breakage (this is the dangerous one):
  - `LearningHubApp.tsx:43` reads `?tab=` into `picked` with a raw cast and NO validation; `:109` does it again on navigation. `TAB_ORDER` (`panels.tsx:31`) is the only list. An unknown key would land on nothing or Home.
  - Live deep links: server notifications write `?tab=questions&open=doubt:<id>` (`server/src/routes/hub/doubtsApi.ts:56`); `family/link.ts` documents `?tab=quizzes|notes|homework&child=&open=...&hw=`; Home calls `go("diagnostic")` with a `marking` intent; users have bookmarks of `?tab=diagnostic` and `?tab=tools`.
  - Muscle memory: tab order is fixed. Removing two tabs shifts positions of every tab to the right. I hit Homework and Lessons on a phone by position.
- Migration must preserve: an alias map applied in BOTH `picked` initialisation and the `linkSearch` effect (`diagnostic` maps to quizzes + starting-quizzes filter; `tools` maps to lessons + tools view; `questions` maps to Messages, with `open=doubt:` intact); the `marking` intent must still land on the placement queue; the same order for the surviving tabs; the unread-questions badge stays on Messages.
- Smallest change with the win: do the vocabulary rename ("Messages", "Starting quiz", "Set homework") which costs nothing, and add the alias map defensively now. Defer the merge until R-2 (one Mark queue) exists; that is where merging pays for itself.

### P-11 Safeguarding: KEEP (no UI, additive).

### P-12 First-run: KEEP, REVISE
- First-run guide only shows at zero data: no cost to me at 30 students.
- Year + Subject filters in the homework lesson picker: with 30 students of mixed years, a default chosen from "the student's year" is wrong for a group. Default only when exactly one student is ticked, and show an "All years" chip so 1 tap clears it. Never persist a hidden filter that makes lessons vanish.

### P-13 Kind child language: KEEP for child screens only. Tutor and parent wording stays factual. My Attention card says "Overdue"/"Late"; if that becomes "Waiting for you" on my screen I cannot triage.

## Roadmap items

- R-1 One Assign sheet: today there are about 14 entry points and they matter to me: student card (pre-ticks students via `childIds`), group quick action (`groupId`), a lesson's "Set as homework" (`assessmentId`/`noteIds`/`packNoteId` prefill), Home quick action. A single sheet is good only if EVERY one of those still opens it pre-filled with 0 extra taps. Batch action to preserve: set the same homework for a whole group in one save.
- R-2 One Mark queue: today marking is homework inbox (Mark & next walks the queue, `MarkDialog.tsx`), quiz written answers, placement written answers, three places. One queue with "Mark & next" across all is the biggest saving on a Tuesday. Preserve "Mark & next" and keyboard-free one-tap flow.
- R-4 Option A navigation: DROP for now. It moves every tab. If shipped, bookmarks and notification links must redirect.

## Things I depend on and will not have silently changed
1. `?tab=` deep links and their `open=`/`child=`/`hw=` params, including server-generated notification links (`tab=questions&open=doubt:`), plus `tab=diagnostic` and `tab=tools` bookmarks.
2. Tab strip order and the quick-action grid position on Home (`ACTIONS`: New lesson, New quiz, Assign homework, Schedule video lesson, Enrol student, plus Teach in person).
3. Batch and prefill paths: `setHubIntent` kinds (`homework` with `childIds`/`groupId`/`packNoteId`, `marking`), "Mark & next", group-level Set homework, the saved hero Hide/Show preference.

## The 3 things I will never tolerate
1. Any change that adds a tap or a confirm to marking, setting homework, or Rejoin/starting a lesson.
2. Deep links, bookmarks or notification links that stop landing where they did (no unvalidated `?tab=` falling to Home).
3. Moving things I already reach without looking (tab order, Home quick actions), or a filter/default that hides my students' work silently.
