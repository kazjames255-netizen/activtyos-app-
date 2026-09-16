import "dotenv/config"; import admin from "firebase-admin"; import fs from "fs";
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync("./serviceAccountKey.json","utf8"))) });
const db = admin.firestore();
const snap = await db.collection("leads").select("name","location","county","region","postcode","excluded","website","email","phone","socialUrl","websiteCandidate","sourceUrl","hafFrom","hafLocalAuthority","hafProgramme","source").get();
const zero = [];
for (const d of snap.docs) { const x = d.data(); if (x.excluded) continue;
  if (x.email || x.phone || x.website || x.socialUrl) continue;
  zero.push({ id: d.id, ...x }); }
console.log("total zero-contact:", zero.length);
const shard = zero.filter(l => "4567".includes(l.id.slice(-1)));
console.log("shard2 (last hex 4-7):", shard.length);
const byLast = {}; for (const l of zero) { const c = l.id.slice(-1); byLast[c]=(byLast[c]||0)+1; }
console.log(byLast);
fs.writeFileSync("scripts/leads/out/shard2_ids.json", JSON.stringify(shard.map(l=>l.id)));
process.exit(0);
