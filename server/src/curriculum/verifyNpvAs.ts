// Independent answer-key check for the npv + as content: every computation question is re-derived here from
// first principles (NOT read from the content file's answer) and compared with the stored key.
//   cd server && npx tsx src/curriculum/verifyNpvAs.ts
import path from "node:path";
import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
import type { CQuestion, CTopic } from "./types";

const fmt = (n: number) => (n < 0 ? "−" : "") + Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const evalExpr = (s: string) => { // "1,000 − 500" / "250 + 250" / "3,999,999 + 1"
  const clean = s.replace(/,/g, "").replace(/−/g, "-").replace(/×/g, "*").replace(/÷/g, "/");
  if (!/^[\d\s+\-*/.]+$/.test(clean)) throw new Error(`not an expression: ${s}`);
  return Function(`"use strict";return (${clean})`)() as number;
};
const roundTo = (n: number, unit: number) => Math.floor(n / unit + 0.5) * unit; // half up (positive numbers only)
const digitValue = (n: number, digit: number) => { const s = String(n); const i = s.indexOf(String(digit)); return digit * 10 ** (s.length - 1 - i); };
const words3 = (n: number) => {
  const ones = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
  const tens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
  const h = Math.floor(n / 100), r = n % 100;
  const rw = r < 20 ? ones[r] : tens[Math.floor(r / 10)] + (r % 10 ? "-" + ones[r % 10] : "");
  return (h ? ones[h] + " hundred" + (r ? " and " : "") : "") + rw;
};
const roman = (n: number) => { const t: [number, string][] = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]]; let o = ""; for (const [v, s] of t) while (n >= v) { o += s; n -= v; } return o; };

