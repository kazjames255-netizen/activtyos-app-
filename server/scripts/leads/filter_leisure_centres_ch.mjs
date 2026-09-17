// Research-only pass: leisure centres / swimming pool operators that run their own kids' holiday
// activity camps, from the Companies House free monthly bulk snapshot. SIC 93110 "Operation of sports
// facilities" — distinct from the sports CLUBS code (93120) the sports pass already covers. Same
// review-only pattern: writes a REVIEW file, does NOT write to Firestore.
//   node scripts/leads/filter_leisure_centres_ch.mjs
import admin from "firebase-admin"; import fs from "fs"; import path from "path"; import { spawn } from "child_process";
import { parse } from "csv-parse";

const OUTDIR = "scripts/leads/out/companies_house";
const ZIP = fs.readdirSync(OUTDIR).filter(f => /^BasicCompanyDataAsOneFile.*\.zip$/.test(f)).sort().pop();
if (!ZIP) { console.log("no CH bulk zip found in", OUTDIR); process.exit(1); }
const ZIPPATH = path.join(OUTDIR, ZIP);
console.log("using cached CH bulk snapshot (no re-download):", ZIPPATH);

const TARGET_SIC = new Set(["93110"]);

// 93110 is overwhelmingly ordinary gyms/pools/leisure centres with no kids-holiday angle — require an
// explicit holiday/kids-activity signal, not just "leisure centre"/"sports facility" on its own.
const HOLIDAY_WORDS = /\b(holiday club|holiday camp|holiday activities|half[- ]?term|school holidays?|summer scheme|summer camp|multi[- ]?activity camp|kids? camp|children'?s? camp)\b/i;
const KIDS_WORDS = /\b(kids?|junior|juniors|youth|mini|minis|tots)\b/i;
function nameMatches(name) { return HOLIDAY_WORDS.test(name) || (KIDS_WORDS.test(name) && /\bcamp|club\b/i.test(name)); }

const NOT_FIT_WORDS = /\b(golf club|health club|country club|spa\b|holdings?|investments?|propert(y|ies)|management services|wholesale|equipment hire only)\b/i;
function classifyFit(name) {
  const n = name.toLowerCase();
  if (NOT_FIT_WORDS.test(n)) return "likely_not_fit";
  if (!HOLIDAY_WORDS.test(n)) return "uncertain"; // matched only via the looser kids-word + camp/club fallback
  return "likely_fit";
}

const STOP = new Set("the and of ltd limited cic cio uk plc llp co company".split(" "));
const norm = (s) => String(s || "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(w => w && !STOP.has(w)).join(" ");
const pc = (s) => String(s || "").toUpperCase().replace(/\s+/g, "");
const clean = (s) => String(s || "").replace(/\s+/g, " ").trim();
const title = (s) => clean(s).split(" ").map(w => /^[A-Z0-9&.'-]+$/.test(w) && w.length > 1 ? w[0] + w.slice(1).toLowerCase() : w).join(" ");

const priorCompanyNos = new Set();
for (const f of ["sports_leads_review.json", "sports_leads_review_broadened.json", "sports_leads_all_high.json", "party_entertainment_leads_review.json", "daycare_leads_review.json", "performing_arts_leads_review.json", "farms_attractions_leads_review.json", "residential_camps_leads_review.json"]) {
  const p = `${OUTDIR}/${f}`; if (!fs.existsSync(p)) continue;
  const data = JSON.parse(fs.readFileSync(p, "utf8"));
  const rows = Array.isArray(data) ? data : [...(data.likely_fit || []), ...(data.uncertain || []), ...(data.likely_not_fit || [])];
  for (const r of rows) if (r.companyNumber) priorCompanyNos.add(r.companyNumber);
}
console.log("prior-pass company numbers excluded from this pass", priorCompanyNos.size);

function streamRows() {
  return new Promise((resolve, reject) => {
    const unzip = spawn("unzip", ["-p", ZIPPATH]);
    const parser = parse({ columns: (hdr) => hdr.map(h => h.replace(/^﻿/, "").trim()), relax_quotes: true, relax_column_count: true, skip_empty_lines: true });
    const high = []; let total = 0, sicMatch = 0, active = 0, excludedPrior = 0;
    unzip.stdout.pipe(parser);
    unzip.on("error", reject);
    unzip.stderr.on("data", () => {});
    parser.on("readable", () => { let rec; while ((rec = parser.read()) !== null) {
      total++;
      const status = clean(rec["CompanyStatus"]);
      if (status !== "Active") continue;
      const sics = [rec["SICCode.SicText_1"], rec["SICCode.SicText_2"], rec["SICCode.SicText_3"], rec["SICCode.SicText_4"]].map(s => clean(s)).filter(Boolean);
      const hit = sics.find(s => TARGET_SIC.has((s.match(/^\d+/) || [""])[0]));
      if (!hit) continue;
      sicMatch++; active++;
      const companyNumber = rec["CompanyNumber"];
      if (priorCompanyNos.has(companyNumber)) { excludedPrior++; continue; }
      const name = title(rec["CompanyName"]);
      if (!nameMatches(name)) continue;
      high.push({
        name, companyNumber, legalForm: rec["CompanyCategory"], status,
        addressLine: title(rec["RegAddress.AddressLine1"]), town: title(rec["RegAddress.PostTown"]),
        county: title(rec["RegAddress.County"]), country: title(rec["RegAddress.Country"]),
        postcode: pc(rec["RegAddress.PostCode"]) ? clean(rec["RegAddress.PostCode"]).toUpperCase() : "",
        sic: (hit.match(/^\d+/) || [""])[0], sicText: hit, incorporationDate: rec["IncorporationDate"],
        sourceUrl: `https://find-and-update.company-information.service.gov.uk/company/${companyNumber}`,
        confidence: "high",
      });
    } });
    parser.on("end", () => { console.log("rows scanned", total, "| SIC 93110 Active matches", sicMatch, "| excluded (prior pass)", excludedPrior); resolve(high); });
    parser.on("error", reject);
    unzip.on("close", () => {});
  });
}

const high = await streamRows();
console.log("leisure-centre-with-holiday-club keyword matches (high confidence)", high.length);

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync("./serviceAccountKey.json", "utf8"))) });
const db = admin.firestore();
const snap = await db.collection("leads").select("name", "business", "companyNumber", "website", "location", "postcode").get();
console.log("existing leads total", snap.size);
const byCompanyNo = new Map(), byName = new Map(), byPcName = new Map();
for (const d of snap.docs) { const x = d.data();
  if (x.companyNumber) byCompanyNo.set(x.companyNumber, d.id);
  const n = norm(x.name); if (n) { if (!byName.has(n)) byName.set(n, []); byName.get(n).push(d.id); }
  const p = pc(x.postcode) || (String(x.location || "").match(/\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i) || [])[1];
  if (p && n) byPcName.set(pc(p) + "|" + n.split(" ").slice(0, 2).join(" "), d.id);
}

