// Overnight prep pass — drafts personalized outreach emails onto Firestore lead docs
// for human review in the morning. Does NOT send anything, does NOT touch `status`.
// Writes: draftOutreach: { subject, body, draftedAt }, outreachStatus: "drafted-pending-review"
//
// Scope: status === "new" leads with a confirmed DIRECT business email — i.e. the `email`
// field is set, it was NOT sourced from a register/charity/gov listing (emailFrom host check),
// it's not a `secondaryContact`-only lead, and the email itself isn't a council (.gov.uk) or
// website-builder/platform support address.
//
// Usage: node scripts/leads/overnight_draft_outreach.mjs [--apply] [--limit N]
import admin from "firebase-admin"; import fs from "fs";
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync("./serviceAccountKey.json","utf8"))) });
const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });

const APPLY = process.argv.includes("--apply");
const LIMIT = (() => { const i = process.argv.indexOf("--limit"); return i > -1 ? Number(process.argv[i+1]) : Infinity; })();

const DEMO_URL = "https://app.activityos.uk/demo";

const REGISTER_EMAILFROM_HOSTS = /(charitycommission\.gov\.uk|companieshouse\.gov\.uk|company-information\.service\.gov\.uk|ofsted\.gov\.uk|register-of-charities|\.gov\.uk|gov\.wales|careinspectorate)/i;
const PLATFORM_EMAIL_DOMAINS = new Set([
  "eequ.org","playwaze.com","bookpebble.co.uk","sentry.io","wixpress.com","wix.com","schema.org","w3.org",
  "google.com","gstatic.com","cloudflare.com","fontawesome.com","jquery.com","godaddy.com","example.com",
  "example.org","gravatar.com","wp.com","sentry-next.io","webador.com","squarespace.com","weebly.com",
  "shopify.com","mailchimp.com","godaddysites.com","site123.me","jimdo.com","strikingly.com","wordpress.com",
]);
const isGovEmail = (e) => /\.gov\.uk$/i.test(e.split("@")[1] || "") || /\.gov$/i.test(e.split("@")[1] || "");
const emailDomain = (e) => (e.split("@")[1] || "").toLowerCase();

function qualifies(x) {
  if (x.excluded) return false;
  if (!x.email) return false;
  if (x.secondaryContact && !x.email) return false; // n/a since email checked above, just guard
  const ef = x.emailFrom || "";
  if (ef && REGISTER_EMAILFROM_HOSTS.test(ef)) return false;
  const dom = emailDomain(x.email);
  if (!dom) return false;
  if (isGovEmail(x.email)) return false;
  if (PLATFORM_EMAIL_DOMAINS.has(dom)) return false;
  if (/^(noreply|no-reply|donotreply|webmaster|postmaster)@/i.test(x.email)) return false;
  if (dom === "activityos.uk" || dom === "activityos.local") return false;
  return true;
}

// ── copy generation ─────────────────────────────────────────────────────
const CHILDCARE_TYPES = new Set(["nursery","preschool","wraparound","holiday","childminder"]);

