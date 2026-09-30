// p8lst: overnight i18n sweep (1 Oct 2026): listings, blocks, bookings, storefront, plan, payments. Split into parts
// (p8lst-parts/) only so several workers can edit in parallel; they are merged here. Keys are flat (no "p8lst." prefix).
// Row order in each part: en, pl, ro, ur, pa, bn, ar, pt, es, fr, cy. Use {brand} for the product name.
import core from "./p8lst-parts/core";
import blocks from "./p8lst-parts/blocks";
import lst from "./p8lst-parts/lst";
import ck from "./p8lst-parts/ck";
import wiz1 from "./p8lst-parts/wiz1";
import wiz2 from "./p8lst-parts/wiz2";

const LOCALES = ["en", "pl", "ro", "ur", "pa", "bn", "ar", "pt", "es", "fr", "cy"] as const;
const p8lst = {} as Record<(typeof LOCALES)[number], Record<string, string>>;
for (const l of LOCALES) p8lst[l] = { ...core[l], ...blocks[l], ...lst[l], ...ck[l], ...wiz1[l], ...wiz2[l] };
export default p8lst;
