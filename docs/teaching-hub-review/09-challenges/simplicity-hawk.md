# 09 — Simplicity Hawk challenge

Test per proposal: what breaks if absent; delete / merge / hide instead of build; does it add a screen, tab, setting, badge or notification without removing one (brief §2 rule 6). Code checked: `features/learninghub/` (panels.tsx:31 TAB_ORDER, HubHero.tsx, DiagnosticPanel.tsx 16 lines, QuizzesPanel.tsx 19 lines, tools/ToolsPanel.tsx 93 lines, remotesync/api.ts:51, server remoteSyncApi.ts:66 STALE_MS).

## Verdicts

| P | Verdict | Reasoning |
|---|---|---|
| P-01 End broadcast | REVISE | Keep the 45 min idle expiry and the child banner hiding on not-`live` (both are pure removals of stale UI). The "End lesson" button is a new control, but `endRemoteSync` already exists with no caller, so it is the cheapest fix. Constraint: no confirm dialog (a dialog is an extra screen). Use a single button with a 5 s "Undo" toast, or reuse the existing Leave/End affordance. Show it only when the banner is live. Also mount the banner poller once (NotesPanel keeps a second one alive on every tab). |
| P-02 Numbers agree | KEEP | Net removal (4 tiles). Go further: do not "collapse" the hero on Home, delete the tiles. HubHero already has a foldable `open` state; default it closed rather than adding a new one-line summary component. Never show a count you cannot make correct. |
| P-03 Child Home | REVISE | Right goal, but "removes/merges ~5 blocks" is not evidenced. Spec it as deletions: kid Home = one Next-step card + Join button. Delete the streak strip, the tutor-style stat blocks and the lower list from kid mode. The kid "See progress" fix must not add a Progress tab to KID_TABS. Instead have the button open a single inline line/sheet on Home. Otherwise kid tabs go 7 → 8. Parent verdict line: KEEP, it replaces blocks rather than adding one. |
| P-04 Homework truth | KEEP | Bug fix, zero new surface. Reuse the existing PartError + retry pattern. Overdue/due-soon is a wording split, not a new list. |
| P-05 Friendly errors | REVISE | Fix the copy and the one Retry, but drop the tutor-only "Details" toggle. That is a new control for a role that can open devtools. Log to console. Merge into one shared ErrorBanner change. |
| P-06 Tutor Home = Today | REVISE | Keep "Nudge opens the form with the student pre-selected" and "Overdue opens overdue list" (fixes dead ends; no new surface). Drop the "kind parent message template". It adds a template, copy to maintain and a decision. Do not build a new "Today" block set. Reorder the existing sections and delete the tile row (overlaps P-02, so merge the tile removal there). "Set homework" button already exists on Home (TutorHome:50-56). Keep only one. |
| P-07 WCAG AA | KEEP (split) | Token darkening, Escape stack, tablist roles are invisible to users and add nothing. Focus-to-heading and doc title on tab switch are cheap. Ship the contrast tokens first. If time is short, `aria-busy` on skeletons is the first cut. |
| P-08 Tools honest | REVISE | The "What's coming" fold is a new section. Instead hide unreleased tools entirely for tutors (parents never see them) and delete the toggle default logic: unreleased = not rendered. Keep an owner-only flag if they want a peek. The `PANEL_ICON` entry is a one-liner; keep. |
| P-09 Curriculum map | REVISE | Do not add a "summary line + tap to open" (a new element). Better: move the grid behind the existing Curriculum toggle already in CurriculumCard (inventory: "Curriculum toggle") and default it off. Child: delete the grid from the kid view (P-03 covers the one line). Note the owner's earlier "first on Lessons" instruction. Log it, it is a one-line revert. Also delete the second copy, CurriculumRings on Progress, or the reverse. Two curriculum views is one too many. |
| P-10 Tabs 11 → 9 | REVISE | Keep the −2 but go further and cheaper. Placement into Quizzes is nearly free (both panels are 16/19-line wrappers around the same shared-assess code; identical Question bank). Tools inside Lessons is more costly (tab in tutor + parent, deep links). Alternative: keep Tools as its own tab but hide it for parents and unreleased tools (P-08), and move Flashcards into Lessons instead (a per-lesson tool already exists: FlashcardsForLesson). Need the redirect map either way. Vocabulary: rename only, zero code surface; ship first. Do not add a "Starting quizzes" filter chip: make it a Quizzes list row type/label, so there are fewer sub-tabs (the Placement 4 sub-tabs vanish). |
| P-11 Safeguarding | KEEP | Deleting data on erase is the safest kind of change. Non-negotiable. |
| P-12 First-run | REVISE | The 3-step guide is a new block. Make it the empty state that replaces the zero-data Home (an empty state already exists per surface), and it disappears at 1 student. Year+Subject filters on the picker: only default to the student's year, with no visible new filters unless the list exceeds ~20 lessons. |
| P-13 Kind language | KEEP | Pure copy; removes words. Fold P-05 wording and "hide pass-mark arithmetic" into the same string pass. |

## Merges
- P-02 + tile removal from P-06 = one "delete the stat tiles" change.
- P-05 + P-13 = one copy pass (errors + child wording + one vocabulary rename from P-10).
- P-04 + the homework part of P-03 = one "Home and Homework read the same fetch" change.

## Extra deletions/hides the proposals miss
1. **Live/workspace and the mini duplicates of Assign.** 14 assign entry points (inventory). Delete the two separate direct-post forms (`lesson/HomeworkForLesson.tsx`, `inperson/api.ts sendToPortals`) so all go through the one shared form, and drop the "Set for children" icon on lesson list rows (keep the reader button). Removes two code paths and two vocabulary variants, no new UI.
2. **Placement extras: WaiveCard, PlacementGuide, the separate Placement Question bank.** After P-10 there is one Question bank. Delete the duplicated bank/marking/results sub-tabs of Placement.
3. **Duplicate curriculum + dead code.** Remove CurriculumRings or CurriculumCard (one curriculum view). Delete `ComingSoon` path and "soon" tab styling (HubTabs.tsx:95-108), `KID_TAB_LABEL.dashboard`, the conditional Students "Needs attention" filter, Home "New lesson"/"New quiz" quick actions that duplicate the tab buttons, and the regex DOM-click helpers (`goToTab`, teachKit.tsx:310).
4. Second banner poller in NotesPanel (two pollers per tab); one mount at shell level.
5. Hide from parents: Students-style controls, "Recalculate", Tools tab (parent value unproven; T-personas never used it), Live workspace tabs beyond the 4 family gets.
6. Duplicate "Message student" (card vs Messages New message): keep the card link only; hide the Messages-tab composer for tutors until R-9 rules exist.
7. Children see 7 tabs. For under-9s show 4 at most (Home, Lessons, Quizzes/Homework, Messages). Hiding is cheaper than the R-7 age-banded navigation.

## Roadmap
R-5 accommodations (turning off streaks/XP/confetti) is the best "delete for one child" item. Pull the simplest slice (one "Calm mode" flag) forward if the builder has spare time; it is a removal, not a new screen. R-1 and R-2 are simplifications and outrank R-4 (renaming the nav).

## Net burden
As revised, tonight's set adds: one End button (with undo), nothing else. It removes: 4 stat tiles, ~2 tabs, 2 sub-tab sets, ~5 kid Home blocks, unreleased tool tiles, 2 assign paths, and dead code.
