// Run: server/node_modules/.bin/tsx features/learninghub/tools/selection/select.selftest.ts
// Loads every rules/<subject>.json (+ golden sets), checks them against the tool catalogue, and measures coverage on the real lessons
// (all 7,470 when scratch/nc/lessons.full.json exists, else the committed 588-lesson stratified sample).
// GATES: every rule references a real tool and a valid regex · per-subject coverage ≥ 85% · golden top-3 hit rate ≥ 90%.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { parseCatalogue } from "../registryData";
import { mergeRules, selectTools } from "./select";
import type { RuleSet, Signal } from "./types";

let n = 0, bad = 0;
const ok = (c: boolean, m: string) => { n++; if (!c) { bad++; console.error("FAIL:", m); } };
const here = path.dirname(new URL(import.meta.url).pathname);
const tools = new Map(parseCatalogue().map((t) => [t.id, t]));
// Tools that exist as data but aren't in the catalogue table (generated `w.*` widget entries) are also valid rule targets.
const knownTool = (id: string) => tools.has(id) || /^w\.[A-Za-z0-9]+$/.test(id);

// RULES_ONLY=maths → test just rules/maths.json + rules/golden-maths.json (each subject can be developed on its own).
const only = process.env.RULES_ONLY;
const files = readdirSync(path.join(here, "rules")).filter((f) => f.endsWith(".json") && !f.includes("golden") && (!only || f === `${only}.json`)).sort();
const sets: RuleSet[] = files.map((f) => JSON.parse(readFileSync(path.join(here, "rules", f), "utf8")));
const rules = mergeRules(sets, "test");
ok(files.length > 0, "at least one rules file");
const ids = new Set<string>();
for (const r of rules.rules) {
  ok(!ids.has(r.id), `rule id unique: ${r.id}`); ids.add(r.id);
  ok(knownTool(r.tool), `rule ${r.id} → unknown tool ${r.tool}`);
  ok(r.weight > 0 && r.weight <= 1, `rule ${r.id} weight in (0,1]`);
  ok(r.any.length > 0, `rule ${r.id} has patterns`);
  for (const p of [...r.any, ...(r.none ?? []), ...(r.programme ? [r.programme] : [])]) { try { new RegExp(p, "i"); } catch { ok(false, `rule ${r.id}: bad regex ${p}`); } }
}
for (const [s, list] of Object.entries(rules.fallback)) for (const t of list) ok(knownTool(t), `fallback ${s} → unknown tool ${t}`);

type L = { t: string; s: string; y: number; u: string; o: string; p: string };
const fullPath = path.join(here, "../../../../scratch/nc/lessons.full.json");
const allLessons: L[] = JSON.parse(readFileSync(existsSync(fullPath) ? fullPath : path.join(here, "fixtures/lessons.sample.json"), "utf8"));
const ONLY_SUBJ: Record<string, string> = { maths: "maths", english: "english", science: "science", languages: "languages" };
const lessons = only && ONLY_SUBJ[only] ? allLessons.filter((l) => l.s === ONLY_SUBJ[only]) : allLessons;
const sig = (l: L): Signal => ({ subject: l.s, year: l.y, title: l.t, unit: l.u, objective: l.o, programme: l.p });

// Coverage: how many lessons of each subject get at least one RULE-based suggestion (not the fallback).
const cov: Record<string, { n: number; hit: number }> = {};
for (const l of lessons) {
  const c = (cov[l.s] ||= { n: 0, hit: 0 });
  c.n++;
  if (selectTools(sig(l), rules, () => true, { max: 3 }).some((x) => x.source === "rule")) c.hit++;
}
// The honest number: how many lessons get a SPECIFIC suggestion (a rule of weight ≥ 0.5) rather than only a low-priority catch-all.
const spec: Record<string, number> = {};
const ruleWeight = new Map(rules.rules.map((r) => [r.id, r.weight]));
for (const l of lessons) if (selectTools(sig(l), rules, () => true, { max: 3 }).some((x) => x.source === "rule" && (ruleWeight.get(x.why.rule) ?? 0) >= 0.5)) spec[l.s] = (spec[l.s] ?? 0) + 1;
console.log(`specific-tool coverage (weight ≥ 0.5): ${Object.entries(cov).map(([s, c]) => `${s} ${Math.round(((spec[s] ?? 0) / c.n) * 100)}%`).join(" · ")}`);
for (const [s, c] of Object.entries(cov)) ok((spec[s] ?? 0) / c.n >= 0.7, `specific coverage for ${s} is ${Math.round(((spec[s] ?? 0) / c.n) * 100)}% (< 70%)`);
const report = Object.entries(cov).map(([s, c]) => `${s} ${Math.round((c.hit / c.n) * 100)}% (${c.hit}/${c.n})`).join(" · ");
console.log(`coverage on ${lessons.length} lessons: ${report}`);
for (const [s, c] of Object.entries(cov)) ok(c.hit / c.n >= 0.85, `coverage for ${s} is ${Math.round((c.hit / c.n) * 100)}% (< 85%)`);

// Every tool is suggested by something, or is deliberately unsuggested (soon tools may be unreferenced).
const used = new Set(rules.rules.map((r) => r.tool));
const idle = [...tools.values()].filter((t) => t.tier === "P1" && !used.has(t.id) && (!only || t.subject === only || t.subject === "cross")).map((t) => t.id);
console.log(`P1 tools no rule points at: ${idle.length ? idle.join(", ") : "none"}`);

// Golden set: hand-labelled lessons; at least one expected tool must appear in the top 3.
interface Golden { t: string; s: string; y: number; u?: string; o?: string; p?: string; expect: string[]; not?: string[] }
const goldenFiles = readdirSync(path.join(here, "rules")).filter((f) => f.includes("golden") && (!only || f === `golden-${only}.json`)).sort();
let gTotal = 0, gHit = 0;
for (const f of goldenFiles) {
  for (const g of JSON.parse(readFileSync(path.join(here, "rules", f), "utf8")) as Golden[]) {
    gTotal++;
    const top = selectTools({ subject: g.s, year: g.y, title: g.t, unit: g.u ?? "", objective: g.o ?? "", programme: g.p }, rules, () => true, { max: 3 }).map((x) => x.tool);
    const hit = g.expect.some((e) => top.includes(e)), banned = (g.not ?? []).filter((x) => top.includes(x));
    if (hit && banned.length === 0) gHit++; else console.error(`golden miss: "${g.t}" (${g.s} Y${g.y}) expected one of [${g.expect}] got [${top}]${banned.length ? ` — must NOT include ${banned}` : ""}`);
  }
}
console.log(`golden: ${gHit}/${gTotal} (${gTotal ? Math.round((gHit / gTotal) * 100) : 0}%)`);
ok(gTotal >= (only ? 30 : 100), `enough golden lessons (have ${gTotal}, need ${only ? 30 : 100})`);
ok(gTotal === 0 || gHit / gTotal >= 0.9, `golden top-3 hit rate ≥ 90% (got ${gTotal ? Math.round((gHit / gTotal) * 100) : 0}%)`);

console.log(`${n} checks, ${bad} failed`);
process.exit(bad ? 1 : 0);
