// Self-test for conjugate.ts — every expected form is written by hand. Run:
//   server/node_modules/.bin/tsx features/learninghub/tools/languages/verbs/conjugate.selftest.ts   (exit 1 on failure)
import { conjugate, answerVariants, supports, TENSES, PERSONS, VERBS, THEMES, withSubject, type Lang } from "./conjugate";

let n = 0; const fails: string[] = [];
const eq = (label: string, got: unknown, want: unknown) => { n++; const a = JSON.stringify(got), b = JSON.stringify(want); if (a !== b) fails.push(`${label}: got ${a}, want ${b}`); };
/** All six persons, canonical form (first alternative). */
const table = (lang: Lang, verb: string, tense: string, want: string[]) => want.forEach((f, p) => eq(`${lang} ${verb} ${tense} ${PERSONS[lang][p]}`, conjugate(lang, verb, tense, p)[0], f));
/** One person: the accepted list must contain this form. */
const has = (lang: Lang, verb: string, tense: string, p: number, form: string) => { n++; const g = conjugate(lang, verb, tense, p); if (!g.includes(form)) fails.push(`${lang} ${verb} ${tense} p${p}: ${JSON.stringify(g)} lacks "${form}"`); };
const one = (lang: Lang, verb: string, tense: string, p: number, form: string) => eq(`${lang} ${verb} ${tense} p${p}`, conjugate(lang, verb, tense, p)[0], form);

// ── Spanish present ──
table("es", "hablar", "present", ["hablo", "hablas", "habla", "hablamos", "habláis", "hablan"]);
table("es", "comer", "present", ["como", "comes", "come", "comemos", "coméis", "comen"]);
table("es", "vivir", "present", ["vivo", "vives", "vive", "vivimos", "vivís", "viven"]);
table("es", "ser", "present", ["soy", "eres", "es", "somos", "sois", "son"]);
table("es", "estar", "present", ["estoy", "estás", "está", "estamos", "estáis", "están"]);
table("es", "tener", "present", ["tengo", "tienes", "tiene", "tenemos", "tenéis", "tienen"]);
table("es", "ir", "present", ["voy", "vas", "va", "vamos", "vais", "van"]);
table("es", "querer", "present", ["quiero", "quieres", "quiere", "queremos", "queréis", "quieren"]);
table("es", "poder", "present", ["puedo", "puedes", "puede", "podemos", "podéis", "pueden"]);
table("es", "pedir", "present", ["pido", "pides", "pide", "pedimos", "pedís", "piden"]);
table("es", "jugar", "present", ["juego", "juegas", "juega", "jugamos", "jugáis", "juegan"]);
table("es", "hacer", "present", ["hago", "haces", "hace", "hacemos", "hacéis", "hacen"]);
one("es", "decir", "present", 0, "digo"); one("es", "decir", "present", 3, "decimos"); one("es", "decir", "present", 5, "dicen");
one("es", "venir", "present", 0, "vengo"); one("es", "venir", "present", 2, "viene");
one("es", "dormir", "present", 0, "duermo"); one("es", "dormir", "present", 3, "dormimos");
one("es", "empezar", "present", 1, "empiezas"); one("es", "preferir", "present", 5, "prefieren");
one("es", "saber", "present", 0, "sé"); one("es", "conocer", "present", 0, "conozco"); one("es", "seguir", "present", 0, "sigo");
one("es", "oír", "present", 0, "oigo"); one("es", "dar", "present", 0, "doy"); one("es", "ver", "present", 3, "vemos");
// ── Spanish reflexive ──
table("es", "levantarse", "present", ["me levanto", "te levantas", "se levanta", "nos levantamos", "os levantáis", "se levantan"]);
one("es", "acostarse", "present", 0, "me acuesto"); one("es", "vestirse", "present", 2, "se viste"); one("es", "llamarse", "present", 0, "me llamo");
has("es", "levantarse", "futuro_proximo", 0, "me voy a levantar"); has("es", "levantarse", "futuro_proximo", 0, "voy a levantarme");
one("es", "levantarse", "preterito", 0, "me levanté");
// ── Spanish pretérito ──
table("es", "hablar", "preterito", ["hablé", "hablaste", "habló", "hablamos", "hablasteis", "hablaron"]);
table("es", "comer", "preterito", ["comí", "comiste", "comió", "comimos", "comisteis", "comieron"]);
table("es", "ir", "preterito", ["fui", "fuiste", "fue", "fuimos", "fuisteis", "fueron"]);
table("es", "ser", "preterito", ["fui", "fuiste", "fue", "fuimos", "fuisteis", "fueron"]);
table("es", "hacer", "preterito", ["hice", "hiciste", "hizo", "hicimos", "hicisteis", "hicieron"]);
table("es", "tener", "preterito", ["tuve", "tuviste", "tuvo", "tuvimos", "tuvisteis", "tuvieron"]);
table("es", "decir", "preterito", ["dije", "dijiste", "dijo", "dijimos", "dijisteis", "dijeron"]);
one("es", "jugar", "preterito", 0, "jugué"); one("es", "buscar", "preterito", 0, "busqué"); one("es", "empezar", "preterito", 0, "empecé"); one("es", "llegar", "preterito", 0, "llegué");
one("es", "dormir", "preterito", 2, "durmió"); one("es", "pedir", "preterito", 5, "pidieron"); one("es", "leer", "preterito", 2, "leyó"); one("es", "leer", "preterito", 0, "leí");
one("es", "ver", "preterito", 0, "vi"); one("es", "dar", "preterito", 2, "dio"); one("es", "estar", "preterito", 0, "estuve");
// ── Spanish other tenses ──
table("es", "hablar", "imperfecto", ["hablaba", "hablabas", "hablaba", "hablábamos", "hablabais", "hablaban"]);
table("es", "comer", "imperfecto", ["comía", "comías", "comía", "comíamos", "comíais", "comían"]);
table("es", "ser", "imperfecto", ["era", "eras", "era", "éramos", "erais", "eran"]);
table("es", "ir", "imperfecto", ["iba", "ibas", "iba", "íbamos", "ibais", "iban"]);
one("es", "ver", "imperfecto", 0, "veía");
table("es", "hablar", "futuro_proximo", ["voy a hablar", "vas a hablar", "va a hablar", "vamos a hablar", "vais a hablar", "van a hablar"]);
table("es", "hablar", "futuro_simple", ["hablaré", "hablarás", "hablará", "hablaremos", "hablaréis", "hablarán"]);
table("es", "tener", "futuro_simple", ["tendré", "tendrás", "tendrá", "tendremos", "tendréis", "tendrán"]);
one("es", "hacer", "futuro_simple", 0, "haré"); one("es", "decir", "futuro_simple", 2, "dirá"); one("es", "poder", "futuro_simple", 0, "podré"); one("es", "salir", "futuro_simple", 0, "saldré");
table("es", "hablar", "condicional", ["hablaría", "hablarías", "hablaría", "hablaríamos", "hablaríais", "hablarían"]);
one("es", "querer", "condicional", 0, "querría"); one("es", "poner", "condicional", 3, "pondríamos");

