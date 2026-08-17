"use client";

// Milestones — an editable, dated operational roadmap for franchises.
//  • mode="franchise": work the roadmap — track dates & completion per action.
//  • mode="ho": the SAME roadmap, fully editable — add/edit/reorder milestones
//    and their actions (tasks) right on the map via popups. One surface, no form.
import { useMemo, useState, useEffect, useRef } from "react";
import Link from "next/link";
import { get as apiGet, post as apiPost } from "@/lib/api";
import { Button, Card, Input, Select } from "@/components/ui";
import { LIGHT_PALETTE, PageHero } from "@/components/OperatorPage";
import {
  type MPhase, type MStep, type MStepLink, type MAction, type MProgress, type StepState, type ActState, type MPhaseWhen,
  WHEN_LABEL, WHEN_TONE, phaseDone, phasePct, phaseComplete, overallPct, currentPhaseIndex, phaseWindow, stepPct, stepPctEff, actState, actionsDone, dparse, fmtShort, isoDate,
} from "@/lib/milestones";
import { loadTemplate, saveTemplate, resetTemplate, loadProgress, saveProgress, seedProgress, newId, loadHistory, pushHistory } from "./data";
import { DEMO_STAFF } from "@/features/learning/credentials";
import { useSettings } from "@/lib/settings";

const STAFF = ["Alex Rivera", "Sam Carter", "Jamie Cole", ...DEMO_STAFF.map((s) => s.name)];
const initials = (n: string) => n.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").slice(0, 2).toUpperCase();

const move = <T,>(arr: T[], i: number, dir: -1 | 1): T[] => { const j = i + dir; if (j < 0 || j >= arr.length) return arr; const c = [...arr]; [c[i], c[j]] = [c[j], c[i]]; return c; };
const addDaysISO = (base: string | undefined, n: number) => { const d = base ? new Date(`${base}T00:00:00`) : new Date(); d.setDate(d.getDate() + n); return isoDate(d); };
const LEFT = "w-[168px] sm:w-[210px]";

// richer per-phase gradients
const GRAD: Record<MPhaseWhen, [string, string]> = { setup: ["#3a58cc", "#182a72"], before: ["#e08707", "#9a5206"], during: ["#12a862", "#0b6038"], after: ["#8b46f0", "#4c1d95"], clubs: ["#12b3c7", "#086a76"] };
const grad = (w: MPhaseWhen) => `linear-gradient(135deg, ${GRAD[w][0]}, ${GRAD[w][1]})`;
const gradBar = (w: MPhaseWhen) => `linear-gradient(90deg, ${GRAD[w][0]}, ${GRAD[w][1]})`;

// traffic-light ramp across the milestones (first red → last always dark green)
const RAMP = ["#e5484d", "#f2820c", "#e8a300", "#7cb342", "#16a34a"];
const rampColor = (i: number, n: number) => (n <= 1 ? "#0f7a43" : i === n - 1 ? "#0f7a43" : RAMP[Math.min(RAMP.length - 1, Math.round((i / (n - 1)) * (RAMP.length - 1)))]);
const rampGrad = (i: number, n: number) => { const c = rampColor(i, n); return `linear-gradient(135deg, ${c}, ${c}cc)`; };

// ── item 1: bespoke duotone icon set per phase (retire the emoji) ────────────
const ICON_PATHS: Record<MPhaseWhen, string> = {
  setup: "M12 3c3 1.5 5 4.5 5 8l-2.2 2.2-3.6-3.6L13 7.5C12 5.8 11 4.2 12 3ZM9.4 11.6 12.4 14.6l-2 2-1-.6-.7 1.7-1.4-1.4 1.7-.7-.6-1ZM7 15c-1.4.6-2 3-2 3s2.4-.6 3-2Z",
  before: "M4 8l8-4 8 4-8 4-8-4Zm0 0v8l8 4 8-4V8M12 12v8",
  during: "M12 4 3 19h18L12 4Zm0 5 4.5 8h-9L12 9Zm0 4v4",
  after: "M4 20V6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v14M8 16v-4m4 4V9m4 7v-2",
  clubs: "M12 3 3 8v2h18V8L12 3Zm-6 9v6m4-6v6m4-6v6m4-6v6M4 20h16",
};
function PhaseIcon({ when, className = "", strokeWidth = 1.7 }: { when: MPhaseWhen; className?: string; strokeWidth?: number }) {
  return <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={ICON_PATHS[when]} /></svg>;
}

