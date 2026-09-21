// Bulk-import Oak's REAL slide decks (editable canvas slides → lesson.deckSlides) for every imported lesson of one or more tenants.
//
//   cd server && npx tsx src/oak/deckBulk.ts --tenants <id[,id…]> [--real] [--limit N] [--subject Maths] [--concurrency 4] [--retry-failed] [--redo] [--watch <doneFile>] [--dry]
//
// Per lesson: download the pptx ONCE (deckDownload.ts, throttled) → convert once (deckConvert.ts) with pictures stored for EVERY target
// tenant (content-addressed, so the same sid) → PATCH each tenant's note as that tenant's tutor (the API's own validation accepts it)
// → DELETE the cached pptx (disk is small: 7k decks would not fit).
// Resumable: scratch/oak-decks/bulk-state.json remembers what is done / failed / unavailable; log = scratch/oak-decks/bulk.log.
// --watch <file>: keep polling for notes another process (import.ts) is still creating; exit once <file> exists and nothing is left.
// SAFETY: the two real tenants need --real. A lesson whose deck cannot be fetched/converted/saved keeps its generated deck (nothing is removed).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { auth, db } from "../firebase";
import { convertPptx } from "./deckConvert";
import { DECK_DIR, DeckUnavailable, downloadDeck } from "./deckDownload";
import { prepareSlideImage, putSlideImage } from "./slideImages";

/** The owner's real tenants → the tutor account each one is signed in as (a custom token is minted; no password needed). */
const REAL_TUTORS: Record<string, string> = { "7jG2XO3cOD3VtoL8YfFY": "amirfreelancer@gmail.com", "jYp5XNZGT7bgSUMuEgHN": "amirfreelaner2@gmail.com" };
const STAGING_LOGIN = "oakstaging-tutor-mu8p3mve@example.com";
const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "../../..");
const RAW = path.join(ROOT, "scratch/oak-raw");
const STATE = path.join(DECK_DIR, "bulk-state.json");
const LOG = path.join(DECK_DIR, "bulk.log");
const API = process.env.OAK_API || "http://localhost:4000";
const arg = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : undefined; };
const flag = (n: string) => process.argv.includes(`--${n}`);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface State { done: Record<string, { deck: string; slides: number; kb: number; at: string }>; failed: Record<string, string>; unavailable: Record<string, string> }
const load = (): State => { try { return JSON.parse(fs.readFileSync(STATE, "utf8")); } catch { return { done: {}, failed: {}, unavailable: {} }; } };
const state = load();
let dirty = 0;
const save = () => { fs.writeFileSync(`${STATE}.tmp`, JSON.stringify(state)); fs.renameSync(`${STATE}.tmp`, STATE); dirty = 0; };
const log = (s: string) => { const line = `${new Date().toTimeString().slice(0, 8)} ${s}`; console.log(line); fs.appendFileSync(LOG, line + "\n"); };

