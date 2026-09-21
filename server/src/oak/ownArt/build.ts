// Writes server/src/oak/ownArt/svg/*.svg (our original artwork for the "Ordinal numbers" pilot; the drawing rules are in kit.ts).
//   cd server && npx tsx src/oak/ownArt/build.ts            (then `--sheet` also writes scratch/ownart/mine.png, a contact sheet for a quick look)
// The .svg files ARE the artwork (checked in); this generator is how the parametric ones (cars, children) stay consistent.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { P, car, door, flag, iconPuzzle, iconQuestion, iconSwap, iconTalk, iconTick, shadow, svg, trafficLight, light, dark } from "./kit";
import { KIDS, kidFull, kidHead } from "./kids";

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, "svg");
const files: Record<string, string> = {};

// cars — the body colour matches the word the slides write on the door (BLACK / YELLOW / BLUE / GREEN / RED / ORANGE / GREY / BROWN / PEACH / WHITE)
const CARS: Record<string, { c: string; outline?: boolean; w?: number; h?: number }> = {
  black: { c: "#2e3048" }, yellow: { c: P.yellow }, blue: { c: P.brand2 }, green: { c: P.mint }, red: { c: P.red },
  orange: { c: P.orange, w: 913, h: 446 }, grey: { c: "#7c8196" }, brown: { c: "#9a6a3f" }, peach: { c: P.peach },
  white: { c: "#fbfcff", outline: true }, "white-large": { c: "#fbfcff", outline: true, w: 913, h: 446 },
};
for (const [k, v] of Object.entries(CARS)) files[`car-${k}`] = car({ body: v.c, outline: v.outline, w: v.w, h: v.h, id: `c${k.replace(/\W/g, "")}` });

files["traffic-light-red"] = trafficLight();
files["door"] = door();
files["flag-chequered"] = flag();
files["icon-talk"] = iconTalk();
files["icon-question"] = iconQuestion();
files["icon-puzzle"] = iconPuzzle();
files["icon-swap"] = iconSwap();
files["tick"] = iconTick();

// children (full length; frame sizes are the original pictures')
for (const k of Object.values(KIDS)) files[`kid-${k.key}`] = kidFull(k);
files["kid-laura-b"] = kidFull({ ...KIDS.laura!, W: 434 });
// heads for the speech bubbles
files["head-laura"] = kidHead(KIDS.laura!, 563, 946, 281, 250, 196, 6);
files["head-andeep"] = kidHead(KIDS.andeep!, 575, 805, 287, 420, 228, 0);
files["head-izzy"] = kidHead(KIDS.izzy!, 722, 783, 361, 400, 210, 0);

// speech bubbles: the deck stretches ONE small bubble (the bottom-left one of the original sheet) across every use, so that is the one that matters;
// the other two are drawn only so the sheet is complete.
const bubble = (x: number, y: number, w: number, h: number, tx: number, ty: number, r = 44) =>
  `M${x + r} ${y} H${x + w - r} Q${x + w} ${y} ${x + w} ${y + r} V${y + h - r} Q${x + w} ${y + h} ${x + w - r} ${y + h} H${tx + 78} L${tx + 62} ${ty} L${tx} ${y + h} H${x + r} Q${x} ${y + h} ${x} ${y + h - r} V${y + r} Q${x} ${y} ${x + r} ${y} Z`;
{
  const paths = [bubble(12, 12, 300, 222, 210, 292), bubble(12, 372, 358, 196, 262, 600), bubble(430, 60, 846, 440, 480, 590, 60)];
  files["speech-bubbles"] = svg(1280, 609, paths.map((d) => `<path d="${d}" transform="translate(0 5)" fill="${P.ink}" opacity="0.09"/><path d="${d}" fill="#fff" stroke="#b9c6ea" stroke-width="6" stroke-linejoin="round"/>`).join(""));
}

// decoration (replaces Oak's brush-stroke bars, rings and blobs by clean shapes of the same size)
files["panel-white"] = svg(1280, 470, `<rect x="0" y="0" width="1280" height="470" rx="64" fill="#fff"/>`);
files["pill-white"] = svg(184, 24, `<rect x="0" y="0" width="184" height="24" rx="12" fill="#fff"/>`);
files["pill-teal"] = svg(1103, 95, `<rect x="0" y="3.5" width="1103" height="88" rx="44" fill="#037b7d"/>`);
files["pill-purple"] = svg(1103, 95, `<rect x="0" y="3.5" width="1103" height="88" rx="44" fill="#845ad9"/>`);
files["line-green"] = svg(1280, 17, `<rect width="1280" height="17" fill="#bef2bd"/>`);
files["line-purple"] = svg(1280, 17, `<rect width="1280" height="17" fill="#845ad9"/>`);
files["line-teal"] = svg(1280, 17, `<rect width="1280" height="17" fill="#037b7d"/>`);
files["ring-white"] = svg(1280, 1274, `<circle cx="640" cy="637" r="632" fill="#fff"/><circle cx="640" cy="637" r="612" fill="none" stroke="#e9e9f2" stroke-width="40"/>`);
files["ring-purple"] = svg(1280, 1275, `<circle cx="640" cy="637" r="632" fill="#fff"/><circle cx="640" cy="637" r="594" fill="none" stroke="#845ad9" stroke-width="76"/>`);
files["ring-teal"] = svg(1280, 1274, `<circle cx="640" cy="637" r="632" fill="#fff"/><circle cx="640" cy="637" r="594" fill="none" stroke="#037b7d" stroke-width="76"/>`);
files["dot-ink"] = svg(117, 116, `<circle cx="58.5" cy="58" r="57" fill="${P.ink}"/>`);

// the counting-frame card on the title slide
{
  const sh = shadow("as", 298, 745, 250, 14, 0.14);
  const beads = (y: number, colours: string[], gap: number) => colours.map((c, i) => `<circle cx="${190 + i * 52 + (i >= gap ? 110 : 0)}" cy="${y}" r="24" fill="${c}"/><circle cx="${182 + i * 52 + (i >= gap ? 110 : 0)}" cy="${y - 8}" r="7" fill="#fff" opacity="0.5"/>`).join("");
  const body = `${sh.body}<g transform="rotate(-3 298 384)"><rect x="24" y="26" width="548" height="716" rx="52" fill="#fff"/><rect x="24" y="26" width="548" height="716" rx="52" fill="none" stroke="#e3e8f6" stroke-width="4"/>
<rect x="104" y="210" width="34" height="330" rx="17" fill="${P.brand}"/><rect x="458" y="210" width="34" height="330" rx="17" fill="${P.brand}"/><rect x="84" y="520" width="428" height="46" rx="23" fill="${P.brand2}"/>
${[280, 370, 460].map((y) => `<rect x="130" y="${y - 6}" width="336" height="12" rx="6" fill="${P.brand2}" opacity="0.55"/>`).join("")}
${beads(280, [P.red, P.red, P.red, P.gold, P.gold], 3)}${beads(370, [P.violet, P.violet, P.violet, P.violet, P.green], 4)}${beads(460, [P.teal, P.gold, P.gold, P.gold, P.gold], 1)}</g>`;
  files["abacus-card"] = svg(596, 769, body, 596, 769, sh.defs);
}
void light; void dark;

fs.mkdirSync(out, { recursive: true });
for (const [name, s] of Object.entries(files)) fs.writeFileSync(path.join(out, `${name}.svg`), s);
console.log(`wrote ${Object.keys(files).length} svgs to ${out}`);
