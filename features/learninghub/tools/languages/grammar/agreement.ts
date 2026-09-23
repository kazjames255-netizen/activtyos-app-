// MFL agreement, determiners, negation and question builders (Spanish / French / German). PURE.
import { esPlural } from "./nouns";
import type { Num } from "./nouns";

export type G2 = "m" | "f";
const cap = (s: string) => (s ? s[0]!.toLocaleUpperCase() + s.slice(1) : s);
const unAccent = (s: string) => s.replace(/[áéíóú]/, (c) => ({ á: "a", é: "e", í: "i", ó: "o", ú: "u" })[c]!);
const startsVowel = (s: string) => /^[aeiouyhàâæéèêëîïôœùûü]/i.test(s);

// ══════════════════════════ SPANISH adjectives ══════════════════════════
/** Adjectives that shorten before a noun: buen(o), mal(o), primer(o), tercer(o) — masculine singular only; gran(de) — either gender, singular only. */
export const ES_APOCOPE: Record<string, { short: string; bothGenders: boolean }> = {
  bueno: { short: "buen", bothGenders: false }, malo: { short: "mal", bothGenders: false }, primero: { short: "primer", bothGenders: false }, tercero: { short: "tercer", bothGenders: false }, grande: { short: "gran", bothGenders: true },
};
/** -or / -ón / -án / -és / -ol adjectives add -a for the feminine (trabajador → trabajadora) — except these, which never change. */
const ES_INVARIABLE_F = new Set(["marrón", "mejor", "peor", "mayor", "menor", "superior", "inferior", "exterior", "interior", "anterior", "posterior"]);
const ES_ADJ_PLURAL: Record<string, string> = { joven: "jóvenes", gris: "grises" };
export function esAdjective(m: string, gender: G2, number: Num, beforeNoun = false): string {
  const ap = ES_APOCOPE[m];
  if (beforeNoun && number === "sg" && ap && (gender === "m" || ap.bothGenders)) return ap.short;
  let form = m;
  if (gender === "f") {
    if (/o$/.test(m)) form = m.slice(0, -1) + "a";
    else if (!ES_INVARIABLE_F.has(m) && /(án|ón|ín|és|or|ol)$/.test(m)) form = unAccent(m) + "a";
  }
  if (number === "sg") return form;
  return ES_ADJ_PLURAL[form] ?? esPlural(form);
}
export interface Adj { m: string; en: string; pos: "before" | "after" | "either" }
export const ES_ADJECTIVES: Adj[] = [
  { m: "bueno", en: "good", pos: "before" }, { m: "malo", en: "bad", pos: "before" }, { m: "grande", en: "big / great", pos: "before" }, { m: "primero", en: "first", pos: "before" },
  { m: "alto", en: "tall", pos: "after" }, { m: "bajo", en: "short / low", pos: "after" }, { m: "simpático", en: "nice", pos: "after" }, { m: "español", en: "Spanish", pos: "after" },
  { m: "inglés", en: "English", pos: "after" }, { m: "alemán", en: "German", pos: "after" }, { m: "francés", en: "French", pos: "after" }, { m: "trabajador", en: "hard-working", pos: "after" },
  { m: "feliz", en: "happy", pos: "after" }, { m: "fácil", en: "easy", pos: "after" }, { m: "difícil", en: "difficult", pos: "after" }, { m: "azul", en: "blue", pos: "after" },
  { m: "rojo", en: "red", pos: "after" }, { m: "blanco", en: "white", pos: "after" }, { m: "negro", en: "black", pos: "after" }, { m: "marrón", en: "brown", pos: "after" },
  { m: "joven", en: "young", pos: "after" }, { m: "nuevo", en: "new", pos: "after" }, { m: "pequeño", en: "small", pos: "after" }, { m: "interesante", en: "interesting", pos: "after" },
  { m: "aburrido", en: "boring", pos: "after" }, { m: "divertido", en: "fun", pos: "after" }, { m: "gris", en: "grey", pos: "after" }, { m: "verde", en: "green", pos: "after" },
];

