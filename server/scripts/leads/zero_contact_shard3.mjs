// Zero-contact-channel backlog, SHARD 3 of 5 (parallel run alongside shards 1/2/4/5 working the same backlog on
// disjoint doc-id slices — shard split is by the last hex char of the Firestore doc id: shard3 = {8,9,a,b}).
// Target: leads with NO website, NO email, NO phone, NO socialUrl at all ("silly dead ends"). For each one:
//   1. One Brave search: `"<name>" <town>`.
//   2. If a result's host carries the provider's name (find_websites.mjs rule), fetch it and judge it with the
//      same CHILD/OTHER/location logic residue.mjs uses. A page that reads as their (children's-activity) site AND
//      carries their name/location is confirmed straight to `website` (this backlog has nothing to protect by being
//      more cautious — there's no existing site to preserve). A same-sector-but-unconfirmed hit goes to
//      `websiteCandidate` for a human/verify_sites pass instead of guessing.
//   3. Any email/phone found on that page (home + one contact-style subpage) is filled in too.
//   4. No matching website, but a Facebook/Instagram result whose slug carries the name → `socialUrl`.
//   5. Nothing at all (search ran clean, no hit) → contactSearchStatus="no-channel-found" (honest dead end, fill-only,
//      never fabricated). Search itself failed/skipped (429 exhausted retries, 402 no credit, network) →
//      contactSearchStatus="search-skipped" so it's retried later, never mistaken for "we looked and found nothing".
// Resumable via scripts/leads/out/zero_contact_shard3.out.jsonl. Usage (from server/):
//   node scripts/leads/zero_contact_shard3.mjs --run [--limit N] [--budget N]
import "dotenv/config"; import admin from "firebase-admin"; import fs from "fs"; import path from "path";
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync("./serviceAccountKey.json","utf8"))) });
const db = admin.firestore();
const args = Object.fromEntries(process.argv.slice(2).map((a,i,arr)=>a.startsWith("--")?[a.slice(2),arr[i+1]&&!arr[i+1].startsWith("--")?arr[i+1]:true]:[]).filter(x=>x.length));
const LIMIT = args.limit ? +args.limit : Infinity;
const BRAVE_BUDGET = args.budget ? +args.budget : 2400;
const OUT = path.resolve("scripts/leads/out/zero_contact_shard3.out.jsonl");
const LOG = path.resolve("scripts/leads/out/zero_contact_shard3.log");
const CONC = 5, TIMEOUT = 10000, MAXBYTES = 1_200_000, GAP_MS = 350;
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const API_KEY = process.env.BRAVE_SEARCH_API_KEY || "";
const sleep = (ms) => new Promise(r=>setTimeout(r,ms));
const log = (msg) => { const line = `[${new Date().toISOString()}] ${msg}`; console.log(line); fs.appendFileSync(LOG, line + "\n"); };

