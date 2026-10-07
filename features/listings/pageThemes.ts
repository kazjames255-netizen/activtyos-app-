// Booking-page colour themes (the "Page colour theme" picker in the listing wizard).
//
// The first ten (playful, sport = Midnight, emerald … crimson) are defined in
// ListingWizard.tsx and keep rendering exactly as they always did. The fifteen
// below are the "round three" themes: every colour role is a token here, so one
// layout renders in fifteen completely different, individually-checked looks.
//
// Pure data + pure helpers (no React) so the regression test and the server
// key list can be checked against it.

export const LEGACY_THEME_KEYS = ["playful", "sport", "emerald", "teal", "royal", "aubergine", "burgundy", "terracotta", "slate", "crimson"] as const;

export const NEW_THEME_KEYS = [
  "lagoon", "arcade", "aurora", "sherbet", "varsity", "plum", "halftone", "wildwood",
  "pirouette", "riso", "brite", "pitch", "frost", "mint", "poster",
] as const;
export type NewThemeKey = (typeof NEW_THEME_KEYS)[number];

export type FontKey =
  | "fredoka" | "unbounded" | "sora" | "bricolage" | "instrument" | "syne" | "archivo" | "fraunces"
  | "dmserif" | "bagel" | "outfit" | "anton" | "lexend" | "young" | "shoulders";

/** CSS font-family stacks for the display (heading) fonts. */
export const FONT_STACK: Record<FontKey, string> = {
  fredoka: '"Fredoka",system-ui,sans-serif', unbounded: '"Unbounded",system-ui,sans-serif', sora: '"Sora",system-ui,sans-serif',
  bricolage: '"Bricolage Grotesque",system-ui,sans-serif', instrument: '"Instrument Serif",Georgia,serif', syne: '"Syne",system-ui,sans-serif',
  archivo: '"Archivo",system-ui,sans-serif', fraunces: '"Fraunces",Georgia,serif', dmserif: '"DM Serif Display",Georgia,serif',
  bagel: '"Bagel Fat One",system-ui,sans-serif', outfit: '"Outfit",system-ui,sans-serif', anton: '"Anton",Impact,sans-serif',
  lexend: '"Lexend",system-ui,sans-serif', young: '"Young Serif",Georgia,serif', shoulders: '"Big Shoulders Display",Impact,sans-serif',
};

/** Google Fonts css2 `family=` values, loaded lazily only while a theme using them is selected. */
const FONT_QUERY: Record<FontKey, string> = {
  fredoka: "Fredoka:wght@600;700", unbounded: "Unbounded:wght@700;800", sora: "Sora:wght@700;800",
  bricolage: "Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800", instrument: "Instrument+Serif:ital@0;1",
  syne: "Syne:wght@700;800", archivo: "Archivo:ital,wght@0,700;0,900;1,900", fraunces: "Fraunces:opsz,wght@9..144,700;9..144,900",
  dmserif: "DM+Serif+Display:ital@0;1", bagel: "Bagel+Fat+One", outfit: "Outfit:wght@800;900", anton: "Anton",
  lexend: "Lexend:wght@600;700", young: "Young+Serif", shoulders: "Big+Shoulders+Display:wght@800;900",
};

export interface ThemeTokens {
  key: NewThemeKey;
  /** English name; display names go through the catalogue (p8lst.wbTheme_<key>). */
  label: string;
  /** Picker chip colour. */
  dot: string;
  /** True when the page ground is dark. */
  dark: boolean;
  font: FontKey;
  /** Display font weight / style / case. */
  dw: number; dstyle?: "italic"; dcase?: "uppercase";
  /** Heading letter-spacing (em). */
  dtrack?: string;
  t: {
    bg: string; surf: string; surf2: string; ink: string; mute: string; line: string;
    band: string; bandInk: string; eyebrow: string; strip: string; stripInk: string;
    acc: string; accInk: string; price: string; sec: string;
    /** Booking panel header: the colours it is painted from (all checked against phInk) + the CSS background. */
    phStops: string[]; ph: string; phInk: string;
    chip: string; chipInk: string; sel: string; selInk: string; selOn: string; cta: string; ctaInk: string;
    /** Corner radii: cards / small controls / big buttons. */
    r: number; rs: number; rb: number; grain: number;
    /** Optional glow/offset shadow under the main buttons. */
    ctaSh?: string;
    btncase?: "uppercase"; btnstyle?: "italic";
  };
}

