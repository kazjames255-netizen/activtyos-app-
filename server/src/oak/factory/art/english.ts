// English and languages pictures: story mountain, handwriting lines, country flags (only used when the slide NAMES the country).
import type { Pic } from "./types";
import { svg, poly, path, ln, rect, txt, dot, cap, pline } from "./helpers";
const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim(); // (local: select.ts imports the library, so importing it here would be circular)

const W = 240, H = 170;
const E: Pic["subjects"] = ["English"];

const arcBody = (() => {
  const pts: [number, number][] = [[16, 122], [56, 112], [120, 36], [184, 112], [224, 122]];
  return pline(pts, "a") + dot(120, 36, 4.5, "fr") + ln(16, 122, 224, 122, "th")
    + txt(30, 138, "opening", "tx tl") + txt(82, 74, "rising action", "tx te") + txt(120, 26, "climax", "ts tr") + txt(158, 74, "falling action", "tx tl") + txt(206, 138, "resolution", "tx te") + cap("a story mountain shows how a plot builds to a climax and then settles", 166, 44);
})();
const lines = (() => {
  const ys = [36, 68, 100, 132]; let s = ys.map((y, i) => ln(20, y, 220, y, i === 2 ? "l" : "th")).join("");
  return s + txt(24, 30, "ascender line", "tx tl") + txt(24, 62, "x-height line", "tx tl") + txt(24, 94, "baseline (letters sit on this line)", "tx tl") + txt(24, 126, "descender line", "tx tl") + cap("the four writing lines", 158, 44);
})();
export const ENGLISH: Pic[] = [
  { id: "story-mountain", title: "Story mountain (narrative arc)", alt: "A story mountain: a line that climbs from the opening through the rising action to a peak (the climax), then falls through the falling action to the resolution.", caption: "A narrative arc (story mountain)", subjects: E,
    concepts: ["narrative arc", "story mountain", "plot diagram", "plot structure", "rising action", "falling action", "climax"], requires: ["story", "narrative", "plot", "arc", "novel", "tale"], avoid: ["two climaxes", "multiple climax", "anti-climax", "anticlimax", "climate", "poem", "poetry", "argument", "essay", "non-fiction", "play script"], doesNotShow: "specific story events; the exposition/conflict split of other models",
    evidence: "Narrative arc / story mountain (Freytag): exposition/opening, rising action, climax, falling action, resolution. Oak KS2-KS3 English 'narrative arc', 'climax', 'resolution'. Line rises to the single peak and falls symmetrically.", svg: svg(W, H, arcBody) },
  { id: "handwriting-lines", title: "Handwriting lines", alt: "Four horizontal writing lines labelled from the top: ascender line, x-height line, baseline and descender line.", caption: "Handwriting lines", subjects: E,
    concepts: ["x-height line", "x-height", "baseline", "ascender", "descender"], requires: ["letter", "letters", "handwriting", "handwritten", "write", "writing", "line", "lines"], avoid: ["baseline assessment", "baseline data", "baseline measure", "baseline test", "baseline knowledge"], doesNotShow: "individual letters or how to form them",
    evidence: "Handwriting guide lines: ascenders (b, d, h, k, l, t) rise above the x-height line, x-height letters (a, c, e...) sit between baseline and x-height line, descenders (g, j, p, q, y) drop below the baseline (Oak KS1 handwriting keywords 'x-height line', 'baseline').", svg: svg(W, H, lines) },
];

// ── flags (fixed official colours; simplified: no coat of arms) ─────────────────
const fr = (x: number, y: number, w: number, h: number, fill: string) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`;
const flagFrame = (x: number, y: number, w: number, h: number) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" class="l" style="fill:none"/>`;
const FX = 45, FY = 32, FW = 150, FH = 100;
const flag = (id: string, title: string, concepts: string[], body: string, alt: string, caption: string, evidence: string, langs: Pic["subjects"] = ["French", "Spanish", "German"]): Pic =>
  ({ id, title, alt, caption, subjects: langs, concepts, doesNotShow: "the country's coat of arms or any other symbol; not the language itself", evidence, svg: svg(W, H, body + flagFrame(FX, FY, FW, FH)) });
