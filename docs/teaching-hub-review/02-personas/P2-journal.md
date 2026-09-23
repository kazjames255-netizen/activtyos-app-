# P2 journal: low-confidence / EAL parent (code walk, no browser)

I am a parent. English is my second language. Old Android phone (about 360px wide), Chrome. I use a translate app when I am stuck. I did not log in; every line below was traced in code (file:line under `features/learninghub/`, "LH/").

## Language headline (answers (a))
- The app has a language switcher (components/i18n/LanguageSelector.tsx, mounted in components/shell/Header.tsx). 11 languages: pl ro ur pa bn ar pt es fr cy (lib/i18n/config.ts:12-24). It sets `<html lang dir>` (provider.tsx) and flips to right-to-left for Urdu and Arabic.
- **Nothing in the hub uses it.** `grep useI18n|lib/i18n` over `features/learninghub` returns 0 files. The i18n catalogues (lib/i18n/messages/areas/*.ts: account, care, dashboard, parent ...) have no hub area. Roughly 740 static English text nodes were counted by a crude regex (a floor; template strings and attributes add many more). Translatable share of hub strings: about 0%.
- Worse: after I pick Urdu the page goes right-to-left, but every hub word stays English. Dates are forced `en-GB` (homework/hwTypes.ts:50).
- Server error text is shown raw: `errMsg` returns `e.message` (types.ts:144), so an API error goes to the screen in English, developer style.
- The tab strip is text only under 1024px: icons are `hidden lg:inline-flex` (HubTabs.tsx:113). On my phone I see 10 English words in a scrolling row, no pictures.

## Scenario 1: What did my child do this week, and am I needed?
- Goal: know in one look if she did her work and whether I must do something.
- Start: menu > "My Classroom" (lib/nav/config.ts:508). If I have 2 children I may see "Who's learning?" first (FamilyContext.tsx:80-92).
- Path and taps: tap 1 menu (hamburger, since below 1024px), tap 2 My Classroom, wait for "Checking access" and a skeleton, "Loading Ava's day" (StudentHome.tsx:92). Home opens by default. About 2 taps, 1 screen.
- Words read, top of Home: "Ava this week" (:108) then "2 quizzes done (1 in class with the tutor), 1 homework task handed in, 1 waiting to be marked, focus next: Fractions" (:110-112). Below: hero "Good morning, Ava. You have 4 flashcards to review and 1 homework task due soon. A few minutes today keeps it all fresh." (:134). "Attainment", "Learning/Developing/Secure" chip (Attainment.tsx:61). "Streak", "Mastery snapshot" (:220), "Strongest subject", "Focus next".
- Hesitations: the summary is the best part, but the sentence is long and joined with commas ("focus next: ..."). "waiting to be marked" is fine, but "handed in" and "marked" are hard. The hero next speaks to the child ("You have...", "Keep it going"). I am not sure who it is speaking to. "Am I needed?" is never said. Only red "Overdue" on a homework row (StudentHome.tsx:194) tells me. Nothing says "Ava must do X. You do not need to do anything."
- Dead ends: Progress tab (ProgressView.tsx:96, 63-64) says "Your progress", "Every quiz you finish ..." (talks to the child, not me). The "Mastery snapshot" number (78%) has no meaning for me: 78% of what?
- Expected: "Ava did 2 quizzes and 1 homework. Nothing is late. You do not need to do anything." Actual: I must read about 120 words and infer.
- Confidence 3 / Effort 4 (effort is mostly reading, and running the translate app on each card).
- ONE change: make the top summary a two-line plain sentence with a green tick or red flag: "Ava: 2 quizzes, 1 homework done. You do not need to do anything." (StudentHome.tsx:106-113, add a "Do I need to act?" line: overdue count, else "No").

## Scenario 2: Next lesson and how to join (video call)
- Goal: on Tuesday at 5pm, join the lesson from my phone.
- Start: Home hero on the right/under greeting: "Next lesson" card (NextLesson.tsx). It shows "Next lesson", "Tomorrow · 17:00 · 45 min", the title, "with Ms Khan", a countdown "01 hrs 12 min 03 sec", and "Joining opens 10 min before · in 1 h" (:138). Button under it is "Lesson details" (:143) until 10 min before, then "Join lesson".
- Path: Home > (before time) "Lesson details" > Live tab > lesson card > Lobby. At time: Home > "Join lesson" (tap 1) > Lobby: "Before you join", a camera preview, "Asking your browser for the camera..." (Lobby.tsx:148), then Chrome's permission pop-up (in English or my phone language, that is the browser's, good).
- If two children: "Which child is joining?" (Lobby.tsx:257) and the Join button is disabled until I pick one (:274) with the long line "Attendance and the whiteboard are recorded for the child you choose" (:269). Hard.
- If the camera will not start: red text "Your browser is blocking the camera or microphone" (:205), "You can still join - but fix this first and the lesson goes much smoother." (:206) then "How to fix it" (:207) opens: "Click the camera or padlock icon at the left of the address bar. Set Camera and Microphone to Allow. Close other apps ... (Zoom, Teams, FaceTime). Press Check again." (:212-215). Then "Check again" button. On my Android Chrome there is often no camera icon; it is the padlock or the three dots > Settings > Site settings. "Address bar" is jargon. There is no picture and no "call the tutor" line. "Joining without a working camera? You'll still see and hear everyone." (:281) is kind, and a real keep.
- Dead ends: a link "Ask your tutor" is not in the lobby (full-screen). If the button says "Opens in 9 min" (:277) I cannot tell if it is broken or early. Weekday/time text uses en-GB format (relDay, fmtClock).
- Expected: a link I can tap on my phone 5 minutes before. Actual: works if permissions are fine, but every fix is English text with browser jargon.
- Confidence 3 / Effort 4 (2 if camera works, 5 if blocked).
- ONE change: in the blocked-camera help, replace step 1 with plain words plus a picture: "Tap the small lock icon at the top of the screen. Tap Permissions. Turn on Camera and Microphone." and add a top line "You can join without the camera. Tap Join lesson." (Lobby.tsx:205-215).

## Scenario 3: Something is wrong: who do I contact?
- Goal: message the tutor or the company. My child's homework shows the wrong thing / the lesson did not start.
- Where: "Ask your tutor" button in the summary card (StudentHome.tsx:116) and in the family bar (FamilyContext.tsx:136-138), goes to `/custdash/messages?compose=1&tenant=...` (LearningHubApp.tsx:212). Good: it is pre-addressed.
- Hesitations: the family bar is under the tab strip and says "Want them to work on their own? Hand the device over: no menus, and it needs a grown-up to leave." (FamilyContext.tsx:80), hidden on small screens (`hidden ... sm:block`), so on my phone I see only two pill buttons "Hand over to Ava" (big, blue) and "Ask your tutor" (small, white). The big blue one is the wrong one for my task and puts my child in kid mode by one accident tap.
- Errors: if the Hub cannot load: "We can't reach My Classroom right now. Check your connection, then try again." (LearningHubApp.tsx:164) with "Try again". That one is good plain English. Other errors: raw `e.message`. Lesson errors: "Couldn't load your lessons" (LiveLessonsPanel.tsx:92) with no next step, no phone number, no "tell your tutor".
- Other dead ends: "None of your providers have switched on My Classroom yet." (:164): "providers" is jargon and it is a dead end (no contact button). "Messages" tab is titled "Student message centre" for tutors and "Messages" for families, but the Messages tab writes to the tutor with the child (safeguarding aside).
- Expected: one obvious "Contact my tutor" and the school/company phone. Actual: works only when I find "Ask your tutor"; no support/company contact anywhere in the hub, no phone number.
- Confidence 3 / Effort 3.
- ONE change: put "Ask your tutor" (with a message icon) at the top-right of the hub header for parents and repeat it as the action on every error (`ErrorBanner`, `PartError`, "hub off" empty state).

## (a) Does switching the app language change the hub?
No. See "Language headline". I switch to Urdu; the header and menu (a few) change, "My Classroom" label is a hard-coded string in nav config (lib/nav/config.ts:508), and everything inside is English, now right-to-left, which makes English sentences and numbers like "78%" and "1 hrs 12 min" jump around.

## (b) Can I understand a result without English?
- ResultTile chips: "Passed" (green tick), "Not yet" (red warning), "Awaiting marking", "Done" (StudentHome.tsx:306). Red "Not yet" with a warning triangle for a child scoring 45% feels like a fail, and I do not understand "Awaiting marking".
- Answer review: "Correct" (tick) / "Partly right" (half-circle icon) / "Wrong" and "Correct answer" (shared-assess/ResultView.tsx:192-193, 220). The icons help; "Partly right" is understandable to someone with basic English, but the half circle "◐" is not a clear symbol.
- "78% Secure": a ring with a number and a chip word "Secure" (default band names Learning / Developing / Secure, lib/hubConfig.ts:76; `kidBand` renames them "Getting started / Getting there / Got it!" for children only, KidMode.tsx:17). "Secure" to me means "safe". The percentage does not say 78% of what (the sub-label says "mastery" (StudentHome.tsx:231)). Tutors can rename bands so a parent might see anything.
- ScoreRing has color + number, good. But red vs green is the only "good/bad" signal beside the word.
- Verdict: I can read the number and the colour without English; I cannot understand the words Secure, Developing, Mastery, Attainment.

## (c) The "Grown-ups only" gate (ParentGate.tsx)
- I only meet it if I tap "Hand over to Ava" (FamilyContext.tsx:115) and later want to leave kid mode. Then: title "Grown-ups only", "Leave Ava's screen", "To go back to the family menu, answer this:", "What is 17 × 8?" (:16 `rnd(13,19) x rnd(6,9)`), a number box, "Stay here" / "Unlock". A wrong answer gives a new sum with "Not quite. Here is a new one." (:31).
- Barrier for me: yes, moderate. Two-digit times single-digit in my head, on a phone keypad, while my child watches; "×" and "What is" are English; I did not choose to enter this mode carefully. Numerals are universal, and the sum is an arithmetic I can do with pencil or the calculator, but the 6-9 range (e.g. 19 × 8 = 152) is hard mentally. There is no help text and no "Stay here" as a good exit, but there is one.
- The real risk is the reverse: a child who cannot read English can not leave, which is intended; a parent who cannot do the sum is locked out of their own menu. No alternative (e.g. a hold-and-tap or parent PIN) exists, and no lock icon labelled in my language.
- ONE change: use one-digit x one-digit or a plain "press and hold 3 seconds" alternative; add a small note "Ask a grown-up to type the answer" is not needed; make the sum at most 9 x 9 and allow a calculator note.

## Top 10 frictions (see P2-friction.csv for evidence)
1. Hub is 0% translatable; language switch flips direction (RTL) but not a word of hub text.
2. Jargon in the parent's first view: "Mastery snapshot", "Attainment", "Secure/Developing/Learning".
3. Placement test shown to parents, no explanation ("Take the placement test", "Placement tests set your starting point").
4. Home speaks to the child ("You have 4 flashcards", "Your progress"), a parent cannot tell who is addressed.
5. "Do I have to do anything?" is not answered; no explicit "Nothing needed" line.
6. Camera-blocked help is English, browser-jargon, no Android path, no picture.
7. Tab strip is text-only on phones (icons only at lg), 10 tabs to scroll.
8. Errors show raw server text (`errMsg`) with no next step, no contact.
9. "Hand over to Ava" is the biggest button in the family bar and leads to the maths gate.
10. Dates and times are en-GB fixed; "Due Tue, 30 Sep", "hrs/min/sec" countdown; large hero text competes with the real info.

## Top 5 keep moments
1. "Ava this week" summary card: quizzes, homework, waiting to be marked (StudentHome.tsx:106-113).
2. "Ask your tutor" pre-addressed message link (LearningHubApp.tsx:212).
3. Lobby lets me join without camera and says so (Lobby.tsx:206, 281).
4. Offline message in plain words with a "Try again" button (LearningHubApp.tsx:164).
5. Result rings with colour, number and a tick/warning icon; 44px+ tap targets everywhere (StudentHome.tsx:313, HubTabs.tsx `min-h-[44px]`).

## Jargon / reading-age: the 25 worst parent-visible strings
(1 = plain, 5 = hard. Reading age is my estimate.)
| # | String | file:line | Score |
|---|---|---|---|
| 1 | "Mastery snapshot" | home/StudentHome.tsx:220 | 5 (14+) |
| 2 | "Attainment" | progress/Attainment.tsx:61 | 5 |
| 3 | "Take the placement test" | home/StudentHome.tsx:78 | 5 |
| 4 | "Placement test" (tab label) | DiagnosticPanel.tsx:12 | 5 |
| 5 | "Placement tests set your starting point" | progress/ProgressView.tsx:96 | 5 |
| 6 | "No baseline yet" / "Started at 40%" | progress/charts.tsx:14 | 5 |
| 7 | "Secure" / "Developing" / "Learning" (default bands) | lib/hubConfig.ts:76 | 4 |
| 8 | "mastery" ring sub-label | home/StudentHome.tsx:231 | 4 |
| 9 | "Awaiting marking" | home/StudentHome.tsx:306 | 4 |
| 10 | "Based on 2 of 5 topics practised" | home/StudentHome.tsx:235 | 4 |
| 11 | "spaced practice at work" | home/StudentHome.tsx:170 | 5 |
| 12 | "None of your providers have switched on My Classroom yet." | LearningHubApp.tsx:164 | 4 |
| 13 | "How to fix it: click the camera or padlock icon at the left of the address bar" | live/Lobby.tsx:212 | 4 |
| 14 | "Attendance and the whiteboard are recorded for the child you choose" | live/Lobby.tsx:269 | 4 |
| 15 | "Hand over the device: no menus, and it needs a grown-up to leave." | family/FamilyContext.tsx:80 | 4 |
| 16 | "Grown-ups only ... To go back to the family menu, answer this" | family/ParentGate.tsx:24-27 | 3 (plus a maths sum) |
| 17 | "Results are saved for the child you pick, so choose before you start." | family/FamilyContext.tsx:92 | 3 |
| 18 | "Partly right" | shared-assess/ResultView.tsx:193 | 3 |
| 19 | "Not yet" (red, warning icon) | home/StudentHome.tsx:306 | 3 (tone) |
| 20 | "Couldn't load your lessons" (raw errMsg fallback) | useHubData.ts:46, LiveLessonsPanel.tsx:92 | 3, no next step |
| 21 | "Getting started / Getting there / Got it!" (kid bands, seen if a child's device) | family/KidMode.tsx:17 | 3 |
| 22 | "Flashcards ... 4 due . 2 new. About 2 min." | home/StudentHome.tsx:169 | 3 |
| 23 | "Emailing me about Ava's learning. Turn off" | home/StudentHome.tsx:283 | 3 |
| 24 | "Ended - waiting for your tutor to reopen it" | home/NextLesson.tsx:133 | 3 |
| 25 | "Joining opens 10 min before . in 1 h" / "01 hrs 12 min 03 sec" | home/NextLesson.tsx:22,138 | 3 |
Also seen only in tutor-facing tools a parent can open (Tools tab, tools/english/frames.ts:139): "PEE paragraph (Point, Evidence, Explain)" scores 5. The Tools tab is visible to parents (inventory: 10 tabs) with no explanation.

## HubTabs at 360px
One scrolling row (HubTabs.tsx:87-92), 44px high, `text-[13px]`, `px-2.5`, no icons under 1024px (:113). 10 words: Home, Live lessons, Progress, Placement test, Quizzes, Homework, Lessons, Tools, Flashcards, Messages. About 4 fit; the rest hide behind a swipe with a small 36px fade edge as the only clue. As a parent I would never find "Messages" or "Progress" without swiping and guessing "Placement test".
