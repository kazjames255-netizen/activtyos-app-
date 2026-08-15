# Appraisals & performance — backend handoff

Front-end demo is built (company + franchise operator suite as a Team tab, plus a
staff **My appraisals** view). Everything below is what Amir needs to make it real.

## What's built (front-end)

- **Model** — `lib/appraisals.ts`: `Review` (two-sided: `self` + `manager`, each a
  list of competency `CompScore`s rated 1–5), `ReviewKind`
  (probation / 3-month / 6-month / annual / supervision), `ReviewStatus`
  (scheduled → self → manager → signoff → complete), `Goal` (SMART, status +
  optional %), `ReviewTemplate` (role-based competency set), `FeedbackNote`
  (kudos / concern / supervision), `PIP`, `Talent` (9-box performance × potential).
  Helpers: `overallScore`, `bradford` (S²×D), `isOverdue`, date utils.
- **Store + seed** — `features/appraisals/data.ts`. Demo localStorage keys:
  `aos.appraisals.reviews.v1`, `.templates.v1`, `.feedback.v1`, `.pips.v1`,
  `.talent.v1`.
- **`signalsFor(name)`** — the data-informed panel. Reads **lateness** from
  `aos.timeclock.v1`, **sickness days / spells / Bradford factor** from
  `aos.holiday.absences.v1`, and **DBS / first-aid** from the shared staff roster.
  In production these become real cross-service reads (clock-in, leave, credentials).
- **Operator UI** — `features/appraisals/AppraisalsApp.tsx` (rendered `embedded`
  inside `TeamApp` as the **Appraisals** tab next to Deployment). Sub-tabs:
  Reviews, Feedback & 1:1s, Talent grid (9-box), Templates, PIPs, Settings.
  Two-sided review editor with signals strip, competency ratings, SMART goals,
  probation outcome, and sign-off.
- **Staff UI** — `features/appraisals/MyAppraisalsApp.tsx` (staff `appraisals`
  view + nav "My appraisals"): self-assessment tasks, my goals, upcoming + past
  reviews. Demo user = Marcus Bell.
- **Walkthrough** — `TOUR_CONFIGS["staff-appraisals"]` (6 steps).

## Backend needed

1. **Persistence & scoping** — per-tenant, per-employee store for reviews,
   templates, feedback, PIPs and talent placements. Replace the localStorage keys.
   Reviews and feedback are **sensitive HR records** — access-controlled to the
   employee, their line manager(s) and admins; audit every read/write.
2. **Identity** — demo matches people by name via `slug(name)`. Real version keys
   off staff user IDs (the same accounts used by invites / deployment).
3. **The signals** — expose real endpoints for a person's lateness, sickness +
   Bradford, and credential (DBS/first-aid) status, scoped to the requesting
   manager. Front-end already shapes the panel around `Signals`.
4. **Two-sided flow + e-signature** — staff submit self-assessment → status moves
   to `manager`; manager completes → `signoff`. Capture **both signatures** with
   timestamps (`signoff.managerAt` / `staffAt`) as a legal record; lock the review
   once complete (immutable + versioned if reopened).
5. **Scheduling & reminders** — auto-create reviews from hire date (probation at
   e.g. 1/3/6 months, annual thereafter) and notify both sides on due/overdue via
   the platform notification bell.
6. **Probation outcome** — `pass` should confirm employment (feeds contract /
   status); `extend` reschedules; `fail` triggers the leaver flow. Wire to whatever
   employment-status source of truth exists.
7. **PIP lifecycle** — status transitions (open → met / extended / escalated /
   closed), review-date reminders, and a link from a PIP to the disciplinary /
   documents trail.
8. **Reporting** — team average, score distribution, 9-box export, overdue-review
   compliance — all currently derived client-side; move aggregation server-side for
   multi-site companies.

## Notes / decisions

- Company scoping: the listing filter (`op`) narrows the whole tab; a real build
  should also respect **role-based access** (a site lead sees only their location's
  team) using the same access model as Deployment / Roles & permissions.
- Templates are per-role today (Coach / Lead). Companies may want per-listing or
  custom cycles — the `ReviewTemplate.role` field is the seam.
- Staff never see sick-pay/absence *messaging*, but a manager's review **does**
  surface absence signals — keep that operator-only.
