// Structural + linguistic checks for the spanish-ks2-3 pack. Run: cd server && npx tsx src/curriculum/spanish-ks2-3/_check_l3.ts
// (1) structure: 10 questions, exactly 2 diagnostics, 3/5/2 difficulty, <=1 written, answers among options, notes, flashcards both directions;
// (2) recomputes grammar keys with a mini conjugator / plural / agreement engine; (3) scans for gender-article mismatches and unaccented spellings;
// (4) flags note sentences that reuse a quiz answer.
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { CQuestion, CTopic } from "../types";

const HERE = path.dirname(fileURLToPath(import.meta.url));
let bad = 0;
const fail = (m: string) => { bad++; console.error("FAIL " + m); };

// ---------- mini engine ----------
type P = 0 | 1 | 2 | 3 | 4 | 5;
const END = {
  present: { ar: ["o", "as", "a", "amos", "áis", "an"], er: ["o", "es", "e", "emos", "éis", "en"], ir: ["o", "es", "e", "imos", "ís", "en"] },
  preterite: { ar: ["é", "aste", "ó", "amos", "asteis", "aron"], er: ["í", "iste", "ió", "imos", "isteis", "ieron"], ir: ["í", "iste", "ió", "imos", "isteis", "ieron"] },
  imperfect: { ar: ["aba", "abas", "aba", "ábamos", "abais", "aban"], er: ["ía", "ías", "ía", "íamos", "íais", "ían"], ir: ["ía", "ías", "ía", "íamos", "íais", "ían"] },
  conditional: { ar: ["ía", "ías", "ía", "íamos", "íais", "ían"], er: ["ía", "ías", "ía", "íamos", "íais", "ían"], ir: ["ía", "ías", "ía", "íamos", "íais", "ían"] },
} as const;
const IRR: Record<string, Record<string, string[]>> = {
  ser: { present: ["soy", "eres", "es", "somos", "sois", "son"], imperfect: ["era", "eras", "era", "éramos", "erais", "eran"], preterite: ["fui", "fuiste", "fue", "fuimos", "fuisteis", "fueron"] },
  estar: { present: ["estoy", "estás", "está", "estamos", "estáis", "están"] },
  tener: { present: ["tengo", "tienes", "tiene", "tenemos", "tenéis", "tienen"], preterite: ["tuve", "tuviste", "tuvo", "tuvimos", "tuvisteis", "tuvieron"], conditional: ["tendría", "tendrías", "tendría", "tendríamos", "tendríais", "tendrían"] },
  ir: { present: ["voy", "vas", "va", "vamos", "vais", "van"], imperfect: ["iba", "ibas", "iba", "íbamos", "ibais", "iban"], preterite: ["fui", "fuiste", "fue", "fuimos", "fuisteis", "fueron"] },
  hacer: { present: ["hago", "haces", "hace", "hacemos", "hacéis", "hacen"], preterite: ["hice", "hiciste", "hizo", "hicimos", "hicisteis", "hicieron"], conditional: ["haría", "harías", "haría", "haríamos", "haríais", "harían"] },
  haber: { present: ["he", "has", "ha", "hemos", "habéis", "han"] },
};
type Tense = "present" | "preterite" | "imperfect" | "conditional";
function conj(inf: string, t: Tense, p: P): string {
  const irr = IRR[inf]?.[t]; if (irr) return irr[p];
  const ty = inf.slice(-2) as "ar" | "er" | "ir";
  const stem = t === "conditional" ? inf : inf.slice(0, -2);
  return stem + END[t][ty][p];
}
const REFL = ["me", "te", "se", "nos", "os", "se"];
const refl = (inf: string, t: Tense, p: P) => `${REFL[p]} ${conj(inf.replace(/se$/, ""), t, p)}`;
const participle = (inf: string) => ({ hacer: "hecho", ver: "visto", escribir: "escrito", poner: "puesto", decir: "dicho", abrir: "abierto" } as Record<string, string>)[inf] ?? inf.slice(0, -2) + (inf.endsWith("ar") ? "ado" : "ido");
function plural(n: string): string {
  if (/z$/.test(n)) return n.slice(0, -1) + "ces";
  if (/[áéíóú]s$/.test(n)) return n.replace(/á/, "a").replace(/é/, "e").replace(/í/, "i").replace(/ó/, "o").replace(/ú/, "u") + "es";
  if (/ción$|sión$/.test(n)) return n.replace(/ó/, "o") + "es";
  if (/[aeiouéáó]$/.test(n)) return n + "s";
  return n + "es";
}
function agree(adj: string, g: "m" | "f", pl: boolean): string {
  let a = adj;
  if (g === "f") { if (/o$/.test(a)) a = a.slice(0, -1) + "a"; else if (/és$/.test(a)) a = a.replace(/és$/, "esa"); else if (/(or|án|ín|ón)$/.test(a)) a += "a"; }
  return pl ? plural(a) : a;
}
// gender dictionary used to scan articles (m / f); plurals are added automatically
const NOUNS: Record<string, "m" | "f"> = {
  madre: "f", padre: "m", hermano: "m", hermana: "f", abuelo: "m", abuela: "f", tío: "m", tía: "f", primo: "m", prima: "f", perro: "m", gato: "m", pez: "m", conejo: "m", pájaro: "m", hámster: "m", tortuga: "f", caballo: "m",
  lápiz: "m", bolígrafo: "m", goma: "f", regla: "f", libro: "m", cuaderno: "m", mochila: "f", estuche: "m", mesa: "f", silla: "f", pizarra: "f", profesor: "m", profesora: "f",
  matemáticas: "f", inglés: "m", ciencias: "f", historia: "f", geografía: "f", arte: "m", música: "f", dibujo: "m", informática: "f", teatro: "m", corbata: "f", camisa: "f",
  pan: "m", leche: "f", zumo: "m", queso: "m", jamón: "m", manzana: "f", plátano: "m", naranja: "f", fresa: "f", patata: "f", arroz: "m", pasta: "f", pollo: "m", pescado: "m", huevo: "m", sopa: "f", helado: "m", desayuno: "m", comida: "f", cena: "f",
  fútbol: "m", tenis: "m", baloncesto: "m", voleibol: "m", natación: "f", atletismo: "m", ajedrez: "m", guitarra: "f", piano: "m", violín: "m", cine: "m", tele: "f",
  ciudad: "f", pueblo: "m", calle: "f", plaza: "f", parque: "m", banco: "m", colegio: "m", supermercado: "m", biblioteca: "f", piscina: "f", estación: "f", museo: "m", iglesia: "f", mercado: "m", ayuntamiento: "m", castillo: "m", catedral: "f", río: "m", playa: "f", montaña: "f", lago: "m", tráfico: "m", ruido: "m",
  abrigo: "m", camiseta: "f", pantalón: "m", falda: "f", vestido: "m", jersey: "m", gorra: "f", zapato: "m", bota: "f", calcetín: "m", bufanda: "f", paraguas: "m", cabeza: "f", ojo: "m", nariz: "f", boca: "f", oreja: "f", brazo: "m", mano: "f", pierna: "f", pie: "m", estómago: "m",
  norte: "m", sur: "m", este: "m", oeste: "m", aeropuerto: "m", maleta: "f", tren: "m", avión: "m", barco: "m", autobús: "m", hotel: "m", camping: "m", habitación: "f", billete: "m", pasaporte: "m", verano: "m", año: "m",
  verdura: "f", fruta: "f", comida_: "f", cuenta: "f", salud: "f", dieta: "f", ejercicio: "m", azúcar: "m", grasa: "f", mapa: "m", día: "m", problema: "m", programa: "m", tema: "m", idioma: "m", canción: "f", nación: "f", lección: "f", casa: "f", jardín: "m", papel: "m", carpeta: "f", pelo: "m", cumpleaños: "m", tienda: "f", oficina: "f", piso: "m", campo: "m", regalo: "m", chaqueta: "f", periódico: "m", correo: "m", lunes: "m", martes: "m", sábado: "m", viernes: "m", domingo: "m",
  deporte: "m", coche: "m", castilla: "f", clase: "f", instituto: "m", recreo: "m", palabra: "f", noche: "f", tarde: "f", mañana: "f", hora: "f", semana: "f", edad: "f",
};
const NOUNPL: Record<string, "m" | "f"> = {};
for (const [n, g] of Object.entries(NOUNS)) { NOUNPL[n] = g; NOUNPL[plural(n)] = g; }
Object.assign(NOUNPL, { pantalones: "m", zapatos: "m", calcetines: "m", huevos: "m", lápices: "m", fresas: "f", patatas: "f", ojos: "m", gafas: "f" });
const ART: Record<string, "m" | "f"> = { el: "m", un: "m", los: "m", unos: "m", la: "f", una: "f", las: "f", unas: "f" };
// words that are never correct without their accent (only scanned in non-accepted text)
const NEEDACC = ["musica", "matematicas", "informatica", "geografia", "educacion", "ingles", "frances", "espanol", "dieciseis", "miercoles", "sabado", "lapiz", "marron", "jamon", "autobus", "avion", "ademas", "tambien", "cancion", "leccion", "estacion", "informacion", "habitacion", "nacion", "telefono", "unico", "simpatico", "timido", "historico", "dificil", "facil", "boligrafo", "pajaro", "hamster", "estomago", "azucar", "jardin", "violin", "camion", "melon", "ratones", "tio", "tia", "abuelas".replace("abuelas", "cumpleanos"), "alergico", "vegetarianoo", "dia", "dias", "rio", "cafe"];

