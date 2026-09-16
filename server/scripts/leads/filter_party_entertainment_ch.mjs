// Research-only pass: kids' party-entertainment / soft-play / non-sport amusement businesses from the
// Companies House free monthly bulk snapshot. Re-scans SIC 93290 ("Other amusement and recreation
// activities n.e.c." — SIC 2007 has no separate 93299) with KIDS-PARTY keywords distinct from the
// sports-coaching keywords already used in filter_sports_ch.mjs / filter_sports_ch_broadened.mjs, and
// explicitly excludes every company number those two passes already surfaced (in any bucket) so this
// pass only reports genuinely new territory. Same pattern otherwise — writes a REVIEW file only, does
// NOT write to Firestore.
//
// Usage: node scripts/leads/filter_party_entertainment_ch.mjs
import admin from "firebase-admin"; import fs from "fs"; import path from "path"; import { spawn } from "child_process";
import { parse } from "csv-parse";

const OUTDIR = "scripts/leads/out/companies_house";
const ZIP = fs.readdirSync(OUTDIR).filter(f => /^BasicCompanyDataAsOneFile.*\.zip$/.test(f)).sort().pop();
if (!ZIP) { console.log("no CH bulk zip found in", OUTDIR); process.exit(1); }
const ZIPPATH = path.join(OUTDIR, ZIP);
console.log("using cached CH bulk snapshot (no re-download):", ZIPPATH);

// Exclude every company number already surfaced by the two sports passes (any bucket — likely_fit,
// uncertain, likely_not_fit, and the raw all-high/low files) so we don't re-report them here.
const priorCompanyNos = new Set();
for (const f of ["sports_leads_review.json", "sports_leads_review_broadened.json", "sports_leads_all_high.json"]) {
  const p = `${OUTDIR}/${f}`;
  if (!fs.existsSync(p)) continue;
  const data = JSON.parse(fs.readFileSync(p, "utf8"));
  const rows = Array.isArray(data) ? data : [...(data.likely_fit || []), ...(data.uncertain || []), ...(data.likely_not_fit || [])];
  for (const r of rows) if (r.companyNumber) priorCompanyNos.add(r.companyNumber);
}
console.log("prior sports-pass company numbers excluded from this pass", priorCompanyNos.size);

const TARGET_SIC = new Set(["93290"]); // 93299 does not exist as a distinct SIC 2007 code

// Kids-party/entertainment keywords — deliberately NOT the sport-name keywords from the sports passes,
// so this pass surfaces a genuinely different slice of 93290 (party entertainers, soft play, bouncy
// castle hire/venues, kids' entertainment companies) rather than re-deriving the sports result.
const PARTY_WORDS = /\b(party|parties|entertainer|entertainers|soft play|bouncy castle|inflatable|birthday|face paint(ing|er)?|balloon( modelling| artist)?|magician|disco|mascot|character parties|princess parties|kids? entertainment|childrens? entertainment|play ?centre|play ?center|indoor play|party planner|party hire)\b/i;
const BRAND_WORDS = /\b(mr ?tumble|mad science|ministry of science|kidzania|jump ?in|oxygen freejumping|gravity trampoline|flip out|airhop|bounce below|little gym|the little gym)\b/i;
// PARTY_WORDS alone is already a strong kids-context signal (soft play/bouncy castle/kids entertainment
// are not generic-adult terms), so a PARTY_WORDS hit is sufficient; KIDS_WORDS co-occurrence just makes
// the AMBIGUOUS_PARTY_ONLY check below stricter for the one genuinely ambiguous term, "party" alone
// (which could be an adult events/catering company).
function nameMatches(name) { return PARTY_WORDS.test(name) || BRAND_WORDS.test(name); }

