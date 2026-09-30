// Helper for "label by English text" rows: each row is [en, pl, ro, ur, pa, bn, ar, pt, es, fr, cy]; the catalogue key is
// derived from the English text (hqKey), so code can call hq("English text") without inventing key names.
import { fromRows } from "../_rows";
import { hqKey } from "./_key";

export const lwRows = (rows: string[][]) => fromRows(Object.fromEntries(rows.map((r) => [hqKey(r[0]), r])));
