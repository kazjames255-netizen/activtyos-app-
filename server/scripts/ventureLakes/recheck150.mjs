// One-off: threshold changed from 90 to 150 minutes drive. Re-check what we
// already have in Firestore before doing any new fetching — this is the
// "quick win" the coordinator asked for.
//   1. Any excluded doc that already has driveTimeMinutes: if it's <=150,
//      un-exclude it (near-instant, no network calls).
//   2. Legacy excluded docs (no driveTimeMinutes) with distanceMiles roughly
//      in the 90-160 mile band: recompute real drive time via OSRM — a
//      160-mile-away site could still be a <150min motorway drive. Docs
//      beyond 160mi straight-line stay excluded (no realistic road beats
//      that at 150 minutes).
import admin from "firebase-admin";
import fs from "node:fs";

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync("./serviceAccountKey.json", "utf8"))) });
const db = admin.firestore();
const OSRM = "https://router.project-osrm.org";
const MK = { lat: 52.0406, lng: -0.7594 };
const MAX_DRIVE_MINUTES = 150;
const RECHECK_BAND_MIN = 60; // below this was already checked at <=90 and passed
const RECHECK_BAND_MAX = 160;

async function fetchWithTimeout(url, ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try { return await fetch(url, { signal: ctrl.signal, headers: { "user-agent": "Mozilla/5.0" } }); }
  finally { clearTimeout(t); }
}

async function driveMinutesFromMK(lat, lng, tries = 0) {
  const url = `${OSRM}/route/v1/driving/${MK.lng},${MK.lat};${lng},${lat}?overview=false`;
  try {
    const res = await fetchWithTimeout(url, 15_000);
    if (!res.ok) throw new Error(`OSRM ${res.status}`);
    const data = await res.json();
    const seconds = data.routes?.[0]?.duration;
    return typeof seconds === "number" ? seconds / 60 : null;
  } catch (err) {
    if (tries < 2) { await new Promise((r) => setTimeout(r, 800 * (tries + 1))); return driveMinutesFromMK(lat, lng, tries + 1); }
    console.warn(`  OSRM failed: ${err.message}`);
    return null;
  }
}

async function main() {
  const col = db.collection("ventureLakes");
  const snap = await col.get();
  console.log(`Total docs: ${snap.size}`);

  // Step 1: instant re-check of docs that already have driveTimeMinutes.
  const step1Candidates = snap.docs.filter((d) => {
    const v = d.data();
    return v.driveTimeMinutes != null && v.excluded === true;
  });
  console.log(`Step 1: ${step1Candidates.length} excluded docs already have driveTimeMinutes`);
  let unexcluded1 = 0;
  {
    const batchSize = 400;
    for (let i = 0; i < step1Candidates.length; i += batchSize) {
      const batch = db.batch();
      let any = false;
      for (const d of step1Candidates.slice(i, i + batchSize)) {
        const v = d.data();
        if (v.driveTimeMinutes <= MAX_DRIVE_MINUTES) {
          batch.update(d.ref, { excluded: false, excludedReason: admin.firestore.FieldValue.delete(), updatedAt: new Date().toISOString() });
          unexcluded1++; any = true;
        }
      }
      if (any) await batch.commit();
    }
  }
  console.log(`Step 1 done: un-excluded ${unexcluded1}`);

  // Step 2: legacy docs (no driveTimeMinutes) in the 90-160mi straight-line
  // band get a real OSRM check now.
  const step2Candidates = snap.docs.filter((d) => {
    const v = d.data();
    return v.driveTimeMinutes == null && typeof v.distanceMiles === "number" && v.distanceMiles >= RECHECK_BAND_MIN && v.distanceMiles <= RECHECK_BAND_MAX;
  });
  console.log(`Step 2: ${step2Candidates.length} legacy docs in the ${RECHECK_BAND_MIN}-${RECHECK_BAND_MAX}mi band to recheck via OSRM`);

  let unexcluded2 = 0;
  const CHUNK = 400;
  for (let i = 0; i < step2Candidates.length; i += CHUNK) {
    const chunk = step2Candidates.slice(i, i + CHUNK);
    const batch = db.batch();
    let any = false;
    for (const d of chunk) {
      const v = d.data();
      const mins = await driveMinutesFromMK(v.lat, v.lng);
      await new Promise((r) => setTimeout(r, 150));
      if (mins != null && mins <= MAX_DRIVE_MINUTES) {
        batch.update(d.ref, {
          excluded: false,
          excludedReason: admin.firestore.FieldValue.delete(),
          driveTimeMinutes: Math.round(mins),
          updatedAt: new Date().toISOString(),
        });
        unexcluded2++; any = true;
      }
    }
    if (any) await batch.commit();
    console.log(`  step 2 progress: ${Math.min(i + CHUNK, step2Candidates.length)}/${step2Candidates.length} checked, ${unexcluded2} qualified so far`);
  }
  console.log(`Step 2 done: un-excluded ${unexcluded2}`);

  const after = await col.get();
  const qualifying = after.docs.filter((d) => !d.data().excluded);
  console.log(`\nFinal: ${after.size} total docs, ${qualifying.length} qualifying (<=150min drive)`);
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
