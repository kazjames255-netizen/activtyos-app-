// Resumable website verifier. Fetches each lead's confirmed website (kind=confirmed) or candidate (kind=candidate),
// checks their name, their town/postcode and children's-activity wording, and writes one JSON row per lead to
// scripts/leads/out/verify.out.jsonl in the shape apply_verify.mjs expects. Re-running skips ids already in the file.
// Usage (from server/): node scripts/leads/verify_sites.mjs [--limit N] [--kind confirmed|candidate|all] [--only id1,id2]
import admin from "firebase-admin"; import fs from "fs"; import path from "path";
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync("./serviceAccountKey.json","utf8"))) });
const db = admin.firestore();
const args = Object.fromEntries(process.argv.slice(2).map((a,i,arr)=>a.startsWith("--")?[a.slice(2),arr[i+1]&&!arr[i+1].startsWith("--")?arr[i+1]:true]:[]).filter(x=>x.length));
const LIMIT = args.limit ? +args.limit : Infinity, KIND = args.kind || "all", ONLY = args.only ? new Set(String(args.only).split(",")) : null;
const OUT = path.resolve("scripts/leads/out/verify.out.jsonl"); const CONC = 24, TIMEOUT = 12000, MAXBYTES = 1_500_000;
// Resume key is id + url: a lead whose old candidate was dropped and that now carries a NEW candidate gets checked again.
const done = new Set(fs.existsSync(OUT) ? fs.readFileSync(OUT,"utf8").split("\n").filter(Boolean).map(l=>{try{const r=JSON.parse(l);return r.id+"|"+r.url}catch{return null}}) : []);