/** key → the expected KEY as the content file should store it (a string for single/short, a number for number, string[] for multi). */
const EXPECT: Record<string, () => string | number | string[]> = {
  // ── npv Y3
  "npv-y3-01": () => 200 + 50,
  "npv-y3-02": () => String(digitValue(574, 7)),
  "npv-y3-03": () => String(600 + 5),
  "npv-y3-04": () => words3(352),
  "npv-y3-05": () => String(Math.min(517, 571, 175, 157)),
  "npv-y3-06": () => 435 + 100,
  "npv-y3-07": () => 8 * 7,
  "npv-y3-08": () => [12, 18, 24, 30, 36].filter((n) => n % 4 === 0).map(String),
  "npv-y3-09": () => { const h = 5, t = h + 3, o = 0; return String(h * 100 + t * 10 + o); },
  "npv-y3-10": () => [408, 84, 480, 804].sort((a, b) => a - b).join(", "),
  // ── npv Y4
  "npv-y4-01": () => 6 * 5,
  "npv-y4-02": () => String(digitValue(5824, 8)),
  "npv-y4-03": () => fmt(roundTo(3468, 100)),
  "npv-y4-04": () => roman(14),
  "npv-y4-05": () => roman(49),
  "npv-y4-06": () => fmt(Math.max(4052, 4205, 4502, 4250)),
  "npv-y4-07": () => 9 * 25,
  "npv-y4-08": () => [14, 27, 35, 48, 63].filter((n) => n % 7 === 0).map(String),
  "npv-y4-09": () => roundTo(2995, 10),
  "npv-y4-11": () => fmt(roundTo(4962, 1000)),
  "npv-y4-12": () => 9 * 5,
  "npv-y4-10": () => fmt([4649, 4750, 4760, 4651].filter((n) => roundTo(n, 100) === 4700)[0]),
  // ── npv Y5
  "npv-y5-01": () => fmt(digitValue(345218, 4)),
  "npv-y5-02": () => fmt(206 * 1000 + 403),
  "npv-y5-03": () => fmt(roundTo(476382, 10000)),
  "npv-y5-04": () => 302500 - 4 * 1000,
  "npv-y5-05": () => String(4 - -6),
  "npv-y5-06": () => fmt(526100 - 10000),
  "npv-y5-07": () => roman(640),
  "npv-y5-08": () => [249999, 250000, 304900, 349999, 350000].filter((n) => roundTo(n, 100000) === 300000).map(fmt),
  "npv-y5-09": () => [-8, 3, -2, 0].sort((a, b) => a - b).map((n) => (n < 0 ? "−" + -n : String(n))).join(", "),
  "npv-y5-10": () => -240 + 350,
  // ── npv Y6
  "npv-y6-01": () => fmt(roundTo(6847392, 100000)),
  "npv-y6-02": () => fmt(digitValue(3592146, 5)),
  "npv-y6-03": () => `${-4 + 9}°C`, // (spec sample wording was "5C"; a later pass typeset it as °C)
  "npv-y6-04": () => 4 * 1000000 + 205 * 1000 + 60,
  "npv-y6-05": () => fmt(Math.min(3450982, 3405982, 3450289, 3504289)),
  "npv-y6-06": () => roundTo(8096437, 10000),
  "npv-y6-07": () => 12 - -7,
  "npv-y6-08": () => [4499999, 4500000, 5012345, 5499999, 5500000].filter((n) => roundTo(n, 1000000) === 5000000).map(fmt),
  "npv-y6-09": () => fmt(3250000 - 1000000),
  "npv-y6-10": () => (-8 + 5) / 2,
  // ── as Y3
  "as-y3-01": () => 347 + 6,
  "as-y3-02": () => 512 - 30,
  "as-y3-03": () => fmt(456 + 237),
  "as-y3-04": () => 703 - 458,
  "as-y3-05": () => fmt(roundTo(398, 100) + roundTo(205, 100)),
  "as-y3-06": () => "425 − 167",
  "as-y3-07": () => fmt(245 + 268),
  "as-y3-08": () => fmt(320 - 175),
  "as-y3-09": () => ["250 + 250", "700 − 300", "450 + 50", "1,000 − 500", "320 + 190"].filter((e) => evalExpr(e) === 500),
  "as-y3-10": () => 634 - 289,
  // ── as Y4
  "as-y4-01": () => 4285 + 1367,
  "as-y4-02": () => 5000 - 1200,
  "as-y4-03": () => fmt(5046 - 2378),
  "as-y4-04": () => fmt(2450 - (875 + 640)),
  "as-y4-05": () => fmt(roundTo(4912, 1000) + roundTo(3098, 1000)),
  "as-y4-06": () => "3,618 + 3,586",
  "as-y4-07": () => 5000 - 3275,
  "as-y4-08": () => String(4500 + 3700),
  "as-y4-09": () => ["1,250 + 1,250", "3,000 − 500", "4,000 − 2,000", "1,800 + 800", "5,000 − 2,500"].filter((e) => evalExpr(e) === 2500),
  "as-y4-10": () => 3485 + 2760 - 4900,
  // ── as Y5
  "as-y5-01": () => 34672 + 25849,
  "as-y5-02": () => fmt(82405 - 37968),
  "as-y5-03": () => fmt(roundTo(48912, 10000) - roundTo(19876, 10000)),
  "as-y5-04": () => 450000 + 270000,
  "as-y5-05": () => 6300 - 2950,
  "as-y5-06": () => fmt(65000 - (38450 + 14275)),
  "as-y5-07": () => "She is wrong, because 48,000 + 32,000 = 80,000, so the answer should be close to 80,000.",
  "as-y5-08": () => 47395 + 18264,
  "as-y5-09": () => ["60,000 + 40,000", "250,000 − 150,000", "99,999 + 1", "1,000,000 − 90,000", "45,000 + 65,000"].filter((e) => evalExpr(e) === 100000),
  "as-y5-10": () => 48650 + 5875 - 2340,
  // ── as Y6
  "as-y6-01": () => 250000 + 375000,
  "as-y6-02": () => 7000 - 2999,
  "as-y6-03": () => fmt(5300000 - 2450000),
  "as-y6-04": () => "£" + fmt(126400 + 89750 - 75000 - 48600),
  "as-y6-05": () => "45,200 − 12,450",
  "as-y6-06": () => 12500 + 8700 - 6200,
  "as-y6-07": () => String(1000000 - 250000),
  "as-y6-08": () => "Wrong. 2,847 + 4,153 = 7,000, not 6,000, so the answer should be 3,153.",
  "as-y6-09": () => ["2,500,000 + 1,500,000", "5,000,000 − 1,200,000", "9,000,000 − 5,000,000", "3,999,999 + 1", "3,400,000 + 700,000"].filter((e) => evalExpr(e) === 4000000),
  "as-y6-10": () => 48500 - 12750 + 9300 - 21480,
};

