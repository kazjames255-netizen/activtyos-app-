// Import England's independent schools from the DfE GIAS (Get Information about Schools) register as leads.
// Source: get-information-schools.service.gov.uk "Establishment fields CSV" (edubasealldata<date>.csv), fetched
// once (fetch_gias.mjs) into scripts/leads/out/gias/extracted/edubasealldata*.csv (date-stamped filename — don't
// hardcode it, glob for it).
// Same shape as import_registers.mjs: dedupe against existing leads (by GIAS URN, else postcode+name tokens, else
// website host), fill-only merge into existing docs, new docs get source:"gias", inPipeline:false, status:"new".
//   node scripts/leads/import_gias.mjs [--dry]      (from server/)
import admin from "firebase-admin"; import fs from "fs"; import path from "path"; import { parse } from "csv-parse/sync";
const DRY = process.argv.includes("--dry");
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync("./serviceAccountKey.json","utf8"))) });
const db = admin.firestore();
const STOP = new Set("the and of ltd limited school schools independent preparatory prep senior college academy trust foundation for boys girls house international".split(" "));
const norm = (s) => String(s||"").toLowerCase().replace(/&/g," and ").replace(/[^a-z0-9 ]/g," ").split(/\s+/).filter(w=>w && !STOP.has(w)).join(" ");
const host = (u) => { try { return new URL(/^https?:/.test(u)?u:"https://"+u).hostname.replace(/^www\./,"").toLowerCase(); } catch { return ""; } };
const pc = (s) => String(s||"").toUpperCase().replace(/\s+/g,"");
const clean = (s) => String(s||"").replace(/\s+/g," ").trim();

// ── Find the CSV (date-stamped filename changes each export) ────────────────
const DIR = "scripts/leads/out/gias/extracted";
const csvFile = fs.existsSync(DIR) ? fs.readdirSync(DIR).find(f => /^edubasealldata\d+\.csv$/i.test(f)) : null;
if (!csvFile) { console.log("No GIAS CSV found in", DIR, "— run fetch_gias.mjs first"); process.exit(1); }
const csvPath = path.join(DIR, csvFile);
console.log("reading", csvPath);
const raw = fs.readFileSync(csvPath, "latin1"); // GIAS export is windows-1252/latin1, not UTF-8
const csv = parse(raw, { columns: true, bom: true, relax_column_count: true, relax_quotes: true });
console.log("GIAS rows", csv.length);

// ── Filter to Open, independent (incl. independent special) schools ─────────
const isIndependent = (r) => r["EstablishmentTypeGroup (name)"] === "Independent schools" || r["TypeOfEstablishment (name)"] === "Other independent special school";
const rowsRaw = csv.filter(r => r["EstablishmentStatus (name)"] === "Open" && isIndependent(r));
console.log("open independent schools (England)", rowsRaw.length);

// ── Classify schoolType + boarding (Step 2) ──────────────────────────────────
function classify(r) {
  const send = r["TypeOfEstablishment (name)"] === "Other independent special school";
  const senFields = Array.from({ length: 13 }, (_, i) => r[`SEN${i + 1} (name)`]).some((v) => clean(v));
  const low = Number(r.StatutoryLowAge) || null, high = Number(r.StatutoryHighAge) || null;
  let schoolType = "other";
  if (send || senFields) schoolType = "send";
  else if (low != null && high != null && low < 8 && high > 13) schoolType = "all_through";
  else if (high != null && high <= 13) schoolType = "prep";
  else if (low != null && low >= 11) schoolType = "senior";
  // Name corroboration for prep, per spec — doesn't override the age-range heuristic, only used when age fields are missing.
  else if (/preparatory|\bprep\b/i.test(r.EstablishmentName || "") && (high == null || high <= 13)) schoolType = "prep";
  const boarding = /boarding/i.test(r["Boarders (name)"] || "");
  return { schoolType, boarding, low, high, send: send || senFields };
}

