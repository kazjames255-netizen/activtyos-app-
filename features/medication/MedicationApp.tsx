"use client";

import { useCallback, useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { api, get as apiGet, post as apiPost } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
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
  const [freq, setFreq] = useState<"daily" | "asneeded">("daily");
  const [times, setTimes] = useState("");
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
    // Regular (repeat) meds store their daily time(s) in `schedule`; as-needed
    // meds flip `asNeeded` so the list flags them and they aren't a daily dose.
    const schedule = freq === "daily" ? (times.trim() ? `Every day · ${times.trim()}` : "Every day") : "As needed";
    try {
      await apiPost("/api/medications", { ...d, asNeeded: freq === "asneeded", schedule });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t save");
      setBusy(false);
    }
  }
  return (
    <Card className="mb-3.5 p-4">
      <div className="mb-2 text-[13.5px] font-extrabold">Administer a medication</div>
      <div className="grid gap-2.5 sm:grid-cols-3">
        <div><FieldLabel>Child / family</FieldLabel><ChildPicker value={d.childName} onPick={(name) => set({ childName: name })} /></div>
        <div><FieldLabel>Medicine</FieldLabel><Input value={d.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Ventolin" className="w-full" /></div>
        <div><FieldLabel>Dose</FieldLabel><Input value={d.dose} onChange={(e) => set({ dose: e.target.value })} placeholder="e.g. one puff" className="w-full" /></div>
        <div><FieldLabel>For (condition)</FieldLabel><Input value={d.condition ?? ""} onChange={(e) => set({ condition: e.target.value })} placeholder="e.g. asthma" className="w-full" /></div>
        <div>
          <FieldLabel>Frequency</FieldLabel>
          <div className="flex gap-1.5">
            {(["daily", "asneeded"] as const).map((f) => (
              <button key={f} type="button" onClick={() => setFreq(f)} className="flex-1 rounded-lg border px-2 py-2 text-[11.5px] font-bold transition-colors" style={freq === f ? { borderColor: "#1d3a8f", background: "#1d3a8f", color: "#fff" } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>{f === "daily" ? "🔁 Every day" : "As needed"}</button>
            ))}
          </div>
          {freq === "daily" && <Input value={times} onChange={(e) => setTimes(e.target.value)} placeholder="time(s) e.g. 12:00" className="mt-1.5 w-full" />}
        </div>
        <div><FieldLabel>Expiry date</FieldLabel><Input type="date" value={d.expiryDate ?? ""} onChange={(e) => set({ expiryDate: e.target.value })} className="w-full" /></div>
        <div className="sm:col-span-3"><FieldLabel>Storage</FieldLabel><Input value={d.storage ?? ""} onChange={(e) => set({ storage: e.target.value })} placeholder="e.g. in the office, room temperature" className="w-full" /></div>
        <div className="sm:col-span-3"><FieldLabel>Instructions</FieldLabel><Input value={d.instructions ?? ""} onChange={(e) => set({ instructions: e.target.value })} placeholder="e.g. give with food; wait 4 hours between doses; shake well" className="w-full" /></div>
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

function AdministerForm({ med, onDone }: { med: Med; onDone: (recorded: boolean) => void }) {
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
    setBusy(true);
    setError(null);
    try {
      await apiPost(`/api/medications/${encodeURIComponent(med.id)}/administer`, { date, time, given, doseGiven: given ? dose : "Not given", witnessedBy, notes });
      onDone(true);
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
        <div><FieldLabel>Witnessed by</FieldLabel><Input value={witnessedBy} onChange={(e) => setWitnessedBy(e.target.value)} className="w-full" /></div>
        <div><FieldLabel>Notes</FieldLabel><Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. no reaction" className="w-full" /></div>
      </div>
      {error && <div className="mt-1.5 text-[12px] font-bold text-[var(--red)]">{error}</div>}
      <div className="mt-2 flex gap-2"><Button sm variant={given ? "primary" : "danger"} disabled={busy} onClick={give}>{busy ? "Recording…" : given ? "✓ Confirm dose given" : "Record as not given"}</Button><Button sm onClick={() => onDone(false)}>Cancel</Button></div>
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
  const [logging, setLogging] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [confirm, setConfirm] = useState<{ id: string; given: boolean } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const flash = (msg: string) => { setNotice(msg); setTimeout(() => setNotice(null), 4500); };

  const refresh = useCallback(() => {
    // Fetch archived too so they're never lost — the UI shows Active / Archived.
    apiGet<Med[]>("/api/medications?includeArchived=1").then((m) => { setMeds(m); setError(null); }).catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
    apiGet<AdminEvent[]>("/api/medications/administrations").then(setAdmins).catch(() => {});
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { apiGet<{ role: string }>("/api/me").then((me) => setCanManage(["company", "freelancer", "franchise"].includes(me.role))).catch(() => {}); }, []);
  useRealtime(["medications", "medicationAdmin"], refresh);

  async function setArchived(m: Med, archived: boolean) {
    try { await api(`/api/medications/${encodeURIComponent(m.id)}`, { method: "PUT", body: JSON.stringify({ archived }) }); refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
  }
  // One-tap log for the common case — stamps today + now with the given/not-given
  // outcome. The detailed form ("with time / notes") handles back-dating etc.
  async function quickLog(m: Med, given: boolean) {
    setLogging(m.id);
    setError(null);
    try { await apiPost(`/api/medications/${encodeURIComponent(m.id)}/administer`, { date: todayIso(), time: nowTime(), given, doseGiven: given ? m.dose : "Not given" }); flash(given ? "✓ Administration logged — parent informed" : "✓ Logged as not given — parent informed"); refresh(); }
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
  const shown = showArchived ? archivedMeds : active;

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
        <div className="mb-3 flex flex-wrap gap-2">
          {([[false, "Active", active.length], [true, "Archived", archivedMeds.length]] as [boolean, string, number][]).map(([arch, label, n]) => (
            <button key={label} type="button" onClick={() => setShowArchived(arch)}
              className="rounded-full border px-3.5 py-1.5 text-[12.5px] font-bold transition-colors"
              style={showArchived === arch ? { borderColor: "#1d3a8f", background: "#1d3a8f", color: "#fff" } : { borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink-2)" }}>
              {label} <span className={showArchived === arch ? "text-white/70" : "text-[var(--ink-3)]"}>{n}</span>
            </button>
          ))}
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
                  {m.asNeeded ? <Badge tone={{ bg: "#fdf3d8", fg: "#9a5a00" }}>as needed</Badge> : m.schedule && <Badge tone={{ bg: "#e7f6ee", fg: "#0f7a43" }}>🔁 {m.schedule}</Badge>}
                  <span className="ml-auto text-[11.5px] text-[var(--ink-3)]">{doses.length} dose{doses.length === 1 ? "" : "s"} recorded</span>
                </div>
                {m.instructions && <div className="mt-1.5 rounded-lg bg-[var(--panel)] px-2.5 py-1.5 text-[12px] text-[var(--ink-2)]">📋 <b>How to give:</b> {m.instructions}</div>}
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  {m.archived ? (
                    <span className="text-[11.5px] font-bold text-[var(--ink-3)]">Archived — no new doses can be recorded.</span>
                  ) : m.consentGranted ? (
                    confirm?.id === m.id ? (
                      <>
                        <span className="text-[11.5px] font-bold text-[var(--ink)]">Confirm: {m.name} for {m.childName} — <span style={{ color: confirm.given ? "#0f7a43" : "#c02636" }}>{confirm.given ? "GIVEN" : "NOT given"}</span> now?</span>
                        <Button sm variant={confirm.given ? "primary" : "danger"} disabled={logging === m.id} onClick={() => { const g = confirm.given; setConfirm(null); quickLog(m, g); }}>{logging === m.id ? "Recording…" : "Confirm"}</Button>
                        <Button sm onClick={() => setConfirm(null)}>Cancel</Button>
                      </>
                    ) : (
                      <>
                        <span className="text-[11.5px] font-bold text-[var(--ink-3)]">Given?</span>
                        <Button sm variant="primary" onClick={() => setConfirm({ id: m.id, given: true })}>✓ Yes</Button>
                        <Button sm variant="danger" onClick={() => setConfirm({ id: m.id, given: false })}>✕ No</Button>
                        <button type="button" onClick={() => setAdministering(administering === m.id ? null : m.id)} className="text-[12px] font-bold text-[#1d3a8f] hover:underline">{administering === m.id ? "Close" : "＋ with time / notes"}</button>
                      </>
                    )
                  ) : (
                    <span className="text-[11.5px] font-bold text-[#c02636]">Consent needed before a dose can be recorded</span>
                  )}
                  <Button sm onClick={() => setOpenId(openId === m.id ? null : m.id)}>{openId === m.id ? "Hide" : `History (${doses.length})`}</Button>
                  {canManage && (m.archived
                    ? <Button sm variant="primary" onClick={() => setArchived(m, false)}>Restore</Button>
                    : <Button sm variant="danger" onClick={() => setArchived(m, true)}>Archive</Button>)}
                </div>
                {administering === m.id && <AdministerForm med={m} onDone={(recorded) => { setAdministering(null); if (recorded) flash("✓ Administration logged — parent informed"); refresh(); }} />}
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