/** Extra prose facts that the expectations above don't cover: assert them here so the explanations can't lie. */
function proseChecks(): string[] {
  const bad: string[] = [];
  const ck = (c: boolean, m: string) => { if (!c) bad.push(m); };
  ck(48213 + 31987 === 80200 && roundTo(48213, 1000) + roundTo(31987, 1000) === 80000, "as-y5-07 facts");
  ck(6000 - 2847 === 3153 && 2847 + 4153 === 7000, "as-y6-08 facts");
  ck(2450 - 875 === 1575 && 2450 - 640 === 1810 && 2450 + 875 + 640 === 3965 && 875 + 640 === 1515, "as-y4-04 distractors/facts");
  ck(5046 - 2378 === 2668 && 2668 + 2378 === 5046, "as-y4-03 facts");
  ck(65000 - 38450 === 26550 && 65000 - 14275 === 50725 && 38450 + 14275 === 52725, "as-y5-06 distractors");
  ck(126400 + 89750 === 216150 && 75000 + 48600 === 123600 && 216150 - 123600 === 92550 && 216150 - 48600 === 167550 && 216150 - 75000 === 141150, "as-y6-04 facts");
  ck(4285 + 1367 === 5652, "as-y4-01 col"); ck(34672 + 25849 === 60521, "as-y5-01 col");
  ck(48500 - 12750 === 35750 && 35750 + 9300 === 45050 && 45050 - 21480 === 23570, "as-y6-10 steps");
  ck(3485 + 2760 === 6245 && 6245 - 4900 === 1345, "as-y4-10 steps");
  ck(48650 + 5875 === 54525 && 54525 - 2340 === 52185, "as-y5-10 steps");
  ck(roundTo(2995, 10) === 3000 && roundTo(8096437, 10000) === 8100000 && roundTo(476382, 10000) === 480000, "rounding facts");
  ck(roundTo(4649, 100) === 4600 && roundTo(4750, 100) === 4800 && roundTo(4760, 100) === 4800 && roundTo(4651, 100) === 4700, "npv-y4-10 distractors");
  ck(roundTo(249999, 100000) === 200000 && roundTo(350000, 100000) === 400000 && roundTo(4499999, 1000000) === 4000000 && roundTo(5500000, 1000000) === 6000000, "boundary rounding");
  ck(302500 - 4000 === 298500, "npv-y5-04");
  ck(roman(9) === "IX" && roman(40) === "XL" && roman(14) === "XIV" && roman(49) === "XLIX" && roman(640) === "DCXL", "roman");
  ck(-8 + (5 - -8) / 2 === -1.5, "npv-y6-10");
  ck(345 + 289 === 634 && 3275 + 1725 === 5000 && 18264 + 47395 === 65659 && 65659 - 18264 === 47395, "missing-number checks");
  ck(3 * 100 === 300 && 4 * 1000 === 4000, "trivia");
  ck([6,12,18,24,30,36,42,48,54,60,66,72].every((n,i)=>n===6*(i+1)) && [7,14,21,28,35,42,49,56,63,70,77,84].every((n,i)=>n===7*(i+1)) && [9,18,27,36,45,54,63,72,81,90,99,108].every((n,i)=>n===9*(i+1)) && [4,8,12,16,20,24,28,32,36,40,44,48].every((n,i)=>n===4*(i+1)) && [8,16,24,32,40,48,56,64,72,80,88,96].every((n,i)=>n===8*(i+1)), "flashcard tables");
  return bad;
}

(async () => {
  let bad = 0, checked = 0;
  const fail = (m: string) => { bad++; console.error("  FAIL " + m); };
  const seen = new Set<string>();
  for (const key of ["npv", "as"]) {
    const t: CTopic = (await import(path.join(HERE, "ks2maths", `${key}.ts`))).TOPIC;
    for (const y of Object.values(t.years)) {
      for (const q of y!.quiz.questions as CQuestion[]) {
        seen.add(q.key);
        const fn = EXPECT[q.key];
        if (!fn) { fail(`${q.key}: no independent expectation defined`); continue; }
        const want = fn();
        checked++;
        if (q.kind === "single" || q.kind === "short") {
          if (q.kind === "single" && typeof want === "string" && !q.options!.includes(want)) fail(`${q.key}: expected "${want}" is not among the options ${JSON.stringify(q.options)}`);
          if (String(q.answer).trim().toLowerCase() !== String(want).trim().toLowerCase()) fail(`${q.key}: stored "${String(q.answer)}" but recomputed "${String(want)}"`);
          if (q.kind === "single") {
            // no distractor may ALSO be right: any option equal (as a number) to the key text
            const dup = q.options!.filter((o) => o !== q.answer && /^[£−\d,.\s-]+$/.test(o) && o.replace(/[£,\s]/g, "").replace("−", "-") === String(q.answer).replace(/[£,\s]/g, "").replace("−", "-"));
            if (dup.length) fail(`${q.key}: distractor equals the key: ${dup}`);
          }
        } else if (q.kind === "number") {
          if (typeof q.answer !== "number" || Math.abs(q.answer - Number(want)) > 1e-9) fail(`${q.key}: stored ${String(q.answer)} but recomputed ${String(want)}`);
        } else if (q.kind === "multi") {
          const a = [...(q.answer as string[])].sort().join("|"), b = [...(want as string[])].sort().join("|");
          if (a !== b) fail(`${q.key}: stored [${a}] but recomputed [${b}]`);
        }
        if (q.kind === "short" && q.accepted?.length) for (const x of q.accepted) if (String(x).replace(/,/g, "") !== String(q.answer).replace(/,/g, "") && q.key !== "npv-y3-04") fail(`${q.key}: accepted "${x}" differs from key`);
      }
    }
  }
  for (const k of Object.keys(EXPECT)) if (!seen.has(k)) fail(`${k}: expectation for a question that doesn't exist`);
  for (const m of proseChecks()) fail("prose fact: " + m);
  console.log(`${checked} questions re-derived independently · ${bad} problem(s)`);
  process.exit(bad ? 1 : 0);
})();
