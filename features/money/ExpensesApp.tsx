"use client";

import { useCallback, useEffect, useState } from "react";
import { api, get as apiGet, post as apiPost } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { money } from "@/features/bookings/helpers";
import { Button, Card, FieldLabel, Input, Select } from "@/components/ui";

interface Expense { id: string; date: string; category: string; amount: number; supplier?: string; notes?: string }
interface Payload { items: Expense[]; summary: { total: number; count: number; byCategory: Record<string, number> } }

const CATEGORIES = ["Equipment", "Venue hire", "Staff", "Travel", "Marketing", "Insurance", "Supplies", "Training", "Other"];
const fmtDay = (iso: string) => (iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "");
const todayIso = () => new Date().toISOString().slice(0, 10);

export function ExpensesApp() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(todayIso());
  const [category, setCategory] = useState("Equipment");
  const [amount, setAmount] = useState("");
  const [supplier, setSupplier] = useState("");
  const [notes, setNotes] = useState("");

  const refresh = useCallback(() => {
    apiGet<Payload>("/api/expenses").then((p) => { setData(p); setError(null); }).catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useRealtime(["expenses"], refresh);

  async function add() {
    const amt = Number(amount);
    if (!amt || amt < 0) { setError("Enter a valid amount."); return; }
    try {
      await apiPost("/api/expenses", { date, category, amount: amt, supplier: supplier || undefined, notes: notes || undefined });
      setAmount(""); setSupplier(""); setNotes(""); setOpen(false); refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t save"); }
  }
  async function remove(x: Expense) { if (!confirm("Delete this expense?")) return; try { await api(`/api/expenses/${encodeURIComponent(x.id)}`, { method: "DELETE" }); refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Failed"); } }

  return (
    <div className="text-[var(--ink)]">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>Expenses</h2>
        {!open && <Button variant="primary" onClick={() => setOpen(true)}>＋ Log an expense</Button>}
      </div>
      <p className="mb-4 text-[12.5px] text-[var(--ink-3)]">Your outgoings — what you spent and on what.</p>
      {error && <div className="mb-3 rounded-lg border border-[var(--red-line,#f6c9cc)] bg-[var(--red-soft,#fdebec)] px-3 py-2 text-[12.5px] text-[var(--red,#e21d27)]">{error}</div>}

      {open && (
        <Card className="mb-3.5 p-4">
          <div className="grid gap-2.5 sm:grid-cols-4">
            <div><FieldLabel>Date</FieldLabel><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full" /></div>
            <div><FieldLabel>Category</FieldLabel><Select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full">{CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</Select></div>
            <div><FieldLabel>Amount (£)</FieldLabel><Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full" /></div>
            <div><FieldLabel>Supplier</FieldLabel><Input value={supplier} onChange={(e) => setSupplier(e.target.value)} className="w-full" /></div>
          </div>
          <div className="mt-2.5"><FieldLabel>Notes</FieldLabel><Input value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full" /></div>
          <div className="mt-3 flex gap-2"><Button variant="primary" onClick={add}>Save</Button><Button onClick={() => setOpen(false)}>Cancel</Button></div>
        </Card>
      )}

      {!data ? <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">Loading…</div> : (
        <>
          <div className="mb-3 grid gap-2.5 sm:grid-cols-3">
            <Card className="p-4"><div className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">Total spent</div><div className="mt-1 text-[24px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>{money(data.summary.total)}</div></Card>
            <Card className="p-4 sm:col-span-2">
              <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">By category</div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
                {Object.entries(data.summary.byCategory).sort((a, b) => b[1] - a[1]).map(([c, v]) => <span key={c}><span className="text-[var(--ink-3)]">{c}: </span><span className="font-bold">{money(v)}</span></span>)}
                {data.summary.count === 0 && <span className="text-[var(--ink-3)]">—</span>}
              </div>
            </Card>
          </div>

          {data.items.length === 0 ? <Card className="p-6 text-center text-[13px] text-[var(--ink-3)]">No expenses logged yet.</Card> : (
            <div className="flex flex-col gap-1.5">
              {data.items.map((x) => (
                <Card key={x.id} className="flex flex-wrap items-center gap-2 p-2.5">
                  <span className="w-[110px] shrink-0 text-[11.5px] text-[var(--ink-3)]">{fmtDay(x.date)}</span>
                  <span className="rounded-md bg-[var(--panel)] px-1.5 py-0.5 text-[11px] font-bold text-[var(--ink-2)]">{x.category}</span>
                  <span className="min-w-0 flex-1 truncate text-[12.5px]">{x.supplier || <span className="text-[var(--ink-3)]">—</span>}{x.notes ? <span className="text-[var(--ink-3)]"> · {x.notes}</span> : ""}</span>
                  <span className="text-[13px] font-extrabold tabular-nums">{money(x.amount)}</span>
                  <button type="button" onClick={() => remove(x)} className="text-[var(--ink-3)] hover:text-[var(--red)]" aria-label="Delete">×</button>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
