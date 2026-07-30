# Email client — backend spec (Amir)

> **STATUS — built 30 Jul 2026 (Amir).** Everything below is live except the
> items marked *deferred*. In short: Inbox has a real store + inbound webhook
> (`POST /api/emails/inbound`, `x-inbound-secret`; set `INBOUND_EMAIL_SECRET`
> and point a mail provider's inbound-parse at it — no provider is connected
> yet, so inboxes are empty until then); schedule-send is server-side
> (`/api/emails/schedule[d]` + a 60s sweep) and cancellable from Inbox →
> Scheduled; Audiences are computed live (`GET /api/emails/audiences`);
> delivery + opens are recorded per send (transport result + a public pixel)
> and the Campaigns/Analytics tabs read the real numbers; merge fields —
> including booking-scoped ones — resolve per recipient at send time, so the
> template lock is lifted. The Automatic-emails sender is built as scheduler
> sweeps (session reminders, payment-due, review requests, day-of register
> alerts incl. late collection) and every transactional email checks its
> `autoEmails` flag first. **Deferred:** real file attachments (needs an
> upload step + nodemailer `attachments`), header-level Cc/Bcc, click
> tracking / unsubscribe footer, and a first-class campaign object (send
> history + scheduled queue serve as the campaign records).

The Email page is now a full client (mirrors the Build Manual): tabs **Inbox ·
Campaigns · Audiences · Templates · Automatic emails · Analytics · Compose**.
Front-end is built; these tabs need backend:

- **Inbox** — currently a front-end preview with demo mail. Needs **inbound email**:
  a provider mailbox/alias, an inbound webhook (e.g. SES/Postmark/Mailgun inbound →
  `POST /api/emails/inbound`), storage of received messages (from, subject, body,
  attachments, labels, folder, read/starred flags), and endpoints to list/read/
  reply/forward/archive/delete + folders (Inbox/Starred/Snoozed/Sent/Drafts/
  Scheduled/Spam/Trash/All). Labels shown: Urgent, Follow-up, HAF/funded, New
  enquiries, System.
- **Campaigns** — currently lists the real send history. A true campaign object
  (name, audience, schedule, status, per-recipient delivery) would let scheduling +
  tracking work.
- **Audiences** — "All families" is live (from `/api/emails/recipients`). Segments
  *Past customers / Waitlisted / New enquiries* need backend queries.
- **Templates** — reads `/api/messages/templates` (live, shared with Messages).
  Booking-scoped merge fields ({SessionDate}/{VenueName}/{BookingRef}) are **locked
  in the Email picker for bulk sends** (front-end, via `lib/merge-fields`
  `bookingScoped`), so nothing goes out with unresolved tokens. **Future:** to let
  those templates be used in Email, the send would need to **resolve merge fields
  per recipient** at send time (expand {SessionDate} etc. from each family's booking
  — a backend step; only non-booking fields like {ProviderName} resolve today).
- **Analytics** — send counts are live from history; **delivered / open / click**
  rates need the sending engine to record events.
- **Schedule send** — the split Send button queues an email for a future time into
  `localStorage aos.email.scheduled.v1` ({subject, recipientCount, sendAt}). **Needs
  backend:** persist scheduled sends server-side + a cron/worker that fires
  `/api/emails/send` at `sendAt`. Front-end queue is a placeholder until then.
- **Compose** — live (`/api/emails/send`). Now also: audience **by listing**
  (recipients resolved from bookings, front-end), **Cc/Bcc** (added to the recipient
  set server-side — true header-level Cc/Bcc is a mailer enhancement), a
  formatting/link toolbar (markdown), a **template inserter**, and **attachments**
  (front-end chips only — actual file-attach needs nodemailer `attachments` +
  an upload step on the backend).

---

# Automatic emails (notifications) — backend spec (Amir)

The Email page now has two tabs (from the Build Manual):
1. **Automatic emails** — the provider toggles which system emails ActivityOS
   sends on their behalf, and the reminder timings. **Front-end done.**
2. **Compose & send** — the existing one-off / newsletter-hand-off sender. Unchanged.

## What's already wired (no backend needed)
The preferences persist through the existing settings store (`/api/library` →
`settings.autoEmails`). No new endpoint — it saves like every other Setup block.

`settings.autoEmails` shape (`lib/settings.ts`):
```
autoEmails: {
  bookings: boolean         // booking confirmed / approved / declined / cancelled (core transactional)
  payments: boolean         // receipts, refunds, payment-failed
  paymentDue: boolean       // payment-due reminder
  paymentDueTiming: number  // hours before the due date (12 | 24 | 48 | 72)
  sessionReminder: boolean  // pre-session reminder (name, date, times, venue, what to bring, balance)
  sessionTiming: number     // hours before the session (12 | 24 | 48 | 72)
  waitlist: boolean         // place-opened / moved-up
  dayOf: boolean            // registers open / not-arrived / incident-logged alerts
  lateCollection: boolean   // late-checkout alert (threshold lives in Registers settings)
  announcements: boolean    // opt-in re-marketing to past customers (default OFF)
  reviewRequests: boolean   // ask for a review after the LAST booked session
}
```
Defaults: everything ON except `announcements` (opt-in). If a key is absent, treat
it as its default.

## What the backend needs to build (the sender)
This block is just preferences — the **sending is a backend job**. For each tenant,
before sending any of these system emails, check the matching `autoEmails` flag and
skip if off. Timings:
- **Session reminder** — fire `sessionTiming` hours before each session start.
  Include child name, date, start/finish, venue, what-to-bring, and any outstanding
  balance (don't re-quote once paid).
- **Payment-due reminder** — fire `paymentDueTiming` hours before a balance's due date.
- **Bookings & approvals / Payments** — transactional, fire on the event.
- **Waitlist / Day-of / Late collection** — fire on the operational event.
- **New-camp announcements** — a one-off to the provider's OWN past/opted-in
  customers (no marketplace). Respect marketing consent.
- **Review requests** — once, after the parent's LAST booked session.

Incident detail in day-of alerts stays restricted to Head Office + the staff who
logged it (only a "an incident was logged" notice goes wider).

## Acceptance
Toggling a category off stops those emails for that tenant; changing a timing moves
when the reminder fires; announcements stay off unless explicitly enabled.
