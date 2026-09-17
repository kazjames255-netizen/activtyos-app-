// Import England's STATE-FUNDED schools (LA maintained, academies, free schools) from the DfE GIAS register —
// the sibling of import_gias.mjs, which does the independent-schools slice. Same source CSV (fetch_gias.mjs),
// same dedupe/merge shape, but a different filter and a different classification:
//   - schoolPhase: primary | secondary | all_through | nursery (from PhaseOfEducation; "Not applicable"/"16 plus"
//     rows are left unset rather than guessed)
//   - schoolGovernance: mat | sat | la_maintained | free_school, plus trustName when linked to a trust.
//     The establishment CSV itself carries "Trusts (code)"/"Trusts (name)" columns — no separate Groups/links
//     download was needed. EstablishmentTypeGroup "Free Schools" always classifies as free_school (even though
//     free schools are structurally academies with a trust) per spec. For "Academies" with a trust link: >1
//     school sharing that trust name in this dataset = mat, exactly 1 = sat. "Local authority maintained
//     schools" is always la_maintained even on the ~275 rows that carry a (non-academy) trust value in that
//     field (e.g. a diocesan land trust) — that is a different concept from academy-trust governance and
//     guessing would risk mislabeling, so those stay la_maintained rather than being reclassified.
//   node scripts/leads/import_gias_state.mjs [--dry]      (from server/)
import admin from "firebase-admin"; import fs from "fs"; import path from "path"; import { parse } from "csv-parse/sync";
const DRY = process.argv.includes("--dry");
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync("./serviceAccountKey.json","utf8"))) });
const db = admin.firestore();
const STOP = new Set("the and of ltd limited school schools primary junior infant infants nursery academy academies trust foundation community voluntary aided controlled for boys girls church england catholic st".split(" "));
const norm = (s) => String(s||"").toLowerCase().replace(/&/g," and ").replace(/[^a-z0-9 ]/g," ").split(/\s+/).filter(w=>w && !STOP.has(w)).join(" ");
const host = (u) => { try { return new URL(/^https?:/.test(u)?u:"https://"+u).hostname.replace(/^www\./,"").toLowerCase(); } catch { return ""; } };
const pc = (s) => String(s||"").toUpperCase().replace(/\s+/g,"");
const clean = (s) => String(s||"").replace(/\s+/g," ").trim();

// ── Find the CSV (date-stamped filename changes each export) — reuses fetch_gias.mjs's output ─────────────
const DIR = "scripts/leads/out/gias/extracted";
const csvFile = fs.existsSync(DIR) ? fs.readdirSync(DIR).find(f => /^edubasealldata\d+\.csv$/i.test(f)) : null;
if (!csvFile) { console.log("No GIAS CSV found in", DIR, "— run fetch_gias.mjs first"); process.exit(1); }
const csvPath = path.join(DIR, csvFile);
console.log("reading", csvPath);
const raw = fs.readFileSync(csvPath, "latin1"); // GIAS export is windows-1252/latin1, not UTF-8
const csv = parse(raw, { columns: true, bom: true, relax_column_count: true, relax_quotes: true });
console.log("GIAS rows", csv.length);

// ── Filter to Open, state-funded schools: everything the independent import doesn't take ───────────────
// "Local authority maintained schools" + "Academies" + "Free Schools" — deliberately excludes "Special schools"
// (a distinct SEND-focused register the independent-schools batch already models via schoolType:"send" for the
// independent side; state-funded special schools are out of scope here, not silently miscounted as mainstream),
// "Welsh schools" (not England), "Colleges"/"Universities"/"Online provider" (not schools), and "Other types"
// (PRUs etc — not the "maintained/academy/free school" set the brief asked for). This lands at 21,440 open
// schools — matches the brief's "~22,000" almost exactly, which is a good sign the group choice is right.
const STATE_GROUPS = new Set(["Local authority maintained schools", "Academies", "Free Schools"]);
const rowsRaw = csv.filter(r => r["EstablishmentStatus (name)"] === "Open" && STATE_GROUPS.has(r["EstablishmentTypeGroup (name)"]));
console.log("open state-funded schools (England)", rowsRaw.length);

// ── Trust → school counts, for MAT (>1) vs SAT (=1), computed over this same filtered set ──────────────
const trustCounts = new Map();
for (const r of rowsRaw) { const t = clean(r["Trusts (name)"]); if (t && r["EstablishmentTypeGroup (name)"] !== "Local authority maintained schools") trustCounts.set(t, (trustCounts.get(t) || 0) + 1); }

// ── Classify schoolPhase + schoolGovernance (Step 2) ─────────────────────────────────────────────────────
const PHASE_MAP = { Primary: "primary", "Middle deemed primary": "primary", Secondary: "secondary", "Middle deemed secondary": "secondary", "All-through": "all_through", Nursery: "nursery" };
function classify(r) {
  const grp = r["EstablishmentTypeGroup (name)"];
  const trustName = clean(r["Trusts (name)"]);
  let schoolGovernance, gTrustName;
  if (grp === "Free Schools") { schoolGovernance = "free_school"; gTrustName = trustName || undefined; }
  else if (grp === "Academies" && trustName) { schoolGovernance = (trustCounts.get(trustName) || 0) > 1 ? "mat" : "sat"; gTrustName = trustName; }
  else if (grp === "Local authority maintained schools") { schoolGovernance = "la_maintained"; }
  // Academies with no trust name recorded (none found in the current extract, but don't guess if it happens): leave unset.
  const schoolPhase = PHASE_MAP[r["PhaseOfEducation (name)"]]; // undefined for "Not applicable" / "16 plus" — not guessed
  const low = Number(r.StatutoryLowAge) || null, high = Number(r.StatutoryHighAge) || null;
  return { schoolGovernance, trustName: gTrustName, schoolPhase, low, high };
}

