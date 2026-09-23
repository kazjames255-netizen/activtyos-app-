# T1 journal: Solo Tutor (8 students, ages 6-17, evenings/weekends, phone between sessions)

Method: code walk only (no browser, no server). Paths are relative to `features/learninghub/` unless stated. "Words" = rough count of words I must read before I can act. Data figures (23 things, 9 hand-ins, 7 written) are the brief's; the screenshot notes (screenshots/before/NOTES.md) show a different live tenant (7 quiet, nothing to mark, 35-40 s first load, last tab clipped).

Where I disagree with 01-inventory.md: the Home "Needs a nudge > Assign" row is NOT the shared homework flow. It only jumps to the Homework tab (home/ClassSnapshot.tsx:163 calls `onGo("homework")`; TutorHome.tsx:195 passes plain `go`). No form opens and no student is preselected.

---

## Scenario 1. Open the app at 6:55pm before a 7pm lesson

**Goal.** In 10 seconds: is the 7pm lesson ready, who is coming, what do I need to do first.
**Start.** Phone, `/freelancer/learninghub?tab=home`.

**Path.**
1. Cold open. First screen is "Checking access..." (ViewGate), then skeletons, then Home. In the earlier capture this took 35-40 s and ended in a red banner about localhost:4000 (screenshots/before/NOTES.md). At 6:55 that is the whole problem.
2. Home renders `HubHero` in full mode (HubHero.tsx:129-157): "Teaching Hub" title, a lede paragraph, a Hide/Show button, and four stat tiles: "Subjects 7 / 2,457 topics", "Lessons 7,894", "Worksheets 1 / PDFs and images", "Students 8 / enrolled and active". About 90 words and 4 tiles, none of which help me at 6:55. On a phone I scroll past them.
3. Tab strip (11 tabs, HubTabs.tsx, horizontal scroll). I ignore it.
4. `NextLessonHero` (home/NextLesson.tsx:35-153): status pill "Next lesson" / "Starting soon", "Today · 7:00pm · 45 min", title, topic, avatars and first names, then a countdown (hrs/min/sec) and "Joining opens 10 min before . in ...". The button reads "Start lesson" (NextLesson.tsx:144).
5. "Needs your attention" card (TutorHome.tsx:165-174): five rows, each a big number and a hint, e.g. "Homework to mark - 9 hand-ins waiting", "Written answers to mark - Quiz answers need your marks", "Overdue homework - Past due and not handed in", "Quiet for 14+ days - Callum, Hannah".
6. Tap "Start lesson". It only does `go("live")` (TutorHome.tsx:163). I land on the Live lessons tab, tap the lesson card's Join, the Lobby opens (LiveLessonsPanel.tsx:161), then I join. About 3-4 taps before I am in the room.

**Taps.** 1 to see the lesson, 3-4 to be in it. 3 screens (Home, Live tab, Lobby). **Words read** before I could decide: about 250 on a phone (hero 90, lesson 40, attention 60, tab labels 30, quick actions 30).

**Hesitations.**
- "Do I need to hit Start lesson, or is the lesson already open for the student?" The button says Start but takes me to a list, not the call.
- The 4 stat tiles felt like a report, not a tool. "7 subjects, 2,457 topics" means nothing to me and pushed the lesson down the screen.
- Attention says "23 things" (badge, TutorHome.tsx:166) but that sums papers, child-homework pairs and people (01c-data-truth 1.2). I could not tell what to do first.
- Nothing tells me about tonight's student: last score, whether last week's homework was done, what I set. Only names and avatars (NextLesson.tsx:99-110).
- Quick-action grid (6 tiles: New lesson, New quiz, Assign homework, Schedule video lesson, Enrol student, Teach in person) sits between Attention and the snapshot. Fine, but "Schedule video lesson" vs "Teach in person" vs Live tab all sound like "lesson".

**Expected vs happened.** Expected: open, see "7pm Year 5 Maths, 3 kids, 1 unmarked hand-in", tap once, be in the lobby. Got: a brand banner, four numbers, and a jump to another tab.
**Confidence 3/5. Effort 3/5.**
**One change:** on Home put Next lesson first and drop (or collapse by default) the stat tiles; make "Start lesson" open the Lobby directly (skip the Live tab).

