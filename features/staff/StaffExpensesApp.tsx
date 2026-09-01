"use client";

// Staff-facing "My expenses" — submit a claim, attach a receipt, and track what's
// been approved and reimbursed. Demo store (localStorage); in production a claim
// posts to the operator's Money-out ledger and is scoped to the logged-in person
// server-side. Demo "me" = Marcus Bell, matching the other staff areas.
import { useEffect, useMemo, useState } from "react";
import { Button, Card, Input, Select } from "@/components/ui";
import { CollapsibleStats, LIGHT_PALETTE, PageHero } from "@/components/OperatorPage";

const ME = "Marcus Bell";
const KEY = "aos.staff.expenses.v1";
const CATS = ["Travel & mileage", "Equipment", "Activity materials", "Food & catering", "Training", "Other"];
type Status = "submitted" | "approved" | "paid" | "declined";
interface Claim { id: string; name: string; date: string; category: string; amount: number; note: string; receipt?: string; receiptName?: string; status: Status; submittedAt: string }

const gbp = (n: number) => "£" + (n || 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const STATUS: Record<Status, { label: string; bg: string; ink: string }> = {
  submitted: { label: "Awaiting approval", bg: "#fff7e6", ink: "#b45309" },
  approved: { label: "Approved", bg: "#eaf4ff", ink: "#1d6fb8" },
  paid: { label: "Reimbursed", bg: "#eafaf0", ink: "#0f7a43" },
  declined: { label: "Declined", bg: "#fdecec", ink: "#c0392b" },
};
const load = (): Claim[] => { try { const v = JSON.parse(localStorage.getItem(KEY) || "[]"); return Array.isArray(v) ? v : []; } catch { return []; } };
const save = (c: Claim[]) => { try { localStorage.setItem(KEY, JSON.stringify(c)); } catch { /* ignore */ } };
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
// Light fill + crisp inset outline so inputs clearly read as "type here" against
// white surfaces (the default --line border nearly vanishes). Focus still shows on top.
const FIELD_STYLE = { backgroundColor: "#f5f3fb", boxShadow: "inset 0 0 0 1.5px #c5bfd6" } as const;

export function StaffExpensesApp() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ date: todayISO(), category: CATS[0], amount: "", note: "", receipt: "", receiptName: "" });
  useEffect(() => { setClaims(load()); }, []);
  const persist = (c: Claim[]) => { setClaims(c); save(c); };

  const mine = useMemo(() => claims.filter((c) => c.name === ME).sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1)), [claims]);
  const sum = (f: (c: Claim) => boolean) => mine.filter(f).reduce((a, c) => a + c.amount, 0);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader(); r.onload = () => setForm((s) => ({ ...s, receipt: String(r.result), receiptName: f.name })); r.readAsDataURL(f);
  };
  const submit = () => {
    const amount = parseFloat(form.amount); if (!amount || amount <= 0) return;
    const c: Claim = { id: "e" + Date.now().toString(36), name: ME, date: form.date, category: form.category, amount, note: form.note.trim(), receipt: form.receipt || undefined, receiptName: form.receiptName || undefined, status: "submitted", submittedAt: new Date().toISOString() };
    persist([c, ...claims]);
    setOpen(false); setForm({ date: todayISO(), category: CATS[0], amount: "", note: "", receipt: "", receiptName: "" });
  };
  const remove = (id: string) => persist(claims.filter((c) => c.id !== id));

  return (
    <div className="-m-3 min-h-[calc(100vh-3.5rem)] p-3 sm:-m-5 sm:p-5" style={LIGHT_PALETTE}>
      <PageHero title="My expenses" icon="💷" lede="Claim back what you've spent for work — attach a receipt and track it through to reimbursement. Approvals go to your manager." actions={<Button variant="primary" onClick={() => setOpen(true)}>+ New claim</Button>} />

      <CollapsibleStats id="staff-expenses">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Claims", String(mine.length), "all time"],
          ["Awaiting", gbp(sum((c) => c.status === "submitted")), "not yet approved"],
          ["Approved", gbp(sum((c) => c.status === "approved")), "awaiting payment"],
          ["Reimbursed", gbp(sum((c) => c.status === "paid")), "paid back to you"],
        ].map(([label, value, sub]) => (
          <div key={label} className="rounded-2xl border border-[var(--line)] bg-white p-4">
            <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--ink-3)]">{label}</div>
            <div className="mt-1 text-[22px] font-extrabold tabular-nums text-[var(--ink)]" style={{ fontFamily: "var(--ff-display)" }}>{value}</div>
            <div className="mt-0.5 text-[11px] text-[var(--ink-3)]">{sub}</div>
          </div>
        ))}
      </div>
      </CollapsibleStats>

      <Card className="mt-4 p-0">
        {mine.length === 0 ? (
          <div className="p-10 text-center text-[13px] text-[var(--ink-3)]">No claims yet. Tap <b>New claim</b> to submit your first expense.</div>
        ) : (
          <ul className="divide-y divide-[var(--line)]">
            {mine.map((c) => { const st = STATUS[c.status]; return (
              <li key={c.id} className="flex items-center gap-3 p-3.5">
                <div className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-[var(--panel)] text-[16px]">🧾</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2"><span className="truncate text-[14px] font-extrabold text-[var(--ink)]">{c.category}</span>
                    <span className="rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ background: st.bg, color: st.ink }}>{st.label}</span></div>
                  <div className="text-[12px] text-[var(--ink-3)]">{new Date(c.date + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}{c.note ? ` · ${c.note}` : ""}{c.receiptName ? ` · 📎 ${c.receiptName}` : ""}</div>
                </div>
                <div className="text-right"><div className="text-[15px] font-extrabold tabular-nums text-[var(--ink)]">{gbp(c.amount)}</div>
                  {c.status === "submitted" && <button type="button" onClick={() => remove(c.id)} className="text-[11px] font-bold text-[var(--ink-3)] hover:text-[#c0392b]">Withdraw</button>}</div>
              </li>
            ); })}
          </ul>
        )}
      </Card>
      <p className="mt-3 text-[11.5px] text-[var(--ink-3)]">Approved claims are paid into your account or added to your next wages, per your employer's policy.</p>

      {open && (
        <div className="fixed inset-0 z-[140] flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-[8vh]" onClick={() => setOpen(false)} style={LIGHT_PALETTE}>
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 text-[16px] font-extrabold text-[var(--ink)]">New expense claim</div>
            <div className="grid gap-3">
              <label className="block"><span className="mb-1 block text-[11px] font-bold uppercase text-[var(--ink-3)]">Date of spend</span><Input type="date" value={form.date} onChange={(e) => setForm((s) => ({ ...s, date: e.target.value }))} className="w-full" style={FIELD_STYLE} /></label>
              <label className="block"><span className="mb-1 block text-[11px] font-bold uppercase text-[var(--ink-3)]">Category</span><Select value={form.category} onChange={(e) => setForm((s) => ({ ...s, category: e.target.value }))} className="w-full" style={FIELD_STYLE}>{CATS.map((c) => <option key={c}>{c}</option>)}</Select></label>
              <label className="block"><span className="mb-1 block text-[11px] font-bold uppercase text-[var(--ink-3)]">Amount (£)</span><Input type="number" inputMode="decimal" step="0.01" min="0" value={form.amount} onChange={(e) => setForm((s) => ({ ...s, amount: e.target.value }))} placeholder="0.00" className="w-full" style={FIELD_STYLE} /></label>
              <label className="block"><span className="mb-1 block text-[11px] font-bold uppercase text-[var(--ink-3)]">What was it for?</span><Input value={form.note} onChange={(e) => setForm((s) => ({ ...s, note: e.target.value }))} placeholder="e.g. craft supplies for holiday club" className="w-full" style={FIELD_STYLE} /></label>
              <label className="cursor-pointer rounded-xl border border-dashed border-[var(--line)] bg-[var(--panel)] p-3 text-center text-[12.5px] font-bold text-[#1d3a8f]">
                {form.receiptName ? `📎 ${form.receiptName}` : "📷 Attach a receipt (optional)"}
                <input type="file" accept="image/*,application/pdf" className="hidden" onChange={onFile} />
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2"><Button onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" onClick={submit} disabled={!(parseFloat(form.amount) > 0)}>Submit claim</Button></div>
          </div>
        </div>
      )}
    </div>
  );
}
