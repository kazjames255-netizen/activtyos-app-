"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import { IncidentsApp } from "./IncidentsApp";
import { SafeguardingApp } from "./SafeguardingApp";

// Log a concern — the staff/operator hub that replaces the old "Incidents" nav
// item. Two tabs under one blue/white title bar: Behaviour (the day-to-day
// behaviour log, optionally shared with the parent) and Safeguarding (the
// confidential, DSL-routed concern form with a body map). Accidents live in
// their own area (Health & safety), so they're not duplicated here.

const LIGHT_PALETTE = {
  "--bg": "#f5f8fd", "--surface": "#ffffff", "--panel": "#fbf8fc",
  "--ink": "#171534", "--ink-2": "#4a4763", "--ink-3": "#8a86a3", "--line": "#ece6f1",
} as CSSProperties;

const TABS = [
  { id: "behaviour", label: "Behaviour", icon: "🧩", sub: "Behaviour & near-misses — share with the parent when you choose." },
  { id: "safeguarding", label: "Safeguarding", icon: "🛡️", sub: "Confidential concerns, routed to your DSL. Facts only." },
] as const;
type TabId = (typeof TABS)[number]["id"];

export function LogConcernApp() {
  const [tab, setTab] = useState<TabId>("behaviour");
  const active = TABS.find((t) => t.id === tab)!;

  return (
    <div className="-m-5 min-h-[calc(100vh-3.5rem)] bg-[var(--bg)] p-5 text-[var(--ink)]" style={LIGHT_PALETTE}>
      {/* Title bar */}
      <div className="relative mb-3.5 overflow-hidden rounded-2xl p-5 text-white shadow-[0_10px_30px_-12px_rgba(29,58,143,.55)]" style={{ background: "linear-gradient(120deg,#1d3a8f 0%,#3f78d8 100%)" }}>
        <div className="flex items-center gap-2 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-[17px]">⚑</span>Log a concern
        </div>
        <p className="mt-1.5 max-w-[620px] text-[12.5px] leading-[1.5] text-white/85">{active.sub}</p>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {TABS.map((t) => (
            <button key={t.id} type="button" onClick={() => setTab(t.id)} className="rounded-full px-4 py-2 text-[13px] font-extrabold transition-colors"
              style={tab === t.id ? { background: "#fff", color: "#1d3a8f" } : { background: "rgba(255,255,255,0.16)", color: "#fff" }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "behaviour" ? <IncidentsApp kind="incident" bare /> : <SafeguardingApp />}
    </div>
  );
}