---

## Scenario 2. Clear "Needs your attention" (9 hand-ins + 7 written answers)

**Goal.** Get both counts to zero fast. Can I batch?
**Start.** Home, attention card.

**Path: hand-ins.**
1. Tap "Homework to mark" (`go("homework")`, TutorHome.tsx:168). 1 tap. Homework tab opens. First-load logic picks the "To mark" filter if anything is submitted (TutorHomework.tsx:81-85). Good.
2. Header "Homework - Set practice, then mark what comes back - families are told at every step." plus a "Set homework" button, a segmented "Inbox 9 / Set homework N", four filter pills "To mark / Marked / Not handed in / All" with counts, then 9 rows (TutorHomework.tsx:112-177). Each row: name, title, "To mark" pill, "handed in Tue 4:12pm", "Mark" button.
3. Tap a row. `MarkDialog` opens (MarkDialog.tsx:75). Left: "Their answer", "Files (n)", "Linked quiz". Right: "Mark this", Score, "Out of" (default 10, MarkDialog.tsx:46), a % bar, Feedback, three quick chips ("+ Great work - well done!", "+ Good effort. Have another…", "+ Please redo this and…"), footer "The family is notified when you save." Footer buttons: Close / Save mark / "Mark & next →".
4. Per hand-in: read, type score (autofocus, `data-autofocus`), maybe fix "Out of" if the homework is not /10, optionally a chip, tap "Mark & next →" (MarkDialog.tsx:81). So about 3-4 actions per hand-in, 9 x 4 = 36. It does walk the queue without going back to the list. That part is good.

**Path: written answers.**
5. Back to Home (1 tap on the Home tab), tap "Written answers to mark" (sets `marking` intent, goes to Quizzes; TutorHome.tsx:169). Quizzes tab opens on its Marking sub-tab (TutorAssess `takeHubIntent(["marking"])`). Note: the page now has a chips row + 4 sub-tabs List / Question bank / Marking / Results.
6. Marking queue (quiz/MarkingQueue.tsx:24-39): rows "Name / Quiz title . handed in 2h ago . auto-marked 6/8 . 2 written to mark" and a "Mark →" chip. Tap a row (1). `MarkForm`: each written question is a card with prompt, "Student's answer", "Model answer:", "Marks (out of n)" input with **Full** / **Zero** buttons, and optional feedback. "Save and next" is disabled until every written answer has marks ("Award marks for every written answer to save.", MarkingQueue.tsx:78). Per attempt: 1 open + (1 Full tap per question or type) + 1 save. With 2 written questions each, 7 x 4 = 28.
7. Placement papers are a third place: a separate row "Placement tests to mark" that goes to the Placement tab (TutorHome.tsx:170). Only shows if >0.

**Totals.** About 65 taps/keystroke-actions, 4-5 screens (Home, Homework, dialog, Home, Quizzes>Marking, mark form). **No batch anywhere**: no "select all and give 10/10", no "mark all correct", no "Out of" remembered from the homework, no way to mark from the list.

**Hesitations.**
- "Is 'Written answers to mark' the same as 'Homework to mark'?" Same verb, two different tabs, two different UIs (MarkDialog: score/out of; MarkForm: per-question marks).
- If the homework has a linked quiz still pending, MarkDialog says "Some answers need a tutor's eye - mark them in the Quizzes tab." (MarkDialog.tsx:115). So one child's homework can send me to a second screen.
- Written count on Home can be too low: unfiltered `/attempts` is sliced to the newest 300 (01c-data-truth 1.2). I would think I was done when I was not.
- "Overdue homework 6" (TutorHome.tsx:171) goes to the same Homework tab but the tab opens on "To mark", not on the overdue items, because of the auto-filter above. I tapped it to chase and saw the marking list again. Wrong turn.
- "Quiet for 14+ days" jumps to the Students tab without any filter or highlight.
- Nothing lets me chase an overdue child from the Homework tab. The rows are only "Open" (MarkDialog notice: "This student hasn't handed anything in online. You can still record a mark - handy for paper homework.").

