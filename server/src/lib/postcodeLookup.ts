import { geocodeHit } from "../routes/geo";
import { areaFromLabel, formatPostcode, isUkPostcodeFormat, labelMatchesPostcode } from "./postcodeArea";

// Look a family's postcode up (server-side, never trusting the browser): is it a real UK postcode, and which area is it in?
// Results are cached for an hour - the geocoder (Nominatim fallback) asks callers to stay well under 1 request a second.

export type PostcodeLookup =
  | { ok: true; postcode: string; area?: string; lat: number; lng: number }
  | { ok: false; code: "format" | "notfound"; postcode: string };

const cache = new Map<string, { at: number; v: PostcodeLookup }>();
const TTL_MS = 60 * 60_000;

export async function lookupPostcode(raw: string): Promise<PostcodeLookup> {
  const postcode = formatPostcode(raw);
  if (!isUkPostcodeFormat(postcode)) return { ok: false, code: "format", postcode };
  const hit = cache.get(postcode);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.v;
  const g = await geocodeHit(postcode);
  const v: PostcodeLookup =
    g && labelMatchesPostcode(g.label, postcode)
      ? { ok: true, postcode, area: areaFromLabel(g.label, postcode), lat: g.lat, lng: g.lng }
      : { ok: false, code: "notfound", postcode };
  // only a real answer is cached: a geocoder hiccup must not make a good postcode look wrong for an hour
  if (v.ok) cache.set(postcode, { at: Date.now(), v });
  return v;
}
