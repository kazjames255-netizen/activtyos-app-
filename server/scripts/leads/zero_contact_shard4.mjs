// Shard-4 pass over the "zero contact channel" backlog (no website, no email, no phone, no socialUrl).
// Shard split: last hex char of the Firestore doc ID in {c,d,e} (out of 5 shards running concurrently).
// For each lead:
//   1. FREE pass (no Brave spend): re-fetch sourceUrl / hafFrom (secondary_contact.mjs logic) if no
//      secondaryContact yet — an email/phone the importer missed, or the council HAF programme page as an
//      indirect route.
//   2. BRAVE pass: one web search `"<name>" <town/postcode>`. Look for:
//        - a real website candidate (host/title carries the provider's name) -> fetch + lightweight verify;
//          confirmed (name + children's-sector wording present) -> website; else -> websiteCandidate for a
//          later verify_sites pass (same convention as find_websites.mjs).
//        - a Facebook/Instagram page whose slug carries the name -> socialUrl.
//        - an email/phone visible directly in the search snippets -> email/phone (only ever fill-only).
//   3. If truly nothing after both passes: stamp zeroContactSearchedAt/zeroContactSearchNote (honest,
//      no fabrication) so this lead isn't re-worked by a future pass without new information.
// Never overwrites an existing value — every field write here is fill-only.
// Usage: node scripts/leads/zero_contact_shard4.mjs [--limit N] [--apply]
import "dotenv/config"; import admin from "firebase-admin"; import fs from "fs"; import path from "path";
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync("./serviceAccountKey.json","utf8"))) });
const db = admin.firestore();
const args = Object.fromEntries(process.argv.slice(2).map((a,i,arr)=>a.startsWith("--")?[a.slice(2),arr[i+1]&&!arr[i+1].startsWith("--")?arr[i+1]:true]:[]).filter(x=>x.length));
const APPLY = !!args.apply;
const LIMIT = args.limit ? +args.limit : Infinity;
const LOG = path.resolve("scripts/leads/zero_contact_shard4.log");
const OUT = path.resolve("scripts/leads/out/zero_contact_shard4.out.jsonl");
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const API_KEY = process.env.BRAVE_SEARCH_API_KEY || "";
const log = (...a) => { const line = a.map(x=>typeof x==="string"?x:JSON.stringify(x)).join(" "); console.log(line); fs.appendFileSync(LOG, line+"\n"); };

