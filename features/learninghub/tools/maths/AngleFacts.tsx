"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui";
import { useT } from "@/lib/i18n/provider";
import { FOCUS } from "../../kit";
import { useBareTool } from "../bareContext";
import { angleOf, factsFrom, REGIONS, relation, type Reason, type Region } from "./angleFactsLogic";
import { makeRng, newSeed } from "../engine/rng";
import type { ToolProps } from "../types";
import { angleAt, dist, dirOf, round, type Pt } from "../engine/geometry";

// Angle facts (plan M-09): parallel lines and a triangle, with the REASON for every angle — the part exams give the marks for.

const POS_DIR = [0, 1, 2, 3]; // NE NW SW SE
const REASONS: Reason[] = ["vertically opposite", "angles on a straight line", "corresponding", "alternate", "co-interior (allied)"];
const REASON_KEY: Record<string, string> = { "vertically opposite": "a_r_vo", "angles on a straight line": "a_r_sl", corresponding: "a_r_corr", alternate: "a_r_alt", "co-interior (allied)": "a_r_co" };

function Parallel({ assess }: { assess: boolean }) {
  const t = useT();
  const why = (r: string | null) => (r && REASON_KEY[r] ? t(`hubtoolsa.${REASON_KEY[r]}`) : r ?? "");
  const bare = useBareTool();
  const [theta, setTheta] = useState(58);
  const [sel, setSel] = useState<Region>("a");
  const [values, setValues] = useState(!assess && !bare);
  useEffect(() => { setValues(!assess && !bare); }, [bare, assess]); // "Just the tool": letters only until the strip's switch is used
  const P: Pt = [100, 42], sin = Math.sin((theta * Math.PI) / 180), cos = Math.cos((theta * Math.PI) / 180);
  const Q: Pt = [P[0] - (38 / sin) * cos, 80];
  const ends = (c: Pt, len: number): [Pt, Pt] => [[c[0] + len * cos, c[1] - len * sin], [c[0] - len * cos, c[1] + len * sin]];
  const [t1, t2] = [ends(P, 46)[0], ends(Q, 46)[1]];
  const at = (r: Region): Pt => {
    const i = REGIONS.indexOf(r), c = i < 4 ? P : Q, k = POS_DIR[i % 4]!, half = theta / 2;
    const dir = k === 0 ? half : k === 1 ? 90 + half : k === 2 ? 180 + half : 270 + half;
    return [c[0] + 15 * Math.cos((dir * Math.PI) / 180), c[1] - 15 * Math.sin((dir * Math.PI) / 180) + 1.5];
  };
  const facts = useMemo(() => factsFrom(sel, theta), [sel, theta]);
  // practise
  const [q, setQ] = useState<{ theta: number; from: Region; to: Region } | null>(null);
  const [ans, setAns] = useState(""), [reason, setReason] = useState<string>(""), [fb, setFb] = useState<string | null>(null);
  const newQ = () => {
    const rng = makeRng(newSeed()), th = rng.pick([35, 40, 48, 55, 62, 68, 72, 110, 118, 125, 132, 140]);
    const from = rng.pick(REGIONS);
    const to = rng.pick(factsFrom(from, th).map((f) => f.region));
    setQ({ theta: th, from, to }); setTheta(th); setSel(from); setAns(""); setReason(""); setFb(null); setValues(false);
  };
  const check = () => {
    if (!q) return;
    const want = angleOf(q.to, q.theta), rel = relation(q.from, q.to, q.theta);
    const okNum = Math.abs(Number(ans) - want) < 0.5, okWhy = reason === rel.reason;
    setFb(t("hubtoolsa.a_feedback", { a: okNum ? "✓" : "✗", b: okWhy ? "✓" : "✗", to: q.to, want, reason: why(rel.reason) }));
  };
  const lineStyle = { stroke: "var(--ink)", strokeWidth: 0.7 };
  return (
    <div className="grid gap-3">
      {q && <div data-tool-chrome role="region" aria-label={t("hubtoolsa.c_question")} className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-3">
        <p className="m-0 text-[15px] font-extrabold text-[var(--ink)]">{t("hubtoolsa.a_question", { from: q.from, deg: angleOf(q.from, q.theta), to: q.to })}</p>
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <label className="grid gap-1 text-[11.5px] font-bold text-[var(--ink-2)]">{t("hubtoolsa.a_angleLabel", { to: q.to })}<input inputMode="decimal" value={ans} onChange={(e) => setAns(e.target.value)} className={`min-h-[44px] w-24 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2 text-[14px] font-bold text-[var(--ink)] ${FOCUS}`} /></label>
          <label className="grid gap-1 text-[11.5px] font-bold text-[var(--ink-2)]">{t("hubtoolsa.a_reason")}<select value={reason} onChange={(e) => setReason(e.target.value)} className={`min-h-[44px] rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2 text-[13px] font-semibold text-[var(--ink)] ${FOCUS}`}><option value="">{t("hubtoolsa.a_choose")}</option>{REASONS.map((r) => <option key={r} value={r}>{why(r)}</option>)}</select></label>
          <Button variant="primary" onClick={check}>{t("hubtoolsa.c_check")}</Button><Button onClick={newQ}>{t("hubtoolsa.c_tryAnother")}</Button>
        </div>
        {fb && <p role="status" className="m-0 mt-2 text-[13.5px] font-bold text-[var(--ink)]">{fb}</p>}
      </div>}
      <div className={`mx-auto w-full max-w-[640px] overflow-hidden ${bare ? "" : "rounded-2xl border border-[var(--line)] bg-[var(--surface)]"}`}>
        <svg viewBox="0 0 200 122" role="img" aria-label={t("hubtoolsa.a_svgAria", { theta })} style={{ width: "100%", display: "block" }}>
          <line x1={10} y1={P[1]} x2={190} y2={P[1]} {...lineStyle} /><line x1={10} y1={Q[1]} x2={190} y2={Q[1]} {...lineStyle} />
          <path d="M60 42l4 -2v4zM60 80l4 -2v4z" fill="var(--ink)" /><path d="M64 42l4 -2v4zM64 80l4 -2v4z" fill="var(--ink)" />
          <line x1={t1[0]} y1={t1[1]} x2={t2[0]} y2={t2[1]} stroke="var(--brand)" strokeWidth={0.8} />
          {REGIONS.map((r) => { const [x, y] = at(r), on = sel === r; return (
            <g key={r} tabIndex={0} role="button" aria-label={values ? t("hubtoolsa.a_angleAriaVal", { r, deg: angleOf(r, theta) }) : t("hubtoolsa.a_angleAria", { r })} aria-pressed={on} onClick={() => setSel(r)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSel(r); } }} style={{ cursor: "pointer", outline: "none" }}>
              <circle cx={x} cy={y - 1.6} r={6.4} fill={on ? "var(--brand)" : "var(--panel)"} stroke={on ? "var(--brand)" : "var(--line)"} strokeWidth={0.5} />
              <text x={x} y={y - (values ? 2.4 : 0.4)} fontSize={6} fontWeight={800} textAnchor="middle" fill={on ? "#fff" : "var(--ink)"} style={{ userSelect: "none" }}>{r}</text>
              {values && <text x={x} y={y + 2.6} fontSize={4} fontWeight={700} textAnchor="middle" fill={on ? "#fff" : "var(--ink-2)"} style={{ userSelect: "none" }}>{round(angleOf(r, theta), 0)}°</text>}
            </g>); })}
        </svg>
      </div>
      <div data-tool-strip className="flex flex-wrap items-center gap-3">
        <label className="grid gap-1 text-[12px] font-bold text-[var(--ink-2)]">{t("hubtoolsa.a_turn", { theta })}<input type="range" min={25} max={155} value={theta} onChange={(e) => setTheta(Number(e.target.value))} className="w-56 accent-[var(--brand)]" aria-label={t("hubtoolsa.a_turnAria")} /></label>
        {!assess && <label className="inline-flex min-h-[40px] items-center gap-1.5 text-[12.5px] font-bold text-[var(--ink)]"><input type="checkbox" checked={values} onChange={(e) => setValues(e.target.checked)} className="accent-[var(--brand)]" />{t("hubtoolsa.a_showSizes")}</label>}
        {!q && !assess && <Button data-tool-chrome onClick={newQ}>{t("hubtoolsa.a_practise")}</Button>}
      </div>
      {values && <div role="region" aria-label={t("hubtoolsa.a_whatElse")} className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-3">
        <p className="m-0 mb-1.5 text-[13px] font-extrabold text-[var(--ink)]">{t("hubtoolsa.a_isDeg", { sel, deg: angleOf(sel, theta) })}</p>
        <ul className="m-0 grid list-none gap-1 p-0 text-[13px] font-semibold text-[var(--ink)]">{facts.map((f) => <li key={f.region}>{t(f.equal ? "hubtoolsa.a_factEqual" : "hubtoolsa.a_factSum", { r: f.region, deg: angleOf(f.region, theta), reason: why(f.reason) })}</li>)}</ul>
      </div>}
    </div>
  );
}