// ── item 14: count-up ────────────────────────────────────────────────────────
function useCountUp(target: number, ms = 600) {
  const [v, setV] = useState(target); const from = useRef(target);
  useEffect(() => {
    const start = from.current, delta = target - start; if (delta === 0) { setV(target); return; }
    let raf = 0; const t0 = performance.now();
    const tick = (t: number) => { const k = Math.min(1, (t - t0) / ms); const e = 1 - Math.pow(1 - k, 3); setV(Math.round(start + delta * e)); if (k < 1) raf = requestAnimationFrame(tick); else from.current = target; };
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

// ── item 9: urgency colour on dates ──────────────────────────────────────────
function dueMeta(iso?: string, done?: boolean): { text: string; tone: string } | null {
  if (!iso) return null;
  const d = Math.round((new Date(`${iso}T00:00:00`).getTime() - Date.now()) / 86400000);
  if (done) return { text: fmtShort(iso), tone: "#0f7a43" };
  if (d < 0) return { text: `${-d}d overdue`, tone: "#c0392b" };
  if (d === 0) return { text: "Due today", tone: "#b45309" };
  if (d <= 3) return { text: `Due in ${d}d`, tone: "#b45309" };
  return { text: fmtShort(iso), tone: "#7a8095" };
}

// ── item 17: celebration confetti (respects reduced motion via CSS) ──────────
const MILE_FX = `@keyframes mfx-fall{0%{transform:translateY(-8px) rotate(0);opacity:1}100%{transform:translateY(90px) rotate(300deg);opacity:0}}
@keyframes mfx-in{0%{opacity:0;transform:translateY(6px) scale(.99)}100%{opacity:1;transform:none}}
.mfx-slide{animation:mfx-in .32s ease}
@media(prefers-reduced-motion:reduce){.mfx-slide,[data-fx]{animation:none!important}}`;
function Confetti({ tone }: { tone: MPhaseWhen }) {
  const cols = [GRAD[tone][0], "#ffd24d", "#12a862", "#8b46f0"];
  return <div className="pointer-events-none absolute inset-x-0 top-0 h-0">{Array.from({ length: 14 }).map((_, i) => <span key={i} data-fx className="absolute top-0 h-2 w-1.5 rounded-sm" style={{ left: `${(i * 7 + 4) % 100}%`, background: cols[i % 4], animation: `mfx-fall ${0.9 + (i % 5) * 0.12}s ${(i % 6) * 0.05}s ease-in forwards` }} />)}</div>;
}

// ── item 18: branded "Season plan" export (print-to-PDF) ─────────────────────
function exportSeasonPlan(phases: MPhase[], prog: MProgress, provider: string) {
  const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] || c));
  const rows = phases.map((p) => {
    const win = phaseWindow(p, prog); const pc = phasePct(p, prog); const tone = WHEN_TONE[p.when];
    const tasks = p.steps.map((s) => { const st = prog.steps[s.id]; const sp = stepPctEff(s, prog); return `<tr><td>${esc(s.title)}</td><td>${st?.start ? fmtShort(st.start) + " – " + fmtShort(st.end) : "—"}</td><td class="r">${sp}%</td></tr>`; }).join("");
    return `<section><h2><span class="dot" style="background:${tone}"></span>${esc(p.title)} <b>${pc}%</b></h2><div class="sub">${win ? fmtShort(isoDate(win.start)) + " – " + fmtShort(isoDate(win.end)) : ""}</div><table>${tasks}</table></section>`;
  }).join("");
  const html = `<!doctype html><meta charset="utf8"><title>${esc(provider)} — Season plan</title><style>body{font:14px/1.5 -apple-system,system-ui,sans-serif;color:#15171e;max-width:720px;margin:32px auto;padding:0 20px}h1{font-size:26px;margin:0}.meta{color:#7a8095;font-size:12px;margin:2px 0 20px}section{break-inside:avoid;margin:18px 0;border:1px solid #e6e3dc;border-radius:12px;padding:12px 16px}h2{font-size:16px;margin:0;display:flex;align-items:center;gap:8px}h2 b{margin-left:auto;color:#4a4e59}.dot{width:10px;height:10px;border-radius:50%;display:inline-block}.sub{color:#868b97;font-size:11px;margin:2px 0 8px}table{width:100%;border-collapse:collapse;font-size:12.5px}td{padding:4px 0;border-top:1px solid #f0eee9}.r{text-align:right;font-variant-numeric:tabular-nums;color:#4a4e59}@media print{section{border-color:#ccc}}</style><h1>${esc(provider)}</h1><div class="meta">Season plan · ${esc(prog.season)} · ${overallPct(phases, prog)}% complete · generated ${new Date().toLocaleDateString("en-GB")}</div>${rows}<script>print()</script>`;
  const w = window.open("", "_blank"); if (w) { w.document.write(html); w.document.close(); }
}

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
    pushHistory({ season: prog.season, overall: overallPct(phases, prog), at: isoDate(new Date()) }); // item 20
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
        : <Roadmap phases={phases} prog={prog} onProg={persistProg} onNewSeason={() => setNewSeason(true)} onTemplate={persistPhases} flash={flash} />}
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
  const lastSeason = loadHistory()[0]; // item 20
  const [view, setView] = useState<"slides" | "roadmap">("slides");
  const [idx, setIdx] = useState(currentPhaseIndex(phases, prog));
  const [open, setOpen] = useState<string | null>(phases[currentPhaseIndex(phases, prog)]?.id ?? null);
  const [editPhase, setEditPhase] = useState<MPhase | null>(null);
  const [editAction, setEditAction] = useState<{ p: MPhase; s: MStep; mode: "meta" | "schedule" } | null>(null);
  const setStep = (id: string, patch: Partial<StepState>) => onProg({ ...prog, steps: { ...prog.steps, [id]: { ...(prog.steps[id] || { pct: 0 }), ...patch } } });
  const setAct = (stepId: string, actId: string, patch: Partial<ActState>) => { const cur = prog.steps[stepId] || { pct: 0 }; onProg({ ...prog, steps: { ...prog.steps, [stepId]: { ...cur, actions: { ...(cur.actions || {}), [actId]: { ...(cur.actions?.[actId] || {}), ...patch } } } } }); };
  const pushAction = async (step: MStep, action: MAction) => {
    const stA = prog.steps[step.id]?.actions?.[action.id] || {};
    try {
      const created = await apiPost<{ id: string }>("/api/tasks", { t: action.title, who: stA.assignee || undefined, due: stA.due || null, prio: "med", status: "todo", cat: "Milestones" });
      setAct(step.id, action.id, { taskId: created?.id || "queued" });
      flash?.("Added to the Task Manager.");
    } catch { flash?.("Couldn't reach the Task Manager."); }
  };
  const { settings } = useSettings();
  const provider = (settings as { providerName?: string }).providerName || "Your camps";
  const [me, setMe] = useState("");
  useEffect(() => { apiGet<{ name?: string }>("/api/me").then((m) => setMe(m?.name || "")).catch(() => {}); }, []);

  // template mutators
  const setStepMeta = (pid: string, sid: string, patch: Partial<MStep>) => onTemplate?.(phases.map((p) => p.id === pid ? { ...p, steps: p.steps.map((s) => s.id === sid ? { ...s, ...patch } : s) } : p));
  const addPhase = () => { const np: MPhase = { id: newId(), title: "New milestone", subtitle: "", when: "before", recurring: true, icon: "📌", steps: [] }; onTemplate?.([...phases, np]); setIdx(phases.length); setEditPhase(np); };
  const canEdit = !!onTemplate;
  const addAction = (p: MPhase) => { const ns: MStep = { id: newId(), title: "New task", detail: "", links: [] }; onTemplate?.(phases.map((x) => x.id === p.id ? { ...x, steps: [...x.steps, ns] } : x)); setEditAction({ p, s: ns, mode: "meta" }); };
  const delPhase = (id: string) => onTemplate?.(phases.filter((p) => p.id !== id));
  const delStep = (pid: string, sid: string) => onTemplate?.(phases.map((p) => p.id === pid ? { ...p, steps: p.steps.filter((s) => s.id !== sid) } : p));

  const grid = () => (<>
    {ticks.map((t, i) => <div key={i} className="absolute inset-y-0 w-px" style={{ left: `${xp(t)}%`, background: "#e7ecf5" }} />)}
    <div className="absolute inset-y-0 w-0.5" style={{ left: `${xp(today)}%`, background: "#0e749077" }} />
  </>);

  return (
    <Card className="mt-4 w-full overflow-hidden p-0">
      <style>{MILE_FX}</style>
      {/* header */}
      <div className="flex flex-wrap items-center gap-3 border-b border-[var(--line)] px-4 py-3">
        <MiniRing pct={overall} />
        <div>
          <div className="text-[15px] font-extrabold text-[var(--ink)]" style={{ fontFamily: "var(--ff-display)" }}>{editable ? "Roadmap builder" : "Season roadmap"}</div>
          <div className="flex items-center gap-1.5 text-[11.5px] tabular-nums text-[var(--ink-3)]">{editable ? `${phases.length} milestones · ${totalSteps} tasks` : `${prog.season} · ${doneSteps}/${totalSteps} tasks complete`}
            {!editable && lastSeason && <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold" style={{ background: overall >= lastSeason.overall ? "#e6f4ea" : "#fdecec", color: overall >= lastSeason.overall ? "#0f7a43" : "#c0392b" }} title={`Last season (${lastSeason.season}) finished at ${lastSeason.overall}%`}>{overall >= lastSeason.overall ? "▲" : "▼"} {Math.abs(overall - lastSeason.overall)}% vs last</span>}
          </div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <div className="inline-flex rounded-lg bg-[var(--panel)] p-0.5">
            {([["slides", "🎞 Slides"], ["roadmap", "▦ Timeline"]] as const).map(([k, l]) => (
              <button key={k} type="button" onClick={() => setView(k)} className={`rounded-md px-2.5 py-1 text-[11.5px] font-bold ${view === k ? "bg-white text-[#1d3a8f] shadow-sm" : "text-[var(--ink-2)]"}`}>{l}</button>
            ))}
          </div>
          {!editable && <Button onClick={() => exportSeasonPlan(phases, prog, provider)} title="Export a branded season plan">⬇ Export</Button>}
          {editable ? <Button onClick={onReset}>Reset</Button> : <Button onClick={onNewSeason}>＋ New season</Button>}
        </div>
      </div>

      {/* item 10: always-visible season mini-ribbon (traffic-light ramp) */}
      <div className="flex gap-1 px-4 pt-3">
        {phases.map((p, i) => { const pc = phasePct(p, prog); const done = phaseComplete(p, prog); const rc = rampColor(i, phases.length); return (
          <button key={p.id} type="button" onClick={() => { setView("slides"); setIdx(i); }} title={`${p.title} · ${pc}%`} className="relative h-2.5 flex-1 overflow-hidden rounded-full" style={{ background: rc + "26", outline: i === idx ? `2px solid ${rc}` : "none", outlineOffset: 1 }}>
            <span className="block h-full rounded-full transition-[width] duration-500" style={{ width: `${done ? 100 : pc}%`, background: `linear-gradient(90deg, ${rc}, ${rc}cc)` }} />
          </button>
        ); })}
      </div>

      {view === "slides" && <Slides phases={phases} prog={prog} idx={idx} setIdx={setIdx} editable={editable} canEdit={canEdit} me={me} provider={provider}
        onEditAction={(p, s) => setEditAction({ p, s, mode: "meta" })} onEditPhase={(p) => setEditPhase(p)} onAddAction={addAction} onAddPhase={addPhase}
        onSchedule={setStep} onActState={setAct} onPush={pushAction} />}

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
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg" style={{ background: tone + "18", color: tone }}><PhaseIcon when={p.when} className="h-4 w-4" /></span>
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
                {isOpen && p.steps.map((s) => { const st = prog.steps[s.id]; const sp = stepPctEff(s, prog); const a = dparse(st?.start), b = dparse(st?.end); const sdone = sp >= 100;
                  return (
                    <div key={s.id} className="flex items-stretch border-t border-dashed border-[var(--line)]">
                      <button type="button" onClick={() => setEditAction({ p, s, mode: editable ? "meta" : "schedule" })} className={`${LEFT} flex shrink-0 items-center gap-1.5 py-2 pl-6 pr-2 text-left hover:bg-[var(--panel)]`}>
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: sdone ? "#0f7a43" : tone }} />
                        <span className="min-w-0 flex-1 truncate text-[11.5px] text-[var(--ink-2)]">{s.title}</span>
                        <span className="shrink-0 text-[9.5px] font-bold tabular-nums text-[var(--ink-3)]">{sp}%</span>
                      </button>
                      <div className="relative flex-1 py-2">
                        {grid()}
                        {a && b ? (
                          <button type="button" onClick={() => setEditAction({ p, s, mode: editable ? "meta" : "schedule" })} title={`${s.title} · ${fmtShort(st?.start)}–${fmtShort(st?.end)} · ${sp}%`} className="absolute top-1/2 flex h-5 -translate-y-1/2 items-center overflow-hidden rounded-md" style={{ left: `${xp(a)}%`, width: `${Math.max(xp(b) - xp(a), 1)}%`, background: tone + "24", boxShadow: `inset 0 0 0 1px ${tone}55` }}>
                            <div className="h-full transition-[width]" style={{ width: `${sp}%`, background: gradBar(p.when) }} />
                          </button>
                        ) : <button type="button" onClick={() => setEditAction({ p, s, mode: editable ? "meta" : "schedule" })} className="absolute left-0 top-1/2 -translate-y-1/2 rounded-md bg-[var(--panel)] px-2 py-0.5 text-[9.5px] font-bold text-[var(--ink-3)] hover:text-[var(--ink)]">＋ set dates</button>}
                      </div>
                    </div>
                  );
                })}
                {isOpen && canEdit && <button type="button" onClick={() => addAction(p)} className="ml-6 py-1.5 text-[11.5px] font-bold text-[#1d3a8f] hover:underline">＋ Add task</button>}
              </div>
            );
          })}
          {canEdit && <button type="button" onClick={addPhase} className="mt-3 w-full rounded-xl border border-dashed border-[var(--line)] py-2 text-[12px] font-bold text-[#1d3a8f] hover:border-[#1d3a8f]">＋ Add milestone</button>}
        </div>
      </>)}

      {editPhase && <PhaseEditor phase={editPhase} phases={phases} onChange={(patch) => onTemplate?.(phases.map((p) => p.id === editPhase.id ? { ...p, ...patch } : p))} onMove={(dir) => { const i = phases.findIndex((p) => p.id === editPhase.id); onTemplate?.(move(phases, i, dir)); }} onDelete={() => { delPhase(editPhase.id); setEditPhase(null); flash?.("Milestone removed."); }} onClose={() => setEditPhase(null)} />}
      {editAction && (() => { const p = phases.find((x) => x.id === editAction.p.id) || editAction.p; const s = p.steps.find((x) => x.id === editAction.s.id) || editAction.s;
        const meta = editAction.mode === "meta";
        return <ActionEditor phase={p} step={s} state={prog.steps[s.id]}
          onMeta={meta ? (patch) => setStepMeta(p.id, s.id, patch) : undefined}
          onSchedule={meta ? undefined : (patch) => setStep(s.id, patch)}
          onActState={meta ? undefined : (aid, patch) => setAct(s.id, aid, patch)}
          onPush={meta ? undefined : (a) => pushAction(s, a)}
          onDelete={canEdit ? () => { delStep(p.id, s.id); setEditAction(null); } : undefined}
          onClose={() => setEditAction(null)} />;
      })()}
    </Card>
  );
}

