"use client";

// Milestones — an editable, dated operational roadmap for franchises.
//  • mode="franchise": work the roadmap — track dates & completion per action.
//  • mode="ho": the SAME roadmap, fully editable — add/edit/reorder milestones
//    and their actions (tasks) right on the map via popups. One surface, no form.
import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { Button, Card, Input, Select } from "@/components/ui";
import { LIGHT_PALETTE, PageHero } from "@/components/OperatorPage";
import {
  type MPhase, type MStep, type MStepLink, type MProgress, type StepState, type MPhaseWhen,
  WHEN_LABEL, WHEN_TONE, phaseDone, phasePct, phaseComplete, overallPct, currentPhaseIndex, phaseWindow, stepPct, dparse, fmtShort, isoDate,
} from "@/lib/milestones";
import { loadTemplate, saveTemplate, resetTemplate, loadProgress, saveProgress, seedProgress, newId } from "./data";

const move = <T,>(arr: T[], i: number, dir: -1 | 1): T[] => { const j = i + dir; if (j < 0 || j >= arr.length) return arr; const c = [...arr]; [c[i], c[j]] = [c[j], c[i]]; return c; };
const addDaysISO = (base: string | undefined, n: number) => { const d = base ? new Date(`${base}T00:00:00`) : new Date(); d.setDate(d.getDate() + n); return isoDate(d); };
const LEFT = "w-[168px] sm:w-[210px]";

// richer per-phase gradients
const GRAD: Record<MPhaseWhen, [string, string]> = { setup: ["#3a58cc", "#182a72"], before: ["#e08707", "#9a5206"], during: ["#12a862", "#0b6038"], after: ["#8b46f0", "#4c1d95"], clubs: ["#12b3c7", "#086a76"] };
const grad = (w: MPhaseWhen) => `linear-gradient(135deg, ${GRAD[w][0]}, ${GRAD[w][1]})`;
const gradBar = (w: MPhaseWhen) => `linear-gradient(90deg, ${GRAD[w][0]}, ${GRAD[w][1]})`;

export function MilestonesApp({ mode = "franchise" }: { mode?: "ho" | "franchise" }) {
  const [phases, setPhases] = useState<MPhase[]>([]);
  const [prog, setProg] = useState<MProgress | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [newSeason, setNewSeason] = useState(false);
  useEffect(() => { const t = loadTemplate(); setPhases(t); setProg(loadProgress(t)); }, []);
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2200); };
  const persistPhases = (p: MPhase[]) => { setPhases(p); saveTemplate(p); };
  const persistProg = (p: MProgress) => { setProg(p); saveProgress(p); };
  const preview = useMemo(() => seedProgress(phases), [phases]); // sample dates/progress for the HO builder

  if (!prog) return null;
  const startSeason = (name: string) => {
    const rec = new Set(phases.filter((p) => p.recurring).flatMap((p) => p.steps.map((s) => s.id)));
    const steps = Object.fromEntries(Object.entries(prog.steps).map(([id, st]) => [id, rec.has(id) ? { ...st, pct: 0 } : st]));
    persistProg({ ...prog, season: name, steps }); setNewSeason(false); flash(`New season: ${name} — recurring phases reset.`);
  };
  return (
    <div className="-m-3 min-h-[calc(100vh-3.5rem)] p-3 sm:-m-5 sm:p-5" style={LIGHT_PALETTE}>
      <PageHero title="Milestones" icon="📍" lede={mode === "ho"
        ? "Build the roadmap every franchise follows — add milestones and their tasks right on the map. Franchises see it live and track their own dates & progress."
        : "Your season roadmap — walk it milestone by milestone, or see the whole timeline. Set dates and completion as you go."} />
      {mode === "ho"
        ? <Roadmap phases={phases} prog={preview} onProg={() => {}} editable onTemplate={persistPhases} onReset={() => { resetTemplate(); const t = loadTemplate(); setPhases(t); flash("Reset to the default plan."); }} flash={flash} />
        : <Roadmap phases={phases} prog={prog} onProg={persistProg} onNewSeason={() => setNewSeason(true)} />}
      {newSeason && <NewSeason current={prog.season} onSave={startSeason} onClose={() => setNewSeason(false)} />}
      {toast && <div className="fixed bottom-5 left-1/2 z-[150] max-w-[92vw] -translate-x-1/2 rounded-2xl bg-[#111634] px-4 py-2.5 text-center text-[12.5px] font-bold text-white shadow-xl">{toast}</div>}
    </div>
  );
}

