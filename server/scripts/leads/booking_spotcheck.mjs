// Detection-completeness audit: random-sample leads currently landing in the CONFIRMED "no booking system" bucket
// (bookingChecked === true && !bookingSystem — i.e. the site was actually read and nothing was found) and re-check
// them with fresh eyes: the full current ALL_SYSTEMS list (including tonight's additions), MORE pages than the
// original crawl, and a heuristic scan for iframe/script/link domains that LOOK booking-related but aren't in the
// known list yet — surfacing candidate new patterns rather than just re-running the same regex blind.
// Zero Brave cost — pure re-fetch of known URLs (headless-Chromium fallback for anything that plain-fetch can't read).
// Usage (from server/): node scripts/leads/booking_spotcheck.mjs [--sample N] [--seed S]
import "dotenv/config"; import admin from "firebase-admin"; import fs from "fs"; import path from "path";
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync("./serviceAccountKey.json","utf8"))) });
const db = admin.firestore();
const args = Object.fromEntries(process.argv.slice(2).map((a,i,arr)=>a.startsWith("--")?[a.slice(2),arr[i+1]&&!arr[i+1].startsWith("--")?arr[i+1]:true]:[]).filter(x=>x.length));
const SAMPLE = args.sample ? +args.sample : 200;
const CONC = 10, TIMEOUT = 10000, MAXBYTES = 1_500_000;
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

// Same list verify_sites.mjs / residue.mjs use tonight (kept in sync manually — see those files).
const BOOKING_SYSTEMS = [["ClassForKids", /classforkids\.io/i], ["Bookwhen", /bookwhen\.com/i], ["eequ", /eequ\.org/i], ["Pebble", /(bookpebble\.co\.uk|pebble\.co\b)/i], ["Playwaze", /playwaze\.com/i], ["ClubSpark", /clubspark\.(net|lta\.org\.uk)/i], ["Coordinate", /coordinate\.cloud/i], ["HolidayActivities", /holidayactivities\.com/i], ["Yellow Days", /yellowdays/i], ["Hoop", /hoop\.co\.uk/i], ["Kidzcamp", /kidzcamp/i], ["iPAL", /ipal\.(co\.uk|app)/i], ["Magicbooking", /magicbooking/i], ["Famly", /famly\.co/i], ["Kinderly", /kinderly/i], ["Blossom", /blossomeducational/i], ["Connect Childcare", /connectchildcare/i], ["Nursery in a Box", /nurseryinabox/i], ["ParentPay", /parentpay\.com/i], ["SchoolsBuddy", /schoolsbuddy/i], ["Arbor", /arbor-education|arbor\.sc/i], ["Gymcatch", /gymcatch\.com/i], ["TeamUp", /goteamup\.com/i], ["Glofox", /glofox\.com/i], ["Mindbody", /mindbodyonline/i], ["Acuity", /acuityscheduling/i], ["Calendly", /calendly\.com/i], ["Eventbrite", /eventbrite/i], ["TicketSource", /ticketsource/i], ["TryBooking", /trybooking/i], ["Stripe checkout", /(buy\.stripe\.com|checkout\.stripe\.com|book\.stripe\.com)/i], ["Shopify", /myshopify\.com/i], ["Sumup", /sumup\.(com|io)/i], ["Square", /square\.site|squareup\.com/i], ["Wix Bookings", /wix\.com\/bookings|wixbookings/i], ["LoveAdmin", /loveadmin/i], ["Pitchero", /pitchero\.com/i], ["Spond", /spond\.com/i], ["Sportsuite", /sportsuite/i], ["Kids Club HQ", /kidsclubhq/i], ["Class4Kids", /class4kids/i], ["Nursery Story", /nurserystory/i], ["Tapestry", /tapestryjournal/i], ["Baby's Days", /babysdays/i], ["ScoPay", /scopay\.com/i], ["Booktastic", /booktastic\.org\.uk/i]];
const MORE_SYSTEMS = [["Legend (leisure)", /legendonlineservices|legend\.co\.uk\/booking/i], ["Gladstone (leisure)", /gladstonemrm|gladstonesoftware|\.gladstone/i], ["XN Leisure", /xnleisure|xn-leisure/i], ["Better/GLL", /better\.org\.uk\/.*book|gll\.org/i], ["Everyone Active", /everyoneactive\.com\/.*book/i], ["ActiveMe360", /activeme360\.co\.uk/i], ["1Life", /1life\.co\.uk/i], ["Fusion Lifestyle", /fusion-lifestyle\.com/i], ["Places Leisure", /placesleisure\.org/i], ["Freedom Leisure", /freedom-leisure\.co\.uk/i], ["Parkwood Leisure", /parkwoodleisure\.co\.uk/i], ["NatWest PayIt", /natwestpayit/i], ["PayPal", /paypal\.(com|me)\/(paypalme|cgi-bin|checkout|ncp|donate)/i], ["GoCardless", /pay\.gocardless\.com/i], ["Zettle", /zettle\.com|izettle/i], ["Ticketsolve", /ticketsolve/i], ["Spektrix", /spektrix/i], ["Ticketmaster", /ticketmaster/i], ["See Tickets", /seetickets/i], ["Skiddle", /skiddle/i], ["Little Box Office", /littleboxoffice/i], ["Ticket Tailor", /tickettailor/i], ["WooCommerce cart", /\?add-to-cart=|\/cart\/?$|\/checkout\/?$/i], ["Squarespace commerce", /\/shop\?categoryId=|\/checkout\/order/i], ["Momence", /momence\.com/i], ["ClassPass", /classpass\.com/i], ["Sport:80", /sport80\.com/i], ["Pitchbooking", /pitchbooking/i], ["Playfinder", /playfinder\.com/i], ["LTA ClubSpark", /clubspark/i], ["Camp America style: Ultra Camp", /ultracamp/i], ["Sawyer", /hisawyer\.com/i], ["Jotform pay", /form\.jotform\.com/i], ["Typeform", /typeform\.com\/to/i], ["Google Forms", /docs\.google\.com\/forms|forms\.gle/i]];
const ALL_SYSTEMS = [...BOOKING_SYSTEMS, ...MORE_SYSTEMS];
function systemIn(html) { const hrefs = [...html.matchAll(/(?:href|action|src|data-href|data-url)=["']([^"']+)["']/gi)].map(m=>m[1]); for (const h of hrefs) { const sys = ALL_SYSTEMS.find(([, re]) => re.test(h)); if (sys && !/facebook|instagram/i.test(h)) return { system: sys[0], url: h.slice(0, 300) }; } const inline = ALL_SYSTEMS.find(([, re]) => re.test(html.slice(0, 400000))); return inline && !/Google Forms|Typeform|Jotform/.test(inline[0]) ? { system: inline[0], url: null } : null; }