// ── French present ──
table("fr", "parler", "present", ["parle", "parles", "parle", "parlons", "parlez", "parlent"]);
table("fr", "finir", "present", ["finis", "finis", "finit", "finissons", "finissez", "finissent"]);
table("fr", "vendre", "present", ["vends", "vends", "vend", "vendons", "vendez", "vendent"]);
table("fr", "être", "present", ["suis", "es", "est", "sommes", "êtes", "sont"]);
table("fr", "avoir", "present", ["ai", "as", "a", "avons", "avez", "ont"]);
table("fr", "aller", "present", ["vais", "vas", "va", "allons", "allez", "vont"]);
table("fr", "faire", "present", ["fais", "fais", "fait", "faisons", "faites", "font"]);
table("fr", "prendre", "present", ["prends", "prends", "prend", "prenons", "prenez", "prennent"]);
table("fr", "pouvoir", "present", ["peux", "peux", "peut", "pouvons", "pouvez", "peuvent"]);
table("fr", "vouloir", "present", ["veux", "veux", "veut", "voulons", "voulez", "veulent"]);
one("fr", "manger", "present", 3, "mangeons"); one("fr", "commencer", "present", 3, "commençons"); one("fr", "acheter", "present", 0, "achète"); one("fr", "acheter", "present", 3, "achetons");
one("fr", "préférer", "present", 2, "préfère"); one("fr", "préférer", "present", 4, "préférez"); one("fr", "payer", "present", 0, "paie");
one("fr", "venir", "present", 5, "viennent"); one("fr", "voir", "present", 4, "voyez"); one("fr", "dire", "present", 4, "dites"); one("fr", "boire", "present", 3, "buvons");
one("fr", "savoir", "present", 0, "sais"); one("fr", "devoir", "present", 5, "doivent"); one("fr", "ouvrir", "present", 0, "ouvre"); one("fr", "connaître", "present", 2, "connaît");
table("fr", "se lever", "present", ["me lève", "te lèves", "se lève", "nous levons", "vous levez", "se lèvent"]);
one("fr", "s'habiller", "present", 0, "m'habille"); one("fr", "s'habiller", "present", 1, "t'habilles"); one("fr", "s'appeler", "present", 0, "m'appelle"); one("fr", "s'appeler", "present", 3, "nous appelons");
// ── French passé composé ──
one("fr", "parler", "passe_compose", 0, "ai parlé"); one("fr", "finir", "passe_compose", 2, "a fini"); one("fr", "vendre", "passe_compose", 5, "ont vendu");
one("fr", "faire", "passe_compose", 3, "avons fait"); one("fr", "avoir", "passe_compose", 0, "ai eu"); one("fr", "prendre", "passe_compose", 4, "avez pris");
one("fr", "boire", "passe_compose", 1, "as bu"); one("fr", "voir", "passe_compose", 0, "ai vu");
has("fr", "aller", "passe_compose", 0, "suis allé"); has("fr", "aller", "passe_compose", 0, "suis allée"); has("fr", "aller", "passe_compose", 3, "sommes allés");
has("fr", "arriver", "passe_compose", 2, "est arrivée"); has("fr", "venir", "passe_compose", 5, "sont venues");
has("fr", "se lever", "passe_compose", 0, "me suis levé"); has("fr", "se lever", "passe_compose", 2, "s'est levée");
one("fr", "être", "passe_compose", 0, "ai été");
// ── French imparfait / futurs / conditionnel ──
table("fr", "parler", "imparfait", ["parlais", "parlais", "parlait", "parlions", "parliez", "parlaient"]);
table("fr", "être", "imparfait", ["étais", "étais", "était", "étions", "étiez", "étaient"]);
one("fr", "avoir", "imparfait", 0, "avais"); one("fr", "faire", "imparfait", 4, "faisiez"); one("fr", "finir", "imparfait", 0, "finissais"); one("fr", "aller", "imparfait", 2, "allait");
one("fr", "manger", "imparfait", 0, "mangeais"); one("fr", "manger", "imparfait", 3, "mangions"); one("fr", "commencer", "imparfait", 3, "commencions"); one("fr", "commencer", "imparfait", 0, "commençais");
table("fr", "aller", "futur_proche", ["vais aller", "vas aller", "va aller", "allons aller", "allez aller", "vont aller"]);
one("fr", "manger", "futur_proche", 3, "allons manger"); has("fr", "se lever", "futur_proche", 0, "vais me lever");
table("fr", "aller", "futur_simple", ["irai", "iras", "ira", "irons", "irez", "iront"]);
table("fr", "être", "futur_simple", ["serai", "seras", "sera", "serons", "serez", "seront"]);
one("fr", "avoir", "futur_simple", 0, "aurai"); one("fr", "faire", "futur_simple", 2, "fera"); one("fr", "parler", "futur_simple", 0, "parlerai"); one("fr", "vendre", "futur_simple", 3, "vendrons");
one("fr", "pouvoir", "futur_simple", 0, "pourrai"); one("fr", "venir", "futur_simple", 5, "viendront"); one("fr", "voir", "futur_simple", 0, "verrai"); one("fr", "acheter", "futur_simple", 0, "achèterai");
one("fr", "s'appeler", "futur_simple", 0, "m'appellerai"); one("fr", "payer", "futur_simple", 0, "paierai");
table("fr", "parler", "conditionnel", ["parlerais", "parlerais", "parlerait", "parlerions", "parleriez", "parleraient"]);
one("fr", "être", "conditionnel", 0, "serais"); one("fr", "avoir", "conditionnel", 5, "auraient"); one("fr", "vouloir", "conditionnel", 0, "voudrais"); one("fr", "aller", "conditionnel", 3, "irions");
one("fr", "finir", "conditionnel", 2, "finirait");

