"use client";

// Milestones — a phased operational timeline for franchises.
//  • mode="franchise": the live timeline a franchise works through, with progress
//    that resets each season on the recurring phases.
//  • mode="ho": the head-office editor for the master template every franchise sees.
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button, Card, Input, Select } from "@/components/ui";
import { LIGHT_PALETTE, PageHero } from "@/components/OperatorPage";
import {
  type MPhase, type MStep, type MProgress, type MPhaseWhen,
  WHEN_LABEL, WHEN_TONE, isStepDone, phaseDone, phasePct, phaseComplete, overallPct, currentPhaseIndex,
} from "@/lib/milestones";
import { loadTemplate, saveTemplate, resetTemplate, loadProgress, saveProgress, newId } from "./data";

const move = <T,>(arr: T[], i: number, dir: -1 | 1): T[] => { const j = i + dir; if (j < 0 || j >= arr.length) return arr; const c = [...arr]; [c[i], c[j]] = [c[j], c[i]]; return c; };

export function MilestonesApp({ mode = "franchise" }: { mode?: "ho" | "franchise" }) {
  const [phases, setPhases] = useState<MPhase[]>([]);
  const [prog, setProg] = useState<MProgress | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [newSeason, setNewSeason] = useState(false);
  useEffect(() => { setPhases(loadTemplate()); setProg(loadProgress()); }, []);
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2200); };
  const persistPhases = (p: MPhase[]) => { setPhases(p); saveTemplate(p); };
  const persistProg = (p: MProgress) => { setProg(p); saveProgress(p); };

  if (!prog) return null;
  return (
    <div className="-m-3 min-h-[calc(100vh-3.5rem)] p-3 sm:-m-5 sm:p-5" style={LIGHT_PALETTE}>
      <PageHero title="Milestones" icon="📍" lede={mode === "ho"
        ? "The master plan every franchise follows — a phased timeline from launch through each camp season and into clubs. Edit the phases and steps; franchises see it as their live checklist."
        : "Your step-by-step timeline — from getting set up, through packing and running each camp, to wrapping up and starting clubs. Tick things off as you go."} />
      {mode === "ho"
        ? <HOEditor phases={phases} onChange={persistPhases} onReset={() => { resetTemplate(); setPhases(loadTemplate()); flash("Reset to the default plan."); }} flash={flash} />
        : <FranchiseTimeline phases={phases} prog={prog} onProg={persistProg} onNewSeason={() => setNewSeason(true)} />}
      {newSeason && <NewSeason current={prog.season} onSave={(name) => { persistProg({ ...prog, season: name, doneSeason: [] }); setNewSeason(false); flash(`New season: ${name}. Recurring phases reset.`); }} onClose={() => setNewSeason(false)} />}
      {toast && <div className="fixed bottom-5 left-1/2 z-[150] max-w-[92vw] -translate-x-1/2 rounded-2xl bg-[#111634] px-4 py-2.5 text-center text-[12.5px] font-bold text-white shadow-xl">{toast}</div>}
    </div>
  );
}

