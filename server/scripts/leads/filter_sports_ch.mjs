// Research-only pass: find UK kids' sports-coaching businesses (SIC-code net) from the Companies
// House free monthly bulk snapshot, cross-check against the existing `leads` collection, and write
// a REVIEW file for a human to look at. This does NOT write to Firestore.
//
// Context: Kickoff Sports (kickoffsports.co.uk) — a real football-coaching/holiday-camp business
// for kids — doesn't appear anywhere in the leads DB, because standalone sports-coaching businesses
// that run their own booking and are exempt from Ofsted registration fall through every existing
// source (Ofsted/CIW/CI/NI registers, HAF lists, eequ/Pebble/Playwaze/Yellow Days directories).
// This mirrors the dance-school Companies House exercise (import_companies_house.mjs / dance_leads.json)
// but for sports SIC codes, and additionally sub-divides the "new, high-confidence" bucket into
// likely-fit / uncertain / likely-not-fit using name-only heuristics (no web lookups this pass).
//
// Usage: node scripts/leads/filter_sports_ch.mjs
// Input: out/companies_house/BasicCompanyDataAsOneFile-*.zip (CH free bulk snapshot, downloaded fresh
//   this run — the dance-scrape's cached artifact was already the filtered dance_leads.json, not the
//   raw ~2.8GB CSV, so there was nothing to reuse there).
// Output: out/companies_house/sports_leads_review.json (reviewable, NOT imported)
import admin from "firebase-admin"; import fs from "fs"; import path from "path"; import { spawn } from "child_process";
import { parse } from "csv-parse";

const OUTDIR = "scripts/leads/out/companies_house";
const ZIP = fs.readdirSync(OUTDIR).filter(f => /^BasicCompanyDataAsOneFile.*\.zip$/.test(f)).sort().pop();
if (!ZIP) { console.log("no CH bulk zip found in", OUTDIR); process.exit(1); }
const ZIPPATH = path.join(OUTDIR, ZIP);
console.log("using CH bulk snapshot:", ZIPPATH, (fs.statSync(ZIPPATH).size / 1e6).toFixed(0), "MB (zipped)");

// SIC codes considered relevant to sports coaching/activity provision for children.
// 85510 already used for dance (sports & recreation education — also fits coaching schools).
// 93120 activities of sports clubs; 93190/93199 other sports activities; 93290 other amusement &
// recreation activities n.e.c. (93299 does not exist as a distinct SIC 2007 code — folds into 93290).
const TARGET_SIC = new Set(["85510", "93120", "93190", "93199", "93290"]);

// ── Keyword bucketing ────────────────────────────────────────────────────────
// High confidence = a kids/youth signal AND a sport/coaching signal both present in the name,
// or a known kids-sports-coaching franchise brand pattern.
const KIDS_WORDS = /\b(kids?|junior|juniors|youth|mini|minis|tots|toddlers?|little|littles|stars|academy|academies|camp|camps|after ?school|afterschool|holiday club|holiday camp|school of)\b/i;
const SPORT_WORDS = /\b(soccer|football|footy|multi ?sport|multi ?skills|rugby|cricket|tennis|netball|hockey|basketball|athletics|gymnastics|martial arts|karate|taekwondo|judo|swim|swimming|dodgeball|golf|cheerleading|cheer|fencing|badminton|squash|sports? coaching|sports? camp|sport camp)\b/i;
// Known UK kids-sports-coaching franchise/brand name fragments (from general knowledge, not web-verified this pass).
const BRAND_WORDS = /\b(little kickers|rugbytots|soccatots|socatots|diddi ?kick|premier sport|premier education|multi ?skills club|camp beaumont|barracudas|fit4sport|kickstart soccer|activ8|superkicks|footytots|tinykicks)\b/i;
const NAME_KIDS_SPORT = (name) => (SPORT_WORDS.test(name) && KIDS_WORDS.test(name)) || BRAND_WORDS.test(name);

