// Run: server/node_modules/.bin/tsx server/src/lib/curriculum.selftest.ts
// Proves the shipped data reproduces the owner's spreadsheet: 185 areas checked · 172 covered · 4 thin · 9 gaps · 7,470 lessons.
import { framework, oakKey, statusOf, tally } from "./curriculum";
let n = 0, bad = 0;
const ok = (c: boolean, m: string) => { n++; if (!c) { bad++; console.error("FAIL:", m); } };
const fw = framework("nc2014")!;
ok(!!fw, "nc2014 loads");
ok(fw.areas.length === 120, `120 areas (got ${fw.areas.length})`);
ok(new Set(fw.areas.map((a) => a.id)).size === 120, "area ids unique");
const keys = Object.keys(fw.lessons);
ok(keys.length === 7470, `7470 lessons (got ${keys.length})`);
ok(keys.every((k) => !k.startsWith("http")), "keys carry no host");
ok(keys.every((k) => { const [a, y, c, s] = fw.lessons[k]!; return a >= 0 && a < 120 && y >= 1 && y <= 11 && c >= 0 && c <= 2 && s >= 0 && s <= 2; }), "every lesson tuple is in range");
const t = tally(fw, keys.map((k) => ({ areaIdx: fw.lessons[k]![0], year: fw.lessons[k]![1] })));
ok(t.summary.checked === 185, `185 rows (got ${t.summary.checked})`);
ok(t.summary.covered === 172 && t.summary.thin === 4 && t.summary.gaps === 9, `172/4/9 (got ${t.summary.covered}/${t.summary.thin}/${t.summary.gaps})`);
ok(statusOf(0) === "gap" && statusOf(4) === "thin" && statusOf(5) === "covered", "thresholds");
ok(oakKey("https://www.thenational.academy/teachers/programmes/x/units/y/lessons/z") === "x/units/y/lessons/z" && oakKey("https://example.com") === null && oakKey(null) === null, "oakKey");
ok(framework("nope") === null, "unknown framework → null");
console.log(`${n} checks, ${bad} failed`);
process.exit(bad ? 1 : 0);
