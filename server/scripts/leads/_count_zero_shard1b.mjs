import admin from "firebase-admin"; import fs from "fs";
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync("./serviceAccountKey.json","utf8"))) });
const db = admin.firestore();
const snap = await db.collection("leads").select("name","location","county","region","postcode","source","website","email","phone","socialUrl","excluded","secondaryContact","verifyPending","websiteDead","zeroContactStatus","zeroContactSearchedAt").get();
let zero = [];
for (const d of snap.docs) {
  const x = d.data();
  if (x.excluded) continue;
  if (x.website || x.email || x.phone || x.socialUrl) continue;
  if (x.secondaryContact) continue; // has an indirect route already
  zero.push({ id: d.id, ...x });
}
console.log("truly zero (no direct, no secondary):", zero.length);
const shard1 = zero.filter(l => ["0","1","2","3"].includes(l.id.slice(-1).toLowerCase()));
console.log("shard1:", shard1.length);
const alreadySearched = shard1.filter(l=>l.zeroContactSearchedAt).length;
console.log("already searched this campaign:", alreadySearched);
const bySource = {}; for (const l of shard1) bySource[l.source]=(bySource[l.source]||0)+1;
console.log(JSON.stringify(bySource,null,1));
process.exit(0);
