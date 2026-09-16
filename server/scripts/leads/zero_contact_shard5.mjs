// Shard 5 of 5 — "zero contact channel" backlog: leads with no website, no email, no phone, no socialUrl.
// Only processes leads whose Firestore doc ID ends in hex "f" (the 1/16 slice reserved for shard 5), to avoid
// colliding with the other 4 shards working the same backlog in parallel.
//
// Per lead:
//  1. Free pass (no Brave spend): re-fetch sourceUrl / hafFrom (the register/directory page saved at import) and
//     scan for an email/phone the importer missed, same extraction rules as secondary_contact.mjs.
//  2. One Brave search: `"<name>" <town/postcode>`. From the results:
//       - a result whose HOST carries the business name -> fetch it; if it reads as a real, live site for this
//         provider (name/location match, and ideally children's-activity wording) -> set `website` directly;
//         otherwise stash as `websiteCandidate` (unverified) for a human/verify pass.
//       - else a Facebook/Instagram result whose slug carries the name -> set `socialUrl`.
//       - else no usable channel -> honest `zeroContactStatus`.
//  3. If a website was found/confirmed, also scrape its homepage + contact page for an email/phone.
// Writes: website OR websiteCandidate, socialUrl, email, phone (all fill-only, never overwrites existing data),
// plus zeroContactStatus / zeroContactNote / zeroContactAt when nothing usable was found — never fabricated.
//
// Usage (from server/):  node scripts/leads/zero_contact_shard5.mjs
import "dotenv/config"; import admin from "firebase-admin"; import fs from "fs"; import path from "path";
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync("./serviceAccountKey.json","utf8"))) });
const db = admin.firestore();
const args = Object.fromEntries(process.argv.slice(2).map((a,i,arr)=>a.startsWith("--")?[a.slice(2),arr[i+1]&&!arr[i+1].startsWith("--")?arr[i+1]:true]:[]).filter(x=>x.length));
const LIMIT = args.limit ? +args.limit : Infinity;
const BRAVE_BUDGET = args.budget ? +args.budget : 200;
const OUT = path.resolve("scripts/leads/out/zero_contact_shard5.out.jsonl");
const LOG = path.resolve("scripts/leads/zero_contact_shard5.log");
const CACHE = path.resolve("scripts/leads/out/zero-contact-shard5-cache"); fs.mkdirSync(CACHE, { recursive: true });
const TIMEOUT = 10000, MAXBYTES = 1_200_000, GAP_MS = 350;
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const API_KEY = process.env.BRAVE_SEARCH_API_KEY || "";
const sleep = (ms) => new Promise(r=>setTimeout(r,ms));
const log = (...a) => { const line = a.map(x=>typeof x==="string"?x:JSON.stringify(x)).join(" "); console.log(line); fs.appendFileSync(LOG, line + "\n"); };

// ---------- helpers (copied/condensed from find_websites.mjs / find_contacts.mjs / secondary_contact.mjs) ----------
const isUrl = (s) => { try { const u = new URL(s); return u.protocol === "http:" || u.protocol === "https:"; } catch { return false; } };
const clean = (s) => String(s || "").replace(/\s+/g, " ").trim();
const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, "").toLowerCase(); } catch { return ""; } };
const STOP = new Set("the and of ltd limited cic cio uk plc llp co club clubs school nursery pre preschool childcare children kids day care centre center group holiday camp camps club activities activity community trust academy little happy days playgroup out after".split(" "));
const tokens = (s) => (s||"").toLowerCase().replace(/[’']/g,"").split(/[^a-z0-9]+/).filter(t=>t.length>=3 && !STOP.has(t));
const squash = (s) => (s||"").toLowerCase().replace(/[^a-z0-9]/g,"");
const town = (l) => { const loc = String(l.location||"").split(/[·|]/)[0].split(",")[0].replace(/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/,"").trim(); return loc && !/^\d+ sites?$/i.test(loc) ? loc : (l.county||l.region||l.postcode||"").trim(); };
const norm = (u) => /^https?:\/\//i.test(u) ? u : "https://" + u;

const EMAIL_RE = /[a-zA-Z0-9.\-_+]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
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
// National register / regulator hosts (Ofsted, Family Support NI, Care Inspectorate Wales…): any contact text on
// these pages is the AUTHORITY's own enquiry line, never a route to the specific provider they list. Never treat
// as this provider's email/phone. A council (.gov.uk) domain that ISN'T one of these authorities (e.g. a council's
// HAF/directory page) is a legitimate but SHARED contact — route it to secondaryContact, never to email/phone.
const REGISTER_AUTHORITY_HOSTS = new Set(["reports.ofsted.gov.uk", "ofsted.gov.uk", "familysupportni.gov.uk", "www.familysupportni.gov.uk", "careinspectorate.wales", "careinspectorate.com", "gov.wales"]);
const isGovEmail = (e) => /\.gov\.uk$/i.test(e.split("@")[1] || "");

async function fetchUrl(url) { const ctrl = new AbortController(); const t = setTimeout(()=>ctrl.abort(), TIMEOUT);
  try { const res = await fetch(url, { redirect:"follow", signal: ctrl.signal, headers: { "user-agent": UA, accept: "text/html,*/*;q=0.8", "accept-language":"en-GB,en;q=0.9" } });
    const final = res.url || url; if (res.status >= 400) return { status: res.status, final, html: "" };
    const reader = res.body?.getReader(); let got = 0, chunks = []; if (reader) { while (got < MAXBYTES) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); got += value.length; } try { reader.cancel(); } catch {} }
    return { status: res.status, final, html: Buffer.concat(chunks).toString("utf8") }; }
  catch (e) { return { status: 0, final: url, html: "", err: String(e?.cause?.code || e?.name || e).slice(0,60) }; } finally { clearTimeout(t); } }

