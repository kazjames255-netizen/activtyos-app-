// Duplicate leads: same normalised name AND a shared hard identifier (postcode, phone, email or website host).
// Keeps the richest row, marks the rest excluded + duplicateOf, and copies any contact/website the loser had onto the keeper.
//   node scripts/leads/dedupe.mjs [--apply]     (from server/)
import admin from "firebase-admin"; import fs from "fs";
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync("./serviceAccountKey.json","utf8"))) });
const db = admin.firestore(); const APPLY = process.argv.includes("--apply");
const norm = (s) => (s||"").toLowerCase().replace(/&/g," and ").replace(/[^a-z0-9 ]/g," ").replace(/\b(the|and|of|ltd|limited|cic|cio|uk|plc|llp|co)\b/g," ").replace(/\s+/g," ").trim();
const host = (u) => { try { return new URL(/^https?:/.test(u)?u:"https://"+u).hostname.replace(/^www\./,"").toLowerCase(); } catch { return ""; } };
const GEN = /(facebook|instagram|linktr|gmail|twitter|tiktok|youtube|sites\.google|wixsite|hotmail|outlook|yahoo|btinternet|icloud)/i;
const pc = (s) => { const m = String(s||"").toUpperCase().match(/\b([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})\b/); return m ? m[1]+m[2] : ""; };
const phone = (s) => String(s||"").replace(/\D/g,"").replace(/^44/,"0"); const email = (s) => String(s||"").trim().toLowerCase();
const snap = await db.collection("leads").get(); const rows = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(x => !x.excluded);
const hostCount = new Map(); for (const x of rows) { const h = host(x.website||""); if (h && !GEN.test(h)) hostCount.set(h, (hostCount.get(h)||0)+1); }
const groups = new Map(); const keyOf = (x) => { const n = norm(x.name); if (n.length < 4) return []; const ids = []; const p = pc(x.postcode) || pc(x.location) || pc(x.address); if (p) ids.push("pc:"+p); const ph = phone(x.phone); if (ph.length >= 10) ids.push("ph:"+ph); const em = email(x.email); if (em.includes("@") && !GEN.test(em.split("@")[1])) ids.push("em:"+em); const h = host(x.website||""); if (h && !GEN.test(h) && (hostCount.get(h)||0) <= 2) ids.push("host:"+h); return ids.map(i => n+"|"+i); };
for (const x of rows) for (const k of keyOf(x)) { if (!groups.has(k)) groups.set(k, new Set()); groups.get(k).add(x.id); }
// union-find over shared keys
const parent = new Map(); const find = (a) => { while (parent.get(a) !== a) { parent.set(a, parent.get(parent.get(a))); a = parent.get(a); } return a; };
for (const x of rows) parent.set(x.id, x.id); for (const set of groups.values()) { const arr = [...set]; for (let i = 1; i < arr.length; i++) { const a = find(arr[0]), b = find(arr[i]); if (a !== b) parent.set(b, a); } }
const clusters = new Map(); for (const x of rows) { const r = find(x.id); if (!clusters.has(r)) clusters.set(r, []); clusters.get(r).push(x); }
const rich = (x) => Object.values(x).filter(v => v !== "" && v != null && v !== false).length + (x.haf ? 5 : 0) + (x.website ? 5 : 0) + (x.email ? 3 : 0) + (x.phone ? 2 : 0) + (x.inPipeline ? 50 : 0) + (x.status && x.status !== "new" ? 50 : 0);
let dupClusters = 0, losers = 0; let batch = db.batch(), inB = 0; const sample = [];
for (const arr of clusters.values()) { if (arr.length < 2) continue; dupClusters++; arr.sort((a,b) => rich(b) - rich(a)); const keep = arr[0]; const fill = {};
  for (const l of arr.slice(1)) { losers++; for (const f of ["email","phone","website","socialUrl","websiteCandidate","haf","hafLocalAuthority","hafFrom","bookingUrl","bookingSystem","nation"]) if ((keep[f] == null || keep[f] === "" || keep[f] === false) && l[f] && fill[f] == null) fill[f] = l[f];
    const srcs = new Set([...(keep.sources||[keep.source]), ...(l.sources||[l.source])].filter(Boolean)); fill.sources = [...srcs];
    if (APPLY) { batch.update(db.collection("leads").doc(l.id), { excluded: true, excludedWhy: `duplicate of ${keep.id} (${keep.name})`, duplicateOf: keep.id, dedupedAt: new Date().toISOString() }); inB++; } }
  if (sample.length < 12) { const ks = new Set(); for (const a of arr) for (const k of keyOf(a)) ks.add(k.split("|")[1].split(":")[0]); sample.push(`${keep.name} ×${arr.length} [${arr.map(a=>a.source).join("+")}] via ${[...ks].join("/")}`); }
  if (APPLY && Object.keys(fill).length) { batch.update(db.collection("leads").doc(keep.id), fill); inB++; }
  if (inB >= 380) { await batch.commit(); batch = db.batch(); inB = 0; } }
if (APPLY && inB) await batch.commit();
console.log(JSON.stringify({ leads: rows.length, duplicateClusters: dupClusters, rowsExcluded: losers, applied: APPLY })); console.log("sample:", sample.join(" | ")); process.exit(0);
