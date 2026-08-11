# Team & invites — backend handoff

**Front-end (done, on `main`):** `features/team/TeamApp.tsx` (company + franchise
"Staff" view). Invite by email/link with a **role** (from `settings.roles`) and a
**listing assignment** (All / chosen listings); manage the team (active / pending /
deactivated), with a **staff-usage meter** read from `/api/subscription` and an
upgrade prompt at the plan's included limit.

`/api/invites` already exists and already hard-caps banded plans (`staffHeadroom`
→ 403 with a reason, which the UI surfaces as "upgrade"). What it does NOT yet do:

## Owed (Amir)
1. **Store the sub-role + assignment on the invite.** The client already sends
   extra fields on `POST /api/invites`: `staffRole` (a `settings.roles[].id`) and
   `assignment: { mode: "all"|"listings"|"locations", ids: id[] }`. Add them to the zod
   schema + the invite doc. (Right now they're stripped; the UI mirrors them in
   localStorage so they display — that's temporary.)
2. **Return them on `GET /api/invites`** so the team list is authoritative (drop
   the localStorage mirror once this lands).
3. **On activation**, copy `staffRole` → `users.role_id` and `assignment` →
   `users.assigned_listings[]` (prototype: `assigned_venues[]`). Ties into the
   Roles & permissions enforcement (docs/roles-permissions-handoff.md) and the
   Assigned-only **scope**.
4. **Deactivate / reactivate.** Add `PATCH /api/invites/:token/status`
   `{ status: "active" | "deactivated" }` (the UI already calls it, best-effort).
   Model as `users.status: invited → active → deactivated`. Deactivated users
   can't sign in and free a staff seat. Audit-log role changes + deactivations.
5. **Resend invite** endpoint for pending rows (re-email the link).
6. **Staff metering**: the included band is 75; 76+ bill +£1/staff. Deactivated
   users shouldn't count toward `staffUsed`. Keep `/api/subscription`'s
   `staffLimit`/`staffUsed` accurate so the meter + gate are correct.

Prototype ref: `~/Downloads/AAAAAAA.html` (edit663) — "Staff module: Invite /
deactivate users · Roles & permissions · Schedules · Pay rates (Finance-gated) ·
Impersonate"; `users(status invited→active→deactivated, assigned_venues[])`.
