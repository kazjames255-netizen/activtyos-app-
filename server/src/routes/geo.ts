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
    { headers: { Accept: "application/json" } },
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
    { headers: { Accept: "application/json", "User-Agent": "ActivityOS/1.0 (childrens activity platform)" } },
  );
  if (!r.ok) throw new Error(`Nominatim ${r.status}`);
  const raw = (await r.json()) as { display_name: string; lat: string; lon: string }[];
  return raw.map((h) => ({ label: h.display_name, lat: parseFloat(h.lat), lng: parseFloat(h.lon) }));
}

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
    const upstream = await fetch(url, { headers: { "User-Agent": "ActivityOS/1.0" } });
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
