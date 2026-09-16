// Shard 2 of 5 — "zero contact channel" backlog: leads with NO website, email, phone, or socialUrl.
// Shard split: last char of Firestore doc ID in {4,5,6,7} (shard1=0-3, shard2=4-7, shard3=8,9,a,b, shard4=c,d,e, shard5=f).
// Docs whose last char isn't one of the 16 hex chars are outside every shard's claim — left alone here.
//
// Two-phase, mirrors secondary_contact.mjs's template-artifact defence:
//   Phase A (free, no Brave): fetch each lead's sourceUrl / hafFrom once, extract candidate emails/phones.
//     - Register-authority hosts (Ofsted, Family Support NI, Care Inspectorate Wales…) are excluded outright —
//       any contact there is the regulator's, never the provider's.
//     - A value seen on 3+ DIFFERENT source URLs across this shard's batch is a template artifact (booking
//       platforms like Bookpebble/eequ/Playwaze render the same phone/email on every listing) and is dropped,
//       UNLESS it's a .gov.uk address (a legitimate shared council mailbox).
//     - A genuine, non-template value found this way is written as `secondaryContact` (not `email`/`phone` —
///      it's an indirect route via the listing page, not confirmed as the provider's own line), labelled
//       "sourceUrl-refetch" or "council-haf-programme" as appropriate.
//   Phase B (one Brave search per lead still unresolved after A): "<name>" <town>.
//     - A result whose HOST carries the lead's name -> fetch it; if it passes a light name/child-sector check,
//       record websiteCandidate (unverified, consistent with find_websites.mjs) and scrape ITS OWN pages for an
//       email/phone — written directly to `email`/`phone` since it's off a site that matches by name, not a
//       shared listing page.
//     - Else a Facebook/Instagram result matching the name -> socialUrl.
//     - Else, if the lead has a HAF council page, fall back to that as `secondaryContact` (council-haf-programme).
//     - Else: honest dead end -> contactDeadEnd=true + reason. Never fabricated.
//     - If Brave has no credit (402) -> verifyPending=true (matches residue.mjs's "unresolved-needs-search").
//
// Usage (from server/):
//   node scripts/leads/zero_contact_shard2.mjs --run [--limit N] [--apply]
//   Log (resumable, jsonl): scripts/leads/out/zero_contact_shard2.log
import "dotenv/config"; import admin from "firebase-admin"; import fs from "fs"; import path from "path";
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync("./serviceAccountKey.json","utf8"))) });
const db = admin.firestore();
const args = Object.fromEntries(process.argv.slice(2).map((a,i,arr)=>a.startsWith("--")?[a.slice(2),arr[i+1]&&!arr[i+1].startsWith("--")?arr[i+1]:true]:[]).filter(x=>x.length));
const LIMIT = args.limit ? +args.limit : Infinity;
const OUT = path.resolve("scripts/leads/out/zero_contact_shard2.log");
const CONC = 6, TIMEOUT = 10000, MAXBYTES = 1_000_000, GAP_MS = 300;
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const API_KEY = process.env.BRAVE_SEARCH_API_KEY || "";
const SHARD_CHARS = new Set(["4","5","6","7"]);

const sleep = (ms) => new Promise(r=>setTimeout(r,ms));
const isUrl = (s) => { try { const u = new URL(s); return u.protocol === "http:" || u.protocol === "https:"; } catch { return false; } };
// sourceUrl/hafFrom sometimes carry "<url> (explanatory prose...)" — pull out just the leading URL token.
const extractUrl = (s) => { const m = String(s||"").match(/^https?:\/\/\S+/); if (!m) return null; return m[0].replace(/[),.;]+$/,""); };
const squash = (s) => (s||"").toLowerCase().replace(/[^a-z0-9]/g,"");
const STOP = new Set("the and of ltd limited cic cio uk plc llp co club clubs school nursery pre preschool childcare children kids day care centre center group holiday camp camps club activities activity community trust academy little happy days playgroup out after".split(" "));
const tokens = (s) => (s||"").toLowerCase().replace(/[’']/g,"").split(/[^a-z0-9]+/).filter(t=>t.length>=3 && !STOP.has(t));
const town = (l) => { const loc = String(l.location||"").split(/[·|]/)[0].split(",")[0].replace(/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/,"").trim(); return loc && !/^\d+ sites?$/i.test(loc) ? loc : (l.county||l.region||l.postcode||"").trim(); };
const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, "").toLowerCase(); } catch { return ""; } };

