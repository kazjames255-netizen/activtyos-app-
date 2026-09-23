# C2 journal: Year 4-6 child (age 8-11), kid mode on the family tablet

Method: walked through code only (no browser, no child login). Paths are relative to `features/learninghub/`. Word counts are estimates of what is visible on a typical Home state (a child with some results, one homework, cards due). Kid mode = `family/KidMode.tsx`; tabs allowed for a child = `KID_TABS` (KidMode.tsx:15) = home, notes, quizzes, diagnostic ("Starting quiz"), homework, flashcards, questions ("Messages"). NOT in that list: live, dashboard ("How I'm doing" tab), tools.

## Big finding before the scenarios
Three buttons a child is invited to press go to tabs kid mode does not allow, so they silently do nothing (you stay on Home):
- Next-lesson "Join lesson": `onGo={() => go("live")}` (home/StudentHome.tsx:150) -> LearningHubApp.tsx:85 `active = kid && !KID_TABS.includes(wanted) ? "home" : wanted`.
- "See progress" on the How I'm doing card: `go("dashboard")` (StudentHome.tsx:243); empty state button too (:222).
- Attainment's `onEmptyAction` goes to quizzes (fine).
Also the kid title-bar says "Ava's learning" + a "Grown-ups" button (KidMode.tsx:59,62); there is no other way out and no Help.

---
## Scenario 1: open the app, what should I do right now, do it
- Goal: know the ONE thing to do and do it.
- Start: Home in kid mode (KidBar, then HubTabs, then StudentHome).
- Path/taps: I see (1) "Ava's learning" bar + Grown-ups; (2) a row of 7 tabs: Home, Notes(?), Starting quiz, Quizzes, Homework, Flashcards, Messages (labels via KID_TAB_LABEL, KidMode.tsx:20); (3) big blue hero: provider name, "Good morning, Ava.", "You have 12 flashcards to review and 1 homework task due soon. A few minutes today keeps it all fresh." (StudentHome.tsx:132), then "My level" bar with a band ("Getting there 45%"), an "i" button, subject chips, a streak flame with "3-day streak / Keep it going tomorrow" and 7 week dots, then the next-lesson panel (countdown + Join). Then a "Flashcards" card (84px number, "12 cards ready", "8 due . 4 new. About 3 min.", "Review now"), then "Homework" card (list, up to 3), then "Latest results" (3 rings), then "How I'm doing" (ring, "Strongest subject", "Based on 2 of 5 topics practised", "Strongest topic", "Focus next", "See progress"), and ONLY at the very bottom the "Keep going . Up next" card with the actual next quiz (StudentHome.tsx:252).
- Blocks above my first real button: KidBar, tab strip, hero (greeting, sentence, level, streak, next lesson = 5 sub-blocks). First tappable task is "Review now" (Flashcards) = about 8 blocks down; the "Keep going" recommendation is block ~12 (last). Roughly 170-220 words on screen before the first action, about 350 words for the whole page. I am 9 and would not scroll to the bottom.
- Where I got lost: hero says flashcards + homework, but the big buttons say "Review now", "Join lesson", "Open", "Start quiz" - four different "do this now" answers. "Keep going" sounds like a bonus and is last.
- Annoyed: two different "Up next" ideas (lesson vs flashcards vs quiz). Long words: "Attainment"-style explanation, "Strongest topic", "mastery" (hidden in kid mode, good).
- Confidence 3/5. Effort 3/5 (scroll + choose).
- ONE change: put the "Keep going / Up next" card (or a single "Do this now" button choosing lesson-live > overdue homework > cards > quiz) at the TOP of Home, above the hero details.

