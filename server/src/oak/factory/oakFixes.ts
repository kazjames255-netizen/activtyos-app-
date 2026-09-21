// Q2 (English + French / Spanish / German content QA, 2026-09-20): errors that sit in Oak's own English / language lesson data.
// Pure functions, no I/O. `fixLang` is applied by quality.ts `tidy` (so every pupil-facing and tutor-facing string of the deck, the plan
// and the validator's re-derivation sees the corrected text); `badPronunciationKeyword` is applied by `cleanKeywords`.
//
// Every entry was found by a dictionary scan of all 4,037 English / French / Spanish / German lessons and CHECKED IN CONTEXT.
// Deliberate misspellings (a lesson that teaches "fliing -> flying", "slimey", "hott", "busstop", "trean", a misconception that writes
// 'haco' / 'sorent' / 'vienent' / 'chaques' on purpose) are NOT in the table.

/** Typos in Oak's text (whole words, matched case-insensitively; a capitalised original stays capitalised). */
const TYPOS: Record<string, string> = {
  accountabilty: "accountability", acknowleding: "acknowledging", addtional: "additional", adpated: "adapted", advantange: "advantage",
  alliteraton: "alliteration", alongisde: "alongside", analyis: "analysis", aomparative: "comparative", aoud: "aloud", argaubly: "arguably",
  arriety: "Arrietty", artifical: "artificial", assesement: "assessment", athough: "although", atmopshere: "atmosphere", beautfiul: "beautiful",
  betwen: "between", britian: "Britain", caplulet: "Capulet", charcater: "character", charcaterisation: "characterisation", chonological: "chronological",
  clsosed: "closed", communties: "communities", concoted: "concocted", consderation: "consideration", constructuve: "constructive", contionous: "continuous",
  credibilty: "credibility", cyle: "cycle", defintion: "definition", defitnions: "definitions", deifnite: "definite", describs: "describes", desribes: "describes",
  desecender: "descender", destitue: "destitute", emphaise: "emphasise", experieces: "experiences", explicilty: "explicitly", fainligh: "Fainlight",
  feminsim: "feminism", foriegn: "foreign", frequnecy: "frequency", frst: "first", guage: "gauge", hedghogs: "hedgehogs", idenitfy: "identify",
  imaginitive: "imaginative", indutrial: "industrial", indvidualistic: "individualistic", ineffecive: "ineffective", inital: "initial", introducted: "introduced",
  japaense: "Japanese", journies: "journeys", kindess: "kindness", langauge: "language", langauges: "languages", languge: "language", lingustic: "linguistic",
  managning: "managing", midde: "middle", mysthical: "mystical", nicghtingale: "nightingale", noblility: "nobility", ocmplacence: "complacence",
  onomatopeia: "onomatopoeia", onomtopoeia: "onomatopoeia", paralells: "parallels", pargraph: "paragraph", parituclar: "particular", peforms: "performs",
  perfom: "perform", perfomance: "performance", persepctive: "perspective", perserverance: "perseverance", personifcation: "personification",
  pharoah: "pharaoh", pivtotal: "pivotal", plannng: "planning", posession: "possession", posessions: "possessions", prepring: "preparing", presention: "presentation",
  pronounciation: "pronunciation", pronuncation: "pronunciation", puncutation: "punctuation", puntuation: "punctuation", pupose: "purpose", qualitites: "qualities",
  recgonisable: "recognisable", recongise: "recognise", rehablilitation: "rehabilitation", rennaisance: "Renaissance", reponse: "response", repsonses: "responses",
  resililence: "resilience", responsibilty: "responsibility", revisting: "revisiting", rythmic: "rhythmic", senences: "sentences", sentece: "sentence",
  seperately: "separately", singluar: "singular", somthing: "something", specfic: "specific", stict: "strict", stubornnesss: "stubbornness", subsitute: "substitute",
  succint: "succinct", sucessfully: "successfully", successfuly: "successfully", susceptability: "susceptibility", suspsense: "suspense", syllablle: "syllable",
  synoynm: "synonym", theh: "the", trangressions: "transgressions", trangressive: "transgressive", unusally: "unusually", vocabluary: "vocabulary",
  vocaulary: "vocabulary", vocabualry: "vocabulary", voabulary: "vocabulary", kake: "make",
  // language lessons (English text)
  infnitive: "infinitive", infintive: "infinitive", obect: "object", partiple: "participle", presposition: "preposition", prespositions: "prepositions",
  compraratives: "comparatives", dicussing: "discussing", dictionaires: "dictionaries", perople: "people", usaully: "usually", ususally: "usually",
  preceeded: "preceded", pural: "plural", prnounced: "pronounced", oropronounced: "pronounced", liasion: "liaison", femnine: "feminine", consonat: "consonant",
  strengthed: "strengthened", participtation: "participation", infinites: "infinitives", whitebords: "whiteboards", ncessary: "necessary", meaing: "meaning", menaing: "meaning",
  possessve: "possessive", vberb: "verb", introdduces: "introduces", folowed: "followed", plaes: "places", agreeement: "agreement", agreeent: "agreement",
  begininng: "beginning", identifing: "identifying", tempoerature: "temperature", proivde: "provide", swimmming: "swimming", gramatically: "grammatically",
  compund: "compound", complound: "compound", epxressed: "expressed", possibiity: "possibility", professsions: "professions", indefiniete: "indefinite",
  enchanced: "enhanced", curret: "current", acctions: "actions", pratice: "practice", conjuctions: "conjunctions", straighforward: "straightforward",
  appropirate: "appropriate", quesions: "questions", onling: "ongoing",
  // foreign words that lost a letter or an accent in Oak's text
  actaco: "ataco", estan: "están", aqui: "aquí", sueno: "sueño", elfante: "elefante", instituo: "instituto", constuyendo: "construyendo",
  hisorique: "historique", examan: "examen",
};
const TYPO_RE = new RegExp(`(?<![\\p{L}\\p{N}])(${Object.keys(TYPOS).join("|")})(?![\\p{L}\\p{N}])`, "giu");
const cased = (orig: string, fix: string) => (/^\p{Lu}/u.test(orig) && /^\p{Ll}/u.test(fix) ? fix.charAt(0).toUpperCase() + fix.slice(1) : fix);

