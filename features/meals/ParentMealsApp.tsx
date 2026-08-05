"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { get as apiGet } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { money } from "@/features/bookings/helpers";
import { Card } from "@/components/ui";
import { groupWeeks, fmtDate } from "@/features/listings/format";

// ─────────────────────────────────────────────────────────────────────────
// Parent Meals — view-only. "What's on" shows the menu on the family's booked
// days; a tab per child shows that child's booked days and the meal they've
// added (from their bookings). Meals are bought at checkout.
// ─────────────────────────────────────────────────────────────────────────

interface MenuItem { id: string; name: string; price: number; allergens?: string[]; description?: string }
interface MealDay { tenantId: string; tenantName: string; listingId: string; listingName: string; date: string; children: string[]; menu: { id: string; name: string; items: MenuItem[] }; served: boolean }
interface Booking { child?: string; mealItems?: { date: string; name: string; price: number }[] }

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
  const allKids = useMemo(() => [...new Set(served.flatMap((d) => d.children))].sort((a, b) => a.localeCompare(b)), [served]);
  // What each child has actually booked: `${child}|${date}` → set of dish names.
  const ordered = useMemo(() => { const m = new Map<string, Set<string>>(); for (const b of bookings) for (const it of (b.mealItems ?? [])) { const k = `${b.child}|${it.date}`; const s = m.get(k) ?? new Set<string>(); s.add(it.name); m.set(k, s); } return m; }, [bookings]);

  // The days shown for the active tab (all, or just this child's booked days).
  const view = useMemo(() => (tab ? served.filter((d) => d.children.includes(tab)) : served), [served, tab]);
  const byDate = useMemo(() => { const m = new Map<string, MealDay[]>(); for (const d of view) { const a = m.get(d.date) ?? []; a.push(d); m.set(d.date, a); } return m; }, [view]);
  const weeks = useMemo(() => groupWeeks([...byDate.keys()]), [byDate]);
  const orderedCount = tab ? [...byDate.keys()].filter((iso) => (ordered.get(`${tab}|${iso}`)?.size ?? 0) > 0).length : 0;

  return (
    <div className="text-[var(--ink)]">
      <div className="relative mb-3.5 overflow-hidden rounded-2xl p-5 text-white shadow-[0_10px_30px_-12px_rgba(29,58,143,.55)]" style={{ background: "linear-gradient(120deg,#1d3a8f 0%,#3f78d8 62%,#ffffff 100%)" }}>
        <div className="flex items-center gap-2 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-[17px]">🍽️</span>Meals
        </div>
        <p className="mt-1.5 max-w-[560px] text-[12.5px] leading-[1.5] text-white/85">What’s on the menu on your children’s booked days, and what each child has booked. You add meals when you book — allergens shown on every item.</p>
      </div>
      {error && <div className="mb-3 rounded-lg border border-[var(--red-line,#f6c9cc)] bg-[var(--red-soft,#fdebec)] px-3 py-2 text-[12.5px] text-[var(--red,#e21d27)]">{error}</div>}

      {/* Tabs — What's on + one per child */}
      {allKids.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {[["", "What’s on"], ...allKids.map((k) => [k, k] as [string, string])].map(([key, label]) => {
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
      {tab && <div className="mb-2 text-[12px] text-[var(--ink-3)]">{tab} has <b className="text-[var(--ink)]">{orderedCount}</b> of {byDate.size} booked day{byDate.size === 1 ? "" : "s"} with a meal added.</div>}

      {!days ? <div className="py-6 text-center text-[12px] text-[var(--ink-3)]">Loading…</div>
      : view.length === 0 ? (
        <Card className="p-6 text-center text-[13px] text-[var(--ink-3)]">{tab ? `Nothing on the menu for ${tab}’s booked days yet.` : "No menus to show yet — the day’s menu appears here for listings your provider offers meals on. You can add meals when you book."}</Card>
      ) : (
        <div className="flex flex-col gap-3">
          {weeks.map((w, wi) => {
            const [d1, d2] = WEEK_PAL[wi % WEEK_PAL.length];
            return (
              <div key={w.mon} className="overflow-hidden rounded-2xl border-2 border-[var(--line)] bg-white">
                <div className="flex items-center gap-2 px-3.5 py-2.5 text-white" style={{ background: `linear-gradient(120deg, ${d1}, ${d2})` }}>
                  <span className="grid h-7 w-7 flex-none place-items-center rounded-full bg-white/25 text-[13px]">📅</span>
                  <span className="text-[14px] font-extrabold">Week {w.n}</span>
                  <span className="text-[12px] font-semibold text-white/85">· from {fmtDate(w.mon)}</span>
                </div>
                <div className="grid gap-2.5 p-3 sm:grid-cols-2 lg:grid-cols-3">
                  {w.days.map((iso) => {
                    const mine = tab ? (ordered.get(`${tab}|${iso}`) ?? new Set<string>()) : null;
                    return (
                      <div key={iso} className="rounded-xl border border-[var(--line)] p-3" style={{ background: `${d1}0d` }}>
                        <div className="flex items-center gap-2">
                          <span className="text-[12.5px] font-extrabold" style={{ color: d1 }}>{fmtDay(iso)}</span>
                          {mine && (mine.size > 0
                            ? <span className="rounded-full bg-[#e8f6ef] px-2 py-[1px] text-[10px] font-extrabold text-[#0e9a5a]">✓ booked</span>
                            : <span className="rounded-full bg-[var(--panel)] px-2 py-[1px] text-[10px] font-bold text-[var(--ink-3)]">no meal added</span>)}
                        </div>
                        <div className="mt-1.5 flex flex-col gap-2.5">
                          {(byDate.get(iso) ?? []).map((e) => (
                            <div key={`${e.listingId}`}>
                              <div className="text-[10.5px] font-bold uppercase tracking-[0.03em] text-[var(--ink-3)]">{e.listingName} · {e.menu.name}</div>
                              <div className="mt-1 flex flex-col gap-1">
                                {e.menu.items.map((it) => {
                                  const booked = mine?.has(it.name);
                                  return (
                                    <div key={it.id} className="flex flex-wrap items-baseline gap-1.5 text-[12px]" style={mine && !booked ? { opacity: 0.5 } : undefined}>
                                      {booked && <span className="text-[#0e9a5a]">✓</span>}
                                      <span className="font-bold">{it.name}</span>
                                      <span className="tabular-nums text-[var(--ink-2)]">{money(it.price)}</span>
                                      {(it.allergens?.length ?? 0) > 0 && <span className="rounded-full bg-[var(--red-soft,#fdebec)] px-1.5 py-[1px] text-[10px] font-bold capitalize text-[var(--red,#e21d27)]">⚠ {it.allergens!.join(", ")}</span>}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
