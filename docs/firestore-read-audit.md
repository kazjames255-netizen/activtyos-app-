# Firestore read audit (server)

Firestore bills per document read. This lists every whole-collection / N+1 read pattern found in `server/src`, ordered by estimated cost (reads per call x how often it runs). Line numbers are approximate (pre-edit). "Fixed" = change made in this pass; nothing was committed.

Sizing assumption: T tenants (~140+), U users, B bookings, L listings, K blocks, S supportThreads.

| # | Where | Collection(s) | Reads per call | Called from | Status |
|---|---|---|---|---|---|
| 1 | `routes/events.ts` (SSE) parent branch: `listen(listings)`, `listen(blocks)`, `listen(posts)`, `listen(mealOptions)` with no filter | listings, blocks, posts, mealOptions (all tenants) | whole collections once per connect (and per reconnect / page change), PLUS one read per changed doc per open connection | every parent tab, continuously | FIXED: shared listener per key (one Firestore listener per process, in-memory fan-out, 60s linger). `lib/sharedListeners.ts` |
| 2 | `routes/events.ts` SSE platform branch: tenants, bookings, listings, blocks, supportThreads, leads | whole collections | whole collections per HQ connect + every change x connections | every HQ tab | FIXED: same shared listeners |
| 3 | `routes/events.ts` SSE operator branch: ~45 tenant-scoped listeners per connection | tenant slice of each collection | full tenant slice of every watched collection per connect/reconnect, per user | every operator/staff tab, reconnects when the watched set changes | FIXED: shared per tenant (+franchise for bookings/milestoneProgress) with 60s linger. Parent per-user (email/uid) listeners left unshared (tiny result sets) |
| 4 | `routes/events.ts` keep-alive beat | users/{uid} | 1 read / 25s / open tab = ~3,456 per tab-day | every SSE connection | FIXED: account re-check every 4th beat (~100s); ":ping" still every 25s. Switch-off now closes a stream within ~100s instead of 25s |
| 5 | `routes/platform.ts` `/overview` (and `ai.ts` `platformSnapshot`, HQ AI chat) | tenants + bookings + listings + users | T+B+L+U | HQ dashboard load, each AI chat message | FIXED: `cachedCollection` (45s shared copy) |
| 6 | `routes/platform.ts` `/at-risk` (`computeAtRisk`) | tenants + bookings + libraries | T+B+T | HQ At-risk page + dashboard cards | FIXED: shared copy; `POST /at-risk/:id/contacted` invalidates `tenants` |
| 7 | `routes/platform.ts` `/analytics` | tenants + bookings + libraries | T+B+T | HQ analytics page | FIXED: shared copy |
| 8 | `routes/platformNotifications.ts` `buildItems` (HQ bell: GET /, POST /read, POST /dismiss) | tenants + supportThreads (+ small leads/tasks/deletionRequests) | T+S per call; the bell refreshes on load and on realtime pings | every HQ page | FIXED: shared 45s copy of tenants/supportThreads |
| 9 | `routes/platform.ts` `/subscriptions`, `/accounts`, `/providers` | tenants + users (+ libraries) | T+U(+T) | HQ billing / impersonation / providers pages | FIXED: shared copy (`/providers` keeps its own 60s cache; features PATCH clears libraries) |
| 10 | `routes/platform.ts` `/page-engagement` | pageViews (6 months, every view) | thousands | HQ engagement page | FIXED: 120s cache |
| 11 | `routes/platform.ts` `/churn` -> `lib/subscriptionEvents.ts churnByMonth` | subscriptionEvents (append-only, grows forever) + tenants | E+T | HQ analytics | FIXED: 120s cache by `months`; tenants via shared copy |
| 12 | `lib/octSends.ts scheduleReminders` (every 15 min) | rotas (all) + per rota: rotaShifts (whole season), users (staff) | R x (1 + season shifts + staff) x 96/day | sweep | FIXED: shifts limited to today/tomorrow (`date in [..]`, equality-only so no new index; reminder lead is <=24h so no shift is missed); staff lookup only when a shift is in range |
| 13 | `lib/sweeps.ts listingAutoExpire` (hourly) | blocks (all) + listings (all) | K+L x 24/day | sweep | FIXED: every 6h (accuracy-only sweep; Browse already hides ended listings) |
| 14 | `lib/sweeps.ts reviewRequests` (6-hourly) | bookings (all) | B x 4/day | sweep | FIXED: `where status == "Confirmed"` (the loop already skipped every other status) |
| 15 | `lib/sweeps.ts inventoryLowStock` (hourly) | inventory (all) | I x 24/day | sweep | FIXED: `where minQty > -1e15` drops null/missing reorder levels server-side (minQty is zod number-or-null) |
| 16 | `routes/platformSupport.ts` `/insights`, `/review` | supportThreads (all) | S each | HQ support analytics/review pages | FIXED: shared 45s copy. `GET /` (the live inbox, which also backfills tickets) deliberately NOT cached |
| 17 | `lib/sweeps.ts upcomingBlocks` in `sessionReminders` (30 min) and `dayOfAlerts` (10 min) | blocks with endDate >= today, then one bookings query per block with sessions in the window (N+1 via `blockBookingsLoader`) | K_future + sum(bookings of due blocks) x 48+144/day | sweep | NOT FIXED (recommendation): needs a denormalised "next session date" on blocks (or a `startDate <= horizon` composite index) so only blocks near today are read; a short TTL would barely help because the two sweeps run on different cadences |
| 18 | `lib/sweeps.ts subscriptionSync` (6-hourly) | tenants (all) | T x 4/day (+ Stripe calls) | sweep | NOT FIXED: acceptable; could filter on `subscription.stripeSubscriptionId` (needs index) |
| 19 | `lib/octSends.ts learningChasers` (6-hourly) | learningAssignments (all) + per doc: users, learningCompletions | A x (1 + staff + completions) x 4/day | sweep | NOT FIXED: add a `trackTraining` / has-assignments filter or run daily |
| 20 | `lib/sweeps.ts onboardingRetentionPurge` (daily) | onboardRecords (all) + users per tenant | O + tenants x 1/day | sweep | NOT FIXED: daily, acceptable |
| 21 | `lib/sweeps.ts medicationDue` (every minute) | medications (archived == false) | M x 1,440/day; bookings-per-tenant only inside a dose window | sweep | NOT FIXED: medications list is read every minute; recommend a 5-minute cadence (window is -5/+15 min) or an `at` time index |
| 22 | `lib/sweeps.ts` waitlist `expireOffers` (`lib/waitlist.ts:119`, 5 min) | bookings where status == "Offered" | small (filtered) | sweep | OK |
| 23 | `routes/tenants.ts` `GET /api/tenants` | tenants ordered | T | HQ only, rare | NOT FIXED: low frequency |
| 24 | `routes/providers.ts directory()` | tenants (limit) + `getAll` libraries | 2T | public directory | OK: already cached (`CACHE_MS`, in-flight dedupe, `getAll`) |
| 25 | `routes/events.ts` parent connect: `children`, `bookings` by email, `hubEnrolments` gets | per family | small | per connect | OK |
| 26 | `lib/monitor.ts` `opsHeartbeat` | opsHeartbeat | few docs | ops | OK |
| 27 | Seed/backfill/e2e-cleanup scripts (`seed*.ts`, `backfill*.ts`) | various | one-off | manual | OK (not served) |

