"use client";

// "Sales pipeline" — the HQ dashboard's read on the Sales board. Five rows
// (new leads → contacted → demos → trials → won) across a run of periods,
// oldest on the left and the current one on the right, so each row IS the
// trend: is this week better than last, is September beating August.
//
// The period tabs change the BUCKET, not the query — days, weeks, months or
// calendar years all come out of the same lead list, so the numbers can't
// disagree between views.
//
// Computed from GET /api/platform/leads (the same list the board loads — leads
// are a small collection with their activities embedded, so this needs no
// endpoint of its own and no second source of truth).
//
// Where each number comes from, because they are NOT all the same kind of fact:
//   New        — leads created in the bucket (createdAt). Exact.
//   Contacted  — leads with a call/email/social activity logged in the bucket.
//                Exact, and deliberately activity-based: "contacted" is a thing
//                someone DID, not a column a card happens to sit in.
//   Demo       — a demo activity logged, or a move into the demo stage.
//   Trial/Won  — moves into those stages, from the stageLog the server stamps
//                (routes/platformLeads.ts). Leads that moved before that log
//                existed can't be dated, so they're left out rather than dumped
//                on whichever bucket they were last edited in.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { get as apiGet } from "@/lib/api";

type Stage = "new" | "contacted" | "interested" | "demo" | "trial" | "won" | "lost";
interface Activity { type: "call" | "email" | "social" | "demo" | "note"; at: string }
interface Lead {
  id: string;
  business?: string;
  stage?: Stage;
  estMrr?: number;
  activities?: Activity[];
  stageLog?: { from: string; to: string; at: string }[];
  createdAt?: string;
  updatedAt?: string;
}

const OUTREACH = new Set(["call", "email", "social"]);
const money = (n: number) => (n >= 1000 ? `£${(n / 1000).toFixed(1)}k` : `£${Math.round(n)}`);

interface Metric { key: string; label: string; glyph: string; colour: string; match: (l: Lead, from: number, to: number) => boolean }

const inWin = (iso: string | undefined, from: number, to: number) => {
  const t = iso ? Date.parse(iso) : NaN;
  return !Number.isNaN(t) && t >= from && t < to;
};
const movedTo = (l: Lead, stage: Stage, from: number, to: number) =>
  (l.stageLog ?? []).some((m) => m.to === stage && inWin(m.at, from, to));

const METRICS: Metric[] = [
  { key: "new", label: "New leads", glyph: "✨", colour: "#2f5fd0", match: (l, f, t) => inWin(l.createdAt, f, t) },
  { key: "contacted", label: "Contacted", glyph: "📞", colour: "#0e7490", match: (l, f, t) => (l.activities ?? []).some((a) => OUTREACH.has(a.type) && inWin(a.at, f, t)) || movedTo(l, "contacted", f, t) },
  { key: "demo", label: "Demos", glyph: "🖥️", colour: "#5a3fd0", match: (l, f, t) => (l.activities ?? []).some((a) => a.type === "demo" && inWin(a.at, f, t)) || movedTo(l, "demo", f, t) },
  { key: "trial", label: "Trials", glyph: "🎁", colour: "#b45309", match: (l, f, t) => movedTo(l, "trial", f, t) },
  { key: "won", label: "Won", glyph: "🏆", colour: "#0f7a43", match: (l, f, t) => movedTo(l, "won", f, t) },
];

// ── Periods ────────────────────────────────────────────────────────────────
// Every view is "the last N buckets, current one last". Boundaries are LOCAL
// (the operator's midnight, Monday and 1st of the month), not UTC — otherwise
// anything logged in the evening lands on the wrong day.
type PeriodId = "7d" | "3w" | "3m" | "6m" | "12m" | "yoy";
const PERIODS: { id: PeriodId; tab: string; note: string }[] = [
  { id: "7d", tab: "7 days", note: "Day by day" },
  { id: "3w", tab: "3 weeks", note: "Week by week" },
  { id: "3m", tab: "3 months", note: "Month by month" },
  { id: "6m", tab: "6 months", note: "Month by month" },
  { id: "12m", tab: "12 months", note: "Month by month" },
  { id: "yoy", tab: "Year on year", note: "Calendar years" },
];

interface Bucket { from: number; to: number; label: string; current: boolean }

