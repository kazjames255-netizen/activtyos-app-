# Staff availability — backend handoff

**Front-end (done):** `features/schedule/AvailabilityApp.tsx`, staff view `availability`
("My availability"). Per the Build Manual Phase-1 note — *"Set available days/times;
submit to manager."* Weekly on/off + time range per day + a note + "Submit to manager".
Saved to localStorage and best-effort `POST /api/availability`.

## Owed (Amir)
- `availability(user_id, tenant_id, days{mon..sun:{on,from,to}}, note, submittedAt)` +
  `GET/POST /api/availability` (own record).
- Notify the manager on submit.

## Phase 2 (manual — not now)
Manager "who's available" grid (company/staff/leave colours), **holiday & unavailability
requests with Approve/Decline**, **auto-scheduling the rota from availability**, clock
in/out, shift swaps. (These appear fleshed out in the newer edit662/663 prototype; the
Phase-1 clean manual scopes them as "later".)

## Operator Schedule → Availability tab (front-end built, local store)
Per edit663, the Schedule page is now tabbed **Rota | Availability**:
- **Who's available grid** — staff × week, 4 states: company-set (magenta), staff-set (teal), unavailable, on-leave (amber). Manager taps a cell to set company availability.
- **Leave requests** — Approve / Decline with a pending count; **approved leave flags a rota conflict** (a shift rostered on a leave day shows ⚠ "On leave").
- Runs on `localStorage` (`aos.schedule.avail.v1`) — demo only.

**Owed (Amir):** `availability(user_id, tenant_id, source: company|staff, weekdays[]|dates[])` and
`leave_requests(user_id, from, to, status)` + endpoints; the staff "My availability"
submit feeds `source=staff`; the grid reads both; approved leave feeds the rota clash check.

## Rota fields + check-in (owed)
The rota now carries `site` (location), `role`, **`listing`**, **`season`**, `date`,
`start/end`, `staffId`, `in`, `out`, `locked` (published). Filters: location / listing / season.
- **Check-in / out** is the missing real bit. Flow: staff clock in/out from their app or the
  register at the venue → sets `shift.in` / `shift.out` (server, timestamped). If a staff member
  isn't `in` past their shift's start time, they surface in **Check-in alerts** (the UI already
  lists them + a **Remind** action). Owed: `POST /api/shifts/:id/checkin|checkout`, a "not-in-by-start"
  sweep + reminder notification, and the register/app clock-in UI.
- **Publish** should notify assigned staff and lock the shifts (`locked=true`).
- Pay rates live on the staff record (`users.pay_rate`); wages + on-cost are computed, recorded only.
