// Research-only pass: SIC 88910 "Child day-care activities" from the Companies House free monthly
// bulk snapshot, cross-checked against the existing `leads` collection. Same pattern as
// filter_sports_ch.mjs — writes a REVIEW file only, does NOT write to Firestore.
//
// Expectation going in: this SIC code is heavily overlapped by the Ofsted Early Years / Childcare
// register import already in `leads` (import_registers.mjs / childminders.mjs) — most genuine child
// day-care/nursery/creche/holiday-scheme operators that trade in England are legally required to be
// Ofsted-registered, so they should already be in the DB via that route. This pass exists to (a) catch
// the minority that Companies House knows about but the register import missed/mismatched on name, and
// (b) explicitly filter out the SIC's known false positives (elderly/adult day-care self-classifies
// under 88910 sometimes despite the "child" label; holding companies; management/franchise HQ shells
// with no trading premises).
//
// Usage: node scripts/leads/filter_daycare_ch.mjs
import admin from "firebase-admin"; import fs from "fs"; import path from "path"; import { spawn } from "child_process";
import { parse } from "csv-parse";

const OUTDIR = "scripts/leads/out/companies_house";
const ZIP = fs.readdirSync(OUTDIR).filter(f => /^BasicCompanyDataAsOneFile.*\.zip$/.test(f)).sort().pop();
if (!ZIP) { console.log("no CH bulk zip found in", OUTDIR); process.exit(1); }
const ZIPPATH = path.join(OUTDIR, ZIP);
console.log("using cached CH bulk snapshot (no re-download):", ZIPPATH);

const TARGET_SIC = new Set(["88910"]);

// The SIC itself IS "child day-care activities" — so unlike the sports/performing-arts passes we don't
// require an extra kids keyword to call something "high confidence" on this SIC. Instead we actively
// look for and exclude the known false-positive patterns (adult/elderly day-care, holding companies).
const ADULT_ELDERLY_WORDS = /\b(elderly|senior citizens?|over ?6[05]s?|dementia|adult day ?care|care home|residential care|disability day services|mental health|elder(ly)? care|supported living|domiciliary care|home care|live[- ]?in care)\b/i;
const SHELL_WORDS = /\b(holdings?|investments?|propert(y|ies)|group( ltd| limited)?|consultancy|recruitment|management services|franchis(e|ing) (ltd|limited)|head office|trustee(s)?)\b/i;
const KIDS_CONFIRM_WORDS = /\b(nursery|nurseries|creche|crèche|childcare|child care|pre[- ]?school|preschool|playgroup|play ?group|kids?|children'?s?|little|littles|tots|montessori|kindergarten|out of school|wraparound|wrap ?around|holiday club|holiday scheme|breakfast club|after ?school)\b/i;

function classifyFit(name) {
  const n = name.toLowerCase();
  if (ADULT_ELDERLY_WORDS.test(n)) return "likely_not_fit";
  if (SHELL_WORDS.test(n)) return "uncertain"; // could be a real operator's holding entity, but no trading signal in the name
  if (KIDS_CONFIRM_WORDS.test(n)) return "likely_fit";
  // SIC says child day-care but name has no confirming word and isn't an obvious shell/adult-care —
  // still plausible (many nurseries just use a person's/place's name) but no positive signal either way.
  return "uncertain";
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
    const rows = []; let total = 0, sicMatch = 0, active = 0;
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
      rows.push({
        name, companyNumber: rec["CompanyNumber"], legalForm: rec["CompanyCategory"], status,
        addressLine: title(rec["RegAddress.AddressLine1"]), town: title(rec["RegAddress.PostTown"]),
        county: title(rec["RegAddress.County"]), country: title(rec["RegAddress.Country"]),
        postcode: pc(rec["RegAddress.PostCode"]) ? clean(rec["RegAddress.PostCode"]).toUpperCase() : "",
        sic: (hit.match(/^\d+/) || [""])[0], sicText: hit, incorporationDate: rec["IncorporationDate"],
        sourceUrl: `https://find-and-update.company-information.service.gov.uk/company/${rec["CompanyNumber"]}`,
        confidence: "sic-only-88910",
      });
    } });
    parser.on("end", () => { console.log("rows scanned", total, "| SIC 88910 matches (any status)", sicMatch, "| Active", active); resolve(rows); });
    parser.on("error", reject);
    unzip.on("close", () => {});
  });
}

const rows = await streamRows();
console.log("SIC 88910 Active companies", rows.length);

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
for (const r of rows) {
  const n = norm(r.name);
  const key = pc(r.postcode) + "|" + n.split(" ").slice(0, 2).join(" ");
  let id = byCompanyNo.get(r.companyNumber) || (r.postcode && byPcName.get(key)) || null;
  if (!id) { const c = byName.get(n) || []; if (c.length === 1) id = c[0]; }
  if (id) alreadyExists++; else newRows.push(r);
}
console.log("SIC 88910 already a lead (mostly via Ofsted register import)", alreadyExists, "| genuinely new", newRows.length);

const buckets = { likely_fit: [], uncertain: [], likely_not_fit: [] };
for (const r of newRows) buckets[classifyFit(r.name)].push(r);
console.log("sub-division of genuinely-new:", Object.fromEntries(Object.entries(buckets).map(([k, v]) => [k, v.length])));

const review = {
  generatedAt: new Date().toISOString(),
  source: `Companies House bulk snapshot ${ZIP}`,
  sicCodesUsed: [...TARGET_SIC],
  note: "SIC 88910 IS 'Child day-care activities' so, unlike the sports/dance/performing-arts passes, " +
    "the SIC match itself is taken as a positive signal rather than requiring a separate keyword hit. " +
    "This code has heavy expected overlap with the existing Ofsted Early Years/Childcare register import " +
    "already in `leads` — see totals.sicMatchAlreadyExistingLead. Explicitly excluded (likely_not_fit): " +
    "adult/elderly/dementia/disability day-care wording, since 88910 sometimes gets self-misapplied to " +
    "adult care businesses. Flagged uncertain rather than likely_fit: holding-company/management/group " +
    "wording (no trading signal), and names with no explicit childcare word at all (SIC-only signal, " +
    "could still be a real nursery that just uses a personal/place name — err toward caution per brief). " +
    "Classification is name-only (no web lookups). NOT imported — for review only.",
  totals: {
    sic88910ActiveMatches: rows.length,
    sicMatchAlreadyExistingLead: alreadyExists,
    sicMatchGenuinelyNew: newRows.length,
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
fs.writeFileSync(`${OUTDIR}/daycare_leads_review.json`, JSON.stringify(review, null, 2));
console.log("wrote", `${OUTDIR}/daycare_leads_review.json`);
console.log(JSON.stringify({ sic88910: rows.length, alreadyExists, genuinelyNew: newRows.length, ...review.subDivisionOfGenuinelyNew }));
process.exit(0);
