"use client";

import { MASCOT_NAME, MASCOT_POSES, Mascot, MascotSpeech, MascotSettingsProvider } from "@/features/learninghub/mascot";

// Dev-only review page for the mascot: every pose at 24/48/120/240 on light and dark. Not linked from anywhere.
const SIZES = [24, 48, 120, 240];
const POSES = [...MASCOT_POSES, "icon"] as const;

function Board({ dark, still }: { dark: boolean; still?: boolean }) {
  const v = dark
    ? { "--bg": "#0f1115", "--surface": "#181a21", "--ink": "#f2f4f8", "--line": "#2a2e39" }
    : { "--bg": "#f5f8fd", "--surface": "#ffffff", "--ink": "#171534", "--line": "#e3e8f3" };
  return (
    <section data-board={dark ? "dark" : "light"} style={{ ...(v as React.CSSProperties), background: "var(--bg)", color: "var(--ink)", padding: 20, borderRadius: 16, marginBottom: 24 }}>
      <h2 style={{ margin: "0 0 12px" }}>{dark ? "Dark" : "Light"} theme</h2>
      {POSES.map((p) => (
        <div key={p} data-pose={p} style={{ display: "flex", alignItems: "flex-end", gap: 24, padding: "10px 0", borderTop: "1px solid var(--line)", flexWrap: "wrap" }}>
          <code style={{ width: 90 }}>{p}</code>
          {SIZES.map((s) => (
            <Mascot key={s} pose={p} size={s} still={still} dir="right" />
          ))}
        </div>
      ))}
      <div style={{ display: "flex", gap: 16, alignItems: "center", marginTop: 16 }}>
        <Mascot pose="wave" size={96} />
        <MascotSpeech side="left">Hi Hannah! ({MASCOT_NAME})</MascotSpeech>
      </div>
    </section>
  );
}

export default function MascotShowcase() {
  // ?only=<pose>&size=<px> renders a single still pose on transparent (used by scripts/render-mascot.mjs).
  const q = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const only = q?.get("only");
  if (only) {
    return (
      <div data-export style={{ display: "inline-block", background: "transparent" }}>
        <Mascot pose={only as (typeof POSES)[number]} size={Number(q?.get("size")) || 192} still />
      </div>
    );
  }
  return (
    <main style={{ maxWidth: 1000, margin: "0 auto", padding: 24, fontFamily: "system-ui" }}>
      <h1>Mascot showcase ({MASCOT_NAME})</h1>
      <Board dark={false} />
      <Board dark />
      <h2>Calm mode (forced still)</h2>
      <MascotSettingsProvider calm><div style={{ display: "flex", gap: 12 }}><Mascot pose="wave" size={96} /><Mascot pose="dance" size={96} /></div></MascotSettingsProvider>
    </main>
  );
}