// ── Map rows → common shape ───────────────────────────────────────────────
const GOV_LABEL = { mat: "Multi-academy trust", sat: "Standalone academy", la_maintained: "LA maintained", free_school: "Free school" };
const PHASE_LABEL = { primary: "Primary", secondary: "Secondary", all_through: "All-through", nursery: "Nursery" };
const rows = rowsRaw.map((r) => {
  const { schoolGovernance, trustName, schoolPhase, low, high } = classify(r);
  const website = clean(r.SchoolWebsite);
  const phone = clean(r.TelephoneNum);
  const town = clean(r.Town), postcode = clean(r.Postcode), county = clean(r["County (name)"]);
  const ageRange = low != null && high != null ? `Ages ${low}–${high}` : "";
  return {
    urn: clean(r.URN), name: clean(r.EstablishmentName), town, postcode, county,
    phone, website, schoolGovernance, trustName, schoolPhase,
    ageLow: low, ageHigh: high,
    la: clean(r["LA (name)"]),
    message: `State-funded school (DfE GIAS register)${schoolPhase ? ` · ${PHASE_LABEL[schoolPhase]}` : ""}${schoolGovernance ? ` · ${GOV_LABEL[schoolGovernance]}` : ""}${trustName ? ` · ${trustName}` : ""}${ageRange ? ` · ${ageRange}` : ""}`,
    sourceUrl: `https://get-information-schools.service.gov.uk/Establishments/Establishment/Details/${clean(r.URN)}`,
  };
});
console.log(JSON.stringify({
  total: rows.length,
  withWebsite: rows.filter(r => r.website).length,
  withPhone: rows.filter(r => r.phone).length,
  byPhase: Object.fromEntries(["primary","secondary","all_through","nursery"].map(k => [k, rows.filter(r => r.schoolPhase === k).length])),
  phaseUnset: rows.filter(r => !r.schoolPhase).length,
  byGovernance: Object.fromEntries(["mat","sat","la_maintained","free_school"].map(k => [k, rows.filter(r => r.schoolGovernance === k).length])),
  governanceUnset: rows.filter(r => !r.schoolGovernance).length,
  distinctTrusts: new Set(rows.filter(r => r.schoolGovernance === "mat").map(r => r.trustName)).size,
}));

// ── Existing leads: dedupe by URN, else postcode+name tokens, else website host ──
// Selects every field this script's fill-only merge below reads from `cur` — a narrower select here
// would make cur[key] silently undefined and defeat the fill-only guarantee for that field.
const snap = await db.collection("leads").select("name","website","location","nation","giasUrn","postcode","county","phone","schoolPhase","schoolGovernance","trustName","ageLow","ageHigh").get();
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
    const upd = { giasUrn: r.urn, giasSchoolName: r.name, source: cur.source || "gias-state", updatedAt: new Date().toISOString(), sources: admin.firestore.FieldValue.arrayUnion("gias-state") };
    // fill-only: never overwrite a value a human or an earlier pass set
    if (!cur.phone && r.phone) upd.phone = r.phone;
    if (!cur.website && r.website) upd.website = /^https?:/.test(r.website) ? r.website : "https://" + r.website;
    if (!cur.location && location) upd.location = location;
    if (!cur.postcode && r.postcode) upd.postcode = r.postcode;
    if (!cur.county && r.county) upd.county = r.county;
    if (!cur.nation) upd.nation = "England";
    if (!cur.schoolPhase && r.schoolPhase) upd.schoolPhase = r.schoolPhase;
    if (!cur.schoolGovernance && r.schoolGovernance) upd.schoolGovernance = r.schoolGovernance;
    if (!cur.trustName && r.trustName) upd.trustName = r.trustName;
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
      source: "gias-state", sources: ["gias-state"], kind: "org",
      giasUrn: r.urn, giasSchoolName: r.name, schoolPhase: r.schoolPhase, schoolGovernance: r.schoolGovernance, trustName: r.trustName,
      ageLow: r.ageLow, ageHigh: r.ageHigh,
      message: r.message, sourceUrl: r.sourceUrl,
      status: "new", inPipeline: false, createdAt: new Date().toISOString(),
    };
    // Firestore rejects `undefined` field values — strip fields classify() left unset rather than sending them.
    for (const k of Object.keys(doc)) if (doc[k] === undefined) delete doc[k];
    if (!DRY) batch.set(ref, doc); inB++; byUrn.set(r.urn, ref.id);
  }
  if (inB >= 400) await flush();
}
await flush();
console.log(JSON.stringify({ dry: DRY, rows: rows.length, matchedExisting: matched, created, skipped }));
process.exit(0);
