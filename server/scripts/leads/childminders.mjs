// Stamp providerTypes "childminder" on register leads whose record text says so (fill/union only).   node scripts/leads/childminders.mjs
import admin from "firebase-admin"; import fs from "fs";
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync("./serviceAccountKey.json","utf8"))) });
const db=admin.firestore(); const snap=await db.collection("leads").select("providerType","providerTypes","message","excluded").get(); let n=0; let batch=db.batch(), inB=0;
for(const d of snap.docs){const x=d.data(); if(x.excluded)continue; const pts=x.providerTypes||[]; if(pts.includes("childminder"))continue; if(!/childmind/i.test(`${x.providerType||""} ${x.message||""}`))continue; batch.update(d.ref,{providerTypes:[...pts,"childminder"]}); n++; if(++inB>=400){await batch.commit();batch=db.batch();inB=0;}}
if(inB)await batch.commit(); console.log(JSON.stringify({stamped:n})); process.exit(0);
