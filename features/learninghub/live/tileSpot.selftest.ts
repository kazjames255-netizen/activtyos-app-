// `npx tsx features/learninghub/live/tileSpot.selftest.ts` — the floating video tile finds a spot clear of the board's controls.
import assert from "node:assert/strict";
import { findSpot, type R } from "./tileSpot";

let n = 0;
const t = (name: string, fn: () => void) => { try { fn(); n++; console.log(`  ok  ${name}`); } catch (e) { console.error(`  FAIL ${name}\n`, e); process.exitCode = 1; } };
const hit = (a: R, b: R) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
/** The board's controls in a pane of this size (rail on the left, top bars, status pill + centred options bar along the bottom). */
const controls = (W: number, H: number): R[] => [
  { x: 20, y: 20, w: 56, h: H - 40 },
  { x: 84, y: 20, w: 420, h: 52 },
  { x: W - 460, y: 20, w: 440, h: 52 },
  { x: 84, y: H - 50, w: 120, h: 30 },
  { x: Math.round(W / 2 - 260), y: H - 56, w: 520, h: 40 },
];

console.log("video tile spot");
for (const [name, W, H, tw, th] of [["laptop", 1256, 660, 420, 306], ["iPad landscape", 1000, 560, 420, 306], ["iPad landscape, small tile", 1000, 560, 320, 244]] as const) {
  t(`${name}: bottom-right preference is moved clear of every control`, () => {
    const ctl = controls(W, H);
    const pref = { x: W - tw - 16, y: H - th - 16 };
    const s = findSpot(pref.x, pref.y, tw, th, { w: W, h: H }, ctl)!;
    assert.ok(s, "a spot exists");
    for (const r of ctl) assert.ok(!hit({ x: s.x, y: s.y, w: tw, h: th }, r), `overlaps ${JSON.stringify(r)} at ${JSON.stringify(s)}`);
    assert.ok(s.x >= 16 && s.y >= 16 && s.x + tw <= W - 16 && s.y + th <= H - 16, "inside the container");
  });
}
t("a small board has no clear spot -> null (the tile docks instead)", () => {
  assert.equal(findSpot(200, 100, 420, 306, { w: 700, h: 420 }, controls(700, 420)), null);
});
t("no controls (another tab is showing): the preferred spot is kept exactly", () => {
  assert.deepEqual(findSpot(500, 300, 420, 306, { w: 1256, h: 660 }, []), { x: 500, y: 300 });
});
t("an already-free preference is kept", () => {
  assert.deepEqual(findSpot(700, 100, 320, 200, { w: 1256, h: 660 }, controls(1256, 660).slice(0, 1)), { x: 700, y: 100 });
});
console.log(`\n${n} passed`);