function apiKey(): string {
  if (process.env.NEXT_PUBLIC_FIREBASE_API_KEY) return process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  for (const line of fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split("\n")) { const m = line.match(/^\s*NEXT_PUBLIC_FIREBASE_API_KEY\s*=\s*(.*)\s*$/); if (m) return m[1]!.replace(/^["']|["']$/g, ""); }
  throw new Error("NEXT_PUBLIC_FIREBASE_API_KEY not found");
}
const tokens = new Map<string, { v: string; at: number }>();
async function token(tenant: string, force = false): Promise<string> {
  const hit = tokens.get(tenant);
  if (!force && hit && Date.now() - hit.at < 40 * 60_000) return hit.v;
  const email = REAL_TUTORS[tenant];
  let url: string, body: Record<string, unknown>;
  if (email) {
    const uid = (await auth.getUserByEmail(email)).uid;
    url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey()}`;
    body = { token: await auth.createCustomToken(uid), returnSecureToken: true };
  } else {
    url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey()}`;
    body = { email: STAGING_LOGIN, password: process.env.OAK_PW || "E2etest!123", returnSecureToken: true };
  }
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = (await r.json()) as { idToken?: string };
  if (!j.idToken) throw new Error(`login failed for tenant ${tenant}`);
  tokens.set(tenant, { v: j.idToken, at: Date.now() });
  return j.idToken;
}

/** `${unitSlug}|${lessonSlug}` → Google Slides id, from the crawler's raw files. */
function deckMap(): Map<string, string> {
  const decks = new Map<string, string>();
  for (const dir of fs.readdirSync(RAW)) {
    if (dir.startsWith("_")) continue;
    const full = path.join(RAW, dir);
    if (!fs.statSync(full).isDirectory()) continue;
    for (const f of fs.readdirSync(full)) {
      if (!f.endsWith(".json")) continue;
      try {
        const o = JSON.parse(fs.readFileSync(path.join(full, f), "utf8")) as Record<string, unknown>;
        const id = String(o.presentationUrl ?? "").match(/\/presentation\/d\/([A-Za-z0-9_-]{20,80})/)?.[1];
        if (id && o.unitSlug && o.lessonSlug) decks.set(`${o.unitSlug}|${o.lessonSlug}`, id);
      } catch { /* skip unreadable */ }
    }
  }
  return decks;
}

interface Job { deck: string; label: string; notes: { tenant: string; note: string }[] }

async function collect(tenants: string[], map: Map<string, string>, subject: string | undefined): Promise<{ jobs: Job[]; total: number; noDeck: number }> {
  const byKey = new Map<string, Job>();
  let total = 0, noDeck = 0;
  for (const tenant of tenants) {
    const snap = await db.collection("hubNotes").where("tenantId", "==", tenant).select("lesson.unitSlug", "lesson.lessonSlug", "subject").get();
    total += snap.size;
    for (const d of snap.docs) {
      const u = d.get("lesson.unitSlug"), l = d.get("lesson.lessonSlug");
      if (!u || !l) continue;
      if (subject && !String(d.get("subject") ?? "").toLowerCase().includes(subject)) continue;
      const deck = map.get(`${u}|${l}`);
      if (!deck) { noDeck++; continue; }
      if (state.done[d.id] || state.unavailable[d.id] || state.failed[d.id]) continue;
      const job = byKey.get(`${u}|${l}`) ?? { deck, label: `${u}/${l}`, notes: [] };
      job.notes.push({ tenant, note: d.id });
      byKey.set(`${u}|${l}`, job);
    }
  }
  return { jobs: [...byKey.values()].sort((a, b) => a.label.localeCompare(b.label)), total, noDeck };
}

async function main() {
  const tenants = (arg("tenants") ?? arg("tenant") ?? "").split(",").filter(Boolean), dry = flag("dry");
  if (!tenants.length) throw new Error("usage: --tenants <id[,id…]> [--real] [--limit N] [--subject S] [--concurrency N] [--retry-failed] [--redo] [--watch <doneFile>] [--dry]");
  if (tenants.some((t) => REAL_TUTORS[t]) && !flag("real")) throw new Error("a real tenant needs --real");
  const limit = Number(arg("limit")) || Infinity, conc = Number(arg("concurrency")) || 4, subject = arg("subject")?.toLowerCase(), watch = arg("watch");
  if (flag("retry-failed")) { state.failed = {}; save(); }
  if (flag("redo")) { state.done = {}; save(); }
  const map = deckMap();
  log(`raw lessons with a deck: ${map.size} · tenants ${tenants.join(", ")}`);
  const started = Date.now();
  let ok = 0, bad = 0, handled = 0;

  const putImage = async (src: Buffer) => {
    const p = await prepareSlideImage(src);
    let sid = "";
    for (const t of tenants) sid = (await putSlideImage(t, p.bytes, p.mime)).sid;
    return { id: sid, bytes: p.bytes.length, width: p.width, height: p.height, mime: p.mime };
  };

  async function runJob(j: Job, w: number) {
    const t0 = Date.now();
    try {
      const pptx = await downloadDeck(j.deck);
      const { slides, stats } = await convertPptx(pptx, { putImage });
      if (!slides.length) throw new Error("converted to 0 slides");
      const body = JSON.stringify({ lesson: { deckSlides: slides } });
      for (const n of j.notes) {
        const send = async (force: boolean) => fetch(`${API}/api/learning-hub/notes/${n.note}`, { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${await token(n.tenant, force)}` }, body });
        // The dev API restarts whenever a source file is saved: retry network errors / 502-504 with a back-off instead of failing the lesson.
        let res!: Response;
        for (let attempt = 1; attempt <= 5; attempt++) {
          try { res = await send(false); if (res.status === 401) res = await send(true); if (![502, 503, 504].includes(res.status)) break; } catch (e) { if (attempt === 5) throw e; }
          await sleep(4000 * attempt);
        }
        if (!res.ok) throw new Error(`PATCH ${n.note} ${res.status} ${(await res.text()).slice(0, 200)}`);
        state.done[n.note] = { deck: j.deck, slides: slides.length, kb: Math.round(body.length / 1024), at: new Date().toISOString() };
      }
      try { fs.unlinkSync(path.join(DECK_DIR, `${j.deck}.pptx`)); } catch { /* already gone */ }
      ok++;
      log(`ok   w${w} ${j.label} · x${j.notes.length} · ${slides.length}/${stats.slidesTotal} slides · ${stats.images.length} pics · ${Math.round(body.length / 1024)}KB · ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    } catch (e) {
      bad++;
      const msg = (e as Error).message.replace(/\s+/g, " ").slice(0, 300);
      for (const n of j.notes) { if (e instanceof DeckUnavailable) state.unavailable[n.note] = msg; else if (!state.done[n.note]) state.failed[n.note] = msg; }
      log(`FAIL w${w} ${j.label} · ${msg}`);
    }
    if (++dirty >= 10) save();
    if (++handled % 50 === 0) log(`--- progress ${handled} handled · ok ${ok} · fail ${bad} · ${((Date.now() - started) / 60000).toFixed(0)} min`);
  }

  while (true) {
    const { jobs, total, noDeck } = await collect(tenants, map, subject);
    log(`notes ${total} · no real deck ${noDeck} · done ${Object.keys(state.done).length} · unavailable ${Object.keys(state.unavailable).length} · failed ${Object.keys(state.failed).length} · TO DO ${jobs.length} lessons`);
    if (dry) return;
    const todo = jobs.slice(0, Math.max(0, limit - handled));
    if (todo.length) {
      let next = 0;
      await Promise.all(Array.from({ length: conc }, async (_, i) => { while (true) { const j = todo[next++]; if (!j) return; await runJob(j, i + 1); } }));
      save();
      if (handled >= limit) break;
      continue;
    }
    if (watch && !fs.existsSync(watch)) { await sleep(120_000); continue; }
    break;
  }
  save();
  log(`DONE ok ${ok} fail ${bad} in ${((Date.now() - started) / 60000).toFixed(1)} min`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
