# Franchise data isolation — backend handoff (Amir)

**Why:** A `role: "franchise"` account *belongs to* a company (head-office) tenant and must only ever see **its own area's** data. Today isolation is **partial**, so a franchise account currently sees the **whole tenant** (every location, every family, all money) — a privacy breach between franchisees (London seeing Manchester's families/money). The front-end now brands each franchise (business name + territory, e.g. "APF Activity Camps · London") but the wall underneath is not real yet.

## What already scopes by `franchiseId` (working)
- `bookings.ts` — read filter (`where franchiseId ==`, L193), per-doc visibility (L170), and tags `franchiseId` on booking **create** (L316) when the creator is a franchise.
- `reconciliation.ts` (L45) and `events.ts` dashboard bookings (L111-112) — same read filter.

### Booking→franchise ATTRIBUTION — fixed for split-fees (2026-09-03)
Root problem: a booking only carried a `franchiseId` when the franchise itself created it (`bookings.ts:316`), so HO/parent bookings on a franchise's listing were mis-attributed to "direct/HO" and the franchise was under-counted. **Fixed via listing ownership:** (1) a listing created by a franchise now stores `franchiseId` (`listings.ts` POST); (2) `splitfees.ts` resolves each booking's franchise as `booking.franchiseId ?? listingOwner[booking.listingId]` — so **every** booking on a franchise's listing (whoever made it) attributes correctly. STILL OWED: (a) **backfill** — listings created before this change have `franchiseId = null` (assign them); (b) an HO tool to **assign/reassign** a listing to a franchise; (c) propagate `franchiseId` onto the booking doc at write-time too (currently only franchise-created bookings get it) if you want it denormalised on the booking rather than resolved via the listing; (d) apply the same listing-ownership resolution to the READ-scoping below.

## The core gap: nothing defines a franchise's data *beyond bookings it created itself*
A franchise's `franchiseId` = its own uid (set on invite accept, `invites.ts` L149-153). But:
- **Listings have no `franchiseId`.** HO-created listings aren't owned by any franchise, so a franchise sees *all* listings (confirmed live — franchisetest saw every tenant listing). Bookings only get a `franchiseId` if the franchise account itself created them; HO/parent-created bookings on "a franchise's" listing are unscoped.
- **Customers / families, registers, medication, incidents, accidents, meals, moments, staff/team, and money (expenses/income/purchasing)** have **no** franchise filter at all.

## What's needed (proposed)
1. **A franchise ownership key on listings** — add `franchiseId` to listings; HO assigns a listing (or a location) to a franchise. Derive booking/customer/register/care scoping from the listing's `franchiseId` (not just who created the booking).
2. **Territory model** — a franchise's `franchiseArea` is currently just a label (stored on the user doc + `/api/me`). Promote to structured territory (postcodes/regions) so parent Browse routes families to the right franchise and two franchises can't sell into the same patch.
3. **Apply the read filter everywhere a franchise reads tenant data** — customers/families, registers, medication, incidents, accidents, meals, moments, staff, and the money routes — mirroring the `bookings.ts` scope helper. Middleware already exposes `req.auth.franchiseId`.
4. **Backfill / assignment tooling** — a way for HO to assign existing listings/locations/customers to a franchise (nothing is tagged today, so a freshly-scoped franchise would see *nothing* until data is assigned).

## Front-end already in place (this session, not pushed)
- `/api/me` returns `franchiseName`, `franchiseArea` (franchise) and `hasFranchises` (company). `Me` type updated (`lib/roles.ts`).
- Invite captures `franchiseName` + `franchiseArea` (`invites.ts` create schema + accept → user doc; Team invite UI).
- Sidebar badges the franchise identity; split-fees rows use the granted name/area; `splitfees` nav hidden for a company with no franchises.

**Until #1–#4 land, the franchise portal is cosmetically branded but data-wide-open.** Security/data-access = your domain.

## Territory MAP + enforcement (Kaz, 2026-09-03)
A franchise now draws its operating border(s) on a Leaflet/OSM map (`features/franchise/TerritoryMap.tsx`), stored on the user doc as `franchiseTerritory = { areas: [{ id, name, color, rings: {lat,lng}[] }], status: "draft"|"agreed" }` (points are OBJECTS — Firestore forbids nested arrays). Editable on the franchise **Onboarding info** page today; registration + HO-propose still to wire. This is currently a **recording/agreement tool only — it does NOT enforce anything yet.** Kaz asked: "if two franchises are close, does the map stop one creating listings outside its border / overlapping the other?" — not yet. To ENFORCE:
1. **Geocode listing venues** (`Venue.lat/lng` already exists) and run a **point-in-polygon** test against the franchise's `franchiseTerritory.areas` on listing/venue **create/edit** — block or warn when a service location falls outside the agreed border. (FE can warn; server must be the authoritative gate.)
2. **Prevent overlapping territories** between franchises of the same head office — validate polygon intersection when a territory is agreed/changed, so two nearby franchises can't claim the same patch.
3. **Route parent Browse/booking by location** — a family's postcode → which franchise's territory contains it → show that franchise's listings (ties to the territory model in #2 above).
4. HO-side: let the head office **propose/approve** a franchise's territory (two-sided agreement); today `status` is a single flag the franchise sets.

### Built this session (front-end + light backend; enforcement still Amir's)
- **Agreement is HO-only:** a franchise can draw/propose (`status` coerced to `proposed`/`draft` server-side in `account.ts` PUT) but **can never self-mark `agreed`** — only the head office can. The HO-side approve action + surface is NOT built yet (owed).
- **Territory is OPTIONAL:** no border set → no restriction; the franchise can create listings anywhere (encouraged, not forced).
- **Listing-venue warning (FE only):** `features/franchise/TerritoryVenueWarning.tsx` warns in the listing wizard when a franchise picks a venue outside its territory (point-in-polygon, `lib/geo.ts`). **This is a nudge — a franchise can ignore it; the authoritative block MUST be server-side** (reject/flag a listing whose venue falls outside the agreed territory).
- **HO all-territories map:** `GET /api/franchises` (company-only, `server/src/routes/franchises.ts`) returns every franchise + territory; `FranchiseTerritoriesApp` renders them on one UK map with a legend + **approximate overlap detection** (`areasOverlap` in `lib/geo.ts` — vertex-in-polygon + edge-crossing). **Overlap PREVENTION is not enforced** — the FE only *warns*; the server must reject/flag a proposed territory that intersects another franchise's when the HO agrees it (robust polygon intersection, e.g. turf.js). Points stored as `{lat,lng}` objects (Firestore forbids nested arrays).
