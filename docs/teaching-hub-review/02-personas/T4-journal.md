# T4 journal: SEND specialist tutor (dyslexia, ADHD, autism) + learner C4

Method: walked through the code only, no browser, nothing changed. Paths are under `features/learninghub/` unless stated. C4 is my learner: Year 6, dyslexia + ADHD, easily overwhelmed by many boxes, hates being "timed" and "wrong", laptop.

## 0. The settings map (who can control what)

### Per CHILD (what I can set for one learner)
| Setting | Exists? | Evidence |
|---|---|---|
| Time extension / no timer | NO. Timer is a property of the quiz, not the child | `shared-assess/api.ts:107` `timeLimitMins` on the assessment; `TakeAssessment.tsx:77` deadline = startedAt + quiz minutes |
| Read-aloud | NO anywhere in the hub (no `speechSynthesis` in the repo). Tool X-08 is "In build" | `tools/registryData.ts:182`; `ToolsPanel.tsx:18` |
| Font / line spacing / colour overlay | NO for the hub. Only 2 writing tools have size + spacing, local state, "nothing stored" | `tools/english/readingOptions.tsx:6,10-15`; X-09 "Accessibility panel" is "In build" `registryData.ts:183` |
| Reduce motion | Only follows the device OS setting (`prefers-reduced-motion`). No per-child switch | `kit.tsx:141`, `lesson/lessonUi.tsx:28,65`, `shared-assess/ResultBanner.tsx:12`, `HubTabs.tsx:17` |
| Hide streak / XP / scores | NO. Streak strip is unconditional on the student home, XP + streak pills unconditional in every lesson | `home/StudentHome.tsx:138-142`; `lesson/LessonPlayer.tsx:315-316` |
| Fewer tabs | Only "kid mode": one fixed 7-tab list, device-local, set by a parent, not by me | `family/KidMode.tsx:12,15`; adult family view keeps all 11 (`panels.tsx:31`) |
| Different due date for one child | NO. One due date per homework for everyone assigned | `homework/HomeworkForm.tsx:49,167-169` |
| Quiz targeted to a child | Only by year group / age band, not by child | `shared-assess/api.ts:27` `Audience`; `shared-assess/audience.ts` |
| One extra retake for a child | YES, tutor grants "one more attempt" from Results | `quiz/AssessmentBuilder.tsx:243` text; `shared-assess/retake.tsx` |

### Per QUIZ
- Time limit on/off + minutes (default 20, when on): `quiz/AssessmentBuilder.tsx:40-41,125,190-193`. Copy note: "Untimed" shown on the tutor card `quiz/AssessmentList.tsx:269`.
- Pass mark %: `AssessmentBuilder.tsx:42` (defaults to tenant).
- Retake policy: Follow my setting / Unlimited / One attempt / Wait between (hours): `AssessmentBuilder.tsx:45,240-241`.
- Audience (years/ages), published flag, question set/order: `AssessmentBuilder.tsx:43-44`, `shared-assess/api.ts:27`.

### Per TENANT (Setup > Marking & progress, `lib/hubConfig.ts`)
`passMarkPct` (:15,70), `requireDiagnostic` (:18,71), `revealAnswers` (:21,72, default after_pass), `masteryBands` (:23,73 names Learning/Developing/Secure), `homeworkDueDays` (:25,74 = 7), `retakePolicy` (:31,76 = unlimited), `retakeCooldownHours` (:32), `retakeBreakAfter` = 3 fails then `retakeBreakMinutes` = 30 lock (:35-36,78-79), `yearGroups`, `subjectColours`, `questionKinds`, `srsMinEase`.

### Gaps that matter for SEND
1. No per-child accommodation profile at all (extra time %, no timer, reading options, reduce motion, hide streaks/XP, read-aloud on/off). This is the single biggest hole.
2. Timer is set only on the quiz, so extra time means cloning the quiz.
3. No tenant switch for "no streaks / no XP / no red".
4. The 3-fails-then-30-minute lock is on by default (`hubConfig.ts:78-79`) and cannot be set per child.
5. No dyslexia font, no read-aloud, no colour overlay, and the Accessibility tool is not built.

---

## Scenario #3: set homework for a child with dyslexia + ADHD, short and chunked

