"use client";

import { useCallback, useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { api, get as apiGet, post as apiPost } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { useSettings } from "@/lib/settings";
import { Badge, Button, Card, FieldLabel, Input } from "@/components/ui";
import { ChildPicker, type ChildOption } from "@/components/pickers/ChildPicker";
import { INJURY_BANK, TREATMENT_BANK, treatmentsFor } from "./firstAid";

// ─────────────────────────────────────────────────────────────────────────
// Incidents & Accidents — the safeguarding log. One component, `kind` picks
// the flavour (fields, wording, hero). The record and API are shared. Logged
// against a booked child so the accident reaches the parent's own area with a
// timestamp + notification. Themed + stepped to match the Medication page.
// ─────────────────────────────────────────────────────────────────────────

type Kind = "accident" | "incident";
interface Log {
  id: string; kind: Kind; date: string; time?: string; childName: string; childId?: string;
  location?: string; description: string; injury?: string; treatment?: string; firstAider?: string;
  incidentType?: string; actionTaken?: string; witnesses?: string; severity: "minor" | "moderate" | "serious";
  parentNotified: boolean; parentNotifiedAt?: string; parentNotifiedHow?: string; followUp?: string;
  recordedByName?: string; createdAt?: string;
}

const LIGHT_PALETTE = {
  "--bg": "#f5f8fd", "--surface": "#ffffff", "--panel": "#fbf8fc",
  "--ink": "#171534", "--ink-2": "#4a4763", "--ink-3": "#8a86a3", "--line": "#ece6f1",
} as CSSProperties;
const COPY = {
  accident: { title: "Accidents", one: "accident", add: "Log an accident", icon: "⛑️", lede: "Every bump and graze — logged on the day, kept for your records, and sent to the parent." },
  incident: { title: "Incidents", one: "incident", add: "Log an incident", icon: "⚑", lede: "Behaviour, near-misses and concerns — recorded on the day and kept for your records." },
} as const;
const SEV = { minor: { label: "Minor", bg: "#e7f6ee", fg: "#0f7a43" }, moderate: { label: "Moderate", bg: "#fdf3d8", fg: "#9a5a00" }, serious: { label: "Serious", bg: "#fdebec", fg: "#c02636" } } as const;
const todayIso = () => { const t = new Date(); const p = (n: number) => String(n).padStart(2, "0"); return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`; };
const nowTime = () => { const t = new Date(); const p = (n: number) => String(n).padStart(2, "0"); return `${p(t.getHours())}:${p(t.getMinutes())}`; };
const fmtDate = (iso?: string) => (iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }) : "");

type Draft = Partial<Log> & { kind: Kind; date: string; childName: string; description: string };
const emptyDraft = (kind: Kind): Draft => ({ kind, date: todayIso(), time: nowTime(), childName: "", description: "", severity: "minor", parentNotified: false });

function LogForm({ kind, notifies, onSaved, onCancel }: { kind: Kind; notifies: boolean; onSaved: () => void; onCancel: () => void }) {
  const [d, setD] = useState<Draft>(emptyDraft(kind));
  const [bkgs, setBkgs] = useState<{ child?: string; childId?: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const [treatSel, setTreatSel] = useState<string[]>([]);
  const [treatOther, setTreatOther] = useState("");
  const [showAllTreat, setShowAllTreat] = useState(false);
  const set = (patch: Partial<Draft>) => setD((p) => ({ ...p, ...patch }));
  const toggleTreat = (t: string) => setTreatSel((s) => (s.includes(t) ? s.filter((x) => x !== t) : [...s, t]));
  useEffect(() => { apiGet<{ child?: string; childId?: string }[]>("/api/bookings").then(setBkgs).catch(() => {}); }, []);
  const childOptions: ChildOption[] = [...new Map(bkgs.filter((b) => b.child).map((b) => [b.child!.trim().toLowerCase(), { name: b.child!, childId: b.childId }])).values()];

  async function save() {
    if (!d.childName.trim() || !d.description.trim()) { setError("Add the child and what happened."); return; }
    setBusy(true); setError(null);
    const treatment = kind === "accident" ? ([...treatSel, treatOther.trim()].filter(Boolean).join("; ") || undefined) : d.treatment;
    try {
      await apiPost("/api/incidents", { ...d, treatment, parentNotifiedAt: d.parentNotified ? new Date().toISOString() : undefined });
      onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t save"); setBusy(false); }
  }

  const canNext1 = !!d.childName?.trim();
  const canNext2 = !!d.description?.trim();
  const STEPS: [number, string][] = [[1, "Child & when"], [2, "What happened"], [3, "Severity & parent"]];

  return (
    <Card className="mb-3.5 p-4">
      <div className="mb-3 text-[13.5px] font-extrabold">{COPY[kind].add}</div>
      <div className="mb-4 flex items-center">
        {STEPS.map(([n, label], i) => (
          <div key={n} className={`flex items-center gap-2 ${i < STEPS.length - 1 ? "flex-1" : ""}`}>
            <button type="button" onClick={() => { if (n === 1 || (n === 2 && canNext1) || (n === 3 && canNext1 && canNext2)) setStep(n); }} className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-full text-[15px] font-extrabold transition-colors" style={step === n ? { background: "#1d3a8f", color: "#fff" } : step > n ? { background: "#e7f6ee", color: "#0f7a43" } : { background: "var(--panel)", color: "var(--ink-3)" }}>{step > n ? "✓" : n}</span>
              <span className="hidden text-[13px] font-extrabold sm:inline" style={{ color: step === n ? "var(--ink)" : "var(--ink-3)" }}>{label}</span>
            </button>
            {i < STEPS.length - 1 && <span className="mx-2 h-1 flex-1 rounded-full" style={{ background: step > n ? "#0f7a43" : "var(--line)" }} />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="grid gap-2.5 sm:grid-cols-2">
          <div className="sm:col-span-2"><FieldLabel>Child (booked)</FieldLabel><ChildPicker value={d.childName} options={childOptions} onPick={(name, childId) => set({ childName: name, childId })} /></div>
          <div><FieldLabel>Date</FieldLabel><Input type="date" max={todayIso()} value={d.date} onChange={(e) => set({ date: e.target.value })} className="w-full" /></div>
          <div><FieldLabel>Time</FieldLabel><Input type="time" value={d.time ?? ""} onChange={(e) => set({ time: e.target.value })} className="w-full" /></div>
          <div className="sm:col-span-2"><FieldLabel>Where did it happen?</FieldLabel><Input value={d.location ?? ""} onChange={(e) => set({ location: e.target.value })} placeholder="e.g. the main hall" className="w-full" /></div>
        </div>
      )}

      {step === 2 && (
        <>
          <div><FieldLabel>What happened?</FieldLabel><textarea value={d.description} onChange={(e) => set({ description: e.target.value })} rows={3} placeholder="Describe it clearly and factually…" className="w-full resize-y rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[13px] leading-relaxed text-[var(--ink)] outline-none focus:border-[#1d3a8f]" /></div>
          {kind === "accident" ? (
            <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
              <div>
                <FieldLabel>Injury / body part</FieldLabel>
                <Input list="injuryBank" value={d.injury ?? ""} onChange={(e) => set({ injury: e.target.value })} placeholder="Search e.g. sprained ankle — or type your own" className="w-full" />
                <datalist id="injuryBank">{INJURY_BANK.map((i) => <option key={i} value={i} />)}</datalist>
              </div>
              <div><FieldLabel>First aider</FieldLabel><Input value={d.firstAider ?? ""} onChange={(e) => set({ firstAider: e.target.value })} placeholder="who gave first aid" className="w-full" /></div>
              <div className="sm:col-span-2">
                <FieldLabel>First aid / treatment given — tick all that apply</FieldLabel>
                {(treatSel.length > 0 || !!treatOther.trim()) && (
                  <div className="mb-1.5 rounded-lg border border-[#cfe0f7] bg-[#f5f9ff] p-2">
                    <div className="mb-1 text-[10.5px] font-bold uppercase tracking-wide text-[#1d3a8f]">Selected · what will be recorded</div>
                    <div className="flex flex-wrap gap-1.5">
                      {treatSel.map((t) => (
                        <span key={t} className="inline-flex items-center gap-1 rounded-full bg-[#1d3a8f] px-2 py-0.5 text-[11px] font-semibold text-white">
                          {t}
                          <button type="button" onClick={() => toggleTreat(t)} className="text-white/80 hover:text-white" aria-label="remove">✕</button>
                        </span>
                      ))}
                      {treatOther.trim() && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-[#1d3a8f] bg-white px-2 py-0.5 text-[11px] font-semibold text-[#1d3a8f]">
                          {treatOther.trim()}
                          <button type="button" onClick={() => setTreatOther("")} className="text-[#1d3a8f]/70 hover:text-[#1d3a8f]" aria-label="remove">✕</button>
                        </span>
                      )}
                    </div>
                  </div>
                )}
                {(() => {
                  const relevant = treatmentsFor(d.injury);
                  const hasRelevant = relevant.length > 0;
                  // show injury-specific options unless the operator opts into the full bank
                  const list = showAllTreat || !hasRelevant ? TREATMENT_BANK : relevant;
                  // keep any ticked items that aren't in the shown list visible too
                  const shown = [...list, ...treatSel.filter((t) => !list.includes(t))];
                  return (
                    <>
                      <div className="mb-1 flex items-center justify-between px-0.5">
                        <span className="text-[10.5px] font-semibold text-[var(--ink-3)]">
                          {hasRelevant && !showAllTreat
                            ? <>💡 First aid for <b className="text-[#1d3a8f]">{d.injury}</b> · {treatSel.length} ticked</>
                            : <>{treatSel.length} ticked{d.injury ? "" : " · pick an injury above for tailored options"}</>}
                        </span>
                        {treatSel.length > 0 && <button type="button" onClick={() => setTreatSel([])} className="text-[10.5px] font-semibold text-[#1d3a8f] underline">Clear</button>}
                      </div>
                      <div className="flex max-h-52 flex-col gap-1 overflow-y-auto rounded-lg border border-[var(--line)] bg-[var(--surface)] p-1.5 [scrollbar-width:thin]">
                        {shown.map((t) => {
                          const on = treatSel.includes(t);
                          return (
                            <label key={t} className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-[12.5px] leading-snug transition-colors" style={on ? { background: "#eef4fd", color: "#1d3a8f", fontWeight: 700 } : { color: "var(--ink-2)" }}>
                              <input type="checkbox" checked={on} onChange={() => toggleTreat(t)} className="mt-0.5 shrink-0" />
                              <span>{t}</span>
                            </label>
                          );
                        })}
                      </div>
                      {hasRelevant && (
                        <button type="button" onClick={() => setShowAllTreat((v) => !v)} className="mt-1 text-[11px] font-semibold text-[#1d3a8f] underline">
                          {showAllTreat ? `Show only first aid for ${d.injury}` : "Show all treatments"}
                        </button>
                      )}
                    </>
                  );
                })()}
                <Input value={treatOther} onChange={(e) => setTreatOther(e.target.value)} placeholder="Add your own / extra detail…" className="mt-2 w-full" />
                <p className="mt-1 text-[10.5px] leading-snug text-[var(--ink-3)]">Tick what was done (one or more) and add anything else. Suggestions follow NHS / St John Ambulance guidance — always use your trained first aider&rsquo;s judgement.</p>
              </div>
            </div>
          ) : (
            <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
              <div><FieldLabel>Type</FieldLabel><Input value={d.incidentType ?? ""} onChange={(e) => set({ incidentType: e.target.value })} placeholder="e.g. behaviour, near-miss" className="w-full" /></div>
              <div><FieldLabel>Witnesses</FieldLabel><Input value={d.witnesses ?? ""} onChange={(e) => set({ witnesses: e.target.value })} className="w-full" /></div>
              <div className="sm:col-span-2"><FieldLabel>Action taken</FieldLabel><Input value={d.actionTaken ?? ""} onChange={(e) => set({ actionTaken: e.target.value })} className="w-full" /></div>
            </div>
          )}
        </>
      )}

      {step === 3 && (
        <>
          <FieldLabel>How serious?</FieldLabel>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {(["minor", "moderate", "serious"] as const).map((s) => (
              <button key={s} type="button" onClick={() => set({ severity: s })} className="rounded-xl border-2 px-4 py-2.5 text-[13px] font-extrabold transition-colors"
                style={d.severity === s ? { borderColor: SEV[s].fg, background: SEV[s].fg, color: "#fff" } : { borderColor: SEV[s].bg, background: SEV[s].bg, color: SEV[s].fg }}>{SEV[s].label}</button>
            ))}
          </div>
          <label className="mt-3 flex items-center gap-2 text-[12.5px] font-bold"><input type="checkbox" checked={!!d.parentNotified} onChange={(e) => set({ parentNotified: e.target.checked })} />I&rsquo;ve also told the parent in person / by phone</label>
          <div className="mt-2.5"><FieldLabel>Follow-up (optional)</FieldLabel><Input value={d.followUp ?? ""} onChange={(e) => set({ followUp: e.target.value })} placeholder="e.g. monitor overnight; parent to check tomorrow" className="w-full" /></div>
          {notifies && <div className="mt-2.5 rounded-lg bg-[#f4f8ff] px-3 py-2 text-[11.5px] text-[var(--ink-2)]">📨 The parent will be emailed and notified in their area with a timestamp when you save{d.childId ? "" : " (once this child is matched to a booking)"}.</div>}
        </>
      )}

      {error && <div className="mt-3 text-[12.5px] font-bold text-[var(--red)]">{error}</div>}
      <div className="mt-4 flex items-center justify-between gap-2 border-t border-[var(--line)] pt-3">
        <Button onClick={onCancel}>Cancel</Button>
        <div className="flex gap-2">
          {step > 1 && <Button onClick={() => setStep(step - 1)}>← Back</Button>}
          {step < 3 && <Button variant="solid" disabled={(step === 1 && !canNext1) || (step === 2 && !canNext2)} onClick={() => setStep(step + 1)}>Next →</Button>}
          {step === 3 && <Button variant="solid" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save record"}</Button>}
        </div>
      </div>
    </Card>
  );
}

export function IncidentsApp({ kind }: { kind: Kind }) {
  const { settings } = useSettings();
  const notifies = kind === "accident" ? (settings.safeguarding?.notifyParentAccident ?? true) : (settings.safeguarding?.notifyParentIncident ?? false);
  const [logs, setLogs] = useState<Log[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [q, setQ] = useState("");
  const [sevFilter, setSevFilter] = useState("");

  const refresh = useCallback(() => {
    apiGet<Log[]>(`/api/incidents?kind=${kind}`).then((l) => { setLogs(l); setError(null); }).catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, [kind]);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { apiGet<{ role: string }>("/api/me").then((me) => setCanManage(["company", "freelancer", "franchise"].includes(me.role))).catch(() => {}); }, []);
  useRealtime(["incidents"], refresh);

  async function remove(l: Log) {
    if (!confirm(`Delete this ${COPY[kind].one} record for ${l.childName}? Safeguarding records are usually kept.`)) return;
    try { await api(`/api/incidents/${encodeURIComponent(l.id)}`, { method: "DELETE" }); refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Delete failed"); }
  }

  const c = COPY[kind];
  const ql = q.trim().toLowerCase();
  const all = logs ?? [];
  const thisMonth = all.filter((l) => (l.date ?? "").slice(0, 7) === todayIso().slice(0, 7)).length;
  const serious = all.filter((l) => l.severity === "serious").length;
  const informed = all.filter((l) => l.parentNotified || l.parentNotifiedAt).length;
  const tiles: [string, number][] = [["This month", thisMonth], ["Serious", serious], ["Parent informed", informed], ["Total", all.length]];
  const shown = all.filter((l) => (!ql || l.childName.toLowerCase().includes(ql) || l.description.toLowerCase().includes(ql)) && (!sevFilter || l.severity === sevFilter));

  return (
    <div className="-m-5 min-h-[calc(100vh-3.5rem)] bg-[var(--bg)] p-5 text-[var(--ink)]" style={LIGHT_PALETTE}>
      {/* Hero */}
      <div className="relative mb-3.5 overflow-hidden rounded-2xl p-5 text-white shadow-[0_10px_30px_-12px_rgba(29,58,143,.55)]" style={{ background: "linear-gradient(120deg,#1d3a8f 0%,#3f78d8 62%,#ffffff 100%)" }}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-[17px]">{c.icon}</span>{c.title}
            </div>
            <p className="mt-1.5 max-w-[600px] text-[12.5px] leading-[1.5] text-white/85">{c.lede}</p>
          </div>
          {!adding && <button type="button" onClick={() => setAdding(true)} className="rounded-full bg-white px-4 py-2 text-[13px] font-extrabold text-[#1d3a8f] shadow-md transition-transform hover:-translate-y-px">＋ {c.add}</button>}
        </div>
        {logs && (
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

      {error && <div className="mb-3 rounded-lg border border-[var(--red-line,#f6c9cc)] bg-[var(--red-soft,#fdebec)] px-3 py-2 text-[12.5px] text-[var(--red,#e21d27)]">{error}</div>}
      {adding && <LogForm kind={kind} notifies={notifies} onSaved={() => { setAdding(false); refresh(); }} onCancel={() => setAdding(false)} />}

      {logs && all.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {([["", "All"], ["minor", "Minor"], ["moderate", "Moderate"], ["serious", "Serious"]] as [string, string][]).map(([id, label]) => (
            <button key={label} type="button" onClick={() => setSevFilter(id)} className="rounded-full border px-3.5 py-1.5 text-[12.5px] font-bold transition-colors"
              style={sevFilter === id ? { borderColor: "#1d3a8f", background: "#1d3a8f", color: "#fff" } : { borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink-2)" }}>{label}</button>
          ))}
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search child or details…" className="ml-auto w-56 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3.5 py-1.5 text-[12.5px] outline-none focus:border-[#1d3a8f]" />
        </div>
      )}

      {!logs ? (
        <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">Loading…</div>
      ) : shown.length === 0 ? (
        <Card className="p-6 text-center text-[13px] text-[var(--ink-3)]">{all.length === 0 ? `No ${c.one} records — hopefully it stays that way.` : "No records match."}</Card>
      ) : (
        <div className="flex flex-col gap-2.5">
          {shown.map((l) => {
            const sev = SEV[l.severity] ?? SEV.minor;
            return (
              <Card key={l.id} className="overflow-hidden p-0">
                <div className="h-1.5 w-full" style={{ background: sev.fg }} />
                <div className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <span className="text-[16px] font-extrabold leading-tight" style={{ fontFamily: "var(--ff-display)" }}>{l.childName}</span>
                        {l.injury && <span className="text-[13px] text-[var(--ink-2)]">{l.injury}</span>}
                      </div>
                      <p className="mt-1 max-w-[640px] text-[13px] leading-snug text-[var(--ink-2)]">{l.description}</p>
                    </div>
                    <div className="flex flex-col items-start gap-1.5 sm:items-end">
                      <Badge tone={{ bg: sev.bg, fg: sev.fg }}>{sev.label}</Badge>
                      <span className="text-[11.5px] text-[var(--ink-3)]">{fmtDate(l.date)}{l.time ? ` · ${l.time}` : ""}</span>
                      {l.parentNotified || l.parentNotifiedAt ? <Badge tone={{ bg: "#e7f6ee", fg: "#0f7a43" }}>✓ parent informed</Badge> : <Badge tone={{ bg: "#fdf3d8", fg: "#9a5a00" }}>parent not yet informed</Badge>}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-[var(--line)] pt-3">
                    <Button sm onClick={() => setOpenId(openId === l.id ? null : l.id)}>{openId === l.id ? "Hide details" : "Details"}</Button>
                    {canManage && <Button sm variant="danger" onClick={() => remove(l)}>Delete</Button>}
                  </div>
                  {openId === l.id && (
                    <div className="mt-2.5 grid gap-x-6 gap-y-1.5 rounded-xl bg-[var(--panel)] px-3.5 py-3 text-[12px] sm:grid-cols-2">
                      {l.location && <div><span className="text-[var(--ink-3)]">Where: </span><b>{l.location}</b></div>}
                      {l.injury && <div><span className="text-[var(--ink-3)]">Injury: </span><b>{l.injury}</b></div>}
                      {l.treatment && <div><span className="text-[var(--ink-3)]">First aid: </span><b>{l.treatment}</b></div>}
                      {l.firstAider && <div><span className="text-[var(--ink-3)]">First aider: </span><b>{l.firstAider}</b></div>}
                      {l.incidentType && <div><span className="text-[var(--ink-3)]">Type: </span><b>{l.incidentType}</b></div>}
                      {l.actionTaken && <div><span className="text-[var(--ink-3)]">Action: </span><b>{l.actionTaken}</b></div>}
                      {l.witnesses && <div><span className="text-[var(--ink-3)]">Witnesses: </span><b>{l.witnesses}</b></div>}
                      {l.parentNotifiedAt && <div><span className="text-[var(--ink-3)]">Parent informed: </span><b>{new Date(l.parentNotifiedAt).toLocaleString("en-GB")}</b></div>}
                      {l.recordedByName && <div><span className="text-[var(--ink-3)]">Recorded by: </span><b>{l.recordedByName}</b></div>}
                      {l.followUp && <div className="sm:col-span-2"><span className="text-[var(--ink-3)]">Follow-up: </span><b>{l.followUp}</b></div>}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