**Expected vs happened.** Expected one queue containing both kinds of marking and a "full marks" shortcut. Got two queues and one-by-one entry.
**Confidence 4/5. Effort 4/5.**
**One change:** one "Mark queue" for hand-ins + written answers, with "Full marks" on hand-ins and the Out-of remembered per homework.

---

## Scenario 3. Set tomorrow's homework for the "Year 5 Maths" group on fractions

**Goal.** Find a Year 4/5 fractions lesson/quiz, check it, assign it to the group, due tomorrow.
**Start.** Home.

**Path A (via group).**
1. Tap the "Students" tab (1). Page = filter pills "All 8 / Active 8 / Paused 0", "Enrol a student", then the Groups section (StudentsPanel.tsx:434) above the 8 student cards. The group card "Year 5 Maths" has three tiles: Homework, Quiz, Lesson, each with a small "+" button (GroupsSection.tsx:66-96).
2. If the group already has homework, the big tile shows "3 open . 1 to mark" and tapping it **shows the existing list**, not a form (GroupsSection.tsx:199-201). The new one needs the tiny "+" (aria-label "Set new homework for Year 5 Maths"). I hit the wide tile first. Wrong turn. (1 extra tap.)
3. `HomeworkForm` opens ("Set homework - Each student gets their own copy to hand in - they're notified straight away."; HomeworkForm.tsx:142-143) with the group's kids already ticked. 9 fields: Base it on a lesson, Title, Instructions, Videos (optional), Due date, Attach a quiz (optional), Link lessons (optional), Flashcards to revise (optional), Assign to. About 200 words of labels/hints.
4. Type "fractions" in "Base it on a lesson" (hwPack.tsx:36-38). Results show **only six titles** (`limit: "6"`) and a Draft pill (hwPack.tsx:30,45). No year, no subject, no topic. Oak titles for Year 3, 4, 5 and 6 fractions look alike, so I cannot tell which is Year 4/5.
5. Pick one (1). Title, instructions, quiz, linked lessons, flashcards topic and due date all fill in (hwPack.tsx:12-17; HomeworkForm.tsx:68-72). That is a real time-saver.
6. "Check it": the form shows a quiz title with "N Qs" in a dropdown (hwPickers.tsx:55) and an attached-lesson chip "... . interactive". There is no preview in the form. To really check it I would leave, open Lessons and Preview, then start again (the form state is lost).
7. Due date: a native date input, default "7 days out" hint "Due end of day. Default is 7 days out." (HomeworkForm.tsx:168-169). I must open the date picker and pick tomorrow (2-3 taps). The lesson-level mini form has "Today / Tomorrow / 3 days / 7 days / 2 weeks" (HomeworkForLesson.tsx:92-97); the full form does not.
8. Scroll to "Assign to": check the group is ticked (GroupQuickPick + StudentPicker). Tap "Assign homework" (1).
**Taps:** Students tab 1 + wrong tile 1 + "+" 1 + search 1 + pick 1 + date 3 + assign 1 = about 9, plus typing. 3 screens.

**Path B (via Lessons).** Lessons tab, Year picker ("All years" pill, YearGroupPicker.tsx:55-57) choose KS2 or 4+5, search "fractions", list of cards (NotesPanel.tsx:689-744) grouped by topic with a "Set for children" icon-only button (:704) and a title; open a card, header buttons Print / Open / Set for children / Edit / Delete, then "Interactive lesson" panel with "Preview lesson". This is the better place to check a lesson, but "Set for children" opens the form with the group NOT selected (`groupId: ""` from `lessonHomeworkIntent`), so I tick the group chip inside the form. 6-8 taps to get to the form, 4 screens.

**Hesitations.** "Fractions" returns lessons from every year; the Year 4/5 filter exists on Lessons (Y picker) but not in the homework form's pickers. "Is 'Base it on a lesson' the same as 'Link lessons'?" Two similar-looking searches in one form. "Do families see the group name?"
**Expected vs happened.** Expected: pick group, pick "Fractions Y5", see what the kids will get, "Tomorrow", done. Got: powerful but long form; year invisible; date chosen by calendar.
**Confidence 3/5. Effort 3/5.**
**One change:** show year + topic + question count in the lesson-pack and quiz search results, and add "Tomorrow / 3 days / 1 week" chips on the full form's due date.

