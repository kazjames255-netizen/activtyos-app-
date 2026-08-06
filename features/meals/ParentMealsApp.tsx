"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { get as apiGet, post as apiPost } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { money } from "@/features/bookings/helpers";
import { Card } from "@/components/ui";
import { groupWeeks, fmtDate } from "@/features/listings/format";
import { DIETS, dietMeta, type Diet } from "./diet";

// ─────────────────────────────────────────────────────────────────────────
// Parent Meals. Menu tab: the menu on the family's booked days, book a meal
// for one or more children (one meal per child per day), pay the basket in
// one go. Children's meals tab: a sub-tab per child with their meals + gaps.
// Allergens/diet are cross-checked against each child's profile.
// ─────────────────────────────────────────────────────────────────────────

interface MenuItem { id: string; name: string; price: number; allergens?: string[]; description?: string; diet?: Diet; capacity?: number; left?: number }
interface MealDay { tenantId: string; tenantName: string; listingId: string; listingName: string; date: string; children: string[]; menu: { id: string; name: string; items: MenuItem[] }; served: boolean; canOrder: boolean; cutoffLabel: string; closesToday: boolean; allergenNote?: string }
interface Booking { child?: string; listingId?: string; kids?: { name?: string }[]; mealItems?: { date: string; name: string; price: number }[] }
interface Order { id: string; listingId?: string; childName: string; date: string; status?: string; pay?: string; items?: { name: string; price: number; qty: number; menuItemId?: string; allergens?: string[] }[] }
interface Child { name: string; allergies?: string; dietary?: string }
type Chosen = { name: string; price: number; qty: number; allergens?: string[]; description?: string; diet?: Diet; orderId?: string; canCancel?: boolean };
type BasketLine = { tenantId: string; listingId: string; listingName: string; date: string; dishId: string; name: string; price: number; child: string };

const fmtDay = (iso: string) => (iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }) : "");
const WEEK_PAL: [string, string][] = [["#2f6bd8", "#5b9bff"], ["#0ea5a5", "#3fd0c9"], ["#7a5af8", "#a88bff"], ["#e2559a", "#ff86c0"], ["#f5872b", "#ffb166"], ["#16a34a", "#4ade80"]];
const splitKids = (s?: string) => (s ?? "").split(/,|&/).map((x) => x.trim()).filter(Boolean);
const lineKey = (l: { date: string; listingId: string; dishId: string; child: string }) => `${l.date}|${l.listingId}|${l.dishId}|${l.child}`;
const GRN = "linear-gradient(135deg,#22c07a,#0e9a5a)";

