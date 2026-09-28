// Generates features/learninghub/howitworks/i18n/template.json: every translatable string of the explainer scripts, keyed like the runtime overlay.
// Usage: node scripts/how-i18n-template.cjs            (writes template.json)
//        node scripts/how-i18n-template.cjs --check     (validates every i18n/<locale>.json against the English scripts: exit 1 on any problem)
const load = require("./how-tsload.cjs"), fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..", "features/learninghub/howitworks");
const D = path.join(root, "scripts") + "/";
const I = load(D + "index.ts"); const KS1 = load(D + "kidKs1.ts").KID_KS1;
const all = [...I.SCRIPT_LIST, ...I.TUTOR_LIBRARY, ...I.PARENT_LIBRARY, ...I.EXTRA_TOPICS.kid, KS1];
const scripts = {}, scenes = {};
for (const s of all) {
  const sk = `${s.role}:${s.band ?? "std"}:${s.topic ?? "main"}`;
  const o = { title: s.title, tagline: s.tagline, audience: s.audience };
  if (s.viewLabel) o.viewLabel = s.viewLabel; if (s.blurb) o.blurb = s.blurb;
  scripts[sk] = o;
  for (const sc of s.scenes) {
    const k = `${s.role}:${s.band ?? "std"}:${sc.id}`; if (scenes[k]) continue;
    const e = { chapter: sc.chapter, title: sc.title, say: sc.say, keys: [...sc.keys] };
    const ons = (a, f) => a?.length ? a.map(f) : undefined;
    if (sc.shots) e.shots = sc.shots.map((c) => ({ on: c.on }));
    if (sc.cam) e.cam = sc.cam.map((c) => ({ on: c.on }));
    if (sc.rings) e.rings = sc.rings.map((c) => ({ on: c.on, ...(c.off ? { off: c.off } : {}) }));
    if (sc.cursor) e.cursor = sc.cursor.map((c) => ({ on: c.on }));
    if (sc.callouts) e.callouts = sc.callouts.map((c) => ({ on: c.on, text: c.text, ...(c.off ? { off: c.off } : {}) }));
    if (sc.nodes) e.nodes = sc.nodes.map((c) => ({ on: c.on, title: c.title, ...(c.sub ? { sub: c.sub } : {}) }));
    if (sc.links) e.links = sc.links.map((l) => ({ label: l.label }));
    scenes[k] = e;
  }
}
const template = { scripts, scenes };
const ui = load(path.join(root, "i18n/ui.ts")).EN_UI;
template.ui = ui;
if (!process.argv.includes("--check")) { fs.writeFileSync(path.join(root, "i18n/template.json"), JSON.stringify(template, null, 1) + "\n"); console.log("template:", Object.keys(scripts).length, "scripts,", Object.keys(scenes).length, "scenes,", Object.keys(ui).length, "ui keys"); process.exit(0); }

// ---- check mode ----
const LOCALES = ["pl", "ro", "ur", "pa", "bn", "ar", "pt", "es", "fr", "cy"];
const only = process.argv.filter((a) => LOCALES.includes(a)); let bad = 0;
const posIn = (say, p) => say.toLowerCase().indexOf(p.toLowerCase());
const ph = (s) => (s.match(/\{\w+\}/g) || []).sort().join();
for (const loc of only.length ? only : LOCALES) {
  const f = path.join(root, `i18n/${loc}.json`);
  if (!fs.existsSync(f)) { console.log(loc, "MISSING file"); bad++; continue; }
  const L = JSON.parse(fs.readFileSync(f, "utf8")); const err = []; const E = (m) => err.push(m);
  for (const [k, en] of Object.entries(ui)) { const v = L.ui?.[k]; if (typeof v !== "string" || !v.trim()) E(`ui.${k} missing`); else if (ph(v) !== ph(en)) E(`ui.${k} placeholders ${ph(en)} vs ${ph(v)}`); }
  for (const [k, en] of Object.entries(scripts)) for (const f2 of Object.keys(en)) { const v = L.scripts?.[k]?.[f2]; if (typeof v !== "string" || !v.trim()) E(`scripts.${k}.${f2} missing`); }
  for (const [k, en] of Object.entries(scenes)) {
    const v = L.scenes?.[k]; if (!v) { E(`scene ${k} missing`); continue; }
    for (const f2 of ["chapter", "title", "say"]) if (typeof v[f2] !== "string" || !v[f2].trim()) E(`${k}.${f2} missing`);
    if (typeof v.say !== "string") continue;
    if (v.say.length >= 430) E(`${k}.say ${v.say.length} chars (>=430)`);
    if (!Array.isArray(v.keys) || v.keys.length !== en.keys.length) E(`${k}.keys length`);
    else v.keys.forEach((x, n) => { const [shown, anc] = x.includes("::") ? [x.slice(0, x.indexOf("::")), x.slice(x.indexOf("::") + 2)] : [x, x]; if (posIn(v.say, anc) < 0) E(`${k}.keys[${n}] anchor "${anc}" not in say`); if (shown.split(/\s+/).length > 6) E(`${k}.keys[${n}] >6 words`); if (en.keys[n].includes("::") !== x.includes("::")) E(`${k}.keys[${n}] :: mismatch`); });
    for (const g of ["shots", "cam", "rings", "cursor", "callouts", "nodes"]) {
      if (!en[g]) continue; if (!Array.isArray(v[g]) || v[g].length !== en[g].length) { E(`${k}.${g} length`); continue; }
      v[g].forEach((c, n) => { for (const fld of ["on", "off"]) { if (en[g][n][fld] === undefined) continue; if (en[g][n][fld] === "") { if (c[fld] !== "") E(`${k}.${g}[${n}].${fld} must stay ""`); } else if (typeof c[fld] !== "string" || posIn(v.say, c[fld]) < 0) E(`${k}.${g}[${n}].${fld} "${c[fld]}" not in say`); }
        for (const fld of ["text", "title", "sub"]) if (en[g][n][fld] !== undefined && (typeof c[fld] !== "string" || !c[fld].trim())) E(`${k}.${g}[${n}].${fld} missing`); });
    }
    if (en.links) { if (!Array.isArray(v.links) || v.links.length !== en.links.length) E(`${k}.links length`); else v.links.forEach((l, n) => { if (!l.label) E(`${k}.links[${n}].label missing`); }); }
  }
  console.log(loc, err.length ? err.length + " problems" : "ok"); err.slice(0, 300).forEach((m) => console.log("  -", m)); bad += err.length;
}
process.exit(bad ? 1 : 0);
