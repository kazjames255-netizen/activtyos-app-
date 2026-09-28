"use client";

import { Component, Suspense, lazy, useMemo, useRef, useState, type ErrorInfo, type ReactNode } from "react";
import { DrawerToolView } from "../remotesync/HelpTools";
import { FloatingPanel } from "../remotesync/FloatingPanel";
import { getWidget } from "../lesson/widgets";
import { FOCUS, SkeletonRows } from "../kit";
import { LIGHT_SCOPE } from "./lightScope";
import { useI18n } from "@/lib/i18n/provider";
import { toolName } from "./toolTextB";
import { useLegacyText } from "../lesson/widgets/legacyI18n";
import type { ToolMeta, ToolMode } from "./types";

// Runs ONE tool in a full-screen layer, whatever kind it is: an existing drawer tool, an existing lesson widget, or (from Phase 2 on) a
// native tool built on the engine. A tool that throws shows a friendly box, never a blank screen.

function GuardFailed({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  return <div role="alert" className="grid gap-3 rounded-2xl border border-[var(--sem-crit)] p-5 text-[14px] font-semibold text-[var(--ink)]"><p className="m-0">{t("hubtoolsb.th_failed")}</p><button type="button" onClick={onClose} className={`min-h-[44px] w-fit rounded-full border border-[var(--line)] px-5 font-extrabold ${FOCUS}`}>{t("hubtoolsb.th_closeIt")}</button></div>;
}

class Guard extends Component<{ children: ReactNode; onClose: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(e: Error, info: ErrorInfo) { console.error("[tool]", e, info.componentStack); }
  render() {
    return this.state.failed
      ? <GuardFailed onClose={this.props.onClose} />
      : this.props.children;
  }
}

export function ToolBody({ tool, mode, qs, onClose }: { tool: ToolMeta; mode: ToolMode; qs: string; onClose: () => void }) {
  const { t, locale } = useI18n();
  const lt = useLegacyText(locale);
  const impl = tool.impl;
  const Native = useMemo(() => (impl?.kind === "native" ? lazy(impl.load) : null), [impl]);
  if (!impl) return <p className="m-0 text-[14px] font-semibold text-[var(--ink-2)]">{t("hubtoolsb.th_notBuilt")}</p>;
  if (impl.kind === "drawer") return <DrawerToolView id={impl.id} />;
  if (impl.kind === "widget") { const w = getWidget(impl.id); return w ? <div><p data-tool-chrome className="m-0 mb-3 text-[13.5px] font-semibold text-[var(--ink-2)]">{lt(w.intro)}</p><w.Component onXP={() => {}} /></div> : <p className="m-0">{t("hubtoolsb.th_unavailable")}</p>; }
  return Native ? <Suspense fallback={<SkeletonRows rows={3} label={t("hubtoolsb.th_loading")} variant="card" />}><Native mode={mode} qs={qs} onClose={onClose} params={impl.kind === "native" ? impl.params : undefined} toolId={tool.id} /></Suspense> : null;
}

type HostProps = { tool: ToolMeta; mode?: ToolMode; qs: string; onClose: () => void; /** A short note shown above the tool (the Tools page says it is a viewing area). Hidden in "Just the tool". */ note?: string };

/** The Tools-page window: the SAME floating window on every screen size (move anywhere, resize, See-through, Just the tool, minimise, reset). On phones it opens nearly full-width; "Just the tool" then lets the lesson show through and touch pass through around the tool. */
export function ToolHost({ tool, mode = "practise", qs, onClose, note }: HostProps) {
  const { t } = useI18n();
  const geo = () => { const vw = typeof window === "undefined" ? 1280 : window.innerWidth, vh = typeof window === "undefined" ? 800 : window.innerHeight; const phone = vw < 640; const w = Math.min(980, vw - (phone ? 16 : 48)), h = Math.min(720, vh - (phone ? 72 : 96)); return { x: Math.max(8, Math.round((vw - w) / 2)), y: Math.max(8, Math.round((vh - h) / 2)), w, h }; };
  const minW = typeof window === "undefined" ? 360 : Math.min(360, window.innerWidth - 16);
  const [g, setG] = useState(geo);
  const [min, setMin] = useState(false);
  const [z, setZ] = useState(1000);
  const restore = useRef<HTMLElement | null>(typeof document === "undefined" ? null : (document.activeElement as HTMLElement | null));
  return (
    <FloatingPanel title={toolName(t, tool)} icon="🧩" x={g.x} y={g.y} w={g.w} h={min ? 44 : g.h} z={z} minW={minW} minH={320} restoreFocusRef={restore}
      onMove={(x, y) => setG((o) => ({ ...o, x, y }))} onResize={(w, h) => setG((o) => ({ ...o, w, h }))} onFocus={() => setZ((v) => v + 1)}
      onClose={onClose} onMinimize={() => setMin((m) => !m)} onReset={() => { setG(geo()); setMin(false); }}>
      <div className="aos-light" style={LIGHT_SCOPE}>
        {note && <p data-tool-chrome="1" data-testid="tool-host-note" className="m-0 mb-3 rounded-xl border border-[var(--brand)] bg-[var(--brand-soft)] px-3 py-2 text-[12.5px] font-bold text-[var(--ink)]">👀 {note}</p>}
        <Guard onClose={onClose}><ToolBody tool={tool} mode={mode} qs={qs} onClose={onClose} /></Guard>
      </div>
    </FloatingPanel>
  );
}
