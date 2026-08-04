"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, get as apiGet } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { money } from "@/features/bookings/helpers";
import { FieldLabel, Select } from "@/components/ui";
import { MasterCard } from "@/components/OperatorPage";
import { genDates, groupWeeks, fmtDate } from "@/features/listings/format";
import { mealDayPlan, type MealDayPlan } from "./plan";
import type { SavedMenu } from "./SavedMenus";

// ─────────────────────────────────────────────────────────────────────────
// Menu planner — a slideshow-style builder. Step through it like a deck:
//   1 · Camp          — pick a camp, turn meals on
//   2 · Menu & dishes — choose a saved menu, tick the dish(es) to serve
//   3 · Plan the days — drop that onto days (tap, drag, or "every Monday")
// Same data as before; writes the listing's mealsEnabled + mealPlan.
// mealPlan[date] = { menuId, itemIds } — the menu and the dishes served that day.
// ─────────────────────────────────────────────────────────────────────────

interface Listing { id: string; title?: string; name?: string; status?: string; archived?: boolean; runFrom?: string; runTo?: string; days?: number[]; datesOff?: string[]; mealsEnabled?: boolean; mealPlan?: Record<string, unknown> }
const WEEKDAYS: [number, string][] = [[1, "Mon"], [2, "Tue"], [3, "Wed"], [4, "Thu"], [5, "Fri"], [6, "Sat"], [0, "Sun"]];
const STEPS = ["Camp", "Menu & dishes", "Plan the days"];

