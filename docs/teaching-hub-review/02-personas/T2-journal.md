# T2 journal: tuition centre lead / tenant owner (6 tutors, 120 students, white-label), desktop

Method: walked through code only (no browser, no server). Line refs are `features/learninghub/...` unless stated. "Word counts" are approximate.

## (a) Monday morning: how are my 6 tutors and 120 students doing?
- **Goal:** in under a minute, know who is overdue, who is quiet, which tutor is behind on marking.
- **Start:** /company/learninghub, Home tab (default, `LearningHubApp.tsx:83`). The hero and 4 stat tiles (Subjects / Lessons / Worksheets / Students) sit above the tabs.
- **Path:** Home, then "Needs your attention" (`home/TutorHome.tsx:165`), four rows: "Homework to mark", "Written answers to mark", "Overdue homework", "Quiet for 14+ days". One number each, totals for the whole business. Tap "Overdue homework" (`:171`), which goes to the Homework tab. Tap "Quiet for 14+ days" (`:172`), which goes to Students and lists the first 2 first names. Then Students, "Needs attention" filter chip (`StudentsPanel.tsx:412`) for overdue/to-mark per student.
- **Taps/screens:** 1 screen for the headline (0 taps), 3 taps and 2 screens to see who. About 250 words read above the fold.
- **Hesitation:** the numbers are per business, not per tutor. Nowhere can I ask "which tutor has 14 unmarked hand-ins?". `tutorUid` exists on students and lessons (`types.ts:76`) but is only used to filter to "mine". The attention counts ignore the My/Everyone toggle entirely (`TutorHome.tsx:90-104`: only `lessons` is scoped, `inbox`, `attempts` and quiet are not). So flipping to "My lessons" changes the Next lesson card and nothing else.
- **Snapshot:** "Student snapshot" is capped at 8 rows and 6 columns (`home/ClassSnapshot.tsx:14`), then "+112 more students". With 120 students it is a teaser. The full grid is Progress > Overview, a scrolling table (`progress/Overview.tsx`), still no tutor column.
- **Expected vs actual:** expected a tutor-by-tutor table (students, overdue, unmarked, last active). Got a business-wide pile and a per-student grid.
- **Confidence 2/5, effort 4/5.** For a "have my tutors marked" answer I would have to open Homework and infer.
- **One change:** add a "Tutor" filter/column (group by `tutorUid`) to the Needs attention card and to Students, so the same counts can be read per tutor.

## (b) Tutor scenario #11: change the pass mark and "show right answers"
- **Goal:** make pass mark 70 and answers only shown after marking, for everyone.
- **Path:** Hub hero, small settings icon (`HubHero.tsx:72`, `aria-label="Teaching Hub settings"`, no visible text) then leaves the hub to `/company/setup?tab=hub&from=learninghub`. Section "Marking & progress" (`SetupApp.tsx:2523`): "Pass mark" number input, "Show right answers" select with 4 options (`:2533-2540`: Once they pass the quiz / Straight after they submit / Once you have marked it / Never). That is 3 taps plus typing and a save, on one screen, 4 rows.
- **Why is this outside the hub?** It is a tenant-wide `settings.hub` blob in Setup's shared settings form. Every other hub choice is in the hub. I only learn "the hub has settings" from a tiny gear.
- **Gotcha 1:** the hint on Pass mark says "The default pass mark (%) for a new quiz" (`:2527`). Changing 80 to 70 does NOT change existing quizzes. Nothing tells me how many quizzes still say 80, and there is no "apply to all". Existing quizzes' pass marks live per quiz (`quiz/AssessmentBuilder.tsx:42,129`).
- **Gotcha 2:** the reveal rule has NO per-quiz override. Only the tenant setting (`server/src/lib/hubRules.ts:299`; the builder body at `AssessmentBuilder.tsx:129` sends retake and pass mark but not reveal). Retakes do have a per-quiz override (`:129`). Inconsistent: two sibling rules, one overridable and one not.
- **Can a tutor override per quiz?** Pass mark and retakes yes (any tutor with edit rights, and nothing shows me who changed it), reveal no. So consistency across tutors is only a default: any tutor can drift the pass mark quiz by quiz and I would only see it by opening each quiz.
- **Confidence 3/5, effort 2/5** for the change, 4/5 for knowing it landed everywhere.
- **One change:** put a "Marking rules" row in the hub itself (or a visible "Hub settings" text link in the tab strip), and on Pass mark say "N existing quizzes use a different pass mark" with an "Apply to all" button.

