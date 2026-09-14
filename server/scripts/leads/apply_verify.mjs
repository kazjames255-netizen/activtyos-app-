// Apply website verification verdicts. Candidates: confirm / keep / drop. Confirmed sites: demote when the site isn't a children's business.
import admin from "firebase-admin"; import fs from "fs";
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync("./serviceAccountKey.json","utf8"))) });
const db = admin.firestore(); const FILE = process.argv[2]; const DONE = FILE + ".applied";
const done = new Set(fs.existsSync(DONE) ? fs.readFileSync(DONE,"utf8").split("\n").filter(Boolean) : []);
const rows = fs.readFileSync(FILE,"utf8").split("\n").filter(Boolean).map(l=>JSON.parse(l)).filter(r=>!done.has(r.id) && !done.has(r.id+"|"+r.url));
const cur = new Map(); for (let i=0;i<rows.length;i+=300) { const snaps = await db.getAll(...rows.slice(i,i+300).map(r=>db.collection("leads").doc(r.id)), { fieldMask:["bookingSystem"] }); snaps.forEach(s=>cur.set(s.id, s.exists ? s.data() : {})); }
const D = admin.firestore.FieldValue.delete; let batch=db.batch(), n=0; const c={}; const bump=(k)=>c[k]=(c[k]||0)+1; const flush=async()=>{ if(n){await batch.commit(); batch=db.batch(); n=0;} };
const why = (r) => r.sector==="parked" ? "parked / for-sale domain" : r.sector==="other-sector" ? `a different kind of business (${(r.notTerms||[]).slice(0,3).join(", ")})` : r.sector==="empty" ? "empty or placeholder site" : r.verdict==="unreachable" ? "site unreachable" : !r.nameOk ? "their name isn't on the site" : r.sector!=="child" ? "no children's-activity wording on the site" : !r.locOk ? "their town/postcode isn't on the site" : "no children's-activity wording on the site";
for (const r of rows) { const ref = db.collection("leads").doc(r.id); const stamp = new Date().toISOString(); let upd=null;
  if (r.kind==="candidate") {
    if (r.verdict==="confirm" || r.verdict==="confirm-weak") { upd = { website: r.final || r.url, websiteFoundBy: `verified 13 Sept 2026: name + ${r.locHits?.[0]||"location"} + children's wording on the site`, websiteCandidate: D(), websiteCandidateWhy: D() }; bump("candidate→confirmed"); }
    else if (r.verdict==="keep-candidate") { upd = { websiteCandidateWhy: `name matches, children's business, but ${!r.locOk ? "their town/postcode wasn't seen on it" : "only part of the name matched"}` }; bump("candidate kept"); }
    else { upd = { websiteCandidate: D(), websiteCandidateWhy: D(), websiteRejected: r.url, websiteRejectedWhy: why(r) }; bump("candidate dropped: "+why(r).split(" (")[0]); }
  } else { // confirmed website
    if (r.verdict==="unreachable") {
      // Only a HARD failure means the site is gone: no DNS, connection refused, 404/410, junk URL.
      // 403 / 429 / 5xx / timeouts / TLS quirks are bot walls or blips — leave the lead alone.
      const hard = [404, 410].includes(r.status) || ["ENOTFOUND","ECONNREFUSED","ENETUNREACH","ERR_INVALID_URL"].includes(String(r.err||""));
      if (hard) { upd = { websiteDown: true, websiteDownWhy: r.status ? `HTTP ${r.status}` : String(r.err) }; bump("confirmed: down (flagged)"); }
      else bump("confirmed: unreachable but not flagged (blocked/transient)");
    }
    else if (r.sector==="other-sector" || r.sector==="parked") { upd = { website: D(), websiteCandidate: r.url, websiteCandidateWhy: `demoted 13 Sept 2026: looks like ${why(r)}` , websiteFoundBy: D() }; bump("confirmed→demoted: "+r.sector); }
    else if (r.sector==="empty") { bump("confirmed: near-empty page (JS site?) — left alone"); }
    else if ((r.sector==="no-signal") && !r.nameOk) { upd = { website: D(), websiteCandidate: r.url, websiteCandidateWhy: "demoted 13 Sept 2026: neither their name nor any children's wording is on the site", websiteFoundBy: D() }; bump("confirmed→demoted: no name, no signal"); }
    else { upd = { websiteDown: D(), websiteDownWhy: D() }; bump("confirmed ok"); if (r.comingSoon && r.nameOk && (r.textLen ?? 0) > 1500) { upd.comingSoon = false; upd.comingSoonCleared = `re-checked ${stamp.slice(0,10)}: a real site with their name on it (${r.textLen} chars of text)`; bump("coming-soon cleared"); } else if (r.comingSoon) bump("coming-soon kept"); }
    if (r.sector==="parked" && r.comingSoon) bump("coming-soon kept (parked)");
  }
  if (!upd) upd = {};
  // Booking platform seen in the same fetch (verify_sites bookingOn): fill it on a site we accept; a site with no booking link is "checked, enquiry only".
  const accepted = (r.kind==="candidate" && (r.verdict==="confirm" || r.verdict==="confirm-weak")) || (r.kind!=="candidate" && r.verdict!=="unreachable" && upd.website === undefined);
  if (accepted && "booking" in r) { const have = cur.get(r.id)?.bookingSystem; if (r.booking && !have) { upd.bookingSystem = r.booking.system; upd.bookingUrl = /^https?:/.test(r.booking.url) ? r.booking.url : (r.final || r.url); upd.bookingFrom = `site crawl ${stamp.slice(0,10)} (verifier)`; bump("booking platform found: "+r.booking.system); } if (!r.booking && !have) { upd.bookingChecked = true; bump("booking: none seen (enquiry only)"); } }
  upd.websiteCheckedAt = stamp; upd.updatedAt = stamp; batch.update(ref, upd); n++; if (n>=400) await flush();
}
await flush(); fs.appendFileSync(DONE, rows.map(r=>r.id+"|"+r.url+"\n").join("")); console.log(JSON.stringify(c)); process.exit(0);
