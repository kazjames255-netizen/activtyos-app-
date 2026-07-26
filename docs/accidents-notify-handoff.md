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

4. **Re-notify on edit.** Operators can now edit a logged record (front-end uses
   the existing `PUT /api/incidents/:id`, which already writes `updatedAt`). When
   an edit changes a record that has a `childId`, send the parent a fresh
   notification — **email + bell** — worded as an *update* ("An accident record
   for {child} was updated"), gated by the same `notifyParentAccident` /
   `notifyParentIncident` settings and the parent mute. The parent view already
   shows an "✏️ Updated · {updatedAt}" badge off the `updatedAt` field; the
   notification is the push side of that. (Don't fire on no-op saves — only when
   fields actually changed.) The original `parentNotifiedAt` is preserved by the
   client, so keep it; `updatedAt` is the edit stamp.

5. **Parent acknowledgement → notify staff.** New parent-only endpoint
   `POST /api/incidents/:id/acknowledge` is built (front-end + route): a parent
   confirms they've seen the record for their child; it sets `acknowledgedAt` +
   `acknowledgedBy`. When that happens, **email + bell the operator/staff** so
   they know the parent is aware — gated by `settings.safeguarding.
   notifyStaffAcknowledged` (Setup → Safeguarding toggle, **default on**).
   The parent UI already nudges them to acknowledge and shows the confirmed
   state; the operator card shows a "✓ Parent acknowledged" badge. Your side is
   just the outbound staff notification (respect the toggle; don't spam on
   re-acknowledge — notify on the first ack, or on a state change to acknowledged).

6. **Edit → staff choose the channel.** On an edit the operator picks *alert the
   parent* vs *just update their profile*; the client sends `notifyParentOfEdit`
   (boolean) on the PUT. Only send the edit email/bell when `notifyParentOfEdit`
   is true (and settings/mute allow). Either way `updatedAt` changes and the
   parent's profile shows the "Updated" stamp — the flag only governs the push.
7. **Notes thread.** New endpoint `POST /api/incidents/:id/note` (built) appends
   `{by, role, text, at}` to `notes[]`; a parent (own child) or staff/operator
   (own tenant) can post. Wire notifications to taste later (e.g. bell the other
   side when a note is added) — not required for launch, but note it.
8. **Enforce acknowledgement.** `settings.safeguarding.requireAcknowledgement`
   (default off). The parent UI already shows a persistent reminder while any
   accident is un-acknowledged. When this is on, drive the **reminder cadence**
   (chase emails until acknowledged); when off, a single notification is enough.
   Nothing is blocked either way.

Everything else (fields, access rules, delete) is unchanged and already yours.
