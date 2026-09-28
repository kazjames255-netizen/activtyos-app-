"use client";

import { useState, type ReactNode } from "react";
import { StatTiles, type StatTile } from "../quiz/StatTiles";
import { DISPLAY, FOCUS, Overline, type Tone } from "../teachKit";
import { Ico } from "../teachIcons";
import { subjectSwatch } from "../subjectColour";
import type { Topic } from "../types";
import { HwTile } from "./hwKit";
import { dueState, type StudentHomework as HW } from "./hwTypes";
import { useHw } from "./hwI18n";

// The child's Homework list, in the same design language as the tutor tiles: three raised stat tiles, then each
// homework as a subject-coloured raised card (emoji watermark, due pill, status ribbon, big "Let's start" pill).
// Kid rules: overdue is warm amber and never red, nothing compares one child with another, calm mode / KS1 hide
// the numbers, and every list shows at most five rows with an Open / Close toggle (Show all for the rest).

const MAX_ROWS = 5;

/** A friendly picture for a subject (own copy: the flashcard one lives in another file). */
export const subjectEmoji = (subject: string): string =>
  /math/i.test(subject) ? "🧮"
    : /engl|lit|read|writ/i.test(subject) ? "📖"
      : /sci|bio|chem|phys/i.test(subject) ? "🔬"
        : /french|german|spanish|lang|latin|welsh|urdu|arabic/i.test(subject) ? "🗣️"
          : /hist|geog|human|relig|citizen/i.test(subject) ? "🌍"
            : /comput|ict|code|data/i.test(subject) ? "💻"
              : /art|design/i.test(subject) ? "🎨"
                : /music/i.test(subject) ? "🎵" : "📚";

/** Warm faces only: a star, a smile or a seedling. Never a sad face (P-13). */
export const warmFace = (pct: number): "🌟" | "🙂" | "🌱" => (pct >= 80 ? "🌟" : pct >= 60 ? "🙂" : "🌱");

// ── the three tiles ──────────────────────────────────────────────────────────

export function HwStatStrip({ todo, waiting, marked, overdue, kid, calm }: { todo: number; waiting: number; marked: number; overdue: number; kid: boolean; calm: boolean }) {
  const { h } = useHw();
  const tiles: StatTile[] = [
    {
      key: "todo", label: h("toDo"), value: todo, tone: todo ? "brand" : "green", icon: todo ? "homework" : "check",
      hint: todo ? (overdue && !calm ? (kid ? h("waitingForYou") : h("nOverdue", { n: overdue })) : h("kidHintTodo")) : h("kidHintTodoZero"),
    },
    { key: "waiting", label: kid ? h("stHandedIn") : h("awaitingMarking"), value: waiting, tone: "violet", icon: "send", hint: waiting ? h("kidHintWaiting") : h("handedInLower") },
    { key: "marked", label: h("stMarked"), value: marked, tone: "green", icon: "check", hint: h("withFeedback") },
  ];
  return <StatTiles tiles={tiles} cols={3} label={h("kidTilesAria")} />;
}

// ── one homework card ────────────────────────────────────────────────────────