const CHILD = ["nursery","nurseries","pre-school","preschool","childcare","child care","children","kids","holiday club","holiday camp","after school","after-school","breakfast club","wraparound","wrap around","ofsted","early years","eyfs","toddler","baby","babies","playgroup","childminder","childminding","forest school","summer camp","multi-sport","multi sport","football coaching","gymnastics","swimming lessons","dance school","dance classes","drama","tuition","tutoring","tutor","stay and play","soft play","party","parties","activities for children","kids club","youth","scouts","cubs","beavers","brownies","guides","kindergarten","day care","daycare","montessori","reception","key stage","ks1","ks2","under 5","under-5","ages 4","ages 5","aged 4","aged 5","years old","school holidays","term time","term-time","half term","clubs for kids","sports coaching","coaching for children","little","junior","juniors","mini","minis","tots","play"];
const OTHER = ["estate agent","letting agent","solicitor","solicitors","accountant","accountants","plumber","plumbing","electrician","roofing","builders","scaffolding","car wash","garage services","mot centre","tyres","dentist","dental practice","opticians","pharmacy","funeral","casino","betting","bookmaker","vape","tattoo","barber","hair salon","beauty salon","nail bar","restaurant","takeaway","public house","bar and grill","hotel rooms","b&b","holiday cottages","caravan park","gym membership","personal trainer","crossfit","bodybuilding","car sales","used cars","van hire","removals","storage units","recruitment agency","it support","web design","seo agency","marketing agency","insurance broker","mortgage","loans","crypto","forex","escort","adult only","dating","cbd","kitchens","bathrooms","flooring","carpets","windows and doors","double glazing","landscaping","tree surgeon","pest control","cleaning services","skip hire","wedding venue","conference centre","office space","coworking","church services","funeral directors","vets","veterinary","dog grooming","kennels","cattery"];
const PARKED = ["domain is for sale","this domain is for sale","buy this domain","domain may be for sale","parked domain","this domain has expired","domain expired","sedo","hugedomains","dan.com","afternic","godaddy.com/domainsearch","namecheap.com/domains","this web page is parked","website is parked","site not found","account suspended","this site can’t be reached","under construction","default web page","welcome to nginx","apache2 debian default","it works!","index of /","plesk","cpanel","wix.com/website-template","site is temporarily unavailable","this website is currently unavailable","website expired","domain not configured","squarespace: claim","this site is not yet published","this store is currently unavailable","shop coming soon"];
const STOP = new Set(["the","and","ltd","limited","cic","llp","plc","of","at","in","for","a","an","club","clubs","school","schools","nursery","nurseries","preschool","pre","childcare","children","kids","day","care","centre","center","group","community","academy","holiday","camp","camps","sports","sport","activities","activity","little","co","uk","com","org","org.uk","co.uk","trust","foundation","cio","charity","services","service","st","st.","primary","first","new"]);
const strip = (h) => h.replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<!--[\s\S]*?-->/g," ").replace(/<[^>]+>/g," ").replace(/&nbsp;|&#160;/g," ").replace(/&amp;/g,"&").replace(/&#39;|&apos;/g,"'").replace(/\s+/g," ").toLowerCase();
const tokens = (s) => (s||"").toLowerCase().replace(/[’']/g,"").split(/[^a-z0-9]+/).filter(t=>t.length>=3 && !STOP.has(t));
const squash = (s) => (s||"").toLowerCase().replace(/[^a-z0-9]/g,"");
const locBits = (loc) => { const out=[]; for (const part of String(loc||"").split(/[·,|\/]/)) { const p=part.trim().toLowerCase(); if(!p) continue; const pc=p.match(/\b([a-z]{1,2}\d[a-z\d]?)\s*(\d[a-z]{2})?\b/); if(pc){ out.push(pc[1]); if(pc[2]) out.push(pc[1]+" "+pc[2]); continue; } if(/^\d+ sites?$/.test(p)) continue; if(p.length>=4 && !/^(uk|england|wales|scotland|london borough)$/.test(p)) out.push(p); } return [...new Set(out)]; };
const RX = new Map(); const rx = (t) => { if(!RX.has(t)) RX.set(t, new RegExp("(^|[^a-z])"+t.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+"(s|es|'s)?([^a-z]|$)","i")); return RX.get(t); };
const count = (text, list) => list.filter(t => rx(t).test(text));

async function fetchSite(url) {
  const ctrl = new AbortController(); const t = setTimeout(()=>ctrl.abort(), TIMEOUT);
  try {
    const res = await fetch(url, { redirect:"follow", signal: ctrl.signal, headers: { "user-agent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36", "accept":"text/html,*/*;q=0.8", "accept-language":"en-GB,en;q=0.9" } });
    const final = res.url || url; if (res.status >= 400) return { status: res.status, final, html: "" };
    const reader = res.body?.getReader(); let got = 0, chunks = [];
    if (reader) { while (got < MAXBYTES) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); got += value.length; } try { reader.cancel(); } catch {} }
    return { status: res.status, final, html: Buffer.concat(chunks).toString("utf8") };
  } catch (e) { return { status: 0, final: url, html: "", err: String(e?.cause?.code || e?.name || e).slice(0,60) }; }
  finally { clearTimeout(t); }
}

async function contactPage(html, base) { const m = [...html.matchAll(/href=["']([^"']*(contact|about|find-us|findus|location|where)[^"']*)["']/gi)].map(x=>x[1]).filter(h=>!/^(mailto|tel|javascript|#)/i.test(h)); for (const h of m.slice(0,2)) { try { const u = new URL(h, base).href; if (new URL(u).hostname !== new URL(base).hostname) continue; const r = await fetchSite(u); if (r.status===200 && r.html) return strip(r.html)+" "+r.html.toLowerCase(); } catch {} } return ""; }
// Booking systems a site links parents to — found in the same fetch, so the Platform filter gets filled for free.
const BOOKING_SYSTEMS = [["ClassForKids", /classforkids\.io/i], ["Bookwhen", /bookwhen\.com/i], ["eequ", /eequ\.org/i], ["Pebble", /(bookpebble\.co\.uk|pebble\.co\b)/i], ["Playwaze", /playwaze\.com/i], ["ClubSpark", /clubspark\.(net|lta\.org\.uk)/i], ["Coordinate", /coordinate\.cloud/i], ["HolidayActivities", /holidayactivities\.com/i], ["Yellow Days", /yellowdays/i], ["Hoop", /hoop\.co\.uk/i], ["Kidzcamp", /kidzcamp/i], ["iPAL", /ipal\.(co\.uk|app)/i], ["Magicbooking", /magicbooking/i], ["Famly", /famly\.co/i], ["Kinderly", /kinderly/i], ["Blossom", /blossomeducational/i], ["Connect Childcare", /connectchildcare/i], ["Nursery in a Box", /nurseryinabox/i], ["ParentPay", /parentpay\.com/i], ["SchoolsBuddy", /schoolsbuddy/i], ["Arbor", /arbor-education|arbor\.sc/i], ["Gymcatch", /gymcatch\.com/i], ["TeamUp", /goteamup\.com/i], ["Glofox", /glofox\.com/i], ["Mindbody", /mindbodyonline/i], ["Acuity", /acuityscheduling/i], ["Calendly", /calendly\.com/i], ["Eventbrite", /eventbrite/i], ["TicketSource", /ticketsource/i], ["TryBooking", /trybooking/i], ["Stripe checkout", /(buy\.stripe\.com|checkout\.stripe\.com)/i], ["Shopify", /myshopify\.com/i], ["Sumup", /sumup\.(com|io)/i], ["Square", /square\.site|squareup\.com/i], ["Wix Bookings", /wix\.com\/bookings|wixbookings/i], ["LoveAdmin", /loveadmin/i], ["Pitchero", /pitchero\.com/i], ["Spond", /spond\.com/i], ["Sportsuite", /sportsuite/i], ["Kids Club HQ", /kidsclubhq/i], ["Class4Kids", /class4kids/i], ["Nursery Story", /nurserystory/i], ["Tapestry", /tapestryjournal/i], ["Baby's Days", /babysdays/i]];
function bookingOn(html) { const hrefs = [...html.matchAll(/href=["']([^"']+)["']/gi)].map(m=>m[1]); for (const h of hrefs) { const sys = BOOKING_SYSTEMS.find(([, re]) => re.test(h)); if (sys) return { system: sys[0], url: h.slice(0, 300) }; } const own = hrefs.find(h => /\/(book|booking|bookings|book-now|book-online|enrol|enroll|register|sign-up|signup)(\/|\.|\?|$)/i.test(h) && !/^(mailto|tel|#)/i.test(h)); return own ? { system: "own site (booking page)", url: own.slice(0, 300) } : null; }
async function judge(lead, kind, url, r) {
  const row = { id: lead.id, kind, url, final: r.final, status: r.status, err: r.err, comingSoon: lead.comingSoon === true || undefined, wasDown: lead.websiteDown === true || undefined };
  if (r.status === 0 || r.status >= 400) return { ...row, verdict: "unreachable", sector: "unreachable", nameOk: false, locOk: false, locHits: [], notTerms: [] };
  const text = strip(r.html); const host = (()=>{ try { return new URL(r.final).hostname.replace(/^www\./,""); } catch { return ""; } })();
  const title = (r.html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||"").toLowerCase();
  const parkedHits = count(text.slice(0,4000)+" "+title, PARKED);
  const childHits = count(text, CHILD), otherHits = count(text, OTHER);
  const nameToks = tokens(lead.name), nameHit = nameToks.filter(t => text.includes(t) || host.includes(t));
  const nameOk = nameToks.length ? nameHit.length >= Math.max(1, Math.ceil(nameToks.length*0.6)) : false;
  const hostHasName = nameToks.some(t => t.length>=5 && squash(host).includes(t)) || (squash(lead.name).length>=8 && squash(host).includes(squash(lead.name).slice(0,10)));
  const raw = r.html.toLowerCase(); const locs = locBits(lead.location); let locHits = locs.filter(l => text.includes(l) || raw.includes(l)); if (!locHits.length && locs.length && childHits.length >= 2) { const extra = await contactPage(r.html, r.final); if (extra) locHits = locs.filter(l => extra.includes(l)).map(l=>l+" (contact page)"); } const locOk = locHits.length > 0;
  let sector = "no-signal";
  if (parkedHits.length && childHits.length < 2) sector = "parked";
  else if (text.length < 200) sector = "empty";
  else if (childHits.length >= 2) sector = "child";
  else if (otherHits.length >= 2 && childHits.length === 0) sector = "other-sector";
  const notTerms = otherHits.slice(0,5), childTerms = childHits.slice(0,6);
  let verdict;
  if (kind === "candidate") {
    if (sector === "child" && nameOk && locOk) verdict = "confirm";
    else if (sector === "child" && (nameOk || hostHasName) && (locOk || hostHasName)) verdict = "confirm-weak";
    else if (sector === "child" && (nameOk || hostHasName)) verdict = "keep-candidate";
    else verdict = "drop";
  } else verdict = sector === "child" ? "ok" : sector;
  return { ...row, verdict, sector, nameOk: nameOk || hostHasName, locOk, locs, locHits, notTerms, childTerms, textLen: text.length, booking: bookingOn(r.html) };
}

const snap = await db.collection("leads").select("name","location","website","websiteCandidate","excluded","comingSoon","websiteDown","websiteCheckedAt").get();
const jobs = [];
for (const d of snap.docs) { const l = { id: d.id, ...d.data() }; if (l.excluded || (ONLY && !ONLY.has(l.id))) continue;
  if (args.recheck) { if (l.website && (l.comingSoon || l.websiteDown)) jobs.push({ lead: l, kind: "confirmed", url: l.website }); continue; }
  if (l.website && (KIND==="all"||KIND==="confirmed") && !done.has(l.id+"|"+l.website)) jobs.push({ lead: l, kind: "confirmed", url: l.website });
  else if (l.websiteCandidate && (KIND==="all"||KIND==="candidate") && !done.has(l.id+"|"+l.websiteCandidate)) jobs.push({ lead: l, kind: "candidate", url: l.websiteCandidate }); }
jobs.sort((a,b)=> a.kind===b.kind ? 0 : a.kind==="candidate" ? -1 : 1);
const todo = jobs.slice(0, LIMIT); console.log(`to check: ${todo.length} (already done ${done.size}, total eligible ${jobs.length})`);
const out = fs.createWriteStream(OUT, { flags: "a" }); let i = 0, n = 0; const tally = {}; const t0 = Date.now();
async function worker() { while (i < todo.length) { const j = todo[i++]; const url = /^https?:\/\//i.test(j.url) ? j.url : "https://" + j.url; const r = await fetchSite(url); const row = await judge(j.lead, j.kind, url, r); out.write(JSON.stringify(row)+"\n"); const k = j.kind+":"+row.verdict; tally[k]=(tally[k]||0)+1; n++; if (n % 200 === 0) console.log(`${n}/${todo.length} ${Math.round((Date.now()-t0)/1000)}s`, JSON.stringify(tally)); } }
await Promise.all(Array.from({length: CONC}, worker));
out.end(); console.log("done", n, JSON.stringify(tally)); process.exit(0);
