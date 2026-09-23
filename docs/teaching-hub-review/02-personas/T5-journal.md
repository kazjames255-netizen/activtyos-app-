# T5 journal: brand-new tutor, day one, phone (390px)

Method: walked through the code only, zero-data tenant, no browser. `LH/` = `features/learninghub/`. Line numbers are from the current tree. Things I could not verify from code are marked (unverified). Words are approximate, counted from the strings.

Assumption I could not settle: 01c-data-truth.md says the Oak library (~7,470 lessons) is imported PER TENANT. A truly new signup may therefore see "Start with a topic" (empty) or a full library. I trace both where it matters.

---

## Scenario (a): open the hub for the first time

**Goal.** Understand what this is and what to do first.

**Start.** Freelancer dashboard. The hub is opt-in and its sidebar item is hidden while off (EnableHubCard.tsx:9-11), so I only find it because a card is on my dashboard.

**Path.**
1. Dashboard card (EnableHubCard.tsx:37-38): "Teach online? Turn on the Teaching Hub" plus a 33-word sentence. The button says **"Turn on the Learning Hub"** (:42). The title says Teaching, the button says Learning, and the link goes to "Setup -> Features". Two names for one thing in one card.
2. Tap the button (1 tap), or "Not now", which hides the card forever via localStorage (:24). I am told nothing about what happens next. The card does not navigate me to the hub. I have to find the new sidebar item (unverified whether it appears without a reload).
3. Open Teaching Hub (1 tap plus the "Checking access..." gate, 2-6 s per inventory). Home renders HubHero (HubHero.tsx:127-133): title "Teaching Hub" plus lede "Live lessons, self-paced lessons, quizzes and homework for your students - built once, in one place." (16 words). That describes features, not a first step.
4. Below: 4 stat tiles that scroll sideways on a phone (HubHero.tsx:149): Subjects 0, Lessons 0, Worksheets 0, Students 0. A wall of zeros, with "enrolled and active" under Students.
5. Then TutorHome (TutorHome.tsx:157-179): a next-lesson hero (empty state, unverified wording), a "Needs your attention" card with FIVE rows all reading 0 / "All clear" (:32,:163-170), then 6 quick-action tiles in a 2-column grid (:57-63,:177-190), then Class snapshot, Callouts, "It's quiet - for now" (:209), and a chart with the note "No quiz hand-ins in the last two weeks" (:216).

**Taps.** 2-3 to reach Home. **Words read.** About 250 before I reach the first quick action, and most of it is "nothing here" text. **Screens.** Dashboard, Setup or the hub itself, Home.

**Hesitations / dead ends.**
- Nothing on Home says "start here". There is no first-run checklist and no ordering. The six quick tiles are equal weight: New lesson, New quiz, Assign homework, Schedule video lesson, Enrol student, Teach in person (:57-63). "Enrol student" (a prerequisite for everything else) is 5th, in red.
- "Needs your attention 0/0/0/0" reads like a dashboard for someone with a class. For me it is noise and makes the product look empty rather than new.
- On a phone the top of the page (hero + tiles + attention) pushes the six tiles below the first screen.
- Hub-off path (LearningHubApp.tsx:163-166): "The Teaching Hub isn't available on this account. It's off until you switch it on." plus a "Turn it on in Setup" link. That is a dead-end sentence for someone who has just signed up. It sends me to Setup, where I must find the Features switch, when the dashboard card could have done it in one tap.

**Expected vs actual.** Expected: "Welcome. Step 1 add a student, Step 2 pick a lesson, Step 3 set homework." Actual: a reporting dashboard with zeros.

**Confidence 2/5. Effort 3/5.**

**One change.** When the tenant has 0 students, replace "Needs your attention" with a 3-line "Get going" card: 1 Enrol a student, 2 Pick a lesson, 3 Set homework (each a button, ticks off itself), and demote the zero-only tiles.

---

## Scenario (b): tutor #4, enrol my first Year 3 student, placement test, first lesson, tell the parent

**Goal.** Get one Year 3 child on my roster, test them, teach them, and let the parent know.