// ── shared helpers (mirroring find_websites.mjs / secondary_contact.mjs / find_contacts.mjs) ──
const SKIP = /(maps\.apple|maps\.google|goo\.gl|waze|what3words|openstreetmap|facebook|instagram|twitter|x\.com|tiktok|youtube|linkedin|pinterest|threads\.net|gov\.uk|ofsted|nhs\.uk|yell\.com|yelp|thomsonlocal|192\.com|cylex|hotfrog|freeindex|scoot|childcare\.co\.uk|daynurseries|nurseriesuk|care\.com|careinspectorate|familysupportni|findchildcare|hoop\.co\.uk|eequ|pebble|playwaze|yellowdays|clubspark|footballfoundation|classforkids|bookwhen|kidadl|mumsnet|netmums|indeed|glassdoor|reed\.co\.uk|totaljobs|companieshouse|endole|opencorporates|checkacompany|companycheck|bizstats|find-and-update|charitycommission|register-of-charities|wikipedia|trustpilot|google\.|bing\.|amazon|ebay|etsy|nextdoor|tripadvisor|justgiving|gofundme|eventbrite|meetup|wordpress\.com|blogspot|wixsite|weebly|sites\.google|linktr\.ee|schoolsweb|primaryschool|\.sch\.uk|\.ac\.uk|schoolguide|locrating|getthedata|streetcheck|doogal|postcodearea|activityos|news|echo|gazette|times|mail|express|mirror|standard|chronicle|courier|herald|observer|telegraph|guardian|bbc\.)/i;
const STOP = new Set("the and of ltd limited cic cio uk plc llp co club clubs school nursery pre preschool childcare children kids day care centre center group holiday camp camps club activities activity community trust academy little happy days playgroup out after".split(" "));
const tokens = (s) => (s||"").toLowerCase().replace(/[’']/g,"").split(/[^a-z0-9]+/).filter(t=>t.length>=3 && !STOP.has(t));
const squash = (s) => (s||"").toLowerCase().replace(/[^a-z0-9]/g,"");
const town = (l) => { const loc = String(l.location||"").split(/[·|]/)[0].split(",")[0].replace(/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/,"").trim(); return loc && !/^\d+ sites?$/i.test(loc) ? loc : (l.county||l.region||l.postcode||"").trim(); };
const decode = (s) => s.replace(/&amp;/g,"&").replace(/&#(\d+);/g,(m,n)=>String.fromCharCode(+n)).replace(/&quot;/g,'"').replace(/&#x27;|&#39;/g,"'").replace(/<[^>]+>/g,"");

async function search(q) { const ctrl = new AbortController(); const t = setTimeout(()=>ctrl.abort(), 15000);
  try {
    const r = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(q)}&country=GB&search_lang=en&count=10&safesearch=moderate`, { signal: ctrl.signal, headers: { accept: "application/json", "accept-encoding": "gzip", "x-subscription-token": API_KEY } });
    if (r.status !== 200) return { status: r.status, results: [], err: (await r.text()).slice(0, 200) };
    const j = await r.json(); return { status: 200, results: (j.web?.results ?? []).map(x => ({ url: x.url, title: x.title || "", desc: x.description || "" })) };
  } catch (e) { return { status: 0, results: [], err: String(e?.name||e).slice(0,60) }; } finally { clearTimeout(t); } }

function pickWebsite(lead, results) { const nt = tokens(lead.name); const nsq = squash(lead.name); if (!nt.length) return null;
  for (const r of results.slice(0, 8)) { let host; try { host = new URL(r.url).hostname.replace(/^www\./,""); } catch { continue; } if (SKIP.test(host) || SKIP.test(r.url)) continue;
    const hsq = host.split(".")[0]; const hostHit = nt.some(t => t.length >= 4 && hsq.includes(t)) || (nsq.length >= 6 && hsq.includes(nsq.slice(0, Math.min(nsq.length, 12))));
    const tt = tokens(r.title); const titleHits = nt.filter(t => tt.includes(t)).length;
    const BAD_TITLE = /(job|vacanc|career|review|directory|listing|near me|what'?s on|events? in|things to do|opening times|companies house|charity|inspection report|reported|news)/i;
    const titleHit = nt.length ? titleHits / nt.length >= 0.75 && !BAD_TITLE.test(r.title) : false;
    let depth = 0; try { depth = new URL(r.url).pathname.split("/").filter(Boolean).length; } catch {}
    if (hostHit || (titleHit && depth <= 1)) return { url: `https://${host}/`, why: hostHit ? `host carries the name (${host})` : `result title matched the name (${r.title.slice(0,60)})`, title: r.title }; }
  return null; }
function pickSocial(lead, results) { const nt = tokens(lead.name); if (!nt.length) return null;
  for (const r of results.slice(0, 8)) { let host, p; try { const x = new URL(r.url); host = x.hostname.replace(/^www\.|^m\.|^en-gb\./,""); p = x.pathname; } catch { continue; }
    if (!/^(facebook\.com|instagram\.com)$/i.test(host)) continue;
    if (/\/(pages\/category|marketplace|groups\/discover|watch)/i.test(p)) continue;
    const slug = tokens(p.replace(/\/(pages|people|profile\.php)/,""));
    if (nt.some(t => t.length >= 4 && slug.some(s => s.includes(t) || t.includes(s)))) return { url: r.url, why: `Facebook/Instagram slug matches the name (${p.slice(0,60)})` }; }
  return null; }
// email/phone visible directly in the search result snippets themselves (directory pages that show contact info
// in the description without us needing to fetch anything) — cheap bonus extraction, still fill-only.
const BAD_MAIL = /(example\.com|sentry|wixpress|wordpress|godaddy|noreply|no-reply|donotreply|privacy@|abuse@|dmca@|schema\.org)/i;
function pickFromSnippets(results) { const text = results.slice(0,6).map(r=>`${r.title} ${r.desc}`).join(" \n ");
  const dec = decode(text);
  let email = null; const em = dec.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) || [];
  for (const e of em) { const le = e.toLowerCase(); if (!BAD_MAIL.test(le)) { email = le; break; } }
  let phone = null; const ph = dec.match(/(?:\+44[\s.-]?\(?0?\)?[\s.-]?|0)(?:\d[\s.-]?){9,10}\b/g) || [];
  for (const m of ph) { let d = m.replace(/[^\d+]/g,""); if (d.startsWith("+44")) d = "0"+d.slice(3).replace(/^0/,""); if (/^0(1|2|3|7|8)\d{8,9}$/.test(d)) { phone = d.replace(/^(0\d{2,4})(\d{3})(\d{3,4})$/,"$1 $2 $3"); break; } }
  return { email, phone }; }

async function fetchSite(url) { const ctrl = new AbortController(); const t = setTimeout(()=>ctrl.abort(), 10000);
  try { const res = await fetch(url, { redirect:"follow", signal: ctrl.signal, headers: { "user-agent": UA, accept: "text/html,*/*;q=0.8", "accept-language": "en-GB,en;q=0.9" } });
    if (res.status >= 400) return { status: res.status, html: "", final: res.url };
    const buf = await res.arrayBuffer(); return { status: res.status, html: Buffer.from(buf).toString("utf8").slice(0, 1_500_000), final: res.url || url }; }
  catch (e) { return { status: 0, html: "", final: url, err: String(e?.cause?.code||e?.name||e).slice(0,60) }; } finally { clearTimeout(t); } }
const CHILD = ["nursery","nurseries","pre-school","preschool","childcare","child care","children","kids","holiday club","holiday camp","after school","after-school","breakfast club","wraparound","ofsted","early years","eyfs","toddler","baby","babies","playgroup","childminder","forest school","summer camp","multi-sport","football coaching","gymnastics","swimming lessons","dance school","dance classes","drama","tuition","stay and play","soft play","party","parties","kids club","youth","scouts","cubs","beavers","brownies","guides","kindergarten","day care","daycare","montessori","little","junior","juniors","mini","minis","tots"];
const strip = (h) => h.replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/&nbsp;/g," ").replace(/&amp;/g,"&").replace(/\s+/g," ").toLowerCase();
function verifyWebsite(lead, html, host) { const text = strip(html); const nt = tokens(lead.name);
  const nameHit = nt.filter(t => text.includes(t) || host.includes(t)); const nameOk = nt.length ? nameHit.length >= Math.max(1, Math.ceil(nt.length*0.6)) : false;
  const childHits = CHILD.filter(c => text.includes(c)).length;
  return { nameOk, childOk: childHits >= 2, confirmed: nameOk && childHits >= 2 }; }

// ── secondary_contact.mjs logic (free, no Brave spend) ──
const EMAIL_RE = /[a-zA-Z0-9.\-_+]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
const PLATFORM_EMAIL_DOMAINS = new Set(["eequ.org","playwaze.com","bookpebble.co.uk","sentry.io","wixpress.com","schema.org","w3.org","google.com","gstatic.com","cloudflare.com","fontawesome.com","jquery.com","godaddy.com","example.com","example.org","gravatar.com","wp.com"]);
const REGISTER_AUTHORITY_HOSTS = new Set(["reports.ofsted.gov.uk","ofsted.gov.uk","familysupportni.gov.uk","www.familysupportni.gov.uk","careinspectorate.wales","careinspectorate.com","gov.wales"]);
const isUrl = (s) => { try { const u = new URL(s); return u.protocol === "http:" || u.protocol === "https:"; } catch { return false; } };
const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./,"").toLowerCase(); } catch { return ""; } };
function allEmails(text) { return [...new Set((text.match(EMAIL_RE)||[]).map(e=>e.toLowerCase()))].filter(e=>!PLATFORM_EMAIL_DOMAINS.has(e.split("@")[1]||"")).filter(e=>!/^(noreply|no-reply|donotreply|webmaster|postmaster)@/.test(e)).filter(e=>!/\.(png|jpg|jpeg|gif|svg|webp)$/i.test(e)).filter(e=>e.length<=60); }
const PHONE_RE = /\b(?:\+44[\s.-]?\(?0?\)?[\s.-]?|0)(?:\d[\s.-]?){9,10}\b/g;
function allPhones(text) { const out = new Set(); for (const m of text.match(PHONE_RE)||[]) { let d = m.replace(/[^\d+]/g,""); if (d.startsWith("+44")) d = "0"+d.slice(3); if (/^0\d{9,10}$/.test(d) && d.length>=10 && d.length<=11) out.add(d); } return [...out]; }
const isGovEmail = (e) => /\.gov\.uk$/i.test(e.split("@")[1]||"");
async function secondaryPass(l) {
  if (l.secondaryContact) return null;
  const urls = []; if (isUrl(l.sourceUrl)) urls.push(l.sourceUrl); if (isUrl(l.hafFrom) && l.hafFrom !== l.sourceUrl) urls.push(l.hafFrom);
  for (const u of urls) { const host = hostOf(u); if (REGISTER_AUTHORITY_HOSTS.has(host)) continue;
    try { const r = await fetch(u, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(9000) }); const text = await r.text();
      const em = allEmails(text), ph = allPhones(text); const val = em[0] || ph[0]; if (!val) continue;
      const type = isGovEmail(val) ? "council-haf-programme" : "sourceUrl-refetch";
      const note = type === "council-haf-programme" ? `Shared council contact (${host}) — not this provider's own line, enquire via the council.` : `Found by re-fetching the original listing page (${host}).`;
      return { secondaryContact: val, secondaryContactType: type, secondaryContactNote: note }; } catch {} }
  if (l.hafLocalAuthority) { const url = isUrl(l.hafFrom) ? l.hafFrom : (isUrl(l.sourceUrl) ? l.sourceUrl : null); if (url) { const la = String(l.hafLocalAuthority).split("; ")[0];
    return { secondaryContact: url, secondaryContactType: "council-haf-programme", secondaryContactNote: `No direct contact found — this is the ${la} Council${l.hafProgramme ? ` "${l.hafProgramme}"` : " HAF"} programme page that lists them.` }; } }
  return null;
}