const midnight = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
// Monday-start weeks: getDay() is 0 for Sunday, so shift it back six days.
const weekStart = (d: Date) => { const x = midnight(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };

function buildBuckets(nowMs: number, period: PeriodId): Bucket[] {
  const now = new Date(nowMs);
  const out: Bucket[] = [];

  if (period === "7d") {
    for (let back = 6; back >= 0; back--) {
      const from = midnight(now); from.setDate(from.getDate() - back);
      const to = new Date(from); to.setDate(to.getDate() + 1);
      out.push({
        from: from.getTime(), to: to.getTime(), current: back === 0,
        label: back === 0 ? "Today" : back === 1 ? "Yest." : `${from.toLocaleDateString("en-GB", { weekday: "short" })} ${from.getDate()}`,
      });
    }
    return out;
  }

  if (period === "3w") {
    for (let back = 2; back >= 0; back--) {
      const from = weekStart(now); from.setDate(from.getDate() - back * 7);
      const to = new Date(from); to.setDate(to.getDate() + 7);
      out.push({
        from: from.getTime(), to: to.getTime(), current: back === 0,
        label: back === 0 ? "This week" : back === 1 ? "Last week" : `w/c ${from.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`,
      });
    }
    return out;
  }

  if (period === "yoy") {
    const thisYear = now.getFullYear();
    for (let back = 2; back >= 0; back--) {
      const y = thisYear - back;
      out.push({
        from: new Date(y, 0, 1).getTime(), to: new Date(y + 1, 0, 1).getTime(),
        current: back === 0, label: `${y}`,
      });
    }
    return out;
  }

  const months = period === "3m" ? 3 : period === "6m" ? 6 : 12;
  for (let back = months - 1; back >= 0; back--) {
    const from = new Date(now.getFullYear(), now.getMonth() - back, 1);
    const to = new Date(from.getFullYear(), from.getMonth() + 1, 1);
    // Year only when the run crosses one, so "Sept" doesn't become "Sept 26".
    const crossesYear = months > 12 - now.getMonth();
    out.push({
      from: from.getTime(), to: to.getTime(), current: back === 0,
      label: from.toLocaleDateString("en-GB", { month: "short" }) + (crossesYear ? ` ${`${from.getFullYear()}`.slice(2)}` : ""),
    });
  }
  return out;
}

export function PipelineSummaryCard() {
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [period, setPeriod] = useState<PeriodId>("7d");
  // A stable "now" so the bucket boundaries can't shift mid-render.
  const [nowMs] = useState(() => Date.now());
  const load = useCallback(() => {
    apiGet<Lead[]>("/api/platform/leads").then((l) => setLeads(l ?? [])).catch(() => setLeads([]));
  }, []);
  useEffect(load, [load]);

  const { buckets, grid, rowTotals, colTotals, grandTotal, open, openValue } = useMemo(() => {
    const list = leads ?? [];
    const buckets = buildBuckets(nowMs, period);
    const grid = METRICS.map((m) => buckets.map((b) => list.filter((l) => m.match(l, b.from, b.to)).length));
    const live = list.filter((l) => l.stage !== "won" && l.stage !== "lost");
    const colTotals = buckets.map((_, i) => grid.reduce((sum, row) => sum + row[i], 0));
    return {
      buckets,
      grid,
      rowTotals: grid.map((row) => row.reduce((a, b) => a + b, 0)),
      colTotals,
      grandTotal: colTotals.reduce((a, b) => a + b, 0),
      open: live.length,
      openValue: live.reduce((s, l) => s + (l.estMrr ?? 0), 0),
    };
  }, [leads, nowMs, period]);

  const note = PERIODS.find((p) => p.id === period)?.note ?? "";
  // 13 columns of months need more room than 7 of days before scrolling starts.
  const minW = buckets.length > 7 ? 760 : 520;

  return (
    <div className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-[0_1px_2px_rgba(16,32,90,.04)]">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-[var(--line)] px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <span aria-hidden className="flex h-7 w-7 flex-none items-center justify-center rounded-xl text-[14px] leading-none shadow-sm" style={{ background: "linear-gradient(150deg,#4f8bf5,#1d3a8f)" }}>💼</span>
          <h3 className="m-0 truncate text-[14px] font-extrabold leading-tight text-[var(--ink)]" style={{ fontFamily: "var(--ff-display)" }}>Sales pipeline</h3>
          <span className="flex-none rounded-full bg-[var(--panel)] px-2 py-0.5 text-[10.5px] font-extrabold text-[var(--ink-2)]">{note}</span>
        </div>
        <div className="flex flex-none items-center gap-3">
          <span className="hidden text-[11px] font-bold text-[var(--ink-3)] sm:inline">
            {leads === null ? "…" : <>{open} open · <span className="text-[var(--ink-2)]">{money(openValue)}</span>/mo in play</>}
          </span>
          <button type="button" onClick={() => router.push("/platform/sales")} className="text-[11px] font-bold text-[var(--brand)] hover:underline">Open pipeline →</button>
        </div>
      </div>

      {/* Period tabs — same buckets, different width of lens. */}
      <div className="flex flex-wrap gap-1 border-b border-[var(--line)] px-3 py-2">
        {PERIODS.map((p) => {
          const on = p.id === period;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriod(p.id)}
              aria-pressed={on}
              className="rounded-full px-3 py-1 text-[11.5px] font-extrabold transition-colors"
              style={on
                ? { background: "linear-gradient(180deg,#4f8bf5,#2f6bd8)", color: "#fff" }
                : { color: "var(--ink-2)", background: "var(--panel)" }}
            >
              {p.tab}
            </button>
          );
        })}
      </div>

      {leads === null ? (
        <div className="py-6 text-center text-[12px] text-[var(--ink-3)]">Loading the pipeline…</div>
      ) : (
        // Wide runs don't fit a phone: the grid scrolls inside itself rather
        // than pushing the whole dashboard sideways.
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[12px]" style={{ minWidth: minW }}>
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-[var(--surface)] px-4 py-2 text-left text-[10px] font-extrabold uppercase tracking-[0.06em] text-[var(--ink-3)]">&nbsp;</th>
                {buckets.map((b) => (
                  <th
                    key={b.from}
                    className="px-2 py-2 text-center text-[10px] font-extrabold uppercase tracking-[0.04em]"
                    style={{ color: b.current ? "var(--ink)" : "var(--ink-3)", background: b.current ? "rgba(47,95,208,.06)" : undefined }}
                  >
                    {b.label}
                  </th>
                ))}
                <th className="px-3 py-2 text-center text-[10px] font-extrabold uppercase tracking-[0.06em] text-[var(--ink-3)]">Total</th>
              </tr>
            </thead>
            <tbody>
              {METRICS.map((m, r) => {
                const row = grid[r];
                const peak = Math.max(1, ...row);
                return (
                  <tr key={m.key} className="border-t border-[var(--line)]">
                    <td className="sticky left-0 z-10 whitespace-nowrap bg-[var(--surface)] px-4 py-2">
                      <span className="flex items-center gap-1.5 text-[12px] font-bold">
                        <span aria-hidden>{m.glyph}</span>
                        <span style={{ color: m.colour }}>{m.label}</span>
                      </span>
                    </td>
                    {row.map((n, i) => (
                      <td
                        key={i}
                        className="px-2 py-2 text-center"
                        title={`${n} ${m.label.toLowerCase()} · ${buckets[i].label}`}
                        // Heat by the row's own busiest bucket, so a row with
                        // small numbers still shows its shape instead of blank.
                        style={{ background: n > 0 ? `color-mix(in srgb, ${m.colour} ${Math.round((n / peak) * 16) + 4}%, transparent)` : undefined }}
                      >
                        <span className="text-[14px] font-extrabold tabular-nums" style={{ color: n > 0 ? m.colour : "var(--ink-3)", opacity: n > 0 ? 1 : 0.45 }}>{n}</span>
                      </td>
                    ))}
                    <td className="px-3 py-2 text-center">
                      <span className="text-[14px] font-extrabold tabular-nums text-[var(--ink)]">{rowTotals[r]}</span>
                    </td>
                  </tr>
                );
              })}
              {/* Every bit of pipeline movement in that bucket — the single
                  number that answers "was today busier than yesterday". */}
              <tr className="border-t-2 border-[var(--line)] bg-[var(--panel)]">
                <td className="sticky left-0 z-10 whitespace-nowrap bg-[var(--panel)] px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--ink-2)]">Total</td>
                {colTotals.map((n, i) => (
                  <td key={i} className="px-2 py-2 text-center" style={{ background: buckets[i].current ? "rgba(47,95,208,.06)" : undefined }}>
                    <span className="text-[14px] font-extrabold tabular-nums" style={{ color: n > 0 ? "var(--ink)" : "var(--ink-3)", opacity: n > 0 ? 1 : 0.45 }}>{n}</span>
                  </td>
                ))}
                <td className="px-3 py-2 text-center">
                  <span className="text-[14px] font-extrabold tabular-nums text-[var(--ink)]">{grandTotal}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
      <div className="border-t border-[var(--line)] px-4 py-2 text-[10.5px] text-[var(--ink-3)]">
        Contacted and demos count activity logged in the period; trials and won count stage moves. Moves made before stage history was recorded aren&rsquo;t dated, so they don&rsquo;t appear here.
      </div>
    </div>
  );
}
