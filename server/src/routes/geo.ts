import { formatPostcode, isUkPostcodeFormat, labelMatchesPostcode } from "../lib/postcodeArea";
import { lookupPostcode } from "../lib/postcodeLookup";
import { Router } from "express";
import proj4 from "proj4";

// ─────────────────────────────────────────────────────────────────────────
// Geocoding + map tiles — SERVER-SIDE, so no map key ever reaches the browser
// and no third-party is called from the client (or the embed widget on
// providers' own sites).
//
// Provider: Ordnance Survey (the UK's national mapping agency) when
// OS_API_KEY is set; otherwise OpenStreetMap as a keyless dev fallback.
// ─────────────────────────────────────────────────────────────────────────

export const geo = Router(); // authed (address search)
export const tiles = Router(); // public (map tiles — <img> can't send auth)

const OS_KEY = process.env.OS_API_KEY;
// Upstream (OS / Nominatim / tile server) must answer within this, or we bail —
// never let a slow third party hold a client connection open.
const GEO_TIMEOUT_MS = 5000;

// OS returns British National Grid eastings/northings (EPSG:27700); the map
// and the rest of the app use WGS84 lat/lng (EPSG:4326).
proj4.defs(
  "EPSG:27700",
  "+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 +ellps=airy +towgs84=446.448,-125.157,542.06,0.15,0.247,0.842,-20.489 +units=m +no_defs",
);

export interface GeoHit {
  label: string;
  lat: number;
  lng: number;
}

// —— Ordnance Survey Names (postcodes + place names, free tier) ——
interface OsEntry {
  NAME1?: string;
  LOCAL_TYPE?: string;
  GEOMETRY_X?: number; // easting
  GEOMETRY_Y?: number; // northing
  POPULATED_PLACE?: string;
  DISTRICT_BOROUGH?: string;
  COUNTY_UNITARY?: string;
  POSTCODE_DISTRICT?: string;
}
async function osNames(q: string): Promise<GeoHit[]> {
  const r = await fetch(
    `https://api.os.uk/search/names/v1/find?query=${encodeURIComponent(q)}&maxresults=6&key=${OS_KEY}`,
    // A slow upstream must fail fast — a hung geocode with no timeout holds a
    // browser connection for the client's full 15s, and the browse page fires
    // one lookup per venue, so a handful saturates the connection pool.
    { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(GEO_TIMEOUT_MS) },
  );
  if (!r.ok) throw new Error(`OS Names ${r.status}`);
  const data = (await r.json()) as { results?: { GAZETTEER_ENTRY: OsEntry }[] };
  const hits: GeoHit[] = [];
  for (const row of data.results ?? []) {
    const e = row.GAZETTEER_ENTRY;
    if (e.GEOMETRY_X == null || e.GEOMETRY_Y == null) continue;
    const [lng, lat] = proj4("EPSG:27700", "EPSG:4326", [e.GEOMETRY_X, e.GEOMETRY_Y]);
    const parts = [e.NAME1, e.POPULATED_PLACE, e.DISTRICT_BOROUGH, e.COUNTY_UNITARY].filter(
      (p, i, a): p is string => !!p && a.indexOf(p) === i,
    );
    hits.push({ label: parts.join(", "), lat, lng });
  }
  return hits;
}

// —— Nominatim fallback (keyless; server-side keeps volume + UA controlled) ——
async function nominatimUK(q: string): Promise<GeoHit[]> {
  const r = await fetch(
    `https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=gb&limit=6&q=${encodeURIComponent(q)}`,
    { headers: { Accept: "application/json", "User-Agent": "ActivityOS/1.0 (childrens activity platform)" }, signal: AbortSignal.timeout(GEO_TIMEOUT_MS) },
  );
  if (!r.ok) throw new Error(`Nominatim ${r.status}`);
  const raw = (await r.json()) as { display_name: string; lat: string; lon: string }[];
  return raw.map((h) => ({ label: h.display_name, lat: parseFloat(h.lat), lng: parseFloat(h.lon) }));
}

/** First coordinate for a free-text UK address/postcode, or null. Same
 *  OS→Nominatim fallback (and 5s cap) as the search route — for server-side
 *  callers that STORE coords (e.g. a venue at save time) so the browse page
 *  never has to geocode on the fly. Never throws. */
export async function geocodeAddress(q: string): Promise<{ lat: number; lng: number } | null> {
  const h = await geocodeHit(q);
  return h ? { lat: h.lat, lng: h.lng } : null;
}

/** Like geocodeAddress, but keeps the place label too (used to say which town a postcode is in). Never throws. */
export async function geocodeHit(q: string): Promise<GeoHit | null> {
  const s = (q ?? "").trim();
  if (s.length < 3) return null;
  try {
    const hits = OS_KEY ? await osNames(s).catch(() => nominatimUK(s)) : await nominatimUK(s);
    return hits[0] ?? null;
  } catch {
    return null;
  }
}

