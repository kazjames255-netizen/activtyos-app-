"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { get as apiGet } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { money, refundedTotal } from "@/features/bookings/helpers";
import type { Booking } from "@/features/bookings/types";
import { useSettings } from "@/lib/settings";
import { LIGHT_PALETTE } from "@/components/OperatorPage";
import { Badge } from "@/components/ui";

interface Dash {
  today: { date: string; booked: number; sessions: { listing: string; start: string; end: string; booked: number; capacity: number }[] };
  next: { date: string; start: string; end: string; listing: string } | null;
  upcoming: { date: string; start: string; end: string; listing: string; spotsLeft: number }[];
  byListing: { listing: string; capacity: number; booked: number; spotsLeft: number; pct: number; nextDate: string }[];
  bookings: { live: number; newThisWeek: number; waitlist: number };
  occupancy: { booked: number; capacity: number; pct: number };
  money: { takenThisWeek: number; outstanding: number; overdueVouchers: number; awaitingVoucher: number };
  counts: { listings: number; activeBlocks: number };
}

// ── shared bits (visual system lifted from the HQ provider-analytics page) ──
const HERO = "radial-gradient(120% 160% at 12% -30%, rgba(120,170,255,.5) 0%, transparent 55%), linear-gradient(120deg,#16306e 0%,#274ba3 58%,#3f78d8 100%)";
const BLUE = "#1d3a8f", LIGHTB = "#3f78d8", GREEN = "#0f7a43";
const ACT_C = ["#3f78d8", "#0f7a43", "#e2225f", "#7c3aed", "#e88f1f", "#0ea5a0", "#c81e77", "#1d3a8f"];
const STATUS_C: Record<string, string> = { Confirmed: "#1749a8", "Approval needed": "#a85f08", Waitlisted: "#0b8446", Offered: "#0b8446", Cancelled: "#c53030", Declined: "#c53030" };
const PAY_C: Record<string, string> = { Paid: "#0f7a43", Funded: "#0f7a43", Unpaid: "#c9791a", "Invoice sent": "#a85f08", Refunded: "#c53030", "Partially refunded": "#c53030" };
const monthLabel = (k: string) => new Date(`${k}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" });
const mKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
const fmtDay = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
// Compact money for the narrow sparkline columns: £1.2k, £320, £0.
const compactMoney = (n: number) => (n >= 1000 ? `£${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `£${Math.round(n)}`);

// A stable colour per activity name, and an availability tone (green→amber→red).
const actColor = (s: string) => ACT_C[[...(s || "?")].reduce((a, c) => a + c.charCodeAt(0), 0) % ACT_C.length];
const availTone = (left: number, cap: number) =>
  left <= 0 ? { bg: "#fdebec", fg: "#c0392b", label: "full" }
  : left <= Math.max(3, cap * 0.15) ? { bg: "#fdf3d8", fg: "#9a5a00", label: `${left} left` }
  : { bg: "#e2f5ea", fg: "#0b8446", label: `${left} left` };
const isPaid = (b: Booking) => b.pay === "Paid" || b.pay === "Funded";
const collectedOf = (b: Booking) => (isPaid(b) ? Math.max(0, b.amount - refundedTotal(b)) : 0);
const isCancelled = (b: Booking) => b.status === "Cancelled" || b.status === "Declined";
const monthOf = (b: Booking): string | null => {
  const s = b.createdAt || (b.days?.[0] ?? "");
  const m = s.slice(0, 7);
  return /^\d{4}-\d{2}$/.test(m) ? m : null;
};

// Rich, colourful KPI tile — a dark gradient with white figures.
const GRAD = {
  blue: "linear-gradient(135deg,#16306e 0%,#3f78d8 100%)",
  teal: "linear-gradient(135deg,#0e6f8a 0%,#14b8a6 100%)",
  green: "linear-gradient(135deg,#0b6b3a 0%,#2fb56f 100%)",
  pink: "linear-gradient(135deg,#9c1458 0%,#ee1f63 100%)",
  amber: "linear-gradient(135deg,#9a5a12 0%,#f5b81f 100%)",
  violet: "linear-gradient(135deg,#5b21b6 0%,#8b5cf6 100%)",
} as const;
function Tile({ label, value, sub, grad, children }: { label: string; value: string; sub?: React.ReactNode; grad: string; children?: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-2xl p-4 text-white shadow-[0_12px_28px_-16px_rgba(20,30,80,.5)]" style={{ background: grad }}>
      <div className="pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full bg-white/10" />
      <div className="relative">
        <div className="text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-white/70">{label}</div>
        <div className="mt-1 text-[27px] font-extrabold leading-none tabular-nums" style={{ fontFamily: "var(--ff-display)", textShadow: "0 1px 2px rgba(0,0,0,.25)" }}>{value}</div>
        {sub && <div className="mt-1 text-[11px] font-semibold text-white/80">{sub}</div>}
        {children}
      </div>
    </div>
  );
}
// A clean white line sparkline on a coloured tile — money over recent weeks.
function MiniLine({ data, labels, caption }: { data: number[]; labels: string[]; caption: string }) {
  const max = Math.max(1, ...data);
  const W = 320, H = 46, PAD = 6;
  const n = Math.max(1, data.length);
  const x = (i: number) => PAD + (i * (W - 2 * PAD)) / Math.max(1, n - 1);
  const y = (v: number) => H - PAD - (v / max) * (H - 2 * PAD);
  const path = data.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = `${path} L${x(n - 1)},${H - PAD} L${x(0)},${H - PAD} Z`;
  return (
    <div className="mt-3">
      <div className="mb-1 text-[9px] font-bold uppercase tracking-[0.08em] text-white/60">{caption}</div>
      <div className="mb-0.5 flex gap-1 text-[8.5px] font-extrabold tabular-nums text-white/85">{data.map((v, i) => <span key={i} className="flex-1 text-center" style={{ opacity: i === data.length - 1 ? 1 : 0.7 }}>{compactMoney(v)}</span>)}</div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 42 }} preserveAspectRatio="none">
        <defs><linearGradient id="mlg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff" stopOpacity=".28" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></linearGradient></defs>
        <path d={area} fill="url(#mlg)" />
        <path d={path} fill="none" stroke="#fff" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        <circle cx={x(n - 1)} cy={y(data[n - 1] ?? 0)} r={2.6} fill="#fff" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="mt-1 flex gap-1 text-[8.5px] font-semibold text-white/60">{labels.map((l, i) => <span key={i} className="flex-1 text-center">{l}</span>)}</div>
    </div>
  );
}

