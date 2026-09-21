// X5: verified pictures for French / Spanish / German (KS2-KS4). Registered in library.ts (one line). Every picture is a GENERIC, standard-grammar
// diagram (a verb's present-tense table, article/pronoun/adjective tables, sentence frames with neutral example words, question-word cards,
// clocks, calendars, numerals, colour swatches, flags): it names its subject exactly and cannot contradict a slide that names the same thing.
// Every foreign-language string below was written from standard grammar AND cross-checked against Oak's own lesson text by
// `npx tsx src/oak/factory/art/cli.ts langcheck` (forms that Oak's text never contains are listed for a manual second read).
//
// Matching stays exact (select.ts): whole-word / whole-phrase `concepts`, `subjects`, `requires`, `avoid` (also vetoes on the lesson/unit
// title), and pictures never appear on question slides. A tense other than the one drawn vetoes the picture (a "present tense" table is never
// shown on an imperfect-tense lesson etc.). In `avoid`, a leading "=" means WHOLE WORD; anything else is a word-start prefix (so short foreign
// words are always written "=wo", "=und", "=was" ... to avoid vetoing on "word", "understand", "washing").
import type { Pic } from "./types";
import { svg, ln, rect, cap as capRaw, esc, n, circ, dot, pt } from "./helpers";
const cap = (t: string, y = 164, _max = 38) => capRaw(t, y, 38);

const W = 240, H = 170;
const FR: Pic["subjects"] = ["French"], ES: Pic["subjects"] = ["Spanish"], DE: Pic["subjects"] = ["German"];
type Lang = "fr" | "es" | "de";
const LANGSUBJ: Record<Lang, Pic["subjects"]> = { fr: FR, es: ES, de: DE };
const LANGNAME: Record<Lang, string> = { fr: "French", es: "Spanish", de: "German" };
const LANGS: Lang[] = ["fr", "es", "de"];
/** "=word" whole-word vetoes from a space separated list */
const WW = (s: string) => s.split(" ").filter(Boolean).map((x) => `=${x}`);

type Seg = [string, string?];
type Cell = string | Seg[];
const spans = (c: Cell) => (typeof c === "string" ? esc(c) : c.map(([s, k]) => (k ? `<tspan class="${k}">${esc(s)}</tspan>` : esc(s))).join(""));
/** text with optional coloured segments. align: l | m | r. cls: tb big, ts small, tx smaller, tm muted */
const T = (x: number, y: number, c: Cell, align: "l" | "m" | "r" = "m", cls = "") => `<text x="${n(x)}" y="${n(y)}" class="t ${align === "l" ? "tl" : align === "r" ? "te" : ""} ${cls}">${spans(c)}</text>`;

// ── generic table ─────────────────────────────────────────────────────────────
interface Col { x: number; align: "l" | "m" | "r"; cls?: string }
function table(cols: Col[], head: Cell[] | null, rows: Cell[][], y0: number, dy: number, x0 = 6, x1 = 234): string {
  let s = "", y = y0;
  if (head) { head.forEach((h, i) => { s += T(cols[i].x, y, h, cols[i].align, "tx tm"); }); s += ln(x0, y + 4.5, x1, y + 4.5, "th"); y += dy; }
  rows.forEach((r, k) => { r.forEach((c, i) => { s += T(cols[i].x, y, c, cols[i].align, cols[i].cls ?? ""); }); if (k < rows.length - 1) s += ln(x0, y + 5, x1, y + 5, "th"); y += dy; });
  return s;
}

// ── verb tables (pronoun | form) ───────────────────────────────────────────────
const PRON: Record<Lang, string[]> = {
  fr: ["je", "tu", "il / elle / on", "nous", "vous", "ils / elles"],
  es: ["yo", "tú", "él / ella / usted", "nosotros / nosotras", "vosotros / vosotras", "ellos / ellas / ustedes"],
  de: ["ich", "du", "er / sie / es", "wir", "ihr", "sie / Sie"],
};
function conjBody(lang: Lang, title: string, sub: string, forms: (Seg[] | string)[], caption: string, opts: { elide?: boolean } = {}): string {
  const P = PRON[lang];
  let s = T(120, 18, title, "m", "tb") + T(120, 33, sub, "m", "ts tm") + ln(120, opts.elide ? 63 : 40, 120, 150, "th");
  forms.forEach((f, i) => {
    const y = 56 + i * 18;
    const tight = i === 0 && opts.elide;
    s += T(tight ? 122 : 114, y, tight ? "j’" : P[i], "r", (P[i].length > 14 ? "tx" : "ts") + " tm");
    s += T(tight ? 122 : 126, y, f, "l");
    if (i < 5) s += ln(6, y + 5.5, 234, y + 5.5, "th");
  });
  return s + cap(caption, 165, 44);
}
const reg = (stem: string, ends: string[]): Seg[][] => ends.map((e) => [[stem], [e, "tr"]] as Seg[]);

interface Mk { id: string; title: string; alt: string; caption: string; subjects: Pic["subjects"]; concepts: string[]; body: string; evidence: string; avoid?: string[]; requires?: string[]; doesNotShow?: string; family?: string; numeric?: boolean }
const mk = (o: Mk): Pic => ({ id: o.id, title: o.title, alt: o.alt, caption: o.caption, subjects: o.subjects, concepts: o.concepts, ...(o.avoid ? { avoid: o.avoid } : {}), ...(o.requires ? { requires: o.requires } : {}), ...(o.family ? { family: o.family } : {}), ...(o.numeric ? { numeric: true } : {}), doesNotShow: o.doesNotShow ?? "any other verb, tense or exception; usage rules; translations of whole sentences", evidence: o.evidence, svg: svg(W, H, o.body) });

/** vetoes for a picture that shows only the PRESENT tense: any other tense named in the slide (or lesson/unit title) vetoes it */
const NOT_PRESENT = ["perfect", "imperfect", "preterit", "=past", "participle", "future", "conditional", "subjunctive", "would", "used to", "passé", "imparfait", "pretérito", "pasado", "perfekt", "imperfekt", "präteritum", "futur", "futuro", "condicional", "konjunktiv", "yesterday", "last year", "last summer", "last week", "historical", "gerund", "imperative", "imperativo", "imperativ", "command"];
const ID = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z]+/g, "-");

// ─── high-frequency verbs: present indicative (standard grammar) ───
interface V { lang: Lang; inf: string; en: string; forms: string[]; elide?: boolean; avoid?: string[]; concepts?: string[] }
const VERBS: V[] = [
  { lang: "fr", inf: "être", en: "to be", forms: ["suis", "es", "est", "sommes", "êtes", "sont"] },
  { lang: "fr", inf: "avoir", en: "to have", forms: ["ai", "as", "a", "avons", "avez", "ont"], elide: true },
  { lang: "fr", inf: "aller", en: "to go", forms: ["vais", "vas", "va", "allons", "allez", "vont"], avoid: ["infinitive", "near future"] },
  { lang: "fr", inf: "faire", en: "to do / to make", forms: ["fais", "fais", "fait", "faisons", "faites", "font"] },
  { lang: "fr", inf: "vouloir", en: "to want", forms: ["veux", "veux", "veut", "voulons", "voulez", "veulent"] },
  { lang: "fr", inf: "pouvoir", en: "to be able to / can", forms: ["peux", "peux", "peut", "pouvons", "pouvez", "peuvent"] },
  { lang: "fr", inf: "devoir", en: "to have to / must", forms: ["dois", "dois", "doit", "devons", "devez", "doivent"], avoid: ["=devoirs", "homework"] },
  { lang: "fr", inf: "prendre", en: "to take", forms: ["prends", "prends", "prend", "prenons", "prenez", "prennent"] },
  { lang: "fr", inf: "boire", en: "to drink", forms: ["bois", "bois", "boit", "buvons", "buvez", "boivent"] },
  { lang: "fr", inf: "dire", en: "to say", forms: ["dis", "dis", "dit", "disons", "dites", "disent"] },
  { lang: "fr", inf: "venir", en: "to come", forms: ["viens", "viens", "vient", "venons", "venez", "viennent"] },
  { lang: "fr", inf: "voir", en: "to see", forms: ["vois", "vois", "voit", "voyons", "voyez", "voient"] },
  { lang: "fr", inf: "savoir", en: "to know (a fact)", forms: ["sais", "sais", "sait", "savons", "savez", "savent"] },
  { lang: "fr", inf: "lire", en: "to read", forms: ["lis", "lis", "lit", "lisons", "lisez", "lisent"] },
  { lang: "fr", inf: "écrire", en: "to write", forms: ["écris", "écris", "écrit", "écrivons", "écrivez", "écrivent"], elide: true },
  { lang: "fr", inf: "sortir", en: "to go out", forms: ["sors", "sors", "sort", "sortons", "sortez", "sortent"] },
  { lang: "fr", inf: "partir", en: "to leave", forms: ["pars", "pars", "part", "partons", "partez", "partent"] },
  { lang: "es", inf: "ser", en: "to be (traits)", forms: ["soy", "eres", "es", "somos", "sois", "son"], concepts: ["ser", "soy", "eres", "somos", "sois"] },
  { lang: "es", inf: "estar", en: "to be (location, states)", forms: ["estoy", "estás", "está", "estamos", "estáis", "están"], concepts: ["estar", "estoy", "estás", "está", "estamos", "estáis", "están"], avoid: ["continuous"] },
  { lang: "es", inf: "tener", en: "to have", forms: ["tengo", "tienes", "tiene", "tenemos", "tenéis", "tienen"], concepts: ["tener", "tengo", "tienes", "tiene", "tenemos", "tenéis", "tienen"], avoid: ["tener que"] },
  { lang: "es", inf: "ir", en: "to go", forms: ["voy", "vas", "va", "vamos", "vais", "van"], concepts: ["ir", "voy", "vamos", "vais"], avoid: ["ir a", "voy a", "vas a", "vamos a", "vais a", "infinitive", "infinitivo"] },
  { lang: "es", inf: "hacer", en: "to do / to make", forms: ["hago", "haces", "hace", "hacemos", "hacéis", "hacen"], concepts: ["hacer", "hago", "haces", "hace", "hacemos", "hacéis", "hacen"], avoid: ["weather", "clima", "=ago"] },
  { lang: "es", inf: "querer", en: "to want", forms: ["quiero", "quieres", "quiere", "queremos", "queréis", "quieren"], concepts: ["querer", "quiero", "quieres", "quiere", "queremos", "queréis", "quieren"] },
  { lang: "es", inf: "poder", en: "to be able to / can", forms: ["puedo", "puedes", "puede", "podemos", "podéis", "pueden"], concepts: ["poder", "puedo", "puedes", "puede", "podemos", "podéis", "pueden"] },
  { lang: "es", inf: "dar", en: "to give", forms: ["doy", "das", "da", "damos", "dais", "dan"], concepts: ["dar"], avoid: ["idiomatic"] },
  { lang: "de", inf: "sein", en: "to be", forms: ["bin", "bist", "ist", "sind", "seid", "sind"], avoid: ["possessive", ...WW("mein dein unser euer his")] },
  { lang: "de", inf: "haben", en: "to have", forms: ["habe", "hast", "hat", "haben", "habt", "haben"], avoid: ["auxiliary", "hilfsverb"] },
  { lang: "de", inf: "werden", en: "to become", forms: ["werde", "wirst", "wird", "werden", "werdet", "werden"] },
  { lang: "de", inf: "können", en: "to be able to / can", forms: ["kann", "kannst", "kann", "können", "könnt", "können"] },
  { lang: "de", inf: "müssen", en: "to have to / must", forms: ["muss", "musst", "muss", "müssen", "müsst", "müssen"] },
  { lang: "de", inf: "wollen", en: "to want", forms: ["will", "willst", "will", "wollen", "wollt", "wollen"] },
  { lang: "de", inf: "dürfen", en: "to be allowed to / may", forms: ["darf", "darfst", "darf", "dürfen", "dürft", "dürfen"] },
  { lang: "de", inf: "sollen", en: "to be supposed to / should", forms: ["soll", "sollst", "soll", "sollen", "sollt", "sollen"] },
  { lang: "de", inf: "mögen", en: "to like", forms: ["mag", "magst", "mag", "mögen", "mögt", "mögen"] },
  { lang: "de", inf: "gehen", en: "to go", forms: ["gehe", "gehst", "geht", "gehen", "geht", "gehen"] },
  { lang: "de", inf: "sehen", en: "to see", forms: ["sehe", "siehst", "sieht", "sehen", "seht", "sehen"] },
  { lang: "de", inf: "essen", en: "to eat", forms: ["esse", "isst", "isst", "essen", "esst", "essen"] },
  { lang: "de", inf: "lesen", en: "to read", forms: ["lese", "liest", "liest", "lesen", "lest", "lesen"] },
  { lang: "de", inf: "fahren", en: "to travel / to drive", forms: ["fahre", "fährst", "fährt", "fahren", "fahrt", "fahren"] },
];
export const VERB_TABLES: Pic[] = VERBS.map((v) => {
  const name = LANGNAME[v.lang];
  const persons = v.forms.map((f, i) => (i === 0 && v.elide ? `j’${f}` : `${PRON[v.lang][i]} ${f}`)).join(", ");
  return mk({
    id: `${v.lang}-verb-${ID(v.inf)}`, title: `${name} verb ${v.inf} (present tense)`,
    alt: `The present tense of the ${name} verb ${v.inf}, ${v.en}: ${persons}.`,
    caption: `${v.inf} (${v.en}): present tense`, subjects: LANGSUBJ[v.lang], concepts: v.concepts ?? [v.inf],
    avoid: [...NOT_PRESENT, ...(v.avoid ?? [])],
    body: conjBody(v.lang, v.inf, `${v.en} · present tense`, v.forms, `the present tense of ${v.inf}`, { elide: v.elide }),
    evidence: `Standard ${name} grammar: present indicative of ${v.inf} (${persons}). Forms cross-checked against Oak's lesson text (art/cli.ts langcheck). Shown only when the verb is named and no other tense is.`,
  });
});

