"use client";

import { Component, Suspense, lazy, useEffect, useMemo, useRef, type ErrorInfo, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { DrawerToolView } from "../remotesync/HelpTools";
import { getWidget } from "../lesson/widgets";
import { FOCUS, Icon, SkeletonRows } from "../kit";
import type { ToolMeta, ToolMode } from "./types";

// Runs ONE tool in a full-screen layer, whatever kind it is: an existing drawer tool, an existing lesson widget, or (from Phase 2 on) a
// native tool built on the engine. A tool that throws shows a friendly box, never a blank screen.

class Guard extends Component<{ children: ReactNode; onClose: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(e: Error, info: ErrorInfo) { console.error("[tool]", e, info.componentStack); }
  render() {
    return this.state.failed
      ? <div role="alert" className="grid gap-3 rounded-2xl border border-[var(--sem-crit)] p-5 text-[14px] font-semibold text-[var(--ink)]"><p className="m-0">This tool ran into a problem and stopped. Nothing else was affected.</p><button type="button" onClick={this.props.onClose} className={`min-h-[44px] w-fit rounded-full border border-[var(--line)] px-5 font-extrabold ${FOCUS}`}>Close it</button></div>
      : this.props.children;
  }
}

function Body({ tool, mode, qs, onClose }: { tool: ToolMeta; mode: ToolMode; qs: string; onClose: () => void }) {
  const impl = tool.impl;
  const Native = useMemo(() => (impl?.kind === "native" ? lazy(impl.load) : null), [impl]);
  if (!impl) return <p className="m-0 text-[14px] font-semibold text-[var(--ink-2)]">This tool isn’t built yet.</p>;
  if (impl.kind === "drawer") return <DrawerToolView id={impl.id} />;
  if (impl.kind === "widget") { const w = getWidget(impl.id); return w ? <div><p className="m-0 mb-3 text-[13.5px] font-semibold text-[var(--ink-2)]">{w.intro}</p><w.Component onXP={() => {}} /></div> : <p className="m-0">This tool isn’t available.</p>; }
  return Native ? <Suspense fallback={<SkeletonRows rows={3} label="Loading the tool" variant="card" />}><Native mode={mode} qs={qs} onClose={onClose} /></Suspense> : null;
}

export function ToolHost({ tool, mode = "practise", qs, onClose }: { tool: ToolMeta; mode?: ToolMode; qs: string; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null, prev = document.body.style.overflow;
    document.body.style.overflow = "hidden"; closeRef.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key !== "Tab" || !panelRef.current) return;
      const f = [...panelRef.current.querySelectorAll<HTMLElement>("button:not([disabled]), select, input, textarea, a[href], [tabindex]:not([tabindex='-1'])")].filter((x) => x.offsetParent !== null);
      if (!f.length) return;
      const a = f[0]!, z = f[f.length - 1]!;
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    };
    window.addEventListener("keydown", key);
    return () => { window.removeEventListener("keydown", key); document.body.style.overflow = prev; if (opener && document.contains(opener)) opener.focus(); };
  }, [onClose]);
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[3000] flex items-end justify-center p-0 sm:items-center sm:p-6" role="presentation">
      <div aria-hidden className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={tool.title} className="hub-rise motion-reduce:animate-none relative flex max-h-[92vh] w-full max-w-[980px] flex-col overflow-hidden rounded-t-3xl border border-[var(--line)] bg-[var(--surface)] shadow-2xl sm:rounded-3xl">
        <header className="flex items-center gap-3 border-b border-[var(--line)] px-4 py-3">
          <h2 className="m-0 min-w-0 flex-1 truncate text-[18px] font-extrabold text-[var(--ink)]" style={{ fontFamily: "var(--ff-display)" }}>{tool.title}</h2>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close tool" className={`grid h-11 w-11 flex-none place-items-center rounded-full border border-[var(--line)] text-[var(--ink)] ${FOCUS}`}><Icon name="close" size={16} /></button>
        </header>
        <div className="min-h-0 flex-1 overflow-auto p-4"><Guard onClose={onClose}><Body tool={tool} mode={mode} qs={qs} onClose={onClose} /></Guard></div>
      </div>
    </div>,
    document.body,
  );
}
