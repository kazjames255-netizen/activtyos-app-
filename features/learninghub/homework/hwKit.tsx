"use client";

import type { Topic } from "../types";
import { subjectColor, tint } from "../kit";
import { SubjectGlyph } from "../subjectArt";
import { Ico } from "../teachIcons";
import type { SubStatus } from "./hwTypes";

// Small shared pieces for the homework views: the assigned → handed in → marked
// stepper, and a subject-coloured tile with a status badge.

const STEPS = [
  { key: "assigned", label: "Assigned" },
  { key: "submitted", label: "Handed in" },
  { key: "marked", label: "Marked" },
] as const;

/** Where a piece of homework is on its way: assigned → handed in → marked. */
export function StatusStepper({ status, compact = false, onDark = false, className = "" }: { status: SubStatus; compact?: boolean; onDark?: boolean; className?: string }) {
  const idx = status === "assigned" ? 0 : status === "submitted" ? 1 : 2;
  const size = compact ? 16 : 24;
  const track = onDark ? "rgba(255,255,255,.28)" : "var(--line)";
  const doneBg = onDark ? "#fff" : "var(--green)";
  const doneFg = onDark ? "var(--brand-strong)" : "#fff";
  return (
    <ol className={`flex items-start ${className}`} aria-label={`Progress: ${STEPS[idx]!.label}`}>
      {STEPS.map((s, i) => {
        // Assigned is always done; "Handed in" is done once handed in; "Marked" only when marked.
        const isDone = i === 0 || (i === 1 && idx >= 1) || (i === 2 && idx === 2);
        const isCurrent = !isDone && ((i === 1 && idx === 0) || (i === 2 && idx === 1));
        return (
          <li key={s.key} className={`flex items-start ${i < 2 ? "flex-1" : ""}`} aria-current={isCurrent ? "step" : undefined}>
            <span className="flex flex-col items-center gap-1">
              <span className="grid place-items-center rounded-full transition-colors" style={{
                width: size, height: size,
                background: isDone ? doneBg : "transparent",
                color: doneFg,
                boxShadow: isDone ? undefined : isCurrent ? `inset 0 0 0 2px ${onDark ? "#fff" : "var(--brand-2)"}` : `inset 0 0 0 2px ${track}`,
              }}>
                {isDone ? <Ico name="check" size={size * 0.62} strokeWidth={3.2} /> : isCurrent ? <span className="rounded-full" style={{ width: size * 0.32, height: size * 0.32, background: onDark ? "#fff" : "var(--brand-2)" }} /> : null}
              </span>
              {!compact && <span className={`whitespace-nowrap text-[11px] font-bold ${isDone || isCurrent ? (onDark ? "text-white" : "text-[var(--ink)]") : (onDark ? "text-white/55" : "text-[var(--ink-3)]")}`}>{s.label}</span>}
            </span>
            {i < 2 && <span aria-hidden className="mx-1.5 mt-[calc(var(--sz)/2-1px)] h-0.5 flex-1 rounded-full" style={{ ["--sz" as string]: `${size}px`, background: i < idx ? (onDark ? "#fff" : "var(--green)") : track, minWidth: compact ? 10 : 18 }} />}
          </li>
        );
      })}
    </ol>
  );
}

/** A 48px tile: the subject's gradient + glyph when the topic is known, otherwise a
 *  brand-tinted homework icon. `badge` overlays a small status mark. */
export function HwTile({ topic, tone, icon, size = 48 }: { topic?: Topic | null; tone: "green" | "brand" | "red" | "gold" | "neutral"; icon: "check" | "send" | "warning" | "homework"; size?: number }) {
  const c = topic ? subjectColor(topic.subject) : "var(--brand)";
  const badge = { green: "var(--green)", brand: "var(--brand-2)", red: "var(--red)", gold: "var(--gold)", neutral: "var(--ink-3)" }[tone];
  return (
    <span aria-hidden className="relative grid flex-none place-items-center rounded-2xl" style={{ width: size, height: size, background: `linear-gradient(135deg, ${tint(c, 32)} 0%, ${tint(c, 12)} 100%)`, color: c, boxShadow: `inset 0 0 0 1px ${tint(c, 28)}` }}>
      {topic ? <SubjectGlyph subject={topic.subject} size={size * 0.52} /> : <Ico name="homework" size={size * 0.5} />}
      <span className="absolute -bottom-1 -right-1 grid place-items-center rounded-full border-2 border-[var(--surface)] text-white" style={{ width: size * 0.42, height: size * 0.42, background: badge, color: tone === "gold" ? "var(--brand-ink)" : "#fff" }}>
        <Ico name={icon} size={size * 0.24} strokeWidth={3} />
      </span>
    </span>
  );
}
