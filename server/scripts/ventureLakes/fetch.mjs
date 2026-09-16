// VENTURE CYCLE PROJECT (Phase 1) — populate the `ventureLakes` Firestore
// collection with every lake / country park >= 60 acres AND within a 90
// minute DRIVE of Milton Keynes, for a lake/country-park cycle-hire
// feasibility list (Kaz + Cameron, benchmarked against Willen Lake, Milton
// Keynes = 150 acres). Scope is deliberately regional, not UK-wide: a site
// 300 miles away is not a realistic business comparison regardless of size.
//
// Completely separate from the childcare "leads" pipeline: different
// collection (`ventureLakes`, not `leads`), different scripts directory,
// no Brave Search API calls (none needed — see below).
//
// Data sources (both free, no API key):
//   - Overpass API (OpenStreetMap) — geodata for candidate features:
//       natural=water + water=lake|reservoir   (lakes / reservoirs)
//       leisure=park                            (UK "Country Park" features
//         are, in practice on OSM, tagged leisure=park with a name like
//         "X Country Park" — there is no separate park:type=country_park
//         convention in live data; verified directly against Willen Lake's
//         own OSM tags and a sample of named "Country Park" features before
//         writing this query)
//       leisure=nature_reserve                  (large reserves that double
//         as country-park-style leisure land)
//   - postcodes.io bulk reverse geocoding (radius:2000 — the API max; a
//     lake/park centroid is often hundreds of metres from the nearest
//     addressed postcode point, so the 100m default silently drops almost
//     every real site) — turns each site's centroid into a UK postcode/
//     locality. A coordinate outside the UK returns no result and the site
//     is dropped — this also filters out non-UK features.
//   - OSRM's public routing API (router.project-osrm.org, free, no key) —
//     real driving time from Milton Keynes to each candidate's centroid.
//     Straight-line distance is kept as a secondary display/sort field, but
//     the actual >= 90-minute-drive cutoff is enforced on OSRM's answer.
//
// Scope: the Overpass query is bounded to a generous ~90-MILE STRAIGHT-LINE
// box around Milton Keynes (not the whole UK) — a cheap pre-filter, since
// roads aren't straight and a "1.5h drive" site can be 70-80 miles away in
// one direction. Every candidate surviving that box then gets its real
// OSRM drive time checked, and the true >=90-minute filter runs on THAT.
//
// Approach — kept cheap AND resilient against the public Overpass mirror,
// which silently hangs (no server-side timeout enforcement, no response) on
// a handful of huge-geometry relations (sea lochs, national-scale reserves)
// mixed into a batch:
//   1. Fetch tags+bounding-box only (not full geometry) for every candidate
//      feature in a UK bounding box. A feature's true polygon area can never
//      exceed its bounding-box area, so filtering on bbox-area >= 60 acres
//      first is a safe (no false negatives) pre-filter that cuts ~60,000
//      features down to a few thousand candidates.
//   2. Fetch full geometry (out geom) for those candidates in SMALL batches
//      (default 40), each request with a hard client-side timeout. A batch
//      that times out is bisected (split in half and retried) down to
//      individual features, so one oversized relation can only ever cost a
//      timeout on itself — never stall or lose the rest of the run.
//   3. Compute the true area via the shoelace formula (ways: single ring;
//      relations: sum outer rings minus inner rings), convert m² -> acres.
//   4. After EVERY geometry batch: dedupe against what's been seen so far,
//      reverse-geocode the new sites, and upsert them to Firestore
//      immediately — so the run makes visible, incremental progress instead
//      of an all-or-nothing write at the very end.
//
// Usage: node scripts/ventureLakes/fetch.mjs [--dry] [--limit N] [--regeocode] [--no-wipe]
//   --dry       compute everything but don't touch Firestore
//   --regeocode reuse the cached pre-geocode candidate list (skip Overpass)
//   --no-wipe   skip marking pre-existing out-of-region docs `excluded`
//               (default: mark them, since a prior whole-UK run's docs must
//               not linger looking like qualifying results once scope narrows)
import admin from "firebase-admin";
import fs from "node:fs";

const DRY = process.argv.includes("--dry");
const LIMIT = (() => { const i = process.argv.indexOf("--limit"); return i > -1 ? +process.argv[i + 1] : Infinity; })();

const OUTDIR = "scripts/ventureLakes/out";
fs.mkdirSync(OUTDIR, { recursive: true });

