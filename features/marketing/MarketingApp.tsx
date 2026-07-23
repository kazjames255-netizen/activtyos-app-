"use client";

import { useCallback, useEffect, useState } from "react";
import { api, get as apiGet, post as apiPost } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { money } from "@/features/bookings/helpers";
import { Badge, Button, Card, FieldLabel, Input, Select } from "@/components/ui";

interface Code {
  id: string;
  code: string;
  type: "percent" | "amount";
  value: number;
  minSpend?: number;
  expiry?: string;
  usageLimit?: number;
  usedCount?: number;
  active?: boolean;
}
const fmt = (iso?: string) => (iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "");
const todayIso = () => new Date().toISOString().slice(0, 10);
const isExpired = (c: Code) => !!c.expiry && c.expiry < todayIso();
const isSpent = (c: Code) => c.usageLimit != null && (c.usedCount ?? 0) >= c.usageLimit;

export function MarketingApp() {
  const [codes, setCodes] = useState<Code[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ code: "", type: "percent", value: "", minSpend: "", expiry: "", usageLimit: "" });
  const set = (patch: Partial<typeof f>) => setF((p) => ({ ...p, ...patch }));

  const refresh = useCallback(() => {
    apiGet<Code[]>("/api/discounts").then((c) => { setCodes(c); setError(null); }).catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useRealtime(["discountCodes"], refresh);

  async function add() {
    const value = Number(f.value);
    if (!f.code.trim() || !value || value <= 0) { setError("A code and a positive value are required."); return; }
    if (f.type === "percent" && value > 100) { setError("A percentage can’t exceed 100."); return; }
    try {
      await apiPost("/api/discounts", {
        code: f.code, type: f.type, value,
        minSpend: f.minSpend ? Number(f.minSpend) : undefined,
        expiry: f.expiry || undefined,
        usageLimit: f.usageLimit ? Number(f.usageLimit) : undefined,
      });
      setF({ code: "", type: "percent", value: "", minSpend: "", expiry: "", usageLimit: "" }); setOpen(false); refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t save"); }
  }
  async function toggle(c: Code) { try { await api(`/api/discounts/${encodeURIComponent(c.id)}`, { method: "PUT", body: JSON.stringify({ active: !(c.active !== false) }) }); refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Failed"); } }
  async function remove(c: Code) { if (!confirm(`Delete code ${c.code}?`)) return; try { await api(`/api/discounts/${encodeURIComponent(c.id)}`, { method: "DELETE" }); refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Failed"); } }

  const valueLabel = (c: Code) => (c.type === "percent" ? `${c.value}% off` : `${money(c.value)} off`);
  const statusBadge = (c: Code) => {
    if (c.active === false) return <Badge tone={{ bg: "var(--panel)", fg: "var(--ink-3)" }}>paused</Badge>;
    if (isExpired(c)) return <Badge tone={{ bg: "var(--red-soft,#fdebec)", fg: "var(--red,#e21d27)" }}>expired</Badge>;
    if (isSpent(c)) return <Badge tone={{ bg: "var(--red-soft,#fdebec)", fg: "var(--red,#e21d27)" }}>used up</Badge>;
    return <Badge tone={{ bg: "var(--green-soft,#e7f8ee)", fg: "#0f7a44" }}>active</Badge>;
  };

  return (
    <div className="text-[var(--ink)]">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>Discount codes</h2>
        {!open && <Button variant="primary" onClick={() => setOpen(true)}>＋ New discount code</Button>}
      </div>
      <p className="mb-4 text-[12.5px] text-[var(--ink-3)]">Discount codes families enter at checkout — percentage or fixed amount, with optional limits.</p>
      {error && <div className="mb-3 rounded-lg border border-[var(--red-line,#f6c9cc)] bg-[var(--red-soft,#fdebec)] px-3 py-2 text-[12.5px] text-[var(--red,#e21d27)]">{error}</div>}

      {open && (
        <Card className="mb-3.5 p-4">
          <div className="grid gap-2.5 sm:grid-cols-3">
            <div><FieldLabel>Code</FieldLabel><Input value={f.code} onChange={(e) => set({ code: e.target.value.toUpperCase() })} placeholder="SUMMER25" className="w-full" /></div>
            <div><FieldLabel>Type</FieldLabel><Select value={f.type} onChange={(e) => set({ type: e.target.value })} className="w-full"><option value="percent">Percentage</option><option value="amount">Fixed amount</option></Select></div>
            <div><FieldLabel>{f.type === "percent" ? "Percent off" : "Amount off (£)"}</FieldLabel><Input type="number" min="0" step={f.type === "percent" ? "1" : "0.01"} value={f.value} onChange={(e) => set({ value: e.target.value })} className="w-full" /></div>
            <div><FieldLabel>Min spend (£)</FieldLabel><Input type="number" min="0" step="0.01" value={f.minSpend} onChange={(e) => set({ minSpend: e.target.value })} placeholder="optional" className="w-full" /></div>
            <div><FieldLabel>Expiry</FieldLabel><Input type="date" value={f.expiry} onChange={(e) => set({ expiry: e.target.value })} className="w-full" /></div>
            <div><FieldLabel>Usage limit</FieldLabel><Input type="number" min="1" step="1" value={f.usageLimit} onChange={(e) => set({ usageLimit: e.target.value })} placeholder="unlimited" className="w-full" /></div>
          </div>
          <div className="mt-3 flex gap-2"><Button variant="primary" onClick={add}>Create code</Button><Button onClick={() => setOpen(false)}>Cancel</Button></div>
        </Card>
      )}

      {!codes ? <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">Loading…</div>
      : codes.length === 0 ? <Card className="p-6 text-center text-[13px] text-[var(--ink-3)]">No discount codes yet.</Card>
      : (
        <div className="flex flex-col gap-1.5">
          {codes.map((c) => (
            <Card key={c.id} className="flex flex-wrap items-center gap-2.5 p-2.5">
              <span className="rounded-md border border-dashed border-[var(--line)] bg-[var(--panel)] px-2 py-0.5 font-mono text-[13px] font-bold tracking-wide">{c.code}</span>
              <span className="text-[13px] font-bold">{valueLabel(c)}</span>
              {statusBadge(c)}
              <span className="text-[11.5px] text-[var(--ink-3)]">
                {c.minSpend ? `min ${money(c.minSpend)} · ` : ""}
                {c.usageLimit != null ? `${c.usedCount ?? 0}/${c.usageLimit} used` : `${c.usedCount ?? 0} used`}
                {c.expiry ? ` · expires ${fmt(c.expiry)}` : ""}
              </span>
              <div className="ml-auto flex gap-2">
                <Button sm onClick={() => toggle(c)}>{c.active === false ? "Resume" : "Pause"}</Button>
                <Button sm variant="danger" onClick={() => remove(c)}>Delete</Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
