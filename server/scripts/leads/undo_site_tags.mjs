// Undo tonight's loose site-derived tags: for every verify row applied tonight (offset ≥ 16759), remove the activities/settings the
// old signals() added unless the lead's own record text (name / Ofsted description / sport) corroborates them.   node scripts/leads/undo_site_tags.mjs
import admin from "firebase-admin"; import fs from "fs";
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync("./serviceAccountKey.json","utf8"))) });
const db=admin.firestore(); const rows=fs.readFileSync("scripts/leads/out/verify.out.jsonl","utf8").split("\n").filter(Boolean).map(l=>JSON.parse(l)).slice(16759).filter(r=>r.signals);
// The page's own activity vocabulary (lifted from features/platform/LeadsApp.tsx ACTIVITY) — what the record text alone would tag.
const src=fs.readFileSync("../features/platform/LeadsApp.tsx","utf8"); const tbl=src.slice(src.indexOf("const ACTIVITY"), src.indexOf("];", src.indexOf("const ACTIVITY")));
const ACTIVITY=[...tbl.matchAll(/\["(\w+)", "[^"]*", (\/.*?\/[a-z]*)\],?\n/g)].map(m=>[m[1], eval(m[2])]);
const byLead=new Map(); for(const r of rows){ const cur=byLead.get(r.id)||{acts:new Set(),types:new Set()}; for(const a of r.signals.acts||[]) cur.acts.add(a); for(const t of r.signals.types||[]) cur.types.add(t); byLead.set(r.id,cur); }
const ids=[...byLead.keys()]; let n=0, actsRemoved=0, typesRemoved=0; let batch=db.batch(), inB=0;
for(let i=0;i<ids.length;i+=300){ const snaps=await db.getAll(...ids.slice(i,i+300).map(id=>db.collection("leads").doc(id)));
  for(const s of snaps){ if(!s.exists) continue; const x=s.data(); const sig=byLead.get(s.id); const text=`${x.name} ${x.business||""} ${x.sport||""} ${x.message||""}`;
    const keepAct=(a)=>{ const re=ACTIVITY.find(([k])=>k===a)?.[1]; return re ? re.test(text) : false; };
    const acts=(x.activityTypes||[]).filter(a=>!sig.acts.has(a)||keepAct(a)||a==="haf"); const types=(x.providerTypes||[]).filter(t=>!sig.types.has(t)||t===x.providerType||t==="childminder");
    const upd={}; if(acts.length!==(x.activityTypes||[]).length){ upd.activityTypes=acts; actsRemoved+=(x.activityTypes||[]).length-acts.length; } if(types.length!==(x.providerTypes||[]).length){ upd.providerTypes=types.length?types:(x.providerType?[x.providerType]:types); typesRemoved+=(x.providerTypes||[]).length-types.length; }
    if(Object.keys(upd).length){ upd.siteTagsUndoneAt=new Date().toISOString(); batch.update(s.ref,upd); n++; if(++inB>=400){await batch.commit();batch=db.batch();inB=0;} } } }
if(inB) await batch.commit(); console.log(JSON.stringify({leadsTouched:n,actsRemoved,typesRemoved,rowsRead:rows.length})); process.exit(0);
