// Catalogue areas that load ON DEMAND (one locale + English, like the Teaching Hub's: see hubMessages.ts) instead of riding in every page's
// JavaScript. The overnight i18n sweep added ~9 MB of source across 11 languages; bundling it eagerly made every page (login included) parse
// it. Keys in these areas ("p8set.foo") resolve through hubMessages.lookupHub; until the catalogue lands they render blank, never a raw key.
// Kept eager (small, needed by the first paint of public pages): p8pub, p8par.  A NEW lazy area: add its name here AND to ./messages/lazy.ts.
export const LAZY_AREA_NAMES = ["p8set", "p8em", "p8lst", "p8fin", "p8wf", "p8lrn", "p8ops", "p8hq", "p8fr", "p8misc", "p8api", "p8tst"] as const;
export const LAZY_KEY_RE = new RegExp(`^(${LAZY_AREA_NAMES.join("|")})\\.`);
