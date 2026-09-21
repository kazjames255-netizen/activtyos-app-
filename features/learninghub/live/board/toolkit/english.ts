import { PASTEL, list, num, type ToolItem } from "./kit";

export const WORD_CLASSES: { label: string; colour: string }[] = [
  { label: "Noun", colour: "#cfe4ff" }, { label: "Verb", colour: "#ffd6d6" }, { label: "Adjective", colour: "#c9f0d6" }, { label: "Adverb", colour: "#ffe3c2" },
  { label: "Pronoun", colour: "#e6dcff" }, { label: "Preposition", colour: "#fff3b0" }, { label: "Conjunction", colour: "#d6f0ef" },
];

/** A shuffle of 0..n-1 that depends only on `seed` (so it is stable) and is NEVER the original order (for n ≥ 2). */
export function scramble(n: number, seed: string): number[] {
  const a = Array.from({ length: n }, (_, i) => i);
  let h = 2166136261; for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  const rnd = () => { h = (Math.imul(h, 1664525) + 1013904223) >>> 0; return h / 4294967296; };
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j]!, a[i]!]; }
  if (n >= 2 && a.every((v, i) => v === i)) a.push(a.shift()!); // identity: rotate by one
  return a;
}

const frame = (b: import("./kit").B, c: import("./kit").Ctx, rows: [string, string][], w = 640) => {
  let y = 0;
  rows.forEach(([head, hint], i) => { b.cell(0, y, 150, 96, { c: c.brand, w: 3, fill: PASTEL[i % PASTEL.length], text: head, size: 26, bold: true }); b.cell(150, y, w - 150, 96, { c: c.brand, w: 3, ph: hint, size: 22, al: "l", va: "t" }); y += 108; });
};

