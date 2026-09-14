// One-off backfill: leads already marked websiteDead (from before websiteDeadCategory existed) get a category
// derived by string-matching the existing websiteDeadWhy text — no network fetches, just pattern matching the
// same phrasing residue.mjs already writes (see residue.mjs's dead-reason branch).
//   node scripts/leads/backfill_dead_category.mjs            # dry run, prints counts
//   node scripts/leads/backfill_dead_category.mjs --apply    # writes websiteDeadCategory
import "dotenv/config"; import admin from "firebase-admin"; import fs from "fs";
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync("./serviceAccountKey.json","utf8"))) });
const db = admin.firestore();
const APPLY = process.argv.includes("--apply");

const categorize = (why) => {
  const w = String(why || "").toLowerCase();
  if (/parked \/ for-sale domain/.test(w)) return "parked";
  if (/empty page at/.test(w)) return "empty";
  if (/domain now a different kind of business/.test(w)) return "no-match";
  if (/reachable but neither their name nor children'?s wording on it/.test(w)) return "no-match";
  return "unreachable"; // ENOTFOUND / HTTP 4xx / "alternates all fail" / social-only / anything else
};

const snap = await db.collection("leads").where("websiteDead", "==", true).select("websiteDeadWhy", "websiteDeadCategory").get();
const counts = {};
let batch = db.batch(), inB = 0, toWrite = 0;
for (const d of snap.docs) {
  const x = d.data();
  if (x.websiteDeadCategory) continue; // already categorized (e.g. by this residue run)
  const cat = categorize(x.websiteDeadWhy);
  counts[cat] = (counts[cat] || 0) + 1;
  toWrite++;
  if (APPLY) { batch.update(d.ref, { websiteDeadCategory: cat }); if (++inB >= 400) { await batch.commit(); batch = db.batch(); inB = 0; } }
}
if (APPLY && inB) await batch.commit();
console.log(JSON.stringify({ totalDead: snap.size, alreadyCategorized: snap.size - toWrite, toBackfill: toWrite, byCategory: counts, applied: APPLY }, null, 2));
process.exit(0);