// A white mini bar chart drawn on a coloured tile — the last few weeks at a glance.
function MiniBars({ data, labels, caption }: { data: number[]; labels: string[]; caption: string }) {
  const max = Math.max(1, ...data);
  return (
    <div className="mt-2.5">
      <div className="mb-1 text-[9px] font-bold uppercase tracking-[0.06em] text-white/70">{caption}</div>
      <div className="flex items-end gap-1" style={{ height: 40 }}>
        {data.map((v, i) => (
          <div key={i} className="flex flex-1 flex-col items-center justify-end" style={{ height: "100%" }} title={`${labels[i]}: ${v}`}>
            <span className="mb-0.5 text-[9px] font-extrabold tabular-nums" style={{ opacity: i === data.length - 1 ? 1 : 0.75 }}>{v}</span>
            <div className="w-full rounded-t-[3px] bg-white" style={{ height: `${Math.max(8, (v / max) * 100)}%`, opacity: i === data.length - 1 ? 1 : 0.5 }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1 text-[8.5px] font-bold text-white/70">{labels.map((l, i) => <span key={i} className="flex-1 text-center">{l}</span>)}</div>
    </div>
  );
}
function Panel({ title, right, children, className = "" }: { title: string; right?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 ${className}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="text-[13px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>{title}</div>
        {right}
      </div>
      {children}
    </div>
  );
}
function Legend({ items }: { items: [string, string][] }) {
  return <div className="flex gap-3 text-[11px] font-bold text-[var(--ink-3)]">{items.map(([l, c]) => <span key={l} className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: c }} />{l}</span>)}</div>;
}
function Empty({ children }: { children: React.ReactNode }) {
  return <div className="py-6 text-center text-[12px] text-[var(--ink-3)]">{children}</div>;
}
function Breakdown({ entries }: { entries: { label: string; value: number; sub: string; color: string }[] }) {
  const max = Math.max(1, ...entries.map((e) => e.value));
  if (!entries.length) return <Empty>Nothing yet.</Empty>;
  return (
    <div className="flex flex-col gap-2.5">
      {entries.map((e) => (
        <div key={e.label}>
          <div className="mb-1 flex items-center justify-between text-[12px]"><span className="min-w-0 flex-1 truncate pr-2 font-semibold">{e.label}</span><span className="whitespace-nowrap text-[var(--ink-3)]">{e.sub}</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-[var(--panel)]"><div className="h-full rounded-full" style={{ width: `${(e.value / max) * 100}%`, background: e.color }} /></div>
        </div>
      ))}
    </div>
  );
}

// Area/line trend with optional 2nd series; hover shows values.
function TrendChart({ series, series2, fmt, color, color2 }: { series: { label: string; value: number }[]; series2?: { label: string; value: number }[]; fmt: (n: number) => string; color: string; color2?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640, H = 168, PAD = 10;
  const pts = [...series.map((p) => p.value), ...(series2?.map((p) => p.value) ?? [])];
  const max = Math.max(1, ...pts);
  const n = Math.max(1, series.length);
  const x = (i: number) => PAD + (i * (W - 2 * PAD)) / Math.max(1, n - 1);
  const y = (v: number) => H - PAD - (v / max) * (H - 2 * PAD);
  const line = (arr: { value: number }[]) => arr.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const areaP = series.length ? `${line(series)} L${x(series.length - 1)},${H - PAD} L${x(0)},${H - PAD} Z` : "";
  const lastVal = series[series.length - 1]?.value ?? 0;
  const s2End = series2 && series2.length ? series2[series2.length - 1] : null;
  const valLabel = (cx: number, cy: number, text: string, fill: string, anchor: "middle" | "end") => {
    const ly = cy < 26 ? cy + 15 : cy - 9;
    const xc = anchor === "end" ? Math.min(cx, W - 2) : Math.max(text.length * 3.4, Math.min(W - text.length * 3.4, cx));
    return <text x={xc} y={ly} fontSize="11" fontWeight="800" fill={fill} stroke="#fff" strokeWidth="3" paintOrder="stroke" textAnchor={anchor}>{text}</text>;
  };
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H + 6}`} className="w-full" style={{ overflow: "visible" }}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); const rel = ((e.clientX - r.left) / r.width) * W; setHover(Math.max(0, Math.min(n - 1, Math.round((rel - PAD) / ((W - 2 * PAD) / Math.max(1, n - 1)))))); }}>
        <defs>
          <linearGradient id="dtg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity="0.22" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient>
        </defs>
        {[1, 0.66, 0.33].map((g) => { const yy = y(max * g); return <g key={g}><line x1={PAD} x2={W - PAD} y1={yy} y2={yy} stroke="var(--line)" strokeWidth="1" /><text x={PAD} y={yy - 3} fontSize="9" fill="var(--ink-3)">{fmt(max * g)}</text></g>; })}
        {areaP && <path d={areaP} fill="url(#dtg)" />}
        <path d={line(series)} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" />
        {series2 && <path d={line(series2)} fill="none" stroke={color2} strokeWidth="2.5" strokeLinejoin="round" />}
        {hover != null && <line x1={x(hover)} x2={x(hover)} y1={PAD} y2={H - PAD} stroke="var(--ink-3)" strokeWidth="1" strokeDasharray="3 3" />}
        <circle cx={x(series.length - 1)} cy={y(lastVal)} r="3.5" fill={color} />
        {valLabel(x(series.length - 1), y(lastVal), fmt(lastVal), color, s2End ? "end" : "middle")}
        {s2End && <><circle cx={x(series2!.length - 1)} cy={y(s2End.value)} r="3.5" fill={color2} />{valLabel(x(series2!.length - 1), y(s2End.value), fmt(s2End.value), color2!, "end")}</>}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-[var(--ink-3)]">{series.filter((_, i) => i % Math.ceil(n / 6) === 0 || i === n - 1).map((p, i) => <span key={i}>{monthLabel(p.label)}</span>)}</div>
      {hover != null && series[hover] && (
        <div className="pointer-events-none absolute -top-1 rounded-lg bg-[var(--ink)] px-2 py-1 text-[11px] font-bold text-white shadow" style={{ left: `${(x(hover) / W) * 100}%`, transform: "translateX(-50%)" }}>
          {monthLabel(series[hover].label)} · {fmt(series[hover].value)}{series2 && series2[hover] ? ` / ${fmt(series2[hover].value)}` : ""}
        </div>
      )}
    </div>
  );
}

export function DashboardApp() {
  const [d, setD] = useState<Dash | null>(null);
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [months, setMonths] = useState(6);
  const [nowMs] = useState(() => Date.now());
  // listingId → seasonId, so bookings can be grouped by season (names in settings).
  const [listingSeason, setListingSeason] = useState<Record<string, string>>({});
  const { settings } = useSettings();
  const seasons = settings.seasons ?? [];

  const load = useCallback(() => {
    apiGet<Dash>("/api/dashboard").then((x) => { setD(x); setError(null); }).catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
    apiGet<Booking[]>("/api/bookings").then(setBookings).catch(() => {});
    apiGet<{ id: string; seasonId?: string | null }[]>("/api/listings?mine=1")
      .then((ls) => setListingSeason(Object.fromEntries((ls ?? []).filter((l) => l.id && l.seasonId).map((l) => [l.id, l.seasonId as string]))))
      .catch(() => {});
  }, []);
  useEffect(load, [load]);
  useRealtime(["bookings", "blocks", "listings", "payments"], load);

  // Everything analytical, computed from the tenant's own bookings.
  const a = useMemo(() => {
    const list = (bookings ?? []).filter((b) => b.status !== "Declined");
    const now = new Date(nowMs);
    const keys: string[] = [];
    for (let i = months - 1; i >= 0; i--) keys.push(mKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))));
    const inWindow = new Set(keys);
    // Last 5 ISO weeks (Mon-start) for the occupancy tile's mini graph.
    const wkMs = (ms: number) => { const dt = new Date(ms); const off = (dt.getUTCDay() + 6) % 7; return Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate() - off); };
    const wkStarts: number[] = [];
    for (let i = 4; i >= 0; i--) wkStarts.push(wkMs(nowMs) - i * 7 * 86400000);
    const weekly = wkStarts.map(() => 0);
    const weeklyIncome = wkStarts.map(() => 0);

    const income = keys.map((k) => ({ label: k, value: 0 }));
    const booked = keys.map((k) => ({ label: k, value: 0 }));
    const byAct = new Map<string, number>();
    const bySeason = new Map<string, number>();
    const seasonName = (b: Booking) => seasons.find((s) => s.id === (b.listingId ? listingSeason[b.listingId] : undefined))?.name ?? "No season";
    const byStatus = new Map<string, number>();
    const payMix = new Map<string, number>();
    const families = new Set<string>();
    let totalCollected = 0, paidCount = 0, bookingsCount = 0;

    for (const b of list) {
      // The last-5-weeks mini graphs are fixed windows, independent of 3/6/12m.
      const ws = b.createdAt || b.days?.[0] || "";
      const t = Date.parse(ws.length === 10 ? `${ws}T00:00:00Z` : ws);
      if (!Number.isNaN(t)) for (let i = 0; i < wkStarts.length; i++) { if (t >= wkStarts[i] && t < wkStarts[i] + 7 * 86400000) { weekly[i]++; weeklyIncome[i] += collectedOf(b); break; } }

      // Everything else honours the selected 3/6/12-month period.
      const m = monthOf(b);
      if (!m || !inWindow.has(m)) continue;
      const i = keys.indexOf(m);
      income[i].value += collectedOf(b);
      if (!isCancelled(b)) booked[i].value += b.amount;
      totalCollected += collectedOf(b);
      if (isPaid(b)) paidCount++;
      if (!isCancelled(b)) bookingsCount++;
      families.add((b.email || b.booker || "").toLowerCase());
      byStatus.set(b.status, (byStatus.get(b.status) ?? 0) + 1);
      payMix.set(b.pay || "—", (payMix.get(b.pay || "—") ?? 0) + 1);
      if (!isCancelled(b) && b.listing) byAct.set(b.listing, (byAct.get(b.listing) ?? 0) + collectedOf(b));
      if (!isCancelled(b)) bySeason.set(seasonName(b), (bySeason.get(seasonName(b)) ?? 0) + collectedOf(b));
    }
    const acts = [...byAct.entries()].sort((x, y) => y[1] - x[1]);
    const seasonRows = [...bySeason.entries()].filter(([, v]) => v > 0 || bySeason.size <= 6).sort((x, y) => y[1] - x[1]);
    const recent = [...list].sort((x, y) => (y.createdAt ?? "").localeCompare(x.createdAt ?? "")).slice(0, 6);

    return {
      income, booked, weekly, weeklyIncome,
      weeklyLabels: wkStarts.map((ms) => new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })),
      kpis: { collected: totalCollected, bookings: bookingsCount, families: [...families].filter(Boolean).length, avg: paidCount ? totalCollected / paidCount : 0 },
      byActivity: acts.slice(0, 6).map(([label, value], i) => ({ label, value, sub: money(value), color: ACT_C[i % ACT_C.length] })),
      bySeason: seasonRows.slice(0, 8).map(([label, value], i) => ({ label, value, sub: money(value), color: ACT_C[i % ACT_C.length] })),
      byStatus: [...byStatus.entries()].map(([label, value]) => ({ label, value, sub: String(value), color: STATUS_C[label] ?? "#8a86a3" })),
      payMix: [...payMix.entries()].map(([label, value]) => ({ label, value, sub: String(value), color: PAY_C[label] ?? "#8a86a3" })),
      recent,
    };
  }, [bookings, months, nowMs, listingSeason, seasons]);

  if (error) return <div className="p-2 text-[12.5px] text-[var(--red)]">{error}</div>;
  if (!d) return <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">Loading…</div>;

  return (
    <div className="-m-3 min-h-[calc(100vh-3.5rem)] p-3 sm:-m-5 sm:p-5 text-[var(--ink)]" style={LIGHT_PALETTE}>
      {/* Hero */}
      <div className="overflow-hidden rounded-2xl text-white" style={{ background: HERO }}>
        <div className="flex flex-wrap items-end justify-between gap-3 px-6 py-5">
          <div>
            <div className="text-[11px] font-extrabold uppercase tracking-[0.12em]" style={{ color: "#ffd23f" }}>Your business</div>
            <h2 className="mt-0.5 text-[25px] font-extrabold" style={{ fontFamily: "var(--ff-display)", color: "#fff" }}>📊 Dashboard</h2>
            <p className="mt-1 max-w-[620px] text-[12.5px] leading-snug text-white/85">Today at a glance, plus income, bookings and where they&rsquo;re coming from.</p>
          </div>
          {/* On-site-today summary, on the right of the title banner. */}
          <div className="rounded-2xl bg-white/12 px-4 py-3 text-right ring-1 ring-white/15">
            <div className="text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-white/75">On site today</div>
            <div className="text-[30px] font-extrabold leading-none text-white" style={{ fontFamily: "var(--ff-display)" }}>{d.today.booked}</div>
            <div className="mt-1 text-[11.5px] font-semibold text-white/85">{d.today.sessions.length} session{d.today.sessions.length === 1 ? "" : "s"} running</div>
          </div>
        </div>
      </div>

      {/* Live operational KPIs (from /api/dashboard) */}
      <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="New bookings" value={`${a.weekly.reduce((s, v) => s + v, 0)}`} sub="in the last 5 weeks" grad={GRAD.blue}>
          {bookings && <MiniBars data={a.weekly} labels={a.weeklyLabels} caption="per week" />}
        </Tile>
        <Tile
          label="Spaces left · live listings"
          value={`${Math.max(0, d.occupancy.capacity - d.occupancy.booked)}`}
          sub={`${100 - d.occupancy.pct}% not filled · ${d.occupancy.booked}/${d.occupancy.capacity} taken on open runs`}
          grad={GRAD.teal}
        />
        <Tile label="Taken this week" value={money(d.money.takenThisWeek)} sub={`${d.bookings.newThisWeek} new booking${d.bookings.newThisWeek === 1 ? "" : "s"}`} grad={GRAD.green}>
          {bookings && <MiniLine data={a.weeklyIncome} labels={a.weeklyLabels} caption="Collected · last 5 weeks" />}
        </Tile>
        <Tile
          label="Outstanding"
          value={money(d.money.outstanding)}
          sub={
            d.money.overdueVouchers ? `${d.money.overdueVouchers} overdue voucher${d.money.overdueVouchers === 1 ? "" : "s"}`
            : d.money.awaitingVoucher ? `${d.money.awaitingVoucher} awaiting voucher payment`
            : d.money.outstanding > 0 ? "unpaid / invoiced — awaiting payment"
            : "all settled"
          }
          grad={d.money.outstanding > 0 ? GRAD.pink : GRAD.green}
        />
      </div>

      {/* Today + Coming up (unchanged) */}
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Panel title={`☀️ Today · ${fmtDay(d.today.date)}`} right={d.bookings.waitlist > 0 ? <Badge tone={{ bg: "#fdf3d8", fg: "#9a5a00" }}>{d.bookings.waitlist} on waitlist</Badge> : undefined}>
          {d.today.sessions.length === 0 ? (
            <div className="py-4 text-center text-[12.5px] text-[var(--ink-3)]">Nothing running today.</div>
          ) : (
            <div className="flex flex-col gap-2">
              {d.today.sessions.map((s, i) => {
                const c = actColor(s.listing);
                const pct = s.capacity ? Math.round((s.booked / s.capacity) * 100) : 0;
                return (
                  <div key={i} className="flex items-center gap-3 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5" style={{ borderLeft: `4px solid ${c}` }}>
                    <span className="rounded-lg px-2 py-1 text-[11.5px] font-extrabold tabular-nums text-white" style={{ background: c }}>{s.start}–{s.end}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-extrabold text-[var(--ink)]">{s.listing}</div>
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--panel)]"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: c }} /></div>
                    </div>
                    <div className="text-right">
                      <div className="text-[13px] font-extrabold tabular-nums text-[var(--ink)]">{s.booked}/{s.capacity}</div>
                      <div className="text-[10px] font-bold text-[var(--ink-3)]">{pct}% full</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
        <Panel title="🎟️ Live listings · places left">
          {d.byListing.length === 0 ? (
            <div className="py-4 text-center text-[12.5px] text-[var(--ink-3)]">No open listings running.</div>
          ) : (
            <div className="flex flex-col gap-2">
              {d.byListing.map((l, i) => {
                const c = actColor(l.listing);
                const t = availTone(l.spotsLeft, l.capacity);
                return (
                  <div key={i} className="flex items-center gap-3 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5" style={{ borderLeft: `4px solid ${c}` }}>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-extrabold text-[var(--ink)]">{l.listing}</div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--panel)]"><div className="h-full rounded-full" style={{ width: `${l.pct}%`, background: c }} /></div>
                        <span className="whitespace-nowrap text-[11px] font-bold text-[var(--ink-3)]">from {fmtDay(l.nextDate)}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[13px] font-extrabold tabular-nums text-[var(--ink)]">{l.booked}/{l.capacity}</div>
                      <div className="text-[10px] font-bold text-[var(--ink-3)]">{l.pct}% full</div>
                    </div>
                    <span className="whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-extrabold" style={{ background: t.bg, color: t.fg }}>{t.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>

      {/* ── Business analytics (computed from your bookings) ── */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
        <div className="text-[15px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>Business analytics</div>
        <div className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--surface)] p-1 text-[12px] font-bold">
          {[3, 6, 12].map((m) => (
            <button key={m} type="button" onClick={() => setMonths(m)} className="rounded-full px-3 py-1 transition-colors" style={months === m ? { background: BLUE, color: "#fff" } : { color: "var(--ink-3)" }}>{m}m</button>
          ))}
        </div>
      </div>

      {!bookings ? (
        <div className="mt-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] py-8 text-center text-[12.5px] text-[var(--ink-3)]">Loading your figures…</div>
      ) : (
        <>
          <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            <Tile label="Income collected" value={money(a.kpis.collected)} sub={`last ${months}m · net of refunds`} grad={GRAD.green} />
            <Tile label="Bookings" value={`${a.kpis.bookings}`} sub={`booked in last ${months}m (excl. cancelled)`} grad={GRAD.blue} />
            <Tile label="Families" value={`${a.kpis.families}`} sub={`unique customers · last ${months}m`} grad={GRAD.violet} />
            <Tile label="Avg booking" value={money(a.kpis.avg)} sub="per paid booking" grad={GRAD.amber} />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Panel title="Income by month" right={<Legend items={[["Collected", GREEN]]} />}>
              <TrendChart series={a.income} fmt={money} color={GREEN} />
            </Panel>
            <Panel title="Booked vs collected" right={<Legend items={[["Booked", LIGHTB], ["Collected", GREEN]]} />}>
              <TrendChart series={a.booked} series2={a.income} fmt={money} color={LIGHTB} color2={GREEN} />
            </Panel>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Panel title="Revenue by season">
              {seasons.length === 0
                ? <Empty>Set up your seasons in Setup to see this.</Empty>
                : <Breakdown entries={a.bySeason} />}
            </Panel>
            <Panel title="Revenue by activity">
              <Breakdown entries={a.byActivity} />
            </Panel>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <Panel title="Bookings by status"><Breakdown entries={a.byStatus} /></Panel>
            <Panel title="Payment mix"><Breakdown entries={a.payMix} /></Panel>
            <Panel title="🆕 Newest bookings">
              {a.recent.length ? (
                <div className="flex flex-col divide-y divide-[var(--line)]">
                  {a.recent.map((b) => (
                    <div key={`${b.tenantId}-${b.ref}`} className="flex items-center gap-2 py-2 text-[12.5px]">
                      <span className="min-w-0 flex-1 truncate"><b>{b.child || b.booker}</b> <span className="text-[var(--ink-3)]">· {b.listing}</span></span>
                      <span className="whitespace-nowrap font-extrabold tabular-nums">{money(b.amount)}</span>
                    </div>
                  ))}
                </div>
              ) : <Empty>No bookings yet.</Empty>}
            </Panel>
          </div>
        </>
      )}

      <div className="mt-4 text-[11.5px] text-[var(--ink-3)]">{d.counts.listings} listing{d.counts.listings === 1 ? "" : "s"} · {d.counts.activeBlocks} active run{d.counts.activeBlocks === 1 ? "" : "s"} · {d.bookings.live} live booking{d.bookings.live === 1 ? "" : "s"}</div>
    </div>
  );
}