const CHILD = ["nursery","nurseries","pre-school","preschool","childcare","child care","children","kids","holiday club","holiday camp","after school","after-school","breakfast club","wraparound","ofsted","early years","toddler","baby","babies","playgroup","childminder","forest school","summer camp","multi-sport","football coaching","gymnastics","swimming lessons","dance school","dance classes","drama","tuition","tutoring","stay and play","soft play","party","parties","kids club","youth","scouts","cubs","beavers","brownies","guides","kindergarten","day care","daycare","montessori","school holidays","term time","half term","little","junior","juniors","mini","minis","tots"];
const stripHtml = (h) => h.replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/&nbsp;/g," ").replace(/&amp;/g,"&").replace(/\s+/g," ").toLowerCase();
function looksLikeThem(lead, html, finalUrl) {
  const text = stripHtml(html); const host = hostOf(finalUrl);
  const nt = tokens(lead.name); const nameHits = nt.filter(t => text.includes(t) || host.includes(t));
  const nameOk = nt.length ? nameHits.length >= Math.max(1, Math.ceil(nt.length*0.6)) : false;
  const hostHasName = nt.some(t => t.length>=5 && squash(host).includes(t)) || (squash(lead.name).length>=8 && squash(host).includes(squash(lead.name).slice(0,10)));
  const childHits = CHILD.filter(t => text.includes(t)).length;
  return { nameOk: nameOk || hostHasName, childHits, text, host };
}

