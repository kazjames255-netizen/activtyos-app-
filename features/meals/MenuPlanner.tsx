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
//   1 · Season & listing — pick the season + listing, turn meals on
//   2 · Menu             — choose a saved menu, tick the dish(es)
//   3 · Days             — drop it onto the run-days ("every Monday")
// plus the Saved-menus library and the Menu-sharing setting as their own tabs.
// mealPlan[date] = { menuId, itemIds } — the menu + dishes served that day.
// ─────────────────────────────────────────────────────────────────────────

interface Listing { id: string; title?: string; name?: string; archived?: boolean; seasonId?: string | null; runFrom?: string; runTo?: string; days?: number[]; datesOff?: string[]; mealsEnabled?: boolean; mealPlan?: Record<string, unknown> }
const WEEKDAYS: [number, string][] = [[1, "Mon"], [2, "Tue"], [3, "Wed"], [4, "Thu"], [5, "Fri"], [6, "Sat"], [0, "Sun"]];

type Tab = "season" | "menu" | "days" | "saved" | "sharing";
const PLAN_TABS: [Tab, string][] = [["season", "1 · Season & listing"], ["menu", "2 · Menu"], ["days", "3 · Days"]];
const TOOL_TABS: [Tab, string][] = [["saved", "Saved menus"], ["sharing", "Sharing"]];
// [dark, light, tint] per menu card — cycled so each saved menu gets its own colour.
const MENU_PAL: [string, string, string][] = [
  ["#2f6bd8", "#5b9bff", "#eef4fd"], ["#0ea5a5", "#3fd0c9", "#e6fbf7"], ["#7a5af8", "#a88bff", "#f1edff"],
  ["#e2559a", "#ff86c0", "#fdeef6"], ["#f5872b", "#ffb166", "#fff3e8"], ["#16a34a", "#4ade80", "#e9fbef"],
];

