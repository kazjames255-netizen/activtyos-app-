"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, get as apiGet } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { money } from "@/features/bookings/helpers";
import { Button, Card, FieldLabel, Select } from "@/components/ui";
import { genDates, groupWeeks, fmtDate } from "@/features/listings/format";
import { mealDayPlan, type MealDayPlan } from "./plan";
import type { SavedMenu } from "./SavedMenus";

// ─────────────────────────────────────────────────────────────────────────
// Menu planner — pick a listing, see its run-days as a calendar, then choose a
// saved menu, tick which dish(es) to serve, and drop them onto days (tap, drag,
// or "every Monday"). Writes the listing's mealsEnabled + mealPlan directly.
// mealPlan[date] = { menuId, itemIds } — the menu and the dishes served that day.
// ─────────────────────────────────────────────────────────────────────────

interface Listing { id: string; title?: string; name?: string; status?: string; archived?: boolean; runFrom?: string; runTo?: string; days?: number[]; datesOff?: string[]; mealsEnabled?: boolean; mealPlan?: Record<string, unknown> }
const WEEKDAYS: [number, string][] = [[1, "Mon"], [2, "Tue"], [3, "Wed"], [4, "Thu"], [5, "Fri"], [6, "Sat"], [0, "Sun"]];

export function MenuPlanner() {
  const [listings, setListings] = useState<Listing[] | null>(null);
  const [menus, setMenus] = useState<SavedMenu[] | null>(null);
  const [listingId, setListingId] = useState("");
  const [mealsOn, setMealsOn] = useState(false);
  const [plan, setPlan] = useState<Record<string, MealDayPlan>>({});
  const [brushMenuId, setBrushMenuId] = useState<string | null>(null);
  const [brushItems, setBrushItems] = useState<Set<string>>(new Set());
  const [erase, setErase] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadLists = useCallback(() => { apiGet<Listing[]>("/api/listings?mine=1").then(setListings).catch((e) => setError(e instanceof Error ? e.message : "Failed to load listings")); }, []);
  const loadMenus = useCallback(() => { apiGet<SavedMenu[]>("/api/meal-menus").then(setMenus).catch(() => setMenus([])); }, []);
  useEffect(() => { loadLists(); loadMenus(); }, [loadLists, loadMenus]);
  useRealtime(["listings", "mealMenus"], () => { loadLists(); loadMenus(); });

  const listing = useMemo(() => (listings ?? []).find((l) => l.id === listingId) ?? null, [listings, listingId]);
  const menusById = useMemo(() => new Map((menus ?? []).map((m) => [m.id, m])), [menus]);
  const brushMenu = brushMenuId ? menusById.get(brushMenuId) : undefined;

  // When a listing is picked, load its saved plan + meals flag.
  useEffect(() => {
    if (!listing) { setPlan({}); setMealsOn(false); return; }
    const raw = (listing.mealPlan ?? {}) as Record<string, unknown>;
    const next: Record<string, MealDayPlan> = {};
    for (const [iso, v] of Object.entries(raw)) { const p = mealDayPlan(v); if (p) next[iso] = p; }
    setPlan(next);
    setMealsOn(!!listing.mealsEnabled);
  }, [listing]);

  const dates = useMemo(() => (listing ? genDates(listing.runFrom ?? "", listing.runTo ?? "", listing.days ?? []).filter((x) => !(listing.datesOff ?? []).includes(x)) : []), [listing]);
  const weeks = useMemo(() => groupWeeks(dates), [dates]);
  const weekdaysPresent = [1, 2, 3, 4, 5, 6, 0].filter((n) => dates.some((iso) => new Date(`${iso}T00:00:00Z`).getUTCDay() === n));

  // Persist the whole plan + flag on every change (fire-and-forget, like Setup).
  const save = useCallback((nextPlan: Record<string, MealDayPlan>, on: boolean) => {
    if (!listingId) return;
    api(`/api/listings/${encodeURIComponent(listingId)}`, { method: "PUT", body: JSON.stringify({ mealsEnabled: on, mealPlan: nextPlan }) }).catch((e) => setError(e instanceof Error ? e.message : "Couldn’t save"));
  }, [listingId]);

  const commit = (nextPlan: Record<string, MealDayPlan>) => { setPlan(nextPlan); save(nextPlan, mealsOn); };
  const setOn = (on: boolean) => { setMealsOn(on); save(plan, on); };

  const pickMenu = (id: string) => {
    setErase(false);
    if (brushMenuId === id) { setBrushMenuId(null); setBrushItems(new Set()); return; }
    setBrushMenuId(id);
    setBrushItems(new Set((menusById.get(id)?.items ?? []).map((it) => it.id))); // default: all dishes
  };
  const toggleBrushItem = (itemId: string) => setBrushItems((s) => { const n = new Set(s); if (n.has(itemId)) n.delete(itemId); else n.add(itemId); return n; });

  const applyTo = (iso: string) => {
    const next = { ...plan };
    if (erase) delete next[iso];
    else if (brushMenuId && brushItems.size) next[iso] = { menuId: brushMenuId, itemIds: [...brushItems] };
    else return;
    commit(next);
  };
  const applyWeekday = (n: number) => {
    if (!erase && (!brushMenuId || !brushItems.size)) return;
    const next = { ...plan };
    for (const iso of dates) if (new Date(`${iso}T00:00:00Z`).getUTCDay() === n) {
      if (erase) delete next[iso]; else next[iso] = { menuId: brushMenuId!, itemIds: [...brushItems] };
    }
    commit(next);
  };
  const clearAll = () => commit({});

  const dayDishes = (iso: string) => { const p = plan[iso]; const menu = p ? menusById.get(p.menuId) : undefined; if (!p || !menu) return null; const items = p.itemIds.length ? menu.items.filter((it) => p.itemIds.includes(it.id)) : menu.items; return { name: menu.name, items }; };
  const planned = dates.filter((iso) => dayDishes(iso)).length;

  const liveListings = (listings ?? []).filter((l) => !l.archived);

  return (
    <div className="mb-6">
      <div className="mb-2 text-[12px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">Menu planner</div>
      <p className="mb-2.5 text-[11.5px] text-[var(--ink-3)]">Pick a camp, then drop a menu’s dishes onto its days. Choose the menu, tick the dish(es), then tap days — or “every Monday”. Parents pick from the day’s dishes at checkout.</p>
      {error && <div className="mb-3 rounded-lg border border-[var(--red-line,#f6c9cc)] bg-[var(--red-soft,#fdebec)] px-3 py-2 text-[12.5px] text-[var(--red,#e21d27)]">{error}</div>}

      <Card className="p-3.5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <FieldLabel>Camp</FieldLabel>
            <Select value={listingId} onChange={(e) => setListingId(e.target.value)} className="w-full">
              <option value="">Choose a camp…</option>
              {liveListings.map((l) => <option key={l.id} value={l.id}>{l.title || l.name || "Untitled"}</option>)}
            </Select>
          </div>
          {listing && (
            <label className="flex cursor-pointer items-center gap-2 pb-1.5">
              <button type="button" role="switch" aria-checked={mealsOn} onClick={() => setOn(!mealsOn)}
                className="relative h-6 w-11 rounded-full transition-colors" style={{ background: mealsOn ? "var(--brand-2,#2f6bd8)" : "#cbd5e1" }}>
                <span className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all" style={{ left: mealsOn ? "22px" : "2px" }} />
              </button>
              <span className="text-[12.5px] font-bold text-[var(--ink)]">Offer meals here</span>
            </label>
          )}
        </div>

        {listing && mealsOn && (
          menus === null ? <div className="mt-4 py-4 text-center text-[12px] text-[var(--ink-3)]">Loading menus…</div>
          : menus.length === 0 ? <div className="mt-4 rounded-xl border border-dashed border-[var(--line)] bg-[#f7faff] p-4 text-center text-[12.5px] text-[var(--ink-2)]">Build a menu in <b>Saved menus</b> below first, then come back to plan the days.</div>
          : dates.length === 0 ? <div className="mt-4 rounded-xl border border-dashed border-[var(--line)] bg-[#f7faff] p-4 text-center text-[12.5px] text-[var(--ink-2)]">This camp has no run dates yet — set them in the listing’s <b>When it runs</b> step.</div>
          : (
            <div className="mt-4 grid items-start gap-4 md:grid-cols-[300px_1fr]">
              {/* Menu + dish picker (the brush) */}
              <div className="rounded-xl border border-[var(--line)] p-3">
                <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">1 · Choose a menu</div>
                <div className="flex flex-wrap gap-1.5">
                  {menus.map((m) => (
                    <button key={m.id} type="button" onClick={() => pickMenu(m.id)} className="rounded-full border px-2.5 py-1 text-[12px] font-bold"
                      style={brushMenuId === m.id ? { borderColor: "#2f6bd8", background: "#eef4fd", color: "#1d3a8f" } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>
                      {brushMenuId === m.id ? "✓ " : ""}{m.name}
                    </button>
                  ))}
                </div>
                {brushMenu && (
                  <div className="mt-3">
                    <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">2 · Which dish(es)?</div>
                    <div className="flex flex-col gap-1">
                      {brushMenu.items.map((it) => {
                        const on = brushItems.has(it.id);
                        return (
                          <button key={it.id} type="button" onClick={() => toggleBrushItem(it.id)} className="flex items-center gap-2 rounded-lg border px-2 py-1 text-left text-[12px]"
                            style={on ? { borderColor: "#2f6bd8", background: "#eef4fd" } : { borderColor: "var(--line)" }}>
                            <span className="flex h-4 w-4 items-center justify-center rounded border text-[10px]" style={{ borderColor: on ? "#2f6bd8" : "var(--line)", background: on ? "#2f6bd8" : "#fff", color: "#fff" }}>{on ? "✓" : ""}</span>
                            <span className="font-bold">{it.name}</span>
                            <span className="tabular-nums text-[var(--ink-3)]">{money(it.price)}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div className="mt-3 border-t border-[var(--line)] pt-2.5">
                  <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">3 · Apply to every…</div>
                  <div className="flex flex-wrap gap-1.5">
                    {weekdaysPresent.map((n) => (
                      <button key={n} type="button" disabled={erase ? false : !(brushMenuId && brushItems.size)} onClick={() => applyWeekday(n)} className="rounded-lg border border-[var(--line)] bg-white px-2.5 py-1 text-[12px] font-bold text-[var(--ink-2)] disabled:opacity-40">{WEEKDAYS.find(([w]) => w === n)?.[1]}</button>
                    ))}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <button type="button" onClick={() => { setErase((e) => !e); setBrushMenuId(null); setBrushItems(new Set()); }} className="rounded-full border px-2.5 py-1 text-[11.5px] font-bold" style={erase ? { borderColor: "transparent", background: "#e21d27", color: "#fff" } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>{erase ? "✓ Erasing" : "Erase"}</button>
                    <button type="button" onClick={clearAll} className="text-[11.5px] font-bold text-[var(--red,#e21d27)] underline">Clear all days</button>
                  </div>
                </div>
              </div>

              {/* Calendar */}
              <div className="rounded-xl border border-[var(--line)] p-3">
                <div className="mb-2 text-[12px] font-extrabold text-[var(--ink-2)]">{planned} of {dates.length} days planned</div>
                <div className="flex max-h-[420px] flex-col gap-2 overflow-y-auto pr-1">
                  {weeks.map((w) => (
                    <div key={w.mon} className="overflow-hidden rounded-lg border border-[var(--line)]">
                      <div className="px-3 py-1.5 text-[12px] font-extrabold text-[var(--ink-2)]" style={{ background: "#eef4fd" }}>Week {w.n} <span className="font-semibold opacity-70">· from {fmtDate(w.mon)}</span></div>
                      <div className="grid grid-cols-2 gap-1.5 p-2.5 sm:grid-cols-3">
                        {w.days.map((iso) => {
                          const dd = dayDishes(iso);
                          return (
                            <button key={iso} type="button" onClick={() => applyTo(iso)}
                              onDragOver={(e) => { if (brushMenuId) e.preventDefault(); }}
                              onDrop={(e) => { e.preventDefault(); applyTo(iso); }}
                              className="flex min-h-[58px] flex-col items-start rounded-lg border p-2 text-left"
                              style={dd ? { borderColor: "#2f6bd8", background: "#eef4fd" } : { borderColor: "var(--line)", background: "#fff" }}>
                              <span className="text-[11px] font-extrabold text-[var(--ink-2)]">{fmtDate(iso)}</span>
                              {dd ? <span className="mt-0.5 text-[11px] font-bold text-[#1d3a8f]">{dd.items.map((i) => i.name).join(", ")}</span>
                                : <span className="mt-0.5 text-[11px] text-[var(--ink-3)]">— tap to add —</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )
        )}
      </Card>
    </div>
  );
}
