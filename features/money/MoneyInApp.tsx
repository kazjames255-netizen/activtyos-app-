"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { get as apiGet } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { money } from "@/features/bookings/helpers";
import { bookingNetIn } from "@/features/money/bookingIncome";
import type { Booking as FullBooking } from "@/features/bookings/types";
import { InvoicesApp } from "@/features/money/InvoicesApp";
import { IncomeApp } from "@/features/money/IncomeApp";
import { SettingsLink } from "@/components/OperatorPage";
import { TourLauncher } from "@/features/common/TourLauncher";
import { useT } from "@/lib/i18n/provider";
import { rich } from "./rich";

const LIGHT_PALETTE = {
  "--bg": "#f5f8fd", "--surface": "#ffffff", "--panel": "#fbf8fc",
  "--ink": "#171534", "--ink-2": "#4a4763", "--ink-3": "#8a86a3", "--line": "#ece6f1",
} as CSSProperties;

interface Invoice { status?: string; amount?: number; date?: string; paidAt?: string }
interface Income { date?: string; amount?: number }
interface Booking { pay?: string; amount?: number; amountPaid?: number; createdAt?: string; refundLog?: unknown; cancel?: unknown }
const monthKeyOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const sameLen = (a: unknown[], b: unknown[]) => { try { return a.length === b.length && JSON.stringify(a) === JSON.stringify(b); } catch { return false; } };

