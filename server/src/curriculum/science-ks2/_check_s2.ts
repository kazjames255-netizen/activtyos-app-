// Recomputes every numeric / graph / diagram-derived answer key in the science-ks2 pack from _s2data.ts (the SAME data that
// draws the images). Run: cd server && npx tsx src/curriculum/science-ks2/_check_s2.ts   (exit 1 on any mismatch)
import * as D from "./_s2data";
import type { CQuestion, CTopic } from "../types";
import { TOPIC as plants } from "./plants";
import { TOPIC as animals } from "./animals";
import { TOPIC as rocks } from "./rocks";
import { TOPIC as light } from "./light";
import { TOPIC as forces } from "./forces";
import { TOPIC as living } from "./living";
import { TOPIC as states } from "./states";
import { TOPIC as sound } from "./sound";
import { TOPIC as elec } from "./elec";
import { TOPIC as mats } from "./mats";
import { TOPIC as earth } from "./earth";
import { TOPIC as evol } from "./evol";

const topics: CTopic[] = [plants, animals, rocks, light, forces, living, states, sound, elec, mats, earth, evol];
const Q = new Map<string, CQuestion>();
for (const t of topics) for (const y of Object.values(t.years)) for (const q of y!.quiz.questions) Q.set(q.key, q);

let bad = 0, n = 0;
const eq = (key: string, expected: unknown) => {
  const q = Q.get(key);
  n++;
  if (!q) { console.error(`MISSING ${key}`); bad++; return; }
  const a = q.answer;
  const ok = Array.isArray(expected)
    ? Array.isArray(a) && a.length === expected.length && expected.every((e) => a.includes(e as string))
    : typeof expected === "number" ? typeof a === "number" && Math.abs(a - expected) <= (q.tolerance ?? 0) + 1e-9 : a === expected;
  if (!ok) { console.error(`✗ ${key}: key is ${JSON.stringify(a)} but data gives ${JSON.stringify(expected)}`); bad++; }
};
const G = (d: D.BarData, cat: string) => d.vals[d.cats.findIndex((c) => c.replace(/\n/g, " ") === cat)];
const argmax = (d: D.BarData) => d.cats[d.vals.indexOf(Math.max(...d.vals))].replace(/\n/g, " ");
const argmin = (d: D.BarData) => d.cats[d.vals.indexOf(Math.min(...d.vals))].replace(/\n/g, " ");
const gAt = (pts: [number, number][], x: number) => pts.find((p) => p[0] === x)![1];

// plants (bar chart of leaves)
eq("plants-y3-06", argmax(D.PLANTS_G).replace("+ water", "+ water"));
eq("plants-y3-07", G(D.PLANTS_G, "Light + water") - G(D.PLANTS_G, "Dark + water"));
eq("plants-y3-01", "C"); eq("plants-y3-03", "D"); // letter → part from data
if (D.PLANTPARTS.C !== "roots" || D.PLANTPARTS.D !== "stem") { console.error("✗ plant part letters"); bad++; }

// animals Y3 skeleton letters, Y4 digestive letters
eq("animals-y3-01", Object.keys(D.SKEL).find((k) => D.SKEL[k] === "ribs"));
eq("animals-y3-03", Object.keys(D.SKEL).find((k) => D.SKEL[k] === "skull"));
eq("animals-y4-01", Object.keys(D.DIGEST).find((k) => D.DIGEST[k] === "stomach"));
eq("animals-y4-02", Object.keys(D.DIGEST).find((k) => D.DIGEST[k] === "small intestine"));
eq("animals-y4-03", Object.keys(D.DIGEST).find((k) => D.DIGEST[k].startsWith("food pipe")));
eq("animals-y4-10", 32 - 20);
// animals Y5 growth
eq("animals-y5-01", `${gAt(D.GROWTH, 10)} cm`);
eq("animals-y5-02", gAt(D.GROWTH, 10) - gAt(D.GROWTH, 6));
{ // biggest two-year gain
  let best = "", max = -1;
  for (let a = 0; a <= 16; a += 2) { const g = gAt(D.GROWTH, a + 2) - gAt(D.GROWTH, a); if (g > max) { max = g; best = `Age ${a} to ${a + 2}`; } }
  eq("animals-y5-03", best);
  const g16 = gAt(D.GROWTH, 18) - gAt(D.GROWTH, 16); if (g16 > 3) { console.error("✗ growth 16→18 should be almost flat"); bad++; }
}
eq("animals-y5-10", 12 / 3);
// animals Y6 pulse
eq("animals-y6-05", String(Math.max(...D.PULSE.map((p) => p[1]))));
eq("animals-y6-06", Math.max(...D.PULSE.map((p) => p[1])) - gAt(D.PULSE, 0));
eq("animals-y6-08", D.PULSE.find((p) => p[0] > 6 && p[1] <= 80)![0] - 6);
if (gAt(D.PULSE, 10) >= 95) { console.error("✗ pupil pulse at minute 10 should be lower than Lee's 95"); bad++; }

