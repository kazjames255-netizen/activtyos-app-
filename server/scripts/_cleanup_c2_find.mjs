import admin from "firebase-admin"; import fs from "fs";
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync("./serviceAccountKey.json","utf8"))) });
const db = admin.firestore();

// Find the booking APF-10312
const bookingsSnap = await db.collectionGroup("bookings").where("ref", "==", "APF-10312").get();
console.log("bookings found with ref APF-10312:", bookingsSnap.size);
bookingsSnap.forEach(d => console.log(" -", d.ref.path, JSON.stringify(d.data()).slice(0,200)));

// Find children named "QA C2 TestChild"
const childrenSnap = await db.collectionGroup("children").where("name", "==", "QA C2 TestChild").get();
console.log("children found named 'QA C2 TestChild':", childrenSnap.size);
childrenSnap.forEach(d => console.log(" -", d.ref.path, JSON.stringify(d.data()).slice(0,200)));
