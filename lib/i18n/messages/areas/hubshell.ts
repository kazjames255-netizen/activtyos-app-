// Translations for the `hubshell.` area (Teaching / Learning Hub shell, kit, students, home, mark). Keyed by locale;
// every locale holds the SAME flat keys (no "hubshell." prefix). Split into parts (hubshell-parts/) only so several
// people can edit in parallel; they are merged here. {placeholders}, emoji, numbers and proper nouns are shared.
import shell from "./hubshell-parts/shell";
import kit from "./hubshell-parts/kit";
import students from "./hubshell-parts/students";
import home from "./hubshell-parts/home";

const LOCALES = ["en", "pl", "ro", "ur", "pa", "bn", "ar", "pt", "es", "fr", "cy"];
const hubshell: Record<string, Record<string, string>> = {};
for (const l of LOCALES) hubshell[l] = { ...shell[l], ...kit[l], ...students[l], ...home[l] };
export default hubshell;
