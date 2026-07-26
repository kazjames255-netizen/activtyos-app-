"use client";

import { useCallback, useEffect, useState } from "react";
import { get as apiGet, post as apiPost } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { Badge, Button, Card, FieldLabel, Input, Select } from "@/components/ui";

interface Provider { tenantId: string; name: string }
interface Child { id: string; name: string; sex?: string }
interface Booking { childId?: string; childName?: string; tenantId?: string; dates?: string[] }
interface Med { id: string; tenantId?: string; childId?: string; childName: string; name: string; dose: string; route?: string; condition?: string; schedule?: string; asNeeded?: boolean; archived?: boolean; consentGranted?: boolean; source?: string }
interface Dose { id: string; medicationId?: string; date?: string; time?: string; doseGiven?: string; administeredByName?: string; notes?: string }

const when = (d?: string, t?: string) => (d ? new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }) + (t ? ` · ${t}` : "") : "");
const fmtDay = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
type Freq = "everyday" | "chosen" | "asneeded";

// Blue for a boy, pink for a girl (matches the manual), neutral otherwise.
function genderStyle(sex?: string): { bg: string; fg: string; ring: string } {
  const s = (sex ?? "").trim().toLowerCase();
  if (s.startsWith("boy") || s === "male" || s === "m") return { bg: "#eaf0fc", fg: "#1d3a8f", ring: "#3f78d8" };
  if (s.startsWith("girl") || s === "female" || s === "f") return { bg: "#fdeaf1", fg: "#c01858", ring: "#EE1F63" };
  return { bg: "var(--panel)", fg: "var(--ink-2)", ring: "#8a86a3" };
}