// ── German present ──
table("de", "spielen", "present", ["spiele", "spielst", "spielt", "spielen", "spielt", "spielen"]);
table("de", "arbeiten", "present", ["arbeite", "arbeitest", "arbeitet", "arbeiten", "arbeitet", "arbeiten"]);
table("de", "fahren", "present", ["fahre", "fährst", "fährt", "fahren", "fahrt", "fahren"]);
table("de", "sehen", "present", ["sehe", "siehst", "sieht", "sehen", "seht", "sehen"]);
table("de", "lesen", "present", ["lese", "liest", "liest", "lesen", "lest", "lesen"]);
table("de", "essen", "present", ["esse", "isst", "isst", "essen", "esst", "essen"]);
table("de", "geben", "present", ["gebe", "gibst", "gibt", "geben", "gebt", "geben"]);
table("de", "nehmen", "present", ["nehme", "nimmst", "nimmt", "nehmen", "nehmt", "nehmen"]);
table("de", "haben", "present", ["habe", "hast", "hat", "haben", "habt", "haben"]);
table("de", "sein", "present", ["bin", "bist", "ist", "sind", "seid", "sind"]);
table("de", "werden", "present", ["werde", "wirst", "wird", "werden", "werdet", "werden"]);
table("de", "können", "present", ["kann", "kannst", "kann", "können", "könnt", "können"]);
table("de", "müssen", "present", ["muss", "musst", "muss", "müssen", "müsst", "müssen"]);
table("de", "wollen", "present", ["will", "willst", "will", "wollen", "wollt", "wollen"]);
table("de", "dürfen", "present", ["darf", "darfst", "darf", "dürfen", "dürft", "dürfen"]);
table("de", "wissen", "present", ["weiß", "weißt", "weiß", "wissen", "wisst", "wissen"]);
one("de", "schlafen", "present", 1, "schläfst"); one("de", "laufen", "present", 2, "läuft"); one("de", "helfen", "present", 1, "hilfst"); one("de", "sprechen", "present", 2, "spricht");
one("de", "halten", "present", 1, "hältst"); one("de", "halten", "present", 2, "hält"); one("de", "finden", "present", 1, "findest"); one("de", "warten", "present", 4, "wartet");
one("de", "tanzen", "present", 1, "tanzt"); one("de", "reisen", "present", 1, "reist"); one("de", "wohnen", "present", 2, "wohnt"); one("de", "lernen", "present", 1, "lernst");
one("de", "öffnen", "present", 2, "öffnet"); one("de", "wandern", "present", 0, "wandere"); one("de", "sammeln", "present", 0, "sammle"); one("de", "kommen", "present", 2, "kommt");
one("de", "möchten", "present", 1, "möchtest"); one("de", "tun", "present", 0, "tue"); one("de", "waschen", "present", 1, "wäschst");
one("de", "aufstehen", "present", 0, "stehe auf"); one("de", "fernsehen", "present", 2, "sieht fern"); one("de", "einkaufen", "present", 3, "kaufen ein");
table("de", "sich waschen", "present", ["wasche mich", "wäschst dich", "wäscht sich", "waschen uns", "wascht euch", "waschen sich"]);
// ── German Perfekt ──
table("de", "spielen", "perfekt", ["habe gespielt", "hast gespielt", "hat gespielt", "haben gespielt", "habt gespielt", "haben gespielt"]);
table("de", "gehen", "perfekt", ["bin gegangen", "bist gegangen", "ist gegangen", "sind gegangen", "seid gegangen", "sind gegangen"]);
one("de", "aufstehen", "perfekt", 0, "bin aufgestanden"); one("de", "ankommen", "perfekt", 2, "ist angekommen"); one("de", "einkaufen", "perfekt", 0, "habe eingekauft");
one("de", "fernsehen", "perfekt", 0, "habe ferngesehen"); one("de", "anrufen", "perfekt", 3, "haben angerufen"); one("de", "aussteigen", "perfekt", 0, "bin ausgestiegen");
one("de", "arbeiten", "perfekt", 0, "habe gearbeitet"); one("de", "essen", "perfekt", 0, "habe gegessen"); one("de", "fahren", "perfekt", 0, "bin gefahren"); one("de", "sein", "perfekt", 0, "bin gewesen");
one("de", "haben", "perfekt", 0, "habe gehabt"); one("de", "besuchen", "perfekt", 0, "habe besucht"); one("de", "studieren", "perfekt", 0, "habe studiert"); one("de", "trinken", "perfekt", 2, "hat getrunken");
one("de", "bleiben", "perfekt", 1, "bist geblieben"); one("de", "sehen", "perfekt", 0, "habe gesehen"); one("de", "wohnen", "perfekt", 2, "hat gewohnt"); one("de", "kaufen", "perfekt", 4, "habt gekauft");
one("de", "sich waschen", "perfekt", 0, "habe mich gewaschen"); one("de", "verstehen", "perfekt", 0, "habe verstanden"); one("de", "schwimmen", "perfekt", 0, "bin geschwommen");
// ── German Präteritum / Futur / Konjunktiv II ──
table("de", "sein", "praeteritum", ["war", "warst", "war", "waren", "wart", "waren"]);
table("de", "haben", "praeteritum", ["hatte", "hattest", "hatte", "hatten", "hattet", "hatten"]);
one("de", "können", "praeteritum", 0, "konnte"); one("de", "müssen", "praeteritum", 3, "mussten"); one("de", "wollen", "praeteritum", 1, "wolltest"); one("de", "dürfen", "praeteritum", 2, "durfte");
one("de", "sollen", "praeteritum", 0, "sollte"); one("de", "mögen", "praeteritum", 0, "mochte");
table("de", "spielen", "futur", ["werde spielen", "wirst spielen", "wird spielen", "werden spielen", "werdet spielen", "werden spielen"]);
one("de", "aufstehen", "futur", 0, "werde aufstehen"); one("de", "sein", "futur", 2, "wird sein");
table("de", "spielen", "konjunktiv2", ["würde spielen", "würdest spielen", "würde spielen", "würden spielen", "würdet spielen", "würden spielen"]);
has("de", "sein", "konjunktiv2", 0, "wäre"); has("de", "haben", "konjunktiv2", 0, "hätte"); has("de", "können", "konjunktiv2", 0, "könnte"); has("de", "sein", "konjunktiv2", 0, "würde sein");

