"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { api, get as apiGet, post as apiPost } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { money } from "@/features/bookings/helpers";
import { Badge, Button, Card, FieldLabel, Input, Select } from "@/components/ui";

const LIGHT_PALETTE = {
  "--bg": "#f5f8fd", "--surface": "#ffffff", "--panel": "#fbf8fc",
  "--ink": "#171534", "--ink-2": "#4a4763", "--ink-3": "#8a86a3", "--line": "#ece6f1",
} as CSSProperties;

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
  assignedTo?: string;
  assignedName?: string;
}
interface Family { id: string; name?: string; email?: string }
const randomCode = () => "SAVE" + Math.random().toString(36).slice(2, 7).toUpperCase();
// A friendly code from a family's surname + this year, e.g. "KHAN2026".
const codeFromFamily = (name: string) => {
  const surname = (name.trim().split(/\s+/).pop() || "FAM").replace(/[^A-Za-z]/g, "").toUpperCase();
  return `${surname || "FAMILY"}${new Date().getFullYear()}`;
};
const fmt = (iso?: string) => (iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "");
const todayIso = () => new Date().toISOString().slice(0, 10);
const isExpired = (c: Code) => !!c.expiry && c.expiry < todayIso();
const isSpent = (c: Code) => c.usageLimit != null && (c.usedCount ?? 0) >= c.usageLimit;

