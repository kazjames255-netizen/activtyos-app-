# 09 - Challenge: the six-year-old (and the parent handing over the tablet)

Rules I judge by: no reading, no precision taps, no waiting. Sources: 06-proposals.md, 05-structure-options.md (family), C1-C4 and P1/P2 journals, code (KidMode.tsx KID_TABS, StudentHome.tsx, StudentHomework.tsx, shared-assess, kit.tsx, lib/api.ts).

## Verdicts
| Proposal | Verdict | Why |
|---|---|---|
| P-03 Home next-step card | KEEP + REVISE | Right idea, but must be icon + <=6 words, and the rest hidden, not just moved down |
| P-04 One truth for homework | KEEP + REVISE | Friendly error + Retry good; "Overdue vs Due soon" split must not appear in kid mode |
| P-05 Actionable errors | KEEP (already half-done) | Production text already friendly (lib/api.ts:122-127); the developer text only shows in dev. Shorten further, hide "Details" from kids |
| P-09 Curriculum map collapsed | REVISE | Kid version: 3 stars/dots, no words "3 of 12 topics started" |
| P-13 Kind child language | KEEP + REVISE | Right direction; "Waiting for you" is still 3 words a 6-year-old cannot read; pair with icon |
| R-7 KS1 three icons | KEEP, promote | The only option that truly fits a 6-year-old |

## Per-proposal detail
**P-03.** Would a 6-7yo manage it? Yes if the card is one big coloured button with an icon (book / cards / camera) and at most 4-6 words. Today: 30-45 words before a first button (C1), and "Keep going" is last (StudentHome.tsx:252). Words to read: target <=6. Tap target: whole card, >=96px tall (today BigButton is 48px, homeKit.tsx:119; answer rows 56px; question count 11.5px). Session longer? No, it removes decisions. Revise: (a) in kid mode hide streak, level, stats, "How I'm doing" entirely (do not merely reorder; the brief forbids extra complexity); (b) do NOT add a "short list" under the card for under-8s, put it behind one "More" tile; (c) "Join lesson" must work in kid mode: KID_TABS has no `live` or `dashboard`, so today's tap silently returns Home. Fixing it by adding tabs adds 2 tabs to a 7-tab strip (13px text pills); better make it a single big "Join" card only when a lesson is genuinely live (ties to P-01); (d) "See progress" kid view: stars only, no % and no grid; (e) parent verdict line: fine, parent-only.
**P-04.** Kid sees either work or nothing calm. Failed load must show one face + one big "Again" button, never a blank that says "no homework" (child thinks they are free; parent thinks child is lying). Keep "Overdue" out of kid copy.
**P-05.** Child cannot read even the friendly line; the useful part is the 44px "Try again" (make it 56px+, icon). Details toggle: tutors only, agreed. Also TakeAssessment "Couldn't hand in" must say answers are saved (draft exists).
**P-09.** A grid or "3 of 12 topics" is arithmetic. Child: a row of stars. Collapsed default is fine and lowers length.
**P-13.** Also covers wrong-answer chip "Not quite" with an X, "25 points short of the 70% pass mark" (ResultView.tsx:126; ~25 words). Kid mode: stars + one big "Try again" button, hide pass-mark arithmetic (as proposed). Keep Warm-up "Yes!/Spot on!" (best moment in the app, C1).

## Wording proposals (max 6 words, always with an icon)
Child Home next-step card (label / verb):
- Homework due: "Your homework is ready" (icon: pencil) - button "Go"
- Cards due: "Play your cards" (icon: cards) - button "Go"
- Next lesson live now: "Join your lesson" (icon: video) - button "Join"
- Nothing to do: "All done. Well done!" (icon: star)
- Starting quiz: "Let's find your level"
Kind error (child screen): "Oops! Let's try again." + big button "Try again" (icon: circular arrow). Grown-up line under it, small: "No connection. Your work is saved." (only say "saved" where a draft exists.)
Homework states (icon-led, colour: never red):
- To do: "Waiting for you" (pencil, gold)
- Done: "Handed in" (tick in envelope, blue)
- Marked: "Marked" plus stars (star row, green). Word "marked" is fine paired with stars; "Well done!" for full marks.
- Late: same as "Waiting for you"; never "Late" or "Overdue" in kid mode.
Result: "You got 3 stars" (not "%"), button "Try again" / "Next".

## Would anything make a child's session worse?
- Adding a short list or progress view below the next-step card in KS1: more reading and choice.
- Adding `live`/`dashboard` to KID_TABS: two more text pills in a 7-pill, 13px strip. Prefer contextual cards.
- Any "Details"/technical toggle visible to a child; any new confirm dialog.
- Rewording alone (P-13) without icons: "Waiting for you" is still unreadable to a 6yo.
- Read-aloud is absent app-wide (only phonics "Hear it"). Not in the proposals; recommend a tiny "speak this" button on the next-step card and result (R-tier, additive).
- Do not lengthen hand-in: it is already 3 screens (Review answers > Ready? > Yes, hand in). For kid mode suggest collapsing to one "Hand in" with the unanswered count as a dot.

## Teens (C3) and SEND (C4/T4)
- Teens: P-03/P-13 kid wording ("Getting there", "Waiting for you", "Nearly there") is patronising at 14+. Apply the kid pass ONLY when kid mode is on for a young child; teens need R-6 (teen mode). Make P-13 a per-child/age-band switch, not global copy. A teen in parent view sees "Ava this week" in the third person: parent verdict line (P-03) worsens this unless it is hidden when the child views it.
- SEND: no proposal helps timer, streak or motion pressure (R-5 is roadmap only). P-03 reduces overload (good for ADHD). P-13 removing red is good. Risks: hiding the % may frustrate a child who wants it; keep tutor/parent factual. Do not add animation or a countdown to the next-step card; keep reduced-motion respected (homeKit.tsx:33). Timed quizzes (TakeAssessment.tsx:225,277) remain unresolved: pull R-5 forward.
