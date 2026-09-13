// Apply website verification verdicts. Candidates: confirm / keep / drop. Confirmed sites: demote when the site isn't a children's business.
import admin from "firebase-admin"; import fs from "fs";
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync("./serviceAccountKey.json","utf8"))) });
const db = admin.firestore(); const FILE = process.argv[2]; const DONE = FILE + ".applied";
const done = new Set(fs.existsSync(DONE) ? fs.readFileSync(DONE,"utf8").split("\n").filter(Boolean) : []);
const rows = fs.readFileSync(FILE,"utf8").split("\n").filter(Boolean).map(l=>JSON.parse(l)).filter(r=>!done.has(r.id));
const D = admin.firestore.FieldValue.delete; let batch=db.batch(), n=0; const c={}; const bump=(k)=>c[k]=(c[k]||0)+1; const flush=async()=>{ if(n){await batch.commit(); batch=db.batch(); n=0;} };
const why = (r) => r.sector==="parked" ? "parked / for-sale domain" : r.sector==="other-sector" ? `a different kind of business (${(r.notTerms||[]).slice(0,3).join(", ")})` : r.sector==="empty" ? "empty or placeholder site" : r.verdict==="unreachable" ? "site unreachable" : !r.nameOk ? "their name isn't on the site" : !r.locOk ? "their town/postcode isn't on the site" : "no children's-activity wording on the site";
for (const r of rows) { const ref = db.collection("leads").doc(r.id); const stamp = new Date().toISOString(); let upd=null;
  if (r.kind==="candidate") {
    if (r.verdict==="confirm" || r.verdict==="confirm-weak") { upd = { website: r.final || r.url, websiteFoundBy: `verified 13 Sept 2026: name + ${r.locHits?.[0]||"location"} + children's wording on the site`, websiteCandidate: D(), websiteCandidateWhy: D() }; bump("candidate→confirmed"); }
    else if (r.verdict==="keep-candidate") { upd = { websiteCandidateWhy: `name matches, children's business, but ${!r.locOk ? "their town/postcode wasn't seen on it" : "only part of the name matched"}` }; bump("candidate kept"); }
    else { upd = { websiteCandidate: D(), websiteCandidateWhy: D(), websiteRejected: r.url, websiteRejectedWhy: why(r) }; bump("candidate dropped: "+why(r).split(" (")[0]); }
  } else { // confirmed website
    if (r.verdict==="unreachable") { upd = { websiteDown: true }; bump("confirmed: unreachable (flagged)"); }
    else if (r.sector==="other-sector" || r.sector==="parked") { upd = { website: D(), websiteCandidate: r.url, websiteCandidateWhy: `demoted 13 Sept 2026: looks like ${why(r)}` , websiteFoundBy: D() }; bump("confirmed→demoted: "+r.sector); }
    else if (r.sector==="empty") { upd = { websiteDown: true }; bump("confirmed: empty site (flagged)"); }
    else if ((r.sector==="no-signal") && !r.nameOk) { upd = { website: D(), websiteCandidate: r.url, websiteCandidateWhy: "demoted 13 Sept 2026: neither their name nor any children's wording is on the site", websiteFoundBy: D() }; bump("confirmed→demoted: no name, no signal"); }
    else bump("confirmed ok");
  }
  if (!upd) upd = {}; upd.websiteCheckedAt = stamp; upd.updatedAt = stamp; batch.update(ref, upd); n++; if (n>=400) await flush();
}
await flush(); fs.appendFileSync(DONE, rows.map(r=>r.id+"\n").join("")); console.log(JSON.stringify(c)); process.exit(0);
