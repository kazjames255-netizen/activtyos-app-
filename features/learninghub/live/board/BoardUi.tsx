"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import { FOCUS } from "../../teachKit";
import { useT } from "@/lib/i18n/provider";
import { Rich, slug, tx } from "./Rich";
import { BIcon, type BIconName } from "./boardIcons";
import type { BoardController, Tool } from "./controller";
import { MAP_REGIONS, APPARATUS_KINDS, SYMBOL_KINDS } from "./render-stamps";
import { BACKGROUNDS, ERASER_SIZES, HL_SIZES, PEN_SIZES, PEN_STYLES, STAMPS, canHoldText, isClosedShape, type PenStyle, STICKY_COLOURS, TEXT_SIZES, stampDef, type BgKind, type El, type ShapeKind, type StampKind } from "./model";

// The board's chrome: tool rail (left on wide panes, a tray along the bottom on
// phones), the options bar for the current tool, and the top bar (pages,
// undo/redo, zoom, students-can-draw, the ⋯ menu). Light, warm, ≥44px targets.

export const useCtrl = (c: BoardController) => useSyncExternalStore(c.subscribe, () => c.version, () => 0);

const chip = `inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-xl text-[13px] font-extrabold transition-colors motion-reduce:transition-none ${FOCUS}`;
const idle = "text-[var(--ink-2)] hover:bg-[var(--brand-soft)] hover:text-[var(--brand)]";
const on = "bg-[var(--brand)] text-white shadow-[var(--shadow-sm)]";
const card = "rounded-2xl border border-[var(--hub-warm-line)] bg-[var(--surface)] shadow-[var(--shadow)]";

// ── the tool rail ───────────────────────────────────────────────────────────
const SHAPES: { t: ShapeKind; key: string }[] = [
  { t: "line", key: "L" }, { t: "arrow", key: "A" }, { t: "rect", key: "R" }, { t: "ellipse", key: "O" }, { t: "triangle", key: "G" },
  { t: "darrow", key: "D" }, { t: "diamond", key: "W" }, { t: "rtriangle", key: "" }, { t: "pentagon", key: "" }, { t: "hexagon", key: "" },
  { t: "star", key: "I" }, { t: "heart", key: "" }, { t: "bubble", key: "" },
  { t: "ngon", key: "" }, { t: "parallelogram", key: "" }, { t: "trapezium", key: "" }, { t: "kite", key: "" },
];
const isShape = (t: Tool): t is ShapeKind => SHAPES.some((s) => s.t === t);

export type PopKind = null | "shapes" | "insert" | "more";
export function ToolRail({ ctrl, orient, pop, setPop, cols = 1 }: { ctrl: BoardController; orient: "col" | "row"; pop: PopKind; setPop: (p: PopKind) => void; cols?: 1 | 2 }) {
  const tr = useT();
  useCtrl(ctrl);
  const t = ctrl.ui.tool;
  const draw = ctrl.canDraw;
  const lastShape = ctrl.lastShape;
  const btn = (tool: Tool, icon: BIconName, label: string, key: string, disabled = false) => (
    <button key={tool} type="button" data-tool={tool} aria-pressed={t === tool} aria-label={tr(label)} title={`${tr(label)} (${key})`} disabled={disabled}
      onClick={() => { setPop(null); ctrl.setTool(tool); }} className={`${chip} ${t === tool ? on : idle} ${disabled ? "opacity-40" : ""}`}><BIcon name={icon} size={21} /></button>
  );
  const two = orient === "col" && cols === 2;
  const sep = two ? null : <span aria-hidden className={orient === "col" ? "my-0.5 h-px w-7 self-center bg-[var(--hub-warm-line)]" : "mx-0.5 h-7 w-px flex-none self-center bg-[var(--hub-warm-line)]"} />;
  return (
    <div role="toolbar" aria-label={tr("hublive.bToolsAria")} aria-orientation={orient === "col" ? "vertical" : "horizontal"} data-testid="board-tools"
      className={`${two ? "grid grid-cols-2" : "flex"} ${orient === "col" ? `${two ? "" : "flex-col"} max-h-full overflow-y-auto p-1.5` : "flex-row overflow-x-auto px-1.5 py-1"} gap-0.5`}>
      {draw && <>
        {btn("select", "select", "hublive.bTool_select", "V")}
        {btn("pen", "pen", "hublive.bTool_pen", "P")}
        {btn("highlighter", "highlighter", "hublive.bTool_highlighter", "H")}
        {btn("eraser", "eraser", "hublive.bTool_eraser", "E")}
        {btn("text", "text", "hublive.bTool_text", "T")}
        {btn("sticky", "sticky", "hublive.bTool_sticky", "S")}
        {sep}
        <button type="button" data-tool="shapes" aria-haspopup="true" aria-expanded={pop === "shapes"} aria-label={tr("hublive.bTool_shapes")} title={tr("hublive.bShapesTitle", { shape: tr("hublive.bShape_" + lastShape) })}
          onClick={() => { setPop(pop === "shapes" ? null : "shapes"); }} className={`${chip} relative ${isShape(t) ? on : idle}`}>
          <BIcon name={isShape(t) ? t : lastShape} size={21} /><span aria-hidden className="absolute bottom-1 end-1 h-1.5 w-1.5 rounded-full bg-current opacity-60" />
        </button>
        {ctrl.isTutor && (
          <button type="button" data-tool="insert" aria-haspopup="true" aria-expanded={pop === "insert"} aria-label={tr("hublive.bToolkitAria")} title={tr("hublive.bToolkitTitle")}
            onMouseDown={(e) => e.preventDefault()} onClick={() => setPop(pop === "insert" ? null : "insert")} className={`${chip} ${pop === "insert" ? on : idle}`}><BIcon name="insert" size={21} /></button>
        )}
        {sep}
      </>}
      {btn("laser", "laser", "hublive.bTool_laser", "Q")}
      {btn("pan", "pan", "hublive.bTool_pan", "M")}
    </div>
  );
}

export function ShapesPop({ ctrl, close }: { ctrl: BoardController; close: () => void }) {
  const t = useT();
  return (
    <div role="menu" aria-label={t("hublive.bTool_shapes")} data-testid="board-shapes" className={`${card} hub-pop grid grid-cols-5 gap-0.5 p-1.5`}>
      {SHAPES.map((s) => (
        <button key={s.t} type="button" role="menuitem" data-shape={s.t} aria-label={t("hublive.bShape_" + s.t)} title={s.key ? `${t("hublive.bShape_" + s.t)} (${s.key})` : t("hublive.bShape_" + s.t)} onClick={() => { ctrl.setTool(s.t); close(); }} className={`${chip} ${ctrl.ui.tool === s.t ? on : idle}`}><BIcon name={s.t} size={21} /></button>
      ))}
    </div>
  );
}

