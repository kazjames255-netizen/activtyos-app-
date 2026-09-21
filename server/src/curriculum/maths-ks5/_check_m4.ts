// maths-ks5 answer-key checker (agent M4): merges the per-topic tables (_c_*.ts) and the fork-A table (_check_m4_a.ts).
// Run: cd server && npx tsx src/curriculum/maths-ks5/_check_m4.ts
import { checkTopics, finish, type Spec } from "./_m4lib";
import type { CQuestion, CTopic } from "../types";
import * as diff from "./_c_diff";
import * as integ from "./_c_integ";
import * as coord from "./_c_coord";
import * as seq from "./_c_seq";
import * as numm from "./_c_numm";
import * as trig from "./_c_trig";
import * as vec from "./_c_vec";
import * as stat5 from "./_c_stat5";
import * as mech from "./_c_mech";

const parts: { name: string; TOPICS: CTopic[]; T: Record<string, (q: CQuestion) => Spec> }[] = [
  { name: "diff", TOPICS: diff.TOPICS, T: diff.T },
  { name: "integ", TOPICS: integ.TOPICS, T: integ.T },
  { name: "coord", TOPICS: coord.TOPICS, T: coord.T },
  { name: "seq", TOPICS: seq.TOPICS, T: seq.T },
  { name: "numm", TOPICS: numm.TOPICS, T: numm.T },
  { name: "trig", TOPICS: trig.TOPICS, T: trig.T },
  { name: "vec", TOPICS: vec.TOPICS, T: vec.T },
  { name: "stat5", TOPICS: stat5.TOPICS, T: stat5.T },
  { name: "mech", TOPICS: mech.TOPICS, T: mech.T },
];
(async () => {
  for (const f of ["_check_m4_a"]) { try { const m = await import(`./${f}`); parts.push({ name: f, TOPICS: m.TOPICS, T: m.TABLE }); } catch (e) { console.log(`(skipped ${f}: ${(e as Error).message.split("\n")[0]})`); } }
  for (const p of parts) finish(p.name, checkTopics(p.TOPICS, p.T));
})();
