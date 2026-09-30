# Firestore composite index audit

Audit of every Firestore query in `server/src/` against `firestore.indexes.json`, run by `scripts/overnight30/index-audit.mjs` (static analysis only; no Firestore was queried).

Result: `index audit: 737 queries scanned, 0 missing`. No index had to be added.

## Method

`node scripts/overnight30/index-audit.mjs` (add `--all` to list every query, `--selftest` for the negative control).

1. Scans `server/src/**/*.ts`/`.mts`, skipping `*test*`, `*selftest*`, scratch, `oak/`, `data/` and `curriculum/`. Comments are stripped, then every method chain containing `.where(...)` or `.orderBy(...)` is parsed (balanced parentheses, multi-line chains included).
2. The collection is resolved from `.collection("x")` / `.collectionGroup("x")`, from helper functions such as `msgCol()` in `server/src/routes/emails.ts`, or from `const x = db.collection("y")` aliases. Variable-built queries (`let q = col; q = q.where(...)`, as in `server/src/routes/bookings.ts` and `server/src/routes/hub/attempts.ts`) are accumulated: every earlier `where` assigned to the same variable is unioned, which over-approximates conditional branches (conservative).
3. Rule for the required index (Firestore's documented behaviour): equality fields (`==`, `in`) first in any order, then range/inequality fields (`<`, `<=`, `>`, `>=`, `!=`, `not-in`), then `orderBy` fields in order; an `orderBy` on a field that also has an equality filter is ignored; `orderBy(documentId())` is treated as free. Equality-only queries and single-field queries need no composite index (Firestore merges single-field indexes). `array-contains` plus a range or `orderBy` is treated as needing a composite index.
4. A declared index satisfies a query only on an exact match: same collection id, compatible scope (a `collectionGroup()` query needs `COLLECTION_GROUP` scope, a collection query accepts `COLLECTION`), the first N declared fields are exactly the equality set, and the remainder equal the required ordered list with directions matching, or all directions inverted (Firestore can scan an index backwards). A longer (superset) index is NOT accepted as satisfying a shorter query. A trailing `__name__` is ignored.
5. Output: one line per query that is not trivially equality-only (`file:line collection where[...] orderBy[...] -> status`), then `index audit: N queries scanned, M missing`. Seed/backfill/e2e scripts are tagged `(dev/seed script)`; none of the findings are dev-only.

Findings: of 737 scanned chains, 3 needed a composite index and all 3 are declared:

- `server/src/routes/emails.ts` line 471: `emailMessages` where tenantId == orderBy at desc (declared).
- `server/src/lib/hubDigestStore.ts` line 118: `hubAttempts` tenantId == childId == submittedAt >= (declared).
- `server/src/routes/dashboard.ts` line 194: `blocks` tenantId == endDate >= (declared).

The rest are equality-only or single-field. The codebase deliberately sorts in memory (see the comment at the top of `firestore.indexes.json`), so very few queries need indexes. The already-fixed `GET /api/timeclock/review` case (key == plus day >=) no longer appears in `server/src/routes/timeclock.ts`.

What static analysis cannot see (blind spots):

- Queries built inside a function from a `Query` parameter: `weekPayments(base, ...)` and `bookingSets(masked, ...)` in `server/src/routes/dashboard.ts`, `server/src/lib/firestoreIn.ts`, and `shardedTenantRead` in `server/src/lib/hubIndex.ts`. The audit sees only the range/status part. By reading the callers these are tenantId == plus createdAt/paidAt range (covered by the declared `bookings` and `payments` indexes) and tenantId == plus `status in` (equality-only). They also go through `withIndexFallback` in `server/src/lib/firestoreNarrow.ts`, so a missing index degrades to a wide read rather than a 500. Re-check these by hand if a caller changes.
- Dynamic collection names or field names (for example `db.collection(col)` loops in `server/src/routes/privacy.ts`, `server/src/lib/hubPrivacy.ts`, `server/src/routes/events.ts`, `server/src/lib/emailSync.ts`): all observed are equality-only, so no composite index is needed, but a future edit adding an `orderBy` would not be caught in a helper whose collection name is a variable. About 107 chains had a dynamic part; every one of them is equality-only or single-field.
- `Filter.or(...)` / composite `Filter` objects and queries assembled through spreads or ternaries.
- Real index state in the project: the tool compares source with `firestore.indexes.json` only. An index declared there but never deployed, or one created by hand in the console and absent from the file, is invisible.
- Six declared indexes are not matched by a statically resolved query (they serve parameter-built queries or are pre-emptive; see the informational lines in the script output). They are harmless and were left alone.

## Queries needing indexes

| Query | Index | Declared |
| --- | --- | --- |
| `server/src/routes/emails.ts` inbox (`emailMessages`: tenantId ==, at desc) | tenantId ASC, at DESC | yes |
| `server/src/lib/hubDigestStore.ts` digest (`hubAttempts`: tenantId ==, childId ==, submittedAt >=) | tenantId ASC, childId ASC, submittedAt ASC | yes |
| `server/src/routes/dashboard.ts` runs to come (`blocks`: tenantId ==, endDate >=) | tenantId ASC, endDate ASC | yes |

No query is missing an index. No recommendation to rewrite any query. There are no dev-only or seed-only missing indexes. Parameter-built dashboard queries (`server/src/routes/dashboard.ts`) rely on the declared `bookings` and `payments` indexes and fall back to wide reads via `server/src/lib/firestoreNarrow.ts` if those are not deployed.

## Indexes added

None. `firestore.indexes.json` is unchanged and still valid JSON with its 9 existing entries.

## Deploy steps

Indexes are declared in `firestore.indexes.json`, wired up by `firebase.json`. A deploy only adds indexes (it never deletes indexes that exist in the project but not in the file unless you pass `--force`), and each index takes minutes to build (longer on large collections). Queries that need a not-yet-built index fail until it is READY.

CLI route:

```
npm i -g firebase-tools
firebase login
firebase use <project id>
firebase deploy --only firestore:indexes
```

`<project id>` is the `project_id` field of the service account JSON the server uses (see `server/src/firebase.ts`); do not paste the key itself anywhere. Check progress with `firebase firestore:indexes` or in the console.

Firebase console route: Firebase console, Build, Firestore Database, Indexes tab, Composite, Add index. Enter the collection id, add the fields in the order and direction given in the table above, choose query scope "Collection", Create. Wait until the status shows Enabled.

Re-run the audit after any server query change: `node scripts/overnight30/index-audit.mjs` (expects `0 missing`) and `node scripts/overnight30/index-audit.mjs --selftest`.
