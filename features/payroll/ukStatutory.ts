// UK statutory payroll maths, tax year 2026/27 — PURE (no React, no alias
// imports, no storage) so the web engine (payCalc.ts), the server and the
// verification scripts (server/src/payrollCalcVerify.mts) can all use it.
//
// Sources (fetched 30 Sep 2026; see lib/testing/agent-results/plan3-payroll-calc.json):
//  · gov.uk/guidance/rates-and-thresholds-for-employers-2026-to-2027 (NI, SSP/SMP, student-loan thresholds, Employment Allowance)
//  · gov.uk/income-tax-rates, gov.scot Scottish income tax rates and bands 2026-27
//  · gov.uk payroll-technical-specifications-student-loans (period thresholds, rounding)
//  · gov.uk PAYE manual (K codes: number x 10 + 9) and HMRC PAYE tables method
//    (free pay = (code x 10 + 9) / periods, taxable pay to the whole pound, rate
//    bands pro-rated by period and rounded up to the whole pound).
// Everything here is the ESTIMATE-grade engine: the RTI submission and the
// statutory payslip are still the payroll provider's / HMRC's.

export type FreqK = "weekly" | "fortnightly" | "fourweekly" | "monthly";
export const PPY_K: Record<FreqK, number> = { weekly: 52, fortnightly: 26, fourweekly: 13, monthly: 12 };
/** Pay periods for "annual" figures (thresholds used as-is). */
export type FreqOrAnnual = FreqK | "annual";
const ppyOf = (f: FreqOrAnnual): number => (f === "annual" ? 1 : PPY_K[f]);

// ——— rounding ————————————————————————————————————————————————————————
const EPS = 1e-7;
/** Nearest penny, half away from zero, immune to binary float noise (1.005 -> 1.01). */
export const rnd2 = (n: number): number => { const v = Number(n) || 0; const s = v < 0 ? -1 : 1; return (s * Math.round(Math.abs(v) * 100 + EPS)) / 100; };
/** Truncate toward zero to the penny. */
export const trunc2 = (n: number): number => { const v = Number(n) || 0; return (Math.sign(v) * Math.floor(Math.abs(v) * 100 + EPS)) / 100; };
export const ceil2 = (n: number): number => Math.ceil((Number(n) || 0) * 100 - EPS) / 100;
/** NI rounding: nearest penny, an exact half-penny rounds DOWN (HMRC). */
export const niRound = (n: number): number => Math.ceil((Number(n) || 0) * 100 - 0.5 - EPS) / 100;

// ——— income tax ——————————————————————————————————————————————————————
export const TAX = {
  personalAllowance: 12570,
  taperStart: 100000,
  /** rest-of-UK (England/NI/Wales): 20% to 37,700 of taxable pay, 40% to 125,140, 45% above */
  ruk: { limits: [37700, 125140], rates: [0.2, 0.4, 0.45] },
  /** Scotland 2026/27 (gov.scot, Scottish Budget 13 Jan 2026), as bands of TAXABLE income above the allowance:
   *  19% to 3,967 (income 16,537), 20% to 16,956 (29,526), 21% to 31,092 (43,662), 42% to 62,430 (75,000), 45% to 125,140, 48% above. */
  scot: { limits: [3967, 16956, 31092, 62430, 125140], rates: [0.19, 0.2, 0.21, 0.42, 0.45, 0.48] },
} as const;

export interface ParsedCode { raw: string; valid: boolean; kind: "allow" | "k" | "flat" | "nt"; number: number; flatRate?: number; scottish: boolean; welsh: boolean; nonCumulative: boolean }
/** Parse an HMRC tax code. Handles S/C prefixes, W1/M1/X (non-cumulative), suffix letters, 0T, K, BR/D0/D1/D2/D3 and NT.
 *  An unreadable code is treated as the emergency 1257L month-1 code (valid:false), not silently as cumulative. */
