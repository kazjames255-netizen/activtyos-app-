# C3 journal: Year 10-11 GCSE teen, own phone, 390px (code walk, no browser)

Paths are under features/learninghub/ (LH). I read the code as a 16-year-old. I do not change product code.

## Who am I in this app? (read this first)
There is no teen mode. The family hub has two states: the parent view, and Kid mode ("Hand over to Ava"), which a parent switches on. On my own phone I am one of these two.
- Parent view. I log in on the family portal (`/custdash/learninghub?child=...`). The first card on my Home is `"{name} this week"` with "Emailing me about {name}'s learning. Turn off" and an "Ask your tutor" link (home/StudentHome.tsx:87-99). It talks to my parent about me, in the third person. A strip under the tabs says "Want them to work on their own? Hand the device over: no menus, and it needs a grown-up to leave." (family/FamilyContext.tsx:114). So my own revision app has a banner about my parent.
- Kid mode. The bar reads `"{first}'s learning"` with a lock button "Grown-ups" (family/KidMode.tsx:52-58). To leave it I need a parent gate. I lose Progress, Live lessons and Tools (KID_TABS, KidMode.tsx:15). Progress is exactly what I want, and it is missing.
- Kid wording: levels become "Getting started / Getting there / Got it!" (KidMode.tsx:17). "Getting there!" is the phrase I hate.
- Nothing lets a 14+ pupil have a real own-login or a "Student" mode. That is the root cause of most cringe below.

## Scenario 1: What should I do now?
- Goal: open the app, see what to do, do it. Start: Home tab (parent view, since Kid mode hides Progress).
- Path and taps: (1) open the app. (2) I get a full-colour hero: `"{Good morning}, Sam."` and "You have 12 flashcards to review and 1 homework task due soon. A few minutes today keeps it all fresh." (StudentHome.tsx:131-133). (3) Scroll past the attainment chip, a flame "Start a streak today" or "3-day streak" panel with WeekDots (:138-144), and a next-live-lesson box. (4) Two cards: Flashcards ("12 cards ready. 9 due, 3 new. About 3 min.", :171-173) and Homework (up to 3 rows with due labels). (5) Latest results (rings). (6) "Mastery snapshot". (7) At the bottom, "Keep going · Up next: <quiz>" with "Start quiz" (:246-255).
- Taps to act: about 1 (Review now, or a homework row). The action is clear; it is just far down the page, and the one clear next step (`d.step`) is the last card, below the fold at 390px.
- Words read: about 250 before the first action.
- Got lost or cringed: (a) The parent summary card, "Ask your tutor". (b) The flame streak, which I read as a Duolingo child streak. (c) "A few minutes today keeps it all fresh." (d) The "Keep going" card uses a sparkle icon. (e) Nothing says "exam in N weeks" or "what to do for 20 minutes".
- Confidence 4, effort 3. The information is right; the order and tone are off.
- ONE change: put the "Keep going" next-step card directly under the greeting, and hide the parent summary and streak flame unless a parent has opted in.

## Scenario 2: Do a quiz, get some wrong
- Goal: do a homework/revision quiz, see what I got wrong. Start: Home > "Start quiz" or the Quizzes tab.
- Path: Quizzes list (sorted by subject then title, StudentAssess.tsx:74, not by weakness) > quiz card with Time / questions ("Time: 20 min" or "No limit", TakeAssessment.tsx:185) > Start. The clock starts on Start and auto-hands-in at zero (:225, :287 "Time's up. Handing in your answers..."). One question per screen: "Question 3 of 10 · 2 answered" (:274). Question kinds include MCQ, match, order, written (manual marking) and a real tool question (Geometry board / coordinate grid, tools/ToolQuestion.tsx:12-27), which is the best GCSE-style feature here. Then "Review answers" > "Hand in" > confirm modal "Hand in your answers?" (:343). Button reads "Marking..." (:337).
- Result (ResultView.tsx:113-126): a fail is "Nearly there" or "Not there yet", with "You scored 54%, just 6 points short of the 60% pass mark. Look back at the answers below, then have another go." A pass is "Brilliant, you passed!". A gold "Review these 3 topics" button scrolls to "How you did by topic", where weak rows say "Worth another look" (:159). Then "Look back at each question": each item shows "Your answer / Correct answer / Tutor feedback" with "Not quite" (:194).
- Words: about 120 on the result. Taps: Review-topics 1, answers scroll.
- Cringe: "Brilliant, you passed!" and "Nearly there" are primary-school praise. "Not quite" with an X is fine. The "Review these N topics" button only scrolls me down the same page; it does not start practice on those topics. There are no marks per question in the exam sense ("[3 marks]"), no exam board mark scheme, no "time taken" on the result.
- Confidence 4, effort 2. Good: per-topic marks ("2/5 marks", :161), the pass-mark tick on the meter, correct answers revealed (if the tutor allows), the weak-topic list sorted worst first (:100).
- ONE change: make "Review these N topics" open a short quiz or flashcards filtered to those topics (or at least jump to Lessons for them).

