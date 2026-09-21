// Our own art kit — the drawing rules every ownArt picture follows, so the pictures read as ONE friendly, modern flat style:
//   · flat fills only, rounded shapes, a lighter and a darker tone of the base colour for volume (no outlines, no gradients on objects);
//   · one soft contact shadow under things that stand or drive;
//   · the palette is the app's own (app/globals.css: --brand, --brand-2, --green, --gold, --red, --violet, --ink) plus a bright supporting set;
//   · white "colour me in" items are the one exception that gets a thin outline (so a child can see the edges);
//   · icons are solid white glyphs with chunky round strokes, for the coloured slide headers.
// Everything here is plain string SVG (no fonts, no filters) so sharp/librsvg rasterises it identically everywhere.

export const P = {
  ink: "#171534", navy: "#23264a", brand: "#1d3a8f", brand2: "#2f6bd8", green: "#15b364", mint: "#2ccf85", gold: "#f5b81f", yellow: "#ffd23f",
  red: "#e21d27", violet: "#6a4fd0", orange: "#f0731c", pink: "#ff9db1", peach: "#ffb89a", teal: "#0fa3a3", white: "#ffffff", paper: "#f4f6fb",
  glass: "#d7ebff", glass2: "#a9cdf2",
};

export const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
export const rgb = (c: number[]) => "#" + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
/** mix colour a towards b by t (0..1) */
export const mix = (a: string, b: string, t: number) => { const x = hex(a), y = hex(b); return rgb(x.map((v, i) => v + (y[i]! - v) * t)); };
export const light = (c: string, t = 0.3) => mix(c, "#ffffff", t);
export const dark = (c: string, t = 0.22) => mix(c, "#171534", t);
const n = (v: number) => +v.toFixed(2);

/** Wrap a drawing: `w`x`h` are the ORIGINAL picture's pixel size (what sharp renders), the view box is the design space. */
export function svg(w: number, h: number, body: string, vw = w, vh = h, defs = ""): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${vw} ${vh}" preserveAspectRatio="none">${defs ? `<defs>${defs}</defs>` : ""}${body}</svg>\n`;
}
/** soft contact shadow (a radial fade, no filter) */
export function shadow(id: string, cx: number, cy: number, rx: number, ry: number, op = 0.2): { defs: string; body: string } {
  return {
    defs: `<radialGradient id="${id}"><stop offset="0" stop-color="${P.ink}" stop-opacity="${op}"/><stop offset="0.7" stop-color="${P.ink}" stop-opacity="${op * 0.55}"/><stop offset="1" stop-color="${P.ink}" stop-opacity="0"/></radialGradient>`,
    body: `<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(rx)}" ry="${n(ry)}" fill="url(#${id})"/>`,
  };
}