// ─── regular verbs (endings highlighted) ─────────────────────────────────────
interface RV { id: string; lang: Lang; title: string; concepts: string[]; stem: string; ends: string[]; example: string; en: string; avoid: string[]; requires?: string[] }
const REG: RV[] = [
  { id: "fr-regular-er", lang: "fr", title: "French regular -er verbs (present tense)", concepts: ["er verb", "regular er verb"], stem: "parl", ends: ["e", "es", "e", "ons", "ez", "ent"], example: "parler", en: "to speak", avoid: ["stem chang", "irregular", "spelling chang", "ending in", "=manger", "=commencer", "=acheter", "=appeler", "=jeter", "=préférer", "=payer", "=envoyer", "-ger", "-cer"] },
  { id: "es-regular-ar", lang: "es", title: "Spanish regular -ar verbs (present tense)", concepts: ["ar verb", "regular ar verb"], stem: "habl", ends: ["o", "as", "a", "amos", "áis", "an"], example: "hablar", en: "to speak", avoid: ["stem chang", "irregular", "radical", "-car", "-gar", "-zar", "er ir", "ar er", "er ar", "ir er", "er verb", "ir verb", "=jugar", "=pensar", "=empezar", "=contar", "=dar", "=estar"] },
  { id: "es-regular-er", lang: "es", title: "Spanish regular -er verbs (present tense)", concepts: ["er verb", "regular er verb"], stem: "com", ends: ["o", "es", "e", "emos", "éis", "en"], example: "comer", en: "to eat", avoid: ["stem chang", "irregular", "radical", "er ir", "ar er", "er ar", "ir er", "ir verb", "ar verb", "=ser", "=tener", "=hacer", "=poner"] },
  { id: "es-regular-ir", lang: "es", title: "Spanish regular -ir verbs (present tense)", concepts: ["ir verb", "regular ir verb"], stem: "viv", ends: ["o", "es", "e", "imos", "ís", "en"], example: "vivir", en: "to live", avoid: ["stem chang", "irregular", "radical", "er ir", "ir er", "ar er", "er verb", "ar verb", "=ir", "=decir", "=venir", "=salir", "=dormir"] },
  { id: "de-regular-weak", lang: "de", title: "German weak (regular) verbs (present tense)", concepts: ["weak verb"], stem: "mach", ends: ["e", "st", "t", "en", "t", "en"], example: "machen", en: "to do / to make", avoid: ["strong", "irregular", "separable", "modal", "stem chang", "vowel chang"] },
];
export const REGULAR_VERBS: Pic[] = REG.map((r) => {
  const persons = r.ends.map((e, i) => `${PRON[r.lang][i]} ${r.stem}${e}`).join(", ");
  return mk({
    id: r.id, title: r.title,
    alt: `The ${LANGNAME[r.lang]} present tense of ${r.example} (${r.en}) with the ending of each person highlighted: ${persons}.`,
    caption: `${r.example} (${r.en}): stem + a different ending for each person`, subjects: LANGSUBJ[r.lang], concepts: r.concepts, avoid: [...NOT_PRESENT, ...r.avoid], ...(r.requires ? { requires: r.requires } : {}),
    body: conjBody(r.lang, r.example, `${r.en} · present tense`, reg(r.stem, r.ends), `regular verbs: stem (${r.stem}-) + ending`),
    doesNotShow: "irregular verbs, stem-changing or spelling-change verbs, other tenses",
    evidence: `Standard ${LANGNAME[r.lang]} grammar: regular present tense = stem ${r.stem}- plus ${r.ends.join(", ")}. Example verb ${r.example}. Oak keyword lists define these verb groups; forms cross-checked in Oak text.`,
  });
});

// ─── other tenses of the regular model verb ────────────────────────────────
interface TT { id: string; lang: Lang; title: string; concepts: string[]; avoid: string[]; stem: string; ends: string[]; example: string; en: string; sub: string; note: string; ev: string }
const TENSES: TT[] = [
  { id: "fr-imperfect", lang: "fr", title: "French imperfect tense (model verb)", concepts: ["imperfect tense", "imperfect", "imparfait"], avoid: ["perfect", "present tense", "future", "conditional", "irregular", "modal"], stem: "parl", ends: ["ais", "ais", "ait", "ions", "iez", "aient"], example: "parler", en: "to speak", sub: "imperfect tense · regular verb", note: "imperfect: stem + these endings", ev: "French imparfait: nous-form stem minus -ons + -ais, -ais, -ait, -ions, -iez, -aient (parler → parlais...). Oak keyword 'imperfect tense'." },
  { id: "fr-simple-future", lang: "fr", title: "French simple future (model verb)", concepts: ["simple future", "future tense", "futur simple"], avoid: ["=aller", "near future", "perfect", "imperfect", "conditional", "irregular", "present tense", "=past", "immediate"], stem: "parler", ends: ["ai", "as", "a", "ons", "ez", "ont"], example: "parler", en: "to speak", sub: "simple future · regular verb", note: "simple future: stem + these endings", ev: "French futur simple: infinitive + -ai, -as, -a, -ons, -ez, -ont (parler → parlerai...). Oak keyword 'simple future | French 1-verb future tense meaning will + verb'." },
  { id: "fr-conditional", lang: "fr", title: "French conditional (model verb)", concepts: ["conditional", "conditionnel"], avoid: ["perfect", "imperfect", "future", "irregular", "past conditional", "si clause", "if clause", "present tense"], stem: "parler", ends: ["ais", "ais", "ait", "ions", "iez", "aient"], example: "parler", en: "to speak", sub: "conditional · regular verb", note: "conditional: stem + these endings", ev: "French conditionnel présent: infinitive + -ais, -ais, -ait, -ions, -iez, -aient (parler → parlerais...). Oak keyword 'conditional | grammar structure expressing what you would do'." },
  { id: "es-future", lang: "es", title: "Spanish simple future (model verb)", concepts: ["inflectional future", "simple future", "future tense"], avoid: ["ir a", "irregular", "perfect", "imperfect", "preterite", "conditional", "present tense", "periphrastic", "near future"], stem: "hablar", ends: ["é", "ás", "á", "emos", "éis", "án"], example: "hablar", en: "to speak", sub: "simple future · regular verb", note: "simple future: stem + these endings", ev: "Spanish futuro simple: infinitive + -é, -ás, -á, -emos, -éis, -án (hablar → hablaré...). Oak keyword 'inflectional future | 1-verb structure used to say what will happen in the future'." },
  { id: "es-conditional", lang: "es", title: "Spanish conditional (model verb)", concepts: ["conditional", "condicional"], avoid: ["perfect", "imperfect", "preterite", "future", "irregular", "si clause", "if clause", "present tense", "subjunctive"], stem: "hablar", ends: ["ía", "ías", "ía", "íamos", "íais", "ían"], example: "hablar", en: "to speak", sub: "conditional · regular verb", note: "conditional: stem + these endings", ev: "Spanish condicional simple: infinitive + -ía, -ías, -ía, -íamos, -íais, -ían (hablar → hablaría...). Oak keyword 'conditional'." },
  { id: "de-imperfect", lang: "de", title: "German imperfect (Präteritum) of a weak verb", concepts: ["imperfect", "imperfect tense", "imperfekt", "präteritum"], avoid: ["strong", "irregular", "modal", "perfect", "present tense", "future", "=haben", "=sein", "=werden", "=können", "=müssen", "=wollen", "=sollen", "=dürfen", "möchte", "=mögen", "es gab", "es gibt"], stem: "spiel", ends: ["te", "test", "te", "ten", "tet", "ten"], example: "spielen", en: "to play", sub: "imperfect (Präteritum) · weak verbs", note: "weak verbs: stem + -te endings", ev: "German Präteritum of weak verbs: stem + -te, -test, -te, -ten, -tet, -ten (spielen → spielte...). Oak keyword 'imperfect | German single-word past tense used mainly to narrate past events in writing'." },
];
export const TENSE_TABLES: Pic[] = TENSES.map((t) => {
  const persons = t.ends.map((e, i) => `${PRON[t.lang][i]} ${t.stem}${e}`).join(", ");
  return mk({
    id: t.id, title: t.title,
    alt: `The ${LANGNAME[t.lang]} ${t.sub} of the model verb ${t.example} (${t.en}), with the endings highlighted: ${persons}.`,
    caption: t.note, subjects: LANGSUBJ[t.lang], concepts: t.concepts, avoid: t.avoid,
    body: conjBody(t.lang, t.example, `${t.en} · ${t.sub}`, reg(t.stem, t.ends), t.note),
    doesNotShow: "irregular stems, other verbs, other tenses, when to use the tense",
    evidence: `${t.ev} Model verb only (regular).`,
  });
});
// Spanish preterite and imperfect: two columns (-ar | -er / -ir)
function conj2(title: string, sub: string, heads: [string, string], a: string[], b: string[], stemA: string, stemB: string, caption: string): string {
  const P = ["yo", "tú", "él / ella", "nosotros", "vosotros", "ellos / ellas"];
  let s = T(120, 17, title, "m", "tb") + T(120, 31, sub, "m", "ts tm") + T(96, 47, heads[0], "l", "ts tm") + T(168, 47, heads[1], "l", "ts tm") + ln(6, 51, 234, 51, "th") + ln(92, 40, 92, 152, "th") + ln(164, 40, 164, 152, "th");
  P.forEach((p, i) => { const y = 66 + i * 17; s += T(86, y, p, "r", "ts tm") + T(98, y, [[stemA], [a[i], "tr"]], "l", "ts") + T(170, y, [[stemB], [b[i], "tr"]], "l", "ts"); if (i < 5) s += ln(6, y + 5, 234, y + 5, "th"); });
  return s + cap(caption, 166, 46);
}
const TWOCOL: Pic[] = [
  mk({ id: "es-preterite", title: "Spanish preterite of regular verbs", alt: "The Spanish preterite of regular verbs. -ar verbs (hablar): hablé, hablaste, habló, hablamos, hablasteis, hablaron. -er and -ir verbs (comer, vivir): comí, comiste, comió, comimos, comisteis, comieron. Endings are highlighted.", caption: "preterite: regular -ar and -er / -ir verbs", subjects: ES,
    concepts: ["preterite", "preterite tense", "pretérito"], avoid: ["irregular", "imperfect", "present tense", "future", "perfect tense", "-car", "-gar", "-zar", "stem chang", "=ser", "=ir", "=dar", "=hacer", "=tener", "=estar", "=poder", "=querer", "=decir", "=ver", "=venir", "=saber", "=poner", "=fui", "=fuiste", "=fue", "=fuimos", "=fueron", "=hice", "=hiciste", "=hizo", "=hicimos", "=hicieron", "=tuve", "=tuviste", "=tuvo", "=tuvimos", "=tuvieron", "=estuve", "=estuvo", "=dio", "=di", "=vi", "=vio", "=pude", "=pudo", "=puse", "=puso", "=dije", "=dijo", "=quise", "=quiso", "=supe", "=vine", "=vino", "=traje", "=trajo", "=era", "=eras", "=éramos", "=iba", "=ibas", "=veía", "conditional", "continuous", "interruption", ], requires: ["ar verb", "er verb", "ir verb", "regular", "ar er ir"], doesNotShow: "irregular preterites, spelling changes (-car, -gar, -zar), when to use the preterite or the imperfect",
    body: conj2("preterite", "regular verbs · the ending changes", ["hablar", "comer / vivir"], ["é", "aste", "ó", "amos", "asteis", "aron"], ["í", "iste", "ió", "imos", "isteis", "ieron"], "habl", "com", "regular preterite endings"),
    evidence: "Spanish pretérito indefinido, regular: -ar: -é, -aste, -ó, -amos, -asteis, -aron (hablar); -er/-ir: -í, -iste, -ió, -imos, -isteis, -ieron (comer, vivir). Oak keyword 'preterite | verb tense used to talk about something completed in the past'." }),
  mk({ id: "es-imperfect", title: "Spanish imperfect of regular verbs", alt: "The Spanish imperfect of regular verbs. -ar verbs (hablar): hablaba, hablabas, hablaba, hablábamos, hablabais, hablaban. -er and -ir verbs (comer, vivir): comía, comías, comía, comíamos, comíais, comían. Endings are highlighted.", caption: "imperfect: regular -ar and -er / -ir verbs", subjects: ES,
    concepts: ["imperfect tense", "imperfect", "imperfecto"], avoid: ["preterite", "irregular", "present tense", "future", "perfect tense", "continuous", "=ser", "=ir", "=ver", "=fui", "=fuiste", "=fue", "=fuimos", "=fueron", "=hice", "=hiciste", "=hizo", "=hicimos", "=hicieron", "=tuve", "=tuviste", "=tuvo", "=tuvimos", "=tuvieron", "=estuve", "=estuvo", "=dio", "=di", "=vi", "=vio", "=pude", "=pudo", "=puse", "=puso", "=dije", "=dijo", "=quise", "=quiso", "=supe", "=vine", "=vino", "=traje", "=trajo", "=era", "=eras", "=éramos", "=iba", "=ibas", "=veía", "conditional", "interruption"], requires: ["ar verb", "er verb", "ir verb", "regular", "ar er ir"], doesNotShow: "irregular imperfects (ser, ir, ver), the imperfect continuous, when to use the imperfect or the preterite",
    body: conj2("imperfect", "regular verbs · the ending changes", ["hablar", "comer / vivir"], ["aba", "abas", "aba", "ábamos", "abais", "aban"], ["ía", "ías", "ía", "íamos", "íais", "ían"], "habl", "com", "regular imperfect endings"),
    evidence: "Spanish pretérito imperfecto, regular: -ar: -aba, -abas, -aba, -ábamos, -abais, -aban (hablar); -er/-ir: -ía, -ías, -ía, -íamos, -íais, -ían (comer, vivir). Oak keyword 'imperfect tense | tense used to describe how things were or used to be in the past'." }),
];

// ── sentence frames (chips) ─────────────────────────────────────────────────
interface Chip { t: string; k?: "v" | "n" | "a" | "p" | "x" } // v verb (green) n neutral a accent (blue) p gold x red
const CHIPCLS: Record<string, string> = { v: "l f2", n: "l f6", a: "l f1", p: "l f3", x: "l f4" };
const chipW = (c: Chip) => Math.max(22, c.t.length * 6.3 + 12);
/** greedy wrap of chips into rows of at most maxW */
function chipRows(items: Chip[], maxW = 226): Chip[][] {
  const rows: Chip[][] = [[]]; let w = 0;
  for (const c of items) { const cw = chipW(c) + 4; if (w + cw - 4 > maxW && rows[rows.length - 1].length) { rows.push([]); w = 0; } rows[rows.length - 1].push(c); w += cw; }
  return rows;
}
function chipsSvg(rows: Chip[][], y: number): string {
  let s = "";
  rows.forEach((r, i) => { const total = r.reduce((a, c) => a + chipW(c) + 4, -4); let x = 120 - total / 2; r.forEach((c) => { const w = chipW(c); s += rect(x, y + i * 24, w, 22, CHIPCLS[c.k ?? "n"], 5) + T(x + w / 2, y + i * 24 + 15, c.t, "m", "ts"); x += w + 4; }); });
  return s;
}
/** a frame: title + blocks (optional label + wrapped chips). Fails at load time if it does not fit the 170-high canvas. */
function frame(id: string, title: string, blocks: { label?: string; chips: Chip[] }[], caption: string): string {
  let s = T(120, 16, title, "m", "tb"), y = 28;
  for (const b of blocks) {
    if (b.label) { s += T(120, y + 8, b.label, "m", "ts tm"); y += 12; }
    const rows = chipRows(b.chips); s += chipsSvg(rows, y); y += rows.length * 24 + 6;
  }
  if (y > 156) throw new Error(`frame ${id} too tall (${y})`);
  if (caption.length > 38 && y > 149) throw new Error(`frame ${id}: a two-line caption would overlap the last row (${y})`);
  return s + cap(caption, 165, 44);
}
const FRAMES: Pic[] = [];
const F = (o: Omit<Mk, "body"> & { blocks: { label?: string; chips: Chip[] }[]; head: string; foot: string }) => FRAMES.push(mk({ ...o, body: frame(o.id, o.head, o.blocks, o.foot) }));

