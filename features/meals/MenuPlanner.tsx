"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, get as apiGet } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { useSettings } from "@/lib/settings";
import { money } from "@/features/bookings/helpers";
import { FieldLabel, Select } from "@/components/ui";
import { MasterCard } from "@/components/OperatorPage";
import { SeasonPicker } from "@/components/SeasonPicker";
import { genDates, groupWeeks, fmtDate } from "@/features/listings/format";
import { mealDayPlan, type MealDayPlan } from "./plan";
import { SavedMenus, type SavedMenu } from "./SavedMenus";
import { MenuSharing } from "./MenuSharing";

// ─────────────────────────────────────────────────────────────────────────
// Meals workspace — one blue title card with tabs on the right, each opening a
// large slide. The planner is three big slides:
//   1 · Season & listing — pick the season + camp, turn meals on
//   2 · Menu             — choose a saved menu, tick the dish(es)
//   3 · Days             — drop it onto the run-days ("every Monday")
// plus the Saved-menus library and the Menu-sharing setting as their own tabs.
// mealPlan[date] = { menuId, itemIds } — the menu + dishes served that day.
// ─────────────────────────────────────────────────────────────────────────

interface Listing { id: string; title?: string; name?: string; archived?: boolean; seasonId?: string | null; runFrom?: string; runTo?: string; days?: number[]; datesOff?: string[]; mealsEnabled?: boolean; mealPlan?: Record<string, unknown> }
const WEEKDAYS: [number, string][] = [[1, "Mon"], [2, "Tue"], [3, "Wed"], [4, "Thu"], [5, "Fri"], [6, "Sat"], [0, "Sun"]];

type Tab = "season" | "menu" | "days" | "saved" | "sharing";
const PLAN_TABS: [Tab, string][] = [["season", "1 · Season & camp"], ["menu", "2 · Menu"], ["days", "3 · Days"]];
const TOOL_TABS: [Tab, string][] = [["saved", "Saved menus"], ["sharing", "Sharing"]];