// ══════════════════════════ FRENCH adjectives ══════════════════════════
const FR_FEM_IRR: Record<string, string> = {
  beau: "belle", nouveau: "nouvelle", jumeau: "jumelle", vieux: "vieille", fou: "folle", mou: "molle", blanc: "blanche", franc: "franche", sec: "sèche", frais: "fraîche", long: "longue", public: "publique", grec: "grecque", turc: "turque",
  doux: "douce", faux: "fausse", roux: "rousse", bref: "brève", gentil: "gentille", complet: "complète", secret: "secrète", discret: "discrète", inquiet: "inquiète", épais: "épaisse", gros: "grosse", bas: "basse", gras: "grasse", nul: "nulle",
  favori: "favorite", malin: "maligne", meilleur: "meilleure", mineur: "mineure", majeur: "majeure", supérieur: "supérieure", inférieur: "inférieure", extérieur: "extérieure", intérieur: "intérieure",
};
/** Colour / slang adjectives that never agree. */
export const FR_INVARIABLE = new Set(["orange", "marron", "sympa", "super", "cool", "chic", "bleu marine", "kaki"]);
/** Masculine singular before a vowel or mute h. */
export const FR_LIAISON: Record<string, string> = { beau: "bel", nouveau: "nouvel", vieux: "vieil", fou: "fol", mou: "mol" };
const FR_AL_PLURAL_S = new Set(["banal", "fatal", "final", "natal", "naval", "glacial", "bancal"]);
export function frFeminine(m: string): string {
  if (FR_FEM_IRR[m]) return FR_FEM_IRR[m]!;
  if (/e$/.test(m)) return m;
  if (/eux$/.test(m)) return m.slice(0, -1) + "se";
  if (/eur$/.test(m)) return m.slice(0, -1) + "se";           // menteur → menteuse
  if (/er$/.test(m)) return m.slice(0, -2) + "ère";           // premier → première, cher → chère
  if (/f$/.test(m)) return m.slice(0, -1) + "ve";             // actif → active, neuf → neuve
  if (/(el|en|on)$/.test(m)) return m + m.slice(-1) + "e";    // actuel → actuelle, ancien → ancienne, bon → bonne
  if (/et$/.test(m)) return m + "te";                         // violet → violette
  if (/x$/.test(m)) return m.slice(0, -1) + "se";             // jaloux → jalouse
  return m + "e";                                             // grand → grande, français → française, petit → petite
}
export function frMasculinePlural(m: string): string {
  if (/[sx]$/.test(m)) return m;
  if (/eau$/.test(m)) return m + "x";
  if (/al$/.test(m)) return FR_AL_PLURAL_S.has(m) ? m + "s" : m.slice(0, -2) + "aux";
  return m + "s";
}
export function frAdjective(m: string, gender: G2, number: Num, beforeVowel = false): string {
  if (FR_INVARIABLE.has(m)) return m;
  if (gender === "m" && number === "sg") return beforeVowel && FR_LIAISON[m] ? FR_LIAISON[m]! : m;
  if (gender === "m") return frMasculinePlural(m);
  const f = frFeminine(m);
  return number === "sg" ? f : f + "s";
}
export const FR_ADJECTIVES: Adj[] = [
  { m: "petit", en: "small", pos: "before" }, { m: "grand", en: "big / tall", pos: "before" }, { m: "joli", en: "pretty", pos: "before" }, { m: "beau", en: "beautiful", pos: "before" },
  { m: "nouveau", en: "new", pos: "before" }, { m: "vieux", en: "old", pos: "before" }, { m: "bon", en: "good", pos: "before" }, { m: "mauvais", en: "bad", pos: "before" },
  { m: "jeune", en: "young", pos: "before" }, { m: "gros", en: "fat / big", pos: "before" }, { m: "long", en: "long", pos: "either" }, { m: "blanc", en: "white", pos: "after" },
  { m: "noir", en: "black", pos: "after" }, { m: "bleu", en: "blue", pos: "after" }, { m: "rouge", en: "red", pos: "after" }, { m: "vert", en: "green", pos: "after" },
  { m: "heureux", en: "happy", pos: "after" }, { m: "facile", en: "easy", pos: "after" }, { m: "français", en: "French", pos: "after" }, { m: "sportif", en: "sporty", pos: "after" },
  { m: "gentil", en: "kind", pos: "after" }, { m: "italien", en: "Italian", pos: "after" }, { m: "premier", en: "first", pos: "before" }, { m: "actif", en: "active", pos: "after" },
  { m: "travailleur", en: "hard-working", pos: "after" }, { m: "sympa", en: "nice", pos: "after" }, { m: "orange", en: "orange", pos: "after" }, { m: "normal", en: "normal", pos: "after" },
];