export function InsertPop({ ctrl, close, onPicture }: { ctrl: BoardController; close: () => void; onPicture: () => void }) {
  const t = useT();
  return (
    <div role="menu" aria-label={t("hublive.bInsert")} data-testid="board-insert" className={`${card} hub-pop grid w-[248px] grid-cols-2 gap-1 p-2`}>
      <div className="col-span-2 px-1.5 pb-0.5 pt-0.5 text-[11px] font-extrabold uppercase tracking-[0.1em] text-[var(--ink-3)]">{t("hublive.bTeachingAids")}</div>
      {STAMPS.map((s) => (
        <button key={s.kind} type="button" role="menuitem" data-stamp={s.kind} onClick={() => { ctrl.insertStamp(s.kind); close(); }}
          className={`flex min-h-[44px] items-center gap-2 rounded-xl px-2 text-start text-[12.5px] font-bold text-[var(--ink)] hover:bg-[var(--brand-soft)] ${FOCUS}`}>
          <span className="grid h-8 w-8 flex-none place-items-center rounded-lg bg-[var(--brand-soft)] text-[var(--brand)]"><BIcon name={s.kind as BIconName} size={18} /></span>
          <span className="leading-tight">{tx(t, "hublive.bStamp_" + s.kind, s.label)}</span>
        </button>
      ))}
      <div className="col-span-2 mt-1 border-t border-[var(--hub-warm-line)] pt-1.5">
        <button type="button" role="menuitem" data-action="insert-picture" onClick={() => { close(); onPicture(); }}
          className={`flex min-h-[44px] w-full items-center gap-2 rounded-xl px-2 text-start text-[12.5px] font-bold text-[var(--ink)] hover:bg-[var(--brand-soft)] ${FOCUS}`}>
          <span className="grid h-8 w-8 flex-none place-items-center rounded-lg bg-[var(--gold-soft)] text-[var(--ink)]"><BIcon name="image" size={18} /></span>{t("hublive.bPicture")}
        </button>
      </div>
    </div>
  );
}

// ── options bar ─────────────────────────────────────────────────────────────
function Swatch({ colour, current, onPick, label }: { colour: string; current: boolean; onPick: () => void; label: string }) {
  return (
    <button type="button" aria-label={label} aria-pressed={current} title={label} onClick={onPick} className={`grid h-11 w-11 flex-none place-items-center rounded-full ${FOCUS}`}>
      <span className={`block h-7 w-7 rounded-full border-2 transition-transform motion-reduce:transition-none ${current ? "scale-110 border-[var(--brand)] shadow-[0_0_0_2px_var(--surface),0_0_0_4px_var(--brand)]" : "border-white shadow-[0_0_0_1px_var(--hub-warm-line)]"}`} style={{ background: colour }} />
    </button>
  );
}
function Sizes({ sizes, value, onPick, kind }: { sizes: number[]; value: number; onPick: (n: number) => void; kind: string }) {
  const t = useT();
  const kl = t("hublive.bKind_" + kind);
  return (
    <div role="group" aria-label={t("hublive.bSizeOf", { kind: kl })} className="flex items-center">
      {sizes.map((s, i) => (
        <button key={s} type="button" aria-label={t("hublive.bSizeOfN", { kind: kl, n: i + 1 })} aria-pressed={value === s} title={t("hublive.bSize_" + i)} onClick={() => onPick(s)} className={`grid h-11 w-11 place-items-center rounded-xl ${FOCUS} ${value === s ? "bg-[var(--brand-soft)]" : "hover:bg-[var(--hub-warm-2)]"}`}>
          <span className="block rounded-full bg-[var(--ink)]" style={{ width: Math.min(24, 5 + i * 5 + (kind === "Eraser" ? 4 : 0)), height: Math.min(24, 5 + i * 5 + (kind === "Eraser" ? 4 : 0)), opacity: kind === "Highlighter" ? 0.45 : 1 }} />
        </button>
      ))}
    </div>
  );
}
const divider = <span aria-hidden className="mx-1 hidden h-7 w-px flex-none bg-[var(--hub-warm-line)] sm:block" />;
const smallBtn = `inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border px-3 text-[12.5px] font-extrabold ${FOCUS}`;

