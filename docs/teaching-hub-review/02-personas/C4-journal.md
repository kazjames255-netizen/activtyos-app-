# C4 journal: child with SEND (dyslexia + ADHD, age 9), tablet, kid mode

Method: code walk only (no browser, no login). Paths are under features/learninghub/. I read brief 8.3 first. Line numbers are from the current tree.

## Scenario 1: "What do I do now?"
- Goal: find the one thing to do.
- Start: parent hands over the tablet. A full-screen layer appears with "{first}'s learning" and a small "Grown-ups" lock button (family/KidMode.tsx:51,57). Tabs are Home, notes, quizzes, Starting quiz, homework, flashcards, Messages (KidMode.tsx:15).
- Path and taps: Home opens (StudentHome.tsx:103). Top to bottom I meet:
  1. a blue hero: "Good morning, Ava." and "You have 12 flashcards to review and 2 homework tasks due soon. A few minutes today keeps it all fresh." (:132-134);
  2. an attainment chip (:136);
  3. a streak box with a flame, "Start a streak today" / "A quiz or homework hand-in lights a day" and week dots (:138-144);
  4. a "Next lesson" box with a countdown ring (:148-151, NextLesson.tsx:113);
  5. Flashcards card: a big number, "12 cards ready", "3 due · 9 new. About 3 min.", button "Review now" (:159-175);
  6. Homework card: up to 3 rows plus "+N more to do" and "All homework" (:188-201);
  7. Latest results: score rings with a red "Not yet" chip (:209-217);
  8. "How I'm doing": ring, "Strongest subject", "Based on 3 of 8 topics practised", a band chip, "Strongest topic" and "Focus next" with %, and a button (:220-243);
  9. "Keep going · Worth another go" and a button (:251-262).
  I count 9 blocks, about 6 buttons and 3 competing calls to action ("Review now", the homework rows, "Keep going"). Nothing says which one is first.
- Words read: mostly 12-13px grey text such as "Counts days with a finished quiz or a homework hand-in" (:138) and "Based on 3 of 8 topics practised" (:235). Cards also stagger in with `home-rise` (:103,124); this is disabled under reduced motion (homeKit.tsx:33).
- Overwhelmed: right away. The hero packs greeting, sentence, level, streak and lesson into one blob. The flame and the countdown ring both pull my eye.
- Confidence 3. Effort 4. I know something is due, but not what to do first.
- ONE change: put a single "Do this next" card at the top of kid Home (the existing d.step / lead logic) and fold the other blocks below a "More" heading.

## Scenario 2: homework, some wrong
- Goal: do homework; some answers will be wrong.
- Path: Home > Homework row (:192) > StudentHomework list (row 69) > a quiz-type task. Rows can say "Overdue" or "Overdue by 3 days" in red with a warning triangle (hwTypes.ts:44, StudentHomework.tsx:71-72). The Home card turns red (:179). Late work gets "· late" (:83) and a red "Handed in late" badge (:190). Opening a late task says "This is past its due date — it'll be marked as late." (:333). Summary tile: "2 overdue" in red (:104).
- Quiz taking (shared-assess/TakeAssessment.tsx): if the tutor set a limit, the intro reads "The clock starts when you press Start and your answers are handed in automatically when time is up." (:225). A "⏱ m:ss" timer pill (:277-279) turns red under 60 seconds (:260, :278). At zero: "Time's up. Handing in your answers…" (:287). Leaving is no escape: "the clock keeps running" (:354). The child cannot turn the timer off.
- After the quiz (ResultView.tsx): headline "Not there yet" if 30 or more points short, otherwise "Nearly there" (:114). Sub: "You scored 45%, 25 points short of the 70% pass mark…" (:126). The ring goes gold, not red (ResultBanner.tsx:51). Per question: "✗ Not quite" in a red chip (:194) and "0 / 1 marks" (:208). Then "Correct answer" in green and "Why" (:220,:234). Topic bars say "Worth another look" (:159).
- Around it: the Home tile shows a red ring plus a warning triangle plus "Not yet" (StudentHome.tsx:305-317). In a lesson the warm-up says "Not quite" in red-soft (WarmupStep.tsx:113-114), and Done lists mistakes in a red box (DoneStep.tsx:61). XP: "+10 + streak", a streak chip and a confetti burst (LessonPlayer.tsx:252-258,292); a wrong answer resets the streak (:258).
- Feel: the words are mostly kind ("Nearly there", "Worth another look"). But the red chips, red triangles and "Overdue" make me feel told off. A percentage and "points short" are maths I have to read. I lose my streak on one mistake.
- Overwhelmed: the results page. A giant ring, a sentence with three numbers, topic bars, then a card per question. The child sees every wrong answer at once.
- Confidence 2. Effort 4.
- ONE change: in kid mode use gold or blue instead of red, and say "Due Tuesday" or "Waiting for you" instead of "Overdue" and "late". Show a ring and one sentence first, and put the wrong answers behind "Look back".

