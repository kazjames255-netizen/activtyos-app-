"use client";
import { useEffect, useRef, useState } from "react";
import { THEME } from "../theme";
import { HOST_NAME } from "../characters/host";
import type { TT } from "./tt";

/** A short picture story (3-5 panels, drawn in canvas, one line each). The prologue sets the goal; the finale is the ending. Nothing here is required reading for a run. */
export type Panel = { art: "storm" | "egg" | "percy" | "hatch" | "colony" | "home"; key: string };
export const PROLOGUE: Panel[] = [{ art: "storm", key: "pro_1" }, { art: "egg", key: "pro_2" }, { art: "percy", key: "pro_3" }];
export const FINALE: Panel[] = [{ art: "egg", key: "fin_1" }, { art: "hatch", key: "fin_2" }, { art: "colony", key: "fin_3" }, { art: "home", key: "fin_4" }, { art: "percy", key: "fin_5" }];

const TAU = Math.PI * 2;
const hash = (n: number) => { let h = Math.imul(n + 0x9e3779b9, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
function egg(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, rot: number, crack: number) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  const g = ctx.createRadialGradient(-s * 0.2, -s * 0.5, s * 0.1, 0, 0, s * 1.1); g.addColorStop(0, "#ffffff"); g.addColorStop(1, "#f3e6c4");
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, s * 0.62, s * 0.82, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = "#7f9cf0"; for (const [dx, dy, r] of [[-0.25, -0.2, 0.09], [0.2, 0.1, 0.11], [-0.1, 0.4, 0.08], [0.3, -0.35, 0.07]] as const) { ctx.beginPath(); ctx.arc(dx * s, dy * s, r * s, 0, TAU); ctx.fill(); }
  if (crack > 0) { ctx.strokeStyle = "#5a4a3a"; ctx.lineWidth = s * 0.05; ctx.lineJoin = "round"; ctx.beginPath(); ctx.moveTo(-s * 0.45, -s * 0.1); for (let i = 1; i <= 5 * crack; i++) ctx.lineTo(-s * 0.45 + i * s * 0.19, -s * 0.1 + (i % 2 ? s * 0.16 : -s * 0.08)); ctx.stroke(); }
  ctx.restore();
}
function draw(ctx: CanvasRenderingContext2D, art: Panel["art"], t: number, W: number, H: number, still: boolean) {
  const k = still ? 0 : t;
  const dark = art === "storm" || art === "egg";
  const g = ctx.createLinearGradient(0, 0, 0, H); if (dark) { g.addColorStop(0, "#0a1038"); g.addColorStop(0.6, "#2a3a8a"); g.addColorStop(1, "#5b6ac4"); } else { g.addColorStop(0, "#1a2a78"); g.addColorStop(0.55, "#7a5cd6"); g.addColorStop(1, "#f0b8ff"); }
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 40; i++) { ctx.globalAlpha = 0.4 + 0.5 * Math.abs(Math.sin(k * 0.8 + i)); ctx.fillStyle = "#fff"; ctx.fillRect(hash(i) * W, hash(i + 50) * H * 0.5, 2, 2); } ctx.globalAlpha = 1;
  if (!dark) { for (let b = 0; b < 3; b++) { ctx.strokeStyle = ["rgba(127,227,255,.35)", "rgba(155,123,255,.35)", "rgba(255,158,199,.3)"][b]!; ctx.lineWidth = 26; ctx.beginPath(); for (let x = 0; x <= W; x += 20) { const y = H * (0.18 + b * 0.07) + Math.sin(x * 0.012 + k * 0.6 + b) * 18; if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.stroke(); } }
  ctx.fillStyle = dark ? "#26357f" : "#4a3fa8"; ctx.beginPath(); ctx.moveTo(0, H * 0.68); for (let i = 0; i <= 8; i++) ctx.lineTo((W * i) / 8, H * (0.42 + hash(i + 3) * 0.22)); ctx.lineTo(W, H * 0.68); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#f4f9ff"; ctx.beginPath(); ctx.moveTo(0, H * 0.72); ctx.quadraticCurveTo(W * 0.5, H * 0.66, W, H * 0.74); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
  const penguin = (x: number, y: number, size: number, eyes: "open" | "happy", cos: string[] = []) => THEME.character.draw(ctx, THEME.palette, x, y, size, { tilt: still ? 0 : Math.sin(k * 3 + x) * 0.04, sx: 1, sy: 1, face: true, eyes, blink: 0, t: k, cosmetics: cos, wing: 0.2, still });
  if (art === "storm") { ctx.strokeStyle = "rgba(255,255,255,.6)"; ctx.lineWidth = 2; for (let i = 0; i < 60; i++) { const x = ((hash(i) * W + k * 260 * (0.6 + hash(i + 9))) % (W + 60)) - 30, y = (hash(i + 20) * H + k * 90) % H; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 26, y + 6); ctx.stroke(); } egg(ctx, W * 0.72 - ((k * 60) % 220) * 0.4, H * 0.58, 70, k * 3, 0); penguin(W * 0.25, H * 0.9, 150, "open"); }
  else if (art === "egg") { for (let i = 0; i < 30; i++) { const x = ((hash(i) * W + k * 180) % (W + 40)) - 20, y = (hash(i + 20) * H + k * 70) % H; ctx.fillStyle = "rgba(255,255,255,.7)"; ctx.fillRect(x, y, 3, 3); } egg(ctx, W * 0.66 + (still ? 0 : ((k * 90) % 300) * 0.5), H * 0.72 + Math.sin(k * 5) * 5, 82, (still ? 0.3 : k * 2.4), 0); penguin(W * 0.22, H * 0.92, 165, "open"); }
  else if (art === "percy") penguin(W / 2, H * 0.92, 210, "happy", ["outfit_summit"]);
  else if (art === "hatch") { egg(ctx, W * 0.42, H * 0.78, 90, 0, 1); penguin(W * 0.68, H * 0.93, 130, "happy", []); ctx.save(); ctx.translate(W * 0.42, H * 0.6 + Math.abs(Math.sin(k * 4)) * -8); THEME.character.draw(ctx, THEME.palette, 0, 44, 62, { tilt: 0, sx: 1, sy: 1, face: true, eyes: "happy", blink: 0, t: k, cosmetics: [], wing: 0.5, still }); ctx.restore(); }
  else if (art === "colony") { for (let i = 0; i < 7; i++) penguin(W * (0.12 + i * 0.125), H * (0.86 + (i % 2) * 0.05), 96 + (i % 3) * 8, "happy", i % 3 === 0 ? ["scarf"] : i % 3 === 1 ? ["beanie"] : []); }
  else { // home: igloos, lanterns, everyone
    for (let i = 0; i < 4; i++) { const x = W * (0.14 + i * 0.24), y = H * 0.8; const ig = ctx.createLinearGradient(0, y - 80, 0, y); ig.addColorStop(0, "#fff"); ig.addColorStop(1, "#cfe4ff"); ctx.fillStyle = ig; ctx.beginPath(); ctx.arc(x, y, 62, Math.PI, 0); ctx.fill(); ctx.fillStyle = "#3b4a92"; ctx.beginPath(); ctx.arc(x, y, 18, Math.PI, 0); ctx.fill(); ctx.fillStyle = "rgba(255,206,74,.95)"; ctx.beginPath(); ctx.arc(x, y - 1, 10, Math.PI, 0); ctx.fill(); }
    for (let i = 0; i < 5; i++) penguin(W * (0.16 + i * 0.17), H * 0.95, 82, "happy", i === 2 ? ["crown"] : []);
  }
}

