/**
 * Smoke test of the add-ons seed + helpers (needs a freshly seeded stack: run seed-addons-run.mts --reset first).
 *   EMU_PORT_OFFSET=<n> server/node_modules/.bin/tsx scripts/emu/smoke-addons-run.mts
 * Books AD01 and AD02 as parent A and reads Add-on orders and the register. Exits 1 on any mismatch.
 */
import { bookWithAddons, ids, kitDay, kitDays, registerDay } from "./addons-helpers.mts";

let bad = 0;
const check = (name: string, got: unknown, want: unknown) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) bad++; console.log(`${ok ? "OK  " : "FAIL"} ${name}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); };

const I = ids();
console.log("LK dates", I.listings.LK.dates.join(","));
const r1 = await bookWithAddons({ parent: "A", listing: "LK", children: [{ name: "Smoke Kid One", days: "all", addons: [{ id: "AW", answers: { Colour: "Blue" } }] }] });
console.log("AD01 status", r1.status, "refs", r1.refs);
check("AD01 total", r1.total, 161);
check("AD01 add-on line price", r1.addonLines.map((l) => l.price), [21]);
console.log("AD01 add-on line", JSON.stringify(r1.addonLines));
const r2 = await bookWithAddons({ parent: "A", listing: "LK", children: [{ name: "Smoke Kid Two", days: "all", addons: [{ id: "AT", answers: { Size: "M" } }] }] });
console.log("AD02 status", r2.status, "refs", r2.refs);
check("AD02 total", r2.total, 148);

for (const d of [1, 7]) {
  const k = await kitDay(d);
  console.log(`kit D${d}`, k.status, JSON.stringify(k.json).slice(0, 700));
}
const days = await kitDays(1, 7);
console.log("kit/days D1..D7", days.status, JSON.stringify(days.json).slice(0, 900));
const reg = await registerDay(1);
console.log("register D1", reg.status, JSON.stringify(reg.json).slice(0, 1200));
const parentKit = await kitDay(1, {}, "A");
check("parent A refused /api/kit", parentKit.status >= 400, true);
console.log("parent A kit status", parentKit.status, JSON.stringify(parentKit.json));
process.exit(bad ? 1 : 0);