**Start.** Home. Tap "Enrol student" (TutorHome.tsx:62). It sets an "enrol" intent and jumps to Students with the modal already open (StudentsPanel.tsx:341-342). That is well done.

**Path.**
1. Tap "Enrol student" (1 tap). The modal "Enrol a student" opens (StudentsPanel.tsx:192) with a search box "Search by child, parent, postcode..." (:217). I am a new tutor, so the list is empty: "**No children to enrol yet**. A child shows up here once their family has booked with you or joined you. To bring in a family who hasn't booked, send them your page link below." (:224-225, about 40 words).
2. Below that is FamilyLink (:259-274) and FamilyInvite (:101-135). I read: "Make a private link and send it to the parent yourself. They open it while signed in to their ActivityOS parent account (or after signing up), choose which of their children to enrol, and they appear on your roster. Valid for 30 days, for one family." (about 48 words), then "Who is it for? (optional)" and "Create invite link".
3. Tap "Create invite link" (1 tap), then copy (1 tap), then switch to WhatsApp or SMS, paste, and send (about 3 taps, outside the app). "Nothing is emailed from here" (:101 comment). Total about 5-6 taps, 3 screens (dashboard, Students modal, WhatsApp), roughly 130 words. That is only the invitation.
4. The child does NOT exist until the parent has an ActivityOS parent account, opens the link, and picks the child. I cannot type "Sam, Year 3" myself. My 5-minute goal is impossible unless the parent acts in those minutes. **This is the biggest dead end.**
5. When the parent finally joins: I return, tap Enrol on the child's row (:243), pick subjects (empty = all, :26), choose Year group (dropdown, default "Automatic - from their date of birth", :62; the defaults include Year 3, hubConfig.ts:83), tap "Enrol student" (:196). Flash: "{name} is enrolled - their family can open My Classroom now." (:524). About 4 taps and 3 decisions (which subjects, year, tutor if multi-tutor).

**Placement test.** Not required: `requireDiagnostic: false` by default (hubConfig.ts:74), but nothing tells me that. The tab "Placement test" is 5th in the strip. Inside: "How placement works" 3 steps (PlacementGuide.tsx:10-12): "Publish a test per subject / The student sits it once / Their starting point is saved". Empty state (AssessmentList.tsx:170): "Build a placement test for a subject so you know where each student is starting." Building one needs a question bank and topics I do not have, and it opens a builder (unverified how heavy). It is at least 6-10 decisions. I would skip it and never learn whether skipping costs me anything.

**First lesson.** Live lessons empty state (LiveLessonsPanel.tsx:208-210): "Schedule your first live lesson ... Pick a time, choose who's invited and they'll get a private video room - no links to paste, nothing to install." Good copy, but the button only appears if a student exists (`students.length && !readOnly`, :210). Before that: "Enrol a student first, then schedule a private video lesson with them right here." Fair, and it points back. But there is no button for it. I have to go back to Students by hand.

**Tell the parent.** No in-app message before enrolment (Messages needs a child, per inventory). The only channel is the copied link, sent by me, outside the app. After enrolment, "their family can open My Classroom now" says nothing about whether they were notified. I do not know whether the parent gets an email (unverified).

**Time.** Realistic first-run on paper: about 6 taps to create and send the invite, about 90 seconds of reading, plus an unbounded wait for the parent. Enrolment proper: 4 more taps. Placement test: I would not attempt it. First lesson: 4-6 taps plus a date and time and choosing the invitee.

**Hesitations.** The word "book" ("once their family has booked with you", :225) assumes a booking system I have not used. "Page link" appears in the empty state, but what "my page" is is not explained. I do not know whether "your page link below" (FamilyLink) differs from the invite (FamilyInvite): two similar boxes, two buttons.

**Expected vs actual.** Expected: "Add student: name, year, parent email/phone" then done. Actual: invite-and-wait.

**Confidence 2/5 (that I can finish today). Effort 4/5.**

**One change.** In the empty "No children to enrol yet" state, put FamilyInvite first (not below) and add a "Share" button using the phone's native share sheet (navigator.share) with a pre-written message, so I never leave the modal and never write the text myself.

