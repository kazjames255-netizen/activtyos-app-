// Payroll calculation verification — UK 2026/27. Every expected figure below is HAND-COMPUTED
// from the official HMRC rules (see the derivation comment on each case) and compared with the
// engine (features/payroll/ukStatutory.ts + payCalc.ts computeLine). Pure: no network, no DB.
//
//   cd server && npx tsx --tsconfig ../tsconfig.json src/payrollCalcVerify.mts
//
// Exit code 1 on any mismatch. Results are also summarised in
// lib/testing/agent-results/plan3-payroll-calc.json.
import {
  payePeriod, niPeriod, qualifyingEarnings, studentLoanDeduction, sspWeekly, smpWeekly, sppWeekly,
  rnd2, trunc2, niRound, taxPeriodNo, parseTaxCode, starterCode, niThresholds,
} from "../../features/payroll/ukStatutory";
import { computeLine, payeAnnual, eeNiAnnual, erNiAnnual, checkRunLine, resolveCalcMode, describeMismatches, ytdInputsFor, employmentShare, type Emp, type Line } from "../../features/payroll/payCalc";

let pass = 0, fail = 0;
const near = (a: number, b: number) => Math.abs(a - b) < 0.0051;
function eq(label: string, got: number, want: number) {
  if (near(got, want)) { pass++; } else { fail++; console.error(`  ✗ ${label}: got ${got}, want ${want}`); }
}
function ok(label: string, cond: boolean, detail?: unknown) {
  if (cond) pass++; else { fail++; console.error(`  ✗ ${label}`, detail ?? ""); }
}
type F = "weekly" | "fortnightly" | "fourweekly" | "monthly";

// ── 1. rounding ────────────────────────────────────────────────────────────
eq("rnd2(1.005)", rnd2(1.005), 1.01);
eq("rnd2(2.675)", rnd2(2.675), 2.68);
eq("rnd2(-1.005)", rnd2(-1.005), -1.01);
eq("trunc2(0.29)", trunc2(0.29), 0.29);
eq("trunc2(-0.299)", trunc2(-0.299), -0.29);
eq("niRound half down .005", niRound(0.005), 0.00);
eq("niRound .0050001", niRound(0.0050001), 0.01);
eq("niRound .015", niRound(0.015), 0.01);
eq("niRound .025", niRound(0.025), 0.02);