export const THEME_TOKENS: Record<NewThemeKey, ThemeTokens> = {
  lagoon: { key: "lagoon", label: "Lagoon", dot: "#13A7D3", dark: false, font: "fredoka", dw: 700,
    t: { bg: "#F0FAFC", surf: "#FFFFFF", surf2: "#E6F6FA", ink: "#073B4C", mute: "#4C6B76", line: "#CDEAF1", band: "#05507A", bandInk: "#FFFFFF", eyebrow: "#9BEBFF", strip: "#FFFFFF", stripInk: "#073B4C",
      acc: "#FF6F61", accInk: "#3A0E08", price: "#00709F", sec: "#00709F", phStops: ["#0A7FA3", "#0077B6"], ph: "linear-gradient(135deg,#0A7FA3,#0077B6)", phInk: "#FFFFFF",
      chip: "#0077B6", chipInk: "#FFFFFF", sel: "#0077B6", selInk: "#05507A", selOn: "#FFFFFF", cta: "#D43D2F", ctaInk: "#FFFFFF", r: 18, rs: 12, rb: 999, grain: 0.12 } },
  arcade: { key: "arcade", label: "Arcade", dot: "#FF2E88", dark: true, font: "unbounded", dw: 800, dcase: "uppercase",
    t: { bg: "#0E0B1F", surf: "#17122E", surf2: "#1F1840", ink: "#F1EEFF", mute: "#A49CC9", line: "#2C2452", band: "#0A0718", bandInk: "#FFFFFF", eyebrow: "#00E5FF", strip: "#120E27", stripInk: "#F1EEFF",
      acc: "#00E5FF", accInk: "#0E0B1F", price: "#00E5FF", sec: "#FF5FA8", phStops: ["#B8125E", "#7A00FF"], ph: "linear-gradient(135deg,#B8125E,#7A00FF)", phInk: "#FFFFFF",
      chip: "#00E5FF", chipInk: "#0E0B1F", sel: "#00E5FF", selInk: "#00E5FF", selOn: "#0E0B1F", cta: "#E0186F", ctaInk: "#FFFFFF", r: 14, rs: 8, rb: 10, grain: 0.18,
      ctaSh: "0 0 0 1px rgba(255,255,255,.15),0 0 28px rgba(255,46,136,.55)" } },
  aurora: { key: "aurora", label: "Aurora", dot: "#3DFFB0", dark: true, font: "sora", dw: 800,
    t: { bg: "#061A1F", surf: "#0B252C", surf2: "#0F2F37", ink: "#E8FFF7", mute: "#8FB5AC", line: "#1A3F47", band: "#020B12", bandInk: "#FFFFFF", eyebrow: "#5CFFC4", strip: "#04141A", stripInk: "#E8FFF7",
      acc: "#5CFFC4", accInk: "#04231C", price: "#5CFFC4", sec: "#7DD3FC", phStops: ["#1F6E70", "#3B2C8F"], ph: "linear-gradient(120deg,#1F6E70,#3B2C8F)", phInk: "#FFFFFF",
      chip: "#5CFFC4", chipInk: "#04231C", sel: "#5CFFC4", selInk: "#5CFFC4", selOn: "#04231C", cta: "#5CFFC4", ctaInk: "#04231C", r: 18, rs: 10, rb: 999, grain: 0.2,
      ctaSh: "0 0 30px rgba(92,255,196,.35)" } },
  sherbet: { key: "sherbet", label: "Sherbet", dot: "#FFB69B", dark: false, font: "bricolage", dw: 800,
    t: { bg: "#FFF9F2", surf: "#FFFFFF", surf2: "#FFF2E6", ink: "#2A1A12", mute: "#74625A", line: "#F1E3D6", band: "#FFF9F2", bandInk: "#2A1A12", eyebrow: "#C42032", strip: "#FFFFFF", stripInk: "#2A1A12",
      acc: "#D62839", accInk: "#FFFFFF", price: "#C42032", sec: "#C42032", phStops: ["#FFC9A8", "#C8F7C5", "#A6EEFF", "#FFE9D6"],
      ph: "radial-gradient(70% 140% at 0% 0%,#FFC9A8,transparent 60%),radial-gradient(70% 140% at 100% 0%,#C8F7C5,transparent 60%),radial-gradient(70% 140% at 60% 120%,#A6EEFF,transparent 60%),#FFE9D6", phInk: "#2A1A12",
      chip: "#2A1A12", chipInk: "#FFFFFF", sel: "#D62839", selInk: "#B01E2E", selOn: "#FFFFFF", cta: "#D62839", ctaInk: "#FFFFFF", r: 22, rs: 14, rb: 999, grain: 0.3 } },
  varsity: { key: "varsity", label: "Varsity", dot: "#E5B94E", dark: false, font: "instrument", dw: 400, dstyle: "italic",
    t: { bg: "#F7F5F0", surf: "#FFFFFF", surf2: "#F3EFE4", ink: "#14213D", mute: "#5A6476", line: "#E4DFD1", band: "#14213D", bandInk: "#FFFFFF", eyebrow: "#E5B94E", strip: "#FFFFFF", stripInk: "#14213D",
      acc: "#E5B94E", accInk: "#14213D", price: "#14213D", sec: "#8A6512", phStops: ["#274C77", "#14213D"], ph: "linear-gradient(160deg,#274C77,#14213D)", phInk: "#FFFFFF",
      chip: "#14213D", chipInk: "#F1D58A", sel: "#14213D", selInk: "#14213D", selOn: "#F1D58A", cta: "#E5B94E", ctaInk: "#14213D", r: 8, rs: 4, rb: 4, grain: 0.14 } },
  plum: { key: "plum", label: "Plum & Wasabi", dot: "#E9F056", dark: false, font: "syne", dw: 800,
    t: { bg: "#FBF7F3", surf: "#FFFFFF", surf2: "#F5EEE9", ink: "#351E28", mute: "#7A6570", line: "#EADFD9", band: "#351E28", bandInk: "#FFFFFF", eyebrow: "#E9F056", strip: "#351E28", stripInk: "#FBF7F3",
      acc: "#E9F056", accInk: "#351E28", price: "#351E28", sec: "#C2410C", phStops: ["#351E28"], ph: "#351E28", phInk: "#FFFFFF",
      chip: "#351E28", chipInk: "#E9F056", sel: "#351E28", selInk: "#351E28", selOn: "#E9F056", cta: "#E9F056", ctaInk: "#351E28", r: 16, rs: 10, rb: 999, grain: 0.3 } },
  halftone: { key: "halftone", label: "Halftone", dot: "#1032CF", dark: false, font: "archivo", dw: 900, dstyle: "italic", dcase: "uppercase",
    t: { bg: "#F4F6F7", surf: "#FFFFFF", surf2: "#EEF1FB", ink: "#0B1340", mute: "#56608A", line: "#DCE1EE", band: "#1032CF", bandInk: "#FFFFFF", eyebrow: "#F9E103", strip: "#0B1340", stripInk: "#FFFFFF",
      acc: "#F9E103", accInk: "#0B1340", price: "#1032CF", sec: "#1032CF", phStops: ["#1032CF"], ph: "#1032CF", phInk: "#FFFFFF",
      chip: "#1032CF", chipInk: "#FFFFFF", sel: "#1032CF", selInk: "#1032CF", selOn: "#FFFFFF", cta: "#F9E103", ctaInk: "#0B1340", r: 6, rs: 4, rb: 6, grain: 0.12, btncase: "uppercase", btnstyle: "italic" } },
  wildwood: { key: "wildwood", label: "Wildwood", dot: "#E3554C", dark: false, font: "fraunces", dw: 900,
    t: { bg: "#F6F1E7", surf: "#FFFDF7", surf2: "#F1E9DA", ink: "#0E2F38", mute: "#5E6B66", line: "#E5DCC9", band: "#093C4A", bandInk: "#F6F1E7", eyebrow: "#E9BE8C", strip: "#FFFDF7", stripInk: "#0E2F38",
      acc: "#E3554C", accInk: "#2A0B07", price: "#093C4A", sec: "#B8412F", phStops: ["#0E4B5B", "#093C4A"], ph: "linear-gradient(180deg,#0E4B5B,#093C4A)", phInk: "#FFFFFF",
      chip: "#093C4A", chipInk: "#FFFFFF", sel: "#093C4A", selInk: "#093C4A", selOn: "#FFFFFF", cta: "#C2453D", ctaInk: "#FFFFFF", r: 14, rs: 10, rb: 12, grain: 0.4 } },
  pirouette: { key: "pirouette", label: "Pirouette", dot: "#FF9EB8", dark: false, font: "dmserif", dw: 400,
    t: { bg: "#FFF5F7", surf: "#FFFFFF", surf2: "#FFEDF2", ink: "#3B1F2B", mute: "#7E5D69", line: "#F5DCE3", band: "#FFE4EC", bandInk: "#3B1F2B", eyebrow: "#C2185B", strip: "#FFFFFF", stripInk: "#3B1F2B",
      acc: "#C2185B", accInk: "#FFFFFF", price: "#C2185B", sec: "#C2185B", phStops: ["#FFC2D1", "#FF9EB8", "#D3B2F2"], ph: "linear-gradient(130deg,#FFC2D1,#FF9EB8 45%,#D3B2F2)", phInk: "#3B1F2B",
      chip: "#C2185B", chipInk: "#FFFFFF", sel: "#C2185B", selInk: "#A3134C", selOn: "#FFFFFF", cta: "#3B1F2B", ctaInk: "#FFFFFF", r: 20, rs: 12, rb: 999, grain: 0.1 } },
  riso: { key: "riso", label: "Riso", dot: "#FF48B0", dark: false, font: "bagel", dw: 400,
    t: { bg: "#FBF7EE", surf: "#FFFFFF", surf2: "#F7F0E2", ink: "#1D1A2F", mute: "#5F5A70", line: "#E9E1CF", band: "#FBF7EE", bandInk: "#1D1A2F", eyebrow: "#C21F82", strip: "#1D1A2F", stripInk: "#FBF7EE",
      acc: "#FF48B0", accInk: "#1D1A2F", price: "#1D1A2F", sec: "#0067A6", phStops: ["#FFE800"], ph: "#FFE800", phInk: "#1D1A2F",
      chip: "#FFE800", chipInk: "#1D1A2F", sel: "#1D1A2F", selInk: "#1D1A2F", selOn: "#FFE800", cta: "#1D1A2F", ctaInk: "#FFE800", r: 18, rs: 10, rb: 999, grain: 0.45,
      ctaSh: "4px 4px 0 #FF48B0" } },
  brite: { key: "brite", label: "Brite", dot: "#FF7A00", dark: false, font: "outfit", dw: 900,
    t: { bg: "#FFF4E8", surf: "#FFFFFF", surf2: "#FFEBD6", ink: "#1E0A3C", mute: "#6C5A7C", line: "#F6DEC6", band: "#1E0A3C", bandInk: "#FFFFFF", eyebrow: "#FFD23F", strip: "#FFFFFF", stripInk: "#1E0A3C",
      acc: "#FF5A1F", accInk: "#1E0A3C", price: "#1E0A3C", sec: "#C23A0A", phStops: ["#FF5A1F", "#FF7A00", "#FFC93C"], ph: "linear-gradient(120deg,#FF5A1F,#FF7A00 60%,#FFC93C)", phInk: "#1E0A3C",
      chip: "#FF5A1F", chipInk: "#1E0A3C", sel: "#1E0A3C", selInk: "#1E0A3C", selOn: "#FFFFFF", cta: "#1E0A3C", ctaInk: "#FFFFFF", r: 18, rs: 12, rb: 14, grain: 0.16 } },
  pitch: { key: "pitch", label: "Pitchside", dot: "#C7F464", dark: true, font: "anton", dw: 400, dcase: "uppercase",
    t: { bg: "#0A140E", surf: "#0F1F16", surf2: "#13281C", ink: "#EEF7EF", mute: "#92A99A", line: "#1E3727", band: "#050B07", bandInk: "#FFFFFF", eyebrow: "#C7F464", strip: "#050B07", stripInk: "#EEF7EF",
      acc: "#C7F464", accInk: "#0A140E", price: "#C7F464", sec: "#C7F464", phStops: ["#0B6E4F", "#0B3D2C"], ph: "linear-gradient(180deg,#0B6E4F,#0B3D2C)", phInk: "#FFFFFF",
      chip: "#C7F464", chipInk: "#0A140E", sel: "#C7F464", selInk: "#C7F464", selOn: "#0A140E", cta: "#C7F464", ctaInk: "#0A140E", r: 8, rs: 6, rb: 6, grain: 0.18, btncase: "uppercase" } },
  frost: { key: "frost", label: "Frost", dot: "#A9CBFF", dark: false, font: "lexend", dw: 700,
    t: { bg: "#F3F8FF", surf: "#FFFFFF", surf2: "#EAF2FF", ink: "#10223F", mute: "#56688A", line: "#D8E4F5", band: "#F3F8FF", bandInk: "#10223F", eyebrow: "#2541B2", strip: "#FFFFFF", stripInk: "#10223F",
      acc: "#2541B2", accInk: "#FFFFFF", price: "#2541B2", sec: "#2541B2", phStops: ["#C9DEFF", "#A9CBFF", "#C3B6FF"], ph: "linear-gradient(135deg,#C9DEFF,#A9CBFF 50%,#C3B6FF)", phInk: "#10223F",
      chip: "#2541B2", chipInk: "#FFFFFF", sel: "#2541B2", selInk: "#2541B2", selOn: "#FFFFFF", cta: "#2541B2", ctaInk: "#FFFFFF", r: 22, rs: 12, rb: 999, grain: 0.08 } },
  mint: { key: "mint", label: "Mint Choc", dot: "#A8F0D1", dark: false, font: "young", dw: 400,
    t: { bg: "#F2FBF6", surf: "#FFFFFF", surf2: "#E6F7EE", ink: "#3B2219", mute: "#7A6259", line: "#D7EEE2", band: "#4A2C22", bandInk: "#F2FBF6", eyebrow: "#A8F0D1", strip: "#FFFFFF", stripInk: "#3B2219",
      acc: "#F27BA5", accInk: "#3B2219", price: "#4A2C22", sec: "#B23A6A", phStops: ["#4A2C22"], ph: "#4A2C22", phInk: "#F2FBF6",
      chip: "#4A2C22", chipInk: "#A8F0D1", sel: "#4A2C22", selInk: "#4A2C22", selOn: "#A8F0D1", cta: "#4A2C22", ctaInk: "#FFFFFF", r: 20, rs: 12, rb: 999, grain: 0.2 } },
  poster: { key: "poster", label: "Poster", dot: "#FF3B1F", dark: false, font: "shoulders", dw: 900, dcase: "uppercase",
    t: { bg: "#FFFFFF", surf: "#FFFFFF", surf2: "#F2F2F2", ink: "#000000", mute: "#555555", line: "#000000", band: "#000000", bandInk: "#FFFFFF", eyebrow: "#FF3B1F", strip: "#FFFFFF", stripInk: "#000000",
      acc: "#FF3B1F", accInk: "#000000", price: "#000000", sec: "#D42A10", phStops: ["#000000"], ph: "#000000", phInk: "#FFFFFF",
      chip: "#000000", chipInk: "#FFFFFF", sel: "#000000", selInk: "#000000", selOn: "#FFFFFF", cta: "#000000", ctaInk: "#FFFFFF", r: 0, rs: 0, rb: 999, grain: 0.1, btncase: "uppercase" } },
};

