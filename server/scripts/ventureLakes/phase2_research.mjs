// VENTURE CYCLE PROJECT (Phase 2) — per-site research pass over the top 150
// ventureLakes docs by acreage (the sites most comparable to or larger than
// Willen Lake, MK = 150 acres, the business's own benchmark). For each site,
// runs a small, budget-conscious number of Brave Search API queries and
// extracts: owner/manager, concession/tender process, onsite competition
// (flagging existing cycle hire specifically), pricing signals, path/trail
// suitability, parking, protected status, and a rough review-count footfall
// proxy — then writes a plain-English verdict and stamps the doc.
//
// Resumable / incremental: writes each site's Phase 2 fields to Firestore
// immediately after research (not batched at the end), and appends one JSON
// line per site to out/phase2.out.jsonl for a full audit trail + query-count
// accounting. Re-running skips docs that already have phase2CheckedAt unless
// --force is passed.
//
//   node scripts/ventureLakes/phase2_research.mjs [--limit N] [--force] [--dry]
//
// Brave Search API: BRAVE_SEARCH_API_KEY in server/.env. Free tier is 1 req/s
// — this script paces itself at ~1 req/1.1s regardless of concurrency (run
// serially) to stay under that and under the docs' "don't overspend" budget
// (2-4 queries/site; a query BUDGET_PER_SITE below, default 3, times up to
// 150 sites is <= 450 total, tracked and printed at the end).
import "dotenv/config";
import admin from "firebase-admin";
import fs from "node:fs";
import path from "node:path";

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync("./serviceAccountKey.json", "utf8"))) });
const db = admin.firestore();

const args = Object.fromEntries(
  process.argv.slice(2).map((a, i, arr) => (a.startsWith("--") ? [a.slice(2), arr[i + 1] && !arr[i + 1].startsWith("--") ? arr[i + 1] : true] : [])).filter((x) => x.length)
);
const LIMIT = args.limit ? +args.limit : Infinity;
const FORCE = !!args.force;
const DRY = !!args.dry;
const TOP_N = args.top ? +args.top : 150;

const API_KEY = process.env.BRAVE_SEARCH_API_KEY || "";
if (!API_KEY) { console.error("BRAVE_SEARCH_API_KEY not set in server/.env — aborting."); process.exit(1); }

const OUT_DIR = path.resolve("scripts/ventureLakes/out");
fs.mkdirSync(OUT_DIR, { recursive: true });
const OUT_FILE = path.join(OUT_DIR, "phase2.out.jsonl");
const outStream = fs.createWriteStream(OUT_FILE, { flags: "a" });

let queryCount = 0;
let lastCallAt = 0;
const MIN_GAP_MS = 1100; // free-tier 1 req/s + margin

