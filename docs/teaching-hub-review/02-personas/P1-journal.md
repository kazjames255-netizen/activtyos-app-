# P1 journal - busy parent, two kids, phone on the commute (390px)

Walked through code only (no login). File refs: `LH/` = `features/learninghub/`, `SRV/` = `server/src/routes/hub/`. Line numbers are from today's tree.

## What I see when I open it (used by every scenario)
Top to bottom on my phone, Home tab, before I reach anything about my child:
1. Hero banner "My Classroom" with lede "Lessons and practice from {tutor}, for {child}." (HubHero.tsx:61-62), collapsible, plus a two-child pill switch (HubHero.tsx:88-97).
2. FamilyBar: child chip + "Hand over to Ava" + "Hand over to Leo" + "Ask your tutor" (family/FamilyContext.tsx:104-140). The explainer sentence is `hidden ... sm:block` so on my phone it is not shown (:114).
3. A scrolling tab strip (HubTabs.tsx) - about 7 tabs, Home / Lessons / Live / Quizzes / Homework / Flashcards / Messages / Progress.
4. THEN the JoinRemoteSync banner (if live), THEN "Ava this week" (StudentHome.tsx:106). So my one-glance answer is roughly 3 screens of chrome down.
5. Under it, a big hero that talks to the CHILD: "Good morning, Ava. You have 2 flashcards to review and 1 homework task due soon. A few minutes today keeps it all fresh." (:132-135) then a flame streak card and the next-lesson countdown.

---
## Scenario 1 - What did my child do this week, are they on track, is anything overdue?
- **Goal:** 10-second answer for one child.
- **Start:** tap the bell / email link -> /custdash/learninghub. Email deep links carry `child=` only if the parent has exactly one child in scope (hubNotify.ts:66-67); with two kids the link opens whichever child was last picked (or first by default, useHubData.ts:59).
- **Path/taps:** open (0) -> scroll past hero+FamilyBar+tabs (1 scroll) -> read "Ava this week" strip (:106-118). If overdue: Homework card (:180+) or tab Homework (1 tap).
- **Words read:** "Ava this week" / "2 quizzes done (1 in class with the tutor) · 1 homework task handed in · 1 waiting to be marked · focus next: Fractions › Adding" (:112-116); empty: "Nothing handed in yet this week. A good place to start: {quiz}." Then "Homework": task titles with "Overdue by 3 days" / "Due tomorrow" (hwTypes.ts:44-50, red/gold tiles), or "Nothing to hand in".
- **Hesitations/dead ends:**
  - The summary counts what she DID (handed in) but never says "on track". No sentence like "all good / 1 thing overdue". Overdue is only discoverable in the Homework card further down (:180); the summary strip does not mention overdue at all.
  - "Nothing handed in yet this week" reads like an accusation when the tutor simply set nothing; it cannot tell "nothing set" from "not done".
  - "waiting to be marked" mixes quizzes and homework, and "focus next: Fractions › Adding" is a jargon-ish arrow path.
  - The big hero below speaks to Ava ("You have 2 flashcards to review... keeps it all fresh"): I read "you" and have to translate. The Mastery card says "Strongest subject" only - good news shown, weak news hidden in a second line "Focus next".
  - Two-child default: nothing asks me which child until a runner starts (family/FamilyContext.tsx:60-62). If I never notice the highlighted pill I could read Leo's week as Ava's. The chip is in the FamilyBar, but the hero says only the child's first name - OK, but easy to miss on phone.
  - Score wording: "Not yet" red chip (StudentHome.tsx ResultTile) is kind; "Passed" says nothing about my child's level. Percent shown is "Mastery 78%" with no plain "what does 78% mean" (data-truth doc row 2: mastery can show while Latest results says none - trust 4).
- **Expected vs actual:** expected one sentence "Ava: on track, 1 homework overdue"; got a tally of counts, need to infer.
- **Confidence 3/5 . Effort 3/5.**
- **ONE change:** put a status line at the top of "Ava this week" that starts with overdue: "1 homework overdue (Fractions sheet, 3 days)" in red or "Nothing overdue".

