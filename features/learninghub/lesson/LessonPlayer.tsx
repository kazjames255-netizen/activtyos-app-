"use client";

import { useT } from "@/lib/i18n/provider";
import type { RefObject } from "react";
import { createPortal } from "react-dom";
import { put } from "@/lib/api";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { HubSettings } from "@/lib/hubConfig";
import { Icon, FOCUS } from "../kit";
import { Modal } from "../shared-assess/ui";
import { errMsg } from "../types";
import { checkWarmup, fetchLessonQuestions, markLessonViewed, saveLessonSlides, type LessonQuestions } from "./api";
import { DoneStep } from "./DoneStep";
import { LearnStep } from "./LearnStep";
import { useSupport } from "../family/FamilyContext";
import { Btn, Confetti, LessonStyles, StepCard, display } from "./lessonUi";
import { QuizStep, type QuizOutcome } from "./QuizStep";
import { normalizeLesson } from "./types";
import { WarmupStep, type WarmupOutcome } from "./WarmupStep";
import type { WarmupQuestion } from "./api";
import { coverSlideSkipped, SlideDeck } from "./slides/SlideDeck";
import { OakDeckStep } from "./OakDeckStep";
import { WordsStep } from "./WordsStep";
import { ALL_QUESTIONS_KEY, extraToolsForQuestion, normaliseQuestionId, toolsForQuestion } from "../tools/suggest";
import { toolById } from "../tools/registry";
import { ToolPicker } from "./ToolPicker";
import { Z } from "../zLayers";
import { LessonToolsBar } from "./LessonToolsBar";
import { ALL_HELP_TOOL_IDS, HELP_TOOLS, HelpToolsPanel, type HelpToolId } from "../remotesync/HelpTools";
import { getWidget } from "./widgets";
import { ChildChip, useChildGate, WhoIsLearning } from "../family/FamilyContext";
import { rich } from "./tRich";
import { AskTeacher, type AskContext } from "./doubts/AskTeacher";

// The interactive lesson player: Start → Learn → Key words → Warm-up → Quiz → Done, one small step at a time, with a sticky
// header (progress, XP, streak), confetti and the licence credit. It renders a hubNotes doc's structured `lesson` field.
//
// Real vs practice: the warm-up is instant-feedback practice (nothing stored); the exit quiz is a REAL attempt on the real
// assessment, so results / mastery / retake rules are the server's. `readOnly` = a tutor's preview: nothing is started or saved.

type StepId = "start" | "learn" | "slides" | "words" | "warm" | "quiz" | "done";
const STEP_KEY: Record<StepId, string> = { start: "hublessons.stepStart", learn: "hublessons.stepLearn", slides: "hublessons.stepLesson", words: "hublessons.keyWordsTag", warm: "hublessons.kindWarmup", quiz: "hublessons.quizTag", done: "hublessons.stepDone" };

/** Remote-sync "own_pace" mini-screens — see `onLiveAnswer` below. `questionId`/`questionPrompt`/`response`/`verdict`
 *  are only ever present while `step` is "warm" or "quiz"; any other step reports just the bare position. */
export interface LiveAnswerPosition { step: StepId; slide: number; questionId?: string; questionPrompt?: string; response?: unknown; verdict?: boolean | null }

/** In-person class mode (features/learninghub/inperson): a TUTOR runs this lesson on their own device with children beside them
 *  (pair it with `readOnly`, so nothing is started here). The player keeps its steps; these slots swap what is recorded. */
export interface InPersonSlots {
  /** Replaces the "Preview — nothing is saved" note. */
  banner: ReactNode;
  /** The exit quiz step: the tutor's per-child capture grid instead of one child's paper. `onFinish` moves on to Done. */
  quiz: (p: { quiz: { id: string; title: string; questionCount: number }; onFinish: () => void; onBack: () => void }) => ReactNode;
  /** Under each warm-up question: "show the answer" and the per-child tally. */
  warmupExtra?: (q: WarmupQuestion) => ReactNode;
  /** The Done step: the per-child result summary and follow-up. */
  done: (p: { onExit: () => void }) => ReactNode;
}

/** Remote-sync "I answer, they watch" (pace "driven", features/learninghub/remotesync): the TUTOR taps in warm-up/quiz
 *  answers for the connected class (same tag-a-child-onto-an-option idea as in-person, different data underneath — a
 *  real per-child attempt via the ordinary /assessments/:id/attempts + /attempts/:id/submit routes, the tutor calling on
 *  each child's behalf). Pair with `readOnly` and `onProgress`; students' own screens just broadcast-follow. */
export interface DrivenSlots {
  /** Replaces the "Preview — nothing is saved" note (answers here ARE real, so that note would be wrong). */
  banner: ReactNode;
  /** The exit quiz step: the tutor's per-child tagging grid. `onFinish` moves on to Done once every child's real attempt is submitted. */
  quiz: (p: { quiz: { id: string; title: string; questionCount: number }; onFinish: () => void; onBack: () => void }) => ReactNode;
  /** Under each warm-up question: tag which connected child said what. */
  warmupExtra?: (q: WarmupQuestion) => ReactNode;
}