---

## Scenario 8. A student quiet for 14+ days: nudge them or the parent kindly and fast

**Goal.** Send Tommy (or his parent) a warm nudge in under a minute.
**Start.** Home.

**Path.**
1. Home shows two places for this. (a) Attention row "Quiet for 14+ days - Callum, Hannah" (TutorHome.tsx:172) and (b) "Needs a nudge" card: "Callum - Quiet for 19 days" with a gold "Assign >" chip (ClassSnapshot.tsx:156-168). A card titled "Needs a nudge" whose action is "Assign" made me tap it. It goes to the Homework tab (ClassSnapshot.tsx:163), Inbox, with nothing about Callum. Dead end (1 tap wasted).
2. Back. Tap the attention row: Students tab, **no filter**, all 8 cards (TutorHome.tsx:172 `go("students")`). Find the card by name (search box only appears when more than 5 students: it does for 8). Card text: "Last seen 19 days ago" style line (`seenAgo`, StudentsPanel.tsx:472), "Active", year chip, "0% mastery" ring, "No lesson booked", buttons **Progress / Message / Set homework** (StudentsPanel.tsx:502-504).
3. Tap "Message" (StudentsPanel.tsx:377). Messages tab opens with New message composer, the student preselected in a dropdown, text: "Not about a particular lesson - just a message." and a blank textarea "Write your message..." (QuestionsPanel.tsx:348-352). Type; Send. Total about 5 taps + typing, 3 screens.

**Hesitations / kindness.**
- I can only write a message into the **student's** thread ("Student message centre"). For a 6-year-old that is not a channel that is read. Whether the parent is told is not visible: the server notifies families on messages (doubtsApi.ts:111,179), but nothing on screen says so, unlike MarkDialog's "The family is notified when you save."
- No template, no suggested wording. The tone is entirely mine, typed on a phone. The only "kind" scaffolding in the hub is the three feedback chips in MarkDialog.
- The word "Quiet" and "Needs a nudge" are shown next to a child's name on a dashboard I might screen-share; a parent seeing that would not like it. (Tutor-only screen, but the wording is blame-y.)
- The definition of "quiet" counts a child who was assigned homework and never opened anything (01c 1.2); "Quiet for 19 days" may be wrong.

**Expected vs happened.** Expected: tap the name, choose "Send a friendly check-in", edit, send to parent. Got: three hops and a blank box.
**Confidence 3/5. Effort 3/5.**
**One change:** make the "Needs a nudge" row open the composer to that child with a prefilled kind message and a visible "Parent is notified" line; rename the chip from "Assign" to "Message".

---

## Scenario 9. Build a 10-question quiz from scratch, then by reusing existing questions

**Goal.** A 10-question quiz on fractions, twice.
**Start.** Home "New quiz" (sets intent `newQuiz`; TutorHome.tsx:57) or Quizzes tab "+ New quiz".

**Screen: builder modal** (quiz/AssessmentBuilder.tsx:150-302). One modal, top to bottom: CreatorTabs "New / Edit existing", Title, Type (Quiz / Placement test), Subject, Pass mark %, Time limit switch, "Topics covered - none selected = whole subject" chips, NewTopicInline, "Who is this for?" year chips, "Retakes" with 4 options, and only then the two columns: "In this quiz - 0 questions, 0 marks" and "Question bank" with "+ New question", a Search box, and a footer "Draft: only you can see it" switch and "Save draft". Before I reach a question I have read about 250 words and made 4-5 decisions (subject, pass mark, audience, retakes) that mostly have defaults.

