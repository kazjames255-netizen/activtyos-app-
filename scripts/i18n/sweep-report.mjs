// Summarise an overnight-sweep output dir:  node scripts/i18n/sweep-report.mjs /tmp/overnight-r1 [--top=40] [--pages]
// Per portal x locale: pages, raw keys, page errors, overflow, leftover-English counts (cat = equals an English catalogue value, heur = reads as English),
// and the most common leftover strings. The allow-list mirrors e2e/i18n/overnight-sweep.spec.ts (test data, brand, official terms).
import fs from "node:fs"; import path from "node:path";
const dir = process.argv[2]; const top = Number((process.argv.find((a) => a.startsWith("--top=")) || "--top=25").slice(6)); const pages = process.argv.includes("--pages");
const DATA = /\bE2E\b|\bmun[a-z0-9]{4,}\b|@activityos-test/;
const ALLOW = /\b(Activ|ActivityOS|Activly|Stripe|HMRC|DBS|Ofsted|PayPal|Xero|Sage|QuickBooks|WhatsApp|Google|Gmail|Trustpilot|PAYE|Tax-Free Childcare|KCSIE|SEND|EHCP|VAT|PDF|CSV|Excel|Word|Zoom|Meta|Facebook|Instagram|Canva)\b/g;
const clean = (s) => (DATA.test(s) ? "" : s).replace(ALLOW, " ").replace(/\s+/g, " ").trim();
const NON = new Set(["ur", "pa", "bn", "ar"]);
const STOP = /\b(the|and|your|you|you're|to|for|with|of|is|are|this|that|from|in|on|no|not|yet|will|can|have|has|all|new|add|edit|delete|save|cancel|view|search|select)\b/i;
const still = (s, loc) => { const c = clean(s); if (!/[A-Za-z]{3}/.test(c)) return false; return NON.has(loc) ? /\b[A-Za-z]{4,}\b/.test(c) : (c.split(/\s+/).length >= 2 && STOP.test(c)); };
const rows = []; const tops = {};
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".json")).sort()) {
  const [portal, loc] = f.slice(0, -5).split("-"); const d = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
  let keys = 0, errs = 0, ovf = 0, cat = 0, heur = 0; const bad = [];
  for (const r of d) {
    const h = r.heur.filter((s) => still(s, loc)); const c = r.cat.filter((s) => clean(s).length > 0 && !ALLOW.test(s));
    keys += r.keys.length; errs += r.errs.length; if (r.overflow > 1) ovf++; cat += c.length; heur += h.length;
    if (r.keys.length || r.errs.length || r.overflow > 1) bad.push(`${r.view}: ${[...r.keys.slice(0, 2), ...r.errs.slice(0, 1).map((e) => e.slice(0, 70)), r.overflow > 1 ? "overflow " + r.overflow : ""].filter(Boolean).join(" | ")}`);
    if (pages && h.length + c.length > 10) console.log(`  ${portal}-${loc} ${r.view}: heur ${h.length} cat ${c.length}`);
    for (const s of h) { const k = `${loc}\t${s}`; tops[k] = (tops[k] || 0) + 1; }
  }
  rows.push({ portal, loc, pages: d.length, keys, errs, ovf, cat, heur, bad });
}
console.log("portal\tloc\tpages\trawKeys\tpageErrs\toverflowPages\tcat\theur");
for (const r of rows) console.log([r.portal, r.loc, r.pages, r.keys, r.errs, r.ovf, r.cat, r.heur].join("\t"));
for (const r of rows) for (const b of r.bad) console.log(`! ${r.portal}-${r.loc} ${b}`);
console.log("\nmost common leftover strings:");
for (const [k, n] of Object.entries(tops).sort((a, b) => b[1] - a[1]).slice(0, top)) console.log(`${n}\t${k.slice(0, 120)}`);
