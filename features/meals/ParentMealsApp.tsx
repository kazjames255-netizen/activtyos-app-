"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { get as apiGet, post as apiPost } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { money } from "@/features/bookings/helpers";
import { Card } from "@/components/ui";
import { groupWeeks, fmtDate } from "@/features/listings/format";
import { DIETS, dietMeta, type Diet } from "./diet";

// ─────────────────────────────────────────────────────────────────────────
// Parent Meals. Menu tab: a weekly timetable — children down the left, days
// across — where each cell is a dropdown of that day's meals. Choosing one
// drops it straight into the basket; "— none" removes it. One meal per child
// per day. Allergens/diet are checked against each child's profile.
// Children's meals tab: a sub-tab per child with their meals + gaps.
// ─────────────────────────────────────────────────────────────────────────

interface MenuItem { id: string; name: string; price: number; allergens?: string[]; description?: string; diet?: Diet; capacity?: number; left?: number }
interface MealDay { tenantId: string; tenantName: string; listingId: string; listingName: string; date: string; children: string[]; menu: { id: string; name: string; items: MenuItem[] }; served: boolean; canOrder: boolean; cutoffLabel: string; closesToday: boolean; allergenNote?: string }
interface Booking { child?: string; listingId?: string; kids?: { name?: string }[]; mealItems?: { date: string; name: string; price: number }[] }
interface Order { id: string; listingId?: string; childName: string; date: string; status?: string; pay?: string; items?: { name: string; price: number; qty: number; menuItemId?: string; allergens?: string[] }[]; changeRequest?: { menuItemId: string; name: string; price: number }; cancelRequest?: { at: string } }
interface Child { name: string; allergies?: string; dietary?: string }
type Chosen = { name: string; price: number; qty: number; allergens?: string[]; description?: string; diet?: Diet; orderId?: string; canCancel?: boolean };
type BasketLine = { tenantId: string; listingId: string; listingName: string; date: string; dishId: string; name: string; price: number; child: string };

const fmtDay = (iso: string) => (iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }) : "");
const WEEK_PAL: [string, string][] = [["#2f6bd8", "#5b9bff"], ["#0ea5a5", "#3fd0c9"], ["#7a5af8", "#a88bff"], ["#e2559a", "#ff86c0"], ["#f5872b", "#ffb166"], ["#16a34a", "#4ade80"]];
const splitKids = (s?: string) => (s ?? "").split(/,|&/).map((x) => x.trim()).filter(Boolean);
const lineKey = (l: { date: string; listingId: string; dishId: string; child: string }) => `${l.date}|${l.listingId}|${l.dishId}|${l.child}`;
const GRN = "linear-gradient(135deg,#22c07a,#0e9a5a)";

const ALLERGEN_SYN: Record<string, string[]> = {
  milk: ["milk", "dairy", "lactose", "cheese"], gluten: ["gluten", "wheat", "bread", "coeliac", "celiac"], eggs: ["egg"], fish: ["fish"],
  crustaceans: ["crustacean", "shellfish", "prawn", "shrimp", "crab", "lobster"], molluscs: ["mollusc", "shellfish", "squid", "mussel", "oyster"],
  peanuts: ["peanut"], nuts: ["nut", "almond", "cashew", "walnut", "hazelnut", "pecan"], soya: ["soya", "soy"], sesame: ["sesame", "tahini"],
  celery: ["celery"], mustard: ["mustard"], lupin: ["lupin"], sulphites: ["sulphite", "sulfite", "sulphur"],
};
const allergenClash = (dishAllergens: string[] | undefined, allergiesText: string | undefined): string[] => {
  if (!dishAllergens?.length || !allergiesText?.trim()) return [];
  const t = allergiesText.toLowerCase();
  return dishAllergens.filter((a) => (ALLERGEN_SYN[a.toLowerCase()] ?? [a.toLowerCase()]).some((syn) => t.includes(syn)));
};
const dietClash = (it: MenuItem, dietary: string | undefined): string | null => {
  const d = (dietary ?? "").toLowerCase();
  if (!it.diet) return null;
  if (d.includes("vegan") && it.diet !== "vegan") return it.diet === "meat" ? "contains meat" : "not vegan";
  if (d.includes("veget") && it.diet === "meat") return "contains meat";
  return null;
};