// ══════════════════════════ possessives & demonstratives (es / fr) ══════════════════════════
export type Owner = "1s" | "2s" | "3s" | "1p" | "2p" | "3p";
export const OWNER_LABEL: Record<Owner, string> = { "1s": "my", "2s": "your (tú/tu/du)", "3s": "his / her", "1p": "our", "2p": "your (vosotros/vous/ihr)", "3p": "their" };
/** Spanish: agrees with the thing owned. mi/mis tu/tus su/sus; nuestro/a/os/as vuestro/a/os/as. */
export function esPossessive(owner: Owner, gender: G2, number: Num): string {
  const s = number === "pl" ? "s" : "";
  if (owner === "1s") return "mi" + s;
  if (owner === "2s") return "tu" + s;
  if (owner === "3s" || owner === "3p") return "su" + s;
  const stem = owner === "1p" ? "nuestr" : "vuestr";
  return stem + (gender === "m" ? "o" : "a") + s;
}
/** French: mon/ma/mes; ma → mon before a vowel or mute h (mon amie). */
export function frPossessive(owner: Owner, gender: G2, number: Num, beforeVowel = false): string {
  const t = { "1s": ["mon", "ma", "mes"], "2s": ["ton", "ta", "tes"], "3s": ["son", "sa", "ses"] } as const;
  if (owner === "1s" || owner === "2s" || owner === "3s") {
    const [m, f, p] = t[owner];
    return number === "pl" ? p : gender === "m" || beforeVowel ? m : f;
  }
  const stem = owner === "1p" ? "notre" : owner === "2p" ? "votre" : "leur";
  return number === "pl" ? (owner === "1p" ? "nos" : owner === "2p" ? "vos" : "leurs") : stem;
}
export type Distance = "near" | "mid" | "far";
/** este / ese / aquel (near / medium / far). */
export function esDemonstrative(distance: Distance, gender: G2, number: Num): string {
  const stem = distance === "near" ? "est" : distance === "mid" ? "es" : "aquel";
  if (distance === "far") return number === "sg" ? (gender === "m" ? "aquel" : "aquella") : gender === "m" ? "aquellos" : "aquellas";
  return stem + (number === "sg" ? (gender === "m" ? "e" : "a") : gender === "m" ? "os" : "as");
}
/** ce / cet (before a vowel or mute h) / cette / ces. */
export function frDemonstrative(gender: G2, number: Num, beforeVowel = false): string {
  if (number === "pl") return "ces";
  return gender === "f" ? "cette" : beforeVowel ? "cet" : "ce";
}
/** quel / quelle / quels / quelles. */
export const frQuel = (gender: G2, number: Num) => "quel" + (gender === "f" ? "le" : "") + (number === "pl" ? "s" : "");

