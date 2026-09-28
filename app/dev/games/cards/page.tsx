"use client";

import { GameCardArt, GAME_ACCENT } from "@/features/learninghub/games/cardArt";

// Dev-only review page for the Games tab card art (features/learninghub/GamesPanel.tsx's card grid). Not linked
// from anywhere — lets the actual <GameCardArt> scenes be screenshotted without needing an authenticated
// parent/child session, exactly like the /dev/mascot and /dev/games/{penguin,turbo}-slide dev pages already do.
const GAMES: { id: string; label: string; emoji: string }[] = [
  { id: "penguin", label: "Penguin Slide", emoji: "🐧" },
  { id: "turbo", label: "Turbo Slide", emoji: "🏎️" },
  { id: "market", label: "Market Day", emoji: "🧺" },
  { id: "bakeoff", label: "Bake Off Blitz", emoji: "🧁" },
  { id: "reef", label: "Rhythm Reef", emoji: "🐠" },
  { id: "compass", label: "Compass Quest", emoji: "🧭" },
  { id: "museum", label: "Museum Vault", emoji: "🏛️" },
  { id: "colourlab", label: "Colour Lab", emoji: "🔬" },
  { id: "botfoundry", label: "Bot Foundry", emoji: "🤖" },
  { id: "sortyard", label: "Sort Yard", emoji: "📊" },
  { id: "training", label: "Training Ground", emoji: "🎯" },
  { id: "debate", label: "Debate Keep", emoji: "🏰" },
  { id: "detective", label: "Story Detective", emoji: "🔎" },
  { id: "vault", label: "Word Vault", emoji: "🔐" },
  { id: "wordpop", label: "Word Pop", emoji: "💬" },
  { id: "primereef", label: "Prime Reef", emoji: "🐠" },
  { id: "datacarnival", label: "Data Carnival", emoji: "🎡" },
  { id: "shapeworkshop", label: "Shape Workshop", emoji: "🛠️" },
];

export default function Page() {
  return (
    <div style={{ background: "#0f1115", minHeight: "100vh", padding: 24, ["--surface" as string]: "#181a21", ["--ink" as string]: "#f2f4f8", ["--ink-2" as string]: "#c7cede", ["--line" as string]: "#2a2e39", ["--brand" as string]: "#3b5bdb" }}>
      <h1 style={{ color: "#fff", fontFamily: "sans-serif" }}>Games tab — card art review ({GAMES.length} games)</h1>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16, maxWidth: 1400 }}>
        {GAMES.map((g) => (
          <div key={g.id} style={{ background: "#171a24", borderRadius: 16, overflow: "hidden", border: "1px solid #2a2e39" }}>
            <div style={{ height: 110, width: "100%" }}>
              <GameCardArt id={g.id} emoji={g.emoji} />
            </div>
            <div style={{ padding: "10px 14px", color: "#fff", fontFamily: "sans-serif", fontSize: 13, fontWeight: 700 }}>
              {g.label} <span style={{ opacity: 0.5, fontWeight: 400 }}>({g.id}) — accent {GAME_ACCENT[g.id]}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
