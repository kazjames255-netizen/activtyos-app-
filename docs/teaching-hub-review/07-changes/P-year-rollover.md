# P: automatic September year rollover (replaces the "New school year — Review year groups" card)

Owner decision: nobody should have to remind themselves each September. Every student's year group moves up by itself on
**1 September (UK time)** unless the tutor holds that child back. The yellow reminder card, its dialog, "Move all up a year" and the
localStorage snooze are gone from tutor Home, Students and Setup.

## Rules (server: `server/src/lib/hubRules.ts` → `yearStatus` / `effectiveYearGroup` / `advanceYear` / `academicStartYear`)
- **Academic year** = the calendar year of the last 1 Sept, read in Europe/London (turns at UK midnight whatever the server timezone).
- **Automatic students** (year from the date of birth): recomputed on every read, as before.
- **Hand-set students**: stored `yearGroup` + `yearAnchor` (the academic start year it was true in, stamped whenever the year is set).
  Effective year = stored year advanced along the **tenant's own `yearGroups` list** by (current − anchor) academic years. Computed
  lazily on read — no cron, no notification, nothing to run in September. A label that is not in the list never moves.
- **Cap**: never runs off the end of the list; the student stays in the last year and the roster row carries `mayHaveLeft: true`
  (Students card chip "May have left"; Setup shows a count). Automatic students older than Year 13 by age get the same flag.
  Pausing them is a tutor decision — nothing is paused automatically.
- **Hold back** (per child, default: follow the tenant setting): `yearMoveUp: false` freezes the year they are in *now* (an automatic
  child becomes hand-set) and it stays there through later Septembers. Releasing (`yearMoveUp: true`) resumes from that year with no
  jump. "Set to automatic" (Year select → Automatic) hands control back to the date of birth and clears the override.
- **Tenant default** `settings.hub.yearAutoAdvance` (boolean, default **true**) — Setup → Teaching Hub → Year groups. A child's own
  `yearMoveUp` always beats it.

## API / data
- `PUT /students/:childId` accepts `yearMoveUp`; setting `yearGroup` re-anchors to the current academic year; `POST /students` and
  invite-accept stamp `yearAnchor` for hand-set years. Roster rows now include `yearMoveUp` (true/false/null) and `mayHaveLeft`.
- Everything that reads a student's year (audience checks, homework reach, assessments, plan-next-week, games' per-year banks, the
  family lesson-access "year" rule in `lib/hubAccess.ts`) goes through `effectiveYearGroup`/`childFacts` with the tenant default.
- **Migration**: `server/src/backfillYearAnchors.ts` — hand-set students with no `yearAnchor` are stamped with the current academic
  year (what they show today is unchanged). Dry run by default; `--apply` writes; the two real tenants need `--real`.
  Until a student is anchored they stay pinned, so running it is what turns rollover on for existing students.

## UI
- Students → Edit details: **Move up each September** checkbox (reflects the tenant default until changed).
- Setup → Teaching Hub → Year groups: the tenant default toggle with the plain-English rule; a line counting students who may have left.
- i18n: `hubshell.su_yearAdvance*`, `su_yearLeftNote`, `st_moveUp*`, `st_mayHaveLeft*` in all 11 locales; the old `st_yr*` and
  `su_reminder*` keys are removed.

## Tests
- `server/src/hubSelfTest3.ts` — "automatic September rollover": 31 Aug / 1 Sept London boundaries, own-list rolling, cap + may-have-left,
  hold / tenant default / child override, unanchored = pinned.
- `e2e/learning-hub-year-rollover.spec.ts` — API rules (the server clock can't be moved, so the anchor is backdated with the Admin SDK via
  `e2e/helpers/enrolmentDoc.ts`) plus UI: no reminder card even with `page.clock` pinned to 10 Sept, the profile toggle saves, the chip,
  and the Setup toggle.
