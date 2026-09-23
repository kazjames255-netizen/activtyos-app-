"use client";

import { HELP_TOOLS } from "../remotesync/HelpTools";
import { getWidget, listWidgets } from "../lesson/widgets";
import { parseCatalogue, widgetSubject } from "./registryData";
import type { ToolMeta } from "./types";

// The registry the Tools tab, the drawer's "Suggested" chips and the automatic tool suggestions all read.
// = the catalogue (registryData.ts) + a check that each existing tool it points at really exists + every lesson widget that has no
// catalogue row of its own (the ~50 prototype widgets), so nothing that works today is left out.

function build(): ToolMeta[] {
  const drawerReady = new Set(HELP_TOOLS.filter((t) => t.ready !== false).map((t) => t.id as string));
  const usedWidgets = new Set<string>();
  const out: ToolMeta[] = parseCatalogue().map((r) => {
    let impl = r.impl;
    if (impl?.kind === "drawer" && !drawerReady.has(impl.id)) impl = null;          // hidden / removed drawer tool → not live
    if (impl?.kind === "widget") { if (getWidget(impl.id)) usedWidgets.add(impl.id); else impl = null; }
    return { ...r, impl, legacy: !!impl, status: impl ? "live" : r.tier === "P1" ? "building" : "soon" };
  });
  for (const w of listWidgets()) {
    if (usedWidgets.has(w.id)) continue;
    const words = w.title.toLowerCase().split(/[^a-z0-9]+/).filter((x) => x.length > 2);
    out.push({ id: `w.${w.id}`, title: w.title, subject: widgetSubject(w.id), tier: "P1", keyStages: [1, 2, 3, 4], surface: "canvas", tags: [...new Set([w.id.replace(/([A-Z])/g, " $1").toLowerCase().trim(), ...words])], status: "live", impl: { kind: "widget", id: w.id }, legacy: true });
  }
  return out;
}

export const REGISTRY: ToolMeta[] = build();
export const toolById = (id: string): ToolMeta | undefined => REGISTRY.find((t) => t.id === id);