## Scenario 2 - When is the next lesson and how do we join?
- **Goal:** time, and a join button, without hunting.
- **Path:** Home -> next-lesson card inside the child-addressed hero (StudentHome.tsx:140-147, NextLesson.tsx). Two taps to join: "Join lesson" -> Live tab -> Lobby -> "Join lesson" (Lobby.tsx:274-277).
- **Words:** status pill "Next lesson"; "Tomorrow · 16:30 · 45 min"; title; "with {tutor}"; 4-cell countdown ("1 day 03 hrs 12 min"); "Joining opens 10 min before · in 1 day..." (NextLesson.tsx:138). Before the window the button is "Lesson details >" not "Join" (:145). Inside window "Join lesson" (white). In the Lobby: camera/mic check with "Your camera preview", and if blocked "Click the camera or padlock icon at the left of the address bar. Set Camera and Microphone to Allow." (Lobby.tsx:212-214) - written for desktop; my phone has no such address-bar icon. Button: "Opens in 9 min" / "Waiting for your tutor" / "Join lesson".
- **Hesitations:**
  - The lesson time is shown in the phone's local zone but the emails/bell say Europe/London hard-coded (lessonsApi.ts:97): fine for UK, wrong for a parent travelling.
  - The countdown is styled for a child (seconds ticking). I need "Tue 16:30" in large text; it is small grey-white 12.5px (NextLesson.tsx:~107).
  - "Lesson details >" is a dead-endish label: it goes to the Live tab; I expected "Join" greyed with a date.
  - Two children with lessons at the same time: hero shows only the picked child's next lesson. No "Both kids have lessons Tuesday" cross-view.
  - If the tutor started a broadcast lesson ("remote sync") the banner reads "Your tutor has started "X" - join now to follow along live." with a "Start" button (JoinRemoteSyncBanner.tsx:69-71) - "your tutor" and "Start" are child-voice; a parent on the commute may think it starts something new; "Resume" wording is better.
  - In-person lessons: nothing on Home says WHERE. (No location field surfaced.)
  - No reminder notification before a lesson: the only lesson emails are scheduled / changed / cancelled / reopened (see 3b). I get told once when it's set up and never again.
- **Expected vs actual:** expected big "Tomorrow 4:30pm" + "Join" ; got it in 2 taps but the join path depends on the lobby and camera permission help is desktop-worded.
- **Confidence 4/5 . Effort 2/5.**
- **ONE change:** send a "Lesson starts in 1 hour - tap to join" notification linking straight to the Lobby (open=lesson:id).

## Scenario 3 - Something is wrong: who do I contact?
- **Path:** FamilyBar "Ask your tutor" (FamilyContext.tsx:136-139; visible without scrolling, one tap) -> leaves the hub to `/custdash/messages?compose=1&tenant=...` (LearningHubApp.tsx:211). Also "Ask your tutor" link inside the summary (StudentHome.tsx ~123) and the Messages tab.
- **Words read:** "Ask your tutor" (send icon). Messages tab empty state: "No messages yet - Tap "Ask a question" inside any lesson, or start one here - you and your tutor's replies both show up here, any time." (QuestionsPanel.tsx:265).
- **Hesitations/dead ends:**
  - TWO inboxes: the hub's "Messages" tab (per-lesson question threads) and the portal's own messages (where "Ask your tutor" goes). Tutor replies could land in either place; the bell says "Your tutor replied" (doubtsApi.ts:181) and links to the hub tab. I don't know which to check.
  - "Ask your tutor" is phrased for questions about work. For "my child was upset", "we can't make it", "I was charged twice", "the video won't work" - there is no phone/email/emergency route and no "Report a problem" or "Cancel this lesson". Billing/cancellation is outside the hub and not linked.
  - Tutor replies notification fires only on the FIRST reply (doubtsApi.ts:177-179 `firstReply`): follow-up replies are silent - a parent waiting on an answer gets nothing after the first.
  - If two children have different tutors ("provider" switch), which tutor gets the message? `tenant=` only - not child.
