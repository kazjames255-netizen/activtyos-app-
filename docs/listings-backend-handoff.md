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

## E. Waiting list — extend what you already have, don't duplicate it

**Correction to my earlier draft of this section.** I'd specified a separate
`waitlistEntries` collection before reading `my.ts` and `bookings.ts` properly.
You've already built most of this and I'd have had you build it twice. What
follows works with your code instead.

### What you already have

- `POST /api/my/bookings` creates the booking with status **`Waitlisted`** when
  the block is full, and computes a queue position by counting existing
  waitlisted bookings on that block.
- `POST /api/bookings` has a **`promote`** action that turns a waitlisted
  booking into a real one, deliberately allowing an operator overbook.

That's manual mode roughly 80% working already, under a different name. The
entry being a booking rather than a separate record is the right call — one
concept, and it converts without copying anything.

### The three changes

**1. Waitlist per date, not per block.**
Same change the capacity fix in §A needs. Today the queue is per week, so
"I want the 12th" isn't expressible.

**2. Split the basket: book what's free, queue only what isn't.**

Your comment says *"either every child gets a place or the whole basket joins
the waitlist together — no splitting siblings"*. Right instinct, wrong axis.
Don't split **children** — book one child and queue their brother, and you've
made a family's week impossible. But splitting across **dates** is exactly what
a parent wants: three days free of the five they asked for should book three
and queue two.

As it stands a parent wanting Mon–Wed with only Monday free gets **nothing** —
empty basket, no booking, and they go elsewhere. Kaz confirmed the intended
behaviour is: book what you can, queue the rest.

So: all-or-nothing **within a date** (all children on that date, or none),
never **across dates**.

**3. `promote` becomes an offer with a hold.**

Right now promote books them immediately. A place should be *offered* and held
while they decide, or you'll be force-booking families who've already made
other arrangements.

- `offeredAt`, `offerExpiresAt` on the booking, status `Offered`
- **The hold is 2 hours** (Kaz's call — long enough to see an email, short
  enough that a place isn't dead for a day)
- On expiry: back to `Waitlisted`, offer passes to the next position
- Operator override stays — promote-without-offer is still useful

### The two modes (`waitlistMode` on the listing, step 11)

| mode | behaviour |
|---|---|
| `"manual"` *(default)* | Nothing automatic. The operator sees who's waiting per date and offers the place to whoever they choose — this is `promote` plus the hold. |
| `"auto"` | A freed place is offered to position 1 automatically; on expiry it passes down the queue. |

Auto needs the piece that doesn't exist yet: **a cancellation has to trigger
the queue**. Right now cancelling frees a seat and nobody is told. That, plus
an expiry sweep and one transactional email, is the whole of auto mode.

Nothing reads `waitlistMode` server-side yet — it's stored and shown in the
builder, waiting for you.

### Also

- **Warn on operator overbooking**: adding a child to a full date while people
  are queued should say "3 people are waiting for this date" first.
- `waitlistSize` caps the queue per date; blank means no limit.
- **Queue positions should come back from the API** — the parent confirmation
  wants to say "2nd in line for 12 Aug" and currently says "we'll email you".
- **`BookingPanel.tsx` needs the date-level treatment** — it says
  "Full · waitlist" already but selects whole blocks. It's the storefront
  parents actually use, so that's where this has to land.

### Front-end status

Built and working against local state: full dates selectable in their own
state, "select all N full days", the combined book-and-queue basket, and a
confirmation whose wording follows the mode. It maps straight onto the above
once the API is per date.

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


---

## F — SEND / EHCP plans: chunked storage, built

**What's there.** The child form has a "SEND / additional needs" field, and
typing anything into it reveals an optional upload for the child's SEND or EHCP
plan. Because the project has no Storage bucket and Firestore caps a document
at 1MB, the file is split client-side and stored a chunk per document:

- `server/src/routes/childFiles.ts` — new, mine. `POST /api/my/files` reserves
  a file, `PUT /api/my/files/:id/chunks/:n` sends each chunk,
  `POST /api/my/files/:id/done` seals it (and counts the parts rather than
  trusting the client), `GET /api/my/files/:id` reassembles and serves it.
  Ceiling is 15MB across 30 chunks.
- `features/listings/planUpload.ts` — the client half, with progress.
- `childSchema` in `my.ts` now carries `sendPlanId` + `sendPlanName`. The bytes
  are never on the child document.

**Access — please read this bit.** These are special-category personal data
under UK GDPR, so unlike `routes/uploads.ts` (public URL, unguessable id, fine
for a listing photo) reads are authenticated and checked every time:

- the parent who uploaded it, always;
- an operator whose `tenantId` is on the file's `tenantIds`.

That grant is written by the booking route — I added a fire-and-forget call at
the end of `POST /api/my/bookings` that adds the listing's tenant to the plans
of the children on that basket. The client can never widen access to its own
file. Children are matched to plans **by name**, because that is what a booking
carries; if bookings ever carry child ids, that lookup should move to ids.

**Still worth doing when Storage is enabled.** Only `childFiles.ts` changes —
same routes, same ids, bytes move to the bucket, chunking disappears. Two
things I have not done and you may want: a retention rule (a plan probably
shouldn't outlive the bookings that justified it), and revoking a `tenantId`
once a family's last booking with that provider is long past.


---

## G — Operator checkout on the listing page

**Correction to what I first wrote here.** I said nothing could mark an invoice
paid. That was wrong — `POST /api/bookings/:ref/actions {type:"paid"}` already
flips `pay` to `Paid`, and `/api/payments/checkout` already raises a Stripe
PaymentIntent for a basket and confirms it. Apologies for the noise.

**What's changed on my side.** The freelancer's listing view now runs the same
checkout a parent sees — dates, children, per-child add-ons, discounts — with
the family found by name or email first, and a last step recording how the
parent is paying — using **your** four methods (Card / Tax-Free Childcare /
HAF (funded £0) / PayPal), now a single shared constant so the Take booking
modal and this screen can't drift apart.

**What's actually outstanding**, as far as I can tell from your code:

1. **The payment-link email has no link.** `emailPaymentLink` sends a button
   with `href="#"` and a note saying online payment arrives with the Stripe
   milestone. The Stripe endpoints now exist, so this looks like it just needs
   pointing at a hosted pay page for `{refs}`. Is that milestone yours and
   still open, or is it waiting on something?
2. **Offline payments have no record.** `type:"paid"` is a flag, not an entry —
   nothing captures which method settled it, when, or how much, so a partly
   paid booking can't be represented and reconciliation has nothing to read.
   That matters more now: Tax-Free Childcare, HAF and PayPal all settle
   off-platform on their own timetable.
3. **The operator checkout doesn't write yet.** It needs the "on behalf of"
   decision: either `POST /api/my/bookings` accepting `onBehalfOf:
   {customerId}` from operator roles (my preference — one pricing path, reused
   for both audiences), or `POST /api/bookings` learning the basket shape,
   which means a second pricing implementation and eventual drift.

Only (3) blocks me. Tell me which way you want it and I'll build the client
half the same day.


---

## H — Taking a booking over the phone: create the family's account

**The idea (Kaz's, and I think it's the right one).** When a provider takes a
booking on the phone, they collect the details anyway. Rather than filing that
against a CRM row nobody can log into, create the family a real account, book
onto it, and email them their booking, a way to set a password, and a link to
pay. The family ends up owning their booking — they can see it, pay it, and
reuse their children next time. No orphaned records, and the parent portal
starts populated instead of empty.

**What the operator collects**, and what I'm building the screen around:

| Parent | Child (per child) |
| --- | --- |
| Full name | Name |
| Email | Date of birth |
| Phone | Boy / girl |
| Address | (allergies, medical, SEND — optional) |

**What I need from you.**

1. **A way to book for someone else.** However the account is created, the
   server still authenticates the *operator*. It needs to accept "create this
   booking for parent X". My preference remains `POST /api/my/bookings` taking
   `onBehalfOf: {uid | customerId}`, allowed only for operator roles, so the
   pricing/discount/capacity path stays single. The alternative — teaching
   `POST /api/bookings` the basket shape — means a second pricing
   implementation, and two implementations of a price drift.

2. **Account creation.** `admin.auth().createUser` for the email, role
   `parent`, then the booking against that uid. Four things I'd ask for:
   - **If the email already has an account, use it — don't create a second.**
     This is the case most likely to bite, and it is not rare: a `customers`
     record is only written by `upsertCustomerFromBooking`, i.e. on booking. So
     a parent who registered on ActivityOS but has never booked *with this
     provider* does not appear in the operator's search at all. The operator's
     only route is option 2, and the server linking by email is the thing that
     stops them ending up with two accounts. The screen says as much, but the
     guarantee has to be server-side.
   - **Never email a password.** Create with no password and send Firebase's
     password-reset (or sign-in) link. A password in an inbox lives forever.
   - The operator must not keep any access to the account afterwards.
   - Upsert the `customers` record too, so the tenant's CRM still shows them
     (`upsertCustomerFromBooking` presumably already covers this).

3. **One email.** Booking confirmation + "set your password" + pay link, saying
   plainly *who* booked it and *why* they have an account — that's the GDPR
   basis as much as the courtesy. Related: `emailPaymentLink` currently sends
   `href="#"`. Whatever we do here, that link needs to point at the Stripe
   checkout you already built.

**Risk worth designing for.** A mistyped email creates an account for a
stranger containing a child's name and date of birth. I'm putting a read-back
confirm in the UI ("that's smith@gmail.com — right?"), but a server-side
guard — say, no child data in the email body itself — would be worth having
too.

**Where I am.** The screen is built and describes both routes to the operator
(find an existing family, or create one). It cannot write a booking until (1)
exists. Nothing else blocks me.

---

# Embed widget shipped — 19 July 2026

Build item 11's second half. One line on any website:

```html
<script src="https://YOUR-ACTIVITYOS/embed.js" data-listing="LISTING_ID" async></script>
```

renders a **Book now** button that opens the real `/book/{id}` page in an
overlay (Escape / backdrop closes). `data-mode="inline"` embeds the page
directly instead, auto-sized via `postMessage` height reports from the
page. `data-label` / `data-color` restyle the button. The origin comes
from the script's own `src`, so one snippet works in dev and prod.

Operators copy their snippet from the listing card's ⋯ menu ("</> Embed
on my website"). In embeds the page hides the "My bookings" link (no
trapping a provider's visitor in our dashboard) and keeps `?embed=1`
through the sign-in round trip. The button styling is deliberately plain —
restyle `public/embed.js` however you like; the postMessage contract is
`{type: "activityos:height", value}` only.

**Embed update (same day):** script-hoisting frameworks (next/script and
friends) move the tag, so "insert beside my own script" was unreliable on
React sites. embed.js now also supports mount elements —
`<div data-activityos-book="LISTING_ID">` (+ optional data-mode/label/
color) with the script loaded anywhere. A MutationObserver mounts
late-rendered placeholders (SPA navigations included) exactly once;
double-loading the script is guarded. The plain one-liner still works for
static HTML.

**Storefront embed (same day):** the widget now embeds a provider's WHOLE
shop, not just one listing. `GET /api/listings?tenantId=` narrows the
public feed to one provider; `/store/{tenantId}` renders their live
listings as a grid (each card opens its `/book/{id}` page, with a back
link inside embeds); `data-store="TENANT_ID"` /
`<div data-activityos-store="TENANT_ID">` on the widget shows it on their
website. Operators copy the snippet from the Listings tab header
("</> Embed"). The store page is deliberately simple — it's also what the
future subdomains will serve, so restyle at will.

**Checkout shape fix (19 Jul):** your unified checkout posts items as
`{pass, dates, child, addons?}` — no `age`, no timing. The server now:
fills the age from the family's saved child profile (name-matched,
dob-derived; unknown child = 0 rather than failing the booking), and
accepts **`timing`** (the period TITLE, which your basket already has)
as well as `periodId`. ⚠️ One line needed on your side: include
`timing: item.timing` in the POST items, or every timing books at the
base pass price — the preview showed a timed price while the server
charged the untimed one.

**Update — done for you (same day):** your basket now carries `periodId`
(the label in `timing` stays display-only) and the checkout POST includes
it, so the server prices the chosen timing exactly as your preview shows.
Nothing left on your side for this one.

---

# §E shipped — 19 July 2026

Built exactly as your corrected spec: bookings ARE the entries, three
changes, no new collection. Swagger v0.10.0 has the full contract.

1. **Queues are per date** — FIFO by ref within each date of the booking's
   `days`. Checkout responses (and operator-created waitlisted bookings)
   return `waitlist: [{ref, date, position}]`, so the confirmation can say
   "2nd in line for 12 Aug". `waitlistSize` caps each date's queue (409
   names the date).
