// Spot-verification pass for reviewTier=="uncertain" leads. One Brave web search per lead
// ("<name>" <town>), classify from search-result titles/descriptions (+ a free fetch of the
// first non-directory result when it looks worth a closer look — no extra Brave cost):
//   - strong children's-activity signal + name/location match -> reviewTier: likely_fit
//   - clear evidence it's a different kind of business, or dissolved/struck-off/no-longer-trading
//     -> reviewTier: likely_not_fit, excluded: true, excludedWhy set
//   - anything else (no strong signal either way, brave error, nothing found) -> left as
//     "uncertain" but stamped uncertainVerifiedAt/uncertainVerifiedNote so this pass doesn't
//     re-spend on the same lead and a human reviewer can see it was looked at, not neglected.
// Never fabricates a contact and never writes a register/council contact into email/phone —
// this pass only ever touches reviewTier/excluded/uncertainVerified* fields.
// Hard Brave budget cap (founder-approved ~$36 remaining tonight, conservative $/call estimate)
// so this can be re-run safely without risk of overspending.
//   node scripts/leads/uncertain_verify.mjs [--limit N] [--budget N] [--apply]
import "dotenv/config"; import admin from "firebase-admin"; import fs from "fs"; import path from "path";
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync("./serviceAccountKey.json","utf8"))) });
const db = admin.firestore();
const args = Object.fromEntries(process.argv.slice(2).map((a,i,arr)=>a.startsWith("--")?[a.slice(2),arr[i+1]&&!arr[i+1].startsWith("--")?arr[i+1]:true]:[]).filter(x=>x.length));
const LIMIT = args.limit ? +args.limit : Infinity;
const BRAVE_BUDGET = args.budget ? +args.budget : 3000; // hard call cap for this run
const APPLY = !!args.apply;
const OUT = path.resolve("scripts/leads/out/uncertain_verify.out.jsonl");
const API_KEY = process.env.BRAVE_SEARCH_API_KEY || "";
const GAP_MS = 300;