## Scenario 4: How am I doing per topic? Is my weakest topic obvious, two taps?
- Goal: find my weakest GCSE topic and act. Start: Home "Mastery snapshot", or the Progress tab (parent view only).
- Home card (StudentHome.tsx:225-243): a ring for my strongest subject ("Strongest subject"), then "Strongest topic" and "Focus next" TopicLines with a coloured dot and %. "Focus next" is the lowest topic (`topics[topics.length-1]`, :232). That is a good idea, but (1) it is one topic only; (2) it is a `<div>`, not a button (TopicLine, :277-288), so I cannot tap it; (3) the only button is "See progress". Taps to reach the weakest topic: 1 and it is already visible, but acting on it takes many taps (Lessons > subject > find it > lesson, or Quizzes > guess). Not two taps.
- Progress tab (progress/ProgressView.tsx): Attainment card, three stats ("Latest quiz", "Topics practised", "Quizzes taken"), then per-subject cards. Subjects are sorted A-Z (:48) and topics A-Z (:109), not weakest first. Every topic has a bar, a band chip and "N quizzes . started at X% . 3d ago". At 390px a Maths GCSE with 40+ topics is a very long list, and my weak ones are hidden among the strong. There is no filter "show weakest", no "practise this" button, no trend per topic. The trend chart is for quiz scores only (:93-98).
- Coverage: "Based on 3 of 12 topics practised" and "This score comes from 3 of 12 topics so far" are honest and I like them.
- Words: about 400 before I have found anything. Confidence 3, effort 4.
- ONE change: sort topics inside each subject weakest-first (untried last, or a "Weakest" pill row on top) and make each row tappable to "Practise" (a quiz or the lesson for that topic).

## Scenario 5: I finished early. What next? (revision plan?)
- Goal: use 20 spare minutes on revision. Start: Home after all done.
- Path: if everything is done, the bottom card says "Every quiz done — brilliant. Flashcards are the best way to lock it in. New quizzes will appear here." (StudentHome.tsx:266). Otherwise "Keep going" offers one quiz, in the order resume, placement, unseen, retry (:80-84). Flashcards: "All caught up / 14 cards scheduled for later — spaced practice at work." (:174) and "Cards you find tricky come back sooner" (kid). ReviewSession (flashcards/ReviewSession.tsx): flip card, 4 ratings with keys 1-4, Space to flip (":87 Keyboard: space/enter flips, 1-4 rate"), a "Session complete: You reviewed 18 cards . 78% felt good or easy." summary with "Check for more cards" / "Done for now". On a phone the shortcuts are hidden (`hidden sm:inline`), fine.
- What is missing: no revision plan, no "3 weakest topics to do today", no timer or "20 minute session", no past-paper section, no way to choose "revise Algebra". Quizzes list is by subject then title. The tutor decides everything; I cannot self-direct.
- Cringe: "Every quiz done — brilliant." Also the lesson player (lesson/LessonPlayer.tsx:292-316) has Confetti, XP pills, a streak, and DoneStep titles "Keep going! / Good effort! / Great work! / Brilliant!" (lesson/DoneStep.tsx:12) plus "{xp} XP earned". If I open a Year 10 Oak lesson I get this childish frame.
- Confidence 2, effort 4. ONE change: on Home, when nothing is due, show "Revise your weakest: <topic A>, <topic B>, <topic C>" as three tap-to-start buttons (from the same mastery data as "Focus next").