## Scenario 2: do homework quiz, get some wrong
- Goal: finish the quiz my tutor set, see how I did.
- Path: Home > Homework card row (StudentHome.tsx:179, "go('homework')") > StudentHomework list (has counts "Marked . with feedback" tiles, :106) > open piece > "Start the lesson"/quiz link > TakeAssessment > submit > ResultView.
- Taps: about 5-6 to reach question 1 (Home row, homework item, start quiz, maybe a welcome/intro, answer...).
- Words read before question 1: ~60-90 (list, due label, instructions, quiz card with "questions . min").
- Result: banner headline "Brilliant, you passed!" or "Nearly there" / "Not there yet" (shared-assess/ResultView.tsx:112). Per question chip "Correct" or "Not quite" (ResultView.tsx:194) with "Correct answer" heading (:220) and explanation if tutor allows. Kid Home tile shows red "Not yet" chip with a warning triangle icon (StudentHome.tsx:266) - "Not yet" on Home vs "Not quite" per question vs "Not there yet" in banner: three phrasings.
- Also: wrong answers in a quiz gated by a tutor rule may hide the answer key (revealAnswers) so I only see "Not quite" with nothing to learn.
- Where lost: which of the many "Quiz" entry points is my homework (Quizzes tab lists ALL quizzes, locked ones "Locked / Do the starting quiz for Maths first. It unlocks this one." StudentAssess.tsx:349; lesson exit quizzes under "Finish a lesson to unlock" :176).
- Annoyed: 172px score ring + "x / y marks" chip - a big number for a 3/10 shouts. Red warning triangle on "Not yet".
- Confidence 3/5. Effort 3/5.
- ONE change: after a miss, lead with one kind sentence + one button "Try the ones you missed again" (weakTopics/onReviewTopics exist in ResultBanner:40 props but only shown if provided) and use the same phrase ("Not yet") everywhere.

## Scenario 3: join my tutor's live lesson
- Goal: get into the live lesson when the tutor says "click join".
- Start: Home. Tab strip has NO "Live lessons" tab in kid mode (KID_TABS excludes live). The hero's next-lesson panel shows "Live now" + "Ends in 40 min" + big white "Join lesson" (home/NextLesson.tsx:144).
- Tap "Join lesson" -> `go("live")` -> kid guard forces `active = "home"` (LearningHubApp.tsx:85). Nothing visibly happens. I tap again. Nothing. I am 9, the tutor is waiting on video; I give up or shout for a grown-up. The "liveNow" dot is passed to HubTabs (LearningHubApp.tsx:246) but there is no live tab to carry it.
- Taps: 2-5 (repeat) then fail. Words read: ~25.
- Where lost: total dead end. Confidence 1/5. Effort 5/5.
- ONE change (highest severity): allow "live" in KID_TABS (or make Join open the Lobby directly), and keep the Grown-ups gate only for leaving the hub. Not verified whether live lessons also start via a bell link (?open=) which might bypass this - worth a check.

## Scenario 4: see how I'm doing (motivate or worry?)
- Goal: feel good about my progress.
- Home shows several numbers: "My level" band + % (Attainment.tsx:~60, average across subjects, e.g. 75%), "How I'm doing" ring = STRONGEST subject (e.g. 78%, StudentHome.tsx:224-233), "Latest results" tiles (percent rings and "Passed"/"Not yet"), and per-topic "%" (TopicLine :279). Data truth (01c s3.2, s3.4): "How I'm doing 78%" can show next to "No results yet" (mastery from all attempts vs attempts list filtered/capped), and "My level 75%" vs 78% ring vs 90% chip.
- Story to me: I have a level bar saying 75%, a ring saying 78%, "no results yet - your first quiz score will appear here as a ring - pass or not yet, it all counts" (:213). That is confusing: did I do quizzes or not? The child text also talks about me in third person ("Ava's first quiz score...").
- Plus "Focus next" (:240) with a %, which reads as "your worst thing". Streak flame: "Start a streak today" with an empty flame is mild pressure; "3-day streak" is good.
- "See progress" dead (see above), so I can't dig in.
- Words read: ~120. Confidence 2/5 (which number is true?). Effort 2/5.
- ONE change: on kid Home show ONE progress story: streak + "You've done N quizzes this week" and drop the percent ring / "Focus next %" (or label them: "Best subject"), and hide "How I'm doing" when Latest results is empty.

## Scenario 5: I finished early, what next
- Goal: something fun/useful for the remaining 5 minutes.
- When all done: "Keep going" is replaced by "Every quiz done - brilliant. Flashcards are the best way to lock it in. New quizzes will appear here." (StudentHome.tsx:266) but this only appears if there are non-lesson quizzes; hero says "You're all caught up. Take a look at your progress or get ahead with a quiz." (:132) - "progress" is a dead button.
- Options I can find: flashcards ("All caught up" / "N cards coming back later. Cards you find tricky come back sooner." :170), Quizzes tab (done ones show results, "Finish a lesson to unlock" ones need a lesson first), Notes tab (lessons; CurriculumCard "What I've covered" lives there), Tools tab NOT reachable in kid mode. Retry ("Worth another go") only if there is a failed quiz.
- Nothing says "here is a bonus thing". No "practise the topic I was weakest at", no game/tool.
- Words read: ~60. Confidence 2/5, Effort 3/5 (hunting through Notes).
- ONE change: an "All done - pick a bonus" row of 3 big buttons (Flashcards, Redo a missed quiz, Read a lesson) instead of the passive congratulations text.