F({ id: "fr-negation", title: "French negation ne … pas", alt: "French negation: the verb sits between ne and pas. Je ne mange pas (I do not eat). Je n'aime pas (I do not like). Other negatives follow the same pattern, for example ne … jamais.", caption: "ne … pas: the verb goes between ne and pas", subjects: FR,
  concepts: ["negation", "ne pas", "ne … pas"], avoid: ["ne que", "ne ni", "ne personne", "ne plus", "ne rien", "ne jamais", "pas de", "il ny a pas", "imperative", "infinitive", "quantity", "=jamais", "=rien", "=personne", "=que"], doesNotShow: "negation with pas de, ne … que, ne … ni … ni, negative infinitives or imperatives",
  head: "ne … pas", foot: "the verb goes between ne and pas", blocks: [{ label: "je + verb", chips: [{ t: "Je" }, { t: "ne", k: "x" }, { t: "mange", k: "v" }, { t: "pas", k: "x" }] }, { label: "before a vowel: ne → n’", chips: [{ t: "Je" }, { t: "n’", k: "x" }, { t: "aime", k: "v" }, { t: "pas", k: "x" }] }, { label: "other negatives follow the same pattern", chips: [{ t: "Je" }, { t: "ne", k: "x" }, { t: "mange", k: "v" }, { t: "jamais", k: "x" }] }],
  evidence: "French négation: ne + conjugated verb + pas (ne → n' before a vowel); ne … jamais follows the same frame (Oak keyword 'negation | two elements e.g. ne ... pas around the main verb'). Example verbs manger, aimer." });
F({ id: "es-negation", title: "Spanish negation with no", alt: "Spanish negation: put no directly before the verb. Hablo inglés (I speak English) becomes No hablo inglés (I do not speak English).", caption: "no goes directly before the verb", subjects: ES,
  concepts: ["negation"], avoid: ["nunca", "nada", "nadie", "ningún", "ninguno", "tampoco", "imperative", "question", "pronoun"], doesNotShow: "double negatives (no … nunca), negative imperatives",
  head: "no + verb", foot: "add no directly before the verb", blocks: [{ label: "affirmative", chips: [{ t: "Hablo", k: "v" }, { t: "inglés" }] }, { label: "negative: no goes before the verb", chips: [{ t: "No", k: "x" }, { t: "hablo", k: "v" }, { t: "inglés" }] }],
  evidence: "Spanish negation: no + verb (No hablo inglés). Oak Spanish KS3 'negation with no'." });
F({ id: "fr-near-future", title: "French near future: aller + infinitive", alt: "French near future: a present-tense form of aller followed by an infinitive. Je vais jouer (I am going to play). Nous allons manger (we are going to eat).", caption: "aller (present) + infinitive", subjects: FR,
  concepts: ["aller infinitive", "aller + infinitive", "near future", "futur proche"], avoid: ["simple future", "perfect", "imperfect", "conditional", "past"], doesNotShow: "the simple future (je jouerai) or other uses of aller",
  head: "aller + infinitive", foot: "aller changes; the second verb stays in the infinitive", blocks: [{ label: "je vais + infinitive", chips: [{ t: "Je" }, { t: "vais", k: "v" }, { t: "jouer", k: "a" }] }, { label: "nous allons + infinitive", chips: [{ t: "Nous" }, { t: "allons", k: "v" }, { t: "manger", k: "a" }] }],
  evidence: "French futur proche: present tense of aller + infinitive (je vais jouer, nous allons manger). Oak keyword 'aller + infinitive | 2-verb future structure meaning going to + infinitive'." });
F({ id: "es-near-future", title: "Spanish ir a + infinitive", alt: "Spanish near future: a present-tense form of ir, then a, then an infinitive. Voy a jugar (I am going to play). Vamos a comer (we are going to eat).", caption: "ir (present) + a + infinitive", subjects: ES,
  concepts: ["ir a infinitive", "ir + a + infinitive", "ir a"], avoid: ["preterite", "imperfect", "perfect", "conditional", "inflectional future", "simple future", "past"], doesNotShow: "the simple future (jugaré) or other uses of ir",
  head: "ir + a + infinitive", foot: "ir changes; then a; the second verb stays in the infinitive", blocks: [{ label: "voy a + infinitive", chips: [{ t: "Voy", k: "v" }, { t: "a", k: "x" }, { t: "jugar", k: "a" }] }, { label: "vamos a + infinitive", chips: [{ t: "Vamos", k: "v" }, { t: "a", k: "x" }, { t: "comer", k: "a" }] }],
  evidence: "Spanish futuro próximo: present tense of ir + a + infinitive (voy a jugar, vamos a comer). Oak keyword 'ir + a + infinitive | 2-verb structure meaning going to + infinitive'." });
F({ id: "de-future-werden", title: "German future with werden", alt: "German future: a present-tense form of werden in second position and the infinitive at the end of the sentence. Ich werde Fußball spielen (I will play football). Wir werden morgen singen (we will sing tomorrow).", caption: "werden (2nd position) … infinitive (at the end)", subjects: DE,
  concepts: ["werden infinitive", "werden + infinitive", "future tense"], avoid: ["future meaning", "perfect", "imperfect", "past", "passive", "conditional", "würde", "möchte"], doesNotShow: "the present tense with future meaning (Ich spiele morgen), the passive",
  head: "werden + infinitive", foot: "werden + infinitive at the end", blocks: [{ label: "werden is in second position", chips: [{ t: "Ich" }, { t: "werde", k: "v" }, { t: "Fußball" }, { t: "spielen", k: "a" }] }, { label: "the infinitive goes to the end", chips: [{ t: "Wir" }, { t: "werden", k: "v" }, { t: "morgen" }, { t: "singen", k: "a" }] }],
  evidence: "German Futur I: present tense of werden (verb 2nd) + infinitive at the end (Ich werde Fußball spielen; Wir werden morgen singen). Oak keyword 'werden | verb meaning to become, used as auxiliary verb to form the future tense'." });
F({ id: "fr-perfect", title: "French perfect tense structure", alt: "French perfect tense: a present-tense form of avoir or être plus a past participle. J'ai joué (I played). Il est allé (he went).", caption: "avoir or être (present) + past participle", subjects: FR,
  concepts: ["perfect tense", "passé composé"], avoid: ["imperfect", "present tense", "future", "conditional", "imperative"], doesNotShow: "which verbs take être, participle agreement, negation or irregular participles",
  head: "perfect tense", foot: "helper verb + past participle", blocks: [{ label: "avoir (present) + past participle", chips: [{ t: "J’" }, { t: "ai", k: "v" }, { t: "joué", k: "a" }] }, { label: "être (present) + past participle", chips: [{ t: "Il" }, { t: "est", k: "v" }, { t: "allé", k: "a" }] }],
  evidence: "French passé composé: present tense of avoir or être + past participle (j'ai joué; il est allé). Oak keyword 'perfect tense | 2-verb tense that describes completed actions in the past'." });
F({ id: "es-perfect", title: "Spanish perfect tense structure", alt: "Spanish perfect tense: a present-tense form of haber plus a past participle. He hablado (I have spoken). Hemos comido (we have eaten).", caption: "haber (present) + past participle", subjects: ES,
  concepts: ["perfect tense", "pretérito perfecto"], avoid: ["preterite", "imperfect", "future", "conditional", "present tense", "pluperfect"], doesNotShow: "irregular participles, when to use the perfect or the preterite",
  head: "perfect tense", foot: "haber + past participle", blocks: [{ label: "haber (present) + past participle", chips: [{ t: "He", k: "v" }, { t: "hablado", k: "a" }] }, { label: "same pattern, other person", chips: [{ t: "Hemos", k: "v" }, { t: "comido", k: "a" }] }],
  evidence: "Spanish pretérito perfecto compuesto: present tense of haber + past participle (-ado for -ar, -ido for -er/-ir): he hablado, hemos comido. Oak KS4 'perfect tense -ar regular -ado'." });
F({ id: "de-perfect", title: "German perfect tense structure", alt: "German perfect tense: haben or sein in second position and the past participle at the end of the sentence. Ich habe Fußball gespielt (I played football). Er ist nach Berlin gefahren (he went to Berlin).", caption: "haben or sein (2nd position) … past participle (at the end)", subjects: DE,
  concepts: ["perfect tense", "perfekt"], avoid: ["imperfect", "präteritum", "present tense", "future"], doesNotShow: "which verbs take sein, the formation of participles, irregular participles",
  head: "perfect tense", foot: "helper verb 2nd, past participle at the end", blocks: [{ label: "haben + past participle at the end", chips: [{ t: "Ich" }, { t: "habe", k: "v" }, { t: "Fußball" }, { t: "gespielt", k: "a" }] }, { label: "sein + past participle at the end", chips: [{ t: "Er" }, { t: "ist", k: "v" }, { t: "nach Berlin" }, { t: "gefahren", k: "a" }] }],
  evidence: "German Perfekt: present tense of haben or sein (verb second) + past participle at the end (Ich habe Fußball gespielt; Er ist nach Berlin gefahren). Oak keyword 'perfect tense' (German)." });
F({ id: "de-verb-second", title: "German word order 2: the verb is second", alt: "German main clauses: the verb is always the second idea. Ich spiele heute Fußball. Heute spiele ich Fußball: when the time word comes first, the verb stays second and the subject moves behind it.", caption: "the verb stays in second position", subjects: DE,
  concepts: ["word order two", "word order 2", "wo2", "verb second", "inversion"], avoid: ["question", "weil", "dass", "wenn", "obwohl", "=denn", "=und", "=oder", "=aber", "subordinate", "word order three", "word order 3", "wo3", "modal", "separable", "perfect"], doesNotShow: "word order after conjunctions, questions, modal or perfect-tense sentences",
  head: "word order 2", foot: "the verb is always the second idea", blocks: [{ label: "the subject first", chips: [{ t: "Ich" }, { t: "spiele", k: "v" }, { t: "heute" }, { t: "Fußball" }] }, { label: "another idea first: the verb is still 2nd", chips: [{ t: "Heute" }, { t: "spiele", k: "v" }, { t: "ich" }, { t: "Fußball" }] }],
  evidence: "German main clause: finite verb in second position; a time adverbial in first position sends the subject behind the verb (inversion). Oak keyword 'word order two (WO2) | inverts the subject and verb in a sentence; any element can appear at the start'." });
F({ id: "de-verb-final", title: "German word order 3: verb at the end", alt: "German subordinate clause: after conjunctions such as weil the verb goes to the end of the clause. Ich lerne Deutsch, weil es Spaß macht (I learn German because it is fun).", caption: "after weil the verb goes to the end", subjects: DE,
  concepts: ["word order three", "word order 3", "wo3", "verb at the end"], avoid: ["=denn", "word order two", "word order 2", "wo2", "modal", "separable", "perfect", "question", "=und", "=aber", "=oder"], doesNotShow: "conjunctions that do not send the verb to the end (denn, und, aber), separable verbs, perfect tense",
  head: "word order 3", foot: "weil … verb at the end of the clause", blocks: [{ label: "main clause", chips: [{ t: "Ich" }, { t: "lerne", k: "v" }, { t: "Deutsch," }] }, { label: "weil sends the verb to the end", chips: [{ t: "weil", k: "x" }, { t: "es" }, { t: "Spaß" }, { t: "macht", k: "v" }] }],
  evidence: "German subordinate clause after weil/dass/wenn: verb at the end (Ich lerne Deutsch, weil es Spaß macht). Oak keyword 'word order three (WO3) | the verb is sent to the end of the clause or sentence, e.g. weil es Spaß macht'." });
F({ id: "de-time-manner-place", title: "German time-manner-place", alt: "German word order for adverbials: time first, then manner, then place. Ich fahre heute mit dem Zug nach Berlin: heute is the time, mit dem Zug is the manner, nach Berlin is the place.", caption: "time, then manner, then place", subjects: DE,
  concepts: ["time manner place", "tmp"], avoid: ["question", "weil", "dass", "wenn", "obwohl", "perfect", "modal", "inversion", "word order two", "wo2", "wo3", "word order 3", "word order three"], doesNotShow: "inversion (starting with an adverbial), subordinate clauses, the perfect tense",
  head: "time – manner – place", foot: "when · how · where", blocks: [{ chips: [{ t: "Ich" }, { t: "fahre", k: "v" }, { t: "heute", k: "a" }, { t: "mit dem Zug", k: "p" }, { t: "nach Berlin", k: "x" }] }, { label: "blue = time · gold = manner · red = place", chips: [{ t: "time", k: "a" }, { t: "manner", k: "p" }, { t: "place", k: "x" }] }],
  evidence: "German time-manner-place: adverbials after the verb in the order Time, Manner, Place (Ich fahre heute mit dem Zug nach Berlin). Oak KS3 German 'time-manner-place'." });
F({ id: "fr-object-pronoun", title: "French pronoun position", alt: "French object pronouns go directly before the conjugated verb: Je le vois (I see him or it). Il me parle (he speaks to me).", caption: "the pronoun goes directly before the verb", subjects: FR,
  concepts: ["direct object pronoun", "indirect object pronoun", "object pronoun"], avoid: ["imperative", "infinitive", "perfect", "two pronouns", "emphatic", "relative", "question", "negation", "negative", "reflexive"], doesNotShow: "the imperative (regarde-le), the perfect tense, two pronouns together, negatives",
  head: "pronoun + verb", foot: "object pronoun directly before the verb", blocks: [{ label: "direct object pronoun", chips: [{ t: "Je" }, { t: "le", k: "p" }, { t: "vois", k: "v" }] }, { label: "indirect object pronoun", chips: [{ t: "Il" }, { t: "me", k: "p" }, { t: "parle", k: "v" }] }],
  evidence: "French present tense: object pronouns (direct le/la/les, indirect me/te/lui) stand directly before the conjugated verb: Je le vois; Il me parle. Oak keywords 'direct object pronoun', 'indirect object pronoun'." });
