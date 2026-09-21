// Dev tool: alpha bounding box + dominant colour of every original picture, so the replacement art fills the same box.
import fs from "node:fs";
import sharp from "sharp";
import { ROOT } from "./noteApi";
import { slideBucket } from "../../lib/slideStorage";
async function main() {
  const inv = JSON.parse(fs.readFileSync(`${ROOT}/scratch/ownart/inventory.json`, "utf8")) as { n: number; sid: string }[];
  const out: Record<string, unknown> = {};
  for (const r of inv) {
    const [buf] = await slideBucket().file(`hubSlides/pnH8zTuvYlb7yJbvcanr/${r.sid}`).download();
    const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let x0 = info.width, y0 = info.height, x1 = -1, y1 = -1, R = 0, G = 0, B = 0, n = 0;
    for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * 4;
      if (data[i + 3]! > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (n % 7 === 0) { R += data[i]!; G += data[i + 1]!; B += data[i + 2]!; } n++; }
    }
    const k = Math.max(1, Math.ceil(n / 7));
    const hex = "#" + [R, G, B].map((v) => Math.round(v / k).toString(16).padStart(2, "0")).join("");
    out[r.sid] = { n: r.n, w: info.width, h: info.height, bbox: [x0, y0, x1, y1].map((v) => +(v / (v === x0 || v === x1 ? info.width : info.height)).toFixed(3)), avg: hex, cover: +(n / (info.width * info.height)).toFixed(2) };
    console.log(r.n, r.sid.slice(0, 8), `${info.width}x${info.height}`, "bbox", [x0, y0, x1, y1].join(","), "avg", hex, "cover", (n / (info.width * info.height)).toFixed(2));
  }
  fs.writeFileSync(`${ROOT}/scratch/ownart/measure.json`, JSON.stringify(out, null, 1));
}
main().then(() => process.exit(0));