// rocks
eq("rocks-y3-02", argmax(D.ROCKS_G));
eq("rocks-y3-03", G(D.ROCKS_G, "Chalk") - G(D.ROCKS_G, "Granite"));
if (!Q.get("rocks-y3-04")!.answer.toString().startsWith(argmin(D.ROCKS_G))) { console.error("✗ rocks-y3-04"); bad++; }

// light Y3: shadow height = H×D/d
{ const s = (d: number) => D.shadowH(D.SHADOW3.H, D.SHADOW3.D, d);
  eq("light-y3-05", s(30)); eq("light-y3-06", s(20) - s(40));
  for (const d of D.SHADOW3.d) if (!Number.isInteger(s(d))) { console.error("✗ shadow not integer at", d); bad++; } }
// light Y6
eq("light-y6-07", D.SHADOW6.obj * (D.SHADOW6.D / D.SHADOW6.d));

// forces
eq("forces-y3-07", argmin(D.FRICTION_G));
eq("forces-y3-08", G(D.FRICTION_G, "Wood") - G(D.FRICTION_G, "Carpet"));
eq("forces-y5-03", Math.round(D.mean(D.PARA.trials[2]) * 100) / 100);
eq("forces-y5-08", D.GEARS.B / D.GEARS.A);
{ const m = D.PARA.trials.map(D.mean); if (!(m[0] < m[1] && m[1] < m[2])) { console.error("✗ parachute means should increase with width"); bad++; } }
{ // magnet pairs (facing poles): A S/N, B N/N, C S/S → repel when equal
  const pairs: Record<string, [string, string]> = { A: ["S", "N"], B: ["N", "N"], C: ["S", "S"] };
  eq("forces-y3-03", Object.keys(pairs).filter((k) => pairs[k][0] === pairs[k][1]));
  eq("forces-y3-02", pairs.A[0] !== pairs.A[1] ? "They attract" : "They repel"); }

// living
eq("living-y4-01", D.runKey(D.KEY, [true, false, false]));
eq("living-y4-02", D.runKey(D.KEY, [true, true, false]));
eq("living-y4-04", ["Snail", "Earthworm"]);
if (D.runKey(D.KEY, [false, true]) !== "Snail" || D.runKey(D.KEY, [false, false]) !== "Earthworm") { console.error("✗ key no-legs branch"); bad++; }
eq("living-y5-05", argmax(D.GEST_G));
eq("living-y5-06", G(D.GEST_G, "Human") - G(D.GEST_G, "Cat"));
{ const target = 2 * G(D.GEST_G, "Cat"); const near = D.GEST_G.cats.reduce((b, c, i) => Math.abs(D.GEST_G.vals[i] - target) < Math.abs(G(D.GEST_G, b) - target) ? c : b); eq("living-y5-07", near); }
{ const by = (id: string) => D.GROUPS_ROWS.find((r) => r.id === id)!.group;
  eq("living-y6-01", D.GROUPS_ROWS.find((r) => r.group === "bird")!.id);
  eq("living-y6-02", D.GROUPS_ROWS.find((r) => r.group === "amphibian")!.id);
  eq("living-y6-03", D.GROUPS_ROWS.find((r) => r.group === "fish")!.id);
  eq("living-y6-05", D.GROUPS_ROWS.filter((r) => r.v[D.GROUPS_COLS.indexOf("Scales")]).map((r) => r.id));
  if (by("Q") !== "mammal" || !D.GROUPS_ROWS.find((r) => r.id === "Q")!.v[D.GROUPS_COLS.indexOf("Feeds babies milk")]) { console.error("✗ Q"); bad++; } }

