// A ClassForKids / Bookwhen / ClubSpark / Pebble / eequ page stored as `website` is their BOOKING page, not a
// website: move it to bookingUrl + bookingSystem so the Platform filter and "Has website" both tell the truth.
//   node scripts/leads/booking_urls.mjs [--apply]     (from server/)
import admin from "firebase-admin"; import fs from "fs";
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync("./serviceAccountKey.json","utf8"))) });
const db = admin.firestore(); const APPLY = process.argv.includes("--apply"); const D = admin.firestore.FieldValue.delete();
const SYSTEMS = [["ClassForKids", /classforkids\.io$/i], ["Bookwhen", /bookwhen\.com$/i], ["ClubSpark", /clubspark\.(net|lta\.org\.uk)$/i], ["Pebble", /(bookpebble\.co\.uk|pebble\.co)$/i], ["eequ", /eequ\.org$/i], ["Playwaze", /playwaze\.com$/i], ["Yellow Days", /yellowdays/i], ["Coordinate", /coordinate\.cloud$/i], ["HolidayActivities", /holidayactivities\.com$/i], ["Hoop", /hoop\.co\.uk$/i], ["Football Foundation", /footballfoundation\.org\.uk$/i], ["Kidzcamp", /kidzcamp/i]];
const host = (u) => { try { return new URL(/^https?:/.test(u)?u:"https://"+u).hostname.replace(/^www\./,"").toLowerCase(); } catch { return ""; } };
const snap = await db.collection("leads").select("website","bookingUrl","bookingSystem","excluded").get(); let n = 0; const by = {}; let batch = db.batch(), inB = 0;
for (const d of snap.docs) { const x = d.data(); if (x.excluded || !x.website) continue; const h = host(x.website); const sys = SYSTEMS.find(([, re]) => re.test(h)); if (!sys) continue; n++; by[sys[0]] = (by[sys[0]]||0)+1;
  if (APPLY) { const url = /^https?:/.test(x.website) ? x.website : "https://" + x.website; batch.update(d.ref, { website: D, websiteFoundBy: D, websiteDown: D, ...(x.bookingUrl ? {} : { bookingUrl: url, bookingFrom: "was stored as website (booking_urls.mjs)" }), ...(x.bookingSystem ? {} : { bookingSystem: sys[0] }), bookingChecked: true }); if (++inB >= 400) { await batch.commit(); batch = db.batch(); inB = 0; } } }
if (APPLY && inB) await batch.commit(); console.log(JSON.stringify({ moved: n, applied: APPLY, by })); process.exit(0);
