// Maths KS1-KS2 extension pictures, part 1: number, place value and the four operations (agent X1).
// Every diagram shows an IDEA (a structure, a layout, a definition); pictures whose drawing implies a specific quantity are `numeric` (refused on slides
// that contain digits). Geometry is computed, never eyeballed.
import type { Pic } from "./types";
import { mk, box, hop, line, counters, digitBox, head, ln, rect, txt, circ, dot, poly, path, cap, arrow, n } from "./ext-maths-primary-kit";

const G = (id: string) => ({ id });
void G;

// ── place value ────────────────────────────────────────────────────────────────
/** grid lines (th) inside a rect divided into c columns and r rows */
const grid = (x: number, y: number, w: number, h: number, c: number, r: number, cls = "th") => {
  let s = "";
  for (let i = 1; i < c; i++) s += ln(x + (w * i) / c, y, x + (w * i) / c, y + h, cls);
  for (let j = 1; j < r; j++) s += ln(x, y + (h * j) / r, x + w, y + (h * j) / r, cls);
  return s;
};
const baseTen = (() => {
  const u = 7; // one unit cube = 7 x 7
  let s = rect(12, 18, 10 * u, 10 * u, "l f1") + grid(12, 18, 10 * u, 10 * u, 10, 10);
  s += rect(104, 18, u, 10 * u, "l f3") + grid(104, 18, u, 10 * u, 1, 10);
  s += rect(140, 18 + 9 * u, u, u, "l f4");
  s += txt(47, 106, "1 hundred", "ts") + txt(107.5, 106, "1 ten", "ts") + txt(143.5, 106, "1 one", "ts");
  s += txt(47, 119, "(10 tens)", "tx tm") + txt(107.5, 119, "(10 ones)", "tx tm");
  return s + cap("base 10 blocks: 10 ones make a ten, 10 tens make a hundred", 160, 44);
})();
const regroup = (() => {
  let s = "";
  for (let i = 0; i < 10; i++) s += rect(60 + i * 12, 24, 12, 14, "l f4");
  s += rect(60, 88, 120, 14, "l f3") + grid(60, 88, 120, 14, 10, 1, "th");
  s += txt(52, 35, "10 ones", "ts te") + txt(52, 99, "1 ten", "ts te");
  s += arrow(120, 66, 120, 84, "a", 7) + arrow(120, 60, 120, 42, "a", 7) + txt(132, 66, "regroup", "ts tl ta");
  return s + cap("regrouping: 10 ones make 1 ten and 1 ten makes 10 ones (tens and hundreds work the same way)", 158, 42);
})();
const tensOnes = (() => {
  let s = rect(16, 22, 100, 96, "l f0", 6) + rect(124, 22, 100, 96, "l f0", 6);
  s += txt(66, 40, "Tens", "tb") + txt(174, 40, "Ones", "tb");
  s += rect(60, 50, 12, 58, "l f3") + grid(60, 50, 12, 58, 1, 10, "th");
  s += rect(168, 96, 12, 12, "l f4");
  s += txt(66, 132, "a ten rod is", "tx tm") + txt(66, 143, "worth 10 ones", "tx tm") + txt(174, 132, "a one cube is", "tx tm") + txt(174, 143, "worth 1", "tx tm");
  return s + cap("tens and ones", 160);
})();
const hto = (() => {
  const u = 3.6, cx = [30, 88, 146, 204], names = ["Thousands", "Hundreds", "Tens", "Ones"], vals = ["1000", "100", "10", "1"];
  let s = "";
  cx.forEach((c, i) => s += txt(c, 14, names[i], "tx"));
  // thousand cube (oblique, 10 x 10 x 10 units)
  const f = 10 * u, x0 = cx[0] - f / 2 - 4, y0 = 100, dx = 9, dy = -8;
  s += poly([[x0, y0], [x0 + f, y0], [x0 + f, y0 - f], [x0, y0 - f]], "l f1") + poly([[x0, y0 - f], [x0 + f, y0 - f], [x0 + f + dx, y0 - f + dy], [x0 + dx, y0 - f + dy]], "l f3") + poly([[x0 + f, y0], [x0 + f, y0 - f], [x0 + f + dx, y0 - f + dy], [x0 + f + dx, y0 + dy]], "l f4");
  s += rect(cx[1] - f / 2, y0 - f, f, f, "l f1") + grid(cx[1] - f / 2, y0 - f, f, f, 10, 10);
  s += rect(cx[2] - u / 2, y0 - f, u, f, "l f3") + grid(cx[2] - u / 2, y0 - f, u, f, 1, 10);
  s += rect(cx[3] - u / 2, y0 - u, u, u, "l f4");
  cx.forEach((c, i) => s += txt(c, 120, vals[i], "tb"));
  s += arrow(212, 136, 30, 136, "a", 7);
  return s + cap("each block is 10 times the value of the block to its right", 160, 44);
})();

// ── counting on number lines ─────────────────────────────────────────────────────
const countFB = (() => {
  const x0 = 30, x1 = 210, k = 8, st = (x1 - x0) / k, y = 86;
  let s = line(x0, x1, y, k);
  for (let i = 0; i < 3; i++) s += hop(x0 + i * st, x0 + (i + 1) * st, y, true, "a", "hda", 14);
  for (let i = 0; i < 3; i++) s += hop(x0 + (8 - i) * st, x0 + (7 - i) * st, y, false, "ar", "hdr", 14);
  s += txt(120, 40, "counting forwards: the numbers get bigger", "tx ta") + txt(120, 152, "counting backwards: the numbers get smaller", "tx tr");
  return s;
})();
const skipCount = (() => {
  const x0 = 26, x1 = 206, k = 6, st = (x1 - x0) / k, y = 104;
  let s = line(x0, x1, y, k, (i) => (i === 0 ? "start" : ""));
  for (let i = 0; i < k; i++) s += hop(x0 + i * st, x0 + (i + 1) * st, y, true, "a", "hda", 24);
  return s + txt(120, 40, "every jump is the same size", "ts ta") + cap("skip counting: count on in equal jumps of the same size", 158, 44);
})();
const multiples = (() => {
  const x0 = 26, x1 = 206, k = 6, st = (x1 - x0) / k, y = 104;
  let s = line(x0, x1, y, k, (i) => (i === 0 ? "0" : i === 1 ? "n" : `${i}n`));
  for (let i = 0; i < k; i++) { s += hop(x0 + i * st, x0 + (i + 1) * st, y, true, "a", "hda", 24); s += txt(x0 + (i + 0.5) * st, 66, "+n", "tx tm"); }
  return s + txt(120, 34, "multiples of a number n", "ts ta") + cap("count on in equal jumps of n from 0: n, 2n, 3n, 4n, ... are multiples of n", 152, 46);
})();
const decades = (() => {
  const x0 = 26, x1 = 210, k = 10, st = (x1 - x0) / k, y = 86;
  let s = line(x0, x1, y, k, (i) => String(i * 10), 6, "tx");
  for (let i = 0; i < 10; i++) s += hop(x0 + i * st, x0 + (i + 1) * st, y, true, "a", "hda", 16);
  return s + txt(120, 40, "counting in tens: the multiples of 10", "ts ta") + cap("0, 10, 20, 30, ... 100: each jump is 10", 152);
})();
const bridging = (() => {
  const x0 = 30, x1 = 210, k = 8, st = (x1 - x0) / k;
  const row = (y: number, ai: number, ti: number, bi: number, title: string, up: boolean) => {
    let s = txt(8, y - 40, title, "tx tl tm") + line(x0, x1, y, k);
    s += ln(x0 + ti * st, y - 12, x0 + ti * st, y + 12, "ao") + txt(x0 + ti * st, y + 26, "ten", "ts");
    s += txt(x0 + ai * st, y + 26, "start", "ts");
    s += hop(x0 + ai * st, x0 + ti * st, y, true, up ? "a" : "ar", up ? "hda" : "hdr", 20);
    s += hop(x0 + ti * st, x0 + bi * st, y, true, up ? "a" : "ar", up ? "hda" : "hdr", 14);
    return s;
  };
  return row(60, 1, 4, 6, "adding: jump to the next ten, then the rest", true) + row(140, 7, 4, 2, "subtracting: jump back to the ten, then the rest", false);
})();

