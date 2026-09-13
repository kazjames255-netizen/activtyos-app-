// Match council HAF provider lists to leads (set haf + council), create leads for the rest.
import admin from "firebase-admin"; import fs from "fs"; import path from "path";
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync("./serviceAccountKey.json","utf8"))) });
const db = admin.firestore(); const DIR = "scripts/leads/out/haf-la"; const DONE = "scripts/leads/out/haf-merged.json";
const doneSet = new Set(fs.existsSync(DONE) ? JSON.parse(fs.readFileSync(DONE,"utf8")) : []);
const STOP = new Set("the and of ltd limited cic cio uk plc llp co community trust".split(" "));
const norm = (s) => (s||"").toLowerCase().replace(/&/g," and ").replace(/[^a-z0-9 ]/g," ").split(/\s+/).filter(w=>w && !STOP.has(w)).join(" ");
const host = (u) => { try { return new URL(/^https?:/.test(u)?u:"https://"+u).hostname.replace(/^www\./,"").toLowerCase(); } catch { return ""; } };
const NATION_REGIONS = new Set(["Wales","Scotland","Northern Ireland"]);
// leads index
const snap = await db.collection("leads").select("name","business","website","location","county","region","haf","hafLocalAuthority","excluded","source").get();
const byName = new Map(), byHost = new Map(); const leadOf = new Map();
for (const d of snap.docs){ const x=d.data(); if (x.excluded) continue; leadOf.set(d.id,{id:d.id,...x});
  for (const n of [norm(x.name), norm(x.business)]) if (n && n.length>3) { if(!byName.has(n)) byName.set(n,[]); byName.get(n).push(d.id); }
  const h = host(x.website||""); if (h) { if(!byHost.has(h)) byHost.set(h,[]); byHost.get(h).push(d.id); } }
console.log("leads indexed", leadOf.size);
const files = fs.readdirSync(DIR).filter(f=>/^(batch|redo|wave2)-\d+(-part[A-Z]|-group[A-Z])?\.json$/.test(f));
let matched=0, created=0, ambiguous=0, skipped=0; let batch=db.batch(), inB=0; const flush=async()=>{ if(inB){await batch.commit(); batch=db.batch(); inB=0;} };
const newDone=[]; const councils=[];
for (const f of files) { let arr; try { arr = JSON.parse(fs.readFileSync(path.join(DIR,f),"utf8")); } catch { console.log("bad json", f); continue; }
  for (const la of arr) { if (!la?.la || NATION_REGIONS.has(la.la)) continue; councils.push({la:la.la, region:la.region, programme:la.programmeName, n:(la.providers||[]).length});
    for (const p of (la.providers||[])) { const name = (p.name||"").trim(); if (!name || name.length<3) { skipped++; continue; }
      const key = `${la.la}|${norm(name)}`; if (doneSet.has(key)) continue; newDone.push(key);
      const GENERIC = /^(facebook|instagram|linktr|eequ|gmail|twitter|x|tiktok|youtube|sites\.google)\./; const h0 = host(p.website||""); const h = GENERIC.test(h0) ? "" : h0; let ids = (h && byHost.get(h)) || [];
      // A national brand's host (Stagecoach, Premier Education…) maps to many franchisee leads — keep only this council's region, and give up on host if it's still a crowd.
      if (ids.length > 1) ids = ids.filter(id => leadOf.get(id).region === la.region); if (ids.length > 3) ids = [];
      if (!ids.length) { const cands = byName.get(norm(name)) || []; if (cands.length===1) ids = cands; else if (cands.length>1) { const same = cands.filter(id => { const l=leadOf.get(id); return l.region===la.region || (l.location||"").toLowerCase().includes(la.la.toLowerCase()) || (l.county||"").toLowerCase().includes(la.la.toLowerCase()); }); if (same.length===1) ids = same; else if (same.length>1) { ids = same; ambiguous++; } } }
      const stamp = { haf:true, hafFrom: la.directoryUrl || la.hafPageUrl || null, hafProgramme: la.programmeName || null, updatedAt:new Date().toISOString() };
      if (ids.length) { for (const id of ids) { const l = leadOf.get(id); const las = new Set((l.hafLocalAuthority||"").split("; ").filter(Boolean)); las.add(la.la); const upd = { ...stamp, hafLocalAuthority: [...las].join("; ") }; if (!l.haf) delete upd.hafFrom; else delete upd.hafFrom; if (l.hafFrom==null && stamp.hafFrom) upd.hafFrom = stamp.hafFrom; l.haf=true; l.hafLocalAuthority=upd.hafLocalAuthority; batch.update(db.collection("leads").doc(id), upd); inB++; matched++; } }
      else { const ref = db.collection("leads").doc(); const town = p.town || p.area || ""; const doc = { name, business:"", email:"", phone:"", website: p.website ? (/^https?:/.test(p.website)?p.website:"https://"+p.website) : "", location: [town, la.la].filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).join(" · "), region: la.region, nation: "England", county: la.la, source: "haf", sources:["haf"], kind: "org", providerTypes: ["holiday"], activityTypes: p.activityType ? [String(p.activityType).toLowerCase()] : [], message: `HAF provider listed by ${la.la}${la.programmeName?` (${la.programmeName})`:""}${p.activityType?` — ${p.activityType}`:""}${p.note?`. ${p.note}`:""}`.slice(0,400), sourceUrl: la.directoryUrl || la.hafPageUrl || "", status:"new", inPipeline:false, createdAt:new Date().toISOString(), ...stamp, hafLocalAuthority: la.la };
        batch.set(ref, doc); inB++; created++; leadOf.set(ref.id,{id:ref.id,...doc}); const n=norm(name); if(!byName.has(n)) byName.set(n,[]); byName.get(n).push(ref.id); if (h) { if(!byHost.has(h)) byHost.set(h,[]); byHost.get(h).push(ref.id); } }
      if (inB>=400) await flush(); } } }
await flush(); fs.writeFileSync(DONE, JSON.stringify([...doneSet, ...newDone]));
fs.writeFileSync("scripts/leads/out/haf-councils.json", JSON.stringify(councils));
console.log(JSON.stringify({files:files.length, councils:councils.length, matchedExisting:matched, createdNew:created, ambiguousMultiMatch:ambiguous, skipped}));
process.exit(0);
