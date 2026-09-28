// Translations for the `hubhomework.` area (Teaching / Learning Hub → Homework: features/learninghub/homework/*). Keyed by locale; every
// locale holds the SAME flat keys (no "hubhomework." prefix). {placeholders}, emoji, numbers and proper nouns are shared across languages.
// One file per language under hubhomework-parts/ (follow docs/i18n-glossary.md and the register rules there).
import en from "./hubhomework-parts/en";
import pl from "./hubhomework-parts/pl";
import ro from "./hubhomework-parts/ro";
import ur from "./hubhomework-parts/ur";
import pa from "./hubhomework-parts/pa";
import bn from "./hubhomework-parts/bn";
import ar from "./hubhomework-parts/ar";
import pt from "./hubhomework-parts/pt";
import es from "./hubhomework-parts/es";
import fr from "./hubhomework-parts/fr";
import cy from "./hubhomework-parts/cy";
const hubhomework: Record<string, Record<string, string>> = { en, pl, ro, ur, pa, bn, ar, pt, es, fr, cy };
export default hubhomework;