export interface LessonPlayerProps {
  note: { id: string; title: string; lesson: unknown };
  /** "?tenantId=…" — appended to attempt calls (the child rides along as ?childId=). */
  qs: string;
  /** "?tenantId=…&childId=…" for a family, else the same as qs. */
  childQs: string;
  childId: string | null;
  config: HubSettings;
  /** Tutor preview: nothing is started, saved or counted. */
  readOnly?: boolean;
  /** Tutor preview only: the lesson's subject / year, so each question can show which help tool (if any) a child would get on it. */
  subject?: string; year?: number | null;
  onExit: () => void;
  /** Ask the shell to hide its hero / sidebar while a pupil is in the lesson. Released on unmount. */
  setFocus?: (on: boolean, opts?: { bare?: boolean }) => void;
  /** Jump to another hub tab ("flashcards"). */
  goTo?: (key: "flashcards") => void;
  /** Tutor preview: called with the updated note after the slides were edited or a slide deleted. */
  onLessonSaved?: (note: unknown) => void;
  /** Live lessons: told the step (and slide) the player is on, so a tutor teaching in a call can carry the students along. */
  onProgress?: (p: { step: string; slide: number }) => void;
  /** Live lessons: follow this step/slide (the tutor's). Ignored while the pupil is in the exit quiz or on the result, so a real attempt is never yanked away. */
  follow?: { step: string; slide: number } | null;
  /** How `follow` behaves — only meaningful alongside it. Left out (video-call lessons, and remote-sync's "driven"): the
   *  screen is forcibly teleported to the tutor's step, same as always. "lockstep": no forced teleport, but this pupil's
   *  own Next/Continue/Finish can never move them PAST the tutor's current top-level step (they can still fully answer
   *  within it). "own_pace": `follow` is ignored outright — no gating at all. */
  pace?: "driven" | "lockstep" | "own_pace";
  /** Remote-sync "own_pace" mini-screens: this pupil's REAL current position, for a tutor elsewhere to see live.
   *  Fired (debounced by the caller, not here) on every step/slide change — mirroring `onProgress`'s own step
   *  tracking below, just reported to the mini-screens channel instead of the tutor's `follow` position — AND, more
   *  often, whenever the current warm-up/quiz answer changes (with the question's prompt, and, warm-up only, the
   *  Check verdict once known). Never affects marking. */
  onLiveAnswer?: (p: LiveAnswerPosition) => void;
  /** The warm-up / quiz question on screen right now (null on slides and everywhere else) — fired as soon as it is shown, before any answer. Drives per-question help tools. */
  onQuestion?: (q: { id: string; prompt: string; step: string } | null) => void;
  /** Tutor-led class mode — see InPersonSlots. */
  inPerson?: InPersonSlots;
  /** Remote-sync "I answer, they watch" mode — see DrivenSlots. */
  driven?: DrivenSlots;
  /** Opened from a homework: the exit quiz is recorded against it. */
  homeworkId?: string | null;
  /** Hides the Start step's button entirely — NotesPanel's "Open" flow shows the lesson info card as pure
   *  information; the "One room" / "Share with children" choice cards below it are the only way to actually start.
   *  NOT used for a plain tutor preview (LessonTutorPanel's "Preview lesson"), which needs this button to step
   *  through the deck on its own, with no roster or session. */
  hideStartButton?: boolean;
  /** Extra classes on the Start step's card — NotesPanel's "Open" flow uses this to flatten its bottom corners/shadow
   *  so the choice cards below can sit flush underneath it, as one continuous card. */
  startCardClassName?: string;
  /** Hides the "Preview" banner, the progress header (close/streak/XP) and the step tracker — for NotesPanel's
   *  "Open" decision screen, where nothing has started yet so none of that means anything. Exiting is via the
   *  page's own Back button instead. NOT used for a plain tutor preview, which shows this header normally. */
  hideHeader?: boolean;
  /** The host page already has its own Back control (the tutor's Lessons preview), so the header's X would be a second way out (L3). */
  hideLeave?: boolean;
  /** Remote-sync's student page has its own "Ask your teacher" sidebar card (same hubDoubts thread, context-tagged
   *  identically) — suppress this inline banner there so the pupil isn't offered two askers for the same thing. */
  hideAskTeacher?: boolean;
  /** Remote-sync's teacher/student pages: renders banner + header + content as flush sections of ONE outer card
   *  (LessonCard.tsx supplies the border/radius/background) instead of each piece floating as its own bordered
   *  box with its own width. No visual change to any OTHER caller — home/homework lessons keep their own look. */
  flatShell?: boolean;
}