export function OptionsBar({ ctrl }: { ctrl: BoardController }) {
  const t = useT();
  useCtrl(ctrl);
  const u = ctrl.ui, tool = u.tool;
  const sel = ctrl.selectedEls;
  const colours = (
    <div role="group" aria-label={t("hublive.bColour")} className="flex items-center">
      {ctrl.palette.map((c) => <Swatch key={c} colour={c} current={u.colour.toLowerCase() === c.toLowerCase()} onPick={() => ctrl.setUi({ colour: c })} label={t("hublive.bColourHex", { c })} />)}
      <label className={`relative grid h-11 w-11 flex-none cursor-pointer place-items-center rounded-full ${FOCUS}`} title={t("hublive.bCustomColour")}>
        <span className="block h-7 w-7 rounded-full border-2 border-white shadow-[0_0_0_1px_var(--hub-warm-line)]" style={{ background: "conic-gradient(#e21d27, #f5b81f, #15b364, #2f6bd8, #6a4fd0, #e22295, #e21d27)" }} />
        <input type="color" aria-label={t("hublive.bCustomColour")} value={/^#[0-9a-f]{6}$/i.test(u.colour) ? u.colour : "#000000"} onChange={(e) => ctrl.setUi({ colour: e.target.value })} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
      </label>
    </div>
  );
  let body: ReactNode = null;
  if (!ctrl.canDraw && tool !== "laser") body = <span className="px-2 text-[12.5px] font-semibold text-[var(--ink-2)]">{ctrl.isTutor ? "" : t("hublive.bTutorLeading")}</span>;
  else if (tool === "pen") body = <>{colours}{divider}<Sizes kind="Pen" sizes={PEN_SIZES} value={u.penSize} onPick={(n) => ctrl.setUi({ penSize: n })} />{divider}
    <div role="group" aria-label={t("hublive.bPenStyle")} data-testid="pen-styles" className="flex items-center">
      {PEN_STYLES.map((ps) => <button key={ps} type="button" data-pen-style={ps} aria-pressed={u.penStyle === ps} aria-label={t("hublive.bPenOf", { style: t("hublive.bPenStyle_" + ps) })} title={t("hublive.bPenOf", { style: t("hublive.bPenStyle_" + ps) })} onClick={() => ctrl.setUi({ penStyle: ps })} className={`${chip} ${u.penStyle === ps ? on : idle}`}><BIcon name={ps === "solid" ? "styleSolid" : ps === "dash" ? "styleDash" : ps === "neon" ? "styleNeon" : "styleRainbow"} size={22} /></button>)}
    </div></>;
  else if (tool === "highlighter") body = <>{colours}{divider}<Sizes kind="Highlighter" sizes={HL_SIZES} value={u.hlSize} onPick={(n) => ctrl.setUi({ hlSize: n })} /></>;
  else if (tool === "eraser") body = <>
    <div role="group" aria-label={t("hublive.bEraserWhat")} data-testid="eraser-modes" className="flex items-center">
      <button type="button" data-eraser-mode="ink" aria-pressed={!u.eraserAll} onClick={() => ctrl.setUi({ eraserAll: false })} title={t("hublive.bEraserInkTitle")} className={`${smallBtn} ${!u.eraserAll ? "border-transparent bg-[var(--brand)] text-white" : "border-[var(--hub-warm-line)] bg-[var(--surface)] text-[var(--ink-2)]"}`}>{t("hublive.bDrawings")}</button>
      <button type="button" data-eraser-mode="all" aria-pressed={u.eraserAll} onClick={() => ctrl.setUi({ eraserAll: true })} title={t("hublive.bEraserAllTitle")} className={`${smallBtn} ms-1 ${u.eraserAll ? "border-transparent bg-[var(--brand)] text-white" : "border-[var(--hub-warm-line)] bg-[var(--surface)] text-[var(--ink-2)]"}`}>{t("hublive.bEverything")}</button>
    </div>{divider}<Sizes kind="Eraser" sizes={ERASER_SIZES} value={u.eraserSize} onPick={(n) => ctrl.setUi({ eraserSize: n })} /></>;
  else if (tool === "text") body = (
    <>{colours}{divider}
      <Sizes kind="Text" sizes={TEXT_SIZES} value={u.textSize} onPick={(n) => ctrl.setUi({ textSize: n })} />
      <button type="button" aria-pressed={u.bold} aria-label={t("hublive.bBold")} title={t("hublive.bBold")} onClick={() => ctrl.setUi({ bold: !u.bold })} className={`${chip} ${u.bold ? on : idle}`}><BIcon name="bold" size={18} /></button>
    </>);
  else if (tool === "sticky") body = (
    <div role="group" aria-label={t("hublive.bNoteColour")} className="flex items-center">
      {STICKY_COLOURS.map((c) => <Swatch key={c} colour={c} current={u.stickyColour === c} onPick={() => ctrl.setUi({ stickyColour: c })} label={t("hublive.bNoteColourHex", { c })} />)}
    </div>);
  else if (isShape(tool)) body = (
    <>{colours}{divider}<Sizes kind="Line" sizes={PEN_SIZES} value={u.penSize} onPick={(n) => ctrl.setUi({ penSize: n })} />
      <FillControls ctrl={ctrl} closed={isClosedShape(tool)} fill={u.fill} fillColour={u.fillColour} solid={u.fillSolid} noLine={u.noLine} dashed={u.dashed} />
      {tool === "ngon" && <SidesStepper ctrl={ctrl} n={u.sides} />}
      <span className="hidden px-1.5 text-[11.5px] text-[var(--ink-3)] lg:inline">{tool === "triangle" ? t("hublive.bShiftTri") : t("hublive.bShiftStraight")}</span>
    </>);
  else if (tool === "laser") body = <><span className="px-2 text-[12.5px] font-bold text-[var(--ink-2)]">{t("hublive.bLaserHint")}</span></>;
  else if (tool === "pan") body = <span className="px-2 text-[12.5px] font-bold text-[var(--ink-2)]">{t("hublive.bPanHint")}</span>;
  else if (tool === "select") {
    if (!sel.length) body = <span className="px-2 text-[12.5px] font-bold text-[var(--ink-2)]">{t("hublive.bSelectHint")}</span>;
    else body = <SelectionOptions ctrl={ctrl} sel={sel} colours={colours} />;
  }
  if (!body) return null;
  return (
    <div data-testid="board-options" className={`${card} hub-pop flex max-w-full items-center gap-0.5 overflow-x-auto px-1.5 py-0.5`}>{body}</div>
  );
}

/** Fill / solid / no-outline / dashed for a shape — the same buttons for a shape about to be drawn and for one that is selected. */
function FillControls({ ctrl, closed, fill, fillColour, solid, noLine, dashed }: { ctrl: BoardController; closed: boolean; fill: boolean; fillColour: string | null; solid: boolean; noLine: boolean; dashed: boolean }) {
  const t = useT();
  const tog = (pressed: boolean, label: string, icon: BIconName, fn: () => void, data?: string) => <button type="button" aria-pressed={pressed} aria-label={label} title={label} data-action={data} onClick={fn} className={`${chip} ${pressed ? on : idle}`}><BIcon name={icon} size={19} /></button>;
  return (
    <>
      {closed && tog(fill, t("hublive.bFillShape"), "fill", () => ctrl.setUi({ fill: !fill }), "fill")}
      {closed && fill && <div role="group" aria-label={t("hublive.bFillColour")} data-testid="fill-colours" className="flex items-center">
        <button type="button" aria-pressed={fillColour === null} title={t("hublive.bFillSame")} aria-label={t("hublive.bFillSameAria")} onClick={() => ctrl.setUi({ fillColour: null })} className={`${smallBtn} px-2 text-[11.5px] ${fillColour === null ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)]" : "border-[var(--hub-warm-line)] text-[var(--ink-2)]"}`}>{t("hublive.bAsLine")}</button>
        {ctrl.palette.map((c) => <Swatch key={c} colour={c} current={(fillColour ?? "").toLowerCase() === c.toLowerCase()} onPick={() => ctrl.setUi({ fillColour: c })} label={t("hublive.bFillColourHex", { c })} />)}
        <button type="button" aria-pressed={solid} title={t("hublive.bSolidTitle")} aria-label={t("hublive.bSolidAria")} data-action="fill-solid" onClick={() => ctrl.setUi({ fillSolid: !solid })} className={`${smallBtn} ${solid ? "border-transparent bg-[var(--brand)] text-white" : "border-[var(--hub-warm-line)] text-[var(--ink-2)]"}`}>{t("hublive.bSolid")}</button>
      </div>}
      {tog(dashed, t("hublive.bDashed"), "dashed", () => ctrl.setUi({ dashed: !dashed }), "dashed")}
      {closed && <button type="button" aria-pressed={noLine} title={t("hublive.bNoOutline")} aria-label={t("hublive.bNoOutline")} data-action="no-outline" onClick={() => ctrl.setUi({ noLine: !noLine })} className={`${smallBtn} ${noLine ? "border-transparent bg-[var(--brand)] text-white" : "border-[var(--hub-warm-line)] text-[var(--ink-2)]"}`}>{t("hublive.bNoLine")}</button>}
    </>
  );
}
function SidesStepper({ ctrl, n }: { ctrl: BoardController; n: number }) {
  const t = useT();
  return (
    <div role="group" aria-label={t("hublive.bSidesCount")} data-testid="sides" className="flex items-center">
      <button type="button" aria-label={t("hublive.bFewerSides")} disabled={n <= 3} onClick={() => ctrl.setUi({ sides: Math.max(3, n - 1) })} className={`${chip} ${idle} disabled:opacity-35`}><BIcon name="minus" size={17} /></button>
      <span className="min-w-[64px] text-center text-[12.5px] font-extrabold tabular-nums text-[var(--ink)]">{t("hublive.bNSides", { n })}</span>
      <button type="button" aria-label={t("hublive.bMoreSides")} disabled={n >= 12} onClick={() => ctrl.setUi({ sides: Math.min(12, n + 1) })} className={`${chip} ${idle} disabled:opacity-35`}><BIcon name="plus" size={17} /></button>
    </div>
  );
}
const TRI_TYPES: ("equilateral" | "isosceles" | "right" | "scalene" | "obtuse")[] = ["equilateral", "isosceles", "right", "scalene", "obtuse"];

function SelectionOptions({ ctrl, sel, colours }: { ctrl: BoardController; sel: El[]; colours: ReactNode }) {
  const t = useT();
  const one = sel.length === 1 ? sel[0]! : null;
  const stamp = one?.k === "stamp" ? one : null;
  const shape = one?.k === "shape" && isClosedShape(one.shape) ? one : null;
  const wholeGroup = sel.length > 1 && sel.every((e) => e.grp && e.grp === sel[0]!.grp);
  // a template's colours are deliberate: colour swatches are for a single part or your own drawings, not a whole template
  const styled = !wholeGroup && sel.some((e) => e.k === "stroke" || e.k === "shape" || e.k === "text");
  const mine = sel.some((e) => ctrl.isTutor || e.own === ctrl.self.own);
  const labelled = one && (one.k === "text" || (shape && canHoldText(shape)));
  const locked = sel.length > 0 && sel.every((e) => e.lock);
  const anyGrp = sel.some((e) => e.grp), canGroup = sel.filter((e) => ctrl.isTutor || e.own === ctrl.self.own).length > 1;
  const act = (label: string, icon: BIconName, fn: () => void, data?: string, pressed?: boolean) => <button type="button" data-action={data} aria-pressed={pressed} onClick={fn} aria-label={label} title={label} className={`${chip} ${pressed ? on : idle}`}><BIcon name={icon} size={18} /></button>;
  return (
    <>
      {styled && <>{colours}{divider}</>}
      {sel.some((e) => e.k === "stroke" || e.k === "shape") && !wholeGroup && <><Sizes kind="Line" sizes={PEN_SIZES} value={one?.w ?? -1} onPick={(n) => ctrl.setUi({ penSize: n })} />{divider}</>}
      {shape && <><FillControls ctrl={ctrl} closed fill={!!shape.fill} fillColour={shape.fill && shape.fill !== shape.c ? shape.fill : null} solid={shape.fa === 1} noLine={!!shape.ns} dashed={!!shape.dash} />{divider}</>}
      {shape?.shape === "ngon" && <><SidesStepper ctrl={ctrl} n={Math.round(shape.n ?? 5)} />{divider}</>}
      {shape?.shape === "triangle" && <div role="group" aria-label={t("hublive.bTriType")} data-testid="triangle-types" className="flex items-center">{TRI_TYPES.map((k) => <button key={k} type="button" data-triangle={k} onClick={() => ctrl.setTriangleType(k)} className={`${smallBtn} me-0.5 border-[var(--hub-warm-line)] px-2 text-[11.5px] text-[var(--ink-2)] hover:bg-[var(--brand-soft)]`}>{t("hublive.bTri_" + k)}</button>)}{divider}</div>}
      {labelled && <>
        <Sizes kind="Text" sizes={TEXT_SIZES} value={one!.size ?? -1} onPick={(n) => ctrl.setUi({ textSize: n })} />
        {shape && <button type="button" data-action="auto-size" aria-pressed={one!.size === undefined} title={t("hublive.bAutoTitle")} onClick={() => ctrl.patchEl(one!.id, { size: undefined })} className={`${smallBtn} border-[var(--hub-warm-line)] px-2 text-[11.5px] ${one!.size === undefined ? "bg-[var(--brand-soft)] text-[var(--brand)]" : "text-[var(--ink-2)]"}`}>{t("hublive.bAuto")}</button>}
        <button type="button" aria-pressed={!!one!.bold} aria-label={t("hublive.bBold")} title={t("hublive.bBold")} onClick={() => ctrl.setUi({ bold: !one!.bold })} className={`${chip} ${one!.bold ? on : idle}`}><BIcon name="bold" size={18} /></button>
        {shape && <>{act(t("hublive.bAlignL"), "alignL", () => ctrl.setLabelAlign("l"), "align-l", shape.al === "l")}{act(t("hublive.bCentre"), "alignC", () => ctrl.setLabelAlign("c"), "align-c", !shape.al || shape.al === "c")}{act(t("hublive.bAlignR"), "alignR", () => ctrl.setLabelAlign("r"), "align-r", shape.al === "r")}</>}
        {divider}
      </>}
      {one?.k === "sticky" && <><div role="group" aria-label={t("hublive.bNoteColour")} className="flex items-center">{STICKY_COLOURS.map((c) => <Swatch key={c} colour={c} current={one.c === c} onPick={() => ctrl.setUi({ stickyColour: c })} label={t("hublive.bNoteColourHex", { c })} />)}</div>{divider}</>}
      {stamp && <StampOptions ctrl={ctrl} el={stamp} />}
      {mine && ctrl.selectedTable && <TableOptions ctrl={ctrl} rows={ctrl.selectedTable.cells.length} cols={ctrl.selectedTable.cells[0]!.length} />}
      {shape && mine && <button type="button" data-action="edit-text" onClick={() => ctrl.beginEdit(shape)} className={`${smallBtn} border-[var(--hub-warm-line)] text-[var(--ink-2)] hover:bg-[var(--brand-soft)]`} title={t("hublive.bTypeInTitle")}>{t("hublive.bTypeIn")}</button>}
      {mine && <>
        {canGroup && !wholeGroup && act(t("hublive.bGroup"), "group", () => ctrl.groupSelection(), "group")}
        {anyGrp && act(t("hublive.bUngroup"), "ungroup", () => ctrl.ungroupSelection(), "ungroup")}
        <button type="button" onClick={() => ctrl.duplicateSelection()} aria-label={t("hublive.bDuplicate")} title={`${t("hublive.bDuplicate")} (Ctrl+D)`} className={`${chip} ${idle}`}><BIcon name="copy" size={18} /></button>
        <button type="button" onClick={() => ctrl.bringToFront()} aria-label={t("hublive.bFront")} title={`${t("hublive.bFront")} (])`} data-action="to-front" className={`${chip} ${idle}`}><BIcon name="front" size={18} /></button>
        <button type="button" onClick={() => ctrl.sendToBack()} aria-label={t("hublive.bBack")} title={`${t("hublive.bBack")} ([)`} data-action="to-back" className={`${chip} ${idle}`}><BIcon name="back" size={18} /></button>
        {act(locked ? t("hublive.bUnlock") : t("hublive.bLock"), locked ? "unlock" : "lock", () => ctrl.toggleLock(), "lock", locked)}
        <button type="button" data-action="delete-selection" onClick={() => ctrl.deleteSelection()} aria-label={t("hublive.bDelete")} title={t("hublive.bDeleteKey")} className={`${chip} text-[var(--red)] hover:bg-[var(--red-soft)]`}><BIcon name="trash" size={18} /></button>
      </>}
      {!mine && <span className="px-2 text-[12.5px] font-bold text-[var(--ink-3)]">{t("hublive.bNotYours")}</span>}
    </>
  );
}

const fld = `min-h-[44px] rounded-xl border border-[var(--hub-warm-line)] bg-[var(--surface)] px-2.5 text-[13px] font-bold text-[var(--ink)] ${FOCUS}`;
/** A selected table (a grid of typeable cells): add / remove its last row or column. Resize it like any template (drag a corner handle). */
function TableOptions({ ctrl, rows, cols }: { ctrl: BoardController; rows: number; cols: number }) {
  const t = useT();
  const b = (label: string, data: string, fn: () => void, disabled = false) => <button type="button" data-action={data} disabled={disabled} onClick={fn} title={label} aria-label={label} className={`${smallBtn} border-[var(--hub-warm-line)] px-2 text-[11.5px] text-[var(--ink-2)] hover:bg-[var(--brand-soft)] disabled:opacity-35`}>{label}</button>;
  return (
    <div role="group" aria-label={t("hublive.bTable")} data-testid="table-options" data-rows={rows} data-cols={cols} className="flex items-center gap-0.5">
      <span className="px-1 text-[11.5px] font-bold text-[var(--ink-3)]">{rows}×{cols}</span>
      {b(t("hublive.bAddRow"), "table-add-row", () => ctrl.tableAdd("row"))}
      {b(t("hublive.bDelRow"), "table-remove-row", () => ctrl.tableRemove("row"), rows <= 1)}
      {b(t("hublive.bAddCol"), "table-add-col", () => ctrl.tableAdd("col"))}
      {b(t("hublive.bDelCol"), "table-remove-col", () => ctrl.tableRemove("col"), cols <= 1)}
      {divider}
    </div>
  );
}
function StampOptions({ ctrl, el }: { ctrl: BoardController; el: El }) {
  const t = useT();
  const set = (o: Record<string, number | string | boolean>) => ctrl.patchEl(el.id, { opts: { ...el.opts, ...o } });
  const n = (k: string, d: number) => Number(el.opts?.[k] ?? d);
  const kind = el.stamp as StampKind;
  const lab = (s: string, child: ReactNode) => <label className="flex items-center gap-1.5 px-1 text-[12px] font-bold text-[var(--ink-2)]">{s}{child}</label>;
  const num = (k: string, d: number, min: number, max: number, step = 1) => (
    <input type="number" aria-label={tx(t, "hublive.bNum_" + k, k)} className={`${fld} w-[68px]`} value={n(k, d)} min={min} max={max} step={step} onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v)) set({ [k]: Math.min(max, Math.max(min, v)) }); }} />
  );
  return (
    <div data-testid="stamp-options" className="flex items-center gap-1">
      <span className="hidden px-1 text-[11px] font-extrabold uppercase tracking-[0.08em] text-[var(--ink-3)] sm:inline">{tx(t, "hublive.bStamp_" + kind, stampDef(kind).label)}</span>
      {kind === "numberline" && <>{lab(t("hublive.bFrom"), num("min", 0, -1000, 999))}{lab(t("hublive.bTo"), num("max", 10, -999, 1000))}{lab(t("hublive.bBy"), num("step", 1, 0.01, 500, 0.5))}</>}
      {kind === "fractions" && <>{lab(t("hublive.bParts"), <select aria-label={t("hublive.bParts")} className={fld} value={n("parts", 4)} onChange={(e) => set({ parts: Number(e.target.value), mask: 0 })}>{[2, 3, 4, 5, 6, 8, 10, 12].map((p) => <option key={p} value={p}>{p}</option>)}</select>)}
        <button type="button" className={`${smallBtn} border-[var(--hub-warm-line)] bg-[var(--surface)] text-[var(--ink-2)]`} onClick={() => set({ mask: 0 })}>{t("hublive.bClearShading")}</button>
        <span className="hidden px-1 text-[11.5px] text-[var(--ink-3)] lg:inline">{t("hublive.bClickShade")}</span></>}
      {kind === "coordgrid" && lab(t("hublive.bRange"), <select aria-label={t("hublive.bNum_range")} className={fld} value={n("n", 10)} onChange={(e) => set({ n: Number(e.target.value) })}>{[5, 10, 15, 20].map((p) => <option key={p} value={p}>{p}</option>)}</select>)}
      {kind === "timestable" && lab(t("hublive.bUpTo"), <select aria-label={t("hublive.bTimesSize")} className={fld} value={n("n", 10)} onChange={(e) => set({ n: Number(e.target.value) })}>{[5, 10, 12].map((p) => <option key={p} value={p}>{p} × {p}</option>)}</select>)}
      {kind === "clock" && <>{lab(t("hublive.bHour"), <select aria-label={t("hublive.bHour")} className={fld} value={n("hh", 3) % 12 || 12} onChange={(e) => set({ hh: Number(e.target.value) % 12 })}>{Array.from({ length: 12 }, (_, i) => i + 1).map((h) => <option key={h} value={h}>{h}</option>)}</select>)}
        {lab(t("hublive.bMin"), <select aria-label={t("hublive.bMinutes")} className={fld} value={n("mm", 0)} onChange={(e) => set({ mm: Number(e.target.value) })}>{Array.from({ length: 12 }, (_, i) => i * 5).map((m) => <option key={m} value={m}>{String(m).padStart(2, "0")}</option>)}</select>)}</>}
      {kind === "periodic" && <><label className="flex items-center gap-1.5 px-1 text-[12px] font-bold text-[var(--ink-2)]"><input type="checkbox" checked={!!(el.opts?.colour ?? true)} onChange={(e) => set({ colour: e.target.checked })} className="h-4 w-4 accent-[var(--brand)]" />{t("hublive.bColourByGroup")}</label><button type="button" className={`${smallBtn} border-[var(--hub-warm-line)] bg-[var(--surface)] text-[var(--ink-2)]`} onClick={() => set({ sel: "" })}>{t("hublive.bClearHighlights")}</button><span className="hidden px-1 text-[11.5px] text-[var(--ink-3)] lg:inline">{t("hublive.bTapElement")}</span></>}
      {kind === "plot" && <>{lab("y =", <input aria-label={t("hublive.bFunction")} className={`${fld} w-[150px]`} defaultValue={String(el.opts?.expr ?? "")} onBlur={(e) => set({ expr: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") set({ expr: (e.target as HTMLInputElement).value }); e.stopPropagation(); }} placeholder="x^2 - 2" />)}{lab(t("hublive.bAnd"), <input aria-label={t("hublive.bSecondFn")} className={`${fld} w-[120px]`} defaultValue={String(el.opts?.expr2 ?? "")} onBlur={(e) => set({ expr2: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") set({ expr2: (e.target as HTMLInputElement).value }); e.stopPropagation(); }} placeholder="2x+1" />)}{lab("±", num("range", 10, 2, 50))}</>}
      {kind === "bohr" && <>{lab(t("hublive.bSymbol"), <input aria-label={t("hublive.bSymbol")} className={`${fld} w-[64px]`} defaultValue={String(el.opts?.symbol ?? "")} onBlur={(e) => set({ symbol: e.target.value })} onKeyDown={(e) => e.stopPropagation()} />)}{lab(t("hublive.bShells"), <input aria-label={t("hublive.bElectrons")} className={`${fld} w-[110px]`} defaultValue={String(el.opts?.shells ?? "")} onBlur={(e) => set({ shells: e.target.value })} onKeyDown={(e) => e.stopPropagation()} placeholder="2,8,1" />)}</>}
      {kind === "symbol" && lab(t("hublive.bSymbol"), <select aria-label={t("hublive.bCircuitSymbol")} className={fld} value={String(el.opts?.kind ?? "cell")} onChange={(e) => set({ kind: e.target.value })}>{SYMBOL_KINDS.map((k) => <option key={k} value={k}>{tx(t, "hublive.bOpt_" + slug(k), k)}</option>)}</select>)}
      {kind === "apparatus" && lab(t("hublive.bApparatus"), <select aria-label={t("hublive.bApparatus")} className={fld} value={String(el.opts?.kind ?? "beaker")} onChange={(e) => set({ kind: e.target.value })}>{APPARATUS_KINDS.map((k) => <option key={k} value={k}>{tx(t, "hublive.bOpt_" + slug(k), k)}</option>)}</select>)}
      {kind === "lens" && <>{lab(t("hublive.bLens"), <select aria-label={t("hublive.bLensType")} className={fld} value={String(el.opts?.type ?? "convex")} onChange={(e) => set({ type: e.target.value })}><option value="convex">{t("hublive.bConvex")}</option><option value="concave">{t("hublive.bConcave")}</option></select>)}{lab("f", num("f", 140, 30, 400, 10))}{lab(t("hublive.bObject"), num("obj", 260, 30, 700, 10))}</>}
      {kind === "timeline" && <>{lab(t("hublive.bFrom"), num("start", 1000, -5000, 3000))}{lab(t("hublive.bTo"), num("end", 2000, -4999, 3001))}{lab(t("hublive.bEvents"), <input aria-label={t("hublive.bEvents")} className={`${fld} w-[230px]`} defaultValue={String(el.opts?.events ?? "")} onBlur={(e) => set({ events: e.target.value })} onKeyDown={(e) => e.stopPropagation()} placeholder="1066|Hastings; 1215|Magna Carta" />)}</>}
      {kind === "textblock" && <>{lab(t("hublive.bTextLbl"), <textarea aria-label={t("hublive.bTextLbl")} rows={1} className={`${fld} w-[260px] resize-y py-2.5`} defaultValue={String(el.opts?.text ?? "")} onBlur={(e) => { if (e.target.value !== String(el.opts?.text ?? "")) set({ text: e.target.value }); }} onKeyDown={(e) => e.stopPropagation()} />)}{lab(t("hublive.bSizeLbl"), num("size", 24, 14, 60, 2))}<span className="hidden px-1 text-[11.5px] text-[var(--ink-3)] lg:inline">{t("hublive.bTextblockHint")}</span></>}
      {kind === "timer" && <><button type="button" data-action="timer-start" className={`${smallBtn} border-transparent bg-[var(--green)] text-white`} onClick={() => set({ endsAt: Date.now() + Math.max(1, Number(el.opts?.endsAt) > Date.now() ? Math.round((Number(el.opts?.endsAt) - Date.now()) / 1000) : Number(el.opts?.left ?? el.opts?.secs ?? 300)) * 1000 })}>{t("hublive.bStart")}</button><button type="button" className={`${smallBtn} border-[var(--hub-warm-line)] bg-[var(--surface)] text-[var(--ink-2)]`} onClick={() => set({ endsAt: 0, left: Number(el.opts?.secs ?? 300) })}>{t("hublive.bReset")}</button>{lab(t("hublive.bMins"), <input type="number" aria-label={t("hublive.bMinutes")} className={`${fld} w-[68px]`} min={1} max={60} defaultValue={Math.round(Number(el.opts?.secs ?? 300) / 60)} onBlur={(e) => { const s = Math.max(10, Math.min(3600, Number(e.target.value) * 60)); set({ secs: s, left: s, endsAt: 0 }); }} onKeyDown={(e) => e.stopPropagation()} />)}</>}
      {kind === "map" && <>{lab(t("hublive.bRegion"), <select aria-label={t("hublive.bRegion")} className={fld} value={String(el.opts?.region ?? "world")} onChange={(e) => set({ region: e.target.value })}>{Object.entries(MAP_REGIONS).map(([k, r]) => <option key={k} value={k}>{tx(t, "hublive.bRegion_" + k, r.label)}</option>)}</select>)}<label className="flex items-center gap-1.5 px-1 text-[12px] font-bold text-[var(--ink-2)]"><input type="checkbox" checked={!!(el.opts?.labels ?? true)} onChange={(e) => set({ labels: e.target.checked })} className="h-4 w-4 accent-[var(--brand)]" />{t("hublive.bNames")}</label><label className="flex items-center gap-1.5 px-1 text-[12px] font-bold text-[var(--ink-2)]"><input type="checkbox" checked={!!el.opts?.grid} onChange={(e) => set({ grid: e.target.checked })} className="h-4 w-4 accent-[var(--brand)]" />{t("hublive.bGrid")}</label></>}
      {kind === "dice" && <>{lab(t("hublive.bDice"), <select aria-label={t("hublive.bNumDice")} className={fld} value={n("n", 1) >= 2 ? 2 : 1} onChange={(e) => set({ n: Number(e.target.value) })}><option value={1}>1</option><option value={2}>2</option></select>)}<span className="hidden px-1 text-[11.5px] text-[var(--ink-3)] lg:inline">{t("hublive.bClickRoll")}</span></>}
      {kind === "spinner" && <>{lab(t("hublive.bNames"), <input aria-label={t("hublive.bSpinnerNames")} className={`${fld} w-[260px]`} defaultValue={String(el.opts?.items ?? "")} onBlur={(e) => set({ items: e.target.value, pick: -1 })} onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") set({ items: (e.target as HTMLInputElement).value, pick: -1 }); }} />)}<span className="hidden px-1 text-[11.5px] text-[var(--ink-3)] lg:inline">{t("hublive.bSpinHint")}</span></>}
      {kind === "tally" && <>{lab(t("hublive.bLabel"), <input aria-label={t("hublive.bCounterLabel")} className={`${fld} w-[130px]`} defaultValue={String(el.opts?.label ?? "")} onBlur={(e) => set({ label: e.target.value })} onKeyDown={(e) => e.stopPropagation()} />)}
        <button type="button" data-action="tally-minus" className={`${smallBtn} border-[var(--hub-warm-line)] bg-[var(--surface)] text-[var(--ink-2)]`} onClick={() => set({ n: Math.max(0, n("n", 0) - 1) })}>−1</button>
        <button type="button" data-action="tally-reset" className={`${smallBtn} border-[var(--hub-warm-line)] bg-[var(--surface)] text-[var(--ink-2)]`} onClick={() => set({ n: 0 })}>{t("hublive.bReset")}</button></>}
      {(kind === "ruler" || kind === "protractor") && <span className="px-1 text-[11.5px] text-[var(--ink-3)]">{t("hublive.bRulerHint")}</span>}
      <span aria-hidden className="mx-1 h-7 w-px bg-[var(--hub-warm-line)]" />
    </div>
  );
}

// ── top bar ─────────────────────────────────────────────────────────────────
export function PageTabs({ ctrl }: { ctrl: BoardController }) {
  const t = useT();
  useCtrl(ctrl);
  const pages = ctrl.state.pages;
  return (
    <div role="tablist" aria-label={t("hublive.bBoardPages")} data-testid="board-pages" className={`${card} flex max-w-full items-center gap-0.5 overflow-x-auto p-1`}>
      {pages.map((p, i) => (
        <button key={p.id} type="button" role="tab" aria-selected={p.id === ctrl.page} data-page={p.id} aria-label={t("hublive.bPageN", { n: i + 1 })} title={t("hublive.bPageN", { n: i + 1 })}
          onClick={() => ctrl.isTutor ? ctrl.setPage(p.id) : undefined} disabled={!ctrl.isTutor && p.id !== ctrl.page}
          className={`${chip} ${p.id === ctrl.page ? on : idle} disabled:opacity-100`}>{i + 1}</button>
      ))}
      {ctrl.isTutor && <button type="button" aria-label={t("hublive.bAddPage")} title={t("hublive.bAddPage")} data-action="add-page" onClick={() => ctrl.addPage()} className={`${chip} ${idle}`}><BIcon name="insert" size={18} /></button>}
    </div>
  );
}

export function HistoryButtons({ ctrl }: { ctrl: BoardController }) {
  const t = useT();
  useCtrl(ctrl);
  if (!ctrl.canDraw) return null;
  return (
    <div className={`${card} flex items-center p-1`}>
      <button type="button" data-action="undo" aria-label={t("hublive.bUndo")} title={`${t("hublive.bUndo")} (Ctrl+Z)`} disabled={!ctrl.history.canUndo} onClick={() => ctrl.undo()} className={`${chip} ${idle} disabled:opacity-35`}><BIcon name="undo" size={19} /></button>
      <button type="button" data-action="redo" aria-label={t("hublive.bRedo")} title={`${t("hublive.bRedo")} (Ctrl+Shift+Z)`} disabled={!ctrl.history.canRedo} onClick={() => ctrl.redo()} className={`${chip} ${idle} disabled:opacity-35`}><BIcon name="redo" size={19} /></button>
      <button type="button" data-action="snap" aria-pressed={ctrl.ui.snap} aria-label={t("hublive.bSnap")} title={t("hublive.bSnapTitle")} onClick={() => ctrl.setUi({ snap: !ctrl.ui.snap })} className={`${chip} ${ctrl.ui.snap ? on : idle}`}><BIcon name="snap" size={19} /></button>
    </div>
  );
}

export function ZoomButtons({ ctrl }: { ctrl: BoardController }) {
  const t = useT();
  useCtrl(ctrl);
  return (
    <div className={`${card} flex items-center p-1`}>
      <button type="button" aria-label={t("hublive.bZoomOut")} title={`${t("hublive.bZoomOut")} (−)`} onClick={() => ctrl.zoomBy(0.8)} className={`${chip} ${idle}`}><BIcon name="zoomOut" size={19} /></button>
      <button type="button" aria-label={t("hublive.bResetView")} title={`${t("hublive.bResetView")} (0)`} onClick={() => ctrl.resetView()} className={`${chip} ${idle} min-w-[52px] px-1 tabular-nums`} data-testid="board-zoom">{Math.round(ctrl.view.k * 100)}%</button>
      <button type="button" aria-label={t("hublive.bZoomIn")} title={`${t("hublive.bZoomIn")} (+)`} onClick={() => ctrl.zoomBy(1.25)} className={`${chip} ${idle}`}><BIcon name="zoomIn" size={19} /></button>
    </div>
  );
}

export function StudentsSwitchButton({ ctrl, attendees, onClick, open }: { ctrl: BoardController; attendees: { childId: string }[]; onClick: (e: React.MouseEvent<HTMLElement>) => void; open: boolean }) {
  const t = useT();
  useCtrl(ctrl);
  const perm = ctrl.state.perm;
  const n = perm.all ? attendees.length : perm.ids.filter((i) => attendees.some((a) => a.childId === i)).length;
  const onNow = perm.all || n > 0;
  return (
    <button type="button" data-pop-trigger data-testid="board-students-switch" aria-haspopup="dialog" aria-expanded={open} data-writers={n} onClick={onClick}
      title={onNow ? t("hublive.bWhoTitle") : t("hublive.bOnlyYouTitle")}
      className={`inline-flex min-h-[52px] items-center gap-1.5 rounded-2xl border px-3 text-[13px] font-extrabold shadow-[var(--shadow)] ${FOCUS} ${onNow ? "border-[var(--green-line)] bg-[var(--green-soft)] text-[var(--hub-green-ink)]" : "border-[var(--hub-warm-line)] bg-[var(--surface)] text-[var(--ink-2)] hover:border-[var(--brand)]"}`}>
      <BIcon name={onNow ? "users" : "lock"} size={18} />
      <span className="hidden @[1100px]:inline">{onNow ? (perm.all ? t("hublive.bEveryoneCanWrite") : t("hublive.bNCanWrite", { n })) : t("hublive.bSp_title")}</span>{onNow && <span className="@[1100px]:hidden text-[12px] tabular-nums">{perm.all ? t("hublive.bAll") : n}</span>}
    </button>
  );
}

/** Board ⇄ Student work / My workings. */
export function ViewSwitch({ view, onView, isTutor, badge }: { view: "board" | "work"; onView: (v: "board" | "work") => void; isTutor: boolean; badge?: string }) {
  const t = useT();
  const seg = (on: boolean) => `${chip} px-3.5 ${on ? "bg-[var(--brand)] text-white shadow-[var(--shadow-sm)]" : idle}`;
  return (
    <div role="tablist" aria-label={t("hublive.bBoardViews")} className={`${card} flex items-center gap-0.5 p-1`}>
      <button type="button" role="tab" aria-selected={view === "board"} data-view-tab="board" onClick={() => onView("board")} className={seg(view === "board")}><BIcon name="pen" size={16} />{t("hublive.bBoard")}</button>
      <button type="button" role="tab" aria-selected={view === "work"} data-view-tab="work" onClick={() => onView("work")} className={seg(view === "work")}>
        <BIcon name="pages" size={16} /><span className="hidden @[760px]:inline">{isTutor ? t("hublive.bStudentWork") : t("hublive.bMyWorkings")}</span><span className="@[760px]:hidden sr-only">{isTutor ? t("hublive.bStudentWork") : t("hublive.bMyWorkings")}</span>
        {badge && <span className={`rounded-full px-1.5 py-px text-[11px] font-extrabold ${view === "work" ? "bg-white/25 text-white" : "bg-[var(--brand)] text-white"}`}>{badge}</span>}
      </button>
    </div>
  );
}

// ── the ⋯ menu ──────────────────────────────────────────────────────────────
export function MoreMenu({ ctrl, close, actions }: {
  ctrl: BoardController; close: () => void;
  actions: { saveTemplate?: (name: string) => void; saveNotes: (scope: "page" | "all") => void; download: () => void; present: () => void; presenting: boolean; wide: boolean };
}) {
  const t = useT();
  useCtrl(ctrl);
  const [confirm, setConfirm] = useState<null | "clear" | "delete" | "tpl">(null);
  const [tplName, setTplName] = useState("");
  const item = (icon: BIconName, label: string, fn: () => void, extra = "", data?: string) => (
    <button type="button" role="menuitem" data-action={data} onClick={fn} className={`flex min-h-[44px] w-full items-center gap-2.5 rounded-xl px-2.5 text-start text-[13px] font-bold ${extra || "text-[var(--ink)] hover:bg-[var(--brand-soft)]"} ${FOCUS}`}><BIcon name={icon} size={18} />{label}</button>
  );
  return (
    <div role="menu" aria-label={t("hublive.bBoardMenu")} data-testid="board-menu" className={`${card} hub-pop w-[320px] max-w-full p-1.5`}>
      {confirm === "tpl" ? (
        <div role="dialog" aria-label={t("hublive.bSaveTplTitle")} className="p-2">
          <div className="text-[14px] font-extrabold text-[var(--ink)]">{t("hublive.bSaveTplTitle")}</div>
          <p className="m-0 mt-1 text-[12.5px] leading-snug text-[var(--ink-2)]"><Rich text={t("hublive.bSaveTplHelp")} /></p>
          <input autoFocus value={tplName} onChange={(e) => setTplName(e.target.value)} onKeyDown={(e) => e.stopPropagation()} maxLength={80} placeholder={t("hublive.bTplPh")} aria-label={t("hublive.bTplName")} className={`mt-2 min-h-[44px] w-full rounded-xl border border-[var(--hub-warm-line)] bg-[var(--surface)] px-3 text-[13.5px] ${FOCUS}`} />
          <div className="mt-2.5 flex gap-2">
            <button type="button" data-action="confirm-template" disabled={!tplName.trim()} onClick={() => { actions.saveTemplate?.(tplName.trim()); close(); }} className={`${chip} flex-1 bg-[var(--brand)] px-3 text-white disabled:opacity-50`}>{t("hublive.bSaveTpl")}</button>
            <button type="button" onClick={() => setConfirm(null)} className={`${chip} border border-[var(--hub-warm-line)] px-3 text-[var(--ink-2)]`}>{t("hublive.bCancel")}</button>
          </div>
        </div>
      ) : confirm ? (
        <div role="alertdialog" aria-label={confirm === "clear" ? t("hublive.bClearQ") : t("hublive.bDeleteQ")} className="p-2">
          <div className="text-[14px] font-extrabold text-[var(--ink)]">{confirm === "clear" ? t("hublive.bClearQ") : t("hublive.bDeleteQ")}</div>
          <p className="m-0 mt-1 text-[12.5px] leading-snug text-[var(--ink-2)]">{confirm === "clear" ? t("hublive.bClearBody") : t("hublive.bDeleteBody")}</p>
          <div className="mt-2.5 flex gap-2">
            <button type="button" data-action="confirm-clear" onClick={() => { if (confirm === "clear") ctrl.clearPage(); else ctrl.deletePage(); close(); }} className={`${chip} flex-1 bg-[var(--red)] px-3 text-white hover:brightness-110`}>{confirm === "clear" ? t("hublive.bClearPage") : t("hublive.bDeletePage")}</button>
            <button type="button" onClick={() => setConfirm(null)} className={`${chip} border border-[var(--hub-warm-line)] px-3 text-[var(--ink-2)]`}>{t("hublive.bKeepIt")}</button>
          </div>
        </div>
      ) : (
        <>
          {ctrl.isTutor && (
            <>
              <div className="px-2.5 pb-0.5 pt-1 text-[11px] font-extrabold uppercase tracking-[0.1em] text-[var(--ink-3)]">{t("hublive.bPageBg")}</div>
              <div role="group" aria-label={t("hublive.bPageBg")} className="grid grid-cols-2 gap-1 px-1 pb-1.5">
                {BACKGROUNDS.map((b) => (
                  <button key={b.kind} type="button" role="menuitemradio" aria-checked={ctrl.curPage.bg === b.kind} data-bg={b.kind} onClick={() => ctrl.setBackground(b.kind as BgKind)}
                    className={`flex min-h-[44px] items-center gap-1.5 rounded-xl border px-2 text-start text-[12px] font-bold ${FOCUS} ${ctrl.curPage.bg === b.kind ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand-strong)]" : "border-[var(--hub-warm-line)] text-[var(--ink)] hover:border-[var(--brand)]"}`}>
                    <BgThumb kind={b.kind} />{t("hublive.bBg_" + b.kind)}
                  </button>
                ))}
              </div>
              <div className="my-1 h-px bg-[var(--hub-warm-line)]" />
            </>
          )}
          {item("fit", t("hublive.bFit"), () => { ctrl.fitContent(); close(); })}
          {!actions.wide && <div className="flex gap-1 px-0.5"><button type="button" onClick={() => ctrl.zoomBy(0.8)} className={`${chip} flex-1 border border-[var(--hub-warm-line)] ${idle}`}><BIcon name="zoomOut" size={18} /></button><button type="button" onClick={() => ctrl.zoomBy(1.25)} className={`${chip} flex-1 border border-[var(--hub-warm-line)] ${idle}`}><BIcon name="zoomIn" size={18} /></button></div>}
          {ctrl.isTutor && (
            <>
              {item("present", actions.presenting ? t("hublive.bStopPresent") : t("hublive.bPresent"), () => { actions.present(); close(); }, "", "present-board")}
              <div className="my-1 h-px bg-[var(--hub-warm-line)]" />
              {actions.saveTemplate && item("pages", t("hublive.bSaveTplItem"), () => setConfirm("tpl"), "", "save-template")}
              {item("save", t("hublive.bSavePage"), () => { actions.saveNotes("page"); close(); }, "", "save-notes")}
              {ctrl.state.pages.length > 1 && item("pages", t("hublive.bSaveAll"), () => { actions.saveNotes("all"); close(); }, "", "save-notes-all")}
            </>
          )}
          {item("download", t("hublive.bDownload"), () => { actions.download(); close(); }, "", "download-png")}
          {ctrl.isTutor && (
            <>
              <div className="my-1 h-px bg-[var(--hub-warm-line)]" />
              {item("trash", t("hublive.bClearItem"), () => setConfirm("clear"), "text-[var(--red)] hover:bg-[var(--red-soft)]", "clear-page")}
              {ctrl.state.pages.length > 1 && item("close", t("hublive.bDeleteItem"), () => setConfirm("delete"), "text-[var(--red)] hover:bg-[var(--red-soft)]")}
            </>
          )}
        </>
      )}
    </div>
  );
}

/** A tiny picture of what each background looks like. */
function BgThumb({ kind }: { kind: BgKind }) {
  return (
    <svg width="26" height="20" viewBox="0 0 26 20" aria-hidden className="flex-none rounded-[5px] border border-[var(--hub-warm-line)] bg-white">
      <g stroke="var(--brand-line)" strokeWidth="1" fill="none">
        {kind === "lined" && <path d="M0 5h26M0 10h26M0 15h26" />}
        {kind === "squared" && <path d="M0 5h26M0 10h26M0 15h26M6 0v20M13 0v20M20 0v20" />}
        {kind === "graph" && <><path d="M0 5h26M0 15h26M6 0v20M20 0v20" /><path d="M13 1v18M2 10h22" stroke="var(--ink-3)" /></>}
        {kind === "handwriting" && <><path d="M0 6h26M0 16h26" /><path d="M0 11h26" strokeDasharray="2 2" /></>}
        {kind === "tianzige" && <><path d="M2 2h22v16H2zM13 2v16M2 10h22" /><path d="M2 2l22 16M24 2 2 18" strokeDasharray="2 2" /></>}
        {kind === "twocol" && <><path d="M13 0v20" stroke="var(--ink-3)" /><path d="M0 6h26M0 12h26M0 18h26" /></>}
        {kind === "numberline" && <><path d="M2 10h22" stroke="var(--ink-3)" /><path d="M5 7v6M9 8v4M13 7v6M17 8v4M21 7v6" stroke="var(--ink-3)" /></>}
        {kind === "storymap" && <><path d="M2 2h22v16H2z" stroke="var(--ink-3)" /><path d="M2 8h22M2 14h22M2 5h8M10 2v3" /></>}
        {kind === "diagram" && <><path d="M8 4h10v12H8z" strokeDasharray="2 2" stroke="var(--ink-3)" /><path d="M1 7h4M1 13h4M5 7h3M5 13h3M18 7h3M18 13h3M21 7h4M21 13h4" /></>}
        {kind === "vocab" && <><path d="M2 2h22v16H2z" stroke="var(--ink-3)" /><path d="M2 6h22M2 10h22M2 14h22M8 2v16M16 2v16" /></>}
      </g>
      {(kind === "isometric" || kind === "dotgrid") && <g fill="var(--brand-line)">{[4, 10, 16, 22].map((x) => [4, 10, 16].map((y, j) => <circle key={`${x}${y}`} cx={x + (j % 2 ? 3 : 0)} cy={y} r="1.1" />))}</g>}
    </svg>
  );
}