// ══════════════════════════ GERMAN cases, determiners, adjective endings ══════════════════════════
export type DeCase = "nom" | "acc" | "dat" | "gen";
export type DeG = "m" | "f" | "n" | "pl";
export type Declension = "weak" | "mixed" | "strong";
export const DE_CASES: DeCase[] = ["nom", "acc", "dat", "gen"];
export const DE_GENDERS: DeG[] = ["m", "f", "n", "pl"];
export const DE_CASE_LABEL: Record<DeCase, string> = { nom: "Nominative", acc: "Accusative", dat: "Dative", gen: "Genitive" };
export const DE_G_LABEL: Record<DeG, string> = { m: "masc.", f: "fem.", n: "neut.", pl: "plural" };
type Table = Record<DeCase, Record<DeG, string>>;
const tab = (nom: string, acc: string, dat: string, gen: string): Table => {
  const row = (s: string) => { const [m, f, n, pl] = s.split(" "); return { m: m!, f: f!, n: n!, pl: pl! }; };
  return { nom: row(nom), acc: row(acc), dat: row(dat), gen: row(gen) };
};
/** Adjective endings after der/die/das (weak), ein/kein/mein (mixed) and with no article (strong). */
export const DE_ADJ_ENDINGS: Record<Declension, Table> = {
  weak: tab("e e e en", "en e e en", "en en en en", "en en en en"),
  mixed: tab("er e es en", "en e es en", "en en en en", "en en en en"),
  strong: tab("er e es e", "en e es e", "em er em en", "en er en er"),
};
export const DE_DEFINITE: Table = tab("der die das die", "den die das die", "dem der dem den", "des der des der");
/** kein-type endings (ein, kein, mein, dein, sein, ihr, unser, euer). "-" = no ending. */
const EIN_END = tab("- e - e", "en e - e", "em er em en", "es er es er");
/** der-type endings (dieser, jener, jeder, welcher, solcher). */
const DER_END = tab("er e es e", "en e es e", "em er em en", "es er es er");
export type DetKind = "definite" | "indefinite" | "negative" | "possessive" | "demonstrative" | "none";
/** Stems for possessives: mein dein sein ihr unser euer ihr Ihr. */
export const DE_POSSESSIVE_STEMS = ["mein", "dein", "sein", "ihr", "unser", "euer", "Ihr"];
/** The determiner itself: deDeterminer("definite","dat","f") → "der"; ("possessive","acc","m","euer") → "euren"; ("demonstrative","nom","n") → "dieses". Plural indefinite is "" (no article). */
export function deDeterminer(kind: DetKind, c: DeCase, g: DeG, stem?: string): string {
  if (kind === "none") return "";
  if (kind === "definite") return DE_DEFINITE[c][g];
  if (kind === "demonstrative") return (stem ?? "dies") + DER_END[c][g].replace("-", "");
  const e = EIN_END[c][g], base = kind === "indefinite" ? "ein" : kind === "negative" ? "kein" : stem ?? "mein";
  if (kind === "indefinite" && g === "pl") return "";
  const b = e !== "-" && base === "euer" ? "eur" : base; // euer → eure, euren, eurem
  return b + (e === "-" ? "" : e);
}
export const declensionAfter = (kind: DetKind): Declension => (kind === "definite" || kind === "demonstrative" ? "weak" : kind === "none" ? "strong" : "mixed");
/** The ending an adjective takes. */
export const deAdjEnding = (d: Declension, c: DeCase, g: DeG) => DE_ADJ_ENDINGS[d][c][g];
const DE_STEM_IRR: Record<string, string> = { hoch: "hoh" };
/** Stem before an ending: hoch → hoh, teuer → teur, dunkel → dunkl. */
export function deAdjStem(adj: string): string {
  if (DE_STEM_IRR[adj]) return DE_STEM_IRR[adj]!;
  if (/(teuer|sauer)$/.test(adj)) return adj.slice(0, -2) + "r";
  if (/el$/.test(adj) && !/eel$/.test(adj)) return adj.slice(0, -2) + "l";
  return adj;
}
const DE_ADJ_INVARIABLE = new Set(["rosa", "lila", "prima", "klasse"]);
export function deAdjective(adj: string, d: Declension, c: DeCase, g: DeG): string {
  if (DE_ADJ_INVARIABLE.has(adj)) return adj;
  return deAdjStem(adj) + deAdjEnding(d, c, g);
}
/** Dative plural nouns end in -n (unless the plural already ends in -n or -s). */
export const deDativePlural = (pl: string) => (/[ns]$/.test(pl) ? pl : pl + "n");
export interface DePhrase { kind: DetKind; stem?: string; adj?: string; noun: string; /** plural form (needed for plurals) */ plural?: string; case: DeCase; gender: DeG }
/** Full noun phrase: "der große Mann", "einen großen Hund", "mit meinen neuen Freunden", "rote Rosen". */
export function dePhrase(p: DePhrase): string {
  const det = deDeterminer(p.kind, p.case, p.gender, p.stem);
  const adj = p.adj ? deAdjective(p.adj, declensionAfter(p.kind), p.case, p.gender) : "";
  let noun = p.gender === "pl" ? p.plural ?? p.noun : p.noun;
  if (p.gender === "pl" && p.case === "dat") noun = deDativePlural(noun);
  return [det, adj, noun].filter(Boolean).join(" ");
}
export const deAdjectiveTable = (d: Declension) => DE_ADJ_ENDINGS[d];
export const DE_ADJECTIVES = ["groß", "klein", "alt", "neu", "jung", "gut", "schön", "hoch", "teuer", "dunkel", "lang", "kurz", "warm", "kalt", "nett", "lustig", "billig", "rot", "blau", "schwarz", "weiß"];

