// batch1: one-off — list leads in this agent's assigned slice (source=companiesHouse-sports,
// reviewTier=likely_fit, no website yet) and write their ids to out/batch1_slice_ids.txt for
// use with --only on find_websites.mjs / verify_sites.mjs / find_contacts.mjs.
import "dotenv/config"; import admin from "firebase-admin"; import fs from "fs";
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync("./serviceAccountKey.json","utf8"))) });
const db = admin.firestore();
const snap = await db.collection("leads").where("source","==","companiesHouse-sports").where("reviewTier","==","likely_fit").select("website","excluded").get();
const ids = snap.docs.filter(d => { const x = d.data(); return !x.website && !x.excluded; }).map(d=>d.id);
console.log("total matching source+tier:", snap.size, "without website & not excluded:", ids.length);
fs.writeFileSync("scripts/leads/out/batch1_slice_ids.txt", ids.join(","));
process.exit(0);