// ── car (drives to the right; the deck flips it where it needs a car facing left) ──────────────────────────────────────────────
// Design space 891x422. The label the deck writes over the door ("BLACK", "YELLOW"…) sits in x 220-670, y 195-290: keep it plain body colour.
export function car(o: { body: string; outline?: boolean; w?: number; h?: number; id: string }): string {
  const { body, outline = false, id } = o;
  const w = o.w ?? 891, h = o.h ?? 422;
  const hi = light(body, 0.32), lo = dark(body, 0.2), arch = dark(body, 0.5);
  const st = outline ? ` stroke="#aeb6d6" stroke-width="5" stroke-linejoin="round"` : "";
  const glassStroke = outline ? ` stroke="#aeb6d6" stroke-width="4"` : "";
  const sh = shadow(`${id}s`, 445, 408, 425, 12, 0.22);
  const wheel = (cx: number) => `<circle cx="${cx}" cy="345" r="70" fill="${P.navy}"/><circle cx="${cx}" cy="345" r="42" fill="#e8ebf5"/><circle cx="${cx}" cy="345" r="15" fill="#98a0bd"/>` +
    [0, 72, 144, 216, 288].map((a) => `<circle cx="${n(cx + 28 * Math.cos((a * Math.PI) / 180))}" cy="${n(345 + 28 * Math.sin((a * Math.PI) / 180))}" r="4.5" fill="#98a0bd"/>`).join("");
  const body_ = `
<clipPath id="${id}c"><rect x="14" y="175" width="863" height="170" rx="62"/></clipPath>
<clipPath id="${id}a"><rect x="0" y="0" width="891" height="345"/></clipPath>
${sh.body}
<path d="M178 186 C196 84 262 18 372 18 L548 18 C640 18 690 74 722 186 Z" fill="${body}"${st}/>
<rect x="14" y="175" width="863" height="170" rx="62" fill="${body}"${st}/>
<g clip-path="url(#${id}c)"><rect x="0" y="292" width="891" height="60" fill="${lo}"/><rect x="60" y="184" width="770" height="9" rx="4.5" fill="${hi}" opacity="0.85"/></g>
<path d="M208 172 C224 96 268 46 350 46 L398 46 L398 172 Z" fill="${P.glass}"${glassStroke}/>
<path d="M426 46 L540 46 C608 46 648 92 684 172 L426 172 Z" fill="${P.glass}"${glassStroke}/>
<path d="M246 160 L300 58 L332 58 L272 160 Z" fill="#fff" opacity="0.55"/><path d="M462 160 L512 58 L536 58 L490 160 Z" fill="#fff" opacity="0.55"/>
<rect x="694" y="150" width="38" height="24" rx="12" fill="${lo}"/>
<rect x="2" y="286" width="40" height="40" rx="16" fill="#e6e9f4"/><rect x="849" y="286" width="40" height="40" rx="16" fill="#e6e9f4"/>
<rect x="20" y="206" width="24" height="54" rx="12" fill="${body === P.red ? "#ffc23d" : "#ff5a4d"}"/>
<ellipse cx="850" cy="222" rx="26" ry="32" fill="#fff4bf"/><ellipse cx="850" cy="222" rx="14" ry="20" fill="#ffe27a"/>
<g clip-path="url(#${id}a)"><circle cx="218" cy="345" r="88" fill="${arch}"/><circle cx="682" cy="345" r="88" fill="${arch}"/></g>
${wheel(218)}${wheel(682)}`;
  return svg(w, h, body_, 891, 422, sh.defs);
}

// ── traffic light 381x873: RED is lit, amber and green are off ───────────────────────────────────────────────────────────────
export function trafficLight(w = 381, h = 873): string {
  const lamp = (cy: number, on: string | null) => `<circle cx="190" cy="${cy}" r="80" fill="${on ?? "#3b3f68"}"/>` + (on ? `<circle cx="168" cy="${cy - 26}" r="22" fill="#fff" opacity="0.4"/>` : `<circle cx="168" cy="${cy - 26}" r="18" fill="#fff" opacity="0.08"/>`);
  const visor = (cy: number) => `<path d="M100 ${cy - 34} C104 ${cy - 100} 276 ${cy - 100} 280 ${cy - 34} L306 ${cy - 44} C296 ${cy - 130} 84 ${cy - 130} 74 ${cy - 44} Z" fill="${P.ink}"/>`;
  const sh = shadow("tls", 190, 812, 175, 14, 0.25);
  const body = `${sh.body}
<rect x="164" y="560" width="52" height="240" fill="#5b5f88"/><rect x="164" y="560" width="20" height="240" fill="#6f74a0"/>
<rect x="70" y="786" width="240" height="34" rx="17" fill="${P.navy}"/>
<rect x="46" y="24" width="288" height="560" rx="62" fill="${P.navy}"/><rect x="46" y="24" width="30" height="560" rx="15" fill="#3a3f72"/>
<circle cx="190" cy="142" r="118" fill="#ff5a5f" opacity="0.28"/>
${visor(142)}${visor(316)}${visor(490)}
${lamp(142, "#ff3b3f")}${lamp(316, null)}${lamp(490, null)}`;
  return svg(w, h, body, 381, 873, sh.defs);
}

