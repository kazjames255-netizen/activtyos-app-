// Run: server/node_modules/.bin/tsx server/src/lib/payslipPdf.selftest.ts
// Tax-year boundary: 6 April starts the new year (1-5 April belong to the previous one) and must agree with payrollYtd.ukTaxYearOf.
import { taxYearFor } from "./payslipPdf";
let n = 0, bad = 0;
const ok = (c: boolean, m: string) => { n++; if (!c) { bad++; console.error("FAIL:", m); } };
const cases: Array<[string, string]> = [["2026-04-05", "2025/26"], ["2026-04-06", "2026/27"], ["2026-04-01", "2025/26"], ["2026-03-31", "2025/26"], ["2026-09-30", "2026/27"], ["2027-01-15", "2026/27"], ["2026-12-31", "2026/27"]];
for (const [d, want] of cases) ok(taxYearFor(d).label === want, `${d} -> ${want}, got ${taxYearFor(d).label}`);
ok(taxYearFor("2026-04-03").fromDate === "2025-04-06" && taxYearFor("2026-04-03").endDate === "2026-04-05", "range for 3 Apr 2026");
console.log(`payslipPdf selftest: ${n - bad}/${n} passed`); process.exit(bad ? 1 : 0);
