"use client";
import type { Backend } from "../applied/store";
import { AppliedGameUI, type Theme } from "../applied/AppliedGameUI";

// Rhythm Reef — pattern/sequencing maths (repeating shape/shell patterns, arithmetic and geometric number
// sequences, missing terms, a repeating "beat" of reef symbols) framed as an underwater reef. This is a
// pattern-RECOGNITION device, never a music-performance game (content rule: never a real rhythm/performance
// mechanic, never mention "Oak"). Content and marking: features/learninghub/games/applied/core.ts (kind
// "pattern:*"). Ocean-blue accent — never green (content rule: no green as a persistent brand colour).
const ACCENT = "#2b6cb0";

const theme: Theme = {
  title: "Rhythm Reef", frameEmoji: "🐠", accent: ACCENT,
  introBody: "Spot the pattern in the reef — shells, bubbles and number sequences — and say what comes next.",
  scene: (phase, idx, total) => phase === "intro" ? "🐠 🐚 🫧" : phase === "done" ? "🌊" : `${idx + 1} / ${total} 🪸`,
  prompt: (item) => {
    const p = item.prompt as { seq?: (number | string | null)[] };
    const seq = p.seq ?? [];
    const shown = (
      <span className="tabular-nums" dir="ltr">
        {seq.map((v, i) => <span key={i} style={{ marginInlineEnd: 6 }}>{v === null ? "❓" : v}</span>)}
      </span>
    );
    if (item.kind === "shapes" || item.kind === "beat") return { headline: <>What comes next in the reef?</>, detail: shown };
    if (item.kind === "missing") return { headline: <>Fill in the missing number.</>, detail: shown };
    return { headline: <>What's the next number in the sequence?</>, detail: shown };
  },
};

export default function RhythmReefSlide({ backend, onExit, resume, exitToken }: { backend: Backend; onExit: () => void; resume?: boolean; exitToken?: number }) {
  return <AppliedGameUI backend={backend} theme={theme} onExit={onExit} resume={resume} exitToken={exitToken} />;
}
