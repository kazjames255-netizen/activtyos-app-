"use client";

import { portalOf } from "@/lib/portal-href";
import { dateLocale as dl } from "@/lib/i18n/format";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { get as apiGet, post as apiPost } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { WalletOwedCard } from "@/features/money/WalletOwedCard";
import { collectedNet, owedNow } from "@/features/bookings/helpers";
import type { Booking } from "@/features/bookings/types";
import { CollapsibleStats, LIGHT_PALETTE, PageHero, TabStrip } from "@/components/OperatorPage";
import { useSettings } from "@/lib/settings";
import { SeasonPicker } from "@/components/SeasonPicker";
import { csvCell } from "@/lib/csv";
import {
  GRAD, ACT_C, money, compactMoney,
  Tile, Ring, Donut, Breakdown, Panel, Legend, Empty, Info, TrendChart,
} from "./finance-kit";
import { useT, useWord } from "@/lib/i18n/provider";
import { BRAND } from "@/lib/i18n/config";
import { rich } from "./rich";
import { methodLabel } from "./finI18n";
import { RefundsToSend } from "./RefundsToSend";
import { financeFigures, isCancelled, isCardPayment, learnerNames, mKey, monthOf, payIndex, payoutRows, type PaymentRecord } from "./financeFigures";
import { addonFigures } from "./addonFigures";
import { genderSplit,type KidSex } from "./genderSplit";

// ── Types for the extra ledgers we fold in (subset of each route's shape) ──
interface Invoice { id: string; customerName: string; amount: number; date: string; dueDate?: string; status: string; overdue?: boolean }
interface InvPayload { items: Invoice[]; summary: { count: number; outstanding: number; collected: number; overdue: number } }
interface PayStatus { connected: boolean; payoutsEnabled?: boolean; chargesEnabled?: boolean; detailsSubmitted?: boolean }

const BLUE = "#1d3a8f", LIGHTB = "#3f78d8", GREEN = "#0f7a43", GOLD = "#f0b100", PINK = "#e2225f";
const VALUE_BANDS: [string, number, number][] = [["£0–25", 0, 25], ["£25–50", 25, 50], ["£50–100", 50, 100], ["£100–200", 100, 200], ["£200+", 200, Infinity]];
// Weekday short names in the viewer's language (index 0 = Sunday; 7 Jan 2024 was a Sunday).
const dowShort = (i: number) => { try { return new Intl.DateTimeFormat(dl(), { weekday: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2024, 0, 7 + i))); } catch { return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][i]; } };
const DOW = [0, 1, 2, 3, 4, 5, 6];

