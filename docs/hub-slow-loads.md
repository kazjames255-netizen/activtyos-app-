# Why the hub sometimes took 10-25 seconds to load (28 Sep) — cause, fix, numbers

**Symptom.** A page sat on "Loading…" for 10-25 s. Measured in the browser: `/api/me` 25 s, `/api/subscription/access` 24 s, `/api/rota` 21 s on the same page load.

## What it really was (measured, not guessed)

Every big hub index (questions 97k, cards 52k, notes 7.9k, assessments 9k, topics 2.4k — for each tenant AND the shared library) is a sharded Firestore scan: `shardedTenantRead` opens **8 parallel streams**. After an **API restart** the old code:

1. seeded every disk snapshot as "already expired" (`at: 0`), so the first read of each kind started a **full rebuild in the background even if the snapshot was 2 minutes old**;
2. started all of those rebuilds **at once** (2 tenants × 5 kinds + the shared library ≈ 50-100 streams on one gRPC channel), so a 1-document read (what `/api/me`'s auth lookup does) queued behind them;
3. wrote each finished snapshot with a synchronous `JSON.stringify` of up to 43 MB, back to back.

So the trigger is **restarts** (33 API restarts on 28 Sep, mostly from `tsx watch` reloading on every server edit by parallel agents, plus manual ones), not writes: the earlier suspicion that write routes call `forgetHub(tenant)` on every edit was wrong — every route already names a narrow kind, and only two rare paths touch the big kinds (`POST /notes/index-refresh` without ids, an admin/script path; and deleting a question that drafts still list). Event-loop lag was never the problem (p95 2 ms); it is Firestore stream contention.

## What changed

| # | Change | Where |
|---|---|---|
| 1 | A snapshot is seeded with **its own age** (file mtime), not 0. Younger than the 20 min TTL → served as-is, **no rebuild**. Older → served now, rebuilt in the background. | `server/src/lib/hubCache.ts` |
| 2 | **Rebuild limiter**: at most 2 big loads at once (`HUB_CACHE_BIG_LOADS`), FIFO; a *blocking* load (nothing to serve) jumps ahead of queued background refreshes; background refreshes may hold only 1 slot; each yields to the event loop before starting. | `hubCache.ts` (`withBigSlot`) |
| 3 | Snapshot writes are **serialised, deferred ~1.5 s, and skipped when a snapshot <5 min old exists**. | `hubCache.ts` (`scheduleDiskWrite`) |
| 4 | **Startup warm-up**: after `listen`, every valid on-disk snapshot is loaded into memory one file at a time (yielding between files, header sniffed before parsing) — no Firestore reads. Also pre-warms the token-verification cert fetch and the first Firestore round trip (the first request used to pay ~5 s). | `hubCache.ts` (`warmHubCacheFromDisk`), `server/src/index.ts` |
| 5 | Deleting a question patches the affected **draft assessments in place** (`patchAssessmentFields`) instead of `forgetHub("assessments")` (which dropped the whole index + its snapshot). | `hubIndex.ts`, `routes/hub/questions.ts` |
| 6 | **Isolated e2e stack** so the suite's writes/restarts never touch the API a person is using: web `:3001` → API `:4001`, own build dir `.next-test`. | see below |

Selftest: `server/node_modules/.bin/tsx server/src/lib/hubCache.selftest.ts` (16 checks: snapshot write/patch/forget, cap of 2, blocking-before-background priority, background ≤1 slot, warm-up). It caught a real bug in the first limiter draft (one `pump()` woke every waiter, so the cap did not hold) — fixed before this shipped.

## Numbers (same machine, real tenants read-only, `server/src/hubCacheBench.ts`)

`hubCacheBench` = a fresh process asking for every big index of a real tenant + the e2e tenant, like the first paint after a restart, then measuring a **1-document Firestore read** (what `/api/me` does) for 100 s while rebuilds run.

| | 1-doc read p50 | p95 | max | background rebuilds in 100 s |
|---|---|---|---|---|
| BEFORE | 675 ms | 1,271 ms | 2,119 ms | 7 (topics of a tenant took 39.6 s for 2,457 rows) |
| AFTER (limiter + snapshot age) | 176 ms | 283 ms | 8,292 ms (one stray sample, cause not found; event-loop lag was 544 ms, so it is a Firestore-side stall) | 2 |
| AFTER, snapshots still fresh (restart within 20 min) | 169 ms | 293 ms | 1,661 ms | **0** |

`scripts/measure-hub.mjs` (as the throwaway e2e freelancer, first paint after a fresh start of the API):

| | first `/api/me` | first `/api/rota` | storm: `/api/me` p50 / p95 |
|---|---|---|---|
| BEFORE (fresh :4002) | 5,833 ms | 545 ms | 650 / 1,170 ms |
| AFTER + pre-warm (:4001) | 1,979 ms | 599 ms | 477 / 622 ms |

Caveat: the 25 s Kaz saw came with 8+ rebuilds and an e2e run going at the same time; that exact pile-up was not re-created, only its cause (parallel scans starving a 1-doc read) and the fix's effect on it. The e2e freelancer tenant does not read the shared library indexes, so `measure-hub` under-represents them; `hubCacheBench` covers them.

## Using the isolated e2e stack

```
npm run dev:test                 # web :3001 -> API :4001 (own .next-test build dir, own hub cache)
E2E_STACK=test bash scripts/e2e-locked.sh e2e/<spec>.spec.ts --reporter=line
```

`E2E_STACK=test` makes the run use `E2E_BASE_URL=:3001`, `NEXT_PUBLIC_API_URL=:4001` and `E2E_AUTH_DIR=e2e/.auth-test` (create it once with `E2E_STACK=test E2E_CMD="npx playwright test --project=setup" bash scripts/e2e-locked.sh`). The browser and the helpers both talk to :4001, so the API a person uses on :4000 never sees the suite's writes or restarts. The standing test tenants and their data are still shared through Firestore, hence the lock. **Not yet verified end to end**: the 3001 bundle was confirmed to point at :4001 and the stack starts, but no Playwright spec has been run on it (the lock was held by another run).

## Still open

- The running API on `:4000` only gets these changes after ONE restart (it is not in watch mode). Restart it once per batch of server changes, not per edit.
- The hub still takes ~5 min to rebuild everything from Firestore if there are **no snapshots** (first ever start, or `$TMPDIR/aos-hub-cache-<uid>` cleared); now they no longer hold up small requests.
- `mapMerge` (`hubIndex.ts`) builds a new 93k-entry Map for every non-owner tenant on every index call; not measured as a bottleneck here, worth memoising if profiling ever points at it.
