"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { get as apiGet, post as apiPost } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { collectedNet, refundedGross, owedOf } from "@/features/bookings/helpers";
import type { Booking } from "@/features/bookings/types";
import { LIGHT_PALETTE, PageHero, TabStrip } from "@/components/OperatorPage";
import {
  GRAD, ACT_C, money, compactMoney, colorFor,
  Tile, Ring, Donut, Breakdown, Panel, Legend, Empty, Info, TrendChart,
} from "./finance-kit";

// ── Types for the extra ledgers we fold in (subset of each route's shape) ──
interface Invoice { id: string; customerName: string; amount: number; date: string; dueDate?: string; status: string; overdue?: boolean }
interface InvPayload { items: Invoice[]; summary: { count: number; outstanding: number; collected: number; overdue: number } }
interface PaymentRecord { id: string; refs?: string[]; email?: string; amount: number; type?: string; status: string; createdAt: string }
interface PayStatus { connected: boolean; payoutsEnabled?: boolean; chargesEnabled?: boolean; detailsSubmitted?: boolean }

const BLUE = "#1d3a8f", LIGHTB = "#3f78d8", GREEN = "#0f7a43", GOLD = "#f0b100", PINK = "#e2225f";
const mKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
const isCancelled = (b: Booking) => b.status === "Cancelled" || b.status === "Declined";
const monthOf = (b: Booking): string | null => { const s = b.createdAt || b.days?.[0] || ""; const m = s.slice(0, 7); return /^\d{4}-\d{2}$/.test(m) ? m : null; };
const bookerKey = (b: Booking) => (b.email || b.booker || "").trim().toLowerCase();
const learnerNames = (b: Booking): string[] => (b.kids?.length ? b.kids.map((k) => k.name).filter(Boolean) : b.child ? [b.child] : []) as string[];
const bookingAges = (b: Booking): number[] => {
  const fromKids = (b.kids ?? []).map((k) => Number((k as { age?: number }).age)).filter((n) => Number.isFinite(n) && n > 0);
  if (fromKids.length) return fromKids;
  return Number.isFinite(Number(b.age)) && Number(b.age) > 0 ? [Number(b.age)] : [];
};
const SOURCE_OF = (b: Booking) => (b.pay === "Funded" ? "Childcare / voucher" : b.method || "Card");
const AGE_BUCKETS: [string, number, number][] = [["Under 5", 0, 4], ["5–7", 5, 7], ["8–10", 8, 10], ["11–13", 11, 13], ["14+", 14, 200]];