// Public Overpass mirror — overpass-api.de's own front door (and several
// other public mirrors) were unreachable/overloaded when this ran; this one
// answered reliably.
const OVERPASS = "https://maps.mail.ru/osm/tools/overpass/api/interpreter";
const OSRM = "https://router.project-osrm.org";
const UA = "Mozilla/5.0";
const ACRE_M2 = 4046.86;
const MIN_ACRES = 60;
const MIN_M2 = MIN_ACRES * ACRE_M2;
const WILLEN_ACRES = 150;
const MK = { lat: 52.0406, lng: -0.7594 };
const MAX_DRIVE_MINUTES = 150; // 2.5 hours
// Generous straight-line pre-filter radius, in miles — a cheap first pass
// before spending an OSRM call on each candidate. Roads aren't straight, so
// this is deliberately much wider than "150 minutes at motorway speed" would
// suggest (~120-150mi), to avoid false negatives in any direction.
const PREFILTER_MILES = 160;
// Bounding box around MK sized to PREFILTER_MILES (1 mile ~= 1.60934km;
// 1 degree lat ~= 111km; 1 degree lon ~= 111km * cos(lat)).
const BBOX = (() => {
  const km = PREFILTER_MILES * 1.60934;
  const dLat = km / 111;
  const dLon = km / (111 * Math.cos((MK.lat * Math.PI) / 180));
  return `${(MK.lat - dLat).toFixed(3)},${(MK.lng - dLon).toFixed(3)},${(MK.lat + dLat).toFixed(3)},${(MK.lng + dLon).toFixed(3)}`;
})();

// ── Firestore (lazy — only touched when not --dry) ────────────────────────
let db = null;
function firestore() {
  if (db) return db;
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync("./serviceAccountKey.json", "utf8"))) });
  db = admin.firestore();
  return db;
}

// ── HTTP with a real client-side timeout (the Overpass mirror will
//    otherwise hang a connection open indefinitely with no bytes sent) ────
async function fetchWithTimeout(url, opts, ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

async function overpass(query, { timeoutMs = 60_000, tries = 0 } = {}) {
  let res;
  try {
    res = await fetchWithTimeout(
      OVERPASS,
      { method: "POST", headers: { "user-agent": UA, "content-type": "application/x-www-form-urlencoded" }, body: "data=" + encodeURIComponent(query) },
      timeoutMs,
    );
  } catch (err) {
    if (tries < 2) { await new Promise((r) => setTimeout(r, 3000 * (tries + 1))); return overpass(query, { timeoutMs, tries: tries + 1 }); }
    throw new Error(`Overpass timed out/network error after ${tries + 1} tries: ${err.message}`);
  }
  const text = await res.text();
  if (!res.ok) {
    if (tries < 2) { await new Promise((r) => setTimeout(r, 3000 * (tries + 1))); return overpass(query, { timeoutMs, tries: tries + 1 }); }
    throw new Error(`Overpass ${res.status}: ${text.slice(0, 300)}`);
  }
  return JSON.parse(text);
}

function bboxAreaM2(b, latref) {
  const latm = 111320.0;
  const lonm = 111320.0 * Math.cos((latref * Math.PI) / 180);
  const dlat = (b.maxlat - b.minlat) * latm;
  const dlon = (b.maxlon - b.minlon) * lonm;
  return dlat * dlon;
}

// Shoelace area of a ring of {lat,lon} points, in m² (equirectangular
// projection around the ring's own latitude — fine at UK scale / this
// accuracy bar; matches the brief's "shoelace formula on returned geometry").
function ringAreaM2(coords) {
  if (coords.length < 3) return 0;
  const lat0 = coords.reduce((s, p) => s + p.lat, 0) / coords.length;
  const latm = 111320.0;
  const lonm = 111320.0 * Math.cos((lat0 * Math.PI) / 180);
  const pts = coords.map((p) => [p.lon * lonm, p.lat * latm]);
  let sum = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
}

function centroidOf(coords) {
  const lat = coords.reduce((s, p) => s + p.lat, 0) / coords.length;
  const lon = coords.reduce((s, p) => s + p.lon, 0) / coords.length;
  return { lat, lon };
}

function haversineMiles(a, b) {
  const R = 3958.8; // miles
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lng - a.lng);
  const s1 = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s1), Math.sqrt(1 - s1));
}

