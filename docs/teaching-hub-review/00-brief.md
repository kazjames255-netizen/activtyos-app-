Claude Code brief: Teaching Hub overnight redesign (8-hour, multi-agent, autonomous build) Paste this whole file into Claude Code at the root of the ActivityOS repo, on a fresh branch. This is an autonomous job. Nobody will answer questions. You research, reflect, critique, decide, build, test and commit
— all night, without direction. When you are unsure, pick the option that is simplest for a child and a tutor, write the reasoning down, and keep going.
1. Mission Make the ActivityOS Teaching Hub the best teaching and learning space a tutor or child has ever used
— while keeping it simple enough that it never overburdens a child or a tutor
.
 The focus is flow, structure, layout, navigation (tabs), simplicity and ease of use . Content changes are allowed if they serve that goal, but they are not the main event.
 You will do this in a loop: reflect as real people → critique → change the product → verify 
→ critique again. By the morning the branch should contain a materially better Teaching Hub, a clean commit history, and a written record of every decision so the owner can review and revert anything.
 The owner cares about (and you should add anything else you find that matters): - Flow — does each person get from "I opened the app" to "the thing I came to do is done" without thinking?
 - Simplicity — fewer choices, fewer screens, fewer words, one obvious next step. - Ease of use — works on a phone between sessions, works for a 6-year-old, works for a tired parent.
 - Structure — tabs, grouping, naming and hierarchy that match how teaching actually happens.
 - Layout — what is on screen, in what order, at what size, on mobile and desktop. - Also consider : speed/perceived performance, empty states, error states, consistency, language/jargon, accessibility, safeguarding and trust, motivation and delight (without gamification overload), notifications/noise, multi-tenant/white-label fit, and admin time saved per week.
2. Hard rules (read twice) 
1. Work on a branch. git checkout -b teaching-hub-redesign first. Never touch main. Commit small and often (one proposal = one commit, message starts with hub:). Never force-push, never rewrite history, never push unless a remote and instructions to do so already exist in the repo.
 2. Never mutate real data. The HQ "view as" / impersonation banner says "anything you do changes their real data." Use a local seeded/test tenant and test users for every walkthrough and every test. When you must look through an impersonated real user: look, open, hover, cancel
— never submit, send, mark, assign, schedule, enrol, broadcast or delete. Never send messages to real students/parents. Never start a real broadcast.
 3. Do not touch database schema, migrations, auth, payments, billing, or anything outside the Teaching Hub module unless a hub change strictly needs a tiny, additive, backwards-compatible change
— and then document it in
 11-open-questions.md as something the owner must review first.
 4. Nothing ships broken. Before every commit: type-check, lint, existing test suite, and a Playwright smoke run of the affected screens at phone
+ desktop. If a change cannot be made green, revert it and record why. The app must start and every hub tab must render at the end of the night.
 5. Evidence before change. Every change traces back to friction observed by a persona agent, with a screenshot or code reference. No changes
"because it looks nicer".
 6. Simplicity budget. A change that adds a screen, tab, setting, badge or notification must remove or merge at least one other, or justify in writing why the net burden goes down.
 7. Reversible by design. Prefer changes the owner can undo commit-by-commit. Keep old components in place (unused) rather than deleting them until the final clean-up commit, which is separate and clearly labelled.
 8. Don't design for the demo. Design for the 40th time a tutor does something on a Tuesday night, and for a child on a cracked phone.
 9. Checkpoint files as you go (see §9). If the session dies, the work so far must be usable and the branch must be green.
 10. British English, UK school terminology (Year 1–13, KS1–KS4, EYFS, SEND, DSL, GCSE,
11+).
 11. Do not ask the owner anything. Decide, document in 11-open-questions.md with what you chose and why, and move on.
3. Context you need Product: ActivityOS — multi-tenant, white-label booking/CRM/ops platform for children's activity and tuition providers. APF Activity Camps is tenant
#1. The Teaching Hub is the teaching/learning module used by freelance tutors and providers, their students (children and teens) and parents.
 Local app: http://localhost:3000. API expected on http://localhost:4000. When the API is down, the hub shows
"We can't reach Teaching Hub right now" and Setup shows
 "Couldn't reach the server at http://localhost:4000" . Start both before walking through. Log it as a finding if start-up is fragile. Known routes (tutor/freelancer side): - /freelancer/learninghub — Teaching Hub (main subject of this review) - /freelancer/dash, /freelancer/listings, /freelancer/bookings, /freelancer/customers, /freelancer/setup - Setup & features → Teaching Hub settings live separately from the hub (Marking & progress: pass mark,
"require a placement test",
"show right answers", retake wait, and more).
 - Discover the student/child , parent and HQ/admin routes yourself from the router and codebase. Map them all.
 Teaching Hub tabs observed (tutor view): Home · Live lessons · Students · Progress · Placement test
· Quizzes
· Homework
· Lessons
· Tools (new)
· Flashcards
· Student message centre (with unread badge)
· Settings (links out to Setup).
 What the Home tab shows today (tutor "AmirFreelancer", 8 students): - Hero "Teaching Hub" with a Hide button. - Stat cards: Subjects 7 (2,457 topics) · Lessons 7,894 (1 in draft) · Worksheets 1 · Students
8.
 - Sticky banner: You're broadcasting "Explain the relationship between adjacent multiples of eight"
—
0 of
8 connected
+ Rejoin.
 - "Next lesson" card (empty state, "Schedule a video lesson"). - "Needs your attention — 23 things": homework to mark (9), written answers to mark (7), overdue homework (6), quiet for
14+ days (1).
 - Quick actions: New lesson, New quiz, Assign homework, Schedule video lesson, Enrol student, Teach in person.
 - Student snapshot: mastery grid by student × subject with 4 bands (Learning 0%+, Developing
50%+, Secure
80%+, Mastered
90%+, Not started).
 - Top improvers, Needs a nudge, Recent activity feed, Weekly rhythm chart. Other observations to verify, not assume: 
