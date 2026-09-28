"use client";
import { useEffect, useRef } from "react";
import { COSMETICS, type CosDef, type Slot } from "../config";
import { THEME } from "../theme";
import type { Prefs } from "./prefs";
import type { TT } from "./tt";
import { HOST_NAME } from "../characters/host";

const SLOTS: Slot[] = ["hat", "scarf", "trail", "sled", "back"];
const need = (c: CosDef, T: TT) => (c.unlock.fish !== undefined ? T("cos_locked_fish") : c.unlock.friends !== undefined ? T("cos_locked_friends", { n: c.unlock.friends }) : c.unlock.built !== undefined ? T("cos_locked_built", { n: c.unlock.built }) : c.unlock.perfect !== undefined ? T("cos_locked_perfect", { n: c.unlock.perfect }) : c.unlock.secured !== undefined ? T("cos_locked_secured", { n: c.unlock.secured }) : c.unlock.stars !== undefined ? T("cos_locked_stars", { n: c.unlock.stars }) : T("cos_locked_boss", { n: c.unlock.boss ?? 0 }));
/** What the penguin wears right now, from the saved choice and what is unlocked: one item per slot, the default when nothing is chosen. */
export function equippedIds(equip: Prefs["equip"], unlocked: string[]): string[] {
  const out: string[] = [];
  for (const slot of SLOTS) { const want = equip[slot]; const id = want && unlocked.includes(want) ? want : slot === "hat" ? "cap" : slot === "trail" ? "snow" : slot === "sled" ? "nosled" : slot === "back" ? "noback" : "auto"; if (id !== "auto") out.push(id); else { const best = [...COSMETICS].reverse().find((c) => c.slot === slot && unlocked.includes(c.id)); if (best) out.push(best.id); } }
  return out;
}

/** The wardrobe: earned by mastery only, chosen at the END of a run (never mid-run). A live preview shows what {mascot} will wear. */
export function Wardrobe({ T, unlocked, equip, setEquip, onClose, skin = "junior" }: { T: TT; unlocked: string[]; equip: Prefs["equip"]; setEquip: (e: Prefs["equip"]) => void; onClose: () => void; skin?: "junior" | "explorer" }) {
  const cv = useRef<HTMLCanvasElement>(null); const head = useRef<HTMLHeadingElement>(null);
  const worn = equippedIds(equip, unlocked);
  useEffect(() => { head.current?.focus(); }, []);
  useEffect(() => {
    const c = cv.current; if (!c) return; const ctx = c.getContext("2d"); if (!ctx) return;
    ctx.setTransform(2, 0, 0, 2, 0, 0); ctx.clearRect(0, 0, 200, 200);
    const g = ctx.createLinearGradient(0, 0, 0, 200); g.addColorStop(0, "#dff0ff"); g.addColorStop(1, "#f6fbff"); ctx.fillStyle = g; ctx.fillRect(0, 0, 200, 200);
    THEME.character.draw(ctx, THEME.palette, 100, 178, 150, { tilt: 0, sx: 1, sy: 1, face: true, eyes: "happy", blink: 0, t: 0, cosmetics: worn, wing: 0.1, still: true, skin });
  }, [worn.join(","), skin]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="ps-over" data-nokeys data-testid="ps-wardrobe-screen">
      <div className="ps-card ps-fadein">
        <h2 ref={head} tabIndex={-1} style={{ outline: "none" }}>{T("wardrobe_title", { mascot: HOST_NAME })}</h2>
        <p className="ps-help">{T("wardrobe_hint")}</p>
        <p className="ps-help" style={{ marginTop: 2 }} data-testid="ps-wardrobe-count">{T("wardrobe_count", { n: COSMETICS.filter((c) => unlocked.includes(c.id)).length, of: COSMETICS.length })}</p>
        <div style={{ display: "flex", justifyContent: "center", margin: "10px 0" }}><canvas ref={cv} width={400} height={400} style={{ width: 200, height: 200, borderRadius: 24, border: "3px solid #b8cdf0" }} role="img" aria-label={T("wardrobe_preview", { mascot: HOST_NAME })} /></div>
        {SLOTS.map((slot) => (
          <div key={slot} className="ps-row" role="group" aria-label={T(`slot_${slot}`)} style={{ justifyContent: "flex-start" }}>
            <b style={{ minWidth: 64 }}>{T(`slot_${slot}`)}</b>
            {COSMETICS.filter((c) => c.slot === slot).map((c) => {
              const has = unlocked.includes(c.id);
              return <button key={c.id} type="button" className="ps-chip" aria-pressed={worn.includes(c.id)} disabled={!has} onClick={() => setEquip({ ...equip, [slot]: c.id })} data-testid={`ps-cos-${c.id}`} title={has ? "" : need(c, T)}>{T(`cos_${c.id}`)}{has ? "" : ` · ${need(c, T)}`}</button>;
            })}
          </div>
        ))}
        <div className="ps-row"><button className="ps-btn ps-big" type="button" style={{ minHeight: 60, fontSize: 22 }} onClick={onClose} data-testid="ps-wardrobe-close">{T("back")}</button></div>
      </div>
    </div>
  );
}
