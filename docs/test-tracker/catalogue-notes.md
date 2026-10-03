# Test tracker catalogue: notes (2 Oct 2026)

Files: `lib/testTracker/catalogue.ts` (345 checks), `scripts/testTracker/verifyCatalogue.ts`. No app code or types.ts changed.
Run: `server/node_modules/.bin/tsx scripts/testTracker/verifyCatalogue.ts --structure|--coverage|--selftest`.
Plain `npx tsx` from the repo root fails on this Mac (the npx cache holds an x64 esbuild); the server's tsx works. G1-G3 should use the server binary.

## How the lists were derived
The verifier reads the real files and extracts: pay methods (lib/settings.ts DEFAULT_SETTINGS + checkout.tsx rails), listing enums
(server/src/routes/listings.ts: bookingType, deliveryMode, coverage mode, visibility, capacityScope, blockMode, waitlistMode, status),
wizard draft + ticket override fields, pass rules, add-on kinds, auto-discount kinds/methods (features/listings/discounts.ts), code types,
code settings and flags (server/src/routes/discounts.ts, server/src/lib/discountCodes.ts), membership benefit types, referral type/settings,
cancellation policies, refund states/destinations (features/bookings/types.ts), booking and pay statuses, amend/refund settings and cancel reasons
(lib/settings.ts), child-question types and settings, TFC failure kinds, booking actions and routes (bookings.ts, my.ts), bookings list tabs,
embed.js options, entry points (/book, /store, Book for a customer, Take a booking, Quick book, QR, Link, Embed, View as parent), portals and roles.
239 options. Each must appear (case-insensitive substring of title/setup/steps/expected) via its plain-English phrasing in the ALIASES map in the script;
an option with no alias falls back to its raw code value, so a new option in the code is reported as uncovered. Per-group sources: run `--coverage --sources`.

## EXCLUDED (lead to review)
- pay-method "Free place": filtered out of every tenant list in lib/settings.ts; legacy.
- add-on kind "bundle": retired, behaves as "once" (comment in FreelancerListingsApp.tsx).
- POST /api/bookings (bookings.ts createSchema): no UI calls it; provider bookings use onBehalfOf on /api/my/bookings.
- code settings code/type/value/assignedName/active; child-question maxLength/help/replaces/options; listing sitePhone/staffIds: cosmetic or covered elsewhere.
- POST /providers/follow (not a booking scenario); embed marker data-activityos-mounted (internal); bookings tab "all".

## Could not determine from the code
- "Head office pushes listings to franchises": no such mechanism found; each listing is owned by head office or one franchise (LT-033 records the result).
- Add days to a booking, add/swap a child, move to another listing: no such actions exist (AM-015 to AM-018 record what happens).
- Dashboard income/bookings/families definitions: not read; FD checks say "verify". Quick book when a date is full (BQ-010) and the Blocks builder UI labels: not confirmed.
- Whether a listing's own payMethods are enforced by the server at booking (LT-034 marked verify).

## Suspected bugs found by reading (verify before fixing)
1. server/src/routes/my.ts:1272 per-child code ("A discount per attendee") multiplies by `amounts.length` (child x pass lines), not distinct children; one child on two passes gets it twice.
2. my.ts:1274 several codes add their amounts (10% + 20% = 30%, not compounded); a 50% + 50% pair makes the pass free. May be intended but surprising (DI-022).
3. my.ts:2042 /amend only checks allowDateChanges; amendNoticeHours, amendLimit, amendFee, amendAllowCheaper, amendSelfService are shown in Setup/UI but not enforced server-side (AM-011, AM-012).
4. features/listings/checkout.tsx:716 + my.ts:1613 a parent can pick "HAF (funded £0)" but nothing sets the price to £0, so it books at full price with Unpaid status (PY-018).
5. server/src/routes/splitfees.ts:20,99 royalty revenue uses booking `amount` for every status except Cancelled/Declined/Waitlisted, so unpaid, Approval needed and Offered count, and partial refunds never reduce it (FD-020 to FD-022, CN-036).
6. server/src/routes/memberships.ts:14 joining a tier delivers the credit/percent perk but takes no payment ("no recurring charge yet"); the tier price may never be charged (DI-036).
7. server/src/routes/referral.ts:171 the "cap to friend spend" only applies to percent rewards; an amount reward is never capped (DI-032).
8. my.ts cancel route (about line 2434) never credits the wallet for the "credit note when no cash refund is due" setting although the parent page promises it; Setup says "needs building" (CN-004).
9. lib/cancellation.ts:203 notice is measured from 00:00 UTC of the first session date, not UK time or the session start; borderline refunds can land a band early or late.
10. Wallet release of a single day (p7bk detailWallet) is full value with no notice deadline, so a family can dodge the no-refund window by releasing days to wallet (design check, CN-021).

## Needs from the lead
- types.ts has no need to change. If the page wants a "Claude verifies" flag per check, claudeCheck text already says "verify" where unsure.
