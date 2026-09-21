// Maths KS1-KS2 extension pictures, part 2: money, time and measures (agent X1).
import type { Pic } from "./types";
import { mk, clockFace, ln, rect, txt, circ, dot, poly, path, cap, pt, arrow, n } from "./ext-maths-primary-kit";

const poly7 = (cx: number, cy: number, R: number, k: number, start = 90): [number, number][] => Array.from({ length: k }, (_, i) => pt(cx, cy, R, start + (360 / k) * i));

// ── money (UK) ───────────────────────────────────────────────────────────────────
const coins = (() => {
  // real UK coin diameters (mm): 1p 20.3, 2p 25.9, 5p 18.0, 10p 24.5, 20p 21.4, 50p 27.3, £1 23.43, £2 28.4; 1.46 units per mm
  const k = 1.46 / 2;
  const cx = [32, 90, 148, 206];
  let s = "";
  const round = (x: number, y: number, d: number, fill: string, label: string) => circ(x, y, d * k, `l ${fill}`) + txt(x, y + 4, label, "ts");
  const hept = (x: number, y: number, d: number, label: string) => poly(poly7(x, y, d * k * 1.02, 7), "l f6") + txt(x, y + 4, label, "ts");
  s += round(cx[0], 40, 20.3, "f3", "1p") + round(cx[1], 40, 25.9, "f3", "2p") + round(cx[2], 40, 18, "f6", "5p") + round(cx[3], 40, 24.5, "f6", "10p");
  s += hept(cx[0], 100, 21.4, "20p") + hept(cx[1], 100, 27.3, "50p");
  s += poly(poly7(cx[2], 100, 23.43 * k * 1.02, 12, 75), "l f3") + circ(cx[2], 100, 23.43 * k * 0.66, "l f6") + txt(cx[2], 104, "£1", "ts");
  s += circ(cx[3], 100, 28.4 * k, "l f6") + circ(cx[3], 100, 28.4 * k * 0.66, "l f3") + txt(cx[3], 104, "£2", "ts");
  return s + txt(120, 146, "100 pence (100p) make £1", "ts") + txt(120, 160, "UK coins: 1p, 2p, 5p, 10p, 20p, 50p, £1, £2", "tx tm");
})();
const notes = (() => {
  let s = "";
  const note = (x: number, y: number, v: string, f: string) => rect(x, y, 104, 56, `l ${f}`, 5) + rect(x + 6, y + 6, 92, 44, "th", 3) + txt(x + 52, y + 36, v, "tb");
  s += note(10, 12, "£5", "f2") + note(126, 12, "£10", "f3") + note(10, 84, "£20", "f5") + note(126, 84, "£50", "f4");
  return s + cap("UK banknotes: £5, £10, £20 and £50", 164);
})();