// ── 2. PAYE, Month1/Week1 basis (hand-computed; free pay = ceil((N*10+9)/ppy), taxable floored to £) ──
const P = (pay: number, code: string, freq: F | "annual" = "monthly", extra: object = {}) => payePeriod(pay, code, { freq, ...extra }).tax;
eq("M1 1257L £0", P(0, "1257L"), 0);
eq("M1 1257L exactly free pay 1048.25", P(1048.25, "1257L"), 0);
eq("M1 1257L 1049.24 (taxable 0.99->0)", P(1049.24, "1257L"), 0);
eq("M1 1257L 1049.25 (taxable 1)", P(1049.25, "1257L"), 0.20);
eq("M1 1257L 3000 = 1951*20%", P(3000, "1257L"), 390.20);
eq("M1 1257L 4189 (UEL) taxable 3140", P(4189, "1257L"), 628.00);
eq("M1 1257L band limit exactly 3142", P(4190.25, "1257L"), 628.40);
eq("M1 1257L one £ into higher", P(4191.25, "1257L"), 628.80);
eq("M1 1257L 10000 taxable 8951", P(10000, "1257L"), 2952.00);
eq("M1 1257L 12000 crosses 125,140 limit (10429/mo)", P(12000, "1257L"), 3778.10);
eq("W1 1257L 500 (free 241.91) taxable 258", P(500, "1257L", "weekly"), 51.60);
eq("W1 1257L 1000 taxable 758 limit 725", P(1000, "1257L", "weekly"), 158.20);
eq("Fortnight 1257L 2000 (free 483.81) taxable 1516", P(2000, "1257L", "fortnightly"), 316.40);
eq("4-weekly 1257L 2000 (free 967.62) taxable 1032", P(2000, "1257L", "fourweekly"), 206.40);
eq("BR 1000", P(1000, "BR"), 200);
eq("BR 1000.99 truncs to 1000", P(1000.99, "BR"), 200);
eq("D0 1000", P(1000, "D0"), 400);
eq("D1 1000", P(1000, "D1"), 450);
eq("NT 5000", P(5000, "NT"), 0);
eq("0T 3000 no allowance", P(3000, "0T"), 600);
eq("K100 M1 2000: addl 84.09 -> 2084", P(2000, "K100"), 416.80);
eq("K code 50% regulatory limit (K5000 on £1000)", P(1000, "K5000"), 500);
eq("S1257L 3000 Scottish bands", P(3000, "S1257L"), 392.27);
eq("C1257L (Wales) = rUK", P(3000, "C1257L"), 390.20);
eq("regime scotland, plain 1257L -> Scottish", P(3000, "1257L", "monthly", { regime: "scotland" }), 392.27);
eq("SBR 1000", P(1000, "SBR"), 200);
eq("SD0 1000 (21%)", P(1000, "SD0"), 210);
eq("SD1 1000 (42%)", P(1000, "SD1"), 420);
eq("SD2 1000 (45%)", P(1000, "SD2"), 450);
eq("SD3 1000 (48%)", P(1000, "SD3"), 480);
eq("annual 1257L 50,000 (free 12,579)", payeAnnual(50000), 7484.20);
eq("annual 1257L 125,140", payeAnnual(125140), 37484.40);
eq("annual 1257L 150,000 (45% over taxable 125,140)", payeAnnual(150000), 48042.45);
eq("annual 1257L 120,000 REGRESSION: old engine taxed 45% above taxable 112,570", payeAnnual(120000), 35428.40);
eq("annual BR 30000", payeAnnual(30000, "BR"), 6000);
// emergency / non-cumulative markers ignore YTD
eq("1257L M1 with ytd ignored", P(3000, "1257L M1", "monthly", { cumulative: { period: 6, payToDate: 0, taxToDate: 0 } }), 390.20);
eq("1257L W1 (weekly 500)", P(500, "1257L W1", "weekly"), 51.60);
eq("1257LX emergency", P(3000, "1257LX"), 390.20);
ok("garbage code flagged invalid", parseTaxCode("ZZZ").valid === false && parseTaxCode("ZZZ").nonCumulative);
eq("garbage code -> emergency 1257L M1", P(3000, "ZZZ"), 390.20);
ok("parse S/C/K/BR", parseTaxCode("S1257L").scottish && parseTaxCode("C1257L").welsh && parseTaxCode("K497").kind === "k" && parseTaxCode("BR").kind === "flat" && parseTaxCode("NT").kind === "nt" && parseTaxCode("0T").number === 0);
ok("starter decl A/B/C codes", starterCode("A") === "1257L" && starterCode("B") === "1257L M1" && starterCode("C") === "BR");
// Starter declaration B = 1257L M1 (no catch-up even in month 7); A cumulative in month 7 with no prior pay: catch-up gives no tax up to 7 months of allowance
eq("Starter A month 7, first pay 3000 (free to date 7337.75)", P(3000, starterCode("A"), "monthly", { cumulative: { period: 7, payToDate: 0, taxToDate: 0 } }), 0);
eq("Starter B month 7 first pay 3000 (M1 basis)", P(3000, starterCode("B"), "monthly", { cumulative: { period: 7, payToDate: 0, taxToDate: 0 } }), 390.20);
eq("Starter C (BR) month 7", P(3000, starterCode("C"), "monthly", { cumulative: { period: 7, payToDate: 0, taxToDate: 0 } }), 600);

// ── 3. PAYE cumulative ─────────────────────────────────────────────────────
eq("cum m2: 6000 to date, free 2096.50 -> 3903 -> 780.60 less 390.20", P(3000, "1257L", "monthly", { cumulative: { period: 2, payToDate: 3000, taxToDate: 390.20 } }), 390.40);
eq("cum refund m3 £0 pay: 571.00 - 780.60", P(0, "1257L", "monthly", { cumulative: { period: 3, payToDate: 6000, taxToDate: 780.60 } }), -209.60);
eq("cum P45 starter m7 12000/1500 + 3000", P(3000, "1257L", "monthly", { cumulative: { period: 7, payToDate: 12000, taxToDate: 1500 } }), 32.40);
eq("cum code change m4 to 1100L (free 3669.67)", P(3000, "1100L", "monthly", { cumulative: { period: 4, payToDate: 9000, taxToDate: 1000 } }), 666.00);
eq("W1/M1 never refunds", P(0, "1257L M1", "monthly", { cumulative: { period: 3, payToDate: 6000, taxToDate: 780.60 } }), 0);
eq("cum weekly wk10: pay 500 prior 4500/tax 0 -> free 10*241.9038=2419.04, (5000-2419.04)=2580.96->2580 tax 516.00", P(500, "1257L", "weekly", { cumulative: { period: 10, payToDate: 4500, taxToDate: 0 } }), 516.00);