// states
eq("states-y4-03", `${D.HEAT.find((p) => p[1] === 0)![1]} °C`);
eq("states-y4-04", `${Math.max(...D.HEAT.map((p) => p[1]))} °C`);
eq("states-y4-05", D.interp(D.HEAT, 10));
eq("states-y4-06", D.HEAT.filter((p) => p[1] === 0)[1][0] - D.HEAT.filter((p) => p[1] === 0)[0][0]);
eq("states-y4-07", Object.keys(D.CYCLE).find((k) => D.CYCLE[k] === "evaporation"));
eq("states-y4-08", Object.keys(D.CYCLE).find((k) => D.CYCLE[k] === "condensation"));

// sound
eq("sound-y4-06", argmin(D.SOUND_G));
eq("sound-y4-07", G(D.SOUND_G, "Nothing") - G(D.SOUND_G, "Foam"));
{ const c = D.SOUND_G.cats.map((x) => x.replace(/\n/g, " ")), v = (n: string) => D.SOUND_G.vals[c.indexOf(n)];
  eq("sound-y4-08", "Bubble wrap"); if (!(v("Bubble wrap") < v("Newspaper") && v("Bubble wrap") > v("Woolly hat"))) { console.error("✗ sound-y4-08"); bad++; } }

// electricity
eq("elec-y4-01", D.CIRC4.filter(D.lights).map((c) => c.id));
{ const c = (id: string) => D.CIRC4.find((x) => x.id === id)!;
  if (D.lights(c("B")) || !D.all(c("B")).includes("sw0")) { console.error("✗ B"); bad++; }
  if (D.lights(c("C")) || !D.all(c("C")).includes("gap")) { console.error("✗ C"); bad++; }
  if (!D.lights(c("D")) || D.all(c("D")).filter((x) => x === "bulb").length !== 2) { console.error("✗ D"); bad++; } }
{ const by = (f: (a: number, b: number) => boolean) => D.CIRC6.reduce((b, c) => (f(D.brightness(c), D.brightness(b)) ? c : b)).id;
  eq("elec-y6-01", by((a, b) => a > b)); eq("elec-y6-02", by((a, b) => a < b));
  const bs = D.CIRC6.map(D.brightness); if (new Set(bs).size !== bs.length) { console.error("✗ brightness ties"); bad++; }
  if (!(D.brightness(D.CIRC6[1]) > D.brightness(D.CIRC6[0]))) { console.error("✗ B brighter than A"); bad++; } }

// mats
eq("mats-y5-03", "The temperature of the water");
eq("mats-y5-05", D.DISS_G.vals[3] - D.DISS_G.vals[0]);
{ const y50 = D.DISS_G.vals[2], y70 = D.DISS_G.vals[3]; if (!(y50 === 13 && y70 === 17)) { console.error("✗ 60 °C prediction range"); bad++; } if (!D.DISS_G.vals.every((v, i, a) => i === 0 || v > a[i - 1])) { console.error("✗ dissolving trend"); bad++; } }
eq("mats-y5-07", Object.keys(D.FILTER).find((k) => D.FILTER[k].startsWith("sand trapped")));

// earth
eq("earth-y5-08", D.MOONS.filter((m) => Math.abs(D.litFraction(m.angle) - 0.5) < 1e-9).map((m) => m.letter));

// evol
eq("evol-y6-02", "Pale moths");
eq("evol-y6-03", 40 - G(D.MOTH_G, "Dark moths"));
if (G(D.MOTH_G, "Pale moths") <= G(D.MOTH_G, "Dark moths")) { console.error("✗ moths"); bad++; }

console.log(`${n} keys recomputed · ${bad} problem(s)`);
process.exit(bad ? 1 : 0);