- **Expected vs actual:** expected "Message Ms K / call us / report a concern". Got one send button with question-shaped copy.
- **Confidence 3/5 . Effort 2/5 (send) - 4/5 (anything other than a question).**
- **ONE change:** on Ask your tutor compose, add a 3-option chooser "Question about work / Can't make a lesson / Something else" and show the tutor's phone/email if set; keep it in one inbox.

---
## (a) Two children - switching
- Two kids: an inline "radiogroup" pill switch in the hero, each pill 44px with avatar + name (HubHero.tsx:88-97); 5+ kids become a dropdown. Works well on 390px for 2 names (I tap Leo, everything reloads for Leo). The choice is remembered and written to the URL only after it's "confirmed" (LearningHubApp.tsx:68, useHubData.ts:59).
- Hesitations: (1) the switch lives in the hero (only full-size on Home; on other tabs the hero collapses to a compact bar with the switch still present, HubHero.tsx:116-125) - OK. (2) Default is child #1 with no prompt - unclear which child I am looking at until I read the chip. (3) No combined view: "Leo has 2 things overdue" never shown while I'm on Ava. To check both kids on the commute = switch, scroll, read, switch, scroll, read. (4) Notifications with 2 kids: bell/email link opens the last-picked child unless the notice is for one child; per-child notices carry `child=`, good; multi-name ones don't (hubNotify.ts:66).
- Runners (quiz/lesson) ask "Who's learning?" and disable Start until confirmed (FamilyContext.tsx:60-105) - protective and clear: "Results are saved for the child you pick, so choose before you start."
- **Confidence 4/5 . Effort 2/5. ONE change:** a small red dot / count on the non-selected child's pill when they have an overdue or unread thing.

## (b) Notifications and emails (all category "learning", parent-facing via `notifyFamilies`, hubNotify.ts)
Bell always written; email only if not muted (notify.ts:332). Mute toggle exists on Home under the week summary: "Emailing me about Ava's learning. Turn off" (StudentHome.tsx:281-283) - hidden under the summary, and the toggle mutes ALL learning emails including cancellations (single category). Triggers:

| # | Trigger | Title / body wording | Source | Verdict |
|---|---|---|---|---|
| 1 | Homework set | "New homework" / `Ava has new homework: "Fractions sheet", due 3 Oct.` (plural bug: "Ava and Leo has new homework") | homeworkApi.ts:135-138 | Useful. Fix grammar. No overdue follow-up. |
| 2 | Homework marked | "Homework marked" / `Ava's "Fractions sheet" has been marked: 7/10.` | homeworkApi.ts:422-425 | Useful; 7/10 with no "good/needs work" or feedback preview. |
| 3 | Quiz/placement marked | "Quiz marked" / "Placement test marked": `Ava's quiz "X" has been marked: 12/20 (60%).` | attempts.ts:470-473 | Useful. "Placement test" is jargon. |
| 4 | In-person quiz result | "Lesson done with your tutor" / `Ava did "X" in person with Ms K: 8/10 (80%). The result is in My Classroom.` (or "so far - written answers still to be marked") | inPersonApi.ts:417-421 | Good; same title as #5, fine. |
| 5 | In-person lesson attended, no result | "Lesson done with your tutor" / `Ava completed the lesson "X" in person with Ms K.` | inPersonApi.ts:450-453 | OK, a reassurance ping; borderline noise if every lesson. |
| 6 | Tutor sends message | "New message from your tutor" / `Ava - "<first 140 chars>"` | doubtsApi.ts:111-114 | Very useful (shows text). |
| 7 | Tutor first reply | "Your tutor replied" / `Ava asked about "X" - your tutor replied: "..."` | doubtsApi.ts:179-182 | Useful, BUT only first reply. Later replies silent. |
| 8 | Live lesson scheduled (single/series) | "Live lesson scheduled" / "Weekly live lessons scheduled": `Ava: "X" with Ms K, Tue 30 Sep, 16:30. You can join from My Classroom.` / "every week from ... (12 lessons)" | lessonsApi.ts:229-233 | Useful. Says "join from My Classroom" not a link-phrase; link goes to Live tab. |
| 9 | Lesson time changed | "Live lesson time changed" / `Ava: "X" is now Wed 1 Oct, 17:00.` | lessonsApi.ts:343 | Essential, but doesn't say the OLD time. |
| 10 | Child added to a lesson | "Live lesson scheduled" / same as 8 | lessonsApi.ts:345 | Fine. |
| 11 | Lesson cancelled (edit) | "Live lesson cancelled" / `... on Tue 30 Sep, 16:30 and the 3 weekly lessons after it have been cancelled.` | lessonsApi.ts:335-337 | Essential. No reason / no "what next". |
| 12 | Lesson deleted | "Live lesson cancelled" / `... has been cancelled.` | lessonsApi.ts:360 | Same. |
| 13 | Lesson reopened | "Live lesson reopened" / `"X" has been reopened by Ms K. You can rejoin from My Classroom once your tutor is in.` | lessonsApi.ts:401 | Confusing for me: "rejoin", "reopened" - child-facing state leaking to parent; likely noise. |

