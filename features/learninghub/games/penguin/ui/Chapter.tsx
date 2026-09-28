"use client";
import { useEffect, useRef } from "react";
import { biomeOf } from "../config";
import { THEME, lookOf } from "../theme";
import { HOST_NAME } from "../characters/host";
import type { TT } from "./tt";

/** The cut-scene when a new biome opens: its name, its sky, the penguin in its NEW OUTFIT, and what is new to learn there. */
export function Chapter({ T, biome, onGo }: { T: TT; biome: number; onGo: () => void }) {
  const b = biomeOf(biome); const look = lookOf(biome); const cv = useRef<HTMLCanvasElement>(null); const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => { btn.current?.focus(); }, []);
  useEffect(() => {
    const c = cv.current; if (!c) return; const ctx = c.getContext("2d"); if (!ctx) return;
    ctx.setTransform(2, 0, 0, 2, 0, 0); ctx.clearRect(0, 0, 220, 220);
    THEME.character.draw(ctx, THEME.palette, 110, 200, 176, { tilt: 0, sx: 1, sy: 1, face: true, eyes: "happy", blink: 0, t: 0, cosmetics: [`outfit_${b.id}`], wing: 0.2, still: true });
  }, [b.id]);
  return (
    <div className="ps-over" data-nokeys data-testid="ps-chapter" role="dialog" aria-modal="true" aria-labelledby="ps-chap-h" style={{ background: `linear-gradient(180deg, ${look.sky[0]}, ${look.sky[1]} 55%, ${look.sky[2]})` }}>
      <div style={{ textAlign: "center", color: "#fff", maxWidth: 560 }} className="ps-fadein">
        <div style={{ fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", opacity: 0.9 }}>{T("chapter_n", { n: biome })}</div>
        <h1 id="ps-chap-h" style={{ margin: "4px 0 6px", fontFamily: "var(--ff-display,inherit)", fontSize: "clamp(38px,9vw,72px)", textShadow: "0 4px 18px rgba(0,0,0,.4)" }}>{T(`biome_${b.id}`)}</h1>
        <p style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>{T(`biome_${b.id}_story`, { mascot: HOST_NAME })}</p>
        <div style={{ display: "flex", justifyContent: "center", margin: "6px 0" }}><canvas ref={cv} width={440} height={440} style={{ width: 220, height: 220 }} role="img" aria-label={T("chapter_outfit", { mascot: HOST_NAME })} /></div>
        <div className="ps-row"><button ref={btn} className="ps-btn ps-big" type="button" onClick={onGo} data-testid="ps-chapter-go">{T("chapter_go")}</button></div>
      </div>
    </div>
  );
}
