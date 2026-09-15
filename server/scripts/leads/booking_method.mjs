// Manual-booking-language classifier. "No booking system detected" currently conflates two very different leads:
// (a) genuinely takes bookings by phone/email only (a GREAT sales lead — no incumbent booking system to displace),
// (b) we just failed to detect their real online system (JS widget, unlisted platform, etc). Pitching (b) as "you
// have no bookings" would be wrong and embarrassing. This pass tells them apart, zero Brave cost — pure page fetch.
//
// For every lead with a confirmed website and NO bookingSystem: fetch the homepage plus a handful of likely pages
// (contact/booking/prices + sitemap.xml bookish entries, same style as residue.mjs) and scan the combined text for
// explicit manual-booking phrases ("call to book", "booking by phone only", "email us to book a place", etc).
//   bookingMethod: "confirmed-manual"  — explicit call/phone/email-to-book language found
//   bookingMethod: "unconfirmed"       — pages actually fetched and scanned; neither a system nor manual language found
//   (a lead that gets a bookingSystem via the normal verify pipeline is out of scope for this field entirely)
//
// Resumable + fill-only: skips leads that already have bookingMethod set (use --recheck to force). --apply writes
// bookingMethod (and never touches a lead that has since gained a real bookingSystem).
// Usage (from server/): node scripts/leads/booking_method.mjs [--limit N] [--run] [--apply] [--recheck]
import "dotenv/config"; import admin from "firebase-admin"; import fs from "fs"; import path from "path";
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync("./serviceAccountKey.json","utf8"))) });
const db = admin.firestore();
const args = Object.fromEntries(process.argv.slice(2).map((a,i,arr)=>a.startsWith("--")?[a.slice(2),arr[i+1]&&!arr[i+1].startsWith("--")?arr[i+1]:true]:[]).filter(x=>x.length));
const LIMIT = args.limit ? +args.limit : Infinity;
const OUT = path.resolve("scripts/leads/out/booking_method.out.jsonl");
const CONC = 16, TIMEOUT = 10000, MAXBYTES = 1_200_000;
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

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

