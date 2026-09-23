"use client";

import { lazy, Suspense, useCallback } from "react";
import type { Pt } from "./engine/geometry";
import type { Mark } from "./maths/geometry/model";
import type { PublicProblem } from "./problems";

// A tool question inside a quiz: the board for the problem the SERVER dealt this attempt (no answer key travels), reporting the pupil's answer as they
// work. The quiz's own hand-in button submits it; marking is the server's job.

const Geometry = lazy(() => import("./maths/geometry/GeometryBoard").then((m) => ({ default: m.GeometryBoard })));
const Grid = lazy(() => import("./maths/CoordGrid"));

export interface ToolAnswerValue { kind: "tool"; number?: number | null; marks?: Mark[]; points?: Pt[] }

export function ToolQuestion({ problem, value, onChange, disabled }: { problem?: PublicProblem; value?: ToolAnswerValue; onChange: (v: ToolAnswerValue) => void; disabled?: boolean }) {
  const onGeo = useCallback((a: { number?: number | null; marks: Mark[] }) => onChange({ kind: "tool", number: a.number ?? null, marks: a.marks }), [onChange]);
  const onGrid = useCallback((a: { points: Pt[] }) => onChange({ kind: "tool", points: a.points }), [onChange]);
  if (!problem) return <p role="alert" className="m-0 rounded-2xl border border-dashed border-[var(--line)] p-4 text-[14px] font-semibold text-[var(--ink-2)]">This tool question couldn’t be loaded. Tell your tutor.</p>;
  return (
    <div style={disabled ? { pointerEvents: "none", opacity: 0.7 } : undefined} data-testid="tool-question">
      <Suspense fallback={<p className="m-0 text-[13px] font-semibold text-[var(--ink-2)]">Loading the tool…</p>}>
        {problem.generatorId === "M-G03.plot"
          ? <Grid mode="assess" problem={problem} initialPoints={value?.points} onAnswer={onGrid} />
          : <Geometry mode="assess" problem={problem} initialAnswer={{ number: value?.number ?? null, marks: value?.marks?.filter((m) => !("given" in m && m.given)) }} onAnswer={onGeo} />}
      </Suspense>
    </div>
  );
}
