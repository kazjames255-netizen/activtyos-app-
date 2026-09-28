# Why the hub sometimes takes 10-25 seconds to load (28 Sep investigation)

**Symptom.** A page sits on "Loading…" for 10-25 s. Measured in the browser: `/api/me` 25 s, `/api/subscription/access` 24 s, `/api/rota` 21 s, all on the same page load.

**What the API log shows** (`scratch/api.log`):
- Even tiny reads are slow while big rebuilds run: `roster|<tenant> loaded in 22.2s (8 rows)`, `topics|<tenant> loaded in 7.1s`.
- The big indexes are rebuilt over and over: `questions` (93,713 rows) 60-300 s, `cards` (51,873) 20-28 s, `notes` (7,893) 49-57 s, `assessments` (9,049) 36-255 s. The snapshot files in `$TMPDIR/aos-hub-cache-<uid>/` were rewritten at 16:40, 16:49, 16:58, 17:00 and 17:02, so a full rebuild happened roughly every few minutes.
- An idle API sits near 2% CPU, so the slowness is contention while rebuilds run, not a steady cost.

**Likely causes (in order of confidence):**
1. **Rebuilds are triggered continuously.** `forgetHub(tenant)` with no kinds drops every kind AND deletes the disk snapshots (`server/src/lib/hubCache.ts`). Any write route that calls it (roster, topics, notes edits, which e2e runs do constantly) forces a full rescan of the tenant and, on a cold miss, makes the request wait for it.
2. **Rebuilds run in parallel and starve everything else.** Several tenants x several kinds are rebuilt at once on one Node process and one Firestore channel, so a small `users/<uid>` read in the auth middleware waits behind them. That is why `/api/me` (which does no hub work) is slow.
3. **Every API restart starts all of this at once.** Each restart empties memory; only the disk snapshots soften it, and (1) deletes them.
4. **e2e runs share this API and database with a person using the app.** Their writes invalidate the caches the person is waiting on.

**Fixes to schedule** (server changes; none applied):
- Cap concurrent big-index rebuilds (for example 1-2 at a time) and yield to the event loop between batches, so auth and small reads are never queued behind a scan.
- Make `forgetHub` narrower: a roster edit should not delete the questions / cards / notes snapshots or force their rebuild. Prefer `patchHub` for in-place edits.
- Warm the big indexes in the background at startup from the snapshots and never block a request on a rebuild (the request path already does this when a snapshot exists; the delete in `forgetHub` breaks it).
- Keep e2e off the API a person is using: run it against its own API port and Firestore project or emulator.
- Avoid restarting the API during working hours; when it must restart, do it once per batch of changes.
