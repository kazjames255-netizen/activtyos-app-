// Research-only pass: kids' performing-arts (drama/musical theatre/stage school) businesses from the
// Companies House free monthly bulk snapshot, filtered by SIC then a strict kids-signal keyword pass.
// Same pattern as filter_sports_ch.mjs / filter_sports_ch_broadened.mjs — writes a REVIEW file only,
// does NOT write to Firestore.
//
// SIC codes used: 90010 (Performing arts) and 85520 (Cultural education) are the strong signal — both
// are genuinely likely to catch kids' drama/musical-theatre/stage schools. 85590 (Other education n.e.c.)
// is included as a much weaker/noisier signal (it also catches driving schools, language schools,
// corporate training, generic tutoring agencies) so it gets a stricter keyword rule.
// SIC 85320 ("Technical and vocational secondary education" — formal secondary schools/colleges) was
// considered per the brief but dropped: its real SIC 2007 definition doesn't fit after-school/holiday
// activity providers at all, it's registered schools/colleges, out of scope here — forcing it in would
// just add noise, not genuinely-relevant leads.
//
// Kids-only discipline per explicit instruction: require a genuine kids/youth signal in the name for
// likely_fit, not just the SIC matching. Explicitly exclude adult am-dram/operatic/choral societies,
// professional touring theatre companies, orchestras, arts venues, talent/casting agencies, and generic
// training/consultancy — these are common false positives on 90010/85520/85590.
//
// Usage: node scripts/leads/filter_performing_arts_ch.mjs
import admin from "firebase-admin"; import fs from "fs"; import path from "path"; import { spawn } from "child_process";
import { parse } from "csv-parse";

const OUTDIR = "scripts/leads/out/companies_house";
const ZIP = fs.readdirSync(OUTDIR).filter(f => /^BasicCompanyDataAsOneFile.*\.zip$/.test(f)).sort().pop();
if (!ZIP) { console.log("no CH bulk zip found in", OUTDIR); process.exit(1); }
const ZIPPATH = path.join(OUTDIR, ZIP);
console.log("using cached CH bulk snapshot (no re-download):", ZIPPATH);

const STRONG_SIC = new Set(["90010", "85520"]);
const WEAK_SIC = new Set(["85590"]);
const TARGET_SIC = new Set([...STRONG_SIC, ...WEAK_SIC]);

