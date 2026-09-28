"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { HowScript } from "./types";
import { getDone } from "./scripts/progress";
import Glyph from "./Glyph";
import { Mascot, MascotSpeech, useMascotEnabled } from "../mascot";
import { useT } from "@/lib/i18n/provider";
import { useHowText } from "./i18n";

const mins = (s: HowScript) => Math.max(1, Math.round(s.scenes.reduce((a, x) => a + x.say.split(/\s+/).length, 0) / 2.4 / 60)); // ~145 wpm, plus pauses

// The tutor library: one card per short video, with a tick once it has been watched to the end (kept in this browser only).
// `hrefFor` makes the cards links (the public page); `onPick` makes them buttons (the in-app window).
export default function HowItWorksChooser({ role, topics, onPick, hrefFor }: { role: string; topics: HowScript[]; onPick?: (topic: string) => void; hrefFor?: (topic: string) => string }) {
  const tr = useT();
  const H = useHowText();
  const mascotOn = useMascotEnabled();
  const [done, setDone] = useState<string[]>([]);
  useEffect(() => { setDone(getDone(role)); }, [role]); // eslint-disable-line react-hooks/set-state-in-effect -- browser-only, after mount
  return (
    <>
    {mascotOn && <div className="mb-2 flex items-center gap-2" data-testid="hiw-mascot"><Mascot pose="wave" size={64} /><MascotSpeech side="left"><span dir="auto">{tr("hubmascot.tour")}</span></MascotSpeech></div>}
    <ol className="hiw-choose" data-testid="hiw-chooser" aria-label={H.ui("chooseVideo")}>
      {topics.map((raw, n) => {
        const t = H.script(raw);
        const ticked = done.includes(t.topic ?? "");
        const inner = (
          <>
            <span className="hiw-choose-ico" aria-hidden><Glyph icon={t.emoji ?? ""} size={32} /></span>
            <span className="hiw-choose-txt">
              <b><span className="hiw-choose-n">{n + 1}</span> {t.title}</b>
              <span>{t.blurb}</span>
              <small>{H.ui("minScenes", { m: mins(t), n: t.scenes.length })}{ticked ? H.ui("watched") : ""}</small>
            </span>
            <span className={`hiw-choose-tick${ticked ? " on" : ""}`} aria-hidden>{ticked ? "✓" : "▶"}</span>
          </>
        );
        return (
          <li key={t.topic}>
            {hrefFor
              ? <Link href={hrefFor(t.topic ?? "")} data-testid={`hiw-topic-${t.topic}`} className="hiw-choose-card" data-done={ticked ? "1" : "0"}>{inner}</Link>
              : <button type="button" data-testid={`hiw-topic-${t.topic}`} className="hiw-choose-card" data-done={ticked ? "1" : "0"} onClick={() => onPick?.(t.topic ?? "")}>{inner}</button>}
          </li>
        );
      })}
    </ol>
    </>
  );
}