F({ id: "es-object-pronoun", title: "Spanish pronoun position", alt: "Spanish object pronouns go directly before the conjugated verb: Lo veo (I see him or it). Me habla (he speaks to me).", caption: "the pronoun goes directly before the verb", subjects: ES,
  concepts: ["direct object pronoun", "indirect object pronoun", "object pronoun"], avoid: ["imperative", "infinitive", "gerund", "perfect", "two pronouns", "preterite", "imperfect", "personal a", "gustar", "question", "negation", "negative", "reflexive"], doesNotShow: "attached pronouns (verlo, dámelo), the imperative, two pronouns together",
  head: "pronoun + verb", foot: "object pronoun directly before the verb", blocks: [{ label: "direct object pronoun", chips: [{ t: "Lo", k: "p" }, { t: "veo", k: "v" }] }, { label: "indirect object pronoun", chips: [{ t: "Me", k: "p" }, { t: "habla", k: "v" }] }],
  evidence: "Spanish present tense: object pronouns (direct lo/la/los/las, indirect me/te/le) stand directly before the conjugated verb: Lo veo; Me habla. Oak keywords 'direct object pronoun', 'indirect object pronoun'." });
F({ id: "es-gustar", title: "Spanish gustar", alt: "Spanish gustar agrees with the thing that is liked, not with the person: Me gusta el chocolate (I like chocolate), Me gustan los perros (I like dogs).", caption: "gusta + one thing · gustan + several things", subjects: ES,
  concepts: ["gustar", "gustar type verb", "me gusta"], avoid: ["preterite", "imperfect", "future", "conditional", "perfect", "negation", "question", "pronoun", "indirect object", "=gusto"], doesNotShow: "the other pronouns (te, le, nos, os, les), gustar in other tenses",
  head: "gustar", foot: "the verb agrees with the thing liked", blocks: [{ label: "one thing → gusta", chips: [{ t: "Me", k: "p" }, { t: "gusta", k: "v" }, { t: "el chocolate" }] }, { label: "several things → gustan", chips: [{ t: "Me", k: "p" }, { t: "gustan", k: "v" }, { t: "los perros" }] }],
  evidence: "Spanish gustar (present): me gusta + singular noun / infinitive, me gustan + plural noun. Oak KS3 'gustar-type verbs'." });
F({ id: "fr-modal", title: "French modal verb + infinitive", alt: "French modal verbs are followed by an infinitive: Je veux jouer (I want to play). Nous pouvons manger (we can eat).", caption: "modal verb (changes) + infinitive (stays)", subjects: FR,
  concepts: ["modal verb"], avoid: ["perfect", "imperfect", "future", "conditional", "negation", "question", "pronoun", "irregular", "aller", "opinion", "if clause"], doesNotShow: "the forms of each modal verb, negation or questions",
  head: "modal verb + infinitive", foot: "the modal verb changes; the 2nd verb is an infinitive", blocks: [{ label: "vouloir + infinitive", chips: [{ t: "Je" }, { t: "veux", k: "v" }, { t: "jouer", k: "a" }] }, { label: "pouvoir + infinitive", chips: [{ t: "Nous" }, { t: "pouvons", k: "v" }, { t: "manger", k: "a" }] }],
  evidence: "French modal verbs (vouloir, pouvoir, devoir) + infinitive: Je veux jouer; Nous pouvons manger. Oak keyword 'modal verb | verb of necessity or possibility used with a 2nd verb in the infinitive'." });
F({ id: "es-modal", title: "Spanish modal verb + infinitive", alt: "Spanish modal verbs are followed by an infinitive: Quiero jugar (I want to play). Podemos comer (we can eat).", caption: "modal verb (changes) + infinitive (stays)", subjects: ES,
  concepts: ["modal verb"], avoid: ["perfect", "imperfect", "preterite", "future", "conditional", "negation", "question", "pronoun", "irregular", "ir a", "opinion", "gustar", "if clause"], doesNotShow: "the forms of each modal verb, negation or questions",
  head: "modal verb + infinitive", foot: "the modal verb changes; the 2nd verb is an infinitive", blocks: [{ label: "querer + infinitive", chips: [{ t: "Quiero", k: "v" }, { t: "jugar", k: "a" }] }, { label: "poder + infinitive", chips: [{ t: "Podemos", k: "v" }, { t: "comer", k: "a" }] }],
  evidence: "Spanish modal verbs (querer, poder, deber) + infinitive: Quiero jugar; Podemos comer. Oak keyword 'modal verb'; KS3 'poder', 'deber'." });
F({ id: "de-modal", title: "German modal verb + infinitive", alt: "German modal verbs: the modal verb is in second position and the infinitive goes to the end of the sentence. Ich will Fußball spielen (I want to play football). Wir können heute schwimmen (we can swim today).", caption: "modal verb 2nd position … infinitive at the end", subjects: DE,
  concepts: ["modal verb"], avoid: ["perfect", "imperfect", "präteritum", "future", "conditional", "möchte", "negation", "question", "separable", "irregular", "word order three", "wo3", "weil", "dass"], doesNotShow: "the forms of each modal verb, questions, subordinate clauses",
  head: "modal verb + infinitive", foot: "modal verb second, infinitive last", blocks: [{ label: "modal verb 2nd, infinitive at the end", chips: [{ t: "Ich" }, { t: "will", k: "v" }, { t: "Fußball" }, { t: "spielen", k: "a" }] }, { label: "same pattern", chips: [{ t: "Wir" }, { t: "können", k: "v" }, { t: "heute" }, { t: "schwimmen", k: "a" }] }],
  evidence: "German modal verbs (können, müssen, wollen …) in second position + infinitive at the end: Ich will Fußball spielen; Wir können heute schwimmen. Oak keyword 'modal verb'; KS3 'two-verb structures'." });
F({ id: "fr-there-is", title: "French il y a", alt: "French il y a means there is or there are: Il y a un chien (there is a dog), Il y a deux chiens (there are two dogs). The negative is Il n'y a pas de chien.", caption: "il y a = there is / there are", subjects: FR,
  concepts: ["il y a"], avoid: ["ago", "perfect", "imperfect", "future", "conditional", "past", "quantity", "pas de", "il ny a pas", "il n y a pas", "=depuis"], doesNotShow: "il y a meaning ago, other tenses",
  head: "il y a", foot: "one word group for is and are", blocks: [{ label: "there is", chips: [{ t: "Il y a", k: "v" }, { t: "un chien" }] }, { label: "there are", chips: [{ t: "Il y a", k: "v" }, { t: "deux chiens" }] }, { label: "there is not", chips: [{ t: "Il n’y a pas de", k: "x" }, { t: "chien" }] }],
  evidence: "French il y a = there is / there are (Oak keyword 'il y a | there is or there are'); negative il n'y a pas de + noun. Examples un chien, deux chiens." });
F({ id: "es-there-is", title: "Spanish hay", alt: "Spanish hay means there is or there are: Hay un perro (there is a dog), Hay dos perros (there are two dogs). The negative is No hay perros.", caption: "hay = there is / there are", subjects: ES,
  concepts: ["hay"], avoid: ["perfect", "imperfect", "future", "conditional", "preterite", "past", "=ay", "=hubo", "=había"], doesNotShow: "other tenses (había, hubo)",
  head: "hay", foot: "one word for is and are", blocks: [{ label: "there is", chips: [{ t: "Hay", k: "v" }, { t: "un perro" }] }, { label: "there are", chips: [{ t: "Hay", k: "v" }, { t: "dos perros" }] }, { label: "there is not / there are not", chips: [{ t: "No hay", k: "x" }, { t: "perros" }] }],
  evidence: "Spanish hay = there is / there are (Oak keyword 'hay | verb meaning there is or there are depending on whether it is followed by singular or plural'); negative no hay. Examples un perro, dos perros." });
F({ id: "de-there-is", title: "German es gibt", alt: "German es gibt means there is or there are: Es gibt einen Hund (there is a dog), Es gibt Hunde (there are dogs). The noun after es gibt is in the accusative.", caption: "es gibt = there is / there are", subjects: DE,
  concepts: ["es gibt"], avoid: ["es gab", "perfect", "imperfect", "präteritum", "future", "past", "conditional", "vs", "versus"], doesNotShow: "es gab (imperfect), other uses of geben",
  head: "es gibt", foot: "es gibt + accusative", blocks: [{ label: "there is (one)", chips: [{ t: "Es gibt", k: "v" }, { t: "einen Hund" }] }, { label: "there are (several)", chips: [{ t: "Es gibt", k: "v" }, { t: "Hunde" }] }],
  evidence: "German es gibt + accusative = there is / there are (einen Hund, Hunde). Oak KS4 'es gibt vs es gab, imperfect'." });
F({ id: "fr-questions", title: "French yes/no question forms", alt: "Three ways to ask a yes or no question in French: raise your voice (Tu aimes le sport ?), start with est-ce que (Est-ce que tu aimes le sport ?), or invert the verb and pronoun (Aimes-tu le sport ?).", caption: "three ways to ask a yes/no question", subjects: FR,
  concepts: ["est ce que", "inversion question", "intonation question", "closed question", "yes no question"], avoid: ["=qui", "=quoi", "=où", "=quand", "=comment", "=pourquoi", "question word", "information question", "open question", "perfect", "negative", "pronoun", "=combien", "=quel", "=quelle"], doesNotShow: "question words (où, quand, comment …) or questions in the perfect tense",
  head: "yes/no questions", foot: "the answer is oui or non", blocks: [{ label: "1  intonation: your voice goes up", chips: [{ t: "Tu aimes le sport ?" }] }, { label: "2  est-ce que + statement", chips: [{ t: "Est-ce que", k: "x" }, { t: "tu aimes le sport ?" }] }, { label: "3  inversion: verb before pronoun", chips: [{ t: "Aimes-tu", k: "v" }, { t: "le sport ?" }] }],
  evidence: "French closed questions: intonation (Tu aimes le sport ?), est-ce que (Est-ce que tu aimes le sport ?), inversion (Aimes-tu le sport ?). Oak keywords 'est-ce que', 'inversion', 'closed question', 'intonation question'." });
F({ id: "es-questions", title: "Spanish yes/no questions", alt: "Spanish yes or no questions: the statement Hablas inglés becomes the question ¿Hablas inglés? with an upside-down question mark at the start and your voice rising.", caption: "¿ … ? and a rising voice", subjects: ES,
  concepts: ["intonation question", "closed question", "yes no question"], avoid: ["qué", "quién", "dónde", "cuándo", "cómo", "cuánto", "cuál", "por qué", "question word", "information question", "open question", "perfect", "preterite", "negative", "pronoun"], doesNotShow: "question words (dónde, cuándo …)",
  head: "yes/no questions", foot: "¿ opens the question and ? closes it", blocks: [{ label: "statement", chips: [{ t: "Hablas inglés." }] }, { label: "question: same words, rising voice", chips: [{ t: "¿Hablas inglés?", k: "a" }] }],
  evidence: "Spanish closed questions: statement word order + rising intonation, written between ¿ and ?. Oak keywords 'intonation question', 'closed question'." });
F({ id: "de-questions", title: "German yes/no questions", alt: "German yes or no questions put the verb first: the statement Du spielst Fußball becomes the question Spielst du Fußball?", caption: "yes/no question: the verb comes first", subjects: DE,
  concepts: ["closed question", "yes no question", "inversion question"], avoid: ["=wer", "=was", "=wo", "=wann", "=wie", "=warum", "=woher", "=wohin", "=welche", "question word", "information question", "open question", "perfect", "modal", "separable", "negative"], doesNotShow: "question words (wer, was, wo …), questions with modal verbs or in the perfect tense",
  head: "yes/no questions", foot: "the answer is ja or nein", blocks: [{ label: "statement: verb 2nd", chips: [{ t: "Du" }, { t: "spielst", k: "v" }, { t: "Fußball." }] }, { label: "question: verb 1st", chips: [{ t: "Spielst", k: "v" }, { t: "du" }, { t: "Fußball?" }] }],
  evidence: "German Ja/Nein-Frage: finite verb in first position (Spielst du Fußball?). Oak keywords 'closed question | a question that can be answered with yes or no', 'inversion'." });
const cards = (title: string, rows: [string, string][], caption: string) => {
  let s = T(120, 17, title, "m", "tb");
  rows.forEach(([a, b], i) => { const col = i % 2, r = Math.floor(i / 2); const x = 6 + col * 118, y = 32 + r * 30; s += rect(x, y, 112, 26, "l f3", 5) + T(x + 6, y + 12, a, "l", "ts") + T(x + 106, y + 22, b, "r", "tx tm"); });
  return s + cap(caption, 165, 44);
};
const QW_AVOID = ["closed question", "yes no", "perfect", "negative", "relative", "indirect question", "intonation question", "est ce que", "inversion", "modal", "separable"];
FRAMES.push(mk({ id: "fr-question-words", title: "French question words", alt: "French question words with their meanings: qui (who), que or qu'est-ce que (what), où (where), quand (when), comment (how), pourquoi (why), combien (how much or how many), quel or quelle (which).", caption: "French question words", subjects: FR,
  concepts: ["question word", "information question", "open question", "interrogative", "wh question"], avoid: QW_AVOID, doesNotShow: "how to build the whole question (word order)",
  body: cards("question words", [["qui", "who"], ["que / qu’est-ce que", "what"], ["où", "where"], ["quand", "when"], ["comment", "how"], ["pourquoi", "why"], ["combien", "how much / many"], ["quel / quelle", "which"]], "words that ask for information"),
  evidence: "French mots interrogatifs: qui (who), que/qu'est-ce que (what), où (where), quand (when), comment (how), pourquoi (why), combien (how much/many), quel/quelle (which). Oak keywords 'open question', 'information question'." }));
FRAMES.push(mk({ id: "es-question-words", title: "Spanish question words", alt: "Spanish question words with their meanings: ¿quién? (who), ¿qué? (what), ¿dónde? (where), ¿cuándo? (when), ¿cómo? (how), ¿por qué? (why), ¿cuánto? (how much or how many; cuántos and cuántas agree with the noun), ¿cuál? (which). They all carry a written accent.", caption: "Spanish question words", subjects: ES,
  concepts: ["question word", "information question", "open question", "interrogative", "wh question"], avoid: QW_AVOID, doesNotShow: "how to build the whole question (word order)",
  body: cards("question words", [["¿quién?", "who"], ["¿qué?", "what"], ["¿dónde?", "where"], ["¿cuándo?", "when"], ["¿cómo?", "how"], ["¿por qué?", "why"], ["¿cuánto?", "how much / many"], ["¿cuál?", "which"]], "words that ask for information"),
  evidence: "Spanish palabras interrogativas: ¿quién? who, ¿qué? what, ¿dónde? where, ¿cuándo? when, ¿cómo? how, ¿por qué? why, ¿cuánto? how much, ¿cuál? which (all with accents). Oak keywords 'open question', 'information question'." }));