export function parseTaxCode(rawIn: string | undefined | null): ParsedCode {
  let s = String(rawIn ?? "").toUpperCase().replace(/\s+/g, "");
  let nonCumulative = false;
  const m1 = s.match(/(W1|M1|X)$/);
  if (m1) { nonCumulative = true; s = s.slice(0, -m1[1].length); }
  let scottish = false, welsh = false;
  const pre = s.match(/^([SC])(?=BR|D[0-3]|NT|0T|K?\d)/);
  if (pre) { if (pre[1] === "S") scottish = true; else welsh = true; s = s.slice(1); }
  const base = { raw: String(rawIn ?? ""), scottish, welsh, nonCumulative };
  if (s === "NT") return { ...base, valid: true, kind: "nt", number: 0 };
  const flat = s.match(/^(BR|D0|D1|D2|D3)$/);
  if (flat) {
    const t = flat[1];
    const rUk: Record<string, number> = { BR: 0.2, D0: 0.4, D1: 0.45 };
    const sc: Record<string, number> = { BR: 0.2, D0: 0.21, D1: 0.42, D2: 0.45, D3: 0.48 };
    const rate = (scottish ? sc : rUk)[t];
    if (rate == null) return { ...base, valid: false, kind: "allow", number: 1257, scottish: false, welsh: false, nonCumulative: true };
    return { ...base, valid: true, kind: "flat", number: 0, flatRate: rate };
  }
  const k = s.match(/^K(\d{1,4})$/);
  if (k) return { ...base, valid: true, kind: "k", number: Number(k[1]) };
  const a = s.match(/^(\d{1,4})([LMNPTVY])$/);
  if (a) return { ...base, valid: true, kind: "allow", number: Number(a[1]) };
  return { ...base, valid: false, kind: "allow", number: 1257, scottish: false, welsh: false, nonCumulative: true };
}

export interface PayeOpts {
  freq: FreqOrAnnual;
  /** Cumulative basis: tax-year period number (1..ppy) and the pay/tax to date BEFORE this period
   *  (from the employee's YTD, or a P45 for a starter). Omitted = Week 1/Month 1 basis (steady-pay estimate). */
  cumulative?: { period: number; payToDate: number; taxToDate: number };
  /** Employee's tax regime when the code carries no S/C prefix. */
  regime?: "uk" | "scotland" | "wales";
}
export interface PayeResult { tax: number; taxToDate: number; taxablePayToDate: number; basis: "cumulative" | "period1"; code: ParsedCode }

/** PAYE for ONE pay period, the HMRC way. `taxablePay` is this period's taxable pay
 *  (gross less net-pay pension, if any). Cumulative when the code is cumulative AND `cumulative` is given. */
export function payePeriod(taxablePay: number, taxCodeRaw: string, o: PayeOpts): PayeResult {
  const code = parseTaxCode(taxCodeRaw);
  const ppy = ppyOf(o.freq);
  const useCum = !!o.cumulative && !code.nonCumulative;
  const n = useCum ? Math.min(ppy, Math.max(1, Math.round(o.cumulative!.period))) : 1;
  const prevPay = useCum ? o.cumulative!.payToDate : 0;
  const prevTax = useCum ? o.cumulative!.taxToDate : 0;
  const payToDate = prevPay + (Number(taxablePay) || 0);
  const basis = useCum ? "cumulative" : "period1";
  if (code.kind === "nt") return { tax: 0, taxToDate: 0, taxablePayToDate: 0, basis, code };
  const wholePay = Math.floor(Math.max(0, payToDate) + EPS);
  let taxable: number, table: { limits: readonly number[]; rates: readonly number[] };
  const scot = code.scottish || (o.regime === "scotland" && !code.welsh);
  if (code.kind === "flat") {
    taxable = wholePay; table = { limits: [], rates: [code.flatRate!] };
  } else {
    table = scot ? TAX.scot : TAX.ruk;
    const adj = code.number === 0 && code.kind === "allow" ? 0 : ceil2(((code.number * 10 + 9) * n) / ppy); // 0T = no allowance at all (no +9)
    taxable = code.kind === "k" ? Math.floor(Math.max(0, payToDate + adj) + EPS) : Math.floor(Math.max(0, payToDate - adj) + EPS);
  }
  let due = 0, lower = 0;
  for (let i = 0; i < table.rates.length; i++) {
    const upper = i < table.limits.length ? Math.ceil((table.limits[i] * n) / ppy - EPS) : Infinity;
    if (taxable > lower) due += (Math.min(taxable, upper) - lower) * table.rates[i];
    lower = upper;
    if (taxable <= upper) break;
  }
  const taxToDate = trunc2(due);
  let tax = rnd2(taxToDate - prevTax);
  if (!useCum && tax < 0) tax = 0;
  // regulatory limit: on a K code, tax in a period cannot exceed 50% of that period's pay
  if (code.kind === "k" && tax > 0.5 * Math.max(0, taxablePay)) tax = trunc2(0.5 * Math.max(0, taxablePay));
  return { tax, taxToDate: rnd2(prevTax + tax), taxablePayToDate: taxable, basis, code };
}

