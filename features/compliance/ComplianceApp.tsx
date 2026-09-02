"use client";

import { useCallback, useEffect, useState } from "react";
import { api, get as apiGet, post as apiPost } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { Badge, Button, Card, FieldLabel, Input, Select } from "@/components/ui";
import { SettingsLink } from "@/components/OperatorPage";

interface Cert { id: string; staffName: string; type: string; reference?: string; issued?: string; expiry: string; notes?: string; status: "expired" | "expiring" | "valid" }
interface Payload { items: Cert[]; summary: { total: number; expired: number; expiring: number; valid: number } }

const TYPES = ["DBS check", "Safeguarding", "Paediatric first aid", "First aid", "Food hygiene", "Public liability insurance", "Other"];
const tone: Record<Cert["status"], { bg: string; fg: string }> = {
  expired: { bg: "var(--red-soft,#fdebec)", fg: "var(--red,#e21d27)" },
  expiring: { bg: "#fdf3d8", fg: "#9a5a00" },
  valid: { bg: "#eaf0fc", fg: "#1d3a8f" },
};
const label: Record<Cert["status"], string> = { expired: "expired", expiring: "expiring soon", valid: "valid" };
const fmt = (iso?: string) => (iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "");

export function ComplianceApp() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ staffName: "", type: "DBS check", reference: "", issued: "", expiry: "", notes: "" });
  const set = (patch: Partial<typeof f>) => setF((p) => ({ ...p, ...patch }));

  const refresh = useCallback(() => {
    apiGet<Payload>("/api/compliance").then((p) => { setData(p); setError(null); }).catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { apiGet<{ role: string }>("/api/me").then((me) => setCanManage(["company", "freelancer", "franchise"].includes(me.role))).catch(() => {}); }, []);
  useRealtime(["certifications"], refresh);

  async function add() {
    if (!f.staffName.trim() || !f.expiry) { setError("Staff name and an expiry date are required."); return; }
    try {
      await apiPost("/api/compliance", { staffName: f.staffName, type: f.type, reference: f.reference || undefined, issued: f.issued || undefined, expiry: f.expiry, notes: f.notes || undefined });
      setF({ staffName: "", type: "DBS check", reference: "", issued: "", expiry: "", notes: "" }); setOpen(false); refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t save"); }
  }
  async function remove(c: Cert) { if (!confirm(`Delete ${c.staffName}’s ${c.type}?`)) return; try { await api(`/api/compliance/${encodeURIComponent(c.id)}`, { method: "DELETE" }); refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Failed"); } }

  return (
    <div className="text-[var(--ink)]">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>Compliance</h2>
        <div className="flex flex-none items-center gap-2">
          <SettingsLink tone="light" />
          {canManage && !open && <Button variant="primary" onClick={() => setOpen(true)}>＋ Add a certificate</Button>}
        </div>
      </div>
      <p className="mb-4 text-[12.5px] text-[var(--ink-3)]">Staff certifications and when they expire — DBS, first aid, safeguarding and insurance.</p>
      {error && <div className="mb-3 rounded-lg border border-[var(--red-line,#f6c9cc)] bg-[var(--red-soft,#fdebec)] px-3 py-2 text-[12.5px] text-[var(--red,#e21d27)]">{error}</div>}

      {open && (
        <Card className="mb-3.5 p-4">
          <div className="grid gap-2.5 sm:grid-cols-3">
            <div><FieldLabel>Staff member</FieldLabel><Input value={f.staffName} onChange={(e) => set({ staffName: e.target.value })} className="w-full" /></div>
            <div><FieldLabel>Type</FieldLabel><Select value={f.type} onChange={(e) => set({ type: e.target.value })} className="w-full">{TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</Select></div>
            <div><FieldLabel>Reference</FieldLabel><Input value={f.reference} onChange={(e) => set({ reference: e.target.value })} className="w-full" /></div>
            <div><FieldLabel>Issued</FieldLabel><Input type="date" value={f.issued} onChange={(e) => set({ issued: e.target.value })} className="w-full" /></div>
            <div><FieldLabel>Expires</FieldLabel><Input type="date" value={f.expiry} onChange={(e) => set({ expiry: e.target.value })} className="w-full" /></div>
          </div>
          <div className="mt-2.5"><FieldLabel>Notes</FieldLabel><Input value={f.notes} onChange={(e) => set({ notes: e.target.value })} className="w-full" /></div>
          <div className="mt-3 flex gap-2"><Button variant="primary" onClick={add}>Save</Button><Button onClick={() => setOpen(false)}>Cancel</Button></div>
        </Card>
      )}

      {!data ? <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">Loading…</div> : (
        <>
          <div className="mb-3 grid grid-cols-2 gap-2.5 md:grid-cols-3">
            <Card className="p-3.5"><div className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">Expired</div><div className="mt-1 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)", color: data.summary.expired ? "var(--red,#e21d27)" : "var(--ink)" }}>{data.summary.expired}</div></Card>
            <Card className="p-3.5"><div className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">Expiring soon</div><div className="mt-1 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)", color: data.summary.expiring ? "#9a5a00" : "var(--ink)" }}>{data.summary.expiring}</div></Card>
            <Card className="p-3.5"><div className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">Valid</div><div className="mt-1 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>{data.summary.valid}</div></Card>
          </div>

          {data.items.length === 0 ? <Card className="p-6 text-center text-[13px] text-[var(--ink-3)]">No certificates tracked yet.</Card> : (
            <div className="flex flex-col gap-1.5">
              {data.items.map((c) => (
                <Card key={c.id} className="flex flex-wrap items-center gap-2 p-2.5">
                  <Badge tone={tone[c.status]}>{label[c.status]}</Badge>
                  <span className="text-[13px] font-bold">{c.staffName}</span>
                  <span className="text-[12px] text-[var(--ink-2)]">{c.type}</span>
                  {c.reference && <span className="text-[11px] text-[var(--ink-3)]">{c.reference}</span>}
                  <span className="ml-auto text-[11.5px] text-[var(--ink-3)]">expires {fmt(c.expiry)}</span>
                  {canManage && <button type="button" onClick={() => remove(c)} className="text-[var(--ink-3)] hover:text-[var(--red)]" aria-label="Delete">×</button>}
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
