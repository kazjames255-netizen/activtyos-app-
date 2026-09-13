import admin from "firebase-admin"; import fs from "fs";
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync("./serviceAccountKey.json","utf8"))) });
const db = admin.firestore(); const S=process.env.S; const OUT=`${S}/deep.out.jsonl`; const DONE=`${S}/deep-merged.ids`;
const done = new Set(fs.existsSync(DONE) ? fs.readFileSync(DONE,"utf8").split("\n").filter(Boolean) : []);
const rows = fs.readFileSync(OUT,"utf8").split("\n").filter(Boolean).map(l=>JSON.parse(l)).filter(r=>!done.has(r.id));
let batch=db.batch(), n=0; const c={}; const bump=k=>c[k]=(c[k]||0)+1; const flush=async()=>{ if(n){await batch.commit(); batch=db.batch(); n=0;} };
const cur=new Map(); for (let i=0;i<rows.length;i+=300){ const snaps=await db.getAll(...rows.slice(i,i+300).map(r=>db.collection("leads").doc(r.id)),{fieldMask:["bookingSystem"]}); snaps.forEach(s=>cur.set(s.id,s.exists?s.data():{})); }
for (const r of rows) { const have=cur.get(r.id)?.bookingSystem; let upd=null; const v=r.verdict||"";
  if (!have && v.startsWith("third-party: ")) { const name=v.slice(13); upd={ bookingSystem:name, bookingUrl: Object.values(r.ext||{})[0]?.url || null, bookingFrom:"deep site crawl 13 Sept 2026" }; bump("third-party"); }
  else if (!have && v.startsWith("own portal: ")) { const h=v.slice(12); upd={ bookingSystem:`own portal (${h})${r.portalTitle?` — "${r.portalTitle.slice(0,60)}"`:""}`, bookingUrl:r.portals[h]?.url||`https://${h}/`, bookingFrom:"deep site crawl 13 Sept 2026" }; bump("own portal"); }
  else if (!have && v.startsWith("own site booking: ")) { const u=v.slice(18); upd={ bookingSystem:"own site (booking page)", bookingUrl:u, bookingFrom:`deep site crawl 13 Sept 2026 — saw "${(r.uiPages?.[0]?.hit||"").slice(0,40)}"` }; bump("own site booking"); }
  else if (v==="enquiry only") { upd={ bookingChecked:`deep site crawl 13 Sept 2026: ${r.pages} pages read — enquiry / phone / email only` }; bump("enquiry only"); }
  else if (v==="unreachable") { upd={ websiteDown:true }; bump("unreachable"); }
  else bump("already had a system");
  if (upd) { upd.updatedAt=new Date().toISOString(); batch.update(db.collection("leads").doc(r.id), upd); n++; if(n>=400) await flush(); } }
await flush(); fs.appendFileSync(DONE, rows.map(r=>r.id+"\n").join(""));
// Network propagation: a franchise network's booking system applies to every franchisee without one.
if (process.env.NET) { const snap=await db.collection("leads").select("network","bookingSystem","bookingUrl","excluded").get(); const byNet=new Map();
  for (const d of snap.docs){ const x=d.data(); if(x.excluded||!x.network) continue; if(!byNet.has(x.network)) byNet.set(x.network,[]); byNet.get(x.network).push({id:d.id,...x}); }
  let prop=0; for (const [net,ls] of byNet){ const withSys=ls.filter(l=>l.bookingSystem && !/booking form|\(nursery app\)/.test(l.bookingSystem)); if(!withSys.length) continue;
    const tally={}; for(const l of withSys){ const k=l.bookingSystem.split(/;| — /)[0].trim(); tally[k]=(tally[k]||0)+1; } const best=Object.entries(tally).sort((a,b)=>b[1]-a[1])[0]; if (best[1] < Math.max(2, withSys.length*0.5) && ls.length>3) continue;
    const src=withSys.find(l=>l.bookingSystem.startsWith(best[0]));
    for (const l of ls) if (!l.bookingSystem) { batch.update(db.collection("leads").doc(l.id), { bookingSystem:`${best[0]} (network-wide: ${net})`, bookingUrl: src?.bookingUrl||null, bookingFrom:`network: ${best[1]} ${net} sites use it`, updatedAt:new Date().toISOString() }); n++; prop++; if(n>=400) await flush(); } }
  await flush(); c.networkPropagated=prop; }
console.log(JSON.stringify(c)); process.exit(0);