async function braveSearch(q) {
  const wait = MIN_GAP_MS - (Date.now() - lastCallAt);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCallAt = Date.now();
  queryCount++;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const r = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(q)}&country=GB&search_lang=en&count=10&safesearch=moderate`,
      { signal: ctrl.signal, headers: { accept: "application/json", "accept-encoding": "gzip", "x-subscription-token": API_KEY } }
    );
    if (r.status === 429) {
      // Back off hard and retry once — free tier is strict.
      await new Promise((res) => setTimeout(res, 3000));
      return braveSearch(q);
    }
    if (r.status !== 200) return { status: r.status, results: [] };
    const j = await r.json();
    return { status: 200, results: (j.web?.results ?? []).map((x) => ({ url: x.url, title: x.title || "", desc: x.description || "" })) };
  } catch (e) {
    return { status: 0, results: [], err: String(e?.name || e).slice(0, 60) };
  } finally {
    clearTimeout(t);
  }
}

const decode = (s) =>
  String(s || "")
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (m, n) => String.fromCharCode(+n))
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/<[^>]+>/g, "");

function allText(results) {
  return results.map((r) => `${decode(r.title)} ${decode(r.desc)} ${r.url}`).join(" \n ");
}

// --- Extraction heuristics -------------------------------------------------

const OWNER_PATTERNS = [
  { rx: /national trust/i, label: "National Trust" },
  { rx: /canal (&|and) river trust/i, label: "Canal & River Trust" },
  { rx: /forestry england|forestry commission/i, label: "Forestry England" },
  { rx: /wildlife trust/i, label: "Wildlife Trust" },
  { rx: /rspb/i, label: "RSPB" },
  { rx: /\bcity council\b/i, label: "City Council" },
  { rx: /\bcounty council\b/i, label: "County Council" },
  { rx: /\bborough council\b/i, label: "Borough Council" },
  { rx: /\bdistrict council\b/i, label: "District Council" },
  { rx: /\bparish council\b/i, label: "Parish Council" },
  { rx: /\bcouncil\b/i, label: "Council (unspecified)" },
  { rx: /environment agency/i, label: "Environment Agency" },
  { rx: /woodland trust/i, label: "Woodland Trust" },
  { rx: /\btrust\b/i, label: "Trust (unspecified)" },
  { rx: /country park (authority|trust)/i, label: "Country Park Authority/Trust" },
  { rx: /private estate|privately owned|private landowner/i, label: "Private estate" },
];

function extractOwner(text) {
  for (const p of OWNER_PATTERNS) if (p.rx.test(text)) return p.label;
  return null;
}

const CYCLE_HIRE_RX = /(bike|cycle) hire|hire (bike|bikes|cycles)|cycling hire|pedal ?bike hire/i;
const BOAT_HIRE_RX = /boat hire|pedalo|rowing boat|canoe hire|kayak hire|paddleboard hire|sup hire/i;
const WATERSPORTS_RX = /watersports?|water sports?|sailing club|windsurfing/i;
const CAFE_RX = /\bcaf[eé]\b|coffee shop|tea room|restaurant on site/i;
const ADVENTURE_RX = /adventure (golf|play|park)|zip ?wire|high ?ropes|aerial (trek|adventure)|treetop/i;
const FISHING_RX = /fishing (lake|permit|club)|angling/i;
const PLAYGROUND_RX = /play ?ground|play area/i;
const PARKING_RX = /car park[^.]{0,80}/i;
const PARKING_SPACES_RX = /(\d{2,4})\s*(space|car park space|parking space)/i;
const PROTECTED_RX = [
  { rx: /\bsssi\b|site of special scientific interest/i, label: "SSSI" },
  { rx: /local nature reserve|\blnr\b/i, label: "Local Nature Reserve" },
  { rx: /national nature reserve|\bnnr\b/i, label: "National Nature Reserve" },
  { rx: /green belt/i, label: "Green Belt" },
  { rx: /special area of conservation|\bsac\b/i, label: "SAC" },
  { rx: /ramsar/i, label: "Ramsar site" },
  { rx: /scheduled (ancient )?monument/i, label: "Scheduled Monument" },
  { rx: /site of special scientific interest|ssm|conservation area/i, label: "Conservation Area" },
];
const TENDER_RX = /(concession|tender|procurement|expression of interest|lease (opportunity|available)|commercial opportunit(y|ies)|operator wanted|invitation to tender)/i;
const TRAIL_RX = /(cycle path|cycling trail|cycle trail|off.?road trail|perimeter path|circular (walk|route|path|trail)|shared use path|multi.?use trail|national cycle network|\bncn\b)/i;
const REVIEW_COUNT_RX = /([\d,]{2,6})\s*(google\s*)?reviews?/i;

function extractPricing(text) {
  const m = text.match(/£\s?\d{1,3}(\.\d{2})?\s*(per|\/|for)?\s*(hour|hr|day|session|half.?day)?/gi);
  return m ? [...new Set(m.map((s) => s.trim()))].slice(0, 6).join("; ") : null;
}

function extractCompetition(text) {
  const found = [];
  if (BOAT_HIRE_RX.test(text)) found.push("boat/pedalo/canoe hire");
  if (WATERSPORTS_RX.test(text)) found.push("watersports club");
  if (CAFE_RX.test(text)) found.push("café");
  if (ADVENTURE_RX.test(text)) found.push("adventure activities (ropes/golf/zipwire)");
  if (FISHING_RX.test(text)) found.push("fishing/angling");
  if (PLAYGROUND_RX.test(text)) found.push("playground");
  return found;
}

function extractProtectedStatus(text) {
  const found = [];
  for (const p of PROTECTED_RX) if (p.rx.test(text)) found.push(p.label);
  return [...new Set(found)];
}

function extractParking(text) {
  const m = text.match(PARKING_RX);
  const spaces = text.match(PARKING_SPACES_RX);
  if (!m && !spaces) return null;
  let note = m ? decode(m[0]).replace(/\s+/g, " ").slice(0, 140) : "Car park mentioned";
  if (spaces) note += ` (~${spaces[1]} spaces)`;
  return note;
}

function extractReviewCount(text) {
  const m = text.match(REVIEW_COUNT_RX);
  if (!m) return null;
  const n = parseInt(m[1].replace(/,/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

function extractTrail(text) {
  return TRAIL_RX.test(text);
}

function extractTender(text) {
  return TENDER_RX.test(text) ? text.match(new RegExp(`.{0,80}${TENDER_RX.source}.{0,80}`, "i"))?.[0]?.replace(/\s+/g, " ").trim() ?? "mentioned" : null;
}

function buildVerdict({ owner, hasCycleHireAlready, competitionOnsite, pathSuitability, parkingNotes, protectedStatus, concessionInfo }) {
  const positives = [];
  const negatives = [];
  if (owner) positives.push(`managed by ${owner}`); else negatives.push("owner/manager not identified");
  if (!hasCycleHireAlready) positives.push("no existing cycle hire found"); else negatives.push("cycle hire already operating onsite (direct competitor)");
  if (competitionOnsite.length) positives.push(`existing concessions onsite (${competitionOnsite.join(", ")}) suggest commercial activity is permitted`);
  if (pathSuitability) positives.push("path/trail infrastructure found"); else negatives.push("no clear path/trail evidence found");
  if (parkingNotes) positives.push("car park present"); else negatives.push("parking not confirmed");
  if (protectedStatus.length) negatives.push(`protected status (${protectedStatus.join(", ")}) may restrict commercial structures`);
  if (concessionInfo) positives.push("evidence of a concession/tender process existing at this site");

  const fit = negatives.some((n) => n.includes("cycle hire already")) || negatives.length > positives.length ? "Weaker fit" : positives.length >= 3 ? "Good fit" : "Possible fit";
  const summary = `${fit}: ${[...positives, ...negatives].slice(0, 5).join("; ")}.`;
  return summary;
}

async function researchSite(site) {
  const name = site.name;
  const loc = [site.locality, site.postcode].filter(Boolean).join(", ");
  const qBase = `"${name}" ${loc}`.trim();

  // Query 1: owner/management + protected status + general info.
  const q1 = `${qBase} managed by owner`;
  const r1 = await braveSearch(q1);

  // Query 2: activities/concessions onsite (boat hire, cycle hire, cafe, watersports, parking).
  const q2 = `${qBase} cycle hire boat hire activities car park`;
  const r2 = await braveSearch(q2);

  let combined = allText([...r1.results, ...r2.results]);

  // Query 3 (conditional): if nothing useful yet, or to specifically check
  // for a concession/tender process + reviews, spend one more targeted query.
  let r3 = { results: [] };
  if (combined.trim().length < 400 || !TENDER_RX.test(combined)) {
    const q3 = `${qBase} reviews concession tender lease`;
    r3 = await braveSearch(q3);
    combined = allText([...r1.results, ...r2.results, ...r3.results]);
  }

  const owner = extractOwner(combined);
  const hasCycleHireAlready = CYCLE_HIRE_RX.test(combined);
  const competitionOnsite = extractCompetition(combined);
  const pricingNotes = extractPricing(combined);
  const pathSuitability = extractTrail(combined);
  const parkingNotes = extractParking(combined);
  const protectedStatus = extractProtectedStatus(combined);
  const reviewCountApprox = extractReviewCount(combined);
  const concessionInfo = extractTender(combined);

  const verdict = buildVerdict({ owner, hasCycleHireAlready, competitionOnsite, pathSuitability, parkingNotes, protectedStatus, concessionInfo });

  const update = {
    owner: owner || "Unknown — not identified from search",
    concessionInfo: concessionInfo || "No concession/tender process found in search results",
    competitionOnsite: competitionOnsite.length ? competitionOnsite : ["None found in search results"],
    hasCycleHireAlready,
    pricingNotes: pricingNotes || "No pricing found in search results",
    pathSuitability: pathSuitability ? "Path/trail infrastructure referenced in search results" : "No clear path/trail evidence found",
    parkingNotes: parkingNotes || "Not confirmed in search results",
    protectedStatus: protectedStatus.length ? protectedStatus : ["None found"],
    reviewCountApprox: reviewCountApprox ?? null,
    verdict,
    phase2CheckedAt: new Date().toISOString(),
    phase2QueryCount: r3.results.length ? 3 : 2,
  };

  return { update, raw: { q1, q2, q3: r3.results.length ? "used" : "skipped" } };
}

async function main() {
  const snap = await db.collection("ventureLakes").orderBy("acres", "desc").get();
  const all = snap.docs.map((d) => ({ id: d.id, ref: d.ref, ...d.data() })).filter((v) => !v.excluded);
  const top = all.slice(0, TOP_N);
  console.log(`Top ${TOP_N} sites by acreage loaded (of ${all.length} total non-excluded docs).`);

  const eligible = top.filter((s) => FORCE || !s.phase2CheckedAt);
  const alreadyDone = top.length - eligible.length;
  const todo = eligible.slice(0, LIMIT);
  console.log(`${todo.length} sites to research this run (${alreadyDone} already have phase2CheckedAt and are skipped; use --force to redo).`);

  let done = 0;
  let cycleHireCount = 0;
  let ownerKnownCount = 0;

  for (const site of todo) {
    try {
      const { update, raw } = await researchSite(site);
      if (!DRY) await site.ref.update(update);
      done++;
      if (update.hasCycleHireAlready) cycleHireCount++;
      if (update.owner && !update.owner.startsWith("Unknown")) ownerKnownCount++;
      outStream.write(JSON.stringify({ id: site.id, name: site.name, acres: site.acres, ...update, queries: raw }) + "\n");
      console.log(`[${done}/${todo.length}] ${site.name} (${site.acres.toFixed(0)} acres) — owner: ${update.owner} | cycleHire: ${update.hasCycleHireAlready} | queries so far: ${queryCount}`);
    } catch (e) {
      console.error(`  FAILED ${site.name}: ${e.message}`);
      outStream.write(JSON.stringify({ id: site.id, name: site.name, error: String(e.message) }) + "\n");
    }
  }

  console.log(`\nDone. Researched ${done} sites this run. Total Brave queries used: ${queryCount}.`);
  console.log(`Existing cycle hire found at ${cycleHireCount} sites. Owner identified at ${ownerKnownCount} sites.`);
  outStream.end();
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
