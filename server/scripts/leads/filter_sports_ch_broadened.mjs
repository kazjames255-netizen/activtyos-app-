// Broadened follow-up pass over the Companies House sports SIC-code matches. Research/discovery
// only — writes a NEW review file, does not touch sports_leads_review.json and does not write to
// Firestore. See filter_sports_ch.mjs for the first pass (1,161 high-confidence / 74,375 low-confidence).
//
// Two changes vs the first pass:
//   a) SIC 85510 ("Sports and recreation education") is treated as a much stronger prior than
//      93120/93190/93290 — for 85510 rows, a standalone "academy" or one of the new kids'-activity
//      context words is enough on its own (the SIC code itself already carries the sport/recreation-
//      education signal). For 93120/93190/93290 rows the stricter original rule still applies
//      (kids word AND sport word both present, or a known brand) — those SIC codes skew adult clubs.
//   b) Expanded keyword list: camp/camps, multi-sport/multisport, standalone academy (85510 only, see
//      above), after-school/after school, breakfast club, wraparound, holiday club, half term,
//      explorers, adventurers, rangers, plus more UK kids-activity franchise brand names.
//
// Usage: node scripts/leads/filter_sports_ch_broadened.mjs
import admin from "firebase-admin"; import fs from "fs"; import path from "path"; import { spawn } from "child_process";
import { parse } from "csv-parse";

const OUTDIR = "scripts/leads/out/companies_house";
const ZIP = fs.readdirSync(OUTDIR).filter(f => /^BasicCompanyDataAsOneFile.*\.zip$/.test(f)).sort().pop();
if (!ZIP) { console.log("no CH bulk zip found in", OUTDIR); process.exit(1); }
const ZIPPATH = path.join(OUTDIR, ZIP);
console.log("using cached CH bulk snapshot (no re-download):", ZIPPATH);

const PRIOR = JSON.parse(fs.readFileSync(`${OUTDIR}/sports_leads_review.json`, "utf8"));
const priorHighCompanyNos = new Set();
for (const r of [...PRIOR.likely_fit, ...PRIOR.uncertain, ...PRIOR.likely_not_fit]) priorHighCompanyNos.add(r.companyNumber);
// Also load the full original high-confidence set (not just the genuinely-new subset) so we don't
// re-report companies already surfaced (even the 43 that matched an existing lead) as "new" findings.
const priorHighAll = JSON.parse(fs.readFileSync(`${OUTDIR}/sports_leads_all_high.json`, "utf8"));
for (const r of priorHighAll) priorHighCompanyNos.add(r.companyNumber);
console.log("prior high-confidence company numbers (excluded from 'newly surfaced')", priorHighCompanyNos.size);

const TARGET_SIC = new Set(["85510", "93120", "93190", "93199", "93290"]);
const STRONG_SIC = new Set(["85510"]); // weighted much more heavily per coordinator's request

