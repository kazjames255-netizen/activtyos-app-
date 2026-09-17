// GIAS independent-schools enrichment (Step 5 of the schools pipeline): for every lead imported by import_gias.mjs
// (identified by having a `giasUrn`), crawl their own website once and in the same pass:
//   1. extract a real contact email + phone (mailto: / tel: links + text patterns — same approach as find_contacts.mjs)
//   2. detect club-language: does the school's OWN site claim to run a holiday club, breakfast club, after-school
//      club or wraparound care? (new regex bank, purpose-built for this — not the HAF regex, a different concept)
//      Written into the existing `providerTypes` field using the app's existing taxonomy ("holiday" / "wraparound")
//      so it shows up for free in the Leads UI's "What they do" filter.
//   3. detect their booking platform, reusing the SAME regex bank as verify_sites.mjs (BOOKING_SYSTEMS/MORE_SYSTEMS)
//      — not reinvented.
// Named role-contacts (headteacher / Pupil Premium lead / inclusion lead / SENDCo) are a SEPARATE pass —
// enrich_school_roles.mjs, same shape, own out files (gias_roles.<i>-<N>.out.jsonl) — since it needs a different
// page (the staff/key-staff page, not the homepage+bookish pages this script crawls) and writes a different field.
// Resumable + fill-only, and shardable for parallel runs: --shard i/N processes only the i-th of N equal slices of
// the (stably sorted) eligible id list, and writes to its OWN out file (scripts/leads/out/gias_enrich.<i>-<N>.out.jsonl)
// so parallel shards never contend on the same resume-state file.
//   node scripts/leads/enrich_schools.mjs --shard 1/5 [--limit N]      (crawl + write JSONL rows)
//   node scripts/leads/enrich_schools.mjs --shard 1/5 --apply          (apply that shard's rows to Firestore)
import admin from "firebase-admin"; import fs from "fs"; import path from "path";
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync("./serviceAccountKey.json","utf8"))) });
const db = admin.firestore();
const args = Object.fromEntries(process.argv.slice(2).map((a,i,arr)=>a.startsWith("--")?[a.slice(2),arr[i+1]&&!arr[i+1].startsWith("--")?arr[i+1]:true]:[]).filter(x=>x.length));
const LIMIT = args.limit ? +args.limit : Infinity;
const [SHARD_I, SHARD_N] = String(args.shard || "1/1").split("/").map(Number);
if (!SHARD_I || !SHARD_N || SHARD_I < 1 || SHARD_I > SHARD_N) { console.log("bad --shard, expected e.g. --shard 2/5"); process.exit(1); }
const OUT = path.resolve(`scripts/leads/out/gias_enrich.${SHARD_I}-${SHARD_N}.out.jsonl`);
const CONC = 8, TIMEOUT = 12000, MAXBYTES = 900_000;
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

// ── Fetch ─────────────────────────────────────────────────────────────────
async function fetchSite(url, _noRetry = false) {
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const res = await fetch(url, { redirect: "follow", signal: ctrl.signal, headers: { "user-agent": UA, accept: "text/html,*/*;q=0.8", "accept-language": "en-GB,en;q=0.9" } });
    const final = res.url || url; if (res.status >= 400) return { status: res.status, final, html: "" };
    const reader = res.body?.getReader(); let got = 0, chunks = [];
    if (reader) { while (got < MAXBYTES) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); got += value.length; } try { reader.cancel(); } catch {} }
    return { status: res.status, final, html: Buffer.concat(chunks).toString("utf8") };
  } catch (e) {
    const err = String(e?.cause?.code || e?.name || e).slice(0, 60);
    if (!_noRetry && /SSL|TLS|CERT|ALTNAME|ISSUER|LEAF/i.test(err) && /^https:/i.test(url)) return fetchSite(url.replace(/^https:/i, "http:"), true);
    return { status: 0, final: url, html: "", err };
  } finally { clearTimeout(t); }
}

