// VENTURE LAKES PROJECT — stated-annual-visitors pass over the top-150
// Phase-2-researched sites (identified by `phase2CheckedAt`). Each already
// has a `website` field from the Phase 3 contact pass — this script does NOT
// call Brave at all, it just fetches that URL (plain HTTP, free) and greps
// the page text for a stated annual-visitor figure. Sites like National
// Trust properties, council-run country parks and Wildlife Trust reserves
// often publish this directly on the homepage or an About/Visit-us page.
//
// Writes (fill-only, never overwrites):
//   statedAnnualVisitors        — exact matched phrase, e.g. "over 500,000
//                                 visitors a year" (string, NOT parsed to a
//                                 number — phrasing varies too much)
//   statedAnnualVisitorsSource  — the URL the phrase was found on
//
// Leaves both fields absent where nothing was found (no empty-string
// placeholders). Marks every attempted doc with `visitorsCheckedAt` so runs
// are resumable.
//
//   node scripts/ventureLakes/find_visitor_numbers.mjs [--limit N] [--force] [--dry]
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

const OUT_DIR = path.resolve("scripts/ventureLakes/out");
fs.mkdirSync(OUT_DIR, { recursive: true });
const OUT_FILE = path.join(OUT_DIR, "visitor_numbers.out.jsonl");
const outStream = fs.createWriteStream(OUT_FILE, { flags: "a" });

// --- fetch helper (same pattern as phase3_contacts.mjs) --------------------

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const TIMEOUT = 12000;
const MAXBYTES = 1_200_000;

async function get(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const res = await fetch(url, { redirect: "follow", signal: ctrl.signal, headers: { "user-agent": UA, accept: "text/html,*/*" } });
    if (res.status >= 400) return { status: res.status, html: "", final: res.url };
    const reader = res.body?.getReader();
    let got = 0, chunks = [];
    if (reader) {
      while (got < MAXBYTES) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        got += value.length;
      }
      try { reader.cancel(); } catch {}
    }
    return { status: res.status, html: Buffer.concat(chunks).toString("utf8"), final: res.url || url };
  } catch (e) {
    return { status: 0, html: "", final: url, err: String(e?.cause?.code || e?.name || e).slice(0, 40) };
  } finally {
    clearTimeout(t);
  }
}

