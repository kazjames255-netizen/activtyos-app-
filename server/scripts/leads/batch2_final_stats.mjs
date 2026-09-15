import admin from "firebase-admin"; import fs from "fs";
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync("./serviceAccountKey.json","utf8"))) });
const db = admin.firestore();
const ids = JSON.parse(fs.readFileSync("scripts/leads/out/batch2_slice_ids.json","utf8"));
let website=0, candidate=0, email=0, phone=0;
for (let i=0;i<ids.length;i+=300) {
  const snaps = await db.getAll(...ids.slice(i,i+300).map(id=>db.collection("leads").doc(id)), { fieldMask:["website","websiteCandidate","email","phone"] });
  for (const s of snaps) { if (!s.exists) continue; const d = s.data(); if (d.website) website++; if (d.websiteCandidate) candidate++; if (d.email) email++; if (d.phone) phone++; }
}
console.log(JSON.stringify({ sliceSize: ids.length, website, candidate, email, phone }));
process.exit(0);