// ── prepositions and the case they take (L-11) ──
export type PrepCase = "acc" | "dat" | "gen" | "two";
export interface Prep { word: string; case: PrepCase; en: string }
export const DE_PREPOSITIONS: Prep[] = [
  { word: "durch", case: "acc", en: "through" }, { word: "für", case: "acc", en: "for" }, { word: "gegen", case: "acc", en: "against" }, { word: "ohne", case: "acc", en: "without" }, { word: "um", case: "acc", en: "around / at" }, { word: "bis", case: "acc", en: "until" },
  { word: "aus", case: "dat", en: "out of / from" }, { word: "bei", case: "dat", en: "at / near" }, { word: "mit", case: "dat", en: "with" }, { word: "nach", case: "dat", en: "after / to" }, { word: "seit", case: "dat", en: "since" }, { word: "von", case: "dat", en: "from / of" }, { word: "zu", case: "dat", en: "to" }, { word: "gegenüber", case: "dat", en: "opposite" },
  { word: "während", case: "gen", en: "during" }, { word: "wegen", case: "gen", en: "because of" }, { word: "trotz", case: "gen", en: "despite" }, { word: "statt", case: "gen", en: "instead of" },
  { word: "an", case: "two", en: "at / on (vertical)" }, { word: "auf", case: "two", en: "on top of" }, { word: "hinter", case: "two", en: "behind" }, { word: "in", case: "two", en: "in / into" }, { word: "neben", case: "two", en: "next to" }, { word: "über", case: "two", en: "over / above" }, { word: "unter", case: "two", en: "under" }, { word: "vor", case: "two", en: "in front of" }, { word: "zwischen", case: "two", en: "between" },
];
/** The case after a preposition. Two-way prepositions: accusative for movement to a place (wohin?), dative for position (wo?). */
export const caseAfter = (p: Prep, movement: boolean): DeCase => (p.case === "two" ? (movement ? "acc" : "dat") : p.case);
const CONTRACTIONS: Record<string, string> = { "in dem": "im", "in das": "ins", "an dem": "am", "an das": "ans", "auf das": "aufs", "zu dem": "zum", "zu der": "zur", "bei dem": "beim", "von dem": "vom", "für das": "fürs", "um das": "ums", "durch das": "durchs" };
/** "in die Stadt" + alternatives with contractions ("ins Kino" for in das Kino). Genitive nouns are given the -s/-es ending only if the caller passes `genNoun`. */
export function prepositionPhrase(p: Prep, movement: boolean, noun: { word: string; gender: "m" | "f" | "n"; plural?: string }, number: Num = "sg", genNoun?: string): { text: string; alternatives: string[]; case: DeCase } {
  const c = caseAfter(p, movement), g: DeG = number === "pl" ? "pl" : noun.gender;
  const det = DE_DEFINITE[c][g];
  let n = number === "pl" ? noun.plural ?? noun.word : noun.word;
  if (number === "pl" && c === "dat") n = deDativePlural(n);
  if (c === "gen" && number === "sg" && noun.gender !== "f") n = genNoun ?? n;
  const text = `${p.word} ${det} ${n}`, alt = CONTRACTIONS[`${p.word} ${det}`];
  return { text, alternatives: alt ? [`${alt} ${n}`] : [], case: c };
}

