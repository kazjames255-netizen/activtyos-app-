import type { ReactNode } from "react";
import { DIAGRAM_DATA, type DiagramDef } from "./diagramData";

// Original schematic artwork for the label-the-diagram tool. Every drawing is a 400 x 300 viewBox; the numbered markers are drawn by the
// tool on top, at the hotspots in diagramData.ts (keep the two in step). Soft washes of colour over the surface token; outlines use --ink-2.

export * from "./diagramData";

const G = "#3f9d5b", R = "#d9534f", B = "#3b82c4", A = "#e0a030", PU = "#8b5cf6", BR = "#a06a3c", PK = "#e57f9a";
const wash = (c: string, pct = 22) => `color-mix(in srgb, ${c} ${pct}%, var(--surface))`;
const INK = "var(--ink-2)";
const line = { stroke: INK, strokeWidth: 2, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

function AnimalCell() {
  return (
    <g>
      <ellipse cx={200} cy={150} rx={170} ry={120} fill={wash(A, 14)} stroke={PK} strokeWidth={4} />
      <circle cx={215} cy={140} r={45} fill={wash(PU, 30)} stroke={INK} strokeWidth={2} />
      <circle cx={222} cy={146} r={13} fill={wash(PU, 60)} stroke={INK} strokeWidth={1.5} />
      {[[110, 110, -20], [300, 95, 25]].map(([x, y, r]) => (
        <g key={`${x}`} transform={`rotate(${r} ${x} ${y})`}>
          <ellipse cx={x} cy={y} rx={24} ry={12} fill={wash(R, 30)} stroke={INK} strokeWidth={1.8} />
          <path d={`M${x! - 15} ${y} q5 -8 10 0 t10 0 t10 0`} {...line} strokeWidth={1.4} />
        </g>
      ))}
      {[[300, 200], [322, 185], [292, 222], [332, 215], [130, 190]].map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r={4.5} fill={INK} />)}
    </g>
  );
}

function PlantCell() {
  return (
    <g>
      <rect x={40} y={30} width={320} height={240} rx={14} fill={wash(A, 10)} stroke={G} strokeWidth={10} />
      <rect x={52} y={42} width={296} height={216} rx={10} fill={wash(A, 14)} stroke={PK} strokeWidth={2.5} />
      <ellipse cx={250} cy={150} rx={85} ry={80} fill={wash(B, 24)} stroke={INK} strokeWidth={1.8} />
      <circle cx={110} cy={150} r={30} fill={wash(PU, 30)} stroke={INK} strokeWidth={2} />
      <circle cx={116} cy={155} r={9} fill={wash(PU, 60)} stroke={INK} strokeWidth={1.2} />
      {[[110, 72], [110, 232], [310, 80]].map(([x, y]) => (
        <g key={`${x}-${y}`}><ellipse cx={x} cy={y} rx={22} ry={11} fill={wash(G, 60)} stroke={INK} strokeWidth={1.6} /><path d={`M${x! - 12} ${y} h24`} {...line} strokeWidth={1} /></g>
      ))}
    </g>
  );
}

function BacterialCell() {
  return (
    <g>
      <rect x={30} y={70} width={280} height={160} rx={70} fill={wash(A, 14)} stroke={A} strokeWidth={2.5} />
      <rect x={44} y={84} width={252} height={132} rx={56} fill="none" stroke={G} strokeWidth={4} />
      <rect x={58} y={98} width={224} height={104} rx={44} fill={wash(A, 10)} stroke={PK} strokeWidth={2.5} />
      <ellipse cx={170} cy={150} rx={45} ry={22} fill="none" stroke={PU} strokeWidth={3.5} />
      <path d="M140 140 q10 -10 20 0 t20 0 t20 0" {...line} stroke={PU} strokeWidth={2} />
      <circle cx={250} cy={170} r={11} fill="none" stroke={PU} strokeWidth={3} />
      <path d="M310 150 q20 -25 40 0 t40 0" {...line} stroke={A} strokeWidth={4.5} />
    </g>
  );
}