// ── Sub-division heuristics for the new/high-confidence bucket (name + status only, no web calls) ──
const NOT_FIT_WORDS = /\b(veterans?|over ?3[05]s?|walking football|masters|supporters( club)?|retail|wholesale|distribut(ion|ors?)|equipment|kit supplies|merchandise|holdings?|investments?|propert(y|ies)|consultancy|recruitment|management services|ladies\b.*\bfc\b|reserves|first team|semi[- ]?pro|professional football|conference league|non[- ]?league)\b/i;
const ADULT_LEAGUE_WORDS = /\b(five ?a ?side|5 ?a ?side|adult league|works league|pub league|sunday league)\b/i;
// "Academy" alone (no explicit kids word beyond Academy itself) is genuinely ambiguous — could be a
// pro club's academy (semi-pro/elite pathway) or a kids' multi-sport academy. Flag as uncertain unless
// another clear kids signal (junior/youth/mini/camp/after school) co-occurs.
const AMBIGUOUS_ACADEMY_ONLY = (name) => /academy|academies/i.test(name) && !/\b(junior|juniors|youth|mini|minis|tots|kids?|camp|camps|after ?school)\b/i.test(name);

function classifyFit(name) {
  const n = name.toLowerCase();
  if (NOT_FIT_WORDS.test(n) || ADULT_LEAGUE_WORDS.test(n)) return "likely_not_fit";
  if (AMBIGUOUS_ACADEMY_ONLY(n)) return "uncertain";
  // "FC" / "Football Club" alone without an unambiguous kids marker beyond generic ones is uncertain
  if (/\bf\.?c\.?\b|football club/i.test(n) && !/\b(junior|juniors|youth|mini|minis|tots|kids?|camp|camps|academy|after ?school)\b/i.test(n)) return "uncertain";
  return "likely_fit";
}

