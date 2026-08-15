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

// ── Franchise live journey map ───────────────────────────────────────────────
const MILE_CSS = `
@keyframes mile-pulse { 0%,100% { box-shadow: 0 0 0 0 var(--g) } 50% { box-shadow: 0 0 0 10px transparent } }
@keyframes mile-bob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-4px) } }
@keyframes mile-pop { 0% { transform: scale(.5); opacity: 0 } 60% { transform: scale(1.15) } 100% { transform: scale(1); opacity: 1 } }
@keyframes mile-fall { 0% { transform: translateY(-12px) rotate(0); opacity: 1 } 100% { transform: translateY(70px) rotate(220deg); opacity: 0 } }
@media (prefers-reduced-motion: reduce) { .mile-anim { animation: none !important } }`;

function FranchiseTimeline({ phases, prog, onProg, onNewSeason }: { phases: MPhase[]; prog: MProgress; onProg: (p: MProgress) => void; onNewSeason: () => void }) {
  const overall = overallPct(phases, prog);
  const hereIdx = currentPhaseIndex(phases, prog);
  const doneCount = phases.filter((p) => phaseComplete(p, prog)).length;
  const [selId, setSelId] = useState<string | null>(null);
  const sel = phases.find((p) => p.id === selId) || phases[hereIdx] || phases[0];
  const toggle = (p: MPhase, stepId: string) => {
    const key = p.recurring ? "doneSeason" : "doneOneTime"; const set = new Set(prog[key]);
    set.has(stepId) ? set.delete(stepId) : set.add(stepId);
    onProg({ ...prog, [key]: [...set] });
  };
  const cheer = overall === 100 ? "Season smashed — you legend! 🏆" : overall >= 75 ? "Nearly there — final push!" : overall >= 40 ? "Great momentum — keep going!" : overall > 0 ? "You're off the mark — nice!" : "Let's get your season rolling!";
  if (!sel) return null;
  const selTone = WHEN_TONE[sel.when]; const selDone = phaseComplete(sel, prog);

  return (
    <>
      <style>{MILE_CSS}</style>

      {/* hero */}
      <div className="mt-4 overflow-hidden rounded-3xl p-5 text-white shadow-lg" style={{ background: "linear-gradient(120deg,#1d3a8f 0%,#3b3aa8 48%,#0e7490 100%)" }}>
        <div className="flex flex-wrap items-center gap-4">
          <HeroRing pct={overall} />
          <div className="min-w-[200px] flex-1">
            <div className="text-[11px] font-bold uppercase tracking-wide text-white/70">Your season adventure · {prog.season}</div>
            <div className="text-[20px] font-extrabold leading-tight" style={{ fontFamily: "var(--ff-display)" }}>{cheer}</div>
            <div className="mt-1 text-[12.5px] text-white/85">{doneCount} of {phases.length} phases complete · next up: <b>{phases[hereIdx]?.title || "all done"}</b></div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <button type="button" onClick={onNewSeason} className="rounded-full bg-white/15 px-3.5 py-1.5 text-[12px] font-extrabold text-white ring-1 ring-white/25 hover:bg-white/25">＋ New season</button>
            <div className="flex gap-1.5">{phases.map((p) => { const c = phaseComplete(p, prog); return <span key={p.id} title={p.title} className={`grid h-8 w-8 place-items-center rounded-full text-[14px] ${c ? "mile-anim" : ""}`} style={{ background: c ? "rgba(255,255,255,.95)" : "rgba(255,255,255,.12)", animation: c ? "mile-pop .4s ease" : undefined }}>{c ? "🏅" : <span className="opacity-50">{p.icon}</span>}</span>; })}</div>
          </div>
        </div>
      </div>

      {/* the trail */}
      <div className="mt-4 overflow-x-auto pb-2">
        <div className="relative flex gap-3 px-6 pt-7" style={{ minWidth: Math.max(phases.length * 128, 320) }}>
          <div className="absolute left-8 right-8 top-[52px] h-2 rounded-full bg-[var(--panel)]" />
          <div className="absolute left-8 top-[52px] h-2 rounded-full transition-[width] duration-500" style={{ width: `calc((100% - 4rem) * ${overall / 100})`, background: "linear-gradient(90deg,#1d3a8f,#0e7490)" }} />
          {phases.map((p, i) => { const done = phaseComplete(p, prog); const here = i === hereIdx && !done; const tone = WHEN_TONE[p.when]; const active = sel.id === p.id; const pct = phasePct(p, prog);
            return (
              <button key={p.id} type="button" onClick={() => setSelId(p.id)} className="relative z-10 flex flex-1 flex-col items-center gap-1.5">
                {here && <span className="mile-anim absolute -top-6 text-[16px]" style={{ animation: "mile-bob 1.4s ease-in-out infinite" }}>🚩</span>}
                <span className="mile-anim grid h-12 w-12 place-items-center rounded-full text-[19px] font-bold transition-transform" style={{ background: done ? tone : "#fff", color: done ? "#fff" : tone, boxShadow: `0 2px 6px ${tone}44${active ? `, 0 0 0 3px #fff, 0 0 0 6px ${tone}` : ""}`, ["--g" as string]: `${tone}66`, animation: here ? "mile-pulse 1.8s infinite" : undefined, transform: active ? "scale(1.08)" : undefined }}>{done ? "✓" : p.icon}</span>
                <span className={`text-center text-[11px] font-extrabold leading-tight ${active ? "text-[var(--ink)]" : "text-[var(--ink-2)]"}`} style={{ color: active ? tone : undefined }}>{p.title}</span>
                <span className="rounded-full bg-[var(--panel)] px-1.5 text-[9.5px] font-bold text-[var(--ink-3)] tabular-nums">{pct}%</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* selected phase panel */}
      <div className="mt-2 overflow-hidden rounded-2xl border-2 bg-white shadow-sm" style={{ borderColor: selTone + "40" }}>
        <div className="flex flex-wrap items-center gap-2 px-4 py-3" style={{ background: selTone + "0f" }}>
          <span className="grid h-10 w-10 place-items-center rounded-xl text-[20px]" style={{ background: selTone + "1f" }}>{sel.icon}</span>
          <div className="min-w-0"><div className="text-[16px] font-extrabold text-[var(--ink)]">{sel.title}</div>{sel.subtitle && <div className="text-[12px] text-[var(--ink-3)]">{sel.subtitle}</div>}</div>
          <div className="ml-auto flex items-center gap-2">
            <span className="rounded-full px-2 py-0.5 text-[9.5px] font-extrabold uppercase" style={{ background: selTone + "1f", color: selTone }}>{WHEN_LABEL[sel.when]}</span>
            {sel.recurring && <span className="rounded-full bg-[var(--panel)] px-2 py-0.5 text-[9.5px] font-bold text-[var(--ink-3)]">↻ each season</span>}
          </div>
        </div>

        {selDone && (
          <div className="relative mx-4 mt-3 overflow-hidden rounded-xl px-3 py-2.5 text-center text-[13px] font-extrabold text-white" style={{ background: selTone }}>
            🎉 Phase complete — brilliant work!
            {[8, 24, 42, 60, 78, 92].map((x, k) => <span key={x} className="mile-anim absolute top-0 h-1.5 w-1.5 rounded-sm" style={{ left: `${x}%`, background: ["#ffd84d", "#fff", "#7fe0c2"][k % 3], animation: `mile-fall 1.1s ${k * 0.12}s ease-in` }} />)}
          </div>
        )}

        <div className="p-4">
          <div className="mb-2.5 flex items-center gap-2"><div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--panel)]"><div className="h-full rounded-full transition-[width]" style={{ width: `${phasePct(sel, prog)}%`, background: selTone }} /></div><span className="text-[11px] font-bold tabular-nums text-[var(--ink-3)]">{phaseDone(sel, prog)}/{sel.steps.length}</span></div>
          <div className="space-y-1.5">{sel.steps.map((s) => { const on = isStepDone(sel, s.id, prog); return (
            <div key={s.id} className={`flex items-start gap-2.5 rounded-xl border p-2.5 transition-colors ${on ? "border-transparent" : "border-[var(--line)]"}`} style={{ background: on ? selTone + "0d" : undefined }}>
              <button type="button" onClick={() => toggle(sel, s.id)} className={`mile-anim mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-[12px] font-bold ${on ? "text-white" : "bg-[var(--panel)] text-transparent hover:text-[var(--ink-3)]"}`} style={{ background: on ? selTone : undefined, animation: on ? "mile-pop .3s ease" : undefined }}>✓</button>
              <div className="min-w-0 flex-1">
                <div className={`text-[12.5px] font-bold ${on ? "text-[var(--ink-3)] line-through" : "text-[var(--ink)]"}`}>{s.title}</div>
                {s.detail && <div className="text-[11px] text-[var(--ink-3)]">{s.detail}</div>}
                {!!s.links?.length && <div className="mt-1 flex flex-wrap gap-1.5">{s.links.map((l) => <Link key={l.href + l.label} href={l.href} className="rounded-lg px-2 py-0.5 text-[10.5px] font-bold text-white hover:opacity-90" style={{ background: selTone }}>{l.label} →</Link>)}</div>}
              </div>
            </div>
          ); })}{sel.steps.length === 0 && <div className="py-3 text-center text-[12px] text-[var(--ink-3)]">No steps in this phase yet.</div>}</div>
        </div>
      </div>
    </>
  );
}

function HeroRing({ pct }: { pct: number }) {
  const r = 26, c = 2 * Math.PI * r;
  return (
    <div className="relative grid h-[76px] w-[76px] shrink-0 place-items-center">
      <svg width="76" height="76" className="-rotate-90"><circle cx="38" cy="38" r={r} fill="none" stroke="rgba(255,255,255,.25)" strokeWidth="8" /><circle cx="38" cy="38" r={r} fill="none" stroke="#fff" strokeWidth="8" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} style={{ transition: "stroke-dashoffset .6s ease" }} /></svg>
      <span className="absolute text-[18px] font-extrabold text-white">{pct}%</span>
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
