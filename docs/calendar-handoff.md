# Handoff — Calendar (manual events + reminders)

**From:** Kaz · Front-end built; the reminder *sending* is yours.

## Built (front-end + light backend)
- **Calendar page** (`features/calendar/CalendarApp.tsx`) — Month / Week / Day
  over the real listing sessions (`/api/listings`, read-only) plus manual events.
- **Manual events** — new tenant-scoped CRUD at **`/api/calendar-events`**
  (`server/src/routes/calendarEvents.ts`, mounted in `index.ts`). Fields:
  `title, date, endDate?, start?, end?, allDay?, category?, color?, notes?`.
  Operators/staff create; operators delete.
- **Categories & colours** — reusable, stored in tenant settings
  (`settings.calendar.categories: {id,name,color}[]`), managed inline on the
  Calendar's Add-event form (adding a category saves it to settings).
- **Filters** — show/hide each listing (legend), toggle booking info + events.
- **Reminder settings** — Setup → **Calendar**: `settings.calendar.reminderOn`
  (default on) + `reminderMinutes` (default 30).

## Yours — the reminder delivery
When `reminderOn` is set, **`reminderMinutes` before an event/session starts**,
send the assigned staff (and/or the operator):
1. an **email**, and
2. an **in-app bell** notification (same notify layer as accidents/medication).

Applies to **manual calendar events** (start = `date` + `start`) and, if you
want, to **listing sessions** too. Needs a scheduler/cron that scans upcoming
start times and fires once per event (idempotent — don't double-send). The
minutes-before and on/off come from `settings.calendar`. Nothing else on the
front-end is blocked on this — it's a pure delivery/scheduling job.

**Per-event override.** Each event can override the tenant default:
`remindMode` = `"default"` (follow settings) / `"on"` / `"off"`, and
`remindMinutes` (only when `on`). Resolve per event: `off` → no reminder;
`on` → send `remindMinutes` before; `default` → use `settings.calendar`.
