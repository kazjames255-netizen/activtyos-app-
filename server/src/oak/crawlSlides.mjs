// Oak lesson-factory crawler #2: the TEXT of each lesson's Oak slide deck and worksheet (Google Slides "export/txt", publicly
// downloadable; OGL v3.0 content — see docs/oak-import.md). Source of the teaching text for the slide-deck generator / the
// authoring agents. Resumable (a lesson already saved is skipped) and throttled.
//   node server/src/oak/crawlSlides.mjs [--only <programme-substring>] [--limit N] [--pdf]   (--pdf also saves the worksheet as a PDF)
// Output: scratch/oak-slides/<subject>-<ks>/<unitSlug>__<lessonSlug>.json  { presentation, worksheet, fetchedAt }
//         scratch/oak-slides/_pdf/<subject>-<ks>/<unitSlug>__<lessonSlug>.pdf (with --pdf)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const RAW = path.resolve(here, "../../../scratch/oak-raw");
const OUT = path.resolve(here, "../../../scratch/oak-slides");
const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const CURATED = args.includes("--curated"); // only lessons that have a curated/<unit>__<lesson>.json override (their worksheets get attached as PDFs)
const curatedKeys = CURATED ? new Set(fs.readdirSync(path.resolve(here, "curated")).filter((x) => x.endsWith(".json")).map((x) => x.replace(/\.json$/, ""))) : null;
const ONLY = opt("--only"); const LIMIT = opt("--limit") ? Number(opt("--limit")) : Infinity; const PDF = args.includes("--pdf");
const CONC = 10;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const gid = (u) => String(u ?? "").match(/\/d\/([^/]+)/)?.[1] ?? null;

export const outName = (o) => `${String(o.subjectTitle).toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${o.keyStageSlug}/${o.unitSlug}__${o.lessonSlug}`;

async function get(url, kind, tries = 6) {
  for (let t = 1; t <= tries; t++) {
    try {
      const r = await fetch(url, { redirect: "follow" });
      if (r.status === 404 || r.status === 403) return null;
      if (r.ok) return kind === "bin" ? Buffer.from(await r.arrayBuffer()) : await r.text();
      if (r.status === 429 || r.status >= 500) { await sleep(3000 * t * t); continue; }
      return null;
    } catch (e) { if (t === tries) return null; await sleep(1500 * t); }
  }
  return null;
}

async function main() {
  const seen = new Set(); const jobs = [];
  for (const prog of fs.readdirSync(RAW).sort()) {
    const dp = path.join(RAW, prog);
    if (!fs.statSync(dp).isDirectory() || (ONLY && !prog.includes(ONLY))) continue;
    for (const f of fs.readdirSync(dp).filter((x) => x.endsWith(".json")).sort()) {
      let o; try { o = JSON.parse(fs.readFileSync(path.join(dp, f), "utf8")); } catch { continue; }
      const key = `${o.subjectTitle}|${o.keyStageSlug}|${o.unitSlug}|${o.lessonSlug}`;
      if (seen.has(key)) continue; seen.add(key);
      if (curatedKeys && !curatedKeys.has(`${o.unitSlug}__${o.lessonSlug}`)) continue;
      const name = outName(o);
      const done = fs.existsSync(path.join(OUT, name + ".json")) && (!PDF || fs.existsSync(path.join(OUT, "_pdf", name + ".pdf")) || !gid(o.worksheetUrl));
      if (!done) jobs.push({ name, pres: gid(o.presentationUrl), ws: gid(o.worksheetUrl) });
    }
  }
  const todo = jobs.slice(0, LIMIT);
  console.log(`${seen.size} unique lessons, ${todo.length} to fetch`);
  let i = 0, ok = 0, miss = 0; const t0 = Date.now();
  async function worker() {
    for (;;) {
      const j = todo[i++]; if (!j) return;
      const file = path.join(OUT, j.name + ".json");
      let rec = null; try { rec = JSON.parse(fs.readFileSync(file, "utf8")); } catch {}
      if (!rec) {
        const [presentation, worksheet] = await Promise.all([
          j.pres ? get(`https://docs.google.com/presentation/d/${j.pres}/export/txt`, "txt") : null,
          j.ws ? get(`https://docs.google.com/presentation/d/${j.ws}/export/txt`, "txt") : null,
        ]);
        rec = { presentation: presentation ?? "", worksheet: worksheet ?? "", fetchedAt: new Date().toISOString() };
        if (!presentation) miss++;
        fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(rec));
      }
      if (PDF && j.ws) {
        const pf = path.join(OUT, "_pdf", j.name + ".pdf");
        if (!fs.existsSync(pf)) { const b = await get(`https://docs.google.com/presentation/d/${j.ws}/export/pdf`, "bin"); if (b && b.length > 500) { fs.mkdirSync(path.dirname(pf), { recursive: true }); fs.writeFileSync(pf, b); } }
      }
      ok++; if (ok % 200 === 0) console.log(`  ${ok}/${todo.length} (${((Date.now() - t0) / 1000).toFixed(0)}s, ${miss} without presentation text)`);
    }
  }
  await Promise.all(Array.from({ length: CONC }, worker));
  console.log(`done: ${ok} fetched, ${miss} without presentation text, ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
main();