export function StoryScene({ T, panels, onDone, still }: { T: TT; panels: Panel[]; onDone: () => void; still: boolean }) {
  const [i, setI] = useState(0); const cv = useRef<HTMLCanvasElement>(null); const btn = useRef<HTMLButtonElement>(null);
  const p = panels[i]!; const last = i === panels.length - 1;
  useEffect(() => { btn.current?.focus(); }, [i]);
  useEffect(() => {
    const c = cv.current; if (!c) return; const ctx = c.getContext("2d"); if (!ctx) return; let raf = 0; const t0 = performance.now();
    const W = 720, H = 400; const f = (now: number) => { ctx.setTransform(c.width / W, 0, 0, c.height / H, 0, 0); draw(ctx, p.art, (now - t0) / 1000, W, H, still); if (!still) raf = requestAnimationFrame(f); }; raf = requestAnimationFrame(f);
    return () => cancelAnimationFrame(raf);
  }, [p.art, still]);
  return (
    <div className="ps-over" data-nokeys data-testid="ps-story" role="dialog" aria-modal="true" aria-label={T(p.key, { mascot: HOST_NAME })} style={{ background: "rgba(7,11,46,.94)" }}>
      <div style={{ width: "min(720px,100%)", textAlign: "center", color: "#fff" }} className="ps-fadein">
        <canvas ref={cv} width={1440} height={800} style={{ width: "100%", aspectRatio: "720/400", borderRadius: 24, border: "3px solid rgba(255,255,255,.35)", display: "block" }} role="img" aria-label={T(p.key, { mascot: HOST_NAME })} />
        <p style={{ fontSize: "clamp(18px,3.4vw,26px)", fontWeight: 700, margin: "14px 8px", minHeight: 64 }} data-testid="ps-story-text">{T(p.key, { mascot: HOST_NAME })}</p>
        <div className="ps-row">
          {!last && <button className="ps-chip" type="button" onClick={onDone} data-testid="ps-story-skip">{T("story_skip")}</button>}
          <button ref={btn} className="ps-btn ps-big" type="button" style={{ minHeight: 64, fontSize: 24 }} onClick={() => (last ? onDone() : setI(i + 1))} data-testid="ps-story-next">{last ? T("story_start") : T("story_next")}</button>
        </div>
        <div aria-hidden="true" style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 10 }}>{panels.map((_, j) => <span key={j} className={`ps-dot${j <= i ? " on" : ""}`} />)}</div>
      </div>
    </div>
  );
}