// GET /api/geo/recognise?q= — is this a real UK postcode (or outward code like "NW1")? Used by the provider's coverage-area form to show
// "Recognised: <place>" (or not) as they type. Answers {ok, postcode, place}; never throws.
geo.get("/recognise", async (req, res) => {
  const raw = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const full = formatPostcode(raw);
  const compactIn = raw.toUpperCase().replace(/\s+/g, "");
  try {
    if (isUkPostcodeFormat(full)) {
      const r = await lookupPostcode(full);
      res.json(r.ok ? { ok: true, postcode: r.postcode, place: r.area ?? "" } : { ok: false, postcode: full });
      return;
    }
    // a district / outward code on its own ("NW1", "MK10", "SW1A"): postcodes.io knows every UK district and names the boroughs it covers
    if (/^[A-Z]{1,2}\d[A-Z\d]?$/.test(compactIn)) {
      try {
        const r = await fetch(`https://api.postcodes.io/outcodes/${compactIn}`, { signal: AbortSignal.timeout(4000) });
        if (r.ok) {
          const j = (await r.json()) as { result?: { admin_district?: string[] } };
          res.json({ ok: true, postcode: compactIn, place: (j.result?.admin_district ?? []).slice(0, 3).join(", ") });
          return;
        }
        if (r.status === 404) { res.json({ ok: false, postcode: compactIn }); return; }
      } catch { /* fall through to the geocoder */ }
      const h = await geocodeHit(compactIn);
      if (h && labelMatchesPostcode(h.label, compactIn)) { res.json({ ok: true, postcode: compactIn, place: "" }); return; }
    }
    res.json({ ok: false, postcode: raw.toUpperCase() });
  } catch {
    res.json({ ok: false, postcode: raw.toUpperCase() });
  }
});

// GET /api/geo/search?q= — operator address lookup (auth-scoped).
geo.get("/search", async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (q.length < 3) {
    res.json([]);
    return;
  }
  try {
    // OS when keyed; fall back to Nominatim on any OS failure so a hiccup
    // never leaves the operator unable to find an address.
    const hits = OS_KEY ? await osNames(q).catch(() => nominatimUK(q)) : await nominatimUK(q);
    res.json(hits);
  } catch (e) {
    res.status(502).json({ error: e instanceof Error ? e.message : "Address lookup failed" });
  }
});

// GET /api/geo/address?q= — street-level address suggestions for forms ("find your address"). Uses Google Places Autocomplete (New) when
// GOOGLE_PLACES_API_KEY is set (server-side, so the key never reaches the browser); without the key it falls back to the OS/Nominatim
// search above, so the finder never goes dark. Returns only labels (the form fills address + postcode from the picked line).
const GOOGLE_KEY = process.env.GOOGLE_PLACES_API_KEY;
async function googleAddresses(q: string): Promise<{ label: string }[]> {
  const r = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": GOOGLE_KEY! },
    body: JSON.stringify({ input: q, includedRegionCodes: ["gb"], languageCode: "en-GB" }),
    signal: AbortSignal.timeout(GEO_TIMEOUT_MS),
  });
  if (!r.ok) throw new Error(`Google Places ${r.status}`);
  const data = (await r.json()) as { suggestions?: { placePrediction?: { text?: { text?: string } } }[] };
  return (data.suggestions ?? [])
    .map((x) => x.placePrediction?.text?.text)
    .filter((t): t is string => !!t)
    .slice(0, 6)
    .map((label) => ({ label }));
}
geo.get("/address", async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (q.length < 3) {
    res.json([]);
    return;
  }
  try {
    if (GOOGLE_KEY) {
      const rows = await googleAddresses(q).catch(() => null);
      if (rows && rows.length) {
        res.json(rows);
        return;
      }
    }
    // no key, or Google had nothing / failed: the postcode + place-name search
    const hits = OS_KEY ? await osNames(q).catch(() => nominatimUK(q)) : await nominatimUK(q);
    res.json(hits.map((h) => ({ label: h.label })));
  } catch (e) {
    res.status(502).json({ error: e instanceof Error ? e.message : "Address lookup failed" });
  }
});

// GET /api/geo/tiles/:z/:x/:y.png — the map picture, proxied so the tile key
// stays server-side and embeds on other sites keep working. OS Maps (Web
// Mercator raster) when keyed; OSM tiles otherwise. Public + long-cached
// (a tile at a coordinate never changes).
tiles.get("/:z/:x/:y", async (req, res) => {
  const z = Number(req.params.z);
  const x = Number(req.params.x);
  const y = Number((req.params.y || "").replace(/\.png$/, ""));
  if (![z, x, y].every(Number.isInteger) || z < 0 || z > 20) {
    res.status(400).json({ error: "Bad tile coordinates" });
    return;
  }
  const url = OS_KEY
    ? `https://api.os.uk/maps/raster/v1/zxy/Light_3857/${z}/${x}/${y}.png?key=${OS_KEY}`
    : `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
  try {
    const upstream = await fetch(url, { headers: { "User-Agent": "ActivityOS/1.0" }, signal: AbortSignal.timeout(GEO_TIMEOUT_MS) });
    if (!upstream.ok) {
      res.status(502).end();
      return;
    }
    res.setHeader("Content-Type", upstream.headers.get("content-type") ?? "image/png");
    res.setHeader("Cache-Control", "public, max-age=604800, immutable");
    res.send(Buffer.from(await upstream.arrayBuffer()));
  } catch {
    res.status(502).end();
  }
});
