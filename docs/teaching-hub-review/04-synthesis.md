# 04 - Synthesis: themes, conflicts, keep list, brief check

Inputs read in full: 00-brief.md, 01-inventory.md, 01b-actions.csv, 01c-data-truth.md, all 14 journals in 02-personas/, and 03-friction-log.csv (233 rows). Ids (T1-03 etc.) are friction-log ids; `01c #n` is the ranked discrepancy list in 01c-data-truth.md section 7; file:line references are as cited by the persona that found them (paths under `features/learninghub/` unless stated). I re-read no product code; where a claim is from a code-walk it is code-walk evidence, not a live observation.

## 0. Read this first: evidence quality and log defects

- Every journal is a code-walk (no persona ran the app). The only live evidence is 5 desktop screenshots in screenshots/before/ (phone and tablet capture failed; the API was shared and overloaded, so the 35-40 s load time (T1-11) is an upper bound, not a typical figure). 01c marks 4 items 'needs DB / live run' (the 424 extra notes, the stale-banner `updatedAt`, the parentUid mismatch behind 78% vs no results, the Homework tab failure mode).
- The merged 03-friction-log.csv has defects: row C3-07 has an unescaped quote that shifts its columns (it parses as severity 0; the persona file 02-personas/C3-friction.csv shows severity 2, which I use); `frequency` is blank on 195 of 233 rows and `burden_type` on 195, and the `round` column is 1 on every row. Frequency therefore cannot be used to weight themes; I weight by severity and by how many personas hit it.
- Severity totals used below: 4 = 28, 3 = 105, 2 = 94, 1 = 6 (233).
- Tools counts disagree: the brief's live walkthrough says 216 tools / 78 ready; T1's code count says 155 catalogue rows / 34 implemented (T1 scenario 13). Unreconciled; do not quote either as fact in the UI copy.
- The brief says the broadcast banner sits on 'most tabs'; 01c #13 finds it mounted only on Home and Lessons (TutorHome.tsx:151, NotesPanel.tsx:644). I side with the code.
- T1 corrected 01-inventory: the Home 'Needs a nudge > Assign' chip does not open the shared homework flow, it only calls `onGo("homework")` (ClassSnapshot.tsx:163; T1 journal header, T1-05).

## 1. Themes (233 frictions clustered into 13)

Themes are labelled TH1-TH13 so they cannot be confused with persona ids (T1, T2 ...). Each friction is assigned to exactly one theme (assignment list in Appendix A). Sorted by count; the 'sev 4' column is the number of severity-4 rows.

| Rank | Theme | Rows | Sev 4 / 3 / 2 / 1 | Personas that hit it |
|---|---|---|---|---|
| 1 | TH10. SEND comfort, tone and gamification | 27 | 6 / 8 / 12 / 1 | C1, C2, C3, C4, T4, X2 |
| 2 | TH8. Messaging, nudges and safeguarding | 25 | 3 / 14 / 7 / 1 | C2, C3, T1, X2, X3 |
| 3 | TH11. Parent verdict, notifications, language | 25 | 3 / 12 / 9 / 1 | P1, P2 |
| 4 | TH9. Child Home, kid-mode dead ends, age bands | 24 | 4 / 11 / 9 / 0 | C1, C2, C3, C4, T4 |
| 5 | TH2. Tutor Today and first-run | 21 | 2 / 8 / 10 / 1 | T1, T2, T3, T5, X3 |
| 6 | TH13. Accessibility (WCAG 2.2 AA) | 20 | 2 / 6 / 11 / 1 | X1 |
| 7 | TH5. Library scale, builder, curriculum map, Tools | 19 | 0 / 7 / 12 / 0 | C2, C3, P1, T1, T2, T5, X3 |
| 8 | TH1. Structure, tabs and vocabulary | 16 | 1 / 10 / 5 / 0 | C1, C2, P2, T1, T2, T5, X3 |
| 9 | TH3. Assign has too many doors | 15 | 1 / 6 / 8 / 0 | T1, T2, T4, T5, X3 |
| 10 | TH12. Trust, errors and speed | 15 | 1 / 10 / 4 / 0 | C1, C2, C4, P1, P2, T1, T3, X3 |
| 11 | TH6. Oversight, settings and reporting | 11 | 2 / 6 / 3 / 0 | T2, X3 |
| 12 | TH7. Live, in-person and broadcast | 9 | 2 / 4 / 2 / 1 | P1, T3, X3 |
| 13 | TH4. Marking: many queues, no batch | 6 | 1 / 3 / 2 / 0 | T1, T3, X3 |

Reading the ranking: by raw count the five biggest are SEND comfort and tone (27), messaging and safeguarding (25), parent verdict and language (25), child Home (24) and tutor Today and first-run (21). By severity-4 count the order is SEND comfort (6), child Home (4), messaging/safeguarding and parent (3 each), then Today, oversight, live and accessibility (2 each). The tutor-structure themes (TH1 tabs 16, TH3 assign 15, TH4 marking 6) are smaller in row count but sit under 4 of the 5 top tutor jobs, so they are ranked by job in the scorecard, not by count.

### TH10. SEND comfort, tone and gamification - 27 rows (sev 4/3/2/1 = 6/8/12/1); hit by C1, C2, C3, C4, T4, X2

There is no per-child accommodation profile at all. Timers auto-submit, streaks/XP/confetti cannot be switched off, nothing is read aloud, and blame-toned wording ('Overdue', 'Not yet', red triangles) reaches children.

Worst evidence:
- T4-01 (sev 4): "No per-child accommodations: extra time, no timer, reading options, reduce motion, hide streaks, read-aloud" (hubConfig.ts:7-43).
- C4-01 / T4-02 (sev 4): countdown pill red under 60 s, auto-submit at zero, leaving keeps the clock running, extra time needs a cloned quiz (TakeAssessment.tsx:77,140-147,260,278,287,354).
- C4-02 / C1-02 (sev 4): "No read-aloud ... speechSynthesis exists only inside one phonics block" (lesson/slides/blocks.tsx:28-39,236).
- T4-03 (sev 4): flame streak, XP, confetti and streak reset on a wrong answer cannot be turned off (StudentHome.tsx:138-142; LessonPlayer.tsx:255-258,292,315-316).

### TH8. Messaging, nudges and safeguarding - 25 rows (sev 4/3/2/1 = 3/14/7/1); hit by C2, C3, T1, X2, X3

