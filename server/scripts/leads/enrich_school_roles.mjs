// GIAS schools role-contact enrichment (Step 6 of the schools pipeline, alongside enrich_schools.mjs's step 5):
// for every lead imported by import_gias.mjs / import_gias_state.mjs (identified by having a `giasUrn`), find
// their staff/key-staff page and pull named role-contacts — headteacher, Pupil Premium lead, inclusion lead,
// SENDCo (or a Designated Safeguarding Lead filling that role) — with a name and/or email where one's given.
// Best-effort: not every school publishes a staff list, and not every hit is guaranteed correctly attributed —
// see the UI hints in LeadsApp.tsx. Writes into `roleContacts`, fill-only (never replaces a role already found).
// Resumable + fill-only, and shardable for parallel runs: --shard i/N processes only the i-th of N equal slices of
// the (stably sorted) eligible id list, and writes to its OWN out file (scripts/leads/out/gias_roles.<i>-<N>.out.jsonl)
// so parallel shards never contend on the same resume-state file.
//   node scripts/leads/enrich_school_roles.mjs --shard 1/5 [--limit N]      (crawl + write JSONL rows)
//   node scripts/leads/enrich_school_roles.mjs --shard 1/5 --apply          (apply that shard's rows to Firestore)
import admin from "firebase-admin"; import fs from "fs"; import path from "path";
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync("./serviceAccountKey.json","utf8"))) });
const db = admin.firestore();
const args = Object.fromEntries(process.argv.slice(2).map((a,i,arr)=>a.startsWith("--")?[a.slice(2),arr[i+1]&&!arr[i+1].startsWith("--")?arr[i+1]:true]:[]).filter(x=>x.length));
const LIMIT = args.limit ? +args.limit : Infinity;
const [SHARD_I, SHARD_N] = String(args.shard || "1/1").split("/").map(Number);
if (!SHARD_I || !SHARD_N || SHARD_I < 1 || SHARD_I > SHARD_N) { console.log("bad --shard, expected e.g. --shard 2/5"); process.exit(1); }
const OUT = path.resolve(`scripts/leads/out/gias_roles.${SHARD_I}-${SHARD_N}.out.jsonl`);
const CONC = 8, TIMEOUT = 12000, MAXBYTES = 900_000;
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

// ── Fetch (same approach as enrich_schools.mjs) ─────────────────────────────
async function fetchSite(url, _noRetry = false) {
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const res = await fetch(url, { redirect: "follow", signal: ctrl.signal, headers: { "user-agent": UA, accept: "text/html,*/*;q=0.8", "accept-language": "en-GB,en;q=0.9" } });
    const final = res.url || url; if (res.status >= 400) return { status: res.status, final, html: "" };
    const reader = res.body?.getReader(); let got = 0, chunks = [];
    if (reader) { while (got < MAXBYTES) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); got += value.length; } try { reader.cancel(); } catch {} }
    return { status: res.status, final, html: Buffer.concat(chunks).toString("utf8") };
  } catch (e) {
    const err = String(e?.cause?.code || e?.name || e).slice(0, 60);
    if (!_noRetry && /SSL|TLS|CERT|ALTNAME|ISSUER|LEAF/i.test(err) && /^https:/i.test(url)) return fetchSite(url.replace(/^https:/i, "http:"), true);
    return { status: 0, final: url, html: "", err };
  } finally { clearTimeout(t); }
}

// ── Finding the staff page ──────────────────────────────────────────────────
const STAFF_PATH = /\/(staff|key-?staff|our-?staff|meet-?the-?staff|staff-?list|staff-?directory|our-?team|meet-?the-?team|our-?people|who-?we-?are|common-?room|school-?staff)(\/|\.|\?|-|$)/i;
const STAFF_LINK_TEXT = /\b(staff|key staff|our staff|our team|meet the (staff|team)|who we are|staff list|staff directory)\b/i;
const GUESS = ["/staff", "/key-staff", "/our-staff", "/meet-the-staff", "/meet-the-team", "/our-team", "/staff-list", "/staff-directory", "/about-us/staff", "/about/staff", "/school-life/staff", "/who-we-are/staff", "/who-we-are", "/common-room"];

