// Narrowed Firestore queries, with a safety net for the index that isn't
// deployed yet.
//
// Anything that mixes an equality filter (tenantId) with a RANGE filter on
// another field ("this week", "not finished yet") needs a composite index —
// Firestore refuses the query outright with FAILED_PRECONDITION until one
// exists, and indexes ship separately from code
// (`firebase deploy --only firestore:indexes`, see firestore.indexes.json).
//
// A route that narrows its reads must not go DOWN the moment it's deployed
// ahead of its index, so callers pass the wide query they used to run as a
// fallback. The result is identical either way — callers re-apply the same
// predicate in memory — the fallback just costs the reads the narrowing was
// there to save, and says so, loudly, once per process.
//
// The missing index is remembered, so only the FIRST request pays for a
// refused query on top of its fallback. After that callers can ask
// `indexMissing()` up front and go straight to a wide read they can share
// between several figures, instead of paying for a narrow attempt each time.

/** gRPC FAILED_PRECONDITION — what Firestore raises for a missing index. */
const FAILED_PRECONDITION = 9;

const missing = new Set<string>();

/** Has a query under this label already been refused for want of an index? */
export const indexMissing = (what: string): boolean => missing.has(what);

/**
 * Record that `err` was Firestore refusing `what` for want of an index — and
 * rethrow anything that isn't that, so real failures still surface.
 */
export function noteIndexMissing(what: string, err: unknown): void {
  const e = err as { code?: unknown; message?: unknown };
  if (e?.code !== FAILED_PRECONDITION || typeof e.message !== "string" || !/requires an index/i.test(e.message)) throw err;
  if (missing.has(what)) return;
  missing.add(what);
  console.error(
    `[firestore] ${what}: no composite index yet, falling back to a FULL collection scan — ` +
      "slow, and it spends the daily read quota. Deploy the index: " +
      "firebase deploy --only firestore:indexes (definitions in firestore.indexes.json).\n  " +
      e.message,
  );
}

/**
 * Run `narrow`; if Firestore hasn't got the composite index it needs, fall
 * back to `wide` (the unnarrowed scan) rather than failing the request.
 *
 * @param what short label for the log line, e.g. "blocks by endDate"
 */
export async function withIndexFallback<T>(
  what: string,
  narrow: () => Promise<T>,
  wide: () => Promise<T>,
): Promise<T> {
  if (indexMissing(what)) return wide();
  try {
    return await narrow();
  } catch (err) {
    noteIndexMissing(what, err);
    return wide();
  }
}
