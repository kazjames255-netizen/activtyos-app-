"use client";

import { useCallback, useEffect, useState } from "react";
import { api, get as apiGet, post as apiPost } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { Badge, Button, Card, FieldLabel, Input } from "@/components/ui";

// ─────────────────────────────────────────────────────────────────────────
// Medication — authorised medicines (with parental consent) and the MAR
// (every dose given). You can't record a dose against a medication that
// isn't consented — the server enforces it; this UI reflects it. Staff
// administer and record; operators manage the authorisations. Simple by
// design — Kaz can restyle.
// ─────────────────────────────────────────────────────────────────────────

interface Med {
  id: string;
  childName: string;
  childId?: string;
  name: string;
  dose: string;
  route?: string;
  condition?: string;
  schedule?: string;
  asNeeded: boolean;
  storage?: string;
  heldOnSite: boolean;
  expiryDate?: string;
  consentBy?: string;
  consentDate?: string;
  consentGranted: boolean;
  notes?: string;
  archived?: boolean;
}
interface AdminEvent {
  id: string;
  medicationId: string;
  medName: string;
  childName: string;
  date: string;
  time?: string;
  doseGiven: string;
  administeredByName?: string;
  witnessedBy?: string;
  notes?: string;
}

const nowTime = () => {
  const t = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(t.getHours())}:${p(t.getMinutes())}`;
};
const todayIso = () => {
  const t = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`;
};
const fmt = (iso?: string) => (iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "");

type MedDraft = Partial<Med> & { childName: string; name: string; dose: string };
const emptyMed = (): MedDraft => ({ childName: "", name: "", dose: "", asNeeded: false, heldOnSite: false, consentGranted: false });

function MedForm({ onSaved, onCancel }: { onSaved: () => void; onCancel: () => void }) {
  const [d, setD] = useState<MedDraft>(emptyMed());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<MedDraft>) => setD((p) => ({ ...p, ...patch }));

  async function save() {
    if (!d.childName?.trim() || !d.name?.trim() || !d.dose?.trim()) {
      setError("Child, medicine and dose are required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiPost("/api/medications", d);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t save");
      setBusy(false);
    }
  }
  return (
    <Card className="mb-3.5 p-4">
      <div className="mb-2 text-[13.5px] font-extrabold">Authorise a medication</div>
      <div className="grid gap-2.5 sm:grid-cols-3">
        <div><FieldLabel>Child</FieldLabel><Input value={d.childName} onChange={(e) => set({ childName: e.target.value })} className="w-full" /></div>
        <div><FieldLabel>Medicine</FieldLabel><Input value={d.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Ventolin" className="w-full" /></div>
        <div><FieldLabel>Dose</FieldLabel><Input value={d.dose} onChange={(e) => set({ dose: e.target.value })} placeholder="e.g. one puff" className="w-full" /></div>
        <div><FieldLabel>For (condition)</FieldLabel><Input value={d.condition ?? ""} onChange={(e) => set({ condition: e.target.value })} placeholder="e.g. asthma" className="w-full" /></div>
        <div><FieldLabel>When to give</FieldLabel><Input value={d.schedule ?? ""} onChange={(e) => set({ schedule: e.target.value })} placeholder="e.g. as needed" className="w-full" /></div>
        <div><FieldLabel>Expiry date</FieldLabel><Input type="date" value={d.expiryDate ?? ""} onChange={(e) => set({ expiryDate: e.target.value })} className="w-full" /></div>
        <div className="sm:col-span-3"><FieldLabel>Storage</FieldLabel><Input value={d.storage ?? ""} onChange={(e) => set({ storage: e.target.value })} placeholder="e.g. in the office, room temperature" className="w-full" /></div>
      </div>
      <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
        <div><FieldLabel>Parent giving consent</FieldLabel><Input value={d.consentBy ?? ""} onChange={(e) => set({ consentBy: e.target.value })} className="w-full" /></div>
        <div><FieldLabel>Consent date</FieldLabel><Input type="date" value={d.consentDate?.slice(0, 10) ?? ""} onChange={(e) => set({ consentDate: e.target.value })} className="w-full" /></div>
      </div>
      <label className="mt-2.5 flex items-center gap-2 text-[12.5px] font-bold">
        <input type="checkbox" checked={!!d.consentGranted} onChange={(e) => set({ consentGranted: e.target.checked })} />
        The parent / carer has given written consent to administer this
      </label>
      <label className="mt-1.5 flex items-center gap-2 text-[12.5px]">
        <input type="checkbox" checked={!!d.heldOnSite} onChange={(e) => set({ heldOnSite: e.target.checked })} />
        The medicine is held on site
      </label>
      {!d.consentGranted && <div className="mt-2 text-[11.5px] text-[var(--ink-3)]">Without consent, a dose can’t be recorded against this medicine.</div>}
      {error && <div className="mt-2 text-[12.5px] font-bold text-[var(--red)]">{error}</div>}
      <div className="mt-3 flex gap-2">
        <Button variant="primary" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save"}</Button>
        <Button onClick={onCancel}>Cancel</Button>
      </div>
    </Card>
  );
}