// ── load shard ──
const snap = await db.collection("leads").select("name","location","county","region","postcode","source","website","email","phone","socialUrl","excluded","secondaryContact","sourceUrl","hafFrom","hafLocalAuthority","hafProgramme","zeroContactSearchedAt").get();
const zero = [];
for (const d of snap.docs) { const x = d.data(); if (x.excluded) continue; if (x.website||x.email||x.phone||x.socialUrl) continue;
  if (!(x.id||d.id)) continue; const id = d.id; const lastChar = id[id.length-1];
  if (!"cde".includes(lastChar)) continue;
  zero.push({ id, ...x }); }
console.log("shard4 zero-contact total:", zero.length);
const todo = zero.filter(l => !l.zeroContactSearchedAt).slice(0, LIMIT);
log(`=== run start ${new Date().toISOString()} shard4 total=${zero.length} todo=${todo.length} apply=${APPLY} ===`);

let processed = 0, resolvedDirect = 0, resolvedSecondary = 0, deadEnds = 0, braveCalls = 0, blocked = 0;
const out = fs.createWriteStream(OUT, { flags: "a" });
let batch = db.batch(), inB = 0;
const flush = async () => { if (inB && APPLY) { await batch.commit(); } batch = db.batch(); inB = 0; };
const sleep = (ms) => new Promise(r=>setTimeout(r,ms));

