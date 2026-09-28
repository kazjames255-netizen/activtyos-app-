// Removes the publisher's name / credit / links from STORED lesson content (see noOak.ts for the rules).
//
//   cd server
//   npx tsx src/oak/purgeOakText.ts --tenants pnH8zTuvYlb7yJbvcanr                 # DRY (default): counts + samples, writes nothing
//   npx tsx src/oak/purgeOakText.ts --tenants pnH8zTuvYlb7yJbvcanr --apply         # staging: real write
//   npx tsx src/oak/purgeOakText.ts --tenants 7jG2XO3cOD3VtoL8YfFY,jYp5XNZGT7bgSUMuEgHN,shared-library --apply --real   # owner-approved only
//   options: --collections hubNotes,hubQuestions,...  --report out.json  --reset (ignore saved progress)
//
// Idempotent (a clean doc is never written), resumable (per tenant+collection progress file in scratch/), reads by id chunks so
// memory stays flat on 8k-note tenants. Any tenant other than the staging tenant needs --real to WRITE; without --apply nothing is
// ever written. Only changed fields are updated (`lesson.<k>` for lesson sub-fields), internal ids/provenance are never touched.
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "../firebase";
import { shardedTenantRead } from "../lib/hubIndex";
import { scrubDeep, findOakDeep } from "./noOak";

const STAGING = "pnH8zTuvYlb7yJbvcanr";
const arg = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : undefined; };
const has = (n: string) => process.argv.includes(`--${n}`);
const DROP_TITLES = has("drop-blank"), DROP_BLANK = false, APPLY = has("apply"), REAL = has("real");
const TENANTS = (arg("tenants") ?? "").split(",").filter(Boolean);
const COLS = (arg("collections") ?? "hubNotes,hubQuestions,hubAssessments,hubFlashcards,hubTopics,hubHomework").split(",");
const SCRATCH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../scratch");
if (!TENANTS.length) { console.error("usage: --tenants a,b [--apply [--real]] [--collections ...]"); process.exit(1); }
const realOnes = TENANTS.filter((t) => t !== STAGING);
if (APPLY && realOnes.length && !REAL) { console.error(`refusing to WRITE to non-staging tenant(s) ${realOnes.join(",")} without --real`); process.exit(1); }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function retry<T>(f: () => Promise<T>): Promise<T> { for (let a = 1; ; a++) { try { return await f(); } catch (e) { if (a >= 6) throw e; await sleep(1500 * a); } } }