/** Multi-word slips and errors of grammar / spelling of a foreign word (each replaced verbatim). */
const PHRASES: [RegExp, string][] = [
  [/\bThe letter is e is formed\b/g, "The letter e is formed"],
  [/\bused his writing to took a stand\b/g, "used his writing to take a stand"],
  [/\bA useful tool is structuring\b/gi, "a useful tool in structuring"],
  [/\bsuch a dictionaries\b/g, "such as dictionaries"],
  [/\bhow smooth and natural speech your speech sounds\b/g, "how smooth and natural your speech sounds"],
  [/\bYou can use use texts\b/g, "You can use texts"],
  [/^are (words that often appear together)$/i, "$1"],
  // Oak: "notes = written out of full sentences" (KLP of the same lesson: "Notes are not written in full sentences")
  [/^written out of full sentences$/i, "written without full sentences"],
  [/(['‘’])jai\1 \(I have\)/g, "$1j'ai$1 (I have)"],
  [/'le', 'las', 'les' and 'l''/g, "'le', 'la', 'les' and 'l''"],
  [/\bwhen contacting some 'not' words\b/g, "when contracting some 'not' words"],
];

/** Apply the English / language correction table. Idempotent. */
export function fixLang(s: string): string {
  let t = s.replace(TYPO_RE, (w) => cased(w, TYPOS[w.toLowerCase()]));
  for (const [re, to] of PHRASES) t = t.replace(re, to);
  return t;
}

/** A sound-symbol keyword ("[ch] = pronounced as in 'question'") whose example word does not contain the sound's letters is a swapped /
 *  wrong Oak entry (found: French [ch]/[qu] swapped; German [sp] given the example 'stark'). Such a keyword is dropped from the lesson. */
export function badPronunciationKeyword(k: string, d: string): boolean {
  const m = /^\[([^\]]+)\]/.exec(k.trim());
  if (!m) return false;
  const examples = [...d.matchAll(/['‘’"“”]([^'‘’"“”]{2,20})['‘’"“”]/g)].map((x) => x[1]);
  if (!examples.length || !/\b(?:pronounced|sounds? like|as in)\b/i.test(d)) return false;
  const strip = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const alts = new Set<string>();
  for (const part of m[1].split(/[/,]/)) { const a = strip(part).replace(/[()\-\s]/g, ""); if (a) alts.add(a); const b = strip(part).replace(/\(([^)]*)\)/g, "$1").replace(/[-\s]/g, ""); if (b) alts.add(b); const c = strip(part).replace(/\([^)]*\)/g, "").replace(/[-\s]/g, ""); if (c) alts.add(c); }
  return !examples.some((x) => [...alts].some((a) => strip(x).includes(a)));
}