// Best-effort match of a child's free-text allergies to a dish's declared
// allergens — always paired with a "check the label" caveat, never a promise.
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

  const [picking, setPicking] = useState<string | null>(null);
  const [pickKids, setPickKids] = useState<string[]>([]);
  const [pickErr, setPickErr] = useState<string | null>(null);
  const [basket, setBasket] = useState<BasketLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [payErr, setPayErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [lastAdded, setLastAdded] = useState<string[]>([]);
  const [openMore, setOpenMore] = useState<Set<string>>(new Set()); // day-entries with "show more" expanded
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

  const orderedKey = useMemo(() => new Set(liveOrders.flatMap((o) => (o.items ?? []).map((it) => `${o.date}|${o.childName}|${it.menuItemId ?? it.name}`))), [liveOrders]);
  const basketKeys = useMemo(() => new Set(basket.map(lineKey)), [basket]);
  // One meal per child per day — every (listing, date, child) that already has
  // a meal: basket + post-booking orders + meals bought at checkout.
  const mealDayByChild = useMemo(() => {
    const s = new Set<string>();
    for (const l of basket) s.add(`${l.listingId}|${l.date}|${l.child}`);
    for (const o of liveOrders) if (o.listingId) s.add(`${o.listingId}|${o.date}|${o.childName}`);
    for (const b of bookings) { if (!b.listingId) continue; const roster = [...splitKids(b.child), ...((b.kids ?? []).map((k) => k.name).filter(Boolean) as string[])]; for (const it of (b.mealItems ?? [])) for (const c of roster) s.add(`${b.listingId}|${it.date}|${c}`); }
    return s;
  }, [basket, liveOrders, bookings]);
  const hasMealThatDay = useCallback((listingId: string, date: string, child: string) => mealDayByChild.has(`${listingId}|${date}|${child}`), [mealDayByChild]);

  const kidsWithMeals = useMemo(() => {
    const s = new Set<string>();
    for (const b of bookings.filter((x) => (x.mealItems?.length ?? 0) > 0)) for (const k of splitKids(b.child)) s.add(k);
    for (const o of liveOrders) s.add(o.childName);
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [bookings, liveOrders]);

  const byDate = useMemo(() => { const m = new Map<string, MealDay[]>(); for (const d of served) { if (d.date < todayIso) continue; const a = m.get(d.date) ?? []; a.push(d); m.set(d.date, a); } return m; }, [served, todayIso]);
  const menuWeeks = useMemo(() => groupWeeks([...byDate.keys()]), [byDate]);

  // Per-child coverage across upcoming meal days (booked days that offer a menu).
  const coverage = useMemo(() => {
    const m = new Map<string, { done: number; total: number; gaps: string[] }>();
    for (const entries of byDate.values()) for (const e of entries) for (const c of kidsFor(e.listingId)) {
      const g = m.get(c) ?? { done: 0, total: 0, gaps: [] }; g.total++;
      if (hasMealThatDay(e.listingId, e.date, c)) g.done++; else g.gaps.push(e.date);
      m.set(c, g);
    }
    return m;
  }, [byDate, kidsFor, hasMealThatDay]);

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

  const pickId = (e: MealDay, it: MenuItem) => `${e.date}|${e.listingId}|${it.id}`;
  const toggleKid = (k: string) => { setPickErr(null); setPickKids((prev) => prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]); };
  const dishLeft = (e: MealDay, it: MenuItem) => it.left === undefined ? undefined : Math.max(0, it.left - kidsFor(e.listingId).filter((k) => basketKeys.has(`${e.date}|${e.listingId}|${it.id}|${k}`)).length);

  const addMeal = (e: MealDay, it: MenuItem, chosen: string[]): string[] => {
    let add = chosen.filter((k) => !hasMealThatDay(e.listingId, e.date, k) && !orderedKey.has(`${e.date}|${k}|${it.id}`));
    // Capacity cap.
    const left = dishLeft(e, it);
    if (left !== undefined && add.length > left) add = add.slice(0, left);
    if (!add.length) return [];
    // Allergen / dietary safety — confirm before adding a risky meal.
    const risky = add.map((k) => { const c = childInfo.get(k); const al = allergenClash(it.allergens, c?.allergies); const dc = dietClash(it, c?.dietary); return al.length || dc ? `${k}: ${[al.length ? `contains ${al.join(", ")}` : "", dc || ""].filter(Boolean).join("; ")}` : null; }).filter(Boolean) as string[];
    if (risky.length && typeof window !== "undefined" && !window.confirm(`Please check — this meal may not suit:\n\n${risky.join("\n")}\n\nAllergen info is a guide; confirm with your provider. Add anyway?`)) return [];
    setBasket((prev) => [...prev, ...add.map((child) => ({ tenantId: e.tenantId, listingId: e.listingId, listingName: e.listingName, date: e.date, dishId: it.id, name: it.name, price: it.price, child }))]);
    setLastAdded(add.map((child) => `${e.date}|${e.listingId}|${it.id}|${child}`));
    setPayErr(null); setToast(`Added ${it.name} for ${add.join(", ")}.`);
    return add;
  };
  const clickAdd = (e: MealDay, it: MenuItem, kids: string[]) => {
    if (kids.length === 1) { if (!addMeal(e, it, kids).length) setToast(`${kids[0]} already has a meal that day — remove it first to change.`); return; }
    const id = pickId(e, it); setPickErr(null); if (picking === id) { setPicking(null); return; } setPicking(id); setPickKids([]);
  };
  const addFromPicker = (e: MealDay, it: MenuItem) => {
    if (!pickKids.length) { setPickErr("Choose at least one child."); return; }
    if (!addMeal(e, it, pickKids).length) { setPickErr("Those children already have a meal that day."); return; }
    setPicking(null); setPickKids([]);
  };
  const removeLine = (key: string) => setBasket((prev) => prev.filter((l) => lineKey(l) !== key));
  const undoLast = () => { const s = new Set(lastAdded); setBasket((prev) => prev.filter((l) => !s.has(lineKey(l)))); setLastAdded([]); setToast(null); };
  const basketTotal = basket.reduce((s, l) => s + l.price, 0);
  const basketByChild = useMemo(() => {
    const m = new Map<string, BasketLine[]>();
    for (const l of [...basket].sort((a, b) => a.date.localeCompare(b.date))) { const a = m.get(l.child) ?? []; a.push(l); m.set(l.child, a); }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [basket]);

  const dietsPresent = useMemo(() => DIETS.filter((d) => [...byDate.values()].some((es) => es.some((e) => e.canOrder && e.menu.items.some((it) => it.diet === d.key)))), [byDate]);

  // Quick-fill: add a diet's dish for every child (or one child) on every
  // orderable booked day, skipping days already covered and honouring capacity.
  const bulkAdd = (diet: Diet, onlyKid?: string) => {
    const meta = dietMeta(diet)!;
    const seenDay = new Set(mealDayByChild);
    const capLeft = new Map<string, number>(); // `${listing}|${date}|${dishId}` remaining this run
    const lines: BasketLine[] = [];
    let skippedRisk = 0;
    for (const entries of byDate.values()) for (const e of entries) {
      if (!e.canOrder) continue;
      const dish = e.menu.items.find((it) => it.diet === diet);
      if (!dish) continue;
      const ck = `${e.listingId}|${e.date}|${dish.id}`;
      if (!capLeft.has(ck)) capLeft.set(ck, dish.left ?? Infinity);
      for (const child of (onlyKid ? [onlyKid] : kidsFor(e.listingId))) {
        if (onlyKid && !kidsFor(e.listingId).includes(child)) continue;
        const dayKey = `${e.listingId}|${e.date}|${child}`;
        if (seenDay.has(dayKey)) continue;
        if ((capLeft.get(ck) ?? 0) <= 0) continue;
        const c = childInfo.get(child);
        if (allergenClash(dish.allergens, c?.allergies).length || dietClash(dish, c?.dietary)) { skippedRisk++; continue; }
        seenDay.add(dayKey); capLeft.set(ck, (capLeft.get(ck) ?? 0) - 1);
        lines.push({ tenantId: e.tenantId, listingId: e.listingId, listingName: e.listingName, date: e.date, dishId: dish.id, name: dish.name, price: dish.price, child });
      }
    }
    if (!lines.length) { setLastAdded([]); setToast(`No new ${meta.short} meals to add${skippedRisk ? " — some skipped for allergy/diet" : " — days already covered"}.`); return; }
    setBasket((prev) => [...prev, ...lines]); setPayErr(null); setLastAdded(lines.map(lineKey));
    setToast(`Added ${lines.length} ${meta.short} meal${lines.length === 1 ? "" : "s"}${skippedRisk ? ` (skipped ${skippedRisk} for allergy/diet)` : ""}.`);
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
      try {
        await apiPost("/api/meal-orders", { tenantId: g.tenantId, listingId: g.listingId, date: g.date, childName: g.child, items: [...g.items].map(([menuItemId, qty]) => ({ menuItemId, qty })) });
        doneKeys.push(...g.keys);
      } catch (err) { failMsg = err instanceof Error ? err.message : "Some meals couldn't be booked."; break; }
    }
    // Drop everything that succeeded so a retry never double-books.
    if (doneKeys.length) { const s = new Set(doneKeys); setBasket((prev) => prev.filter((l) => !s.has(lineKey(l)))); setLastAdded([]); }
    if (failMsg) setPayErr(`${failMsg} ${doneKeys.length ? "The rest are still in your basket." : ""}`.trim());
    else setToast(`✓ Booked ${doneKeys.length} meal${doneKeys.length === 1 ? "" : "s"} — held for you now.`);
    load(); setBusy(false);
  }, [basket, load]);

  const cancelMeal = useCallback(async (orderId: string) => {
    if (typeof window !== "undefined" && !window.confirm("Remove this meal?")) return;
    try { await apiPost(`/api/meal-orders/${encodeURIComponent(orderId)}/cancel`, {}); setToast("Meal removed."); load(); }
    catch (err) { setToast(err instanceof Error ? err.message : "Couldn't remove that meal."); }
  }, [load]);

  return (
    <div className="text-[var(--ink)]">
      <div className="relative mb-3.5 overflow-hidden rounded-2xl p-5 text-white shadow-[0_10px_30px_-12px_rgba(29,58,143,.55)]" style={{ background: "linear-gradient(120deg,#1d3a8f 0%,#3f78d8 62%,#ffffff 100%)" }}>
        <div className="flex items-center gap-2 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-[17px]">🍽️</span>Meals
        </div>
        <p className="mt-1.5 max-w-[560px] text-[12.5px] leading-[1.5] text-white/85">Book a meal for each child on your booked days — one meal per day. We flag anything that clashes with a child’s allergies or diet.</p>
      </div>
      {error && <div className="mb-3 rounded-lg border border-[var(--red-line,#f6c9cc)] bg-[var(--red-soft,#fdebec)] px-3 py-2 text-[12.5px] text-[var(--red,#e21d27)]">{error}</div>}
      {ordersWarn && <div className="mb-3 rounded-lg border border-[#f2dcbb] bg-[#fff6e9] px-3 py-2 text-[12px] font-semibold text-[#96631a]">Couldn’t load your existing meal orders — refresh to make sure you don’t double-book.</div>}
      {toast && (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-[#bde5cd] bg-[#effaf3] px-3.5 py-2.5 text-[12.5px] font-semibold text-[#0e7a45]">
          <span className="flex-1">{toast}</span>
          {lastAdded.length > 0 && <button type="button" onClick={undoLast} className="flex-none rounded-full bg-white px-2.5 py-[3px] text-[11.5px] font-extrabold text-[#0e7a45] shadow-sm transition hover:bg-[#0e7a45] hover:text-white">↩ Undo</button>}
          <button type="button" aria-label="Dismiss" onClick={() => { setToast(null); setLastAdded([]); }} className="flex-none text-[#0e7a45]/70 hover:text-[#0e7a45]">✕</button>
        </div>
      )}

      {kidsWithMeals.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {([["menu", "🍴 Menu"], ["kids", "🎒 Children’s meals"]] as [("menu" | "kids"), string][]).map(([key, label]) => {
            const on = view === key;
            return (
              <button key={key} type="button" onClick={() => { setView(key); setToast(null); setPicking(null); }} className="rounded-full px-3.5 py-1.5 text-[12.5px] font-extrabold transition"
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
            <div className="mb-2 rounded-lg border border-[#f2dcbb] bg-[#fff6e9] px-3 py-1.5 text-[11.5px] font-semibold text-[#96631a]">No meal yet on {cov.gaps.slice(0, 6).map(fmtDay).join(", ")}{cov.gaps.length > 6 ? "…" : ""} — add from the Menu tab.</div>
          ); })()}
          {chosenByDate.size === 0
            ? <Card className="p-6 text-center text-[13px] text-[var(--ink-3)]">{activeKid} hasn’t got any meals yet — book one from the Menu tab, or add meals when you book.</Card>
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
                                    {it.qty > 1 && <span className="text-[var(--ink-3)]">× {it.qty}</span>}
                                    {it.price > 0 && <span className="tabular-nums text-[var(--ink-2)]">{money(it.price)}</span>}
                                    <Allergens list={it.allergens} />
                                    {it.canCancel && it.orderId && <button type="button" onClick={() => cancelMeal(it.orderId!)} className="ml-auto text-[11px] font-bold text-[var(--ink-3)] hover:text-[var(--red,#e21d27)]">Remove</button>}
                                  </div>
                                  {it.description && <div className="mt-0.5 pl-4 text-[11px] leading-snug text-[var(--ink-3)]">{it.description}</div>}
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
              <div className="mt-2 text-[11px] text-[var(--ink-3)]">To change a booked meal, remove it (if still open) and pick another, or ask your provider.</div>
            </>
          )}
        </>
      ) : served.length === 0 ? (
        <Card className="p-6 text-center text-[13px] text-[var(--ink-3)]">No menus to show yet — the day’s menu appears here for listings your provider offers meals on.</Card>
      ) : (
        <>
        {dietsPresent.length > 0 && (
          <div className="mb-3 rounded-2xl border border-[var(--line)] bg-white p-3">
            <div className="text-[12px] font-extrabold text-[#12306e]">🍽️ Quick-fill the basket</div>
            <div className="mt-0.5 text-[11px] text-[var(--ink-3)]">Add one meal for every child on every booked day. Skips days already booked, past the cut-off, or that clash with a child’s allergies/diet.</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {dietsPresent.map((d) => (
                <button key={d.key} type="button" onClick={() => bulkAdd(d.key)} className="rounded-full px-3 py-1.5 text-[12px] font-extrabold transition active:scale-[.97]" style={{ background: d.bg, color: d.fg, border: `1px solid ${d.fg}40` }}>
                  {d.icon} {d.label} for everyone, every day
                </button>
              ))}
            </div>
          </div>
        )}
        {allergenNote && <div className="mb-3 rounded-lg border border-[#f2dcbb] bg-[#fff6e9] px-3 py-2 text-[11.5px] text-[#96631a]">⚠ {allergenNote}</div>}
        <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] font-semibold text-[var(--ink-3)]">
          <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: GRN }} />chosen</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full bg-[#f5b642]" />in your basket</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full bg-[#5b9bff]" />available to add</span>
        </div>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            {menuWeeks.map((w, wi) => {
              const [d1, d2] = WEEK_PAL[wi % WEEK_PAL.length];
              return (
                <div key={w.mon} className="overflow-hidden rounded-2xl border-2 border-[var(--line)] bg-white">
                  <div className="flex items-center gap-2 px-3.5 py-2.5 text-white" style={{ background: `linear-gradient(120deg, ${d1}, ${d2})` }}>
                    <span className="grid h-7 w-7 flex-none place-items-center rounded-full bg-white/25 text-[13px]">📅</span>
                    <span className="text-[14px] font-extrabold">Week {w.n}</span><span className="text-[12px] font-semibold text-white/85">· from {fmtDate(w.mon)}</span>
                  </div>
                  <div className="grid gap-2.5 p-3 sm:grid-cols-2">
                    {w.days.map((iso) => (
                      <div key={iso} className="rounded-xl border border-[var(--line)] p-3" style={{ background: `${d1}0d` }}>
                        <div className="text-[12.5px] font-extrabold" style={{ color: d1 }}>{fmtDay(iso)}</div>
                        <div className="mt-1.5 flex flex-col gap-2.5">
                          {(byDate.get(iso) ?? []).map((e) => {
                            const kids = kidsFor(e.listingId);
                            const canBook = e.canOrder && kids.length > 0;
                            const moreKey = `${e.date}|${e.listingId}`;
                            // Chosen-for-someone dishes first; collapse the long tail.
                            const dishes = [...e.menu.items].sort((a, b) => {
                              const ca = kids.some((k) => orderedKey.has(`${e.date}|${k}|${a.id}`) || basketKeys.has(`${e.date}|${e.listingId}|${a.id}|${k}`)) ? 0 : 1;
                              const cb = kids.some((k) => orderedKey.has(`${e.date}|${k}|${b.id}`) || basketKeys.has(`${e.date}|${e.listingId}|${b.id}|${k}`)) ? 0 : 1;
                              return ca - cb;
                            });
                            const collapsed = dishes.length > 4 && !openMore.has(moreKey);
                            const shown = collapsed ? dishes.slice(0, 4) : dishes;
                            return (
                              <div key={e.listingId}>
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                  <span className="text-[10.5px] font-bold uppercase tracking-[0.03em] text-[var(--ink-3)]">{e.listingName} · {e.menu.name}</span>
                                  {e.canOrder
                                    ? <span className="text-[10px] font-semibold" style={{ color: e.closesToday ? "#c0392b" : "#2f6bd8" }}>🕒 {e.closesToday ? "Ordering closes today" : e.cutoffLabel}</span>
                                    : <span className="text-[10px] font-semibold text-[var(--ink-3)]">Ordering closed for this day</span>}
                                </div>
                                <div className="mt-1.5 flex flex-col gap-1.5">
                                  {shown.map((it) => {
                                    const solo = kids.length === 1 ? kids[0] : null;
                                    const bookedKids = kids.filter((k) => orderedKey.has(`${e.date}|${k}|${it.id}`));
                                    const basketKids = kids.filter((k) => basketKeys.has(`${e.date}|${e.listingId}|${it.id}|${k}`));
                                    const chosenN = bookedKids.length + basketKids.length;
                                    const allChosen = kids.length > 0 && chosenN >= kids.length;
                                    const soloBooked = !!solo && bookedKids.length > 0;
                                    const soloInBasket = !!solo && basketKids.length > 0;
                                    const open = !solo && picking === pickId(e, it);
                                    const left = dishLeft(e, it);
                                    const soldOut = left === 0 && !allChosen;
                                    return (
                                      <div key={it.id} className="overflow-hidden rounded-xl border transition"
                                        style={open ? { borderColor: "#a9caf7", background: "#fff", boxShadow: "0 8px 22px -12px rgba(47,107,216,.5)" } : allChosen ? { borderColor: "#b6e4cd", background: "#f3fbf6" } : { borderColor: "var(--line)", background: "#fff", boxShadow: "0 1px 2px rgba(16,42,110,.05)" }}>
                                        <div className="flex items-start gap-2.5 p-2.5">
                                          <span className="grid h-8 w-8 flex-none place-items-center rounded-lg text-[15px]" style={allChosen ? { background: GRN, color: "#fff" } : { background: `${d1}14` }}>{allChosen ? "✓" : "🍴"}</span>
                                          <div className="min-w-0 flex-1">
                                            <div className="text-[13px] font-extrabold leading-tight text-[var(--ink)]">{it.name}</div>
                                            {it.description && <div className="mt-0.5 text-[11px] leading-snug text-[var(--ink-3)]">{it.description}</div>}
                                            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                              <span className="rounded-full bg-[#eef4fd] px-2 py-[1.5px] text-[11px] font-extrabold tabular-nums text-[#1d3a8f]">{money(it.price)}</span>
                                              <DietBadge diet={it.diet} />
                                              <Allergens list={it.allergens} />
                                              {left !== undefined && left <= 5 && <span className="rounded-full px-1.5 py-[1px] text-[10px] font-bold" style={soldOut ? { background: "#fdebec", color: "#c0392b" } : { background: "#fff3e0", color: "#96631a" }}>{soldOut ? "Sold out" : `${left} left`}</span>}
                                            </div>
                                          </div>
                                          {canBook && (soloBooked ? (
                                            <span className="flex flex-none items-center gap-1 rounded-full px-3 py-1.5 text-[11.5px] font-extrabold text-white" style={{ background: GRN }}>✓ Booked</span>
                                          ) : solo ? (
                                            <button type="button" disabled={busy || (soldOut && !soloInBasket)} aria-label={soloInBasket ? `Remove ${it.name} for ${solo}` : `Add ${it.name} for ${solo}`} onClick={() => soloInBasket ? removeLine(`${e.date}|${e.listingId}|${it.id}|${solo}`) : clickAdd(e, it, kids)}
                                              className="flex flex-none items-center gap-1 rounded-full px-3 py-1.5 text-[11.5px] font-extrabold text-white transition active:scale-[.96] disabled:opacity-40"
                                              style={soloInBasket ? { background: GRN } : { background: "linear-gradient(135deg,#5b9bff,#2f6bd8)", boxShadow: "0 5px 14px -4px rgba(47,107,216,.6)" }}>
                                              {soloInBasket ? "✓ Added" : "＋ Add"}
                                            </button>
                                          ) : (
                                            <button type="button" disabled={busy || (soldOut && chosenN === 0)} aria-label={`Choose children for ${it.name}`} onClick={() => clickAdd(e, it, kids)}
                                              className="flex flex-none items-center gap-1 rounded-full px-3 py-1.5 text-[11.5px] font-extrabold transition active:scale-[.96] disabled:opacity-40"
                                              style={open ? { background: "#eef2fb", color: "#2f6bd8", border: "1px solid #cfe0fb" } : allChosen ? { background: GRN, color: "#fff" } : { background: "linear-gradient(135deg,#5b9bff,#2f6bd8)", color: "#fff", boxShadow: "0 5px 14px -4px rgba(47,107,216,.6)" }}>
                                              {open ? "✕ Close" : allChosen ? "✓ All set" : chosenN > 0 ? "＋ Add more" : soldOut ? "Sold out" : "＋ Add"}
                                            </button>
                                          ))}
                                        </div>
                                        {!solo && chosenN > 0 && (
                                          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 border-t px-3 py-1.5 text-[11px] font-semibold" style={{ borderColor: allChosen ? "#cdeede" : "var(--line)", background: allChosen ? "#eafaf1" : "#f7fbf8" }}>
                                            {basketKids.length > 0 && <span className="text-[#0e7a45]">🧺 In basket: {basketKids.join(", ")}</span>}
                                            {bookedKids.length > 0 && <span className="text-[#12306e]">✓ Booked: {bookedKids.join(", ")}</span>}
                                          </div>
                                        )}
                                        {open && (
                                          <div className="border-t border-[#e6eefb] bg-gradient-to-b from-[#f4f8ff] to-white p-2.5">
                                            <div className="mb-1.5 text-[11px] font-bold text-[#12306e]">Who’s this meal for? <span className="font-semibold text-[var(--ink-3)]">Pick one or more.</span></div>
                                            <div className="flex flex-wrap gap-1.5">
                                              {(() => {
                                                const selectable = kids.filter((k) => !hasMealThatDay(e.listingId, e.date, k) && !orderedKey.has(`${e.date}|${k}|${it.id}`));
                                                if (selectable.length < 2) return null;
                                                const allSel = selectable.every((k) => pickKids.includes(k));
                                                return (
                                                  <button type="button" onClick={() => { setPickErr(null); setPickKids(allSel ? [] : selectable); }} className="rounded-full px-2.5 py-1 text-[11.5px] font-extrabold transition"
                                                    style={allSel ? { background: GRN, color: "#fff", boxShadow: "0 3px 9px -3px rgba(14,154,90,.55)" } : { background: "#eefaf3", color: "#0e7a45", border: "1px solid #bde5cd" }}>
                                                    {allSel ? "✓ All kids" : "👪 All kids"}
                                                  </button>
                                                );
                                              })()}
                                              {kids.map((k) => {
                                                const done = orderedKey.has(`${e.date}|${k}|${it.id}`);
                                                const inBasket = basketKeys.has(`${e.date}|${e.listingId}|${it.id}|${k}`);
                                                const otherMeal = !done && !inBasket && hasMealThatDay(e.listingId, e.date, k);
                                                const c = childInfo.get(k);
                                                const warn = !done && !inBasket && !otherMeal && (allergenClash(it.allergens, c?.allergies).length > 0 || !!dietClash(it, c?.dietary));
                                                const sel = pickKids.includes(k);
                                                return (
                                                  <button key={k} type="button" disabled={done || inBasket || otherMeal} onClick={() => toggleKid(k)}
                                                    className="rounded-full px-2.5 py-1 text-[11.5px] font-extrabold transition disabled:cursor-not-allowed"
                                                    style={done ? { background: "#effaf3", color: "#0e7a45", border: "1px solid #bde5cd" } : inBasket ? { background: "#fff6e9", color: "#96631a", border: "1px solid #f2dcbb" } : otherMeal ? { background: "var(--panel)", color: "var(--ink-3)", border: "1px solid var(--line)", opacity: 0.7 } : sel ? { background: "linear-gradient(180deg,#4f8bf5,#2f6bd8)", color: "#fff", boxShadow: "0 3px 9px -3px rgba(47,107,216,.55)" } : { background: "#fff", color: "var(--ink-2)", border: "1px solid var(--line)" }}>
                                                    {done ? `✓ ${k} · booked` : inBasket ? `🧺 ${k} · in basket` : otherMeal ? `${k} · has a meal` : `${sel ? "✓" : warn ? "⚠" : "🎒"} ${k}`}
                                                  </button>
                                                );
                                              })}
                                            </div>
                                            {pickErr && <div className="mt-1.5 text-[11px] font-semibold text-[var(--red,#e21d27)]">{pickErr}</div>}
                                            <button type="button" disabled={!pickKids.length || busy} onClick={() => addFromPicker(e, it)}
                                              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-[12.5px] font-extrabold text-white transition active:scale-[.99] disabled:opacity-50" style={{ background: GRN, boxShadow: "0 6px 16px -5px rgba(14,154,90,.6)" }}>
                                              ＋ Add to basket{pickKids.length > 1 ? ` (${pickKids.length})` : ""}
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                  {collapsed && <button type="button" onClick={() => setOpenMore((s) => new Set(s).add(moreKey))} className="self-start text-[11px] font-bold text-[#2f6bd8] underline">＋{dishes.length - 4} more option{dishes.length - 4 === 1 ? "" : "s"}</button>}
                                </div>
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

          <aside id="meal-basket" className="lg:sticky lg:top-4 lg:w-[300px] lg:flex-none">
            <div className="overflow-hidden rounded-2xl border-2 border-[var(--line)] bg-white shadow-[0_12px_34px_-18px_rgba(29,58,143,.5)]">
              <div className="flex items-center gap-2 px-3.5 py-2.5 text-white" style={{ background: "linear-gradient(120deg,#1d3a8f,#3f78d8)" }}>
                <span className="grid h-7 w-7 flex-none place-items-center rounded-full bg-white/20 text-[14px]">🧺</span>
                <span className="text-[14px] font-extrabold">Meal basket</span>
                {basket.length > 0 && <span className="ml-auto rounded-full bg-white/20 px-2 py-0.5 text-[11.5px] font-extrabold">{basket.length}</span>}
              </div>
              {basket.length === 0 ? (
                <div className="px-4 py-6 text-center text-[12px] text-[var(--ink-3)]">Your basket is empty.<br />Tap <b className="text-[var(--ink-2)]">＋ Add</b> on a meal to start.</div>
              ) : (
                <div className="flex flex-col">
                  <div className="flex max-h-[340px] flex-col overflow-y-auto">
                    {basketByChild.map(([child, lines]) => (
                      <div key={child} className="border-b border-[var(--line)] last:border-0">
                        <div className="flex items-center justify-between bg-[#f7faff] px-3 py-1.5 text-[11px] font-extrabold text-[#12306e]"><span>🎒 {child}</span><span className="tabular-nums">{money(lines.reduce((s, l) => s + l.price, 0))}</span></div>
                        {lines.map((l) => (
                          <div key={lineKey(l)} className="flex items-start gap-2 px-3 py-2">
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-[12px] font-bold text-[var(--ink)]">{l.name}</div>
                              <div className="text-[10.5px] text-[var(--ink-3)]">{fmtDay(l.date)}</div>
                            </div>
                            <span className="tabular-nums text-[11.5px] font-bold text-[var(--ink-2)]">{money(l.price)}</span>
                            <button type="button" aria-label={`Remove ${l.name} for ${l.child}`} onClick={() => removeLine(lineKey(l))} className="text-[var(--ink-3)] transition hover:text-[var(--red,#e21d27)]">✕</button>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between border-t border-[var(--line)] px-3.5 py-2.5">
                    <span className="text-[12px] font-bold text-[var(--ink-2)]">Total</span>
                    <span className="text-[15px] font-extrabold tabular-nums text-[#0e9a5a]">{money(basketTotal)}</span>
                  </div>
                  {payErr && <div className="mx-3 mb-1 rounded-lg bg-[var(--red-soft,#fdebec)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--red,#e21d27)]">{payErr}</div>}
                  <div className="px-3 pb-3">
                    <button type="button" disabled={busy} onClick={payAll} className="flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-[13px] font-extrabold text-white transition active:scale-[.99] disabled:opacity-50" style={{ background: GRN, boxShadow: "0 8px 20px -6px rgba(14,154,90,.6)" }}>
                      {busy ? "Booking…" : <>🧺 Book all · {money(basketTotal)}</>}
                    </button>
                    <button type="button" onClick={() => { setBasket([]); setPayErr(null); setLastAdded([]); }} className="mt-1.5 w-full text-center text-[11px] font-semibold text-[var(--ink-3)] hover:text-[var(--ink-2)]">Clear basket</button>
                    <div className="mt-1 text-center text-[10px] text-[var(--ink-3)]">Held for you now · your provider charges these to your account.</div>
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>
        {basket.length > 0 && (
          <a href="#meal-basket" className="fixed inset-x-4 bottom-4 z-30 flex items-center justify-center gap-2 rounded-full py-3 text-[13px] font-extrabold text-white shadow-[0_10px_24px_-6px_rgba(14,154,90,.6)] lg:hidden" style={{ background: GRN }}>
            🧺 Basket · {money(basketTotal)} ({basket.length})
          </a>
        )}
        </>
      )}
    </div>
  );
}