FRAMES.push(mk({ id: "de-question-words", title: "German question words", alt: "German question words (W-Fragen) with their meanings: wer (who), was (what), wo (where), wann (when), wie (how), warum (why), woher (where from), wohin (where to).", caption: "German question words", subjects: DE,
  concepts: ["question word", "information question", "open question", "interrogative", "wh question"], avoid: QW_AVOID, doesNotShow: "how to build the whole question (word order)",
  body: cards("question words", [["wer", "who"], ["was", "what"], ["wo", "where"], ["wann", "when"], ["wie", "how"], ["warum", "why"], ["woher", "where from"], ["wohin", "where to"]], "words that ask for information"),
  evidence: "German W-Fragen: wer (who), was (what), wo (where), wann (when), wie (how), warum (why), woher (where from), wohin (where to). Oak KS3 'questions with wer, was, wo and wie', keyword 'open question'." }));
const CMP_AVOID = ["irregular", "superlative", "adverb", "=bon", "=bien", "=mauvais", "=bueno", "=malo", "=gut", "=gern"];
F({ id: "fr-comparative", title: "French comparatives", alt: "French comparatives: plus + adjective + que (more than), moins + adjective + que (less than), aussi + adjective + que (as … as). Il est plus grand que moi.", caption: "plus / moins / aussi + adjective + que", subjects: FR,
  concepts: ["comparative", "plus que", "moins que", "aussi que"], avoid: [...CMP_AVOID, "=meilleur", "=pire", "=mieux"], doesNotShow: "irregular comparatives (meilleur, pire, mieux), superlatives, comparative adverbs",
  head: "comparatives", foot: "que introduces what is compared", blocks: [{ label: "more than", chips: [{ t: "plus", k: "x" }, { t: "grand", k: "a" }, { t: "que", k: "x" }] }, { label: "less than", chips: [{ t: "moins", k: "x" }, { t: "grand", k: "a" }, { t: "que", k: "x" }] }, { label: "as … as", chips: [{ t: "aussi", k: "x" }, { t: "grand", k: "a" }, { t: "que", k: "x" }] }],
  evidence: "French comparatif: plus / moins / aussi + adjective + que (plus grand que, moins grand que, aussi grand que). Oak KS3 'Comparisons: plus…que, moins…que, aussi…que'." });
F({ id: "es-comparative", title: "Spanish comparatives", alt: "Spanish comparatives: más + adjective + que (more than), menos + adjective + que (less than), tan + adjective + como (as … as). Es más alto que yo.", caption: "más / menos + adjective + que; tan … como", subjects: ES,
  concepts: ["comparative", "más que", "menos que", "tan como"], avoid: [...CMP_AVOID, "=mejor", "=peor", "=mayor", "=menor"], doesNotShow: "irregular comparatives (mejor, peor, mayor, menor), superlatives, comparative adverbs",
  head: "comparatives", foot: "que / como introduces the comparison", blocks: [{ label: "more than", chips: [{ t: "más", k: "x" }, { t: "alto", k: "a" }, { t: "que", k: "x" }] }, { label: "less than", chips: [{ t: "menos", k: "x" }, { t: "alto", k: "a" }, { t: "que", k: "x" }] }, { label: "as … as", chips: [{ t: "tan", k: "x" }, { t: "alto", k: "a" }, { t: "como", k: "x" }] }],
  evidence: "Spanish comparativo: más / menos + adjective + que; tan + adjective + como (más alto que, menos alto que, tan alto como). Oak KS3 'Family and friends: possessive adjectives, comparatives'." });
F({ id: "de-comparative", title: "German comparatives", alt: "German comparatives: adjective + -er + als (bigger than) and so + adjective + wie (as … as). Er ist größer als ich. Er ist so groß wie ich.", caption: "adjective + -er + als; so … wie", subjects: DE,
  concepts: ["comparative"], avoid: [...CMP_AVOID, "=besser", "=mehr", "=lieber", "=viel"], doesNotShow: "irregular comparatives (besser, mehr, lieber), superlatives, umlaut changes",
  head: "comparatives", foot: "als = than; so … wie = as … as", blocks: [{ label: "more … than", chips: [{ t: "Er" }, { t: "ist" }, { t: "größer", k: "a" }, { t: "als", k: "x" }, { t: "ich" }] }, { label: "as … as", chips: [{ t: "Er" }, { t: "ist" }, { t: "so", k: "x" }, { t: "groß", k: "a" }, { t: "wie", k: "x" }, { t: "ich" }] }],
  evidence: "German Komparativ: adjective + -er + als (größer als); Gleichheit: so + adjective + wie (so groß wie). Oak KS3 German 'comparatives'." });

// ── articles, pronouns, adjectives (tables) ─────────────────────────────────
const TBL: Pic[] = [];
const artHead = ["", "the", "a / some", "example"];
TBL.push(mk({ id: "fr-articles", title: "French articles and gender", alt: "French articles. Masculine: le or l' (the), un (a): le chien. Feminine: la or l' (the), une (a): la maison. Plural: les (the), des (some): les chiens.", caption: "French definite and indefinite articles", subjects: FR,
  concepts: ["definite article", "indefinite article", "grammatical gender"], avoid: ["partitive", "du de la", "de la", "preposition", "=au", "=aux", "contraction", "possessive", "demonstrative", "adjective", "negation", "pas de", "quantity"], doesNotShow: "partitive articles (du, de la), contractions (au, aux), the use of articles after negatives",
  body: T(120, 17, "articles", "m", "tb") + table([{ x: 8, align: "l", cls: "ts tm" }, { x: 88, align: "l" }, { x: 136, align: "l" }, { x: 232, align: "r", cls: "ts" }], artHead, [["masculine", "le  (l’)", "un", "le chien"], ["feminine", "la  (l’)", "une", "la maison"], ["plural", "les", "des", "les chiens"]], 42, 24) + cap("l’ replaces le or la before a vowel", 150, 44),
  evidence: "French articles: définis le (m), la (f), l' (before a vowel or mute h), les (pl); indéfinis un, une, des. Oak keywords 'definite article', 'indefinite article', 'grammatical gender'. Examples le chien, la maison, les chiens." }));
TBL.push(mk({ id: "es-articles", title: "Spanish articles and gender", alt: "Spanish articles. Masculine singular: el (the), un (a): el perro. Feminine singular: la (the), una (a): la casa. Masculine plural: los (the), unos (some): los perros. Feminine plural: las (the), unas (some): las casas.", caption: "Spanish definite and indefinite articles", subjects: ES,
  concepts: ["definite article", "indefinite article", "grammatical gender"], avoid: ["contraction", "=del", "possessive", "demonstrative", "adjective", "omission", "omit", "uses of", "abstract", "el agua"], doesNotShow: "el before feminine nouns that start with stressed a (el agua), contractions (del, al), uses and omission of articles",
  body: T(120, 17, "articles", "m", "tb") + table([{ x: 8, align: "l", cls: "ts tm" }, { x: 92, align: "l" }, { x: 132, align: "l" }, { x: 232, align: "r", cls: "ts" }], artHead, [["masculine", "el", "un", "el perro"], ["feminine", "la", "una", "la casa"], ["masc. plural", "los", "unos", "los perros"], ["fem. plural", "las", "unas", "las casas"]], 42, 24) + cap("the article matches gender and number", 162, 44),
  evidence: "Spanish artículos: definidos el, la, los, las; indefinidos un, una, unos, unas. Oak keywords 'definite article | the words el and la meaning the', 'indefinite article'. Examples el perro, la casa." }));
TBL.push(mk({ id: "de-articles", title: "German articles and gender (nominative)", alt: "German articles in the nominative case. Masculine: der (the), ein (a): der Hund. Feminine: die (the), eine (a): die Katze. Neuter: das (the), ein (a): das Haus. Plural: die (the), no indefinite article: die Hunde.", caption: "der / die / das: the three genders", subjects: DE,
  concepts: ["definite article", "indefinite article", "grammatical gender", "der die das"], avoid: ["accusative", "dative", "genitive", "=case", "=cases", "=den", "=dem", "=des", "preposition", "possessive", "=kein", "negation", "adjective ending", "prenominal", "mein", "unser"], doesNotShow: "the accusative, dative and genitive cases; kein; adjective endings",
  body: T(120, 17, "articles (nominative)", "m", "tb") + table([{ x: 8, align: "l", cls: "ts tm" }, { x: 82, align: "l" }, { x: 122, align: "l" }, { x: 232, align: "r", cls: "ts" }], ["", "the", "a", "example"], [["masculine", [["der", "ta"]], "ein", "der Hund"], ["feminine", [["die", "tr"]], "eine", "die Katze"], ["neuter", [["das", "tg"]], "ein", "das Haus"], ["plural", [["die", "tr"]], "–", "die Hunde"]], 42, 24) + cap("blue der · red die · green das", 160, 44),
  evidence: "German Artikel, Nominativ: der (m), die (f), das (n), die (pl); ein, eine, ein, (no plural indefinite). Oak keyword 'definite article | words der, die, das meaning the'. Examples der Hund, die Katze, das Haus, die Hunde." }));
TBL.push(mk({ id: "de-cases-articles", title: "German cases: definite articles", alt: "German definite articles in three cases. Nominative: der, die, das, die. Accusative: den, die, das, die. Dative: dem, der, dem, den. Only the masculine changes in the accusative.", caption: "nominative · accusative · dative", subjects: DE,
  concepts: ["accusative", "accusative case", "dative", "dative case"], requires: ["article", "articles", "=den", "=dem"], avoid: ["adjective", "reflexive", "reciprocal", "nominalis", "=laut", "=seit", "genitive", "possessive", "=kein", "indefinite", "adjective ending", "prenominal", "pronoun", "=mich", "=dich", "=mir", "=dir", "=ihm", "=ihn", "time adverb", "=letzten", "=diese", "verbs with"], doesNotShow: "the genitive, indefinite articles, adjective endings, pronouns, dative plural noun endings",
  body: T(120, 17, "definite articles", "m", "tb") + table([{ x: 8, align: "l", cls: "ts tm" }, { x: 94, align: "m" }, { x: 152, align: "m" }, { x: 210, align: "m" }], ["", "nominative", "accusative", "dative"], [["masculine", "der", [["den", "tr"]], "dem"], ["feminine", "die", "die", "der"], ["neuter", "das", "das", "dem"], ["plural", "die", "die", "den"]], 42, 24) + cap("only masculine changes: der → den", 162, 44),
  evidence: "German definite articles: Nom der/die/das/die; Akk den/die/das/die; Dat dem/der/dem/den (standard declension table). Oak keywords 'accusative', 'dative', 'accusative case' (KS3 German)." }));
TBL.push(mk({ id: "fr-partitive", title: "French partitive articles", alt: "French partitive articles meaning some: du before a masculine noun (du pain), de la before a feminine noun (de la confiture), de l' before a vowel (de l'eau), des before a plural (des légumes).", caption: "du · de la · de l’ · des = some", subjects: FR,
  concepts: ["partitive article", "partitive"], avoid: ["negation", "negative", "pas de", "expression of quantity", "beaucoup de", "definite article", "indefinite article", "preposition"], doesNotShow: "the partitive after a negative (pas de) or after quantities (beaucoup de)",
  body: T(120, 17, "partitive articles (some)", "m", "tb") + table([{ x: 8, align: "l", cls: "ts tm" }, { x: 84, align: "l" }, { x: 232, align: "r", cls: "ts" }], ["", "some", "example"], [["masculine", "du", "du pain"], ["feminine", "de la", "de la confiture"], ["vowel", "de l’", "de l’eau"], ["plural", "des", "des légumes"]], 42, 24) + cap("some: du · de la · de l\u2019 · des", 162, 44),
  evidence: "French articles partitifs: du (m), de la (f), de l' (before a vowel), des (pl) meaning some. Oak keyword 'partitive article | the words du, de la, de l' and des meaning some'. Examples du pain, de la confiture, de l'eau, des légumes." }));
const spTable = (rows: string[][], dy = 14.5) => rows.map(([a, b], i) => T(104, 36 + i * dy, a, "r", "ts") + T(112, 36 + i * dy, b, "l", "tx tm")).join("") + ln(108, 27, 108, 36 + (rows.length - 1) * dy + 5, "th");
TBL.push(mk({ id: "fr-subject-pronouns", title: "French subject pronouns", alt: "French subject pronouns: je (I), tu (you, informal singular), il (he), elle (she), on (one, we), nous (we), vous (you, plural or formal), ils (they, masculine or mixed), elles (they, feminine).", caption: "French subject pronouns", subjects: FR,
  concepts: ["subject pronoun"], avoid: ["negative", "object pronoun", "direct object", "indirect object", "reflexive", "relative", "emphatic", "possessive", "perfect"], doesNotShow: "object, reflexive and emphatic pronouns; negative subject pronouns (personne, rien); when to use tu or vous",
  body: T(120, 17, "subject pronouns", "m", "tb") + spTable([["je", "I"], ["tu", "you (informal, singular)"], ["il", "he"], ["elle", "she"], ["on", "one / we"], ["nous", "we"], ["vous", "you (plural or formal)"], ["ils", "they (masculine or mixed)"], ["elles", "they (feminine)"]]),
  evidence: "French pronoms sujets: je, tu, il, elle, on, nous, vous, ils, elles. Oak keyword 'subject pronoun | represents the person, people or thing(s) doing the verb'." }));
TBL.push(mk({ id: "es-subject-pronouns", title: "Spanish subject pronouns", alt: "Spanish subject pronouns: yo (I), tú (you, informal), él (he), ella (she), usted (you, formal), nosotros or nosotras (we), vosotros or vosotras (you, plural informal), ellos or ellas (they), ustedes (you, plural formal).", caption: "Spanish subject pronouns", subjects: ES,
  concepts: ["subject pronoun"], avoid: ["object pronoun", "direct object", "indirect object", "reflexive", "relative", "emphatic", "possessive", "perfect", "prepositional"], doesNotShow: "object, reflexive and prepositional pronouns; when the subject pronoun can be left out",
  body: T(120, 17, "subject pronouns", "m", "tb") + spTable([["yo", "I"], ["tú", "you (informal)"], ["él", "he"], ["ella", "she"], ["usted", "you (formal)"], ["nosotros / nosotras", "we"], ["vosotros / vosotras", "you (plural, informal)"], ["ellos / ellas", "they"], ["ustedes", "you (plural, formal)"]], 15),
  evidence: "Spanish pronombres personales sujeto: yo, tú, él, ella, usted, nosotros/as, vosotros/as, ellos, ellas, ustedes. Oak keyword 'subject pronoun'; KS3 text 'Subject pronouns yo, tú, él, ella; we usually omit the use of subject pronoun'." }));
