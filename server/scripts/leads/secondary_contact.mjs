// Find a secondary (indirect) contact route for leads with NO email/phone/website/socialUrl at all.
// Two free sources, no Brave spend:
//  1. HAF-listed leads already carry `hafFrom` (council HAF page / directory URL) and `hafProgramme` from
//     merge_haf.mjs / haf_eequ.mjs — unused as a contact route. Falls back to `sourceUrl` if hafFrom isn't a URL.
//  2. Any lead's `sourceUrl` (the register/directory/booking page saved at import) is re-fetched (plain GET,
//     cached to out/secondary-contact-cache/) and scanned for an email/phone the importer missed.
// Quality control: booking-platform and directory pages (Playwaze, eequ, Pebble, Ofsted, the NI/Wales
// registers…) render the SAME template phone/email on every listing — a first pass over real data caught
// this (e.g. "0910164416" on every Playwaze page, "enquiries@ofsted.gov.uk" on every Ofsted report). So any
// extracted value is tallied by how many DIFFERENT source URLs it appears on: a value repeated across 3+
// URLs is a template artifact, not this provider's own contact, and is dropped — UNLESS it's a genuine
// council (.gov.uk) email, in which case a shared address is expected (it's the council's HAF/programme team,
// correctly labelled "council-haf-programme" either way) and is kept. A short explicit denylist covers known
// national register enquiry addresses (Ofsted, Family Support NI, Care Inspectorate Wales) that are never a
// useful route to a specific provider even when they only appear once.
// Writes secondaryContact / secondaryContactType / secondaryContactNote. Never overwrites an existing value.
// Usage: node scripts/leads/secondary_contact.mjs [--apply] [--limit N]
import admin from "firebase-admin"; import fs from "fs"; import path from "path"; import crypto from "crypto";
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync("./serviceAccountKey.json","utf8"))) });
const db = admin.firestore();
const APPLY = process.argv.includes("--apply");
const LIMIT = (() => { const i = process.argv.indexOf("--limit"); return i > -1 ? Number(process.argv[i+1]) : Infinity; })();
const CACHE = "scripts/leads/out/secondary-contact-cache"; fs.mkdirSync(CACHE, { recursive: true });

const isUrl = (s) => { try { const u = new URL(s); return u.protocol === "http:" || u.protocol === "https:"; } catch { return false; } };
const clean = (s) => String(s || "").replace(/\s+/g, " ").trim();
const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, "").toLowerCase(); } catch { return ""; } };

// ── email / phone extraction ──────────────────────────────────────────────
const EMAIL_RE = /[a-zA-Z0-9.\-_+]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
const PLATFORM_EMAIL_DOMAINS = new Set(["eequ.org", "playwaze.com", "bookpebble.co.uk", "sentry.io", "wixpress.com", "schema.org", "w3.org", "google.com", "gstatic.com", "cloudflare.com", "fontawesome.com", "jquery.com", "godaddy.com", "example.com", "example.org", "gravatar.com", "wp.com", "sentry-next.io"]);
// National register / regulator hosts: any contact found here is the AUTHORITY's own enquiry line
// (Ofsted, Family Support NI, Care Inspectorate Wales…), never a route to the specific provider it lists.
const REGISTER_AUTHORITY_HOSTS = new Set(["reports.ofsted.gov.uk", "ofsted.gov.uk", "familysupportni.gov.uk", "www.familysupportni.gov.uk", "careinspectorate.wales", "careinspectorate.com", "gov.wales"]);
function allEmails(text) {
  return [...new Set((text.match(EMAIL_RE) || []).map((e) => e.toLowerCase()))]
    .filter((e) => !PLATFORM_EMAIL_DOMAINS.has(e.split("@")[1] || ""))
    .filter((e) => !/^(noreply|no-reply|donotreply|webmaster|postmaster)@/.test(e))
    .filter((e) => !/\.(png|jpg|jpeg|gif|svg|webp)$/i.test(e))
    .filter((e) => e.length <= 60);
}
const PHONE_RE = /\b(?:\+44[\s.-]?\(?0?\)?[\s.-]?|0)(?:\d[\s.-]?){9,10}\b/g;
function allPhones(text) {
  const out = new Set();
  for (const m of text.match(PHONE_RE) || []) {
    let digits = m.replace(/[^\d+]/g, "");
    if (digits.startsWith("+44")) digits = "0" + digits.slice(3);
    if (/^0\d{9,10}$/.test(digits) && digits.length >= 10 && digits.length <= 11) out.add(digits);
  }
  return [...out];
}
const isGovEmail = (e) => /\.gov\.uk$/i.test(e.split("@")[1] || "");

