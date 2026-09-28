"use client";

import { useT } from "@/lib/i18n/provider";
import { useMemo, useState } from "react";
import { FOCUS } from "../kit";
import { REGISTRY, toolById } from "../tools/registry";
import { ToolHost } from "../tools/ToolHost";
import { logToolEvent } from "../tools/api";
import type { ToolMeta } from "../tools/types";

/** Pupil side of "Tools for this lesson": the tools the provider added to the lesson itself (not to one question), opened in the same floating window. */
export function LessonToolsBar({ ids, qs }: { ids: string[]; qs: string }) {
  const tools = useMemo(() => ids.map((id) => REGISTRY.find((t) => t.impl?.kind === "drawer" && t.impl.id === id) ?? toolById(id)).filter((t): t is ToolMeta => !!t && t.status === "live"), [ids]);
  const [open, setOpen] = useState<ToolMeta | null>(null);
  const t = useT();
  if (!tools.length) return null;
  return (
    <div className="mb-2 flex flex-wrap items-center gap-2" data-testid="lesson-tools-bar">
      <span className="text-[12px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">{t("hublessons.toolsForLesson")}</span>
      {tools.map((tl) => (
        <button key={tl.id} type="button" data-testid={`lesson-tool-${tl.id}`} onClick={() => { setOpen(tl); if (qs) logToolEvent(qs, tl.id, "open"); }}
          className={`inline-flex min-h-[44px] items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface)] px-4 text-[14px] font-extrabold text-[var(--ink)] hover:border-[var(--brand)] ${FOCUS}`}>{t("hublessons.openTool", { title: tl.title })}</button>
      ))}
      {open && <ToolHost tool={open} qs={qs} onClose={() => setOpen(null)} />}
    </div>
  );
}
