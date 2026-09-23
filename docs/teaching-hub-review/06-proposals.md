# 06 — Proposals (v1, before the challenge phase)

Evidence: `03-friction-log.csv` (233 rows from 14 personas), `01c-data-truth.md`, `05-structure-options.md`. Format per brief §9. Effort/Risk are the lead's first estimate; the Engineer challenger re-checks.

### P-01: End a forgotten broadcast, and stop stale banners
Area: Live/remote-sync banner · Roles: tutor, child
Problem: a broadcast can only end after 6 idle hours; `endRemoteSync` has no UI caller; children are invited to lessons that aren't happening (T3-01, X3-16, C2, data-truth §5).
Proposal: "End lesson" button on the tutor banner (calls existing `/end`), confirm in one tap; server idle expiry 6 h → 45 min; child banner hides when the session is ended or not `live`.
Before → after: cannot end → 1 tap. Burden check: removes the stale banner class of problem. Child impact: better. Effort: S. Risk: low (server constant + UI). Priority: Must. Confidence: High.

### P-02: Numbers that agree and help
Area: hub header/hero, Home · Roles: tutor
Problem: header says 7,894 lessons / 7 subjects / 2,457 topics / 1 worksheet — none match the library or each other (01c #3).
Proposal: count only real lessons (interactive or Oak), only subjects that have lessons; remove the "topics" and "worksheets" tiles; hero stat tiles collapsed by default (one line "8 students · 7,470 lessons · 3 subjects you teach").
Burden check: removes 4 tiles. Effort: S–M. Risk: low. Priority: Must.

### P-03: Child Home answers "what do I do now?"
Area: StudentHome (kid + parent) · Roles: child, parent
Problem: ~8 blocks / ~200 words before the first action; "Keep going" is last; dead "See progress" and "Join lesson" in kid mode (C1-02, C2-01/02/03, C4, P1-02).
Proposal: kid Home = one big next-step card first (homework due → cards due → next lesson), then a short list; "Join lesson" works in kid mode (allow `live` join view); "See progress" opens a kid-friendly progress view (allow `dashboard` in kid tabs, kid wording) instead of bouncing to Home; parent Home leads with an on-track/overdue verdict line.
Burden check: removes/merges ~5 blocks below the fold. Child impact: better. Effort: M. Risk: low–med (kid tab list). Priority: Must.

### P-04: One truth for "do I have homework?"
Area: Homework tab/Home · Roles: child, parent
Problem: Home says 2 due, Homework tab says none — failed load shown as empty; "due soon" includes overdue (data-truth #1).
Proposal: show a friendly error + Retry on failure (never the empty state); one shared fetch; separate "Overdue" from "Due soon" wording.
Effort: S. Risk: low. Priority: Must.

### P-05: Errors a child and parent can act on
Area: hub error copy · Roles: all
Problem: "The server didn't respond within 15s (http://localhost:4000). Is the API running?" (C1-05, P2-05).
Proposal: one friendly line + one "Try again" button in hub error banners; technical detail hidden behind a "Details" toggle for tutors only.
Effort: S. Risk: low. Priority: Must.

### P-06: Tutor Home = Today
Area: TutorHome/ClassSnapshot · Roles: tutor
Problem: 4 stat tiles above content; "Needs a nudge → Assign" is a dead end; "Start lesson" only switches tab; overdue lands on To-mark (T1-02/03/04).
Proposal: Today first (next lesson · to mark · overdue/quiet · one "Set homework" button), stats collapsed; "Nudge" opens the homework form with that student pre-selected and a kind parent message template; "Overdue" opens the overdue list.
Burden check: removes stat tiles from above the fold. Effort: M. Risk: low. Priority: Must.

### P-07: Accessibility to WCAG 2.2 AA (the fixable set)
Area: tokens, focus, ARIA · Roles: all
Problem: X1 — white on green/status colours fails contrast (2.15–3.76), gold 1.79, `--ink-3` 3.3–3.8, control borders 1.3:1; row click drops focus; Escape swallowed; curriculum tablist ARIA broken; child switcher/skeletons silent.
Proposal: darken hub token pairs to ≥ 4.5:1 (text) / 3:1 (UI); after a tab switch move focus to the tab panel heading and update the document title; fix the Escape stack (topmost layer only); correct tablist roles; `aria-busy`/`role=status` on skeletons and child switch.
Effort: M. Risk: low (tokens can shift look slightly). Priority: Must.

### P-08: Tools tab honest by default
Area: Tools tab · Roles: tutor, parent
Problem: 138 "In build/Coming soon" tiles beside ~78 real ones (brief 7A.2 #9).
Proposal: "Ready to use only" ON by default; unreleased tools behind a "What's coming" fold; add `tools` icon to PANEL_ICON.
Effort: S. Risk: none. Priority: Should. (Owner decided all tools WILL be built — this only changes what is shown by default.)

### P-09: Curriculum map out of the way, value kept
Area: Lessons tab · Roles: tutor, child
Problem: a 200-cell grid before the lesson list (brief 7A.2 #8, 8.2 #5).
Proposal: collapsed by default to one summary line ("172 of 185 areas covered · 9 gaps" / child: "3 of 12 topics started"), tap to open; the child sees a one-line progress, not the grid. (Owner previously asked for it first on Lessons — conflicting instruction, logged in 11-open-questions.md; reversible in one line.)
Effort: S. Risk: low. Priority: Should.

### P-10: Tabs 11 → 9 and one vocabulary
Area: HubTabs/panels · Roles: tutor, parent
Problem: 11 tabs, strip clipped at ~900 px; five names for one thing (X3, 01-inventory naming).
Proposal: Placement folds into Quizzes as a "Starting quizzes" filter (keeps its sub-tabs); Tools becomes a launcher card/sub-tab inside Lessons; rename "Student message centre" → "Messages", child "Starting quiz" everywhere; "Set homework" as the single verb.
Burden check: −2 tabs. Effort: M. Risk: med (routing keys, deep links `?tab=diagnostic`/`tools` must keep working — redirect map). Priority: Should.

### P-11: Safeguarding must-fix
Area: server privacy · Roles: child, parent, admin
Problem: X2-04 — hubDoubts (child text) missing from erase/export; notifications, live answers and board images survive erase.
Proposal: add hubDoubts + remote-sync liveAnswers to the erase and export functions (additive). NOT built tonight (owner review first): acting-as stamping (auth-adjacent), tutor→child thread rules, ParentGate server enforcement.
Effort: S–M. Risk: low (additive). Priority: Must.

### P-12: First-run for a brand-new tutor
Area: Home/Homework picker · Roles: tutor
Problem: T5 — no first-run guidance; homework lesson picker has no Year/Subject filter.
Proposal: zero-data Home shows a 3-step guide (Add a student → Pick a lesson → Set homework); homework lesson picker gets Year + Subject filters defaulting to the student's year. (Enrol-by-name needs backend → roadmap.)
Effort: M. Risk: low. Priority: Should.

### P-13: Kind child language (no shame)
Area: child wording · Roles: child
Problem: "Overdue", "Handed in late", "✗ Not quite", percentages and "points short" read as blame (C4-04).
Proposal: child-facing copy pass: "Waiting for you", "Handed in", "Nearly there" (keep), hide pass-mark arithmetic from kid mode; keep tutor/parent wording factual.
Effort: S. Risk: low. Priority: Should.

## Roadmap (not tonight — needs owner decisions or backend)
R-1 One Assign sheet; R-2 one Mark queue; R-3 student profile as the hub; R-4 Today/Library/Teach/Progress/Messages navigation (Option A); R-5 per-child accommodations (timer/extra time, streaks/XP/confetti off, read-aloud, reading options — additive enrolment fields); R-6 teen mode; R-7 age-banded family navigation; R-8 acting-as stamping + audit; R-9 tutor→child messaging rules + DSL view; R-10 hub i18n; R-11 per-tutor oversight; R-12 parent print/PDF report; R-13 enrol-by-name; R-14 parent notifications for overdue/lesson-soon.
