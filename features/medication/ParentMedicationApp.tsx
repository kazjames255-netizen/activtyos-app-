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
const fmtDay = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
type Freq = "everyday" | "chosen" | "asneeded";

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
  const [freq, setFreq] = useState<Freq>("everyday");
  const [dates, setDates] = useState<string[]>([]);
  const [dateInput, setDateInput] = useState("");

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
    if (freq === "chosen" && dates.length === 0) { setError("Tick the days your child is at camp, or pick a different option."); return; }
    const child = children.find((c) => c.id === f.childId);
    // The "when" chooser → the stored schedule + PRN flag the staff see.
    const schedule = freq === "everyday" ? "Every day my child is at camp"
      : freq === "chosen" ? `On these days: ${dates.map(fmtDay).join(", ")}`
      : "Only when needed";
    setError(null); setOk(null);
    try {
      await apiPost("/api/medications/authorise", {
        tenantId: f.tenantId, childId: f.childId, childName: child?.name ?? "Child",
        name: f.name, dose: f.dose, route: f.route || undefined, condition: f.condition || undefined,
        schedule, asNeeded: freq === "asneeded", storage: f.storage || undefined,
        startDate: f.startDate || undefined, endDate: f.endDate || undefined, notes: f.notes || undefined,
      });
      setF((p) => ({ ...p, name: "", dose: "", route: "", condition: "", schedule: "", asNeeded: false, storage: "", startDate: "", endDate: "", notes: "", consent: false }));
      setFreq("everyday"); setDates([]); setDateInput("");
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
            <div><FieldLabel>Storage</FieldLabel><Input value={f.storage} onChange={(e) => set({ storage: e.target.value })} placeholder="e.g. in their bag" className="w-full" /></div>
          </div>

          {/* When to give — plain-English options instead of a free-text box. */}
          <div className="mt-3">
            <FieldLabel>When should staff give it?</FieldLabel>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {([["everyday", "🏕️ Every day my child is at camp"], ["chosen", "📅 Only on the days I pick"], ["asneeded", "🩹 Only when needed"]] as [Freq, string][]).map(([id, label]) => (
                <button key={id} type="button" onClick={() => setFreq(id)} className="rounded-full border px-3 py-1.5 text-[12px] font-bold transition-colors"
                  style={freq === id ? { borderColor: "#1d3a8f", background: "#1d3a8f", color: "#fff" } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>{label}</button>
              ))}
            </div>
            {freq === "everyday" && <p className="mt-1.5 text-[11.5px] text-[var(--ink-3)]">Staff will give it each day your child attends.</p>}
            {freq === "asneeded" && <p className="mt-1.5 text-[11.5px] text-[var(--ink-3)]">Staff will give it only if your child needs it (e.g. a flare-up) — never routinely.</p>}
            {freq === "chosen" && (
              <div className="mt-2">
                <div className="flex flex-wrap items-end gap-2">
                  <Input type="date" value={dateInput} onChange={(e) => setDateInput(e.target.value)} className="w-auto" />
                  <Button sm variant="primary" onClick={() => { if (dateInput && !dates.includes(dateInput)) { setDates([...dates, dateInput].sort()); setDateInput(""); } }}>＋ Add day</Button>
                  <span className="text-[11.5px] text-[var(--ink-3)]">Tick each day your child is at camp.</span>
                </div>
                {dates.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {dates.map((d) => (
                      <span key={d} className="inline-flex items-center gap-1.5 rounded-full bg-[#eaf0fc] px-2.5 py-1 text-[11.5px] font-bold text-[#1d3a8f]">{fmtDay(d)}<button type="button" onClick={() => setDates(dates.filter((x) => x !== d))} aria-label="Remove day" className="text-[#1d3a8f]">✕</button></span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
            <div><FieldLabel>Start (optional)</FieldLabel><Input type="date" value={f.startDate} onChange={(e) => set({ startDate: e.target.value })} className="w-full" /></div>
            <div><FieldLabel>End (optional)</FieldLabel><Input type="date" value={f.endDate} onChange={(e) => set({ endDate: e.target.value })} className="w-full" /></div>
          </div>
          <div className="mt-2.5"><FieldLabel>Notes for staff</FieldLabel><Input value={f.notes} onChange={(e) => set({ notes: e.target.value })} className="w-full" /></div>
          <label className="mt-3 flex items-start gap-2 rounded-lg border border-[var(--line)] bg-[var(--panel)] p-2.5 text-[12.5px]"><input type="checkbox" checked={f.consent} onChange={(e) => set({ consent: e.target.checked })} className="mt-0.5" /><span>I, {children.find((c) => c.id === f.childId)?.name ? <>the parent/carer of <b>{children.find((c) => c.id === f.childId)!.name}</b></> : "the parent/carer"}, give <b>{providerName(f.tenantId)}</b> permission to administer the medication above to my child as described.</span></label>
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