let alreadyExists = 0; const newRows = [];
for (const r of high) {
  const n = norm(r.name);
  const key = pc(r.postcode) + "|" + n.split(" ").slice(0, 2).join(" ");
  let id = byCompanyNo.get(r.companyNumber) || (r.postcode && byPcName.get(key)) || null;
  if (!id) { const c = byName.get(n) || []; if (c.length === 1) id = c[0]; }
  if (id) alreadyExists++; else newRows.push(r);
}
console.log("already a lead", alreadyExists, "| genuinely new", newRows.length);

const buckets = { likely_fit: [], uncertain: [], likely_not_fit: [] };
for (const r of newRows) buckets[classifyFit(r.name)].push(r);
console.log("sub-division:", Object.fromEntries(Object.entries(buckets).map(([k, v]) => [k, v.length])));

const review = {
  generatedAt: new Date().toISOString(),
  source: `Companies House bulk snapshot ${ZIP} (SIC 93110, holiday-club/kids-camp keywords, excludes prior CH passes)`,
  sicCodesUsed: [...TARGET_SIC],
  note: "93110 is overwhelmingly ordinary gyms/pools/leisure centres with no kids-holiday angle, so an " +
    "explicit holiday-club/kids-camp phrase was required. Anything matched only via the looser kids-word + " +
    "camp/club fallback is flagged uncertain, not likely_fit. Classification is name-only (no web lookups). " +
    "NOT imported — review only.",
  totals: { highConfidenceKeywordMatches: high.length, highConfidenceAlreadyExistingLead: alreadyExists, highConfidenceGenuinelyNew: newRows.length },
  subDivisionOfGenuinelyNew: { likely_fit: buckets.likely_fit.length, uncertain: buckets.uncertain.length, likely_not_fit: buckets.likely_not_fit.length },
  likely_fit: buckets.likely_fit, uncertain: buckets.uncertain, likely_not_fit: buckets.likely_not_fit,
};
fs.writeFileSync(`${OUTDIR}/leisure_centres_leads_review.json`, JSON.stringify(review, null, 2));
console.log("wrote", `${OUTDIR}/leisure_centres_leads_review.json`);
console.log(JSON.stringify({ high: high.length, alreadyExists, genuinelyNew: newRows.length, ...review.subDivisionOfGenuinelyNew }));
process.exit(0);