// Original rule (kept for 93120/93190/93290, and as one path for 85510 too)
const KIDS_WORDS = /\b(kids?|junior|juniors|youth|mini|minis|tots|toddlers?|little|littles|stars|academy|academies|camp|camps|after ?school|afterschool|holiday club|holiday camp|school of)\b/i;
const SPORT_WORDS = /\b(soccer|football|footy|multi ?sport|multi ?skills|rugby|cricket|tennis|netball|hockey|basketball|athletics|gymnastics|martial arts|karate|taekwondo|judo|swim|swimming|dodgeball|golf|cheerleading|cheer|fencing|badminton|squash|sports? coaching|sports? camp|sport camp)\b/i;
const BRAND_WORDS = /\b(little kickers|rugbytots|soccatots|socatots|diddi ?kick|premier sport|premier education|multi ?skills club|camp beaumont|barracudas|fit4sport|kickstart soccer|activ8|superkicks|footytots|tinykicks|kings camps|king's camps)\b/i;

// New broadened context words (kids'-activity signal on their own, used as the extra path for 85510)
const CONTEXT_WORDS = /\b(camp|camps|multi ?sport|multisport|after ?school|after-school|breakfast club|wraparound|wrap ?around|holiday club|half term|half-term|explorers?|adventurers?|rangers?)\b/i;
const STANDALONE_ACADEMY = /\bacademy|academies\b/i;
const MORE_BRANDS = /\b(little kickers|rugbytots|soccatots|socatots|diddi ?kick|premier sport|premier education|multi ?skills club|camp beaumont|barracudas|fit4sport|kickstart soccer|activ8|superkicks|footytots|tinykicks|kings camps|king'?s camps|little sports stars|tots soccer|soccer tots|funky feet|move ?more|sportivate|energy kidz|kidz ?love ?soccer|little ballers|mini movers|little athletes|tiny tots sport|ready steady go|monkey bizness|jo jingles|gymtots|tumbletots)\b/i;

function classifyBroadened(name, sic) {
  const n = name.toLowerCase();
  const kidsSport = (SPORT_WORDS.test(n) && KIDS_WORDS.test(n)) || BRAND_WORDS.test(n) || MORE_BRANDS.test(n);
  if (kidsSport) return true;
  if (STRONG_SIC.has(sic)) {
    // 85510 already IS a sport/recreation-education SIC — a standalone "academy" or a kids-activity
    // context word is enough on its own without also requiring an explicit sport-name word.
    if (STANDALONE_ACADEMY.test(n) || CONTEXT_WORDS.test(n)) return true;
  } else {
    // Non-85510 (93120/93190/93290): stricter — only the broadened CONTEXT_WORDS combined with an
    // explicit kids word count (still don't want "academy" alone triggering on a sports-club SIC).
    if (CONTEXT_WORDS.test(n) && KIDS_WORDS.test(n)) return true;
  }
  return false;
}

const NOT_FIT_WORDS = /\b(veterans?|over ?3[05]s?|walking football|masters|supporters( club)?|retail|wholesale|distribut(ion|ors?)|equipment|kit supplies|merchandise|holdings?|investments?|propert(y|ies)|consultancy|recruitment|management services|reserves|first team|semi[- ]?pro|professional football|conference league|non[- ]?league)\b/i;
const ADULT_LEAGUE_WORDS = /\b(five ?a ?side|5 ?a ?side|adult league|works league|pub league|sunday league)\b/i;
const AMBIGUOUS_ACADEMY_ONLY = (name) => /academy|academies/i.test(name) && !/\b(junior|juniors|youth|mini|minis|tots|kids?|camp|camps|after ?school|explorers?|adventurers?|rangers?|breakfast club|wraparound|half term)\b/i.test(name);
function classifyFit(name) {
  const n = name.toLowerCase();
  if (NOT_FIT_WORDS.test(n) || ADULT_LEAGUE_WORDS.test(n)) return "likely_not_fit";
  if (AMBIGUOUS_ACADEMY_ONLY(n)) return "uncertain";
  if (/\bf\.?c\.?\b|football club/i.test(n) && !/\b(junior|juniors|youth|mini|minis|tots|kids?|camp|camps|academy|after ?school)\b/i.test(n)) return "uncertain";
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
    const newHigh = []; let total = 0, sicActive = 0, sic85510 = 0, sicOther = 0;
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
      sicActive++;
      const sic = (hit.match(/^\d+/) || [""])[0];
      if (sic === "85510") sic85510++; else sicOther++;
      const companyNumber = rec["CompanyNumber"];
      if (priorHighCompanyNos.has(companyNumber)) continue; // already surfaced in pass 1 — only report NEWLY surfaced here
      const name = title(rec["CompanyName"]);
      if (!classifyBroadened(name, sic)) continue; // still low-confidence even under broadened rules
      newHigh.push({
        name, companyNumber, legalForm: rec["CompanyCategory"], status,
        addressLine: title(rec["RegAddress.AddressLine1"]), town: title(rec["RegAddress.PostTown"]),
        county: title(rec["RegAddress.County"]), country: title(rec["RegAddress.Country"]),
        postcode: pc(rec["RegAddress.PostCode"]) ? clean(rec["RegAddress.PostCode"]).toUpperCase() : "",
        sic, sicText: hit, incorporationDate: rec["IncorporationDate"],
        sourceUrl: `https://find-and-update.company-information.service.gov.uk/company/${companyNumber}`,
        confidence: "high-broadened",
      });
    } });
    parser.on("end", () => { console.log("rows scanned", total, "| active SIC matches", sicActive, "(85510:", sic85510, "| other:", sicOther, ")"); resolve(newHigh); });
    parser.on("error", reject);
    unzip.on("close", () => {});
  });
}