// ---------- Brave search ----------
const SKIP = /(maps\.apple|maps\.google|goo\.gl|waze|what3words|openstreetmap|facebook|instagram|twitter|x\.com|tiktok|youtube|linkedin|pinterest|threads\.net|gov\.uk|ofsted|nhs\.uk|yell\.com|yelp|thomsonlocal|192\.com|cylex|hotfrog|freeindex|scoot|childcare\.co\.uk|daynurseries|nurseriesuk|care\.com|careinspectorate|familysupportni|findchildcare|hoop\.co\.uk|eequ|pebble|playwaze|yellowdays|clubspark|footballfoundation|classforkids|bookwhen|kidadl|mumsnet|netmums|indeed|glassdoor|reed\.co\.uk|totaljobs|companieshouse|endole|opencorporates|checkacompany|companycheck|bizstats|find-and-update|charitycommission|register-of-charities|wikipedia|trustpilot|google\.|bing\.|amazon|ebay|etsy|nextdoor|tripadvisor|justgiving|gofundme|eventbrite|meetup|wordpress\.com|blogspot|wixsite|weebly|sites\.google|linktr\.ee|schoolsweb|primaryschool|\.sch\.uk|\.ac\.uk|schoolguide|locrating|getthedata|streetcheck|doogal|postcodearea|activityos|news|echo|gazette|times|mail|express|mirror|standard|chronicle|courier|herald|observer|telegraph|guardian|bbc\.)/i;
const SOCIAL = /^(www\.|m\.|en-gb\.)?(facebook\.com|instagram\.com)\//i;
let braveUsed = 0, braveDead = null;
async function search(q, _retry = false) {
  if (!API_KEY) return { status: 0, results: [], err: "no BRAVE_SEARCH_API_KEY" };
  if (braveDead) return { status: 402, results: [], err: braveDead, skipped: true };
  const ctrl = new AbortController(); const t = setTimeout(()=>ctrl.abort(), 15000);
  try { braveUsed++; const r = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(q)}&country=GB&search_lang=en&count=10&safesearch=moderate`, { signal: ctrl.signal, headers: { accept: "application/json", "accept-encoding": "gzip", "x-subscription-token": API_KEY } });
    if (r.status === 429 && !_retry) { clearTimeout(t); await sleep(20000); return search(q, true); }
    if (r.status !== 200) { const body = (await r.text()).slice(0, 160); if (r.status === 402) braveDead = "Brave credit exhausted (402): " + (body.match(/"detail":"([^"]+)"/)?.[1] || body); return { status: r.status, results: [], err: body }; }
    const j = await r.json(); return { status: 200, results: (j.web?.results ?? []).map(x => ({ url: x.url, title: x.title || "", desc: x.description || "" })) }; }
  catch (e) { return { status: 0, results: [], err: String(e?.name||e).slice(0,40) }; } finally { clearTimeout(t); } }
function pickWebsite(lead, results) { const nt = tokens(lead.name); const nsq = squash(lead.name); if (!nt.length) return null;
  for (const r of results.slice(0, 8)) { let host; try { host = new URL(r.url).hostname.replace(/^www\./,""); } catch { continue; } if (SKIP.test(host) || SKIP.test(r.url)) continue;
    const hsq = host.split(".")[0]; const hostHit = nt.some(t => t.length >= 4 && hsq.includes(t)) || (nsq.length >= 6 && hsq.includes(nsq.slice(0, Math.min(nsq.length, 12))));
    if (hostHit) return { url: `https://${host}/`, why: `host carries the name (${host})`, title: r.title }; }
  return null; }
function pickSocial(lead, results) { const nt = tokens(lead.name); for (const r of results.slice(0, 8)) { let h, p; try { const x = new URL(r.url); h = x.hostname.replace(/^www\./,""); p = x.pathname; } catch { continue; } if (!SOCIAL.test(h + p)) continue; const slug = tokens(p.replace(/\/(pages|people|groups|profile\.php)/,"")); if (nt.some(t => t.length >= 4 && slug.some(s => s.includes(t) || t.includes(s)))) return r.url; } return null; }

// ---------- leads: zero-contact, shard 5 (doc id ends in hex "f") ----------
const snap = await db.collection("leads").select("name","location","county","region","postcode","source","sourceUrl","hafFrom","hafLocalAuthority","hafProgramme","website","email","phone","socialUrl","excluded","zeroContactStatus").get();
const zero = [];
for (const d of snap.docs) { const x = d.data(); if (x.excluded) continue;
  if (x.website || x.email || x.phone || x.socialUrl) continue;
  zero.push({ id: d.id, ...x }); }
const shard = zero.filter(l => l.id.slice(-1).toLowerCase() === "f" && !l.zeroContactStatus);
log("total zero-contact:", zero.length, "shard5 (last hex f, not yet processed):", shard.length);
const todo = shard.slice(0, LIMIT);

const out = fs.createWriteStream(OUT, { flags: "a" });
let processed = 0, resolvedNew = 0, secondaryOnly = 0, deadEnd = 0;
const stamp = () => new Date().toISOString();