// ── Roadmap (Slides + Gantt, editable-aware) ─────────────────────────────────
function Roadmap({ phases, prog, onProg, onNewSeason, editable = false, onTemplate, onReset, flash }: { phases: MPhase[]; prog: MProgress; onProg: (p: MProgress) => void; onNewSeason?: () => void; editable?: boolean; onTemplate?: (p: MPhase[]) => void; onReset?: () => void; flash?: (m: string) => void }) {
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
  const [view, setView] = useState<"slides" | "roadmap">("slides");
  const [idx, setIdx] = useState(currentPhaseIndex(phases, prog));
  const [open, setOpen] = useState<string | null>(phases[currentPhaseIndex(phases, prog)]?.id ?? null);
  const [editPhase, setEditPhase] = useState<MPhase | null>(null);
  const [editAction, setEditAction] = useState<{ p: MPhase; s: MStep } | null>(null);
  const setStep = (id: string, patch: Partial<StepState>) => onProg({ ...prog, steps: { ...prog.steps, [id]: { ...(prog.steps[id] || { pct: 0 }), ...patch } } });

  // template mutators
  const setStepMeta = (pid: string, sid: string, patch: Partial<MStep>) => onTemplate?.(phases.map((p) => p.id === pid ? { ...p, steps: p.steps.map((s) => s.id === sid ? { ...s, ...patch } : s) } : p));
  const addPhase = () => { const np: MPhase = { id: newId(), title: "New milestone", subtitle: "", when: "before", recurring: true, icon: "📌", steps: [] }; onTemplate?.([...phases, np]); setIdx(phases.length); setEditPhase(np); };
  const addAction = (p: MPhase) => { const ns: MStep = { id: newId(), title: "New task", detail: "", links: [] }; onTemplate?.(phases.map((x) => x.id === p.id ? { ...x, steps: [...x.steps, ns] } : x)); setEditAction({ p, s: ns }); };
  const delPhase = (id: string) => onTemplate?.(phases.filter((p) => p.id !== id));
  const delStep = (pid: string, sid: string) => onTemplate?.(phases.map((p) => p.id === pid ? { ...p, steps: p.steps.filter((s) => s.id !== sid) } : p));

  const grid = () => (<>
    {ticks.map((t, i) => <div key={i} className="absolute inset-y-0 w-px" style={{ left: `${xp(t)}%`, background: "#e7ecf5" }} />)}
    <div className="absolute inset-y-0 w-0.5" style={{ left: `${xp(today)}%`, background: "#0e749077" }} />
  </>);

  return (
    <Card className="mt-4 w-full overflow-hidden p-0">
      <div className="h-1.5" style={{ background: "linear-gradient(90deg,#1d3a8f,#6d28d9,#0e7490)" }} />
      {/* header */}
      <div className="flex flex-wrap items-center gap-3 border-b border-[var(--line)] px-4 py-3">
        <MiniRing pct={overall} />
        <div>
          <div className="text-[15px] font-extrabold text-[var(--ink)]" style={{ fontFamily: "var(--ff-display)" }}>{editable ? "Roadmap builder" : "Season roadmap"}</div>
          <div className="text-[11.5px] text-[var(--ink-3)]">{editable ? `${phases.length} milestones · ${totalSteps} tasks` : `${prog.season} · ${doneSteps}/${totalSteps} tasks complete`}</div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <div className="inline-flex rounded-lg bg-[var(--panel)] p-0.5">
            {([["slides", "🎞 Slides"], ["roadmap", "▦ Timeline"]] as const).map(([k, l]) => (
              <button key={k} type="button" onClick={() => setView(k)} className={`rounded-md px-2.5 py-1 text-[11.5px] font-bold ${view === k ? "bg-white text-[#1d3a8f] shadow-sm" : "text-[var(--ink-2)]"}`}>{l}</button>
            ))}
          </div>
          {editable ? <Button onClick={onReset}>Reset</Button> : <Button onClick={onNewSeason} className="ml-1">＋ New season</Button>}
        </div>
      </div>

      {view === "slides" && <Slides phases={phases} prog={prog} idx={idx} setIdx={setIdx} editable={editable}
        onEditAction={(p, s) => setEditAction({ p, s })} onEditPhase={(p) => setEditPhase(p)} onAddAction={addAction} onAddPhase={addPhase} />}

      {view === "roadmap" && (<>
        {/* month axis */}
        <div className="flex items-end px-4 pt-3">
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
                <div className="flex items-stretch">
                  <div className={`${LEFT} flex shrink-0 items-center gap-2 py-2.5 pr-2`}>
                    <button type="button" onClick={() => setOpen(isOpen ? null : p.id)} className="w-3 text-[10px] text-[var(--ink-3)]">{isOpen ? "▾" : "▸"}</button>
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[15px]" style={{ background: tone + "18" }}>{p.icon}</span>
                    <button type="button" onClick={() => (editable ? setEditPhase(p) : setOpen(isOpen ? null : p.id))} className="min-w-0 flex-1 text-left"><span className="block truncate text-[12.5px] font-bold text-[var(--ink)]">{p.title}</span><span className="block text-[10px] text-[var(--ink-3)]">{win ? `${fmtShort(isoDate(win.start))} – ${fmtShort(isoDate(win.end))}` : "no dates yet"}</span></button>
                    <span className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-extrabold tabular-nums" style={{ background: done ? "#e6f4ea" : tone + "14", color: done ? "#0f7a43" : tone }}>{done ? "✓" : `${pc}%`}</span>
                  </div>
                  <div className="relative flex-1 py-2.5">
                    {grid()}
                    {win ? (
                      <div className="absolute top-1/2 h-7 -translate-y-1/2 overflow-hidden rounded-lg" style={{ left: `${xp(win.start)}%`, width: `${Math.max(xp(win.end) - xp(win.start), 1.5)}%`, background: tone + "22", boxShadow: `inset 0 0 0 1px ${tone}44` }}>
                        <div className="h-full transition-[width] duration-500" style={{ width: `${pc}%`, background: gradBar(p.when) }} />
                      </div>
                    ) : <div className="absolute left-0 top-1/2 -translate-y-1/2 text-[10px] italic text-[var(--ink-3)]">— add dates to the tasks —</div>}
                  </div>
                </div>
                {isOpen && p.steps.map((s) => { const st = prog.steps[s.id]; const sp = stepPct(prog, s.id); const a = dparse(st?.start), b = dparse(st?.end); const sdone = sp >= 100;
                  return (
                    <div key={s.id} className="flex items-stretch border-t border-dashed border-[var(--line)]">
                      <button type="button" onClick={() => setEditAction({ p, s })} className={`${LEFT} flex shrink-0 items-center gap-1.5 py-2 pl-6 pr-2 text-left hover:bg-[var(--panel)]`}>
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: sdone ? "#0f7a43" : tone }} />
                        <span className="min-w-0 flex-1 truncate text-[11.5px] text-[var(--ink-2)]">{s.title}</span>
                        <span className="shrink-0 text-[9.5px] font-bold tabular-nums text-[var(--ink-3)]">{sp}%</span>
                      </button>
                      <div className="relative flex-1 py-2">
                        {grid()}
                        {a && b ? (
                          <button type="button" onClick={() => setEditAction({ p, s })} title={`${s.title} · ${fmtShort(st?.start)}–${fmtShort(st?.end)} · ${sp}%`} className="absolute top-1/2 flex h-5 -translate-y-1/2 items-center overflow-hidden rounded-md" style={{ left: `${xp(a)}%`, width: `${Math.max(xp(b) - xp(a), 1)}%`, background: tone + "24", boxShadow: `inset 0 0 0 1px ${tone}55` }}>
                            <div className="h-full transition-[width]" style={{ width: `${sp}%`, background: gradBar(p.when) }} />
                          </button>
                        ) : <button type="button" onClick={() => setEditAction({ p, s })} className="absolute left-0 top-1/2 -translate-y-1/2 rounded-md bg-[var(--panel)] px-2 py-0.5 text-[9.5px] font-bold text-[var(--ink-3)] hover:text-[var(--ink)]">＋ set dates</button>}
                      </div>
                    </div>
                  );
                })}
                {isOpen && editable && <button type="button" onClick={() => addAction(p)} className="ml-6 py-1.5 text-[11.5px] font-bold text-[#1d3a8f] hover:underline">＋ Add task</button>}
              </div>
            );
          })}
          {editable && <button type="button" onClick={addPhase} className="mt-3 w-full rounded-xl border border-dashed border-[var(--line)] py-2 text-[12px] font-bold text-[#1d3a8f] hover:border-[#1d3a8f]">＋ Add milestone</button>}
        </div>
      </>)}

      {editPhase && <PhaseEditor phase={editPhase} phases={phases} onChange={(patch) => onTemplate?.(phases.map((p) => p.id === editPhase.id ? { ...p, ...patch } : p))} onMove={(dir) => { const i = phases.findIndex((p) => p.id === editPhase.id); onTemplate?.(move(phases, i, dir)); }} onDelete={() => { delPhase(editPhase.id); setEditPhase(null); flash?.("Milestone removed."); }} onClose={() => setEditPhase(null)} />}
      {editAction && <ActionEditor phase={editAction.p} step={editAction.s} state={prog.steps[editAction.s.id]}
        onMeta={editable ? (patch) => setStepMeta(editAction.p.id, editAction.s.id, patch) : undefined}
        onSchedule={editable ? undefined : (patch) => setStep(editAction.s.id, patch)}
        onDelete={editable ? () => { delStep(editAction.p.id, editAction.s.id); setEditAction(null); } : undefined}
        onClose={() => setEditAction(null)} />}
    </Card>
  );
}

