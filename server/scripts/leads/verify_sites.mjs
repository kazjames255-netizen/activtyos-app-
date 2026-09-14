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
const MORE_SYSTEMS = [["Legend (leisure)", /legendonlineservices|legend\.co\.uk\/booking/i], ["Gladstone (leisure)", /gladstonemrm|gladstonesoftware|\.gladstone/i], ["XN Leisure", /xnleisure|xn-leisure/i], ["Better/GLL", /better\.org\.uk\/.*book|gll\.org/i], ["Everyone Active", /everyoneactive\.com\/.*book/i], ["NatWest PayIt", /natwestpayit/i], ["PayPal", /paypal\.(com|me)\/(paypalme|cgi-bin|checkout|ncp|donate)/i], ["GoCardless", /pay\.gocardless\.com/i], ["Zettle", /zettle\.com|izettle/i], ["Ticketsolve", /ticketsolve/i], ["Spektrix", /spektrix/i], ["Ticketmaster", /ticketmaster/i], ["See Tickets", /seetickets/i], ["Skiddle", /skiddle/i], ["Little Box Office", /littleboxoffice/i], ["Ticket Tailor", /tickettailor/i], ["WooCommerce cart", /\?add-to-cart=|\/cart\/?$|\/checkout\/?$/i], ["Squarespace commerce", /\/shop\?categoryId=|\/checkout\/order/i], ["Momence", /momence\.com/i], ["ClassPass", /classpass\.com/i], ["Sport:80", /sport80\.com/i], ["Pitchbooking", /pitchbooking/i], ["Playfinder", /playfinder\.com/i], ["LTA ClubSpark", /clubspark/i], ["Kidzcamp", /kidzcamp/i], ["Camp America style: Ultra Camp", /ultracamp/i], ["Sawyer", /hisawyer\.com/i], ["Jotform pay", /form\.jotform\.com/i], ["Typeform", /typeform\.com\/to/i], ["Google Forms", /docs\.google\.com\/forms|forms\.gle/i]];
const ALL_SYSTEMS = [...BOOKING_SYSTEMS, ...MORE_SYSTEMS];
const BOOKISH_PATH = /\/(book|booking|bookings|book-now|book-online|book-a-place|enrol|enroll|enrolment|register|registration|sign-?up|join|shop|store|prices?|pricing|fees|timetable|schedule|sessions?|classes|clubs?|camps?|holiday-?clubs?|holiday-?camps?|holidays|after-?school|breakfast|wraparound|courses?|workshops?|parties|membership|pay|payments?|checkout|basket|cart|tickets?|whats-on|events?)(\/|\.|\?|-|$)/i;
const bookText = (html) => { const t = html.replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").toLowerCase(); return { bookNow: (t.match(/\bbook (now|online|here|a place|your (place|child|space)|today)\b|\bbooking form\b|\bonline booking\b|\breserve (a|your) (place|spot)\b/g) || []).length, cart: (t.match(/add to (basket|cart)|checkout|your basket|shopping cart/g) || []).length, prices: (t.match(/£\s?\d/g) || []).length }; };
function systemIn(html) { const hrefs = [...html.matchAll(/(?:href|action|src|data-href|data-url)=["']([^"']+)["']/gi)].map(m=>m[1]); for (const h of hrefs) { const sys = ALL_SYSTEMS.find(([, re]) => re.test(h)); if (sys && !/facebook|instagram/i.test(h)) return { system: sys[0], url: h.slice(0, 300) }; } const inline = ALL_SYSTEMS.find(([, re]) => re.test(html.slice(0, 400000))); return inline && !/Google Forms|Typeform|Jotform/.test(inline[0]) ? { system: inline[0], url: null } : null; }
/** Booking scan: the homepage AND up to 4 booking-looking internal pages. Returns {system,url,page,pagesRead} or {system:null,pagesRead}. */
async function bookingScan(html, base) {
  let pagesRead = 1; const found = systemIn(html); if (found) return { ...found, page: base, pagesRead };
  let sub = []; try { const origin = new URL(base); const seen = new Set(); for (const m of html.matchAll(/href=["']([^"'#]+)["']/gi)) { let u; try { u = new URL(m[1], base); } catch { continue; } if (u.hostname.replace(/^www\./,"") !== origin.hostname.replace(/^www\./,"")) continue; if (!BOOKISH_PATH.test(u.pathname + u.search) || seen.has(u.pathname)) continue; seen.add(u.pathname); sub.push(u.href); } } catch {}
  // Prefer the most booking-like paths first.
  sub.sort((a, b) => (/book|enrol|shop|pay|checkout|basket|cart|ticket/i.test(b) ? 1 : 0) - (/book|enrol|shop|pay|checkout|basket|cart|ticket/i.test(a) ? 1 : 0));
  const own = []; const t0 = bookText(html); if (t0.bookNow >= 2 || t0.cart >= 1) own.push({ page: base, ...t0 });
  for (const u of sub.slice(0, 4)) { const r = await fetchSite(u); if (r.status !== 200 || !r.html) continue; pagesRead++; const f = systemIn(r.html); if (f) return { ...f, page: u, pagesRead }; const t = bookText(r.html); if (t.bookNow >= 1 || t.cart >= 1 || (t.prices >= 3 && /book|shop|price|fee|camp|club|class/i.test(u))) own.push({ page: u, ...t }); }
  if (own.length) { const best = own.sort((a, b) => (b.cart * 3 + b.bookNow * 2 + b.prices) - (a.cart * 3 + a.bookNow * 2 + a.prices))[0]; return { system: best.cart ? "own site (online checkout)" : "own site (booking page)", url: best.page, page: best.page, pagesRead, evidence: `book-now×${best.bookNow} cart×${best.cart} prices×${best.prices}` }; }
  return { system: null, pagesRead, subpages: sub.length };
}
// What the page says about them — feeds every Leads dropdown from the same fetch (fill-only in apply_verify).
const ACT = [["multi", /multi[- ]?(activit|sport|skill)|activity (camp|club|day)|fun (club|days?|camp)|adventure (camp|club|day)/gi], ["sport", /football|soccer|rugby|cricket|tennis|netball|hockey|basketball|badminton|athletics|golf|\bsports? (camp|club|coaching)|coaching/gi], ["gym", /gymnast|trampolin|cheerleading|parkour/gi], ["swim", /swimming|aqua|kayak|canoe|paddle ?board|sailing/gi], ["martial", /karate|judo|taekwondo|kickbox|jiu[- ]?jitsu|kung fu|martial arts|boxing|fencing/gi], ["dance", /\bdance|ballet|street ?dance|zumba/gi], ["drama", /drama|theatre|performing arts|acting|stage school/gi], ["music", /music (class|lesson|club|school)|piano|guitar|drum|choir|singing lessons|ukulele|violin/gi], ["arts", /arts? (and|&) crafts?|craft|painting|pottery|messy play/gi], ["forest", /forest school|woodland|bushcraft|outdoor (learning|adventure|club)|nature (club|school)/gi], ["stem", /coding|robotics|\blego\b|\bstem\b|science (club|camp)|minecraft|engineering/gi], ["language", /french|spanish|german|mandarin|language (class|club|lesson)/gi], ["tuition", /tuition|tutor|11 ?plus|11\+|maths (club|tuition)|homework club/gi], ["baby", /baby (class|sensory|massage|yoga|music|signing)|toddler (class|group|club)|sensory (class|play)/gi], ["cook", /cookery|cooking (class|club|camp)|baking (class|club)/gi], ["animals", /horse riding|pony|equestrian|farm (visit|club|school)|animal (club|encounter)/gi], ["send", /\bsend\b|special (educational )?needs|additional needs|autis|inclusive (club|provision|holiday)/gi], ["youth", /youth (club|centre|work)|scouts?\b|brownies|\bcubs\b|adventure playground/gi]];
const TYPES = [["holiday", /holiday (club|camp|care|scheme|activit)|play ?scheme|half[- ]term|summer (camp|club|school)|easter (camp|club)|school holidays?/gi], ["wraparound", /after[- ]?school (club|care)|breakfast club|wrap ?around|before (and|&) after school/gi], ["nursery", /day nursery|\bnursery\b|early years/gi], ["preschool", /pre[- ]?school|playgroup/gi], ["tuition", /tuition|tutor(ing|s)?\b|study centre/gi], ["activity", /\b(classes|lessons|sessions|term[- ]time (classes|clubs))\b|weekly (class|club|session)/gi]];
const cnt = (t, re) => (t.match(re) || []).length;
function signals(text, html) {
  const t = text.toLowerCase();
  const haf = cnt(t, /\bhaf\b|holiday activit(y|ies) (and|&) food|holiday activities (and|&) food programme|free school meals?|fsm[- ]eligible|funded (holiday )?places?/g);
  const prices = cnt(t, /£\s?\d/g) + cnt(t, /per (day|session|week|child|hour)/g) + cnt(html, /book(-| )?now|add to (basket|cart)|checkout/gi);
  const types = TYPES.filter(([, re]) => cnt(t, re) >= 2).map(([k]) => k); const acts = ACT.filter(([, re]) => cnt(t, re) >= 2).map(([k]) => k);
  const urn = (text.match(/\b(EY\d{6}|\d{6,7})\b(?=[^\n]{0,40}(ofsted|urn))/i) || text.match(/(ofsted|urn)[^\n]{0,40}\b(EY\d{6})\b/i))?.[0]?.match(/EY\d{6}|\d{6,7}/)?.[0] || null;
  const franchiseWords = cnt(t, /franchis(e|ee|ing|or)\b/g); const sites = cnt(t, /\b(our (venues|locations|sites|centres|branches))\b/g);
  return { haf, paid: prices, types, acts, ofstedUrn: urn, ofsted: cnt(t, /ofsted/g), franchiseWords, multiSite: sites > 0 };
}
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
  return { ...row, verdict, sector, nameOk: nameOk || hostHasName, locOk, locs, locHits, notTerms, childTerms, textLen: text.length, booking: await bookingScan(r.html, r.final || url), signals: signals(text, r.html) };
}