// ── the words of each operation ─────────────────────────────────────────────────
/** three boxes joined by two signs, with a note under each; `res` = fill of the result box */
const eqRow = (labels: [string, string, string], signs: [string, string], notes: [string, string, string], fills = ["f1", "f1", "f3"]) => {
  const xs = [6, 88, 170], w = 64, y = 30;
  let s = "";
  xs.forEach((x, i) => { s += box(x, y, w, 34, labels[i], fills[i], "tx"); s += txt(x + w / 2, y + 52, notes[i], "tx tm"); });
  s += txt(79, y + 22, signs[0], "tb") + txt(161, y + 22, signs[1], "tb");
  return s;
};
const two = (a: string, b: string, x: number, y: number) => txt(x, y, a, "tx tm") + txt(x, y + 11, b, "tx tm");
const eqRow2 = (labels: [string, string, string], signs: [string, string], notes: [[string, string], [string, string], [string, string]], fills = ["f1", "f1", "f3"]) => {
  const xs = [6, 88, 170], w = 64, y = 26;
  let s = "";
  xs.forEach((x, i) => { s += box(x, y, w, 34, labels[i], fills[i], "tx"); s += two(notes[i][0], notes[i][1], x + w / 2, y + 50); });
  s += txt(79, y + 22, signs[0], "tb") + txt(161, y + 22, signs[1], "tb");
  return s;
};
const addTerms = eqRow2(["addend", "addend", "sum"], ["+", "="], [["a number that", "is added"], ["a number that", "is added"], ["the total,", "the result"]]) + txt(120, 128, "there can be more than two addends:", "tx tm") + txt(120, 141, "addend + addend + addend = sum", "ts");
const subTerms = eqRow2(["minuend", "subtrahend", "difference"], ["−", "="], [["the number we", "start with"], ["the number that", "is taken away"], ["what is left,", "the result"]]) + txt(120, 134, "minuend − subtrahend = difference", "ts");
const mulTerms = eqRow2(["factor", "factor", "product"], ["×", "="], [["a number that", "is multiplied"], ["a number that", "is multiplied"], ["the answer,", "the result"]]) + txt(120, 134, "factor × factor = product", "ts");
const divTerms = eqRow2(["dividend", "divisor", "quotient"], ["÷", "="], [["the number", "being divided"], ["the number", "we divide by"], ["the answer,", "how many fit"]]) + txt(120, 120, "and the remainder is what is left over", "tx tm") + txt(120, 133, "when it does not divide exactly", "tx tm") + txt(120, 150, "dividend ÷ divisor = quotient", "ts");

// ── laws of arithmetic ───────────────────────────────────────────────────────────
const commutative = (() => {
  let s = txt(10, 30, "a + b", "ts tl") + rect(56, 16, 70, 18, "l f1") + rect(126, 16, 40, 18, "l f3") + txt(91, 29, "a", "ts") + txt(146, 29, "b", "ts");
  s += rect(56, 38, 40, 18, "l f3") + rect(96, 38, 70, 18, "l f1") + txt(76, 51, "b", "ts") + txt(131, 51, "a", "ts") + txt(10, 52, "b + a", "ts tl");
  s += txt(176, 39, "= same total", "ts tl");
  s += counters(30, 78, 3, 5, 10, 3.6) + txt(50, 118, "a × b", "ts");
  s += txt(120, 96, "=", "tb") + counters(160, 74, 5, 3, 10, 3.6, "l f3") + txt(170, 124, "b × a", "ts");
  return s + txt(120, 146, "the order does not change the answer", "tx") + txt(120, 158, "when adding or multiplying", "tx tm");
})();
const associative = (() => {
  const x = 40, ws = [50, 36, 44], y1 = 40, y2 = 108, fills = ["f1", "f3", "f2"];
  const bars = (y: number) => { let s = "", xx = x; ws.forEach((w, i) => { s += rect(xx, y, w, 18, `l ${fills[i]}`) + txt(xx + w / 2, y + 13, "abc"[i], "ts"); xx += w; }); return s; };
  const br = (x1: number, x2: number, y: number) => path(`M${n(x1)} ${n(y)} v-6 H${n(x2)} v6`, "l");
  let s = bars(y1) + br(x, x + 86, y1 - 4) + txt(x + 43, y1 - 14, "(a + b) + c", "ts");
  s += txt(120, 82, "=", "tb");
  s += bars(y2) + br(x + 50, x + 130, y2 - 4) + txt(x + 90, y2 - 14, "a + (b + c)", "ts");
  return s + cap("the grouping does not change the total", 156, 44);
})();
const distributive = (() => {
  const x0 = 60, y0 = 44, wb = 80, wc = 50, h = 56;
  let s = rect(x0, y0, wb, h, "l f1") + rect(x0 + wb, y0, wc, h, "l f3");
  s += txt(x0 + wb / 2, y0 + h / 2 + 4, "a × b", "ts") + txt(x0 + wb + wc / 2, y0 + h / 2 + 4, "a × c", "ts");
  s += txt(x0 + wb / 2, y0 - 6, "b", "ts") + txt(x0 + wb + wc / 2, y0 - 6, "c", "ts") + txt(x0 - 8, y0 + h / 2 + 4, "a", "ts te");
  s += path(`M${x0} ${y0 - 18} v-5 H${x0 + wb + wc} v5`, "th2") + txt(x0 + (wb + wc) / 2, y0 - 27, "b + c", "ts");
  return s + txt(120, 128, "a × (b + c) = a × b + a × c", "tb") + cap("the distributive law: multiply each part, then add", 156);
})();
const inverse = (() => {
  let s = txt(64, 14, "add and subtract", "tx tm") + txt(178, 14, "multiply and divide", "tx tm");
  s += rect(14, 24, 100, 18, "l f3") + txt(64, 37, "c", "ts") + rect(14, 46, 60, 18, "l f1") + rect(74, 46, 40, 18, "l f2") + txt(44, 59, "a", "ts") + txt(94, 59, "b", "ts");
  s += txt(64, 84, "a + b = c", "ts") + txt(64, 98, "c − b = a", "ts") + txt(64, 112, "c − a = b", "ts");
  s += counters(142, 34, 3, 4, 12, 4.4) + txt(178, 92, "a × b = c", "ts") + txt(178, 106, "c ÷ b = a", "ts") + txt(178, 120, "c ÷ a = b", "ts");
  return s + cap("inverse operations undo each other", 156);
})();

// ── groups, sharing, doubling ────────────────────────────────────────────────────
const equalGroups = (() => {
  let s = "";
  [45, 120, 195].forEach((cx, i) => { s += circ(cx, 58, 27, "l f0") + counters(cx - 7, 51, 2, 2, 14, 5.2, "l f1"); if (i < 2) s += txt(cx + 37.5, 64, "+", "tb"); });
  s += txt(120, 108, "the same number in each group", "ts");
  return s + cap("equal groups: repeated addition means adding the same number again and again", 152, 42);
})();
const sharing = (() => {
  let s = txt(60, 14, "sharing", "ts ta") + txt(180, 14, "grouping", "ts tr");
  s += counters(36, 32, 1, 6, 12, 4.6) + counters(156, 32, 1, 6, 12, 4.6);
  s += arrow(48, 42, 42, 68, "th", 5) + arrow(84, 42, 84, 68, "th", 5);
  [40, 84].forEach((cx) => { s += circ(cx, 92, 20, "l f0") + circ(cx - 7, 87, 4.4, "l f1") + circ(cx + 7, 87, 4.4, "l f1") + circ(cx, 100, 4.4, "l f1"); });
  [146, 180, 214].forEach((cx) => { s += circ(cx, 92, 16, "l f0") + circ(cx - 5.5, 92, 4.4, "l f1") + circ(cx + 5.5, 92, 4.4, "l f1"); });
  s += ln(120, 24, 120, 130, "th");
  s += txt(62, 128, "share out equally:", "tx tm") + txt(62, 140, "how many in each group?", "tx tm") + txt(180, 128, "make equal groups:", "tx tm") + txt(180, 140, "how many groups?", "tx tm");
  return s + cap("division as sharing and as grouping", 162);
})();
const doubling = (() => {
  let s = txt(64, 14, "double", "ts ta") + txt(180, 14, "halve", "ts tr") + ln(120, 20, 120, 130, "th");
  s += counters(38, 40, 1, 4, 13, 5, "l f1") + counters(38, 58, 1, 4, 13, 5, "l f3");
  s += txt(64, 88, "two equal groups", "tx tm") + txt(64, 100, "double = ×2", "tx tm");
  s += counters(134, 50, 1, 8, 12, 4.8, "l f1") + ln(176, 40, 176, 62, "h") + path("M129 68 v6 H173 v-6", "th2") + path("M179 68 v6 H223 v-6", "th2");
  s += txt(151, 88, "half", "tx tm") + txt(201, 88, "half", "tx tm") + txt(182, 104, "halve = share into", "tx tm") + txt(182, 115, "2 equal groups (÷2)", "tx tm");
  return s + cap("doubling makes two equal groups; halving shares into two equal groups", 152, 44);
})();
const oddEven = (() => {
  const pair = (x: number, y: number, cls: string) => rect(x, y, 18, 36, `l ${cls}`, 8) + circ(x + 9, y + 10, 5.2, "l f1") + circ(x + 9, y + 26, 5.2, "l f1");
  let s = txt(56, 14, "even", "ts ta") + txt(176, 14, "odd", "ts tr");
  [0, 1, 2].forEach((i) => { s += pair(18 + i * 28, 30, "f0"); });
  [0, 1, 2].forEach((i) => { s += pair(124 + i * 28, 30, "f0"); });
  s += circ(216, 50, 5.2, "l f4") + circ(216, 50, 10, "th");
  s += txt(56, 92, "all in pairs:", "tx tm") + txt(56, 104, "none left over", "tx tm") + txt(176, 92, "one is", "tx tm") + txt(176, 104, "left over", "tx tm");
  s += ln(120, 24, 120, 110, "th");
  return s + cap("even numbers can be put into pairs; odd numbers have one left over", 140, 44);
})();