export const isNewTheme = (k: string): k is NewThemeKey => (NEW_THEME_KEYS as readonly string[]).includes(k);

/** Google Fonts stylesheet URL for a new theme's display font (null for the legacy ten, which use system fonts). */
export function themeFontHref(key: string): string | null {
  if (!isNewTheme(key)) return null;
  return `https://fonts.googleapis.com/css2?family=${FONT_QUERY[THEME_TOKENS[key].font]}&display=swap`;
}

// ── contrast ───────────────────────────────────────────────────────────────
const hex = (h: string): [number, number, number] => {
  const m = /^#([0-9a-f]{6})$/i.exec(h.trim());
  if (!m) throw new Error(`not a #rrggbb colour: ${h}`);
  return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)) as [number, number, number];
};
const lin = (v: number) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
export function luminance(h: string): number { const [r, g, b] = hex(h); return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b); }
export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** Every text-on-background pair the booking page actually renders, as [label, foreground, background]. */
export function contrastPairs(th: ThemeTokens): [string, string, string][] {
  const t = th.t;
  const pairs: [string, string, string][] = [];
  for (const [n, bg] of [["page", t.bg], ["card", t.surf], ["card2", t.surf2]] as const) {
    pairs.push([`ink on ${n}`, t.ink, bg], [`muted on ${n}`, t.mute, bg], [`price on ${n}`, t.price, bg], [`label on ${n}`, t.sec, bg]);
  }
  pairs.push(
    ["header text on header", t.bandInk, t.band], ["eyebrow on header", t.eyebrow, t.band],
    ["info strip text on strip", t.stripInk, t.strip], ["strip muted (text at 70%) uses ink on strip", t.stripInk, t.strip],
    ["tag text on accent", t.accInk, t.acc], ["step number on accent", t.accInk, t.acc],
    ["selected day text on chip", t.chipInk, t.chip], ["selected option text on card", t.selInk, t.surf],
    ["selected option text on page", t.selInk, t.bg], ["selected code text on selected fill", t.selOn, t.sel],
    ["main button text", t.ctaInk, t.cta],
  );
  for (const s of t.phStops) pairs.push([`booking header text on ${s}`, t.phInk, s]);
  return pairs;
}