export function HwCard({ hw, topic, now, kid, onOpen }: { hw: HW; topic: Topic | null; now: number; kid: boolean; onOpen: () => void }) {
  const x = useHw();
  const h = x.h;
  const dayTime = x.dayTime;
  const status = hw.submission.status;
  const ds = dueState(hw.dueAt, status, now, kid);
  const subject = topic?.subject ?? "";
  const sw = subjectSwatch(subject);
  // Overdue is amber for every child, never red.
  const dueTone: Tone = ds.tone === "red" ? "gold" : (ds.tone as Tone);
  const marked = status === "marked";
  const handed = status === "submitted";
  const ribbon = marked
    ? { text: `${h("stMarked")} ⭐`, bg: "var(--green)", fg: "#fff", dashed: false }
    : handed
      ? { text: `${h("stHandedIn")} ✎`, bg: "transparent", fg: "var(--green)", dashed: true }
      : { text: h("toDo"), bg: `color-mix(in srgb, ${sw.base} 18%, var(--surface))`, fg: sw.fg, dashed: false };
  const hot = status === "assigned" && ds.overdue;
  return (
    <button type="button" data-ui="card" data-hw={hw.id} data-status={status} data-testid="hub-hw-card" onClick={onOpen}
      className={`group relative flex min-h-[84px] w-full items-center gap-3.5 overflow-hidden rounded-2xl border p-3.5 text-start transition duration-200 hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:transform-none ${FOCUS}`}
      style={{
        background: `linear-gradient(150deg, color-mix(in srgb, ${sw.base} 15%, var(--surface)), var(--surface) 72%)`,
        borderColor: hot ? "var(--gold-line)" : sw.ring,
        borderBottom: `4px solid color-mix(in srgb, ${hot ? "var(--gold)" : sw.base} 60%, ${sw.ring})`,
        boxShadow: "inset 0 1px 0 color-mix(in srgb, var(--surface) 85%, transparent), 0 10px 20px -16px color-mix(in srgb, var(--ink) 55%, transparent)",
      }}>
      <span aria-hidden className="pointer-events-none absolute -bottom-3 end-2 select-none text-[64px] leading-none opacity-[0.11]">{subjectEmoji(subject)}</span>
      <HwTile topic={topic} size={52} tone={marked ? "green" : handed ? "brand" : hot ? "gold" : "gold"} icon={marked ? "check" : handed ? "send" : "homework"} />
      <span className="relative min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="text-[15px] font-extrabold leading-snug text-[var(--ink)]" style={DISPLAY}>{hw.title}</span>
          {hw.assessmentId && <span className="rounded-full px-2 py-[2px] text-[11px] font-extrabold" style={{ background: "var(--violet-soft, var(--panel))", color: "var(--violet, var(--ink-2))" }}>{h("quiz")}</span>}
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px] font-semibold">
          {status === "assigned" && (
            <span data-testid="hub-hw-due" className="inline-flex items-center rounded-full px-2.5 py-[3px] text-[11.5px] font-extrabold"
              style={{ background: dueTone === "gold" ? "var(--gold-soft)" : dueTone === "brand" ? "var(--brand-soft)" : "var(--panel)", color: dueTone === "gold" ? "var(--ink)" : "var(--ink-2)", border: `1px solid ${dueTone === "gold" ? "var(--gold-line)" : "var(--line)"}` }}>{ds.label}</span>
          )}
          <span className="text-[var(--ink-3)]">
            {status === "assigned" ? h("dueAt", { when: dayTime(hw.dueAt) }) : hw.submission.submittedAt ? h("handedInAtCap", { when: dayTime(hw.submission.submittedAt) }) : ""}
          </span>
        </span>
      </span>
      <span className="relative flex flex-none flex-col items-end gap-1.5">
        <span data-testid="hub-hw-ribbon" className="inline-flex items-center rounded-full px-2.5 py-[3px] text-[11.5px] font-extrabold"
          style={{ background: ribbon.bg, color: ribbon.fg, border: ribbon.dashed ? "2px dashed var(--green)" : `1px solid ${marked ? "var(--green)" : sw.ring}` }}>{ribbon.text}</span>
        <span aria-hidden className="inline-flex min-h-[38px] items-center gap-1 rounded-full px-4 text-[13px] font-extrabold text-white"
          style={{ background: status === "assigned" ? `linear-gradient(180deg, color-mix(in srgb, ${sw.base} 72%, #fff), ${sw.base})` : "linear-gradient(180deg, var(--brand-2), var(--brand))", boxShadow: "0 6px 12px -8px var(--ink), inset 0 1px 0 rgb(255 255 255 / 0.35)" }}>
          {status === "assigned" ? h("kidBtnStart") : h("kidBtnLook")}<Ico name="chevronRight" size={15} />
        </span>
      </span>
    </button>
  );
}

// ── a list of at most five, with Open / Close ────────────────────────────────