**From scratch.** "+ New question" opens `QuestionForm` on top of the modal (AssessmentBuilder.tsx:303). Fields are driven by question kinds (QuestionForm.tsx header comment): topic, kind, prompt, options (4 blank by default, `blankOptions()`), mark the correct one, marks, explanation, publish, live preview. For a multiple-choice question I need about 8 actions (open, prompt, 2-4 options, tick correct, save). x10 = roughly 80-100 taps/typing steps. Each save adds it to the quiz (`addQ` on saved) which is good. Traps: a question written here may have no year, so the "Only questions for Year 5" checkbox would hide it from its own quiz (comment at AssessmentBuilder.tsx:79); and saving with a draft question fails late: "Every question must be published before the quiz can be. Publish the draft questions (marked "draft") in the Question bank, or remove them." (:122).
**Confidence 3/5. Effort 5/5.**

**Reusing questions.** Pick topic chips (up to 24 chips shown, else parents plus chosen; :65), type "fractions" in "Search the bank" (debounced), tick "Only questions for Year 5" (only appears after I choose a year chip), then tap "+ Add" on each of 10 rows (:282), 30 per page, "Show more (N left)". 10 taps + searches. The list shows only the prompt (truncated to one line) and kind, so I cannot tell difficulty or year. No "add all shown", no random pick, no target counter ("10 of 10").
**Reuse whole quiz?** There is no Duplicate/Copy on the quiz card (buttons: Set for children, Preview, Edit, Publish/Unpublish, Delete; AssessmentList.tsx:314-319). "Edit existing" edits the original in place, which is dangerous if it is already set for a class.
**Confidence 4/5. Effort 3/5.**
**One change:** multi-select checkboxes with "Add N selected" in the bank (and a "10 of 10" counter), so reuse is one tap not ten.

---

## Scenario 10. Find a flashcard set and a worksheet for Year 8 science "cells" and assign both

**Goal.** Both assigned to the Year 8 kids.
**Start.** Home.

**Path.**
1. Lessons tab (1). Curriculum card first ("Where our lessons fit the curriculum", CurriculumCard.tsx:92) with ring, "N of M areas covered . thin . gaps" and a heat-map grid; it pushes the list down (NotesPanel.tsx:646). I do not need it for this job.
2. Year picker "All years" (1) then 8 (1); subject sidebar (desktop) or chips (phone) Science (1); search "cells" (type). Cards show topic, "View" badge for interactive, excerpt, date, file names. Open the lesson (1).
3. Reader header: Print / Open / Set for children / Edit / Delete. Then a violet **Flashcards** tile ("N cards. Not yet assigned", button "Send flashcards") and a **Homework** tile ("Not yet set", "Set homework") side by side (NotesPanel.tsx:617-620; lesson/FlashcardsForLesson.tsx:69-81; lesson/HomeworkForLesson.tsx:66-80).
4. Flashcards: "Send flashcards" (1) -> "N flashcards for this topic - who gets it?" -> tick students (1-3; the picker gets `yearGroup: null`, FlashcardsForLesson.tsx:87, so I cannot pick "Year 8" in one tap) -> optional "Choose specific cards, not the whole topic" -> "Assign" (1). No due date. Student gets it "next time they open flashcards".
5. Worksheet: not the Homework tile. The Homework tile attaches **this lesson** only (`lessonHomeworkDraft`). The worksheet has its own button further down in the tutor panel: "Worksheet - <title>. Students can print the PDF or do it on screen as a quiz; it is not set until you assign it." with "Set worksheet as homework" (lesson/LessonTutorPanel.tsx:42-48), which sends me to the Homework tab form. That is only shown when the Oak lesson has `worksheet.assessmentId`. For a lesson without one, the "Worksheets & files" shelf is print/download only (NotesPanel.tsx:626-631). Home says "Worksheets 1 / PDFs and images", which made me doubt there were any.
6. Two assignments, two flows, two mental models: cards are immediate, no date; worksheet is a full homework with a due date.
7. Alternative: HomeworkForm with "Base it on a lesson" (pack fills notes, quiz, flashcards topic; `worksheetAssessmentId` is in the pack but `applyPack` never uses it, hwPack.tsx:15, HomeworkForm.tsx:68-72) or "Flashcards to revise" dropdown listing **every topic in the account** alphabetically (HomeworkForm.tsx:211-214, 2,457 topics). I would not find the right topic there.
**Taps:** about 15-18, 3-4 screens (Lessons list, reader, Homework tab form).
**Hesitations.** "Is 'Set homework' on the lesson the worksheet?" (no). FlashcardsForLesson returns `null` when the topic has zero cards (:43) so the tile silently vanishes; I would wonder if I had missed it. The Flashcards tab itself has no "assign" button (TutorFlashcards: Add card / Paste many / Publish drafts only).
**Confidence 3/5. Effort 4/5.**
**One change:** on the lesson reader put one "Set for children" action that offers lesson + worksheet + flashcards as three ticked items with one due date.

