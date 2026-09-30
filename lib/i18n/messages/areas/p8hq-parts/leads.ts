// p8hq leads part: LeadsApp (labels keyed by English text via hq()).
import { lwRows } from "./_lw";
import { LEADS1 } from "./leads1";
import { LEADS2 } from "./leads2";
import { LEADS3 } from "./leads3";
import { LEADS4 } from "./leads4";

export default lwRows([...LEADS1, ...LEADS2, ...LEADS3, ...LEADS4]);
