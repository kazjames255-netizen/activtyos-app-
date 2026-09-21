// Import ONE lesson's real Oak slide deck into a hub note as editable canvas slides (lesson.deckSlides).
//
//   cd server && npx tsx src/oak/deckImport.ts --tenant <tenantId> --note <noteId> --deck <googleSlidesId> --login <email> [--dry]
//
// download (deckDownload.ts, cached) → convert (deckConvert.ts) → pictures resized to WebP and stored in Firebase Storage
// (slideImages.ts → lib/slideStorage.ts) → PATCH /api/learning-hub/notes/:id {lesson:{deckSlides}} as that tenant's tutor, so the
// API's own validation (oak/canvasSchema.ts) is what accepts it. `lesson.slides` (our summary slides) and `lesson.oakDeck`
// (the iframe fallback) are left exactly as they are. Password for --login: E2etest!123 (the oakstaging-* accounts).
// SAFETY: refuses the two real tenants; only ever intended for the staging tenant.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { convertPptx } from "./deckConvert";
import { downloadDeck } from "./deckDownload";
import { prepareSlideImage, putSlideImage } from "./slideImages";

const REAL_TENANTS = new Set(["7jG2XO3cOD3VtoL8YfFY", "jYp5XNZGT7bgSUMuEgHN"]);
const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "../../..");
const arg = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : undefined; };
const API = process.env.OAK_API || "http://localhost:4000";

function apiKey(): string {
  if (process.env.NEXT_PUBLIC_FIREBASE_API_KEY) return process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  for (const line of fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split("\n")) { const m = line.match(/^\s*NEXT_PUBLIC_FIREBASE_API_KEY\s*=\s*(.*)\s*$/); if (m) return m[1]!.replace(/^["']|["']$/g, ""); }
  throw new Error("NEXT_PUBLIC_FIREBASE_API_KEY not found");
}

async function main() {
  const tenant = arg("tenant"), note = arg("note"), deck = arg("deck"), login = arg("login"), dry = process.argv.includes("--dry");
  if (!tenant || !deck || (!dry && (!note || !login))) throw new Error("usage: --tenant <id> --deck <googleId> [--note <id> --login <email>] [--dry]");
  if (REAL_TENANTS.has(tenant)) throw new Error("refusing to write to a real tenant");
  const pptx = await downloadDeck(deck);
  console.log(`deck ${deck}: ${(pptx.length / 1e6).toFixed(1)}MB pptx`);
  const putImage = async (src: Buffer) => {
    const p = await prepareSlideImage(src);
    if (dry) return { id: "0".repeat(64) + ".webp", bytes: p.bytes.length, width: p.width, height: p.height, mime: p.mime };
    const { sid } = await putSlideImage(tenant, p.bytes, p.mime);
    return { id: sid, bytes: p.bytes.length, width: p.width, height: p.height, mime: p.mime };
  };
  const { slides, stats } = await convertPptx(pptx, { putImage });
  const out = path.join(ROOT, "scratch/oak-decks", `${deck}.canvas.json`);
  fs.writeFileSync(out, JSON.stringify(slides));
  const total = stats.images.reduce((a, i) => a + i.outBytes, 0), src = stats.images.reduce((a, i) => a + i.srcBytes, 0);
  console.log(`slides ${stats.slidesKept}/${stats.slidesTotal} (dropped ${JSON.stringify(stats.dropped)}), elements ${stats.els}, json ${(JSON.stringify(slides).length / 1024).toFixed(0)}KB`);
  console.log(`images ${stats.images.length}: ${(src / 1024).toFixed(0)}KB -> ${(total / 1024).toFixed(0)}KB, largest ${Math.max(0, ...stats.images.map((i) => i.outBytes)) / 1024 | 0}KB, warnings ${stats.warnings.length}`);
  for (const w of stats.warnings.slice(0, 10)) console.log("  warn:", w);
  if (dry) return;

  const key = apiKey();
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${key}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: login, password: process.env.OAK_PW || "E2etest!123", returnSecureToken: true }) });
  const j = (await r.json()) as { idToken?: string };
  if (!j.idToken) throw new Error("login failed");
  const res = await fetch(`${API}/api/learning-hub/notes/${note}`, { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${j.idToken}` }, body: JSON.stringify({ lesson: { deckSlides: slides } }) });
  const text = await res.text();
  if (!res.ok) throw new Error(`PATCH ${res.status} ${text.slice(0, 400)}`);
  console.log("saved to note", note, "->", res.status);
}
main().catch((e) => { console.error(e); process.exit(1); });