interface Tot { scanned: number; docsWithOak: number; docsChanged: number; strings: number; slidesDropped: number; leftover: number; samples: string[]; byField: Record<string, number>; unreadable: string[] }
async function run() {
  fs.mkdirSync(SCRATCH, { recursive: true });
  const report: Record<string, Record<string, Tot>> = {};
  for (const tenant of TENANTS) for (const col of COLS) {
    const tot: Tot = { scanned: 0, docsWithOak: 0, docsChanged: 0, strings: 0, slidesDropped: 0, leftover: 0, samples: [], byField: {}, unreadable: [] };
    (report[tenant] ??= {})[col] = tot;
    const pf = path.join(SCRATCH, `purge-oak-progress-${tenant}-${col}-${(arg("shard") ?? "0/1").replace("/", "of")}.json`);
    let resumeAfter = ""; if (APPLY && !has("reset") && fs.existsSync(pf)) resumeAfter = JSON.parse(fs.readFileSync(pf, "utf8")).lastId ?? "";
    const idDocs = await retry(() => shardedTenantRead(db.collection(col), tenant, []));
    const SH = (arg("shard") ?? "0/1").split("/").map(Number) as [number, number];
    const ids = idDocs.map((d) => d.id).sort().filter((_, ix) => ix % SH[1]! === SH[0]!);
    const CH = Number(arg("chunk") ?? 25);
    for (let i = 0; i < ids.length; i += CH) {
      const chunk = ids.slice(i, i + CH).filter((id) => id > resumeAfter);
      if (!chunk.length) continue;
      const withTimeout = <T,>(p: Promise<T>, ms: number) => Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);
      let snaps: FirebaseFirestore.DocumentSnapshot[] = [];
      try { snaps = await withTimeout(db.getAll(...chunk.map((id) => db.collection(col).doc(id))), 60_000); }
      catch {
        for (const id of chunk) { // one by one: isolate a document that will not load
          let got = false;
          for (let a = 0; a < 3 && !got; a++) { try { snaps.push(await withTimeout(db.collection(col).doc(id).get(), 60_000)); got = true; } catch { /* retry */ } }
          if (!got) { tot.unreadable.push(id); console.warn(`  UNREADABLE ${col}/${id} (timed out 3x)`); }
        }
      }
      if (has("verbose")) console.log(`    chunk ${i} ok`);
      let batch = db.batch(), n = 0;
      for (const d of snaps) {
        if (!d.exists) continue;
        tot.scanned++;
        const data = d.data() as Record<string, unknown>;
        if (!findOakDeep(data, 1).length && !(DROP_TITLES && Array.isArray((data.lesson as { deckSlides?: unknown[] } | undefined)?.deckSlides))) continue;
        tot.docsWithOak++;
        const upd: Record<string, unknown> = {};
        const hasImgOrText = (sl: unknown) => { let ok = false; const w = (x: unknown) => { if (ok) return; if (Array.isArray(x)) x.forEach(w); else if (x && typeof x === "object") { const o = x as Record<string, unknown>; if (o.k === "img" || o.t === "img") ok = true; else if (typeof o.t === "string" && o.t.trim() && o.t !== "canvas") ok = true; else Object.values(o).forEach(w); } }; w(sl); return ok; };
        const one = (key: string, val: unknown) => {
          if (DROP_BLANK && key === "lesson.deckSlides" && Array.isArray(val) && val.length && val.some((sl) => !hasImgOrText(sl))) { const kept = val.filter(hasImgOrText); tot.slidesDropped += val.length - kept.length; tot.byField[key] = (tot.byField[key] ?? 0) + 1; upd[key] = kept; val = kept; } const r = scrubDeep(val, key.split(".").pop()); if (r.changed) { upd[key] = r.value; tot.strings += r.strings; tot.slidesDropped += r.slidesDropped; tot.byField[key] = (tot.byField[key] ?? 0) + 1; } };
        for (const [k, v] of Object.entries(data)) {
          if (k === "lesson" && v && typeof v === "object") for (const [lk, lv] of Object.entries(v as Record<string, unknown>)) { if (lk !== "source" && lk !== "oakDeck") one(`lesson.${lk}`, lv); }
          else if (k === "createdByName" && typeof v === "string" && findOakDeep({ v }, 1).length) { upd[k] = "Worksheet library"; tot.strings++; tot.byField[k] = (tot.byField[k] ?? 0) + 1; }
          else if (!["source", "id", "tenantId", "createdBy"].includes(k)) one(k, v);
        }
        if (Object.keys(upd).length) {
          tot.docsChanged++;
          if (tot.samples.length < 6) { const h = findOakDeep(data, 1)[0]; tot.samples.push(h ? `${d.id} ${h.path}: "${h.sample.slice(0, 90)}"` : `${d.id} (blank slide)`); }
          // verify the result is clean before writing (leftover = still mentions after scrub)
          const merged = JSON.parse(JSON.stringify(data)); for (const [k, v] of Object.entries(upd)) { const p = k.split("."); let o = merged; for (const q of p.slice(0, -1)) o = o[q]; o[p[p.length - 1]!] = v; }
          if (findOakDeep(merged, 1).length) tot.leftover++;
          if (APPLY) { batch.update(d.ref, upd); if (++n >= 25) { await retry(() => batch.commit()); batch = db.batch(); n = 0; } }
        } else tot.leftover++;
      }
      if (APPLY && n) await retry(() => batch.commit());
      if (APPLY) fs.writeFileSync(pf, JSON.stringify({ lastId: chunk[chunk.length - 1] }));
      if (Math.floor(i / CH) % Math.max(1, Math.round(200 / CH)) === 0) console.log(`  ${tenant} ${col} shard ${SH.join("/")}: ${Math.min(i + CH, ids.length)}/${ids.length} · mention docs so far ${tot.docsWithOak} · would change ${tot.docsChanged} · slides dropped ${tot.slidesDropped} · unresolved ${tot.leftover}`);
    }
    if (APPLY) fs.rmSync(pf, { force: true });
    console.log(`${APPLY ? "APPLIED" : "DRY"} ${tenant} ${col}: scanned ${tot.scanned}, docs w/ mention ${tot.docsWithOak}, docs ${APPLY ? "changed" : "to change"} ${tot.docsChanged}, strings ${tot.strings}, slides dropped ${tot.slidesDropped}, unresolved ${tot.leftover}`);
  }
  const out = arg("report"); if (out) fs.writeFileSync(out, JSON.stringify(report, null, 1));
  console.log(JSON.stringify(report, null, 1));
}
run().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