// ── 4. Class 1 NI ──────────────────────────────────────────────────────────
const N = (e: number, c: string, f: F | "annual" = "monthly") => niPeriod(e, c, f);
eq("NI A m 1048 (PT) ee", N(1048, "A").ee, 0);
eq("NI A m 1049 ee", N(1049, "A").ee, 0.08);
eq("NI A m 1048.13 ee rounds .0104->.01", N(1048.13, "A").ee, 0.01);
eq("NI A m 3000 ee", N(3000, "A").ee, 156.16);
eq("NI A m 3000 er", N(3000, "A").er, 387.45);
eq("NI A m 4189 ee (UEL)", N(4189, "A").ee, 251.28);
eq("NI A m 4189 er", N(4189, "A").er, 565.80);
eq("NI A m 5000 ee (2% above UEL)", N(5000, "A").ee, 267.50);
eq("NI A m 5000 er", N(5000, "A").er, 687.45);
eq("NI A m 417 er (ST)", N(417, "A").er, 0);
eq("NI A m 418 er", N(418, "A").er, 0.15);
eq("NI B m 3000 ee 1.85%", N(3000, "B").ee, 36.11);
eq("NI B m 3000 er", N(3000, "B").er, 387.45);
eq("NI C m 3000 ee nil", N(3000, "C").ee, 0);
eq("NI C m 3000 er still 15%", N(3000, "C").er, 387.45);
eq("NI J m 3000 ee 2%", N(3000, "J").ee, 39.04);
eq("NI M m 3000 ee", N(3000, "M").ee, 156.16);
eq("NI M m 3000 er 0 (under 21)", N(3000, "M").er, 0);
eq("NI M m 5000 er 15% over UST", N(5000, "M").er, 121.65);
eq("NI H m 4189 er 0 (apprentice)", N(4189, "H").er, 0);
eq("NI H m 5000 er", N(5000, "H").er, 121.65);
eq("NI Z m 3000 ee 2%", N(3000, "Z").ee, 39.04);
eq("NI Z m 3000 er 0", N(3000, "Z").er, 0);
eq("NI V m 3000 er 0 (veteran)", N(3000, "V").er, 0);
eq("NI F m 3000 er freeport UST 2083", N(3000, "F").er, 137.55);
eq("NI A w 300 ee", N(300, "A", "weekly").ee, 4.64);
eq("NI A w 300 er", N(300, "A", "weekly").er, 30.60);
eq("NI A w 967 ee", N(967, "A", "weekly").ee, 58.00);
eq("NI A w 1000 ee", N(1000, "A", "weekly").ee, 58.66);
eq("NI A fortnight 1000 ee", N(1000, "A", "fortnightly").ee, 41.28);
eq("NI A fortnight 1000 er", N(1000, "A", "fortnightly").er, 121.20);
eq("NI A 4wk 2000 ee", N(2000, "A", "fourweekly").ee, 82.56);
eq("NI A 4wk 2000 er", N(2000, "A", "fourweekly").er, 242.40);
eq("NI negative earnings", N(-500, "A").ee + N(-500, "A").er, 0);
eq("NI £0", N(0, "A").ee + N(0, "A").er, 0);
ok("NI unknown cat flagged", N(3000, "Q").known === false && N(3000, "a").known === true);
ok("NI thresholds table", niThresholds("weekly").PT === 242 && niThresholds("monthly").UEL === 4189 && niThresholds("fourweekly").PT === 968 && niThresholds("fortnightly").ST === 192);

// ── 5. Pension (auto-enrolment 5% / 3% of qualifying earnings, 6,240–50,270) ──
const QE = (g: number, f: F) => qualifyingEarnings(g, f);
eq("QE m 520 (lower)", QE(520, "monthly"), 0);
eq("QE m 3000", QE(3000, "monthly"), 2480);
eq("QE m 5000 capped at 4189", QE(5000, "monthly"), 3669);
eq("QE w 300", QE(300, "weekly"), 180);
eq("QE w 1000 capped at 967", QE(1000, "weekly"), 847);
eq("QE 4wk 2000", QE(2000, "fourweekly"), 1520);
eq("QE fortnight 2000", QE(2000, "fortnightly"), 1694);
eq("QE £0", QE(0, "monthly"), 0);