export const ENGLISH: ToolItem[] = [
  { id: "e-hand", pack: "english", label: "Handwriting lines", sub: "baseline, dotted midline, top line", levels: ["early"], bg: "handwriting" },
  { id: "e-lined", pack: "english", label: "Lined paper", bg: "lined" },
  { id: "e-2col", pack: "english", label: "Two-column notes", bg: "twocol" },
  { id: "e-storymap", pack: "english", label: "Story map page", sub: "Opening · Build-up · Problem · Resolution · Ending, as the page background", tags: "frame planning narrative", bg: "storymap" },
  { id: "e-phonics", pack: "english", label: "Phonics cards", sub: "big grapheme / sound cards", levels: ["early"], params: [{ k: "g", label: "Graphemes (comma separated)", type: "list", def: "sh, ch, th, ai, ee, oa" }],
    make: (b, c, v) => { list(v.g, ["sh"]).slice(0, 12).forEach((g, i) => { const x = (i % 4) * 190, y = Math.floor(i / 4) * 200; b.cell(x, y, 170, 180, { c: c.brand, w: 4, fill: PASTEL[i % PASTEL.length], text: g, size: 84, bold: true }); b.line(x + 20, y + 152, x + 150, y + 152, { c: c.ink, w: 2 }); }); } },
  { id: "e-wordbank", pack: "english", label: "Word bank", sub: "drag-and-drop word tiles", levels: ["early", "standard"], params: [{ k: "w", label: "Words (comma separated)", type: "list", def: "quickly, happy, run, castle, brave, because" }],
    make: (b, c, v) => { list(v.w, ["word"]).slice(0, 24).forEach((w, i) => b.sticky((i % 4) * 176, Math.floor(i / 4) * 78, 164, 64, w, PASTEL[i % PASTEL.length], 24)); } },
  { id: "e-sentence", pack: "english", label: "Sentence builder", sub: "arrange the tiles into a sentence", levels: ["early", "standard"], params: [{ k: "w", label: "Sentence (tiles are cut at spaces)", type: "text", def: "The brave knight walked slowly home." }],
    make: (b, c, v) => { const ws = String(v.w).split(/\s+/).filter(Boolean).slice(0, 14); const arr = scramble(ws.length, String(v.w)); arr.forEach((wi, i) => b.sticky((i % 5) * 170, Math.floor(i / 5) * 76, 160, 62, ws[wi]!, PASTEL[wi % PASTEL.length], 24)); const rows = Math.ceil(ws.length / 5); b.line(0, rows * 76 + 60, 850, rows * 76 + 60, { w: 3 }); b.text(0, rows * 76 + 66, "My sentence:", { size: 18, c: "#5b6b8c" }); } },
  { id: "e-wordclass", pack: "english", label: "Word-class colour key", sub: "then highlight with matching colours", levels: ["standard", "advanced", "early"], make: (b, c) => { WORD_CLASSES.forEach((w, i) => { b.rect(0, i * 56, 44, 40, { c: c.ink, w: 2, fill: w.colour }); b.text(60, i * 56 + 4, w.label, { size: 26, bold: true }); }); } },
  { id: "e-mountain", pack: "english", label: "Story mountain", levels: ["early", "standard"], make: (b, c) => { b.path([[-400, 200], [-200, 20], [0, -170], [200, 20], [400, 200]], { w: 6, c: c.brand }); b.line(-450, 200, 450, 200, { w: 3 }); b.tc(-380, 235, "Opening", { size: 24, bold: true }); b.tc(-190, -30, "Build-up", { size: 24, bold: true }); b.tc(0, -215, "Problem / climax", { size: 24, bold: true, c: c.danger }); b.tc(200, -30, "Resolution", { size: 24, bold: true }); b.tc(390, 235, "Ending", { size: 24, bold: true }); } },
  { id: "e-peel", pack: "english", label: "PEE / PEEL paragraph frame", levels: ["standard", "advanced"], params: [{ k: "t", label: "Style", type: "select", def: "PEEL", options: ["PEE", "PEEL", "PEEL (History)"] }],
    make: (b, c, v) => { const t = String(v.t); const rows: [string, string][] = t === "PEE" ? [["Point", "Make your point clearly."], ["Evidence", "Quote or refer to the text."], ["Explain", "How does it prove your point?"]] : t === "PEEL (History)" ? [["Point", "Answer the question."], ["Evidence", "A fact, date or source."], ["Explain", "Why does it matter?"], ["Link", "Link to the question / next point."]] : [["Point", "Make your point clearly."], ["Evidence", "Quote or refer to the text."], ["Explain", "How does it prove your point?"], ["Link", "Link back to the question."]]; frame(b, c, rows); } },
  { id: "e-essay", pack: "english", label: "Essay plan grid", levels: ["standard", "advanced"], params: [{ k: "n", label: "Body paragraphs", type: "number", def: 3 }], make: (b, c, v) => { const n = Math.max(1, Math.min(6, num(v.n, 3))); const rows: [string, string][] = [["Intro", "Hook · thesis · outline"], ...Array.from({ length: n }, (_, i) => [`Para ${i + 1}`, "Point · evidence · explain · link"] as [string, string]), ["Conclusion", "Sum up · final thought"]]; frame(b, c, rows, 720); } },
  { id: "e-poem", pack: "english", label: "Poetry annotation frame", sub: "poem in the middle, margin boxes either side", levels: ["standard", "advanced"], params: [{ k: "poem", label: "Poem text", type: "text", def: "Type or paste the poem here.\nEach line on its own line." }],
    make: (b, c, v) => { const lines = String(v.poem).split("\n").slice(0, 16); b.stamp("textblock", 0, 0, 520, 60 + lines.length * 42, { text: lines.join("\n"), size: 26 }); for (const x of [-290, 560]) for (let i = 0; i < 4; i++) b.cell(x, i * 110, 260, 96, { c: c.brand, w: 2.5, dash: true, al: "l", va: "t", size: 20 }); b.text(-290, -34, "Language / structure", { size: 18, bold: true, c: c.brand }); b.text(560, -34, "Effect on the reader", { size: 18, bold: true, c: c.brand }); } },
  { id: "e-annotate", pack: "english", label: "Text to annotate", sub: "paste a text, then highlight / underline / circle / add margin notes", levels: ["early", "standard", "advanced"], params: [{ k: "text", label: "Text", type: "text", def: "Paste or type a text here." }, { k: "size", label: "Text size", type: "number", def: 26 }],
    make: (b, c, v) => { b.stamp("textblock", 0, 0, 760, 400, { text: String(v.text), size: num(v.size, 26) }); void c; } },
  { id: "e-venn", pack: "english", label: "Compare (Venn)", make: (b) => { b.ellipse(-110, 0, 170, 150, { c: "#2f6bd8", w: 4 }); b.ellipse(110, 0, 170, 150, { c: "#e21d27", w: 4 }); } },
  { id: "e-char", pack: "english", label: "Characterisation grid", levels: ["standard", "advanced"], params: [{ k: "n", label: "Characters", type: "number", def: 3 }], make: (b, c, v) => { const n = Math.max(1, Math.min(5, num(v.n, 3))); b.table(0, 0, [170, ...Array(4).fill(190)], [54, ...Array(n).fill(120)], { head: ["Character", "What they say", "What they do", "What others say", "How I feel"], headFill: "#eaf0fc", size: 18 }); void c; } },
  { id: "e-5w", pack: "english", label: "Who · What · Where · When · Why", levels: ["early", "standard"], make: (b, c) => { ["Who?", "What?", "Where?", "When?", "Why?"].forEach((t, i) => { b.cell(0, i * 110, 170, 96, { c: c.brand, w: 3, fill: PASTEL[i], text: t, size: 34, bold: true }); b.cell(170, i * 110, 470, 96, { c: c.brand, w: 3, ph: "Write here…", size: 26, al: "l", va: "t" }); }); } },
];