// ── Contact extraction (same approach as find_contacts.mjs) ────────────────
const BAD_MAIL = /(example\.com|sentry|wixpress|wordpress|godaddy|\.png|\.jpg|\.gif|\.svg|\.webp|noreply|no-reply|donotreply|privacy@|abuse@|dmca@|jscomp|schema\.org|w3\.org|@2x|@3x|u003e|sitemap)/i;
const decode = (s) => s.replace(/&#(\d+);/g, (m, n) => String.fromCharCode(+n)).replace(/&#x([0-9a-f]+);/gi, (m, h) => String.fromCharCode(parseInt(h, 16))).replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/\[at\]|\(at\)/gi, "@").replace(/\[dot\]|\(dot\)/gi, ".");
function emails(html, host) {
  const h = decode(html); const set = new Map();
  for (const m of h.matchAll(/mailto:([^"'?\s<>]+)/gi)) { const e = m[1].trim().toLowerCase(); if (/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(e) && !BAD_MAIL.test(e)) set.set(e, (set.get(e) || 0) + 10); }
  for (const m of h.matchAll(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi)) { const e = m[0].toLowerCase(); if (!BAD_MAIL.test(e) && !/\.(js|css|html|php)$/.test(e)) set.set(e, (set.get(e) || 0) + 1); }
  const ranked = [...set.entries()].map(([e, n]) => { const d = e.split("@")[1]; const own = host && (host.endsWith(d) || d.endsWith(host)); return { e, score: n + (own ? 20 : 0) + (/^(info|hello|enquiries|bookings|admin|contact|office|reception|registrar|secretary)@/.test(e) ? 3 : 0) }; }).sort((a, b) => b.score - a.score);
  return ranked.map((x) => x.e);
}
function phones(html) {
  const t = decode(html).replace(/<[^>]+>/g, " "); const out = new Map();
  for (const m of t.matchAll(/(?:\+44\s?\(?0?\)?\s?|\b0)(?:\d[\s\-().]?){9,10}\b/g)) { let p = m[0].replace(/[^\d+]/g, ""); if (p.startsWith("+44")) p = "0" + p.slice(3).replace(/^0/, ""); if (!/^0(1|2|3|7|8)\d{8,9}$/.test(p)) continue; if (/^0(800|808|845|870|871|844|843)/.test(p) && out.size) continue; out.set(p, (out.get(p) || 0) + 1); }
  for (const m of html.matchAll(/href=["']tel:([^"']+)/gi)) { let p = m[1].replace(/[^\d+]/g, ""); if (p.startsWith("+44")) p = "0" + p.slice(3).replace(/^0/, ""); if (/^0(1|2|3|7|8)\d{8,9}$/.test(p)) out.set(p, (out.get(p) || 0) + 10); }
  return [...out.entries()].sort((a, b) => b[1] - a[1]).map(([p]) => p.replace(/^(0\d{2,4})(\d{3})(\d{3,4})$/, "$1 $2 $3"));
}
function contactLinks(html, base) {
  const hrefs = [...html.matchAll(/href=["']([^"'#]*(contact|about|find-us|findus|get-in-touch|enquir|registrar|admissions)[^"'#]*)["']/gi)].map((x) => x[1]).filter((h) => !/^(mailto|tel|javascript)/i.test(h));
  const out = []; for (const h of hrefs) { try { const u = new URL(h, base); if (u.hostname === new URL(base).hostname && !out.includes(u.href)) out.push(u.href); } catch {} } return out.slice(0, 2);
}

// ── Club-language detector (new — schools claiming to run a holiday / breakfast / after-school club themselves) ──
// Phrase-anchored, not a bare keyword match, to avoid false hits on a page merely mentioning "clubs" in passing
// (a school's "clubs and societies" page lists chess club, debating club etc — that is NOT what we're looking for).
const CLUB_RX = [
  ["holiday", /\bholiday (club|clubs|camp|camps|care|scheme|schemes|provision)\b/i],
  ["holiday", /\b(summer|easter|half[- ]term) (camp|club|holiday club)\b/i],
  ["wraparound", /\bbreakfast club\b/i],
  ["wraparound", /\bafter[- ]?school (club|clubs|care|provision)\b/i],
  ["wraparound", /\bwrap[- ]?around care\b/i],
];
function clubHit(text) { const found = new Set(); const ev = []; for (const [type, re] of CLUB_RX) { const m = text.match(re); if (m) { found.add(type); ev.push(m[0]); } } return { types: [...found], evidence: ev.slice(0, 4) }; }

// ── Booking-platform detection — the SAME regex bank as verify_sites.mjs (reused, not reinvented) ─────────────
const BOOKING_SYSTEMS = [["ClassForKids", /classforkids\.io/i], ["Bookwhen", /bookwhen\.com/i], ["eequ", /eequ\.org/i], ["Pebble", /(bookpebble\.co\.uk|pebble\.co\b)/i], ["Playwaze", /playwaze\.com/i], ["ClubSpark", /clubspark\.(net|lta\.org\.uk)/i], ["Coordinate", /coordinate\.cloud/i], ["HolidayActivities", /holidayactivities\.com/i], ["Yellow Days", /yellowdays/i], ["Hoop", /hoop\.co\.uk/i], ["Kidzcamp", /kidzcamp/i], ["iPAL", /ipal\.(co\.uk|app)/i], ["Magicbooking", /magicbooking/i], ["Famly", /famly\.co/i], ["Kinderly", /kinderly/i], ["Blossom", /blossomeducational/i], ["Connect Childcare", /connectchildcare/i], ["Nursery in a Box", /nurseryinabox/i], ["ParentPay", /parentpay\.com/i], ["SchoolsBuddy", /schoolsbuddy/i], ["Arbor", /arbor-education|arbor\.sc/i], ["Gymcatch", /gymcatch\.com/i], ["TeamUp", /goteamup\.com/i], ["Glofox", /glofox\.com/i], ["Mindbody", /mindbodyonline/i], ["Acuity", /acuityscheduling/i], ["Calendly", /calendly\.com/i], ["Eventbrite", /eventbrite/i], ["TicketSource", /ticketsource/i], ["TryBooking", /trybooking/i], ["Stripe checkout", /(buy\.stripe\.com|checkout\.stripe\.com|book\.stripe\.com)/i], ["Shopify", /myshopify\.com/i], ["Sumup", /sumup\.(com|io)/i], ["Square", /square\.site|squareup\.com/i], ["Wix Bookings", /wix\.com\/bookings|wixbookings/i], ["LoveAdmin", /loveadmin/i], ["Pitchero", /pitchero\.com/i], ["Spond", /spond\.com/i], ["Sportsuite", /sportsuite/i], ["Kids Club HQ", /kidsclubhq/i], ["Class4Kids", /class4kids/i], ["Nursery Story", /nurserystory/i], ["Tapestry", /tapestryjournal/i], ["Baby's Days", /babysdays/i], ["ScoPay", /scopay\.com/i], ["Booktastic", /booktastic\.org\.uk/i]];
const MORE_SYSTEMS = [["Legend (leisure)", /legendonlineservices|legend\.co\.uk\/booking/i], ["Gladstone (leisure)", /gladstonemrm|gladstonesoftware|\.gladstone/i], ["XN Leisure", /xnleisure|xn-leisure/i], ["Better/GLL", /better\.org\.uk\/.*book|gll\.org/i], ["Everyone Active", /everyoneactive\.com\/.*book/i], ["ActiveMe360", /activeme360\.co\.uk/i], ["1Life", /1life\.co\.uk/i], ["Fusion Lifestyle", /fusion-lifestyle\.com/i], ["Places Leisure", /placesleisure\.org/i], ["Freedom Leisure", /freedom-leisure\.co\.uk/i], ["Parkwood Leisure", /parkwoodleisure\.co\.uk/i], ["NatWest PayIt", /natwestpayit/i], ["PayPal", /paypal\.(com|me)\/(paypalme|cgi-bin|checkout|ncp|donate)/i], ["GoCardless", /pay\.gocardless\.com/i], ["Zettle", /zettle\.com|izettle/i], ["Ticketsolve", /ticketsolve/i], ["Spektrix", /spektrix/i], ["Ticketmaster", /ticketmaster/i], ["See Tickets", /seetickets/i], ["Skiddle", /skiddle/i], ["Little Box Office", /littleboxoffice/i], ["Ticket Tailor", /tickettailor/i], ["WooCommerce cart", /\?add-to-cart=|\/cart\/?$|\/checkout\/?$/i], ["Squarespace commerce", /\/shop\?categoryId=|\/checkout\/order/i], ["Momence", /momence\.com/i], ["ClassPass", /classpass\.com/i], ["Sport:80", /sport80\.com/i], ["Pitchbooking", /pitchbooking/i], ["Playfinder", /playfinder\.com/i], ["Sawyer", /hisawyer\.com/i]];
const ALL_SYSTEMS = [...BOOKING_SYSTEMS, ...MORE_SYSTEMS];
function systemIn(html) {
  const hrefs = [...html.matchAll(/(?:href|action|src|data-href|data-url)=["']([^"']+)["']/gi)].map((m) => m[1]);
  for (const h of hrefs) { const sys = ALL_SYSTEMS.find(([, re]) => re.test(h)); if (sys && !/facebook|instagram/i.test(h)) return { system: sys[0], url: h.slice(0, 300) }; }
  const inline = ALL_SYSTEMS.find(([, re]) => re.test(html.slice(0, 400000))); return inline ? { system: inline[0], url: null } : null;
}
const BOOKISH_PATH = /\/(book|booking|bookings|book-now|holiday-?clubs?|holiday-?camps?|wraparound|breakfast-?club|after-?school|clubs?|activities|co-?curricular|extra-?curricular|prices?|fees|pay|payments?)(\/|\.|\?|-|$)/i;
const GUESS = ["/holiday-club", "/holiday-clubs", "/wraparound-care", "/breakfast-club", "/after-school-club", "/co-curricular", "/extra-curricular", "/clubs", "/activities", "/contact", "/contact-us", "/admissions"];

const strip = (h) => h.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<!--[\s\S]*?-->/g, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/g, " ").replace(/&amp;/g, "&").replace(/&#39;|&apos;/g, "'").replace(/\s+/g, " ").toLowerCase();

async function crawlOne(lead) {
  const base = /^https?:\/\//i.test(lead.website) ? lead.website : "https://" + lead.website;
  const home = await fetchSite(base);
  if (home.status !== 200 || !home.html) return { id: lead.id, status: home.status, err: home.err || "homepage unreachable", email: null, phone: null, clubTypes: [], clubEvidence: [], bookingSystem: null, bookingUrl: null, pagesRead: 0 };
  const host = (() => { try { return new URL(home.final).hostname.replace(/^www\./, ""); } catch { return ""; } })();
  let htmlAll = home.html; let textAll = strip(home.html); let pagesRead = 1;
  const seen = new Set();
  // Contact/about pages — for contact extraction only.
  for (const c of contactLinks(home.html, home.final)) { const r = await fetchSite(c); if (r.status === 200 && r.html) { htmlAll += "\n" + r.html; textAll += " " + strip(r.html); pagesRead++; } }
  // Club/booking-ish pages — guessed paths + any bookish links actually on the homepage.
  const bookish = []; try { const origin = new URL(home.final); for (const m of home.html.matchAll(/href=["']([^"'#]+)["']/gi)) { let u; try { u = new URL(m[1], home.final); } catch { continue; } if (u.hostname.replace(/^www\./, "") !== origin.hostname.replace(/^www\./, "")) continue; if (!BOOKISH_PATH.test(u.pathname) || seen.has(u.pathname)) continue; seen.add(u.pathname); bookish.push(u.href); if (bookish.length >= 4) break; } } catch {}
  try { const o = new URL(home.final).origin; for (const p of GUESS) if (!seen.has(p)) { seen.add(p); bookish.push(o + p); } } catch {}
  let system = systemIn(htmlAll)?.system ? systemIn(htmlAll) : null;
  let bookingPage = system ? home.final : null;
  for (const u of bookish.slice(0, 8)) {
    const r = await fetchSite(u); if (r.status !== 200 || !r.html) continue; pagesRead++;
    htmlAll += "\n" + r.html; textAll += " " + strip(r.html);
    if (!system) { const f = systemIn(r.html); if (f) { system = f; bookingPage = u; } }
  }
  const em = emails(htmlAll, host), ph = phones(htmlAll);
  const club = clubHit(textAll);
  return { id: lead.id, status: 200, email: em[0] || null, phone: ph[0] || null, clubTypes: club.types, clubEvidence: club.evidence, bookingSystem: system?.system || null, bookingUrl: system?.url && /^https?:/.test(system.url) ? system.url : bookingPage, pagesRead };
}

// ── Apply ────────────────────────────────────────────────────────────────
if (args.apply) {
  if (!fs.existsSync(OUT)) { console.log("no out file for this shard yet:", OUT); process.exit(0); }
  const rows = fs.readFileSync(OUT, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  const ids = rows.map((r) => r.id); const cur = new Map();
  for (let i = 0; i < ids.length; i += 300) { const snaps = await db.getAll(...ids.slice(i, i + 300).map((id) => db.collection("leads").doc(id)), { fieldMask: ["email", "phone", "providerTypes", "bookingSystem", "bookingChecked"] }); for (const s of snaps) if (s.exists) cur.set(s.id, s.data()); }
  let batch = db.batch(), inB = 0; const c = {}; const bump = (k) => c[k] = (c[k] || 0) + 1; const stamp = new Date().toISOString();
  for (const r of rows) {
    const x = cur.get(r.id); if (!x) { bump("skipped: gone"); continue; }
    const upd = {};
    if (r.email && !x.email) { upd.email = r.email; upd.emailFrom = "school site crawl (enrich_schools.mjs)"; bump("email set"); }
    if (r.phone && !x.phone) { upd.phone = r.phone; upd.phoneFrom = "school site crawl (enrich_schools.mjs)"; bump("phone set"); }
    if (r.clubTypes?.length) { const pt = new Set(x.providerTypes || []); let added = 0; for (const t of r.clubTypes) if (!pt.has(t)) { pt.add(t); added++; } if (added) { upd.providerTypes = [...pt]; bump("club language: providerTypes added"); } }
    if (r.bookingSystem && !x.bookingSystem) { upd.bookingSystem = r.bookingSystem; upd.bookingUrl = r.bookingUrl || undefined; upd.bookingFrom = `school site crawl ${stamp.slice(0, 10)} (enrich_schools.mjs)`; upd.bookingChecked = true; bump("booking platform found: " + r.bookingSystem); }
    else if (!r.bookingSystem && r.status === 200 && !x.bookingSystem && typeof x.bookingChecked !== "boolean") { upd.bookingChecked = true; bump("booking: checked, none found"); }
    if (!Object.keys(upd).length) { bump("no new info"); continue; }
    upd.updatedAt = stamp; batch.update(db.collection("leads").doc(r.id), upd); inB++;
    if (inB >= 400) { await batch.commit(); batch = db.batch(); inB = 0; }
  }
  if (inB) await batch.commit();
  console.log("APPLIED shard", `${SHARD_I}/${SHARD_N}`, JSON.stringify(c));
  process.exit(0);
}

// ── Build this shard's todo list ────────────────────────────────────────
const snap = await db.collection("leads").select("giasUrn", "website", "email", "phone", "bookingSystem", "bookingChecked", "excluded").get();
const eligible = snap.docs.filter((d) => { const x = d.data(); return x.giasUrn && x.website && !x.excluded; }).map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.id < b.id ? -1 : 1);
const mine = eligible.filter((_, i) => i % SHARD_N === SHARD_I - 1);
const done = new Set(fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8").split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l).id; } catch { return null; } }) : []);
const todo = mine.filter((l) => !done.has(l.id) && (!l.email || !l.phone || (!l.bookingSystem && typeof l.bookingChecked !== "boolean"))).slice(0, LIMIT);
console.log(`shard ${SHARD_I}/${SHARD_N}: ${mine.length} schools in shard, ${todo.length} to crawl (already done ${done.size})`);

const out = fs.createWriteStream(OUT, { flags: "a" }); let i = 0, n = 0; const tally = {}; const bump = (k) => tally[k] = (tally[k] || 0) + 1; const t0 = Date.now();
async function worker() {
  while (i < todo.length) {
    const lead = todo[i++]; let row;
    try { row = await crawlOne(lead); } catch (e) { row = { id: lead.id, status: 0, err: `error: ${String(e?.message || e).slice(0, 100)}`, email: null, phone: null, clubTypes: [], clubEvidence: [], bookingSystem: null, bookingUrl: null, pagesRead: 0 }; }
    row.at = new Date().toISOString();
    out.write(JSON.stringify(row) + "\n"); n++;
    if (row.email) bump("email found"); if (row.phone) bump("phone found"); if (row.clubTypes?.length) bump("club language found"); if (row.bookingSystem) bump("booking platform found"); if (row.status !== 200) bump("unreachable");
    if (n % 50 === 0) console.log(`shard ${SHARD_I}/${SHARD_N}: ${n}/${todo.length} ${Math.round((Date.now() - t0) / 1000)}s`, JSON.stringify(tally));
  }
}
await Promise.all(Array.from({ length: CONC }, worker));
out.end(); console.log(`shard ${SHARD_I}/${SHARD_N} done`, n, JSON.stringify(tally));
process.exit(0);
