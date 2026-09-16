// FSNI website extraction — NOT a search. Every FamilySupportNI (familysupportni.gov.uk) directory listing page
// this pipeline already has a sourceUrl for sometimes carries the provider's own "Visit Website" button embedded
// right in the page HTML. This script fetches that page directly (one free HTTP GET, no Brave, no search spend)
// and pulls the href out with a regex — that's it. Confirmed by hand on 16 Sept 2026: e.g. lead "Sense Nursery
// (Newtownabbey)" (id Vd7t8cCcJLVdl5udnSen) had sourceUrl https://www.familysupportni.gov.uk/Search/Details/1903
// with no website on record; the page contains
//   <a href="https://www.sense.org.uk" target="_blank" class="btn-xs btn-info "><span class="glyphicon
//   glyphicon-home"></span> Visit Website</a>
// — a real, working site. A random sample of 60 fsni "no website" leads hit a genuine website on 13/60 (~22%,
// two of those were actually Facebook pages, routed to socialUrl instead) — a real, structural, free win, NOT
// something that generalises to other sources: ofsted report pages carry no outbound business link at all;
// cis/ciw/haf sourceUrl values are generic programme/search pages (identical across every lead from that
// source, not a per-provider page); playwaze/pebble/eequ pages are self-contained booking-platform pages with
// no outbound site (those leads genuinely have no separate website). Checked directly, not assumed — see the
// investigation notes for 16 Sept 2026. Only fsni gets this treatment.
//
//   node scripts/leads/fsni_extract_websites.mjs [--limit N] [--conc 5] [--apply]     (from server/)
//
// Two-phase like the rest of this pipeline: a plain run fetches + writes scripts/leads/out/fsni_websites.out.jsonl
// (resumable — already-processed ids are skipped), --apply reads that file and batch-writes Firestore. A lead
// that already has BOTH website and socialUrl is fetched anyway (cheap, single page) so mismatches can be
// reported, but apply only ever fills an EMPTY field — it never overwrites an existing website or socialUrl.
import "dotenv/config"; import admin from "firebase-admin"; import fs from "fs"; import path from "path";
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync("./serviceAccountKey.json", "utf8"))) });
const db = admin.firestore();
const args = Object.fromEntries(process.argv.slice(2).map((a, i, arr) => a.startsWith("--") ? [a.slice(2), arr[i + 1] && !arr[i + 1].startsWith("--") ? arr[i + 1] : true] : []).filter(x => x.length));
const LIMIT = args.limit ? +args.limit : Infinity;
const CONC = args.conc ? +args.conc : 5;
const GAP_MS = args.gap ? +args.gap : 300;
const OUT = path.resolve("scripts/leads/out/fsni_websites.out.jsonl");
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const SOCIAL_RX = /facebook\.com|instagram\.com|twitter\.com|x\.com|linktr\.ee|linkedin\.com/i;
const WEBSITE_BTN_RX = /<a href="(https?:\/\/[^"]+)" target="_blank" class="btn-xs btn-info "><span class="glyphicon glyphicon-home"[^>]*><\/span>\s*Visit Website<\/a>/i;

if (args.apply) {
  const rows = fs.readFileSync(OUT, "utf8").split("\n").filter(Boolean).map(l => JSON.parse(l));
  const ids = rows.map(r => r.id);
  const cur = new Map();
  for (let i = 0; i < ids.length; i += 300) {
    const snaps = await db.getAll(...ids.slice(i, i + 300).map(id => db.collection("leads").doc(id)), { fieldMask: ["website", "socialUrl"] });
    for (const s of snaps) if (s.exists) cur.set(s.id, s.data());
  }
  let websiteSet = 0, socialSet = 0, mismatchWebsite = 0, mismatchSocial = 0, skippedAlreadyFilled = 0;
  let batch = db.batch(), inB = 0;
  const mismatches = [];
  for (const r of rows) {
    if (!r.url) continue;
    const c = cur.get(r.id);
    if (!c) continue;
    const isSocial = SOCIAL_RX.test(r.url);
    const upd = {};
    if (isSocial) {
      if (!c.socialUrl) { upd.socialUrl = r.url; upd.socialFrom = "FSNI directory listing — embedded 'Visit Website' link (fsni_extract_websites.mjs, page fetch, no search)"; }
      else if (c.socialUrl !== r.url) { mismatchSocial++; mismatches.push({ id: r.id, name: r.name, field: "socialUrl", have: c.socialUrl, found: r.url }); }
    } else {
      if (!c.website) { upd.website = r.url; upd.websiteFoundBy = "FSNI directory listing — embedded 'Visit Website' link (fsni_extract_websites.mjs, page fetch, no search)"; upd.websiteVerifiedAt = new Date().toISOString(); }
      else if (c.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "") !== r.url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")) { mismatchWebsite++; mismatches.push({ id: r.id, name: r.name, field: "website", have: c.website, found: r.url }); }
    }
    if (Object.keys(upd).length) {
      batch.update(db.collection("leads").doc(r.id), upd); inB++;
      if (isSocial) socialSet++; else websiteSet++;
      if (inB >= 400) { await batch.commit(); batch = db.batch(); inB = 0; }
    } else if (!isSocial ? c.website : c.socialUrl) skippedAlreadyFilled++;
  }
  if (inB) await batch.commit();
  fs.writeFileSync(path.resolve("scripts/leads/out/fsni_websites.mismatches.json"), JSON.stringify(mismatches, null, 2));
  console.log(JSON.stringify({ websiteSet, socialSet, mismatchWebsite, mismatchSocial, skippedAlreadyFilled, mismatchesFile: "scripts/leads/out/fsni_websites.mismatches.json" }, null, 2));
  process.exit(0);
}

const done = new Set(fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8").split("\n").filter(Boolean).map(l => { try { return JSON.parse(l).id; } catch { return null; } }) : []);
const snap = await db.collection("leads").where("source", "==", "fsni").select("name", "sourceUrl", "website", "socialUrl").get();
const todo = snap.docs.filter(d => !done.has(d.id) && /familysupportni\.gov\.uk\/Search\/Details\/\d+/.test(String(d.data().sourceUrl || ""))).slice(0, LIMIT);
console.log("to fetch", todo.length, "(already done", done.size, ") of", snap.size, "total fsni leads");
const out = fs.createWriteStream(OUT, { flags: "a" });
let i = 0, found = 0, social = 0, err = 0;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function one(d) {
  const l = d.data();
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const r = await fetch(l.sourceUrl, { signal: ctrl.signal, headers: { "user-agent": UA, accept: "text/html" } });
    const html = await r.text();
    const m = html.match(WEBSITE_BTN_RX);
    const url = m ? m[1] : null;
    if (url) { if (SOCIAL_RX.test(url)) social++; else found++; }
    out.write(JSON.stringify({ id: d.id, name: l.name, sourceUrl: l.sourceUrl, status: r.status, url }) + "\n");
  } catch (e) { err++; out.write(JSON.stringify({ id: d.id, name: l.name, sourceUrl: l.sourceUrl, status: 0, url: null, err: String(e?.name || e).slice(0, 40) }) + "\n"); }
  finally { clearTimeout(t); }
}
for (let k = 0; k < todo.length; k += CONC) {
  await Promise.all(todo.slice(k, k + CONC).map(one));
  i += Math.min(CONC, todo.length - k);
  if (i % 200 < CONC) console.log(i, "fetched,", found, "websites,", social, "social,", err, "errors");
  await sleep(GAP_MS);
}
out.end();
console.log(JSON.stringify({ fetched: i, websitesFound: found, socialFound: social, errors: err }));
process.exit(0);