const BOOKISH_PATH = /\/(book|booking|bookings|book-now|book-online|book-a-place|enrol|enroll|enrolment|register|registration|sign-?up|join|shop|store|prices?|pricing|fees|timetable|schedule|sessions?|classes|clubs?|camps?|holiday-?clubs?|holiday-?camps?|holidays|after-?school|breakfast|wraparound|courses?|workshops?|parties|membership|pay|payments?|checkout|basket|cart|tickets?|whats-on|events?|contact)(\/|\.|\?|-|$)/i;
const GUESS = ["/book", "/booking", "/bookings", "/book-now", "/classes", "/camps", "/holiday-club", "/timetable", "/prices", "/contact", "/shop", "/checkout", "/enrol", "/register"];

async function fetchSite(url, _noRetry = false) {
  const ctrl = new AbortController(); const t = setTimeout(()=>ctrl.abort(), TIMEOUT);
  try {
    const res = await fetch(url, { redirect:"follow", signal: ctrl.signal, headers: { "user-agent": UA, "accept":"text/html,*/*;q=0.8", "accept-language":"en-GB,en;q=0.9" } });
    const final = res.url || url; if (res.status >= 400) return { status: res.status, final, html: "" };
    const reader = res.body?.getReader(); let got = 0, chunks = [];
    if (reader) { while (got < MAXBYTES) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); got += value.length; } try { reader.cancel(); } catch {} }
    return { status: res.status, final, html: Buffer.concat(chunks).toString("utf8") };
  } catch (e) { const err = String(e?.cause?.code || e?.name || e).slice(0,60);
    if (!_noRetry && /SSL|TLS|CERT|ALTNAME|ISSUER|LEAF/i.test(err) && /^https:/i.test(url)) return fetchSite(url.replace(/^https:/i, "http:"), true);
    return { status: 0, final: url, html: "", err }; }
  finally { clearTimeout(t); } }