// ── time ──────────────────────────────────────────────────────────────────────────
const clockWords = (() => {
  const items: [number, number, number, string, string, string][] = [[30, 3, 0, "3", "o'clock", "at 12"], [90, 3, 30, "half past", "3", "at 6"], [150, 3, 15, "quarter", "past 3", "at 3"], [210, 3, 45, "quarter", "to 4", "at 9"]];
  let s = "";
  items.forEach(([x, h, m, a, b, c]) => { s += clockFace(x, 38, 25, h, m) + txt(x, 82, a, "tx") + txt(x, 93, b, "tx") + txt(x, 108, "minute hand", "tt tm") + txt(x, 117, c, "tt tm"); });
  return s + txt(120, 140, "o'clock, half past, quarter past, quarter to", "tx tm") + txt(120, 153, "(the hour hand is short, the minute hand is long)", "tx tm");
})();
const clockMinutes = (() => {
  const cx = 120, cy = 82, r = 52;
  let s = clockFace(cx, cy, r, 0, 0, { nums: "all", hands: false });
  for (let m = 5; m <= 60; m += 5) { const p = pt(cx, cy, r + 11, 90 - m * 6); s += txt(p[0], p[1] + 3.5, String(m), "tt tm"); }
  s += ln(cx, cy - r + 22, cx, cy + r - 22, "th") + txt(cx + 62, 16, "past", "ts ta tl") + txt(cx - 62, 16, "to", "ts tr te");
  return s + txt(120, 164, "each number is 5 minutes", "tx tm");
})();
const digital = (() => {
  const rows: [string, string][] = [["midnight", "00:00"], ["1 am", "01:00"], ["12 noon", "12:00"], ["1 pm", "13:00"], ["3 pm", "15:00"], ["6 pm", "18:00"], ["11 pm", "23:00"]];
  let s = txt(70, 14, "12-hour", "ts") + txt(170, 14, "24-hour", "ts");
  rows.forEach(([a, b], i) => { const y = 22 + i * 19; s += txt(96, y + 12.5, a, "ts te") + arrow(102, y + 9, 128, y + 9, "th", 5) + rect(134, y, 64, 17, "l f6", 4) + txt(166, y + 13, b, "ts"); });
  return s + txt(120, 166, "digital time: hours then minutes", "tx tm");
})();
/** rows "left = right" */
const equiv = (rows: [string, string][], y0 = 10, ph = 26, note = "") => {
  let s = "";
  rows.forEach(([a, b], i) => { const y = y0 + i * ph; s += rect(16, y, 96, 20, "l f1", 5) + txt(64, y + 14.5, a, "ts") + txt(120, y + 15, "=", "tb") + rect(128, y, 96, 20, "l f3", 5) + txt(176, y + 14.5, b, "ts"); });
  return s + (note ? txt(120, y0 + rows.length * ph + 6, note, "tx tm") : "");
};
const unitsTime = equiv([["60 seconds", "1 minute"], ["60 minutes", "1 hour"], ["24 hours", "1 day"], ["7 days", "1 week"], ["12 months", "1 year"], ["365 days", "1 year"]], 6, 26) + txt(120, 165, "a leap year has 366 days", "tx tm");
const daysWeek = (() => {
  const d = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  let s = "";
  d.forEach((x, i) => { s += rect(20, 10 + i * 21, 100, 18, `l ${i < 5 ? "f1" : "f3"}`, 5) + txt(70, 23 + i * 21, x, "ts"); });
  s += path("M128 12 v0 M128 12 h4 v100 h-4", "th2") + txt(140, 66, "weekdays", "ts tl") + path("M128 118 h4 v40 h-4", "th2") + txt(140, 142, "the weekend", "ts tl");
  return s + txt(180, 24, "7 days", "ts tm") + txt(180, 36, "in a week", "ts tm");
})();
const monthsYear = (() => {
  const m: [string, string][] = [["January", "31"], ["February", "28*"], ["March", "31"], ["April", "30"], ["May", "31"], ["June", "30"], ["July", "31"], ["August", "31"], ["September", "30"], ["October", "31"], ["November", "30"], ["December", "31"]];
  let s = "";
  m.forEach(([a, b], i) => { const c = i % 3, r = Math.floor(i / 3); s += rect(8 + c * 76, 8 + r * 30, 72, 26, `l ${b === "31" ? "f1" : b === "30" ? "f3" : "f4"}`, 5) + txt(44 + c * 76, 19 + r * 30, a, "tx") + txt(44 + c * 76, 30 + r * 30, `${b} days`, "tt tm"); });
  return s + txt(120, 140, "12 months in a year", "ts") + txt(120, 156, "* 29 days in a leap year", "tx tm");
})();