---

## Scenario 12. Read and reply to 4 unread student messages

**Goal.** Clear four unread threads.
**Start.** Home.

**Path.**
1. Find out I have messages: Home does not mention them (not in Attention). The only signal is a gold number badge on the 11th tab "Student message centre" (LearningHubApp.tsx:93-97,180; HubTabs.tsx badge). On desktop the last tab is clipped at the right edge (NOTES.md); on a phone it is off-screen until I scroll the strip. I only know there are messages if I scroll.
2. Tap the tab. Layout: left list "New message" + one folder per student (unread number badge), each expanding into a sub-folder per lesson/"General", each expanding into thread rows showing a single truncated line of the last message and "2h ago" (QuestionsPanel.tsx:162-206). The first student folder and its first sub-folder auto-open, and the thread pane shows the first thread.
3. To read the other three: tap student folder (1), tap lesson sub-folder (1), tap thread (1) = 3 taps per thread. Reading opens the thread and immediately marks it read (`onSeen` in ThreadPane useEffect; QuestionsPanel.tsx:374); there is no "mark unread".
4. Reply: textarea "Reply..." (QuestionsPanel.tsx:412), Send. No quick replies like MarkDialog's chips.
5. On a phone (<1024 px) the grid collapses to one column: the thread pane sits **below the whole folder list** (`lg:grid-cols-[320px_...]`, QuestionsPanel.tsx:155). After tapping a thread I would have to scroll down to see it; nothing scrolls for me.
**Taps:** about 16 (4 x (3 open + 1 send)). 1 screen but 3 nesting levels.
**Hesitations.** "Is the number on the folder people or messages?" ("1" badge on a student folder and again on the sub-folder). Titles: tab "Student message centre" (too long, truncated on desktop), key `questions`, empty text "When a student taps "Ask a question" inside a lesson, it shows up here." A parent's messages? Not distinguishable.
**Expected vs happened.** Expected an inbox: one list, newest unread first, tap, reply, next. Got file-manager folders.
**Confidence 3/5. Effort 3/5.**
**One change:** flatten to one unread-first list (student name + preview) with the thread opening as its own screen on phone, and surface "N unread messages" on Home.

---

## Scenario 13. The Tools tab

**Goal.** Work out what it is for, whether I would find it, whether it is useful.
**Path.**
1. Tab #9 of 11 between "Lessons" and "Flashcards", label "Tools", no icon in PANEL_ICON (falls back to sparkle; inventory). Would I find it unaided? Only by scanning 11 tabs. The blurb "Rulers, protractors, number lines, science diagrams and more - pick a subject." (tools/ToolsPanel.tsx:15) is in the panel meta but I did not see it on the page.
2. Open: search "Search tools... (e.g. angles, verbs)", "155 tools . 34+ ready to use" (registryData has 155 catalogue rows; 34 have an implementation, plus lesson widgets added at registry.ts:73), toggle "Ready to use only" (off by default), subject chips "All / Maths . 67 / English / Science / Languages / ...", key stage chips KS1-KS5, then a grid of tiles "Ruler - Maths . KS2-KS4". Live tools sort first, but everything else is a dashed grey tile marked "In build" or "Coming soon".
3. Tap a grey tile: "'X' isn't ready yet - it's being built. We've noted you'd like it." (ToolsPanel.tsx:66) and it logs a click. That felt like being a beta tester.
4. Tap a live tool (e.g. "Fraction wall & circles"): full-screen dialog (ToolHost.tsx:53-63) with the tool.
**Useful?** For a maths/science tutor with a phone in a kitchen: mildly, when explaining (fraction wall, number line, coordinate grid). It cannot be shared to a student, attached to a lesson/homework, or opened from the Home/Live screens. The same drawer tools also exist in the live lesson HelpTools (remotesync/HelpTools.tsx), so it is a second doorway to the same thing.
**Confidence 2/5 (that I would use it). Effort 2/5.**
**One change:** default "Ready to use only" ON (hide 120 "coming soon" tiles) and add "Show to student / attach to homework".