// ── API behaviour ──
eq("supports de spielen praeteritum", supports("de", "spielen", "praeteritum"), false);
eq("supports de sein praeteritum", supports("de", "sein", "praeteritum"), true);
eq("supports de möchten perfekt", supports("de", "möchten", "perfekt"), false);
eq("supports fr parler present", supports("fr", "parler", "present"), true);
eq("bad person", conjugate("fr", "parler", "present", 6), []);
eq("bad tense", conjugate("es", "hablar", "nope", 0), []);
eq("upper-case infinitive accepted", conjugate("es", "Hablar", "present", 0), ["hablo"]);
eq("withSubject fr j'", withSubject("fr", 0, "ai"), "j'ai"); eq("withSubject fr je", withSubject("fr", 0, "parle"), "je parle");
eq("withSubject de", withSubject("de", 3, "haben"), "wir haben"); eq("withSubject es bare", withSubject("es", 0, "hablo"), "hablo");
eq("variants fr j'", answerVariants("fr", 0, ["ai parlé"]), ["ai parlé", "j'ai parlé"]);
eq("variants fr il/elle", answerVariants("fr", 2, ["parle"]), ["parle", "il parle", "elle parle"]);
eq("variants de er/sie/es", answerVariants("de", 2, ["spielt"]), ["spielt", "er spielt", "sie spielt", "es spielt"]);
eq("variants es yo", answerVariants("es", 0, ["hablo"]), ["hablo", "yo hablo"]);
eq("tenses fr count", TENSES.fr.length, 6); eq("tenses es count", TENSES.es.length, 6); eq("tenses de count", TENSES.de.length, 5);
for (const l of ["fr", "es", "de"] as Lang[]) {
  const irr = VERBS[l].filter((v) => v.kind !== "regular").length, reg = VERBS[l].filter((v) => v.kind === "regular").length;
  eq(`${l} irregular/stem lexicon >= 30`, irr >= 30, true); eq(`${l} regular verbs present`, reg >= 10, true); eq(`${l} themes exist`, THEMES[l].length >= 5, true);
  eq(`${l} every verb has english + tier`, VERBS[l].every((v) => v.en && (v.tier === "KS3" || v.tier === "KS4")), true);
  // structural: every listed verb must produce a non-empty present for all six persons, and no accepted form is blank
  eq(`${l} present exists for every verb`, VERBS[l].every((v) => [0, 1, 2, 3, 4, 5].every((p) => (conjugate(l, v.inf, "present", p)[0] ?? "").length > 0)), true);
}
eq("no duplicate infinitives", ["fr", "es", "de"].every((l) => new Set(VERBS[l as Lang].map((v) => v.inf)).size === VERBS[l as Lang].length), true);

console.log(`conjugate.selftest: ${n - fails.length}/${n} checks passed`);
if (fails.length) { console.error(fails.join("\n")); process.exit(1); }
