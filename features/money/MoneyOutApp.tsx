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

interface Expense { date?: string; amount?: number }
interface PO { kind?: "bill" | "po"; status?: string; date?: string; amount?: number }
const OUTSTANDING = new Set(["sent", "received"]);
const monthKeyOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

// Money OUT hub. One place for everything the business pays: direct Expenses,
// supplier Bills, and Purchase orders. The hero folds Expenses + Bills into a
// single money-out headline (cash vs accrual decides when a bill counts), while
// each tab keeps its own full workspace.
export function MoneyOutApp() {
  const { settings, save: saveSettings } = useSettings();
  const usePO = settings.money?.usePurchaseOrders ?? false;
  const basis = settings.money?.basis ?? "cash";

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [pos, setPos] = useState<PO[]>([]);
  const [tab, setTab] = useState<"expenses" | "bills" | "pos">("expenses");

  const refresh = useCallback(() => {
    apiGet<{ items: Expense[] }>("/api/expenses").then((p) => setExpenses(p.items ?? [])).catch(() => {});
    apiGet<{ items: PO[] }>("/api/purchasing").then((p) => setPos(p.items ?? [])).catch(() => {});
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useRealtime(["expenses", "purchaseOrders"], refresh);

  const now = useMemo(() => new Date(), []);
  const thisMonthKey = monthKeyOf(now);
  const thisYear = String(now.getFullYear());

  const bills = useMemo(() => pos.filter((p) => (p.kind ?? "bill") === "bill"), [pos]);
  // A bill counts as spend when: cash → it's paid; accrual → it's not cancelled.
  const billSpend = useMemo(() => bills.filter((b) => (basis === "cash" ? b.status === "paid" : b.status !== "cancelled")), [bills, basis]);
  const outstanding = useMemo(() => bills.filter((b) => OUTSTANDING.has(b.status ?? "")).reduce((s, b) => s + (b.amount ?? 0), 0), [bills]);

  const sumIn = (rows: { date?: string; amount?: number }[], key: string, byYear = false) =>
    rows.filter((r) => (byYear ? (r.date ?? "").slice(0, 4) : (r.date ?? "").slice(0, 7)) === key).reduce((s, r) => s + (r.amount ?? 0), 0);

  const expMonth = sumIn(expenses, thisMonthKey), billMonth = sumIn(billSpend, thisMonthKey);
  const expYear = sumIn(expenses, thisYear, true), billYear = sumIn(billSpend, thisYear, true);
  const outMonth = expMonth + billMonth, outYear = expYear + billYear;

  const TABS = [
    { key: "expenses" as const, label: "Expenses", icon: "🧾" },
    { key: "bills" as const, label: "Bills", icon: "📑" },
    ...(usePO ? [{ key: "pos" as const, label: "Purchase orders", icon: "📦" }] : []),
  ];

  const Kpi = ({ big, sub }: { big: string; sub: string }) => (
    <div className="rounded-xl bg-white/15 px-4 py-2 backdrop-blur-sm"><div className="text-[20px] font-extrabold leading-none">{big}</div><div className="mt-1 text-[10px] font-bold uppercase tracking-[0.08em] text-white/80">{sub}</div></div>
  );

  return (
    <div className="-m-5 min-h-[calc(100vh-3.5rem)] bg-[var(--bg)] p-5 text-[var(--ink)]" style={LIGHT_PALETTE}>
      {/* Money-out hero — Expenses + Bills folded into one headline */}
      <div className="relative mb-3.5 overflow-hidden rounded-2xl p-5 text-white shadow-[0_10px_30px_-12px_rgba(29,58,143,.55)]" style={{ background: "linear-gradient(120deg,#1d3a8f 0%,#3f78d8 62%,#ffffff 100%)" }}>
        <div className="flex items-center gap-2 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-[17px]">💸</span>
          Money out
        </div>
        <p className="mt-1.5 max-w-[560px] text-[12.5px] leading-[1.5] text-white/85">Everything your business pays — direct <b>expenses</b>, supplier <b>bills</b>{usePO ? " and purchase orders" : ""}. Bills fold into your spend totals below.</p>
        <div className="mt-4 flex flex-wrap items-center gap-2.5">
          <Kpi big={money(outMonth)} sub="Out this month" />
          <Kpi big={money(outYear)} sub={`Out in ${thisYear}`} />
          <Kpi big={money(outstanding)} sub="Bills outstanding" />
          {/* Cash / accrual basis — decides when a bill counts as spend */}
          <div className="ml-auto flex items-center gap-1 rounded-2xl bg-white/15 p-1 backdrop-blur-sm">
            {([["cash", "Cash", "counts when paid"], ["accrual", "Accrual", "counts when billed"]] as const).map(([k, label, hint]) => (
              <button key={k} type="button" title={hint} onClick={() => void saveSettings({ settings: { ...settings, money: { ...(settings.money ?? {}), basis: k } } })} className="rounded-xl px-3 py-1.5 text-[11.5px] font-extrabold transition-colors" style={basis === k ? { background: "#fff", color: "#1d3a8f" } : { color: "#fff" }}>{label}</button>
            ))}
          </div>
        </div>
        <div className="mt-2 text-[11px] text-white/75">This month: <b className="text-white">{money(expMonth)}</b> expenses + <b className="text-white">{money(billMonth)}</b> bills{basis === "cash" ? " (paid)" : " (billed)"}</div>
      </div>

      {/* Sub-area tabs */}
      <div className="mb-4 inline-flex flex-wrap gap-1 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-1 text-[12.5px] font-bold">
        {TABS.map((t) => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)} className="rounded-xl px-4 py-2 transition-colors" style={tab === t.key ? { background: "#1d3a8f", color: "#fff" } : { color: "var(--ink-3)" }}>{t.icon} {t.label}</button>
        ))}
      </div>

      {tab === "expenses" ? <ExpensesApp embedded /> : tab === "bills" ? <PurchasingApp embedded fixedKind="bill" /> : <PurchasingApp embedded fixedKind="po" />}
    </div>
  );
}
