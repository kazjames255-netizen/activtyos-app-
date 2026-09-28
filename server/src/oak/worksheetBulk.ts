// Bulk-attach Oak's per-lesson WORKSHEET PDFs (Google Slides export/pdf) to every imported lesson note of one or more tenants,
// so a tutor can set the worksheet as homework and the pupil views it in-platform.
//
//   cd server && npx tsx src/oak/worksheetBulk.ts --tenants <id[,id…]> [--real] [--limit N] [--subject Maths] [--concurrency 2] [--retry-failed] [--redo] [--dry]
//
// Per note: find the raw Oak lesson (unitSlug|lessonSlug → worksheetUrl) → fetch <url>/export/pdf (throttled, backoff, %PDF + size check)
// → store in Firebase Storage tenants/<tid>/oak-worksheets/<noteId>.pdf (NOT Firestore) → write ONLY `worksheetFile` {name,size,pages,…} on the note.
// (The legacy `lesson.worksheet` = the interactive quiz from the old extras is untouched.) Files are cached by Google id under
// scratch/oak-worksheets/cache/ only while in flight; the same worksheet shared by several notes/tenants is downloaded once per run.
// Resumable: scratch/oak-worksheets/state.json (done / failed / unavailable, per noteId) + bulk.log. --dry only counts + estimates.
// SAFETY: the two real tenants need --real (and the owner's approval).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "../firebase";
import { refreshNotesIndex } from "./refreshNotesIndex";
import { hasWorksheetObject, putWorksheetObject, type WorksheetFile } from "../lib/worksheetStorage";

const REAL = new Set(["7jG2XO3cOD3VtoL8YfFY", "jYp5XNZGT7bgSUMuEgHN"]);
const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "../../..");
const RAW = path.join(ROOT, "scratch/oak-raw");
const DIR = path.join(ROOT, "scratch/oak-worksheets");
const STATE = path.join(DIR, "state.json");
const LOG = path.join(DIR, "bulk.log");
const arg = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : undefined; };
const flag = (n: string) => process.argv.includes(`--${n}`);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const MAX_BYTES = 15 * 1024 * 1024, GAP = Number(process.env.OAK_WS_GAP_MS) || 1000;

interface Done { size: number; pages: number; at: string; gid: string }
interface State { done: Record<string, Done>; failed: Record<string, string>; unavailable: Record<string, string>; rate?: { files: number; bytes: number; ms: number } }
fs.mkdirSync(DIR, { recursive: true });
const state: State = (() => { try { return JSON.parse(fs.readFileSync(STATE, "utf8")); } catch { return { done: {}, failed: {}, unavailable: {} }; } })();
const save = () => { fs.writeFileSync(`${STATE}.tmp`, JSON.stringify(state)); fs.renameSync(`${STATE}.tmp`, STATE); };
const log = (s: string) => { const line = `${new Date().toTimeString().slice(0, 8)} ${s}`; console.log(line); fs.appendFileSync(LOG, line + "\n"); };

class Unavailable extends Error {}
let last = 0;
async function fetchPdf(gid: string): Promise<Buffer> {
  const url = `https://docs.google.com/presentation/d/${gid}/export/pdf`;
  let wait = 4000;
  for (let attempt = 1; attempt <= 6; attempt++) {
    const since = Date.now() - last; if (since < GAP) await sleep(GAP - since); last = Date.now();
    try {
      const res = await fetch(url, { redirect: "follow", headers: { "User-Agent": "ActivityOS-oak-import/1.0" } });
      if (res.ok) {
        const b = Buffer.from(await res.arrayBuffer());
        if (b.subarray(0, 5).toString("latin1") !== "%PDF-") throw new Unavailable("not a PDF (sign-in page?)");
        if (b.length < 1000) throw new Unavailable(`PDF too small (${b.length}B)`);
        if (b.length > MAX_BYTES) throw new Unavailable(`PDF too large (${b.length}B)`);
        return b;
      }
      if ([401, 403, 404].includes(res.status)) throw new Unavailable(`HTTP ${res.status}`);
      const ra = Number(res.headers.get("retry-after"));
      await sleep(Number.isFinite(ra) && ra > 0 ? ra * 1000 : wait); wait = Math.min(wait * 2, 120_000);
    } catch (e) {
      if (e instanceof Unavailable || attempt === 6) throw e;
      await sleep(wait); wait = Math.min(wait * 2, 120_000);
    }
  }
  throw new Error("gave up after retries");
}
const pageCount = (b: Buffer) => { const m = b.toString("latin1").match(/\/Type\s*\/Page[^s]/g); return m ? m.length : 0; };