- Students tab: All/Active/Paused filters, optional Groups (e.g. "Year 5 Maths", "Exam prep") with one-click Homework/Quiz/Lesson per group, and student cards showing Progress
/ Message
/ Set homework.
 - Live lessons: schedule video lessons, Teach in person, Upcoming/Past. - Progress tab includes a "National curriculum coverage" view. - Header counts disagree with the lesson library export: the library has 7,470 lessons across
6 subjects (English, Maths, Science, French, Spanish, German), but the hub shows
7,894 lessons and
7 subjects. The library's
 unit field is empty, while the hub shows
"2,457 topics". Treat this as a trust and clarity issue for tutors, not just a data bug.
 - A curriculum cross-reference exists: ActivityOS-lessons-vs-national-curriculum.xlsx. The owner can drop it into
 docs/teaching-hub-review/inputs/. It maps every lesson to its national curriculum area and lists gaps: no Year
1 fractions, no statistics in Years
2–5, no Year
5 position and direction, no Year
1 spelling, and
534 GCSE language lessons that sit outside the national curriculum. Use it where browsing/finding lessons is concerned.
 - The tutor hub renders a mobile layout even at ~700px wide. Check breakpoints. 
4. How to run this: agents You are the lead . Use subagents (Task tool) liberally and in parallel. Each subagent gets a brief (template in
§6), works independently, and writes its own file. You synthesise.
4.1 Recon agents (Phase 0) - Cartographer — reads the router, pages and components. Produces a full screen inventory
: every route, tab, sub-tab, modal, drawer and empty/error state in the Teaching Hub, across tutor, student, parent and admin roles. Include component file paths.
 - Screenshotter — uses Playwright (Chromium is installed) to capture every screen at 
390×844
(phone),
768×1024
(tablet),
1440×900
(desktop) , in light and dark mode if supported. Saves to
 screenshots/<role>/<screen>-<viewport>.png. Read-only navigation only.
 - Action counter — for each screen, lists every clickable action and its label. Counts primary vs secondary actions, text density (words above the fold) and the number of distinct colours/badges. Flags duplicate actions that reach the same place by different routes (e.g.
"Assign homework" on Home vs Students vs Groups vs Homework tab).
 - Data-truth checker — traces where every number on Home comes from (subjects, lessons, topics, worksheets, students,
"23 things", mastery
%, weekly rhythm). Explains the
7,894 vs
7,470 and
7 vs
6 differences, and says whether other tenants' content leaks into the counts.
4.2 Persona agents (Phase 1) Each persona agent becomes that person. They walk the real screens (or traced code) doing their scenarios, and keep a first-person journal
: what I expected, what I saw, where I hesitated, what I tapped wrong, what I gave up on, what I'd tell a friend.
 # Persona Who they are Device / context What "great" means to them T1 Solo tutor (like Amir) 
8 students aged 6–17, maths/English/science. Tutors evenings and weekends Phone between sessions, laptop on Sunday for planning Knows in 10 seconds what to do today. Marks and assigns in a few taps. Never hunts for anything T2 Tuition centre lead / tenant owner Runs 6 tutors and 120 students, white-labelled Desktop Consistency across tutors. Oversight without micromanaging. Nothing embarrassing in front of parents T3 Group/camp teacher HAF holiday camp or after-school club, 15–25 kids in person, mixed ability, low tech time Tablet on a trolley, patchy Wi-Fi 
"Teach in person" in two taps. Register-style flow. Nothing individual that is impossible at scale T4 SEND specialist tutor Dyslexia, ADHD, ASD learners Laptop Can reduce clutter, lengthen time, read aloud, chunk work. Progress shown kindly 
# Persona Who they are Device / context What "great" means to them T5 Brand-new tutor, day one Just signed up, zero students, zero content Phone Empty states that teach. First student enrolled and first homework set in under 5 minutes P1 Busy parent Two kids, pays for tuition, checks on the commute Phone, notifications 
"Is my child OK, what's next, do I need to do anything?" in one glance. No jargon P2 Low-confidence / EAL parent English is a second language, low digital confidence Older Android Plain words, icons with labels, translation (language switcher exists — does it reach the hub?) C1 Year 1–2 child (age 5–7) Pre-reader or early reader Parent's phone or tablet Big tap targets, audio, one thing at a time, no reading needed to navigate, instant praise C2 Year 4–6 child (age 8–11) Confident but distractible Family tablet Knows "what do I do now", sees progress, feels good, done in 15–20 minutes C3 Year 10–11 teen (GCSE) Exam-focused, wants autonomy, allergic to babyish UI Own phone Fast, grown-up, revision-focused, sees weak 
# Persona Who they are Device / context What "great" means to them topics, not nagged C4 Child with SEND e.g. dyslexia + ADHD Tablet Low clutter, predictable layout, read-aloud, no timers unless chosen, no shame on scores X1 Accessibility auditor WCAG 2.2 AA Keyboard, screen reader, 200% zoom Every flow completable without a mouse. Contrast, focus order, labels, motion X2 Safeguarding lead (DSL) KCSIE-minded Desktop Messaging, video lessons, data visibility, impersonation and parent/child boundaries are safe and auditable X3 Information architect Senior IA/UX lead Desktop Clean mental model, consistent naming, minimal navigation depth, one home for each job The C-personas depend on the child/student routes. If a child view doesn't exist or isn't reachable, the Cartographer must say so. The child agents then review what a child would see (the assigned lesson, quiz, homework and results screens) and how the tutor-side structure constrains it. The owner will add more child-area notes to
§8.
4.3 Scenario scripts (give the relevant ones to each persona) Each scenario is scored on: taps/clicks, screens visited, time estimate, moments of hesitation, errors, words read, confidence (1–5)
.
 Tutor scenarios 1. Open the app at 6:55pm before a 7pm lesson. What do I need to know and do? 2. Clear the "Needs your attention" list: mark 9 hand-ins and 7 written answers. How many screens? Can I batch?
 3. Set tomorrow's homework for the "Year 5 Maths" group on fractions. Find a suitable lesson or quiz for Year
