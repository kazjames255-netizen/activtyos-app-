"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { get as apiGet } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { money } from "@/features/bookings/helpers";
import { Card } from "@/components/ui";
import { groupWeeks, fmtDate } from "@/features/listings/format";

// ─────────────────────────────────────────────────────────────────────────
// Parent Meals — view-only. "What's on" shows the menu on the family's booked
// days; a tab appears for each child who has actually chosen a meal, and that
// tab shows only that child's chosen meals. Meals are bought at checkout.
// ─────────────────────────────────────────────────────────────────────────

interface MenuItem { id: string; name: string; price: number; allergens?: string[]; description?: string }
interface MealDay { tenantId: string; tenantName: string; listingId: string; listingName: string; date: string; children: string[]; menu: { id: string; name: string; items: MenuItem[] }; served: boolean }
interface Booking { child?: string; listingId?: string; mealItems?: { date: string; name: string; price: number }[] }

const fmtDay = (iso: string) => (iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }) : "");
const WEEK_PAL: [string, string][] = [["#2f6bd8", "#5b9bff"], ["#0ea5a5", "#3fd0c9"], ["#7a5af8", "#a88bff"], ["#e2559a", "#ff86c0"], ["#f5872b", "#ffb166"], ["#16a34a", "#4ade80"]];