// ── comparing and ordering ──────────────────────────────────────────────────────
const compareSym = (() => {
  const row = (cy: number, w1: number, w2: number, sym: ">" | "<" | "=", label: string) => {
    let s = rect(88 - w1, cy - 8, w1, 16, "l f1") + rect(112, cy - 8, w2, 16, "l f3");
    if (sym === "=") s += ln(94, cy - 3, 106, cy - 3, "l") + ln(94, cy + 3, 106, cy + 3, "l");
    else if (sym === ">") s += path(`M94 ${cy - 8} L106 ${cy} L94 ${cy + 8}`, "l");
    else s += path(`M106 ${cy - 8} L94 ${cy} L106 ${cy + 8}`, "l");
    return s + txt(112 + Math.max(w2, 30) + 10, cy + 4, label, "ts tl");
  };
  return row(24, 70, 40, ">", "greater than") + row(58, 40, 70, "<", "less than") + row(92, 55, 55, "=", "equal to") + cap("the open end of the sign faces the greater number", 140, 46);
})();
const moreFewer = (() => {
  let s = txt(120, 14, "more", "ts ta");
  for (let i = 0; i < 6; i++) s += circ(46 + i * 30, 36, 8, i < 4 ? "l f1" : "l f3");
  for (let i = 0; i < 4; i++) s += circ(46 + i * 30, 80, 8, "l f1") + ln(46 + i * 30, 44, 46 + i * 30, 72, "th");
  s += txt(120, 108, "fewer", "ts tr");
  return s + txt(120, 128, "match them one to one:", "tx tm") + txt(120, 140, "the extra ones show which has more", "tx tm");
})();
const ascDesc = (() => {
  const bars = (base: number, hs: number[]) => hs.map((h, i) => rect(56 + i * 28, base - h, 20, h, `l ${["f1", "f3", "f2", "f4", "f5"][i]}`)).join("");
  return txt(120, 14, "ascending order: smallest to largest", "ts ta") + bars(72, [8, 16, 24, 32, 40]) + txt(120, 92, "descending order: largest to smallest", "ts tr") + bars(152, [40, 32, 24, 16, 8]);
})();
const oneMoreLess = (() => {
  let s = txt(120, 14, "one more", "ts ta");
  for (let i = 0; i < 5; i++) s += circ(30 + i * 22, 40, 8, "l f1");
  s += circ(140, 40, 8, "l f3") + txt(158, 44, "the extra one", "tx tl tm");
  s += txt(120, 82, "one less", "ts tr");
  for (let i = 0; i < 4; i++) s += circ(30 + i * 22, 108, 8, "l f1");
  s += `<circle cx="118" cy="108" r="8" class="h"/>` + txt(136, 112, "taken away", "tx tl tm");
  return s + txt(120, 146, "one more: add one   ·   one less: take one away", "tx tm");
})();
const bonds10 = (() => {
  let s = "";
  for (let k = 1; k <= 9; k++) {
    const y = 8 + (k - 1) * 14.2;
    for (let i = 0; i < 10; i++) s += rect(78 + i * 13.5, y, 13.5, 11.5, `l ${i < k ? "f1" : "f3"}`);
    s += txt(70, y + 10, `${k} + ${10 - k}`, "tx te");
  }
  return s + cap("number bonds to 10", 162);
})();

// ── whole and part, rounding, order of operations ────────────────────────────────
const partWhole = (() => {
  let s = rect(14, 50, 80, 44, "l f1", 4) + txt(54, 76, "whole", "ts");
  s += arrow(102, 72, 128, 72, "a", 7);
  s += rect(136, 50, 26, 44, "l f3", 4) + rect(166, 50, 30, 44, "l f3", 4) + rect(200, 50, 26, 44, "l f3", 4);
  s += txt(149, 76, "part", "tx") + txt(181, 76, "part", "tx") + txt(213, 76, "part", "tx");
  return s + txt(54, 112, "all of it", "tx tm") + txt(181, 112, "some of it", "tx tm") + cap("the parts together make the whole", 152);
})();
const rounding = (() => {
  const x0 = 34, x1 = 206, y = 92;
  // end labels are anchored inwards (start / end) so they stay inside the 240-wide picture instead of being clipped at the edges
  let s = line(x0, x1, y, 2, undefined, 10) + txt(120, y - 16, "halfway", "ts") + txt(x0 - 12, y + 23, "lower multiple", "ts tl") + txt(x1 + 12, y + 23, "upper multiple", "ts te");
  s += dot(74, y, 4, "fr") + hop(74, x0, y, true, "ar", "hdr", 16) + txt(54, 58, "round down", "tx tr");
  s += dot(166, y, 4, "fr") + hop(166, x1, y, true, "a", "hda", 16) + txt(186, 58, "round up", "tx ta");
  return s + txt(120, 26, "which multiple is it closer to?", "ts") + txt(120, 40, "halfway rounds up", "tx tm") + cap("rounding to the nearest multiple", 158);
})();
const bidmas = (() => {
  const rows: [string, string, string][] = [["B", "Brackets", "work out ( ) first"], ["I", "Indices (orders)", "powers such as squares"], ["DM", "Division and Multiplication", "same level: left to right"], ["AS", "Addition and Subtraction", "same level: left to right"]];
  let s = "";
  rows.forEach(([l, a, b], i) => { const y = 8 + i * 35; s += rect(14, y, 212, 31, "l f0", 6) + rect(14, y, 40, 31, `l ${["f1", "f3", "f2", "f4"][i]}`, 6) + txt(34, y + 21, l, "tb") + txt(64, y + 15, a, "ts tl") + txt(64, y + 27, b, "tx tl tm"); });
  return s + txt(120, 163, "work from the top to the bottom", "tx tm");
})();
const roman = (() => {
  const syms: [string, string][] = [["I", "1"], ["V", "5"], ["X", "10"], ["L", "50"], ["C", "100"], ["D", "500"], ["M", "1000"]];
  let s = "";
  syms.forEach(([a, b], i) => { const x = 8 + i * 32; s += rect(x, 12, 30, 28, "l f3", 4) + txt(x + 15, 32, a, "tb") + rect(x, 40, 30, 20, "l f1", 4) + txt(x + 15, 54, b, "tx"); });
  s += txt(120, 78, "smaller after a bigger one: add", "tx") + txt(120, 90, "VI = 6, XII = 12", "tx tm") + txt(120, 106, "smaller before a bigger one: subtract", "tx") + txt(120, 118, "IV = 4, IX = 9, XL = 40, XC = 90", "tx tm");
  return s + txt(120, 136, "I, X, C and M repeat up to 3 times:", "tx") + txt(120, 148, "III = 3, XXX = 30", "tx tm");
})();
const squareNums = (() => {
  let s = "";
  const xs = [20, 52, 100, 160];
  [1, 2, 3, 4].forEach((k, i) => { for (let r = 0; r < k; r++) for (let c = 0; c < k; c++) s += circ(xs[i] + c * 11, 96 - r * 11, 4, "l f1"); s += txt(xs[i] + ((k - 1) * 11) / 2, 116, `${k} × ${k}`, "tx") + txt(xs[i] + ((k - 1) * 11) / 2, 128, `= ${k * k}`, "tx"); });
  return s + txt(120, 34, "1, 4, 9, 16, ... are square numbers", "ts") + cap("a square number: the dots make a square", 156);
})();
const cubeNums = (() => {
  const cube = (ox: number, oy: number, k: number, u: number) => {
    const dx = 0.5 * u, dy = -0.42 * u;
    const P = (x: number, y: number, z: number): [number, number] => [ox + x * u + z * dx, oy - y * u + z * dy];
    let s = poly([P(0, 0, 0), P(k, 0, 0), P(k, k, 0), P(0, k, 0)], "l f1") + poly([P(0, k, 0), P(k, k, 0), P(k, k, k), P(0, k, k)], "l f3") + poly([P(k, 0, 0), P(k, k, 0), P(k, k, k), P(k, 0, k)], "l f4");
    for (let i = 1; i < k; i++) {
      s += ln(...P(i, 0, 0), ...P(i, k, 0), "th") + ln(...P(0, i, 0), ...P(k, i, 0), "th");
      s += ln(...P(i, k, 0), ...P(i, k, k), "th") + ln(...P(0, k, i), ...P(k, k, i), "th");
      s += ln(...P(k, i, 0), ...P(k, i, k), "th") + ln(...P(k, 0, i), ...P(k, k, i), "th");
    }
    return s;
  };
  let s = cube(24, 100, 1, 16) + cube(72, 100, 2, 16) + cube(134, 100, 3, 16);
  s += txt(32, 122, "1×1×1 = 1", "tx") + txt(88, 122, "2×2×2 = 8", "tx") + txt(158, 122, "3×3×3 = 27", "tx");
  return s + txt(120, 22, "1, 8, 27, ... are cube numbers", "ts") + cap("a cube number: a number multiplied by itself three times", 156, 46);
})();
const primes = (() => {
  const P = new Set([2, 3, 5, 7, 11, 13, 17, 19, 23, 29]);
  let s = "";
  for (let v = 1; v <= 30; v++) { const c = (v - 1) % 6, r = Math.floor((v - 1) / 6); s += rect(38 + c * 27, 8 + r * 22, 27, 22, `th ${P.has(v) ? "f3" : v === 1 ? "f6" : "f0"}`) + txt(51.5 + c * 27, 23 + r * 22, String(v), P.has(v) ? "ts" : "ts tm"); }
  s += rect(38, 8, 162, 110, "l");
  return s + txt(120, 132, "a prime number has exactly two factors:", "tx tm") + txt(120, 144, "1 and itself (primes up to 30 are shaded)", "tx tm") + txt(120, 158, "1 is not a prime number", "tx tm");
})();
const factorPairs = (() => {
  const u = 8;
  const arr = (x: number, y: number, c: number, r: number) => rect(x, y, c * u, r * u, "l f1") + grid(x, y, c * u, r * u, c, r);
  let s = arr(18, 14, 12, 1) + txt(132, 22, "1 × 12", "ts tl") + arr(18, 36, 6, 2) + txt(132, 50, "2 × 6", "ts tl") + arr(18, 68, 4, 3) + txt(132, 88, "3 × 4", "ts tl");
  return s + txt(120, 128, "factor pairs of 12: every pair of factors", "tx tm") + txt(120, 140, "that multiply to make 12", "tx tm") + txt(120, 156, "factors of 12: 1, 2, 3, 4, 6 and 12", "ts");
})();
const divisibility = (() => {
  const rows: [string, string][] = [["2", "last digit is even (0, 2, 4, 6, 8)"], ["3", "digits add up to a multiple of 3"], ["4", "last two digits are divisible by 4"], ["5", "last digit is 0 or 5"], ["6", "divisible by both 2 and 3"], ["9", "digits add up to a multiple of 9"], ["10", "last digit is 0"]];
  let s = txt(120, 13, "A whole number is divisible by … if:", "tx tm");
  rows.forEach(([a, b], i) => { const y = 20 + i * 20; s += rect(14, y, 30, 17, "l f3", 4) + txt(29, y + 12.5, a, "ts") + txt(52, y + 12.5, b, "tx tl"); });
  return s;
})();

