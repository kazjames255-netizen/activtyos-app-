// Run: server/node_modules/.bin/tsx features/learninghub/games/penguin/mtc.selftest.ts
import { makeMtcForm, MTC, MTC_LIMITS, markMtc, mtcKey, cleanMtcAnswers } from "./mtc";
let fails = 0; const ok = (c: unknown, m: string) => { if (!c) { fails++; console.error("FAIL", m); } };
let prev: string[] = [];
for (let seed = 1; seed <= 300; seed++) {
  const f = makeMtcForm(seed, prev);
  ok(f && f.length === MTC.n, "25 items " + seed);
  if (!f) continue;
  const keys = f.map(mtcKey);
  ok(new Set(keys).size === MTC.n, "no repeat and no reversal (unordered pair used once) " + seed);
  ok(f.every((i) => i.a >= 2 && i.a <= 12 && i.b >= 2 && i.b <= 12), "tables 2-12, no 1x");
  for (const t of Object.keys(MTC_LIMITS).map(Number)) { const c = f.filter((i) => i.a === t).length; ok(c >= MTC_LIMITS[t]![0] && c <= MTC_LIMITS[t]![1], `table ${t} first-factor count ${c} within limits`); }
  ok(f.filter((i) => prev.includes(mtcKey(i))).length <= MTC.maxOverlap, "<= 30% overlap with previous form");
  const ps = f.map((i) => i.a * i.b); ok(!ps.every((p, i) => i === 0 || p >= ps[i - 1]!), "not sorted by difficulty");
  prev = keys;
}
const form = makeMtcForm(5);
const ans = form.map((i, k) => ({ v: k === 0 ? null : k === 1 ? i.a * i.b + 1 : i.a * i.b, ms: 2500 }));
const r = markMtc(form, ans);
ok(r.score === 23 && r.rows[0]!.kind === "timeout" && r.rows[1]!.kind === "wrong", "marking: timeout and wrong are different, score 23/25");
ok(cleanMtcAnswers(ans) !== null && cleanMtcAnswers(ans.slice(1)) === null, "answer validation");
console.log(fails ? `${fails} FAILURES` : "mtc selftest: all passed");
process.exit(fails ? 1 : 0);
