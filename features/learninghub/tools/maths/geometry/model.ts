// Geometry board data model. World units = millimetres; the paper is a rectangle at (0,0)–(PAPER_W,PAPER_H).
// Everything here is plain JSON so a tool's state can be autosaved, synced and marked later from the stored copy alone.
import type { Pt } from "../../engine/geometry";

export const PAPER_W = 210;
export const PAPER_H = 148;

export type PaperKind = "plain" | "squared" | "dotted" | "isometric" | "graph" | "polar";
export const PAPERS: { id: PaperKind; label: string }[] = [
  { id: "plain", label: "Plain" }, { id: "squared", label: "Squared (5 mm)" }, { id: "dotted", label: "Dotted" },
  { id: "isometric", label: "Isometric" }, { id: "graph", label: "Graph (mm)" }, { id: "polar", label: "Polar" },
];

export type InstrKind = "ruler15" | "ruler30" | "protractor180" | "protractor360" | "compass" | "setsquare45" | "setsquare3060" | "straightedge";
export const INSTR_LABEL: Record<InstrKind, string> = {
  ruler15: "Ruler 15 cm", ruler30: "Ruler 30 cm", protractor180: "Protractor 180°", protractor360: "Protractor 360°",
  compass: "Compasses", setsquare45: "Set square 45°", setsquare3060: "Set square 30°/60°", straightedge: "Straight edge",
};

export interface Instrument {
  id: string;
  kind: InstrKind;
  /** Origin: ruler/straight edge = start of the drawing edge; set square = the right-angle corner; protractor = its centre; compass = the pivot (needle). */
  x: number;
  y: number;
  /** Direction of the instrument's baseline / drawing edge, degrees anticlockwise on screen. */
  rot: number;
  /** Compass only: radius (mm) and the direction (degrees) the pencil leg points. */
  r?: number;
  pen?: number;
}

export type Mark =
  | { id: string; k: "pt"; p: Pt; label?: string; given?: boolean }
  | { id: string; k: "seg"; a: Pt; b: Pt; ruled?: boolean; given?: boolean; dashed?: boolean }
  /** Arc of a circle centred c, sweeping ANTICLOCKWISE on screen from a0 to a1 (a1 = a0 + 360 is a full circle). */
  | { id: string; k: "arc"; c: Pt; r: number; a0: number; a1: number; given?: boolean }
  | { id: string; k: "free"; pts: Pt[] };

export interface GeoState {
  paper: PaperKind;
  instruments: Instrument[];
  marks: Mark[];
}
export const GEO_SCHEMA_VERSION = 1;
export const GEO_TOOL_ID = "maths.geometry";

/** How far a check may be out. Tenant settings override these (default ±2 mm / ±2°). */
export interface Tol { mm: number; deg: number }
export const DEFAULT_TOL: Tol = { mm: 2, deg: 2 };

let counter = 0;
/** A fresh mark / instrument id (unique enough within one board; never used for security). */
export const uid = (p = "m") => `${p}${Date.now().toString(36)}${(counter++).toString(36)}`;

export const initialGeoState = (): GeoState => ({ paper: "plain", instruments: [], marks: [] });
