# Firestore cost — what costs money, how to see it, how it's kept low

Google Cloud project **activityos-bef89** · billing account **"Firebase Payment" 01209D-B03EB9-1F56F4** (no organisation) ·
budget alert **"Monthly cost guard"**: £30/month, emails at 50% (£15), 90% (£27), 100% (£30) to billing admins and users (alerts only — it never switches anything off).

## What the September 2026 bill was (1–27 Sept: £82.56)

| Line (Billing → Reports → group by SKU) | Amount | Cost | What it means |
|---|---|---|---|
| Cloud Firestore Read Ops | 137,657,817 | £60.17 | one per document read, **including documents read by a query that a user never sees** |
| Firestore Internet Data Transfer Out (Europe) | 154 GiB | £12.75 | bytes of those documents leaving Google to a server that isn't on Google (a laptop, Railway…) |
| Firestore Clone (named databases) | 17 GiB | £5.01 | the one-off restore rehearsal on 26 Sept |
| Firestore Entity Writes | 2.76 M | £3.21 | |
| Storage, PITR, backups, Cloud Storage ops | | ≈ £1.50 | |

Reads are ≈ £0.044 per 100,000. **The big collections** (document counts on 28 Sept): `hubQuestions` 451 k, `hubFlashcards` 205 k, `leads` 72 k,
`hubAssessments` 43 k, `hubNotes` 31 k, `hubTopics` 9 k. Everything else (bookings 322, tenants 319, tasks 111, incidents 15 …) is tiny.
**One full re-read of the hub indexes ≈ 500 k documents ≈ £0.22. One re-read of the leads list = 71.7 k ≈ £0.03.** Cost is repeats × size.

## Where the repeats came from (found 28 Sept 2026)

1. **Hub index rebuilds.** Questions / flashcards / notes / assessments / topics are cached in memory + a disk snapshot per tenant and for the shared library.
   (a) A snapshot was always treated as expired, so *every* restart re-read everything (33 restarts in one day, each ≈ 500 k) — fixed in `3f3f1aae`.
   (b) The live TTL was **20 minutes** with background refresh, so any API process in use re-read ≈ 500 k docs ≈ 3× an hour (≈ 1.5 M reads/h ≈ £0.65/h).
   Now `HUB_INDEX_TTL_MIN` defaults to **360** (6 h). Writes made through the API patch/forget the cache themselves; only writes that bypass the API
   (Admin-SDK seed/import scripts) are not seen until the 6 h TTL passes, an API restart with no snapshot, or `POST /api/learning-hub/notes/index-refresh`
   (`server/src/oak/refreshNotesIndex.ts` does that call — use it at the end of any bulk script that writes hub notes/questions/cards).
2. **Leads list.** `routes/leads.ts` re-read all ~72 k leads whenever the page was requested more than **3 minutes** after the last read (and at every
   boot with a copy older than 3 min). ≈ 1.4 M reads/h while the Leads/sales page was open. Now `LEADS_FRESH_MIN` defaults to **60**, `?fresh=1` still forces a read,
   and with `LOW_COST_DEV=1` boot never re-reads at all (the on-disk copy is served; the first request after 60 min refreshes).
3. **Restarts by agents/watch mode** multiplied both.
4. Not a problem by the code audit below (sizes from collection counts; the meter confirms the sweep claims and hub routes): the scheduler sweeps (they read collections of a few hundred docs),
   the SSE listeners (big hub collections are "ping" channels), the platform/HQ pages (≈ 1.7 k reads per load).

## The read meter

`server/src/lib/readMeter.ts` patches the Admin SDK's read calls (Query.get / stream / onSnapshot, DocumentReference.get / onSnapshot, Transaction.get, getAll).
Every read is counted against a **label**: `http:GET /api/learning-hub/notes` (ids collapse to `:id`), `sweep:<name>` and `sweep:<name>:claim`, `cache:<kind>|<tenant>`,
or `unattributed:<file>:<line>` (the server source line that caused it). Counting `count()` aggregates is deliberately excluded (billed per 1000 index entries).