const Allergens = ({ list }: { list?: string[] }) => (list?.length ? <span className="rounded-md bg-[#fdf3e3] px-1.5 py-[1px] text-[10px] font-semibold capitalize text-[#96631a]">contains {list.join(", ")}</span> : null);
const DietBadge = ({ diet }: { diet?: string }) => { const d = dietMeta(diet); return d ? <span className="rounded-full px-2 py-[1.5px] text-[10px] font-extrabold" style={{ background: d.bg, color: d.fg }}>{d.icon} {d.label}</span> : null; };

export function ParentMealsApp() {
  const [days, setDays] = useState<MealDay[] | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ordersWarn, setOrdersWarn] = useState(false);
  const [view, setView] = useState<"menu" | "kids">("menu");
  const [kid, setKid] = useState<string>("");

  const [weekIdx, setWeekIdx] = useState(0);
  const [dietFilter, setDietFilter] = useState<Diet | "">("");
  const [basketOpen, setBasketOpen] = useState(false);
  const [basket, setBasket] = useState<BasketLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [payErr, setPayErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [todayIso] = useState(() => new Date().toISOString().slice(0, 10));

  const load = useCallback(() => {
    apiGet<MealDay[]>("/api/my/meal-days").then(setDays).catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
    apiGet<Booking[]>("/api/my/bookings").then(setBookings).catch(() => {});
    apiGet<Order[]>("/api/meal-orders").then((o) => { setOrders(o); setOrdersWarn(false); }).catch(() => setOrdersWarn(true));
    apiGet<Child[]>("/api/my/children").then(setChildren).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);
  useRealtime(["listings", "bookings", "mealOrders", "mealMenus"], load);

  const served = useMemo(() => (days ?? []).filter((d) => d.served), [days]);
  const dishInfo = useMemo(() => { const m = new Map<string, MenuItem>(); for (const d of served) for (const it of d.menu.items) m.set(`${d.date}|${it.name}`, it); return m; }, [served]);
  const liveOrders = useMemo(() => orders.filter((o) => o.status !== "cancelled"), [orders]);
  const childInfo = useMemo(() => new Map(children.map((c) => [c.name.trim(), c])), [children]);
  const allergenNote = useMemo(() => served.find((d) => d.allergenNote)?.allergenNote ?? "", [served]);

  const kidsByListing = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const b of bookings) {
      if (!b.listingId) continue;
      const s = m.get(b.listingId) ?? new Set<string>(); m.set(b.listingId, s);
      for (const k of splitKids(b.child)) s.add(k);
      for (const k of (b.kids ?? [])) if (k.name?.trim()) s.add(k.name.trim());
    }
    return m;
  }, [bookings]);
  const kidsFor = useCallback((listingId: string) => [...(kidsByListing.get(listingId) ?? [])].sort((a, b) => a.localeCompare(b)), [kidsByListing]);

  const basketKeys = useMemo(() => new Set(basket.map(lineKey)), [basket]);
  // Every (listing, date, child) that already has a meal — orders + checkout —
  // so a confirmed meal shows in its cell and blocks a duplicate.
  const bookedByCell = useMemo(() => {
    const m = new Map<string, { name: string; orderId?: string; canCancel?: boolean }>();
    for (const o of liveOrders) if (o.listingId && o.items?.length) m.set(`${o.listingId}|${o.date}|${o.childName}`, { name: o.items.map((i) => i.name).join(", "), orderId: o.id, canCancel: o.pay !== "Paid" });
    for (const b of bookings) { if (!b.listingId) continue; const roster = [...splitKids(b.child), ...((b.kids ?? []).map((k) => k.name).filter(Boolean) as string[])]; for (const it of (b.mealItems ?? [])) for (const c of roster) { const k = `${b.listingId}|${it.date}|${c}`; if (!m.has(k)) m.set(k, { name: it.name }); } }
    return m;
  }, [liveOrders, bookings]);

  const kidsWithMeals = useMemo(() => {
    const s = new Set<string>();
    for (const b of bookings.filter((x) => (x.mealItems?.length ?? 0) > 0)) for (const k of splitKids(b.child)) s.add(k);
    for (const o of liveOrders) s.add(o.childName);
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [bookings, liveOrders]);

  const byDate = useMemo(() => { const m = new Map<string, MealDay[]>(); for (const d of served) { if (d.date < todayIso) continue; const a = m.get(d.date) ?? []; a.push(d); m.set(d.date, a); } return m; }, [served, todayIso]);
  const menuWeeks = useMemo(() => groupWeeks([...byDate.keys()]), [byDate]);
  const dietsPresent = useMemo(() => DIETS.filter((d) => [...byDate.values()].some((es) => es.some((e) => e.menu.items.some((it) => it.diet === d.key)))), [byDate]);

  // Per-child coverage across upcoming meal days.
  const coverage = useMemo(() => {
    const m = new Map<string, { done: number; total: number; gaps: string[] }>();
    for (const entries of byDate.values()) for (const e of entries) for (const c of kidsFor(e.listingId)) {
      const g = m.get(c) ?? { done: 0, total: 0, gaps: [] }; g.total++;
      const has = basket.some((l) => l.child === c && l.listingId === e.listingId && l.date === e.date) || bookedByCell.has(`${e.listingId}|${e.date}|${c}`);
      if (has) g.done++; else g.gaps.push(e.date);
      m.set(c, g);
    }
    return m;
  }, [byDate, kidsFor, basket, basketKeys, bookedByCell]);

  const activeKid = kidsWithMeals.includes(kid) ? kid : (kidsWithMeals[0] ?? "");
  const chosenByDate = useMemo(() => {
    const m = new Map<string, Chosen[]>();
    if (!activeKid) return m;
    for (const b of bookings) {
      if (!splitKids(b.child).includes(activeKid)) continue;
      for (const it of (b.mealItems ?? [])) { const info = dishInfo.get(`${it.date}|${it.name}`); const a = m.get(it.date) ?? []; a.push({ name: it.name, price: it.price, qty: 1, allergens: info?.allergens, description: info?.description, diet: info?.diet }); m.set(it.date, a); }
    }
    for (const o of liveOrders) {
      if (o.childName !== activeKid) continue;
      for (const it of (o.items ?? [])) { const info = dishInfo.get(`${o.date}|${it.name}`); const a = m.get(o.date) ?? []; a.push({ name: it.name, price: it.price, qty: it.qty ?? 1, allergens: it.allergens ?? info?.allergens, description: info?.description, diet: info?.diet, orderId: o.id, canCancel: o.pay !== "Paid" }); m.set(o.date, a); }
    }
    return m;
  }, [activeKid, bookings, liveOrders, dishInfo]);
  const chosenWeeks = useMemo(() => groupWeeks([...chosenByDate.keys()]), [chosenByDate]);
  const chosenCount = [...chosenByDate.values()].reduce((s, a) => s + a.reduce((n, c) => n + c.qty, 0), 0);

  const basketTotal = basket.reduce((s, l) => s + l.price, 0);
  const basketByChild = useMemo(() => {
    const m = new Map<string, BasketLine[]>();
    for (const l of [...basket].sort((a, b) => a.date.localeCompare(b.date))) { const a = m.get(l.child) ?? []; a.push(l); m.set(l.child, a); }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [basket]);

  const removeLine = (key: string) => setBasket((prev) => prev.filter((l) => lineKey(l) !== key));
  const dishLeft = (e: MealDay, it: MenuItem) => it.left === undefined ? undefined : Math.max(0, it.left - kidsFor(e.listingId).filter((k) => basketKeys.has(`${e.date}|${e.listingId}|${it.id}|${k}`)).length);

  // The timetable cell setter: choose a dish for (child, day) → straight into
  // the basket, swapping any current choice; "" removes it.
  const setCell = (e: MealDay, child: string, dishId: string) => {
    setPayErr(null);
    if (dishId) {
      const it = e.menu.items.find((x) => x.id === dishId);
      if (!it) return;
      const already = basketKeys.has(`${e.date}|${e.listingId}|${it.id}|${child}`);
      if (!already) {
        const left = dishLeft(e, it);
        if (left !== undefined && left <= 0) { setToast(`Sorry — ${it.name} is fully booked that day.`); return; }
        const c = childInfo.get(child);
        if ((allergenClash(it.allergens, c?.allergies).length || dietClash(it, c?.dietary)) && typeof window !== "undefined" && !window.confirm(`Please check — ${it.name} may not suit ${child}:\n\n${[allergenClash(it.allergens, c?.allergies).length ? `contains ${allergenClash(it.allergens, c?.allergies).join(", ")}` : "", dietClash(it, c?.dietary) || ""].filter(Boolean).join("; ")}\n\nAllergen info is a guide; confirm with your provider. Choose anyway?`)) return;
      }
      setBasket((prev) => [...prev.filter((l) => !(l.child === child && l.listingId === e.listingId && l.date === e.date)), { tenantId: e.tenantId, listingId: e.listingId, listingName: e.listingName, date: e.date, dishId: it.id, name: it.name, price: it.price, child }]);
      setToast(`${it.name} added for ${child} · ${fmtDay(e.date)}`);
    } else {
      setBasket((prev) => prev.filter((l) => !(l.child === child && l.listingId === e.listingId && l.date === e.date)));
      setToast(null);
    }
  };

  const payAll = useCallback(async () => {
    if (!basket.length) return;
    setBusy(true); setPayErr(null); setToast(null);
    const groups = new Map<string, { tenantId: string; listingId: string; date: string; child: string; items: Map<string, number>; keys: string[] }>();
    for (const l of basket) {
      const key = `${l.tenantId}|${l.listingId}|${l.date}|${l.child}`;
      const g = groups.get(key) ?? { tenantId: l.tenantId, listingId: l.listingId, date: l.date, child: l.child, items: new Map<string, number>(), keys: [] };
      g.items.set(l.dishId, (g.items.get(l.dishId) ?? 0) + 1); g.keys.push(lineKey(l)); groups.set(key, g);
    }
    const doneKeys: string[] = []; let failMsg: string | null = null;
    for (const g of groups.values()) {
      try { await apiPost("/api/meal-orders", { tenantId: g.tenantId, listingId: g.listingId, date: g.date, childName: g.child, items: [...g.items].map(([menuItemId, qty]) => ({ menuItemId, qty })) }); doneKeys.push(...g.keys); }
      catch (err) { failMsg = err instanceof Error ? err.message : "Some meals couldn't be booked."; break; }
    }
    if (doneKeys.length) { const s = new Set(doneKeys); setBasket((prev) => prev.filter((l) => !s.has(lineKey(l)))); }
    if (failMsg) setPayErr(`${failMsg} ${doneKeys.length ? "The rest are still in your basket." : ""}`.trim());
    else { setToast(`✓ Booked ${doneKeys.length} meal${doneKeys.length === 1 ? "" : "s"} — held for you now.`); setBasketOpen(false); }
    load(); setBusy(false);
  }, [basket, load]);

  const cancelMeal = useCallback(async (orderId: string) => {
    if (typeof window !== "undefined" && !window.confirm("Remove this meal?")) return;
    try { const r = await apiPost<{ requested?: boolean }>(`/api/meal-orders/${encodeURIComponent(orderId)}/cancel`, {}); setToast(r?.requested ? "Removal requested — awaiting your provider’s approval." : "Meal removed."); load(); }
    catch (err) { setToast(err instanceof Error ? err.message : "Couldn't remove that meal."); }
  }, [load]);
  const changeMeal = useCallback(async (orderId: string, menuItemId: string) => {
    if (!menuItemId) return;
    try { const r = await apiPost<{ changeRequest?: unknown }>(`/api/meal-orders/${encodeURIComponent(orderId)}/change`, { menuItemId }); setToast(r?.changeRequest ? "Change requested — awaiting your provider’s approval." : "Meal changed."); load(); }
    catch (err) { setToast(err instanceof Error ? err.message : "Couldn't change that meal."); }
  }, [load]);
  const withdrawReq = useCallback(async (orderId: string) => {
    try { await apiPost(`/api/meal-orders/${encodeURIComponent(orderId)}/request`, { action: "withdraw" }); setToast("Request withdrawn."); load(); }
    catch (err) { setToast(err instanceof Error ? err.message : "Couldn't withdraw."); }
  }, [load]);

  const week = menuWeeks.length ? menuWeeks[Math.min(weekIdx, menuWeeks.length - 1)] : null;
  const weekPal = WEEK_PAL[(week?.n ?? 1) - 1 >= 0 ? ((week?.n ?? 1) - 1) % WEEK_PAL.length : 0];
  const weekKids = week ? [...new Set(week.days.flatMap((iso) => (byDate.get(iso) ?? []).flatMap((e) => kidsFor(e.listingId))))].sort((a, b) => a.localeCompare(b)) : [];
  const entryFor = (child: string, iso: string) => (byDate.get(iso) ?? []).find((e) => kidsFor(e.listingId).includes(child)) ?? null;

  return (
    <div className="text-[var(--ink)]">
      <div className="relative mb-3.5 overflow-hidden rounded-2xl p-5 text-white shadow-[0_10px_30px_-12px_rgba(29,58,143,.55)]" style={{ background: "linear-gradient(120deg,#1d3a8f 0%,#3f78d8 62%,#ffffff 100%)" }}>
        <div className="flex items-center gap-2 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-[17px]">🍽️</span>Meals
        </div>
        <p className="mt-1.5 max-w-[560px] text-[12.5px] leading-[1.5] text-white/85">Pick a meal for each child on the weekly planner — it drops straight into your basket. One meal per day; we flag anything that clashes with allergies or diet.</p>
      </div>
      {error && <div className="mb-3 rounded-lg border border-[var(--red-line,#f6c9cc)] bg-[var(--red-soft,#fdebec)] px-3 py-2 text-[12.5px] text-[var(--red,#e21d27)]">{error}</div>}
      {ordersWarn && <div className="mb-3 rounded-lg border border-[#f2dcbb] bg-[#fff6e9] px-3 py-2 text-[12px] font-semibold text-[#96631a]">Couldn’t load your existing meal orders — refresh to make sure you don’t double-book.</div>}
      {toast && (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-[#bde5cd] bg-[#effaf3] px-3.5 py-2.5 text-[12.5px] font-semibold text-[#0e7a45]">
          <span className="flex-1">{toast}</span>
          <button type="button" aria-label="Dismiss" onClick={() => setToast(null)} className="flex-none text-[#0e7a45]/70 hover:text-[#0e7a45]">✕</button>
        </div>
      )}

      {kidsWithMeals.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {([["menu", "🍴 Menu"], ["kids", "🎒 Children’s meals"]] as [("menu" | "kids"), string][]).map(([key, label]) => {
            const on = view === key;
            return (
              <button key={key} type="button" onClick={() => { setView(key); setToast(null); }} className="rounded-full px-3.5 py-1.5 text-[12.5px] font-extrabold transition"
                style={on ? { background: "linear-gradient(180deg,#4f8bf5,#2f6bd8)", color: "#fff", boxShadow: "0 4px 12px -3px rgba(47,107,216,.6)" } : { background: "var(--panel)", color: "var(--ink-2)", border: "1px solid var(--line)" }}>
                {label}
              </button>
            );
          })}
        </div>
      )}

      {!days ? <div className="py-6 text-center text-[12px] text-[var(--ink-3)]">Loading…</div>
      : view === "kids" && kidsWithMeals.length > 0 ? (
        <>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {kidsWithMeals.map((k) => {
              const on = activeKid === k; const cov = coverage.get(k);
              return (
                <button key={k} type="button" onClick={() => { setKid(k); setToast(null); }} className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-extrabold transition"
                  style={on ? { background: "linear-gradient(180deg,#4f8bf5,#2f6bd8)", color: "#fff", boxShadow: "0 4px 12px -3px rgba(47,107,216,.6)" } : { background: "var(--panel)", color: "var(--ink-2)", border: "1px solid var(--line)" }}>
                  🎒 {k}{cov && cov.total > 0 && <span className="rounded-full px-1.5 py-[0.5px] text-[10px] font-extrabold" style={on ? { background: "rgba(255,255,255,.25)" } : { background: cov.done >= cov.total ? "#eafaf1" : "#fff3e0", color: cov.done >= cov.total ? "#0e7a45" : "#96631a" }}>{cov.done}/{cov.total}</span>}
                </button>
              );
            })}
          </div>
          {(() => { const cov = coverage.get(activeKid); return cov && cov.gaps.length > 0 && (
            <div className="mb-2 rounded-lg border border-[#f2dcbb] bg-[#fff6e9] px-3 py-1.5 text-[11.5px] font-semibold text-[#96631a]">No meal yet on {cov.gaps.slice(0, 6).map(fmtDay).join(", ")}{cov.gaps.length > 6 ? "…" : ""} — add on the Menu planner.</div>
          ); })()}
          {chosenByDate.size === 0
            ? <Card className="p-6 text-center text-[13px] text-[var(--ink-3)]">{activeKid} hasn’t got any meals yet — add them on the Menu planner.</Card>
            : (
            <>
              <div className="mb-2 text-[12px] text-[var(--ink-3)]"><b className="text-[var(--ink)]">{activeKid}</b> — {chosenCount} meal{chosenCount === 1 ? "" : "s"}</div>
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
                            <div className="mt-1.5 flex flex-col gap-1.5">
                              {(chosenByDate.get(iso) ?? []).map((it, i) => (
                                <div key={`${it.name}-${i}`} className="rounded-lg border border-[var(--line)] bg-white/70 px-2.5 py-1.5">
                                  <div className="flex flex-wrap items-baseline gap-1.5 text-[12px]">
                                    <span className="text-[#0e9a5a]">✓</span><span className="font-bold">{it.name}</span>
                                    <DietBadge diet={it.diet} />
                                    {it.price > 0 && <span className="tabular-nums text-[var(--ink-2)]">{money(it.price)}</span>}
                                    <Allergens list={it.allergens} />
                                    {it.canCancel && it.orderId && <button type="button" onClick={() => cancelMeal(it.orderId!)} className="ml-auto text-[11px] font-bold text-[var(--ink-3)] hover:text-[var(--red,#e21d27)]">Remove</button>}
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
            </>
          )}
        </>
      ) : !week ? (
        <Card className="p-6 text-center text-[13px] text-[var(--ink-3)]">No menus to show yet — the planner appears here for listings your provider offers meals on.</Card>
      ) : (
        <>
          {/* Basket, above the planner */}
          <div id="meal-basket" className="mb-3 overflow-hidden rounded-2xl border-2 border-[var(--line)] bg-white shadow-[0_8px_24px_-16px_rgba(29,58,143,.5)]">
            <div className="flex flex-wrap items-center gap-2 px-3.5 py-2.5 text-white" style={{ background: "linear-gradient(120deg,#1d3a8f,#3f78d8)" }}>
              <span className="grid h-7 w-7 flex-none place-items-center rounded-full bg-white/20 text-[14px]">🧺</span>
              <span className="text-[14px] font-extrabold">Meal basket</span>
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11.5px] font-extrabold">{basket.length} meal{basket.length === 1 ? "" : "s"} · {money(basketTotal)}</span>
              {basket.length > 0 && <button type="button" onClick={() => setBasketOpen((o) => !o)} className="text-[11.5px] font-bold text-white/85 underline">{basketOpen ? "Hide" : "View"}</button>}
              <div className="ml-auto flex items-center gap-2">
                {basket.length > 0 && <button type="button" onClick={() => { setBasket([]); setPayErr(null); }} className="text-[11.5px] font-semibold text-white/70 hover:text-white">Clear</button>}
                <button type="button" disabled={busy || !basket.length} onClick={payAll} className="rounded-full px-3.5 py-1.5 text-[12px] font-extrabold text-[#0e7a45] transition disabled:opacity-50" style={{ background: "#fff" }}>{busy ? "Booking…" : `Book all · ${money(basketTotal)}`}</button>
              </div>
            </div>
            {payErr && <div className="border-b border-[var(--line)] bg-[var(--red-soft,#fdebec)] px-3.5 py-2 text-[11.5px] font-semibold text-[var(--red,#e21d27)]">{payErr}</div>}
            {basketOpen && basket.length > 0 && (
              <div className="grid gap-x-4 gap-y-1 p-3 sm:grid-cols-2 lg:grid-cols-3">
                {basketByChild.map(([child, lines]) => (
                  <div key={child} className="rounded-lg border border-[var(--line)] p-2">
                    <div className="mb-0.5 flex items-baseline justify-between text-[11.5px] font-extrabold text-[#12306e]"><span>🎒 {child}</span><span className="tabular-nums">{money(lines.reduce((s, l) => s + l.price, 0))}</span></div>
                    {lines.map((l) => (
                      <div key={lineKey(l)} className="flex items-baseline gap-1.5 text-[11.5px]">
                        <span className="flex-1 truncate">{fmtDay(l.date)} · {l.name}</span>
                        <span className="tabular-nums text-[var(--ink-3)]">{money(l.price)}</span>
                        <button type="button" aria-label={`Remove ${l.name}`} onClick={() => removeLine(lineKey(l))} className="text-[var(--ink-3)] hover:text-[var(--red,#e21d27)]">✕</button>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Diet filter */}
          {dietsPresent.length > 0 && (
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold text-[var(--ink-3)]">Show:</span>
              {([["", "All meals"], ...dietsPresent.map((d) => [d.key, `${d.icon} ${d.label} only`] as [Diet, string])] as [Diet | "", string][]).map(([k, label]) => {
                const on = dietFilter === k;
                return <button key={k || "all"} type="button" onClick={() => setDietFilter(k)} className="rounded-full px-2.5 py-1 text-[11.5px] font-extrabold transition" style={on ? { background: "linear-gradient(180deg,#4f8bf5,#2f6bd8)", color: "#fff" } : { background: "var(--panel)", color: "var(--ink-2)", border: "1px solid var(--line)" }}>{label}</button>;
              })}
            </div>
          )}
          {allergenNote && <div className="mb-2 rounded-lg border border-[#f2dcbb] bg-[#fff6e9] px-3 py-2 text-[11.5px] text-[#96631a]">⚠ {allergenNote}</div>}

          {/* Weekly planner (slide show) */}
          <div className="overflow-hidden rounded-2xl border-2 border-[var(--line)] bg-white">
            <div className="flex items-center gap-2 px-3.5 py-2.5 text-white" style={{ background: `linear-gradient(120deg, ${weekPal[0]}, ${weekPal[1]})` }}>
              <button type="button" aria-label="Previous week" disabled={weekIdx === 0} onClick={() => setWeekIdx((i) => Math.max(0, i - 1))} className="grid h-7 w-7 flex-none place-items-center rounded-full bg-white/20 text-[13px] transition hover:bg-white/30 disabled:opacity-30">◀</button>
              <div className="flex-1 text-center"><span className="text-[14px] font-extrabold">Week {week.n}</span><span className="ml-1.5 text-[12px] font-semibold text-white/85">from {fmtDate(week.mon)}</span></div>
              <button type="button" aria-label="Next week" disabled={weekIdx >= menuWeeks.length - 1} onClick={() => setWeekIdx((i) => Math.min(menuWeeks.length - 1, i + 1))} className="grid h-7 w-7 flex-none place-items-center rounded-full bg-white/20 text-[13px] transition hover:bg-white/30 disabled:opacity-30">▶</button>
            </div>
            {menuWeeks.length > 1 && (
              <div className="flex justify-center gap-1 border-b border-[var(--line)] py-1.5">
                {menuWeeks.map((w, i) => <button key={w.mon} type="button" aria-label={`Week ${w.n}`} onClick={() => setWeekIdx(i)} className="h-1.5 rounded-full transition" style={{ width: i === weekIdx ? 18 : 6, background: i === weekIdx ? weekPal[0] : "var(--line)" }} />)}
              </div>
            )}
            <div className="overflow-x-auto">
              <div style={{ minWidth: 140 + week.days.length * 160 }}>
                {/* Header row */}
                <div className="grid border-b border-[var(--line)] bg-[var(--panel)]" style={{ gridTemplateColumns: `120px repeat(${week.days.length}, minmax(148px,1fr))` }}>
                  <div className="sticky left-0 z-10 bg-[var(--panel)] px-3 py-2 text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">Child</div>
                  {week.days.map((iso) => {
                    const anyClose = (byDate.get(iso) ?? []).some((e) => e.closesToday);
                    const anyOpen = (byDate.get(iso) ?? []).some((e) => e.canOrder);
                    return (
                      <div key={iso} className="border-l border-[var(--line)] px-2.5 py-2">
                        <div className="text-[12px] font-extrabold" style={{ color: weekPal[0] }}>{fmtDay(iso)}</div>
                        <div className="text-[9.5px] font-semibold" style={{ color: anyClose ? "#c0392b" : anyOpen ? "var(--ink-3)" : "var(--ink-3)" }}>{anyClose ? "closes today" : anyOpen ? "open" : "closed"}</div>
                      </div>
                    );
                  })}
                </div>
                {/* Child rows */}
                {weekKids.map((child, ri) => (
                  <div key={child} className="grid border-b border-[var(--line)] last:border-0" style={{ gridTemplateColumns: `120px repeat(${week.days.length}, minmax(148px,1fr))`, background: ri % 2 ? "var(--surface)" : "#fff" }}>
                    <div className="sticky left-0 z-10 flex items-center gap-1.5 px-3 py-2.5 text-[12.5px] font-extrabold text-[var(--ink)]" style={{ background: ri % 2 ? "var(--surface)" : "#fff" }}>
                      🎒 <span className="truncate">{child}</span>
                    </div>
                    {week.days.map((iso) => {
                      const e = entryFor(child, iso);
                      if (!e) return <div key={iso} className="border-l border-[var(--line)] px-2.5 py-2.5 text-center text-[11px] text-[var(--ink-3)]">·</div>;
                      const booked = bookedByCell.get(`${e.listingId}|${e.date}|${child}`);
                      const line = basket.find((l) => l.child === child && l.listingId === e.listingId && l.date === e.date);
                      const c = childInfo.get(child);
                      // A confirmed meal (paid or a checkout meal) — locked, shown filled.
                      if (booked && !line) {
                        const ord = booked.orderId ? orders.find((o) => o.id === booked.orderId) : undefined;
                        const pendChange = ord?.changeRequest; const pendCancel = ord?.cancelRequest;
                        return (
                          <div key={iso} className="border-l border-[var(--line)] p-2">
                            <div className="rounded-lg px-2 py-1.5 text-[11.5px] font-bold text-white" style={{ background: GRN }}>✓ {booked.name}</div>
                            {pendChange ? (
                              <div className="mt-1 text-[10px] font-semibold text-[#8a5300]">↺ change to {pendChange.name} — awaiting approval <button type="button" onClick={() => withdrawReq(booked.orderId!)} className="font-bold underline">undo</button></div>
                            ) : pendCancel ? (
                              <div className="mt-1 text-[10px] font-semibold text-[#c0392b]">removal requested — awaiting approval <button type="button" onClick={() => withdrawReq(booked.orderId!)} className="font-bold underline">undo</button></div>
                            ) : booked.canCancel && booked.orderId && e.canOrder ? (
                              <div className="mt-1 flex items-center gap-1">
                                <select aria-label={`Change ${child}'s meal`} value="" onChange={(ev) => { if (ev.target.value) changeMeal(booked.orderId!, ev.target.value); }} className="min-w-0 flex-1 rounded-md border border-[var(--line)] bg-white px-1.5 py-1 text-[10.5px] font-semibold text-[var(--ink-2)]">
                                  <option value="">Change…</option>
                                  {e.menu.items.filter((it) => it.name !== booked.name).map((it) => <option key={it.id} value={it.id}>{it.name}{it.price > 0 ? ` · ${money(it.price)}` : ""}</option>)}
                                </select>
                                <button type="button" onClick={() => cancelMeal(booked.orderId!)} className="flex-none text-[10px] font-bold text-[var(--ink-3)] hover:text-[var(--red,#e21d27)]">remove</button>
                              </div>
                            ) : <div className="mt-0.5 text-[10px] text-[var(--ink-3)]">booked</div>}
                          </div>
                        );
                      }
                      const options = e.menu.items.filter((it) => !dietFilter || it.diet === dietFilter || line?.dishId === it.id);
                      const sel = line ? e.menu.items.find((it) => it.id === line.dishId) : undefined;
                      const clash = sel ? (allergenClash(sel.allergens, c?.allergies).length > 0 || !!dietClash(sel, c?.dietary)) : false;
                      if (!e.canOrder) return <div key={iso} className="border-l border-[var(--line)] px-2.5 py-2.5 text-center text-[10.5px] font-semibold text-[var(--ink-3)]">Closed</div>;
                      return (
                        <div key={iso} className="border-l border-[var(--line)] p-2">
                          <select aria-label={`Meal for ${child} on ${fmtDay(iso)}`} value={line?.dishId ?? ""} onChange={(ev) => setCell(e, child, ev.target.value)}
                            className="w-full rounded-lg border px-2 py-1.5 text-[11.5px] font-bold transition"
                            style={line ? { borderColor: "#f2dcbb", background: "#fff6e9", color: "#96631a" } : { borderColor: "var(--line)", background: "#fff", color: "var(--ink-2)" }}>
                            <option value="">— choose —</option>
                            {options.map((it) => {
                              const soldOut = it.left !== undefined && it.left <= 0 && line?.dishId !== it.id;
                              const risk = allergenClash(it.allergens, c?.allergies).length > 0 || dietClash(it, c?.dietary);
                              return <option key={it.id} value={it.id} disabled={soldOut}>{it.name}{it.price > 0 ? ` · ${money(it.price)}` : ""}{it.diet ? ` · ${dietMeta(it.diet)?.label}` : ""}{risk ? " ⚠" : ""}{soldOut ? " (sold out)" : ""}</option>;
                            })}
                          </select>
                          {sel && (
                            <div className="mt-1 flex flex-wrap items-center gap-1">
                              {clash && <span className="rounded bg-[#fdebec] px-1 py-[0.5px] text-[9.5px] font-bold text-[#c0392b]">⚠ check suitability</span>}
                              <Allergens list={sel.allergens} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
                {weekKids.length === 0 && <div className="px-3 py-6 text-center text-[12px] text-[var(--ink-3)]">No booked children this week.</div>}
              </div>
            </div>
          </div>

          {basket.length > 0 && (
            <a href="#meal-basket" className="fixed inset-x-4 bottom-4 z-30 flex items-center justify-center gap-2 rounded-full py-3 text-[13px] font-extrabold text-white shadow-[0_10px_24px_-6px_rgba(14,154,90,.6)] lg:hidden" style={{ background: GRN }}>
              🧺 Basket · {money(basketTotal)} ({basket.length}) — tap to book
            </a>
          )}
        </>
      )}
    </div>
  );
}