const bands = (dir: "v" | "h", cols: string[], w: number[] = cols.map(() => 1)) => { const tot = w.reduce((a, b) => a + b, 0); let acc = 0; return cols.map((c, i) => { const f = acc / tot, g = w[i] / tot; acc += w[i]; return dir === "v" ? fr(FX + FW * f, FY, FW * g, FH, c) : fr(FX, FY + FH * f, FW, FH * g, c); }).join(""); };
// a flag is only right when the slide is about THAT country: naming any other country (a comparison, "Spain and Cuba", "the Spanish-speaking world") vetoes it
const OTHER_COUNTRIES = ["cuba", "mexico", "argentina", "peru", "chile", "colombia", "guatemala", "ecuador", "venezuela", "bolivia", "paraguay", "uruguay", "costa rica", "honduras", "nicaragua", "panama", "el salvador", "dominican", "puerto rico", "equatorial guinea", "morocco", "senegal", "algeria", "tunisia", "canada", "quebec", "belgium", "belgique", "switzerland", "suisse", "schweiz", "austria", "luxembourg", "england", "britain", "united kingdom", "=uk", "ireland", "scotland", "wales", "=usa", "america", "united states", "italy", "portugal", "poland", "turkey", "syria", "china", "india", "japan", "russia", "ukraine", "netherlands", "holland", "denmark", "sweden", "norway", "finland", "greece", "egypt", "kenya", "nigeria", "ghana", "haiti", "martinique", "guadeloupe", "cameroon", "ivory coast", "namibia", "spanish-speaking", "spanish speaking", "french-speaking", "french speaking", "german-speaking", "german speaking", "francophone", "hispanic", "latin america", "europe", "africa", "world", "countries", "country"];
const HISTORY = ["ww2", "wwii", "world war", "=war", "occupied", "occupation", "divided", "division", "empire", "reich", "nazi", "gdr", "east germany", "west germany", "berlin wall", "history", "historical", "colonial", "revolution", "medieval", "=past"];
export const FLAGS: Pic[] = ([
  flag("flag-france", "Flag of France", ["france", "frankreich", "francia", "the french flag"], bands("v", ["#0055A4", "#FFFFFF", "#EF4135"]), "The flag of France: three equal vertical stripes, blue, white and red.", "The flag of France", "France: vertical tricolour blue, white, red (hoist to fly), equal thirds (French Republic)."),
  flag("flag-germany", "Flag of Germany", ["germany", "deutschland", "alemania", "allemagne", "the german flag"], bands("h", ["#000000", "#DD0000", "#FFCE00"]), "The flag of Germany: three equal horizontal stripes, black, red and gold from top to bottom.", "The flag of Germany", "Germany: horizontal tricolour black, red, gold (top to bottom), equal thirds."),
  flag("flag-spain", "Flag of Spain (simplified)", ["spain", "spanien", "espana", "españa", "espagne", "the spanish flag"], bands("h", ["#AA151B", "#F1BF00", "#AA151B"], [1, 2, 1]), "The flag of Spain: red, yellow and red horizontal stripes, the yellow stripe twice as tall; the coat of arms is left out.", "The flag of Spain (simplified)", "Spain: horizontal red-yellow-red in the ratio 1:2:1 (yellow stripe double). Coat of arms omitted (simplified)."),
  (() => { const sz = 100, x0 = 70, y0 = 32, t = (6 / 32) * sz, L = (20 / 32) * sz; return { id: "flag-switzerland", title: "Flag of Switzerland", alt: "The flag of Switzerland: a white cross on a red square.", caption: "The flag of Switzerland", subjects: ["French", "Spanish", "German"] as Pic["subjects"], concepts: ["switzerland", "die schweiz", "schweiz", "suiza", "suisse"], doesNotShow: "the country's coat of arms or any other symbol; not the language itself", evidence: "Switzerland: square red flag, centred white cross with arms in the ratio 6:20 of a 32-unit flag (thickness 3/16, length 5/8 of the side).", svg: svg(W, H, fr(x0, y0, sz, sz, "#DA291C") + fr(x0 + (sz - t) / 2, y0 + (sz - L) / 2, t, L, "#fff") + fr(x0 + (sz - L) / 2, y0 + (sz - t) / 2, L, t, "#fff") + `<rect x="${x0}" y="${y0}" width="${sz}" height="${sz}" class="l" style="fill:none"/>` ) } as Pic; })(),
  flag("flag-austria", "Flag of Austria", ["austria", "österreich", "osterreich", "autriche"], bands("h", ["#ED2939", "#FFFFFF", "#ED2939"]), "The flag of Austria: three equal horizontal stripes, red, white and red.", "The flag of Austria", "Austria: horizontal red-white-red, equal thirds."),
  flag("flag-belgium", "Flag of Belgium", ["belgium", "belgien", "bélgica", "belgica", "belgique"], bands("v", ["#000000", "#FAE042", "#ED2939"]), "The flag of Belgium: three equal vertical stripes, black, yellow and red.", "The flag of Belgium", "Belgium: vertical tricolour black, yellow, red, equal thirds."),
  flag("flag-colombia", "Flag of Colombia", ["colombia", "kolumbien", "colombie"], bands("h", ["#FCD116", "#003893", "#CE1126"], [2, 1, 1]), "The flag of Colombia: a yellow stripe (half the flag) above a blue stripe and a red stripe (a quarter each).", "The flag of Colombia", "Colombia: horizontal yellow (1/2), blue (1/4), red (1/4)."),
]).map((f) => ({ ...f, avoid: [...HISTORY, ...OTHER_COUNTRIES.filter((c) => !f.concepts.some((k) => norm(k) === norm(c.replace(/^=/, ""))))] }));
void poly; void path; void rect;