// ── leads with zero contact ───────────────────────────────────────────────
const snap = await db.collection("leads").get();
const zero = [];
for (const d of snap.docs) { const x = d.data(); if (x.excluded) continue;
  if (x.email || x.phone || x.website || x.socialUrl) continue;
  zero.push({ id: d.id, ...x }); }
console.log("zero-contact leads:", zero.length);

// ── unique URLs worth (re-)fetching: sourceUrl, plus hafFrom when it differs ──
const urls = new Set();
for (const l of zero.slice(0, LIMIT)) {
  if (isUrl(l.sourceUrl)) urls.add(l.sourceUrl);
  if (isUrl(l.hafFrom) && l.hafFrom !== l.sourceUrl) urls.add(l.hafFrom);
}
console.log("unique URLs to fetch:", urls.size);
// How many zero-contact LEADS share the same sourceUrl? A page that's the source for 2+ different
// providers (a council finder page, a booking-calendar link) is a shared listing — any contact found
// there is a general/council route, not that one provider's own line, however specific the URL looks.
const leadsPerSourceUrl = new Map();
for (const l of zero.slice(0, LIMIT)) if (isUrl(l.sourceUrl)) leadsPerSourceUrl.set(l.sourceUrl, (leadsPerSourceUrl.get(l.sourceUrl) || 0) + 1);

const hash = (u) => crypto.createHash("sha1").update(u).digest("hex").slice(0, 16);
const uaHeaders = { headers: { "user-agent": "Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/124.0 Safari/537.36" } };
const pageText = new Map();
let fetched = 0, cached = 0, failed = 0;
async function fetchOne(u) {
  const f = path.join(CACHE, hash(u) + ".txt");
  if (fs.existsSync(f)) { pageText.set(u, fs.readFileSync(f, "utf8")); cached++; return; }
  try { const r = await fetch(u, { ...uaHeaders, signal: AbortSignal.timeout(9000) }); const t = await r.text(); fs.writeFileSync(f, t); pageText.set(u, t); fetched++; }
  catch { pageText.set(u, ""); failed++; }
}
const urlList = [...urls]; const CONC = 12;
for (let i = 0; i < urlList.length; i += CONC) { await Promise.all(urlList.slice(i, i + CONC).map(fetchOne)); if (i % 120 === 0) console.log("fetched", i, "/", urlList.length); }
console.log(JSON.stringify({ fetched, cached, failed }));

// ── per-URL candidates, then a frequency pass to strip template artifacts ──
// candidatesByUrl: url -> { emails: string[], phones: string[] } (register-authority hosts excluded outright)
// A bare platform homepage (no listing-specific path) can't contain any particular provider's info —
// whatever contact text sits there is the platform's own, not evidence about who it's the sourceUrl for.
const BOOKING_PLATFORM_HOSTS = new Set(["eequ.org", "playwaze.com", "bookpebble.co.uk", "activities.bookpebble.co.uk"]);
const isBarePlatformRoot = (u) => { try { const p = new URL(u); return BOOKING_PLATFORM_HOSTS.has(p.hostname.replace(/^www\./, "")) && (p.pathname === "/" || p.pathname === ""); } catch { return false; } };
const candidatesByUrl = new Map();
for (const [u, text] of pageText.entries()) {
  if (!text || REGISTER_AUTHORITY_HOSTS.has(hostOf(u)) || isBarePlatformRoot(u)) { candidatesByUrl.set(u, { emails: [], phones: [] }); continue; }
  candidatesByUrl.set(u, { emails: allEmails(text), phones: allPhones(text) });
}
// How many DISTINCT urls does each value appear on?
const urlsForValue = new Map();
for (const [u, c] of candidatesByUrl.entries()) for (const v of [...c.emails, ...c.phones]) { if (!urlsForValue.has(v)) urlsForValue.set(v, new Set()); urlsForValue.get(v).add(u); }
const DUP_THRESHOLD = 3;
const isTemplateArtifact = (v) => !isGovEmail(v) && (urlsForValue.get(v)?.size ?? 0) >= DUP_THRESHOLD;
// Pick the best usable value for a URL: first non-gov "real" email/phone that isn't a template artifact,
// but a repeated .gov.uk email is kept (and flagged as a shared council contact, not discarded).
function bestFor(u) {
  const c = candidatesByUrl.get(u); if (!c) return null;
  for (const e of c.emails) if (!isTemplateArtifact(e)) return { value: e, shared: urlsForValue.get(e).size >= DUP_THRESHOLD };
  for (const p of c.phones) if (!isTemplateArtifact(p)) return { value: p, shared: urlsForValue.get(p).size >= DUP_THRESHOLD };
  return null;
}