const newHigh = await streamRows();
console.log("newly-surfaced high-confidence matches from broadened rules", newHigh.length,
  "(85510:", newHigh.filter(r => r.sic === "85510").length, "| other:", newHigh.filter(r => r.sic !== "85510").length, ")");

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync("./serviceAccountKey.json", "utf8"))) });
const db = admin.firestore();
const snap = await db.collection("leads").select("name", "companyNumber", "website", "location", "postcode").get();
console.log("existing leads total (fresh read)", snap.size);
const byCompanyNo = new Map(), byName = new Map(), byPcName = new Map();
for (const d of snap.docs) { const x = d.data();
  if (x.companyNumber) byCompanyNo.set(x.companyNumber, d.id);
  const n = norm(x.name); if (n) { if (!byName.has(n)) byName.set(n, []); byName.get(n).push(d.id); }
  const p = pc(x.postcode) || (String(x.location || "").match(/\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i) || [])[1];
  if (p && n) byPcName.set(pc(p) + "|" + n.split(" ").slice(0, 2).join(" "), d.id);
}

let alreadyExists = 0; const newRows = [];
for (const r of newHigh) {
  const n = norm(r.name);
  const key = pc(r.postcode) + "|" + n.split(" ").slice(0, 2).join(" ");
  let id = byCompanyNo.get(r.companyNumber) || (r.postcode && byPcName.get(key)) || null;
  if (!id) { const c = byName.get(n) || []; if (c.length === 1) id = c[0]; }
  if (id) alreadyExists++; else newRows.push(r);
}
console.log("newly-surfaced already a lead", alreadyExists, "| genuinely new", newRows.length);

const buckets = { likely_fit: [], uncertain: [], likely_not_fit: [] };
for (const r of newRows) buckets[classifyFit(r.name)].push(r);
console.log("sub-division of genuinely-new (broadened pass):", Object.fromEntries(Object.entries(buckets).map(([k, v]) => [k, v.length])));

const review = {
  generatedAt: new Date().toISOString(),
  source: `Companies House bulk snapshot ${ZIP} (broadened re-scan of pass-1 low-confidence bucket)`,
  note: "Second pass over the SIC-code matches NOT already surfaced as high-confidence in sports_leads_review.json. " +
    "SIC 85510 is weighted much more heavily (a standalone 'academy' or a kids-activity context word is enough on " +
    "its own, since 85510 already IS a sport/recreation-education SIC code); 93120/93190/93290 kept a stricter rule " +
    "(kids word AND sport word, or a known brand) since those SIC codes skew adult membership clubs. Same caveat as " +
    "pass 1: classification is name-only, no web lookups. NOT imported — for review only.",
  totals: {
    newlySurfacedHighConfidence: newHigh.length,
    newlySurfaced_sic85510: newHigh.filter(r => r.sic === "85510").length,
    newlySurfaced_sicOther: newHigh.filter(r => r.sic !== "85510").length,
    newlySurfacedAlreadyExistingLead: alreadyExists,
    newlySurfacedGenuinelyNew: newRows.length,
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
fs.writeFileSync(`${OUTDIR}/sports_leads_review_broadened.json`, JSON.stringify(review, null, 2));
console.log("wrote", `${OUTDIR}/sports_leads_review_broadened.json`);
console.log(JSON.stringify({ newHigh: newHigh.length, alreadyExists, genuinelyNew: newRows.length, ...review.subDivisionOfGenuinelyNew }));
process.exit(0);
