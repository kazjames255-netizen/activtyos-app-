// Translations for the `hubfam.` area (Teaching / Learning Hub: family, quiz, shared-assess, progress).
// Keyed by locale; every locale holds the SAME flat keys (no "hubfam." prefix). {placeholders}, emoji, numbers and
// proper nouns are shared across languages. To keep parallel work conflict-free the catalogue is composed from
// per-part files in ./hubfam-parts (each exports Record<locale, Record<key,string>>; key prefixes are unique per part).
import fam from "./hubfam-parts/fam";
import prog from "./hubfam-parts/prog";
import quiz from "./hubfam-parts/quiz";
import assess from "./hubfam-parts/assess";

const LOCALES = ["en", "pl", "ro", "ur", "pa", "bn", "ar", "pt", "es", "fr", "cy"];
const hubfam: Record<string, Record<string, string>> = {};
for (const l of LOCALES) hubfam[l] = { ...fam[l], ...prog[l], ...quiz[l], ...assess[l] };
export default hubfam;
