// Download Oak's real slide decks as .pptx (Google Slides export) — throttled, retrying, resumable, cached on disk.
//
//   const pptx = await downloadDeck("1W_7jRXxLm994WxI1BKQVv8v61GLg-wHWOWs8R5HI9wc");
//
// Cache: scratch/oak-decks/<id>.pptx (a file that is a readable zip is never fetched again, so an interrupted bulk run resumes
// where it stopped). Permanent failures (deck not shared / deleted) are remembered in scratch/oak-decks/failed.json and skipped.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const DECK_DIR = path.resolve(here, "../../../scratch/oak-decks");
const FAILED = path.join(DECK_DIR, "failed.json");
const ID = /^[A-Za-z0-9_-]{20,80}$/;

let last = 0;
/** Minimum gap between two requests to Google (ms). Override with OAK_DECK_GAP_MS. Google has no published quota for the public
 *  export endpoint; ~1 request / 1.5s per IP has been fine, and a 429 backs off (below) instead of being hammered. */
const gap = () => Number(process.env.OAK_DECK_GAP_MS) || 1500;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const isZip = (b: Buffer) => b.length > 1000 && b[0] === 0x50 && b[1] === 0x4b;
const failedMap = (): Record<string, string> => { try { return JSON.parse(fs.readFileSync(FAILED, "utf8")); } catch { return {}; } };

export class DeckUnavailable extends Error {}

export async function downloadDeck(id: string, opts: { force?: boolean } = {}): Promise<Buffer> {
  if (!ID.test(id)) throw new Error("bad deck id");
  fs.mkdirSync(DECK_DIR, { recursive: true });
  const file = path.join(DECK_DIR, `${id}.pptx`);
  if (!opts.force && fs.existsSync(file)) { const b = fs.readFileSync(file); if (isZip(b)) return b; }
  const known = failedMap()[id];
  if (known && !opts.force) throw new DeckUnavailable(known);
  const url = `https://docs.google.com/presentation/d/${id}/export/pptx`;
  let wait = 4000;
  for (let attempt = 1; attempt <= 6; attempt++) {
    const since = Date.now() - last;
    if (since < gap()) await sleep(gap() - since);
    last = Date.now();
    try {
      const res = await fetch(url, { redirect: "follow", headers: { "User-Agent": "ActivityOS-oak-import/1.0" } });
      if (res.ok) {
        const b = Buffer.from(await res.arrayBuffer());
        if (!isZip(b)) throw new DeckUnavailable("not a pptx (sign-in page?)");
        fs.writeFileSync(`${file}.part`, b); fs.renameSync(`${file}.part`, file);
        return b;
      }
      if (res.status === 404 || res.status === 403 || res.status === 401) throw new DeckUnavailable(`HTTP ${res.status}`);
      const ra = Number(res.headers.get("retry-after"));
      await sleep(Number.isFinite(ra) && ra > 0 ? ra * 1000 : wait);          // 429 / 5xx: honour Retry-After, else back off
      wait = Math.min(wait * 2, 120_000);
    } catch (e) {
      if (e instanceof DeckUnavailable) { fs.writeFileSync(FAILED, JSON.stringify({ ...failedMap(), [id]: e.message }, null, 1)); throw e; }
      if (attempt === 6) throw e;
      await sleep(wait); wait = Math.min(wait * 2, 120_000);
    }
  }
  throw new Error(`deck ${id}: gave up after retries`);
}