Not sent at all (declared in notify.ts:50-51 "new notes ... lessons scheduled" but no trigger): new notes/lessons shared, homework due soon / overdue, lesson starting soon, weekly summary, flashcard streak, child hasn't logged on. Net: notifications tell me about things the tutor DID, never about things my child HASN'T. For scenario 1 that's the wrong half.
- Muting: one switch for everything (single category) and it's tucked in the Home summary. The bell still records. "Emailing me about Ava's learning" - only Ava's name, but it mutes for all children.
- **Confidence 3/5 . Effort 2/5. ONE change:** add "Homework due tomorrow / overdue" nudge (once, daily digest style) and a "lesson in 1 hour" ping; consider a separate mute for "reminders" vs "changes".

## (c) Kid mode hand-over and the Grown-ups gate
- Enter: FamilyBar "Hand over to Ava" (lock icon, brand pill, 44px) -> immediately full-screen kid mode (LearningHubApp.tsx:211; `fixed inset-0`). No confirm, no explanation on phone (the sentence "Want them to work on their own? ... it needs a grown-up to leave." is `hidden sm:block`, FamilyContext.tsx:114). On a 390px phone I only see a lock icon + "Hand over to Ava" - a child could tap it by accident in my pocket; nothing tells me how to get back.
- Child sees "Ava's learning" bar with a lock button "Grown-ups" (KidMode.tsx:62-64; aria "Grown-ups: leave kid mode"). Tabs limited to Home, Lessons, Quizzes, Starting quiz, Homework, Flashcards, Messages (KidMode.tsx:15). No Progress, no Live tab - so a child in kid mode CANNOT join the video lesson from the hub tabs (Live is not in KID_TABS) - I'd have to exit and rejoin as grown-up. (Check with tutor-broadcast lessons: the remote-sync banner does show on kid Home.)
- Gate: dialog "Grown-ups only / Leave Ava's screen / To go back to the family menu, answer this: What is 17 x 8? [numeric] Stay here | Unlock" (ParentGate.tsx:24-32). Wrong: "Not quite. Here is a new one."
- Understandable? Mostly yes. Issues: (1) 13-19 x 6-9 mental multiplication is a real effort at 8:10 on a bus (and a Year 6-7 with a phone calculator gets through); (2) "the family menu" - my mental model is "the app", not "family menu"; (3) new sum every wrong try - fair; (4) "Stay here" vs "Unlock" - OK.
- Back button is trapped inside the hub (useKidGuards) - good for kid, but when I as parent want to leave I hit Back repeatedly with nothing happening. The only exit is Grown-ups.
- **Confidence 3/5 . Effort 3/5. ONE change:** show a one-time confirm on "Hand over" ("Ava will only see her lessons. To come back, tap Grown-ups and answer a sum.") - and drop the sum to two-digit x single-digit (e.g. 14 x 6 or 47 + 38).

