// One-off: dump the id list for batch2's assigned slice (first half alphabetically by name) to a JSON file.
// source == companiesHouse-sports, reviewTier == uncertain, needsHumanReview == true, no website field.
import admin from "firebase-admin"; import fs from "fs";
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync("./serviceAccountKey.json","utf8"))) });
const db = admin.firestore();
const snap = await db.collection("leads")
  .where("source", "==", "companiesHouse-sports")
  .where("reviewTier", "==", "uncertain")
  .where("needsHumanReview", "==", true)
  .select("name", "website")
  .get();
const rows = snap.docs.filter(d => !d.data().website).map(d => ({ id: d.id, name: d.data().name || "" }));
rows.sort((a, b) => a.name.localeCompare(b.name));
const half = Math.ceil(rows.length / 2);
const mySlice = rows.slice(0, half);
fs.writeFileSync("scripts/leads/out/batch2_slice_ids.json", JSON.stringify(mySlice.map(r => r.id)));
console.log(JSON.stringify({ totalMatching: rows.length, mySliceSize: mySlice.length, firstName: mySlice[0]?.name, lastName: mySlice[mySlice.length-1]?.name }));
process.exit(0);