* **Live totals:** `curl localhost:4000/internal/read-stats?top=30`. Access (defined in `server/src/index.ts`, tested by `scratch/rs-access-test.sh`): with `READ_STATS_KEY` set the request must carry a matching
  `x-read-stats-key` header (constant-time compare); **in production the key is required** (no key → 404); without a key, outside production, only loopback callers without an `x-forwarded-for` header are served. `&reset=1` zeroes the counters.
  `scratch/rs.sh 4000 20` prints it as a table (reads, calls, label).
* **Log:** one line every 10 min (`READ_METER_LOG_MIN`), on shutdown and whenever the budget trips → `scratch/read-meter.log`.
* **Off:** `READ_METER=0`. Overhead is one map increment per read call.
* Only the process it runs in is counted — an API on Railway needs its own look (`READ_STATS_KEY` + the URL).

## Safety rails

* `LOW_COST_DEV=1` — the default whenever `NODE_ENV` is not `production` (set `LOW_COST_DEV=0` to opt out): no background re-read of the leads list at boot.
* `HUB_READ_BUDGET_PER_HOUR` (default **500,000**) — when this process has read more than that in the last 60 minutes it **logs loudly** (`[read-budget] …`, at most once per 10 min, with the top 3 labels) and
  **skips non-essential refreshes**: the hub index background (stale-while-revalidate) refresh and the leads refresh. Reads a user is actively waiting for (a missing index, `?fresh=1`) are never blocked.
* `HUB_INDEX_TTL_MIN` (360), `LEADS_FRESH_MIN` (60): the two TTLs above.
* `HUB_SNAPSHOT_TRUST_MIN` (30): an index read back from its disk snapshot is trusted as fresh for at most this long after the snapshot was written; an older one is served at once and re-read once in the background.
  So a restart within 30 min of the last build costs **0 reads**, and writes made behind the API's back (Admin-SDK scripts, another instance) while it was down show up within ~30 min of a restart instead of waiting out the 6 h TTL.
* **Don't run the API in watch mode while several people/agents edit** (every save restarts it); use `npm run start` in `server/` and restart by hand once per batch. Restarts are cheap now (disk snapshots, no re-read within the TTL).
* Keep scans off the live project: `scratch/`, `.unlazy/slide-qa/` runners and `server/src/oak/*` bulk scripts read the real database. None runs automatically (checked: no cron, no launchd job, no scheduled process).

## Audit of everything that reads Firestore on a timer or on connect (documents per run)

| Source | Interval / trigger | Docs per run | ≈ per hour |
|---|---|---|---|
| `sweep:*:claim` (13 sweeps) | every ≤ 60 s each | 1 | ≤ 800 |
| calendar-reminders | 60 s | today's calendarEvents (6 total) | < 400 |
| medication-due | 60 s | medications (9) + bookings of those tenants | < 5 k |
| task-reminders | 5 min | open tasks (≤ 111) | < 1.4 k |
| ack-chase / safeguarding-reviews | 30 min | incidents (15) | < 60 |
| session-reminders / day-of-alerts | 30 / 10 min | blocks with endDate ≥ today (≤ 325) + their bookings | < 4 k |
| review-requests | 6 h | **all bookings (322)** | < 60 |
| subscription-sync | 6 h | **all tenants (319)** | < 60 |
| SSE `/api/events` | per connection, per reconnect | initial snapshot of each small watched collection (bookings/children/listings/blocks/posts… ≈ 1 k); hub big collections are ping docs (1) | 1 k × reconnects |
| HQ / platform / ai routes | per page load | tenants + bookings + users + libraries ≈ 1.7 k | on demand |
| hub indexes | TTL 6 h (was 20 min), restart within TTL: 0 | ≈ 500 k for all kinds/tenants | ≈ 80 k/h averaged (was 1.5 M/h) |
| leads list | 60 min (was 3 min), `?fresh=1` | 71.7 k | ≈ 72 k/h at most while the page is used (was 1.4 M/h) |

