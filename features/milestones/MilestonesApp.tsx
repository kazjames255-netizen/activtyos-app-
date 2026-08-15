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
@keyframes mile-spin { to { transform: rotate(360deg) } }
@keyframes mile-drift { 0%,100% { transform: translateX(0) } 50% { transform: translateX(16px) } }
@keyframes mile-sway { 0%,100% { transform: rotate(-2deg) } 50% { transform: rotate(2deg) } }
@keyframes mile-draw { to { stroke-dashoffset: 0 } }
.mile-svg text { font-family: var(--ff-display), system-ui, sans-serif }
@media (prefers-reduced-motion: reduce) { .mile-anim, .mile-svg [style*="animation"] { animation: none !important } }`;

// little SVG scenery pieces
function Pine({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (<g transform={`translate(${x} ${y}) scale(${s})`} style={{ transformOrigin: `${x}px ${y}px` }}>
    <rect x={-3} y={4} width={6} height={12} rx={2} fill="#8a5a2b" />
    <polygon points="0,-26 14,2 -14,2" fill="#3f8f5f" /><polygon points="0,-16 12,10 -12,10" fill="#4fa06a" /><polygon points="0,-6 10,18 -10,18" fill="#5cb277" />
  </g>);
}
function Cloud({ x, y, s = 1, delay = 0 }: { x: number; y: number; s?: number; delay?: number }) {
  return (<g transform={`translate(${x} ${y}) scale(${s})`} style={{ animation: `mile-drift ${9 + delay}s ease-in-out ${delay}s infinite` }} opacity={0.92}>
    <ellipse cx={0} cy={0} rx={22} ry={13} fill="#fff" /><ellipse cx={18} cy={4} rx={16} ry={11} fill="#fff" /><ellipse cx={-16} cy={4} rx={14} ry={10} fill="#fff" />
  </g>);
}

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

      {/* the illustrated adventure map */}
      <AdventureMap phases={phases} prog={prog} hereIdx={hereIdx} overall={overall} selId={sel.id} onSelect={setSelId} />

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

// Illustrated adventure map — phases as signposts along a winding trail through
// a hand-drawn landscape (sky, sun, clouds, hills, trees, summit).
function AdventureMap({ phases, prog, hereIdx, overall, selId, onSelect, compact = false }: { phases: MPhase[]; prog: MProgress; hereIdx: number; overall: number; selId: string; onSelect: (id: string) => void; compact?: boolean }) {
  const W = 480, padTop = 118, rowH = 150, padBottom = 150;
  const n = phases.length;
  const pts = phases.map((_, i) => ({ x: i % 2 === 0 ? 122 : 358, y: padTop + i * rowH }));
  const finish = { x: 240, y: padTop + (n - 1) * rowH + padBottom };
  const all = [...pts, finish];
  const H = finish.y + 40;
  let d = `M ${all[0].x} ${all[0].y}`;
  for (let i = 1; i < all.length; i++) { const midY = (all[i - 1].y + all[i].y) / 2; d += ` C ${all[i - 1].x} ${midY} ${all[i].x} ${midY} ${all[i].x} ${all[i].y}`; }
  const done100 = overall === 100;
  // deterministic scenery placement
  const trees = [[26, 0.2], [458, 0.31], [34, 0.47], [452, 0.58], [24, 0.72], [456, 0.83]].map(([x, f]) => ({ x, y: f * H, s: 0.8 + ((x * 7 + f * 13) % 5) / 10 }));
  const ridges = [0.14, 0.4, 0.66].map((f) => f * H);

  return (
    <div className="relative mx-auto mt-4 w-full overflow-hidden rounded-[26px]" style={{ maxWidth: compact ? W : W + 60, boxShadow: "0 10px 30px rgba(20,40,90,.14), inset 0 0 0 1px rgba(255,255,255,.5)" }}>
      <div className="relative mx-auto w-full" style={{ maxWidth: W }}>
        <svg viewBox={`0 0 ${W} ${H}`} className="mile-svg block h-auto w-full" aria-hidden>
          <defs>
            <linearGradient id="mile-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#bfe3ff" /><stop offset="0.28" stopColor="#dcefff" /><stop offset="0.5" stopColor="#e9f6df" /><stop offset="1" stopColor="#cdeeb8" /></linearGradient>
            <linearGradient id="mile-trail" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3b6fe0" /><stop offset="1" stopColor="#0e9488" /></linearGradient>
            <radialGradient id="mile-sung" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stopColor="#ffe27a" /><stop offset="1" stopColor="#ffc93c" /></radialGradient>
          </defs>

          {/* sky + meadow */}
          <rect x="0" y="0" width={W} height={H} fill="url(#mile-sky)" />
          {/* sun */}
          <g style={{ transformOrigin: "70px 74px", animation: "mile-spin 60s linear infinite" }}>{Array.from({ length: 12 }).map((_, k) => { const a = (k * Math.PI) / 6; return <line key={k} x1={70 + Math.cos(a) * 30} y1={74 + Math.sin(a) * 30} x2={70 + Math.cos(a) * 40} y2={74 + Math.sin(a) * 40} stroke="#ffd451" strokeWidth="4" strokeLinecap="round" />; })}</g>
          <circle cx="70" cy="74" r="24" fill="url(#mile-sung)" />
          {/* clouds */}
          <Cloud x={330} y={70} s={1} delay={0} /><Cloud x={200} y={128} s={0.8} delay={2} /><Cloud x={410} y={150} s={0.7} delay={4} />
          {/* rolling ridges for depth */}
          {ridges.map((ry, k) => <path key={k} d={`M 0 ${ry} Q 120 ${ry - 34} 240 ${ry} T 480 ${ry} V ${H} H 0 Z`} fill={["#bfe6a8", "#a9dc93", "#93d17e"][k]} opacity={0.5 - k * 0.08} />)}
          {/* trees */}
          {trees.map((t, k) => <Pine key={k} x={t.x} y={t.y} s={t.s} />)}
          {/* summit behind finish */}
          <g><polygon points={`${finish.x - 78},${finish.y + 20} ${finish.x},${finish.y - 84} ${finish.x + 78},${finish.y + 20}`} fill="#8ea2c4" /><polygon points={`${finish.x - 26},${finish.y - 40} ${finish.x},${finish.y - 84} ${finish.x + 26},${finish.y - 40} ${finish.x + 10},${finish.y - 46} ${finish.x - 2},${finish.y - 36} ${finish.x - 14},${finish.y - 46}`} fill="#fff" /></g>

          {/* the trail */}
          <path d={d} fill="none" stroke="#ffffff" strokeWidth="15" strokeLinecap="round" opacity="0.55" />
          <path d={d} fill="none" stroke="#e7d3a8" strokeWidth="11" strokeLinecap="round" />
          <path d={d} fill="none" stroke="#c79a5c" strokeWidth="11" strokeLinecap="round" strokeDasharray="0.1 20" opacity="0.65" />
          <path d={d} fill="none" stroke="url(#mile-trail)" strokeWidth="7" strokeLinecap="round" pathLength={100} strokeDasharray={100} strokeDashoffset={100 - overall} style={{ transition: "stroke-dashoffset .8s ease" }} />
        </svg>

        {/* START banner */}
        <div className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${(pts[0].x / W) * 100}%`, top: `${((pts[0].y - 44) / H) * 100}%` }}><span className="rounded-full bg-white/90 px-2.5 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wide text-[#1d3a8f] shadow ring-1 ring-black/5">⛳ Start</span></div>

        {/* phase signposts */}
        {phases.map((p, i) => { const { x, y } = pts[i]; const done = phaseComplete(p, prog); const here = i === hereIdx && !done; const tone = WHEN_TONE[p.when]; const active = selId === p.id; const pct = phasePct(p, prog); const left = x < W / 2;
          return (
            <div key={p.id} className="absolute" style={{ left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%`, transform: "translate(-50%,-50%)" }}>
              {here && <span className="absolute -top-8 left-1/2 -translate-x-1/2 text-[20px]" style={{ animation: "mile-bob 1.4s ease-in-out infinite" }}>🥾</span>}
              <button type="button" onClick={() => onSelect(p.id)} aria-label={p.title} className="mile-anim relative grid h-[52px] w-[52px] place-items-center rounded-full text-[21px] font-bold transition-transform" style={{ background: done ? tone : "#fff", color: done ? "#fff" : tone, boxShadow: `0 4px 10px ${tone}55, 0 0 0 4px #fff${active ? `, 0 0 0 7px ${tone}` : ""}`, ["--g" as string]: `${tone}66`, animation: here ? "mile-pulse 1.8s infinite" : undefined, transform: active ? "scale(1.12)" : undefined }}>
                {done ? "✓" : p.icon}
                {done && <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-white text-[9px]" style={{ color: tone }}>★</span>}
              </button>
              {/* signpost label */}
              <div className={`absolute top-1/2 w-[120px] -translate-y-1/2 ${left ? "left-[62px] text-left" : "right-[62px] text-right"}`}>
                <div className={`inline-block max-w-full rounded-lg bg-white/92 px-2 py-1 shadow-sm ring-1 ring-black/5 ${active ? "ring-2" : ""}`} style={{ ["--tw-ring-color" as string]: active ? tone : undefined }}>
                  <div className="truncate text-[11.5px] font-extrabold leading-tight" style={{ color: active ? tone : "var(--ink)" }}>{p.title}</div>
                  <div className="text-[9px] font-bold uppercase tracking-wide" style={{ color: tone }}>{done ? "Done ✓" : `${pct}%`}</div>
                </div>
              </div>
            </div>
          );
        })}

        {/* FINISH */}
        <div className="absolute" style={{ left: `${(finish.x / W) * 100}%`, top: `${(finish.y / H) * 100}%`, transform: "translate(-50%,-50%)" }}>
          <div className={`grid h-[54px] w-[54px] place-items-center rounded-full text-[26px] ${done100 ? "mile-anim" : ""}`} style={{ background: done100 ? "linear-gradient(135deg,#ffd24d,#f59e0b)" : "#fff", boxShadow: done100 ? "0 6px 18px #f59e0b77, 0 0 0 4px #fff" : "0 4px 10px #64748b33, 0 0 0 4px #fff", animation: done100 ? "mile-pop .5s ease" : undefined }}>{done100 ? "🏆" : "🏁"}</div>
          <div className="absolute left-1/2 top-full mt-1 w-36 -translate-x-1/2 text-center text-[11.5px] font-extrabold" style={{ color: done100 ? "#b45309" : "var(--ink-2)" }}>{done100 ? "Season conquered!" : "Reach the summit"}</div>
        </div>
      </div>
    </div>
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
  const [showPreview, setShowPreview] = useState(true);
  const [selId, setSelId] = useState<string | null>(null);
  // demo progress so the preview looks alive: 1st phase done, 2nd half-done
  const demoProg = useMemo<MProgress>(() => {
    const oneTime: string[] = [], season: string[] = [];
    phases.forEach((p, i) => { if (i === 0) (p.recurring ? season : oneTime).push(...p.steps.map((s) => s.id)); else if (i === 1) (p.recurring ? season : oneTime).push(...p.steps.slice(0, Math.ceil(p.steps.length / 2)).map((s) => s.id)); });
    return { season: "Preview", doneSeason: season, doneOneTime: oneTime };
  }, [phases]);
  const demoOverall = overallPct(phases, demoProg);
  const demoHere = currentPhaseIndex(phases, demoProg);
  return (
    <>
      <div className="mt-4 mb-3 flex flex-wrap items-center gap-2">
        <span className="text-[12px] text-[var(--ink-3)]">{phases.length} phases · {totalSteps} steps. This is the adventure map every franchise sees.</span>
        <div className="ml-auto flex gap-2">
          <Button onClick={() => setShowPreview((v) => !v)}>{showPreview ? "Hide preview" : "👀 Preview map"}</Button>
          <Button onClick={onReset}>Reset to default</Button>
          <Button variant="primary" onClick={() => onChange([...phases, { id: newId(), title: "New phase", subtitle: "", when: "before", recurring: true, icon: "📌", steps: [] }])}>＋ Add phase</Button>
        </div>
      </div>

      {showPreview && phases.length > 0 && (
        <div className="mb-4 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-3">
          <div className="mb-1 flex items-center gap-2"><span className="rounded-full bg-[#1d3a8f] px-2 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wide text-white">Live preview</span><span className="text-[11.5px] text-[var(--ink-3)]">Exactly what a franchise sees — edits below update it instantly.</span></div>
          <AdventureMap phases={phases} prog={demoProg} hereIdx={demoHere} overall={demoOverall} selId={selId ?? ""} onSelect={setSelId} compact />
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
