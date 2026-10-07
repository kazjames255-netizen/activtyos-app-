import { geocodeHit } from "../routes/geo";
import { areaFromLabel, formatPostcode, isUkPostcodeFormat, labelMatchesPostcode } from "./postcodeArea";

// Look a family's postcode up (server-side, never trusting the browser): is it a real UK postcode, and which area is it in?
// Results are cached for an hour - the geocoder (Nominatim fallback) asks callers to stay well under 1 request a second.

export type PostcodeLookup =
  | { ok: true; postcode: string; area?: string; lat: number; lng: number }
  | { ok: false; code: "format" | "notfound" | "unavailable"; postcode: string };

const cache = new Map<string, { at: number; v: PostcodeLookup }>();
const TTL_MS = 60 * 60_000;

export async function lookupPostcode(raw: string): Promise<PostcodeLookup> {
  const postcode = formatPostcode(raw);
  if (!isUkPostcodeFormat(postcode)) return { ok: false, code: "format", postcode };
  const hit = cache.get(postcode);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.v;
  let reachable = false; // did the official postcode database answer at all (200 or 404)?
  // The official postcode database first (exact town / ward and coordinates); the place-name geocoder only if it is unreachable.
  try {
    const r = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcode.replace(/\s+/g, ""))}`, { signal: AbortSignal.timeout(4000) });
    if (r.ok || r.status === 404) reachable = true;
    if (r.ok) {
      const j = (await r.json()) as { result?: { postcode?: string; admin_district?: string | null; admin_ward?: string | null; latitude?: number | null; longitude?: number | null } };
      const x = j.result;
      if (x && typeof x.latitude === "number" && typeof x.longitude === "number") {
        const area = [x.admin_ward, x.admin_district].filter((s, i, a) => s && a.indexOf(s) === i).join(", ") || undefined;
        const v: PostcodeLookup = { ok: true, postcode: x.postcode ?? postcode, area, lat: x.latitude, lng: x.longitude };
        cache.set(postcode, { at: Date.now(), v });
        return v;
      }
    } else if (r.status === 404) {
      return { ok: false, code: "notfound", postcode };
    }
  } catch { /* fall back to the geocoder below */ }
  const g = await geocodeHit(postcode);
  const v: PostcodeLookup =
    g && labelMatchesPostcode(g.label, postcode)
      ? { ok: true, postcode, area: areaFromLabel(g.label, postcode), lat: g.lat, lng: g.lng }
      : { ok: false, code: reachable ? "notfound" : "unavailable", postcode };
  // only a real answer is cached: a geocoder hiccup must not make a good postcode look wrong for an hour
  if (v.ok) cache.set(postcode, { at: Date.now(), v });
  return v;
}
