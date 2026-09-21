// Answer-key checker for proof.ts, algf.ts, explog.ts (fork a). Run: cd server && npx tsx src/curriculum/maths-ks5/_check_m4_a.ts
import type { CQuestion, CTopic } from "../types";
import { checkTopics, finish, type Spec } from "./_m4lib";
import { TOPIC as PROOF } from "./proof";
import { T as TP } from "./_c_a_proof";
import { TOPIC as ALGF } from "./algf";
import { T as TA } from "./_c_a_algf";
import { TOPIC as EXPLOG } from "./explog";
import { T as TE } from "./_c_a_explog";

export const TOPICS: CTopic[] = [PROOF, ALGF, EXPLOG];
export const TABLE: Record<string, (q: CQuestion) => Spec> = { ...TP, ...TA, ...TE };
if (process.argv[1]?.includes("_check_m4_a")) finish("m4a", checkTopics(TOPICS, TABLE));
