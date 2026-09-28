"use client";
import type { Backend } from "../applied/store";
import { AppliedGameUI, type Theme } from "../applied/AppliedGameUI";

// Bake Off Blitz — measurement/ratio/proportion maths (scaling a recipe, unit conversion, capacity, mixing ratios)
// framed as a baking competition. Content and marking: features/learninghub/games/applied/core.ts (kind "measure:*").
// Raspberry/pink accent — never green (content rule: no green as a persistent brand colour).
const ACCENT = "#c2185b";

const theme: Theme = {
  title: "Bake Off Blitz", frameEmoji: "🧁", accent: ACCENT,
  introBody: "Scale up a recipe, convert units, and get the ratios right before the judges arrive.",
  scene: (phase, idx, total) => phase === "intro" ? "🧁 🥣 🍰" : phase === "done" ? "🏆" : `${idx + 1} / ${total} 🥖`,
  unitLabel: (item) => item.unit ?? null,
  prompt: (item) => {
    const p = item.prompt as { bake?: string; s1?: number; s2?: number; q1?: number; unit?: string; bigLabel?: string; smallLabel?: string; toUnit?: string; ratioA?: number; ratioB?: number; flour?: number; bowl?: number; cup?: number };
    if (item.kind === "scale") return { headline: <>A {p.bake} recipe for {p.s1} people uses <b>{p.q1}{p.unit}</b> of a key ingredient.</>, detail: <>How much is needed for <b>{p.s2}</b> people?</> };
    if (item.kind === "convert") return p.bigLabel
      ? { headline: <>A recipe calls for <b>{p.bigLabel}</b>.</>, detail: <>How many {p.toUnit} is that?</> }
      : { headline: <>A recipe calls for <b>{p.smallLabel}</b>.</>, detail: <>How many {p.toUnit} is that? (round to 2 decimal places)</> };
    if (item.kind === "ratio") return { headline: <>A {p.bake} mixes flour and sugar in a <b>{p.ratioA}:{p.ratioB}</b> ratio.</>, detail: <>With <b>{p.flour}g</b> of flour, how much sugar (in g) is needed?</> };
    return { headline: <>A mixing bowl holds <b>{p.bowl}ml</b>.</>, detail: <>Each measuring cup holds {p.cup}ml. How many FULL cups fit in the bowl?</> };
  },
};

export default function BakeOffSlide({ backend, onExit, resume, exitToken }: { backend: Backend; onExit: () => void; resume?: boolean; exitToken?: number }) {
  return <AppliedGameUI backend={backend} theme={theme} onExit={onExit} resume={resume} exitToken={exitToken} />;
}
