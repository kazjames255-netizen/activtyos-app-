"use client";
import { useEffect, useRef } from "react";
import { POLICY, POWERS, biomeOf, type PowerId, type StageDef } from "../config";
import { lookOf } from "../theme";
import { HostAvatar, HOST_NAME } from "../characters/host";
import type { Unlocks } from "../journey";
import type { TT } from "./tt";
import { IconStar } from "./icons";

const unlockText = (T: TT, p: (typeof POWERS)[number]) => (p.unlock.secured !== undefined ? T("pw_unlock_secured", { n: p.unlock.secured }) : T("pw_unlock_boss", { n: p.unlock.boss ?? 0 }));

/** A stage: what it teaches, what is new, how stars are earned (accuracy, never speed) and which helpers to take along. */
export function StageCard({ T, stage, best, unlocks, loadout, setLoadout, firstOfBiome, onStart, onClose, busy }: {
  T: TT; stage: StageDef; best: number; unlocks: Unlocks; loadout: string[]; setLoadout: (l: string[]) => void; firstOfBiome: boolean; onStart: () => void; onClose: () => void; busy: boolean;
}) {
  const b = biomeOf(stage.biome); const look = lookOf(stage.biome); const head = useRef<HTMLHeadingElement>(null);
  useEffect(() => { head.current?.focus(); }, []);
  // ONE line about what is new here (the world rule on its first stage, the twist on its second, the boss brief on the fourth): never repeated elsewhere
  const line = stage.boss ? T(`bossline_${b.chaser}`, { mascot: HOST_NAME }) : stage.idx === 1 ? T(`rule_${b.id}`) : stage.idx === 2 ? T(`twist_${b.id}`) : "";
  const on = (id: PowerId) => loadout.includes(id);
  const toggle = (id: PowerId) => setLoadout(on(id) ? loadout.filter((x) => x !== id) : [...loadout, id].slice(-POLICY.loadoutSlots));
  return (
    <div className="ps-over" data-nokeys data-testid="ps-stage-card" role="dialog" aria-modal="true" aria-labelledby="ps-stage-h">
      <div className="ps-card ps-fadein" style={{ borderColor: look.sky[2] }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <HostAvatar pose={stage.boss ? "think" : "point"} size={78} />
          <div>
            <div style={{ fontWeight: 800, color: "#5b6aa8" }}>{T(`biome_${b.id}`)}</div>
            <h2 id="ps-stage-h" ref={head} tabIndex={-1} style={{ outline: "none" }}>{stage.boss ? T(`boss_${b.chaser}`) : T("stage_n", { n: stage.idx })}</h2>
            <div style={{ fontWeight: 700 }}>{T("tables_of", { list: stage.tables.length > 5 ? T("tables_all") : stage.tables.map((n) => `×${n}`).join(", ") })}{stage.forms.includes("d") ? ` · ${T("form_d")}` : ""}{stage.forms.includes("m") ? ` · ${T("form_m")}` : ""}</div>
          </div>
        </div>
        {line && <ul className="ps-list" data-testid="ps-mech"><li className="gold">{line}</li></ul>}
        <div style={{ marginTop: 10, fontSize: 15 }} aria-label={T("stars_how")}>
          <div><IconStar s={16} /> {T("stars_goal1")}</div>
          <div><IconStar s={16} /><IconStar s={16} /> {T("stars_goal2", { pct: Math.round(POLICY.starAccuracy[0] * 100) })}</div>
          <div><IconStar s={16} /><IconStar s={16} /><IconStar s={16} /> {T("stars_goal3", { pct: Math.round(POLICY.starAccuracy[1] * 100) })}</div>
          {best > 0 && <div style={{ color: "#5b6aa8", marginTop: 4 }}>{T("stars_best", { n: best })}</div>}
        </div>
        <div style={{ marginTop: 12 }} role="group" aria-label={T("loadout_title")}>
          <b>{T("loadout_title")}</b>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 8, marginTop: 6 }}>
            {POWERS.map((p) => { const has = unlocks.powers.includes(p.id); return (
              <div key={p.id} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <button type="button" className="ps-chip" aria-pressed={on(p.id)} disabled={!has || busy} onClick={() => toggle(p.id)} data-testid={`ps-power-${p.id}`} aria-describedby={`ps-pd-${p.id}`}>{T(`pw_${p.id}`)}</button>
                <span id={`ps-pd-${p.id}`} style={{ fontSize: 12, color: "#4a5a99", textAlign: "center" }}>{has ? T(`pwd_${p.id}`) : unlockText(T, p)}</span>
              </div>); })}
          </div>
          <p className="ps-help" style={{ margin: "6px 0 0" }}>{unlocks.powers.length ? T("loadout_hint", { n: POLICY.loadoutSlots }) : T("loadout_none")}</p>
        </div>
        <div className="ps-row" style={{ marginTop: 16 }}>
          <button className="ps-btn ps-big" type="button" style={{ minHeight: 68, fontSize: 24 }} onClick={onStart} disabled={busy} autoFocus data-testid="ps-stage-start">{T("start_stage")}</button>
          <button className="ps-chip" type="button" onClick={onClose} data-testid="ps-stage-back">{T("back")}</button>
        </div>
      </div>
    </div>
  );
}