Tutor messaging is an admin inbox, nudges are mislabelled, and the safeguarding audit found three severity-4 gaps: unrestricted tutor-to-child threads, impersonated writes stamped as the tutor, and child messages missing from erase/export.

Worst evidence:
- X2-01 (sev 4): "Any in-scope tutor can open a 1:1 thread to any enrolled child; no assignment check or DSL visibility" (doubtsApi.ts:96-116; teachingCommon.ts:40-53).
- X2-08 (sev 4): "Writes stamped as the tutor; no actedBy; audit is console.warn plus optional log call" (role.ts:138-150; platform.ts:32-40). X2 recommends BLOCK for any redesign that keeps this.
- X2-04 (sev 4): hubDoubts not erased or exported (hubPrivacy.ts:24-132).
- T1-26/T1-27: unread only as a badge on the clipped 11th tab; three nested accordions, ~3 taps per thread (LearningHubApp.tsx:93-97,180; QuestionsPanel.tsx:162-206).
- T1-05: 'Needs a nudge' chip says 'Assign' and opens Homework with no student (ClassSnapshot.tsx:163).

### TH11. Parent verdict, notifications, language - 25 rows (sev 4/3/2/1 = 3/12/9/1); hit by P1, P2

A parent needs one verdict ('on track? anything overdue? do I need to act?'). Home speaks to the child, notifies only about what the tutor did, and the whole hub is 0% translatable.

Worst evidence:
- P1-01 (sev 4): "No on-track/overdue verdict; overdue is only in the Homework card lower down" (StudentHome.tsx:106-118 vs :180-200).
- P1-03 (sev 4): "Only tutor actions notify; nothing for overdue homework / lesson starting soon / child not logged in" (hubNotify.ts callers; notify.ts:50-51).
- P2-01 (sev 4): "Language switcher changes nothing inside the hub; 0 of hub files use useI18n; page flips RTL for Urdu/Arabic with English text" (lib/i18n/messages/areas has no hub area).
- P1-09 / P2-12: 'Hand over to Ava' is the biggest button, fires with no confirm, and its explanation is hidden on phones (FamilyContext.tsx:111-140).

### TH9. Child Home, kid-mode dead ends, age bands - 24 rows (sev 4/3/2/1 = 4/11/9/0); hit by C1, C2, C3, C4, T4

Kid mode is the parent dashboard with fewer tabs. The one answer a child needs ('what do I do now') is the last block, two of its buttons do nothing, and there is no teen mode.

Worst evidence:
- C2-01 (sev 4): "Join lesson does nothing: go('live') is blocked because live is not in KID_TABS" (KidMode.tsx:15; LearningHubApp.tsx:85; StudentHome.tsx:150).
- C3-01 (sev 4): "No teen mode: only a parent view or Kid mode titled '{name}'s learning' with a 'Grown-ups' lock" (KidMode.tsx:52-58).
- C3-02 (sev 4): kid mode hides Progress, Tools and Live so weak topics are unreachable (KidMode.tsx:15); C3-03 (sev 4): topics sorted A-Z so the weakest is buried (ProgressView.tsx:48,109).
- C2-03: 'Keep going' is the last block; 8+ blocks and ~200 words before the first action (StudentHome.tsx:252).

### TH2. Tutor Today and first-run - 21 rows (sev 4/3/2/1 = 2/8/10/1); hit by T1, T2, T3, T5, X3

Home answers 'how big is my catalogue' before 'what do I do at 7pm', and a brand-new tutor cannot get past step one because a child cannot be created by name.

Worst evidence:
- T5-01 (sev 4): "Cannot enrol a child I name myself: empty list says No children to enrol yet; only route is invite link + parent account" (StudentsPanel.tsx:224-225,101-130).
- X3-12 (sev 4): "Enrol then start a Year 3 costs ~23 clicks across Students, Placement, Lessons, Messages" (X3 journal scenario 4).
- T1-10: "'Start lesson' only switches to the Live tab; 3-4 taps to be in the room" (NextLesson.tsx:144, TutorHome.tsx:163).
- T1-09 / X3-05: four vanity tiles and ~220 words, 10 blocks above tonight's job (HubHero.tsx:129-157).

### TH13. Accessibility (WCAG 2.2 AA) - 20 rows (sev 4/3/2/1 = 2/6/11/1); hit by X1

Better than typical (real focus traps, roving tablist, keyboard alternatives for every drag, reduced motion) but not AA yet. Two blockers and a colour-token problem that is one fix.

Worst evidence:
- X1-01 (sev 4): whiteboard cannot be drawn on by keyboard (BoardCanvas.tsx:121-127; controller.ts:1183-1215).
- X1-02 (sev 4): 'Needs your attention' row switches tab but drops focus to body, 15-25 extra Tab presses (TutorHome.tsx:169-173; LearningHubApp.tsx:263).
- X1-05: white on --green 2.74:1, --sem-ok 2.28, gold text 1.79 (globals.css); the AA-safe --hub-green-fill (5.41) already exists and is not used everywhere.
- X1-03: assessment dialog Escape (stopPropagation on document) prevents ToolHost closing (shared-assess/ui.tsx:236-252 vs ToolHost.tsx:47).

### TH5. Library scale, builder, curriculum map, Tools - 19 rows (sev 4/3/2/1 = 0/7/12/0); hit by C2, C3, P1, T1, T2, T5, X3

Every library tab opens on the whole catalogue; builders put configuration before content; the curriculum map leads the Lessons tab and is echoed into child and parent screens where it reads as adult content.