function findStaffLinks(html, base) {
  const out = []; const origin = (() => { try { return new URL(base).hostname.replace(/^www\./, ""); } catch { return ""; } })();
  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]{0,120}?)<\/a>/gi)) {
    const href = m[1], text = m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (!STAFF_PATH.test(href) && !STAFF_LINK_TEXT.test(text)) continue;
    try { const u = new URL(href, base); if (u.hostname.replace(/^www\./, "") !== origin) continue; if (!out.includes(u.href)) out.push(u.href); } catch {}
  }
  return out.slice(0, 3);
}

// ── Text extraction that keeps each staff "row" together (a <tr> or <li>) but separates rows from each other —
//    unlike enrich_schools.mjs's flat `strip()`, name/title/email attribution needs that row boundary. ──────────
const decode = (s) => s.replace(/&#(\d+);/g, (m, n) => String.fromCharCode(+n)).replace(/&#x([0-9a-f]+);/gi, (m, h) => String.fromCharCode(parseInt(h, 16))).replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/&#39;|&apos;/g, "'");
function blocks(html) {
  const h = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(tr|li|p|h[1-6]|div)>/gi, "\n").replace(/<br\s*\/?>/gi, "\n");
  const withEmails = h.replace(/href=["']mailto:([^"'?]+)["']/gi, " $1 "); // keep the address in-line as text too
  const text = decode(withEmails).replace(/<[^>]+>/g, " ").replace(/[ \t]+/g, " ");
  return text.split("\n").map((l) => l.trim()).filter(Boolean);
}

// ── Role detection — full titles only, not a bare "head" (too ambiguous: "Head of Year", "Head Boy"…). The
//    SENDCo bucket also catches a Designated Safeguarding Lead, per the UI's own hint for that filter. ──────────
const ROLE_RX = [
  ["head", /\b(headteacher|headmaster|headmistress|head of school|principal|executive head(teacher)?)\b/i],
  ["pupilPremiumLead", /\bpupil premium (lead|co-?ordinator|champion)\b/i],
  ["inclusionLead", /\binclusion (lead|co-?ordinator|manager)\b/i],
  ["sendco", /\b(sendco|send co-?ordinator|special educational needs co-?ordinator|designated safeguarding lead)\b/i],
];
const EMAIL_RX = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const BAD_MAIL = /(example\.com|sentry|wixpress|wordpress|godaddy|noreply|no-reply|donotreply|privacy@|dmca@|schema\.org|w3\.org)/i;
// "Mrs J Smith" / "Mr John Smith" / "Dr A. Patel-Jones" — a title + 1-3 capitalised name tokens.
const NAME_RX = /\b(Mr|Mrs|Ms|Miss|Mx|Dr|Rev|Fr)\.?\s+[A-Z][a-zA-Z'’-]*(?:\.?\s+[A-Z][a-zA-Z'’-]+){0,2}\b/;

function rolesFromBlocks(lines) {
  const found = {};
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const [role, re] of ROLE_RX) {
      if (found[role] || !re.test(line)) continue;
      // Look in this line first, then the line before/after — a table row and its neighbour, or a heading
      // followed by a bio paragraph, commonly split name and title across adjacent blocks.
      const window = [line, lines[i - 1], lines[i + 1]].filter(Boolean).join(" | ");
      const nameM = window.match(NAME_RX);
      const emailM = [...window.matchAll(new RegExp(EMAIL_RX, "gi"))].map((m) => m[0]).find((e) => !BAD_MAIL.test(e));
      if (!nameM && !emailM) continue; // role title alone with no attributable name/email isn't useful
      found[role] = { name: nameM ? nameM[0].replace(/\s+/g, " ").trim() : undefined, email: emailM ? emailM.toLowerCase() : undefined };
    }
  }
  return found;
}

async function crawlOne(lead) {
  const base = /^https?:\/\//i.test(lead.website) ? lead.website : "https://" + lead.website;
  const home = await fetchSite(base);
  if (home.status !== 200 || !home.html) return { id: lead.id, status: home.status, err: home.err || "homepage unreachable", roles: {}, pagesRead: 0 };
  const links = findStaffLinks(home.html, home.final);
  let allLines = [], pagesRead = 0;
  for (const u of links) {
    const r = await fetchSite(u); if (r.status !== 200 || !r.html) continue;
    allLines.push(...blocks(r.html)); pagesRead++;
  }
  if (!pagesRead) { // no staff page found by link text/path — try guessed paths off the homepage origin
    try {
      const origin = new URL(home.final).origin;
      for (const p of GUESS.slice(0, 6)) {
        const r = await fetchSite(origin + p); if (r.status !== 200 || !r.html) continue;
        allLines.push(...blocks(r.html)); pagesRead++; if (pagesRead >= 2) break;
      }
    } catch {}
  }
  if (!pagesRead) return { id: lead.id, status: 200, err: "no staff page found", roles: {}, pagesRead: 0 };
  const roles = rolesFromBlocks(allLines);
  return { id: lead.id, status: 200, roles, pagesRead };
}