// ── length, mass, capacity, temperature ──────────────────────────────────────────────
const lengthUnits = equiv([["10 mm", "1 cm"], ["100 cm", "1 m"], ["1000 mm", "1 m"], ["1000 m", "1 km"]], 14, 30) + txt(120, 140, "millimetre (mm), centimetre (cm),", "tx tm") + txt(120, 152, "metre (m), kilometre (km)", "tx tm");
const massUnits = equiv([["1000 g", "1 kg"], ["500 g", "½ kg"], ["250 g", "¼ kg"]], 14, 30) + txt(120, 128, "gram (g) for light things,", "tx tm") + txt(120, 140, "kilogram (kg) for heavier things", "tx tm") + txt(120, 156, "mass: how heavy something is", "tx tm");
const measureLen = (() => {
  const x0 = 22, u = 19;
  let s = rect(10, 104, 206, 34, "l f3", 3);
  for (let i = 0; i <= 10; i++) { s += ln(x0 + i * u, 104, x0 + i * u, 104 + (i % 1 === 0 ? 14 : 8), "th2") + txt(x0 + i * u, 132, String(i), "tx"); }
  for (let i = 0; i < 10; i++) s += ln(x0 + i * u + u / 2, 104, x0 + i * u + u / 2, 111, "th");
  s += txt(214, 148, "cm", "tx tm te");
  // pencil from 0 to 8 cm
  const x1 = x0 + 8 * u;
  s += poly([[x0, 54], [x1 - 14, 54], [x1, 63], [x1 - 14, 72], [x0, 72]], "l f3") + poly([[x1 - 14, 54], [x1, 63], [x1 - 14, 72]], "l f4");
  s += ln(x0, 74, x0, 102, "h") + ln(x1, 74, x1, 102, "h");
  s += txt(x0 + 4, 40, "1 line up the end with 0", "tx tl") + txt(x1 + 8, 92, "2 read here", "tx tl ta");
  return s + txt(120, 162, "measuring length with a ruler", "tx tm");
})();
const compareLen = (() => {
  let s = ln(30, 14, 30, 118, "h");
  [[50, "shortest"], [100, "longer"], [160, "longest"]].forEach(([w, l], i) => { const y = 24 + i * 32; s += rect(30, y, w as number, 16, `l ${["f1", "f3", "f2"][i]}`, 3) + txt(30 + (w as number) + 8, y + 12, l as string, "ts tl"); });
  return s + txt(120, 140, "start at the same point,", "tx tm") + txt(120, 152, "then compare how far each one reaches", "tx tm");
})();
const balance = (() => {
  const cx = 120, cy = 44, half = 84, tilt = 10 * (Math.PI / 180);
  const lx = cx - half * Math.cos(tilt), ly = cy + half * Math.sin(tilt), rx = cx + half * Math.cos(tilt), ry = cy - half * Math.sin(tilt);
  let s = ln(cx, cy, cx, 132, "l") + rect(92, 132, 56, 8, "l f6", 3) + ln(lx, ly, rx, ry, "l") + circ(cx, cy, 4.5, "l f3");
  const pan = (x: number, y: number, blockW: number, heavy: boolean) => ln(x, y, x - 24, y + 44, "th") + ln(x, y, x + 24, y + 44, "th") + path(`M${n(x - 28)} ${n(y + 44)} H${n(x + 28)} q-3 10 -28 10 q-25 0 -28 -10 z`, "l f6") + rect(x - blockW / 2, y + 44 - blockW, blockW, blockW, `l ${heavy ? "f4" : "f1"}`, 2);
  s += pan(lx, ly, 22, true) + pan(rx, ry, 12, false);
  return s + txt(lx, ly + 76, "heavier", "ts tr") + txt(rx, ry + 76, "lighter", "ts ta") + txt(120, 162, "the heavier side goes down", "tx tm");
})();
const jug = (() => {
  let s = path("M84 24 L92 32 V132 Q92 140 100 140 H144 Q152 140 152 132 V26 H92", "l f0") + path("M152 44 q22 0 22 24 q0 24 -22 24", "l");
  const top = 34, bot = 132, ml = (v: number) => bot - (v / 1000) * (bot - top);
  [[0, "0"], [250, "250"], [500, "500"], [750, "750"], [1000, "1000"]].forEach(([v, t]) => { const y = ml(v as number); s += ln(92, y, v === 500 || v === 1000 ? 108 : 102, y, "th2") + txt(112, y + 3, `${t} ml`, "tx tl"); });
  s += txt(44, 76, "1 litre", "ts") + txt(44, 90, "= 1000 ml", "ts") + txt(42, 112, "capacity:", "tx tm") + txt(42, 123, "how much", "tx tm") + txt(42, 134, "it holds", "tx tm");
  return s;
})();
const thermo = (() => {
  const y = (t: number) => 116 - ((t + 10) / 50) * 96;
  let s = rect(112, 20, 16, 100, "l f0", 8) + circ(120, 134, 13, "l fr") + rect(116.5, y(20), 7, 130 - y(20), "fr");
  for (let t = -10; t <= 40; t += 10) { s += ln(128, y(t), 138, y(t), "th2") + txt(142, y(t) + 3.5, String(t).replace("-", "−"), "tx tl"); }
  return s + txt(100, 60, "temperature in", "tx te tm") + txt(100, 72, "degrees", "tx te tm") + txt(100, 84, "Celsius (°C)", "tx te tm") + txt(120, 165, "", "tx");
})();