2. **Baskets split by date, never by child** — dates with space book, full
   dates queue, siblings on the same date stay together (grouped by
   identical day-sets). Your Mon–Wed-with-only-Monday-free parent now
   books Monday and queues the rest.
3. **`offer` = promote with a hold** — new booking status **`Offered`**:
   seat held (counts toward capacity, NOT expected on registers) for
   **2 hours** (`offerExpiresAt`); parents accept
   (`POST /api/my/bookings/{ref}/accept-offer` → Confirmed → pay) or
   decline (place passes on). Expired offers sweep back to the queue every
   5 minutes. `offer` 409s while the date is still full; `promote` stays
   your overbook override and now returns `waiting` (how many are queued
   for those dates) for the warning you asked for.

`waitlistMode` is enforced: `"manual"` (default) nothing automatic —
operator sees the queue (waitlisted bookings carry `days` + note with
positions) and offers whom they choose; `"auto"` — cancellations,
declines and expiries offer the freed place to position 1 with one email
("a place is yours for 2 hours").

**For your UI:** the Bookings table needs the `Offered` status (amber
badge is already in `statusTone`); the operator detail shows
"Offer place (2h hold)" / "Promote now" on waitlisted bookings; parents
get an accept/decline banner on My bookings — all built simply, restyle
at will. Your storefront checkout gets the split + positions for free
from the same POST it already calls.



---

## I — A child's photo needs to reach the booking, not just their profile

**Why.** A photo on the register is a safeguarding tool: staff who have never
met a child use it to know who they are greeting and, more to the point, who
they are handing over at the end of the day. It only does that job if it
travels with the booking.

**Where it is now.** `childSchema` already carries `photo` (a 128px square
data URL, ~10–20KB), and parents can add one in their profile area and while
adding a child mid-booking. Both places now say what it is for, which is why a
parent would bother.

**What's missing, and it's on your side.** A booking record stores
`child: string` — the name, nothing else. So the bookings list, the booking
detail and the registers cannot show a face even when one exists, and matching
by name is the wrong idea: two families with a Sophie, or a parent who typed
"sophie" one time and "Sophie" the next, and the register shows the wrong
child's photo. That is a safeguarding bug, not a cosmetic one.

**What I'd ask for:** the child's **id** on each booking item, so the photo (and
allergies, and the SEND plan) can be resolved from the child record rather than
guessed from a string. Then:

- the bookings list can show the children on a booking, not the booker's initial;
- registers can print faces;
- a photo updated in the profile appears everywhere at once, because nothing is
  copied.

Copying the photo onto the booking would also work and needs no lookup, but it
goes stale the day a parent updates it, and it puts a child's face in a second
place we then have to remember to delete. I'd rather have the id.

