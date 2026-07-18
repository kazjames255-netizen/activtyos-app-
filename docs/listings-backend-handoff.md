# Listings & Bookings — backend handoff

**From:** Kaz · **Date:** 18 July 2026
**Branch:** `blocks-server-api` (PR #2) — 11 commits ahead of `main`

Companion to `docs/blocks-builder-backend-spec.md`, which you've already built.
Thanks for that — the Blocks builder is fully wired to it and working.

---

## 0. Four decisions we need from you first

These shape the listing schema, so they're worth settling **before** §2 is built
rather than after. They're small decisions with large knock-on effects.

1. **Does saving a listing generate dated `blocks`?** Bookings attach to a
   `blockId` — a dated run — but the builder produces a date *range* plus
   weekdays and exclusions (`runFrom`, `runTo`, `days`, `datesOff`). Something has
   to turn one into the other, and the server on save seems the natural place.

2. **If not, is free-text `dates` acceptable?** It's the quick path, but
   `POST /api/bookings` only enforces capacity and waitlist when there's a real
   `blockId`. Listings carry "60 capacity / 60 spaces left", so this probably
   means being able to oversell.

3. **Where does capacity live?** A listing has `maxAttendees` and
   `capacityScope: "day" | "listing"`. Per-day capacity in particular needs the
   dated blocks to hang off.

4. **Where should the manual booking flow live?** We've effectively built a
   "take a booking" tool inside the listing preview — find parent, child per
   pass, add-ons, editable prices. It reads like it belongs in **Bookings** as
   *"Take a booking"*, with a listing picker on the front. Is that the right
   home, and do you want it creating bookings through `POST /api/bookings` as it
   stands, or something else?

Kaz doesn't have a strong view on any of these — they're backend-shape calls, so
they're yours to make. I'm holding off building the booking write until they're
answered; I'd rather not build it twice. Detail in §6.

---

## 1. What I've been doing today

Front-end only, all on `blocks-server-api`.

**Blocks builder → your API.** Dropped localStorage entirely. Periods, passes and
bundles now load from `/api/periods`, `/api/passes` and `/api/block-bundles`, and
every write goes through them (create, edit, delete, duplicate, archive, reorder,
send-to-listings). Pricing edits are debounced ~600ms so the calculator doesn't
PUT per keystroke. Your `resolved` block is treated as the source of truth for
prices — the local calculator is only a live preview while typing.

**Listing builder.** Now 11 steps. New step 7 **Discounts** (see §4). Section
headings are editable per step. Add-ons take an emoji or an uploaded image.
Multiple hero images rotate as a carousel.

**Customer page.** Three switchable styles (Playful / Sport / Navy) the operator
picks per listing. Shares one booking engine, so behaviour can't drift between
them.

**Booking flow.** Pick pass → timing → dates → basket → checkout. Checkout is
built for *the operator*, not the parent: find the parent, assign a child to each
pass, per-day add-ons, and editable prices (§5).

**Listings index.** Cards rebuilt around when the listing runs — date rail, a
booked-vs-left capacity bar, cover image. Added sorting (start date, places
offered, places booked, % booked, fewest left, price, name) and a location
filter. The capacity numbers read from `l.blocks`, so they'll stay at zero
until bookings are real — see §6.

### Three bugs I fixed that touch shared code

1. **SSE connection leak** (`lib/realtime.ts`) — `subscribeRealtime` opened a new
   `EventSource` per component mount. Browsers allow ~6 per origin over HTTP/1.1,
   and with StrictMode double-mounts plus Fast Refresh they accumulated until all
   six were held, after which **every fetch queued forever**. This was behind a
   day of "the page won't load", failed deletes and empty pickers. Now one shared,
   reference-counted connection. **Worth knowing about if you add more realtime
   subscribers.**

2. **Auth race** (`lib/api.ts`) — `firebaseAuth.currentUser` is null for the first
   moments after a page load while the session is restored. `api()` read it
   synchronously and threw "Not signed in", so anything fetching on mount failed.
   Now waits for `authStateReady()`, and every step has a 15s timeout so a stall
   surfaces as an error instead of an endless spinner.

3. **`withBlocks` in your `server/src/routes/listings.ts`** — it read the *entire*
   `blocks` collection (every tenant's) on every listings request, just to attach
   a few blocks. Now scoped to the listings being returned via chunked `in`
   queries. Same output, but it no longer degrades as data grows. **This is the
   one change I made in your code — shout if you'd rather own it.**

---

## 2. The headline: listings have no content schema

This is the blocker for everything below.

`listingSchema` currently stores:

```js
{ name, passes: [{ name, price }] }
```

Everything else the builder produces lives in the operator's **browser
localStorage**. Open the app on another machine, or clear the browser, and a
listing is a name and three prices — the customer page renders empty.

I've kept it that way deliberately rather than inventing endpoints, but it means
**listings aren't really persisted yet**.

### Proposed schema

This is the exact working shape (`WizardDraft` in
`features/listings/ListingWizard.tsx`) — I'd suggest storing it close to verbatim
so we're not maintaining a mapping layer:

```ts
{
  title: string,
  // media
  images: { src, x, y, zoom }[],      // hero; >1 rotates as a carousel
  gallery: { src, x, y, zoom }[],
  layout: string,
  // who it's for
  ageFrom: string, ageTo: string,
  categoryIds: string[],
  heroCategoryId: string | null,      // which category badges the hero image
  venueId: string | null,
  allowOutOfRange: boolean,
  // capacity
  maxAttendees: string,
  capacityScope: "day" | "listing",
  showSpaces: boolean,
  // content
  descriptionSection: string,
  description: string,
  sections: { id, type, text }[],
  outcomes: string[], provided: string[], safety: string[], send: string[],
  headings: Record<string, string>,   // customer-page headings, "<key>.eyebrow" / "<key>.title"
  // when it runs
  runFrom: string, runTo: string,     // ISO dates
  blockMode: "weekly" | "custom",
  days: number[],                     // 0–6
  datesOff: string[],                 // ISO dates excluded
  // tickets
  blockId: string | null,             // → block bundle from your builder
  ticketOverrides: Record<string, { ageFrom?, ageTo?, capacity? }>,
  bookRules: Record<string, "week" | "listing" | "blocks">,
  // extras & team
  addonIds: string[], staffIds: string[],
  // discounts — see §4
  discounts: DiscountRule[],
  // policy
  visibility: "public" | "hidden",
  bookingType: "auto" | "manual",
  waitlist: boolean, waitlistSize: string,
  cancellation: string,
  // presentation
  pageStyle: "playful" | "sport" | "navy",
  status: "draft" | "live",
  archived: boolean,
}
```

### `visibility` needs enforcing, not just storing

`visibility` is in the schema above, but it's worth calling out separately
because it's the one field with behaviour attached — and right now nothing
honours it. It's localStorage-only, and `GET /api/listings` returns every
listing regardless.

Kaz confirmed the intended meaning is **unlisted**, not private:

- `public` — listed on the operator's booking page. Anyone browsing can find it.
- `hidden` — **not** listed on the booking page, but the direct link still
  books normally. This is how an operator quietly runs a listing for a school,
  a private group, or returning families only.

So the two reads need to diverge:

- `GET /api/listings` (parent browse feed) — must filter out `hidden`.
- `GET /api/listings/:id` (direct link, `/book/{id}`) — must still return
  `hidden` listings and allow booking against them.
- `GET /api/listings?mine=1` (operator view) — returns everything, as now.

Worth agreeing early: it changes the shape of the browse query rather than
being a field we can bolt on later, and the front-end copy already promises
this behaviour to the operator.

Note there's no `/book/{id}` route or public browse page in the app yet — I've
only built the operator side — so this is spec-ahead-of-code on both ends.

### `opensAt` — scheduled booking open

New in step 11: an operator can hold booking until a date/time (`opensAt` on the
draft, blank = open now). The listing is still browsable before then — parents
see a live countdown where the book button goes. It's for fair release on a
popular run, rather than whoever happens to be refreshing.

Front-end is done: the countdown, the disabled button (all three themes), and an
`⏰ Opens 3 Aug, 9am` badge on the operator's listing card.

**The server has to enforce it too** — the client-side lock is a courtesy, not a
control. The booking write should reject anything before `opensAt` (409 with the
open time, so we can show it), and `opensAt` needs storing on the listing.

### Also browser-only: the operator's shared library

`LocalState` in `features/listings/FreelancerListingsApp.tsx` — reused across all
of a tenant's listings, so it wants to be tenant-level, not per listing:

```ts
{ categories, venues, provided, safety, send, outcomes, addons, staff, emojis }
```

`addons` are `{ id, name, type: "perday"|"bundle"|"once", price, emoji?, image? }`
and `staff` are `{ id, first, last, bio }`.

---

## 3. Pricing must move server-side (correctness, not polish)

The browser currently decides the price **three** ways: discount rules, per-day
add-ons, and manual operator edits. Right now nothing is submitted, so nothing is
at risk — but the moment checkout writes a booking, the server has to be the one
that decides what's charged. Otherwise a booking can be submitted at a price the
server never agreed to.

Specifically, **the operator's price override (§5) must arrive as an explicit,
authorised field** — not as "whatever total the client sent" — or it becomes a way
to book anything at any price.

---

## 4. Discounts

New in the builder (step 7). Three rule types, matching the spec Kaz supplied:

```ts
type DiscountKind = "person" | "session" | "early";

interface DiscountRule {
  id: string;
  kind: DiscountKind;
  name: string;              // shown to bookers
  passNames: string[];       // which tickets it covers; [] = all
  enabled: boolean;
  moreThan: number;          // person: attendees >; session: sessions >
  appliesTo: "all" | "after1" | "second";   // person only
  method: "price" | "subtract" | "percent";
  value: number;             // £ for price/subtract, % for percent
  beforeDate: string;        // early only — must book on or before (ISO)
}
```

**Reference implementation:** `applyDiscounts()` in
`features/listings/ListingWizard.tsx`. It's a pure function — takes rules, basket
items, attendee count and today's date; returns the applied lines and the total.
It should port to the server almost unchanged. Please take the **current**
version: an earlier one ignored `passNames` on session/early rules and
under-charged.

Rules it implements, from the original spec:

- Multi-person first, then multi-session **on the reduced total**, then early bird.
- Where several rules of the same kind match, **the booker gets the best price**.
- A rule limited to certain tickets only discounts **those tickets' share** of the
  basket, and only counts **their** sessions toward its threshold.
- Early-bird rules stop applying (and stop being advertised) after `beforeDate`.

---

## 5. Operator checkout

Built for a freelancer taking a booking, not a parent self-serving:

- **Find parent** — searches `/api/customers`; falls back to booking for a new name.
- **A child per pass**, with a bulk "add to all". Multi-person discounts count the
  distinct children assigned.
- **Add-ons per pass** — per-day ones default to every day of that pass and price
  at rate × days, with day chips to drop individual days.
- **Editable prices** — each pass line is editable and discounts recalculate from
  the amended figure; plus an override for the whole booking, applied last.

### Correction to something I flagged earlier

I'd said children weren't reachable. **That was wrong** — customer records already
carry them:

```js
Sarah Jones → children: [ { name: "Jack J", age: 8, dob: "14/03/2018" }, … ]
```

So no new endpoint is needed. (The separate top-level `children` collection *is*
keyed by Firebase auth UID and doesn't join to `customers` — that's what misled
me. Worth deciding whether that collection is still wanted, since it duplicates
the same data by a different key.)

**Next step on our side:** let the operator pick from the selected parent's
children instead of typing names — avoids typos and mismatches against their
record. Say if you'd rather that read from somewhere else.

---

## 6. Taking bookings

`POST /api/bookings` is already built and looks right — transactional, capacity
and waitlist aware. What's missing is the UI, and one mismatch.

Our checkout works in **block-bundle passes + individual dates**. The endpoint
wants:

```js
{ booker, email, child, age, listing, pass, amount, method,
  blockId /* a dated run */  |  dates /* free-text label */ }
```

**`blockId` is a dated run in the `blocks` collection — not a bundle from the
Blocks builder.** So there's a question to settle before we build on it:

- Do bookings attach via the free-text `dates` label (quick, but loses capacity
  and waitlist enforcement)? **or**
- Does something turn a listing's run (`runFrom`/`runTo`/`days`/`datesOff`) into
  real dated `blocks`, so capacity works properly?

**I'd rather not build the booking write twice, so I'm holding off until this is
answered.** Once it's settled: wire Confirm to `POST /api/bookings` (one per pass
per child, with the operator's final price as `amount`), then move the flow into
the Bookings area as "Take a booking". The components are already extracted
(`useBooking`, `CheckoutPanel`), so relocating is cheap.

---

## 7. Smaller things

- **Seed data only covers `apf-demo`.** Kaz's freelancer account is on tenant
  `VOiiaTnDNd03MLbZaVcM`, so it sees zero parents and the customer search looks
  broken. A few parents seeded onto real tenants would help testing a lot.
- **Blocks builder has no first-run content** now that it's server-backed — a new
  operator sees an empty library. Worth deciding whether a starter set is seeded
  server-side or the UI offers a "create example block" action.

---

## Suggested order

1. **Answer §0** — the dated-runs and capacity decisions, since they change how
   the listing schema is shaped.
2. **Listing content schema** (§2) — unblocks everything else. Includes
   splitting the browse feed from the direct-link read so `hidden` means
   *unlisted but still bookable by link*.
3. **Discounts persisted + priced server-side** (§3, §4).
4. **Booking write**, then move the flow into Bookings.

The UI move itself is cheap — `useBooking` and `CheckoutPanel` are already
extracted, so it's a wrapper and a listing picker. It's the data underneath that
depends on the above.

Happy to adjust the shapes to whatever suits the backend — the front-end can map.
Anything above that's easier a different way, just say and I'll change our side.

---

# Answers from the backend — 18 July 2026

All of the above is **built, live on `main`, and E2E-tested** (Swagger
v0.6.0 — the changelog at the top of `server/openapi.yaml` is the contract
for everything below).

## §0 decisions

1. **Yes — saving a listing generates dated `blocks`.** Every
   `POST`/`PUT /api/listings` turns the recipe (`runFrom`/`runTo`/`blockMode`/
   `days`/`datesOff`) into real dated runs: weekly → one block per calendar
   week ("Week 2 · 10 – 14 Aug 2026"), custom → one block for the range.
   Session times come from the listing's bundle (its longest period), else
   09:00–15:30. Generated blocks carry `auto: true`; ones you make by hand
   via `POST /api/blocks` are never touched. Re-saving updates matching
   blocks in place — `bookedCount` and the open/closed toggle survive; runs
   that leave the recipe are deleted when empty, closed when booked.
   **Drop any client-side block creation — just save the listing.**
2. Moot — parent bookings always attach to a `blockId`, so capacity and the
   waitlist are always enforced. No overselling path exists.
3. **Capacity lives on the generated blocks**, from `maxAttendees` (blank =
   effectively unlimited). `capacityScope` is stored; both scopes enforce
   per block for now — true per-session counts are a later refinement, say
   if you need them sooner.
4. **"Take a booking" → the Bookings area**, writing `POST /api/bookings`
   as it stands, one booking per pass per child. The operator-typed final
   price goes in `amount` — that's the operator's *authorised* override
   (only operator roles can call it). Parent self-serve bookings
   (`POST /api/my/bookings`) never send a price.

## What changed under you (§2–§6)

- **The listing doc IS the draft.** Send the whole `WizardDraft` to
  `POST`/`PUT /api/listings` — stored verbatim, `name` mirrors `title`.
  I've already wired `syncApi` in the wizard to do this (and to upload
  images first — see below), plus the Listings tab to prefer the server
  draft over localStorage, so **open the app anywhere and everything's
  there**. Unknown fields are stripped: when the builder grows a new field,
  add it to `baseListingSchema` in `server/src/routes/listings.ts`.
- **`visibility` enforced** exactly per your spec: the browse feed filters
  `hidden`/drafts/archived; the new **`GET /api/listings/{id}`** serves the
  direct link (hidden included) and embeds `blocks` + `bundle`
  (server-priced passes/timings/periods) + `library` (the venue/add-ons/
  staff/categories the listing uses). Your `/book/{id}` page has its one
  endpoint.
- **`opensAt` enforced**: parent bookings before it → `409` with `opensAt`
  in the body for the countdown.
- **Discounts are server-priced.** `applyDiscounts` moved verbatim to
  `features/listings/discounts.ts` (shared module — same pattern as
  `features/bookings/mutations.ts`); the wizard re-exports it so your
  imports didn't break. `POST /api/my/bookings` prices every parent booking
  with it. Pass snapshots from "send to listings" now carry `days` so
  session thresholds count correctly.
- **The shared library is tenant-level**: `GET`/`PUT /api/library`,
  realtime collection `library`. The app now loads it from the server and
  migrates a browser's existing localStorage up automatically on first run.
- **Images**: `POST /api/uploads` `{dataUrl}` → `{url}`, served publicly at
  `GET /api/images/{id}` with immutable caching. Listing/library docs store
  URLs only — data URLs are rejected (Firestore 1MB doc limit). The wizard
  and library sync already upload transparently on save.
- **Your §1 fixes**: `withBlocks` scoping — kept, thanks. SSE/auth fixes —
  untouched.

## §7 smaller things

- `npm run seed -- --customers <tenantId>` seeds 10 demo parents onto a
  real tenant (already run for `VOiiaTnDNd03MLbZaVcM`). `seed --force` is
  now scoped to the demo tenant only — it once wiped real tenants, which is
  what "Unknown provider" was.
- Blocks-builder first-run content: not seeded server-side for now — an
  empty library + a "create example" action in the UI is my preference,
  your call on the UX.

## Still open on your side

*(Both of the first two items are now done — `/book/{id}` shipped in
`bef2cb6`, and the checkout in `6d0bafd`. Leaving the list below as the
current asks.)*

---

## A. Per-session booked counts — a real undercount, not a polish item

Your own note in `server/src/lib/listingRuns.ts:21`:

> capacity comes from maxAttendees … `capacityScope` "day" vs "listing" both
> enforce **per block for now** — per-session counts are a later refinement.

The consequence is bigger than "later refinement" suggests. Runs are one block
per calendar week holding a single `bookedCount`, so:

**A cap of 20 *per day* is being enforced as 20 for the whole week.** On a
Mon–Fri camp that's 100 places sold as 20 — a 5× undercount, and the operator
sees "Sold out" on a camp that's 20% full.

The two scopes currently collapse to the same behaviour, which makes
`capacityScope` a setting that doesn't do anything.

**What the front-end needs:** `bookedCount` per session, i.e. per `{block, date}`,
exposed on the blocks embedded in `GET /api/listings/{id}` — something like
`sessions: [{ date, capacity, bookedCount }]` alongside the block totals.

Everything on our side is already built for it:

- the customer page's traffic-light calendar (green / under-a-third / full)
  already reads per date — today every day in a week shows that week's number
- "Nearly full: Mon 10 Aug–Fri 14 Aug (3 left)" collapses consecutive dates
  that share a count, so per-session counts will make it read as real dates
- the "X of Y dates still have space" line likewise

**No front-end change is needed when this lands** — the display narrows from
week-accurate to day-accurate on its own.

Registers are already built on block-sessions, so the per-date grain may
already exist on your side.

---

## B. Maps need a key before launch (procurement, so it needs lead time)

The Locations tab now has a pin, an address lookup and a saved zoom, and the
customer page renders a map in the "Where is it" section. It works today
because **both services are keyless — and neither is licensed for a commercial
platform at scale**:

| what | service | the problem |
|---|---|---|
| address lookup | Nominatim (OSM) | max 1 req/sec, no systematic/bulk use, commercial use out of scope |
| map tiles | openstreetmap.org embed | OSMF donated infrastructure; explicitly not for commercial products at volume |

**Tiles are the real exposure** — one request per page view, and far worse if
parents ever see a map. Geocoding is rare by comparison (once per venue edit),
but it's still commercial use of a service that doesn't permit it.

Neither fails loudly. OSM blocks by Referer or IP once an app becomes a heavy
user, so the first sign is maps and lookups failing for *every* tenant at once.

**What we'd want:**

1. **Geocode server-side on venue save**, storing `lat`/`lng` on the venue —
   the browser then never calls a geocoder and no key reaches the client.
2. **A keyed tile provider.** Mapbox (50k loads/month free), MapTiler (100k
   tiles free), or Ordnance Survey — OS has a UK-specific free tier and is the
   natural fit for UK postcodes.

It's isolated in `features/listings/VenueMap.tsx` and the `AddressFinder`
component, so swapping providers is those two files.

---

## C. Publish validation is client-side only

The builder now refuses to publish a listing without a name, a venue, dates
that produce at least one running day, and a block with passes. But
`PUT /api/listings/{id}` would still accept `status: "live"` on a listing with
none of those — same shape as `visibility` and `opensAt` before you enforced
them. Worth mirroring server-side when convenient.

## D. The waiting-list button doesn't write anything

A sold-out listing offers "join the waiting list" and scrolls to the booking
panel, but there's no endpoint behind it. Not urgent until real bookings are
flowing — flagging so it isn't mistaken for working.

---

## FYI — venue fields you may not know exist

Venues now carry, beyond `name`/`address`:

```ts
kind?: "place" | "online",   // online = no address, map or travel; "How to join" instead
facilities?: string[],        // venue facts only — parking, hall, café
directions?: string,          // getting there & parking, or joining instructions
what3words?: string,
transport?: string,           // nearest stop/station
lat?: number, lng?: number, zoom?: number,
```

These persist already because `/api/library` stores venues verbatim — no schema
change needed, but worth knowing they're there. `whereHeading` (the venue
section's heading, tenant-level) needed adding to the `KEYS` whitelist; that
one-line change is in `server/src/routes/library.ts`, shout if you'd rather
own it.

## E. Waiting list — the process, and what it needs from you

Kaz has picked the flow; the parent half is built and working, the persistence
isn't. Both modes are configured per listing in step 11 (`waitlistMode`).

### The journey

1. **Full dates stay selectable.** They were struck through and dead; now a
   full date is tappable in an amber "queue for this" state, bulk-selectable
   via "Select all N full days". Capacity is per date, so the queue is too.
2. **One flow, two outcomes.** Wanting five days with two full doesn't force a
   choice between booking and queuing — the bookable days go in the basket,
   the full ones go on the list, same visit.
3. **No payment to join.** Never charge for a place you don't have. Money is
   taken when a place is offered and accepted.
4. **Per-date FIFO queues.** A cancellation on the 13th goes to whoever is
   first for the 13th, not first overall.
5. **Partial offers are fine.** Someone waiting on five dates who is offered
   two can take those two.

### The two modes (operator picks per listing)

| `waitlistMode` | behaviour |
|---|---|
| `"manual"` *(default)* | Nothing automatic. The operator sees who's waiting per date and offers the place to whoever they choose — useful for keeping siblings together. |
| `"auto"` | Offered to whoever joined first, by email, **held 24 hours**; on expiry it passes to the next in the queue. |

Manual needs no timers or email, which is why it's the default. Auto needs a
scheduled expiry sweep and a transactional email.

### What we need

```ts
// waitlistEntries
{
  id, tenantId, listingId,
  blockId, date,                 // the specific session queued for
  parentId, childName, contact,
  status: "waiting" | "offered" | "accepted" | "declined" | "expired" | "cancelled",
  position,                      // FIFO within {listingId, date}
  offerExpiresAt?,               // auto mode: created + 24h
  bookingId?,                    // set when it converts
  createdAt,
}
```

- `POST /api/waitlist` — join, an array of dates in one call (bulk is the
  normal case, not the exception). Returns each entry's queue position, which
  the confirmation should show: *"2nd in line for 12 Aug"*.
- `GET /api/waitlist?listingId=` — the operator's view, grouped by date.
- `POST /api/waitlist/{id}/offer` — manual mode, or the auto sweep. Should
  reject if the date is still full.
- `POST /api/waitlist/{id}/accept` → creates the booking, decrements the
  session, marks the entry converted.
- **A cancellation should trigger the queue** — that's the whole point. In
  auto mode, freeing a seat offers it to position 1 automatically.
- **Warn on operator overbooking**: adding a child to a full date while people
  are queued should say "3 people are waiting for this date" first.
- `waitlistSize` caps the queue per date; blank means no limit.

### Front-end status

Built and working against local state: date selection, bulk select, the
combined book-and-queue basket, the join panel, and the confirmation (which
already varies its wording by mode). Not persisted — the join button currently
only flips local state.

Two things for you to be aware of:

- **Your `BookingPanel.tsx` needs the same treatment.** It already says
  "Full · waitlist" at line 177 but selects whole blocks, not dates. The
  parent-facing storefront is where this actually has to work.
- **Queue positions can't be shown until `POST /api/waitlist` returns them** —
  the confirmation currently says "we'll email you" instead.

---

**Suggested order:** A first — it's a correctness bug with a number attached.
Then B, because the provider decision has lead time. E whenever you're ready
for it; the front-end is waiting. C and D once bookings are flowing.

---

# Backend answers, round 3 — 18 July 2026 (evening)

**A — shipped.** Blocks now carry `capacityScope` and per-date `dayCounts`,
maintained transactionally on every booking transition (create, approve,
decline, cancel, promote, bulk — parent and operator alike). Everywhere
blocks are embedded, `sessions` is now
`[{date, start, end, capacity, bookedCount, spotsLeft}]` and the block
carries `capacityScope` — your traffic-light calendar goes day-accurate with
zero changes, as designed. Semantics:

- `"day"`: capacity caps each DATE. A 20-cap Mon–Fri camp sells up to 100
  day-places; full on the 11th doesn't block the 12th; a whole-week pass
  needs a free place on every day it covers (block-level `spotsLeft` is
  therefore the space on the *busiest* day).
- `"listing"`: the old whole-run cap, unchanged.
- Existing blocks were backfilled from their counted bookings.
- Bonus you get for free: parent checkout baskets check capacity per
  requested DATE under day scope, and "X is full and the waitlist is off"
  names the day.

**B — needs a decision from you & Amir, not code.** Agreed on the exposure.
Recommendation: MapTiler (100k tiles/mo free) or Ordnance Survey for the
tiles, geocode server-side on venue save. Whoever owns the account, drop
the key in `server/.env` and I'll build the geocode-on-save + tile proxy
in a day. Until then the OSM usage stays low-volume dev-only.

**C — shipped.** A write that sets `status: "live"` now 400s unless the
merged listing has a name, a venue, dates producing ≥1 running day, and
passes — the error names what's missing ("Can't publish yet — this listing
needs a venue, a block with passes."). Existing live docs aren't re-judged;
partial updates that don't touch status aren't either.

**D — already works, no endpoint needed.** `POST /api/my/bookings` on a
full block (waitlist on) creates the whole basket as `Waitlisted` with
positions — that IS the join-the-waitlist write. Point the button at the
same checkout submit; the server does the rest. (With waitlist off it 409s,
naming the full day under day scope.)

**FYI back:** `whereHeading` in the library whitelist — kept, thanks.
Venue extras (kind/facilities/lat/lng/…) persist verbatim as you said;
when the maps key lands I'll start writing `lat`/`lng` server-side on
venue save.
