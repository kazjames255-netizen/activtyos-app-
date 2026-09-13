// A Facebook/Instagram/Linktree/etc page is not a website: move such `website` values to `socialUrl` so
// "Has website" means a real site, while the card still links the page.   node scripts/leads/social_urls.mjs [--apply]
import admin from "firebase-admin"; import fs from "fs";
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync("./serviceAccountKey.json","utf8"))) });
const db = admin.firestore(); const APPLY = process.argv.includes("--apply");
const SOCIAL = /^(www\.|m\.|en-gb\.|business\.)?(facebook\.com|fb\.com|instagram\.com|linktr\.ee|twitter\.com|x\.com|tiktok\.com|youtube\.com|youtu\.be|linkedin\.com|threads\.net|pinterest\.co\.uk|pinterest\.com|nextdoor\.co\.uk|sites\.google\.com|google\.com|goo\.gl|g\.page|wa\.me|whatsapp\.com)$/i;
const host = (u) => { try { return new URL(/^https?:/.test(u)?u:"https://"+u).hostname.toLowerCase(); } catch { return ""; } };
const snap = await db.collection("leads").select("website","socialUrl","excluded").get(); let n=0; let batch=db.batch(), inB=0; const byHost={};
for (const d of snap.docs) { const x=d.data(); if (!x.website) continue; const h=host(x.website); if (!SOCIAL.test(h)) continue; byHost[h]=(byHost[h]||0)+1; n++;
  if (APPLY) { batch.update(d.ref, { socialUrl: x.website, website: admin.firestore.FieldValue.delete(), websiteFoundBy: admin.firestore.FieldValue.delete(), websiteDown: admin.firestore.FieldValue.delete(), websiteMovedToSocialAt: new Date().toISOString() }); if (++inB>=400) { await batch.commit(); batch=db.batch(); inB=0; } } }
if (APPLY && inB) await batch.commit(); console.log(JSON.stringify({ socialAsWebsite: n, applied: APPLY, byHost })); process.exit(0);