// ── written methods (empty layouts: they show WHERE the digits go, never a calculation) ─────────
const colLayout = (op: string, notes: string[]) => {
  const xs = [76, 104, 132, 160], names = ["Th", "H", "T", "O"];
  let s = "";
  xs.forEach((x, i) => { s += txt(x + 12, 15, names[i], "tx tm"); s += digitBox(x, 20) + digitBox(x, 46) + digitBox(x, 82); });
  s += txt(64, 62, op, "tb") + ln(70, 74, 190, 74, "l");
  notes.forEach((t, i) => (s += txt(120, 124 + i * 13, t, "tx tm")));
  return s;
};
const colAdd = colLayout("+", ["line up the digits by place value", "add ones first, then tens, then hundreds", "regroup when a column makes 10 or more", "(leave boxes empty when a number is shorter)"]);
const colSub = colLayout("−", ["line up the digits by place value", "subtract ones first, then tens, then hundreds", "exchange (regroup) if you need to", "(leave boxes empty when a number is shorter)"]);
const shortMul = (() => {
  const xs = [76, 104, 132, 160], names = ["Th", "H", "T", "O"];
  let s = "";
  xs.forEach((x, i) => { s += txt(x + 12, 15, names[i], "tx tm") + digitBox(x, 82); });
  s += digitBox(104, 20) + digitBox(132, 20) + digitBox(160, 20) + digitBox(160, 46) + txt(64, 62, "×", "tb") + ln(70, 74, 190, 74, "l");
  return s + txt(120, 124, "multiply ones first, then tens, then hundreds", "tx tm") + txt(120, 137, "regroup (carry) when a product makes 10 or more", "tx tm") + txt(120, 156, "short multiplication", "ts");
})();
const longMul = (() => {
  const xs = [78, 106, 134, 162], names = ["Th", "H", "T", "O"];
  const r = (y: number, cols: number[], fills: Record<number, string> = {}) => cols.map((c) => digitBox(xs[c], y, 26, 17, "l f0", fills[c] ?? "")).join("");
  let s = "";
  xs.forEach((x, i) => (s += txt(x + 13, 12, names[i], "tx tm")));
  s += r(16, [1, 2, 3]) + r(37, [2, 3]) + txt(70, 51, "×", "tb") + ln(70, 58, 190, 58, "l");
  s += r(62, [0, 1, 2, 3]) + r(83, [0, 1, 2]) + digitBox(162, 83, 26, 17, "l f3", "0") + ln(70, 105, 190, 105, "l") + r(109, [0, 1, 2, 3]);
  return s + txt(120, 146, "multiply by the ones, then by the tens", "tx tm") + txt(120, 158, "(put a 0 placeholder first), then add the rows", "tx tm");
})();
const shortDiv = (() => {
  let s = digitBox(40, 46, 26, 22) + ln(76, 42, 76, 72, "l") + ln(76, 42, 216, 42, "l");
  [84, 112, 140].forEach((x) => (s += digitBox(x, 18, 26, 22) + digitBox(x, 46, 26, 22)));
  s += txt(53, 82, "divisor", "tx tm") + txt(111, 82, "dividend", "tx tm") + txt(111, 12, "quotient (the answer)", "tx tm");
  return s + txt(120, 110, "short division (the bus stop):", "ts") + txt(120, 124, "divide one digit at a time, starting on the left;", "tx tm") + txt(120, 136, "share any remainder with the next digit", "tx tm");
})();
const longDiv = (() => {
  let s = "<g transform=\"translate(0 10)\">" + digitBox(36, 34, 26, 20) + ln(72, 30, 72, 58, "l") + ln(72, 30, 200, 30, "l");
  [80, 108, 136].forEach((x) => (s += digitBox(x, 8, 26, 20) + digitBox(x, 34, 26, 20)));
  s += txt(68, 80, "−", "tb") + digitBox(80, 64, 26, 20) + digitBox(108, 64, 26, 20) + ln(78, 88, 138, 88, "l") + digitBox(80, 92, 26, 20) + digitBox(108, 92, 26, 20) + digitBox(136, 92, 26, 20);
  s += "</g>";
  return s + txt(120, 134, "long division: divide, multiply, subtract,", "ts") + txt(120, 148, "bring down the next digit, then repeat", "ts") + txt(170, 22, "quotient", "tx tm tl") + txt(49, 76, "divisor", "tx tm");
})();
const partials = (() => {
  const x0 = 42, y0 = 42, wt = 92, wo = 64, h = 44;
  let s = rect(x0, y0, wt, h, "l f1") + rect(x0 + wt, y0, wo, h, "l f3");
  s += txt(x0 + wt / 2, y0 + 25, "tens × n", "ts") + txt(x0 + wt + wo / 2, y0 + 25, "ones × n", "tx");
  s += txt(x0 + wt / 2, y0 - 8, "tens", "ts") + txt(x0 + wt + wo / 2, y0 - 8, "ones", "ts") + txt(x0 - 8, y0 + 26, "n", "ts te");
  s += path(`M${x0} ${y0 - 22} v-4 H${x0 + wt + wo} v4`, "th2") + txt(x0 + (wt + wo) / 2, y0 - 32, "the number, split into tens and ones", "tx tm");
  return s + txt(120, 112, "tens × n  +  ones × n  =  the answer", "ts") + cap("expanded multiplication: split the number, multiply each part, then add the partial products", 150, 46);
})();
const timesGrid = (() => {
  const cw = 20, ch = 14, x0 = 10, y0 = 8;
  let s = "";
  for (let r = 0; r <= 10; r++) for (let c = 0; c <= 10; c++) {
    const head = r === 0 || c === 0, x = x0 + c * cw, y = y0 + r * ch;
    s += rect(x, y, cw, ch, `th ${head ? "f3" : "f0"}`);
    s += txt(x + cw / 2, y + 10.4, r === 0 && c === 0 ? "×" : head ? String(r === 0 ? c : r) : String(r * c), head ? "tx" : "tt");
  }
  return s + rect(x0, y0, 11 * cw, 11 * ch, "l");
})();


