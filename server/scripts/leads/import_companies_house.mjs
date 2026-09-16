// Import dance-school leads from the Companies House free monthly bulk company snapshot
// (https://download.companieshouse.gov.uk/en_output.html), filtered to active companies whose
// name matches dance-related keywords (SIC 85510 "Sports and recreation education" or 93299
// "Other amusement and recreation activities n.e.c." is the usual SIC for these, but we key on
// the name match, not the SIC, since SIC self-classification is noisy).
// Usage: node scripts/leads/import_companies_house.mjs <path-to-dance_leads.json> [--dry]
// Note: registered-office address is often an accountant's address, not the studio location —
// still useful as a name+address lead for cold outreach; do not assume it's the trading address.
import admin from "firebase-admin"; import fs from "fs";
const FILE = process.argv[2], DRY = process.argv.includes("--dry");
if (!FILE) { console.log("usage: node import_companies_house.mjs <dance_leads.json> [--dry]"); process.exit(1); }
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync("./serviceAccountKey.json","utf8"))) });
const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });

const STOP = new Set("the and of ltd limited cic cio uk plc llp co company".split(" "));
const norm = (s) => String(s||"").toLowerCase().replace(/&/g," and ").replace(/[^a-z0-9 ]/g," ").split(/\s+/).filter(w=>w && !STOP.has(w)).join(" ");
const pc = (s) => String(s||"").toUpperCase().replace(/\s+/g,"");
const clean = (s) => String(s||"").replace(/\s+/g," ").trim();
const title = (s) => clean(s).split(" ").map(w => /^[A-Z0-9&.'-]+$/.test(w) && w.length > 1 ? w[0]+w.slice(1).toLowerCase() : w).join(" ");

const all = JSON.parse(fs.readFileSync(FILE, "utf8"));
const rows = all.filter(r => r.confidence === "high" && r.status === "Active");
console.log("candidate rows (high confidence, active)", rows.length);

const snap = await db.collection("leads").select("name","business","companyNumber","website","location").get();
const byCompanyNo = new Map(), byName = new Map(), byPcName = new Map();
for (const d of snap.docs) { const x = d.data();
  if (x.companyNumber) byCompanyNo.set(x.companyNumber, d.id);
  const n = norm(x.name); if (n) { if (!byName.has(n)) byName.set(n, []); byName.get(n).push(d.id); }
  const p = (String(x.location||"").match(/\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i)||[])[1];
  if (p && n) byPcName.set(pc(p)+"|"+n.split(" ").slice(0,2).join(" "), d.id);
}
console.log("existing leads total", snap.size);

let matched = 0, created = 0, skipped = 0; let batch = db.batch(), inB = 0;
const flush = async () => { if (inB && !DRY) await batch.commit(); batch = db.batch(); inB = 0; };
for (const r of rows) {
  const name = title(r.name);
  if (!name || name.length < 3) { skipped++; continue; }
  const n = norm(name);
  const location = [r.town, r.postcode].filter(Boolean).join(" · ");
  const key = pc(r.postcode)+"|"+n.split(" ").slice(0,2).join(" ");
  let id = byCompanyNo.get(r.companyNumber) || (r.postcode && byPcName.get(key)) || null;
  if (!id) { const c = byName.get(n) || []; if (c.length === 1) id = c[0]; }
  if (id) {
    matched++;
    const upd = { companyNumber: r.companyNumber, legalForm: r.legalForm, updatedAt: new Date().toISOString(), sources: admin.firestore.FieldValue.arrayUnion("ch") };
    const cur = snap.docs.find(d => d.id === id)?.data() || {};
    if (!cur.location && location) upd.location = location;
    if (!DRY) batch.update(db.collection("leads").doc(id), upd); inB++;
  } else {
    created++;
    const ref = db.collection("leads").doc();
    const doc = {
      name, business: "", email: "", phone: "", website: "",
      location, region: "", nation: "", county: r.county || "",
      source: "ch", sources: ["ch"], kind: "org", providerTypes: ["dance"],
      companyNumber: r.companyNumber, legalForm: r.legalForm,
      message: `Companies House: active company, SIC ${r.sic}${r.county ? ` · ${r.county}` : ""}`,
      sourceUrl: r.sourceUrl, status: "new", inPipeline: false, createdAt: new Date().toISOString(),
    };
    if (!DRY) batch.set(ref, doc); inB++;
    byCompanyNo.set(r.companyNumber, ref.id);
  }
  if (inB >= 400) await flush();
}
await flush();
console.log(JSON.stringify({ dry: DRY, rows: rows.length, matchedExisting: matched, created, skipped }));
process.exit(0);
