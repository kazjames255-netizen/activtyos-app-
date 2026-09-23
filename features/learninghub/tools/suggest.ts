"use client";

import type { HelpToolId } from "../remotesync/HelpTools";
import { REGISTRY } from "./registry";
import { suggest, type Signal } from "./selection";

// Ties the suggestion engine to the tools that can actually be opened where the pupil is.

/** Tools the Tools DRAWER can open for this lesson, best first (drawer ids), limited to those the tutor enabled. Empty when nothing fits. */
export function suggestDrawerTools(sig: Signal, enabled: HelpToolId[], max = 6): HelpToolId[] {
  const on = new Set<string>(enabled);
  const byId = new Map(REGISTRY.map((t) => [t.id, t]));
  const out: HelpToolId[] = [];
  for (const s of suggest(sig, (id) => { const t = byId.get(id); return !!t && t.impl?.kind === "drawer" && on.has(t.impl.id); }, { max: max * 2 })) {
    const t = byId.get(s.tool);
    if (t?.impl?.kind === "drawer" && !out.includes(t.impl.id)) out.push(t.impl.id);
    if (out.length >= max) break;
  }
  return out;
}

/** Live tools (any kind) for a lesson — used by "Tools for this lesson" chips. */
export function suggestLiveTools(sig: Signal, max = 3) {
  const byId = new Map(REGISTRY.map((t) => [t.id, t]));
  return suggest(sig, (id) => byId.get(id)?.status === "live", { max }).map((s) => ({ tool: byId.get(s.tool)!, why: s.why, source: s.source }));
}
