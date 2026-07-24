"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { get as apiGet } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { money } from "@/features/bookings/helpers";
import { InvoicesApp } from "@/features/money/InvoicesApp";
import { IncomeApp } from "@/features/money/IncomeApp";

const LIGHT_PALETTE = {
  "--bg": "#f5f8fd", "--surface": "#ffffff", "--panel": "#fbf8fc",
  "--ink": "#171534", "--ink-2": "#4a4763", "--ink-3": "#8a86a3", "--line": "#ece6f1",
} as CSSProperties;

interface Invoice { status?: string; amount?: number; date?: string; paidAt?: string }
interface Income { date?: string; amount?: number }
const monthKeyOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

// Money IN hub. Customer Invoices (raise, send, get paid) plus Income (cash on
// the door, grants, ad-hoc takings). Paid invoices are money-in, so the hero
// folds invoices + income into one headline; each tab keeps its own workspace.
export function MoneyInApp() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [tab, setTab] = useState<"invoices" | "income">("invoices");

  const refresh = useCallback(() => {
    apiGet<{ items: Invoice[] }>("/api/invoices").then((p) => setInvoices(p.items ?? [])).catch(() => {});
    apiGet<{ items: Income[] }>("/api/income").then((p) => setIncomes(p.items ?? [])).catch(() => {});
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useRealtime(["invoices", "income"], refresh);

  const now = useMemo(() => new Date(), []);
  const thisMonthKey = monthKeyOf(now);
  const thisYear = String(now.getFullYear());

  const paidInv = useMemo(() => invoices.filter((v) => v.status === "paid").map((v) => ({ date: (v.paidAt || v.date || "").slice(0, 10), amount: v.amount ?? 0 })), [invoices]);
  const outstanding = useMemo(() => invoices.filter((v) => v.status === "sent").reduce((s, v) => s + (v.amount ?? 0), 0), [invoices]);

  const sumIn = (rows: { date?: string; amount?: number }[], key: string, byYear = false) =>
    rows.filter((r) => (byYear ? (r.date ?? "").slice(0, 4) : (r.date ?? "").slice(0, 7)) === key).reduce((s, r) => s + (r.amount ?? 0), 0);

  const invMonth = sumIn(paidInv, thisMonthKey), incMonth = sumIn(incomes, thisMonthKey);
  const invYear = sumIn(paidInv, thisYear, true), incYear = sumIn(incomes, thisYear, true);
  const inMonth = invMonth + incMonth, inYear = invYear + incYear;

  const Kpi = ({ big, sub }: { big: string; sub: string }) => (
    <div className="rounded-xl bg-white/15 px-4 py-2 backdrop-blur-sm"><div className="text-[20px] font-extrabold leading-none">{big}</div><div className="mt-1 text-[10px] font-bold uppercase tracking-[0.08em] text-white/80">{sub}</div></div>
  );

  return (
    <div className="-m-5 min-h-[calc(100vh-3.5rem)] bg-[var(--bg)] p-5 text-[var(--ink)]" style={LIGHT_PALETTE}>
      {/* Money-in hero — Invoices + Income folded into one headline */}
      <div className="relative mb-3.5 overflow-hidden rounded-2xl p-5 text-white shadow-[0_10px_30px_-12px_rgba(15,157,88,.5)]" style={{ background: "linear-gradient(120deg,#0b7a43 0%,#22c073 60%,#ffffff 100%)" }}>
        <div className="flex items-center gap-2 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-[17px]">💰</span>
          Money in
        </div>
        <p className="mt-1.5 max-w-[560px] text-[12.5px] leading-[1.5] text-white/85">Everything your business takes in — customer <b>invoices</b> and other <b>income</b>. Paid invoices fold into your income totals below.</p>
        <div className="mt-4 flex flex-wrap items-center gap-2.5">
          <Kpi big={money(inMonth)} sub="In this month" />
          <Kpi big={money(inYear)} sub={`In in ${thisYear}`} />
          <Kpi big={money(outstanding)} sub="Awaiting payment" />
        </div>
        <div className="mt-2 text-[11px] text-white/75">This month: <b className="text-white">{money(invMonth)}</b> from invoices + <b className="text-white">{money(incMonth)}</b> other income</div>
      </div>

      {/* Sub-area tabs */}
      <div className="mb-4 inline-flex flex-wrap gap-1 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-1 text-[12.5px] font-bold">
        {([["invoices", "📄 Invoices"], ["income", "💰 Income"]] as const).map(([k, label]) => (
          <button key={k} type="button" onClick={() => setTab(k)} className="rounded-xl px-4 py-2 transition-colors" style={tab === k ? { background: "#0f9d58", color: "#fff" } : { color: "var(--ink-3)" }}>{label}</button>
        ))}
      </div>

      {tab === "invoices" ? <InvoicesApp embedded /> : <IncomeApp embedded />}
    </div>
  );
}