// ══════════════════════════ NEGATION ══════════════════════════
export interface Built { text: string; alternatives: string[] }
const built = (text: string, alts: string[] = []): Built => ({ text, alternatives: alts.filter((a, i) => a !== text && alts.indexOf(a) === i) });
export type EsNeg = "no" | "nunca" | "jamás" | "tampoco" | "nada" | "nadie";
/** Spanish negative. `verb` includes any object pronouns ("lo tengo"). "nunca/jamás/tampoco" go before the verb (no "no"); or after it with "no". "nada/nadie" follow the verb with "no" (personal "a" before nadie). */
export function esNegate(verb: string, rest: string, word: EsNeg): Built {
  const tail = rest ? " " + rest : "";
  if (word === "no") return built(`no ${verb}${tail}`);
  if (word === "nada") return built(`no ${verb} nada${tail}`, [`nada ${verb}${tail}`]);
  if (word === "nadie") return built(`no ${verb} a nadie${tail}`, [`no ${verb} nadie${tail}`]);
  return built(`${word} ${verb}${tail}`, [`no ${verb} ${word}${tail}`]);
}
export type FrNeg = "pas" | "jamais" | "rien" | "plus" | "personne" | "pas de";
export interface FrNegOpts { subject: string; verb: string; /** past participle when the verb is an auxiliary (passé composé) */ participle?: string; clitics?: string; rest?: string; word: FrNeg }
/** French ne … pas / jamais / rien / plus / personne around the conjugated verb (or the auxiliary). "pas de" turns un/une/des/du into de/d'. */
export function frNegate(o: FrNegOpts): Built {
  const ne = startsVowel(o.clitics ?? o.verb) ? "n'" : "ne ";
  const front = `${o.subject} ${ne}${o.clitics ? o.clitics + " " : ""}${o.verb}`;
  const rest = o.rest ?? "";
  if (o.word === "pas de") return built(`${front} ${startsVowel(rest) ? "pas d'" : "pas de "}${rest}`);
  if (o.participle) return built(`${front} ${o.word === "personne" ? `${o.participle} personne` : `${o.word} ${o.participle}`}${rest ? " " + rest : ""}`); // personne follows the participle
  return built(`${front} ${o.word}${rest ? " " + rest : ""}`);
}
/** German nicht: [subject] [verb] [definite objects…] nicht [predicate / place / prefix / participle / infinitive]. */
export function deNicht(subject: string, verb: string, middle: string, tail: string): Built {
  return built([subject, verb, middle, "nicht", tail].filter(Boolean).join(" "));
}
/** kein replaces ein-/no article + noun: "einen Hund" → "keinen Hund"; plural without article → "keine Hunde". */
export function deKeinPhrase(c: DeCase, g: DeG, noun: string, plural?: string): string {
  const n = g === "pl" ? (c === "dat" ? deDativePlural(plural ?? noun) : plural ?? noun) : noun;
  return `${deDeterminer("negative", c, g)} ${n}`;
}

