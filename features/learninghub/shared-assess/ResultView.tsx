"use client";

import { useRef, useState, type ReactNode } from "react";
import type { HubSettings } from "@/lib/hubConfig";
import type { Topic } from "../types";
import { ruleOf, type Option, type Result, type ResultAnswer, type TakeQuestion } from "./api";
import { OK, NEUTRAL, RED, topicShort, type Tone } from "./format";
import { QImage } from "./QuestionImage";
import { ResultBanner } from "./ResultBanner";
import { Chip, display, HourglassIcon, Meter } from "./ui";

// Scored-feedback screen (also the read-only look at a past attempt). It renders
// exactly what the API sent: the answer key + explanation only appear when the
// server includes them (the tenant's revealAnswers rule), written answers show
// "waiting for your tutor" until marked, and nothing is marked or totalled here.

const GOLD: Tone = { fill: "var(--gold)", soft: "var(--gold-soft)", ink: "color-mix(in srgb, var(--gold) 30%, var(--ink))" };
const BRAND: Tone = { fill: "var(--brand)", soft: "var(--brand-soft)", ink: "var(--brand-strong)" };

/** One answer as text — a picture option also shows its thumbnail. */
/** A match answer (`{kind, pairs}`) or key (`pairs[]`) as [term, definition] rows; an order answer (`{kind, items}`) or key (`items[]`) as strings. */
const pairRows = (v: unknown): [string, string][] => {
  const list = Array.isArray(v) ? v : (v as { pairs?: unknown } | null)?.pairs;
  return Array.isArray(list) ? list.map((p) => [String((p as { term?: unknown })?.term ?? ""), String((p as { definition?: unknown })?.definition ?? "")] as [string, string]) : [];
};
const itemRows = (v: unknown): string[] => {
  const list = Array.isArray(v) ? v : (v as { items?: unknown } | null)?.items;
  return Array.isArray(list) ? list.map(String) : [];
};

function AnswerText({ options, value, rule }: { options: Option[] | undefined; value: unknown; rule?: string }) {
  if (rule === "match") {
    return <ul className="m-0 grid list-none gap-1 p-0" data-testid="hub-answer-match">{pairRows(value).map(([t, d], i) => <li key={i}><b>{t}</b> <span aria-hidden>→</span><span className="sr-only">matched with</span> {d}</li>)}</ul>;
  }
  if (rule === "order") {
    return <ol className="m-0 grid list-none gap-1 p-0" data-testid="hub-answer-order">{itemRows(value).map((t, i) => <li key={i}><span className="mr-1.5 font-extrabold tabular-nums text-[var(--ink-3)]">{i + 1}.</span>{t}</li>)}</ol>;
  }
  const ids = Array.isArray(value) ? value : value == null || value === "" ? [] : [value];
  const withPics = ids.map((v) => options?.find((o) => o.id === v)).filter((o): o is Option => !!o?.image?.url);
  if (!withPics.length) return <>{textOf(options, value)}</>;
  return (
    <span className="flex flex-wrap items-center gap-2">
      {ids.map((v, i) => {
        const o = options?.find((x) => x.id === v);
        return <span key={i} className="inline-flex items-center gap-2">{o?.image?.url && <QImage pic={o.image} alt={o.text || "Picture answer"} fit="thumb" />}<span>{o ? o.text : String(v)}</span></span>;
      })}
    </span>
  );
}

/** A tool answer in words ("68°", "3 lines, 2 arcs", "3 points plotted") — the drawing itself isn't replayed here. */
const toolText = (v: unknown): string => {
  const o = (v && typeof v === "object" ? v : {}) as { number?: number | null; marks?: { k?: string }[]; points?: unknown[] };
  const parts: string[] = [];
  if (typeof o.number === "number") parts.push(String(o.number));
  const lines = o.marks?.filter((m) => m.k === "seg" || m.k === "free").length ?? 0, arcs = o.marks?.filter((m) => m.k === "arc").length ?? 0;
  if (lines) parts.push(`${lines} ${lines === 1 ? "line" : "lines"}`);
  if (arcs) parts.push(`${arcs} ${arcs === 1 ? "arc" : "arcs"}`);
  if (o.points?.length) parts.push(`${o.points.length} ${o.points.length === 1 ? "point" : "points"} plotted`);
  return parts.join(", ") || "Nothing handed in";
};