4/5 fractions, check it, assign it, set a due date.
 4. A new student (Year 3) enrols. Get them started: placement test, then a first lesson, then tell the parent.
 5. Schedule a video lesson for next Tuesday, then run it. What happens when 0 of 8 connect
? How do I end a broadcast I forgot about?
 6. Teach in person to a group of 6. Take a register, set a quick quiz and record results. 7. Parents' evening prep: show Olivia's progress in maths over the term in a way a parent understands.
 8. Tommy has been quiet for 14+ days. Nudge him or his parent in the kindest, fastest way. 9. Build a 10-question quiz from scratch. Then build one by reusing existing questions. 10. Find a flashcard set and a worksheet for Year 8 science cells. Assign both. 11. Change the pass mark and the "show right answers" rule. Where did I have to go? Why is that outside the hub?
 12. Read and reply to the 4 unread student messages. 13. Use the new Tools tab. What is it for? Would I find it without being told? Child scenarios (as the child, age-appropriate) 1. Open the app. What should I do right now? Do it. 2. Do my homework quiz. Get some wrong. What happens? How do I feel? 3. Join my tutor's live lesson. 4. See how I'm doing. Do I understand it? Does it motivate or worry me? 5. I finished early. What can I do next without getting lost? 6. Send my tutor a message or question (if permitted — check the safeguarding angle). Parent scenarios 1. What did my child do this week? Are they on track? Is anything overdue? 2. When is the next lesson and how do we join? 
3. Something's wrong — who do I contact? 
4.4 Challenger agents (Phases 4 and 6) - Simplicity hawk — tries to delete, merge or hide every proposed element. Asks of each one:
"What breaks if this isn't here?"
 - Overloaded tutor — Friday, 11pm, 30 students. Rejects anything that adds clicks, settings or decisions.
 - The six-year-old — rejects anything needing reading, precision taps or waiting. - Engineer — checks each proposal against the actual codebase: effort estimate (S/M/L/XL), what components can be reused, risky dependencies, data-model impact. Writes the implementation notes the builder agents follow.
 - Safeguarding & data — blocks anything that widens who sees whose data or opens unsupervised child-contact channels.
 - White-label owner — does the proposal still work when the tenant is a football camp, a tuition centre or a single tutor, under their own branding?
4.5 Builder agents (Phase 5) Work in parallel on non-overlapping areas (one agent per tab/flow to avoid merge conflicts). Each builder:
 - Takes one proposal (P-nn) with its implementation notes. - Reads the components involved, reuses the design system, makes the change, runs type-check/lint/tests/Playwright smoke, commits with message
 hub: P-nn <title>. - Writes 07-changes/P-nn.md: what changed, files touched, before/after screenshots (Playwright, phone
+ desktop), how to revert.
 - If blocked, or the change would break rule 3 or 4, stops, records why in 11-open-questions.md, and moves to the next proposal. 
4.6 Re-review agents (Phase 6) After building, the persona agents from §4.2 go back in on the changed app and re-run their scenarios, writing
 02-personas/<id>-journal-after.md and new friction rows tagged round=2. Anything that got worse is fixed or reverted in Phase 7. 