## (a) GCSE curriculum view: "What I've covered"
- Where: Lessons tab, first card (curriculum/CurriculumCard.tsx:92, "What I’ve covered"; subtitle "National curriculum & GCSE, at a glance" while loading; framework switch shown when more than one). Child mode is decided by `canEdit`, not age (:68).
- I see: subject tabs, a ring "of the curriculum touched", "{n} of {m} topics started in {group}", "lessons finished / to go", and a grid of area x year with `done/count` in each cell (:217), coloured done / given / not started, striped and dotted for non-colour cues. Footer: "A lesson counts as finished once its quiz is handed in." (:188). The grid is wide: `minWidth: 150 + years.length*46` inside an overflow-x scroll (:170ish), so on a phone it side-scrolls, and a GCSE student needs only Y10-11 columns.
- Useful? Partly. It answers "what have I been taught", which I do like for revision. It does not show my mastery or quiz score per spec point, and "touched" is not "secure". It counts lessons, not marks, so it is a teaching-coverage view, not a revision checklist. I would want AQA spec points ticked and rated red/amber/green from my quiz results.
- Confidence 3, effort 3. ONE change: for a Year 10-11 child default the year columns to 10-11 and colour the cells by mastery band instead of lesson count.

## (b) Messages with my tutor
- Path: Messages tab (KID_TABS includes it; label "Messages", KidMode.tsx:20) > "New message" dashed button > textarea "Write your message..." (max 2000) > send (QuestionsPanel.tsx:225-290, :352). Threads grouped by lesson folder (chevron > folder > thread), unread dot, `relTime`. In a lesson I can tap "Ask a question" ("What would you like to ask?", lesson/doubts/AskTeacher.tsx:111-115), and a reply shows as "Your teacher replied!" (:69). Empty state: "Tap “Ask a question” inside any lesson, or start one here — you and your tutor's replies both show up here, any time." (:265).
- Good: contextual (thread tied to a lesson), polls and uses realtime, one-thread reply. It is a proper two-way channel, quick to use.
- Friction: it is called "help" icon plus "Messages" in kid mode but "Student message centre" for tutors; the copy mixes "tutor" and "teacher"; in parent view the header "Ask your tutor" sends to the parent's messages, not mine. The folder-by-lesson layout at 390px needs 3 taps to reach a thread (folder, thread, then reply box). There is no "attach a photo of my working", which is what a GCSE student would send to ask about a question.
- Confidence 4, effort 2. ONE change: allow a photo attachment (working out) in the composer.

## TOP 10 frictions (see C3-friction.csv)
1. No teen/student mode: the choice is a parent's view or Kid mode with "{name}'s learning" and a "Grown-ups" lock (KidMode.tsx:52-58).
2. Kid mode removes Progress, Tools and Live lessons: my weak topics are unreachable there (KidMode.tsx:15).
3. Weak topics buried: Progress lists subjects and topics A-Z, no weakest-first (ProgressView.tsx:48,109).
4. "Focus next" is not tappable and shows one topic (StudentHome.tsx:277-288).
5. "Review these N topics" only scrolls; it does not start practice (ResultView.tsx:107-108).
6. No revision plan or "what next": the only nudge when done is "Every quiz done — brilliant." (StudentHome.tsx:266).
7. Childish tone: "Nearly there", "Brilliant, you passed!", "Getting there / Got it!", confetti, XP, DoneStep titles (ResultView.tsx:113; KidMode.tsx:17; lesson/DoneStep.tsx:12).
8. Streak flame and week dots in the hero make it look like a kids' game (StudentHome.tsx:138-144); parent summary card leads Home (:87).
9. The "Keep going" next step is at the bottom of a long Home (StudentHome.tsx:246-255).
10. Curriculum map is a wide lesson-count grid across Year 1-11, side-scrolls at 390px and says nothing about my mastery (CurriculumCard.tsx:170, 217).

## TOP 5 keep moments
1. Tool questions (geometry board, coordinate grid) inside quizzes with server-dealt problems: genuine GCSE practice (tools/ToolQuestion.tsx).
2. Result page: per-topic marks with pass-mark tick, "Worth another look" on weak topics sorted worst first, and full "Look back at each question" with correct answer (ResultView.tsx:100,150-170).
3. Flashcards: real spaced repetition, Space to flip, 1-4 rating keys, "Next cards back in..." summary (flashcards/ReviewSession.tsx:87-99,110-115).
4. Honest mastery: "This score comes from 3 of 12 topics so far" and never a full ring for a sampled subject (ProgressView.tsx:112-130).
5. Timer and autosave in quizzes: clock with auto hand-in, drafts saved and resumable on another device (TakeAssessment.tsx:225,354).