const JUNK_TOWN = /^(gb|uk|united kingdom|england|scotland|wales|northern ireland)$/i;
function townOf(x) {
  // location is often "Town · POSTCODE" or "N sites · TownA, TownB" — take a clean first token.
  const loc = String(x.location || "");
  const m = loc.match(/^([A-Za-z' -]+?)(?:\s*·|\s*,|$)/);
  const cand = m && m[1] ? m[1].trim() : "";
  if (cand && !/^\d+ sites?$/i.test(cand) && !JUNK_TOWN.test(cand)) return cand;
  const county = String(x.county || "");
  if (county && !JUNK_TOWN.test(county)) return county;
  const region = String(x.region || "");
  if (region && !JUNK_TOWN.test(region)) return region;
  return "";
}

function activityPhrase(x) {
  const raw = (x.sport || x.providerType || "").trim();
  if (!raw) return "activity";
  // childcare-style descriptions already read naturally, e.g. "Nursery / day care"
  if (/nursery|day care|playgroup|pre-?school|childcare|wraparound|breakfast|after-?school|holiday club|holiday scheme/i.test(raw)) {
    return raw.replace(/\s*\/\s*/g, "/").toLowerCase();
  }
  return raw; // a sport name, e.g. "Cricket", "Rugby Union"
}

function specificDetail(x, town) {
  const noBooking = !x.bookingSystem && !x.bookingUrl && (x.bookingChecked || x.websiteCheckedAt);
  const multiSite = x.siteSignals?.multiSite === true || (x.ofstedSites && x.ofstedSites > 1);
  if (multiSite) {
    const n = x.ofstedSites || 2;
    return `I noticed you're running ${n > 1 ? `${n} sites` : "more than one site"}${town ? ` around ${town}` : ""} — juggling bookings across locations by hand is exactly the kind of thing that gets painful fast.`;
  }
  if (noBooking && x.website) {
    return `I had a look at your site and didn't spot an online booking system — if you're still taking bookings by phone/email, that's usually the first thing worth fixing.`;
  }
  if (x.bookingSystem) {
    return `Looks like you're already using ${x.bookingSystem} for bookings — no complaints there, just flagging us as an option if you ever outgrow it or want everything (bookings, registers, payments) in one place.`;
  }
  return "";
}

const SUBJECTS = [
  (name) => `Quick one for ${name}`,
  (name) => `${name} — a quick question about bookings`,
  (name) => `For ${name}, no strings attached`,
];

function draftFor(x) {
  const name = x.name || x.business || "there";
  const town = townOf(x);
  const activity = activityPhrase(x);
  const detail = specificDetail(x, town);
  const idx = (String(x._id || "").split("").reduce((a,c)=>a+c.charCodeAt(0),0)) % SUBJECTS.length;
  const subject = SUBJECTS[idx](name);

  const openerLoc = town ? ` in ${town}` : "";
  const whatWeDo = activity && activity !== "activity"
    ? `I came across ${name} while looking at ${activity} providers${openerLoc}.`
    : `I came across ${name}${openerLoc}.`;

  const body = [
    `Hi there,`,
    ``,
    whatWeDo,
    detail || null,
    ``,
    `I'm reaching out from ActivityOS — we build booking, registers and payments software for activity and childcare providers. Not trying to oversell it: if it's not useful to you right now, no worries at all.`,
    ``,
    `If you ever want a look, you can book a short demo here, no obligation: ${DEMO_URL}`,
    ``,
    `Either way, best of luck with ${name}.`,
    ``,
    `The ActivityOS team`,
  ].filter((l) => l !== null).join("\n");

  return { subject, body };
}

// ── main ────────────────────────────────────────────────────────────────
console.log("mode:", APPLY ? "APPLY (writing to Firestore)" : "DRY RUN (no writes)", "limit:", LIMIT);
const snap = await db.collection("leads").where("status", "==", "new").get();
console.log("status=new leads:", snap.size);

let qualifying = 0, alreadyDrafted = 0, written = 0, skippedQuality = 0;
const byActivity = {};
const samples = [];
let batch = db.batch(), inBatch = 0;
const flush = async () => { if (inBatch && APPLY) await batch.commit(); batch = db.batch(); inBatch = 0; };

for (const d of snap.docs) {
  if (written >= LIMIT) break;
  const x = { _id: d.id, ...d.data() };
  if (x.draftOutreach) { alreadyDrafted++; continue; }
  if (!qualifies(x)) { if (x.email) skippedQuality++; continue; }
  qualifying++;
  const { subject, body } = draftFor(x);
  const cat = activityPhrase(x) || "unknown";
  byActivity[cat] = (byActivity[cat] || 0) + 1;

  if (APPLY) {
    batch.update(d.ref, {
      draftOutreach: { subject, body, draftedAt: new Date().toISOString() },
      outreachStatus: "drafted-pending-review",
    });
    inBatch++;
    if (inBatch >= 400) await flush();
  }
  written++;
  if (samples.length < 60) samples.push({ id: d.id, name: x.name, email: x.email, town: townOf(x), activity: cat, subject, body });
}
await flush();

console.log(JSON.stringify({ apply: APPLY, statusNewTotal: snap.size, alreadyDrafted, skippedQuality_hadEmailButExcluded: skippedQuality, qualifyingSeen: qualifying, written }, null, 2));
console.log("by activity (top 20):", JSON.stringify(Object.fromEntries(Object.entries(byActivity).sort((a,b)=>b[1]-a[1]).slice(0,20)), null, 2));
fs.writeFileSync("scripts/leads/out/overnight_draft_samples.json", JSON.stringify(samples, null, 2));
console.log("wrote sample file: scripts/leads/out/overnight_draft_samples.json (", samples.length, "samples )");
process.exit(0);