export function MenuPlanner() {
  const [listings, setListings] = useState<Listing[] | null>(null);
  const [menus, setMenus] = useState<SavedMenu[] | null>(null);
  const [listingId, setListingId] = useState("");
  const [mealsOn, setMealsOn] = useState(false);
  const [plan, setPlan] = useState<Record<string, MealDayPlan>>({});
  const [brushMenuId, setBrushMenuId] = useState<string | null>(null);
  const [brushItems, setBrushItems] = useState<Set<string>>(new Set());
  const [erase, setErase] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const loadLists = useCallback(() => { apiGet<Listing[]>("/api/listings?mine=1").then(setListings).catch((e) => setError(e instanceof Error ? e.message : "Failed to load listings")); }, []);
  const loadMenus = useCallback(() => { apiGet<SavedMenu[]>("/api/meal-menus").then(setMenus).catch(() => setMenus([])); }, []);
  useEffect(() => { loadLists(); loadMenus(); }, [loadLists, loadMenus]);
  useRealtime(["listings", "mealMenus"], () => { loadLists(); loadMenus(); });

  const listing = useMemo(() => (listings ?? []).find((l) => l.id === listingId) ?? null, [listings, listingId]);
  const menusById = useMemo(() => new Map((menus ?? []).map((m) => [m.id, m])), [menus]);
  const brushMenu = brushMenuId ? menusById.get(brushMenuId) : undefined;

  // When the camp changes, load its saved plan + flag and jump back to step 1.
  useEffect(() => {
    if (!listing) { setPlan({}); setMealsOn(false); setStep(0); return; }
    const raw = (listing.mealPlan ?? {}) as Record<string, unknown>;
    const next: Record<string, MealDayPlan> = {};
    for (const [iso, v] of Object.entries(raw)) { const p = mealDayPlan(v); if (p) next[iso] = p; }
    setPlan(next);
    setMealsOn(!!listing.mealsEnabled);
    setStep(0); setBrushMenuId(null); setBrushItems(new Set()); setErase(false);
  }, [listing]);

  const dates = useMemo(() => (listing ? genDates(listing.runFrom ?? "", listing.runTo ?? "", listing.days ?? []).filter((x) => !(listing.datesOff ?? []).includes(x)) : []), [listing]);
  const weeks = useMemo(() => groupWeeks(dates), [dates]);
  const weekdaysPresent = [1, 2, 3, 4, 5, 6, 0].filter((n) => dates.some((iso) => new Date(`${iso}T00:00:00Z`).getUTCDay() === n));

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
    setBrushItems(new Set((menusById.get(id)?.items ?? []).map((it) => it.id)));
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
    for (const iso of dates) if (new Date(`${iso}T00:00:00Z`).getUTCDay() === n) { if (erase) delete next[iso]; else next[iso] = { menuId: brushMenuId!, itemIds: [...brushItems] }; }
    commit(next);
  };
  const clearAll = () => commit({});

  const dayDishes = (iso: string) => { const p = plan[iso]; const menu = p ? menusById.get(p.menuId) : undefined; if (!p || !menu) return null; const items = p.itemIds.length ? menu.items.filter((it) => p.itemIds.includes(it.id)) : menu.items; return { name: menu.name, items }; };
  const planned = dates.filter((iso) => dayDishes(iso)).length;
  const liveListings = (listings ?? []).filter((l) => !l.archived);

  const canStep2 = !!listing && mealsOn && dates.length > 0;
  const brushReady = !!brushMenuId && brushItems.size > 0;
  const canNext = step === 0 ? canStep2 : step === 1 ? brushReady : false;

  // ── header step rail (on the blue gradient) ──
  const rail = (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {STEPS.map((s, i) => {
        const done = i < step, on = i === step;
        const clickable = i <= step || (i === 1 && canStep2) || (i === 2 && brushReady);
        return (
          <button key={s} type="button" disabled={!clickable} onClick={() => clickable && setStep(i)}
            className="rounded-full px-2.5 py-1 text-[11px] font-extrabold transition disabled:opacity-45"
            style={on ? { background: "#fff", color: "#1d3a8f" } : { background: "rgba(255,255,255,.14)", color: "#fff", border: "1px solid rgba(255,255,255,.28)" }}>
            {done ? "✓" : i + 1} · {s}
          </button>
        );
      })}
    </div>
  );

  const dot = (i: number) => <span key={i} className="h-1.5 rounded-full transition-all" style={{ width: i === step ? 22 : 6, background: i === step ? "#2f6bd8" : "var(--line)" }} />;
  const navBtn = "rounded-lg px-3.5 py-2 text-[12.5px] font-extrabold transition disabled:opacity-40";

  return (
    <MasterCard className="mb-4" header={
      <div>
        <div className="flex items-center gap-2 text-[14px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}><span className="text-[15px]">🗓️</span> Menu planner{listing ? <span className="font-semibold text-white/70"> · {listing.title || listing.name}</span> : null}</div>
        {rail}
      </div>
    }>
      {error && <div className="mb-3 rounded-lg border border-[var(--red-line,#f6c9cc)] bg-[var(--red-soft,#fdebec)] px-3 py-2 text-[12.5px] text-[var(--red,#e21d27)]">{error}</div>}

      <div className="min-h-[240px]">
        {/* ── STEP 1 · CAMP ── */}
        {step === 0 && (
          <div>
            <div className="text-[13px] font-extrabold text-[var(--ink)]">Which camp are you planning meals for?</div>
            <p className="mb-3 mt-0.5 text-[11.5px] text-[var(--ink-3)]">Pick a camp and switch meals on — its days appear on the next slides.</p>
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[240px] flex-1">
                <FieldLabel>Camp</FieldLabel>
                <Select value={listingId} onChange={(e) => setListingId(e.target.value)} className="w-full">
                  <option value="">Choose a camp…</option>
                  {liveListings.map((l) => <option key={l.id} value={l.id}>{l.title || l.name || "Untitled"}</option>)}
                </Select>
              </div>
              {listing && (
                <label className="flex cursor-pointer items-center gap-2 pb-1.5">
                  <button type="button" role="switch" aria-checked={mealsOn} onClick={() => setOn(!mealsOn)} className="relative h-6 w-11 rounded-full transition-colors" style={{ background: mealsOn ? "var(--brand-2,#2f6bd8)" : "#cbd5e1" }}>
                    <span className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all" style={{ left: mealsOn ? "22px" : "2px" }} />
                  </button>
                  <span className="text-[12.5px] font-bold text-[var(--ink)]">Offer meals here</span>
                </label>
              )}
            </div>
            {listing && mealsOn && dates.length === 0 && <div className="mt-3 rounded-xl border border-dashed border-[var(--line)] bg-[#f7faff] p-3.5 text-center text-[12px] text-[var(--ink-2)]">This camp has no run dates yet — set them in the listing’s <b>When it runs</b> step.</div>}
            {listing && !mealsOn && <div className="mt-3 rounded-xl border border-dashed border-[var(--line)] bg-[#f7faff] p-3.5 text-center text-[12px] text-[var(--ink-2)]">Turn <b>Offer meals here</b> on to start planning.</div>}
            {listing && mealsOn && dates.length > 0 && <div className="mt-3 rounded-xl border border-[var(--line)] bg-[#eef4fd] p-3 text-[12px] font-bold text-[#1d3a8f]">{dates.length} run-days · {planned} already planned — <span className="font-semibold">Next</span> to choose a menu.</div>}
          </div>
        )}

        {/* ── STEP 2 · MENU & DISHES ── */}
        {step === 1 && (
          menus === null ? <div className="py-8 text-center text-[12px] text-[var(--ink-3)]">Loading menus…</div>
          : menus.length === 0 ? <div className="rounded-xl border border-dashed border-[var(--line)] bg-[#f7faff] p-5 text-center text-[12.5px] text-[var(--ink-2)]">Build a menu in <b>Saved menus</b> below first, then come back.</div>
          : (
            <div>
              <div className="text-[13px] font-extrabold text-[var(--ink)]">Choose a menu, then tick the dish(es) to serve</div>
              <p className="mb-3 mt-0.5 text-[11.5px] text-[var(--ink-3)]">Parents pick from these dishes at checkout (meat or veg — separate dishes).</p>
              <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">Menu</div>
              <div className="flex flex-wrap gap-1.5">
                {menus.map((m) => (
                  <button key={m.id} type="button" onClick={() => pickMenu(m.id)} className="rounded-full border px-3 py-1.5 text-[12.5px] font-bold"
                    style={brushMenuId === m.id ? { borderColor: "#2f6bd8", background: "#eef4fd", color: "#1d3a8f" } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>
                    {brushMenuId === m.id ? "✓ " : ""}{m.name}
                  </button>
                ))}
              </div>
              {brushMenu && (
                <div className="mt-3.5">
                  <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">Dishes on the day</div>
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {brushMenu.items.map((it) => {
                      const on = brushItems.has(it.id);
                      return (
                        <button key={it.id} type="button" onClick={() => toggleBrushItem(it.id)} className="flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-[12.5px]"
                          style={on ? { borderColor: "#2f6bd8", background: "#eef4fd" } : { borderColor: "var(--line)" }}>
                          <span className="flex h-4 w-4 flex-none items-center justify-center rounded border text-[10px]" style={{ borderColor: on ? "#2f6bd8" : "var(--line)", background: on ? "#2f6bd8" : "#fff", color: "#fff" }}>{on ? "✓" : ""}</span>
                          <span className="font-bold">{it.name}</span>
                          <span className="tabular-nums text-[var(--ink-3)]">{money(it.price)}</span>
                          {(it.allergens?.length ?? 0) > 0 && <span className="ml-auto text-[10px] font-bold capitalize text-[var(--red,#e21d27)]">⚠ {it.allergens!.join(", ")}</span>}
                        </button>
                      );
                    })}
                  </div>
                  {!brushReady && <p className="mt-2 text-[11px] text-[var(--red,#e21d27)]">Pick at least one dish to continue.</p>}
                </div>
              )}
            </div>
          )
        )}

        {/* ── STEP 3 · PLAN THE DAYS ── */}
        {step === 2 && (
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-[13px] font-extrabold text-[var(--ink)]">Drop it onto the days</div>
              <span className="ml-auto rounded-full bg-[#eef4fd] px-2.5 py-1 text-[11px] font-bold text-[#1d3a8f]">{planned} of {dates.length} planned</span>
            </div>
            <div className="mb-3 mt-1 flex flex-wrap items-center gap-2 text-[11.5px]">
              <span className="text-[var(--ink-3)]">Painting:</span>
              {erase ? <span className="font-bold text-[var(--red,#e21d27)]">Erase</span>
                : brushMenu ? <span className="font-bold text-[#1d3a8f]">{brushMenu.name} — {brushMenu.items.filter((it) => brushItems.has(it.id)).map((it) => it.name).join(", ")}</span>
                : <span className="text-[var(--ink-3)]">nothing — go back a step to pick a menu</span>}
            </div>

            <div className="mb-3 flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-[11px] font-bold text-[var(--ink-3)]">Every</span>
              {weekdaysPresent.map((n) => (
                <button key={n} type="button" disabled={erase ? false : !brushReady} onClick={() => applyWeekday(n)} className="rounded-lg border border-[var(--line)] bg-white px-2.5 py-1 text-[12px] font-bold text-[var(--ink-2)] disabled:opacity-40">{WEEKDAYS.find(([w]) => w === n)?.[1]}</button>
              ))}
              <span className="mx-1 h-4 w-px bg-[var(--line)]" />
              <button type="button" onClick={() => { setErase((e) => !e); }} className="rounded-full border px-2.5 py-1 text-[11.5px] font-bold" style={erase ? { borderColor: "transparent", background: "#e21d27", color: "#fff" } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>{erase ? "✓ Erasing" : "Erase"}</button>
              <button type="button" onClick={clearAll} className="text-[11.5px] font-bold text-[var(--red,#e21d27)] underline">Clear all</button>
            </div>

            <div className="flex max-h-[360px] flex-col gap-2 overflow-y-auto pr-1">
              {weeks.map((w) => (
                <div key={w.mon} className="overflow-hidden rounded-lg border border-[var(--line)]">
                  <div className="px-3 py-1.5 text-[12px] font-extrabold text-[var(--ink-2)]" style={{ background: "#eef4fd" }}>Week {w.n} <span className="font-semibold opacity-70">· from {fmtDate(w.mon)}</span></div>
                  <div className="grid grid-cols-2 gap-1.5 p-2.5 sm:grid-cols-4">
                    {w.days.map((iso) => {
                      const dd = dayDishes(iso);
                      return (
                        <button key={iso} type="button" onClick={() => applyTo(iso)}
                          onDragOver={(e) => { if (brushMenuId) e.preventDefault(); }} onDrop={(e) => { e.preventDefault(); applyTo(iso); }}
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
        )}
      </div>

      {/* ── slide nav ── */}
      <div className="mt-4 flex items-center justify-between border-t border-[var(--line)] pt-3">
        <button type="button" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))} className={navBtn} style={{ border: "1px solid var(--line)", color: "var(--ink-2)", background: "#fff" }}>‹ Back</button>
        <div className="flex items-center gap-1.5">{[0, 1, 2].map(dot)}</div>
        {step < 2 ? (
          <button type="button" disabled={!canNext} onClick={() => setStep((s) => Math.min(2, s + 1))} className={navBtn} style={{ background: "linear-gradient(180deg,#4f8bf5,#2f6bd8)", color: "#fff", boxShadow: "0 3px 10px -2px rgba(47,107,216,.5)" }}>Next ›</button>
        ) : (
          <button type="button" onClick={() => { setBrushMenuId(null); setBrushItems(new Set()); setErase(false); setStep(1); }} className={navBtn} style={{ border: "1px solid var(--line)", color: "#1d3a8f", background: "#eef4fd" }}>＋ Another menu</button>
        )}
      </div>
    </MasterCard>
  );
}