// ── Slides — one milestone at a time ─────────────────────────────────────────
function Slides({ phases, prog, idx, setIdx, editable, onEditAction, onEditPhase, onAddAction, onAddPhase }: { phases: MPhase[]; prog: MProgress; idx: number; setIdx: (i: number) => void; editable: boolean; onEditAction: (p: MPhase, s: MStep) => void; onEditPhase: (p: MPhase) => void; onAddAction: (p: MPhase) => void; onAddPhase: () => void }) {
  const n = phases.length; const cur = Math.min(idx, Math.max(n - 1, 0));
  const p = phases[cur];
  return (
    <div className="p-4">
      {/* stepper */}
      <div className="overflow-x-auto pb-1">
        <div className="relative flex min-w-full items-start gap-1" style={{ width: n > 6 ? n * 96 : undefined }}>
          <div className="absolute left-[6%] right-[6%] top-6 h-1 rounded-full bg-[var(--panel)]" />
          <div className="absolute left-[6%] top-6 h-1 rounded-full transition-[width] duration-300" style={{ width: `${n > 1 ? (cur / (n - 1)) * 88 : 0}%`, background: "linear-gradient(90deg,#1d3a8f,#6d28d9)" }} />
          {phases.map((ph, i) => { const t = WHEN_TONE[ph.when]; const d = phaseComplete(ph, prog); const active = i === cur; const ppc = phasePct(ph, prog);
            return (
              <button key={ph.id} type="button" onClick={() => setIdx(i)} className="relative z-10 flex flex-1 flex-col items-center gap-1" style={{ minWidth: 84 }}>
                <span className="grid h-12 w-12 place-items-center rounded-full text-[19px] font-bold transition-transform" style={{ background: d ? grad(ph.when) : "#fff", color: d ? "#fff" : t, boxShadow: `0 3px 8px ${t}44, 0 0 0 3px #fff${active ? `, 0 0 0 5px ${t}` : ""}`, transform: active ? "scale(1.08)" : undefined }}>{d ? "✓" : ph.icon}</span>
                <span className="max-w-[90px] text-center text-[10px] font-bold leading-tight" style={{ color: active ? t : "var(--ink-2)" }}>{ph.title}</span>
                <span className="text-[9px] font-bold tabular-nums text-[var(--ink-3)]">{ppc}%</span>
              </button>
            );
          })}
          {editable && <button type="button" onClick={onAddPhase} className="relative z-10 flex flex-col items-center gap-1" style={{ minWidth: 64 }}><span className="grid h-12 w-12 place-items-center rounded-full border-2 border-dashed border-[var(--line)] text-[20px] text-[var(--ink-3)] hover:border-[#1d3a8f] hover:text-[#1d3a8f]">＋</span><span className="text-[9.5px] font-bold text-[var(--ink-3)]">Add</span></button>}
        </div>
      </div>

      {p && <Slide phase={p} prog={prog} cur={cur} n={n} editable={editable} onEditAction={onEditAction} onEditPhase={onEditPhase} onAddAction={onAddAction} onPrev={() => setIdx(Math.max(0, cur - 1))} onNext={() => setIdx(Math.min(n - 1, cur + 1))} onJump={setIdx} />}
    </div>
  );
}

