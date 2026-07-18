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
