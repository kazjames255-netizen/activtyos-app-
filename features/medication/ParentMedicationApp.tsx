"use client";

import { useCallback, useEffect, useState } from "react";
import { get as apiGet, post as apiPost } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { Badge, Button, Card, FieldLabel, Input, Select } from "@/components/ui";

interface Provider { tenantId: string; name: string }
interface Child { id: string; name: string }
interface Med { id: string; tenantId?: string; childId?: string; childName: string; name: string; dose: string; route?: string; condition?: string; schedule?: string; asNeeded?: boolean; archived?: boolean; consentGranted?: boolean; source?: string }
interface Dose { id: string; medicationId?: string; date?: string; time?: string; doseGiven?: string; administeredByName?: string; notes?: string }

const when = (d?: string, t?: string) => (d ? new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }) + (t ? ` · ${t}` : "") : "");

export function ParentMedicationApp() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [meds, setMeds] = useState<Med[] | null>(null);
  const [doses, setDoses] = useState<Dose[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [openMed, setOpenMed] = useState<string | null>(null);
  const [f, setF] = useState({ tenantId: "", childId: "", name: "", dose: "", route: "", condition: "", schedule: "", asNeeded: false, storage: "", startDate: "", endDate: "", notes: "", consent: false });
  const set = (patch: Partial<typeof f>) => setF((p) => ({ ...p, ...patch }));

  const load = useCallback(() => {
    apiGet<Med[]>("/api/medications").then(setMeds).catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
    apiGet<Dose[]>("/api/medications/administrations").then(setDoses).catch(() => {});
  }, []);
  useEffect(() => {
    load();
    apiGet<Provider[]>("/api/my/providers").then((ps) => { setProviders(ps); if (ps[0]) setF((p) => ({ ...p, tenantId: p.tenantId || ps[0].tenantId })); }).catch(() => {});
    apiGet<Child[]>("/api/my/children").then((cs) => { setChildren(cs); if (cs[0]) setF((p) => ({ ...p, childId: p.childId || cs[0].id })); }).catch(() => {});
  }, [load]);
  useRealtime(["children"], load);

  async function authorise() {
    if (!f.tenantId || !f.childId) { setError("Choose a provider and a child."); return; }
    if (!f.name.trim() || !f.dose.trim()) { setError("The medicine name and dose are required."); return; }
    if (!f.consent) { setError("Please tick the consent box to authorise staff to administer."); return; }
    const child = children.find((c) => c.id === f.childId);
    setError(null); setOk(null);
    try {
      await apiPost("/api/medications/authorise", {
        tenantId: f.tenantId, childId: f.childId, childName: child?.name ?? "Child",
        name: f.name, dose: f.dose, route: f.route || undefined, condition: f.condition || undefined,
        schedule: f.schedule || undefined, asNeeded: f.asNeeded, storage: f.storage || undefined,
        startDate: f.startDate || undefined, endDate: f.endDate || undefined, notes: f.notes || undefined,
      });
      setF((p) => ({ ...p, name: "", dose: "", route: "", condition: "", schedule: "", asNeeded: false, storage: "", startDate: "", endDate: "", notes: "", consent: false }));
      setOpen(false); setOk("Medication authorised — staff can now administer it."); load();
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t authorise"); }
  }
  async function withdraw(m: Med) {
    if (!confirm(`Withdraw consent for ${m.name}? Staff won’t be able to give it after this.`)) return;
    try { await apiPost(`/api/medications/${encodeURIComponent(m.id)}/withdraw`, {}); load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
  }

  const providerName = (id: string) => providers.find((p) => p.tenantId === id)?.name ?? "Provider";
  const dosesFor = (medId: string) => doses.filter((d) => d.medicationId === medId);

  return (
    <div className="text-[var(--ink)]">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>Medication</h2>
        {providers.length > 0 && children.length > 0 && !open && <Button variant="primary" onClick={() => setOpen(true)}>＋ Authorise a medication</Button>}
      </div>
      <p className="mb-4 text-[12.5px] text-[var(--ink-3)]">Authorise medicines for your child, and see every dose the staff record.</p>
      {error && <div className="mb-3 rounded-lg border border-[var(--red-line,#f6c9cc)] bg-[var(--red-soft,#fdebec)] px-3 py-2 text-[12.5px] text-[var(--red,#e21d27)]">{error}</div>}
      {ok && <div className="mb-3 rounded-lg border border-[var(--line)] bg-[#eaf0fc] px-3 py-2 text-[12.5px] text-[#1d3a8f]">{ok}</div>}

      {children.length === 0 || providers.length === 0 ? (
        <Card className="p-6 text-center text-[13px] text-[var(--ink-3)]">Add a child and book an activity first — then you can authorise medication.</Card>
      ) : open && (
        <Card className="mb-3.5 p-4">
          <div className="mb-2 text-[13.5px] font-extrabold">Authorise a medication</div>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <div><FieldLabel>Provider</FieldLabel><Select value={f.tenantId} onChange={(e) => set({ tenantId: e.target.value })} className="w-full">{providers.map((p) => <option key={p.tenantId} value={p.tenantId}>{p.name}</option>)}</Select></div>
            <div><FieldLabel>Child</FieldLabel><Select value={f.childId} onChange={(e) => set({ childId: e.target.value })} className="w-full">{children.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></div>
            <div><FieldLabel>Medicine</FieldLabel><Input value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Salbutamol inhaler" className="w-full" /></div>
            <div><FieldLabel>Dose</FieldLabel><Input value={f.dose} onChange={(e) => set({ dose: e.target.value })} placeholder="e.g. 2 puffs" className="w-full" /></div>
            <div><FieldLabel>Route</FieldLabel><Input value={f.route} onChange={(e) => set({ route: e.target.value })} placeholder="inhaler / oral / cream" className="w-full" /></div>
            <div><FieldLabel>For (condition)</FieldLabel><Input value={f.condition} onChange={(e) => set({ condition: e.target.value })} placeholder="e.g. asthma" className="w-full" /></div>
            <div><FieldLabel>When</FieldLabel><Input value={f.schedule} onChange={(e) => set({ schedule: e.target.value })} placeholder="e.g. as needed, or 12:00" className="w-full" /></div>
            <div><FieldLabel>Storage</FieldLabel><Input value={f.storage} onChange={(e) => set({ storage: e.target.value })} placeholder="e.g. in their bag" className="w-full" /></div>
            <div><FieldLabel>Start (optional)</FieldLabel><Input type="date" value={f.startDate} onChange={(e) => set({ startDate: e.target.value })} className="w-full" /></div>
            <div><FieldLabel>End (optional)</FieldLabel><Input type="date" value={f.endDate} onChange={(e) => set({ endDate: e.target.value })} className="w-full" /></div>
          </div>
          <label className="mt-2 flex items-center gap-2 text-[12.5px] font-bold"><input type="checkbox" checked={f.asNeeded} onChange={(e) => set({ asNeeded: e.target.checked })} />Only as needed (PRN)</label>
          <div className="mt-2"><FieldLabel>Notes for staff</FieldLabel><Input value={f.notes} onChange={(e) => set({ notes: e.target.value })} className="w-full" /></div>
          <label className="mt-3 flex items-start gap-2 rounded-lg border border-[var(--line)] bg-[var(--panel)] p-2.5 text-[12.5px]"><input type="checkbox" checked={f.consent} onChange={(e) => set({ consent: e.target.checked })} className="mt-0.5" /><span>I authorise the provider’s trained staff to administer this medication to my child as described above.</span></label>
          <div className="mt-3 flex gap-2"><Button variant="primary" onClick={authorise}>Authorise</Button><Button onClick={() => setOpen(false)}>Cancel</Button></div>
        </Card>
      )}

      {!meds ? <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">Loading…</div>
      : meds.length === 0 ? <Card className="p-6 text-center text-[13px] text-[var(--ink-3)]">No medications authorised yet.</Card>
      : (
        <div className="flex flex-col gap-2">
          {meds.map((m) => {
            const md = dosesFor(m.id);
            return (
              <Card key={m.id} className="p-3.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13.5px] font-extrabold">{m.name}</span>
                  <span className="text-[12px] text-[var(--ink-2)]">{m.dose}{m.route ? ` · ${m.route}` : ""}</span>
                  {m.asNeeded && <Badge tone={{ bg: "var(--panel)", fg: "var(--ink-2)" }}>as needed</Badge>}
                  {m.consentGranted ? <Badge tone={{ bg: "#eaf0fc", fg: "#1d3a8f" }}>consent given</Badge> : <Badge tone={{ bg: "var(--panel)", fg: "var(--ink-3)" }}>consent withdrawn</Badge>}
                  <span className="ml-auto text-[11.5px] text-[var(--ink-3)]">{m.childName}{m.tenantId ? ` · ${providerName(m.tenantId)}` : ""}{m.condition ? ` · ${m.condition}` : ""}</span>
                </div>
                <div className="mt-1.5 flex gap-2">
                  <Button sm onClick={() => setOpenMed(openMed === m.id ? null : m.id)}>{openMed === m.id ? "Hide doses" : `Doses given (${md.length})`}</Button>
                  {m.consentGranted && <Button sm variant="danger" onClick={() => withdraw(m)}>Withdraw consent</Button>}
                </div>
                {openMed === m.id && (
                  <div className="mt-2 border-t border-[var(--line)] pt-2">
                    {md.length === 0 ? <div className="text-[12px] text-[var(--ink-3)]">No doses recorded yet.</div> : (
                      <div className="flex flex-col gap-1">
                        {md.map((d) => (
                          <div key={d.id} className="flex flex-wrap items-center gap-2 text-[12px]">
                            <span className="font-bold tabular-nums">{when(d.date, d.time)}</span>
                            <span>{d.doseGiven}</span>
                            <span className="text-[var(--ink-3)]">by {d.administeredByName}</span>
                            {d.notes && <span className="text-[var(--ink-3)]">· {d.notes}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