## (c) Tutor scenario #3 as oversight: is everyone assigning homework the same way? Can I set defaults?
- **Homework defaults available:** only one, "Homework due date: days between setting and default due" (`SetupApp.tsx:2561`, used by `homework/HomeworkForm.tsx:46`, hint at `:169` "Due end of day. Default is N days out."). Pass mark, retake policy and reveal rules are also defaults.
- **New tutor never visits settings?** Mostly yes for those five rules: they are inherited from the tenant. But a franchise "keeps its own Setup" (`hubCore.ts:227`), so a franchise's tutors get a different set from head office with no comparison. Also the pass mark default is only applied at quiz creation, so an old quiz keeps its old mark.
- **Not settable:** which content type to assign, whether to use groups (the Groups section says "Optional", `01-inventory` and the Students tab), whether hand-in is expected, marking turnaround. So two tutors can assign homework very differently (group vs individual, own quiz vs shared lesson) and I cannot see it.
- **Oversight view of assignment:** none per tutor. Homework tab lists hand-ins (Inbox / Set homework); there is no tutor column.
- **Confidence 2/5, effort 3/5.** **One change:** show tutor name on each homework/quiz row in the Homework and Quizzes lists and let me filter by tutor.

## (d) #7 Parents' evening: show a student's maths progress over the term
- **Path:** Progress tab, student search, tap the row (`progress/Overview.tsx` row button `aria-label="Open X's progress"`), `ProgressView`. Set the subject chip to Maths on the left. Screen: attainment bands, three Stat tiles ("Latest quiz", "Topics practised", "Quizzes taken"), a card per subject, then "Most recent progress" line chart.
- **What a parent would understand:** the band names (tenant-editable, "Attainment levels" in Setup) and a line of coloured bands with a dashed pass mark are decent.
- **What is wrong:** the chart is "last ≤20 quiz scores" (`progress/TrendChart.tsx:13`, `ProgressView.tsx:98`), not "this term". There is no date range, no "since September", no first-vs-now comparison. "Quizzes taken" caps at "20+" (`ProgressView.tsx:80`). Placement tests are explicitly left off the chart (`:96`), so the starting point, the number a parent most wants, is missing.
- **Export/print:** none in Progress (grep for print in `progress/` and `ProgressPanel.tsx` finds nothing; only NotesPanel prints lessons). I would screenshot the screen. That screen also carries the tutor UI ("Recalculate", "Edit levels").
- **Confidence 2/5, effort 4/5.** **One change:** a "Print / save as PDF" parent summary for one student: subject, term start vs now band, last 5 scores, tutor comment.

## (e) White label: football camp / single-tutor tenant, subjects they don't teach
- **Subjects are tenant data:** the filter says "Subjects aren't a fixed list: they're whatever this tenant has typed" (`TopicFilter.tsx:14`) and the hero counts come from `subjectsOf(topics)` (`HubHero.tsx:150`). So a new football camp will not get French, German or Geography in chips, Overview columns or Snapshot columns unless the seeded tenant had them. The brief's French/German/Geography chips come from this tenant's own topics, i.e. content the owner or head office put there.
- **What still shows regardless of tenant:**
  1. All 11 tabs (`panels.tsx:31`): Placement test, Quizzes, Lessons, Flashcards, Tools, "Student message centre". No way to hide a tab. A football camp still sees "Placement test" and "Flashcards".
  2. Tools tab: subject chips come from a fixed registry (`tools/registry.ts`: science, humanities, languages...), not the tenant's subjects, plus tools flagged "isn't ready yet ... planned for later" (`tools/ToolsPanel.tsx:65`) which is noise in front of customers.
  3. The Curriculum card (NC 2014 default, `curriculum/CurriculumCard.tsx:61`) is fixed to UK national curriculum (Maths/English/Science/Languages) in the Lessons tab, a big card above the lesson list.
  4. Kid-facing vocabulary "Teaching Hub" via `hubName(mode)`; brand colour follows the tenant (`var(--brand)`), which is good.
- **Confidence 3/5, effort 3/5.** **One change:** "Tabs to show" and "Hide Tools / Curriculum map" toggles in Hub settings so a non-academic or single-tutor tenant loses irrelevant tabs.