TBL.push(mk({ id: "de-subject-pronouns", title: "German subject pronouns", alt: "German subject pronouns: ich (I), du (you, informal), er (he), sie (she), es (it), wir (we), ihr (you, plural informal), sie (they), Sie (you, formal).", caption: "German subject pronouns", subjects: DE,
  concepts: ["subject pronoun"], avoid: ["object pronoun", "direct object", "indirect object", "reflexive", "relative", "emphatic", "possessive", "perfect", "=mich", "=dich", "=mir", "=dir"], doesNotShow: "object and reflexive pronouns; the difference between du, ihr and Sie in detail",
  body: T(120, 17, "subject pronouns", "m", "tb") + spTable([["ich", "I"], ["du", "you (informal)"], ["er", "he"], ["sie", "she"], ["es", "it"], ["wir", "we"], ["ihr", "you (plural, informal)"], ["sie", "they"], ["Sie", "you (formal, capital S)"]]),
  evidence: "German Personalpronomen (Nominativ): ich, du, er, sie, es, wir, ihr, sie, Sie. Oak keywords 'subject pronoun', 'sie | subject pronoun she and it for feminine nouns', 'es | subject pronoun it for neuter nouns'." }));
const reflTable = (lang: Lang, rows: [string, Cell][]) => table([{ x: 10, align: "l", cls: (lang === "es" ? "tx" : "ts") + " tm" }, { x: lang === "es" ? 118 : 100, align: "l" }], null, rows, 42, 19);
TBL.push(mk({ id: "fr-reflexive", title: "French reflexive pronouns", alt: "French reflexive pronouns with the verb se laver (to wash oneself): je me lave, tu te laves, il se lave, nous nous lavons, vous vous lavez, ils se lavent.", caption: "reflexive pronouns: me, te, se, nous, vous, se", subjects: FR,
  concepts: ["reflexive pronoun", "reflexive verb", "reflexive"], avoid: ["perfect", "imperfect", "future", "imperative", "infinitive", "conditional", "direct object", "indirect object", "object pronoun"], doesNotShow: "the perfect tense of reflexive verbs, the imperative, the infinitive",
  body: T(120, 17, "se laver (to wash oneself)", "m", "tb") + reflTable("fr", [[PRON.fr[0], [["me", "tr"], [" lave"]]], [PRON.fr[1], [["te", "tr"], [" laves"]]], [PRON.fr[2], [["se", "tr"], [" lave"]]], [PRON.fr[3], [["nous", "tr"], [" lavons"]]], [PRON.fr[4], [["vous", "tr"], [" lavez"]]], [PRON.fr[5], [["se", "tr"], [" lavent"]]]]) + cap("the reflexive pronoun matches the subject", 165, 44),
  evidence: "French verbes pronominaux, present tense of se laver: je me lave, tu te laves, il/elle/on se lave, nous nous lavons, vous vous lavez, ils/elles se lavent. Oak keyword 'reflexive pronoun | replaces the object in a sentence using a reflexive verb'." }));
TBL.push(mk({ id: "es-reflexive", title: "Spanish reflexive pronouns", alt: "Spanish reflexive pronouns with the verb lavarse (to wash oneself): yo me lavo, tú te lavas, él se lava, nosotros nos lavamos, vosotros os laváis, ellos se lavan.", caption: "reflexive pronouns: me, te, se, nos, os, se", subjects: ES,
  concepts: ["reflexive pronoun", "reflexive verb", "reflexive"], avoid: ["preterite", "imperfect", "future", "imperative", "infinitive", "gerund", "conditional", "perfect", "direct object", "indirect object", "object pronoun"], doesNotShow: "the preterite of reflexive verbs, the imperative, attached pronouns (lavarse)",
  body: T(120, 17, "lavarse (to wash oneself)", "m", "tb") + reflTable("es", [["yo", [["me", "tr"], [" lavo"]]], ["tú", [["te", "tr"], [" lavas"]]], ["él / ella / usted", [["se", "tr"], [" lava"]]], ["nosotros / nosotras", [["nos", "tr"], [" lavamos"]]], ["vosotros / vosotras", [["os", "tr"], [" laváis"]]], ["ellos / ellas / ustedes", [["se", "tr"], [" lavan"]]]]) + cap("the reflexive pronoun matches the subject", 165, 44),
  evidence: "Spanish verbos reflexivos, present tense of lavarse: me lavo, te lavas, se lava, nos lavamos, os laváis, se lavan. Oak keyword 'reflexive pronoun'." }));
TBL.push(mk({ id: "de-reflexive", title: "German reflexive pronouns", alt: "German reflexive pronouns with the verb sich waschen (to wash oneself): ich wasche mich, du wäschst dich, er wäscht sich, wir waschen uns, ihr wascht euch, sie waschen sich.", caption: "reflexive pronouns: mich, dich, sich, uns, euch, sich", subjects: DE,
  concepts: ["reflexive pronoun", "reflexive verb", "reflexive"], avoid: ["perfect", "imperfect", "präteritum", "future", "imperative", "infinitive", "dative", "=mir", "=dir", "modal", "separable", "direct object", "indirect object", "object pronoun"], doesNotShow: "dative reflexive pronouns (mir, dir), the perfect tense of reflexive verbs",
  body: T(120, 17, "sich waschen (to wash oneself)", "m", "tb") + reflTable("de", [["ich", [["wasche "], ["mich", "tr"]]], ["du", [["wäschst "], ["dich", "tr"]]], ["er / sie / es", [["wäscht "], ["sich", "tr"]]], ["wir", [["waschen "], ["uns", "tr"]]], ["ihr", [["wascht "], ["euch", "tr"]]], ["sie / Sie", [["waschen "], ["sich", "tr"]]]]) + cap("the reflexive pronoun matches the subject", 165, 44),
  evidence: "German reflexive Verben, accusative reflexive pronouns with sich waschen: ich wasche mich, du wäschst dich, er/sie/es wäscht sich, wir waschen uns, ihr wascht euch, sie/Sie waschen sich. Oak KS3 'reflexive verbs'." }));
const possTable = (title: string, head: string[], rows: string[][], xs: number[]) => T(120, 17, title, "m", "tb") + table([{ x: 8, align: "l", cls: "ts tm" }, { x: xs[0], align: "m" }, { x: xs[1], align: "m" }, { x: xs[2], align: "m" }], head, rows, 38, 18);
TBL.push(mk({ id: "fr-possessive", title: "French possessive adjectives", alt: "French possessive adjectives by owner. my: mon, ma, mes. your: ton, ta, tes. his or her: son, sa, ses. our: notre, nos. your (plural or formal): votre, vos. their: leur, leurs.", caption: "possessive adjectives match the noun owned", subjects: FR,
  concepts: ["possessive adjective", "possessive"], avoid: ["possessive pronoun", "emphatic", "perfect", "imperfect", "future", "preposition", "relative"], doesNotShow: "mon, ton, son before a feminine noun starting with a vowel (mon amie); possessive pronouns",
  body: possTable("possessive adjectives", ["", "masculine", "feminine", "plural"], [["my", "mon", "ma", "mes"], ["your", "ton", "ta", "tes"], ["his / her", "son", "sa", "ses"], ["our", "notre", "notre", "nos"], ["your (pl.)", "votre", "votre", "vos"], ["their", "leur", "leur", "leurs"]], [100, 152, 204]) + cap("the word matches the noun owned", 165, 44),
  evidence: "French adjectifs possessifs: mon/ma/mes, ton/ta/tes, son/sa/ses, notre/nos, votre/vos, leur/leurs. Oak keyword 'possessive adjective'; KS2/KS3 lessons 'mon, ma and ton, ta'." }));
TBL.push(mk({ id: "es-possessive", title: "Spanish possessive adjectives", alt: "Spanish possessive adjectives by owner. my: mi, mis. your: tu, tus. his, her, your (formal), their: su, sus. our: nuestro, nuestra, nuestros, nuestras. your (plural informal): vuestro, vuestra, vuestros, vuestras.", caption: "possessive adjectives match the noun owned", subjects: ES,
  concepts: ["possessive adjective", "possessive"], avoid: ["possessive pronoun", "and pronoun", "adjectives and pronoun", "el nuestro", "el vuestro", "=mío", "=mía", "=tuyo", "=tuya", "=suyo", "=suya", "long form", "emphatic", "de quién", "preterite", "imperfect", "future", "preposition"], doesNotShow: "long forms after the noun (mío, tuyo), possessive pronouns (el nuestro)",
  body: T(120, 17, "possessive adjectives", "m", "tb") + table([{ x: 8, align: "l", cls: "ts tm" }, { x: 112, align: "m" }, { x: 184, align: "m" }], ["", "singular noun", "plural noun"], [["my", "mi", "mis"], ["your", "tu", "tus"], ["his / her / their", "su", "sus"], ["our", "nuestro/a", "nuestros/as"], ["your (pl.)", "vuestro/a", "vuestros/as"]], 38, 19) + cap("the word matches the noun owned", 165, 44),
  evidence: "Spanish adjetivos posesivos: mi/mis, tu/tus, su/sus, nuestro/a/os/as, vuestro/a/os/as. Oak keyword 'possessive adjective'; Oak KS3 'nuestro', 'vuestro'." }));
TBL.push(mk({ id: "de-possessive", title: "German possessive adjectives (nominative)", alt: "German possessive adjectives in the nominative case, by owner. my: mein, meine. your: dein, deine. his: sein, seine. her: ihr, ihre. our: unser, unsere. your (plural): euer, eure.", caption: "mein / meine: the ending matches the noun", subjects: DE,
  concepts: ["possessive adjective", "possessive"], avoid: ["accusative", "dative", "genitive", "=case", "=cases", "=meinen", "=meinem", "=meiner", "possessive pronoun", "preposition", "perfect", "imperfect"], doesNotShow: "the accusative and dative endings (meinen, meinem), possessive pronouns",
  body: possTable("possessive adjectives", ["", "masc. / neut.", "fem. / plural"], [["my", "mein", "meine"], ["your", "dein", "deine"], ["his", "sein", "seine"], ["her", "ihr", "ihre"], ["our", "unser", "unsere"], ["your (pl.)", "euer", "eure"]], [112, 190, 0]) + cap("add -e for feminine and plural", 165, 44),
  evidence: "German Possessivartikel (Nominativ): mein/meine, dein/deine, sein/seine, ihr/ihre, unser/unsere, euer/eure. Oak keyword 'possessive adjective | describes who possesses a noun, e.g. mein Bruder'; KS3 'mein, dein, sein, ihr (nominative)'." }));
const agree = (title: string, cells: [string, string][], cap0: string) => {
  let s = T(120, 17, title, "m", "tb");
  cells.forEach(([a, b], i) => { const col = i % 2, r = Math.floor(i / 2); const x = 12 + col * 112, y = 32 + r * 54; s += rect(x, y, 104, 46, ["l f1", "l f4", "l f1", "l f4"][i], 6) + T(x + 52, y + 21, a, "m", "tb") + T(x + 52, y + 38, b, "m", "ts tm"); });
  return s + cap(cap0, 160, 44);
};
const AGR_AVOID = ["ending in", "end in", "endings in", "irregular", "position", "before the noun", "prenominal", "comparative", "superlative", "invariable", "colour", "past participle", "participle", "perfect", "demonstrative", "possessive"];
TBL.push(mk({ id: "fr-adjective-agreement", title: "French adjective agreement", alt: "French adjective agreement with grand: masculine singular grand, feminine singular grande, masculine plural grands, feminine plural grandes. The adjective takes -e for feminine and -s for plural.", caption: "adjectives agree with the noun: +e feminine, +s plural", subjects: FR,
  concepts: ["adjective agreement", "adjectival agreement"], avoid: [...AGR_AVOID, "-eux", "-if", "-el", "=beau", "=vieux", "=nouveau"], doesNotShow: "adjectives that end in -e (no change), irregular feminines (-eux/-euse, -if/-ive), adjective position",
  body: agree("adjective agreement", [["grand", "masculine singular"], ["grande", "feminine singular"], ["grands", "masculine plural"], ["grandes", "feminine plural"]], "feminine: add -e · plural: add -s"),
  evidence: "French accord de l'adjectif with a regular adjective (grand): m.sg grand, f.sg grande, m.pl grands, f.pl grandes. Oak keyword 'adjective agreement | when the ending of an adjective matches the noun it describes in gender and number'." }));
TBL.push(mk({ id: "es-adjective-agreement", title: "Spanish adjective agreement", alt: "Spanish adjective agreement with alto: masculine singular alto, feminine singular alta, masculine plural altos, feminine plural altas. The ending -o changes to -a for feminine and gains -s for plural.", caption: "adjectives agree with the noun: -o / -a, +s plural", subjects: ES,
  concepts: ["adjective agreement", "adjectival agreement"], avoid: [...AGR_AVOID, "=bueno", "=malo", "=grande"], doesNotShow: "adjectives that do not end in -o (grande, feliz, fácil), position before the noun, shortened forms (buen, gran)",
  body: agree("adjective agreement", [["alto", "masculine singular"], ["alta", "feminine singular"], ["altos", "masculine plural"], ["altas", "feminine plural"]], "-o → -a for feminine · add -s for plural"),
  evidence: "Spanish concordancia del adjetivo with an adjective in -o (alto): m.sg alto, f.sg alta, m.pl altos, f.pl altas. Oak keyword 'adjective agreement'." }));

