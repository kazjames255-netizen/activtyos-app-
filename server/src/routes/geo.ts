import { Router } from "express";

// ─────────────────────────────────────────────────────────────────────────
// Geocoding — turn a postcode/address into lat/lng, SERVER-SIDE, so no map
// key ever reaches the browser and no third-party is called from the client
// (or from the embed widget running on providers' own sites).
//
// Provider is chosen by env. Ordnance Survey (the UK's national mapping
// agency, best for UK postcodes) is the target — set OS_API_KEY. Until then
// it falls back to OpenStreetMap's Nominatim, server-side and low-volume.
//
// OS wiring is deliberately left to the key: OS Names returns British
// National Grid eastings/northings (not lat/lng), so the parse + BNG→WGS84
// transform must be built and VERIFIED against the real API — guessing the
// coordinate maths blind would be worse than the fallback. Drop the key in
// and this is a ~20-minute finish.
// ─────────────────────────────────────────────────────────────────────────

export const geo = Router();

export interface GeoHit {
  label: string;
  lat: number;
  lng: number;
}

async function nominatimUK(q: string): Promise<GeoHit[]> {
  const r = await fetch(
    `https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=gb&limit=6&q=${encodeURIComponent(q)}`,
    {
      headers: {
        Accept: "application/json",
        // Nominatim's policy asks for an identifying User-Agent; server-side
        // we can honour it (a browser can't set it).
        "User-Agent": "ActivityOS/1.0 (childrens activity platform)",
      },
    },
  );
  if (!r.ok) throw new Error(`geocoder ${r.status}`);
  const raw = (await r.json()) as { display_name: string; lat: string; lon: string }[];
  return raw.map((h) => ({ label: h.display_name, lat: parseFloat(h.lat), lng: parseFloat(h.lon) }));
}

// GET /api/geo/search?q= — operator address lookup. Auth-scoped (mounted
// under the authed /api tree) so it can't be hammered anonymously.
geo.get("/search", async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (q.length < 3) {
    res.json([]);
    return;
  }
  try {
    // When OS_API_KEY lands: call OS Names here, transform BNG→WGS84, and
    // keep nominatimUK as the fallback on any failure.
    const hits = await nominatimUK(q);
    res.json(hits);
  } catch (e) {
    res.status(502).json({ error: e instanceof Error ? e.message : "Address lookup failed" });
  }
});