const STOP = new Set("the and of ltd limited cic cio uk plc llp co company".split(" "));
const norm = (s) => String(s || "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(w => w && !STOP.has(w)).join(" ");
const pc = (s) => String(s || "").toUpperCase().replace(/\s+/g, "");
const clean = (s) => String(s || "").replace(/\s+/g, " ").trim();
const title = (s) => clean(s).split(" ").map(w => /^[A-Z0-9&.'-]+$/.test(w) && w.length > 1 ? w[0] + w.slice(1).toLowerCase() : w).join(" ");

// ── Stream-parse the zip (unzip -p avoids writing a ~2.8GB extracted CSV to disk) ──────────────────
function streamRows() {
  return new Promise((resolve, reject) => {
    const unzip = spawn("unzip", ["-p", ZIPPATH]);
    const parser = parse({ columns: (hdr) => hdr.map(h => h.replace(/^﻿/, "").trim()), relax_quotes: true, relax_column_count: true, skip_empty_lines: true });
    const high = [], low = []; let total = 0, sicMatch = 0, active = 0;
    unzip.stdout.pipe(parser);
    unzip.on("error", reject);
    unzip.stderr.on("data", () => {});
    parser.on("readable", () => { let rec; while ((rec = parser.read()) !== null) {
      total++;
      const status = clean(rec["CompanyStatus"]);
      const sics = [rec["SICCode.SicText_1"], rec["SICCode.SicText_2"], rec["SICCode.SicText_3"], rec["SICCode.SicText_4"]]
        .map(s => clean(s)).filter(Boolean);
      const hit = sics.find(s => TARGET_SIC.has((s.match(/^\d+/) || [""])[0]));
      if (!hit) continue;
      sicMatch++;
      if (status !== "Active") continue;
      active++;
      const name = title(rec["CompanyName"]);
      const row = {
        name, companyNumber: rec["CompanyNumber"], legalForm: rec["CompanyCategory"], status,
        addressLine: title(rec["RegAddress.AddressLine1"]), town: title(rec["RegAddress.PostTown"]),
        county: title(rec["RegAddress.County"]), country: title(rec["RegAddress.Country"]),
        postcode: pc(rec["RegAddress.PostCode"]) ? clean(rec["RegAddress.PostCode"]).toUpperCase() : "",
        sic: (hit.match(/^\d+/) || [""])[0], sicText: hit, incorporationDate: rec["IncorporationDate"],
        sourceUrl: `https://find-and-update.company-information.service.gov.uk/company/${rec["CompanyNumber"]}`,
      };
      if (NAME_KIDS_SPORT(name)) { row.confidence = "high"; high.push(row); } else { row.confidence = "low"; low.push(row); }
    } });
    parser.on("end", () => { console.log("rows scanned", total, "| SIC matches (any status)", sicMatch, "| SIC matches Active", active); resolve({ high, low }); });
    parser.on("error", reject);
    unzip.on("close", (code) => { if (code !== 0 && code !== null) console.log("unzip exit code", code); });
  });
}

const { high, low } = await streamRows();
console.log("high-confidence (kids+sport keyword)", high.length, "| low-confidence (SIC only)", low.length);
fs.writeFileSync(`${OUTDIR}/sports_leads_all_high.json`, JSON.stringify(high, null, 2));
fs.writeFileSync(`${OUTDIR}/sports_leads_all_low_count.json`, JSON.stringify({ count: low.length, sample: low.slice(0, 50) }, null, 2));

// ── Cross-check high-confidence bucket against existing `leads` collection ─────────────────────────
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
  if (id) { alreadyExists++; } else { newRows.push(r); }
}
console.log("high-confidence already a lead", alreadyExists, "| genuinely new", newRows.length);

// ── Sub-divide the genuinely-new high-confidence bucket ────────────────────────────────────────────
const buckets = { likely_fit: [], uncertain: [], likely_not_fit: [] };
for (const r of newRows) buckets[classifyFit(r.name)].push(r);
console.log("sub-division of new/high-confidence:", Object.fromEntries(Object.entries(buckets).map(([k, v]) => [k, v.length])));

const review = {
  generatedAt: new Date().toISOString(),
  source: `Companies House bulk snapshot ${ZIP}`,
  sicCodesUsed: [...TARGET_SIC],
  totals: {
    sicCodeMatches_anyStatus: undefined, // filled below if needed
    highConfidenceKeywordMatches: high.length,
    lowConfidenceKeywordMatches: low.length,
    highConfidenceAlreadyExistingLead: alreadyExists,
    highConfidenceGenuinelyNew: newRows.length,
  },
  subDivisionOfGenuinelyNew: {
    likely_fit: buckets.likely_fit.length,
    uncertain: buckets.uncertain.length,
    likely_not_fit: buckets.likely_not_fit.length,
  },
  note: "Classification (likely_fit / uncertain / likely_not_fit) is derived ONLY from the company name " +
    "(plus status=Active, which is already filtered) — no website visits or additional lookups were done " +
    "this pass. Treat 'likely_fit' as a shortlist to sanity-check, not a ready-to-import list. The " +
    "low-confidence bucket (SIC match, no kids/sport keyword) is NOT included in full — it is large and " +
    "dominated by adult leagues/clubs, gyms, generic sports clubs, and misclassified retailers; only a " +
    "count + small sample is kept, in sports_leads_all_low_count.json.",
  likely_fit: buckets.likely_fit,
  uncertain: buckets.uncertain,
  likely_not_fit: buckets.likely_not_fit,
};
fs.writeFileSync(`${OUTDIR}/sports_leads_review.json`, JSON.stringify(review, null, 2));
console.log("wrote", `${OUTDIR}/sports_leads_review.json`);
console.log(JSON.stringify({
  sicMatchesAllStatus: undefined, high: high.length, low: low.length, alreadyExists, genuinelyNew: newRows.length,
  likely_fit: buckets.likely_fit.length, uncertain: buckets.uncertain.length, likely_not_fit: buckets.likely_not_fit.length,
}));
process.exit(0);