// ── additions (round 2) ────────────────────────────────────────────────────────────
const digits = (() => {
  let s = txt(120, 16, "the ten digits", "ts");
  for (let i = 0; i < 10; i++) s += rect(10 + i * 22, 24, 21, 24, "l f3", 3) + txt(20.5 + i * 22, 41, String(i), "ts");
  const ex = (x: number, k: number, l: string) => { let t = ""; for (let i = 0; i < k; i++) t += rect(x + i * 24, 84, 22, 24, "l f0", 3); return t + txt(x + (k * 24 - 2) / 2, 128, l, "tx"); };
  s += ex(22, 1, "1 digit") + ex(80, 2, "2 digits") + ex(158, 3, "3 digits");
  return s + txt(120, 70, "a number is made from digits", "tx tm") + txt(120, 152, "the digits 0 to 9 make every numeral", "tx tm");
})();
const scaleIntervals = (() => {
  const x0 = 30, x1 = 210, k = 10, st = (x1 - x0) / k;
  let s = ln(x0 - 12, 86, x1 + 12, 86, "l");
  for (let i = 0; i <= k; i++) { const x = x0 + i * st, major = i % 5 === 0; s += ln(x, 86 - (major ? 10 : 6), x, 86 + (major ? 10 : 6), "l"); if (major) s += txt(x, 112, String(i * 2), "ts"); }
  s += path(`M${x0 + 2 * st} 70 v-6 H${x0 + 3 * st} v6`, "th2") + txt(x0 + 2.5 * st, 56, "one interval", "tx ta");
  return s + txt(120, 22, "a scale has equal intervals", "ts") + txt(120, 140, "each interval is worth the same amount:", "tx tm") + txt(120, 152, "work out what one interval is worth", "tx tm");
})();
const bridgingHundred = (() => {
  const x0 = 30, x1 = 210, k = 8, st = (x1 - x0) / k;
  const row = (y: number, ai: number, ti: number, bi: number, title: string, up: boolean) => {
    let s = txt(8, y - 40, title, "tx tl tm") + line(x0, x1, y, k);
    s += ln(x0 + ti * st, y - 12, x0 + ti * st, y + 12, "ao") + txt(x0 + ti * st, y + 26, "hundred", "ts") + txt(x0 + ai * st, y + 26, "start", "ts");
    s += hop(x0 + ai * st, x0 + ti * st, y, true, up ? "a" : "ar", up ? "hda" : "hdr", 20) + hop(x0 + ti * st, x0 + bi * st, y, true, up ? "a" : "ar", up ? "hda" : "hdr", 14);
    return s;
  };
  return row(60, 1, 4, 6, "adding: up to the next hundred, then the rest", true) + row(140, 7, 4, 2, "subtracting: back to the hundred, then the rest", false);
})();
const unitising = (() => {
  let s = "";
  for (let i = 0; i < 10; i++) s += circ(24 + (i % 5) * 13, 44 + Math.floor(i / 5) * 13, 4.6, "l f1");
  s += arrow(96, 50, 124, 50, "a", 7);
  s += `<rect x="134" y="30" width="80" height="40" rx="14" class="l f0"/>`;
  for (let i = 0; i < 10; i++) s += circ(148 + (i % 5) * 13, 44 + Math.floor(i / 5) * 13, 4.6, "l f1");
  return s + txt(56, 92, "10 separate ones", "tx tm") + txt(174, 92, "1 group: 1 unit", "tx tm") + txt(120, 118, "unitising: treat a group as one unit", "ts") + txt(120, 132, "and count the units", "ts") + txt(120, 154, "10 ones can be counted as 1 ten", "tx tm");
})();
const placeholder = (() => {
  const xs = [70, 100, 130], names = ["H", "T", "O"], val = ["3", "0", "5"];
  let s = "";
  xs.forEach((x, i) => (s += txt(x + 13, 22, names[i], "tx tm") + digitBox(x, 28, 26, 30, i === 1 ? "l f3" : "l f0", val[i])));
  s += arrow(113, 110, 113, 66, "ar", 7) + txt(113, 126, "the 0 holds the tens place", "tx");
  return s + txt(120, 146, "a placeholder keeps the other digits", "tx tm") + txt(120, 158, "in their correct places", "tx tm");
})();
const dataTable = (() => {
  const x0 = 40, y0 = 30, cw = 52, ch = 22;
  let s = "";
  for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) s += rect(x0 + c * cw, y0 + r * ch, cw, ch, `l ${r === 0 ? "f3" : c === 1 ? "f1" : "f0"}`);
  s += arrow(x0 + 1.5 * cw, 18, x0 + 1.5 * cw, y0 - 2, "a", 6) + txt(x0 + 1.5 * cw, 14, "column", "tx ta") + arrow(18, y0 + 2.5 * ch, x0 - 2, y0 + 2.5 * ch, "ar", 6) + txt(18, y0 + 2.5 * ch + 12, "row", "tx tr");
  return s + txt(120, 134, "a table: information arranged", "tx tm") + txt(120, 146, "in rows and columns", "tx tm");
})();


const partitioning = (() => {
  const row = (y: number, ws: number[], fills: string[], label: string) => { let t = "", x = 20; ws.forEach((w, i) => { t += rect(x, y, w, 22, `l ${fills[i]}`); x += w; }); return t + txt(x + 8, y + 15, label, "tx tl tm"); };
  // bars are 130 wide (20..150) so the longest row label ("two equal parts") ends inside the 240-wide picture
  return txt(120, 14, "the same amount, partitioned in different ways", "tx") + rect(20, 24, 130, 22, "l f6") + txt(85, 39, "the whole amount", "ts")
    + row(58, [87, 43], ["f1", "f3"], "tens and ones") + row(88, [65, 65], ["f1", "f1"], "two equal parts") + row(118, [26, 61, 43], ["f1", "f3", "f2"], "three parts")
    + txt(120, 160, "partitioning: splitting a whole into smaller parts", "tx tm");
})();
const compose = (() => {
  let s = rect(88, 22, 64, 26, "l f3", 5) + txt(120, 39, "whole", "ts");
  s += rect(46, 100, 60, 26, "l f1", 5) + txt(76, 117, "part", "ts") + rect(134, 100, 60, 26, "l f1", 5) + txt(164, 117, "part", "ts");
  s += arrow(84, 96, 100, 54, "a", 7) + arrow(156, 96, 140, 54, "a", 7) + txt(6, 76, "compose", "ts ta tl") + txt(234, 76, "decompose", "ts tr te");
  s += arrow(108, 54, 92, 96, "ar", 7) + arrow(132, 54, 148, 96, "ar", 7);
  return s + txt(120, 148, "compose: combine parts to make a whole", "tx tm") + txt(120, 160, "decompose: break a whole into parts", "tx tm");
})();
const estimate = (() => {
  const x0 = 30, x1 = 210;
  let s = ln(x0 - 12, 92, x1 + 12, 92, "l");
  for (let i = 0; i <= 8; i++) s += ln(x0 + i * 22.5, 86, x0 + i * 22.5, 98, "l");
  s += dot(140, 92, 5.5, "dot") + circ(122, 92, 5.5, "l f3") + hop(122, 138, 92, true, "th", "hd", 10);
  s += txt(122, 122, "estimate", "ts") + txt(140, 66, "exact answer", "ts") + ln(140, 70, 140, 84, "th");
  return s + txt(120, 22, "an estimate is close enough to the exact answer", "tx") + txt(120, 34, "but it is not exactly the same", "tx tm") + txt(120, 152, "estimate: a sensible value close to the answer", "tx tm");
})();
const missingPart = (() => {
  let s = rect(40, 22, 160, 24, "l f3") + txt(120, 38, "the whole (known)", "ts") + rect(40, 50, 90, 24, "l f1") + txt(85, 66, "known part", "ts") + rect(130, 50, 70, 24, "l f0") + txt(165, 67, "?", "tb");
  s += txt(120, 106, "known part + ? = whole", "ts") + txt(120, 124, "? = whole − known part", "ts");
  return s + txt(120, 152, "a missing part: take the known part", "tx tm") + txt(120, 163, "away from the whole", "tx tm");
})();

