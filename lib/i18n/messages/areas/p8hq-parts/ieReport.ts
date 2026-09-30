// p8hq: International Expansion report sections (markdown) per language, catalogue keys ieMd_<id>. Row order: en, pl, ro, ur, pa, bn, ar, pt, es, fr, cy.
import { fromRows } from "../_rows";
import { IE_EN } from "./ie_en";
import { IE_A } from "./ie_a";
import { IE_B } from "./ie_b";
import { IE_C } from "./ie_c";

const T: Record<string, string[]> = { ...IE_A, ...IE_B, ...IE_C };
export default fromRows(Object.fromEntries(Object.keys(IE_EN).map((id) => [`ieMd_${id}`, [IE_EN[id], ...T[id]]])));
