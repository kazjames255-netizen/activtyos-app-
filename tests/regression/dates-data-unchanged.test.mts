import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import * as fmt from "../../lib/i18n/format";
import { nowStr } from "../../features/bookings/helpers";
import { daysPhrase } from "../../features/bookings/addons";

// The dates sweep must change DISPLAY only. These tests pin the places where a formatted date is DATA (a key, a stored value, text compared with the
// server's, a file title) and prove English output is byte-for-byte what the browser's own en-GB formatting gave before.
const root = path.resolve(import.meta.dirname, "../..");
const src = (f: string) => fs.readFileSync(path.join(root, f), "utf8");
const DATES = [new Date("2026-10-08T21:20:00Z"), new Date("2026-03-29T00:30:00Z"), new Date("2027-01-01T00:00:00Z"), new Date("2026-07-04T13:05:09Z")];
const OPTS: Intl.DateTimeFormatOptions[] = [
  {}, { timeZone: "Europe/London" }, { timeZone: "UTC" },
  { day: "numeric", month: "short" }, { day: "numeric", month: "short", year: "numeric" }, { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" },
  { weekday: "short", day: "numeric", month: "short" }, { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" },
  { month: "long", year: "numeric" }, { month: "short" }, { weekday: "short" }, { weekday: "long" }, { month: "long", year: "numeric", timeZone: "UTC" },
  { hour: "2-digit", minute: "2-digit" }, { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }, { hour: "numeric", minute: "2-digit" },
  { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Europe/London" }, { timeZoneName: "short" },
  { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" },
  { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }, 
];

test("English output equals the browser's own en-GB output for every option set the app uses (dates, times, date-times)", () => {
  for (const d of DATES) for (const o of OPTS) {
    assert.equal(fmt.uiDate(d, o, "en"), d.toLocaleDateString("en-GB", o), `date ${JSON.stringify(o)}`);
    assert.equal(fmt.uiTime(d, o, "en"), d.toLocaleTimeString("en-GB", o), `time ${JSON.stringify(o)}`);
    assert.equal(fmt.uiDateTime(d, o, "en"), d.toLocaleString("en-GB", o), `datetime ${JSON.stringify(o)}`);
  }
});
test("styles (dateStyle/timeStyle) work in date-time and Welsh", () => {
  const d = DATES[0];
  assert.equal(fmt.uiDateTime(d, { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" }, "en"), d.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" }));
  assert.match(fmt.uiDateTime(d, { dateStyle: "medium", timeZone: "Europe/London" }, "cy"), /Hyd/);
});
test("any non-Welsh language equals the native output for that language's tag (the helpers add nothing but Welsh)", () => {
  for (const [code, tag] of [["pl", "pl-PL"], ["ar", "ar-u-nu-latn"], ["fr", "fr-FR"], ["es", "es-ES"]] as const)
    for (const d of DATES) for (const o of OPTS) assert.equal(fmt.uiDateTime(d, o, code), d.toLocaleString(tag, o), `${code} ${JSON.stringify(o)}`);
});
test("a ready BCP-47 tag (Learning Hub) is passed straight to the browser", () => {
  for (const d of DATES) assert.equal(fmt.uiDate(d, { weekday: "short", day: "numeric", month: "short" }, "de-DE"), d.toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "short" }));
});
test("an invalid date gives the same text as the browser", () => {
  assert.equal(fmt.uiDate(new Date("nope"), {}, "en"), new Date("nope").toLocaleDateString("en-GB"));
});

test("STORED value: nowStr() (cancel.on, refund log) keeps its shape in English and Welsh", () => {
  const re = /^\d{1,2}\/\d{1,2}\/\d{4}, \d{2}:\d{2}$/;
  fmt.setDateLocale("en"); assert.match(nowStr(), re);
  fmt.setDateLocale("cy"); assert.match(nowStr(), re);
  fmt.setDateLocale("en");
});
test("STORED / COMPARED English text stays English whatever the app language", () => {
  fmt.setDateLocale("cy");
  assert.equal(daysPhrase(["2026-10-18"]), "Sun 18 Oct");
  assert.equal(daysPhrase(["2026-10-18", "2026-10-19"]), "Sun 18 Oct – Mon 19 Oct");
  fmt.setDateLocale("en");
});
test("data sites still use fixed machine / English formatters (guard against the sweep touching them again)", () => {
  const must: [string, RegExp][] = [
    ["features/payroll/PayrollApp.tsx", /const fmtDKey = \(d: Date\) => d\.toLocaleDateString\("en-GB"/],
    ["features/payroll/PayrollApp.tsx", /const monthLabelKey = \(d: Date\) => d\.toLocaleDateString\("en-GB"/],
    ["features/listings/checkout.tsx", /const pretty = \(iso: string\) => new Date\(`\$\{iso\}T00:00:00Z`\)\.toLocaleDateString\("en-GB"/],
    ["features/listings/checkout.tsx", /x\.toLocaleDateString\("en-CA"/],
    ["features/bookings/helpers.ts", /now\.toLocaleTimeString\("en-GB"/],
    ["features/bookings/addons.ts", /const dayName = .*toLocaleDateString\("en-GB"/],
    ["features/kit/KitApp.tsx", /ukToday = .*"en-CA"/],
    ["features/kit/useAddonWeek.ts", /ukToday = .*"en-CA"/],
    ["features/learninghub/live/board/exportBoard.ts", /const dayLabel = .*"en-GB"/],
    ["features/payroll/payCalc.ts", /new Intl\.DateTimeFormat\("en-GB"/],
    ["lib/vouchers.ts", /new Intl\.DateTimeFormat\("en-CA"/],
    ["features/money/bookingIncome.ts", /new Intl\.DateTimeFormat\("en-CA"/],
    ["features/listings/cutoff.ts", /new Intl\.DateTimeFormat\("en-GB"/],
  ];
  for (const [f, re] of must) assert.match(src(f), re, `${f} ${re}`);
});
test("a formatted date is never compared with, split from, searched or sorted as data in the converted call sites", () => {
  // For every helper call, look at what directly follows its closing bracket: a comparison, split, includes, localeCompare, parse... would be a data use.
  const offenders: string[] = [];
  const AFTER = /^\s*(===|!==|==|!=|<|>|\.split\(|\.includes\(|\.indexOf\(|\.localeCompare\(|\.match\()/;
  const BEFORE = /(===|!==|localeCompare\(|Date\.parse\(|parseInt\(|Number\(|new Date\(|JSON\.stringify\(|encodeURIComponent\(|\.set\(|\.get\(|\.has\()\s*$/;
  const walk = (dir: string) => { for (const e of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) { if (e.name !== "node_modules") walk(rel); continue; }
    if (!/\.(ts|tsx)$/.test(e.name) || rel === "lib/i18n/format.ts") continue;
    const text = src(rel);
    for (const m of text.matchAll(/\b(uiDate|uiTime|uiDateTime)\(/g)) {
      let depth = 1, i = m.index! + m[0].length;
      while (i < text.length && depth > 0) { const c = text[i++]; if (c === "(") depth++; else if (c === ")") depth--; }
      const line = text.slice(0, m.index).split("\n").length;
      const after = text.slice(i, i + 40), before = text.slice(Math.max(0, m.index! - 40), m.index);
      if (AFTER.test(after) && !/timeZoneName/.test(text.slice(m.index!, i))) offenders.push(`${rel}:${line} after: ${after.trim().slice(0, 20)}`);
      if (BEFORE.test(before)) offenders.push(`${rel}:${line} before: ${before.trim().slice(-20)}`);
    }
  } };
  for (const d of ["features", "lib", "app", "components"]) walk(d);
  assert.deepEqual(offenders, []);
});