function Triangle({ assess }: { assess: boolean }) {
  const t = useT();
  const bare = useBareTool();
  const [v, setV] = useState<Pt[]>([[40, 100], [150, 100], [95, 30]]);
  const [i, setI] = useState<number | null>(null);
  const [values, setValues] = useState(!assess && !bare);
  useEffect(() => { setValues(!assess && !bare); }, [bare, assess]);
  const ang = (k: number) => angleAt(v[k]!, v[(k + 1) % 3]!, v[(k + 2) % 3]!), inner = [0, 1, 2].map((k) => { const a = ang(k); return a > 180 ? 360 - a : a; });
  const ext = 180 - inner[1]!; // exterior angle at the second vertex
  const pos = (e: React.PointerEvent<SVGSVGElement>): Pt => { const s = e.currentTarget, m = s.getScreenCTM()!, p = s.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; const w = p.matrixTransform(m.inverse()); return [Math.max(8, Math.min(192, w.x)), Math.max(8, Math.min(112, w.y))]; };
  return (
    <div className="grid gap-3">
      <div className={`mx-auto w-full max-w-[640px] overflow-hidden ${bare ? "" : "rounded-2xl border border-[var(--line)] bg-[var(--surface)]"}`}>
        <svg viewBox="0 0 200 122" style={{ width: "100%", touchAction: "none", display: "block" }} role="img" aria-label={t("hubtoolsa.a_triAria")}
          onPointerMove={(e) => { if (i !== null) setV((a) => a.map((p, k) => (k === i ? pos(e) : p))); }} onPointerUp={() => setI(null)}>
          <polygon points={v.map((p) => p.join(",")).join(" ")} fill="color-mix(in srgb, var(--brand-2) 10%, transparent)" stroke="var(--ink)" strokeWidth={0.7} />
          <line x1={v[1]![0]} y1={v[1]![1]} x2={v[1]![0] + (v[1]![0] - v[0]![0]) * 0.6} y2={v[1]![1] + (v[1]![1] - v[0]![1]) * 0.6} stroke="var(--ink-3)" strokeWidth={0.5} strokeDasharray="2 1.5" />
          {v.map((p, k) => <g key={k}><circle cx={p[0]} cy={p[1]} r={4.5} fill="var(--brand)" stroke="var(--surface)" strokeWidth={0.8} style={{ cursor: "grab" }} onPointerDown={(e) => { (e.currentTarget as Element).setPointerCapture?.(e.pointerId); setI(k); }} />
            {values && <text x={p[0] + (p[0] < 100 ? -10 : 5)} y={p[1] + (p[1] > 60 ? 10 : -5)} fontSize={5.5} fontWeight={800} fill="var(--ink)" style={{ userSelect: "none" }}>{round(inner[k]!, 0)}°</text>}</g>)}
          {values && <text x={v[1]![0] + 14} y={v[1]![1] - 4} fontSize={5} fontWeight={800} fill="var(--brand)" style={{ userSelect: "none" }}>{t("hubtoolsa.a_outside", { deg: round(ext, 0) })}</text>}
        </svg>
      </div>
      {values && <p className="m-0 text-[13.5px] font-semibold text-[var(--ink)]">{t("hubtoolsa.a_insideSum", { list: inner.map((a) => round(a, 0)).join("° + ") + "°", sum: round(inner.reduce((s, a) => s + a, 0), 0), ext: round(ext, 0), far: round(inner[0]! + inner[2]!, 0) })}</p>}
      {!assess && <label className="inline-flex min-h-[40px] items-center gap-1.5 text-[12.5px] font-bold text-[var(--ink)]"><input type="checkbox" checked={values} onChange={(e) => setValues(e.target.checked)} className="accent-[var(--brand)]" />{t("hubtoolsa.a_showSizes")}</label>}
      <p data-tool-chrome className="m-0 text-[11.5px] font-semibold text-[var(--ink-3)]">{t("hubtoolsa.a_dragHint")}</p>
    </div>
  );
}

export default function AngleFacts({ mode = "practise" }: Partial<ToolProps>) {
  const t = useT();
  const assess = mode === "assess";
  const [tab, setTab] = useState<"parallel" | "triangle">("parallel");
  return (
    <div className="grid gap-3" data-testid="angle-facts">
      <div data-tool-strip className="flex gap-1.5" role="tablist" aria-label={t("hubtoolsa.a_tablist")}>{([["parallel", t("hubtoolsa.a_parallel")], ["triangle", t("hubtoolsa.a_triangle")]] as const).map(([k, label]) => <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`min-h-[40px] rounded-full border px-4 text-[13px] font-extrabold ${FOCUS} ${tab === k ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink)]"}`}>{label}</button>)}</div>
      {tab === "parallel" ? <Parallel assess={assess} /> : <Triangle assess={assess} />}
    </div>
  );
}
export { dist, dirOf };
