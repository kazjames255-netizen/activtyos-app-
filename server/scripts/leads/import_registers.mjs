// Import the Welsh / Scottish / Northern Irish childcare registers as leads (nation-labelled).
// Usage (from server/): node scripts/leads/import_registers.mjs wales|scotland|ni [--dry]
// Inputs: scripts/leads/out/registers/{wales.csv,scotland.csv}; NI is fetched live from familysupportni.gov.uk.
// Dedupe: by register id, else by postcode+name tokens, else by website host, within the nation. Existing leads are fill-only merged.
import admin from "firebase-admin"; import fs from "fs"; import { parse } from "csv-parse/sync";
const MODE = process.argv[2], DRY = process.argv.includes("--dry");
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync("./serviceAccountKey.json","utf8"))) });
const db = admin.firestore();
const STOP = new Set("the and of ltd limited cic cio uk plc llp co community trust nursery childminder childminding day care preschool pre school playgroup club".split(" "));
const norm = (s) => String(s||"").toLowerCase().replace(/&/g," and ").replace(/[^a-z0-9 ]/g," ").split(/\s+/).filter(w=>w && !STOP.has(w)).join(" ");
const host = (u) => { try { return new URL(/^https?:/.test(u)?u:"https://"+u).hostname.replace(/^www\./,"").toLowerCase(); } catch { return ""; } };
const pc = (s) => String(s||"").toUpperCase().replace(/\s+/g,"");
const clean = (s) => String(s||"").replace(/\s+/g," ").trim();
const title = (s) => clean(s).replace(/\b([A-Z]{2,})\b/g, (w) => w.length>3 ? w[0]+w.slice(1).toLowerCase() : w);