const textOf = (opts: Option[] | undefined, v: unknown): string => {
  if (v == null || v === "") return "";
  if (typeof v === "object" && !Array.isArray(v)) return pairRows(v).length ? pairRows(v).map(([t, d]) => `${t} → ${d}`).join("; ") : itemRows(v).join(", ");
  if (Array.isArray(v)) return v.map((x) => textOf(opts, x)).filter(Boolean).join(", ");
  const o = opts?.find((x) => x.id === v);
  return o ? o.text : String(v);
};

interface Props {
  result: Result;
  /** Prompts/options for each question (from the started attempt or the detail). */
  questions?: TakeQuestion[];
  topics: Topic[];
  config: HubSettings;
  type: "quiz" | "diagnostic";
  passMarkPct?: number;
  title?: string;
  /** Slot for extras right under the score (e.g. the placement-test baseline). */
  children?: ReactNode;
  actions?: ReactNode;
  /** Tutor view: reword the headline. */
  tutor?: boolean;
  /** Re-fetch this result (signed picture links expire); called once per failed picture. */
  onRefreshImages?: () => Promise<unknown> | void;
}

export function ResultView({ result, questions, topics, config, type, passMarkPct, title, children, actions, tutor, onRefreshImages }: Props) {
  const pending = result.status === "pending_marking";
  const passed = result.passed === true;
  const qById = new Map((questions ?? []).map((q) => [q.id, q]));
  const topicById = new Map(topics.map((t) => [t.id, t]));
  const pass = passMarkPct ?? result.passMarkPct;
  const diag = type === "diagnostic";

  // Self-marking clarity: a paper with an auto-marked score never says a bare "Awaiting
  // marking" — it leads with what the auto-marker already scored and describes only the
  // written part as pending. Only a fully hand-marked paper gets the hourglass.
  const autoMax = result.autoMax ?? 0;
  const wp = result.writtenPending ?? result.answers?.filter((a) => a.pending ?? a.correct === null).length ?? 0;
  const partial = pending && autoMax > 0 && result.autoMarks != null;
  const writtenShare = result.maxMarks > 0 ? Math.max(0, ((result.maxMarks - autoMax) / result.maxMarks) * 100) : 0;
  const noun = wp === 1 ? "written answer" : "written answers";

  const headline = partial
    ? `Auto-marked ${result.autoMarks}/${autoMax}`
    : pending
    ? tutor ? "Waiting to be marked" : "Handed in. Your tutor is marking it"
    : diag
      ? tutor ? "Placement test result" : "Your starting point is set"
      : passed
        ? tutor ? "Passed" : "Brilliant, you passed!"
        : tutor ? "Not passed" : (pass != null && pass - result.pct > 30) ? "Not there yet" : "Nearly there";
  const gap = pass != null ? Math.max(0, Math.round(pass - result.pct)) : null;
  const sub = partial
    ? tutor ? `${wp} ${noun} waiting for you to mark. The score updates when you save your marks.`
      : `Plus ${wp} ${noun} being reviewed by your tutor. Your score may change once ${wp === 1 ? "it's" : "they're"} marked.`
    : pending
    ? tutor ? "Every answer here is marked by hand, so nothing has been scored yet." : "Every answer here is marked by your tutor, so there's no score yet. You'll see it here once they've finished."
    : diag
      ? tutor ? `Scored ${Math.round(result.pct)}%. This sets the baseline for growth.` : "This shows where you're starting from. Every quiz you take from here builds on it."
      : passed
        ? "Every topic you practise moves your progress forward."
        : tutor ? `Scored ${Math.round(result.pct)}% against a ${pass}% pass mark.`
          : gap != null && pass != null ? `You scored ${Math.round(result.pct)}%, ${gap <= 15 ? "just " : ""}${gap} ${gap === 1 ? "point" : "points"} short of the ${pass}% pass mark. ${result.keyHeld ? "Go back over the lesson, then have another go." : "Look back at the answers below, then have another go."}` : result.keyHeld ? "Go back over the lesson, then have another go." : "Look back at the answers below, then have another go.";

  const [flash, setFlash] = useState(false);
  const topicsRef = useRef<HTMLElement>(null);
  const topicRows = Object.entries(result.byTopic ?? {}).map(([id, v]) => ({ id, ...v, t: topicById.get(id) }));
  const answers = result.answers ?? [];
  const weak = topicRows.filter((r) => r.max > 0 && (pass != null ? (r.got / r.max) * 100 < pass : r.got < r.max)).sort((x, y) => x.got / x.max - y.got / y.max);
  const weakIds = new Set(weak.map((w) => w.id));
  const reviewTopics = () => {
    topicsRef.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    setFlash(true);
    setTimeout(() => setFlash(false), 2400);
  };

  return (
    <div className="grid gap-4" data-testid="hub-result">
      <ResultBanner kind={partial ? "partial" : pending ? "pending" : diag ? "baseline" : passed ? "passed" : "missed"} partial={partial ? { autoMarks: result.autoMarks!, autoMax, writtenPending: wp, maybe: writtenShare } : undefined} pct={result.pct} scoreMarks={result.scoreMarks} maxMarks={result.maxMarks} passMark={diag ? null : pass}
        headline={headline} sub={sub} eyebrow={title} actions={actions}
        weakTopics={tutor ? [] : weak.map((w) => (w.t ? topicShort(w.t) : "Topic"))} onReviewTopics={tutor ? undefined : reviewTopics} />

      {children}

      {topicRows.length > 0 && (
        <section ref={topicsRef} id="hub-result-topics" className="scroll-mt-4 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)]">
          <h4 className="m-0 mb-3 text-[14px] font-extrabold text-[var(--ink)]" style={display}>How you did by topic</h4>
          <ul className="m-0 grid list-none gap-3 p-0">
            {topicRows.map((r, i) => {
              const pct = r.max > 0 ? (r.got / r.max) * 100 : 0;
              const isWeak = !diag && !pending && weakIds.has(r.id);
              const tone = pending || diag ? BRAND : isWeak ? GOLD : OK;
              return (
                <li key={r.id} className="rounded-xl px-2.5 py-1.5 transition-colors duration-500" style={{ background: flash && isWeak ? "var(--gold-soft)" : "transparent", margin: "0 -10px" }}>
                  <div className="mb-1 flex items-baseline justify-between gap-3 text-[12.5px]">
                    <span className="min-w-0 truncate font-bold text-[var(--ink)]">{r.t ? topicShort(r.t) : "Topic"}{isWeak && <span className="ml-2 text-[11px] font-extrabold" style={{ color: GOLD.ink }}>Worth another look</span>}</span>
                    <span className="flex-none font-semibold tabular-nums text-[var(--ink-3)]">{r.got}/{r.max} marks</span>
                  </div>
                  <Meter pct={pct} tone={tone} delay={200 + i * 90} label={`${r.t?.topic ?? "Topic"} ${Math.round(pct)}%`} mark={!diag && !pending ? pass : null} />
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {answers.length > 0 && (
        <section aria-label="Question review">
          <h4 className="m-0 mb-2 px-1 text-[14px] font-extrabold text-[var(--ink)]" style={display}>{tutor ? "Answers" : "Look back at each question"}</h4>
          <ol className="m-0 grid list-none gap-3 p-0">
            {answers.map((a, i) => <ReviewItem key={a.questionId} i={i} a={a} q={qById.get(a.questionId)} config={config} attemptPending={pending} keyHeld={result.keyHeld === true} onRefresh={onRefreshImages} />)}
          </ol>
        </section>
      )}
    </div>
  );
}

function ReviewItem({ a, q, i, config, attemptPending, keyHeld, onRefresh }: { a: ResultAnswer; q?: TakeQuestion; i: number; config: HubSettings; attemptPending: boolean; keyHeld: boolean; onRefresh?: () => Promise<unknown> | void }) {
  const prompt = a.prompt ?? q?.prompt ?? "Question";
  const kind = a.kind ?? q?.kind ?? "";
  const options = a.options ?? q?.options;
  const image = a.image ?? q?.image;
  const rule = ruleOf(config.questionKinds, kind);
  const waiting = a.correct === null && attemptPending;
  const full = a.marksMax > 0 && a.marksAwarded >= a.marksMax;
  const status: { label: string; icon: ReactNode; tone: Tone } =
    waiting ? { label: "Your tutor is marking this", icon: <HourglassIcon size={12} />, tone: BRAND }
      : a.correct === true || full ? { label: "Correct", icon: "✓", tone: OK }
        : a.marksAwarded > 0 ? { label: "Partly right", icon: "◐", tone: GOLD }
          : { label: "Not quite", icon: "✗", tone: RED };
  const yours = rule === "tool" ? toolText(a.response) : textOf(options, a.response);
  const hasKey = a.correctAnswer !== undefined && a.correctAnswer !== null && a.correctAnswer !== "";
  const showKey = hasKey && a.correct !== true && !full;

  return (
    <li className="rounded-2xl border bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)]" style={{ borderColor: status.tone.soft === "var(--panel)" ? "var(--line)" : status.tone.fill }} data-testid="hub-review-item">
      <div className="flex items-start gap-3">
        <span className="grid h-7 w-7 flex-none place-items-center rounded-full text-[12px] font-extrabold" style={{ background: status.tone.soft, color: status.tone.ink }} aria-hidden>{i + 1}</span>
        <div className="min-w-0 flex-1">
          <div className="whitespace-pre-wrap text-[14.5px] font-bold leading-snug text-[var(--ink)] [overflow-wrap:anywhere]">{prompt}</div>
          {image?.url && <div className="mt-2.5 max-w-[420px]" data-testid="hub-review-image"><QImage pic={image} onRefresh={onRefresh} /></div>}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Chip tone={status.tone} icon={status.icon}>{status.label}</Chip>
            {!waiting && <span className="text-[11.5px] font-bold tabular-nums text-[var(--ink-3)]">{a.marksAwarded} / {a.marksMax} marks</span>}
            {waiting && <span className="text-[11.5px] font-bold tabular-nums text-[var(--ink-3)]">{a.marksMax} {a.marksMax === 1 ? "mark" : "marks"} available</span>}
          </div>

          {a.checkerFeedback?.length ? <ul className="m-0 mt-2 grid list-none gap-0.5 p-0 text-[12.5px] font-semibold text-[var(--ink-2)]" data-testid="hub-tool-feedback">{a.checkerFeedback.map((f, k) => <li key={k}>{f}</li>)}</ul> : null}
          <dl className="m-0 mt-3 grid gap-2 text-[13px]">
            <div className="rounded-lg bg-[var(--panel)] px-3 py-2">
              <dt className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--ink-3)]">{rule === "manual" ? "Your written answer" : "Your answer"}</dt>
              <dd className="m-0 mt-0.5 whitespace-pre-wrap font-semibold text-[var(--ink)] [overflow-wrap:anywhere]">{yours ? <AnswerText options={options} value={a.response} rule={rule} /> : <span className="font-normal italic text-[var(--ink-3)]">No answer given</span>}</dd>
            </div>
            {showKey && (
              <div className="rounded-lg px-3 py-2" style={{ background: OK.soft }}>
                <dt className="text-[11px] font-extrabold uppercase tracking-[0.06em]" style={{ color: OK.ink }}>Correct answer</dt>
                <dd className="m-0 mt-0.5 whitespace-pre-wrap font-semibold text-[var(--ink)] [overflow-wrap:anywhere]"><AnswerText options={options} value={a.correctAnswer} rule={rule} /></dd>
              </div>
            )}
          </dl>

          {a.feedback && (
            <blockquote className="m-0 mt-3 rounded-lg border-l-4 bg-[var(--brand-soft)] px-3 py-2 text-[13px] leading-relaxed text-[var(--brand-ink)]" style={{ borderColor: "var(--brand)" }}>
              <span className="mb-0.5 block text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--brand-strong)]">Tutor feedback</span>
              <span className="whitespace-pre-wrap">{a.feedback}</span>
            </blockquote>
          )}
          {a.explanation && (
            <div className="mt-3 rounded-lg border border-[var(--line)] px-3 py-2 text-[13px] leading-relaxed text-[var(--ink-2)]">
              <span className="mb-0.5 block text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--ink-3)]">Why</span>
              <span className="whitespace-pre-wrap">{a.explanation}</span>
            </div>
          )}
          {!hasKey && !a.explanation && !waiting && a.correct !== null && (
            <p className="m-0 mt-2.5 text-[11.5px] text-[var(--ink-3)]">
              {config.revealAnswers === "never" ? "Your tutor keeps the answer key private." : config.revealAnswers === "after_marked" ? "The answer will show once your tutor has finished marking." : keyHeld ? "The answers unlock when you pass this quiz." : ""}
            </p>
          )}
        </div>
      </div>
    </li>
  );
}