---

## Scenario (c): set my first homework with existing library content ("a Year 3 fractions lesson")

**Goal.** Find a Year 3 fractions lesson and set it as homework for my student.

**Start.** Home tile "Assign homework" ("Set the next task", TutorHome.tsx:60). It opens the HomeworkForm directly (intent `homework`). If I have 0 students the form shows a gold notice: "You haven't added any students yet, so there's no one to set this for. Add a student in the Students tab (or invite a parent)..." (HomeworkForm.tsx:~218). The Homework empty state says the same: "Enrol a student first, then set them homework." (TutorHomework.tsx:122). So homework depends on the invite-and-wait step from (b).

**Path (assuming a student exists).**
1. Tap Assign homework (1 tap). The form is a long scroll on a phone: Title (placeholder "e.g. Factorising practice - set A"), Instructions (5 rows), Videos, Due date, Attach a quiz, **Link lessons (optional)**, Flashcards, Assign to (HomeworkForm.tsx:154-220). "Link lessons" is optional and sits after 6 other fields.
2. In "Link lessons" (NoteChecklist, hwPickers.tsx:67-107) I get one "Search lessons..." box and a 190px-high scroll list of 40 titles sorted by topic (NOTE_LIMIT=40, :65; max-h-[190px], :91). **There is no year, subject or key-stage filter.** Typing "Year 3 fractions" runs one substring match on the whole string (learningHub.ts:539 `needle`), so it almost surely returns nothing: year is a field and the words are not all in one title (unverified server match on title+body only). "fractions" alone returns Year 3 to Year 6 lessons mixed, and I can tell them apart only if the title says the year.
3. The place that DOES have a Year filter is the Lessons tab: Year-group picker (NotesPanel.tsx:652, YearGroupPicker.tsx:22 with Reception, Year 1...), a subject sidebar (280px, stacked above the list on a phone), and search. Route: Lessons tab -> pick Maths in the sidebar -> tap Year 3 in the picker -> search "fractions" -> tap the list-row icon "Set for children" (NotesPanel.tsx:279,:704) -> the form opens with the lesson attached. About 6-7 taps and 4 decisions. That works, but nothing tells me to go there rather than use the form's picker. I only find it by wandering the tabs.
4. Then in the form: Title (auto?), due date (default 7 days, hubConfig.ts:77), choose the student (:220+), tap save. About 4 more taps.
5. Draft warning (if the lesson is a draft): "still a draft, so students won't see it until it's published" plus a Publish button. Good.

**Taps.** From Home: 12-15 taps and 3 screens for the good route, 8-10 for the form-picker route, but the latter mis-finds. **Words read.** About 250 (form labels plus hints). **Time.** 3-4 minutes once I know the route, plus the student prerequisite.

**Hesitations.** Which of the 3 homework entry points? Home tile, Homework tab "Set homework" (segmented control and button share a name, TutorHomework.tsx:126), or Lessons list icon "Set for children" (the icon-only button; wording differs from "Assign/Set homework"). "Attach a quiz" and "Link lessons" both look optional and I cannot tell which one is "the homework".

**Expected vs actual.** Expected: search box takes "Year 3 fractions". Actual: title-only, single-phrase search with no filters in the place I would use it.

**Confidence 2/5. Effort 4/5.**

**One change.** Give the form's lesson picker the same Year chips and subject select as the Lessons tab (reuse `year=` which the endpoint already supports, learningHub.ts:546) and make the search split into words.

---

## Scenario (d): tutor #13, the Tools tab

**Goal.** Understand what Tools are for and whether I need them.

**Path.** Tap Tools (9th of 11 in the strip, so I scroll sideways to reach it: several swipes on a 390px screen). I land on ToolsPanel.tsx:73-90: a search box "Search tools... (e.g. angles, verbs)", a count line "N tools - M ready to use", a checkbox "Ready to use only", subject chips (All + 6 or so with counts), KS1-KS5 chips, then a grid of tool tiles. Each tile: title, "Maths - KS2-KS4", and a dashed "In build" / "Coming soon" badge with 60% opacity when not ready (:35-36, :72).