---

## TOP 10 frictions (worst first)

1. **No batch marking; two separate marking UIs.** Hand-ins (Homework tab, dialog) and written answers (Quizzes > Marking, another form), plus placements in a third tab; about 65 actions for 16 items. (MarkDialog.tsx:81,131-137; MarkingQueue.tsx:24-83; TutorHome.tsx:168-170)
2. **"Overdue homework" jumps to the "To mark" list**, not the overdue items, and there is no chase/remind action anywhere. (TutorHome.tsx:171; TutorHomework.tsx:81-85)
3. **"Needs a nudge > Assign" is a dead end for scenario 8**: goes to the Homework tab; the only way to contact a quiet child is a blank message to the child's thread; no parent wording, no template. (ClassSnapshot.tsx:156-168; StudentsPanel.tsx:377; QuestionsPanel.tsx:348)
4. **Home puts 4 stat tiles and a lede above the next lesson**; "Start lesson" only changes tab. Vanity numbers, 3-4 taps to be in the room. (HubHero.tsx:129-157; TutorHome.tsx:163)
5. **Messages hidden**: unread only as a badge on the last (clipped) tab, not on Home; three nested folder levels; on phone the thread sits below the list. (LearningHubApp.tsx:180; QuestionsPanel.tsx:155,162-206)
6. **Lesson/quiz search in the homework form hides the year**: 6 results, title only, no filter; cannot verify "Year 4/5" or preview from the form. (hwPack.tsx:30,45; hwPickers.tsx:31,55)
7. **Quiz builder: config before content and one-tap-per-question**; no multi-add, no counter, no Duplicate quiz, "Edit existing" edits the original. (AssessmentBuilder.tsx:164-244,282; AssessmentList.tsx:314-319)
8. **Flashcards + worksheet are separate, inconsistent assign flows** (cards: immediate, no due date, no year pick; worksheet: full homework; homework-form flashcard dropdown lists all 2,457 topics; pack ignores the worksheet). (FlashcardsForLesson.tsx:61,87; LessonTutorPanel.tsx:42-48; HomeworkForm.tsx:211-214; hwPack.tsx:15)
9. **Due date is a calendar picker on the full form**, while the mini-form has "Tomorrow"; "tomorrow's homework" is the commonest ask. (HomeworkForm.tsx:168-169 vs HomeworkForLesson.tsx:92-97)
10. **Slow first load and remount-refetch on every tab**: "Checking access..." then skeleton (35-40 s in the capture), and each tab switch shows a skeleton again (except Lessons). Phone-between-sessions use makes this feel broken. (screenshots/before/NOTES.md; LearningHubApp.tsx:263)

## TOP 5 "keep this, it's good"

1. **"Base it on a lesson" homework pack** fills title, instructions, quiz, lessons, flashcards and due date in one pick, all still editable; plus "Set for all my Year N students (n)". (hwPack.tsx:37; HomeworkForm.tsx:68-72,238-243)
2. **MarkDialog "Mark & next" flow** with quick feedback chips, "Use the quiz score (x/y)", percentage bar, and the reassuring "The family is notified when you save." (MarkDialog.tsx:14,81,117,151)
3. **Attention card with big numbers, "All clear" and tap-through**, plus the Homework tab auto-picking a useful filter when nothing is waiting. (TutorHome.tsx:28-41; TutorHomework.tsx:81-85)
4. **Safety nets in the homework form**: draft quiz/lesson can be published inline; "N students won't be able to open this quiz" with a one-tap remove. (HomeworkForm.tsx:174-179,198-202,231-236)
5. **Group cards with live status** ("3 open . 1 to mark", "2 overdue" red chip, "Next lesson Tue") and one-tap "+" to set homework for the whole group; student card "Message" preselects the child. (GroupsSection.tsx:66-96,244-257; StudentsPanel.tsx:377)