export function ParentMedicationApp() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [meds, setMeds] = useState<Med[] | null>(null);
  const [doses, setDoses] = useState<Dose[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [openMed, setOpenMed] = useState<string | null>(null);
  const [f, setF] = useState({ tenantId: "", name: "", dose: "", condition: "", storage: "", notes: "", consent: false });
  const set = (patch: Partial<typeof f>) => setF((p) => ({ ...p, ...patch }));
  const [childIds, setChildIds] = useState<string[]>([]);
  const [freq, setFreq] = useState<Freq>("everyday");
  const [dates, setDates] = useState<string[]>([]);
  const [todayStr] = useState(() => new Date().toISOString().slice(0, 10));

  const load = useCallback(() => {
    apiGet<Med[]>("/api/medications").then(setMeds).catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
    apiGet<Dose[]>("/api/medications/administrations").then(setDoses).catch(() => {});
    // Booked days feed the "days I pick" list — refreshed on the realtime hook
    // below so a new booking appears here without a reload.
    apiGet<Booking[]>("/api/my/bookings").then(setBookings).catch(() => {});
  }, []);
  useEffect(() => {
    load();
    apiGet<Provider[]>("/api/my/providers").then((ps) => { setProviders(ps); if (ps[0]) setF((p) => ({ ...p, tenantId: ps[0].tenantId })); }).catch(() => {});
    apiGet<Child[]>("/api/my/children").then((cs) => { setChildren(cs); if (cs[0]) setChildIds([cs[0].id]); }).catch(() => {});
  }, [load]);
  useRealtime(["children", "bookings"], load);

  const providerName = (id: string) => providers.find((p) => p.tenantId === id)?.name ?? "your provider";
  const dosesFor = (medId: string) => doses.filter((d) => d.medicationId === medId);
  // The distinct booked session days for the picked children at the chosen provider.
  const bookedDays = [...new Set(
    bookings
      .filter((b) => b.tenantId === f.tenantId && (childIds.length === 0 || childIds.includes(b.childId ?? "")))
      .flatMap((b) => b.dates ?? []),
  )].filter((d) => d >= todayStr).sort();
  const selectedNames = childIds.map((id) => children.find((c) => c.id === id)?.name).filter(Boolean).join(" & ") || "your child";

  const toggleChild = (id: string) => setChildIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const toggleDay = (d: string) => setDates((s) => (s.includes(d) ? s.filter((x) => x !== d) : [...s, d].sort()));

  async function authorise() {
    if (!f.tenantId || childIds.length === 0) { setError("Choose a provider and at least one child."); return; }
    if (!f.name.trim() || !f.dose.trim()) { setError("The medicine name and dose are required."); return; }
    if (freq === "chosen" && dates.length === 0) { setError("Tick the days the medicine is needed, or pick a different option."); return; }
    if (!f.consent) { setError("Please tick the consent box to authorise staff to administer."); return; }
    const schedule = freq === "everyday" ? "Every day my child is at camp"
      : freq === "chosen" ? `On these days: ${dates.map(fmtDay).join(", ")}`
      : "Only when needed";
    setError(null); setOk(null);
    try {
      for (const cid of childIds) {
        const child = children.find((c) => c.id === cid);
        await apiPost("/api/medications/authorise", {
          tenantId: f.tenantId, childId: cid, childName: child?.name ?? "Child",
          name: f.name, dose: f.dose, condition: f.condition || undefined,
          schedule, asNeeded: freq === "asneeded", storage: f.storage || undefined,
          notes: f.notes || undefined,
        });
      }
      setF((p) => ({ ...p, name: "", dose: "", condition: "", storage: "", notes: "", consent: false }));
      setFreq("everyday"); setDates([]);
      setOpen(false); setOk(`Medication authorised for ${childIds.length > 1 ? `${childIds.length} children` : selectedNames} — staff can now administer it.`); load();
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t authorise"); }
  }
  async function withdraw(m: Med) {
    if (!confirm(`Withdraw consent for ${m.name}? Staff won’t be able to give it after this.`)) return;
    try { await apiPost(`/api/medications/${encodeURIComponent(m.id)}/withdraw`, {}); load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
  }

  return (
    <div className="text-[var(--ink)]">
      <style>{`@keyframes medGlow{0%,100%{box-shadow:0 0 0 0 color-mix(in srgb,var(--glow,#1d3a8f) 55%,transparent)}50%{box-shadow:0 0 0 6px color-mix(in srgb,var(--glow,#1d3a8f) 0%,transparent)}}.med-flicker{animation:medGlow 1.7s ease-in-out infinite}@media (prefers-reduced-motion:reduce){.med-flicker{animation:none}}`}</style>
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>Medication</h2>
        {providers.length > 0 && children.length > 0 && !open && <Button variant="solid" onClick={() => setOpen(true)}>＋ Authorise a medication</Button>}
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
          </div>

          {/* Child picker — tick one or both; coloured by gender (blue boy / pink girl). */}
          <div className="mt-3">
            <FieldLabel>Which {children.length > 1 ? "children" : "child"}?</FieldLabel>
            <div className="mt-1 flex flex-wrap gap-2">
              {children.map((c) => {
                const on = childIds.includes(c.id);
                const g = genderStyle(c.sex);
                return (
                  <button key={c.id} type="button" onClick={() => toggleChild(c.id)}
                    className={`flex items-center gap-2 rounded-full border-2 px-3 py-1.5 text-[13px] font-extrabold transition-colors ${on ? "med-flicker" : ""}`}
                    style={on ? { borderColor: g.ring, background: g.ring, color: "#fff", ["--glow" as string]: g.ring } : { borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink-3)" }}>
                    <span className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-extrabold" style={on ? { background: "#fff", color: g.ring } : { background: "var(--ink-3)", color: "#fff" }}>{on ? "✓" : (c.name[0] ?? "?")}</span>
                    {c.name}
                  </button>
                );
              })}
            </div>
            {childIds.length > 1 && <p className="mt-1.5 text-[12px] font-bold text-[#1d3a8f]">You&rsquo;re authorising this for both children.</p>}
          </div>

          <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
            <div><FieldLabel>Medicine</FieldLabel><Input value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Salbutamol inhaler" className="w-full" /></div>
            <div><FieldLabel>Dose</FieldLabel><Input value={f.dose} onChange={(e) => set({ dose: e.target.value })} placeholder="e.g. 2 puffs" className="w-full" /></div>
            <div><FieldLabel>For (condition)</FieldLabel><Input value={f.condition} onChange={(e) => set({ condition: e.target.value })} placeholder="e.g. asthma" className="w-full" /></div>
            <div><FieldLabel>Where it&rsquo;s kept</FieldLabel><Input value={f.storage} onChange={(e) => set({ storage: e.target.value })} placeholder="e.g. in their bag" className="w-full" /></div>
          </div>

          {/* When to give — plain-English options. */}
          <div className="mt-3">
            <FieldLabel>When should staff give it?</FieldLabel>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {([["everyday", "🏕️ Every day at camp"], ["chosen", "📅 Only on the days I pick"], ["asneeded", "🩹 Only when needed"]] as [Freq, string][]).map(([id, label]) => (
                <button key={id} type="button" onClick={() => setFreq(id)} className="rounded-full border px-3 py-1.5 text-[12px] font-bold transition-colors"
                  style={freq === id ? { borderColor: "#1d3a8f", background: "#1d3a8f", color: "#fff" } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>{label}</button>
              ))}
            </div>
            {freq === "everyday" && <p className="mt-1.5 text-[11.5px] text-[var(--ink-3)]">Staff will give it each day your child attends.</p>}
            {freq === "asneeded" && <p className="mt-1.5 text-[11.5px] text-[var(--ink-3)]">Staff will give it only if your child needs it (e.g. a flare-up) — never routinely.</p>}
            {freq === "chosen" && (
              <div className="mt-2">
                {bookedDays.length === 0 ? (
                  <p className="text-[11.5px] text-[var(--ink-3)]">No booked days yet with {providerName(f.tenantId)} — book a session first and the days appear here.</p>
                ) : (
                  <>
                    <div className="flex flex-wrap gap-1.5">
                      {bookedDays.map((d) => {
                        const on = dates.includes(d);
                        return <button key={d} type="button" onClick={() => toggleDay(d)} className="rounded-full border px-2.5 py-1 text-[11.5px] font-bold transition-colors"
                          style={on ? { borderColor: "#1d3a8f", background: "#1d3a8f", color: "#fff" } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>{on ? "✓ " : ""}{fmtDay(d)}</button>;
                      })}
                    </div>
                    <p className="mt-1 text-[11px] text-[var(--ink-3)]">The days {childIds.length > 1 ? "your children are" : "your child is"} booked in — tick the ones the medicine is needed.</p>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="mt-3"><FieldLabel>Instructions for staff</FieldLabel><Input value={f.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="e.g. dab on affected area; wash hands after" className="w-full" /></div>
          <label className="mt-3 flex items-start gap-2 rounded-lg border border-[var(--line)] bg-[var(--panel)] p-2.5 text-[12.5px]"><input type="checkbox" checked={f.consent} onChange={(e) => set({ consent: e.target.checked })} className="mt-0.5" /><span>I, the parent/carer of <b>{selectedNames}</b>, give <b>{providerName(f.tenantId)}</b> permission to administer the medication above as described.</span></label>
          <div className="mt-3 flex gap-2"><Button variant="solid" onClick={authorise}>Authorise</Button><Button onClick={() => setOpen(false)}>Cancel</Button></div>
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