// ── Source rows → a common shape ─────────────────────────────────────────
const NATION = { wales: "Wales", scotland: "Scotland", ni: "Northern Ireland" }[MODE];
const SRC = { wales: "ciw", scotland: "cis", ni: "fsni" }[MODE];
let rows = [];
if (MODE === "wales") {
  const csv = parse(fs.readFileSync("scripts/leads/out/registers/wales.csv"), { columns: true, bom: true, relax_column_count: true });
  const TYPE = { "Full Day Care": "nursery", "Sessional Day Care": "preschool", "Creche": "nursery", "Out of School Care": "wraparound", "Open Access Play Provision": "holiday", "None": "other" };
  for (const r of csv) { const t = r["Service Type"]; if (t !== "Childrens Day Care" && t !== "Child Minder") continue;
    rows.push({ regId: r["Service URN"], name: title(r["Known as"] || r["Service Name"]), business: title(r["Service Name"]) !== title(r["Known as"]||r["Service Name"]) ? title(r["Service Name"]) : "",
      town: clean(r["Service Town/City"]), postcode: clean(r["Service Postcode"]), la: clean(r["Local Authority"]), phone: clean(r["Primary telephone number"]), email: clean(r["Primary email address"]).toLowerCase(), website: clean(r["Website"]),
      regType: t === "Child Minder" ? "Childminder" : (r["Service Sub-Type"] || "Children's day care"), types: [t === "Child Minder" ? "other" : (TYPE[r["Service Sub-Type"]] || "nursery")], kind: t === "Child Minder" ? "person" : "org",
      places: Number(r["Maximum No. of Places"]) || null, extra: { flyingStart: r["Flying Start Provider"] === "Yes" || undefined, childcareOffer: r["Registered to deliver childcare offer"] === "Yes" || undefined, language: r["Main Operating Language of Service"] || undefined }, sourceUrl: "https://careinspectorate.wales/find-care-service" }); }
} else if (MODE === "scotland") {
  const csv = parse(fs.readFileSync("scripts/leads/out/registers/scotland.csv"), { columns: true, bom: true, relax_column_count: true, relax_quotes: true });
  for (const r of csv) { const t = r.CareService; if ((t !== "Day Care of Children" && t !== "Child Minding") || r.ServiceStatus !== "Active") continue;
    const sub = r.Subtype || ""; rows.push({ regId: r.CSNumber, name: title(r.ServiceName), business: title(r.ServiceProvider) !== title(r.ServiceName) ? title(r.ServiceProvider) : "",
      town: clean(r.Service_town), postcode: clean(r.Service_Postcode), la: clean(r.Council_Area_Name), phone: clean(r.Service_Phone_Number), email: clean(r.Eforms_email_address).toLowerCase(), website: "",
      regType: t === "Child Minding" ? "Childminder" : sub || "Day care of children", types: [t === "Child Minding" ? "other" : /under 3/i.test(sub) ? "nursery" : "preschool"], kind: t === "Child Minding" ? "person" : "org",
      places: null, extra: { laProvided: r.Provided_by_Local_Authority === "Yes" || undefined }, sourceUrl: "https://www.careinspectorate.com/index.php/care-services" }); }
} else if (MODE === "ni") {
  const CATS = { 153: ["Childminder","other","person"], 154: ["Pre-school playgroup","preschool","org"], 155: ["Out of school","wraparound","org"], 156: ["Parent & toddler","other","org"], 157: ["Day nursery","nursery","org"], 158: ["Approved home childcare","other","person"], 159: ["Summer scheme","holiday","org"], 160: ["2 year old programme","preschool","org"], 161: ["Creche","nursery","org"], 162: ["Statutory nursery school/unit","nursery","org"] };
  const cache = "scripts/leads/out/registers/ni.json"; const byId = new Map(fs.existsSync(cache) ? JSON.parse(fs.readFileSync(cache,"utf8")) : []);
  const ua = { headers: { "user-agent": "Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/124.0 Safari/537.36" } };
  for (const [id, [label, type, kind]] of Object.entries(CATS)) { let page = 1, last = 1;
    while (page <= last) { const u = `https://www.familysupportni.gov.uk/Search/Results?sTypeID=138&serviceID=${id}&page=${page}`; let h = ""; try { h = await (await fetch(u, ua)).text(); } catch (e) { console.log("fetch fail", u, String(e)); break; }
      if (page === 1) { const ps = [...h.matchAll(/[?&]page=(\d+)/g)].map(m=>+m[1]); last = ps.length ? Math.max(...ps) : 1; }
      for (const m of h.matchAll(/<div class="organisation top-buffer" data-orgname="([^"]*)">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/g)) { const name = clean(m[1].replace(/&amp;/g,"&").replace(/&#39;/g,"'")); const b = m[2];
        const oid = (b.match(/\/Search\/Details\/(\d+)/)||[])[1]; const addr = clean((b.match(/<strong>Address:<\/strong>\s*([^<]*)/)||[])[1]||"").replace(/&amp;/g,"&"); const phone = clean((b.match(/<strong>Phone:<\/strong>\s*([^<]*)/)||[])[1]||"");
        const postcode = (addr.match(/\b(BT\d{1,2}\s*\d[A-Z]{2})\b/i)||[])[1]||""; const parts = addr.replace(postcode,"").split(",").map(clean).filter(Boolean); const town = parts.length>=2 ? parts[parts.length-2].replace(/^Co\.?\s+/i,"") : (parts[0]||"");
        const prev = byId.get(oid); byId.set(oid, { regId: "fsni-"+oid, name, business: "", town, postcode, la: (addr.match(/\bCo\.?\s+([A-Z][a-z]+)/)||[])[1] ? "Co. "+(addr.match(/\bCo\.?\s+([A-Z][a-z]+)/)||[])[1] : "", phone, email: "", website: "", regType: prev ? [...new Set([...prev.regType.split("; "), label])].join("; ") : label, types: prev ? [...new Set([...prev.types, type])] : [type], kind, places: null, extra: {}, sourceUrl: `https://www.familysupportni.gov.uk/Search/Details/${oid}` }); }
      page++; }
    console.log("ni", label, "pages", last, "total so far", byId.size); fs.writeFileSync(cache, JSON.stringify([...byId])); }
  rows = [...byId.values()];
} else { console.log("mode?"); process.exit(1); }
console.log(NATION, "register rows", rows.length);