// Money IN hub. Customer Invoices (raise, send, get paid) plus Income (cash on
// the door, grants, ad-hoc takings). Paid invoices are money-in, so the hero
// folds invoices + income into one headline; each tab keeps its own workspace.
export function MoneyInApp() {
  const t = useT();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [tab, setTab] = useState<"invoices" | "income">("income");

  // useRealtime refetches all three on every invoices/income/bookings change; bail out of each
  // state update (keep the old array reference) when the payload is content-identical to what's
  // loaded, so the KPI totals below don't re-scan a tenant's whole history for nothing.
  const refresh = useCallback(() => {
    apiGet<{ items: Invoice[] }>("/api/invoices").then((p) => setInvoices((prev) => sameLen(prev, p.items ?? []) ? prev : (p.items ?? []))).catch(() => {});
    apiGet<{ items: Income[] }>("/api/income").then((p) => setIncomes((prev) => sameLen(prev, p.items ?? []) ? prev : (p.items ?? []))).catch(() => {});
    apiGet<Booking[]>("/api/bookings").then((b) => setBookings((prev) => sameLen(prev, Array.isArray(b) ? b : []) ? prev : (Array.isArray(b) ? b : []))).catch(() => {});
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useRealtime(["invoices", "income", "bookings"], refresh);

  const now = useMemo(() => new Date(), []);
  const thisMonthKey = monthKeyOf(now);
  const thisYear = String(now.getFullYear());

  const paidInv = useMemo(() => invoices.filter((v) => v.status === "paid").map((v) => ({ date: (v.paidAt || v.date || "").slice(0, 10), amount: v.amount ?? 0 })), [invoices]);
  const outstanding = useMemo(() => invoices.filter((v) => v.status === "sent").reduce((s, v) => s + (v.amount ?? 0), 0), [invoices]);
  // Booking money, dated by when the booking was taken. Same rule as the Dashboard's "Income
  // collected" and the Income tab: NET of refunds (received - refunded); `back` is the refunded part.
  const bookingIn = useMemo(() => bookings.map((b) => {
    const { got, back, net } = bookingNetIn(b as unknown as FullBooking);
    return { date: (b.createdAt || "").slice(0, 10), amount: net, got, back };
  }).filter((r) => r.got > 0), [bookings]);

  const sumIn = (rows: { date?: string; amount?: number }[], key: string, byYear = false) =>
    rows.filter((r) => (byYear ? (r.date ?? "").slice(0, 4) : (r.date ?? "").slice(0, 7)) === key).reduce((s, r) => s + (r.amount ?? 0), 0);

  // `bookingIn` especially can span years of history — one pass per subset for the hero's
  // totals, not re-filtered/re-reduced six times on every render.
  const { invMonth, incMonth, bkMonth, invYear, incYear, bkYear, refMonth, refYear, inMonth, inYear } = useMemo(() => {
    const invMonth = sumIn(paidInv, thisMonthKey), incMonth = sumIn(incomes, thisMonthKey), bkMonth = sumIn(bookingIn, thisMonthKey);
    const invYear = sumIn(paidInv, thisYear, true), incYear = sumIn(incomes, thisYear, true), bkYear = sumIn(bookingIn, thisYear, true);
    const sumBack = (key: string, byYear: boolean) => bookingIn.filter((r) => (byYear ? r.date.slice(0, 4) : r.date.slice(0, 7)) === key).reduce((n, r) => n + r.back, 0);
    const refMonth = sumBack(thisMonthKey, false), refYear = sumBack(thisYear, true);
    return { invMonth, incMonth, bkMonth, invYear, incYear, bkYear, refMonth, refYear, inMonth: invMonth + incMonth + bkMonth, inYear: invYear + incYear + bkYear };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paidInv, incomes, bookingIn, thisMonthKey, thisYear]);

  const Kpi = ({ big, sub, note }: { big: string; sub: string; note?: string }) => (
    <div className="rounded-xl bg-white/15 px-4 py-2 backdrop-blur-sm"><div className="text-[20px] font-extrabold leading-none">{big}</div><div className="mt-1 text-[10px] font-bold uppercase tracking-[0.08em] text-white/80">{sub}</div>{note && <div className="mt-0.5 text-[10px] text-white/70">{note}</div>}</div>
  );

  const [heroOpen, setHeroOpen] = useState(true);
  useEffect(() => { try { if (localStorage.getItem("aos.hero.money-in") === "0") setHeroOpen(false); } catch { /* ignore */ } }, []);
  const toggleHero = () => setHeroOpen((v) => { const n = !v; try { localStorage.setItem("aos.hero.money-in", n ? "1" : "0"); } catch { /* ignore */ } return n; });

  return (
    <div className="-m-3 min-h-[calc(100vh-3.5rem)] bg-[var(--bg)] p-3 sm:-m-5 sm:p-5 text-[var(--ink)]" style={LIGHT_PALETTE}>
      {/* Money-in hero — Invoices + Income folded into one headline */}
      <div className="relative mb-3.5 overflow-hidden rounded-2xl p-5 text-white shadow-[0_10px_30px_-12px_rgba(29,58,143,.55)]" style={{ backgroundImage: `radial-gradient(rgba(255,255,255,0.10) 1px, transparent 1.6px), linear-gradient(120deg,#16306e 0%,#3f78d8 100%)`, backgroundSize: "18px 18px, cover, cover, cover, cover", backgroundRepeat: "repeat, no-repeat, no-repeat, no-repeat, no-repeat" }}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-[17px]">💰</span>
            {t("p8fin.miTitle")}
          </div>
          {/* In/out sub-view switch, on the hero */}
          <div className="flex flex-none flex-wrap items-center gap-2">
            <TourLauncher view="purchasing" compact />
            <SettingsLink />
            <div className="inline-flex flex-none gap-1 rounded-2xl border border-white/70 bg-white/90 p-1 shadow-sm backdrop-blur-sm">
              {([["income", t("p8fin.miTabIncome")], ["invoices", t("p8fin.miTabInvoices")]] as const).map(([k, label]) => (
                <button key={k} type="button" onClick={() => setTab(k)} className="rounded-xl px-4 py-2 text-[12.5px] font-bold transition-colors" style={tab === k ? { background: "#1d3a8f", color: "#fff" } : { color: "#1d3a8f" }}>{label}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-1.5 flex items-start justify-between gap-3">
          <p className="max-w-[560px] text-[12.5px] leading-[1.5] text-white/85">{rich(t("p8fin.miIntro"))}</p>
          <button type="button" onClick={toggleHero} aria-expanded={heroOpen} className="inline-flex flex-none items-center gap-1 rounded-full border border-white/20 px-2.5 py-1 text-[11px] font-semibold text-white/85 backdrop-blur-sm transition hover:text-white" style={{ background: "rgba(12,26,68,.42)" }}><span className="text-[10px] leading-none">{heroOpen ? "▾" : "▸"}</span>{heroOpen ? t("p8fin.gHide") : t("p8fin.gShow")}</button>
        </div>
        {heroOpen && (<>
        <div className="mt-4 flex flex-wrap items-center gap-2.5">
          <Kpi big={money(inMonth)} sub={t("p8fin.miInMonth")} note={t("p8fin.miNetNote", { got: money(inMonth + refMonth), ref: money(refMonth) })} />
          <Kpi big={money(inYear)} sub={t("p8fin.miInYear", { year: thisYear })} note={t("p8fin.miNetNote", { got: money(inYear + refYear), ref: money(refYear) })} />
          <Kpi big={money(outstanding)} sub={t("p8fin.miAwaiting")} />
        </div>
        <div className="mt-2 text-[11px] text-white/75">{rich(t("p8fin.miReceivedLine", { bk: money(bkMonth), inv: money(invMonth), inc: money(incMonth) }))}</div>
        <div className="mt-0.5 text-[10.5px] text-white/60">{rich(t("p8fin.miAwaitingNote"))}</div>
        </>)}
      </div>

      {tab === "invoices" ? <InvoicesApp embedded /> : <IncomeApp embedded />}
    </div>
  );
}