5. Timeline (8 hours) Time Phase Output 
0:00–0:15 Setup. Branch, start app + API, confirm test tenant and test users, create docs/teaching-hub-review/, write 00-README.md README, run notes 
0:15–0:50 Phase 0 — Recon (Cartographer, Screenshotter, Action counter, Data-truth checker in parallel) 
01-inventory.md, screenshots/before/, 01b-actions.csv, 01c-data-truth.md, current sitemap (Mermaid) 
0:50–2:20 Phase 1 — Persona walkthroughs (all personas in parallel) 
02-personas/<id>-journal.md, 03-friction-log.csv 
2:20–3:00 Phase 2 — Synthesis (lead + IA agent) 
04-synthesis.md, 04b-scorecard.md 
3:00–3:40 Phase 3 — Decide : structure options, pick one, write proposals with implementation notes 
05-structure-options.md, 06-proposals.md, 08-child-experience.md 
3:40–4:10 Phase 4 — Challenge : challengers attack, proposals revised, final build list ordered by (impact ÷ effort), quick wins first 
09-challenge-log.md, updated proposals 
4:10–6:40 Phase 5 — Build (builder agents in parallel, non-overlapping areas; lead merges and keeps the branch green) commits, 07-changes/P-nn.md, screenshots/after/ 
6:40–7:20 Phase 6 — Re-review : personas re-run scenarios on 
02-personas/*-after.md, round-2 friction rows, Time Phase Output the changed app, challengers re-check 
04b-scorecard.md updated with "after" scores 
7:20–7:50 Phase 7 — Fix / revert anything that got worse or is flaky; final clean-up commit green branch 
7:50–8:00 Phase 8 — Handoff 10-roadmap.md (what's built, what's next), 11-open-questions.md, 12-executive-summary.md If something overruns, protect Phases 2, 5, 7 and 8. Cut the number of scenarios and the number of proposals built, never the synthesis, never the green-branch check. Build in priority order so that stopping early still leaves the most valuable changes done. It is better to ship
6 finished, verified changes than
15 half-done ones.
6. Subagent brief template (use for every persona) You are <PERSONA NAME>: <one-paragraph profile — age, role, context, device, goals, frustrations, tech confidence>.
 You are reviewing the ActivityOS Teaching Hub. You do not change code. On the TEST tenant / test users you may complete flows end-to-end (submit, assign, mark) so you feel the whole journey. On any real/impersonated user: look, open, hover, cancel only
— never submit, send, assign, mark, schedule, enrol, broadcast or delete.
 App: http://localhost:3000 (<login/role instructions>). Viewport: <390x844 | 768x1024 | 
1440x900>.
 Screens and code map: docs/teaching-hub-review/01-inventory.md. Screenshots: docs/teaching-hub-review/screenshots/.
 Do these scenarios in character: <list>. For each scenario record, in the first person: - Goal, starting point, the path you took (screen by screen), taps/clicks, words you had to read 
 - Every hesitation ("I wasn't sure whether…"), wrong turn, dead end, confusing label, anything that scared or annoyed you
 - What you expected vs what happened - Confidence 1–5 and effort 1–5 - The ONE change that would have helped most Then list your top 10 frictions and your top 5 "keep this, it's good" moments. Log every friction as a row in docs/teaching-hub-review/03-friction-log.csv: id, persona, scenario, route, component_file, screen_area, friction, severity(1-4), frequency(daily/weekly/rare), evidence(screenshot path or code ref), suggested_fix, burden_type(tutor|child|parent|admin)
 Write your journal to docs/teaching-hub-review/02-personas/<ID>-journal.md. Stay in character. Be specific, not polite. Don't propose big redesigns — that's the lead's job. Just report what it's like.
7. Lenses to apply in synthesis (Phase 2) Score every screen 1–5 on each lens and put the results in 04b-scorecard.md: 1. Clarity of purpose — can you tell what this screen is for within 3 seconds? 2. One next step — is there a single obvious primary action? 3. Choice load — how many options are visible? (Hick's law) Is anything shown that isn't needed now?
(progressive disclosure)
 4. Steps to done for the top 3 jobs on that screen. 5. Consistency — same thing, same name, same place, same look across tabs and roles. 6. Language — jargon, internal terms, ambiguous verbs ("Lesson" vs "Live lesson" vs 
"Teach in person").
 7. Mobile ergonomics — thumb reach, tap target size, sticky elements eating screen space (e.g. the broadcasting banner).
 8. States — empty, loading, error, offline, first-run, 0 students vs 30 students. 9. Trust — do the numbers make sense and agree with each other? Do counts match reality?
10. Burden — admin minutes per week for the tutor; minutes and decisions per session for the child.
 11. Accessibility — WCAG 2.2 AA issues. 12. Emotional tone — encouraging, calm, respectful. Especially how scores, "overdue" and 
"quiet for
14 days" are shown to children and parents.
 Structural questions to answer explicitly. These are hypotheses to test, not decisions: - Are 11+ tabs right? What is the tutor's real mental model: Today / Students / Content library
/ Teach (live
+ in person)
/ Progress
/ Messages
? Or something else? Test at least
3 alternative structures against the scenarios and count the clicks.
 - Should Lessons, Quizzes, Homework, Flashcards, Worksheets and Tools be one Library with types and filters, with
"Assign" as a verb available everywhere, rather than separate tabs?
 - Is Homework a content type or an assignment? Is it currently modelled confusingly? - Should Placement test live inside "Add student" onboarding instead of being a top-level tab?
 - Should Messages be a global inbox (header icon), not a hub tab? - Should hub Settings (pass mark, retakes, placement, show answers) live inside the hub, or have contextual overrides at the point of use (e.g. per quiz)?
 - Does Home try to do too much? (stats, live banner, next lesson, attention list, quick actions, mastery grid, improvers, nudges, activity, rhythm). What is the minimum
"Today" view, and what moves to Progress?
 - Are vanity stats (7,894 lessons, 2,457 topics) useful to a tutor on Home, or noise? What would be useful instead?
 - Is "Groups" (optional) pulling its weight, or should group assignment be the default path? - How does a tutor find the right lesson among ~7,500? Browse by subject → year → curriculum area (see the NC spreadsheet), search, recommended-for-this-student? Where does the national curriculum mapping add value without adding clutter?
 - What is the single loop of teaching (diagnose → teach → practise → check → report) and does the navigation follow it?
 - Where do parent and child views mirror the tutor's structure, and where should they deliberately NOT?
7A. Tutor / provider hub — owner's notes from a walkthrough How to treat this section: same as §8 — first-hand observations and suggestions from one walkthrough as tutor
"AmirFreelancer" (8 students, impersonated from HQ). Inputs to the persona agents, not decisions. The tutor, centre-lead, camp-teacher, SEND, new-tutor, IA, engineer and simplicity agents must confirm, reject or go beyond every point with evidence. Anything here that survives the challenge phase goes through the normal proposal
→ build path.
7A.1 What the tutor hub is today Route: /freelancer/learninghub?tab=<tab> inside the freelancer shell (side nav: Dashboard
· Teaching Hub
· Blocks
& listings
· Run the day
· Marketing
· Money
· Settings; top bar: Bookings
· Families
· Contact
· Find a child
· language
· bug
· notifications).
 - Hero: "Teaching Hub" + Settings (links out to /freelancer/setup?tab=hub) + Hide. Four stat cards: Subjects
7
(2,457 topics)
· Lessons
7,894
(1 in draft)
· Worksheets
1
· Students
8.
 - Tabs (11): Home · Live lessons · Students · Progress · Placement test · Quizzes · Homework
· Lessons
· Tools
· Flashcards
· Student message centre (badge
4). On a
~900px window the tab strip already scrolls horizontally and the last tab is cut off.
 - A persistent subject/topic bar under the tabs ("All subjects · 7894 lessons", with per-tab variants: subject chips
+
"Manage topics"; on Placement/Quizzes it lists English
· French
· Geography
· German
· Maths
· Science
· Spanish).
 - A persistent "You're broadcasting … 0 of 8 connected — Rejoin" banner on most tabs (same stale lesson seen on the child side).
 - Home: live banner → Next lesson (empty) → "Needs your attention — 23 things" (Homework to mark
9
· Written answers to mark
7
· Overdue homework
6
· Quiet
14+ days
1)
→ six quick actions (New lesson
· New quiz
· Assign homework
· Schedule video lesson
· Enrol student
· Teach in person)
→ Student snapshot mastery grid (8 students
× Overall/Maths/English/Science,
4 bands
+ Not started)
→ Top improvers
→ Needs a nudge
→ Recent activity feed (10 items)
→ Weekly rhythm chart.
 - Live lessons: "Teach in person" + "Schedule video lesson" buttons, empty calendar, Upcoming
/ Past (7).
 - Students: All 8 / Active 8 / Paused 0 · search · "Enrol a student" · Groups (4) ("Optional 
— one click to set homework, a quiz or a lesson for a whole group"), each group card with Homework
/ Quiz
/ Lesson
"+" buttons
· then a student card per child (name, ACTIVE, year, groups, subjects, MASTERY, Progress
· Message
· Set homework, Enrolled date).
 - Progress: "National curriculum coverage" panel (Maths 86% / English 96% / Science 
96%
/ Languages
1366 lessons placed,
"Open the curriculum map")
→ student search, year-group and group filters, Recalculate
→ mastery table (student
× English/Maths/Science, band chips,
"Edit levels",
"Only students with scores").
 - Placement test: sub-tabs Placement tests · Question bank · Marking · Results → "How placement works"
3-step explainer
→
"+ New placement test"
→ status filter
→ subject counts (All
78
· English
15
· French
11
· German
11
· Maths
16
· Science
14
· Spanish
11)
→ year-group counts (Reception
→ Year
13)
→ KPI row (Published
75
· Attempts
17
· Avg starting point
56%
· To mark
0)
→ list of
78 placement tests (mostly
"placement
— Year N", each with question counts, type breakdown, a long topic breadcrumb string,
"No attempts yet", and Set for children · Preview · Edit · Unpublish) → at the bottom, a 
**"Waive the placement test"** form (student
+ subject).
 - Quizzes: sub-tabs Quizzes · Question bank · Marking (7) · Results → "+ New quiz" → status
→ subject counts ( All
8,971
· English
3,077
· French
621
· Geography
1
· German
498
· Maths
2,277
· Science
1,864
· Spanish
633)
→ year-group counts
→ KPI row
→
"Showing
40 of
8,971 quizzes" , each card with
5 lines of metadata and
4 buttons,
"Show more (8,931 left)".
 - Homework: "Set practice, then mark what comes back — families are told at every step."
→ Set homework
→ Inbox (9)
· Set homework (10)
· To mark (9)
· Marked (16)
· Not handed in (15)
· All (40)
→ list of hand-ins (student, title, status, date,
"quiz attached",
"Late").
 - Lessons: opens on "Where our lessons fit the curriculum" (NC (England) / GCSE (AQA) toggle, subject tabs,
86% ring,
"Show only gaps
& thin spots", full topic
× Y1–Y11 grid with every cell a button)
→ then search, year filter and the lesson list.
 - Tools (new): "216 tools · 78 ready to use", search, "Ready to use only" checkbox, subject chips, KS1–KS5 chips
→ alphabetical grid of tool tiles (e.g. Fraction wall, Number line, Protractor, Periodic table, Story mountain planner, Phonics blender…) followed by
~138 tiles marked IN BUILD
/ COMING SOON
.
 - Flashcards: "Add card" · "Paste many" → KPIs ( Cards 51,873 · Published 51,873 · Drafts
0
· Due to review
10)
→ Student progress rows ("Callum
14/22,229 started
·
22,215 new",
"Aisha
0/9,278 started")
→ list of cards grouped by topic (front/back, Published),
"Show more (51,813 left)".
 - Student message centre: "+ New message" → per-student folders → per-lesson threads
+ General
→ a chat pane. Test content present ("dbdsbsd",
"ngcv").
 - Hub settings (in Setup, not the hub): Marking & progress — pass mark (70), require a placement test (on/off), show right answers (straight after
/
…), retake wait (24 h), and more.
7A.2 What the owner saw go wrong (as Amir, evenings, ~900px window) 1. Eleven tabs, plus sub-tabs, plus a subject bar, plus a live banner, plus a hero with stats
— before any content. On a laptop the tab strip scrolls; on a phone it's a swipe lottery. Suggestion to test: collapse to the tutor's real jobs (e.g. Today
· Students
· Library
· Teach
· Progress
· Messages
), fold Placement
/ Quizzes
/ Homework
/ Lessons
/ Flashcards
/ Tools
/ Worksheets into one Library with type filters and
"Assign" available everywhere. Count clicks for every
§4.3 scenario under
2–3 structures.
 2. Library scale is hostile. 8,971 quizzes, 51,873 flashcards, 7,894 lessons, 78 placement tests,
216 tools
— each tab opens on the whole catalogue,
40 at a time, with dense cards and four buttons each. A tutor with
8 students needs their stuff first ("assigned
/ recently used
/ for my students' years"), and the catalogue behind search or a
"Browse all" action. Every list needs default filters from the tutor's actual students (years and subjects taught).
3. The same tutor sees French, German, Spanish, Geography everywhere (subject bar, placement tests, quiz counts) though he teaches Maths, English and Science. Subjects a tutor doesn't teach should be hidden by default (tenant/tutor setting), not filtered manually every visit.
 4. Numbers don't agree and don't help. Header says 7,894 lessons / 7 subjects (library export has
7,470
/
6); Flashcards says Callum has
"22,229" cards and Aisha
"9,278 new";
"Worksheets
1". Vanity totals on Home and every tab replace useful information ("3 things to mark tonight",
"Hannah's homework due tomorrow"). Data-truth checker to trace; proposals to replace stats with tasks.
 5. Marking is split across three places. Home "Needs your attention" → Homework "To mark (9)"
→ Quizzes
→ Marking (7)
→ Placement
→ Marking. One Mark queue, one flow, batch actions, keyboard-friendly.
 6. "Assign" has at least five entry points (Home quick actions, Students → student card 
"Set homework", Groups
"+ Homework
/ Quiz
/ Lesson", each Library card
"Set for children", Homework tab
"Set homework") and they don't obviously share one flow. One assign sheet: what
→ who (student/group)
→ when
→ done , reachable from anywhere.
 7. Placement test is a top-level tab with a 3-step explainer, 78 tests and a "waive" form at the bottom. For most tutors this is a one-off per student. Suggestion: fold into Enrol student onboarding (choose subjects
→ placement on/off/waive
→ done) and into the student profile; keep test authoring in the Library.
 8. Lessons tab leads with the curriculum coverage map , a big table of 200+ cells, before the lesson list. Useful for a centre lead auditing the catalogue; noise for a tutor picking tonight's lesson. Move to Progress/Library
"Coverage" view, and use the curriculum mapping inside search and filters instead (year
→ NC area
→ lessons), so the value is felt without the grid.
 9. Tools shows 138 IN BUILD / COMING SOON tiles alongside 78 real ones. Hide unreleased tools by default (or a separate
"Coming soon" fold). Ask whether Tools belongs as a tab or as a launcher inside a live/in-person lesson.
 10. Stale broadcast banner sits on every tab for days ("0 of 8 connected — Rejoin"). Live state must expire, and ending a broadcast must be one obvious action. Also the Home
"Next lesson" and Live lessons
"Nothing coming up" duplicate each other.
 11. Settings live outside the hub (/freelancer/setup?tab=hub) for pass mark, placement required, show answers, retake wait. Test: hub settings inside the hub, plus contextual overrides at the point of use (per quiz
/ per student), with sensible defaults so a new tutor never has to visit them.
 12. Students tab: Groups first, then students; "optional" groups still take the top half of the page. Students are the primary object; groups are a filter/multiplier. Student card actions (Progress
· Message
· Set homework) are good
— make the student profile the hub for everything about that child (assign, mark, progress, placement, messages, parent).
 13. Messages is an admin inbox (per-student folders → per-lesson threads → General). Tutor wants: unread first, reply fast, who's waiting. Safeguarding: audit, parent visibility, no arbitrary
"New message" recipients.
14. Loading and "Checking access…" on every tab (5–20 s on this run), skeletons everywhere, no cached shell. Same finding as the child side; fix once, shared.
 15. Layout at 700–900px is the phone layout — breakpoints are wrong for a laptop, and a real phone never gets a phone-first design (tab strip, dense cards, four-button rows).
 16. Language and naming: "Live lessons" vs "Lessons" vs "Teach in person" vs "Schedule video lesson";
"Student message centre";
"Placement test" vs
"Starting quiz" (child) vs
"diagnostic" (URL);
"Notes" (URL) vs
"Lessons" (tab). One vocabulary across tutor, child, parent and code.
 17. Good things to keep (verify they survive): "Needs your attention" as a concept; the six quick actions; mastery bands with kind names; groups with one-click assign; Homework's status counts (Inbox
/ To mark
/ Marked
/ Not handed in);
"families are told at every step"; the Waive placement option;
"Teach in person" as a first-class mode; the curriculum mapping itself (the data is valuable, the placement is the problem); privacy-safe YouTube in lessons.
7A.3 Structural hypotheses for the tutor side (test, don't assume — see §7 questions too)
 - A Today screen that is only: what's next (live/in-person), what to mark, who's overdue/quiet, and one
"Assign" button. Everything else one tap away.
 - Library = lessons, quizzes, homework templates, flashcard decks, worksheets, tools, placement tests, in one searchable place, defaulting to the tutor's students' years/subjects, with
"Assign" on every item and
"My items
/ Recently used
/ All" scopes.
 - Student profile = the single home for a child: today's tasks, assign, marking for that child, progress (bands
+ NC coverage for this child), placement status/waive, messages, parent contact, settings overrides.
 - Teach = live video, in-person register, tools launcher, whiteboard — the "in the lesson" mode.
 - Progress = cohort view (current mastery table), curriculum coverage map (moved here), exports for parents' evening.
 - Messages = global inbox (header), not a hub tab. - Placement, settings and vanity stats disappear from top-level navigation. 
8. Child / student portal — owner's notes from a walkthrough How to treat this section: (see also §7A for the tutor side) these are the owner's first-hand observations and suggestions from one walkthrough of the student portal as a Year
5 child. They are inputs to your persona agents, not decisions
. Your job is to have the child, parent, tutor, SEND, safeguarding and simplicity agents fully critique the student portal themselves
— confirm, reject or go beyond every point here with evidence. If an agent finds a suggestion below is wrong, say so and do the better thing. Nothing here skips the burden check or the challenge phase.
8.1 What the student portal is today Route: /custdash/learninghub?child=<id>&tab=<tab> — a child's view inside the customer (parent) dashboard, in
"kid mode".
 - Header: "'s learning" + a **Grown-ups** button (a maths question, e.g. 13 × 6, gates leaving kid mode).
 - Tabs (7): Home · Starting quiz · Quizzes · Homework · Lessons · Flashcards · Messages (unread badge).
 - Home: live-lesson "Resume" banner → greeting ("Hello, Hannah. You have 30 flashcards to review and
2 homework tasks due soon")
→ My level bar with bands Getting started
0%
/ Getting there
50%
/ Got it!
80%
/ Mastered
90% and
"5% to reach Got it!"
→ per-subject band chips
→ streak calendar ("4 active days in
2 weeks")
→ Next lesson (empty state)
→ Flashcards due (30 cards,
~8 min, Review now)
→ Homework due (2 items,
"Due in
22 h")
→ Latest results (empty)
→ How I'm doing (78%, strongest subject, strongest topic, focus next,
"See progress").
 - Starting quiz: placement tests per subject, "5 of 8 subjects done", cards for English, French, German, Maths, Science, Spanish…; each shows question count, marks, topics covered,
"Not done yet
/ Done".
 - Quizzes: subject filter chips (All / English / Maths / Science / Browse topics), then a second row of counts (All
709, English
330, French
29, Geography
1, German
2, Maths
222, Science
90, Spanish…), then
"Finish a lesson to unlock
—
599" and a long list of
"Lesson quiz
—
" rows, each with a
"Start the lesson" button.
 - Homework: subject chips → list of set homework, or empty state "No homework right now
— when sets homework it will appear here with its due date; you can hand it in and read the feedback without leaving this page."
 - Lessons: subject dropdown ("All subjects · 5 lessons") → Resume banner → "What I've covered" panel: National curriculum (England)
/ GCSE (AQA) toggle, subject chips, a ring
"0 of
59 topics started in Maths", and a full topic
× Year
1–11 grid of empty boxes (finished
/ given
/ not started) with a footnote about the
2014 curriculum and the
2028 rewrite
→ then search
+
"All years" filter
→ the actual lesson cards grouped by subject
› topic (e.g. Maths
› Fractions
& decimals
→
"Adding fractions with different denominators
·
2 videos
·
1 min read
· Your tutor
·
19 Sept
2026").
 - Lesson page: "← All lessons", Print, breadcrumb, title, "By Your tutor · updated · 1 min read", YouTube videos (privacy-enhanced, nothing loads until play,
"Open on YouTube" link), then short notes: numbered steps
+ a worked example in inline code (1/3 + 1/4 
=
4/12
+
3/12
=
7/12). - Flashcards: "Today's review — 30 cards to review · First time seeing these · about 12 min
· What's in it: Year
3
(30)
· Hannah is doing this
· Start review
· Space flips the card
·
1 Again
·
2 Hard
·
3 Good
·
4 Easy"
+
"19 more cards scheduled for later"
+ Refresh.
- Messages: three-column layout on desktop — Subjects & topics tree (All subjects 5 / English
1
/ Maths
3
/ Science
1)
· thread folders per lesson plus
"General"
· a chat pane per thread with
"View slide", message bubbles, Reply box and Send.
"+ New message".
8.2 What the owner saw go wrong (as Hannah, Year 5, on a ~700px window)
 1. Loading and errors dominate. Every tab shows grey skeleton boxes for 5–15 s. The API (localhost:4000) timed out repeatedly and the child saw banners like "Couldn't load quiz results — The server didn't respond within 15s (http://localhost:4000). Is the API running?" — words a 10-year-old cannot act on. Nothing tells the child what to do while waiting. Investigate: why is every tab a fresh fetch? Can the shell
+ today's tasks be cached/instant? Child-safe error copy and a single retry.
 2. Home does not answer "what do I do right now?" About ten blocks precede the two homework tasks due in
22 h. Suggestion to test: today's tasks (homework due, cards due, next lesson) as the first thing, one big button, everything else below or behind a tap.
 3. Quizzes shows the whole library (709), 599 of them locked. A Year 5 child doing fractions sees a wall of GCSE Macbeth quizzes with
"Start the lesson" buttons. Suggestion: show her quizzes only (set by tutor, or unlocked by lessons she's been given), in order; browsing the library is an opt-in behind
"Explore"
— or lives with the tutor, not the child.
 4. Home and Homework disagree. Home: "2 homework tasks due soon — One PEE paragraph, Forces
& motion quiz, due in
22 h". Homework tab:
"No homework right now". Data-truth checker to trace this; a child must never see two different answers to
"do I have homework?"
 5. The Lessons tab opens with a national-curriculum grid (≈20 topic rows × 11 year columns of empty boxes, curriculum footnote about the
2028 rewrite) before the five real lessons. This is a tutor/parent progress tool in a child's face. Suggestion: move to a Progress view (parent/tutor-facing, or a child-simplified
"my map"), and make the Lessons tab open on the lessons.
 6. Starting quiz offers French, German and Spanish placement tests to a child whose tutor teaches Maths, English and Science. Show only subjects the tutor has enabled for this child. Also question whether placement belongs as a permanent tab at all once done ("5 of
8 subjects done" is tutor information).
 7. Messages is an email client. Folders per lesson, a subject tree, three columns, test messages ("dbdsbsd",
"bfdsbdbdbds",
"hi hANNA"). A child needs one chat with their tutor (and maybe one per live lesson while it's live). Safeguarding agent: who can message a child, what a parent sees, audit trail, no free
"New message" to arbitrary recipients.
 8. Stale live-lesson banner. "Pick up 'Explain the relationship between adjacent multiples of eight' where you left off
— join now" has been showing for two days; the tutor side shows
0 of
8 connected. Banners must expire; a child should never be invited to a lesson that isn't happening.
9. Contradictory numbers on Home. "How I'm doing 78%" and "Latest results: No results yet" in the same view;
"My level
75%" next to
"Maths
90%" style chips elsewhere. One truthful, simple progress story per child.
 10. One layout for every age. Hannah (9–10) and a Year 1 child get identical tabs, words, grid and density. Age-band the presentation (KS1
/ KS2
/ KS3–4)
— see
8.3.
 11. Words and density. Tab labels, "Starting quiz", "PEE paragraph", "Space flips the card · 
1 Again
·
2 Hard
·
3 Good
·
4 Easy", curriculum footnotes,
"2014 programmes of study"
— audit every string a child can see for reading age and necessity.
 12. Good things to keep (verify they survive): the kind tone ("Getting there", "pass or not yet, it all counts",
"A little every day beats a lot once"); the Grown-ups gate; the lesson page's simplicity (video
→
4 steps
→ worked example); privacy-enhanced YouTube with nothing loaded until play; one-tap flashcard review with a time estimate;
"hand it in and read the feedback without leaving this page".
8.3 Principles for the child agents to test against (defaults, not rules) - One thing at a time. The child's home screen answers "what do I do now?" with one big button; the list of today's tasks is short and ordered.
 - No reading required to navigate for KS1: icons + audio + colour, labels that can be read aloud.
 - Session length fits attention: ~10–15 min KS1, 15–25 min KS2, flexible for teens. - Feedback is immediate, kind and specific. Wrong answers teach rather than punish. No public ranking of children.
 - Progress children can feel (streaks, stars, "you learned X") without casino gamification, pop-ups or notification pressure.
 - Age-banded UI: same data, different presentation for KS1, KS2, KS3/4. Teens get a grown-up, revision-focused UI.
 - Safe by design: no open chat with unknown people; tutor messages visible to parents as appropriate; video lessons with clear join/leave and a safeguarding trail.
 - Tutor controls complexity: per child, switch off timers, scores, leaderboards; read-aloud on/off.
 - Instant shell: navigation and today's tasks render immediately (cached), everything else streams in; errors are one friendly line
+ one button.
8.4 Required output for this section 08-child-experience.md must include, for each age band: the ideal flow (Mermaid), a lo-fi wireframe of the child home screen and of the quiz/lesson/homework player, what the child should never see, which of the
12 points above the agents confirmed
/ rejected
/ extended (with evidence), and how tutor-side changes support the child side. Child-portal proposals go through the same
 06-proposals.md format, challenge phase and build phase as everything else. 
9. Deliverables (all in docs/teaching-hub-review/) File Contents 
00-README.md Plan, how to read the pack, status of each phase (update as you go) 
01-inventory.md Every route/tab/modal/state per role, component paths, current sitemap (Mermaid), duplicate-path list 
01b-actions.csv Screen × action inventory with counts 
01c-data-truth.md Where every Home number comes from, discrepancies, tenant-leak check screenshots/before/, screenshots/after/ 
3 viewports, per role, same screens both times so they can be compared side by side 
02-personas/*.md One journal per persona 
03-friction-log.csv Every friction, deduplicated, with severity × frequency 
04-synthesis.md Themes, patterns, cross-persona conflicts and how to resolve them, "keep" list 
04b-scorecard.md Screen × lens scores, before (and projected after) 
05-structure-options.md 2–3 alternative navigation structures (Mermaid sitemaps), click counts for every scenario under each option, recommendation with reasoning 
06-proposals.md Numbered proposals (see format below) 
07-changes/P-nn.md One file per built proposal: what changed, files touched, before/after screenshots, how to revert (git revert <sha>) 
07-wireframes/ Lo-fi wireframes only for proposals not built tonight (roadmap items) File Contents 
08-child-experience.md See §8 
09-challenge-log.md Each challenger's objections, what changed as a result, what was dropped and why 
10-roadmap.md Built tonight (with commit shas) · Started but reverted (why) · Next · Later . Dependencies 
11-open-questions.md Decisions only the owner can make, each with options and a recommendation 
12-executive-summary.md One page: what changed tonight and why, before/after click counts for the top 5 jobs, before/after scorecard, what we deliberately chose NOT to add, and the 3 things the owner should look at first in the morning Proposal format (in 06-proposals.md): ### P-<nn>: <short title> Area: <tab/screen/flow> Roles affected: <tutor/child/parent/admin> Problem: <what's wrong, in one or two sentences> Evidence: <friction ids, persona quotes, screenshots, code refs> Proposal: <the change: structure/flow/layout/naming/content> Before → after: <taps/screens/words for the affected scenarios> Burden check: <what gets removed or merged to pay for this> Child impact: <better / neutral / worse, and why> Effort: S/M/L/XL (engineer agent) Risk: <data, safeguarding, regression> Dependencies: <other proposals> Priority: Must / Should / Could Confidence: High / Med / Low 
 Status: Built (<sha>) / Reverted (<why>) / Roadmap 
10. Quality bar before you finish 
 Branch teaching-hub-redesign is green: app starts, type-check, lint, tests and Playwright smoke all pass; every hub tab renders for tutor, child and parent test users at phone and desktop.
 main is untouched. No schema/migration/auth/billing changes (or they are listed in 11-open-questions.md for review). Every commit maps to a proposal, every built proposal has a 07-changes/P-nn.md with before/after screenshots and a one-line revert instruction. Every tab and sub-screen of the Teaching Hub appears in the inventory, for every role that can reach it. Every persona ran their scenarios before and after ; the after scorecard is better on the top 5 tutor jobs and no worse for any child scenario. The recommended structure beats the old one on click count for at least 80% of scenarios, and loses on none of the top 5 tutor jobs. Top-level tabs/nav items are fewer than today unless there is a written, compelling reason. Nothing built makes a child's session longer or more complex. Safeguarding agent signed off every built change, or the change was reverted. No real user's data was created, changed or sent during the night. 12-executive-summary.md reads well to a non-technical founder in 3 minutes and tells them what to look at first. When done, print the executive summary, the list of commits, and the open questions in the terminal, and leave the app running on the branch so the owner can open it straight away.
 