export function FinanceAnalyticsApp() {
  const t = useT();
  const w = useWord();
  const srcLabel = (l: string) => (l === "Childcare / voucher" ? t("p8fin.faSrcChildcare") : methodLabel(t, l));
  const ageLabel = (l: string) => (l === "Under 5" ? t("p8fin.faAgeUnder5") : l);
  // A franchise shares head office's payout (Stripe) account: it can't connect or open it (the API says so), so its
  // Payouts tab explains that instead of offering buttons that only ever fail.
  const isFranchisePortal = portalOf(usePathname()) === "franchise";
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [invoices, setInvoices] = useState<InvPayload | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [status, setStatus] = useState<PayStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [months, setMonths] = useState(6);
  const [tab, setTab] = useState<"overview" | "revenue" | "payouts" | "debts" | "insights">("overview");
  // Sub-sections inside the Insights hub (was three separate top tabs).
  const [insTab, setInsTab] = useState<"customers" | "addons" | "value">("customers");
  const [nowMs] = useState(() => Date.now());
  // Season + Location filters (a season/venue is a set of listings; we keep only
  // bookings whose listing is in it). "" = all.
  const { settings } = useSettings();
  const seasons = settings.seasons ?? [];
  const [season, setSeason] = useState("");
  const [venue, setVenue] = useState("");
  const [listingSeason, setListingSeason] = useState<Record<string, string>>({});
  const [listingVenue, setListingVenue] = useState<Record<string, string>>({});   // id → name
  const [listingVenueId, setListingVenueId] = useState<Record<string, string>>({}); // id → venueId
  const [venues, setVenues] = useState<{ id: string; name: string }[]>([]);
  const [addonMeta, setAddonMeta] = useState<Record<string, { name: string; price: number }>>({}); // addon id → name/price
  const [childKids, setChildKids] = useState<KidSex[]>([]); // the customers' children, with the gender their family recorded (if any)
  const [connecting, setConnecting] = useState(false);
  const router = useRouter();
  const portal = (usePathname() ?? "/").split("/")[1] || "app";
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
    apiGet<Booking[]>("/api/bookings").then((b) => {
      const next = Array.isArray(b) ? b : [];
      // useRealtime refetches on every bookings/payments/invoices change, which can fire
      // often — bail out of the state update (keep the old array reference) when the payload
      // is content-identical to what's loaded, so financeFigures()/mix don't re-walk a
      // tenant's whole booking history for nothing.
      setBookings((prev) => {
        try { if (prev && prev.length === next.length && JSON.stringify(prev) === JSON.stringify(next)) return prev; } catch { /* fall through */ }
        return next;
      });
      setError(null);
    }).catch((e) => setError(e instanceof Error ? e.message : t("p8fin.gLoadFailed")));
    apiGet<InvPayload>("/api/invoices").then((p) => setInvoices(p)).catch(() => setInvoices({ items: [], summary: { count: 0, outstanding: 0, collected: 0, overdue: 0 } }));
    apiGet<PaymentRecord[]>("/api/payments").then((p) => setPayments(Array.isArray(p) ? p : [])).catch(() => {});
    apiGet<PayStatus>("/api/payments/status").then(setStatus).catch(() => {});
    // Each listing's season + venue, for the Season/Location filters and the
    // location line under top-listing rows.
    Promise.all([
      apiGet<{ id: string; seasonId?: string | null; venueId?: string | null }[]>("/api/listings?mine=1"),
      apiGet<{ venues?: { id: string; name: string }[]; addons?: { id: string; name?: string; price?: number }[] } | null>("/api/library").catch(() => null),
    ]).then(([ls, lib]) => {
      const list = ls ?? [];
      setListingSeason(Object.fromEntries(list.filter((l) => l.id && l.seasonId).map((l) => [l.id, l.seasonId as string])));
      const venueName = new Map((lib?.venues ?? []).map((v) => [v.id, v.name]));
      setListingVenue(Object.fromEntries(list.flatMap((l) => { const n = l.venueId ? venueName.get(l.venueId) : undefined; return l.id && n ? [[l.id, n] as [string, string]] : []; })));
      setListingVenueId(Object.fromEntries(list.filter((l) => l.id && l.venueId).map((l) => [l.id, l.venueId as string])));
      const used = new Set(list.map((l) => l.venueId).filter(Boolean));
      setVenues((lib?.venues ?? []).filter((v) => used.has(v.id)));
      setAddonMeta(Object.fromEntries((lib?.addons ?? []).map((x) => [x.id, { name: x.name || t("p8fin.faAddonFallback"), price: Number(x.price) || 0 }])));
    }).catch(() => {});
    // Gender lives on the child's own record (the family records it, optional). /api/customers hands each child back with it, joined by child id
    // for children booked with THIS provider only, so the split reads it from there, never from a name.
    apiGet<{ children?: KidSex[] }[]>("/api/customers")
      .then((cs) => setChildKids((cs ?? []).flatMap((c) => c.children ?? [])))
      .catch(() => {});
  }, [t]);
  useEffect(load, [load]);
  useRealtime(["bookings", "payments", "invoices"], load);

  async function connect() {
    setConnecting(true);
    try { const { url } = await apiPost<{ url: string }>("/api/payments/connect", {}); window.location.href = url; }
    catch (e) { setError(e instanceof Error ? e.message : t("p8fin.faErrStripeStart")); setConnecting(false); }
  }

  /** Into the provider's own Stripe dashboard — change bank details, see
   *  payouts, download statements. The only route to payout settings once
   *  onboarding is done and the Connect banner has gone. */
  async function manage() {
    setConnecting(true);
    try { const { url } = await apiPost<{ url: string }>("/api/payments/dashboard", {}); window.location.href = url; }
    catch (e) { setError(e instanceof Error ? e.message : t("p8fin.faErrStripeOpen")); setConnecting(false); }
  }

  // The figures themselves live in ./financeFigures (plain functions, so the
  // page's maths can be checked against the Dashboard's on its own).
  const payIdx = useMemo(() => payIndex(bookings ?? [], payments), [bookings, payments]);
  const a = useMemo(
    () => financeFigures({ bookings: bookings ?? [], payIdx, months, nowMs, season, venue, listingSeason, listingVenue, listingVenueId }),
    [bookings, payIdx, months, nowMs, season, venue, listingSeason, listingVenue, listingVenueId],
  );

  // Add-ons · value · pass · gender · day-of-week — the extra comparisons, same
  // filters/window as `a`, kept separate to keep each concern legible.
  const mix = useMemo(() => {
    const all = (bookings ?? []).filter((b) =>
      b.status !== "Declined" && b.status !== "Waitlisted" && b.status !== "Offered"
      && (!season || listingSeason[b.listingId ?? ""] === season)
      && (!venue || listingVenueId[b.listingId ?? ""] === venue));
    const now = new Date(nowMs);
    const inWindow = new Set<string>();
    for (let i = months - 1; i >= 0; i--) inWindow.add(mKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))));

    const byPass = new Map<string, { count: number; revenue: number }>();
    const winBks: Booking[] = [];
    const dow = [0, 0, 0, 0, 0, 0, 0];
    const amounts: number[] = [];
    const seenLearner = new Set<string>();
    let winBookings = 0;

    for (const b of all) {
      const m = monthOf(b);
      if (!m || !inWindow.has(m) || isCancelled(b)) continue;
      winBookings++;
      winBks.push(b);
      amounts.push(b.amount);
      if (b.pass) { const p = byPass.get(b.pass) ?? { count: 0, revenue: 0 }; p.count++; p.revenue += collectedNet(b); byPass.set(b.pass, p); }
      for (const d of b.days ?? []) { const wd = new Date(`${d}T00:00:00Z`).getUTCDay(); if (wd >= 0 && wd <= 6) dow[wd]++; }
    }

    const { bookingsWithAddon, addonUnits, addonRevenue, byName: addonAgg } = addonFigures(winBks);
    const valueBands = VALUE_BANDS.map(([label, lo, hi], i) => { const n = amounts.filter((v) => v >= lo && v < hi).length; return { label, value: n, sub: String(n), color: ACT_C[i % ACT_C.length] }; });
    const topAddons = [...addonAgg.entries()].map(([label, v]) => ({ label, count: v.count, rev: Math.round(v.rev * 100) / 100 })).sort((x, y) => y.rev - x.rev || y.count - x.count).slice(0, 8)
      .map((r, i) => ({ label: r.label, value: r.rev, sub: t("p8fin.faAddonSold", { amount: money(r.rev), n: r.count }), color: ACT_C[i % ACT_C.length] }));
    const passRows = [...byPass.entries()].sort((x, y) => y[1].revenue - x[1].revenue).slice(0, 8).map(([label, v], i) => ({ label, value: v.revenue, sub: `${money(v.revenue)} · ${v.count}`, color: ACT_C[i % ACT_C.length] }));
    const dowRows = DOW.map((i) => ({ label: dowShort(i), value: dow[i], sub: String(dow[i]), color: LIGHTB }));

    const split = genderSplit(winBks, childKids);
    return {
      winBookings,
      attachRate: winBookings ? Math.round((bookingsWithAddon / winBookings) * 100) : 0,
      bookingsWithAddon, addonUnits, addonRevenue, topAddons,
      avgBookingValue: amounts.length ? amounts.reduce((s, v) => s + v, 0) / amounts.length : 0,
      medianValue: amounts.length ? [...amounts].sort((x, y) => x - y)[Math.floor(amounts.length / 2)] : 0,
      valueBands, passRows,
      gender: split, genderKnown: split.known,
      dowRows,
    };
  }, [bookings, months, nowMs, season, venue, listingSeason, listingVenueId, addonMeta, childKids, t]);

  // ref → booker name, so a payout row can name who paid (payments carry only refs).
  const nameByRef = useMemo(() => {
    const m = new Map<string, string>();
    for (const b of bookings ?? []) if (b.ref) m.set(b.ref, b.booker || b.email || "");
    return m;
  }, [bookings]);
  const payerName = (p: PaymentRecord) => (p.refs ?? []).map((r) => nameByRef.get(r)).find(Boolean) || p.email || "—";
  const payerNameOf = (refs: string[], email?: string) => refs.map((r) => nameByRef.get(r)).find(Boolean) || email || "—";
  // The Card payouts (Stripe) table: settled card charges with what went back to the card afterwards (refunded rows are struck through).
  const payouts = useMemo(() => payoutRows(payments), [payments]);

  // Debts → Chase: sends a REMINDER (email + the family's bell) through the server's one reminders log; View just opens the booking.
  const [reminded, setReminded] = useState<Record<string, { count: number; lastAt: string; sentMs?: number }>>({});
  const [chaseAsk, setChaseAsk] = useState<string | null>(null);
  const [chaseMsg, setChaseMsg] = useState<{ ref: string; text: string; ok: boolean } | null>(null);
  const [tickMs, setTickMs] = useState(() => Date.now());
  useEffect(() => {
    if (!Object.values(reminded).some((r) => r.sentMs && Date.now() - r.sentMs < 30_000)) return;
    const id = setInterval(() => setTickMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [reminded]);
  const lastReminder = (o: { ref: string; reminders: { count: number; lastAt: string } | null }) => reminded[o.ref] ?? o.reminders;
  const chaseWaitS = (ref: string) => { const s = reminded[ref]?.sentMs; return s ? Math.max(0, Math.ceil((30_000 - (tickMs - s)) / 1000)) : 0; };
  async function chase(o: { ref: string; email: string }) {
    setChaseAsk(null);
    try {
      const b = await apiPost<{ invoiceResends?: { count: number; lastAt: string }; nudges?: number; lastNudgedAt?: string }>(`/api/bookings/${encodeURIComponent(o.ref)}/nudge`, {});
      const rec = b.invoiceResends ?? { count: b.nudges ?? 1, lastAt: b.lastNudgedAt ?? new Date().toISOString() };
      setReminded((m) => ({ ...m, [o.ref]: { ...rec, sentMs: Date.now() } }));
      setTickMs(Date.now());
      setChaseMsg({ ref: o.ref, ok: true, text: t("p8fin.faChaseToast", { email: o.email || "—", n: String(rec.count) }) });
    } catch (e) {
      setChaseMsg({ ref: o.ref, ok: false, text: e instanceof Error ? e.message : String(e) });
    }
  }
  const whenLabel = (iso: string) => new Date(iso).toLocaleString(dl(), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  // Export the filtered, in-window bookings an accountant would want — one row
  // per booking with the money broken out. Honours the Season/Location filters.
  function exportCSV() {
    const cell = csvCell; // formula-safe: Family is the parent-typed booker name
    const rows = (bookings ?? []).filter((b) =>
      b.status !== "Declined" && b.status !== "Waitlisted" && b.status !== "Offered"
      && (!season || listingSeason[b.listingId ?? ""] === season)
      && (!venue || listingVenueId[b.listingId ?? ""] === venue)
      && (() => { const m = monthOf(b); return m != null && a.keys.includes(m); })());
    const header = ["Ref", "Date", "Family", "Email", "Listing", "Location", "Status", "Method", "Booked", "Collected", "Owed"];
    const body = rows.map((b) => [b.ref, (b.createdAt || b.days?.[0] || "").slice(0, 10), b.booker, b.email, b.listing, (b.listingId ? listingVenue[b.listingId] : "") || "", b.status, b.method || "", b.amount, collectedNet(b), owedNow(b)].map(cell).join(","));
    const blob = new Blob([[header.join(","), ...body].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = `finance-${a.keys[0]}-to-${a.keys[a.keys.length - 1]}.csv`;
    link.click(); URL.revokeObjectURL(url);
  }

  const rangeLabel = useMemo(() => {
    const start = new Date(`${a.windowStart}T00:00:00Z`);
    const fmt = (d: Date) => d.toLocaleDateString(dl(), { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
    return `${fmt(start)} – ${fmt(new Date(nowMs))}`;
  }, [a.windowStart, nowMs]);

  if (error) return <div className="p-4 text-[12.5px] text-[var(--red)]">{error}</div>;
  const loading = bookings === null;

  const periodToggle = (
    <div className="flex items-center gap-2">
      <div className="inline-flex items-center gap-1 rounded-full bg-white/15 p-1 text-[12px] font-bold text-white">
        {[3, 6, 12].map((m) => (
          <button key={m} type="button" onClick={() => setMonths(m)} className="rounded-full px-3 py-1 transition-colors" style={months === m ? { background: "#fff", color: BLUE } : { color: "rgba(255,255,255,.85)" }}>{t("p8fin.faMonthsShort", { m })}</button>
        ))}
      </div>
      <button type="button" onClick={exportCSV} title={t("p8fin.faDownloadCsvTip")} className="rounded-full bg-white/15 px-3 py-1.5 text-[12px] font-bold text-white hover:bg-white/25">⬇ CSV</button>
    </div>
  );

  return (
    <div className="-m-3 min-h-[calc(100vh-3.5rem)] p-3 sm:-m-5 sm:p-5 text-[var(--ink)]" style={LIGHT_PALETTE}>
      <PageHero
        icon="£"
        title={t("p8fin.faTitle")}
        lede={<>{t("p8fin.faLede")} <span className="font-semibold text-white">{rangeLabel}</span></>}
        actions={periodToggle}
      />
      <TabStrip
        tabs={[["overview", t("p8fin.exTabOverview")], ["revenue", t("p8fin.faTabRevenue")], ["payouts", t("p8fin.faTabCardPayouts")], ["debts", t("p8fin.faTabDebts")], ["insights", t("p8fin.faTabInsights")]]}
        value={tab}
        onChange={(tb) => { setTabTouched(true); setTab(tb); }}
      />

      {/* Filter bar — Season + Location scope every figure below. Hidden when the
          tenant has neither set up, so single-site freelancers see no clutter. */}
      {(seasons.length > 0 || venues.length > 0) && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">{t("p8fin.faFilter")}</span>
          <SeasonPicker seasons={seasons} value={season} onChange={setSeason} allLabel={t("p8fin.recAllSeasons")} />
          {venues.length > 0 && (
            <select value={venue} onChange={(e) => setVenue(e.target.value)} className="rounded-lg border border-[var(--line)] bg-white px-2.5 py-1.5 text-[12px] font-bold text-[var(--ink-2)] outline-none focus:border-[#2f6bd8]">
              <option value="">{t("p8fin.faAllLocations")}</option>
              {venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          )}
          {(season || venue) && <button type="button" onClick={() => { setSeason(""); setVenue(""); }} className="text-[11.5px] font-bold text-[var(--ink-3)] hover:text-[var(--ink)] hover:underline">{t("p8fin.faReset")}</button>}
        </div>
      )}

      {/* Insights sub-sections — one hub instead of three top tabs. */}
      {tab === "insights" && !loading && (
        <div className="mb-3 inline-flex flex-wrap gap-1 rounded-full bg-white p-1 shadow-sm">
          {([["customers", t("p8fin.faInsCustomers")], ["addons", t("p8fin.faInsAddons")], ["value", t("p8fin.faInsValue")]] as [typeof insTab, string][]).map(([k, l]) => (
            <button key={k} type="button" onClick={() => setInsTab(k)} className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-bold ${insTab === k ? "bg-[#1d3a8f] text-white" : "text-[var(--ink-2)] hover:bg-[#f2f5fb]"}`}>{l}</button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center text-[12.5px] text-[var(--ink-3)]">{t("p8fin.faLoadingFigures")}</div>
      ) : tab === "overview" ? (
        <div className="flex flex-col gap-4">
          <CollapsibleStats id="finance-overview">
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            <Tile label={t("p8fin.faRevCollected")} icon="💰" grad={GRAD.green} value={money(a.collected)} note={a.refundsAwaiting > 0 ? t("p8lst.rfaCollectedNote", { amt: money(a.refundsAwaiting) }) : undefined} sub={<>{t("p8fin.faOfBooked", { amount: money(a.booked) })}<Delta pct={a.collectedDelta} /></>} aside={<Ring pct={a.booked ? (a.collected / a.booked) * 100 : 0} label={`${a.booked ? Math.round((a.collected / a.booked) * 100) : 0}%`} />} />
            <Tile label={t("p8fin.faOwedToYou")} icon="⏳" grad={a.owed > 0 ? GRAD.pink : GRAD.green} value={money(a.owed)} sub={a.owed > 0 ? t("p8fin.faOwedNow") : t("p8fin.faAllSettled")} note={t("p8fin.faOwedNote")} />
            <Tile label={t("p8fin.faRefunds")} icon="↩️" grad={GRAD.amber} value={money(a.refunds)} sub={t("p8fin.faRefundsGiven", { n: months })} note={a.refundsAwaiting > 0 ? t("p8lst.rfaTileAwait", { amt: money(a.refundsAwaiting) }) : undefined} />
            <Tile label={t("p8fin.faEstNet")} icon="🏦" grad={GRAD.blue} value={money(a.net)} sub={t("p8fin.faAfterFees", { fees: money(a.fees) })} note={t("p8fin.faNoteOverviewNet")} />
          </div>
          </CollapsibleStats>
          <WalletOwedCard />
          <div className="grid gap-4 lg:grid-cols-3">
            <Panel title={t("p8fin.faRevOverTime")} right={<Legend items={[[t("p8fin.faBooked"), LIGHTB], [t("p8fin.faCollected"), GREEN]]} />} className="lg:col-span-2">
              <TrendChart series={a.bookedByMonth} series2={a.collectedByMonth} fmt={compactMoney} color={LIGHTB} color2={GREEN} />
            </Panel>
            <Panel title={t("p8fin.faWhereMoney")}>
              {a.source.length ? <Donut segments={a.source.map((x) => ({ ...x, label: srcLabel(x.label) }))} center={compactMoney(a.collected)} sub={t("p8fin.faCollectedSub")} valueFmt={money} /> : <Empty>{t("p8fin.faNoPaid")}</Empty>}
            </Panel>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title={t("p8fin.faTopListings")}><Breakdown entries={a.topListings} /></Panel>
            <Panel title={t("p8fin.faCustAtGlance")}>
              <div className="grid grid-cols-2 gap-3">
                <MiniStat label={t("p8fin.faBookers")} value={a.totalBookers} tone={BLUE} />
                <MiniStat label={t("p8fin.faLearners")} value={a.totalLearners} tone={GREEN} />
                <MiniStat label={t("p8fin.faReturningBookers")} value={a.returningBookers} tone={PINK} />
                <MiniStat label={t("p8fin.faSpendPerCust")} value={money(a.spendPerCustomer)} tone={GOLD} isText />
              </div>
            </Panel>
          </div>
        </div>
      ) : tab === "revenue" ? (
        <div className="flex flex-col gap-4">
          <CollapsibleStats id="finance-revenue">
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            <Tile label={t("p8fin.faTotalBooked")} icon="🎫" grad={GRAD.blue} value={money(a.booked)} sub={<><span>{t("p8fin.faMonthValue", { n: months })}</span><Delta pct={a.bookedDelta} /></>} />
            <Tile label={t("p8fin.faCollected")} icon="✅" grad={GRAD.green} value={money(a.collected)} sub={<><span>{t("p8fin.faByDatePaid")}</span><Delta pct={a.collectedDelta} /></>} />
            <Tile label={t("p8fin.recTileOutstanding")} icon="⏳" grad={a.owed > 0 ? GRAD.pink : GRAD.teal} value={money(a.owed)} sub={t("p8fin.faOwedNow")} />
            <Tile label={t("p8fin.faRefunds")} icon="↩️" grad={GRAD.amber} value={money(a.refunds)} sub={t("p8fin.faIssuedPeriod")} note={a.refundsAwaiting > 0 ? t("p8lst.rfaTileAwait", { amt: money(a.refundsAwaiting) }) : undefined} />
          </div>
          </CollapsibleStats>
          <div className="rounded-lg bg-[#eef2fb] px-3 py-2 text-[11px] text-[#1d3a8f]">{t("p8fin.faRevenueNote")}</div>
          <Panel title={t("p8fin.faBookedVsCollected")} right={<Legend items={[[t("p8fin.faBooked"), LIGHTB], [t("p8fin.faCollected"), GREEN]]} />}>
            <TrendChart series={a.bookedByMonth} series2={a.collectedByMonth} fmt={compactMoney} color={LIGHTB} color2={GREEN} />
          </Panel>
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title={<span className="flex items-center gap-1.5">{t("p8fin.faRevBySource")} <Info text={t("p8fin.faSourceInfo")} /></span>}>
              {a.source.length ? <Donut segments={a.source.map((x) => ({ ...x, label: srcLabel(x.label) }))} center={compactMoney(a.collected)} sub={t("p8fin.faCollectedSub")} valueFmt={money} /> : <Empty>{t("p8fin.faNoPaid")}</Empty>}
            </Panel>
            <Panel title={t("p8fin.faRevByListing")}><Breakdown entries={a.topListings} /></Panel>
          </div>
        </div>
      ) : tab === "payouts" ? (
        <div className="flex flex-col gap-4">
          {isFranchisePortal && (
            <div data-ui="payout-account" className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-[12.5px] text-[var(--ink-2)]">
              {(() => { const [pre, post] = t("p8fin.faHeadOffice").split("{link}"); return <>{rich(pre)}<a href="/franchise/royalties" className="font-bold text-[#1d3a8f] underline">{t("p8fin.faRoyalties")}</a>{rich(post ?? "")}</>; })()}
            </div>
          )}
          {!isFranchisePortal && status && !status.payoutsEnabled && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#f3d98a] bg-[#fdf6e3] p-4">
              <div className="text-[12.5px] text-[#7a5a12]">
                <b>{status.connected ? t("p8fin.faFinishPayouts") : t("p8fin.faConnectPayoutAcct")}</b>{t("p8fin.faCardsLand", { brand: BRAND })}
              </div>
              <button type="button" onClick={connect} disabled={connecting} className="rounded-full bg-[#1d3a8f] px-4 py-2 text-[12.5px] font-bold text-white disabled:opacity-60">{connecting ? t("p8fin.faOpening") : status.connected ? t("p8fin.faContinueSetup") : t("p8fin.faConnectPayouts")}</button>
            </div>
          )}
          {/* Stays put once payouts are live — the banner above disappears at
              that point, and without this there'd be no way back to payout
              settings to change a bank account. */}
          {!isFranchisePortal && status?.payoutsEnabled && (
            <div data-ui="payout-account" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
              <div className="text-[12.5px] text-[var(--ink-2)]">
                <b className="text-[#0f7a43]">{t("p8fin.faPayoutConnected")}</b>
                <span className="text-[var(--ink-3)]">{t("p8fin.faPayoutConnectedNote")}</span>
              </div>
              <button type="button" onClick={manage} disabled={connecting} className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-[12.5px] font-bold text-[var(--ink)] disabled:opacity-60">{connecting ? t("p8fin.faOpening") : t("p8fin.faManagePayouts")}</button>
            </div>
          )}
          {/* The scope of this page, impossible to miss: Stripe card payments ONLY. */}
          <div data-ui="stripe-only-banner" className="rounded-2xl border-2 border-[#1d3a8f] bg-[#eef3ff] px-4 py-3 text-[13.5px] font-bold leading-snug text-[#16306e]">💳 {t("p8fin.faStripeOnlyBanner")}</div>
          <CollapsibleStats id="finance-payouts">
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            <Tile label={`${t("p8fin.faOnTheWay")} · ${t("p8fin.faStripeCardTag")}`} icon="🚚" grad={GRAD.amber} value={money(a.inTransit)} sub={t("p8fin.faCardLast7")} note={t("p8fin.faNoteOnWay")} />
            <Tile label={`${t("p8fin.faInBank")} · ${t("p8fin.faStripeCardTag")}`} icon="🏦" grad={GRAD.green} value={money(a.inBank)} sub={t("p8fin.faCardSettled")} note={t("p8fin.faNoteInBank")} />
            <Tile label={`${t("p8fin.faEstFees")} · ${t("p8fin.faStripeCardTag")}`} icon="✂️" grad={GRAD.violet} value={money(a.fees)} sub={t("p8fin.faFeesFormula")} note={t("p8fin.faNoteFees")} />
            <Tile label={t("p8fin.faCardNet")} icon="💷" grad={GRAD.blue} value={money(a.cardNet)} sub={t("p8fin.faCollectedMinusFees")} note={t("p8fin.faNoteCardNet")} />
          </div>
          </CollapsibleStats>
          <div className="rounded-lg bg-[#eef2fb] px-3 py-2 text-[11px] text-[#1d3a8f]">{t("p8fin.faPayoutNote", { brand: BRAND })}</div>
          <Panel title={t("p8fin.faPayoutTx")}>
            {payouts.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-[12.5px]">
                  <thead><tr className="border-b border-[var(--line)] text-start text-[10.5px] uppercase tracking-wide text-[var(--ink-3)]"><th className="py-2 font-bold">{t("p8fin.gDate")}</th><th className="font-bold">{t("p8fin.faPaidBy")}</th><th className="font-bold">{t("p8fin.recMethod")}</th><th className="font-bold">{t("p8fin.recReference")}</th><th className="font-bold">{t("p8fin.gStatus")}</th><th className="py-2 text-end font-bold">{t("p8fin.gAmount")}</th></tr></thead>
                  <tbody>
                    {payouts.slice(0, 40).map((p) => (
                      <tr key={p.id} className="border-b border-[var(--line)]" data-state={p.state}>
                        <td className="py-2 text-[var(--ink-2)]">{new Date(p.at).toLocaleDateString(dl(), { day: "numeric", month: "short", year: "numeric" })}</td>
                        <td className="font-semibold text-[var(--ink)]">{payerNameOf(p.refs, p.email)}</td>
                        <td className="text-[var(--ink-2)]">{methodLabel(t, p.method || "Card")}</td>
                        <td className="text-[var(--ink-3)]">{p.refs.join(", ") || "—"}</td>
                        <td>
                          {p.state === "paid"
                            ? <span className="rounded-full bg-[#e2f5ea] px-2 py-0.5 text-[10.5px] font-bold capitalize text-[#0b8446]">{w("succeeded")}</span>
                            : p.state === "refunded"
                              ? <span className="rounded-full bg-[#eceff6] px-2 py-0.5 text-[10.5px] font-bold text-[#4a4763]">{t("p8fin.faStRefunded")}</span>
                              : <span className="rounded-full bg-[#fdf3d8] px-2 py-0.5 text-[10.5px] font-bold text-[#8a5300]">{t("p8fin.faStPartRefunded")}</span>}
                        </td>
                        <td className="py-2 text-end tabular-nums">
                          {p.state === "paid"
                            ? <span className="font-extrabold">{money(p.gross)}</span>
                            : <>
                                <span className="font-bold text-[var(--ink-3)] line-through">{money(p.gross)}</span>
                                <span className="ms-2 font-extrabold">{money(p.net)}</span>
                                <div className="text-[10.5px] font-semibold text-[var(--ink-3)]">{t("p8fin.faRefundedOn", { amt: money(p.refunded), date: p.refundedAt ? new Date(p.refundedAt).toLocaleDateString(dl(), { day: "numeric", month: "short" }) : "—" })}</div>
                              </>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <Empty>{t("p8fin.faNoPayoutTx")}</Empty>}
          </Panel>
        </div>
      ) : tab === "debts" ? (
        <div className="flex flex-col gap-4">
          <CollapsibleStats id="finance-debts">
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            <Tile label={t("p8fin.faOwedByFamilies")} icon="🧾" grad={a.owed > 0 ? GRAD.pink : GRAD.green} value={money(a.owed)} sub={t("p8fin.faWheneverBooked")} />
            <Tile label={t("p8fin.faUnpaidInvoices")} icon="📄" grad={GRAD.amber} value={money(invoices?.summary.outstanding ?? 0)} sub={t("p8fin.faNOpen", { n: invoices?.items.filter((i) => i.status === "sent").length ?? 0 })} />
            <Tile label={t("p8fin.faOverdueInvoices")} icon="⏰" grad={GRAD.pink} value={money(invoices?.summary.overdue ?? 0)} sub={t("p8fin.faNPastDue", { n: invoices?.items.filter((i) => i.overdue).length ?? 0 })} />
            <Tile label={t("p8fin.faRefundsIssued")} icon="↩️" grad={GRAD.violet} value={money(a.refunds)} sub={t("p8fin.faRefundsGiven", { n: months })} note={a.refundsAwaiting > 0 ? t("p8lst.rfaTileAwait", { amt: money(a.refundsAwaiting) }) : undefined} />
          </div>
          </CollapsibleStats>
          <WalletOwedCard />
          <RefundsToSend rows={a.refundsToSend} onSent={load} />
          <Panel title={t("p8fin.faWhoOwes")} right={<span className="text-[11px] font-bold text-[var(--ink-3)]">{t("p8fin.faBookingsOwed", { n: a.owing.length, amount: money(a.owed) })}</span>}>
            {a.owing.length ? (
              <div className="flex flex-col divide-y divide-[var(--line)]">
                {a.owing.slice(0, 30).map((o) => {
                  const last = lastReminder(o);
                  const waitS = chaseWaitS(o.ref);
                  const recent = !!last?.lastAt && Date.now() - Date.parse(last.lastAt) < 24 * 3_600_000;
                  return (
                    <div key={o.ref} className="py-2.5 text-[12.5px]">
                      <div className="flex items-center gap-3">
                        <span className="min-w-0 flex-1 truncate"><b>{o.name}</b>{o.listing && <span className="text-[var(--ink-3)]"> · {o.listing}</span>}</span>
                        <span className="hidden whitespace-nowrap text-[11px] text-[var(--ink-3)] sm:inline">{o.when ? new Date(o.when.length === 10 ? `${o.when}T00:00:00` : o.when).toLocaleDateString(dl(), { day: "numeric", month: "short" }) : ""}</span>
                        <span className="w-20 text-end font-extrabold tabular-nums text-[#c02636]">{money(o.owed)}</span>
                        <button type="button" disabled={waitS > 0} title={waitS > 0 ? t("p8fin.faChaseWait", { s: String(waitS) }) : t("p8fin.faChaseTip")}
                          onClick={() => (recent ? setChaseAsk(o.ref) : void chase(o))}
                          className="rounded-full bg-[#c02636] px-3 py-1 text-[11px] font-extrabold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50">{waitS > 0 ? `${t("p8fin.faChase")} · ${waitS}s` : t("p8fin.faChase")}</button>
                        <button type="button" onClick={() => router.push(`/${portal}/bookings?ref=${encodeURIComponent(o.ref)}`)} className="rounded-full border border-[var(--line)] bg-white px-2.5 py-1 text-[11px] font-bold text-[var(--ink-2)] hover:border-[#1d3a8f] hover:text-[#1d3a8f]">{t("p8fin.faView")}</button>
                      </div>
                      <div className="mt-1 text-[11px] text-[var(--ink-3)]" data-testid="last-reminder">
                        {last?.lastAt ? t("p8fin.faLastReminder", { when: whenLabel(last.lastAt), n: String(last.count) }) : t("p8fin.faNoReminder")}
                      </div>
                      {chaseAsk === o.ref && (
                        <div className="mt-1.5 flex flex-wrap items-center gap-2 rounded-lg border border-[#f0c96b] bg-[#fff7e0] px-3 py-2 text-[12px] font-semibold text-[#7a4b00]">
                          {t("p8fin.faChaseAgain", { when: last?.lastAt ? whenLabel(last.lastAt) : "" })}
                          <button type="button" onClick={() => void chase(o)} className="rounded-full bg-[#c02636] px-3 py-1 text-[11px] font-extrabold text-white">{t("p8fin.faChaseSend")}</button>
                          <button type="button" onClick={() => setChaseAsk(null)} className="rounded-full border border-[var(--line)] bg-white px-3 py-1 text-[11px] font-bold text-[var(--ink-2)]">{t("p8fin.faChaseCancel")}</button>
                        </div>
                      )}
                      {chaseMsg?.ref === o.ref && (
                        <div role="status" className={`mt-1.5 rounded-lg px-3 py-1.5 text-[12px] font-bold ${chaseMsg.ok ? "bg-[#e8f8ee] text-[#0f6b34]" : "bg-[#fdebec] text-[#c02636]"}`}>{chaseMsg.text}</div>
                      )}
                    </div>
                  );
                })}
                {a.owing.length > 30 && <div className="pt-2 text-center text-[11px] text-[var(--ink-3)]">{t("p8fin.faMoreShowing", { n: a.owing.length - 30 })}</div>}
              </div>
            ) : <Empty>{t("p8fin.faNobodyOwes")}</Empty>}
          </Panel>
          <Panel title={t("p8fin.faUnpaidOverdueInv")}>
            {invoices && invoices.items.filter((i) => i.status === "sent").length ? (
              <div className="flex flex-col divide-y divide-[var(--line)]">
                {invoices.items.filter((i) => i.status === "sent").slice(0, 30).map((iv) => (
                  <div key={iv.id} className="flex items-center gap-3 py-2.5 text-[12.5px]">
                    <span className="min-w-0 flex-1 truncate font-semibold">{iv.customerName}</span>
                    {iv.overdue && <span className="rounded-full bg-[#fdebec] px-2 py-0.5 text-[10.5px] font-bold text-[#c02636]">{t("p8fin.recTileOverdue")}</span>}
                    <span className="text-[11px] text-[var(--ink-3)]">{iv.dueDate ? t("p8fin.inDueDate", { date: new Date(iv.dueDate).toLocaleDateString(dl(), { day: "numeric", month: "short" }) }) : ""}</span>
                    <span className="w-20 text-end font-extrabold tabular-nums">{money(iv.amount)}</span>
                  </div>
                ))}
              </div>
            ) : <Empty>{t("p8fin.faNoUnpaid")}</Empty>}
          </Panel>
        </div>
      ) : tab === "insights" && insTab === "customers" ? (
        <div className="flex flex-col gap-4">
          <CollapsibleStats id="finance-insights-customers">
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            <Tile label={t("p8fin.faTotalBookers")} icon="👤" grad={GRAD.blue} value={String(a.totalBookers)} sub={t("p8fin.faInLastMonths", { n: months })} />
            <Tile label={t("p8fin.faTotalLearners")} icon="🧒" grad={GRAD.teal} value={String(a.totalLearners)} sub={t("p8fin.faChildrenBooked")} />
            <Tile label={t("p8fin.faReturningBookers")} icon="🔁" grad={GRAD.pink} value={String(a.returningBookers)} sub={t("p8fin.faNNew", { n: a.newBookers })} note={t("p8fin.faReturningNote")} aside={<Ring pct={a.totalBookers ? (a.returningBookers / a.totalBookers) * 100 : 0} label={`${a.totalBookers ? Math.round((a.returningBookers / a.totalBookers) * 100) : 0}%`} />} />
            <Tile label={t("p8fin.faSpendPerCustomer")} icon="💷" grad={GRAD.green} value={money(a.spendPerCustomer)} sub={t("p8fin.faCollectedDivBookers")} />
          </div>
          </CollapsibleStats>
          <div className="grid gap-4 lg:grid-cols-3">
            <Panel title={t("p8fin.faNewVsReturning")}>
              {a.totalBookers ? <Donut segments={[{ label: t("p8fin.faReturning"), value: a.returningBookers, color: PINK }, { label: t("p8fin.faNew"), value: a.newBookers, color: LIGHTB }]} center={`${a.totalBookers ? Math.round((a.returningBookers / a.totalBookers) * 100) : 0}%`} sub={t("p8fin.faReturning")} /> : <Empty>{t("p8fin.faNoBookers")}</Empty>}
            </Panel>
            <Panel title={t("p8fin.faPaidVsFree")}>
              {a.paidSessions + a.freeSessions > 0 ? <Donut segments={[{ label: t("p8fin.faPaidSessions"), value: a.paidSessions, color: GREEN }, { label: t("p8fin.faFreeSessions"), value: a.freeSessions, color: GOLD }]} center={String(a.paidSessions + a.freeSessions)} sub={t("p8fin.faSessions")} /> : <Empty>{t("p8fin.faNoSessions")}</Empty>}
            </Panel>
            <Panel title={t("p8fin.faAgeDist")}>
              {a.ageDist.some((x) => x.value > 0) ? <Breakdown entries={a.ageDist.map((x) => ({ ...x, label: ageLabel(x.label) }))} /> : <Empty>{t("p8fin.faNoAges")}</Empty>}
            </Panel>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title={t("p8fin.faTopCustomers")}><Breakdown entries={a.topCustomers} /></Panel>
            <Panel title={t("p8fin.faNewVsRetLearners")}>
              {a.totalLearners ? <Donut segments={[{ label: t("p8fin.faReturning"), value: a.returningLearners, color: PINK }, { label: t("p8fin.faNew"), value: a.newLearners, color: LIGHTB }]} center={`${a.totalLearners ? Math.round((a.returningLearners / a.totalLearners) * 100) : 0}%`} sub={t("p8fin.faReturning")} /> : <Empty>{t("p8fin.faNoLearners")}</Empty>}
            </Panel>
          </div>
          <Panel title={t("p8fin.faRevOverTime")} right={<Legend items={[[t("p8fin.faCollected"), GREEN]]} />}>
            <TrendChart series={a.collectedByMonth} fmt={compactMoney} color={GREEN} />
          </Panel>
        </div>
      ) : tab === "insights" && insTab === "addons" ? (
        <div className="flex flex-col gap-4">
          <CollapsibleStats id="finance-insights-addons">
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            <Tile label={t("p8fin.faAddonRev")} icon="🧩" grad={GRAD.violet} value={money(mix.addonRevenue)} sub={t("p8fin.faFromPaidAddons")} />
            <Tile label={t("p8fin.faAttachRate")} icon="📈" grad={GRAD.blue} value={`${mix.attachRate}%`} sub={t("p8fin.faOfBookingsAdd")} aside={<Ring pct={mix.attachRate} label={`${mix.attachRate}%`} />} />
            <Tile label={t("p8fin.faAddonsSold")} icon="🛒" grad={GRAD.teal} value={String(mix.addonUnits)} sub={t("p8fin.faUnitsInPeriod")} />
            <Tile label={t("p8fin.faBookingsWithAddons")} icon="✅" grad={GRAD.green} value={String(mix.bookingsWithAddon)} sub={t("p8fin.faOfNBookings", { n: mix.winBookings })} />
          </div>
          </CollapsibleStats>
          <Panel title={t("p8fin.faTopAddons")} right={<span className="text-[11px] font-bold text-[var(--ink-3)]">{t("p8fin.faEstPriceUnits")}</span>}>
            {mix.topAddons.length ? <Breakdown entries={mix.topAddons} /> : <Empty>{t("p8fin.faNoAddons")}</Empty>}
          </Panel>
          <div className="rounded-lg bg-[#eef2fb] px-3 py-2 text-[11px] text-[#1d3a8f]">{t("p8fin.faAddonNote")}</div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <CollapsibleStats id="finance-insights-bookings">
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            <Tile label={t("p8fin.faAvgBooking")} icon="🧮" grad={GRAD.blue} value={money(mix.avgBookingValue)} sub={t("p8fin.faAcrossN", { n: mix.winBookings })} />
            <Tile label={t("p8fin.faMedian")} icon="📊" grad={GRAD.teal} value={money(mix.medianValue)} sub={t("p8fin.faTypicalBasket")} />
            <Tile label={t("p8fin.faBoysGirls")} icon="🚻" grad={GRAD.violet} value={mix.gender.boy + mix.gender.girl ? `${Math.round((mix.gender.boy / (mix.gender.boy + mix.gender.girl)) * 100)}:${Math.round((mix.gender.girl / (mix.gender.boy + mix.gender.girl)) * 100)}` : "—"} sub={mix.genderKnown ? t("p8fin.faNWithGender", { n: mix.genderKnown }) : t("p8fin.faNoGenderShort")} />
            <Tile label={t("p8fin.faBusiestDay")} icon="📅" grad={GRAD.amber} value={mix.dowRows.reduce((m, r) => (r.value > m.value ? r : m), mix.dowRows[0]).value ? mix.dowRows.reduce((m, r) => (r.value > m.value ? r : m), mix.dowRows[0]).label : "—"} sub={t("p8fin.faMostSessions")} />
          </div>
          </CollapsibleStats>
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title={t("p8fin.faValueDist")}><Breakdown entries={mix.valueBands} /></Panel>
            <Panel title={t("p8fin.faPassMix")} right={<span className="text-[11px] font-bold text-[var(--ink-3)]">{t("p8fin.faRevenueBookings")}</span>}>
              {mix.passRows.some((r) => r.value > 0) ? <Breakdown entries={mix.passRows} /> : <Empty>{t("p8fin.faNoPasses")}</Empty>}
            </Panel>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title={t("p8fin.faGenderSplit")} right={<Info text={t("p8fin.faGenderInfo")} />}>
              {mix.genderKnown ? (
                <>
                  <Donut
                    segments={[
                      { label: t("p8lst.genBoy"), value: mix.gender.boy, color: LIGHTB },
                      { label: t("p8lst.genGirl"), value: mix.gender.girl, color: PINK },
                      { label: t("p8lst.genOther"), value: mix.gender.other, color: GOLD },
                      { label: t("p8lst.genNa"), value: mix.gender.na, color: "#8a86a3" },
                    ].filter((x) => x.value > 0)}
                    center={String(mix.genderKnown)}
                    sub={t("p8lst.genChildren")}
                  />
                  <div className="mt-3 text-[12px] font-semibold text-[var(--ink-3)]">{t("p8lst.genKnown", { known: mix.genderKnown, total: mix.gender.total })}</div>
                </>
              ) : <Empty>{t("p8lst.genCta")}</Empty>}
            </Panel>
            <Panel title={t("p8fin.faBusiestWeek")}>
              <Breakdown entries={mix.dowRows} />
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}

// Period-on-period change chip for a gradient tile's sub-line (white text).
function Delta({ pct }: { pct: number | null }) {
  const t = useT();
  if (pct == null) return null;
  const up = pct >= 0;
  return <span className="ms-1.5 inline-flex items-center gap-0.5 rounded-full bg-white/20 px-1.5 py-[1px] text-[10.5px] font-extrabold text-white">{up ? "▲" : "▼"} {Math.abs(pct)}% <span className="font-semibold opacity-80">{t("p8fin.faVsPrev")}</span></span>;
}

// A compact figure used inside light panels (not a gradient tile).
function MiniStat({ label, value, tone, isText }: { label: string; value: number | string; tone: string; isText?: boolean }) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5">
      <div className="text-[10.5px] font-bold uppercase tracking-wide text-[var(--ink-3)]">{label}</div>
      <div className="mt-0.5 text-[20px] font-extrabold leading-none tabular-nums" style={{ fontFamily: "var(--ff-display)", color: tone }}>{isText ? value : Number(value).toLocaleString(dl())}</div>
    </div>
  );
}