function Flower() {
  return (
    <g>
      <line x1={200} y1={222} x2={200} y2={296} stroke={G} strokeWidth={9} strokeLinecap="round" />
      <ellipse cx={100} cy={140} rx={32} ry={80} fill={wash(PK, 55)} stroke={INK} strokeWidth={1.8} />
      <ellipse cx={300} cy={140} rx={32} ry={80} fill={wash(PK, 55)} stroke={INK} strokeWidth={1.8} />
      <ellipse cx={200} cy={222} rx={26} ry={12} fill={wash(G, 45)} stroke={INK} strokeWidth={1.6} />
      <ellipse cx={162} cy={232} rx={30} ry={9} transform="rotate(-25 162 232)" fill={wash(G, 60)} stroke={INK} strokeWidth={1.6} />
      <ellipse cx={238} cy={232} rx={30} ry={9} transform="rotate(25 238 232)" fill={wash(G, 60)} stroke={INK} strokeWidth={1.6} />
      <line x1={182} y1={196} x2={152} y2={116} stroke={INK} strokeWidth={3.5} strokeLinecap="round" />
      <line x1={218} y1={196} x2={248} y2={116} stroke={INK} strokeWidth={3.5} strokeLinecap="round" />
      <ellipse cx={150} cy={102} rx={10} ry={16} fill={wash(A, 70)} stroke={INK} strokeWidth={1.8} />
      <ellipse cx={250} cy={102} rx={10} ry={16} fill={wash(A, 70)} stroke={INK} strokeWidth={1.8} />
      <line x1={200} y1={150} x2={200} y2={92} stroke={G} strokeWidth={6} strokeLinecap="round" />
      <ellipse cx={200} cy={182} rx={28} ry={34} fill={wash(G, 45)} stroke={INK} strokeWidth={2} />
      <circle cx={192} cy={188} r={5} fill={wash(A, 60)} stroke={INK} strokeWidth={1.2} /><circle cx={208} cy={188} r={5} fill={wash(A, 60)} stroke={INK} strokeWidth={1.2} />
      <ellipse cx={200} cy={84} rx={14} ry={9} fill={wash(A, 80)} stroke={INK} strokeWidth={1.8} />
    </g>
  );
}

function Eye() {
  return (
    <g>
      <circle cx={230} cy={150} r={100} fill={wash(B, 10)} stroke={INK} strokeWidth={5} />
      <path d="M282.8 74.6 A92 92 0 0 1 282.8 225.4" {...line} stroke={R} strokeWidth={5} />
      <line x1={326} y1={175} x2={385} y2={192} stroke={A} strokeWidth={13} strokeLinecap="round" />
      <path d="M155 95 Q100 150 155 205 Z" fill={wash(B, 30)} stroke={B} strokeWidth={3} strokeLinejoin="round" />
      <ellipse cx={190} cy={150} rx={14} ry={32} fill={wash(B, 45)} stroke={INK} strokeWidth={2} />
      {[[200, 100, 187, 120], [200, 200, 187, 180]].map(([a, b, c, d]) => <line key={`${b}`} x1={a} y1={b} x2={c} y2={d} stroke={INK} strokeWidth={1.6} strokeDasharray="3 2" />)}
      <ellipse cx={205} cy={92} rx={16} ry={9} fill={wash(R, 40)} stroke={INK} strokeWidth={1.6} />
      <ellipse cx={205} cy={208} rx={16} ry={9} fill={wash(R, 40)} stroke={INK} strokeWidth={1.6} />
      <line x1={165} y1={100} x2={165} y2={135} stroke={BR} strokeWidth={9} strokeLinecap="round" />
      <line x1={165} y1={165} x2={165} y2={200} stroke={BR} strokeWidth={9} strokeLinecap="round" />
    </g>
  );
}

function Heart() {
  const blue = wash(B, 40), red = wash(R, 40);
  return (
    <g>
      <rect x={112} y={20} width={16} height={82} fill={blue} stroke={INK} strokeWidth={1.8} />
      <rect x={181} y={50} width={14} height={120} fill={blue} stroke={INK} strokeWidth={1.8} />
      <path d="M212 175 V70 Q212 36 250 36 H292" fill="none" stroke={INK} strokeWidth={18} strokeLinecap="butt" />
      <path d="M212 175 V70 Q212 36 250 36 H292" fill="none" stroke={red} strokeWidth={14} strokeLinecap="butt" />
      <rect x={300} y={123} width={50} height={14} fill={red} stroke={INK} strokeWidth={1.8} />
      <rect x={100} y={100} width={80} height={65} rx={22} fill={blue} stroke={INK} strokeWidth={2.2} />
      <rect x={220} y={100} width={80} height={65} rx={22} fill={red} stroke={INK} strokeWidth={2.2} />
      <rect x={100} y={165} width={95} height={90} rx={26} fill={blue} stroke={INK} strokeWidth={2.2} />
      <rect x={205} y={165} width={95} height={95} rx={28} fill={red} stroke={INK} strokeWidth={2.2} />
      <path d="M124 165 L140 178 L156 165" {...line} strokeWidth={4} stroke="var(--ink)" />
      <path d="M244 165 L260 178 L276 165" {...line} strokeWidth={4} stroke="var(--ink)" />
    </g>
  );
}

