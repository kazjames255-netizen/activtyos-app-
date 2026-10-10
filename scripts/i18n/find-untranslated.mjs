// Finds catalogue entries that are still English in another language (value identical to the English value and reads as English):
//   server/node_modules/.bin/tsx scripts/i18n/find-untranslated.mjs [--json=/tmp/out.json] [area ...]
// Non-Latin locales (ur pa bn ar): any word of 4+ Latin letters. Latin locales (pl ro pt es fr cy): 3+ English-looking words (stop-word heuristic).
import fs from "node:fs"; import path from "node:path";
const dir = "lib/i18n/messages/areas"; const json = (process.argv.find((a) => a.startsWith("--json=")) || "").slice(7);
const want = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const names = (want.length ? want : fs.readdirSync(dir).filter((f) => /\.ts$/.test(f)).map((f) => f.replace(/\.ts$/, ""))).filter((n) => !/^hub/.test(n));
const NON = new Set(["ur", "pa", "bn", "ar"]); const LOC = ["pl", "ro", "ur", "pa", "bn", "ar", "pt", "es", "fr", "cy"];
const STOP = /\b(the|and|your|you|to|for|with|of|is|are|this|that|from|in|on|not|will|can|have|has|all|new|add|edit|delete|save|cancel|view|search|select|no|yet)\b/gi;
const ALLOW = /\{[^}]+\}|\b(ActivityLane|ActivityLane|Stripe|HMRC|DBS|Ofsted|PayPal|Xero|Sage|QuickBooks|WhatsApp|Google|Gmail|Trustpilot|PAYE|Tax-Free Childcare|KCSIE|SEND|EHCP|VAT|PDF|CSV|Excel|Word|Zoom|Meta|Facebook|Instagram|Canva|SMS|GBP|NI|EYFS|HAF|BACS|IBAN|QR|URL|ID|OK)\b/g;
const isEng = (s, loc) => { const c = s.replace(ALLOW, " "); if (!/[A-Za-z]{3}/.test(c)) return false; if (NON.has(loc)) return /\b[A-Za-z]{4,}\b/.test(c); return (c.match(STOP) || []).length >= 2 && c.split(/\s+/).length >= 4; };
const report = {}; let total = 0;
for (const n of names) {
  let mod; try { mod = (await import(path.resolve(dir, n + ".ts"))).default; } catch { continue; }
  const en = mod?.en; if (!en || typeof en !== "object") continue; const flat = (o) => Object.entries(o).filter(([, v]) => typeof v === "string");
  const out = {}; for (const loc of LOC) { const d = mod[loc] ?? {}; for (const [k, v] of flat(en)) if (typeof d[k] === "string" && d[k] === v && isEng(v, loc)) (out[k] ??= []).push(loc); }
  const keys = Object.keys(out); if (keys.length) { report[n] = out; total += keys.length; console.log(`${n}: ${keys.length} keys still English in at least one language (${Object.values(out).reduce((a, l) => a + l.length, 0)} key x language)`); }
}
console.log("total keys:", total); if (json) fs.writeFileSync(json, JSON.stringify(report));
