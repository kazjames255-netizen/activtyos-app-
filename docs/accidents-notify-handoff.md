# Accidents/Incidents → notify parent (for Amir)

**From:** Kaz · **Date:** 2026-07-26.

The safeguarding log (`features/incidents/IncidentsApp.tsx`, shared by the
`accidents` and `incidents` views, + `ParentAccidentsApp.tsx`) is rebuilt to the
Medication standard: themed hero + stat tiles, a **3-step wizard** to log one, a
**child/family picker** that resolves `childId` from the child's bookings (so the
record reaches the parent), severity + search filters, and richer cards. Parent
side is themed with timestamps + a notify bar. Setup → **Safeguarding** has the
toggles below. `/api/incidents` already accepts `childId` and the parent GET
filters by it — the operator flow now populates it.

## What's yours (backend)
1. **Notify the parent** when an accident is logged (`POST /api/incidents` with
   `kind:"accident"`) — **email + an in-app bell**, with the timestamp — UNLESS
   `settings.safeguarding.notifyParentAccident` is false (Setup toggle, default
   on). Same for incidents gated by `notifyParentIncident` (default off).
   Respect the parent's own mute (`localStorage aos.accidentNotifyMuted` today —
   persist it server-side like the medication mute).
2. **The bell** — same prominent operator/parent header bell as the medication
   notifications; accidents should raise it too.
3. `childId` resolution: the client sets it from a matching booking's `childId`.
   If you have a canonical child-match, prefer that (a walk-in with no booking
   won't resolve — those stay unlinked, like meds).

Everything else (fields, access rules, delete) is unchanged and already yours.
