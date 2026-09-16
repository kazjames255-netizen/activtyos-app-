import admin from "firebase-admin"; import fs from "fs";
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync("./serviceAccountKey.json","utf8"))) });
const db = admin.firestore();

const snap = await db.collection("leads").select("status","duplicateOf","excluded","reviewTier","needsHumanReview","email","phone").get();
let total = snap.size;
let dup = 0, excluded = 0, visibleTotal = 0;
let status = {};
let likely=0, uncertain=0;
let reachable = 0;
for (const d of snap.docs) {
  const x = d.data();
  if (x.duplicateOf || x.excluded) { if (x.duplicateOf) dup++; if (x.excluded) excluded++; continue; }
  visibleTotal++;
  const st = x.status || "new";
  status[st] = (status[st]||0)+1;
  if (x.reviewTier === "likely_fit") likely++;
  if (x.reviewTier === "uncertain") uncertain++;
  if (x.email || x.phone) reachable++;
}
console.log("raw total docs:", total);
console.log("excluded via duplicateOf:", dup, "excluded via excluded flag:", excluded);
console.log("visible total (as UI would show, post dedup filter):", visibleTotal);
console.log("status breakdown (visible, default-new applied):", JSON.stringify(status));
console.log("reviewTier likely_fit:", likely, "uncertain:", uncertain);
console.log("reachable (email or phone):", reachable);
process.exit(0);
