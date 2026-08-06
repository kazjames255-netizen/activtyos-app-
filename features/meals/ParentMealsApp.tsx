"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { get as apiGet, post as apiPost } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { money } from "@/features/bookings/helpers";
import { Card } from "@/components/ui";
import { groupWeeks, fmtDate } from "@/features/listings/format";

// ─────────────────────────────────────────────────────────────────────────
// Parent Meals. "What's on" shows the menu on the family's booked days and —
// while the provider's ordering window is open — lets a parent book a meal
// for a child there and then (same options as checkout). A tab appears for
// each child who has a meal, showing only their meals (booked at checkout or
// ordered here).
// ─────────────────────────────────────────────────────────────────────────

interface MenuItem { id: string; name: string; price: number; allergens?: string[]; description?: string }
interface MealDay { tenantId: string; tenantName: string; listingId: string; listingName: string; date: string; children: string[]; menu: { id: string; name: string; items: MenuItem[] }; served: boolean; canOrder: boolean; cutoffLabel: string }
interface Booking { child?: string; listingId?: string; kids?: { name?: string }[]; mealItems?: { date: string; name: string; price: number }[] }
interface Order { id: string; listingId?: string; childName: string; date: string; status?: string; items?: { name: string; price: number; qty: number; menuItemId?: string; allergens?: string[] }[] }
type Chosen = { name: string; price: number; qty: number; allergens?: string[]; description?: string };

const fmtDay = (iso: string) => (iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }) : "");
const WEEK_PAL: [string, string][] = [["#2f6bd8", "#5b9bff"], ["#0ea5a5", "#3fd0c9"], ["#7a5af8", "#a88bff"], ["#e2559a", "#ff86c0"], ["#f5872b", "#ffb166"], ["#16a34a", "#4ade80"]];
// A booking may hold several kids on one line ("Ava, Ben & Cara") — split so
// each gets their own tab.
const splitKids = (s?: string) => (s ?? "").split(/,|&/).map((x) => x.trim()).filter(Boolean);
// Softer allergen note — "contains …" in muted amber, not loud red.
const Allergens = ({ list }: { list?: string[] }) => (list?.length ? <span className="rounded-md bg-[#fdf3e3] px-1.5 py-[1px] text-[10px] font-semibold capitalize text-[#96631a]">contains {list.join(", ")}</span> : null);

