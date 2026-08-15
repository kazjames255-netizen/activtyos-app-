"use client";

// Staff-facing payslips — each staff member's own pay history. Reads the demo
// pay-run store the operator Payroll view writes; filters to the logged-in
// person and opens the same branded (estimated) payslip. In production this is
// scoped server-side so a person can only ever see their own, from RTI-backed
// figures, retained 3 years past tax-year end (see docs/payroll-integrations-handoff.md).
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui";
import { LIGHT_PALETTE, PageHero } from "@/components/OperatorPage";
import { useSettings } from "@/lib/settings";
import { openPayslip, PAYROLL_RUNS_KEY, type PayRun, type Line } from "./PayrollApp";

// demo "me" — matches the Staff certificates / documents areas
const ME = "Marcus Bell";

const gbp = (n: number) => "£" + (n || 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function StaffPayslipsApp() {
  const { settings } = useSettings();
  const provider = settings.providerName || settings.billing?.businessName || "Your employer";
  const [runs, setRuns] = useState<PayRun[]>([]);
  useEffect(() => {
    try { const r = JSON.parse(localStorage.getItem(PAYROLL_RUNS_KEY) || "null"); if (Array.isArray(r)) setRuns(r); } catch { /* ignore */ }
  }, []);

  // one payslip per run that includes me, newest first
  const mine = useMemo(() => runs
    .map((r) => ({ run: r, line: r.lines.find((l) => l.id === ME || l.name === ME) }))
    .filter((x): x is { run: PayRun; line: Line } => !!x.line)
    .sort((a, b) => (a.run.paidOn < b.run.paidOn ? 1 : -1)), [runs]);

  const ytd = (k: keyof Line) => mine.reduce((a, x) => a + (typeof x.line[k] === "number" ? (x.line[k] as number) : 0), 0);

  return (
    <div className="-m-3 min-h-[calc(100vh-3.5rem)] p-3 sm:-m-5 sm:p-5" style={LIGHT_PALETTE}>
      <PageHero title="My payslips" icon="🧾" lede="Your pay history — open or print any payslip. These are estimated previews until your employer's payroll provider issues the statutory version." />

      {/* year-to-date summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Payslips", String(mine.length), "this tax year"],
          ["Gross · YTD", gbp(ytd("grossM")), "before deductions"],
          ["Take-home · YTD", gbp(ytd("netM")), "paid to you"],
          ["Deductions · YTD", gbp(ytd("payeM") + ytd("eeNiM") + ytd("eePenM")), "tax · NI · pension"],
        ].map(([label, value, sub]) => (
          <div key={label} className="rounded-2xl border border-[var(--line)] bg-white p-4">
            <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--ink-3)]">{label}</div>
            <div className="mt-1 text-[22px] font-extrabold tabular-nums text-[var(--ink)]" style={{ fontFamily: "var(--ff-display)" }}>{value}</div>
            <div className="mt-0.5 text-[11px] text-[var(--ink-3)]">{sub}</div>
          </div>
        ))}
      </div>

      <Card className="mt-4 p-0">
        {mine.length === 0 ? (
          <div className="p-10 text-center text-[13px] text-[var(--ink-3)]">
            No payslips yet. They appear here after your employer approves a pay run.
          </div>
        ) : (
          <div className="divide-y divide-[var(--line)]">
            {mine.map(({ run, line }) => (
              <button
                key={run.id}
                type="button"
                onClick={() => openPayslip(line, run.period, run.paidOn, provider, runs)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[#f6f8fd]"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#eef4fd] text-[15px]">🧾</span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-bold text-[var(--ink)]">{run.period}</span>
                  <span className="block text-[11.5px] text-[var(--ink-3)]">
                    Paid {new Date(run.paidOn).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} · {line.basis === "hour" ? `${line.hoursM} hrs @ £${line.rate.toFixed(2)}` : "Salary"}
                  </span>
                </span>
                <span className="ml-auto text-right">
                  <span className="block text-[13px] font-extrabold tabular-nums text-[#0f7a43]">{gbp(line.netM)}</span>
                  <span className="block text-[11px] text-[var(--ink-3)]">net · view →</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </Card>

      <p className="mt-3 text-[11px] leading-relaxed text-[var(--ink-3)]">
        ⚠ These are <b>estimated</b> payslips for reference. PAYE, National Insurance and pension are computed on simplified UK 2026/27 bands. Your statutory itemised pay statement — the legal record — is issued by your employer's payroll provider and may differ (student loans, statutory pay, Scottish/Welsh tax etc.).
      </p>
    </div>
  );
}

export default StaffPayslipsApp;