// ---------- shared helpers (copied from residue.mjs / find_websites.mjs / find_contacts.mjs for identical behaviour) ----------
const CHILD = ["nursery","nurseries","pre-school","preschool","childcare","child care","children","kids","holiday club","holiday camp","after school","after-school","breakfast club","wraparound","wrap around","ofsted","early years","eyfs","toddler","baby","babies","playgroup","childminder","childminding","forest school","summer camp","multi-sport","multi sport","football coaching","gymnastics","swimming lessons","dance school","dance classes","drama","tuition","tutoring","tutor","stay and play","soft play","party","parties","activities for children","kids club","youth","scouts","cubs","beavers","brownies","guides","kindergarten","day care","daycare","montessori","reception","key stage","ks1","ks2","under 5","under-5","ages 4","ages 5","aged 4","aged 5","years old","school holidays","term time","term-time","half term","clubs for kids","sports coaching","coaching for children","little","junior","juniors","mini","minis","tots","play"];
const OTHER = ["estate agent","letting agent","solicitor","solicitors","accountant","accountants","plumber","plumbing","electrician","roofing","builders","scaffolding","car wash","garage services","mot centre","tyres","dentist","dental practice","opticians","pharmacy","funeral","casino","betting","bookmaker","vape","tattoo","barber","hair salon","beauty salon","nail bar","restaurant","takeaway","public house","bar and grill","hotel rooms","b&b","holiday cottages","caravan park","gym membership","personal trainer","crossfit","bodybuilding","car sales","used cars","van hire","removals","storage units","recruitment agency","it support","web design","seo agency","marketing agency","insurance broker","mortgage","loans","crypto","forex","escort","adult only","dating","cbd","kitchens","bathrooms","flooring","carpets","windows and doors","double glazing","landscaping","tree surgeon","pest control","cleaning services","skip hire","wedding venue","conference centre","office space","coworking","church services","funeral directors","vets","veterinary","dog grooming","kennels","cattery"];
const PARKED = ["domain is for sale","this domain is for sale","buy this domain","domain may be for sale","parked domain","this domain has expired","domain expired","sedo","hugedomains","dan.com","afternic","godaddy.com/domainsearch","namecheap.com/domains","this web page is parked","website is parked","site not found","account suspended","this site can’t be reached","under construction","default web page","welcome to nginx","apache2 debian default","it works!","index of /","plesk","cpanel","wix.com/website-template","site is temporarily unavailable","this website is currently unavailable","website expired","domain not configured","squarespace: claim","this site is not yet published","this store is currently unavailable","shop coming soon"];
const strip = (h) => h.replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<!--[\s\S]*?-->/g," ").replace(/<[^>]+>/g," ").replace(/&nbsp;|&#160;/g," ").replace(/&amp;/g,"&").replace(/&#39;|&apos;/g,"'").replace(/\s+/g," ").toLowerCase();
const STOP = new Set("the and of ltd limited cic cio uk plc llp co club clubs school nursery pre preschool childcare children kids day care centre center group holiday camp camps club activities activity community trust academy little happy days playgroup out after".split(" "));
const tokens = (s) => (s||"").toLowerCase().replace(/[’']/g,"").split(/[^a-z0-9]+/).filter(t=>t.length>=3 && !STOP.has(t));
const squash = (s) => (s||"").toLowerCase().replace(/[^a-z0-9]/g,"");
const locBits = (loc) => { const out=[]; for (const part of String(loc||"").split(/[·,|\/]/)) { const p=part.trim().toLowerCase(); if(!p) continue; const pc=p.match(/\b([a-z]{1,2}\d[a-z\d]?)\s*(\d[a-z]{2})?\b/); if(pc){ out.push(pc[1]); if(pc[2]) out.push(pc[1]+" "+pc[2]); continue; } if(/^\d+ sites?$/.test(p)) continue; if(p.length>=4 && !/^(uk|england|wales|scotland|london borough)$/.test(p)) out.push(p); } return [...new Set(out)]; };
const RX = new Map(); const rx = (t) => { if(!RX.has(t)) RX.set(t, new RegExp("(^|[^a-z])"+t.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+"(s|es|'s)?([^a-z]|$)","i")); return RX.get(t); };
const count = (text, list) => list.filter(t => rx(t).test(text));
const town = (l) => { const loc = String(l.location||"").split(/[·|]/)[0].split(",")[0].replace(/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/,"").trim(); return loc && !/^\d+ sites?$/i.test(loc) ? loc : (l.county||l.region||l.postcode||"").trim(); };
const SKIP = /(maps\.apple|maps\.google|goo\.gl|waze|what3words|openstreetmap|facebook|instagram|twitter|x\.com|tiktok|youtube|linkedin|pinterest|threads\.net|gov\.uk|ofsted|nhs\.uk|yell\.com|yelp|thomsonlocal|192\.com|cylex|hotfrog|freeindex|scoot|childcare\.co\.uk|daynurseries|nurseriesuk|care\.com|careinspectorate|familysupportni|findchildcare|hoop\.co\.uk|eequ|pebble|playwaze|yellowdays|clubspark|footballfoundation|classforkids|bookwhen|kidadl|mumsnet|netmums|indeed|glassdoor|reed\.co\.uk|totaljobs|companieshouse|endole|opencorporates|checkacompany|companycheck|bizstats|find-and-update|charitycommission|register-of-charities|wikipedia|trustpilot|google\.|bing\.|amazon|ebay|etsy|nextdoor|tripadvisor|justgiving|gofundme|eventbrite|meetup|wordpress\.com|blogspot|wixsite|weebly|sites\.google|linktr\.ee|schoolsweb|primaryschool|\.sch\.uk|\.ac\.uk|schoolguide|locrating|getthedata|streetcheck|doogal|postcodearea|activityos|news|echo|gazette|times|mail|express|mirror|standard|chronicle|courier|herald|observer|telegraph|guardian|bbc\.)/i;
const SOCIAL = /^(www\.|m\.|en-gb\.)?(facebook\.com|instagram\.com)\//i;
function pickWebsite(lead, results) { const nt = tokens(lead.name); const nsq = squash(lead.name); if (!nt.length) return null;
  for (const r of results.slice(0, 8)) { let host; try { host = new URL(r.url).hostname.replace(/^www\./,""); } catch { continue; } if (SKIP.test(host) || SKIP.test(r.url)) continue;
    const hsq = host.split(".")[0]; const hostHit = nt.some(t => t.length >= 4 && hsq.includes(t)) || (nsq.length >= 6 && hsq.includes(nsq.slice(0, Math.min(nsq.length, 12))));
    if (hostHit) return { url: `https://${host}/`, why: `host carries the name (${host})`, title: r.title }; }
  return null; }
function pickSocial(lead, results) { const nt = tokens(lead.name); for (const r of results.slice(0, 8)) { let h, p; try { const x = new URL(r.url); h = x.hostname.replace(/^www\./,""); p = x.pathname; } catch { continue; } if (!SOCIAL.test(h + p)) continue; const slug = tokens(p.replace(/\/(pages|people|groups|profile\.php)/,"")); if (nt.some(t => t.length >= 4 && slug.some(s => s.includes(t) || t.includes(s)))) return r.url; } return null; }
// email/phone extraction (find_contacts.mjs)
const BAD_MAIL = /(example\.com|sentry|wixpress|wordpress|godaddy|\.png|\.jpg|\.gif|\.svg|\.webp|noreply|no-reply|donotreply|privacy@|abuse@|dmca@|jscomp|schema\.org|w3\.org|@2x|@3x|u003e|sitemap)/i;
const decode = (s) => s.replace(/&#(\d+);/g,(m,n)=>String.fromCharCode(+n)).replace(/&#x([0-9a-f]+);/gi,(m,h)=>String.fromCharCode(parseInt(h,16))).replace(/&amp;/g,"&").replace(/&nbsp;/g," ").replace(/\[at\]|\(at\)/gi,"@").replace(/\[dot\]|\(dot\)/gi,".");
function emails(html, host) { const h = decode(html); const set = new Map();
  for (const m of h.matchAll(/mailto:([^"'?\s<>]+)/gi)) { const e = m[1].trim().toLowerCase(); if (/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(e) && !BAD_MAIL.test(e)) set.set(e, (set.get(e)||0)+10); }
  for (const m of h.matchAll(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi)) { const e = m[0].toLowerCase(); if (!BAD_MAIL.test(e) && !/\.(js|css|html|php)$/.test(e)) set.set(e, (set.get(e)||0)+1); }
  return [...set.entries()].map(([e,n]) => { const d = e.split("@")[1]; const own = host && (host.endsWith(d) || d.endsWith(host)); return { e, score: n + (own ? 20 : 0) + (/^(info|hello|enquiries|bookings|admin|contact|office)@/.test(e) ? 3 : 0) }; }).sort((a,b)=>b.score-a.score).map(x=>x.e); }
function phones(html) { const t = decode(html).replace(/<[^>]+>/g," "); const out = new Map();
  for (const m of t.matchAll(/(?:\+44\s?\(?0?\)?\s?|\b0)(?:\d[\s\-().]?){9,10}\b/g)) { let p = m[0].replace(/[^\d+]/g,""); if (p.startsWith("+44")) p = "0" + p.slice(3).replace(/^0/,""); if (!/^0(1|2|3|7|8)\d{8,9}$/.test(p)) continue; if (/^0(800|808|845|870|871|844|843)/.test(p) && out.size) continue; out.set(p, (out.get(p)||0)+1); }
  for (const m of html.matchAll(/href=["']tel:([^"']+)/gi)) { let p = m[1].replace(/[^\d+]/g,""); if (p.startsWith("+44")) p = "0" + p.slice(3).replace(/^0/,""); if (/^0(1|2|3|7|8)\d{8,9}$/.test(p)) out.set(p, (out.get(p)||0)+10); }
  return [...out.entries()].sort((a,b)=>b[1]-a[1]).map(([p])=>p.replace(/^(0\d{2,4})(\d{3})(\d{3,4})$/, "$1 $2 $3")); }
function contactLinks(html, base) { const hrefs = [...html.matchAll(/href=["']([^"'#]*(contact|about|find-us|findus|get-in-touch|enquir|book)[^"'#]*)["']/gi)].map(x=>x[1]).filter(h=>!/^(mailto|tel|javascript)/i.test(h)); const out=[]; for (const h of hrefs) { try { const u = new URL(h, base); if (u.hostname === new URL(base).hostname && !out.includes(u.href)) out.push(u.href); } catch {} } return out.slice(0,2); }
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
async function scrapeContact(homeHtml, base) { let html = homeHtml; for (const c of contactLinks(homeHtml, base)) { const r = await fetchSite(c); if (r.status === 200) html += "\n" + r.html; } const host = (()=>{ try { return new URL(base).hostname.replace(/^www\./,""); } catch { return ""; } })(); const em = emails(html, host), ph = phones(html); return { email: em[0] || null, phone: ph[0] || null }; }
function judge(lead, html) { const text = strip(html); const parkedHits = count(text.slice(0,4000), PARKED); const childHits = count(text, CHILD), otherHits = count(text, OTHER);
  const nameToks = tokens(lead.name); const nameHit = nameToks.filter(t => text.includes(t)); const nameOk = nameToks.length ? nameHit.length >= Math.max(1, Math.ceil(nameToks.length*0.6)) : false;
  const locs = locBits(lead.location); const locHits = locs.filter(l => text.includes(l)); const locOk = locHits.length > 0;
  let sector = "no-signal"; if (parkedHits.length && childHits.length < 2) sector = "parked"; else if (text.length < 200) sector = "empty"; else if (childHits.length >= 2) sector = "child"; else if (otherHits.length >= 2 && childHits.length === 0) sector = "other-sector";
  let verdict; if (sector === "child" && nameOk && locOk) verdict = "confirm"; else if (sector === "child" && nameOk) verdict = "confirm-weak"; else if (sector === "child") verdict = "keep-candidate"; else verdict = "drop";
  return { verdict, sector, nameOk, locOk }; }

// ---------- brave search ----------
let braveUsed = 0, braveDead = null;
async function search(q, _retry = 0) { if (!API_KEY) return { status: 0, results: [], err: "no BRAVE_SEARCH_API_KEY" }; if (braveDead) return { status: 402, results: [], err: braveDead, skipped: true };
  const ctrl = new AbortController(); const t = setTimeout(()=>ctrl.abort(), 15000);
  try { braveUsed++; const r = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(q)}&country=GB&search_lang=en&count=10&safesearch=moderate`, { signal: ctrl.signal, headers: { accept: "application/json", "accept-encoding": "gzip", "x-subscription-token": API_KEY } });
    if (r.status === 429 && _retry < 2) { clearTimeout(t); await sleep(15000); return search(q, _retry+1); }
    if (r.status !== 200) { const body = (await r.text()).slice(0, 160); if (r.status === 402) braveDead = "Brave credit exhausted (402): " + (body.match(/"detail":"([^"]+)"/)?.[1] || body); return { status: r.status, results: [], err: body }; }
    const j = await r.json(); return { status: 200, results: (j.web?.results ?? []).map(x => ({ url: x.url, title: x.title || "", desc: x.description || "" })) }; }
  catch (e) { return { status: 0, results: [], err: String(e?.name||e).slice(0,40) }; } finally { clearTimeout(t); } }

// ---------- load leads: zero-contact, shard3 slice ----------
const FIELDS = ["name","location","county","region","postcode","website","email","phone","socialUrl","excluded","contactSearchStatus"];
const snap = await db.collection("leads").select(...FIELDS).get();
const SHARD_CHARS = new Set(["8","9","a","b"]);
const all = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  .filter(l => !l.excluded && !l.website && !l.email && !l.phone && !l.socialUrl)
  .filter(l => SHARD_CHARS.has(l.id.slice(-1).toLowerCase()))
  .sort((a,b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

const doneRows = fs.existsSync(OUT) ? fs.readFileSync(OUT,"utf8").split("\n").filter(Boolean).map(l=>{try{return JSON.parse(l)}catch{return null}}).filter(Boolean) : [];
const redo = (r) => r.result === "search-skipped" || r.result === "error";
const done = new Set(doneRows.filter(r => !redo(r)).map(r=>r.id));
braveUsed = doneRows.filter(r=>r.searched).length;

if (!args.run) { log(`shard3 zero-contact leads: ${all.length}, already done: ${done.size}, brave used so far (this log): ${braveUsed}`); process.exit(0); }

const todo = all.filter(l => !done.has(l.id)).slice(0, LIMIT);
log(`START shard3 run: total=${all.length} alreadyDone=${done.size} todo=${todo.length} budget=${BRAVE_BUDGET}`);
const out = fs.createWriteStream(OUT, { flags: "a" });
const tally = {}; const bump = (k) => tally[k] = (tally[k]||0)+1;
let i = 0, n = 0; const t0 = Date.now();

async function processOne(lead) {
  const row = { id: lead.id, name: lead.name, searched: false };
  if (braveUsed >= BRAVE_BUDGET) { row.result = "search-skipped"; row.why = "brave budget exhausted for this run"; bump("search-skipped: budget"); return row; }
  const q = `"${lead.name}" ${town(lead)}`.trim();
  const s = await search(q); row.searched = true; row.q = q; row.searchStatus = s.status;
  await sleep(GAP_MS);
  if (s.status !== 200) { row.result = "search-skipped"; row.why = `search failed: ${s.status} ${(s.err||"").slice(0,100)}`; if (s.skipped) braveUsed--; bump("search-skipped: error"); return row; }
  row.top = s.results.slice(0,3).map(x=>x.url.slice(0,90));

  const wp = pickWebsite(lead, s.results);
  if (wp) {
    const r = await fetchSite(wp.url);
    if (r.status === 200 && r.html.length > 300) {
      const j = judge(lead, r.html);
      row.candidateUrl = wp.url; row.verdict = j.verdict; row.sector = j.sector;
      if (j.verdict === "confirm" || j.verdict === "confirm-weak") {
        row.result = "website"; row.website = wp.url;
        const ct = await scrapeContact(r.html, r.final || wp.url);
        if (ct.email) row.email = ct.email; if (ct.phone) row.phone = ct.phone;
        bump(`website confirmed (${j.verdict})`); if (ct.email) bump("+ email found"); if (ct.phone) bump("+ phone found");
        return row;
      } else if (j.verdict === "keep-candidate") { row.result = "website-candidate"; row.websiteCandidate = wp.url; bump("website-candidate (child sector, name unconfirmed)"); return row; }
    }
  }
  const soc = pickSocial(lead, s.results);
  if (soc) { row.result = "social"; row.socialUrl = soc; bump("social found"); return row; }

  row.result = "no-channel-found"; row.why = `web search ("${q}") returned no website/social result whose host or profile carries the business name`;
  bump("no-channel-found"); return row;
}

async function worker() { while (i < todo.length) { const job = todo[i++]; let row;
  try { row = await processOne(job); } catch (e) { row = { id: job.id, name: job.name, result: "error", err: String(e?.message||e).slice(0,150) }; bump("error"); }
  row.at = new Date().toISOString(); out.write(JSON.stringify(row) + "\n"); n++;
  if (n % 50 === 0) log(`progress ${n}/${todo.length} brave=${braveUsed} ${JSON.stringify(tally)}`);
} }
await Promise.all(Array.from({ length: CONC }, worker));
out.end();
log(`DONE shard3 run: processed=${n} brave=${braveUsed} ${JSON.stringify(tally)} elapsed=${Math.round((Date.now()-t0)/1000)}s`);
process.exit(0);