const decode = (s) =>
  s.replace(/&#(\d+);/g, (m, n) => String.fromCharCode(+n)).replace(/&#x([0-9a-f]+);/gi, (m, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/&rsquo;/g, "'").replace(/&#39;/g, "'");

function textOf(html) {
  return decode(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function linksTo(html, base, rx) {
  const hrefs = [...html.matchAll(/href=["']([^"'#]+)["']/gi)].map((x) => x[1]);
  const out = [];
  for (const h of hrefs) {
    if (!rx.test(h)) continue;
    try {
      const u = new URL(h, base);
      if (u.hostname === new URL(base).hostname && !out.includes(u.href)) out.push(u.href);
    } catch {}
  }
  return out.slice(0, 3);
}

// --- visitor-number regexes -------------------------------------------------
// Two families:
//  A) "<number> [million/m] visitors/people/guests a/per/each year"
//  B) "annual[ly] visitor[s] [of/:] <number>"
// Numbers: digit groups with optional commas/decimals, optional
// million/m/thousand suffix, optional leading qualifier word (over/around/
// nearly/more than/almost/approximately/up to).
const NUM = String.raw`(?:over|around|approximately|approx\.?|nearly|almost|more than|up to|roughly|some|about)?\s*\d[\d,]*(?:\.\d+)?\s*(?:million|m\b|thousand|k\b)?`;
const PATTERNS = [
  // e.g. "over 500,000 visitors a year" / "1.2 million people each year" / "300,000 guests per annum"
  new RegExp(`\\b${NUM}\\s*(?:visitors?|people|guests)\\s*(?:a|per|each)\\s*(?:year|annum)\\b`, "gi"),
  // e.g. "annual visitor numbers of 500,000" / "annually visitors: 1.2 million"
  new RegExp(`\\bannual(?:ly)?\\s*visitor\\s*(?:numbers?|figures?)?\\s*(?:of|:|is|are|stands? at)?\\s*${NUM}`, "gi"),
  // e.g. "welcomes over 500,000 visitors annually" / "attracts around 300,000 people annually"
  new RegExp(`\\b${NUM}\\s*(?:visitors?|people|guests)\\s*annually\\b`, "gi"),
  // e.g. "500,000 annual visitors"
  new RegExp(`\\b${NUM}\\s*annual\\s*visitors?\\b`, "gi"),
  // e.g. "visited by over 1 million people every year"
  new RegExp(`\\bvisited\\s*by\\s*${NUM}\\s*(?:visitors?|people|guests)\\s*(?:every|each|a|per)\\s*year\\b`, "gi"),
];

function findVisitorPhrase(text) {
  for (const rx of PATTERNS) {
    rx.lastIndex = 0;
    const m = rx.exec(text);
    if (m) {
      let phrase = m[0].replace(/\s+/g, " ").trim();
      // sanity: must contain at least one digit
      if (/\d/.test(phrase)) return phrase;
    }
  }
  return null;
}

async function checkSite(website) {
  const full = /^https?:/.test(website) ? website : "https://" + website;
  const home = await get(full);
  if (home.status !== 200 || !home.html) return { found: null, source: null, status: home.status, err: home.err };

  let phrase = findVisitorPhrase(textOf(home.html));
  if (phrase) return { found: phrase, source: home.final, status: 200 };

  // try one About/Visit-us style page linked from the homepage
  const candidates = linksTo(home.html, home.final, /(about[-_]?us|about|visit[-_]?us|our[-_]?story|history|plan-your-visit|visitor-information)/i);
  for (const c of candidates.slice(0, 1)) {
    const r = await get(c);
    if (r.status === 200 && r.html) {
      phrase = findVisitorPhrase(textOf(r.html));
      if (phrase) return { found: phrase, source: r.final, status: 200 };
    }
  }
  return { found: null, source: null, status: 200 };
}

async function main() {
  const snap = await db.collection("ventureLakes").where("phase2CheckedAt", "!=", null).get();
  const all = snap.docs.map((d) => ({ id: d.id, ref: d.ref, ...d.data() }));
  console.log(`${all.length} phase2-researched sites loaded.`);

  const withSite = all.filter((s) => !!s.website);
  console.log(`${withSite.length}/${all.length} have a website field.`);

  const eligible = withSite.filter((s) => FORCE || !s.visitorsCheckedAt);
  const todo = eligible.slice(0, LIMIT);
  console.log(`${todo.length} sites to process this run (${withSite.length - eligible.length} already have visitorsCheckedAt and are skipped).`);

  let done = 0, found = 0;
  const foundList = [];

  for (const site of todo) {
    try {
      const r = await checkSite(site.website);
      const update = { visitorsCheckedAt: new Date().toISOString() };
      if (r.found && !site.statedAnnualVisitors) {
        update.statedAnnualVisitors = r.found;
        update.statedAnnualVisitorsSource = r.source;
      }
      if (!DRY) await site.ref.update(update);
      done++;
      if (r.found) { found++; foundList.push({ name: site.name, phrase: r.found, source: r.source }); }
      outStream.write(JSON.stringify({ id: site.id, name: site.name, website: site.website, found: r.found, source: r.source, status: r.status, err: r.err }) + "\n");
      console.log(`[${done}/${todo.length}] ${site.name} — ${r.found ? `FOUND: "${r.found}"` : "none"}`);
    } catch (e) {
      console.error(`  FAILED ${site.name}: ${e.message}`);
      outStream.write(JSON.stringify({ id: site.id, name: site.name, error: String(e.message) }) + "\n");
    }
  }

  console.log(`\nDone. Processed ${done} sites this run. Found stated visitor figure: ${found}/${done}.`);
  if (foundList.length) {
    console.log(`\n--- Sites with a stated annual visitor figure ---`);
    for (const f of foundList) console.log(`  ${f.name}: "${f.phrase}" (${f.source})`);
  }
  outStream.end();
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