## Scenario 6: send my tutor a message (safeguarding)
- Goal: ask my tutor something / say I am stuck.
- Path: Tab "Messages" (KID_TAB_LABEL.questions) > "New message" dashed button (QuestionsPanel.tsx:261) > textarea "Write your message..." (:352, max 2000 chars) > send. Or in a lesson: "Stuck? Ask a question..." (lesson/doubts/MessagesCard.tsx:103) / "What would you like to ask?" (AskTeacher.tsx:115).
- Lands in folders by lesson ("General") with a lesson subtitle chips and "A message to your tutor" (:302); replies poll every 15 s (POLL_MS). Only this child's own threads (`FamilyMessages`), only the tutor as the other side = no open chat: good.
- Safeguarding worry: the composer says nothing about who can read it (parent? tutor's provider?), nothing like "If something is wrong or you feel unsafe, tell a grown-up", no Childline/DSL route, no "your parent can see this" line. A child disclosing something has no path except the tutor. Whether parents see kid messages is not visible to the child; in kid mode `AskTutorLink` is hidden (FamilyContext.tsx:147: "Nothing outside a family hub or in kid mode") and the parent summary "Ask your tutor" is also hidden in kid mode (StudentHome.tsx:104 `!kidMode`).
- Words read: ~40. Confidence 4/5 for sending, 2/5 for "is this safe/private?". Effort 2/5.
- ONE change: one line under the composer "Your tutor and your grown-up can read this. If you feel unsafe, tell a grown-up you trust now." plus one-tap "Talk to a grown-up" that opens the Grown-ups gate.

## What does "What I've covered" mean to me?
It is at the top of Notes (NotesPanel.tsx:646), a collapsed bar titled "What I’ve covered" with "N lessons given . M finished" (CurriculumCard.tsx:101). Open it: subject tabs, then a ring "x% of the curriculum touched", "3 of 12 topics started in Maths", "5 lessons finished / 7 to go", then a table with columns "Topic  Y1 Y2 Y3..." (:170+). I do not know what "curriculum touched" or "Y3" mean; a low % (e.g. 8%) looks like I'm behind, and a grid with tiny year columns is for grown-ups. "Topics started ... to go" tells me I have 7 lessons left, which is confusing because I only see lessons my tutor gave (not a to-do list). Verdict: adult content in a child's space; the sentence "lessons finished / to go" is the only thing I get. Confidence 1/5.
- ONE change: in kid mode show only "You've finished 5 lessons" and a simple list of finished topics (ticks); hide the year grid and "% of the curriculum touched".

---
## TOP 10 frictions (ranked)
1. Join lesson does nothing in kid mode (live not in KID_TABS). C2-01
2. "See progress" (and hero "take a look at your progress") dead in kid mode. C2-02
3. The next step ("Keep going") is the last block on Home; four competing action buttons above it. C2-03
4. Contradictory numbers: My level 75% vs How I'm doing 78% vs "No results yet". C2-04
5. "Not yet" / "Not quite" / "Not there yet"; red warning icon on a miss; big ring on a low score. C2-05
6. Curriculum grid "What I've covered": "% of the curriculum touched", Y1..Y6 columns. C2-06
7. No safeguarding line, no "who can read this", no grown-up route in Messages (Ask-your-tutor also hidden in kid mode). C2-07
8. "I finished early" gives only passive congrats; Tools not reachable; nothing to do next. C2-08
9. Tab strip shows 7 tabs incl. "Starting quiz" and Notes with no icons/read-aloud; reading-heavy for age 8. C2-09
10. Home is ~350 words and 8+ blocks; child-mode copy still third person ("Ava's first quiz score..."). C2-10

## TOP 5 keep moments
1. "Grown-ups" parent gate with a maths sum and "Not quite. Here is a new one." (ParentGate.tsx) - safe and kind.
2. Kind tone and level names: "Getting started / Getting there / Got it!" (KidMode.tsx:16), "Brilliant, you passed!", "Nearly there", "pass or not yet, it all counts".
3. Flashcards card: big number + "About 3 min" estimate and one "Review now" button (StudentHome.tsx:157-175).
4. Hand in homework and read feedback in the same page (StudentHomework.tsx:61, feedback quote :204).
5. Messages: only my tutor, threads grouped by lesson, "Tap Ask a question inside any lesson" (QuestionsPanel.tsx:265), plus streak flame "Keep it going tomorrow".
