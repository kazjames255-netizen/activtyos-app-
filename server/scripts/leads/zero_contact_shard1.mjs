// Shard 1 of 5 — "zero contact channel" backlog: leads with NO website, email, phone, socialUrl, AND no
// secondaryContact (i.e. even the free-source indirect-route pass found nothing). These are the leads the
// user called "silly dead ends" — push harder via a real Brave search per lead before giving up on them.
// Shard split: last literal character of the Firestore doc ID in {0,1,2,3} (5-way split across parallel shards).
// For each lead: one Brave search ("<name>" <town>), then scan results for (in priority order):
//   1. a real website (same host/title-match heuristic as find_websites.mjs)          -> websiteCandidate
//   2. a Facebook/Instagram page carrying the name                                     -> socialUrl
//   3. an email or UK phone number sitting in the search result title/description      -> email / phone
// If truly nothing found after the search, marks an HONEST dead-end (never fabricates a contact):
//   zeroContactStatus="dead-no-presence" + zeroContactDeadWhy + zeroContactSearchedAt.
// Resumable: done-set tracked in scripts/leads/out/zero_contact_shard1.out.jsonl; writes to Firestore directly
// (fill-only — never overwrites an existing field) each iteration so progress survives a crash/stop.
// Usage: node scripts/leads/zero_contact_shard1.mjs [--limit N]
import "dotenv/config"; import admin from "firebase-admin"; import fs from "fs"; import path from "path";
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync("./serviceAccountKey.json","utf8"))) });
const db = admin.firestore();
const args = Object.fromEntries(process.argv.slice(2).map((a,i,arr)=>a.startsWith("--")?[a.slice(2),arr[i+1]&&!arr[i+1].startsWith("--")?arr[i+1]:true]:[]).filter(x=>x.length));
const LIMIT = args.limit ? +args.limit : Infinity;
const SHARD_CHARS = new Set(["0","1","2","3"]);
const OUT = path.resolve("scripts/leads/out/zero_contact_shard1.out.jsonl");
const LOG = path.resolve("scripts/leads/zero_contact_shard1.log");
const API_KEY = process.env.BRAVE_SEARCH_API_KEY || "";
const GAP_MS = args.gap ? +args.gap : 300;
const log = (...a) => { const line = a.map(x=>typeof x==="string"?x:JSON.stringify(x)).join(" "); console.log(line); fs.appendFileSync(LOG, line + "\n"); };