// Real driving minutes from Milton Keynes to a site, via OSRM's public
// routing API. Returns null (never throws) on failure — a site we can't get
// a real drive time for is excluded rather than guessed at.
async function driveMinutesFromMK(site, tries = 0) {
  const url = `${OSRM}/route/v1/driving/${MK.lng},${MK.lat};${site.lng},${site.lat}?overview=false`;
  try {
    const res = await fetchWithTimeout(url, { headers: { "user-agent": UA } }, 15_000);
    if (!res.ok) throw new Error(`OSRM ${res.status}`);
    const data = await res.json();
    const seconds = data.routes?.[0]?.duration;
    if (typeof seconds !== "number") return null;
    return seconds / 60;
  } catch (err) {
    if (tries < 2) { await new Promise((r) => setTimeout(r, 1000 * (tries + 1))); return driveMinutesFromMK(site, tries + 1); }
    console.warn(`  ⚠ OSRM failed for ${site.name}: ${err.message}`);
    return null;
  }
}

// ── Step 1: bbox-only candidate pass ─────────────────────────────────────
async function candidatesFor(tagQuery, label) {
  console.log(`[bbox pass] ${label}…`);
  const q = `[out:json][timeout:100];(${tagQuery});out tags bb;`;
  const data = await overpass(q, { timeoutMs: 110_000 });
  const out = [];
  for (const e of data.elements) {
    const b = e.bounds;
    if (!b) continue;
    const latref = (b.minlat + b.maxlat) / 2;
    if (bboxAreaM2(b, latref) >= MIN_M2) {
      out.push({ type: e.type, id: e.id, name: e.tags?.name || null, src: label });
    }
  }
  console.log(`[bbox pass] ${label}: ${data.elements.length} total, ${out.length} candidates`);
  return out;
}

// ── Step 2: full geometry + true area for candidates ─────────────────────
function areaOfElement(el) {
  if (el.type === "way") {
    if (!el.geometry) return 0;
    return ringAreaM2(el.geometry);
  }
  if (el.type === "relation") {
    let area = 0;
    for (const m of el.members || []) {
      if (!m.geometry || m.geometry.length < 3) continue;
      const a = ringAreaM2(m.geometry);
      if (m.role === "inner") area -= a; else area += a;
    }
    return Math.abs(area);
  }
  return 0;
}

function centroidOfElement(el) {
  if (el.type === "way") return centroidOf(el.geometry);
  const outer = (el.members || []).find((m) => m.role === "outer" && m.geometry?.length);
  const any = outer || (el.members || []).find((m) => m.geometry?.length);
  return any ? centroidOf(any.geometry) : el.center ? { lat: el.center.lat, lon: el.center.lon } : null;
}

function overpassIdQuery(ids) {
  const wayIds = ids.filter((c) => c.type === "way").map((c) => c.id);
  const relIds = ids.filter((c) => c.type === "relation").map((c) => c.id);
  const parts = [];
  if (wayIds.length) parts.push(`way(id:${wayIds.join(",")});`);
  if (relIds.length) parts.push(`relation(id:${relIds.join(",")});`);
  return parts.join("");
}

// Fetch geometry for a batch, with a hard timeout. On timeout/failure,
// bisect (never lets one oversized feature stall or drop the whole batch)
// down to single features, which are logged and skipped if they alone fail.
async function fetchGeomResilient(ids, depth = 0) {
  if (!ids.length) return [];
  const parts = overpassIdQuery(ids);
  const q = `[out:json][timeout:45];(${parts});out geom;`;
  try {
    const data = await overpass(q, { timeoutMs: 50_000, tries: 0 });
    return data.elements;
  } catch (err) {
    if (ids.length === 1) {
      console.warn(`  ⚠ skipping ${ids[0].type}/${ids[0].id} (${ids[0].name || "unnamed"}): ${err.message}`);
      return [];
    }
    const mid = Math.ceil(ids.length / 2);
    const a = await fetchGeomResilient(ids.slice(0, mid), depth + 1);
    const b = await fetchGeomResilient(ids.slice(mid), depth + 1);
    return [...a, ...b];
  }
}

