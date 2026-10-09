import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import * as fmt from "../../lib/i18n/format";

// FINAL POLISH (A): every date / time the app prints follows the app language. Chrome has no Welsh data, so Welsh is written by lib/i18n/format.ts;
// the helpers below are the ONLY way screens format a Date. The source scan fails on any new raw toLocale*String on a Date.
const D = new Date("2026-10-08T21:20:00Z"); // Thu 8 Oct 2026, 22:20 in London (BST)
const TZ = "Europe/London";
const full = { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: TZ } as const;
const AR = /[؀-ۿ]/;

test("uiDateTime: en UK 24-hour, cy Welsh names, pl and ar localised", () => {
  const en = fmt.uiDateTime(D, full, "en");
  assert.match(en, /Thu/); assert.match(en, /Oct/); assert.match(en, /22:20/); assert.doesNotMatch(en, /PM|pm/);
  const cy = fmt.uiDateTime(D, full, "cy");
  assert.match(cy, /Iau/); assert.match(cy, /Hyd/); assert.match(cy, /22:20/); assert.doesNotMatch(cy, /Thu|Oct/);
  const pl = fmt.uiDateTime(D, full, "pl");
  assert.match(pl, /paź/); assert.match(pl, /22:20/); assert.doesNotMatch(pl, /Oct/);
  const ar = fmt.uiDateTime(D, full, "ar");
  assert.match(ar, AR); assert.doesNotMatch(ar, /Oct/);
});
test("uiDate: weekday long, month long and numeric forms per language", () => {
  assert.equal(fmt.uiDate(D, { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: TZ }, "cy"), "Dydd Iau 8 Hydref 2026");
  assert.equal(fmt.uiDate(D, { day: "numeric", month: "short", timeZone: TZ }, "cy"), "8 Hyd");
  assert.equal(fmt.uiDate(D, { timeZone: TZ }, "cy"), "08/10/2026");
  assert.equal(fmt.uiDate(D, { timeZone: TZ }, "en"), "08/10/2026");
  assert.match(fmt.uiDate(D, { weekday: "short", day: "numeric", month: "short", timeZone: TZ }, "pl"), /paź/);
  assert.match(fmt.uiDate(D, { weekday: "short", day: "numeric", month: "short", timeZone: TZ }, "ar"), AR);
  assert.match(fmt.uiDate(D, { month: "long", year: "numeric", timeZone: TZ }, "cy"), /^Hydref 2026$/);
});
test("uiTime: 24-hour for en, cy and pl", () => {
  for (const c of ["en", "cy", "pl"] as const) assert.equal(fmt.uiTime(D, { hour: "2-digit", minute: "2-digit", timeZone: TZ }, c), "22:20", c);
  assert.match(fmt.uiTime(D, { hour: "2-digit", minute: "2-digit", timeZone: TZ }, "ar"), /20/);
});
test("uiDateTime default (no options) is a date and a time, no English month names in Welsh", () => {
  const cy = fmt.uiDateTime(D, { timeZone: TZ }, "cy");
  assert.match(cy, /08\/10\/2026/); assert.match(cy, /22:20/);
});

// ---- Source scan -------------------------------------------------------------------------------------------------------------------------
test("no raw toLocale*String / Intl.DateTimeFormat on a Date outside lib/i18n/format.ts (mark a genuine exception with `raw-locale-ok: why`)", () => {
  const root = path.resolve(import.meta.dirname, "../..");
  const cfg = ts.readConfigFile(path.join(root, "tsconfig.json"), ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(cfg.config, ts.sys, root);
  const program = ts.createProgram(parsed.fileNames.filter((f) => /\/(features|lib|app|components)\//.test(f) && !f.endsWith("lib/i18n/format.ts")), parsed.options);
  const checker = program.getTypeChecker();
  const offenders: string[] = [];
  for (const sf of program.getSourceFiles()) {
    const rel = path.relative(root, sf.fileName);
    if (!/^(features|lib|app|components)\//.test(rel) || rel === "lib/i18n/format.ts") continue;
    const lines = sf.getFullText().split("\n");
    const ok = (line: number) => /raw-locale-ok/.test(lines[line] ?? "") || /raw-locale-ok/.test(lines[line - 1] ?? "");
    const visit = (n: ts.Node) => {
      if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && /^toLocale(Date|Time)?String$/.test(n.expression.name.text)) {
        const t = checker.getTypeAtLocation(n.expression.expression);
        const isDate = t.symbol?.name === "Date" || (t.isUnion() && t.types.some((x) => x.symbol?.name === "Date"));
        const line = sf.getLineAndCharacterOfPosition(n.getStart(sf)).line;
        if (isDate && !ok(line)) offenders.push(`${rel}:${line + 1}`);
      }
      if (ts.isNewExpression(n) && /^Intl\.(DateTimeFormat|RelativeTimeFormat)$/.test(n.expression.getText(sf))) {
        const line = sf.getLineAndCharacterOfPosition(n.getStart(sf)).line;
        if (!ok(line)) offenders.push(`${rel}:${line + 1} (Intl)`);
      }
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }
  assert.deepEqual(offenders, [], `raw date formatters (use uiDate / uiTime / uiDateTime / formatDay / relativeFrom from lib/i18n/format):\n${offenders.join("\n")}`);
});

// ---- Stored English labels ('Sun 18 Oct 2026', ranges) shown in the viewer's language -----------------------------------------------------------
test("localizeDateLabels: session labels, ranges and ticket text in cy / pl / ar; English is untouched", () => {
  const label = "Sun 18 Oct 2026 · 09:00 – 15:30";
  assert.equal(fmt.localizeDateLabels(label, "en"), label);
  assert.equal(fmt.localizeDateLabels(label, "cy"), "Sul 18 Hyd 2026 · 09:00 – 15:30");
  assert.match(fmt.localizeDateLabels("Sun 18 Oct 2026", "pl"), /paź 2026/);
  assert.match(fmt.localizeDateLabels("Sun 18 Oct 2026", "ar"), AR);
  assert.equal(fmt.localizeDateLabels("Sun 18 Oct 2026 – Tue 20 Oct 2026", "cy"), "Sul 18 Hyd 2026 – Maw 20 Hyd 2026");
  assert.equal(fmt.localizeDateLabels("2-day pass · 18 – 24 Oct 2026", "cy"), "2-day pass · 18 – 24 Hyd 2026");
  assert.equal(fmt.localizeDateLabels(undefined, "cy"), "");
});
test("relativeFrom accepts a ready tag and a style (Learning Hub keeps its own language setting)", () => {
  assert.equal(fmt.relativeFrom(-5, "minute", "cy-GB", "short"), "5 munud yn ôl");
  assert.equal(fmt.relativeFrom(0, "second", "cy"), "nawr");
  assert.match(fmt.relativeFrom(-3, "hour", "pl-PL"), /godz/);
  assert.match(fmt.relativeFrom(-3, "hour", "not-a-tag"), /3 hours ago/);
});
