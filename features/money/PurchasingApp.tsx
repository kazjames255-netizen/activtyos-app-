"use client";

import { useCallback, useEffect, useState } from "react";
import { api, get as apiGet, post as apiPost } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { money } from "@/features/bookings/helpers";
import { Badge, Button, Card, FieldLabel, Input, Select } from "@/components/ui";

interface PO { id: string; supplier: string; reference?: string; date: string; dueDate?: string; amount: number; status: string; notes?: string; overdue?: boolean }
interface Payload { items: PO[]; summary: { count: number; outstanding: number; overdue: number } }

const STATUSES = ["draft", "sent", "received", "paid", "cancelled"];
const fmtDay = (iso?: string) => (iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }) : "");
const todayIso = () => new Date().toISOString().slice(0, 10);

export function PurchasingApp() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ supplier: "", reference: "", date: todayIso(), dueDate: "", amount: "", status: "draft", notes: "" });
  const set = (patch: Partial<typeof f>) => setF((p) => ({ ...p, ...patch }));

  const refresh = useCallback(() => {
    apiGet<Payload>("/api/purchasing").then((p) => { setData(p); setError(null); }).catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useRealtime(["purchaseOrders"], refresh);

  async function add() {
    const amt = Number(f.amount);
    if (!f.supplier.trim() || !amt || amt < 0) { setError("Supplier and a valid amount are required."); return; }
    try {
      await apiPost("/api/purchasing", { supplier: f.supplier, reference: f.reference || undefined, date: f.date, dueDate: f.dueDate || undefined, amount: amt, status: f.status, notes: f.notes || undefined });
      setF({ supplier: "", reference: "", date: todayIso(), dueDate: "", amount: "", status: "draft", notes: "" }); setOpen(false); refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t save"); }
  }
  async function setStatus(po: PO, status: string) { try { await api(`/api/purchasing/${encodeURIComponent(po.id)}`, { method: "PUT", body: JSON.stringify({ status }) }); refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Failed"); } }
  async function remove(po: PO) { if (!confirm(`Delete the order for ${po.supplier}?`)) return; try { await api(`/api/purchasing/${encodeURIComponent(po.id)}`, { method: "DELETE" }); refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Failed"); } }

  return (
    <div className="text-[var(--ink)]">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>Purchasing &amp; invoices</h2>
        {!open && <Button variant="primary" onClick={() => setOpen(true)}>＋ New order</Button>}
      </div>
      <p className="mb-4 text-[12.5px] text-[var(--ink-3)]">Purchase orders and supplier invoices — from draft to paid.</p>
      {error && <div className="mb-3 rounded-lg border border-[var(--red-line,#f6c9cc)] bg-[var(--red-soft,#fdebec)] px-3 py-2 text-[12.5px] text-[var(--red,#e21d27)]">{error}</div>}

      {open && (
        <Card className="mb-3.5 p-4">
          <div className="grid gap-2.5 sm:grid-cols-3">
            <div className="sm:col-span-2"><FieldLabel>Supplier</FieldLabel><Input value={f.supplier} onChange={(e) => set({ supplier: e.target.value })} className="w-full" /></div>
            <div><FieldLabel>Reference</FieldLabel><Input value={f.reference} onChange={(e) => set({ reference: e.target.value })} placeholder="INV-1234" className="w-full" /></div>
            <div><FieldLabel>Date</FieldLabel><Input type="date" value={f.date} onChange={(e) => set({ date: e.target.value })} className="w-full" /></div>
            <div><FieldLabel>Due date</FieldLabel><Input type="date" value={f.dueDate} onChange={(e) => set({ dueDate: e.target.value })} className="w-full" /></div>
            <div><FieldLabel>Amount (£)</FieldLabel><Input type="number" min="0" step="0.01" value={f.amount} onChange={(e) => set({ amount: e.target.value })} className="w-full" /></div>
            <div><FieldLabel>Status</FieldLabel><Select value={f.status} onChange={(e) => set({ status: e.target.value })} className="w-full">{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</Select></div>
          </div>
          <div className="mt-2.5"><FieldLabel>Notes</FieldLabel><Input value={f.notes} onChange={(e) => set({ notes: e.target.value })} className="w-full" /></div>
          <div className="mt-3 flex gap-2"><Button variant="primary" onClick={add}>Save order</Button><Button onClick={() => setOpen(false)}>Cancel</Button></div>
        </Card>
      )}

      {!data ? <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">Loading…</div> : (
        <>
          <div className="mb-3 grid gap-2.5 sm:grid-cols-3">
            <Card className="p-4"><div className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">Outstanding</div><div className="mt-1 text-[24px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>{money(data.summary.outstanding)}</div></Card>
            <Card className="p-4"><div className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">Overdue</div><div className="mt-1 text-[24px] font-extrabold" style={{ fontFamily: "var(--ff-display)", color: data.summary.overdue ? "var(--red,#e21d27)" : "var(--ink)" }}>{data.summary.overdue}</div></Card>
            <Card className="p-4"><div className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">Orders</div><div className="mt-1 text-[24px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>{data.summary.count}</div></Card>
          </div>

          {data.items.length === 0 ? <Card className="p-6 text-center text-[13px] text-[var(--ink-3)]">No orders yet.</Card> : (
            <div className="flex flex-col gap-1.5">
              {data.items.map((po) => (
                <Card key={po.id} className="flex flex-wrap items-center gap-2 p-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[13px] font-bold">{po.supplier}</span>
                      {po.reference && <span className="text-[11px] text-[var(--ink-3)]">{po.reference}</span>}
                      {po.overdue && <Badge tone={{ bg: "var(--red-soft,#fdebec)", fg: "var(--red,#e21d27)" }}>overdue</Badge>}
                    </div>
                    <div className="text-[11px] text-[var(--ink-3)]">{fmtDay(po.date)}{po.dueDate ? ` · due ${fmtDay(po.dueDate)}` : ""}{po.notes ? ` · ${po.notes}` : ""}</div>
                  </div>
                  <span className="text-[13px] font-extrabold tabular-nums">{money(po.amount)}</span>
                  <Select value={po.status} onChange={(e) => setStatus(po, e.target.value)} className="w-[120px]">{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</Select>
                  <button type="button" onClick={() => remove(po)} className="text-[var(--ink-3)] hover:text-[var(--red)]" aria-label="Delete">×</button>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
