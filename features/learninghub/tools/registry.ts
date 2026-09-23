"use client";

import { HELP_TOOLS } from "../remotesync/HelpTools";
import { getWidget, listWidgets } from "../lesson/widgets";
import { parseCatalogue, widgetSubject } from "./registryData";
import type { InstrKind } from "./maths/geometry/model";
import type { ToolImpl, ToolMeta } from "./types";

// The registry the Tools tab, the drawer's "Suggested" chips and the automatic tool suggestions all read.
// = the catalogue (registryData.ts) + a check that each existing tool it points at really exists + every lesson widget that has no
// catalogue row of its own (the ~50 prototype widgets), so nothing that works today is left out.

// Tools built on the engine (replacing the old static drawer pictures). Each geometry tool is the same board with its own starting desk.
const geo = (preset: InstrKind[], generators: string[], paper?: string): ToolImpl => ({ kind: "native", load: () => import("./maths/geometry/GeometryTool"), params: { preset, offer: undefined, generators, ...(paper ? { paper } : {}) } });
const NATIVE: Record<string, ToolImpl> = {
  "M-01": geo(["ruler15"], []),
  "M-02": geo(["protractor180", "ruler15"], ["M-G01.measure", "M-G01.draw", "M-G09.measure"]),
  "M-03": geo(["protractor360", "ruler15"], ["M-G01.measure", "M-G01.draw"]),
  "M-04": geo(["compass", "ruler15"], ["M-G02.locus", "M-G02.triangle", "M-G02.equilateral"]),
  "M-05": geo(["setsquare45", "ruler15"], []),
  "M-06": geo(["straightedge", "compass"], ["M-G02.perpBisector", "M-G02.angleBisector", "M-G02.equilateral"]),
  "M-07": geo(["straightedge", "compass", "ruler15"], ["M-G02.perpBisector", "M-G02.angleBisector", "M-G02.triangle", "M-G02.equilateral", "M-G02.locus"]),
  "M-20": geo(["ruler15"], [], "squared"),
};

function build(): ToolMeta[] {
  const drawerReady = new Set(HELP_TOOLS.filter((t) => t.ready !== false).map((t) => t.id as string));
  const usedWidgets = new Set<string>();
  const out: ToolMeta[] = parseCatalogue().map((r) => {
    let impl: ToolImpl | null = NATIVE[r.id] ?? r.impl;
    if (impl?.kind === "drawer" && !drawerReady.has(impl.id)) impl = null;          // hidden / removed drawer tool → not live
    if (impl?.kind === "widget") { if (getWidget(impl.id)) usedWidgets.add(impl.id); else impl = null; }
    return { ...r, impl, legacy: !!impl && impl.kind !== "native", status: impl ? "live" : r.tier === "P1" ? "building" : "soon" };
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