// ── 6. Student loans ───────────────────────────────────────────────────────
const S = studentLoanDeduction;
eq("SL plan2 m 3000 -> 49.61 down to 49", S(3000, "plan2", "monthly"), 49);
eq("SL plan1 m 3000 -> 68.25 down to 68", S(3000, "plan1", "monthly"), 68);
eq("SL plan5 m 3000 -> HMRC worked example £82", S(3000, "plan5", "monthly"), 82);
eq("SL plan4 m 3000 -> 16.54 down to 16", S(3000, "plan4", "monthly"), 16);
eq("SL postgrad m 3000 (6%) -> 75", S(3000, "postgrad", "monthly"), 75);
eq("SL plan2 at threshold 2448.75", S(2448.75, "plan2", "monthly"), 0);
eq("SL plan2 just over threshold", S(2448.76, "plan2", "monthly"), 0);
eq("SL plan2 £12 over -> 1.08 -> 1", S(2460.75, "plan2", "monthly"), 1);
eq("SL plan2 weekly 700 -> 12", S(700, "plan2", "weekly"), 12);
eq("SL plan2 4wk 3000 -> 66", S(3000, "plan2", "fourweekly"), 66);
eq("SL plan5 fortnight 2000 -> 93", S(2000, "plan5", "fortnightly"), 93);
eq("SL none", S(9999, "none", "monthly"), 0);
eq("SL £0", S(0, "plan1", "monthly"), 0);

// ── 7. Statutory pay ───────────────────────────────────────────────────────
eq("SSP awe 100 -> 80%", sspWeekly(100), 80);
eq("SSP awe 200 -> flat 123.25", sspWeekly(200), 123.25);
eq("SSP awe 154.06 -> 123.25", sspWeekly(154.06), 123.25);
eq("SSP awe 0", sspWeekly(0), 0);
eq("SMP wk1 awe 500 -> 90%", smpWeekly(500, 1), 450);
eq("SMP wk7 awe 500 -> flat 194.32", smpWeekly(500, 7), 194.32);
eq("SMP wk7 awe 200 -> 90% = 180", smpWeekly(200, 7), 180);
eq("SPP awe 500 -> 194.32", sppWeekly(500), 194.32);

// ── 8. tax-year period numbers ─────────────────────────────────────────────
ok("period monthly 6 Apr = 1", taxPeriodNo("2026-04-06", "monthly") === 1);
ok("period monthly 5 May = 1", taxPeriodNo("2026-05-05", "monthly") === 1);
ok("period monthly 6 May = 2", taxPeriodNo("2026-05-06", "monthly") === 2);
ok("period monthly 5 Jan = 9", taxPeriodNo("2027-01-05", "monthly") === 9);
ok("period monthly 5 Apr 2027 = 12", taxPeriodNo("2027-04-05", "monthly") === 12);
ok("period weekly 12 Apr = 1", taxPeriodNo("2026-04-12", "weekly") === 1);
ok("period weekly 13 Apr = 2", taxPeriodNo("2026-04-13", "weekly") === 2);
ok("period 4-weekly 4 May = 2", taxPeriodNo("2026-05-04", "fourweekly") === 2);
ok("period fortnight 20 Apr = 2", taxPeriodNo("2026-04-20", "fortnightly") === 2);
ok("period before 6 Apr belongs to previous year end", taxPeriodNo("2026-04-05", "monthly") === 12);