function AdministerForm({ med, onDone }: { med: Med; onDone: () => void }) {
  const [dose, setDose] = useState(med.dose);
  const [time, setTime] = useState(nowTime());
  const [witnessedBy, setWitnessedBy] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function give() {
    setBusy(true);
    setError(null);
    try {
      await apiPost(`/api/medications/${encodeURIComponent(med.id)}/administer`, { date: todayIso(), time, doseGiven: dose, witnessedBy, notes });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t record");
      setBusy(false);
    }
  }
  return (
    <div className="mt-2 rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3">
      <div className="mb-1.5 text-[12px] font-extrabold">Record a dose of {med.name}</div>
      <div className="grid gap-2 sm:grid-cols-4">
        <div><FieldLabel>Dose</FieldLabel><Input value={dose} onChange={(e) => setDose(e.target.value)} className="w-full" /></div>
        <div><FieldLabel>Time</FieldLabel><Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-full" /></div>
        <div><FieldLabel>Witnessed by</FieldLabel><Input value={witnessedBy} onChange={(e) => setWitnessedBy(e.target.value)} className="w-full" /></div>
        <div><FieldLabel>Notes</FieldLabel><Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. no reaction" className="w-full" /></div>
      </div>
      {error && <div className="mt-1.5 text-[12px] font-bold text-[var(--red)]">{error}</div>}
      <div className="mt-2 flex gap-2"><Button sm variant="primary" disabled={busy} onClick={give}>{busy ? "Recording…" : "Confirm dose given"}</Button><Button sm onClick={onDone}>Cancel</Button></div>
    </div>
  );
}

