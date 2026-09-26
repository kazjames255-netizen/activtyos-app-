"use client";

import { Suspense, createContext, lazy, useContext, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { FOCUS, Icon } from "../kit";
import { FloatingPanel } from "./FloatingPanel";
import { InstrumentOverlay } from "./InstrumentOverlay";
import CompassTool from "./CompassTool";
import FractionBars from "./FractionBars";
import PeriodicTable from "../tools/science/periodic/PeriodicTable";
import { CALC_DEFAULT, ScientificCalculator, type CalcState } from "./ScientificCalculator";
import NumberLineTool from "./NumberLineTool";

// A student's "help board" for remote-sync — every generic tool widget the live lesson whiteboard offers
// (server/model.ts's StampKind), across every subject it covers, not just maths. On by default (a tutor unselects
// what they don't want, by whole subject or one tool at a time) rather than opt-in one at a time, since the point
// is "everything the board has, minus actually drawing" — see HelpToolsPicker. Still opt-in at the SESSION level
// (RemoteSyncApp's start screen) and still a side panel, never the board itself, so it can't compete with a
// tutor-run whiteboard — this is "help off to the side", not a second lesson.
//
// Window mechanics (open/close/drag/resize/minimise/z-order) live in FloatingPanel.tsx, a fresh shared primitive
// — the board itself (BoardCanvas.tsx) is a canvas of drawable objects, not DOM windows, so there was nothing
// there to literally reuse; FloatingVideo.tsx's `useFloatingTile` is the closest existing DOM floating-tile
// pattern but is single-tile/bounded-container/avoid-rect, a different model to "N portaled, viewport-fixed,
// cascading windows with a shared minimised tray" — so it's left untouched and this is a new, purpose-built
// manager instead of a forced reuse.

export type HelpToolSubject = "Maths" | "Science" | "Geography" | "History" | "General";
export type HelpToolId =
  | "calculator" | "numberline" | "timestable" | "fractions" | "grid" | "ruler" | "protractor" | "plot"
  | "periodic" | "bohr" | "apparatus" | "lens"
  | "map" | "timeline"
  | "clock" | "timer" | "dice" | "spinner" | "tally" | "symbol";
export const HELP_TOOLS: { id: HelpToolId; label: string; icon: string; subject: HelpToolSubject; ready?: boolean }[] = [
  { id: "calculator", label: "Calculator", icon: "🧮", subject: "Maths" },
  { id: "numberline", label: "Number line", icon: "📏", subject: "Maths" },
  { id: "timestable", label: "Times table", icon: "✖️", subject: "Maths" },
  { id: "fractions", label: "Fractions", icon: "🍰", subject: "Maths" },
  { id: "grid", label: "Coordinate grid", icon: "⊞", subject: "Maths" },
  { id: "plot", label: "Bar chart", icon: "📊", subject: "Maths" },
  { id: "ruler", label: "Ruler", icon: "📐", subject: "Maths" },
  { id: "protractor", label: "Protractor", icon: "🔺", subject: "Maths" },
  { id: "periodic", label: "Periodic table", icon: "⚗️", subject: "Science" },
  { id: "bohr", label: "Atom model", icon: "⚛️", subject: "Science" },
  { id: "apparatus", label: "Equipment", icon: "🧪", subject: "Science" },
  { id: "lens", label: "Lens diagram", icon: "🔍", subject: "Science" },
  { id: "map", label: "Compass", icon: "🧭", subject: "Geography" },
  { id: "timeline", label: "Timeline", icon: "📜", subject: "History" },
  { id: "symbol", label: "Symbols", icon: "∑", subject: "General" },
  // Hidden from the student list (see the audit table): it's a live wall-clock, not a "set a time and read it"
  // practice tool — the one tool that doesn't actually do what its name implies for a maths help board.
  { id: "clock", label: "Clock", icon: "🕐", subject: "General", ready: false },
  { id: "timer", label: "Timer", icon: "⏱️", subject: "General" },
  { id: "dice", label: "Dice", icon: "🎲", subject: "General" },
  { id: "spinner", label: "Spinner", icon: "🎯", subject: "General" },
  { id: "tally", label: "Tally counter", icon: "🖐️", subject: "General" },
];
export const HELP_TOOL_SUBJECTS: HelpToolSubject[] = ["Maths", "Science", "Geography", "History", "General"];

/** Every tool a live session can allow (a tutor says just Yes/No; WHICH tool shows is decided per question, see tools/suggest.ts toolsForQuestion). */
export const ALL_HELP_TOOL_IDS: HelpToolId[] = HELP_TOOLS.filter((t) => t.ready !== false).map((t) => t.id);

/** The tutor's single Yes / No for tools. Yes = every tool is allowed and each question shows only the ones that fit it (a protractor on a
 *  measure-the-angle question, nothing on a definition question); No = no tools at all. */
export function HelpToolsSwitch({ value, onChange }: { value: HelpToolId[]; onChange: (v: HelpToolId[]) => void }) {
  const on = value.length > 0;
  const opt = (yes: boolean) => (
    <button type="button" role="radio" aria-checked={on === yes} onClick={() => onChange(yes ? ALL_HELP_TOOL_IDS : [])} data-testid={`remote-sync-tools-${yes ? "yes" : "no"}`}
      className={`min-h-[44px] rounded-full border-2 px-5 text-[13.5px] font-extrabold ${FOCUS} ${on === yes ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] hover:border-[var(--brand-2)]"}`}>{yes ? "Yes" : "No"}</button>);
  return (
    <div data-testid="remote-sync-tools-switch">
      <h3 className="m-0 mb-1 text-[12px] font-extrabold uppercase tracking-[0.06em] text-[var(--ink-2)]">Let students use tools?</h3>
      <p className="m-0 mb-2 text-[12px] text-[var(--ink-3)]">A tool only appears on a question it is meant for (a protractor to measure an angle, a ruler to measure a line) and never on a question it would give the answer to.</p>
      <div role="radiogroup" aria-label="Let students use tools" className="flex gap-2">{opt(true)}{opt(false)}</div>
    </div>
  );
}

/** The tutor's start/resume screen: which help tools this class gets, grouped the way the board's own subjects
 *  are — on by default (this call's caller seeds `value` with every id), with a per-subject toggle alongside
 *  each tool's own, so "everything except science" or "just calculator" are both one or two clicks. */
export function HelpToolsPicker({ value, onChange, suggested }: { value: HelpToolId[]; onChange: (v: HelpToolId[]) => void;
  /** Tools that fit THIS lesson (from the lesson title via tools/suggest.ts). When given, only these show up front — every other subject's tools sit behind "More tools". */
  suggested?: HelpToolId[] }) {
  const [more, setMore] = useState(false);
  const set = new Set(value);
  const focus = suggested && suggested.length > 0 ? HELP_TOOLS.filter((t) => suggested.includes(t.id)) : null;
  const toggle = (id: HelpToolId) => onChange(set.has(id) ? value.filter((x) => x !== id) : [...value, id]);
  const toggleSubject = (subject: HelpToolSubject) => {
    const ids = HELP_TOOLS.filter((t) => t.subject === subject).map((t) => t.id);
    const allOn = ids.every((id) => set.has(id));
    onChange(allOn ? value.filter((id) => !ids.includes(id)) : [...new Set([...value, ...ids])]);
  };
  const allOn = value.length === HELP_TOOLS.length;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="m-0 text-[12px] font-extrabold uppercase tracking-[0.06em] text-[var(--ink-2)]">Help tools for students</h3>
        <button type="button" onClick={() => onChange(allOn ? [] : HELP_TOOLS.map((t) => t.id))} className={`text-[12px] font-extrabold text-[var(--brand)] hover:underline ${FOCUS}`}>
          {allOn ? "Clear all" : "Select all"}
        </button>
      </div>
      {focus ? (
        <>
          <p className="m-0 mb-2 text-[12px] text-[var(--ink-3)]">Picked for this lesson. Tap to turn a tool off or on.</p>
          <div className="flex flex-wrap gap-2" data-testid="remote-sync-tools-suggested">
            {focus.map((t) => (
              <button key={t.id} type="button" onClick={() => toggle(t.id)} aria-pressed={set.has(t.id)} data-testid={`remote-sync-tool-${t.id}`}
                className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-full border-2 px-3 text-[12.5px] font-extrabold transition ${FOCUS} ${set.has(t.id) ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand-strong)]" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink-2)] hover:border-[var(--brand-2)]"}`}>
                <span aria-hidden>{t.icon}</span>{t.label}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setMore((v) => !v)} aria-expanded={more} data-testid="remote-sync-tools-more" className={`mt-2.5 text-[12px] font-extrabold text-[var(--brand)] hover:underline ${FOCUS}`}>
            {more ? "Hide other tools" : `More tools (${HELP_TOOLS.length - focus.length} for other subjects)`}
          </button>
        </>
      ) : (
        <p className="m-0 mb-2 text-[12px] text-[var(--ink-3)]">On by default — a side panel of the same tools the board offers, across every subject. Unselect a whole subject, or just one tool.</p>
      )}
      <div className={`space-y-2.5 ${focus && !more ? "hidden" : ""} ${focus ? "mt-2.5" : ""}`}>
        {HELP_TOOL_SUBJECTS.map((subject) => {
          const tools = HELP_TOOLS.filter((t) => t.subject === subject);
          const subjectOn = tools.every((t) => set.has(t.id));
          return (
            <div key={subject}>
              <button type="button" onClick={() => toggleSubject(subject)} aria-pressed={subjectOn} data-testid={`remote-sync-tool-subject-${subject.toLowerCase()}`}
                className={`mb-1.5 text-[11.5px] font-extrabold uppercase tracking-[0.04em] ${subjectOn ? "text-[var(--brand)]" : "text-[var(--ink-3)]"} hover:underline`}>
                {subject}
              </button>
              <div className="flex flex-wrap gap-2">
                {tools.map((t) => (
                  <button key={t.id} type="button" onClick={() => toggle(t.id)} aria-pressed={set.has(t.id)} data-testid={`remote-sync-tool-${t.id}`}
                    className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-full border-2 px-3 text-[12.5px] font-extrabold transition ${FOCUS} ${set.has(t.id) ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand-strong)]" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink-2)] hover:border-[var(--brand-2)]"}`}>
                    <span aria-hidden>{t.icon}</span>{t.label}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Sidebar display grouping (Part 3) — separate from HELP_TOOL_SUBJECTS above, which is the TUTOR's
// enable/disable taxonomy and stays as it was. This is purely how the STUDENT's sidebar list is organised —
// every tool in exactly one group.
interface SidebarGroup { key: string; label: string; ids: HelpToolId[] }
const SIDEBAR_GROUPS: SidebarGroup[] = [
  { key: "maths", label: "Maths", ids: ["calculator", "numberline", "timestable", "fractions", "grid", "plot", "symbol"] },
  { key: "geometry", label: "Geometry & measure", ids: ["ruler", "protractor", "map"] },
  { key: "science", label: "Science", ids: ["periodic", "bohr", "apparatus", "lens"] },
  { key: "humanities", label: "Humanities", ids: ["timeline"] },
  { key: "classroom", label: "Classroom", ids: ["clock", "timer", "dice", "spinner", "tally"] },
];
/** No per-lesson subject/topic tag is threaded to this component today (Note carries a topicId, not a subject,
 *  and nothing currently resolves that to a subject string here) — falls back to this fixed set, which is
 *  exactly what was asked for THIS lesson (Year 3, multiples of 8). A real per-topic suggestion would need a new
 *  subject lookup threaded in from the caller; flagging that rather than inventing one silently. */
const DEFAULT_SUGGESTED: HelpToolId[] = ["numberline", "timestable", "calculator", "tally", "symbol", "timer"];
/** Same reasoning: with no subject signal, "Maths" is the group expanded by default (it is this lesson's real
 *  subject); every other group starts collapsed. */
const DEFAULT_OPEN_GROUP = "maths";

const GeoBoard = lazy(() => import("../tools/maths/geometry/GeometryBoard").then((m) => ({ default: m.GeometryBoard })));
/** The lesson card the tools sit beside (set by HelpToolsPanel) — lets a tool grab the picture on the question being worked on. */
const LessonCardCtx = createContext<RefObject<HTMLDivElement | null> | null>(null);
/** The question on screen (its wording), so a tool can frame itself to it — e.g. the number line opens fitted to the question's own numbers. */
const QuestionPromptCtx = createContext<string | undefined>(undefined);
function GridForQuestion() {
  const prompt = useContext(QuestionPromptCtx);
  return <Suspense fallback={<p className="m-0 text-[13px]">Loading…</p>}><GridLazy key={prompt ?? "none"} compact help prompt={prompt} /></Suspense>;
}
function NumberLineForQuestion() {
  const prompt = useContext(QuestionPromptCtx);
  return <NumberLineTool key={prompt ?? "none"} prompt={prompt} />;
}
/** Ruler / protractor with a "put the question's picture on the paper" button: measure the ACTUAL diagram in the lesson,
 *  not a blank sheet. Takes the largest real picture inside the lesson card as it is right now (so it follows the slide/question). */
function GeoOnLesson({ preset, offer, generatorIds }: { preset: ("ruler15" | "protractor180")[]; offer: typeof GEO_OFFER; generatorIds: string[] }) {
  const cardRef = useContext(LessonCardCtx);
  const [pic, setPic] = useState<string | undefined>();
  const [msg, setMsg] = useState<string | null>(null);
  const [focus, setFocus] = useState(false); // the board's focus mode also hides this row
  const grab = () => {
    // Judge by the size it is DRAWN at (an SVG file with no intrinsic size reports naturalWidth 0), and accept inline
    // <svg> diagrams too (serialised to a data URL) — the largest visible one in the lesson card wins.
    const root = cardRef?.current;
    const cands: { area: number; src: string }[] = [];
    root?.querySelectorAll("img").forEach((i) => { const r = i.getBoundingClientRect(); const src = i.currentSrc || i.src; if (src && r.width >= 100 && r.height >= 60) cands.push({ area: r.width * r.height, src }); });
    root?.querySelectorAll("svg").forEach((v) => { const r = v.getBoundingClientRect(); if (r.width >= 100 && r.height >= 60 && !v.closest("button")) cands.push({ area: r.width * r.height, src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(v))}` }); });
    const best = cands.sort((a, b) => b.area - a.area)[0];
    if (best) { setPic(best.src); setMsg("Picture added — drag the protractor onto it."); } else setMsg(root ? "No picture found on this question." : "Couldn't find the lesson to take a picture from.");
  };
  return (
    <div>
      {!focus && <div className="mb-2 flex flex-wrap items-center gap-2">
        <button type="button" onClick={grab} data-testid="geo-use-question-picture" className={`min-h-[36px] rounded-full border-2 border-[var(--brand)] bg-[var(--brand-soft)] px-3 text-[12.5px] font-extrabold text-[var(--brand-strong)] ${FOCUS}`}>🖼 Use this question's picture</button>
        {pic && <button type="button" onClick={() => setPic(undefined)} className={`min-h-[36px] rounded-full border border-[var(--line)] px-3 text-[12.5px] font-extrabold text-[var(--ink-2)] ${FOCUS}`}>Remove picture</button>}
        {msg && <span role="status" className="text-[12px] font-semibold text-[var(--ink-3)]">{msg}</span>}
      </div>}
      <Suspense fallback={<p className="m-0 text-[13px]">Loading…</p>}><GeoBoard compact preset={preset} offer={offer} generatorIds={generatorIds} backdropUrl={pic} focus={focus} onFocusChange={setFocus} /></Suspense>
    </div>
  );
}
const GridLazy = lazy(() => import("../tools/maths/CoordGrid"));
const GEO_OFFER: ("ruler15" | "straightedge" | "protractor180" | "protractor360" | "compass" | "setsquare45" | "setsquare3060")[] = ["ruler15", "straightedge", "protractor180", "protractor360", "compass", "setsquare45", "setsquare3060"];

const TOOL_RENDER: Record<HelpToolId, (v: ToolStateFor<HelpToolId>, set: (v: ToolStateFor<HelpToolId>) => void) => ReactNode> = {
  calculator: (v, set) => <ScientificCalculator value={v as CalcState} onChange={set} />,
  // A finished, self-contained component supplied as-is (see NumberLineTool.tsx) — it manages its own state
  // internally rather than through this file's value/onChange contract, per the explicit "don't rewrite it" ask.
  numberline: () => <NumberLineForQuestion />,
  timestable: (v, set) => <TimesTable value={v as TimesTableState} onChange={set} />,
  fractions: () => <FractionBars />,
  grid: () => <GridForQuestion />,
  plot: (v, set) => <BarChart value={v as BarChartState} onChange={set} />,
  // The real instruments (tools/maths/geometry): movable, turnable, snapping, with a drawing compass and set square on the desk.
  ruler: () => <GeoOnLesson preset={["ruler15"]} offer={["ruler15", "straightedge"]} generatorIds={[]} />,
  protractor: () => <GeoOnLesson preset={["protractor180"]} offer={["protractor180", "protractor360"]} generatorIds={["M-G01.measure", "M-G01.draw"]} />,
  periodic: () => <PeriodicTable />,
  bohr: (v, set) => <Bohr value={v as BohrState} onChange={set} />,
  apparatus: () => <Apparatus />,
  lens: () => <Lens />,
  map: () => <CompassTool />,
  timeline: (v, set) => <Timeline value={v as TimelineState} onChange={set} />,
  symbol: () => <Symbols />,
  clock: () => <Clock />,
  timer: (v, set) => <Timer value={v as TimerState} onChange={set} />,
  dice: (v, set) => <Dice value={v as DiceState} onChange={set} />,
  spinner: (v, set) => <Spinner value={v as SpinnerState} onChange={set} />,
  tally: (v, set) => <Tally value={v as TallyState} onChange={set} />,
};

// Per-tool default size + minimum size. Content reflows inside; nothing is cut off at these defaults.
const TOOL_SIZE: Record<HelpToolId, { w: number; h: number; minW: number; minH: number }> = {
  calculator: { w: 350, h: 540, minW: 310, minH: 500 },
  numberline: { w: 640, h: 480, minW: 460, minH: 430 },
  timestable: { w: 300, h: 360, minW: 260, minH: 300 },
  fractions: { w: 560, h: 440, minW: 420, minH: 340 },
  grid: { w: 470, h: 720, minW: 340, minH: 520 },
  plot: { w: 360, h: 280, minW: 280, minH: 240 },
  ruler: { w: 600, h: 620, minW: 440, minH: 480 },
  protractor: { w: 600, h: 620, minW: 440, minH: 480 },
  periodic: { w: 740, h: 700, minW: 480, minH: 560 },
  bohr: { w: 280, h: 320, minW: 240, minH: 280 },
  apparatus: { w: 300, h: 220, minW: 260, minH: 200 },
  lens: { w: 320, h: 220, minW: 280, minH: 180 },
  map: { w: 260, h: 260, minW: 220, minH: 220 },
  timeline: { w: 340, h: 320, minW: 280, minH: 280 },
  clock: { w: 220, h: 260, minW: 200, minH: 220 },
  timer: { w: 260, h: 260, minW: 220, minH: 220 },
  dice: { w: 260, h: 260, minW: 220, minH: 220 },
  spinner: { w: 260, h: 300, minW: 220, minH: 260 },
  tally: { w: 240, h: 260, minW: 200, minH: 220 },
  symbol: { w: 300, h: 320, minW: 260, minH: 280 },
};

// ─── Per-tool remembered state (Part 2 "State") — lifted out of each widget so it survives close/reopen and
// slide changes for as long as the student stays on this lesson page; "Reset" just deletes the entry, which
// falls back to these defaults on the next render. Clock has no persisted state (it's just "now").
interface TimesTableState { n: number }
interface GridState { pts: { x: number; y: number }[] }
interface BarChartState { text: string }
interface BohrState { electrons: number }
interface TimerState { secs: number; left: number; running: boolean }
interface DiceState { vals: number[]; n: number }
interface SpinnerState { seg: number; angle: number }
interface TallyState { n: number }
interface TimelineState { events: { year: string; label: string }[]; year: string; label: string }
type ToolStateFor<T extends HelpToolId> = T extends "calculator" ? CalcState
  : T extends "timestable" ? TimesTableState : T extends "grid" ? GridState
  : T extends "plot" ? BarChartState : T extends "bohr" ? BohrState : T extends "timer" ? TimerState
  : T extends "dice" ? DiceState : T extends "spinner" ? SpinnerState : T extends "tally" ? TallyState
  : T extends "timeline" ? TimelineState : undefined;
const TOOL_DEFAULTS: Partial<Record<HelpToolId, unknown>> = {
  calculator: CALC_DEFAULT,
  timestable: { n: 2 } as TimesTableState,
  grid: { pts: [] } as GridState,
  plot: { text: "3,7,4,9,5" } as BarChartState,
  bohr: { electrons: 11 } as BohrState,
  timer: { secs: 300, left: 300, running: false } as TimerState,
  dice: { vals: [1], n: 1 } as DiceState,
  spinner: { seg: 4, angle: 0 } as SpinnerState,
  tally: { n: 0 } as TallyState,
  timeline: { events: [{ year: "1066", label: "Battle of Hastings" }], year: "", label: "" } as TimelineState,
};

interface OpenCard { id: HelpToolId; x: number; y: number; w: number; h: number; z: number; minimized: boolean }
const MAX_OPEN = 3;
const TRAY_H = 44;
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

/** The student's side: a "Tools" sidebar card (Suggested + collapsible subject groups) plus, separately, every
 *  open tool as its own floating window over the lesson card (never over the sidebar) — see FloatingPanel.tsx
 *  for the window mechanics and the comment at the top of this file for why that's a new component rather than
 *  a forced reuse of the board or the video tile. */
export function HelpToolsPanel({ tools, lessonCardRef, hideList, suggested, questionTools, questionKey, questionPrompt }: {
  tools: HelpToolId[];
  /** The wording of the question on screen (tools frame themselves to it). */
  questionPrompt?: string;
  /** The tools that fit the question on screen RIGHT NOW (tools/suggest.ts toolsForQuestion). When given, ONLY these can show; an empty list = no tool on this question. */
  questionTools?: HelpToolId[];
  /** Changes when the question on screen changes: tools not allowed on the new one close, and instruments (protractor / ruler) open on their own. */
  questionKey?: string | null;
  /** Tools to put under "Suggested for this lesson", best first (tools/suggest.ts works them out from the lesson). Absent/empty = the fixed default six. */
  suggested?: HelpToolId[];
  /** The left-column lesson card — new windows spawn from its top-right corner; the minimised tray docks at its
   *  bottom-left. Drag itself still clamps to the VIEWPORT, not this box, once a window is open. */
  lessonCardRef: RefObject<HTMLDivElement | null>;
  /** Collapses just the Suggested/Subject-groups list card — any open windows and the minimised tray stay exactly as they are. */
  hideList?: boolean;
}) {
  const [cards, setCards] = useState<OpenCard[]>([]);
  // Ruler / protractor open as a single instrument laid directly over the lesson; this set = the ones switched to the full drawing board window.
  const [boardMode, setBoardMode] = useState<Set<HelpToolId>>(new Set());
  const [toolState, setToolState] = useState<Partial<Record<HelpToolId, unknown>>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set([DEFAULT_OPEN_GROUP]));
  const [mobile, setMobile] = useState(false);
  const zRef = useRef(1);
  const triggerRef = useRef<Partial<Record<HelpToolId, HTMLElement>>>({});
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const check = () => setMobile(window.innerWidth < 1100);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const showToast = (m: string) => {
    setToast(m);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  };
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  const openTool = (id: HelpToolId, trigger: HTMLElement | null) => {
    if (trigger) triggerRef.current[id] = trigger;
    setCards((cs) => {
      const existing = cs.find((c) => c.id === id);
      if (existing) {
        // Already open: a minimised one restores; an already-floating one just comes to front.
        const z = ++zRef.current;
        return cs.map((c) => (c.id === id ? { ...c, minimized: false, z } : c));
      }
      if (cs.length >= MAX_OPEN) { showToast("Close a tool to open another."); return cs; }
      const size = TOOL_SIZE[id];
      const last = cs[cs.length - 1];
      const rect = lessonCardRef.current?.getBoundingClientRect();
      const vw = window.innerWidth, vh = window.innerHeight;
      const baseX = rect ? rect.right - 24 - size.w : vw - size.w - 24;
      const baseY = rect ? rect.top + 96 : 96;
      const x = clamp(last ? last.x - 32 : baseX, 12, vw - 12), y = clamp(last ? last.y + 32 : baseY, 12, vh - 12);
      return [...cs, { id, x, y, w: size.w, h: size.h, z: ++zRef.current, minimized: false }];
    });
  };
  const update = (id: HelpToolId, patch: Partial<OpenCard>) => setCards((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const bringFront = (id: HelpToolId) => update(id, { z: ++zRef.current });
  const closeTool = (id: HelpToolId) => { setCards((cs) => cs.filter((c) => c.id !== id)); setBoardMode((m) => { if (!m.has(id)) return m; const n = new Set(m); n.delete(id); return n; }); };
  const minimizeTool = (id: HelpToolId) => update(id, { minimized: true });
  const resetTool = (id: HelpToolId) => setToolState((s) => { const n = { ...s }; delete n[id]; return n; });
  const setToolValue = (id: HelpToolId, v: unknown) => setToolState((s) => ({ ...s, [id]: v }));

  const isOpen = (id: HelpToolId) => cards.some((c) => c.id === id);

  // Per-question tools: what shows is decided by the question in view, not by the lesson.
  const perQuestion = questionTools !== undefined;
  const allowed = new Set<HelpToolId>(questionTools ?? []);
  const shownTools = perQuestion ? tools.filter((t) => allowed.has(t)) : tools;
  const qk = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (!perQuestion || qk.current === questionKey) return;
    qk.current = questionKey;
    setCards((cs) => cs.filter((c) => allowed.has(c.id)));
    // A measuring instrument is the point of its question: put it straight over the question (windowed tools wait to be opened).
    for (const id of ["protractor", "ruler"] as HelpToolId[]) if (allowed.has(id)) openTool(id, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionKey, perQuestion]);

  // ── Mobile/tablet (<1100px): a single bottom sheet, never floating windows.
  if (mobile) {
    const activeId = cards[0]?.id ?? null;
    return (
      <QuestionPromptCtx.Provider value={questionPrompt}><LessonCardCtx.Provider value={lessonCardRef}>
        <ToolsListCard tools={shownTools} suggested={perQuestion ? shownTools : suggested} isOpen={isOpen} openGroups={openGroups} setOpenGroups={setOpenGroups} hidden={!!hideList || (perQuestion && !shownTools.length)}
          onPick={(id, el) => { if (isOpen(id)) closeTool(id); else { setCards([]); openTool(id, el); } }} />
        {activeId && (
          <MobileToolSheet id={activeId} label={HELP_TOOLS.find((t) => t.id === activeId)!.label} icon={HELP_TOOLS.find((t) => t.id === activeId)!.icon}
            onClose={() => closeTool(activeId)}>
            {TOOL_RENDER[activeId]((toolState[activeId] ?? TOOL_DEFAULTS[activeId]) as never, (v) => setToolValue(activeId, v))}
          </MobileToolSheet>
        )}
      </LessonCardCtx.Provider></QuestionPromptCtx.Provider>
    );
  }

  const floating = cards.filter((c) => !c.minimized && (!perQuestion || allowed.has(c.id)));
  const minimized = cards.filter((c) => c.minimized);
  const trayRect = lessonCardRef.current?.getBoundingClientRect();

  return (
    <QuestionPromptCtx.Provider value={questionPrompt}><LessonCardCtx.Provider value={lessonCardRef}>
      <ToolsListCard tools={shownTools} suggested={perQuestion ? shownTools : suggested} isOpen={isOpen} openGroups={openGroups} setOpenGroups={setOpenGroups} hidden={!!hideList || (perQuestion && !shownTools.length)}
        onPick={(id, el) => openTool(id, el)} />
      {floating.map((c) => {
        const t = HELP_TOOLS.find((x) => x.id === c.id)!;
        if ((c.id === "protractor" || c.id === "ruler") && !boardMode.has(c.id)) {
          return <InstrumentOverlay key={c.id} kind={c.id === "ruler" ? "ruler15" : "protractor180"} label={t.label} lessonCardRef={lessonCardRef}
            onClose={() => closeTool(c.id)} onBoard={() => setBoardMode((m) => new Set(m).add(c.id))} />;
        }
        const size = TOOL_SIZE[c.id];
        return (
          <FloatingPanel key={c.id} title={t.label} icon={t.icon} x={c.x} y={c.y} w={c.w} h={c.h} z={1000 + c.z}
            minW={size.minW} minH={size.minH}
            onFocus={() => bringFront(c.id)}
            onMove={(x, y) => update(c.id, { x, y })}
            onResize={(w, h) => update(c.id, { w, h })}
            onClose={() => closeTool(c.id)}
            onMinimize={() => minimizeTool(c.id)}
            onReset={() => resetTool(c.id)}
            restoreFocusRef={{ current: triggerRef.current[c.id] ?? null }}>
            {TOOL_RENDER[c.id]((toolState[c.id] ?? TOOL_DEFAULTS[c.id]) as never, (v) => setToolValue(c.id, v))}
          </FloatingPanel>
        );
      })}
      {minimized.length > 0 && (
        <div className="fixed z-[1300] flex flex-wrap gap-1.5 rounded-full bg-transparent"
          style={{ left: trayRect ? trayRect.left + 12 : 12, top: trayRect ? trayRect.bottom - TRAY_H - 12 : window.innerHeight - TRAY_H - 12 }}>
          {minimized.map((c) => {
            const t = HELP_TOOLS.find((x) => x.id === c.id)!;
            return (
              <button key={c.id} type="button" onClick={() => openTool(c.id, null)} data-testid={`tool-tray-${c.id}`}
                className="flex h-11 items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 text-[12.5px] font-extrabold text-[var(--ink-2)] shadow-[0_6px_18px_rgba(0,0,0,0.16)] hover:bg-[var(--panel)]">
                <span aria-hidden>{t.icon}</span>{t.label}
              </button>
            );
          })}
        </div>
      )}
      {toast && (
        <div role="status" className="fixed bottom-6 left-1/2 z-[1400] -translate-x-1/2 rounded-full bg-[var(--ink)] px-4 py-2 text-[12.5px] font-bold text-white shadow-[0_10px_30px_rgba(0,0,0,0.3)]">
          {toast}
        </div>
      )}
    </LessonCardCtx.Provider></QuestionPromptCtx.Provider>
  );
}

/** The sidebar card itself — same chrome as the Homework/Flashcards cards. "Suggested for this lesson" is
 *  always expanded; every other subject group is a collapsible section, closed by default except the one
 *  matching this lesson's own subject. */
function ToolsListCard({ tools, suggested: suggestedProp, isOpen, openGroups, setOpenGroups, hidden, onPick }: {
  tools: HelpToolId[]; suggested?: HelpToolId[]; isOpen: (id: HelpToolId) => boolean;
  openGroups: Set<string>; setOpenGroups: (s: Set<string>) => void; hidden: boolean;
  onPick: (id: HelpToolId, el: HTMLElement | null) => void;
}) {
  if (hidden) return null;
  const ready = new Set(HELP_TOOLS.filter((t) => t.ready !== false).map((t) => t.id));
  const enabled = new Set(tools.filter((id) => ready.has(id)));
  const picked = (suggestedProp ?? []).filter((id) => enabled.has(id));
  // Lesson-specific picks first; top up from the default six so the row never looks bare.
  const suggested = picked.length ? [...picked, ...DEFAULT_SUGGESTED.filter((id) => enabled.has(id) && !picked.includes(id))].slice(0, 6) : DEFAULT_SUGGESTED.filter((id) => enabled.has(id));
  const toggleGroup = (key: string) => setOpenGroups(new Set(openGroups.has(key) ? [...openGroups].filter((k) => k !== key) : [...openGroups, key]));

  const pill = (id: HelpToolId) => {
    const t = HELP_TOOLS.find((x) => x.id === id)!;
    return (
      <button key={id} type="button" onClick={(e) => onPick(id, e.currentTarget)} aria-pressed={isOpen(id)} data-testid={`remote-sync-open-${id}`}
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[12px] font-extrabold ${isOpen(id) ? "bg-[var(--brand)] text-white" : "bg-[var(--panel)] text-[var(--ink-2)] hover:brightness-95"}`}>
        <span aria-hidden>{t.icon}</span>{t.label}
      </button>
    );
  };

  return (
    <div className="overflow-hidden rounded-[14px] bg-white" style={{ border: "1px solid #E4E4EE" }} data-testid="tools-card">
      <div className="max-h-[420px] overflow-y-auto p-3">
        {suggested.length > 0 && (
          <div className="mb-3">
            <div className="mb-1.5 px-1 text-[10.5px] font-extrabold uppercase tracking-[0.05em] text-[var(--ink-3)]">Suggested for this lesson</div>
            <div className="flex flex-wrap gap-1.5">{suggested.map(pill)}</div>
          </div>
        )}
        {SIDEBAR_GROUPS.map((g) => {
          const items = g.ids.filter((id) => enabled.has(id));
          if (!items.length) return null;
          const open = openGroups.has(g.key);
          return (
            <div key={g.key} className="border-t border-[#F0F0F5] pt-2 first:border-t-0 first:pt-0">
              <button type="button" onClick={() => toggleGroup(g.key)} aria-expanded={open} data-testid={`tools-group-${g.key}`}
                className="flex w-full items-center gap-1.5 py-1 text-left">
                <span className="flex-1 text-[10.5px] font-extrabold uppercase tracking-[0.05em] text-[var(--ink-3)]">{g.label} <span className="font-bold text-[var(--ink-3)]/70">· {items.length}</span></span>
                <Icon name="chevronDown" size={13} className={`text-[var(--ink-3)] transition-transform ${open ? "" : "-rotate-90"}`} />
              </button>
              {open && <div className="mb-1 mt-1 flex flex-wrap gap-1.5">{items.map(pill)}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Small screens: one tool at a time, as a bottom sheet instead of a floating window — drag the handle (or tap
 *  it) to expand from 60% to 90% of the viewport height. */
function MobileToolSheet({ id, label, icon, onClose, children }: { id: HelpToolId; label: string; icon: string; onClose: () => void; children: ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  const dragStart = useRef<number | null>(null);
  return (
    <div role="dialog" aria-label={label} aria-modal="false" data-testid={`tool-sheet-${id}`}
      className="fixed inset-x-0 bottom-0 z-[1200] flex flex-col overflow-hidden rounded-t-2xl border-t border-[var(--line)] bg-[var(--surface)] shadow-[0_-18px_44px_rgba(0,0,0,0.28)] motion-safe:transition-[height] motion-safe:duration-200"
      style={{ height: expanded ? "90vh" : "60vh" }}>
      <div className="flex flex-none touch-none flex-col items-center pb-1 pt-2"
        onPointerDown={(e) => { dragStart.current = e.clientY; }}
        onPointerUp={(e) => { if (dragStart.current !== null) { if (dragStart.current - e.clientY > 30) setExpanded(true); else if (e.clientY - dragStart.current > 30) setExpanded(false); } dragStart.current = null; }}
        onClick={() => setExpanded((x) => !x)}>
        <span aria-hidden className="h-1.5 w-10 rounded-full bg-[var(--line)]" />
      </div>
      <div className="flex flex-none items-center gap-1.5 border-b border-[var(--line)] px-3 pb-2">
        <span aria-hidden className="text-[14px]">{icon}</span>
        <span className="flex-1 truncate text-[13px] font-extrabold text-[var(--ink)]">{label}</span>
        <button type="button" onClick={onClose} aria-label={`Close ${label}`} className="grid h-11 w-11 flex-none place-items-center rounded-lg text-[var(--ink-2)] hover:bg-[var(--panel)]"><Icon name="close" size={16} /></button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3 text-[13px]">{children}</div>
    </div>
  );
}

function TimesTable({ value, onChange }: { value: TimesTableState; onChange: (v: TimesTableState) => void }) {
  const n = value.n;
  return (
    <div>
      <label className="flex items-center gap-2 text-[13px] font-semibold text-[var(--ink-2)]">
        The
        <select value={n} onChange={(e) => onChange({ n: Number(e.target.value) })} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-[13px] font-bold">
          {Array.from({ length: 12 }, (_, i) => i + 1).map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
        times table
      </label>
      <div className="mt-2.5 grid grid-cols-3 gap-1.5">
        {Array.from({ length: 12 }, (_, i) => i + 1).map((x) => (
          <div key={x} className="rounded-lg bg-[var(--panel)] px-2 py-1.5 text-center text-[13px] font-bold text-[var(--ink)]">{n} × {x} = {n * x}</div>
        ))}
      </div>
    </div>
  );
}

function CoordGrid({ value, onChange }: { value: GridState; onChange: (v: GridState) => void }) {
  const pts = value.pts;
  const size = 220, cells = 8, step = size / cells, mid = cells / 2;
  const toGrid = (px: number, py: number) => ({ x: Math.round((px - size / 2) / step), y: Math.round((size / 2 - py) / step) });
  return (
    <div>
      <svg width={size} height={size} className="rounded-lg border border-[var(--line)] bg-[var(--panel)]"
        onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); const p = toGrid(e.clientX - r.left, e.clientY - r.top); onChange({ pts: [...pts.slice(-4), p] }); }}>
        {Array.from({ length: cells + 1 }, (_, i) => (
          <g key={i}>
            <line x1={i * step} y1={0} x2={i * step} y2={size} stroke="var(--line)" />
            <line x1={0} y1={i * step} x2={size} y2={i * step} stroke="var(--line)" />
          </g>
        ))}
        <line x1={size / 2} y1={0} x2={size / 2} y2={size} stroke="var(--ink-3)" strokeWidth={1.5} />
        <line x1={0} y1={size / 2} x2={size} y2={size / 2} stroke="var(--ink-3)" strokeWidth={1.5} />
        {pts.map((p, i) => <circle key={i} cx={size / 2 + p.x * step} cy={size / 2 - p.y * step} r={4} fill="var(--brand)" />)}
      </svg>
      <p className="m-0 mt-2 text-[12px] text-[var(--ink-3)]">Tap the grid to plot a point (−{mid} to {mid}).</p>
      {pts.length > 0 && <p className="m-0 mt-1 text-[12.5px] font-bold text-[var(--ink)]">Last point: ({pts[pts.length - 1]!.x}, {pts[pts.length - 1]!.y})</p>}
    </div>
  );
}

function Ruler() {
  const cm = 24;
  return (
    <div>
      <svg width="100%" height="70" viewBox={`0 0 ${cm * 20} 70`} className="rounded-lg border border-[var(--line)] bg-[var(--panel)]">
        <rect x={0} y={10} width={cm * 20} height={40} fill="var(--surface)" stroke="var(--ink-3)" />
        {Array.from({ length: cm + 1 }, (_, i) => (
          <g key={i}>
            <line x1={i * 20} y1={10} x2={i * 20} y2={i % 5 === 0 ? 38 : 26} stroke="var(--ink)" />
            {i % 5 === 0 && <text x={i * 20 + 2} y={48} fontSize="10" fill="var(--ink-2)">{i}</text>}
          </g>
        ))}
      </svg>
      <p className="m-0 mt-2 text-[12px] text-[var(--ink-3)]">A {cm}cm ruler — measure against your own screen (won&apos;t match a printed page exactly).</p>
    </div>
  );
}

function Protractor() {
  const r = 90;
  return (
    <div className="flex flex-col items-center">
      <svg width={r * 2 + 20} height={r + 30} viewBox={`0 0 ${r * 2 + 20} ${r + 30}`}>
        <path d={`M10,${r + 10} A ${r} ${r} 0 0 1 ${r * 2 + 10},${r + 10}`} fill="none" stroke="var(--ink)" strokeWidth={2} />
        <line x1={10} y1={r + 10} x2={r * 2 + 10} y2={r + 10} stroke="var(--ink)" strokeWidth={2} />
        {Array.from({ length: 19 }, (_, i) => i * 10).map((deg) => {
          const rad = (Math.PI * deg) / 180;
          const x1 = r + 10 - r * Math.cos(rad), y1 = r + 10 - r * Math.sin(rad);
          const inner = deg % 30 === 0 ? r - 12 : r - 6;
          const x2 = r + 10 - inner * Math.cos(rad), y2 = r + 10 - inner * Math.sin(rad);
          return <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--ink-2)" />;
        })}
      </svg>
      <p className="m-0 mt-1 text-[12px] text-[var(--ink-3)]">0°–180° — line up the base with one side of the angle.</p>
    </div>
  );
}

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  const h = now.getHours() % 12, m = now.getMinutes(), s = now.getSeconds();
  const hDeg = h * 30 + m * 0.5, mDeg = m * 6, sDeg = s * 6;
  const hand = (deg: number, len: number, w: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return <line x1={60} y1={60} x2={60 + len * Math.cos(rad)} y2={60 + len * Math.sin(rad)} stroke="var(--ink)" strokeWidth={w} strokeLinecap="round" />;
  };
  return (
    <div className="flex flex-col items-center">
      <svg width={120} height={120}>
        <circle cx={60} cy={60} r={56} fill="var(--panel)" stroke="var(--ink-3)" strokeWidth={2} />
        {Array.from({ length: 12 }, (_, i) => i).map((i) => {
          const rad = ((i * 30 - 90) * Math.PI) / 180;
          return <circle key={i} cx={60 + 46 * Math.cos(rad)} cy={60 + 46 * Math.sin(rad)} r={2} fill="var(--ink-2)" />;
        })}
        {hand(hDeg, 28, 3)}
        {hand(mDeg, 40, 2)}
        {hand(sDeg, 44, 1)}
      </svg>
      <p className="m-0 mt-1.5 text-[13px] font-bold text-[var(--ink)]">{now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
    </div>
  );
}

function Timer({ value, onChange }: { value: TimerState; onChange: (v: TimerState) => void }) {
  const { secs, left, running } = value;
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!running) return;
    ref.current = setInterval(() => onChange({ secs, left: left <= 1 ? 0 : left - 1, running: left > 1 }), 1000);
    return () => { if (ref.current) clearInterval(ref.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, left]);
  const mm = String(Math.floor(left / 60)).padStart(2, "0"), ss = String(left % 60).padStart(2, "0");
  return (
    <div className="flex flex-col items-center">
      <div className="text-[32px] font-extrabold tabular-nums text-[var(--ink)]">{mm}:{ss}</div>
      <div className="mt-2 flex items-center gap-1.5">
        <button type="button" onClick={() => onChange({ secs, left, running: !running })} disabled={left === 0}
          className="rounded-full bg-[var(--brand)] px-3.5 py-1.5 text-[12.5px] font-extrabold text-white disabled:opacity-50">{running ? "Pause" : "Start"}</button>
        <button type="button" onClick={() => onChange({ secs, left: secs, running: false })} className="rounded-full bg-[var(--panel)] px-3.5 py-1.5 text-[12.5px] font-extrabold text-[var(--ink-2)]">Reset</button>
      </div>
      <label className="mt-2 flex items-center gap-1.5 text-[12px] text-[var(--ink-2)]">
        Minutes
        <input type="number" min={1} max={60} defaultValue={Math.round(secs / 60)} onBlur={(e) => { const s = Math.max(10, Math.min(3600, Number(e.target.value) * 60)); onChange({ secs: s, left: running ? left : s, running }); }}
          className="w-14 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-center" />
      </label>
    </div>
  );
}

function Dice({ value, onChange }: { value: DiceState; onChange: (v: DiceState) => void }) {
  const { vals, n } = value;
  const roll = () => onChange({ vals: Array.from({ length: n }, () => 1 + Math.floor(Math.random() * 6)), n });
  const PIPS: Record<number, [number, number][]> = {
    1: [[1, 1]], 2: [[0, 0], [2, 2]], 3: [[0, 0], [1, 1], [2, 2]], 4: [[0, 0], [0, 2], [2, 0], [2, 2]],
    5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]], 6: [[0, 0], [0, 2], [1, 0], [1, 2], [2, 0], [2, 2]],
  };
  return (
    <div className="flex flex-col items-center">
      <div className="flex gap-3">
        {vals.map((v, i) => (
          <svg key={i} width={54} height={54}>
            <rect x={2} y={2} width={50} height={50} rx={8} fill="var(--surface)" stroke="var(--ink-3)" strokeWidth={2} />
            {PIPS[v]!.map(([r, c], j) => <circle key={j} cx={12 + c * 15} cy={12 + r * 15} r={3.5} fill="var(--ink)" />)}
          </svg>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <select value={n} onChange={(e) => onChange({ vals, n: Number(e.target.value) })} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-[12.5px]">
          <option value={1}>1 die</option><option value={2}>2 dice</option>
        </select>
        <button type="button" onClick={roll} className="rounded-full bg-[var(--brand)] px-3.5 py-1.5 text-[12.5px] font-extrabold text-white">Roll</button>
      </div>
    </div>
  );
}

function Tally({ value, onChange }: { value: TallyState; onChange: (v: TallyState) => void }) {
  const n = value.n;
  const groups = Math.floor(n / 5), rem = n % 5;
  const group = (count: number, key: string) => (
    <span key={key} className="relative mr-2 inline-block h-6 w-6" aria-hidden>
      {Array.from({ length: Math.min(count, 4) }, (_, i) => <span key={i} className="absolute bottom-0 top-0 w-[2px] bg-[var(--ink)]" style={{ left: `${i * 6}px` }} />)}
      {count >= 5 && <span className="absolute inset-0 rotate-[35deg] bg-[var(--brand)]" style={{ height: 2, top: "50%" }} />}
    </span>
  );
  return (
    <div className="flex flex-col items-center">
      <div className="flex min-h-[32px] flex-wrap items-center">
        {Array.from({ length: groups }, (_, i) => group(5, `g${i}`))}
        {rem > 0 && group(rem, "rem")}
      </div>
      <div className="mt-2 text-[20px] font-extrabold text-[var(--ink)]">{n}</div>
      <div className="mt-2 flex gap-1.5">
        <button type="button" onClick={() => onChange({ n: Math.max(0, n - 1) })} className="h-8 w-8 rounded-full bg-[var(--panel)] text-[16px] font-extrabold text-[var(--ink-2)]">−</button>
        <button type="button" onClick={() => onChange({ n: n + 1 })} className="h-8 w-8 rounded-full bg-[var(--brand)] text-[16px] font-extrabold text-white">+</button>
        <button type="button" onClick={() => onChange({ n: 0 })} className="rounded-full bg-[var(--panel)] px-3 text-[12px] font-extrabold text-[var(--ink-2)]">Clear</button>
      </div>
    </div>
  );
}

function BarChart({ value, onChange }: { value: BarChartState; onChange: (v: BarChartState) => void }) {
  const text = value.text;
  const vals = text.split(",").map((s) => Math.max(0, Number(s.trim()) || 0)).slice(0, 8);
  const max = Math.max(1, ...vals);
  return (
    <div>
      <label className="block text-[12px] font-semibold text-[var(--ink-2)]">
        Values (comma-separated)
        <input value={text} onChange={(e) => onChange({ text: e.target.value })} className="mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[13px]" />
      </label>
      <div className="mt-3 flex h-[140px] items-end gap-2">
        {vals.map((v, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-1">
            <span className="text-[11px] font-bold text-[var(--ink-2)]">{v}</span>
            <div className="w-full rounded-t-md bg-[var(--brand)]" style={{ height: `${(v / max) * 100}px` }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function Bohr({ value, onChange }: { value: BohrState; onChange: (v: BohrState) => void }) {
  const electrons = value.electrons;
  const shells: number[] = [];
  let left = electrons;
  for (const cap of [2, 8, 8, 18]) { if (left <= 0) break; const take = Math.min(cap, left); shells.push(take); left -= take; }
  const cx = 90, cy = 90;
  return (
    <div className="flex flex-col items-center">
      <svg width={180} height={180}>
        <circle cx={cx} cy={cy} r={6} fill="var(--brand)" />
        {shells.map((count, i) => {
          const r = 22 + i * 20;
          return (
            <g key={i}>
              <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--line)" />
              {Array.from({ length: count }, (_, j) => {
                const a = (2 * Math.PI * j) / count;
                return <circle key={j} cx={cx + r * Math.cos(a)} cy={cy + r * Math.sin(a)} r={3.5} fill="var(--ink)" />;
              })}
            </g>
          );
        })}
      </svg>
      <label className="mt-2 flex items-center gap-2 text-[12px] font-semibold text-[var(--ink-2)]">
        Electrons
        <input type="number" min={1} max={36} value={electrons} onChange={(e) => onChange({ electrons: Math.max(1, Math.min(36, Number(e.target.value))) })}
          className="w-16 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-center" />
      </label>
    </div>
  );
}

const APPARATUS = ["🧪 Test tube", "⚗️ Flask", "🔥 Bunsen burner", "🥽 Goggles", "🧫 Petri dish", "⚖️ Balance", "🌡️ Thermometer", "🧲 Magnet"];
function Apparatus() {
  return (
    <div className="grid grid-cols-2 gap-2">
      {APPARATUS.map((a) => <div key={a} className="rounded-lg bg-[var(--panel)] px-2.5 py-2 text-center text-[13px] font-semibold text-[var(--ink)]">{a}</div>)}
    </div>
  );
}

function Lens() {
  return (
    <div className="flex flex-col items-center">
      <svg width={220} height={110}>
        <line x1={0} y1={55} x2={220} y2={55} stroke="var(--line)" strokeDasharray="4 4" />
        <ellipse cx={110} cy={55} rx={16} ry={45} fill="none" stroke="var(--ink)" strokeWidth={2} />
        <line x1={0} y1={30} x2={90} y2={55} stroke="var(--brand)" />
        <line x1={0} y1={80} x2={90} y2={55} stroke="var(--brand)" />
        <line x1={130} y1={55} x2={220} y2={20} stroke="var(--brand)" />
        <line x1={130} y1={55} x2={220} y2={90} stroke="var(--brand)" />
      </svg>
      <p className="m-0 mt-1 text-[12px] text-[var(--ink-3)]">A converging (convex) lens — parallel rays bend inward to a focus.</p>
    </div>
  );
}

function Timeline({ value, onChange }: { value: TimelineState; onChange: (v: TimelineState) => void }) {
  const { events, year, label } = value;
  const add = () => {
    if (!year.trim() || !label.trim()) return;
    onChange({ events: [...events, { year: year.trim(), label: label.trim() }].sort((a, b) => a.year.localeCompare(b.year)), year: "", label: "" });
  };
  return (
    <div>
      <div className="relative border-l-2 border-[var(--line)] pl-4">
        {events.map((e, i) => (
          <div key={i} className="relative mb-3 pb-1">
            <span className="absolute -left-[21px] top-1 h-3 w-3 rounded-full bg-[var(--brand)]" />
            <div className="text-[12.5px] font-extrabold text-[var(--ink)]">{e.year}</div>
            <div className="text-[12.5px] text-[var(--ink-2)]">{e.label}</div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-1.5">
        <input value={year} onChange={(e) => onChange({ events, year: e.target.value, label })} placeholder="Year" className="w-16 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-[12px]" />
        <input value={label} onChange={(e) => onChange({ events, year, label: e.target.value })} placeholder="Event" className="min-w-0 flex-1 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-[12px]" />
        <button type="button" onClick={add} className="rounded-full bg-[var(--brand)] px-3 text-[12px] font-extrabold text-white">Add</button>
      </div>
    </div>
  );
}

const SYMBOLS = ["+ plus", "− minus", "× times", "÷ divide", "= equals", "≠ not equal", "≈ approx", "< less than", "> greater than", "≤ ≥ at most/least", "% percent", "√ square root", "π pi", "° degrees", "∞ infinity", "∑ sum"];
function Symbols() {
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {SYMBOLS.map((s) => <div key={s} className="rounded-lg bg-[var(--panel)] px-2.5 py-1.5 text-[12.5px] font-semibold text-[var(--ink)]">{s}</div>)}
    </div>
  );
}

function Spinner({ value, onChange }: { value: SpinnerState; onChange: (v: SpinnerState) => void }) {
  const { seg, angle } = value;
  const [spinning, setSpinning] = useState(false);
  const spin = () => {
    if (spinning) return;
    setSpinning(true);
    const extra = 720 + Math.floor(Math.random() * 360);
    onChange({ seg, angle: angle + extra });
    setTimeout(() => setSpinning(false), 1200);
  };
  const colours = ["#2f6bd8", "#15b364", "#B45309", "#8a2fb0", "#bb1620", "#0f7a52", "#1f77c9", "#5b6478"];
  const r = 60, cx = 70, cy = 70;
  return (
    <div className="flex flex-col items-center">
      <svg width={140} height={140} style={{ transform: `rotate(${angle}deg)`, transition: spinning ? "transform 1.2s cubic-bezier(.2,.8,.2,1)" : undefined }}>
        {Array.from({ length: seg }, (_, i) => {
          const a0 = (2 * Math.PI * i) / seg - Math.PI / 2, a1 = (2 * Math.PI * (i + 1)) / seg - Math.PI / 2;
          const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0), x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
          return <path key={i} d={`M${cx},${cy} L${x0},${y0} A${r},${r} 0 0 1 ${x1},${y1} Z`} fill={colours[i % colours.length]} />;
        })}
      </svg>
      <div className="mt-2 flex items-center gap-2">
        <select value={seg} onChange={(e) => onChange({ seg: Number(e.target.value), angle })} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-[12.5px]">
          {[2, 3, 4, 6, 8].map((n) => <option key={n} value={n}>{n} sections</option>)}
        </select>
        <button type="button" onClick={spin} disabled={spinning} className="rounded-full bg-[var(--brand)] px-3.5 py-1.5 text-[12.5px] font-extrabold text-white disabled:opacity-50">Spin</button>
      </div>
    </div>
  );
}

/** One drawer tool, standing alone with its own state — how the Tools tab (tools/ToolHost) runs an existing drawer tool unchanged. */
export function DrawerToolView({ id }: { id: HelpToolId }) {
  const [v, setV] = useState<unknown>(() => TOOL_DEFAULTS[id]);
  return <>{TOOL_RENDER[id](v as ToolStateFor<HelpToolId>, setV as (v: ToolStateFor<HelpToolId>) => void)}</>;
}
