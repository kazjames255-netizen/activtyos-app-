// One-off cleanup: verifyPending is a fill-only flag set by residue.mjs when a search was skipped (no Brave
// credit) — but no script ever CLEARS it once the lead resolves another way (gets a website, gets marked
// websiteDead, etc). This left it stuck at a constant count even as the underlying leads got resolved.
//   Step 1 (--clear-stale): clear verifyPending/Why/At on any lead that already has website or websiteDead set.
//   Step 2 (--search): for leads still genuinely pending (no website, no websiteDead), do ONE Brave search each
//     ("<name>" <town>, same host-carries-name rule as find_websites.mjs/residue.mjs) — a real hit becomes a
//     websiteCandidate (for verify_sites.mjs to confirm), nothing found becomes websiteDead (fill-only), and
//     either way verifyPending is cleared since the pending state is now resolved.
// Usage (from server/): node scripts/leads/clear_verifypending.mjs --clear-stale
//                        node scripts/leads/clear_verifypending.mjs --search [--fresh-budget N]
import "dotenv/config"; import admin from "firebase-admin"; import fs from "fs";
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync("./serviceAccountKey.json","utf8"))) });
const db = admin.firestore();
const args = Object.fromEntries(process.argv.slice(2).map((a,i,arr)=>a.startsWith("--")?[a.slice(2),arr[i+1]&&!arr[i+1].startsWith("--")?arr[i+1]:true]:[]).filter(x=>x.length));
const D = admin.firestore.FieldValue.delete;

const snap = await db.collection("leads").select("name","location","county","region","verifyPending","excluded","website","websiteDead","websiteCandidate","source").get();
const pending = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(x => !x.excluded && x.verifyPending === true);
console.log("verifyPending total", pending.length);

if (args["clear-stale"]) {
  const stale = pending.filter(x => x.website || x.websiteDead);
  console.log("clearing stale flag on", stale.length, "leads (already resolved: website or websiteDead set)");
  let batch = db.batch(), inB = 0;
  for (const l of stale) { batch.update(db.collection("leads").doc(l.id), { verifyPending: D(), verifyPendingWhy: D(), verifyPendingAt: D() }); inB++; if (inB >= 400) { await batch.commit(); batch = db.batch(); inB = 0; } }
  if (inB) await batch.commit();
  console.log("cleared", stale.length);
  process.exit(0);
}