if (args["test-url"]) { for (const u of String(args["test-url"]).split(",")) { const r = await fetchSite(u); console.log(u, r.status, JSON.stringify(await bookingScan(r.html, r.final || u))); } process.exit(0); }
const snap = await db.collection("leads").select("name","location","website","websiteCandidate","excluded","comingSoon","websiteDown","websiteCheckedAt","bookingChecked","bookingSystem").get();
const jobs = [];
for (const d of snap.docs) { const l = { id: d.id, ...d.data() }; if (l.excluded || (ONLY && !ONLY.has(l.id))) continue;
  if (args["recheck-booking"]) { if (l.website && l.bookingChecked && !l.bookingSystem) jobs.push({ lead: l, kind: "confirmed", url: l.website }); continue; }
  if (args.recheck) { if (l.website && (l.comingSoon || l.websiteDown)) jobs.push({ lead: l, kind: "confirmed", url: l.website }); continue; }
  if (l.website && (KIND==="all"||KIND==="confirmed") && !done.has(l.id+"|"+l.website)) jobs.push({ lead: l, kind: "confirmed", url: l.website });
  else if (l.websiteCandidate && (KIND==="all"||KIND==="candidate") && !done.has(l.id+"|"+l.websiteCandidate)) jobs.push({ lead: l, kind: "candidate", url: l.websiteCandidate }); }
jobs.sort((a,b)=> a.kind===b.kind ? 0 : a.kind==="candidate" ? -1 : 1);
const todo = jobs.slice(0, LIMIT); console.log(`to check: ${todo.length} (already done ${done.size}, total eligible ${jobs.length})`);
const out = fs.createWriteStream(OUT, { flags: "a" }); let i = 0, n = 0; const tally = {}; const t0 = Date.now();
async function worker() { while (i < todo.length) { const j = todo[i++]; const url = /^https?:\/\//i.test(j.url) ? j.url : "https://" + j.url; const r = await fetchSite(url); const row = await judge(j.lead, j.kind, url, r); out.write(JSON.stringify(row)+"\n"); const k = j.kind+":"+row.verdict; tally[k]=(tally[k]||0)+1; n++; if (n % 200 === 0) console.log(`${n}/${todo.length} ${Math.round((Date.now()-t0)/1000)}s`, JSON.stringify(tally)); } }
await Promise.all(Array.from({length: CONC}, worker));
out.end(); console.log("done", n, JSON.stringify(tally)); process.exit(0);