export function MenuPlanner() {
  const { settings } = useSettings();
  const seasons = settings.seasons ?? [];

  const [tab, setTab] = useState<Tab>("season");
  const [listings, setListings] = useState<Listing[] | null>(null);
  const [menus, setMenus] = useState<SavedMenu[] | null>(null);
  const [season, setSeason] = useState("");
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
  const seasonListings = (listings ?? []).filter((l) => !l.archived && (!season || l.seasonId === season));

  // When the camp changes, load its saved plan + flag.
  useEffect(() => {
    if (!listing) { setPlan({}); setMealsOn(false); return; }
    const raw = (listing.mealPlan ?? {}) as Record<string, unknown>;
    const next: Record<string, MealDayPlan> = {};
    for (const [iso, v] of Object.entries(raw)) { const p = mealDayPlan(v); if (p) next[iso] = p; }
    setPlan(next); setMealsOn(!!listing.mealsEnabled);
    setBrushMenuId(null); setBrushItems(new Set()); setErase(false);
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
    setBrushMenuId(id); setBrushItems(new Set((menusById.get(id)?.items ?? []).map((it) => it.id)));
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

  const ready = !!listing && mealsOn && dates.length > 0;
  const brushReady = !!brushMenuId && brushItems.size > 0;

  // Tab button on the blue header.
  const tabBtn = ([key, label]: [Tab, string]) => {
    const on = tab === key;
    return (
      <button key={key} type="button" onClick={() => setTab(key)}
        className="rounded-full px-3 py-1.5 text-[12px] font-extrabold transition"
        style={on ? { background: "#fff", color: "#1d3a8f", boxShadow: "0 2px 8px -2px rgba(0,0,0,.25)" } : { background: "rgba(255,255,255,.14)", color: "#fff", border: "1px solid rgba(255,255,255,.28)" }}>
        {label}
      </button>
    );
  };
  const nextBtn = (to: Tab, label: string, enabled = true) => (
    <button type="button" disabled={!enabled} onClick={() => setTab(to)} className="rounded-lg px-4 py-2.5 text-[13px] font-extrabold text-white transition disabled:opacity-40" style={{ background: "linear-gradient(180deg,#4f8bf5,#2f6bd8)", boxShadow: "0 3px 10px -2px rgba(47,107,216,.5)" }}>{label}</button>
  );
  const pickCampFirst = (
    <div className="grid min-h-[300px] place-items-center">
      <div className="text-center">
        <div className="text-[13px] font-bold text-[var(--ink-2)]">Pick a camp first</div>
        <button type="button" onClick={() => setTab("season")} className="mt-2 rounded-lg px-4 py-2 text-[12.5px] font-extrabold text-white" style={{ background: "linear-gradient(180deg,#4f8bf5,#2f6bd8)" }}>← Season &amp; camp</button>
      </div>
    </div>
  );

  return (
    <MasterCard bodyClassName="p-5 sm:p-6" header={
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[15px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
          <span className="text-[16px]">🍽️</span> Meals{listing ? <span className="font-semibold text-white/70"> · {listing.title || listing.name}</span> : null}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {PLAN_TABS.map(tabBtn)}
          <span className="mx-1 h-5 w-px bg-white/25" />
          {TOOL_TABS.map(tabBtn)}
        </div>
      </div>
    }>
      {error && <div className="mb-3 rounded-lg border border-[var(--red-line,#f6c9cc)] bg-[var(--red-soft,#fdebec)] px-3 py-2 text-[12.5px] text-[var(--red,#e21d27)]">{error}</div>}

      {/* ── SLIDE 1 · SEASON & CAMP ── */}
      {tab === "season" && (
        <div className="min-h-[300px]">
          <div className="text-[18px] font-extrabold text-[var(--ink)]">Choose your season &amp; camp</div>
          <p className="mb-5 mt-1 text-[13px] text-[var(--ink-3)]">Pick the season, then the camp you’re planning meals for. Turn meals on and its days appear on the next slide.</p>
          <div className="grid max-w-[720px] gap-4 sm:grid-cols-2">
            <div>
              <FieldLabel>Season</FieldLabel>
              {seasons.length ? <SeasonPicker seasons={seasons} value={season} onChange={(id) => { setSeason(id); setListingId(""); }} allLabel="All seasons" className="w-full !py-2.5 !text-[13.5px]" />
                : <div className="rounded-lg border border-dashed border-[var(--line)] bg-[#f7faff] px-3 py-2.5 text-[12px] text-[var(--ink-3)]">No seasons set up — add them in Setup. Showing all camps.</div>}
            </div>
            <div>
              <FieldLabel>Camp</FieldLabel>
              <Select value={listingId} onChange={(e) => setListingId(e.target.value)} className="w-full !py-2.5 !text-[13.5px]">
                <option value="">Choose a camp…</option>
                {seasonListings.map((l) => <option key={l.id} value={l.id}>{l.title || l.name || "Untitled"}</option>)}
              </Select>
              {season && seasonListings.length === 0 && <p className="mt-1 text-[11.5px] text-[var(--ink-3)]">No camps in this season yet.</p>}
            </div>
          </div>
          {listing && (
            <label className="mt-5 flex w-fit cursor-pointer items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-4 py-3">
              <button type="button" role="switch" aria-checked={mealsOn} onClick={() => setOn(!mealsOn)} className="relative h-6 w-11 flex-none rounded-full transition-colors" style={{ background: mealsOn ? "var(--brand-2,#2f6bd8)" : "#cbd5e1" }}>
                <span className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all" style={{ left: mealsOn ? "22px" : "2px" }} />
              </button>
              <span className="text-[13.5px] font-bold text-[var(--ink)]">{mealsOn ? "Meals are offered at this camp" : "Offer meals at this camp"}</span>
            </label>
          )}
          {listing && mealsOn && dates.length === 0 && <div className="mt-4 rounded-xl border border-dashed border-[var(--line)] bg-[#f7faff] p-3.5 text-[12.5px] text-[var(--ink-2)]">This camp has no run dates yet — set them in the listing’s <b>When it runs</b> step.</div>}
          {ready && (
            <div className="mt-6 flex items-center gap-3">
              {nextBtn("menu", "Next: choose a menu →")}
              <span className="text-[12px] text-[var(--ink-3)]">{dates.length} run-days · {planned} already planned</span>
            </div>
          )}
        </div>
      )}

      {/* ── SLIDE 2 · MENU ── */}
      {tab === "menu" && (
        !ready ? pickCampFirst
        : menus === null ? <div className="grid min-h-[300px] place-items-center text-[12px] text-[var(--ink-3)]">Loading menus…</div>
        : menus.length === 0 ? <div className="grid min-h-[300px] place-items-center text-center text-[12.5px] text-[var(--ink-2)]"><div>No menus yet. Open the <b>Saved menus</b> tab to build one, then come back.</div></div>
        : (
          <div className="min-h-[300px]">
            <div className="text-[18px] font-extrabold text-[var(--ink)]">Choose a menu</div>
            <p className="mb-4 mt-1 text-[13px] text-[var(--ink-3)]">Then tick which dish(es) to serve — parents pick from these at checkout (meat or veg are separate dishes).</p>
            <div className="flex flex-wrap gap-2">
              {menus.map((m) => (
                <button key={m.id} type="button" onClick={() => pickMenu(m.id)} className="rounded-full border px-4 py-2 text-[13.5px] font-bold transition"
                  style={brushMenuId === m.id ? { borderColor: "#2f6bd8", background: "#eef4fd", color: "#1d3a8f" } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>
                  {brushMenuId === m.id ? "✓ " : ""}{m.name}
                </button>
              ))}
            </div>
            {brushMenu && (
              <div className="mt-5">
                <div className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.05em] text-[var(--ink-3)]">Dishes on the day</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {brushMenu.items.map((it) => {
                    const on = brushItems.has(it.id);
                    return (
                      <button key={it.id} type="button" onClick={() => toggleBrushItem(it.id)} className="flex items-center gap-2.5 rounded-xl border px-3.5 py-3 text-left text-[13.5px] transition"
                        style={on ? { borderColor: "#2f6bd8", background: "#eef4fd" } : { borderColor: "var(--line)" }}>
                        <span className="flex h-5 w-5 flex-none items-center justify-center rounded border text-[11px]" style={{ borderColor: on ? "#2f6bd8" : "var(--line)", background: on ? "#2f6bd8" : "#fff", color: "#fff" }}>{on ? "✓" : ""}</span>
                        <span className="font-extrabold">{it.name}</span>
                        <span className="tabular-nums text-[var(--ink-3)]">{money(it.price)}</span>
                        {(it.allergens?.length ?? 0) > 0 && <span className="ml-auto text-[10.5px] font-bold capitalize text-[var(--red,#e21d27)]">⚠ {it.allergens!.join(", ")}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="mt-6 flex items-center gap-3">
              {nextBtn("days", "Next: plan the days →", brushReady)}
              {!brushReady && <span className="text-[12px] text-[var(--red,#e21d27)]">Pick a menu and at least one dish.</span>}
            </div>
          </div>
        )
      )}

      {/* ── SLIDE 3 · DAYS ── */}
      {tab === "days" && (
        !ready ? pickCampFirst
        : (
          <div className="min-h-[300px]">
            <div className="flex flex-wrap items-center gap-3">
              <div className="text-[18px] font-extrabold text-[var(--ink)]">Drop it onto the days</div>
              <span className="ml-auto rounded-full bg-[#eef4fd] px-3 py-1 text-[12px] font-bold text-[#1d3a8f]">{planned} of {dates.length} planned</span>
            </div>
            <div className="mb-4 mt-1.5 flex flex-wrap items-center gap-2 text-[12.5px]">
              <span className="text-[var(--ink-3)]">Painting:</span>
              {erase ? <span className="font-bold text-[var(--red,#e21d27)]">Erase</span>
                : brushMenu ? <span className="font-bold text-[#1d3a8f]">{brushMenu.name} — {brushMenu.items.filter((it) => brushItems.has(it.id)).map((it) => it.name).join(", ")}</span>
                : <span className="text-[var(--ink-3)]">nothing — open the <button type="button" onClick={() => setTab("menu")} className="font-bold text-[#2f6bd8] underline">Menu</button> tab first</span>}
            </div>
            <div className="mb-4 flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-[12px] font-bold text-[var(--ink-3)]">Every</span>
              {weekdaysPresent.map((n) => (
                <button key={n} type="button" disabled={erase ? false : !brushReady} onClick={() => applyWeekday(n)} className="rounded-lg border border-[var(--line)] bg-white px-3 py-1.5 text-[12.5px] font-bold text-[var(--ink-2)] disabled:opacity-40">{WEEKDAYS.find(([w]) => w === n)?.[1]}</button>
              ))}
              <span className="mx-1.5 h-5 w-px bg-[var(--line)]" />
              <button type="button" onClick={() => setErase((e) => !e)} className="rounded-full border px-3 py-1.5 text-[12px] font-bold" style={erase ? { borderColor: "transparent", background: "#e21d27", color: "#fff" } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>{erase ? "✓ Erasing" : "Erase"}</button>
              <button type="button" onClick={clearAll} className="text-[12px] font-bold text-[var(--red,#e21d27)] underline">Clear all</button>
            </div>
            <div className="flex flex-col gap-2.5">
              {weeks.map((w) => (
                <div key={w.mon} className="overflow-hidden rounded-xl border border-[var(--line)]">
                  <div className="px-3.5 py-2 text-[12.5px] font-extrabold text-[var(--ink-2)]" style={{ background: "#eef4fd" }}>Week {w.n} <span className="font-semibold opacity-70">· from {fmtDate(w.mon)}</span></div>
                  <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-4 lg:grid-cols-5">
                    {w.days.map((iso) => {
                      const dd = dayDishes(iso);
                      return (
                        <button key={iso} type="button" onClick={() => applyTo(iso)}
                          onDragOver={(e) => { if (brushMenuId) e.preventDefault(); }} onDrop={(e) => { e.preventDefault(); applyTo(iso); }}
                          className="flex min-h-[72px] flex-col items-start rounded-xl border p-2.5 text-left transition"
                          style={dd ? { borderColor: "#2f6bd8", background: "#eef4fd" } : { borderColor: "var(--line)", background: "#fff" }}>
                          <span className="text-[11.5px] font-extrabold text-[var(--ink-2)]">{fmtDate(iso)}</span>
                          {dd ? <span className="mt-1 text-[11.5px] font-bold leading-snug text-[#1d3a8f]">{dd.items.map((i) => i.name).join(", ")}</span>
                            : <span className="mt-1 text-[11.5px] text-[var(--ink-3)]">— tap to add —</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      )}

      {/* ── SAVED MENUS ── */}
      {tab === "saved" && <SavedMenus bare />}

      {/* ── SHARING ── */}
      {tab === "sharing" && <MenuSharing />}
    </MasterCard>
  );
}