## (f) Multi-tutor scope: My students / Everyone
- **Is it obvious?** A pill "My students 14 | Everyone 120" (`mineKit.tsx:29-40`) appears on Home ("My lessons"), Students, Progress and Live lessons. Counts in the pill are good. But it only appears when `multiTutor` is true: for staff, or if some student has a `tutorUid` different from mine (`StudentsPanel.tsx:326`, `Overview.tsx:41`). As owner with `role !== "staff"`, if nobody has been assigned a tutor I see no toggle at all, and no hint that a tutor concept exists.
- **Persists?** Yes, one `localStorage` key `aos.hub.scope` shared by all four tabs (`mineKit.tsx:13`). Good: flip once. But Home's toggle is labelled "My lessons" with a lesson count and the same key then drives students elsewhere, so the count and word change under the same choice.
- **Default:** staff with any own students start on "Mine"; everyone else starts on "Everyone" (`StudentsPanel.tsx:327`). The remembered choice is per browser, so on a shared front-desk PC one tutor's "Mine" leaks to the next login on the same origin.
- **Not scoped:** Home attention counts and "Quiet for 14+ days" (see (a)), the Homework inbox and Quizzes results, and the hero stat "Students 120".
- **Only two options:** no "Alice's students". As the owner I want the third option (pick a tutor), which the data supports.
- **Franchise:** server scoping: a franchise sees head-office content read-only plus its own (`hubCore.ts:16-18,187-191`), and never head-office or other franchises' students (`canSeeStudent`, `:200`). Good and safe. In the UI the franchise cannot tell which rows are head-office (read-only) beyond disabled writes. I could not find a "From head office" badge in Lessons/Quizzes rows; the only "Everyone can see this quiz" hint is in the builder (`AssessmentBuilder.tsx:228`) and a lone "Everyone" chip in `AssessmentList.tsx:274`.
- **Confidence 3/5, effort 2/5.** **One change:** make the toggle a tutor picker for owners ("All / Me / Sam / Priya ...") and apply it to attention counts too.

## (g) Curriculum map and Tools tab: useful or noise?
- **Curriculum map:** genuinely useful to me as a centre lead: coverage per year and area (Progress tab panel: "National curriculum coverage" with rings, and "Open the curriculum map"; Lessons tab: card with "onlyGaps" filter and framework picker). It shows what gaps my lesson library has, e.g. "no Year 1 fractions". It is a content-planning tool though, not a student-progress tool; it lives above the lesson list so every tutor hits it on every Lessons visit, and it is duplicated in Progress (`CurriculumRings.tsx:12`). Only useful if I teach UK NC.
- **Tools tab:** for a tutor in a live lesson (ruler, protractor) it is fine. For me as owner it is noise: I would never look at it, I cannot see who uses it, and unbuilt tools are advertised. It is a whole tab.
- **Confidence 3/5, effort 1/5.** **One change:** collapse the curriculum card by default with a one-line "Coverage: Maths 86%..." summary, and hide unbuilt tools.

## TOP 10 frictions (details and ids in T2-friction.csv)
1. No per-tutor oversight anywhere (T2-01).
2. Attention counts ignore My/Everyone (T2-02).
3. Pass mark default only affects new quizzes; no "apply to all" (T2-03).
4. Show right answers has no per-quiz override, unlike retakes and pass mark (T2-04).
5. Hub settings live in Setup behind an icon-only gear (T2-05).
6. Progress is "last 20 quizzes", no term range, no placement baseline (T2-06).
7. No print/export of a student's progress for parents (T2-07).
8. No way to hide tabs/Tools/Curriculum for a non-tuition tenant (T2-08).
9. Student snapshot shows 8 of 120 (T2-09).
10. Scope toggle: only two options, hidden for an owner with no tutor assignment, label/count changes across tabs (T2-10).

## TOP 5 keep this
1. Needs your attention card: 4 plain-English rows, count-up number, "All clear" with a tick when zero (`home/TutorHome.tsx:26-45`).
2. My/Everyone pill shows both counts, persists across all four tabs via one key (`mineKit.tsx`).
3. Setup rows carry good plain hints: "keeps them back until the quiz is passed, so a child can't just re-sit it to read the answers off" (`SetupApp.tsx:2533`).
4. Server scoping is safe by default: franchises never see other students, head-office content is read-only (`hubCore.ts:187-208`).
5. Tenant-editable attainment levels and subjects, with the trend chart showing the pass line and level bands in the tenant's own words (`TrendChart.tsx`).
