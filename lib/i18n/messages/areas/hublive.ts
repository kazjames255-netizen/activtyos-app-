// Translations for the `hublive.` area (Teaching / Learning Hub live lessons, in-person, remote-sync, board, help tools).
// Split into parts (hublive_a..e) to keep files manageable; each part holds the SAME flat keys per locale, and key
// names are unique across parts (each part prefixes its keys). {placeholders}, emoji, numbers are shared across languages.
import a from "./hublive_a";
import b from "./hublive_b";
import c from "./hublive_c";
import d from "./hublive_d";
import e from "./hublive_e";

const LOCALES = ["en", "pl", "ro", "ur", "pa", "bn", "ar", "pt", "es", "fr", "cy"] as const;
const hublive: Record<string, Record<string, string>> = {};
for (const l of LOCALES) hublive[l] = { ...a[l], ...b[l], ...c[l], ...d[l], ...e[l] };
export default hublive;