// A pupil's place in a lesson survives a refresh / Back (this tab only): the step, XP and streak. Dropped when they leave on purpose or finish.
const progKey = (noteId: string, childId: string | null) => `hublesson:${childId ?? "-"}:${noteId}`;
const loadProg = (k: string): { step?: string; xp?: number; streak?: number } | null => { try { const r = sessionStorage.getItem(k); return r ? JSON.parse(r) : null; } catch { return null; } };
const saveProg = (k: string, v: { step: string; xp: number; streak: number }) => { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const dropProg = (k: string) => { try { sessionStorage.removeItem(k); } catch { /* ignore */ } };

/** Tutor preview: which help tool(s) a child would be offered on the question in view. The provider can switch the DEFAULT tool off / on, and ADD any
 *  tool to this question from a list of every tool. Saved for the provider (settings.hub.questionToolsOff / questionToolsAdd); a child's screen obeys it,
 *  and the tools shown here can be tried straight away. */
function QuestionToolNote({ heading, id, prompt, subject, year, cardRef, off, add, onSave, qs }: { heading?: string; id: string; prompt: string; subject: string; year: number | null; cardRef: RefObject<HTMLDivElement | null>; off: string[]; add: Record<string, string[]>; onSave: (patch: { off?: boolean; add?: string[]; all?: string[] }) => Promise<void>; qs: string }) {
  const tr = useT();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const key = normaliseQuestionId(id);
  // A LESSON's tools are only the ones the provider added to the lesson (no wording suggestions, and "every question" tools don't apply).
  const isLesson = id.startsWith("lesson:");
  if (isLesson) { prompt = ""; add = { [key]: add[key] ?? [] }; }
  const isOff = off.includes(key);
  const added = (add[key] ?? []).filter((t) => !(add[ALL_QUESTIONS_KEY] ?? []).includes(t));
  const everyQ = add[ALL_QUESTIONS_KEY] ?? [];
  const extraIds = extraToolsForQuestion({ id }, add, ALL_HELP_TOOL_IDS);
  const dflt = toolsForQuestion({ id, prompt, subject, year }, ALL_HELP_TOOL_IDS);           // what the question gets by default
  const tools = toolsForQuestion({ id, prompt, subject, year }, ALL_HELP_TOOL_IDS, off, add); // what a child actually gets now
  const allNames = [...tools, ...extraIds].map((t) => HELP_TOOLS.find((h) => h.id === t)?.label ?? toolById(t)?.title ?? t);
  const label = (t: string) => HELP_TOOLS.find((h) => h.id === t)?.label ?? toolById(t)?.title ?? t;
  const run = async (patch: { off?: boolean; add?: string[]; all?: string[] }) => { setBusy(true); setErr(null); try { await onSave(patch); } catch (e) { setErr(errMsg(e, tr("hublessons.couldntSave"))); } finally { setBusy(false); } };
  const chip = "inline-flex items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 text-[12px] font-extrabold text-[var(--ink)]";
  // The tools live in a docked side panel on the RIGHT of the lesson (not above it): status, on/off, add-a-tool, and the tools themselves to try.
  // Portalled out of the lesson (like the tool windows): a `fixed` box inside an animated / transformed ancestor is positioned against THAT, not the screen.
  // Centre the dock in the free space between the lesson column and the right edge of the screen (equal room on both sides); tight screens keep it at the edge.
  const dockRef = useRef<HTMLElement>(null);
  const [dockLeft, setDockLeft] = useState<number | null>(null);
  const [dockOpen, setDockOpen] = useState(false);
  // Collapsed (tight) dock button: parked in the free strip UNDER the lesson card when there is one (never on top of the slide), else at the corner.
  const [btnTop, setBtnTop] = useState<number | null>(null);
  // The corner fallback used to be a bare bottom-right pin — the exact spot the step's OWN nav footer (Back/Next,
  // e.g. SlideDeck.tsx's `sticky bottom-0` bar) sticks to once its card is taller than the viewport, so the dock
  // button (z-index above it, Z.dock) sat on top of "Next" and ate its clicks (factory-shots.spec.ts, 29 Sep: the
  // preview's Next button intercepted at some scroll position). Measure the real "lesson-next" button and always
  // park the fallback just above it instead of assuming the corner is free.
  const [cornerBottom, setCornerBottom] = useState(16);
  const tight = dockLeft === null; // no free room beside the lesson (tablet / phone): the dock collapses to a button so it never covers the question
  useEffect(() => {
    const place = () => {
      const r = cardRef.current?.getBoundingClientRect(), w = dockRef.current?.getBoundingClientRect().width ?? 250, vw = window.innerWidth;
      if (!r) return;
      const gap = vw - r.right;
      setDockLeft(gap >= w + 24 ? Math.round(r.right + (gap - w) / 2) : null);
      setBtnTop(window.innerHeight - r.bottom >= 60 && r.bottom > 0 ? Math.round(r.bottom + 8) : null);
      const navTop = document.querySelector('[data-testid="lesson-next"]')?.getBoundingClientRect().top;
      setCornerBottom(navTop != null && navTop < window.innerHeight ? Math.max(16, Math.round(window.innerHeight - navTop + 12)) : 16);
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, { passive: true, capture: true });
    const ro = typeof ResizeObserver !== "undefined" && cardRef.current ? new ResizeObserver(place) : null; if (ro && cardRef.current) ro.observe(cardRef.current);
    return () => { window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); ro?.disconnect(); };
  }, [cardRef]);
  if (typeof document === "undefined") return null;
  return createPortal(
    <aside ref={dockRef} data-testid="preview-tool-dock" style={{ zIndex: Z.dock, ...(tight && !dockOpen ? (btnTop !== null ? { top: btnTop } : { bottom: cornerBottom }) : {}), ...(dockLeft === null ? {} : { left: dockLeft, right: "auto" }) }} data-open="1" aria-label={tr("hublessons.tqAside")}
      className={`pointer-events-none fixed end-3 flex w-[min(250px,calc(100vw-1.5rem))] ${tight && !dockOpen ? "justify-end" : "inset-y-0 items-center"}`}>
      {tight && !dockOpen && (
        <button type="button" onClick={() => setDockOpen(true)} aria-expanded="false" data-testid="preview-tool-dock-open"
          className={`pointer-events-auto inline-flex min-h-[44px] items-center gap-2 rounded-full border border-[var(--brand)] bg-[var(--surface)] px-4 text-[13px] font-extrabold text-[var(--ink)] shadow-lg ${FOCUS}`}>🧰 {heading ?? tr("hublessons.toolsForQuestion")}</button>
      )}
      {(!tight || dockOpen) && (
        <div className="pointer-events-auto max-h-[calc(100vh-7rem)] min-h-0 w-full overflow-y-auto rounded-[22px] p-[2px] shadow-[0_22px_60px_rgba(40,30,120,0.28)]" style={{ background: "linear-gradient(160deg, var(--brand), var(--violet, #7c4dff) 55%, var(--gold, #f5b81f))" }}>
          <div className="rounded-[20px] bg-[var(--surface)] p-3.5 backdrop-blur">
            <div className="mb-2.5 flex items-center gap-2.5">
              {tight && <button type="button" onClick={() => setDockOpen(false)} aria-label={tr("hubtoolsui.collapseTools")} data-testid="preview-tool-dock-close" className={`order-last grid h-11 w-11 flex-none place-items-center rounded-full border border-[var(--line)] text-[14px] font-extrabold ${FOCUS}`}>✕</button>}
              <span aria-hidden className="grid h-10 w-10 flex-none place-items-center rounded-2xl text-[20px] text-white" style={{ background: "linear-gradient(135deg, var(--brand), var(--violet, #7c4dff))" }}>🧰</span>
              <div className="min-w-0">
                <div className="text-[14px] font-extrabold leading-tight text-[var(--ink)]">{heading ?? tr("hublessons.toolsForQuestion")}</div>
                <div className="text-[11.5px] font-semibold text-[var(--ink-3)]">{tr("hublessons.tqOnlyYou")}</div>
              </div>
            </div>
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-3 text-[12.5px] font-bold text-[var(--ink-2)]" data-testid="preview-question-tool" data-tools={tools.join(",")} data-off={isOff ? "1" : "0"} role="status">
              <div className="flex items-start gap-2">
                <span className="min-w-0 flex-1">
                  {allNames.length === 0 ? <>{isLesson ? tr("hublessons.tqNoToolLesson") : dflt.length === 0 ? tr("hublessons.tqNoToolWhy") : tr("hublessons.tqNoToolOff")}</>
                    : <>{rich(tr("hublessons.tqChildGets"), { names: <b className="text-[var(--ink)]">{allNames.join(", ")}</b> })}</>}
                </span>
                {dflt.length > 0 && (
                  <button type="button" role="switch" aria-checked={!isOff} disabled={busy} onClick={() => run({ off: !isOff })} data-testid="preview-tool-switch" aria-label={isOff ? tr("hublessons.tqTurnOn") : tr("hublessons.tqTurnOff")}
                    className={`inline-flex min-h-[44px] flex-none items-center gap-2 rounded-full border px-3 text-[12.5px] font-extrabold ${FOCUS} ${isOff ? "border-[var(--line)] bg-[var(--surface)] text-[var(--ink-2)]" : "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand-strong,var(--brand))]"}`}>
                    <span aria-hidden className={`relative inline-block h-4 w-7 rounded-full ${isOff ? "bg-[var(--line)]" : "bg-[var(--brand)]"}`}><span className="absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all" style={{ left: isOff ? 2 : 14 }} /></span>
                    {busy ? tr("hublessons.saving") : isOff ? tr("hublessons.off") : tr("hublessons.on")}
                  </button>
                )}
              </div>
              <div className="mt-2.5"><ToolPicker lesson={isLesson} taken={[...tools, ...extraIds]} disabled={busy} onPick={(v) => void run({ add: [...added, v] })} /></div>
              {added.length > 0 && (
                <div className="mt-2 grid gap-1.5" data-testid="tool-add-all">
                  {added.map((t) => (
                    <button key={t} type="button" disabled={busy} onClick={() => void run({ all: [...everyQ, t], add: added.filter((x) => x !== t) })} data-testid={`tool-add-all-${t}`}
                      className={`inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-full border border-[var(--brand)] bg-[var(--brand-soft)] px-3 text-[12px] font-extrabold text-[var(--brand-strong,var(--brand))] ${FOCUS}`}>
                      {tr("hublessons.tqUseOnAll", { tool: label(t) })}
                    </button>
                  ))}
                </div>
              )}
              {everyQ.length > 0 && (
                <div className="mt-2" data-testid="tool-every-question">
                  <div className="mb-1 text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">{tr("hublessons.tqEveryQuestion")}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {everyQ.map((t) => (
                      <span key={t} className={chip}>★ {label(t)}
                        <button type="button" disabled={busy} onClick={() => void run({ all: everyQ.filter((x) => x !== t) })} aria-label={tr("hublessons.tqStopUsing", { tool: label(t) })} data-testid={`tool-every-remove-${t}`} className={`-my-2 ms-0.5 inline-grid h-11 min-w-[44px] place-items-center text-[12px] ${FOCUS}`}>✕</button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {err && <div className="mt-1.5 text-[12px] font-bold text-[var(--red,#b3261e)]" role="alert">{err}</div>}
            </div>
            {/* The provider can TRY every tool a child gets on this very question (instruments open on the picture by themselves). */}
            {(tools.length > 0 || extraIds.length > 0) && <div className="mt-3" data-testid="preview-try-tool"><HelpToolsPanel tools={ALL_HELP_TOOL_IDS} questionTools={tools} questionKey={id} questionPrompt={prompt} lessonCardRef={cardRef} extraIds={extraIds} qs={qs} addedIds={added} onRemoveAdded={(t) => void run({ add: added.filter((x) => x !== t) })} /></div>}
          </div>
        </div>
      )}
    </aside>,
    document.getElementById("learning-hub") ?? document.body,
  );
}

export function LessonPlayer({ note, qs, childQs, childId, config, readOnly = false, subject, year, onExit, setFocus, goTo, onLessonSaved, onProgress, follow, pace, onLiveAnswer, onQuestion, inPerson, driven, homeworkId, hideStartButton, startCardClassName, hideHeader, hideLeave, flatShell, hideAskTeacher }: LessonPlayerProps) {
  const t = useT();
  const lesson = useMemo(() => normalizeLesson(note.lesson, note.title), [note.lesson, note.title]);
  const widget = useMemo(() => getWidget(lesson.widget), [lesson.widget]);

  const [data, setData] = useState<LessonQuestions | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const pk = progKey(note.id, childId);
  const saved = useMemo(() => (readOnly || typeof window === "undefined" ? null : loadProg(pk)), [readOnly, pk]);
  const [step, setStep] = useState<StepId>(() => (saved?.step && saved.step in STEP_KEY && saved.step !== "done" ? (saved.step as StepId) : "start"));
  const calm = useSupport().calm; // R-5: no streak / XP / confetti in Calm
  const [xp, setXp] = useState(() => saved?.xp ?? 0);
  const [streak, setStreak] = useState(() => saved?.streak ?? 0);
  const gate = useChildGate(childId);
  const [xpKey, setXpKey] = useState(0);
  const [burst, setBurst] = useState({ n: 0, scale: 1 });
  const [warm, setWarm] = useState<{ ok: number; total: number } | null>(null);
  const [quiz, setQuiz] = useState<QuizOutcome | null>(null);
  const [round, setRound] = useState(0);
  const [leave, setLeave] = useState(false);
  const streakRef = useRef(saved?.streak ?? 0);
  const top = useRef<HTMLDivElement>(null);
  // Tutor preview: the tools this provider switched OFF / ADDED per question (saved in their hub settings; a family's screen obeys them).
  const [toolsOff, setToolsOffLocal] = useState<string[]>(config.questionToolsOff ?? []);
  const [toolsAdd, setToolsAddLocal] = useState<Record<string, string[]>>(config.questionToolsAdd ?? {});
  const saveToolChoice = async (patch: { off?: boolean; add?: string[]; all?: string[] }) => {
    // On a question the tools belong to that question; on the lesson itself (start / slides / words) they belong to the whole lesson.
    const target = step === "warm" || step === "quiz" ? qCtx : { id: `lesson:${note.id}`, prompt: lesson.title };
    if (!target) return;
    const key = normaliseQuestionId(target.id);
    const body: { questionToolsOff?: string[]; questionToolsAdd?: Record<string, string[]> } = {};
    if (patch.off !== undefined) body.questionToolsOff = patch.off ? [...new Set([...toolsOff, key])] : toolsOff.filter((k) => k !== key);
    if (patch.all) { const m = { ...toolsAdd }; if (patch.all.length) m[ALL_QUESTIONS_KEY] = patch.all; else delete m[ALL_QUESTIONS_KEY]; body.questionToolsAdd = m; }
    if (patch.add) { const m = { ...(body.questionToolsAdd ?? toolsAdd) }; if (patch.add.length) m[key] = patch.add; else delete m[key]; body.questionToolsAdd = m; }
    await put(`/api/learning-hub/config${qs}`, { hub: body });
    if (body.questionToolsOff) setToolsOffLocal(body.questionToolsOff);
    if (body.questionToolsAdd) setToolsAddLocal(body.questionToolsAdd);
  };

  // Focus mode: hide the hub's own header + sidebar while a lesson is open; always release.
  const focusRef = useRef(setFocus);
  focusRef.current = setFocus;
  useEffect(() => { focusRef.current?.(true, { bare: true }); return () => focusRef.current?.(false); }, []);

  const load = useCallback(() => {
    setLoadErr(null);
    fetchLessonQuestions(note.id, childQs).then(setData).catch((e) => setLoadErr(errMsg(e, t("hublessons.lpLoadErr"))));
  }, [note.id, childQs]);
  useEffect(() => { load(); }, [load]);

  const hasWarm = (data?.warmup.length ?? lesson.warmupQuestionIds.length) > 0;
  const hasQuiz = data ? !!data.quiz : !!lesson.quizId;
  const hasDeck = lesson.deckSlides.length > 0; // Oak's real deck imported as our own editable canvas slides
  const hasSlides = lesson.slides.length > 0 || hasDeck || !!lesson.oakDeck;
  const [ownSlides, setOwnSlides] = useState(false); // a learner/tutor can swap Oak's real deck for our summary slides
  const summaryView = ownSlides && lesson.slides.length > 0;
  const slideCount = hasDeck && !summaryView ? lesson.deckSlides.length - (coverSlideSkipped(lesson.deckSlides) ? 1 : 0) : lesson.slides.length;
  // A slide-deck lesson runs like Oak's own: warm-up questions, then the slides (they carry the key words), then the exit quiz.
  const steps = useMemo<StepId[]>(() => (hasSlides
    ? ["start", ...(hasWarm ? ["warm" as const] : []), "slides", ...(hasQuiz ? ["quiz" as const] : []), "done"]
    : ["start", ...(lesson.points.length || widget ? ["learn" as const] : []), ...(lesson.keywords.length ? ["words" as const] : []), ...(hasWarm ? ["warm" as const] : []), ...(hasQuiz ? ["quiz" as const] : []), "done"]),
  [hasSlides, lesson.points.length, lesson.keywords.length, widget, hasWarm, hasQuiz]);
  // A restored step this lesson doesn't have (its shape changed) falls back to the start.
  useEffect(() => { if (data && !steps.includes(step)) setStep("start"); }, [data, steps, step]);
  // In-person, remote-sync or a driven video call: the tutor already picked who's here / went live to get to this
  // screen — an extra "Start the lesson" click on top of that is a pointless step, so any already-live session
  // (`inPerson`, or broadcasting position via `onProgress`) skips straight past it once the questions have loaded.
  const live = !!inPerson || !!onProgress;
  useEffect(() => { if (live && data && step === "start" && steps.length > 1) setStep(steps[1]!); }, [live, data, step, steps]);
  useEffect(() => {
    if (readOnly) return;
    if (step === "start" || step === "done") { dropProg(pk); return; }
    saveProg(pk, { step, xp, streak });
  }, [readOnly, pk, step, xp, streak]);
  // "Studied" tick: a real pupil (not a tutor preview, not a bare tutor-run in-person/driven session with no one
  // child) reaching Done has actually gone through the lesson — record it once, independent of the exit quiz
  // existing or being finished (see server/src/routes/hub/lessonApi.ts POST /notes/:id/viewed). Fire-and-forget;
  // never blocks or shows an error. Guarded so a re-render (or a restart's trip back through "done") sends it once.
  const viewedSentRef = useRef(false);
  useEffect(() => {
    if (readOnly || !childId || step !== "done" || viewedSentRef.current) return;
    viewedSentRef.current = true;
    void markLessonViewed(note.id, childQs).catch(() => undefined);
  }, [readOnly, childId, step, note.id, childQs]);
  const at = Math.max(0, steps.indexOf(step));
  const followStep = follow?.step ?? null;
  // "lockstep": this pupil moves themselves, but Next/Continue/Finish (all routed through `go`) can never carry them
  // past the tutor's current top-level step — they can still fully answer within whichever step that is.
  // "driven": the tutor captures one REAL per-child attempt for the whole class from their own device
  // (RemoteDrivenQuizGrid) — this pupil's own screen must never itself reach the real quiz/result (that would be a
  // second, independent real attempt for the same child). Cap one step short of "quiz" so Start/Next/Continue can
  // still carry them anywhere up to it (matches "renders completely normally"), never into it.
  const capIndex = useMemo(() => {
    if ((pace !== "lockstep" && pace !== "driven") || !followStep) return null;
    const i = steps.indexOf(followStep as StepId);
    if (i < 0) return null;
    if (pace === "driven") {
      const quizIdx = steps.indexOf("quiz" as StepId);
      return quizIdx >= 0 ? Math.min(i, quizIdx - 1) : i;
    }
    return i;
  }, [pace, followStep, steps]);
  const go = useCallback((s: StepId) => {
    if (capIndex !== null && steps.indexOf(s) > capIndex) return;
    setStep(s);
  }, [capIndex, steps]);
  // A step restored from sessionStorage (or otherwise already set) can predate this cap — e.g. this child played the
  // same lesson solo earlier and got further than the tutor now is, then joined a lockstep/driven session. Snap back
  // down rather than trusting the stale value; this only ever moves `step` backward, never forward on its own.
  useEffect(() => {
    if (capIndex === null) return;
    setStep((s) => (steps.indexOf(s) > capIndex ? (steps[capIndex] as StepId) : s));
  }, [capIndex, steps]);

  // "Ask my teacher": the exact warm-up/quiz question on screen right now (a slide's own title stands in for
  // "slides" — see `askContext` below), reported by WarmupStep/QuizStep's `onView` as soon as it's shown.
  const [qCtx, setQCtx] = useState<{ id: string; prompt: string } | null>(null);
  useEffect(() => { setQCtx(null); }, [step]);
  const onQuestionRef = useRef(onQuestion);
  onQuestionRef.current = onQuestion;
  useEffect(() => { onQuestionRef.current?.(qCtx && (step === "warm" || step === "quiz") ? { ...qCtx, step } : null); }, [qCtx, step]);

  // Live lessons: report where we are, and follow the tutor (never out of the quiz / the result, never into them).
  const [slide, setSlide] = useState(0);
  const progressRef = useRef(onProgress);
  progressRef.current = onProgress;
  useEffect(() => { progressRef.current?.({ step, slide: step === "slides" ? slide : 0 }); }, [step, slide]);
  // Remote-sync "own_pace" mini-screens: report this pupil's bare position on every step/slide change, mirroring the
  // onProgress effect above. Skipped for warm/quiz — WarmupStep/QuizStep's own onLiveAnswer calls already report
  // {step: "warm"|"quiz", ...} themselves, richer (question + answer), so this would just be a redundant, blanker write.
  const liveAnswerRef = useRef(onLiveAnswer);
  liveAnswerRef.current = onLiveAnswer;
  useEffect(() => {
    if (step === "warm" || step === "quiz") return;
    liveAnswerRef.current?.({ step, slide: step === "slides" ? slide : 0 });
  }, [step, slide]);
  useEffect(() => {
    // "lockstep" / "own_pace": this pupil's own screen moves itself (see `go`'s cap, or nothing at all) — it is never
    // teleported. Anything else (video-call lessons, remote-sync "driven") keeps the original forced-follow.
    if (pace === "lockstep" || pace === "own_pace") return;
    if (!followStep || step === "quiz" || step === "done") return;
    if (followStep === "quiz" || followStep === "done") return;
    if ((steps as string[]).includes(followStep)) setStep(followStep as StepId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [followStep, steps, pace]);
  // Same exemption for the slide index *within* the "slides" step: lockstep/own_pace pupils move their own slides
  // freely (that's the "fully answer within the current step" half of the contract) — only non-gated paces (driven,
  // video-call lessons) get forcibly carried to the tutor's exact slide.
  const slideFollowIndex = pace !== "lockstep" && pace !== "own_pace" && followStep === "slides" ? follow?.slide ?? null : null;
  const next = () => go(steps[Math.min(steps.length - 1, at + 1)]);
  const back = () => go(steps[Math.max(0, at - 1)]);

  // Each step change brings the top of the lesson into view.
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    top.current?.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
  }, [step, round]);

  const addXP = useCallback((n: number) => { setXp((x) => x + n); setXpKey((k) => k + 1); }, []);
  const scored = useCallback((ok: boolean, hinted: boolean) => {
    if (ok) {
      streakRef.current += 1;
      addXP(hinted ? 7 : 10 + Math.min(5, streakRef.current));
      if (streakRef.current >= 3) setBurst((b) => ({ n: b.n + 1, scale: 0.3 }));
    } else streakRef.current = 0;
    setStreak(streakRef.current);
  }, [addXP]);

  const finishQuiz = (o: QuizOutcome) => {
    setQuiz(o);
    if (o.result) {
      const right = o.result.answers.filter((a) => a.correct === true).length;
      addXP(right * 10);
    }
    addXP(20);
    setBurst((b) => ({ n: b.n + 1, scale: 1 }));
    go("done");
  };

  const restart = () => {
    streakRef.current = 0;
    setXp(0); setStreak(0); setWarm(null); setQuiz(null); setRound((r) => r + 1); go("start");
  };

  // "Ask my teacher"'s context: a slide's own title (real, readable content — never just "slide 3"), or the exact
  // warm-up/quiz question on screen; nothing for Start/Learn/Key words/Done, where there's no one specific thing to ask about.
  const activeSlideTitle = step === "slides" ? (hasDeck && !summaryView ? lesson.deckSlides[slide]?.title : lesson.slides[slide]?.title) ?? null : null;
  const askContext: AskContext = step === "warm" || step === "quiz"
    ? { step, slide: 0, questionId: qCtx?.id ?? null, questionPrompt: qCtx?.prompt ?? null }
    : { step, slide, questionId: null, questionPrompt: activeSlideTitle };

  const leaveNow = () => { dropProg(pk); onExit(); };
  const exit = () => { if (step !== "start" && step !== "done" && !readOnly) setLeave(true); else leaveNow(); };
  const minutes = Math.max(5, Math.round(((hasSlides ? slideCount * 0.75 : lesson.points.length * 1.5) + lesson.keywords.length * 0.5 + ((data?.warmup.length ?? 0) + (data?.quiz?.questionCount ?? 0)) * 0.75) / 5) * 5);

  return (
    <div ref={top} className={flatShell ? "scroll-mt-2" : "mx-auto w-full max-w-[820px] scroll-mt-2"} data-testid="lesson-player" data-step={step}>
      <LessonStyles />
      <Confetti fire={burst.n} scale={burst.scale} />
      {readOnly && (inPerson?.banner ?? driven?.banner)}
      {readOnly && !inPerson && !driven && step !== "warm" && step !== "quiz" && step !== "done" && <QuestionToolNote heading={t("hublessons.toolsForLessonPlain")} id={`lesson:${note.id}`} prompt={lesson.title} subject={subject ?? ""} year={year ?? null} cardRef={top} off={toolsOff} add={toolsAdd} onSave={saveToolChoice} qs={qs} />}
      {!readOnly && step !== "warm" && step !== "quiz" && step !== "done" && <LessonToolsBar ids={toolsAdd[`lesson:${note.id}`] ?? []} qs={qs} />}
      {readOnly && qCtx && (step === "warm" || step === "quiz") && <QuestionToolNote id={qCtx.id} prompt={qCtx.prompt} subject={subject ?? ""} year={year ?? null} cardRef={top} off={toolsOff} add={toolsAdd} onSave={saveToolChoice} qs={qs} />}
      {readOnly && !inPerson && !driven && !hideHeader && (
        flatShell ? (
          <div role="note" className="flex items-center gap-2 px-[20px] py-[10px] text-[13px] font-semibold text-[var(--brand)]" style={{ background: "#EEF0FB" }}>
            <Icon name="eye" size={16} className="flex-none" />{t("hublessons.previewBanner")}
          </div>
        ) : (
          <div role="note" className="mb-3 flex items-center gap-2 rounded-xl border border-[var(--line)] border-s-4 border-s-[var(--brand-2)] bg-[var(--panel)] px-3.5 py-2.5 text-[13px] font-semibold text-[var(--ink)]">
            <Icon name="eye" size={16} className="flex-none text-[var(--brand-2)]" />{t("hublessons.previewBanner")}
          </div>
        )
      )}

      {!hideHeader && (
        <header className={flatShell ? "px-[28px] py-[24px]" : "sticky top-0 z-10 -mx-1 mb-4 rounded-2xl border border-[var(--line)] bg-[var(--surface)]/95 px-3 pb-2.5 pt-2 shadow-[var(--shadow-sm)] backdrop-blur sm:px-4"}>
          <div className="flex items-center gap-2.5">
            {!hideLeave && <button type="button" onClick={exit} aria-label={readOnly ? t("hublessons.closePreview") : t("hublessons.leaveThisLesson")} data-testid="lesson-leave-open"
              className={`flex flex-none items-center gap-1.5 ${FOCUS} ${readOnly ? "h-11 w-11 justify-center rounded-xl text-[var(--ink-2)] hover:bg-[var(--panel)]" : "h-9 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 text-[12.5px] font-extrabold text-[var(--ink-2)] hover:border-[var(--red)] hover:bg-[var(--red-soft)] hover:text-[var(--red)]"}`}>
              <Icon name="close" size={readOnly ? 20 : 15} />{!readOnly && t("hublessons.leaveLesson")}
            </button>}
            {!readOnly && <span className="hidden flex-none sm:block"><ChildChip childId={childId} /></span>}
            <div className="min-w-0 flex-1 truncate text-[11.5px] font-extrabold uppercase tracking-[0.05em] text-[var(--ink-3)]">{[lesson.subject, lesson.year && (/^\d+$/.test(lesson.year) ? t("hublessons.yearN", { n: lesson.year }) : lesson.year), lesson.title].filter(Boolean).join(" · ")}</div>
            {!inPerson && !driven && !calm && <span className="rounded-full px-3 py-1 text-[13px] font-extrabold" style={{ background: "var(--gold-soft)", color: "color-mix(in srgb, var(--gold) 40%, #000)" }} title={t("hublessons.correctInARow")} aria-label={t("hublessons.nCorrectInARow", { n: streak })} data-testid="lesson-streak">🔥 {streak}</span>}
            {!inPerson && !driven && !calm && <span key={xpKey} className={`rounded-full px-3 py-1 text-[13px] font-extrabold ${xpKey ? "ls-pulse" : ""}`} style={{ background: "var(--brand-soft)", color: "var(--brand)" }} aria-label={t("hublessons.nExperiencePoints", { n: xp })} data-testid="lesson-xp">⭐ {xp} XP</span>}
          </div>
          <nav aria-label={t("hublessons.lessonProgress")} className="mt-2">
            <ol className="m-0 flex list-none gap-1.5 p-0">
              {steps.map((s, i) => (
                <li key={s} aria-current={i === at ? "step" : undefined} className="min-w-0 flex-1">
                  {readOnly && <button type="button" onClick={() => go(s)} aria-label={t("hublessons.jumpTo", { step: t(STEP_KEY[s]) })} data-testid={`preview-jump-${s}`} className="mb-1 block h-3 w-full cursor-pointer opacity-0" />}
                  <span className="block h-1.5 overflow-hidden rounded-full bg-[var(--line)]"><span className="block h-full origin-left rounded-full transition-transform duration-500 motion-reduce:transition-none" style={{ background: "linear-gradient(90deg, var(--brand-2), var(--brand))", transform: `scaleX(${i < at ? 1 : i === at ? 0.5 : 0})` }} /></span>
                  <span className={`mt-1 hidden truncate text-[11px] font-extrabold sm:block ${i === at ? "text-[var(--brand)]" : "text-[var(--ink-3)]"}`}>{t(STEP_KEY[s])}</span>
                </li>
              ))}
            </ol>
            <p className="m-0 mt-1 flex items-center gap-2 text-[11.5px] font-extrabold text-[var(--brand)] sm:hidden">{!readOnly && <ChildChip childId={childId} />}<span>{t("hublessons.stepXofY", { n: at + 1, total: steps.length, label: t(STEP_KEY[step]) })}</span></p>
          </nav>
        </header>
      )}

      {flatShell && !hideHeader && <div style={{ borderTop: "1px solid #E4E4EE" }} />}

      <div key={`${round}-${step}`} className={flatShell ? "px-[28px] py-[24px] [&>section]:m-0 [&>section]:rounded-none [&>section]:border-0 [&>section]:bg-transparent [&>section]:p-0 [&>section]:shadow-none" : undefined}>
        {step === "start" && (
          <StepCard hero className={startCardClassName}>
            <div className="flex flex-wrap gap-2 text-[12px] font-extrabold">
              {[lesson.keyStage && lesson.year ? `${lesson.keyStage} · ${/^\d+$/.test(lesson.year) ? t("hublessons.yearN", { n: lesson.year }) : lesson.year}` : lesson.keyStage || (/^\d+$/.test(lesson.year) ? t("hublessons.yearN", { n: lesson.year }) : lesson.year), lesson.subject].filter(Boolean).map((c) => <span key={c} className="rounded-full bg-white/20 px-3 py-[3px]">{c}</span>)}
            </div>
            {lesson.unit && <p className="m-0 mt-3.5 text-[13px] text-white/75">{lesson.unit}</p>}
            <h1 className="m-0 mb-2 mt-1 text-[26px] font-extrabold leading-tight sm:text-[30px]" style={display} tabIndex={-1} data-autofocus>{lesson.title}</h1>
            {lesson.outcome && <p className="m-0 text-[17px] text-white/90"><b>{t("hublessons.byTheEnd")}</b> {lesson.outcome.replace(/^I can /i, "").replace(/\.$/, "")}.</p>}
            {lesson.outline.length > 0 && <ul className="m-0 my-3 flex list-none flex-wrap gap-2 p-0">{lesson.outline.map((o) => <li key={o} className="rounded-full bg-white/20 px-3 py-[3px] text-[12px] font-extrabold">◆ {o}</li>)}</ul>}
            <p className="m-0 mb-4 text-[13px] text-white/75">{[t("hublessons.aboutMinutes", { m: minutes }), hasSlides ? t("hublessons.nSlides", { n: slideCount }) : `${t("hublessons.factIdeas", { n: lesson.points.length })} · ${t("hublessons.factKeyWords", { n: lesson.keywords.length })}`, ...(data ? [t("hublessons.nQuestions", { n: data.warmup.length + (data.quiz?.questionCount ?? 0) })] : [])].join(" · ")}</p>
            {loadErr && <p role="alert" className="mb-3 rounded-xl bg-white px-3.5 py-2.5 text-[13.5px] font-semibold text-[var(--red)]">{loadErr} <button type="button" onClick={load} className="font-extrabold underline">{t("hublessons.tryAgainShort")}</button></p>}
            {!readOnly && <WhoIsLearning childId={childId} tone="dark" />}
            {!hideStartButton && (
              <button type="button" onClick={next} disabled={!data || (!readOnly && !gate.ok)} data-testid="lesson-start"
                className={`inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-white px-6 text-[15px] font-extrabold text-[var(--brand)] transition hover:brightness-95 disabled:opacity-50 ${FOCUS}`}>{data ? t("hublessons.startLessonArrow") : loadErr ? t("hublessons.cantStartYet") : t("hublessons.gettingReady")}</button>
            )}
          </StepCard>
        )}

        {step === "learn" && <LearnStep lesson={lesson} widget={widget} addXP={addXP} onDone={next} onBack={back} />}
        {step === "slides" && hasDeck && !summaryView && (
          <SlideDeck slides={lesson.deckSlides} addXP={addXP} onDone={next} onBack={back} onIndex={setSlide} followIndex={slideFollowIndex} subject={lesson.subject}
            lessonTitle={lesson.title} lessonUnit={lesson.unit} lessonKeyConcepts={lesson.outline}
            lessonAgeGroup={[lesson.keyStage, lesson.year && (/^\d+$/.test(lesson.year) ? t("hublessons.yearN", { n: lesson.year }) : lesson.year)].filter(Boolean).join(" · ") || undefined}
            toolbar={lesson.slides.length > 0 ? <Btn tone="ghost" onClick={() => setOwnSlides(true)} data-testid="oak-deck-summary" className="!min-h-[44px] !px-3 !text-[12.5px]">{t("hublessons.summarySlidesInstead")}</Btn> : undefined}
            editor={readOnly && onLessonSaved ? { save: async (sl) => { onLessonSaved(await saveLessonSlides(note.id, qs, sl, "deckSlides")); } } : undefined} />
        )}
        {step === "slides" && !hasDeck && lesson.oakDeck && !summaryView && <OakDeckStep deckId={lesson.oakDeck} title={lesson.title} hasSummary={lesson.slides.length > 0} onSummary={() => setOwnSlides(true)} addXP={addXP} onDone={next} onBack={back} />}
        {step === "slides" && (summaryView || (!hasDeck && !lesson.oakDeck)) && (
          <SlideDeck slides={lesson.slides} addXP={addXP} onDone={next} onBack={back} onIndex={setSlide} followIndex={slideFollowIndex}
            toolbar={hasDeck && summaryView ? <Btn tone="ghost" onClick={() => setOwnSlides(false)} data-testid="oak-deck-real" className="!min-h-[44px] !px-3 !text-[12.5px]">{t("hublessons.lessonSlides")}</Btn> : undefined}
            editor={readOnly && onLessonSaved ? { save: async (sl) => { onLessonSaved(await saveLessonSlides(note.id, qs, sl)); } } : undefined} />
        )}
        {step === "words" && <WordsStep lesson={lesson} addXP={addXP} onDone={next} onBack={back} />}
        {step === "warm" && data && (
          <WarmupStep questions={data.warmup} config={config} scored={scored} onBack={back} skippable={readOnly} extra={inPerson?.warmupExtra ?? driven?.warmupExtra}
            check={(id, response) => checkWarmup(note.id, childQs, id, response)}
            onLiveAnswer={onLiveAnswer ? (questionId, response, extra) => onLiveAnswer({ step: "warm", slide: 0, questionId, questionPrompt: extra.prompt, response, verdict: extra.verdict }) : undefined}
            onView={setQCtx}
            onDone={(res: WarmupOutcome[]) => { setWarm({ ok: res.filter((r) => r.ok).length, total: res.length }); addXP(10); next(); }} />
        )}
        {step === "quiz" && data?.quiz && inPerson && inPerson.quiz({ quiz: data.quiz, onFinish: () => finishQuiz({ result: null, run: null, notice: null }), onBack: back })}
        {step === "quiz" && data?.quiz && !inPerson && driven && driven.quiz({ quiz: data.quiz, onFinish: () => finishQuiz({ result: null, run: null, notice: null }), onBack: back })}
        {step === "quiz" && data?.quiz && !inPerson && !driven && (
          <QuizStep quiz={data.quiz} qs={qs} childId={childId} homeworkId={homeworkId} config={config} readOnly={readOnly} preview={readOnly ? { noteId: note.id, childQs } : undefined} onFinish={finishQuiz} onBack={back}
            onLiveAnswer={onLiveAnswer ? (questionId, response, prompt) => onLiveAnswer({ step: "quiz", slide: 0, questionId, questionPrompt: prompt, response }) : undefined}
            onView={setQCtx} />
        )}
        {step === "done" && inPerson && inPerson.done({ onExit })}
        {step === "done" && !inPerson && (
          <DoneStep lesson={lesson} quiz={quiz} warm={warm} xp={xp} preview={readOnly} onAgain={restart} onExit={leaveNow} onFlashcards={goTo && !readOnly && lesson.keywords.length ? () => goTo("flashcards") : undefined} />
        )}
        {!readOnly && !inPerson && !driven && !hideAskTeacher && step !== "start" && step !== "done" && (
          <AskTeacher qs={childQs} childId={childId} noteId={note.id} lessonTitle={lesson.title} context={askContext} config={config} />
        )}
      </div>

      {leave && (
        <Modal title={t("hublessons.leaveThisLessonQ")} onClose={() => setLeave(false)}
          footer={<><Btn tone="ghost" onClick={() => setLeave(false)}>{t("hublessons.stay")}</Btn><Btn onClick={leaveNow} data-testid="lesson-leave">{t("hublessons.leave")}</Btn></>}>
          <p className="m-0 text-[14px] leading-relaxed text-[var(--ink-2)]">{t("hublessons.leaveBody")}</p>
        </Modal>
      )}
    </div>
  );
}
