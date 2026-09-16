// One-off: dump id lists for the newly-imported companiesHouse-performingarts / companiesHouse-daycare
// leads, split by source+reviewTier, in priority order: performingarts likely_fit, daycare likely_fit,
// performingarts uncertain, daycare uncertain. Writes one JSON file per tier to out/newcat_slice_<n>.json
// plus a combined summary. Usage: node scripts/leads/newcat_get_slice.mjs
import "dotenv/config"; import admin from "firebase-admin"; import fs from "fs";
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync("./serviceAccountKey.json","utf8"))) });
const db = admin.firestore();
const TIERS = [
  { n: 1, source: "companiesHouse-performingarts", tier: "likely_fit" },
  { n: 2, source: "companiesHouse-daycare", tier: "likely_fit" },
  { n: 3, source: "companiesHouse-performingarts", tier: "uncertain" },
  { n: 4, source: "companiesHouse-daycare", tier: "uncertain" },
];
const summary = [];
for (const t of TIERS) {
  const snap = await db.collection("leads").where("source","==",t.source).where("reviewTier","==",t.tier).select("name","excluded").get();
  const ids = snap.docs.filter(d => !d.data().excluded).map(d => d.id);
  fs.writeFileSync(`scripts/leads/out/newcat_slice_${t.n}.json`, JSON.stringify(ids));
  summary.push({ ...t, count: ids.length });
}
console.log(JSON.stringify(summary, null, 2));
process.exit(0);