let browser = null;
async function browserFetch(url) {
  if (!browser) { const { chromium } = await import("playwright-core"); browser = await chromium.launch({ headless: true }); }
  const ctx = await browser.newContext({ userAgent: UA, locale: "en-GB", viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage(); await page.route(/\.(png|jpe?g|gif|webp|svg|woff2?|ttf|mp4|webm)(\?|$)/i, (r) => r.abort());
  try { const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 }); await page.waitForTimeout(1500); const html = await page.content(); return { status: resp?.status() ?? 0, final: page.url() || url, html }; }
  catch (e) { return { status: 0, final: url, html: "", err: String(e?.message || e).slice(0, 60) }; }
  finally { await ctx.close().catch(() => {}); } }

async function sitemapLinks(base) { try { const o = new URL(base).origin; const r = await fetchSite(o + "/sitemap.xml"); if (r.status !== 200 || !/<loc>/i.test(r.html)) return []; return [...r.html.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map(m=>m[1]).filter(u => { try { const x = new URL(u); return x.origin === o && BOOKISH_PATH.test(x.pathname); } catch { return false; } }).slice(0, 8); } catch { return []; } }

// Heuristic "unknown but suspicious" domain scan: iframe/script/link hosts whose NAME suggests booking/scheduling/
// payment but that don't match ANY known pattern — candidates for a new entry in ALL_SYSTEMS.
const SUSPECT_WORD = /book|schedul|checkout|widget|reserv|calendar|ticket|enrol|regist|signup|sign-up|appoint|order|pay(?!pal)|cart|shop|store/i;
const IGNORE_HOST = /google|gstatic|facebook|instagram|fbcdn|twitter|youtube|cloudflare|jquery|bootstrapcdn|fontawesome|gravatar|wp\.com|wordpress\.com|w3\.org|schema\.org|googletagmanager|google-analytics|doubleclick|hotjar|cookiebot|onetrust|recaptcha|gstatic|apple|microsoft|linkedin|pinterest|tiktok|klaviyo|mailchimp|sendinblue|hubspot(?!.*book)/i;
function suspiciousDomains(html) {
  const hosts = new Set();
  for (const m of html.matchAll(/(?:src|href|action)=["'](https?:\/\/[^"'/]+)/gi)) {
    try { const h = new URL(m[1]).hostname.replace(/^www\./,""); if (SUSPECT_WORD.test(h) && !IGNORE_HOST.test(h)) hosts.add(h); } catch {}
  }
  return [...hosts];
}

const snap = await db.collection("leads").select("name","location","website","excluded","bookingSystem","bookingChecked").get();
const pool = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(l => !l.excluded && l.website && l.bookingChecked && !l.bookingSystem);
console.log("POOL (confirmed no-system bucket)", pool.length);
// Deterministic-ish shuffle so a --seed re-run can reproduce the same sample.
function shuffle(arr, seed) { let s = seed || Date.now(); const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const sample = shuffle(pool, args.seed ? +args.seed : 42).slice(0, SAMPLE);
console.log(`sampling ${sample.length} of ${pool.length}`);

const results = []; let i = 0; const domainTally = new Map();
async function checkOne(lead) {
  const base = /^https?:\/\//i.test(lead.website) ? lead.website : "https://" + lead.website;
  let home = await fetchSite(base);
  let usedRender = false;
  if (home.status !== 200 || !home.html) { home = await browserFetch(base); usedRender = true; }
  if (home.status !== 200 || !home.html) { results.push({ id: lead.id, name: lead.name, website: lead.website, outcome: "still-unreachable" }); return; }
  const pagesHtml = [home.html]; let hit = systemIn(home.html);
  const suspects = new Set(suspiciousDomains(home.html));
  if (!hit) {
    const seen = new Set(); const urls = [];
    try { const origin = new URL(home.final || base); for (const m of home.html.matchAll(/href=["']([^"'#]+)["']/gi)) { let u; try { u = new URL(m[1], home.final || base); } catch { continue; } if (u.hostname.replace(/^www\./,"") !== origin.hostname.replace(/^www\./,"")) continue; if (!BOOKISH_PATH.test(u.pathname) || seen.has(u.pathname)) continue; seen.add(u.pathname); urls.push(u.href); } } catch {}
    try { const o = new URL(home.final || base).origin; for (const p of GUESS) if (!seen.has(p)) { seen.add(p); urls.push(o + p); } } catch {}
    for (const u of await sitemapLinks(home.final || base)) { try { const p = new URL(u).pathname; if (!seen.has(p)) { seen.add(p); urls.push(u); } } catch {} }
    for (const u of urls.slice(0, 10)) {
      const r = usedRender ? await browserFetch(u) : await fetchSite(u);
      if (r.status !== 200 || !r.html) continue;
      pagesHtml.push(r.html); for (const d of suspiciousDomains(r.html)) suspects.add(d);
      hit = systemIn(r.html); if (hit) break;
    }
  }
  for (const d of suspects) domainTally.set(d, (domainTally.get(d) || 0) + 1);
  if (hit) results.push({ id: lead.id, name: lead.name, website: lead.website, outcome: "FALSE_NEGATIVE", system: hit.system, evidence: hit.url, usedRender });
  else results.push({ id: lead.id, name: lead.name, website: lead.website, outcome: suspects.size ? "confirmed-none-but-suspect-domains" : "confirmed-none", suspects: [...suspects], usedRender });
}
async function worker() { while (i < sample.length) { const lead = sample[i++]; try { await checkOne(lead); } catch (e) { results.push({ id: lead.id, name: lead.name, outcome: "error", err: String(e?.message||e).slice(0,100) }); } if (results.length % 25 === 0) console.log(`${results.length}/${sample.length}`); } }
await Promise.all(Array.from({ length: CONC }, worker));
if (browser) await browser.close().catch(() => {});

const fn = results.filter(r => r.outcome === "FALSE_NEGATIVE");
const suspectRows = results.filter(r => r.outcome === "confirmed-none-but-suspect-domains");
const stillUnreachable = results.filter(r => r.outcome === "still-unreachable");
const errors = results.filter(r => r.outcome === "error");
const confirmedNone = results.filter(r => r.outcome === "confirmed-none");

const topDomains = [...domainTally.entries()].sort((a,b)=>b[1]-a[1]).slice(0, 30);

console.log("\n=== SPOT-CHECK REPORT ===");
console.log(`sampled: ${sample.length} of ${pool.length} in the confirmed-no-system bucket`);
console.log(`FALSE NEGATIVES (a known system was actually found): ${fn.length} / ${sample.length - stillUnreachable.length - errors.length} checkable (${((fn.length/(sample.length - stillUnreachable.length - errors.length || 1))*100).toFixed(1)}%)`);
for (const r of fn) console.log(`  - ${r.name} (${r.id}) -> ${r.system} [${r.evidence || "inline"}]${r.usedRender ? " (needed render)" : ""}`);
console.log(`confirmed genuinely none: ${confirmedNone.length}`);
console.log(`confirmed none but had unmatched suspicious domains: ${suspectRows.length}`);
console.log(`still unreachable even with render fallback: ${stillUnreachable.length}`);
console.log(`errors: ${errors.length}`);
console.log(`\ntop unmatched "booking-ish" domains seen across the sample (candidates for new patterns):`);
for (const [d, n] of topDomains) console.log(`  ${n}x  ${d}`);

fs.writeFileSync(path.resolve("scripts/leads/out/booking_spotcheck.json"), JSON.stringify({ sampleSize: sample.length, poolSize: pool.length, falseNegatives: fn, suspectRows, stillUnreachable: stillUnreachable.length, errors: errors.length, confirmedNone: confirmedNone.length, topDomains }, null, 1));
process.exit(0);