async function fetchUrl(url) {
  const ctrl = new AbortController(); const t = setTimeout(()=>ctrl.abort(), TIMEOUT);
  try {
    const res = await fetch(url, { redirect: "follow", signal: ctrl.signal, headers: { "user-agent": UA, accept: "text/html,*/*;q=0.8", "accept-language": "en-GB,en;q=0.9" } });
    const final = res.url || url; if (res.status >= 400) return { status: res.status, final, html: "" };
    const reader = res.body?.getReader(); let got = 0, chunks = [];
    if (reader) { while (got < MAXBYTES) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); got += value.length; } try { reader.cancel(); } catch {} }
    return { status: res.status, final, html: Buffer.concat(chunks).toString("utf8") };
  } catch (e) { return { status: 0, final: url, html: "", err: String(e?.cause?.code || e?.name || e).slice(0,60) }; }
  finally { clearTimeout(t); }
}

// ── email/phone extraction (same rules as secondary_contact.mjs / find_contacts.mjs) ──
const EMAIL_RE = /[a-zA-Z0-9.\-_+]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
const PLATFORM_EMAIL_DOMAINS = new Set(["eequ.org","playwaze.com","bookpebble.co.uk","sentry.io","wixpress.com","schema.org","w3.org","google.com","gstatic.com","cloudflare.com","fontawesome.com","jquery.com","godaddy.com","example.com","example.org","gravatar.com","wp.com","sentry-next.io"]);
const REGISTER_AUTHORITY_HOSTS = new Set(["reports.ofsted.gov.uk","ofsted.gov.uk","familysupportni.gov.uk","www.familysupportni.gov.uk","careinspectorate.wales","careinspectorate.com","gov.wales"]);
const BOOKING_PLATFORM_HOSTS = new Set(["eequ.org","playwaze.com","bookpebble.co.uk","activities.bookpebble.co.uk"]);
function allEmails(text) {
  return [...new Set((text.match(EMAIL_RE) || []).map((e) => e.toLowerCase()))]
    .filter((e) => !PLATFORM_EMAIL_DOMAINS.has(e.split("@")[1] || ""))
    .filter((e) => !/^(noreply|no-reply|donotreply|webmaster|postmaster)@/.test(e))
    .filter((e) => !/\.(png|jpg|jpeg|gif|svg|webp|js|css|html|php|json)$/i.test(e))
    .filter((e) => !/@\d+\.(js|css)/i.test(e)) // JS/CSS library version artifacts, e.g. "sweetalert2@11.js"
    .filter((e) => e.length <= 60);
}
const PHONE_RE = /\b(?:\+44[\s.-]?\(?0?\)?[\s.-]?|0)(?:\d[\s.-]?){9,10}\b/g;
function allPhones(text) {
  const out = new Set();
  for (const m of text.match(PHONE_RE) || []) {
    let digits = m.replace(/[^\d+]/g, "");
    if (digits.startsWith("+44")) digits = "0" + digits.slice(3);
    if (/^0\d{9,10}$/.test(digits) && digits.length >= 10 && digits.length <= 11) out.add(digits);
  }
  return [...out];
}
const isGovEmail = (e) => /\.gov\.uk$/i.test(e.split("@")[1] || "");