// ── Reverse-geocode + distance for one batch of already-deduped sites ────
async function geocodeBatch(sitesBatch) {
  const final = [];
  for (let i = 0; i < sitesBatch.length; i += 100) {
    const chunk = sitesBatch.slice(i, i + 100);
    let data;
    try {
      const res = await fetchWithTimeout(
        "https://api.postcodes.io/postcodes",
        { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ geolocations: chunk.map((s) => ({ longitude: s.lng, latitude: s.lat, limit: 1, radius: 2000 })) }) },
        20_000,
      );
      data = await res.json();
    } catch (err) {
      console.warn(`  ⚠ postcodes.io batch failed, skipping ${chunk.length} sites: ${err.message}`);
      continue;
    }
    for (let j = 0; j < chunk.length; j++) {
      const site = chunk[j];
      const geo = data.result?.[j]?.result?.[0];
      if (!geo) continue; // outside the UK (e.g. swept-in Republic of Ireland) — drop
      const distanceMiles = haversineMiles(MK, { lat: site.lat, lng: site.lng });

      // Real drive time is the actual filter (straight-line was only the
      // cheap Overpass bbox pre-filter). Rate-limited against OSRM's public,
      // shared server.
      const driveTimeMinutes = await driveMinutesFromMK({ lat: site.lat, lng: site.lng, name: site.name });
      await new Promise((r) => setTimeout(r, 300));
      if (driveTimeMinutes == null || driveTimeMinutes > MAX_DRIVE_MINUTES) continue;

      final.push({
        name: site.name,
        postcode: geo.postcode,
        locality: [geo.admin_ward, geo.admin_district].filter(Boolean).filter((v, idx, a) => a.indexOf(v) === idx).join(", "),
        acres: site.acres,
        pctOfWillen: Math.round((site.acres / WILLEN_ACRES) * 1000) / 10,
        distanceMiles: Math.round(distanceMiles * 10) / 10,
        driveTimeMinutes: Math.round(driveTimeMinutes),
        lat: site.lat,
        lng: site.lng,
        osmId: site.osmId,
        source: site.source,
      });
    }
  }
  return final;
}

async function writeToFirestore(rows) {
  if (DRY || !rows.length) return;
  const col = firestore().collection("ventureLakes");
  for (const site of rows) {
    const id = site.osmId.replace("/", "_");
    await col.doc(id).set({ ...site, updatedAt: new Date().toISOString() }, { merge: false });
  }
}

// Mark (never delete) pre-existing docs that predate the 90-minute-drive
// scope. An earlier run (before that requirement existed) wrote whole-UK
// sites under the same osmId-based doc ids; this run's much smaller
// MK-regional candidate set will never touch those far-away docs again to
// update them, so without this pass they'd linger forever looking like
// qualifying results. Sets `excluded: true` + a reason — data stays
// auditable/recoverable rather than being destroyed. VentureLakesApp and the
// API route both filter `excluded` docs out.
async function markOutOfRangeExcluded() {
  if (DRY) return;
  const col = firestore().collection("ventureLakes");
  const snap = await col.get();
  if (snap.empty) return;
  // ANY pre-existing doc with no driveTimeMinutes predates this rework and
  // was never checked against the real 90-minute-drive test — mark all of
  // them, not just the ones obviously far away by straight-line distance
  // (a near-MK-by-haversine site can still fail the real drive-time test on
  // slow rural roads, so "close on a straight line" is not a safe pass).
  // A doc this run itself just wrote always has driveTimeMinutes set and is
  // never touched here.
  const toMark = snap.docs.filter((d) => d.data().driveTimeMinutes == null && !d.data().excluded);
  if (!toMark.length) return;
  console.log(`Marking ${toMark.length} pre-existing out-of-region docs as excluded (superseded by the 90-min-drive scope)…`);
  const batchSize = 400;
  for (let i = 0; i < toMark.length; i += batchSize) {
    const batch = firestore().batch();
    for (const d of toMark.slice(i, i + batchSize)) {
      batch.update(d.ref, { excluded: true, excludedReason: "superseded-by-90min-drive-scope", updatedAt: new Date().toISOString() });
    }
    await batch.commit();
  }
  console.log("Marking done.");
}

