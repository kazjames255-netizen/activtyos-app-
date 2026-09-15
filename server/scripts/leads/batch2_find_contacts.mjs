// Contact-details pass: for leads that have a website but no email AND no phone, read the homepage and its
// contact/about page and pull out an email (mailto: first) and a UK phone number. Fill-only, resumable.
//   node scripts/leads/find_contacts.mjs [--limit N] [--only id1,id2] [--apply]      (from server/; state in scripts/leads/out/contacts.out.jsonl)
import admin from "firebase-admin"; import fs from "fs"; import path from "path";
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync("./serviceAccountKey.json","utf8"))) });
const db = admin.firestore();
const args = Object.fromEntries(process.argv.slice(2).map((a,i,arr)=>a.startsWith("--")?[a.slice(2),arr[i+1]&&!arr[i+1].startsWith("--")?arr[i+1]:true]:[]).filter(x=>x.length));
const LIMIT = args.limit ? +args.limit : Infinity; const ONLY = args.only ? new Set(String(args.only).split(",")) : null; const OUT = path.resolve("scripts/leads/out/batch2_contacts.out.jsonl"); const CONC = 16, TIMEOUT = 12000, MAXBYTES = 800_000;
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const BAD_MAIL = /(example\.com|sentry|wixpress|wordpress|godaddy|\.png|\.jpg|\.gif|\.svg|\.webp|noreply|no-reply|donotreply|privacy@|abuse@|dmca@|jscomp|schema\.org|w3\.org|@2x|@3x|u003e|sitemap)/i;
const GENERIC_HOSTS = /(gmail|hotmail|outlook|yahoo|icloud|live|btinternet|aol|me)\.(com|co\.uk)$/i;
async function get(url) { const ctrl = new AbortController(); const t = setTimeout(()=>ctrl.abort(), TIMEOUT);
  try { const res = await fetch(url, { redirect:"follow", signal: ctrl.signal, headers: { "user-agent": UA, accept: "text/html,*/*" } }); if (res.status >= 400) return { status: res.status, html: "", final: res.url };
    const reader = res.body?.getReader(); let got = 0, chunks = []; if (reader) { while (got < MAXBYTES) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); got += value.length; } try { reader.cancel(); } catch {} }
    return { status: res.status, html: Buffer.concat(chunks).toString("utf8"), final: res.url || url }; }
  catch (e) { return { status: 0, html: "", final: url, err: String(e?.cause?.code || e?.name || e).slice(0,40) }; } finally { clearTimeout(t); } }
