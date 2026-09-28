"use client";
import { useEffect, useRef, useState } from "react";
import { stageById, biomeOf } from "../config";
import { strategyFor } from "../core";
import { HostAvatar, HOST_NAME, type HostPose } from "../characters/host";
import type { Finished, Started } from "../store";
import { IconFish, IconStar } from "./icons";
import type { TT, TPl } from "./tt";

const fmt = (k: string) => { const m = /^[xd]_(\d+)x(\d+)$/.exec(k); return m ? `${m[1]}×${m[2]}` : k; };
type Reveal = { key: string; text: string };

/** The end of a run, kept short: stars, right answers, fish and ONE fact to look at. Anything new (a stage, a helper, an outfit) comes first as its own reveal, one card at a time. */
export function StageSummary({ T, TP, result, started, calm, demo, restDue, onNext, onAgain, onMap, onRest, nextLabel }: {
  T: TT; TP: TPl; result: Finished; started: Started; calm: boolean; demo: boolean; restDue: boolean; onNext: (() => void) | null; onAgain: () => void; onMap: () => void; onRest: () => void; nextLabel: string;
}) {
  const head = useRef<HTMLHeadingElement>(null);
  const st = result.stage; const acc = result.answered ? result.correct / result.answered : 0;
  const sd = st ? stageById(st.id) : null; const b = sd ? biomeOf(sd.biome) : null;
  const reveals: Reveal[] = [];
  if (st) {
    for (const id of st.opened) { const o = stageById(id); if (o) reveals.push({ key: `s${id}`, text: T("reveal_stage", { name: o.boss ? T(`boss_${biomeOf(o.biome).chaser}`) : `${T(`biome_${biomeOf(o.biome).id}`)} ${o.idx}` }) }); }
    for (const p of st.newPowers) reveals.push({ key: `p${p}`, text: T("reveal_power", { name: T(`pw_${p}`) }) });
    for (const c of st.newCosmetics.filter((c) => !["cap", "snow", "nosled", "noback"].includes(c))) reveals.push({ key: `c${c}`, text: T("reveal_cos", { mascot: HOST_NAME, name: T(`cos_${c}`) }) });
  }
  const [ri, setRi] = useState(0);
  useEffect(() => { head.current?.focus(); }, [ri]);
  if (ri < reveals.length) {
    return (
      <div className="ps-over" data-nokeys data-testid="ps-reveal" role="dialog" aria-modal="true" aria-label={T("reveal_new")}>
        <div className="ps-card ps-fadein" key={reveals[ri]!.key} style={{ textAlign: "center", maxWidth: 460 }}>
          <div style={{ display: "flex", justifyContent: "center" }}><HostAvatar pose="celebrate" size={110} still={calm} /></div>
          <h2 ref={head} tabIndex={-1} style={{ outline: "none", color: "#c8901a" }} data-testid="ps-reveal-title">{T("reveal_new")}</h2>
          <p style={{ fontSize: 22, fontWeight: 800 }} data-testid="ps-opened">{reveals[ri]!.text}</p>
          <div className="ps-row"><button className="ps-btn ps-big" type="button" style={{ minHeight: 64, fontSize: 24 }} onClick={() => setRi(ri + 1)} autoFocus data-testid="ps-reveal-next">{T("reveal_next")}</button></div>
        </div>
      </div>
    );
  }
  const boss = st?.boss ? b : null; const bossName = boss ? T(`boss_${boss.chaser}`) : "";
  const pose: HostPose = st?.caught ? "encourage" : st && st.stars === 3 ? "celebrate" : acc >= 0.7 ? "cheer" : "encourage";
  const look = result.lookAt ? strategyFor(...(result.lookAt.k.slice(2).split("x").map(Number) as [number, number])) : null;
  const stratText = look ? (look.id === "near10" ? T("strat_near10", { a: look.a, b: look.b, sign: look.b === 9 ? "−" : "+", t: look.t }) : T(`strat_${look.id}`, { a: look.a, b: look.b, r: look.b - 5, x: look.x, y: look.y, t: look.t })) : "";
  const title = st ? (st.caught ? T("caught_title") : boss ? (result.bossDown ? T("boss_down", { boss: bossName }) : T("boss_escaped", { boss: bossName })) : st.cleared ? T("stage_cleared") : T("sum_title")) : result.newBest && !calm ? T("sum_title_best") : T("sum_title");
  return (
    <div className="ps-over" data-nokeys data-testid="ps-summary">
      <div className="ps-card ps-fadein" style={{ textAlign: "center" }} role="region" aria-labelledby="ps-sum-h">
        <div style={{ display: "flex", justifyContent: "center" }}><HostAvatar pose={pose} size={96} still={calm} /></div>
        <h2 id="ps-sum-h" ref={head} tabIndex={-1} style={{ outline: "none" }}>{title}</h2>
        {st && (
          <div aria-label={T("stars_earned", { n: st.stars })} data-testid="ps-stars" data-stars={st.stars} style={{ display: "flex", justifyContent: "center", gap: 6, margin: "8px 0" }}>
            {[1, 2, 3].map((n) => <span key={n} style={{ opacity: st.stars >= n ? 1 : 0.22, transform: st.stars >= n ? "scale(1.25)" : "none", transition: `transform .3s ${n * 0.25}s, opacity .3s ${n * 0.25}s` }}><IconStar s={44} /></span>)}
          </div>
        )}
        {/* first-try wording: a question that came back for another go is not counted twice, and nothing here reads like a fail */}
        <p className="ps-big-num" data-testid="ps-answered">{result.firstTry > 0 && result.firstTryCorrect === result.firstTry ? T("sum_first_all", { n: result.firstTry }) : T("sum_first", { correct: result.firstTryCorrect })}</p>
        {result.firstTry > result.firstTryCorrect && <p className="ps-help" data-testid="ps-practise" style={{ marginTop: -6 }}>{T("sum_practise", { n: result.firstTry - result.firstTryCorrect })}</p>}
        {result.friend && !calm && <p style={{ fontWeight: 800, fontSize: 18 }} data-testid="ps-friend-freed">{T("friend_freed")}</p>}
        {!calm && <p style={{ fontWeight: 800, fontSize: 20 }} data-testid="ps-fish"><IconFish s={22} /> {TP("sum_fish", result.fish)}{result.newBest ? ` · ${TP("sum_best", result.fish)}` : ""}</p>}
        {result.lookAt && look && <div style={{ marginTop: 10, textAlign: "start", background: "#f3f0ff", borderRadius: 16, padding: "10px 14px" }} data-testid="ps-lookat"><b>{T("look_title", { fact: fmt(result.lookAt.k) })}</b><div style={{ fontSize: 17, marginTop: 4 }}><bdi dir="ltr">{stratText.replace(/(\d) x (\d)/g, "$1 × $2")}</bdi></div></div>}
        {restDue ? (
          <div style={{ marginTop: 14 }} data-testid="ps-rest"><h2 style={{ fontSize: 24 }}>{T("rest_title", { mascot: HOST_NAME })}</h2><p>{T("rest_body")}</p>
            <div className="ps-row"><button className="ps-btn ps-big" type="button" style={{ minHeight: 64, fontSize: 22 }} onClick={onRest}>{T("rest_stop")}</button><button className="ps-chip" type="button" onClick={onMap} data-testid="ps-map-btn">{T("rest_more")}</button></div></div>
        ) : (
          <div className="ps-row" style={{ marginTop: 16 }}>
            {onNext && <button className="ps-btn ps-big" type="button" style={{ minHeight: 68, fontSize: 24, padding: "0 30px" }} onClick={onNext} data-testid="ps-next" autoFocus>{nextLabel}</button>}
            <button className={onNext ? "ps-chip" : "ps-btn ps-big"} style={onNext ? undefined : { minHeight: 68, fontSize: 24, padding: "0 30px" }} type="button" onClick={onAgain} data-testid="ps-again" autoFocus={!onNext}>{st && !st.cleared ? T("retry") : T("again")}</button>
            <button className="ps-chip" type="button" onClick={onMap} data-testid="ps-map-btn">{T("to_map")}</button>
          </div>
        )}
        <p className="ps-help" data-testid="ps-saved">{demo ? T("saved_device") : result.saved === "queued" ? T("saved_queued") : T("saved_server")}</p>
        <p className="ps-help" data-testid="ps-week" style={{ marginTop: 2 }}>{TP("sum_week", result.weekDays, { goal: result.weekGoal })}</p>
        <span hidden data-testid="ps-best">{result.newBest ? "1" : ""}</span>
      </div>
    </div>
  );
}