// ══════════════════════════ QUESTIONS ══════════════════════════
export const FR_INTERROGATIVES = ["où", "quand", "comment", "pourquoi", "combien", "qui", "que", "avec qui", "à quelle heure"];
export type FrQStyle = "estce" | "inversion" | "intonation";
export interface FrQ { subject: "je" | "tu" | "il" | "elle" | "on" | "nous" | "vous" | "ils" | "elles"; verb: string; rest?: string; word?: string; /** noun subject for complex inversion: "Marie parle-t-elle ?" */ noun?: string }
const frSub = (s: string, verb: string) => (s === "je" && startsVowel(verb) ? "j'" : s + " ");
/** One French question. Returns null when that style is not natural (inversion with "je" and an -e verb, e.g. *parlé-je*). */
export function frQuestion(q: FrQ, style: FrQStyle): string | null {
  const rest = q.rest ? " " + q.rest : "", w = q.word, sub = q.subject;
  const subj = q.noun ? q.noun + " " : frSub(sub, q.verb);
  if (style === "intonation") return w === "que" ? null : cap(`${subj}${q.verb}${rest}${w ? " " + w : ""} ?`);
  if (style === "estce") {
    const head = w === "que" ? "qu'est-ce que" : w ? `${w} est-ce que` : "est-ce que";
    const next = q.noun ?? sub;
    const glued = startsVowel(next) ? head.replace(/que$/, "qu'") : head + " ";
    return cap(`${glued}${subj}${q.verb}${rest} ?`);
  }
  if (sub === "je" && /e$/.test(q.verb)) return null;
  const t = /^(il|elle|on)$/.test(sub) && /[aec]$/.test(q.verb) ? "-t" : "";
  const inv = `${q.verb}${t}-${sub}`;
  if (w === "que") return cap(`${startsVowel(q.verb) ? "qu'" : "que "}${inv}${rest} ?`);
  return cap(`${w ? w + " " : ""}${q.noun ? q.noun + " " : ""}${inv}${rest} ?`);
}
/** All three styles at once; primary = the requested style (default est-ce que), others as accepted alternatives. */
export function frQuestions(q: FrQ, primary: FrQStyle = "estce"): Built {
  const order: FrQStyle[] = [primary, ...(["estce", "inversion", "intonation"] as FrQStyle[]).filter((s) => s !== primary)];
  const all = order.map((s) => frQuestion(q, s)).filter((x): x is string => !!x);
  return built(all[0]!, all.slice(1));
}
export const ES_INTERROGATIVES = ["qué", "quién", "cuál", "cuándo", "cuánto", "dónde", "adónde", "cómo", "por qué"];
/** ¿Dónde vives? / ¿Hablas español? — with inverted marks and the written accent on the question word. */
export function esQuestion(o: { word?: string; verb: string; subject?: string; rest?: string }): string {
  const parts = [o.word, o.verb, o.subject, o.rest].filter(Boolean).join(" ");
  return `¿${cap(parts)}?`;
}
export const esCuanto = (g: G2, n: Num) => "cuánt" + (g === "m" ? "o" : "a") + (n === "pl" ? "s" : "");
export const DE_INTERROGATIVES = ["wer", "was", "wo", "wohin", "woher", "wann", "warum", "wie", "wie viele", "welcher"];
/** Verb-second: "Wo wohnst du?"; yes/no questions put the verb first: "Wohnst du in Berlin?" */
export function deQuestion(o: { word?: string; verb: string; subject: string; rest?: string }): string {
  return cap([o.word, o.verb, o.subject, o.rest].filter(Boolean).join(" ")) + "?";
}