// ── 9. engine end-to-end (computeLine) ─────────────────────────────────────
const sal = (over: Partial<Emp> = {}): Emp => ({ id: "e", name: "Test Person", role: "", op: "", basis: "year", rate: 36000, hpw: 0, weeks: 52, taxCode: "1257L", niCat: "A", pension: false, ...over });
const hr = (over: Partial<Emp> = {}): Emp => ({ id: "h", name: "Hourly Person", role: "", op: "", basis: "hour", rate: 12.71, hpw: 20, weeks: 52, taxCode: "1257L", niCat: "A", pension: false, ...over });
let l = computeLine(sal());
eq("line salaried 36k gross", l.grossM, 3000); eq("line paye", l.payeM, 390.20); eq("line ee", l.eeNiM, 156.16); eq("line er", l.erNiM, 387.45); eq("line net", l.netM, 2453.64);
l = computeLine(sal({ pension: true }));
eq("line pension legacy eePen", l.eePenM, 124); eq("line pension legacy erPen", l.erPenM, 74.40); eq("line legacy paye unchanged", l.payeM, 390.20); eq("line legacy net", l.netM, 2329.64);
l = computeLine(sal({ pension: true }), { pensionScheme: "netpay" });
eq("netpay paye on 2876 (1827->365.40)", l.payeM, 365.40); eq("netpay net", l.netM, 2354.44);
l = computeLine(sal({ pension: true }), { pensionScheme: "ras" });
eq("ras eePen 4% of QE = 99.20", l.eePenM, 99.20); eq("ras paye on full gross", l.payeM, 390.20); eq("ras net = netpay net", l.netM, 2354.44);
l = computeLine(sal({ studentLoanPlan: "plan2" }));
eq("SL line deduction", l.dedM, 49); eq("SL line net", l.netM, 2404.64); ok("SL line item", l.deductions.some((d) => d.id === "__studentloan" && d.amount === 49), l.deductions);
l = computeLine(sal({ studentLoanPlan: "plan2" }), { studentLoan: false });
eq("SL switched off", l.dedM, 0);
l = computeLine(sal({ studentLoanPlan: "plan2" }), { deductions: [{ id: "adv", label: "Advance", amount: 100 }] });
eq("SL + advance both deducted", l.dedM, 149);
l = computeLine(hr(), {}, "weekly");
eq("hourly weekly gross 12.71*20", l.grossM, 254.20); eq("hourly weekly paye (12.29->12 -> 2.40)", l.payeM, 2.40); eq("hourly weekly ee .976->.98", l.eeNiM, 0.98); eq("hourly weekly er 23.73", l.erNiM, 23.73);
l = computeLine(sal(), { additions: [{ id: "n", label: "Neg adj", amount: -500 }] });
eq("negative adjustment gross", l.grossM, 2500); eq("neg adj paye taxable 1451", l.payeM, 290.20); eq("neg adj ee", l.eeNiM, 116.16);
l = computeLine(sal(), { additions: [{ id: "b", label: "Bonus", amount: 2000 }] });
eq("bonus gross", l.grossM, 5000); eq("bonus paye M1", l.payeM, 952.00); eq("bonus ee", l.eeNiM, 267.50);
l = computeLine(sal({ rate: 0 }));
eq("zero salary everything 0", l.grossM + l.payeM + l.eeNiM + l.erNiM + l.netM, 0);
l = computeLine(hr(), { hours: 40, rolledUp: true }, "weekly");
eq("rolled-up holiday base 508.40", l.basePayM, 508.40); eq("rolled-up 12.07%", l.addM, 61.36); eq("rolled-up gross", l.grossM, 569.76);
l = computeLine(sal(), { override: { paye: 100, eeNi: 50 } });
eq("override paye", l.payeM, 100); eq("override ee", l.eeNiM, 50); eq("override er unaffected", l.erNiM, 387.45);
l = computeLine(sal({ taxRegime: "scotland" }));
eq("scotland regime line", l.payeM, 392.27);
l = computeLine(sal(), { share: 0.5 });
eq("pro-rata half month gross", l.grossM, 1500); eq("pro-rata uses FULL-period NI thresholds", l.eeNiM, 36.16);
l = computeLine(sal(), { ytd: { period: 2, payToDate: 3000, taxToDate: 390.20 } });
eq("line cumulative m2", l.payeM, 390.40);
l = computeLine(sal({ niCat: "M" }));
eq("line cat M er 0", l.erNiM, 0);
l = computeLine(sal({ taxCode: "BR" }));
eq("line BR", l.payeM, 600);
l = computeLine(sal({ rate: 60000 }), {}, "monthly");
eq("60k monthly gross 5000 paye M1", l.payeM, 952.00);
// wrappers
eq("erNiAnnual A 20000", erNiAnnual(20000), 2250);
eq("eeNiAnnual A 50270", eeNiAnnual(50270), 3016);
eq("eeNiAnnual A 60000", eeNiAnnual(60000), 3016 + 194.6);

// ── 10. GOLDEN steady-pay lines: the engine's numbers are pinned (month-1 basis, no YTD, legacy pension) so a change to computeLine shows up here ──
const gold = (label: string, l: Line, want: { g: number; p: number; ee: number; er: number; pen: number; net: number }) => {
  eq(`${label} gross`, l.grossM, want.g); eq(`${label} paye`, l.payeM, want.p); eq(`${label} eeNi`, l.eeNiM, want.ee); eq(`${label} erNi`, l.erNiM, want.er); eq(`${label} eePen`, l.eePenM, want.pen); eq(`${label} net`, l.netM, want.net);
};
gold("golden 36k monthly", computeLine(sal()), { g: 3000, p: 390.20, ee: 156.16, er: 387.45, pen: 0, net: 2453.64 });
gold("golden 36k monthly pension", computeLine(sal({ pension: true })), { g: 3000, p: 390.20, ee: 156.16, er: 387.45, pen: 124, net: 2329.64 });
gold("golden 36k monthly SL2", computeLine(sal({ studentLoanPlan: "plan2" })), { g: 3000, p: 390.20, ee: 156.16, er: 387.45, pen: 0, net: 2404.64 });
gold("golden hourly weekly 12.71x20", computeLine(hr(), {}, "weekly"), { g: 254.20, p: 2.40, ee: 0.98, er: 23.73, pen: 0, net: 250.82 });
gold("golden 60k monthly", computeLine(sal({ rate: 60000 })), { g: 5000, p: 952, ee: 267.50, er: 687.45, pen: 0, net: 3780.50 });
eq("golden rolled-up hourly weekly gross", computeLine(hr(), { hours: 40, rolledUp: true }, "weekly").grossM, 569.76);
eq("computeLine without ytd is identical to explicit month-1 ytd (period 1, nothing to date)", computeLine(sal(), { ytd: { period: 1, payToDate: 0, taxToDate: 0 } }).payeM, computeLine(sal()).payeM);
eq("weekly period-1 cumulative == W1 basis", computeLine(hr(), { ytd: { period: 1, payToDate: 0, taxToDate: 0 } }, "weekly").payeM, computeLine(hr(), {}, "weekly").payeM);

