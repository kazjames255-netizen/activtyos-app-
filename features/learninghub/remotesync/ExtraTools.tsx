"use client";

import { Suspense, useState, type RefObject } from "react";
import { useT } from "@/lib/i18n/provider";
import { FOCUS, SkeletonRows } from "../kit";
import { toolById } from "../tools/registry";
import { LIGHT_SCOPE } from "../tools/lightScope";
import { ToolBody } from "../tools/ToolHost";
import { subjectLabel, toolName } from "../tools/toolTextB";
import { FloatingPanel } from "./FloatingPanel";

// Tools-page tools a provider ADDED to a question (any of the ~100 live tools, not just the 20 help-drawer ones): one soft pill each, and each opens in a
// movable, resizable, see-through window (the same window the help tools use). Loaded lazily by HelpTools.tsx (which this module's ToolHost imports back).

interface Win { id: string; x: number; y: number; w: number; h: number; z: number }

export default function ExtraToolsRow({ ids, qs, lessonCardRef, onRemove }: { ids: string[]; qs: string; lessonCardRef?: RefObject<HTMLDivElement | null>; onRemove?: (id: string) => void }) {
  const tx = useT();
  const [wins, setWins] = useState<Win[]>([]);
  const [z, setZ] = useState(1500);
  const tools = ids.map((id) => toolById(id)).filter((t): t is NonNullable<typeof t> => !!t && t.status === "live");
  if (!tools.length) return null;
  const open = (id: string) => setWins((ws) => {
    if (ws.some((w) => w.id === id)) return ws;
    const vw = window.innerWidth, vh = window.innerHeight;
    const w = Math.min(680, vw - 24), h = Math.min(560, vh - 24);
    const rect = lessonCardRef?.current?.getBoundingClientRect();
    const x = Math.max(12, Math.min(vw - w - 12, rect ? rect.right - 24 - w : vw - w - 24)), y = Math.max(12, Math.min(vh - h - 12, (rect ? rect.top + 96 : 96) + ws.length * 32));
    return [...ws, { id, x, y, w, h, z: z + 1 }];
  });
  const patch = (id: string, p: Partial<Win>) => setWins((ws) => ws.map((w) => (w.id === id ? { ...w, ...p } : w)));
  const front = (id: string) => { setZ((n) => n + 1); patch(id, { z: z + 1 }); };
  return (
    <div className="mt-2 rounded-[14px] px-3 py-2.5" style={{ background: "var(--surface)", border: "1px solid var(--line)" }} data-testid="extra-tools">
      <div className="mb-1.5 px-1 text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--ink-3)]">{tx("hublive.dAddedTools")}</div>
      <div className="flex flex-wrap gap-2">
        {tools.map((t) => (
          <span key={t.id} className="inline-flex items-center overflow-hidden rounded-full border-[1.5px] border-[var(--brand)]" style={{ background: "color-mix(in srgb, var(--brand) 12%, var(--surface))" }}>
            <button type="button" onClick={() => open(t.id)} data-testid={`extra-tool-open-${t.id}`} aria-pressed={wins.some((w) => w.id === t.id)}
              className={`inline-flex min-h-[38px] items-center gap-2 ps-3.5 pe-3 text-[14px] font-extrabold text-[var(--brand)] hover:brightness-95 ${FOCUS}`}>
              🧩 {toolName(tx, t)}<span className="text-[11px] font-bold text-[var(--ink-3)]">{subjectLabel(tx, t.subject)}</span>
            </button>
            {onRemove && <button type="button" onClick={() => onRemove(t.id)} aria-label={tx("hublive.dRemoveToolAria", { title: toolName(tx, t) })} title={tx("hublive.dRemoveToolTitle")} data-testid={`tool-remove-${t.id}`} className={`grid h-[38px] w-8 place-items-center border-s border-[var(--brand)] text-[13px] font-extrabold text-[var(--brand)] ${FOCUS}`}>✕</button>}
          </span>
        ))}
      </div>
      {wins.map((w) => {
        const t = toolById(w.id);
        if (!t) return null;
        return (
          <FloatingPanel key={w.id} title={toolName(tx, t)} icon="🧩" x={w.x} y={w.y} w={w.w} h={w.h} z={w.z} minW={360} minH={320}
            onMove={(x, y) => patch(w.id, { x, y })} onResize={(ww, hh) => patch(w.id, { w: ww, h: hh })} onFocus={() => front(w.id)}
            onClose={() => setWins((ws) => ws.filter((x) => x.id !== w.id))} onMinimize={() => setWins((ws) => ws.filter((x) => x.id !== w.id))}
            onReset={() => patch(w.id, { x: 24, y: 96 })}>
            <div className="aos-light" style={LIGHT_SCOPE}>
              <Suspense fallback={<SkeletonRows rows={3} label={tx("hublive.dLoadingTool")} variant="card" />}>
                <ToolBody tool={t} mode="practise" qs={qs} onClose={() => setWins((ws) => ws.filter((x) => x.id !== w.id))} />
              </Suspense>
            </div>
          </FloatingPanel>
        );
      })}
    </div>
  );
}
