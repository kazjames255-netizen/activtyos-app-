// One-off backfill: every lead with a giasUrn from before giasSchoolName existed gets it filled in from the
// GIAS CSV (same extract import_gias.mjs/import_gias_state.mjs already use). Going forward both import scripts
// write it themselves — this just catches the ~22k leads imported before that field existed.
//   node scripts/leads/backfill_gias_school_name.mjs [--dry]
import admin from "firebase-admin"; import fs from "fs"; import path from "path"; import { parse } from "csv-parse/sync";
const DRY = process.argv.includes("--dry");
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync("./serviceAccountKey.json","utf8"))) });
const db = admin.firestore();
const clean = (s) => String(s||"").replace(/\s+/g," ").trim();

const DIR = "scripts/leads/out/gias/extracted";
const csvFile = fs.readdirSync(DIR).find(f => /^edubasealldata\d+\.csv$/i.test(f));
const raw = fs.readFileSync(path.join(DIR, csvFile), "latin1");
const csv = parse(raw, { columns: true, bom: true, relax_column_count: true, relax_quotes: true });
const officialName = new Map(csv.map((r) => [String(r.URN).trim(), clean(r.EstablishmentName)]));
console.log("GIAS URNs loaded", officialName.size);

const snap = await db.collection("leads").where("giasUrn", "!=", null).get();
const todo = snap.docs.filter((d) => !d.data().giasSchoolName && officialName.has(String(d.data().giasUrn)));
console.log(`${todo.length} of ${snap.docs.length} leads need giasSchoolName backfilled`);

let batch = db.batch(), inB = 0;
for (const d of todo) {
  if (!DRY) batch.update(d.ref, { giasSchoolName: officialName.get(String(d.data().giasUrn)) });
  inB++;
  if (inB >= 400) { if (!DRY) await batch.commit(); batch = db.batch(); inB = 0; }
}
if (inB && !DRY) await batch.commit();
console.log(DRY ? "dry run — nothing written" : "backfilled", todo.length, "leads");
process.exit(0);