const S = (id: string, title: string, concepts: string[], body: string, alt: string, caption: string, evidence: string, extra: Partial<Pic> = {}) => mk({ id, title, concepts, body, alt, caption, evidence, extra });
export const EXT_MEASURE: Pic[] = [
  S("uk-coins", "UK coins", ["coin", "coins", "pence", "p coins", "pounds and pence"], coins, "The eight UK coins drawn at their relative sizes and labelled 1p, 2p, 5p, 10p, 20p, 50p, £1 and £2, with 100 pence making £1.", "UK coins",
    "UK coin denominations 1p, 2p, 5p, 10p, 20p, 50p, £1, £2 (Oak KS1 money). Diameters are the real coin diameters to one scale (1p 20.3mm ... £2 28.4mm); 20p and 50p seven-sided, £1 twelve-sided. 100p = £1.", { avoid: ["flip", "toss", "heads", "tails", "probability", "coin toss", "fair coin", "biased", "euro", "dollar", "cent ", "cents", "yen", "rupee"] }),
  S("uk-banknotes", "UK banknotes", ["banknote", "bank note", "pound note"], notes, "Four UK banknotes in different colours labelled £5, £10, £20 and £50.", "UK banknotes",
    "UK banknote values £5, £10, £20, £50 (Oak KS2 money). Values only: no portraits or security details are drawn.", { avoid: ["euro", "dollar", "cents", "yen", "rupee"] }),
  S("clock-time-words", "O'clock, half past, quarter past and quarter to", ["o clock", "oclock", "half past", "quarter past", "quarter to", "past the hour"], clockWords, "Four clocks: 3 o'clock (minute hand at 12), half past 3 (minute hand at 6), quarter past 3 (minute hand at 3) and quarter to 4 (minute hand at 9).", "Telling the time",
    "o'clock = minute hand at 12; half past = at 6; quarter past = at 3; quarter to = at 9 (Oak KS1 telling the time). Hour hand placed exactly (30 degrees per hour + 0.5 per minute).", { numeric: true, avoid: ["digital", "24 hour", "24-hour"] }),
  S("clock-minutes", "Minutes past and minutes to", ["minutes past", "minutes to", "minute marks", "past and to"], clockMinutes, "A clock face with the hour numbers inside and the minute numbers 5 to 60 around the outside, with past written on the right half and to on the left half.", "Minutes past and to",
    "Each numeral is 5 minutes; the right half of the clock is minutes PAST the hour and the left half minutes TO the next hour (Oak KS1-KS2 telling the time). Outer numerals every 30 degrees.", { avoid: ["digital"] }),
  S("digital-24-hour", "Digital and 24-hour time", ["digital clock", "digital time", "digital clocks", "24 hour clock", "24 hour time", "24 hour", "am and pm"], digital, "A table changing 12-hour times to 24-hour digital times: midnight is 00:00, 1 am 01:00, 12 noon 12:00, 1 pm 13:00, 3 pm 15:00, 6 pm 18:00, 11 pm 23:00.", "12-hour and 24-hour time",
    "24-hour clock: hours run 00-23; from 1 pm add 12 (Oak KS2 'digital time'). Fixed facts.", { avoid: ["analogue"] }),
  S("units-of-time", "Units of time", ["units of time", "seconds minutes and hours", "seconds minutes hours", "hours minutes and seconds", "minutes and seconds", "hours and minutes"], unitsTime, "Time conversions: 60 seconds is 1 minute, 60 minutes is 1 hour, 24 hours is 1 day, 7 days is 1 week, 12 months is 1 year and 365 days is 1 year.", "Units of time",
    "60 s = 1 min, 60 min = 1 h, 24 h = 1 day, 7 days = 1 week, 12 months = 1 year, 365 days = 1 year (366 in a leap year) (Oak KS2 units of time). Fixed facts.", { avoid: ["speed", "distance", "time graph"] }),
  S("days-of-the-week", "Days of the week", ["days of the week", "day of the week", "weekend", "weekdays"], daysWeek, "The seven days of the week in order from Monday to Sunday: Monday to Friday are weekdays and Saturday and Sunday are the weekend.", "Days of the week",
    "Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday (UK week from Monday); 5 weekdays + 2 weekend days (Oak KS1 'days of the week').", {}),
  S("months-of-the-year", "Months of the year", ["months of the year", "days in a month", "days in each month", "leap year"], monthsYear, "The twelve months of the year with their number of days: 31 for January, March, May, July, August, October and December; 30 for April, June, September and November; 28 (29 in a leap year) for February.", "Months of the year",
    "Days per month: Jan 31, Feb 28 (29 in a leap year), Mar 31, Apr 30, May 31, Jun 30, Jul 31, Aug 31, Sep 30, Oct 31, Nov 30, Dec 31 (Oak KS1-KS2 'months of the year'). Fixed facts.", {}),
  S("length-units", "Units of length", ["centimetre", "millimetre", "metre", "kilometre", "units of length", "cm and mm", "mm and cm", "metres and centimetres"], lengthUnits, "Metric length conversions: 10 mm is 1 cm, 100 cm is 1 m, 1000 mm is 1 m and 1000 m is 1 km.", "Units of length",
    "10 mm = 1 cm, 100 cm = 1 m, 1000 mm = 1 m, 1000 m = 1 km (Oak KS2 measures). Fixed facts.", { avoid: ["metre stick", "square", "cube", "cubic", "per second", "metres per", "speed", "area", "volume"] }),
  S("measure-length", "Measuring length with a ruler", ["measure length", "measure lengths", "measuring length", "measure a length", "measure with a ruler", "measuring with a ruler", "measuring lengths"], measureLen, "A pencil laid along a ruler with its left end lined up at 0 and an arrow to the number at the other end: 1 line up the end with 0, 2 read here.", "Measuring length",
    "To measure with a ruler, line one end up with 0 and read the number at the other end (Oak KS1 'measure length'). A pencil of exactly 8 cm is drawn (ticks every 20 units): refused on slides with digits.", { numeric: true }),
  S("compare-lengths", "Comparing lengths", ["longer", "shorter", "longest", "shortest", "compare lengths", "compare heights"], compareLen, "Three strips lined up at the same starting point: the shortest, a longer one and the longest.", "Comparing lengths",
    "Compare lengths by starting at the same point and seeing how far each reaches (Oak KS1 'longer', 'shorter'). Three strips of increasing length.", { requires: ["length", "lengths", "long", "measure", "compare", "height"], avoid: ["longer than the", "shorter than the", "time", "longer method"] }),
  S("balance-scales", "Heavier and lighter on balance scales", ["heavier", "lighter", "heaviest", "lightest", "balance scales", "balance scale", "weigh"], balance, "A balance with the left pan lower holding a bigger block, labelled heavier, and the right pan higher holding a smaller block, labelled lighter.", "Heavier and lighter",
    "On a balance the heavier side goes down and the lighter side goes up (Oak KS1 'heavier', 'lighter'). The tilt is 10 degrees, computed.", { avoid: ["balanced", "level", "equal mass", "equal weight"] }),
  S("mass-units", "Grams and kilograms", ["mass", "kilogram", "gram", "units of mass", "kg and g"], massUnits, "Mass conversions: 1000 g is 1 kg, 500 g is half a kilogram and 250 g is a quarter of a kilogram.", "Grams and kilograms",
    "1000 g = 1 kg; 500 g = 1/2 kg; 250 g = 1/4 kg (Oak KS2 'mass'). Fixed facts.", { avoid: ["atomic mass", "relative mass", "mass number", "centre of mass", "critical mass"] }),
  S("capacity-jug", "Litres and millilitres", ["capacity", "litre", "millilitre", "measuring jug", "l and ml", "litres and millilitres"], jug, "A measuring jug with a scale from 0 to 1000 ml in steps of 250 ml, beside the words 1 litre = 1000 ml.", "Capacity",
    "1 litre = 1000 ml; a measuring jug has a scale of ml, here 0, 250, 500, 750, 1000 (evenly spaced: 0.098 units per ml). Capacity = how much a container holds (Oak KS2 'capacity'). No liquid level is drawn.", { avoid: ["volume of a cuboid", "cubic centimetre", "per litre"] }),
  S("thermometer", "Thermometer", ["temperature", "thermometer", "degrees celsius", "celsius"], thermo, "A thermometer with a scale from minus 10 to 40 degrees Celsius; the red column is level with 20.", "Temperature",
    "Temperature is measured in degrees Celsius on a thermometer (Oak KS2 'temperature'). Scale -10 to 40 in tens, evenly spaced; the column is at 20 (refused on slides with digits).", { numeric: true, avoid: ["fahrenheit", "kelvin", "body temperature"] }),
];
void rect;