for (const lead of todo) {
  const row = { id: lead.id, name: lead.name };
  const update = {};

  // 1. Free re-fetch of sourceUrl / hafFrom. Register-authority hosts (Ofsted, FSNI, CIW…) are skipped outright —
  //    any contact text there is the AUTHORITY's own line, never this provider's. A found value NEVER goes to
  //    email/phone (those fields mean "this provider's own direct contact") — it's a shared/indirect route, so it
  //    goes to secondaryContact instead, same convention as secondary_contact.mjs.
  for (const u of new Set([lead.sourceUrl, lead.hafFrom].filter(isUrl))) {
    if (update.secondaryContact) break;
    const host = hostOf(u); if (REGISTER_AUTHORITY_HOSTS.has(host)) continue;
    const r = await fetchUrl(u).catch(()=>({status:0,html:""}));
    if (r.status === 200 && r.html) {
      const em = emails(r.html, host), ph = phones(r.html);
      const value = em[0] || ph[0];
      if (value) {
        update.secondaryContact = value;
        update.secondaryContactType = isGovEmail(value) || /\.gov\.uk$/i.test(host) ? "council-haf-programme" : "sourceUrl-refetch";
        update.secondaryContactNote = `No direct contact found for this provider — found by re-fetching ${host}${update.secondaryContactType === "council-haf-programme" ? " (a shared council contact, not this provider's own line)" : " (the original listing page; wasn't captured at import)"}.`;
        row.secondaryContactFrom = host;
      }
    }
  }

  // 2. One Brave search for a website / social page.
  let searchNote = null;
  if (braveUsed < BRAVE_BUDGET) {
    const q = `"${lead.name}" ${town(lead)}`.trim();
    const s = await search(q); row.q = q; row.searchStatus = s.status; await sleep(GAP_MS);
    if (s.status === 200) {
      const wp = pickWebsite(lead, s.results);
      if (wp) {
        const r = await fetchUrl(wp.url);
        if (r.status === 200 && r.html && r.html.length > 300) {
          const j = looksLikeThem(lead, r.html, r.final || wp.url);
          if (j.nameOk) {
            update.website = j.host ? `https://${j.host}/` : wp.url;
            row.websiteFrom = `web search: ${wp.why}${j.childHits ? `, ${j.childHits} children's-activity terms on page` : ""}`;
            // contact scrape on the confirmed site
            let html = r.html;
            for (const c of contactLinks(r.html, r.final || wp.url)) { const cr = await fetchUrl(c); if (cr.status === 200) html += "\n" + cr.html; }
            const em = emails(html, j.host), ph = phones(html);
            if (em[0] && !update.email) update.email = em[0];
            if (ph[0] && !update.phone) update.phone = ph[0];
          } else {
            update.websiteCandidate = wp.url;
            update.websiteCandidateWhy = `web search (zero-contact push, ${wp.why}) — unverified, name/location not confirmed on the page`;
          }
        } else if (!update.websiteCandidate) {
          update.websiteCandidate = wp.url;
          update.websiteCandidateWhy = `web search (zero-contact push, ${wp.why}) — unverified, page unreachable at check time`;
        }
      }
      if (!update.website && !update.socialUrl) {
        const soc = pickSocial(lead, s.results);
        if (soc) { update.socialUrl = soc; row.socialFrom = "web search result (zero-contact push)"; }
      }
      if (!update.website && !update.websiteCandidate && !update.socialUrl && !update.email && !update.phone) {
        searchNote = `web search ("${q}") ran (${s.results.length} results) but no usable channel matched the provider's name/location`;
      }
    } else {
      searchNote = `web search skipped/failed (status ${s.status}${s.err ? ": " + String(s.err).slice(0,80) : ""})`;
    }
  } else {
    searchNote = "Brave budget exhausted for this run";
  }

  const gotSomething = update.website || update.websiteCandidate || update.socialUrl || update.email || update.phone || update.secondaryContact;
  if (!gotSomething) {
    update.zeroContactStatus = searchNote && /skipped|budget/.test(searchNote) ? "unresolved-needs-search" : "no-channel-found";
    update.zeroContactNote = `${searchNote || "no source URL / HAF page to re-fetch, and no search performed"} — sourceUrl/hafFrom re-fetch also found nothing`;
    update.zeroContactAt = stamp();
  }

  row.update = update;
  out.write(JSON.stringify(row) + "\n");
  try {
    await db.collection("leads").doc(lead.id).update(update);
  } catch (e) {
    log("WRITE FAILED", lead.id, String(e?.message || e).slice(0,120));
  }
  processed++;
  if (update.website || update.email || update.phone || update.socialUrl) resolvedNew++;
  else if (update.secondaryContact) secondaryOnly++;
  else deadEnd++;
  if (processed % 10 === 0) log(`progress: ${processed}/${todo.length} processed, ${resolvedNew} resolved, ${secondaryOnly} secondary-only, ${deadEnd} dead-end, brave used ${braveUsed}`);
}
out.end();
log("DONE", JSON.stringify({ shard: "5 (hex f)", total: shard.length, processed, resolvedNew, secondaryOnly, deadEnd, braveUsed }));
process.exit(0);