export function FinanceAnalyticsApp() {
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [invoices, setInvoices] = useState<InvPayload | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [status, setStatus] = useState<PayStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [months, setMonths] = useState(6);
  const [tab, setTab] = useState<"overview" | "revenue" | "payouts" | "debts" | "people">("overview");
  const [nowMs] = useState(() => Date.now());
  const [connecting, setConnecting] = useState(false);
  // Land on Payouts when payouts aren't set up yet — someone opening Finance
  // with no payout account is almost always here to fix exactly that, and the
  // Connect banner is otherwise two clicks deep on a non-default tab. Fires
  // once, and never over a tab the operator has already chosen themselves.
  const autoTabbed = useRef(false);
  const [tabTouched, setTabTouched] = useState(false);
  useEffect(() => {
    if (autoTabbed.current || tabTouched || !status || status.payoutsEnabled) return;
    autoTabbed.current = true;
    setTab("payouts");
  }, [status, tabTouched]);

  const load = useCallback(() => {
    apiGet<Booking[]>("/api/bookings").then((b) => { setBookings(Array.isArray(b) ? b : []); setError(null); }).catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
    apiGet<InvPayload>("/api/invoices").then((p) => setInvoices(p)).catch(() => setInvoices({ items: [], summary: { count: 0, outstanding: 0, collected: 0, overdue: 0 } }));
    apiGet<PaymentRecord[]>("/api/payments").then((p) => setPayments(Array.isArray(p) ? p : [])).catch(() => {});
    apiGet<PayStatus>("/api/payments/status").then(setStatus).catch(() => {});
  }, []);
  useEffect(load, [load]);
  useRealtime(["bookings", "payments", "invoices"], load);

  async function connect() {
    setConnecting(true);
    try { const { url } = await apiPost<{ url: string }>("/api/payments/connect", {}); window.location.href = url; }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn’t start Stripe"); setConnecting(false); }
  }

  /** Into the provider's own Stripe dashboard — change bank details, see
   *  payouts, download statements. The only route to payout settings once
   *  onboarding is done and the Connect banner has gone. */
  async function manage() {
    setConnecting(true);
    try { const { url } = await apiPost<{ url: string }>("/api/payments/dashboard", {}); window.location.href = url; }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn’t open Stripe"); setConnecting(false); }
  }

  const a = useMemo(() => {
    // Waitlisted places have paid nothing and hold no seat, so they're neither
    // revenue nor an attendee — exclude them (alongside Declined). Cancelled
    // stays IN so its retained/refunded money still nets out below.
    const all = (bookings ?? []).filter((b) => b.status !== "Declined" && b.status !== "Waitlisted");
    const now = new Date(nowMs);
    const keys: string[] = [];
    for (let i = months - 1; i >= 0; i--) keys.push(mKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))));
    const inWindow = new Set(keys);
    const windowStart = `${keys[0]}-01`;

    // First-seen (all time) so we can split new vs returning customers/learners.
    const firstBooker = new Map<string, string>();
    const firstLearner = new Map<string, string>();
    for (const b of all) {
      const when = b.createdAt || b.days?.[0] || "";
      const bk = bookerKey(b);
      if (bk && (!firstBooker.has(bk) || when < firstBooker.get(bk)!)) firstBooker.set(bk, when);
      for (const ln of learnerNames(b)) { const k = ln.toLowerCase(); if (!firstLearner.has(k) || when < firstLearner.get(k)!) firstLearner.set(k, when); }
    }

    const bookedByMonth = keys.map((k) => ({ label: k, value: 0 }));
    const collectedByMonth = keys.map((k) => ({ label: k, value: 0 }));
    const bySource = new Map<string, number>();
    const byListing = new Map<string, number>();
    const bookersInWin = new Set<string>();
    const learnersInWin = new Set<string>();
    const ages: number[] = [];
    let booked = 0, collected = 0, refunds = 0, owed = 0, paidBookings = 0, paidSessions = 0, freeSessions = 0;
    let newBookers = 0, returningBookers = 0, newLearners = 0, returningLearners = 0;
    const seenBooker = new Set<string>(), seenLearner = new Set<string>();

    for (const b of all) {
      const m = monthOf(b);
      if (!m || !inWindow.has(m)) continue;
      const i = keys.indexOf(m);
      const col = collectedNet(b);
      if (!isCancelled(b)) { bookedByMonth[i].value += b.amount; booked += b.amount; }
      collectedByMonth[i].value += col; collected += col;
      refunds += refundedGross(b);
      if (!isCancelled(b)) owed += owedOf(b);
      if (col > 0) { paidBookings++; bySource.set(SOURCE_OF(b), (bySource.get(SOURCE_OF(b)) ?? 0) + col); }
      if (!isCancelled(b) && b.listing) byListing.set(b.listing, (byListing.get(b.listing) ?? 0) + col);
      const sess = b.sessions?.length || b.seats || 1;
      if (!isCancelled(b)) { if (b.amount > 0) paidSessions += sess; else freeSessions += sess; }

      const bk = bookerKey(b);
      if (bk && !bookersInWin.has(bk)) {
        bookersInWin.add(bk);
        if ((firstBooker.get(bk) ?? "") >= windowStart) newBookers++; else returningBookers++;
      }
      if (bk && !seenBooker.has(bk)) seenBooker.add(bk);
      for (const ln of learnerNames(b)) {
        const k = ln.toLowerCase();
        if (!learnersInWin.has(k)) { learnersInWin.add(k); if ((firstLearner.get(k) ?? "") >= windowStart) newLearners++; else returningLearners++; }
        if (!seenLearner.has(k)) seenLearner.add(k);
      }
      if (!isCancelled(b)) ages.push(...bookingAges(b));
    }

    const feeEst = (list: Booking[]) => list.filter((b) => collectedNet(b) > 0).reduce((s, b) => s + collectedNet(b) * 0.014 + 0.2, 0);
    const fees = feeEst(all.filter((b) => { const m = monthOf(b); return m != null && inWindow.has(m); }));

    // Expected payout split: settled (older than 7 days) vs on-the-way (last 7 days).
    const weekAgo = nowMs - 7 * 86400000;
    let inTransit = 0, inBank = 0;
    for (const b of all) {
      if (collectedNet(b) <= 0) continue;
      const t = Date.parse((b.createdAt || "").length === 10 ? `${b.createdAt}T00:00:00Z` : b.createdAt || "");
      if (Number.isNaN(t)) continue;
      const net = collectedNet(b) * (1 - 0.014) - 0.2;
      if (t >= weekAgo) inTransit += Math.max(0, net); else inBank += Math.max(0, net);
    }

    const ageDist = AGE_BUCKETS.map(([label, lo, hi], i) => ({ label, value: ages.filter((n) => n >= lo && n <= hi).length, sub: String(ages.filter((n) => n >= lo && n <= hi).length), color: ACT_C[i % ACT_C.length] }));
    const topListings = [...byListing.entries()].sort((x, y) => y[1] - x[1]).slice(0, 8).map(([label, value], i) => ({ label, value, sub: money(value), color: ACT_C[i % ACT_C.length] }));
    const sourceRows = [...bySource.entries()].sort((x, y) => y[1] - x[1]);

    return {
      keys, windowStart,
      bookedByMonth, collectedByMonth,
      booked, collected, refunds, owed, net: collected - fees, fees,
      inTransit, inBank,
      source: sourceRows.map(([label, value]) => ({ label, value, color: label.startsWith("Childcare") ? GREEN : label === "Card" ? BLUE : colorFor(label) })),
      topListings,
      totalBookers: bookersInWin.size, totalLearners: learnersInWin.size,
      newBookers, returningBookers, newLearners, returningLearners,
      paidSessions, freeSessions,
      spendPerCustomer: bookersInWin.size ? collected / bookersInWin.size : 0,
      ageDist, paidBookings,
    };
  }, [bookings, months, nowMs]);

  const rangeLabel = useMemo(() => {
    const start = new Date(`${a.windowStart}T00:00:00Z`);
    const fmt = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
    return `${fmt(start)} – ${fmt(new Date(nowMs))}`;
  }, [a.windowStart, nowMs]);

  if (error) return <div className="p-4 text-[12.5px] text-[var(--red)]">{error}</div>;
  const loading = bookings === null;

  const periodToggle = (
    <div className="inline-flex items-center gap-1 rounded-full bg-white/15 p-1 text-[12px] font-bold text-white">
      {[3, 6, 12].map((m) => (
        <button key={m} type="button" onClick={() => setMonths(m)} className="rounded-full px-3 py-1 transition-colors" style={months === m ? { background: "#fff", color: BLUE } : { color: "rgba(255,255,255,.85)" }}>{m}m</button>
      ))}
    </div>
  );

  return (
    <div className="-m-3 min-h-[calc(100vh-3.5rem)] p-3 sm:-m-5 sm:p-5 text-[var(--ink)]" style={LIGHT_PALETTE}>
      <PageHero
        icon="£"
        title="Finance & analytics"
        lede={<>Everything money — revenue, payouts, what you&rsquo;re owed and who&rsquo;s booking. <span className="font-semibold text-white">{rangeLabel}</span></>}
        actions={periodToggle}
      />
      <TabStrip
        tabs={[["overview", "Overview"], ["revenue", "Revenue"], ["payouts", "Payouts"], ["debts", "Debts"], ["people", "Customers & learners"]]}
        value={tab}
        onChange={(t) => { setTabTouched(true); setTab(t); }}
      />

      {loading ? (
        <div className="py-16 text-center text-[12.5px] text-[var(--ink-3)]">Loading your figures…</div>
      ) : tab === "overview" ? (
        <div className="flex flex-col gap-4">
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            <Tile label="Revenue collected" icon="💰" grad={GRAD.green} value={money(a.collected)} sub={`of ${money(a.booked)} booked`} aside={<Ring pct={a.booked ? (a.collected / a.booked) * 100 : 0} label={`${a.booked ? Math.round((a.collected / a.booked) * 100) : 0}%`} />} />
            <Tile label="Owed to you" icon="⏳" grad={a.owed > 0 ? GRAD.pink : GRAD.green} value={money(a.owed)} sub={a.owed > 0 ? "unpaid / invoiced" : "all settled"} />
            <Tile label="Refunds" icon="↩️" grad={GRAD.amber} value={money(a.refunds)} sub={`last ${months} months`} />
            <Tile label="Est. net to bank" icon="🏦" grad={GRAD.blue} value={money(a.net)} sub={`after ~${money(a.fees)} fees`} />
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <Panel title="Revenue over time" right={<Legend items={[["Booked", LIGHTB], ["Collected", GREEN]]} />} className="lg:col-span-2">
              <TrendChart series={a.bookedByMonth} series2={a.collectedByMonth} fmt={compactMoney} color={LIGHTB} color2={GREEN} />
            </Panel>
            <Panel title="Where money comes from">
              {a.source.length ? <Donut segments={a.source} center={compactMoney(a.collected)} sub="collected" valueFmt={money} /> : <Empty>No paid bookings yet.</Empty>}
            </Panel>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Top listings by revenue"><Breakdown entries={a.topListings} /></Panel>
            <Panel title="Customers at a glance">
              <div className="grid grid-cols-2 gap-3">
                <MiniStat label="Bookers" value={a.totalBookers} tone={BLUE} />
                <MiniStat label="Learners" value={a.totalLearners} tone={GREEN} />
                <MiniStat label="Returning bookers" value={a.returningBookers} tone={PINK} />
                <MiniStat label="Spend / customer" value={money(a.spendPerCustomer)} tone={GOLD} isText />
              </div>
            </Panel>
          </div>
        </div>
      ) : tab === "revenue" ? (
        <div className="flex flex-col gap-4">
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            <Tile label="Total booked" icon="🎫" grad={GRAD.blue} value={money(a.booked)} sub={`${months}-month value`} />
            <Tile label="Collected" icon="✅" grad={GRAD.green} value={money(a.collected)} sub="paid & funded" />
            <Tile label="Outstanding" icon="⏳" grad={a.owed > 0 ? GRAD.pink : GRAD.teal} value={money(a.owed)} sub="not yet paid" />
            <Tile label="Refunds" icon="↩️" grad={GRAD.amber} value={money(a.refunds)} sub="issued in period" />
          </div>
          <Panel title="Booked vs collected by month" right={<Legend items={[["Booked", LIGHTB], ["Collected", GREEN]]} />}>
            <TrendChart series={a.bookedByMonth} series2={a.collectedByMonth} fmt={compactMoney} color={LIGHTB} color2={GREEN} />
          </Panel>
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title={<span className="flex items-center gap-1.5">Revenue by source <Info text="Card = payments through your connected account; Childcare/voucher = funded places." /></span>}>
              {a.source.length ? <Donut segments={a.source} center={compactMoney(a.collected)} sub="collected" valueFmt={money} /> : <Empty>No paid bookings yet.</Empty>}
            </Panel>
            <Panel title="Revenue by listing"><Breakdown entries={a.topListings} /></Panel>
          </div>
        </div>
      ) : tab === "payouts" ? (
        <div className="flex flex-col gap-4">
          {status && !status.payoutsEnabled && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#f3d98a] bg-[#fdf6e3] p-4">
              <div className="text-[12.5px] text-[#7a5a12]">
                <b>{status.connected ? "Finish setting up payouts" : "Connect your payout account"}</b> — card payments land in your own account. ActivityOS never holds your money.
              </div>
              <button type="button" onClick={connect} disabled={connecting} className="rounded-full bg-[#1d3a8f] px-4 py-2 text-[12.5px] font-bold text-white disabled:opacity-60">{connecting ? "Opening…" : status.connected ? "Continue setup" : "Connect payouts"}</button>
            </div>
          )}
          {/* Stays put once payouts are live — the banner above disappears at
              that point, and without this there'd be no way back to payout
              settings to change a bank account. */}
          {status?.payoutsEnabled && (
            <div data-ui="payout-account" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
              <div className="text-[12.5px] text-[var(--ink-2)]">
                <b className="text-[#0f7a43]">✓ Payout account connected</b>
                <span className="text-[var(--ink-3)]"> — card payments go straight to your own bank. Bank details and statements live in Stripe.</span>
              </div>
              <button type="button" onClick={manage} disabled={connecting} className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-[12.5px] font-bold text-[var(--ink)] disabled:opacity-60">{connecting ? "Opening…" : "Manage payouts →"}</button>
            </div>
          )}
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            <Tile label="On the way (est.)" icon="🚚" grad={GRAD.amber} value={money(a.inTransit)} sub="collected in last 7 days" />
            <Tile label="In your bank (est.)" icon="🏦" grad={GRAD.green} value={money(a.inBank)} sub="settled earlier" />
            <Tile label="Est. fees" icon="✂️" grad={GRAD.violet} value={money(a.fees)} sub="~1.4% + 20p / payment" />
            <Tile label="Est. net (period)" icon="💷" grad={GRAD.blue} value={money(a.net)} sub="collected − fees" />
          </div>
          <div className="rounded-lg bg-[#eef2fb] px-3 py-2 text-[11px] text-[#1d3a8f]">These payout figures are ActivityOS estimates from your paid bookings. Exact balances appear once your payment provider is fully connected.</div>
          <Panel title="Payout transactions">
            {payments.filter((p) => p.type !== "refund").length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-[12.5px]">
                  <thead><tr className="border-b border-[var(--line)] text-left text-[10.5px] uppercase tracking-wide text-[var(--ink-3)]"><th className="py-2 font-bold">Date</th><th className="font-bold">Reference</th><th className="font-bold">Status</th><th className="py-2 text-right font-bold">Amount</th></tr></thead>
                  <tbody>
                    {payments.filter((p) => p.type !== "refund").slice(0, 40).map((p) => (
                      <tr key={p.id} className="border-b border-[var(--line)]">
                        <td className="py-2 text-[var(--ink-2)]">{new Date(p.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</td>
                        <td className="text-[var(--ink-2)]">{p.refs?.join(", ") || p.email || "—"}</td>
                        <td><span className="rounded-full bg-[#e2f5ea] px-2 py-0.5 text-[10.5px] font-bold capitalize text-[#0b8446]">{p.status}</span></td>
                        <td className="py-2 text-right font-extrabold tabular-nums">{money(p.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <Empty>No payout transactions yet — they appear as card payments are taken.</Empty>}
          </Panel>
        </div>
      ) : tab === "debts" ? (
        <div className="flex flex-col gap-4">
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            <Tile label="Owed by families" icon="🧾" grad={a.owed > 0 ? GRAD.pink : GRAD.green} value={money(a.owed)} sub="unpaid bookings" />
            <Tile label="Unpaid invoices" icon="📄" grad={GRAD.amber} value={money(invoices?.summary.outstanding ?? 0)} sub={`${invoices?.items.filter((i) => i.status !== "paid").length ?? 0} open`} />
            <Tile label="Overdue invoices" icon="⏰" grad={GRAD.pink} value={money(invoices?.summary.overdue ?? 0)} sub={`${invoices?.items.filter((i) => i.overdue).length ?? 0} past due`} />
            <Tile label="Refunds issued" icon="↩️" grad={GRAD.violet} value={money(a.refunds)} sub={`last ${months} months`} />
          </div>
          <Panel title="Unpaid & overdue invoices">
            {invoices && invoices.items.filter((i) => i.status !== "paid").length ? (
              <div className="flex flex-col divide-y divide-[var(--line)]">
                {invoices.items.filter((i) => i.status !== "paid").slice(0, 30).map((iv) => (
                  <div key={iv.id} className="flex items-center gap-3 py-2.5 text-[12.5px]">
                    <span className="min-w-0 flex-1 truncate font-semibold">{iv.customerName}</span>
                    {iv.overdue && <span className="rounded-full bg-[#fdebec] px-2 py-0.5 text-[10.5px] font-bold text-[#c02636]">Overdue</span>}
                    <span className="text-[11px] text-[var(--ink-3)]">{iv.dueDate ? `due ${new Date(iv.dueDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : ""}</span>
                    <span className="w-20 text-right font-extrabold tabular-nums">{money(iv.amount)}</span>
                  </div>
                ))}
              </div>
            ) : <Empty>No unpaid invoices — nicely on top of it.</Empty>}
          </Panel>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            <Tile label="Total bookers" icon="👤" grad={GRAD.blue} value={String(a.totalBookers)} sub={`in the last ${months} months`} />
            <Tile label="Total learners" icon="🧒" grad={GRAD.teal} value={String(a.totalLearners)} sub="children booked in" />
            <Tile label="Returning bookers" icon="🔁" grad={GRAD.pink} value={String(a.returningBookers)} sub={`${a.newBookers} new`} aside={<Ring pct={a.totalBookers ? (a.returningBookers / a.totalBookers) * 100 : 0} label={`${a.totalBookers ? Math.round((a.returningBookers / a.totalBookers) * 100) : 0}%`} />} />
            <Tile label="Spend per customer" icon="💷" grad={GRAD.green} value={money(a.spendPerCustomer)} sub="collected ÷ bookers" />
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <Panel title="New vs returning bookers">
              {a.totalBookers ? <Donut segments={[{ label: "Returning", value: a.returningBookers, color: PINK }, { label: "New", value: a.newBookers, color: LIGHTB }]} center={`${a.totalBookers ? Math.round((a.returningBookers / a.totalBookers) * 100) : 0}%`} sub="returning" /> : <Empty>No bookers yet.</Empty>}
            </Panel>
            <Panel title="Paid vs free sessions">
              {a.paidSessions + a.freeSessions > 0 ? <Donut segments={[{ label: "Paid sessions", value: a.paidSessions, color: GREEN }, { label: "Free sessions", value: a.freeSessions, color: GOLD }]} center={String(a.paidSessions + a.freeSessions)} sub="sessions" /> : <Empty>No sessions yet.</Empty>}
            </Panel>
            <Panel title="Age distribution">
              {a.ageDist.some((x) => x.value > 0) ? <Breakdown entries={a.ageDist} /> : <Empty>No ages recorded yet.</Empty>}
            </Panel>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="New vs returning learners">
              {a.totalLearners ? <Donut segments={[{ label: "Returning", value: a.returningLearners, color: PINK }, { label: "New", value: a.newLearners, color: LIGHTB }]} center={`${a.totalLearners ? Math.round((a.returningLearners / a.totalLearners) * 100) : 0}%`} sub="returning" /> : <Empty>No learners yet.</Empty>}
            </Panel>
            <Panel title="Revenue over time" right={<Legend items={[["Collected", GREEN]]} />}>
              <TrendChart series={a.collectedByMonth} fmt={compactMoney} color={GREEN} />
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}

// A compact figure used inside light panels (not a gradient tile).
function MiniStat({ label, value, tone, isText }: { label: string; value: number | string; tone: string; isText?: boolean }) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5">
      <div className="text-[10.5px] font-bold uppercase tracking-wide text-[var(--ink-3)]">{label}</div>
      <div className="mt-0.5 text-[20px] font-extrabold leading-none tabular-nums" style={{ fontFamily: "var(--ff-display)", color: tone }}>{isText ? value : Number(value).toLocaleString("en-GB")}</div>
    </div>
  );
}
