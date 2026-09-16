// Import UK children's dance schools/teachers from the dance-teaching accreditation bodies' own public
// directories — the dance-world equivalent of the Ofsted/CIW/CI/FSNI childcare registers, since standalone
// dance schools (extracurricular, not childcare) mostly aren't on those registers.
//   node scripts/leads/import_dance.mjs istd|idta|batd|all [--dry] [--limit N]
// Sources (no Brave Search API used — direct HTTP fetch / an underlying JSON API only):
//   ISTD — dt.istd.org "find a teacher" listing pages (?p=N&age-level=Children), then each teacher's own
//          profile page for phone/email/website. UK-only: rows with no <div class="country"> (blank = ISTD's
//          own home country, UK) or an explicit UK country pass; anything else (spain, mexico, usa…) is dropped.
//   IDTA — schoolfinder.idta.co.uk ships a full URL list via wp-sitemap-posts-listdom-listing-{1,2}.xml; each
//          listing page embeds a schema.org LocalBusiness JSON-LD block with name/address/phone/email/website.
//          UK-only: address.streetAddress must contain a UK postcode.
//   BATD — batd.co.uk's Joomla map widget (POST /en/membership/regions, com_mymaplocations) returns GeoJSON
//          with name/address/phone/email in one HTML-in-JSON "description" field. The endpoint caps at ~100
//          results per request regardless of `limit`/`limitstart`, so we grid-search ~16 UK regional centres
//          and dedupe by feature id.
// RAD (Royal Academy of Dance) was investigated and skipped: radteachers/rad.org.uk sit behind Cloudflare
// (403 on every page incl. robots.txt/sitemap.xml) with no underlying API found — would need a headless
// browser, which this pipeline doesn't have (Brave Search API also has $0 credit and is off-limits).
import admin from "firebase-admin"; import fs from "fs";
const MODE = process.argv[2]; const DRY = process.argv.includes("--dry");
const LIMIT = (() => { const i = process.argv.indexOf("--limit"); return i > -1 ? +process.argv[i + 1] : Infinity; })();
if (!["istd", "idta", "batd", "all"].includes(MODE)) { console.log("usage: node import_dance.mjs istd|idta|batd|all [--dry] [--limit N]"); process.exit(1); }
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync("./serviceAccountKey.json", "utf8"))) });
const db = admin.firestore();
const UA = { headers: { "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36" } };
const OUTDIR = "scripts/leads/out/dance"; fs.mkdirSync(OUTDIR, { recursive: true });

