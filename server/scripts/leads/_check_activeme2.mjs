import admin from "firebase-admin"; import fs from "fs";
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync("./serviceAccountKey.json","utf8"))) });
const db = admin.firestore();
const snap = await db.collection("leads").get();
const matches = [];
snap.forEach(d => {
  const l = d.data();
  if ((l.website||"").toLowerCase().includes("activeme360") || (l.name||"").toLowerCase().includes("activeme") || (l.email||"").toLowerCase().includes("activeme360")) {
    matches.push({ id: d.id, name: l.name, website: l.website, bookingSystem: l.bookingSystem, bookingChecked: l.bookingChecked, source: l.source, sources: l.sources, comingSoon: l.comingSoon, excluded: l.excluded, email: l.email });
  }
});
console.log("total matches:", matches.length);
console.log(JSON.stringify(matches, null, 2));
