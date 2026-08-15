"use client";

// Milestones — a professional operational roadmap for franchises.
//  • mode="franchise": a wide, dated roadmap (Gantt) — phases across a timeline,
//    each expandable to its sub-targets with start/end dates and completion bars.
//  • mode="ho": head-office editor for the master template + a live roadmap preview.
import { useMemo, useState, useEffect } from "react";
import { Button, Card, Input, Select } from "@/components/ui";
import { LIGHT_PALETTE, PageHero } from "@/components/OperatorPage";
import {
  type MPhase, type MStep, type MProgress, type MPhaseWhen,
  WHEN_LABEL, WHEN_TONE, phaseDone, phasePct, phaseComplete, overallPct, currentPhaseIndex, phaseWindow, stepPct, dparse, fmtShort, isoDate,
} from "@/lib/milestones";
import { loadTemplate, saveTemplate, resetTemplate, loadProgress, saveProgress, seedProgress, newId } from "./data";

const move = <T,>(arr: T[], i: number, dir: -1 | 1): T[] => { const j = i + dir; if (j < 0 || j >= arr.length) return arr; const c = [...arr]; [c[i], c[j]] = [c[j], c[i]]; return c; };
const addDaysISO = (base: string | undefined, n: number) => { const d = base ? new Date(`${base}T00:00:00`) : new Date(); d.setDate(d.getDate() + n); return isoDate(d); };

export function MilestonesApp({ mode = "franchise" }: { mode?: "ho" | "franchise" }) {
  const [phases, setPhases] = useState<MPhase[]>([]);
  const [prog, setProg] = useState<MProgress | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [newSeason, setNewSeason] = useState(false);
  useEffect(() => { const t = loadTemplate(); setPhases(t); setProg(loadProgress(t)); }, []);
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2200); };
  const persistPhases = (p: MPhase[]) => { setPhases(p); saveTemplate(p); };
  const persistProg = (p: MProgress) => { setProg(p); saveProgress(p); };

  if (!prog) return null;
  const startSeason = (name: string) => {
    const rec = new Set(phases.filter((p) => p.recurring).flatMap((p) => p.steps.map((s) => s.id)));
    const steps = Object.fromEntries(Object.entries(prog.steps).map(([id, st]) => [id, rec.has(id) ? { ...st, pct: 0 } : st]));
    persistProg({ ...prog, season: name, steps }); setNewSeason(false); flash(`New season: ${name} — recurring phases reset.`);
  };
  return (
    <div className="-m-3 min-h-[calc(100vh-3.5rem)] p-3 sm:-m-5 sm:p-5" style={LIGHT_PALETTE}>
      <PageHero title="Milestones" icon="📍" lede={mode === "ho"
        ? "The master roadmap every franchise follows — phases across a season timeline with dated sub-targets. Edit it here; franchises see it live and track their own dates & progress."
        : "Your season roadmap — every phase and sub-target on one timeline, with start/end dates and live completion bars."} />
      {mode === "ho"
        ? <HOEditor phases={phases} onChange={persistPhases} onReset={() => { resetTemplate(); const t = loadTemplate(); setPhases(t); flash("Reset to the default plan."); }} flash={flash} />
        : <Roadmap phases={phases} prog={prog} onProg={persistProg} onNewSeason={() => setNewSeason(true)} />}
      {newSeason && <NewSeason current={prog.season} onSave={startSeason} onClose={() => setNewSeason(false)} />}
      {toast && <div className="fixed bottom-5 left-1/2 z-[150] max-w-[92vw] -translate-x-1/2 rounded-2xl bg-[#111634] px-4 py-2.5 text-center text-[12.5px] font-bold text-white shadow-xl">{toast}</div>}
    </div>
  );
}

const LEFT = "w-[168px] sm:w-[210px]";