// ── Keyword bucketing ────────────────────────────────────────────────────────
const KIDS_WORDS = /\b(kids?|junior|juniors|youth|mini|minis|tots|toddlers?|little|littles|children'?s?|child|stars|academy|academies|camp|camps|after ?school|afterschool|holiday club|holiday camp|school of)\b/i;
const PERFORMING_WORDS = /\b(drama|theatre|theater|musical theatre|stage school|performing arts|acting|singing|choir|panto|pantomime|music school|music lessons|piano|guitar|violin|dance and drama)\b/i;
const BRAND_WORDS = /\b(razzamataz|stagecoach|theatretrain|theatre train|dramakids|drama kids|helen o'?grady|rocksteady|rock steady music|mini mermaids|littlevoices|little voices|debbie wolowicz|jigsaw performing arts|italia conti junior|sylvia young|urdang junior|pauline quirke academy|pqa)\b/i;
const NAME_KIDS_PERFORMING = (name) => (PERFORMING_WORDS.test(name) && KIDS_WORDS.test(name)) || BRAND_WORDS.test(name);
// For the weaker SIC (85590 "other education n.e.c.") the stricter rule additionally requires an
// explicit activity-provision word so we don't pull in generic tutoring/training-provider matches.
const ACTIVITY_PROVISION_WORDS = /\b(classes|lessons|club|clubs|academy|academies|school of|workshop|workshops|tuition)\b/i;
function nameMatchesForSic(name, sic) {
  if (STRONG_SIC.has(sic)) return NAME_KIDS_PERFORMING(name);
  // weak SIC: same kids+performing rule, but also require an explicit activity-provision word
  return NAME_KIDS_PERFORMING(name) && ACTIVITY_PROVISION_WORDS.test(name.toLowerCase());
}

// ── Sub-division heuristics for the genuinely-new bucket (name-only, no web lookups) ──────────────
const NOT_FIT_WORDS = /\b(orchestra|philharmonic|symphony|opera(tic)?( society| company)?|choral society|amateur dramatic|am[- ]?dram|touring theatre|theatre company|production company|productions? ltd|casting|talent agency|management|holdings?|investments?|propert(y|ies)|consultancy|recruitment|training provider|apprenticeship|driving school|language school|tutoring agency|exam board|corporate training|arts centre|arts venue|festival|conservatoire|drama school( of)? (professional|vocational)|vocational training)\b/i;
const ADULT_SOCIETY_WORDS = /\b(operatic society|dramatic society|players( society)?|thespians|musical society|choral union)\b/i;
const AMBIGUOUS_ACADEMY_ONLY = (name) => /academy|academies/i.test(name) && !/\b(junior|juniors|youth|mini|minis|tots|kids?|child|camp|camps|after ?school|explorers?|adventurers?|rangers?|breakfast club|wraparound|half term)\b/i.test(name);
function classifyFit(name) {
  const n = name.toLowerCase();
  if (NOT_FIT_WORDS.test(n) || ADULT_SOCIETY_WORDS.test(n)) return "likely_not_fit";
  if (AMBIGUOUS_ACADEMY_ONLY(n)) return "uncertain";
  if (/\btheatre company\b|\bdrama group\b/i.test(n) && !/\b(junior|juniors|youth|mini|minis|tots|kids?|child|camp|camps|academy|after ?school)\b/i.test(n)) return "uncertain";
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
    const high = []; let total = 0, sicMatch = 0, active = 0, strong = 0, weak = 0;
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
      const sic = (hit.match(/^\d+/) || [""])[0];
      if (STRONG_SIC.has(sic)) strong++; else weak++;
      const name = title(rec["CompanyName"]);
      if (!nameMatchesForSic(name, sic)) continue;
      high.push({
        name, companyNumber: rec["CompanyNumber"], legalForm: rec["CompanyCategory"], status,
        addressLine: title(rec["RegAddress.AddressLine1"]), town: title(rec["RegAddress.PostTown"]),
        county: title(rec["RegAddress.County"]), country: title(rec["RegAddress.Country"]),
        postcode: pc(rec["RegAddress.PostCode"]) ? clean(rec["RegAddress.PostCode"]).toUpperCase() : "",
        sic, sicText: hit, incorporationDate: rec["IncorporationDate"],
        sourceUrl: `https://find-and-update.company-information.service.gov.uk/company/${rec["CompanyNumber"]}`,
        confidence: "high",
      });
    } });
    parser.on("end", () => { console.log("rows scanned", total, "| SIC matches Active", sicMatch, "(strong 90010/85520:", strong, "| weak 85590:", weak, ")"); resolve(high); });
    parser.on("error", reject);
    unzip.on("close", () => {});
  });
}

const high = await streamRows();
console.log("kids-performing-arts keyword matches (high confidence)", high.length);

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
  source: `Companies House bulk snapshot ${ZIP}`,
  sicCodesUsed: [...TARGET_SIC],
  note: "SIC 90010 (Performing arts) and 85520 (Cultural education) treated as strong signal (kids+performing " +
    "keyword or known franchise brand required). SIC 85590 (Other education n.e.c.) treated as weak/noisy — " +
    "same kids+performing rule PLUS an explicit activity-provision word (classes/lessons/club/academy/tuition/" +
    "workshop) required, to keep out generic tutoring/training-provider/driving-school matches that also sit " +
    "on 85590. SIC 85320 (technical/vocational secondary education) was investigated and dropped — its real " +
    "definition is formal secondary schools/colleges, not after-school activity providers, out of scope. " +
    "Classification is name-only (no web lookups). NOT imported — for review only.",
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
fs.writeFileSync(`${OUTDIR}/performing_arts_leads_review.json`, JSON.stringify(review, null, 2));
console.log("wrote", `${OUTDIR}/performing_arts_leads_review.json`);
console.log(JSON.stringify({ high: high.length, alreadyExists, genuinelyNew: newRows.length, ...review.subDivisionOfGenuinelyNew }));
process.exit(0);