// ——— National Insurance ——————————————————————————————————————————————
/** HMRC's published per-period Class 1 thresholds, 2026/27 (weekly x2 / x4 for fortnightly / 4-weekly). */
export function niThresholds(freq: FreqOrAnnual) {
  if (freq === "annual") return { LEL: 6708, PT: 12570, ST: 5000, UEL: 50270, FUST: 25000 };
  if (freq === "monthly") return { LEL: 559, PT: 1048, ST: 417, UEL: 4189, FUST: 2083 };
  const k = freq === "weekly" ? 1 : freq === "fortnightly" ? 2 : 4;
  return { LEL: 129 * k, PT: 242 * k, ST: 96 * k, UEL: 967 * k, FUST: 481 * k };
}
/** Employee rates by category letter: [PT..UEL, above UEL]. Unknown letters fall back to A (and `known` is false). */
const EE_RATES: Record<string, [number, number]> = {
  A: [0.08, 0.02], H: [0.08, 0.02], M: [0.08, 0.02], F: [0.08, 0.02], V: [0.08, 0.02],
  B: [0.0185, 0.02], I: [0.0185, 0.02],
  J: [0.02, 0.02], Z: [0.02, 0.02], L: [0.02, 0.02],
  C: [0, 0], S: [0, 0],
};
/** Upper secondary threshold category: 0% employer NI up to UST. H apprentice <25, M under 21, Z under 21 (deferred), V veteran → UEL; freeport F/I/L/S → 25,000. */
const ER_UST: Record<string, "uel" | "freeport"> = { H: "uel", M: "uel", Z: "uel", V: "uel", F: "freeport", I: "freeport", L: "freeport", S: "freeport" };
export const niCatKnown = (cat: string) => (String(cat || "A").toUpperCase() in EE_RATES);
export interface NiResult { ee: number; er: number; known: boolean }
/** Class 1 NI on ONE period's NI-able earnings (not annualised: HMRC applies the period thresholds). */
export function niPeriod(earnings: number, catRaw: string, freq: FreqOrAnnual): NiResult {
  const cat = String(catRaw || "A").toUpperCase().trim();
  const known = cat in EE_RATES;
  const t = niThresholds(freq);
  const g = Math.max(0, Number(earnings) || 0);
  const [mainR, aboveR] = EE_RATES[known ? cat : "A"];
  const ee = niRound(Math.max(0, Math.min(g, t.UEL) - t.PT) * mainR + Math.max(0, g - t.UEL) * aboveR);
  const ust = ER_UST[cat] === "uel" ? t.UEL : ER_UST[cat] === "freeport" ? t.FUST : t.ST;
  const er = niRound(Math.max(0, g - ust) * 0.15);
  return { ee, er, known };
}

