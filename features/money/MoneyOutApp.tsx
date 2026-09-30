"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { get as apiGet } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { useSettings } from "@/lib/settings";
import { money } from "@/features/bookings/helpers";
import { ExpensesApp } from "@/features/money/ExpensesApp";
import { PurchasingApp } from "@/features/money/PurchasingApp";
import { SettingsLink } from "@/components/OperatorPage";
import { TourLauncher } from "@/features/common/TourLauncher";
import { useT } from "@/lib/i18n/provider";
import { rich } from "./rich";

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
  const t = useT();
  const { settings, save: saveSettings } = useSettings();
  const usePO = settings.money?.usePurchaseOrders ?? false;
  const basis = settings.money?.basis ?? "cash";

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [tab, setTab] = useState<"expenses" | "pos">("expenses");

  const refresh = useCallback(() => {
    apiGet<{ items: Expense[] }>("/api/expenses").then((p) => {
      const next = p.items ?? [];
      // useRealtime refetches on every expenses change; bail out of the state update (keep the
      // old array reference) when the payload is content-identical, so the KPI totals below
      // don't re-scan a tenant's whole expense history for nothing.
      setExpenses((prev) => {
        try { if (prev.length === next.length && JSON.stringify(prev) === JSON.stringify(next)) return prev; } catch { /* fall through */ }
        return next;
      });
    }).catch(() => {});
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

  // A tenant's expense history can span years — one pass over each relevant subset
  // (not re-filtered/re-reduced on every render) for the hero's four totals.
  const sumIn = (rows: Expense[], key: string, byYear = false) =>
    rows.filter((r) => (byYear ? (r.date ?? "").slice(0, 4) : (r.date ?? "").slice(0, 7)) === key).reduce((s, r) => s + (r.amount ?? 0), 0);
  const { outMonth, outYear, paidMonth, pendMonth } = useMemo(() => ({
    outMonth: sumIn(counted, thisMonthKey),
    outYear: sumIn(counted, thisYear, true),
    paidMonth: sumIn(expenses.filter(isPaid), thisMonthKey),
    pendMonth: sumIn(pending, thisMonthKey),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [counted, pending, expenses, thisMonthKey, thisYear]);

  const TABS = [
    { key: "expenses" as const, label: t("p8fin.exTitle"), icon: "🧾" },
    ...(usePO ? [{ key: "pos" as const, label: t("p8fin.moTabPOs"), icon: "📦" }] : []),
  ];

  const Kpi = ({ big, sub }: { big: string; sub: string }) => (
    <div className="rounded-xl bg-white/15 px-4 py-2 backdrop-blur-sm"><div className="text-[20px] font-extrabold leading-none">{big}</div><div className="mt-1 text-[10px] font-bold uppercase tracking-[0.08em] text-white/80">{sub}</div></div>
  );

  const [heroOpen, setHeroOpen] = useState(true);
  useEffect(() => { try { if (localStorage.getItem("aos.hero.money-out") === "0") setHeroOpen(false); } catch { /* ignore */ } }, []);
  const toggleHero = () => setHeroOpen((v) => { const n = !v; try { localStorage.setItem("aos.hero.money-out", n ? "1" : "0"); } catch { /* ignore */ } return n; });

  return (
    <div className="-m-5 min-h-[calc(100vh-3.5rem)] bg-[var(--bg)] p-5 text-[var(--ink)]" style={LIGHT_PALETTE}>
      <div className="relative mb-3.5 overflow-hidden rounded-2xl p-5 text-white shadow-[0_10px_30px_-12px_rgba(29,58,143,.55)]" style={{ background: "linear-gradient(120deg,#1d3a8f 0%,#3f78d8 100%)" }}>
        <div className="flex items-center gap-2 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-[17px]">💸</span>
          {t("p8fin.moTitle")}
        </div>
        <div className="mt-1.5 flex items-start justify-between gap-3">
          <p className="max-w-[560px] text-[12.5px] leading-[1.5] text-white/85">{rich(t(usePO ? "p8fin.moIntroPO" : "p8fin.moIntro"))}</p>
          <div className="flex flex-none flex-wrap items-center gap-2">
            <TourLauncher view="expenses" compact />
            <SettingsLink />
            <button type="button" onClick={toggleHero} aria-expanded={heroOpen} className="inline-flex flex-none items-center gap-1 rounded-full border border-white/20 px-2.5 py-1 text-[11px] font-semibold text-white/85 backdrop-blur-sm transition hover:text-white" style={{ background: "rgba(12,26,68,.42)" }}><span className="text-[10px] leading-none">{heroOpen ? "▾" : "▸"}</span>{heroOpen ? t("p8fin.gHide") : t("p8fin.gShow")}</button>
          </div>
        </div>
        {heroOpen && (<>
        <div className="mt-4 flex flex-wrap items-center gap-2.5">
          <Kpi big={money(outMonth)} sub={t("p8fin.moOutMonth")} />
          <Kpi big={money(outYear)} sub={t("p8fin.moOutYear", { year: thisYear })} />
          <Kpi big={money(pendingTotal)} sub={t("p8fin.moPendingToPay")} />
          <div className="ms-auto inline-flex items-center gap-1 rounded-2xl border border-white/70 bg-white/90 p-1 shadow-sm backdrop-blur-sm">
            {([["cash", t("p8fin.moCash"), t("p8fin.moCashHint")], ["accrual", t("p8fin.moAccrual"), t("p8fin.moAccrualHint")]] as const).map(([k, label, hint]) => (
              <button key={k} type="button" title={hint} onClick={() => void saveSettings({ settings: { ...settings, money: { ...(settings.money ?? {}), basis: k } } })} className="rounded-xl px-3 py-1.5 text-[11.5px] font-extrabold transition-colors" style={basis === k ? { background: "#1d3a8f", color: "#fff" } : { color: "#1d3a8f" }}>{label}</button>
            ))}
          </div>
        </div>
        <div className="mt-2 text-[11px] text-white/75">{rich(t("p8fin.moThisMonthLine", { paid: money(paidMonth), pending: money(pendMonth) }))}{basis === "cash" ? t("p8fin.moPendingNotCounted") : ""}</div>
        <div className="mt-0.5 text-[10.5px] text-white/60">
          {rich(t(basis === "cash" ? "p8fin.moCashExplain" : "p8fin.moAccrualExplain"))}
        </div>
        </>)}
      </div>

      <div className="mb-4 inline-flex flex-wrap gap-1 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-1 text-[12.5px] font-bold">
        {TABS.map((tb) => (
          <button key={tb.key} type="button" onClick={() => setTab(tb.key)} className="rounded-xl px-4 py-2 transition-colors" style={tab === tb.key ? { background: "#1d3a8f", color: "#fff" } : { color: "var(--ink-3)" }}>{tb.icon} {tb.label}</button>
        ))}
      </div>

      {tab === "expenses" ? <ExpensesApp embedded /> : <PurchasingApp embedded fixedKind="po" />}
    </div>
  );
}
