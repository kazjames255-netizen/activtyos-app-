// MFL numbers, ordinals, dates, times, prices and ages (Spanish / French / German). PURE — no React, no randomness.
// Every function returns a primary form first and then accepted alternatives (older spellings, "and" variants, with/without "il est").

export type NLang = "es" | "fr" | "de";
export interface Words { text: string; alternatives: string[]; /** primary first, then alternatives (no duplicates). */ all: string[] }
const mk = (text: string, alts: string[] = []): Words => { const all = [text, ...alts.filter((a) => a !== text)]; return { text, alternatives: all.slice(1).filter((v, i, a) => a.indexOf(v) === i), all: all.filter((v, i, a) => a.indexOf(v) === i) }; };

// ───────────────────────── cardinals ─────────────────────────
const ES_U = ["cero", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez", "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete", "dieciocho", "diecinueve", "veinte", "veintiuno", "veintidós", "veintitrés", "veinticuatro", "veinticinco", "veintiséis", "veintisiete", "veintiocho", "veintinueve"];
const ES_T = ["", "", "", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];
const ES_H = ["", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos", "seiscientos", "setecientos", "ochocientos", "novecientos"];
const esU100 = (n: number) => (n < 30 ? ES_U[n]! : ES_T[Math.floor(n / 10)]! + (n % 10 ? " y " + ES_U[n % 10] : ""));
const esU1000 = (n: number) => (n === 100 ? "cien" : (n >= 100 ? ES_H[Math.floor(n / 100)]! + (n % 100 ? " " : "") : "") + (n % 100 || n < 100 ? esU100(n % 100) : ""));
const esApocope = (s: string) => s.replace(/veintiuno$/, "veintiún").replace(/uno$/, "un");
function esCard(n: number, apoc: boolean): string {
  if (n === 0) return "cero";
  if (n === 1_000_000) return "un millón";
  const th = Math.floor(n / 1000), r = n % 1000;
  const head = th === 0 ? "" : th === 1 ? "mil" : (apoc ? esApocope(esU1000(th)) : esU1000(th)) + " mil";
  return [head, r ? esU1000(r) : ""].filter(Boolean).join(" ");
}

const FR_U = ["zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf"];
const FR_T = ["", "", "vingt", "trente", "quarante", "cinquante", "soixante"];
interface FrOpt { belgian: boolean }
function frU100(n: number, o: FrOpt, final: boolean): string {
  if (n < 20) return FR_U[n]!;
  const t = Math.floor(n / 10), u = n % 10;
  if (t <= 6) return FR_T[t]! + (u === 0 ? "" : u === 1 ? " et un" : "-" + FR_U[u]);
  if (t === 7) {
    if (o.belgian) return "septante" + (u === 0 ? "" : u === 1 ? " et un" : "-" + FR_U[u]);
    return "soixante" + (u === 1 ? " et onze" : "-" + FR_U[10 + u]);
  }
  if (t === 8) return "quatre-vingt" + (u === 0 ? (final ? "s" : "") : "-" + FR_U[u]);
  if (o.belgian) return "nonante" + (u === 0 ? "" : u === 1 ? " et un" : "-" + FR_U[u]);
  return "quatre-vingt-" + FR_U[10 + u];
}
function frU1000(n: number, o: FrOpt, final: boolean): string {
  const h = Math.floor(n / 100), r = n % 100, parts: string[] = [];
  if (h === 1) parts.push("cent");
  else if (h > 1) parts.push(FR_U[h] + " cent" + (r === 0 && final ? "s" : ""));
  if (r > 0) parts.push(frU100(r, o, final));
  return parts.join(" ");
}
function frCard(n: number, o: FrOpt): string {
  if (n === 0) return "zéro";
  if (n === 1_000_000) return "un million";
  const th = Math.floor(n / 1000), r = n % 1000, parts: string[] = [];
  if (th === 1) parts.push("mille"); else if (th > 1) parts.push(frU1000(th, o, false) + " mille");
  if (r) parts.push(frU1000(r, o, true));
  return parts.join(" ");
}

const DE_U = ["null", "eins", "zwei", "drei", "vier", "fünf", "sechs", "sieben", "acht", "neun", "zehn", "elf", "zwölf", "dreizehn", "vierzehn", "fünfzehn", "sechzehn", "siebzehn", "achtzehn", "neunzehn"];
const DE_T = ["", "", "zwanzig", "dreißig", "vierzig", "fünfzig", "sechzig", "siebzig", "achtzig", "neunzig"];
interface DeOpt { einPrefix: boolean; und: boolean }
/** `final` = the number ends here, so 1 is "eins" (otherwise "ein"). */
function deU100(n: number, final: boolean): string {
  if (n < 20) return n === 1 && !final ? "ein" : DE_U[n]!;
  const u = n % 10;
  return (u ? (u === 1 ? "ein" : DE_U[u]) + "und" : "") + DE_T[Math.floor(n / 10)];
}
function deU1000(n: number, o: DeOpt, final: boolean, lead = true): string {
  const h = Math.floor(n / 100), r = n % 100;
  const head = h === 0 ? "" : h === 1 ? (o.einPrefix || !lead ? "einhundert" : "hundert") : DE_U[h] + "hundert";
  return head + (r ? (h && o.und ? "und" : "") + deU100(r, final) : "");
}
function deCard(n: number, o: DeOpt): string {
  if (n === 0) return "null";
  if (n === 1_000_000) return "eine Million";
  const th = Math.floor(n / 1000), r = n % 1000;
  let s = "";
  if (th === 1) s = o.einPrefix ? "eintausend" : "tausend";
  else if (th > 1) s = deU1000(th, o, false) + "tausend";
  if (r) s += (th && o.und && r < 100 ? "und" : "") + deU1000(r, o, true, th === 0);
  return s;
}

/** Integer 0–1,000,000 in words. `alternatives` = accepted variants (Belgian septante/nonante and all-hyphen reform spelling in French; einhundert / "und" forms in German; un-apocope in Spanish). */
export function numberWords(lang: NLang, n: number): Words {
  if (!Number.isInteger(n) || n < 0 || n > 1_000_000) throw new RangeError("number out of range 0–1,000,000: " + n);
  if (lang === "es") return mk(esCard(n, true), [esCard(n, false)]);
  if (lang === "fr") {
    const p = frCard(n, { belgian: false }), b = frCard(n, { belgian: true });
    const hy = (s: string) => s.replace(/ /g, "-");
    return mk(p, [hy(p), b, hy(b)]);
  }
  const variants = [false, true].flatMap((einPrefix) => [false, true].map((und) => deCard(n, { einPrefix, und })));
  return mk(variants[0]!, variants.slice(1));
}
export const numberAccepted = (lang: NLang, n: number) => numberWords(lang, n).all;

/** A number before a masculine/feminine noun: "un/una", "veintiún/veintiuna" (es), "une" (fr, "vingt et une"), "ein/eine" (de: only the final 1). */
export function numberBeforeNoun(lang: NLang, n: number, gender: "m" | "f" | "n" = "m"): string {
  const w = numberWords(lang, n).text;
  if (lang === "es") return gender === "f" ? w.replace(/veintiuno$/, "veintiuna").replace(/uno$/, "una") : esApocope(w);
  if (lang === "fr") return gender === "f" ? w.replace(/ un$/, " une").replace(/^un$/, "une") : w;
  return w.replace(/eins$/, gender === "f" ? "eine" : "ein");
}

/** Parse "1,000", "1 000", "1.000", "1000" → 1000, or null when it is not a whole number. */
export function parseDigits(s: string): number | null {
  const t = s.replace(/[\s.,'’  ]/g, "");
  return /^\d{1,7}$/.test(t) ? Number(t) : null;
}
export const formatDigits = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

// ───────────────────────── months & days ─────────────────────────
export const MONTHS: Record<NLang, string[]> = {
  es: ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"],
  fr: ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"],
  de: ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"],
};
/** Monday first. */
export const DAYS: Record<NLang, string[]> = {
  es: ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"],
  fr: ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"],
  de: ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"],
};
export const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

// ───────────────────────── ordinals 1st–31st ─────────────────────────
const ES_ORD_U = ["", "primero", "segundo", "tercero", "cuarto", "quinto", "sexto", "séptimo", "octavo", "noveno"];
const ES_ORD_T = ["", "décimo", "vigésimo", "trigésimo"];
function frOrdinalOf(cardinal: string): string {
  if (cardinal.endsWith("cinq")) return cardinal + "uième";
  if (cardinal.endsWith("neuf")) return cardinal.slice(0, -1) + "vième";
  if (cardinal.endsWith("e")) return cardinal.slice(0, -1) + "ième";
  return cardinal + "ième";
}
/** Masculine ordinal 1–31 (fr: premier; es: primero; de: erste — the form used after "der"). */
export function ordinalWords(lang: NLang, n: number): Words {
  if (!Number.isInteger(n) || n < 1 || n > 31) throw new RangeError("ordinal out of range 1–31: " + n);
  if (lang === "es") {
    if (n < 10) return mk(ES_ORD_U[n]!);
    if (n === 10) return mk("décimo");
    if (n === 11) return mk("undécimo", ["décimo primero"]);
    if (n === 12) return mk("duodécimo", ["décimo segundo"]);
    if (n < 20) { const u = ES_ORD_U[n - 10]!; return mk("decimo" + u, ["décimo " + u]); }
    const t = ES_ORD_T[Math.floor(n / 10)]!, u = n % 10;
    return mk(u ? t + " " + ES_ORD_U[u] : t);
  }
  if (lang === "fr") {
    if (n === 1) return mk("premier", ["première", "1er"]);
    if (n === 2) return mk("deuxième", ["second", "seconde"]);
    const card = numberWords("fr", n).text; // never ends in "s" for 1..31
    return mk(frOrdinalOf(card));
  }
  if (n === 1) return mk("erste");
  if (n === 3) return mk("dritte");
  if (n === 7) return mk("siebte", ["siebente"]);
  if (n === 8) return mk("achte");
  const c = numberWords("de", n).text;
  return mk(c + (n < 20 ? "te" : "ste"));
}
/** German ordinal with its case ending: nominative "dritte" (der dritte), dative/genitive "dritten" (am dritten). */
export const deOrdinalDative = (n: number): Words => { const w = ordinalWords("de", n); return mk(w.text + "n", w.alternatives.map((a) => a + "n")); };

// ───────────────────────── dates ─────────────────────────
export interface DateForms { /** As written with numerals: "le 14 juillet", "el 5 de mayo", "der 3. Oktober". */ written: string; /** Primary spoken form: "le quatorze juillet". */ words: string; /** All accepted spoken forms. */ accepted: string[] }
/** d = day 1–31, m = month 1–12. German default is the nominative ("der dritte Oktober"); `dative: true` gives "am dritten Oktober". */
export function dateForms(lang: NLang, d: number, m: number, opts: { dative?: boolean } = {}): DateForms {
  const month = MONTHS[lang][m - 1]!;
  if (lang === "fr") {
    const day = d === 1 ? "premier" : numberWords("fr", d).text; // French dates use cardinals except the 1st
    const written = `le ${d === 1 ? "1er" : d} ${month}`;
    const spoken = numberWords("fr", d).all.map((x) => (d === 1 ? "premier" : x));
    const acc = d === 1 ? [`le premier ${month}`, `le un ${month}`, `premier ${month}`, `le 1er ${month}`] : spoken.flatMap((x) => [`le ${x} ${month}`, `${x} ${month}`]);
    return { written, words: `le ${day} ${month}`, accepted: acc.filter((v, i, a) => a.indexOf(v) === i) };
  }
  if (lang === "es") {
    const day = d === 1 ? "primero" : numberWords("es", d).text;
    const spoken = d === 1 ? ["primero", "uno"] : numberWords("es", d).all;
    const acc = spoken.flatMap((x) => [`el ${x} de ${month}`, `${x} de ${month}`]);
    return { written: `el ${d} de ${month}`, words: `el ${day} de ${month}`, accepted: acc.filter((v, i, a) => a.indexOf(v) === i) };
  }
  const ord = opts.dative ? deOrdinalDative(d) : ordinalWords("de", d);
  const pre = opts.dative ? "am" : "der";
  const acc = ord.all.flatMap((x) => [`${pre} ${x} ${month}`, ...(opts.dative ? [] : [`${x} ${month}`])]);
  return { written: `${pre} ${d}. ${month}`, words: `${pre} ${ord.text} ${month}`, accepted: acc };
}
/** Numeric "14/7" style parse: accepts 14/7, 14/07, 14.7., 14-7 → [14, 7]. */
export function parseDayMonth(s: string): [number, number] | null {
  const m = /^\s*(\d{1,2})\s*[/.\-]\s*(\d{1,2})\.?\s*$/.exec(s);
  return m ? [Number(m[1]), Number(m[2])] : null;
}

// ───────────────────────── times ─────────────────────────
export type TimeStyle = "colloquial" | "official";
const h12 = (h: number) => (h % 12 === 0 ? 12 : h % 12);
const pad2 = (n: number) => String(n).padStart(2, "0");
export const timeDigits = (h: number, m: number) => `${pad2(h)}:${pad2(m)}`;

function esTime(h: number, m: number, style: TimeStyle): Words {
  if (style === "official") {
    const hw = numberWords("es", h).text.replace(/^uno$/, "una").replace(/^veintiuno$/, "veintiuna").replace(/^cero$/, "cero");
    const lead = h === 1 ? "es la " : "son las ";
    const horas = h === 1 ? "hora" : "horas";
    if (m === 0) return mk(`${lead}${hw} ${horas}`, [`${lead}${hw}`, `${lead.trim() === "es la" ? "la" : "las"} ${hw} ${horas}`]);
    const mw = numberWords("es", m).text;
    return mk(`${lead}${hw} ${mw}`, [`${lead}${hw} y ${mw}`, `${lead}${hw} horas ${mw} minutos`, `${lead.trim() === "es la" ? "la" : "las"} ${hw} ${mw}`]);
  }
  const say = (hr: number, tail: string): Words => {
    const hh = h12(hr), lead = hh === 1 ? "es la" : "son las", art = hh === 1 ? "la" : "las";
    const hw = hh === 1 ? "una" : numberWords("es", hh).text;
    const core = `${hw}${tail}`;
    const alts = [`${art} ${core}`];
    return mk(`${lead} ${core}`, alts);
  };
  if (m === 0 && h === 12) return mk("es mediodía", ["son las doce", "son las doce en punto", "es el mediodía"]);
  if (m === 0 && h === 0) return mk("es medianoche", ["son las doce", "son las doce en punto", "es la medianoche"]);
  if (m === 0) { const w = say(h, ""); const enPunto = say(h, " en punto"); return mk(w.text, [...w.alternatives, enPunto.text, ...enPunto.alternatives]); }
  if (m === 15) return say(h, " y cuarto");
  if (m === 30) return say(h, " y media");
  if (m === 45) return say(h + 1, " menos cuarto");
  if (m < 30 || m % 5 !== 0) return say(h, " y " + numberWords("es", m).text);
  return say(h + 1, " menos " + numberWords("es", 60 - m).text);
}

function frHour(h: number, fem = true): string { let w = numberWords("fr", h).text; if (fem) w = w.replace(/ un$/, " une").replace(/^un$/, "une"); return w; }
function frTime(h: number, m: number, style: TimeStyle): Words {
  if (style === "official") {
    const hw = h === 0 ? "zéro" : frHour(h), hu = h > 1 ? "heures" : "heure";
    if (m === 0) return mk(`il est ${hw} ${hu}`, [`${hw} ${hu}`]);
    const mw = numberWords("fr", m).text;
    return mk(`il est ${hw} ${hu} ${mw}`, [`${hw} ${hu} ${mw}`, `il est ${hw} ${hu} ${mw} minute${m > 1 ? "s" : ""}`]);
  }
  const name = (hr: number) => hr % 24 === 12 ? "midi" : hr % 24 === 0 ? "minuit" : frHour(h12(hr));
  const heures = (hr: number) => { const k = hr % 24; if (k === 12 || k === 0) return name(hr); const hh = h12(hr); return `${frHour(hh)} heure${hh > 1 ? "s" : ""}`; };
  const say = (body: string): Words => mk(`il est ${body}`, [body]);
  if (m === 0) return say(heures(h));
  const isNoon = h % 12 === 0;
  if (m === 15) return say(`${heures(h)} et quart`);
  if (m === 30) return say(`${heures(h)} et ${isNoon ? "demi" : "demie"}`);
  if (m === 45) return say(`${heures(h + 1)} moins le quart`);
  if (m < 30 || m % 5 !== 0) return say(`${heures(h)} ${numberWords("fr", m).text}`);
  return say(`${heures(h + 1)} moins ${numberWords("fr", 60 - m).text}`);
}

function deTime(h: number, m: number, style: TimeStyle): Words {
  const es = (t: string) => mk(t, [`es ist ${t}`, `Es ist ${t}`]);
  const hourWord = (hr: number, offi: boolean) => { const v = offi ? hr : h12(hr); return v === 1 ? "ein" : numberWords("de", v).text; };
  if (style === "official") {
    const hw = hourWord(h, true);
    if (m === 0) return mk(`${hw} Uhr`, [`es ist ${hw} Uhr`]);
    const mw = numberWords("de", m).text;
    return mk(`${hw} Uhr ${mw}`, [`es ist ${hw} Uhr ${mw}`]);
  }
  const cu = numberWords("de", h12(h)).text, nx = numberWords("de", h12(h + 1)).text; // "eins" in "Viertel nach eins"
  const uhr = hourWord(h, false); // "ein" in "ein Uhr"
  const w = (n: number) => numberWords("de", n).text;
  if (m === 0) return es(`${uhr} Uhr`);
  if (m === 15) return es(`Viertel nach ${cu}`);
  if (m === 30) return es(`halb ${nx}`);
  if (m === 45) return mk(`Viertel vor ${nx}`, [`es ist Viertel vor ${nx}`, `Es ist Viertel vor ${nx}`, `dreiviertel ${nx}`, `drei viertel ${nx}`, `es ist dreiviertel ${nx}`]);
  if (m % 5 !== 0) return es(`${uhr} Uhr ${w(m)}`);
  if (m === 5 || m === 10) return es(`${w(m)} nach ${cu}`);
  if (m === 20) return mk(`zwanzig nach ${cu}`, [`es ist zwanzig nach ${cu}`, `zehn vor halb ${nx}`, `es ist zehn vor halb ${nx}`]);
  if (m === 25) return mk(`fünf vor halb ${nx}`, [`es ist fünf vor halb ${nx}`]);
  if (m === 35) return mk(`fünf nach halb ${nx}`, [`es ist fünf nach halb ${nx}`]);
  if (m === 40) return mk(`zwanzig vor ${nx}`, [`es ist zwanzig vor ${nx}`, `zehn nach halb ${nx}`, `es ist zehn nach halb ${nx}`]);
  return es(`${w(60 - m)} vor ${nx}`); // 50, 55
}
/** Time in words. `h` 0–23, `m` 0–59. Colloquial uses the 12-hour clock; official the 24-hour clock. */
export function timeWords(lang: NLang, h: number, m: number, style: TimeStyle = "colloquial"): Words {
  if (!Number.isInteger(h) || !Number.isInteger(m) || h < 0 || h > 23 || m < 0 || m > 59) throw new RangeError(`bad time ${h}:${m}`);
  return lang === "es" ? esTime(h, m, style) : lang === "fr" ? frTime(h, m, style) : deTime(h, m, style);
}
/** "3:15", "15.15", "15:15", "0915" → [h, m]. */
export function parseTime(s: string): [number, number] | null {
  const t = /^\s*(\d{1,2})\s*[:.h]\s*(\d{2})\s*$/i.exec(s) ?? /^\s*(\d{2})(\d{2})\s*$/.exec(s);
  if (!t) return null;
  const h = Number(t[1]), m = Number(t[2]);
  return h <= 23 && m <= 59 ? [h, m] : null;
}
/** Hand angles (degrees clockwise from 12) for an analogue clock. */
export const clockAngles = (h: number, m: number) => ({ hour: ((h % 12) + m / 60) * 30, minute: m * 6 });

// ───────────────────────── prices & ages ─────────────────────────
const NOUN: Record<NLang, { euro: [string, string]; cent: [string, string]; gender: "m" | "f" | "n" }> = {
  es: { euro: ["euro", "euros"], cent: ["céntimo", "céntimos"], gender: "m" },
  fr: { euro: ["euro", "euros"], cent: ["centime", "centimes"], gender: "m" },
  de: { euro: ["Euro", "Euro"], cent: ["Cent", "Cent"], gender: "m" },
};
/** Price spoken: 5.50 → "cinco euros con cincuenta céntimos" / "cinq euros cinquante" / "fünf Euro fünfzig". `euros` 0–999, `cents` 0–99, not both zero. */
export function priceWords(lang: NLang, euros: number, cents: number): Words {
  if (!Number.isInteger(euros) || !Number.isInteger(cents) || euros < 0 || euros > 999 || cents < 0 || cents > 99 || (euros === 0 && cents === 0)) throw new RangeError(`bad price ${euros},${cents}`);
  const N = NOUN[lang];
  const e = euros ? `${numberBeforeNoun(lang, euros)} ${N.euro[euros === 1 ? 0 : 1]}` : "";
  const cw = cents ? numberBeforeNoun(lang, cents) : "";
  const cn = cents ? `${cw} ${N.cent[cents === 1 ? 0 : 1]}` : "";
  if (!cents) return mk(e);
  if (!euros) return mk(cn, [cw]);
  const alts: string[] = [];
  if (lang === "es") alts.push(`${e} con ${cw}`, `${e} y ${cn}`, `${e} y ${cw}`, `${e} ${cw}`, `${numberBeforeNoun("es", euros)} con ${cw}`);
  else if (lang === "fr") alts.push(`${e} ${cw}`, `${e} et ${cn}`, `${numberBeforeNoun("fr", euros)} ${N.euro[euros === 1 ? 0 : 1]} et ${cw}`);
  else alts.push(`${e} ${cw}`, `${e} und ${cn}`, `${e} und ${cw}`);
  return mk(lang === "es" ? `${e} con ${cn}` : lang === "fr" ? `${e} ${cn}` : `${e} ${cn}`, alts);
}
/** "5,50", "5.50", "€5.50", "5,50 €" → [5, 50]. */
export function parsePrice(s: string): [number, number] | null {
  const m = /^\s*[€]?\s*(\d{1,3})(?:[.,](\d{1,2}))?\s*(?:€|euros?)?\s*$/i.exec(s);
  if (!m) return null;
  const c = m[2] === undefined ? 0 : Number(m[2].length === 1 ? m[2] + "0" : m[2]);
  return [Number(m[1]), c];
}
export const priceDigits = (e: number, c: number) => `${e},${pad2(c)} €`;

/** "I am 12": tengo doce años / j'ai douze ans / ich bin zwölf Jahre alt. */
export function ageWords(lang: NLang, n: number): Words {
  if (!Number.isInteger(n) || n < 0 || n > 120) throw new RangeError("bad age " + n);
  const num = numberBeforeNoun(lang, n);
  if (lang === "es") { const x = `${num} ${n === 1 ? "año" : "años"}`; return mk(`tengo ${x}`, [x, `yo tengo ${x}`]); }
  if (lang === "fr") { const x = `${num} ${n === 1 ? "an" : "ans"}`; return mk(`j'ai ${x}`, [x, `j’ai ${x}`]); }
  const x = `${num} ${n === 1 ? "Jahr" : "Jahre"} alt`;
  return mk(`ich bin ${x}`, [x, `Ich bin ${x}`]);
}
