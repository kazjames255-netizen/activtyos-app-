import fs from "node:fs";
import sharp from "sharp";
import { token, getNote, STAGING_TENANT, ROOT } from "./noteApi";
import { slideBucket } from "../../lib/slideStorage";
async function main() {
const id = "oak-pnH8zTuvYlb7yJbvcanr-n-07fdd12300-ordinal-numbers-show-the-position-of-an-object-in-relation-t";
const tok = await token();
const n = await getNote(tok, id);
const ds = n.lesson!.deckSlides!;
console.log("updatedAt", JSON.stringify(n.updatedAt), "slides", ds.length);
const uses = new Map<string, { slide: number; el: number; w: number; h: number; x: number; y: number; alt: string; crop?: unknown; rot?: number; flip?: boolean }[]>();
ds.forEach((s, si) => (s.blocks as any[]).forEach((b) => b.t === "canvas" && b.els.forEach((e: any, ei: number) => {
  if (e.k !== "img") return;
  const k = e.sid ?? e.imageId ?? e.picId; const a = uses.get(k) ?? []; a.push({ slide: si + 1, el: ei, x: e.x, y: e.y, w: e.w, h: e.h, alt: e.alt, crop: e.crop, rot: e.rot, flip: e.flipH || e.flipV }); uses.set(k, a);
})));
fs.mkdirSync(ROOT + "/scratch/ownart/orig", { recursive: true });
const rows: any[] = [];
let i = 0;
for (const [sid, u] of uses) {
  const [buf] = await slideBucket().file(`hubSlides/${STAGING_TENANT}/${sid}`).download();
  const m = await sharp(buf).metadata();
  const name = String(++i).padStart(2, "0") + "-" + sid.slice(0, 8);
  await sharp(buf).flatten({ background: "#cccccc" }).png().toFile(`${ROOT}/scratch/ownart/orig/${name}.png`);
  rows.push({ n: i, sid, w: m.width, h: m.height, bytes: buf.length, uses: u.length, slides: u.map((x) => x.slide).join(","), dim: u[0]!.w.toFixed(3) + "x" + u[0]!.h.toFixed(3), crop: u.some((x) => x.crop), rot: u.some((x) => x.rot), flip: u.some((x) => x.flip), alt: u[0]!.alt });
}
fs.writeFileSync(ROOT + "/scratch/ownart/inventory.json", JSON.stringify(rows, null, 1));
for (const r of rows) console.log(r.n, r.sid.slice(0, 8), `${r.w}x${r.h}`, `uses${r.uses}`, "s" + r.slides, r.crop ? "CROP" : "", r.rot ? "ROT" : "", r.flip ? "FLIP" : "", JSON.stringify(r.alt).slice(0, 50));


}
main().then(()=>process.exit(0)).catch((e)=>{console.error(e);process.exit(1)});