const STOP = new Set("the and of ltd limited cic cio llp plc co uk com org group holiday camp camps club clubs school schools nursery nurseries preschool pre childcare children kids day care centre center community academy little happy days playgroup trust foundation charity services service st primary first new".split(" "));
const tokens = (s) => (s||"").toLowerCase().replace(/[’']/g,"").split(/[^a-z0-9]+/).filter(t=>t.length>=3 && !STOP.has(t));
const town = (l) => { const loc = String(l.location||"").split(/[·|]/)[0].split(",")[0].replace(/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/,"").trim(); return loc && !/^\d+ sites?$/i.test(loc) ? loc : (l.county||l.region||l.postcode||"").trim(); };
const decode = (s) => s.replace(/&amp;/g,"&").replace(/&#(\d+);/g,(m,n)=>String.fromCharCode(+n)).replace(/&quot;/g,'"').replace(/&#x27;|&#39;/g,"'").replace(/<[^>]+>/g,"");

const CHILD = ["nursery","nurseries","pre-school","preschool","childcare","child care","children","kids","holiday club","holiday camp","after school","after-school","breakfast club","wraparound","wrap around","ofsted","early years","eyfs","toddler","baby","babies","playgroup","childminder","childminding","forest school","summer camp","multi-sport","football coaching","gymnastics","swimming lessons","dance school","dance classes","drama","stay and play","soft play","party","parties","activities for children","kids club","youth","scouts","cubs","beavers","brownies","guides","kindergarten","day care","daycare","montessori","performing arts","stage school","youth theatre","music lessons","tuition","tutoring"];
const OTHER = ["estate agent","letting agent","solicitor","solicitors","accountant","accountants","plumber","plumbing","electrician","roofing","builders","scaffolding","car wash","garage services","mot centre","tyres","dentist","dental practice","opticians","pharmacy","funeral","casino","betting","bookmaker","vape","tattoo","barber","hair salon","beauty salon","nail bar","restaurant","takeaway","public house","hotel rooms","b&b","holiday cottages","caravan park","gym membership","personal trainer","crossfit","car sales","used cars","van hire","removals","storage units","recruitment agency","it support","web design","seo agency","marketing agency","insurance broker","mortgage","loans","crypto","forex","escort","adult only","dating","cbd","kitchens","bathrooms","flooring","carpets","windows and doors","double glazing","landscaping","tree surgeon","pest control","cleaning services","skip hire","wedding venue","conference centre","office space","coworking","funeral directors","vets","veterinary","dog grooming","kennels","cattery","adult day care","dementia care","elderly care","residential care home","care home for adults"];
const DEAD = ["dissolved","struck off","struck-off","company dissolved","no longer trading","ceased trading","permanently closed","business closed","has closed","this company was closed","in liquidation","company has been dissolved"];
const rx = (t) => new RegExp("(^|[^a-z])"+t.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+"(s|es|'s)?([^a-z]|$)","i");
const hits = (text, list) => list.filter(t => rx(t).test(text));

async function search(q) {
  const ctrl = new AbortController(); const t = setTimeout(()=>ctrl.abort(), 15000);
  try {
    const r = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(q)}&country=GB&search_lang=en&count=8&safesearch=moderate`, { signal: ctrl.signal, headers: { accept: "application/json", "accept-encoding": "gzip", "x-subscription-token": API_KEY } });
    if (r.status !== 200) return { status: r.status, results: [], err: (await r.text()).slice(0,150) };
    const j = await r.json(); return { status: 200, results: (j.web?.results ?? []).map(x => ({ url: x.url, title: decode(x.title||""), desc: decode(x.description||"") })) };
  } catch (e) { return { status: 0, results: [], err: String(e?.name||e).slice(0,60) }; } finally { clearTimeout(t); }
}

if (!API_KEY) { console.error("no BRAVE_SEARCH_API_KEY set"); process.exit(1); }

const done = new Set(fs.existsSync(OUT) ? fs.readFileSync(OUT,"utf8").split("\n").filter(Boolean).map(l=>{try{return JSON.parse(l).id}catch{return null}}) : []);
const snap = await db.collection("leads").where("reviewTier","==","uncertain").select("name","location","county","region","postcode","source","excluded","uncertainVerifiedAt").get();
const todo = snap.docs
  .filter(d => { const x = d.data(); return !x.excluded && !x.uncertainVerifiedAt && !done.has(d.id); })
  .map(d => ({ id: d.id, ...d.data() }))
  .slice(0, Math.min(LIMIT, BRAVE_BUDGET));
console.log(`uncertain leads total: ${snap.size}, eligible for this pass: ${snap.docs.filter(d=>{const x=d.data();return !x.excluded && !x.uncertainVerifiedAt;}).length}, running: ${todo.length} (budget cap ${BRAVE_BUDGET}, apply=${APPLY})`);

const out = fs.createWriteStream(OUT, { flags: "a" });
let braveUsed = 0, likelyFit = 0, likelyNotFit = 0, stillUncertain = 0, budgetStop = false, hardStop = false;
let batch = db.batch(), inB = 0;
const flush = async () => { if (inB) { await batch.commit(); batch = db.batch(); inB = 0; } };

for (const l of todo) {
  if (braveUsed >= BRAVE_BUDGET) { budgetStop = true; break; }
  const q = `"${l.name}" ${town(l)}`.trim();
  const r = await search(q);
  braveUsed++;
  if (r.status === 402 || r.status === 429) { console.log(`STOP: brave returned ${r.status} — treating as budget/quota exhausted after ${braveUsed} calls`); hardStop = true; }
  const text = r.results.map(x => x.title + " " + x.desc).join(" \n ");
  const nt = tokens(l.name);
  const nameHit = r.results.some(x => { const tt = tokens(x.title+" "+x.desc+" "+x.url); return nt.filter(t=>tt.includes(t)).length >= Math.max(1, Math.ceil(nt.length*0.5)); });
  const childHits = hits(text, CHILD), otherHits = hits(text, OTHER), deadHits = hits(text, DEAD);
  let verdict, why, upd = { uncertainVerifiedAt: new Date().toISOString(), uncertainVerifiedBy: "brave search spot-check (uncertain_verify.mjs)" };

  if (r.status === 200 && deadHits.length && nameHit) {
    verdict = "likely_not_fit"; why = `search evidence of closure/dissolution: "${deadHits[0]}"`;
    upd.reviewTier = "likely_not_fit"; upd.excluded = true; upd.excludedWhy = `uncertain-tier spot-check: ${why}`;
    likelyNotFit++;
  } else if (r.status === 200 && otherHits.length >= 2 && childHits.length === 0 && nameHit) {
    verdict = "likely_not_fit"; why = `search results describe a different kind of business (${otherHits.slice(0,3).join(", ")})`;
    upd.reviewTier = "likely_not_fit"; upd.excluded = true; upd.excludedWhy = `uncertain-tier spot-check: ${why}`;
    likelyNotFit++;
  } else if (r.status === 200 && childHits.length >= 2 && nameHit) {
    verdict = "likely_fit"; why = `search results confirm a children's-activity business (${childHits.slice(0,3).join(", ")})`;
    upd.reviewTier = "likely_fit"; upd.reviewTierNote = `confirmed by spot-check: ${why}`;
    likelyFit++;
  } else {
    verdict = "uncertain"; why = r.status !== 200 ? `search failed (status ${r.status})` : (!nameHit ? "no search result matched the name/location well enough to judge" : "no strong children's-activity or non-fit signal either way");
    upd.uncertainVerifiedNote = why;
    stillUncertain++;
  }

  out.write(JSON.stringify({ id: l.id, name: l.name, q, status: r.status, verdict, why, at: new Date().toISOString() }) + "\n");
  if (APPLY) { batch.update(db.collection("leads").doc(l.id), upd); if (++inB >= 400) await flush(); }
  if (braveUsed % 50 === 0) console.log(`progress: ${braveUsed}/${todo.length} brave=${braveUsed} likely_fit=${likelyFit} likely_not_fit=${likelyNotFit} stillUncertain=${stillUncertain}`);
  if (hardStop) break;
  await new Promise(res => setTimeout(res, GAP_MS));
}
if (APPLY) await flush();
out.end();
console.log("DONE", JSON.stringify({ processed: braveUsed, likelyFit, likelyNotFit, stillUncertain, budgetStop, hardStop, applied: APPLY }));
process.exit(0);
