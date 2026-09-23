// Substitution-table sentence builder (plan L-04): data + logic, PURE. Every combination of chunks in every table is a grammatical sentence
// (options are written pre-agreed), so pupils build, unjumble and translate with confidence. German also has a clause builder + word-order checker
// for verb-second, inversion after a time expression, and verb-at-the-end subordinate clauses (weil / dass / wenn / obwohl).
import { makeRng } from "../../engine/rng";
import { checkText, type TextPolicy } from "../../engine/textmark";
import type { CheckResult } from "../../engine/marking";
import type { Lang } from "../AccentBar";

export interface Chunk { t: string; en: string }
export interface Column { label: string; options: Chunk[] }
export interface SentenceTable { id: string; lang: Lang; title: string; theme: string; columns: Column[]; /** Order the English chunks are read in (German word order differs from English). */ enOrder?: number[]; mode?: "order" }
export type OrderVariant = "main" | "time-front" | "sub-end" | "sub-first";
export interface ClauseSpec { subj: string; fin: string; mid?: string[]; time?: string; tail?: string; prefix?: string; en: string; enTime?: string }
export interface OrderSpec { variant: OrderVariant; main: ClauseSpec; sub?: ClauseSpec; conj?: string }
export interface SentenceItem { target: string; en: string; accepted: string[]; picks: number[]; hint?: string; order?: OrderSpec }

