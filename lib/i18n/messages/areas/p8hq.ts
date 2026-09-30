// p8hq: overnight i18n sweep (1 Oct 2026). Row order: en, pl, ro, ur, pa, bn, ar, pt, es, fr, cy. Use {brand} for the product name.
// Split into parts (p8hq-parts/) so several people can edit in parallel; merged here.
import sales from "./p8hq-parts/sales";
import leads from "./p8hq-parts/leads";
import venture from "./p8hq-parts/venture";
import support from "./p8hq-parts/support";
import analytics from "./p8hq-parts/analytics";
import misc from "./p8hq-parts/misc";
import call from "./p8hq-parts/call";

const LOCALES = ["en", "pl", "ro", "ur", "pa", "bn", "ar", "pt", "es", "fr", "cy"];
const p8hq: Record<string, Record<string, string>> = {};
const parts = [sales, leads, venture, support, analytics, misc, call] as unknown as Record<string, Record<string, string>>[];
for (const l of LOCALES) p8hq[l] = Object.assign({}, ...parts.map((p) => p[l]));
export default p8hq;