interface Raw { gid: string; title: string }
function rawMap(): Map<string, Raw> {
  const m = new Map<string, Raw>();
  for (const dir of fs.readdirSync(RAW)) {
    const full = path.join(RAW, dir);
    if (dir.startsWith("_") || !fs.statSync(full).isDirectory()) continue;
    for (const f of fs.readdirSync(full)) {
      if (!f.endsWith(".json")) continue;
      try {
        const o = JSON.parse(fs.readFileSync(path.join(full, f), "utf8")) as Record<string, unknown>;
        const gid = String(o.worksheetUrl ?? "").match(/\/presentation\/d\/([A-Za-z0-9_-]{20,80})/)?.[1];
        if (gid && o.unitSlug && o.lessonSlug) m.set(`${o.unitSlug}|${o.lessonSlug}`, { gid, title: String(o.lessonTitle ?? "Worksheet") });
      } catch { /* skip */ }
    }
  }
  return m;
}

interface Job { tenant: string; note: string; gid: string; title: string }
async function main() {
  const tenants = (arg("tenants") ?? "").split(",").filter(Boolean), dry = flag("dry");
  if (!tenants.length) throw new Error("usage: --tenants <id[,id…]> [--real] [--limit N] [--subject S] [--concurrency N] [--retry-failed] [--redo] [--dry]");
  if (tenants.some((t) => REAL.has(t)) && !flag("real") && !dry) throw new Error("a real tenant needs --real");
  const limit = Number(arg("limit")) || Infinity, conc = Math.min(2, Number(arg("concurrency")) || 2), subject = arg("subject")?.toLowerCase();
  if (flag("retry-failed")) { state.failed = {}; save(); }
  if (flag("redo")) { state.done = {}; save(); }
  const map = rawMap();
  log(`raw lessons with a worksheet: ${map.size} · tenants ${tenants.join(", ")}${dry ? " · DRY" : ""}`);
  const jobs: Job[] = []; let total = 0, noRaw = 0, already = 0, skipState = 0;
  for (const tenant of tenants) {
    const snap = await db.collection("hubNotes").where("tenantId", "==", tenant).select("lesson.unitSlug", "lesson.lessonSlug", "subject", "worksheetFile").get();
    total += snap.size;
    for (const d of snap.docs) {
      const u = d.get("lesson.unitSlug"), l = d.get("lesson.lessonSlug");
      if (!u || !l) continue;
      if (subject && !String(d.get("subject") ?? "").toLowerCase().includes(subject)) continue;
      const r = map.get(`${u}|${l}`);
      if (!r) { noRaw++; continue; }
      if (d.get("worksheetFile") && !flag("redo")) { already++; continue; }
      if (state.done[d.id] || state.unavailable[d.id] || state.failed[d.id]) { skipState++; continue; }
      jobs.push({ tenant, note: d.id, gid: r.gid, title: r.title });
    }
  }
  jobs.sort((a, b) => a.gid.localeCompare(b.gid)); // same worksheet (several tenants / duplicate lessons) back to back → downloaded once
  const uniq = new Set(jobs.map((j) => j.gid)).size;
  const avg = state.rate?.files ? state.rate.bytes / state.rate.files : 411_000;
  const perFile = state.rate?.files ? state.rate.ms / state.rate.files : 3000;
  log(`notes ${total} · no worksheet in raw ${noRaw} · already attached ${already} · skipped by state ${skipState} · TO DO ${jobs.length} notes (${uniq} distinct PDFs) · est ${(jobs.length * avg / 1e9).toFixed(2)} GB · ETA ${(jobs.length * perFile / 3.6e6).toFixed(1)} h`);
  if (dry) return;

  // --limit N samples N notes spread evenly across the list (so a pilot covers many subjects), not just the first N.
  const step = jobs.length > limit ? jobs.length / limit : 1;
  const todo = Number.isFinite(limit) && jobs.length > limit ? Array.from({ length: limit }, (_, i) => jobs[Math.floor(i * step)]!) : jobs, cache = new Map<string, Promise<Buffer>>();
  let next = 0, ok = 0, bad = 0;
  const pending = new Map<string, string[]>(); // tenant → notes written since the last index refresh
  const flush = async () => { for (const [t, ids] of pending) { if (ids.length) await refreshNotesIndex(t, ids.splice(0)); } };
  const started = Date.now();
  async function run(j: Job, w: number) {
    const t0 = Date.now();
    try {
      let p = cache.get(j.gid); if (!p) { p = fetchPdf(j.gid); cache.set(j.gid, p); if (cache.size > 40) cache.delete(cache.keys().next().value!); }
      const b = await p;
      const pages = pageCount(b);
      await putWorksheetObject(j.tenant, j.note, b);
      if (!(await hasWorksheetObject(j.tenant, j.note))) throw new Error("stored object not found after save");
      const name = `${j.title} - worksheet`.slice(0, 200);
      const wf: WorksheetFile = { name, size: b.length, ...(pages ? { pages } : {}), source: `oak:${j.gid}`, fetchedAt: new Date().toISOString() };
      await db.collection("hubNotes").doc(j.note).update({ worksheetFile: wf });
      state.done[j.note] = { size: b.length, pages, at: wf.fetchedAt!, gid: j.gid };
      state.rate = { files: (state.rate?.files ?? 0) + 1, bytes: (state.rate?.bytes ?? 0) + b.length, ms: (state.rate?.ms ?? 0) + (Date.now() - t0) / conc };
      (pending.get(j.tenant) ?? pending.set(j.tenant, []).get(j.tenant)!).push(j.note);
      if ([...pending.values()].reduce((a, x) => a + x.length, 0) >= 200) await flush(); // throttled: every 200 notes
      ok++; log(`ok   w${w} ${j.note} · ${pages}p · ${Math.round(b.length / 1024)}KB · ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    } catch (e) {
      bad++; const msg = (e as Error).message.replace(/\s+/g, " ").slice(0, 300);
      if (e instanceof Unavailable) state.unavailable[j.note] = msg; else state.failed[j.note] = msg;
      cache.delete(j.gid); log(`FAIL w${w} ${j.note} · ${msg}`);
    }
    if ((ok + bad) % 10 === 0) save();
    if ((ok + bad) % 100 === 0) log(`--- progress ${ok + bad}/${todo.length} · ok ${ok} · fail ${bad} · ${((Date.now() - started) / 60000).toFixed(0)} min`);
  }
  await Promise.all(Array.from({ length: conc }, async (_, i) => { while (true) { const j = todo[next++]; if (!j) return; await run(j, i + 1); } }));
  save();
  await flush();
  if (ok > 0) for (const t of new Set(todo.map((j) => j.tenant))) await refreshNotesIndex(t); // final: drop index + disk snapshot so a restart can't serve a snapshot without worksheets
  log(`DONE ok ${ok} fail ${bad} in ${((Date.now() - started) / 60000).toFixed(1)} min`);
  log(`INDEX: the running API was refreshed automatically (every 200 notes + a final full drop). If the API was down, run: cd server && npx tsx src/oak/refreshNotesIndex.ts --tenants ${tenants.join(",")}${tenants.some((t) => REAL.has(t)) ? " --real" : ""}`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });