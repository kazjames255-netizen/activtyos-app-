import admin from "firebase-admin"; import fs from "fs";
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync("./serviceAccountKey.json","utf8"))) });
const db=admin.firestore(); const S=process.env.S; const P=JSON.parse(fs.readFileSync(`${S}/eequ-haf-providers.json`,"utf8"));
const STOP=new Set("the and of ltd limited cic cio uk plc llp co community trust".split(" ")); const norm=s=>(s||"").toLowerCase().replace(/&/g," and ").replace(/[^a-z0-9 ]/g," ").split(/\s+/).filter(w=>w&&!STOP.has(w)).join(" ");
const snap=await db.collection("leads").select("name","business","source","sources","haf","hafPaid","excluded").get(); const byName=new Map();
for (const d of snap.docs){ const x=d.data(); if(x.excluded) continue; for (const n of [norm(x.name),norm(x.business)]) if(n){ if(!byName.has(n)) byName.set(n,[]); byName.get(n).push({id:d.id,...x}); } }
let matched=0, created=0, paidSet=0; let batch=db.batch(), n=0; const flush=async()=>{ if(n){await batch.commit(); batch=db.batch(); n=0;} };
for (const [name,v] of Object.entries(P)) { const cands=byName.get(norm(name))||[]; const eequFirst=cands.filter(c=>c.source==="eequ"||(c.sources||[]).includes("eequ")); const use=eequFirst.length?eequFirst:cands;
  const paid = v.titles.some(t=>/\(paid\)|paid/i.test(t)) || v.n > v.haf ? true : null; // other non-HAF listings on eequ = they sell paid places
  const stamp={ haf:true, hafFrom:`https://eequ.org/experience/${v.slug}`, hafText:v.titles[0].slice(0,120), updatedAt:new Date().toISOString() }; if (paid) stamp.hafPaid=true;
  if (use.length) { for (const c of use.slice(0,3)) { const u={...stamp}; if (c.haf) delete u.hafFrom; if (typeof c.hafPaid==="boolean") delete u.hafPaid; else if (paid) paidSet++; batch.update(db.collection("leads").doc(c.id),u); n++; matched++; } }
  else { batch.set(db.collection("leads").doc(), { name, business:"", email:"", phone:"", website:"", location:v.towns.slice(0,3).join(", "), source:"eequ", sources:["eequ"], kind:"org", providerTypes:["holiday"], message:`eequ listings: ${v.titles.slice(0,3).join("; ")}`.slice(0,400), sourceUrl:`https://eequ.org/experience/${v.slug}`, status:"new", inPipeline:false, nation:"England", createdAt:new Date().toISOString(), ...stamp }); n++; created++; }
  if (n>=400) await flush(); }
await flush(); console.log(JSON.stringify({eequHafProviders:Object.keys(P).length, matchedLeads:matched, createdNew:created, hafPaidSet:paidSet})); process.exit(0);