## What to check, and when

* **Daily, 30 seconds:** Google Cloud → Billing → *Firebase Payment* → Reports → group by SKU. The "Cloud Firestore Read Ops" bar for yesterday should be **under about 1 M reads (£0.45)**; the daily bar under **£1**.
  If a day is above £3, run `scratch/rs.sh 4000 20` and look at the top label; the log `scratch/read-meter.log` shows the same by 10-minute slice.
* The **£30 budget alert** emails you on its own. Costs lag up to 24 h in the console.
* After any change that touches caches, sweeps or startup: restart once, run a few page loads, look at `read-stats` — idle should be ≈ 800 reads/hour (just the sweep claims).

## Measurements

See "Measurements" at the end of this file.

## Measurements (28 Sept 2026, dev API on port 4002, real project, read-only)

**After** (this change set; 25 minutes, one throwaway e2e freelancer calling the hub's nine common read routes six times each, sweeps running, disk snapshots warm):

| Label | Reads | Calls |
|---|---|---|
| `http:GET /api/learning-hub/homework` | 738 | 24 |
| `http:GET /api/learning-hub/lessons` | 270 | 12 |
| `http:GET /api/learning-hub/groups` | 48 | 12 |
| `http:GET /api/me` | 30 | 30 |
| `cache:mastery|<tenant>|overview` | 29 | 6 |
| `http:GET /api/learning-hub/topics` | 24 | 24 |
| `sweep:*:claim` (13 sweeps, ≈ 18 each) | ≈ 230 | |
| everything else | ≈ 90 | |
| **Total** | **1,264 in 25 min ≈ 3,000/hour under load; ≈ 800/hour idle (the sweep claims)** | |

Start-up: `[hub-cache] warmed 25 snapshot(s) from disk in 0.9s`, **0 Firestore reads** for the big indexes. The three heaviest routes are `/homework` (≈ 31 reads per call), `/lessons` (≈ 22) and `/groups` (≈ 4) — worth trimming later, but 1,000 reads is £0.0004.

**Before** (not re-run — re-running it costs real money — but derived from the code paths and the row counts logged by the API, `[hub-cache] … loaded`):

| Source | Before | After |
|---|---|---|
| hub index rebuilds while the API is in use (questions ≈ 93 k shared + ≈ 98 k per tenant, cards ≈ 51 k, notes, assessments, topics) | ≈ 500 k per 20 min ≈ **1.5 M reads/h** | 0 within 6 h; ≈ 500 k per 6 h ≈ **80 k/h** at most |
| leads page open | 71.7 k per 3 min ≈ **1.4 M reads/h** | 71.7 k per 60 min ≈ **72 k/h** at most; 0 at boot |
| each API restart | ≈ 500 k (33 restarts on 28 Sept alone ≈ 16 M) | 0 (snapshot < 30 min old) or one background re-read |
| sweeps, SSE, HQ pages | ≈ 1–5 k/h | unchanged (they were never the problem) |

At £0.044 per 100 k reads, the September pattern (≈ 137 M reads) is what an API process re-reading ≈ 1.5–3 M docs an hour for ≈ 60–90 hours would do; the daily bars (£2–8, £20 on 26 Sept) agree.
**Expected from now:** a normal working day well under 1 M reads (< £0.45). Check the daily bar tomorrow.

## Still open

* The API on `:4000` runs the pre-change code until it is restarted once (restarts are now free — 0 reads).
* Any API deployed elsewhere (Railway…) has the OLD code and the old 20-min/3-min loops. Deploy this branch there, and set `READ_STATS_KEY` so `/internal/read-stats` works.
* Not measured: the deployed API, the browser side. `/api/learning-hub/homework` and `/lessons` are the next routes to slim if the meter ever shows them on top.
