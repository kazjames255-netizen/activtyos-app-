"use client";

// Course "header style" — a decorative banner shown at the top of a course.
// 20 selectable styles, every one drawn from the chosen palette (the base is the
// palette gradient/accent and all decoration is white-alpha + the palette's
// second accent), so switching palette recolours the banner automatically.
import type { ReactNode } from "react";
import type { CoursePalette } from "./courseTheme";

const w = (a: number) => `rgba(255,255,255,${a})`;
const range = (n: number) => Array.from({ length: n }, (_, i) => i);

export interface BannerStyle { id: string; name: string; base: (p: CoursePalette) => string; deco: (p: CoursePalette) => ReactNode }

export const BANNER_STYLES: BannerStyle[] = [
  { id: "clean", name: "Clean", base: (p) => p.grad, deco: () => (<><circle cx={1060} cy={40} r={150} fill={w(0.07)} /><circle cx={1180} cy={250} r={70} fill={w(0.05)} /></>) },
  { id: "blobs", name: "Soft blobs", base: (p) => p.grad, deco: () => (<><circle cx={980} cy={30} r={120} fill={w(0.13)} /><circle cx={1140} cy={170} r={95} fill={w(0.1)} /><circle cx={1010} cy={215} r={16} fill={w(0.2)} /></>) },
  { id: "bubbles", name: "Bubbles", base: (p) => p.grad, deco: () => (<>{[[900, 60, 70, 0.1], [1050, 40, 40, 0.14], [1150, 120, 90, 0.08], [980, 190, 30, 0.16], [1120, 235, 55, 0.1], [860, 205, 22, 0.18]].map(([x, y, r, a], i) => <circle key={i} cx={x} cy={y} r={r} fill={w(a)} />)}</>) },
  { id: "arcs", name: "Arcs", base: (p) => p.grad, deco: () => (<>{[70, 140, 210, 280].map((r) => <circle key={r} cx={1200} cy={300} r={r} fill="none" stroke={w(0.11)} strokeWidth={12} />)}</>) },
  { id: "waves", name: "Waves", base: (p) => `linear-gradient(180deg, ${p.accent}, ${p.accent2})`, deco: () => (<><path d="M0,205 C200,165 400,245 600,205 S1000,165 1200,205 L1200,300 L0,300 Z" fill={w(0.08)} /><path d="M0,245 C220,215 430,285 640,245 S1030,215 1200,245 L1200,300 L0,300 Z" fill={w(0.13)} /></>) },
  { id: "dots", name: "Polka dots", base: (p) => p.grad, deco: () => (<>{range(9).flatMap((i) => range(3).map((j) => <circle key={`${i}-${j}`} cx={80 + i * 140} cy={55 + j * 95} r={8} fill={w(0.12)} />))}</>) },
  { id: "stripes", name: "Diagonal stripes", base: (p) => p.accent, deco: () => (<g transform="rotate(20 600 150)">{range(16).map((i) => <rect key={i} x={-200 + i * 130} y={-160} width={48} height={620} fill={w(0.06)} />)}</g>) },
  { id: "rings", name: "Concentric rings", base: (p) => `radial-gradient(circle at 75% 40%, ${p.accent2}, ${p.accent})`, deco: () => (<>{[40, 84, 128, 172, 216].map((r) => <circle key={r} cx={1030} cy={150} r={r} fill="none" stroke={w(0.1)} strokeWidth={8} />)}</>) },
  { id: "confetti", name: "Confetti", base: (p) => p.grad, deco: () => (<>{[[880, 60, 15], [960, 130, -20], [1050, 50, 35], [1120, 150, 10], [1000, 210, -30], [900, 190, 25], [1160, 90, -15], [820, 120, 40]].map(([x, y, r], i) => i % 2 ? <circle key={i} cx={x} cy={y} r={9} fill={w(0.16)} /> : <rect key={i} x={x} y={y} width={20} height={20} rx={4} fill={w(0.14)} transform={`rotate(${r} ${x} ${y})`} />)}</>) },
  { id: "triangles", name: "Geometric", base: (p) => p.grad, deco: (p) => (<><polygon points="1200,0 1200,180 1000,0" fill={w(0.08)} /><polygon points="1200,300 1200,120 980,300" fill={p.accent2} opacity={0.35} /><polygon points="900,300 1040,300 970,190" fill={w(0.1)} /></>) },
  { id: "bokeh", name: "Bokeh", base: (p) => `radial-gradient(circle at 70% 30%, ${p.accent2}, ${p.accent})`, deco: () => (<>{[[920, 80, 90, 0.08], [1080, 60, 55, 0.12], [1150, 180, 110, 0.06], [980, 200, 45, 0.14], [860, 150, 30, 0.16]].map(([x, y, r, a], i) => <circle key={i} cx={x} cy={y} r={r} fill={w(a)} />)}</>) },
  { id: "grid", name: "Line grid", base: (p) => p.accent, deco: () => (<>{range(13).map((i) => <line key={`v${i}`} x1={i * 100} y1={0} x2={i * 100} y2={300} stroke={w(0.06)} strokeWidth={2} />)}{range(4).map((j) => <line key={`h${j}`} x1={0} y1={j * 100} x2={1200} y2={j * 100} stroke={w(0.06)} strokeWidth={2} />)}</>) },
  { id: "corner", name: "Corner glow", base: (p) => p.grad, deco: (p) => (<><circle cx={-40} cy={-40} r={260} fill={w(0.1)} /><circle cx={60} cy={30} r={150} fill={p.accent2} opacity={0.3} /></>) },
  { id: "zigzag", name: "Zigzag", base: (p) => p.grad, deco: () => (<path d={"M-20,250 " + range(22).map((i) => `L${i * 60},${i % 2 ? 250 : 215}`).join(" ")} fill="none" stroke={w(0.14)} strokeWidth={8} strokeLinejoin="round" />) },
  { id: "sunburst", name: "Sunburst", base: (p) => `radial-gradient(circle at 90% 10%, ${p.accent2}, ${p.accent})`, deco: () => (<g>{range(11).map((i) => { const a = (i / 11) * 1.6 - 0.05; return <polygon key={i} points={`1200,0 ${1200 - Math.cos(a) * 1400},${Math.sin(a) * 1400} ${1200 - Math.cos(a + 0.05) * 1400},${Math.sin(a + 0.05) * 1400}`} fill={w(i % 2 ? 0.05 : 0.09)} />; })}</g>) },
  { id: "topography", name: "Topography", base: (p) => p.accent, deco: () => (<>{range(6).map((i) => <ellipse key={i} cx={300} cy={330} rx={220 + i * 130} ry={120 + i * 70} fill="none" stroke={w(0.07)} strokeWidth={6} />)}</>) },
  { id: "sprinkle", name: "Sprinkles", base: (p) => p.grad, deco: () => (<g stroke={w(0.16)} strokeWidth={4} strokeLinecap="round">{[[860, 70], [950, 130], [1040, 60], [1130, 120], [1000, 200], [900, 210], [1170, 190], [820, 150], [1080, 240]].map(([x, y], i) => <g key={i} transform={`rotate(${(i * 40) % 360} ${x} ${y})`}><line x1={x - 12} y1={y} x2={x + 12} y2={y} /><line x1={x} y1={y - 12} x2={x} y2={y + 12} /></g>)}</g>) },
  { id: "ribbon", name: "Ribbon", base: (p) => p.grad, deco: (p) => (<><rect x={-120} y={110} width={1500} height={78} fill={w(0.1)} transform="rotate(-8 600 150)" /><rect x={-120} y={170} width={1500} height={34} fill={p.accent2} opacity={0.4} transform="rotate(-8 600 150)" /></>) },
  { id: "spotlight", name: "Spotlight", base: (p) => p.accent, deco: () => (<><defs><radialGradient id="aos-spot" cx="78%" cy="28%" r="60%"><stop offset="0%" stopColor={w(0.28)} /><stop offset="100%" stopColor={w(0)} /></radialGradient></defs><rect x={0} y={0} width={1200} height={300} fill="url(#aos-spot)" /></>) },
  { id: "halftone", name: "Halftone", base: (p) => p.accent, deco: () => (<>{range(9).flatMap((i) => range(3).map((j) => <circle key={`${i}-${j}`} cx={760 + i * 55} cy={60 + j * 95} r={3 + i * 1.6} fill={w(0.14)} />))}</>) },
];