/** Colours the decorative hero art draws readable text over (text colour, background). */
export const ART_TEXT_PAIRS: Partial<Record<NewThemeKey, [string, string, string][]>> = {
  varsity: [["motto on navy", "#F4E6C0", "#1A3358"], ["crest gold on shield", "#E5B94E", "#14213D"]],
  halftone: [["title on yellow slab", "#0A1F8F", "#F9E103"]],
  pirouette: [["title on blush", "#3B1F2B", "#FF9EB8"], ["title on lilac", "#3B1F2B", "#D3B2F2"]],
  riso: [["title on paper", "#1D1A2F", "#FBF4E4"], ["sticker", "#FFE800", "#1D1A2F"]],
  brite: [["headline on grape", "#FFFFFF", "#1E0A3C"], ["subhead", "#1E0A3C", "#FFD23F"]],
  pitch: [["title on pitch", "#FFFFFF", "#0B3D2C"], ["lime on pitch", "#C7F464", "#0B3D2C"]],
  frost: [["glass title", "#10223F", "#CFE0FF"], ["glass kicker", "#2541B2", "#CFE0FF"]],
  poster: [["filled line", "#FFFFFF", "#000000"], ["date line", "#FFFFFF", "#000000"]],
  plum: [["title on plum", "#E9F056", "#351E28"]],
};
