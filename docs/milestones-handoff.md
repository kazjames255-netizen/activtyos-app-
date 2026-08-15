# Milestones — backend handoff

Replaces the old "Franchise Support Framework" placeholder. A phased operational
timeline for franchises: head office owns a master template; every franchise sees
it as their live checklist with progress. Front-end demo built; backend below.

## What's built (front-end)
- **Model** — `lib/milestones.ts`: `MPhase` (title, subtitle, `when`
  setup/before/during/after/clubs, `recurring`, icon, `steps[]`), `MStep`
  (title, detail, deep-`links[]`), `MProgress` (season + doneSeason[] + doneOneTime[]),
  and helpers (phasePct/overallPct/currentPhaseIndex/…).
- **Store + seed** — `features/milestones/data.ts`. Demo keys
  `aos.milestones.template.v1` (HO master) and `aos.milestones.progress.v1`
  (per-franchise). `seedTemplate()` = the default 5-phase plan (Get set up · Plan
  the season · Camp week · Wrap & review · After-school clubs) with deep links.
- **UI** — `features/milestones/MilestonesApp.tsx`, one component two modes:
  - `mode="ho"` → company portal `ho-framework` view: master-template editor
    (add/reorder/delete phases & steps, edit deep links, reset to default).
  - `mode="franchise"` → franchise `milestones` view: vertical timeline with a
    progress ring, "You are here", per-step tick-off, deep links into the app, and
    **Start a new season** which resets the recurring phases (one-time phases persist).
- Nav: company item renamed to **Milestones** (highlighted); new highlighted
  franchise item under the dashboard.

## Three-level model (milestone → task → actions)
Each **task** (`MStep`) can hold a checklist of **actions** (`MAction`, HO-defined).
A franchise fills per-action state in progress (`StepState.actions[actId]` =
`{ done, assignee, due, taskId }`). A task's completion **rolls up** from its
actions (`stepPctEff`) when it has any, else its own `pct`. Each action can be
**pushed into the Task Manager** — the front-end already POSTs `/api/tasks`
`{ t, who, due, prio:"med", status:"todo", cat:"Milestones" }` and stores the
returned id in `taskId` (shows "In Task Manager ↗").

## Backend needed
0. **Task Manager link (built, needs polish)** — pushed actions create real tasks
   via `/api/tasks`. Add: a back-link on the created task to the milestone/action;
   two-way status sync (ticking the action ↔ completing the task); de-dupe on
   re-push; and pass a proper `link`/assignee-id instead of a display name.
1. **Persistence & scoping** — the master template is one per **head-office/brand**;
   progress is one per **franchise (tenant)**. Replace the two localStorage keys.
2. **Publish/versioning** — when HO edits the template, franchises should pick up
   changes (consider a version stamp + "what's new"); don't wipe a franchise's
   progress when steps are re-ordered (progress keys off step IDs — keep them stable).
3. **Seasons** — tie "Start a new season" to the real Seasons feature
   (`lib/seasons.ts`) so recurring-phase resets align with the tenant's holiday/term
   ranges instead of a free-text label; keep per-season history.
4. **Auto-progress (nice-to-have)** — some steps could auto-tick from real state
   (e.g. "Publish the timetable" ✓ when a block is live, "Run payroll" ✓ when a pay
   run is finalised). Each step could carry an optional signal key.
5. **HO roll-up** — head office will want a dashboard of where each franchise is on
   the timeline (which phase, % complete, overdue launches). Aggregate server-side.
6. **Notifications** — nudge a franchise when a season opens or a phase is overdue,
   via the platform notification bell.