// ── numbers / days / months / seasons / colours / accents / clock ──────────────
const numbers1_12: Record<Lang, string[]> = {
  fr: ["un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix", "onze", "douze"],
  es: ["uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez", "once", "doce"],
  de: ["eins", "zwei", "drei", "vier", "fünf", "sechs", "sieben", "acht", "neun", "zehn", "elf", "zwölf"],
};
const numbers13_31: Record<Lang, string[]> = {
  fr: ["treize", "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf", "vingt", "vingt-et-un", "vingt-deux", "vingt-trois", "vingt-quatre", "vingt-cinq", "vingt-six", "vingt-sept", "vingt-huit", "vingt-neuf", "trente", "trente-et-un"],
  es: ["trece", "catorce", "quince", "dieciséis", "diecisiete", "dieciocho", "diecinueve", "veinte", "veintiuno", "veintidós", "veintitrés", "veinticuatro", "veinticinco", "veintiséis", "veintisiete", "veintiocho", "veintinueve", "treinta", "treinta y uno"],
  de: ["dreizehn", "vierzehn", "fünfzehn", "sechzehn", "siebzehn", "achtzehn", "neunzehn", "zwanzig", "einundzwanzig", "zweiundzwanzig", "dreiundzwanzig", "vierundzwanzig", "fünfundzwanzig", "sechsundzwanzig", "siebenundzwanzig", "achtundzwanzig", "neunundzwanzig", "dreißig", "einunddreißig"],
};
const VOCAB: Pic[] = [];
LANGS.forEach((l) => {
  const w = numbers1_12[l];
  let s = T(120, 15, "numbers 1–12", "m", "tb");
  w.forEach((word, i) => { const col = i % 3, r = Math.floor(i / 3); const x = 6 + col * 78, y = 28 + r * 30; s += rect(x, y, 74, 26, "l f1", 5) + T(x + 22, y + 17, String(i + 1), "r", "tr") + T(x + 28, y + 17, word, "l", "ts"); });
  VOCAB.push(mk({ id: `${l}-numbers-1-12`, title: `${LANGNAME[l]} numbers 1 to 12`, alt: `The ${LANGNAME[l]} numbers 1 to 12: ${w.map((x, i) => `${i + 1} ${x}`).join(", ")}.`, caption: `${LANGNAME[l]} numbers 1–12`, subjects: LANGSUBJ[l],
    concepts: ["numbers 1 12", "numbers 1 to 12", "numbers to 12", "numbers 0 12"], avoid: ["numbers 1 31", "numbers 13", "numbers 17", "numbers 32", "numbers 70", "numbers 1 6", "large numbers", "ordinal", "cardinal", "numbers to 31"], doesNotShow: "numbers above 12, zero, the grammar of numbers (agreement, plural nouns)",
    body: s + cap("the numbers one to twelve", 165, 44), evidence: `${LANGNAME[l]} numerals 1–12 (${w.join(", ")}): standard spelling, cross-checked in Oak lesson text. Shown only for the exact lesson topic 'numbers 1-12'.` }));
  const w2 = numbers13_31[l];
  let s2 = T(120, 13, "numbers 13–31", "m", "tb");
  w2.slice(0, 8).forEach((word, i) => { const y = 30 + i * 16; s2 += T(24, y, String(13 + i), "r", "tr ts") + T(30, y, word, "l", "ts"); });
  w2.slice(8).forEach((word, i) => { const y = 30 + i * 13.6; s2 += T(110, y, String(21 + i), "r", "tr ts") + T(116, y, word, "l", "ts"); });
  VOCAB.push(mk({ id: `${l}-numbers-13-31`, title: `${LANGNAME[l]} numbers 13 to 31`, alt: `The ${LANGNAME[l]} numbers 13 to 31: ${w2.map((x, i) => `${13 + i} ${x}`).join(", ")}.`, caption: `${LANGNAME[l]} numbers 13–31`, subjects: LANGSUBJ[l],
    concepts: ["numbers 13 31", "numbers 13 to 31", "numbers 17 31", "numbers 13 20", "numbers 1 31", "numbers 1 to 31", "numbers to 31"], avoid: ["numbers 1 12", "numbers 32", "numbers 70", "numbers 1 6", "large numbers", "ordinal", "cardinal", "dates", "months", "birthday"], doesNotShow: "numbers above 31, the grammar of numbers",
    body: s2, evidence: `${LANGNAME[l]} numerals 13–31 (${w2.join(", ")}). Oak text spells French 'vingt-et-un', 'trente-et-un' with hyphens; Spanish 'veintiuno', 'treinta y uno'; German 'einunddreißig'. Cross-checked in Oak lesson text.` }));
});
const days: Record<Lang, [string, string][]> = {
  fr: [["lundi", "Monday"], ["mardi", "Tuesday"], ["mercredi", "Wednesday"], ["jeudi", "Thursday"], ["vendredi", "Friday"], ["samedi", "Saturday"], ["dimanche", "Sunday"]],
  es: [["lunes", "Monday"], ["martes", "Tuesday"], ["miércoles", "Wednesday"], ["jueves", "Thursday"], ["viernes", "Friday"], ["sábado", "Saturday"], ["domingo", "Sunday"]],
  de: [["Montag", "Monday"], ["Dienstag", "Tuesday"], ["Mittwoch", "Wednesday"], ["Donnerstag", "Thursday"], ["Freitag", "Friday"], ["Samstag", "Saturday"], ["Sonntag", "Sunday"]],
};
const months: Record<Lang, [string, string][]> = {
  fr: [["janvier", "January"], ["février", "February"], ["mars", "March"], ["avril", "April"], ["mai", "May"], ["juin", "June"], ["juillet", "July"], ["août", "August"], ["septembre", "September"], ["octobre", "October"], ["novembre", "November"], ["décembre", "December"]],
  es: [["enero", "January"], ["febrero", "February"], ["marzo", "March"], ["abril", "April"], ["mayo", "May"], ["junio", "June"], ["julio", "July"], ["agosto", "August"], ["septiembre", "September"], ["octubre", "October"], ["noviembre", "November"], ["diciembre", "December"]],
  de: [["Januar", "January"], ["Februar", "February"], ["März", "March"], ["April", "April"], ["Mai", "May"], ["Juni", "June"], ["Juli", "July"], ["August", "August"], ["September", "September"], ["Oktober", "October"], ["November", "November"], ["Dezember", "December"]],
};
const seasons: Record<Lang, [string, string][]> = {
  fr: [["le printemps", "spring"], ["l’été", "summer"], ["l’automne", "autumn"], ["l’hiver", "winter"]],
  es: [["la primavera", "spring"], ["el verano", "summer"], ["el otoño", "autumn"], ["el invierno", "winter"]],
  de: [["der Frühling", "spring"], ["der Sommer", "summer"], ["der Herbst", "autumn"], ["der Winter", "winter"]],
};
LANGS.forEach((l) => {
  const d = days[l];
  let s = T(120, 15, "days of the week", "m", "tb");
  d.forEach(([w, e], i) => { const y = 22 + i * 21; s += rect(10, y, 220, 18, i > 4 ? "l f3" : "l f1", 4) + T(20, y + 13, w, "l", "ts") + T(222, y + 13, e, "r", "tx tm"); });
  VOCAB.push(mk({ id: `${l}-days`, title: `${LANGNAME[l]} days of the week`, alt: `The ${LANGNAME[l]} days of the week, Monday first: ${d.map(([w, e]) => `${w} (${e})`).join(", ")}.`, caption: `${LANGNAME[l]} days of the week`, subjects: LANGSUBJ[l],
    concepts: ["days of the week", "day of the week"], avoid: ["days of the month", "in days", "few days", "days ago", "holiday", "birthday", "dates", "months"], doesNotShow: "months, dates, how to say on Monday",
    body: s, evidence: `${LANGNAME[l]} days of the week, Monday first (${d.map(([w]) => w).join(", ")}); weekend (Saturday, Sunday) tinted. Cross-checked in Oak lesson text. Oak KS2 'Days of the week' lessons.` }));
  const m = months[l];
  let s2 = T(120, 14, "months of the year", "m", "tb");
  m.forEach(([w, e], i) => { const col = Math.floor(i / 6), r = i % 6; const x = 6 + col * 118, y = 24 + r * 23; s2 += rect(x, y, 114, 20, "l f2", 4) + T(x + 8, y + 14, w, "l", "ts") + T(x + 108, y + 14, e.slice(0, 3), "r", "tx tm"); });
  VOCAB.push(mk({ id: `${l}-months`, title: `${LANGNAME[l]} months of the year`, alt: `The ${LANGNAME[l]} months of the year, January to December: ${m.map(([w, e]) => `${w} (${e})`).join(", ")}.`, caption: `${LANGNAME[l]} months of the year`, subjects: LANGSUBJ[l],
    concepts: ["months of the year", "month of the year"], avoid: ["days of the week", "in months", "few months", "months ago", "dates", "numbers 1 31"], doesNotShow: "days, dates, how to say in March",
    body: s2, evidence: `${LANGNAME[l]} months of the year (${m.map(([w]) => w).join(", ")}). Cross-checked in Oak lesson text. ${l === "fr" ? "Lower case in French, as Oak says 'months of the year do not use capital letters in French'." : ""}` }));
  const se = seasons[l];
  let s3 = T(120, 17, "the four seasons", "m", "tb");
  const fills = ["l f2", "l f3", "l f4", "l f1"];
  se.forEach(([w, e], i) => { const col = i % 2, r = Math.floor(i / 2); const x = 10 + col * 114, y = 30 + r * 62; s3 += rect(x, y, 106, 54, fills[i], 8) + T(x + 53, y + 24, w, "m", "ts") + T(x + 53, y + 43, e, "m", "tx tm"); });
  VOCAB.push(mk({ id: `${l}-seasons`, title: `${LANGNAME[l]} seasons`, alt: `The four seasons in ${LANGNAME[l]}: ${se.map(([w, e]) => `${w} (${e})`).join(", ")}.`, caption: `${LANGNAME[l]} seasons`, subjects: LANGSUBJ[l],
    concepts: ["seasons", "four seasons", "the seasons"], requires: ["spring", "summer", "autumn", "winter", "weather"], avoid: ["photo", "picture", "palm"], doesNotShow: "weather phrases, months of each season",
    body: s3, evidence: `${LANGNAME[l]} seasons (${se.map(([w]) => w).join(", ")}), order spring, summer, autumn, winter. Cross-checked in Oak lesson text.` }));
});
const COL: Record<Lang, [string, string, string][]> = {
  fr: [["rouge", "red", "#D7263D"], ["bleu", "blue", "#2F6BD8"], ["vert", "green", "#15A05A"], ["jaune", "yellow", "#F5C518"], ["noir", "black", "#111111"], ["blanc", "white", "#FFFFFF"], ["gris", "grey", "#8A8FA0"], ["rose", "pink", "#F78FB3"], ["orange", "orange", "#F28C28"], ["violet", "purple", "#7B4FD0"], ["marron", "brown", "#8B5A2B"]],
  es: [["rojo", "red", "#D7263D"], ["azul", "blue", "#2F6BD8"], ["verde", "green", "#15A05A"], ["amarillo", "yellow", "#F5C518"], ["negro", "black", "#111111"], ["blanco", "white", "#FFFFFF"], ["gris", "grey", "#8A8FA0"], ["rosa", "pink", "#F78FB3"], ["naranja", "orange", "#F28C28"], ["morado", "purple", "#7B4FD0"], ["marrón", "brown", "#8B5A2B"]],
  de: [["rot", "red", "#D7263D"], ["blau", "blue", "#2F6BD8"], ["grün", "green", "#15A05A"], ["gelb", "yellow", "#F5C518"], ["schwarz", "black", "#111111"], ["weiß", "white", "#FFFFFF"], ["grau", "grey", "#8A8FA0"], ["rosa", "pink", "#F78FB3"], ["orange", "orange", "#F28C28"], ["lila", "purple", "#7B4FD0"], ["braun", "brown", "#8B5A2B"]],
};
LANGS.forEach((l) => {
  const c = COL[l];
  let s = T(120, 15, "colours", "m", "tb");
  c.forEach(([w, e, hex], i) => { const col = i % 2, r = Math.floor(i / 2); const x = 8 + col * 118, y = 24 + r * 22; s += `<rect x="${x}" y="${y}" width="16" height="16" rx="3" class="l" style="fill:${hex}"/>` + T(x + 22, y + 12.5, w, "l", "ts") + T(x + 110, y + 12.5, e, "r", "tx tm"); });
  VOCAB.push(mk({ id: `${l}-colours`, title: `${LANGNAME[l]} colours`, alt: `Colour swatches with their ${LANGNAME[l]} names: ${c.map(([w, e]) => `${w} (${e})`).join(", ")}.`, caption: `${LANGNAME[l]} colours (masculine singular forms)`, subjects: LANGSUBJ[l],
    concepts: ["colours", "colour"], avoid: ["agreement", "adjective", "feminine", "plural", "photo", "picture", "colour in", "coloured", "flag", "black history", "the black"], doesNotShow: "feminine and plural forms, shades, how colours agree with nouns",
    body: s + cap("masculine singular forms", 165, 44), evidence: `${LANGNAME[l]} basic colours (${c.map(([w]) => w).join(", ")}) drawn as real colour swatches (masculine singular forms). Cross-checked in Oak lesson text.` }));
});
const accentBody = (rows: [string, string, string?][], title: string, caption: string, lx = 62) => T(120, 17, title, "m", "tb") + rows.map(([a, b, c], i) => { const y = 30 + i * 25; return rect(10, y, 220, 21, "l f1", 5) + T(24, y + 15, a, "l", "tb") + T(lx, y + 15, b, "l", "ts") + (c ? T(226, y + 15, c, "r", "tx tm") : ""); }).join("") + cap(caption, 165, 44);
const ACC: Pic[] = [
  mk({ id: "fr-accents", title: "French accents", alt: "French accents and the letters they sit on: é accent aigu (acute), è accent grave, ê accent circonflexe, ç cédille (cedilla), ë or ï tréma (diaeresis).", caption: "the French accents", subjects: FR,
    concepts: ["accent", "cedilla", "acute accent", "grave accent", "circumflex", "diaeresis"], requires: ["letter", "letters", "cedilla", "cédille", "é", "è", "ê", "ç", "pronunciation", "spelling", "sound"], avoid: ["regional", "your accent", "different accent", "native", "authentic accent", "speak with"], doesNotShow: "how each accent changes the sound",
    body: accentBody([["é", "accent aigu", "acute"], ["è", "accent grave", "grave"], ["ê", "accent circonflexe", "circumflex"], ["ç", "cédille", "cedilla"], ["ë  ï", "tréma", "diaeresis"]], "accents", "letters carry accents in French"), evidence: "French diacritics: é accent aigu, è accent grave, ê accent circonflexe, ç cédille, ë/ï tréma. Oak KS2 text 'Accents can change the pronunciation of a letter in French'; 'The letter ç (c cedilla) makes a soft sound'." }),
  mk({ id: "es-accents", title: "Spanish accents and special characters", alt: "Spanish written marks: á é í ó ú carry a written accent (tilde), ñ is the letter eñe, ü has a diaeresis (güe, güi), and ¿ ? and ¡ ! frame questions and exclamations.", caption: "Spanish accents and special characters", subjects: ES,
    concepts: ["accent", "written accent", "tilde", "acute accent"], requires: ["letter", "letters", "written", "tilde", "á", "é", "í", "ó", "ú", "ñ", "pronunciation", "spelling", "stress", "syllable"], avoid: ["regional", "your accent", "different accent", "native", "authentic accent", "speak with", "penultimate"], doesNotShow: "the stress rules, which words need an accent",
    body: accentBody([["á é í ó ú", "written accent"], ["ñ", "eñe (letter ñ)"], ["ü", "diéresis: güe, güi"], ["¿ … ?", "question marks"], ["¡ … !", "exclamation marks"]], "special characters", "Spanish written marks", 96), evidence: "Spanish ortografía: acento ortográfico (á é í ó ú), ñ (eñe), ü (diéresis), ¿ ? ¡ ! opening and closing question and exclamation marks. Oak KS3 'Any vowel with a written accent is stressed'." }),
  mk({ id: "de-umlauts", title: "German umlauts and Eszett", alt: "German special letters: ä, ö and ü are umlaut letters, and ß is the Eszett (also called scharfes S), a sharp s.", caption: "umlauts and Eszett", subjects: DE,
    concepts: ["umlaut", "eszett", "scharfes s"], avoid: ["plural", "comparative", "stem", "vowel change", "adding umlaut"], doesNotShow: "the pronunciation of umlauts, when ß or ss is written",
    body: accentBody([["ä", "a-Umlaut", "Bär"], ["ö", "o-Umlaut", "schön"], ["ü", "u-Umlaut", "Tür"], ["ß", "Eszett (scharfes S)", "Straße"]], "umlauts and Eszett", "special German letters"), evidence: "German Sonderzeichen: ä, ö, ü (Umlaute) and ß (Eszett, scharfes S); examples Bär, schön, Tür, Straße." }),
];
VOCAB.push(...ACC);
// telling the time: four clocks at the quarter hours, drawn exactly
function clock(cx: number, cy: number, r: number, hour: number, min: number): string {
  let s = circ(cx, cy, r, "l f0");
  for (let h = 0; h < 12; h++) { const a = 90 - h * 30; const p1 = pt(cx, cy, r - 3.2, a), p2 = pt(cx, cy, r, a); s += ln(p1[0], p1[1], p2[0], p2[1], "th2"); }
  const ma = 90 - min * 6, ha = 90 - ((hour % 12) * 30 + min * 0.5);
  const hp = pt(cx, cy, r * 0.5, ha), mp = pt(cx, cy, r * 0.78, ma);
  return s + ln(cx, cy, hp[0], hp[1], "l") + ln(cx, cy, mp[0], mp[1], "a") + dot(cx, cy, 2);
}
const CLOCKTXT: Record<Lang, string[]> = {
  fr: ["Il est trois heures.", "Il est trois heures et quart.", "Il est trois heures et demie.", "Il est quatre heures moins le quart."],
  es: ["Son las tres.", "Son las tres y cuarto.", "Son las tres y media.", "Son las cuatro menos cuarto."],
  de: ["Es ist drei Uhr.", "Es ist Viertel nach drei.", "Es ist halb vier.", "Es ist Viertel vor vier."],
};
LANGS.forEach((l) => {
  const t = CLOCKTXT[l];
  const times: [number, number][] = [[3, 0], [3, 15], [3, 30], [3, 45]];
  let s = T(120, 13, "telling the time", "m", "tb");
  times.forEach(([h, m], i) => { const cy = 42 + i * 34; s += clock(24, cy, 15, h, m) + T(46, cy - 3, [[`${h}:${String(m).padStart(2, "0")}`, "tr"]], "l", "ts") + T(46, cy + 10, t[i], "l", "ts"); });
  VOCAB.push(mk({ id: `${l}-telling-time`, title: `${LANGNAME[l]}: telling the time`, alt: `Four clock faces showing 3:00, 3:15, 3:30 and 3:45 with the ${LANGNAME[l]} sentences: ${t.join(" ")}`, caption: `${LANGNAME[l]}: telling the time`, subjects: LANGSUBJ[l],
    concepts: ["telling the time", "tell the time"], requires: ["hour", "hours", "heure", "hora", "uhr", "clock", "minutes", "half past", "quarter", "clock"], avoid: ["24 hour", "twenty four", "12 hour", "in time", "at the time", "time phrase", "time expression", "time adverb", "time manner", "time of day", "past tense", "spend time", "free time", "on time", "minutes past", "minutes to", "digital"], doesNotShow: "minutes other than the quarter hours, 24-hour times, am and pm",
    body: s, evidence: `${LANGNAME[l]} clock times drawn exactly (the hour hand moves with the minutes): ${({ fr: "Il est trois heures / et quart / et demie / quatre heures moins le quart", es: "Son las tres / y cuarto / y media / las cuatro menos cuarto", de: "Es ist drei Uhr / Viertel nach drei / halb vier (= 3:30, NOT 4:30) / Viertel vor vier" })[l]}. Standard usage; Oak lessons 'telling the time'.` }));
});


