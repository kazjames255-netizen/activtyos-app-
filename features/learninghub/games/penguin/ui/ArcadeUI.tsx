"use client";
import { useEffect, useRef, useState } from "react";
import { ARCADE, arcadeDailyTables, type ArcadeKind, type ArcadeState } from "../arcade";
import type { HighScore } from "../arcadeLocal";
import { HostAvatar } from "../characters/host";
import type { Finished, JourneyOverview } from "../store";
import { IconPlay, IconStar } from "./icons";
import type { TT } from "./tt";

// ARCADE screens (arcade.ts holds the rules): the menu card on the map, the in-run HUD chips, and the Game Over / Run complete summary.

const Heart = ({ full, s = 22 }: { full: boolean; s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden="true" focusable="false" style={{ opacity: full ? 1 : 0.28, transform: full ? "none" : "scale(.86)", transition: "opacity .25s, transform .25s" }}>
    <path d="M12 21s-7.5-4.6-9.6-9.3C.9 8.3 2.7 4.5 6.3 4.5c2 0 3.5 1.1 4.3 2.6l1.4 2.4 1.4-2.4c.8-1.5 2.3-2.6 4.3-2.6 3.6 0 5.4 3.8 3.9 7.2C19.5 16.4 12 21 12 21Z" fill="#ff5a6e" stroke="#b3243a" strokeWidth="1.3" strokeLinejoin="round" />
  </svg>
);

const KINDS: { kind: ArcadeKind; mode: "arcade" | "arcade-daily" | "arcade-endless"; key: "run" | "daily" | "endless" }[] = [
  { kind: "run", mode: "arcade", key: "run" }, { kind: "daily", mode: "arcade-daily", key: "daily" }, { kind: "endless", mode: "arcade-endless", key: "endless" },
];
const utcDay = () => new Date().toISOString().slice(0, 10);

/** The Arcade card on the map: three ways to play + your bests (server-kept) + this device's top scores. */
export function ArcadeMenu({ T, info, high, calm, onPlay }: { T: TT; info: JourneyOverview | null; high: HighScore[]; calm: boolean; onPlay: (mode: "arcade" | "arcade-daily" | "arcade-endless") => void }) {
  const day = utcDay(); const bests = info?.arcade ?? {};
  const bestOf = (k: ArcadeKind): number | null => { const b = bests[k]; if (!b) return null; return k === "daily" && b.at.slice(0, 10) !== day ? null : b.score; };
  return (
    <div className="ps-card" style={{ margin: "14px 0 0", width: "auto", padding: 16 }} data-testid="ps-arcade">
      <b style={{ fontSize: 22 }}>{T("arc_title")}</b>
      <p style={{ margin: "4px 0 10px" }}>{calm ? T("arc_calm_note") : T("arc_sub", { n: ARCADE.lives })}</p>
      <div className="ps-row" style={{ marginTop: 0, alignItems: "stretch", justifyContent: "stretch" }}>
        {KINDS.map(({ kind, mode, key }, i) => {
          const b = bestOf(kind);
          return (
            <div key={kind} style={{ flex: "1 1 190px", background: i === 0 ? "#fff6d6" : "#eef3ff", border: `2px solid ${i === 0 ? "#f0c04a" : "#c6d3f7"}`, borderRadius: 18, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 4, textAlign: "start" }} data-testid={`ps-arcade-${key}`}>
              <b style={{ fontSize: 18 }}>{T(`arc_${key}`)}</b>
              <span style={{ fontSize: 14, lineHeight: 1.3 }}>{key === "daily" ? T("arc_daily_sub", { tables: arcadeDailyTables(day).map((t) => `×${t}`).join(" ") }) : key === "run" ? T("arc_run_sub", { n: ARCADE.n.run }) : T("arc_endless_sub")}</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#4a5a99" }} data-testid={`ps-arcade-${key}-best`}>{b === null ? T("arc_no_best") : T("arc_best", { n: b })}</span>
              <button className={i === 0 ? "ps-btn ps-big" : "ps-chip"} type="button" style={i === 0 ? { minHeight: 56, fontSize: 22, padding: "0 22px", marginTop: "auto" } : { marginTop: "auto" }} onClick={() => onPlay(mode)} data-testid={`ps-arcade-${key}-play`}><IconPlay s={18} /> {T("arc_play")}</button>
            </div>
          );
        })}
      </div>
      {high.length > 0 && (
        <div style={{ marginTop: 10 }} data-testid="ps-arcade-high">
          <b style={{ fontSize: 14 }}>{T("arc_top")}</b>
          <ol style={{ margin: "4px 0 0", paddingInlineStart: 22, display: "flex", gap: "2px 18px", flexWrap: "wrap", fontWeight: 700 }}>
            {high.map((h, i) => <li key={`${h.at}${i}`}>{h.score} <span style={{ fontWeight: 500, opacity: 0.75 }}>· {T(`arc_${h.kind}`)}</span></li>)}
          </ol>
        </div>
      )}
    </div>
  );
}

/** Hearts, score and combo while playing. In Calm there are no hearts (the run cannot end), only the score. */
export function ArcadeHud({ T, arc }: { T: TT; arc: ArcadeState }) {
  const calm = arc.maxLives === 0;
  return (
    <>
      <span className="ps-chip2" data-testid="ps-arcade-score" aria-label={`${T("arc_score")} ${arc.score}`}><b>{arc.score}</b></span>
      {!calm && <span className="ps-chip2" data-testid="ps-arcade-hearts" data-lives={arc.lives} role="img" aria-label={T("arc_hearts", { n: arc.lives, max: arc.maxLives })}>{Array.from({ length: arc.maxLives }, (_, i) => <Heart key={i} full={i < arc.lives} />)}</span>}
      {arc.combo >= 2 && <span className="ps-chip2" data-testid="ps-arcade-combo" data-combo={Math.min(ARCADE.comboCap, arc.combo)}>{T("arc_combo", { n: Math.min(ARCADE.comboCap, arc.combo) })}</span>}
    </>
  );
}

/** A number that counts up to its target (instant when motion is reduced). */
function useCountUp(target: number, still: boolean): number {
  const [v, setV] = useState(still ? target : 0);
  useEffect(() => {
    if (still || target <= 0) { setV(target); return; }
    let raf = 0; const t0 = performance.now(); const dur = Math.min(1600, 500 + target);
    const tick = (now: number) => { const p = Math.min(1, (now - t0) / dur); setV(Math.round(target * (1 - (1 - p) * (1 - p)))); if (p < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, still]);
  return v;
}

const fmt = (k: string) => { const m = /^[xd]_(\d+)x(\d+)$/.exec(k); return m ? `${m[1]}×${m[2]}` : k; };

/** The end of an Arcade run: Game Over or Run complete, score count-up, stars, new best, the facts to look at, and PLAY AGAIN as the biggest button. */
export function ArcadeSummary({ T, result, high, calm, demo, onAgain, onMenu }: { T: TT; result: Finished; high: HighScore[]; calm: boolean; demo: boolean; onAgain: () => void; onMenu: () => void }) {
  const a = result.arcade!; const head = useRef<HTMLHeadingElement>(null);
  useEffect(() => { head.current?.focus(); }, []);
  const shown = useCountUp(a.score, calm);
  const title = a.over ? T("arc_game_over") : T("arc_complete");
  return (
    <div className="ps-over" data-nokeys data-testid="ps-arcade-summary" data-over={a.over ? 1 : 0}>
      <div className="ps-card ps-fadein" style={{ textAlign: "center" }} role="region" aria-labelledby="ps-arc-h">
        <div style={{ display: "flex", justifyContent: "center" }}><HostAvatar pose={a.over ? "encourage" : a.stars >= 2 ? "celebrate" : "cheer"} size={88} still={calm} /></div>
        <h2 id="ps-arc-h" ref={head} tabIndex={-1} style={{ outline: "none" }} data-testid="ps-arcade-title">{title}</h2>
        {a.maxLives > 0 && <div style={{ display: "flex", justifyContent: "center", gap: 4, margin: "6px 0" }} role="img" aria-label={T("arc_hearts", { n: a.lives, max: a.maxLives })}>{Array.from({ length: a.maxLives }, (_, i) => <Heart key={i} full={i < a.lives} s={26} />)}</div>}
        <p className="ps-big-num" data-testid="ps-arcade-final" data-score={a.score} aria-label={`${T("arc_score")} ${a.score}`}>{shown}</p>
        {a.newBest && <p style={{ fontWeight: 800, fontSize: 20, color: "#c8901a", margin: "2px 0" }} data-testid="ps-arcade-newbest">{T("arc_new_best")}</p>}
        {!a.newBest && a.previousBest !== null && <p className="ps-help" style={{ marginTop: 2 }}>{T("arc_best", { n: a.previousBest })}</p>}
        {a.kind !== "endless" || a.stars > 0 ? (
          <div aria-label={T("stars_earned", { n: a.stars })} data-testid="ps-arcade-stars" data-stars={a.stars} style={{ display: "flex", justifyContent: "center", gap: 6, margin: "8px 0" }}>
            {[1, 2, 3].map((n) => <span key={n} style={{ opacity: a.stars >= n ? 1 : 0.22, transform: a.stars >= n ? "scale(1.25)" : "none" }}><IconStar s={30} /></span>)}
          </div>
        ) : null}
        <p style={{ fontWeight: 700, margin: "4px 0" }} data-testid="ps-arcade-stats">{T("arc_right", { n: a.correct })} · {T("arc_best_streak", { n: a.bestCombo })}</p>
        {result.wrong.length > 0 && (
          <div style={{ marginTop: 8, textAlign: "start", background: "#f3f0ff", borderRadius: 16, padding: "10px 14px" }} data-testid="ps-arcade-missed">
            <b>{T("arc_missed")}</b>
            <ul style={{ margin: "4px 0 0", paddingInlineStart: 20 }}>{result.wrong.slice(0, 4).map((w, i) => <li key={`${w.k}${i}`}><bdi dir="ltr">{fmt(w.k)} = {w.answer}</bdi></li>)}</ul>
          </div>
        )}
        <div className="ps-row" style={{ marginTop: 16 }}>
          <button className="ps-btn ps-big" type="button" style={{ minHeight: 72, fontSize: 26, padding: "0 34px" }} onClick={onAgain} autoFocus data-testid="ps-arcade-again"><IconPlay /> {T("arc_again")}</button>
          <button className="ps-chip" type="button" onClick={onMenu} data-testid="ps-arcade-menu">{T("arc_menu")}</button>
        </div>
        {high.length > 0 && <p className="ps-help" data-testid="ps-arcade-high-end">{T("arc_top")}: {high.map((h) => h.score).join(" · ")}</p>}
        <p className="ps-help" data-testid="ps-saved">{demo ? T("saved_device") : result.saved === "queued" ? T("saved_queued") : T("saved_server")}</p>
      </div>
    </div>
  );
}
