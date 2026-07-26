"use client";

import { useCallback, useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { api, get as apiGet, post as apiPost } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { useSettings } from "@/lib/settings";
import { Badge, Button, Card, FieldLabel, Input } from "@/components/ui";

const LIGHT_PALETTE = {
  "--bg": "#f5f8fd", "--surface": "#ffffff", "--panel": "#fbf8fc",
  "--ink": "#171534", "--ink-2": "#4a4763", "--ink-3": "#8a86a3", "--line": "#ece6f1",
} as CSSProperties;

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
  instructions?: string;
  asNeeded: boolean;
  storage?: string;
  heldOnSite: boolean;
  expiryDate?: string;
  consentBy?: string;
  consentDate?: string;
  consentGranted: boolean;
  consentWithdrawnAt?: string;
  notes?: string;
  parentNote?: string;
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
  given?: boolean;
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
// The parent-approved day labels live in `schedule` ("On these days: Mon 27 Jul,
// …"). A dose on a day not in that list is flagged but still allowed — the day
// label here must match how the parent's form formats them.
const dayLabel = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const BOOKED_SCHEDULE = "On every booked day"; // dynamic — approved = the child's current bookings
// `booked` is the child's live set of booked ISO days (recomputed from bookings)
// — only needed for the dynamic BOOKED_SCHEDULE. A fixed "On these days: …" list
// is parsed from the schedule string. Everything else is always approved.
const approvedForDay = (m: { schedule?: string }, iso: string, booked?: Set<string>) => {
  if (m.schedule === BOOKED_SCHEDULE) return booked ? booked.has(iso) : true;
  if (m.schedule?.startsWith("On these days")) return m.schedule.includes(dayLabel(iso));
  return true;
};

type MedDraft = Partial<Med> & { childName: string; name: string; dose: string };
const emptyMed = (): MedDraft => ({ childName: "", name: "", dose: "", asNeeded: false, heldOnSite: false, consentGranted: false });

// Search the operator's own families/children (from /api/customers) so the Child
// field is picked, not free-typed — the first step to linking a record to the
// parent. Free-typing still works if a child isn't on file yet.
interface Fam { id: string; name: string; email?: string; children?: { name: string }[] }
function ChildPicker({ value, onPick }: { value: string; onPick: (childName: string) => void }) {
  const [families, setFamilies] = useState<Fam[]>([]);
  const [q, setQ] = useState(value);
  const [open, setOpen] = useState(false);
  useEffect(() => { apiGet<Fam[]>("/api/customers").then(setFamilies).catch(() => {}); }, []);

  const ql = q.trim().toLowerCase();
  const opts: { child: string; sub: string }[] = [];
  for (const f of families) {
    const kids = f.children ?? [];
    if (kids.length === 0) opts.push({ child: f.name, sub: f.email ?? "family" });
    for (const k of kids) opts.push({ child: k.name, sub: f.name });
  }
  const matches = opts.filter((o) => !ql || o.child.toLowerCase().includes(ql) || o.sub.toLowerCase().includes(ql)).slice(0, 8);

  return (
    <div className="relative">
      <Input value={q} placeholder="Search child or family…" className="w-full"
        onChange={(e) => { setQ(e.target.value); onPick(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)} />
      {open && matches.length > 0 && (
        <div className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-lg">
          {matches.map((o, i) => (
            <button key={i} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { setQ(o.child); onPick(o.child); setOpen(false); }}
              className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-[12.5px] hover:bg-[var(--panel)]">
              <span className="font-semibold">{o.child}</span>
              <span className="text-[11px] text-[var(--ink-3)]">{o.sub}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function MedForm({ onSaved, onCancel }: { onSaved: () => void; onCancel: () => void }) {
  const [d, setD] = useState<MedDraft>(emptyMed());
  const [freq, setFreq] = useState<"booked" | "chosen" | "asneeded">("booked");
  const [pickedDays, setPickedDays] = useState<string[]>([]);
  const [times, setTimes] = useState<string[]>([]);
  const [timeInput, setTimeInput] = useState("");
  const [expiryNA, setExpiryNA] = useState(false);
  const [step, setStep] = useState(1);
  const addTime = () => { if (timeInput && !times.includes(timeInput)) { setTimes([...times, timeInput].sort()); setTimeInput(""); } };
  const [bkgs, setBkgs] = useState<{ child?: string; childId?: string; days?: string[] }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<MedDraft>) => setD((p) => ({ ...p, ...patch }));
  // The picked child's upcoming booked days, from this tenant's bookings — the
  // same list the parent sees, so "Only on the days I pick" matches both ends.
  useEffect(() => { apiGet<{ child?: string; childId?: string; days?: string[] }[]>("/api/bookings").then(setBkgs).catch(() => {}); }, []);
  const forChild = bkgs.filter((b) => (b.child ?? "").trim().toLowerCase() === (d.childName ?? "").trim().toLowerCase());
  const bookedDays = [...new Set(forChild.flatMap((b) => b.days ?? []))].filter((x) => x >= todayIso()).sort();
  // Resolve the picked child's id from their bookings so the med (and its doses)
  // link to the child → they reach the parent's Medication view.
  const linkedChildId = forChild.find((b) => b.childId)?.childId;

  async function save() {
    if (!d.childName?.trim() || !d.name?.trim() || !d.dose?.trim()) {
      setError("Child, medicine and dose are required.");
      return;
    }
    if (freq === "chosen" && pickedDays.length === 0) { setError("Tick the days from their bookings, or pick a different option."); return; }
    setBusy(true);
    setError(null);
    // Same schedule strings as the parent form (so "On these days: …" reads and
    // flags the same on both ends). "Every day" isn't date-bound, so it covers
    // any new days the parent books later.
    const base = freq === "booked" ? BOOKED_SCHEDULE
      : freq === "chosen" ? `On these days: ${pickedDays.map(dayLabel).join(", ")}`
      : "Only when needed";
    const schedule = times.length ? `${base} · at ${times.join(", ")}` : base;
    try {
      await apiPost("/api/medications", { ...d, childId: linkedChildId ?? d.childId, asNeeded: freq === "asneeded", schedule });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t save");
      setBusy(false);
    }
  }
  const canNext1 = !!d.childName?.trim() && !!d.name?.trim() && !!d.dose?.trim();
  const STEPS: [number, string][] = [[1, "Medicine"], [2, "When & how"], [3, "Consent"]];

  return (
    <Card className="mb-3.5 p-4">
      <div className="mb-3 text-[13.5px] font-extrabold">Administer a medication</div>

      {/* Big step indicator */}
      <div className="mb-4 flex items-center">
        {STEPS.map(([n, label], i) => (
          <div key={n} className={`flex items-center gap-2 ${i < STEPS.length - 1 ? "flex-1" : ""}`}>
            <button type="button" onClick={() => { if (n === 1 || canNext1) setStep(n); }} className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-full text-[15px] font-extrabold transition-colors" style={step === n ? { background: "#1d3a8f", color: "#fff" } : step > n ? { background: "#e7f6ee", color: "#0f7a43" } : { background: "var(--panel)", color: "var(--ink-3)" }}>{step > n ? "✓" : n}</span>
              <span className="hidden text-[13px] font-extrabold sm:inline" style={{ color: step === n ? "var(--ink)" : "var(--ink-3)" }}>{label}</span>
            </button>
            {i < STEPS.length - 1 && <span className="mx-2 h-1 flex-1 rounded-full" style={{ background: step > n ? "#0f7a43" : "var(--line)" }} />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="grid gap-2.5 sm:grid-cols-3">
          <div className="sm:col-span-3"><FieldLabel>Child / family</FieldLabel><ChildPicker value={d.childName} onPick={(name) => set({ childName: name })} /></div>
          <div><FieldLabel>Medicine</FieldLabel><Input value={d.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Ventolin" className="w-full" /></div>
          <div><FieldLabel>Dose</FieldLabel><Input value={d.dose} onChange={(e) => set({ dose: e.target.value })} placeholder="e.g. one puff" className="w-full" /></div>
          <div><FieldLabel>For (condition)</FieldLabel><Input value={d.condition ?? ""} onChange={(e) => set({ condition: e.target.value })} placeholder="e.g. asthma" className="w-full" /></div>
        </div>
      )}

      {step === 2 && (
        <>
          <div>
            <FieldLabel>When should staff give it?</FieldLabel>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {([["booked", "📋 On every booked day"], ["chosen", "📅 Only on the days I pick"], ["asneeded", "🩹 Only when needed"]] as ["booked" | "chosen" | "asneeded", string][]).map(([id, label]) => (
                <button key={id} type="button" onClick={() => setFreq(id)} className="rounded-xl border-2 px-4 py-2.5 text-[13px] font-extrabold transition-colors"
                  style={freq === id ? { borderColor: "#1d3a8f", background: "#1d3a8f", color: "#fff" } : { borderColor: "#cfe0f7", background: "#eef4fd", color: "#1d3a8f" }}>{label}</button>
              ))}
            </div>
            {freq === "booked" && <p className="mt-1.5 text-[11.5px] text-[var(--ink-3)]">Only on days they&rsquo;re booked in — checked live against bookings, so new dates are covered and a dose on a non-booked day is flagged.</p>}
            {freq === "asneeded" && <p className="mt-1.5 text-[11.5px] text-[var(--ink-3)]">Given only if needed — never routinely.</p>}
            {freq === "chosen" && (
              <div className="mt-2">
                {!d.childName?.trim() ? (
                  <p className="text-[11.5px] text-[var(--ink-3)]">Pick the child in step 1 to see their booked days.</p>
                ) : bookedDays.length === 0 ? (
                  <p className="text-[11.5px] text-[var(--ink-3)]">No upcoming booked days for {d.childName} — they may not be booked yet.</p>
                ) : (
                  <>
                    <div className="mb-1.5 flex items-center gap-2">
                      <button type="button" onClick={() => setPickedDays(pickedDays.length === bookedDays.length ? [] : [...bookedDays])} className="text-[12px] font-bold text-[#1d3a8f] hover:underline">{pickedDays.length === bookedDays.length ? "Clear all" : "Select all"}</button>
                      <span className="text-[11px] text-[var(--ink-3)]">their upcoming booked days</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {bookedDays.map((day) => {
                        const on = pickedDays.includes(day);
                        return <button key={day} type="button" onClick={() => setPickedDays(on ? pickedDays.filter((x) => x !== day) : [...pickedDays, day].sort())} className="rounded-full border px-2.5 py-1 text-[11.5px] font-bold transition-colors"
                          style={on ? { borderColor: "#1d3a8f", background: "#1d3a8f", color: "#fff" } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>{on ? "✓ " : ""}{dayLabel(day)}</button>;
                      })}
                    </div>
                  </>
                )}
              </div>
            )}
            <div className="mt-3">
              <FieldLabel>Set times? (optional — add one or more)</FieldLabel>
              <div className="flex flex-wrap items-center gap-2">
                <Input type="time" value={timeInput} onChange={(e) => setTimeInput(e.target.value)} className="w-auto" />
                <Button sm onClick={addTime}>＋ Add time</Button>
                <span className="text-[11px] text-[var(--ink-3)]">e.g. twice a day — a bell reminds staff at each time on days it&rsquo;s due</span>
              </div>
              {times.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {times.map((t) => (
                    <span key={t} className="inline-flex items-center gap-1.5 rounded-full bg-[#eaf0fc] px-2.5 py-1 text-[11.5px] font-bold text-[#1d3a8f]">🕒 {t}<button type="button" onClick={() => setTimes(times.filter((x) => x !== t))} aria-label="Remove time" className="text-[#1d3a8f]">✕</button></span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
            <div><FieldLabel>Storage</FieldLabel><Input value={d.storage ?? ""} onChange={(e) => set({ storage: e.target.value })} placeholder="e.g. in the office, room temperature" className="w-full" /></div>
            <div>
              <div className="flex items-center justify-between">
                <FieldLabel>Expiry date</FieldLabel>
                <button type="button" onClick={() => { const n = !expiryNA; setExpiryNA(n); if (n) set({ expiryDate: "" }); }} className="text-[11px] font-bold" style={{ color: expiryNA ? "#1d3a8f" : "var(--ink-3)" }}>{expiryNA ? "✓ Not applicable" : "N/A"}</button>
              </div>
              {expiryNA ? (
                <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-[13px] text-[var(--ink-3)]">Not applicable</div>
              ) : (
                <>
                  <Input type="date" value={d.expiryDate ?? ""} onChange={(e) => set({ expiryDate: e.target.value })} className="w-full" />
                  {d.expiryDate && d.expiryDate < todayIso() && <span className="mt-1 inline-block text-[11px] font-bold text-[#c02636]">⚠️ Expired — you can still enter it</span>}
                </>
              )}
            </div>
          </div>
          <div className="mt-2.5"><FieldLabel>Instructions</FieldLabel><Input value={d.instructions ?? ""} onChange={(e) => set({ instructions: e.target.value })} placeholder="e.g. give with food; wait 4 hours between doses; shake well" className="w-full" /></div>
        </>
      )}

      {step === 3 && (
        <>
          <label className="flex items-center gap-2 text-[13px] font-bold">
            <input type="checkbox" checked={!!d.consentGranted} onChange={(e) => set({ consentGranted: e.target.checked })} />
            The parent / carer has given written consent to administer this
          </label>
          <label className="mt-2 flex items-center gap-2 text-[12.5px]">
            <input type="checkbox" checked={!!d.heldOnSite} onChange={(e) => set({ heldOnSite: e.target.checked })} />
            The medicine is held on site
          </label>
          {!d.consentGranted && <div className="mt-2 text-[11.5px] text-[var(--ink-3)]">Without consent, a dose can’t be recorded against this medicine.</div>}
        </>
      )}

      {error && <div className="mt-3 text-[12.5px] font-bold text-[var(--red)]">{error}</div>}
      <div className="mt-4 flex items-center justify-between gap-2 border-t border-[var(--line)] pt-3">
        <Button onClick={onCancel}>Cancel</Button>
        <div className="flex gap-2">
          {step > 1 && <Button onClick={() => setStep(step - 1)}>← Back</Button>}
          {step < 3 && <Button variant="solid" disabled={step === 1 && !canNext1} onClick={() => setStep(step + 1)}>Next →</Button>}
          {step === 3 && <Button variant="solid" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save medication"}</Button>}
        </div>
      </div>
    </Card>
  );
}

function AdministerForm({ med, onDone, requireWitness, booked }: { med: Med; onDone: (recorded: boolean, given?: boolean) => void; requireWitness?: boolean; booked?: Set<string> }) {
  const [dose, setDose] = useState(med.dose);
  const [given, setGiven] = useState(true);
  const [date, setDate] = useState(todayIso());
  const [time, setTime] = useState(nowTime());
  const [witnessedBy, setWitnessedBy] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stampNow = () => { setDate(todayIso()); setTime(nowTime()); };
  async function give() {
    if (!date) { setError("Pick the day."); return; }
    if (requireWitness && !witnessedBy.trim()) { setError("A witness is required for each dose."); return; }
    setBusy(true);
    setError(null);
    try {
      await apiPost(`/api/medications/${encodeURIComponent(med.id)}/administer`, { date, time, given, doseGiven: given ? dose : "Not given", witnessedBy, notes });
      onDone(true, given);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t record");
      setBusy(false);
    }
  }
  return (
    <div className="mt-2 rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-[12px] font-extrabold">Record a dose of {med.name}</span>
        <span className="ml-1 text-[11px] font-bold uppercase tracking-wide text-[var(--ink-3)]">Given?</span>
        <div className="inline-flex rounded-full border border-[var(--line)] bg-[var(--surface)] p-0.5">
          <button type="button" onClick={() => setGiven(true)} className="rounded-full px-3 py-1 text-[12px] font-bold" style={given ? { background: "#0f7a43", color: "#fff" } : { color: "var(--ink-3)" }}>✓ Yes</button>
          <button type="button" onClick={() => setGiven(false)} className="rounded-full px-3 py-1 text-[12px] font-bold" style={!given ? { background: "#c02636", color: "#fff" } : { color: "var(--ink-3)" }}>✕ No</button>
        </div>
        <button type="button" onClick={stampNow} className="ml-auto rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1 text-[12px] font-bold text-[#1d3a8f] hover:border-[#1d3a8f]">🕒 Now</button>
      </div>
      <div className="grid gap-2 sm:grid-cols-5">
        <div><FieldLabel>Dose</FieldLabel><Input value={dose} onChange={(e) => setDose(e.target.value)} className="w-full" /></div>
        <div><FieldLabel>Day given</FieldLabel><Input type="date" max={todayIso()} value={date} onChange={(e) => setDate(e.target.value)} className="w-full" /></div>
        <div><FieldLabel>Time</FieldLabel><Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-full" /></div>
        <div><FieldLabel>Witnessed by{requireWitness ? " *" : ""}</FieldLabel><Input value={witnessedBy} onChange={(e) => setWitnessedBy(e.target.value)} placeholder={requireWitness ? "required" : ""} className="w-full" /></div>
        <div><FieldLabel>Notes</FieldLabel><Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. no reaction" className="w-full" /></div>
      </div>
      {!approvedForDay(med, date, booked) && <div className="mt-1.5 rounded-lg bg-[#fbeede] px-3 py-1.5 text-[11.5px] font-bold text-[#a9660a]">⚠️ {fmt(date)} isn&rsquo;t {med.schedule === BOOKED_SCHEDULE ? "a day they're booked in" : "on the parent's approved days"} — you can still record it.</div>}
      {error && <div className="mt-1.5 text-[12px] font-bold text-[var(--red)]">{error}</div>}
      <div className="mt-2 flex gap-2"><Button sm variant={given ? "solid" : "danger"} disabled={busy} onClick={give}>{busy ? "Recording…" : given ? "✓ Confirm dose given" : "Record as not given"}</Button><Button sm onClick={() => onDone(false)}>Cancel</Button></div>
    </div>
  );
}

export function MedicationApp() {
  const { settings } = useSettings();
  const med = settings.medication ?? {};
  const [role, setRole] = useState("");
  const [meds, setMeds] = useState<Med[] | null>(null);
  const [admins, setAdmins] = useState<AdminEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [administering, setAdministering] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [logging, setLogging] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [q, setQ] = useState("");
  const [confirm, setConfirm] = useState<{ id: string; given: boolean } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const flash = (msg: string) => { setNotice(msg); setTimeout(() => setNotice(null), 4500); };
  // Only leads/managers record doses when the setting is on (staff are blocked).
  const canRecord = !(med.leadsOnly && role === "staff");
  const parentMsg = (given: boolean) => {
    const informed = given ? (med.informParentGiven ?? true) : (med.informParentMissed ?? true);
    return `✓ ${given ? "Administration logged" : "Logged as not given"}${informed ? " — parent informed" : ""}`;
  };

  const [bkgs, setBkgs] = useState<{ child?: string; days?: string[] }[]>([]);
  const refresh = useCallback(() => {
    // Fetch archived too so they're never lost — the UI shows Active / Archived.
    apiGet<Med[]>("/api/medications?includeArchived=1").then((m) => { setMeds(m); setError(null); }).catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
    apiGet<AdminEvent[]>("/api/medications/administrations").then(setAdmins).catch(() => {});
    // Bookings power the dynamic "On every booked day" approval check.
    apiGet<{ child?: string; days?: string[] }[]>("/api/bookings").then(setBkgs).catch(() => {});
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { apiGet<{ role: string }>("/api/me").then((me) => { setRole(me.role); setCanManage(["company", "freelancer", "franchise"].includes(me.role)); }).catch(() => {}); }, []);
  useRealtime(["medications", "medicationAdmin", "bookings"], refresh);
  // The child's live set of booked ISO days — recomputed each render, so a new
  // booking immediately widens what "On every booked day" approves.
  const bookedDaysFor = (name: string) => new Set(bkgs.filter((b) => (b.child ?? "").trim().toLowerCase() === (name ?? "").trim().toLowerCase()).flatMap((b) => b.days ?? []));

  async function setArchived(m: Med, archived: boolean) {
    try { await api(`/api/medications/${encodeURIComponent(m.id)}`, { method: "PUT", body: JSON.stringify({ archived }) }); refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
  }
  // One-tap log for the common case — stamps today + now with the given/not-given
  // outcome. The detailed form ("with time / notes") handles back-dating etc.
  async function quickLog(m: Med, given: boolean) {
    setLogging(m.id);
    setError(null);
    try { await apiPost(`/api/medications/${encodeURIComponent(m.id)}/administer`, { date: todayIso(), time: nowTime(), given, doseGiven: given ? m.dose : "Not given" }); flash(parentMsg(given)); refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn’t record"); }
    finally { setLogging(null); }
  }

  const dosesFor = (id: string) => admins.filter((a) => a.medicationId === id);
  const active = (meds ?? []).filter((m) => !m.archived);
  const archivedMeds = (meds ?? []).filter((m) => m.archived);
  const consented = active.filter((m) => m.consentGranted).length;
  const needsConsent = active.filter((m) => !m.consentGranted).length;
  const dosesToday = admins.filter((a) => a.date === todayIso()).length;
  const tiles: [string, string | number][] = [["On file", active.length], ["With consent", consented], ["Needs consent", needsConsent], ["Doses today", dosesToday]];
  const ql = q.trim().toLowerCase();
  const shown = (showArchived ? archivedMeds : active).filter((m) => !ql || m.childName.toLowerCase().includes(ql) || m.name.toLowerCase().includes(ql));

  return (
    <div className="-m-5 min-h-[calc(100vh-3.5rem)] bg-[var(--bg)] p-5 text-[var(--ink)]" style={LIGHT_PALETTE}>
      {/* Hero — matches the other portal pages (blue → white). */}
      <div className="relative mb-3.5 overflow-hidden rounded-2xl p-5 text-white shadow-[0_10px_30px_-12px_rgba(29,58,143,.55)]" style={{ background: "linear-gradient(120deg,#1d3a8f 0%,#3f78d8 62%,#ffffff 100%)" }}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-[17px]">💊</span>
              Medication
            </div>
            <p className="mt-1.5 max-w-[560px] text-[12.5px] leading-[1.5] text-white/85">Authorised medicines and every dose given — nothing is administered without a parent’s consent.</p>
          </div>
          {!adding && (
            <button type="button" onClick={() => setAdding(true)} className="rounded-full bg-white px-4 py-2 text-[13px] font-extrabold text-[#1d3a8f] shadow-md transition-transform hover:-translate-y-px">
              ＋ Administer a medication
            </button>
          )}
        </div>
        {meds && (
          <div className="mt-4 flex flex-wrap gap-2.5">
            {tiles.map(([label, v]) => (
              <div key={label} className="rounded-xl bg-white/15 px-4 py-2 backdrop-blur-sm">
                <div className="text-[20px] font-extrabold leading-none">{v}</div>
                <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.08em] text-white/80">{label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {notice && <div className="mb-3 rounded-lg border border-[#bfe6cf] bg-[#e7f6ee] px-3 py-2 text-[12.5px] font-bold text-[#0f7a43]">{notice}</div>}
      {error && <div className="mb-3 rounded-lg border border-[var(--red-line,#f6c9cc)] bg-[var(--red-soft,#fdebec)] px-3 py-2 text-[12.5px] text-[var(--red,#e21d27)]">{error}</div>}
      {adding && <MedForm onSaved={() => { setAdding(false); refresh(); }} onCancel={() => setAdding(false)} />}

      {meds && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {([[false, "Active", active.length], [true, "Archived", archivedMeds.length]] as [boolean, string, number][]).map(([arch, label, n]) => (
            <button key={label} type="button" onClick={() => setShowArchived(arch)}
              className="rounded-full border px-3.5 py-1.5 text-[12.5px] font-bold transition-colors"
              style={showArchived === arch ? { borderColor: "#1d3a8f", background: "#1d3a8f", color: "#fff" } : { borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink-2)" }}>
              {label} <span className={showArchived === arch ? "text-white/70" : "text-[var(--ink-3)]"}>{n}</span>
            </button>
          ))}
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search child or medicine…"
            className="ml-auto w-56 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3.5 py-1.5 text-[12.5px] outline-none focus:border-[#1d3a8f]" />
        </div>
      )}

      {!meds ? (
        <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">Loading…</div>
      ) : shown.length === 0 ? (
        <Card className="p-6 text-center text-[13px] text-[var(--ink-3)]">{showArchived ? "No archived medications." : "No medications on file."}</Card>
      ) : (
        <div className="flex flex-col gap-2.5">
          {shown.map((m) => {
            const doses = dosesFor(m.id);
            return (
              <Card key={m.id} className="p-4">
                {/* Header — identity on the left, status on the right */}
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <span className="text-[16px] font-extrabold leading-tight" style={{ fontFamily: "var(--ff-display)" }}>{m.childName}</span>
                      <span className="text-[13.5px] text-[var(--ink-2)]">{m.name} <span className="text-[var(--ink-3)]">· {m.dose}</span></span>
                    </div>
                    {m.condition && <div className="mt-1"><Badge tone={{ bg: "var(--panel)", fg: "var(--ink-2)" }}>{m.condition}</Badge></div>}
                  </div>
                  <div className="flex flex-col items-start gap-1.5 sm:items-end">
                    {m.consentGranted ? (
                      <Badge tone={{ bg: "#eaf0fc", fg: "#1d3a8f" }}>consent on file</Badge>
                    ) : m.consentWithdrawnAt ? (
                      <Badge tone={{ bg: "var(--red-soft,#fdebec)", fg: "var(--red,#e21d27)" }}>⚠️ parent removed consent</Badge>
                    ) : (
                      <Badge tone={{ bg: "var(--red-soft,#fdebec)", fg: "var(--red,#e21d27)" }}>no consent</Badge>
                    )}
                    {m.expiryDate && m.expiryDate < todayIso() && <Badge tone={{ bg: "#fdebec", fg: "#c02636" }}>⚠️ Expired</Badge>}
                    <span className="text-[11.5px] text-[var(--ink-3)]">{doses.length} dose{doses.length === 1 ? "" : "s"} recorded</span>
                  </div>
                </div>

                {/* When */}
                <div className="mt-3">
                  {m.asNeeded ? <Badge tone={{ bg: "#fdf3d8", fg: "#9a5a00" }}>as needed</Badge> : m.schedule && <Badge tone={{ bg: "#e7f6ee", fg: "#0f7a43" }}>🔁 {m.schedule}</Badge>}
                </div>

                {/* Details */}
                {(m.instructions || m.parentNote) && (
                  <div className="mt-2.5 flex flex-col gap-1.5">
                    {m.instructions && <div className="rounded-lg bg-[var(--panel)] px-3 py-2 text-[12px] leading-snug text-[var(--ink-2)]">📋 <b>How to give:</b> {m.instructions}</div>}
                    {m.parentNote && <div className="rounded-lg bg-[#f4f8ff] px-3 py-2 text-[12px] leading-snug text-[var(--ink-2)]">📝 <b>Parent note:</b> {m.parentNote}</div>}
                  </div>
                )}

                {/* Actions */}
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--line)] pt-3">
                  {m.archived ? (
                    <span className="text-[11.5px] font-bold text-[var(--ink-3)]">Archived — no new doses can be recorded.</span>
                  ) : m.consentGranted ? (
                    !canRecord ? (
                      <span className="text-[11.5px] font-bold text-[var(--ink-3)]">Only leads can record doses.</span>
                    ) : med.requireWitness ? (
                      <>
                        <Button sm variant="solid" onClick={() => setAdministering(administering === m.id ? null : m.id)}>{administering === m.id ? "Close" : "＋ Record a dose"}</Button>
                        <span className="text-[11px] text-[var(--ink-3)]">a witness is required</span>
                      </>
                    ) : confirm?.id === m.id ? (
                      <>
                        <span className="text-[11.5px] font-bold text-[var(--ink)]">Confirm: {m.name} for {m.childName} — <span style={{ color: confirm.given ? "#0f7a43" : "#c02636" }}>{confirm.given ? "GIVEN" : "NOT given"}</span> now?</span>
                        {!approvedForDay(m, todayIso(), bookedDaysFor(m.childName)) && <span className="rounded-full bg-[#fbeede] px-2 py-0.5 text-[10.5px] font-bold text-[#a9660a]">⚠️ {m.schedule === BOOKED_SCHEDULE ? "not booked in today" : "not on parent's approved days"}</span>}
                        <Button sm variant={confirm.given ? "solid" : "danger"} disabled={logging === m.id} onClick={() => { const g = confirm.given; setConfirm(null); quickLog(m, g); }}>{logging === m.id ? "Recording…" : "Confirm"}</Button>
                        <Button sm onClick={() => setConfirm(null)}>Cancel</Button>
                      </>
                    ) : (
                      <>
                        <span className="text-[11.5px] font-bold text-[var(--ink-3)]">Given?</span>
                        <Button sm variant="solid" onClick={() => setConfirm({ id: m.id, given: true })}>✓ Yes</Button>
                        <Button sm variant="danger" onClick={() => setConfirm({ id: m.id, given: false })}>✕ No</Button>
                        <button type="button" onClick={() => setAdministering(administering === m.id ? null : m.id)} className="text-[12px] font-bold text-[#1d3a8f] hover:underline">{administering === m.id ? "Close" : "＋ with time / notes"}</button>
                      </>
                    )
                  ) : (
                    <span className="text-[11.5px] font-bold text-[#c02636]">Consent needed before a dose can be recorded</span>
                  )}
                  <Button sm onClick={() => setOpenId(openId === m.id ? null : m.id)}>{openId === m.id ? "Hide" : `History (${doses.length})`}</Button>
                  {canManage && (m.archived
                    ? <Button sm variant="solid" onClick={() => setArchived(m, false)}>Restore</Button>
                    : <Button sm variant="danger" onClick={() => setArchived(m, true)}>Archive</Button>)}
                </div>
                {administering === m.id && <AdministerForm med={m} requireWitness={!!med.requireWitness} booked={bookedDaysFor(m.childName)} onDone={(recorded, g) => { setAdministering(null); if (recorded) flash(parentMsg(g ?? true)); refresh(); }} />}
                {openId === m.id && (
                  <div className="mt-2 border-t border-[var(--line)] pt-2">
                    {doses.length === 0 ? (
                      <div className="text-[12px] text-[var(--ink-3)]">No doses recorded yet.</div>
                    ) : (
                      doses.map((a) => (
                        <div key={a.id} className="flex flex-wrap items-center gap-x-1.5 border-b border-dashed border-[var(--line)] py-1 text-[12px] last:border-b-0">
                          {(() => { const notGiven = a.given === false || a.doseGiven === "Not given"; return <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold" style={notGiven ? { background: "#fdebec", color: "#c02636" } : { background: "#e7f6ee", color: "#0f7a43" }}>{notGiven ? "✕ Not given" : "✓ Given"}</span>; })()}
                          <b>{fmt(a.date)}{a.time ? ` · ${a.time}` : ""}</b> — {a.doseGiven}
                          <span className="text-[var(--ink-3)]">· by {a.administeredByName}{a.witnessedBy ? `, witnessed ${a.witnessedBy}` : ""}{a.notes ? ` · ${a.notes}` : ""}</span>
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