const decode = (s) => s.replace(/&#(\d+);/g,(m,n)=>String.fromCharCode(+n)).replace(/&#x([0-9a-f]+);/gi,(m,h)=>String.fromCharCode(parseInt(h,16))).replace(/&amp;/g,"&").replace(/&nbsp;/g," ").replace(/\[at\]|\(at\)/gi,"@").replace(/\[dot\]|\(dot\)/gi,".");
function emails(html, host) { const h = decode(html); const set = new Map();
  for (const m of h.matchAll(/mailto:([^"'?\s<>]+)/gi)) { const e = m[1].trim().toLowerCase(); if (/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(e) && !BAD_MAIL.test(e)) set.set(e, (set.get(e)||0)+10); }
  for (const m of h.matchAll(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi)) { const e = m[0].toLowerCase(); if (!BAD_MAIL.test(e) && !/\.(js|css|html|php)$/.test(e)) set.set(e, (set.get(e)||0)+1); }
  const ranked = [...set.entries()].map(([e,n]) => { const d = e.split("@")[1]; const own = host && (host.endsWith(d) || d.endsWith(host)); return { e, score: n + (own ? 20 : 0) + (/^(info|hello|enquiries|bookings|admin|contact|office)@/.test(e) ? 3 : 0) }; }).sort((a,b)=>b.score-a.score);
  return ranked.map(x=>x.e); }
function phones(html) { const t = decode(html).replace(/<[^>]+>/g," "); const out = new Map();
  for (const m of t.matchAll(/(?:\+44\s?\(?0?\)?\s?|\b0)(?:\d[\s\-().]?){9,10}\b/g)) { let p = m[0].replace(/[^\d+]/g,""); if (p.startsWith("+44")) p = "0" + p.slice(3).replace(/^0/,""); if (!/^0(1|2|3|7|8)\d{8,9}$/.test(p)) continue; if (/^0(800|808|845|870|871|844|843)/.test(p) && out.size) continue; out.set(p, (out.get(p)||0)+1); }
  for (const m of html.matchAll(/href=["']tel:([^"']+)/gi)) { let p = m[1].replace(/[^\d+]/g,""); if (p.startsWith("+44")) p = "0" + p.slice(3).replace(/^0/,""); if (/^0(1|2|3|7|8)\d{8,9}$/.test(p)) out.set(p, (out.get(p)||0)+10); }
  return [...out.entries()].sort((a,b)=>b[1]-a[1]).map(([p])=>p.replace(/^(0\d{2,4})(\d{3})(\d{3,4})$/, "$1 $2 $3")); }
function contactLinks(html, base) { const hrefs = [...html.matchAll(/href=["']([^"'#]*(contact|about|find-us|findus|get-in-touch|enquir|book)[^"'#]*)["']/gi)].map(x=>x[1]).filter(h=>!/^(mailto|tel|javascript)/i.test(h)); const out=[]; for (const h of hrefs) { try { const u = new URL(h, base); if (u.hostname === new URL(base).hostname && !out.includes(u.href)) out.push(u.href); } catch {} } return out.slice(0,2); }
const done = new Set(fs.existsSync(OUT) ? fs.readFileSync(OUT,"utf8").split("\n").filter(Boolean).map(l=>{try{return JSON.parse(l).id}catch{return null}}) : []);
if (args.apply) { let n=0, e=0, p=0; let batch=db.batch(), inB=0; const rows = fs.readFileSync(OUT,"utf8").split("\n").filter(Boolean).map(l=>JSON.parse(l)).filter(r=>r.email||r.phone);
  const ids = rows.map(r=>r.id); const cur = new Map(); for (let i=0;i<ids.length;i+=300) { const snaps = await db.getAll(...ids.slice(i,i+300).map(id=>db.collection("leads").doc(id)), { fieldMask:["email","phone"] }); for (const s of snaps) if (s.exists) cur.set(s.id, s.data()); }
  for (const r of rows) { const c = cur.get(r.id); if (!c) continue; const upd = {}; if (r.email && !c.email) { upd.email = r.email; e++; } if (r.phone && !c.phone) { upd.phone = r.phone; p++; } if (Object.keys(upd).length) { upd.contactFoundBy = "site scrape"; upd.contactFoundAt = new Date().toISOString(); batch.update(db.collection("leads").doc(r.id), upd); inB++; n++; if (inB>=400) { await batch.commit(); batch=db.batch(); inB=0; } } }
  if (inB) await batch.commit(); console.log(JSON.stringify({ leadsUpdated:n, emailsSet:e, phonesSet:p })); process.exit(0); }
// --any-missing: widen the target from "no email AND no phone" to "no email OR no phone" — a scrape still only
// ever fills the field(s) actually missing (apply above is fill-only per-field), so this is safe to broaden.
const ANY_MISSING = !!args["any-missing"];
const snap = await db.collection("leads").select("website","email","phone","excluded","websiteDown").get();
const todo = snap.docs.filter(d => { if (ONLY && !ONLY.has(d.id)) return false; const x=d.data(); const missing = ANY_MISSING ? (!x.email || !x.phone) : (!x.email && !x.phone); return !x.excluded && x.website && missing && !x.websiteDown && !done.has(d.id); }).slice(0, LIMIT);
console.log("to scrape", todo.length, "(already done", done.size, ")");
const out = fs.createWriteStream(OUT, { flags: "a" }); let i = 0, found = 0;
async function one(d) { const url = /^https?:/.test(d.data().website) ? d.data().website : "https://" + d.data().website; const home = await get(url); let html = home.html; let pages = [home.final];
  if (home.status === 200) { for (const c of contactLinks(home.html, home.final)) { const r = await get(c); if (r.status === 200) { html += "\n" + r.html; pages.push(c); } } }
  const host = (()=>{ try { return new URL(home.final).hostname.replace(/^www\./,""); } catch { return ""; } })();
  const em = emails(html, host), ph = phones(html); const row = { id: d.id, status: home.status, err: home.err, pages: pages.length, email: em[0] || null, phone: ph[0] || null, emails: em.slice(0,3), phones: ph.slice(0,3) }; if (row.email || row.phone) found++; out.write(JSON.stringify(row) + "\n"); if (++i % 100 === 0) console.log(i, "done,", found, "with a contact"); }
for (let k = 0; k < todo.length; k += CONC) await Promise.all(todo.slice(k, k+CONC).map(one));
out.end(); console.log(JSON.stringify({ scraped: i, withContact: found })); process.exit(0);
