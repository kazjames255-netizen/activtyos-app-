// Translations for the `hubtoolsb.` area (Teaching / Learning Hub: tools catalogue, tool host, picker, science / English / languages tools).
// Keyed by locale; every locale holds the SAME flat keys (no "hubtoolsb." prefix). Split into parts (hubtoolsb-parts/) and merged here.
// {placeholders}, emoji, numbers and proper nouns are shared across languages. **double-star** marks bold text (see tools/toolTextB.tsx).
// The legacy prototype widgets have their own table (hubtoolsb-legacy/) applied by LegacyWidget.tsx.
import core from "./hubtoolsb-parts/core";
import science from "./hubtoolsb-parts/science";
import english from "./hubtoolsb-parts/english";
import languages from "./hubtoolsb-parts/languages";

const LOCALES = ["en", "pl", "ro", "ur", "pa", "bn", "ar", "pt", "es", "fr", "cy"];
const hubtoolsb: Record<string, Record<string, string>> = {};
for (const l of LOCALES) hubtoolsb[l] = { ...core[l], ...science[l], ...english[l], ...languages[l] };
export default hubtoolsb;
