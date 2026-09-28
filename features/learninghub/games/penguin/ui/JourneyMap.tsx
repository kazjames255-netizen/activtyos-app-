"use client";
import { useEffect, useRef } from "react";
import { BIOMES, STAGES, biomeOf, type BiomeDef, type Modifier, type StageDef } from "../config";
import { journeyView } from "../journey";
import { lookOf } from "../theme";
import { HostAvatar, HOST_NAME } from "../characters/host";
import type { JourneyOverview } from "../store";
import type { HighScore } from "../arcadeLocal";
import { ArcadeMenu } from "./ArcadeUI";
import type { TT, TPl } from "./tt";
import { IconFish, IconMap, IconStar } from "./icons";

const Lock = () => <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M7 10V8a5 5 0 0 1 10 0v2h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1Zm2 0h6V8a3 3 0 0 0-6 0Z" /></svg>;
const Crown = () => <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M3 18 2 7l5 4 5-7 5 7 5-4-1 11Zm1 2h16v2H4Z" /></svg>;
const stageName = (T: TT, s: StageDef) => (s.boss ? T(`boss_${biomeOf(s.biome).chaser}`) : T("stage_n", { n: s.idx }));

/** THE MAP: five biomes of four stages each. Stages open by mastery (2 stars on the one before); locked ones still show what is coming. */
export function JourneyMap({ T, TP, info, demo, onStage, onDaily, onPit, onFree, onArcade, high, calm, onWardrobe, onVillage, fish, onIceMap, onMtc, onSettings, onFinale, onUnlockAll, onExit }: {
  T: TT; TP: TPl; info: JourneyOverview | null; demo: boolean; onStage: (s: StageDef) => void; onDaily: () => void; onPit: () => void; onFree: () => void; onArcade: (mode: "arcade" | "arcade-daily" | "arcade-endless") => void; high: HighScore[]; calm: boolean; onWardrobe: () => void; onVillage: () => void; fish: number; onIceMap: () => void; onMtc: (() => void) | null; onSettings: () => void; onFinale?: (() => void) | null; onUnlockAll: (() => void) | null; onExit?: () => void;
}) {
  const head = useRef<HTMLHeadingElement>(null); const cur = useRef<HTMLDivElement>(null);
  useEffect(() => { head.current?.focus(); }, []);
  const stars = info?.journey.stars ?? {}; const view = journeyView(stars, info?.journey.unlockAll ?? false);
  const current = view.stages.find((s) => s.status === "open") ?? view.stages[view.stages.length - 1]!;
  useEffect(() => { cur.current?.scrollIntoView({ block: "center" }); }, [info?.journey.totalStars]);
  const mod = info?.daily.modifier as Modifier | undefined;
  return (
    <div className="ps-over" style={{ alignItems: "flex-start", background: "linear-gradient(180deg,rgba(7,11,46,.92),rgba(20,30,110,.78))" }} data-nokeys data-testid="ps-map">
      <div style={{ width: "min(760px,100%)", margin: "0 auto", paddingBottom: 30 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", color: "#fff" }}>
          <HostAvatar pose="wave" size={64} />
          <div style={{ flex: 1, minWidth: 160 }}>
            <h1 ref={head} tabIndex={-1} style={{ margin: 0, fontFamily: "var(--ff-display,inherit)", fontSize: "clamp(26px,5vw,38px)", outline: "none" }}>{T("journey_title")}</h1>
            <div style={{ fontWeight: 700, opacity: 0.92 }} data-testid="ps-total-stars"><IconStar s={18} /> {T("stars_total", { n: view.totalStars, max: view.maxStars })}{info ? ` · ${TP("sum_week", info.weekDays, { goal: info.weekGoal })}` : ""}</div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", flexBasis: "100%" }}>
            <button className="ps-btn" type="button" onClick={onVillage} data-testid="ps-open-village"><IconFish s={18} /> {fish} · {T("village_btn")}</button>
            <button className="ps-btn" type="button" onClick={onWardrobe} data-testid="ps-open-wardrobe">{T("wardrobe_btn")}</button>
            <button className="ps-btn" type="button" onClick={onIceMap} data-testid="ps-open-map"><IconMap s={18} /> {T("map_title")}</button>
            <button className="ps-btn" type="button" onClick={onSettings} data-testid="ps-open-settings">{T("settings")}</button>
            {onFinale && <button className="ps-btn" type="button" onClick={onFinale} data-testid="ps-replay-finale">{T("finale_replay")}</button>}
            {onExit && <button className="ps-btn" type="button" onClick={onExit}>{T("done")}</button>}
          </div>
        </div>
        {demo && <p style={{ margin: "10px 0 0" }}><span className="ps-demo" data-testid="ps-demo-badge">{T("demo_badge")}</span>{onUnlockAll && !info?.journey.unlockAll && <button className="ps-link" type="button" style={{ color: "#ffe58a" }} onClick={onUnlockAll} data-testid="ps-unlock-all">{T("demo_unlock_all")}</button>}</p>}

        <ArcadeMenu T={T} info={info} high={high} calm={calm} onPlay={onArcade} />

        <div className="ps-row" style={{ justifyContent: "stretch", alignItems: "stretch", marginTop: 14 }}>
          <div className="ps-card" style={{ flex: "1 1 260px", padding: 14, margin: 0, width: "auto" }} data-testid="ps-daily">
            <b>{T("daily_title")}</b>
            <p style={{ margin: "4px 0 8px" }}>{mod ? T(`daily_mod_${mod}`) : ""}</p>
            <button className="ps-chip" type="button" onClick={onDaily} data-testid="ps-daily-play">{T("daily_play")}</button>
          </div>
          <div className="ps-card" style={{ flex: "1 1 260px", padding: 14, margin: 0, width: "auto" }} data-testid="ps-pit">
            <b>{T("pit_title")}</b>
            <p style={{ margin: "4px 0 8px" }}>{T("pit_sub")}</p>
            <button className="ps-chip" type="button" onClick={onPit} data-testid="ps-pit-play">{T("pit_play")}</button>
          </div>
        </div>

        {BIOMES.map((b) => <BiomeSection key={b.n} T={T} b={b} view={view} currentId={current.def.id} curRef={cur} onStage={onStage} />)}

        <div className="ps-row" style={{ marginTop: 18 }}>
          <button className="ps-chip" type="button" onClick={onFree} data-testid="ps-free">{T("free_play")}</button>
          {onMtc && <button className="ps-chip" type="button" onClick={onMtc} data-testid="ps-open-mtc">{T("mtc_open")}</button>}
        </div>
        <p style={{ color: "#c9d6ff", textAlign: "center", fontSize: 13 }}>{T("map_rules", { mascot: HOST_NAME })}</p>
      </div>
    </div>
  );
}

function BiomeSection({ T, b, view, currentId, curRef, onStage }: { T: TT; b: BiomeDef; view: ReturnType<typeof journeyView>; currentId: string; curRef: React.RefObject<HTMLDivElement | null>; onStage: (s: StageDef) => void }) {
  const look = lookOf(b.n); const stages = view.stages.filter((s) => s.def.biome === b.n);
  const locked = stages.every((s) => s.status === "locked");
  const got = stages.reduce((a, s) => a + s.stars, 0);
  return (
    <section aria-label={T(`biome_${b.id}`)} data-testid={`ps-biome-${b.id}`} data-locked={locked ? "1" : "0"} style={{ marginTop: 16, borderRadius: 26, padding: "16px 16px 14px", background: `linear-gradient(180deg, ${look.sky[1]}, ${look.sky[2]} 70%, ${look.ground[1]})`, boxShadow: "0 12px 30px rgba(4,8,40,.5)", border: "3px solid rgba(255,255,255,.45)", opacity: locked ? 0.78 : 1, color: "#fff" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
        <h2 style={{ margin: 0, fontFamily: "var(--ff-display,inherit)", fontSize: "clamp(22px,4vw,30px)", textShadow: "0 2px 6px rgba(0,0,0,.35)" }}>{b.n}. {T(`biome_${b.id}`)}</h2>
        <span style={{ fontWeight: 800 }}><IconStar s={16} /> {got}/12</span>
      </div>
      <p style={{ margin: "2px 0 0", fontWeight: 600, textShadow: "0 1px 4px rgba(0,0,0,.4)" }}>{T(`biome_${b.id}_sub`)}{locked ? ` · ${T("locked_hint")}` : ""}</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginTop: 14 }}>
        {stages.map((s) => {
          const isCur = s.def.id === currentId; const lock = s.status === "locked";
          return (
            <div key={s.def.id} ref={isCur ? curRef : undefined} style={{ textAlign: "center" }}>
              <button type="button" disabled={lock} onClick={() => onStage(s.def)} data-testid={`ps-stage-${s.def.id}`} data-status={s.status} aria-label={`${stageName(T, s.def)}: ${lock ? T("stage_locked") : T("stars_earned", { n: s.stars })}`}
                style={{ appearance: "none", cursor: lock ? "default" : "pointer", width: s.def.boss ? 84 : 72, height: s.def.boss ? 84 : 72, borderRadius: s.def.boss ? 26 : "50%", border: `4px solid ${isCur ? "#ffce4a" : "rgba(255,255,255,.85)"}`, background: lock ? "rgba(10,16,60,.55)" : s.status === "done" ? "linear-gradient(180deg,#fff,#dfe9ff)" : "linear-gradient(180deg,#ffe58a,#ffce4a)", color: lock ? "#c9d6ff" : "#1b2350", fontWeight: 800, fontSize: 24, boxShadow: isCur ? "0 0 0 6px rgba(255,206,74,.35), 0 6px 0 #c8901a" : "0 5px 0 rgba(0,0,0,.25)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--ff-display,inherit)" }}>
                {lock ? <Lock /> : s.def.boss ? <Crown /> : s.def.idx}
              </button>
              <div style={{ marginTop: 6, fontSize: 13, fontWeight: 700, textShadow: "0 1px 3px rgba(0,0,0,.5)", minHeight: 32 }}>{s.def.boss ? T(`boss_${b.chaser}`) : `×${s.def.tables.length > 3 ? "…" : s.def.tables.join(" · ")}`}</div>
              <div aria-hidden="true" style={{ display: "flex", justifyContent: "center", gap: 2 }}>{[1, 2, 3].map((n) => <span key={n} style={{ opacity: s.stars >= n ? 1 : 0.3 }}><IconStar s={16} /></span>)}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
export { STAGES };