// ── Brave search ──
let braveUsed = 0, braveDead = null;
async function search(q, _retry = false) {
  if (!API_KEY) return { status: 0, results: [], err: "no BRAVE_SEARCH_API_KEY" };
  if (braveDead) return { status: 402, results: [], err: braveDead, skipped: true };
  const ctrl = new AbortController(); const t = setTimeout(()=>ctrl.abort(), 15000);
  try {
    braveUsed++;
    const r = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(q)}&country=GB&search_lang=en&count=10&safesearch=moderate`, { signal: ctrl.signal, headers: { accept: "application/json", "accept-encoding": "gzip", "x-subscription-token": API_KEY } });
    if (r.status === 429 && !_retry) { clearTimeout(t); await sleep(20000); return search(q, true); }
    if (r.status !== 200) { const body = (await r.text()).slice(0,160); if (r.status === 402) braveDead = "Brave credit exhausted (402): " + (body.match(/"detail":"([^"]+)"/)?.[1] || body); return { status: r.status, results: [], err: body }; }
    const j = await r.json(); return { status: 200, results: (j.web?.results ?? []).map(x => ({ url: x.url, title: x.title || "", desc: x.description || "" })) };
  } catch (e) { return { status: 0, results: [], err: String(e?.name||e).slice(0,40) }; } finally { clearTimeout(t); }
}
const SKIP = /(maps\.apple|maps\.google|goo\.gl|waze|what3words|openstreetmap|facebook|instagram|twitter|x\.com|tiktok|youtube|linkedin|pinterest|threads\.net|gov\.uk|ofsted|nhs\.uk|yell\.com|yelp|thomsonlocal|192\.com|cylex|hotfrog|freeindex|scoot|childcare\.co\.uk|daynurseries|nurseriesuk|care\.com|careinspectorate|familysupportni|findchildcare|hoop\.co\.uk|eequ|pebble|playwaze|yellowdays|clubspark|footballfoundation|classforkids|bookwhen|kidadl|mumsnet|netmums|indeed|glassdoor|reed\.co\.uk|totaljobs|companieshouse|endole|opencorporates|checkacompany|companycheck|bizstats|find-and-update|charitycommission|register-of-charities|wikipedia|trustpilot|google\.|bing\.|amazon|ebay|etsy|nextdoor|tripadvisor|justgiving|gofundme|eventbrite|meetup|wordpress\.com|blogspot|wixsite|weebly|sites\.google|linktr\.ee|schoolsweb|primaryschool|\.sch\.uk|\.ac\.uk|schoolguide|locrating|getthedata|streetcheck|doogal|postcodearea|activityos|news|echo|gazette|times|mail|express|mirror|standard|chronicle|courier|herald|observer|telegraph|guardian|bbc\.)/i;
const SOCIAL = /^(www\.|m\.|en-gb\.)?(facebook\.com|instagram\.com)\//i;
function pick(lead, results) {
  const nt = tokens(lead.name); const nsq = squash(lead.name); if (!nt.length) return null;
  for (const r of results.slice(0, 8)) {
    let host; try { host = new URL(r.url).hostname.replace(/^www\./,""); } catch { continue; }
    if (SKIP.test(host) || SKIP.test(r.url)) continue;
    const hsq = host.split(".")[0];
    const hostHit = nt.some(t => t.length >= 4 && hsq.includes(t)) || (nsq.length >= 6 && hsq.includes(nsq.slice(0, Math.min(nsq.length, 12))));
    if (hostHit) return { url: `https://${host}/`, why: `host carries the name (${host})`, title: r.title };
  }
  return null;
}
function pickSocial(lead, results) {
  const nt = tokens(lead.name);
  for (const r of results.slice(0, 8)) {
    let h, p; try { const x = new URL(r.url); h = x.hostname.replace(/^www\./,""); p = x.pathname; } catch { continue; }
    if (!SOCIAL.test(h + p)) continue;
    const slug = tokens(p.replace(/\/(pages|people|groups|profile\.php)/,""));
    if (nt.some(t => t.length >= 4 && slug.some(s => s.includes(t) || t.includes(s)))) return r.url;
  }
  return null;
}
const CHILD = ["nursery","nurseries","pre-school","preschool","childcare","child care","children","kids","holiday club","holiday camp","after school","after-school","breakfast club","wraparound","ofsted","early years","toddler","baby","babies","playgroup","childminder","forest school","summer camp","multi-sport","football coaching","gymnastics","swimming lessons","dance school","dance classes","drama","tuition","tutoring","kindergarten","day care","daycare","montessori","school holidays","term time","half term","kids club","youth","scouts","cubs","beavers","brownies","guides","junior","juniors","mini","minis","tots"];
const strip = (h) => h.replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/&nbsp;|&#160;/g," ").replace(/&amp;/g,"&").replace(/\s+/g," ").toLowerCase();
const RX = new Map(); const rx = (t) => { if(!RX.has(t)) RX.set(t, new RegExp("(^|[^a-z])"+t.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+"(s|es)?([^a-z]|$)","i")); return RX.get(t); };
const count = (text, list) => list.filter(t => rx(t).test(text));
function contactLinks(html, base) { const hrefs = [...html.matchAll(/href=["']([^"'#]*(contact|about|find-us|findus|get-in-touch|enquir)[^"'#]*)["']/gi)].map(x=>x[1]).filter(h=>!/^(mailto|tel|javascript)/i.test(h)); const out=[]; for (const h of hrefs) { try { const u = new URL(h, base); if (u.hostname === new URL(base).hostname && !out.includes(u.href)) out.push(u.href); } catch {} } return out.slice(0,2); }

// ── leads: zero-contact + shard filter ──
const FIELDS = ["name","location","county","region","postcode","excluded","website","email","phone","socialUrl","websiteCandidate","sourceUrl","hafFrom","hafLocalAuthority","hafProgramme","source"];
const snap = await db.collection("leads").select(...FIELDS).get();
const zero = [];
for (const d of snap.docs) { const x = d.data(); if (x.excluded) continue; if (x.email || x.phone || x.website || x.socialUrl) continue; zero.push({ id: d.id, ...x }); }
const JUNK_NAMES = new Set(["demo","test","sample","placeholder","tbd","unknown","n/a","na","example","testing","testtest"]);
const isJunkName = (name) => { const nt = tokens(name); return nt.length === 0 || (nt.length === 1 && JUNK_NAMES.has(nt[0])); };
const shard = zero.filter(l => SHARD_CHARS.has(l.id.slice(-1)) && !isJunkName(l.name)).sort((a,b)=>a.id<b.id?-1:1);
console.log(`zero-contact total: ${zero.length}; shard2 (last char in 4/5/6/7): ${shard.length}`);

const doneRows = fs.existsSync(OUT) ? fs.readFileSync(OUT,"utf8").split("\n").filter(Boolean).map(l=>{try{return JSON.parse(l)}catch{return null}}).filter(Boolean) : [];
const done = new Set(doneRows.map(r=>r.id));
const todo = shard.filter(l => !done.has(l.id)).slice(0, LIMIT);
console.log(`to process: ${todo.length} (already logged ${done.size})`);
if (!args.run) process.exit(0);

// ── Phase A: batch-fetch sourceUrl/hafFrom pages, build template-artifact frequency map ──
const urlToLeads = new Map(); // url -> [leadIds] (to know if a page is shared by 2+ different providers)
const freeUrls = new Set();
for (const l of todo) {
  const su = extractUrl(l.sourceUrl), hf = extractUrl(l.hafFrom);
  for (const u of [su, hf]) { if (!u || !isUrl(u)) continue; if (REGISTER_AUTHORITY_HOSTS.has(hostOf(u))) continue; freeUrls.add(u); if (!urlToLeads.has(u)) urlToLeads.set(u, []); urlToLeads.get(u).push(l.id); }
}
console.log(`Phase A: ${freeUrls.size} unique sourceUrl/hafFrom pages to fetch (free, no Brave)`);
const pageText = new Map();
{
  const list = [...freeUrls]; const FCONC = 12;
  for (let k = 0; k < list.length; k += FCONC) { await Promise.all(list.slice(k, k+FCONC).map(async (u) => { const r = await fetchUrl(u); pageText.set(u, r.status === 200 ? r.html : ""); })); }
}
const candidatesByUrl = new Map();
for (const [u, text] of pageText.entries()) { candidatesByUrl.set(u, text ? { emails: allEmails(text), phones: allPhones(text) } : { emails: [], phones: [] }); }
const urlsForValue = new Map();
for (const [u, c] of candidatesByUrl.entries()) for (const v of [...c.emails, ...c.phones]) { if (!urlsForValue.has(v)) urlsForValue.set(v, new Set()); urlsForValue.get(v).add(u); }
const DUP_THRESHOLD = 3;
const isTemplateArtifact = (v) => !isGovEmail(v) && (urlsForValue.get(v)?.size ?? 0) >= DUP_THRESHOLD;
function bestFor(u) {
  const c = candidatesByUrl.get(u); if (!c) return null;
  for (const e of c.emails) if (!isTemplateArtifact(e)) return { value: e, type: "email", shared: urlsForValue.get(e).size >= DUP_THRESHOLD };
  for (const p of c.phones) if (!isTemplateArtifact(p)) return { value: p, type: "phone", shared: urlsForValue.get(p).size >= DUP_THRESHOLD };
  return null;
}
console.log(`Phase A fetched. Building per-lead results, then Phase B (Brave) for the rest...`);

const outStream = fs.createWriteStream(OUT, { flags: "a" });
const tally = {}; const bump = (k) => tally[k] = (tally[k]||0)+1;
let i = 0, n = 0; const t0 = Date.now();

async function processOne(l) {
  const stamp = new Date().toISOString();
  const row = { id: l.id, name: l.name };
  const upd = {};

  // Phase A result for this lead
  const su = extractUrl(l.sourceUrl), hf = extractUrl(l.hafFrom);
  let aResult = null;
  for (const u of [su, hf]) {
    if (!u || !isUrl(u) || REGISTER_AUTHORITY_HOSTS.has(hostOf(u))) continue;
    const found = bestFor(u); if (!found) continue;
    const host = hostOf(u);
    const shared = found.shared || isGovEmail(found.value) || BOOKING_PLATFORM_HOSTS.has(host) || (urlToLeads.get(u)?.length || 0) >= 2;
    aResult = { url: u, host, value: found.value, valueType: found.type, shared };
    break;
  }
  if (aResult) {
    if (aResult.shared) {
      upd.secondaryContact = aResult.value; upd.secondaryContactType = "council-haf-programme";
      upd.secondaryContactNote = `No confirmed direct contact for this provider — ${aResult.value} appears on the shared listing page (${aResult.host}) that lists them and other providers, not their own line. Enquire via that page/council to reach them.`;
      upd.secondaryContactAt = stamp;
      row.result = "found-secondary-shared"; row.via = aResult.url; row.value = aResult.value;
    } else {
      upd.secondaryContact = aResult.value; upd.secondaryContactType = "sourceUrl-refetch";
      upd.secondaryContactNote = `Found by re-fetching the original listing page (${aResult.host}) — a ${aResult.valueType} that wasn't captured when this lead was first imported; unique to this listing (not seen on other providers' pages), but unverified as their OWN direct line.`;
      upd.secondaryContactAt = stamp;
      row.result = "found-secondary-unique"; row.via = aResult.url; row.value = aResult.value;
    }
  }

  if (!row.result) {
    if (braveDead) {
      row.result = "unresolved-needs-search";
      row.pendingWhy = `no usable sourceUrl/hafFrom contact; Brave search skipped (${braveDead})`;
      upd.verifyPending = true; upd.verifyPendingWhy = row.pendingWhy; upd.verifyPendingAt = stamp;
    } else {
      const q = `"${l.name}" ${town(l)}`.trim();
      const s = await search(q); row.searched = true; row.q = q; row.searchStatus = s.status;
      await sleep(GAP_MS);
      if (s.status !== 200) {
        row.result = "unresolved-needs-search";
        row.pendingWhy = `search failed: ${s.status} ${(s.err||"").slice(0,100)}`;
        upd.verifyPending = true; upd.verifyPendingWhy = row.pendingWhy; upd.verifyPendingAt = stamp;
      } else {
        row.top = s.results.slice(0,3).map(x=>x.url.slice(0,90));
        const p = pick(l, s.results);
        let websiteHit = null;
        if (p) {
          const r = await fetchUrl(p.url);
          if (r.status === 200 && r.html && r.html.length > 300) {
            const text = strip(r.html);
            const nameToks = tokens(l.name); const nameHit = nameToks.filter(t => text.includes(t));
            const nameOk = nameToks.length ? nameHit.length >= Math.max(1, Math.ceil(nameToks.length*0.5)) : false;
            const childHits = count(text, CHILD);
            if (nameOk || childHits.length >= 2) websiteHit = { url: p.url, html: r.html, final: r.final || p.url };
          }
        }
        if (websiteHit) {
          upd.websiteCandidate = websiteHit.url;
          upd.websiteCandidateWhy = `zero-contact-backlog web search ${stamp.slice(0,10)}: ${p.why} — unverified, needs verify_sites.mjs confirm`;
          upd.websiteSearchedAt = stamp; upd.websiteSearchedBy = "brave web search (zero_contact_shard2.mjs)";
          row.result = "found-website-candidate"; row.url = websiteHit.url;
          let html = websiteHit.html;
          for (const c of contactLinks(websiteHit.html, websiteHit.final)) { const rc = await fetchUrl(c); if (rc.status === 200) html += "\n" + rc.html; }
          const host = hostOf(websiteHit.final);
          const em = allEmails(html).filter(e => (e.split("@")[1]||"").endsWith(host) || host.endsWith(e.split("@")[1]||" "));
          const emAny = em.length ? em : allEmails(html);
          const ph = allPhones(html);
          if (emAny[0]) { upd.email = emAny[0]; row.email = emAny[0]; }
          if (ph[0]) { upd.phone = ph[0]; row.phone = ph[0]; }
        } else {
          const soc = pickSocial(l, s.results);
          if (soc) {
            upd.socialUrl = soc; upd.socialFrom = "web search result (zero_contact_shard2.mjs)";
            row.result = "found-social"; row.social = soc;
          } else if (l.hafLocalAuthority && (isUrl(hf) || isUrl(su))) {
            const url = isUrl(hf) ? hf : su;
            const la = String(l.hafLocalAuthority||"").split("; ")[0];
            upd.secondaryContact = url; upd.secondaryContactType = "council-haf-programme";
            upd.secondaryContactNote = `No direct contact found after a targeted search — this is the ${la} Council${l.hafProgramme ? ` "${l.hafProgramme}"` : " HAF"} programme page that lists them. Not a direct line; enquire via the council.`;
            upd.secondaryContactAt = stamp;
            row.result = "found-council-secondary"; row.secondary = url;
          } else {
            row.result = "dead-end-confirmed";
            row.deadEndWhy = `no usable sourceUrl/hafFrom contact, and web search "${q}" returned nothing matching by name/host and no social profile`;
            upd.contactDeadEnd = true; upd.contactDeadEndWhy = row.deadEndWhy; upd.contactDeadEndAt = stamp;
          }
        }
      }
    }
  }

  if (Object.keys(upd).length && args.apply) {
    try { await db.collection("leads").doc(l.id).update(upd); } catch (e) { row.applyErr = String(e?.message||e).slice(0,150); }
  }
  bump(row.result || "unknown");
  row.at = new Date().toISOString();
  outStream.write(JSON.stringify(row) + "\n");
  n++;
  if (n % 50 === 0) console.log(`${n}/${todo.length} ${Math.round((Date.now()-t0)/1000)}s brave=${braveUsed}`, JSON.stringify(tally));
  return row;
}

async function worker() { while (i < todo.length) { const l = todo[i++]; try { await processOne(l); } catch (e) { bump("error"); outStream.write(JSON.stringify({ id: l.id, result: "error", err: String(e?.message||e).slice(0,150), at: new Date().toISOString() }) + "\n"); n++; } } }
await Promise.all(Array.from({ length: CONC }, worker));
outStream.end();
console.log("DONE", n, `brave=${braveUsed}`, JSON.stringify(tally), args.apply ? "(APPLIED)" : "(dry-run — pass --apply to write)");
process.exit(0);