// ── The wide, dated roadmap ──────────────────────────────────────────────────
function Roadmap({ phases, prog, onProg, onNewSeason, readOnly = false }: { phases: MPhase[]; prog: MProgress; onProg: (p: MProgress) => void; onNewSeason: () => void; readOnly?: boolean }) {
  const today = new Date(); const day = 86400000;
  const wins = phases.map((p) => phaseWindow(p, prog)).filter(Boolean) as { start: Date; end: Date }[];
  let min = wins.length ? new Date(Math.min(...wins.map((w) => w.start.getTime()))) : new Date(today.getTime() - 42 * day);
  let max = wins.length ? new Date(Math.max(...wins.map((w) => w.end.getTime()))) : new Date(today.getTime() + 42 * day);
  min = new Date(min.getTime() - 6 * day); max = new Date(max.getTime() + 6 * day);
  const span = Math.max(max.getTime() - min.getTime(), day);
  const xp = (d: Date) => Math.max(0, Math.min(100, ((d.getTime() - min.getTime()) / span) * 100));
  const ticks: Date[] = []; let c = new Date(min.getFullYear(), min.getMonth() + 1, 1); while (c < max) { ticks.push(new Date(c)); c = new Date(c.getFullYear(), c.getMonth() + 1, 1); }
  const fmtMonth = (d: Date) => d.toLocaleDateString("en-GB", { month: "short" }) + (d.getMonth() === 0 ? ` ’${String(d.getFullYear()).slice(2)}` : "");

  const overall = overallPct(phases, prog);
  const totalSteps = phases.reduce((a, p) => a + p.steps.length, 0);
  const doneSteps = phases.reduce((a, p) => a + phaseDone(p, prog), 0);
  const [open, setOpen] = useState<string | null>(phases[currentPhaseIndex(phases, prog)]?.id ?? null);
  const [edit, setEdit] = useState<{ p: MPhase; s: MStep } | null>(null);
  const setStep = (id: string, patch: Partial<MProgress["steps"][string]>) => onProg({ ...prog, steps: { ...prog.steps, [id]: { ...(prog.steps[id] || { pct: 0 }), ...patch } } });

  const grid = () => (<>
    {ticks.map((t, i) => <div key={i} className="absolute inset-y-0 w-px" style={{ left: `${xp(t)}%`, background: "#e7ecf5" }} />)}
    <div className="absolute inset-y-0 w-0.5" style={{ left: `${xp(today)}%`, background: "#0e749066" }} />
  </>);

  return (
    <Card className="mt-4 w-full p-0">
      {/* header */}
      <div className="flex flex-wrap items-center gap-3 border-b border-[var(--line)] px-4 py-3">
        <MiniRing pct={overall} />
        <div>
          <div className="text-[15px] font-extrabold text-[var(--ink)]" style={{ fontFamily: "var(--ff-display)" }}>Season roadmap</div>
          <div className="text-[11.5px] text-[var(--ink-3)]">{prog.season} · {doneSteps}/{totalSteps} sub-targets complete</div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {(["setup", "before", "during", "after", "clubs"] as MPhaseWhen[]).filter((w) => phases.some((p) => p.when === w)).map((w) => <span key={w} className="inline-flex items-center gap-1 rounded-full bg-[var(--panel)] px-2 py-0.5 text-[10px] font-bold text-[var(--ink-2)]"><span className="h-2 w-2 rounded-full" style={{ background: WHEN_TONE[w] }} />{WHEN_LABEL[w].split(" ·")[0].split(" ")[0]}</span>)}
          {!readOnly && <Button onClick={onNewSeason} className="ml-1">＋ New season</Button>}
        </div>
      </div>

      {/* month axis */}
      <div className="flex items-end px-4 pt-2">
        <div className={`${LEFT} shrink-0`} />
        <div className="relative h-6 flex-1">
          {ticks.map((t, i) => <div key={i} className="absolute top-0 -translate-x-1/2 text-[10px] font-bold uppercase tracking-wide text-[var(--ink-3)]" style={{ left: `${xp(t)}%` }}>{fmtMonth(t)}</div>)}
          <div className="absolute top-0 -translate-x-1/2 rounded bg-[#0e7490] px-1 text-[9px] font-extrabold text-white" style={{ left: `${xp(today)}%` }}>TODAY</div>
        </div>
      </div>

      {/* phase rows */}
      <div className="px-4 pb-4">
        {phases.map((p) => { const win = phaseWindow(p, prog); const pc = phasePct(p, prog); const tone = WHEN_TONE[p.when]; const isOpen = open === p.id; const done = phaseComplete(p, prog);
          return (
            <div key={p.id} className="border-b border-[var(--line)] last:border-0">
              {/* phase bar row */}
              <div className="flex items-stretch">
                <button type="button" onClick={() => setOpen(isOpen ? null : p.id)} className={`${LEFT} flex shrink-0 items-center gap-2 py-2.5 pr-2 text-left`}>
                  <span className="w-3 text-[10px] text-[var(--ink-3)]">{isOpen ? "▾" : "▸"}</span>
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[15px]" style={{ background: tone + "18" }}>{p.icon}</span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-[12.5px] font-bold text-[var(--ink)]">{p.title}</span><span className="block text-[10px] text-[var(--ink-3)]">{win ? `${fmtShort(isoDate(win.start))} – ${fmtShort(isoDate(win.end))}` : "no dates yet"}</span></span>
                  <span className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-extrabold tabular-nums" style={{ background: done ? "#e6f4ea" : tone + "14", color: done ? "#0f7a43" : tone }}>{done ? "✓" : `${pc}%`}</span>
                </button>
                <div className="relative flex-1 py-2.5">
                  {grid()}
                  {win ? (
                    <div className="absolute top-1/2 h-7 -translate-y-1/2 overflow-hidden rounded-lg" style={{ left: `${xp(win.start)}%`, width: `${Math.max(xp(win.end) - xp(win.start), 1.5)}%`, background: tone + "22", boxShadow: `inset 0 0 0 1px ${tone}44` }}>
                      <div className="h-full transition-[width] duration-500" style={{ width: `${pc}%`, background: `linear-gradient(90deg, ${tone}, ${tone}cc)` }} />
                    </div>
                  ) : <div className="absolute left-0 top-1/2 -translate-y-1/2 text-[10px] italic text-[var(--ink-3)]">— add dates to the sub-targets —</div>}
                </div>
              </div>

              {/* sub-targets */}
              {isOpen && p.steps.map((s) => { const st = prog.steps[s.id]; const sp = stepPct(prog, s.id); const a = dparse(st?.start), b = dparse(st?.end); const sdone = sp >= 100;
                return (
                  <div key={s.id} className="flex items-stretch border-t border-dashed border-[var(--line)]">
                    <button type="button" disabled={readOnly} onClick={() => setEdit({ p, s })} className={`${LEFT} flex shrink-0 items-center gap-1.5 py-2 pl-6 pr-2 text-left ${readOnly ? "" : "hover:bg-[var(--panel)]"}`}>
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: sdone ? "#0f7a43" : tone }} />
                      <span className="min-w-0 flex-1 truncate text-[11.5px] text-[var(--ink-2)]">{s.title}</span>
                      <span className="shrink-0 text-[9.5px] font-bold tabular-nums text-[var(--ink-3)]">{sp}%</span>
                    </button>
                    <div className="relative flex-1 py-2">
                      {grid()}
                      {a && b ? (
                        <button type="button" disabled={readOnly} onClick={() => setEdit({ p, s })} title={`${s.title} · ${fmtShort(st?.start)}–${fmtShort(st?.end)} · ${sp}%`} className="absolute top-1/2 flex h-5 -translate-y-1/2 items-center overflow-hidden rounded-md" style={{ left: `${xp(a)}%`, width: `${Math.max(xp(b) - xp(a), 1)}%`, background: tone + "24", boxShadow: `inset 0 0 0 1px ${tone}55` }}>
                          <div className="h-full transition-[width]" style={{ width: `${sp}%`, background: tone + "d9" }} />
                        </button>
                      ) : <button type="button" disabled={readOnly} onClick={() => setEdit({ p, s })} className="absolute left-0 top-1/2 -translate-y-1/2 rounded-md bg-[var(--panel)] px-2 py-0.5 text-[9.5px] font-bold text-[var(--ink-3)] hover:text-[var(--ink)]">＋ set dates</button>}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {edit && <StepBarEditor phase={edit.p} step={edit.s} state={prog.steps[edit.s.id]} onChange={(patch) => setStep(edit.s.id, patch)} onClose={() => setEdit(null)} />}
    </Card>
  );
}

function MiniRing({ pct }: { pct: number }) {
  const r = 17, c = 2 * Math.PI * r;
  return (
    <div className="relative grid h-12 w-12 shrink-0 place-items-center">
      <svg width="48" height="48" className="-rotate-90"><circle cx="24" cy="24" r={r} fill="none" stroke="var(--panel)" strokeWidth="5" /><circle cx="24" cy="24" r={r} fill="none" stroke="#0e7490" strokeWidth="5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} style={{ transition: "stroke-dashoffset .5s ease" }} /></svg>
      <span className="absolute text-[12px] font-extrabold text-[var(--ink)]">{pct}%</span>
    </div>
  );
}

function StepBarEditor({ phase, step, state, onChange, onClose }: { phase: MPhase; step: MStep; state?: MProgress["steps"][string]; onChange: (patch: Partial<MProgress["steps"][string]>) => void; onClose: () => void }) {
  const tone = WHEN_TONE[phase.when];
  const start = state?.start || ""; const end = state?.end || ""; const pct = state?.pct ?? 0;
  return (
    <div className="fixed inset-0 z-[145] flex items-start justify-center overflow-y-auto bg-black/45 p-4 pt-[14vh]" onClick={onClose} style={LIGHT_PALETTE}>
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-center gap-2"><span className="rounded-md px-1.5 py-0.5 text-[10px] font-extrabold uppercase" style={{ background: tone + "18", color: tone }}>{phase.title}</span><button type="button" onClick={onClose} className="ml-auto text-[18px] text-[var(--ink-3)]">×</button></div>
        <h3 className="mb-3 text-[15px] font-extrabold text-[var(--ink)]">{step.title}</h3>
        <div className="grid grid-cols-2 gap-2">
          <label className="block"><span className="mb-1 block text-[10px] font-extrabold uppercase text-[var(--ink-3)]">Start</span><Input type="date" value={start} onChange={(e) => onChange({ start: e.target.value, end: end || addDaysISO(e.target.value, 7) })} className="w-full" /></label>
          <label className="block"><span className="mb-1 block text-[10px] font-extrabold uppercase text-[var(--ink-3)]">Target end</span><Input type="date" value={end} onChange={(e) => onChange({ end: e.target.value, start: start || addDaysISO(e.target.value, -7) })} className="w-full" /></label>
        </div>
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-[10px] font-extrabold uppercase text-[var(--ink-3)]"><span>Completion</span><span className="tabular-nums" style={{ color: tone }}>{pct}%</span></div>
          <input type="range" min={0} max={100} step={5} value={pct} onChange={(e) => onChange({ pct: Number(e.target.value) })} className="w-full" style={{ accentColor: tone }} />
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--panel)]"><div className="h-full rounded-full transition-[width]" style={{ width: `${pct}%`, background: tone }} /></div>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <button type="button" onClick={() => onChange({ start: undefined, end: undefined })} className="text-[11.5px] font-bold text-[var(--ink-3)] hover:text-[#c0392b]">Clear dates</button>
          <div className="ml-auto flex gap-2">
            <Button onClick={() => onChange({ pct: 100 })}>Mark done</Button>
            <Button variant="primary" onClick={onClose}>Done</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function NewSeason({ current, onSave, onClose }: { current: string; onSave: (name: string) => void; onClose: () => void }) {
  const [name, setName] = useState("");
  return (
    <div className="fixed inset-0 z-[140] flex items-start justify-center overflow-y-auto bg-black/45 p-4 pt-[16vh]" onClick={onClose} style={LIGHT_PALETTE}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-1 text-[15px] font-extrabold text-[var(--ink)]">Start a new season</h3>
        <p className="mb-3 text-[12px] text-[var(--ink-3)]">The recurring phases (plan / run / wrap) reset to 0% so you can work them again. One-time phases keep their progress. Currently: <b>{current}</b>.</p>
        <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">Season name</span><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Summer 2026" className="w-full" /></label>
        <div className="mt-3 flex justify-end gap-2"><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!name.trim()} onClick={() => onSave(name.trim())}>Start season</Button></div>
      </div>
    </div>
  );
}

// ── Head-office master template editor (with live roadmap preview) ────────────
function HOEditor({ phases, onChange, onReset, flash }: { phases: MPhase[]; onChange: (p: MPhase[]) => void; onReset: () => void; flash: (m: string) => void }) {
  const setPhase = (id: string, patch: Partial<MPhase>) => onChange(phases.map((p) => p.id === id ? { ...p, ...patch } : p));
  const setStep = (pid: string, sid: string, patch: Partial<MStep>) => onChange(phases.map((p) => p.id === pid ? { ...p, steps: p.steps.map((s) => s.id === sid ? { ...s, ...patch } : s) } : p));
  const totalSteps = phases.reduce((a, p) => a + p.steps.length, 0);
  const [showPreview, setShowPreview] = useState(true);
  const preview = useMemo(() => seedProgress(phases), [phases]);
  return (
    <>
      <div className="mt-4 mb-3 flex flex-wrap items-center gap-2">
        <span className="text-[12px] text-[var(--ink-3)]">{phases.length} phases · {totalSteps} sub-targets. This is the roadmap every franchise sees.</span>
        <div className="ml-auto flex gap-2">
          <Button onClick={() => setShowPreview((v) => !v)}>{showPreview ? "Hide preview" : "👀 Preview roadmap"}</Button>
          <Button onClick={onReset}>Reset to default</Button>
          <Button variant="primary" onClick={() => onChange([...phases, { id: newId(), title: "New phase", subtitle: "", when: "before", recurring: true, icon: "📌", steps: [] }])}>＋ Add phase</Button>
        </div>
      </div>

      {showPreview && phases.length > 0 && (
        <div className="mb-4 rounded-2xl border border-dashed border-[var(--line)] p-2">
          <div className="mb-1 flex items-center gap-2 px-1"><span className="rounded-full bg-[#1d3a8f] px-2 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wide text-white">Live preview</span><span className="text-[11.5px] text-[var(--ink-3)]">How the roadmap looks to a franchise (sample dates & progress). Edits below update it.</span></div>
          <Roadmap phases={phases} prog={preview} onProg={() => {}} onNewSeason={() => {}} readOnly />
        </div>
      )}

      <div className="space-y-3">{phases.map((p, pi) => (
        <Card key={p.id} className="p-4" style={{ borderLeft: `4px solid ${WHEN_TONE[p.when]}` }}>
          <div className="flex flex-wrap items-center gap-2">
            <Input value={p.icon} onChange={(e) => setPhase(p.id, { icon: e.target.value })} className="w-12 text-center text-[16px]" title="Emoji" />
            <Input value={p.title} onChange={(e) => setPhase(p.id, { title: e.target.value })} className="min-w-[160px] flex-1 font-bold" />
            <Select value={p.when} onChange={(e) => setPhase(p.id, { when: e.target.value as MPhaseWhen })} className="text-[12px]">{(Object.keys(WHEN_LABEL) as MPhaseWhen[]).map((w) => <option key={w} value={w}>{WHEN_LABEL[w]}</option>)}</Select>
            <label className="flex items-center gap-1 text-[11px] font-bold text-[var(--ink-2)]"><input type="checkbox" checked={p.recurring} onChange={(e) => setPhase(p.id, { recurring: e.target.checked })} /> resets each season</label>
            <div className="flex gap-0.5">
              <button type="button" onClick={() => onChange(move(phases, pi, -1))} disabled={pi === 0} className="rounded px-1.5 text-[13px] text-[var(--ink-3)] disabled:opacity-30 hover:text-[var(--ink)]">▲</button>
              <button type="button" onClick={() => onChange(move(phases, pi, 1))} disabled={pi === phases.length - 1} className="rounded px-1.5 text-[13px] text-[var(--ink-3)] disabled:opacity-30 hover:text-[var(--ink)]">▼</button>
              <button type="button" onClick={() => { onChange(phases.filter((x) => x.id !== p.id)); flash("Phase removed."); }} className="px-1 text-[15px] text-[var(--ink-3)] hover:text-[#c0392b]">×</button>
            </div>
          </div>
          <Input value={p.subtitle || ""} onChange={(e) => setPhase(p.id, { subtitle: e.target.value })} placeholder="Short description of this phase" className="mt-2 w-full text-[12px]" />

          <div className="mt-3 space-y-2">{p.steps.map((s, si) => (
            <div key={s.id} className="rounded-xl border border-[var(--line)] p-2.5">
              <div className="flex items-center gap-1.5">
                <Input value={s.title} onChange={(e) => setStep(p.id, s.id, { title: e.target.value })} placeholder="Sub-target" className="flex-1 text-[12.5px] font-semibold" />
                <button type="button" onClick={() => setPhase(p.id, { steps: move(p.steps, si, -1) })} disabled={si === 0} className="px-1 text-[12px] text-[var(--ink-3)] disabled:opacity-30 hover:text-[var(--ink)]">▲</button>
                <button type="button" onClick={() => setPhase(p.id, { steps: move(p.steps, si, 1) })} disabled={si === p.steps.length - 1} className="px-1 text-[12px] text-[var(--ink-3)] disabled:opacity-30 hover:text-[var(--ink)]">▼</button>
                <button type="button" onClick={() => setPhase(p.id, { steps: p.steps.filter((x) => x.id !== s.id) })} className="px-1 text-[15px] text-[var(--ink-3)] hover:text-[#c0392b]">×</button>
              </div>
              <Input value={s.detail || ""} onChange={(e) => setStep(p.id, s.id, { detail: e.target.value })} placeholder="Optional detail / what good looks like" className="mt-1.5 w-full text-[11.5px]" />
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {(s.links || []).map((l, li) => (
                  <span key={li} className="inline-flex items-center gap-1 rounded-lg bg-[var(--panel)] px-1.5 py-0.5">
                    <input value={l.label} onChange={(e) => setStep(p.id, s.id, { links: (s.links || []).map((x, k) => k === li ? { ...x, label: e.target.value } : x) })} placeholder="Label" className="w-16 bg-transparent text-[10.5px] font-bold text-[#1d3a8f] outline-none" />
                    <input value={l.href} onChange={(e) => setStep(p.id, s.id, { links: (s.links || []).map((x, k) => k === li ? { ...x, href: e.target.value } : x) })} placeholder="/franchise/…" className="w-28 bg-transparent text-[10px] text-[var(--ink-3)] outline-none" />
                    <button type="button" onClick={() => setStep(p.id, s.id, { links: (s.links || []).filter((_, k) => k !== li) })} className="text-[12px] text-[var(--ink-3)] hover:text-[#c0392b]">×</button>
                  </span>
                ))}
                <button type="button" onClick={() => setStep(p.id, s.id, { links: [...(s.links || []), { label: "Open", href: "/franchise/" }] })} className="text-[11px] font-bold text-[#1d3a8f] hover:underline">+ link</button>
              </div>
            </div>
          ))}</div>
          <button type="button" onClick={() => setPhase(p.id, { steps: [...p.steps, { id: newId(), title: "New sub-target", detail: "", links: [] }] })} className="mt-2 text-[12px] font-bold text-[#1d3a8f] hover:underline">+ Add sub-target</button>
        </Card>
      ))}</div>
    </>
  );
}

export default MilestonesApp;