**One consent detail.** `photoConsent` on the child governs whether they may
appear in Moments/newsfeed photos. It should *not* gate the register photo —
different purpose, different basis — but a parent may reasonably expect it to,
so the copy in both upload spots says what the photo is for. Worth agreeing
between us before either of us builds on it.


---

## J — Collection password (safeguarding)

**What it is.** A word the family chooses. If anyone other than the usual adult
comes to collect a child — a grandparent, a friend, the other parent on the
school run — staff ask for it and don't hand the child over without it.
Standard practice in childcare, and we had no field for it.

**Built.** `collectionPassword` on the child, captured in both places a child
is added (the parent's profile area, and mid-booking — which is also the
operator's phone-booking flow), with copy explaining what it's for and when
it's used. Added to `childSchema` in `my.ts`. Max 60 chars, optional.

**Deliberately plain text.** Staff have to read it to check it, so it can't be
hashed. Two consequences worth agreeing:

- Both forms tell the parent "staff can see this word, so don't reuse a
  password from anywhere else". Please don't let it become an auth credential
  anywhere.
- It should be visible to staff working that booking, and to nobody else. Same
  access question as the SEND plan in §I.

**What's needed from you.** Like the photo, it's useless until it reaches the
register — and a register is per session, built from bookings, which currently
carry the child's *name* only. So this rides on the same fix: **`childId` on
each booking item**. With that, the register can print the child's photo, their
allergies, their SEND plan and their collection password from one lookup.

Without it, none of the four can be shown safely — and matching by name would
eventually show one family's collection password against another family's
child, which is the worst possible version of this feature.


---

## K — Parents area: the operator can't read a family's real records

**The design.** Two tabs. *Parents* — a searchable list with each family's
children, booking count and spend, filterable by location and listing.
*Child profiles* — the full safeguarding record per child: allergies,
medications, emergency meds, dietary, SEND plan (viewable/downloadable), GP and
NHS number, swimming ability, consents (photo / suncream / first aid / walk
home), care and behaviour notes, emergency contact, authorised collectors and
the collection password.

**The principle behind it, which I think is right:** the provider types almost
nothing. Adding a customer captures name, email and phone — that's it. Everything
else is entered once by the parent in their own account and *surfaces* here. The
child record is the single source of truth; this page is a read of it.

**And it fills from manual bookings too.** When a provider takes a booking over
the phone they enter the parent's details and each child's — name, date of
birth, boy/girl, allergies, medical, SEND, collection password, photo. All of
that has to land on the same records this page reads, not in a parallel copy.
So the phone-booking write (§H) and this page are two ends of one thing: the
operator's typing populates the family's account, and the family's own edits
update what the operator sees. Whichever way a detail arrives, there is one
record of it.

**Why none of it can be built yet.** Three things are missing, and the first is
the blocker.

1. **Nothing links a tenant's customer to the parent's account.** A `customers`
   record is matched to a booking by email; it holds no `uid`. So there is no
   path from "this family books with me" to "these are their children".
2. **`children` are scoped by `parentUid`.** An operator has no permitted read.
   Today the only children an operator can see are the thin name-and-age copies
   on the customer record — which is why I removed that field from the add form
   rather than keep two versions of a child in the system.
3. **Most of the fields don't exist.** A child record currently holds: name,
   age, dob, school, sex, allergies, medical, send, sendPlanId, likes,
   dislikes, collectionPassword, photo, photoConsent.

   The design needs, additionally: **emergency contact** (name, relationship,
   phone), **dietary** (distinct from allergies), **swimming ability**,
   **care & behaviour notes**, and consents for **suncream**, **first aid**
   and **walking home alone** — each a yes/no the parent gives, like
   photoConsent.

   *Not wanted, despite appearing on the mockup: authorised collectors, and
   GP / surgery / NHS number.* The collection password covers who may collect;
   a named-collector list is a second thing to keep in step with it, and
   medical-record identifiers are more data than a session provider needs to
   hold.

**What I'd ask you to build.**

- `uid` on the customer record, set when a booking is made and when an invite
  is accepted, so customer ↔ account is a real link rather than an email match.
- `GET /api/customers/:id/family` — the parent plus their children's full
  records, for an operator **whose tenant that family has actually booked
  with**. That last clause is the whole security model: a tenant may read the
  medical details of children attending their sessions and nobody else's.
- The extra child fields above, so parents can enter them once.
- A rule on who inside a tenant sees the safeguarding block. The design says
  "visible to permitted roles only" — my reading is owner and staff working
  that session; not, say, a marketing user. Your call, but it needs to be a
  role check rather than a UI hide.
- Retention: how long a tenant keeps reading a family's records after their
  last booking. Medical and safeguarding data on children shouldn't sit
  visible to a provider indefinitely.

**What I'll do once it exists.** Build both tabs against it. The list, the
location and listing filters, the search, the child profile cards, the SEND
plan download (§F is already built), and the safeguarding block. None of it
needs anything from you beyond that one endpoint and the fields.

**One thing worth deciding together.** The mockup shows the collection password
in plain text on screen (BLUEBIRD). That is correct — staff have to read it —
but it means the Parents area is a screen full of children's medical and
safeguarding data, and should probably be excluded from any screen-sharing,
demo or export path we build later.


---

## L — Marketing consent, and what the marketing area will need

**Two rules now enforced in `routes/customers.ts`.**

1. **A family with bookings can't be deleted.** `DELETE /api/customers/:id`
   409s if any booking in that tenant carries their email. Deleting them would
   leave bookings whose family record has gone — a register naming a child
   nobody can look up — and would destroy the record of what they consented
   to. The UI doesn't offer it either, but the server is the rule.

2. **Consent is dated and attributed.** `marketingOptIn` now comes with
   `marketingOptInAt` and `marketingSource`, stamped server-side and only on
   the transition — re-saving a phone number doesn't refresh the date, or the
   record stops meaning "they agreed on this day". Turning it off clears both.
   Consent you can't date or account for is consent you can't rely on if
   anyone ever asks, which under PECR they may.

**What the marketing area will need from this, when we build it.**

- **The list**: customers where `marketingOptIn` is true, filterable by
  `locationId` — the two fields exist for exactly this.
- **An unsubscribe that works from the email**, not only from the operator's
  screen. A one-click link, no login: a parent who has to sign in to stop
  emails will mark you as spam instead. It needs a signed token per recipient
  and an endpoint that flips `marketingOptIn` to false and stamps the time.
  That's yours — I can't sign anything client-side.
- **Suppression that survives deletion.** If a family is ever removed and
  later re-added by a booking, `upsertCustomerFromBooking` recreates them
  without `marketingOptIn`, so the default is "don't email" — that's the right
  way round and worth keeping. But someone who *actively unsubscribed* should
  stay unsubscribed even if their record is rebuilt, which means a small
  tenant-level suppression list keyed by email, separate from the customer
  record.
- **Per-tenant, never platform-wide.** They consented to hear from one
  provider. A family on two providers' books has consented twice or once, and
  the marketing area must never read across tenants.

**One thing I'd push back on if it comes up:** don't add "email everyone who
has booked" as a shortcut. A booking is not consent to marketing — it's the
soft opt-in at best, and only for similar services with an unsubscribe in
every message. Better to make the consent tick easy to collect than to work
around it.


---

# What I need from you — one list, in the order that unblocks the most

*Updated after your 20 July pushes. Almost everything on this list is now
done — struck through rather than deleted, so the history reads. The three
that remain are at the bottom.*

### ~~1. Book on someone else's behalf~~ — **done, thank you**
`onBehalfOf` landed exactly as hoped: one pricing path, existing accounts
reused by uid, no password ever emailed, no child data in the email. I'll point
Confirm at it and both screens start writing — that's my next job, not yours.

Two small things I'll check when I wire it, not asks: the operator screen sends
one call per block for a multi-week basket, and I'll make sure the new-family
fields it already collects (name, email, phone) map onto your
`onBehalfOf {name, email, phone}` shape rather than needing a customer first.

### ~~2. `childId` on each booking item~~ — **done**
Landed with the safeguarding read. This was the one blocking four things at
once; a register can now resolve a child's photo, allergies, SEND plan and
collection password from one lookup instead of matching on a name.

### ~~3. `GET /api/customers/:id/family`~~ — **done**
### ~~4. Extra fields on a child~~ — **done**
Dietary, swimming, care notes, and the suncream / first aid / walk-home
consents are all on `childSchema` now. One note: I'd split **emergency contact**
into `emergencyName` + `emergencyPhone` in the same window you added
`emergencyContact` as a single string. I kept the split on the merge — a
register prints the name and dials the number, and nothing was reading the
combined field yet. Shout if you'd rather have it back the other way.

### ~~Maps (§B)~~ — **done**
Ordnance Survey geocoding with the key server-side, and the tile proxy. That
closes the last thing that needed procurement.

---

### Still open

**1. File storage for SEND plans.** Chunked across Firestore documents because
there's no bucket — works, capped at 15MB, but it's a workaround. When Storage
is enabled only `routes/childFiles.ts` changes. (§F)

**2. Marketing plumbing.** An unsubscribe that works from the email without a
login (needs a signed token — I can't sign anything client-side), and a
tenant-level suppression list so an unsubscribe survives a record being rebuilt
by a later booking. (§L)

**3. A shared test family (§M).** Now the most valuable of the three. Between
your last two pushes and mine, the amount of code touching a parent's own
record has roughly doubled, and none of it has run end to end. Specifically I
still can't check: whether `PUT /api/customers/:id/children` resolves a real
uid and writes to the right child; whether a real multi-megabyte SEND plan
survives chunking; whether the sign-up invite email arrives; and whether your
`onBehalfOf` bookings and my Families page agree about who a family *is*.

### Decisions rather than code

- **Who inside a tenant sees safeguarding data.** Needs to be a role check, not
  a UI hide. (§K)
- **Retention** — how long a provider keeps reading a family's medical records
  after their last booking. (§I, §K)
- **`photoConsent`** governs Moments/newsfeed photos. Kaz's call, and I agree:
  a photo a parent uploads may be used anywhere *staff* work; consent still
  gates anything another family or the public can see. (§I)

### Things I changed in your files — all flagged in the PRs

`routes/my.ts` (childSchema fields, add-on answers, SEND-plan access grant),
`routes/customers.ts` (name parts, location, consent stamping, the delete
guard, the invite endpoint), `lib/emails.ts` (the invite email),
`index.ts` (mounting `/api/my/files`). New and mine: `routes/childFiles.ts`.

### One correction I owed you — and you've since fixed the rest

An earlier draft said nothing could mark an invoice paid. That was wrong:
`{type:"paid"}` already existed, as did the Stripe checkout. The real gap was
`emailPaymentLink` sending `href="#"` — which your 19 July push fixed, along
with writing a `payments` record for offline payments. Both closed.

---

# F/G/H answered — 19 July 2026 (Swagger v0.11.0)

**F — reviewed, keep it.** The access model is right (owner or granted
tenant, 404 over 403, grants only ever written server-side). Agreed on the
Storage migration and retention/revocation as later items; name→id child
matching moves to ids if bookings ever carry them.

**G-1 — done.** `emailPaymentLink` now links to
`/custdash/bookings?pay={ref}` — sign in and the Stripe card payment for
that booking opens automatically. (Same link is used by the §H email.)

**G-2 — done.** `{type:"paid"}` now writes a `payments` record —
`offline: true`, the booking's method (TFC/HAF/PayPal/…), amount,
recordedBy, timestamp — so reconciliation has entries to read. Partial
payments stay future work (needs an amount on the action).

**G-3 / H — done, your preferred way.** `POST /api/my/bookings` takes
`onBehalfOf: {customerId?} | {name?, email, phone?}` for operator roles —
one pricing path. Server guarantees, per your asks: existing account with
that email is REUSED (uid-checked, never a duplicate — covers the
registered-but-never-booked parent your search can't see); accounts are
created with NO password and the email carries Firebase's set-password
link; the operator keeps no access; `customers` upserts as before. The
ONE email = confirmation + set-password + pay link, and contains **no
child data** (your mistyped-email guard, server-side). Operator-taken
bookings come back Confirmed + "Invoice sent", and waitlist positions
ride the response like the parent flow. Your screen can write the moment
you point Confirm at it.


---

## M — Can we set up a proper family account to test against?

**Kaz's suggestion, and I think it's overdue.** Nearly everything built in the
last stretch touches a parent's own record — children with dates of birth,
allergies, SEND plans, collection passwords, photos, consents — and none of it
has been through a real family account end to end. It typechecks, and that is
not the same thing.

What I'd like, on the dev project:

- **One parent account we both know the login for**, with two children on it —
  one plain, one with the awkward things: an allergy, a SEND plan uploaded, a
  collection password, photo consent set to no, a name with an apostrophe.
- **A booking on each**, one paid and one invoiced, so registers, exports and
  the Bookings list all have something real to render.
- Seeded rather than clicked through, ideally, so we can both reset to it.
  `server/src/seed.ts` already exists.

**What it would immediately catch.** Things I can't check from here:

1. Does `PUT /api/customers/:id/children` actually resolve the account and
   write to the right child? I wrote it and it typechecks — it has never run
   against a real uid.
2. Does the SEND plan upload survive a real multi-megabyte PDF, chunked and
   reassembled?
3. Does the sign-up invite email arrive, and does the set-password link land
   somewhere sensible afterwards?
4. Do your `onBehalfOf` bookings and my Families page agree about who a family
   is — same email, same customer record, no duplicate?

I can't sign in as a parent from here, so every one of those is currently
"should work". A shared test family turns them into "does work", and it stops
us both discovering the same bug separately a fortnight apart.

Happy to write the seed myself if you'd rather — just tell me which project
and I'll keep it out of anything that could reach production data.

---

# childId + family safeguarding read — 20 July 2026 (Swagger v0.12.0)

**§I/§J — done (your #2, the big one).** Booking items now take **`childId`**.
Send the saved child's id and the booking is stamped with it; registers then
resolve the **photo, allergies, SEND (+ "plan on file"), and collection
password** from the child record — never by name. When no id is sent the server
falls back to a name match against the *account's own* children (so existing
flows keep working), and an unknown name gets no id rather than a guess. A
foreign id is never trusted.

**Your one-line wiring:** include `childId: <saved child id>` on each item your
checkout posts when the parent/operator picked a saved child. Without it,
registers still work but can't show the safeguarding data for that child (which
is the safe failure, not a wrong one). My RegistersApp already renders the
photo + allergy/SEND/collection-password chips off it.

**§K — the read endpoint is built.** `GET /api/customers/:id/family` returns the
parent + their children's **full** records, but only to an operator **whose
tenant the family has actually booked with** — I gate on a real booking, not
just a customer row, so adding a stranger's email via `POST /customers` can't
be used to read their children. It also stamps the `uid` link. Build both tabs
against it; the SEND-plan download (§F) already works.

**customer↔account `uid`** is now set on the booking path too (not only your
invite/children endpoints), and the customer's thin child list carries a
`childId`, so the Families page can join to the real record.

**Extra child fields (§K #4) added to `childSchema`:** `dietary`, `swimming`
(none/weak/confident/strong), `careNotes`, and consents `suncreamConsent` /
`firstAidConsent` / `walkHomeConsent`. Not added, per your note: authorised
collectors and GP/NHS number.

**Still yours / still decisions:** which roles inside a tenant see the
safeguarding block (a role check, not a UI hide); retention after a family's
last booking; marketing unsubscribe token + suppression list (§L); the maps
key (§B); and the shared seeded test family (§M) — happy to seed it, tell me
if you'd rather.

---

# Ratios & groups — 20 July 2026 (Swagger v0.13.0)

First "Run the day" feature, and the first thing to stand on the childId
foundation. `GET /api/ratios?date=` gives each session its children (ages +
SEND resolved from the child record), the **required staff** for the age mix,
who's assigned, and the per-group breakdown; `PUT /api/ratios/:blockId/:date`
saves named groups with their children and staff. Staff come from the tenant
library (`library.staff`); the ratio table is UK camp defaults (1:8 for 5–7,
1:10 for 8+, tighter under 5), mixed ages summed and rounded up. SEND is
surfaced, never auto-applied. Realtime collection `ratioGroups`.

A simple `RatiosApp` is registered on the `ratios` slug (all four operator/
staff portals) — restyle at will; the maths and persistence are the point.

Also fixed a data bug your Families page would have shown: a basket of N
children created N duplicate customer rows (the per-booking upsert raced).
Baskets now upsert the family once.

---

# §B maps — geocoding moved server-side; OS-ready — 20 July 2026

Step 1 of the Ordnance Survey move (Amir's call). **Geocoding no longer runs
in the browser.** `AddressFinder` now calls `GET /api/geo/search?q=` — the
server does the lookup, so no map key or third-party request reaches the
client or the embed widget. Auth-required; the picked hit still saves lat/lng
on the venue exactly as before, so your `VenueMap` and the customer page are
unchanged.

Provider is env-chosen (`OS_API_KEY` in `server/.env`). Until the key lands it
falls back to server-side Nominatim (low volume, proper User-Agent). The OS
Names path is deliberately left for the key — OS returns British National Grid
eastings/northings, so the BNG→WGS84 transform has to be built and verified
against the real API, not guessed.

**Still to do once the key is in (`OS_API_KEY`):** wire OS Names in
`routes/geo.ts`, and replace the OSM tile iframe in `VenueMap.tsx` with OS
Maps tiles via a small server proxy (so the tile key stays server-side and
embeds keep working). Both need the real service to build/verify — a
half-day once the account exists.

**§B maps — DONE (20 July, key in).** Ordnance Survey is fully wired:
- `GET /api/geo/search` uses OS Names (postcodes + places) with BNG→WGS84
  conversion (proj4), Nominatim fallback on any failure. Verified: real
  UK postcodes resolve to correct lat/lng.
- `GET /api/geo/tiles/:z/:x/:y.png` proxies OS Maps raster tiles (key
  server-side, week-cached, public so `<img>`/embeds work). OSM fallback
  when no key.
- `VenueMap.tsx` rewritten from the OSM iframe to a dependency-free slippy
  map reading the proxy — renders real OS "Light" tiles, pin centred, zoom
  buttons. Attribution updated to "Contains OS data © Crown copyright".
No key ever reaches the browser; the embed widget keeps working on other
sites. Nothing left on this — restyle the map however you like.

---

## N — Provider-defined child questions (built, needs one server change)

**What changed.** The six extra child fields you shipped — `dietary`, `swimming`,
`careNotes`, `suncreamConsent`, `firstAidConsent`, `walkHomeConsent` — were my
spec, and my spec was wrong. They assume every provider wants the same six.
A swim school needs swim ability; a coding club doesn't and will wonder why
it's on their form. Meanwhile the question they actually need — "which school
run do they come from?" — can't be added at all.

So they're now **provider-defined questions**, set in a new Setup & features
screen, and five of the six are seeded as editable defaults so nothing changes
under an existing provider. A provider can rename, reorder, hide, delete, or
scope any of them, and add their own.

**Nothing of yours needs deleting.** Your six fields still exist and still
validate. They're simply no longer written to, because:

### The one thing I need from you

**Accept `answers` on the child record.**

```ts
answers: z.record(z.string().max(2_000)).optional()
```

A flat map, question id → answer as a string. That's it.

I did **not** write answers into your six typed fields, deliberately:
`swimming` is `z.enum(["none","weak","confident","strong"])` and the three
consents are booleans. The moment a provider renames "Weak" to "Beginner" or
adds a fifth option, the enum rejects a legitimate answer — and the enum being
wrong is the whole reason these stopped being fixed columns. Strings survive
renaming; enums don't.

Each seeded question carries a `replaces` field naming the old column, purely
so the mapping is documented if you ever want to migrate historic values.

### Two smaller notes

- **`careNotes` is now dead.** It asked the same thing as the built-in likes &
  dislikes pair, so families would have written the same answer twice and staff
  would have had to read both to be sure they had it. Nothing writes to it.
  Drop it whenever suits.
- **Storage.** Questions and settings live in `libraries/{tenantId}` under
  `settings` and `childQuestions`, on the existing whitelist. No new
  collection.

### A bug I fixed in your library route

`PUT /api/library` did `.set(doc)` — a whole-document replace, so **any key the
caller left out was deleted**. Harmless while one screen owned the library and
always sent all of it. The moment Setup started writing `settings` while the
Listings screen kept sending only its own ten keys, saving a category would
have silently wiped every setting.

It's a read-modify-write now: keys present in the body replace their stored
value wholesale, keys absent are left alone. I didn't use
`.set(..., {merge:true})` because merge descends into nested maps, and removing
an emoji from `emojis` would then never propagate.

### Per-booking answers — the one thing I can't do alone

A question can be set to "ask every booking" (for things that go stale — "any
injuries this week?"). Today the new answer **replaces** the old one on the
child record. Staff always read the current answer, which is the part that
matters for safety, but there's no history: you can't see what was said in
March alongside August.

Per-booking history needs an `answers` map on the **booking** as well as the
child. Not urgent, and no rush — but worth knowing the limitation exists before
someone asks why the audit trail is missing.

### Three more settings that need you before I can wire them

The Setup screen stores these correctly and each one is marked "wiring
pending" on screen, so nobody is misled. Nine of the twelve are mine to
finish. These three aren't:

1. **Gender options — `sex: z.enum(["boy","girl"])` (`my.ts:146`).**
   A provider can now set their own list, and the shipped default includes
   **"Prefer not to say"** — which your enum rejects today. That's my
   inconsistency, not yours; I've left the checkout on Boy/Girl until this
   moves. Suggest `z.string().max(40).optional()`, since any fixed set is
   wrong for somebody. The client keeps `sexTint()` colours keyed on the first
   two values and falls back to neutral for anything else.

2. **Cancellation reasons — nothing accepts one.** `mutations.ts` writes an
   automatic string ("Cancelled by provider.") and no route takes a `reason`
   field. A provider wanting Illness / Weather / Staffing for reporting needs
   `reason: z.string().max(120).optional()` on the cancel endpoints, stored
   alongside the existing message. Cheap now, and there's nothing to migrate.

3. **More than one emergency contact.** The child record holds a single
   `emergencyName` / `emergencyPhone` pair. The setting goes up to four, which
   needs those to become an array. Lowest priority of the three — say if
   you'd rather I drop the setting back to one until it's worth doing.

**Not on your list:** payment methods are already `z.string().min(1)`
(`bookings.ts:98`), so that one is purely mine. Same for cancellation policy
wording, new-listing defaults, the low-places threshold, the pipeline stage
names and colours, and the repeat threshold — all client-side, all mine.

### Update — eight of the twelve are wired now

Since the note above I've wired everything that didn't need you:

- **Payment methods** → the operator's method picker (`z.string()` already, so
  nothing needed). Parents still see Card / Bank transfer / Cash: those route
  to Stripe or don't, so they're rails, not labels.
- **Pipeline stages and the repeat threshold** → the Families screen. Stage
  keys stay fixed (the product has to know which is which); names and colours
  are the provider's.
- **Cancellation policy wording** → the listing builder's step 11.
- **New-listing defaults** (capacity, running days, show-spaces) → applied
  when a listing is created.
- **Collection check** → off / PIN / password, including the wording and
  keypad on the parent's field.
- **Character limits** → both the checkout and the Families form.

**Four still need you.** Three are the ones above (gender enum, cancellation
reason field, multiple emergency contacts). The fourth turned up while wiring:

4. ~~**"Only N places left" threshold.**~~ **Dropped — nothing needed.** The
   rule already scales on its own: `min(5, a third of capacity)`, so an
   8-place class warns at 3 and a 60-place camp at 5. The setting was a knob
   for something already handled, and a pure percentage would be worse at both
   ends (20% of 200 is "only 40 left", which reads as broken). If it ever
   needs tuning it belongs per-listing beside the capacity it relates to, not
   as a tenant setting.

That anonymous-read constraint is worth remembering generally: **any setting
that has to affect the public storefront needs to be denormalised onto the
listing**, the way you already embed categories. Tenant settings only reach
signed-in screens.

---

## O — Cancellation policy is now rules, not prose

Kaz spotted the flaw in what I'd shipped: a policy written only as a sentence
("cancel 48 hours before for a full refund") **can't do anything**. The
provider still reads it, works out the notice period by hand, and decides the
refund themselves — which is exactly the arithmetic a computer should do, and
exactly where a tired human quietly stops being consistent.

Worth noting the legacy mock had this right: its Bookings tab specified a
"refund % per notice window" editor. My spec lost it.

**The policy is now bands**, in `lib/cancellation.ts`:

```ts
{ bands: [
    { hoursBefore: 168, refundPercent: 100 },  // a week
    { hoursBefore: 48,  refundPercent: 50 },
    { hoursBefore: 0,   refundPercent: 0 },    // anything later
  ] }
```

**The prose is generated from the bands**, not typed alongside them. One
source of truth, so what a parent is told and what the system works out can
never drift apart. A provider can override the wording, but then owns keeping
the two in step.

`refundFor(policy, firstSessionIso, paid, nowIso)` returns the recommendation.
It's shown in the operator's cancel panel and prefills the partial-refund box —
**a suggestion, never an action.** ActivityOS still doesn't move money.

It returns **null** rather than guessing when it can't tell: no session date, a
free-text session ("Week 1"), no amount. A confident wrong number about someone
else's money is worse than no number.

41 assertions cover it, including the one that was wrong first time:
`Math.round(37.55 * 50) / 100` gives **£18.77, not £18.78**, because
`37.55 * 50` is `1877.4999999999998` in binary floating point — a penny short
on every refund landing on a half. It works in integer pence now.

### What I need from you

1. **Parent self-cancel has to run the same rules server-side.** The moment a
   parent can cancel their own booking, the refund can't be worked out in the
   browser — it's money, and the client is not trustworthy for it. `refundFor`
   is deliberately pure with no React or browser dependency, so it can be
   lifted into the API as-is. Please don't reimplement it; two copies of refund
   arithmetic will disagree eventually, and the disagreement will be about
   someone's money.

2. **Store the policy on the booking at the time of booking.** A provider who
   changes their policy in March must not retroactively change what's owed on a
   booking made in January. Suggest stamping `cancellationPolicy` onto the
   booking when it's created, and having `refundFor` read *that*, not the
   current tenant setting. This is the one that's cheap now and horrible later.

3. **`reason` on cancel** (already asked for in §N) — now with a matching
   setting. A provider can turn the reason prompt off for themselves and,
   separately, for parents. `askReasonOperator` / `askReasonParent`.

4. **The policy needs to reach the storefront.** Same anonymous-read
   constraint: the wording is already denormalised onto the listing as
   `cancellation`, which is fine for display. But if parents ever see "you'd
   get £X back" before confirming a cancellation, the *bands* need to be on the
   listing too.

### §O update — policies are named, and picked per listing

Kaz's call: policies are written in Setup & features and **one is chosen per
listing** as it's built. A holiday camp and a weekly club rarely want the same
notice period.

Two consequences for you.

**5. The listing needs `cancellationPolicyId`.** The wizard already stores it
on the draft alongside the generated `cancellation` wording, but Zod strips
unknown keys so it never reaches Firestore. One line:
`cancellationPolicyId: z.string().max(40).optional()`.

**6. The booking needs the policy stamped on it — this is now the important
one.** A booking currently stores `listing` as a *name*, not an id, so there is
nothing to look a policy up by. The operator's cancel panel has to ask which
policy applies and default to the first, which is a guess dressed as a
question.

Stamping the resolved policy onto the booking at creation fixes both that and
the March-changes-January problem in one go. Inline copy rather than an id
reference — if a provider edits "Holiday camps" in March, a January booking
must keep January's terms, and an id would follow the edit.

### Also — who cancelled changes the answer

`refundFor` now takes an `initiator`. A **provider** cancelling refunds in full
whatever the notice bands say: the family did nothing wrong, and charging them
for a flooded venue is indefensible. The bands only apply to a family changing
their mind — **including when they ring up and the operator cancels for them**,
which is exactly why this can't be inferred from who is signed in.

The default is `"parent"` — the strict reading. A missing argument must never
silently authorise a full refund.

When you lift this server-side for parent self-cancel, that path is always
`"parent"`. Only an operator action can be provider-initiated, and only when
they say so.

### And auto-issue

There's now a `refundApproval` setting: `"review"` (today's behaviour — flag it,
provider actions it) or `"auto"`. Auto is marked as needing you and does
nothing yet; selecting it says so rather than pretending.

If you build it: **a refund cannot be un-sent.** Worth only auto-issuing where
the policy computed a clean answer — a dated session, a known amount, an
unambiguous band — and falling back to review for everything else. And never
for a provider-initiated cancellation of a whole session, where someone should
look at the list before a few thousand pounds goes out at once.

---

## P — A £0 booking is created "Unpaid"

`server/src/routes/my.ts:587`:

```ts
pay: onBehalf && placed ? "Invoice sent" : "Unpaid",
```

Nothing checks the total. So a **HAF-funded or free place is written as
`Unpaid`** and sits in the provider's unpaid filter forever, looking like money
is owed. Someone eventually chases a family for £0.

The fix is judged on the **total, not the method name** — a provider can call a
method anything, but a zero total is a zero total:

```ts
pay: total <= 0 ? "Funded" : onBehalf && placed ? "Invoice sent" : "Unpaid",
```

`"Funded"` already exists as a pay state — `payTone` styles it and `payLabel`
renders it as "Funded £0" — so nothing new is needed downstream. It's already
in the export filters too.

Worth checking the same rule anywhere else a payment status is set, and that a
£0 booking never triggers a payment-link email. I've done the operator-facing
half: the checkout no longer promises "Invoice sent · payment link" when the
total is zero, and says "Nothing to collect" instead.

I also added **"Free place"** to the default payment methods, which didn't
exist.

### While you're there — the two payment lists

Worth knowing they're deliberately different, because it looks like a bug:

- **Operators** pick from the provider's own list (Setup & features) — Card,
  Bank transfer, TFC, vouchers, HAF, Free place, Cash.
- **Parents** booking online get a fixed three: Card, Bank transfer, Cash on
  the day.

The parent's three are **payment rails, not labels** — "Card" routes to Stripe
and the others don't — so they can't be provider-renameable without breaking
where the money goes. If that ever needs to change, it should be a choice of
*which rails are offered*, never free text.

### §P — the free-ticket case, front end done

A listing can be genuinely free (a taster, a funded programme). What a parent
now sees when the total is £0:

- **No payment method at all.** Asking someone how they'd like to settle £0 is
  nonsense. They get "Nothing to pay &mdash; confirm it below and you're done."
- **The button says "Confirm booking"**, not "Confirm & pay £0.00".
- The operator side **keeps** the method picker even at £0, because "HAF" and
  "Free place" are how a funded place is recorded and reported on. Their
  button reads "Create booking &middot; nothing to collect".

All of it keys off the **grand total** &mdash; passes plus add-ons, after any
override &mdash; not the pass price. A free pass with a £5 t-shirt still has
£5 to collect, and my first cut of this got that wrong by checking the pass
total alone.

So the only thing left on your side is the status: a £0 booking must not be
written `Unpaid`, and must not trigger a payment-link email.

---

## Q — Childcare vouchers: pay elsewhere, reconcile here

Employer voucher schemes (Edenred, Computershare, Fideliti…) work nothing like
the card flow: **the parent pays on the scheme's own website**, days later, and
you match the money up by hand when it lands. Front end is built; three things
are yours.

**Tax-Free Childcare is deliberately not part of this.** It's HMRC rather than
an employer scheme, identified by an Ofsted number, and you have reconciliation
coming for it — so it stays its own payment method and I've kept it out of the
voucher list to avoid unpicking it later.

### What's built

- **Settings → Payments → Childcare vouchers.** The ten usual UK schemes,
  seeded by name and blank. Each holds a list of **labelled details** rather
  than one reference string, because schemes ask for different things — Sodexo
  wants a setting name, Computershare an account number, some an Ofsted number
  — and the labels are editable, since no fixed set covers them all. A scheme
  is only offered to parents once at least one detail is filled in: sending
  someone to Edenred with nothing to quote is worse than not offering it.
- **A hold period** (default 7 days), tenant-wide rather than per scheme:
  they all take about the same few working days, and the thing being protected
  is the place.
- **Checkout**: "Childcare vouchers" appears for parents only if at least one
  reference is set. Choosing it asks **which scheme they use** — their employer
  decides it, so they know — then shows that scheme's reference, the amount,
  and the hold period. There's a "mine isn't listed" escape.
- **`"Awaiting voucher payment"`** is styled (blue, distinct from Unpaid's
  amber), shortened to "Awaiting voucher" on badges, included in the unpaid
  filter and in the export's payment-state list.

### What I need from you

1. **Accept the pay state.** A voucher booking should be written
   `pay: "Awaiting voucher payment"`, not `"Unpaid"`. They need different
   actions from a provider — Unpaid means chase the parent, this means watch
   for a third party's money — and mixing them makes both lists useless.

2. **Store which scheme they picked.** `voucherScheme: z.string().max(60).optional()`
   on the booking. This is what makes manual reconciliation tractable: "£120
   arrived from Edenred" against forty pending bookings is a needle-in-a-
   haystack; filtered to the four who said Edenred, it's obvious.

3. **The email.** Booking ref, the scheme's name and reference, the amount, and
   the deadline. It must be **re-sendable from the booking** — this is exactly
   the email people lose, and the provider will be asked for it constantly.

### Decided: it flags, it never auto-cancels

Kaz's call, and the reasoning is worth keeping: **if a provider is a day late
reconciling a payment that did arrive, an automatic cancellation throws away a
family's booking because of the provider's admin.** So past the hold period the
booking is flagged for the provider to look at, and the decision stays theirs.

What you'd build: a way to surface bookings sitting on
`"Awaiting voucher payment"` past their pay-by date — a filter or a count on
the Bookings screen is plenty. No job that cancels anything.

4. **Store both dates on the booking.** `voucherSendBy` and `voucherReceiveBy`
   (ISO dates), computed at checkout by `voucherWindow()` in `lib/vouchers.ts`.
   Store rather than recompute: they'd drift the moment a provider changes a
   setting, and the parent was shown a specific date.

### The deadline is not just the hold period

Worth reading `lib/vouchers.ts` before touching this. A flat "held for 7 days"
is wrong twice over when a camp is close: a place can't be held past the day it
runs, and voucher money doesn't move fast enough anyway.

**There are two dates, not one**, and collapsing them was a bug I shipped first
time round: a camp starting the 10th with money that takes 3 days to clear told
the parent "pay by the 10th", so it would have landed after their child had
already been.

- **`receiveBy`** — when the money must be with the provider.
  `voucherDueByDays` sets it: by the start day, the day before, up to a week
  before. Several providers require payment before the child's first day, which
  is what this is for.
- **`sendBy`** — when the parent must send it: `receiveBy` minus the clearing
  time, and never later than the hold period. **This is the date the parent is
  shown**, because telling someone the arrival date when the money spends days
  in transit is telling them to be late.

It never prints a deadline in the past — an impossible window clamps to today
and reports too-close.

The pay-by date you store and chase against should be `sendBy`.
What happens when a booking starts sooner than `voucherClearDays` (default 3)
is the **provider's choice**, not a rule I baked in — `voucherWhenClose`:

- `hide` (default) — not offered, and the parent is told why rather than the
  option silently vanishing
- `warn` — offered with a caution to pay today, and that the place may not hold
- `approve` — offered, but the booking waits for the provider to accept it
- `normal` — no special handling

**Only `approve` needs you:** that booking should land as
`status: "Approval needed"` rather than confirmed. The other three are done.
The row says so on screen when it's selected.

35 assertions cover that, including the boundaries: exactly enough runway is
enough, a booking starting today is refused, and an offered window is never
shorter than a day. The same function should decide the email's deadline and
anything that chases.


### §Q — confirmed: voucher bookings DO reach the operator, but land as "Unpaid"

Traced end to end. A parent's voucher booking posts to `/api/my/bookings` like
any other, so it **does** appear in the operator's Bookings area. Two gaps, both
server-side:

1. **It lands as `pay: "Unpaid"`, not `"Awaiting voucher payment"`.** `my.ts:587`
   sets `pay: onBehalf && placed ? "Invoice sent" : "Unpaid"` — nothing looks at
   the method. So a voucher booking sits in the unpaid filter as if the parent
   owes money directly. Judge on the method: a `method` starting "Childcare
   voucher" → `"Awaiting voucher payment"`.

2. **The scheme.** The front end now folds the chosen scheme into the method
   string — the booking stores `method: "Childcare voucher — Edenred"` rather
   than a bare `"voucher"`, so it's at least reconcilable today. A dedicated
   `voucherScheme` field on the booking is still cleaner for filtering; the
   value is already in the method string to migrate from.

The button no longer says "Confirm & pay" for a voucher booking — they aren't
paying on our page — it says "Confirm booking".

---

# ⭐ CURRENT STATE — read this first (updated end of this session)

Everything below in §A–§Q is the running detail. This is the summary.

## What's landed on `main` and needs nothing from you
- Setup & features is a real screen (was a static mock). Five tabs: Child
  questions, Cancellations & refunds, New listing defaults, Payments,
  Childcare vouchers.
- Child questions, cancellation policies (with live refund arithmetic),
  scoped cancellation reasons, £0/free-ticket handling, and the whole voucher
  flow are all wired front-end.
- `PUT /api/library` bug fixed (was `.set()`, deleting any omitted key).
- `GET /api/public/library/:tenantId` added — parent-facing settings for the
  signed-out booking page (allowlist; leaks nothing operator-internal). This
  is the interim; folding these fields into `/api/listings/:id` is the proper
  home (see "anonymous read" below).

## What YOU still need to build — the whole list, ordered
1. **`answers` on the child record** — `z.record(z.string().max(2_000)).optional()`.
   Do NOT reuse the six typed fields (swimming enum etc.); answers key by
   question id. Unblocks provider-defined child questions. `careNotes` is now
   dead — drop it whenever.
2. **Voucher pay state** — a booking whose `method` starts "Childcare voucher"
   must be written `pay: "Awaiting voucher payment"`, not `"Unpaid"`
   (`my.ts:587` ignores the method today). Styling/filter/badge already built.
3. **£0 booking must not be "Unpaid"** — same line: a zero total → `"Funded"`
   (state already exists), and no payment-link email.
4. **Cancellation policy on the booking** — stamp the resolved policy (inline
   copy, not an id) at creation, so changing terms in March doesn't change what
   a January booking is owed. Also `cancellationPolicyId` on the listing draft
   schema (Zod strips it today).
5. **`reason` + `voucherScheme` on the booking** — `reason: z.string().max(120).optional()`
   for cancellations; the scheme is currently folded into the method string, a
   dedicated field is cleaner.
6. **Parent self-cancel runs `refundFor` server-side** — it's pure (no React),
   lift it as-is; don't reimplement refund arithmetic.
7. **Voucher hold flag** — surface bookings sitting on "Awaiting voucher
   payment" past their pay-by date (a filter/count). It FLAGS, never
   auto-cancels — Kaz's decision, so a late reconciliation doesn't bin a
   family's booking.
8. **Gender enum → string** — child schema is `z.enum(["boy","girl"])`; the
   shipped options include "Prefer not to say", which it rejects. Checkout
   stays on Boy/Girl until this changes.
9. **Multiple emergency contacts** — the setting goes to 4; the record holds
   one name/phone pair.
10. **Per-booking child answers (later)** — an every-booking question's answer
    currently overwrites the last one on the child. History needs an `answers`
    map on the booking too. Not urgent.

## The rule that keeps biting: anonymous read
The storefront is read with no token. Any setting that must affect the public
booking page has to be denormalised onto the listing (like categories already
are) OR served by the public library endpoint. Tenant settings alone only
reach signed-in screens. This caught the places-left threshold AND vouchers.

---

# N–Q answered — 21 July 2026 (Swagger v0.14.0)

**P — done.** £0 bookings are `Funded` (judged on the total, both parent and
operator paths), no payment-link email at £0. The onBehalf email drops its pay
button when there's nothing to pay.

**N — done.** Child records accept `answers` (map, question id → string) on
both `/api/my/children` and the operator `/api/customers/:id/children` write
(merged, blanks never wipe). `sex` is now `z.string().max(40)` — your custom
lists incl. "Prefer not to say" work. Cancel endpoints (parent + operator
action) accept `reason`, stored on `cancel.reason`. `careNotes` left in place,
unused — drop whenever. (Multiple emergency contacts / per-booking answer
history not built — say when you want them.)

**Q — done, the way you asked.** `POST /api/my/bookings` takes `voucherScheme`
(the scheme id — that's all your checkout needs to send; the server computes
the dates from the tenant voucher settings via your `voucherWindow`). Booking
gets `pay: "Awaiting voucher payment"`, `voucherScheme` (name), `voucherSendBy`,
`voucherReceiveBy`, and one instruction email (scheme references + deadline),
re-sendable via the `resend` action. It flags, never auto-cancels — the overdue
data (`pay` + `voucherReceiveBy`) is on every booking for your filter/count.

**O — done.** Parent self-cancel runs `refundFor` **server-side** from the
listing's `cancellationPolicyId` → tenant `settings.cancellationPolicies` (your
pure lib, lifted as-is, not reimplemented). The recommended refund + reason
land on `cancel.amount` / `cancel.msg`, pending the provider's approval — which
then refunds that figure via Stripe. Falls back to the default policy if a
listing's policy was deleted.

---

# Incidents & Accidents — 21 July 2026 (Swagger v0.15.0)

First of the "Pupils" safeguarding features. `/api/incidents` — one collection,
`kind: "accident" | "incident"`. An accident carries injury/treatment/first
aider; an incident carries type/action taken; both share date/time, child,
location, severity, witnesses, and `parentNotified`.

- **Staff can record** (it's their job on the ground, like registers) and read;
  **operators edit/delete** — a safeguarding record isn't something whoever's on
  shift can quietly change or remove. Parents can't see it (informed out of
  band; the record tracks that they were). Tenant-scoped, realtime `incidents`.
- A simple `IncidentsApp` (one component, `kind` prop) is registered on the
  `incidents` and `accidents` slugs across company/franchise/freelancer/staff.
  Restyle at will.
- `photoUrl` is on the record but the upload UI is yours — when Firebase
  Storage lands, incident photos get a proper access-controlled home (same as
  the SEND-plan story).

Next Pupils items when you want them: Medication, Meals & allergies, Moments.

---

# Medication — 21 July 2026 (Swagger v0.16.0)

Second Pupils safeguarding feature, and it's two records because real practice
is two things:

- **`/api/medications`** — an authorised medicine for a child WITH the parent's
  consent (dose, condition, schedule, storage, expiry, `consentGranted`). CRUD;
  staff record, operators manage.
- **`POST /api/medications/:id/administer`** — log a dose. **The gate: no dose
  without `consentGranted`** (and not archived) — enforced server-side, 409.
  Writes the MAR (who, when, dose, witnessed, notes).
- **`GET /api/medications/administrations`** — the MAR, filterable by
  date/child/medication.
- A medication with a dose history **can't be deleted** — archive it, so the
  MAR is never orphaned.

`MedicationApp` on the `medication` slug (all four operator/staff portals):
authorised meds per child, a "Record a dose" action (disabled without consent),
and the dose history. Restyle at will.

Pupils remaining: Meals & allergies, Moments. Moments (photo feed) really wants
Firebase Storage — worth enabling when you can.

---

# Meals & allergies — 21 July 2026 (Swagger v0.17.0)

Third Pupils feature. Two things that only matter together:

- **`GET /api/meals?date=`** — the day's menu AND the dietary board: each
  session's children with their allergies/dietary/medical (resolved from the
  child record via `childId`), plus an **`alerts`** array wherever a child's
  allergy matches an allergen tagged on the menu. Children with needs sort
  first; `summary` counts children/needs/alerts; the 14 UK allergens ship as
  `allergens`. The match is keyword-based (a child's `allergies` is free
  text) — flagged for staff to verify, never suppressed.
- **`PUT /api/meals/:date`** — operators set the menu (meals + allergen tags).
  Staff read the board; parents 403. Realtime `menus`.

`MealsApp` on the `meals` slug (all four operator/staff portals): date nav,
menu editor with allergen chips, and the dietary board with the alerts
highlighted red. Restyle at will.

**Pupils is now: Registers ✅ · Incidents & Accidents ✅ · Medication ✅ ·
Meals & allergies ✅ · Moments (needs Firebase Storage).** Enabling Storage is
the last thing between here and the photo/newsfeed layer.

---

# Moments — 21 July 2026 (Swagger v0.18.0) — Pupils COMPLETE

The photo feed, and it completes the Pupils section. Built on the existing
Firestore-backed image store (`/api/uploads` → `/api/images`) — no new storage
service, so nothing was blocked after all.

- **Photo consent is the gate.** A child is only taggable if their record has
  `photoConsent: true` — enforced on create and edit (409 naming them). The
  post UI fetches `GET /api/moments/taggable?date=` (today's booked, consented
  children), so a non-consented child is never even offered.
- `GET /api/moments` is role-aware: a parent sees moments featuring THEIR
  children (cross-provider); operators/staff see the tenant's.
- `MomentsApp` on the `moments` slug (operator/staff): upload + caption + tag +
  gallery. `ParentMomentsApp` on custdash `moments` ("My child's day"). Restyle
  at will.

**Pupils: Registers ✅ · Incidents & Accidents ✅ · Medication ✅ · Meals &
allergies ✅ · Moments ✅ — the whole section is done.** When you move to a
real object store (R2 / Firebase Storage) only `uploads.ts` changes; every
photo URL and consumer stays the same.