// ── Slides — one milestone at a time ─────────────────────────────────────────
type Filter = "all" | "mine" | "overdue" | "unassigned";
interface SlideCbs { onEditAction: (p: MPhase, s: MStep) => void; onEditPhase: (p: MPhase) => void; onAddAction: (p: MPhase) => void; onSchedule: (stepId: string, patch: Partial<StepState>) => void; onActState: (stepId: string, actId: string, patch: Partial<ActState>) => void; onPush: (step: MStep, a: MAction) => void }

function Slides({ phases, prog, idx, setIdx, editable, canEdit, me, onAddPhase, ...cbs }: { phases: MPhase[]; prog: MProgress; idx: number; setIdx: (i: number) => void; editable: boolean; canEdit: boolean; me: string; provider: string; onAddPhase: () => void } & SlideCbs) {
  const n = phases.length; const cur = Math.min(idx, Math.max(n - 1, 0)); const p = phases[cur];
  const [filter, setFilter] = useState<Filter>("all");
  const activeRef = useRef<HTMLButtonElement>(null); const touch = useRef(0);
  useEffect(() => { activeRef.current?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" }); }, [cur]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { const el = document.activeElement; if (el && /INPUT|TEXTAREA|SELECT/.test(el.tagName)) return; if (e.key === "ArrowRight") setIdx(Math.min(n - 1, cur + 1)); if (e.key === "ArrowLeft") setIdx(Math.max(0, cur - 1)); };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, [cur, n, setIdx]);
  return (
    <div className="p-4">
      {/* item 15: sticky coin-node stepper */}
      <div className="sticky top-0 z-10 -mx-4 overflow-x-auto bg-white/95 px-4 pb-2 pt-1 backdrop-blur">
        <div className="relative flex min-w-full items-start gap-1" style={{ width: n > 6 ? n * 100 : undefined }}>
          <div className="absolute left-[6%] right-[6%] top-6 h-1 rounded-full bg-[var(--panel)]" />
          <div className="absolute left-[6%] top-6 h-1 rounded-full transition-[width] duration-300" style={{ width: `${n > 1 ? (cur / (n - 1)) * 88 : 0}%`, background: "linear-gradient(90deg,#1d3a8f,#6d28d9)" }} />
          {phases.map((ph, i) => { const rc = rampColor(i, n); const d = phaseComplete(ph, prog); const active = i === cur; const ppc = phasePct(ph, prog); const win = phaseWindow(ph, prog);
            return (
              <button key={ph.id} ref={active ? activeRef : undefined} type="button" onClick={() => setIdx(i)} className="relative z-10 flex flex-1 flex-col items-center gap-0.5" style={{ minWidth: 96 }}>
                {active && <span data-fx className="absolute -top-3 z-20 text-[13px]" style={{ animation: "mfx-in .3s ease" }}>📍</span>}
                <span className="relative grid h-12 w-12 place-items-center rounded-full transition-transform" style={{ background: d ? rampGrad(i, n) : "#fff", color: d ? "#fff" : rc, boxShadow: `inset 0 1px 1px rgba(255,255,255,.55), 0 4px 10px ${rc}55, 0 0 0 3px #fff, 0 0 0 ${active ? 6 : 3.5}px ${rc}${active ? "55" : "aa"}`, transform: active ? "scale(1.06)" : undefined }}>
                  {d ? <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg> : <span className="text-[19px] font-extrabold leading-none" style={{ fontFamily: "var(--ff-display)" }}>{i + 1}</span>}
                </span>
                <span className="mt-1 max-w-[96px] text-center text-[10px] font-bold leading-tight" style={{ color: active ? rc : "var(--ink-2)" }}>{ph.title}</span>
                <span className="text-[9px] font-semibold tabular-nums text-[var(--ink-3)]">{win ? `${fmtShort(isoDate(win.start))} – ${fmtShort(isoDate(win.end))}` : "no dates"}</span>
                <span className="text-[9.5px] font-extrabold tabular-nums" style={{ color: rc }}>{ppc}%</span>
              </button>
            );
          })}
          {canEdit && <button type="button" onClick={onAddPhase} className="relative z-10 flex flex-col items-center gap-1 pt-0" style={{ minWidth: 64 }}><span className="grid h-12 w-12 place-items-center rounded-full border-2 border-dashed border-[var(--line)] text-[20px] text-[var(--ink-3)] hover:border-[#1d3a8f] hover:text-[#1d3a8f]">＋</span><span className="text-[9.5px] font-bold text-[var(--ink-3)]">Add</span></button>}
        </div>
      </div>

      {/* item 19: filters + jump */}
      {!editable && (
        <div className="mb-1 mt-1 flex flex-wrap items-center gap-1.5">
          {([["all", "All"], ["mine", "My tasks"], ["overdue", "Overdue"], ["unassigned", "Unassigned"]] as [Filter, string][]).map(([k, l]) => (
            <button key={k} type="button" onClick={() => setFilter(k)} className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${filter === k ? "bg-[#1d3a8f] text-white" : "bg-[var(--panel)] text-[var(--ink-2)] hover:bg-[#e7ebf3]"}`}>{l}</button>
          ))}
          <select value={cur} onChange={(e) => setIdx(Number(e.target.value))} className="ml-auto rounded-lg border border-[var(--line)] bg-white px-2 py-1 text-[11px] font-bold text-[var(--ink-2)]" aria-label="Jump to milestone">{phases.map((ph, i) => <option key={ph.id} value={i}>Jump: {ph.title}</option>)}</select>
        </div>
      )}

      {/* item 13: animated slide + swipe */}
      <div key={cur} className="mfx-slide" onTouchStart={(e) => { touch.current = e.touches[0].clientX; }} onTouchEnd={(e) => { const dx = e.changedTouches[0].clientX - touch.current; if (dx < -50) setIdx(Math.min(n - 1, cur + 1)); if (dx > 50) setIdx(Math.max(0, cur - 1)); }}>
        {p && <Slide phase={p} prog={prog} cur={cur} n={n} editable={editable} canEdit={canEdit} me={me} filter={filter} {...cbs} onPrev={() => setIdx(Math.max(0, cur - 1))} onNext={() => setIdx(Math.min(n - 1, cur + 1))} onJump={setIdx} />}
      </div>
    </div>
  );
}

function Slide({ phase: p, prog, cur, n, editable, canEdit, me, filter, onEditAction, onEditPhase, onAddAction, onSchedule, onActState, onPush, onPrev, onNext, onJump }: { phase: MPhase; prog: MProgress; cur: number; n: number; editable: boolean; canEdit: boolean; me: string; filter: Filter; onPrev: () => void; onNext: () => void; onJump: (i: number) => void } & SlideCbs) {
  const tone = WHEN_TONE[p.when]; const win = phaseWindow(p, prog); const pc = phasePct(p, prog); const done = phaseComplete(p, prog);
  const [openStep, setOpenStep] = useState<string | null>(null);
  const now = Date.now(); const ts = (iso?: string) => (iso ? new Date(`${iso}T00:00:00`).getTime() : Infinity);
  // item 17: celebration
  const [celebrate, setCelebrate] = useState(false); const wasDone = useRef(done);
  useEffect(() => { if (done && !wasDone.current) { setCelebrate(true); const t = setTimeout(() => setCelebrate(false), 1900); wasDone.current = done; return () => clearTimeout(t); } wasDone.current = done; }, [done]);
  // items 7 & 11: attention counts + next-up over this milestone
  const open: { title: string; due?: string }[] = [];
  p.steps.forEach((s) => { const st = prog.steps[s.id]; const acts = s.actions || []; if (acts.length) acts.forEach((a) => { const x = st?.actions?.[a.id]; if (!x?.done) open.push({ title: a.title, due: x?.due }); }); else if (stepPctEff(s, prog) < 100) open.push({ title: s.title, due: st?.end }); });
  const overdue = open.filter((x) => x.due && ts(x.due) < now).length;
  const dueSoon = open.filter((x) => x.due && ts(x.due) >= now && (ts(x.due) - now) / 86400000 <= 7).length;
  const unassigned = p.steps.flatMap((s) => (s.actions || []).filter((a) => { const x = prog.steps[s.id]?.actions?.[a.id]; return !x?.assignee && !x?.done; })).length;
  const nextUp = [...open].filter((x) => x.due).sort((a, b) => a.due!.localeCompare(b.due!))[0] || open[0];
  // item 19: filter predicate
  const match = (s: MStep) => { if (filter === "all") return true; const st = prog.steps[s.id]; const acts = s.actions || [];
    if (filter === "mine") return acts.some((a) => st?.actions?.[a.id]?.assignee === me);
    if (filter === "overdue") return acts.length ? acts.some((a) => { const x = st?.actions?.[a.id]; return x?.due && !x.done && ts(x.due) < now; }) : (!!st?.end && stepPctEff(s, prog) < 100 && ts(st.end) < now);
    return acts.some((a) => !st?.actions?.[a.id]?.assignee); };
  const shown = p.steps.filter(match);
  const chip = "rounded-full px-2 py-0.5 text-[10px] font-extrabold";

  return (<>
    <div className="mt-3 overflow-hidden rounded-2xl border" style={{ borderColor: tone + "40", boxShadow: "0 1px 2px rgba(20,30,60,.05),0 14px 34px rgba(20,30,60,.08)" }}>
      <div className="relative flex flex-wrap items-center gap-3 px-4 py-3.5" style={{ background: `linear-gradient(115deg, ${tone}22, ${tone}08 55%, transparent)` }}>
        {celebrate && <Confetti tone={p.when} />}
        <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: grad(p.when) }} />
        <span className="grid h-12 w-12 place-items-center rounded-xl text-white shadow" style={{ background: grad(p.when) }}><PhaseIcon when={p.when} className="h-6 w-6" strokeWidth={1.9} /></span>
        <div className="min-w-0">
          <div className="flex items-center gap-2"><span className="text-[16px] font-extrabold text-[var(--ink)]" style={{ fontFamily: "var(--ff-display)" }}>{p.title}</span><span className="rounded-full px-2 py-0.5 text-[10px] font-extrabold tabular-nums text-white" style={{ background: grad(p.when) }}>{done ? "Complete ✓" : `${pc}%`}</span>{canEdit && <button type="button" onClick={() => onEditPhase(p)} className="rounded-md px-1.5 py-0.5 text-[11px] font-bold text-[var(--ink-3)] hover:bg-white/70 hover:text-[var(--ink)]" title="Edit milestone">✎ Edit</button>}</div>
          <div className="text-[11.5px] text-[var(--ink-3)]">{p.subtitle || WHEN_LABEL[p.when]}{win ? ` · ${fmtShort(isoDate(win.start))} – ${fmtShort(isoDate(win.end))}` : ""}</div>
        </div>
        <span className="ml-auto text-[11px] font-bold text-[var(--ink-3)]">Milestone {cur + 1} of {n}</span>
      </div>
      <div className="h-1.5 bg-[var(--panel)]"><div className="h-full transition-[width] duration-700" style={{ width: `${pc}%`, background: gradBar(p.when) }} /></div>

      {!editable && (overdue + dueSoon + unassigned > 0 || nextUp) && (
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] px-4 py-2">
          {overdue > 0 && <span className={chip} style={{ background: "#fdecec", color: "#c0392b" }}>⚠ {overdue} overdue</span>}
          {dueSoon > 0 && <span className={chip} style={{ background: "#fff4e5", color: "#b45309" }}>◷ {dueSoon} due ≤7d</span>}
          {unassigned > 0 && <span className={chip} style={{ background: "var(--panel)", color: "var(--ink-2)" }}>◔ {unassigned} unassigned</span>}
          {nextUp && <span className="ml-auto truncate text-[11px] text-[var(--ink-3)]">Next up: <b className="text-[var(--ink-2)]">{nextUp.title}</b>{nextUp.due ? ` · ${dueMeta(nextUp.due)?.text}` : ""}</span>}
        </div>
      )}

      {celebrate && <div className="mx-4 mt-3 flex items-center gap-2 rounded-xl px-3 py-2 text-[13px] font-extrabold text-white" style={{ background: grad(p.when) }}>🎉 Milestone complete!{cur < n - 1 && <button type="button" onClick={onNext} className="ml-auto rounded-full bg-white/20 px-2.5 py-1 text-[11px] hover:bg-white/30">Next milestone →</button>}</div>}

      <div className="space-y-2 p-4">
        <div className="flex items-center gap-2"><div className="text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Tasks ({phaseDone(p, prog)}/{p.steps.length} done)</div>{canEdit && <button type="button" onClick={() => onAddAction(p)} className="ml-auto rounded-lg bg-[var(--panel)] px-2 py-1 text-[11px] font-bold text-[#1d3a8f] hover:bg-[#e6ecfa]">＋ Add task</button>}</div>
        {shown.map((s) => { const st = prog.steps[s.id]; const sp = stepPctEff(s, prog); const sdone = sp >= 100; const acts = s.actions || [];
          const assignees = [...new Set(acts.map((a) => st?.actions?.[a.id]?.assignee).filter(Boolean) as string[])];
          const pushed = acts.filter((a) => st?.actions?.[a.id]?.taskId).length;
          const isOverdue = !sdone && (acts.length ? acts.some((a) => { const x = st?.actions?.[a.id]; return x?.due && !x.done && ts(x.due) < now; }) : (!!st?.end && ts(st.end) < now));
          const stateColor = sdone ? "#0f7a43" : isOverdue ? "#c0392b" : sp > 0 ? tone : "#b8bcc6";
          const expanded = openStep === s.id; const due = dueMeta(st?.end, sdone);
          return (
            <div key={s.id} className="rounded-xl border transition-shadow hover:shadow-sm" style={{ borderColor: sdone ? tone + "40" : isOverdue ? "#f3c9c9" : "var(--line)", background: sdone ? tone + "0a" : undefined, borderLeft: `3px solid ${stateColor}` }}>
              <div onClick={() => (editable ? onEditAction(p, s) : setOpenStep(expanded ? null : s.id))} className="cursor-pointer p-3">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold" style={{ background: sdone ? tone : "var(--panel)", color: sdone ? "#fff" : "transparent" }}>✓</span>
                  <span className={`text-[13px] font-bold ${sdone ? "text-[var(--ink-3)] line-through" : "text-[var(--ink)]"}`}>{s.title}</span>
                  {due ? <span className={`ml-auto ${chip}`} style={{ color: due.tone, background: due.tone + "18" }}>{due.text}</span> : <span className="ml-auto text-[10px] font-bold text-[var(--ink-3)]">no dates</span>}
                  {canEdit && <button type="button" onClick={(e) => { e.stopPropagation(); onEditAction(p, s); }} className="ml-1 rounded px-1 text-[11px] text-[var(--ink-3)] hover:text-[var(--ink)]" title="Edit task">✎</button>}
                  {!editable && <span className="ml-0.5 text-[10px] text-[var(--ink-3)]">{expanded ? "▲" : "▾"}</span>}
                </div>
                {s.detail && <div className="mt-0.5 pl-[30px] text-[11px] text-[var(--ink-3)]">{s.detail}</div>}
                <div className="mt-1.5 flex items-center gap-2 pl-[30px]"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--panel)]"><div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${sp}%`, background: gradBar(p.when) }} /></div><span className="text-[10px] font-bold tabular-nums text-[var(--ink-3)]">{sp}%</span></div>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 pl-[30px]">
                  {acts.length > 0 && <span className="rounded-full bg-[var(--panel)] px-2 py-0.5 text-[10px] font-bold text-[var(--ink-2)]">☑ {actionsDone(s, prog)}/{acts.length}</span>}
                  {assignees.length > 0 && <span className="flex -space-x-1.5">{assignees.slice(0, 4).map((nm) => <span key={nm} title={nm} className="grid h-5 w-5 place-items-center rounded-full text-[8px] font-extrabold text-white ring-2 ring-white" style={{ background: grad(p.when) }}>{initials(nm)}</span>)}</span>}
                  {pushed > 0 && <span className="text-[10px] font-bold text-[#0f7a43]">↗ {pushed} in Tasks</span>}
                  {!!s.links?.length && s.links.map((l) => <Link key={l.href + l.label} href={l.href} onClick={(e) => e.stopPropagation()} className="rounded-lg px-2 py-0.5 text-[10.5px] font-bold text-white hover:opacity-90" style={{ background: grad(p.when) }}>{l.label} →</Link>)}
                </div>
              </div>
              {/* item 12: inline expand — schedule + action checklist */}
              {!editable && expanded && (
                <div className="border-t border-[var(--line)] px-3 pb-3 pt-2.5" onClick={(e) => e.stopPropagation()}>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block"><span className="mb-1 block text-[10px] font-extrabold uppercase text-[var(--ink-3)]">Start</span><Input type="date" value={st?.start || ""} onChange={(e) => onSchedule(s.id, { start: e.target.value, end: st?.end || addDaysISO(e.target.value, 7) })} className="w-full text-[11px]" /></label>
                    <label className="block"><span className="mb-1 block text-[10px] font-extrabold uppercase text-[var(--ink-3)]">End</span><Input type="date" value={st?.end || ""} onChange={(e) => onSchedule(s.id, { end: e.target.value, start: st?.start || addDaysISO(e.target.value, -7) })} className="w-full text-[11px]" /></label>
                  </div>
                  {acts.length > 0 ? (
                    <div className="mt-2 space-y-1.5">{acts.map((a) => { const x = st?.actions?.[a.id] || {}; return (
                      <div key={a.id} className="rounded-lg border border-[var(--line)] p-2">
                        <div className="flex items-center gap-2"><button type="button" onClick={() => onActState(s.id, a.id, { done: !x.done })} className="grid h-5 w-5 shrink-0 place-items-center rounded-md text-[11px] font-bold" style={{ background: x.done ? tone : "var(--panel)", color: x.done ? "#fff" : "transparent" }}>✓</button><span className={`flex-1 text-[12px] font-semibold ${x.done ? "text-[var(--ink-3)] line-through" : "text-[var(--ink)]"}`}>{a.title}</span></div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2 pl-7">
                          <Select value={x.assignee || ""} onChange={(e) => onActState(s.id, a.id, { assignee: e.target.value || undefined })} className="text-[11px]"><option value="">Unassigned</option>{STAFF.map((nm) => <option key={nm} value={nm}>{nm}</option>)}</Select>
                          <Input type="date" value={x.due || ""} onChange={(e) => onActState(s.id, a.id, { due: e.target.value })} className="w-[130px] text-[11px]" />
                          {x.taskId ? <Link href="/franchise/tasks" className="text-[10.5px] font-bold text-[#0f7a43]">✓ In Task Manager ↗</Link> : <button type="button" onClick={() => onPush(s, a)} className="rounded-md bg-[#eef4fd] px-2 py-1 text-[10.5px] font-bold text-[#1d3a8f] hover:bg-[#e0eaff]">↗ Add to Task Manager</button>}
                        </div>
                      </div>
                    ); })}</div>
                  ) : (
                    <div className="mt-2"><div className="mb-1 flex items-center justify-between text-[10px] font-extrabold uppercase text-[var(--ink-3)]"><span>Completion</span><span className="tabular-nums" style={{ color: tone }}>{st?.pct ?? 0}%</span></div><input type="range" min={0} max={100} step={5} value={st?.pct ?? 0} onChange={(e) => onSchedule(s.id, { pct: Number(e.target.value) })} className="w-full" style={{ accentColor: tone }} /></div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {shown.length === 0 && <div className="py-2 text-center text-[12px] text-[var(--ink-3)]">{p.steps.length === 0 ? `No tasks in this milestone yet.${canEdit ? " Use “＋ Add task”." : ""}` : "Nothing matches this filter."}</div>}
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
  const r = 17, c = 2 * Math.PI * r; const shown = useCountUp(pct); // item 14
  return (
    <div className="relative grid h-12 w-12 shrink-0 place-items-center">
      <svg width="48" height="48" className="-rotate-90"><defs><linearGradient id="mile-ring" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#1d3a8f" /><stop offset="1" stopColor="#0e7490" /></linearGradient></defs><circle cx="24" cy="24" r={r} fill="none" stroke="var(--panel)" strokeWidth="5" /><circle cx="24" cy="24" r={r} fill="none" stroke="url(#mile-ring)" strokeWidth="5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} style={{ transition: "stroke-dashoffset .6s ease" }} /></svg>
      <span className="absolute text-[12px] font-extrabold tabular-nums text-[var(--ink)]">{shown}%</span>
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

function ActionEditor({ phase, step, state, onMeta, onSchedule, onActState, onPush, onDelete, onClose }: { phase: MPhase; step: MStep; state?: StepState; onMeta?: (patch: Partial<MStep>) => void; onSchedule?: (patch: Partial<StepState>) => void; onActState?: (actId: string, patch: Partial<ActState>) => void; onPush?: (a: MAction) => void; onDelete?: () => void; onClose: () => void }) {
  const tone = WHEN_TONE[phase.when];
  const start = state?.start || ""; const end = state?.end || ""; const pct = state?.pct ?? 0;
  const links = step.links || []; const actions = step.actions || [];
  const doneCt = actions.filter((a) => state?.actions?.[a.id]?.done).length;
  const derived = actions.length ? Math.round((doneCt / actions.length) * 100) : pct;
  return (
    <div className="fixed inset-0 z-[145] flex items-start justify-center overflow-y-auto bg-black/45 p-4 pt-[8vh]" onClick={onClose} style={LIGHT_PALETTE}>
      <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
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
          {/* HO defines the checklist of actions inside the task */}
          <div className="mt-3"><span className="mb-1 block text-[10px] font-extrabold uppercase text-[var(--ink-3)]">Actions (checklist inside this task)</span>
            <div className="space-y-1">{actions.map((a, ai) => (
              <div key={a.id} className="flex items-center gap-1.5"><span className="text-[var(--ink-3)]">•</span><Input value={a.title} onChange={(e) => onMeta({ actions: actions.map((x, k) => k === ai ? { ...x, title: e.target.value } : x) })} className="flex-1 text-[12px]" /><button type="button" onClick={() => onMeta({ actions: actions.filter((_, k) => k !== ai) })} className="px-1 text-[14px] text-[var(--ink-3)] hover:text-[#c0392b]">×</button></div>
            ))}</div>
            <button type="button" onClick={() => onMeta({ actions: [...actions, { id: newId(), title: "New action" }] })} className="mt-1 text-[11.5px] font-bold text-[#1d3a8f] hover:underline">+ Add action</button>
          </div>
        </>) : <h3 className="text-[15px] font-extrabold text-[var(--ink)]">{step.title}</h3>}

        {onSchedule && (<>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <label className="block"><span className="mb-1 block text-[10px] font-extrabold uppercase text-[var(--ink-3)]">Start</span><Input type="date" value={start} onChange={(e) => onSchedule({ start: e.target.value, end: end || addDaysISO(e.target.value, 7) })} className="w-full" /></label>
            <label className="block"><span className="mb-1 block text-[10px] font-extrabold uppercase text-[var(--ink-3)]">Target end</span><Input type="date" value={end} onChange={(e) => onSchedule({ end: e.target.value, start: start || addDaysISO(e.target.value, -7) })} className="w-full" /></label>
          </div>
          {actions.length > 0 ? (
            <div className="mt-3">
              <div className="mb-1.5 flex items-center justify-between"><span className="text-[10px] font-extrabold uppercase text-[var(--ink-3)]">Actions — who &amp; when</span><span className="text-[11px] font-bold tabular-nums" style={{ color: tone }}>{doneCt}/{actions.length} · {derived}%</span></div>
              <div className="space-y-1.5">{actions.map((a) => { const asx = state?.actions?.[a.id] || {}; return (
                <div key={a.id} className="rounded-lg border border-[var(--line)] p-2">
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => onActState?.(a.id, { done: !asx.done })} className="grid h-5 w-5 shrink-0 place-items-center rounded-md text-[11px] font-bold" style={{ background: asx.done ? tone : "var(--panel)", color: asx.done ? "#fff" : "transparent" }}>✓</button>
                    <span className={`flex-1 text-[12.5px] font-semibold ${asx.done ? "text-[var(--ink-3)] line-through" : "text-[var(--ink)]"}`}>{a.title}</span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 pl-7">
                    <Select value={asx.assignee || ""} onChange={(e) => onActState?.(a.id, { assignee: e.target.value || undefined })} className="text-[11px]"><option value="">Unassigned</option>{STAFF.map((nm) => <option key={nm} value={nm}>{nm}</option>)}</Select>
                    <Input type="date" value={asx.due || ""} onChange={(e) => onActState?.(a.id, { due: e.target.value })} className="w-[130px] text-[11px]" />
                    {asx.taskId ? <Link href="/franchise/tasks" className="text-[10.5px] font-bold text-[#0f7a43]">✓ In Task Manager ↗</Link>
                      : <button type="button" onClick={() => onPush?.(a)} className="rounded-md bg-[#eef4fd] px-2 py-1 text-[10.5px] font-bold text-[#1d3a8f] hover:bg-[#e0eaff]">↗ Add to Task Manager</button>}
                  </div>
                </div>
              ); })}</div>
              <div className="mt-1.5 text-[10px] text-[var(--ink-3)]">Completion rolls up from the actions ticked above.</div>
            </div>
          ) : (
            <div className="mt-3">
              <div className="mb-1 flex items-center justify-between text-[10px] font-extrabold uppercase text-[var(--ink-3)]"><span>Completion</span><span className="tabular-nums" style={{ color: tone }}>{pct}%</span></div>
              <input type="range" min={0} max={100} step={5} value={pct} onChange={(e) => onSchedule({ pct: Number(e.target.value) })} className="w-full" style={{ accentColor: tone }} />
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--panel)]"><div className="h-full rounded-full transition-[width]" style={{ width: `${pct}%`, background: gradBar(phase.when) }} /></div>
            </div>
          )}
        </>)}

        <div className="mt-4 flex items-center gap-2">
          {onDelete && <button type="button" onClick={onDelete} className="text-[12px] font-bold text-[var(--ink-3)] hover:text-[#c0392b]">Delete task</button>}
          <div className="ml-auto flex gap-2">
            {onSchedule && actions.length === 0 && <Button onClick={() => onSchedule({ pct: 100 })}>Mark done</Button>}
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