// ── the infinitive and the (regular) past participle ────────────────────────
const INF: Record<Lang, [string, string, string][]> = {
  fr: [["parl", "er", "to speak"], ["fin", "ir", "to finish"], ["vend", "re", "to sell"]],
  es: [["habl", "ar", "to speak"], ["com", "er", "to eat"], ["viv", "ir", "to live"]],
  de: [["spiel", "en", "to play"], ["mach", "en", "to do / to make"], ["lern", "en", "to learn"]],
};
const PART: Record<Lang, [string, string, string][]> = {
  fr: [["parler", "parlé", "-er → -é"], ["finir", "fini", "-ir → -i"], ["vendre", "vendu", "-re → -u"]],
  es: [["hablar", "hablado", "-ar → -ado"], ["comer", "comido", "-er → -ido"], ["vivir", "vivido", "-ir → -ido"]],
  de: [["spielen", "gespielt", "weak"], ["machen", "gemacht", "weak"], ["fahren", "gefahren", "strong"]],
};
LANGS.forEach((l) => {
  const rows = INF[l];
  let s = T(120, 17, "the infinitive", "m", "tb") + T(120, 33, "the dictionary form of a verb (examples)", "m", "ts tm");
  rows.forEach(([stem, end, en], i) => { const y = 62 + i * 30; s += rect(12, y - 18, 216, 26, "l f1", 6) + T(26, y, [[stem], [end, "tr"]], "l", "") + T(226, y, en, "r", "ts tm"); });
  VOCAB.push(mk({ id: `${l}-infinitive`, title: `${LANGNAME[l]} infinitive`, alt: `The ${LANGNAME[l]} infinitive is the dictionary form of a verb. Examples with the ending highlighted: ${rows.map(([a, b, e]) => `${a}${b} (${e})`).join(", ")}.`, caption: `the ${LANGNAME[l]} infinitive`, subjects: LANGSUBJ[l],
    concepts: ["infinitive"], avoid: ["infinitive as noun", "infinitives as nouns", "nominalis", "past infinitive", "=zu", "=pour", "=sans", "=beim", "=um", "=ohne"], doesNotShow: "irregular infinitives, how the infinitive is used with other verbs",
    body: s + cap("the form you find in the dictionary", 165, 44), evidence: `${LANGNAME[l]} infinitive = the dictionary form: ${rows.map(([a, b]) => `${a}${b}`).join(", ")} (examples). Oak keyword 'infinitive | the dictionary form of a verb'.` }));
  const pr = PART[l];
  let s2 = T(120, 17, "the past participle", "m", "tb") + T(120, 33, l === "de" ? "weak and strong verbs (examples)" : "regular verbs (examples)", "m", "ts tm");
  pr.forEach(([a, b, r], i) => { const y = 62 + i * 30; s2 += rect(12, y - 18, 216, 26, "l f2", 6) + T(22, y, a, "l", "ts") + T(84, y, "→", "m", "ts tm") + T(96, y, b, "l", "tr") + T(226, y, r, "r", "tx tm"); });
  VOCAB.push(mk({ id: `${l}-past-participle`, title: `${LANGNAME[l]} past participle (${l === "de" ? "weak and strong" : "regular"})`, alt: `${l === "de" ? "German weak and strong" : "Regular " + LANGNAME[l]} past participles: ${pr.map(([a, b, r]) => `${a} becomes ${b} (${r})`).join("; ")}.`, caption: `regular ${LANGNAME[l]} past participles`, subjects: LANGSUBJ[l],
    concepts: ["past participle"], avoid: ["irregular", "separable", "inseparable", "agreement", "agree", "=être", "=pris", "=fait", "=dit", "=bu", "prefix", "-ieren", "gerund", "present participle"], doesNotShow: "irregular participles, agreement of participles, separable / inseparable verbs",
    body: s2 + cap(l === "de" ? "weak: ge- … -t · strong: ge- … -en" : "examples of regular past participles", 165, 44), evidence: `${LANGNAME[l]} regular past participles (${pr.map(([a, b]) => `${a} → ${b}`).join(", ")}). Standard grammar; Oak keyword 'past participle | the form of a verb used in the past (perfect) tense'.` }));
});

// ── flags (fixed official colours; simplified: no coat of arms) ─────────────────
const HISTORY = ["ww2", "wwii", "world war", "=war", "occupied", "occupation", "divided", "division", "empire", "reich", "nazi", "gdr", "east germany", "west germany", "berlin wall", "history", "historical", "colonial", "colony", "revolution", "medieval", "=past", "slavery", "independence"];
const COUNTRIES: Record<string, string[]> = {
  haiti: ["haiti", "haïti", "haitian"], mexico: ["mexico", "méxico", "mexique", "mexiko", "mexican"], peru: ["peru", "perú", "pérou", "peruvian"], chile: ["chile", "chili", "chilean"], senegal: ["senegal", "sénégal", "senegalese"], morocco: ["morocco", "maroc", "marruecos", "marokko", "moroccan"],
  france: ["france", "frankreich", "francia"], spain: ["spain", "spanien", "españa", "espana", "espagne"], germany: ["germany", "deutschland", "alemania", "allemagne"],
  other: ["cuba", "argentina", "colombia", "kolumbien", "colombie", "guatemala", "ecuador", "venezuela", "bolivia", "paraguay", "uruguay", "costa rica", "honduras", "nicaragua", "panama", "el salvador", "dominican", "puerto rico", "equatorial guinea", "algeria", "algérie", "tunisia", "tunisie", "canada", "quebec", "québec", "belgium", "belgique", "belgien", "switzerland", "suisse", "schweiz", "austria", "österreich", "luxembourg", "england", "britain", "united kingdom", "=uk", "ireland", "scotland", "wales", "=usa", "america", "united states", "italy", "portugal", "poland", "turkey", "syria", "china", "india", "japan", "russia", "ukraine", "netherlands", "holland", "denmark", "sweden", "norway", "finland", "greece", "egypt", "kenya", "nigeria", "ghana", "martinique", "guadeloupe", "cameroon", "ivory coast", "namibia", "madagascar", "spanish-speaking", "spanish speaking", "french-speaking", "french speaking", "german-speaking", "german speaking", "francophone", "hispanic", "latin america", "caribbean", "europe", "africa", "world", "countries", "country"],
};
const FX = 45, FY = 32, FW = 150, FH = 100;
const fr = (x: number, y: number, w: number, h: number, fill: string) => `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="${fill}"/>`;
const flagFrame = () => `<rect x="${FX}" y="${FY}" width="${FW}" height="${FH}" class="l" style="fill:none"/>`;
const bands = (dir: "v" | "h", cols: string[]) => cols.map((c, i) => (dir === "v" ? fr(FX + (FW / cols.length) * i, FY, FW / cols.length, FH, c) : fr(FX, FY + (FH / cols.length) * i, FW, FH / cols.length, c))).join("");
const star = (cx: number, cy: number, R: number, fill: string, rot = 90) => { const r = R * 0.381966; const pts: string[] = []; for (let i = 0; i < 10; i++) { const a = rot - i * 36, rr = i % 2 ? r : R; const p = pt(cx, cy, rr, a); pts.push(`${n(p[0])},${n(p[1])}`); } return `<polygon points="${pts.join(" ")}" fill="${fill}"/>`; };
const pentagram = (cx: number, cy: number, R: number, stroke: string) => { const p = [0, 1, 2, 3, 4].map((i) => pt(cx, cy, R, 90 - i * 72)); const order = [0, 2, 4, 1, 3, 0]; return `<polyline points="${order.map((i) => `${n(p[i][0])},${n(p[i][1])}`).join(" ")}" fill="none" stroke="${stroke}" stroke-width="3" stroke-linejoin="miter"/>`; };
const flag = (key: string, id: string, title: string, concepts: string[], body: string, alt: string, caption: string, evidence: string): Pic => {
  const own = new Set(COUNTRIES[key]);
  const others = Object.entries(COUNTRIES).flatMap(([k, v]) => (k === key ? [] : v)).filter((c) => !own.has(c));
  return { id, title, alt, caption, subjects: ["French", "Spanish", "German"], concepts, avoid: [...HISTORY, ...others], doesNotShow: "the country's coat of arms or any other symbol; not the language itself", evidence, svg: svg(W, H, body + flagFrame()) };
};
export const EXT_FLAGS: Pic[] = [
  flag("haiti", "flag-haiti", "Flag of Haiti (civil flag)", ["haiti", "haïti"], bands("h", ["#00209F", "#D21034"]), "The civil flag of Haiti: two equal horizontal stripes, blue above red; the coat of arms of the state flag is left out.", "The flag of Haiti (civil flag, no coat of arms)", "Haiti civil flag: horizontal bicolour, blue (top) and red (bottom), equal halves. The state flag adds a white panel with the coat of arms, omitted here."),
  flag("mexico", "flag-mexico", "Flag of Mexico (simplified)", ["mexico", "méxico", "mexique", "mexiko"], bands("v", ["#006847", "#FFFFFF", "#CE1126"]), "The flag of Mexico without its coat of arms: three equal vertical stripes, green, white and red.", "The flag of Mexico (simplified: no coat of arms)", "Mexico: vertical tricolour green, white, red, equal thirds. The coat of arms (eagle on a cactus) in the white stripe is omitted (simplified)."),
  flag("peru", "flag-peru", "Flag of Peru", ["peru", "perú", "pérou"], bands("v", ["#D91023", "#FFFFFF", "#D91023"]), "The flag of Peru: three equal vertical stripes, red, white and red.", "The flag of Peru", "Peru national (civil) flag: vertical red-white-red, equal thirds; the state flag adds the coat of arms, omitted here."),
  flag("chile", "flag-chile", "Flag of Chile", ["chile", "chili"], fr(FX, FY, FW, FH / 2, "#FFFFFF") + fr(FX, FY + FH / 2, FW, FH / 2, "#D52B1E") + fr(FX, FY, FH / 2, FH / 2, "#0039A6") + star(FX + FH / 4, FY + FH / 4, 16, "#FFFFFF"), "The flag of Chile: a blue square with a white five-pointed star in the top left corner, white to its right, and a red stripe across the bottom half.", "The flag of Chile", "Chile: top half white with a blue square canton (side = half the flag height) holding a white five-pointed star; bottom half red (Chilean flag specification)."),
  flag("senegal", "flag-senegal", "Flag of Senegal", ["senegal", "sénégal"], bands("v", ["#00853F", "#FDEF42", "#E31B23"]) + star(FX + FW / 2, FY + FH / 2 + 2, 20, "#00853F"), "The flag of Senegal: three equal vertical stripes, green, yellow and red, with a green five-pointed star in the middle of the yellow stripe.", "The flag of Senegal", "Senegal: vertical tricolour green, yellow, red with a green five-pointed star centred in the yellow stripe."),
  flag("morocco", "flag-morocco", "Flag of Morocco", ["morocco", "maroc", "marruecos", "marokko"], fr(FX, FY, FW, FH, "#C1272D") + pentagram(FX + FW / 2, FY + FH / 2 + 1, 27, "#006233"), "The flag of Morocco: a red flag with a green five-pointed star drawn as an outline (a pentagram) in the centre.", "The flag of Morocco", "Morocco: red field with a green pentagram (five-pointed star outline) in the centre."),
];

export const EXT_LANG_PICS: Pic[] = [...VERB_TABLES, ...REGULAR_VERBS, ...TENSE_TABLES, ...TWOCOL, ...FRAMES, ...TBL, ...VOCAB, ...EXT_FLAGS];