export function HwGroup({ id, title, items }: { id: string; title: string; items: ReactNode[] }) {
  const { h } = useHw();
  const [open, setOpen] = useState(true);
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, MAX_ROWS);
  return (
    <section className="grid gap-2" data-testid={`hub-hw-group-${id}`} aria-label={title}>
      <div className="flex items-center justify-between gap-3">
        <Overline>{title}</Overline>
        <button type="button" data-testid={`hub-hw-group-toggle-${id}`} aria-expanded={open} aria-controls={`hub-hw-list-${id}`} onClick={() => setOpen((o) => !o)}
          className={`inline-flex min-h-[36px] items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--panel)] px-3 text-[12px] font-extrabold text-[var(--brand-strong)] ${FOCUS}`}>
          {open ? h("kidClose") : h("kidOpen")} <span aria-hidden>{open ? "▲" : "▼"}</span>
        </button>
      </div>
      <div id={`hub-hw-list-${id}`} hidden={!open} className="grid gap-2.5">
        {shown}
        {items.length > MAX_ROWS && (
          <button type="button" data-testid={`hub-hw-group-all-${id}`} onClick={() => setAll((a) => !a)}
            className={`inline-flex min-h-[44px] w-fit items-center rounded-full px-3 text-[12.5px] font-extrabold text-[var(--brand)] hover:bg-[var(--brand-soft)] ${FOCUS}`}>
            {all ? h("kidShowFewer") : h("kidShowAll", { n: items.length })}
          </button>
        )}
      </div>
    </section>
  );
}

// ── the mark, kindly ─────────────────────────────────────────────────────────

/** The mark box at the top of a marked homework: a warm face and one kind sentence. Numbers stay for grown-ups and
 *  older children; KS1 and Calm children see stars instead (never a percentage, never a sad face). */
export function MarkFace({ score, max, pct, hideNumbers, showPct, children }: { score: number; max: number; pct: number; hideNumbers: boolean; showPct: boolean; children?: ReactNode }) {
  const { h } = useHw();
  const face = warmFace(pct);
  const line = face === "🌟" ? h("kidMarkStar") : face === "🙂" ? h("kidMarkGood") : h("kidMarkGrow");
  const stars = Math.max(1, Math.min(5, Math.round(pct / 20)));
  const tone = face === "🌟" ? "var(--green)" : face === "🙂" ? "var(--brand-2)" : "var(--gold)";
  return (
    <div className="mt-4 rounded-2xl border p-4" data-testid="hub-mark" style={{ borderColor: `color-mix(in srgb, ${tone} 40%, var(--line))`, background: `linear-gradient(150deg, color-mix(in srgb, ${tone} 14%, var(--surface)), var(--surface) 75%)` }}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span aria-hidden data-testid="hub-mark-face" className="grid h-16 w-16 flex-none place-items-center rounded-full text-[34px]"
          style={{ background: `radial-gradient(circle at 30% 25%, #fff, color-mix(in srgb, ${tone} 30%, var(--surface)))`, boxShadow: `inset 0 -4px 8px color-mix(in srgb, ${tone} 30%, transparent), 0 8px 16px -10px ${tone}` }}>{face}</span>
        <div className="min-w-0 flex-1">
          <div className="text-[18px] font-extrabold leading-tight text-[var(--ink)]" style={DISPLAY}>{line}</div>
          {hideNumbers ? (
            <div aria-label={h("kidStarsAria", { n: stars })} className="mt-1 text-[22px] tracking-[0.15em]">{"⭐".repeat(stars)}<span className="opacity-25">{"⭐".repeat(5 - stars)}</span></div>
          ) : (
            <div className="mt-1 flex flex-wrap items-end gap-x-3">
              <div className="text-[36px] font-extrabold leading-none tabular-nums" style={DISPLAY}>{score}<span className="text-[20px] text-[var(--ink-3)]">/{max}</span></div>
              {showPct && <div className="pb-1 text-[15px] font-bold text-[var(--ink-2)]">{pct}%</div>}
            </div>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}