- **Goal:** one small, single-sitting homework for C4 (5 minutes, one thing).
- **Start:** Homework tab, "Set homework" (or Students > C4 card > "Set homework").
- **Path/taps:** 1 Set homework button. 2 dialog "Set homework" (`HomeworkForm.tsx:142`). 3 optionally "Lesson pack" picker at the top (:151). 4 Title (:153). 5 Instructions, 5-row textarea (:157). 6 Videos (:162). 7 Due date (:167). 8 Attach a quiz (:172). 9 Link lessons (:184). 10 Flashcards to revise (:210). 11 Assign to (:218). 12 Save.
- **Words read:** "Set homework", "Each student gets their own copy to hand in, they're notified straight away", "What should they do? Which questions? What should they hand in?", "Due end of day. Default is 7 days out."
- **Hesitations:** Eight labelled fields in one dialog; I want ONE of them. Nothing says "keep it short". Instructions is a free wall of text I must chunk by hand. Due date default is 7 days, not "tomorrow/Friday". Every parent and child is notified straight away, and I cannot say "do not notify yet".
- **Expected vs actual:** Expected "task, 5-min size, tick-list of steps, one due date for this child". Actual: a general form. To chunk I have to write "1) 2) 3)" in the textarea myself, or attach a 5-question quiz I first build in the quiz builder (another dialog). The child then sees a plain "Your answer" 7-row textarea (`homework/StudentHomework.tsx` around the text area, "Write your answer here, or attach a photo") which is a blank wall for a dyslexic writer. Photo of work is accepted, which is good (700 KB limit, "PDF or image, up to 700 KB each").
- **Late language:** if C4 misses the date the child sees "Overdue" in red (`homework/hwTypes.ts:44`), "Handed in late" red pill (`StudentHomework.tsx:190`), and "This is past its due date, it'll be marked as late" (`:333`). Anxiety trigger, and I cannot switch it off or move one child's date.
- **Confidence:** 3/5. **Effort:** 4/5.
- **ONE change:** add a "Short task" preset at the top of the dialog: due tomorrow, instructions become a numbered checklist (one line per step, shown one at a time to the child), and quiz/videos/lessons/flashcards collapse under "More options".

---

## Scenario #9: build a quiz with extra time and no timer

- **Goal:** a 6-question quiz for C4 with no clock, and a version for a peer with 25% extra time.
- **Start:** Quizzes > "+ New quiz" (`AssessmentBuilder.tsx`).
- **Path/taps:** pick type, title, subject, topics, questions (picker, paged), then the "Time limit" switch (`:190-193`), pass mark, retake, audience, Publish.
- **Words read:** "Time limit" with a switch showing "Off"; on = a number box and "min".
- **Hesitations:** No-timer is easy: leave the switch off (default is off unless the assessment already had a time). Good. But "extra time" has no place: there is no "for this child" or "% extra". Audience picks year/age only (`shared-assess/api.ts:27`). To give one child longer I must duplicate the quiz with different minutes and publish two versions, and the child's list will show both.
- **What a timed quiz does to C4 anyway:** the clock is server-side from Start: `TakeAssessment.tsx:77` deadline = startedAt + minutes; leaving does not pause it ("but the clock keeps running", `:354`); at zero it auto-hands-in (`:140-147`, "Time's up. Handing in your answers…" `:287`); last minute turns the pill red (`:260,278`). The intro warns "The clock starts when you press Start and your answers are handed in automatically when time is up." (`:225`). For an ADHD/anxious child that is a cliff edge.
- **Related lock I cannot switch per child:** after 3 fails in a row on an unlimited quiz, the child is locked out 30 min ("Time for a little break. Look back over the lesson, then have another go in 30 min", `shared-assess/retake.tsx:43,66`; defaults `hubConfig.ts:78-79`). Kindly worded, but a locked door mid-homework.
- **Expected vs actual:** expected a per-child "extra time / untimed" list. Actual: quiz-level only.
- **Confidence:** 3/5 (untimed) / 1/5 (extra time). **Effort:** 3/5.
- **ONE change:** per-child "Timing" in Students (Normal / +25% / +50% / No timer) that the server applies over any quiz's `timeLimitMins` when that child starts.

---

## Scenario #13: the new Tools tab for SEND