if (args.search) {
  const API_KEY = process.env.BRAVE_SEARCH_API_KEY || "";
  const BUDGET = args["fresh-budget"] ? +args["fresh-budget"] : 300;
  const todo = pending.filter(x => !x.website && !x.websiteDead);
  console.log("genuinely still pending (no website, not dead):", todo.length, "— budget", BUDGET);
  const SKIP = /(maps\.apple|maps\.google|goo\.gl|waze|what3words|openstreetmap|facebook|instagram|twitter|x\.com|tiktok|youtube|linkedin|pinterest|threads\.net|gov\.uk|ofsted|nhs\.uk|yell\.com|yelp|thomsonlocal|192\.com|cylex|hotfrog|freeindex|scoot|childcare\.co\.uk|daynurseries|nurseriesuk|care\.com|careinspectorate|familysupportni|findchildcare|hoop\.co\.uk|eequ|pebble|playwaze|yellowdays|clubspark|footballfoundation|classforkids|bookwhen|kidadl|mumsnet|netmums|indeed|glassdoor|reed\.co\.uk|totaljobs|companieshouse|endole|opencorporates|checkacompany|companycheck|bizstats|find-and-update|charitycommission|register-of-charities|wikipedia|trustpilot|google\.|bing\.|amazon|ebay|etsy|nextdoor|tripadvisor|justgiving|gofundme|eventbrite|meetup|wordpress\.com|blogspot|wixsite|weebly|sites\.google|linktr\.ee|schoolsweb|primaryschool|\.sch\.uk|\.ac\.uk|schoolguide|locrating|getthedata|streetcheck|doogal|postcodearea|activityos|news|echo|gazette|times|mail|express|mirror|standard|chronicle|courier|herald|observer|telegraph|guardian|bbc\.)/i;
  const STOP = new Set("the and of ltd limited cic cio uk plc llp co club clubs school nursery pre preschool childcare children kids day care centre center group holiday camp camps club activities activity community trust academy little happy days playgroup out after".split(" "));
  const tokens = (s) => (s||"").toLowerCase().replace(/[’']/g,"").split(/[^a-z0-9]+/).filter(t=>t.length>=3 && !STOP.has(t));
  const squash = (s) => (s||"").toLowerCase().replace(/[^a-z0-9]/g,"");
  const town = (l) => { const loc = String(l.location||"").split(/[·|]/)[0].split(",")[0].replace(/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/,"").trim(); return loc && !/^\d+ sites?$/i.test(loc) ? loc : (l.county||l.region||""); };
  function pick(lead, results) { const nt = tokens(lead.name); const nsq = squash(lead.name); if (!nt.length) return null;
    for (const r of results.slice(0, 8)) { let host; try { host = new URL(r.url).hostname.replace(/^www\./,""); } catch { continue; } if (SKIP.test(host) || SKIP.test(r.url)) continue;
      const hsq = host.split(".")[0]; const hostHit = nt.some(t => t.length >= 4 && hsq.includes(t)) || (nsq.length >= 6 && hsq.includes(nsq.slice(0, Math.min(nsq.length, 12))));
      if (hostHit) return { url: `https://${host}/`, why: `host carries the name (${host})` }; }
    return null; }
  async function search(q) { const ctrl = new AbortController(); const t = setTimeout(()=>ctrl.abort(), 15000);
    try { const r = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(q)}&country=GB&search_lang=en&count=10&safesearch=moderate`, { signal: ctrl.signal, headers: { accept: "application/json", "accept-encoding": "gzip", "x-subscription-token": API_KEY } });
      if (r.status !== 200) return { status: r.status, results: [], err: (await r.text()).slice(0,150) };
      const j = await r.json(); return { status: 200, results: (j.web?.results ?? []).map(x => ({ url: x.url, title: x.title || "" })) }; }
    catch (e) { return { status: 0, results: [], err: String(e?.name||e).slice(0,40) }; } finally { clearTimeout(t); } }
  let used = 0, dead = null; const stamp = new Date().toISOString(); let batch = db.batch(), inB = 0; const c = {}; const bump=(k)=>c[k]=(c[k]||0)+1;
  for (const l of todo.slice(0, BUDGET)) {
    if (dead) { bump("skipped: " + dead); continue; }
    const q = `"${l.name}" ${town(l)}`.trim(); used++;
    const s = await search(q); await new Promise(r=>setTimeout(r, 300));
    if (s.status === 402) { dead = "credit exhausted (402)"; bump("stopped: " + dead); continue; }
    if (s.status !== 200) { bump(`search failed (${s.status})`); continue; }
    const p = pick(l, s.results);
    const upd = { verifyPending: D(), verifyPendingWhy: D(), verifyPendingAt: D() };
    if (p) { upd.websiteCandidate = p.url; upd.websiteCandidateWhy = `residue verifyPending search 15 Sept 2026: ${p.why} — unverified`; bump("candidate found"); }
    else { upd.websiteDead = true; upd.websiteDeadAt = stamp; upd.websiteDeadWhy = "no alternates tried previously; web search (verifyPending clearing pass) found nothing"; upd.websiteDeadCategory = "unreachable"; bump("marked dead (nothing found)"); }
    batch.update(db.collection("leads").doc(l.id), upd); inB++;
    if (inB >= 300) { await batch.commit(); batch = db.batch(); inB = 0; }
  }
  if (inB) await batch.commit();
  console.log(JSON.stringify({ searched: used, ...c }));
  process.exit(0);
}
console.log("pass --clear-stale or --search");
process.exit(0);