Worst evidence:
- X3-10: Lessons, Quizzes, Flashcards, Placement and Tools each open on the whole catalogue (8,971 quizzes, 51,873 cards, 7,894 lessons) (NotesPanel.tsx).
- T1-18: builder puts ~250 words of config before the first question (AssessmentBuilder.tsx:164-244); T1-20: no Duplicate quiz and 'Edit existing' edits the original (AssessmentList.tsx:314-319).
- T1-25 / X3-20: curriculum heat-map sits above the lesson list and is duplicated in Progress with a different lesson count (NotesPanel.tsx:646; 01c #10).
- T1-30: ~120 of 155 tool tiles are greyed 'In build' / 'Coming soon' (ToolsPanel.tsx).

### TH1. Structure, tabs and vocabulary - 16 rows (sev 4/3/2/1 = 1/10/5/0); hit by C1, C2, P2, T1, T2, T5, X3

The hub is organised like the database, not like the tutor's day: 11 tabs (panels.tsx:31), 3-4 levels deep, five names for two teaching modes, and different names for the same thing per role. The tab strip is the same component for a tutor (11), parent (10) and 7-year-old (7).

Worst evidence:
- X3-01 (sev 4): "11 tabs organised by data type not by tutor job; strip scrolls, last tab cut off at ~900px" (panels.tsx:31 TAB_ORDER).
- T5-07: "~3.5 tabs visible at 390px, Homework needs 2+ swipes, 6 tabs irrelevant on day one" (HubTabs.tsx:113 hides icons below 1024px).
- X3-25: "hubLessons holds live sessions while hubNotes holds lessons"; Notes vs Lessons; diagnostic / Placement / Starting quiz / Baseline (names.ts).
- X3-15: "Live lessons, Schedule video lesson, Teach in person, broadcasting, Rejoin: five names for two modes" (LiveLessonsPanel.tsx).

### TH3. Assign has too many doors - 15 rows (sev 4/3/2/1 = 1/6/8/0); hit by T1, T2, T4, T5, X3

'Assign' has 14 doors and 3 code paths, each with its own name and defaults, and the pickers behind them cannot filter by year, so the tutor cannot verify what they are assigning.

Worst evidence:
- X3-02 (sev 4): "Assign has 14 entry points and 3 code paths (shared intent, direct form, 2 direct-post mini-forms)" (HomeworkForLesson.tsx:80,108; inperson/api.ts:48).
- T1-12: "Search returns 6 titles only, no year/subject/topic" (hwPack.tsx:30,45); T5-03: "'Year 3 fractions' phrase finds nothing" (hwPickers.tsx:85-91).
- T1-14: full form uses a native date input, 'Tomorrow' chips exist only in the lesson mini-form (HomeworkForm.tsx:168-169 vs HomeworkForLesson.tsx:92-97).
- T1-24: flashcard select "lists every topic in the account (about 2,457)" (HomeworkForm.tsx:211-214).

### TH12. Trust, errors and speed - 15 rows (sev 4/3/2/1 = 1/10/4/0); hit by C1, C2, C4, P1, P2, T1, T3, X3

The hub tells different stories about the same fact, shows failures as empty states, and speaks developer to children.

Worst evidence:
- X3-28 (sev 4): Home says '2 homework due', the Homework tab says 'No homework right now' because a failed fetch renders the empty state (StudentHome.tsx:50-54,98 vs StudentHomework.tsx:41-43,60; 01c #1).
- C2-04 / P1-15: 'My level 75%' (mean) vs '78%' ring (strongest subject) vs 'Latest results: none' (mastery.ts:24 vs attempts.ts:395-397; 01c #2, #4).
- X3-06: header 'Lessons 7,894 / Subjects 7 / Worksheets 1' count notes, distinct topic strings and attachments (learningHub.ts:604-611; 01c #3, #11).
- C1-05: "The server didn't respond within 15s (http://localhost:4000). Is the API running?" shown to a 6-year-old (homeKit.tsx:130; lib/api.ts:130); P2-10: raw e.message (types.ts:144).
- T1-11: every tab remounts and refetches (LearningHubApp.tsx:263 `key={active}`), no client cache for panel data (01-inventory).

### TH6. Oversight, settings and reporting - 11 rows (sev 4/3/2/1 = 2/6/3/0); hit by T2, X3

A centre lead cannot see per tutor, cannot standardise, and cannot hand a parent a term report. Settings live in another app behind an icon.

Worst evidence:
- T2-01 (sev 4): "Counts are business-wide; no per-tutor view of overdue/unmarked/quiet" (TutorHome.tsx:165-172; tutorUid used only for the mine filter, StudentsPanel.tsx:369).
- T2-07 (sev 4): "No print / PDF / share for a parent; screen also shows tutor controls" (no print handler in progress/).
- T2-03: pass mark change "only affects NEW quizzes; no apply-to-all" (SetupApp.tsx:2527); T2-04: show-right-answers has no per-quiz override (AssessmentBuilder.tsx:129).
- T2-06: progress is 'last 20 quiz scores', not the term; placement baseline excluded (TrendChart.tsx:13, ProgressView.tsx:96-98).

### TH7. Live, in-person and broadcast - 9 rows (sev 4/3/2/1 = 2/4/2/1); hit by P1, T3, X3

A forgotten broadcast cannot be ended, the in-person flow has no register, and capture does not scale to 20 children.

Worst evidence:
- T3-01 (sev 4) / X3-16 (sev 4): "endRemoteSync has no UI caller; stale banner persists days" (api.ts:51; remoteSyncApi.ts:66,72,242,277,283; 01c #6).
- T3-11: red 'Leave lesson' (testid remote-sync-end) does not end the session (RemoteSyncApp.tsx:247,284-285).
- T3-02 / X3-18: no register step, no attendance record or export (SetupStep.tsx:153; InPersonApp.tsx:173).
- T3-03: 20 kids x 10 questions is 200+ taps; only 'Everyone got it' as bulk (CaptureGrid.tsx:84,121).

### TH4. Marking: many queues, no batch - 6 rows (sev 4/3/2/1 = 1/3/2/0); hit by T1, T3, X3

Marking is one job spread over three queues with two UIs and no batch. Small in row count, large in weekly minutes.

Worst evidence:
- X3-03 (sev 4): "Marking split over 3 queues (Homework To mark, Quizzes Marking, Placement Marking)" (TutorHome.tsx:168-171).
- T1-01: "No batch marking ... 'Out of' defaults to 10 and is not remembered" (MarkDialog.tsx:81,131-137); T1 sc 2: ~65 actions for 16 items.
- X3-04: clearing 9+7 costs ~28 clicks; 'Mark and next' exists only for homework (MarkDialog.tsx:12).
- T3-08: in-person Results shows 'written to mark' with no link to the queue (ResultsPanel.tsx:88).

Cross-theme dependency worth stating once: TH12 (trust) has to be fixed before TH2 (a new Today screen) or TH9 (a new child Home) is built, otherwise the new screens repeat the wrong numbers (X3 sequencing, and 01c ranks #1, #2, #3, #6, #8).

## 2. Cross-persona conflicts and how to resolve them

'Decision' says whether the resolution is safe to make in the design, or needs the owner. Four need the owner (marked OWNER: C-2, C-3, C-6, C-9); the rest can be resolved in the design.

### C-1 Density vs calm.
- **Who wants what:** T1, T2, T3 want batch actions, dense tables, business-wide counts (T1-01, T2-09, T3-03). T4, C4, C1 want one thing at a time, no red, no streaks (T4-01, C4-04, C1-01). Same screens, opposite needs (e.g. StudentHome is currently one layout for all: C3-01, brief 8.2 #10).
- **Resolution:** One data model, two presentations, chosen by role and age band, never by a global toggle. Tutor screens stay dense but with the density behind 'Show more' (T5 first-run shows the cost of always-dense). Child screens become age-banded (X3 section 4: KS1 3 icons, KS2 4 tabs, KS3-4 4 tabs) and carry a per-child Comfort profile set by the tutor (T4-01, C4-12: extra time, no timer, no streak/XP, reading size, read-aloud). Density is not a per-persona choice; accommodation is a per-child setting.
- **Decision:** Safe to design. Default for the profile is the OWNER item under C-3.

### C-2 Parent wants a verdict; kid-mode wants privacy and no shame.
- **Who wants what:** P1-01 and P2-05 want 'Ava: 1 homework overdue, you need to do X' and 'Nothing needed from you'. C4-05, T4-04 and C2-05 want the child never to see 'Overdue', 'late', 'Not yet'. Kid mode currently hides the parent summary and 'Ask your tutor' (StudentHome.tsx:104 `!kidMode`; FamilyContext.tsx:147). T4 wants scores hideable per child; a parent verdict that surfaces the score defeats that. C3 (teen) wants Progress and own autonomy, which needs a teen mode that does not exist (C3-01) and widens who sees what (X2).
- **Resolution:** One status model, two voices. The same fact 'Fractions sheet, due Tue, not handed in' is rendered as 'Overdue by 3 days' (parent, red/gold, actionable) and 'Waiting for you, due Tuesday' (child, calm, no red). Parent verdict sits first on the parent Home, outside kid mode, with a 'Nothing needed from you' state; it never reveals a percentage the tutor has hidden for that child. The gate stays. Do not put the parent verdict inside kid mode.
- **Decision:** OWNER: (a) may a tutor hide scores from the parent as well as the child? (b) at what age does a teen get their own login and does the parent still see the tutor thread (X2 finds threads are delivered to the parent account today).

### C-3 Curriculum map: first on Lessons vs move it.
- **Who wants what:** The owner earlier asked for the curriculum map first on Lessons (recorded as a 'conflicting instruction' in 06-proposals.md:56; I found no earlier text of it in the pack). Brief 7A.2 #8 says it is noise for a tutor picking tonight's lesson and should move to Progress/Library. Evidence splits: T2 (centre lead) finds it genuinely useful for audit ('no Year 1 fractions') but says it is a planning tool that every tutor hits every visit (T2 (g)); T1 skips it for scenarios 3 and 10 (T1-25); C3 (teen) finds it partly useful and wants mastery colouring on Y10-11 only (C3-10); C2, C1, P1 read it as adult content in a child/parent screen (C2-06, P1-11, X3-31); 01c #10 shows its lesson count disagrees with the header.
- **Resolution:** Keep the data, change the placement. Tutor Lessons opens on search + the tutor's students' years, with a one-line coverage summary ('172 of 185 areas covered - 9 gaps') that expands to the grid; the full grid also lives in Library 'Coverage' and Progress, one component not two (X3-20). Child KS1/KS2: hidden. Child KS3-4: a 'my map' coloured by mastery, in Progress not Lessons. Parent: 'What Ava has covered', third person, under Progress (P1-11). Curriculum values remain inside filters (year -> area -> lessons).
- **Decision:** OWNER: this reverses an explicit earlier instruction; both variants are one-line reversible per 06-proposals.md:56.

### C-4 Speed of marking vs the family being told.
- **Who wants what:** T1/T3 want 'full marks to all' and remembered 'Out of' (T1-01, T3-09). T1 also lists 'The family is notified when you save' as a keep (MarkDialog.tsx:117,151). A batch action fans out N notifications and N results to families.
- **Resolution:** Batch marking is fine if it is a review-then-confirm step ('Give 10/10 to these 6: families will be told') with per-item exceptions, and Mark and next keeps feedback chips. No silent bulk marks.
- **Decision:** Safe to design.

### C-5 Tutors want fast direct nudges; the DSL wants restricted child contact.
- **Who wants what:** T1-05/T1-06 and X3-07 want 'Check in' in two clicks with a kind template. X2-01/X2-02/X2-03 (sev 4/3/3) find any in-scope tutor can open a 1:1 thread to any enrolled child, with no assignment check, no contact-detail scan and no DSL view; today's nudge would go to the child's thread.
- **Resolution:** Route the nudge to the family (parent account), pre-filled and kind, with 'The family is told' shown (as MarkDialog does). Tutor-to-child threads require the child to be assigned to that tutor, scan for phone/email/links, keep a DSL-readable log, and copy the parent (X2 BLOCK list items 2 and 3). The impersonation fix (actedBy stamping, X2-08) is a blocker, not a conflict: no redesign ships that keeps writes-as-tutor unattributed.
- **Decision:** Mostly safe; default recipient (parent vs child) is the OWNER point inside C-2(b).

### C-6 Streaks and gamification.
- **Who wants what:** C2 keeps the flame ('Keep it going tomorrow', C2 keep 5); C3 finds it a kids' game (C3-08, C3-11); C4 and X2 want it off, and X2-13 cites the ICO Children's Code on nudge techniques; brief 8.3 says 'without casino gamification'.
- **Resolution:** Default OFF for KS1 and for any child with a Comfort profile; opt-in for KS2; teens get progress, not streak flames. Warm-up 'Yes! / Spot on!' praise stays (C1 keep 2, C4) because it is feedback, not a streak. One switch per child (T4-01), not a tenant-only switch (T4 gap 3).
- **Decision:** OWNER: default state (on/off) for KS2, since X2 recommends off by default.

### C-7 Tools: SEND asset vs tab clutter.
- **Who wants what:** T1-30, T1-31, T2-11, X3-19, T5-11 want the 138 unbuilt tiles hidden and Tools moved out of the tab strip. T4 (keep 4) finds the built tools SEND-aware and keyboard-first; C4-10 cannot reach them in kid mode; X1 finds tool dialogs among the best-built parts.
- **Resolution:** Hide 'In build / Coming soon' by default (one checkbox default flip, T1 and T4 agree). Tools becomes a launcher in Teach and inside quiz/lesson players, not a peer tab; a child can meet a tool inside an assigned item.
- **Decision:** Safe to design.

### C-8 Oversight vs least privilege.
- **Who wants what:** T2 wants per-tutor counts and a pick-a-tutor scope (T2-01, T2-10). X2-06/X2-15 want tutors not to see each other's children and want less, not more, cross-tutor visibility.
- **Resolution:** Owner/centre-lead views get tutor columns and filters; tutor-to-tutor visibility stays as scoped (franchise rules hold: X2 (c) ACCEPT). Add per-tutor assignment as the basis for both (tutorUid exists, types.ts:76).
- **Decision:** Safe to design.

### C-9 Translate the hub vs churn in copy.
- **Who wants what:** P2-01 (sev 4) needs the hub translatable; the vocabulary rename (X3-25) and rewrite for reading age (P2 table, C1) change most strings.
- **Resolution:** Do the vocabulary and plain-language pass first, then extract strings once. Until then, at minimum flip nothing to RTL without translation (P2-01) and make dates locale-aware (P2-15).
- **Decision:** OWNER: which of the 11 configured languages (pl ro ur pa bn ar pt es fr cy) are in scope first.

### C-10 Placement everywhere vs nowhere.
- **Who wants what:** T5-09 and X3-11: optional, one-off, should fold into Enrol. T3: a camp does not need it. Child side shows 'Starting quiz' with '5 of 8 done' (tutor information) and parents see 'Placement test' unexplained (P2-04). T2-08 wants tenants to hide it.
- **Resolution:** Enrol step 'Starting quiz: on / skip' with the default from settings; on the student profile as a status; child sees only the ones set for them, in KS-appropriate words; authoring in Library. Tenant tab visibility handled by C-1 structure (T2-08).
- **Decision:** Safe to design.

## 3. 'Keep this, it's good' list (deduplicated across all 14 journals and brief 7A.2 #17 / 8.2 #12)

Grouped by area. Each item names who kept it. Nothing here should be removed by a redesign without a replacement that does the same job.

**Tutor Today and enrol**
- 'Needs your attention' as a concept: big numbers, plain rows, count-up, 'All clear' with a tick (T1 keep 3, T2 keep 1, X3, brief 17; TutorHome.tsx:26-45).
- The six quick actions as a verb list (brief 17, X3): keep the verbs, fix the order and the day-one weight (T5-02).
- Home 'Enrol student' lands on the open modal, one tap (T5 keep 1; TutorHome.tsx:70-71, StudentsPanel.tsx:341-342).
- Empty states that teach: 'Set your first homework', 'Schedule your first live lesson ... no links to paste, nothing to install', 'Enrol your first student' (T5 keep 2; LiveLessonsPanel.tsx:208-209).
- Enrol modal defaults: subjects blank = all, year 'Automatic - from their date of birth', friendly confirmation (T5 keep 3; StudentsPanel.tsx:62,524).
- Student card action trio Progress / Message / Set homework, with Message preselecting the child (T1 keep 5, brief 17; StudentsPanel.tsx:377,502-504).
- Groups with one-click Homework/Quiz/Lesson and live status ('3 open . 1 to mark', '2 overdue') (T1 keep 5, T3 keep 5, brief 17; GroupsSection.tsx:66-96,244-257).
- 'Teach in person' as a first-class mode (brief 17, T3, X3).
- The Waive placement option (brief 17).

**Assign and mark**
- 'Base it on a lesson' homework pack that fills title, instructions, quiz, lessons, flashcards and due date, all editable (T1 keep 1; hwPack.tsx:37, HomeworkForm.tsx:68-72).
- Safety nets in the homework form: draft quiz/lesson publish inline; 'N students won't be able to open this quiz' with one-tap remove (T1 keep 4, T5 keep 4; HomeworkForm.tsx:174-179,198-202,231-236).
- MarkDialog 'Mark & next', feedback chips, 'Use the quiz score', and 'The family is notified when you save' (T1 keep 2; MarkDialog.tsx:14,81,117,151).
- Homework tab status counts Inbox / To mark / Marked / Not handed in and the first-load filter that picks something useful (brief 17, T1 keep 3; TutorHomework.tsx:81-85).
- Lessons tab filters (subject + Year + server search + 'Set for children' on each row) get to Maths/Y3/fractions in ~6 taps (T5 keep 5; NotesPanel.tsx:652,279).
- PlacementGuide's 3-step explanation (T5 keep 5; PlacementGuide.tsx).

**Live and in person**
- Every tap persisted locally (`hubclass:<session>`) with Resume (T3 keep 1; useClassState.ts:20-36, SetupStep.tsx:118).
- 'Everyone got it', 'Show answer (tutor only)', 'Hide names' (T3 keep 2; CaptureGrid.tsx:84).
- Honest confirm: 'N answers aren't recorded - those score no marks' (T3 keep 3; CaptureGrid.tsx:113).
- Results table with hardest question and 'Set for the N under the pass mark' follow-up (T3 keep 4; ResultsPanel.tsx:38-58,122-130).
- Group quick-pick, 'Someone else turned up?', idempotent start/submit, 44-48px targets (T3 keep 5).
- Lobby lets you join without a camera and says so (P2 keep 3; Lobby.tsx:206,281).

**Centre lead and oversight**
- My students / Everyone pill showing both counts, persisted in one key across four tabs (T2 keep 2; mineKit.tsx:13,29-40).
- Setup rows carry plain hints ('keeps them back until the quiz is passed ...') (T2 keep 3; SetupApp.tsx:2533).
- Server scoping is safe by default: franchises never see other students, head-office content is read-only (T2 keep 4, X2 (c) ACCEPT; hubCore.ts:187-208).
- Tenant-editable attainment levels and subjects; trend chart with pass line in the tenant's words (T2 keep 5; TrendChart.tsx).

**Child experience**
- Kind level names 'Getting started / Getting there / Got it!' (C1, C2, C4, T4 keep; KidMode.tsx:14-17) - note C3-07 (teens) dissents.
- Calm amber 'Nearly there' / 'Worth another look', not red; pending marking shows an hourglass, never 0% (T4 keep 2, C4 keep 1, C1 keep 3; ResultBanner.tsx:12, ResultView.tsx:114,159).
- Warm-up feedback 'Yes! / Spot on! / Nice one!' with a gentle shake and the correct answer shown kindly (C1 keep 2; WarmupStep.tsx:17,80-81,114-116).
- Focus mode while taking a quiz, autosaved drafts across devices, 'Leave this quiz?', Resume, 'Continue quiz' on Home (T4 keep 1, C1 keep 5, C3 keep 5; TakeAssessment.tsx:146-150,168,353; StudentHome.tsx:77).
- One-tap flashcard review with time estimate; real spaced repetition; Space to flip, 1-4 rate (C2 keep 3, C3 keep 3, C4 keep 3; StudentHome.tsx:157-175; ReviewSession.tsx:87-99).
- Hand in homework and read the feedback on the same page (C2 keep 4; StudentHomework.tsx:61,204).
- Messages: only the child's own threads with the tutor, grouped by lesson - no open chat (C2 keep 5, X2; QuestionsPanel.tsx:265).
- Big targets where it counts: answer rows 56px, BigButton 48px, homework rows 56-68px (C1 keep 4; QuestionView.tsx:87, homeKit.tsx:119).
- Tool questions inside quizzes (geometry board, coordinate grid) with server-dealt problems (C3 keep 1; tools/ToolQuestion.tsx).
- Result page per-topic marks with pass-mark tick, weak topics worst first, 'This score comes from 3 of 12 topics so far' (C3 keep 2 and 4; ResultView.tsx:100,150-170; ProgressView.tsx:112-130).
- Grown-ups gate with a Back-button guard: a 6-year-old cannot fall out of kid mode (C1 keep 1, C2 keep 1; ParentGate.tsx, KidMode.tsx:33-49) - note the sum is too heavy for parents (P1-10, P2-13) and client-only (X2-10).

**Parent**
- 'Ava this week' summary strip (P1 keep 1, P2 keep 1; StudentHome.tsx:106-118) - the right idea, wrong position and wrong voice.
- Notification bodies name the child, item and due date/time and deep-link (P1 keep 2; hubNotify.ts hubHref).
- 'Overdue by 3 days' / 'Due tomorrow' red/gold tiles (P1 keep 3; hwTypes.ts:37-51) - for parents only, see C-2.
- Two-child pill switch and 'Who's learning?' confirmation before a runner starts (P1 keep 4; HubHero.tsx:88, FamilyContext.tsx:60-105).
- Email mute in the parent's face with the bell still recording (P1 keep 5; StudentHome.tsx:281, notify.ts:332).
- 'Ask your tutor' pre-addressed (P2 keep 2; LearningHubApp.tsx:212).
- Whole-hub failure copy 'We can't reach My Classroom right now. Check your connection, then try again.' with Try again (P2 keep 4, C4 keep 5; LearningHubApp.tsx:161-164).
- Result rings carry colour + number + icon; 44px tab targets (P2 keep 5; StudentHome.tsx:313, HubTabs.tsx `min-h-[44px]`).

**SEND-aware tooling**
- Opt-in timers, 'No pressure' tallies, 'No timers and no streaks' trainers, keyboard and numeric alternatives, 44px controls (T4 keep 4; TimedWriting.tsx:9, grammar/shared.tsx:42, GeometryBoard.tsx:254).
- Break-message wording 'Time for a little break. Look back over the lesson' and reduce-motion honoured almost everywhere (T4 keep 5, C4 keep 5; retake.tsx:66, lessonUi.tsx:28).
- Fix note: TimedWriting starts the timer ON at KS3+ despite its own comment (T4 sc 13; TimedWriting.tsx:23).

**Accessibility and safeguarding foundations**
- Real dialogs with focus trap and return, roving-tabindex tablist, keyboard alternatives for every drag interaction, AA-safe --ink-3 override inside the hub, --hub-green-fill 5.41:1 already defined (X1 verdict; kit.tsx:300-327, HubTabs.tsx, kit.tsx:99).
- Video rooms private, chat off, no recording property, first-name-only identity (X2 S-12; hubVideo.ts:108-118); doubt threads append-only and the family can read the whole thread (X2 (a); doubtsApi.ts:124-134).
- Franchise isolation holds (X2 (c)); mail suppressed unless MAIL_LIVE (X2 S-16 ACCEPT); no AI/LLM calls in the hub (X2 S-17).

**Data and content assets (brief 17)**
- The curriculum mapping data itself; privacy-enhanced YouTube (nothing loads until play) and the lesson page's video -> 4 steps -> worked example. No persona contradicted these, but none exercised YouTube (code-only); treat as unverified keeps.

## 4. Where the owner's brief points were confirmed / rejected / extended by evidence

Verdict key: CONFIRMED, PARTLY, CORRECTED (the brief is right about the symptom, the cause or scope differs), EXTENDED (confirmed and the evidence goes further). Nothing in 7A.2 or 8.2 was flatly rejected; four are CORRECTED or PARTLY.

### 4a. Tutor notes, brief 7A.2 items 1-17

- 1. **Eleven tabs: CONFIRMED and EXTENDED.** X3-01, T5-07 (3.5 tabs at 390px, Homework 2+ swipes, HubTabs.tsx:113), X3-08 depth 3-4; the same strip is 10 tabs for parents and 7 for kids. X3's Option A (Today, Students, Library, Teach, Progress, Messages) beats today on 8 of 8 scenarios and loses on none (X3 journal 3a).
- 2. **Library scale hostile: CONFIRMED and EXTENDED.** X3-10; T1-12 shows the same problem inside the homework picker (6 titles, no year, hwPack.tsx:30,45), so default scoping must be built into the pickers, not only the tabs.
- 3. **Subjects the tutor does not teach: PARTLY / CORRECTED.** Subjects are tenant data typed into topics (TopicFilter.tsx:14; HubHero.tsx:150), not a hub-wide fixed list (T2 (e)); the fix is a 'subjects I teach' setting, and it also drives child Starting quiz (8.2 #6) and flashcard availability (flashcardsApi.ts:87-100, 01c section 2).
- 4. **Numbers do not agree: CONFIRMED and traced.** 01c #3 (7,894 counts every note incl. boards and drafts: `learningHub.ts:604-611`; 7 subjects = distinct topic strings), #5 (Callum 22,229 = every year of enrolled subjects, flashcardsApi.ts:208-213), #11 (Worksheets 1 = attachments). No cross-tenant leak (01c section 0).
- 5. **Marking split three ways: CONFIRMED and EXTENDED.** X3-03, T1-01/02, ~28 clicks (X3-04) / ~65 actions (T1 sc 2); a fourth place is in-person Results (T3-08) and a homework with a linked quiz sends the marker to another tab (MarkDialog.tsx:115); Home's written count can under-report (attempts.ts:397, 01c 1.2).
- 6. **Assign has 5 entry points: CONFIRMED and UNDERSTATED.** 14 entry points, 3 code paths (X3-02; 01-inventory duplicate table), two of them direct-post mini-forms (HomeworkForLesson.tsx:80,108; inperson/api.ts:48). T1 corrected the inventory: the Home nudge chip opens no form (T1-05).
- 7. **Placement into Enrol: CONFIRMED, with a precondition.** Placement is optional by default (`requireDiagnostic:false`, hubConfig.ts:74) and nobody says so (T5-09); but the enrol wizard cannot yet create a child (T5-01), and start-a-student is 23 clicks today vs ~10 (X3-12).
- 8. **Lessons opens on the curriculum map: CONFIRMED for tutors, CONTESTED by evidence.** T1-25, X3-20 (duplicated, different counts, 01c #10). But T2 values it as an audit tool and C3 partly wants it; and it leaks into child and parent screens (C2-06, P1-11, X3-31). See conflict C-3 (also the owner's earlier opposite instruction).
- 9. **Tools shows 138 unbuilt tiles: CONFIRMED.** T1-30, T4-09, T5-11, T2-11, X3-19. EXTENDED: the built tools are the best-accessibility surface in the hub (T4 keep 4), a child cannot reach Tools at all (C4-10), and the 216/78 vs 155/34 counts disagree.
- 10. **Stale banner: CONFIRMED and root-caused, one part CORRECTED.** No UI caller for `endRemoteSync` (api.ts:51), 'Leave' deliberately keeps it live, `updatedAt` is bumped by Rejoin/heartbeat (remoteSyncApi.ts:66,72,242,277,283; 01c #6; T3-01, X3-16). CORRECTED: the banner is on Home and Lessons only, not every tab (01c #13). Home Next lesson duplicates Live (X3-17).
- 11. **Settings live outside the hub: CONFIRMED and EXTENDED.** Icon-only gear (T2-05, HubHero.tsx:72); pass mark only affects new quizzes (T2-03); show-answers has no per-quiz override though pass mark and retakes do (T2-04); SEND needs per-child overrides (T4-01). Contextual overrides already exist for retakes/pass mark in the builder (AssessmentBuilder.tsx:129).
- 12. **Students: groups first, students are primary: CONFIRMED.** T1-33, X3-14; and no student profile hub exists (X3-13). The card action trio is a keep (T1 keep 5).
- 13. **Messages is an admin inbox: CONFIRMED; the safeguarding brief is PARTLY over-cautious and PARTLY under-cautious.** T1-26/27/28, X3-22 confirm the inbox. 'No arbitrary New message recipients' is already true (recipients are enrolled children in the tutor's scope: teachingCommon.ts:40-53) but that scope is too wide (X2-01, sev 4) and there is no DSL log (X2-03). Parents can read the whole thread (X2 (a)).
- 14. **Loading and 'Checking access': CONFIRMED.** 35-40 s in the desktop capture (T1-11; overloaded shared API, so an upper bound), per-tab remount `key={active}` (LearningHubApp.tsx:263) with no panel cache (01-inventory). EXTENDED: failures render as empty states (X3-28), so slowness becomes wrong data.
- 15. **Layout at 700-900px is the phone layout: CONFIRMED with mechanism.** Portal drawer below 1024px (app/[portal]/layout.tsx:59, Header.tsx:178), tab icons `lg:` only (HubTabs.tsx:113), thread pane under the folder list (T1-28). T3 finds the in-person layer works at 768 (fixed inset-0, 44-48px), so the fix is the shell, not every screen.
- 16. **Language and naming: CONFIRMED and EXTENDED.** X3-25 and its vocabulary table; T5-04 ('Teaching Hub' card, 'Learning Hub' button); P2-11 'your providers'; 'Notes' key vs 'Lessons' label. The vocabulary in X3 section 5 is the single proposed set (open question: 'Class' for an event).
- 17. **Good things to keep: CONFIRMED with three qualifications.** Attention, quick actions, groups, Homework status counts, 'families are told', Waive, Teach in person all survive (Section 3). Qualified: quick actions are equal-weight and two work by regex-clicking hidden buttons (T5-02, X3-26, teachKit.tsx:310); 'kind mastery names' are jargon to EAL parents (P2-03) and cringe to teens (C3-07); the curriculum data is a keep but its placement is not (C-3).

### 4b. Child notes, brief 8.2 items 1-12

- 1. **Loading and errors dominate: CONFIRMED.** C1-05, C4-09, P2-10 (raw messages, homeKit.tsx:130, lib/api.ts:130, types.ts:144); answer to 'why is every tab a fresh fetch': `key={active}` remount and no panel cache. The whole-hub error copy is already good (LearningHubApp.tsx:161-164, C4/P2 keep), so the gap is the part-level errors and the 15 s timeout.
- 2. **Home does not answer 'what now': CONFIRMED by every child persona and parent.** C1-01, C2-03, C3-09, C4-04, T4-07: the answer already exists (`d.step`) but is the last card (StudentHome.tsx:252). No new logic needed; reorder.
- 3. **Quizzes shows the whole library, 599 locked: PARTLY.** 709 is already published-only, enrolled-subject and audience-filtered (01c section 4), not the whole 8,971; 599 are lesson exit quizzes gated by 'Finish a lesson to unlock', a different rule from 'locked' (X3-29). C3-13: teens want a weakest-first, unfinished-first sort and browse access, so 'Explore' opt-in should be age-banded.
- 4. **Home and Homework disagree: CONFIRMED and root-caused.** Homework tab turns a failed/slow fetch into 'No homework right now' (StudentHomework.tsx:41-43,60) and Home's 'due soon' includes overdue (StudentHome.tsx:54,98) (01c #1, X3-28). Direction of the mismatch still needs a live run.
- 5. **Lessons opens on a curriculum grid: CONFIRMED and EXTENDED.** X3-31, C2-06, C3-10; C3 wants a mastery-coloured Y10-11 version, P1-11 says parents read it as a child card. See C-3.
- 6. **Starting quiz offers French/German/Spanish: CONFIRMED in effect, CORRECTED in cause.** The family list filters to the child's enrolled subjects (01c section 4), so the languages appear because of enrolment (or blank = all, T5 (b)), not a missing filter; needs a live check. '5 of 8 subjects done' is tutor information, and parents meet 'Placement test' unexplained (P2-04).
- 7. **Messages is an email client: CONFIRMED, safety PARTLY better than feared.** C3-12 (3 taps, no photo), T1-27; the child can only message their own tutor in their own threads (C2 sc 6, X2). EXTENDED: no line saying who can read it, no 'tell a grown-up if unsafe' (C2-07), and the tutor side of the channel is the unrestricted one (X2-01).
- 8. **Stale banner on the child side: CONFIRMED and EXTENDED.** Same 6 h sweep and Rejoin bumping (01c #6); worse, 'Join lesson' does nothing in kid mode because `live` is not in KID_TABS (C2-01, sev 4; LearningHubApp.tsx:85), so a child invited to a real lesson cannot reach it.
- 9. **Contradictory numbers: CONFIRMED and traced.** C2-04, P1-15: 75% is the mean, 78% the strongest subject, 90% a band floor (Attainment.tsx:101), and 'Latest results' uses a different attempt filter (attempts.ts:395-397 vs mastery.ts:24; 01c #2, #4). The 90% element itself needs a live check.
- 10. **One layout for every age: CONFIRMED and EXTENDED.** C3-01 (no teen mode, sev 4), C3-02 (teens lose Progress), C1-03 (KS1 pill tabs need reading), X3 section 4 (KS1 3 icon tabs, KS2 4, KS3-4 4; parent 4).
- 11. **Words and density: CONFIRMED and quantified.** ~30-45 words before the first button (C1 sc 1), ~350 words on the page (C2 sc 1), 'Again / Hard / Good / Easy' (C1-11, C4-08), '25 points short of the 70% pass mark' (C1-07); P2's 25-string jargon table; no read-aloud outside one phonics block (C1-02, C4-02). 'PEE paragraph' is in tools/english/frames.ts:139 (P2 table note).
- 12. **Keep list: CONFIRMED with corrections.** Kind tone: confirmed by C1/C2/C4 but teens find it babyish (C3-07). Grown-ups gate: good for a child (C1 keep 1), too heavy for a tired or EAL parent (P1-10, P2-13) and client-only (X2-10). Lesson page simplicity: confirmed for the reader, but the LessonPlayer adds XP, streak and confetti (C3-11, T4-03). One-tap flashcards: confirmed, but a 6-year-old cannot self-rate (C1-11). 'Hand it in and read the feedback' and privacy-enhanced YouTube: the first confirmed (C2 keep 4), the second unexercised (code-only).

## Appendix A. Assignment of all 233 frictions to themes

- **TH10 SEND comfort, tone and gamification (27):** C1-02, C1-06, C1-07, C1-10, C1-11, C1-14, C1-15, C2-05, C3-07, C4-01, C4-02, C4-03, C4-05, C4-06, C4-07, C4-08, C4-11, C4-12, T4-01, T4-02, T4-03, T4-04, T4-05, T4-08, T4-09, T4-10, X2-13
- **TH8 Messaging, nudges and safeguarding (25):** C2-07, C3-12, T1-05, T1-06, T1-08, T1-26, T1-27, T1-28, T1-29, X2-01, X2-02, X2-03, X2-04, X2-05, X2-06, X2-07, X2-08, X2-09, X2-10, X2-11, X2-12, X2-14, X2-15, X3-07, X3-22
- **TH11 Parent verdict, notifications, language (25):** P1-01, P1-02, P1-03, P1-04, P1-05, P1-06, P1-07, P1-08, P1-09, P1-10, P1-12, P1-13, P2-01, P2-02, P2-03, P2-04, P2-05, P2-06, P2-07, P2-08, P2-12, P2-13, P2-14, P2-15, P2-16
- **TH9 Child Home, kid-mode dead ends, age bands (24):** C1-01, C1-04, C1-08, C1-09, C1-12, C1-13, C2-01, C2-02, C2-03, C2-08, C2-10, C3-01, C3-02, C3-03, C3-04, C3-05, C3-06, C3-08, C3-09, C3-11, C3-13, C4-04, C4-10, T4-07
- **TH2 Tutor Today and first-run (21):** T1-03, T1-07, T1-09, T1-10, T2-15, T3-07, T3-10, T5-01, T5-02, T5-04, T5-05, T5-06, T5-09, T5-10, T5-12, T5-13, T5-14, X3-05, X3-11, X3-12, X3-17
- **TH13 Accessibility (WCAG 2.2 AA) (20):** X1-01, X1-02, X1-03, X1-04, X1-05, X1-06, X1-07, X1-08, X1-09, X1-10, X1-11, X1-12, X1-13, X1-14, X1-15, X1-16, X1-17, X1-18, X1-19, X1-20
- **TH5 Library scale, builder, curriculum map, Tools (19):** C2-06, C3-10, P1-11, T1-18, T1-19, T1-20, T1-21, T1-25, T1-30, T1-31, T2-11, T2-12, T2-14, T5-11, X3-09, X3-10, X3-19, X3-20, X3-31
- **TH1 Structure, tabs and vocabulary (16):** C1-03, C2-09, P2-09, T1-32, T1-33, T2-08, T5-07, X3-01, X3-08, X3-13, X3-14, X3-15, X3-25, X3-26, X3-27, X3-30
- **TH3 Assign has too many doors (15):** T1-12, T1-13, T1-14, T1-15, T1-16, T1-17, T1-22, T1-23, T1-24, T2-13, T4-06, T5-03, T5-08, X3-02, X3-24
- **TH12 Trust, errors and speed (15):** C1-05, C2-04, C4-09, P1-15, P2-10, P2-11, T1-04, T1-11, T3-04, T3-05, T3-13, T3-14, X3-06, X3-28, X3-29
- **TH6 Oversight, settings and reporting (11):** T2-01, T2-02, T2-03, T2-04, T2-05, T2-06, T2-07, T2-09, T2-10, X3-21, X3-23
- **TH7 Live, in-person and broadcast (9):** P1-14, T3-01, T3-02, T3-03, T3-06, T3-11, T3-12, X3-16, X3-18
- **TH4 Marking: many queues, no batch (6):** T1-01, T1-02, T3-08, T3-09, X3-03, X3-04

## Appendix B. Items outside the friction log that the synthesis relies on

- 01c ranked discrepancy list (#1-#13): trust scores 4 for #1 (Home vs Homework), #2 (78% vs none), #3 (header counts); 3 for #4-#7.
- X3 click-count table and vocabulary (X3-journal sections 3a and 5) for the job counts in 04b; these counts are derived from code paths, not stopwatch measurements.
- 06-proposals.md:56 for the existence of the owner's earlier 'curriculum map first' instruction. I did not read the rest of 05/06 (they are downstream of this synthesis).