function Slide({ phase: p, prog, cur, n, editable, onEditAction, onEditPhase, onAddAction, onPrev, onNext, onJump }: { phase: MPhase; prog: MProgress; cur: number; n: number; editable: boolean; onEditAction: (p: MPhase, s: MStep) => void; onEditPhase: (p: MPhase) => void; onAddAction: (p: MPhase) => void; onPrev: () => void; onNext: () => void; onJump: (i: number) => void }) {
  const tone = WHEN_TONE[p.when]; const win = phaseWindow(p, prog); const pc = phasePct(p, prog); const done = phaseComplete(p, prog);
  return (<>
    <div className="mt-4 overflow-hidden rounded-2xl border shadow-sm" style={{ borderColor: tone + "40" }}>
      <div className="relative flex flex-wrap items-center gap-3 px-4 py-3.5" style={{ background: `linear-gradient(115deg, ${tone}1f, ${tone}08 60%, transparent)` }}>
        <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: grad(p.when) }} />
        <span className="grid h-12 w-12 place-items-center rounded-xl text-[24px] text-white shadow" style={{ background: grad(p.when) }}>{p.icon}</span>
        <div className="min-w-0">
          <div className="flex items-center gap-2"><span className="text-[16px] font-extrabold text-[var(--ink)]" style={{ fontFamily: "var(--ff-display)" }}>{p.title}</span><span className="rounded-full px-2 py-0.5 text-[10px] font-extrabold text-white" style={{ background: grad(p.when) }}>{done ? "Complete ✓" : `${pc}%`}</span>{editable && <button type="button" onClick={() => onEditPhase(p)} className="rounded-md px-1.5 py-0.5 text-[11px] font-bold text-[var(--ink-3)] hover:bg-white/70 hover:text-[var(--ink)]" title="Edit milestone">✎</button>}</div>
          <div className="text-[11.5px] text-[var(--ink-3)]">{p.subtitle || WHEN_LABEL[p.when]}{win ? ` · ${fmtShort(isoDate(win.start))} – ${fmtShort(isoDate(win.end))}` : ""}</div>
        </div>
        <span className="ml-auto text-[11px] font-bold text-[var(--ink-3)]">Milestone {cur + 1} of {n}</span>
      </div>
      <div className="h-1.5 bg-[var(--panel)]"><div className="h-full transition-[width] duration-500" style={{ width: `${pc}%`, background: gradBar(p.when) }} /></div>

      <div className="space-y-2 p-4">
        <div className="flex items-center gap-2"><div className="text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">{editable ? "Tasks" : "Actions"} ({phaseDone(p, prog)}/{p.steps.length} done)</div>{editable && <button type="button" onClick={() => onAddAction(p)} className="ml-auto rounded-lg bg-[var(--panel)] px-2 py-1 text-[11px] font-bold text-[#1d3a8f] hover:bg-[#e6ecfa]">＋ Add task</button>}</div>
        {p.steps.map((s) => { const st = prog.steps[s.id]; const sp = stepPct(prog, s.id); const sdone = sp >= 100;
          return (
            <div key={s.id} onClick={() => onEditAction(p, s)} className="cursor-pointer rounded-xl border p-3 transition-shadow hover:shadow-sm" style={{ borderColor: sdone ? tone + "40" : "var(--line)", background: sdone ? tone + "0a" : undefined }}>
              <div className="flex items-center gap-2.5">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold" style={{ background: sdone ? tone : "var(--panel)", color: sdone ? "#fff" : "transparent" }}>✓</span>
                <span className={`text-[13px] font-bold ${sdone ? "text-[var(--ink-3)] line-through" : "text-[var(--ink)]"}`}>{s.title}</span>
                <span className="ml-auto text-[10.5px] font-bold text-[var(--ink-3)]">{st?.start ? `${fmtShort(st.start)} – ${fmtShort(st.end)}` : "no dates"}</span>
              </div>
              {s.detail && <div className="mt-0.5 pl-[30px] text-[11px] text-[var(--ink-3)]">{s.detail}</div>}
              <div className="mt-1.5 flex items-center gap-2 pl-[30px]"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--panel)]"><div className="h-full rounded-full transition-[width]" style={{ width: `${sp}%`, background: gradBar(p.when) }} /></div><span className="text-[10px] font-bold tabular-nums text-[var(--ink-3)]">{sp}%</span></div>
              {!!s.links?.length && <div className="mt-1.5 flex flex-wrap gap-1.5 pl-[30px]">{s.links.map((l) => <Link key={l.href + l.label} href={l.href} onClick={(e) => e.stopPropagation()} className="rounded-lg px-2 py-0.5 text-[10.5px] font-bold text-white hover:opacity-90" style={{ background: grad(p.when) }}>{l.label} →</Link>)}</div>}
            </div>
          );
        })}
        {p.steps.length === 0 && <div className="py-2 text-center text-[12px] text-[var(--ink-3)]">No {editable ? "tasks" : "actions"} in this milestone yet.{editable ? " Use “＋ Add task”." : ""}</div>}
      </div>
    </div>

    <div className="mt-3 flex items-center justify-between">
      <Button onClick={onPrev} disabled={cur === 0}>← Previous</Button>
      <div className="flex gap-1">{Array.from({ length: n }).map((_, i) => <button key={i} type="button" onClick={() => onJump(i)} className="h-2 rounded-full transition-all" style={{ width: i === cur ? 18 : 8, background: i === cur ? tone : "var(--line)" }} />)}</div>
      <Button variant="primary" onClick={onNext} disabled={cur === n - 1}>Next →</Button>
    </div>
  </>);
}