// ── 11. server recalculation (checkRunLine): steady-pay lines built by the browser's own call never mismatch ──
const FREQS: F[] = ["weekly", "fortnightly", "fourweekly", "monthly"];
const bodyOf = (l: Line) => JSON.parse(JSON.stringify(l)) as Line; // what the server really receives: JSON
const variants: [string, Emp, object][] = [
  ["salaried", sal(), {}],
  ["salaried pension", sal({ pension: true }), {}],
  ["salaried SL2 + pension", sal({ studentLoanPlan: "plan2", pension: true }), {}],
  ["salaried postgrad", sal({ studentLoanPlan: "postgrad" }), {}],
  ["salaried scotland", sal({ taxRegime: "scotland" }), {}],
  ["salaried K code", sal({ taxCode: "K100" }), {}],
  ["salaried BR", sal({ taxCode: "BR" }), {}],
  ["salaried cat M", sal({ niCat: "M" }), {}],
  ["hourly contracted", hr(), {}],
  ["hourly manual hours 37.25", hr(), { hours: 37.25, hoursFrom: "manual" }],
  ["hourly timesheet 80.5h", hr({ rate: 15.5 }), { hours: 80.5, hoursFrom: "timesheet" }],
  ["hourly rolled-up", hr(), { rolledUp: true, hours: 35, hoursFrom: "manual" }],
  ["bonus + advance", sal(), { additions: [{ id: "b", label: "Bonus", amount: 750 }], deductions: [{ id: "a", label: "Advance", amount: 120.5 }] }],
  ["unpaid leave 3d", sal(), { leave: { byKind: { unpaid: 3 }, paidDays: 0, unpaidDays: 3, sickDays: 0, statutoryDays: 0, toilDays: 0 } }],
  ["sick ssp", hr(), { sickPay: "ssp", leave: { byKind: { sick: 2 }, paidDays: 0, unpaidDays: 0, sickDays: 2, statutoryDays: 0, toilDays: 0 } }],
  ["paid leave timesheet", hr(), { hours: 60, hoursFrom: "timesheet", leave: { byKind: { annual: 2 }, paidDays: 2, unpaidDays: 0, sickDays: 0, statutoryDays: 0, toilDays: 0 } }],
  ["override paye+ni", sal(), { override: { paye: 77.77, eeNi: 12.34 } }],
  ["part share 0.4", sal(), { share: 0.4 }],
];
let cleanRuns = 0, cleanTotal = 0;
for (const [name, e, o] of variants) for (const f of FREQS) {
  const l = bodyOf(computeLine(e, o as never, f)); cleanTotal++;
  const r = checkRunLine(e, l as never, f);
  if (r.mismatches.length === 0) cleanRuns++;
  ok(`no mismatch: ${name} (${f})`, r.mismatches.length === 0, r.mismatches);
}
ok("all steady-pay variants x 4 frequencies verified clean", cleanRuns === cleanTotal && cleanTotal === variants.length * 4);

