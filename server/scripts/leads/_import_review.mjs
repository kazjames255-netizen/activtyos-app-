// Generic importer for a filter_*_ch.mjs review file (likely_fit + uncertain tiers) into `leads`,
// same shape as _import_sports.mjs. Skips anything already imported (doc id is stable per company number).
//   node scripts/leads/_import_review.mjs <reviewFile.json> <sourceTag> <docIdPrefix>
// e.g. node scripts/leads/_import_review.mjs scripts/leads/out/companies_house/farms_attractions_leads_review.json companiesHouse-farmsAttractions ch-farms
import admin from "firebase-admin"; import fs from "fs";
const [, , reviewFile, sourceTag, docPrefix] = process.argv;
if (!reviewFile || !sourceTag || !docPrefix) { console.log("usage: node scripts/leads/_import_review.mjs <reviewFile.json> <sourceTag> <docIdPrefix>"); process.exit(1); }
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync("./serviceAccountKey.json", "utf8"))) });
const db = admin.firestore();
const data = JSON.parse(fs.readFileSync(reviewFile, "utf8"));

let imported = 0, skipped = 0;
const batches = []; let batch = db.batch(); let opsInBatch = 0;
for (const tier of ["likely_fit", "uncertain"]) {
  for (const item of data[tier] || []) {
    const docId = `${docPrefix}-` + (item.companyNumber || item.name.replace(/[^a-zA-Z0-9]/g, "").slice(0, 40));
    const ref = db.collection("leads").doc(docId);
    const existing = await ref.get();
    if (existing.exists) { skipped++; continue; }
    batch.set(ref, {
      name: item.name, companyNumber: item.companyNumber || null,
      postcode: item.postcode || "", regAddress: item.addressLine || "",
      types: ["activity"], kind: "org",
      source: sourceTag, reviewTier: tier, needsHumanReview: tier === "uncertain",
      sourceUrl: item.sourceUrl || null, excluded: false,
      createdAt: new Date().toISOString(),
    }, { merge: true });
    opsInBatch++; imported++;
    if (opsInBatch >= 400) { batches.push(batch); batch = db.batch(); opsInBatch = 0; }
  }
}
if (opsInBatch > 0) batches.push(batch);
for (const b of batches) await b.commit();
console.log(JSON.stringify({ reviewFile, sourceTag, imported, skipped, batches: batches.length }));
process.exit(0);