export function MenuPlanner() {
  const { settings } = useSettings();
  const seasons = settings.seasons ?? [];

  const [tab, setTab] = useState<Tab>("season");
  const [listings, setListings] = useState<Listing[] | null>(null);
  const [menus, setMenus] = useState<SavedMenu[] | null>(null);
  const [season, setSeason] = useState("");
  const [seasonTouched, setSeasonTouched] = useState(false);
  const [listingId, setListingId] = useState("");
  const [plan, setPlan] = useState<Record<string, MealDayPlan>>({});
  const [brushMenuId, setBrushMenuId] = useState<string | null>(null);
  const [focusDay, setFocusDay] = useState<number | null>(null); // weekday being edited on the menu card
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

  // When the listing changes, load its saved plan.
  useEffect(() => {
    if (!listing) { setPlan({}); return; }
    const raw = (listing.mealPlan ?? {}) as Record<string, unknown>;
    const next: Record<string, MealDayPlan> = {};
    for (const [iso, v] of Object.entries(raw)) { const p = mealDayPlan(v); if (p) next[iso] = p; }
    setPlan(next);
    setBrushMenuId(null); setFocusDay(null); setErase(false);
  }, [listing]);

  const dates = useMemo(() => (listing ? genDates(listing.runFrom ?? "", listing.runTo ?? "", listing.days ?? []).filter((x) => !(listing.datesOff ?? []).includes(x)) : []), [listing]);
  const weeks = useMemo(() => groupWeeks(dates), [dates]);
  const weekdaysPresent = [1, 2, 3, 4, 5, 6, 0].filter((n) => dates.some((iso) => new Date(`${iso}T00:00:00Z`).getUTCDay() === n));

  // Meals are "offered" on a listing whenever it has at least one planned day —
  // no separate toggle. Persisted on every change.
  const commit = useCallback((nextPlan: Record<string, MealDayPlan>) => {
    setPlan(nextPlan);
    if (!listingId) return;
    api(`/api/listings/${encodeURIComponent(listingId)}`, { method: "PUT", body: JSON.stringify({ mealsEnabled: Object.keys(nextPlan).length > 0, mealPlan: nextPlan }) }).catch((e) => setError(e instanceof Error ? e.message : "Couldn’t save"));
  }, [listingId]);

  const daysOfWeekday = (n: number) => dates.filter((d) => new Date(`${d}T00:00:00Z`).getUTCDay() === n);
  const pickMenu = (id: string) => {
    setErase(false);
    if (brushMenuId === id) { setBrushMenuId(null); setFocusDay(null); return; }
    setBrushMenuId(id); setFocusDay(null);
  };

  // The dishes this menu serves on a given weekday (read from the first run-day
  // of that weekday already set to this menu). Empty = weekday not set yet.
  const weekdayServed = (menuId: string, n: number): Set<string> => {
    const menu = menusById.get(menuId); if (!menu) return new Set();
    const d = daysOfWeekday(n).find((dd) => plan[dd]?.menuId === menuId);
    if (!d) return new Set();
    const p = plan[d];
    return new Set(p.itemIds.length ? p.itemIds : menu.items.map((i) => i.id));
  };
  // Add / remove a dish for a whole weekday (all its run-days). Removing the
  // last dish clears that weekday. This is the "meals for Monday" control.
  const toggleWeekdayDish = (menuId: string, n: number, itemId: string) => {
    const menu = menusById.get(menuId); if (!menu) return;
    const allIds = menu.items.map((i) => i.id);
    const served = weekdayServed(menuId, n);
    if (served.has(itemId)) served.delete(itemId); else served.add(itemId);
    const ids = allIds.filter((id) => served.has(id));
    const next = { ...plan };
    for (const d of daysOfWeekday(n)) {
      if (ids.length === 0) { if (plan[d]?.menuId === menuId) delete next[d]; }
      else next[d] = { menuId, itemIds: ids };
    }
    commit(next);
  };

  // Slide-3 fine-tuning: tap an empty day to add the active menu (all dishes),
  // then trim per day; erase deletes.
  const applyTo = (iso: string) => {
    const next = { ...plan };
    if (erase) delete next[iso];
    else if (brushMenuId) { const menu = menusById.get(brushMenuId); if (!menu) return; next[iso] = { menuId: brushMenuId, itemIds: menu.items.map((i) => i.id) }; }
    else return;
    commit(next);
  };
  const clearAll = () => commit({});
  const dayDishes = (iso: string) => { const p = plan[iso]; const menu = p ? menusById.get(p.menuId) : undefined; if (!p || !menu) return null; const items = p.itemIds.length ? menu.items.filter((it) => p.itemIds.includes(it.id)) : menu.items; return { name: menu.name, items }; };
  // Toggle a single dish ON/OFF for one specific day — pick the meals right on
  // the day tile. Removing the last dish clears the day.
  const toggleDayDish = (iso: string, itemId: string) => {
    const p = plan[iso]; const menu = p ? menusById.get(p.menuId) : undefined;
    if (!p || !menu) return;
    const allIds = menu.items.map((i) => i.id);
    const served = new Set(p.itemIds.length ? p.itemIds : allIds);
    if (served.has(itemId)) served.delete(itemId); else served.add(itemId);
    const next = { ...plan };
    if (served.size === 0) delete next[iso];
    else next[iso] = { menuId: p.menuId, itemIds: allIds.filter((id) => served.has(id)) };
    commit(next);
  };
  const planned = dates.filter((iso) => dayDishes(iso)).length;

  const ready = !!listing && dates.length > 0;
  const brushReady = !!brushMenuId && planned > 0;

  // Tab button on the blue header. `green` gives the two tool tabs the Bookings
  // tab's teal-green so they read as a separate group.
  const tabBtn = ([key, label]: [Tab, string], green = false) => {
    const on = tab === key;
    const active = green
      ? { background: "linear-gradient(120deg,#0ea5a5,#3fd0c9)", color: "#fff", boxShadow: "0 4px 12px -2px rgba(14,165,165,.55)" }
      : { background: "#fff", color: "#1d3a8f", boxShadow: "0 2px 8px -2px rgba(0,0,0,.25)" };
    const idle = green
      ? { background: "#14b8a6", color: "#fff" }
      : { background: "rgba(255,255,255,.14)", color: "#fff", border: "1px solid rgba(255,255,255,.28)" };
    return (
      <button key={key} type="button" onClick={() => setTab(key)}
        className="rounded-full px-3 py-1.5 text-[12px] font-extrabold transition"
        style={on ? active : idle}>
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
        <div className="text-[13px] font-bold text-[var(--ink-2)]">Pick a listing first</div>
        <button type="button" onClick={() => setTab("season")} className="mt-2 rounded-lg px-4 py-2 text-[12.5px] font-extrabold text-white" style={{ background: "linear-gradient(180deg,#4f8bf5,#2f6bd8)" }}>← Season &amp; listing</button>
      </div>
    </div>
  );

  return (
    <MasterCard bodyClassName="p-5 sm:p-6 bg-gradient-to-br from-[#eef4ff] via-white to-[#eafbf7]" header={
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[15px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
          <span className="text-[16px]">🍽️</span> Meals{listing ? <span className="font-semibold text-white/70"> · {listing.title || listing.name}</span> : null}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {PLAN_TABS.map((t) => tabBtn(t))}
          <span className="mx-1 h-5 w-px bg-white/25" />
          {TOOL_TABS.map((t) => tabBtn(t, true))}
        </div>
      </div>
    }>
      {error && <div className="mb-3 rounded-lg border border-[var(--red-line,#f6c9cc)] bg-[var(--red-soft,#fdebec)] px-3 py-2 text-[12.5px] text-[var(--red,#e21d27)]">{error}</div>}

      {/* ── SLIDE 1 · SEASON & LISTING ── */}
      {tab === "season" && (
        <div className="min-h-[300px]">
          <style>{`@keyframes mealsRevealRight{from{opacity:0;transform:translateX(-56px) scale(.94)}to{opacity:1;transform:none}}`}</style>
          <div className="text-[20px] font-extrabold text-[#12306e]" style={{ fontFamily: "var(--ff-display)" }}>Choose your season &amp; listing</div>
          <p className="mb-5 mt-1 text-[13px] text-[var(--ink-2)]">Pick the season — its listings then slide out for you to choose from.</p>
          {(() => { const showListing = seasonTouched || seasons.length === 0; return (
          <div className={`grid max-w-[760px] gap-4 ${showListing ? "sm:grid-cols-2" : "sm:grid-cols-1 sm:max-w-[380px]"}`}>
            {/* Season card */}
            <div className="rounded-2xl border p-4 shadow-[0_8px_24px_-16px_rgba(31,84,163,.5)]" style={{ borderColor: "#cfe0fb", background: "linear-gradient(160deg,#eef5ff 0%,#ffffff 70%)" }}>
              <div className="mb-2.5 flex items-center gap-2">
                <span className="grid h-9 w-9 place-items-center rounded-full text-[16px] text-white shadow" style={{ background: "linear-gradient(135deg,#4f8bf5,#2f6bd8)" }}>📅</span>
                <span className="text-[12px] font-extrabold uppercase tracking-[0.06em] text-[#1d3a8f]">Season</span>
              </div>
              {seasons.length ? <SeasonPicker seasons={seasons} value={season} onChange={(id) => { setSeason(id); setSeasonTouched(true); setListingId(""); }} allLabel="All seasons" className="w-full !border-[#a9c6f4] !bg-white !py-2.5 !text-[13.5px] !font-bold !text-[#12306e]" />
                : <div className="rounded-lg border border-dashed border-[#a9c6f4] bg-white px-3 py-2.5 text-[12px] text-[var(--ink-3)]">No seasons set up — add them in Setup. Showing all listings.</div>}
            </div>
            {/* Listing card — slides out of the season card once a season is picked */}
            {showListing && (
              <div className="rounded-2xl border p-4 shadow-[0_8px_24px_-16px_rgba(14,165,165,.5)]" style={{ borderColor: "#bfeae4", background: "linear-gradient(160deg,#eafbf7 0%,#ffffff 70%)", animation: "mealsRevealRight .45s cubic-bezier(.2,.8,.2,1) both" }}>
                <div className="mb-2.5 flex items-center gap-2">
                  <span className="grid h-9 w-9 place-items-center rounded-full text-[16px] text-white shadow" style={{ background: "linear-gradient(135deg,#3fd0c9,#0ea5a5)" }}>🎟️</span>
                  <span className="text-[12px] font-extrabold uppercase tracking-[0.06em] text-[#0e7a75]">Listing</span>
                </div>
                <Select value={listingId} onChange={(e) => setListingId(e.target.value)} className="w-full !border-[#8fdcd4] !bg-white !py-2.5 !text-[13.5px] !font-bold !text-[#0e5b57]">
                  <option value="">Choose a listing…</option>
                  {seasonListings.map((l) => <option key={l.id} value={l.id}>{l.title || l.name || "Untitled"}</option>)}
                </Select>
                {season && seasonListings.length === 0 && <p className="mt-1 text-[11.5px] text-[var(--ink-3)]">No listings in this season yet.</p>}
              </div>
            )}
          </div>
          ); })()}
          {listing && dates.length === 0 && <div className="mt-4 rounded-xl border border-dashed border-[#f0c98a] bg-[#fff8ec] p-3.5 text-[12.5px] text-[#8a5a00]">This listing has no run dates yet — set them in the listing’s <b>When it runs</b> step.</div>}
          {ready && (
            <div className="mt-6 flex flex-wrap items-center gap-3">
              {nextBtn("menu", "Next: choose a menu →")}
              <span className="rounded-full px-3 py-1.5 text-[12px] font-extrabold text-white shadow" style={{ background: "linear-gradient(135deg,#3fd0c9,#0ea5a5)" }}>{dates.length} run-days · {planned} planned</span>
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
            <div className="text-[20px] font-extrabold text-[#12306e]" style={{ fontFamily: "var(--ff-display)" }}>Choose a menu</div>
            <p className="mb-4 mt-1 text-[13px] text-[var(--ink-2)]">Tap a menu, then tick the dish(es) to serve — one is fine, or offer a few (e.g. meat &amp; veg) for parents to choose between at checkout.</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {menus.map((m, i) => {
                const [dark, light, tint] = MENU_PAL[i % MENU_PAL.length];
                const sel = brushMenuId === m.id;
                return (
                  <div key={m.id} role="button" tabIndex={0} onClick={() => pickMenu(m.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pickMenu(m.id); } }}
                    className="cursor-pointer overflow-hidden rounded-2xl border-2 bg-white transition hover:-translate-y-0.5"
                    style={sel ? { borderColor: dark, boxShadow: `0 16px 34px -16px ${dark}aa` } : { borderColor: "var(--line)" }}>
                    <div className="flex items-center gap-2 px-3.5 py-3 text-white" style={{ background: `linear-gradient(120deg, ${dark}, ${light})` }}>
                      <span className="grid h-8 w-8 flex-none place-items-center rounded-full bg-white/25 text-[15px]">🍽️</span>
                      <span className="truncate text-[15px] font-extrabold">{m.name}</span>
                      <span className="ml-auto flex-none rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-bold">{sel ? "✓ " : ""}{m.items.length} dish{m.items.length === 1 ? "" : "es"}</span>
                    </div>
                    <div className="p-3" style={sel ? { background: tint } : undefined}>
                      {sel ? (
                        <>
                          <div className="mb-1.5 text-[10.5px] font-extrabold uppercase tracking-[0.05em]" style={{ color: dark }}>Pick a day, then choose its meal(s)</div>
                          <div className="flex flex-wrap gap-1.5">
                            {weekdaysPresent.map((n) => {
                              const count = weekdayServed(m.id, n).size;
                              const editing = focusDay === n;
                              return (
                                <button key={n} type="button" onClick={(e) => { e.stopPropagation(); setFocusDay(editing ? null : n); }}
                                  className="rounded-full border-2 px-3 py-1.5 text-[12px] font-extrabold transition"
                                  style={editing ? { borderColor: dark, background: dark, color: "#fff" } : count > 0 ? { borderColor: dark, background: "#fff", color: dark } : { borderColor: "var(--line)", background: "#fff", color: "var(--ink-2)" }}>
                                  {WEEKDAYS.find(([w]) => w === n)?.[1]}{count > 0 ? ` · ${count}` : ""}
                                </button>
                              );
                            })}
                          </div>
                          {focusDay !== null ? (
                            <div className="mt-3 border-t pt-2.5" style={{ borderColor: `${dark}22` }}>
                              <div className="mb-1.5 text-[10.5px] font-extrabold uppercase tracking-[0.05em]" style={{ color: dark }}>Meals on every {WEEKDAYS.find(([w]) => w === focusDay)?.[1]}</div>
                              <div className="flex flex-wrap gap-1.5">
                                {m.items.map((it) => {
                                  const on = weekdayServed(m.id, focusDay!).has(it.id);
                                  return (
                                    <button key={it.id} type="button" onClick={(e) => { e.stopPropagation(); toggleWeekdayDish(m.id, focusDay!, it.id); }}
                                      className="rounded-full border px-2.5 py-1.5 text-[12px] font-bold transition"
                                      style={on ? { borderColor: dark, background: "#fff", color: dark } : { borderColor: "var(--line)", background: "#fff", color: "var(--ink-3)" }}>
                                      {on ? "✓ " : "+ "}{it.name} · {money(it.price)}{(it.allergens?.length ?? 0) > 0 ? " ⚠" : ""}
                                    </button>
                                  );
                                })}
                              </div>
                              <p className="mt-1.5 text-[10.5px] text-[var(--ink-3)]">Tick one, or a few for parents to choose between. Fine-tune single days on the Days slide.</p>
                            </div>
                          ) : <p className="mt-2 text-[11px] text-[var(--ink-3)]">Tap a day above to choose the meal(s) it serves.</p>}
                        </>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {m.items.map((it) => <span key={it.id} className="rounded-full bg-[var(--panel)] px-2.5 py-1 text-[11.5px] font-semibold text-[var(--ink-2)]">{it.name} · {money(it.price)}</span>)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-6 flex items-center gap-3">
              {nextBtn("days", "Next: fine-tune the days →", brushReady)}
              {!brushReady && <span className="text-[12px] text-[var(--ink-3)]">Pick a day on a menu and choose its meal(s).</span>}
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
            <p className="mb-3 mt-1 text-[12.5px] text-[var(--ink-2)]">You set the pattern on the Menu slide — here you can tweak a single day: tap its dish chips, tap an empty day to add {brushMenu ? <b>{brushMenu.name}</b> : <>the <button type="button" onClick={() => setTab("menu")} className="font-bold text-[#2f6bd8] underline">picked menu</button></>}, or erase.</p>
            <div className="mb-4 flex flex-wrap items-center gap-1.5">
              <button type="button" onClick={() => setErase((e) => !e)} className="rounded-full border px-3 py-1.5 text-[12px] font-bold" style={erase ? { borderColor: "transparent", background: "#e21d27", color: "#fff" } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>{erase ? "✓ Erasing" : "Erase a day"}</button>
              <button type="button" onClick={clearAll} className="text-[12px] font-bold text-[var(--red,#e21d27)] underline">Clear all</button>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              {weeks.map((w, wi) => {
                const [hd, hl] = MENU_PAL[wi % MENU_PAL.length];
                const set = w.days.filter((iso) => dayDishes(iso)).length;
                return (
                  <div key={w.mon} className="overflow-hidden rounded-2xl border-2 border-[var(--line)] bg-white">
                    <div className="flex items-center gap-2 px-3.5 py-2.5 text-white" style={{ background: `linear-gradient(120deg, ${hd}, ${hl})` }}>
                      <span className="grid h-7 w-7 flex-none place-items-center rounded-full bg-white/25 text-[13px]">📅</span>
                      <span className="text-[14px] font-extrabold">Week {w.n}</span>
                      <span className="text-[12px] font-semibold text-white/85">· from {fmtDate(w.mon)}</span>
                      <span className="ml-auto flex-none rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-bold">{set}/{w.days.length}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3">
                      {w.days.map((iso) => {
                        const p = plan[iso];
                        const menu = p ? menusById.get(p.menuId) : undefined;
                        const mi = menu ? (menus ?? []).findIndex((m) => m.id === menu.id) : -1;
                        const col = mi >= 0 ? MENU_PAL[mi % MENU_PAL.length] : null;
                        const has = !!(p && menu && col);
                        const served = p ? new Set(p.itemIds.length ? p.itemIds : (menu?.items.map((i) => i.id) ?? [])) : new Set<string>();
                        return (
                          <div key={iso}
                            onDragOver={(e) => { if (brushMenuId) e.preventDefault(); }} onDrop={(e) => { e.preventDefault(); applyTo(iso); }}
                            onClick={() => { if (erase || !has) applyTo(iso); }}
                            className={`flex min-h-[76px] flex-col items-start overflow-hidden rounded-xl border-2 p-2.5 text-left transition ${erase || !has ? "cursor-pointer hover:-translate-y-0.5" : ""}`}
                            style={has && col ? { borderColor: col[0], background: col[2], boxShadow: `0 10px 22px -16px ${col[0]}` } : { borderColor: "var(--line)", background: "#fff", borderStyle: "dashed" }}>
                            <span className="text-[11.5px] font-extrabold" style={{ color: has && col ? col[0] : "var(--ink-2)" }}>{fmtDate(iso)}</span>
                            {has && menu && col ? (
                              erase
                                ? <span className="mt-1 text-[11.5px] font-bold leading-snug" style={{ color: col[0] }}>{menu.items.filter((it) => served.has(it.id)).map((i) => i.name).join(", ")}</span>
                                : (
                                  <div className="mt-1.5 flex flex-wrap gap-1">
                                    {menu.items.map((it) => {
                                      const on = served.has(it.id);
                                      return (
                                        <button key={it.id} type="button" onClick={(e) => { e.stopPropagation(); toggleDayDish(iso, it.id); }}
                                          className="rounded-full border px-2 py-0.5 text-[10.5px] font-bold transition"
                                          style={on ? { borderColor: col[0], background: "#fff", color: col[0] } : { borderColor: "var(--line)", background: "#fff", color: "var(--ink-3)", opacity: 0.6 }}>
                                          {on ? "✓ " : "+ "}{it.name}
                                        </button>
                                      );
                                    })}
                                  </div>
                                )
                            ) : <span className="mt-1 text-[11.5px] text-[var(--ink-3)]">＋ tap to add</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
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
