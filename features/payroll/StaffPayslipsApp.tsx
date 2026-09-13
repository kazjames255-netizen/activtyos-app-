"use client";

// Staff-facing payslips — each staff member's own pay history, opening the
// same branded (estimated) payslip the operator Payroll view makes. From the
// server (GET /api/payroll/mine): the runs the employer has PUBLISHED, each
// carrying only this person's own line. It used to read the pay-run store in
// the MANAGER's browser, so on a staff member's own phone it was always blank
// (acceptance d24s1) — and on a shared laptop it would have been someone
// else's pay. Nothing published yet = an honest empty state. The demo still
// reads the demo store, filtered to the demo person. Statutory (RTI-backed)
// payslips are the payroll provider's — docs/payroll-integrations-handoff.md.
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui";
import { CollapsibleStats, LIGHT_PALETTE, PageHero } from "@/components/OperatorPage";
import { useSettings } from "@/lib/settings";
import { openPayslip, PAYROLL_RUNS_KEY, type PayRun, type Line } from "./PayrollApp";
import { useI18n } from "@/lib/i18n/provider";
import { get as apiGet, isDemoMode } from "@/lib/api";

const rich = (s: string) => s.split("**").map((p, i) => (i % 2 ? <b key={i}>{p}</b> : p));

// demo "me" — matches the Staff certificates / documents areas
const ME = "Marcus Bell";

const gbp = (n: number) => "£" + (n || 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function StaffPayslipsApp() {
  const { t, locale: appLocale } = useI18n();
  const locale = appLocale === "en" ? "en-GB" : appLocale; // for dates — plain "en" formats US-style
  const { settings } = useSettings();
  const provider = settings.providerName || settings.billing?.businessName || "Your employer";
  const [runs, setRuns] = useState<PayRun[]>([]);
  const [loadErr, setLoadErr] = useState(false);
  const demo = isDemoMode();
  useEffect(() => {
    if (!demo) { apiGet<PayRun[]>("/api/payroll/mine").then((r) => setRuns(Array.isArray(r) ? r : [])).catch(() => setLoadErr(true)); return; }
    try { const r = JSON.parse(localStorage.getItem(PAYROLL_RUNS_KEY) || "null"); if (Array.isArray(r)) setRuns(r); } catch { /* ignore */ }
  }, [demo]);

  // one payslip per run that includes me, newest first (the server's runs carry only my line)
  const mine = useMemo(() => runs
    .map((r) => ({ run: r, line: demo ? r.lines.find((l) => l.id === ME || l.name === ME) : r.lines[0] }))
    .filter((x): x is { run: PayRun; line: Line } => !!x.line)
    .sort((a, b) => (a.run.paidOn < b.run.paidOn ? 1 : -1)), [runs, demo]);

  const ytd = (k: keyof Line) => mine.reduce((a, x) => a + (typeof x.line[k] === "number" ? (x.line[k] as number) : 0), 0);

  return (
    <div className="-m-3 min-h-[calc(100vh-3.5rem)] p-3 sm:-m-5 sm:p-5" style={LIGHT_PALETTE}>
      <PageHero title={t("staffp.payTitle")} icon="🧾" lede={t("staffp.payLede")} />

      {/* year-to-date summary */}
      {loadErr && <Card className="mb-3 border-l-4 border-l-[#c0392b] p-3 text-[12.5px] font-semibold text-[#c0392b]">⚠ Couldn&rsquo;t load your payslips — check your connection and reopen this page.</Card>}
      {mine.length > 0 && <CollapsibleStats id="payslips">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          [t("staffp.payStatPayslips"), String(mine.length), t("staffp.payThisYear")],
          [t("staffp.payGross"), gbp(ytd("grossM")), t("staffp.payBefore")],
          [t("staffp.payTakeHome"), gbp(ytd("netM")), t("staffp.payPaidToYou")],
          [t("staffp.payDeductions"), gbp(ytd("payeM") + ytd("eeNiM") + ytd("eePenM")), t("staffp.payDedSub")],
        ].map(([label, value, sub]) => (
          <div key={label} className="rounded-2xl border border-[var(--line)] bg-white p-4">
            <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--ink-3)]">{label}</div>
            <div className="mt-1 text-[22px] font-extrabold tabular-nums text-[var(--ink)]" style={{ fontFamily: "var(--ff-display)" }}>{value}</div>
            <div className="mt-0.5 text-[11px] text-[var(--ink-3)]">{sub}</div>
          </div>
        ))}
      </div>
      </CollapsibleStats>}

      <Card className="mt-4 p-0">
        {mine.length === 0 ? (
          <div className="p-10 text-center text-[13px] text-[var(--ink-3)]">
            {t("staffp.payNone")}
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
                    {t("staffp.payPaid", { date: new Date(run.paidOn).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" }) })} · {line.basis === "hour" ? t("staffp.payHoursAt", { h: line.hoursM, rate: line.rate.toFixed(2) }) : t("staffp.paySalary")}
                  </span>
                </span>
                <span className="ml-auto text-right">
                  <span className="block text-[13px] font-extrabold tabular-nums text-[#0f7a43]">{gbp(line.netM)}</span>
                  <span className="block text-[11px] text-[var(--ink-3)]">{t("staffp.payNetView")}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </Card>

      {mine.length > 0 && <p className="mt-3 text-[11px] leading-relaxed text-[var(--ink-3)]">
        {rich(t("staffp.payDisclaimer"))}
      </p>}
    </div>
  );
}

export default StaffPayslipsApp;