// tampering: each figure changed by 2p (over the 1p tolerance) is named; 1p is tolerated
const base = bodyOf(computeLine(sal({ pension: true, studentLoanPlan: "plan2" })));
const tweak = (k: string, d: number) => ({ ...base, [k]: (base as never as Record<string, number>)[k] + d });
for (const k of ["grossM", "payeM", "eeNiM", "erNiM", "eePenM", "erPenM", "netM"]) {
  ok(`2p over on ${k} -> mismatch on ${k}`, checkRunLine(sal({ pension: true, studentLoanPlan: "plan2" }), tweak(k, 0.02) as never, "monthly").mismatches.some((m) => m.field === k));
  ok(`1p off on ${k} -> tolerated`, !checkRunLine(sal({ pension: true, studentLoanPlan: "plan2" }), tweak(k, 0.01) as never, "monthly").mismatches.some((m) => m.field === k));
}
{
  const e = sal({ pension: true, studentLoanPlan: "plan2" });
  const r = checkRunLine(e, { ...base, payeM: 0, netM: base.netM + base.payeM } as never, "monthly");
  ok("PAYE zeroed -> payeM and netM both flagged", r.mismatches.some((m) => m.field === "payeM") && r.mismatches.some((m) => m.field === "netM"));
  const m = r.mismatches.find((x) => x.field === "payeM")!;
  ok("mismatch carries employeeKey/sent/computed", m.employeeKey === "e" && m.sent === 0 && Math.abs((m.computed as number) - 390.20) < 0.006, m);
  ok("mismatch object has no name / NI field", !JSON.stringify(r.mismatches).includes("Test Person") && Object.keys(m).sort().join() === "computed,employeeKey,field,sent");
  const sl = checkRunLine(e, { ...base, deductions: [] } as never, "monthly");
  ok("student loan item stripped -> studentLoan flagged", sl.mismatches.some((x) => x.field === "studentLoan"), sl.mismatches);
  const rate = checkRunLine(e, { ...base, rate: 99999 } as never, "monthly");
  ok("rate differs from master -> flagged", rate.mismatches.some((x) => x.field === "rate"));
  ok("non-finite money flagged", checkRunLine(e, { ...base, payeM: Number.NaN } as never, "monthly").mismatches.some((x) => x.field === "payeM"));
  const nt = checkRunLine(e, { ...base, taxCode: "NT", payeM: 0 } as never, "monthly");
  ok("tax code not on master/stored adjustment -> taxCode flagged", nt.mismatches.some((x) => x.field === "taxCode" && x.sent === "NT" && x.computed === "1257L"));
  const ntOk = checkRunLine(e, bodyOf(computeLine(e, { taxCode: "BR" })) as never, "monthly", { allowedTaxCodes: ["BR"] });
  ok("tax code from the stored period adjustment is accepted", ntOk.mismatches.length === 0, ntOk.mismatches);
  const cat = checkRunLine(e, { ...base, niCat: "C" } as never, "monthly");
  ok("NI category not on master -> niCat flagged", cat.mismatches.some((x) => x.field === "niCat"));
  const holp = checkRunLine(hr(), { ...bodyOf(computeLine(hr(), { hours: 40, rolledUp: true, hoursFrom: "manual" }, "weekly")), grossM: 100 } as never, "weekly");
  ok("rolled-up line with lowered gross flagged", holp.mismatches.some((x) => x.field === "grossM"));
  const extra = checkRunLine(e, { ...base, additions: [{ id: "x", label: "Sneaky", amount: 5000 }] } as never, "monthly");
  ok("an addition not reflected in the figures -> gross flagged", extra.mismatches.some((x) => x.field === "grossM"));
  const fakeHol = checkRunLine(hr(), { ...bodyOf(computeLine(hr(), { hours: 40, hoursFrom: "manual" }, "weekly")), additions: [{ id: "__holpay", label: "h", amount: 1 }] } as never, "weekly");
  ok("a forged __holpay item is recomputed (12.07%), not trusted", fakeHol.mismatches.some((x) => x.field === "grossM"));
  const omitted = checkRunLine(e, { id: "e", grossM: 3000 } as never, "monthly");
  ok("figures the line leaves out are not compared", omitted.mismatches.length === 0, omitted.mismatches);
}
// pro-rata from dates + window
{
  const starter = sal({ startDate: "2026-10-15" });
  const win = { start: "2026-10-01", end: "2026-10-31" };
  const sh = employmentShare(starter, win.start, win.end).share;
  const good = bodyOf(computeLine(starter, { share: sh }));
  ok("starter share matches the window", checkRunLine(starter, good as never, "monthly", { window: win }).mismatches.length === 0);
  const cheat = checkRunLine(starter, bodyOf(computeLine(starter)) as never, "monthly", { window: win });
  ok("starter paid a FULL month -> proRata flagged", cheat.mismatches.some((x) => x.field === "proRata"), cheat.mismatches);
  const leaver = sal({ leaveDate: "2026-09-20" });
  const lv = checkRunLine(leaver, bodyOf(computeLine(leaver)) as never, "monthly", { window: win });
  ok("paid after leaving -> employed flagged", lv.mismatches.some((x) => x.field === "employed"));
}

