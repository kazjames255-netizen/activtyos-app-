// Research-only pass: museums, zoos, wildlife/nature attractions running kids' holiday workshops, from
// the Companies House free monthly bulk snapshot. SIC 91020 (museum activities) and 91040 (botanical/
// zoological gardens & nature reserves) — genuinely unscanned by every prior pass. Same review-only
// pattern: writes a REVIEW file, does NOT write to Firestore.
//   node scripts/leads/filter_attractions_museums_ch.mjs
import admin from "firebase-admin"; import fs from "fs"; import path from "path"; import { spawn } from "child_process";
import { parse } from "csv-parse";

const OUTDIR = "scripts/leads/out/companies_house";
const ZIP = fs.readdirSync(OUTDIR).filter(f => /^BasicCompanyDataAsOneFile.*\.zip$/.test(f)).sort().pop();
if (!ZIP) { console.log("no CH bulk zip found in", OUTDIR); process.exit(1); }
const ZIPPATH = path.join(OUTDIR, ZIP);
console.log("using cached CH bulk snapshot (no re-download):", ZIPPATH);

const TARGET_SIC = new Set(["91020", "91040"]);

// Most museums/zoos/nature reserves have no children's-holiday-workshop programme at all — require an
// explicit kids/family/holiday-activity signal.
const KIDS_HOLIDAY_WORDS = /\b(kids?|junior|juniors|youth|family|families|children'?s?|holiday|holidays|half[- ]?term|school holidays?|workshops?|activity days?|discovery days?|explorer(s)? club)\b/i;
function nameMatches(name) { return KIDS_HOLIDAY_WORDS.test(name); }

const NOT_FIT_WORDS = /\b(holdings?|investments?|propert(y|ies)|trust(ees)? of|foundation for the preservation|archive(s)? only|research (centre|institute)|conservation trust\b(?!.*(kids?|family|children))|estate(s)? management)\b/i;
function classifyFit(name) {
  const n = name.toLowerCase();
  if (NOT_FIT_WORDS.test(n)) return "likely_not_fit";
  // "Family"/"family-friendly" wording alone (no explicit kids/holiday/workshop word) is a weaker
  // signal for a museum/nature-reserve trust than for a leisure business — flag uncertain.
  if (/\bfamily|families\b/i.test(n) && !/\b(kids?|junior|juniors|youth|children'?s?|holiday|holidays|half[- ]?term|workshops?|activity days?|discovery days?|explorer)\b/i.test(n)) return "uncertain";
  return "likely_fit";
}

const STOP = new Set("the and of ltd limited cic cio uk plc llp co company".split(" "));
const norm = (s) => String(s || "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(w => w && !STOP.has(w)).join(" ");
const pc = (s) => String(s || "").toUpperCase().replace(/\s+/g, "");
const clean = (s) => String(s || "").replace(/\s+/g, " ").trim();
const title = (s) => clean(s).split(" ").map(w => /^[A-Z0-9&.'-]+$/.test(w) && w.length > 1 ? w[0] + w.slice(1).toLowerCase() : w).join(" ");

const priorCompanyNos = new Set();
for (const f of ["sports_leads_review.json", "sports_leads_review_broadened.json", "sports_leads_all_high.json", "party_entertainment_leads_review.json", "daycare_leads_review.json", "performing_arts_leads_review.json", "farms_attractions_leads_review.json", "residential_camps_leads_review.json", "leisure_centres_leads_review.json"]) {
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
    parser.on("end", () => { console.log("rows scanned", total, "| SIC 91020/91040 Active matches", sicMatch, "| excluded (prior pass)", excludedPrior); resolve(high); });
    parser.on("error", reject);
    unzip.on("close", () => {});
  });
}

const high = await streamRows();
console.log("museum/zoo/nature-reserve kids-activity keyword matches (high confidence)", high.length);

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
  source: `Companies House bulk snapshot ${ZIP} (SIC 91020/91040, kids/family/holiday keywords, excludes prior CH passes)`,
  sicCodesUsed: [...TARGET_SIC],
  note: "Most museums/zoos/nature reserves have no children's-holiday-workshop programme at all, so an " +
    "explicit kids/family/holiday/workshop word was required. 'Family' alone with no other qualifier is " +
    "flagged uncertain. Classification is name-only (no web lookups). NOT imported — review only.",
  totals: { highConfidenceKeywordMatches: high.length, highConfidenceAlreadyExistingLead: alreadyExists, highConfidenceGenuinelyNew: newRows.length },
  subDivisionOfGenuinelyNew: { likely_fit: buckets.likely_fit.length, uncertain: buckets.uncertain.length, likely_not_fit: buckets.likely_not_fit.length },
  likely_fit: buckets.likely_fit, uncertain: buckets.uncertain, likely_not_fit: buckets.likely_not_fit,
};
fs.writeFileSync(`${OUTDIR}/attractions_museums_leads_review.json`, JSON.stringify(review, null, 2));
console.log("wrote", `${OUTDIR}/attractions_museums_leads_review.json`);
console.log(JSON.stringify({ high: high.length, alreadyExists, genuinelyNew: newRows.length, ...review.subDivisionOfGenuinelyNew }));
process.exit(0);