// ── Apply ────────────────────────────────────────────────────────────────
if (args.apply) {
  if (!fs.existsSync(OUT)) { console.log("no out file for this shard yet:", OUT); process.exit(0); }
  const rows = fs.readFileSync(OUT, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  const ids = rows.map((r) => r.id); const cur = new Map();
  for (let i = 0; i < ids.length; i += 300) { const snaps = await db.getAll(...ids.slice(i, i + 300).map((id) => db.collection("leads").doc(id)), { fieldMask: ["roleContacts"] }); for (const s of snaps) if (s.exists) cur.set(s.id, s.data()); }
  let batch = db.batch(), inB = 0; const c = {}; const bump = (k) => c[k] = (c[k] || 0) + 1; const stamp = new Date().toISOString();
  for (const r of rows) {
    const x = cur.get(r.id); if (!x) { bump("skipped: gone"); continue; }
    const roles = r.roles || {}; if (!Object.keys(roles).length) { bump("no roles found"); continue; }
    const existing = x.roleContacts || {}; const merged = { ...existing }; let added = 0;
    for (const [role, contact] of Object.entries(roles)) { if (!existing[role]) { merged[role] = contact; added++; bump(`${role} set`); } }
    if (!added) { bump("no new roles"); continue; }
    batch.update(db.collection("leads").doc(r.id), { roleContacts: merged, roleContactsFrom: "school site crawl (enrich_school_roles.mjs)", updatedAt: stamp }); inB++;
    if (inB >= 400) { await batch.commit(); batch = db.batch(); inB = 0; }
  }
  if (inB) await batch.commit();
  console.log("APPLIED shard", `${SHARD_I}/${SHARD_N}`, JSON.stringify(c));
  process.exit(0);
}

// ── Build this shard's todo list ────────────────────────────────────────
const snap = await db.collection("leads").select("giasUrn", "website", "roleContacts", "excluded").get();
const eligible = snap.docs.filter((d) => { const x = d.data(); return x.giasUrn && x.website && !x.excluded; }).map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.id < b.id ? -1 : 1);
const mine = eligible.filter((_, i) => i % SHARD_N === SHARD_I - 1);
const done = new Set(fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8").split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l).id; } catch { return null; } }) : []);
const ROLE_KEYS = ["head", "pupilPremiumLead", "inclusionLead", "sendco"];
const todo = mine.filter((l) => !done.has(l.id) && ROLE_KEYS.some((k) => !l.roleContacts?.[k])).slice(0, LIMIT);
console.log(`shard ${SHARD_I}/${SHARD_N}: ${mine.length} schools in shard, ${todo.length} to crawl (already done ${done.size})`);

const out = fs.createWriteStream(OUT, { flags: "a" }); let i = 0, n = 0; const tally = {}; const bump = (k) => tally[k] = (tally[k] || 0) + 1; const t0 = Date.now();
async function worker() {
  while (i < todo.length) {
    const lead = todo[i++]; let row;
    try { row = await crawlOne(lead); } catch (e) { row = { id: lead.id, status: 0, err: `error: ${String(e?.message || e).slice(0, 100)}`, roles: {}, pagesRead: 0 }; }
    row.at = new Date().toISOString();
    out.write(JSON.stringify(row) + "\n"); n++;
    const found = Object.keys(row.roles || {}); if (found.length) bump("any role found"); for (const k of found) bump(`${k} found`); if (row.status !== 200) bump("unreachable"); if (row.err === "no staff page found") bump("no staff page found");
    if (n % 50 === 0) console.log(`shard ${SHARD_I}/${SHARD_N}: ${n}/${todo.length} ${Math.round((Date.now() - t0) / 1000)}s`, JSON.stringify(tally));
  }
}
await Promise.all(Array.from({ length: CONC }, worker));
out.end(); console.log(`shard ${SHARD_I}/${SHARD_N} done`, n, JSON.stringify(tally));
process.exit(0);
