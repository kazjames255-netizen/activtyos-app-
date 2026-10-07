// Publish-time checks on a listing that need more than the schema: dates that have already passed, and a home-visit area made of postcodes
// that really exist. The pure parts are unit-tested (tests/regression/listing-checks.test.mts); the postcode lookups ask postcodes.io and
// FAIL OPEN when it cannot be reached (a provider must not be blocked by somebody else's outage), logging it.

/** Production-like environments only: the e2e suite and the fuzz harness create listings with past dates through the API. ENFORCE_LISTING_CHECKS=1 / 0 overrides. */
export function enforceListingChecks(): boolean {
  const v = process.env.ENFORCE_LISTING_CHECKS;
  if (v === "1") return true;
  if (v === "0") return false;
  return !!process.env.RAILWAY_ENVIRONMENT || process.env.NODE_ENV === "production";
}

/** ISO date `n` days after `iso` (UTC arithmetic: calendar days only). */
export function addDaysIso(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** A run or block whose LAST day is before today (1 day of grace for time zones) has nothing left to book. */
export function allDatesPassed(lastDate: string | undefined, today: string, graceDays = 1): boolean {
  return !!lastDate && lastDate < addDaysIso(today, -graceDays);
}

const FULL = /^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/;
const OUTWARD = /^[A-Z]{1,2}\d[A-Z\d]?$/;
const AREA_LETTERS = /^[A-Z]{1,2}$/;

/** What kind of thing a coverage-area entry is. "TW9 1" (district + sector) counts as its district. */
export function postcodeKind(raw: string): { kind: "full" | "outward" | "area" | "bad"; code: string } {
  const spaced = raw.trim().toUpperCase().replace(/\s+/g, " ");
  const compact = spaced.replace(/ /g, "");
  if (FULL.test(compact)) return { kind: "full", code: compact };
  const m = /^([A-Z]{1,2}\d[A-Z\d]?) \d[A-Z]{0,2}$/.exec(spaced); // "TW9 1": district + sector, judged by its district
  if (m) return { kind: "outward", code: m[1] };
  if (OUTWARD.test(compact)) return { kind: "outward", code: compact };
  if (AREA_LETTERS.test(compact)) return { kind: "area", code: compact };
  return { kind: "bad", code: compact };
}

export type PostcodeVerdict = "ok" | "bad" | "unknown";

/** Does this postcode / district exist? postcodes.io is the official free postcode database. "unknown" = could not ask (outage). */
export async function checkPostcodeKnown(raw: string, fetchImpl: typeof fetch = fetch): Promise<PostcodeVerdict> {
  const { kind, code } = postcodeKind(raw);
  if (kind === "bad") return "bad";
  if (kind === "area") return "ok"; // "NW", "MK": a whole postcode area, nothing to look up
  const url = kind === "full" ? `https://api.postcodes.io/postcodes/${code}` : `https://api.postcodes.io/outcodes/${code}`;
  try {
    const r = await fetchImpl(url, { signal: AbortSignal.timeout(4000) });
    if (r.ok) return "ok";
    if (r.status === 404) return "bad";
    console.warn(`[listing-checks] postcodes.io answered ${r.status} for ${code}: letting it through`);
    return "unknown";
  } catch (e) {
    console.warn(`[listing-checks] postcodes.io unreachable for ${code}: letting it through (${(e as Error).message})`);
    return "unknown";
  }
}

/** The home-visit area's postcodes, whichever mode it is in. */
export function coveragePostcodes(c: { mode?: string; postcodePrefixes?: string[]; basePostcode?: string } | null | undefined): string[] {
  if (!c) return [];
  return c.mode === "radius" ? (c.basePostcode?.trim() ? [c.basePostcode] : []) : (c.postcodePrefixes ?? []).filter((p) => p.trim());
}

/** The plain-English reason a home-visit listing can't go live because of its area's postcodes, or null. */
export async function homeVisitPostcodeProblem(
  merged: Record<string, unknown>,
  check: (raw: string) => Promise<PostcodeVerdict> = checkPostcodeKnown,
): Promise<string | null> {
  const mode = (merged.deliveryMode as string | undefined) ?? "venue";
  if (mode !== "home-visit" && mode !== "both") return null;
  for (const pc of coveragePostcodes(merged.coverageArea as never)) {
    if ((await check(pc)) === "bad") return `we can't find the postcode "${pc.trim().toUpperCase()}" in your home-visit area — check it`;
  }
  return null;
}

/** Switching coverage mode drops the other mode's data (it would otherwise be saved and confuse later edits). */
export function cleanCoverage<T extends { mode?: string; postcodePrefixes?: string[]; basePostcode?: string; radiusMiles?: number }>(c: T | null | undefined): T | null | undefined {
  if (!c) return c;
  if (c.mode === "radius") { const { postcodePrefixes: _p, ...rest } = c; return rest as T; }
  const { basePostcode: _b, radiusMiles: _r, ...rest } = c;
  return rest as T;
}
