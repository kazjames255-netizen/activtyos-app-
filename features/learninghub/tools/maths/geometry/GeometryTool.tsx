"use client";

import type { InstrKind, PaperKind } from "./model";
import { GEOMETRY_GENERATORS, GeometryBoard } from "./GeometryBoard";
import type { ToolProps } from "../../types";

// The registry's window onto the geometry board: each catalogue tool (M-01 ruler, M-02 protractor, M-04 compasses …) is this board with a
// different starting desk. `params` = { preset, offer, paper, generators }.
export default function GeometryTool({ mode, qs, params, toolId }: ToolProps) {
  const p = (params ?? {}) as { preset?: InstrKind[]; offer?: InstrKind[]; paper?: PaperKind; generators?: string[] };
  return <GeometryBoard mode={mode} qs={qs} preset={p.preset} offer={p.offer} paper={p.paper} generatorIds={p.generators ?? GEOMETRY_GENERATORS} saveAs={toolId} />;
}