const SKIP = /(maps\.apple|maps\.google|goo\.gl|waze|what3words|openstreetmap|twitter|x\.com|tiktok|youtube|linkedin|pinterest|threads\.net|gov\.uk|ofsted|nhs\.uk|yell\.com|yelp|thomsonlocal|192\.com|cylex|hotfrog|freeindex|scoot|childcare\.co\.uk|daynurseries|nurseriesuk|care\.com|careinspectorate|familysupportni|findchildcare|hoop\.co\.uk|eequ|pebble|playwaze|yellowdays|clubspark|footballfoundation|classforkids|bookwhen|kidadl|mumsnet|netmums|indeed|glassdoor|reed\.co\.uk|totaljobs|companieshouse|endole|opencorporates|checkacompany|companycheck|bizstats|find-and-update|charitycommission|register-of-charities|wikipedia|trustpilot|google\.|bing\.|amazon|ebay|etsy|nextdoor|tripadvisor|justgiving|gofundme|eventbrite|meetup|wordpress\.com|blogspot|wixsite|weebly|sites\.google|linktr\.ee|schoolsweb|primaryschool|\.sch\.uk|\.ac\.uk|schoolguide|locrating|getthedata|streetcheck|doogal|postcodearea|activityos|news|echo|gazette|times|mail|express|mirror|standard|chronicle|courier|herald|observer|telegraph|guardian|bbc\.)/i;
const SOCIAL_HOSTS = /^(www\.)?(facebook|instagram)\.com$/i;
const STOP = new Set("the and of ltd limited cic cio uk plc llp co club clubs school nursery pre preschool childcare children kids day care centre center group holiday camp camps club activities activity community trust academy little happy days playgroup out after".split(" "));
const tokens = (s) => (s||"").toLowerCase().replace(/[’']/g,"").split(/[^a-z0-9]+/).filter(t=>t.length>=3 && !STOP.has(t));
const squash = (s) => (s||"").toLowerCase().replace(/[^a-z0-9]/g,"");
const town = (l) => { const loc = String(l.location||"").split(/[·|]/)[0].split(",")[0].replace(/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/,"").trim(); return loc && !/^\d+ sites?$/i.test(loc) ? loc : (l.county||l.region||l.postcode||"").trim(); };
const decode = (s) => s.replace(/&amp;/g,"&").replace(/&#(\d+);/g,(m,n)=>String.fromCharCode(+n)).replace(/&quot;/g,'"').replace(/&#x27;|&#39;/g,"'").replace(/<[^>]+>/g,"");

async function search(q, _retry = false) {
  if (!API_KEY) return { status: 0, results: [], err: "no BRAVE_SEARCH_API_KEY" };
  const ctrl = new AbortController(); const t = setTimeout(()=>ctrl.abort(), 15000);
  try {
    const r = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(q)}&country=GB&search_lang=en&count=10&safesearch=moderate`, { signal: ctrl.signal, headers: { accept: "application/json", "accept-encoding": "gzip", "x-subscription-token": API_KEY } });
    if (r.status === 429 && !_retry) { clearTimeout(t); await new Promise(res=>setTimeout(res,20000)); return search(q, true); }
    if (r.status !== 200) { const body = (await r.text()).slice(0,160); return { status: r.status, results: [], err: body }; }
    const j = await r.json(); return { status: 200, results: (j.web?.results ?? []).map(x => ({ url: x.url, title: x.title || "", desc: x.description || "" })) };
  } catch (e) { return { status: 0, results: [], err: String(e?.name||e).slice(0,40) }; } finally { clearTimeout(t); }
}

function pickWebsite(lead, results) {
  const nt = tokens(lead.name); const nsq = squash(lead.name); if (!nt.length) return null;
  for (const r of results.slice(0, 8)) {
    let host; try { host = new URL(r.url).hostname.replace(/^www\./,""); } catch { continue; }
    if (SKIP.test(host) || SKIP.test(r.url) || SOCIAL_HOSTS.test(host)) continue;
    const hsq = host.split(".")[0]; const hostHit = nt.some(t => t.length >= 4 && hsq.includes(t)) || (nsq.length >= 6 && hsq.includes(nsq.slice(0, Math.min(nsq.length, 12))));
    const tt = tokens(r.title); const titleHits = nt.filter(t => tt.includes(t)).length;
    const BAD_TITLE = /(job|vacanc|career|review|directory|listing|near me|what'?s on|events? in|things to do|opening times|companies house|charity|inspection report|reported|news)/i;
    const titleHit = nt.length ? titleHits / nt.length >= 0.75 && !BAD_TITLE.test(r.title) : false;
    let depth = 0; try { depth = new URL(r.url).pathname.split("/").filter(Boolean).length; } catch {}
    if (hostHit || (titleHit && depth <= 1)) return { url: `https://${host}/`, why: hostHit ? `host carries the name (${host})` : `result title matched the name (${r.title.slice(0,60)})` };
  }
  return null;
}
function pickSocial(lead, results) {
  const nt = tokens(lead.name); if (!nt.length) return null;
  for (const r of results.slice(0, 8)) {
    let host; try { host = new URL(r.url).hostname.replace(/^www\./,""); } catch { continue; }
    if (!SOCIAL_HOSTS.test(host)) continue;
    const tt = tokens(r.title + " " + r.url); const hits = nt.filter(t => tt.includes(t)).length;
    if (hits / nt.length >= 0.6) return { url: r.url, why: `result title/url matched the name on ${host}` };
  }
  return null;
}
const EMAIL_RE = /[a-zA-Z0-9.\-_+]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/;
const PHONE_RE = /\b(?:\+44[\s.-]?\(?0?\)?[\s.-]?|0)(?:\d[\s.-]?){9,10}\b/;
function pickEmailPhone(results) {
  for (const r of results.slice(0, 8)) {
    const text = `${r.title} ${r.desc}`;
    const em = text.match(EMAIL_RE);
    if (em && !/example\.com|sentry|wixpress|noreply|no-reply|\.(png|jpg|gif)$/i.test(em[0])) return { type: "email", value: em[0].toLowerCase(), from: r.url };
    const ph = text.match(PHONE_RE);
    if (ph) { let digits = ph[0].replace(/[^\d+]/g,""); if (digits.startsWith("+44")) digits = "0"+digits.slice(3); if (/^0\d{9,10}$/.test(digits)) return { type: "phone", value: digits, from: r.url }; }
  }
  return null;
}

const doneIds = new Set(fs.existsSync(OUT) ? fs.readFileSync(OUT,"utf8").split("\n").filter(Boolean).map(l=>{try{return JSON.parse(l).id}catch{return null}}) : []);
log("=== zero_contact_shard1 run start", new Date().toISOString(), "already done:", doneIds.size);

const snap = await db.collection("leads").select("name","location","county","region","postcode","source","website","email","phone","socialUrl","excluded","secondaryContact").get();
let zero = [];
for (const d of snap.docs) {
  const x = d.data();
  if (x.excluded) continue;
  if (x.website || x.email || x.phone || x.socialUrl || x.secondaryContact) continue;
  const lastChar = d.id.slice(-1).toLowerCase();
  if (!SHARD_CHARS.has(lastChar)) continue;
  if (doneIds.has(d.id)) continue;
  zero.push({ id: d.id, ...x });
}
zero.sort((a,b)=> a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
zero = zero.slice(0, LIMIT);
log("shard1 leads to process:", zero.length);

const out = fs.createWriteStream(OUT, { flags: "a" });
let processed = 0, resolvedWebsite = 0, resolvedSocial = 0, resolvedEmailPhone = 0, deadEnd = 0, blocked = 0, braveDead = false;
for (const l of zero) {
  if (braveDead) break;
  const q = `"${l.name}" ${town(l)}`.trim();
  const r = await search(q);
  if (r.status === 402 || (r.status !== 200 && /credit|quota|exceed/i.test(r.err||""))) { braveDead = true; log("BRAVE CREDIT EXHAUSTED — stopping.", r.status, r.err); break; }
  if (r.status === 429 || r.status === 403) { blocked++; log("blocked", r.status, r.err||""); if (blocked > 8) { log("too many blocks — stopping"); break; } await new Promise(res=>setTimeout(res,10000)); continue; }

  const stamp = new Date().toISOString();
  const website = r.status === 200 ? pickWebsite(l, r.results) : null;
  const social = (!website && r.status === 200) ? pickSocial(l, r.results) : null;
  const ep = (!website && !social && r.status === 200) ? pickEmailPhone(r.results) : null;

  const upd = {};
  let outcome = "dead-no-presence";
  if (website) { upd.websiteCandidate = website.url; upd.websiteCandidateWhy = `zero-contact backlog web search: ${website.why} — unverified`; upd.websiteSearchedAt = stamp; upd.websiteSearchedBy = "brave web search (zero_contact_shard1.mjs)"; outcome = "website-candidate"; resolvedWebsite++; }
  else if (social) { upd.socialUrl = social.url; upd.socialFrom = `zero-contact backlog web search: ${social.why}`; outcome = "social"; resolvedSocial++; }
  else if (ep) { upd[ep.type] = ep.value; upd.contactFoundBy = `zero-contact backlog web search (result snippet, ${ep.from})`; upd.contactFoundAt = stamp; outcome = ep.type; resolvedEmailPhone++; }
  else {
    upd.zeroContactStatus = "dead-no-presence";
    upd.zeroContactDeadWhy = r.status === 200 ? `Brave search "${q}" returned ${r.results.length} result(s), none matched this provider's name or carried a usable contact — no discoverable online presence.` : `Brave search failed (status ${r.status}${r.err?": "+r.err.slice(0,80):""}) — could not confirm; needs retry.`;
    upd.zeroContactSearchedAt = stamp;
    deadEnd++;
  }

  try { await db.collection("leads").doc(l.id).update(upd); } catch (e) { log("write error", l.id, String(e).slice(0,120)); }
  out.write(JSON.stringify({ id: l.id, name: l.name, q, status: r.status, outcome }) + "\n");
  processed++;
  if (processed % 50 === 0) log(`progress: processed=${processed} website=${resolvedWebsite} social=${resolvedSocial} emailPhone=${resolvedEmailPhone} dead=${deadEnd} blocked=${blocked}`);
  await new Promise(res=>setTimeout(res, GAP_MS));
}
out.end();
log("=== FINAL", JSON.stringify({ processed, resolvedWebsite, resolvedSocial, resolvedEmailPhone, deadEnd, blocked, braveDead }));
process.exit(0);
