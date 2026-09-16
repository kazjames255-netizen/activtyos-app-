import admin from "firebase-admin"; import fs from "fs";
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync("./serviceAccountKey.json","utf8"))) });
const db = admin.firestore();
const snap = await db.collection("leads").select("name","location","county","region","postcode","source","website","email","phone","socialUrl","excluded","secondaryContact","verifyPending","websiteDead","zeroContactStatus").get();
let zero = [];
for (const d of snap.docs) {
  const x = d.data();
  if (x.excluded) continue;
  if (x.website || x.email || x.phone || x.socialUrl) continue;
  zero.push({ id: d.id, ...x });
}
console.log("total leads:", snap.size, "zero-contact:", zero.length);
const shardCounts = {};
for (const l of zero) { const c = l.id.slice(-1).toLowerCase(); shardCounts[c] = (shardCounts[c]||0)+1; }
console.log(JSON.stringify(shardCounts, null, 1));
const shard1 = zero.filter(l => ["0","1","2","3"].includes(l.id.slice(-1).toLowerCase()));
console.log("shard1 count:", shard1.length);
console.log("sample:", JSON.stringify(shard1.slice(0,5), null, 1));
const alreadyMarked = shard1.filter(l => l.secondaryContact || l.verifyPending || l.zeroContactStatus).length;
console.log("shard1 already have secondaryContact/verifyPending/zeroContactStatus:", alreadyMarked);
process.exit(0);
