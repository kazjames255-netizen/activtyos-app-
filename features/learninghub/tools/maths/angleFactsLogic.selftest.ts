// Run: server/node_modules/.bin/tsx features/learninghub/tools/maths/angleFactsLogic.selftest.ts
import { angleOf, factsFrom, REGIONS, relation, type Region } from "./angleFactsLogic";
let n = 0, bad = 0;
const ok = (c: boolean, m: string) => { n++; if (!c) { bad++; console.error("FAIL:", m); } };
for (const th of [30, 50, 72, 90, 123]) {
  for (const r of REGIONS) ok(angleOf(r, th) === th || angleOf(r, th) === 180 - th, "each angle is θ or 180−θ");
  const R = (a: Region, b: Region) => relation(a, b, th);
  ok(R("a", "c").reason === "vertically opposite" && R("a", "c").equal, `θ=${th}: a,c vertically opposite`);
  ok(R("a", "b").reason === "angles on a straight line" && R("a", "b").sum180, `θ=${th}: a,b on a line`);
  ok(R("a", "e").reason === "corresponding" && R("a", "e").equal, `θ=${th}: a,e corresponding`);
  ok(R("b", "f").reason === "corresponding" && R("d", "h").reason === "corresponding", "b,f and d,h corresponding");
  ok(R("d", "f").reason === "alternate" && R("d", "f").equal, `θ=${th}: d,f alternate (equal)`);
  ok(R("c", "e").reason === "alternate" && R("c", "e").equal, `θ=${th}: c,e alternate (equal)`);
  ok(R("d", "e").reason === "co-interior (allied)" && R("d", "e").sum180, `θ=${th}: d,e co-interior (sum 180)`);
  ok(R("c", "f").reason === "co-interior (allied)" && R("c", "f").sum180, `θ=${th}: c,f co-interior (sum 180)`);
  ok(R("a", "g").reason === "alternate" ? R("a", "g").equal : false, "a,g are the outer alternate pair");
  ok(R("a", "d").reason === "angles on a straight line", "a,d on the line");
}
// every stated reason really has the property it names
for (const th of [37, 111]) for (const a of REGIONS) for (const b of REGIONS) {
  const r = relation(a, b, th);
  if (r.reason === "corresponding" || r.reason === "alternate" || r.reason === "vertically opposite") ok(r.equal, `${a},${b} ${r.reason} must be equal`);
  if (r.reason === "co-interior (allied)" || r.reason === "angles on a straight line") ok(r.sum180, `${a},${b} ${r.reason} must sum to 180°`);
}
ok(factsFrom("a", 50).map((f) => f.region).join() === "b,c,d,e,g", `a relates to b,c,d,e,g (got ${factsFrom("a", 50).map((f) => f.region).join()})`);
console.log(`${n} checks, ${bad} failed`);
process.exit(bad ? 1 : 0);