const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);
const lcFirst = (s: string) => (/^I( |')/.test(s) ? s : s ? s[0]!.toLowerCase() + s.slice(1) : s);
const joinT = (parts: string[]) => parts.filter(Boolean).reduce((a, b) => (a.endsWith("'") ? a + b : a ? `${a} ${b}` : b), "");

// ── tables ───────────────────────────────────────────────────────────────────
type Opt = [string, string];
const C = (label: string, opts: Opt[]): Column => ({ label, options: opts.map(([t, en]) => ({ t, en })) });
const T = (id: string, lang: Lang, title: string, theme: string, columns: Column[], enOrder?: number[]): SentenceTable => ({ id, lang, title, theme, columns, enOrder });

export const TABLES: SentenceTable[] = [
  // ── French ──
  T("fr-hobbies", "fr", "Opinions & hobbies", "hobbies", [
    C("Opinion", [["J'aime", "I like"], ["Je n'aime pas", "I don't like"], ["J'adore", "I love"], ["Je déteste", "I hate"]]),
    C("Activity", [["jouer au tennis", "playing tennis"], ["jouer au foot", "playing football"], ["lire des livres", "reading books"], ["écouter de la musique", "listening to music"], ["nager", "swimming"]]),
    C("Extra", [["le week-end", "at the weekend"], ["avec mes amis", "with my friends"], ["parce que c'est amusant", "because it is fun"], ["parce que c'est difficile", "because it is difficult"]]),
  ]),
  T("fr-school", "fr", "School timetable", "school", [
    C("Day", [["Le lundi", "On Mondays"], ["Le mardi", "On Tuesdays"], ["Le vendredi", "On Fridays"]]),
    C("Who", [["j'ai", "I have"], ["nous avons", "we have"]]),
    C("Subject", [["maths", "maths"], ["anglais", "English"], ["sciences", "science"], ["histoire", "history"], ["sport", "PE"]]),
    C("Time", [["à neuf heures", "at nine o'clock"], ["l'après-midi", "in the afternoon"]]),
  ]),
  T("fr-family-m", "fr", "Family & description (he)", "family", [
    C("Person", [["Mon père est", "My father is"], ["Mon frère est", "My brother is"], ["Mon grand-père est", "My grandfather is"], ["Mon oncle est", "My uncle is"], ["Mon cousin est", "My cousin is"]]),
    C("Degree", [["très", "very"], ["assez", "quite"], ["un peu", "a bit"]]),
    C("Adjective", [["grand", "tall"], ["petit", "short"], ["sportif", "sporty"], ["drôle", "funny"], ["gentil", "kind"]]),
    C("More", [["et il a les cheveux bruns", "and he has brown hair"], ["et il a les yeux bleus", "and he has blue eyes"]]),
  ]),
  T("fr-family-f", "fr", "Family & description (she)", "family", [
    C("Person", [["Ma mère est", "My mother is"], ["Ma sœur est", "My sister is"], ["Ma grand-mère est", "My grandmother is"], ["Ma tante est", "My aunt is"], ["Ma cousine est", "My cousin is"]]),
    C("Degree", [["très", "very"], ["assez", "quite"], ["un peu", "a bit"]]),
    C("Adjective", [["grande", "tall"], ["petite", "short"], ["sportive", "sporty"], ["drôle", "funny"], ["gentille", "kind"]]),
    C("More", [["et elle a les cheveux bruns", "and she has brown hair"], ["et elle a les yeux bleus", "and she has blue eyes"]]),
  ]),
  T("fr-hol-past", "fr", "Holidays (past)", "holidays", [
    C("When", [["L'année dernière", "Last year"], ["L'été dernier", "Last summer"], ["À Pâques", "At Easter"]]),
    C("What I did", [["nous sommes allés en Espagne", "we went to Spain"], ["nous avons visité Paris", "we visited Paris"], ["j'ai visité Londres", "I visited London"], ["j'ai mangé des glaces", "I ate ice creams"], ["j'ai nagé dans la mer", "I swam in the sea"]]),
    C("Extra", [["avec ma famille", "with my family"], ["avec mes amis", "with my friends"], ["et c'était super", "and it was great"], ["et il faisait chaud", "and it was hot"]]),
  ]),
  T("fr-hol-future", "fr", "Holidays (future)", "holidays", [
    C("When", [["L'année prochaine", "Next year"], ["L'été prochain", "Next summer"], ["Demain", "Tomorrow"]]),
    C("Plan", [["je vais visiter Rome", "I am going to visit Rome"], ["nous allons aller en Italie", "we are going to go to Italy"], ["je vais nager dans la mer", "I am going to swim in the sea"], ["nous allons manger des pizzas", "we are going to eat pizzas"]]),
    C("Extra", [["avec ma famille", "with my family"], ["avec mes amis", "with my friends"], ["s'il fait beau", "if the weather is nice"]]),
  ]),
  T("fr-town", "fr", "My town", "town", [
    C("Start", [["Dans ma ville il y a", "In my town there is"]]),
    C("Place", [["un cinéma", "a cinema"], ["un parc", "a park"], ["une piscine", "a swimming pool"], ["un musée", "a museum"], ["un stade", "a stadium"]]),
    C("Where", [["près de chez moi", "near my house"], ["en centre-ville", "in the town centre"], ["mais il n'y a pas de théâtre", "but there is no theatre"]]),
  ]),
  T("fr-food", "fr", "Food & drink", "food", [
    C("Meal", [["Le matin, je mange", "In the morning I eat"], ["À midi, je mange", "At midday I eat"], ["Le soir, je mange", "In the evening I eat"]]),
    C("Food", [["du pain", "bread"], ["de la soupe", "soup"], ["des fruits", "fruit"], ["du poulet", "chicken"], ["des pâtes", "pasta"]]),
    C("Drink", [["et je bois de l'eau", "and I drink water"], ["et je bois du lait", "and I drink milk"], ["et je bois du jus d'orange", "and I drink orange juice"]]),
  ]),
  // ── Spanish ──
  T("es-hobbies", "es", "Opinions & hobbies", "hobbies", [
    C("Opinion", [["Me gusta", "I like"], ["No me gusta", "I don't like"], ["Me encanta", "I love"], ["Odio", "I hate"]]),
    C("Activity", [["jugar al tenis", "playing tennis"], ["jugar al fútbol", "playing football"], ["leer libros", "reading books"], ["escuchar música", "listening to music"], ["nadar", "swimming"]]),
    C("Extra", [["los fines de semana", "at weekends"], ["con mis amigos", "with my friends"], ["porque es divertido", "because it is fun"], ["porque es difícil", "because it is difficult"]]),
  ]),
  T("es-school", "es", "School timetable", "school", [
    C("Day", [["Los lunes", "On Mondays"], ["Los martes", "On Tuesdays"], ["Los viernes", "On Fridays"]]),
    C("Who", [["tengo", "I have"], ["tenemos", "we have"]]),
    C("Subject", [["matemáticas", "maths"], ["inglés", "English"], ["ciencias", "science"], ["historia", "history"], ["educación física", "PE"]]),
    C("Time", [["a las nueve", "at nine"], ["por la tarde", "in the afternoon"]]),
  ]),
  T("es-family-m", "es", "Family & description (he)", "family", [
    C("Person", [["Mi padre es", "My father is"], ["Mi hermano es", "My brother is"], ["Mi abuelo es", "My grandfather is"], ["Mi tío es", "My uncle is"]]),
    C("Degree", [["muy", "very"], ["bastante", "quite"], ["un poco", "a bit"]]),
    C("Adjective", [["alto", "tall"], ["bajo", "short"], ["simpático", "nice"], ["deportista", "sporty"], ["gracioso", "funny"]]),
    C("More", [["y tiene el pelo castaño", "and has brown hair"], ["y tiene los ojos azules", "and has blue eyes"]]),
  ]),
  T("es-family-f", "es", "Family & description (she)", "family", [
    C("Person", [["Mi madre es", "My mother is"], ["Mi hermana es", "My sister is"], ["Mi abuela es", "My grandmother is"], ["Mi tía es", "My aunt is"]]),
    C("Degree", [["muy", "very"], ["bastante", "quite"], ["un poco", "a bit"]]),
    C("Adjective", [["alta", "tall"], ["baja", "short"], ["simpática", "nice"], ["deportista", "sporty"], ["graciosa", "funny"]]),
    C("More", [["y tiene el pelo castaño", "and has brown hair"], ["y tiene los ojos azules", "and has blue eyes"]]),
  ]),
  T("es-hol-past", "es", "Holidays (past)", "holidays", [
    C("When", [["El verano pasado", "Last summer"], ["El año pasado", "Last year"], ["En Semana Santa", "At Easter"]]),
    C("What I did", [["fui a España", "I went to Spain"], ["visité Madrid", "I visited Madrid"], ["comí paella", "I ate paella"], ["nadé en el mar", "I swam in the sea"], ["compré un regalo", "I bought a present"]]),
    C("Extra", [["con mi familia", "with my family"], ["con mis amigos", "with my friends"], ["y fue genial", "and it was great"], ["y hizo calor", "and it was hot"]]),
  ]),
  T("es-hol-future", "es", "Holidays (future)", "holidays", [
    C("When", [["El verano que viene", "Next summer"], ["El año que viene", "Next year"], ["Mañana", "Tomorrow"]]),
    C("Plan", [["voy a visitar Roma", "I am going to visit Rome"], ["voy a nadar en el mar", "I am going to swim in the sea"], ["voy a comer pizza", "I am going to eat pizza"], ["voy a ir a la playa", "I am going to go to the beach"]]),
    C("Extra", [["con mi familia", "with my family"], ["con mis amigos", "with my friends"], ["si hace buen tiempo", "if the weather is nice"]]),
  ]),
  T("es-town", "es", "My town", "town", [
    C("Start", [["En mi ciudad hay", "In my town there is"]]),
    C("Place", [["un parque", "a park"], ["un cine", "a cinema"], ["una piscina", "a swimming pool"], ["un museo", "a museum"], ["un estadio", "a stadium"]]),
    C("Where", [["cerca de mi casa", "near my house"], ["en el centro", "in the centre"], ["pero no hay teatro", "but there is no theatre"]]),
  ]),
  T("es-food", "es", "Food & drink", "food", [
    C("Meal", [["Por la mañana como", "In the morning I eat"], ["A mediodía como", "At midday I eat"], ["Por la noche como", "In the evening I eat"]]),
    C("Food", [["pan", "bread"], ["sopa", "soup"], ["fruta", "fruit"], ["pollo", "chicken"], ["pasta", "pasta"]]),
    C("Drink", [["y bebo agua", "and I drink water"], ["y bebo leche", "and I drink milk"], ["y bebo zumo de naranja", "and I drink orange juice"]]),
  ]),
  // ── German (verb second is built into every table) ──
  T("de-hobbies", "de", "Opinions & hobbies", "hobbies", [
    C("Verb phrase", [["Ich spiele gern", "I like playing"], ["Ich spiele nicht gern", "I don't like playing"], ["Ich spiele oft", "I often play"], ["Ich spiele jeden Tag", "I play every day"]]),
    C("Activity", [["Tennis", "tennis"], ["Fußball", "football"], ["Gitarre", "the guitar"], ["Basketball", "basketball"]]),
    C("Extra", [["mit meinen Freunden", "with my friends"], ["am Wochenende", "at the weekend"], ["im Park", "in the park"]]),
  ]),
  T("de-school", "de", "School timetable (inversion)", "school", [
    C("Day", [["Am Montag", "On Monday"], ["Am Dienstag", "On Tuesday"], ["Am Freitag", "On Friday"]]),
    C("Verb + subject", [["habe ich", "I have"], ["haben wir", "we have"]]),
    C("Time", [["um neun Uhr", "at nine o'clock"], ["um zehn Uhr", "at ten o'clock"], ["am Nachmittag", "in the afternoon"]]),
    C("Subject", [["Mathe", "maths"], ["Englisch", "English"], ["Sport", "PE"], ["Geschichte", "history"], ["Kunst", "art"]]),
  ], [0, 1, 3, 2]),
  T("de-family", "de", "Family & description", "family", [
    C("Person", [["Mein Vater ist", "My father is"], ["Meine Mutter ist", "My mother is"], ["Mein Bruder ist", "My brother is"], ["Meine Schwester ist", "My sister is"], ["Mein Opa ist", "My grandad is"]]),
    C("Degree", [["sehr", "very"], ["ziemlich", "quite"], ["ein bisschen", "a bit"]]),
    C("Adjective", [["groß", "tall"], ["klein", "short"], ["nett", "nice"], ["lustig", "funny"], ["sportlich", "sporty"]]),
    C("More", [["und hat braune Haare", "and has brown hair"], ["und hat blaue Augen", "and has blue eyes"]]),
  ]),
  T("de-hol-past", "de", "Holidays (past: Perfekt)", "holidays", [
    C("When", [["Letzten Sommer", "Last summer"], ["Letztes Jahr", "Last year"], ["Zu Ostern", "At Easter"]]),
    C("Verb + subject", [["bin ich", "I"]]),
    C("With", [["mit meiner Familie", "with my family"], ["mit meinen Freunden", "with my friends"]]),
    C("Where", [["nach Spanien", "to Spain"], ["nach Italien", "to Italy"], ["nach Frankreich", "to France"]]),
    C("Participle", [["gefahren", "went"], ["geflogen", "flew"], ["gereist", "travelled"]]),
  ], [0, 1, 4, 3, 2]),
  T("de-hol-future", "de", "Holidays (future: werden)", "holidays", [
    C("When", [["Nächsten Sommer", "Next summer"], ["Nächstes Jahr", "Next year"], ["Morgen", "Tomorrow"]]),
    C("Verb + subject", [["werde ich", "I will"], ["werden wir", "we will"]]),
    C("Where", [["nach Spanien", "to Spain"], ["nach Italien", "to Italy"], ["nach Berlin", "to Berlin"]]),
    C("Infinitive", [["fahren", "go"], ["fliegen", "fly"], ["reisen", "travel"]]),
  ], [0, 1, 3, 2]),
  T("de-town", "de", "My town", "town", [
    C("Start", [["In meiner Stadt gibt es", "In my town there is"]]),
    C("Place", [["einen Park", "a park"], ["ein Kino", "a cinema"], ["ein Museum", "a museum"], ["ein Schwimmbad", "a swimming pool"], ["einen Bahnhof", "a station"]]),
    C("Where", [["in der Nähe", "nearby"], ["im Zentrum", "in the centre"], ["aber kein Theater", "but no theatre"]]),
  ]),
  T("de-food", "de", "Food & drink", "food", [
    C("Meal", [["Zum Frühstück esse ich", "For breakfast I eat"], ["Zum Mittagessen esse ich", "For lunch I eat"], ["Zum Abendessen esse ich", "For dinner I eat"]]),
    C("Food", [["Brot", "bread"], ["Suppe", "soup"], ["Obst", "fruit"], ["Hähnchen", "chicken"], ["Nudeln", "pasta"]]),
    C("Drink", [["und trinke Wasser", "and drink water"], ["und trinke Milch", "and drink milk"], ["und trinke Orangensaft", "and drink orange juice"]]),
  ]),
  { id: "de-order", lang: "de", title: "Word order: verb second, weil / dass / wenn / obwohl", theme: "word order", mode: "order", columns: [] },
];
export const tablesFor = (lang: Lang) => TABLES.filter((t) => t.lang === lang);
export const tableById = (id: string) => TABLES.find((t) => t.id === id);
export const comboCount = (t: SentenceTable) => (t.mode === "order" ? DE_MAINS.length * 2 + DE_PAIRS.length * 2 : t.columns.reduce((a, c) => a * c.options.length, 1));

// ── German clause builder ────────────────────────────────────────────────────
/** Main clause, subject first: Ich habe gestern Fußball gespielt. (verb 2nd; second verb part / separable prefix last) */
export const deMain = (c: ClauseSpec) => [cap(c.subj), c.fin, c.time, ...(c.mid ?? []), c.tail, c.prefix].filter(Boolean).join(" ");
/** Main clause with the time phrase first: the verb stays SECOND and the subject moves after it. */
export const deTimeFront = (c: ClauseSpec) => [cap(c.time ?? ""), c.fin, c.subj, ...(c.mid ?? []), c.tail, c.prefix].filter(Boolean).join(" ");
/** Verb-first order used for a main clause that follows a subordinate clause: …, bleibe ich zu Hause. */
export const deInverted = (c: ClauseSpec) => [c.fin, c.subj, c.time, ...(c.mid ?? []), c.tail, c.prefix].filter(Boolean).join(" ");
/** Subordinate clause: the finite verb goes to the END (a separable prefix rejoins it). */
export const deSub = (conj: string, c: ClauseSpec) => [conj, c.subj, c.time, ...(c.mid ?? []), c.tail, (c.prefix ?? "") + c.fin].filter(Boolean).join(" ");

const DE_MAINS: ClauseSpec[] = [
  { subj: "ich", fin: "spiele", time: "am Wochenende", mid: ["Tennis"], en: "I play tennis", enTime: "at the weekend" },
  { subj: "ich", fin: "habe", time: "gestern", mid: ["Fußball"], tail: "gespielt", en: "I played football", enTime: "yesterday" },
  { subj: "wir", fin: "fahren", time: "im Sommer", mid: ["nach Spanien"], en: "we go to Spain", enTime: "in the summer" },
  { subj: "ich", fin: "stehe", time: "um sieben Uhr", prefix: "auf", en: "I get up", enTime: "at seven o'clock" },
  { subj: "ich", fin: "werde", time: "nächstes Jahr", mid: ["nach Berlin"], tail: "fahren", en: "I will go to Berlin", enTime: "next year" },
  { subj: "meine Schwester", fin: "kommt", time: "morgen", prefix: "an", en: "my sister arrives", enTime: "tomorrow" },
  { subj: "er", fin: "kann", time: "heute", mid: ["nicht"], tail: "kommen", en: "he can't come", enTime: "today" },
  { subj: "wir", fin: "haben", time: "am Montag", mid: ["Mathe"], en: "we have maths", enTime: "on Monday" },
  { subj: "ich", fin: "bin", time: "letzte Woche", mid: ["nach Hause"], tail: "gegangen", en: "I went home", enTime: "last week" },
  { subj: "sie", fin: "isst", time: "jeden Tag", mid: ["Obst"], en: "she eats fruit", enTime: "every day" },
];
interface Pair { main: ClauseSpec; sub: ClauseSpec; conj: string; conjEn: string; noFirst?: boolean }
const DE_PAIRS: Pair[] = [
  { main: { subj: "ich", fin: "bleibe", mid: ["zu Hause"], en: "I stay at home" }, sub: { subj: "ich", fin: "bin", mid: ["krank"], en: "I am ill" }, conj: "weil", conjEn: "because" },
  { main: { subj: "ich", fin: "gehe", mid: ["ins Bett"], en: "I go to bed" }, sub: { subj: "ich", fin: "bin", mid: ["müde"], en: "I am tired" }, conj: "weil", conjEn: "because" },
  { main: { subj: "er", fin: "sagt", en: "he says" }, sub: { subj: "er", fin: "mag", mid: ["Fußball"], en: "he likes football" }, conj: "dass", conjEn: "that", noFirst: true },
  { main: { subj: "wir", fin: "gehen", mid: ["ins Kino"], en: "we go to the cinema" }, sub: { subj: "es", fin: "regnet", en: "it rains" }, conj: "wenn", conjEn: "when" },
  { main: { subj: "ich", fin: "spiele", mid: ["Tennis"], en: "I play tennis" }, sub: { subj: "ich", fin: "bin", mid: ["müde"], en: "I am tired" }, conj: "obwohl", conjEn: "although" },
  { main: { subj: "sie", fin: "lernt", mid: ["Deutsch"], en: "she learns German" }, sub: { subj: "sie", fin: "will", mid: ["nach Berlin"], tail: "fahren", en: "she wants to go to Berlin" }, conj: "weil", conjEn: "because" },
  { main: { subj: "ich", fin: "glaube", en: "I think" }, sub: { subj: "er", fin: "hat", time: "gestern", mid: ["Tennis"], tail: "gespielt", en: "he played tennis yesterday" }, conj: "dass", conjEn: "that", noFirst: true },
  { main: { subj: "ich", fin: "bin", mid: ["müde"], en: "I am tired" }, sub: { subj: "ich", fin: "stehe", mid: ["früh"], prefix: "auf", en: "I get up early" }, conj: "weil", conjEn: "because" },
  { main: { subj: "wir", fin: "bleiben", mid: ["zu Hause"], en: "we stay at home" }, sub: { subj: "wir", fin: "sind", mid: ["krank"], en: "we are ill" }, conj: "wenn", conjEn: "if" },
];
export const DE_CLAUSES = { mains: DE_MAINS, pairs: DE_PAIRS };

export function buildOrderSentence(o: OrderSpec): { target: string; en: string; other?: string } {
  const { main, sub, conj } = o;
  if (o.variant === "main" || o.variant === "time-front") {
    const a = `${deMain(main)}.`, b = `${deTimeFront(main)}.`, enA = `${cap(main.en)} ${main.enTime}.`, enB = `${cap(main.enTime ?? "")}, ${lcFirst(main.en)}.`;
    return o.variant === "main" ? { target: a, en: enA, other: b } : { target: b, en: enB, other: a };
  }
  const p = DE_PAIRS.find((x) => x.main === main)!;
  const end = `${deMain(main)}, ${deSub(conj!, sub!)}.`, first = `${cap(deSub(conj!, sub!))}, ${deInverted(main)}.`;
  const enEnd = `${cap(main.en)} ${p.conjEn} ${sub!.en}.`, enFirst = `${cap(p.conjEn)} ${sub!.en}, ${lcFirst(main.en)}.`;
  const both = !p.noFirst;
  return o.variant === "sub-end" ? { target: end, en: enEnd, other: both ? first : undefined } : { target: first, en: enFirst, other: end };
}

const words = (s: string) => s.toLowerCase().replace(/[.,;!?]/g, " ").split(/\s+/).filter(Boolean);
/** Explain word-order mistakes in a German answer for an OrderSpec. Empty list = the order is right. (Vocabulary/spelling is checked separately by checkSentence.) */
export function diagnoseOrder(answer: string, o: OrderSpec): string[] {
  const tk = words(answer), out: string[] = [];
  const clause = (c: ClauseSpec, t: string[], timeFront: boolean, name: string) => {
    const first = words(timeFront ? c.time ?? "" : c.subj), fin = c.fin.toLowerCase(), fi = t.indexOf(fin);
    if (fi < 0) { out.push(`${name}: I can't find the verb “${c.fin}”.`); return; }
    if (fi !== first.length) out.push(`${name}: the verb must be the SECOND idea — right after “${first.join(" ")}”.`);
    if (timeFront && t.slice(fi + 1, fi + 1 + words(c.subj).length).join(" ") !== words(c.subj).join(" ")) out.push(`${name}: after a time phrase the verb comes next and the subject follows it (“${c.fin} ${c.subj}”).`);
    const end = c.prefix ?? c.tail;
    if (end && t[t.length - 1] !== end.toLowerCase()) out.push(`${name}: the ${c.prefix ? "separable prefix" : "second verb"} “${end}” goes at the END of the clause.`);
  };
  if (o.variant === "main" || o.variant === "time-front") { clause(o.main, tk, o.variant === "time-front", "Main clause"); return out; }
  const sub = o.sub!, conj = o.conj!.toLowerCase(), subFin = ((sub.prefix ?? "") + sub.fin).toLowerCase();
  const ci = tk.indexOf(conj);
  if (ci < 0) { out.push(`I can't find “${o.conj}”.`); return out; }
  const si = tk.indexOf(subFin, ci);
  if (si < 0) { out.push(`In a “${o.conj}” clause the verb goes to the end — I can't find “${sub.prefix ? sub.prefix + sub.fin : sub.fin}”.`); return out; }
  const subEnd = o.variant === "sub-end" ? tk.length - 1 : si;
  if (si !== subEnd) out.push(`After “${o.conj}” the verb “${sub.prefix ? sub.prefix + sub.fin : sub.fin}” must be the LAST word of its clause.`);
  if (sub.tail && tk[si - 1] !== sub.tail.toLowerCase()) out.push(`In the “${o.conj}” clause the second verb “${sub.tail}” comes just before the finite verb.`);
  if (o.variant === "sub-end") clause(o.main, tk.slice(0, ci), false, "Main clause");
  else {
    const rest = tk.slice(si + 1), m = o.main;
    if (rest[0] !== m.fin.toLowerCase() || rest.slice(1, 1 + words(m.subj).length).join(" ") !== words(m.subj).join(" ")) out.push(`After a “${o.conj}” clause the main verb comes first, then the subject (“${m.fin} ${m.subj}”).`);
    else { const e = m.prefix ?? m.tail; if (e && rest[rest.length - 1] !== e.toLowerCase()) out.push(`Main clause: “${e}” goes at the end.`); }
  }
  return out;
}

// ── generation, jumble, checking ─────────────────────────────────────────────
/** n distinct sentences from a table, reproducible from the seed. Order tables mix main / time-first / weil-dass-wenn-obwohl sentences. */
export function generateSentences(table: SentenceTable, seed: number, n: number): SentenceItem[] {
  const rng = makeRng(seed), out: SentenceItem[] = [], seen = new Set<string>();
  const total = comboCount(table), want = Math.min(n, total);
  for (let guard = 0; out.length < want && guard < want * 60 + 60; guard++) {
    let item: SentenceItem;
    if (table.mode === "order") {
      if (rng.next() < 0.5) {
        const m = rng.pick(DE_MAINS), variant: OrderVariant = rng.next() < 0.5 ? "main" : "time-front", o: OrderSpec = { variant, main: m };
        const b = buildOrderSentence(o);
        item = { target: b.target, en: b.en, accepted: [b.target, b.other!], picks: [DE_MAINS.indexOf(m)], order: o, hint: variant === "main" ? "Start with the subject." : "Start with the time phrase — the verb must still be second." };
      } else {
        const p = rng.pick(DE_PAIRS), variant: OrderVariant = !p.noFirst && rng.next() < 0.5 ? "sub-first" : "sub-end", o: OrderSpec = { variant, main: p.main, sub: p.sub, conj: p.conj };
        const b = buildOrderSentence(o);
        item = { target: b.target, en: b.en, accepted: [b.target, ...(b.other ? [b.other] : [])], picks: [DE_PAIRS.indexOf(p)], order: o, hint: variant === "sub-first" ? `Start with the “${p.conj}” clause (verb to the end), then the main clause.` : `Main clause first, then the “${p.conj}” clause (verb to the end).` };
      }
    } else {
      const picks = table.columns.map((c) => rng.int(0, c.options.length - 1));
      const chunks = picks.map((k, i) => table.columns[i]!.options[k]!);
      const target = cap(joinT(chunks.map((c) => c.t))) + ".";
      const order = table.enOrder ?? chunks.map((_, i) => i);
      item = { target, en: cap(order.map((i) => chunks[i]!.en).filter(Boolean).join(" ")) + ".", accepted: [target], picks };
    }
    const key = item.target + "|" + (item.order?.variant ?? "");
    if (seen.has(key)) continue;
    seen.add(key); out.push(item);
  }
  return out;
}

/** Build a sentence from chosen chunk indices (one per column). */
export function buildFromPicks(table: SentenceTable, picks: number[]): { target: string; en: string } {
  const chunks = picks.map((k, i) => table.columns[i]!.options[k]!);
  const order = table.enOrder ?? chunks.map((_, i) => i);
  return { target: cap(joinT(chunks.map((c) => c.t))) + ".", en: cap(order.map((i) => chunks[i]!.en).filter(Boolean).join(" ")) + "." };
}

/** Words of a sentence, punctuation stripped from the ends (an elided "j'aime" stays one word). */
export const tokens = (sentence: string) => sentence.trim().split(/\s+/).map((t) => t.replace(/^[¿¡"“]+|[.,;:!?"”]+$/g, "")).filter(Boolean);

/** A deterministic scramble of the words, guaranteed to differ from the original order whenever that is possible. */
export function jumble(sentence: string, seed: number): string[] {
  const tk = tokens(sentence), rng = makeRng(seed);
  if (tk.length < 2 || new Set(tk).size < 2) return tk;
  for (let i = 0; i < 25; i++) { const s = rng.shuffle(tk); if (s.join("\u0000") !== tk.join("\u0000")) return s; }
  return [...tk.slice(1), tk[0]!];
}

/** Mark a typed / assembled sentence against every accepted version (accents per policy, punctuation and capitals ignored by default). */
export function checkSentence(answer: string, accepted: string[], policy: Partial<TextPolicy> = {}): CheckResult {
  return checkText(answer, accepted, { ignorePunctuation: true, matchCase: false, ...policy });
}
