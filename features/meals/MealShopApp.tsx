"use client";

import { useCallback, useEffect, useState } from "react";
import { api, get as apiGet, post as apiPost } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { money } from "@/features/bookings/helpers";
import { Badge, Button, Card, FieldLabel, Input } from "@/components/ui";

interface Option { id: string; name: string; price: number; description?: string; allergens?: string[]; active?: boolean }
interface OrderItem { name: string; price: number; qty: number; lineTotal: number }
interface Order { id: string; parentName?: string; parentEmail: string; childName: string; date: string; items: OrderItem[]; total: number; status: string; pay: string }

const fmtDay = (iso: string) => (iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }) : "");

export function MealShopApp({ canManage, onBoard }: { canManage: boolean; onBoard: () => void }) {
  const [options, setOptions] = useState<Option[] | null>(null);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", price: "", description: "" });
  const set = (patch: Partial<typeof f>) => setF((p) => ({ ...p, ...patch }));

  const refresh = useCallback(() => {
    apiGet<Option[]>("/api/meal-options").then(setOptions).catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
    apiGet<Order[]>("/api/meal-orders").then(setOrders).catch(() => {});
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useRealtime(["mealOptions", "mealOrders"], refresh);

  async function addOption() {
    const price = Number(f.price);
    if (!f.name.trim() || price < 0 || Number.isNaN(price)) { setError("A name and a valid price are required."); return; }
    try { await apiPost("/api/meal-options", { name: f.name, price, description: f.description || undefined }); setF({ name: "", price: "", description: "" }); setOpen(false); refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn’t save"); }
  }
  async function toggle(o: Option) { try { await api(`/api/meal-options/${encodeURIComponent(o.id)}`, { method: "PUT", body: JSON.stringify({ active: !(o.active !== false) }) }); refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Failed"); } }
  async function removeOption(o: Option) { if (!confirm(`Remove ${o.name} from the menu?`)) return; try { await api(`/api/meal-options/${encodeURIComponent(o.id)}`, { method: "DELETE" }); refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Failed"); } }
  async function markPaid(o: Order) { try { await apiPost(`/api/meal-orders/${encodeURIComponent(o.id)}/pay`, {}); refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Failed"); } }
  async function cancelOrder(o: Order) { if (!confirm("Cancel this order?")) return; try { await apiPost(`/api/meal-orders/${encodeURIComponent(o.id)}/cancel`, {}); refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Failed"); } }

  const live = (orders ?? []).filter((o) => o.status !== "cancelled");
  const owed = live.filter((o) => o.pay !== "Paid").reduce((s, o) => s + o.total, 0);

  return (
    <div className="text-[var(--ink)]">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>Meal shop</h2>
        <Button sm onClick={onBoard}>← Dietary board</Button>
      </div>
      <p className="mb-4 text-[12.5px] text-[var(--ink-3)]">The meals families can order and pay for, and the orders coming in.</p>
      {error && <div className="mb-3 rounded-lg border border-[var(--red-line,#f6c9cc)] bg-[var(--red-soft,#fdebec)] px-3 py-2 text-[12.5px] text-[var(--red,#e21d27)]">{error}</div>}

      {/* Menu for sale */}
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[12px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">Menu for sale</div>
        {canManage && !open && <Button sm variant="primary" onClick={() => setOpen(true)}>＋ Add a meal</Button>}
      </div>
      {open && (
        <Card className="mb-3 p-3.5">
          <div className="grid gap-2.5 sm:grid-cols-3">
            <div className="sm:col-span-2"><FieldLabel>Name</FieldLabel><Input value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="Hot lunch" className="w-full" /></div>
            <div><FieldLabel>Price (£)</FieldLabel><Input type="number" min="0" step="0.01" value={f.price} onChange={(e) => set({ price: e.target.value })} className="w-full" /></div>
          </div>
          <div className="mt-2.5"><FieldLabel>Description</FieldLabel><Input value={f.description} onChange={(e) => set({ description: e.target.value })} className="w-full" /></div>
          <div className="mt-3 flex gap-2"><Button variant="primary" onClick={addOption}>Save</Button><Button onClick={() => setOpen(false)}>Cancel</Button></div>
        </Card>
      )}
      {!options ? <div className="py-6 text-center text-[12px] text-[var(--ink-3)]">Loading…</div>
      : options.length === 0 ? <Card className="mb-4 p-5 text-center text-[12.5px] text-[var(--ink-3)]">No meals on sale yet{canManage ? " — add the first above." : "."}</Card>
      : (
        <div className="mb-5 flex flex-col gap-1.5">
          {options.map((o) => (
            <Card key={o.id} className="flex flex-wrap items-center gap-2 p-2.5">
              <span className="text-[13px] font-bold">{o.name}</span>
              <span className="text-[13px] font-extrabold tabular-nums">{money(o.price)}</span>
              {o.active === false && <Badge tone={{ bg: "var(--panel)", fg: "var(--ink-3)" }}>hidden</Badge>}
              {o.description && <span className="min-w-0 flex-1 truncate text-[11.5px] text-[var(--ink-3)]">{o.description}</span>}
              {canManage && <div className="ml-auto flex gap-2"><Button sm onClick={() => toggle(o)}>{o.active === false ? "Show" : "Hide"}</Button><Button sm variant="danger" onClick={() => removeOption(o)}>Delete</Button></div>}
            </Card>
          ))}
        </div>
      )}

      {/* Orders */}
      <div className="mb-2 flex items-center gap-2">
        <div className="text-[12px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">Orders</div>
        {owed > 0 && <Badge tone={{ bg: "#fdf3d8", fg: "#9a5a00" }}>{money(owed)} to collect</Badge>}
      </div>
      {!orders ? <div className="py-6 text-center text-[12px] text-[var(--ink-3)]">Loading…</div>
      : live.length === 0 ? <Card className="p-5 text-center text-[12.5px] text-[var(--ink-3)]">No orders yet.</Card>
      : (
        <div className="flex flex-col gap-1.5">
          {live.map((o) => (
            <Card key={o.id} className="p-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[13px] font-bold">{o.childName}</span>
                <span className="text-[11.5px] text-[var(--ink-3)]">{fmtDay(o.date)} · {o.parentName || o.parentEmail}</span>
                {o.pay === "Paid" ? <Badge tone={{ bg: "#eaf0fc", fg: "#1d3a8f" }}>paid</Badge> : <Badge tone={{ bg: "#fdf3d8", fg: "#9a5a00" }}>unpaid</Badge>}
                <span className="ml-auto text-[13px] font-extrabold tabular-nums">{money(o.total)}</span>
              </div>
              <div className="mt-1 text-[11.5px] text-[var(--ink-2)]">{o.items.map((it) => `${it.qty}× ${it.name}`).join(", ")}</div>
              {canManage && (
                <div className="mt-1.5 flex gap-2">
                  {o.pay !== "Paid" && <Button sm variant="primary" onClick={() => markPaid(o)}>Mark paid</Button>}
                  <Button sm variant="danger" onClick={() => cancelOrder(o)}>Cancel</Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
