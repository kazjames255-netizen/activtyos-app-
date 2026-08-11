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