for (const l of todo) {
  processed++;
  const upd = {};
  let resultNote = "";

  // 1. free secondary pass
  const sec = await secondaryPass(l);
  if (sec) { Object.assign(upd, sec); upd.secondaryContactAt = new Date().toISOString(); resolvedSecondary++; resultNote += "secondary:" + sec.secondaryContactType + " "; }

  // 2. Brave search pass
  if (API_KEY) {
    const q = `"${l.name}" ${town(l)}`.trim();
    const r = await search(q); braveCalls++;
    if (r.status === 429 || r.status === 402 || r.status === 403) {
      blocked++; log("BLOCKED", r.status, r.err||"", "— backing off 20s");
      await sleep(20000);
    } else if (r.status === 200) {
      const web = pickWebsite(l, r.results);
      const soc = pickSocial(l, r.results);
      const sn = pickFromSnippets(r.results);
      if (web) {
        let host; try { host = new URL(web.url).hostname.replace(/^www\./,""); } catch { host = ""; }
        const page = await fetchSite(web.url);
        if (page.status === 200 && page.html) {
          const v = verifyWebsite(l, page.html, host);
          if (v.confirmed) { upd.website = web.url; upd.websiteFoundBy = "brave search + fetch verify (zero_contact_shard4.mjs)"; upd.websiteVerifiedAt = new Date().toISOString(); resolvedDirect++; resultNote += "website:confirmed "; }
          else if (v.nameOk || v.childOk) { upd.websiteCandidate = web.url; upd.websiteCandidateWhy = `web search: ${web.why} — unverified (zero-contact shard4 pass)`; resultNote += "website:candidate "; }
          else resultNote += "website:rejected ";
        } else { upd.websiteCandidate = web.url; upd.websiteCandidateWhy = `web search: ${web.why} — unverified, page unreachable at check time (zero-contact shard4 pass)`; resultNote += "website:candidate-unreached "; }
      }
      if (!upd.website && soc && !upd.socialUrl) { upd.socialUrl = soc.url; upd.socialFrom = `web search (zero-contact shard4 pass): ${soc.why}`; if (!resolvedDirect && !upd.website) resolvedDirect++; resultNote += "social:found "; }
      if (!upd.email && sn.email) { upd.email = sn.email; upd.contactFoundBy = "brave search snippet (zero_contact_shard4.mjs)"; upd.contactFoundAt = new Date().toISOString(); resultNote += "email:snippet "; }
      if (!upd.phone && sn.phone) { upd.phone = sn.phone; upd.contactFoundBy = upd.contactFoundBy || "brave search snippet (zero_contact_shard4.mjs)"; upd.contactFoundAt = upd.contactFoundAt || new Date().toISOString(); resultNote += "phone:snippet "; }
    } else {
      resultNote += `search-error:${r.status} `;
    }
  } else {
    resultNote += "no-brave-key ";
  }

  const gotDirect = !!(upd.website || upd.socialUrl || upd.email || upd.phone);
  if (!gotDirect) {
    upd.zeroContactSearchedAt = new Date().toISOString();
    upd.zeroContactSearchNote = sec
      ? `Brave search + site fetch found no direct channel (website/email/phone/social); indirect route recorded via secondaryContact. (${resultNote.trim()})`
      : `Brave search + site fetch + sourceUrl/HAF re-fetch found nothing at all — genuine dead end as of this pass. (${resultNote.trim()})`;
    if (!sec) deadEnds++;
  }

  out.write(JSON.stringify({ id: l.id, name: l.name, note: resultNote.trim(), upd: { ...upd } }) + "\n");
  if (processed % 10 === 0 || processed === todo.length) log(processed, "/", todo.length, `resolvedDirect=${resolvedDirect} resolvedSecondary=${resolvedSecondary} deadEnds=${deadEnds} braveCalls=${braveCalls} blocked=${blocked}`);

  if (APPLY && Object.keys(upd).length) { batch.update(db.collection("leads").doc(l.id), upd); inB++; if (inB >= 300) await flush(); }
  await sleep(350);
  if (blocked > 6) { log("too many blocks — stopping early"); break; }
}
await flush();
out.end();
log(JSON.stringify({ processed, resolvedDirect, resolvedSecondary, deadEnds, braveCalls, blocked, applied: APPLY }));
process.exit(0);
