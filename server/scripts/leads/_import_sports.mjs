import admin from "firebase-admin"; import fs from "fs";
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync("./serviceAccountKey.json","utf8"))) });
const db = admin.firestore();
const data = JSON.parse(fs.readFileSync("scripts/leads/out/companies_house/sports_leads_review.json", "utf8"));

let imported = 0, skipped = 0;
const batches = [];
let batch = db.batch();
let opsInBatch = 0;

for (const tier of ["likely_fit", "uncertain"]) {
  for (const item of data[tier]) {
    const docId = "ch-sports-" + (item.companyNumber || item.name.replace(/[^a-zA-Z0-9]/g, "").slice(0,40));
    const ref = db.collection("leads").doc(docId);
    const existing = await ref.get();
    if (existing.exists) { skipped++; continue; }
    batch.set(ref, {
      name: item.name,
      companyNumber: item.companyNumber || null,
      postcode: item.postcode || "",
      regAddress: item.regAddress || "",
      types: ["activity"],
      kind: "org",
      source: "companiesHouse-sports",
      reviewTier: tier,
      needsHumanReview: tier === "uncertain",
      excluded: false,
      createdAt: new Date().toISOString(),
    }, { merge: true });
    opsInBatch++; imported++;
    if (opsInBatch >= 400) { batches.push(batch); batch = db.batch(); opsInBatch = 0; }
  }
}
if (opsInBatch > 0) batches.push(batch);
for (const b of batches) await b.commit();
console.log(JSON.stringify({ imported, skipped, batches: batches.length }));