const NOT_FIT_WORDS = /\b(casino|betting|gambling|bingo|adult entertainment|strip(per|club)?|nightclub|licensed bar|hen (do|party)|stag (do|party)|corporate (event|entertainment)s?|wedding (planner|entertainment)|holdings?|investments?|propert(y|ies)|consultancy|recruitment|management services|wholesale|distribut(ion|ors?)|equipment hire only|manufactur(er|ing)|import(er|s)?)\b/i;
const AMBIGUOUS_PARTY_ONLY = (name) => /\bparty|parties\b/i.test(name) && !/\b(kids?|junior|juniors|youth|mini|minis|tots|toddlers?|little|littles|children'?s?|child|birthday|soft play|bouncy castle|face paint|balloon|magician|mascot|entertainer)\b/i.test(name);
function classifyFit(name) {
  const n = name.toLowerCase();
  if (NOT_FIT_WORDS.test(n)) return "likely_not_fit";
  if (AMBIGUOUS_PARTY_ONLY(n)) return "uncertain"; // "party" on its own could be an adult events/catering company
  return "likely_fit";
}

const STOP = new Set("the and of ltd limited cic cio uk plc llp co company".split(" "));
const norm = (s) => String(s || "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(w => w && !STOP.has(w)).join(" ");
const pc = (s) => String(s || "").toUpperCase().replace(/\s+/g, "");
const clean = (s) => String(s || "").replace(/\s+/g, " ").trim();
const title = (s) => clean(s).split(" ").map(w => /^[A-Z0-9&.'-]+$/.test(w) && w.length > 1 ? w[0] + w.slice(1).toLowerCase() : w).join(" ");

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
      const sics = [rec["SICCode.SicText_1"], rec["SICCode.SicText_2"], rec["SICCode.SicText_3"], rec["SICCode.SicText_4"]]
        .map(s => clean(s)).filter(Boolean);
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
    parser.on("end", () => { console.log("rows scanned", total, "| SIC 93290 Active matches", sicMatch, "| excluded (already in a sports pass)", excludedPrior); resolve(high); });
    parser.on("error", reject);
    unzip.on("close", () => {});
  });
}

const high = await streamRows();
console.log("kids-party/entertainment keyword matches (high confidence, not already in a sports pass)", high.length);

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
console.log("high-confidence already a lead", alreadyExists, "| genuinely new", newRows.length);

const buckets = { likely_fit: [], uncertain: [], likely_not_fit: [] };
for (const r of newRows) buckets[classifyFit(r.name)].push(r);
console.log("sub-division of genuinely-new:", Object.fromEntries(Object.entries(buckets).map(([k, v]) => [k, v.length])));

const review = {
  generatedAt: new Date().toISOString(),
  source: `Companies House bulk snapshot ${ZIP} (re-scan of SIC 93290 with kids-party keywords, excluding companies already surfaced by the sports passes)`,
  sicCodesUsed: [...TARGET_SIC],
  note: "Re-uses SIC 93290 ('Other amusement and recreation activities n.e.c.') already scanned by the " +
    "sports passes, but with a distinct kids-party/soft-play/entertainment keyword set (party, entertainer, " +
    "soft play, bouncy castle, face painting, balloon, magician, mascot) instead of sport-name keywords, and " +
    "excludes every company number already surfaced (any bucket) by sports_leads_review.json / " +
    "sports_leads_review_broadened.json / sports_leads_all_high.json to avoid double-reporting. 'Party' on " +
    "its own (no other kids/entertainment qualifier) is flagged uncertain, not likely_fit, since it could be " +
    "an adult events/catering company. Classification is name-only (no web lookups). NOT imported — review only.",
  totals: {
    highConfidenceKeywordMatches: high.length,
    highConfidenceAlreadyExistingLead: alreadyExists,
    highConfidenceGenuinelyNew: newRows.length,
  },
  subDivisionOfGenuinelyNew: {
    likely_fit: buckets.likely_fit.length,
    uncertain: buckets.uncertain.length,
    likely_not_fit: buckets.likely_not_fit.length,
  },
  likely_fit: buckets.likely_fit,
  uncertain: buckets.uncertain,
  likely_not_fit: buckets.likely_not_fit,
};
fs.writeFileSync(`${OUTDIR}/party_entertainment_leads_review.json`, JSON.stringify(review, null, 2));
console.log("wrote", `${OUTDIR}/party_entertainment_leads_review.json`);
console.log(JSON.stringify({ high: high.length, alreadyExists, genuinelyNew: newRows.length, ...review.subDivisionOfGenuinelyNew }));
process.exit(0);
