"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { BoardCanvas } from "./BoardCanvas";
import { ToolkitPop } from "./ToolkitPop";
import type { PackId } from "./toolkit/kit";
import { HistoryButtons, OptionsBar, ShapesPop, ToolRail, ZoomButtons, useCtrl, type PopKind } from "./BoardUi";
import type { BoardController } from "./controller";

// One board's chrome: the drawing surface with the tool rail (a tray along the
// bottom on phones), the options bar, undo/redo/zoom and popovers. The main
// board and every private pad use the same shell; what differs (page tabs,
// the ⋯ menu, the "students can write" picker) is passed in as slots.

export type ShellPop = PopKind | "students";
export interface ShellApi { openPop: (kind: ShellPop, anchor: HTMLElement) => void; pop: ShellPop | null; closePop: () => void }

export function BoardShell({ ctrl, label, active, topLeft, topRight, renderPop, onPicture, onImport, qs, subjectPack = "general", statusPill, busy, empty }: {
  ctrl: BoardController; label: string; active: boolean;
  topLeft?: ReactNode;
  topRight?: (api: ShellApi) => ReactNode;
  /** Popover content for the slot-owned kinds ("more", "students"). */
  renderPop?: (kind: "more" | "students", close: () => void) => ReactNode;
  onPicture?: () => void;
  onImport?: () => void;
  /** "?tenantId=…" — enables the "My templates" pack. */
  qs?: string;
  subjectPack?: PackId;
  statusPill?: ReactNode;
  busy?: string | null;
  empty?: string;
}) {
  useCtrl(ctrl);
  const cvArea = useRef<HTMLDivElement>(null);
  const [pop, setPop] = useState<{ kind: ShellPop; style: CSSProperties } | null>(null);
  const [tall, setTall] = useState(true);
  useEffect(() => {
    const el = cvArea.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setTall(el.clientHeight >= 560));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const openPop = useCallback((kind: ShellPop | null, anchor?: HTMLElement) => {
    if (!kind || !anchor || !cvArea.current) { setPop(null); return; }
    const c = cvArea.current.getBoundingClientRect(), a = anchor.getBoundingClientRect();
    const mw = c.width - 16, mh = c.height - 16;
    if (kind === "more" || kind === "students") setPop({ kind, style: { top: a.bottom - c.top + 8, right: Math.max(8, Math.min(c.width - 300, c.right - a.right)), maxWidth: mw, maxHeight: Math.max(240, c.bottom - a.bottom - 16) } });
    else if (a.right - c.left < 130) setPop({ kind, style: { left: a.right - c.left + 8, top: 8, maxWidth: Math.max(280, c.width - (a.right - c.left) - 16), maxHeight: mh } });
    else setPop({ kind, style: { left: 8, right: 8, bottom: c.bottom - a.top + 8, maxHeight: Math.max(240, a.top - c.top - 16), display: "flex", justifyContent: "center" } });
  }, []);
  useEffect(() => {
    if (!pop) return;
    const down = (e: PointerEvent) => { const t = e.target as HTMLElement; if (!t.closest("[data-pop]") && !t.closest("[data-pop-trigger]")) setPop(null); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setPop(null); };
    document.addEventListener("pointerdown", down, true); document.addEventListener("keydown", key);
    return () => { document.removeEventListener("pointerdown", down, true); document.removeEventListener("keydown", key); };
  }, [pop]);
  const closePop = () => setPop(null);
  const api: ShellApi = { openPop: (k, a) => openPop(pop?.kind === k ? null : k, a), pop: pop?.kind ?? null, closePop };

  const showEmpty = ctrl.curPage.els.size === 0 && ctrl.curPage.bg === "blank" && ctrl.canDraw && empty;
  const railLeft = tall ? "68px" : "112px"; // where the top bar / bottom row start, clear of the tool rail

  return (
    <div className="@container relative flex h-full min-h-0 w-full flex-col overflow-hidden" data-testid="board-shell" style={{ ["--rail-left" as string]: railLeft }}>
      <div ref={cvArea} className="relative min-h-0 flex-1">
        <BoardCanvas ctrl={ctrl} label={label} active={active} />

        {/* top bar */}
        <div className="pointer-events-none absolute left-2 right-2 top-2 z-10 flex flex-wrap items-start justify-between gap-1.5 @[620px]:left-[var(--rail-left)] [&>*]:pointer-events-auto">
          <div data-board-avoid className="flex min-w-0 flex-wrap items-start gap-1.5">{topLeft}</div>
          <div data-board-avoid className="flex flex-wrap items-start justify-end gap-1.5">
            <HistoryButtons ctrl={ctrl} />
            <div className="hidden @[1000px]:block"><ZoomButtons ctrl={ctrl} /></div>
            {topRight?.(api)}
          </div>
        </div>

        {/* tool rail (wide): full height on the left; two columns when the pane is short */}
        <div className="pointer-events-none absolute bottom-2 left-2 top-2 z-10 hidden @[620px]:flex [&>*]:pointer-events-auto">
          <div className="flex max-h-full min-h-0 rounded-2xl border border-[var(--hub-warm-line)] bg-[var(--surface)] shadow-[var(--shadow)]" data-pop-trigger data-board-avoid>
            <RailWithPop ctrl={ctrl} orient="col" cols={tall ? 1 : 2} onPop={(k, a) => openPop(k, a)} pop={pop?.kind ?? null} />
          </div>
        </div>
        {/* bottom row (wide): save/permission status, then the options for the current tool */}
        <div className="pointer-events-none absolute bottom-3 right-2 z-10 hidden items-center gap-2 @[620px]:flex @[620px]:left-[var(--rail-left)] [&>*]:pointer-events-auto">
          <div className="flex-none" aria-live="polite" data-board-avoid>{statusPill}</div>
          <div className="flex min-w-0 flex-1 justify-center"><div data-board-avoid className="min-w-0 max-w-full"><OptionsBar ctrl={ctrl} /></div></div>
          <div className="w-0 flex-none @[900px]:w-[88px]" aria-hidden />
        </div>

        {showEmpty && (
          <div className="pointer-events-none absolute inset-0 z-0 grid place-items-center px-8 text-center">
            <div className="max-w-[340px] text-[15px] font-bold leading-relaxed text-[var(--ink-3)]" style={{ opacity: 0.85 }}>{empty}</div>
          </div>
        )}

        {(busy || ctrl.toast) && (
          <div role="status" aria-live="polite" data-testid="board-toast" className="pointer-events-none absolute left-1/2 top-16 z-30 max-w-[calc(100%-24px)] -translate-x-1/2 rounded-full bg-[var(--ink)] px-4 py-2 text-center text-[13px] font-extrabold text-[var(--surface)] shadow-[var(--shadow)]">{busy ?? ctrl.toast}</div>
        )}

        {pop && (
          <div data-pop className="pointer-events-none absolute z-30 flex flex-col [&>*]:pointer-events-auto" style={pop.style}>
            {pop.kind === "shapes" && <ShapesPop ctrl={ctrl} close={closePop} />}
            {pop.kind === "insert" && onPicture && <ToolkitPop ctrl={ctrl} close={closePop} onPicture={onPicture} onImport={onImport} qs={qs} subjectPack={subjectPack} />}
            {(pop.kind === "more" || pop.kind === "students") && renderPop?.(pop.kind, closePop)}
          </div>
        )}
      </div>

      {/* phone: options row + tool tray along the bottom */}
      <div data-board-avoid className="flex flex-none flex-col gap-1 border-t border-[var(--hub-warm-line)] px-1.5 pb-1.5 pt-1.5 @[620px]:hidden" style={{ background: "var(--hub-warm-2)" }}>
        <div className="flex justify-center">
          <OptionsBar ctrl={ctrl} />
        </div>
        <div className="rounded-2xl border border-[var(--hub-warm-line)] bg-[var(--surface)]" data-pop-trigger><RailWithPop ctrl={ctrl} orient="row" onPop={(k, a) => openPop(k, a)} pop={pop?.kind ?? null} /></div>
        <div className="flex justify-center @[620px]:hidden">{statusPill}</div>
      </div>
    </div>
  );
}

/** ToolRail that reports where its popover buttons are, so the popover can sit beside them. */
function RailWithPop({ ctrl, orient, onPop, pop, cols = 1 }: { ctrl: BoardController; orient: "col" | "row"; cols?: 1 | 2; onPop: (k: PopKind, el?: HTMLElement) => void; pop: ShellPop | null }) {
  return (
    <div className="min-h-0" onClickCapture={(e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>("[data-tool]");
      if (!b) return;
      const t = b.dataset.tool;
      if (t === "shapes" || t === "insert") { e.stopPropagation(); onPop(pop === t ? null : (t as PopKind), b); }
      else onPop(null);
    }}>
      <ToolRail ctrl={ctrl} orient={orient} cols={cols} pop={pop === "shapes" || pop === "insert" ? pop : null} setPop={() => undefined} />
    </div>
  );
}

