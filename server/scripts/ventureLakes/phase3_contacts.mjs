// VENTURE CYCLE PROJECT (Phase 3) — website + contact-details pass over the
// same top-150 (by acreage) sites Phase 2 already researched (identified by
// `phase2CheckedAt` on the doc). For each site:
//   1. Find the official website. Phase 2's own output (out/phase2.out.jsonl)
//      only kept the query strings it ran, not the raw search result URLs —
//      so there is nothing free to reuse from that file; a single fresh
//      Brave query per site is the minimum-cost way to find the URL.
//   2. Scrape that page (plain fetch + regex, same technique as
//      scripts/leads/find_contacts.mjs) for an email and UK phone number.
//      This step costs zero Brave credit.
//   3. Fill-only write of website/email/phone onto the ventureLakes doc.
//
// Resumable: skips docs that already have `phase3CheckedAt` unless --force.
// Appends one line per site to out/phase3.out.jsonl for audit + query count.
//
//   node scripts/ventureLakes/phase3_contacts.mjs [--limit N] [--force] [--dry]
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

const API_KEY = process.env.BRAVE_SEARCH_API_KEY || "";
if (!API_KEY) { console.error("BRAVE_SEARCH_API_KEY not set in server/.env — aborting."); process.exit(1); }

const OUT_DIR = path.resolve("scripts/ventureLakes/out");
fs.mkdirSync(OUT_DIR, { recursive: true });
const OUT_FILE = path.join(OUT_DIR, "phase3.out.jsonl");
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

// --- website selection heuristics ------------------------------------------

const BAD_HOST_RX = /(facebook\.com|twitter\.com|x\.com|instagram\.com|youtube\.com|tripadvisor\.|wikipedia\.org|wikimedia\.org|openstreetmap\.org|google\.com|goo\.gl|maps\.app|pinterest\.|linkedin\.com|yell\.com|foursquare\.com|reddit\.com|amazon\.|wheree\.com|thecrazytourist|atlasobscura\.com|lonelyplanet\.com|birdingplaces\.eu|bird\.club|niche\.com)/i;

// Generic travel-marketing / "discover X" / "visit X" county tourism
// directories and local news sites — usually not the site's own operator, so
// only used as a last resort if nothing more specific turns up.
const DIRECTORY_RX = /^(www\.)?(discover|visit|explore|thebest|whatson|daysout|thingstodo)[a-z]*\./i;

// Known managing-body domains — expected to be the "official website" for
// council/Trust/Forestry England-run sites per the task notes. Ranked above
// generic results but below an own-name domain if one exists.
const KNOWN_BODY_RX = /(nationaltrust\.org\.uk|forestryengland\.uk|canalrivertrust\.org\.uk|wildlifetrust|rspb\.org\.uk|woodlandtrust\.org\.uk|\.gov\.uk|environment-agency|naturalengland)/i;

function slugify(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function pickWebsite(results, siteName) {
  const nameSlug = slugify(siteName).slice(0, 12);
  const candidates = results
    .filter((r) => {
      try {
        const u = new URL(r.url);
        return !BAD_HOST_RX.test(u.hostname);
      } catch {
        return false;
      }
    })
    .map((r) => {
      let host = "";
      try { host = new URL(r.url).hostname; } catch {}
      const ownName = host && !KNOWN_BODY_RX.test(host) && slugify(host).includes(nameSlug.slice(0, 6));
      const knownBody = KNOWN_BODY_RX.test(host);
      const directory = DIRECTORY_RX.test(host);
      return { ...r, host, ownName, knownBody, directory };
    });
  if (!candidates.length) return null;
  // Priority: own-name domain > known managing-body domain > first
  // non-directory result > first result of any kind.
  const pick =
    candidates.find((c) => c.ownName) ||
    candidates.find((c) => c.knownBody) ||
    candidates.find((c) => !c.directory) ||
    candidates[0];
  return pick.url;
}

// --- contact scraping (same pattern as scripts/leads/find_contacts.mjs) ---

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const TIMEOUT = 12000;
const MAXBYTES = 800_000;
const BAD_MAIL = /(example\.com|sentry|wixpress|wordpress|godaddy|\.png|\.jpg|\.gif|\.svg|\.webp|noreply|no-reply|donotreply|privacy@|abuse@|dmca@|jscomp|schema\.org|w3\.org|@2x|@3x|u003e|sitemap)/i;

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
    .replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/\[at\]|\(at\)/gi, "@").replace(/\[dot\]|\(dot\)/gi, ".");

