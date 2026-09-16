import "dotenv/config"; import admin from "firebase-admin"; import fs from "fs";
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync("./serviceAccountKey.json","utf8"))) });
const db = admin.firestore();
const snap = await db.collection("leads").select("name","location","county","region","postcode","source","website","email","phone","socialUrl","excluded","secondaryContact","sourceUrl","hafFrom","hafLocalAuthority","hafProgramme").get();
const zero = [];
for (const d of snap.docs) {
  const x = d.data();
  if (x.excluded) continue;
  if (x.website || x.email || x.phone || x.socialUrl) continue;
  zero.push({ id: d.id, ...x });
}
console.log("total leads:", snap.size);
console.log("zero-contact (excl excluded):", zero.length);
const withSecondary = zero.filter(l => l.secondaryContact).length;
console.log("zero-contact with secondaryContact already:", withSecondary);
console.log("zero-contact WITHOUT secondaryContact:", zero.length - withSecondary);

const shard4 = zero.filter(l => l.id && "cde".includes(l.id[l.id.length-1]));
console.log("shard4 (last hex c/d/e) total zero-contact:", shard4.length);
const shard4NoSecondary = shard4.filter(l => !l.secondaryContact);
console.log("shard4 without secondaryContact:", shard4NoSecondary.length);
fs.writeFileSync("/private/tmp/claude-501/-Users-kazjames/f10df699-223d-4c37-bfad-468f823d7eb1/scratchpad/shard4_leads.json", JSON.stringify(shard4, null, 0));
process.exit(0);