// ── door 260x535 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
export function door(w = 260, h = 535): string {
  const body = `<rect x="0" y="0" width="260" height="535" rx="16" fill="${P.brand}"/>
<rect x="22" y="22" width="216" height="513" rx="6" fill="${P.brand2}"/>
<rect x="22" y="22" width="24" height="513" rx="6" fill="${light(P.brand2, 0.14)}"/>
<rect x="56" y="58" width="150" height="190" rx="12" fill="${dark(P.brand2, 0.16)}"/><rect x="62" y="64" width="150" height="190" rx="12" fill="${light(P.brand2, 0.28)}"/>
<rect x="56" y="284" width="150" height="200" rx="12" fill="${dark(P.brand2, 0.16)}"/><rect x="62" y="290" width="150" height="200" rx="12" fill="${light(P.brand2, 0.28)}"/>
<circle cx="210" cy="288" r="22" fill="${dark(P.gold, 0.2)}"/><circle cx="208" cy="285" r="18" fill="${P.gold}"/><circle cx="202" cy="279" r="6" fill="#fff" opacity="0.55"/>`;
  return svg(w, h, body, 260, 535);
}

// ── chequered flag 223x280: pole on the left, the flag hangs from its top ────────────────────────────────────────────────────────
export function flag(w = 223, h = 280): string {
  const cw = 42, ch = 40;
  let cells = "";
  for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) cells += `<rect x="${12 + c * cw}" y="${2 + r * ch}" width="${cw + 0.5}" height="${ch + 0.5}" fill="${(r + c) % 2 ? "#eef1fa" : P.ink}"/>`;
  const body = `<clipPath id="fc"><rect x="12" y="2" width="210" height="120" rx="9"/></clipPath>
<rect x="0" y="0" width="12" height="280" rx="6" fill="${P.navy}"/>
<g clip-path="url(#fc)">${cells}</g>
<rect x="12" y="2" width="210" height="120" rx="9" fill="none" stroke="${P.navy}" stroke-width="4"/>`;
  return svg(w, h, body, 223, 280);
}

// ── header icons, solid white, 120x120 ──────────────────────────────────────────────────────────────────────────────────────────
const W = "#ffffff";
export const iconTalk = () => svg(120, 120, `<circle cx="42" cy="42" r="19" fill="${W}"/><path d="M6 97 C6 70 22 63 42 63 C62 63 78 70 78 97 Z" fill="${W}"/><rect x="68" y="22" width="47" height="34" rx="15" fill="${W}"/><path d="M78 52 L80 72 L96 54 Z" fill="${W}"/>`);
export const iconQuestion = () => svg(120, 120, `<mask id="m"><rect width="120" height="120" fill="#fff"/><path d="M33 46 C33 35 51 35 51 46 C51 54 42 54 42 62" fill="none" stroke="#000" stroke-width="7" stroke-linecap="round"/><circle cx="42" cy="73" r="4.6" fill="#000"/><path d="M78 68 L87 77 L102 60" fill="none" stroke="#000" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"/></mask>
<g mask="url(#m)"><circle cx="42" cy="53" r="28" fill="${W}"/><path d="M26 74 L28 90 L46 79 Z" fill="${W}"/><rect x="64" y="50" width="46" height="38" rx="13" fill="${W}"/></g>`);
export const iconPuzzle = () => svg(120, 120, `<mask id="m"><rect width="120" height="120" fill="#fff"/><circle cx="14" cy="70" r="11" fill="#000"/></mask><g mask="url(#m)"><rect x="15" y="38" width="78" height="64" rx="11" fill="${W}"/><circle cx="54" cy="32" r="15" fill="${W}"/><circle cx="93" cy="70" r="11" fill="${W}"/></g>`);
export const iconSwap = () => svg(120, 120, `<g fill="none" stroke="${W}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"><path d="M22 38 H95 M80 26 L96 38 L80 50"/><path d="M98 81 H25 M40 69 L24 81 L40 93"/></g>`);
export const iconTick = () => svg(288, 305, `<path d="M30 176 L108 262 L258 32" fill="none" stroke="${P.green}" stroke-width="52" stroke-linecap="round" stroke-linejoin="round"/>`);