## (d) "What I've covered" (curriculum) - how it reads to a parent
- Location: not on Progress - it's a collapsible card at the top of the Lessons (Notes) tab (NotesPanel.tsx:646; CurriculumCard.tsx:92). I would never look there for "what has my child learned".
- Title "What I've covered" is first person - written to the child; as a parent I read it as a child's card. Collapsed subtitle: "N lessons given · N finished..." (CurriculumCard.tsx:~100). Open: subject chips; ring "of the curriculum touched"; "12 of 30 topics started in Maths"; "6 lessons finished" / "9 to go"; a Topic x Year grid (Y1..Y6 columns, 42px cells) with legend "finished / given / not started"; footer "National curriculum ... A lesson counts as finished once its quiz is handed in."
- Understandable? The ring is honest ("touched", "started") - good, not a mastery claim. But: (1) grid with "Y3 Y4 Y5" and strand names ("Geometry", "Position and direction") - fine for a parent, dense for phone (min-width 150+46/year, horizontal scroll); (2) "given" vs "assigned" vs "to go" - three words for similar states; (3) "lessons finished" depends on a quiz hand-in - if the lesson has no quiz it never finishes, so 0% can be misleading; (4) tap a cell -> AreaDrawer (tutor-ish content).
- **Confidence 2/5 . Effort 4/5. ONE change:** show the parent a title "What Ava has covered" (third person) and move it under Progress.

---
## TOP 10 frictions
1. No "on track / overdue" verdict; overdue hidden below the fold (StudentHome.tsx:106-118 vs :180).
2. The whole Home reads as the child's screen ("Good morning, Ava. You have..."); parent summary sits below hero + FamilyBar + tabs (LearningHubApp.tsx:232-247).
3. Notifications only cover tutor actions; no overdue, lesson-starting-soon or absence nudge; only one lesson reminder ever (hubNotify.ts callers).
4. Tutor follow-up replies never notify (doubtsApi.ts:177-179 firstReply).
5. Two inboxes / "who do I contact" - Ask your tutor goes to portal messages, replies live in hub Messages; no contact/problem route.
6. One mute switch for all learning emails including cancellations; toggle hidden inside Home summary (StudentHome.tsx:281).
7. Kid-mode hand-over has no explanation on phones (FamilyContext.tsx:114 `hidden sm:block`) and no way for the child to reach Live tab.
8. Gate sum 13-19 x 6-9 is heavy for a tired parent and says "the family menu" (ParentGate.tsx:10,27).
9. "What I've covered" is in Lessons tab, first person, and gives child-voice words (CurriculumCard.tsx:92).
10. Two-child: no cross-child glance (overdue/unread dot on the other pill); default child unconfirmed (useHubData.ts:59); plural grammar "Ava and Leo has new homework" (homeworkApi.ts:137). Also Lobby camera help is desktop-worded (Lobby.tsx:212).

## TOP 5 keep
1. "Ava this week" parent summary strip (StudentHome.tsx:106-118) - the right idea, includes "1 in class with the tutor" and "waiting to be marked".
2. Notification bodies name the child, the item and the due date/time, and deep-link to the right thing (hubNotify.ts hubHref, `open=hw:...`, `child=` for single-child).
3. Homework due labels: "Overdue by 3 days" / "Due tomorrow" in red/gold tiles (hwTypes.ts:37-51, StudentHome.tsx:187-200).
4. Two-child pill switch in the hero + "Who's learning?" confirmation before a runner starts (HubHero.tsx:88; FamilyContext.tsx:60-105).
5. Learning-email mute lives in the parent's face and bell keeps recording (StudentHome.tsx:281; notify.ts:332) - and "Not yet" / "Being marked" gentle result wording (ResultTile).