const STOP = new Set("the and of ltd limited cic cio uk plc llp co dance school schools academy academies studio studios dancing performing arts theatre".split(" "));
const norm = (s) => String(s || "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w && !STOP.has(w)).join(" ");
const host = (u) => { try { return new URL(/^https?:/.test(u) ? u : "https://" + u).hostname.replace(/^www\./, "").toLowerCase(); } catch { return ""; } };
const pc = (s) => String(s || "").toUpperCase().replace(/\s+/g, "");
const clean = (s) => String(s || "").replace(/\s+/g, " ").trim();
const title = (s) => clean(s).replace(/\b([a-z])(\S*)/gi, (m, a, b) => a.toUpperCase() + b.toLowerCase());
const UK_COUNTRY = /^(united kingdom|uk|england|scotland|wales|northern ireland|britain|great britain)$/i;
const UK_PC = /\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i;
const fmtPc = (s) => { const m = pc(s).match(/^([A-Z]{1,2}\d[A-Z\d]?)(\d[A-Z]{2})$/); return m ? m[1] + " " + m[2] : clean(s).toUpperCase(); };

// ── ISTD ──────────────────────────────────────────────────────────────────
async function scrapeISTD() {
  const cacheFile = `${OUTDIR}/istd.json`;
  const cache = new Map(fs.existsSync(cacheFile) ? JSON.parse(fs.readFileSync(cacheFile, "utf8")) : []);
  const rows = []; let page = 1, last = 1;
  while (page <= last) {
    const url = `https://dt.istd.org/find-a/teachers/?p=${page}&age-level=Children&sort=name-asc`;
    let h = ""; try { h = await (await fetch(url, UA)).text(); } catch (e) { console.log("istd list fetch fail", url, String(e)); break; }
    if (page === 1) { const ps = [...h.matchAll(/[;&?]p=(\d+)/g)].map((m) => +m[1]); last = ps.length ? Math.max(...ps) : 1; console.log("istd: list pages", last); }
    for (const m of h.matchAll(/<div class="item" data-id="(\d+)">([\s\S]*?)<div class="additional">/g)) {
      const id = m[1], block = m[2];
      const country = clean((block.match(/class="country">([^<]*)/) || [])[1]);
      if (country && !UK_COUNTRY.test(country)) continue; // explicit non-UK
      const name = clean(((block.match(/<a href="\.\/\d+\/">([^<]+)<\/a>/) || [])[1] || "").replace(/&#039;/g, "'").replace(/&amp;/g, "&"));
      const primarytown = clean((block.match(/class="primarytown">([^<]*)/) || [])[1]).replace(/,$/, "");
      const townRaw = clean((block.match(/class="town">([^<]*)/) || [])[1]).replace(/,$/, "");
      const county = clean((block.match(/class="county">([^<]*)/) || [])[1]).replace(/,$/, "");
      const postcodeRaw = clean((block.match(/class="postcode">([^<]*)/) || [])[1]).replace(/,$/, "");
      if (!name) continue;
      rows.push({ id, name, town: title(primarytown || townRaw), county: title(county), postcode: postcodeRaw ? fmtPc(postcodeRaw) : "" });
    }
    page++;
  }
  console.log("istd: UK children-teaching listings", rows.length);
  const todo = rows.filter((r) => !cache.has(r.id)).slice(0, LIMIT === Infinity ? undefined : LIMIT);
  console.log("istd: detail pages to fetch", todo.length, "(cached", cache.size, ")");
  let i = 0, done = 0;
  async function worker() { while (i < todo.length) { const r = todo[i++];
    let html = ""; try { html = await (await fetch(`https://dt.istd.org/find-a/teachers/${r.id}/`, UA)).text(); } catch { }
    const phone = clean((html.match(/Phone:<\/span>\s*([^<]+)</) || [])[1]);
    const email = clean(((html.match(/href="mailto:([^"]+)"/) || [])[1] || "").toLowerCase());
    const website = clean((html.match(/class="btn" target="_blank" href="([^"]+)">\s*Visit website/) || [])[1]);
    cache.set(r.id, { phone, email, website }); if (++done % 150 === 0) { console.log("istd detail", done, "/", todo.length); fs.writeFileSync(cacheFile, JSON.stringify([...cache])); } } }
  await Promise.all(Array.from({ length: 20 }, worker));
  fs.writeFileSync(cacheFile, JSON.stringify([...cache]));
  return rows.map((r) => { const d = cache.get(r.id); if (!d) return null; return {
    regId: "istd-" + r.id, name: r.name, business: "", town: r.town, county: r.county, postcode: r.postcode,
    phone: d.phone, email: d.email, website: d.website, nation: "",
    regType: "ISTD registered dance teacher", types: ["activity"], kind: "person",
    sourceUrl: `https://dt.istd.org/find-a/teachers/${r.id}/`, sourceTag: "istd" }; }).filter(Boolean);
}

// ── IDTA ──────────────────────────────────────────────────────────────────
async function scrapeIDTA() {
  const cacheFile = `${OUTDIR}/idta.json`;
  const cache = new Map(fs.existsSync(cacheFile) ? JSON.parse(fs.readFileSync(cacheFile, "utf8")) : []);
  let urls = [];
  for (const n of [1, 2]) { let xml = ""; try { xml = await (await fetch(`https://schoolfinder.idta.co.uk/wp-sitemap-posts-listdom-listing-${n}.xml`, UA)).text(); } catch (e) { console.log("idta sitemap fetch fail", n, String(e)); }
    for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) urls.push(m[1]); }
  console.log("idta: listing urls", urls.length);
  const todo = urls.filter((u) => !cache.has(u)).slice(0, LIMIT === Infinity ? undefined : LIMIT);
  console.log("idta: pages to fetch", todo.length, "(cached", cache.size, ")");
  let i = 0, done = 0;
  async function worker() { while (i < todo.length) { const u = todo[i++];
    let html = ""; try { html = await (await fetch(u, UA)).text(); } catch { cache.set(u, { skip: true }); continue; }
    let row = { skip: true };
    const m = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    if (m) { try {
      const data = JSON.parse(m[1]); const graph = Array.isArray(data["@graph"]) ? data["@graph"] : [data];
      const biz = graph.find((g) => String(g["@type"] || "").includes("LocalBusiness")) || graph[0];
      if (biz) { const addr = clean(biz.address?.streetAddress || ""); const pcM = addr.match(UK_PC);
        if (pcM) { const postcode = fmtPc(pcM[1]); const townPart = addr.slice(0, pcM.index).split(",").map(clean).filter(Boolean).pop() || "";
          const website = (biz.sameAs || []).map(clean).find((s) => s && !/facebook|instagram|twitter|x\.com|tiktok|youtube|linkedin/i.test(s)) || "";
          row = { name: clean(biz.name), town: title(townPart), postcode, phone: clean(biz.telephone || ""), email: clean((biz.email || "").toLowerCase()), website }; } }
    } catch { } }
    cache.set(u, row); if (++done % 200 === 0) { console.log("idta page", done, "/", todo.length); fs.writeFileSync(cacheFile, JSON.stringify([...cache])); } } }
  await Promise.all(Array.from({ length: 24 }, worker));
  fs.writeFileSync(cacheFile, JSON.stringify([...cache]));
  return [...cache.entries()].filter(([u, r]) => u.match(/\/listings\//) && r && !r.skip && r.name).map(([u, r]) => ({
    regId: "idta-" + u.replace(/^https?:\/\/[^/]+\/listings\//, "").replace(/\/$/, ""), name: r.name, business: "", town: r.town, county: "", postcode: r.postcode,
    phone: r.phone, email: r.email, website: r.website, nation: "",
    regType: "IDTA dance school", types: ["activity"], kind: "org", sourceUrl: u, sourceTag: "idta" }));
}

// ── BATD ──────────────────────────────────────────────────────────────────
const GRID = [[51.5,-0.13],[52.48,-1.90],[53.48,-2.24],[53.80,-1.55],[54.98,-1.61],[51.45,-2.59],[52.63,0.44],
  [50.37,-4.14],[51.48,-3.18],[55.86,-4.25],[55.95,-3.19],[57.15,-2.09],[57.48,-4.22],[54.60,-5.93],[52.95,-1.15],[50.90,-1.40]];
async function scrapeBATD() {
  const seen = new Map();
  for (const [lat, lng] of GRID) {
    const body = new URLSearchParams({ task: "search", radius: "150", searchname: "", searchzip: "United Kingdom", component: "com_mymaplocations", limit: "200", zoom: "7", format: "json", geo: "", latitude: String(lat), longitude: String(lng), limitstart: "0" });
    let json; try { const res = await fetch("https://batd.co.uk/en/membership/regions", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", "x-requested-with": "XMLHttpRequest", "user-agent": UA.headers["user-agent"] }, body });
      json = await res.json(); } catch (e) { console.log("batd grid fetch fail", lat, lng, String(e)); continue; }
    for (const f of json.features || []) { if (seen.has(f.id)) continue; const p = f.properties || {};
      const descRaw = p.description || p.fulladdress || ""; const decoded = descRaw.replace(/&#44;/g, ",").replace(/&nbsp;/g, " ");
      const stripped = decoded.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
      const email = clean(((decoded.match(/mailto:([^"]+)/) || [])[1] || "").toLowerCase());
      const phone = clean((decoded.match(/tel:([^"]+)/) || [])[1] || "");
      const nationM = stripped.match(/\b(England|Scotland|Wales|Northern Ireland)\b/i); const nation = nationM ? title(nationM[1]) : "";
      const pcM = stripped.match(UK_PC); const postcode = pcM ? fmtPc(pcM[1]) : "";
      let town = ""; if (nationM) { const before = stripped.slice(0, nationM.index); const parts = before.split(",").map(clean).filter(Boolean); town = title(parts[parts.length - 1] || ""); }
      seen.set(f.id, { regId: "batd-" + f.id, name: clean(p.name), business: "", town, county: "", postcode, nation,
        phone, email, website: "", regType: "BATD member dance school", types: ["activity"], kind: "org",
        sourceUrl: "https://batd.co.uk" + (p.url || ""), sourceTag: "batd" }); }
    console.log("batd: grid point", lat, lng, "distinct so far", seen.size);
  }
  return [...seen.values()];
}

// ── Scrape the requested source(s) ──────────────────────────────────────────
let rows = [];
if (MODE === "istd" || MODE === "all") rows.push(...await scrapeISTD());
if (MODE === "idta" || MODE === "all") rows.push(...await scrapeIDTA());
if (MODE === "batd" || MODE === "all") rows.push(...await scrapeBATD());
console.log("total scraped rows (pre-dedupe)", rows.length, JSON.stringify(rows.reduce((a, r) => { a[r.sourceTag] = (a[r.sourceTag] || 0) + 1; return a; }, {})));

// ── Existing leads (whole collection — dance isn't nation-scoped) ──────────
const snap = await db.collection("leads").select("name", "website", "location", "postcode", "excluded").get();
const byPcName = new Map(), byHost = new Map(), byName = new Map();
for (const d of snap.docs) { const x = d.data(); if (x.excluded) continue;
  const p = pc(x.postcode) || (String(x.location || "").match(UK_PC) || [])[1]?.replace(/\s+/g, "").toUpperCase();
  const n = norm(x.name); if (p && n) byPcName.set(p + "|" + n.split(" ").slice(0, 2).join(" "), d.id);
  const h = host(x.website || ""); if (h) byHost.set(h, d.id);
  if (n) { if (!byName.has(n)) byName.set(n, []); byName.get(n).push(d.id); } }
console.log("existing leads considered for dedupe", snap.size);

// ── Match / create ──────────────────────────────────────────────────────────
let matched = 0, created = 0, skipped = 0; let batch = db.batch(), inB = 0;
const flush = async () => { if (inB && !DRY) await batch.commit(); batch = db.batch(); inB = 0; };
const createdIds = [];
for (const r of rows) { if (!r.name || r.name.length < 3) { skipped++; continue; }
  const n = norm(r.name); const key = pc(r.postcode) + "|" + n.split(" ").slice(0, 2).join(" "); const h = host(r.website);
  let id = byPcName.get(key) || (h && byHost.get(h)) || null;
  if (!id) { const c = byName.get(n) || []; if (c.length === 1 && r.kind === "org" && n.length > 8) id = c[0]; }
  const location = [r.town, r.postcode].filter(Boolean).join(" · ");
  if (id) { matched++; const upd = { registerId: r.regId, registerType: r.regType, registerSource: r.sourceTag, updatedAt: new Date().toISOString(), sources: admin.firestore.FieldValue.arrayUnion(r.sourceTag) };
    const cur = snap.docs.find((d) => d.id === id)?.data() || {};
    if (!cur.phone && r.phone) upd.phone = r.phone; if (!cur.email && r.email) upd.email = r.email;
    if (!cur.website && r.website) upd.website = /^https?:/.test(r.website) ? r.website : "https://" + r.website;
    if (!cur.location && location) upd.location = location; if (r.county && !cur.county) upd.county = r.county;
    if (r.nation && !cur.nation) upd.nation = r.nation;
    if (!DRY) batch.update(db.collection("leads").doc(id), upd); inB++; }
  else { created++; const ref = db.collection("leads").doc();
    const doc = { name: r.name, business: r.business || "", email: r.email || "", phone: r.phone || "",
      website: r.website ? (/^https?:/.test(r.website) ? r.website : "https://" + r.website) : "",
      location, county: r.county || "", nation: r.nation || "", sport: "Dance classes",
      source: r.sourceTag, sources: [r.sourceTag], kind: r.kind, providerTypes: r.types, providerType: r.types[0],
      registerId: r.regId, registerType: r.regType, registerSource: r.sourceTag,
      message: `${r.regType}${location ? " · " + location : ""} — kids' dance classes`,
      sourceUrl: r.sourceUrl, status: "new", inPipeline: false, createdAt: new Date().toISOString(),
      createdBy: "claude-research (dance-body import)", imported: true, importBatch: "dance-2026-09" };
    if (!DRY) { batch.set(ref, doc); createdIds.push(ref.id); } inB++;
    byPcName.set(key, ref.id); if (h) byHost.set(h, ref.id); }
  if (inB >= 380) await flush(); }
await flush();
if (!DRY && createdIds.length) fs.writeFileSync(`${OUTDIR}/created-${MODE}.json`, JSON.stringify(createdIds));
console.log(JSON.stringify({ mode: MODE, dry: DRY, rows: rows.length, matchedExisting: matched, created, skipped }));
console.log("sample:", rows.slice(0, 5).map((r) => `${r.name} (${r.town || "?"}, ${r.postcode || "no postcode"}) [${r.sourceTag}]`).join(" | "));
process.exit(0);
