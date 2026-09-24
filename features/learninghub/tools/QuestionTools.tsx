"use client";

import { useMemo, useState } from "react";
import { FOCUS } from "../kit";
import { logToolEvent } from "./api";
import { suggestLiveTools } from "./suggest";
import { ToolHost } from "./ToolHost";
import type { ToolMeta } from "./types";

// "Tools for this question": the same automatic rules that suggest tools for a lesson, run over a QUESTION (its wording + the subject / year it
// belongs to). Deterministic, so the tutor who writes a question (variant "tutor": suggestions with the reason) and the child who answers it
// (variant "child": buttons that open the tool) always see the same tools. Only real rule matches are shown — never the generic fallback.

export interface QuestionToolCtx { subject: string; year?: number | null; unit?: string; qs?: string }


export function useQuestionTools(ctx: QuestionToolCtx | undefined, prompt: string, max = 2) {
  return useMemo(() => {
    if (!ctx || !ctx.subject || prompt.trim().length < 8) return [];
    return suggestLiveTools({ subject: ctx.subject, year: ctx.year ?? null, title: prompt, unit: ctx.unit ?? "", objective: "" }, max).filter((s) => s.source === "rule");
  }, [ctx?.subject, ctx?.year, ctx?.unit, prompt, max]); // eslint-disable-line react-hooks/exhaustive-deps
}

export default function QuestionTools({ ctx, prompt, variant }: { ctx: QuestionToolCtx; prompt: string; variant: "child" | "tutor" }) {
  const found = useQuestionTools(ctx, prompt, variant === "tutor" ? 3 : 2);
  const [open, setOpen] = useState<ToolMeta | null>(null);
  if (!found.length) return null;
  const tutor = variant === "tutor";
  return (
    <div className="mt-4 grid gap-2" data-testid={tutor ? "form-tools" : "question-tools"}>
      <p className="m-0 text-[12px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">{tutor ? "Tools pupils will be offered with this question" : "Tools for this question"}</p>
      <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
        {found.map(({ tool, why }) => (
          <li key={tool.id} className="min-w-0">
            <button type="button" data-testid={`${tutor ? "form" : "question"}-tool-${tool.id}`} onClick={() => { setOpen(tool); if (ctx.qs) logToolEvent(ctx.qs, tool.id, "open"); }}
              className={`inline-flex min-h-[44px] max-w-full items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface)] px-4 text-[14px] font-extrabold text-[var(--ink)] hover:border-[var(--brand)] ${FOCUS}`}>
              <span aria-hidden>🧰</span><span className="truncate">{tutor ? tool.title : `Open ${tool.title}`}</span>
            </button>
            {tutor && <p className="m-0 mt-1 max-w-[46ch] text-[12px] font-semibold text-[var(--ink-2)]" data-testid={`form-tool-why-${tool.id}`}>Suggested because {why.text ? why.text.charAt(0).toLowerCase() + why.text.slice(1) : `the ${why.field === "unit" ? "topic" : "question"} mentions “${why.match}”`}.</p>}
          </li>
        ))}
      </ul>
      {open && <ToolHost tool={open} qs={ctx.qs ?? ""} onClose={() => setOpen(null)} />}
    </div>
  );
}