// ── Map rows → common shape ───────────────────────────────────────────────
const rows = rowsRaw.map((r) => {
  const { schoolType, boarding, low, high } = classify(r);
  const website = clean(r.SchoolWebsite);
  const phone = clean(r.TelephoneNum);
  const town = clean(r.Town), postcode = clean(r.Postcode), county = clean(r["County (name)"]);
  const ageRange = low != null && high != null ? `Ages ${low}–${high}` : "";
  const TYPE_LABEL = { send: "SEND", prep: "Prep", senior: "Senior", all_through: "All-through", other: "Independent" };
  return {
    urn: clean(r.URN), name: clean(r.EstablishmentName), town, postcode, county,
    phone, website, schoolType, boarding,
    ageLow: low, ageHigh: high,
    la: clean(r["LA (name)"]),
    message: `Independent school (DfE GIAS register) · ${TYPE_LABEL[schoolType]}${ageRange ? ` · ${ageRange}` : ""}${boarding ? " · Boarding" : ""}`,
    sourceUrl: `https://get-information-schools.service.gov.uk/Establishments/Establishment/Details/${clean(r.URN)}`,
  };
});
console.log(JSON.stringify({
  total: rows.length,
  withWebsite: rows.filter(r => r.website).length,
  withPhone: rows.filter(r => r.phone).length,
  bySchoolType: Object.fromEntries(["send","prep","senior","all_through","other"].map(k => [k, rows.filter(r => r.schoolType === k).length])),
  boarding: rows.filter(r => r.boarding).length,
}));

// ── Existing leads: dedupe by URN, else postcode+name tokens, else website host ──
const snap = await db.collection("leads").select("name","website","location","nation","giasUrn","postcode").get();
const byUrn = new Map(), byPcName = new Map(), byHost = new Map();
for (const d of snap.docs) { const x = d.data();
  if (x.giasUrn) byUrn.set(String(x.giasUrn), d.id);
  const p = x.postcode || (String(x.location||"").match(/\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i)||[])[1];
  const n = norm(x.name); if (p && n) byPcName.set(pc(p)+"|"+n.split(" ").slice(0,2).join(" "), d.id);
  const h = host(x.website||""); if (h) byHost.set(h, d.id);
}
console.log("existing leads scanned", snap.docs.length);

let matched = 0, created = 0, skipped = 0; let batch = db.batch(), inB = 0;
const flush = async () => { if (inB && !DRY) await batch.commit(); batch = db.batch(); inB = 0; };
for (const r of rows) {
  if (!r.name || r.name.length < 3) { skipped++; continue; }
  const n = norm(r.name); const key = pc(r.postcode)+"|"+n.split(" ").slice(0,2).join(" "); const h = host(r.website);
  const id = byUrn.get(r.urn) || (r.postcode && n && byPcName.get(key)) || (h && byHost.get(h)) || null;
  const location = [r.town, r.postcode].filter(Boolean).join(" · ");
  if (id) {
    matched++;
    const cur = snap.docs.find((d) => d.id === id)?.data() || {};
    const upd = { giasUrn: r.urn, giasSchoolName: r.name, source: cur.source || "gias", updatedAt: new Date().toISOString(), sources: admin.firestore.FieldValue.arrayUnion("gias") };
    // fill-only: never overwrite a value a human or an earlier pass set
    if (!cur.phone && r.phone) upd.phone = r.phone;
    if (!cur.website && r.website) upd.website = /^https?:/.test(r.website) ? r.website : "https://" + r.website;
    if (!cur.location && location) upd.location = location;
    if (!cur.postcode && r.postcode) upd.postcode = r.postcode;
    if (!cur.county && r.county) upd.county = r.county;
    if (!cur.nation) upd.nation = "England";
    if (!cur.schoolType) upd.schoolType = r.schoolType;
    if (typeof cur.boarding !== "boolean") upd.boarding = r.boarding;
    if (r.ageLow != null && cur.ageLow == null) upd.ageLow = r.ageLow;
    if (r.ageHigh != null && cur.ageHigh == null) upd.ageHigh = r.ageHigh;
    if (!DRY) batch.update(db.collection("leads").doc(id), upd); inB++;
  } else {
    created++;
    const ref = db.collection("leads").doc();
    const doc = {
      name: r.name, business: "", email: "", phone: r.phone || "",
      website: r.website ? (/^https?:/.test(r.website) ? r.website : "https://" + r.website) : "",
      location, county: r.county || "", postcode: r.postcode || "", nation: "England",
      source: "gias", sources: ["gias"], kind: "org",
      giasUrn: r.urn, giasSchoolName: r.name, schoolType: r.schoolType, boarding: r.boarding,
      ageLow: r.ageLow, ageHigh: r.ageHigh,
      message: r.message, sourceUrl: r.sourceUrl,
      status: "new", inPipeline: false, createdAt: new Date().toISOString(),
    };
    if (!DRY) batch.set(ref, doc); inB++; byUrn.set(r.urn, ref.id);
  }
  if (inB >= 400) await flush();
}
await flush();
console.log(JSON.stringify({ dry: DRY, rows: rows.length, matchedExisting: matched, created, skipped }));
process.exit(0);
