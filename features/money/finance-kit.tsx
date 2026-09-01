"use client";

// Shared visual kit for the rich analytics look — gradient KPI tiles, ring
// gauges, doughnuts, ranked gradient bars and an area trend chart. Lifted from
// the freelancer Dashboard so Finance & Analytics reads as the same system.
import { useState, type ReactNode } from "react";

export const GRAD = {
  blue: "linear-gradient(135deg,#16306e 0%,#3f78d8 100%)",
  teal: "linear-gradient(135deg,#0e6f8a 0%,#14b8a6 100%)",
  green: "linear-gradient(135deg,#0b6b3a 0%,#2fb56f 100%)",
  pink: "linear-gradient(135deg,#9c1458 0%,#ee1f63 100%)",
  amber: "linear-gradient(135deg,#9a5a12 0%,#f5b81f 100%)",
  violet: "linear-gradient(135deg,#5b21b6 0%,#8b5cf6 100%)",
} as const;
export const ACT_C = ["#3f78d8", "#0f7a43", "#e2225f", "#7c3aed", "#e88f1f", "#0ea5a0", "#c81e77", "#1d3a8f"];
export const money = (n: number) => (n < 0 ? `−£${Math.abs(Math.round(n * 100) / 100).toFixed(2)}` : `£${(Math.round(n * 100) / 100).toFixed(2)}`);
export const compactMoney = (n: number) => (Math.abs(n) >= 1000 ? `£${(n / 1000).toFixed(Math.abs(n) >= 10000 ? 0 : 1)}k` : `£${Math.round(n)}`);
export const monthLabel = (k: string) => new Date(`${k}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" });
export const colorFor = (s: string) => ACT_C[[...(s || "?")].reduce((a, c) => a + c.charCodeAt(0), 0) % ACT_C.length];

// A dark-gradient KPI tile with an icon badge, optional right-hand visual and children.
export function Tile({ label, value, sub, grad, icon, aside, children }: { label: string; value: string; sub?: ReactNode; grad: string; icon?: string; aside?: ReactNode; children?: ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-2xl p-4 text-white" style={{ background: grad, boxShadow: "0 10px 24px -16px rgba(20,30,80,.45)" }}>
      {/* one restrained top sheen — less "showroom", more dashboard */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1/2" style={{ background: "linear-gradient(180deg, rgba(255,255,255,.12), rgba(255,255,255,0))" }} />
      <div className="relative">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-white/75">
            {icon && <span className="grid h-5 w-5 flex-none place-items-center rounded-md bg-white/20 text-[11px]">{icon}</span>}
            <span className="truncate">{label}</span>
          </div>
          <div className="mt-1.5 text-[26px] font-extrabold leading-none tabular-nums" style={{ fontFamily: "var(--ff-display)", textShadow: "0 1px 2px rgba(0,0,0,.25)" }}>{value}</div>
          {sub && <div className="mt-1 text-[11px] font-semibold text-white/85">{sub}</div>}
        </div>
      </div>
      {children}
    </div>
  );
}

// Ring gauge — white on a coloured tile.
export function Ring({ pct, size = 60, label }: { pct: number; size?: number; label: string }) {
  const sw = 7, r = size / 2 - sw / 2, c = 2 * Math.PI * r;
  const dash = c * Math.min(1, Math.max(0, pct / 100));
  return (
    <div className="relative flex-none" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.22)" strokeWidth={sw} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#fff" strokeWidth={sw} strokeLinecap="round" strokeDasharray={`${dash.toFixed(1)} ${c.toFixed(1)}`} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-[12.5px] font-extrabold tabular-nums">{label}</div>
    </div>
  );
}

// Multi-segment doughnut with a centre figure + side legend.
export function Donut({ segments, center, sub, valueFmt = (n) => String(n), size = 116 }: { segments: { label: string; value: number; color: string }[]; center: string; sub?: string; valueFmt?: (n: number) => string; size?: number }) {
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
            <span className="flex-none tabular-nums font-bold text-[var(--ink-3)]">{valueFmt(s.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Ranked gradient horizontal bars.
export function Breakdown({ entries }: { entries: { label: string; value: number; sub: string; color: string; meta?: string }[] }) {
  const max = Math.max(1, ...entries.map((e) => e.value));
  if (!entries.length) return <Empty>Nothing yet.</Empty>;
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
            <span className="whitespace-nowrap font-extrabold tabular-nums text-[var(--ink-2)]">{e.sub}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-[var(--panel)]">
            <div className="h-full rounded-full" style={{ width: `${(e.value / max) * 100}%`, background: `linear-gradient(90deg,${e.color},${e.color}aa)`, boxShadow: `0 4px 12px -6px ${e.color}` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// A white bar chart on a coloured tile — recent periods at a glance, with values.
export function MiniBars({ data, labels, caption }: { data: number[]; labels: string[]; caption: string }) {
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

export function Panel({ title, right, children, className = "" }: { title: ReactNode; right?: ReactNode; children: ReactNode; className?: string }) {
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
export function Legend({ items }: { items: [string, string][] }) {
  return <div className="flex flex-wrap gap-3 text-[11px] font-bold text-[var(--ink-3)]">{items.map(([l, c]) => <span key={l} className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: c }} />{l}</span>)}</div>;
}
export function Empty({ children }: { children: ReactNode }) {
  return <div className="py-6 text-center text-[12px] text-[var(--ink-3)]">{children}</div>;
}
// A small ⓘ tooltip, matching the reference's per-card info dots.
export function Info({ text }: { text: string }) {
  return <span title={text} className="grid h-4 w-4 cursor-help place-items-center rounded-full border border-current text-[9px] font-bold text-[var(--ink-3)] opacity-70">i</span>;
}

// Area/line trend with optional 2nd series; hover shows values.
export function TrendChart({ series, series2, fmt, color, color2 }: { series: { label: string; value: number }[]; series2?: { label: string; value: number }[]; fmt: (n: number) => string; color: string; color2?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640, H = 168, PAD = 10;
  const pts = [...series.map((p) => p.value), ...(series2?.map((p) => p.value) ?? [])];
  const max = Math.max(1, ...pts);
  const n = Math.max(1, series.length);
  const x = (i: number) => PAD + (i * (W - 2 * PAD)) / Math.max(1, n - 1);
  const y = (v: number) => H - PAD - (v / max) * (H - 2 * PAD);
  const line = (arr: { value: number }[]) => arr.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const areaP = series.length ? `${line(series)} L${x(series.length - 1)},${H - PAD} L${x(0)},${H - PAD} Z` : "";
  // A value label just above (-1) / below (+1) a point, white halo, clamped
  // inside the box. Labels every point so figures read without hovering.
  const ptLabel = (cx: number, cy: number, text: string, fill: string, dir: -1 | 1) => {
    const ly = dir < 0 ? (cy < 18 ? cy + 15 : cy - 8) : (cy > H - 18 ? cy - 8 : cy + 15);
    const half = text.length * 3.2;
    const xc = Math.max(PAD + half, Math.min(W - PAD - half, cx));
    return <text x={xc} y={ly} fontSize="10.5" fontWeight="800" fill={fill} stroke="#fff" strokeWidth="3" paintOrder="stroke" textAnchor="middle">{text}</text>;
  };
  const dots = (arr: { value: number }[], col: string, dir: -1 | 1) =>
    arr.map((p, i) => (p.value > 0 || i === arr.length - 1) ? (
      <g key={`${dir}-${i}`}><circle cx={x(i)} cy={y(p.value)} r="3" fill={col} />{ptLabel(x(i), y(p.value), fmt(p.value), col, dir)}</g>
    ) : null);
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H + 6}`} className="w-full" style={{ overflow: "visible" }}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); const rel = ((e.clientX - r.left) / r.width) * W; setHover(Math.max(0, Math.min(n - 1, Math.round((rel - PAD) / ((W - 2 * PAD) / Math.max(1, n - 1)))))); }}>
        <defs>
          <linearGradient id="ftg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity="0.22" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient>
        </defs>
        {[1, 0.66, 0.33].map((g) => { const yy = y(max * g); return <g key={g}><line x1={PAD} x2={W - PAD} y1={yy} y2={yy} stroke="var(--line)" strokeWidth="1" /><text x={PAD} y={yy - 3} fontSize="9" fill="var(--ink-3)">{fmt(max * g)}</text></g>; })}
        {areaP && <path d={areaP} fill="url(#ftg)" />}
        <path d={line(series)} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" />
        {series2 && <path d={line(series2)} fill="none" stroke={color2} strokeWidth="2.5" strokeLinejoin="round" />}
        {hover != null && <line x1={x(hover)} x2={x(hover)} y1={PAD} y2={H - PAD} stroke="var(--ink-3)" strokeWidth="1" strokeDasharray="3 3" />}
        {dots(series, color, -1)}
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