## What was changed

- New `server/src/lib/ttlCache.ts` (TTL cache with in-flight de-dup, failures never cached, a `clear()` during a load discards the stale copy).
- New `server/src/lib/platformReads.ts`: `cachedCollection(name)` shares one 45s snapshot of a whole collection between HQ screens; `invalidateCollection(...)`. Platform-role routes only (global data, never tenant/role scoped, so no keying risk).
- New `server/src/lib/sharedListeners.ts`: ref-counted shared Firestore listeners for SSE; events carry only a collection name, and listeners are keyed by exact query identity (global / platform / tenant / tenant+franchise), so tenant isolation is unchanged.
- Edited: `routes/platform.ts`, `routes/ai.ts`, `routes/platformNotifications.ts`, `routes/platformSupport.ts`, `routes/events.ts`, `lib/subscriptionEvents.ts`, `lib/sweeps.ts`, `lib/octSends.ts`.
- Tests: `tests/read-cost-helpers.test.mts` (8 tests: TTL, de-dup, invalidation race, listener sharing, key isolation, linger, unsubscribe).

## Behaviour trade-offs to know about

- HQ pages (overview, accounts, subscriptions, at-risk, analytics, bell, support insights) can be up to 45s stale (page-engagement and churn 120s), same trade-off as the existing `/providers` cache. Explicit invalidation: features PATCH (libraries) and at-risk "contacted" (tenants).
- Cache is per API process; with several instances each keeps its own copy (still bounded).
- A switched-off account's open SSE stream now closes within ~100s (was 25s).
- Listing auto-expire status flips up to 6h later than before.
- Verify in production with `lib/readMeter.ts` (counts reads per route) before/after.