const BOOKISH_PATH = /\/(book|booking|bookings|book-now|book-online|book-a-place|enrol|enroll|enrolment|register|registration|sign-?up|join|shop|store|prices?|pricing|fees|timetable|schedule|sessions?|classes|clubs?|camps?|holiday-?clubs?|holiday-?camps?|holidays|after-?school|breakfast|wraparound|courses?|workshops?|parties|membership|pay|payments?|checkout|basket|cart|tickets?|whats-on|events?|contact|about|find-us|findus)(\/|\.|\?|-|$)/i;
const GUESS = ["/contact", "/contact-us", "/book", "/booking", "/how-to-book", "/prices", "/fees", "/faq", "/faqs"];
async function sitemapLinks(base) { try { const o = new URL(base).origin; const r = await fetchSite(o + "/sitemap.xml"); if (r.status !== 200 || !/<loc>/i.test(r.html)) return []; return [...r.html.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map(m=>m[1]).filter(u => { try { const x = new URL(u); return x.origin === o && BOOKISH_PATH.test(x.pathname); } catch { return false; } }).slice(0, 6); } catch { return []; } }

const strip = (h) => h.replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<!--[\s\S]*?-->/g," ").replace(/<[^>]+>/g," ").replace(/&nbsp;|&#160;/g," ").replace(/&amp;/g,"&").replace(/&#39;|&apos;/g,"'").replace(/\s+/g," ").toLowerCase();

// Manual-booking language. Deliberately phrase-anchored around "book"/"reserve"/"enquir(e)" + a phone/email channel,
// in either word order, plus a few standalone "telephone/email bookings only" style statements.
const MANUAL_RX = [
  /\b(call|phone|telephone|ring)( us)?\s+to\s+(book|reserve|enrol{1,2}|enquire|register)/i,
  /\b(email|e-?mail)( us)?\s+to\s+(book|reserve|enrol{1,2}|enquire|register)/i,
  /\b(book|reserve|enrol{1,2}|enquire|register)(ing)?\s+(a\s+(place|space)\s+)?(by|via|through|over)\s+(phone|telephone|email|e-?mail)/i,
  /\bto\s+(book|reserve|enrol{1,2}|enquire|register)[^.]{0,40}\b(please\s+)?(call|phone|telephone|ring|email|e-?mail|contact)\b/i,
  /\b(please\s+)?(call|phone|telephone|ring|email|e-?mail|contact)\s+us\s+to\s+(book|reserve|enrol{1,2}|arrange|discuss)/i,
  /\bbooking(s)?\s+(is|are|taken|handled|made)\s+(by|via|over)\s+(phone|telephone|email|e-?mail)/i,
  /\b(phone|telephone|email|e-?mail)\s+bookings?\s+only\b/i,
  /\bno\s+online\s+booking/i,
  /\bwe\s+do(n'?t| not)\s+(currently\s+)?(offer|have)\s+online\s+booking/i,
  /\bbookings?\s+(currently\s+)?(not|aren'?t|isn'?t)\s+available\s+online/i,
  /\bfor\s+booking(s)?,?\s+(please\s+)?(call|phone|telephone|ring|email|e-?mail|contact)/i,
  /\bto\s+(reserve|secure)\s+(a|your)\s+(place|space|spot)[^.]{0,40}\b(call|phone|telephone|ring|email|e-?mail|contact)\b/i,
  /\bcontact\s+us\s+(directly\s+)?to\s+book/i,
  /\bbook(ing)?\s+is\s+by\s+(appointment|arrangement)\s+only/i,
  /\bbook\s+your\s+(place|space|spot)\s+by\s+(calling|emailing|phoning)/i,
];
const manualHit = (t) => { for (const re of MANUAL_RX) { const m = t.match(re); if (m) return m[0].slice(0, 140); } return null; };

// URL alternates (www/non-www, http/https, common TLD swaps) — same pattern as residue.mjs's Group A retry, used
// both as a fallback inside every classify() call and via --recheck-unreachable to specifically revisit leads that
// were left "unconfirmed" only because the homepage couldn't be fetched at all (bot wall, TLS hiccup, moved host).
const squash = (s) => (s||"").toLowerCase().replace(/[^a-z0-9]/g,"");
const tokens2 = (s) => (s||"").toLowerCase().replace(/[’']/g,"").split(/[^a-z0-9]+/).filter(t=>t.length>=4);
function alternates(u0, name) { let u; try { u = new URL(u0); } catch { return []; }
  const host = u.hostname.replace(/^www\./,""); const pathq = (u.pathname === "/" ? "" : u.pathname) + u.search;
  const tld = host.match(/\.(co\.uk|org\.uk|com|org|uk|net|co|info|scot|wales|cymru)$/i)?.[1]; const stem = tld ? host.slice(0, -(tld.length + 1)) : host;
  const stemOk = (() => { const sq = squash(stem.split(".")[0]); return tokens2(name).some(t => sq.includes(t)) || (squash(name).length >= 6 && sq.includes(squash(name).slice(0, 8))); })();
  const hosts = [host, "www." + host]; if (tld && stemOk) for (const t of ["co.uk", "com", "org", "uk", "org.uk"]) if (t !== tld.toLowerCase()) hosts.push(stem + "." + t, "www." + stem + "." + t);
  const orig = u0.replace(/\/$/, ""); const out = [];
  for (const h of hosts) for (const s of ["https", "http"]) { const url = `${s}://${h}${pathq}`; if (url.replace(/\/$/, "") !== orig) out.push(url); }
  return out; }

const done = new Set(fs.existsSync(OUT) ? fs.readFileSync(OUT,"utf8").split("\n").filter(Boolean).map(l=>{try{return JSON.parse(l).id}catch{return null}}) : []);

if (args.apply) {
  const rows = fs.readFileSync(OUT,"utf8").split("\n").filter(Boolean).map(l=>JSON.parse(l));
  const ids = [...new Set(rows.map(r=>r.id))]; const cur = new Map();
  for (let i=0;i<ids.length;i+=300) { const snaps = await db.getAll(...ids.slice(i,i+300).map(id=>db.collection("leads").doc(id)), { fieldMask:["website","bookingSystem","bookingMethod","excluded"] }); for (const s of snaps) if (s.exists) cur.set(s.id, s.data()); }
  let batch = db.batch(), inB = 0; const c = {}; const bump = (k)=>c[k]=(c[k]||0)+1; const stamp = new Date().toISOString();
  for (const r of rows) { const x = cur.get(r.id); if (!x || x.excluded) { bump("skipped: gone/excluded"); continue; }
    if (x.bookingSystem) { bump("skipped: now has a real bookingSystem (out of scope for this field)"); continue; }
    // "unconfirmed" is always safe to upgrade (it's the weak/default state); only a prior "confirmed-manual" needs --recheck to overwrite.
    if (x.bookingMethod === "confirmed-manual" && !args.recheck) { bump("skipped: already confirmed-manual"); continue; }
    if (x.bookingMethod === "unconfirmed" && r.bookingMethod === "unconfirmed" && !args.recheck && !r.retriedUnreachable) { bump("skipped: bookingMethod already set"); continue; }
    const upd = { bookingMethod: r.bookingMethod, bookingMethodEvidence: r.evidence || null, bookingMethodCheckedAt: stamp };
    batch.update(db.collection("leads").doc(r.id), upd); inB++; bump(`set: ${r.bookingMethod}`);
    if (inB >= 400) { await batch.commit(); batch = db.batch(); inB = 0; } }
  if (inB) await batch.commit(); console.log("APPLIED", JSON.stringify(c)); process.exit(0);
}

const snap = await db.collection("leads").select("name","location","website","excluded","bookingSystem","bookingMethod","bookingMethodEvidence").get();
const all = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(l => !l.excluded && l.website && !l.bookingSystem);
console.log("TARGET", JSON.stringify({ leadsWithWebsiteNoBookingSystem: all.length, alreadyClassified: all.filter(l=>l.bookingMethod).length }));
if (!args.run) process.exit(0);

// --recheck-unreachable: revisit only the leads left "unconfirmed" purely because the homepage fetch failed
// outright (not because we checked and found nothing) — now with the alternate-URL retry built into classify().
const RECHECK_UNREACHABLE = !!args["recheck-unreachable"];
const todo = (RECHECK_UNREACHABLE
    ? all.filter(l => l.bookingMethod === "unconfirmed" && /^homepage unreachable/i.test(l.bookingMethodEvidence || ""))
    : all.filter(l => args.recheck || (!l.bookingMethod && !done.has(l.id))))
  .slice(0, LIMIT);
console.log(`to classify: ${todo.length} (already done ${done.size}, total eligible ${all.length})`);
const out = fs.createWriteStream(OUT, { flags: "a" });
let i = 0, n = 0; const tally = {}; const bump = (k)=>tally[k]=(tally[k]||0)+1; const t0 = Date.now();

async function classify(lead) {
  const base = /^https?:\/\//i.test(lead.website) ? lead.website : "https://" + lead.website;
  let home = await fetchSite(base); let usedUrl = base;
  if (home.status === 429 || home.status === 403) { await new Promise(r=>setTimeout(r, 2500)); home = await fetchSite(base); } // bot wall / rate limit — one polite retry before giving up
  if (home.status !== 200 || !home.html) {
    // Homepage as recorded didn't work — try the obvious alternates (www/non-www, http/https, TLD swaps) before giving up.
    for (const u of alternates(base, lead.name)) { const r = await fetchSite(u); if (r.status === 200 && r.html) { home = r; usedUrl = u; break; } }
  }
  if (home.status !== 200 || !home.html) { bump("fetch failed — homepage unreachable, left unconfirmed"); return { id: lead.id, bookingMethod: "unconfirmed", evidence: `homepage unreachable (${home.err || home.status})`, pagesRead: 0 }; }
  let text = strip(home.html); let pagesRead = 1;
  if (usedUrl !== base) home.final = home.final || usedUrl;
  let hit = manualHit(text);
  if (!hit) {
    const seen = new Set(); const urls = [];
    try { const origin = new URL(home.final || base); for (const m of home.html.matchAll(/href=["']([^"'#]+)["']/gi)) { let u; try { u = new URL(m[1], home.final || base); } catch { continue; } if (u.hostname.replace(/^www\./,"") !== origin.hostname.replace(/^www\./,"")) continue; if (!BOOKISH_PATH.test(u.pathname) || seen.has(u.pathname)) continue; seen.add(u.pathname); urls.push(u.href); if (urls.length >= 4) break; } } catch {}
    try { const o = new URL(home.final || base).origin; for (const p of GUESS) if (!seen.has(p)) { seen.add(p); urls.push(o + p); } } catch {}
    for (const u of await sitemapLinks(home.final || base)) { try { const p = new URL(u).pathname; if (!seen.has(p)) { seen.add(p); urls.push(u); } } catch {} }
    for (const u of urls.slice(0, 8)) {
      const r = await fetchSite(u); if (r.status !== 200 || !r.html) continue; pagesRead++;
      const t = strip(r.html); hit = manualHit(t); if (hit) { text = t; break; }
    }
  }
  if (hit) { bump("confirmed-manual"); return { id: lead.id, bookingMethod: "confirmed-manual", evidence: hit, pagesRead }; }
  bump("unconfirmed"); return { id: lead.id, bookingMethod: "unconfirmed", evidence: null, pagesRead };
}

async function worker() { while (i < todo.length) { const lead = todo[i++]; let row; try { row = await classify(lead); } catch (e) { row = { id: lead.id, bookingMethod: "unconfirmed", evidence: `error: ${String(e?.message||e).slice(0,100)}`, pagesRead: 0 }; bump("error — left unconfirmed"); }
  row.at = new Date().toISOString(); if (RECHECK_UNREACHABLE) row.retriedUnreachable = true; out.write(JSON.stringify(row) + "\n"); n++; if (n % 200 === 0) console.log(`${n}/${todo.length} ${Math.round((Date.now()-t0)/1000)}s`, JSON.stringify(tally)); } }
await Promise.all(Array.from({ length: CONC }, worker));
out.end(); console.log("done", n, JSON.stringify(tally)); process.exit(0);