function Digestive() {
  return (
    <g>
      <ellipse cx={145} cy={118} rx={48} ry={26} fill={wash(BR, 45)} stroke={INK} strokeWidth={2} />
      <ellipse cx={210} cy={162} rx={38} ry={9} fill={wash(A, 45)} stroke={INK} strokeWidth={1.8} />
      <path d="M266 262 V184 H134 V262" fill="none" stroke={INK} strokeWidth={16} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M266 262 V184 H134 V262" fill="none" stroke={wash(PU, 40)} strokeWidth={12} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M134 262 V280 Q134 288 142 288 H200" fill="none" stroke={INK} strokeWidth={14} strokeLinecap="round" />
      <path d="M134 262 V280 Q134 288 142 288 H200" fill="none" stroke={wash(BR, 55)} strokeWidth={10} strokeLinecap="round" />
      <path d="M165 200 H235 Q250 200 250 210 Q250 220 235 220 H165 Q150 220 150 230 Q150 240 165 240 H235" fill="none" stroke={INK} strokeWidth={11} strokeLinecap="round" />
      <path d="M165 200 H235 Q250 200 250 210 Q250 220 235 220 H165 Q150 220 150 230 Q150 240 165 240 H235" fill="none" stroke={wash(PK, 60)} strokeWidth={7} strokeLinecap="round" />
      <line x1={200} y1={34} x2={228} y2={114} stroke={INK} strokeWidth={14} strokeLinecap="round" />
      <line x1={200} y1={34} x2={228} y2={114} stroke={wash(R, 40)} strokeWidth={10} strokeLinecap="round" />
      <ellipse cx={245} cy={128} rx={30} ry={22} transform="rotate(20 245 128)" fill={wash(R, 40)} stroke={INK} strokeWidth={2} />
      <ellipse cx={200} cy={24} rx={22} ry={10} fill={wash(R, 55)} stroke={INK} strokeWidth={2} />
      <path d="M182 24 Q200 30 218 24" {...line} strokeWidth={1.6} />
    </g>
  );
}

function Leaf() {
  return (
    <g>
      <rect x={20} y={40} width={360} height={8} fill={wash(A, 65)} stroke={INK} strokeWidth={1.2} />
      {Array.from({ length: 10 }, (_, i) => <rect key={`u${i}`} x={22 + i * 36} y={48} width={32} height={30} rx={3} fill={wash(G, 14)} stroke={INK} strokeWidth={1.4} />)}
      {Array.from({ length: 13 }, (_, i) => (
        <g key={`p${i}`}>
          <rect x={22 + i * 28} y={82} width={24} height={58} rx={8} fill={wash(G, 40)} stroke={INK} strokeWidth={1.4} />
          <circle cx={34 + i * 28} cy={97} r={3.5} fill={G} /><circle cx={34 + i * 28} cy={124} r={3.5} fill={G} />
        </g>
      ))}
      {[[55, 172, 22, 18], [120, 178, 24, 16], [180, 170, 22, 16], [165, 196, 18, 10], [240, 175, 22, 18], [232, 198, 16, 8], [360, 178, 20, 16], [85, 198, 16, 8]].map(([x, y, rx, ry]) => (
        <ellipse key={`${x}-${y}`} cx={x} cy={y} rx={rx} ry={ry} fill={wash(G, 30)} stroke={INK} strokeWidth={1.4} />
      ))}
      <circle cx={320} cy={172} r={22} fill={wash(A, 25)} stroke={INK} strokeWidth={1.8} />
      <circle cx={311} cy={172} r={7} fill={wash(B, 55)} stroke={INK} strokeWidth={1.2} /><circle cx={330} cy={172} r={7} fill={wash(A, 80)} stroke={INK} strokeWidth={1.2} />
      {Array.from({ length: 9 }, (_, i) => i).filter((i) => i !== 4).map((i) => <rect key={`l${i}`} x={22 + i * 40} y={210} width={36} height={30} rx={3} fill={wash(G, 14)} stroke={INK} strokeWidth={1.4} />)}
      <ellipse cx={186} cy={225} rx={9} ry={14} fill={wash(G, 65)} stroke={INK} strokeWidth={1.6} />
      <ellipse cx={214} cy={225} rx={9} ry={14} fill={wash(G, 65)} stroke={INK} strokeWidth={1.6} />
    </g>
  );
}