// ---------- load ----------
const files = readdirSync(HERE).filter((f) => f.endsWith(".ts") && !f.startsWith("_")).sort();
const tops: CTopic[] = [];
const allQs = new Map<string, CQuestion>();
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

(async () => {
  for (const f of files) { const m = await import(pathToFileURL(path.join(HERE, f)).href); tops.push(m.TOPIC); }
  let qn = 0, ny = 0;
  for (const t of tops) {
    if (t.subject !== "Spanish" || !t.key.startsWith("es")) fail(`${t.key}: subject/key`);
    for (const y of Object.values(t.years)) {
      if (!y) continue;
      ny++;
      const w = `${t.key} Y${y.year}`;
      const qs = y.quiz.questions; qn += qs.length;
      for (const q of qs) allQs.set(q.key, q);
      if (qs.length !== 10) fail(`${w}: ${qs.length} questions`);
      if (qs.filter((q) => q.diagnostic).length !== 2) fail(`${w}: need exactly 2 diagnostics`);
      const d = [1, 2, 3].map((n) => qs.filter((q) => q.difficulty === n).length).join("/");
      if (d !== "3/5/2") fail(`${w}: difficulty ${d}`);
      if (qs.filter((q) => q.kind === "written").length > (y.year >= 7 ? 1 : 0)) fail(`${w}: too many written`);
      if (y.flashcards.length < 8 || y.flashcards.length > 12) fail(`${w}: flashcards ${y.flashcards.length}`);
      const toEng = y.flashcards.filter((c) => /\(Spanish/.test(c.front) || /\bin Spanish\b/.test(c.front) || /\(Spanish\)/.test(c.front)).length;
      if (toEng < 2) fail(`${w}: flashcards need both directions (English -> Spanish cards: ${toEng})`);
      if (y.flashcards.length - toEng < 3) fail(`${w}: flashcards need Spanish -> English cards too`);
      const body = y.note.body;
      if (words(body) < 120) fail(`${w}: note ${words(body)} words`);
      if (!/\|\s*---/.test(body)) fail(`${w}: note has no table`);
      if (!/sound tip|pronunciation/i.test(body)) fail(`${w}: note has no sound tip`);
      if (!/common mistakes/i.test(body)) fail(`${w}: note has no common mistakes`);
      const ms = body.split(/## Model sentences/)[1]?.split(/\n## /)[0] ?? "";
      const nModel = ms.split("\n").filter((l) => l.trim().startsWith("-")).length;
      if (t.key !== "esverb" && t.key !== "esnoun" && nModel < 3) fail(`${w}: model sentences ${nModel}`);
      if (/Model sentences/.test(body) === false && t.key !== "esnoun" && t.key !== "esverb") fail(`${w}: no model sentences section`);
      const pos = new Set(qs.filter((q) => q.kind === "single").map((q) => q.options!.indexOf(String(q.answer))));
      if (pos.size < 3) fail(`${w}: answer positions ${[...pos]}`);
      const bodyN = norm(body.replace(/[*_`]/g, ""));
      for (const q of qs) {
        const at = q.key;
        const okOpt = q.kind === "single" ? q.options!.includes(String(q.answer)) : q.kind === "multi" ? (q.answer as string[]).every((a) => q.options!.includes(a)) : true;
        if (!okOpt) fail(`${at}: answer not in options`);
        if (q.kind === "single" || q.kind === "multi") {
          if (new Set(q.options!.map(norm)).size !== q.options!.length) fail(`${at}: duplicate options`);
          if (q.kind === "single" && q.options!.length !== 4) fail(`${at}: single needs 4 options`);
        }
        if (q.kind === "short") {
          if (!q.accepted?.length && !/^[\wáéíóúñü]+$/.test(String(q.answer))) fail(`${at}: short w/o accepted variants`);
          if (norm(String(q.answer)).length && norm(q.prompt).includes(norm(String(q.answer))) && String(q.answer).split(" ").length > 1) fail(`${at}: prompt contains the answer`);
        }
        // does the note reuse a quiz answer of 3+ words verbatim?
        const ans = (Array.isArray(q.answer) ? q.answer : [q.answer]).map(String);
        if (q.kind !== "written") for (const a of ans) {
          const n = norm(a.replace(/[*_`¿¡?!.]/g, ""));
          if (/[áéíóúñ¿]|^[a-z ]+$/.test(a) && n.split(" ").length >= 3 && /[a-záéíóú]/.test(n) && bodyN.includes(n) && /[a-z]/.test(n) && !/^[a-z ]+$/.test(a.replace(/[áéíóúñ]/g, ""))) fail(`${at}: quiz answer "${a}" appears verbatim in the note`);
          else if (n.split(" ").length >= 3 && bodyN.includes(n) && !/^(it|she|he|i|the|to|on|a|an|before|after|far|near|all|your|hay|los|las|el|la)\b/.test(n) && /^[a-z¡¿ ]+$/.test(n) && ans.length && /[a-z]/.test(n)) console.log(`note: check "${a}" (${at}) vs note`);
        }
      }
      // spanish text scan (skip options that are not the right answer, and `accepted`)
      const src: string[] = [body, ...y.flashcards.flatMap((c) => [c.front, c.back])];
      for (const q of qs) src.push(q.prompt, q.explanation, ...(Array.isArray(q.answer) ? q.answer : [q.answer]).map(String));
      for (const s of src) {
        const clean = s.replace(/[*_`]/g, "");
        for (const m of clean.matchAll(/\b(el|la|los|las|un|una|unos|unas)\s+([a-záéíóúñü]+)/gi)) {
          const art = m[1].toLowerCase(), n = m[2].toLowerCase();
          if (NOUNPL[n] && ART[art] !== NOUNPL[n] && !(n === "agua") && !["la mapa", "el mano"].includes(m[0].toLowerCase())) fail(`${w}: article/gender "${m[0]}"`);
        }
        for (const bw of NEEDACC) if (new RegExp(`(^|[^a-záéíóúñü])${bw}([^a-záéíóúñü]|$)`, "i").test(clean.replace(/\(.*?\)/g, (x) => x))) {
          // allow when the unaccented form is discussed in a "not *x*" or "without the accent" context
          if (!new RegExp(`(not|no|without|never|isn't|instead of)[^.]*\\*?${bw}\\*?`, "i").test(clean) && !new RegExp(`\\*${bw}\\*`, "i").test(clean)) fail(`${w}: unaccented "${bw}" in: ${clean.slice(0, 80)}`);
        }
        if (/¿/.test(clean) && !/\?/.test(clean.slice(clean.indexOf("¿")))) fail(`${w}: ¿ without ?: ${clean.slice(0, 60)}`);
        if (/¡/.test(clean) && !/!/.test(clean.slice(clean.indexOf("¡")))) fail(`${w}: ¡ without !: ${clean.slice(0, 60)}`);
      }
    }
  }

  // ---------- recomputed grammar keys ----------
  const ans = (k: string) => { const q = allQs.get(k); if (!q) { fail(`missing ${k}`); return ""; } return q.answer as any; };
  const eq = (k: string, expected: string | string[]) => {
    const got = ans(k); const g = Array.isArray(got) ? [...got].sort() : String(got);
    const e = Array.isArray(expected) ? [...expected].sort() : expected;
    if (JSON.stringify(g) !== JSON.stringify(e)) fail(`${k}: answer ${JSON.stringify(got)} != recomputed ${JSON.stringify(expected)}`);
  };
  const opts = (k: string) => allQs.get(k)!.options!;
  const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
  // esverb Y7
  eq("esverb-y7-01", conj("vivir", "present", 0));
  eq("esverb-y7-02", conj("comer", "present", 3));
  eq("esverb-y7-03", cap(conj("ser", "present", 5)) + " de Perú.");
  eq("esverb-y7-04", conj("tener", "present", 1));
  eq("esverb-y7-05", conj("ir", "present", 5));
  eq("esverb-y7-06", cap(conj("estar", "present", 3)) + " en la biblioteca.");
  eq("esverb-y7-07", [conj("comer", "present", 0), conj("comer", "present", 1), conj("comer", "present", 5)]);
  for (const o of opts("esverb-y7-07")) if (![0, 1, 2, 3, 4, 5].some((p) => conj("comer", "present", p as P) === o) && (ans("esverb-y7-07") as string[]).includes(o)) fail("esverb-y7-07 right option not present form");
  if ([0, 1, 2, 3, 4, 5].some((p) => ["comar", "comimos"].includes(conj("comer", "present", p as P)))) fail("esverb-y7-07 distractor is a present form");
  eq("esverb-y7-08", `Me ${conj("levantar", "present", 0)} a las siete.`);
  eq("esverb-y7-10", refl("ducharse", "present", 3));
  for (const [inf] of [["hablar"], ["comer"], ["vivir"]]) for (const p of [0, 1, 2, 3, 4, 5] as P[]) {
    const body = tops.find((t) => t.key === "esverb")!.years[7]!.note.body;
    if (!body.includes(conj(inf, "present", p))) fail(`esverb Y7 note lacks ${conj(inf, "present", p)}`);
    if (!/^ser$|^ir$/.test(inf)) { /* fine */ }
  }
  for (const inf of ["ser", "estar", "tener", "ir"]) for (const p of [0, 1, 2, 3, 4, 5] as P[]) if (!tops.find((t) => t.key === "esverb")!.years[7]!.note.body.includes(conj(inf, "present", p))) fail(`esverb Y7 note lacks ${conj(inf, "present", p)}`);
  for (const p of [0, 1, 2, 3, 4, 5] as P[]) if (!tops.find((t) => t.key === "esverb")!.years[7]!.note.body.includes(refl("levantarse", "present", p))) { /* table lists forms as a run; checked below */ }
  const lev = [0, 1, 2, 3, 4, 5].map((p) => refl("levantarse", "present", p as P)).join(", ");
  if (!tops.find((t) => t.key === "esverb")!.years[7]!.note.body.includes(lev)) fail("esverb Y7 note reflexive list differs from " + lev);
  // esverb Y8
  eq("esverb-y8-01", `Voy a comer.`); if (conj("ir", "present", 0) !== "voy") fail("voy");
  eq("esverb-y8-02", conj("ir", "present", 5));
  eq("esverb-y8-03", participle("hablar"));
  eq("esverb-y8-04", `${cap(conj("haber", "present", 0))} ${participle("comer")}.`);
  eq("esverb-y8-05", conj("ir", "preterite", 0));
  eq("esverb-y8-06", conj("comer", "preterite", 0));
  eq("esverb-y8-07", ["hacer", "escribir", "ver"].map(participle));
  if (["hablar", "comer"].some((v) => participle(v) === { hablar: "hablado", comer: "comido" }[v] ? false : true)) fail("regular participles");
  eq("esverb-y8-08", conj("hablar", "preterite", 5));
  eq("esverb-y8-09", `Hemos ${"escribido"} una carta.`);
  if (participle("escribir") === "escribido") fail("escribir participle");
  eq("esverb-y8-10", conj("hacer", "preterite", 3));
  { const body = tops.find((t) => t.key === "esverb")!.years[8]!.note.body;
    for (const inf of ["hablar", "comer", "vivir"]) for (const p of [0, 1, 2, 3, 4, 5] as P[]) if (!body.includes(conj(inf, "preterite", p))) fail(`esverb Y8 note lacks ${conj(inf, "preterite", p)}`);
    for (const inf of ["ir", "hacer", "tener"]) for (const p of [0, 1, 2, 3, 5] as P[]) if (!body.includes(conj(inf, "preterite", p))) fail(`esverb Y8 note lacks ${conj(inf, "preterite", p)}`);
    for (const p of [0, 1, 2, 3, 4, 5] as P[]) if (!body.includes(conj("haber", "present", p))) fail(`esverb Y8 note lacks ${conj("haber", "present", p)}`);
    for (const v of ["hecho", "visto", "escrito", "puesto", "dicho", "abierto"]) if (!body.includes(v)) fail(`esverb Y8 note lacks ${v}`); }
  // esverb Y9
  eq("esverb-y9-01", conj("hablar", "imperfect", 0));
  eq("esverb-y9-02", conj("jugar", "imperfect", 0));
  eq("esverb-y9-04", cap(conj("comer", "conditional", 0)) + ".");
  eq("esverb-y9-07", [conj("comer", "imperfect", 3), conj("ser", "imperfect", 0), conj("ir", "imperfect", 5)]);
  eq("esverb-y9-08", `Me ${conj("gustar", "conditional", 2)} viajar.`);
  eq("esverb-y9-10", conj("vivir", "imperfect", 0));
  { const body = tops.find((t) => t.key === "esverb")!.years[9]!.note.body;
    for (const inf of ["hablar", "comer", "vivir", "ser", "ir"]) for (const p of [0, 1, 2, 3, 5] as P[]) if (!body.includes(conj(inf, "imperfect", p))) fail(`esverb Y9 note lacks ${conj(inf, "imperfect", p)}`);
    for (const inf of ["hablar", "comer", "vivir"]) if (!body.includes(conj(inf, "conditional", 0))) fail(`esverb Y9 note lacks ${conj(inf, "conditional", 0)}`);
    if (!body.includes("haría") || !body.includes("tendría")) fail("esverb Y9 conditional irregulars"); }
  // esnoun
  eq("esnoun-y7-02", plural("libro")); eq("esnoun-y7-03", plural("profesor")); eq("esnoun-y7-05", plural("ciudad"));
  eq("esnoun-y7-06", plural("lección")); eq("esnoun-y7-10", "los " + plural("pez"));
  if (plural("lápiz") !== "lápices" || plural("nación") !== "naciones" || plural("papel") !== "papeles" || plural("mesa") !== "mesas") fail("plural engine");
  eq("esnoun-y8-01", agree("alto", "f", false)); eq("esnoun-y8-03", agree("rojo", "m", true)); eq("esnoun-y8-10", agree("trabajador", "f", true));
  if (agree("grande", "f", false) !== "grande" || agree("inglés", "f", false) !== "inglesa" || agree("inglés", "m", true) !== "ingleses") fail("agree engine");
  eq("esid-y7-05", agree("escocés", "f", false));
  // numbers / days
  const N = ["uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez", "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete", "dieciocho", "diecinueve", "veinte"];
  eq("esnum-y3-05", N[16 - 1]); eq("esnum-y3-10", N[6 + 12 - 1]);
  eq("esnum-y3-04", ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"][["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"].indexOf("jueves") + 1]);
  if (!tops.find((t) => t.key === "esnum")!.years[3]!.note.body.includes(N.join(", "))) fail("esnum note number list differs");
  // esfam reading: 2 brothers + 1 sister
  eq("esfam-y4-09", String(2 + 1));

  console.log(`\n${tops.length} topics · ${ny} topic-years · ${qn} questions · ${bad} failure(s)`);
  process.exit(bad ? 1 : 0);
})();