**Words read.** About 50 before tiles, then about 6 words per tile. **Taps.** 1 to see it, 1 to open a tool.

**Do I understand it?** Partly. The registry blurb says "Rulers, protractors, number lines, science diagrams and more - pick a subject." (:14) but that blurb is not shown anywhere on the screen. There is no intro line, so I never learn what a tool is FOR: a thing I use live with a child, or something I set as homework or put in a quiz ("Tool question (ruler, protractor, grid...)" exists in hubConfig.ts:70 but the connection is not signposted). Non-ready tiles are shown but greyed and clicking them says "We've noted you'd like it." (:59), which is honest and kind of charming, but a new user sees a screen mostly of things that do not work (sorted live-first, :49, so the top is fine). The tab icon on phones is missing (no PANEL_ICON for tools, so it is a sparkle fallback on desktop only; on mobile icons are hidden anyway, HubTabs.tsx:113).

**Hesitation.** "KS1-KS5" is UK jargon that I may know, but as a brand-new tutor from elsewhere, or a parent-turned-tutor, I would not.

**Expected vs actual.** Expected: a 1-line "Interactive tools to use in lessons, quizzes and homework" header. Actual: a search box.

**Confidence 3/5. Effort 2/5.**

**One change.** Add one line above the search: "Interactive helpers (ruler, protractor, number line) for live lessons. Also usable in quiz questions."

---

## Scenario (e): "Placement test", "Live lessons", "Teach in person"

**Placement test.** To me: a test at the start to see where a child is. The tab label is fine for a tutor who has used placement tests. The PlacementGuide (3 steps) does explain it, but only once I open the tab, and I meet the word 5th in the strip with no hint. Inconsistent nearby: "Starting quiz" (child), "Baseline", "Diagnostic" (key). Does it matter to me? Not on day one, and nothing says it is optional (default off).

**Live lessons.** Clear: video lessons. But the two labels ("Live lessons" tab vs "Schedule video lesson" tile, TutorHome.tsx:61) differ. Fine for me, since they are close in meaning, but I would search for "video" and find "Live". The empty state copy ("private video room - no links to paste, nothing to install", LiveLessonsPanel.tsx:209) is the best explanation in the app.

**Teach in person.** Home tile, "Teach in person / No video call" (TutorHome.tsx:196-197). I would guess: a lesson where the child is with me. The dialog title repeats "Teach in person" and later "Who's here?" (InPersonApp.tsx:224). It is understandable, but as a phone user it seems to be a big full-screen mode, and there is no hint it is where I could give a child a quiz on MY device (inPerson comment :21). It also sits as the 6th tile in a 2-column grid, so it appears alone in a row on a phone. Do the words mean anything? Yes for two of the three; "Placement test" only if I have taught in UK-style schools.

**Confidence 3/5. Effort 2/5.**

**One change.** Add a one-line hint under the "Placement test" tab title in the sub-header: "Optional. A first quiz that shows where a child starts."

---

## Scenario (f): a phone user with 11 tabs

**Path.** HubTabs (HubTabs.tsx:87-95) is one horizontally scrolling row, `w-max`, 44px tall pills, 13px text, no icons under 1024px (:113), fades appear only where there is more to scroll to (:82). Order: Home, Live lessons, Students, Progress, Placement test, Quizzes, Homework, Lessons, Tools, Flashcards, Student message centre.

At 390px about 3.5 pills are visible (Home ~ 60px, "Live lessons" ~ 100px, Students ~ 80px, Progress...). Homework (7th) is roughly 700px along, so at least 2 swipes. **Lessons, the one place I browse content, is 8th. Tools 9th, Messages last and its label is 22 characters** ("Student message centre"), the longest pill.

**Confusions.**
- I cannot see how many tabs there are or that more exist, except for the right edge fade.
- The same job lives under several names: "Placement test" and "Quizzes" are near-identical (4 sub-tabs each, same Question bank).
- Below tabs are a subject sidebar (stacked on phone), a hero and sub-tabs. The inventory counts ~47 `sm:` and 29 `lg:` rules: below 1024px the portal itself is in drawer mode.
- The active tab auto-scrolls into view (:69-78), which is good, but it means deep links land mid-strip with Home off-screen.
- Tab selection re-mounts and refetches with a skeleton (`key={active}`, LearningHubApp.tsx:263), so moving between tabs while hunting costs a flash each time.
- "Lessons" keeps its list mounted while hidden, so it is fast to return to (fine).

