"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { get as apiGet } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { money, refundedTotal } from "@/features/bookings/helpers";
import type { Booking } from "@/features/bookings/types";
import { LIGHT_PALETTE } from "@/components/OperatorPage";
import { Badge, Card } from "@/components/ui";

interface Dash {
  today: { date: string; booked: number; sessions: { listing: string; start: string; end: string; booked: number; capacity: number }[] };
  next: { date: string; start: string; end: string; listing: string } | null;
  upcoming: { date: string; start: string; end: string; listing: string; spotsLeft: number }[];
  bookings: { live: number; newThisWeek: number; waitlist: number };
  occupancy: { booked: number; capacity: number; pct: number };
  money: { takenThisWeek: number; outstanding: number; overdueVouchers: number; awaitingVoucher: number };
  counts: { listings: number; activeBlocks: number };
}

// ── shared bits (visual system lifted from the HQ provider-analytics page) ──
const HERO = "radial-gradient(120% 160% at 12% -30%, rgba(120,170,255,.5) 0%, transparent 55%), linear-gradient(120deg,#16306e 0%,#274ba3 58%,#3f78d8 100%)";
const BLUE = "#1d3a8f", LIGHTB = "#3f78d8", GOLD = "#f0b100", PINK = "#EE1F63", GREEN = "#0f7a43";
const ACT_C = ["#3f78d8", "#0f7a43", "#e2225f", "#7c3aed", "#e88f1f", "#0ea5a0", "#c81e77", "#1d3a8f"];
const STATUS_C: Record<string, string> = { Confirmed: "#1749a8", "Approval needed": "#a85f08", Waitlisted: "#0b8446", Offered: "#0b8446", Cancelled: "#c53030", Declined: "#c53030" };
const PAY_C: Record<string, string> = { Paid: "#0f7a43", Funded: "#0f7a43", Unpaid: "#c9791a", "Invoice sent": "#a85f08", Refunded: "#c53030", "Partially refunded": "#c53030" };
const monthLabel = (k: string) => new Date(`${k}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" });
const mKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
const fmtDay = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

const isPaid = (b: Booking) => b.pay === "Paid" || b.pay === "Funded";
const collectedOf = (b: Booking) => (isPaid(b) ? Math.max(0, b.amount - refundedTotal(b)) : 0);
const isCancelled = (b: Booking) => b.status === "Cancelled" || b.status === "Declined";
const monthOf = (b: Booking): string | null => {
  const s = b.createdAt || (b.days?.[0] ?? "");
  const m = s.slice(0, 7);
  return /^\d{4}-\d{2}$/.test(m) ? m : null;
};

function Stat({ label, value, sub, tone, accent }: { label: string; value: string; sub?: string; tone?: "warn"; accent?: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
      <div className="absolute left-0 top-0 h-full w-1" style={{ background: tone === "warn" ? "var(--red,#e21d27)" : accent ?? BLUE }} />
      <div className="pl-1.5">
        <div className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">{label}</div>
        <div className="mt-1 text-[26px] font-extrabold leading-none tabular-nums" style={{ fontFamily: "var(--ff-display)", color: tone === "warn" ? "var(--red,#e21d27)" : "var(--ink)" }}>{value}</div>
        {sub && <div className="mt-1.5 text-[11.5px] text-[var(--ink-3)]">{sub}</div>}
      </div>
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
function BookingBars({ data }: { data: { month: string; count: number; cumulative: number }[] }) {
  const maxC = Math.max(1, ...data.map((x) => x.count));
  const maxCum = Math.max(1, ...data.map((x) => x.cumulative));
  const W = 640, H = 170, BOT = 14;
  const plot = H - 24 - BOT;
  const bw = (W - 16) / Math.max(1, data.length);
  const barW = Math.min(bw * 0.6, 46);
  const by = (v: number) => H - BOT - (v / maxC) * plot;
  const cy = (v: number) => H - BOT - (v / maxCum) * plot;
  const cx = (i: number) => 8 + i * bw + bw / 2;
  const total = data[data.length - 1]?.cumulative ?? 0;
  const cumPath = data.map((x, i) => `${i === 0 ? "M" : "L"}${cx(i)},${cy(x.cumulative)}`).join(" ");
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ overflow: "visible" }}>
        <defs>
          <linearGradient id="dbar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#5aa0f0" /><stop offset="1" stopColor={LIGHTB} /></linearGradient>
          <linearGradient id="darea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={BLUE} stopOpacity="0.12" /><stop offset="1" stopColor={BLUE} stopOpacity="0" /></linearGradient>
        </defs>
        {[0.5, 1].map((g) => { const yy = by(maxC * g); return <line key={g} x1={8} x2={W - 8} y1={yy} y2={yy} stroke="var(--line)" strokeWidth="1" />; })}
        {data.map((x, i) => {
          if (x.count === 0) return <rect key={i} x={cx(i) - 10} y={H - BOT - 3} width={20} height={3} rx={1.5} fill="var(--line)" />;
          const h = (x.count / maxC) * plot; const top = H - BOT - h;
          return <g key={i}>
            <rect x={cx(i) - barW / 2} y={top} width={barW} height={h} rx={6} fill="url(#dbar)"><title>{`${monthLabel(x.month)}: ${x.count}`}</title></rect>
            {h > 22 ? <text x={cx(i)} y={top + 15} fontSize="11" fontWeight="800" fill="#fff" textAnchor="middle">{x.count}</text> : <text x={cx(i)} y={top - 5} fontSize="10" fontWeight="800" fill={LIGHTB} textAnchor="middle">{x.count}</text>}
          </g>;
        })}
        <path d={`${cumPath} L${cx(data.length - 1)},${H - BOT} L${cx(0)},${H - BOT} Z`} fill="url(#darea)" />
        <path d={cumPath} fill="none" stroke={BLUE} strokeWidth="2.5" strokeLinejoin="round" />
        <circle cx={cx(data.length - 1)} cy={cy(total)} r="3.5" fill={BLUE} />
        <text x={Math.min(W - 2, cx(data.length - 1))} y={cy(total) - 9} fontSize="11" fontWeight="800" fill={BLUE} stroke="#fff" strokeWidth="3" paintOrder="stroke" textAnchor="end">{total} total</text>
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-[var(--ink-3)]">{data.filter((_, i) => i % Math.ceil(data.length / 6) === 0 || i === data.length - 1).map((x, i) => <span key={i}>{monthLabel(x.month)}</span>)}</div>
    </div>
  );
}

export function DashboardApp() {
  const [d, setD] = useState<Dash | null>(null);
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [months, setMonths] = useState(6);
  const [nowMs] = useState(() => Date.now());

  const load = useCallback(() => {
    apiGet<Dash>("/api/dashboard").then((x) => { setD(x); setError(null); }).catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
    apiGet<Booking[]>("/api/bookings").then(setBookings).catch(() => {});
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

    const income = keys.map((k) => ({ label: k, value: 0 }));
    const booked = keys.map((k) => ({ label: k, value: 0 }));
    const perMonthNew = new Map<string, number>(keys.map((k) => [k, 0]));
    const byAct = new Map<string, number>();
    const byStatus = new Map<string, number>();
    const payMix = new Map<string, number>();
    const families = new Set<string>();
    let totalCollected = 0, paidCount = 0;

    for (const b of list) {
      const m = monthOf(b);
      totalCollected += collectedOf(b);
      if (isPaid(b)) paidCount++;
      families.add((b.email || b.booker || "").toLowerCase());
      byStatus.set(b.status, (byStatus.get(b.status) ?? 0) + 1);
      payMix.set(b.pay || "—", (payMix.get(b.pay || "—") ?? 0) + 1);
      if (!isCancelled(b) && b.listing) byAct.set(b.listing, (byAct.get(b.listing) ?? 0) + collectedOf(b));
      if (m && inWindow.has(m)) {
        const i = keys.indexOf(m);
        income[i].value += collectedOf(b);
        if (!isCancelled(b)) booked[i].value += b.amount;
        perMonthNew.set(m, (perMonthNew.get(m) ?? 0) + 1);
      }
    }
    let cum = 0;
    const newBk = keys.map((k) => { cum += perMonthNew.get(k) ?? 0; return { month: k, count: perMonthNew.get(k) ?? 0, cumulative: cum }; });
    const acts = [...byAct.entries()].sort((x, y) => y[1] - x[1]);
    const recent = [...list].sort((x, y) => (y.createdAt ?? "").localeCompare(x.createdAt ?? "")).slice(0, 6);

    return {
      income, booked, newBk,
      kpis: { collected: totalCollected, bookings: list.filter((b) => !isCancelled(b)).length, families: [...families].filter(Boolean).length, avg: paidCount ? totalCollected / paidCount : 0 },
      byActivity: acts.slice(0, 6).map(([label, value], i) => ({ label, value, sub: money(value), color: ACT_C[i % ACT_C.length] })),
      topActivities: acts.slice(0, 6),
      byStatus: [...byStatus.entries()].map(([label, value]) => ({ label, value, sub: String(value), color: STATUS_C[label] ?? "#8a86a3" })),
      payMix: [...payMix.entries()].map(([label, value]) => ({ label, value, sub: String(value), color: PAY_C[label] ?? "#8a86a3" })),
      recent,
    };
  }, [bookings, months, nowMs]);

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
        </div>
      </div>

      {/* Live operational KPIs (from /api/dashboard) */}
      <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="On site today" value={`${d.today.booked}`} sub={`${d.today.sessions.length} session${d.today.sessions.length === 1 ? "" : "s"} running`} accent={LIGHTB} />
        <Stat label="Occupancy" value={`${d.occupancy.pct}%`} sub={`${d.occupancy.booked}/${d.occupancy.capacity} places, open runs`} accent={GREEN} />
        <Stat label="Taken this week" value={money(d.money.takenThisWeek)} sub={`${d.bookings.newThisWeek} new booking${d.bookings.newThisWeek === 1 ? "" : "s"}`} accent={BLUE} />
        <Stat label="Outstanding" value={money(d.money.outstanding)} sub={d.money.overdueVouchers ? `${d.money.overdueVouchers} overdue voucher${d.money.overdueVouchers === 1 ? "" : "s"}` : d.money.awaitingVoucher ? `${d.money.awaitingVoucher} awaiting voucher` : "all settled"} tone={d.money.overdueVouchers ? "warn" : undefined} accent={GOLD} />
      </div>

      {/* Today + Coming up (unchanged) */}
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Panel title={`Today · ${fmtDay(d.today.date)}`} right={d.bookings.waitlist > 0 ? <Badge tone={{ bg: "#fdf3d8", fg: "#9a5a00" }}>{d.bookings.waitlist} on waitlist</Badge> : undefined}>
          {d.today.sessions.length === 0 ? (
            <div className="py-4 text-center text-[12.5px] text-[var(--ink-3)]">Nothing running today.</div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {d.today.sessions.map((s, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2.5 py-1.5">
                  <span className="text-[12px] font-bold tabular-nums">{s.start}–{s.end}</span>
                  <span className="min-w-0 flex-1 truncate text-[12.5px] font-bold">{s.listing}</span>
                  <span className="text-[11.5px] text-[var(--ink-3)]">{s.booked}/{s.capacity}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>
        <Panel title="Coming up">
          {d.upcoming.length === 0 ? (
            <div className="py-4 text-center text-[12.5px] text-[var(--ink-3)]">No upcoming sessions.</div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {d.upcoming.map((s, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2.5 py-1.5">
                  <span className="w-[92px] shrink-0 text-[11.5px] font-bold text-[var(--ink-2)]">{fmtDay(s.date)}</span>
                  <span className="text-[12px] tabular-nums text-[var(--ink-2)]">{s.start}</span>
                  <span className="min-w-0 flex-1 truncate text-[12.5px]">{s.listing}</span>
                  {s.spotsLeft === 0 ? <Badge tone={{ bg: "var(--red-soft,#fdebec)", fg: "var(--red,#e21d27)" }}>full</Badge> : <span className="text-[11px] text-[var(--ink-3)]">{s.spotsLeft} left</span>}
                </div>
              ))}
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
            <Stat label="Income collected" value={money(a.kpis.collected)} sub="paid bookings, net of refunds" accent={GREEN} />
            <Stat label="Bookings" value={`${a.kpis.bookings}`} sub="live + past (excl. cancelled)" accent={BLUE} />
            <Stat label="Families" value={`${a.kpis.families}`} sub="unique customers" accent={LIGHTB} />
            <Stat label="Avg booking" value={money(a.kpis.avg)} sub="per paid booking" accent={GOLD} />
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
            <Panel title="New bookings" right={<span className="text-[11.5px] text-[var(--ink-3)]">bars = new · line = total</span>}>
              <BookingBars data={a.newBk} />
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