// ── Franchise live timeline ──────────────────────────────────────────────────
function FranchiseTimeline({ phases, prog, onProg, onNewSeason }: { phases: MPhase[]; prog: MProgress; onProg: (p: MProgress) => void; onNewSeason: () => void }) {
  const overall = overallPct(phases, prog);
  const hereIdx = currentPhaseIndex(phases, prog);
  const toggle = (p: MPhase, stepId: string) => {
    const key = p.recurring ? "doneSeason" : "doneOneTime"; const set = new Set(prog[key]);
    set.has(stepId) ? set.delete(stepId) : set.add(stepId);
    onProg({ ...prog, [key]: [...set] });
  };
  return (
    <>
      {/* progress header */}
      <Card className="mt-4 flex flex-wrap items-center gap-4 p-4">
        <Ring pct={overall} />
        <div className="min-w-[180px] flex-1">
          <div className="text-[13px] font-extrabold text-[var(--ink)]">You&rsquo;re {overall}% through your Milestones</div>
          <div className="text-[11.5px] text-[var(--ink-3)]">Next up: <b className="text-[var(--ink-2)]">{phases[hereIdx]?.title || "all done — nice work"}</b></div>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-[var(--panel)] px-3 py-2">
          <div><div className="text-[9px] font-extrabold uppercase text-[var(--ink-3)]">Current season</div><div className="text-[12.5px] font-bold text-[var(--ink)]">{prog.season}</div></div>
          <Button onClick={onNewSeason} className="ml-1">＋ New season</Button>
        </div>
      </Card>

      {/* timeline */}
      <div className="mt-4">
        {phases.map((p, i) => { const done = phaseComplete(p, prog); const pct = phasePct(p, prog); const here = i === hereIdx && !done; const tone = WHEN_TONE[p.when]; const last = i === phases.length - 1;
          return (
            <div key={p.id} className="flex gap-3">
              {/* rail */}
              <div className="flex w-9 shrink-0 flex-col items-center">
                <div className="grid h-9 w-9 place-items-center rounded-full text-[15px] font-bold shadow-sm ring-1" style={{ background: done ? tone : "#fff", color: done ? "#fff" : tone, boxShadow: here ? `0 0 0 3px ${tone}33` : undefined }}>{done ? "✓" : p.icon}</div>
                {!last && <div className="w-0.5 flex-1" style={{ background: done ? tone : "var(--line)" }} />}
              </div>
              {/* card */}
              <div className={`mb-3 flex-1 rounded-2xl border bg-white p-4 ${here ? "border-[color:var(--tone)]" : "border-[var(--line)]"}`} style={{ ["--tone" as string]: tone }}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full px-2 py-0.5 text-[9.5px] font-extrabold uppercase" style={{ background: tone + "18", color: tone }}>{WHEN_LABEL[p.when]}</span>
                  {p.recurring && <span className="rounded-full bg-[var(--panel)] px-2 py-0.5 text-[9.5px] font-bold text-[var(--ink-3)]">↻ resets each season</span>}
                  {here && <span className="rounded-full px-2 py-0.5 text-[9.5px] font-extrabold text-white" style={{ background: tone }}>You are here</span>}
                  <span className="ml-auto text-[11px] font-bold tabular-nums text-[var(--ink-3)]">{phaseDone(p, prog)}/{p.steps.length}</span>
                </div>
                <div className="mt-1.5 text-[15px] font-extrabold text-[var(--ink)]">{p.title}</div>
                {p.subtitle && <div className="text-[12px] text-[var(--ink-3)]">{p.subtitle}</div>}
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--panel)]"><div className="h-full rounded-full transition-[width]" style={{ width: `${pct}%`, background: tone }} /></div>
                <div className="mt-2.5 space-y-1.5">{p.steps.map((s) => { const on = isStepDone(p, s.id, prog); return (
                  <div key={s.id} className="flex items-start gap-2.5 rounded-xl border border-[var(--line)] p-2.5">
                    <button type="button" onClick={() => toggle(p, s.id)} className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md text-[11px] font-bold ${on ? "text-white" : "bg-[var(--panel)] text-transparent hover:text-[var(--ink-3)]"}`} style={{ background: on ? tone : undefined }}>✓</button>
                    <div className="min-w-0 flex-1">
                      <div className={`text-[12.5px] font-bold ${on ? "text-[var(--ink-3)] line-through" : "text-[var(--ink)]"}`}>{s.title}</div>
                      {s.detail && <div className="text-[11px] text-[var(--ink-3)]">{s.detail}</div>}
                      {!!s.links?.length && <div className="mt-1 flex flex-wrap gap-1.5">{s.links.map((l) => <Link key={l.href + l.label} href={l.href} className="rounded-lg bg-[var(--panel)] px-2 py-0.5 text-[10.5px] font-bold text-[#1d3a8f] hover:bg-[#e2e8f4]">{l.label} →</Link>)}</div>}
                    </div>
                  </div>
                ); })}</div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function Ring({ pct }: { pct: number }) {
  const r = 22, c = 2 * Math.PI * r;
  return (
    <div className="relative grid h-16 w-16 place-items-center">
      <svg width="64" height="64" className="-rotate-90"><circle cx="32" cy="32" r={r} fill="none" stroke="var(--panel)" strokeWidth="7" /><circle cx="32" cy="32" r={r} fill="none" stroke="#1d3a8f" strokeWidth="7" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} /></svg>
      <span className="absolute text-[13px] font-extrabold text-[var(--ink)]">{pct}%</span>
    </div>
  );
}

function NewSeason({ current, onSave, onClose }: { current: string; onSave: (name: string) => void; onClose: () => void }) {
  const [name, setName] = useState("");
  return (
    <div className="fixed inset-0 z-[140] flex items-start justify-center overflow-y-auto bg-black/45 p-4 pt-[16vh]" onClick={onClose} style={LIGHT_PALETTE}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-1 text-[15px] font-extrabold text-[var(--ink)]">Start a new season</h3>
        <p className="mb-3 text-[12px] text-[var(--ink-3)]">The recurring phases (plan / run / wrap) reset so you can work the checklist fresh. One-time phases stay ticked. Currently: <b>{current}</b>.</p>
        <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">Season name</span><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Summer 2026" className="w-full" /></label>
        <div className="mt-3 flex justify-end gap-2"><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!name.trim()} onClick={() => onSave(name.trim())}>Start season</Button></div>
      </div>
    </div>
  );
}

// ── Head-office master template editor ───────────────────────────────────────
function HOEditor({ phases, onChange, onReset, flash }: { phases: MPhase[]; onChange: (p: MPhase[]) => void; onReset: () => void; flash: (m: string) => void }) {
  const setPhase = (id: string, patch: Partial<MPhase>) => onChange(phases.map((p) => p.id === id ? { ...p, ...patch } : p));
  const setStep = (pid: string, sid: string, patch: Partial<MStep>) => onChange(phases.map((p) => p.id === pid ? { ...p, steps: p.steps.map((s) => s.id === sid ? { ...s, ...patch } : s) } : p));
  const totalSteps = phases.reduce((a, p) => a + p.steps.length, 0);
  return (
    <>
      <div className="mt-4 mb-3 flex flex-wrap items-center gap-2">
        <span className="text-[12px] text-[var(--ink-3)]">{phases.length} phases · {totalSteps} steps. This is what every franchise sees as their live timeline.</span>
        <div className="ml-auto flex gap-2">
          <Button onClick={onReset}>Reset to default</Button>
          <Button variant="primary" onClick={() => onChange([...phases, { id: newId(), title: "New phase", subtitle: "", when: "before", recurring: true, icon: "📌", steps: [] }])}>＋ Add phase</Button>
        </div>
      </div>
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
                <Input value={s.title} onChange={(e) => setStep(p.id, s.id, { title: e.target.value })} placeholder="Step" className="flex-1 text-[12.5px] font-semibold" />
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
          <button type="button" onClick={() => setPhase(p.id, { steps: [...p.steps, { id: newId(), title: "New step", detail: "", links: [] }] })} className="mt-2 text-[12px] font-bold text-[#1d3a8f] hover:underline">+ Add step</button>
        </Card>
      ))}</div>
    </>
  );
}

export default MilestonesApp;
