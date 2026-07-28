# Newsfeed / Newsletter — backend handoff

The newsfeed was rebuilt to the manual (front-end + a reshaped `posts.ts`). Posts
carry a **template** (`announce | event | reminder | urgent | celebrate | booking
| newsletter`) plus `priority`, `pinned`, `ackRequired`, `react`, `status`
(`draft | published | scheduled | archived`), audience scope, event fields, a
`cta` ({label, target(listing) | url}), an `rsvp` tally, `seen`/`reactions`
counters, a `newsletter` design payload, and a `folder`.

Everything below is what the front-end **can't** do on its own and is owed by the
backend.

## 1. Scheduled publishing
`status:"scheduled"` + `publishAt` (datetime) is stored but nothing flips it live.
Need a scheduler (same shape as the calendar-reminder sweep) that, at `publishAt`,
sets `status:"published"` so parents start seeing it. Until then a scheduled post
is correctly hidden from parents (parent GET returns only `published`).

## 2. Notifications (email + in-app bell)
No post notifies anyone yet. Wanted:
- **Urgent / high-priority** posts → notify all in-scope families immediately.
- **Newsletters** (on publish) → optional email of the rendered newsletter.
- **Events** → optional reminder before the date.
Respect a family mute/preference. Ack-required posts should chase non-acknowledgers.

## 3. Per-parent interaction state (currently aggregate counters only)
`POST /:id/react {on}`, `/:id/rsvp {choice,prev}`, `/:id/ack` just bump
`reactions` / `rsvp.*` / `seen` via `FieldValue.increment`. The parent app
remembers the parent's **own** choice in `localStorage` (key `aos.news.mine.v1`)
so their buttons look right on that device, and sends the delta. Needed properly:
a per-(post,parent) record so (a) state follows the parent across devices, (b)
double-taps can't inflate counts, and (c) operators can see **who** reacted /
who's coming / who acknowledged (the operator card only shows totals now).

## 4. Audience scoping is display-only
A post can be scoped `audience:"listing"` with `audId` (+ `audLabel`), but the
parent feed (`GET /api/posts`, `tenantId in [...]`) returns **every** post of a
booked provider regardless of scope. Enforce it: for a listing-scoped post, only
deliver to parents who have a booking on that listing. (Manual also has **site**
scope for company/franchise — not built here; there's no sites source wired yet.)

## 5. Images
Newsletter/logo images upload via the existing `POST /api/uploads` (base64 →
`/api/images/:id`), which is Firestore-doc-backed. Same Storage-bucket migration
caveat as the main backlog item #1 once image volume grows.

## 6. AI endpoints (built, working — FYI)
`POST /api/ai/compose` (single post) and `POST /api/ai/compose-newsletter` (fills
every text block from one brief) call Groq (`GROQ_API_KEY`, model
`GROQ_MODEL`/`llama-3.3-70b-versatile`). Operator-only. They only draft text;
they never publish. They consume Groq tokens per click.

## Not needing backend
Newsletter **folders** are a plain `folder` string on the post (no folders
collection); create/move/filter are all client-side. Draft newsletters are just
`status:"draft"` (hidden from parents, shown under the operator's Drafts filter).
