"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { get as apiGet } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { money } from "@/features/bookings/helpers";
import { Select } from "@/components/ui";
import { fmtDate, mondayOf } from "@/features/listings/format";

// ─────────────────────────────────────────────────────────────────────────
// Meal report — who chose which meal and totals per day, viewable daily,
// weekly, or as a total for a listing. Reads /api/meal-orders/report (meals
// bought at checkout, stored on bookings) and aggregates client-side.
// ─────────────────────────────────────────────────────────────────────────

interface Row { listingId: string | null; listingName: string; date: string; child: string; dish: string; price: number }
type View = "daily" | "weekly" | "total";

const fmtDay = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

export function MealReport() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [listingId, setListingId] = useState("");
  const [view, setView] = useState<View>("daily");

  const load = useCallback(() => { apiGet<Row[]>("/api/meal-orders/report").then(setRows).catch(() => setRows([])); }, []);
  useEffect(() => { load(); }, [load]);
  useRealtime(["bookings"], load);

  const listings = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows ?? []) if (r.listingId) m.set(r.listingId, r.listingName);
    return [...m].map(([id, name]) => ({ id, name }));
  }, [rows]);
  const filtered = useMemo(() => (rows ?? []).filter((r) => !listingId || r.listingId === listingId), [rows, listingId]);
  const grand = filtered.length;
  const spend = filtered.reduce((s, r) => s + r.price, 0);

  if (!rows) return null;

  const chip = (text: string) => <span className="rounded-full bg-[#eef4fd] px-2 py-0.5 text-[11.5px] font-extrabold text-[#1d3a8f]">{text}</span>;
  const emptyCard = (
    <div className="rounded-xl border border-dashed border-[var(--line)] bg-[#f7faff] p-5 text-center">
      <div className="text-[13px] font-extrabold text-[var(--ink-2)]">No meals booked yet — 0 meals</div>
      <div className="mt-0.5 text-[11.5px] text-[var(--ink-3)]">Once families add meals at checkout, each day shows the dish totals and which children chose them.</div>
    </div>
  );

  // Daily: date → dish → { count, children }
  const daily = () => {
    const byDate = new Map<string, Map<string, { count: number; children: string[] }>>();
    for (const r of filtered) {
      const dm = byDate.get(r.date) ?? new Map(); byDate.set(r.date, dm);
      const e = dm.get(r.dish) ?? { count: 0, children: [] }; e.count++; e.children.push(r.child); dm.set(r.dish, e);
    }
    return [...byDate.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([date, dm]) => {
      const total = [...dm.values()].reduce((s, e) => s + e.count, 0);
      return (
        <div key={date} className="rounded-xl border border-[var(--line)] p-3">
          <div className="mb-1.5 flex items-center gap-2"><span className="text-[13px] font-extrabold text-[var(--ink)]">{fmtDay(date)}</span>{chip(`${total} meal${total === 1 ? "" : "s"}`)}</div>
          <div className="flex flex-col gap-1.5">
            {[...dm.entries()].sort((a, b) => b[1].count - a[1].count).map(([dish, e]) => (
              <div key={dish} className="flex flex-wrap items-baseline gap-2 text-[12px]">
                <span className="rounded-full bg-[var(--panel)] px-2 py-0.5 font-extrabold text-[var(--ink)]">{dish} × {e.count}</span>
                <span className="text-[var(--ink-3)]">{e.children.join(", ")}</span>
              </div>
            ))}
          </div>
        </div>
      );
    });
  };

  // Weekly: week → dish → count
  const weekly = () => {
    const byWeek = new Map<string, Map<string, number>>();
    for (const r of filtered) { const w = mondayOf(r.date); const dm = byWeek.get(w) ?? new Map(); byWeek.set(w, dm); dm.set(r.dish, (dm.get(r.dish) ?? 0) + 1); }
    return [...byWeek.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([w, dm]) => {
      const total = [...dm.values()].reduce((s, n) => s + n, 0);
      return (
        <div key={w} className="rounded-xl border border-[var(--line)] p-3">
          <div className="mb-1.5 flex items-center gap-2"><span className="text-[13px] font-extrabold text-[var(--ink)]">Week of {fmtDate(w)}</span>{chip(`${total} meal${total === 1 ? "" : "s"}`)}</div>
          <div className="flex flex-wrap gap-1.5">
            {[...dm.entries()].sort((a, b) => b[1] - a[1]).map(([dish, n]) => <span key={dish} className="rounded-full bg-[var(--panel)] px-2.5 py-1 text-[12px] font-extrabold text-[var(--ink)]">{dish} × {n}</span>)}
          </div>
        </div>
      );
    });
  };

  // Total: dish → count (across the whole listing / all)
  const total = () => {
    const dm = new Map<string, number>();
    for (const r of filtered) dm.set(r.dish, (dm.get(r.dish) ?? 0) + 1);
    return (
      <div className="rounded-xl border border-[var(--line)] p-3">
        <div className="flex flex-col gap-1">
          {[...dm.entries()].sort((a, b) => b[1] - a[1]).map(([dish, n]) => (
            <div key={dish} className="flex items-baseline justify-between text-[13px]"><span className="font-bold text-[var(--ink)]">{dish}</span><span className="font-extrabold tabular-nums text-[#1d3a8f]">× {n}</span></div>
          ))}
        </div>
        <div className="mt-2.5 flex items-baseline justify-between border-t border-[var(--line)] pt-2.5 text-[13px]">
          <span className="font-extrabold text-[var(--ink)]">{grand} meals total</span>
          <span className="font-extrabold tabular-nums text-[#0e9a75]">{money(spend)}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="mt-7 border-t border-[var(--line)] pt-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <div className="text-[11px] font-extrabold uppercase tracking-[0.05em] text-[var(--ink-3)]">Meal orders</div>
        {listings.length > 1 && (
          <Select value={listingId} onChange={(e) => setListingId(e.target.value)} className="!py-1.5 !text-[12px]">
            <option value="">All listings</option>
            {listings.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </Select>
        )}
        <div className="ml-auto flex gap-1">
          {(["daily", "weekly", "total"] as View[]).map((v) => (
            <button key={v} type="button" onClick={() => setView(v)} className="rounded-full px-3 py-1 text-[12px] font-extrabold capitalize transition"
              style={view === v ? { background: "linear-gradient(180deg,#4f8bf5,#2f6bd8)", color: "#fff" } : { background: "var(--panel)", color: "var(--ink-2)", border: "1px solid var(--line)" }}>{v}</button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-2.5">
        {filtered.length === 0 ? emptyCard : view === "daily" ? daily() : view === "weekly" ? weekly() : total()}
      </div>
    </div>
  );
}