export function ParentMealsApp() {
  const [days, setDays] = useState<MealDay[] | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<string>(""); // "" = What's on; else a child's name

  const load = useCallback(() => {
    apiGet<MealDay[]>("/api/my/meal-days").then(setDays).catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
    apiGet<Booking[]>("/api/my/bookings").then(setBookings).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);
  useRealtime(["listings", "bookings"], load);

  const served = useMemo(() => (days ?? []).filter((d) => d.served), [days]);
  // Price + allergens for a dish on a date, from the served menus.
  const dishInfo = useMemo(() => { const m = new Map<string, MenuItem>(); for (const d of served) for (const it of d.menu.items) m.set(`${d.date}|${it.name}`, it); return m; }, [served]);

  // A tab per child who has actually CHOSEN a meal (not every booked name).
  const kidsWithMeals = useMemo(() => [...new Set(bookings.filter((b) => (b.mealItems?.length ?? 0) > 0).map((b) => b.child).filter((c): c is string => !!c))].sort((a, b) => a.localeCompare(b)), [bookings]);

  // ── "What's on" data: the full menu, week by week ──
  const byDate = useMemo(() => { const m = new Map<string, MealDay[]>(); for (const d of served) { const a = m.get(d.date) ?? []; a.push(d); m.set(d.date, a); } return m; }, [served]);
  const menuWeeks = useMemo(() => groupWeeks([...byDate.keys()]), [byDate]);

  // ── Child tab data: only the meals this child chose ──
  const chosenByDate = useMemo(() => {
    const m = new Map<string, { name: string; price: number; allergens?: string[] }[]>();
    if (!tab) return m;
    for (const b of bookings) { if (b.child !== tab) continue; for (const it of (b.mealItems ?? [])) { const info = dishInfo.get(`${it.date}|${it.name}`); const a = m.get(it.date) ?? []; a.push({ name: it.name, price: it.price, allergens: info?.allergens }); m.set(it.date, a); } }
    return m;
  }, [tab, bookings, dishInfo]);
  const chosenWeeks = useMemo(() => groupWeeks([...chosenByDate.keys()]), [chosenByDate]);

  const chosenCount = [...chosenByDate.values()].reduce((s, a) => s + a.length, 0);

  return (
    <div className="text-[var(--ink)]">
      <div className="relative mb-3.5 overflow-hidden rounded-2xl p-5 text-white shadow-[0_10px_30px_-12px_rgba(29,58,143,.55)]" style={{ background: "linear-gradient(120deg,#1d3a8f 0%,#3f78d8 62%,#ffffff 100%)" }}>
        <div className="flex items-center gap-2 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-[17px]">🍽️</span>Meals
        </div>
        <p className="mt-1.5 max-w-[560px] text-[12.5px] leading-[1.5] text-white/85">What’s on the menu on your children’s booked days, and the meals each child has chosen. You add meals when you book — allergens shown on every item.</p>
      </div>
      {error && <div className="mb-3 rounded-lg border border-[var(--red-line,#f6c9cc)] bg-[var(--red-soft,#fdebec)] px-3 py-2 text-[12.5px] text-[var(--red,#e21d27)]">{error}</div>}

      {/* Tabs — What's on + a tab per child who chose a meal */}
      {kidsWithMeals.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {[["", "What’s on"], ...kidsWithMeals.map((k) => [k, k] as [string, string])].map(([key, label]) => {
            const on = tab === key;
            return (
              <button key={key} type="button" onClick={() => setTab(key)} className="rounded-full px-3.5 py-1.5 text-[12.5px] font-extrabold transition"
                style={on ? { background: "linear-gradient(180deg,#4f8bf5,#2f6bd8)", color: "#fff", boxShadow: "0 4px 12px -3px rgba(47,107,216,.6)" } : { background: "var(--panel)", color: "var(--ink-2)", border: "1px solid var(--line)" }}>
                {key === "" ? "📅 " : "🧒 "}{label}
              </button>
            );
          })}
        </div>
      )}

      {!days ? <div className="py-6 text-center text-[12px] text-[var(--ink-3)]">Loading…</div>
      : tab ? (
        // ── A child's chosen meals ──
        chosenByDate.size === 0
          ? <Card className="p-6 text-center text-[13px] text-[var(--ink-3)]">{tab} hasn’t had any meals added yet — add them when you book.</Card>
          : (
            <>
              <div className="mb-2 text-[12px] text-[var(--ink-3)]"><b className="text-[var(--ink)]">{tab}</b> — {chosenCount} meal{chosenCount === 1 ? "" : "s"} chosen</div>
              <div className="flex flex-col gap-3">
                {chosenWeeks.map((w, wi) => {
                  const [c1, c2] = WEEK_PAL[wi % WEEK_PAL.length];
                  return (
                    <div key={w.mon} className="overflow-hidden rounded-2xl border-2 border-[var(--line)] bg-white">
                      <div className="flex items-center gap-2 px-3.5 py-2.5 text-white" style={{ background: `linear-gradient(120deg, ${c1}, ${c2})` }}>
                        <span className="grid h-7 w-7 flex-none place-items-center rounded-full bg-white/25 text-[13px]">📅</span>
                        <span className="text-[14px] font-extrabold">Week {w.n}</span><span className="text-[12px] font-semibold text-white/85">· from {fmtDate(w.mon)}</span>
                      </div>
                      <div className="grid gap-2.5 p-3 sm:grid-cols-2 lg:grid-cols-3">
                        {w.days.map((iso) => (
                          <div key={iso} className="rounded-xl border border-[var(--line)] p-3" style={{ background: `${c1}0d` }}>
                            <div className="text-[12.5px] font-extrabold" style={{ color: c1 }}>{fmtDay(iso)}</div>
                            <div className="mt-1.5 flex flex-col gap-1">
                              {(chosenByDate.get(iso) ?? []).map((it, i) => (
                                <div key={`${it.name}-${i}`} className="flex flex-wrap items-baseline gap-1.5 text-[12px]">
                                  <span className="text-[#0e9a5a]">✓</span><span className="font-bold">{it.name}</span>
                                  {it.price > 0 && <span className="tabular-nums text-[var(--ink-2)]">{money(it.price)}</span>}
                                  {(it.allergens?.length ?? 0) > 0 && <span className="rounded-full bg-[var(--red-soft,#fdebec)] px-1.5 py-[1px] text-[10px] font-bold capitalize text-[var(--red,#e21d27)]">⚠ {it.allergens!.join(", ")}</span>}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )
      ) : served.length === 0 ? (
        <Card className="p-6 text-center text-[13px] text-[var(--ink-3)]">No menus to show yet — the day’s menu appears here for listings your provider offers meals on. You can add meals when you book.</Card>
      ) : (
        // ── "What's on": the full menu, all booked days ──
        <div className="flex flex-col gap-3">
          {menuWeeks.map((w, wi) => {
            const [d1, d2] = WEEK_PAL[wi % WEEK_PAL.length];
            return (
              <div key={w.mon} className="overflow-hidden rounded-2xl border-2 border-[var(--line)] bg-white">
                <div className="flex items-center gap-2 px-3.5 py-2.5 text-white" style={{ background: `linear-gradient(120deg, ${d1}, ${d2})` }}>
                  <span className="grid h-7 w-7 flex-none place-items-center rounded-full bg-white/25 text-[13px]">📅</span>
                  <span className="text-[14px] font-extrabold">Week {w.n}</span><span className="text-[12px] font-semibold text-white/85">· from {fmtDate(w.mon)}</span>
                </div>
                <div className="grid gap-2.5 p-3 sm:grid-cols-2 lg:grid-cols-3">
                  {w.days.map((iso) => (
                    <div key={iso} className="rounded-xl border border-[var(--line)] p-3" style={{ background: `${d1}0d` }}>
                      <div className="text-[12.5px] font-extrabold" style={{ color: d1 }}>{fmtDay(iso)}</div>
                      <div className="mt-1.5 flex flex-col gap-2.5">
                        {(byDate.get(iso) ?? []).map((e) => (
                          <div key={`${e.listingId}`}>
                            <div className="text-[10.5px] font-bold uppercase tracking-[0.03em] text-[var(--ink-3)]">{e.listingName} · {e.menu.name}</div>
                            <div className="mt-1 flex flex-col gap-1">
                              {e.menu.items.map((it) => (
                                <div key={it.id} className="flex flex-wrap items-baseline gap-1.5 text-[12px]">
                                  <span className="font-bold">{it.name}</span>
                                  <span className="tabular-nums text-[var(--ink-2)]">{money(it.price)}</span>
                                  {(it.allergens?.length ?? 0) > 0 && <span className="rounded-full bg-[var(--red-soft,#fdebec)] px-1.5 py-[1px] text-[10px] font-bold capitalize text-[var(--red,#e21d27)]">⚠ {it.allergens!.join(", ")}</span>}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