export const bannerStyleOf = (id?: string): BannerStyle => BANNER_STYLES.find((s) => s.id === id) ?? BANNER_STYLES[0];

export function CourseBanner({ pal, styleId, title, subtitle, logo, pills, className, contentClassName }: {
  pal: CoursePalette; styleId?: string; title?: ReactNode; subtitle?: ReactNode; logo?: string; pills?: ReactNode; className?: string; contentClassName?: string;
}) {
  const st = bannerStyleOf(styleId);
  const hasContent = title || subtitle || logo || pills;
  return (
    <div className={"relative overflow-hidden " + (className ?? "")} style={{ background: st.base(pal) }}>
      <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1200 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true">{st.deco(pal)}</svg>
      {hasContent && (
        <div className={"relative " + (contentClassName ?? "px-6 py-7")}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {logo && <img src={logo} alt="" className="mb-3 h-9 w-auto rounded bg-white/90 object-contain px-1.5 py-0.5" />}
          {subtitle && <div className="mb-1 text-[11px] font-extrabold uppercase tracking-[0.12em] text-white/85">{subtitle}</div>}
          {title && <div className="text-[24px] font-extrabold leading-tight text-white" style={{ textWrap: "balance" } as React.CSSProperties}>{title}</div>}
          {pills}
        </div>
      )}
    </div>
  );
}
