// Website finder for leads with no website: one Brave web search per lead ("<name>" <town>), take the first organic
// result that isn't a directory/social host and whose host or title carries the provider's name, and store it as a
// CANDIDATE (websiteCandidate) for verify_sites.mjs --kind candidate to confirm or drop. Resumable, fill-only.
//   BRAVE_SEARCH_API_KEY in server/.env (api.search.brave.com) — then: node scripts/leads/find_websites.mjs --sources haf,playwaze,pebble,eequ [--limit N] [--apply]     (from server/)
import "dotenv/config"; import admin from "firebase-admin"; import fs from "fs"; import path from "path";
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync("./serviceAccountKey.json","utf8"))) });
const db = admin.firestore();
const args = Object.fromEntries(process.argv.slice(2).map((a,i,arr)=>a.startsWith("--")?[a.slice(2),arr[i+1]&&!arr[i+1].startsWith("--")?arr[i+1]:true]:[]).filter(x=>x.length));
const LIMIT = args.limit ? +args.limit : Infinity; const SOURCES = args.sources ? String(args.sources).split(",") : null;
const OUT = path.resolve("scripts/leads/out/websearch.out.jsonl"); const CONC = process.env.BRAVE_SEARCH_API_KEY ? (args.conc ? +args.conc : 4) : 1, GAP_MS = args.gap ? +args.gap : (process.env.BRAVE_SEARCH_API_KEY ? 300 : 2500);
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const SKIP = /(maps\.apple|maps\.google|goo\.gl|waze|what3words|openstreetmap|facebook|instagram|twitter|x\.com|tiktok|youtube|linkedin|pinterest|threads\.net|gov\.uk|ofsted|nhs\.uk|yell\.com|yelp|thomsonlocal|192\.com|cylex|hotfrog|freeindex|scoot|childcare\.co\.uk|daynurseries|nurseriesuk|care\.com|careinspectorate|familysupportni|findchildcare|hoop\.co\.uk|eequ|pebble|playwaze|yellowdays|clubspark|footballfoundation|classforkids|bookwhen|kidadl|mumsnet|netmums|indeed|glassdoor|reed\.co\.uk|totaljobs|companieshouse|endole|opencorporates|checkacompany|companycheck|bizstats|find-and-update|charitycommission|register-of-charities|wikipedia|trustpilot|google\.|bing\.|amazon|ebay|etsy|nextdoor|tripadvisor|justgiving|gofundme|eventbrite|meetup|wordpress\.com|blogspot|wixsite|weebly|sites\.google|linktr\.ee|schoolsweb|primaryschool|\.sch\.uk|\.ac\.uk|schoolguide|locrating|getthedata|streetcheck|doogal|postcodearea|activityos|news|echo|gazette|times|mail|express|mirror|standard|chronicle|courier|herald|observer|telegraph|guardian|bbc\.)/i;
const STOP = new Set("the and of ltd limited cic cio uk plc llp co club clubs school nursery pre preschool childcare children kids day care centre center group holiday camp camps club activities activity community trust academy little happy days playgroup out after".split(" "));
const tokens = (s) => (s||"").toLowerCase().replace(/[’']/g,"").split(/[^a-z0-9]+/).filter(t=>t.length>=3 && !STOP.has(t));
const squash = (s) => (s||"").toLowerCase().replace(/[^a-z0-9]/g,"");
const town = (l) => { const loc = String(l.location||"").split(/[·|]/)[0].split(",")[0].replace(/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/,"").trim(); return loc && !/^\d+ sites?$/i.test(loc) ? loc : (l.county||l.region||""); };
const decode = (s) => s.replace(/&amp;/g,"&").replace(/&#(\d+);/g,(m,n)=>String.fromCharCode(+n)).replace(/&quot;/g,'"').replace(/&#x27;|&#39;/g,"'").replace(/<[^>]+>/g,"");
const API_KEY = process.env.BRAVE_SEARCH_API_KEY || "";
// Preferred: the Brave Search API (JSON, X-Subscription-Token; free tier 1 req/s, 2k/month). Falls back to the HTML page
// when no key is set — that endpoint 429s after a handful of requests, so only use it for spot checks.
async function search(q) { const ctrl = new AbortController(); const t = setTimeout(()=>ctrl.abort(), 15000);
  try {
    if (API_KEY) {
      const r = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(q)}&country=GB&search_lang=en&count=10&safesearch=moderate`, { signal: ctrl.signal, headers: { accept: "application/json", "accept-encoding": "gzip", "x-subscription-token": API_KEY } });
      if (r.status !== 200) return { status: r.status, results: [], err: (await r.text()).slice(0, 120) };
      const j = await r.json(); return { status: 200, results: (j.web?.results ?? []).map(x => ({ url: x.url, title: x.title || "", desc: x.description || "" })) };
    }
    const r = await fetch(`https://search.brave.com/search?q=${encodeURIComponent(q)}&source=web`, { signal: ctrl.signal, headers: { "user-agent": UA, accept: "text/html", "accept-language": "en-GB,en;q=0.9" } }); const html = await r.text(); if (r.status !== 200) return { status: r.status, results: [] };
    const parts = html.split(/<div class="snippet [^"]*"[^>]*data-type="web"/).slice(1); const results = [];
    for (const p of parts) { const m = p.match(/href="(https?:\/\/[^"]+)"/); const ti = p.match(/class="title[^"]*"[^>]*>([\s\S]*?)<\//); if (m) results.push({ url: decode(m[1]), title: ti ? decode(ti[1]).trim() : "" }); }
    return { status: 200, results }; } catch (e) { return { status: 0, results: [], err: String(e?.name||e).slice(0,40) }; } finally { clearTimeout(t); } }
// HAF triangulation from the search itself: a result whose title/snippet names them AND mentions HAF / free-school-meal places.
const HAF_RX = /\bHAF\b|holiday activit(y|ies) (and|&) food|free school meals?|FSM[- ]eligible|funded (holiday )?places?/i;
function hafHint(lead, results) { const nt = tokens(lead.name); if (!nt.length) return null; for (const r of results.slice(0, 6)) { const t = `${r.title} ${r.desc || ""}`; if (!HAF_RX.test(t)) continue; const tt = tokens(t); const hits = nt.filter(x => tt.includes(x)).length; if (hits / nt.length >= 0.6) { const paid = /£\s?\d|per (day|session|week)|paid places|book now/i.test(t); return { url: r.url, text: t.replace(/\s+/g, " ").slice(0, 200), paid }; } } return null; }
function pick(lead, results) { const nt = tokens(lead.name); const nsq = squash(lead.name); if (!nt.length) return null;
  for (const r of results.slice(0, 8)) { let host; try { host = new URL(r.url).hostname.replace(/^www\./,""); } catch { continue; } if (SKIP.test(host) || SKIP.test(r.url)) continue;
    const hsq = host.split(".")[0]; const hostHit = nt.some(t => t.length >= 4 && hsq.includes(t)) || (nsq.length >= 6 && hsq.includes(nsq.slice(0, Math.min(nsq.length, 12))));
    const tt = tokens(r.title); const titleHits = nt.filter(t => tt.includes(t)).length;
    const BAD_TITLE = /(job|vacanc|career|review|directory|listing|near me|what'?s on|events? in|things to do|opening times|companies house|charity|inspection report|reported|news)/i;
    const titleHit = nt.length ? titleHits / nt.length >= 0.75 && !BAD_TITLE.test(r.title) : false;
    // A title match on a deep page is usually someone ELSE's page about them (a directory, a venue list) — only take it at the site root or one level down.
    let depth = 0; try { depth = new URL(r.url).pathname.split("/").filter(Boolean).length; } catch {}
    if (hostHit || (titleHit && depth <= 1)) return { url: `https://${host}/`, why: hostHit ? `host carries the name (${host})` : `result title matched the name (${r.title.slice(0,60)})`, title: r.title }; }
  return null; }
const done = new Set(fs.existsSync(OUT) ? fs.readFileSync(OUT,"utf8").split("\n").filter(Boolean).map(l=>{try{return JSON.parse(l).id}catch{return null}}) : []);
if (args.apply) { const rows = fs.readFileSync(OUT,"utf8").split("\n").filter(Boolean).map(l=>JSON.parse(l)); let n=0, s=0; let batch=db.batch(), inB=0;
  const ids = rows.map(r=>r.id); const cur = new Map(); for (let i=0;i<ids.length;i+=300) { const snaps = await db.getAll(...ids.slice(i,i+300).map(id=>db.collection("leads").doc(id)), { fieldMask:["website","websiteCandidate","websiteSearchedAt","comingSoon","websiteDown","haf","hafPaid"] }); for (const x of snaps) if (x.exists) cur.set(x.id, x.data()); }
  let hafSet = 0;
  for (const r of rows) { const c = cur.get(r.id); if (!c || c.websiteSearchedAt) continue; const upd = { websiteSearchedAt: new Date().toISOString(), websiteSearchedBy: "brave web search (find_websites.mjs)" };
    if (r.haf && !c.haf) { upd.haf = true; upd.hafFrom = r.haf.url; upd.hafText = `web search result: ${r.haf.text}`; if (r.haf.paid && typeof c.hafPaid !== "boolean") upd.hafPaid = true; hafSet++; } const sameHost = (a,b) => { try { return new URL(a).hostname.replace(/^www\./,"") === new URL(/^https?:/.test(b)?b:"https://"+b).hostname.replace(/^www\./,""); } catch { return false; } };
    if (r.url && !c.websiteCandidate && (!c.website || ((c.comingSoon || c.websiteDown) && !sameHost(r.url, c.website)))) { upd.websiteCandidate = r.url; upd.websiteCandidateWhy = `web search: ${r.why} — unverified${c.website ? ` (their recorded site is ${c.comingSoon ? "a holding page" : "down"})` : ""}`; n++; } batch.update(db.collection("leads").doc(r.id), upd); inB++; s++; if (inB>=400) { await batch.commit(); batch=db.batch(); inB=0; } }
  if (inB) await batch.commit(); console.log(JSON.stringify({ stamped: s, candidatesSet: n, hafFromSearch: hafSet })); process.exit(0); }
const snap = await db.collection("leads").select("name","location","county","region","source","website","websiteCandidate","websiteSearchedAt","excluded","comingSoon","websiteDown","socialUrl","websiteRejected").get();
const ORDER = ["haf","playwaze","pebble","eequ","yellowdays","ciw","ofsted","cis","fsni"];
// No website at all, OR a doubtful one (holding page / dead / social page only / an earlier candidate that was rejected) — a search may find the real site.
const doubtful = (x) => !x.website || x.comingSoon || x.websiteDown;
const todo = snap.docs.filter(d => { const x=d.data(); return !x.excluded && doubtful(x) && !x.websiteCandidate && !x.websiteSearchedAt && !done.has(d.id) && (!SOURCES || SOURCES.includes(x.source)); })
  .sort((a,b)=>ORDER.indexOf(a.data().source)-ORDER.indexOf(b.data().source)).slice(0, LIMIT);
console.log("to search", todo.length, "(already done", done.size, ")");
const out = fs.createWriteStream(OUT, { flags: "a" }); let i = 0, found = 0, blocked = 0;
const sleep = (ms) => new Promise(r=>setTimeout(r,ms));
async function one(d) { const l = d.data(); const q = `"${l.name}" ${town(l)}`.trim(); const r = await search(q); if (r.status === 429 || r.status === 403 || r.status === 402) { blocked++; console.log("blocked", r.status, r.err || "", "— backing off 30s"); await sleep(30000); return; }
  const p = r.status === 200 ? pick(l, r.results) : null; const hh = r.status === 200 ? hafHint(l, r.results) : null; const row = { id: d.id, source: l.source, q, status: r.status, n: r.results.length, url: p?.url || null, why: p?.why || null, haf: hh, top: r.results.slice(0,3).map(x=>x.url.slice(0,80)) }; if (p) found++; out.write(JSON.stringify(row)+"\n"); if (++i % 100 === 0) console.log(i, "searched,", found, "candidates,", blocked, "blocked"); }
for (let k = 0; k < todo.length; k += CONC) { await Promise.all(todo.slice(k, k+CONC).map(one)); await sleep(GAP_MS); if (blocked > 8) { console.log("too many blocks — stopping"); break; } }
out.end(); console.log(JSON.stringify({ searched: i, candidates: found, blocked })); process.exit(0);