// ── build ────────────────────────────────────────────────────────────────────────
const OPS = "operation-words";
const S = (id: string, title: string, concepts: string[], body: string, alt: string, caption: string, evidence: string, extra: Partial<Pic> = {}) => mk({ id, title, concepts, body, alt, caption, evidence, extra });
export const EXT_NUMBER: Pic[] = [
  S("base-ten-blocks", "Base 10 blocks", ["base 10 blocks", "base ten blocks", "base 10", "base ten", "dienes"], baseTen, "Base 10 blocks: a big flat square for one hundred (a 10 by 10 grid of ones), a long rod for one ten and a single small cube for one one.", "Base 10 blocks",
    "Oak KS1-KS2 place value uses base 10 (Dienes) blocks: 1 one = a unit cube, 1 ten = a rod of 10 ones, 1 hundred = a flat of 10 tens. Rod = 1 by 10 units, flat = 10 by 10 units, drawn to one common unit scale (7).", { avoid: ["base 2", "binary", "base 60"] }),
  S("regrouping", "Regrouping ones and tens", ["regroup", "regrouping", "regrouped"], regroup, "Ten single ones in a row, joined by a two-way arrow to one ten bar of the same length: 10 ones can be regrouped as 1 ten and 1 ten as 10 ones.", "Regrouping",
    "Oak KS1-KS2 regrouping (exchange): 10 ones = 1 ten, 10 tens = 1 hundred, in both directions. The ten bar has exactly the length of ten ones (120 units).", {}),
  S("tens-and-ones", "Tens and ones", ["tens and ones", "ones and tens", "tens and one", "ten ones", "tens digit", "ones digit", "tens column", "ones column"], tensOnes, "Two columns, Tens and Ones: the Tens column holds a ten rod divided into ten small squares, the Ones column holds one single cube.", "Tens and ones",
    "A ten rod is worth 10 ones and one cube is worth 1 (Oak KS1 place value, 'tens' and 'ones'). Definition only, no example number.", {}),
  S("hundreds-tens-ones", "Thousands, hundreds, tens and ones", ["hundreds tens and ones", "hundreds tens ones", "hundreds and tens", "hundreds", "thousands", "thousand"], hto, "Four blocks with values: a big cube for 1000, a flat for 100, a rod for 10 and a small cube for 1, with an arrow saying each block is 10 times the value of the one to its right.", "Thousands, hundreds, tens and ones",
    "Place value: 1 one, 1 ten (10 ones), 1 hundred (10 tens), 1 thousand (10 hundreds); each place is 10 times the one to its right. Block sizes to one unit scale (3.6); the thousand cube is 10 x 10 x 10 units.", { avoid: ["hundreds boundary", "100s boundary", "hundredth", "thousandth", "ten thousand", "hundred thousand", "million", "billion"] }),
  S("count-forwards-backwards", "Counting forwards and backwards", ["count forwards", "counting forwards", "count backwards", "counting backwards", "forwards and backwards", "count on", "counting on", "count back", "counting back"], countFB, "A number line with three blue jumps to the right labelled counting forwards: the numbers get bigger, and three red jumps to the left labelled counting backwards: the numbers get smaller.", "Counting forwards and backwards",
    "Counting on/forwards makes numbers bigger, counting back/backwards makes them smaller (Oak KS1 counting). Ticks unlabelled: no numbers are implied.", { avoid: ["skip"] }),
  S("skip-counting", "Skip counting in equal jumps", ["skip count", "skip counting", "counting in steps", "count in steps", "counting in multiples", "count in multiples"], skipCount, "A number line starting at a marked start point with six jumps above it, all the same size.", "Skip counting",
    "Oak KS1-KS2 skip counting = counting on or back in equal steps (2s, 5s, 10s...). Six equal jumps of 30 units on a line with unlabelled ticks.", {}),
  S("multiples", "Multiples of a number", ["multiple", "multiples"], multiples, "A number line from 0 with equal jumps of n, the landing points labelled n, 2n, 3n, 4n, 5n and 6n.", "Multiples of a number",
    "A multiple of n is what you reach by counting in equal jumps of n from 0 (n, 2n, 3n...; Oak KS2 'multiple'). Letters not numbers so it is right for every times table.", { requires: ["multiple of", "multiples of", "times table", "times tables", "factor", "product", "skip count", "adjacent", "common multiple", "divisible", "counting in", "count in", "multiplication"], avoid: ["multiple groups", "multiple regroup", "multiple objects", "multiple sets", "multiple items", "multiple choice", "multiple ways", "multiple representation", "multiple methods", "multiple strategies", "multiple steps", "multiple digit", "multiple-digit", "multiple answers", "multiple solutions", "multiple of ten", "multiples of ten", "multiple of 10", "multiples of 10"] }),
  S("multiples-of-ten", "Counting in tens: multiples of 10", ["decade number", "decade numbers", "multiples of ten", "multiple of ten", "multiples of 10", "multiple of 10", "counting in tens", "count in tens"], decades, "A number line from 0 to 100 with a labelled tick at every ten (0, 10, 20 up to 100) and equal jumps between them.", "Multiples of 10",
    "The multiples of 10 (decade numbers) are 0, 10, 20 ... 100, each jump adding 10 (Oak KS1 'decade numbers', 'multiple of ten'). 11 ticks equally spaced.", { avoid: ["multiples of 100", "multiple of 100", "multiples of 1000"] }),
  S("bridging-ten", "Bridging through a ten", ["bridge 10", "bridging 10", "bridge through 10", "bridging through 10", "bridge ten", "bridging ten", "bridge through ten", "bridging through ten", "crossing the tens boundary", "cross the tens boundary", "tens boundary"], bridging, "Two number lines: adding by jumping to the next ten and then jumping the rest; subtracting by jumping back to the ten and then jumping the rest. The ten is marked.", "Bridging through a ten",
    "Bridging (making) a ten: add or subtract by jumping to the ten first and then the rest of the number (Oak KS1 'bridge 10', 'crossing the tens boundary'). No numbers are drawn.", { avoid: ["without crossing", "not crossing", "without bridging", "no bridging", "not bridge", "without regrouping", "bridging 100", "bridge 100", "bridging through 100", "bridge through 100", "100s boundary", "hundreds boundary"] }),
  S("addition-terms", "Addend and sum", ["addend", "sum"], addTerms, "The equation addend plus addend equals sum drawn as three labelled boxes: an addend is a number that is added, and the sum is the total.", "Addend and sum",
    "Oak KS1-KS2 keywords: 'addend' = a number being added; 'sum' = the result of adding. Layout: box, plus, box, equals, box.", { family: OPS, requires: ["add", "addition", "adding", "addend", "addends", "total", "plus"], avoid: ["digit sum", "angle", "sum of the squares", "sum of the interior", "sum of the exterior", "sum to ten", "sum to 10", "sum to 100"] }),
  S("subtraction-terms", "Minuend, subtrahend and difference", ["minuend", "subtrahend", "difference"], subTerms, "The equation minuend minus subtrahend equals difference: the minuend is the number we start with, the subtrahend is taken away, the difference is what is left.", "Minuend, subtrahend and difference",
    "Oak KS2 keywords: minuend = the number subtracted from; subtrahend = the number being subtracted; difference = the result of subtracting.", { family: OPS, requires: ["subtract", "subtraction", "subtracting", "minuend", "subtrahend", "take away", "minus"], avoid: ["difference between the shapes", "difference in", "similarities and differences"] }),
  S("multiplication-terms", "Factor and product", ["factor", "product"], mulTerms, "The equation factor times factor equals product: the factors are the numbers multiplied and the product is the answer.", "Factor and product",
    "Oak KS2 keywords: factor = a number that is multiplied (or that divides another exactly); product = the result of multiplying.", { family: OPS, requires: ["multiply", "multiplication", "multiplying", "multiplied", "factor", "factors", "times", "product", "products"], avoid: ["scale factor", "prime factor", "factor tree", "common factor", "highest common", "factor pair", "factors of", "vector", "ratio"] }),
  S("division-terms", "Dividend, divisor, quotient and remainder", ["dividend", "divisor", "quotient", "remainder"], divTerms, "The equation dividend divided by divisor equals quotient: the dividend is the number being divided, the divisor is the number we divide by, the quotient is the answer; the remainder is what is left over.", "Dividend, divisor, quotient",
    "Oak KS2 keywords: dividend = the number being divided; divisor = the number you divide by; quotient = the result; remainder = the amount left over when it does not divide exactly.", { family: OPS, avoid: ["remainder theorem", "polynomial"] }),
  S("inverse-operations", "Inverse operations", ["inverse", "inverse operation"], inverse, "Two panels: a bar a and b under a whole c with the facts a plus b equals c and c minus b equals a; and an array with a times b equals c and c divided by b equals a.", "Inverse operations",
    "Oak KS1-KS2 'inverse': addition and subtraction undo each other, and multiplication and division undo each other. Letters only.", { avoid: ["inverse function", "inverse proportion", "inverse matrix", "additive inverse"] }),
  S("equal-groups", "Equal groups and repeated addition", ["equal groups", "equal group", "repeated addition", "make equal groups"], equalGroups, "Three circles each holding the same number of counters, with plus signs between them: equal groups and repeated addition.", "Equal groups",
    "Multiplication as equal groups / repeated addition (Oak KS1-KS2). Three groups of four drawn, so the picture implies a specific total: refused on slides with digits.", { numeric: true }),
  S("sharing-grouping", "Division as sharing and as grouping", ["share equally", "sharing equally", "sharing", "grouping", "equal sharing"], sharing, "Six counters shared out into two equal groups, and six counters put into three equal groups: sharing asks how many in each group, grouping asks how many groups.", "Sharing and grouping",
    "Two meanings of division (Oak KS1 'sharing' and 'grouping'): share out equally (find the size of each group) or make equal groups (find how many groups). 6 shared between 2 and 6 grouped in 2s are drawn: refused on slides with digits.", { numeric: true, requires: ["divide", "division", "dividing", "share", "sharing", "remainder"], avoid: ["sort", "sorting", "data", "tally", "pictogram", "=sharing a", "sharing ideas", "multipl", "repeated addition", "equal groups", "zero"] }),
  S("multiplication-grid", "Multiplication table", ["times table", "times tables", "multiplication table", "multiplication grid", "multiplication square"], timesGrid, "A multiplication grid from 1 by 1 to 10 by 10: the row number times the column number gives the product where they meet.", "The multiplication table",
    "Every cell is row x column (computed in code), 1 x 1 to 10 x 10 (Oak KS1-KS2 times tables). Facts only, so it cannot contradict a times-table slide.", { avoid: ["times the size", "times as many", "times as much", "times as long"] }),
  S("expanded-multiplication", "Expanded multiplication (partial products)", ["expanded multiplication", "partial product", "partial products", "grid method"], partials, "A rectangle for a number split into tens and ones and multiplied by n: tens times n plus ones times n gives the answer.", "Expanded multiplication",
    "Oak KS2 'expanded multiplication' / 'partial product': partition the number, multiply each part by the multiplier, add the partial products. Letters and place names only.", { family: "written-methods" }),
  S("short-multiplication", "Short multiplication layout", ["short multiplication"], shortMul, "An empty short multiplication layout: a number times a one-digit number with a line, and an answer row, under the place-value headings Th, H, T and O.", "Short multiplication",
    "Oak KS2 'short multiplication': the formal written layout with the digits lined up by place value (Th H T O), multiply the ones first, regroup as needed. Empty boxes: no calculation is shown.", { family: "written-methods" }),
  S("long-multiplication", "Long multiplication layout", ["long multiplication", "column multiplication"], longMul, "An empty long multiplication layout: a number times a two-digit number, one row for the ones, a row for the tens starting with a zero placeholder, then the added total.", "Long multiplication",
    "Oak KS2 'long multiplication': multiply by the ones digit, then by the tens digit (a 0 placeholder in the ones place), then add the two rows. Empty boxes, only the placeholder 0 is written.", { family: "written-methods", avoid: ["expanded multiplication", "grid method"] }),
  S("column-addition", "Column addition layout", ["column addition"], colAdd, "An empty column addition layout: two numbers one above the other under the place-value headings Th, H, T and O, a plus sign, a line and an answer row.", "Column addition",
    "Oak KS1-KS2 'column addition': write the numbers with the digits in columns by place value, add the ones first, regroup when a column reaches 10. Empty boxes: no calculation is shown.", { family: "written-methods" }),
  S("column-subtraction", "Column subtraction layout", ["column subtraction"], colSub, "An empty column subtraction layout: two numbers one above the other under the place-value headings Th, H, T and O, a minus sign, a line and an answer row.", "Column subtraction",
    "Oak KS2 'column subtraction': digits in columns by place value, subtract the ones first, exchange (regroup) when the top digit is smaller. Empty boxes.", { family: "written-methods" }),
  S("short-division", "Short division (bus stop) layout", ["short division", "bus stop", "bus stop method"], shortDiv, "An empty short division layout, the bus stop: the divisor on the left, the dividend under the bar and the quotient above it.", "Short division",
    "Oak KS2 'short division': the bus-stop layout with the divisor outside, the dividend inside and the quotient (answer) written on top; divide digit by digit from the left, sharing remainders on.", { family: "written-methods" }),
  S("long-division", "Long division layout", ["long division"], longDiv, "An empty long division layout: the divisor on the left, the dividend under the bar, the quotient above and rows underneath for subtracting.", "Long division",
    "Oak KS2 'long division': divide, multiply, subtract, bring down the next digit, repeat, with the working written below the dividend. Empty boxes.", { family: "written-methods" }),
  S("doubling-halving", "Doubling and halving", ["double", "doubling", "doubles", "doubled", "halve", "halving", "halved"], doubling, "Left: a row of four counters and a second equal row make a double. Right: a row of eight counters is split by a dashed line into two equal halves.", "Doubling and halving",
    "Oak KS1-KS2 'double' = two equal groups (x2), 'halve' = share into 2 equal groups (÷2). 4 doubled and 8 halved are drawn: refused on slides with digits.", { numeric: true, avoid: ["double number line", "double bar", "double the", "double digit", "double-digit", "double click", "near double"] }),
  S("odd-even-numbers", "Odd and even numbers", ["odd number", "even number", "odd and even", "odd or even", "even and odd", "odd numbers and even numbers"], oddEven, "Six counters in three pairs with none left over labelled even, and seven counters in three pairs with one left over labelled odd.", "Odd and even numbers",
    "Oak KS1-KS2: an even number of counters can be put into pairs with none left over; an odd number leaves one over. Structure only (6 and 7 drawn, no numbers written).", { avoid: ["odd one out"] }),
  S("compare-symbols", "Greater than, less than and equal to", ["greater than and less than", "greater than or less than", "less than and greater than", "comparison symbol", "equality and inequality", "compare numbers", "comparing numbers"], compareSym, "Three rows of two bars with a sign between them: the open end of the greater than sign faces the longer bar, the less than sign faces the longer bar on the right, and the equals sign joins two equal bars.", "Greater than, less than, equal to",
    "Oak KS1-KS2: > means greater than, < means less than, = means equal to; the open end of the sign faces the greater number. Bars stand for numbers: no values.", { avoid: ["negative", "positive", "below zero", "less than zero", "greater than zero", "or equal", "at least", "at most", "inequalities on", "inequality on a number line", "solve the inequality"] }),
  S("more-than-fewer-than", "More than and fewer than", ["more than", "fewer than", "fewer", "more and fewer"], moreFewer, "Two rows of counters matched one to one with lines: the top row has extra counters, so it has more; the bottom row has fewer.", "More and fewer",
    "Comparing groups by matching one to one (Oak KS1 'more than', 'fewer than'): the extra counters show which group has more.", { requires: ["fewer", "compare", "comparing", "less than", "greater than", "how many more", "difference"], avoid: ["more than or", "fewer than or", "fewer than 0", "more than two", "more than 2", "more than one", "more than 1", "more than three", "more than 3"] }),
  S("ascending-descending", "Ascending and descending order", ["ascending", "descending", "ascending order", "descending order", "smallest to largest", "largest to smallest", "smallest to greatest", "greatest to smallest"], ascDesc, "Two rows of five bars: bars growing taller from left to right for ascending order, and bars getting shorter for descending order.", "Ascending and descending order",
    "Ascending = smallest to largest, descending = largest to smallest (Oak KS1-KS2 ordering). Bar heights only, no values.", { avoid: ["descending the", "ascending powers", "descending powers"] }),
  S("one-more-one-less", "One more and one less", ["one more", "one less", "one more than", "one less than"], oneMoreLess, "Five counters with one extra gold counter added for one more, and five counters with the last one taken away (dashed outline) for one less.", "One more and one less",
    "One more = add one, one less = take one away (Oak KS1 counting). A group of 5 with one added and with one removed: refused on slides with digits.", { numeric: true }),
  S("number-bonds-to-10", "Number bonds to 10", ["number bonds to 10", "number bonds to ten", "number bond to 10", "number bond to ten", "number bonds within 10", "bonds to 10", "pairs to 10", "pairs that make 10", "make 10", "make ten", "making 10", "making ten"], bonds10, "Nine rows of ten boxes, each row split into two colours: 1 and 9, 2 and 8, 3 and 7 down to 9 and 1, every pair making 10.", "Number bonds to 10",
    "The number bonds to 10 (Oak KS1 'number bonds'): 1+9, 2+8, 3+7, 4+6, 5+5, 6+4, 7+3, 8+2, 9+1, each row exactly 10 boxes (computed).", { avoid: ["to 20", "within 20", "to 100", "to 5", "make 100", "make 20"] }),
  S("part-and-whole", "Whole and parts", ["part", "parts", "whole", "wholes"], partWhole, "A whole rectangle, an arrow, and the same size rectangle cut into three parts: the parts together make the whole.", "Whole and parts",
    "Oak KS1 'whole' = all of something, 'part' = some of it; the parts together make the whole. Shapes with no numbers.", { requires: ["part", "parts"], avoid: ["part whole", "part-whole", "partition", "number bond", "whole number", "whole turn", "whole group", "whole class", "whole hour", "whole day", "whole year", "whole unit", "part of speech", "ratio", "percent", "equal", "unequal", "fraction", "different size", "denominator", "hundredth", "fractions"] }),
  S("rounding-number-line", "Rounding to the nearest multiple", ["rounding", "round to the nearest", "rounding to the nearest"], rounding, "A number line with a lower multiple, a halfway mark and an upper multiple: a number below the halfway mark jumps down to the lower multiple, a number above it jumps up.", "Rounding",
    "Rounding to the nearest multiple: numbers closer to the lower multiple round down, numbers at or past halfway round up (Oak KS2 'rounding'). Labels only, no numbers.", { avoid: ["significant figure", "decimal place", "round the corner", "estimate"] }),
  S("roman-numerals", "Roman numerals", ["roman numeral", "roman numerals", "roman number", "roman numbers"], roman, "The Roman numeral symbols I, V, X, L, C, D and M with their values 1, 5, 10, 50, 100, 500 and 1000, and the rules for adding and subtracting.", "Roman numerals",
    "I=1, V=5, X=10, L=50, C=100, D=500, M=1000; a smaller symbol after a bigger one is added, before it is subtracted (IV=4, IX=9, XL=40, XC=90); I, X, C, M repeat at most three times. Fixed facts, cannot contradict.", {}),
  S("square-numbers", "Square numbers", ["square number", "square numbers"], squareNums, "Dots arranged in squares of 1, 2, 3 and 4 by the same number, labelled 1 times 1 equals 1, 2 times 2 equals 4, 3 times 3 equals 9 and 4 times 4 equals 16.", "Square numbers",
    "A square number is a number multiplied by itself (1, 4, 9, 16 ...), shown as k x k dots. Fixed facts.", { avoid: ["square root", "cube number", "cube numbers", "cubed"] }),
  S("cube-numbers", "Cube numbers", ["cube number", "cube numbers"], cubeNums, "Three cubes built from unit cubes: 1 by 1 by 1 equals 1, 2 by 2 by 2 equals 8 and 3 by 3 by 3 equals 27.", "Cube numbers",
    "A cube number is a number multiplied by itself three times (1, 8, 27 ...). Cubes drawn from k x k x k unit cubes with the grid lines on the three visible faces (oblique projection, computed).", { avoid: ["cube root", "square number", "square numbers"] }),
  S("prime-numbers", "Prime numbers up to 30", ["prime number", "prime numbers", "prime"], primes, "A grid of the numbers 1 to 30 with the prime numbers 2, 3, 5, 7, 11, 13, 17, 19, 23 and 29 shaded and 1 not shaded.", "Prime numbers",
    "A prime number has exactly two factors, 1 and itself; the primes up to 30 are 2, 3, 5, 7, 11, 13, 17, 19, 23, 29 and 1 is not prime (Oak KS2 'prime number').", { avoid: ["prime factor", "prime factors", "prime factorisation", "prime factorization", "prime cost"] }),
  S("factor-pairs", "Factor pairs of 12", ["factor pair", "factor pairs", "factors of"], factorPairs, "Three arrays of unit squares for 12: 1 by 12, 2 by 6 and 3 by 4, and the factors of 12 listed: 1, 2, 3, 4, 6 and 12.", "Factor pairs of 12",
    "Factor pairs of 12 are 1x12, 2x6, 3x4 (arrays with row and column counts exact); factors of 12 = 1, 2, 3, 4, 6, 12. Shows one number, so it is refused on slides with digits.", { numeric: true, avoid: ["prime factor", "scale factor", "square", "prime", "common factor", "highest", "lowest", "odd number of factors", "even number of factors", "number of factors", "tree"] }),
  S("divisibility-rules", "Divisibility rules", ["divisibility rules", "divisibility rule", "divisible", "divisibility", "divisibility test"], divisibility, "Rules for whether a whole number is divisible by 2, 3, 4, 5, 6, 9 or 10, for example: divisible by 5 if the last digit is 0 or 5; divisible by 3 if the digits add up to a multiple of 3.", "Divisibility rules",
    "Standard divisibility tests (Oak KS2 'divisible', 'divisibility'): 2 last digit even; 3 digit sum a multiple of 3; 4 last two digits divisible by 4; 5 last digit 0 or 5; 6 divisible by 2 and 3; 9 digit sum a multiple of 9; 10 last digit 0.", { avoid: ["divisible by 7", "divisible by 8", "divisible by 11", "divisible by 12"] }),
  S("digits", "Digits", ["digits", "the digit", "a digit", "each digit", "single digit", "digit is"], digits, "The ten digits 0 to 9 in a row of boxes, and empty boxes for a one-digit, a two-digit and a three-digit number.", "Digits",
    "Oak KS1-KS2 'digit': a single symbol used to make a numeral. The digits are 0-9; a number can have one, two, three or more digits.", { avoid: ["digit sum", "digit total", "digit cards", "digit card"], doesNotShow: "the value of any digit or number" }),
  S("scale-intervals", "Scales and intervals", ["scale interval", "scale intervals", "intervals on a scale", "interval", "intervals", "read scales", "reading scales", "read the scale", "scales with different intervals"], scaleIntervals, "A scale with labelled marks 0, 10 and 20 and equal intervals between them, one interval bracketed: each interval is worth the same amount.", "Scales and intervals",
    "Oak KS2 'scale': a number line with equal divisions for equal values; an interval is the space between two marks. Marks labelled 0, 10, 20 with five equal intervals between: refused on slides with digits.", { numeric: true, requires: ["scale", "scales", "read", "reading", "measure", "measuring"], avoid: ["time", "clock", "hour", "minute", "o clock"] }),
  S("bridging-hundred", "Bridging through a hundred", ["bridge 100", "bridging 100", "bridge through 100", "bridging through 100", "bridge a hundred", "100s boundary", "hundreds boundary", "cross the hundreds boundary", "crossing the hundreds boundary", "crossing the 100s boundary", "cross the 100s boundary"], bridgingHundred, "Two number lines: adding by jumping to the next hundred and then jumping the rest; subtracting by jumping back to the hundred and then jumping the rest. The hundred is marked.", "Bridging through a hundred",
    "Oak KS2 'bridging' = crossing a number boundary; '100s boundary' = where the numbers change into (or between) hundreds. Jump to the hundred first, then the rest; no numbers drawn.", { avoid: ["without crossing", "not crossing", "without bridging", "no bridging", "not bridge", "without regrouping", "bridge 10 ", "1 000", "thousand", "million"] }),
  S("unitising", "Unitising", ["unitising", "unitise", "unitised", "unitising language"], unitising, "Ten separate counters, an arrow, and the same ten counters inside one ring: a group treated as one unit (ten ones counted as one ten).", "Unitising",
    "Oak KS1-KS2 'unitising': treating groups that contain the same number of things as ones or units (supports place value and multiplicative thinking). Ten ones as one ten drawn: refused on slides with digits.", { numeric: true }),
  S("placeholder-zero", "Zero as a placeholder", ["placeholder", "place holder"], placeholder, "The columns H, T and O holding 3, 0 and 5: the zero in the tens column holds the place so the 3 and the 5 keep their values.", "A placeholder",
    "Oak KS2 'placeholder': the digit 0 holds a place in a number and maintains place value. 305 drawn in H T O boxes: refused on slides with digits.", { numeric: true, avoid: ["decimal point"] }),
  S("data-table", "A table", ["table", "tables"], dataTable, "An empty table of three columns and four rows with the top row shaded as headings, one column and one row marked.", "A table",
    "Oak KS1-KS2 'table': information arranged in rows and columns. Empty grid, no data.", { requires: ["rows", "columns", "record", "data", "information", "results", "measurements"], avoid: ["times table", "times tables", "multiplication table", "table facts", "table of values", "periodic", "truth table"], doesNotShow: "any data or values" }),
  S("partitioning", "Partitioning", ["partitioning", "partitioned", "partition into"], partitioning, "The same whole amount shown three times, split into tens and ones, into two equal parts and into three parts: partitioning splits a whole into smaller parts.", "Partitioning",
    "Oak KS1-KS2 'partitioning': the act of splitting an object or value into smaller parts (a whole can be partitioned in many ways). Bars of identical length 150 split 100+50, 75+75 and 30+70+50 (no numbers drawn).", { avoid: ["partition the ", "partition line"], doesNotShow: "any specific number or how to partition a particular number" }),
  S("compose-decompose", "Composing and decomposing", ["compose", "composed", "composing", "decompose", "decomposed", "decomposing", "recombine", "recombined"], compose, "A whole above two parts joined by arrows in both directions: composing combines parts into a whole and decomposing breaks a whole into parts.", "Compose and decompose",
    "Oak KS1-KS2 'compose': to combine parts to make a given number (one hundred is composed of 10 tens); decompose is the reverse. Two-way arrows between one whole and two parts.", { avoid: ["composite", "composition of functions", "composed of shapes"] }),
  S("estimate", "Estimating", ["estimate", "estimation", "estimating", "estimated"], estimate, "A number line with the exact answer marked by a filled dot and an estimate marked by an open circle close to it: an estimate is close enough but not exactly the same.", "Estimating",
    "Oak KS1-KS2 'estimate': to find a value that is close enough to the right answer, usually with some thought. Drawn as a nearby open marker on a number line, no numbers.", { avoid: ["estimate the size of the angle", "estimate the angle", "estimated mean", "estimate of the population"] }),
  S("missing-part", "Finding a missing part", ["missing number", "missing numbers", "missing part", "missing parts", "missing addend", "missing addends", "unknown part"], missingPart, "A whole bar with a known part and a box with a question mark for the missing part: the missing part is the whole take away the known part.", "A missing part",
    "A part-whole structure with one unknown part: known part + ? = whole, so ? = whole - known part (Oak KS1-KS2 'missing number', 'missing part'). Letters and a ? only.", { requires: ["whole", "part", "parts", "addend", "addends", "total", "sum", "equation", "equations", "known"], avoid: ["percent", "percentage", "fraction", "ratio", "hundredth", "missing whole", "whole is missing", "missing angle", "missing side", "missing length", "missing digit", "missing factor", "missing minuend", "missing subtrahend", "multiplication", "division"], doesNotShow: "a missing whole, factor or subtrahend; any numbers" }),
];
export { OPS };
void box; void head; void poly;