// ——— Workplace pension (auto-enrolment) ——————————————————————————————
export const AE = { lowerAnnual: 6240, upperAnnual: 50270, triggerAnnual: 10000, eeRate: 0.05, erRate: 0.03 } as const;
/** Qualifying earnings for one period: the slice of pay between the lower (6,240/yr) and upper (= NI UEL) limits, per period. */
export function qualifyingEarnings(gross: number, freq: FreqOrAnnual): number {
  const lower = AE.lowerAnnual / ppyOf(freq), upper = niThresholds(freq).UEL;
  return Math.max(0, Math.min(Math.max(0, gross), upper) - lower);
}

// ——— Student / postgraduate loans ————————————————————————————————————
export const SL = {
  plan1: { annual: 26900, rate: 0.09 }, plan2: { annual: 29385, rate: 0.09 }, plan4: { annual: 33795, rate: 0.09 },
  plan5: { annual: 25000, rate: 0.09 }, postgrad: { annual: 21000, rate: 0.06 },
} as const;
export type SlPlan = "none" | keyof typeof SL;
/** Period threshold = annual ÷ periods rounded DOWN to the penny; deduction = (earnings − threshold) × rate rounded DOWN to the pound. */
export function studentLoanDeduction(earnings: number, plan: SlPlan | undefined, freq: FreqK): number {
  if (!plan || plan === "none" || !(plan in SL)) return 0;
  const { annual, rate } = SL[plan];
  const pt = Math.floor((annual / PPY_K[freq]) * 100 + EPS) / 100;
  const e = Number(earnings) || 0;
  return e > pt ? Math.floor((e - pt) * rate + EPS) : 0;
}

// ——— Statutory pay rates (weekly) ————————————————————————————————————
export const STAT = { sspFlat: 123.25, sspPct: 0.8, smpFlat: 194.32, smpFirst6Pct: 0.9, employmentAllowance: 10500 } as const;
/** SSP per week from 6 Apr 2026: lower of £123.25 and 80% of average weekly earnings (payable from day 1, no LEL test). */
export const sspWeekly = (awe: number) => rnd2(Math.min(STAT.sspFlat, STAT.sspPct * Math.max(0, awe)));
/** SMP week 1..39: first 6 weeks 90% AWE; then lower of £194.32 and 90% AWE. SPP/SAP/ShPP: lower of £194.32 and 90% AWE. */
export const smpWeekly = (awe: number, weekNo: number) => rnd2(weekNo <= 6 ? STAT.smpFirst6Pct * Math.max(0, awe) : Math.min(STAT.smpFlat, STAT.smpFirst6Pct * Math.max(0, awe)));
export const sppWeekly = (awe: number) => rnd2(Math.min(STAT.smpFlat, STAT.smpFirst6Pct * Math.max(0, awe)));

// ——— Tax-year period number ————————————————————————————————————————
/** The tax-year period (1..ppy) a payment date falls in. Monthly: tax months run 6th–5th (period 1 = 6 Apr–5 May).
 *  Weekly/fortnightly/4-weekly count from 6 April of the tax year the date is in. */
export function taxPeriodNo(paidOnISO: string, freq: FreqK): number {
  const d = new Date(`${paidOnISO}T12:00:00Z`);
  const y = d.getUTCFullYear(), m = d.getUTCMonth() + 1, day = d.getUTCDate();
  const startYear = m > 4 || (m === 4 && day >= 6) ? y : y - 1;
  const start = Date.UTC(startYear, 3, 6, 12);
  const days = Math.floor((d.getTime() - start) / 86_400_000);
  if (freq === "monthly") { const mm = (y - startYear) * 12 + (m - 4) + (day >= 6 ? 0 : -1); return Math.min(12, Math.max(1, mm + 1)); }
  const span = freq === "weekly" ? 7 : freq === "fortnightly" ? 14 : 28;
  return Math.min(PPY_K[freq], Math.floor(days / span) + 1);
}
/** Starter declaration → the code HMRC tells you to use: A 1257L cumulative; B 1257L Week1/Month1; C BR cumulative. */
export const starterCode = (decl: "A" | "B" | "C"): string => (decl === "A" ? "1257L" : decl === "B" ? "1257L M1" : "BR");