// ── assign secondaryContact per lead ──────────────────────────────────────
let bySourceUrl = 0, byHaf = 0, deadEnd = 0; const samples = [];
let batch = db.batch(), inB = 0; const flush = async () => { if (inB && APPLY) await batch.commit(); batch = db.batch(); inB = 0; };
const byType = {};
for (const l of zero.slice(0, LIMIT)) {
  if (l.secondaryContact) continue; // already set by an earlier run
  let update = null;

  // 1. re-fetch of this lead's own sourceUrl
  const found = isUrl(l.sourceUrl) ? bestFor(l.sourceUrl) : null;
  if (found) {
    const host = hostOf(l.sourceUrl);
    // A .gov.uk address is inherently a council team mailbox; a page that's the sourceUrl for 2+
    // different leads is a shared finder/calendar page — either way this isn't the provider's own line.
    const shared = found.shared || isGovEmail(found.value) || (leadsPerSourceUrl.get(l.sourceUrl) || 0) >= 2;
    if (shared) {
      update = { secondaryContact: found.value, secondaryContactType: "council-haf-programme",
        secondaryContactNote: `No direct contact found for this provider — this is a shared contact (${host}) that lists/coordinates them and other providers, not the provider's own line. Enquire via the council to reach them.` };
    } else {
      update = { secondaryContact: found.value, secondaryContactType: "sourceUrl-refetch",
        secondaryContactNote: `Found by re-fetching the original listing page (${host}) — wasn't captured when this lead was first imported.` };
    }
    bySourceUrl++;
  }

  // 2. HAF fallback — council HAF programme page itself as an indirect route (no email/phone found, but a page to enquire through)
  if (!update && l.hafLocalAuthority) {
    const url = isUrl(l.hafFrom) ? l.hafFrom : (isUrl(l.sourceUrl) ? l.sourceUrl : null);
    if (url) {
      const la = clean(l.hafLocalAuthority).split("; ")[0];
      update = { secondaryContact: url, secondaryContactType: "council-haf-programme",
        secondaryContactNote: `No direct contact found for this provider — this is the ${la} Council${l.hafProgramme ? ` "${clean(l.hafProgramme)}"` : " HAF"} programme page that lists them. Not a direct line to the provider; enquire via the council to reach them.` };
      byHaf++;
    }
  }

  if (update) { byType[update.secondaryContactType] = (byType[update.secondaryContactType] || 0) + 1;
    if (update.secondaryContactType === "sourceUrl-refetch" && samples.length < 40) samples.push({ id: l.id, name: l.name, sourceUrl: l.sourceUrl, found: update.secondaryContact });
    if (APPLY) batch.update(db.collection("leads").doc(l.id), { ...update, secondaryContactAt: new Date().toISOString() });
    inB++; if (inB >= 400) await flush(); }
  else deadEnd++;
}
await flush();
console.log(JSON.stringify({ apply: APPLY, zeroContact: zero.length, bySourceUrl, byHaf, byType, remainingDeadEnd: deadEnd }));
console.log("SAMPLES (sourceUrl-refetch):", JSON.stringify(samples, null, 1));
process.exit(0);
