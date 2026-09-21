// Oak National Academy lesson crawler (content is OGL v3.0 — see docs/oak-import.md for attribution rules).
// Usage: node server/src/oak/crawl.mjs [--limit N] [--only <programme-substring>] [--list]
// Resumable: a lesson already saved in scratch/oak-raw/ is skipped. Throttled: CONC workers, GAP ms between starts.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(here, "../../../scratch/oak-raw");
const BASE = "https://www.thenational.academy";
const CONC = 3, GAP = 350;
const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const LIMIT = opt("--limit") ? Number(opt("--limit")) : Infinity;
const ONLY = opt("--only");

// Which programmes we want: Maths/English/Science/French/Spanish/German, KS1–KS4. KS4 = AQA board (maths has none: higher+foundation).
const SUBJ = "(maths|english|science|combined-science|biology|chemistry|physics|french|spanish|german)";
const wanted = (prog) => {
  if (!new RegExp(`^${SUBJ}-(primary|secondary)-ks[1-4]`).test(prog)) return false;
  if (!/-ks4/.test(prog)) return true;
  if (/^maths-/.test(prog)) return true;
  return /-aqa$/.test(prog);
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(url, tries = 5) {
  for (let t = 1; t <= tries; t++) {
    try {
      const r = await fetch(url, { headers: { "user-agent": "ActivityOS-oak-import/1.0 (OGL v3.0 content, throttled)" } });
      if (r.status === 404) return null;
      if (r.ok) return await r.text();
      if (r.status === 429 || r.status >= 500) { await sleep(2000 * t * t); continue; }
      throw new Error("HTTP " + r.status);
    } catch (e) { if (t === tries) throw e; await sleep(1500 * t); }
  }
}

/** The page is a Next.js app-router page: its data sits in self.__next_f.push chunks. Pull out the lesson object. */
export function extractLesson(html) {
  const chunks = [...html.matchAll(/self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g)].map((m) => JSON.parse('"' + m[1] + '"'));
  const s = chunks.join("");
  const q = s.indexOf('"starterQuiz"');
  if (q < 0) return null;
  const start = s.lastIndexOf('{"programmeSlug"', q);
  if (start < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inStr) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true; else if (c === "{") depth++; else if (c === "}" && --depth === 0) return JSON.parse(s.slice(start, i + 1));
  }
  return null;
}

async function main() {
  if (process.argv[1] !== fileURLToPath(import.meta.url)) return;
  fs.mkdirSync(OUT, { recursive: true });
  const sm = await get(BASE + "/teachers/sitemap.xml");
  const urls = [...sm.matchAll(/<loc>([^<]*\/programmes\/([^/]+)\/units\/([^/]+)\/lessons\/([^/<]+))<\/loc>/g)]
    .map((m) => ({ url: m[1], prog: m[2], unit: m[3], lesson: m[4] }))
    .filter((u) => wanted(u.prog) && (!ONLY || u.prog.includes(ONLY)));
  console.log(`${urls.length} lessons in scope`);
  if (args.includes("--list")) { const c = {}; urls.forEach((u) => (c[u.prog] = (c[u.prog] || 0) + 1)); console.log(c); return; }
  const todo = urls.filter((u) => !fs.existsSync(path.join(OUT, u.prog, `${u.unit}__${u.lesson}.json`))).slice(0, LIMIT);
  console.log(`${todo.length} to fetch (${urls.length - todo.length} already saved)`);
  let done = 0, failed = 0, i = 0;
  const errLog = fs.createWriteStream(path.join(OUT, "_errors.log"), { flags: "a" });
  const worker = async () => {
    while (i < todo.length) {
      const u = todo[i++];
      await sleep(GAP);
      try {
        const html = await get(u.url);
        const obj = html ? extractLesson(html) : null;
        if (!obj) { failed++; errLog.write(`${u.url}\tno-data\n`); continue; }
        obj._sourceUrl = u.url; obj._fetchedAt = new Date().toISOString();
        fs.mkdirSync(path.join(OUT, u.prog), { recursive: true });
        fs.writeFileSync(path.join(OUT, u.prog, `${u.unit}__${u.lesson}.json`), JSON.stringify(obj));
      } catch (e) { failed++; errLog.write(`${u.url}\t${e.message}\n`); }
      if (++done % 100 === 0) console.log(`${new Date().toISOString().slice(11, 19)} ${done}/${todo.length} (failed ${failed})`);
    }
  };
  await Promise.all(Array.from({ length: CONC }, worker));
  console.log(`finished: ${done} attempted, ${failed} failed`);
}
main();