function MiniRing({ pct }: { pct: number }) {
  const r = 17, c = 2 * Math.PI * r;
  return (
    <div className="relative grid h-12 w-12 shrink-0 place-items-center">
      <svg width="48" height="48" className="-rotate-90"><defs><linearGradient id="mile-ring" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#1d3a8f" /><stop offset="1" stopColor="#0e7490" /></linearGradient></defs><circle cx="24" cy="24" r={r} fill="none" stroke="var(--panel)" strokeWidth="5" /><circle cx="24" cy="24" r={r} fill="none" stroke="url(#mile-ring)" strokeWidth="5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} style={{ transition: "stroke-dashoffset .5s ease" }} /></svg>
      <span className="absolute text-[12px] font-extrabold text-[var(--ink)]">{pct}%</span>
    </div>
  );
}

// ── Popups ───────────────────────────────────────────────────────────────────
function PhaseEditor({ phase, phases, onChange, onMove, onDelete, onClose }: { phase: MPhase; phases: MPhase[]; onChange: (patch: Partial<MPhase>) => void; onMove: (dir: -1 | 1) => void; onDelete: () => void; onClose: () => void }) {
  const tone = WHEN_TONE[phase.when]; const i = phases.findIndex((p) => p.id === phase.id);
  return (
    <div className="fixed inset-0 z-[145] flex items-start justify-center overflow-y-auto bg-black/45 p-4 pt-[12vh]" onClick={onClose} style={LIGHT_PALETTE}>
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-xl text-[18px] text-white" style={{ background: grad(phase.when) }}>{phase.icon}</span><h3 className="text-[15px] font-extrabold text-[var(--ink)]">Edit milestone</h3><button type="button" onClick={onClose} className="ml-auto text-[18px] text-[var(--ink-3)]">×</button></div>
        <div className="grid gap-2.5">
          <div className="flex gap-2"><label className="block w-16"><span className="mb-1 block text-[10px] font-extrabold uppercase text-[var(--ink-3)]">Icon</span><Input value={phase.icon} onChange={(e) => onChange({ icon: e.target.value })} className="w-full text-center text-[18px]" /></label><label className="block flex-1"><span className="mb-1 block text-[10px] font-extrabold uppercase text-[var(--ink-3)]">Title</span><Input value={phase.title} onChange={(e) => onChange({ title: e.target.value })} className="w-full font-bold" /></label></div>
          <label className="block"><span className="mb-1 block text-[10px] font-extrabold uppercase text-[var(--ink-3)]">Description</span><Input value={phase.subtitle || ""} onChange={(e) => onChange({ subtitle: e.target.value })} placeholder="Short description" className="w-full text-[12.5px]" /></label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block"><span className="mb-1 block text-[10px] font-extrabold uppercase text-[var(--ink-3)]">Stage</span><Select value={phase.when} onChange={(e) => onChange({ when: e.target.value as MPhaseWhen })} className="w-full text-[12px]">{(Object.keys(WHEN_LABEL) as MPhaseWhen[]).map((w) => <option key={w} value={w}>{WHEN_LABEL[w]}</option>)}</Select></label>
            <label className="flex items-end gap-1.5 pb-1.5 text-[11.5px] font-bold text-[var(--ink-2)]"><input type="checkbox" checked={phase.recurring} onChange={(e) => onChange({ recurring: e.target.checked })} /> resets each season</label>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <button type="button" onClick={onDelete} className="text-[12px] font-bold text-[var(--ink-3)] hover:text-[#c0392b]">Delete</button>
          <div className="ml-auto flex gap-1.5">
            <Button onClick={() => onMove(-1)} disabled={i <= 0}>← Move</Button>
            <Button onClick={() => onMove(1)} disabled={i >= phases.length - 1}>Move →</Button>
            <Button variant="primary" onClick={onClose}>Done</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ActionEditor({ phase, step, state, onMeta, onSchedule, onDelete, onClose }: { phase: MPhase; step: MStep; state?: StepState; onMeta?: (patch: Partial<MStep>) => void; onSchedule?: (patch: Partial<StepState>) => void; onDelete?: () => void; onClose: () => void }) {
  const tone = WHEN_TONE[phase.when];
  const start = state?.start || ""; const end = state?.end || ""; const pct = state?.pct ?? 0;
  const links = step.links || [];
  return (
    <div className="fixed inset-0 z-[145] flex items-start justify-center overflow-y-auto bg-black/45 p-4 pt-[10vh]" onClick={onClose} style={LIGHT_PALETTE}>
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-center gap-2"><span className="rounded-md px-1.5 py-0.5 text-[10px] font-extrabold uppercase text-white" style={{ background: grad(phase.when) }}>{phase.title}</span><button type="button" onClick={onClose} className="ml-auto text-[18px] text-[var(--ink-3)]">×</button></div>

        {onMeta ? (<>
          <label className="block"><span className="mb-1 block text-[10px] font-extrabold uppercase text-[var(--ink-3)]">Task</span><Input value={step.title} onChange={(e) => onMeta({ title: e.target.value })} className="w-full text-[14px] font-bold" /></label>
          <label className="mt-2 block"><span className="mb-1 block text-[10px] font-extrabold uppercase text-[var(--ink-3)]">Detail</span><textarea value={step.detail || ""} onChange={(e) => onMeta({ detail: e.target.value })} rows={2} placeholder="What good looks like…" className="w-full rounded-lg border border-[var(--line)] p-2 text-[12.5px]" /></label>
          <div className="mt-2"><span className="mb-1 block text-[10px] font-extrabold uppercase text-[var(--ink-3)]">Deep links</span>
            <div className="flex flex-wrap items-center gap-1.5">
              {links.map((l: MStepLink, li: number) => (
                <span key={li} className="inline-flex items-center gap-1 rounded-lg bg-[var(--panel)] px-1.5 py-0.5">
                  <input value={l.label} onChange={(e) => onMeta({ links: links.map((x, k) => k === li ? { ...x, label: e.target.value } : x) })} placeholder="Label" className="w-16 bg-transparent text-[10.5px] font-bold text-[#1d3a8f] outline-none" />
                  <input value={l.href} onChange={(e) => onMeta({ links: links.map((x, k) => k === li ? { ...x, href: e.target.value } : x) })} placeholder="/franchise/…" className="w-28 bg-transparent text-[10px] text-[var(--ink-3)] outline-none" />
                  <button type="button" onClick={() => onMeta({ links: links.filter((_, k) => k !== li) })} className="text-[12px] text-[var(--ink-3)] hover:text-[#c0392b]">×</button>
                </span>
              ))}
              <button type="button" onClick={() => onMeta({ links: [...links, { label: "Open", href: "/franchise/" }] })} className="text-[11px] font-bold text-[#1d3a8f] hover:underline">+ link</button>
            </div>
          </div>
        </>) : <h3 className="text-[15px] font-extrabold text-[var(--ink)]">{step.title}</h3>}

        {onSchedule && (<>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <label className="block"><span className="mb-1 block text-[10px] font-extrabold uppercase text-[var(--ink-3)]">Start</span><Input type="date" value={start} onChange={(e) => onSchedule({ start: e.target.value, end: end || addDaysISO(e.target.value, 7) })} className="w-full" /></label>
            <label className="block"><span className="mb-1 block text-[10px] font-extrabold uppercase text-[var(--ink-3)]">Target end</span><Input type="date" value={end} onChange={(e) => onSchedule({ end: e.target.value, start: start || addDaysISO(e.target.value, -7) })} className="w-full" /></label>
          </div>
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between text-[10px] font-extrabold uppercase text-[var(--ink-3)]"><span>Completion</span><span className="tabular-nums" style={{ color: tone }}>{pct}%</span></div>
            <input type="range" min={0} max={100} step={5} value={pct} onChange={(e) => onSchedule({ pct: Number(e.target.value) })} className="w-full" style={{ accentColor: tone }} />
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--panel)]"><div className="h-full rounded-full transition-[width]" style={{ width: `${pct}%`, background: gradBar(phase.when) }} /></div>
          </div>
        </>)}

        <div className="mt-4 flex items-center gap-2">
          {onDelete && <button type="button" onClick={onDelete} className="text-[12px] font-bold text-[var(--ink-3)] hover:text-[#c0392b]">Delete task</button>}
          <div className="ml-auto flex gap-2">
            {onSchedule && <Button onClick={() => onSchedule({ pct: 100 })}>Mark done</Button>}
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
        <p className="mb-3 text-[12px] text-[var(--ink-3)]">The recurring phases reset to 0% so you can work them again. One-time phases keep their progress. Currently: <b>{current}</b>.</p>
        <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">Season name</span><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Summer 2026" className="w-full" /></label>
        <div className="mt-3 flex justify-end gap-2"><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!name.trim()} onClick={() => onSave(name.trim())}>Start season</Button></div>
      </div>
    </div>
  );
}

export default MilestonesApp;
