"use client";

import { useCallback, useEffect, useState } from "react";
import { get as apiGet, post as apiPost } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { money } from "@/features/bookings/helpers";
import { Badge, Button, Card } from "@/components/ui";

// ─────────────────────────────────────────────────────────────────────────
// Parent Meals — order from the day's menu. Meals are scheduled per listing
// per day by the provider (the meal planner); here a family orders a meal for
// a child on a booked day and pays the provider. Meat/veg are just separate
// items on the day's menu. Prices are server-computed (see /api/meal-orders).
// ─────────────────────────────────────────────────────────────────────────

interface MenuItem { id: string; name: string; price: number; allergens?: string[]; description?: string }
interface MealDay { tenantId: string; tenantName: string; listingId: string; listingName: string; date: string; children: string[]; menu: { id: string; name: string; items: MenuItem[] } }
interface OrderItem { name: string; qty: number; lineTotal: number }
interface Order { id: string; tenantId: string; listingId?: string; childName: string; date: string; items: OrderItem[]; total: number; status: string; pay: string }

const fmtDay = (iso: string) => (iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" }) : "");

export function ParentMealsApp() {
  const [days, setDays] = useState<MealDay[] | null>(null);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  // Per-card state: which child the meal is for, and the item quantities.
  const [pick, setPick] = useState<Record<string, { child: string; qty: Record<string, number> }>>({});

  const load = useCallback(() => {
    apiGet<MealDay[]>("/api/my/meal-days").then(setDays).catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
    apiGet<Order[]>("/api/meal-orders").then(setOrders).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);
  useRealtime(["mealOrders", "listings", "bookings"], load);

  const keyOf = (d: MealDay) => `${d.listingId}__${d.date}`;
  const stateFor = (d: MealDay) => pick[keyOf(d)] ?? { child: d.children[0] ?? "", qty: {} };
  const setChild = (d: MealDay, child: string) => setPick((p) => ({ ...p, [keyOf(d)]: { ...stateFor(d), child } }));
  const bump = (d: MealDay, itemId: string, by: number) => setPick((p) => {
    const s = stateFor(d); const n = Math.max(0, (s.qty[itemId] ?? 0) + by);
    const qty = { ...s.qty }; if (n === 0) delete qty[itemId]; else qty[itemId] = n;
    return { ...p, [keyOf(d)]: { ...s, qty } };
  });

  const live = (orders ?? []).filter((o) => o.status !== "cancelled");
  const orderedFor = (d: MealDay, child: string) => live.find((o) => o.listingId === d.listingId && o.date === d.date && o.childName === child);

  async function place(d: MealDay) {
    const s = stateFor(d);
    if (!s.child) { setError("Pick which child the meal is for."); return; }
    const items = Object.entries(s.qty).filter(([, q]) => q > 0).map(([menuItemId, qty]) => ({ menuItemId, qty }));
    if (items.length === 0) { setError("Choose a meal first."); return; }
    setError(null); setOk(null);
    try {
      await apiPost("/api/meal-orders", { tenantId: d.tenantId, listingId: d.listingId, date: d.date, childName: s.child, items });
      setPick((p) => ({ ...p, [keyOf(d)]: { child: s.child, qty: {} } }));
      setOk(`Meal ordered for ${s.child} — pay ${d.tenantName} at drop-off.`);
      load();
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t place the order"); }
  }
  async function cancel(o: Order) { if (!confirm("Cancel this meal order?")) return; try { await apiPost(`/api/meal-orders/${encodeURIComponent(o.id)}/cancel`, {}); load(); } catch (e) { setError(e instanceof Error ? e.message : "Failed"); } }

  return (
    <div className="text-[var(--ink)]">
      <div className="relative mb-3.5 overflow-hidden rounded-2xl p-5 text-white shadow-[0_10px_30px_-12px_rgba(29,58,143,.55)]" style={{ background: "linear-gradient(120deg,#1d3a8f 0%,#3f78d8 62%,#ffffff 100%)" }}>
        <div className="flex items-center gap-2 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-[17px]">🍽️</span>Meals
        </div>
        <p className="mt-1.5 max-w-[560px] text-[12.5px] leading-[1.5] text-white/85">Order a meal for your child on the days they’re booked — allergens are shown on every item. You pay the provider at drop-off.</p>
      </div>
      {error && <div className="mb-3 rounded-lg border border-[var(--red-line,#f6c9cc)] bg-[var(--red-soft,#fdebec)] px-3 py-2 text-[12.5px] text-[var(--red,#e21d27)]">{error}</div>}
      {ok && <div className="mb-3 rounded-lg border border-[var(--line)] bg-[#eaf0fc] px-3 py-2 text-[12.5px] text-[#1d3a8f]">{ok}</div>}

      {!days ? <div className="py-6 text-center text-[12px] text-[var(--ink-3)]">Loading…</div>
      : days.length === 0 ? (
        <Card className="p-6 text-center text-[13px] text-[var(--ink-3)]">No meals to order yet — they’ll appear here on the days your provider offers meals for a camp you’ve booked.</Card>
      ) : (
        <div className="flex flex-col gap-3">
          {days.map((d) => {
            const s = stateFor(d);
            const total = d.menu.items.reduce((sum, it) => sum + it.price * (s.qty[it.id] ?? 0), 0);
            const existing = orderedFor(d, s.child);
            return (
              <Card key={keyOf(d)} className="p-3.5">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-[14px] font-extrabold">{fmtDay(d.date)}</span>
                  <span className="text-[12px] text-[var(--ink-3)]">{d.listingName} · {d.tenantName}</span>
                  <span className="ml-auto rounded-full bg-[#eef4fd] px-2 py-[2px] text-[11px] font-bold text-[#1d3a8f]">{d.menu.name}</span>
                </div>

                {d.children.length > 1 && (
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-bold text-[var(--ink-3)]">For</span>
                    {d.children.map((c) => (
                      <button key={c} type="button" onClick={() => setChild(d, c)} className="rounded-full border px-2.5 py-1 text-[12px] font-bold"
                        style={s.child === c ? { borderColor: "#2f6bd8", background: "#eef4fd", color: "#1d3a8f" } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>
                        {s.child === c ? "✓ " : ""}{c}
                      </button>
                    ))}
                  </div>
                )}

                {existing ? (
                  <div className="mt-2.5 flex flex-wrap items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2.5 py-2">
                    <span className="text-[12.5px] font-bold">{d.children.length > 1 ? `${s.child}: ` : ""}Ordered</span>
                    <span className="text-[12px] text-[var(--ink-2)]">{existing.items.map((it) => `${it.qty}× ${it.name}`).join(", ")}</span>
                    {existing.pay === "Paid" ? <Badge tone={{ bg: "#eaf0fc", fg: "#1d3a8f" }}>paid</Badge> : <Badge tone={{ bg: "#fdf3d8", fg: "#9a5a00" }}>pay at drop-off</Badge>}
                    <span className="ml-auto text-[13px] font-extrabold tabular-nums">{money(existing.total)}</span>
                    {existing.pay !== "Paid" && <Button sm variant="danger" onClick={() => cancel(existing)}>Cancel</Button>}
                  </div>
                ) : (
                  <>
                    <div className="mt-2.5 flex flex-col gap-1.5">
                      {d.menu.items.map((it) => (
                        <div key={it.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2.5 py-1.5">
                          <span className="text-[13px] font-bold">{it.name}</span>
                          <span className="text-[12.5px] tabular-nums">{money(it.price)}</span>
                          {(it.allergens?.length ?? 0) > 0 && <span className="rounded-full bg-[var(--red-soft,#fdebec)] px-1.5 py-[1px] text-[10px] font-bold capitalize text-[var(--red,#e21d27)]">⚠ {it.allergens!.join(", ")}</span>}
                          {it.description && <span className="min-w-0 flex-1 truncate text-[11px] text-[var(--ink-3)]">{it.description}</span>}
                          <div className="ml-auto flex items-center gap-1.5">
                            <Button sm onClick={() => bump(d, it.id, -1)} aria-label="Less">−</Button>
                            <span className="w-5 text-center text-[13px] font-bold tabular-nums">{s.qty[it.id] ?? 0}</span>
                            <Button sm onClick={() => bump(d, it.id, 1)} aria-label="More">＋</Button>
                          </div>
                        </div>
                      ))}
                    </div>
                    {total > 0 && (
                      <div className="mt-3 flex items-center gap-3 border-t border-[var(--line)] pt-3">
                        <span className="text-[13px] font-extrabold">Total {money(total)}</span>
                        <Button variant="primary" className="ml-auto" onClick={() => place(d)}>Order {d.children.length > 1 ? `for ${s.child}` : "meal"}</Button>
                      </div>
                    )}
                  </>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <div className="mb-1.5 mt-5 text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">All your meal orders</div>
      {!orders ? <div className="py-6 text-center text-[12px] text-[var(--ink-3)]">Loading…</div>
      : live.length === 0 ? <Card className="p-5 text-center text-[12.5px] text-[var(--ink-3)]">No orders yet.</Card>
      : (
        <div className="flex flex-col gap-1.5">
          {live.map((o) => (
            <Card key={o.id} className="p-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[13px] font-bold">{o.childName}</span>
                <span className="text-[11.5px] text-[var(--ink-3)]">{fmtDay(o.date)}</span>
                {o.pay === "Paid" ? <Badge tone={{ bg: "#eaf0fc", fg: "#1d3a8f" }}>paid</Badge> : <Badge tone={{ bg: "#fdf3d8", fg: "#9a5a00" }}>to pay at drop-off</Badge>}
                <span className="ml-auto text-[13px] font-extrabold tabular-nums">{money(o.total)}</span>
              </div>
              <div className="mt-1 text-[11.5px] text-[var(--ink-2)]">{o.items.map((it) => `${it.qty}× ${it.name}`).join(", ")}</div>
              {o.pay !== "Paid" && <div className="mt-1.5"><Button sm variant="danger" onClick={() => cancel(o)}>Cancel order</Button></div>}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
