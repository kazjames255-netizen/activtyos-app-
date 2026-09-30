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
import { computeLine, payeAnnual, eeNiAnnual, erNiAnnual, type Emp } from "../../features/payroll/payCalc";

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

console.log(`\npayrollCalcVerify: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
