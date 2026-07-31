"use client";

import { useCallback, useEffect, useState } from "react";
import { get as apiGet, post as apiPost } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { money } from "@/features/bookings/helpers";
import { Badge, Button, Card, FieldLabel, Input, Select } from "@/components/ui";

interface Provider { tenantId: string; name: string }
interface Option { id: string; name: string; price: number; description?: string }
interface OrderItem { name: string; qty: number; lineTotal: number }
interface Order { id: string; tenantId: string; childName: string; date: string; items: OrderItem[]; total: number; status: string; pay: string }

const todayIso = () => new Date().toISOString().slice(0, 10);
const fmtDay = (iso: string) => (iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }) : "");

export function ParentMealsApp() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [tenantId, setTenantId] = useState("");
  const [options, setOptions] = useState<Option[]>([]);
  const [basket, setBasket] = useState<Record<string, number>>({});
  // A meal order is always for one of the family's own children: registered
  // profiles (linked by childId → allergies/dietary on the operator side)
  // plus any child named on their bookings with this provider who never got
  // a profile. No free-typing — the server enforces the same rule.
  const [children, setChildren] = useState<{ id: string; name: string }[]>([]);
  const [bookedKids, setBookedKids] = useState<{ tenantId?: string; names: string[] }[]>([]);
  const [childId, setChildId] = useState("");
  const [childName, setChildName] = useState("");
  // Default to tomorrow: kitchens take orders ahead (the provider's cut-off —
  // settings.meals.orderCutoffHours — is enforced server-side, and same-day is
  // closed under the default 18h). The date stays editable either way.
  const [date, setDate] = useState(() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); });
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const loadOrders = useCallback(() => { apiGet<Order[]>("/api/meal-orders").then(setOrders).catch(() => {}); }, []);
  useEffect(() => {
    apiGet<Provider[]>("/api/my/providers").then((ps) => { setProviders(ps); if (ps[0]) setTenantId((t) => t || ps[0].tenantId); }).catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
    // An only child is preselected — most families never touch the field.
    apiGet<{ id: string; name: string }[]>("/api/my/children").then((cs) => {
      setChildren(cs);
      if (cs.length === 1) { setChildId(cs[0].id); setChildName((n) => n || cs[0].name); }
    }).catch(() => {});
    apiGet<{ tenantId?: string; child?: string; kids?: { name?: string }[] }[]>("/api/my/bookings")
      .then((bs) => setBookedKids(bs.map((b) => ({ tenantId: b.tenantId, names: [b.child, ...(b.kids ?? []).map((k) => k.name)].filter((n): n is string => !!n?.trim()) }))))
      .catch(() => {});
    loadOrders();
  }, [loadOrders]);
  useEffect(() => {
    if (!tenantId) return;
    apiGet<Option[]>(`/api/meal-options?tenantId=${encodeURIComponent(tenantId)}`).then(setOptions).catch(() => setOptions([]));
  }, [tenantId]);
  useRealtime(["mealOrders", "mealOptions"], () => { loadOrders(); if (tenantId) apiGet<Option[]>(`/api/meal-options?tenantId=${encodeURIComponent(tenantId)}`).then(setOptions).catch(() => {}); });

  const qty = (id: string) => basket[id] ?? 0;
  const bump = (id: string, by: number) => setBasket((b) => { const n = Math.max(0, (b[id] ?? 0) + by); const next = { ...b }; if (n === 0) delete next[id]; else next[id] = n; return next; });
  const total = options.reduce((s, o) => s + o.price * qty(o.id), 0);
  const lines = options.filter((o) => qty(o.id) > 0);

  async function place() {
    if (!tenantId) { setError("Choose a provider."); return; }
    if (!childName.trim()) { setError("Pick which child the meal is for."); return; }
    if (lines.length === 0) { setError("Your basket is empty."); return; }
    setError(null); setOk(null);
    try {
      await apiPost("/api/meal-orders", { tenantId, date, childName, ...(childId ? { childId } : {}), items: lines.map((o) => ({ optionId: o.id, qty: qty(o.id) })) });
      setBasket({}); setOk("Order placed — pay the provider at drop-off."); loadOrders();
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t place the order"); }
  }
  async function cancel(o: Order) { if (!confirm("Cancel this order?")) return; try { await apiPost(`/api/meal-orders/${encodeURIComponent(o.id)}/cancel`, {}); loadOrders(); } catch (e) { setError(e instanceof Error ? e.message : "Failed"); } }
  const providerName = (id: string) => providers.find((p) => p.tenantId === id)?.name ?? "Provider";

  const live = (orders ?? []).filter((o) => o.status !== "cancelled");

  return (
    <div className="text-[var(--ink)]">
      <h2 className="mb-1 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>Meals</h2>
      <p className="mb-4 text-[12.5px] text-[var(--ink-3)]">Order meals from your provider’s menu.</p>
      {error && <div className="mb-3 rounded-lg border border-[var(--red-line,#f6c9cc)] bg-[var(--red-soft,#fdebec)] px-3 py-2 text-[12.5px] text-[var(--red,#e21d27)]">{error}</div>}
      {ok && <div className="mb-3 rounded-lg border border-[var(--line)] bg-[#eaf0fc] px-3 py-2 text-[12.5px] text-[#1d3a8f]">{ok}</div>}

      {providers.length === 0 ? (
        <Card className="p-6 text-center text-[13px] text-[var(--ink-3)]">Book an activity first — then you can order meals from that provider.</Card>
      ) : (
        <Card className="mb-4 p-4">
          <div className="grid gap-2.5 sm:grid-cols-3">
            <div><FieldLabel>Provider</FieldLabel><Select value={tenantId} onChange={(e) => { setTenantId(e.target.value); setBasket({}); }} className="w-full">{providers.map((p) => <option key={p.tenantId} value={p.tenantId}>{p.name}</option>)}</Select></div>
            <div>
              <FieldLabel>Child</FieldLabel>
              {(() => {
                // Profiles first (they carry the record link), then any child
                // booked with this provider who has no profile yet.
                const profileNames = new Set(children.map((c) => c.name.trim().toLowerCase()));
                const bookedOnly = [...new Set(bookedKids.filter((b) => b.tenantId === tenantId).flatMap((b) => b.names))]
                  .filter((n) => !profileNames.has(n.trim().toLowerCase()));
                const chip = (key: string, name: string, on: boolean, pick: () => void) => (
                  <button key={key} type="button" onClick={pick} className="rounded-full border px-2.5 py-1 text-[12px] font-bold" style={on ? { borderColor: "#2f6bd8", background: "#eef4fd", color: "#1d3a8f" } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>{on ? "✓ " : ""}{name}</button>
                );
                if (children.length + bookedOnly.length === 0)
                  return <p className="py-1 text-[12px] text-[var(--ink-3)]">No children on your account yet — add a profile under <b>My children</b> first.</p>;
                return (
                  <div className="flex flex-wrap gap-1.5 py-0.5">
                    {children.map((c) => chip(c.id, c.name, childId === c.id, () => { setChildId(c.id); setChildName(c.name); }))}
                    {bookedOnly.map((n) => chip(`b-${n}`, n, !childId && childName === n, () => { setChildId(""); setChildName(n); }))}
                  </div>
                );
              })()}
            </div>
            <div><FieldLabel>Date</FieldLabel><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full" /></div>
          </div>

          <div className="mt-3">
            {options.length === 0 ? <div className="py-3 text-center text-[12px] text-[var(--ink-3)]">This provider hasn’t put any meals on sale yet.</div> : (
              <div className="flex flex-col gap-1.5">
                {options.map((o) => (
                  <div key={o.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2.5 py-1.5">
                    <span className="text-[13px] font-bold">{o.name}</span>
                    <span className="text-[12.5px] tabular-nums">{money(o.price)}</span>
                    {o.description && <span className="min-w-0 flex-1 truncate text-[11px] text-[var(--ink-3)]">{o.description}</span>}
                    <div className="ml-auto flex items-center gap-1.5">
                      <Button sm onClick={() => bump(o.id, -1)} aria-label="Less">−</Button>
                      <span className="w-5 text-center text-[13px] font-bold tabular-nums">{qty(o.id)}</span>
                      <Button sm onClick={() => bump(o.id, 1)} aria-label="More">＋</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {lines.length > 0 && (
            <div className="mt-3 flex items-center gap-3 border-t border-[var(--line)] pt-3">
              <span className="text-[13px] font-extrabold">Total {money(total)}</span>
              <Button variant="primary" className="ml-auto" onClick={place}>Place order</Button>
            </div>
          )}
        </Card>
      )}

      <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">Your orders</div>
      {!orders ? <div className="py-6 text-center text-[12px] text-[var(--ink-3)]">Loading…</div>
      : live.length === 0 ? <Card className="p-5 text-center text-[12.5px] text-[var(--ink-3)]">No orders yet.</Card>
      : (
        <div className="flex flex-col gap-1.5">
          {live.map((o) => (
            <Card key={o.id} className="p-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[13px] font-bold">{o.childName}</span>
                <span className="text-[11.5px] text-[var(--ink-3)]">{fmtDay(o.date)} · {providerName(o.tenantId)}</span>
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