export function MedicationApp() {
  const [meds, setMeds] = useState<Med[] | null>(null);
  const [admins, setAdmins] = useState<AdminEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [administering, setAdministering] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [canManage, setCanManage] = useState(false);

  const refresh = useCallback(() => {
    apiGet<Med[]>("/api/medications").then((m) => { setMeds(m); setError(null); }).catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
    apiGet<AdminEvent[]>("/api/medications/administrations").then(setAdmins).catch(() => {});
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { apiGet<{ role: string }>("/api/me").then((me) => setCanManage(["company", "freelancer", "franchise"].includes(me.role))).catch(() => {}); }, []);
  useRealtime(["medications", "medicationAdmin"], refresh);

  async function archive(m: Med) {
    try { await api(`/api/medications/${encodeURIComponent(m.id)}`, { method: "PUT", body: JSON.stringify({ archived: true }) }); refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
  }

  const dosesFor = (id: string) => admins.filter((a) => a.medicationId === id);

  return (
    <div className="text-[var(--ink)]">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>Medication</h2>
        {!adding && <Button variant="primary" onClick={() => setAdding(true)}>＋ Authorise a medication</Button>}
      </div>
      <p className="mb-4 text-[12.5px] text-[var(--ink-3)]">Authorised medicines and every dose given — nothing is administered without a parent’s consent.</p>

      {error && <div className="mb-3 rounded-lg border border-[var(--red-line,#f6c9cc)] bg-[var(--red-soft,#fdebec)] px-3 py-2 text-[12.5px] text-[var(--red,#e21d27)]">{error}</div>}
      {adding && <MedForm onSaved={() => { setAdding(false); refresh(); }} onCancel={() => setAdding(false)} />}

      {!meds ? (
        <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">Loading…</div>
      ) : meds.length === 0 ? (
        <Card className="p-6 text-center text-[13px] text-[var(--ink-3)]">No medications on file.</Card>
      ) : (
        <div className="flex flex-col gap-2.5">
          {meds.map((m) => {
            const doses = dosesFor(m.id);
            return (
              <Card key={m.id} className="p-3.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13.5px] font-extrabold">{m.childName}</span>
                  <span className="text-[13px]">— {m.name} <span className="text-[var(--ink-3)]">({m.dose})</span></span>
                  {m.condition && <Badge tone={{ bg: "var(--panel)", fg: "var(--ink-2)" }}>{m.condition}</Badge>}
                  {m.consentGranted ? (
                    <Badge tone={{ bg: "#eaf0fc", fg: "#1d3a8f" }}>consent on file</Badge>
                  ) : (
                    <Badge tone={{ bg: "var(--red-soft,#fdebec)", fg: "var(--red,#e21d27)" }}>no consent</Badge>
                  )}
                  {m.asNeeded && <Badge tone={{ bg: "#fdf3d8", fg: "#9a5a00" }}>as needed</Badge>}
                  <span className="ml-auto text-[11.5px] text-[var(--ink-3)]">{doses.length} dose{doses.length === 1 ? "" : "s"} recorded</span>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  <Button sm variant="primary" disabled={!m.consentGranted} onClick={() => setAdministering(administering === m.id ? null : m.id)} title={m.consentGranted ? "" : "No consent on file"}>
                    Record a dose
                  </Button>
                  <Button sm onClick={() => setOpenId(openId === m.id ? null : m.id)}>{openId === m.id ? "Hide" : `History (${doses.length})`}</Button>
                  {canManage && <Button sm variant="danger" onClick={() => archive(m)}>Archive</Button>}
                </div>
                {administering === m.id && <AdministerForm med={m} onDone={() => { setAdministering(null); refresh(); }} />}
                {openId === m.id && (
                  <div className="mt-2 border-t border-[var(--line)] pt-2">
                    {doses.length === 0 ? (
                      <div className="text-[12px] text-[var(--ink-3)]">No doses recorded yet.</div>
                    ) : (
                      doses.map((a) => (
                        <div key={a.id} className="border-b border-dashed border-[var(--line)] py-1 text-[12px] last:border-b-0">
                          <b>{fmt(a.date)}{a.time ? ` · ${a.time}` : ""}</b> — {a.doseGiven}
                          <span className="text-[var(--ink-3)]"> · by {a.administeredByName}{a.witnessedBy ? `, witnessed ${a.witnessedBy}` : ""}{a.notes ? ` · ${a.notes}` : ""}</span>
                        </div>
                      ))
                    )}
                    {(m.consentBy || m.expiryDate || m.storage) && (
                      <div className="mt-1.5 text-[11.5px] text-[var(--ink-3)]">
                        {m.consentBy && `Consent by ${m.consentBy}${m.consentDate ? ` on ${fmt(m.consentDate.slice(0, 10))}` : ""}. `}
                        {m.storage && `Stored: ${m.storage}. `}
                        {m.expiryDate && `Expires ${fmt(m.expiryDate)}.`}
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
