// Run: server/node_modules/.bin/tsx features/learninghub/tools/selection/select.unit.selftest.ts
import { mergeRules, programmeFromKey, selectTools, unitFromKey } from "./select";
import type { RuleSet } from "./types";
let n = 0, bad = 0;
const ok = (c: boolean, m: string) => { n++; if (!c) { bad++; console.error("FAIL:", m); } };
const set: RuleSet = {
  version: "t", fallback: { maths: ["X-03"], "*": ["X-03", "X-05"] },
  rules: [
    { id: "a", tool: "M-02", weight: 0.9, any: ["protractor", "measure angles"], subject: ["maths"] },
    { id: "b", tool: "M-02", weight: 0.6, any: ["angles"], subject: ["maths"] },
    { id: "c", tool: "M-01", weight: 0.7, any: ["ruler|length"], subject: ["maths"] },
    { id: "t", tool: "H-H01", weight: 0.9, any: ["timeline|chronolog"], none: ["non-chronological"] },
    { id: "y", tool: "M-40", weight: 0.8, any: ["number line"], years: [1, 4] },
    { id: "pr", tool: "S-13", weight: 0.9, any: ["periodic"], programme: "^chemistry" },
    { id: "u", tool: "M-44", weight: 0.9, any: ["fractions"], fields: ["unit"] },
  ],
};
const sig = (o: Partial<{ subject: string; year: number | null; title: string; unit: string; objective: string; programme: string }>) => ({ subject: "maths", year: 5, title: "", unit: "", objective: "", ...o });
const top = (o: Parameters<typeof sig>[0], opt = {}) => selectTools(sig(o), set, () => true, opt);

let r = top({ title: "Measuring angles with a protractor" });
ok(r[0]?.tool === "M-02" && r[0].why.rule === "a" && r[0].why.field === "title" && /protractor/i.test(r[0].why.match), "best rule wins and explains itself");
ok(r[0]!.score > 0.9, "agreeing rules add a small bonus (0.9 + 0.05)");
ok(top({ title: "A non-chronological report" }, { max: 5 }).every((s) => s.tool !== "H-H01"), "'none' kills a known false positive");
ok(top({ subject: "history", title: "A timeline of Rome" })[0]?.tool === "H-H01", "unfiltered rule works for any subject");
ok(top({ title: "Using a number line", year: 6 }).every((s) => s.tool !== "M-40") && top({ title: "Using a number line", year: 3 })[0]?.tool === "M-40", "year filter");
ok(top({ subject: "science", title: "The periodic table", programme: "biology-secondary-ks4-aqa" }).every((s) => s.tool !== "S-13"), "programme filter (excluded)");
ok(top({ subject: "Science", title: "The periodic table", programme: "chemistry-secondary-ks4-aqa" })[0]?.tool === "S-13", "programme filter (matched) + subject names normalise");
ok(top({ title: "Adding fractions" }).every((s) => s.tool !== "M-44") && top({ unit: "adding fractions" })[0]?.tool === "M-44", "field filter: unit only");
ok(top({ title: "Something unrelated" }).map((s) => s.tool).join() === "X-03" && top({ title: "Something unrelated" })[0]!.source === "fallback", "fallback when nothing matches");
ok(top({ subject: "art", title: "Colour wheel" }).map((s) => s.tool).join() === "X-03,X-05", "'*' fallback for unknown subjects");
r = top({ title: "Measuring length with a ruler and protractor" }, { overrides: { hide: ["M-02"] } });
ok(r.every((s) => s.tool !== "M-02") && r[0]?.tool === "M-01", "hide beats rules");
r = top({ title: "Measuring length" }, { overrides: { pin: ["X-05"] } });
ok(r[0]?.tool === "X-05" && r[0].source === "pinned", "pin goes first");
ok(selectTools(sig({ title: "protractor" }), set, (t) => t !== "M-02").every((s) => s.tool !== "M-02"), "unavailable tools never suggested");
ok(top({ title: "protractor ruler angles length" }, { max: 1 }).length === 1, "max respected");
const s1 = JSON.stringify(top({ title: "Measuring angles with a protractor and a ruler" })), s2 = JSON.stringify(top({ title: "Measuring angles with a protractor and a ruler" }));
ok(s1 === s2, "deterministic");
ok(unitFromKey("english-primary-ks1/units/a-superhero-like-you-12/lessons/x") === "a superhero like you" && unitFromKey(null) === "" && programmeFromKey("maths-secondary-ks4-higher-aqa/units/u/lessons/l") === "maths-secondary-ks4-higher-aqa", "unit/programme parsing");
ok(mergeRules([set, { version: "x", rules: [], fallback: { english: ["E-01"] } }], "m").fallback.english?.[0] === "E-01", "merge fallbacks");
ok(top({ title: "Using a number line", year: null })[0]?.tool === "M-40", "unknown year is not filtered out");
ok(selectTools(sig({ subject: "", title: "Measuring with a protractor" }), set, () => true)[0]?.tool === "M-02", "unknown subject: every subject's rules get a go");
console.log(`${n} checks, ${bad} failed`);
process.exit(bad ? 1 : 0);