// ── Existing leads in this nation ─────────────────────────────────────────
const snap = await db.collection("leads").select("name","business","website","location","nation","region","registerId","excluded","phone","email").get();
const byReg = new Map(), byPcName = new Map(), byHost = new Map(), byName = new Map(); let inNation = 0;
for (const d of snap.docs) { const x = d.data(); if ((x.nation || x.region) !== NATION) continue; inNation++;
  if (x.registerId) byReg.set(x.registerId, d.id);
  const p = (String(x.location||"").match(/\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i)||[])[1]; const n = norm(x.name); if (p && n) byPcName.set(pc(p)+"|"+n.split(" ").slice(0,2).join(" "), d.id);
  const h = host(x.website||""); if (h) byHost.set(h, d.id); if (n) { if (!byName.has(n)) byName.set(n, []); byName.get(n).push(d.id); } }
console.log("existing leads in", NATION, inNation);

let matched = 0, created = 0, skipped = 0; let batch = db.batch(), inB = 0; const flush = async () => { if (inB && !DRY) await batch.commit(); batch = db.batch(); inB = 0; };
for (const r of rows) { if (!r.name || r.name.length < 3) { skipped++; continue; }
  const n = norm(r.name); const key = pc(r.postcode)+"|"+n.split(" ").slice(0,2).join(" "); const h = host(r.website);
  let id = byReg.get(r.regId) || (r.postcode && n && byPcName.get(key)) || (h && byHost.get(h)) || null;
  if (!id) { const c = byName.get(n) || []; if (c.length === 1 && r.kind === "org" && n.length > 8) id = c[0]; }
  const location = [r.town, r.postcode].filter(Boolean).join(" · ");
  if (id) { matched++; const upd = { registerId: r.regId, registerType: r.regType, registerSource: SRC, nation: NATION, updatedAt: new Date().toISOString(), sources: admin.firestore.FieldValue.arrayUnion(SRC) };
    // fill-only: never overwrite a value a human or an earlier pass set
    const cur = snap.docs.find((d) => d.id === id)?.data() || {}; if (!cur.phone && r.phone) upd.phone = r.phone; if (!cur.email && r.email) upd.email = r.email; if (!cur.website && r.website) upd.website = /^https?:/.test(r.website) ? r.website : "https://" + r.website; if (!cur.location && location) upd.location = location; if (r.places) upd.places = r.places; if (r.la) upd.county = r.la;
    if (!DRY) batch.update(db.collection("leads").doc(id), upd); inB++; }
  else { created++; const ref = db.collection("leads").doc();
    const doc = { name: r.name, business: r.business || "", email: r.email || "", phone: r.phone || "", website: r.website ? (/^https?:/.test(r.website) ? r.website : "https://" + r.website) : "", location, region: NATION, nation: NATION, county: r.la || "", source: SRC, sources: [SRC], kind: r.kind, providerTypes: r.types, registerId: r.regId, registerType: r.regType, registerSource: SRC, places: r.places || null, ...(Object.fromEntries(Object.entries(r.extra).filter(([,v]) => v !== undefined))),
      message: `${r.regType} registered with ${{ciw:"Care Inspectorate Wales",cis:"the Care Inspectorate (Scotland)",fsni:"Family Support NI"}[SRC]}${r.la ? ` · ${r.la}` : ""}${r.places ? ` · ${r.places} places` : ""}`, sourceUrl: r.sourceUrl, status: "new", inPipeline: false, createdAt: new Date().toISOString() };
    if (!DRY) batch.set(ref, doc); inB++; byReg.set(r.regId, ref.id); }
  if (inB >= 400) await flush(); }
await flush();
console.log(JSON.stringify({ mode: MODE, dry: DRY, rows: rows.length, matchedExisting: matched, created, skipped }));
process.exit(0);