// ── 12. modes: off | warn | enforce (resolveCalcMode) ──
const M = resolveCalcMode;
ok("unset -> warn (the live default)", M(undefined) === "warn" && M(null) === "warn" && M("") === "warn");
ok("off", M("off") === "off" && M("OFF") === "off" && M(" off ") === "off");
ok("enforce", M("enforce") === "enforce" && M("Enforce") === "enforce");
ok("typos never enforce", M("enforced") === "warn" && M("true") === "warn" && M("1") === "warn" && M("on") === "warn");
ok("explicit warn", M("warn") === "warn");
ok("caller may raise warn -> enforce", M(undefined, "enforce") === "enforce" && M("warn", "enforce") === "enforce");
ok("caller cannot lower enforce", M("enforce", "warn") === "enforce");
ok("caller cannot switch off", M("off", "enforce") === "off" && M(undefined, "off") === "warn");
ok("a junk request value is ignored", M(undefined, "whatever") === "warn");
{
  // the route's decision: warn never blocks, enforce blocks iff there is a mismatch, off never checks
  const decide = (mode: string, mm: number) => (mode === "off" ? "skip" : mm && mode === "enforce" ? "reject" : mm ? "store" : "untouched");
  ok("warn + mismatch -> store, run still created", decide(M(undefined), 2) === "store");
  ok("warn + clean -> untouched", decide(M(undefined), 0) === "untouched");
  ok("enforce + mismatch -> reject", decide(M("enforce"), 1) === "reject");
  ok("enforce + clean -> untouched", decide(M("enforce"), 0) === "untouched");
  ok("off -> skip", decide(M("off"), 5) === "skip");
  const msg = describeMismatches([{ employeeKey: "e", field: "payeM", sent: 0, computed: 390.2 }, ...[1, 2, 3].map((i) => ({ employeeKey: "e" + i, field: "netM", sent: 1, computed: 2 }))], (k) => (k === "e" ? "Test Person" : "Other"));
  ok("enforce message is readable: names person, field, sent, computed", /Test Person: payeM sent 0 but the server calculates 390.2/.test(msg) && /1 more/.test(msg) && /create the run again/.test(msg), msg);
}

// ── 13. year-to-date inputs (advisory cumulative PAYE) ──
{
  const y = (paidOn: string, f: F, t: { gross: number; paye: number } | null) => ytdInputsFor(paidOn, f, t);
  ok("ytd inputs: May month 2", JSON.stringify(y("2026-05-31", "monthly", { gross: 3000, paye: 390.2 })) === JSON.stringify({ period: 2, payToDate: 3000, taxToDate: 390.2 }));
  ok("ytd inputs: no record -> zero to date", JSON.stringify(y("2026-04-30", "monthly", null)) === JSON.stringify({ period: 1, payToDate: 0, taxToDate: 0 }));
  ok("ytd inputs: weekly", y("2026-04-19", "weekly", { gross: 0, paye: 0 }).period === 2);
  const steady = computeLine(sal(), { ytd: y("2026-05-31", "monthly", { gross: 3000, paye: 390.2 }) });
  eq("steady pay month 2 cumulative paye (HMRC rounding of free pay: 390.40)", steady.payeM, 390.40);
  ok("steady-pay cumulative differs from month-1 by pennies only", Math.abs(steady.payeM - computeLine(sal()).payeM) <= 0.25);
  const bonus = computeLine(sal(), { additions: [{ id: "b", label: "Bonus", amount: 2000 }], ytd: y("2026-05-31", "monthly", { gross: 3000, paye: 390.2 }) });
  eq("bonus in month 2 cumulative: pay 5000+3000 to date", bonus.payeM, 790.40);
  ok("...is LESS than the month-1 bonus estimate of 952 (why cumulative matters)", bonus.payeM < 952);
  const starter = computeLine(sal(), { ytd: y("2026-10-31", "monthly", { gross: 12000, paye: 1500 }) });
  eq("P45 starter in month 7 (12000 / 1500 to date)", starter.payeM, 32.40);
  const fresh = computeLine(sal(), { ytd: y("2026-10-31", "monthly", { gross: 0, paye: 0 }) });
  eq("mid-year starter, no P45, cumulative: month-7 catch-up allowance -> 0 tax", fresh.payeM, 0);
  // cumulative feeds the checker's computed figure but the browser's month-1 line still passes WITHOUT it (default) and is advisory-different WITH it
  const m1 = bodyOf(computeLine(sal()));
  ok("default (no ytd): month-1 line verifies clean", checkRunLine(sal(), m1 as never, "monthly").mismatches.length === 0);
  const adv = checkRunLine(sal(), m1 as never, "monthly", { ytd: y("2026-05-31", "monthly", { gross: 3000, paye: 390.2 }) });
  ok("with ytd supplied the paye differs by the free-pay rounding (advisory only)", adv.mismatches.some((x) => x.field === "payeM"));
}

console.log(`\npayrollCalcVerify: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
