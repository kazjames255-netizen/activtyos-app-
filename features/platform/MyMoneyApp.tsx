"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Card, FieldLabel, Input, Select, SectionHead } from "@/components/ui";

// Personal income/expenditure scratchpad for Kaz — deliberately NOT wired into
// any tenant, booking, or Stripe data. Browser-only (localStorage): this is a
// quick personal ledger, not a product feature, so it doesn't need a server
// collection, multi-device sync, or anyone else's access.
const KEY = "aos.hq.myMoney.v1";
type Kind = "income" | "expense";
interface Entry { id: string; date: string; desc: string; amount: number; kind: Kind; category: string }

const CATEGORIES: Record<Kind, string[]> = {
  income: ["Salary", "Dividend", "Consulting", "Other income"],
  expense: ["Rent/mortgage", "Bills", "Food", "Travel", "Software/subs", "Other expense"],
};

function load(): Entry[] { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; } }
function save(entries: Entry[]) { try { localStorage.setItem(KEY, JSON.stringify(entries)); } catch { /* ignore */ } }
const money = (n: number) => `£${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const today = () => new Date().toISOString().slice(0, 10);

export function MyMoneyApp() {
  const [entries, setEntries] = useState<Entry[]>([]);
  useEffect(() => setEntries(load()), []);

  const [kind, setKind] = useState<Kind>("income");
  const [date, setDate] = useState(today());
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(CATEGORIES.income[0]);

  const add = () => {
    const n = Number(amount);
    if (!desc.trim() || !n || n <= 0) return;
    const next = [{ id: crypto.randomUUID(), date, desc: desc.trim(), amount: n, kind, category }, ...entries];
    setEntries(next); save(next);
    setDesc(""); setAmount("");
  };
  const remove = (id: string) => { const next = entries.filter((e) => e.id !== id); setEntries(next); save(next); };
  const update = (id: string, patch: Partial<Entry>) => {
    const next = entries.map((e) => (e.id === id ? { ...e, ...patch } : e));
    setEntries(next); save(next);
  };

  const totals = useMemo(() => {
    const income = entries.filter((e) => e.kind === "income").reduce((s, e) => s + e.amount, 0);
    const expense = entries.filter((e) => e.kind === "expense").reduce((s, e) => s + e.amount, 0);
    return { income, expense, net: income - expense };
  }, [entries]);

  return (
    <div className="flex flex-col gap-3.5 p-4">
      <SectionHead>Income &amp; expenditure</SectionHead>
      <p className="-mt-2 text-[12px] text-[var(--ink-3)]">
        Your own personal ledger — kept in this browser only, not linked to any tenant, booking, or payment data.
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--ink-3)]">Income</div>
          <div className="mt-1 text-[22px] font-extrabold text-[#0f6b3a]">{money(totals.income)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--ink-3)]">Expenditure</div>
          <div className="mt-1 text-[22px] font-extrabold text-[#b3261e]">{money(totals.expense)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--ink-3)]">Net</div>
          <div className="mt-1 text-[22px] font-extrabold" style={{ color: totals.net >= 0 ? "#0f6b3a" : "#b3261e" }}>{money(totals.net)}</div>
        </Card>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <FieldLabel htmlFor="mm-kind">Type</FieldLabel>
            <Select id="mm-kind" value={kind} onChange={(e) => { const k = e.target.value as Kind; setKind(k); setCategory(CATEGORIES[k][0]); }}>
              <option value="income">💷 Income</option>
              <option value="expense">🧾 Expense</option>
            </Select>
          </div>
          <div>
            <FieldLabel htmlFor="mm-date">Date</FieldLabel>
            <Input id="mm-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <FieldLabel htmlFor="mm-category">Category</FieldLabel>
            <Select id="mm-category" value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES[kind].map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </div>
          <div>
            <FieldLabel htmlFor="mm-desc">Description</FieldLabel>
            <Input id="mm-desc" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="e.g. September consulting" />
          </div>
          <div>
            <FieldLabel htmlFor="mm-amount">Amount (£)</FieldLabel>
            <Input id="mm-amount" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="0.00" />
          </div>
        </div>
        <Button className="mt-3" onClick={add} disabled={!desc.trim() || !Number(amount)}>+ Add entry</Button>
      </Card>

      <Card className="overflow-hidden p-0">
        {entries.length === 0 ? (
          <div className="p-6 text-center text-[12.5px] text-[var(--ink-3)]">No entries yet — add your first one above.</div>
        ) : (
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-[var(--line)] text-left text-[11px] font-bold uppercase tracking-wide text-[var(--ink-3)]">
                <th className="px-4 py-2.5">Type</th>
                <th className="px-4 py-2.5">Date</th>
                <th className="px-4 py-2.5">Description</th>
                <th className="px-4 py-2.5">Category</th>
                <th className="px-4 py-2.5 text-right">Amount</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-[var(--line)] last:border-b-0">
                  <td className="px-2 py-1.5">
                    <select value={e.kind} onChange={(ev) => { const k = ev.target.value as Kind; update(e.id, { kind: k, category: CATEGORIES[k][0] }); }}
                      className="w-full rounded-md border border-transparent bg-transparent px-1.5 py-1 font-semibold hover:border-[var(--line)] focus:border-[var(--brand)] focus:outline-none">
                      <option value="income">💷 Income</option>
                      <option value="expense">🧾 Expense</option>
                    </select>
                  </td>
                  <td className="px-2 py-1.5">
                    <input type="date" value={e.date} onChange={(ev) => update(e.id, { date: ev.target.value })}
                      className="w-full rounded-md border border-transparent bg-transparent px-1.5 py-1 text-[var(--ink-2)] hover:border-[var(--line)] focus:border-[var(--brand)] focus:outline-none" />
                  </td>
                  <td className="px-2 py-1.5">
                    <input type="text" value={e.desc} onChange={(ev) => update(e.id, { desc: ev.target.value })}
                      className="w-full rounded-md border border-transparent bg-transparent px-1.5 py-1 font-semibold hover:border-[var(--line)] focus:border-[var(--brand)] focus:outline-none" />
                  </td>
                  <td className="px-2 py-1.5">
                    <select value={e.category} onChange={(ev) => update(e.id, { category: ev.target.value })}
                      className="w-full rounded-md border border-transparent bg-transparent px-1.5 py-1 text-[var(--ink-2)] hover:border-[var(--line)] focus:border-[var(--brand)] focus:outline-none">
                      {CATEGORIES[e.kind].includes(e.category) ? null : <option value={e.category}>{e.category}</option>}
                      {CATEGORIES[e.kind].map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <span className="font-bold" style={{ color: e.kind === "income" ? "#0f6b3a" : "#b3261e" }}>{e.kind === "income" ? "+" : "−"}£</span>
                      <input type="number" min="0" step="0.01" value={e.amount} onChange={(ev) => update(e.id, { amount: Number(ev.target.value) || 0 })}
                        className="w-24 rounded-md border border-transparent bg-transparent px-1.5 py-1 text-right font-bold hover:border-[var(--line)] focus:border-[var(--brand)] focus:outline-none"
                        style={{ color: e.kind === "income" ? "#0f6b3a" : "#b3261e" }} />
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button type="button" onClick={() => remove(e.id)} className="text-[11px] font-bold text-[var(--ink-3)] hover:text-[#b3261e]">Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