function emails(html, host) {
  const h = decode(html);
  const set = new Map();
  for (const m of h.matchAll(/mailto:([^"'?\s<>]+)/gi)) {
    const e = m[1].trim().toLowerCase();
    if (/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(e) && !BAD_MAIL.test(e)) set.set(e, (set.get(e) || 0) + 10);
  }
  for (const m of h.matchAll(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi)) {
    const e = m[0].toLowerCase();
    if (!BAD_MAIL.test(e) && !/\.(js|css|html|php)$/.test(e)) set.set(e, (set.get(e) || 0) + 1);
  }
  const ranked = [...set.entries()]
    .map(([e, n]) => {
      const d = e.split("@")[1];
      const own = host && (host.endsWith(d) || d.endsWith(host));
      return { e, score: n + (own ? 20 : 0) + (/^(info|hello|enquiries|bookings|admin|contact|office|visitorcentre)@/.test(e) ? 3 : 0) };
    })
    .sort((a, b) => b.score - a.score);
  return ranked.map((x) => x.e);
}

function phones(html) {
  const t = decode(html).replace(/<[^>]+>/g, " ");
  const out = new Map();
  for (const m of t.matchAll(/(?:\+44\s?\(?0?\)?\s?|\b0)(?:\d[\s\-().]?){9,10}\b/g)) {
    let p = m[0].replace(/[^\d+]/g, "");
    if (p.startsWith("+44")) p = "0" + p.slice(3).replace(/^0/, "");
    if (!/^0(1|2|3|7|8)\d{8,9}$/.test(p)) continue;
    if (/^0(800|808|845|870|871|844|843)/.test(p) && out.size) continue;
    out.set(p, (out.get(p) || 0) + 1);
  }
  for (const m of html.matchAll(/href=["']tel:([^"']+)/gi)) {
    let p = m[1].replace(/[^\d+]/g, "");
    if (p.startsWith("+44")) p = "0" + p.slice(3).replace(/^0/, "");
    if (/^0(1|2|3|7|8)\d{8,9}$/.test(p)) out.set(p, (out.get(p) || 0) + 10);
  }
  return [...out.entries()].sort((a, b) => b[1] - a[1]).map(([p]) => p.replace(/^(0\d{2,4})(\d{3})(\d{3,4})$/, "$1 $2 $3"));
}

function contactLinks(html, base) {
  const hrefs = [...html.matchAll(/href=["']([^"'#]*(contact|about|find-us|findus|get-in-touch|enquir|visit)[^"'#]*)["']/gi)]
    .map((x) => x[1]).filter((h) => !/^(mailto|tel|javascript)/i.test(h));
  const out = [];
  for (const h of hrefs) {
    try {
      const u = new URL(h, base);
      if (u.hostname === new URL(base).hostname && !out.includes(u.href)) out.push(u.href);
    } catch {}
  }
  return out.slice(0, 2);
}

async function scrapeContacts(url) {
  const full = /^https?:/.test(url) ? url : "https://" + url;
  const home = await get(full);
  let html = home.html;
  const pages = [home.final];
  if (home.status === 200) {
    for (const c of contactLinks(home.html, home.final)) {
      const r = await get(c);
      if (r.status === 200) { html += "\n" + r.html; pages.push(c); }
    }
  }
  let host = "";
  try { host = new URL(home.final).hostname.replace(/^www\./, ""); } catch {}
  const em = emails(html, host);
  const ph = phones(html);
  return { status: home.status, err: home.err, pages: pages.length, email: em[0] || null, phone: ph[0] || null };
}

async function main() {
  const snap = await db.collection("ventureLakes").where("phase2CheckedAt", "!=", null).get();
  const all = snap.docs.map((d) => ({ id: d.id, ref: d.ref, ...d.data() }));
  console.log(`${all.length} phase2-researched sites loaded.`);

  const eligible = all.filter((s) => FORCE || !s.phase3CheckedAt);
  const todo = eligible.slice(0, LIMIT);
  console.log(`${todo.length} sites to process this run (${all.length - eligible.length} already have phase3CheckedAt and are skipped).`);

  let done = 0, withWebsite = 0, withEmail = 0, withPhone = 0;

  for (const site of todo) {
    try {
      const loc = [site.locality, site.postcode].filter(Boolean).join(", ");
      const q = `${site.name} ${loc} official website`.trim();
      const r = await braveSearch(q);
      const website = pickWebsite(r.results, site.name);

      let contact = { email: null, phone: null };
      if (website) {
        withWebsite++;
        contact = await scrapeContacts(website);
        if (contact.email) withEmail++;
        if (contact.phone) withPhone++;
      }

      const update = { phase3CheckedAt: new Date().toISOString() };
      // Fill-only: never overwrite an existing value.
      if (website && !site.website) update.website = website;
      if (contact.email && !site.email) update.email = contact.email;
      if (contact.phone && !site.phone) update.phone = contact.phone;

      if (!DRY) await site.ref.update(update);
      done++;
      outStream.write(JSON.stringify({ id: site.id, name: site.name, query: q, website, email: contact.email, phone: contact.phone, scrapeStatus: contact.status, scrapeErr: contact.err }) + "\n");
      console.log(`[${done}/${todo.length}] ${site.name} — website: ${website || "none"} | email: ${contact.email || "-"} | phone: ${contact.phone || "-"} | queries so far: ${queryCount}`);
    } catch (e) {
      console.error(`  FAILED ${site.name}: ${e.message}`);
      outStream.write(JSON.stringify({ id: site.id, name: site.name, error: String(e.message) }) + "\n");
    }
  }

  console.log(`\nDone. Processed ${done} sites this run. Total Brave queries used: ${queryCount}.`);
  console.log(`Website found: ${withWebsite}/${done}. Email found: ${withEmail}/${done}. Phone found: ${withPhone}/${done}.`);
  outStream.end();
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