- **Goal:** find a tool for C4 that lets them work by keyboard/numbers, at a readable size, with no pressure.
- **Start:** Tools tab (11th of 11 tabs for a tutor, `panels.tsx:31`).
- **Taps:** open Tools, search or subject/KS chip, tap tile.
- **Words read:** "216 tools · 78 ready to use", "Ready to use only" checkbox (`ToolsPanel.tsx:77-78`), tiles greyed "In build" / "Coming soon" (`:18`).
- **Clutter:** 138 tiles are greyed placeholders unless I tick "Ready to use only". Unticked is the default (I see them). For me every greyed tile is noise.
- **SEND essentials are NOT built:** X-03 Timer, X-08 Read aloud (any text), X-09 Accessibility panel are "In build" (`registryData.ts:177,182,183`); nothing implements them in `registry.ts` NATIVE. So: no read-aloud, no dyslexia font, no contrast controls.
- **Reading options exist, in only two tools:** text size (Normal/Large/Extra large: 16/19/23 px) and line spacing (1.5/1.85/2.25) in the writing tools (`english/readingOptions.tsx:10-15`); comment says "nothing stored" (`:6`), so I re-set it every time C4 opens a tool. Segments are 44px tap targets (`:21`), good.
- **Timers are opt-in in the tools I checked:** TimedWriting says "Timer is OPT-IN and off by default for KS1-2. No streaks, scores or rewards" (`TimedWriting.tsx:9`), but the code is `useState(ks >= 3)` (`:23`), so at KS3+ it starts ON. Label "Use a timer (optional)" (`:54-55`). Verb trainer timer default off (`languages/verbs/VerbTrainer.tsx:67,153`). Grammar tally reads "No pressure" (`languages/grammar/shared.tsx:42`); GenderTrainer header "No timers and no streaks". Strong SEND-aware design.
- **Keyboard / numeric alternatives:** good coverage. Geometry board: arrow keys move instruments, +/- radius (`maths/geometry/GeometryBoard.tsx:254,268,385`) and numeric inputs (`:323,454`). CoordGrid: "Use the boxes below to add points" x/y inputs (`maths/CoordGrid.tsx:85,102`). AngleFacts: decimal input + focusable regions (`AngleFacts.tsx:51,63`). Equation balancer numeric inputs, LabelDiagram keyboard/tap picker (`science/labels/LabelDiagram.tsx:31,127`), DataGraph handles keyboard (`science/data/DataGraph.tsx:140`). Dialog traps focus, Escape closes (`ToolHost.tsx:40-48`).
- **Two snags:** tools always render on a forced light theme (`tools/lightScope.ts:5-8`), which overrides a child's dark/contrast preference. And the Tools tab is not in the child's tab list (`KID_TABS`, `KidMode.tsx:15`), so C4 can only meet a tool when I open it or it appears inside a quiz question.
- **Confidence:** 3/5. **Effort:** 3/5.
- **ONE change:** hide In build/Coming soon tiles by default (tick "Ready to use only" on by default), and store the reading options (size, spacing) per child so they persist across tools.

---

## Child C4 #1: I open the app, what do I do now?

*(First person, as C4.)*

- **Goal:** find my homework and do it, fast.
- **Start:** Learning Hub home (`home/StudentHome.tsx`). If a grown-up handed me the laptop in kid mode I see 7 tabs (`KidMode.tsx:15`); otherwise 11.
- **What I see, top to bottom:** big purple hero "Good evening, C4." then "You have 10 flashcards to review and 1 homework task due soon. A few minutes today keeps it all fresh." (`StudentHome.tsx:134`). Under it a mastery bar, a flame with "Start a streak today" (`:141`) and 7 dots. On the right a "Next lesson" box with a ticking countdown (`home/NextLesson.tsx:24`, ticks every second). Then cards: Flashcards (big number), Homework, Latest results, "How I'm doing", "Keep going". That is about 8 blocks and 3 moving things before I scroll.
- **Words I read/skip:** I read "Good evening" and the big number. I skip most small grey text (11-13px). "Overdue" or "Due within the hour" in red/gold makes my stomach drop (`hwTypes.ts:44,48`, card tone red `StudentHome.tsx:179,194`).
- **Hesitation:** which one first: flashcards, homework, Keep going, or the next lesson? Four buttons say "Review now", homework list, "See progress", "Start". There is no single "Do this first".
- **Expected vs actual:** expected one big "Start" for today. Actual: a dashboard.
- **Confidence:** 3/5. **Effort:** 3/5.
- **ONE change:** a "Today: just this one thing" card at the very top (the single next task, one button), with the rest folded under "More".

---

## Child C4 #2: I do homework and get some wrong, what does the UI say?

