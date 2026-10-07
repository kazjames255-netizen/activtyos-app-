// Home-visit coverage-area checking (foundational build — see docs/home-visit
// scope note in server/src/routes/my.ts). A home-visit ("home-visit" or "both")
// listing declares where the provider will travel to, either as a flat list of
// postcode prefixes or a radius (miles) from a base postcode. Checkout
// validates the family's service-address postcode against this before the
// booking is allowed to complete.

import { geocodeAddress } from "../routes/geo";

export interface CoverageArea {
  mode: "postcodePrefixes" | "radius";
  postcodePrefixes?: string[];
  basePostcode?: string;
  radiusMiles?: number;
}

/** "sw1a 1aa" → "SW1A 1AA". Never throws. */
export function normalisePostcode(pc: string): string {
  return (pc ?? "").trim().toUpperCase().replace(/\s+/g, " ");
}

/** "SW1A 1AA" → "SW1A" (the outward code), or the whole thing if it doesn't split. */
function outward(pc: string): string {
  const n = normalisePostcode(pc).replace(/\s/g, "");
  // UK outward codes are 2-4 chars, inward is always the last 3 — split there
  // when the postcode is long enough to have both parts.
  return n.length > 3 ? n.slice(0, n.length - 3) : n;
}

function haversineMiles(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 3958.8; // Earth radius, miles
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

// A postcode never moves: remember where it is for a day (a failed lookup for a minute) so the browse feed can judge every home-visit listing for a
// family without a network call each time.
const geoCache = new Map<string, { at: number; v: { lat: number; lng: number } | null }>();
async function geocodeCached(pc: string): Promise<{ lat: number; lng: number } | null> {
  const key = normalisePostcode(pc).replace(/\s/g, "");
  const hit = geoCache.get(key);
  if (hit && Date.now() - hit.at < (hit.v ? 24 * 3_600_000 : 60_000)) return hit.v;
  const v = await geocodeAddress(pc);
  if (geoCache.size > 2000) geoCache.clear();
  geoCache.set(key, { at: Date.now(), v });
  return v;
}

/** true / false when we can tell whether `postcode` is inside the coverage area; null when we cannot (no postcode, or it could not be located). */
export async function coverageVerdict(coverage: CoverageArea | null | undefined, postcode: string | undefined | null): Promise<boolean | null> {
  if (!postcode?.trim() || !coverage) return null;
  const r = await checkCoverage(coverage, postcode);
  if (r.ok) return true;
  return /couldn't check/i.test(r.reason) ? null : false;
}

/** Is `postcode` inside the listing's coverage area? Never throws — a
 *  geocode failure on radius mode is reported as a clear "couldn't check"
 *  reason rather than silently passing or crashing the booking. */
export async function checkCoverage(
  coverage: CoverageArea | null | undefined,
  postcode: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const pc = normalisePostcode(postcode);
  if (!pc) return { ok: false, reason: "A postcode is needed to check you're within the provider's coverage area" };
  if (!coverage) return { ok: true }; // no coverage area configured — nothing to enforce yet

  if (coverage.mode === "postcodePrefixes") {
    const prefixes = (coverage.postcodePrefixes ?? []).map((p) => normalisePostcode(p).replace(/\s/g, ""));
    if (!prefixes.length) return { ok: true };
    const pcCompact = pc.replace(/\s/g, "");
    const pcOutward = outward(pc);
    // A prefix ending in a digit must end a district: "NN5" covers NN5 and NN5 7EA but not the different district NN50 ("SW1" covers SW1A, not SW10).
    const matches = (p: string) => {
      if (!(pcCompact.startsWith(p) || pcOutward.startsWith(p))) return false;
      if (/\d$/.test(p) && p.length < pcOutward.length && pcOutward.startsWith(p) && /\d/.test(pcOutward[p.length])) return false;
      return true;
    };
    const hit = prefixes.some(matches);
    return hit ? { ok: true } : { ok: false, reason: `Sorry, ${pc} is outside this provider's home-visit coverage area` };
  }

  // radius mode
  if (!coverage.basePostcode || !coverage.radiusMiles) return { ok: true }; // not fully configured — don't block
  const [base, dest] = await Promise.all([geocodeCached(coverage.basePostcode), geocodeCached(pc)]);
  if (!base || !dest) {
    return { ok: false, reason: "Couldn't check that postcode against the provider's coverage area — try their full address instead" };
  }
  const miles = haversineMiles(base, dest);
  return miles <= coverage.radiusMiles
    ? { ok: true }
    : { ok: false, reason: `Sorry, ${pc} is about ${miles.toFixed(1)} miles from this provider's base — outside their ${coverage.radiusMiles}-mile home-visit coverage area` };
}
