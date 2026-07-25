"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { get as apiGet } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { useSettings } from "@/lib/settings";
import { money } from "@/features/bookings/helpers";
import { ExpensesApp } from "@/features/money/ExpensesApp";
import { PurchasingApp } from "@/features/money/PurchasingApp";

const LIGHT_PALETTE = {
  "--bg": "#f5f8fd", "--surface": "#ffffff", "--panel": "#fbf8fc",
  "--ink": "#171534", "--ink-2": "#4a4763", "--ink-3": "#8a86a3", "--line": "#ece6f1",
} as CSSProperties;

interface Expense { date?: string; amount?: number; status?: "pending" | "paid" }
const monthKeyOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

// Money OUT hub. One "Expenses" area where every expense is Pending (money you
// owe — what a bill was) or Paid, filtered by status in the Expenses screen.
// Purchase orders keep their own tab when enabled in Setup. The hero folds the
// expenses into a money-out headline; cash vs accrual decides whether pending
// counts yet.
export function MoneyOutApp() {
  const { settings, save: saveSettings } = useSettings();
  const usePO = settings.money?.usePurchaseOrders ?? false;
  const basis = settings.money?.basis ?? "cash";

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [tab, setTab] = useState<"expenses" | "pos">("expenses");

  const refresh = useCallback(() => {
    apiGet<{ items: Expense[] }>("/api/expenses").then((p) => setExpenses(p.items ?? [])).catch(() => {});
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useRealtime(["expenses"], refresh);

  const now = useMemo(() => new Date(), []);
  const thisMonthKey = monthKeyOf(now);
  const thisYear = String(now.getFullYear());
  const isPaid = (e: Expense) => (e.status ?? "paid") === "paid";

  // Cash counts an expense once it's paid; accrual counts it as soon as it's
  // logged (pending or paid). Pending is the money-owed pile.
  const counted = useMemo(() => (basis === "cash" ? expenses.filter(isPaid) : expenses), [expenses, basis]);
  const pending = useMemo(() => expenses.filter((e) => !isPaid(e)), [expenses]);
  const pendingTotal = pending.reduce((s, e) => s + (e.amount ?? 0), 0);

  const sumIn = (rows: Expense[], key: string, byYear = false) =>
    rows.filter((r) => (byYear ? (r.date ?? "").slice(0, 4) : (r.date ?? "").slice(0, 7)) === key).reduce((s, r) => s + (r.amount ?? 0), 0);
  const outMonth = sumIn(counted, thisMonthKey);
  const outYear = sumIn(counted, thisYear, true);
  const paidMonth = sumIn(expenses.filter(isPaid), thisMonthKey);
  const pendMonth = sumIn(pending, thisMonthKey);

  const TABS = [
    { key: "expenses" as const, label: "Expenses", icon: "🧾" },
    ...(usePO ? [{ key: "pos" as const, label: "Purchase orders", icon: "📦" }] : []),
  ];

  const Kpi = ({ big, sub }: { big: string; sub: string }) => (
    <div className="rounded-xl bg-white/15 px-4 py-2 backdrop-blur-sm"><div className="text-[20px] font-extrabold leading-none">{big}</div><div className="mt-1 text-[10px] font-bold uppercase tracking-[0.08em] text-white/80">{sub}</div></div>
  );

  return (
    <div className="-m-5 min-h-[calc(100vh-3.5rem)] bg-[var(--bg)] p-5 text-[var(--ink)]" style={LIGHT_PALETTE}>
      <div className="relative mb-3.5 overflow-hidden rounded-2xl p-5 text-white shadow-[0_10px_30px_-12px_rgba(29,58,143,.55)]" style={{ background: "linear-gradient(120deg,#1d3a8f 0%,#3f78d8 62%,#ffffff 100%)" }}>
        <div className="flex items-center gap-2 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-[17px]">💸</span>
          Money out
        </div>
        <p className="mt-1.5 max-w-[560px] text-[12.5px] leading-[1.5] text-white/85">Everything your business spends — logged as <b>expenses</b>, each one <b>Pending</b> (owed) or <b>Paid</b>{usePO ? ", plus purchase orders" : ""}.</p>
        <div className="mt-4 flex flex-wrap items-center gap-2.5">
          <Kpi big={money(outMonth)} sub="Out this month" />
          <Kpi big={money(outYear)} sub={`Out in ${thisYear}`} />
          <Kpi big={money(pendingTotal)} sub="Pending to pay" />
          <div className="ml-auto inline-flex items-center gap-1 rounded-2xl border border-white/70 bg-white/90 p-1 shadow-sm backdrop-blur-sm">
            {([["cash", "Cash", "counts when paid"], ["accrual", "Accrual", "counts when logged"]] as const).map(([k, label, hint]) => (
              <button key={k} type="button" title={hint} onClick={() => void saveSettings({ settings: { ...settings, money: { ...(settings.money ?? {}), basis: k } } })} className="rounded-xl px-3 py-1.5 text-[11.5px] font-extrabold transition-colors" style={basis === k ? { background: "#1d3a8f", color: "#fff" } : { color: "#1d3a8f" }}>{label}</button>
            ))}
          </div>
        </div>
        <div className="mt-2 text-[11px] text-white/75">This month: <b className="text-white">{money(paidMonth)}</b> paid + <b className="text-white">{money(pendMonth)}</b> pending{basis === "cash" ? " (pending not counted above until paid)" : ""}</div>
        <div className="mt-0.5 text-[10.5px] text-white/60">
          {basis === "cash"
            ? <><b className="text-white/80">Cash basis:</b> an expense counts as spend the day you mark it <b className="text-white/80">Paid</b> — money you owe (Pending) isn’t in the totals yet.</>
            : <><b className="text-white/80">Accrual basis:</b> an expense counts as spend the day it’s <b className="text-white/80">logged</b> — Pending and Paid both count, so committed money shows straight away.</>}
        </div>
      </div>

      <div className="mb-4 inline-flex flex-wrap gap-1 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-1 text-[12.5px] font-bold">
        {TABS.map((t) => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)} className="rounded-xl px-4 py-2 transition-colors" style={tab === t.key ? { background: "#1d3a8f", color: "#fff" } : { color: "var(--ink-3)" }}>{t.icon} {t.label}</button>
        ))}
      </div>

      {tab === "expenses" ? <ExpensesApp embedded /> : <PurchasingApp embedded fixedKind="po" />}
    </div>
  );
}