- **Goal:** finish the quiz attached to my homework.
- **Path:** Homework > tap task > "Start" > questions > "Review answers" > hand in > result.
- **Taking:** sticky bar: "Question 3 of 6 · 2 answered", a clock pill if timed, a thin progress bar, then the question, then Back / "Next →" (or "Skip →" if blank), then a row of numbered squares (`TakeAssessment.tsx:262-330`). Pressing Enter in a text box jumps to the next question (`:~300`), which surprised me: I thought Enter would save my answer. Questions slide in (0.28 s) unless my OS says reduce motion.
- **In a lesson warm-up (practice) I get wrong:** the box shakes (`lesson/WarmupStep.tsx:80` `ls-shake`), turns a red-tinted panel (`:111`) and says "Not quite" then "The answer is 'x'." then the explanation (`:114-116`). Wording is kind. Right answers get "Yes! / Spot on!" (`:17`), gold streak pill and XP pill count up (`LessonPlayer.tsx:255-258,315-316`), confetti after 3 in a row (`:257,292`). When I get one wrong the streak pill drops to 0. That hurts.
- **End of lesson:** big title by stars: 0 stars = "Keep going!" (`lesson/DoneStep.tsx:12`), plus "XP earned" (`:40`).
- **After a real quiz:** amber ring, "Nearly there" (or "Not there yet" if 30+ points short) (`shared-assess/ResultView.tsx:114`); calm amber not red (`ResultBanner.tsx:12`). Then "Correct answer" shown under each miss (`ResultView.tsx:215-220`) only if the tenant's rule allows it (default after passing only, `hubConfig.ts:72`). So a child who did not pass sees no key. Fine for integrity, confusing for me: I see my wrong answer but not why.
- **Handing in:** "Ready to hand in?" then "You haven't answered 2 questions yet. Unanswered questions score no marks." in a yellow warning (`:354`).
- **Late homework:** "Handed in late" red pill, "it'll be marked as late" red text (`StudentHomework.tsx:190,333`).
- **Feeling:** mostly gentle. The red warning, the streak reset and the percentage ring are what hurt.
- **Confidence:** 3/5. **Effort:** 2/5.
- **ONE change:** a "Calm mode" child flag that removes streak/XP/confetti, uses neutral blue instead of red for "Not quite" and "Overdue", and says "Due Friday" instead of "Overdue".

---

## Child C4 #4: see how I'm doing

- **Path:** Home > "How I'm doing" (kid tab label, `KidMode.tsx:20`) or the "How I'm doing" card on Home, then "See progress".
- **What I see:** a coloured ring with a big % ("Strongest subject", subject name, "Based on 3 of 8 topics practised", a pill "Getting started / Getting there / Got it!" (`KidMode.tsx:17`). Then "Strongest topic" and "Focus next" boxes with a % each (`StudentHome.tsx` TopicLine, 13px). "Focus next" is the weakest topic.
- **Also in the hero:** 7 week dots, "2-day streak" (`:141`).
- **Reaction:** "Getting started" is much nicer than "Learning" or a red band. Good. But a % on every line makes me compare myself, and "Focus next" reads like "your worst". The streak makes a missed day feel like failure.
- **Expected vs actual:** I wanted "here's what you did this week" (things done), not levels. The parent summary "C4 this week: 2 quizzes done · 1 homework task handed in" exists but is shown to parents only (`StudentHome.tsx:111`, hidden in kid mode).
- **Confidence:** 4/5. **Effort:** 2/5.
- **ONE change:** in kid view show "This week I did: 2 quizzes, 1 homework" (the parent sentence) as the first line of "How I'm doing" and hide the percentages behind a "Show numbers" tap.

---

## TOP 10 frictions (details in T4-friction.csv)
1. No per-child accommodation profile (extra time, no timer, reading options, hide gamification). T4-01
2. Quiz timer auto-submits with a red last-minute pill, no pause; extra time only via cloning quizzes. T4-02
3. Streak, XP, confetti and flame cannot be turned off (home + every lesson). T4-03
4. "Overdue", "Handed in late", red warnings shown to the child; one date per homework. T4-04
5. Read-aloud, accessibility panel, timer tools are "In build"; only 2 tools have size/spacing, unsaved. T4-05
6. Homework form: 8 fields, no short/checklist preset, child gets a blank 7-row textarea. T4-06
7. Student home has ~8 blocks and 3 moving elements, no single "start here". T4-07
8. 30-minute retake lock after 3 fails, tenant-wide only. T4-08
9. Tools tab shows 138 greyed tiles by default; Tools forced light theme; child cannot reach Tools. T4-09
10. Enter key advances a question and "Unanswered questions score no marks" warning; reduced motion only via OS. T4-10

## TOP 5 KEEP moments
1. Focus mode while taking a quiz: hero and sidebar hidden, autosaved drafts across devices (`TakeAssessment.tsx:146-150`, `useDraftSync`).
2. Calm amber "Nearly there" result, not red; pending marking shows an hourglass, never 0% (`ResultBanner.tsx:12`, `ResultView.tsx:114`).
3. Kid-friendly level names "Getting started / Getting there / Got it!" (`KidMode.tsx:17`).
4. SEND-aware tools: opt-in timers, "No pressure" tally, "No timers and no streaks" trainers, keyboard and numeric alternatives, 44px controls (`TimedWriting.tsx:9`, `grammar/shared.tsx:42`, `GeometryBoard.tsx:254`).
5. Break message wording "Time for a little break. Look back over the lesson" and every animation respects reduce-motion (`retake.tsx:66`, `lessonUi.tsx:28`).
