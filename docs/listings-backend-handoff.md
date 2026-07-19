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

*Updated after your 19 July push. **#1 below is now done** — I've left it in
struck through rather than deleting it, so the ordering still makes sense.*

### ~~1. Book on someone else's behalf~~ — **done, thank you**
`onBehalfOf` landed exactly as hoped: one pricing path, existing accounts
reused by uid, no password ever emailed, no child data in the email. I'll point
Confirm at it and both screens start writing — that's my next job, not yours.

Two small things I'll check when I wire it, not asks: the operator screen sends
one call per block for a multi-week basket, and I'll make sure the new-family
fields it already collects (name, email, phone) map onto your
`onBehalfOf {name, email, phone}` shape rather than needing a customer first.

### 2. `childId` on each booking item  *(now the biggest single unblock)*
Bookings carry `child` as a name and nothing else. With the id, a register can
show the child's **photo**, **allergies**, **SEND plan** and **collection
password** from one lookup. Without it, none of them can be shown safely —
matching by name would eventually put one family's collection password against
another family's child. (§I, §J)

### ~~Create a family's account from a phone booking~~ — **done in the same push**
`admin.auth().createUser` + a set-password link. Three things I'd insist on:
**if the email already has an account, use it** (families exist across
providers); **never email a password**; and the operator keeps no access
afterwards. I've built the same thing for the Families page already —
`POST /api/customers/:id/invite` — so there's a working shape to copy. (§H)

### 3. `GET /api/customers/:id/family`
The parent plus their children's **full** records, for an operator whose tenant
that family has actually booked with. That clause is the security model. It
unlocks the whole Parents/Child-profiles design; I can build both tabs against
it front-end with nothing else from you. (§K)

### 4. Extra fields on a child
Emergency contact, dietary (separate from allergies), swimming ability, care &
behaviour notes, and consents for suncream, first aid and walking home.
*Not wanted:* authorised collectors, GP/surgery/NHS number. (§K)

### 5. File storage for SEND plans
Currently chunked across Firestore documents because there's no bucket —
works, capped at 15MB, but it's a workaround. When Storage is enabled only
`routes/childFiles.ts` changes. (§F)

### 6. Marketing plumbing
An unsubscribe link that works from the email without a login (needs a signed
token — I can't sign anything client-side), and a tenant-level suppression list
so an unsubscribe survives a record being rebuilt by a later booking. (§L)

---

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