async function main() {
  const runLog = fs.createWriteStream(`${OUTDIR}/ventureLakes.jsonl`, { flags: "w" });
  const allFinal = [];
  const seenKeys = new Set(); // name@rounded-coord, for cross-batch dedupe

  if (!process.argv.includes("--no-wipe")) await markOutOfRangeExcluded();

  if (process.argv.includes("--regeocode")) {
    const deduped = JSON.parse(fs.readFileSync(`${OUTDIR}/deduped.json`, "utf8"));
    console.log(`--regeocode: reusing ${deduped.length} cached pre-geocode sites, skipping Overpass`);
    const rows = await geocodeBatch(deduped);
    for (const r of rows) { allFinal.push(r); runLog.write(JSON.stringify(r) + "\n"); }
    await writeToFirestore(rows);
    console.log(`Final UK sites >= ${MIN_ACRES} acres: ${allFinal.length}`);
    finish(allFinal, runLog);
    return;
  }

  const water = await candidatesFor(
    `way["natural"="water"]["water"~"^(lake|reservoir)$"](${BBOX});relation["natural"="water"]["water"~"^(lake|reservoir)$"](${BBOX});`,
    "water",
  );
  const park = await candidatesFor(`way["leisure"="park"](${BBOX});relation["leisure"="park"](${BBOX});`, "park");
  const nr = await candidatesFor(
    `way["leisure"="nature_reserve"](${BBOX});relation["leisure"="nature_reserve"](${BBOX});`,
    "nature_reserve",
  );

  // Dedupe by type+id (a feature can only match one query since the tags
  // are mutually exclusive keys — natural=water vs leisure=park vs
  // leisure=nature_reserve — but keep this safe if that ever changes).
  const seen = new Map();
  for (const c of [...water, ...park, ...nr]) {
    const key = `${c.type}/${c.id}`;
    if (!seen.has(key)) seen.set(key, c);
  }
  let candidates = [...seen.values()];
  console.log(`Total unique candidates: ${candidates.length}`);
  if (LIMIT < candidates.length) candidates = candidates.slice(0, LIMIT);

  // Small batches (default 40, not 250): keeps each Overpass request light
  // enough to answer quickly, and — combined with fetchGeomResilient's
  // bisect-on-timeout — means one oversized relation (a sea loch, a
  // national-scale reserve boundary) can only ever cost itself a timeout,
  // never stall the run.
  const BATCH = 40;
  const allDeduped = [];
  const nBatches = Math.ceil(candidates.length / BATCH);
  for (let i = 0; i < candidates.length; i += BATCH) {
    const batchNum = i / BATCH + 1;
    const batch = candidates.slice(i, i + BATCH);
    console.log(`[geom] batch ${batchNum}/${nBatches} (${batch.length} features)…`);
    const elements = await fetchGeomResilient(batch);

    const batchSites = [];
    for (const el of elements) {
      const areaM2 = areaOfElement(el);
      const acres = areaM2 / ACRE_M2;
      if (acres < MIN_ACRES) continue;
      const c = centroidOfElement(el);
      if (!c) continue;
      const name = el.tags?.name;
      if (!name) continue; // unnamed features aren't useful prospects
      batchSites.push({
        osmId: `${el.type}/${el.id}`,
        source: el.tags?.natural === "water" ? "osm:water" : el.tags?.leisure === "nature_reserve" ? "osm:nature_reserve" : "osm:park",
        name,
        acres: Math.round(acres * 10) / 10,
        lat: Math.round(c.lat * 1e6) / 1e6,
        lng: Math.round(c.lon * 1e6) / 1e6,
      });
    }

    // Dedupe against everything seen so far (a lake can be enclosed by a
    // park boundary and show up from two tag passes / two batches).
    const newSites = [];
    for (const s of batchSites) {
      const key = `${s.name.toLowerCase()}@${s.lat.toFixed(2)},${s.lng.toFixed(2)}`;
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      newSites.push(s);
      allDeduped.push(s);
    }

    // Geocode + write THIS batch's new sites immediately — visible,
    // incremental progress instead of an all-or-nothing write at the end.
    if (newSites.length) {
      const rows = await geocodeBatch(newSites);
      for (const r of rows) { allFinal.push(r); runLog.write(JSON.stringify(r) + "\n"); }
      await writeToFirestore(rows);
    }
    console.log(`[geom] batch ${batchNum}/${nBatches} done — ${newSites.length} new sites this batch, ${allFinal.length} total qualifying sites written so far`);

    // Be a polite citizen of a free, shared public mirror.
    await new Promise((r) => setTimeout(r, 800));
  }

  fs.writeFileSync(`${OUTDIR}/deduped.json`, JSON.stringify(allDeduped, null, 2));
  console.log(`Final UK sites >= ${MIN_ACRES} acres: ${allFinal.length}`);
  finish(allFinal, runLog);
}

function finish(allFinal, runLog) {
  runLog.end();
  allFinal.sort((a, b) => b.acres - a.acres);
  fs.writeFileSync(`${OUTDIR}/ventureLakes.json`, JSON.stringify(allFinal, null, 2));
  console.log(`Wrote ${OUTDIR}/ventureLakes.json`);
  if (DRY) console.log("--dry: not written to Firestore (rows above were computed only)");
  else console.log(`Wrote ${allFinal.length} docs to ventureLakes incrementally as each batch completed`);
}

main().catch((err) => { console.error(err); process.exit(1); });
