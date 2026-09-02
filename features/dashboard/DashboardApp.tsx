"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { get as apiGet } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { money, collectedNet } from "@/features/bookings/helpers";
import type { Booking } from "@/features/bookings/types";
import { useSettings } from "@/lib/settings";
import { LIGHT_PALETTE, CollapsibleStats } from "@/components/OperatorPage";
import { OnSiteNowCard } from "@/features/timeclock/OnSiteNowCard";
import { Badge } from "@/components/ui";
import { greeting } from "@/lib/greeting";
import { useT } from "@/lib/i18n/provider";

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

// Just the task fields the dashboard's "Tasks today" card needs (full model lives in features/tasks).
interface DashTask { id: string; t: string; status?: "backlog" | "todo" | "prog" | "done"; time?: string | null; due?: string | null; archived?: boolean; link?: { k: string; v: string; href?: string } | null }
const TASK_STATUS: Record<string, { label: string; color: string }> = {
  backlog: { label: "Backlog", color: "#8a93a6" }, todo: { label: "To do", color: "#3b82f6" },
  prog: { label: "In progress", color: "#f59e0b" }, done: { label: "Done", color: "#16b364" },
};

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
const isCancelled = (b: Booking) => b.status === "Cancelled" || b.status === "Declined";
// Counts toward booked revenue / attendee tallies: neither cancelled/declined
// nor waitlisted (a waitlisted place has paid nothing and holds no seat). The
// collected-money math needs no such guard — collectedNet is already 0 for an
// unpaid waitlisted place — so waitlisted still shows in the status donut.
const countsToward = (b: Booking) => !isCancelled(b) && b.status !== "Waitlisted";
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
function Tile({ label, value, sub, grad, icon, aside, children }: { label: string; value: string; sub?: React.ReactNode; grad: string; icon?: string; aside?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-2xl p-4 text-white shadow-[0_12px_28px_-16px_rgba(20,30,80,.5)]" style={{ background: grad }}>
      <div className="pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full bg-white/10" />
      <div className="relative flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-white/70">
            {icon && <span className="grid h-5 w-5 flex-none place-items-center rounded-md bg-white/15 text-[11px]">{icon}</span>}
            <span className="truncate">{label}</span>
          </div>
          <div className="mt-1.5 text-[27px] font-extrabold leading-none tabular-nums" style={{ fontFamily: "var(--ff-display)", textShadow: "0 1px 2px rgba(0,0,0,.25)" }}>{value}</div>
          {sub && <div className="mt-1 text-[11px] font-semibold text-white/80">{sub}</div>}
        </div>
        {aside && <div className="flex-none">{aside}</div>}
      </div>
      {children}
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

// A single-percentage ring gauge — white on a coloured KPI tile (à la the "Tasks 33%" dial).
function Ring({ pct, size = 62, label, stroke = "#fff", track = "rgba(255,255,255,.22)" }: { pct: number; size?: number; label: string; stroke?: string; track?: string }) {
  const sw = 7, r = size / 2 - sw / 2, c = 2 * Math.PI * r;
  const dash = c * Math.min(1, Math.max(0, pct / 100));
  return (
    <div className="relative flex-none" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={sw} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeDasharray={`${dash.toFixed(1)} ${c.toFixed(1)}`} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-[13px] font-extrabold tabular-nums">{label}</div>
    </div>
  );
}

// A multi-segment doughnut with a centre figure + side legend — the reference's "Conversion / Buyers" wheel, on a light card.
function Donut({ segments, center, sub, size = 116 }: { segments: { label: string; value: number; color: string }[]; center: string; sub?: string; size?: number }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const sw = 15, r = size / 2 - sw / 2, c = 2 * Math.PI * r;
  const shown = segments.filter((s) => s.value > 0);
  const lens = shown.map((s) => c * (s.value / total));
  const offsets = lens.map((_, i) => lens.slice(0, i).reduce((sum, l) => sum + l, 0));
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex-none" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--panel)" strokeWidth={sw} />
          {shown.map((s, i) => (
            <circle key={s.label} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth={sw} strokeDasharray={`${lens[i].toFixed(1)} ${(c - lens[i]).toFixed(1)}`} strokeDashoffset={(-offsets[i]).toFixed(1)} />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-[19px] font-extrabold leading-none tabular-nums" style={{ fontFamily: "var(--ff-display)" }}>{center}</div>
          {sub && <div className="mt-0.5 text-[8.5px] font-bold uppercase tracking-[0.06em] text-[var(--ink-3)]">{sub}</div>}
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-2 text-[11.5px]">
            <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: s.color }} />
            <span className="min-w-0 flex-1 font-semibold leading-tight">{s.label}</span>
            <span className="flex-none tabular-nums font-bold text-[var(--ink-3)]">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
// A centred booking-lifecycle funnel — each tier's width is its share of the first tier.
function Funnel({ stages }: { stages: { label: string; value: number; color: string }[] }) {
  const t = useT();
  const top = Math.max(1, stages[0]?.value ?? 1);
  if (!stages.some((s) => s.value > 0)) return <Empty>{t("dashboard.noBookingsYet")}</Empty>;
  return (
    <div className="flex flex-col gap-2 py-1">
      {stages.map((s) => {
        const w = Math.max(14, (s.value / top) * 100);
        const pct = Math.round((s.value / top) * 100);
        return (
          <div key={s.label} className="flex items-center gap-3">
            <div className="w-20 flex-none text-right text-[12px] font-semibold text-[var(--ink-2)]">{s.label}</div>
            <div className="flex-1">
              <div className="mx-auto flex h-9 items-center justify-center rounded-md text-[13px] font-extrabold text-white shadow-[0_6px_16px_-10px_rgba(20,30,80,.6)]" style={{ width: `${w}%`, background: s.color }}>{s.value}</div>
            </div>
            <div className="w-9 flex-none text-[11px] font-bold tabular-nums text-[var(--ink-3)]">{pct}%</div>
          </div>
        );
      })}
    </div>
  );
}
function Panel({ title, right, children, className = "" }: { title: string; right?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[0_1px_2px_rgba(16,32,90,.04)] ${className}`}>
      <div className="mb-3.5 flex items-center justify-between gap-2 border-b border-[var(--line)] pb-2.5">
        <div className="text-[15.5px] font-extrabold leading-tight text-[var(--ink)]" style={{ fontFamily: "var(--ff-display)" }}>{title}</div>
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
function Breakdown({ entries }: { entries: { label: string; value: number; sub: string; color: string; meta?: string }[] }) {
  const t = useT();
  const max = Math.max(1, ...entries.map((e) => e.value));
  if (!entries.length) return <Empty>{t("dashboard.nothingYet")}</Empty>;
  return (
    <div className="flex flex-col gap-3">
      {entries.map((e, i) => (
        <div key={e.label}>
          <div className="mb-1.5 flex items-start justify-between gap-2 text-[12.5px]">
            <span className="flex min-w-0 items-start gap-2">
              <span className="mt-[1px] grid h-5 w-5 flex-none place-items-center rounded-md text-[10px] font-extrabold text-white" style={{ background: e.color }}>{i + 1}</span>
              <span className="min-w-0">
                <span className="block truncate font-semibold">{e.label}</span>
                {e.meta && <span className="block truncate text-[11px] font-medium text-[var(--ink-3)]">📍 {e.meta}</span>}
              </span>
            </span>
            <span className="whitespace-nowrap font-extrabold tabular-nums">{e.sub}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-[var(--panel)]">
            <div className="h-full rounded-full" style={{ width: `${(e.value / max) * 100}%`, background: `linear-gradient(90deg,${e.color},${e.color}aa)`, boxShadow: `0 4px 12px -6px ${e.color}` }} />
          </div>
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
  // A value label sitting just above (dir -1) or below (dir +1) a point, with a
  // white halo so it stays legible over the line/area. Clamped inside the box so
  // nothing clips at the edges or the top.
  const ptLabel = (cx: number, cy: number, text: string, fill: string, dir: -1 | 1) => {
    const ly = dir < 0 ? (cy < 18 ? cy + 15 : cy - 8) : (cy > H - 18 ? cy - 8 : cy + 15);
    const half = text.length * 3.2;
    const xc = Math.max(PAD + half, Math.min(W - PAD - half, cx));
    return <text x={xc} y={ly} fontSize="10.5" fontWeight="800" fill={fill} stroke="#fff" strokeWidth="3" paintOrder="stroke" textAnchor="middle">{text}</text>;
  };
  // Dots + direct value labels for every point (zeros skipped, except the last),
  // so the figures read at a glance without hovering. In the two-series chart the
  // upper line labels above and the lower line below, so they never collide.
  const dots = (arr: { value: number }[], col: string, dir: -1 | 1) =>
    arr.map((p, i) => (p.value > 0 || i === arr.length - 1) ? (
      <g key={`${dir}-${i}`}>
        <circle cx={x(i)} cy={y(p.value)} r="3" fill={col} />
        {ptLabel(x(i), y(p.value), fmt(p.value), col, dir)}
      </g>
    ) : null);
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
        {/* Lower line labels below, upper line above — in the single-series chart
            there's only the one, labelled above. */}
        {dots(series, color, series2 ? -1 : -1)}
        {series2 && dots(series2, color2!, 1)}
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
  const t = useT();
  const [d, setD] = useState<Dash | null>(null);
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [bookingsErr, setBookingsErr] = useState<string | null>(null);
  const [tasks, setTasks] = useState<DashTask[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [months, setMonths] = useState(6);
  const [nowMs] = useState(() => Date.now());
  // listingId → seasonId, so bookings can be grouped by season (names in settings).
  const [listingSeason, setListingSeason] = useState<Record<string, string>>({});
  // listingId → venue name (for the 📍 line) and → venueId (for filtering).
  const [listingVenue, setListingVenue] = useState<Record<string, string>>({});
  const [listingVenueId, setListingVenueId] = useState<Record<string, string>>({});
  // The venues that actually have listings — options for the location lens.
  const [venues, setVenues] = useState<{ id: string; name: string }[]>([]);
  // The whole-dashboard location lens ("" = all locations). Drives both the
  // server figures (?venueId=) and the client-side booking analytics.
  const [dashVenue, setDashVenue] = useState("");
  // A second, card-local location filter just for Revenue by activity.
  const [activityLoc, setActivityLoc] = useState("");
  const { settings } = useSettings();
  const seasons = settings.seasons ?? [];
  // Just for the greeting — the person's name, not the business name.
  const [me, setMe] = useState<{ name?: string } | null>(null);
  useEffect(() => { apiGet<{ name?: string }>("/api/me").then(setMe).catch(() => {}); }, []);
  const router = useRouter();
  const portal = (usePathname() ?? "/").split("/")[1] || "app";

  const load = useCallback(() => {
    // The location lens narrows the server figures too (blocks/bookings/payments).
    apiGet<Dash>(`/api/dashboard${dashVenue ? `?venueId=${encodeURIComponent(dashVenue)}` : ""}`).then((x) => { setD(x); setError(null); }).catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
    // On failure keep bookings null but record the error, so the analytics
    // section shows a retry instead of "Loading your figures…" forever.
    apiGet<Booking[]>("/api/bookings").then((b) => { setBookings(b); setBookingsErr(null); }).catch((e) => setBookingsErr(e instanceof Error ? e.message : "Couldn’t load your figures"));
    apiGet<DashTask[]>("/api/tasks").then((t) => setTasks(t ?? [])).catch(() => setTasks([]));
    // Listings carry the season + venue for each activity; the library names the
    // venues. Together they give the season grouping and the location line/lens.
    Promise.all([
      apiGet<{ id: string; seasonId?: string | null; venueId?: string | null }[]>("/api/listings?mine=1"),
      apiGet<{ venues?: { id: string; name: string }[] } | null>("/api/library").catch(() => null),
    ]).then(([ls, lib]) => {
      const list = ls ?? [];
      setListingSeason(Object.fromEntries(list.filter((l) => l.id && l.seasonId).map((l) => [l.id, l.seasonId as string])));
      const venueName = new Map((lib?.venues ?? []).map((v) => [v.id, v.name]));
      setListingVenue(Object.fromEntries(list.flatMap((l) => { const n = l.venueId ? venueName.get(l.venueId) : undefined; return l.id && n ? [[l.id, n] as [string, string]] : []; })));
      setListingVenueId(Object.fromEntries(list.filter((l) => l.id && l.venueId).map((l) => [l.id, l.venueId as string])));
      const used = new Set(list.map((l) => l.venueId).filter(Boolean));
      setVenues((lib?.venues ?? []).filter((v) => used.has(v.id)));
    }).catch(() => {});
  }, [dashVenue]);
  useEffect(load, [load]);
  useRealtime(["bookings", "blocks", "listings", "payments", "tasks"], load);

  // Today's outstanding tasks (due today, not done/archived) — most urgent by time first.
  const todayTasks = useMemo(() => {
    const today = d?.today.date;
    if (!today || !tasks) return [];
    return tasks
      .filter((t) => t.due === today && t.status !== "done" && !t.archived)
      .sort((a, b) => (a.time ?? "99:99").localeCompare(b.time ?? "99:99"));
  }, [tasks, d?.today.date]);

  // Everything analytical, computed from the tenant's own bookings.
  const a = useMemo(() => {
    const list = (bookings ?? []).filter((b) => b.status !== "Declined" && (!dashVenue || listingVenueId[b.listingId ?? ""] === dashVenue));
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
    // Keyed by listingId (so two listings sharing a name don't merge), carrying
    // the display name + its venue for the location line/filter.
    const byAct = new Map<string, { name: string; venue?: string; value: number }>();
    const bySeason = new Map<string, number>();
    const seasonName = (b: Booking) => seasons.find((s) => s.id === (b.listingId ? listingSeason[b.listingId] : undefined))?.name ?? "No season";
    const byStatus = new Map<string, number>();
    const payMix = new Map<string, number>();
    const families = new Set<string>();
    const famCount = new Map<string, number>();   // bookings per family → repeat-customer share
    let totalCollected = 0, paidCount = 0, bookingsCount = 0;

    for (const b of list) {
      // The last-5-weeks mini graphs are fixed windows, independent of 3/6/12m.
      const ws = b.createdAt || b.days?.[0] || "";
      const t = Date.parse(ws.length === 10 ? `${ws}T00:00:00Z` : ws);
      if (!Number.isNaN(t)) for (let i = 0; i < wkStarts.length; i++) { if (t >= wkStarts[i] && t < wkStarts[i] + 7 * 86400000) { weekly[i]++; weeklyIncome[i] += collectedNet(b); break; } }

      // Everything else honours the selected 3/6/12-month period.
      const m = monthOf(b);
      if (!m || !inWindow.has(m)) continue;
      const i = keys.indexOf(m);
      income[i].value += collectedNet(b);
      if (countsToward(b)) booked[i].value += b.amount;
      totalCollected += collectedNet(b);
      if (collectedNet(b) > 0) paidCount++;
      if (countsToward(b)) bookingsCount++;
      const fam = (b.email || b.booker || "").toLowerCase();
      families.add(fam);
      if (fam && countsToward(b)) famCount.set(fam, (famCount.get(fam) ?? 0) + 1);
      byStatus.set(b.status, (byStatus.get(b.status) ?? 0) + 1);
      payMix.set(b.pay || "—", (payMix.get(b.pay || "—") ?? 0) + 1);
      if (countsToward(b) && (b.listingId || b.listing)) {
        const key = b.listingId || b.listing;
        const cur = byAct.get(key) ?? { name: b.listing || "—", venue: b.listingId ? listingVenue[b.listingId] : undefined, value: 0 };
        cur.value += collectedNet(b);
        byAct.set(key, cur);
      }
      if (countsToward(b)) bySeason.set(seasonName(b), (bySeason.get(seasonName(b)) ?? 0) + collectedNet(b));
    }
    const acts = [...byAct.values()].sort((x, y) => y.value - x.value);
    const seasonRows = [...bySeason.entries()].filter(([, v]) => v > 0 || bySeason.size <= 6).sort((x, y) => y[1] - x[1]);
    const recent = [...list].sort((x, y) => (y.createdAt ?? "").localeCompare(x.createdAt ?? "")).slice(0, 6);
    // Booking lifecycle funnel + repeat-customer share, from the same windowed bookings.
    const confirmed = byStatus.get("Confirmed") ?? 0;
    const funnel = [
      { label: "Bookings", value: bookingsCount, color: LIGHTB },
      { label: "Confirmed", value: confirmed, color: BLUE },
      { label: "Paid", value: paidCount, color: GREEN },
    ];
    const famTotal = famCount.size;
    const repeatCount = [...famCount.values()].filter((n) => n > 1).length;
    const repeat = { total: famTotal, repeat: repeatCount, pct: famTotal ? Math.round((repeatCount / famTotal) * 100) : 0 };

    return {
      income, booked, weekly, weeklyIncome,
      weeklyLabels: wkStarts.map((ms) => new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })),
      kpis: { collected: totalCollected, bookings: bookingsCount, families: [...families].filter(Boolean).length, avg: paidCount ? totalCollected / paidCount : 0 },
      // Full list (venue included) — the location filter + top-6 slice happen at
      // render, so filtering by location doesn't lose activities beyond the top 6.
      byActivity: acts.map((v) => ({ label: v.name, venue: v.venue, value: v.value })),
      bySeason: seasonRows.slice(0, 8).map(([label, value], i) => ({ label, value, sub: money(value), color: ACT_C[i % ACT_C.length] })),
      byStatus: [...byStatus.entries()].map(([label, value]) => ({ label, value, sub: String(value), color: STATUS_C[label] ?? "#8a86a3" })),
      payMix: [...payMix.entries()].map(([label, value]) => ({ label, value, sub: String(value), color: PAY_C[label] ?? "#8a86a3" })),
      funnel, repeat,
      recent,
    };
  }, [bookings, months, nowMs, listingSeason, listingVenue, listingVenueId, dashVenue, seasons]);

  // Doughnut centres: total booked, and paid share of all bookings.
  const statusTotal = a.byStatus.reduce((s, x) => s + x.value, 0);
  const payTotal = a.payMix.reduce((s, x) => s + x.value, 0);
  const paidCount = a.payMix.filter((p) => p.label === "Paid" || p.label === "Funded").reduce((s, x) => s + x.value, 0);
  const paidPct = payTotal ? Math.round((paidCount / payTotal) * 100) : 0;

  if (error) return <div className="p-2 text-[12.5px] text-[var(--red)]">{error}</div>;
  if (!d) return <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">{t("dashboard.loading")}</div>;

  return (
    <div className="-m-3 min-h-[calc(100vh-3.5rem)] p-3 sm:-m-5 sm:p-5 text-[var(--ink)]" style={LIGHT_PALETTE}>
      {/* Hero */}
      <div className="overflow-hidden rounded-2xl text-white" style={{ backgroundImage: `radial-gradient(rgba(255,255,255,0.10) 1px, transparent 1.6px), ${HERO}`, backgroundSize: "18px 18px, cover, cover, cover, cover", backgroundRepeat: "repeat, no-repeat, no-repeat, no-repeat, no-repeat" }}>
        <div className="flex flex-wrap items-end justify-between gap-3 px-6 py-5">
          <div>
            <div className="text-[11px] font-extrabold uppercase tracking-[0.12em]" style={{ color: "#ffd23f" }}>{greeting(me?.name)}</div>
            <h2 className="mt-0.5 text-[25px] font-extrabold" style={{ fontFamily: "var(--ff-display)", color: "#fff" }}>📊 {t("dashboard.dashboardTitle")}</h2>
            <p className="mt-1 max-w-[620px] text-[12.5px] leading-snug text-white/85">{t("dashboard.dashboardIntro")}</p>
            {/* Location lens — narrows every figure below to one venue. */}
            {venues.length > 0 && (
              <label className="mt-3 inline-flex items-center gap-2 rounded-xl bg-white/12 px-3 py-1.5 ring-1 ring-white/20">
                <span className="text-[11px] font-bold uppercase tracking-wide text-white/75">📍 {t("dashboard.location")}</span>
                <select value={dashVenue} onChange={(e) => setDashVenue(e.target.value)} className="cursor-pointer bg-transparent text-[12.5px] font-extrabold text-white outline-none">
                  <option value="" className="text-black">{t("dashboard.allLocations")}</option>
                  {venues.map((v) => <option key={v.id} value={v.id} className="text-black">{v.name}</option>)}
                </select>
              </label>
            )}
          </div>
          {/* On-site-today summary, on the right of the title banner. */}
          <div className="rounded-2xl bg-white/12 px-4 py-3 text-right ring-1 ring-white/15">
            <div className="text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-white/75">{t("dashboard.onSiteToday")}</div>
            <div className="text-[30px] font-extrabold leading-none text-white" style={{ fontFamily: "var(--ff-display)" }}>{d.today.booked}</div>
            <div className="mt-1 text-[11.5px] font-semibold text-white/85">{d.today.sessions.length} session{d.today.sessions.length === 1 ? "" : "s"} running</div>
          </div>
        </div>
      </div>

      {/* Live operational KPIs (from /api/dashboard) */}
      <CollapsibleStats id="dashboard-kpis" className="mt-4" label={t("dashboard.liveKpis")}>
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label={t("dashboard.newBookings")} icon="📈" value={`${a.weekly.reduce((s, v) => s + v, 0)}`} sub={t("dashboard.inLast5Weeks")} grad={GRAD.blue}>
          {bookings && <MiniBars data={a.weekly} labels={a.weeklyLabels} caption={t("dashboard.perWeek")} />}
        </Tile>
        <Tile
          label={t("dashboard.spacesLeftLive")}
          icon="🎟️"
          value={`${Math.max(0, d.occupancy.capacity - d.occupancy.booked)}`}
          sub={t("dashboard.spacesLeftSub", { pct: 100 - d.occupancy.pct, booked: d.occupancy.booked, capacity: d.occupancy.capacity })}
          grad={GRAD.teal}
          aside={<Ring pct={d.occupancy.pct} label={`${d.occupancy.pct}%`} />}
        />
        <Tile label={t("dashboard.takenThisWeek")} icon="💷" value={money(d.money.takenThisWeek)} sub={`${d.bookings.newThisWeek} new booking${d.bookings.newThisWeek === 1 ? "" : "s"}`} grad={GRAD.green}>
          {bookings && <MiniLine data={a.weeklyIncome} labels={a.weeklyLabels} caption={t("dashboard.collectedLast5Weeks")} />}
        </Tile>
        <Tile
          label={t("dashboard.outstanding")}
          icon="⏳"
          value={money(d.money.outstanding)}
          sub={
            d.money.overdueVouchers ? `${d.money.overdueVouchers} overdue voucher${d.money.overdueVouchers === 1 ? "" : "s"}`
            : d.money.awaitingVoucher ? t("dashboard.awaitingVoucherPayment", { count: d.money.awaitingVoucher })
            : d.money.outstanding > 0 ? t("dashboard.unpaidInvoiced")
            : t("dashboard.allSettled")
          }
          grad={d.money.outstanding > 0 ? GRAD.pink : GRAD.green}
        />
      </div>
      </CollapsibleStats>

      {/* live clock-in board */}
      <div className="mt-3"><OnSiteNowCard /></div>

      {/* Today · Live listings · Tasks today — three across */}
      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <Panel
          title={`☀️ ${t("dashboard.today")} · ${fmtDay(d.today.date)}`}
          right={
            <span className="flex items-center gap-2">
              {d.bookings.waitlist > 0 && <Badge tone={{ bg: "#fdf3d8", fg: "#9a5a00" }}>{t("dashboard.onWaitlist", { count: d.bookings.waitlist })}</Badge>}
              <button type="button" onClick={() => router.push(`/${portal}/registers`)} className="text-[11px] font-bold text-[var(--brand)] hover:underline">{t("dashboard.registers")} →</button>
            </span>
          }
        >
          {d.today.sessions.length === 0 ? (
            <div className="py-4 text-center text-[12.5px] text-[var(--ink-3)]">{t("dashboard.nothingRunningToday")}</div>
          ) : (
            <div className="flex flex-col gap-2">
              {d.today.sessions.map((s, i) => {
                const c = actColor(s.listing);
                const pct = s.capacity ? Math.round((s.booked / s.capacity) * 100) : 0;
                return (
                  <button key={i} type="button" onClick={() => router.push(`/${portal}/registers`)} title={t("dashboard.openRegisters")} className="flex w-full items-center gap-3 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-left transition-shadow hover:shadow-sm" style={{ borderLeft: `4px solid ${c}` }}>
                    <span className="rounded-lg px-2 py-1 text-[11.5px] font-extrabold tabular-nums text-white" style={{ background: c }}>{s.start}–{s.end}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-extrabold text-[var(--ink)]">{s.listing}</div>
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--panel)]"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: c }} /></div>
                    </div>
                    <div className="text-right">
                      <div className="text-[13px] font-extrabold tabular-nums text-[var(--ink)]">{s.booked}/{s.capacity}</div>
                      <div className="text-[10px] font-bold text-[var(--ink-3)]">{t("dashboard.pctFull", { pct })}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </Panel>
        <Panel
          title={`🎟️ ${t("dashboard.liveListingsPlaces")}`}
          right={<button type="button" onClick={() => router.push(`/${portal}/listings`)} className="text-[11px] font-bold text-[var(--brand)] hover:underline">{t("dashboard.allListings")} →</button>}
        >
          {d.byListing.length === 0 ? (
            <div className="py-4 text-center text-[12.5px] text-[var(--ink-3)]">{t("dashboard.noOpenListings")}</div>
          ) : (
            <div className="flex flex-col gap-2">
              {d.byListing.map((l, i) => {
                const c = actColor(l.listing);
                const tone = availTone(l.spotsLeft, l.capacity);
                return (
                  <button key={i} type="button" onClick={() => router.push(`/${portal}/listings`)} title={t("dashboard.manageListings")} className="flex w-full items-center gap-3 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-left transition-shadow hover:shadow-sm" style={{ borderLeft: `4px solid ${c}` }}>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-extrabold text-[var(--ink)]">{l.listing}</div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--panel)]"><div className="h-full rounded-full" style={{ width: `${l.pct}%`, background: c }} /></div>
                        <span className="whitespace-nowrap text-[11px] font-bold text-[var(--ink-3)]">{t("dashboard.fromDate", { date: fmtDay(l.nextDate) })}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[13px] font-extrabold tabular-nums text-[var(--ink)]">{l.booked}/{l.capacity}</div>
                      <div className="text-[10px] font-bold text-[var(--ink-3)]">{t("dashboard.pctFull", { pct: l.pct })}</div>
                    </div>
                    <span className="whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-extrabold" style={{ background: tone.bg, color: tone.fg }}>{tone.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </Panel>
        <Panel
          title={`✅ ${t("dashboard.tasksToday")}`}
          right={todayTasks.length > 0 ? <Badge tone={{ bg: "#fdeede", fg: "#a85f08" }}>{t("dashboard.due", { count: todayTasks.length })}</Badge> : undefined}
        >
          {tasks === null ? (
            <Empty>{t("dashboard.loading")}</Empty>
          ) : todayTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-[var(--line)] py-8 text-center">
              <div className="text-[20px]">🎉</div>
              <div className="text-[12.5px] font-bold text-[var(--ink-2)]">{t("dashboard.nothingDueToday")}</div>
              <button type="button" onClick={() => router.push(`/${portal}/tasks`)} className="text-[11px] font-bold text-[var(--brand)] hover:underline">{t("dashboard.openTaskManager")}</button>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-[var(--line)]">
              {todayTasks.map((task) => {
                const st = TASK_STATUS[task.status ?? "todo"] ?? TASK_STATUS.todo;
                const go = () => router.push(task.link?.href ?? `/${portal}/tasks`);
                return (
                  <button key={task.id} type="button" onClick={go} className="flex flex-col gap-0.5 py-2 text-left text-[12.5px] hover:opacity-80">
                    <span className="flex items-start gap-2.5">
                      <span className="mt-[5px] h-2 w-2 flex-none rounded-full" style={{ background: st.color }} title={st.label} />
                      <span className="min-w-0 flex-1 font-semibold">{task.t}</span>
                      <span className="shrink-0 whitespace-nowrap text-[11px] font-bold tabular-nums text-[var(--ink-3)]">{task.time ?? t("dashboard.today")}</span>
                    </span>
                    {task.link?.v && <span className="truncate pl-[18px] text-[11px] text-[var(--ink-3)]">{task.link.v}</span>}
                  </button>
                );
              })}
              <button type="button" onClick={() => router.push(`/${portal}/tasks`)} className="pt-2 text-center text-[11px] font-bold text-[var(--brand)] hover:underline">{t("dashboard.openTaskManager")} →</button>
            </div>
          )}
        </Panel>
      </div>

      {/* ── Business analytics (computed from your bookings) ── */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
        <div className="text-[15px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>{t("dashboard.businessAnalytics")}</div>
        <div className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--surface)] p-1 text-[12px] font-bold">
          {[3, 6, 12].map((m) => (
            <button key={m} type="button" onClick={() => setMonths(m)} className="rounded-full px-3 py-1 transition-colors" style={months === m ? { background: BLUE, color: "#fff" } : { color: "var(--ink-3)" }}>{m}m</button>
          ))}
        </div>
      </div>

      {!bookings ? (
        bookingsErr ? (
          <div className="mt-3 flex flex-col items-center gap-2 rounded-2xl border border-[var(--line)] bg-[var(--surface)] py-8 text-center text-[12.5px] text-[var(--ink-3)]">
            <span>{t("dashboard.couldntLoadFigures", { error: bookingsErr })}</span>
            <button type="button" onClick={load} className="rounded-full bg-[var(--brand)] px-3 py-1 text-[11.5px] font-bold text-white">{t("dashboard.tryAgain")}</button>
          </div>
        ) : (
          <div className="mt-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] py-8 text-center text-[12.5px] text-[var(--ink-3)]">{t("dashboard.loadingFigures")}</div>
        )
      ) : (
        <>
          <CollapsibleStats id="dashboard-money-kpis" className="mt-3" label={t("dashboard.figures")}>
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            <Tile label={t("dashboard.incomeCollected")} icon="💰" value={money(a.kpis.collected)} sub={t("dashboard.netOfRefunds", { months })} grad={GRAD.green} />
            <Tile label={t("dashboard.bookings")} icon="🎫" value={`${a.kpis.bookings}`} sub={t("dashboard.bookedLastMonths", { months })} grad={GRAD.blue} />
            <Tile label={t("dashboard.families")} icon="👨‍👩‍👧" value={`${a.kpis.families}`} sub={t("dashboard.uniqueCustomers", { months })} grad={GRAD.violet} />
            <Tile label={t("dashboard.avgBooking")} icon="🧮" value={money(a.kpis.avg)} sub={t("dashboard.perPaidBooking")} grad={GRAD.amber} />
          </div>
          </CollapsibleStats>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Panel title={t("dashboard.incomeByMonth")} right={<Legend items={[[t("dashboard.collected"), GREEN]]} />}>
              <TrendChart series={a.income} fmt={money} color={GREEN} />
            </Panel>
            <Panel title={t("dashboard.bookedVsCollected")} right={<Legend items={[[t("dashboard.booked"), LIGHTB], [t("dashboard.collected"), GREEN]]} />}>
              <TrendChart series={a.booked} series2={a.income} fmt={money} color={LIGHTB} color2={GREEN} />
            </Panel>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Panel title={t("dashboard.revenueBySeason")}>
              {seasons.length === 0
                ? <Empty>{t("dashboard.setupSeasons")}</Empty>
                : <Breakdown entries={a.bySeason} />}
            </Panel>
            {(() => {
              const locs = [...new Set(a.byActivity.map((e) => e.venue).filter((v): v is string => !!v))].sort();
              const filtered = a.byActivity.filter((e) => !activityLoc || e.venue === activityLoc);
              const entries = filtered.slice(0, 6).map((e, i) => ({ label: e.label, value: e.value, sub: money(e.value), color: ACT_C[i % ACT_C.length], meta: e.venue }));
              return (
                <Panel
                  title={t("dashboard.revenueByActivity")}
                  right={locs.length > 0 ? (
                    <select value={activityLoc} onChange={(e) => setActivityLoc(e.target.value)} className="max-w-[170px] rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-[11.5px] font-bold text-[var(--ink-2)] outline-none">
                      <option value="">📍 {t("dashboard.allLocations")}</option>
                      {locs.map((l) => <option key={l} value={l}>{l}</option>)}
                    </select>
                  ) : undefined}
                >
                  {entries.length ? <Breakdown entries={entries} /> : <Empty>{t("dashboard.noRevenueAt", { location: activityLoc })}</Empty>}
                </Panel>
              );
            })()}
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Panel title={`🔻 ${t("dashboard.bookingFunnel")}`} right={<span className="text-[11px] font-bold text-[var(--ink-3)]">{t("dashboard.lastMonths", { months })}</span>}>
              <Funnel stages={a.funnel} />
              <div className="mt-3 border-t border-[var(--line)] pt-2.5 text-[11.5px] text-[var(--ink-3)]">
                {a.funnel[0].value > 0
                  ? <><b className="text-[var(--ink-2)]">{Math.round((a.funnel[2].value / a.funnel[0].value) * 100)}%</b> of bookings are paid · <b className="text-[var(--ink-2)]">{Math.round((a.funnel[1].value / a.funnel[0].value) * 100)}%</b> confirmed</>
                  : t("dashboard.noBookingsInWindow")}
              </div>
            </Panel>
            <Panel title={`🔁 ${t("dashboard.repeatCustomers")}`} right={<span className="text-[11px] font-bold text-[var(--ink-3)]">{t("dashboard.lastMonths", { months })}</span>}>
              {a.repeat.total > 0 ? (
                <>
                  <Donut
                    segments={[{ label: t("dashboard.repeatFamilies"), value: a.repeat.repeat, color: "#e2225f" }, { label: t("dashboard.oneBooking"), value: a.repeat.total - a.repeat.repeat, color: LIGHTB }]}
                    center={`${a.repeat.pct}%`}
                    sub={t("dashboard.repeat")}
                  />
                  <div className="mt-3 border-t border-[var(--line)] pt-2.5 text-[11.5px] text-[var(--ink-3)]">
                    <b className="text-[var(--ink-2)]">{a.repeat.repeat}</b> {t("dashboard.ofFamiliesRepeat", { total: a.repeat.total })}
                  </div>
                </>
              ) : <Empty>{t("dashboard.noCustomersYet")}</Empty>}
            </Panel>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <Panel title={`📊 ${t("dashboard.bookingsAndPayments")}`} className="lg:col-span-2">
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <div className="mb-2.5 text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-[var(--ink-3)]">{t("dashboard.byStatus")}</div>
                  {statusTotal ? <Donut segments={a.byStatus} center={`${statusTotal}`} sub={t("dashboard.bookedLabel")} /> : <Empty>{t("dashboard.nothingYet")}</Empty>}
                </div>
                <div className="sm:border-l sm:border-[var(--line)] sm:pl-5">
                  <div className="mb-2.5 text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-[var(--ink-3)]">{t("dashboard.paymentMix")}</div>
                  {payTotal ? <Donut segments={a.payMix} center={`${paidPct}%`} sub={t("dashboard.paid")} /> : <Empty>{t("dashboard.nothingYet")}</Empty>}
                </div>
              </div>
            </Panel>
            <Panel title={`🆕 ${t("dashboard.newestBookings")}`}>
              {a.recent.length ? (
                <div className="flex flex-col divide-y divide-[var(--line)]">
                  {a.recent.map((b) => (
                    <button
                      key={`${b.tenantId}-${b.ref}`}
                      type="button"
                      onClick={() => router.push(`/${portal}/bookings?ref=${encodeURIComponent(b.ref)}`)}
                      className="-mx-1 flex items-center gap-2 rounded-lg px-1 py-2 text-left text-[12.5px] transition-colors hover:bg-[var(--panel)]"
                      title={t("dashboard.openThisBooking")}
                    >
                      <span className="min-w-0 flex-1 truncate"><b>{b.child || b.booker}</b> <span className="text-[var(--ink-3)]">· {b.listing}</span></span>
                      <span className="whitespace-nowrap font-extrabold tabular-nums">{money(b.amount)}</span>
                    </button>
                  ))}
                </div>
              ) : <Empty>{t("dashboard.noBookingsYet")}</Empty>}
            </Panel>
          </div>
        </>
      )}

      <div className="mt-4 text-[11.5px] text-[var(--ink-3)]">{d.counts.listings} listing{d.counts.listings === 1 ? "" : "s"} · {d.counts.activeBlocks} active run{d.counts.activeBlocks === 1 ? "" : "s"} · {d.bookings.live} live booking{d.bookings.live === 1 ? "" : "s"}</div>
    </div>
  );
}