function Respiratory() {
  return (
    <g>
      <ellipse cx={135} cy={170} rx={62} ry={90} fill={wash(PK, 40)} stroke={INK} strokeWidth={2} />
      <ellipse cx={265} cy={170} rx={62} ry={90} fill={wash(PK, 40)} stroke={INK} strokeWidth={2} />
      <path d="M60 290 Q200 240 340 290" fill="none" stroke={BR} strokeWidth={9} strokeLinecap="round" />
      {[[200, 125, 150, 175], [200, 125, 250, 175]].map(([a, b, c, d]) => <line key={`${c}`} x1={a} y1={b} x2={c} y2={d} stroke={INK} strokeWidth={8} strokeLinecap="round" />)}
      <rect x={193} y={30} width={14} height={100} rx={3} fill={wash(B, 40)} stroke={INK} strokeWidth={1.8} />
      {[[150, 175, 118, 150], [150, 175, 120, 208], [250, 175, 282, 150], [250, 175, 280, 208]].map(([a, b, c, d]) => <line key={`${a}${c}${d}`} x1={a} y1={b} x2={c} y2={d} stroke={INK} strokeWidth={3} strokeLinecap="round" />)}
      {[[110, 218], [280, 218]].map(([cx, cy]) => [[0, 0], [-14, -8], [10, -12], [-4, 14], [14, 8]].map(([dx, dy]) => (
        <circle key={`${cx}${dx}${dy}`} cx={cx! + dx!} cy={cy! + dy!} r={8} fill={wash(R, 45)} stroke={INK} strokeWidth={1.4} />
      )))}
    </g>
  );
}

function Circuit() {
  const w = { ...line, strokeWidth: 3 };
  return (
    <g>
      <path d="M60 140 V60 H150 M190 60 H250 M290 60 H340 V132 M340 168 V240 H215 M185 240 H60 V152" {...w} />
      <path d="M340 110 H375 V136 M375 164 V190 H340" {...w} />
      <circle cx={340} cy={110} r={3.5} fill={INK} /><circle cx={340} cy={190} r={3.5} fill={INK} />
      <line x1={48} y1={140} x2={72} y2={140} stroke={INK} strokeWidth={3} /><line x1={53} y1={152} x2={67} y2={152} stroke={INK} strokeWidth={6} />
      <line x1={150} y1={60} x2={185} y2={42} {...w} /><circle cx={150} cy={60} r={3.5} fill={INK} /><circle cx={190} cy={60} r={3.5} fill={INK} />
      <rect x={250} y={50} width={40} height={20} fill={wash(A, 30)} stroke={INK} strokeWidth={2.2} />
      <circle cx={340} cy={150} r={18} fill={wash(A, 45)} stroke={INK} strokeWidth={2.4} /><path d="M327 137 L353 163 M353 137 L327 163" {...line} strokeWidth={2} />
      <circle cx={200} cy={240} r={15} fill={wash(G, 22)} stroke={INK} strokeWidth={2.2} /><text x={200} y={246} textAnchor="middle" fontSize={17} fontWeight={700} fill="var(--ink)">A</text>
      <circle cx={375} cy={150} r={14} fill={wash(B, 22)} stroke={INK} strokeWidth={2.2} /><text x={375} y={156} textAnchor="middle" fontSize={17} fontWeight={700} fill="var(--ink)">V</text>
    </g>
  );
}

const ARTS: Record<string, () => ReactNode> = {
  "animal-cell": AnimalCell, "plant-cell": PlantCell, "bacterial-cell": BacterialCell, flower: Flower, eye: Eye, heart: Heart,
  digestive: Digestive, leaf: Leaf, respiratory: Respiratory, circuit: Circuit,
};

export interface Diagram extends DiagramDef { Art: () => ReactNode }
export const DIAGRAMS: Diagram[] = DIAGRAM_DATA.map((d) => ({ ...d, Art: ARTS[d.id] ?? (() => null) }));
