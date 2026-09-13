// Fill-only merge of crawl findings (booking platform / HAF / coming-soon) into leads.
import admin from "firebase-admin"; import fs from "fs";
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync("./serviceAccountKey.json","utf8"))) });
const db = admin.firestore();
const S = process.env.S; const OUT = `${S}/all.out.jsonl`; const DONE = `${S}/merged.ids`;
const done = new Set(fs.existsSync(DONE) ? fs.readFileSync(DONE,"utf8").split("\n").filter(Boolean) : []);
const NOISE = new Set(["Parent Apps"]);
const NURSERY_APP = new Set(["Famly","Blossom","Kinderly","Tapestry","Connect Childcare","Connect Childcare (ParentZone)","Nursery in a Box","Parenta","Baby's Days","First Steps","eyLog","Cheqdin","Nursery Story","Kidsnest","Tiny Tracker","MyKidz","Little Vista","Kidsoft","EY Manager","Abacus","Nursery Hub"]);
const FORMS = new Set(["Google Forms","Microsoft Forms","JotForm","Typeform"]);
const SHOP = new Set(["Shopify","Square","SumUp","PayPal buttons","Stripe payment links","GoCardless"]);
// Weak: a WordPress theme often bundles WooCommerce / an events plugin without selling anything — note it, don't call it a booking platform.
const WEAK = new Set(["WooCommerce shop","The Events Calendar","Event Tickets (WordPress)"]);
const SCHOOL_PAY = new Set(["ParentPay","ParentMail","Arbor","ScoPay","SIMS Pay","Tucasi","sQuid","iPayimpact","Weduc","eSchools","School Money","SchoolsBuddy"]);
const EXT = { "pbbl.uk":"Pebble", "activities.bookpebble.co.uk":"Pebble", "app.classmanager.com":"Class Manager", "app.holidayactivities.com":"Holiday Activities", "parent.kiplearn.co":"KipLearn (Kip McGrath portal)", "campscui.active.com":"ActiveWorks", "app.speedadmin.dk":"SpeedAdmin", "speedadmin.dk":"SpeedAdmin", "happity.co.uk":"Happity", "book.ultracamp.com":"UltraCamp", "ultracamp.com":"UltraCamp" };
const label = (p) => NURSERY_APP.has(p) ? `${p} (nursery app)` : FORMS.has(p) ? `${p} (booking form)` : SHOP.has(p) ? `own site shop (${p})` : SCHOOL_PAY.has(p) ? `${p} (school payments)` : p;
const rank = (p) => NURSERY_APP.has(p) ? 3 : SHOP.has(p) ? 2 : FORMS.has(p) ? 2 : SCHOOL_PAY.has(p) ? 1 : 0;
let n=0, setBs=0, setHaf=0, setSoon=0, batch=db.batch(), inBatch=0; const newly=[];
const flush = async () => { if (inBatch) { await batch.commit(); batch=db.batch(); inBatch=0; } };
const lines = fs.readFileSync(OUT,"utf8").split("\n").filter(Boolean);
const ids = lines.map(l=>JSON.parse(l)).filter(r=>!done.has(r.id));
// read current values for fill-only
const cur = new Map();
for (let i=0;i<ids.length;i+=300){ const refs=ids.slice(i,i+300).map(r=>db.collection("leads").doc(r.id)); const snaps=await db.getAll(...refs,{fieldMask:["bookingSystem","haf","comingSoon","bookingUrl"]}); snaps.forEach(s=>cur.set(s.id,s.exists?s.data():{})); }
for (const r of ids) {
  const c = cur.get(r.id) || {}; const upd = {};
  const weak = Object.keys(r.platforms||{}).filter(p=>WEAK.has(p));
  const plats = Object.keys(r.platforms||{}).filter(p=>!NOISE.has(p) && !WEAK.has(p));
  if (weak.length && !c.webShop) upd.webShop = weak.map(w=>w.replace(" shop","").replace(" (WordPress)","")).join(", ");
  for (const [h,v] of Object.entries(r.external||{})) { const nm = EXT[h]; if (nm && !plats.includes(nm)) { plats.push(nm); r.platforms[nm] = v.url; } }
  plats.sort((a,b)=>rank(a)-rank(b));
  if (plats.length && !c.bookingSystem) {
    const main = plats[0]; const rest = plats.slice(1,3).map(label);
    upd.bookingSystem = label(main) + (rest.length ? `; also ${rest.join(", ")}` : "");
    const ext = Object.values(r.external||{}).find(v=>/bookwhen|classforkids|class4kids|ipal|magicbooking|kidsclubhq|enrolmy|pembee|eventbrite|bookpebble|pbbl|eequ|classmanager|holidayactivities|ultracamp|speedadmin|happity|gymcatch|teamup|loveadmin|clubspark/i.test(v.url));
    if (ext) upd.bookingUrl = ext.url; else if (r.ownForm) upd.bookingUrl = r.ownForm;
    upd.bookingFrom = `site crawl 13 Sept 2026 (${r.pages} pages)`; setBs++;
  } else if (!plats.length && r.ownForm && !c.bookingSystem) { upd.bookingSystem = "own site (booking form)"; upd.bookingUrl = r.ownForm; upd.bookingFrom = "site crawl 13 Sept 2026"; setBs++; }
  if (r.haf && !c.haf) { upd.haf = true; upd.hafFrom = r.hafFrom; if (r.hafText) upd.hafText = r.hafText; setHaf++; }
  if (r.soon && !c.comingSoon) { upd.comingSoon = true; setSoon++; }
  if (r.parked) upd.websiteParked = true;
  if (Object.keys(upd).length) { upd.updatedAt = new Date().toISOString(); batch.update(db.collection("leads").doc(r.id), upd); inBatch++; if (inBatch>=400) await flush(); }
  newly.push(r.id); n++;
}
// Correction: earlier pass called weak signals a booking system — undo those.
if (process.env.FIX) { const q = await db.collection("leads").where("bookingFrom", ">=", "site crawl").where("bookingFrom", "<", "site crawm").select("bookingSystem","bookingUrl").get(); let fixed=0;
  for (const d of q.docs) { const bs = d.data().bookingSystem || ""; if (/^own site shop \((WooCommerce shop|The Events Calendar|Event Tickets \(WordPress\))\)/.test(bs)) { const rest = bs.replace(/^own site shop \([^)]*\)(; also )?/, ""); const upd = rest ? { bookingSystem: rest } : { bookingSystem: admin.firestore.FieldValue.delete(), bookingUrl: admin.firestore.FieldValue.delete(), bookingFrom: admin.firestore.FieldValue.delete() }; upd.webShop = /WooCommerce/.test(bs) ? "WooCommerce" : "Events plugin"; batch.update(d.ref, upd); inBatch++; fixed++; if (inBatch>=400) await flush(); } }
  console.log("corrected", fixed); }
await flush();
fs.appendFileSync(DONE, newly.map(i=>i+"\n").join(""));
console.log(JSON.stringify({ processed:n, bookingSystemSet:setBs, hafSet:setHaf, comingSoonSet:setSoon }));
process.exit(0);
