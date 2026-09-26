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

---

## STATUS 26 Sept 2026 — persistence BUILT (backend), front end still on localStorage

Acceptance **p2-f13** ("read where per-franchise progress and the HO template
are stored") found both halves in **localStorage**, in different browsers, never
meeting: a franchisor could not see how any franchise was doing (the HO screen
renders `seedProgress()` — invented numbers), a franchise lost everything on a
new device, and because each browser seeded its own `crypto.randomUUID()` step
ids, the two halves could not have been reconciled even by hand.

Server side is now real (API `v0.33.0`, spec in `server/openapi.yaml` → tag
`milestones`). Collections: `milestones/{tenantId}` (template),
`milestoneProgress/{tenantId}` (head office's / a solo operator's own) and
`milestoneProgress/{tenantId}__fr__{franchiseId}` (one franchise's) — the same
convention as `libraries`.

| Endpoint | Who | Replaces |
| --- | --- | --- |
| `GET /api/milestones[?franchiseId=]` | company / freelancer / franchise | `loadTemplate()` + `loadProgress()` |
| `PUT /api/milestones/template` `{phases}` | company / freelancer only | `saveTemplate()` / `resetTemplate()` |
| `PUT /api/milestones/progress` `{season?, steps, extras?}` | own roadmap only | `saveProgress()` |
| `POST /api/milestones/season` `{season}` | own roadmap only | `startSeason()` + `pushHistory()` |
| `GET /api/milestones/franchises` | company only | nothing — the roll-up never existed |

### What the front end owes (Kaz)

1. **`features/milestones/data.ts` goes away.** `aos.milestones.template.v1` →
   `GET /api/milestones` `.template.phases` / `PUT /api/milestones/template`;
   `aos.milestones.progress.v1` → `.progress` / `PUT /api/milestones/progress`;
   `aos.milestones.history.v1` → `.progress.history` (written by
   `POST /api/milestones/season`, 12 kept).
2. **Drop `seedTemplate()`.** The server seeds the default 5-phase plan on first
   read, with **stable slug ids** (`before-kit`, `before-kit-a1`, …). Random ids
   per browser were the bug underneath the bug — keep the ids you are given, and
   never regenerate one on rename/re-order or every franchise loses that task's
   progress.
3. **HO mode shows real progress.** Replace `preview = seedProgress(phases)`
   with `GET /api/milestones/franchises` (per-franchise `overall`,
   `currentPhase`, `stepsDone/stepsTotal`, per-phase `pct`, `season`,
   `updatedAt`, `started`) and `GET /api/milestones?franchiseId=<id>` to drill
   into one franchise's own roadmap.
4. **A franchise must stop editing the template.** `MilestonesApp` passes
   `onTemplate={persistPhases}` in franchise mode, so `addTask()` writes head
   office's plan — a `PUT /api/milestones/template` from a franchise is **403**.
   A franchise's own extra checklist items go in `progress.extras`
   (`{[taskId]: [{id,title}]}`) and are counted in the roll-up. Merge
   `template.actions ++ extras[stepId]` when rendering.
5. **Season reset is server-side.** `POST /api/milestones/season {season}`
   snapshots the finished season into `history` and clears the **recurring**
   phases only (pct 0, actions back to To do, `taskId` dropped); one-time
   phases stay done and the planned start/end dates survive. Don't reimplement it.
6. **Live updates.** `useRealtime(["milestones", "milestoneProgress"], refresh)`
   — the SSE stream carries both (a franchise's stream is narrowed to its own
   progress doc), so head office sees a franchise tick something off live.
7. **Staff and parents are refused (403).** Milestones is an owner's screen in
   both portals; don't add it to the staff nav without asking for the scope to
   be widened.

Still owed, unchanged from the list above: the Task-Manager two-way sync and
back-link (#0), real Seasons wiring (#3), auto-progress signals (#4) and
notifications (#6). #1 (persistence & scoping), #2's stable-id requirement and
#5 (HO roll-up) are done.