## Scenario 4: "How am I doing?"
- Goal: see how I'm doing.
- Path: Home "How I'm doing" (:220) > "See progress" > the dashboard tab. The kid label "How I'm doing" is in KidMode.tsx:20, but KID_TABS (:15) does not include "dashboard", so LearningHubApp.tsx:85 sends me back to Home. The button may be a dead end; I could not confirm this from the code.
- Words read: "Strongest subject", "Focus next", "Getting there" / "Got it!" / "Getting started" (KidMode.tsx:14). These are kind. But next to them are "68%" (:296), "Based on 3 of 8 topics practised", and a red-toned "Not yet" chip on results.
- Feel: mostly kind. A streak that reads "Start a streak today" is a mild nudge. "Focus next" plus a percentage could feel like "my worst topic".
- Overwhelmed: three separate progress displays (attainment chip, streak, mastery ring) plus the results row.
- Confidence 3. Effort 3.
- ONE change: kid mode shows only bands and stars (no %, no "weakest"); call the weak topic "Try next".

## Scenario 5: I finished early
- Goal: nothing left; what now?
- Path: Home shows "Nothing to hand in" (:184), the flashcards "All caught up" (:166), and "Every quiz done — brilliant." plus "Flashcards are the best way to lock it in." (:266). In a lesson, DoneStep shows stars, "Great work!" and "Keep going!" (DoneStep.tsx:12).
- Feel: pleasant and not shaming. But there is no choice of a calm thing to do (no "free choice", no "pick a game/tool"). The Tools tab is not in KID_TABS, so the useful tools (X-08 Read aloud, readingOptions) are unreachable for me.
- Flashcard end: "Session complete" then "Check for more cards" / "Done for now" (ReviewSession.tsx:113,135-136). Note: "12 felt good or easy." (:115) counts my ratings.
- Overwhelmed: no. It is calm.
- Confidence 4. Effort 2.
- ONE change: add a "Free choice" card when allDone (draw, reading tool, or a card I like).

## (a) Slow or failing page
- Whole hub down: "We can't reach {hub} right now. Check your connection, then try again." plus a Try again button (LearningHubApp.tsx:159-162). This is friendly and reads well.
- Part of Home fails: a red dashed box "Couldn't load {what} — {message}." with Try again (homeKit.tsx:130-131). "message" can be developer text passed through errMsg.
- Save failed: "A rating didn't save — you can retry it on the summary" (ReviewSession.tsx:73), and "N ratings didn't save" (:130). That is confusing for a 9-year-old, and I might think I did something wrong.
- Hand-in: "Time ran out and we couldn't hand your … in" (TakeAssessment.tsx:132). Scary.
- Slow-load messages ("Loading...") not found in my walk. A skeleton was not verified.
- Confidence 3. Effort 3.
- ONE change: one shared kid error: "Oops, that didn't work. Nothing is lost. [Try again]" with no raw message shown.

## (b) Can anything be switched off for me?
- Reduced motion: honoured from the OS setting only, not a hub control (motion.tsx:17-20, homeKit.tsx:33, kit.tsx:141, lessonUi.tsx:65 confetti skipped). A parent has to set the tablet setting.
- Text size and spacing: exist only inside the writing tools, "Local to the component; nothing stored" (readingOptions.tsx:6) and reset each visit. No global font, dyslexia font, or colour overlay.
- Read-aloud: only registered as tool X-08 (registryData.ts:182). The code walk found no speechSynthesis call anywhere in features/learninghub, and no read-aloud button on Home, quiz or lesson.
- Timers, scores, streak, XP, confetti, "Not yet": no per-child switch found. The tutor can set timeLimitMins per quiz (StudentAssess.tsx:83) and pass mark/reveal rules in Setup (brief 7A), but nothing named "no timer/score" per child. The brief itself (8.3) lists this as a principle, not existing.
- Who controls: tutor sets quiz limits in Setup; parent holds the Grown-ups gate (KidMode.tsx:57); me: nothing. The only child-side switch I found is that "Skip" exists in previews for tutors, not me.
- Confidence 1. Effort 5.
- ONE change: a per-child "Comfort" panel behind the Grown-ups gate: timers off, scores off, read-aloud on, bigger text, calm mode (no confetti/XP/streak).

## TOP 10 frictions
See C4-friction.csv (C4-01 to C4-10 in priority order).
1. Timer with auto-submit and red urgency; no way to turn it off.
2. No read-aloud on any child screen.
3. No per-child comfort/reading settings; text controls are tool-only and forgotten.
4. Home has 9 competing blocks; no single "do this next".
5. Red "Overdue", "late", "Not yet", "Not quite" and warning icons.
6. Raw scores and "points short of the pass mark" numbers.
7. Streak resets on a wrong answer and shows "Start a streak today", plus XP and confetti.
8. Flashcard buttons "Again / Hard / Good / Easy" with "Too easy", plus keyboard hints.
9. Error copy: "A rating didn't save", "Couldn't load … — {message}".
10. "How I'm doing" button likely goes to a tab kid mode blocks; tools unreachable.

## TOP 5 keep
1. "Nearly there" / "Not there yet" and "Worth another look" in place of "Fail" (ResultView.tsx:114,159).
2. Kid level names "Getting started / Getting there / Got it!" (KidMode.tsx:14).
3. Clear one-tap flashcard flow: "Show answer" then rate, with "About 3 min" (StudentHome.tsx:169, ReviewSession.tsx:155).
4. Kid mode's calm shell: no picker, big 44-56px touch targets, Grown-ups gate (KidMode.tsx).
5. Reduced-motion honoured everywhere (motion.tsx, confetti skipped) and the friendly "can't reach" message (LearningHubApp.tsx:161).
