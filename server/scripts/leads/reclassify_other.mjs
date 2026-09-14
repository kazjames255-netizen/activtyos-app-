// Register imports filed childminders / toddler groups / home childcare as providerTypes "other" — give them real settings.
//   node scripts/leads/reclassify_other.mjs
import admin from "firebase-admin"; import fs from "fs";
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync("./serviceAccountKey.json","utf8"))) });
const db=admin.firestore(); const snap=await db.collection("leads").select("providerTypes","activityTypes","message","excluded").get(); let n=0; const c={}; let batch=db.batch(), inB=0;
for(const d of snap.docs){const x=d.data(); if(x.excluded)continue; let pts=x.providerTypes||[]; if(!pts.includes("other"))continue; const m=String(x.message||""); const acts=new Set(x.activityTypes||[]); let to=null;
  if(/childmind|approved home childcare/i.test(m)) to="childminder"; else if(/parent (&|and) toddler|toddler group|playgroup|parent and baby/i.test(m)){ to="activity"; acts.add("baby"); } else if(/out of school|after school|breakfast|holiday (club|care|scheme)|play ?scheme/i.test(m)) to="wraparound"; else if(/nursery|day care|daycare|crèche|creche/i.test(m)) to="nursery"; else if(/pre-?school/i.test(m)) to="preschool";
  if(!to)continue; pts=[...new Set(pts.filter(t=>t!=="other").concat(to))]; c[to]=(c[to]||0)+1; batch.update(d.ref,{providerTypes:pts,activityTypes:[...acts]}); n++; if(++inB>=400){await batch.commit();batch=db.batch();inB=0;}}
if(inB)await batch.commit(); console.log(JSON.stringify({reclassified:n,by:c})); process.exit(0);