export function MarketingApp() {
  const [codes, setCodes] = useState<Code[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [families, setFamilies] = useState<Family[]>([]);
  const empty = { code: "", type: "percent", value: "", minSpend: "", expiry: "", usageLimit: "", assignedTo: "", assignedName: "" };
  const [f, setF] = useState(empty);
  const set = (patch: Partial<typeof f>) => setF((p) => ({ ...p, ...patch }));

  const refresh = useCallback(() => {
    apiGet<Code[]>("/api/discounts").then((c) => { setCodes(c); setError(null); }).catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { apiGet<Family[]>("/api/customers").then((cs) => setFamilies(cs.filter((c) => c.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)))).catch(() => {}); }, []);
  useRealtime(["discountCodes"], refresh);

  function openCreate() { setEditId(null); setF(empty); setError(null); setOpen(true); }
  function openEdit(c: Code) {
    setEditId(c.id);
    setF({ code: c.code, type: c.type, value: String(c.value), minSpend: c.minSpend != null ? String(c.minSpend) : "", expiry: c.expiry ?? "", usageLimit: c.usageLimit != null ? String(c.usageLimit) : "", assignedTo: c.assignedTo ?? "", assignedName: c.assignedName ?? "" });
    setError(null); setOpen(true);
  }

  async function save() {
    const value = Number(f.value);
    if (!f.code.trim() || !value || value <= 0) { setError("A code and a positive value are required."); return; }
    if (f.type === "percent" && value > 100) { setError("A percentage can’t exceed 100."); return; }
    const payload = {
      code: f.code, type: f.type, value,
      minSpend: f.minSpend ? Number(f.minSpend) : undefined,
      expiry: f.expiry || undefined,
      usageLimit: f.usageLimit ? Number(f.usageLimit) : undefined,
      assignedTo: f.assignedTo || undefined,
      assignedName: f.assignedName || undefined,
    };
    try {
      if (editId) await api(`/api/discounts/${encodeURIComponent(editId)}`, { method: "PUT", body: JSON.stringify(payload) });
      else await apiPost("/api/discounts", payload);
      setF(empty); setEditId(null); setOpen(false); refresh();
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

  const activeCount = (codes ?? []).filter((c) => c.active !== false && !isExpired(c) && !isSpent(c)).length;
  const totalRedemptions = (codes ?? []).reduce((s, c) => s + (c.usedCount ?? 0), 0);

  return (
    <div className="-m-5 min-h-[calc(100vh-3.5rem)] bg-[var(--bg)] p-5 text-[var(--ink)]" style={LIGHT_PALETTE}>
      {/* Hero */}
      <div className="mb-4 rounded-2xl p-5 text-white shadow-[0_10px_30px_-12px_rgba(29,58,143,.55)]" style={{ background: "linear-gradient(120deg, #1d3a8f 0%, #2f6bd8 55%, #6a4fd0 100%)" }}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-[17px]">％</span>
              Discount codes
            </div>
            <p className="mt-1.5 max-w-[540px] text-[12.5px] leading-[1.5] text-white/85">Codes families type at checkout — a percentage or fixed amount off, with optional min-spend, expiry and usage caps. Redemptions update live.</p>
          </div>
          {!open && (
            <button type="button" onClick={openCreate} className="flex-none rounded-full bg-white px-4 py-2 text-[13px] font-extrabold text-[#1d3a8f] shadow-sm transition-transform hover:-translate-y-px">＋ New code</button>
          )}
        </div>
        {codes && codes.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2.5">
            <div className="rounded-xl bg-white/15 px-4 py-2 backdrop-blur-sm"><div className="text-[20px] font-extrabold leading-none">{activeCount}</div><div className="mt-1 text-[10px] font-bold uppercase tracking-[0.08em] text-white/80">Active</div></div>
            <div className="rounded-xl bg-white/15 px-4 py-2 backdrop-blur-sm"><div className="text-[20px] font-extrabold leading-none">{totalRedemptions}</div><div className="mt-1 text-[10px] font-bold uppercase tracking-[0.08em] text-white/80">Redemptions</div></div>
            <div className="rounded-xl bg-white/15 px-4 py-2 backdrop-blur-sm"><div className="text-[20px] font-extrabold leading-none">{codes.length}</div><div className="mt-1 text-[10px] font-bold uppercase tracking-[0.08em] text-white/80">Total codes</div></div>
          </div>
        )}
      </div>
      {error && <div className="mb-3 rounded-lg border border-[var(--red-line,#f6c9cc)] bg-[var(--red-soft,#fdebec)] px-3 py-2 text-[12.5px] text-[var(--red,#e21d27)]">{error}</div>}

      {open && (
        <Card className="mb-3.5 p-4">
          <div className="mb-3 text-[14px] font-extrabold">{editId ? "Edit discount code" : "New discount code"}</div>
          <div className="grid gap-2.5 sm:grid-cols-3">
            <div>
              <div className="flex items-baseline justify-between"><FieldLabel>Code</FieldLabel><button type="button" onClick={() => set({ code: randomCode() })} className="text-[11px] font-bold text-[var(--brand-2)]">Generate</button></div>
              <Input value={f.code} onChange={(e) => set({ code: e.target.value.toUpperCase() })} placeholder="E.G. SUMMER25" className="w-full uppercase" />
            </div>
            <div><FieldLabel>Type</FieldLabel><Select value={f.type} onChange={(e) => set({ type: e.target.value })} className="w-full"><option value="percent">Percentage</option><option value="amount">Fixed amount</option></Select></div>
            <div><FieldLabel>{f.type === "percent" ? "Percent off" : "Amount off (£)"}</FieldLabel><Input type="number" min="0" step={f.type === "percent" ? "1" : "0.01"} value={f.value} onChange={(e) => set({ value: e.target.value })} className="w-full" /></div>
            <div><FieldLabel>Min spend (£)</FieldLabel><Input type="number" min="0" step="0.01" value={f.minSpend} onChange={(e) => set({ minSpend: e.target.value })} placeholder="optional" className="w-full" /></div>
            <div><FieldLabel>Expiry</FieldLabel><Input type="date" value={f.expiry} onChange={(e) => set({ expiry: e.target.value })} className="w-full" /></div>
            <div><FieldLabel>Usage limit</FieldLabel><Input type="number" min="1" step="1" value={f.usageLimit} onChange={(e) => set({ usageLimit: e.target.value })} placeholder="unlimited" className="w-full" /></div>
          </div>

          {/* Assign to one family — only they can redeem it, and they get a message + email. */}
          <div className="mt-3 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3">
            <FieldLabel>Reserve for one family <span className="font-normal text-[var(--ink-3)]">— optional; they get a message + email</span></FieldLabel>
            <Select
              value={f.assignedTo}
              onChange={(e) => {
                const fam = families.find((x) => x.email === e.target.value);
                if (!fam) { set({ assignedTo: "", assignedName: "" }); return; }
                const name = fam.name || fam.email || "";
                set({ assignedTo: fam.email || "", assignedName: name, code: f.code.trim() ? f.code : codeFromFamily(name) });
              }}
              className="w-full"
            >
              <option value="">Anyone can use it</option>
              {families.map((c) => <option key={c.id} value={c.email}>{c.name || c.email}</option>)}
            </Select>
            {f.assignedTo && <div className="mt-1.5 text-[11.5px] text-[var(--ink-3)]">Only <b className="text-[var(--ink-2)]">{f.assignedName || f.assignedTo}</b> can redeem this — saving it sends them the code by message + email.</div>}
          </div>

          <div className="mt-3 flex gap-2"><Button variant="primary" onClick={save}>{editId ? "Save changes" : "Create code"}</Button><Button onClick={() => { setOpen(false); setEditId(null); }}>Cancel</Button></div>
        </Card>
      )}

      {!codes ? <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">Loading…</div>
      : codes.length === 0 ? <Card className="p-6 text-center text-[13px] text-[var(--ink-3)]">No discount codes yet.</Card>
      : (
        <div className="flex flex-col gap-2.5">
          {codes.map((c) => {
            const live = c.active !== false && !isExpired(c) && !isSpent(c);
            const accent = live ? "#15b364" : c.active === false ? "#8a86a3" : "#e21d27";
            const pct = c.usageLimit != null && c.usageLimit > 0 ? Math.min(100, Math.round(((c.usedCount ?? 0) / c.usageLimit) * 100)) : null;
            return (
              <div key={c.id} className="flex items-stretch overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-[0_1px_3px_rgba(20,30,60,.06)] transition-shadow hover:shadow-[0_8px_24px_-14px_rgba(20,30,60,.4)]">
                <span className="w-1.5 flex-none" style={{ background: accent }} />
                <div className="flex flex-1 flex-wrap items-center gap-3 px-4 py-3">
                  <span className="rounded-lg border border-dashed border-[var(--brand-line,#cdddf7)] bg-[var(--brand-soft,#eaf0fc)] px-2.5 py-1 font-mono text-[14px] font-extrabold tracking-wider text-[var(--brand-strong,#16306e)]">{c.code}</span>
                  <span className="rounded-full bg-[#e7f8ee] px-2.5 py-1 text-[12.5px] font-extrabold text-[#0f7a44]">{valueLabel(c)}</span>
                  {statusBadge(c)}
                  <div className="min-w-[140px] flex-1">
                    <div className="text-[11.5px] text-[var(--ink-3)]">
                      {c.assignedTo ? `🔒 ${c.assignedName || c.assignedTo} only · ` : ""}
                      {c.minSpend ? `min ${money(c.minSpend)} · ` : ""}
                      {c.usageLimit != null ? `${c.usedCount ?? 0}/${c.usageLimit} used` : `${c.usedCount ?? 0} used`}
                      {c.expiry ? ` · expires ${fmt(c.expiry)}` : ""}
                    </div>
                    {pct != null && (
                      <div className="mt-1 h-1.5 w-full max-w-[220px] overflow-hidden rounded-full bg-[var(--panel)]">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: accent }} />
                      </div>
                    )}
                  </div>
                  <div className="ml-auto flex gap-2">
                    <Button sm onClick={() => openEdit(c)}>Edit</Button>
                    <Button sm onClick={() => toggle(c)}>{c.active === false ? "Resume" : "Pause"}</Button>
                    <Button sm variant="danger" onClick={() => remove(c)}>Delete</Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
