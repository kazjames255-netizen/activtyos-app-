"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { get as apiGet, post as apiPost } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { collectedNet, refundedGross, owedOf } from "@/features/bookings/helpers";
import type { Booking } from "@/features/bookings/types";
import { LIGHT_PALETTE, PageHero, TabStrip } from "@/components/OperatorPage";
import { useSettings } from "@/lib/settings";
import { SeasonPicker } from "@/components/SeasonPicker";
import {
  GRAD, ACT_C, money, compactMoney, colorFor,
  Tile, Ring, Donut, Breakdown, Panel, Legend, Empty, Info, TrendChart,
} from "./finance-kit";

// ── Types for the extra ledgers we fold in (subset of each route's shape) ──
interface Invoice { id: string; customerName: string; amount: number; date: string; dueDate?: string; status: string; overdue?: boolean }
interface InvPayload { items: Invoice[]; summary: { count: number; outstanding: number; collected: number; overdue: number } }
interface PaymentRecord { id: string; refs?: string[]; email?: string; method?: string; amount: number; type?: string; status: string; createdAt: string }
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
const VALUE_BANDS: [string, number, number][] = [["£0–25", 0, 25], ["£25–50", 25, 50], ["£50–100", 50, 100], ["£100–200", 100, 200], ["£200+", 200, Infinity]];
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function FinanceAnalyticsApp() {
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
  const [childSex, setChildSex] = useState<Record<string, "boy" | "girl">>({}); // learner name → sex
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
    apiGet<Booking[]>("/api/bookings").then((b) => { setBookings(Array.isArray(b) ? b : []); setError(null); }).catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
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
      setAddonMeta(Object.fromEntries((lib?.addons ?? []).map((x) => [x.id, { name: x.name || "Add-on", price: Number(x.price) || 0 }])));
    }).catch(() => {});
    // Child sex lives on the customer/child record (a booking learner links by
    // name), so the gender split needs the customers list. Empty if not collected.
    apiGet<{ children?: { name?: string; sex?: "boy" | "girl" }[] }[]>("/api/customers")
      .then((cs) => {
        const m: Record<string, "boy" | "girl"> = {};
        for (const c of cs ?? []) for (const k of c.children ?? []) if (k.name && (k.sex === "boy" || k.sex === "girl")) m[k.name.trim().toLowerCase()] = k.sex;
        setChildSex(m);
      }).catch(() => {});
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
    const all = (bookings ?? []).filter((b) =>
      b.status !== "Declined" && b.status !== "Waitlisted"
      && (!season || listingSeason[b.listingId ?? ""] === season)
      && (!venue || listingVenueId[b.listingId ?? ""] === venue));
    const now = new Date(nowMs);
    const keys: string[] = [];
    for (let i = months - 1; i >= 0; i--) keys.push(mKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))));
    const inWindow = new Set(keys);
    const windowStart = `${keys[0]}-01`;
    // The equal-length window immediately before, for period-on-period deltas.
    const prevKeys = new Set<string>();
    for (let i = 2 * months - 1; i >= months; i--) prevKeys.add(mKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))));

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
    // Keyed by listingId so same-named listings don't merge; carries venue.
    const byListing = new Map<string, { name: string; venue?: string; value: number }>();
    const byBooker = new Map<string, { name: string; value: number }>();
    const bookersInWin = new Set<string>();
    const learnersInWin = new Set<string>();
    const ages: number[] = [];
    const owing: { ref: string; name: string; listing: string; owed: number; when: string }[] = [];
    let booked = 0, collected = 0, refunds = 0, owed = 0, paidBookings = 0, paidSessions = 0, freeSessions = 0;
    let prevCollected = 0, prevBooked = 0;
    let newBookers = 0, returningBookers = 0, newLearners = 0, returningLearners = 0;
    const seenBooker = new Set<string>(), seenLearner = new Set<string>();

    for (const b of all) {
      const m = monthOf(b);
      if (m && prevKeys.has(m)) { prevCollected += collectedNet(b); if (!isCancelled(b)) prevBooked += b.amount; }
      if (!m || !inWindow.has(m)) continue;
      const i = keys.indexOf(m);
      const col = collectedNet(b);
      if (!isCancelled(b)) { bookedByMonth[i].value += b.amount; booked += b.amount; }
      collectedByMonth[i].value += col; collected += col;
      refunds += refundedGross(b);
      if (!isCancelled(b)) { const o = owedOf(b); owed += o; if (o > 0) owing.push({ ref: b.ref, name: b.booker || b.email || "—", listing: b.listing || "", owed: o, when: b.createdAt || b.days?.[0] || "" }); }
      if (col > 0) { paidBookings++; bySource.set(SOURCE_OF(b), (bySource.get(SOURCE_OF(b)) ?? 0) + col); }
      if (!isCancelled(b) && (b.listingId || b.listing)) {
        const key = b.listingId || b.listing!;
        const cur = byListing.get(key) ?? { name: b.listing || "—", venue: b.listingId ? listingVenue[b.listingId] : undefined, value: 0 };
        cur.value += col; byListing.set(key, cur);
      }
      if (col > 0) { const cur = byBooker.get(bookerKey(b)) ?? { name: b.booker || b.email || "—", value: 0 }; cur.value += col; byBooker.set(bookerKey(b), cur); }
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
    const topListings = [...byListing.values()].sort((x, y) => y.value - x.value).slice(0, 8).map((v, i) => ({ label: v.name, venue: v.venue, value: v.value, sub: money(v.value), color: ACT_C[i % ACT_C.length] }));
    const topCustomers = [...byBooker.values()].sort((x, y) => y.value - x.value).slice(0, 8).map((v, i) => ({ label: v.name, value: v.value, sub: money(v.value), color: ACT_C[i % ACT_C.length] }));
    const sourceRows = [...bySource.entries()].sort((x, y) => y[1] - x[1]);
    // Period-on-period change (this window vs the one before it).
    const pctChange = (cur: number, prev: number) => (prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null);

    return {
      keys, windowStart,
      bookedByMonth, collectedByMonth,
      booked, collected, refunds, owed, net: collected - fees, fees,
      prevCollected, prevBooked, collectedDelta: pctChange(collected, prevCollected), bookedDelta: pctChange(booked, prevBooked),
      inTransit, inBank,
      source: sourceRows.map(([label, value]) => ({ label, value, color: label.startsWith("Childcare") ? GREEN : label === "Card" ? BLUE : colorFor(label) })),
      topListings, topCustomers,
      owing: owing.sort((x, y) => y.owed - x.owed),
      totalBookers: bookersInWin.size, totalLearners: learnersInWin.size,
      newBookers, returningBookers, newLearners, returningLearners,
      paidSessions, freeSessions,
      spendPerCustomer: bookersInWin.size ? collected / bookersInWin.size : 0,
      ageDist, paidBookings,
    };
  }, [bookings, months, nowMs, season, venue, listingSeason, listingVenue, listingVenueId]);

  // Add-ons · value · pass · gender · day-of-week — the extra comparisons, same
  // filters/window as `a`, kept separate to keep each concern legible.
  const mix = useMemo(() => {
    const all = (bookings ?? []).filter((b) =>
      b.status !== "Declined" && b.status !== "Waitlisted"
      && (!season || listingSeason[b.listingId ?? ""] === season)
      && (!venue || listingVenueId[b.listingId ?? ""] === venue));
    const now = new Date(nowMs);
    const inWindow = new Set<string>();
    for (let i = months - 1; i >= 0; i--) inWindow.add(mKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))));

    const addonCount = new Map<string, number>();
    const byPass = new Map<string, { count: number; revenue: number }>();
    const gender = { boy: 0, girl: 0, unknown: 0 };
    const dow = [0, 0, 0, 0, 0, 0, 0];
    const amounts: number[] = [];
    const seenLearner = new Set<string>();
    let winBookings = 0, bookingsWithAddon = 0, addonUnits = 0, addonRevenue = 0;

    for (const b of all) {
      const m = monthOf(b);
      if (!m || !inWindow.has(m) || isCancelled(b)) continue;
      winBookings++;
      amounts.push(b.amount);
      if (b.pass) { const p = byPass.get(b.pass) ?? { count: 0, revenue: 0 }; p.count++; p.revenue += collectedNet(b); byPass.set(b.pass, p); }
      const ad = b.addons ?? [];
      if (ad.length) bookingsWithAddon++;
      for (const id of ad) { addonCount.set(id, (addonCount.get(id) ?? 0) + 1); addonUnits++; addonRevenue += addonMeta[id]?.price ?? 0; }
      for (const d of b.days ?? []) { const wd = new Date(`${d}T00:00:00Z`).getUTCDay(); if (wd >= 0 && wd <= 6) dow[wd]++; }
      for (const ln of learnerNames(b)) { const k = ln.toLowerCase(); if (seenLearner.has(k)) continue; seenLearner.add(k); const s = childSex[k]; if (s === "boy") gender.boy++; else if (s === "girl") gender.girl++; else gender.unknown++; }
    }

    const valueBands = VALUE_BANDS.map(([label, lo, hi], i) => { const n = amounts.filter((v) => v >= lo && v < hi).length; return { label, value: n, sub: String(n), color: ACT_C[i % ACT_C.length] }; });
    const topAddons = [...addonCount.entries()].map(([id, count]) => ({ label: addonMeta[id]?.name ?? "Add-on", count, rev: (addonMeta[id]?.price ?? 0) * count })).sort((x, y) => y.rev - x.rev || y.count - x.count).slice(0, 8)
      .map((r, i) => ({ label: r.label, value: r.rev, sub: `${money(r.rev)} · ${r.count} sold`, color: ACT_C[i % ACT_C.length] }));
    const passRows = [...byPass.entries()].sort((x, y) => y[1].revenue - x[1].revenue).slice(0, 8).map(([label, v], i) => ({ label, value: v.revenue, sub: `${money(v.revenue)} · ${v.count}`, color: ACT_C[i % ACT_C.length] }));
    const dowRows = DOW.map((label, i) => ({ label, value: dow[i], sub: String(dow[i]), color: LIGHTB }));

    return {
      winBookings,
      attachRate: winBookings ? Math.round((bookingsWithAddon / winBookings) * 100) : 0,
      bookingsWithAddon, addonUnits, addonRevenue, topAddons,
      avgBookingValue: amounts.length ? amounts.reduce((s, v) => s + v, 0) / amounts.length : 0,
      medianValue: amounts.length ? [...amounts].sort((x, y) => x - y)[Math.floor(amounts.length / 2)] : 0,
      valueBands, passRows,
      gender, genderKnown: gender.boy + gender.girl,
      dowRows,
    };
  }, [bookings, months, nowMs, season, venue, listingSeason, listingVenueId, addonMeta, childSex]);

  // ref → booker name, so a payout row can name who paid (payments carry only refs).
  const nameByRef = useMemo(() => {
    const m = new Map<string, string>();
    for (const b of bookings ?? []) if (b.ref) m.set(b.ref, b.booker || b.email || "");
    return m;
  }, [bookings]);
  const payerName = (p: PaymentRecord) => (p.refs ?? []).map((r) => nameByRef.get(r)).find(Boolean) || p.email || "—";

  // Export the filtered, in-window bookings an accountant would want — one row
  // per booking with the money broken out. Honours the Season/Location filters.
  function exportCSV() {
    const cell = (v: unknown) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const rows = (bookings ?? []).filter((b) =>
      b.status !== "Declined" && b.status !== "Waitlisted"
      && (!season || listingSeason[b.listingId ?? ""] === season)
      && (!venue || listingVenueId[b.listingId ?? ""] === venue)
      && (() => { const m = monthOf(b); return m != null && a.keys.includes(m); })());
    const header = ["Ref", "Date", "Family", "Email", "Listing", "Location", "Status", "Method", "Booked", "Collected", "Owed"];
    const body = rows.map((b) => [b.ref, (b.createdAt || b.days?.[0] || "").slice(0, 10), b.booker, b.email, b.listing, (b.listingId ? listingVenue[b.listingId] : "") || "", b.status, b.method || "", b.amount, collectedNet(b), owedOf(b)].map(cell).join(","));
    const blob = new Blob([[header.join(","), ...body].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = `finance-${a.keys[0]}-to-${a.keys[a.keys.length - 1]}.csv`;
    link.click(); URL.revokeObjectURL(url);
  }

  const rangeLabel = useMemo(() => {
    const start = new Date(`${a.windowStart}T00:00:00Z`);
    const fmt = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
    return `${fmt(start)} – ${fmt(new Date(nowMs))}`;
  }, [a.windowStart, nowMs]);

  if (error) return <div className="p-4 text-[12.5px] text-[var(--red)]">{error}</div>;
  const loading = bookings === null;

  const periodToggle = (
    <div className="flex items-center gap-2">
      <div className="inline-flex items-center gap-1 rounded-full bg-white/15 p-1 text-[12px] font-bold text-white">
        {[3, 6, 12].map((m) => (
          <button key={m} type="button" onClick={() => setMonths(m)} className="rounded-full px-3 py-1 transition-colors" style={months === m ? { background: "#fff", color: BLUE } : { color: "rgba(255,255,255,.85)" }}>{m}m</button>
        ))}
      </div>
      <button type="button" onClick={exportCSV} title="Download the filtered bookings as CSV" className="rounded-full bg-white/15 px-3 py-1.5 text-[12px] font-bold text-white hover:bg-white/25">⬇ CSV</button>
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
        tabs={[["overview", "Overview"], ["revenue", "Revenue"], ["payouts", "Payouts"], ["debts", "Debts"], ["insights", "Insights"]]}
        value={tab}
        onChange={(t) => { setTabTouched(true); setTab(t); }}
      />

      {/* Filter bar — Season + Location scope every figure below. Hidden when the
          tenant has neither set up, so single-site freelancers see no clutter. */}
      {(seasons.length > 0 || venues.length > 0) && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Filter</span>
          <SeasonPicker seasons={seasons} value={season} onChange={setSeason} allLabel="All seasons" />
          {venues.length > 0 && (
            <select value={venue} onChange={(e) => setVenue(e.target.value)} className="rounded-lg border border-[var(--line)] bg-white px-2.5 py-1.5 text-[12px] font-bold text-[var(--ink-2)] outline-none focus:border-[#2f6bd8]">
              <option value="">📍 All locations</option>
              {venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          )}
          {(season || venue) && <button type="button" onClick={() => { setSeason(""); setVenue(""); }} className="text-[11.5px] font-bold text-[var(--ink-3)] hover:text-[var(--ink)] hover:underline">Reset</button>}
        </div>
      )}

      {/* Insights sub-sections — one hub instead of three top tabs. */}
      {tab === "insights" && !loading && (
        <div className="mb-3 inline-flex flex-wrap gap-1 rounded-full bg-white p-1 shadow-sm">
          {([["customers", "👤 Customers & learners"], ["addons", "🧩 Add-ons"], ["value", "📊 Value & mix"]] as [typeof insTab, string][]).map(([k, l]) => (
            <button key={k} type="button" onClick={() => setInsTab(k)} className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-bold ${insTab === k ? "bg-[#1d3a8f] text-white" : "text-[var(--ink-2)] hover:bg-[#f2f5fb]"}`}>{l}</button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center text-[12.5px] text-[var(--ink-3)]">Loading your figures…</div>
      ) : tab === "overview" ? (
        <div className="flex flex-col gap-4">
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            <Tile label="Revenue collected" icon="💰" grad={GRAD.green} value={money(a.collected)} sub={<>of {money(a.booked)} booked<Delta pct={a.collectedDelta} /></>} aside={<Ring pct={a.booked ? (a.collected / a.booked) * 100 : 0} label={`${a.booked ? Math.round((a.collected / a.booked) * 100) : 0}%`} />} />
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
            <Tile label="Total booked" icon="🎫" grad={GRAD.blue} value={money(a.booked)} sub={<><span>{months}-month value</span><Delta pct={a.bookedDelta} /></>} />
            <Tile label="Collected" icon="✅" grad={GRAD.green} value={money(a.collected)} sub={<><span>paid &amp; funded</span><Delta pct={a.collectedDelta} /></>} />
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
                <table className="w-full min-w-[640px] text-[12.5px]">
                  <thead><tr className="border-b border-[var(--line)] text-left text-[10.5px] uppercase tracking-wide text-[var(--ink-3)]"><th className="py-2 font-bold">Date</th><th className="font-bold">Paid by</th><th className="font-bold">Method</th><th className="font-bold">Reference</th><th className="font-bold">Status</th><th className="py-2 text-right font-bold">Amount</th></tr></thead>
                  <tbody>
                    {payments.filter((p) => p.type !== "refund").slice(0, 40).map((p) => (
                      <tr key={p.id} className="border-b border-[var(--line)]">
                        <td className="py-2 text-[var(--ink-2)]">{new Date(p.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</td>
                        <td className="font-semibold text-[var(--ink)]">{payerName(p)}</td>
                        <td className="text-[var(--ink-2)]">{p.method || "Card"}</td>
                        <td className="text-[var(--ink-3)]">{p.refs?.join(", ") || "—"}</td>
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
          <Panel title="Who owes you" right={<span className="text-[11px] font-bold text-[var(--ink-3)]">{a.owing.length} booking{a.owing.length === 1 ? "" : "s"} · {money(a.owed)}</span>}>
            {a.owing.length ? (
              <div className="flex flex-col divide-y divide-[var(--line)]">
                {a.owing.slice(0, 30).map((o) => (
                  <div key={o.ref} className="flex items-center gap-3 py-2.5 text-[12.5px]">
                    <span className="min-w-0 flex-1 truncate"><b>{o.name}</b>{o.listing && <span className="text-[var(--ink-3)]"> · {o.listing}</span>}</span>
                    <span className="hidden whitespace-nowrap text-[11px] text-[var(--ink-3)] sm:inline">{o.when ? new Date(o.when.length === 10 ? `${o.when}T00:00:00` : o.when).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : ""}</span>
                    <span className="w-20 text-right font-extrabold tabular-nums text-[#c02636]">{money(o.owed)}</span>
                    <button type="button" onClick={() => router.push(`/${portal}/bookings?ref=${encodeURIComponent(o.ref)}`)} className="rounded-full border border-[var(--line)] bg-white px-2.5 py-1 text-[11px] font-bold text-[var(--ink-2)] hover:border-[#1d3a8f] hover:text-[#1d3a8f]">Chase / view →</button>
                  </div>
                ))}
                {a.owing.length > 30 && <div className="pt-2 text-center text-[11px] text-[var(--ink-3)]">+{a.owing.length - 30} more — showing the 30 largest.</div>}
              </div>
            ) : <Empty>Nobody owes you right now — everything&rsquo;s collected. 🎉</Empty>}
          </Panel>
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
      ) : tab === "insights" && insTab === "customers" ? (
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
            <Panel title="Top customers by spend"><Breakdown entries={a.topCustomers} /></Panel>
            <Panel title="New vs returning learners">
              {a.totalLearners ? <Donut segments={[{ label: "Returning", value: a.returningLearners, color: PINK }, { label: "New", value: a.newLearners, color: LIGHTB }]} center={`${a.totalLearners ? Math.round((a.returningLearners / a.totalLearners) * 100) : 0}%`} sub="returning" /> : <Empty>No learners yet.</Empty>}
            </Panel>
          </div>
          <Panel title="Revenue over time" right={<Legend items={[["Collected", GREEN]]} />}>
            <TrendChart series={a.collectedByMonth} fmt={compactMoney} color={GREEN} />
          </Panel>
        </div>
      ) : tab === "insights" && insTab === "addons" ? (
        <div className="flex flex-col gap-4">
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            <Tile label="Add-on revenue (est.)" icon="🧩" grad={GRAD.violet} value={money(mix.addonRevenue)} sub="from paid add-ons" />
            <Tile label="Attach rate" icon="📈" grad={GRAD.blue} value={`${mix.attachRate}%`} sub="of bookings add an extra" aside={<Ring pct={mix.attachRate} label={`${mix.attachRate}%`} />} />
            <Tile label="Add-ons sold" icon="🛒" grad={GRAD.teal} value={String(mix.addonUnits)} sub="units in period" />
            <Tile label="Bookings w/ add-ons" icon="✅" grad={GRAD.green} value={String(mix.bookingsWithAddon)} sub={`of ${mix.winBookings} bookings`} />
          </div>
          <Panel title="Top add-ons by revenue" right={<span className="text-[11px] font-bold text-[var(--ink-3)]">est. price × units sold</span>}>
            {mix.topAddons.length ? <Breakdown entries={mix.topAddons} /> : <Empty>No add-ons sold yet — create them in the listing builder&rsquo;s Add-ons step, and they&rsquo;ll show here once booked.</Empty>}
          </Panel>
          <div className="rounded-lg bg-[#eef2fb] px-3 py-2 text-[11px] text-[#1d3a8f]">Add-on revenue is estimated (each add-on&rsquo;s library price × times booked); meals ride the add-on lines too.</div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            <Tile label="Avg booking value" icon="🧮" grad={GRAD.blue} value={money(mix.avgBookingValue)} sub={`across ${mix.winBookings} bookings`} />
            <Tile label="Median booking" icon="📊" grad={GRAD.teal} value={money(mix.medianValue)} sub="typical basket" />
            <Tile label="Boys : girls" icon="🚻" grad={GRAD.violet} value={mix.genderKnown ? `${Math.round((mix.gender.boy / mix.genderKnown) * 100)}:${Math.round((mix.gender.girl / mix.genderKnown) * 100)}` : "—"} sub={mix.genderKnown ? `${mix.genderKnown} with gender set` : "no gender recorded"} />
            <Tile label="Busiest day" icon="📅" grad={GRAD.amber} value={mix.dowRows.reduce((m, r) => (r.value > m.value ? r : m), mix.dowRows[0]).value ? mix.dowRows.reduce((m, r) => (r.value > m.value ? r : m), mix.dowRows[0]).label : "—"} sub="most sessions" />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Booking value distribution"><Breakdown entries={mix.valueBands} /></Panel>
            <Panel title="Pass / ticket mix" right={<span className="text-[11px] font-bold text-[var(--ink-3)]">revenue · bookings</span>}>
              {mix.passRows.some((r) => r.value > 0) ? <Breakdown entries={mix.passRows} /> : <Empty>No paid passes yet.</Empty>}
            </Panel>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Gender split" right={<Info text="From each child's recorded sex (Setup → collect gender). Learners with none set aren't counted." />}>
              {mix.genderKnown ? <Donut segments={[{ label: "Boys", value: mix.gender.boy, color: LIGHTB }, { label: "Girls", value: mix.gender.girl, color: PINK }]} center={`${Math.round((mix.gender.boy / mix.genderKnown) * 100)}%`} sub="boys" /> : <Empty>No gender recorded — turn on &ldquo;collect gender&rdquo; in Setup to compare.</Empty>}
            </Panel>
            <Panel title="Busiest days of the week">
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
  if (pct == null) return null;
  const up = pct >= 0;
  return <span className="ml-1.5 inline-flex items-center gap-0.5 rounded-full bg-white/20 px-1.5 py-[1px] text-[10.5px] font-extrabold text-white">{up ? "▲" : "▼"} {Math.abs(pct)}% <span className="font-semibold opacity-80">vs prev</span></span>;
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