**Taps to get anywhere.** 1 tap per tab plus 1-3 swipes. To discover what is in the hub I would have to try 11 tabs.

**Confidence 2/5. Effort 3/5.**

**One change.** For tutors with 0 students, hide or dim 6 of the 11 tabs (Progress, Placement, Quizzes, Flashcards, Messages, Tools) behind a "More" pill until the first student is enrolled, so the strip is Home / Students / Lessons / Homework / Live.

---

## TOP 10 frictions (worst first)

1. **Cannot enrol a child I name myself.** Enrol needs an existing family account or the invite-link dance; the empty modal says "No children to enrol yet" (StudentsPanel.tsx:224-225). First student in 5 minutes is impossible. Everything else (homework, live lesson, messages) is gated behind it.
2. **No first-run guidance on Home.** Four zero tiles, five "All clear" rows, six equal tiles, no order (HubHero.tsx:149; TutorHome.tsx:32,:57-63).
3. **Homework lesson picker has no Year/Subject filter and phrase-search** (hwPickers.tsx:85-91). Cannot find "Year 3 fractions" where I would look. The Year filter lives only on the Lessons tab.
4. **Hub discoverability and naming at the door.** Hidden when off, card says "Teaching Hub" but button says "Learning Hub" (EnableHubCard.tsx:37 vs :42); after turning on, no "go to the hub" step; off-state message is a dead end (LearningHubApp.tsx:163).
5. **Invite is sent outside the app with no template or share sheet** (StudentsPanel.tsx:101,:130). I write the parent message myself. No "did they open it?" beyond a small recent list.
6. **11 tabs on a phone, no icons, 2+ swipes to Homework, and 6 tabs are irrelevant on day one** (HubTabs.tsx:113, panels.tsx:31).
7. **Three homework entry points with three names and an icon-only one** ("Assign homework" / "Set homework" / "Set for children"; TutorHomework.tsx:126 segmented control that is also a button).
8. **Placement test: optional but not said to be** (hubConfig.ts:74 default false; PlacementGuide only inside the tab). Building one needs questions I do not have.
9. **Buttons appear only after the prerequisite** (Live lessons "Schedule" needs a student, LiveLessonsPanel.tsx:210): the empty state says "enrol a student first" but gives no button to do it.
10. **Tools tab has no purpose line** and is mostly greyed "In build / Coming soon" tiles (ToolsPanel.tsx:35-36,:73); the blurb in `meta` is never displayed.

## TOP 5 KEEP moments

1. **Home "Enrol student" lands ON the open modal** (TutorHome.tsx:70-71, StudentsPanel.tsx:341-342): one tap, no hunting.
2. **Empty states tell me the next step in plain sentences**: "Set your first homework", "Schedule your first live lesson ... no links to paste, nothing to install" (LiveLessonsPanel.tsx:208-209), "Enrol your first student" (StudentsPanel.tsx:446-448).
3. **Enrol modal defaults are forgiving**: subjects blank = all, Year group "Automatic - from their date of birth" with the year defaults incl. Year 3 (StudentsPanel.tsx:62; hubConfig.ts:83), and a friendly confirmation "{name} is enrolled - their family can open My Classroom now" (:524).
4. **Homework form does the sensible things**: due date defaults to 7 days (hubConfig.ts:77), draft-lesson/quiz warnings with an inline "Publish it" button (HomeworkForm.tsx:~185), and the no-students notice explains what to do (:~218).
5. **Lessons tab filters (subject sidebar + Year picker + server search + "Set for children" on each row)** get to "Maths, Year 3, fractions" in about 6 taps (NotesPanel.tsx:652,:279); and the PlacementGuide's 3-step explanation is genuinely clear (PlacementGuide.tsx).