export function ParentMealsApp() {
  const [days, setDays] = useState<MealDay[] | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<string>(""); // "" = What's on; else a child's name

  // Ordering state.
  const [picking, setPicking] = useState<string | null>(null); // `${date}|${listingId}|${itemId}`
  const [pickKid, setPickKid] = useState("");
  const [busy, setBusy] = useState(false);
  const [pickErr, setPickErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(() => {
    apiGet<MealDay[]>("/api/my/meal-days").then(setDays).catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
    apiGet<Booking[]>("/api/my/bookings").then(setBookings).catch(() => {});
    apiGet<Order[]>("/api/meal-orders").then(setOrders).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);
  useRealtime(["listings", "bookings"], load);

  const served = useMemo(() => (days ?? []).filter((d) => d.served), [days]);
  // Price + allergens for a dish on a date, from the served menus.
  const dishInfo = useMemo(() => { const m = new Map<string, MenuItem>(); for (const d of served) for (const it of d.menu.items) m.set(`${d.date}|${it.name}`, it); return m; }, [served]);
  const liveOrders = useMemo(() => orders.filter((o) => o.status !== "cancelled"), [orders]);

  // The family's children per listing (from their bookings) — who a meal can
  // be booked for on that listing's days.
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

  // Meals already booked here, so an item shows as ordered per child.
  const orderedKey = useMemo(() => new Set(liveOrders.flatMap((o) => (o.items ?? []).map((it) => `${o.date}|${o.childName}|${it.menuItemId ?? it.name}`))), [liveOrders]);

  // A tab per child who has a meal (chosen at checkout OR ordered here).
  const kidsWithMeals = useMemo(() => {
    const s = new Set<string>();
    for (const b of bookings.filter((x) => (x.mealItems?.length ?? 0) > 0)) for (const k of splitKids(b.child)) s.add(k);
    for (const o of liveOrders) s.add(o.childName);
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [bookings, liveOrders]);

  // ── "What's on" data: the full menu, week by week ──
  const byDate = useMemo(() => { const m = new Map<string, MealDay[]>(); for (const d of served) { const a = m.get(d.date) ?? []; a.push(d); m.set(d.date, a); } return m; }, [served]);
  const menuWeeks = useMemo(() => groupWeeks([...byDate.keys()]), [byDate]);

  // ── Child tab data: only this child's meals (checkout + ordered here) ──
  const chosenByDate = useMemo(() => {
    const m = new Map<string, Chosen[]>();
    if (!tab) return m;
    for (const b of bookings) {
      if (!splitKids(b.child).includes(tab)) continue;
      for (const it of (b.mealItems ?? [])) { const info = dishInfo.get(`${it.date}|${it.name}`); const a = m.get(it.date) ?? []; a.push({ name: it.name, price: it.price, qty: 1, allergens: info?.allergens, description: info?.description }); m.set(it.date, a); }
    }
    for (const o of liveOrders) {
      if (o.childName !== tab) continue;
      for (const it of (o.items ?? [])) { const info = dishInfo.get(`${o.date}|${it.name}`); const a = m.get(o.date) ?? []; a.push({ name: it.name, price: it.price, qty: it.qty ?? 1, allergens: it.allergens ?? info?.allergens, description: info?.description }); m.set(o.date, a); }
    }
    return m;
  }, [tab, bookings, liveOrders, dishInfo]);
  const chosenWeeks = useMemo(() => groupWeeks([...chosenByDate.keys()]), [chosenByDate]);
  const chosenCount = [...chosenByDate.values()].reduce((s, a) => s + a.reduce((n, c) => n + c.qty, 0), 0);

  const pickId = (e: MealDay, it: MenuItem) => `${e.date}|${e.listingId}|${it.id}`;
  const startPick = (e: MealDay, it: MenuItem) => { const id = pickId(e, it); const kids = kidsFor(e.listingId); setPickErr(null); setToast(null); if (picking === id) { setPicking(null); return; } setPicking(id); setPickKid(kids.length === 1 ? kids[0] : ""); };

  const book = useCallback(async (e: MealDay, it: MenuItem) => {
    if (!pickKid) { setPickErr("Choose which child this meal is for."); return; }
    setBusy(true); setPickErr(null);
    try {
      await apiPost("/api/meal-orders", { tenantId: e.tenantId, listingId: e.listingId, date: e.date, childName: pickKid, items: [{ menuItemId: it.id, qty: 1 }] });
      setPicking(null); setToast(`✓ Booked ${it.name} for ${pickKid} on ${fmtDay(e.date)} — payment taken with your account.`);
      load();
    } catch (err) { setPickErr(err instanceof Error ? err.message : "Couldn't book that meal — try again."); }
    finally { setBusy(false); }
  }, [pickKid, load]);

  return (
    <div className="text-[var(--ink)]">
      <div className="relative mb-3.5 overflow-hidden rounded-2xl p-5 text-white shadow-[0_10px_30px_-12px_rgba(29,58,143,.55)]" style={{ background: "linear-gradient(120deg,#1d3a8f 0%,#3f78d8 62%,#ffffff 100%)" }}>
        <div className="flex items-center gap-2 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-[17px]">🍽️</span>Meals
        </div>
        <p className="mt-1.5 max-w-[560px] text-[12.5px] leading-[1.5] text-white/85">What’s on the menu on your children’s booked days. Book a meal for a child any time the provider’s ordering window is open — allergens shown on every item.</p>
      </div>
      {error && <div className="mb-3 rounded-lg border border-[var(--red-line,#f6c9cc)] bg-[var(--red-soft,#fdebec)] px-3 py-2 text-[12.5px] text-[var(--red,#e21d27)]">{error}</div>}
      {toast && (
        <div className="mb-3 flex items-start gap-2 rounded-xl border border-[#bde5cd] bg-[#effaf3] px-3.5 py-2.5 text-[12.5px] font-semibold text-[#0e7a45]">
          <span className="flex-1">{toast}</span>
          <button type="button" onClick={() => setToast(null)} className="text-[#0e7a45]/70 hover:text-[#0e7a45]">✕</button>
        </div>
      )}

      {/* Tabs — What's on + a tab per child who has a meal */}
      {kidsWithMeals.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {[["", "What’s on"], ...kidsWithMeals.map((k) => [k, k] as [string, string])].map(([key, label]) => {
            const on = tab === key;
            return (
              <button key={key} type="button" onClick={() => { setTab(key); setToast(null); setPicking(null); }} className="rounded-full px-3.5 py-1.5 text-[12.5px] font-extrabold transition"
                style={on ? { background: "linear-gradient(180deg,#4f8bf5,#2f6bd8)", color: "#fff", boxShadow: "0 4px 12px -3px rgba(47,107,216,.6)" } : { background: "var(--panel)", color: "var(--ink-2)", border: "1px solid var(--line)" }}>
                {key === "" ? "📅 " : "🎒 "}{label}
              </button>
            );
          })}
        </div>
      )}

      {!days ? <div className="py-6 text-center text-[12px] text-[var(--ink-3)]">Loading…</div>
      : tab ? (
        // ── A child's meals ──
        chosenByDate.size === 0
          ? <Card className="p-6 text-center text-[13px] text-[var(--ink-3)]">{tab} hasn’t got any meals yet — book one from What’s on, or add meals when you book.</Card>
          : (
            <>
              <div className="mb-2 text-[12px] text-[var(--ink-3)]"><b className="text-[var(--ink)]">{tab}</b> — {chosenCount} meal{chosenCount === 1 ? "" : "s"}</div>
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
                                <div key={`${it.name}-${i}`} className="rounded-lg border border-[var(--line)] bg-white/70 px-2.5 py-1.5">
                                  <div className="flex flex-wrap items-baseline gap-1.5 text-[12px]">
                                    <span className="text-[#0e9a5a]">✓</span><span className="font-bold">{it.name}</span>
                                    {it.qty > 1 && <span className="text-[var(--ink-3)]">× {it.qty}</span>}
                                    {it.price > 0 && <span className="tabular-nums text-[var(--ink-2)]">{money(it.price)}</span>}
                                    <Allergens list={it.allergens} />
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
            </>
          )
      ) : served.length === 0 ? (
        <Card className="p-6 text-center text-[13px] text-[var(--ink-3)]">No menus to show yet — the day’s menu appears here for listings your provider offers meals on.</Card>
      ) : (
        // ── "What's on": the full menu + book a meal ──
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
                        {(byDate.get(iso) ?? []).map((e) => {
                          const kids = kidsFor(e.listingId);
                          const canBook = e.canOrder && kids.length > 0;
                          return (
                            <div key={e.listingId}>
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                <span className="text-[10.5px] font-bold uppercase tracking-[0.03em] text-[var(--ink-3)]">{e.listingName} · {e.menu.name}</span>
                                {e.canOrder
                                  ? <span className="text-[10px] font-semibold text-[#2f6bd8]">🕒 {e.cutoffLabel}</span>
                                  : <span className="text-[10px] font-semibold text-[var(--ink-3)]">Ordering closed for this day</span>}
                              </div>
                              <div className="mt-1.5 flex flex-col gap-1.5">
                                {e.menu.items.map((it) => {
                                  const open = picking === pickId(e, it);
                                  return (
                                    <div key={it.id} className="overflow-hidden rounded-xl border bg-white transition"
                                      style={open ? { borderColor: "#a9caf7", boxShadow: "0 8px 22px -12px rgba(47,107,216,.5)" } : { borderColor: "var(--line)", boxShadow: "0 1px 2px rgba(16,42,110,.05)" }}>
                                      <div className="flex items-start gap-2 p-2.5">
                                        <span className="grid h-8 w-8 flex-none place-items-center rounded-lg text-[16px]" style={{ background: `${d1}14` }}>🍴</span>
                                        <div className="min-w-0 flex-1">
                                          <div className="text-[13px] font-extrabold leading-tight text-[var(--ink)]">{it.name}</div>
                                          {it.description && <div className="mt-0.5 text-[11px] leading-snug text-[var(--ink-3)]">{it.description}</div>}
                                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                            <span className="rounded-full bg-[#eef4fd] px-2 py-[1.5px] text-[11px] font-extrabold tabular-nums text-[#1d3a8f]">{money(it.price)}</span>
                                            <Allergens list={it.allergens} />
                                          </div>
                                        </div>
                                        {canBook && (
                                          <button type="button" onClick={() => startPick(e, it)}
                                            className="flex flex-none items-center gap-1 rounded-full px-3 py-1.5 text-[11.5px] font-extrabold transition active:scale-[.96]"
                                            style={open ? { background: "#eef2fb", color: "#2f6bd8", border: "1px solid #cfe0fb" } : { background: "linear-gradient(135deg,#5b9bff,#2f6bd8)", color: "#fff", boxShadow: "0 5px 14px -4px rgba(47,107,216,.6)" }}>
                                            {open ? "✕ Close" : "🍽️ Book"}
                                          </button>
                                        )}
                                      </div>
                                      {open && (
                                        <div className="border-t border-[#e6eefb] bg-gradient-to-b from-[#f4f8ff] to-white p-2.5">
                                          <div className="mb-1.5 text-[11px] font-bold text-[#12306e]">Who’s this meal for?</div>
                                          <div className="flex flex-wrap gap-1.5">
                                            {kids.map((k) => {
                                              const already = orderedKey.has(`${e.date}|${k}|${it.id}`);
                                              const sel = pickKid === k;
                                              return (
                                                <button key={k} type="button" disabled={already || busy} onClick={() => { setPickKid(k); setPickErr(null); }}
                                                  className="rounded-full px-2.5 py-1 text-[11.5px] font-extrabold transition disabled:cursor-not-allowed"
                                                  style={already ? { background: "#effaf3", color: "#0e7a45", border: "1px solid #bde5cd" } : sel ? { background: "linear-gradient(180deg,#4f8bf5,#2f6bd8)", color: "#fff", boxShadow: "0 3px 9px -3px rgba(47,107,216,.55)" } : { background: "#fff", color: "var(--ink-2)", border: "1px solid var(--line)" }}>
                                                  {already ? `✓ ${k} · booked` : `🎒 ${k}`}
                                                </button>
                                              );
                                            })}
                                          </div>
                                          {pickErr && <div className="mt-1.5 text-[11px] font-semibold text-[var(--red,#e21d27)]">{pickErr}</div>}
                                          <button type="button" disabled={busy || !pickKid} onClick={() => book(e, it)}
                                            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-[12.5px] font-extrabold text-white transition active:scale-[.99] disabled:opacity-50"
                                            style={{ background: "linear-gradient(135deg,#22c07a,#0e9a5a)", boxShadow: "0 6px 16px -5px rgba(14,154,90,.6)" }}>
                                            {busy ? "Booking…" : <>💳 Pay {money(it.price)} &amp; book</>}
                                          </button>
                                          <div className="mt-1 text-center text-[10px] text-[var(--ink-3)]">Charged to your account like your booking · auto-confirmed while the window is open.</div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
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
      )}
    </div>
  );
}
